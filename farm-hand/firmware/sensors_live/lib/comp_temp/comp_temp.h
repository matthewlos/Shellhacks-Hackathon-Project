/* 
* https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf
*/

#ifndef COMP_TEMP_H
#define COMP_TEMP_H

#include "sys_target.h"
#include "sys_pinout.h"
#include "sys_status.h"
#include "sys_data.h"

#include <OneWire.h>
#include <DallasTemperature.h>

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    TEMP_init(void);
StatusCode_e    TEMP_update(TempReading_t *out);

#ifdef __cplusplus
}
#endif

#endif