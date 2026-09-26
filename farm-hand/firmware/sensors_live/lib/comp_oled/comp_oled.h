/* 
* https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf
*/

#ifndef COMP_OLED_H
#define COMP_OLED_H

#include "sys_target.h"
#include "sys_pinout.h"
#include "sys_status.h"
#include "sys_data.h"
#include "comp_wifi.h"

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    OLED_init(void);
StatusCode_e    OLED_update(const SoilReading_t *soil, const TempReading_t *temp);

#ifdef __cplusplus
}
#endif

#endif