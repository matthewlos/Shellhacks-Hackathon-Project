#ifndef SYS_APPLICATION_H
#define SYS_APPLICATION_H

#include "sys_error_handler.h"
#include "sys_pinout.h"
#include "sys_status.h"
#include "sys_target.h"

#include "comp_temp.h"
#include "comp_oled.h"

#ifdef __cplusplus
extern "C" {
#endif

void sys_application(void);
void sys_loop(void);

#ifdef __cplusplus
}
#endif

#endif