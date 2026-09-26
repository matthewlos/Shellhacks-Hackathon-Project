#include "comp_temp.h"


/* Two data lines: D21 (temp 1) and D4 (temp 2). Probes from both are listed together. */
OneWire oneWire(DS18B20_PIN);
OneWire oneWire2(DS18B20_PIN_2);

DallasTemperature sensors(&oneWire);
DallasTemperature sensors2(&oneWire2);

static DallasTemperature *bus_of[TEMP_MAX];
static DeviceAddress addr[TEMP_MAX];
static int count = 0;
static unsigned long last_scan = 0;
static bool dropped = false;             /* a found probe stopped answering on the last read */

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
    for (DallasTemperature *b : {&sensors, &sensors2})
    {
        b->setResolution(11);                 /* 0.125 C, 375 ms conversion */
        b->setWaitForConversion(false);       /* start it, read it next loop: never block the loop */
        b->requestTemperatures();
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
    /* A missing probe is searched for every 2 s (an empty bus answers in ~1 ms); with both found, every 30 s */
    if (millis() - last_scan > ((count < TEMP_MAX || dropped) ? 2000UL : 30000UL))
    {
        TEMP_scan();
    }

    out->count = count;
    dropped = false;
    for (int i = 0; i < count; i++)
    {
        for (int b = 0; b < 8; b++)
        {
            sprintf(&out->id[i][2 * b], "%02X", addr[i][b]);
        }
        float c = bus_of[i]->getTempC(addr[i]);
        out->ok[i] = (c != DEVICE_DISCONNECTED_C);
        dropped |= !out->ok[i];
        out->celsius[i] = c;
        out->pin[i] = (bus_of[i] == &sensors) ? DS18B20_PIN : DS18B20_PIN_2;
    }
    sensors.requestTemperatures();           /* start the next conversion; read on the next loop (1 s later) */
    sensors2.requestTemperatures();

    return (count > 0) ? STATUS_OK : STATUS_ERR_NO_TEMP_PROBE;
}
