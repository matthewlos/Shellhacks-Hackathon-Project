#ifndef SYS_STATUS_H
#define SYS_STATUS_H

#include "sys_target.h"

typedef enum 
{
    /* SYS Codes */
    
    STATUS_OK = 0,

    /* Component codes */

    STATUS_ERR_OLED_NOT_FOUND,
    STATUS_ERR_NO_TEMP_PROBE,

} StatusCode_e;

#endif