"""Live power page: reads the power_probe lines from the raw serial page (http://127.0.0.1:8096/tail) and shows two big
voltmeters. Serve: .venv/Scripts/python.exe tools/power_page.py  ->  http://127.0.0.1:8097"""
import json, urllib.request
import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
app = FastAPI()
from pathlib import Path as _P
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
_DOCS = _P(__file__).resolve().parent.parent / "docs"

@app.get("/assemble")
def assemble_page():
    return FileResponse(_DOCS / "assemble" / "index.html")


@app.get("/soil")
def soil_page():
    return FileResponse(_DOCS / "soil" / "index.html")


@app.get("/last")
def last_of_type(type: str = "sens"):
    """Newest JSON line of one type from the ESP32 (via the raw serial page)."""
    try:
        d = json.load(urllib.request.urlopen("http://127.0.0.1:8096/tail?n=20", timeout=2))
    except Exception as e:
        return {"err": f"raw serial page not reachable: {e}"}
    last = None
    for l in d.get("lines", []):
        i = l.find("{")
        if i >= 0 and f'"{type}"' in l:
            try: last = json.loads(l[i:])
            except Exception: pass
    return {"last": last}


@app.get("/temp")
def temp_page():
    return FileResponse(_DOCS / "temp" / "index.html")


@app.get("/temp-data")
def temp_data():
    try:
        d = json.load(urllib.request.urlopen("http://127.0.0.1:8096/tail?n=20", timeout=2))
    except Exception as e:
        return {"err": f"raw serial page not reachable: {e}"}
    last = None
    for l in d.get("lines", []):
        i = l.find("{")
        if i >= 0 and '"temp"' in l:
            try: last = json.loads(l[i:])
            except Exception: pass
    return {"last": last}


@app.get("/pump")
def pump():
    return FileResponse(_DOCS / "pump" / "index.html")


@app.get("/transistor")
def transistor():
    return FileResponse(_DOCS / "transistor" / "index.html")


@app.get("/relay")
def relay_test():
    return FileResponse(_DOCS / "relay-test" / "index.html")


@app.get("/wiring")
def wiring():
    return FileResponse(_DOCS / "wiring" / "index.html")   # same page, but live: it can read /data from here

@app.get("/data")
def data():
    try:
        d = json.load(urllib.request.urlopen("http://127.0.0.1:8096/tail?n=40", timeout=2))
        lines = d.get("lines", d) if isinstance(d, dict) else d
    except Exception as e:
        return {"err": f"raw serial page not reachable: {e}"}
    pts = []
    for l in lines:
        i = l.find("{")
        if i >= 0 and '"probe"' in l:
            try: pts.append(json.loads(l[i:]))
            except Exception: pass
    return {"pts": pts[-25:]}

@app.get("/", response_class=HTMLResponse)
def page():
    return PAGE

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Power Probe</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Atkinson+Hyperlegible+Next:wght@400;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#0d1117;color:#e8edf3;font:16px/1.4 "Atkinson Hyperlegible Next",system-ui;padding:20px 16px}
.w{max-width:1000px;margin:0 auto;display:grid;gap:14px}
h1{margin:0;font:800 1.5rem "Bricolage Grotesque"} .sub{color:#b3bdc9;margin:4px 0 0}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px} @media(max-width:700px){.row{grid-template-columns:1fr}}
.m{background:#151b23;border:1px solid #263041;border-radius:16px;padding:18px}
.m .k{font:700 13px "JetBrains Mono";color:#8b96a3;letter-spacing:.05em}
.m .v{font:700 4.6rem/1.05 "JetBrains Mono";margin:6px 0}
.m .s{font:800 1.5rem "Bricolage Grotesque"}
.bar{height:14px;border-radius:9px;background:#263041;overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;transition:width .3s}
.relay{display:flex;gap:12px;align-items:center;font:700 1.1rem "JetBrains Mono"}.dot{width:18px;height:18px;border-radius:50%}
.help{background:#151b23;border:1px solid #263041;border-radius:16px;padding:16px;color:#b3bdc9}.help b{color:#fff}
#err{color:#f07070;font-weight:700}
</style></head><body><div class="w">
<div><h1>Power probe, live</h1><p class="sub">Touch a probe wire's free pin to a spot. Reads 5 times a second.</p></div>
<div class="relay m"><span class="dot" id="rd"></span><span id="rt">relay IN: –</span></div>
<div class="row">
 <div class="m"><div class="k">PROBE A · wire on D34</div><div class="v" id="av">–</div><div class="s" id="as">–</div><div class="bar"><i id="ab"></i></div></div>
 <div class="m"><div class="k">PROBE B · wire on D35</div><div class="v" id="bv">–</div><div class="s" id="bs">–</div><div class="bar"><i id="bb"></i></div></div>
</div>
<div class="help"><b>How to read it:</b> "POWER (3.1V+)" = 5V or 3.3V is there. "0 V" = no power, or you're touching ground. Numbers jumping around = the probe isn't touching anything.<br><br>
<b>Where to touch:</b> relay DC+ screw → should say POWER. · relay DC− screw → should say 0 V. · relay COM screw → POWER. · relay NO screw → should switch between POWER and 0 V every 2 s (that's the relay working).</div>
<p id="err"></p></div>
<script>
function show(id, mv){ const v=document.getElementById(id+'v'), s=document.getElementById(id+'s'), b=document.getElementById(id+'b');
 if(mv==null){v.textContent='–';return;}
 const pw=mv>=3000, zero=mv<150;
 v.textContent=pw?'3.1V+':(mv/1000).toFixed(2)+'V'; v.style.color=pw?'#4cc24c':zero?'#8b96a3':'#f0a040';
 s.textContent=pw?'POWER':zero?'0 V (no power / ground)':'in between: loose or floating';
 b.style.width=Math.min(100,mv/31)+'%'; b.style.background=pw?'#4cc24c':zero?'#555':'#f0a040'; }
async function tick(){ let d; try{d=await (await fetch('/data')).json();}catch(e){document.getElementById('err').textContent='page lost its server';return;}
 document.getElementById('err').textContent=d.err||''; const p=(d.pts||[]).slice(-1)[0]; if(!p){document.getElementById('err').textContent=d.err||'waiting for probe lines… (is the power_probe code loaded?)';return;}
 show('a',p.a_mv); show('b',p.b_mv);
 document.getElementById('rt').textContent='relay IN (pin 26): '+p.relay_in+(p.relay_in==='LOW'?'  → relay should be ON':'  → relay should be OFF');
 document.getElementById('rd').style.background=p.relay_in==='LOW'?'#4cc24c':'#555'; }
setInterval(tick,300); tick();
</script></body></html>"""

app.mount("/parts", StaticFiles(directory=_DOCS / "parts"), name="parts")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8097, log_level="warning")
