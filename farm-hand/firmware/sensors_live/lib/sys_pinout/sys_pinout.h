/* 
* https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf
*/
#ifndef PINOUT_H
#define PINOUT_H

#include "sys_target.h"

/* OLED pinout */
#define OLED_SCL 22
#define OLED_SDA 21

/* DS18B20 pinout (every temp probe on the same data line) */
#define DS18B20_PIN 4

/* Soil probe pinout (AOUT), ADC1 pins. Wired to D34 / D35 on the real board (found by comp_diag 2026-09-26) */
#define SOIL_A_PIN 34
#define SOIL_B_PIN 35

/* Relay pinout (through the PN2222 driver: HIGH = relay on) */
#define RELAY_A_PIN 26
#define RELAY_B_PIN 27

#endif