"""Sep 23 bring-up helper. Walks you through calibrating both probes and measuring pump flow.
Writes data/calibration.json, which the laptop uses to turn raw numbers into %.

  python calibrate.py            # auto-find the ESP32
  python calibrate.py COM5       # or name the port
"""
import json
import statistics
import sys
import time

import serial
from serial.tools import list_ports

import config


def port():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for p in list_ports.comports():
        print("found", p.device, p.description)
    ports = [p.device for p in list_ports.comports()]
    if not ports:
        raise SystemExit("No serial port. Is it a DATA cable? Is the CP210x/CH340 driver installed?")
    return ports[0]


def median_raw(ser, key, n=6):
    vals = []
    while len(vals) < n:
        line = ser.readline().decode("utf-8", "replace").strip()
        if line.startswith('{"type":"reading"'):
            v = json.loads(line)[key]
            vals.append(v)
            print(f"   {key} = {v}")
    return int(statistics.median(vals))


def main():
    ser = serial.Serial(port(), config.BAUD, timeout=2)
    time.sleep(2)
    ser.write(b"T 0\n")                                   # timer off while we calibrate
    cal = json.loads(json.dumps(config.load_cal()))
    for pot, key in (("A", "a_raw"), ("B", "b_raw")):
        input(f"\nProbe {pot}: hold it in DRY AIR, then press Enter...")
        cal[pot]["raw_air"] = median_raw(ser, key)
        input(f"Probe {pot}: put it in a CUP OF WATER, only up to the line on the probe. Press Enter...")
        cal[pot]["raw_water"] = median_raw(ser, key)
        swing = cal[pot]["raw_air"] - cal[pot]["raw_water"]
        print(f"Probe {pot}: air {cal[pot]['raw_air']}, water {cal[pot]['raw_water']}, swing {swing}")
        if swing < 500:
            print("  ⚠️ swing under 500: bad probe or bad wire. Swap probes (you have 5).")
    for pot in "AB":
        input(f"\nPump {pot}: tube into an EMPTY measuring cup, pump in water. Enter = run 10 s...")
        ser.write(f"P {pot} 10000\n".encode())
        time.sleep(12)
        ml = float(input("How many ml in the cup? "))
        cal["flow_ml_per_s"][pot] = round(ml / 10, 2)
    config.CAL_FILE.write_text(json.dumps(cal, indent=2))
    print("\nsaved", config.CAL_FILE)
    print(json.dumps(cal, indent=2))


if __name__ == "__main__":
    main()
