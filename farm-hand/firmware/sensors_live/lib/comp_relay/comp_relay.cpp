#include "comp_relay.h"

/* RELAY_ON_LEVEL on the pin = relay on = pump on (sys_pinout.h) */

StatusCode_e    RELAY_init(void)
{
    pinMode(RELAY_A_PIN, OUTPUT);
    pinMode(RELAY_B_PIN, OUTPUT);
    RELAY_all_off();

    return STATUS_OK;
}

static bool state[2] = {false, false};

void    RELAY_all_off(void)
{
    digitalWrite(RELAY_A_PIN, !RELAY_ON_LEVEL);
    digitalWrite(RELAY_B_PIN, !RELAY_ON_LEVEL);
    state[0] = state[1] = false;
}

void    RELAY_set(int pump, bool on)
{
    if (pump != 0 && pump != 1) return;
    digitalWrite(pump == 0 ? RELAY_A_PIN : RELAY_B_PIN, on ? RELAY_ON_LEVEL : !RELAY_ON_LEVEL);
    state[pump] = on;
}

bool    RELAY_is_on(int pump)
{
    return (pump == 0 || pump == 1) ? state[pump] : false;
}