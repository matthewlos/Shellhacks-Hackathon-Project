"""Day-by-day recording of eval.py's season replay, for the /sim timelapse page.

Same simulated field, same real 2025-26 Miami weather, same noisy forecast and seeds as eval.py section 2,
but it keeps every day instead of only the totals. Writes laptop/static/sim_data.json.
Brains: timer (waters every morning) and laya (our model). Rules and oracle stay in eval.py.

Run (Mac):     laya/.venv-mac/bin/python laya/season_replay.py            (uses Apple MPS, else CPU)
Run (PC):      .venv/Scripts/python laya/season_replay.py                 (uses CUDA)
Needs the model in laya/model/farmhand-laya (hf download chinchop/farmhand-laya --local-dir laya/model/farmhand-laya).
Check: the totals it prints should match laya/data/eval.md (timer exactly; laya within a few mm, GPU math differs slightly).
"""
import collections, json, random, time
from datetime import datetime
from pathlib import Path

import torch
import laya
from farmhand_questions import QUESTIONS
from build_dataset import TAW, RAW, KC, forecast, drought

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "laptop" / "static" / "sim_data.json"
dev = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
agent = laya.load(str(HERE / "model/farmhand-laya"), device=dev)

w = json.loads((HERE / "data/weather.json").read_text())["hourly"]
times = [datetime.fromisoformat(t) for t in w["time"]]
rain = [x or 0.0 for x in w["precipitation"]]; et0 = [x or 0.0 for x in w["et0_fao_evapotranspiration"]]; temp = w["temperature_2m"]
usdm = drought()
by_month = collections.defaultdict(float); days_m = collections.defaultdict(set)
for t, e in zip(times, et0):
    if t.year <= 2024:
        by_month[t.month] += KC * e; days_m[t.month].add(t.date())
TIMER_MM = round(max(by_month[m] / len(days_m[m]) for m in by_month), 2)
start = next(i for i, t in enumerate(times) if t.year >= 2025)
pct_of = lambda dr: round(20 + 45 * (1 - dr / TAW), 1)          # the probe % the model sees (no noise here)


def replay(brain):
    """eval.py's replay() line for line, plus a per-day log."""
    random.seed(7)
    dr, used, stress_h, drained, last_rain, di, calls = RAW * .5, 0.0, 0, 0.0, start, 0, 0
    days, cur = [], None
    for i in range(start, len(times) - 24):
        t = times[i]
        if cur is None or cur["d"] != t.strftime("%Y-%m-%d"):
            if cur: days.append(cur)
            cur = {"d": t.strftime("%Y-%m-%d"), "rain": 0.0, "irr": 0.0, "stress": 0, "picks": [], "soil": None}
        dr = dr - rain[i] + KC * et0[i]
        if dr < 0: drained += -dr; dr = 0.0
        dr = min(dr, TAW)
        cur["rain"] += rain[i]
        if rain[i] >= 1: last_rain = i
        if dr > RAW: stress_h += 1; cur["stress"] += 1
        if t.hour == 12: cur["soil"] = pct_of(dr)
        if t.hour % 6: continue
        nxt = sum(rain[i + 1:i + 25]); fmm, fp = forecast(nxt)
        while di + 1 < len(usdm) and usdm[di + 1][0] <= t.strftime("%Y-%m-%d"): di += 1
        pct = round(20 + 45 * (1 - dr / TAW) + random.gauss(0, 1.2), 1)
        line = round(20 + 45 * (1 - RAW / TAW), 1)
        st = {"soil_moisture_pct": pct, "stress_line_pct": line, "air_temp_c": temp[i], "hour": t.hour, "month": t.strftime("%B"),
              "rain_forecast_next_24h_mm": fmm, "rain_chance_next_24h_pct": fp,
              "crop_water_use_last_24h_mm": round(sum(et0[max(0, i - 23):i + 1]) * KC, 2), "hours_since_real_rain": i - last_rain,
              "county_drought": usdm[di][1] if usdm[di][0] <= t.strftime("%Y-%m-%d") else "unknown"}
        amt = 0.0
        if brain == "timer":
            amt = TIMER_MM if t.hour == 6 else 0.0
        elif brain == "laya":
            calls += 1
            pick = agent.predict(st, QUESTIONS)["answers"]["action"]["choice"]
            cur["picks"].append([t.hour, pick, fmm, fp])
            amt = dr if pick == "water" else 0.0
        used += amt
        cur["irr"] += amt
        dr -= amt
        if dr < 0: drained += -dr; dr = 0.0
    days.append(cur)
    for d in days:
        d["rain"] = round(d["rain"], 1); d["irr"] = round(d["irr"], 2)
    return days, {"irrigation_mm": round(used, 1), "gal_per_acre": round(used * 1069), "stress_hours": stress_h,
                  "drained_mm": round(drained, 1), "checks": calls}


t0 = time.time()
timer_days, timer_tot = replay("timer")
laya_days, laya_tot = replay("laya")
print(f"device {dev}, {time.time() - t0:.0f} s")
print("timer", timer_tot)
print("laya ", laya_tot)
OUT.write_text(json.dumps({
    "about": "Season replay: simulated field (FAO-56 bucket, sandy soil, Kc 1.05) on real Miami weather 2025-01-01..2026-09-19. "
             "Laya never saw these years in training. Built by laya/season_replay.py. Not a measured farm.",
    "built": time.strftime("%Y-%m-%d %H:%M"), "device": dev,
    "timer_mm_each_morning": TIMER_MM, "stress_line_pct": round(20 + 45 * (1 - RAW / TAW), 1), "gal_per_mm_acre": 1069,
    "totals": {"timer": timer_tot, "laya": laya_tot},
    "days": [{"d": a["d"], "rain": a["rain"],
              "timer": {"soil": a["soil"], "irr": a["irr"], "stress": a["stress"]},
              "laya": {"soil": b["soil"], "irr": b["irr"], "stress": b["stress"], "picks": b["picks"]}}
             for a, b in zip(timer_days, laya_days)],
}, separators=(",", ":")))
print("wrote", OUT, f"{OUT.stat().st_size / 1024:.0f} KB")
