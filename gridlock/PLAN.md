# GridLock: the build plan (Sperry Tech challenge, ShellHacks 2026)

Spec: `SPEC.md`. Past-winner research: `treehacks_winners.md`, HackMIT data in `Documents\code\hackmit-winner-repos\` and `yt-transcribe\plume_gallery.json`.

## What past winners teach us (and where each lesson lives in the build)
| Winner | What it did | What we take |
|---|---|---|
| Wattson (HackMIT 2026, Arrowstreet sponsor prize) | Checked data-center clean-energy claims against federal grid data; hand-checked which grid each site is on | Every project cites its source filing; every map pin says how it was placed (real substation vs town-level guess) |
| Scutaris (HackMIT 2026, SpaceX AI sponsor prize) | Found satellites getting close in space and time, ranked the risks, wrote briefings | The overlap engine: closest-point distance + time window, ranked list, one-click briefing per pair |
| PriorityQueue (TreeHacks 2025, Elastic prize) | Mapped grid interconnection projects and grouped nearby ones into cost-sharing clusters | The map + the "share the cost" framing for Sperry's bonus estimate. Next: coordination zones (clusters) |
| EvidenceAtlas (HackMIT 2026) | Joined 5 public sources in plain Python + vanilla JS, no build step | Same stack: Python pipeline, one HTML file, nothing to install to demo |
| Griddy (HackMIT 2025, Sustainability) | ESP32 running a mini LED power grid | Optional last-hours add-on: tabletop board that lights up the top overlap zones |

Pattern from the vault's winner research: winners turn real data into a clear action; sponsor-challenge winners nail exactly what the sponsor asked for with real public data.

## Built (2026-09-25)
Pipeline, all public data, no CEII:
1. `parse_desc.py`: DESC "Planned Transmission Projects $2M and above, 2026-2030" (scrtp.com) -> 54 projects with ID, description, need, in-service date, filed cost.
2. `parse_sertp.py`: SERTP 2025 Regional Transmission Plan, Southern BA section (pages 61-170) -> 326 projects with in-service year, description, need. (Southern BA also covers Alabama/Mississippi; only Georgia-side placements are kept.)
3. `fetch_osm.py`: 2,053 named substations/plants in SC + GA from OpenStreetMap.
4. `geocode.py`: matches endpoint names to substations; town-level fallback (Nominatim) for new substations, labeled approx; drops town guesses that would stretch a line past 60 km. Result: 45/54 DESC and 242/326 Southern placed.
5. `overlap.py`: every DESC x GPC pair, closest-point distance in meters (EPSG:5070), Sperry's 4 tiers, same-window = in-service within 1 year, confidence from placement precision. Result: 67 pairs under 40 km (4 under 1.6 km, 7 under 8 km), 26 in the same build window.
6. `build_app.py` + `app_template.html` -> `app/index.html`: Leaflet map of both utilities, overlap links by tier, ranked list with filters, detail panel with sources, adjustable savings estimate.

Run: `.venv\Scripts\python build_app.py` then `python -m http.server 8710 -d app` -> http://127.0.0.1:8710

## Top findings (match the two areas Sperry confirmed)
- Savannah: DESC Okatie - McIntosh 115 kV tie ($5,376,418, 2028) is 0.69 km from Georgia Power's McIntosh 230 kV relay upgrades and Goshen - McIntosh 115 kV rebuild, all 2028.
- Augusta: DESC Urquhart - Toolebeck 115 kV rebuild ($15,948,620, 2026) is 6.6 km from Georgia Power's Fenwick Street - Sand Bar Ferry 115 kV rebuild, both 2026.

## Known gaps (say these out loud in the demo)
- Town-level placements (labeled approx) can be off by several km. Confidence tag on every pair.
- Lines are straight segments between endpoints (same limitation Sperry notes for HIFLD).
- Georgia Power's Thomson - Vogtle line is not in the SERTP list; it's in the Georgia Power IRP (not pulled yet).
- SERTP list has no costs, so savings use Dominion's filed cost only; the savings % is an adjustable assumption.
- 9 DESC and 84 Southern projects unplaced; listed in the app with the reason.

## Next (in order)
1. Coordination zones: cluster overlapping pairs into zones (Savannah, Augusta, ...) so the ranked list reads as 5-10 opportunities, not 67 pairs (PriorityQueue lesson).
2. Briefing per zone: one plain paragraph a planner could forward (Scutaris lesson). Gemini can write it from the rows; numbers come only from the data.
3. Pull the Georgia Power IRP transmission section for Thomson - Vogtle and anything else missing.
4. Hand-check the top 10 placements against the filings' own descriptions (Wattson lesson).
5. Optional: ESP32 + LEDs tabletop map lighting the top zones (Griddy lesson), only if 1-4 are done.
