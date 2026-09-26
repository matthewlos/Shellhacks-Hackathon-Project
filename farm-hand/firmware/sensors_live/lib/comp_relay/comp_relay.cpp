#include "comp_relay.h"

/* PN2222 driver: LOW on the pin = transistor off = relay off = pump off */

StatusCode_e    RELAY_init(void)
{
    pinMode(RELAY_A_PIN, OUTPUT);
    pinMode(RELAY_B_PIN, OUTPUT);
    RELAY_all_off();

    return STATUS_OK;
}

void    RELAY_all_off(void)
{
    digitalWrite(RELAY_A_PIN, LOW);
    digitalWrite(RELAY_B_PIN, LOW);
}