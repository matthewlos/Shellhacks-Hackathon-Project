"""Live soil-probe page for bring-up: reads the ESP32 on COM3 (part-1 sketch prints `soil raw: N`), serves
http://127.0.0.1:8095 with a big live number, a 2-minute chart and a dry-to-wet bar.
Run: .venv/Scripts/python.exe tools/live_probe.py   (close it before uploading new code: only one program can own COM3)"""
import collections, re, threading, time
import serial, uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

PORT = "COM3"
hist = collections.deque(maxlen=240)          # (t, raw)
state = {"err": None, "last": None}


def reader():
    while True:
        try:
            with serial.Serial(PORT, 115200, timeout=1) as s:
                state["err"] = None
                while True:
                    m = re.search(r"soil raw:\s*(\d+)", s.readline().decode("utf-8", "replace"))
                    if m:
                        v = int(m.group(1)); hist.append((time.time(), v)); state["last"] = time.time()
        except Exception as e:
            state["err"] = f"{type(e).__name__}: {e}"[:160]; time.sleep(2)


app = FastAPI()


@app.get("/data")
def data():
    return {"points": list(hist), "err": state["err"], "age": (time.time() - state["last"]) if state["last"] else None}


@app.get("/", response_class=HTMLResponse)
def page():
    return PAGE


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soil Probe Live</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Atkinson+Hyperlegible+Next:wght@400;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>
:root{--bg:#eef1f4;--panel:#fbfcfd;--ink:#0e1621;--ink2:#3d4a59;--line:rgba(14,22,33,.1);--dry:#c4501f;--wet:#1f64b8}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--panel:#151b23;--ink:#e8edf3;--ink2:#b3bdc9;--line:rgba(255,255,255,.1);--dry:#f08a4b;--wet:#5b9cf0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 "Atkinson Hyperlegible Next",system-ui;padding:20px 16px}
.w{max-width:980px;margin:0 auto;display:grid;gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px}
h1{margin:0;font:800 1.4rem "Bricolage Grotesque"}.sub{color:var(--ink2);margin:2px 0 0}
.big{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap}
#v{font:700 6rem/1 "JetBrains Mono",monospace;letter-spacing:-.04em;transition:color .4s}
#st{font:800 2rem "Bricolage Grotesque"}
.bar{position:relative;height:26px;border-radius:99px;background:linear-gradient(90deg,var(--wet),#8fb3d9 45%,#d8b59a 60%,var(--dry));margin:10px 0 4px}
#mk{position:absolute;top:-8px;width:6px;height:42px;border-radius:3px;background:var(--ink);transition:left .5s;box-shadow:0 0 0 3px var(--panel)}
.scale{display:flex;justify-content:space-between;color:var(--ink2);font-size:14px;font-weight:700}
svg{width:100%;height:220px;display:block}
.row{display:flex;gap:26px;flex-wrap:wrap;color:var(--ink2)}.row b{color:var(--ink);font-family:"JetBrains Mono"}
#err{color:#c43333;font-weight:700}
</style></head><body><div class="w">
<div class="card"><h1>Soil probe, live</h1><p class="sub">Straight from your ESP32 on COM3. Updates every second.</p></div>
<div class="card"><div class="big"><div id="v">–</div><div id="st">waiting…</div></div>
<div class="bar"><div id="mk" style="left:50%"></div></div>
<div class="scale"><span>💧 in water ≈ 1300</span><span>dry air ≈ 3000+ 🌵</span></div></div>
<div class="card"><svg id="c" viewBox="0 0 900 220" preserveAspectRatio="none"></svg>
<div class="row"><span>lowest seen <b id="lo">–</b></span><span>highest seen <b id="hi">–</b></span><span>swing <b id="sw">–</b></span><span id="age"></span></div>
<p id="err"></p></div></div>
<script>
const WET=1300, DRY=3300; let lo=1e9, hi=-1;
async function tick(){ let d; try{ d=await (await fetch('/data')).json(); }catch(e){ document.getElementById('err').textContent='page lost the server'; return; }
 document.getElementById('err').textContent = d.err ? 'Board: '+d.err+' (close Arduino Serial Monitor if it is open)' : '';
 const P=d.points; if(!P.length) return; const v=P[P.length-1][1];
 lo=Math.min(lo,v); hi=Math.max(hi,v);
 const f=Math.max(0,Math.min(1,(v-WET)/(DRY-WET)));
 const V=document.getElementById('v'); V.textContent=v; V.style.color=f>.6?'var(--dry)':f<.35?'var(--wet)':'var(--ink)';
 document.getElementById('st').textContent = f>.75?'dry (air)': f>.45?'damp': f>.15?'wet':'in water';
 document.getElementById('mk').style.left=`calc(${f*100}% - 3px)`;
 document.getElementById('lo').textContent=lo; document.getElementById('hi').textContent=hi; document.getElementById('sw').textContent=hi-lo;
 document.getElementById('age').textContent = d.age!=null ? (d.age<3?'● live':'⚠ no reading for '+d.age.toFixed(0)+' s') : '';
 const t0=P[0][0], t1=P[P.length-1][0], X=t=>(t-t0)/Math.max(1,t1-t0)*880+10, Y=v=>210-(Math.max(800,Math.min(3600,v))-800)/2800*200;
 const pts=P.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
 document.getElementById('c').innerHTML=`<line x1="10" x2="890" y1="${Y(WET)}" y2="${Y(WET)}" stroke="var(--wet)" stroke-dasharray="6 6"/><text x="14" y="${Y(WET)-6}" fill="var(--wet)" font-size="13" font-weight="700">water ≈ 1300</text>
 <line x1="10" x2="890" y1="${Y(3000)}" y2="${Y(3000)}" stroke="var(--dry)" stroke-dasharray="6 6"/><text x="14" y="${Y(3000)-6}" fill="var(--dry)" font-size="13" font-weight="700">dry air ≈ 3000</text>
 <polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>`; }
setInterval(tick,1000); tick();
</script></body></html>"""

if __name__ == "__main__":
    threading.Thread(target=reader, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8095, log_level="warning")
