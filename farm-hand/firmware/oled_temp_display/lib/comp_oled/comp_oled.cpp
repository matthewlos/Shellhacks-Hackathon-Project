#include "comp_oled.h"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

StatusCode_e    OLED_init(void)
{
    Wire.begin(OLED_SDA, OLED_SCL);

    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("OLED nao encontrado");
        while (true);
    }

    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);

    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Hello!");

    display.setTextSize(1);
    display.setCursor(0, 30);
    display.println("ESP32 OLED");

    display.display();

    return STATUS_OK;
}

StatusCode_e    OLED_update(float temperature)
{
    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);

    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Temp: " + String(temperature) + " C");

    display.display();

    return STATUS_OK;
}