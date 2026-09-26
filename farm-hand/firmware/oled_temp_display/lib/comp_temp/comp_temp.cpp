#include "comp_temp.h"

OneWire oneWire(DS18B20_PIN);

DallasTemperature sensors(&oneWire);

StatusCode_e    TEMP_init(void)
{
    sensors.begin();

    return STATUS_OK;
}

float    TEMP_update(void)
{
    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);
    return temperature;
}   