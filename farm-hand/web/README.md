# Farm Hand web app

The Farm Hand dashboard: two storage-tote boxes of soil, live. Box A is watered by Laya (a small fine-tuned model on the Mac mini, with a baseline-rule fallback: keep soil at 45% or more). Box B is the control, watered on a fixed timer.

Based on the [Prompt Grass Grow Grass](LICENSE-PromptGrassGrowGrass) web app (MIT; upstream commit in `UPSTREAM_COMMIT`). Vite, React, TypeScript, raw three.js, zustand.

## Pages

- **Live**: the two boxes in 3D; per box soil moisture, soil temperature, raw count, probe and pump status; Laya's call for box A; moisture over time (A vs B, drag to replay); rain forecast.
- **Crops** (`#crops`): the 26-crop rules engine per box, one focal crop with its reasons on demand; planting window and frost dates (estimates).
- **Miami-Dade** (`#region`): fields around the boxes, predicted from satellite (AlphaEarth v2), with soil, a moisture baseline and similar fields per field.

It shows real data only. Without the server it says it is waiting for the Mac mini.

## Run

```sh
npm install
VITE_BACKEND=https://farmhand.dmchang.xyz/farmhand npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload. |
| `npm run build` | Typecheck, then a production build into `dist/`. |
| `npm run typecheck` | `tsc --noEmit`. |

`VITE_BACKEND` defaults to `/farmhand` (same origin, as deployed on the Mac mini, which rebuilds from `main` every minute). `?debug` exposes the store as `window.soil.app`.

## Where things live

- `src/brand.ts`: name, copy, colors, fonts, the box names, the 45% baseline, and `pumpsArmed`.
- `src/ui/`: the pages (`Boxes`, `LayaCall`, `History`, `Forecast`, `Crops`, `Region`, `TopBar`).
- `src/data/`: the store and the server connection. `src/scene/`: the 3D boxes.
