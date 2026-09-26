"""Test the trained Laya on data it never saw (2025-01-01 .. 2026-09-19, real Miami weather).

1. Accuracy: every held-out decision in data/decisions.jsonl (trajectory + what-if states).
2. Season replay: the same FAO-56 field as build_dataset.py, run hour by hour on the real 2025-26 weather, with each
   watering brain deciding every 6 hours from a noisy forecast (same noise seed for everyone):
     timer   waters every morning at 6 AM a fixed amount = the average crop water use of the hottest month (2019-24)
     rules   Farm Hand's plain rule brain: water if the probe is within 5 points of the stress line and the forecast
             isn't >= 5 mm at >= 50% chance
     laya    the trained model's pick
     oracle  hindsight-best (knows the real rain): the ceiling, not a real option
   Water/soil results: irrigation used (mm, and gallons per acre: 1 mm on 1 acre = 1,069 gal), hours the crop spent
   past the stress line, water lost below the roots (drainage), from rain + irrigation.
This is a simulated field on real weather, not a measured farm. Writes data/eval.md.
"""
import json, math, random, time, collections
from datetime import datetime
from pathlib import Path
import laya
from farmhand_questions import QUESTIONS, LABELS
from build_dataset import FC, WP, ZR, TAW, RAW, KC, forecast, drought

HERE = Path(__file__).resolve().parent
agent = laya.load(str(HERE / "model/farmhand-laya"), device="cuda")
out = ["# Farm Hand Laya: test on 2025-01-01 .. 2026-09-19 (never seen in training)\n", f"Run {time.strftime('%Y-%m-%d %H:%M')}.\n"]

# ---------- 1. accuracy
rows = [json.loads(l) for l in open(HERE / "data/decisions.jsonl", encoding="utf-8")]
test = [r for r in rows if r["year"] >= 2025]
ok, tot, conf = collections.Counter(), collections.Counter(), collections.Counter()
t0 = time.time()
B = 64
for b in range(0, len(test), B):
    chunk = test[b:b + B]
    res = agent.predict_batch([r["state"] for r in chunk], QUESTIONS)
    for r, a in zip(chunk, res):
        p = a["answers"]["action"]["choice"]
        tot[r["label"]] += 1; ok[r["label"]] += p == r["label"]; conf[(r["label"], p)] += 1
ms = (time.time() - t0) / len(test) * 1000
acc = sum(ok.values()) / len(test)
bal = sum(ok[k] / tot[k] for k in LABELS if tot[k]) / sum(1 for k in LABELS if tot[k])
out += ["## 1. Accuracy on held-out decisions\n", f"- decisions: {len(test)}", f"- accuracy: **{acc:.3f}**", f"- balanced accuracy (each move counts the same): **{bal:.3f}**",
        "- per move: " + ", ".join(f"{k} {ok[k]}/{tot[k]} ({ok[k] / tot[k]:.3f})" for k in LABELS if tot[k]),
        f"- speed: {ms:.1f} ms per decision (batched, RTX 4070)", "",
        "Confusion (true -> predicted): " + ", ".join(f"{a}->{p}: {n}" for (a, p), n in sorted(conf.items())), ""]
print("\n".join(out[-8:]), flush=True)

# ---------- 2. season replay
w = json.loads((HERE / "data/weather.json").read_text())["hourly"]
times = [datetime.fromisoformat(t) for t in w["time"]]
rain = [x or 0.0 for x in w["precipitation"]]; et0 = [x or 0.0 for x in w["et0_fao_evapotranspiration"]]; temp = w["temperature_2m"]
usdm = drought()
# timer amount: hottest month's average daily crop water use in the training years
by_month = collections.defaultdict(float); days_m = collections.defaultdict(set)
for t, e in zip(times, et0):
    if t.year <= 2024:
        by_month[t.month] += KC * e; days_m[t.month].add(t.date())
TIMER_MM = round(max(by_month[m] / len(days_m[m]) for m in by_month), 2)
start = next(i for i, t in enumerate(times) if t.year >= 2025)


def replay(brain):
    random.seed(7)
    dr, used, stress_h, drained, last_rain, di, calls = RAW * .5, 0.0, 0, 0.0, start, 0, 0
    pending = []
    for i in range(start, len(times) - 24):
        t = times[i]
        dr = dr - rain[i] + KC * et0[i]
        if dr < 0: drained += -dr; dr = 0.0
        dr = min(dr, TAW)
        if rain[i] >= 1: last_rain = i
        if dr > RAW: stress_h += 1
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
        elif brain == "rules":
            amt = dr if (pct <= line + 5 and not (fmm >= 5 and fp >= 50)) else 0.0
        elif brain == "oracle":
            amt = dr if (dr >= .6 * RAW and nxt < .8 * dr) else 0.0
        elif brain == "laya":
            calls += 1
            amt = dr if agent.predict(st, QUESTIONS)["answers"]["action"]["choice"] == "water" else 0.0
        used += amt
        dr -= amt
        if dr < 0: drained += -dr; dr = 0.0
    return {"irrigation_mm": round(used, 1), "gal_per_acre": round(used * 1069), "stress_hours": stress_h, "drained_mm": round(drained, 1)}


hours = len(times) - 24 - start
res = {b: replay(b) for b in ("timer", "rules", "laya", "oracle")}
out += ["## 2. Season replay: a simulated field on real 2025-26 Miami weather\n",
        f"{hours} hours ({times[start].date()} .. {times[len(times) - 25].date()}). Timer = {TIMER_MM} mm every morning (the hottest month's average crop water use, 2019-24).\n",
        "| brain | irrigation (mm) | gallons per acre | hours past the stress line | lost below the roots (mm) |", "|---|---:|---:|---:|---:|"]
out += [f"| {b} | {r['irrigation_mm']} | {r['gal_per_acre']:,} | {r['stress_hours']} | {r['drained_mm']} |" for b, r in res.items()]
t, l = res["timer"], res["laya"]
out += ["", f"Laya vs timer: {100 * (t['irrigation_mm'] - l['irrigation_mm']) / t['irrigation_mm']:.1f}% less irrigation, "
        f"{t['gal_per_acre'] - l['gal_per_acre']:,} gallons per acre saved, stress hours {l['stress_hours']} vs {t['stress_hours']}.",
        "", "⚠️ Simulated field (FAO-56 bucket, assumed sandy soil, Kc 1.05) on real weather. Not a measured farm."]
(HERE / "data/eval.md").write_text("\n".join(out), encoding="utf-8")
print("\n".join(out[-9:]))
