"""Hit the Target: a judge picks a moisture %, Farm Hand walks the soil up to it in short pulses and stops inside the band.

Each pulse:
  1. read the soil (median of the last readings, so probe noise can't fool it)
  2. size the pulse from the rate it has learned: seconds = gap / pct_per_s, times 0.7 so it creeps up instead of overshooting
  3. pump, then wait for the water to reach the probe and the reading to go flat (settle)
  4. measure what that pulse really did and update the rate (this soil + this pump, learned live)
  5. if the pump ran but the probe barely moved -> STOP and say so (pinched tube, pump out of water, tube missing the pot)

It can only ADD water, so a target below the current reading ends right away with "already above target".
Safety: every pulse still passes brain.guards() (board online, not already wet, daily cap). The 30-minute gap between
AI pours is skipped here because a person started this run on purpose and is standing next to the pot.
"""
import statistics
import threading
import time

import brain
import config
import soak
import store

BAND = 2.0            # +/- % counts as "hit"
LOCK = 1.0            # keep pulsing until within 1% below the target (then stop: it can't take water back out)
MAX_PULSES = 6
PULSE_MAX_S = 8.0     # no single long pour: it creeps up
PULSE_MIN_S = 1.0
CREEP = 0.7           # aim for 70% of the gap each pulse
MIN_SETTLE_S = 12     # water needs time to reach the probe
MAX_SETTLE_S = 90     # after this, whatever the probe says is the answer
FLAT = 0.4            # two 10-reading medians this close = the reading stopped moving
MISS_RISE = 0.8       # floor for "the water arrived" (probe noise is about +/- 1%)
MISS_SHARE = 0.3      # a pulse that did under 30% of what the learned rate expects didn't reach the soil
CHECKABLE = 3.0       # only judge "water isn't arriving" on pulses expected to add 3%+ (small ones drown in probe noise)

run = {"phase": "idle"}      # the dashboard reads this through /api/live
_lock = threading.Lock()
_stop = threading.Event()


def _vals(n):
    h = soak.WATCHER.hist["A"] if soak.WATCHER else []
    return [v for _, v in h[-n:]]


def _now_pct():
    v = _vals(6)
    return round(statistics.median(v), 1) if v else None


def _wait(s):
    return _stop.wait(s)      # True = someone hit stop


def _settle(before, pulse_s, need):
    """Wait for the pump to finish, then for the reading to go flat. Returns (after_pct, seconds_waited)."""
    t0 = time.time()
    while (brain.BOARD.latest or {}).get("pumping", "none") != "none" and time.time() - t0 < pulse_s + 10:
        if _wait(.5):
            return None, 0
    t1 = time.time()
    while time.time() - t1 < MAX_SETTLE_S:
        if _wait(1):
            return None, 0
        run["now"] = _now_pct()
        v = _vals(20)
        if time.time() - t1 >= MIN_SETTLE_S and len(v) >= 20:
            a, b = statistics.median(v[:10]), statistics.median(v[10:])
            if abs(b - a) < FLAT and b - before >= need:
                break
    return _now_pct(), round(time.time() - t1)


def _go(target):
    rate = brain.pct_per_s()
    flow = config.load_cal()["flow_ml_per_s"]["A"]
    start = _now_pct()
    t_start = time.time()
    run.clear()
    run.update(phase="reading", target=target, band=BAND, start=start, now=start, rate=rate, pulses=[], t0=t_start,
               msg=f"Soil is {start}%. Target {target}%.")
    brain.log_act("target_agent", f"target {target}%, soil {start}%")
    soak.PAUSED = True                                   # this run measures its own pulses (the 3-min watcher would overlap them)
    try:
        for i in range(MAX_PULSES):
            now = _now_pct()
            run["now"] = now
            if now is None:
                return _end("fault", "No readings from the board.")
            if now >= target - LOCK:
                return _end("locked" if now <= target + BAND else "over",
                            f"Locked at {now}%, target {target}%." if now <= target + BAND
                            else (f"Overshot: the last pulse took the soil to {now}%, past the {target}% target." if run["pulses"]
                                  else f"Soil is {now}%, already above the {target}% target. Water can't be taken back out."))
            gap = target - now
            secs = round(max(PULSE_MIN_S, min(PULSE_MAX_S, gap / rate * CREEP)), 1)
            ok, why, _ = brain.guards(secs, skip_gap=True)
            if not ok:
                return _end("blocked", f"Safety rules stopped it: {why}.")
            run.update(phase="pulsing", msg=f"Pulse {i + 1}: {secs} s. Gap {gap:.1f}%, learned {rate:.2f} % per second.")
            brain.log_act("target_agent", f"pulse {i + 1}: {secs}s for a {gap:.1f}% gap")
            brain.log_act("executor", f"pump A {secs:.0f}s")
            sent = time.time()
            brain.BOARD.tag_next = "target"
            brain.BOARD.pour("A", int(secs * 1000))
            ev = None
            while ev is None and time.time() - sent < 3:           # did the chip actually start the pump?
                ev = next((e for e in brain.BOARD.events[::-1] if e.get("ts", 0) >= sent - .5
                           and e.get("pot") == "A" and e.get("type") in ("pour_start", "refused")), None)   # FakeBoard/firmware both tag pot
                if ev is None and _wait(.2):
                    return _end("stopped", "Stopped.")
            if ev is None or ev["type"] == "refused":
                return _end("blocked", "The chip didn't start the pump (" + (ev or {}).get("why", "no answer") + "). No water went in.")
            run["phase"] = "settling"
            expect = rate * secs
            need = max(MISS_RISE, MISS_SHARE * expect) if expect >= CHECKABLE else 0.0
            after, waited = _settle(now, secs, need)
            if after is None:
                return _end("stopped", "Stopped.")
            rise = round(after - now, 1)
            store.add_soak({"pot": "A", "poured_s": secs, "before_pct": now, "peak_pct": after, "rise_pct": rise,
                            "first_rise_s": None, "pct_per_s": round(rise / secs, 3), "ok": rise >= max(need, MISS_RISE),
                            "note": "target pulse"}, brain.BOARD.fake)
            run["pulses"].append({"s": secs, "before": now, "after": after, "rise": rise, "wait_s": waited})
            if need and rise < need:
                brain.log_act("target_agent", f"pulse {i + 1} moved the probe only {rise}%: stopping")
                return _end("fault", f"The pump ran {secs} s, that should add about {rate * secs:.1f}%, but the probe moved {rise:+.1f}%. Water isn't reaching the soil: "
                                     "check the tube isn't pinched, the pump is under water, and the tube points at the pot.")
            if rise >= MISS_RISE:                            # a tiny pulse's rise is mostly noise: don't learn from it
                rate = round(.5 * rate + .5 * rise / secs, 3)  # learn: blend what it expected with what it just saw
            run["rate"] = rate
            brain.log_act("target_agent", f"pulse {i + 1}: +{rise}%, rate now {rate}")
        now = _now_pct()
        return _end("locked" if abs(now - target) <= BAND else "short", f"Out of pulses at {now}%, target {target}%.")
    finally:
        soak.PAUSED = False
        run["secs"] = round(sum(p["s"] for p in run.get("pulses", [])), 1)
        run["ml"] = round(run["secs"] * flow)
        run["took_s"] = round(time.time() - t_start)


def _end(phase, msg):
    run.update(phase=phase, msg=msg, now=_now_pct(), t_end=time.time())
    brain.log_act("target_agent", msg[:90])
    store.add_decision("water" if run.get("pulses") else "wait", sum(p["s"] for p in run.get("pulses", [])),
                       "target run", f"TARGET: {msg}", "{}")
    return dict(run)


def start(target):
    target = float(target)
    lo, hi = config.DRY_PCT, config.WET_PCT - BAND
    if not lo <= target <= hi:
        return {"ok": False, "why": f"pick a target between {lo:.0f}% and {hi:.0f}%"}
    if not _lock.acquire(blocking=False):
        return {"ok": False, "why": "a target run is already going"}
    _stop.clear()

    def job():
        try:
            _go(target)
        except Exception as e:
            _end("fault", f"Target run crashed: {e!r}"[:200])
        finally:
            _lock.release()
    threading.Thread(target=job, daemon=True).start()
    return {"ok": True}


def stop():
    _stop.set()
