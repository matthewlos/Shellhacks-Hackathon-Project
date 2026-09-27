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

void    PUMP_test_update(void);

void    PUMP_update(void)
{
    PUMP_test_update();
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

/* ---------- box B: the timer (control) ---------- */
static unsigned long b_last = 0, b_stop = 0, b_day_start = 0;
static bool b_running = false;
static float b_day_s = 0;

void    PUMP_timer_b(void)
{
    if (b_running && (long)(millis() - b_stop) >= 0)
    {
        RELAY_set(1, false);
        b_running = false;
        Serial.printf("{\"type\":\"pump\",\"pot\":\"B\",\"ran_s\":%.1f,\"by\":\"timer\",\"today_s\":%.1f}\n", TIMER_B_POUR_S, b_day_s);
    }
    if (b_running || running) return;                             /* never both pumps at once */
    if (b_last && millis() - b_last < TIMER_B_EVERY_MS) return;
    if (!b_last && millis() < 60000UL) return;                     /* first pour 1 min after boot */
    if (millis() - b_day_start > 86400000UL) { b_day_start = millis(); b_day_s = 0; }
    b_last = millis();
    if (b_day_s + TIMER_B_POUR_S > PUMP_DAILY_MAX_S)
    {
        Serial.println("{\"type\":\"pump_refused\",\"pot\":\"B\",\"why\":\"daily water cap reached\"}");
        return;
    }
#if !PUMP_ARMED
    Serial.printf("{\"type\":\"pump_disarmed\",\"pot\":\"B\",\"would_run_s\":%.1f,\"by\":\"timer\"}\n", TIMER_B_POUR_S);
    return;
#endif
    b_day_s += TIMER_B_POUR_S;
    b_stop = millis() + (unsigned long)(TIMER_B_POUR_S * 1000);
    b_running = true;
    RELAY_set(1, true);
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
/* ---------- manual runs (USB or WiFi command): each pump on its own timer, both can run at once ---------- */
/* A hardware timer turns each pump off on the exact millisecond (the main loop only runs once a second),
   so ml measured / seconds run is a true flow rate. */
#include <Ticker.h>

static Ticker t_timer[2];
static volatile unsigned long t_start[2] = {0, 0}, t_end[2] = {0, 0};
static volatile bool t_on[2] = {false, false}, t_done[2] = {false, false};
static int t_last = -1;                      /* the pump most recently started or stopped: reported in the upload */
static float t_last_s[2] = {0, 0};

static void PUMP_test_timer(int pump)
{
    if (!t_on[pump]) return;
    RELAY_set(pump, false);
    t_end[pump] = millis();
    t_done[pump] = true;
}

bool    PUMP_test(int pump, float seconds)
{
    if (pump != 0 && pump != 1) return false;
    if (t_on[pump] || (pump == 0 && running) || (pump == 1 && b_running))
    {
        Serial.printf("{\"type\":\"pump_test\",\"state\":\"refused\",\"pot\":\"%c\",\"why\":\"this pump is already running\"}\n", pump ? 'B' : 'A');
        return false;
    }
    seconds = constrain(seconds, 0.5f, (float)PUMP_TEST_MAX_S);
    t_done[pump] = false;
    t_on[pump] = true;
    t_last = pump;
    t_start[pump] = millis();
    RELAY_set(pump, true);
    t_timer[pump].once_ms((uint32_t)(seconds * 1000), PUMP_test_timer, pump);
    Serial.printf("{\"type\":\"pump_test\",\"state\":\"on\",\"pot\":\"%c\",\"for_s\":%.1f,\"on_level\":\"%s\"}\n",
                  pump ? 'B' : 'A', seconds, RELAY_on_level() ? "HIGH" : "LOW");
    return true;
}

static void PUMP_test_report(int pump, const char *why)
{
    t_last_s[pump] = (t_end[pump] - t_start[pump]) / 1000.0f;
    t_last = pump;
    Serial.printf("{\"type\":\"pump_test\",\"state\":\"off\",\"pot\":\"%c\",\"ran_s\":%.3f,\"why\":\"%s\"}\n",
                  pump ? 'B' : 'A', t_last_s[pump], why);
    t_on[pump] = false;
    t_done[pump] = false;
}

void    PUMP_test_update(void)
{
    for (int p = 0; p < 2; p++)
    {
        if (t_done[p]) PUMP_test_report(p, "done");
    }
}

static char t_json[48] = "null";

const char *PUMP_test_json(void)
{
    int p = t_on[0] ? 0 : t_on[1] ? 1 : t_last;       /* a running pump first, else the last one */
    if (p < 0) return "null";
    if (t_on[p]) snprintf(t_json, sizeof(t_json), "{\"pot\":\"%c\",\"on\":1,\"s\":%.2f}", p ? 'B' : 'A', (millis() - t_start[p]) / 1000.0f);
    else snprintf(t_json, sizeof(t_json), "{\"pot\":\"%c\",\"on\":0,\"s\":%.3f}", p ? 'B' : 'A', t_last_s[p]);
    return t_json;
}

void    PUMP_stop_all(void)
{
    for (int p = 0; p < 2; p++)
    {
        t_timer[p].detach();
    }
    RELAY_all_off();
    for (int p = 0; p < 2; p++)
    {
        if (t_on[p]) { t_end[p] = millis(); PUMP_test_report(p, "stopped"); }
    }
    running = b_running = false;
}
