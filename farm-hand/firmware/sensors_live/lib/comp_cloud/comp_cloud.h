#ifndef COMP_CLOUD_H
#define COMP_CLOUD_H

#include "sys_target.h"
#include "sys_status.h"
#include "sys_data.h"

#define CLOUD_PERIOD_MS 10000

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    CLOUD_send(const SoilReading_t *soil, const TempReading_t *temp);
float           CLOUD_pump_a_s(void);       /* last drink the server asked for (s); 0 = wait. Not acted on in this test build */

#ifdef __cplusplus
}
#endif

#endif