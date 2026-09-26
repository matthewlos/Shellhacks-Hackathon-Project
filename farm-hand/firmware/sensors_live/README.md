# Sensor test firmware (PlatformIO)

Reads both soil probes and every DS18B20, shows them on the 0.96" OLED and sends one JSON line a second over USB. **Pumps stay off** (both relay pins held low). Same layout and style as `../oled_temp_display` (Daniel's): `sys_*` system libs, `comp_*` components, `XXX_init` / `XXX_update`, `StatusCode_e`.

Tested on the real board 2026-09-26: screen, both soil probes and temp 1 reading.

| Part | ESP32 pin (as wired on the real board) |
|---|---|
| Soil A AOUT | D34 |
| Soil B AOUT | D35 |
| DS18B20 data (all probes on one line) | D4 |
| OLED SDA / SCL | D21 / D22 |
| Relays (held off) | D26 / D27 |

The sensors are powered from the separate power module, not the ESP32. Its ground must be tied to the ESP32's GND.

```
pio run -t upload        # flash (see "flashing" below)
python ../../tools/sensors_live.py   # live page at http://127.0.0.1:8099
```

`comp_diag` prints a wiring check every 10 s: I2C devices on 21/22, every ADC1 pin's raw value, and which pins have a DS18B20. That's how the real pins above were found.

**Flashing:** nothing may hold **D2** high at power-up (it's a boot pin). A DS18B20 adapter on D2 (its pull-up) blocks flashing. Keep temp probes on D4.
