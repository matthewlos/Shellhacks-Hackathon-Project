/* 
* https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/uart.html
* chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/https://www.analog.com/media/en/technical-documentation/data-sheets/ds3231.pdf
*/

#ifndef COMP_TEMP_H
#define COMP_TEMP_H

#include "sys_target.h"
#include "sys_pinout.h"
#include "sys_status.h"

#include <OneWire.h>
#include <DallasTemperature.h>

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    TEMP_init(void);
float    TEMP_update(void);

#ifdef __cplusplus
}
#endif

#endif