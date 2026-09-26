"""One-time: bring PLAN_BODY.md up to date (Mainstays box model, Hit the Target, pinch test, current layout)."""
from pathlib import Path
H = Path(__file__).resolve().parent.parent
p = H / "PLAN_BODY.md"; s = p.read_text(encoding="utf-8")

def cut(a, b):
    """Return the text from heading a up to heading b."""
    i, j = s.index(a), s.index(b)
    return s[i:j]

reps = [
("    soak.py                   <- pour detector: what each pour actually did to the soil (the system learns from it)\n",
 "    soak.py                   <- pour detector: what each pour actually did to the soil (the system learns from it)\n"
 "    target.py                 <- Hit the Target: pulse the soil up to a picked % and stop on it (the live demo)\n"),
("    static/index.html         <- dashboard: the call on the left, 3D pot in the middle, agent team on the right\n",
 "    static/index.html         <- dashboard: the 3D pot on the left, the call + target + agent team on the right\n"),
(cut("## 5b. The live view", "## 6. Hackathon plan"), """## 5b. The live view: the Farm Hand dashboard

House style (the `visual-page` tokens): light theme, blue = the AI and the agents, orange = the timer, Bricolage Grotesque / Atkinson Hyperlegible Next / JetBrains Mono (numbers only).

The 3D model is built in Blender, not drawn by hand in code:
- `blender/build_farmhand.py` builds it and exports `laptop/static/models/farmhand.glb`. Run it headless: `blender -b --factory-startup --python blender/build_farmhand.py` (or through the Blender MCP socket with `blender/mcp_send.py`, port 9876).
- It's the real pot: a **Mainstays Deep Rectangle** food storage box (see-through frosted plastic, slanted sides, rolled rim), with the blue lid upside down behind it. The size is an ESTIMATE (27 x 18 x 11 cm). Measure the real box and set `L, W, HC` at the top of `build_farmhand.py`.
- Soil uses a scanned soil texture (Poly Haven `farm_soil`, CC0), with crumbs and white perlite on top. The probe is a textured copy of the capacitive v1.2 board, pressed against the front wall so you see it through the plastic, with its 3 jumper wires.
- Parts the page drives live: `Soil` (moisture shader, colors by depth), `WaterFront` (slides down while a pour soaks in), `ProbeLED` (green ok, red dry, blue pumping), `Rim` (glows while the agents work), `Nozzle` (drops fall while the pump runs).
- `laptop/static/scene.js` loads it with three.js: studio lighting from an HDRI (Poly Haven `ferndale_studio_03`, CC0), real see-through plastic (MeshPhysicalMaterial transmission), soft shadow.

Layout: the 3D pot fills the left, the control column sits on the right.
- **Top right, the call:** "Watering 16 s" / "Holding off" / "Hit 54.6%", the reason, which brain decided and how long ago. Buttons: **Run agents**, **Test pour 5 s** (same safety rules as the AI), **Stop pump**.
- **Hit a target:** a - 55% + picker and **Go** (section 5c). Pulse chips show each pulse ("8 s +9.4%").
- **Numbers:** soil moisture with the healthy band, water saved vs the timer, dries out in, rain, evaporation, county drought.
- **Agent team tab:** dry-time model, the 3 gatherers, planner, critic, safety rules, pump, pour detector, target controller. Each lights up blue while it works. Blocking safety rules show in red, then a log of every step. Tabs: **Pours** (what each pour did + learned rate) and **Ask** (Gemini chat).
- **On the 3D stage during a target run:** a big live readout (now %, target, a bar with the target mark). Green when it locks, red when it stops.

Screenshots (fake board): `laptop\\data\\v14_mainstays.png` (the box), `v15_target_mid.png`, `v15_target_done.png`, `v15_target_phone.png`. Impeccable design detector: 0 findings.

Honesty labels on screen:
- the depth shading and the sinking water band are a model ("by depth, modeled from one probe"). Only the probe % is measured.
- the dry-time model label says "trend estimate" until XGBoost is trained on real runs
- the fake board says "Running on test data from the simulated board" at the top

## 5c. Hit the Target (the live wow)

A judge picks a moisture % (36-68). Farm Hand walks the soil up to it in short pulses and stops on it. Code: `laptop/target.py`, button **Go**, API `POST /api/target {"pct": 55}`.

Each pulse:
1. Read the soil (median of the last 6 readings, so probe noise can't fool it).
2. Size the pulse from the learned rate: seconds = gap / (% per second) x 0.7, so it creeps up instead of overshooting. Max 8 s a pulse.
3. Pump, then wait until the water reaches the probe and the reading goes flat (12-90 s).
4. Measure what that pulse really did and update the learned rate (this soil + this pump, learned live).
5. Stop when it's within 1% below the target. It can't take water back out, so it creeps up and never jumps past.

The pinch test (catch it lying): pinch the tube, press Go. The pump runs, but the probe doesn't move. After one pulse it stops and says: "The pump ran 8.0 s, that should add about 9.3%, but the probe moved +0.1%. Water isn't reaching the soil." On the fake board, use the **Pinch the tube (test)** link.

Safety: every pulse still goes through `guards()`: board online, not already wet, daily water cap, last pour done soaking. The only rule it skips is the 30-minute gap between AI pours, because a person started it and is standing at the pot. While a target run is going, the AI loop can't pour.

Tested on the fake board (`evidence/target_run.log`, `evidence/target_fault.log`):
- target 55%: 35.7% -> 54.7% in 3 pulses (8 s, 5.7 s, 1.6 s), 15.3 s of pumping, 306 ml, 76 s
- pinched tube: stopped after pulse 1, probe moved +0.1% when about 9.3% was expected, 91 s

⚠️ The daily water cap is 1500 ml (`DAILY_MAX_ML`). One target run uses about 300 ml, so about 5 demo runs a day before the cap blocks it. That's a lot of water for this box. Either dump water out between demos (tip the box over a sink), or set `DAILY_MAX_ML` higher for demo day.
⚠️ Real soil is slower and messier than the fake board. Do 3 practice runs on the real box on Sep 23 and write down the pulse count and time.

"""),
(cut("## 7. Demo (2 minutes)", "## 8. Judge questions"), """## 7. Demo (2 minutes)

1. **Hook (15 s):** "A state famous for rain is limiting people to watering once a week. Right now 100% of Miami-Dade is in drought." (Drought Monitor, week of Sep 15)
2. **Farmer (15 s):** "A Chiefland farmer checks soil probes by hand to decide when to water. A Gainesville blueberry farm lost 70% of its crop while watering every day." (WCJB, Alligator)
3. **Hit the Target (45 s):** hand the judge the - / + picker. "Pick a number." Press Go. The agent team lights up, water drops in the 3D view, the real box gets wet, and the big number on screen climbs pulse by pulse and locks on their number. Read the receipt: pulses, seconds, ml.
4. **Catch it lying (20 s):** "Now pinch the tube." Press Go. The pump runs, nothing arrives, and it stops itself and says the water isn't reaching the soil. "A timer would have kept pouring into nothing."
5. **Brain (15 s):** "A team of Gemini agents. Weather, soil and memory run in parallel. A planner proposes, a critic checks its math and can send it back. The pump only runs if code-level safety rules agree, and it learns from every pour." Press Run agents in the background during step 3 if the Gemini lane is fast enough.
6. **Number + cost (10 s):** "Over X hours, the AI used Y% less water than the timer." (from report.py, real run only) "Farm moisture probes cost $100-500. Ours cost $2.60."

"""),
("- **\"Does it scale?\"**", "- **\"Isn't hitting a number just a thermostat?\"** \"A thermostat knows how much one burst does. We don't, every soil is different. It learns the soil's rate live from each pulse, and it notices when water stops arriving.\"\n- **\"Does it scale?\"**"),
]
for a, b in reps:
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
p.write_text(s, encoding="utf-8")

bp = H / "build_plan.py"; t = bp.read_text(encoding="utf-8")
a = '    ("laptop/soak.py", "python"),\n'
if '"laptop/target.py"' not in t:
    t = t.replace(a, a + '    ("laptop/target.py", "python"),\n'); bp.write_text(t, encoding="utf-8")
print("ok")
