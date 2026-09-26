# Farm Hand: ShellHacks build plan

**Goal:** one pot of soil, watered by Gemini agents. Show the judges how much less water it used than a normal sprinkler timer during Florida's drought.

**One-pot mode is the default (Dechante 2026-09-23).**
- Only one real pot: Soil probe A on pin 32, Relay 1 on pin 26, Pump A. Wire nothing on pins 33 / 27.
- The "timer" is virtual. A timer pours the same amount on a schedule no matter what, so its water use is just math: `TIMER_POUR_MS` every `TIMER_EVERY_S`, at pot A's measured flow. Default: 5 s every 6 h = 100 ml a pour at 20 ml/s.
- Water saved = virtual timer ml minus AI ml, over the same logged hours. Only full timer intervals count, so early on it says "not enough data yet" instead of flattering the AI.
- The chip's own pot-B timer is switched off (`T 0`) on every boot.
- You lose the side-by-side proof that a timer pot gets soggy. The pitch is "same healthy soil, less water".
- No plant: the 3D view shows bare soil in the box. The box model has no plant, so there's nothing to switch on.
- Want the old two-pot test back? Start the server with `ONE_POT=0`. Everything below that talks about Pot B applies only then.
- To get results fast: a small cup of sandy mix with a fan on it dries in hours instead of days.

Written 2026-09-22. Parts arrive 2026-09-23.

- Everything in this folder: `Documents\code\shellhacks2025\farm-hand\`
- News and facts for the pitch: `shellhacks2025\farm_hand_florida_facts.md`

---

## 0. What's in the folder

```
farm-hand/
  PLAN.md                     <- this file (built by build_plan.py, code appendix is auto-copied, never stale)
  firmware/farm_hand/      <- ESP32 code (C++). Reads soil, runs pumps, enforces the 30 s cap.
  laptop/                     <- Python. Board link, weather, drought, predictor, Gemini agents, dashboard.
    server.py                 <- run this. Dashboard at http://127.0.0.1:8080
    calibrate.py              <- Sep 23: calibrate probes + measure pump flow
    report.py                 <- THE NUMBER: water used A vs B, time healthy
    predictor.py              <- XGBoost "hours until dry"
    brain.py                  <- Gemini agent team (ADK) + farm chat + rule brain fallback + hard safety rules
    soak.py                   <- pour detector: what each pour actually did to the soil (the system learns from it)
    target.py                 <- Hit the Target: pulse the soil up to a picked % and stop on it (the live demo)
    static/index.html         <- dashboard: the 3D pot on the left, the call + target + agent team on the right
    static/scene.js           <- three.js: loads the Blender model and drives it live
    static/models/farmhand.glb <- the 3D model (built in Blender by blender/build_farmhand.py)
  blender/                    <- Blender scripts: build the model through the Blender MCP, render a preview
    feeds.py                  <- Open-Meteo rain forecast, US Drought Monitor, watering-day rule
    board.py                  <- USB serial to the ESP32 (+ FakeBoard for testing without parts)
  evidence/                   <- saved proof for every test claim in section 11 (+ the scripts that made it)
  ../wokwi/                   <- browser simulation of the wiring (wokwi.com)
```

## 1. Parts

Arriving Sep 23 (Amazon, $72.94):

| Part | Used for |
|---|---|
| ELEGOO ESP32 3-pack | the brain board (2 spares) |
| ELEGOO Fun Kit | breadboard, jumper wires, the PN2222 transistor + 1K resistor (relay driver) |
| Songhe capacitive soil sensors (5) | Pot A + Pot B probes, 3 spares |
| DROK DS18B20 probes (5) | soil temperature |
| SIPYTOPF 4 pumps + tubing | Pump A + Pump B. **Bare wires: no cutting, no stripping.** |
| AEDIKO 1-channel relay 4-pack | Relay 1 + Relay 2 (2 spares) |

To buy next (owner 2026-09-24, Micro Center Miami; check stock on their site first):
- **Water flow sensor, 3-pack.** Measures the real ml the pump pushes, so "water used" and "water saved" become MEASURED, not flow-rate estimates (the #1 judge question). Pick a small-flow model: the mini pump moves about 20 ml/s (1.2 L/min), and the common YF-S201 only reads from about 1 L/min, so prefer a **YF-S401 / YF-S402 style (about 0.3-6 L/min)** whose barbs fit the pump tube. ⚠️ These output 5 V pulses: the signal needs a 2-resistor divider (e.g. 10k + 20k) down to 3.3 V before an ESP32 pin. Not wired or coded yet.
- **Small screen for the box: 0.96" OLED (SSD1306, I2C).** Shows moisture + temp live on the box itself. Not wired or coded yet.
- Next in software: phone alerts ("soil dropped, watered 12 s", "someone added water by hand", "pump ran but the soil didn't rise"). The detectors exist (pinch test, hand-pour); sending them to a phone is not built.

You need at home:
- a **USB-C DATA cable** (charge-only cables = "board not found")
- the pot: a **Mainstays Deep Rectangle food storage container** (clear frosted plastic, blue lid, Walmart 3-pack), filled ~9.5 cm deep with potting mix. The 3D model is built to this box (size estimated, set `L, W, HC` in `blender/build_farmhand.py` once measured). Push the probe against the front wall so judges can see it through the plastic.
- potting mix (one-pot mode needs no plant; 2-pot mode: 2 boxes + 2 of the same plant or grass seed)
- 2 water cups/bowls for the pumps to sit in, a measuring cup (ml)

## 2. Wiring (the real build, proven 2026-09-23)

Step-by-step pictures of every wire: **http://127.0.0.1:8097/assemble** (start `tools/power_page.py`; file: `docs/assemble/index.html`).

One pot. Everything runs off the laptop's USB. No power module, no 9V adapter.

| From | To | Wire |
|---|---|---|
| ESP32 VIN (right side, top, next to USB; printed like "VN") | Relay DC+ screw | F-M |
| ESP32 GND (right side, 2nd pin) | Relay DC− screw | F-M |
| Transistor PN2222, flat side facing you | Bottom half, row next to the bottom rail: LEFT leg (E) col 22, MIDDLE (B) col 21, RIGHT (C) col 20 | part |
| 1K resistor (brown-black-red-gold) | MIDDLE leg line (col 21) → col 15 | part |
| ESP32 D26 (right side, 7th pin) | col 15 line, next to the resistor | F-M (gray) |
| ESP32 GND (left side, 2nd pin) | LEFT leg line (col 22) = the ground line | F-M (white) |
| RIGHT leg line (col 20) | Relay IN screw | male-male (red) |
| Relay jumper | on **L** | cap |
| Relay DC+ screw (next to VIN's wire) | Relay COM screw | male-male |
| Pump red | Relay NO screw | pump's own |
| Pump black | Relay DC− screw (next to GND's wire) | pump's own |
| Temp probe yellow / red / black | Adapter screws DAT / VCC / GND | probe's own |
| Adapter DAT pin → a48, ESP32 D4 (left side, 5th pin) → c48 | top half, col 48 = data line | 2 F-M |
| Adapter VCC pin → a45, ESP32 3V3 (left side, top) → c45 | top half, col 45 = 3.3V line | 2 F-M |
| Adapter GND pin | LEFT leg line (col 22) | F-M |
| Soil probe cable AOUT | ESP32 D32 (right side, 10th pin) | F-M |
| Soil probe cable VCC | col 45 (3.3V line) | male-male |
| Soil probe cable GND | LEFT leg line (col 22) | male-male |

Rules that bite:
- **The relay needs the transistor.** It's a 5V module; the ESP32 pin only gives 3.3V. Wired straight to D26 it stuck ON with the jumper on L and never clicked on H. With the PN2222 + 1K it clicks. Firmware is set for this: `RELAY_ACTIVE_LOW = false` (`farm_hand.ino:24`), HIGH = pump on.
- Transistor printed **P2N2222A** instead of PN2222 = legs reversed. Check the print.
- The LEFT leg line is ground for 4 things (ESP32 GND, E leg, temp GND, soil GND). One pin per hole.
- Soil probe: **3.3V line only, never VIN.** Soil sensors only on pins 32-35.
- Probe electronics (the top part) stay dry. Only push in up to the line.
- Pins 33 / 27 (pot B) have nothing on them. Pin 33 reads junk (jumps 0-100% when the pump runs). `ONE_POT=1` (default) ignores it.
- The temp adapter has its pull-up built in: no 4.7k needed (it found the probe without one).

## 3. Bring-up: how it was proven on 2026-09-23

Tools: `arduino-cli` at `shellhacks2025\tools\arduino-cli\arduino-cli.exe`, esp32 core 3.3.12, OneWire 2.3.8, DallasTemperature 4.0.6. Board on **COM3** (CP2102 driver).

Flash the real code (close anything holding COM3 first, like `tools/raw_serial.py`):
```
cd Documents\code\shellhacks2025\farm-hand
..\tools\arduino-cli\arduino-cli.exe compile --upload -p COM3 --fqbn esp32:esp32:esp32 firmware\farm_hand
```
Watch + talk to the board: `.venv\Scripts\python tools\raw_serial.py` → http://127.0.0.1:8096 (type a command, Enter).

What each part did, in build order:

1. **Relay** (test code flipped D26 every 2 s): clicks every 2 s, LED1 blinks. Before the transistor: no click.
2. **Pump**: water on every click. ESP32 uptime ran 61.7 s → 86.0 s with the pump cycling = no restarts.
3. **Temp probe** (`firmware/temp_test`): `probes:1`, 24.88 °C at room temp.
4. **Soil probe** (`firmware/sensors_test`): about 3400 raw in dry air, 1507 raw in water (calibration in `farm_hand.ino:32-33`).
5. **Everything, real firmware**: soil 44%, temp 26.1 °C. `P A 3000` ran 3003 ms. `P A 10000` ran 10000 ms and took soil **44% → 52%**, uptime 14.0 s → 35.1 s straight through = USB power holds a 10 s pour.

Commands: `P A 3000` pour 3 s · `S` reading now · `X` emergency stop. Pours cap at 30 s.

At ShellHacks:
1. Unpack, check every wire against the table above (or the assemble page). Tug every screw.
2. Soil probe into the box up to the line, against the front wall. Temp probe in the soil. Pump in its water cup, tube tip on the soil.
3. USB in, open the raw serial page, see `reading` lines, send `P A 3000`.
4. Close the raw serial page, then: `.venv\Scripts\python laptop\calibrate.py` (optional re-cal) and `.venv\Scripts\python laptop\server.py` → http://127.0.0.1:8080, badge says **LIVE BOARD**.

## 4. The number: run it BEFORE the hackathon

This is the only thing judges will remember. Get it from a real run, never from fake data.

1. Water both pots the same, start `server.py`, leave it **12-24 hours** (overnight). Laptop plugged in, sleep OFF.
2. Pot B's timer is 5 s every 6 h by default (`TIMER_EVERY_S`, `TIMER_POUR_MS` in `config.py`). Set it to what a normal sprinkler timer would do.
3. Next day:
   ```
   .venv\Scripts\python laptop\report.py
   ```
   It prints water used by each pot, water saved %, and % of time each pot stayed in the healthy band (35-70%).
4. Train the predictor on your real data:
   ```
   .venv\Scripts\python laptop\predictor.py train
   ```
   It needs 300 labeled rows (pots have to actually dry out). It prints how far off XGBoost is vs a straight-line guess. That's your "our model is X hours accurate" line.
5. Screenshot the dashboard chart. That's a slide.

⚠️ Honest-number rule: if the AI pot didn't save water, don't fake it. Say what it did (e.g. "kept the plant healthy 100% of the time vs 71% on the timer") and tune the thresholds for the next run.

⚠️ **Where the savings actually come from** (learned from the fake runs, section 12):
- A timer sized *perfectly* for the pot is hard to beat. In the fake run the AI pot used **547 ml** vs the timer's **400 ml**.
- Real timers waste water in 2 ways: they water when it just rained, and they water the same amount on cool cloudy days as on hot ones.
- So set Pot B's timer the way a real person sets a sprinkler: sized for the hottest day, every day. That's the fair baseline.
- **Put both pots OUTSIDE for the overnight test** if you can, and start the server with `set OUTDOORS=1`. Indoors, rain never touches them, so the AI's "skip, rain is coming" move does nothing (and could even let Pot A dry out waiting for rain that never lands on it).
- Indoors only? Then the pitch number is "time healthy" and "no wasted pours", not rain skips.

## 5. The AI part: a Gemini agent team (Google ADK)

Every 15 minutes (`CHECK_EVERY_MIN`), or when you press **Run agents**:

```
            ┌── ☁️ weather_agent ── rain forecast, drought level, watering rule
 GATHER  ───┼── 🌱 soil_agent ───── Pot A + B moisture, XGBoost "hours until dry"      (all 3 at once:
            └── 🧠 memory_agent ─── last 24 h of pours + what each pour DID to the soil  ParallelAgent)
                        │
 DECIDE  ── 📝 planner_agent ⇄ 🔍 critic_agent        (LoopAgent, up to 3 rounds:
            proposes water/wait   approves, or sends it back   the critic can reject the plan)
                        │
 EXECUTE ── ⚙️ executor (code) → 🛡️ guards (code the AI can't override) → ESP32 → pump
                        │
 LEARN   ── 💧 pour detector (soak.py) measures the soak → memory_agent reads it next time
```

Plus 💬 **farm_helper**: a chat agent on the dashboard. Ask "why did you water pot A?" and it answers from the same tools and the decision log.

Why it's heavy, not decoration:
- **3 agents in parallel + a planner/critic loop.** Google Cloud's 2025 ShellHacks challenge asked for parallel agents and/or a loop. This has both, built with ADK's own `ParallelAgent` and `LoopAgent`.
- **The critic can really reject.** In one early test run (19:4x on 2026-09-22, before the output was being saved to files) it sent a plan back because "the farmer sentence contains numbers that were not given by the tools". The planner fixed it, then it got approved. ⚠️ That run is **not reproduced in the saved evidence**: every rerun on the shipped config timed out on the right.codes lane (see section 11). Re-prove it with Google's API on Sep 23.
- **It learns.** After every pour, the pour detector measures how much moisture went up and how long the water took to reach the probe. The planner sizes the next pour from the *learned* %-per-second, not a guess. If pours stop reaching the probe (pump dry, tube kinked), the team stops watering and tells you to check the pump.
- **The AI never touches the pump.** `guards()` in `brain.py` checks every pour. These are code, not a prompt:
  - board online
  - pot not already wet (70%+)
  - 30 min since the last AI pour
  - 1,500 ml a day cap
  - the last pour has finished soaking in
  - 30 s max per pour, enforced twice: laptop + chip
- **No key, slow AI or no WiFi → rule brain.** If the team doesn't answer within `AI_TIMEOUT_S` (120 s), plain if-statements decide with the same tools and the same guards. The dashboard shows `rules (AI failed)`.

Brains (checked in this order):
1. `GOOGLE_API_KEY` set → Google's Gemini API direct. **Use this at ShellHacks** (Google tracks want Google's API). Get a key at aistudio.google.com. Set `GEMINI_MODEL` to the current Flash name.
2. `RIGHTCODES_KEY_GEMINI` set → Gemini through right.codes (default `gemini-3.6-flash`). Testing lane only. It's a reverse-engineered Gemini CLI lane and it's slow with tools.
3. Neither → rules.

```
set GOOGLE_API_KEY=your_key_here
.venv\Scripts\python laptop\server.py
```

🔴 **Speed is the #1 open risk.** On the right.codes lane:
- a plain Gemini call (no tools) took 9.09 s, 1.06 s and 3.52 s (`evidence\lane_speed.log`)
- **one tool-calling step took 64-180 s** (`evidence\team_timing.log`, `evidence\lane_speed.log`)
- a full team check needs about 6 of those steps back to back, so every saved rerun on the shipped 120 s timeout fell back to the rule brain

The fallback did its job every time: it waited on the wet pot and watered the dry one. For the demo:
- **Sep 23, first thing:** get a Google AI Studio key, run `evidence\team_timing.py` with `GOOGLE_API_KEY` set, and write the times down. If a full check is under ~30 s, you're good.
- still slow? Raise `AI_TIMEOUT_S`, and press "Run agents" while you're still talking about the problem
- worst case, the rule brain still waters on stage, and the dashboard honestly says `rules (AI failed)`

Live data sources (free, no key, tested 2026-09-22):
- **Open-Meteo:** rain chance, rain mm, ET0 (how much water the air pulls out of soil)
- **US Drought Monitor county API:** Miami-Dade, week of 2026-09-15 = **100% in drought (D1+), 55.4% severe (D2+)**

Indoors vs outdoors: set `OUTDOORS=1` only if rain can land on the pots. Indoors (the default), the team ignores rain, so it never waits for rain that can't reach the pot.

## 5b. The live view: the Farm Hand dashboard

House style (the `visual-page` tokens): light theme, blue = the AI and the agents, orange = the timer, Bricolage Grotesque / Atkinson Hyperlegible Next / JetBrains Mono (numbers only).

The 3D model is built in Blender, not drawn by hand in code:
- `blender/build_farmhand.py` builds it and exports `laptop/static/models/farmhand.glb`. Run it headless: `blender -b --factory-startup --python blender/build_farmhand.py` (or through the Blender MCP socket with `blender/mcp_send.py`, port 9876).
- It's the real pot: a **Mainstays Deep Rectangle** food storage box (see-through frosted plastic, slanted sides, rolled rim), with the blue lid upside down behind it. The size is an ESTIMATE (27 x 18 x 11 cm). Measure the real box and set `L, W, HC` at the top of `build_farmhand.py`.
- The soil is drawn by a shader adapted from Prompt Grass (MIT, see `laptop/static/soil_shader.js`): dry soil is light grey-brown with cracks, wet soil goes near-black. A pour shows a stream and splash rings, a small puddle, the wet front spreading over the whole top, then one even wet layer sinking down with a fingered edge (a little deeper right under the tube). Depth = ml pumped / (434 cm2 soil surface x 0.15, the water dry mix still takes); the shape and speed are modeled and the label says so. To make the real box match, poke 5-6 small holes near the tube's end and lay it across the soil (a drip line), so the real water spreads too and reaches the probe fast.
- Every part of the real build is modeled at its real size in `blender/hardware.py`: the capacitive v1.2 probe (with its chips and JST plug) and the DS18B20 steel probe against the front wall, the ESP32 devkit (metal WROOM can, USB-C, pin labels) on an 830-point breadboard with the 4.7k pull-up, the 1-channel relay module, the mini pump in a cup of water, the tube clipped to the rim, and every jumper wire. Textures come from `blender/make_hw_textures.py`.
- Parts the page drives live: `Soil` (moisture shader, colors by depth), `WaterFront` (slides down while a pour soaks in), `ProbeLED` (green ok, red dry, blue pumping), `Rim` (glows while the agents work), `Nozzle` (drops fall while the pump runs).
- `laptop/static/scene.js` loads it with three.js: studio lighting from an HDRI (Poly Haven `ferndale_studio_03`, CC0), real see-through plastic (MeshPhysicalMaterial transmission), soft shadow.

Layout: the 3D pot fills the left, the control column sits on the right.
- **Top right, the call:** "Watering 16 s" / "Holding off" / "Hit 54.4%", the reason, which brain decided and how long ago. Buttons: **Run agents**, **Test pour 5 s** (same safety rules as the AI), **Stop pump**.
- **Hit a target:** a - 55% + picker and **Go** (section 5c). Pulse chips show each pulse ("8 s +9.4%").
- **Numbers:** soil moisture with the healthy band, water saved vs the timer, dries out in, rain, evaporation, county drought.
- **Agent team tab:** dry-time model, the 3 gatherers, planner, critic, safety rules, pump, pour detector, target controller. Each lights up blue while it works. Blocking safety rules show in red, then a log of every step. Tabs: **Pours** (what each pour did + learned rate) and **Ask** (Gemini chat).
- **On the 3D stage during a target run:** a big live readout (now %, target, a bar with the target mark). Green when it locks, red when it stops.

**New views (2026-09-24), code in `laptop/static/views.js`:**
- **Soil over time (the money graph)**, under the 3D box: moisture (blue, measured), a dashed orange "if a timer watered" line (estimated: the measured line minus what the AI's own pours added, plus what the timer's 5 s every 6 h would have added, using the learned % per pump second), and soil temperature (purple, measured) in its own panel under it. Dots mark AI pours and timer pours. Hover shows every value. Window: 1 h / 6 h / 24 h / All. API: `GET /api/series?hours=24`.
- **Cups saved** next to it, from `report.py` (1 cup = 236.6 ml). Test pours and target demos still count against the AI, so on demo day it can read "Timer used less so far" in red. It says so honestly.
- **Soil temperature** is now a big number next to moisture (right column).
- **Fast + smart strip** under the call: Laya's pick, how sure, and how many ms it took, then the Gemini team's time to explain (live seconds while it thinks). A Run agents with Gemini now calls Laya first so its call lands on screen instantly. Seen on the fake board: Laya 311 ms, team 37 s.
- **Someone added water banner:** `soak.py` watches for a +4% jump with the pump quiet for 4 min. Banner: "Someone just added water. +9.6%. Soil's at 69.6% now, so I'm skipping my next watering." (says "my next pour will be smaller" if the soil is still at or under 40%, the line where the AI waters). Fake board: **Pour a cup in by hand (test)** link, `POST /api/demo/handpour`.
- **A whole field** toggle on the stage: zooms out from the box to a farm with a probe every few rows. Labeled ILLUSTRATION. Only the ringed dot is live (this box's % and °C).
- Second dev server without touching the main one: `set PORT=8081 & set FARMHAND_DB=farmhand_dev.db & set SERIAL_PORT=fake`. Screenshots: `python tools/shot_views.py 8081 v19 --hand` -> `laptop\data\v19_*.png`.

Screenshots (fake board): `laptop\data\v14_mainstays.png` (the box), `v15_target_mid.png`, `v15_target_done.png`, `v15_target_phone.png`. Impeccable design detector on the final `index.html` (it reads the page code, not the screenshots): 0 findings (`evidence/design_detector.json`).

Honesty labels on screen:
- the depth shading and the sinking water band are a model ("by depth, modeled from one probe"). Only the probe % is measured.
- the dry-time model label says "trend estimate" until XGBoost is trained on real runs
- the fake board says "Running on test data from the simulated board" at the top

## 5c. Hit the Target (the live wow)

A judge picks a moisture % (36-68). Farm Hand walks the soil up to it in short pulses and stops on it. Code: `laptop/target.py`, button **Go**, API `POST /api/target {"pct": 55}`.

Each pulse:
1. Read the soil (median of the last 6 readings, so probe noise can't fool it).
2. Size the pulse from the learned rate: seconds = gap / (% per second) x 0.7, so it creeps up instead of overshooting. Max 8 s a pulse.
3. Check the chip really started the pump (a refused pour stops the run and says so). Then wait until the water reaches the probe and the reading goes flat (at least 20 readings, max 90 s).
4. Measure what that pulse really did and update the learned rate (this soil + this pump, learned live). Pulses expected to add under 3% are too small to judge over probe noise, so they never trigger the "water isn't arriving" stop.
5. Stop when it's within 1% below the target. It can't take water back out, so each pulse aims at 70% of the gap and it rarely goes past. If it does, the run ends as "over" and says the last pulse overshot.

The pinch test (catch it lying): pinch the tube, press Go. The pump runs, but the probe doesn't move. After one pulse it stops and says: "The pump ran 8.0 s, that should add about 9.7%, but the probe moved -0.1%. Water isn't reaching the soil." On the fake board, use the **Pinch the tube (test)** link.

Safety: every pulse still goes through `guards()`: board online, not already wet, daily water cap, last pour done soaking. The only rule it skips is the 30-minute gap between AI pours, because a person started it and is standing at the pot. While a target run is going, the AI loop can't pour.

Tested on the fake board (`evidence/target_run.log`, `evidence/target_fault.log`):
- target 55%: 35.4% -> 54.3% in 3 pulses (8 s, 4.9 s, 2.4 s), 15.3 s of pumping, 306 ml, 97 s
- pinched tube: stopped after pulse 1, probe moved -0.1% when about 9.7% was expected, 91 s

⚠️ The daily water cap is 1500 ml (`DAILY_MAX_ML`). One target run uses about 300 ml, so about 5 demo runs a day before the cap blocks it. That's a lot of water for this box. Either dump water out between demos (tip the box over a sink), or set `DAILY_MAX_ML` higher for demo day.
⚠️ Real soil is slower and messier than the fake board. Do 3 practice runs on the real box on Sep 23 and write down the pulse count and time.

## 6. Hackathon plan

⚠️ **Rules check first.** MLH-style hackathons want the project built at the event. This folder is practice + a proven design. At the event:
- rebuild from a fresh repo (you'll be fast now), OR
- ask an organizer if pre-written hardware bring-up code is OK and **disclose it** in the Devpost.
- Disclose it in the Devpost: the idea started from a HackMIT 2026 soil-sensor project (Prompt Grass Grow Grass). One part of its code is reused: the soil + water shader (`laptop/static/soil_shader.js`, adapted from its `shaders.ts`, MIT License, credited in the file and in `laptop/static/THIRD_PARTY_NOTICES.md`). Everything else, the firmware, laptop code, agents, target mode, dashboard and 3D model, was written for Farm Hand.

Rough timeline (36 h):

| When | What |
|---|---|
| Hour 0-2 | Check the 2026 sponsor list. Is Google Cloud / Gemini there? Pick the tracks. Wire the hardware. |
| 2-6 | Firmware up, probes calibrated, both pumps clicking from the laptop |
| 6-12 | Laptop side: board link, feeds, rule brain, dashboard. Start the live A-vs-B run NOW so data piles up. |
| 12-20 | Gemini agent team (ADK), pour detector, predictor trained on the pre-event data |
| 20-28 | Polish the dashboard, sleep |
| 28-32 | Demo video (2 min), Devpost write-up, slides |
| 32-36 | Practice the pitch 5 times. Charge everything. |

## 7. Demo (2 minutes)

1. **Hook (20 s):** "Your orange juice, your winter strawberries, the sugar in your coffee, your tomatoes. Florida grows them. Florida is #1 in the US for sugarcane, grew 51% of America's oranges by value, has almost all of the winter strawberries, and more than half the fresh tomatoes. This spring 80% of Florida hit extreme drought, and today half the state, and all of Miami-Dade, is still in drought. Farms are watering blind."
   - Sources: FDACS / USDA NASS Florida overview (sugarcane #1, oranges 51% of US value in 2020, strawberries #2 with the winter harvest); USDA ERS (tomatoes); US Drought Monitor state + county stats, checked 2026-09-23 and saved in `evidence/usdm_florida_2026.json`: Florida D3+ (extreme) 79.5% on Apr 7 2026, D1+ (any drought) 54.52% on Sep 15; Miami-Dade D1+ 100%, D2+ 55.4% on Sep 15. ⚠️ Do NOT say "right now 82% extreme": on Sep 15 only 2.01% of Florida was extreme. ⚠️ Do NOT show the Miami aquifer as running low: USGS well G-1251 is normal this September (2.74 ft vs 2.86 ft median of 2011-2025, `evidence/usgs_G1251_daily.json`). NASA's record-low aquifers were north/central Florida.
2. **The fix (10 s):** "Farm Hand is an AI agent team that reads the soil, gives it exactly the water it needs, and proves every drop got there." Then the farmer's own words on screen: "irrigation is missing places. Then trees die." (River & Root Farm, Gainesville, lost 70% of its blueberries; Independent Florida Alligator, June 2026.)
3. **Hit the Target (45 s):** hand the judge the - / + picker. "Pick a number." Press Go. The agent team lights up, water drops in the 3D view, the real box gets wet, and the big number on screen climbs pulse by pulse and locks on their number. Read the receipt: pulses, seconds, ml.
4. **Catch it lying (20 s):** "Now pinch the tube." Press Go. The pump runs, nothing arrives, and it stops itself and says the water isn't reaching the soil. "A timer would have kept pouring into nothing."
5. **Brain (15 s):** "A team of Gemini agents. Weather, soil and memory run in parallel. A planner proposes, a critic checks its math and can send it back. The pump only runs if code-level safety rules agree, and it learns from every pour." Press Run agents in the background during step 3 if the Gemini lane is fast enough.
6. **Number + cost (10 s):** "Over X hours, the AI used Y% less water than the timer." (from report.py, real run only) "A farm-grade soil probe station runs up to about $4,000, and a farm needs one per zone. Our whole parts order was $72.94: 3 boards, 5 moisture probes, 5 temp probes, 4 pumps."
   - Price sources: SoilSense 2026 buyer's guide (CropX $695 + $300/yr) and the NSW DPI AgTech catalog (Sentek TriScan $2,115, Porosity Services probe package $3,995). Say "up to about $4,000 a station", never "a sensor costs $4k".

## 8. Judge questions, ready answers

- **"Why not an if-statement?"** "There is one. It's the fallback when the WiFi dies. The agents weigh the rain forecast, the drought level and the predicted dry time together, and explain every decision in plain words."
- **"How is this different from Rachio?"** "Rachio guesses from weather. We measure the actual soil, and it's $2.60 a probe."
- **"How do you know it saves water?"** "Same plant, same soil, same room. Pot B is a normal timer. We logged every milliliter." Show the report.
- **"What if the AI goes crazy?"** "It can't. 30-second cap in the chip, daily cap and wet check in the code. The AI asks, the code decides."
- **"Isn't hitting a number just a thermostat?"** "A thermostat knows how much one burst does. We don't, every soil is different. It learns the soil's rate live from each pulse, and it notices when water stops arriving."
- **"Does it scale?"** "One ESP32 reads 4 probes. $3 a zone. A farm runs one per field."

## 9. Tracks to target (2026 sponsor list seen 2026-09-24; challenge text still from 2025, re-check when posted)

2026 sponsors: Assurant, Waymo, Morgan & Morgan, Microsoft, Blackstone, NVIDIA, Chevron, Base44, Wix, Break Through Tech, Codex, GitHub, O'Reilly (wave 1); Google, State Farm, init, CodePath, swarms, Universal Orlando, Monster, Coca-Cola, vitaminwater, Latinx in Gaming, MLT (wave 2).

Going for (owner 2026-09-24):
- **Google Cloud** (ADK / A2A agents, $4,000 in 2025, "a continuous loop and/or parallel agents"): ParallelAgent (3 gatherers) + LoopAgent (planner/critic) + the 15-min loop. ⚠️ We don't use A2A; check if 2026 requires it.
- **Google, AI for Social Good**: drought, farmers, water.
- **Microsoft AI 4 Good**: sustainability.
- **NVIDIA** ("use AI, graphics or accelerated computing ... sustainability", 4 Jetson Nanos in 2025): Laya was fine-tuned on an NVIDIA RTX 4070 with CUDA + fp16 (`laya/train.py:26-27`, `torch.device("cuda")`, GPU required). Say it plainly: "we trained our own decision model on an NVIDIA GPU."
- **Codex** (new sponsor 2026, challenge not posted): build with Codex at the event and say so. Keep the Codex session logs/PR history as proof.
- **MLH Best Use of Gemini**: Gemini makes every call + explains it.
- **Best Overall**: 1st in 2025 was FloodGuard (Miami floods, ADK-style agents, mostly simulated data). We have the same story with real dirt.
- Maybe: **Assurant** ("make the connected world easier"): sensors that text you. **Chevron / Blackstone / Morgan & Morgan**: unknown until posted.
- Skip: Waymo (transport), State Farm (student insurance), the drink brands.

## 10. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Venue WiFi blocks the ESP32 | Doesn't matter: the ESP32 talks to the laptop over USB, not WiFi |
| Venue WiFi dies for the laptop | Rule brain takes over automatically; feeds keep the last good value |
| Gemini key/quota problem or slow | Rule brain after `AI_TIMEOUT_S`; dashboard says `rules (AI failed)` |
| Pots indoors, AI waits for rain | `OUTDOORS=0` (default) makes the team ignore rain |
| Pump runs but the water misses the pot | Pour detector flags it; the team stops watering and says "check the pump" |
| Probe dies | 3 spares. Recalibrate with `calibrate.py` |
| Pump leaks near the board | Keep the water cups on the far side of the table, board up high |
| Relay stays ON or never clicks | Happened 2026-09-23 without the transistor (3.3V pin can't drive the 5V module). Fixed by the PN2222 + 1K on D26, jumper on L, `RELAY_ACTIVE_LOW = false`. If it comes back: flat side facing you, LEFT leg on the ground line, resistor on the MIDDLE leg only. |
| Soil probe reads the same number wet or dry | Some cheap v1.2 boards have an NE555 chip (needs 5 V) instead of a TLC555 (works at 3.3 V). Read the chip's label. If it says NE555, power the probe from VIN (5 V) instead of 3V3, but first check AOUT in a cup of water and in air stays under 3.3 V (the ESP32 pin's limit). |
| Relay clicks but the pump doesn't run | Check the DC+ → COM jumper, pump red in NO (not NC), pump black in DC−. Tug each screw. |
| Numbers look too good | Only real-run numbers on slides. The FAKE badge is red on purpose. |

## 11. What was tested on 2026-09-22 (before any parts)

Every ✅ has a saved proof file in `farm-hand\evidence\`. Anything without one is marked.

- ✅ **Firmware, the shipped version, in Wokwi**: `evidence\fw_wokwi.log`, 8/8 checks PASS.
  - boot, 1 reading a second, temp probe 22.0C
  - `P A 3000` ran `3000` ms, and `P B` while it was busy got `refused busy`
  - the timer poured Pot B by itself (`1006` ms), and `T 0` turned it off
  - `P B 99999` got capped to `30000` and ran `30000` ms
- Firmware fixes, 2026-09-22:
  - bug: the timer spammed `refused` every 10 ms while it waited
  - bug: `T 0` let one queued pour through
  - bug (found by the Fable audit): the temp probe read blocked the loop ~750 ms a second on real hardware, so pours could overrun. The read is non-blocking now.
  - change: readings come every 1 s instead of 5 s
- Laptop fixes from the Fable audit:
  - pot B's timer is re-sent every time the ESP32 boots (opening the USB port resets the ESP32, so the first command used to get lost)
  - a timed-out agent team gets cancelled, so no more paid calls and no orbs lighting up after the rules already decided
- ✅ **Rule brain + guards + fallback**: `evidence\team.log`, 2 runs on the shipped config.
  - The Gemini team timed out (lane speed), and the rule brain took over both times.
  - Wet pot (61.7%) → WAIT.
  - Dry pot (37.7%) → WATER 14 s.
  - The guard refusal "watered 12 min ago, rule is 30 min" is in `evidence\team_timing.log`.
- ✅ **Pour detector**:
  - good pour, `evidence\team.log`: +17.9%, water reached the probe in 1.5 s, learned 1.242 %/s
  - failed pour, `evidence\soak_xgb.log`: +0.0%, flagged "check the pump…", and the learned %/s ignored it (stayed 1.242)
- ✅ **XGBoost path**: `evidence\soak_xgb.log`. It trained on 188 fake rows and tested on 48, then the fake model was deleted. The fake world is too simple for its accuracy to mean anything; only the real overnight run counts.
- ✅ **Live feeds**: Open-Meteo and the Drought Monitor both answered for Miami (the numbers are in section 5).
- ✅ **Dashboard v5**: `laptop\data\v5_pump.png` (pump pouring, agents lit), `v5_soak.png` / `v5_final.png` (water band sinking), `v5_phone.png` (390 px, no sideways scroll). Older designs kept as `static\index_v2_panels.html`, `index_v3_cutaway.html`, `index_v4_ogstyle.html`.
  - ⚠️ `shot1_agents.png` shows the RULE brain's steps lighting up, not Gemini's.
- ⚠️ **Gemini agent team, full success: not in the saved evidence.**
  - Early session runs (not saved to a file) completed and watered: 56.6 s, with the critic rejecting once, and 154.3 s on a 240 s timeout.
  - Every saved rerun timed out on the right.codes lane: 120.0 s and 120.0 s (`evidence\team.log`), and 400 s with a long timeout (`evidence\team_timing.log`).
  - The agents themselves work, and each one called its tools (`evidence\team_timing.log`). The lane is just too slow with tools: 64-180 s per step.
  - 🔴 Re-prove it with Google's direct API on Sep 23 before trusting it on stage.
- ❌ **Farm chat**: timed out on the lane (`evidence\team.log`). Not proven.
- ❌ **Not tested yet**:
  - real hardware (arrives Sep 23)
  - Google's direct Gemini API
  - `calibrate.py` (needs the real board)
  - XGBoost on real data
  - a full overnight A-vs-B run
  - the `OUTDOORS` switch in a live Gemini run
