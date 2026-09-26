#include "comp_pump.h"
#include "comp_relay.h"

/*
* Box A's pump (relay D26 through the PN2222: HIGH = on). Non-blocking: PUMP_request starts it, PUMP_update stops it.
* Every request goes through the rules in comp_pump.h, so a bad server reply can't flood the box.
* Box B (the timer box) is not driven here yet.
* Prints {"type":"pump","pot":"A","ran_s":5.0,"by":"laya"} or {"type":"pump_refused","why":".."}.
*/

static unsigned long started = 0, stop_at = 0, last_drink = 0, day_start = 0;
static float day_s = 0;
static bool running = false;
static const char *who = "";

static bool refuse(const char *why)
{
    Serial.printf("{\"type\":\"pump_refused\",\"pot\":\"A\",\"why\":\"%s\"}\n", why);
    return false;
}

StatusCode_e    PUMP_init(void)
{
    RELAY_set(0, false);
    day_start = millis();
    return STATUS_OK;
}

bool    PUMP_request(float seconds, const SoilReading_t *soil, const char *by)
{
    if (seconds <= 0) return false;
    if (running) return refuse("already running");
    if (soil->raw[0] < PUMP_PROBE_MIN_RAW) return refuse("probe A disconnected");
    if (soil->pct[0] >= PUMP_WET_PCT) return refuse("soil already wet");
    if (last_drink && millis() - last_drink < PUMP_GAP_MS) return refuse("last drink still soaking in");
    if (millis() - day_start > 86400000UL) { day_start = millis(); day_s = 0; }
    seconds = min(seconds, (float)PUMP_MAX_S);
    if (day_s + seconds > PUMP_DAILY_MAX_S) return refuse("daily water cap reached");

#if !PUMP_ARMED
    static unsigned long last_note = 0;
    if (millis() - last_note > 60000UL)
    {
        last_note = millis();
        Serial.printf("{\"type\":\"pump_disarmed\",\"pot\":\"A\",\"would_run_s\":%.1f,\"by\":\"%s\"}\n", seconds, by);
    }
    return false;
#endif
    who = by;
    started = millis();
    stop_at = started + (unsigned long)(seconds * 1000);
    running = true;
    RELAY_set(0, true);
    return true;
}

void    PUMP_update(void)
{
    if (running && (long)(millis() - stop_at) >= 0)
    {
        RELAY_set(0, false);
        running = false;
        float ran = (millis() - started) / 1000.0f;
        day_s += ran;
        last_drink = millis();
        Serial.printf("{\"type\":\"pump\",\"pot\":\"A\",\"ran_s\":%.1f,\"by\":\"%s\",\"today_s\":%.1f}\n", ran, who, day_s);
    }
}

void    PUMP_fallback(const SoilReading_t *soil, unsigned long last_server_ok_ms)
{
    bool stale = (last_server_ok_ms == 0 && millis() > PUMP_SERVER_STALE_MS) ||
                 (last_server_ok_ms && millis() - last_server_ok_ms > PUMP_SERVER_STALE_MS);
    if (stale && !running && soil->raw[0] >= PUMP_PROBE_MIN_RAW && soil->pct[0] <= PUMP_LOCAL_BASELINE)
    {
        if (!last_drink || millis() - last_drink >= PUMP_GAP_MS)
        {
            PUMP_request(5, soil, "chip_baseline");
        }
    }
}