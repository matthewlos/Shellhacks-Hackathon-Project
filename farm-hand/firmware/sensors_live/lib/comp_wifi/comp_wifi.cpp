#include "comp_wifi.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_wpa2.h"
#include "ca_usertrust.h"
#include <WiFiClientSecure.h>

#include "secrets.h"            /* include/secrets.h: WIFI_SSID, WIFI_ENTERPRISE, WIFI_USER, WIFI_PASSWORD (never committed) */

/*
* Joins WiFi (eduroam-style WPA2-Enterprise PEAP, or a normal password network) and checks the internet by
* asking Google's 204 page. Never blocks the reading loop: it starts the join and checks back every 10 s.
* Status line over serial: {"type":"wifi","state":"online","ip":"..","rssi":-60,"net":204}
*/

#define WIFI_CHECK_MS 10000

static unsigned long last_check = 0;
static bool online = false;
static int  net_code = 0;
static int  last_reason = 0;               /* why the last attempt failed (ESP-IDF wifi_err_reason_t, e.g. 15/204 = login rejected) */
static int  style = 0;                     /* which enterprise login style is being tried (rotates until one works) */

#if WIFI_ENTERPRISE
/* Login setups tried in turn (martinius96/ESP32-eduroam method: anonymous outer identity, real inner username):
*   0 eduroam  PEAP  anonymous@realm  + UCF root CA
*   1 eduroam  PEAP  anonymous@realm  no CA
*   2 UCF_WPA2 PEAP  anonymous@realm  + UCF root CA   (UCF's own network, same login)
*   3 eduroam  TTLS/MSCHAPv2 anonymous@realm  no CA
*/
#define STYLE_COUNT 4
static const char *style_name[STYLE_COUNT] = {"eduroam_peap_ca", "eduroam_peap", "ucf_wpa2_peap_ca", "eduroam_ttls"};
static const char *style_ssid[STYLE_COUNT] = {WIFI_SSID, WIFI_SSID, "UCF_WPA2", WIFI_SSID};
static String realm_anon(void)
{
    String u = WIFI_USER;
    int at = u.indexOf('@');
    return (at >= 0) ? "anonymous" + u.substring(at) : u;
}
#endif

static void WIFI_on_event(WiFiEvent_t event, WiFiEventInfo_t info)
{
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED)
    {
        last_reason = info.wifi_sta_disconnected.reason;
    }
}

static void WIFI_join(void)
{
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA);
#if WIFI_ENTERPRISE
    String outer = realm_anon();
    esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)outer.c_str(), outer.length());
    esp_wifi_sta_wpa2_ent_set_username((uint8_t *)WIFI_USER, strlen(WIFI_USER));
    esp_wifi_sta_wpa2_ent_set_password((uint8_t *)WIFI_PASSWORD, strlen(WIFI_PASSWORD));
    esp_wifi_sta_wpa2_ent_set_disable_time_check(true);          /* no clock before we're online */
    if (style == 0 || style == 2)
    {
        esp_wifi_sta_wpa2_ent_set_ca_cert((const unsigned char *)ca_usertrust_pem, sizeof(ca_usertrust_pem));
    }
    else
    {
        esp_wifi_sta_wpa2_ent_clear_ca_cert();
    }
    if (style == 3)
    {
        esp_wifi_sta_wpa2_ent_set_ttls_phase2_method(ESP_EAP_TTLS_PHASE2_MSCHAPV2);
    }
    esp_wifi_sta_wpa2_ent_enable();
    WiFi.begin(style_ssid[style]);
#else
    if (strlen(WIFI_PASSWORD) == 0)
    {
        WiFi.begin(WIFI_SSID);                                  /* open network (may have a login page) */
    }
    else
    {
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
#endif
}

static void WIFI_report(void)
{
    const char *state = online ? "online" : (WiFi.status() == WL_CONNECTED ? "joined_no_internet" : "connecting");
#if WIFI_ENTERPRISE
    const char *how = style_name[style];
#else
    const char *how = "password";
#endif
    Serial.printf("{\"type\":\"wifi\",\"ssid\":\"%s\",\"login\":\"%s\",\"state\":\"%s\",\"status\":%d,\"reason\":%d,\"ip\":\"%s\",\"rssi\":%d,\"net\":%d}\n",
#if WIFI_ENTERPRISE
                  style_ssid[style],
#else
                  WIFI_SSID,
#endif
                  how, state, (int)WiFi.status(), last_reason, WiFi.localIP().toString().c_str(), WiFi.RSSI(), net_code);
}

static const char *auth_name(wifi_auth_mode_t a)
{
    switch (a)
    {
        case WIFI_AUTH_OPEN:            return "open (may have a login page)";
        case WIFI_AUTH_WEP:             return "wep";
        case WIFI_AUTH_WPA_PSK:
        case WIFI_AUTH_WPA2_PSK:
        case WIFI_AUTH_WPA_WPA2_PSK:    return "password";
        case WIFI_AUTH_WPA2_ENTERPRISE: return "school login (enterprise)";
        case WIFI_AUTH_WPA3_PSK:
        case WIFI_AUTH_WPA2_WPA3_PSK:   return "password (wpa3)";
        default:                        return "other";
    }
}

void    WIFI_scan(void)
{
    WiFi.mode(WIFI_STA);
    int n = WiFi.scanNetworks(false, true);
    Serial.printf("{\"type\":\"scan\",\"count\":%d,\"nets\":[", n);
    for (int i = 0; i < n; i++)
    {
        String ssid = WiFi.SSID(i);
        ssid.replace("\"", "'");
        Serial.printf("%s{\"ssid\":\"%s\",\"rssi\":%d,\"ch\":%d,\"auth\":\"%s\"}", i ? "," : "",
                      ssid.length() ? ssid.c_str() : "(hidden)", WiFi.RSSI(i), WiFi.channel(i), auth_name(WiFi.encryptionType(i)));
    }
    Serial.println("]}");
    WiFi.scanDelete();
}

/* Print a page as "PORTAL|<step>|<line>" lines, so the laptop can read exactly what the login page asks for */
static void WIFI_dump(const char *step, String body)
{
    int start = 0;
    while (start < (int)body.length() && start < 12000)
    {
        int end = body.indexOf('\n', start);
        if (end < 0) end = body.length();
        Serial.printf("PORTAL|%s|%s\n", step, body.substring(start, end).c_str());
        start = end + 1;
    }
}

/* Joined an open network but no internet: follow the redirect to the login page and print it (once per boot) */
static void WIFI_probe_portal(void)
{
    static bool done = false;
    if (done) return;
    done = true;

    const char *keys[] = {"Location", "Set-Cookie"};
    HTTPClient http;
    http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    http.setTimeout(5000);
    http.begin("http://connectivitycheck.gstatic.com/generate_204");
    http.collectHeaders(keys, 2);
    int code = http.GET();
    String loc = http.header("Location");
    Serial.printf("PORTAL|probe|code=%d location=%s cookie=%s\n", code, loc.c_str(), http.header("Set-Cookie").c_str());
    WIFI_dump("probe_body", http.getString());
    http.end();

    /* follow up to 4 redirects, http or https (portal certs aren't checked: we only read the page) */
    for (int hop = 0; hop < 4 && loc.length(); hop++)
    {
        HTTPClient h2;
        WiFiClientSecure tls;
        tls.setInsecure();
        h2.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
        h2.setTimeout(8000);
        h2.setUserAgent("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15");
        if (loc.startsWith("https")) h2.begin(tls, loc); else h2.begin(loc);
        h2.collectHeaders(keys, 2);
        int c2 = h2.GET();
        String next = h2.header("Location");
        if (next.startsWith("/"))
        {
            int slash = loc.indexOf('/', 8);
            next = loc.substring(0, slash < 0 ? loc.length() : slash) + next;
        }
        Serial.printf("PORTAL|hop%d|code=%d url=%s next=%s cookie=%s\n", hop, c2, loc.c_str(), next.c_str(), h2.header("Set-Cookie").c_str());
        char step[12];
        snprintf(step, sizeof(step), "hop%d_body", hop);
        WIFI_dump(step, h2.getString());
        h2.end();
        loc = next;
    }
    Serial.println("PORTAL|end|");
}

StatusCode_e    WIFI_init(void)
{
    WIFI_scan();
    WiFi.onEvent(WIFI_on_event);
    WIFI_join();
    last_check = millis();

    return STATUS_OK;
}

void    WIFI_update(void)
{
    if (millis() - last_check < WIFI_CHECK_MS)
    {
        return;
    }
    last_check = millis();

    if (WiFi.status() != WL_CONNECTED)
    {
        online = false;
        net_code = 0;
        WIFI_report();
        static int tries = 0;
        if (++tries % 3 == 0)           /* no join after 30 s: try the next login style */
        {
#if WIFI_ENTERPRISE
            style = (style + 1) % STYLE_COUNT;
#endif
            WIFI_join();
        }
        return;
    }

    HTTPClient http;
    http.setTimeout(3000);
    http.begin("http://connectivitycheck.gstatic.com/generate_204");
    net_code = http.GET();
    http.end();
    online = (net_code == 204);
    WIFI_report();
    if (!online)
    {
        WIFI_probe_portal();
    }
}

bool    WIFI_online(void)
{
    return online;
}

const char *    WIFI_label(void)
{
    if (online)
    {
        return "wifi ok";
    }
    return (WiFi.status() == WL_CONNECTED) ? "wifi.." : "no wifi";
}
