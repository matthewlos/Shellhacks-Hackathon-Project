"""The hard number: water used by the AI pot vs the timer, and time spent in the healthy band.

One-pot mode: the timer is virtual. It counts the pours a normal timer (TIMER_POUR_MS every TIMER_EVERY_S)
would have made over the same logged hours, at pot A's measured flow. Only full intervals count, so early on
the timer shows 0 ml and "saved" stays empty instead of flattering the AI.

  python report.py            # since the first real reading
  python report.py 6          # last 6 hours
  python report.py 6 --fake   # include FakeBoard data (code test only, never for slides)
"""
import sys
import time

import config
import store


def report(hours=None, include_fake=False):
    since = time.time() - hours * 3600 if hours else 0
    fake = "" if include_fake else " AND fake=0"
    pours = store.q(f"SELECT ts, pot, ran_ms, by FROM pours WHERE ts >= ?{fake}", (since,))
    reads = store.q(f"SELECT ts, a_pct, b_pct FROM readings WHERE ts >= ?{fake} ORDER BY ts", (since,))
    flow = config.load_cal()["flow_ml_per_s"]
    ml = {p: sum(r[2] for r in pours if r[1] == p) / 1000 * flow[p] for p in "AB"}
    n = {p: sum(1 for r in pours if r[1] == p) for p in "AB"}
    # test pours and Hit-the-Target demos: still counted in the AI's water (never flatters it), shown separately
    demo_ml = sum(r[2] for r in pours if r[1] == "A" and r[3] in ("manual", "target")) / 1000 * flow["A"]

    def band(col):
        vals = [r[col] for r in reads if r[col] is not None]
        if not vals:
            return None
        ok = sum(1 for v in vals if config.DRY_PCT <= v <= config.WET_PCT)
        return round(100 * ok / len(vals), 1)

    span_s = reads[-1][0] - reads[0][0] if len(reads) > 1 else 0
    span_h = span_s / 3600
    if config.ONE_POT:
        n["B"] = int(span_s // config.TIMER_EVERY_S) if config.TIMER_EVERY_S else 0
        ml["B"] = n["B"] * config.TIMER_POUR_MS / 1000 * flow["A"]
    saved = round(100 * (ml["B"] - ml["A"]) / ml["B"], 1) if ml["B"] else None
    return {
        "hours_logged": round(span_h, 2),
        "ai_pot_ml": round(ml["A"]), "timer_pot_ml": round(ml["B"]), "ai_pot_demo_ml": round(demo_ml),
        "ai_pours": n["A"], "timer_pours": n["B"],
        "water_saved_pct": saved,
        "ai_pot_time_healthy_pct": band(1), "timer_pot_time_healthy_pct": None if config.ONE_POT else band(2),
        "timer_is_virtual": bool(config.ONE_POT),
        "timer_schedule": f"{config.TIMER_POUR_MS / 1000:g} s every " + (f"{config.TIMER_EVERY_S / 3600:g} h" if config.TIMER_EVERY_S >= 3600 else f"{config.TIMER_EVERY_S / 60:g} min"),
        "timer_ml_per_pour": round(config.TIMER_POUR_MS / 1000 * flow["A"]),
        "healthy_band": f"{config.DRY_PCT:.0f}-{config.WET_PCT:.0f}%",
        "includes_fake_data": include_fake,
    }


if __name__ == "__main__":
    h = float(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1][0].isdigit() else None
    r = report(h, "--fake" in sys.argv)
    for k, v in r.items():
        print(f"{k:28} {v}")
