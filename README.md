# Farm Hand: the full plan (ShellHacks 2026)

Florida's 2026 drought is killing crops. When a crop dies, you lose the time it took to grow it.
Farm Hand watches soil moisture + temperature every second, a small fast AI makes the watering call, a Gemini agent team checks the forecast and explains why, and it shows how much water it saved vs a normal sprinkler timer.

This repo is the plan and the designs, plus `ui/`: a virtual version of the rig you can open in a browser. It runs the same rules as the real code in `farm-hand/` on `main` (see `ui/README.md`).

## Read in this order
1. **`PLAN.md`**: the whole plan. Parts, the real wiring (section 2), how the hardware was proven on 2026-09-23 (section 3), the AI agent team (5), the dashboard (5b), Hit the Target demo (5c), hackathon schedule (6), the 2-minute demo (7), judge Q&A (8), sponsor tracks (9), risks (10).
2. **`pitch/story_final.md`**: the 30-second opening story and the honesty rules. `pitch/story_draft.md` has every source and quote.
3. **The trailer** (57 s, real news clips, the San Juan nursery story leads) is in the Release, `videos-and-audio.zip` → `media/farmhand-drought-trailer.mp4`. `media/trailer-plan.json` is its script.
4. **`design/`**: the look.
   - `concept-frames/`: design concept frames.
   - `dashboard-screens/`: screenshots of the dashboard views (money graph, whole-field view, hand-pour alert, phone).
   - `board.html` + `board_shot_*.png`: the design board. `pages/`: hardware tour page.
   - `pitch/DESIGN-HANDOFF.md`: what the dashboard is, what views come next, and the honesty rules for design.
5. **`wiring/pages/`**: step-by-step animated wiring pages (open `index.html` in a browser). `assemble/` is the whole build in 26 steps; `transistor/`, `pump/`, `temp/`, `soil/` are the parts.
6. **`research/`**: Florida drought facts with sources, last year's sponsor challenges, and a judges' conference comparing Farm Hand with a HackMIT winner.

## The hardware (proven working 2026-09-23)
ESP32 + capacitive soil probe + DS18B20 temperature probe + 5 V relay (driven through a PN2222 transistor) + mini pump, all on laptop USB.
Measured: soil 44%, temp 26.1 °C; a 10-second pour raised soil 44% → 52% with no restart.

## To buy
- Water flow sensor, 3-pack (small-flow YF-S401/S402 style; needs a resistor divider to 3.3 V).
- 0.96" OLED screen (SSD1306) for the box.

## Everything else (added 2026-09-26: all the prep code)
- `farm-hand/`: all the code. Firmware (`firmware/farm_hand/farm_hand.ino`), laptop app + dashboard (`laptop/`, run `server.py`), Laya decision model code (`laya/`, weights on Hugging Face), wiring page builders (`tools/`), Blender model (`blender/`), design work (`design/`), evidence logs (`evidence/`). Its own `farm-hand/PLAN.md` has the code appendix.
- `gridlock/`, `opening-ceremony/`: other ShellHacks prep (idea research, the opening ceremony notes).
- `wokwi/`: the browser simulation of the wiring.
- Research data: `gallery_2025.json`, `winners_*.json`, `prizes_raw.json`, `drought_videos/`.

## Big files: the Release (not in the repo, so pulls stay small)
https://github.com/matthewlos/Shellhacks-Hackathon-Project/releases/tag/prep-media
- `videos-and-audio.zip` (286 MB): the trailer, the 3D water animation recordings, test captures, the opening ceremony audio.
- `design-frames.zip` (305 MB): the full-size design concept frames (`farm-hand/design/frames`, `frames_v1`).
- `test-captures.zip` (183 MB): dashboard/animation test screenshots from `farm-hand/laptop/data/rec`.
Unzip at the repo root and every file lands back in its folder.
