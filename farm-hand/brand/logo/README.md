# FarmHand logo concepts

Three hand-built marks in the house palette (`farm-hand/web/src/brand.ts`) with an outlined Archivo wordmark (wght 700, wdth 86, same as the dashboard headings), so no font is needed to render them. Compare them all in `contact-sheet.png`.

- **Taproot** (`taproot/`): a sprout whose root is the soil probe. Green leaves above the ground line, the blue sensor blade below it. In the lockup the ground line sits on the wordmark baseline and the probe hangs below it.
- **Needle** (`needle/`): a moisture dial set into the ground, going dry (warm) to good (green) to wet (blue). The needle is a leaf resting in the good band.
- **Fork** (`fork/`): an F/H ligature drawn as the two-prong soil probe, with a water drop held between the prongs.

**Recommendation: Taproot.** It tells the product in one picture: the plant above the soil and the sensor reading it below. The blue for water and green for "good" already mean those things in the dashboard, and it still reads as a sprout on a line at 16 px. Fork is the runner-up. It's the most ownable shape and the crispest favicon, but it looks like letters first and like farming second. Needle breaks down at 16 px (four colors in 16 pixels) and looks too much like a speedometer.

## Files (per concept folder)

| File | Use |
|---|---|
| `symbol.svg` / `symbol-dark.svg` | Mark only, transparent, for light / dark backgrounds |
| `lockup.svg` / `lockup-dark.svg` | Mark + "FarmHand", outlined |
| `favicon.svg` | Heavier cut for small sizes, on a rounded ink tile |
| `favicon-16.png`, `favicon-32.png`, `favicon-180.png` | Tab icons and apple-touch-icon |
| `devpost-cover-1200x800.png` | Devpost cover with the tagline |

## Rebuild

`_build/` holds the generator. `build.py` writes the SVGs and outlines the wordmark from the web app's Archivo woff2 (it needs `pip install fonttools brotli uharfbuzz`). `render.cjs` makes the PNGs with headless Chromium (`NODE_PATH` must point at `playwright-core`, and `CHROME` at a Chromium binary).
