"""Talks to the ESP32 over USB serial. FakeBoard stands in when no hardware is plugged in.

Every reading from FakeBoard is logged with fake=1 and the dashboard shows a FAKE badge.
Never put fake numbers on a slide.
"""
import json
import math
import random
import threading
import time

import config
import store


class BaseBoard:
    fake = False

    def __init__(self):
        self.latest = None          # last reading dict (with laptop-calibrated pct)
        self.events = []            # recent non-reading lines, newest last
        self.online = False
        self.listeners = []         # soak watcher etc. get every line
        self.on_boot = None
        self.tag_next = None        # who asked for the next laptop pour: 'manual' (test pour) or 'target' (demo run)
        self._cur_tag = "laptop"

    def _on_line(self, obj):
        t = obj.get("type")
        if t == "reading":
            cal = config.load_cal()
            obj["a_pct"] = round(config.pct("A", obj["a_raw"], cal), 1)
            obj["b_pct"] = round(config.pct("B", obj["b_raw"], cal), 1)
            obj["ts"] = time.time()
            self.latest = obj
            store.add_reading(obj, self.fake)
        else:
            obj["ts"] = time.time()
            if t == "pour_start" and obj.get("by") == "laptop":
                self._cur_tag, self.tag_next = self.tag_next or "laptop", None
                obj["by"] = self._cur_tag
            elif t == "pour_done" and obj.get("by") == "laptop":
                obj["by"] = self._cur_tag   # 'laptop' = the AI loop decided it
            self.events = (self.events + [obj])[-50:]
            if t == "pour_done":
                store.add_pour(obj, self.fake)
            if t == "boot" and self.on_boot:
                self.on_boot()              # the chip reset: re-send the timer so pot B keeps the right schedule
            print("[board]", json.dumps(obj))
        for fn in self.listeners:
            try:
                fn(obj)
            except Exception as e:
                print("[board] listener error:", e)


class SerialBoard(BaseBoard):
    def __init__(self, port):
        super().__init__()
        import serial
        self.ser = serial.Serial(port, config.BAUD, timeout=1)
        self.port = port
        self._wlock = threading.Lock()
        threading.Thread(target=self._reader, daemon=True).start()

    @staticmethod
    def find_port():
        from serial.tools import list_ports
        for p in list_ports.comports():
            d = f"{p.description} {p.manufacturer or ''}".lower()
            if any(k in d for k in ("cp210", "ch340", "ch910", "usb serial", "uart", "esp32", "silicon labs")):
                return p.device
        return None

    def _reader(self):
        while True:
            try:
                raw = self.ser.readline().decode("utf-8", "replace").strip()
            except Exception as e:  # unplugged
                self.online = False
                print("[board] serial error:", e)
                time.sleep(2)
                continue
            if not raw.startswith("{"):
                continue            # boot noise from the ESP32 ROM
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError:
                continue
            self.online = True
            self._on_line(obj)

    def send(self, cmd):
        with self._wlock:
            self.ser.write((cmd + "\n").encode())

    def pour(self, pot, ms):
        self.send(f"P {pot} {int(ms)}")

    def set_timer(self, every_s, ms):
        self.send(f"T {int(every_s)} {int(ms)}")

    def stop(self):
        self.send("X")


class FakeBoard(BaseBoard):
    """Two pots drying out in Miami heat. FAKE_SPEED=60 makes 1 real second = 1 fake minute."""
    fake = True

    def __init__(self, speed=None):
        super().__init__()
        self.speed = speed or float(__import__("os").environ.get("FAKE_SPEED", "1"))
        self.m = {"A": 60.0, "B": 60.0}     # percent
        self.soaking = {"A": 0.0, "B": 0.0}  # water poured but not at the probe yet
        self.pouring = None
        self.pinched = False                 # demo: the tube is pinched, pumping moves no water
        self.timer_every_s = 0 if config.ONE_POT else config.TIMER_EVERY_S
        self.timer_ms = config.TIMER_POUR_MS
        self.t_fake = 0.0
        self.last_timer = 0.0
        self.online = True
        threading.Thread(target=self._run, daemon=True).start()

    def _raw(self, pot):
        c = config.load_cal()[pot]
        return int(c["raw_air"] - self.m[pot] / 100 * (c["raw_air"] - c["raw_water"]) + random.uniform(-15, 15))

    def _run(self):
        last_report = -999
        while True:
            dt = 1.0 * self.speed          # fake seconds per real second
            self.t_fake += dt
            hour = (time.localtime().tm_hour + self.t_fake / 3600) % 24
            temp = 27 + 5 * math.sin((hour - 9) / 24 * 2 * math.pi)
            dry_per_h = 1.2 + 0.25 * max(0, temp - 25)        # % per hour, faster when hot
            for p in self.m:
                self.m[p] = max(5.0, self.m[p] - dry_per_h * dt / 3600)
            for p in self.m:                   # water seeps down to the probe at ~0.4 %/s
                move = min(self.soaking[p], 0.4 * dt)
                self.soaking[p] -= move
                self.m[p] = min(95.0, self.m[p] + move)
            if self.pouring:
                pot, left = self.pouring
                step = min(left, dt * 1000)
                ml = step / 1000 * config.load_cal()["flow_ml_per_s"][pot]
                if not self.pinched:
                    self.soaking[pot] += ml * 0.06                 # ~0.06 % per ml in a small pot
                left -= step
                self.pouring = (pot, left) if left > 0 else None
                if not self.pouring:
                    self._on_line(self._pending_done)
            if self.timer_every_s and self.t_fake - self.last_timer >= self.timer_every_s and not self.pouring:
                self.last_timer = self.t_fake
                self._pour("B", self.timer_ms, "timer")
            if self.speed > 1 or self.t_fake - last_report >= 1:   # 1 reading a second, like the real chip
                last_report = self.t_fake
                self._on_line({"type": "reading", "a_raw": self._raw("A"), "b_raw": self._raw("B"),
                               "temp_c": round(temp, 1), "pumping": self.pouring[0] if self.pouring else "none"})
            time.sleep(1)

    def _pour(self, pot, ms, by):
        ms = min(ms, config.POUR_CAP_S * 1000)
        self._on_line({"type": "pour_start", "pot": pot, "ms": ms, "by": by})
        self.pouring = (pot, ms)
        self._pending_done = {"type": "pour_done", "pot": pot, "ran_ms": ms, "by": by, "why": "time_up"}

    def pour(self, pot, ms):
        if self.pouring:
            self._on_line({"type": "refused", "pot": pot, "why": "busy"})
        else:
            self._pour(pot, ms, "laptop")

    def set_timer(self, every_s, ms):
        self.timer_every_s, self.timer_ms = every_s, ms

    def stop(self):
        self.pouring = None


def open_board():
    port = config.SERIAL_PORT
    if port.lower() == "fake":
        return FakeBoard()
    port = port or SerialBoard.find_port()
    if not port:
        raise SystemExit("No ESP32 found. Plug it in (data cable!) or run with SERIAL_PORT=fake.")
    b = SerialBoard(port)
    # Opening the port resets the ESP32. Send the timer on every boot line, plus once after 3 s in case boot was missed.
    # one-pot mode: the chip's pot-B timer is switched OFF (T 0); the timer is counted in software instead
    every, ms = (0, config.TIMER_POUR_MS) if config.ONE_POT else (config.TIMER_EVERY_S, config.TIMER_POUR_MS)
    b.on_boot = lambda: threading.Timer(0.5, b.set_timer, (every, ms)).start()
    threading.Timer(3.0, b.set_timer, (every, ms)).start()
    return b
