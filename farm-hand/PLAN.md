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

## 5d. The dashboard, round 2: make judges say wow, and make it look human-made (for Matthew)

Written 2026-09-26. This builds on 5b (what's built) and 5c (Hit the Target). Read those first. Page: `farm-hand/laptop/static/index.html` + `scene.js` + `views.js`. Design skills to use: `design-skills/` in this repo (see its README).

### The one job of the page

A judge walks up, stands 2-3 m back, and in 10 seconds understands three things:
1. **It's alive.** Real soil, real numbers, changing right now.
2. **It's smart.** It decides on its own and says why.
3. **It saved something.** Water, and the crop.

Everything on screen either proves one of those three or goes behind a tab.

### What data to show, ranked by size

Firmware sends one line a second: `{"type":"reading","a_raw","a_pct","temp_c","pumping"}`. Everything else is computed on the laptop.

| Tier | Data | Source | Measured or estimated | Size on screen |
|---|---|---|---|---|
| 1 | **Soil moisture %** with the healthy band around it | `a_pct`, `/api/live` | measured | biggest thing on the page, readable from 3 m (~96 px on a 1080p projector) |
| 1 | **Soil temperature °C** | `temp_c` | measured | same size as moisture. The owner wants these two equal. |
| 1 | **Pump state**: WATERING 12 s (counting) or HOLDING OFF | `pumping` | measured | big, next to the numbers |
| 1 | **"Last reading 0.4 s ago"**, ticking | reading timestamp | measured | small, but always there. It proves the numbers are live, not a screenshot. |
| 2 | **The call in one sentence**: "Holding off. Soil is 58.3%, inside the healthy band." + "Laya, 94% sure, 115 ms" | `/api/decisions`, Laya | measured (the decision and its timing) | medium, top right |
| 2 | **Why** (Gemini team's explanation), appears when it finishes | agent team | model output | normal text under the call |
| 3 | **The money graph**: moisture (blue) vs the timer ghost line (orange, dashed) | `/api/series` | blue measured, orange **estimated** | full width under the 3D box |
| 3 | **Cups saved** | `report.py` | **estimated** until the flow sensor is in | medium, next to the graph |
| 3 | **Dries out in** (uses temp: "at 31.4 °C this soil dries in about 6 h") | predictor | estimated (trend) | small |
| 4 | Rain forecast, evaporation, county drought level | `feeds.py` | from outside data | small, side column or a tab |
| 4 | Agent team log, pours list, Ask chat | existing tabs | | behind tabs |

**Rule: no more than 6 numbers visible at once** (Owl-Listener `critique-information-density` + `millers-law`). If a 7th number wants in, one of them goes behind a tab.

**Temperature has to earn its place.** A temp number alone is decoration. Tie it to a decision: the "dries out in" line uses it, and the Laya/Gemini explanation should mention it when it matters ("It's 31 °C, so the soil will dry fast. Watering now.").

### Make the 3D box act out the data

The 3D box is the hero. Every effect in it must be driven by a real reading, so if a judge asks "is that real?", the answer is always "yes" or "modeled from the one probe" (honesty rules in 5b).

| Data | What the box does | Status | Part in `farmhand.glb` |
|---|---|---|---|
| Moisture % | Soil darkens as it gets wetter | built | `Soil` |
| Moisture % | A faint **waterline** in the cutaway rises and falls with the %, labeled "modeled from one probe" | new | `WaterFront` (reuse) |
| Pump on | Water stream from the tube + splash rings | built | `Nozzle` |
| Pump on | An **ml counter riding the stream** (20 ml/s x seconds, labeled "est." until the flow sensor) | new | HTML label pinned to `Nozzle` |
| Temperature | Probe tip glows cool blue → warm orange. Pick 2 stops only (e.g. 20 °C and 34 °C) and interpolate. | new | DS18B20 mesh tip |
| Every reading (1 Hz) | `ProbeLED` pulses once, like a heartbeat | new (LED exists) | `ProbeLED` |
| Agents thinking | Rim glows blue | built | `Rim` |
| Target run | A flat **target plane** at the judge's chosen %, the waterline climbs to meet it | new | new plane mesh |

⚠️ The probe tip color and the waterline are the only new "decoration" and both map to data. Don't add particles, sparkles, or ambient motion that doesn't come from a reading.

### The four judge moments (the demo is these, in this order)

Hand the judge control. A judge changing the soil and watching the AI react beats any slide.

| # | The judge does | The screen does | Status | API |
|---|---|---|---|---|
| 1 | Picks a target % and presses Go | Target plane appears in the box, pump pulses, the waterline climbs and locks on their number. Receipt: pulses, seconds, ml. | built (plane is new) | `POST /api/target` |
| 2 | Pinches the tube, presses Go | Stream runs in 3D but the soil doesn't move. Red alert: "The pump ran 8.0 s but the probe moved -0.1%. Water isn't reaching the soil." | built | `POST /api/target`, fake: `/api/demo/pinch` |
| 3 | Pours a cup of water in by hand | Soil darkens, moisture jumps, banner: "Someone just added water. +9.6%. I'm skipping my next watering." If phone alerts are built, the judge's phone buzzes. | banner built, phone new | `soak.py`, fake: `/api/demo/handpour` |
| 4 | Clicks "A whole field" | Camera pulls back from the box to a field of probe dots colored by moisture, labeled ILLUSTRATION. Only the ringed dot is live. | built | `views.js` |

End on the **cups saved** number and the locked target. People remember the peak and the end (Owl-Listener `peak-end-rule`), so the last thing on screen should be the win, not a log.

### Layout (1920x1080 projector first, then laptop, then phone)

```
+---------------------------------------------+------------------------------+
|                                             |  58.3%        27.9 °C        |
|                                             |  moisture     soil temp      |
|           3D BOX (the hero)                 |  healthy 45-65                |
|   soil color, waterline, stream, probe      |                              |
|   glow, ml counter on the stream            |  HOLDING OFF                 |
|                                             |  Soil is inside the healthy  |
|   [This box | A whole field]                |  band. Laya, 94% sure, 115 ms|
|                                             |  last reading 0.4 s ago      |
|                                             |                              |
|                                             |  [ - 55% + ]  [Go]           |
+---------------------------------------------+  [Test pour 5 s] [Stop pump] |
|  SOIL OVER TIME: blue measured, orange      |------------------------------|
|  dashed timer (est.), dots = pours          |  Cups saved: 14 (est.)       |
|  temp strip under it                        |  Dries out in ~6 h           |
+---------------------------------------------+------------------------------+
                       tabs: Agent team | Pours | Ask
```

Alerts (hand pour, pinch) slide in over the top of the right column, never as a modal. Only one red thing on screen at a time (Owl-Listener `von-restorff-effect`: the alert only stands out if nothing else is red).

### Make it look human-made, not AI-made

This is how to use the skills in `design-skills/`. Every rule below comes from one of them. The **current page already passes impeccable's detector with 0 findings** (`evidence/design_detector.json`), so this is a round of taste, not a rescue.

**Step 1. Decide the look from where it's used, not from "dashboard" (taste-skill section 0, impeccable `craft-floor`).**
Where: a folding table in a bright FIU hall, fluorescent light, judges standing, often on a projector. So: **light theme** (the house style already is), high contrast, big numbers. Set taste-skill's dials for this page: `DESIGN_VARIANCE 5 / MOTION_INTENSITY 5 / VISUAL_DENSITY 5`. It's a working instrument, not a landing page.

**Step 2. Fix what the scan of `index.html` found (2026-09-26):**

| Found | Skill rule | Fix |
|---|---|---|
| **10 different corner radii** (2, 6, 8, 9, 10, 11, 12, 14, 16, 99 px) | taste-skill 4.4 "Shape consistency lock" | Pick one scale: `6px` controls, `12px` panels, `999px` chips only. Write it in the CSS tokens and replace all 28 `border-radius` lines with the tokens. |
| 2 uppercase letter-spaced labels | impeccable craft-floor: "A kicker or eyebrow above a heading... is a ban" | Delete the eyebrows. Let the heading or the number carry itself. |
| 1 zero-offset glow shadow (`box-shadow: 0 0 ...`) | impeccable: "A zero-offset colored halo is decoration"; taste-skill 9.A "no outer glows" | Give it an offset + soft blur tinted to the background, or remove it. The 3D rim glow is fine: it means "agents working". |
| `backdrop-filter` in use | impeccable: "Glass and blur as decoration" | Keep it only if it sits over the 3D box so text stays readable. Otherwise remove it. |
| 1 `linear-gradient` | taste-skill 9.A | Fine if it's the soil/sky in the scene. Not on text or buttons. |

**Step 3. The small things that make it look built instead of assembled (impeccable craft-floor, "Browser surfaces"):**
- `::selection` color from the palette (already there, keep it), plus themed scrollbars, focus rings (`:focus-visible`, 2 px, accent color, offset 2 px), and `caret-color` on the Ask box.
- `font-variant-numeric: tabular-nums` on **every** changing number, so digits don't jump sideways each second. Only 2 uses today; add it to moisture, temp, seconds, ml, cups, and the graph axis.
- Real, messy numbers: show one decimal (58.3%, 27.9 °C). Never round to "50%". Real data looks real (taste-skill 9.D).

**Step 4. Words.**
- Plain product language: "Holding off", "Watering 12 s", "Water isn't reaching the soil". No "AI-powered", "seamless", "smart insights" (taste-skill 9.D filler verbs).
- No em dashes anywhere on the page (taste-skill 9.F). No `·` chains of 3+ items.
- Buttons name the action: "Go", "Stop pump", "Test pour 5 s". One label per action (taste-skill 4.5 "no duplicate CTA intent").

**Step 5. Icons.** One real icon set (Phosphor, one weight), or none. No emoji in the UI, no unicode symbols as icons (impeccable craft-floor).

**Step 6. Motion: one authored moment (impeccable craft-floor, emil-design-eng).**
- The authored moment is **the pour**: stream, soil darkening, waterline rising, number counting up. That's where motion goes.
- Everything else is quick and quiet. Use Emil's timings: button press 100-160 ms, tooltips 125-200 ms, panels 200-300 ms. Easing `cubic-bezier(0.23, 1, 0.32, 1)` (Emil's strong ease-out). Never `ease-in`, never `transition: all`.
- Numbers roll to their new value (~250 ms, ease-out), they don't blink.
- Never animate from `scale(0)` (Emil). Alerts slide in from 8-12 px with opacity.
- `prefers-reduced-motion`: keep the data changes, drop the movement (already has one rule; check it covers the new pieces).
- Every click answers in under 400 ms (Owl-Listener `doherty-threshold`). Laya's 115 ms call does that. For the Gemini team, show "thinking, 6 s" counting, never a bare spinner.

**Step 7. Density check (Owl-Listener `critique-information-density`).** Run the critique on a screenshot. Pass means: the primary numbers are the heaviest thing on screen, no more than 6 numbers visible, secondary data behind tabs, labels left-aligned so they scan in a column.

### How Matthew runs the skills (in Claude Code)

1. Install: `cp -R design-skills/taste-skill design-skills/impeccable design-skills/frontend-design ~/.claude/skills/` then restart Claude Code.
2. Direction: "Use taste-skill. Give me the design read and dials for `farm-hand/laptop/static/index.html`, then apply section 5d of PLAN.md."
3. Motion: "Read `design-skills/emil-kowalski/skills/emil-design-eng/SKILL.md` in full and review every transition in index.html and views.js against it."
4. Density: "Read `design-skills/owl-listener-designer-skills/visual-critique/skills/critique-information-density/SKILL.md` and critique this screenshot."
5. Final pass: `/impeccable critique`, then `/impeccable polish`, then `/impeccable audit`.
6. Screenshot at 1920x1080 (projector), 1440x900 (laptop), and 390 px wide (phone). Look at them yourself before calling it done.

### Done checklist (all must pass before demo day)

- [ ] Moisture, temp and pump state readable from 3 m on the projector
- [ ] "Last reading" ticks every second on the real board
- [ ] Every 3D effect maps to a reading, and modeled parts are labeled
- [ ] Estimated numbers say "est." (timer line, cups saved, ml on the stream)
- [ ] One radius scale, no eyebrows, no glow halos, no emoji, no em dashes
- [ ] Tabular numbers on everything that changes
- [ ] Only one red thing on screen at a time
- [ ] UI transitions under 300 ms, ease-out, nothing from scale(0)
- [ ] All four judge moments rehearsed on the **real** box, not the fake board
- [ ] Fake board still says it's test data at the top

### Build order

1. Tier 1 numbers at projector size + "last reading" tick (small change, biggest effect).
2. Radius tokens, eyebrow removal, tabular numbers (Step 2 and 3).
3. Probe heartbeat + probe tip temperature glow.
4. Target plane + waterline for Hit the Target.
5. ml counter on the stream.
6. Phone alerts (the detectors exist; sending isn't built).
7. Flow sensor (hardware) so ml, the timer line and cups saved become measured.

## 5e. Three pages, two boxes: the work plan (for Matthew, 2026-09-26)

**Start here, Matthew.** This is the current plan. Where it disagrees with 5b or 5d, this section wins. 5d still holds for the look (type, radii, motion, the "human-made" rules); this section says what goes on which page, what's built, what's not, and in what order to do it.

### What changed and why (read this first)

1. **The box is indoors.** No rain, no sun, no weather reaches it. So indoors, Farm Hand's job is simple: **hold the soil at a moisture level we pick (the baseline).** Laya's weather smarts don't matter inside, and we say so out loud.
2. **The proof against a timer is now a real second box.** Box A = Farm Hand. Box B = a plain timer (the chip's built-in timer, every 6 h). Same soil, same room, same ESP32. The only difference is the brain. This replaces the "virtual timer" math for the demo (the hardware side is being wired now; see the hardware notes at the bottom).
3. **The proof that it works outside is a simulation**, on 21 months of real Miami weather Laya never trained on. That's where "wait for the rain" shows.
4. **So the dashboard becomes three pages:**

| Page | URL | Job | One-line pitch it supports |
|---|---|---|---|
| **Live box** | `/` | Box A, live, by itself | "It holds the soil where you tell it to." |
| **Control** | `/control` | Box A vs Box B (timer), side by side, measured | "Same soil, same room. The timer used more water and still got it wrong." |
| **Simulation** | `/sim` | Outside: season replay vs a timer + crops at different moisture levels | "Outside, it waits for the rain. 56% less water on real weather." |

Every page has the same 3-tab nav at the top: **Live box · Control · Simulation**. Same tokens, same fonts, same header height.

### Status of every piece (be honest about this on stage too)

| Piece | Where | Status |
|---|---|---|
| Live dashboard (3D box, call, target, pinch, hand-pour, agent tabs) | `laptop/static/index.html`, `scene.js`, `views.js` | built, tested on the fake board and the real box A |
| **Weather card** on the live page (live Open-Meteo, 24 h rain-chance strip, "this box is indoors" note, link to /sim) | `index.html` (`.sky` section, `sky()` in the script) | **built 2026-09-26, not yet seen in a browser**. Backend feed tested live: 24 hourly slots come back. |
| Hourly forecast in the API | `feeds.forecast()["hours"]` → `/api/state` | built, tested live |
| **Baseline API**: set the moisture level to keep | `POST /api/baseline {"pct": 45}` in `server.py` | **built, not run yet**. Sets `DRY_PCT` (water at or below this) and `TARGET_PCT` (= baseline + 20, capped 5 under `WET_PCT`), saves to `laptop/data/baseline.json` so it survives a restart. Range 20% to `WET_PCT - 15`. |
| Laya holds the baseline | `brain.py _laya_state()` | works already: the box's `DRY_PCT..WET_PCT` band is mapped onto the stress line Laya was trained on, so moving the baseline moves when Laya waters. No retraining. |
| **Laya "in a field right now"** call | `GET /api/field-call` → `brain.field_call()` | **built, not run yet.** Same live soil, real forecast switched on, display only: never pours, never logs a decision, cached 5 min. Shown at the top of `/sim`. |
| Pot B in the graph API | `/api/series` now returns `[ts, A%, temp, B%]` per point + `pours_b` + `one_pot` | **built, not run yet.** For the control page. |
| **Simulation page, part 1: season replay timelapse** | `laptop/static/sim.html`, route `/sim` | **built, not seen in a browser, and has no data yet** (see "Make the sim data" below). Two fields side by side (timer orange, Farm Hand blue), soil color = moisture, spray on watering days, rain over both, play / scrub / 1x-3x-8x, counters, cumulative-water chart with rain bars, "held off for rain" moments list (click to jump), money + time calculator. |
| Sim data builder | `laya/season_replay.py` → `laptop/static/sim_data.json` | **built, not run yet**: needs the Laya weights (see below). |
| **Control page** | `laptop/static/control.html`, route `/control` | **not built** (spec below) |
| **Simulation page, part 2: crops at a moisture level** | a second section of `sim.html` | **not built** (spec below) |
| Baseline slider on the live page | `index.html` | **not built** (API is ready) |
| 3-page nav | all pages | **not built** |
| 5d visual fixes (radius tokens, eyebrows, tabular numbers, glow) | `index.html` | **not done** |

### Page 1: Live box (`/`)

The live page shows **box A only**, live. Everything on it should be measured or clearly a control.

Keep:
- the 3D box (hero) with soil color, water stream, probe LED heartbeat (5d), rim glow
- **big moisture % and soil temp °C** (tier 1 in 5d, readable from 3 m)
- pump state + "last reading 0.4 s ago" ticking
- the call ("Holding off" / "Watering 12 s") + Laya line (pick, % sure, ms)
- Run agents / Test pour / Stop pump, Hit the Target, pinch + hand-pour test links
- the **weather card** (built): live temp, rain mm + chance, the 24 h strip, and the line "This box is indoors, so rain can't reach it. Farm Hand won't hold off for rain here." It hides that line when `OUTDOORS=1`.
- tabs: Agent team, Pours, Ask

Add:
- **Baseline slider: "Keep the soil at least at __%"**. Range 20 to `wet - 15`, step 1, default = current `S.config.dry`. On release, `POST /api/baseline {"pct": v}`; show the answer ("Keeping it at 45%. Each drink aims for 65%."). Draw the baseline as a line on the moisture band (the band already exists: `#okBand`) and as a faint plane in the 3D box at that height (same idea as the target plane in 5d).
- the 3-page nav

Move off this page:
- the **money graph + cups saved** (virtual timer) → the Control page. With a real box B, the estimate isn't needed on the live page, and an estimate next to a measured number invites the wrong question.
- **"A whole field"** view → the Simulation page (it's about outside and scale).

### Page 2: Control (`/control`): box A vs box B

Run the server with `ONE_POT=0` (two real pots; the chip's pot-B timer runs; the laptop sends `T <TIMER_EVERY_S> <TIMER_POUR_MS>` on every boot (`board.py:191`), default every 6 h for 5 s). Firmware already refuses to run both pumps at once (`PUMP_GAP_MS`, `farm_hand.ino:34`), so no brownout from two pumps.

Layout (desktop, projector first):

```
+----------------------------------+----------------------------------+
|  FARM HAND (box A)          blue |  TIMER (box B)             orange|
|  58.3%   27.9 °C                 |  71.2%   27.8 °C                 |
|  holding at 45%                  |  every 6 h, 5 s, no matter what  |
|  Water used: 180 ml   2 drinks   |  Water used: 600 ml   6 drinks   |
+----------------------------------+----------------------------------+
|  MOISTURE OVER TIME: A blue line, B orange line, baseline dashed,   |
|  wet limit shaded. A pour = a dot on its line.                     |
+---------------------------------------------------------------------+
|  Box B used 3.3x the water. Box A never went under the baseline.    |
+---------------------------------------------------------------------+
```

Data:
- live numbers: `/api/live` already returns `a` and `b` (moisture %), `temp`, `pumping` (which pot is running).
- history: `/api/series?hours=0` → `points[i] = [ts, A%, temp, B%]`, `pours` (A) and `pours_b` (B), each pour has `ml`.
- water used = sum of `ml` per box since the run started. ml comes from each pump's measured flow in `laptop/data/calibration.json` (`flow_ml_per_s`), so the hardware side must measure pump B's flow (see the hardware notes).

Rules for this page:
- only measured numbers. No estimates here. If a number isn't measured, it doesn't go on this page.
- the headline sentence at the bottom is computed, never typed: water ratio, and whether each box stayed inside the healthy band (time above `WET_PCT` for B = "soggy", time under baseline for A).
- show the run's start time and length ("running 14 h 32 min"), so judges know how much data it is.
- when a judge pours into both boxes: box A's banner ("Someone added water, I'm skipping my next drink") shows here too, and box B's next timer pour still happens. That contrast is the moment.

### Page 3: Simulation (`/sim`)

**Part 1, season replay (built, needs data).** What's on it now, top to bottom:
1. **"Right now, if our box sat in a field at FIU, Laya would ___"**: from `/api/field-call`. Hidden if the server or Laya isn't running.
2. The two-field timelapse, Timer vs Farm Hand, Jan 2025 → Sep 2026, real hourly Miami weather.
3. "Saved so far" strip: gallons per acre, pumping $ for your farm size, soil checks done automatically, stressed hours avoided.
4. Cumulative water chart (timer orange vs Farm Hand blue, rain bars, playhead).
5. Money + time calculator: acres, diesel $/gal, minutes to walk the field. Pumping cost = $4.42 per acre-inch at $3 diesel, $7.36 at $5, straight line between (LSU AgCenter, Southern Ag Today, July 2026, diesel well pump, fuel only).
6. "Times it held off for rain": each time Laya picked `wait_rain` and ≥5 mm fell that day or the next.
7. The honesty line: simulated field (FAO-56 bucket, sandy soil, Kc 1.05) on real weather, not a measured farm.

Expected totals (from `laya/data/eval.md`, run 2026-09-23 on the PC GPU): timer 3,545,691 gal/acre and 12 stressed hours; Laya 1,553,052 gal/acre and 0 stressed hours; **56.2% less water**. `season_replay.py` prints its own totals; the timer must match exactly and Laya within a few mm (GPU math differs a little).

UI to-do on part 1: apply 5d (it already uses one radius scale, tabular numbers, no eyebrows); check it at 1920x1080, 1440 and 390 px; make the fields' soil % tag and the stress color readable from 3 m; move "A whole field" here from the live page.

**Part 2, crops at a moisture level (to build).** The idea: pick the baseline, and see which Florida crops stay healthy at that level and what it costs in water. Different crops tolerate different dryness, so one level can't fit all of them.

How it works (FAO-56, same bucket as part 1):
- soil % on our scale: wilting point = 20%, field capacity = 65% (same as Laya's scale).
- each crop's **stress line** = 20 + 45 x (1 - p), where p is the fraction of water the crop can use before it's stressed (FAO-56 Table 22).
- a baseline **under** a crop's stress line = that crop gets stressed (red, "won't do well here"). A baseline **above** it = healthy, but every point higher costs more water (more drains past the roots).

FAO-56 Table 22 values (checked 2026-09-26 at fao.org/4/x0490e/x0490e0e.htm):

| Crop | p | Stress line on our scale | Max root depth (m) |
|---|---:|---:|---|
| Strawberries | 0.20 | 56.0% | 0.2-0.3 |
| Bell peppers | 0.30 | 51.5% | 0.5-1.0 |
| Lettuce | 0.30 | 51.5% | 0.3-0.5 |
| Potato | 0.35 | 49.3% | 0.4-0.6 |
| Tomato | 0.40 | 47.0% | 0.7-1.5 |
| Watermelon | 0.40 | 47.0% | 0.8-1.5 |
| Green beans | 0.45 | 44.8% | 0.5-0.7 |
| Citrus (70% canopy) | 0.50 | 42.5% | 1.2-1.5 |
| Berries, bushes (use for blueberries) | 0.50 | 42.5% | 0.6-1.2 |
| Sugarcane | 0.65 | 35.8% | 1.2-2.0 |

⚠️ **Still needed before the water numbers are real:** each crop's Kc (mid-season crop coefficient, FAO-56 Table 12) for the water-use part. The stress-line part above is ready now. Don't show per-crop gallons until Kc is looked up and cited.

Layout: a slider "Keep the soil at __%" (same control as the live page), then one row per crop: name, its stress line drawn as a tick on a 20-65% bar, the baseline as a line across all rows, and a pill: **healthy** / **stressed**. Optional once Kc is in: run the part-1 bucket for that crop at that baseline in the browser (the weather is already in `sim_data.json` via each day's rain; add daily ET0 to the JSON in `season_replay.py`) and show water used + stressed hours.

What judges should get: "Farm Hand lets you set the level per crop. Strawberries need 56%, sugarcane is fine at 36%. One timer can't do both."

### Make the sim data (needed once, then commit the JSON)

On the PC (has the model in `farm-hand/laya/model/farmhand-laya` and CUDA):
```
cd farm-hand
.venv\Scripts\python laya\season_replay.py
```
On a Mac:
```
cd farm-hand/laya
uv venv --python 3.12 .venv-mac && uv pip install --python .venv-mac/bin/python torch "transformers>=4.48.0" "laya>=0.1.6" safetensors huggingface_hub requests
.venv-mac/bin/hf auth login          # the model repo chinchop/farmhand-laya is private
.venv-mac/bin/hf download chinchop/farmhand-laya --local-dir model/farmhand-laya
.venv-mac/bin/python season_replay.py
```
It writes `laptop/static/sim_data.json` (small, about 150-250 KB) and prints totals. Check them against `laya/data/eval.md`, then commit the JSON so the page works without the model.

### Shared UI work (all three pages)

From 5d, still to do (the `index.html` scan found these):
- **one radius scale**: `--r-ctl: 6px` (controls), `--r-panel: 12px` (panels), `999px` chips only. `sim.html` already uses these tokens; move `index.html`'s 28 `border-radius` lines onto them.
- **no eyebrow labels** above headings (2 in `index.html`)
- **no zero-offset glow** shadow (1 in `index.html`)
- **`tabular-nums` on every changing number** (only 2 today)
- readable from 3 m: tier-1 numbers ~96 px on a 1080p projector
- one red thing on screen at a time; alerts slide in, never modals
- UI transitions under 300 ms, `cubic-bezier(0.23, 1, 0.32, 1)`, nothing from `scale(0)`
- same header + 3-tab nav on every page, the current page marked
- test at 1920x1080 (projector), 1440x900 (laptop), 390 px (phone), and with `prefers-reduced-motion`

Skills: `design-skills/` (README says which to use for what). Prompts that work are in 5d.

### Order of work

1. Run the server once on the fake board with this branch (`set SERIAL_PORT=fake`) and look at `/` and `/sim`. Fix anything broken in the weather card.
2. 3-page nav + move the money graph off the live page.
3. Baseline slider on the live page (API ready).
4. Control page (`/control` route + `control.html`), first on the fake board, then with the real box B once it's wired.
5. Make the sim data, look at `/sim` with real data, polish.
6. Crops section on `/sim` (stress lines first, water numbers after Kc is cited).
7. 5d visual fixes across all three pages.
8. Screenshot all three pages at the 3 sizes; fix; done.

### Done checklist

- [ ] `/`, `/control`, `/sim` all load with 0 console errors, on the fake board and the real board
- [ ] live page shows box A only, and nothing estimated
- [ ] baseline slider moves the line on the band and in the 3D box, and survives a server restart
- [ ] control page numbers are all measured; water used per box adds up to the pours list
- [ ] sim page totals match `eval.md` (timer exact, Laya within a few mm)
- [ ] every simulated or estimated number is labeled as such where it's shown
- [ ] crops section shows no water numbers until Kc is cited
- [ ] 5d checklist passes on all three pages

### Hardware notes (handled by the hardware side, listed here so the software matches)

- Box B: probe on pin 33, relay on pin 27 through its own PN2222 + 1K (same as box A), its own pump. Probe VCC on the 3.3 V line (column 45), GND on the ground line (column 22).
- Box B's probe needs its own calibration (air and water raw numbers): `farm_hand.ino:30-31` still has box A's numbers copied for both, and `laptop/data/calibration.json` must match.
- Box B's pump flow needs measuring (`flow_ml_per_s.B` in `calibration.json`, default 20.0 is a guess).
- Two-box mode (`ONE_POT=0`) has only run in the Wokwi simulator so far. Run both boxes overnight before the event.

## 5f. Where Farm Hand fits: the AlphaEarth farm map (2026-09-26)

**Replaced by AlphaEarth v2 (see 5g).** This first map is not linked from the demo any more; its page stays reachable.

**Live:** https://farmhand.dmchang.xyz/farmhand/fields/ (served by the Mac mini). Code: `farm-hand/alphaearth/`.

The scale story as a real map, not an illustration: Miami-Dade's farm belt (Redland / Homestead, just south of FIU), found from space with Google DeepMind's **AlphaEarth Foundations** Satellite Embedding dataset. Strong for the Google Cloud and AI for Social Good tracks (a DeepMind model on Google's data).

### What AlphaEarth is (one line for judges)
A DeepMind model that turns every 10 m square of land into 64 numbers (a "fingerprint") each year, from optical, radar, elevation and climate data, through clouds. Free, CC-BY 4.0, read straight from Google's public bucket (no account needed).

### What the page shows (numbers from `alphaearth/out/fields.json`)
| | |
|---|---|
| Farmland in 2025, found by AlphaEarth | **17,825 acres** (USDA's 2024 map: 22,121; ours is conservative) |
| Farm fields | **690** (connected patches of 1.2+ acres; an estimate) |
| Changed most, 2024 → 2025 | **2,674 acres** (top 15% fingerprint change on farmland) |
| Farm Hand stations to cover it | **690** (one per field) to **1,783** (one per 10 acres) |
| How good the farmland map is | **87% right** on 66,312 squares it never trained on |

Layers (toggle): farmland 2025 (green), changed most (orange), USDA 2024 farmland (the answer key, blue), AlphaEarth's own view (64 numbers squeezed to 3 colors). Satellite basemap: Esri World Imagery. A pin marks the Farm Hand box at FIU.

### How it's built (`alphaearth/build_fields.py`, about 1 minute)
1. Reads the AlphaEarth 2024 + 2025 images for the box (25.43–25.62°N, 80.60–80.40°W) at 40 m, only that window (range requests on the COG). Tiles are stored **south-up**; the script flips them.
2. Trains a gradient-boosting classifier: AlphaEarth 2024 fingerprint → farmland or not, with **USDA's Cropland Data Layer 2024** as the answer key (crops + fallow = farmland; pasture, developed, forest, wetland, water = not). 70/30 split; 87% held-out accuracy (F1 0.72; logistic regression got 81%).
3. Predicts 2025 farmland from the 2025 fingerprints (USDA hasn't published 2025).
4. Change = 1 − cosine similarity of each farm pixel's 2024 vs 2025 fingerprint; top 15% = "changed most".
5. Fields = connected farm patches ≥ 3 pixels. Writes PNG layers + `fields.json` to `alphaearth/out/`.
Rerun: `python farm-hand/alphaearth/build_fields.py`, then copy `fields.html`, `out/fields.json`, `out/*.png` to `~/farmhand-server/fields/` on the Mac mini.

### Honesty rules (say these, they're also on the page)
- "Farmland 2025" is a **prediction** from AlphaEarth, checked against USDA's 2024 map (87%). Not a survey.
- "Changed most" is **not proof of drought damage.** Harvest timing and replanting change fingerprints too. Say "changed most in the drought year", never "died in the drought".
- Field and station counts are **estimates** for sizing, not a quote.
- AlphaEarth is **yearly**. It can't see today's soil. That's the pitch line: *"Satellites see a field once a year. Farm Hand feels the soil every second."*
- Attribution (required, CC-BY 4.0): "The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind." + USDA NASS Cropland Data Layer 2024.

### For Matthew (UI)
- Put it on the **Simulation page** as the "outside, at scale" section (replaces the illustrated "A whole field" view from 5b). Either embed `/farmhand/fields/` in an iframe, or rebuild it in `ui-mui` with the same layers: the PNGs + `fields.json` are the data (bounds = `box_wsen`).
- Demo order: live box → control box → season replay → **this map** ("and here's every farm in Miami-Dade that needs one").
- Nice next step (not built): click a field → "a Farm Hand station here would cost / save …", or AlphaEarth similarity search ("fields most like this one").

## 5g. The UI is Prompt Grass now (2026-09-26)

**What changed.** The team switched the Farm Hand frontend to the Prompt Grass Grow Grass web app: `farm-hand/web/` (Vite + React + three.js, MIT, license in `farm-hand/web/LICENSE-PromptGrassGrowGrass`, upstream commit in `farm-hand/web/UPSTREAM_COMMIT`). It is wired to the Mac mini's `/farmhand/api` (server: `farm-hand/cloud/receiver.py`; the browser code talks to it through `src/data/backendBoard.ts`). The license file stays in the folder; nothing about it is shown on the site.

- **ui-mui** (Matthew's MUI UI) stays in the repo but is no longer deployed.
- **The 3D scene** now shows the two real boxes (box A Farm Hand, box B Timer) from `farmhand.glb`, driven by live readings.
- **Deploy:** the Mac mini builds `farm-hand/web` from `main` every minute. Push to `main` and it is live at https://farmhand.dmchang.xyz/farmhand/ within about a minute.

**The screen (redesign, 2026-09-26 evening).** The 3D model of the two boxes fills the whole screen under a slim top bar (name, "Watches your crop so you don't have to. Saves time, money, water, and the crop.", live pill). A dock at the bottom opens one panel at a time over the scene (Esc or a click on the scene closes it; the open panel is in the URL hash, e.g. `#map`):

| Dock button | Panel |
|---|---|
| **Box A / Box B** (shows moisture or "no probe") | moisture %, temperature °C, one quiet amber line if a probe isn't reporting, pump row ("off, disarmed until wiring is confirmed"), raw reading |
| **Laya's call** (shows the pick) | Water now / Holding off / Waiting for rain, seconds, the why, the time. "Decided by Laya" or "Decided by the safety rule: probe A isn't reporting, so Laya doesn't guess." |
| **Saves** | the four savings: time (soil checks done, from `/farmhand/data` count), money ($72.94 parts vs $1,200-1,512 + $309/yr for one commercial sensor), water (56% less than a timer, simulated field on real weather), crop (0 h stress vs 12 h, same replay; plus box A's live time at or above 45%) |
| **History** | moisture over time, A vs B, 45% line, drag to replay in 3D |
| **Forecast** | Open-Meteo rain, next 7 days |
| **Crops** | per box: "With soil at 38.2% moisture and 26.1 °C, these crops can survive in Box A:" grouped Thrive / Can survive / Would struggle, one short reason each. The engine (`src/data/sim/crops.ts`) now has a moisture factor: FAO-56 depletion fraction p per crop, dryness line = 20 + 45 x (1 - p). No probe: "Plug in the probes to see which crops fit." |
| **Map** ("Farms near you") | the real 1,100 AlphaEarth v2 fields as polygons over Esri satellite imagery (Leaflet), bright color per predicted crop, a big always-on legend "What grows here (Google satellite data)", "Your boxes (FIU)" pin. Tap a farm: crop, acres, distance, soil in plain words, the moisture Farm Hand would keep it above, similar farms outlined. Sources in "How we know". |

**Removed from Prompt Grass, and why:** the voice assistant (voice orb, `src/voice/`) and the in-browser WebMCP agent (`src/agent/`, agent presence, demo panel): they depend on the Prompt Grass backend and its voice service, and Farm Hand's AI is Laya on the Mac mini. The onboarding flow (draw the plot, place probes, set location, calibrate in the app): the boxes are set up on the bench and calibrated in firmware. The pour test, diagnose and the Network page: Farm Hand has no data for them. Fonts: Fraunces and Inter replaced by Archivo (one family; JetBrains Mono only for raw sensor counts). Theme: light, for a projector in a bright hall (5d).

**Kept and redesigned:** crops, planting window and frost dates, and the region view, which is now a headline feature powered by AlphaEarth v2 (this replaces the 5f map; see the note there).

**Design rules applied** (from `design-skills/`: taste-skill, impeccable craft floor, Emil's motion rules, Owl-Listener density / Miller / Von Restorff / Doherty): one radius scale (6 px controls, 12 px panels, pill for chips), no eyebrow labels, no glow halos, no emoji, no em dashes, tabular numbers on everything that changes, one red thing at a time (only "Offline" is red; a disconnected probe is amber), UI transitions 140-240 ms ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, nothing from `scale(0)`, `prefers-reduced-motion` respected, themed focus rings, selection and scrollbars.

**Checklist for Matthew**
- [ ] Open https://farmhand.dmchang.xyz/farmhand/ on the projector at 1920x1080. The moisture and temperature numbers must read from 3 m.
- [ ] Unplug a probe: its box says "Probe disconnected" (not a number) within one reading.
- [ ] Laya's call updates when the server logs a new decision; "Decided by" says Laya or the baseline rule.
- [ ] Pump rows say "disarmed until wiring is confirmed" until the firmware arms the pumps; then flip `pumpsArmed` in `farm-hand/web/src/brand.ts` (or have the server send it).
- [ ] Crops panel: with probes in, each box lists Thrive / Can survive / Would struggle; with a probe out it says "Plug in the probes".
- [ ] Map panel: 1,100 farms over satellite imagery, the legend is readable from 3 m, a tap opens the farm card.
- [ ] Check it at 1440x900 and on a phone (390 px wide).
- [ ] Don't edit `ui-mui` for the demo; it is not deployed.

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
   - Retail check 2026-09-26: one CropX Vertex V4 sensor is $1,200 with the first year of data (Roberts Irrigation) or $1,512 for the kit (IrrigationBox), and the data subscription is $309/yr after. Line: "One commercial soil sensor costs $1,200 to $1,500. Our entire parts order was $72.94, and that's 5 probes." Our $72.94 is hobby-grade parts, not a weatherproofed field product; say so if asked.

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

## 12. Fake-run results (FakeBoard, code tests only, NEVER for slides)

⚠️ These 2 runs happened in this session, but their database was wiped before the proof files existed, so there are no saved rows behind them. Treat them as lessons, not data.

| Run | AI pot | Timer pot | What it taught us |
|---|---|---|---|
| v1 rule brain, 300x speed | 926 ml, 29 pours | 500 ml | The AI took 1-second sips all day. Fixed: it only waters within 5 points of the dry line, then gives one real drink. |
| v2 after the fix | 547 ml, 2 pours | 400 ml | A timer sized *perfectly* is hard to beat. The real savings come from rain skips (outdoors) and from real timers being oversized. |

Both runs used a fake world with no rain and a timer tuned to that exact pot. The real test in section 4 decides the pitch number.

---

## Appendix: all the code

Copied from the real files by `build_plan.py`. Edit the files, not this appendix.

Set up the laptop side once:

```
cd Documents\code\shellhacks2025\farm-hand
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r laptop\requirements.txt
```

### `firmware/farm_hand/farm_hand.ino`

```cpp
// Farm Hand ESP32 firmware.
// The chip does NO AI. It reads the soil, runs the pumps when told, and enforces the safety rules.
// The laptop talks to it over USB serial (115200). Every line the chip prints is one JSON object.
//
// Wiring (PLAN.md section 2, pictures at http://127.0.0.1:8097/assemble). One pot, all on USB power:
//   Soil A  AOUT -> 32 (VCC 3V3, GND GND). ADC1 pins only. Pin 33 (pot B) is empty: ONE_POT on the laptop ignores it.
//   DS18B20 via the adapter board (pull-up built in): DAT -> 4, VCC -> 3V3, GND -> GND.
//   Relay: DC+ -> VIN, DC- -> GND, jumper on L. IN is driven by a PN2222 (E -> GND, B -> 1K -> pin 26, C -> IN),
//     so pin 26 HIGH = relay on. Relay DC+ -> COM, NO -> pump red, pump black -> DC-.
//   Proven 2026-09-23: a 10 s pour on USB power, no brownout.
//
// Commands from the laptop (one per line):
//   P A 3000     pour pot A for 3000 ms (capped at 30000)
//   T 21600 5000 pot B timer: every 21600 s pour 5000 ms   (T 0 = timer off)
//   S            print a reading now
//   X            emergency stop both pumps

#include <OneWire.h>
#include <DallasTemperature.h>

#define SIM 0                          // 1 in Wokwi: its relay turns on with HIGH
const bool RELAY_ACTIVE_LOW = false;   // transistor driver (PN2222 on D26, jumper on L): HIGH = relay on

const int PIN_SOIL[2] = {32, 33};
const int PIN_PUMP[2] = {26, 27};
const int PIN_TEMP = 4;
const char POT_NAME[2] = {'A', 'B'};

// CALIBRATE on Sep 23: raw number with the probe in dry air, and in a cup of water (only up to the line).
int RAW_AIR[2]   = {3400, 3400};   // measured 2026-09-23 on the real probe
int RAW_WATER[2] = {1507, 1507};

const unsigned long PUMP_CAP_MS = 30000;   // a pump can never run longer than this in one go
const unsigned long PUMP_GAP_MS = 5000;    // wait between pours: never both pumps at once (brownout)
const unsigned long REPORT_MS   = 1000;    // 1 reading a second: the live view + pour detector need it

unsigned long timerEveryMs = 6UL * 3600UL * 1000UL;   // pot B default: every 6 h
unsigned long timerPourMs  = 5000;                    // for 5 s
unsigned long lastTimerAt  = 0;
bool timerPending = false;

int activePot = -1;                // which pump is running, -1 = none
unsigned long pourStart = 0, pourMs = 0, lastPourEnd = 0, lastReport = 0;
String pourBy = "";

OneWire oneWire(PIN_TEMP);
DallasTemperature temp(&oneWire);
String line;

void pumpWrite(int pot, bool on) {
  digitalWrite(PIN_PUMP[pot], (on != RELAY_ACTIVE_LOW) ? HIGH : LOW);
}

int readRaw(int pot) {
  long sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(PIN_SOIL[pot]);
  return sum / 16;
}

// probe reads HIGH when dry, LOW when wet -> 0% = air, 100% = cup of water
int pct(int pot, int raw) {
  long p = (long)(RAW_AIR[pot] - raw) * 100 / (RAW_AIR[pot] - RAW_WATER[pot]);
  return constrain(p, 0, 100);
}

void report() {
  // read the conversion started LAST report, then start the next one. Non-blocking: a real DS18B20
  // takes ~750 ms per conversion, and blocking here would let pours overrun the 30 s cap.
  float c = temp.getTempCByIndex(0);
  temp.requestTemperatures();
  int ra = readRaw(0), rb = readRaw(1);
  Serial.printf("{\"type\":\"reading\",\"ms\":%lu,\"a_raw\":%d,\"b_raw\":%d,\"a_pct\":%d,\"b_pct\":%d,\"temp_c\":%s,\"pumping\":\"%s\"}\n",
                millis(), ra, rb, pct(0, ra), pct(1, rb),
                c < -100 ? "null" : String(c, 1).c_str(),
                activePot < 0 ? "none" : (activePot == 0 ? "A" : "B"));
}

bool startPour(int pot, unsigned long ms, const char *by) {
  if (activePot >= 0) { Serial.printf("{\"type\":\"refused\",\"pot\":\"%c\",\"why\":\"busy\"}\n", POT_NAME[pot]); return false; }
  if (millis() - lastPourEnd < PUMP_GAP_MS && lastPourEnd != 0) { Serial.printf("{\"type\":\"refused\",\"pot\":\"%c\",\"why\":\"gap\"}\n", POT_NAME[pot]); return false; }
  ms = min(ms, PUMP_CAP_MS);
  activePot = pot; pourStart = millis(); pourMs = ms; pourBy = by;
  pumpWrite(pot, true);
  Serial.printf("{\"type\":\"pour_start\",\"pot\":\"%c\",\"ms\":%lu,\"by\":\"%s\"}\n", POT_NAME[pot], ms, by);
  return true;
}

void stopPour(const char *why) {
  if (activePot < 0) return;
  pumpWrite(activePot, false);
  unsigned long ran = millis() - pourStart;
  Serial.printf("{\"type\":\"pour_done\",\"pot\":\"%c\",\"ran_ms\":%lu,\"by\":\"%s\",\"why\":\"%s\"}\n",
                POT_NAME[activePot], ran, pourBy.c_str(), why);
  activePot = -1; lastPourEnd = millis();
}

void handle(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  char c = cmd[0];
  if (c == 'P') {                                   // P A 3000
    int pot = (cmd.length() > 2 && cmd[2] == 'B') ? 1 : 0;
    unsigned long ms = cmd.substring(4).toInt();
    if (ms == 0) { Serial.println("{\"type\":\"error\",\"why\":\"usage: P A 3000\"}"); return; }
    startPour(pot, ms, "laptop");
  } else if (c == 'T') {                            // T 21600 5000
    int sp = cmd.indexOf(' ', 2);
    unsigned long every = cmd.substring(2, sp < 0 ? cmd.length() : sp).toInt();
    timerEveryMs = every * 1000UL;
    if (sp > 0) timerPourMs = cmd.substring(sp + 1).toInt();
    lastTimerAt = millis();
    timerPending = false;   // T 0 cancels a pour that was already waiting
    Serial.printf("{\"type\":\"timer\",\"every_s\":%lu,\"pour_ms\":%lu}\n", every, timerPourMs);
  } else if (c == 'S') {
    report();
  } else if (c == 'X') {
    stopPour("emergency_stop");
    pumpWrite(0, false); pumpWrite(1, false);
  } else {
    Serial.println("{\"type\":\"error\",\"why\":\"unknown command\"}");
  }
}

void setup() {
  // OFF level first, THEN make them outputs, so the pumps don't blip at boot
  for (int i = 0; i < 2; i++) { pumpWrite(i, false); pinMode(PIN_PUMP[i], OUTPUT); pumpWrite(i, false); }
  Serial.begin(115200);
  analogReadResolution(12);
  temp.begin();
  temp.setWaitForConversion(false);   // never block the loop waiting on the temp probe
  temp.requestTemperatures();
  lastTimerAt = millis();
  Serial.printf("{\"type\":\"boot\",\"fw\":\"farm-hand-1\",\"sim\":%d,\"probes\":%d}\n", SIM, temp.getDeviceCount());
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') { handle(line); line = ""; } else if (ch != '\r') line += ch;
  }
  if (activePot >= 0 && millis() - pourStart >= pourMs) stopPour("time_up");
  if (activePot >= 0 && millis() - pourStart >= PUMP_CAP_MS) stopPour("safety_cap");

  if (timerEveryMs > 0 && millis() - lastTimerAt >= timerEveryMs) { timerPending = true; lastTimerAt = millis(); }
  // timer waits quietly until the pump is free and the gap has passed (no refused spam)
  bool pumpFree = activePot < 0 && (lastPourEnd == 0 || millis() - lastPourEnd >= PUMP_GAP_MS);
  if (timerPending && pumpFree && startPour(1, timerPourMs, "timer")) timerPending = false;

  if (millis() - lastReport >= REPORT_MS) { lastReport = millis(); report(); }
  delay(10);
}
```

### `laptop/config.py`

```python
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
```

### `laptop/board.py`

```python
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
```

### `laptop/store.py`

```python
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
```

### `laptop/feeds.py`

```python
"""Outside data: rain forecast (Open-Meteo, free, no key), drought level (US Drought Monitor, free, no key),
and the local watering-day rule. Each call is cached so the agent loop doesn't hammer the APIs.
Tested live 2026-09-22: both endpoints answered."""
import datetime as dt
import time

import requests

import config

_cache = {}


def _cached(key, ttl_s, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl_s:
        return hit[1]
    try:
        val = fn()
    except Exception as e:                       # venue WiFi died: keep the last good value
        if hit:
            return {**hit[1], "stale": True}
        return {"error": f"{type(e).__name__}: {e}"}
    _cache[key] = (time.time(), val)
    return val


def forecast():
    """Next 24 h: rain chance, rain mm, and ET0 (how much water the air pulls out of soil)."""
    def get():
        r = requests.get("https://api.open-meteo.com/v1/forecast", timeout=15, params={
            "latitude": config.LAT, "longitude": config.LON, "forecast_hours": 24,
            "hourly": "precipitation_probability,precipitation,et0_fao_evapotranspiration,temperature_2m",
            "timezone": "America/New_York"})
        r.raise_for_status()
        h = r.json()["hourly"]
        rain_mm = [x or 0 for x in h["precipitation"]]
        prob = [x or 0 for x in h["precipitation_probability"]]
        first_rain = next((i for i, (p, mm) in enumerate(zip(prob, rain_mm)) if p >= 50 and mm >= 1.0), None)
        return {
            "rain_mm_next_6h": round(sum(rain_mm[:6]), 1),
            "rain_mm_next_24h": round(sum(rain_mm), 1),
            "max_rain_chance_next_6h": max(prob[:6]),
            "max_rain_chance_next_24h": max(prob),
            "hours_until_real_rain": first_rain,            # None = no solid rain in 24 h
            "et0_mm_next_24h": round(sum(x or 0 for x in h["et0_fao_evapotranspiration"]), 2),
            "temp_c_now": h["temperature_2m"][0],
            "source": "open-meteo.com",
        }
    return _cached("forecast", 15 * 60, get)


def drought():
    """Latest weekly US Drought Monitor numbers for the county. Percent of the county in each level (cumulative)."""
    def get():
        end = dt.date.today()
        start = end - dt.timedelta(days=21)
        r = requests.get(
            "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent",
            timeout=30, headers={"Accept": "application/json"},
            params={"aoi": config.DROUGHT_FIPS, "startdate": f"{start.month}/{start.day}/{start.year}",
                    "enddate": f"{end.month}/{end.day}/{end.year}", "statisticsType": 1})
        r.raise_for_status()
        rows = sorted(r.json(), key=lambda x: x["mapDate"])
        if not rows:
            return {"error": "no drought rows"}
        w = rows[-1]
        levels = [("D4", "exceptional"), ("D3", "extreme"), ("D2", "severe"), ("D1", "moderate"), ("D0", "abnormally dry")]
        worst = next(((k, name) for k, name in levels if float(w[k.lower()]) >= 25), ("none", "no drought"))
        return {
            "county": w["county"], "week_of": w["mapDate"][:10],
            "pct_in_D1_or_worse": float(w["d1"]), "pct_in_D2_or_worse": float(w["d2"]),
            "pct_in_D3_or_worse": float(w["d3"]), "pct_in_D4": float(w["d4"]),
            "level": worst[0], "level_name": worst[1],
            "source": "droughtmonitor.unl.edu",
        }
    return _cached("drought", 6 * 3600, get)


def watering_day(now=None):
    """Miami-Dade year-round landscape rule (VERIFY on miamidade.gov before the demo):
    odd addresses Wed + Sat, even addresses Thu + Sun, only before 10 am or after 4 pm."""
    now = now or dt.datetime.now()
    days = {"odd": (2, 5), "even": (3, 6)}[config.ADDRESS_PARITY]      # Mon=0
    legal_day = now.weekday() in days
    legal_hour = now.hour < 10 or now.hour >= 16
    return {
        "legal_now": legal_day and legal_hour,
        "legal_day": legal_day, "legal_hour": legal_hour,
        "rule": f"{config.ADDRESS_PARITY} address: {'Wed+Sat' if config.ADDRESS_PARITY == 'odd' else 'Thu+Sun'}, before 10am or after 4pm",
        "note": "Farms (agricultural irrigation) follow different district rules; this is the home-lawn rule for the demo.",
    }
```

### `laptop/predictor.py`

```python
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
```

### `laptop/soak.py`

```python
"""Pour detector: after every pour, watch the probe and measure what the water actually did.

  before_pct    moisture right before the pump started (median of the last readings)
  first_rise_s  seconds until the probe first saw +1% (how long the water took to reach the probe)
  rise_pct      how much the moisture went up (peak - before)
  pct_per_s     rise_pct / seconds poured  -> the agents use this to size the next pour (self-calibrating)
  ok            False if the probe barely moved: pump dry, tube kinked, or water missing the pot

"""
import statistics
import threading
import time

import store

WATCH_S = 180          # how long to watch after a pour (real seconds)
RISE_SEEN = 1.0        # +1% = the water reached the probe
MIN_OK_RISE = 1.5      # less than this after a full watch = something's wrong

live = {"phase": "idle"}   # the dashboard's 3D view reads this
# Hand pour: someone (a judge) poured water in with no pump running. The probe jumps and the dashboard shows a banner.
HAND_RISE = 4.0            # +4% over the last ~1-2 min with the pump quiet = water came from a person
PUMP_QUIET_S = 240         # the pump's own water can still be arriving for this long after a pour
hand = {"phase": "idle"}   # {"phase": "seen", "ts", "before", "now", "rise"} while fresh
PAUSED = False             # True during a Hit-the-Target run: target.py measures its own pulses
WATCHER = None             # the one SoakWatcher (target.py reads its recent readings)


class SoakWatcher:
    def __init__(self, board, speed=1.0):
        self.board = board
        self.watch_s = WATCH_S / speed
        self.hist = {"A": [], "B": []}          # (ts, pct) recent readings
        self.long = []                          # pot A, last ~3 min, for the hand-pour check
        self.last_pump = 0.0
        board.listeners.append(self.on_line)
        global WATCHER
        WATCHER = self

    def on_line(self, obj):
        t = obj.get("type")
        if t == "reading":
            for pot, key in (("A", "a_pct"), ("B", "b_pct")):
                self.hist[pot] = (self.hist[pot] + [(time.time(), obj[key])])[-30:]
            if obj.get("pumping", "none") != "none":
                self.last_pump = time.time()
            self.check_hand(obj["a_pct"])
        elif t == "pour_start":
            self.last_pump = time.time()
        if t == "pour_start" and not PAUSED:
            pot = obj["pot"]
            before = [v for _, v in self.hist[pot][-6:]]
            if before:
                threading.Thread(target=self.watch, args=(pot, obj["ms"] / 1000, statistics.median(before)), daemon=True).start()

    def check_hand(self, pct):
        now_t = time.time()
        self.long = [(ts, v) for ts, v in self.long if now_t - ts < 180] + [(now_t, pct)]
        if hand.get("phase") == "seen":
            if now_t - hand["ts"] < 90:                         # still soaking in: keep the banner's number growing
                v = statistics.median([v for _, v in self.long[-5:]])
                hand.update(now=round(v, 1), rise=round(max(hand["rise"], v - hand["before"]), 1))
                return
            if now_t - hand["ts"] < 180:
                return                                          # cooldown, so one pour = one banner
            hand.clear(); hand["phase"] = "idle"
        base = [v for ts, v in self.long if 45 <= now_t - ts <= 120]
        if len(base) < 10 or len(self.long) < 5 or PAUSED or now_t - self.last_pump < PUMP_QUIET_S:
            return
        before, v = statistics.median(base), statistics.median([v for _, v in self.long[-5:]])
        if v - before >= HAND_RISE:
            hand.clear(); hand.update(phase="seen", ts=now_t, before=round(before, 1), now=round(v, 1), rise=round(v - before, 1))
            print("[soak] hand pour seen", hand)

    def watch(self, pot, poured_s, before):
        t0 = time.time()
        peak, first = before, None
        live.update(phase="soaking", pot=pot, before=before, now=before, t0=t0, watch_s=self.watch_s, poured_s=poured_s)
        while time.time() - t0 < self.watch_s:
            time.sleep(0.5)
            if not self.hist[pot]:
                continue
            v = self.hist[pot][-1][1]
            peak = max(peak, v)
            live["now"] = v
            if first is None and v >= before + RISE_SEEN:
                first = time.time() - t0
        rise = round(peak - before, 1)
        ok = rise >= MIN_OK_RISE
        note = ("water reached the probe" if ok else
                "probe barely moved: check the pump is in water, the tube isn't kinked, and the tube points at the pot")
        d = {"pot": pot, "poured_s": poured_s, "before_pct": round(before, 1), "peak_pct": round(peak, 1),
             "rise_pct": rise, "first_rise_s": round(first, 1) if first is not None else None,
             "pct_per_s": round(rise / poured_s, 3) if poured_s else None, "ok": ok, "note": note}
        store.add_soak(d, self.board.fake)
        live.clear(); live.update(phase="done", last=d, t_done=time.time())
        print("[soak]", d)


def learned_pct_per_s(pot="A", default=1.2):
    """Median of the last 5 good soaks. This is how the system learns its own pump + soil."""
    vals = [r[7] for r in store.soaks(20) if r[1] == pot and r[8] and r[7]]
    return round(statistics.median(vals[:5]), 3) if vals else default
```

### `laptop/target.py`

```python
"""Hit the Target: a judge picks a moisture %, Farm Hand walks the soil up to it in short pulses and stops inside the band.

Each pulse:
  1. read the soil (median of the last readings, so probe noise can't fool it)
  2. size the pulse from the rate it has learned: seconds = gap / pct_per_s, times 0.7 so it creeps up instead of overshooting
  3. pump, then wait for the water to reach the probe and the reading to go flat (settle)
  4. measure what that pulse really did and update the rate (this soil + this pump, learned live)
  5. if the pump ran but the probe barely moved -> STOP and say so (pinched tube, pump out of water, tube missing the pot)

It can only ADD water, so a target below the current reading ends right away with "already above target".
Safety: every pulse still passes brain.guards() (board online, not already wet, daily cap). The 30-minute gap between
AI pours is skipped here because a person started this run on purpose and is standing next to the pot.
"""
import statistics
import threading
import time

import brain
import config
import soak
import store

BAND = 2.0            # +/- % counts as "hit"
LOCK = 1.0            # keep pulsing until within 1% below the target (then stop: it can't take water back out)
MAX_PULSES = 6
PULSE_MAX_S = 8.0     # no single long pour: it creeps up
PULSE_MIN_S = 1.0
CREEP = 0.7           # aim for 70% of the gap each pulse
MIN_SETTLE_S = 12     # water needs time to reach the probe
MAX_SETTLE_S = 90     # after this, whatever the probe says is the answer
FLAT = 0.4            # two 10-reading medians this close = the reading stopped moving
MISS_RISE = 0.8       # floor for "the water arrived" (probe noise is about +/- 1%)
MISS_SHARE = 0.3      # a pulse that did under 30% of what the learned rate expects didn't reach the soil
CHECKABLE = 3.0       # only judge "water isn't arriving" on pulses expected to add 3%+ (small ones drown in probe noise)

run = {"phase": "idle"}      # the dashboard reads this through /api/live
_lock = threading.Lock()
_stop = threading.Event()


def _vals(n):
    h = soak.WATCHER.hist["A"] if soak.WATCHER else []
    return [v for _, v in h[-n:]]


def _now_pct():
    v = _vals(6)
    return round(statistics.median(v), 1) if v else None


def _wait(s):
    return _stop.wait(s)      # True = someone hit stop


def _settle(before, pulse_s, need):
    """Wait for the pump to finish, then for the reading to go flat. Returns (after_pct, seconds_waited)."""
    t0 = time.time()
    while (brain.BOARD.latest or {}).get("pumping", "none") != "none" and time.time() - t0 < pulse_s + 10:
        if _wait(.5):
            return None, 0
    t1 = time.time()
    while time.time() - t1 < MAX_SETTLE_S:
        if _wait(1):
            return None, 0
        run["now"] = _now_pct()
        v = _vals(20)
        if time.time() - t1 >= MIN_SETTLE_S and len(v) >= 20:
            a, b = statistics.median(v[:10]), statistics.median(v[10:])
            if abs(b - a) < FLAT and b - before >= need:
                break
    return _now_pct(), round(time.time() - t1)


def _go(target):
    rate = brain.pct_per_s()
    flow = config.load_cal()["flow_ml_per_s"]["A"]
    start = _now_pct()
    t_start = time.time()
    run.clear()
    run.update(phase="reading", target=target, band=BAND, start=start, now=start, rate=rate, pulses=[], t0=t_start,
               msg=f"Soil is {start}%. Target {target}%.")
    brain.log_act("target_agent", f"target {target}%, soil {start}%")
    soak.PAUSED = True                                   # this run measures its own pulses (the 3-min watcher would overlap them)
    try:
        for i in range(MAX_PULSES):
            now = _now_pct()
            run["now"] = now
            if now is None:
                return _end("fault", "No readings from the board.")
            if now >= target - LOCK:
                return _end("locked" if now <= target + BAND else "over",
                            f"Locked at {now}%, target {target}%." if now <= target + BAND
                            else (f"Overshot: the last pulse took the soil to {now}%, past the {target}% target." if run["pulses"]
                                  else f"Soil is {now}%, already above the {target}% target. Water can't be taken back out."))
            gap = target - now
            secs = round(max(PULSE_MIN_S, min(PULSE_MAX_S, gap / rate * CREEP)), 1)
            ok, why, _ = brain.guards(secs, skip_gap=True)
            if not ok:
                return _end("blocked", f"Safety rules stopped it: {why}.")
            run.update(phase="pulsing", msg=f"Pulse {i + 1}: {secs} s. Gap {gap:.1f}%, learned {rate:.2f} % per second.")
            brain.log_act("target_agent", f"pulse {i + 1}: {secs}s for a {gap:.1f}% gap")
            brain.log_act("executor", f"pump A {secs:.0f}s")
            sent = time.time()
            brain.BOARD.tag_next = "target"
            brain.BOARD.pour("A", int(secs * 1000))
            ev = None
            while ev is None and time.time() - sent < 3:           # did the chip actually start the pump?
                ev = next((e for e in brain.BOARD.events[::-1] if e.get("ts", 0) >= sent - .5
                           and e.get("pot") == "A" and e.get("type") in ("pour_start", "refused")), None)   # FakeBoard/firmware both tag pot
                if ev is None and _wait(.2):
                    return _end("stopped", "Stopped.")
            if ev is None or ev["type"] == "refused":
                return _end("blocked", "The chip didn't start the pump (" + (ev or {}).get("why", "no answer") + "). No water went in.")
            run["phase"] = "settling"
            expect = rate * secs
            need = max(MISS_RISE, MISS_SHARE * expect) if expect >= CHECKABLE else 0.0
            after, waited = _settle(now, secs, need)
            if after is None:
                return _end("stopped", "Stopped.")
            rise = round(after - now, 1)
            store.add_soak({"pot": "A", "poured_s": secs, "before_pct": now, "peak_pct": after, "rise_pct": rise,
                            "first_rise_s": None, "pct_per_s": round(rise / secs, 3), "ok": rise >= max(need, MISS_RISE),
                            "note": "target pulse"}, brain.BOARD.fake)
            run["pulses"].append({"s": secs, "before": now, "after": after, "rise": rise, "wait_s": waited})
            if need and rise < need:
                brain.log_act("target_agent", f"pulse {i + 1} moved the probe only {rise}%: stopping")
                return _end("fault", f"The pump ran {secs} s, that should add about {rate * secs:.1f}%, but the probe moved {rise:+.1f}%. Water isn't reaching the soil: "
                                     "check the tube isn't pinched, the pump is under water, and the tube points at the pot.")
            if rise >= MISS_RISE:                            # a tiny pulse's rise is mostly noise: don't learn from it
                rate = round(.5 * rate + .5 * rise / secs, 3)  # learn: blend what it expected with what it just saw
            run["rate"] = rate
            brain.log_act("target_agent", f"pulse {i + 1}: +{rise}%, rate now {rate}")
        now = _now_pct()
        return _end("locked" if abs(now - target) <= BAND else "short", f"Out of pulses at {now}%, target {target}%.")
    finally:
        soak.PAUSED = False
        run["secs"] = round(sum(p["s"] for p in run.get("pulses", [])), 1)
        run["ml"] = round(run["secs"] * flow)
        run["took_s"] = round(time.time() - t_start)


def _end(phase, msg):
    run.update(phase=phase, msg=msg, now=_now_pct(), t_end=time.time())
    brain.log_act("target_agent", msg[:90])
    store.add_decision("water" if run.get("pulses") else "wait", sum(p["s"] for p in run.get("pulses", [])),
                       "target run", f"TARGET: {msg}", "{}")
    return dict(run)


def start(target):
    target = float(target)
    lo, hi = config.DRY_PCT, config.WET_PCT - BAND
    if not lo <= target <= hi:
        return {"ok": False, "why": f"pick a target between {lo:.0f}% and {hi:.0f}%"}
    if not _lock.acquire(blocking=False):
        return {"ok": False, "why": "a target run is already going"}
    _stop.clear()

    def job():
        try:
            _go(target)
        except Exception as e:
            _end("fault", f"Target run crashed: {e!r}"[:200])
        finally:
            _lock.release()
    threading.Thread(target=job, daemon=True).start()
    return {"ok": True}


def stop():
    _stop.set()
```

### `laptop/brain.py`

```python
"""The decision team. Every CHECK_EVERY_MIN minutes:

  1. GATHER (3 agents in parallel)
       weather_agent   rain forecast, drought level, watering rule
       soil_agent      Pot A + Pot B moisture, XGBoost "hours until dry"
       memory_agent    last 24 h: pours, what each pour actually did to the soil (pour detector), lessons learned
  2. DECIDE (loop, up to 3 rounds)
       planner_agent   proposes WATER n seconds or WAIT, with a reason and a farmer sentence
       critic_agent    checks the plan against the data. Approves, or sends it back with the problem.
  3. EXECUTE (code, not AI)
       only an approved WATER plan runs, and it still goes through guards() first
  4. LEARN (code, soak.py)
       the pour detector measures what the pour did; memory_agent reads it next cycle

Plus ask(): a chat agent that answers the farmer's questions from the same tools and the decision log.

Brains, in order of preference:
  gemini   GOOGLE_API_KEY set -> Google's Gemini API directly (use this at ShellHacks: Google tracks)
  gemini   RIGHTCODES_KEY_GEMINI set -> Gemini through the right.codes gateway (Dechante's testing lane)
  rules    no key, or the AI errored -> plain if-statements. The pots never go unwatered because WiFi died.
"""
import asyncio
import collections
import json
import os
import time

from google.adk.tools.tool_context import ToolContext

import config
import feeds
import predictor
import soak
import store

BOARD = None                                  # set by server.py
ACTIVITY = collections.deque(maxlen=200)      # what each agent is doing, for the live view
LAST = {"laya": None, "check": None}           # the dashboard's fast + smart strip: Laya's instant call, then how long the team took
LOW_MARGIN = 5                                # only water within 5 points of the dry line (no 1-second sips)
_last_action = {}


_loop = None


def _run(coro):
    """One long-lived event loop in a background thread, so the cached ADK runners never hit a closed loop."""
    global _loop
    import threading
    if _loop is None:
        _loop = asyncio.new_event_loop()
        threading.Thread(target=_loop.run_forever, daemon=True).start()
    fut = asyncio.run_coroutine_threadsafe(coro, _loop)
    try:
        return fut.result(timeout=config.AI_TIMEOUT_S)
    except BaseException:
        fut.cancel()            # stop the agents: no more paid calls, no orbs lighting up after the rules decided
        raise


def log_act(agent, what):
    ACTIVITY.append({"ts": time.time(), "agent": agent, "what": what})


def pct_per_s():
    return soak.learned_pct_per_s("A", default=1.2)


# ---------- tools (ADK reads the type hints + docstrings) ----------

def get_forecast() -> dict:
    """Rain forecast for the next 24 hours at the farm: rain chance, rain mm, hours until real rain, and ET0 (water the air pulls out of the soil). rain_reaches_pots says whether rain can even land on the pots."""
    return {**feeds.forecast(), "rain_reaches_pots": bool(config.OUTDOORS)}


def get_drought() -> dict:
    """This week's US Drought Monitor level for the county (e.g. D2 severe) and what % of the county is in drought."""
    return feeds.drought()


def get_watering_rule() -> dict:
    """Whether the local lawn-watering restriction allows watering right now. Farms follow different rules; treat this as advice."""
    return {**feeds.watering_day(), "enforced_by_code": bool(config.ENFORCE_WATERING_RULE)}


def get_soil(pot: str = "A") -> dict:
    """Live soil moisture % and soil temperature for pot 'A' (AI) or 'B' (timer), plus the predicted hours until it's dry."""
    b = BOARD.latest if BOARD else None
    if not b or time.time() - b["ts"] > 120:
        return {"error": "no fresh reading from the board in the last 2 minutes"}
    pot = "B" if str(pot).upper().startswith("B") else "A"
    return {"pot": pot, "moisture_pct": b["a_pct"] if pot == "A" else b["b_pct"], "soil_temp_c": b.get("temp_c"),
            "dry_below_pct": config.DRY_PCT, "wet_above_pct": config.WET_PCT, "target_pct": config.TARGET_PCT,
            "water_only_at_or_below_pct": config.DRY_PCT + LOW_MARGIN,
            "prediction": predictor.predict(pot)}


def get_memory() -> dict:
    """The last 24 hours: every pour on both pots, what each AI pour actually did to the soil (pour detector), and the learned % gained per second of pumping."""
    since = time.time() - 24 * 3600
    pours = store.pours_since(since)
    flow = config.load_cal()["flow_ml_per_s"]
    soaks = [dict(zip(("ts", "pot", "poured_s", "before_pct", "peak_pct", "rise_pct", "first_rise_s", "pct_per_s", "ok", "note"), r))
             for r in store.soaks(5)]
    for s in soaks:
        s["hours_ago"] = round((time.time() - s.pop("ts")) / 3600, 1)
        s["ok"] = bool(s["ok"])
    last = store.last_ai_pour_ts()
    return {
        "ai_pot_A": {"pours": sum(1 for p in pours if p[1] == "A"),
                     "ml": round(sum(p[2] for p in pours if p[1] == "A") / 1000 * flow["A"])},
        "timer_baseline": ({"what": "virtual timer, what a normal schedule would have poured",
                            "ml_last_24h": round(min(24 * 3600, time.time() - since) // config.TIMER_EVERY_S * config.TIMER_POUR_MS / 1000 * flow["A"])}
                           if config.ONE_POT else
                           {"what": "real pot B on a timer", "pours": sum(1 for p in pours if p[1] == "B"),
                            "ml": round(sum(p[2] for p in pours if p[1] == "B") / 1000 * flow["B"])}),
        "last_ai_pour_hours_ago": round((time.time() - last) / 3600, 1) if last else None,
        "recent_pour_results": soaks,
        "learned_pct_gain_per_second": pct_per_s(),
        "failed_pours_recently": sum(1 for s in soaks if not s["ok"]),
    }


def get_decision_log(n: int = 8) -> list:
    """The last n decisions the system made, newest first, with the sentence it gave the farmer."""
    return [{"hours_ago": round((time.time() - r[0]) / 3600, 2), "action": r[1], "seconds": r[2], "brain": r[3], "said": r[4]}
            for r in store.decisions(int(n))]


def propose_plan(action: str, seconds: float, reason: str, farmer_sentence: str, tool_context: ToolContext) -> dict:
    """Planner: propose the plan. action is 'water' or 'wait'. seconds = pump seconds (0 for wait). farmer_sentence starts with WATER: or WAIT:."""
    plan = {"action": action.lower().strip(), "seconds": float(seconds or 0), "reason": reason, "farmer_sentence": farmer_sentence}
    tool_context.state["plan"] = plan
    tool_context.state["approved"] = False
    log_act("planner_agent", f"proposed {plan['action']} {plan['seconds']:.0f}s")
    return {"saved": True, "plan": plan}


def approve_plan(note: str, tool_context: ToolContext) -> dict:
    """Critic: approve the planner's current plan. Ends the review."""
    tool_context.state["approved"] = True
    tool_context.state["critic_note"] = note
    tool_context.actions.escalate = True           # exits the LoopAgent
    log_act("critic_agent", "approved: " + note[:80])
    return {"approved": True}


def reject_plan(problem: str, tool_context: ToolContext) -> dict:
    """Critic: send the plan back to the planner with the exact problem to fix."""
    tool_context.state["approved"] = False
    tool_context.state["critic_feedback"] = problem
    log_act("critic_agent", "sent back: " + problem[:80])
    return {"approved": False, "problem": problem}


# ---------- hard rules (code, not AI) ----------

def guards(seconds, skip_gap=False):
    """Returns (ok, reason, seconds_allowed). The AI can't argue with this function.
    skip_gap=True only for a Hit-the-Target run a person started (target.py); every other rule still applies."""
    b = BOARD.latest if BOARD else None
    if not b or time.time() - b["ts"] > 120:
        return False, "board offline", 0
    if b["a_pct"] >= config.WET_PCT:
        return False, f"pot A already wet ({b['a_pct']}% >= {config.WET_PCT}%)", 0
    if soak.PAUSED and not skip_gap:
        return False, "a Hit-the-Target run is using the pump", 0
    gap = (time.time() - store.last_ai_pour_ts()) / 60
    if gap < config.AI_MIN_GAP_MIN and not skip_gap:
        return False, f"watered {gap:.0f} min ago, rule is {config.AI_MIN_GAP_MIN:.0f} min", 0
    today = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
    ml_today = sum(r[2] / 1000 * config.load_cal()["flow_ml_per_s"]["A"] for r in store.pours_since(today) if r[1] == "A")
    if ml_today >= config.DAILY_MAX_ML:
        return False, f"daily cap hit ({ml_today:.0f} ml)", 0
    if config.ENFORCE_WATERING_RULE and not feeds.watering_day()["legal_now"]:
        return False, "not a legal watering time under local restrictions", 0
    if soak.live.get("phase") == "soaking":
        return False, "last pour is still soaking in", 0
    return True, "ok", max(1.0, min(float(seconds), config.POUR_CAP_S))


def guard_report():
    """Live status of every hard rule, for the dashboard. Same checks as guards(), one row each."""
    b = BOARD.latest if BOARD else None
    fresh = bool(b and time.time() - b["ts"] <= 120)
    gap = (time.time() - store.last_ai_pour_ts()) / 60 if store.last_ai_pour_ts() else None
    today = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
    ml_today = sum(r[2] / 1000 * config.load_cal()["flow_ml_per_s"]["A"] for r in store.pours_since(today) if r[1] == "A")
    rows = [
        ("Board online", fresh, "reading " + (f"{time.time() - b['ts']:.0f} s ago" if b else "none yet")),
        ("Pot A not already wet", fresh and b["a_pct"] < config.WET_PCT, f"{b['a_pct']:.1f}% (limit {config.WET_PCT:.0f}%)" if b else "–"),
        ("Gap since last AI pour", gap is None or gap >= config.AI_MIN_GAP_MIN,
         (f"{gap:.0f} min" if gap is not None else "no pours yet") + f" (min {config.AI_MIN_GAP_MIN:.0f})"),
        ("Daily water cap", ml_today < config.DAILY_MAX_ML, f"{ml_today:.0f} / {config.DAILY_MAX_ML:.0f} ml"),
        ("Last pour finished soaking", soak.live.get("phase") != "soaking", soak.live.get("phase", "idle")),
        ("Pour length cap", True, f"{config.POUR_CAP_S} s (laptop) + 30 s (chip)"),
    ]
    if config.ENFORCE_WATERING_RULE:
        rows.append(("Legal watering time", feeds.watering_day()["legal_now"], feeds.watering_day()["rule"]))
    return [{"rule": r, "ok": bool(ok), "detail": d} for r, ok, d in rows]


def water_pot(seconds, reason, tag=None):
    ok, why, secs = guards(seconds)
    if not ok:
        _last_action.update(action="refused", seconds=0, why=why)
        log_act("guards", "REFUSED: " + why)
        return {"watered": False, "refused_because": why}
    BOARD.tag_next = tag
    BOARD.pour("A", int(secs * 1000))
    _last_action.update(action="water", seconds=secs, why=reason)
    log_act("executor", f"pump A {secs:.0f}s")
    return {"watered": True, "seconds": secs}


# ---------- Laya: the fast decider (our fine-tuned model) ----------
# Trained on the field scale: wilting 20%, stress line 42.5%, field capacity 65%. The box's healthy band
# (DRY_PCT..WET_PCT) is mapped onto stress line..field capacity so the model sees the same picture.

def _laya_state():
    soil = get_soil("A")
    if "error" in soil:
        return None, soil["error"]
    pct = soil["moisture_pct"]
    fc, dr = feeds.forecast(), feeds.drought()
    outdoors = bool(config.OUTDOORS)
    lt = time.localtime()
    return {
        "soil_moisture_pct": round(42.5 + (pct - config.DRY_PCT) * (65 - 42.5) / (config.WET_PCT - config.DRY_PCT), 1),
        "stress_line_pct": 42.5,
        "air_temp_c": fc.get("temp_c_now", soil.get("soil_temp_c")),
        "hour": lt.tm_hour, "month": time.strftime("%B", lt),
        "rain_forecast_next_24h_mm": fc.get("rain_mm_next_24h", 0.0) if outdoors else 0.0,   # indoors: rain can't reach the pot
        "rain_chance_next_24h_pct": fc.get("max_rain_chance_next_24h", 0) if outdoors else 0,
        "crop_water_use_last_24h_mm": round((fc.get("et0_mm_next_24h") or 0) * 1.05, 2),
        "hours_since_real_rain": 48 if (fc.get("hours_until_real_rain") is None) else 0,
        "county_drought": f"{dr.get('level', '')} {dr.get('level_name', '')}".strip() or "unknown",
    }, pct


def get_fast_decision() -> dict:
    """Laya, Farm Hand's own small decision model (fine-tuned on 6 years of real Miami weather), picks water / wait_rain / wait_moist in one fast call, with probabilities. Use it as a strong second opinion."""
    if not config.USE_LAYA:
        return {"error": "Laya is switched off"}
    state, pct = _laya_state()
    if state is None:
        return {"error": pct}
    try:
        import requests
        r = requests.post(config.LAYA_URL + "/decide", json={"state": state}, timeout=3).json()
    except Exception as e:
        return {"error": f"Laya not reachable: {type(e).__name__}"}
    log_act("laya", f"{r['choice']} {max(r['probabilities'].values()):.0%} ({r['ms']} ms)")
    LAST["laya"] = {"ts": time.time(), "pick": r["choice"], "sure": max(r["probabilities"].values()), "ms": r["ms"], "soil_pct": pct}
    return {"pick": r["choice"], "probabilities": r["probabilities"], "ms": r["ms"], "soil_pct": pct}


def laya_decide():
    """Laya alone decides (Gemini team off, slow or failed). Same safety checks as the rules, then the guards."""
    mem = get_memory()
    if mem["failed_pours_recently"] >= 2:
        return None
    d = get_fast_decision()
    if "error" in d:
        return None
    pct, sure = d["soil_pct"], max(d["probabilities"].values())
    if d["pick"] != "water":
        why = "rain is coming that will cover it" if d["pick"] == "wait_rain" else "the soil still has enough water"
        return "wait", 0, f"WAIT: soil is {pct:.0f}% and {why} (Laya, {sure:.0%} sure)."
    secs = max(1.0, (config.TARGET_PCT - pct) / pct_per_s())
    r = water_pot(secs, f"Laya: water ({sure:.0%})")
    if r["watered"]:
        return "water", r["seconds"], f"WATER: soil is {pct:.0f}% and no rain will cover it. Watering {r['seconds']:.0f} s (Laya, {sure:.0%} sure)."
    return "wait", 0, f"WAIT: Laya said water, but the safety rules said no ({r['refused_because']})."


# ---------- rule brain (no AI) ----------

def rule_decide():
    for a in ("weather_agent", "soil_agent", "memory_agent"):
        log_act(a, "(rules) gathering")
    soil = get_soil("A")
    if "error" in soil:
        return "wait", 0, f"WAIT: {soil['error']}."
    pct, hrs = soil["moisture_pct"], soil["prediction"].get("hours_until_dry", 99)   # settling -> 99, moisture % decides
    fc = get_forecast()
    mem = get_memory()
    log_act("planner_agent", "(rules) deciding")
    if mem["failed_pours_recently"] >= 2:
        return "wait", 0, "WAIT: the last pours didn't reach the probe. Check the pump and tube before watering again."
    if pct >= config.WET_PCT:
        return "wait", 0, f"WAIT: soil is {pct:.0f}%, already wet."
    if pct > config.DRY_PCT + LOW_MARGIN:
        left = f", about {hrs:.0f} hours of water left" if "hours_until_dry" in soil["prediction"] else ""
        return "wait", 0, f"WAIT: soil is {pct:.0f}%{left}. Water only when it's low, then a real drink."
    rain_in = fc.get("hours_until_real_rain")
    if config.OUTDOORS and rain_in is not None and rain_in <= 3:      # indoors, rain never reaches the pot
        return "wait", 0, f"WAIT: soil is {pct:.0f}% but real rain is due in {rain_in} h. Let the sky do it."
    secs = (config.TARGET_PCT - pct) / pct_per_s()
    r = water_pot(secs, f"soil {pct:.0f}%, no rain coming")
    if r["watered"]:
        return "water", r["seconds"], f"WATER: soil is {pct:.0f}% and no rain is coming. Watering {r['seconds']:.0f} s."
    return "wait", 0, f"WAIT: wanted to water but {r['refused_because']}."


# ---------- Gemini team (Google ADK) ----------

def _model():
    if os.environ.get("GOOGLE_API_KEY"):
        return config.GEMINI_MODEL
    from google.adk.models.lite_llm import LiteLlm
    return LiteLlm(model="openai/" + config.RC_GEMINI_MODEL, api_base="https://right.codes/gemini/v1",
                   api_key=os.environ["RIGHTCODES_KEY_GEMINI"])


def which_brain():
    if config.USE_LLM == "rules":
        return "rules"
    if os.environ.get("GOOGLE_API_KEY"):
        return f"gemini ({config.GEMINI_MODEL})"
    if os.environ.get("RIGHTCODES_KEY_GEMINI"):
        return f"gemini via right.codes ({config.RC_GEMINI_MODEL})"
    return "rules"


def _build_team():
    from google.adk.agents import LlmAgent, LoopAgent, ParallelAgent, SequentialAgent
    m = _model()
    nums = "Use ONLY numbers the tools return. Never invent a number."
    weather = LlmAgent(name="weather_agent", model=m, output_key="weather_report",
                       tools=[get_forecast, get_drought, get_watering_rule],
                       instruction=f"You watch the sky for a small Florida farm in a drought. Call get_forecast, get_drought and "
                                   f"get_watering_rule. Report in 3 short lines: rain coming (when, how much), drought level, "
                                   f"watering rule. {nums}")
    soil = LlmAgent(name="soil_agent", model=m, output_key="soil_report", tools=[get_soil],
                    instruction=(f"You watch the soil. Call get_soil for pot 'A'. Report in 2 short lines: pot A moisture vs its "
                                 f"thresholds, and predicted hours until it is dry. {nums}") if config.ONE_POT else
                                (f"You watch the soil. Call get_soil for pot 'A' and for pot 'B'. Report in 3 short lines: "
                                 f"pot A moisture vs its thresholds, predicted hours until pot A is dry, pot B for comparison. {nums}"))
    memory = LlmAgent(name="memory_agent", model=m, output_key="memory_report", tools=[get_memory],
                      instruction=f"You are the farm's memory. Call get_memory. Report in 3 short lines: how much each pot got "
                                  f"in 24 h, what the last AI pours actually did to the soil (did water reach the probe?), and "
                                  f"the learned % gain per second of pumping. {nums}")
    planner = LlmAgent(
        name="planner_agent", model=m, output_key="planner_text", tools=[get_fast_decision, propose_plan],
        instruction=("You plan pot A's watering. Florida is in drought, so every drop counts, but the plant must not dry out.\n"
                     "WEATHER:\n{weather_report}\n\nSOIL:\n{soil_report}\n\nMEMORY:\n{memory_report}\n\n"
                     "CRITIC FEEDBACK ON YOUR LAST PLAN (fix it if there is any):\n{critic_feedback}\n\n"
                     "Rules of thumb:\n"
                     f"- Water only if pot A moisture is at or below {config.DRY_PCT + LOW_MARGIN}%.\n"
                     "- Don't water if real rain is due within about 3 hours, BUT ONLY if the forecast says "
                     "rain_reaches_pots is true. Indoors, ignore rain completely.\n"
                     "- If recent pours didn't reach the probe, WAIT and tell the farmer to check the pump.\n"
                     f"- One real drink, no sips: seconds = ({config.TARGET_PCT} - current%) / learned_pct_gain_per_second, max 30.\n"
                     "- First call get_fast_decision: Laya, our model trained on 6 years of Miami weather, gives its pick. "
                     "Follow it unless the data above clearly says otherwise, and if you overrule it, say why in the reason.\n"
                     "Call propose_plan exactly once. The farmer_sentence is one plain sentence a 13-year-old understands."))
    critic = LlmAgent(
        name="critic_agent", model=m, tools=[approve_plan, reject_plan],
        instruction=("You are the safety and water-waste critic. Check the planner's plan against the data.\n"
                     "PLAN: {plan}\n\nWEATHER:\n{weather_report}\n\nSOIL:\n{soil_report}\n\nMEMORY:\n{memory_report}\n\n"
                     "Reject if: it waters a pot that isn't low, it waters right before real rain that reaches the pots, "
                     "it waits for rain that can't reach the pots (indoors), the seconds math is wrong "
                     "by more than 3 s, it ignores failed pours, or the farmer sentence has a number the tools didn't give. "
                     "Otherwise approve. Call exactly one of approve_plan or reject_plan."))
    return SequentialAgent(name="farm_hand_check", sub_agents=[
        ParallelAgent(name="gather", sub_agents=[weather, soil, memory]),
        LoopAgent(name="plan_and_review", sub_agents=[planner, critic], max_iterations=3),
    ])


_team = None


async def _team_once():
    global _team
    from google.adk.runners import InMemoryRunner
    from google.genai import types
    if _team is None:
        _team = InMemoryRunner(agent=_build_team(), app_name="farmhand")
    s = await _team.session_service.create_session(
        app_name="farmhand", user_id="farm",
        state={"critic_feedback": "none yet", "plan": {}, "approved": False,
               "weather_report": "", "soil_report": "", "memory_report": ""})
    async for ev in _team.run_async(user_id="farm", session_id=s.id,
                                    new_message=types.Content(role="user", parts=[types.Part(text="Run the check for pot A.")])):
        for fc in ev.get_function_calls() or []:
            log_act(ev.author, f"calls {fc.name}")
        if ev.content and ev.content.parts and any(p.text for p in ev.content.parts):
            log_act(ev.author, "reported")
    done = await _team.session_service.get_session(app_name="farmhand", user_id="farm", session_id=s.id)
    return done.state


_check_lock = __import__("threading").Lock()


def check_now():
    """One full cycle. Always logs a decision. One at a time: the button and the loop can't double-pour."""
    with _check_lock:
        return _check_now()


def _check_now():
    _last_action.clear()
    brain = which_brain()
    t0 = time.time()
    LAST["check"] = {"t0": t0, "t1": None, "brain": brain}
    try:
        if brain != "rules":
            get_fast_decision()                            # Laya's instant call lands on screen first; the team explains after
        if brain == "rules":
            got = laya_decide()
            if got:
                brain = "laya (fast decider)"
                action, secs, sentence = got
            else:
                action, secs, sentence = rule_decide()
        else:
            st = _run(_team_once())
            plan, approved = st.get("plan") or {}, st.get("approved")
            sentence = plan.get("farmer_sentence") or "WAIT: no plan came back."
            if not approved:
                action, secs = "wait", 0
                sentence = "WAIT: the critic didn't approve a plan in 3 rounds, so the safe move is to wait."
                log_act("executor", "no approved plan -> wait")
            elif plan.get("action") == "water":
                r = water_pot(plan.get("seconds", 0), plan.get("reason", ""))
                action, secs = ("water", r["seconds"]) if r["watered"] else ("wait", 0)
                if not r["watered"]:
                    sentence = f"WAIT: the plan said water, but the safety rules said no ({r['refused_because']})."
            else:
                action, secs = "wait", 0
                log_act("executor", "approved wait")
    except Exception as e:                                  # AI down -> rules, never skip a check
        print("[brain] AI team failed, Laya then rules take over:", repr(e)[:300])
        _last_action.clear()
        got = laya_decide()
        if got:
            log_act("executor", "AI slow/failed -> Laya decided")
            brain = "laya (AI failed)"
            action, secs, sentence = got
        else:
            log_act("executor", "AI failed -> rules")
            brain = "rules (AI failed)"
            action, secs, sentence = rule_decide()
    store.add_decision(action, secs, brain, sentence, json.dumps(_last_action))
    LAST["check"] = {"t0": t0, "t1": time.time(), "brain": brain, "action": action}
    print(f"[brain] {brain}: {sentence}")
    return {"ts": time.time(), "action": action, "seconds": secs, "brain": brain, "sentence": sentence}


# ---------- farmer chat ----------

_chat = None


async def _ask(question):
    global _chat
    from google.adk.agents import LlmAgent
    from google.adk.runners import InMemoryRunner
    from google.genai import types
    if _chat is None:
        agent = LlmAgent(name="farm_helper", model=_model(),
                         tools=[get_soil, get_forecast, get_drought, get_memory, get_decision_log],
                         instruction=(("You answer a farmer's questions about their pot (A, watered by the AI) and the timer baseline it is compared to. "
                                       if config.ONE_POT else "You answer a farmer's questions about their two pots (A = AI watered, B = timer). ")
                                      + "Use the tools, answer in 1-3 short plain sentences, and use only numbers the tools give."))
        _chat = InMemoryRunner(agent=agent, app_name="farmhand_chat")
    s = await _chat.session_service.create_session(app_name="farmhand_chat", user_id="farmer")
    out = ""
    async for ev in _chat.run_async(user_id="farmer", session_id=s.id,
                                    new_message=types.Content(role="user", parts=[types.Part(text=question)])):
        for fc in ev.get_function_calls() or []:
            log_act("farm_helper", f"calls {fc.name}")
        if ev.content and ev.content.parts:
            out = "".join(p.text or "" for p in ev.content.parts) or out
    return out.strip()


def ask(question):
    if which_brain() == "rules":
        d = get_decision_log(1)
        return "Chat needs Gemini (set GOOGLE_API_KEY). Last decision: " + (d[0]["said"] if d else "none yet")
    try:
        return _run(_ask(question))
    except Exception as e:
        return f"Chat failed: {e!r}"[:300]
```

### `laptop/report.py`

```python
"""The hard number: water used by the AI pot vs the timer, and time spent in the healthy band.

One-pot mode: the timer is virtual. It counts the pours a normal timer (TIMER_POUR_MS every TIMER_EVERY_S)
would have made over the same logged hours, at pot A's measured flow. Only full intervals count, so early on
the timer shows 0 ml and "saved" stays empty instead of flattering the AI.

  python report.py            # since the first real reading
  python report.py 6          # last 6 hours
  python report.py 6 --fake   # include FakeBoard data (code test only, never for slides)
"""
import sys
import time

import config
import store


def report(hours=None, include_fake=False):
    since = time.time() - hours * 3600 if hours else 0
    fake = "" if include_fake else " AND fake=0"
    pours = store.q(f"SELECT ts, pot, ran_ms, by FROM pours WHERE ts >= ?{fake}", (since,))
    reads = store.q(f"SELECT ts, a_pct, b_pct FROM readings WHERE ts >= ?{fake} ORDER BY ts", (since,))
    flow = config.load_cal()["flow_ml_per_s"]
    ml = {p: sum(r[2] for r in pours if r[1] == p) / 1000 * flow[p] for p in "AB"}
    n = {p: sum(1 for r in pours if r[1] == p) for p in "AB"}
    # test pours and Hit-the-Target demos: still counted in the AI's water (never flatters it), shown separately
    demo_ml = sum(r[2] for r in pours if r[1] == "A" and r[3] in ("manual", "target")) / 1000 * flow["A"]

    def band(col):
        vals = [r[col] for r in reads if r[col] is not None]
        if not vals:
            return None
        ok = sum(1 for v in vals if config.DRY_PCT <= v <= config.WET_PCT)
        return round(100 * ok / len(vals), 1)

    span_s = reads[-1][0] - reads[0][0] if len(reads) > 1 else 0
    span_h = span_s / 3600
    if config.ONE_POT:
        n["B"] = int(span_s // config.TIMER_EVERY_S) if config.TIMER_EVERY_S else 0
        ml["B"] = n["B"] * config.TIMER_POUR_MS / 1000 * flow["A"]
    saved = round(100 * (ml["B"] - ml["A"]) / ml["B"], 1) if ml["B"] else None
    return {
        "hours_logged": round(span_h, 2),
        "ai_pot_ml": round(ml["A"]), "timer_pot_ml": round(ml["B"]), "ai_pot_demo_ml": round(demo_ml),
        "ai_pours": n["A"], "timer_pours": n["B"],
        "water_saved_pct": saved,
        "ai_pot_time_healthy_pct": band(1), "timer_pot_time_healthy_pct": None if config.ONE_POT else band(2),
        "timer_is_virtual": bool(config.ONE_POT),
        "timer_schedule": f"{config.TIMER_POUR_MS / 1000:g} s every " + (f"{config.TIMER_EVERY_S / 3600:g} h" if config.TIMER_EVERY_S >= 3600 else f"{config.TIMER_EVERY_S / 60:g} min"),
        "timer_ml_per_pour": round(config.TIMER_POUR_MS / 1000 * flow["A"]),
        "healthy_band": f"{config.DRY_PCT:.0f}-{config.WET_PCT:.0f}%",
        "includes_fake_data": include_fake,
    }


if __name__ == "__main__":
    h = float(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1][0].isdigit() else None
    r = report(h, "--fake" in sys.argv)
    for k, v in r.items():
        print(f"{k:28} {v}")
```

### `laptop/calibrate.py`

```python
"""Sep 23 bring-up helper. Walks you through calibrating both probes and measuring pump flow.
Writes data/calibration.json, which the laptop uses to turn raw numbers into %.

  python calibrate.py            # auto-find the ESP32
  python calibrate.py COM5       # or name the port
"""
import json
import statistics
import sys
import time

import serial
from serial.tools import list_ports

import config


def port():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for p in list_ports.comports():
        print("found", p.device, p.description)
    ports = [p.device for p in list_ports.comports()]
    if not ports:
        raise SystemExit("No serial port. Is it a DATA cable? Is the CP210x/CH340 driver installed?")
    return ports[0]


def median_raw(ser, key, n=6):
    vals = []
    while len(vals) < n:
        line = ser.readline().decode("utf-8", "replace").strip()
        if line.startswith('{"type":"reading"'):
            v = json.loads(line)[key]
            vals.append(v)
            print(f"   {key} = {v}")
    return int(statistics.median(vals))


def main():
    ser = serial.Serial(port(), config.BAUD, timeout=2)
    time.sleep(2)
    ser.write(b"T 0\n")                                   # timer off while we calibrate
    cal = json.loads(json.dumps(config.load_cal()))
    for pot, key in (("A", "a_raw"), ("B", "b_raw")):
        input(f"\nProbe {pot}: hold it in DRY AIR, then press Enter...")
        cal[pot]["raw_air"] = median_raw(ser, key)
        input(f"Probe {pot}: put it in a CUP OF WATER, only up to the line on the probe. Press Enter...")
        cal[pot]["raw_water"] = median_raw(ser, key)
        swing = cal[pot]["raw_air"] - cal[pot]["raw_water"]
        print(f"Probe {pot}: air {cal[pot]['raw_air']}, water {cal[pot]['raw_water']}, swing {swing}")
        if swing < 500:
            print("  ⚠️ swing under 500: bad probe or bad wire. Swap probes (you have 5).")
    for pot in "AB":
        input(f"\nPump {pot}: tube into an EMPTY measuring cup, pump in water. Enter = run 10 s...")
        ser.write(f"P {pot} 10000\n".encode())
        time.sleep(12)
        ml = float(input("How many ml in the cup? "))
        cal["flow_ml_per_s"][pot] = round(ml / 10, 2)
    config.CAL_FILE.write_text(json.dumps(cal, indent=2))
    print("\nsaved", config.CAL_FILE)
    print(json.dumps(cal, indent=2))


if __name__ == "__main__":
    main()
```

### `laptop/server.py`

```python
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
```

### `laptop/static/index.html`

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farm Hand</title>
<meta name="description" content="Farm Hand: a Gemini agent team waters a pot of Florida soil and counts the water a timer would have wasted.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231f64b8'/%3E%3Ctext x='16' y='22' font-family='Arial' font-weight='700' font-size='16' fill='white' text-anchor='middle'%3EFH%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&display=swap">
<script src="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1"></script>
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
               "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }
</script>
<style>
/* Farm Hand. House tokens (visual-page), tuned for contrast: blue ink #1f64b8 carries the AI, orange #c4501f the timer. */
:root{
  --ground:#eef1f4; --panel:#fbfcfd; --wash:#f2f5f8; --line:rgba(14,22,33,.09);
  --ink:#0e1621; --ink-2:#3d4a59; --muted:#5b6674;
  --ai:#1f64b8; --ai-wash:rgba(31,100,184,.09); --timer:#c4501f;
  --good:#0a8a0a; --bad:#c43333; --warn:#9a6a00; --heat:#7646b8;
  --f-display:"Bricolage Grotesque","Atkinson Hyperlegible Next",system-ui,sans-serif;
  --f-body:"Atkinson Hyperlegible Next","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-num:"JetBrains Mono",ui-monospace,Consolas,monospace;
  --ease:cubic-bezier(.16,1,.3,1);
}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%;margin:0}
body{background:var(--ground);color:var(--ink);font:15px/1.5 var(--f-body);-webkit-font-smoothing:antialiased}
::selection{background:rgba(31,100,184,.18)}
button,input{font:inherit;color:inherit}
button{cursor:pointer;border:0;background:none;padding:0;text-align:inherit}
button:disabled{cursor:progress;opacity:.6}
:focus-visible{outline:2px solid var(--ai);outline-offset:2px;border-radius:6px}
.num{font-family:var(--f-num);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
*{scrollbar-width:thin;scrollbar-color:rgba(14,22,33,.18) transparent}

.shell{height:100dvh;display:grid;grid-template-columns:minmax(0,1fr) 404px}
.left{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0;min-width:0}

/* stage */
.stage{position:relative;overflow:hidden;background:radial-gradient(70% 60% at 50% 45%,#fbfcfd 0%,#e9edf1 100%)}
#field{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
.brand{position:absolute;top:22px;left:26px;z-index:3}
.brand h1{margin:0;font:700 1.55rem/1 var(--f-display);letter-spacing:-.02em}
.brand p{margin:6px 0 0;color:var(--ink-2);font-size:14px;max-width:38ch}
.lens{position:absolute;left:26px;bottom:24px;z-index:3;display:grid;gap:8px;justify-items:start}
.seg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:rgba(251,252,253,.9);border:1px solid var(--line);backdrop-filter:blur(8px)}
.seg button{height:30px;padding:0 13px;border-radius:8px;font-size:13px;font-weight:600;color:var(--ink-2);transition:background .2s,color .2s}
.seg button:hover{color:var(--ink)}
.seg button.on{background:var(--ink);color:#fff}
.lens small{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px}
.ramp{width:72px;height:6px;border-radius:9px;background:linear-gradient(90deg,var(--r0),var(--r1),var(--r2))}
.state{position:absolute;right:24px;bottom:24px;z-index:3;display:flex;align-items:center;gap:9px;height:36px;padding:0 14px;border-radius:99px;background:var(--ai);color:#fff;font-size:13.5px;font-weight:600;transition:opacity .25s var(--ease),transform .25s var(--ease)}
.state.idle{opacity:0;transform:translateY(6px);pointer-events:none}
.spin{width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.front{position:absolute;left:0;top:0;z-index:2;pointer-events:none;font-size:12.5px;font-weight:600;color:var(--ai);background:rgba(251,252,253,.92);padding:3px 9px;border-radius:99px}
.tag{position:absolute;left:0;top:0;z-index:2;pointer-events:none}

/* control column */
aside{background:var(--panel);border-left:1px solid var(--line);display:grid;grid-template-rows:auto auto auto minmax(0,1fr);min-height:0}
section{padding:22px 24px;border-bottom:1px solid var(--line)}
.call .verdict{margin:0;font:700 2.1rem/1.02 var(--f-display);letter-spacing:-.025em}
.call .verdict.water{color:var(--ai)}
.call .verdict.bad{color:var(--bad)}
.call .why{margin:8px 0 0;color:var(--ink-2);font-size:14.5px;min-height:2.9em}
.call .who{margin:6px 0 16px;color:var(--muted);font-size:12.5px}
.run{width:100%;height:46px;border-radius:12px;background:var(--ai);color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;gap:9px;transition:background .15s,transform .12s var(--ease)}
.run:hover:not(:disabled){background:#1a57a1}
.run:active:not(:disabled){transform:scale(.985)}
.row2{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.link{font-size:13.5px;font-weight:600;color:var(--ai);display:inline-flex;align-items:center;gap:6px;padding:4px 2px}
.link:hover{text-decoration:underline;text-underline-offset:3px}
.link.stop{color:var(--bad)}

.nums{display:grid;grid-template-columns:1fr 1fr}
.nums > div{display:grid;gap:4px;align-content:start}
.nums > div + div{border-left:1px solid var(--line);padding-left:20px}
.k{font-size:13px;color:var(--muted)}
.big{font-size:1.9rem;font-weight:600;line-height:1.05;white-space:nowrap}
.sub{font-size:12.5px;color:var(--ink-2)}
.band{position:relative;height:6px;border-radius:9px;background:var(--wash);overflow:hidden;margin-top:4px}
.band .ok{position:absolute;top:0;bottom:0;background:rgba(10,138,10,.16)}
.band i{position:absolute;left:0;top:0;bottom:0;width:100%;background:var(--ai);border-radius:9px;transform-origin:left;transition:transform .6s var(--ease)}

.facts{display:grid;gap:9px}
.fact{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px}
.fact span{color:var(--ink-2)} .fact b{font-weight:600}
.fact em{font-style:normal;color:var(--muted);font-size:12.5px;display:block;margin-top:1px}

.team{overflow-y:auto;display:grid;align-content:start;gap:0;padding-top:16px}
.tabs{display:flex;gap:18px;margin-bottom:12px}
.tabs button{font-size:14px;font-weight:700;color:var(--muted);padding:2px 0;border-bottom:2px solid transparent}
.tabs button.on{color:var(--ink);border-color:var(--ai)}
.steps{list-style:none;margin:0;padding:0}
.steps li{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:7px 0;font-size:14px}
.steps li .ph{font-size:17px;color:var(--muted)}
.steps li .w{font-size:12.5px;color:var(--muted);max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.steps li.sub{padding-left:18px}
.steps li.on{color:var(--ai);font-weight:600} .steps li.on .ph,.steps li.on .w{color:var(--ai)}
.steps li.bad,.steps li.bad .ph,.steps li.bad .w{color:var(--bad)}
.steps li.warn,.steps li.warn .ph,.steps li.warn .w{color:var(--warn)}
.steps .group{display:block;font-size:12.5px;color:var(--muted);padding:6px 0 2px 32px}
.log{list-style:none;margin:0;padding:0}
.log li{display:grid;grid-template-columns:48px minmax(0,1fr);gap:10px;padding:7px 0;font-size:13.5px;border-top:1px solid var(--line)}
.log li:first-child{border-top:0}
.log .t{color:var(--muted);font-size:12.5px}
.log b{font-weight:600} .log .bad b{color:var(--bad)} .log .good b{color:var(--good)} .log .warn b{color:var(--warn)}
.rules{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:6px}
.rules li{display:flex;align-items:center;gap:8px;font-size:13.5px}
.rules .ph{font-size:16px} .rules .y{color:var(--good)} .rules .n{color:var(--bad)}
.rules small{margin-left:auto;color:var(--muted);font-size:12.5px}
.soak{padding:10px 0;border-top:1px solid var(--line);font-size:13.5px}
.soak:first-child{border-top:0}
.soak b{font-size:1.05rem}
.soak div{color:var(--muted);font-size:12.5px}
.ask{display:flex;gap:8px}
.ask input{flex:1;min-width:0;height:42px;border-radius:10px;border:1px solid var(--line);background:var(--wash);padding:0 12px;font-size:15px;outline:none}
.ask input:focus{border-color:var(--ai);box-shadow:0 0 0 3px var(--ai-wash)}
.ask button{height:42px;padding:0 16px;border-radius:10px;background:var(--ai);color:#fff;font-weight:700}
.sugg{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.sugg button{font-size:13px;padding:6px 11px;border-radius:99px;border:1px solid var(--line);color:var(--ink-2)}
.sugg button:hover{background:var(--wash)}
.reply{font-size:15px;line-height:1.55;color:var(--ink)}
.muted{color:var(--muted)}
.call .verdict.good{color:var(--good)}
.call .verdict.stale{color:var(--muted)}
.call .who.old{color:var(--warn);font-weight:600}
.tgt{display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.tgt .k{margin-right:auto}
.stepper{display:inline-flex;align-items:center;height:38px;border:1px solid var(--line);border-radius:10px;background:var(--wash)}
.stepper button{width:34px;height:100%;display:grid;place-items:center;color:var(--ink-2);font-size:15px}
.stepper button:hover{color:var(--ink)}
.stepper b{min-width:52px;text-align:center;font-size:16px}
.go{height:38px;padding:0 16px;border-radius:10px;background:var(--ink);color:#fff;font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:7px;transition:transform .12s var(--ease)}
.go:active:not(:disabled){transform:scale(.97)}
.pulses{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pulses:empty{display:none}
.pulses li{font-size:12.5px;padding:4px 9px;border-radius:99px;background:var(--ai-wash);color:var(--ai);font-weight:600}
.pulses li.bad{background:rgba(196,51,51,.1);color:var(--bad)}
.hud{position:absolute;top:22px;right:24px;z-index:3;display:grid;justify-items:end;gap:2px;text-align:right}
.hud .lbl{font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.hud .now{font:600 3.4rem/1 var(--f-num);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.hud .of{font-size:14px;color:var(--ink-2)}
.hud .track{position:relative;width:220px;height:8px;border-radius:9px;background:rgba(14,22,33,.08);margin-top:8px}
.hud .track i{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:9px;background:var(--ai);transform-origin:left;transition:transform .5s var(--ease)}
.hud .track s{position:absolute;top:0;height:16px;transform:translateY(-4px);width:2px;background:var(--ink);border-radius:2px}
.hud.good .now{color:var(--good)} .hud.good .track i{background:var(--good)}
.hud.bad .now{color:var(--bad)} .hud.bad .track i{background:var(--bad)}
.link.pinch{color:var(--muted);font-weight:500;margin-top:6px}


/* money graph strip under the stage */
.graph{display:grid;grid-template-columns:minmax(0,1fr) 212px;gap:22px;padding:14px 24px;background:var(--panel);border-top:1px solid var(--line);border-bottom:0}
.ghead{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:4px}
.ghead h3{margin:0;font:700 1.02rem/1 var(--f-display);letter-spacing:-.01em}
.leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-2)}
.leg span{display:inline-flex;align-items:center;gap:6px}
.leg i{display:inline-block;width:18px;height:0;border-top:2px solid}
.leg .m i{border-color:var(--ai)} .leg .t i{border-color:var(--timer);border-top-style:dashed} .leg .h i{border-color:var(--heat)}
.leg .pd{display:inline-block;width:9px;height:9px;border-radius:50%}
.leg em{font-style:normal;color:var(--muted)}
.ghead .seg{margin-left:auto;background:var(--wash);order:2}
.ghead .leg{order:3;width:100%}
.ghead .seg button{height:26px;padding:0 10px;font-size:12.5px}
.chart{position:relative}
.chart svg{display:block;width:100%;height:188px;overflow:visible}
.chart .ax{font:500 11px var(--f-num);fill:var(--muted)}
.chart .lab{font:600 11.5px var(--f-body);fill:var(--ink-2)}
.chart .grid{stroke:rgba(14,22,33,.07)}
.chart .empty{font:500 13px var(--f-body);fill:var(--muted)}
.tip{position:absolute;top:0;z-index:4;pointer-events:none;background:var(--ink);color:#fff;border-radius:9px;padding:7px 10px;font-size:12.5px;line-height:1.45;white-space:nowrap;transform:translateX(-50%);opacity:0;transition:opacity .12s}
.tip b{font-family:var(--f-num);font-weight:600}
.tip .sw{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.cups{display:grid;align-content:center;gap:3px;border-left:1px solid var(--line);padding-left:20px}
.cups .big{font-size:2.6rem;letter-spacing:-.04em}
.cups .unit{font:700 1rem/1 var(--f-display);color:var(--ink)}
.cups .sub b{font-family:var(--f-num);font-weight:600}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--timer);background:rgba(196,80,31,.09);border-radius:6px;padding:2px 6px;justify-self:start}

/* fast + smart */
.brains{display:grid;gap:6px;margin:4px 0 14px}
.br{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 10px;border-radius:11px;background:var(--wash);font-size:13.5px;line-height:1.3;transition:background .4s}
.br > i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:17px;background:#fff;color:var(--ai)}
.br b{font-weight:700} .br span{color:var(--ink-2);font-size:12.5px}
.br .t{font:600 1.05rem/1 var(--f-num);color:var(--ai);text-align:right}
.br .t small{display:block;font:500 11px var(--f-body);color:var(--muted);margin-top:3px}
.br.fresh{background:var(--ai-wash)}
.br.off .t,.br.off > i{color:var(--muted)}

/* temperature card */
.nums .heat .big{color:var(--heat)}

/* someone-added-water banner */
.alert{position:absolute;left:50%;top:92px;z-index:5;transform:translate(-50%,-150%);opacity:0;display:grid;grid-template-columns:44px auto;gap:14px;align-items:center;padding:14px 22px 14px 14px;border-radius:16px;background:var(--ink);color:#fff;box-shadow:0 18px 40px rgba(14,22,33,.22);transition:transform .5s var(--ease),opacity .3s;max-width:min(560px,calc(100% - 32px))}
.alert.on{transform:translate(-50%,0);opacity:1}
.alert > i{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--ai);font-size:24px}
.alert b{display:block;font:700 1.3rem/1.15 var(--f-display);letter-spacing:-.01em}
.alert b .num{color:#9cc4f2}
.alert span{display:block;color:rgba(255,255,255,.84);font-size:14.5px;margin-top:3px}

/* view switch + field view */
.seg button .ph{font-size:14px;vertical-align:-2px;margin-right:3px}
.fieldview{position:absolute;inset:0;z-index:2;background:radial-gradient(70% 60% at 50% 45%,#fbfcfd 0%,#e9edf1 100%);overflow:hidden}
.fieldview svg{position:absolute;top:84px;left:8px;width:calc(100% - 330px);height:calc(100% - 150px)}
#fieldZoom{transform-box:view-box;transition:transform 1.5s var(--ease)}
.fieldcap{position:absolute;top:92px;right:20px;z-index:3;max-width:300px;background:rgba(251,252,253,.95);border:1px solid var(--line);border-radius:14px;padding:13px 15px;font-size:13.5px;color:var(--ink-2)}
.fieldcap .est{margin-bottom:7px;color:var(--ink-2);background:var(--wash)}
.fieldcap b{color:var(--ink)}
.fieldcap .fk{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:12.5px}
.fieldcap .fk .ramp{width:80px;--r0:#c8a878;--r1:#5a8fc8;--r2:#1f5fb0}

@media (max-width:1100px){.shell{grid-template-columns:1fr;height:auto} .left{height:auto} .stage{height:62dvh;min-height:420px} aside{border-left:0;border-top:1px solid var(--line)}}
@media (max-width:760px){.graph{grid-template-columns:1fr;padding:14px 16px}.cups{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:12px}.ghead .seg{margin-left:0}.fieldview svg{top:64px;left:8px;width:calc(100% - 16px);height:calc(100% - 240px)}.fieldcap{left:16px;right:16px;top:auto;bottom:76px;max-width:none;padding:9px 12px;font-size:12.5px}.fieldcap .long,.fieldcap .fk:not(.muted){display:none}.fieldcap .fk{margin-top:3px}}
@media (max-width:560px){.state{top:16px;bottom:auto;right:16px;max-width:60%}.state span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hud{top:auto;bottom:64px;right:16px}.hud .now{font-size:2.4rem}.hud .track{width:150px}section{padding:18px 16px}.brand{left:16px;top:16px}.lens{left:16px;bottom:16px}.state{right:16px;bottom:16px}.call .verdict{font-size:1.8rem}.brand p{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="shell">
  <div class="left">
  <main class="stage" id="stage" aria-label="3D view of the pot">
    <canvas id="field" tabindex="0" aria-label="The see-through pot, soil colored by moisture at each depth"></canvas>
    <div class="brand"><h1>Farm Hand</h1><p id="subline">An AI agent team waters this pot. A timer is the thing to beat.</p></div>
    <div class="alert" id="alert" role="status" aria-live="assertive"><i class="ph-fill ph-drop"></i><div><b id="alertT"></b><span id="alertS"></span></div></div>
    <div class="fieldview" id="fieldView" hidden></div>
    <div class="lens">
      <div class="seg" role="group" aria-label="View">
        <button class="on" data-view="pot"><i class="ph ph-cube"></i>This box</button><button data-view="field"><i class="ph ph-squares-four"></i>A whole field</button>
      </div>
      <div class="seg" id="lensSeg" role="group" aria-label="Color the soil by">
        <button class="on" data-lens="natural">Soil</button><button data-lens="moisture">Moisture</button><button data-lens="temp">Heat</button>
      </div>
      <small id="lensKey"><span>dry</span><span class="ramp" id="ramp"></span><span>wet</span><span>by depth, modeled from one probe</span></small>
    </div>
    <div class="state idle" id="working" role="status" aria-live="polite"><span class="spin"></span><span id="workTxt"></span></div>
    <div class="hud" id="hud" hidden><span class="lbl" id="hudLbl">Target</span><span class="now" id="hudNow">–</span><span class="of" id="hudOf"></span><span class="track"><i id="hudBar"></i><s id="hudMark"></s></span></div>
    <div class="front" id="front" hidden></div>
    <div class="tag" id="tagA" hidden></div><div class="tag" id="tagB" hidden></div>
  </main>
  <section class="graph" aria-label="Soil over time and water saved">
    <div>
      <div class="ghead">
        <h3>Soil over time</h3>
        <div class="leg"><span class="m"><i></i>Moisture <em>measured</em></span><span class="t"><i></i>If a timer watered <em>estimated</em></span><span class="h"><i></i>Soil temp <em>measured</em></span><span><b class="pd" style="background:#1f64b8"></b>AI pour</span><span><b class="pd" style="background:#c4501f"></b>timer pour</span></div>
        <div class="seg" role="group" aria-label="Time window"><button data-win="1">1 h</button><button data-win="6">6 h</button><button class="on" data-win="24">24 h</button><button data-win="0">All</button></div>
      </div>
      <div class="chart" id="chart"><svg id="chartSvg" role="img" aria-label="Soil moisture and temperature over time"></svg><div class="tip" id="tip"></div></div>
    </div>
    <div class="cups">
      <span class="k" id="cupsK">Water saved vs a timer</span>
      <span><span class="big num" id="cups">–</span> <span class="unit" id="cupsU">cups</span></span>
      <span class="sub" id="cupsSub">&nbsp;</span>
      <span class="est">Timer is estimated</span>
      <span class="sub muted" id="cupsHow"></span>
    </div>
  </section>
  </div>

  <aside aria-label="Decision, numbers and the agent team">
    <section class="call">
      <h2 class="verdict" id="verdict">Waiting</h2>
      <p class="why" id="reason">The agents haven't checked the soil yet.</p>
      <p class="who" id="by">&nbsp;</p>
      <div class="brains" id="brains">
        <div class="br fast" id="brFast"><i class="ph-fill ph-lightning"></i><div><b id="fastPick">Laya, the fast call</b><br><span id="fastSub">our small model, trained on 6 years of Miami weather</span></div><span class="t num" id="fastT">–</span></div>
        <div class="br smart" id="brSmart"><i class="ph ph-users-three"></i><div><b id="smartH">Gemini team explains</b><br><span id="smartSub">weather, soil, memory, planner, critic</span></div><span class="t num" id="smartT">–</span></div>
      </div>
      <button class="run" id="runBtn"><i class="ph-bold ph-play"></i><span>Run agents</span></button>
      <div class="row2">
        <button class="link" id="pourBtn"><i class="ph ph-drop"></i>Test pour 5 s</button>
        <button class="link stop" id="stopBtn"><i class="ph-bold ph-stop"></i>Stop pump</button>
      </div>
      <div class="tgt">
        <span class="k">Hit a target</span>
        <span class="stepper"><button id="tMinus" aria-label="Lower target"><i class="ph-bold ph-minus"></i></button><b class="num" id="tVal">55%</b><button id="tPlus" aria-label="Raise target"><i class="ph-bold ph-plus"></i></button></span>
        <button class="go" id="goBtn"><i class="ph-bold ph-crosshair"></i>Go</button>
      </div>
      <ol class="pulses" id="pulses"></ol>
      <button class="link pinch" id="pinchBtn" hidden><i class="ph ph-hand-pinch"></i><span>Pinch the tube (test)</span></button>
      <button class="link pinch" id="handBtn" hidden><i class="ph ph-drop-half"></i><span>Pour a cup in by hand (test)</span></button>
    </section>

    <section class="nums">
      <div><span class="k">Soil moisture</span><span class="big num" id="pA">–</span><div class="band"><span class="ok" id="okBand"></span><i id="gA" style="transform:scaleX(0)"></i></div><span class="sub" id="sA">&nbsp;</span></div>
      <div class="heat"><span class="k">Soil temperature</span><span class="big num" id="tA">–</span><span class="sub" id="tSub">&nbsp;</span></div>
    </section>

    <section class="facts">
      <div class="fact"><span>Dries out in</span><b id="dry">–</b></div>
      <div class="fact"><span>Rain, next 24 h<em id="rainD"></em></span><b id="rain">–</b></div>
      <div class="fact"><span>Evaporation, next 24 h</span><b id="et0">–</b></div>
      <div class="fact"><span>County in drought<em id="drD"></em></span><b id="drV">–</b></div>
    </section>

    <section class="team">
      <div class="tabs" role="tablist">
        <button class="on" data-tab="team" role="tab">Agent team</button><button data-tab="pours" role="tab">Pours</button><button data-tab="ask" role="tab">Ask</button>
      </div>
      <div id="pane-team">
        <ul class="steps" id="steps">
          <li data-k="predictor"><i class="ph ph-trend-up"></i><span>Dry-time model</span><span class="w" id="w-predictor"></span></li>
          <li data-k="laya"><i class="ph ph-lightning-a"></i><span>Fast decider (Laya)</span><span class="w" id="w-laya"></span></li>
          <li class="group">at the same time</li>
          <li class="sub" data-k="weather_agent"><i class="ph ph-cloud-sun"></i><span>Weather</span><span class="w" id="w-weather_agent"></span></li>
          <li class="sub" data-k="soil_agent"><i class="ph ph-plant"></i><span>Soil</span><span class="w" id="w-soil_agent"></span></li>
          <li class="sub" data-k="memory_agent"><i class="ph ph-clock-counter-clockwise"></i><span>Memory</span><span class="w" id="w-memory_agent"></span></li>
          <li data-k="planner_agent"><i class="ph ph-clipboard-text"></i><span>Planner</span><span class="w" id="w-planner_agent"></span></li>
          <li data-k="critic_agent"><i class="ph ph-magnifying-glass"></i><span>Critic</span><span class="w" id="w-critic_agent"></span></li>
          <li data-k="guards"><i class="ph ph-shield-check"></i><span>Safety rules</span><span class="w" id="w-guards"></span></li>
          <li data-k="executor"><i class="ph ph-lightning"></i><span>Pump</span><span class="w" id="w-executor"></span></li>
          <li data-k="soak"><i class="ph ph-waves"></i><span>Pour detector</span><span class="w" id="w-soak"></span></li>
          <li data-k="target_agent"><i class="ph ph-crosshair"></i><span>Target controller</span><span class="w" id="w-target_agent"></span></li>
        </ul>
        <ul class="rules" id="rules"></ul>
        <ul class="log" id="log" style="margin-top:14px"></ul>
      </div>
      <div id="pane-pours" hidden><p class="muted" style="margin:0 0 8px">Each pour is watched for 3 minutes. What the probe sees sets the size of the next one. Learned: <b class="num" id="learn">–</b> % per pump second.</p><div id="soaks"><p class="muted">No pours yet.</p></div></div>
      <div id="pane-ask" hidden>
        <div class="ask"><input id="q" placeholder="Why did you water?" aria-label="Question for the farm"><button id="askBtn">Ask</button></div>
        <div class="sugg"><button>Why did you water?</button><button>How much would the timer have used?</button><button>How dry is the county?</button></div>
        <div class="reply" id="reply"><span class="muted">Gemini answers from the live sensors, forecast, drought map and its own log.</span></div>
      </div>
    </section>
  </aside>
</div>

<script>
const $ = id => document.getElementById(id);
const j = async (u, o) => (await fetch(u, o)).json();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clock = ts => new Date(ts * 1000).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}).replace(/\s(?=[AP]M)/, ' ');
const NAMES = {weather_agent:'Weather', soil_agent:'Soil', memory_agent:'Memory', planner_agent:'Planner', critic_agent:'Critic', guards:'Safety', executor:'Pump', farm_helper:'Chat', target_agent:'Target', laya:'Laya'};
window.LIVE = {busy:{}, soak:{}}; window.LENS = 'natural';
let S = null, tab = 'team', tgt = 55, showT = false;

document.querySelectorAll('[data-lens]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-lens]').forEach(x => x.classList.toggle('on', x === b)); window.LENS = b.dataset.lens; ramp(); });
function ramp() { const r = {natural:['#c8a878','#7a5534','#2a1c12'], moisture:['#c8a878','#5a8fc8','#1f5fb0'], temp:['#1f64b8','#c9b89a','#c4501f']}[window.LENS];
  ['--r0','--r1','--r2'].forEach((k, i) => $('ramp').style.setProperty(k, r[i])); }
ramp();
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  ['team','pours','ask'].forEach(t => $('pane-' + t).hidden = t !== tab); slow(); });

async function fast() {
  let L; try { L = await j('/api/live'); } catch (e) { return; }
  window.LIVE = L;
  $('pA').textContent = L.a != null ? L.a.toFixed(1) + '%' : '–';
  $('tA').textContent = L.temp != null ? L.temp.toFixed(1) + '°C' : '–';
  $('gA').style.transform = `scaleX(${Math.max(0, Math.min(1, (L.a ?? 0) / 100))})`;
  if (L.cfg) { $('okBand').style.left = L.cfg.dry + '%'; $('okBand').style.width = (L.cfg.wet - L.cfg.dry) + '%'; }
  const busy = Object.entries(L.busy || {}), w = $('working');
  drawTarget(L);
  if (L.pumping !== 'none') { w.classList.remove('idle'); $('workTxt').textContent = 'Pump running'; }
  else if (busy.length) { const [k, x] = busy[busy.length - 1]; w.classList.remove('idle'); $('workTxt').textContent = `${NAMES[k] || k}: ${x}`; }
  else if (L.soak?.phase === 'soaking') { w.classList.remove('idle'); $('workTxt').textContent = `Soaking in, ${L.soak.before?.toFixed(1)}% to ${L.soak.now?.toFixed(1)}%`; }
  else w.classList.add('idle');
  document.querySelectorAll('.steps li[data-k]').forEach(el => {
    const k = el.dataset.k, what = (L.busy || {})[k];
    let on = !!what; if (k === 'executor') on = on || L.pumping !== 'none'; if (k === 'soak') on = L.soak?.phase === 'soaking';
    el.classList.toggle('on', on); el.classList.toggle('bad', k === 'guards' && /^REFUSED/.test(what || '')); el.classList.toggle('warn', k === 'critic_agent' && /^sent back/.test(what || ''));
    const ww = $('w-' + k); if (!ww) return;
    if (what) ww.textContent = what;
    if (k === 'executor') ww.textContent = L.pumping !== 'none' ? 'running' : (what || '');
    if (k === 'soak') ww.textContent = L.soak?.phase === 'soaking' ? `${L.soak.before?.toFixed(1)} to ${L.soak.now?.toFixed(1)}%` : (L.soak?.last ? `last +${L.soak.last.rise_pct}%` : '');
  });
}

async function slow() {
  try { S = await j('/api/state'); } catch (e) { $('reason').textContent = 'Can\'t reach the Farm Hand server.'; return; }
  const d = S.drought || {}, f = S.forecast || {}, p = S.prediction || {}, L = S.latest || {};
  $('subline').textContent = S.fake ? 'Running on test data from the simulated board.' : S.online ? 'An AI agent team waters this pot. A timer is the thing to beat.' : 'The board is offline. Check the USB cable.';
  $('sA').textContent = `healthy ${S.config.dry}-${S.config.wet}%`;
  $('tSub').textContent = f.temp_c_now != null ? `outside air ${(+f.temp_c_now).toFixed(1)}°C, forecast` : 'steel probe in the soil';
  $('dry').textContent = p.settling ? 'measuring' : p.hours_until_dry != null ? (p.hours_until_dry < .05 ? 'now' : p.hours_until_dry >= 48 ? '2+ days' : `${p.hours_until_dry.toFixed(1)} h`) : '–';
  $('rain').textContent = f.rain_mm_next_24h != null ? `${f.rain_mm_next_24h} mm` : '–';
  $('rainD').textContent = f.max_rain_chance_next_24h != null ? `up to ${f.max_rain_chance_next_24h}% chance${S.config.outdoors ? '' : ', pot is indoors'}` : '';
  $('et0').textContent = f.et0_mm_next_24h != null ? `${f.et0_mm_next_24h} mm` : '–';
  $('drV').textContent = d.pct_in_D1_or_worse != null ? `${d.pct_in_D1_or_worse}%` : '–';
  $('drD').textContent = d.level ? `${(d.county || '').replace(' County', '')}, ${d.level} ${d.level_name}` : '';
  $('w-predictor').textContent = p.method === 'xgboost' ? 'XGBoost' : p.settling ? 're-measuring' : 'trend estimate';

  const dec = await j('/api/decisions');
  const ck = window.LIVE?.last?.check, la = window.LIVE?.last?.laya;
  if (ck && ck.t1 == null && !showT) {                     // a check is running (loop or button): never leave an old call up top
    $('verdict').textContent = 'Checking now'; $('verdict').className = 'verdict water';
    $('reason').textContent = la && la.ts >= ck.t0 ? `Laya's fast call: ${{water:'water', wait_rain:'wait for rain', wait_moist:'wait, the soil has water'}[la.pick] || la.pick}. The team is checking it.` : 'Reading the soil, the sky and its own memory.';
    $('by').textContent = `started ${clock(ck.t0)}`; $('by').className = 'who';
  } else if (dec.length && !$('runBtn').disabled && !showT) {
    const x = dec[0], tr = x.brain === 'target run', water = x.action === 'water' && !tr, hit = tr && /^TARGET: Locked/.test(x.sentence);
    const mins = Math.round((Date.now() / 1000 - x.ts) / 60), old = mins >= 30;
    $('verdict').textContent = tr ? (hit ? 'Target hit' : 'Target run stopped') : water ? `Watering ${(+x.seconds).toFixed(0)} s` : 'Holding off';
    $('verdict').className = 'verdict' + (old ? ' stale' : hit ? ' good' : water ? ' water' : '');
    $('reason').textContent = x.sentence.replace(/^(WATER|WAIT|TARGET):\s*/, '');
    const age = mins >= 90 ? Math.round(mins / 60) + ' h' : mins + ' min';
    $('by').className = 'who' + (old ? ' old' : '');
    $('by').textContent = old ? `Old call from ${clock(x.ts)}, ${age} ago. Press Run agents for a fresh one.`
      : `${x.brain.startsWith('gemini') ? 'Gemini agent team' : x.brain === 'target run' ? 'Target run' : x.brain.startsWith('laya') ? 'Laya fast decider' : 'Rule brain'}, ${clock(x.ts)}${mins >= 5 ? `, ${age} ago` : ''}`;
  }

  if (tab === 'team') {
    const g = S.guards || [], bad = g.filter(x => !x.ok);
    $('w-guards').textContent = bad.length ? `${bad.length} blocking` : 'all clear';
    $('rules').innerHTML = bad.map(x => `<li><i class="ph-fill ph-x-circle n"></i>${esc(x.rule)}<small>${esc(x.detail)}</small></li>`).join('');
    const act = await j('/api/activity');
    $('log').innerHTML = act.slice(0, 12).map(a => { const w = a.what || '', c = /^REFUSED|failed/i.test(w) ? 'bad' : /^approved|pump A/.test(w) ? 'good' : /^sent back/.test(w) ? 'warn' : '';
      return `<li class="${c}"><span class="t num">${clock(a.ts).replace(/ ?[AP]M/, '')}</span><span><b>${esc(NAMES[a.agent] || a.agent)}</b> ${esc(w)}</span></li>`; }).join('');
  } else if (tab === 'pours') {
    $('learn').textContent = S.learned_pct_per_s ?? '–';
    const soaks = await j('/api/soaks');
    if (soaks.length) $('soaks').innerHTML = soaks.slice(0, 8).map(x => `<div class="soak"><b class="num" style="color:${x.ok ? 'var(--ai)' : 'var(--bad)'}">${x.ok ? '+' + x.rise_pct + '%' : 'Missed the soil'}</b> <span class="muted">${clock(x.ts)}</span>
      <div>${x.poured_s} s pour, ${x.before_pct}% to ${x.peak_pct}%${x.first_rise_s != null ? `, reached the probe in ${x.first_rise_s} s` : ''}${x.ok ? '' : '. ' + esc(x.note)}</div></div>`).join('');
  }
}

$('runBtn').onclick = async () => {
  const b = $('runBtn'); b.disabled = true; b.lastChild.textContent = 'Agents working';
  $('verdict').textContent = 'Thinking'; $('verdict').className = 'verdict'; $('reason').textContent = 'Reading the soil, the sky and its own memory.';
  try { await j('/api/check-now', {method: 'POST'}); } finally { b.disabled = false; b.lastChild.textContent = 'Run agents'; slow(); }
};
$('pourBtn').onclick = async () => { const r = await j('/api/pour', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({seconds: 5})});
  if (!r.watered) { $('verdict').textContent = 'Blocked'; $('verdict').className = 'verdict bad'; $('reason').textContent = 'Safety rules said no: ' + r.refused_because + '.'; } slow(); };
$('stopBtn').onclick = () => fetch('/api/stop', {method: 'POST'});
const setT = v => { tgt = Math.max(36, Math.min(68, v)); $('tVal').textContent = tgt + '%'; };
$('tMinus').onclick = () => setT(tgt - 1); $('tPlus').onclick = () => setT(tgt + 1);
$('goBtn').onclick = async () => { const r = await j('/api/target', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pct: tgt})});
  if (!r.ok) { $('verdict').textContent = 'Can\'t start'; $('verdict').className = 'verdict bad'; $('reason').textContent = r.why + '.'; } };
$('pinchBtn').onclick = () => j('/api/demo/pinch', {method: 'POST'});
const DONE = {locked:1, over:1, fault:1, blocked:1, stopped:1, short:1};
function drawTarget(L) {
  const T = L.target || {}, ph = T.phase || 'idle', end = DONE[ph], recent = end && Date.now() / 1000 - (T.t_end || 0) < 240;
  $('pinchBtn').hidden = !L.fake; $('pinchBtn').lastChild.textContent = L.pinched ? 'Tube pinched: tap to release' : 'Pinch the tube (test)';
  $('pinchBtn').style.color = L.pinched ? 'var(--bad)' : '';
  showT = ph !== 'idle' && (!end || recent);
  $('goBtn').disabled = ph !== 'idle' && !end;
  $('hud').hidden = !showT; if (!showT) { $('pulses').innerHTML = ''; return; }
  const now = end ? T.now : (L.a ?? T.now), good = ph === 'locked', bad = ph === 'fault' || ph === 'blocked';
  $('hud').className = 'hud' + (good ? ' good' : bad ? ' bad' : '');
  $('hudLbl').textContent = good ? 'Target hit' : bad ? 'Stopped' : end ? 'Target run over' : 'Aiming for target';
  $('hudNow').textContent = now != null ? now.toFixed(1) + '%' : '–';
  $('hudOf').textContent = `target ${T.target}% ±${T.band}, started at ${T.start}%`;
  const pos = v => Math.max(0, Math.min(100, (v - T.start) / Math.max(1, T.target + T.band - T.start) * 100));
  $('hudBar').style.transform = `scaleX(${pos(now) / 100})`; $('hudMark').style.left = pos(T.target) + '%';
  const P = T.pulses || [];
  $('pulses').innerHTML = P.map((p, i) => `<li class="num${ph === 'fault' && i === P.length - 1 ? ' bad' : ''}">${p.s} s ${p.rise >= 0 ? '+' : ''}${p.rise}%</li>`).join('');
  $('verdict').className = 'verdict ' + (good ? 'good' : bad ? 'bad' : 'water');
  $('verdict').textContent = good ? `Hit ${T.now}%` : ph === 'fault' ? 'Water isn\'t arriving' : ph === 'blocked' ? 'Blocked' : end ? 'Target run over' : `Aiming ${T.target}%`;
  $('reason').textContent = T.msg || '';
  $('by').textContent = end ? `${P.length} pulse${P.length === 1 ? '' : 's'}, ${T.secs} s of pumping, ${T.ml} ml, ${T.took_s} s total. Learned ${(+T.rate).toFixed(2)} % per second.`
    : `Pulse ${P.length + 1}, learned ${(+T.rate).toFixed(2)} % per second${ph === 'settling' ? '. Waiting for the water to reach the probe.' : ''}`;
}
async function ask(q) { if (!q) return; $('reply').innerHTML = '<span class="muted">Gemini is checking its tools…</span>';
  const r = await j('/api/ask', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({q})}); $('reply').textContent = r.answer; }
$('askBtn').onclick = () => ask($('q').value);
$('q').onkeydown = e => { if (e.key === 'Enter') ask($('q').value); };
document.querySelectorAll('.sugg button').forEach(x => x.onclick = () => { $('q').value = x.textContent; ask(x.textContent); });
fast(); slow(); setInterval(fast, 400); setInterval(slow, 3000);
</script>
<script src="views.js"></script>
<script type="module" src="scene.js"></script>
</body>
</html>
```

### `laptop/requirements.txt`

```text
google-adk
litellm
pyserial
fastapi
uvicorn
xgboost
scikit-learn
numpy
requests
```

### `../wokwi/diagram.json`

```json
{
 "version": 1,
 "author": "Dechante",
 "editor": "wokwi",
 "parts": [
  {
   "type": "board-esp32-devkit-c-v4",
   "id": "esp",
   "top": 0,
   "left": 0,
   "attrs": {}
  },
  {
   "type": "wokwi-potentiometer",
   "id": "soilA",
   "top": -60,
   "left": -330,
   "attrs": {}
  },
  {
   "type": "wokwi-potentiometer",
   "id": "soilB",
   "top": 110,
   "left": -330,
   "attrs": {}
  },
  {
   "type": "wokwi-ds18b20",
   "id": "temp",
   "top": -110,
   "left": -150,
   "attrs": {}
  },
  {
   "type": "wokwi-resistor",
   "id": "pullup",
   "top": 40,
   "left": -110,
   "rotate": 90,
   "attrs": {
    "value": "4700"
   }
  },
  {
   "type": "wokwi-relay-module",
   "id": "relayA",
   "top": -20,
   "left": 220,
   "attrs": {}
  },
  {
   "type": "wokwi-relay-module",
   "id": "relayB",
   "top": 130,
   "left": 220,
   "attrs": {}
  },
  {
   "type": "wokwi-led",
   "id": "pumpA",
   "top": -40,
   "left": 470,
   "attrs": {
    "color": "blue",
    "label": "PUMP A"
   }
  },
  {
   "type": "wokwi-led",
   "id": "pumpB",
   "top": 110,
   "left": 470,
   "attrs": {
    "color": "cyan",
    "label": "PUMP B"
   }
  },
  {
   "type": "wokwi-resistor",
   "id": "rA",
   "top": 10,
   "left": 360,
   "attrs": {
    "value": "220"
   }
  },
  {
   "type": "wokwi-resistor",
   "id": "rB",
   "top": 160,
   "left": 360,
   "attrs": {
    "value": "220"
   }
  }
 ],
 "connections": [
  [
   "esp:TX",
   "$serialMonitor:RX",
   "",
   []
  ],
  [
   "esp:RX",
   "$serialMonitor:TX",
   "",
   []
  ],
  [
   "soilA:VCC",
   "esp:3V3",
   "red",
   []
  ],
  [
   "soilA:GND",
   "esp:GND.1",
   "black",
   []
  ],
  [
   "soilA:SIG",
   "esp:32",
   "yellow",
   []
  ],
  [
   "soilB:VCC",
   "esp:3V3",
   "red",
   []
  ],
  [
   "soilB:GND",
   "esp:GND.1",
   "black",
   []
  ],
  [
   "soilB:SIG",
   "esp:33",
   "orange",
   []
  ],
  [
   "temp:VCC",
   "esp:3V3",
   "red",
   []
  ],
  [
   "temp:GND",
   "esp:GND.1",
   "black",
   []
  ],
  [
   "temp:DQ",
   "esp:4",
   "green",
   []
  ],
  [
   "pullup:1",
   "esp:3V3",
   "red",
   []
  ],
  [
   "pullup:2",
   "esp:4",
   "green",
   []
  ],
  [
   "relayA:VCC",
   "esp:5V",
   "red",
   []
  ],
  [
   "relayA:GND",
   "esp:GND.2",
   "black",
   []
  ],
  [
   "relayA:IN",
   "esp:26",
   "purple",
   []
  ],
  [
   "relayB:VCC",
   "esp:5V",
   "red",
   []
  ],
  [
   "relayB:GND",
   "esp:GND.2",
   "black",
   []
  ],
  [
   "relayB:IN",
   "esp:27",
   "violet",
   []
  ],
  [
   "relayA:COM",
   "esp:5V",
   "red",
   []
  ],
  [
   "relayA:NO",
   "rA:1",
   "blue",
   []
  ],
  [
   "rA:2",
   "pumpA:A",
   "blue",
   []
  ],
  [
   "pumpA:C",
   "esp:GND.2",
   "black",
   []
  ],
  [
   "relayB:COM",
   "esp:5V",
   "red",
   []
  ],
  [
   "relayB:NO",
   "rB:1",
   "cyan",
   []
  ],
  [
   "rB:2",
   "pumpB:A",
   "cyan",
   []
  ],
  [
   "pumpB:C",
   "esp:GND.2",
   "black",
   []
  ]
 ],
 "dependencies": {}
}
```

