/* Copy to secrets.h (git ignores it) and fill in. */
#ifndef SECRETS_H
#define SECRETS_H

#define WIFI_SSID       "eduroam"
#define WIFI_ENTERPRISE 1                       /* 1 = eduroam-style login (user + password), 0 = normal WiFi password */
#define WIFI_USER       "you@school.edu"        /* ignored when WIFI_ENTERPRISE is 0 */
#define WIFI_PASSWORD   "your password"

/* Farm Hand home server: where the ESP32 posts readings, and the token it sends (same as the server's .env) */
#define FARMHAND_URL    "https://your-server.example/farmhand/reading"
#define FARMHAND_TOKEN  "long random token"

#endif
