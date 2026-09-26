#include "comp_oled.h"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

static bool found = false;

StatusCode_e    OLED_init(void)
{
    Wire.begin(OLED_SDA, OLED_SCL);
    Wire.setTimeOut(50);

    /* Ask the bus first: with no screen (and no pull-ups) begin() can stall, so skip the screen instead */
    Wire.beginTransmission(OLED_ADDR);
    if (Wire.endTransmission() != 0)
    {
        return STATUS_ERR_OLED_NOT_FOUND;
    }

    found = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
    if (!found) 
    {
        return STATUS_ERR_OLED_NOT_FOUND;
    }

    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);

    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Farm Hand");

    display.setTextSize(1);
    display.setCursor(0, 24);
    display.println("sensor test");
    display.setCursor(0, 40);
    display.println("pumps are off");

    display.display();

    return STATUS_OK;
}

/* Size 1 text: 21 characters a line, so every line fits the 128 px screen */
StatusCode_e    OLED_update(const SoilReading_t *soil, const TempReading_t *temp)
{
    /* The screen can come up after the ESP32 (it's on the other power supply): keep asking */
    static unsigned long last_try = 0;
    if (!found)
    {
        if (millis() - last_try < 5000 || (last_try = millis(), OLED_init() != STATUS_OK))
        {
            return STATUS_ERR_OLED_NOT_FOUND;
        }
    }

    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);

    display.setCursor(0, 0);
    display.print("FARM HAND   live");
    display.drawFastHLine(0, 10, SCREEN_WIDTH, SSD1306_WHITE);

    display.setCursor(0, 15);
    display.printf("Soil A %5.1f%% %4d", soil->pct[0], soil->raw[0]);
    display.setCursor(0, 27);
    display.printf("Soil B %5.1f%% %4d", soil->pct[1], soil->raw[1]);

    for (int i = 0; i < TEMP_MAX; i++)
    {
        display.setCursor(0, 39 + 12 * i);
        if (i < temp->count && temp->ok[i])
        {
            display.printf("Temp %d %5.1f C", i + 1, temp->celsius[i]);
        }
        else
        {
            display.printf("Temp %d  no probe", i + 1);
        }
    }

    display.display();

    return STATUS_OK;
}