# Farm Hand: the full plan (ShellHacks 2026)

Florida's 2026 drought is killing crops. When a crop dies, you lose the time it took to grow it.
Farm Hand watches soil moisture + temperature every second, a small fast AI makes the watering call, a Gemini agent team checks the forecast and explains why, and it shows how much water it saved vs a normal sprinkler timer.

This repo is the plan and the designs, plus `ui/`: a virtual version of the rig you can open in a browser (see `ui/README.md`). The real firmware and laptop code get built at ShellHacks.

## Read in this order
1. **`PLAN.md`**: the whole plan. Parts, the real wiring (section 2), how the hardware was proven on 2026-09-23 (section 3), the AI agent team (5), the dashboard (5b), Hit the Target demo (5c), hackathon schedule (6), the 2-minute demo (7), judge Q&A (8), sponsor tracks (9), risks (10).
2. **`pitch/story_final.md`**: the 30-second opening story and the honesty rules. `pitch/story_draft.md` has every source and quote.
3. **`media/farmhand-drought-trailer.mp4`**: 57 s trailer from real news clips (the San Juan nursery story leads). `media/trailer-plan.json` is its script.
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
