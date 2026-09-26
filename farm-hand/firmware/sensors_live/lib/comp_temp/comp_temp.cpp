#include "comp_temp.h"

#define TEMP_RESCAN_MS 10000

OneWire oneWire(DS18B20_PIN);

DallasTemperature sensors(&oneWire);

static DeviceAddress addr[TEMP_MAX];
static int count = 0;
static unsigned long last_scan = 0;

static void TEMP_scan(void)
{
    sensors.begin();
    count = min((int)sensors.getDeviceCount(), TEMP_MAX);
    for (int i = 0; i < count; i++)
    {
        sensors.getAddress(addr[i], i);
    }
    last_scan = millis();
}

StatusCode_e    TEMP_init(void)
{
    TEMP_scan();

    return (count > 0) ? STATUS_OK : STATUS_ERR_NO_TEMP_PROBE;
}

StatusCode_e    TEMP_update(TempReading_t *out)
{
    /* Rescan so a probe plugged in while running shows up */
    if (millis() - last_scan > ((count < TEMP_MAX) ? 2000UL : TEMP_RESCAN_MS))
    {
        TEMP_scan();
    }

    sensors.requestTemperatures();

    out->count = count;
    for (int i = 0; i < count; i++)
    {
        for (int b = 0; b < 8; b++)
        {
            sprintf(&out->id[i][2 * b], "%02X", addr[i][b]);
        }
        float c = sensors.getTempC(addr[i]);
        out->ok[i] = (c != DEVICE_DISCONNECTED_C);
        out->celsius[i] = c;
    }

    return (count > 0) ? STATUS_OK : STATUS_ERR_NO_TEMP_PROBE;
}   