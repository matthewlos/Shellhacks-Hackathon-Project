# Farm Hand virtual rig (UI)

A web page that acts out the real Farm Hand build: one box of soil, the soil and temp probes, the pump in its cup, the relay and the ESP32, plus the laptop logic around them. It runs the same rules as the real code in `farm-hand/`, in the browser, with a modeled box of soil instead of the real one. No build step, no dependencies.

**Run it:** open `ui/index.html` in a browser (double-click works). Or `python -m http.server` in `ui/` and go to http://localhost:8000.

## What matches the real code
| Sim (`sim.js`) | Real file (`farm-hand/…`) |
|---|---|
| `SimBoard`: `P A <ms>`, `T <every_s> <ms>`, `S`, `X`; `boot` / `reading` / `pour_start` / `pour_done` / `refused` (busy, gap) / `timer` / `error` JSON lines; 30 s cap, 5 s gap between pours, 1 reading a second | `firmware/farm_hand/farm_hand.ino` |
| Pour tags `laptop` (AI) / `manual` (test pour) / `target`; `T 0` sent at start (one-pot mode) | `laptop/board.py` |
| `guards()` and the guard report: board online, not wet (70%), no target run, 30 min since the last pot A pour (test pours too), daily cap since midnight, last pour finished soaking | `laptop/brain.py` |
| Decisions: water only at or below 40% (dry line + 5), seconds = (55 − soil) / learned %/s; 2 failed pours → wait; Laya first, then the Gemini team, or Laya only, or rules | `laptop/brain.py` |
| Pour detector: watch 180 s, rise = peak − before, ok at +1.5%; learned rate = median of the last 5 good pours (1.2 %/s until then). Hand pour: +4% vs 45–120 s ago, pump quiet 4 min | `laptop/soak.py` |
| Hit the Target: 35–68%, up to 6 pulses of 70% of the gap (1–8 s), settle 12–90 s, stop 1% below, ±2% band, fault if a 3%+ pulse moves under 30% of what it should | `laptop/target.py` |
| Water saved: virtual timer (5 s every 6 h, full intervals only) vs every pot A pour, test pours and demos included; the orange "if a timer watered" line | `laptop/report.py`, `laptop/static/views.js` |

## What is simulated (not from the real code)
- **The soil**: 0.04% per ml (the real box took 200 ml → +8% on 2026-09-23), water seeps to the probe at 0.4 %/s, drying 0.8 %/h at 26 °C (faster when hot or wet), probe noise ±0.25%, temperature 27 ± 5 °C over the day like the simulated board. The drying rate is a guess.
- **Laya**: the real one is a fine-tuned model (`laya/`). Here it picks water at or below 40%, else "wait, soil has water", in 12–32 ms.
- **The Gemini team**: the timings (20–50 s) and the critic sending a plan back about 1 time in 4 are made up. The plan follows the planner's rules of thumb.
- The forecast and drought feeds: the pot is indoors, so rain is ignored; the county drought number is the saved Sep 15 value.

## Buttons
Run agents, Test pour 5 s, Stop pump, Hit a target and the brain picker work like the real dashboard. Pinch the tube, Pour a cup in by hand, Dry the soil out and Refill the cup act on the modeled box (the real server's `/api/demo/*`). Speed: real time, 1 min/s, 10 min/s, 1 h/s, and Skip 6 h. `window.farmHand` is the live sim in the console.

## Files
- `sim.js`: `World` (the modeled soil), `SimBoard` (the chip), `FarmHand` (board.py + brain.py + soak.py + target.py + report.py). No DOM.
- `app.js`: draws it and wires the buttons.
- `index.html`, `style.css`: layout and the house style (blue = AI, orange = timer, purple = temp).

## Going live later
`FarmHand` exposes the same things `server.py` serves (`latest`, `live`, `hand`, `run`, `guardReport()`, `report()`, `activity`, `decisions`, `soaks`), so `app.js` could read `/api/live`, `/api/state` and `/api/series` from the real server instead.
