"""Tag every laptop pour by who asked for it (ai / manual / target), show the demo water in the report and on the
dashboard, and give target-run decisions their own headline. Demo water still counts against the AI (conservative)."""
from pathlib import Path
H = Path(__file__).resolve().parent.parent

def patch(rel, reps):
    p = H / rel; s = p.read_text(encoding="utf-8")
    for a, b in reps:
        assert s.count(a) == 1, (rel, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

patch("laptop/board.py", [
    ("        self.on_boot = None\n",
     "        self.on_boot = None\n"
     "        self.tag_next = None        # who asked for the next laptop pour: 'manual' (test pour) or 'target' (demo run)\n"
     "        self._cur_tag = \"laptop\"\n"),
    ("        else:\n            obj[\"ts\"] = time.time()\n",
     "        else:\n            obj[\"ts\"] = time.time()\n"
     "            if t == \"pour_start\" and obj.get(\"by\") == \"laptop\":\n"
     "                self._cur_tag, self.tag_next = self.tag_next or \"laptop\", None\n"
     "                obj[\"by\"] = self._cur_tag\n"
     "            elif t == \"pour_done\" and obj.get(\"by\") == \"laptop\":\n"
     "                obj[\"by\"] = self._cur_tag   # 'laptop' = the AI loop decided it\n"),
])
patch("laptop/target.py", [
    ("            brain.BOARD.pour(\"A\", int(secs * 1000))\n            ev = None",
     "            brain.BOARD.tag_next = \"target\"\n            brain.BOARD.pour(\"A\", int(secs * 1000))\n            ev = None"),
    ("and e.get(\"pot\") == \"A\" and e.get(\"type\") in (\"pour_start\", \"refused\")), None)",
     "and e.get(\"pot\") == \"A\" and e.get(\"type\") in (\"pour_start\", \"refused\")), None)   # FakeBoard/firmware both tag pot"),
])
patch("laptop/brain.py", [
    ("def water_pot(seconds, reason):\n    ok, why, secs = guards(seconds)",
     "def water_pot(seconds, reason, tag=None):\n    ok, why, secs = guards(seconds)"),
    ("    BOARD.pour(\"A\", int(secs * 1000))\n    _last_action.update(action=\"water\"",
     "    BOARD.tag_next = tag\n    BOARD.pour(\"A\", int(secs * 1000))\n    _last_action.update(action=\"water\""),
])
patch("laptop/server.py", [
    ("    r = brain.water_pot(secs, \"manual test pour from the dashboard\")",
     "    r = brain.water_pot(secs, \"manual test pour from the dashboard\", tag=\"manual\")"),
])
patch("laptop/report.py", [
    ("    pours = store.q(f\"SELECT ts, pot, ran_ms FROM pours WHERE ts >= ?{fake}\", (since,))",
     "    pours = store.q(f\"SELECT ts, pot, ran_ms, by FROM pours WHERE ts >= ?{fake}\", (since,))"),
    ("    n = {p: sum(1 for r in pours if r[1] == p) for p in \"AB\"}\n",
     "    n = {p: sum(1 for r in pours if r[1] == p) for p in \"AB\"}\n"
     "    # test pours and Hit-the-Target demos: still counted in the AI's water (never flatters it), shown separately\n"
     "    demo_ml = sum(r[2] for r in pours if r[1] == \"A\" and r[3] in (\"manual\", \"target\")) / 1000 * flow[\"A\"]\n"),
    ("        \"ai_pot_ml\": round(ml[\"A\"]), \"timer_pot_ml\": round(ml[\"B\"]),",
     "        \"ai_pot_ml\": round(ml[\"A\"]), \"timer_pot_ml\": round(ml[\"B\"]), \"ai_pot_demo_ml\": round(demo_ml),"),
])
patch("laptop/static/index.html", [
    ("    const x = dec[0], water = x.action === 'water';\n"
     "    $('verdict').textContent = water ? `Watering ${(+x.seconds).toFixed(0)} s` : 'Holding off';\n"
     "    $('verdict').className = 'verdict' + (water ? ' water' : '');",
     "    const x = dec[0], tr = x.brain === 'target run', water = x.action === 'water' && !tr, hit = tr && /^TARGET: Locked/.test(x.sentence);\n"
     "    $('verdict').textContent = tr ? (hit ? 'Target hit' : 'Target run stopped') : water ? `Watering ${(+x.seconds).toFixed(0)} s` : 'Holding off';\n"
     "    $('verdict').className = 'verdict' + (hit ? ' good' : water ? ' water' : '');"),
    ("  $('savedSub').innerHTML = `AI <b class=\"num\" style=\"color:var(--ai)\">${rep.ai_pot_ml} ml</b> vs timer <b class=\"num\" style=\"color:var(--timer)\">${rep.timer_pot_ml} ml</b>`;",
     "  $('savedSub').innerHTML = `AI <b class=\"num\" style=\"color:var(--ai)\">${rep.ai_pot_ml} ml</b> vs timer <b class=\"num\" style=\"color:var(--timer)\">${rep.timer_pot_ml} ml</b>`\n"
     "    + (rep.ai_pot_demo_ml ? `<br>${rep.ai_pot_demo_ml} ml of the AI's was test pours and demos` : '');"),
])
print("ok")
