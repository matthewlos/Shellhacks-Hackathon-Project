#ifndef COMP_REPORT_H
#define COMP_REPORT_H

#include "sys_target.h"
#include "sys_status.h"
#include "sys_data.h"

#define REPORT_BAUD 115200

#ifdef __cplusplus
extern "C" {
#endif

StatusCode_e    REPORT_init(void);
void            REPORT_status(StatusCode_e code);
StatusCode_e    REPORT_send(const SoilReading_t *soil, const TempReading_t *temp);

#ifdef __cplusplus
}
#endif

#endif