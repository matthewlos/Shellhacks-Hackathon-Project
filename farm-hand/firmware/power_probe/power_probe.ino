// Power probe: the ESP32 as a 2-channel voltmeter + relay flipper, for finding where power stops.
// Probe A = D34, probe B = D35 (input-only pins, safe). Touch a probe wire's free pin to any spot in the circuit.
// ESP32 inputs top out at ~3.1 V, so anything 5 V shows as "3100+" (= power is there). 0 = no power / ground.
// Pin 26 (relay IN) still flips every 2 s so you can watch NO switch.
const int RELAY = 26, PA = 34, PB = 35;
unsigned long lastFlip = 0; bool on = false;
void setup() { Serial.begin(115200); pinMode(RELAY, OUTPUT); analogSetAttenuation(ADC_11db); }
void loop() {
  if (millis() - lastFlip >= 2000) { lastFlip = millis(); on = !on; digitalWrite(RELAY, on ? LOW : HIGH); }
  long a = 0, b = 0; for (int i = 0; i < 16; i++) { a += analogReadMilliVolts(PA); b += analogReadMilliVolts(PB); }
  Serial.printf("{\"type\":\"probe\",\"ms\":%lu,\"relay_in\":\"%s\",\"a_mv\":%ld,\"b_mv\":%ld}\n", millis(), on ? "LOW" : "HIGH", a / 16, b / 16);
  delay(200);
}
