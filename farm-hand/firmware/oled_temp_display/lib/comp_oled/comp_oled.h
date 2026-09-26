/* 
* https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/uart.html
* chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/https://www.analog.com/media/en/technical-documentation/data-sheets/ds3231.pdf
*/

#ifndef COMP_OLED_H
#define COMP_OLED_H

#include "sys_target.h"
#include "sys_pinout.h"
#include "sys_status.h"

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    OLED_init(void);
StatusCode_e    OLED_update(float temperature);

#ifdef __cplusplus
}
#endif

#endif