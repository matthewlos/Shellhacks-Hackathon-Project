# Farm Hand presentation

A standalone, four-section presentation: **Problem → Solution → Visualization → Data**.
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
- In Visualization, play the cycle or use the numbered steps. It stops at the end,
  and can be replayed. It pauses when the section or browser tab is not visible.
- Expand “Source & full comparison” for all four evaluation policies.
- Browser print produces a static four-section handout.

## Content and evidence

- The narrative follows `pitch/story_final.md` without repeating dated drought statistics.
- The hardware check (44% → 52% after a 10-second pour) is recorded in the repository's
  `README.md` and `pitch/DESIGN-HANDOFF.md`. It is separate from the animation.
- The diagram uses illustrative moisture readings (32% → 48%); it is not a live
  dashboard and does not control any pump or call a backend.
- Results come from `farm-hand/laya/data/eval.md`, copied verbatim to
  `assets/evaluation.md` so the source is available offline. The chart shows exact
  irrigation totals. 56.2% is the evaluation's reported rounded reduction.
- The replay models a sandy-soil field using real Miami weather. It is not measured
  field savings. The model's 94.1% held-out accuracy and 85.8% balanced accuracy are
  decision-label agreement, not crop survival or farm yield.
- The animation and all illustrations are original SVG/CSS. Public Sans is bundled
  under its SIL Open Font License in `assets/FONT-LICENSE.txt`.

## Branch isolation

`Presentation` was created from `UI-Design-Work` at `efc85d8`. All existing project
files are inherited. Presentation-specific changes live under `presentation/`, so
dashboard development can continue independently on `UI-Design-Work`.
