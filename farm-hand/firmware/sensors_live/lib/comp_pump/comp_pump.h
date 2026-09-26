#ifndef COMP_PUMP_H
#define COMP_PUMP_H

#include "sys_target.h"
#include "sys_status.h"
#include "sys_data.h"

/* 0 = never run a pump (log what would have happened). Set to 1 only after confirming which pump is box A's. */
#define PUMP_ARMED          0

/* Safety rules the chip enforces no matter who asks (server, Laya, or the chip's own baseline fallback) */
#define PUMP_MAX_S          8           /* longest single drink */
#define PUMP_GAP_MS         300000UL    /* 5 min between drinks: let the water soak to the probe */
#define PUMP_DAILY_MAX_S    75          /* ~1.5 L a day at ~20 ml/s */
#define PUMP_WET_PCT        70.0f       /* never water at or above this */
#define PUMP_PROBE_MIN_RAW  500         /* raw below this = probe disconnected: never water blind */
#define PUMP_LOCAL_BASELINE 45.0f       /* chip's own floor when the server is unreachable */
#define PUMP_SERVER_STALE_MS 120000UL   /* server silent this long -> chip holds the baseline itself */

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    PUMP_init(void);
bool            PUMP_request(float seconds, const SoilReading_t *soil, const char *by);   /* box A only */
void            PUMP_update(void);                                                          /* turns it off on time */
void            PUMP_fallback(const SoilReading_t *soil, unsigned long last_server_ok_ms);

#ifdef __cplusplus
}
#endif

#endif