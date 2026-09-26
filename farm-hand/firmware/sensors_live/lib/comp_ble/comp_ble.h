/* 
* https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ble.html
*/

#ifndef COMP_BLE_H
#define COMP_BLE_H

#include "sys_target.h"
#include "sys_status.h"
#include "sys_data.h"

#define BLE_NAME            "FarmHand"
#define BLE_SERVICE_UUID    "6f2a0001-8c3e-4b5a-9d1e-2f7c3a1b0e01"
#define BLE_READING_UUID    "6f2a0002-8c3e-4b5a-9d1e-2f7c3a1b0e01"

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    BLE_init(void);
StatusCode_e    BLE_send(const SoilReading_t *soil, const TempReading_t *temp);
bool            BLE_connected(void);

#ifdef __cplusplus
}
#endif

#endif