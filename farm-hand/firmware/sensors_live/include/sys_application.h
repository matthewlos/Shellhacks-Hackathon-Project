#ifndef SYS_APPLICATION_H
#define SYS_APPLICATION_H

#include "sys_error_handler.h"
#include "sys_pinout.h"
#include "sys_status.h"
#include "sys_target.h"
#include "sys_data.h"

#include "comp_relay.h"
#include "comp_soil.h"
#include "comp_temp.h"
#include "comp_oled.h"
#include "comp_report.h"
#include "comp_diag.h"
#include "comp_ble.h"

#ifdef __cplusplus
extern "C" {
#endif

void sys_application(void);
void sys_loop(void);

#ifdef __cplusplus
}
#endif

#endif