"""Pump control page: big On / Off buttons for each pump, for flow tests and demos.

  python tools/pump_control.py          then open http://127.0.0.1:8130  (also on this laptop's Tailscale IP)

Two links, picked automatically:
  USB   when tools/local_site.sh (usb_bridge.py) is running: the command goes to cloud/local/usb_cmd.txt, the bridge sends it
        within about a second.
  WiFi  otherwise: the command is queued on the Mac mini (POST /farmhand/api/pump, token from secrets.h) and rides back to
        the ESP32 in its next upload reply, within about 2 s. No cable needed.
"On" runs the pump until "Off". The firmware keeps a failsafe at PUMP_TEST_MAX_S (10 min) in case "Off" never arrives.
"""
import json
import re
import subprocess
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOCAL = HERE.parent / "cloud" / "local"
CMD_FILE, STATE_FILE = LOCAL / "usb_cmd.txt", LOCAL / "pump_state.json"
PORT, MAX_S = 8130, 600
SECRETS = HERE.parent / "firmware" / "sensors_live" / "include" / "secrets.h"


def secret(name):
    m = re.search(rf'#define\s+{name}\s+"([^"]*)"', SECRETS.read_text())
    return m.group(1) if m else ""


API = secret("FARMHAND_URL").replace("/reading", "/api/pump")
TOKEN = secret("FARMHAND_TOKEN")


def usb_up():
    return subprocess.run(["pgrep", "-f", "usb_bridge.py"], capture_output=True).returncode == 0


def wifi(cmd=None):
    req = urllib.request.Request(API, method="POST" if cmd else "GET", data=json.dumps({"cmd": cmd}).encode() if cmd else None,
                                 headers={"X-Farmhand-Token": TOKEN, "Content-Type": "application/json", "User-Agent": "FarmHand-PumpControl/1.0"})
    with urllib.request.urlopen(req, timeout=6) as r:
        return json.load(r)

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Pump control</title>
<style>
:root{--bg:#e9ede7;--panel:#fafbf8;--ink:#16201a;--dim:#44504a;--line:rgba(22,32,26,.13);--a:#1b66c9;--b:#b3540c;--on:#2b7a45;--off:#b9362a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.4 system-ui,-apple-system,sans-serif;padding:24px 16px}
h1{margin:0 0 4px;font-size:28px}p.sub{margin:0 0 20px;color:var(--dim)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;max-width:760px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;display:grid;gap:14px}
.head{display:flex;align-items:center;gap:10px}.badge{width:32px;height:32px;border-radius:8px;color:#fff;display:grid;place-items:center;font-weight:700}
.a .badge{background:var(--a)}.b .badge{background:var(--b)}.head b{font-size:20px}.head span{color:var(--dim);font-size:14px}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button{font:700 22px system-ui;border:0;border-radius:12px;min-height:84px;color:#fff;cursor:pointer;touch-action:manipulation}
button:active{transform:scale(.98)}.on{background:var(--on)}.off{background:var(--off)}
.state{font:600 16px ui-monospace,monospace;min-height:1.4em}.state.run{color:var(--on)}
.timer{font:700 40px ui-monospace,monospace;font-variant-numeric:tabular-nums}
.stopall{margin-top:16px;max-width:760px;width:100%;background:var(--ink)}
small{color:var(--dim)}
</style></head><body>
<h1>Pump control</h1><p class="sub">On runs until Off. Off stops both pumps. <b id="link">…</b></p>
<div class="grid">
 <div class="card a"><div class="head"><div class="badge">A</div><div><b>Pump 1</b><br><span>Group 1 · Box A (D13)</span></div></div>
  <div class="timer" id="tA">0.0 s</div><div class="btns"><button class="on" onclick="go('A')">On</button><button class="off" onclick="stop()">Off</button></div></div>
 <div class="card b"><div class="head"><div class="badge">B</div><div><b>Pump 2</b><br><span>Group 2 · Box B (D22)</span></div></div>
  <div class="timer" id="tB">0.0 s</div><div class="btns"><button class="on" onclick="go('B')">On</button><button class="off" onclick="stop()">Off</button></div></div>
</div>
<button class="stopall" onclick="stop()">Stop everything</button>
<p class="state" id="st">Ready.</p>
<small>Board reply shows here. Run time comes from the board itself, measured to the millisecond.</small>
<script>
let running=null,t0=0,tick=null;
const st=document.getElementById('st');
function show(p,s){document.getElementById('t'+p).textContent=s.toFixed(1)+' s'}
async function post(path){try{const r=await fetch(path,{method:'POST'});const j=await r.json();if(!r.ok){st.className='state';st.textContent='Not sent: '+(j.error||r.status)+'. Try again.';return null}return j}catch(e){st.className='state';st.textContent='Page server not reachable.';return null}}
async function go(p){const j=await post('/on/'+p);if(!j)return;running=p;t0=performance.now();st.textContent=j.via=='usb'?'Pump '+(p=='A'?1:2)+' starting…':'Sent. Pump '+(p=='A'?1:2)+' starts when the board checks in (about 2 s)…';st.className='state run';
 clearInterval(tick);tick=setInterval(()=>{if(running)show(running,(performance.now()-t0)/1000)},100)}
async function stop(){await post('/off');running=null;clearInterval(tick);st.className='state';st.textContent='Stopping…'}
let lastWifi='';
setInterval(async()=>{try{const s=await (await fetch('/state')).json();
 document.getElementById('link').textContent=s.link=='usb'?'Link: USB (instant)':'Link: WiFi via the Mac mini (about 2 s)';
 if(s.link=='wifi'){const w=s.wifi;if(!w){st.textContent='WiFi: '+(s.error||'no answer');return}
  const t=w.test;const k=JSON.stringify(t)+w.queued;if(k==lastWifi)return;lastWifi=k;
  if(w.queued){st.className='state run';st.textContent='Sent, waiting for the board to check in…';return}
  if(t&&t.on){st.className='state run';st.textContent='Pump '+(t.pot=='A'?1:2)+' ON ('+t.s.toFixed(1)+' s so far)'}
  else if(t&&!t.on){show(t.pot,t.s);running=null;clearInterval(tick);st.className='state';st.textContent='Pump '+(t.pot=='A'?1:2)+' off after '+t.s.toFixed(3)+' s'}
  return}
 if(!s.line)return;const l=s.line;
 if(l.type=='pump_test'&&l.state=='off'){running=null;clearInterval(tick);show(l.pot,l.ran_s);st.className='state';st.textContent='Pump '+(l.pot=='A'?1:2)+' off after '+l.ran_s.toFixed(3)+' s ('+l.why+')'}
 else if(l.type=='pump_test'&&l.state=='on'){st.className='state run';st.textContent='Pump '+(l.pot=='A'?1:2)+' ON'}
 else if(l.type=='pump_test'&&l.state=='refused'){st.textContent='Refused: '+l.why}
 else if(l.type=='cmd'){st.textContent=l.ok||l.error}}catch(e){}},500);
</script></body></html>""".replace("MAXs", str(MAX_S))


def send(cmd):
    if usb_up():
        LOCAL.mkdir(parents=True, exist_ok=True)
        with CMD_FILE.open("a") as f:
            f.write(cmd + "\n")
        return "usb"
    wifi(cmd)
    return "wifi"


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/state":
            if usb_up():
                try:
                    st = json.loads(STATE_FILE.read_text())
                except (OSError, ValueError):
                    st = {}
                return self._send(200, json.dumps({"link": "usb", **st}))
            try:
                return self._send(200, json.dumps({"link": "wifi", "wifi": wifi()}))
            except Exception as e:
                return self._send(200, json.dumps({"link": "wifi", "error": type(e).__name__}))
        return self._send(200, PAGE, "text/html; charset=utf-8")

    def do_POST(self):
        if self.path in ("/on/A", "/on/B"):
            try:
                via = send(f"pump {self.path[-1]} {MAX_S}")
            except Exception as e:
                return self._send(502, json.dumps({"error": type(e).__name__}))
            return self._send(200, json.dumps({"sent": f"pump {self.path[-1]} on", "via": via}))
        if self.path == "/off":
            try:
                via = send("stop")
            except Exception as e:
                return self._send(502, json.dumps({"error": type(e).__name__}))
            return self._send(200, json.dumps({"sent": "stop", "via": via}))
        return self._send(404, "{}")


def serve(host):
    ThreadingHTTPServer((host, PORT), H).serve_forever()


if __name__ == "__main__":
    import threading
    hosts = ["127.0.0.1"]
    try:
        ip = subprocess.run(["tailscale", "ip", "-4"], capture_output=True, text=True, timeout=5).stdout.split()
        hosts += ip[:1]
    except (OSError, subprocess.SubprocessError):
        pass
    for h in hosts[1:]:
        threading.Thread(target=serve, args=(h,), daemon=True).start()
    print("Pump control: " + "  ".join(f"http://{h}:{PORT}" for h in hosts), flush=True)
    serve(hosts[0])
