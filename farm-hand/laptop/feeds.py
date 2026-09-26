"""Outside data: rain forecast (Open-Meteo, free, no key), drought level (US Drought Monitor, free, no key),
and the local watering-day rule. Each call is cached so the agent loop doesn't hammer the APIs.
Tested live 2026-09-22: both endpoints answered."""
import datetime as dt
import time

import requests

import config

_cache = {}


def _cached(key, ttl_s, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl_s:
        return hit[1]
    try:
        val = fn()
    except Exception as e:                       # venue WiFi died: keep the last good value
        if hit:
            return {**hit[1], "stale": True}
        return {"error": f"{type(e).__name__}: {e}"}
    _cache[key] = (time.time(), val)
    return val


def forecast():
    """Next 24 h: rain chance, rain mm, and ET0 (how much water the air pulls out of soil)."""
    def get():
        r = requests.get("https://api.open-meteo.com/v1/forecast", timeout=15, params={
            "latitude": config.LAT, "longitude": config.LON, "forecast_hours": 24,
            "hourly": "precipitation_probability,precipitation,et0_fao_evapotranspiration,temperature_2m",
            "timezone": "America/New_York"})
        r.raise_for_status()
        h = r.json()["hourly"]
        rain_mm = [x or 0 for x in h["precipitation"]]
        prob = [x or 0 for x in h["precipitation_probability"]]
        first_rain = next((i for i, (p, mm) in enumerate(zip(prob, rain_mm)) if p >= 50 and mm >= 1.0), None)
        return {
            "rain_mm_next_6h": round(sum(rain_mm[:6]), 1),
            "rain_mm_next_24h": round(sum(rain_mm), 1),
            "max_rain_chance_next_6h": max(prob[:6]),
            "max_rain_chance_next_24h": max(prob),
            "hours_until_real_rain": first_rain,            # None = no solid rain in 24 h
            "et0_mm_next_24h": round(sum(x or 0 for x in h["et0_fao_evapotranspiration"]), 2),
            "temp_c_now": h["temperature_2m"][0],
            "source": "open-meteo.com",
        }
    return _cached("forecast", 15 * 60, get)


def drought():
    """Latest weekly US Drought Monitor numbers for the county. Percent of the county in each level (cumulative)."""
    def get():
        end = dt.date.today()
        start = end - dt.timedelta(days=21)
        r = requests.get(
            "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent",
            timeout=30, headers={"Accept": "application/json"},
            params={"aoi": config.DROUGHT_FIPS, "startdate": f"{start.month}/{start.day}/{start.year}",
                    "enddate": f"{end.month}/{end.day}/{end.year}", "statisticsType": 1})
        r.raise_for_status()
        rows = sorted(r.json(), key=lambda x: x["mapDate"])
        if not rows:
            return {"error": "no drought rows"}
        w = rows[-1]
        levels = [("D4", "exceptional"), ("D3", "extreme"), ("D2", "severe"), ("D1", "moderate"), ("D0", "abnormally dry")]
        worst = next(((k, name) for k, name in levels if float(w[k.lower()]) >= 25), ("none", "no drought"))
        return {
            "county": w["county"], "week_of": w["mapDate"][:10],
            "pct_in_D1_or_worse": float(w["d1"]), "pct_in_D2_or_worse": float(w["d2"]),
            "pct_in_D3_or_worse": float(w["d3"]), "pct_in_D4": float(w["d4"]),
            "level": worst[0], "level_name": worst[1],
            "source": "droughtmonitor.unl.edu",
        }
    return _cached("drought", 6 * 3600, get)


def watering_day(now=None):
    """Miami-Dade year-round landscape rule (VERIFY on miamidade.gov before the demo):
    odd addresses Wed + Sat, even addresses Thu + Sun, only before 10 am or after 4 pm."""
    now = now or dt.datetime.now()
    days = {"odd": (2, 5), "even": (3, 6)}[config.ADDRESS_PARITY]      # Mon=0
    legal_day = now.weekday() in days
    legal_hour = now.hour < 10 or now.hour >= 16
    return {
        "legal_now": legal_day and legal_hour,
        "legal_day": legal_day, "legal_hour": legal_hour,
        "rule": f"{config.ADDRESS_PARITY} address: {'Wed+Sat' if config.ADDRESS_PARITY == 'odd' else 'Thu+Sun'}, before 10am or after 4pm",
        "note": "Farms (agricultural irrigation) follow different district rules; this is the home-lawn rule for the demo.",
    }
