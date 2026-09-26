// Farm Hand ESP32 firmware.
// The chip does NO AI. It reads the soil, runs the pumps when told, and enforces the safety rules.
// The laptop talks to it over USB serial (115200). Every line the chip prints is one JSON object.
//
// Wiring (PLAN.md section 2, pictures at http://127.0.0.1:8097/assemble). One pot, all on USB power:
//   Soil A  AOUT -> 32 (VCC 3V3, GND GND). ADC1 pins only. Pin 33 (pot B) is empty: ONE_POT on the laptop ignores it.
//   DS18B20 via the adapter board (pull-up built in): DAT -> 4, VCC -> 3V3, GND -> GND.
//   Relay: DC+ -> VIN, DC- -> GND, jumper on L. IN is driven by a PN2222 (E -> GND, B -> 1K -> pin 26, C -> IN),
//     so pin 26 HIGH = relay on. Relay DC+ -> COM, NO -> pump red, pump black -> DC-.
//   Proven 2026-09-23: a 10 s pour on USB power, no brownout.
//
// Commands from the laptop (one per line):
//   P A 3000     pour pot A for 3000 ms (capped at 30000)
//   T 21600 5000 pot B timer: every 21600 s pour 5000 ms   (T 0 = timer off)
//   S            print a reading now
//   X            emergency stop both pumps

#include <OneWire.h>
#include <DallasTemperature.h>

#define SIM 0                          // 1 in Wokwi: its relay turns on with HIGH
const bool RELAY_ACTIVE_LOW = false;   // transistor driver (PN2222 on D26, jumper on L): HIGH = relay on

const int PIN_SOIL[2] = {32, 33};
const int PIN_PUMP[2] = {26, 27};
const int PIN_TEMP = 4;
const char POT_NAME[2] = {'A', 'B'};

// CALIBRATE on Sep 23: raw number with the probe in dry air, and in a cup of water (only up to the line).
int RAW_AIR[2]   = {3400, 3400};   // measured 2026-09-23 on the real probe
int RAW_WATER[2] = {1507, 1507};

const unsigned long PUMP_CAP_MS = 30000;   // a pump can never run longer than this in one go
const unsigned long PUMP_GAP_MS = 5000;    // wait between pours: never both pumps at once (brownout)
const unsigned long REPORT_MS   = 1000;    // 1 reading a second: the live view + pour detector need it

unsigned long timerEveryMs = 6UL * 3600UL * 1000UL;   // pot B default: every 6 h
unsigned long timerPourMs  = 5000;                    // for 5 s
unsigned long lastTimerAt  = 0;
bool timerPending = false;

int activePot = -1;                // which pump is running, -1 = none
unsigned long pourStart = 0, pourMs = 0, lastPourEnd = 0, lastReport = 0;
String pourBy = "";

OneWire oneWire(PIN_TEMP);
DallasTemperature temp(&oneWire);
String line;

void pumpWrite(int pot, bool on) {
  digitalWrite(PIN_PUMP[pot], (on != RELAY_ACTIVE_LOW) ? HIGH : LOW);
}

int readRaw(int pot) {
  long sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(PIN_SOIL[pot]);
  return sum / 16;
}

// probe reads HIGH when dry, LOW when wet -> 0% = air, 100% = cup of water
int pct(int pot, int raw) {
  long p = (long)(RAW_AIR[pot] - raw) * 100 / (RAW_AIR[pot] - RAW_WATER[pot]);
  return constrain(p, 0, 100);
}

void report() {
  // read the conversion started LAST report, then start the next one. Non-blocking: a real DS18B20
  // takes ~750 ms per conversion, and blocking here would let pours overrun the 30 s cap.
  float c = temp.getTempCByIndex(0);
  temp.requestTemperatures();
  int ra = readRaw(0), rb = readRaw(1);
  Serial.printf("{\"type\":\"reading\",\"ms\":%lu,\"a_raw\":%d,\"b_raw\":%d,\"a_pct\":%d,\"b_pct\":%d,\"temp_c\":%s,\"pumping\":\"%s\"}\n",
                millis(), ra, rb, pct(0, ra), pct(1, rb),
                c < -100 ? "null" : String(c, 1).c_str(),
                activePot < 0 ? "none" : (activePot == 0 ? "A" : "B"));
}

bool startPour(int pot, unsigned long ms, const char *by) {
  if (activePot >= 0) { Serial.printf("{\"type\":\"refused\",\"pot\":\"%c\",\"why\":\"busy\"}\n", POT_NAME[pot]); return false; }
  if (millis() - lastPourEnd < PUMP_GAP_MS && lastPourEnd != 0) { Serial.printf("{\"type\":\"refused\",\"pot\":\"%c\",\"why\":\"gap\"}\n", POT_NAME[pot]); return false; }
  ms = min(ms, PUMP_CAP_MS);
  activePot = pot; pourStart = millis(); pourMs = ms; pourBy = by;
  pumpWrite(pot, true);
  Serial.printf("{\"type\":\"pour_start\",\"pot\":\"%c\",\"ms\":%lu,\"by\":\"%s\"}\n", POT_NAME[pot], ms, by);
  return true;
}

void stopPour(const char *why) {
  if (activePot < 0) return;
  pumpWrite(activePot, false);
  unsigned long ran = millis() - pourStart;
  Serial.printf("{\"type\":\"pour_done\",\"pot\":\"%c\",\"ran_ms\":%lu,\"by\":\"%s\",\"why\":\"%s\"}\n",
                POT_NAME[activePot], ran, pourBy.c_str(), why);
  activePot = -1; lastPourEnd = millis();
}

void handle(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  char c = cmd[0];
  if (c == 'P') {                                   // P A 3000
    int pot = (cmd.length() > 2 && cmd[2] == 'B') ? 1 : 0;
    unsigned long ms = cmd.substring(4).toInt();
    if (ms == 0) { Serial.println("{\"type\":\"error\",\"why\":\"usage: P A 3000\"}"); return; }
    startPour(pot, ms, "laptop");
  } else if (c == 'T') {                            // T 21600 5000
    int sp = cmd.indexOf(' ', 2);
    unsigned long every = cmd.substring(2, sp < 0 ? cmd.length() : sp).toInt();
    timerEveryMs = every * 1000UL;
    if (sp > 0) timerPourMs = cmd.substring(sp + 1).toInt();
    lastTimerAt = millis();
    timerPending = false;   // T 0 cancels a pour that was already waiting
    Serial.printf("{\"type\":\"timer\",\"every_s\":%lu,\"pour_ms\":%lu}\n", every, timerPourMs);
  } else if (c == 'S') {
    report();
  } else if (c == 'X') {
    stopPour("emergency_stop");
    pumpWrite(0, false); pumpWrite(1, false);
  } else {
    Serial.println("{\"type\":\"error\",\"why\":\"unknown command\"}");
  }
}

void setup() {
  // OFF level first, THEN make them outputs, so the pumps don't blip at boot
  for (int i = 0; i < 2; i++) { pumpWrite(i, false); pinMode(PIN_PUMP[i], OUTPUT); pumpWrite(i, false); }
  Serial.begin(115200);
  analogReadResolution(12);
  temp.begin();
  temp.setWaitForConversion(false);   // never block the loop waiting on the temp probe
  temp.requestTemperatures();
  lastTimerAt = millis();
  Serial.printf("{\"type\":\"boot\",\"fw\":\"farm-hand-1\",\"sim\":%d,\"probes\":%d}\n", SIM, temp.getDeviceCount());
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') { handle(line); line = ""; } else if (ch != '\r') line += ch;
  }
  if (activePot >= 0 && millis() - pourStart >= pourMs) stopPour("time_up");
  if (activePot >= 0 && millis() - pourStart >= PUMP_CAP_MS) stopPour("safety_cap");

  if (timerEveryMs > 0 && millis() - lastTimerAt >= timerEveryMs) { timerPending = true; lastTimerAt = millis(); }
  // timer waits quietly until the pump is free and the gap has passed (no refused spam)
  bool pumpFree = activePot < 0 && (lastPourEnd == 0 || millis() - lastPourEnd >= PUMP_GAP_MS);
  if (timerPending && pumpFree && startPour(1, timerPourMs, "timer")) timerPending = false;

  if (millis() - lastReport >= REPORT_MS) { lastReport = millis(); report(); }
  delay(10);
}
