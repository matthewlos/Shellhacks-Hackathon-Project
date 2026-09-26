"""Every knob in one place. Override any of these with an env var of the same name."""
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)


def env(name, default, cast=str):
    v = os.environ.get(name)
    return cast(v) if v not in (None, "") else default


# board
SERIAL_PORT = env("SERIAL_PORT", "")            # "" = auto-pick the ESP32, "fake" = simulated board
BAUD = 115200

# where the pots are (FIU, Miami). Open-Meteo weather + drought county use these.
LAT = env("LAT", 25.7566, float)
LON = env("LON", -80.3740, float)
DROUGHT_FIPS = env("DROUGHT_FIPS", "12086")     # Miami-Dade County
ADDRESS_PARITY = env("ADDRESS_PARITY", "odd")   # odd/even street number, for the watering-day rule
OUTDOORS = env("OUTDOORS", 0, int)              # 1 = pots are outside and rain lands on them. 0 = indoors: ignore rain

# moisture band (percent, after calibration)
DRY_PCT = env("DRY_PCT", 35, float)             # below this the plant is thirsty
WET_PCT = env("WET_PCT", 70, float)             # above this never water (hard rule)
TARGET_PCT = env("TARGET_PCT", 55, float)       # what a pour aims for

# hard safety rules. The AI can never break these, they live in code.
POUR_CAP_S = 30                                 # firmware also enforces 30 s
AI_MIN_GAP_MIN = env("AI_MIN_GAP_MIN", 30, float)   # AI can't water pot A twice within this
DAILY_MAX_ML = env("DAILY_MAX_ML", 1500, float)
# 1 = hard-block watering outside the Miami-Dade lawn schedule. Default 0: farms follow ag rules, not the lawn rule,
# and the demo weekend may not be a legal lawn day. The agent still SEES the rule either way.
ENFORCE_WATERING_RULE = env("ENFORCE_WATERING_RULE", 0, int)

# agent loop
CHECK_EVERY_MIN = env("CHECK_EVERY_MIN", 15, float)
GEMINI_MODEL = env("GEMINI_MODEL", "gemini-2.5-flash")   # check the current Flash name in AI Studio
RC_GEMINI_MODEL = env("RC_GEMINI_MODEL", "gemini-3.6-flash")  # right.codes lane (testing). One tool step on 3.6: 7.0 s, 64.4 s, then a 90 s timeout; 3.8 timed out (evidence/lane_speed.log)
AI_TIMEOUT_S = env("AI_TIMEOUT_S", 120, float)   # agent team gets this long, then the rule brain decides
# Laya: our fine-tuned decision model (laya/serve_decider.py). One call, ~20 ms, trained on 2019-24 Miami weather.
LAYA_URL = env("LAYA_URL", "http://127.0.0.1:8091")
USE_LAYA = env("USE_LAYA", 1, int)
USE_LLM = env("USE_LLM", "auto")                # auto = Gemini if a key is set, else rules. "rules" = force rules

# ONE_POT=1 (default): only pot A is real. The "timer" is the schedule a normal sprinkler timer would run,
# counted in software over the same hours (a timer pours the same amount no matter what, so its water use is just math).
# ONE_POT=0: pot B is a real second pot on pin 33 / relay 27, watered by the chip's timer.
ONE_POT = env("ONE_POT", 1, int)
PLANT = env("PLANT", 0, int)                    # 1 = something is growing in the pot. The box model has no plant, so this changes nothing on screen.

# the timer: real pot B in two-pot mode, the virtual baseline in one-pot mode
TIMER_EVERY_S = env("TIMER_EVERY_S", 6 * 3600, int)
TIMER_POUR_MS = env("TIMER_POUR_MS", 5000, int)

CAL_FILE = DATA / "calibration.json"
DEFAULT_CAL = {
    "A": {"raw_air": 3000, "raw_water": 1300},
    "B": {"raw_air": 3000, "raw_water": 1300},
    "flow_ml_per_s": {"A": 20.0, "B": 20.0},   # MEASURE this: run 10 s into a measuring cup
}


def load_cal():
    if CAL_FILE.exists():
        return json.loads(CAL_FILE.read_text())
    return DEFAULT_CAL


def pct(pot, raw, cal=None):
    """Raw probe number -> 0-100 %. Probe reads HIGH when dry."""
    c = (cal or load_cal())[pot]
    span = c["raw_air"] - c["raw_water"]
    return max(0.0, min(100.0, (c["raw_air"] - raw) * 100.0 / span)) if span else None
