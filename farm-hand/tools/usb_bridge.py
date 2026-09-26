"""Demo mode: send the ESP32's 1-second USB readings straight to the Farm Hand server, so the live site updates every second.

Normal mode (no laptop): the ESP32 uploads over WiFi every 10 s by itself; the Mac mini saves everything.
Demo mode (this script): plug the ESP32 into the laptop. Every reading the ESP32 prints over USB (once a second) is posted to
the same server endpoint the ESP32 uses, so Laya decides on it and every open copy of https://farmhand.dmchang.xyz updates
at once. The ESP32 keeps its own WiFi uploads going, so pulling the cable changes nothing but the speed.

  python tools/usb_bridge.py                 # finds the ESP32's port, reads the token from firmware/sensors_live/include/secrets.h
  python tools/usb_bridge.py /dev/cu.usbserial-0001

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


def find_port():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for p in list_ports.comports():
        d = f"{p.device} {p.description} {p.manufacturer or ''}".lower()
        if any(k in d for k in ("usbserial", "cp210", "ch340", "ch910", "silicon labs", "uart", "usbmodem")):
            return p.device
    sys.exit("No ESP32 found on USB. Is it a data cable?")


def main():
    url, token = secret("FARMHAND_URL"), secret("FARMHAND_TOKEN")
    port = find_port()
    s = serial.Serial()
    s.port, s.baudrate, s.timeout = port, 115200, 2
    s.dtr = s.rts = False                     # DTR/RTS drive the ESP32's reset: keep them released
    s.open()
    http = requests.Session()
    http.headers.update({"X-Farmhand-Token": token, "Content-Type": "application/json"})
    print(f"USB bridge: {port} -> {url} (Ctrl-C to stop)")
    sent = fails = 0
    last_print = 0.0
    while True:
        line = s.readline().decode("utf-8", "replace").strip()
        if not line.startswith('{"type":"sens"'):
            continue
        try:
            r = json.loads(line)
        except ValueError:
            continue
        r.pop("type", None)
        r["via"] = "usb"                      # the server ignores unknown keys; handy when reading the log
        try:
            resp = http.post(url, data=json.dumps(r), timeout=5)
            sent += resp.status_code == 200
            fails += resp.status_code != 200
            reply = resp.json() if resp.ok else {"error": resp.status_code}
        except requests.RequestException as e:
            fails += 1
            reply = {"error": type(e).__name__}
        if time.time() - last_print > 5:
            last_print = time.time()
            print(f"  A {r.get('a_pct')}%  B {r.get('b_pct')}%  temps {[t.get('c') for t in r.get('temps', [])]}  "
                  f"-> {reply.get('pick', reply)}  (sent {sent}, failed {fails})", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped")
