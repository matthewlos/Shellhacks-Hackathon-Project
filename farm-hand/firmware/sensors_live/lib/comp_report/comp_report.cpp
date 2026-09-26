#include "comp_report.h"
#include "comp_relay.h"

/*
* One JSON line a second to the laptop (tools/sensors_live.py reads it):
* {"type":"sens","ms":..,"a_raw":..,"a_pct":..,"b_raw":..,"b_pct":..,"temps":[{"id":"28..","c":26.12}]}
*/

StatusCode_e    REPORT_init(void)
{
    Serial.begin(REPORT_BAUD);
    Serial.println("{\"type\":\"boot\",\"fw\":\"sensors_live\"}");

    return STATUS_OK;
}

void    REPORT_status(StatusCode_e code)
{
    const char *why = "unknown";
    switch (code)
    {
        case STATUS_ERR_OLED_NOT_FOUND: why = "oled_not_found";  break;
        case STATUS_ERR_NO_TEMP_PROBE:  why = "no_temp_probe";   break;
        default:                                                 break;
    }
    Serial.printf("{\"type\":\"status\",\"code\":%d,\"why\":\"%s\"}\n", (int)code, why);
}

StatusCode_e    REPORT_send(const SoilReading_t *soil, const TempReading_t *temp)
{
    Serial.printf("{\"type\":\"sens\",\"ms\":%lu,\"a_raw\":%d,\"a_pct\":%.1f,\"b_raw\":%d,\"b_pct\":%.1f,\"soil\":{\"34\":%d,\"35\":%d,\"32\":%d,\"33\":%d},\"temps\":[",
                  millis(), soil->raw[0], soil->pct[0], soil->raw[1], soil->pct[1], soil->raw[0], soil->raw[1], soil->raw[2], soil->raw[3]);
    for (int i = 0; i < temp->count; i++)
    {
        if (temp->ok[i])
        {
            Serial.printf("%s{\"id\":\"%s\",\"c\":%.2f}", i ? "," : "", temp->id[i], temp->celsius[i]);
        }
        else
        {
            Serial.printf("%s{\"id\":\"%s\",\"c\":null}", i ? "," : "", temp->id[i]);
        }
    }
    Serial.printf("],\"pumps\":[%d,%d]}\n", RELAY_is_on(0), RELAY_is_on(1));

    return STATUS_OK;
}