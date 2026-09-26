#ifndef COMP_WIFI_H
#define COMP_WIFI_H

#include "sys_target.h"
#include "sys_status.h"

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    WIFI_init(void);
void            WIFI_update(void);
void            WIFI_scan(void);            /* prints every network the ESP32 can hear (2.4 GHz only) */
bool            WIFI_online(void);          /* joined the network AND reached the internet */
const char *    WIFI_label(void);           /* short state for the screen: "wifi ok", "wifi..", "no wifi" */

#ifdef __cplusplus
}
#endif

#endif
