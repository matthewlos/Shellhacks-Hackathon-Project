"""Pour detector: after every pour, watch the probe and measure what the water actually did.

  before_pct    moisture right before the pump started (median of the last readings)
  first_rise_s  seconds until the probe first saw +1% (how long the water took to reach the probe)
  rise_pct      how much the moisture went up (peak - before)
  pct_per_s     rise_pct / seconds poured  -> the agents use this to size the next pour (self-calibrating)
  ok            False if the probe barely moved: pump dry, tube kinked, or water missing the pot

"""
import statistics
import threading
import time

import store

WATCH_S = 180          # how long to watch after a pour (real seconds)
RISE_SEEN = 1.0        # +1% = the water reached the probe
MIN_OK_RISE = 1.5      # less than this after a full watch = something's wrong

live = {"phase": "idle"}   # the dashboard's 3D view reads this
# Hand pour: someone (a judge) poured water in with no pump running. The probe jumps and the dashboard shows a banner.
HAND_RISE = 4.0            # +4% over the last ~1-2 min with the pump quiet = water came from a person
PUMP_QUIET_S = 240         # the pump's own water can still be arriving for this long after a pour
hand = {"phase": "idle"}   # {"phase": "seen", "ts", "before", "now", "rise"} while fresh
PAUSED = False             # True during a Hit-the-Target run: target.py measures its own pulses
WATCHER = None             # the one SoakWatcher (target.py reads its recent readings)


class SoakWatcher:
    def __init__(self, board, speed=1.0):
        self.board = board
        self.watch_s = WATCH_S / speed
        self.hist = {"A": [], "B": []}          # (ts, pct) recent readings
        self.long = []                          # pot A, last ~3 min, for the hand-pour check
        self.last_pump = 0.0
        board.listeners.append(self.on_line)
        global WATCHER
        WATCHER = self

    def on_line(self, obj):
        t = obj.get("type")
        if t == "reading":
            for pot, key in (("A", "a_pct"), ("B", "b_pct")):
                self.hist[pot] = (self.hist[pot] + [(time.time(), obj[key])])[-30:]
            if obj.get("pumping", "none") != "none":
                self.last_pump = time.time()
            self.check_hand(obj["a_pct"])
        elif t == "pour_start":
            self.last_pump = time.time()
        if t == "pour_start" and not PAUSED:
            pot = obj["pot"]
            before = [v for _, v in self.hist[pot][-6:]]
            if before:
                threading.Thread(target=self.watch, args=(pot, obj["ms"] / 1000, statistics.median(before)), daemon=True).start()

    def check_hand(self, pct):
        now_t = time.time()
        self.long = [(ts, v) for ts, v in self.long if now_t - ts < 180] + [(now_t, pct)]
        if hand.get("phase") == "seen":
            if now_t - hand["ts"] < 90:                         # still soaking in: keep the banner's number growing
                v = statistics.median([v for _, v in self.long[-5:]])
                hand.update(now=round(v, 1), rise=round(max(hand["rise"], v - hand["before"]), 1))
                return
            if now_t - hand["ts"] < 180:
                return                                          # cooldown, so one pour = one banner
            hand.clear(); hand["phase"] = "idle"
        base = [v for ts, v in self.long if 45 <= now_t - ts <= 120]
        if len(base) < 10 or len(self.long) < 5 or PAUSED or now_t - self.last_pump < PUMP_QUIET_S:
            return
        before, v = statistics.median(base), statistics.median([v for _, v in self.long[-5:]])
        if v - before >= HAND_RISE:
            hand.clear(); hand.update(phase="seen", ts=now_t, before=round(before, 1), now=round(v, 1), rise=round(v - before, 1))
            print("[soak] hand pour seen", hand)

    def watch(self, pot, poured_s, before):
        t0 = time.time()
        peak, first = before, None
        live.update(phase="soaking", pot=pot, before=before, now=before, t0=t0, watch_s=self.watch_s, poured_s=poured_s)
        while time.time() - t0 < self.watch_s:
            time.sleep(0.5)
            if not self.hist[pot]:
                continue
            v = self.hist[pot][-1][1]
            peak = max(peak, v)
            live["now"] = v
            if first is None and v >= before + RISE_SEEN:
                first = time.time() - t0
        rise = round(peak - before, 1)
        ok = rise >= MIN_OK_RISE
        note = ("water reached the probe" if ok else
                "probe barely moved: check the pump is in water, the tube isn't kinked, and the tube points at the pot")
        d = {"pot": pot, "poured_s": poured_s, "before_pct": round(before, 1), "peak_pct": round(peak, 1),
             "rise_pct": rise, "first_rise_s": round(first, 1) if first is not None else None,
             "pct_per_s": round(rise / poured_s, 3) if poured_s else None, "ok": ok, "note": note}
        store.add_soak(d, self.board.fake)
        live.clear(); live.update(phase="done", last=d, t_done=time.time())
        print("[soak]", d)


def learned_pct_per_s(pot="A", default=1.2):
    """Median of the last 5 good soaks. This is how the system learns its own pump + soil."""
    vals = [r[7] for r in store.soaks(20) if r[1] == pot and r[8] and r[7]]
    return round(statistics.median(vals[:5]), 3) if vals else default
