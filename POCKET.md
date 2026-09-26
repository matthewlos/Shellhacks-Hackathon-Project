# ShellHacks pocket picks (saved 2026-09-21)

Projects to have ready for ShellHacks. Rebuild the idea fresh at the event, do not submit the original team's code.
Tracks below are from ShellHacks 2025 (`sponsor_challenges_2025.md`); re-check against the 2026 sponsor list the day it drops.

## 1. Klick (HackMIT 2026: Meta 1st, Warp, Espressif)
- What: your phone holds an AI twin of you. When two people walk past each other, the phones find each other over Bluetooth,
  the twins talk, and if there's a real reason to meet, both get a notification saying why.
- Why it wins at ShellHacks: Google Cloud asked for ADK or A2A (agent-to-agent). Two twins negotiating IS agent-to-agent.
  1,400+ hackers in one building makes the live demo work by itself.
- Tracks: Google Cloud ($1,000 / $800 / $500 credits per person), Best Overall, Google Social Good, Microsoft AI 4 Good, GitHub.
- Their code: 7,300 lines Kotlin (Android app), 3,050 TS (Firebase functions), 5,244 JS (judge dashboard), 3,558 C (optional badges).
- Hard part: Android Bluetooth advertise + scan at the same time with the screen off. Practice this before the event.
- Code to study: `Documents\code\hackmit-winner-repos\2026-klick`

## 2. Farm Hand (our build; idea started from HackMIT 2026 Prompt Grass, SpaceX AI winner. Only its soil + water shader is reused, MIT, credited in `farm-hand/laptop/static/THIRD_PARTY_NOTICES.md`)
- What: cheap ESP32 sensors stuck in soil read moisture and temperature, and AI tells a farmer where to water.
- Why it wins at ShellHacks: sustainability took 2 of 3 Best Overall spots in 2025 (EcoSort, FloodGuard), both software only.
  Real sensors in real dirt beat that.
- Tracks: Best Overall, Google Social Good, Microsoft AI 4 Good (sustainability), NVIDIA if the model runs on a Jetson.
- Their code: 2 Arduino sketches (`firmware/pour/pour.ino`, `firmware/sensor_test/sensor_test.ino`) + a TypeScript web app, 14 commits.
- Parts: ESP32, capacitive soil moisture sensors, temperature sensor. Roughly $20.
- Code to study: `Documents\code\hackmit-winner-repos\2026-prompt-grass-grow-grass`

Build: `Documents\code\shellhacks2025\farm-hand\` (renamed from Prompt Grass 2026-09-23).

### LOCKED PLAN (Dechante 2026-09-22: "this is excellent this is major")
- Framing: Florida drought (facts + sources in `farm_hand_florida_facts.md`). Hard number = water saved vs a timer.
- 2 pots, same plant + soil:
  - Pot A: watered by the AI.
  - Pot B: dumb timer, no AI (the control).
- Parts on hand (Amazon cart $72.94, arriving Sep 23): soil sensor 5-pack, SIPYTOPF pump 4-pack (bare wires, no cutting),
  4x 1-channel relays, ESP32 USB-C. No extra buys.
- Wiring:
  - Sensors on pins 32/33/34/35 only (the ADC1 pins; the other analog pins die once WiFi is on).
  - Relay 1 IN goes to pin 26 (Pump A). Relay 2 IN goes to pin 27 (Pump B).
  - Relays share 5V/GND from the breadboard rails. Each pump runs through its relay's COM/NO.
  - Never run both pumps at once (brownout). Stagger them 5 s apart.
- ESP32 does no AI. Hard safety rule: the pump never runs more than 30 s.
- AI pipeline (Google ADK + Gemini; targets Google Cloud $4,000 track, MLH Best Use of Gemini, Microsoft AI 4 Good):
  - Loop: every 15 min.
  - Runs in parallel:
    - Weather agent: rain forecast, drought level, legal watering day.
    - Soil agent: Pot A sensor + XGBoost "hours until dry" predictor.
  - Boss agent: combines both and decides "water N s" or "wait".
  - Gemini writes a 1-sentence explanation of each decision for the dashboard.
- NOT Laya/Jev: they're text pickers and the data is numbers. Only revisit if TypeSafe is a 2026 sponsor.
- Re-check the 2026 sponsor list: this whole plan assumes Google Cloud is back.

## 3. ROFL (HackMIT 2026: Voloridge)
- What: GPU code that turns giant time-series data (weather, stocks) into model-ready features, fast.
  Their claim: 2-3x faster than cuDF, 8-12x faster than pandas.
- Why it's in the pipeline: pure software, runs on the RTX 4070 already in the house, and the benchmark logs
  are in the repo (`runs/`) so the proof method is copyable. Swap their NOAA Boston data for Florida heat data.
- Their code: 2,727 lines of Python, no C++, built by one person in 2 commits.
- Code to study: `Documents\code\hackmit-winner-repos\2026-rofl-cuda-kernels`
- Note: the 2025 Voloridge winner (Multivariate Distribution Parallelism, 220x speedup) is a dead GitHub link, write-up only.

## Back pocket
- PIXX-AR (HackMIT 2026 Visa $5,000): only if Visa is a 2026 ShellHacks sponsor. Visa was not at ShellHacks 2025.
  `Documents\code\hackmit-winner-repos\2026-pixx-ar`
