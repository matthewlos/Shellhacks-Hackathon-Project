#include "comp_cmd.h"
#include "comp_pump.h"
#include "comp_relay.h"

static char line[40];
static size_t len = 0;

static void CMD_run(char *c)
{
    char pot = 0;
    float s = 0;
    if (sscanf(c, "pump %c %f", &pot, &s) == 2 && (pot == 'A' || pot == 'a' || pot == 'B' || pot == 'b'))
    {
        PUMP_test((pot == 'B' || pot == 'b') ? 1 : 0, s);
    }
    else if (!strcmp(c, "stop"))
    {
        PUMP_stop_all();
        Serial.println("{\"type\":\"cmd\",\"ok\":\"both pumps off\"}");
    }
    else if (!strcmp(c, "relay low") || !strcmp(c, "relay high"))
    {
        RELAY_set_on_level(!strcmp(c, "relay high") ? HIGH : LOW);
        Serial.printf("{\"type\":\"cmd\",\"ok\":\"relay on level %s, saved\"}\n", RELAY_on_level() ? "HIGH" : "LOW");
    }
    else
    {
        Serial.printf("{\"type\":\"cmd\",\"error\":\"unknown: %s\"}\n", c);
    }
}

void    CMD_update(void)
{
    while (Serial.available())
    {
        char ch = Serial.read();
        if (ch == '\n' || ch == '\r')
        {
            if (len) { line[len] = 0; CMD_run(line); len = 0; }
        }
        else if (len < sizeof(line) - 1)
        {
            line[len++] = ch;
        }
    }
}
