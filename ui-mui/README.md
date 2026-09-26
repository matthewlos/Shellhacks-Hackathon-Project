# Farm Hand simulator: React + MUI

This is the same virtual rig as `../ui/`, rebuilt in React + MUI. The model is `../ui/sim.js`, imported unchanged, so both pages run the same rules as `farm-hand/`. Every number on the page is simulated.

```
cd ui-mui
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/ (relative paths, so dist/index.html can be served from any folder)
npm run preview    # serve dist/
```

`window.farmHand` is the live sim in the browser console.

Pages (hash routes): `#/` Live (box A), `#/control` Vs timer (box A vs box B), `#/sim` Outside (the 21-month result, crops at a moisture level, and the season replay once `sim_data.json` exists).

- `src/theme.js`: every color, font, size, radius and motion token.
- `src/pages/`: LivePage, ControlPage, SimPage.
- `src/useFarmHand.js`: runs the sim loop and re-renders about 10 times a second (ages and countdowns in simulated time).
- `src/chartAB.js`: the Control page's canvas chart (box A vs box B).
- `src/live.js`: the pump clock, the reading age and the one alert on screen.
- `src/format.js`: number and time formats, the glossary maps (BY, PICK, BRAIN, RULE) and `callSentence()`, which shapes `sim.js` decision sentences for display.
- `src/components/`: TopBar, Stage + Rig, RightColumn (LiveNow, TheCall, Controls, BaselineSlider, WeatherCard), AlertOverlay, LogTabs, Roll.

Design decisions and their sources are in `DESIGN.md`.
