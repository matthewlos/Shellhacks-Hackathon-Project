// Farm Hand wiring sim (Wokwi). NOT the hackathon code, just to see the wiring work.
//   Knob A / Knob B = fake soil sensors (turn right = drier, like the real probe: dry reads HIGH)
//   Blue LED = Pump A (AI pot, waters when dry)   Cyan LED = Pump B (dumb timer pot)
// Real hardware: set RELAY_ACTIVE_LOW true (your relays turn on with LOW). Wokwi's relay turns on with HIGH.

#include <OneWire.h>
#include <DallasTemperature.h>

const bool RELAY_ACTIVE_LOW = false;   // true on the real board

const int PIN_SOIL_A = 32, PIN_SOIL_B = 33;   // ADC1 pins only (ADC2 dies when WiFi is on)
const int PIN_TEMP = 4;
const int PIN_PUMP_A = 26, PIN_PUMP_B = 27;

const int  DRY_RAW = 2800;                 // above this = dry, water it (calibrate per probe on real parts)
const unsigned long PUMP_MS = 3000;        // one watering
const unsigned long PUMP_CAP_MS = 30000;   // hard safety cap: pump never runs longer than 30 s
const unsigned long TIMER_EVERY_MS = 20000;// Pot B waters on a fixed timer, no matter the soil

OneWire oneWire(PIN_TEMP);
DallasTemperature temp(&oneWire);

void pump(int pin, bool on) {
  digitalWrite(pin, (on != RELAY_ACTIVE_LOW) ? HIGH : LOW);
}

void water(int pin, const char *name, unsigned long ms) {
  ms = min(ms, PUMP_CAP_MS);
  Serial.printf(">>> %s ON for %lu ms\n", name, ms);
  pump(pin, true);
  delay(ms);
  pump(pin, false);
  Serial.printf(">>> %s OFF\n", name);
  delay(5000);   // never both pumps at once: brownout guard
}

int readSoil(int pin) {
  long sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(pin);
  return sum / 16;
}

unsigned long lastTimer = 0;

void setup() {
  Serial.begin(115200);
  // set OFF level BEFORE making them outputs, so pumps don't blip on at boot
  digitalWrite(PIN_PUMP_A, RELAY_ACTIVE_LOW ? HIGH : LOW);
  digitalWrite(PIN_PUMP_B, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pinMode(PIN_PUMP_A, OUTPUT);
  pinMode(PIN_PUMP_B, OUTPUT);
  analogReadResolution(12);
  temp.begin();
  Serial.println("Farm Hand sim up. Turn Knob A right to dry out Pot A.");
}

void loop() {
  int a = readSoil(PIN_SOIL_A), b = readSoil(PIN_SOIL_B);
  temp.requestTemperatures();
  float c = temp.getTempCByIndex(0);
  Serial.printf("soilA=%d %s | soilB=%d | temp=%.1fC\n", a, a > DRY_RAW ? "DRY" : "ok", b, c);

  if (a > DRY_RAW) water(PIN_PUMP_A, "Pump A (AI pot)", PUMP_MS);
  if (millis() - lastTimer > TIMER_EVERY_MS) { lastTimer = millis(); water(PIN_PUMP_B, "Pump B (timer pot)", PUMP_MS); }
  delay(1000);
}
