#ifndef SYS_ERROR_HANDLER_H
#define SYS_ERROR_HANDLER_H

#include "driver/gpio.h"

#include "sys_target.h"
#include "sys_pinout.h"

#ifdef __cplusplus
extern "C" {
#endif

void error_handler(void);

#ifdef __cplusplus
}
#endif

#endif