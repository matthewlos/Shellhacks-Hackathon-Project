#ifndef COMP_CMD_H
#define COMP_CMD_H

#include "sys_target.h"
#include "sys_status.h"

/*
* One command per line over USB serial (115200):
*   pump A 10     run box A's pump 10 s (B for box B), max PUMP_TEST_MAX_S, works while disarmed
*   stop          both pumps off now
*   relay low     the relay module switches on when its IN pin is LOW (low-level trigger); "relay high" = HIGH
* Each answers with one JSON line: {"type":"pump_test",...} or {"type":"cmd",...}
*/

#ifdef __cplusplus
extern "C" {
#endif

void    CMD_update(void);

#ifdef __cplusplus
}
#endif

#endif
