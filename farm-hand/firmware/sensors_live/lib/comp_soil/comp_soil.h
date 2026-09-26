#ifndef COMP_SOIL_H
#define COMP_SOIL_H

#include "sys_target.h"
#include "sys_pinout.h"
#include "sys_status.h"
#include "sys_data.h"

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    SOIL_init(void);
StatusCode_e    SOIL_update(SoilReading_t *out);

#ifdef __cplusplus
}
#endif

#endif