# GridLock (Sperry Tech, ShellHacks 2026) — spec notes

Condensed from the challenge doc Dechante pasted on 2026-09-25.

## The job
Ingest public future-construction plans from at least 2 neighboring utilities and flag where their planned transmission projects overlap.

Example pair: Dominion Energy South Carolina (DESC) and Georgia Power (GPC), across the Savannah River.
Known real overlaps they confirmed:
- Savannah area: DESC Jasper, Okatie, Bluffton vs GPC Plant McIntosh expansion
- Augusta area: DESC Urquhart vs GPC Thomson–Vogtle transmission line
- DESC also owns a hydro plant in Martinez, GA (near Augusta)

## Overlap rules
Geographic (primary): flag if the CLOSEST points of two projects are within 40 km (edge to edge, not centers).
Rank by distance:
- touching / crossing: must coordinate (outage timing, crossing structures)
- under 1.6 km: share land (right-of-way, access roads, permits)
- under 8 km: share site logistics (laydown yards, deliveries)
- under 40 km: share crews and equipment
Timeline (strong secondary): scheduled in the same build window. Use together with geographic.

Expect most pairs NOT to overlap.

## Data
- DESC: SCRTP project lists (DESC is moving to SERTP; check for a newer SERTP list)
- GPC: 10-Year Transmission Plan, inside the Georgia Power IRP (Georgia PSC)
- DESC IRP: 15-year plan, SC PSC
- Optional backdrop: HIFLD public transmission lines + substations (straight-line approximations)
- NO CEII data. Public filings only.
- Sperry's PDF link in the doc is a placeholder (www.OneDriveLinkHere.com). Get the real one from Sperry.
- Doc also references "ShellHakcs_finding_real_locations" (not provided yet).

## Must deliver
- Required: interactive UI (pan/zoom/click map) with both utilities' projects and overlaps highlighted
- Required: ranked list of top coordination opportunities
- Bonus: rough cost/impact estimate for at least one flagged opportunity

## Prizes
1st: guaranteed internship + laptop · 2nd: internship interview + laptop · 3rd: internship interview

## Context
FERC Order No. 1920 (2024) pushes coordinated long-term regional transmission planning.
