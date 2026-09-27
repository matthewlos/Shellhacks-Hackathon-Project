# Farm Hand

Soil-moisture irrigation for drought, built for ShellHacks 2026.

An ESP32 reads soil moisture and soil temperature in two boxes of soil. **Box A** is watered by a small fine-tuned decision model (Laya), with a simple baseline rule as the fallback. **Box B** is watered on a fixed timer and serves as the control. A home server logs every reading and decision. A web dashboard shows both boxes live in 3D, along with the water used by each box.

Live site: https://farmhand.dmchang.xyz/

## How it fits together

```
ESP32  (farm-hand/firmware/sensors_live)
  │  POST a reading every 2 s over WiFi (header X-Farmhand-Token)
  ▼
Home server  (farm-hand/cloud/receiver.py, port 8120)
  │  stores readings + decisions in SQLite, runs the decision model,
  │  serves the REST API + SSE stream under /farmhand/api, serves the built web app
  │  reply to the ESP32 = the decision for box A + any queued pump commands
  ▼
Web app  (farm-hand/web)
```

The ESP32 always makes the call to the server, because both ends sit behind routers. The server's decision and any pump commands come back in the reply. The chip applies its own safety rules to every pump request (`firmware/sensors_live/lib/comp_pump/comp_pump.h`):
- at most 8 s per drink, with 5 minutes between drinks
- a 75 s daily cap
- no watering at 70% moisture or above
- no watering while a probe is disconnected
- if the server has been silent for 2 minutes, the chip holds a 45% floor on its own

## Repository layout

| Path | What it is |
|---|---|
| `farm-hand/firmware/sensors_live/` | **Current ESP32 firmware** (PlatformIO, Arduino): soil probes, DS18B20 temperature probes, relays/pumps, WiFi upload, serial commands |
| `farm-hand/firmware/*` (others) | Bring-up and test sketches (relay click test, temperature test, OLED, the original `farm_hand.ino`) |
| `farm-hand/cloud/` | **Home server** (`receiver.py`, Python standard library only; `laya` and `torch` are needed only for the model) and the auto-deploy script |
| `farm-hand/web/` | **Dashboard**: Vite + React + TypeScript + three.js + zustand. Forked from Prompt Grass Grow Grass (MIT, see `LICENSE-PromptGrassGrowGrass`) |
| `farm-hand/laya/` | Decision model: dataset builder, fine-tuning, evaluation, season replay, standalone decider API (`serve_decider.py`) |
| `farm-hand/alphaearth/` | Builds the Miami-Dade farm-field map (crop type per field, SSURGO soil) from Google AlphaEarth satellite embeddings |
| `farm-hand/tools/` | Pump control page, USB bridge, local offline site, wiring-page builders, probes and one-off scripts |
| `farm-hand/laptop/` | Earlier laptop-based version (USB serial, Gemini agent team, rule brain, its own dashboard). Superseded by `cloud/` + `web/` |
| `farm-hand/blender/` | Blender scripts for the 3D model of the boxes (`web/public/models/farmhand.glb`) |
| `farm-hand/docs/`, `wiring/pages/` | Step-by-step wiring and assembly pages (open `index.html` in a browser) |
| `ui/`, `ui-mui/` | Earlier browser-only simulators of the rig (plain JS, and React + MUI). Not used or deployed |
| `wokwi/` | Wokwi browser simulation of the wiring |
| `design/`, `farm-hand/design/`, `farm-hand/brand/`, `design-skills/` | Design frames, dashboard screenshots, logo, vendored design skills |
| `pitch/`, `research/`, `farm-hand/pitch/` | Pitch story, sources, Florida drought research, sponsor research |
| `gridlock/`, `opening-ceremony/`, `POCKET.md` | Other ShellHacks prep, unrelated to Farm Hand |

## Hardware

- ESP32 dev board (esp32dev), 2 capacitive soil-moisture probes, 2 DS18B20 temperature probes, 2 relays (each driven through a PN2222), 2 mini pumps, and a separate 5 V power module (its GND is tied to the ESP32's GND)
- Pins on the soldered board (`firmware/sensors_live/lib/sys_pinout/sys_pinout.h`):

| | Box A (decision model) | Box B (timer) |
|---|---|---|
| Soil probe AOUT | D34 | D35 |
| DS18B20 data | D4 | D21 |
| Relay / pump | D22 | D13 |

- Soil probes must be on ADC1 pins, because the ADC2 pins stop working while WiFi is on.
- Nothing may hold D2 high at boot, or flashing fails.
- The server matches temperature probes to boxes by data pin (`TEMP_PIN` in `receiver.py`).

## Running it

### Firmware

```sh
cd farm-hand/firmware/sensors_live
cp include/secrets.example.h include/secrets.h   # WiFi (plain or enterprise), server URL, FARMHAND_TOKEN
pio run -t upload
pio device monitor                               # one JSON line per second
```

`PUMP_ARMED` in `comp_pump.h` is `0`, so the server's watering decisions are logged but not acted on. Manual and demo commands arrive over serial or in the server reply: `pump A <s>`, `pump B <s>`, `stop`, and several separated by `;`. These always run, capped at `PUMP_TEST_MAX_S` (600 s).

### Server

```sh
cd farm-hand/cloud
FARMHAND_TOKEN=<same token as secrets.h> python receiver.py    # http://127.0.0.1:8120
```

| Env var | Default | Purpose |
|---|---|---|
| `FARMHAND_TOKEN` | *(none)* | Shared secret. Required for `/reading`, `/api/pump` and `/api/demo` |
| `FARMHAND_PORT` | `8120` | Listen port |
| `FARMHAND_BASELINE` / `FARMHAND_TARGET` | `45` / `60` | Box A floor, and the moisture % a drink aims for |
| `LAYA_DIR` | `cloud/model/farmhand-laya` | Model weights. If missing or failing to load, the server uses the baseline rule |
| `SITE_DIR` | `~/farmhand-site/current` | Built web app (`farm-hand/web/dist`) served at `/`. `/farmhand/` serves a minimal built-in status page |
| `FARMHAND_DB`, `FARMHAND_CONFIG`, `FARMHAND_REGION` | files next to `receiver.py` | SQLite DB, plot config, AlphaEarth region data |
| `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`) | *(none)* | Spoken status for `POST /api/speak` |
| `DEMO_ML_PER_S` | `1.03` | Pump flow used for the demo's water totals |

Main endpoints, all under `/farmhand`:

| Endpoint | Purpose |
|---|---|
| `POST /reading` | Where the ESP32 posts readings |
| `GET /data` | Latest reading and decision as JSON |
| `GET /api/events` | SSE stream |
| `GET /api/decision` | Latest decision for box A |
| `GET /api/zones/{A,B}/history?hours=` | Reading history for a box |
| `GET /api/forecast`, `GET /api/region`, `GET /api/soil-now` | Forecast, AlphaEarth region data, current soil across the map |
| `POST /api/pump {"cmd":"pump A 5"}` | Queue a pump command (requires the token) |
| `POST /api/demo {"action":"start","timer_s":30,"seconds":300}` | 5-minute live demo: box A holds 45–55% by pulse-and-soak, while box B's timer pours every 2 min. Requires the token. `GET` returns its status |

### Web app

```sh
cd farm-hand/web
npm install
VITE_BACKEND=https://farmhand.dmchang.xyz/farmhand npm run dev   # or point at http://127.0.0.1:8120/farmhand
npm run build                                                     # typecheck + build into dist/
```

`VITE_BACKEND` defaults to `/farmhand` (same origin). Add `?debug` to the URL to expose the store as `window.soil.app`.

### Offline / demo tools

- `farm-hand/tools/local_site.sh` runs the whole stack on one laptop with no internet. It builds the web app, starts `receiver.py` against a local database, and feeds it from the ESP32 over USB. Open http://127.0.0.1:8120/.
- `python farm-hand/tools/usb_bridge.py` forwards the ESP32's 1-second USB readings to the server.
- `python farm-hand/tools/pump_control.py` opens an on/off pump page at http://127.0.0.1:8130. It sends commands over USB if the bridge is running, and over WiFi through the server otherwise.

## Deployment

The server runs on a Mac mini under launchd, exposed through a Cloudflare tunnel (`farmhand.dmchang.xyz` → `localhost:8120`). `cloud/deploy.sh` runs every 60 s: it pulls the repo, runs `npm ci && npm run build` in `APP_DIR`, and swaps in `dist/`. A failed build leaves the old site up. `cloud/deploy.conf` sets the branch (`main`) and app folder (`farm-hand/web`); the build is served at the site root. See `farm-hand/cloud/README.md` for details.

## Decision model

Laya is a fine-tuned classifier that picks an action (`water`, `wait_moist`, …) from a structured state: soil moisture mapped onto its training scale, air temperature, hour, month, rain forecast and evapotranspiration. It was trained on an NVIDIA RTX 4070 (`laya/train.py`). The weights (about 615 MB) are not in git; they live in a private Hugging Face repo. Indoors, rain inputs are forced to zero, and the server never lets the model water above baseline + 5%.

## Large files

Videos, full-size design frames and test captures are in the [`prep-media` release](https://github.com/matthewlos/Shellhacks-Hackathon-Project/releases/tag/prep-media) (`videos-and-audio.zip`, `design-frames.zip`, `test-captures.zip`). Unzip them at the repo root and each file lands back in its folder.

## Project docs

- `PLAN.md`: build plan, wiring history, demo script, judge Q&A, sponsor tracks, risks. Sections 5e–5g are the most recent.
- `farm-hand/PLAN.md`: plan with a code appendix. `WORK_HISTORY.md`: how `ui/` was built.
- `pitch/story_final.md`: the pitch, plus the rules for what may be claimed on stage.

## Licenses

`farm-hand/web` is derived from Prompt Grass Grow Grass (MIT, `farm-hand/web/LICENSE-PromptGrassGrowGrass`). Third-party notices are in `farm-hand/laptop/static/THIRD_PARTY_NOTICES.md` and `ui-mui/THIRD_PARTY_NOTICES.md`. Vendored design skills keep their own licenses under `design-skills/`.
