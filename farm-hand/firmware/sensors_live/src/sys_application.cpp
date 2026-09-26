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

    ret = PUMP_init();
    if (ret != STATUS_OK)
    {
        error_handler();
    }

    ret = REPORT_init();
    if (ret != STATUS_OK)
    {
        error_handler();
    }

#if USE_BLE
    ret = BLE_init();                 /* off by default: its ~80 KB starved the WiFi uploads (demo = USB, testing = WiFi) */
    if (ret != STATUS_OK)
    {
        error_handler();
    }
#endif

    ret = WIFI_init();
    if (ret != STATUS_OK)
    {
        REPORT_status(ret);
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

    WIFI_update();
    SOIL_update(&soil);
    TEMP_update(&temp);
    REPORT_send(&soil, &temp);
#if USE_BLE
    BLE_send(&soil, &temp);
#endif
    CLOUD_send(&soil, &temp);

    /* Box A: do what the server (Laya / baseline rule) asked, through the chip's safety rules.
       Server silent for 2 min: the chip holds the baseline itself. */
    float drink = CLOUD_take_drink();
    if (drink > 0)
    {
        PUMP_request(drink, &soil, "server");
    }
    PUMP_fallback(&soil, CLOUD_last_ok_ms());
    PUMP_update();
    PUMP_timer_b();
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