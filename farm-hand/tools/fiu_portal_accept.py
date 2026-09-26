"""Get the ESP32 past FIU_WiFi's "accept" page (Cisco ISE guest portal), from the laptop.

The ESP32 joins FIU_WiFi (open), finds the portal and prints its link over USB as
    PORTAL|probe|code=200 location=https://psn07.ise.nic.fiu.edu:8455/portal/gateway?sessionId=...
That link carries the ESP32's own session, so accepting it here approves the ESP32's MAC (not the laptop's).
The laptop must be on FIU's network (eduroam / FIU_SECUREWiFi / FIU_WiFi) to reach the portal.
FIU guest access lasts one day: run this again when the ESP32 says it's joined but has no internet.

  python tools/fiu_portal_accept.py                      # reads the link from the ESP32 over USB (resets it once)
  python tools/fiu_portal_accept.py "https://psn07...."   # or paste the link

Tested 2026-09-26: "Connection Successful", then the ESP32 reached the internet (generate_204 -> 204).
"""
import re
import sys
import time
import urllib.parse

import requests
import urllib3

urllib3.disable_warnings()                    # the portal is FIU's internal server; we only accept its policy page
UA = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15"


def link_from_esp32(port="/dev/cu.usbserial-0001", wait_s=90):
    import serial
    s = serial.Serial(); s.port, s.baudrate, s.timeout = port, 115200, 1
    s.dtr = s.rts = False; s.open()
    s.dtr = s.rts = True; time.sleep(0.1); s.dtr = s.rts = False       # reset so it probes the portal again
    buf, t = "", time.time()
    while time.time() - t < wait_s:
        buf += s.read(4096).decode("utf-8", "replace")
        m = re.search(r"PORTAL\|probe\|code=\d+ location=(\S+)", buf)
        if m:
            s.close(); return m.group(1)
        if '"state":"online"' in buf:
            s.close(); print("The ESP32 is already online. Nothing to do."); sys.exit(0)
    s.close()
    sys.exit("No portal link from the ESP32. Is it on FIU_WiFi (firmware/sensors_live with WIFI_SSID FIU_WiFi)?")


def accept(link):
    base = link.split("/portal/")[0] + "/portal"
    ses = requests.Session(); ses.headers["User-Agent"] = UA
    r = ses.get(link, verify=False, timeout=20)
    m = re.search(r'name="token" value="([^"]+)"', r.text)
    if not m or "AupSubmit" not in r.text:
        sys.exit(f"Didn't get the accept page (HTTP {r.status_code}). The session may have expired: reset the ESP32 and retry.")
    r2 = ses.post(base + "/AupSubmit.action?from=AUP", data={"token": m.group(1), "aupAccepted": "true"},
                  headers={"Referer": r.url}, verify=False, timeout=20)
    ok = "successfully connected" in r2.text.lower()
    print("Accepted: FIU says Connection Successful." if ok else f"Submitted, but no success message (HTTP {r2.status_code}).")
    return ok


if __name__ == "__main__":
    link = sys.argv[1] if len(sys.argv) > 1 else link_from_esp32()
    print("portal:", urllib.parse.urlsplit(link).netloc)
    sys.exit(0 if accept(link) else 1)
