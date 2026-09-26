/* 
* https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf
*/
#ifndef PINOUT_H
#define PINOUT_H

#include "sys_target.h"

/* OLED pinout. Off on the soldered board: D21 / D22 now carry temp 1 and pump 2. To bring the screen back, wire it to 18 / 19 and set USE_OLED 1 */
#ifndef USE_OLED
#define USE_OLED 0
#endif
#define OLED_SCL 19
#define OLED_SDA 18

/* DS18B20 pinout: temp 1 on D21, temp 2 on D4. Boxes are matched by probe ID on the server (TEMP_BOX), not by pin */
#define DS18B20_PIN   21
#define DS18B20_PIN_2 4

/* Soil probe pinout (AOUT), ADC1 pins (ADC2 stops working while WiFi is on) */
#define SOIL_A_PIN 35
#define SOIL_B_PIN 34

/* Relay pinout (soldered board 2026-09-26). RELAY_ON_LEVEL: HIGH for the PN2222 driver or a high-level trigger module,
   LOW for a low-level trigger module */
#define RELAY_A_PIN 13
#define RELAY_B_PIN 22
#ifndef RELAY_ON_LEVEL
#define RELAY_ON_LEVEL HIGH
#endif

#endif
