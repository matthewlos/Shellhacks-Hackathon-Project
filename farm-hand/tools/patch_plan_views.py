"""Add the 2026-09-24 views to PLAN_BODY.md section 5b (before the Screenshots line), then run build_plan.py."""
import pathlib
p = pathlib.Path(__file__).resolve().parents[1] / "PLAN_BODY.md"
s = p.read_text(encoding="utf-8")
anchor = "Screenshots (fake board): `laptop"
assert s.count(anchor) == 1 and "New views (2026-09-24)" not in s
add = r'''**New views (2026-09-24), code in `laptop/static/views.js`:**
- **Soil over time (the money graph)**, under the 3D box: moisture (blue, measured), a dashed orange "if a timer watered" line (estimated: the measured line minus what the AI's own pours added, plus what the timer's 5 s every 6 h would have added, using the learned % per pump second), and soil temperature (purple, measured) in its own panel under it. Dots mark AI pours and timer pours. Hover shows every value. Window: 1 h / 6 h / 24 h / All. API: `GET /api/series?hours=24`.
- **Cups saved** next to it, from `report.py` (1 cup = 236.6 ml). Test pours and target demos still count against the AI, so on demo day it can read "Timer used less so far" in red. It says so honestly.
- **Soil temperature** is now a big number next to moisture (right column).
- **Fast + smart strip** under the call: Laya's pick, how sure, and how many ms it took, then the Gemini team's time to explain (live seconds while it thinks). A Run agents with Gemini now calls Laya first so its call lands on screen instantly. Seen on the fake board: Laya 311 ms, team 37 s.
- **Someone added water banner:** `soak.py` watches for a +4% jump with the pump quiet for 4 min. Banner: "Someone just added water. +9.6%. Soil's at 69.6% now, so I'm skipping my next watering." (says "my next pour will be smaller" if the soil is still at or under 40%, the line where the AI waters). Fake board: **Pour a cup in by hand (test)** link, `POST /api/demo/handpour`.
- **A whole field** toggle on the stage: zooms out from the box to a farm with a probe every few rows. Labeled ILLUSTRATION. Only the ringed dot is live (this box's % and °C).
- Second dev server without touching the main one: `set PORT=8081 & set FARMHAND_DB=farmhand_dev.db & set SERIAL_PORT=fake`. Screenshots: `python tools/shot_views.py 8081 v19 --hand` -> `laptop\data\v19_*.png`.

'''
p.write_text(s.replace(anchor, add + anchor), encoding="utf-8")
print("ok")
