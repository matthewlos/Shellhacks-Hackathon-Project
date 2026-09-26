## 2. Wiring (the real build, proven 2026-09-23)

Step-by-step pictures of every wire: **http://127.0.0.1:8097/assemble** (start `tools/power_page.py`; file: `docs/assemble/index.html`).

One pot. Everything runs off the laptop's USB. No power module, no 9V adapter.

| From | To | Wire |
|---|---|---|
| ESP32 VIN (right side, top, next to USB; printed like "VN") | Relay DC+ screw | F-M |
| ESP32 GND (right side, 2nd pin) | Relay DC− screw | F-M |
| Transistor PN2222, flat side facing you | Bottom half, row next to the bottom rail: LEFT leg (E) col 22, MIDDLE (B) col 21, RIGHT (C) col 20 | part |
| 1K resistor (brown-black-red-gold) | MIDDLE leg line (col 21) → col 15 | part |
| ESP32 D26 (right side, 7th pin) | col 15 line, next to the resistor | F-M (gray) |
| ESP32 GND (left side, 2nd pin) | LEFT leg line (col 22) = the ground line | F-M (white) |
| RIGHT leg line (col 20) | Relay IN screw | male-male (red) |
| Relay jumper | on **L** | cap |
| Relay DC+ screw (next to VIN's wire) | Relay COM screw | male-male |
| Pump red | Relay NO screw | pump's own |
| Pump black | Relay DC− screw (next to GND's wire) | pump's own |
| Temp probe yellow / red / black | Adapter screws DAT / VCC / GND | probe's own |
| Adapter DAT pin → a48, ESP32 D4 (left side, 5th pin) → c48 | top half, col 48 = data line | 2 F-M |
| Adapter VCC pin → a45, ESP32 3V3 (left side, top) → c45 | top half, col 45 = 3.3V line | 2 F-M |
| Adapter GND pin | LEFT leg line (col 22) | F-M |
| Soil probe cable AOUT | ESP32 D32 (right side, 10th pin) | F-M |
| Soil probe cable VCC | col 45 (3.3V line) | male-male |
| Soil probe cable GND | LEFT leg line (col 22) | male-male |

Rules that bite:
- **The relay needs the transistor.** It's a 5V module; the ESP32 pin only gives 3.3V. Wired straight to D26 it stuck ON with the jumper on L and never clicked on H. With the PN2222 + 1K it clicks. Firmware is set for this: `RELAY_ACTIVE_LOW = false` (`farm_hand.ino:24`), HIGH = pump on.
- Transistor printed **P2N2222A** instead of PN2222 = legs reversed. Check the print.
- The LEFT leg line is ground for 4 things (ESP32 GND, E leg, temp GND, soil GND). One pin per hole.
- Soil probe: **3.3V line only, never VIN.** Soil sensors only on pins 32-35.
- Probe electronics (the top part) stay dry. Only push in up to the line.
- Pins 33 / 27 (pot B) have nothing on them. Pin 33 reads junk (jumps 0-100% when the pump runs). `ONE_POT=1` (default) ignores it.
- The temp adapter has its pull-up built in: no 4.7k needed (it found the probe without one).

## 3. Bring-up: how it was proven on 2026-09-23

Tools: `arduino-cli` at `shellhacks2025\tools\arduino-cli\arduino-cli.exe`, esp32 core 3.3.12, OneWire 2.3.8, DallasTemperature 4.0.6. Board on **COM3** (CP2102 driver).

Flash the real code (close anything holding COM3 first, like `tools/raw_serial.py`):
```
cd Documents\code\shellhacks2025\farm-hand
..\tools\arduino-cli\arduino-cli.exe compile --upload -p COM3 --fqbn esp32:esp32:esp32 firmware\farm_hand
```
Watch + talk to the board: `.venv\Scripts\python tools\raw_serial.py` → http://127.0.0.1:8096 (type a command, Enter).

What each part did, in build order:

1. **Relay** (test code flipped D26 every 2 s): clicks every 2 s, LED1 blinks. Before the transistor: no click.
2. **Pump**: water on every click. ESP32 uptime ran 61.7 s → 86.0 s with the pump cycling = no restarts.
3. **Temp probe** (`firmware/temp_test`): `probes:1`, 24.88 °C at room temp.
4. **Soil probe** (`firmware/sensors_test`): about 3400 raw in dry air, 1507 raw in water (calibration in `farm_hand.ino:32-33`).
5. **Everything, real firmware**: soil 44%, temp 26.1 °C. `P A 3000` ran 3003 ms. `P A 10000` ran 10000 ms and took soil **44% → 52%**, uptime 14.0 s → 35.1 s straight through = USB power holds a 10 s pour.

Commands: `P A 3000` pour 3 s · `S` reading now · `X` emergency stop. Pours cap at 30 s.

At ShellHacks:
1. Unpack, check every wire against the table above (or the assemble page). Tug every screw.
2. Soil probe into the box up to the line, against the front wall. Temp probe in the soil. Pump in its water cup, tube tip on the soil.
3. USB in, open the raw serial page, see `reading` lines, send `P A 3000`.
4. Close the raw serial page, then: `.venv\Scripts\python laptop\calibrate.py` (optional re-cal) and `.venv\Scripts\python laptop\server.py` → http://127.0.0.1:8080, badge says **LIVE BOARD**.

