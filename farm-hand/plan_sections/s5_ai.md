## 5. The AI part: a Gemini agent team (Google ADK)

Every 15 minutes (`CHECK_EVERY_MIN`), or when you press **Ask the agents now**:

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
- **The critic really rejects.** In a live test it sent a plan back because "the farmer sentence contains numbers that were not given by the tools". The planner fixed it, then it got approved.
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
2. `RIGHTCODES_KEY_GEMINI` set → Gemini through right.codes (`gemini-3.8-flash`). That's how everything got tested on 2026-09-22.
3. Neither → rules.

```
set GOOGLE_API_KEY=your_key_here
.venv\Scripts\python laptop\server.py
```

⚠️ **Speed:** a full team check took 56.6 s, 125.0 s and 154.3 s through right.codes, and one run hit the timeout (the rule brain took over and watered correctly). For the live demo:
- test Google's direct API on Sep 23 and time it
- press the button while you're still talking about the problem, so the agents finish by the time you point at the pot
- worst case, the fallback still waters on stage

Live data sources (free, no key, tested 2026-09-22):
- **Open-Meteo:** rain chance, rain mm, ET0 (how much water the air pulls out of soil)
- **US Drought Monitor county API:** Miami-Dade, week of 2026-09-15 = **100% in drought (D1+), 55.4% severe (D2+)**

Indoors vs outdoors: set `OUTDOORS=1` only if rain can land on the pots. Indoors (the default), the team ignores rain, so it never waits for rain that can't reach the pot.

## 5b. The live view

The dashboard (http://127.0.0.1:8080) has a live 3D scene. It updates twice a second from `/api/live`:
- **2 pots.** Soil darkens as it gets wetter, the probe light goes red/green/blue, and the grass droops and yellows when it's dry.
- **Pump runs** → water falls from the tube into that pot.
- **After a pour** → a blue ring (the wetting front) sinks down through the soil while the pour detector watches the probe climb.
- **Agent orbs** above Pot A glow and beam at the pot while each agent works. The Safety orb glows red when it refuses a pour.
- The side panel says what each agent is doing right now ("calls get_forecast", "sent back: …", "pump A 15s").
- On the fake board, `POST /api/demo/dry` dries Pot A instantly. On the real board you pull the probe out of the soil instead.

Next step: put a second probe deeper in the pot (you have 3 spare) on pin 34 and time the water between the two. Then the water band becomes a real measurement instead of a model.

