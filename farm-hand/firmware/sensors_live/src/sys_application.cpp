#include "sys_application.h"

static SoilReading_t soil;
static TempReading_t temp;
static int loops = 0;

void sys_application(void)
{
    StatusCode_e ret = STATUS_OK;

    /* Pumps off before anything else */
    ret = RELAY_init();
    if (ret != STATUS_OK)
    {
        error_handler();
    }

    ret = REPORT_init();
    if (ret != STATUS_OK)
    {
        error_handler();
    }

    ret = BLE_init();
    if (ret != STATUS_OK)
    {
        error_handler();
    }

    ret = SOIL_init();
    if (ret != STATUS_OK)
    {
        error_handler();
    }

    /* No screen is not fatal: keep reading and reporting over serial */
    ret = OLED_init();
    if (ret != STATUS_OK)
    {
        REPORT_status(ret);
    }

    /* No temp probe yet is not fatal either: the bus is scanned again every 10 s */
    ret = TEMP_init();
    if (ret != STATUS_OK)
    {
        REPORT_status(ret);
    }

    DIAG_run();
}

void sys_loop(void)
{
    unsigned long start = millis();

    RELAY_all_off();
    SOIL_update(&soil);
    TEMP_update(&temp);
    REPORT_send(&soil, &temp);
    BLE_send(&soil, &temp);
    OLED_update(&soil, &temp);

    /* Wiring check every 10 s, so moving a wire shows up without a reset */
    if (++loops % 10 == 0)
    {
        DIAG_run();
    }

    long wait = LOOP_PERIOD_MS - (long)(millis() - start);
    if (wait > 0)
    {
        delay(wait);
    }
}