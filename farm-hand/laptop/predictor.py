"""'How many hours until this pot is dry?'  XGBoost on the logged readings.

Features (one row per reading): moisture now, how fast it dropped over the last 1 h and 3 h,
soil temp, hour of day (as sin/cos so 23:00 sits next to 00:00).
Label: hours until moisture first falls to DRY_PCT, looking forward in the log (pours cut the window).

Until there are enough real rows to train, predict() falls back to a straight-line estimate
from the recent drop rate and says so ("method": "slope").

  python predictor.py train          # train on data/farmhand.db (real rows only)
  python predictor.py train --fake   # include FakeBoard rows (for testing the code path only)
"""
import math
import sys
import time

import numpy as np

import config
import store

MODEL = config.DATA / "dry_model.json"
FEATS = ["pct", "slope_1h", "slope_3h", "temp_c", "hsin", "hcos"]
MIN_ROWS = 300
SETTLE_S = 600          # ignore the 10 min right after a pour
MAX_SANE_SLOPE = 30     # %/h. Real pots dry a few %/h; faster means the probe moved
_model = None


def _slope(ts, ys, t_now, window_s):
    pts = [(t, y) for t, y in zip(ts, ys) if t_now - window_s <= t <= t_now and y is not None]
    if len(pts) < 3:
        return 0.0
    t = np.array([p[0] for p in pts]) / 3600.0
    y = np.array([p[1] for p in pts])
    return float(np.polyfit(t, y, 1)[0])          # % per hour (negative = drying)


def features(ts, ys, temps, i):
    t_now = ts[i]
    h = time.localtime(t_now).tm_hour + time.localtime(t_now).tm_min / 60
    return [ys[i], _slope(ts, ys, t_now, 3600), _slope(ts, ys, t_now, 3 * 3600),
            temps[i] if temps[i] is not None else 27.0,
            math.sin(h / 24 * 2 * math.pi), math.cos(h / 24 * 2 * math.pi)]


def build_rows(include_fake=False):
    rows = store.q("SELECT ts, a_pct, b_pct, temp_c FROM readings" + ("" if include_fake else " WHERE fake=0") + " ORDER BY ts")
    pours = store.q("SELECT ts, pot FROM pours" + ("" if include_fake else " WHERE fake=0"))
    X, y = [], []
    for col, pot in (((1, "A"),) if config.ONE_POT else ((1, "A"), (2, "B"))):
        ts = [r[0] for r in rows]
        ys = [r[col] for r in rows]
        temps = [r[3] for r in rows]
        pour_ts = sorted(p[0] for p in pours if p[1] == pot)
        for i in range(0, len(rows), 3):                  # every 3rd reading is plenty
            if ys[i] is None or ys[i] <= config.DRY_PCT:
                continue
            next_pour = next((p for p in pour_ts if p > ts[i]), math.inf)
            hit = next((j for j in range(i + 1, len(rows)) if ts[j] < next_pour and ys[j] is not None and ys[j] <= config.DRY_PCT), None)
            if hit is None:
                continue                                   # never reached dry before a pour: no label
            X.append(features(ts, ys, temps, i))
            y.append((ts[hit] - ts[i]) / 3600.0)
    return np.array(X), np.array(y)


def train(include_fake=False):
    import xgboost as xgb
    X, y = build_rows(include_fake)
    if len(y) < MIN_ROWS:
        print(f"only {len(y)} labeled rows, need {MIN_ROWS}. Let the pots dry out longer (overnight run).")
        return None
    idx = np.random.default_rng(0).permutation(len(y))
    cut = int(len(y) * 0.8)
    tr, te = idx[:cut], idx[cut:]
    m = xgb.XGBRegressor(n_estimators=300, max_depth=4, learning_rate=0.05)
    m.fit(X[tr], y[tr])
    mae = float(np.mean(np.abs(m.predict(X[te]) - y[te])))
    base = float(np.mean(np.abs(np.array([_slope_guess(r) for r in X[te]]) - y[te])))
    m.save_model(MODEL)
    print(f"trained on {len(tr)} rows, tested on {len(te)}")
    print(f"XGBoost off by {mae:.2f} h on average | straight-line guess off by {base:.2f} h")
    return {"rows": len(y), "mae_h": mae, "slope_mae_h": base}


def _slope_guess(f):
    pct, s1, s3 = f[0], f[1], f[2]
    s = s1 if s1 < -0.05 else s3
    if s >= -0.05:
        return 48.0
    return max(0.0, (pct - config.DRY_PCT) / -s)


def predict(pot):
    """-> {"hours_until_dry": float, "method": "xgboost"|"slope", "pct_now": ..., "drop_per_h": ...}"""
    global _model
    col = "a_pct" if pot == "A" else "b_pct"
    # Only use readings since the last pour on this pot settled (+10 min): a pour's jump isn't drying.
    last_pour = store.q("SELECT MAX(ts) FROM pours WHERE pot=?", (pot,))[0][0] or 0
    since = max(time.time() - 4 * 3600, last_pour + SETTLE_S)
    rows = store.q(f"SELECT ts, {col}, temp_c FROM readings WHERE ts >= ? ORDER BY ts", (since,))
    if len(rows) < 3:
        return {"error": "not enough readings since the last pour yet", "settling": True}
    ts = [r[0] for r in rows]; ys = [r[1] for r in rows]; temps = [r[2] for r in rows]
    f = features(ts, ys, temps, len(rows) - 1)
    out = {"pot": pot, "pct_now": round(f[0], 1), "drop_per_h": round(-f[1], 2), "dry_at_pct": config.DRY_PCT}
    if abs(f[1]) > MAX_SANE_SLOPE:            # probe pulled out / pushed in, or a jump mid-window: not real drying
        return {**out, "settling": True, "method": "settling"}
    if f[0] <= config.DRY_PCT:
        return {**out, "hours_until_dry": 0.0, "method": "already_dry"}
    if MODEL.exists():
        if _model is None:
            import xgboost as xgb
            _model = xgb.XGBRegressor()
            _model.load_model(MODEL)
        h = float(_model.predict(np.array([f]))[0])
        return {**out, "hours_until_dry": round(max(0.0, h), 1), "method": "xgboost"}
    return {**out, "hours_until_dry": round(min(_slope_guess(f), 48.0), 1), "method": "slope"}


if __name__ == "__main__":
    if sys.argv[1:2] == ["train"]:
        print(train(include_fake="--fake" in sys.argv))
    else:
        print(predict("A"))
