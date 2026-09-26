#ifndef COMP_RELAY_H
#define COMP_RELAY_H

#include "sys_target.h"
#include "sys_pinout.h"
#include "sys_status.h"

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    RELAY_init(void);
void            RELAY_all_off(void);
bool            RELAY_is_on(int pump);
void            RELAY_set(int pump, bool on);   /* RELAY_ON_LEVEL = relay on */      /* what the ESP32 is telling the relay (not measured water flow) */

#ifdef __cplusplus
}
#endif

#endif