#include "sys_application.h"

void sys_application(void)
{
    StatusCode_e ret = STATUS_OK;

    ret = OLED_init();
    if (ret != STATUS_OK) 
    {
        error_handler();
    }
    
    ret = TEMP_init();
    if (ret != STATUS_OK)   
    {
        error_handler();
    } 
}

void sys_loop(void)
{
    float temperature = TEMP_update();
    OLED_update(temperature);
    delay(1000);
}