// Farm Hand part 1: ESP32 + ONE soil probe. Just read it and print it.
// Real build: probe VCC -> 3V3, GND -> GND, AOUT -> pin 32. (In Wokwi the knob stands in for the probe.)
const int SOIL = 32;
void setup() { Serial.begin(115200); analogReadResolution(12); }
void loop() {
  int raw = analogRead(SOIL);                 // real probe: ~3000 in dry air, ~1300 in water
  Serial.printf("soil raw: %d\n", raw);
  delay(1000);
}
