"""SQLite log of everything: readings, pours, AI decisions. This file IS the water-saved proof."""
import os
import sqlite3
import threading
import time

from config import DATA

# fake runs get their own file so test data can never leak into the real water-saved number
DB = DATA / ("farmhand_fake.db" if os.environ.get("SERIAL_PORT", "").lower() == "fake" else "farmhand.db")
DB = DATA / os.environ["FARMHAND_DB"] if os.environ.get("FARMHAND_DB") else DB   # a second dev server gets its own file
_lock = threading.Lock()
_con = sqlite3.connect(DB, check_same_thread=False)
_con.executescript("""
CREATE TABLE IF NOT EXISTS readings (ts REAL, a_raw INT, b_raw INT, a_pct REAL, b_pct REAL, temp_c REAL, fake INT);
CREATE TABLE IF NOT EXISTS pours (ts REAL, pot TEXT, ran_ms INT, by TEXT, why TEXT, fake INT);
CREATE TABLE IF NOT EXISTS decisions (ts REAL, action TEXT, seconds REAL, brain TEXT, sentence TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS r_ts ON readings(ts);
CREATE TABLE IF NOT EXISTS soaks (ts REAL, pot TEXT, poured_s REAL, before_pct REAL, peak_pct REAL, rise_pct REAL,
                                  first_rise_s REAL, pct_per_s REAL, ok INT, note TEXT, fake INT);
""")


def q(sql, args=()):
    with _lock:
        cur = _con.execute(sql, args)
        rows = cur.fetchall()
        _con.commit()
        return rows


def add_reading(r, fake):
    q("INSERT INTO readings VALUES (?,?,?,?,?,?,?)",
      (time.time(), r["a_raw"], r["b_raw"], r["a_pct"], r["b_pct"], r.get("temp_c"), int(fake)))


def add_pour(e, fake):
    q("INSERT INTO pours VALUES (?,?,?,?,?,?)", (time.time(), e["pot"], e["ran_ms"], e["by"], e["why"], int(fake)))


def add_decision(action, seconds, brain, sentence, detail=""):
    q("INSERT INTO decisions VALUES (?,?,?,?,?,?)", (time.time(), action, seconds, brain, sentence, detail))


def readings_since(ts):
    return q("SELECT ts, a_pct, b_pct, temp_c FROM readings WHERE ts >= ? ORDER BY ts", (ts,))


def pours_since(ts):
    return q("SELECT ts, pot, ran_ms, by, why FROM pours WHERE ts >= ? ORDER BY ts", (ts,))


def last_ai_pour_ts():
    r = q("SELECT MAX(ts) FROM pours WHERE pot='A'")
    return r[0][0] or 0


def decisions(limit=20):
    return q("SELECT ts, action, seconds, brain, sentence FROM decisions ORDER BY ts DESC LIMIT ?", (limit,))


def add_soak(d, fake):
    q("INSERT INTO soaks VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      (time.time(), d["pot"], d["poured_s"], d["before_pct"], d["peak_pct"], d["rise_pct"],
       d["first_rise_s"], d["pct_per_s"], int(d["ok"]), d["note"], int(fake)))


def soaks(limit=10):
    return q("SELECT ts, pot, poured_s, before_pct, peak_pct, rise_pct, first_rise_s, pct_per_s, ok, note FROM soaks "
             "ORDER BY ts DESC LIMIT ?", (limit,))
