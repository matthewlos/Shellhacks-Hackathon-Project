"""Build Farm Hand's Laya training data from REAL Miami weather.

Weather: Open-Meteo archive (ERA5), hourly rain + FAO-56 reference evapotranspiration (ET0) + air temp at FIU,
2019-01-01 .. 2026-09-20. Drought level: US Drought Monitor, Miami-Dade county, weekly.

Field model (FAO-56 single-bucket water balance, a field, not the demo box):
  root zone 30 cm of sandy South-Florida soil: field capacity 0.20, wilting point 0.08 m3/m3
  -> total available water TAW = 36 mm; the crop starts to stress past RAW = 0.5 x TAW = 18 mm (p = 0.5)
  crop coefficient Kc = 1.05 (vegetables, mid-season), crop ET = Kc x ET0
A decision is made every 6 hours (00, 06, 12, 18 local). An irrigation refills the root zone to field capacity.

The label is the hindsight-best move (it can see the REAL next 24 h of rain); the model only sees a noisy
forecast, like the real agents do:
  wait_moist   depletion under 60% of RAW: the plant is fine, watering now would drain past the roots
  wait_rain    the soil is getting dry, but real rain in the next 24 h refills at least 80% of the deficit
  water        the soil is getting dry and the rain won't cover it
Writes data/decisions.jsonl (one decision per line) and data/weather.json (raw pull, for the replay).
"""
import json, math, random, urllib.request
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"; DATA.mkdir(exist_ok=True)
LAT, LON = 25.7566, -80.3740
START, END = "2019-01-01", "2026-09-20"
FC, WP, ZR = .20, .08, .30
TAW = 1000 * (FC - WP) * ZR          # 36 mm
RAW = .5 * TAW                       # 18 mm
KC = 1.05
random.seed(20260923)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=120))


def weather():
    f = DATA / "weather.json"
    if f.exists():
        return json.loads(f.read_text())
    w = get(f"https://archive-api.open-meteo.com/v1/archive?latitude={LAT}&longitude={LON}&start_date={START}&end_date={END}"
            "&hourly=precipitation,et0_fao_evapotranspiration,temperature_2m&timezone=America%2FNew_York")
    f.write_text(json.dumps(w))
    return w


def drought():
    f = DATA / "usdm_miami_dade.json"
    if not f.exists():
        rows = get("https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent"
                   "?aoi=12086&startdate=1/1/2019&enddate=9/23/2026&statisticsType=1")
        f.write_text(json.dumps(rows))
    rows = json.loads(f.read_text())
    out = []
    for r in rows:
        d = r["mapDate"][:10]
        lvl = "none"
        for k, name in (("d4", "D4 exceptional"), ("d3", "D3 extreme"), ("d2", "D2 severe"), ("d1", "D1 moderate"), ("d0", "D0 abnormally dry")):
            if float(r[k]) >= 25:
                lvl = name; break
        out.append((d, lvl))
    return sorted(out)


def forecast(actual_mm):
    """What a forecast would have said: right on average, wrong often (misses, false alarms, off amounts)."""
    if actual_mm < .2:
        if random.random() < .18:                                # false alarm
            mm = round(random.uniform(.5, 8), 1); p = random.randint(35, 70)
        else:
            mm = 0.0; p = random.randint(0, 25)
    else:
        if random.random() < .15:                                # missed it
            mm = round(actual_mm * random.uniform(0, .2), 1); p = random.randint(10, 35)
        else:
            mm = round(actual_mm * math.exp(random.gauss(0, .55)), 1); p = random.randint(45, 95)
    return mm, p


def main():
    w = weather()["hourly"]
    times = [datetime.fromisoformat(t) for t in w["time"]]
    rain = [x or 0.0 for x in w["precipitation"]]
    et0 = [x or 0.0 for x in w["et0_fao_evapotranspiration"]]
    temp = w["temperature_2m"]
    usdm = drought()
    di = 0
    dr = RAW * .5                                                # start half way to stress
    last_rain_h = 0
    n = len(times); rows = []
    for i in range(n):
        # the water balance runs every hour: rain refills, crop ET drains, anything past field capacity drains away
        dr = max(0.0, dr - rain[i] + KC * et0[i])
        dr = min(dr, TAW)
        if rain[i] >= 1.0:
            last_rain_h = i
        t = times[i]
        if t.hour % 6 or i + 24 >= n:
            continue
        next24 = sum(rain[i + 1:i + 25])
        past24_et = sum(et0[max(0, i - 23):i + 1]) * KC
        fmm, fp = forecast(next24)
        while di + 1 < len(usdm) and usdm[di + 1][0] <= t.strftime("%Y-%m-%d"):
            di += 1
        def oracle(d):
            if d < .6 * RAW:
                return "wait_moist"
            if next24 >= .8 * d:
                return "wait_rain"
            return "water"

        def make_state(d, fmm, fp):
            return {
                "soil_moisture_pct": round(20 + 45 * (1 - d / TAW) + random.gauss(0, 1.2), 1),   # probe: wilting 20%, field capacity 65%
                "stress_line_pct": round(20 + 45 * (1 - RAW / TAW), 1),
                "air_temp_c": temp[i],
                "hour": t.hour,
                "month": t.strftime("%B"),
                "rain_forecast_next_24h_mm": fmm,
                "rain_chance_next_24h_pct": fp,
                "crop_water_use_last_24h_mm": round(past24_et, 2),
                "hours_since_real_rain": i - last_rain_h,
                "county_drought": usdm[di][1] if usdm and usdm[di][0] <= t.strftime("%Y-%m-%d") else "unknown",
            }

        label = oracle(dr)
        rows.append({"time": t.isoformat(), "year": t.year, "kind": "trajectory", "state": make_state(dr, fmm, fp), "label": label,
                     "truth": {"depletion_mm": round(dr, 2), "rain_next_24h_mm": round(next24, 1)}})
        # counterfactuals: same real hour, same real rain to come, the soil at other dryness levels
        for lo, hi in ((.45 * RAW, TAW), (0.0, TAW)):
            d = random.uniform(lo, hi)
            f2, p2 = forecast(next24)
            rows.append({"time": t.isoformat(), "year": t.year, "kind": "counterfactual", "state": make_state(d, f2, p2), "label": oracle(d),
                         "truth": {"depletion_mm": round(d, 2), "rain_next_24h_mm": round(next24, 1)}})
        if label == "water":
            dr = 0.0                                             # the hindsight-best farmer waters: root zone back to field capacity
    with open(DATA / "decisions.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    from collections import Counter
    c = Counter(r["label"] for r in rows)
    print(len(rows), "decisions,", rows[0]["time"], "->", rows[-1]["time"], dict(c))
    print("trajectory only:", dict(Counter(r["label"] for r in rows if r["kind"] == "trajectory")))
    print("train (2019-2024):", sum(1 for r in rows if r["year"] <= 2024), " test (2025-2026):", sum(1 for r in rows if r["year"] >= 2025))


if __name__ == "__main__":
    main()
