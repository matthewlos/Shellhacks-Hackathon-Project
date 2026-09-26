#include "comp_temp.h"

#define TEMP_RESCAN_MS 10000

/* Two data lines: D4 (where every probe belongs) and D2 (where temp 2 was wired). Probes from both are listed together. */
OneWire oneWire(DS18B20_PIN);
OneWire oneWire2(DS18B20_PIN_2);

DallasTemperature sensors(&oneWire);
DallasTemperature sensors2(&oneWire2);

static DallasTemperature *bus_of[TEMP_MAX];
static DeviceAddress addr[TEMP_MAX];
static int count = 0;
static unsigned long last_scan = 0;

static void TEMP_scan_bus(DallasTemperature *bus)
{
    bus->begin();
    int n = bus->getDeviceCount();
    for (int i = 0; i < n && count < TEMP_MAX; i++)
    {
        if (bus->getAddress(addr[count], i))
        {
            bus_of[count] = bus;
            count++;
        }
    }
}

static void TEMP_scan(void)
{
    count = 0;
    TEMP_scan_bus(&sensors);
    TEMP_scan_bus(&sensors2);
    last_scan = millis();
}

StatusCode_e    TEMP_init(void)
{
    TEMP_scan();

    return (count > 0) ? STATUS_OK : STATUS_ERR_NO_TEMP_PROBE;
}

StatusCode_e    TEMP_update(TempReading_t *out)
{
    /* Rescan so a probe plugged in (or moved to D4) while running shows up */
    if (millis() - last_scan > ((count < TEMP_MAX) ? 2000UL : TEMP_RESCAN_MS))
    {
        TEMP_scan();
    }

    sensors.requestTemperatures();
    sensors2.requestTemperatures();

    out->count = count;
    for (int i = 0; i < count; i++)
    {
        for (int b = 0; b < 8; b++)
        {
            sprintf(&out->id[i][2 * b], "%02X", addr[i][b]);
        }
        float c = bus_of[i]->getTempC(addr[i]);
        out->ok[i] = (c != DEVICE_DISCONNECTED_C);
        out->celsius[i] = c;
    }

    return (count > 0) ? STATUS_OK : STATUS_ERR_NO_TEMP_PROBE;
}
