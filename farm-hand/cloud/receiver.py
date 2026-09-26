"""Farm Hand home server: the ESP32 posts its readings here, gets a decision back, and the live page is served here.

Runs on the Mac mini (always on), reachable from anywhere:
    https://farmhand.dmchang.xyz/                    Matthew's site (ui-mui), auto-deployed from GitHub (see cloud/deploy.sh)
    https://farmhand.dmchang.xyz/farmhand/            simple live page
    https://farmhand.dmchang.xyz/farmhand/data        live data (JSON) for the site
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
import sqlite3
import threading
import time
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
SITE_DIR = Path(os.environ.get("SITE_DIR", Path.home() / "farmhand-site" / "current")).resolve()   # built by deploy.sh
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
         ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon",
         ".glb": "model/gltf-binary", ".webp": "image/webp", ".map": "application/json", ".txt": "text/plain"}

db = sqlite3.connect(HERE / "farmhand_home.db", check_same_thread=False)
db.executescript("""
CREATE TABLE IF NOT EXISTS readings (ts REAL, ms INT, a_raw INT, a_pct REAL, b_raw INT, b_pct REAL,
                                     t1 REAL, t2 REAL, pump_a INT, pump_b INT, rssi INT, ip TEXT);
CREATE TABLE IF NOT EXISTS decisions (ts REAL, brain TEXT, pick TEXT, pump_a_s REAL, why TEXT);
""")
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
        return rule[0], rule[1], rule[2], rule[3] + f" (Laya failed: {type(e).__name__})"
    secs = rule[2] if pick == "water" else 0
    if pick == "water" and a > BASELINE + 5:                     # the baseline is a floor, never let the model flood it
        secs, pick = 0, "wait_moist"
    return "laya", pick, secs, f"Laya: {pick} (soil {a:.1f}%, baseline {BASELINE:.0f}%)"


def save(r, d, ip):
    t = [x.get("c") if isinstance(x, dict) else x for x in (r.get("temps") or [])] + [None, None]
    p = (r.get("pumps") or []) + [None, None]
    with LOCK:
        db.execute("INSERT INTO readings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                   (time.time(), r.get("ms"), r.get("a_raw"), r.get("a_pct"), r.get("b_raw"), r.get("b_pct"),
                    t[0], t[1], p[0], p[1], r.get("rssi"), ip))
        db.execute("INSERT INTO decisions VALUES (?,?,?,?,?)", (time.time(), *d))
        db.commit()


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
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
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
        LAST.update(reading=r, decision=d, rx=time.time())
        self._send(200, json.dumps({"brain": d[0], "pick": d[1], "pump_a_s": round(d[2], 1), "why": d[3],
                                    "baseline": BASELINE, "server_time": int(time.time())}))

    def do_GET(self):
        if not (self.path.startswith("/farmhand") or self.headers.get("X-Forwarded-Prefix") == "/farmhand"):
            if self.path.split("?")[0] not in ("/data", "/health", "/reading"):
                return self._site()
        p = self._path()
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
 if(d.decision){$('brain').textContent=d.decision[0]==='laya'?'Laya decided':'Baseline rule decided';$('pick').textContent=P[d.decision[1]]||d.decision[1];$('why').textContent=d.decision[3]}
 const H=d.hist.filter(h=>h.a!=null);if(H.length>1){const x=i=>i/(H.length-1)*600,y=v=>115-v/100*110;
  $('ch').innerHTML=`<line x1="0" x2="600" y1="${y(d.baseline)}" y2="${y(d.baseline)}" stroke="#c4501f" stroke-dasharray="4 4"/><polyline fill="none" stroke="#1f64b8" stroke-width="2" vector-effect="non-scaling-stroke" points="${H.map((h,i)=>x(i)+','+y(h.a)).join(' ')}"/>`}
 $('cnt').textContent=`dashed line = baseline ${d.baseline}%`}
tick();setInterval(tick,2000);
</script></body></html>"""

if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Set FARMHAND_TOKEN (the same token as the ESP32's secrets.h).")
    print(f"Farm Hand home server on 127.0.0.1:{PORT} (brain: {'laya' if LAYA else 'baseline rule'}, baseline {BASELINE}%)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
