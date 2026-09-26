// Sensors test: soil probe on pin 32 + DS18B20 temp probe on pin 4, once a second. Pump stays OFF (pin 26 LOW).
// Prints {"type":"sens","ms":..,"soil_raw":N,"probes":N,"temp_c":X}. Soil: ~3400 dry air, ~1500 in water.
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire ow(4);
DallasTemperature ds(&ow);
void setup() { Serial.begin(115200); pinMode(26, OUTPUT); digitalWrite(26, LOW); analogReadResolution(12); ds.begin(); }
void loop() {
  long s = 0; for (int i = 0; i < 16; i++) s += analogRead(32);
  int n = ds.getDeviceCount();
  if (n == 0) { ds.begin(); n = ds.getDeviceCount(); }
  ds.requestTemperatures();
  Serial.printf("{\"type\":\"sens\",\"ms\":%lu,\"soil_raw\":%ld,\"probes\":%d,\"temp_c\":%.2f}\n", millis(), s / 16, n, ds.getTempCByIndex(0));
  delay(1000);
}
