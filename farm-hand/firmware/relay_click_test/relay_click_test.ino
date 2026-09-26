// Relay bring-up: flip pin 26 every 2 s forever and say which level it is on.
// The relay should click every 2 s whichever way its LOW/HIGH jumper is set.
const int RELAY = 26;
void setup() { Serial.begin(115200); pinMode(RELAY, OUTPUT); }
void loop() {
  digitalWrite(RELAY, LOW);  Serial.println("pin 26 = LOW  (0 V)");   delay(2000);
  digitalWrite(RELAY, HIGH); Serial.println("pin 26 = HIGH (3.3 V)"); delay(2000);
}
