"""
Raw ESP32 serial monitor, served over HTTP.

Shows exactly what the board prints on COM3 at 115200 baud, no parsing or
curation, prefixed with the laptop's receive time. Streams new lines to the
browser over Server-Sent Events. Never uploads/changes firmware; only reads
and (if you type something) writes raw bytes to the existing serial port.

Run:
    C:\\Users\\User\\Documents\\code\\shellhacks2025\\farm-hand\\.venv\\Scripts\\python.exe raw_serial.py

Picks port 8096, or 8097 if 8096 is already bound by something else.
"""

import asyncio
import collections
import json
import socket
import threading
import time
from datetime import datetime

import serial
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

import glob, os, sys
# COM3 on the Windows PC; on the Mac the CP2102 shows up as /dev/cu.usbserial-* or /dev/cu.SLAB_USBtoUART. SERIAL_PORT overrides.
PORT_NAME = os.environ.get("SERIAL_PORT") or (
    "COM3" if sys.platform.startswith("win")
    else next(iter(sorted(glob.glob("/dev/cu.usbserial*") + glob.glob("/dev/cu.SLAB_USBtoUART*") + glob.glob("/dev/cu.wchusbserial*"))), "/dev/cu.usbserial"))
BAUD = 115200
MAX_LINES = 2000


def port_free(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


HTTP_PORT = 8096 if port_free(8096) else 8097
if HTTP_PORT == 8097:
    print("PORT 8096 WAS TAKEN, USING 8097 INSTEAD")
print(f"Serving on http://127.0.0.1:{HTTP_PORT}")


class SerialManager:
    def __init__(self, port_name: str, baud: int):
        self.port_name = port_name
        self.baud = baud
        self.ser = None
        self.connected = False
        self.last_error = ""
        self.lines = collections.deque(maxlen=MAX_LINES)
        self.lock = threading.Lock()
        self.subscribers = []  # list of (asyncio.Queue, loop)
        self.lines_received = 0
        self.recent_times = collections.deque(maxlen=2000)
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        while self.running:
            if not os.environ.get("SERIAL_PORT") and not sys.platform.startswith("win"):
                found = sorted(glob.glob("/dev/cu.usbserial*") + glob.glob("/dev/cu.SLAB_USBtoUART*") + glob.glob("/dev/cu.wchusbserial*"))
                if found:
                    self.port_name = found[0]   # the board was plugged in after start: pick it up
            try:
                self.ser = serial.Serial(self.port_name, self.baud, timeout=1)
                self.connected = True
                self.last_error = ""
                self._emit(f"-- connected to {self.port_name} @ {self.baud} --", system=True)
                while self.running:
                    raw = self.ser.readline()
                    if raw:
                        text = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                        if text != "" or raw == b"\n" or raw == b"\r\n":
                            self._emit(text)
            except Exception as e:
                self.connected = False
                self.last_error = str(e)
                try:
                    if self.ser:
                        self.ser.close()
                except Exception:
                    pass
                self.ser = None
                time.sleep(2)

    def _emit(self, text: str, system: bool = False):
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        entry = f"[{ts}] {text}"
        with self.lock:
            self.lines.append(entry)
            self.lines_received += 1
            self.recent_times.append(time.time())
        for q, loop in list(self.subscribers):
            try:
                loop.call_soon_threadsafe(q.put_nowait, entry)
            except Exception:
                pass

    def rate(self) -> float:
        now = time.time()
        with self.lock:
            recent = [t for t in self.recent_times if now - t <= 5.0]
        return round(len(recent) / 5.0, 2)

    def send(self, text: str):
        if self.ser and self.connected:
            try:
                self.ser.write((text + "\n").encode("utf-8"))
                self._emit(f">> sent: {text}", system=True)
                return True, ""
            except Exception as e:
                return False, str(e)
        return False, "not connected to " + self.port_name

    def snapshot_status(self):
        with self.lock:
            n = len(self.lines)
            total = self.lines_received
        return {
            "port": self.port_name,
            "baud": self.baud,
            "connected": self.connected,
            "error": self.last_error,
            "lines_received": total,
            "lines_per_sec": self.rate(),
            "buffered": n,
            "http_port": HTTP_PORT,
        }


mgr = SerialManager(PORT_NAME, BAUD)
app = FastAPI()


@app.get("/status")
async def status():
    return JSONResponse(mgr.snapshot_status())


@app.get("/tail")
async def tail(n: int = 200):
    with mgr.lock:
        data = list(mgr.lines)[-n:]
    return JSONResponse({"lines": data})


@app.post("/send")
async def send(request: Request):
    body = await request.json()
    text = body.get("text", "")
    ok, err = mgr.send(text)
    return JSONResponse({"ok": ok, "error": err})


@app.get("/events")
async def events(request: Request):
    q: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    sub = (q, loop)
    mgr.subscribers.append(sub)

    async def gen():
        try:
            with mgr.lock:
                backlog = list(mgr.lines)[-200:]
            for line in backlog:
                yield f"data: {json.dumps({'line': line, 'backlog': True})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    line = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield f"data: {json.dumps({'line': line})}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            if sub in mgr.subscribers:
                mgr.subscribers.remove(sub)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 Raw Serial</title>
<style>
  :root {
    --bg: #0b0d10;
    --panel: #14171b;
    --border: #262b31;
    --text: #d6e2e6;
    --dim: #7c8791;
    --green: #4caf50;
    --red: #e5534b;
    --accent: #58a6ff;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: var(--bg); color: var(--text);
    font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, "Courier New", monospace;
  }
  #app { display: flex; flex-direction: column; height: 100vh; }
  #statusbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
    padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--border);
    font-size: 13px; color: var(--dim);
  }
  #statusbar b { color: var(--text); }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; vertical-align:middle; }
  .dot.on { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot.off { background: var(--red); box-shadow: 0 0 6px var(--red); }
  #err { color: var(--red); }
  #toolbar {
    display: flex; gap: 8px; padding: 6px 12px; background: var(--panel);
    border-bottom: 1px solid var(--border); flex-wrap: wrap;
  }
  button {
    background: #1c2128; color: var(--text); border: 1px solid var(--border);
    padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;
    font-family: inherit;
  }
  button:hover { background: #262c34; }
  button.active { border-color: var(--accent); color: var(--accent); }
  #console {
    flex: 1; overflow-y: auto; padding: 8px 12px; font-size: 13px; line-height: 1.45;
    white-space: pre-wrap; word-break: break-all;
  }
  #console div.line { }
  #console div.sysline { color: var(--accent); }
  #sendbar {
    display: flex; gap: 8px; padding: 8px 12px; background: var(--panel);
    border-top: 1px solid var(--border);
  }
  #sendtext {
    flex: 1; background: #0b0d10; color: var(--text); border: 1px solid var(--border);
    border-radius: 6px; padding: 8px 10px; font-family: inherit; font-size: 13px;
  }
  #sendtext:focus, #sendtext:focus-visible { outline: 1px solid var(--accent); }
  @media (max-width: 520px) {
    #statusbar { font-size: 11px; gap: 8px; }
    #console { font-size: 12px; }
  }
</style>
</head>
<body>
<div id="app">
  <div id="statusbar">
    <span><span id="dot" class="dot off"></span><span id="connlabel">connecting...</span></span>
    <span>port: <b id="port">-</b></span>
    <span>baud: <b id="baud">-</b></span>
    <span>lines: <b id="linecount">0</b></span>
    <span>rate: <b id="rate">0</b>/s</span>
    <span id="err"></span>
  </div>
  <div id="toolbar">
    <button id="pauseBtn">Pause scroll</button>
    <button id="clearBtn">Clear</button>
    <button id="copyBtn">Copy all</button>
  </div>
  <div id="console"></div>
  <div id="sendbar">
    <input id="sendtext" type="text" placeholder="type a line to send to the board, then Enter" autocomplete="off">
    <button id="sendBtn">Send</button>
  </div>
</div>
<script>
const consoleEl = document.getElementById('console');
const pauseBtn = document.getElementById('pauseBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const sendtext = document.getElementById('sendtext');
const sendBtn = document.getElementById('sendBtn');
let paused = false;
const MAX_DOM_LINES = 2000;

function appendLine(text, isSystem) {
  const div = document.createElement('div');
  div.className = isSystem ? 'sysline' : 'line';
  div.textContent = text;
  consoleEl.appendChild(div);
  while (consoleEl.children.length > MAX_DOM_LINES) {
    consoleEl.removeChild(consoleEl.firstChild);
  }
  if (!paused) {
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
}

function isSystemLine(text) {
  return text.includes('-- connected to') || text.includes('>> sent:');
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.classList.toggle('active', paused);
  pauseBtn.textContent = paused ? 'Resume scroll' : 'Pause scroll';
  if (!paused) consoleEl.scrollTop = consoleEl.scrollHeight;
});

clearBtn.addEventListener('click', () => {
  consoleEl.innerHTML = '';
});

copyBtn.addEventListener('click', async () => {
  const text = Array.from(consoleEl.children).map(d => d.textContent).join('\\n');
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copyBtn.textContent = 'Copied!';
  }
  setTimeout(() => { copyBtn.textContent = 'Copy all'; }, 1200);
});

async function doSend() {
  const text = sendtext.value;
  if (!text) return;
  sendtext.value = '';
  try {
    await fetch('/send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text})
    });
  } catch (e) {}
}
sendBtn.addEventListener('click', doSend);
sendtext.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSend();
});

function connectSSE() {
  const es = new EventSource('/events');
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      appendLine(data.line, isSystemLine(data.line));
    } catch (e) {}
  };
  es.onerror = () => {
    es.close();
    setTimeout(connectSSE, 2000);
  };
}
connectSSE();

async function pollStatus() {
  try {
    const res = await fetch('/status');
    const s = await res.json();
    document.getElementById('port').textContent = s.port;
    document.getElementById('baud').textContent = s.baud;
    document.getElementById('linecount').textContent = s.lines_received;
    document.getElementById('rate').textContent = s.lines_per_sec;
    const dot = document.getElementById('dot');
    const label = document.getElementById('connlabel');
    const err = document.getElementById('err');
    if (s.connected) {
      dot.className = 'dot on';
      label.textContent = 'connected';
      err.textContent = '';
    } else {
      dot.className = 'dot off';
      label.textContent = 'disconnected, retrying...';
      err.textContent = s.error ? ('error: ' + s.error) : '';
    }
  } catch (e) {
    document.getElementById('connlabel').textContent = 'server unreachable';
  }
  setTimeout(pollStatus, 1000);
}
pollStatus();
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse(PAGE)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=HTTP_PORT, log_level="warning")
