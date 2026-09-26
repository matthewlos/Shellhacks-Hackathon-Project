"""Farm Hand design board: 5 styles x 8 screens, drawn by Nano Banana Pro through right.codes /draw.

  python gen_frames.py canary          # one frame (A1) to check the lane works
  python gen_frames.py all             # every missing frame, 6 at a time
  python gen_frames.py A3 C5           # just these
  python gen_frames.py all --force     # redo everything

Frames land in frames/<style><screen>.png; board.html lays them out. Style refs are in refs/ (cropped from Dechante's X screenshots).
"""
import base64, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

H = Path(__file__).resolve().parent
MODEL = os.environ.get("DRAW_MODEL", "nano-banana-pro")
KEY = os.environ.get("RIGHTCODES_KEY_DRAW") or os.environ["RIGHTCODES_API_KEY"]   # /draw needs its own channel key
DRAW = "https://www.right.codes/draw/v1/images/generations"
TASKS = "https://www.right.codes/v1/tasks/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

STYLES = {
    "A": ("Blueprint", ["nexvyn_components.jpg"],
          "Nexvyn UI blueprint look: near-black background (#0e0e10), panels as dark rounded cards (#18181b) with 1px hairline borders, "
          "thin grey engineering dimension lines and tiny measurement callouts (like '24', 'r 8', 'gap 12') around key parts, small "
          "monospace uppercase labels, soft white text, calm and technical. Accents only: electric blue for the AI, orange for the timer."),
    "B": ("Signal Yellow", ["motion_yellow.jpg"],
          "Motion.dev look: big saturated lemon-yellow (#f4dc1c) blocks against pure black, heavy tight grotesk headlines, "
          "diagonal hatch-line texture bands, tiny monospace uppercase buttons with arrow glyphs, crisp editorial grid. "
          "Blue is still the AI color and orange the timer, used sparingly."),
    "C": ("Warm Editorial", ["synais_warm.jpg"],
          "Synais look: warm cream background (#e7e1d5), deep burgundy/oxblood sections (#3b1716), large light-weight grotesk "
          "headlines where the last words fade to grey, thin circuit-trace lines with small rounded chips, a real product photo of a "
          "hand holding a small device, tiny premium dark cards with donut charts. Quiet, expensive, YC-startup polish."),
    "D": ("Terrain Ops", ["terrain_dashboard.jpg"],
          "Terrain ops dashboard look: a dark translucent app window framed over a lush real-world landscape photo, with grid "
          "coordinates A-F and 1-5 on the edges, a big 3D wireframe terrain mesh in green and burnt orange with small status pins "
          "(green check, orange warning), hatched panel backgrounds, tiny data readouts with green and red bar meters. Sci-fi ops console."),
    "E": ("Terminal Point Cloud", ["terminal_pointcloud.jpg"],
          "Terminal point-cloud look: pure black, white monospace data columns everywhere, the main object rendered as a dense "
          "white point cloud / triangle wireframe, a thin crosshair reticle, tiny status text like 'STATUS: ONLINE', framed as a "
          "desktop window over a nature photo. Almost monochrome; one small red accent for alerts."),
}

PRODUCT = (
    "Product: FARM HAND, a hackathon project (ShellHacks 2026, Miami). A real soil probe and temperature probe sit in a clear plastic "
    "storage box of Florida soil, wired to an ESP32 board with a small pump and tube. A tiny fast AI model called Laya makes the "
    "watering call in milliseconds, then a Gemini agent team (Weather, Soil, Memory in parallel, then Planner and Critic) explains "
    "why. It waters only when the soil needs it and shows the water it saved versus a normal sprinkler timer. Blue = the AI. "
    "Orange = the timer. Real numbers only: soil moisture 44%, soil temperature 26.1 C, healthy band 35-70%.")

SCREENS = {
    1: ("Landing page", "The public landing page hero. Headline: 'When a crop dies, you lose the time it took to grow it, too.' "
        "Sub: 'Florida is in a drought. Farm Hand reads the soil every second and waters only when it needs it.' Two buttons: 'See it live' and "
        "'How it works'. A stat row: '80% of Florida hit extreme drought this spring', '100% of Miami-Dade in drought', '$72.94 in parts'. "
        "Show the soil box with its probe as the hero visual."),
    2: ("Live dashboard", "The main live dashboard, idle. Large hero view of the see-through soil box with the probe and wires. "
        "Equally big readouts: 'SOIL MOISTURE 44.0%' with a healthy band bar 35-70%, and 'SOIL TEMPERATURE 26.1 C'. The call panel: "
        "big 'Holding off' with 'Soil has enough water.' Buttons: 'Run agents' (primary), 'Test pour 5 s', 'Stop pump'. A small tag 'LIVE BOARD'."),
    3: ("Agents thinking", "The moment after pressing 'Run agents'. A fast strip lights up instantly: lightning icon 'Laya: Wait, soil has "
        "water' '311 ms to decide' '94% sure'. Next to it the Gemini team panel is working: Weather, Soil, Memory running at the same time "
        "(glowing blue), then Planner, then Critic, a live timer '37 s'. Safety rules row: all clear. Make FAST vs SMART obvious."),
    4: ("Hit the target", "The 'Hit the Target' demo. A judge picked 55%. A huge live readout climbs '44.0% -> 54.3%' with a progress bar and a "
        "target mark at 55%. Pulse chips: '8 s +9.4%', '4.9 s +5.1%', '2.4 s +1.2%'. Water drops falling in the soil box view. Status 'Target hit, "
        "locked at 54.3%'. Receipt line: '3 pulses, 15.3 s of pumping, 306 ml'."),
    5: ("Someone added water", "A big alert banner slides over the dashboard: water-drop icon, 'Someone just added water. +8%' and "
        "'Soil's at 52% now, so I'm skipping my next watering.' The soil box view shows the top soil darkening from the pour. Moisture readout 52.0%."),
    6: ("Water saved graph", "The 'Soil over time' money graph, full width. A solid blue moisture line (measured) and a dashed orange line "
        "'If a timer watered' labeled ESTIMATED, a healthy band 35-70% shaded, dots for AI pours and timer pours. A separate smaller panel "
        "under it: soil temperature line (measured). A big counter card: 'Water saved vs a timer: 3.4 cups' with 'AI 412 ml vs timer 1,212 ml' "
        "and a small 'TIMER IS ESTIMATED' tag. Time window buttons 1 h / 6 h / 24 h / All."),
    7: ("Field view", "Zoomed out from the one box to a whole farm seen from above: crop rows split into 4 zones, a soil probe dot every few "
        "rows colored dry-to-wet, one ringed pulsing dot labeled 'This box, live 44.0% 26.1 C', one dry patch outlined with 'Only this patch "
        "gets water'. A clear label 'ILLUSTRATION: what a field looks like. Only the ringed dot is live.'"),
    8: ("Ask the farm", "The 'Ask' chat view. Question bubble: 'Why didn't you water?'. Answer from the Gemini agent: 'Soil is at 44%, above the "
        "40% line where I water. It'll dry out in about 14 hours, so I'm waiting.' Suggested chips: 'How much would the timer have used?', "
        "'How dry is the county?'. A side column shows live moisture 44.0% and temp 26.1 C."),
}


def _req(url, payload=None, timeout=180):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method="POST" if payload is not None else "GET", headers={
        "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def _find(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("b64_json", "b64", "image_base64") and isinstance(v, str):
                return ("b64", v)
            r = _find(v)
            if r:
                return r
    elif isinstance(o, list):
        for v in o:
            r = _find(v)
            if r:
                return r
    elif isinstance(o, str):
        if o.startswith("data:image"):
            return ("b64", o.split(",", 1)[1])
        if o.startswith("http") and o.lower().split("?")[0].endswith((".png", ".jpg", ".jpeg", ".webp")):
            return ("url", o)
    return None


def data_url(name):
    b = (H / "refs" / name).read_bytes()
    return f"data:image/{'png' if name.endswith('png') else 'jpeg'};base64," + base64.b64encode(b).decode()


def draw(fid, force=False):
    style, screen = fid[0], int(fid[1:])
    dst = H / "frames" / f"{fid}.png"
    if dst.exists() and not force:
        return fid, "exists"
    sname, refs, look = STYLES[style]
    title, body = SCREENS[screen]
    prompt = (f"Design a high-fidelity desktop web app UI screen, 16:9, flat screenshot, no device frame, no browser chrome, crisp readable "
              f"English text, real product design quality (Dribbble / Mobbin level).\n\n{PRODUCT}\n\nSCREEN {screen} of 8, '{title}': {body}\n\n"
              f"VISUAL STYLE '{sname}' (copy the look of the reference image exactly: palette, type, texture, density, spacing): {look}\n\n"
              f"Keep the product name FARM HAND in the top-left. Keep all numbers exactly as written. NEVER invent any other number, percentage or stat (no made-up water-saved %, no made-up user counts); a label without a number is fine. No lorem ipsum, no fake logos of real companies.")
    payload = {"model": MODEL, "prompt": prompt, "n": 1, "size": "16:9", "imageSize": "2K", "async": True,
               "image": [data_url(r) for r in refs]}
    t0 = time.time()
    sub = _req(DRAW, payload)
    tid = sub.get("task_id")
    if not tid:
        return fid, f"no task_id: {json.dumps(sub)[:300]}"
    while time.time() - t0 < 600:
        t = _req(TASKS + tid)
        if t.get("data") or t.get("candidates"):
            kind, val = _find(t) or (None, None)
            if kind == "b64":
                dst.write_bytes(base64.b64decode(val))
            elif kind == "url":
                with urllib.request.urlopen(urllib.request.Request(val, headers={"User-Agent": UA}), timeout=120) as r:
                    dst.write_bytes(r.read())
            else:
                return fid, f"no image: {json.dumps(t)[:300]}"
            return fid, f"ok {time.time() - t0:.0f}s"
        if t.get("status") in ("failed", "error"):
            return fid, f"failed: {json.dumps(t, ensure_ascii=False)[:300]}"
        time.sleep(4)
    return fid, "timeout"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    (H / "frames").mkdir(exist_ok=True)
    if args == ["canary"]:
        ids = ["A1"]
    elif args == ["all"]:
        ids = [f"{s}{n}" for s in STYLES for n in SCREENS]
    else:
        ids = args
    with ThreadPoolExecutor(6) as ex:
        for fid, res in ex.map(lambda i: draw(i, force), ids):
            print(fid, res, flush=True)
