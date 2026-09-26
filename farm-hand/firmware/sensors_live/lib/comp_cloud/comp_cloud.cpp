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
static volatile bool fresh = false;
static volatile unsigned long last_ok = 0;

/* The upload runs on core 0 in its own task, so a slow HTTPS round trip never stalls the 1 s sensor loop.
   The loop just drops the newest reading into `pending`; the task sends it and keeps the TLS connection open. */
static SemaphoreHandle_t mtx = nullptr;
static char pending[320];
static bool has_pending = false;

static void CLOUD_task(void *)
{
    static WiFiClientSecure tls;
    tls.setInsecure();                  /* TODO: pin the ts.net chain; the token still gates writes */
    HTTPClient h;
    h.setReuse(true);                   /* keep the connection open: no new handshake every 10 s */
    char body[320];
    for (;;)
    {
        bool go = false;
        xSemaphoreTake(mtx, portMAX_DELAY);
        if (has_pending) { strcpy(body, pending); has_pending = false; go = true; }
        xSemaphoreGive(mtx);
        if (!go) { vTaskDelay(pdMS_TO_TICKS(200)); continue; }

        h.setTimeout(8000);
        h.begin(tls, FARMHAND_URL);
        h.addHeader("Content-Type", "application/json");
        h.addHeader("X-Farmhand-Token", FARMHAND_TOKEN);
        int code = h.POST((uint8_t *)body, strlen(body));
        String reply = (code > 0) ? h.getString() : "";
        if (code != 200) h.end(); else h.end();
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
            Serial.printf("{\"type\":\"cloud\",\"code\":%d,\"heap\":%u,\"max_block\":%u,\"err\":\"%s\"}\n", code, ESP.getFreeHeap(), ESP.getMaxAllocHeap(), err);
            tls.stop();
        }
    }
}

StatusCode_e    CLOUD_send(const SoilReading_t *soil, const TempReading_t *temp)
{
    if (!mtx)
    {
        mtx = xSemaphoreCreateMutex();
        xTaskCreatePinnedToCore(CLOUD_task, "cloud", 8192, nullptr, 1, nullptr, 0);
    }
    if (!WIFI_online() || millis() - last_send < CLOUD_PERIOD_MS)
    {
        return STATUS_OK;
    }
    last_send = millis();

    char body[320];
    int n = snprintf(body, sizeof(body), "{\"ms\":%lu,\"a_raw\":%d,\"a_pct\":%.1f,\"b_raw\":%d,\"b_pct\":%.1f,\"soil\":{\"%d\":%d,\"%d\":%d,\"32\":%d,\"33\":%d},\"temps\":[",
                     millis(), soil->raw[0], soil->pct[0], soil->raw[1], soil->pct[1], SOIL_A_PIN, soil->raw[0], SOIL_B_PIN, soil->raw[1], soil->raw[2], soil->raw[3]);
    for (int i = 0; i < temp->count && n < (int)sizeof(body) - 60; i++)
    {
        n += snprintf(body + n, sizeof(body) - n, "%s{\"id\":\"%s\",\"pin\":%d,\"c\":", i ? "," : "", temp->id[i], temp->pin[i]);
        n += snprintf(body + n, sizeof(body) - n, temp->ok[i] ? "%.2f}" : "null}", temp->celsius[i]);
    }
    snprintf(body + n, sizeof(body) - n, "],\"pumps\":[%d,%d],\"rssi\":%d}", RELAY_is_on(0), RELAY_is_on(1), WiFi.RSSI());

    xSemaphoreTake(mtx, portMAX_DELAY);
    strcpy(pending, body);              /* only the newest reading matters: overwrite anything not sent yet */
    has_pending = true;
    xSemaphoreGive(mtx);
    return STATUS_OK;
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
