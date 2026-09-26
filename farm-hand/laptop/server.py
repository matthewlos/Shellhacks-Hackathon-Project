"""Run everything: board link + agent loop every CHECK_EVERY_MIN + dashboard at http://127.0.0.1:8080

  python server.py                    # real ESP32 (auto-finds the USB port)
  SERIAL_PORT=fake python server.py   # no hardware: simulated pots (FAKE badge on the dashboard)
"""
import threading
import time
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import board
import brain
import config
import feeds
import predictor
import report
import soak
import store
import target

app = FastAPI()
B = board.open_board()
brain.BOARD = B
WATCH = soak.SoakWatcher(B, speed=getattr(B, 'speed', 1.0))
STARTED = time.time()
_state = {"next_check": time.time() + 60, "last": None}


def loop():
    time.sleep(20)                                   # let a few readings land first
    while True:
        try:
            _state["last"] = brain.check_now()
        except Exception as e:
            print("[loop] check failed:", e)
        _state["next_check"] = time.time() + config.CHECK_EVERY_MIN * 60
        while time.time() < _state["next_check"]:
            time.sleep(1)


@app.get("/api/state")
def state():
    return {"fake": B.fake, "online": B.online, "latest": B.latest, "events": B.events[-8:],
            "brain": brain.which_brain(), "next_check_s": round(_state["next_check"] - time.time()),
            "forecast": feeds.forecast(), "drought": feeds.drought(), "watering": feeds.watering_day(),
            "config": {"dry": config.DRY_PCT, "wet": config.WET_PCT, "target": config.TARGET_PCT,
                       "check_every_min": config.CHECK_EVERY_MIN, "outdoors": bool(config.OUTDOORS), "one_pot": bool(config.ONE_POT)},
            "prediction": predictor.predict("A"), "guards": brain.guard_report(),
            "learned_pct_per_s": soak.learned_pct_per_s("A"), "uptime_s": round(time.time() - STARTED),
            "last": brain.LAST}


@app.get("/api/live")
def live():
    """Fast poll (every 0.5 s) for the 3D view: moisture, pump, soak front, which agents are busy."""
    now = time.time()
    busy = {}
    for a in list(brain.ACTIVITY):
        if now - a["ts"] < 6:
            busy[a["agent"]] = a["what"]
    L = B.latest or {}
    return {"a": L.get("a_pct"), "b": L.get("b_pct"), "temp": L.get("temp_c"), "pumping": L.get("pumping", "none"),
            "soak": dict(soak.live), "target": dict(target.run), "busy": busy, "fake": B.fake,
            "pinched": getattr(B, "pinched", False), "last": brain.LAST,
            "hand": dict(soak.hand), "wet_skip_above": config.DRY_PCT + brain.LOW_MARGIN, "target_pct": config.TARGET_PCT,
            "cfg": {"flow": config.load_cal()["flow_ml_per_s"]["A"], "dry": config.DRY_PCT, "wet": config.WET_PCT, "one_pot": bool(config.ONE_POT), "plant": bool(config.PLANT)}}


@app.get("/api/activity")
def activity():
    return list(brain.ACTIVITY)[-40:][::-1]


@app.post("/api/ask")
def ask(body: dict):
    return {"answer": brain.ask(str(body.get("q", ""))[:500])}


@app.get("/api/soaks")
def soaks():
    return [dict(zip(("ts", "pot", "poured_s", "before_pct", "peak_pct", "rise_pct", "first_rise_s", "pct_per_s", "ok", "note"), r))
            for r in store.soaks(10)]


@app.get("/api/history")
def history(hours: float = 6):
    return {"readings": store.readings_since(time.time() - hours * 3600),
            "pours": store.pours_since(time.time() - hours * 3600)}


@app.get("/api/decisions")
def decisions():
    return [dict(zip(("ts", "action", "seconds", "brain", "sentence"), r)) for r in store.decisions(20)]


@app.get("/api/report")
def rep(hours: float = 0):
    return report.report(hours or None, include_fake=B.fake)


@app.post("/api/check-now")
def check_now():
    return brain.check_now()                          # demo button: run the agents right now


@app.post("/api/pour")
def pour(body: dict):
    """Manual test pour on pot A (teaches the pour detector on day 1). Goes through the same guards as the AI."""
    secs = max(1.0, min(float(body.get("seconds", 5)), config.POUR_CAP_S))
    r = brain.water_pot(secs, "manual test pour from the dashboard", tag="manual")
    brain.log_act("executor", f"manual test pour {secs:.0f}s" if r["watered"] else "manual pour refused")
    return r


@app.post("/api/demo/dry")
def demo_dry():
    """FAKE board only: dry pot A out instantly so the demo doesn't wait hours."""
    if not B.fake:
        return {"ok": False, "why": "real board: pull the probe out of the soil instead"}
    B.m["A"] = config.DRY_PCT + 1
    return {"ok": True}


@app.post("/api/target")
def hit_target(body: dict):
    """Hit the Target: pulse pot A up to body["pct"] and stop inside +/- 2%."""
    return target.start(body.get("pct", config.TARGET_PCT))


@app.post("/api/demo/handpour")
def demo_handpour():
    """FAKE board only: a judge pours a cup in by hand (no pump). The probe climbs over ~20 s, like real water soaking in."""
    if not B.fake:
        return {"ok": False, "why": "real board: pour a little water on the soil by the probe"}
    B.soaking["A"] += 9
    return {"ok": True}


@app.get("/api/series")
def series(hours: float = 24):
    """The money graph: moisture + temperature over time (bucketed), every pour, and the virtual timer's schedule."""
    now = time.time()
    since = now - hours * 3600 if hours else 0             # hours=0 = everything logged
    rows = store.readings_since(since)
    n = 240
    pts = []
    if rows:
        t0, t1 = rows[0][0], rows[-1][0]
        step = max(1.0, (t1 - t0) / n)
        buck = {}
        for ts, a, _b, temp in rows:
            buck.setdefault(int((ts - t0) // step), []).append((ts, a, temp))
        for k in sorted(buck):
            g = buck[k]
            tv = [x[2] for x in g if x[2] is not None]
            pts.append([round(sum(x[0] for x in g) / len(g), 1), round(sum(x[1] for x in g) / len(g), 2),
                        round(sum(tv) / len(tv), 2) if tv else None])
    flow = config.load_cal()["flow_ml_per_s"]["A"]
    pours = [{"ts": ts, "s": ms / 1000, "ml": round(ms / 1000 * flow), "by": by} for ts, pot, ms, by, _w in store.pours_since(since) if pot == "A"]
    timer = []
    if rows and config.ONE_POT and config.TIMER_EVERY_S:      # same schedule report.py counts: first reading + every TIMER_EVERY_S
        k, t0 = 1, rows[0][0]
        while t0 + k * config.TIMER_EVERY_S <= rows[-1][0]:
            timer.append({"ts": t0 + k * config.TIMER_EVERY_S, "s": config.TIMER_POUR_MS / 1000, "ml": round(config.TIMER_POUR_MS / 1000 * flow)}); k += 1
    return {"points": pts, "pours": pours, "timer": timer, "rate": soak.learned_pct_per_s("A"), "hours": hours,
            "report": report.report(hours or None, include_fake=B.fake), "fake": B.fake,
            "band": [config.DRY_PCT, config.WET_PCT], "target": config.TARGET_PCT}


@app.post("/api/demo/pinch")
def demo_pinch():
    """FAKE board only: pinch / unpinch the tube, so the pump runs but no water reaches the soil."""
    if not B.fake:
        return {"ok": False, "why": "real board: pinch the real tube with your fingers"}
    B.pinched = not B.pinched
    return {"ok": True, "pinched": B.pinched}


@app.post("/api/stop")
def stop():
    target.stop()
    B.stop()
    return {"stopped": True}


# the page, scene.js and models/farmhand.glb (mounted last so the /api routes win)
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")


if __name__ == "__main__":
    threading.Thread(target=loop, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=int(__import__("os").environ.get("PORT", 8080)), log_level="warning")
