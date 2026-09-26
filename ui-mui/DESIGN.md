# Farm Hand UI (ui-mui): design decisions

## Round 3: PLAN.md section 5e, three pages and two boxes (wins over 5d and round 1 where they differ)

5e says what goes on which page; 5d still sets the look (type, radii, motion, the human-made rules). The model is `ui/sim.js` in its 5e two-box mode (box B is a second simulated box watered only by the chip's timer).

### Pages and nav
- Three pages share one header and a 3-tab nav: **Live box** (`#/`), **Control** (`#/control`), **Simulation** (`#/sim`). The routes are hash routes, so the static build works from any folder.
- The current page is marked with a 2px **ink** underline and `aria-current="page"`. Not blue, because blue means AI.
- The sim keeps running whichever page is open.

### Live box: box A only, nothing estimated
- **Kept:** the drawing, Tier 1, the pump state, the ticking last reading, the call + Laya line, target + Go, Test pour / Stop pump, the scenario buttons and the tabs.
  - Every box-A visual now keys off `board.activePot === 'A'`. In two-box mode `board.pumping` is also true for box B's timer pours.
- **Moved off** (5e): the money graph with the virtual-timer line and cups saved. The dries-out line went too, because it is a trend estimate. The Details tab lost its timer and drying-rate rows, and the Pours tab shows box A's pours only.
- **ml on the stream** no longer says "est.". 5e counts pump seconds x the pump's calibrated flow as measured on the Control page, and this page uses the same number.
  - This reverses the round-2 "est." label. The flow is calibrated, not metered.
- **Weather card** (under the drawing):
  - Open-Meteo is fetched from the browser with the `feeds.py` query: FIU 25.7566, -80.3740, 24 h of precipitation_probability, precipitation and temperature_2m, America/New_York. It refreshes every 15 min.
  - Status reads "Open-Meteo, live", or "Forecast offline" if the fetch fails. It's display only.
  - It shows air now, rain over 24 h and the highest chance. The 24 rain-chance bars are neutral ink with opacity from the chance, with no track behind them (taste-skill 9.F), and a tick every 6 h.
  - The body line, at 14px: "This box is indoors, so rain can't reach it. Farm Hand won't hold off for rain here."
- **Baseline slider**, "Keep the soil at least at __%":
  - Range 20 to wet - 15 (55), step 1, labeled at the two ends, with the value beside it in tabular numbers.
  - On release it calls `fh.setBaseline(pct)` and shows the answer: "Keeping it at 45%. Each drink aims for 65%."
  - The baseline is drawn as a 1px muted tick on the moisture band, and as a solid muted line with a "keeping at least 45%" chip in the drawing. The target stays dashed ink, so the two lines can't be confused (reviewer note).

### Control: box A vs box B
- The two panels are symmetric (same `tier1` size), with a 3px accent top border: blue for Farm Hand, orange for the timer. Box B's name uses `timer.text` (#a84a12) for contrast.
- Each shows % and °C, its rule ("Holding at least 45%" / "Every 6 h, 5 s, no matter what"), water used and drinks from its own pours, the pump status, and a "Pour a cup into box A/B" button for the judge moment.
  - **Box B has no temperature number.** The hardware notes give box B a soil probe only, so it reads "No temp probe on box B. Same room as box A." instead of repeating A's number as B's.
- **The headline is computed, never typed** (5e): the water ratio with one decimal at h2, then each box's time in the band, box A's time under the baseline, and box B's time above the wet limit. The caption gives the run length in simulated time.
  - With the default timer, box B slowly dries out below the band in the sim. The sentence says whatever the numbers say.
  - The headline sits between the boxes and the chart rather than at the bottom as in 5e's sketch, so it stays above the fold at 1080.
- **One chart:** A blue, B orange, the baseline dashed, the wet limit shaded, a dot for every pour on its own box's line, and a window toggle (default All).
- No estimates and no virtual timer on this page. Every number is simulated like the rest of the app, and the "Simulated board" chip stays in the header.
- The hand-pour and fault alerts overlay the headline card, which fades underneath and goes `inert`.

### Simulation
- The title "Outside, it waits for the rain", with the honesty line directly under it and again inside the replay card (reviewer note).
- **Part 1, the season replay:** `laptop/static/sim_data.json` isn't generated (it needs the Laya model), so the page shows an empty state that says so and names the script.
  - Under it, the expected totals from `laya/data/eval.md`, marked "from the team's 2026-09-23 run, not recomputed here": timer 3,316.8 mm, 3,545,691 gal/acre, 12 stress hours; Laya 1,452.8 mm, 1,553,052 gal/acre, 0; "56.2% less water, 1,992,639 gallons per acre saved". Thousands separators, tabular numbers.
- **Part 2, crops at a moisture level:** built from FAO-56 Table 22 (p per crop), with stress line = 20 + 45 × (1 − p) on our scale.
  - The baseline slider is the same control as on the live page and moves box A's baseline too.
  - One row per crop, sorted by stress line so healthy and stressed split at one boundary. Each row has a 2px ink tick at its stress line on a 20-65% bar, with the 1px baseline through every row.
  - Pills: **healthy** in #1b7a43 with CheckCircle; **stressed** in ink with Block, not red. Many stressed rows would break the one-red rule.
  - A computed summary line; strawberries (56%) sit above the highest baseline this box allows (55%).
  - FAO-56 is linked and cited on the page. A caption says there are no per-crop water numbers until Kc (Table 12) is cited.

### Round 3 review (detail agent), all ten applied
1. **Control headline.** It always names the reference box ("Box B used 3.3x the water of box A"). Under 24 h of data it starts with "So far:" and the caption says "Early: only 14 h of data". When neither box broke a limit, it says so once ("Both stayed in the healthy band the whole time.").
2. **Stale call.** When the soil has moved more than 2 points since the call, the live page shows a past-tense summary ("At 11:00 AM (soil 48.8%), Gemini team waited...") instead of the brain's present-tense sentence. The word-for-word sentence is at the top of the Agent team tab.
3. **Target stepper.** It follows the last run's target, so the stepper, the drawing chip and the receipt agree.
4. **Baseline chip.** It sits in the same left column as the target and waterline chips, and is hidden when it would crowd them. The band tick still shows the baseline.
5. **Phone tabs.** They scroll instead of wrapping; "Agent team" becomes "Team" on a phone.
6. **Slider end labels.** They sit inside the rail's inset.
7. **Crops layout.** A 240px label column, the bar capped at 640px, and the 20-65% scale shown once above the rows.
8. **Big numbers.** `readout` / `readoutXL` (32/40 px) now use Bricolage 700 with tnum like `tier1`, so no big number shows Atkinson's slashed zero.
9. **Weather strip.** 36px tall, 12px below the numbers, bar opacity 0.35 + 0.65 x chance.
10. **Control legend.** The pour entry says just "Pour".

### 5d / round-2 decisions that 5e overrode
- The live page's money graph, "If a timer watered (est.)" line and cups saved (est.) moved to Control as a real second box, with no estimate.
- The dries-out line, which tied temperature to a decision (5d), was removed from the live page as an estimate. Temperature still shows in Tier 1, and the weather card adds air temperature.
- The 5d "est." on the stream's ml counter was dropped (see above).
- The six-number count on the live page is now: moisture, temperature, pump seconds, target, the baseline value, plus the weather card's three outside numbers. The weather card is a separate panel of outside data that 5e asks for on this page.
- "A whole field" (5d moment 4, 5e: move to /sim) is out of scope.

### Checked (round 3)
- 3 pages x 1920x1080 / 1440x900 / 390 px, plus 1440 with `prefers-reduced-motion`, in scenarios: live pour, live target run, control after 14.5 h, sim at 45%.
- 0 console errors, no horizontal scroll, smallest text 12px, no em or en dashes in page text, no "est."/"estimat" text on any page, and at most one red element on screen (Stop pump while pump A runs, or the fault alert).

### Left open (round 3)
- Season replay timelapse: needs `sim_data.json` from `season_replay.py` with the Laya model.
- Per-crop water use: needs Kc from FAO-56 Table 12, cited.
- "A whole field" view, phone alerts, the Ask chat, and the "Right now, if our box sat in a field" call (it needs the real server and Laya).
- The baseline is not persisted across reloads. The server version saves to `baseline.json`; the sim resets on reload.


## Round 2: PLAN.md section 5d (round 3 above wins where they differ)

Section 5d was written for `farm-hand/laptop/static/index.html`; this is the simulator version of it. Skills read in full and cited below: taste-skill (`design-skills/taste-skill/SKILL.md`), impeccable craft floor (`design-skills/impeccable/reference/craft-floor.md`), emil-design-eng (`design-skills/emil-kowalski/skills/emil-design-eng/SKILL.md`), Owl-Listener critique-information-density.

**Design read (taste-skill 0.B):** a working instrument for hackathon judges standing 2-3 m from a projector in a bright hall. Light theme, high contrast, big numbers, restrained motion. Dials: DESIGN_VARIANCE 5, MOTION_INTENSITY 5, VISUAL_DENSITY 5 (from 5d step 1).

### Hierarchy (5d "what data to show, ranked by size")
- **Tier 1 (right column, top):** soil moisture % with the healthy band, and soil temperature °C. They are the same size and the biggest type on the page: `tier1` = clamp(3.5rem, 5vw, 6rem), which is 96 px at 1920, 72 px at 1440 and 56 px on a phone. Next to them is the pump state: "Watering 14 s" counting down, "Hitting 55%", "Locked at 54.2%", "Soaking in" or "Holding off". Under it: "Last reading 0.8 s ago, simulated board".
  - The age and the countdown use **simulated time**: sim seconds since the reading, plus the fraction of the next sim second (`useFarmHand().frac()`). That keeps them honest at every speed setting.
- **Tier 2:** the latest brain call as one sentence, then "Laya: pick, 87% sure, 13.9 ms (simulated)". While the team works it shows "Gemini team thinking, 32 s (simulated)" and counts, never a bare spinner (5d step 6, Owl-Listener doherty-threshold). Target runs are left out of "the call" because a person started them; they appear in the pump state and the receipt instead.
- **Tier 3:** the chart (blue measured, orange dashed "If a timer watered (est.)") full width under the drawing, plus cups saved "(est.)". The dries-out line uses the temperature, so the temperature earns its place: "At 30.6 °C this soil dries to 35% in about 12.1 h (trend estimate)."
- **Tier 4, the Details tab:** water in the last 24 h, learned soak rate, time in the healthy band, drying rate, rain, county drought.
- **The six-number rule** (5d, Owl-Listener critique-information-density / Miller's law). We count standalone readouts: moisture, temperature, pump seconds or %, the target stepper, cups, dries-out hours. The last-reading age and Laya's confidence and time are inline text that 5d itself asks for.

### Layout
- 5d diagram, projector first:
  - left: the drawing (capped at 50vh so the chart fits above the fold at 1080) with the chart under it
  - right: one panel split by dividers (taste-skill 4.4: cards only when elevation means something) holding Tier 1, the call, target + Go, Test pour / Stop pump, then cups saved and dries-out
  - below: tabs across the full width (Agent team, Pours, Serial, Details)
- The Brain picker moved into the Agent team tab, to keep the right column on one screen at 1440x900.
- Phone order: drawing, right column, chart, tabs. The tabs scroll sideways.

### The drawing acts out the data (5d "make the box act out the data")
Every effect comes from a reading or the pump state. Modeled parts are labeled.
| Data | Effect |
|---|---|
| probe % | soil color (as before) and a **waterline** at the % of the soil's height, labeled "waterline, modeled from one probe"; the old wet-band gradient is gone |
| pump on | stream flow, drops, pump buzz (the one authored moment) and a **"+122 ml est."** counter riding the stream (pump seconds x 20 ml/s) |
| DS18B20 °C | probe tip colored between two stops: #3d7fc4 at 20 °C and #e07a2e at 34 °C, interpolated |
| each reading | the probe LED flashes and fades over 700 ms (heartbeat) |
| Hit the Target | a dashed ink target line labeled "target 55%" that the waterline climbs to meet |
- Removed because it wasn't data: the ESP32 LED blink (ambient motion), the wet-band gradient.
- Labels over the soil or wires sit on white 90% chips.

### Alerts and red (5d, von Restorff)
- The hand-pour (info, AI blue) and "Water isn't reaching the soil" (error) alerts slide in **over the call section of the right column**: 10 px + opacity, 250 ms. They never push the layout and are never a modal (impeccable: "a modal for a task that needs neither interruption nor protected focus").
  - **Pushback on 5d:** 5d says "over the top of the right column". There the alert covered the Tier 1 numbers, so it sits one section lower, over the call it stands in for.
- **One red thing at a time**, checked by a script on every scenario screenshot:
  - The fault alert is red.
  - Stop pump turns red only while the pump runs and only when no red alert is up.
  - Guard failures, refusals and missed pours in the tabs are ink + bold + the Block icon instead of red.
  - The drawing's clamp, relay LED and dry LED are no longer red.

### Craft floor (5d steps 2-5)
- **Radius scale** (taste-skill 4.4, shape consistency lock): 6 px for controls, 12 px for panels and alerts, 999 px for chips only. They are the `RADIUS` tokens in `theme.js`; dots are circles.
- **Removed:** eyebrows (impeccable: a ban), halos and glows. The status-dot ring was a zero-offset halo (impeccable depth rule; taste-skill 9.A). The alert's shadow now has an offset and a blur tinted to the ink.
- **Not used:** glass, backdrop blur, gradients on text or buttons.
- **Browser surfaces** (impeccable): `::selection`, caret color and thin scrollbars from the palette; focus rings of 2 px AI blue, offset 2.
- **Numbers:** tabular numerals on the body, the canvas and every changing number. Measured values show one decimal (taste-skill 9.D: real, messy numbers).
- **Copy:**
  - No em dashes, and no en dashes as separators (taste-skill 9.F, 9.G). Ranges read "35-70%" and empty values "-".
  - At most one "·" per line; the phone key and the target receipt are sentences.
  - No arrow or unicode glyphs (the pours table says "53.4 to 54.1").
  - Buttons name their action, one label per intent (taste-skill 4.5).
- **Icons:** one set, `@mui/icons-material`, at a single weight. No emoji.

### Motion (emil-design-eng)
- Easing `cubic-bezier(0.23, 1, 0.32, 1)` everywhere (`theme.ease`); never `ease-in`, never `transition: all`, nothing grows from `scale(0)`.
- Durations: button press 120 ms at scale(0.97), with the ripple off (Emil: buttons must feel responsive to press). Chart tooltip fade 150 ms. Alerts and panels 250 ms. Numbers roll to their new value in 250 ms (`Roll.jsx`, rAF, writes to the DOM without re-rendering React).
- Only the pour loops: the tube dash flows at 450 ms and the drops fall at 550 ms, while the pump runs. The waterline, puddle and soil color follow readings over 250 ms.
- **Reduced motion:** data changes stay and movement goes (Emil: "fewer and gentler, not zero").
  - no number roll
  - no alert slide, only the fade
  - no button scale
  - a solid water line in the tube, static drops, no buzz, no waterline slide
  - the LED heartbeat stays, because it is an opacity change

### Density critique (Owl-Listener critique-information-density), run on the 1920x1080 "locked" and "hand" screenshots
| Dimension | Observation | Rating | Fix applied |
|---|---|---|---|
| Cognitive load | Round 1 had about 14 numbers visible, plus Laya/Gemini timing rows. Now there are 6 readouts; secondary data is in Details. | pass | moved 6 numbers to Details, merged the Laya/team rows into one line each |
| Content priority | The heaviest type is the moisture and temperature (96 px), then the pump state (40 px). The chart and cups are medium. | pass | Tier 1 variant; the call sentence at body size |
| Scanning pattern | Labels sit left-aligned above each number; the right column reads top to bottom in the 5d order. The tabs table right-aligns numbers. | minor issue | "Last reading" wraps under the pump state at 1440; accepted |
| Progressive disclosure | The agent log, guards, pours, serial and outside data are behind tabs. The primary actions (Go, Test pour, Stop pump) are never hidden. | pass | Brain picker moved to the Agent team tab |

### Done checklist (5d), as it applies to the simulator
- [x] Moisture, temperature and pump state readable from 3 m on a projector (96 px / 40 px at 1920x1080).
- [x] "Last reading" ticks (10 renders a second, simulated time). *Real board: not applicable here.*
- [x] Every drawing effect maps to a reading; modeled parts are labeled.
- [x] Estimated numbers say "est.": the timer line, cups saved, ml on the stream.
- [x] One radius scale, no eyebrows, no glow halos, no emoji, no em dashes.
- [x] Tabular numbers on everything that changes.
- [x] One red thing at a time (script-checked in the pour, locked, fault and hand scenarios, at 3 widths).
- [x] UI transitions at 250 ms or less, ease-out, nothing from scale(0).
- [ ] The four judge moments rehearsed on the **real** box. Not possible in the simulator; moments 1-3 were exercised in the sim (target locked, pinch fault, hand pour).
- [x] The fake board says it's test data at the top ("Simulated board" chip plus the subtitle).

### Skipped because the sim can't back them honestly (open)
- "A whole field" view (judge moment 4): there is no field data; it would be an illustration with nothing live behind it.
- Phone alerts: nothing is sent from the simulator.
- The Ask chat tab: no model behind the simulator.
- The flow sensor: ml, the timer line and cups saved stay "est." until the hardware exists.

## Round 1 (kept for the record; round 2 above wins where they differ)

These decisions were agreed between the UI design lead and the detail/typography reviewer. The lead had the final call. Every value below is set in `src/theme.js`; components use theme tokens only, with no hex values of their own.

## Principles
- **It should read as a tool, not a template.** Dense where the data is, calm elsewhere. No gradients, glows or emoji. Every icon is an `@mui/icons-material` icon with a clear meaning.
- **Honesty labels are part of the product.** "Simulated board", "Every number here comes from a model", "simulated", "estimated", "Timer schedule (estimated)", "Timer is estimated", "wet band: modeled from one probe" and "DS18B20 in the soil · simulated" are all visible at every width. The pitch rules forbid showing simulated numbers as measured.
- **The model is shared.** `src/sim.js` imports `../ui/sim.js` unchanged, so `ui/` and `ui-mui/` run the same rules.

## Color: one meaning per color
| Role | Token | Value | Use |
|---|---|---|---|
| AI + moisture | `primary`, `moisture` | #1f5fbf (6.2:1) | moisture line, AI pours, the number in a pour decision, Run agents |
| Timer (estimated) | `timer.main` / `timer.text` | #d0571b lines only / #a84a12 text (5.07:1 on #fdeee6) | ghost line, timer ticks, "Timer is estimated" tag |
| Temperature | `temp` | #7a3fc0 | temp line, temp readouts |
| Healthy | `success.main` / `success.text` | #1f8a4c fills / #1b7a43 text (5.37:1) | healthy band, locked target, guard pass |
| Danger | `error` | #c62b2b | refused, blocked, Stop pump, failed pours |
| Neutral action | `ink` | #141820 | Go (target), selected toggles, Pause / Skip |
| Caution label | `warning.light` + `warning.main` border | ink on #fff4e5 (5.4:1) | "Simulated board" chip. It's a caution, not an error. |

- Orange #d0571b fails 4.5:1 as text (4.15:1), so it is used for graphics only. WCAG 1.4.11 needs 3:1 there, and it passes.
- A selected toggle is **solid ink with white text** (17.6:1). The reviewer first proposed a blue selected state; the lead rejected it because blue means AI, and these toggles also pick sim speed and chart window. The first build used ink at 8%, which was about 1.2:1 against unselected and failed WCAG 1.4.11. Unselected hover is ink at 6%.
- "Holding off" stays ink: no action is not a signal. When the AI poured more than a timer, the water-saved number is ink and never red. Early data is not an error, and the label says it in words ("Timer used less so far (AI poured more)").

## Type
All fonts are self-hosted through `@fontsource-variable` (SIL OFL 1.1), about 129 KB for the latin files.
- **Atkinson Hyperlegible Next Variable**: all UI text and all numbers, with `tabular-nums`. It was built for low-vision legibility, with distinct 1/l/I and an open 0 (Braille Institute).
- **Bricolage Grotesque Variable (opsz)**: display only (app name, decision headline, card titles).
- **Atkinson Hyperlegible Mono Variable**: code only (serial log, agent ids, guard details, `farm-hand/`).
- JetBrains Mono was dropped. Monospaced readouts looked like a terminal, and tabular figures give alignment without it (Butterick, *Practical Typography*, "Monospaced fonts").

Scale (M3 type-scale tokens, m3.material.io). Nothing is smaller than 12px.
| Variant | Font | Size/line (px) |
|---|---|---|
| h1 app name | Bricolage 700 | 24/32 |
| h2 decision | Bricolage 700 | 32/40, 28/36 under 600px |
| h3 card titles | Bricolage 600 | 20/28 |
| subtitle2 | Atkinson 600 | 14/20 |
| body1 / body2 | Atkinson 400 | 16/24, 14/20 |
| caption, overline | Atkinson 400/600 | 12/16, sentence case, no tracking |
| button | Atkinson 600 | 14/20, no uppercase |
| readout / readoutXL | Atkinson 600 tnum | 32/40, 40/48 (water saved) |
| unit | Atkinson 400, muted | 20/28 |
| data | Atkinson 600 tnum | 14/20 |
| code | Atkinson Mono 500 | 12/18 |

The "why" sentence is capped at 60ch, and the header subtitle at 70ch.

## Layout and spacing
- 8px grid (`spacing: 8`). Cards have 16px padding (24px at `lg` and up), 16px gaps, radius 8. They are `Paper variant="outlined"` at elevation 0, with no shadows.
- **Desktop (md+):** left = rig, chart + water saved, the Agent team / Pours / Serial tabs. Right, 400px = the call, Hit a target, numbers.
- **Phone:** the columns dissolve (`display: contents` + `order`) into task order: rig, the call, chart + water saved, target, numbers, tabs. The chart moved up because the handoff goal is "see the water saved in 10 s".
- Checked at 1440px and 390px with no horizontal scroll.

## Controls and states
- Only one `contained` button in each area. Run agents (48px, the AI action) is primary. Go is contained ink in its own card. Test pour is outlined, and Stop pump is outlined error and always enabled.
- Touch targets: buttons 40px (44px on `pointer: coarse`), large 48px; small toggles 32px (44px coarse); icon buttons 40px (44px coarse); the banner close button is 44px. Sources: Material 48dp, Apple HIG 44pt, WCAG 2.2 SC 2.5.8 (24px minimum).
- Focus: a 2px #1f5fbf outline with 2px offset on every focusable control (WCAG 2.4.7). Disabled controls use MUI's default 38% opacity.
- Refusals ("Refused: watered 3 min ago…") show as an inline warning `Alert` next to the button that caused them, in a live region.
- The hand-pour and failed-pour banner is a filled `Alert` (info = AI blue #1f5fbf, since detecting a hand pour is part of the AI flow; MUI default info #0288d1 was 3.86:1 with white text) with `role="status"`, in the flow above the drawing so it never covers the target readout. It does **not** auto-dismiss: it expires when the condition ends or when it is closed (NN/g heuristic #1, visibility of system status; WCAG 2.2.1). This was the lead's pushback, and the reviewer agreed.
- Placeholder values ("–") are muted grey. They turn blue only when there is a real number. While the Gemini team works, a 2px `LinearProgress` runs under its row and the row counts "s so far".
- Agent list: **working** (blue dot with a ring, plus the word) marks only what is running now: the team's current step, the soak watch, a target run. **Recent** (pale #8fb2e6 dot, no word) marks activity in the last 6 s. **Blocked** is red with the word. Earlier builds labeled finished agents "working", and the reviewer flagged that as fake activity.
- Guard report: CheckCircle / Block icons at 16px, with the reason text beside them, so a failure does not rely on color alone (WCAG 1.4.1). sim.js has no "skipped" state, so there is no third icon.
- Under temperature, the caption reads "DS18B20 in the soil · simulated". The old page overwrote "outside air" there because the sim has no outside-air value, and we won't show a number we don't have (the lead's pushback, which the reviewer agreed with).

## Rig drawing
- Same geometry as `ui/index.html` (viewBox 800×430). Hardware colors live in `theme.palette.rig`.
- Labels are Atkinson 600 at 12 units, with a stage-colored halo. The temperature and relay labels sit on white chips at 90%, so the wires pass behind them.
- The "wet band: modeled from one probe" note moved off the soil. White at 70% measured about 2.5:1 there; now it is on the table at 12 units, #4b5563.
- The steel gradient on the temperature probe became a flat fill. `wetGrad` stays because it encodes the modeled soak depth.
- **Under 600px the SVG text is hidden.** At that width the drawing is about 0.45 scale, so labels would render at about 5px. An HTML key shows the same facts at 14px and 12px.
- Motion is all keyed to `pumping`: tube dash flow 450ms, drops 550ms staggered 0/180/360ms, pump buzz 0.8px at 80ms. Soil color changes over 600ms and the wet band over 400ms, with the M3 standard easing `cubic-bezier(0.2,0,0,1)`. **Reduced motion:** a solid water line in the tube, three static drops, and the relay LED lit, so the state is readable without movement.

## Chart
- Canvas, 240px tall (200px on phone), redrawn with each sim render. The first draw waits for `document.fonts.ready`.
- Atkinson at 12px, ticks #5b6472. Gridlines only at 25/50/75%. On the temperature strip the unit appears once ("33°" / "29°C").
- Series: moisture 2px blue on top, the timer ghost 2px orange dashed [6,4], temperature 1.5px purple. The healthy band is filled at 10% green, with the label "healthy 35–70%" in success.text.
- Pours sit on their own rug between the strips: AI = filled dot, test/target = ring, timer = an 8px orange tick on the ghost line. The earlier dots on the moisture axis read as data near 25%.
- The tooltip is ink with two columns (label left, value right), uses swatch colors that pass on ink, says "timer, est.", and flips left at the edge.
- On a phone the time axis has 3 ticks instead of 5, because the labels collided.

## Sources
WCAG 2.2: SC 1.4.1, 1.4.3, 1.4.11, 2.2.1, 2.4.7, 2.5.8 (w3.org/TR/WCAG22). Material Design 3: type scale, color roles, motion easing, 48dp targets (m3.material.io). Apple Human Interface Guidelines: 44pt hit targets. Nielsen Norman Group, 10 usability heuristics (#1 visibility of system status, #4 consistency, #5 error prevention). Braille Institute, Atkinson Hyperlegible. Matthew Butterick, *Practical Typography*.

## Left open
- The side column's height still depends on the call text length. The whole page scrolls; the cards themselves never scroll.
- The banner appearing pushes the rig down (layout shift). We chose this over covering the target readout.
- A dark theme is not built. The tokens are ready for one, but the rig illustration colors would need a second pass.
- The bundle is about 490 KB (154 KB gzip), mostly MUI + icons. Code-splitting was not needed for a local demo.
