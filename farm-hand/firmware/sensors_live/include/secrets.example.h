/* Copy to secrets.h (git ignores it) and fill in. */
#ifndef SECRETS_H
#define SECRETS_H

#define WIFI_SSID       "eduroam"
#define WIFI_ENTERPRISE 1                       /* 1 = eduroam-style login (user + password), 0 = normal WiFi password */
#define WIFI_USER       "you@school.edu"        /* ignored when WIFI_ENTERPRISE is 0 */
#define WIFI_PASSWORD   "your password"

#endif
