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

#ifdef __cplusplus
}
#endif

#endif