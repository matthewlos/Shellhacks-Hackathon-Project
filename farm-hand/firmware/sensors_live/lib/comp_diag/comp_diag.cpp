#include "comp_diag.h"

#include <Wire.h>
#include <OneWire.h>

/*
* Wiring check, printed as one JSON line: {"type":"diag", ...}
*   i2c      devices answering on SDA 21 / SCL 22, and with the two wires swapped
*   adc      raw value on every ADC1 pin (a connected soil probe reads ~1500-3400; a loose pin reads near 0)
*   onewire  pins where a DS18B20 answers a reset pulse
* Relay pins (26, 27) are never touched.
*/

static const int adc_pins[]     = {32, 33, 34, 35, 36, 39};
static const int onewire_pins[] = {2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 23, 25, 32, 33};

static void DIAG_i2c(int sda, int scl, const char *label)
{
    Wire.end();
    Wire.begin(sda, scl);
    Wire.setTimeOut(20);
    Serial.printf("\"%s\":[", label);
    bool first = true;
    for (uint8_t a = 1; a < 127; a++)
    {
        Wire.beginTransmission(a);
        if (Wire.endTransmission() == 0)
        {
            Serial.printf("%s\"0x%02X\"", first ? "" : ",", a);
            first = false;
        }
    }
    Serial.print("]");
}

void    DIAG_run(void)
{
    Serial.print("{\"type\":\"diag\",");
    DIAG_i2c(OLED_SDA, OLED_SCL, "i2c_21_22");
    Serial.print(",");
    DIAG_i2c(OLED_SCL, OLED_SDA, "i2c_swapped");
    Wire.end();
    Wire.begin(OLED_SDA, OLED_SCL);                       /* back to the real wiring for the screen */
    Wire.setTimeOut(50);

    Serial.print(",\"adc\":{");
    for (size_t i = 0; i < sizeof(adc_pins) / sizeof(adc_pins[0]); i++)
    {
        Serial.printf("%s\"%d\":%d", i ? "," : "", adc_pins[i], analogRead(adc_pins[i]));
    }

    Serial.print("},\"onewire\":[");
    bool first = true;
    for (size_t i = 0; i < sizeof(onewire_pins) / sizeof(onewire_pins[0]); i++)
    {
        OneWire ow(onewire_pins[i]);
        int found = 0;
        uint8_t rom[8];
        ow.reset_search();
        while (ow.search(rom) && found < 8)
        {
            found++;
        }
        if (found)
        {
            Serial.printf("%s{\"pin\":%d,\"probes\":%d}", first ? "" : ",", onewire_pins[i], found);
            first = false;
        }
    }
    Serial.println("]}");
}
