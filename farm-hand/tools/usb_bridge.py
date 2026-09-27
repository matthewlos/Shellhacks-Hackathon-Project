"""Demo mode: send the ESP32's 1-second USB readings straight to the Farm Hand server, so the live site updates every second.

Normal mode (no laptop): the ESP32 uploads over WiFi every 10 s by itself; the Mac mini saves everything.
Demo mode (this script): plug the ESP32 into the laptop. Every reading the ESP32 prints over USB (once a second) is posted to
the same server endpoint the ESP32 uses, so Laya decides on it and every open copy of https://farmhand.dmchang.xyz updates
at once. The ESP32 keeps its own WiFi uploads going, so pulling the cable changes nothing but the speed.

  python tools/usb_bridge.py                 # finds the ESP32's port, reads the token from firmware/sensors_live/include/secrets.h
  python tools/usb_bridge.py /dev/cu.usbserial-0001
  python tools/usb_bridge.py --local --local-only   # USB feeds only the laptop copy; the live site keeps the ESP32's own WiFi uploads
  python tools/usb_bridge.py --local         # also feed a copy of the server on this laptop (tools/local_site.sh), no internet needed

Needs pyserial and requests. Never writes to the board.
"""
import json
import re
import sys
import time
from pathlib import Path

import requests
import serial
from serial.tools import list_ports

HERE = Path(__file__).resolve().parent
SECRETS = HERE.parent / "firmware" / "sensors_live" / "include" / "secrets.h"


def secret(name):
    m = re.search(rf'#define\s+{name}\s+"([^"]*)"', SECRETS.read_text())
    if not m:
        sys.exit(f"{name} not found in {SECRETS}")
    return m.group(1)


LOCAL_URL = "http://127.0.0.1:8120/farmhand/reading"
# Commands for the ESP32 (e.g. "pump A 10", "stop", "relay low"): write them to this file, one per line.
# The bridge owns the USB port, so it sends them and prints the board's answer.
CMD_FILE = HERE.parent / "cloud" / "local" / "usb_cmd.txt"
STATE_FILE = HERE.parent / "cloud" / "local" / "pump_state.json"   # last pump / command reply, for tools/pump_control.py
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]


def find_port():
    if ARGS:
        return ARGS[0] if Path(ARGS[0]).exists() else None
    for p in list_ports.comports():
        d = f"{p.device} {p.description} {p.manufacturer or ''}".lower()
        if any(k in d for k in ("usbserial", "cp210", "ch340", "ch910", "silicon labs", "uart", "usbmodem")):
            return p.device
    return None


def open_port():
    """Wait for the ESP32 (unplugged or re-plugged cable), then open it without resetting the board."""
    said = False
    while True:
        port = find_port()
        if port:
            try:
                s = serial.Serial()
                s.port, s.baudrate, s.timeout = port, 115200, 2
                s.dtr = s.rts = False             # DTR/RTS drive the ESP32's reset: keep them released
                s.open()
                return port, s
            except serial.SerialException:
                pass
        if not said:
            print("Waiting for the ESP32 on USB (plug in a data cable)...", flush=True)
            said = True
        time.sleep(1)


def main():
    url, token = secret("FARMHAND_URL"), secret("FARMHAND_TOKEN")
    urls = ([LOCAL_URL] if "--local" in sys.argv else []) + ([] if "--local-only" in sys.argv else [url])
    port, s = open_port()
    http = requests.Session()
    http.headers.update({"X-Farmhand-Token": token, "Content-Type": "application/json"})
    print(f"USB bridge: {port} -> {' + '.join(urls)} (Ctrl-C to stop)")
    sent = fails = 0
    last_print = 0.0
    while True:
        try:
            line = s.readline().decode("utf-8", "replace").strip()
        except (serial.SerialException, OSError):
            print("USB unplugged, waiting for it to come back...", flush=True)
            s.close()
            port, s = open_port()
            print(f"USB back on {port}", flush=True)
            continue
        if CMD_FILE.exists():
            cmds = CMD_FILE.read_text().splitlines()
            CMD_FILE.unlink()
            for c in cmds:
                if c.strip():
                    s.write((c.strip() + "\n").encode())
                    print(f"  > {c.strip()}", flush=True)
        if line.startswith(('{"type":"pump', '{"type":"cmd"')):
            print(f"  < {line}", flush=True)
            try:
                STATE_FILE.write_text(json.dumps({"t": time.time(), "line": json.loads(line)}))
            except (OSError, ValueError):
                pass
        if not line.startswith('{"type":"sens"'):
            continue
        try:
            r = json.loads(line)
        except ValueError:
            continue
        r.pop("type", None)
        r["via"] = "usb"                      # the server ignores unknown keys; handy when reading the log
        reply = None
        for u in urls:                        # local first: it answers in milliseconds
            try:
                resp = http.post(u, data=json.dumps(r), timeout=2 if u == LOCAL_URL else 5)
                sent += resp.status_code == 200
                fails += resp.status_code != 200
                reply = reply or (resp.json() if resp.ok else {"error": resp.status_code})
            except requests.RequestException as e:
                fails += 1
                reply = reply or {"error": type(e).__name__}
        if time.time() - last_print > 5:
            last_print = time.time()
            print(f"  A {r.get('a_pct')}%  B {r.get('b_pct')}%  temps {[t.get('c') for t in r.get('temps', [])]}  "
                  f"-> {reply.get('pick', reply)}  (sent {sent}, failed {fails})", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped")
