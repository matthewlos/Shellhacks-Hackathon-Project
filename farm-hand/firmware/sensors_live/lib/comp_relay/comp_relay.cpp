#include "comp_relay.h"

#include <Preferences.h>

/* on_level on the pin = relay on = pump on. Default RELAY_ON_LEVEL (sys_pinout.h); the USB command
   "relay low" / "relay high" changes it and keeps it in flash, so a low-trigger module needs no reflash.
   Low-trigger 5V modules: a 3.3 V "high" still lights their input LED, so the relay never lets go.
   There, off = release the pin (input, the module's own pull-up to 5 V holds it off) and on = drive it LOW. */
static int on_level = RELAY_ON_LEVEL;
static bool state[2] = {false, false};

static void RELAY_drive(int pin, bool on)
{
    if (on_level == LOW)
    {
        if (on) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
        else    { pinMode(pin, INPUT); }
    }
    else
    {
        digitalWrite(pin, on ? HIGH : LOW);
        pinMode(pin, OUTPUT);
    }
}

StatusCode_e    RELAY_init(void)
{
    Preferences prefs;
    prefs.begin("relay", true);
    on_level = prefs.getInt("on", RELAY_ON_LEVEL);
    prefs.end();

    RELAY_all_off();

    return STATUS_OK;
}

void    RELAY_all_off(void)
{
    RELAY_drive(RELAY_A_PIN, false);
    RELAY_drive(RELAY_B_PIN, false);
    state[0] = state[1] = false;
}

void    RELAY_set(int pump, bool on)
{
    if (pump != 0 && pump != 1) return;
    RELAY_drive(pump == 0 ? RELAY_A_PIN : RELAY_B_PIN, on);
    state[pump] = on;
}

bool    RELAY_is_on(int pump)
{
    return (pump == 0 || pump == 1) ? state[pump] : false;
}

void    RELAY_set_on_level(int level)
{
    on_level = level ? HIGH : LOW;
    Preferences prefs;
    prefs.begin("relay", false);
    prefs.putInt("on", on_level);
    prefs.end();
    RELAY_all_off();
}

int     RELAY_on_level(void)
{
    return on_level;
}
