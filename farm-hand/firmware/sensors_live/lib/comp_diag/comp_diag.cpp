#include "comp_diag.h"

#include <Wire.h>
#include <OneWire.h>

/*
* Wiring check, printed as one JSON line: {"type":"diag", ...}
*   i2c      devices answering on SDA 21 / SCL 22, and with the two wires swapped
*   adc      raw value on every ADC1 pin (a connected soil probe reads ~1500-3400; a loose pin reads near 0)
*   onewire  pins where a DS18B20 answers a reset pulse
* Relay pins (13, 22) are never touched.
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
    Serial.print("{\"type\":\"diag\"");

    /* The I2C scan runs once at boot only: re-scanning (and the swapped-pin scan) while the screen is
       drawing blanked it every 10 s. Screen is off on the soldered board (USE_OLED). */
    static bool i2c_done = true;       /* off: with the screen unpowered, a full scan freezes the board for minutes */
    if (!i2c_done)
    {
        Serial.print(",");
        DIAG_i2c(OLED_SDA, OLED_SCL, "i2c");
        Wire.end();
        Wire.begin(OLED_SDA, OLED_SCL);
        Wire.setTimeOut(50);
        i2c_done = true;
    }

    Serial.print(",\"adc\":{");
    for (size_t i = 0; i < sizeof(adc_pins) / sizeof(adc_pins[0]); i++)
    {
        Serial.printf("%s\"%d\":%d", i ? "," : "", adc_pins[i], analogRead(adc_pins[i]));
    }

    /* The one-wire pin scan is off: searching 15 pins froze the sensor loop for seconds. Temps are on D21 and D4. */
    Serial.println("}}");
}
