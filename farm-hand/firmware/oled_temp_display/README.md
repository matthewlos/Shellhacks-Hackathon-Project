# OLED temperature display (Daniel Lopes)

A PlatformIO project for the ESP32 that reads the DS18B20 temperature probe once a second and shows it on a 0.96" OLED (SSD1306, I2C address 0x3C): `Temp: 26.12 C`.

| Part | ESP32 pin |
|---|---|
| OLED SDA | 21 |
| OLED SCL | 22 |
| DS18B20 data | 4 (same as `farm_hand.ino`) |

Build and flash: open this folder in VS Code with PlatformIO, or `pio run -t upload`. Libraries (Adafruit GFX, Adafruit SSD1306, OneWire, DallasTemperature) download on the first build.

## How it fits with Farm Hand

This is a standalone test program. The ESP32 runs one program at a time, so flashing this replaces `../farm_hand/farm_hand.ino` (no soil reading, no pumps, no data to the laptop while it's on). The plan is to merge the OLED code into `farm_hand.ino`. Pins 21 and 22 don't clash with anything the main firmware uses (4, 26, 27, 32, 33).

## Known issues (as of 2026-09-26)

- Text size 2 makes "Temp: 26.12 C" about 156 px wide on a 128 px screen, so it wraps.
- An unplugged probe shows `-127.00 C` (DallasTemperature's DEVICE_DISCONNECTED_C). Show "no probe" instead.
- `OLED_init()` prints with `Serial.println` but `Serial.begin()` is never called, so the message never shows.
- If the OLED isn't found, `OLED_init()` hangs forever (`while (true)`) instead of returning an error.
- The header comments in `comp_temp.h` / `comp_oled.h` link the ESP32 UART docs and a DS3231 datasheet (not used here).
