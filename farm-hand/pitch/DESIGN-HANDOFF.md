# Farm Hand design handoff (for the "farmhand design" chat, 2026-09-24)

You are working on the Farm Hand front end + views for ShellHacks 2026 (FIU, Miami). The hardware works. Your job: make the dashboard legendary.
Folder: `C:\Users\User\Documents\code\shellhacks2025\farm-hand\`. Read `PLAN.md` sections 2, 3, 5, 5b, 5c first (built by `build_plan.py` from `PLAN_BODY.md`: edit PLAN_BODY, then re-run `python build_plan.py`).

## What Farm Hand is (the pitch)
Florida's 2026 drought is killing crops. A dead crop isn't one bad day: you lose the time it took to grow it. Farm Hand watches soil moisture + temperature every second, a small fast AI (Laya) makes the watering call, a Gemini agent team checks the forecast and explains why. It waters only when the soil needs it and shows how much water it saved vs a normal timer.
Opening story + every source: `pitch/story_final.md`, `pitch/story_draft.md`. The line: "When a crop dies, you lose the time it took to grow it, too."
Trailer (57 s, news clips, San Juan nursery story leads): `C:\Users\User\Documents\code\chinstein-channel\out\_farmhand-trailer\farmhand-drought-trailer.mp4`.

## Real hardware, proven 2026-09-23
ESP32 + capacitive soil probe (pin 32) + DS18B20 temp probe (pin 4) + relay (via PN2222 transistor on pin 26) + mini pump, all on laptop USB.
Real firmware prints one JSON line a second: `{"type":"reading","a_raw","a_pct","temp_c","pumping"}`. Proof: soil 44%, temp 26.1 °C, a 10 s pour took soil 44% → 52%, no restarts.
Wiring pictures: `docs/assemble/index.html` (served at http://127.0.0.1:8097/assemble by `tools/power_page.py`).

## The dashboard today (built)
- Run: `.venv\Scripts\python laptop\server.py` → http://127.0.0.1:8080. No board? `set SERIAL_PORT=fake` (simulated board, the page says so at the top).
- Files: `laptop/static/index.html` (page), `laptop/static/scene.js` (three.js), `laptop/static/soil_shader.js` (soil + water look adapted from Prompt Grass, MIT, credited in `THIRD_PARTY_NOTICES.md`), `laptop/static/models/farmhand.glb` (built in Blender by `blender/build_farmhand.py`, parts in `blender/hardware.py`). Older versions `index_v*.html` / `scene_v*.js` are backups.
- Layout: 3D Mainstays box on the left (soil darkens where water soaks in, stream + splash on a pour, probe LED, rim glows while agents work). Right column: the call ("Watering 16 s" / "Holding off"), Run agents / Test pour 5 s / Stop pump, Hit the Target picker, numbers (moisture + healthy band, water saved vs timer, dries out in, rain, evaporation, county drought), tabs: Agent team (each agent lights blue while it works, safety rules red when they block), Pours, Ask (Gemini chat).
- House style (visual-page tokens): light theme, blue = the AI/agents, orange = the timer, fonts Bricolage Grotesque / Atkinson Hyperlegible Next / JetBrains Mono (numbers only). Skill: `Life OS/Claude/skills/visual-page/Visual Page Skill Digest.md`.
- Screenshots of past versions: `laptop/data/v*.png` (e.g. v14_mainstays.png, v15_target_mid.png).

## What the owner wants next (ideas agreed in the Farm Hand chat, not built yet)
Goal: a judge gets it in 10 seconds: it's alive, it's smart, it saved water. Show moisture, temperature, and the data.
1. The money graph: soil moisture over time + a ghost ORANGE line of what a timer would have done (waters on schedule even when wet), with a counter "cups saved". The timer baseline is virtual (ONE_POT=1: schedule × measured flow): label it "estimated".
2. Judge-pour alert: a judge pours water in, the pour detector (`laptop/soak.py`) sees the jump, big banner: "Someone just added water, +8%. I'm skipping my next watering."
3. Field view: zoom out from the one box to a farm map covered in probe dots, labeled "what a field looks like" (the scale story: one board reads several probes, run longer waterproof wire).
4. AI shown as fast + smart: Laya decides instantly on stage (94.1% on real Miami weather, `laya/serve_decider.py` :8091, called from `laptop/brain.py`), the Gemini team explains why after.
Temperature needs to be as visible as moisture (owner: "monitor soil moisture, temperature, wanna show all that").

## Honesty rules (don't break these)
- Only real numbers on screen for the real board. The fake board stays labeled FAKE/test data.
- The depth shading and sinking water band are a model ("modeled from one probe"). Only the probe % is measured.
- "Wait on the rain" works only with OUTDOORS=1 (`laptop/config.py:25`); the pot is indoors, so indoors say "in a field it waits on the rain".
- Crop-suitability ("can this crop thrive here") is NOT built. Don't show it as working.
- Field view = an illustration of scale, labeled as such.

## Owner rules
Show him the page, don't describe it (screenshot it yourself first). Code stays in `Documents\code\...`. Verify visually before saying done. He talks casual, wants short answers with the real file/number.
