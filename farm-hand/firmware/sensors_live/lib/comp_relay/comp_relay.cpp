#include "comp_relay.h"

/* PN2222 driver: LOW on the pin = transistor off = relay off = pump off */

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
    digitalWrite(RELAY_A_PIN, LOW);
    digitalWrite(RELAY_B_PIN, LOW);
    state[0] = state[1] = false;
}

void    RELAY_set(int pump, bool on)
{
    if (pump != 0 && pump != 1) return;
    digitalWrite(pump == 0 ? RELAY_A_PIN : RELAY_B_PIN, on ? HIGH : LOW);
    state[pump] = on;
}

bool    RELAY_is_on(int pump)
{
    return (pump == 0 || pump == 1) ? state[pump] : false;
}