#ifndef COMP_CLOUD_H
#define COMP_CLOUD_H

#include "sys_target.h"
#include "sys_status.h"
#include "sys_data.h"

#define CLOUD_PERIOD_MS 2000            /* 2 s: a pump command from the pump page lands within ~2 s */

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    CLOUD_send(const SoilReading_t *soil, const TempReading_t *temp);
float           CLOUD_take_drink(void);     /* seconds the server asked for since the last call (0 = wait); returns it once */
unsigned long   CLOUD_last_ok_ms(void);
bool            CLOUD_take_cmd(char *out, size_t n);   /* a command the server queued ("pump B 60", "stop"); returns it once */     /* millis() of the last 200 reply, 0 = never */

#ifdef __cplusplus
}
#endif

#endif