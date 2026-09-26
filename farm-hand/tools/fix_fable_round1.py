"""Fixes from the Fable audit (2026-09-23): stale PLANT text, TAB-mangled evidence paths, overclaim, honest 'over'
message, target.py real-soil hardening (chip refusal, small-pulse false faults, longer flat check)."""
from pathlib import Path
H = Path(__file__).resolve().parent.parent

def patch(rel, reps):
    p = H / rel; s = p.read_text(encoding="utf-8")
    for a, b in reps:
        assert s.count(a) == 1, (rel, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

TAB = chr(9)
patch("PLAN_BODY.md", [
    ("- No plant yet: the 3D view shows bare soil (`PLANT=0`). Set `PLANT=1` if you put grass seed in.",
     "- No plant: the 3D view shows bare soil in the box. The box model has no plant, so there's nothing to switch on."),
    ("evidence" + TAB + "eam.log", "evidence\\team.log"),
    ("evidence" + TAB + "eam_timing.log", "evidence\\team_timing.log"),
    ("5. Stop when it's within 1% below the target. It can't take water back out, so it creeps up and never jumps past.",
     "5. Stop when it's within 1% below the target. It can't take water back out, so each pulse aims at 70% of the gap and it rarely goes past. If it does, the run ends as \"over\" and says the last pulse overshot."),
    ("Impeccable design detector: 0 findings.", "Impeccable design detector: 0 findings (`evidence/design_detector.json`)."),
])
patch("laptop/config.py", [
    ("# 1 = something is growing in the pot (shows grass + roots in the 3D view)",
     "# 1 = something is growing in the pot. The box model has no plant, so this changes nothing on screen."),
])
patch("laptop/target.py", [
    ("FLAT = 0.4            # two 6-reading medians this close = the reading stopped moving",
     "FLAT = 0.4            # two 10-reading medians this close = the reading stopped moving"),
    ("MISS_SHARE = 0.3      # a pulse that did under 30% of what the learned rate expects didn't reach the soil",
     "MISS_SHARE = 0.3      # a pulse that did under 30% of what the learned rate expects didn't reach the soil\n"
     "CHECKABLE = 3.0       # only judge \"water isn't arriving\" on pulses expected to add 3%+ (small ones drown in probe noise)"),
    ("        v = _vals(12)\n        if time.time() - t1 >= MIN_SETTLE_S and len(v) >= 12:\n            a, b = statistics.median(v[:6]), statistics.median(v[6:])",
     "        v = _vals(20)\n        if time.time() - t1 >= MIN_SETTLE_S and len(v) >= 20:\n            a, b = statistics.median(v[:10]), statistics.median(v[10:])"),
    ("                return _end(\"locked\" if now <= target + BAND else \"over\",\n"
     "                            f\"Locked at {now}%, target {target}%.\" if now <= target + BAND\n"
     "                            else f\"Soil is {now}%, already above the {target}% target. Water can't be taken back out.\")",
     "                return _end(\"locked\" if now <= target + BAND else \"over\",\n"
     "                            f\"Locked at {now}%, target {target}%.\" if now <= target + BAND\n"
     "                            else (f\"Overshot: the last pulse took the soil to {now}%, past the {target}% target.\" if run[\"pulses\"]\n"
     "                                  else f\"Soil is {now}%, already above the {target}% target. Water can't be taken back out.\"))"),
    ("            brain.BOARD.pour(\"A\", int(secs * 1000))\n            run[\"phase\"] = \"settling\"",
     "            sent = time.time()\n"
     "            brain.BOARD.pour(\"A\", int(secs * 1000))\n"
     "            ev = None\n"
     "            while ev is None and time.time() - sent < 3:           # did the chip actually start the pump?\n"
     "                ev = next((e for e in brain.BOARD.events[::-1] if e.get(\"ts\", 0) >= sent - .5\n"
     "                           and e.get(\"type\") in (\"pour_start\", \"refused\")), None)\n"
     "                if ev is None and _wait(.2):\n"
     "                    return _end(\"stopped\", \"Stopped.\")\n"
     "            if ev is None or ev[\"type\"] == \"refused\":\n"
     "                return _end(\"blocked\", \"The chip didn't start the pump (\" + (ev or {}).get(\"why\", \"no answer\") + \"). No water went in.\")\n"
     "            run[\"phase\"] = \"settling\""),
    ("            need = max(MISS_RISE, MISS_SHARE * rate * secs)",
     "            expect = rate * secs\n            need = max(MISS_RISE, MISS_SHARE * expect) if expect >= CHECKABLE else 0.0"),
    ("            if rise < need:\n", "            if need and rise < need:\n"),
    ("            rate = round(.5 * rate + .5 * rise / secs, 3)  # learn: blend what it expected with what it just saw",
     "            if rise >= MISS_RISE:                            # a tiny pulse's rise is mostly noise: don't learn from it\n"
     "                rate = round(.5 * rate + .5 * rise / secs, 3)  # learn: blend what it expected with what it just saw"),
    ("\"ok\": rise >= need,", "\"ok\": rise >= max(need, MISS_RISE),"),
])
print("ok")
