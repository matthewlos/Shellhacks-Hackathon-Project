// Temp probe test: reads the DS18B20 on pin 4 once a second. Pump stays OFF (pin 26 LOW = transistor off).
// Prints {"type":"temp","ms":..,"probes":N,"temp_c":X}. probes 0 = not found; -127 = lost; 85.00 = bad power.
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire ow(4);
DallasTemperature ds(&ow);
void setup() { Serial.begin(115200); pinMode(26, OUTPUT); digitalWrite(26, LOW); ds.begin(); }
void loop() {
  int n = ds.getDeviceCount();
  if (n == 0) { ds.begin(); n = ds.getDeviceCount(); }
  ds.requestTemperatures();
  float c = ds.getTempCByIndex(0);
  Serial.printf("{\"type\":\"temp\",\"ms\":%lu,\"probes\":%d,\"temp_c\":%.2f}\n", millis(), n, c);
  delay(1000);
}
