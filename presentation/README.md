# Farm Hand presentation

A standalone, four-section presentation: **Problem, Solution, One cycle, Results**.
All scripts, fonts, diagrams, and data are local. No install, build step, API key,
network connection, or running hardware is required.

Open `index.html` directly, or serve this directory from the repository root:

```sh
python3 -m http.server 5180 --bind 127.0.0.1 --directory presentation
```

Then open <http://localhost:5180>.

## Presenting

- Use the top navigation, scroll, or the bottom arrows.
- Left/right arrows, Page Up/Down, or Space change sections. Keys 1–4 jump to a
  section; Home/End go to the first/last. Controls retain their normal keyboard behavior.
- Press F or the fullscreen control to enter/exit fullscreen where supported.
- The pause button stops animations. Device reduced-motion preferences are respected;
  the watering visualization then advances one step at a time.
- In One cycle, press Play or pick a step (Read, Decide, Pour, Check). It stops at the end,
  and can be replayed. It pauses when the section or browser tab is not visible.
- Expand "Source and all four methods" for the full evaluation table.
- Browser print produces a static four-section handout.

## Content and evidence

- The narrative follows `pitch/story_final.md` without repeating dated drought statistics.
- The hardware check (44% to 52% after a 10-second pour) is recorded in the repository's
  `README.md` and `pitch/DESIGN-HANDOFF.md`. It is separate from the animation.
- The diagram uses illustrative moisture readings (32% to 48%); it is not a live
  dashboard and does not control any pump or call a backend.
- Results come from `farm-hand/laya/data/eval.md`, copied verbatim to
  `assets/evaluation.md` so the source is available offline. The chart shows exact
  irrigation totals. 56.2% is the evaluation's reported rounded reduction.
- The replay models a sandy-soil field using real Miami weather. It is not measured
  field savings. The model's 94.1% held-out accuracy and 85.8% balanced accuracy are
  decision-label agreement, not crop survival or farm yield.
- The animation and all illustrations are original SVG/CSS. Public Sans is bundled
  under its SIL Open Font License in `assets/FONT-LICENSE.txt`.

## Design

The look follows the app's rules in `ui-mui/src/theme.js` and `ui-mui/DESIGN.md`, so the
deck and the dashboard read as one product:

- Ink on white, sections split by space and 1px rules. Color is for data only: water
  blue for Farm Hand and moisture, orange for the timer. Buttons and focus rings are ink.
- One family, Public Sans, at six sizes (12 / 14 / 16 / 24 / display / tier 1), sentence
  case, no letter-spaced labels, tabular numbers, units at half the size of their number.
- No eyebrows, serif accents, gradients, halos, pills, emoji, arrow glyphs or em dashes.
- Radii of 2px and 4px. One ease-out, `cubic-bezier(0.23, 1, 0.32, 1)`, and UI motion
  under 300 ms. Nothing moves unless water moves or a reading arrives: the tube fills
  during the pour and the probe LED blinks once a second.
- Words use the app's glossary: Timer, Rules, Farm Hand, Best case; pour, not drink.
  The "not live data" note is said once per section.

## Branch isolation

`Presentation` was created from `UI-Design-Work` at `efc85d8`. All existing project
files are inherited. Presentation-specific changes live under `presentation/`, so
dashboard development can continue independently on `UI-Design-Work`.
