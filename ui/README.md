# Farm Hand virtual rig (UI)

A web page that acts out the real Farm Hand build from `PLAN.md`: one box of soil, the soil and temp probes, the pump in its cup, the relay and the ESP32, plus the laptop logic around them. No build step, no dependencies.

**Run it:** open `ui/index.html` in a browser (double-click works). Or `python -m http.server` in `ui/` and go to http://localhost:8000.

## What's on the page
- **The rig**: the soil darkens as moisture rises, water runs down the tube and drips while the pump runs, the relay LED lights, the probe LED goes green / red (dry) / blue (pumping), the cup drains.
- **The call**: "Watering 16 s" / "Holding off" with the reason. The check runs every 15 min, or press **Run agents**. Laya (fast call) + the Gemini team (explains) are simulated.
- **Safety rules**: board online, not already wet (70%), 30 min between AI pours, 1,500 ml a day, last pour done soaking, 30 s max.
- **Hit a target**: pick 36–68%, press Go. It pulses (70% of the gap, max 8 s), waits for each pulse to soak in, learns the soak rate, and stops within 1% below the target.
- **Pinch the tube**: the pump runs but no water arrives, and it stops and says so. **Pour a cup in by hand**: the "someone added water" banner. **Refill the cup**: the pump cup runs dry after about 1.5 L.
- **Soil over time**: moisture, a simulated timer pot (5 s every 6 h), soil temp, pour dots, and the water saved vs the timer (only full 6 h timer intervals count).
- **Tabs**: agent team, every pour (what it did to the soil), and the raw serial lines the chip prints.
- **Speed**: real time, 1 min/s, 10 min/s, 1 h/s, and Skip 6 h.

## Files
- `sim.js`: the model. `Soil` (soak-in and drying), `SimBoard` (the chip: `P A <ms>`, `X`, 30 s cap, JSON reading lines), `FarmHand` (call, guards, pour detector, hand-pour detector, Hit the Target, virtual timer). No DOM.
- `app.js`: draws the model and wires the buttons. `window.farmHand` is the live sim in the console.
- `index.html`, `style.css`: layout and the house style (blue = AI, orange = timer, purple = temp).

## Model numbers (all in `CFG` at the top of `sim.js`)
Pump 20 ml/s. 0.04% soil per ml (the real 10 s pour took 44% → 52%). Water reaches the probe in about 6 s. Drying 0.8%/h at 26 °C, faster when warm and wet. Probe noise ±0.25%.

## Going live later
The page only talks to `FarmHand`, and `FarmHand` sends the board `P A <ms>` / `X` through `command()` and reads the moisture it gets back. To show the real rig, replace `SimBoard` and `Soil` with a feed of the real serial JSON (for example over a WebSocket from `server.py`). The buttons that fake the world (pinch, hand pour, refill) then become things a person does to the real box.
