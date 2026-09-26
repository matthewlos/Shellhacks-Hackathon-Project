"""Live sensor page for firmware/sensors_live: both soil probes + every temp probe, in the browser.

  python tools/sensors_live.py                 # auto-finds the ESP32's USB port
  python tools/sensors_live.py /dev/cu.usbserial-0001
  -> http://127.0.0.1:8099

Reads the ESP32's JSON lines (115200 baud) and serves one page. Needs pyserial. Nothing here can run a pump:
the firmware holds both relay pins off, and this script never writes to the board.
"""
import collections
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial
from serial.tools import list_ports

PORT_HTTP = 8099
HIST = collections.deque(maxlen=300)          # last 5 minutes at one reading a second
STATE = {"latest": None, "rx_at": None, "port": None, "error": None, "log": collections.deque(maxlen=12)}


def find_port():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for p in list_ports.comports():
        d = f"{p.device} {p.description} {p.manufacturer or ''}".lower()
        if any(k in d for k in ("usbserial", "cp210", "ch340", "ch910", "silicon labs", "uart", "usbmodem")):
            return p.device
    return None


def reader():
    while True:
        port = find_port()
        if not port:
            STATE["error"] = "No ESP32 found. Is the USB cable a data cable?"
            time.sleep(2)
            continue
        try:
            s = serial.Serial()                  # DTR/RTS low before opening: on the ESP32 devkit they drive reset/boot,
            s.port, s.baudrate, s.timeout = port, 115200, 2
            s.dtr = s.rts = False                  # and pyserial's default would hold the chip in reset
            s.open()
            with s:
                STATE.update(port=port, error=None)
                while True:
                    line = s.readline().decode("utf-8", "replace").strip()
                    if not line:
                        continue
                    STATE["log"].append(line[:200])
                    if not line.startswith("{"):
                        continue
                    try:
                        m = json.loads(line)
                    except ValueError:
                        continue
                    if m.get("type") == "sens":
                        m["t"] = time.time()
                        STATE.update(latest=m, rx_at=m["t"])
                        HIST.append(m)
        except (serial.SerialException, OSError) as e:
            STATE["error"] = f"{port}: {e}"
            time.sleep(2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/data"):
            body = json.dumps({"latest": STATE["latest"], "age_s": None if STATE["rx_at"] is None else round(time.time() - STATE["rx_at"], 1),
                               "port": STATE["port"], "error": STATE["error"], "log": list(STATE["log"]), "hist": list(HIST)}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json")
        else:
            body = PAGE.encode()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(body)


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farm Hand sensors</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&display=swap">
<style>
:root{--ground:#eef1f4;--panel:#fbfcfd;--wash:#f2f5f8;--line:rgba(14,22,33,.09);--ink:#0e1621;--ink-2:#3d4a59;--muted:#5b6674;
--soil:#1f64b8;--heat:#7646b8;--good:#0a8a0a;--bad:#c43333;--warn:#9a6a00;--r-ctl:6px;--r-panel:12px;
--f-display:"Bricolage Grotesque",system-ui,sans-serif;--f-body:"Atkinson Hyperlegible Next",system-ui,sans-serif;--f-num:"JetBrains Mono",ui-monospace,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 var(--f-body)}
.wrap{max-width:1180px;margin:0 auto;padding-inline:24px;padding-block:24px 48px;display:grid;gap:18px}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:12px}
h1{margin:0;font:700 2rem/1 var(--f-display);letter-spacing:-.02em}
.sub{margin:6px 0 0;color:var(--ink-2)}
.status{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink-2)}
.dot{width:9px;height:9px;border-radius:50%;background:var(--muted)}.dot.ok{background:var(--good)}.dot.bad{background:var(--bad)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media(max-width:980px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.grid{grid-template-columns:1fr}.wrap{padding-inline:16px}}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-panel);padding:16px 18px;display:grid;gap:4px;align-content:start}
.tile h2{margin:0;font-size:14px;font-weight:600;color:var(--ink-2)}
.big{font:600 clamp(2.6rem,5vw,3.6rem)/1 var(--f-num);font-variant-numeric:tabular-nums;letter-spacing:-.04em}
.soil .big{color:var(--soil)}.heat .big{color:var(--heat)}.off .big{color:var(--muted)}
.meta{font:500 12.5px/1.4 var(--f-num);color:var(--muted);font-variant-numeric:tabular-nums}
.note{font-size:12.5px;color:var(--warn)}
svg.spark{width:100%;height:46px;display:block;margin-top:6px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-panel);padding:14px 18px}
.panel h3{margin:0 0 8px;font-size:14px;color:var(--ink-2)}
pre{margin:0;font:500 12px/1.5 var(--f-num);color:var(--ink-2);white-space:pre-wrap;word-break:break-all;max-height:220px;overflow:auto}
.help{font-size:14px;color:var(--ink-2);display:grid;gap:4px}.help b{color:var(--ink)}
</style></head><body><div class="wrap">
<header><div><h1>Farm Hand sensors</h1><p class="sub">Live from the ESP32, one reading a second. The same numbers show on the OLED on the breadboard. Pumps are off.</p></div>
<div class="status"><span class="dot" id="dot"></span><span id="stat">Connecting…</span></div></header>
<div class="grid">
 <div class="tile soil" id="tA"><h2>Soil A · pin 32</h2><div class="big" id="vA">–</div><div class="meta" id="mA">raw –</div><svg class="spark" id="sA" viewBox="0 0 200 46" preserveAspectRatio="none"></svg></div>
 <div class="tile soil" id="tB"><h2>Soil B · pin 33</h2><div class="big" id="vB">–</div><div class="meta" id="mB">raw –</div><div class="note">Not calibrated yet: uses probe A's numbers. Trust the raw value.</div><svg class="spark" id="sB" viewBox="0 0 200 46" preserveAspectRatio="none"></svg></div>
 <div class="tile heat" id="t1"><h2>Temp 1 · pin 4</h2><div class="big" id="v1">–</div><div class="meta" id="m1">looking for probe…</div><svg class="spark" id="s1" viewBox="0 0 200 46" preserveAspectRatio="none"></svg></div>
 <div class="tile heat" id="t2"><h2>Temp 2 · pin 4</h2><div class="big" id="v2">–</div><div class="meta" id="m2">looking for probe…</div><svg class="spark" id="s2" viewBox="0 0 200 46" preserveAspectRatio="none"></svg></div>
</div>
<div class="panel help"><h3>Which temp probe is which?</h3><span>Hold one steel tip in your hand. The one that climbs toward <b>30–34 °C</b> is the one you're holding. Probes are listed by their chip ID, so the order stays the same every time.</span>
<span>Soil check: probe in the air reads about <b>3400 raw</b> (0%), dipped in water up to the line about <b>1500 raw</b> (100%).</span></div>
<div class="panel"><h3>Serial from the ESP32 (<span id="port">–</span>)</h3><pre id="log"></pre></div>
</div>
<script>
const $=id=>document.getElementById(id);
function spark(el,vals,lo,hi,color){const v=vals.filter(x=>x!=null);if(v.length<2){el.innerHTML='';return}
 const mn=Math.min(lo??Infinity,...v),mx=Math.max(hi??-Infinity,...v),r=(mx-mn)||1;
 const pts=vals.map((x,i)=>x==null?null:[(i/(vals.length-1))*200,44-((x-mn)/r)*40]).filter(Boolean);
 el.innerHTML=`<polyline fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts.map(p=>p.join(',')).join(' ')}"/>`}
async function tick(){let d;try{d=await (await fetch('/data')).json()}catch(e){$('stat').textContent='Page server stopped';$('dot').className='dot bad';return}
 const L=d.latest,live=L&&d.age_s!=null&&d.age_s<3;
 $('dot').className='dot '+(live?'ok':'bad');
 $('stat').textContent=d.error?d.error:!L?'Connected, waiting for the first reading…':live?`Live · last reading ${d.age_s.toFixed(1)} s ago`:`No reading for ${d.age_s.toFixed(0)} s`;
 $('port').textContent=d.port||'no port';$('log').textContent=d.log.join('\n');
 if(!L)return;
 $('vA').textContent=L.a_pct.toFixed(1)+'%';$('mA').textContent=`raw ${L.a_raw}`;
 $('vB').textContent=L.b_pct.toFixed(1)+'%';$('mB').textContent=`raw ${L.b_raw}`;
 const H=d.hist;spark($('sA'),H.map(h=>h.a_pct),0,100,'#1f64b8');spark($('sB'),H.map(h=>h.b_pct),0,100,'#1f64b8');
 for(const i of [0,1]){const t=(L.temps||[])[i],k=i+1;$('t'+k).classList.toggle('off',!t||t.c==null);
  $('v'+k).textContent=t&&t.c!=null?t.c.toFixed(1)+'°C':'–';
  $('m'+k).textContent=t?(t.c==null?`probe ${t.id.slice(-6)} dropped off`:`chip ${t.id.slice(-6)}`):'no probe found on the data line';
  spark($('s'+k),H.map(h=>(h.temps||[])[i]?.c??null),null,null,'#7646b8')}}
tick();setInterval(tick,500);
</script></body></html>"""

if __name__ == "__main__":
    threading.Thread(target=reader, daemon=True).start()
    print(f"Farm Hand sensors: http://127.0.0.1:{PORT_HTTP}")
    ThreadingHTTPServer(("127.0.0.1", PORT_HTTP), Handler).serve_forever()
