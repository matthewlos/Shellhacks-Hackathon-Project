"""Farm Hand home server: the ESP32 posts its readings here, gets a decision back, and the live page is served here.

Runs on the Mac mini (always on), reachable from anywhere:
    https://farmhand.dmchang.xyz/                    Matthew's site (ui-mui), auto-deployed from GitHub (see cloud/deploy.sh)
    https://farmhand.dmchang.xyz/farmhand/            simple live page
    https://farmhand.dmchang.xyz/farmhand/data        live data (JSON) for the site
    https://farmhand.dmchang.xyz/farmhand/api/...     the web app's API (SSE at api/events + REST, see api() below)
    POST .../farmhand/reading                         the ESP32 (header X-Farmhand-Token)
  (also on Tailscale Funnel: https://dantes-mac-mini.tailb2bea0.ts.net/farmhand/...)

    FARMHAND_TOKEN=... python receiver.py        # listens on 127.0.0.1:8120

Why this direction: the ESP32 (on FIU_WiFi) and the Mac mini (at home) are both behind routers that block incoming
connections, so the ESP32 always calls in and the decision rides back in the reply.

Decision: Laya if its weights are in LAYA_DIR (default ~/farmhand-server/model/farmhand-laya) and it loads, otherwise
the baseline rule (water box A when it's at or under the baseline). The ESP32 keeps its own safety rules either way.
Storage: SQLite, farmhand_home.db next to this file. Stdlib only, plus laya/torch when Laya is used.
"""
import json
import os
import queue
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("FARMHAND_PORT", 8120))
TOKEN = os.environ.get("FARMHAND_TOKEN", "")
BASELINE = float(os.environ.get("FARMHAND_BASELINE", 45))        # keep box A at least this wet (%)
TARGET = float(os.environ.get("FARMHAND_TARGET", 60))            # a drink aims here
PUMP_S_MAX = 8                                                   # longest drink the server will ever ask for
LAT, LON = 25.7566, -80.3740                                     # FIU, for the forecast Laya reads
LAYA_DIR = Path(os.environ.get("LAYA_DIR", HERE / "model" / "farmhand-laya"))
FIELDS_DIR = (HERE / "fields").resolve()      # AlphaEarth map (alphaearth/fields.html + out/*.png, fields.json)
SITE_DIR = Path(os.environ.get("SITE_DIR", Path.home() / "farmhand-site" / "current")).resolve()   # built by deploy.sh
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
         ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon",
         ".glb": "model/gltf-binary", ".webp": "image/webp", ".map": "application/json", ".txt": "text/plain"}

DB_PATH = Path(os.environ.get("FARMHAND_DB", HERE / "farmhand_home.db"))
CONFIG_PATH = Path(os.environ.get("FARMHAND_CONFIG", HERE / "farmhand_config.json"))   # the web app's plot/zones/place
PROBE_MIN_RAW = 500                          # raw below this = soil probe disconnected (NOT wet): moisture is null
LINK_TIMEOUT_S = 60                          # no reading for this long = the ESP32 is offline
# Which DS18B20 chip sits in which box. NOT confirmed yet: swap the ids here if the boxes turn out the other way round.
# Applied at read time (the chip ids are stored with every reading), so fixing it also fixes the history.
TEMP_BOX = {"A": "2872EB240000003C", "B": "28B60E2400000077"}
# The ESP32 turns raw into % itself (firmware/sensors_live/lib/comp_soil/comp_soil.cpp). Mirrored here for the web app.
FIRMWARE_CAL = {"A": {"airRaw": 3450, "waterRaw": 1875, "calibratedAt": 1790438400000},    # D35 (board rewired), water measured 2026-09-26
                "B": {"airRaw": 3400, "waterRaw": 1507, "calibratedAt": 1790179200000}}    # D34 (board rewired), measured 2026-09-23

db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.executescript("""
CREATE TABLE IF NOT EXISTS readings (ts REAL, ms INT, a_raw INT, a_pct REAL, b_raw INT, b_pct REAL,
                                     t1 REAL, t2 REAL, pump_a INT, pump_b INT, rssi INT, ip TEXT);
CREATE TABLE IF NOT EXISTS decisions (ts REAL, brain TEXT, pick TEXT, pump_a_s REAL, why TEXT);
""")
_cols = {r[1] for r in db.execute("PRAGMA table_info(readings)")}
for _c in ("t1_id", "t2_id"):                # which chip t1/t2 came from (older rows: unknown)
    if _c not in _cols:
        db.execute(f"ALTER TABLE readings ADD COLUMN {_c} TEXT")
db.execute("CREATE INDEX IF NOT EXISTS readings_ts ON readings(ts)")
db.commit()
LOCK = threading.Lock()
LAST = {"reading": None, "decision": None, "rx": None}

# ---------- Laya (optional) ----------
LAYA = None
if LAYA_DIR.exists() and any(LAYA_DIR.iterdir()):
    try:
        import sys
        import laya
        import torch
        sys.path.insert(0, str(HERE))
        from farmhand_questions import QUESTIONS
        dev = "mps" if torch.backends.mps.is_available() else "cpu"
        LAYA = (laya.load(str(LAYA_DIR), device=dev), QUESTIONS)
        print(f"[laya] loaded on {dev}")
    except Exception as e:
        print("[laya] not used:", repr(e)[:200])

_fc = {"t": 0, "v": {}}


def forecast():
    """Next 24 h rain + evaporation at FIU (Open-Meteo, cached 15 min). Laya's weather inputs."""
    if time.time() - _fc["t"] < 900:
        return _fc["v"]
    try:
        url = (f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&forecast_hours=24"
               "&hourly=precipitation_probability,precipitation,et0_fao_evapotranspiration,temperature_2m&timezone=America%2FNew_York")
        h = json.load(urllib.request.urlopen(url, timeout=10))["hourly"]
        v = {"rain_mm": round(sum(x or 0 for x in h["precipitation"]), 1),
             "rain_chance": max(x or 0 for x in h["precipitation_probability"]),
             "et0_mm": round(sum(x or 0 for x in h["et0_fao_evapotranspiration"]), 2),
             "air_c": h["temperature_2m"][0]}
        _fc.update(t=time.time(), v=v)
    except Exception as e:
        print("[forecast]", e)
    return _fc["v"]


def decide(r):
    """What box A should do now. Returns (brain, pick, pump_a_s, why)."""
    a = r.get("a_pct")
    if a is None or r.get("a_raw", 0) < 500:
        return "rules", "wait", 0, "soil probe A not connected"
    if a > BASELINE:
        rule = ("rules", "wait_moist", 0, f"soil {a:.1f}% is above the baseline {BASELINE:.0f}%")
    else:
        rule = ("rules", "water", min(PUMP_S_MAX, max(2, (TARGET - a) * 0.25)), f"soil {a:.1f}% is at or under the baseline {BASELINE:.0f}%")
    if not LAYA:
        return rule
    fc, lt = forecast(), time.localtime()
    temps = [t for t in (r.get("t1"), r.get("t2")) if t is not None]
    state = {   # same scale as laptop/brain.py _laya_state: the box band baseline..target maps onto 42.5..65
        "soil_moisture_pct": round(42.5 + (a - BASELINE) * (65 - 42.5) / max(1, TARGET - BASELINE), 1),
        "stress_line_pct": 42.5,
        "air_temp_c": fc.get("air_c", temps[0] if temps else 25),
        "hour": lt.tm_hour, "month": time.strftime("%B", lt),
        "rain_forecast_next_24h_mm": 0.0, "rain_chance_next_24h_pct": 0,        # indoor box: rain can't reach it
        "crop_water_use_last_24h_mm": round((fc.get("et0_mm") or 0) * 1.05, 2),
        "hours_since_real_rain": 48, "county_drought": "unknown"}
    try:
        agent, qs = LAYA
        pick = agent.predict(state, qs)["answers"]["action"]["choice"]
    except Exception as e:
        return rule[0], rule[1], rule[2], rule[3] + f" (decision model failed: {type(e).__name__})"
    secs = rule[2] if pick == "water" else 0
    if pick == "water" and a > BASELINE + 5:                     # the baseline is a floor, never let the model flood it
        secs, pick = 0, "wait_moist"
    return "laya", pick, secs, f"Decision model: {pick} (soil {a:.1f}%, baseline {BASELINE:.0f}%)"


def save(r, d, ip):
    temps = r.get("temps") or []
    t = [x.get("c") if isinstance(x, dict) else x for x in temps] + [None, None]
    tid = [x.get("id") if isinstance(x, dict) else None for x in temps] + [None, None]
    p = (r.get("pumps") or []) + [None, None]
    with LOCK:
        db.execute("INSERT INTO readings (ts,ms,a_raw,a_pct,b_raw,b_pct,t1,t2,pump_a,pump_b,rssi,ip,t1_id,t2_id) "
                   "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (time.time(), r.get("ms"), r.get("a_raw"), r.get("a_pct"), r.get("b_raw"), r.get("b_pct"),
                    t[0], t[1], p[0], p[1], r.get("rssi"), ip, tid[0], tid[1]))
        db.execute("INSERT INTO decisions VALUES (?,?,?,?,?)", (time.time(), *d))
        db.commit()


# ---------- the web app's API under /farmhand/api/ (the Prompt Grass BoardSource contract, answered from real data) ----------
NOT_HERE = "not on Farm Hand"
PUMPS_DISARMED = "pumps are disarmed until the box mapping is confirmed"
FIU = {"name": "FIU", "region": "Florida", "country": "United States", "lat": LAT, "lon": LON}
DEFAULT_CONFIG = {
    "plot": {"name": "Farm Hand bench", "width": 120, "length": 60},
    "zones": [{"id": "A", "name": "Farm Hand box", "probe": "A", "x": 30, "y": 30, "sun": "partial", "ph": None},
              {"id": "B", "name": "Timer box (control)", "probe": "B", "x": 90, "y": 30, "sun": "partial", "ph": None}],
    "place": FIU, "onboarded": True}
CFG_LOCK = threading.Lock()


def _load_config():
    try:
        c = json.loads(CONFIG_PATH.read_text())
    except (OSError, ValueError):
        c = {}
    base = json.loads(json.dumps(DEFAULT_CONFIG))
    base.update({k: v for k, v in c.items() if k in DEFAULT_CONFIG})
    return base


CONFIG = _load_config()


def _save_config():                          # caller holds CFG_LOCK
    tmp = CONFIG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(CONFIG, indent=1))
    tmp.replace(CONFIG_PATH)


def board_config():
    with CFG_LOCK:
        c = json.loads(json.dumps(CONFIG))
    c["calibration"] = {p: {**FIRMWARE_CAL[p], "source": "default"} for p in ("A", "B")}
    return c


def _zone(zid):
    with CFG_LOCK:
        return next((dict(z) for z in CONFIG["zones"] if z.get("id") == zid), None)


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _temp_ok(c):                             # DS18B20: -127 = not answering, 85 = power-on value
    return _num(c) and -55 < c < 85


TEMP_PIN = {"A": 21, "B": 4}                # soldered board: the data pin decides the box, whichever probe is on it


def box_temp(r, box):
    temps = [x for x in r.get("temps") or [] if isinstance(x, dict)]
    by_pin = any("pin" in x for x in temps)
    for x in temps:
        if (x.get("pin") == TEMP_PIN[box]) if by_pin else (x.get("id") == TEMP_BOX.get(box)):
            return x.get("c") if _temp_ok(x.get("c")) else None
    return None


def probe_live(r, rx, box):
    """One box's live values (ZoneLive + raw/probeOk)."""
    k = box.lower()
    raw, pct = r.get(f"{k}_raw"), r.get(f"{k}_pct")
    ok = _num(raw) and raw >= PROBE_MIN_RAW
    tc = box_temp(r, box)
    return {"t": int(rx * 1000), "moistureRaw": raw if _num(raw) else None,
            "moisturePct": round(pct, 1) if ok and _num(pct) else None,
            "tempC": round(tc, 2) if tc is not None else None,
            "moistureOnline": ok, "tempOnline": tc is not None, "raw": raw if _num(raw) else None, "probeOk": ok}


def pumps_of(r):
    p = (r.get("pumps") or []) + [0, 0]
    return {"A": bool(p[0]), "B": bool(p[1])}


def sample_event(r, rx):
    with CFG_LOCK:
        zones = [dict(z) for z in CONFIG["zones"]]
    return {"type": "sample", "t": int(rx * 1000), "zones": {z["id"]: probe_live(r, rx, z.get("probe", "A")) for z in zones},
            "pumps": pumps_of(r)}


def decision_event(d, t):
    return {"type": "decision", "brain": d[0], "pick": d[1], "seconds": round(d[2], 1), "why": d[3], "t": int(t * 1000)}


def _age():
    return None if LAST["rx"] is None else time.time() - LAST["rx"]


def _online():
    a = _age()
    return a is not None and a < LINK_TIMEOUT_S


def _load_last():
    """Pick up the latest reading + decision from SQLite so a restart doesn't blank the page."""
    row = db.execute("SELECT ts,ms,a_raw,a_pct,b_raw,b_pct,t1,t2,pump_a,pump_b,rssi,t1_id,t2_id FROM readings "
                     "ORDER BY ts DESC LIMIT 1").fetchone()
    if row:
        ts, ms, ar, ap, br, bp, t1, t2, pa, pb, rssi, i1, i2 = row
        temps = [{"id": i, "c": c} for i, c in ((i1, t1), (i2, t2)) if c is not None]
        LAST.update(reading={"ms": ms, "a_raw": ar, "a_pct": ap, "b_raw": br, "b_pct": bp, "t1": t1, "t2": t2,
                             "temps": temps, "pumps": [pa or 0, pb or 0], "rssi": rssi}, rx=ts)
    d = db.execute("SELECT ts,brain,pick,pump_a_s,why FROM decisions ORDER BY ts DESC LIMIT 1").fetchone()
    if d:
        LAST["decision"] = (d[1], d[2], d[3] or 0, d[4])
        LAST["decision_t"] = d[0]


_load_last()


class Hub:
    """Thread-safe fan-out to every open /api/events stream (one queue per client)."""

    def __init__(self):
        self.lock = threading.Lock()
        self.clients = set()
        self.online = _online()

    def add(self):
        q = queue.Queue(maxsize=200)
        with self.lock:
            self.clients.add(q)
        return q

    def remove(self, q):
        with self.lock:
            self.clients.discard(q)

    def send(self, ev):
        msg = (ev["type"], json.dumps(ev))
        with self.lock:
            for q in self.clients:
                try:
                    q.put_nowait(msg)
                except queue.Full:                # a stuck client just misses events
                    pass

    def set_online(self, online):
        with self.lock:
            changed, self.online = self.online != online, online
        if changed:
            self.send({"type": "link", "online": online})


HUB = Hub()


def _link_watch():
    while True:
        time.sleep(5)
        HUB.set_online(_online())


def water_advice(box, lv):
    age = _age()
    if age is None:
        return {"needsWater": None, "action": "unknown", "headline": "No reading yet", "reasons": ["The ESP32 has not reported since the server started."]}
    if age > LINK_TIMEOUT_S:
        return {"needsWater": None, "action": "unknown", "headline": f"No reading for {int(age)} s",
                "reasons": ["The ESP32 is offline, so there is no fresh reading to judge from."]}
    if not lv["probeOk"]:
        return {"needsWater": None, "action": "unknown", "headline": "Probe offline",
                "reasons": [f"Raw {lv['raw']} is under {PROBE_MIN_RAW}: the probe is disconnected, not wet."]}
    if box != "A":
        return {"needsWater": None, "action": "none", "headline": "Control box: Farm Hand does not water it",
                "reasons": [f"Soil {lv['moisturePct']:.1f}%.", "Box B is the comparison, on a timer; the decision is for box A only."]}
    d = LAST["decision"]
    if not d:
        return {"needsWater": None, "action": "unknown", "headline": "No decision yet", "reasons": []}
    brain, pick, secs, why = d
    who = "the decision model" if brain == "laya" else "the baseline rule"
    tail = ["Pumps are disarmed in the firmware right now, so nothing is watered automatically."]
    if pick == "water":
        return {"needsWater": True, "action": "water", "headline": f"Water now: a {secs:.0f} s drink", "reasons": [why, f"Decided by {who}."] + tail}
    if pick == "wait_rain":
        return {"needsWater": False, "action": "wait_for_rain", "headline": "Waiting for rain", "reasons": [why, f"Decided by {who}."]}
    if pick == "wait_moist":
        return {"needsWater": False, "action": "none", "headline": "No water needed", "reasons": [why, f"Decided by {who}."]}
    return {"needsWater": None, "action": "unknown", "headline": "Waiting", "reasons": [why]}


def zone_reading(z):
    r, rx = LAST["reading"] or {}, LAST["rx"] or 0
    lv = probe_live(r, rx, z.get("probe", "A")) if LAST["reading"] else \
        {"t": 0, "moistureRaw": None, "moisturePct": None, "tempC": None, "moistureOnline": False, "tempOnline": False, "raw": None, "probeOk": False}
    return {"zone": z, "live": lv, "calibrated": True, "water": water_advice(z.get("probe", "A"), lv), "soil": None}


def diagnosis(z):
    rd = zone_reading(z)
    lv, w = rd["live"], rd["water"]
    f = [{"key": "water", "status": "unknown" if w["needsWater"] is None else ("warn" if w["needsWater"] else "good"),
          "headline": w["headline"], "reason": " ".join(x if x.endswith(".") else x + "." for x in w["reasons"])}]
    t = lv["tempC"]
    f.append({"key": "temperature", "status": "unknown" if t is None else ("good" if 10 <= t <= 35 else "warn"),
              "headline": "No soil temperature" if t is None else f"Soil {t:.1f} °C",
              "reason": "The DS18B20 for this box is not reporting." if t is None else f"Chip {TEMP_BOX.get(z.get('probe'))} (box mapping not confirmed yet)."})
    for k in ("drainage", "texture"):
        f.append({"key": k, "status": "unknown", "headline": "Not measured", "reason": "Farm Hand has no pour test, so drainage and texture are unknown."})
    return {"zoneId": z["id"], "at": int(time.time() * 1000), "findings": f}


def history(z, hours):
    hours = min(24 * 30, max(0.1, hours))
    since, bucket = time.time() - hours * 3600, max(10.0, hours * 3600 / 400)
    box = z.get("probe", "A")
    col, tid = ("a" if box == "A" else "b"), TEMP_BOX.get(box)
    sql = (f"SELECT CAST(ts / ? AS INT) k, AVG(ts), AVG(CASE WHEN {col}_raw >= ? THEN {col}_pct END), "
           "AVG(CASE WHEN t1_id = ? AND t1 > -55 AND t1 < 85 THEN t1 WHEN t2_id = ? AND t2 > -55 AND t2 < 85 THEN t2 END) "
           "FROM readings WHERE ts >= ? GROUP BY k ORDER BY k")
    with LOCK:
        rows = db.execute(sql, (bucket, PROBE_MIN_RAW, tid, tid, since)).fetchall()
    pts = [{"t": int(ts * 1000), "moisturePct": None if m is None else round(m, 1), "tempC": None if t is None else round(t, 2)}
           for _, ts, m, t in rows]
    return {"zoneId": z["id"], "points": pts, "simulated": False}


_fcd = {"t": 0, "v": None, "ok": None}


def _summarize(days):
    """Same wording as the web app's services/openMeteo.ts summarizeForecast."""
    d48 = days[:2]
    rain48 = sum(d["precipMm"] for d in d48)
    probs = [d["precipProb"] for d in d48 if d["precipProb"] is not None]
    mp = max(probs) if probs else None
    expected = rain48 >= 5 and (mp is None or mp >= 60)
    dry = 0
    for d in days:
        if d["precipMm"] >= 1:
            break
        dry += 1
    fw = next((i for i, d in enumerate(days) if d["precipMm"] >= 1), -1)
    when = ["today", "tomorrow"][fw] if fw in (0, 1) else (time.strftime("%A", time.strptime(days[fw]["date"], "%Y-%m-%d")) if fw > 1 else "")
    if expected:
        text = f"Rain likely {when}: about {round(rain48)} mm in the next 48 hours" + (f" ({mp}% chance)." if mp is not None else ".")
    elif dry >= len(days):
        text = f"No rain in the {len(days)}-day forecast."
    elif dry == 0:
        text = (f"Rain possible {when}: about {round(rain48)} mm in the next 48 hours, but only a {mp if mp is not None else '?'}% chance. "
                "Not certain enough to skip watering.") if rain48 >= 5 else \
               f"Light rain possible {when}, under {max(1, -(-rain48 // 1)):.0f} mm: not enough to count on."
    else:
        text = f"No rain expected for {dry} day{'' if dry == 1 else 's'}."
    return {"source": "open-meteo", "sample": False, "fetchedAt": int(time.time() * 1000), "days": days,
            "rainNext48hMm": round(rain48, 1), "maxPrecipProb48h": mp, "rainExpected": expected, "dryDaysAhead": dry, "text": text}


def forecast_daily():
    """7-day outlook at FIU for the web app (Open-Meteo, cached 15 min). Never canned numbers."""
    if _fcd["v"] and time.time() - _fcd["t"] < 900:
        return _fcd["v"]
    try:
        url = (f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&forecast_days=7"
               "&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=America%2FNew_York")
        d = json.load(urllib.request.urlopen(url, timeout=10))["daily"]
        days = [{"date": t, "precipMm": (d["precipitation_sum"][i] or 0), "precipProb": d["precipitation_probability_max"][i],
                 "tmaxC": d["temperature_2m_max"][i], "tminC": d["temperature_2m_min"][i]} for i, t in enumerate(d["time"])]
        _fcd.update(t=time.time(), v=_summarize(days), ok=True)
    except Exception as e:
        print("[forecast daily]", e)
        _fcd["ok"] = False
        if _fcd["v"]:
            return _fcd["v"]
        return {"source": "open-meteo", "sample": False, "fetchedAt": int(time.time() * 1000), "days": [], "rainNext48hMm": 0,
                "maxPrecipProb48h": None, "rainExpected": False, "dryDaysAhead": 0, "unavailable": True,
                "text": "Forecast unavailable: Open-Meteo did not answer."}
    return _fcd["v"]


def connectivity():
    r, age, online = LAST["reading"] or {}, _age(), _online()
    links = [{"id": "esp32", "layer": "gateway_internet", "label": "ESP32 to Farm Hand server",
              "state": "connected" if online else "down",
              "detail": "no reading yet" if age is None else f"last reading {age:.0f} s ago" + (f", Wi-Fi {r.get('rssi')} dBm" if r.get("rssi") is not None else ""),
              "note": "The ESP32 posts every ~10 s over Wi-Fi and gets the decision back in the reply.", "active": online}]
    for box, pin in (("A", "D34"), ("B", "D35")):
        lv = probe_live(r, LAST["rx"] or 0, box)
        links.append({"id": f"soil_{box}", "layer": "probe_gateway", "label": f"Soil probe {box} ({pin})",
                      "state": "wired" if online and lv["probeOk"] else "down",
                      "detail": "no reading" if lv["raw"] is None else f"raw {lv['raw']}" + ("" if lv["probeOk"] else f" (under {PROBE_MIN_RAW}: disconnected)"),
                      "note": "Capacitive probe on the ESP32's ADC.", "active": online and lv["probeOk"]})
        links.append({"id": f"temp_{box}", "layer": "probe_gateway", "label": f"Soil temperature {box}",
                      "state": "wired" if online and lv["tempOnline"] else "down",
                      "detail": f"DS18B20 {TEMP_BOX.get(box)}" + ("" if lv["tempOnline"] else ", not reporting"),
                      "note": "Chip-to-box mapping not confirmed yet.", "active": online and lv["tempOnline"]})
    pa = pumps_of(r)
    for box in ("A", "B"):
        links.append({"id": f"pump_{box}", "layer": "probe_gateway", "label": f"Pump {box}", "state": "not_fitted",
                      "detail": ("running" if pa[box] else "off") + ", disarmed in firmware", "note": PUMPS_DISARMED, "active": pa[box]})
    return {"links": links, "internetReachable": _fcd["ok"]}


REGION_NONE = {"status": "unavailable", "reason": "The USDA cropland and soil map is not on Farm Hand.", "region": None,
               "matches": [], "unserved": [], "you": {"measured": False, "drainageClass": None, "label": None, "ph": None}}
# AlphaEarth v2 (farm-hand/alphaearth/build_region.py): the farm fields around FIU, a ready-made RegionView
REGION_PATH = Path(os.environ.get("FARMHAND_REGION", HERE / "region_v2.json"))
_REGION = {"mtime": None, "view": None, "byId": {}}
_REGION_LOCK = threading.Lock()


def region_view():
    """region_v2.json, re-read only when the file changes. REGION_NONE if it's missing or broken."""
    try:
        m = REGION_PATH.stat().st_mtime
    except OSError:
        return REGION_NONE
    with _REGION_LOCK:
        if _REGION["mtime"] != m:
            try:
                v = json.loads(REGION_PATH.read_text())
                _REGION.update(mtime=m, view=v, byId={f["id"]: f for f in (v.get("region") or {}).get("fields", [])})
            except (OSError, ValueError) as e:
                print(f"region_v2.json unreadable: {e}", flush=True)
                return REGION_NONE
        return _REGION["view"]


def region_fields_index():
    """Light list for /api/fields: no polygons, no soil detail."""
    region_view()
    keep = ("id", "crop", "group", "confidence", "acres", "lat", "lon", "distanceKm", "bearing", "baselinePct", "p")
    return [{k: f.get(k) for k in keep} for f in _REGION["byId"].values()]


def _valid_zone(z):
    return (isinstance(z, dict) and isinstance(z.get("id"), str) and isinstance(z.get("name"), str) and z.get("probe") in ("A", "B")
            and _num(z.get("x")) and _num(z.get("y")) and z.get("sun") in ("full", "partial", "shade") and (z.get("ph") is None or _num(z.get("ph"))))


def _valid_place(p):
    return p is None or (isinstance(p, dict) and isinstance(p.get("name"), str) and _num(p.get("lat")) and _num(p.get("lon")))


def api(method, parts, qs, body):
    """Route one /api/... call. Returns (status, json-able)."""
    nope = (501, {"ok": False, "error": NOT_HERE})
    head = parts[0] if parts else ""
    if method == "GET":
        if parts == ["config"]:
            return 200, {"config": board_config()}
        if head == "zones" and len(parts) >= 2:
            z = _zone(parts[1])
            if not z:
                return 404, {"error": f"no zone {parts[1]}"}
            if len(parts) == 2:
                return 200, {"reading": zone_reading(z)}
            if parts[2:] == ["history"]:
                return 200, {"history": history(z, float((qs.get("hours") or ["36"])[0]))}
            if parts[2:] == ["crops"]:
                return 200, {"crops": [], "available": False, "reason": "Crop scoring is " + NOT_HERE}
            if parts[2] == "planting-window":
                return 200, {"window": None, "available": False, "reason": "Planting windows are " + NOT_HERE}
            if parts[2:] == ["findings"]:
                return 200, {"diagnosis": diagnosis(z)}
        if parts == ["history"]:
            z = _zone((qs.get("zone") or ["A"])[0])
            if not z:
                return 404, {"error": "no such zone"}
            return 200, {"history": history(z, float((qs.get("hours") or ["36"])[0]))}
        if parts == ["forecast"]:
            return 200, {"forecast": forecast_daily()}
        if parts == ["frost-dates"]:
            return 200, {"frost": None, "available": False, "reason": "Frost dates are " + NOT_HERE}
        if parts == ["soil-profile"]:
            return 200, {"profile": None}
        if parts == ["notes"]:
            return 200, {"notes": []}
        if parts == ["connectivity"]:
            return 200, {"connectivity": connectivity()}
        if parts == ["soil-now"]:
            return 200, soil_now()
        if parts == ["region"]:
            return 200, region_view()
        if parts == ["fields"]:
            v = region_view()
            if v is REGION_NONE:
                return 404, {"error": "no AlphaEarth fields on this server"}
            return 200, {"fields": region_fields_index(), "alphaearth": {k: x for k, x in v["region"].get("alphaearth", {}).items()}}
        if head == "fields" and len(parts) == 2:
            region_view()
            f = _REGION["byId"].get(parts[1])
            return (200, {"field": f}) if f else (404, {"error": f"no field {parts[1]}"})
        if parts == ["region", "demo-place"]:
            return 200, {"place": FIU}
        if parts == ["overrides"]:
            return 200, {"overrides": {"forecast": None, "zoneMoisture": {}}}
        if parts == ["decision"]:
            d = LAST["decision"]
            return 200, {"decision": decision_event(d, LAST.get("decision_t") or LAST["rx"] or 0) if d else None}
        if parts == ["pour", "status"]:
            return 200, {"actuator": {"connected": False}, "reason": PUMPS_DISARMED}
        if parts == ["voice", "status"]:
            return 200, {"enabled": False, "reason": "The voice assistant is " + NOT_HERE + " yet."}
        return 404, {"error": "not found"}
    if method == "PUT" and parts == ["config", "plot"]:
        plot, zones = body.get("plot"), body.get("zones")
        if not (isinstance(plot, dict) and isinstance(plot.get("name"), str) and _num(plot.get("width")) and _num(plot.get("length"))
                and isinstance(zones, list) and zones and all(_valid_zone(z) for z in zones)):
            return 400, {"ok": False, "error": "bad plot or zones"}
        with CFG_LOCK:
            CONFIG["plot"] = {k: plot[k] for k in ("name", "width", "length")}
            CONFIG["zones"] = [{k: z.get(k) for k in ("id", "name", "probe", "x", "y", "sun", "ph")} for z in zones]
            _save_config()
    elif method == "PUT" and parts == ["config", "place"]:
        if not _valid_place(body.get("place")):
            return 400, {"ok": False, "error": "bad place"}
        with CFG_LOCK:
            CONFIG["place"] = body.get("place")
            _save_config()
    elif method == "POST" and parts == ["config", "onboarded"]:
        with CFG_LOCK:
            CONFIG["onboarded"] = bool(body.get("done"))
            _save_config()
    elif method == "PATCH" and head == "zones" and len(parts) == 2:
        patch = {k: v for k, v in body.items() if k in ("sun", "ph", "name")}
        if ("sun" in patch and patch["sun"] not in ("full", "partial", "shade")) or ("ph" in patch and not (patch["ph"] is None or _num(patch["ph"]))) \
                or ("name" in patch and not isinstance(patch["name"], str)):
            return 400, {"ok": False, "error": "bad zone patch"}
        with CFG_LOCK:
            z = next((z for z in CONFIG["zones"] if z["id"] == parts[1]), None)
            if not z:
                return 404, {"ok": False, "error": f"no zone {parts[1]}"}
            z.update(patch)
            _save_config()
    elif method == "POST" and head == "calibrate":
        return 501, {"ok": False, "error": "Calibration lives in the ESP32 firmware (comp_soil.cpp) and can't be changed from the app: " + NOT_HERE + "."}
    elif method == "POST" and parts in (["pump"], ["pour"]):
        return 403, {"ok": False, "result": "refused", "reason": PUMPS_DISARMED, "guard": "hard"}
    else:
        return nope if method in ("POST", "PUT", "PATCH") else (405, {"error": "method not allowed"})
    HUB.send({"type": "config", "config": board_config()})     # every config write goes out on the stream
    return 200, {"ok": True, "config": board_config()}


# ---------- soil today across the map (Open-Meteo model, not measured) ----------
_SOIL = {"t": 0, "v": None}
SOIL_GRID = 12            # 12 x 12 points over the region box (about 6 km apart)


def soil_now():
    """Modeled soil moisture + soil temperature on a grid over the region map, now and the last 7 days (daily means).
    Open-Meteo (free, no key): hourly soil_moisture_* (m3/m3) and soil_temperature_* (C). Cached 30 min."""
    if _SOIL["v"] and time.time() - _SOIL["t"] < 1800:
        return _SOIL["v"]
    try:
        reg = json.loads(REGION_PATH.read_text())["region"] if REGION_PATH.exists() else None
        clat, clon = (reg["centre"]["lat"], reg["centre"]["lon"]) if reg else (25.7566, -80.3740)
        half = float(reg["halfKm"]) if reg else 37.0
    except Exception:
        clat, clon, half = 25.7566, -80.3740, 37.0
    import math
    dlat = half / 110.574
    dlon = half / (111.320 * math.cos(math.radians(clat)))
    lats, lons = [], []
    for i in range(SOIL_GRID):
        for j in range(SOIL_GRID):
            lats.append(round(clat + dlat - (2 * dlat) * (i + 0.5) / SOIL_GRID, 4))
            lons.append(round(clon - dlon + (2 * dlon) * (j + 0.5) / SOIL_GRID, 4))
    url = ("https://api.open-meteo.com/v1/forecast?latitude=" + ",".join(map(str, lats)) + "&longitude=" + ",".join(map(str, lons)) +
           "&hourly=soil_moisture_0_to_1cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_temperature_0cm,soil_temperature_6cm"
           "&past_days=7&forecast_days=1&timezone=America%2FNew_York")
    try:
        data = json.load(urllib.request.urlopen(url, timeout=30))
    except Exception as e:
        return _SOIL["v"] or {"status": "unavailable", "reason": f"Open-Meteo: {type(e).__name__}"}
    data = data if isinstance(data, list) else [data]
    now_key = time.strftime("%Y-%m-%dT%H:00")
    pts = []
    for (la, lo), d in zip(zip(lats, lons), data):
        h = d["hourly"]; ts = h["time"]
        i = ts.index(now_key) if now_key in ts else max(0, min(len(ts) - 1, 7 * 24 + time.localtime().tm_hour))
        def at(k): return h[k][i]
        daily = []
        for day in range(8):
            chunk = [v for v in h["soil_moisture_3_to_9cm"][day * 24:(day + 1) * 24] if v is not None]
            daily.append(round(sum(chunk) / len(chunk) * 100, 1) if chunk else None)
        pts.append({"lat": la, "lon": lo,
                    "moisturePct": None if at("soil_moisture_3_to_9cm") is None else round(at("soil_moisture_3_to_9cm") * 100, 1),
                    "moistureSurfacePct": None if at("soil_moisture_0_to_1cm") is None else round(at("soil_moisture_0_to_1cm") * 100, 1),
                    "moistureDeepPct": None if at("soil_moisture_9_to_27cm") is None else round(at("soil_moisture_9_to_27cm") * 100, 1),
                    "tempSurfaceC": at("soil_temperature_0cm"), "temp6cmC": at("soil_temperature_6cm"),
                    "week": daily[:7]})
    v = {"status": "ready", "time": now_key, "grid": SOIL_GRID,
         "units": {"moisture": "% water by volume (m3/m3 x 100)", "temp": "C"},
         "depths": {"moisturePct": "3-9 cm", "moistureSurfacePct": "0-1 cm", "moistureDeepPct": "9-27 cm", "temp6cmC": "6 cm"},
         "source": "Open-Meteo soil model (hourly, about 10 km grid). Modeled, not measured.",
         "points": pts}
    _SOIL.update(t=time.time(), v=v)
    return v


# ---------- remote pump control (tools/pump_control.py): a command queued here rides back in the ESP32's next reply ----------
import re as _re
PUMP_CMD_RE = _re.compile(r"^(pump [AB] \d{1,4}(\.\d+)?|stop)$")
PUMP_CMD = {"cmd": None, "t": 0, "sent_t": 0}
PUMP_CMD_LOCK = threading.Lock()


def pump_state():
    r = LAST["reading"] or {}
    return {"pumps": r.get("pumps"), "test": r.get("test"), "rx": LAST["rx"], "age_s": _age(),
            "queued": PUMP_CMD["cmd"], "queued_t": PUMP_CMD["t"], "sent_t": PUMP_CMD["sent_t"]}


# ---------- "Listen": the farm's status read aloud by an ElevenLabs voice (POST /api/speak) ----------
ELEVEN_VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")    # "George", a stock ElevenLabs voice
ELEVEN_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5")          # the fast, cheap one
SPEAK_MAX_CHARS = 480                        # a short briefing; credits are limited, so whole sentences are dropped past this
SPEAK_CACHE_S = 20                           # repeated taps inside this window replay the same clip (no new credits)
WATER_LESS_PCT = 56                          # season replay on real Miami weather vs the timer (web brand.ts savings.waterLessPct)
_SPEAK = {"t": 0, "text": "", "mp3": b""}
_SPEAK_LOCK = threading.Lock()


def _say_num(x):
    return str(int(round(x)))


def _fiu_soil():
    """Open-Meteo soil at the grid point nearest FIU, only if already cached (never a slow fetch mid-tap)."""
    v = _SOIL["v"]
    if not v or v.get("status") != "ready":
        threading.Thread(target=soil_now, daemon=True).start()     # warm it for the next tap
        return None
    return min(v["points"], key=lambda q: (q["lat"] - LAT) ** 2 + (q["lon"] - LON) ** 2)


def speak_text():
    """A short spoken briefing about the farm right now, written to be heard (no symbols, whole numbers)."""
    out = [f"Farm Hand briefing, {time.strftime('%-I:%M %p')}."]
    r, age = LAST["reading"], _age()
    a = b = None
    if not r:
        out.append("The sensor board has not reported yet.")
    else:
        if age is not None and age > LINK_TIMEOUT_S:
            mins = int(age // 60)
            out.append(f"The sensors last reported {mins} minute{'s' if mins != 1 else ''} ago." if mins
                       else f"The sensors last reported {int(age)} seconds ago.")
        a, b = probe_live(r, LAST["rx"] or 0, "A"), probe_live(r, LAST["rx"] or 0, "B")
        ta, tb = a["tempC"], b["tempC"]
        if a["moisturePct"] is not None:
            line = f"Box A, run by the decision model, is at {_say_num(a['moisturePct'])} percent moisture"
            line += f" and {_say_num(ta)} degrees" if ta is not None else ""
            line += f", above its {_say_num(BASELINE)} percent line." if a["moisturePct"] >= BASELINE else f", below its {_say_num(BASELINE)} percent line."
            out.append(line)
        else:
            out.append("Box A's moisture probe is not reading" + (f", soil is {_say_num(ta)} degrees." if ta is not None else "."))
        d = LAST["decision"]
        if d and a["moisturePct"] is not None:
            brain, pick, secs, _why = d
            if pick == "water":
                out.append(f"The decision model is giving it a {_say_num(secs)} second drink.")
            elif pick == "wait_moist":
                out.append("The decision model is holding off: the soil is still moist.")
            elif pick == "wait_rain":
                out.append("The decision model is holding off: rain is on the way.")
        if b["moisturePct"] is not None:
            out.append(f"Box B, on the timer, is at {_say_num(b['moisturePct'])} percent"
                       + (f" and {_say_num(tb)} degrees." if tb is not None else "."))
        else:
            out.append("Box B's probe is not reading.")
    fc = forecast() or {}                 # cached 15 min; about a second when cold
    if fc:
        if fc.get("rain_mm", 0) >= 1:
            out.append(f"Rain is likely in the next day, about {_say_num(fc['rain_mm'])} millimeters.")
        else:
            out.append("No real rain in the next 24 hours" + (f", {_say_num(fc['air_c'])} degrees outside." if fc.get("air_c") is not None else "."))
    q = _fiu_soil()
    if q and q.get("moisturePct") is not None:
        wk = [w for w in (q.get("week") or []) if w is not None]
        trend = " and drying" if len(wk) >= 2 and wk[-1] < wk[0] - 0.5 else ""
        out.append(f"Soil around FIU holds {_say_num(q['moisturePct'])} percent water{trend}.")
    out.append(f"Over a 21 month weather replay, Farm Hand used {WATER_LESS_PCT} percent less water than a timer.")
    text = ""
    for part in out:                      # keep whole sentences inside the credit budget
        if len(text) + 1 + len(part) > SPEAK_MAX_CHARS:
            continue
        text = f"{text} {part}".strip()
    return text


def eleven_tts(text, key):
    """ElevenLabs text-to-speech -> MP3 bytes. The key only ever goes in the request header."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{urllib.parse.quote(ELEVEN_VOICE)}?output_format=mp3_44100_128"
    req = urllib.request.Request(url, method="POST", data=json.dumps({"text": text, "model_id": ELEVEN_MODEL}).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def speak():
    """Returns (status, content-type, body bytes, text). Cached for SPEAK_CACHE_S; one ElevenLabs call at a time."""
    text = speak_text()
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        return 503, "application/json", json.dumps({"error": "no ElevenLabs key", "text": text}).encode(), text
    with _SPEAK_LOCK:
        if _SPEAK["mp3"] and time.time() - _SPEAK["t"] < SPEAK_CACHE_S:
            return 200, "audio/mpeg", _SPEAK["mp3"], _SPEAK["text"]
        try:
            mp3 = eleven_tts(text, key)
        except urllib.error.HTTPError as e:
            print("[speak] ElevenLabs HTTP", e.code)                  # status only: never the key or the request
            return 502, "application/json", json.dumps({"error": f"ElevenLabs answered {e.code}", "text": text}).encode(), text
        except Exception as e:
            print("[speak] ElevenLabs failed:", type(e).__name__)
            return 502, "application/json", json.dumps({"error": "ElevenLabs unreachable", "text": text}).encode(), text
        _SPEAK.update(t=time.time(), text=text, mp3=mp3)
        return 200, "audio/mpeg", mp3, text


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _path(self):                       # the API lives under /farmhand (also works when Funnel strips the prefix)
        p = self.path.split("?")[0]
        return p[len("/farmhand"):] if p.startswith("/farmhand") else p

    def _site(self):
        """Matthew's built site at the root. Unknown paths fall back to index.html (hash routes)."""
        rel = urllib.parse.unquote(self.path.split("?")[0]).lstrip("/") or "index.html"
        f = (SITE_DIR / rel).resolve()
        if SITE_DIR not in f.parents and f != SITE_DIR or not f.is_file():
            f = SITE_DIR / "index.html"
        if not f.is_file():
            return self._send(503, "Site not built yet. See ~/farmhand-site/deploy.log on the Mac mini.", "text/plain")
        body = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
        self.send_header("Cache-Control", "no-cache" if f.name == "index.html" else "public, max-age=3600")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        if self._path().startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")      # lets `npm run dev` on another port use it
        self.end_headers()
        self.wfile.write(b)

    # ---------- /api/ (the web app) ----------
    def _api(self, method):
        u = urllib.parse.urlsplit(self.path)
        parts = [urllib.parse.unquote(x) for x in self._path()[len("/api/"):].split("/") if x]
        if method == "GET" and parts == ["events"]:
            return self._events()
        body = {}
        if method != "GET":
            try:
                n = int(self.headers.get("Content-Length", 0) or 0)
                body = json.loads(self.rfile.read(n)) if n else {}
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                return self._send(400, '{"ok":false,"error":"bad json"}')
        if method == "POST" and parts == ["speak"]:
            return self._speak()                                     # binary MP3, not JSON
        if parts == ["pump"]:
            if not TOKEN or self.headers.get("X-Farmhand-Token") != TOKEN:
                return self._send(401, '{"ok":false,"error":"bad token"}')
            if method == "POST":
                cmd = str(body.get("cmd", "")).strip()
                if not PUMP_CMD_RE.match(cmd):
                    return self._send(400, '{"ok":false,"error":"cmd must be \\"pump A|B <s>\\" or \\"stop\\""}')
                with PUMP_CMD_LOCK:
                    PUMP_CMD.update(cmd=cmd, t=time.time())
            return self._send(200, json.dumps({"ok": True, **pump_state()}))
        try:
            code, obj = api(method, parts, urllib.parse.parse_qs(u.query), body)
        except Exception as e:                                        # never kill the thread over one bad request
            print("[api]", method, self.path, repr(e)[:200])
            code, obj = 500, {"ok": False, "error": type(e).__name__}
        self._send(code, json.dumps(obj))

    def _speak(self):
        """POST /api/speak: MP3 of the status sentence (text also in X-Farmhand-Text), or 503/502 JSON with the text."""
        try:
            code, ctype, body, text = speak()
        except Exception as e:
            print("[speak]", type(e).__name__)
            return self._send(500, '{"error":"speak failed"}')
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Farmhand-Text", urllib.parse.quote(text))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "X-Farmhand-Text")
        self.end_headers()
        self.wfile.write(body)

    def _sse(self, text):
        self.wfile.write(text.encode())
        self.wfile.flush()

    def _events(self):
        """Server-Sent Events: config, then sample/decision per reading, link on ESP32 up/down, keep-alive every 15 s."""
        self.close_connection = True
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        q = HUB.add()
        try:
            first = [{"type": "config", "config": board_config()}]
            if LAST["reading"]:
                first.append(sample_event(LAST["reading"], LAST["rx"]))
            if LAST["decision"]:
                first.append(decision_event(LAST["decision"], LAST.get("decision_t") or LAST["rx"]))
            first.append({"type": "link", "online": _online()})
            self._sse("retry: 2000\n\n" + "".join(f"event: {e['type']}\ndata: {json.dumps(e)}\n\n" for e in first))
            while True:
                try:
                    typ, data = q.get(timeout=15)
                except queue.Empty:
                    self._sse(": keep-alive\n\n")
                    continue
                self._sse(f"event: {typ}\ndata: {data}\n\n")
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            HUB.remove(q)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_PUT(self):
        if not self._path().startswith("/api/"):
            return self._send(404, '{"error":"not found"}')
        self._api("PUT")

    def do_PATCH(self):
        if not self._path().startswith("/api/"):
            return self._send(404, '{"error":"not found"}')
        self._api("PATCH")

    def do_POST(self):
        if self._path().startswith("/api/"):
            return self._api("POST")
        if self._path() != "/reading":
            return self._send(404, '{"error":"not found"}')
        if not TOKEN or self.headers.get("X-Farmhand-Token") != TOKEN:
            return self._send(401, '{"error":"bad token"}')
        try:
            r = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0))
        except ValueError:
            return self._send(400, '{"error":"bad json"}')
        t = r.get("temps") or []
        r["t1"] = (t[0].get("c") if t and isinstance(t[0], dict) else (t[0] if t else None))
        r["t2"] = (t[1].get("c") if len(t) > 1 and isinstance(t[1], dict) else (t[1] if len(t) > 1 else None))
        d = decide(r)
        save(r, d, self.headers.get("X-Forwarded-For", self.client_address[0]))
        now = time.time()
        LAST.update(reading=r, decision=d, rx=now, decision_t=now)
        HUB.set_online(True)
        HUB.send(sample_event(r, now))
        HUB.send(decision_event(d, now))
        reply = {"brain": d[0], "pick": d[1], "pump_a_s": round(d[2], 1), "why": d[3],
                 "baseline": BASELINE, "server_time": int(time.time())}
        with PUMP_CMD_LOCK:
            if PUMP_CMD["cmd"] and time.time() - PUMP_CMD["t"] < 60:     # a command older than a minute is stale: drop it
                reply["cmd"] = PUMP_CMD["cmd"]
                PUMP_CMD["sent_t"] = time.time()
            PUMP_CMD["cmd"] = None
        self._send(200, json.dumps(reply, separators=(",", ":")))    # compact: the ESP32 matches "cmd":" exactly

    def do_GET(self):
        if not (self.path.startswith("/farmhand") or self.headers.get("X-Forwarded-Prefix") == "/farmhand"):
            if self.path.split("?")[0] not in ("/data", "/health", "/reading"):
                return self._site()
        p = self._path()
        if p == "/fields":
            self.send_response(301); self.send_header("Location", "/farmhand/fields/"); self.end_headers(); return
        if p.startswith("/fields/"):
            rel = urllib.parse.unquote(p[len("/fields/"):]) or "fields.html"
            f = (FIELDS_DIR / rel).resolve()
            if FIELDS_DIR not in f.parents or not f.is_file():
                return self._send(404, '{"error":"not found"}')
            body = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
            self.send_header("Cache-Control", "public, max-age=300")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if p == "/api/landcover.png":           # vegetation overlay for the map (alphaearth/build_landcover.py)
            f = HERE / "landcover_v1.png"
            if not f.is_file():
                return self._send(404, '{"error":"no land cover"}')
            body = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("Access-Control-Allow-Origin", "*")      # the map reads its pixels (canvas) to name a spot
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if p.startswith("/api/"):
            return self._api("GET")
        if p in ("", "/"):
            return self._send(200, PAGE, "text/html; charset=utf-8")
        if p == "/data":
            with LOCK:
                rows = db.execute("SELECT ts,a_pct,b_pct,t1,t2,pump_a,pump_b FROM readings ORDER BY ts DESC LIMIT 600").fetchall()
                n = db.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
            return self._send(200, json.dumps({
                "latest": LAST["reading"], "decision": LAST["decision"],
                "age_s": None if LAST["rx"] is None else round(time.time() - LAST["rx"], 1),
                "count": n, "baseline": BASELINE, "brain": "laya" if LAYA else "rules",
                "hist": [dict(zip(("ts", "a", "b", "t1", "t2", "pa", "pb"), row)) for row in reversed(rows)]}))
        if p == "/health":
            return self._send(200, '{"ok":true}')
        self._send(404, '{"error":"not found"}')


PAGE = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farm Hand live</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Atkinson+Hyperlegible+Next:wght@400;600&family=JetBrains+Mono:wght@500;600&display=swap">
<style>
:root{--ground:#eef1f4;--panel:#fbfcfd;--line:rgba(14,22,33,.09);--ink:#0e1621;--ink-2:#3d4a59;--muted:#5b6674;--soil:#1f64b8;--heat:#7646b8;--good:#0a8a0a;--bad:#c43333;--r:12px}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 "Atkinson Hyperlegible Next",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding-inline:20px;padding-block:24px 48px;display:grid;gap:16px}
h1{margin:0;font:700 2rem/1 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.02em}.sub{margin:6px 0 0;color:var(--ink-2)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:480px){.grid{grid-template-columns:1fr}.wrap{padding-inline:16px}}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:16px}.tile h2{margin:0;font-size:14px;font-weight:600;color:var(--ink-2)}
.big{font:600 clamp(2.2rem,5vw,3.2rem)/1.1 "JetBrains Mono",monospace;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.soil .big{color:var(--soil)}.heat .big{color:var(--heat)}.meta{font:500 12.5px "JetBrains Mono",monospace;color:var(--muted)}
.call{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:16px}.call b{font:700 1.4rem "Bricolage Grotesque",sans-serif}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--muted);margin-right:8px}.dot.ok{background:var(--good)}.dot.bad{background:var(--bad)}
svg{width:100%;height:120px;display:block}
</style></head><body><div class="wrap">
<header><h1>Farm Hand</h1><p class="sub"><span class="dot" id="dot"></span><span id="stat">Connecting…</span></p></header>
<div class="grid">
 <div class="tile soil"><h2>Soil A</h2><div class="big" id="a">–</div><div class="meta" id="bl"></div></div>
 <div class="tile soil"><h2>Soil B (timer box)</h2><div class="big" id="b">–</div></div>
 <div class="tile heat"><h2>Temp 1</h2><div class="big" id="t1">–</div></div>
 <div class="tile heat"><h2>Temp 2</h2><div class="big" id="t2">–</div></div>
</div>
<div class="call"><div class="meta" id="brain">decision</div><b id="pick">–</b><div id="why" style="color:var(--ink-2)"></div></div>
<div class="tile"><h2>Soil moisture, last readings</h2><svg id="ch" viewBox="0 0 600 120" preserveAspectRatio="none"></svg><div class="meta" id="cnt"></div></div>
</div><script>
const $=id=>document.getElementById(id);const f=(v,u)=>v==null?'–':(+v).toFixed(1)+u;
const P={water:'Water now',wait_moist:'Holding off: soil has water',wait_rain:'Waiting for rain',wait:'Waiting'};
async function tick(){let d;try{d=await (await fetch('data')).json()}catch(e){$('stat').textContent='Server unreachable';$('dot').className='dot bad';return}
 const L=d.latest,live=d.age_s!=null&&d.age_s<60;$('dot').className='dot '+(live?'ok':'bad');
 $('stat').textContent=L?(live?`Live from the ESP32 · last reading ${d.age_s.toFixed(0)} s ago · ${d.count.toLocaleString()} saved`:`No reading for ${Math.round(d.age_s)} s`):'Waiting for the ESP32';
 if(!L)return;$('a').textContent=L.a_raw<500?'–':f(L.a_pct,'%');$('b').textContent=L.b_raw<500?'–':f(L.b_pct,'%');
 $('t1').textContent=f(L.t1,'°C');$('t2').textContent=f(L.t2,'°C');$('bl').textContent=`keeps it at ${d.baseline}% or wetter`;
 if(d.decision){$('brain').textContent=d.decision[0]==='laya'?'Decision model decided':'Baseline rule decided';$('pick').textContent=P[d.decision[1]]||d.decision[1];$('why').textContent=d.decision[3]}
 const H=d.hist.filter(h=>h.a!=null);if(H.length>1){const x=i=>i/(H.length-1)*600,y=v=>115-v/100*110;
  $('ch').innerHTML=`<line x1="0" x2="600" y1="${y(d.baseline)}" y2="${y(d.baseline)}" stroke="#c4501f" stroke-dasharray="4 4"/><polyline fill="none" stroke="#1f64b8" stroke-width="2" vector-effect="non-scaling-stroke" points="${H.map((h,i)=>x(i)+','+y(h.a)).join(' ')}"/>`}
 $('cnt').textContent=`dashed line = baseline ${d.baseline}%`}
tick();setInterval(tick,2000);
</script></body></html>"""

if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Set FARMHAND_TOKEN (the same token as the ESP32's secrets.h).")
    print(f"Farm Hand home server on 127.0.0.1:{PORT} (brain: {'laya' if LAYA else 'baseline rule'}, baseline {BASELINE}%)")
    threading.Thread(target=_link_watch, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
