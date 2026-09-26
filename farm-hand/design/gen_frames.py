"""Farm Hand design board, round 2: 5 styles x 8 screens by Nano Banana Pro (right.codes /draw).

Round 2 (2026-09-24) bakes in the Design Skills Holy Grail rules (Life OS/Reference/Guides/Design Skills Holy Grail Collection.md):
visual over text, one focal point, exact short copy, no decoration labels, one accent, group with space.
Prompt skeleton from MengTo design-first-ui-prompting: GOAL / FORMAT / LAYOUT / TYPE / COLOR / IMAGERY / COPY / NEGATIVE.
Round 1 frames + script: frames_v1/, gen_frames_v1.py.

  python gen_frames.py canary          # one frame (A2)
  python gen_frames.py all             # every missing frame, 6 at a time
  python gen_frames.py A3 C5 --force   # redo these
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

# look = palette, type, material. Each keeps ONE accent family and drops the reference's decoration noise.
STYLES = {
    "A": ("Blueprint", ["nexvyn_components.jpg"],
          "Near-black canvas #111113, soft charcoal surfaces #18181b, hairline 1px borders at low opacity. Geist-style clean sans, "
          "mono only for numbers. Accent: electric blue #3b82f6 for the AI; muted orange #d9773a only for the timer. "
          "The blueprint feel comes from 1 or 2 faint measurement ticks near the hero object, never more. Calm, lots of dark space."),
    "B": ("Signal Yellow", ["motion_yellow.jpg"],
          "Lemon yellow #f4dc1c and off-black #111 in big confident blocks. Heavy tight grotesk headlines, small mono buttons. "
          "One diagonal hatch band at most. Yellow is the brand color; the AI accent is black-on-yellow, the timer is a thin orange line only where needed."),
    "C": ("Warm Editorial", ["synais_warm.jpg"],
          "Warm stone background #e9e4da, deep oxblood panels #3a1716, huge light-weight sans headlines (last words fade to grey). "
          "A real photo of a hand holding the clear soil box with a thin steel temperature rod and a flat moisture probe. "
          "One thin circuit trace at most. Quiet and expensive."),
    "D": ("Terrain Ops", ["terrain_dashboard.jpg"],
          "A dark translucent app window over a real landscape photo of Florida farmland at dusk. 3D wireframe terrain in green and burnt orange "
          "is the hero visual. Green = healthy, orange = the timer, blue = the AI. Small status pins only where they mean something. "
          "Big numbers, few words."),
    "E": ("Terminal Point Cloud", ["terminal_pointcloud.jpg"],
          "Off-black #0b0b0b, white mono type, the soil box rendered as a dense white point cloud / wireframe as the hero. One crosshair on the "
          "focal point. Almost monochrome, one red accent for alerts. Show only the real numbers given below, no filler data columns."),
}

RULES = (
    "DESIGN RULES (strict): Visual over text: the image, the 3D object, the chart or one huge number carries the screen. "
    "ONE focal point and ONE primary action. Render ONLY the copy lines listed under COPY, nothing else readable. "
    "Hierarchy from size, weight and contrast, not labels. Group with empty space, not boxes; no nested cards, max 3 panels. "
    "One accent family. No eyebrow labels, no section numbers, no dimension annotations beyond what the style allows, "
    "no fake data columns, no status dots without meaning, no neon glow, no background gradients. Sentence case. "
    "Generous margins. Every number exactly as written.")

NEGATIVE = ("NEGATIVE: no extra text, no lorem ipsum, no gibberish typography, no made-up numbers or percentages, no logos, "
            "no watermarks, no device frame, no browser chrome, no people's names.")

# (title, goal, layout, copy lines rendered EXACTLY)
SCREENS = {
    1: ("Landing page", "First impression for a hackathon judge: this saves crops in a drought.",
        "Hero: headline left, the real soil box (clear plastic box, soil, flat moisture probe, steel temp rod, small pump, ESP32 board) big on the right. "
        "One quiet stat strip under the fold line.",
        ["FARM HAND", "When a crop dies, you lose the time it took to grow it.", "Waters only when the soil needs it.", "See it live",
         "80% of Florida hit extreme drought this spring"]),
    2: ("Live dashboard", "Show it's alive: moisture and temperature, equally big, and the AI's call.",
        "The soil box as the big hero visual. Two giant numbers side by side, same size. A thin healthy-band bar under moisture. "
        "One call line and one primary button.",
        ["FARM HAND", "44.0%", "soil moisture", "26.1 C", "soil temperature", "Holding off", "Run agents"]),
    3: ("Agents thinking", "Show FAST vs SMART: a tiny model decides instantly, then a team explains.",
        "Left: one lightning bolt card with a giant '311 ms'. Right: five small agent nodes connected by lines (three side by side, then two), "
        "glowing in the AI accent, with a running timer. The '37 s' timer is in the AI accent color too; orange means the sprinkler timer only and must not appear on this screen. Nothing else.",
        ["Laya: wait", "311 ms", "Gemini team explaining", "37 s", "Weather", "Soil", "Memory", "Planner", "Critic"]),
    4: ("Hit the target", "The live demo: a judge picks a number and the soil climbs to it.",
        "One enormous number climbing toward a target ring or mark on a big progress arc. Three small pulse chips. The soil box getting "
        "darker at the top with water drops.",
        ["54.3%", "target 55%", "8 s", "4.9 s", "2.4 s", "Target hit"]),
    5: ("Someone added water", "The system notices a person poured water and skips its own watering.",
        "The soil box with a hand pouring from a cup, soil darkening. One big alert card sliding over the dashboard with a water drop icon.",
        ["Someone just added water", "+8%", "Skipping my next watering"]),
    6: ("Water saved graph", "The money shot: AI line vs what a timer would have done.",
        "One wide chart as the hero: a solid AI-accent moisture line, a dashed orange timer line, a soft healthy band. One big counter beside it. "
        "A thin separate temperature strip under the chart.",
        ["Soil over time", "AI", "Timer, estimated", "3.4 cups saved", "sample data"]),
    7: ("Field view", "Show scale: zoom out from one box to a whole farm of probes.",
        "Aerial view of crop rows split into 4 zones, soil probe dots colored dry to wet, one ringed glowing dot, one outlined dry patch. "
        "The farm image fills the screen.",
        ["This box, live", "44.0%", "Only this patch gets water", "Illustration"]),
    8: ("Ask the farm", "Anyone can ask why it did what it did.",
        "A calm chat: one question bubble, one answer bubble, the soil box small beside it. Lots of space.",
        ["Why didn't you water?", "Soil is 44%. I water at 40%. It dries out in about 14 hours.", "Ask the farm"]),
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


def prompt_for(style, screen):
    sname, _refs, look = STYLES[style]
    title, goal, layout, copy = SCREENS[screen]
    lines = "\n".join(f'- "{c}"' for c in copy)
    return (f"GOAL\n- Screen {screen} of 8 of FARM HAND, '{title}': {goal}\n- Product: a real soil moisture probe and steel temperature rod in a "
            f"clear plastic box of Florida soil, an ESP32 board and a small pump. A tiny AI model (Laya) decides in milliseconds, a Gemini "
            f"agent team explains why. It waters only when needed.\n\n"
            f"FORMAT\n- Desktop web app screen, 16:9, flat screenshot, generous safe margins.\n\n"
            f"LAYOUT\n- {layout}\n\n"
            f"STYLE '{sname}' (match the reference image's palette, type, material and spacing; drop its clutter)\n- {look}\n\n"
            f"{RULES}\n\nCOPY (render EXACTLY these lines and no other text)\n{lines}\n\n{NEGATIVE}")


def draw(fid, force=False):
    style, screen = fid[0], int(fid[1:])
    dst = H / "frames" / f"{fid}.png"
    if dst.exists() and not force:
        return fid, "exists"
    payload = {"model": MODEL, "prompt": prompt_for(style, screen), "n": 1, "size": "16:9", "imageSize": "2K", "async": True,
               "image": [data_url(r) for r in STYLES[style][1]]}
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
        ids = ["A2"]
    elif args == ["all"]:
        ids = [f"{s}{n}" for s in STYLES for n in SCREENS]
    else:
        ids = args
    with ThreadPoolExecutor(6) as ex:
        for fid, res in ex.map(lambda i: draw(i, force), ids):
            print(fid, res, flush=True)
