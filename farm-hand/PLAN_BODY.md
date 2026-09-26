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
