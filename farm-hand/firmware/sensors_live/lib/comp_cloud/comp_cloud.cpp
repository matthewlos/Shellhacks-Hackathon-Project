#include "comp_cloud.h"

#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "comp_wifi.h"
#include "comp_relay.h"
#include "secrets.h"            /* FARMHAND_URL, FARMHAND_TOKEN (never committed) */

/*
* Every 10 s, when WiFi is online: POST the reading to the Farm Hand home server (the Mac mini, cloud/receiver.py)
* and read its decision back: {"brain":"rules|laya","pick":"water|wait_moist|..","pump_a_s":7.5,"why":".."}
* The ESP32 always calls out (both ends are behind routers); the decision rides back in the reply.
* Prints {"type":"cloud","code":200,"reply":{...}} over serial.
*/

static unsigned long last_send = 0;
static float pump_a_s = 0;
static bool  fresh = false;
static unsigned long last_ok = 0;

StatusCode_e    CLOUD_send(const SoilReading_t *soil, const TempReading_t *temp)
{
    if (!WIFI_online() || millis() - last_send < CLOUD_PERIOD_MS)
    {
        return STATUS_OK;
    }
    last_send = millis();

    char body[240];
    int n = snprintf(body, sizeof(body), "{\"ms\":%lu,\"a_raw\":%d,\"a_pct\":%.1f,\"b_raw\":%d,\"b_pct\":%.1f,\"temps\":[",
                     millis(), soil->raw[0], soil->pct[0], soil->raw[1], soil->pct[1]);
    for (int i = 0; i < temp->count && n < (int)sizeof(body) - 40; i++)
    {
        n += snprintf(body + n, sizeof(body) - n, (temp->ok[i] ? "%s%.2f" : "%snull"), i ? "," : "", temp->celsius[i]);
    }
    snprintf(body + n, sizeof(body) - n, "],\"pumps\":[%d,%d],\"rssi\":%d}", RELAY_is_on(0), RELAY_is_on(1), WiFi.RSSI());

    WiFiClientSecure tls;
    tls.setInsecure();          /* TODO: pin the ts.net certificate chain; the token still gates writes */
    HTTPClient h;
    h.setTimeout(8000);
    h.begin(tls, FARMHAND_URL);
    h.addHeader("Content-Type", "application/json");
    h.addHeader("X-Farmhand-Token", FARMHAND_TOKEN);
    int code = h.POST((uint8_t *)body, strlen(body));
    String reply = (code > 0) ? h.getString() : "";
    h.end();

    if (code == 200)
    {
        int k = reply.indexOf("\"pump_a_s\":");
        pump_a_s = (k >= 0) ? reply.substring(k + 11).toFloat() : 0;
        fresh = true;
        last_ok = millis();
        Serial.printf("{\"type\":\"cloud\",\"code\":%d,\"reply\":%s}\n", code, reply.c_str());
    }
    else
    {
        char err[80] = "";
        tls.lastError(err, sizeof(err));
        Serial.printf("{\"type\":\"cloud\",\"code\":%d,\"heap\":%u,\"err\":\"%s\"}\n", code, ESP.getFreeHeap(), err);
    }
    return (code == 200) ? STATUS_OK : STATUS_ERR_CLOUD;
}

float   CLOUD_take_drink(void)
{
    if (!fresh) return 0;
    fresh = false;
    return pump_a_s;
}

unsigned long   CLOUD_last_ok_ms(void)
{
    return last_ok;
}