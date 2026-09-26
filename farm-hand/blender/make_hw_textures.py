"""Textures for the Farm Hand hardware (PIL, no downloads). Writes into blender/tex/.
  potting_mix.png    farm_soil scan (CC0) + perlite + bark chips, seamless, for a 6 cm tile
  probe_v12.png      capacitive soil moisture sensor v1.2, front face (23 x 98 mm)
  esp32_pcb.png      ESP32 devkit top (51.5 x 28.3 mm) with pin labels
  esp32_can.png      the metal shield on the ESP32-WROOM-32 module (15.8 x 17.8 mm)
  esp32_ant.png      the module's antenna strip (18 x 6.5 mm)
  breadboard.png     830-point breadboard top (165 x 54.6 mm)
  relay_pcb.png      1-channel relay module (50 x 26 mm)
  relay_top.png      the blue relay's top face (19 x 15.5 mm)
  resistor.png       4.7k resistor bands (unwrapped cylinder)
Scale: 20 px per mm unless noted."""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

T = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex")
F = r"C:\Windows\Fonts"
def font(name, px):
    return ImageFont.truetype(os.path.join(F, name), px)
ARIAL, ARIALB, CONS = "arial.ttf", "arialbd.ttf", "consola.ttf"
MM = 20
random.seed(11)


def blob(d, cx, cy, r, fill, k=9, jag=.35):
    pts = []
    for i in range(k):
        a = 2 * math.pi * i / k + random.uniform(-.2, .2)
        rr = r * (1 + random.uniform(-jag, jag))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=fill)


def potting_mix():
    base = Image.open(os.path.join(T, "farm_soil_Diffuse.jpg")).convert("RGB").resize((1024, 1024))
    # darker and a touch redder: peat-based potting mix, not field dirt
    from PIL import ImageOps
    g = ImageOps.autocontrast(base.convert("L"), cutoff=1)          # keep the scan's grain, recolor it as dark peat
    base = ImageOps.colorize(g, black=(10, 6, 4), mid=(62, 40, 26), white=(146, 104, 72))
    over = Image.new("RGBA", base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(over)
    S = 1024
    def wrap(fn, x, y, *a):
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                fn(x + ox, y + oy, *a)
    for _ in range(260):   # bark chips: flat reddish-brown slivers
        x, y = random.uniform(0, S), random.uniform(0, S); L, w = random.uniform(14, 40), random.uniform(5, 11)
        a = random.uniform(0, math.pi); c = random.choice([(92, 52, 30, 235), (71, 40, 24, 235), (110, 66, 38, 225)])
        def chip(x, y, L=L, w=w, a=a, c=c):
            ca, sa = math.cos(a), math.sin(a)
            pts = [(x + ca * L / 2 - sa * w / 2, y + sa * L / 2 + ca * w / 2), (x + ca * L / 2 + sa * w / 2, y + sa * L / 2 - ca * w / 2),
                   (x - ca * L / 2 + sa * w / 2, y - sa * L / 2 - ca * w / 2), (x - ca * L / 2 - sa * w / 2, y - sa * L / 2 + ca * w / 2)]
            d.polygon(pts, fill=c)
        wrap(chip, x, y)
    for _ in range(140):   # air pockets against the wall: near-black gaps between clumps
        x, y = random.uniform(0, S), random.uniform(0, S)
        def pk(x, y, r=random.uniform(4, 12)):
            blob(d, x, y, r, (8, 5, 3, 230), k=7, jag=.5)
        wrap(pk, x, y)
    for _ in range(70):    # perlite: white, lumpy, with a grey shadow side
        x, y, r = random.uniform(0, S), random.uniform(0, S), random.uniform(6, 16)
        g = random.randint(222, 245)
        def per(x, y, r=r, g=g):
            blob(d, x + r * .25, y + r * .3, r, (70, 60, 52, 170))
            blob(d, x, y, r, (g - 20, g - 22, g - 26, 255), k=11, jag=.45)
            blob(d, x - r * .1, y - r * .1, r * .8, (g, g - 3, g - 8, 255), k=9, jag=.4)
            blob(d, x - r * .25, y - r * .25, r * .45, (255, 255, 252, 255), k=6)
        wrap(per, x, y)
    for _ in range(900):   # fine peat fibres / dark specks
        x, y = random.uniform(0, S), random.uniform(0, S)
        def sp(x, y, r=random.uniform(1.5, 4)):
            blob(d, x, y, r, (22, 14, 9, 200), k=5)
        wrap(sp, x, y)
    over = over.filter(ImageFilter.GaussianBlur(.7))
    base.paste(over, (0, 0), over)
    base.save(os.path.join(T, "potting_mix.png"))


def probe():
    W, H = 23 * MM, 98 * MM
    im = Image.new("RGB", (W, H), (18, 18, 20)); d = ImageDraw.Draw(im)
    wht = (232, 232, 228)
    # tapered tip at the bottom (the geometry cuts it; paint the edge line to match)
    d.line([(8, 8), (W - 8, 8)], fill=wht, width=3)                                   # top edge outline
    # sensing trace: the hidden copper plate shows as a slightly lighter rounded area
    d.rounded_rectangle([3 * MM, 36 * MM, 20 * MM, 90 * MM], radius=40, fill=(27, 27, 30))
    d.rounded_rectangle([6.5 * MM, 38 * MM, 16.5 * MM, 88 * MM], radius=30, fill=(33, 33, 36))
    # the white "don't bury past here" line + label
    d.rectangle([1 * MM, 29 * MM, 22 * MM, 29.6 * MM], fill=wht)
    # vertical title along the board
    t = Image.new("RGBA", (60 * MM, 4 * MM), (0, 0, 0, 0)); td = ImageDraw.Draw(t)
    td.text((0, 0), "Capacitive Soil Moisture Sensor v1.2", font=font(ARIALB, int(2.7 * MM)), fill=wht)
    t = t.rotate(90, expand=True); im.paste(t, (int(18.5 * MM), int(33 * MM)), t)
    # pin labels at the connector end, and component outlines (the parts themselves are 3D)
    f = font(ARIALB, int(1.9 * MM))
    for i, s in enumerate(("GND", "VCC", "AOUT")):
        d.text((int((6.2 + i * 4.2) * MM), int(10.5 * MM)), s, font=font(ARIALB, int(1.3 * MM)), fill=wht, anchor="mm")
    d.rectangle([4 * MM, 1.5 * MM, 19 * MM, 8.5 * MM], outline=wht, width=4)            # JST footprint
    d.rectangle([4.5 * MM, 14 * MM, 11 * MM, 20.5 * MM], outline=wht, width=3)         # 555 timer
    d.rectangle([13.5 * MM, 14.5 * MM, 18.5 * MM, 18.5 * MM], outline=wht, width=3)    # regulator
    for y in (22.5, 25.5):
        for x in (5, 10, 15):
            d.rectangle([x * MM, y * MM, (x + 3) * MM, (y + 1.6) * MM], outline=wht, width=2)
    d.text((int(11.5 * MM), int(27.5 * MM)), "v1.2", font=font(ARIAL, int(1.4 * MM)), fill=wht, anchor="mm")
    im.save(os.path.join(T, "probe_v12.png"))


def esp32():
    W, H = int(51.5 * MM), int(28.3 * MM)
    im = Image.new("RGB", (W, H), (16, 17, 19)); d = ImageDraw.Draw(im)
    wht = (226, 226, 222); gold = (206, 172, 92)
    left = ["3V3", "EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "GND", "D13", "D9", "D10", "D11", "5V"]
    right = ["GND", "D23", "D22", "TX", "RX", "D21", "GND", "D19", "D18", "D5", "D17", "D16", "D4", "D0", "D2", "D15", "D8", "D7", "D6"]
    f = font(ARIALB, int(1.25 * MM))
    x0 = 2.6 * MM
    for i in range(19):
        x = x0 + i * 2.54 * MM
        for y, lab, ly in ((1.4 * MM, right[i], 4.1 * MM), (H - 1.4 * MM, left[i], H - 4.1 * MM)):
            d.ellipse([x - .85 * MM, y - .85 * MM, x + .85 * MM, y + .85 * MM], fill=gold)
            d.ellipse([x - .35 * MM, y - .35 * MM, x + .35 * MM, y + .35 * MM], fill=(40, 40, 40))
            t = Image.new("RGBA", (int(3.4 * MM), int(1.6 * MM)), (0, 0, 0, 0))
            ImageDraw.Draw(t).text((t.width / 2, t.height / 2), lab, font=f, fill=wht, anchor="mm")
            t = t.rotate(90, expand=True); im.paste(t, (int(x - t.width / 2), int(ly - t.height / 2)), t)
    d.text((int(38 * MM), int(14 * MM)), "ESP32", font=font(ARIALB, int(2.6 * MM)), fill=wht, anchor="mm")
    d.text((int(38 * MM), int(17.5 * MM)), "DEVKIT V1", font=font(ARIAL, int(1.5 * MM)), fill=wht, anchor="mm")
    for (x, y, lab) in ((47.3, 10, "BOOT"), (47.3, 19.5, "EN")):
        d.text((int(x * MM), int(y * MM)), lab, font=font(ARIALB, int(1.2 * MM)), fill=wht, anchor="mm")
    im.save(os.path.join(T, "esp32_pcb.png"))
    # metal shield can
    W, H = int(15.8 * MM), int(17.8 * MM)
    im = Image.new("RGB", (W, H), (196, 199, 202)); d = ImageDraw.Draw(im)
    for y in range(0, H, 2):                     # brushed look
        g = random.randint(186, 206); d.line([(0, y), (W, y)], fill=(g, g + 2, g + 4))
    ink = (98, 100, 104)
    d.text((W / 2, 3 * MM), "ESPRESSIF", font=font(ARIALB, int(1.8 * MM)), fill=ink, anchor="mm")
    d.text((W / 2, 6.5 * MM), "ESP32-WROOM-32", font=font(ARIALB, int(1.45 * MM)), fill=ink, anchor="mm")
    d.rectangle([2 * MM, 9 * MM, W - 2 * MM, 15 * MM], outline=ink, width=3)
    d.text((W / 2, 12 * MM), "Wi-Fi  BT  BLE", font=font(ARIAL, int(1.3 * MM)), fill=ink, anchor="mm")
    im.save(os.path.join(T, "esp32_can.png"))
    # antenna strip: black PCB with the gold meander trace
    W, H = int(18 * MM), int(6.5 * MM)
    im = Image.new("RGB", (W, H), (20, 22, 26)); d = ImageDraw.Draw(im)
    pts, x, up = [(1 * MM, H - 1 * MM)], 1 * MM, True
    while x < W - 2 * MM:
        y = 1 * MM if up else H - 1.5 * MM
        pts += [(x, y), (x + 1.3 * MM, y)]; x += 1.3 * MM; up = not up
    d.line(pts, fill=gold, width=int(.5 * MM))
    im.save(os.path.join(T, "esp32_ant.png"))


def breadboard():
    k = 12
    W, H = int(165.1 * k), int(54.6 * k)
    im = Image.new("RGB", (W, H), (238, 238, 233)); d = ImageDraw.Draw(im)
    p = 2.54 * k; cx = W / 2; cy = H / 2
    hole = lambda x, y: d.rectangle([x - .6 * k, y - .6 * k, x + .6 * k, y + .6 * k], fill=(52, 52, 52))
    rows = [-13.97, -11.43, -8.89, -6.35, -3.81, 3.81, 6.35, 8.89, 11.43, 13.97]
    for c in range(63):
        x = cx + (c - 31) * p
        for r in rows:
            hole(x, cy + r * k)
        if c % 5 == 4 or c == 0:
            for yy in (cy - 16.3 * k, cy + 16.3 * k):
                d.text((x, yy), str(c + 1), font=font(ARIAL, int(1.5 * k)), fill=(120, 120, 120), anchor="mm")
    for i, r in enumerate("jihgf edcba".replace(" ", "")):
        pass
    d.rectangle([0, cy - .8 * k, W, cy + .8 * k], fill=(222, 222, 216))            # the center channel
    for side in (-1, 1):                                                                 # power rails
        for j, off in enumerate((20.3, 22.9)):
            y = cy + side * off * k
            for g in range(10):
                for h in range(5):
                    hole(cx + (-29.5 + g * 6 + h) * p + p / 2, y)
        d.line([(3 * k, cy + side * 18.7 * k), (W - 3 * k, cy + side * 18.7 * k)], fill=(200, 40, 40) if side < 0 else (40, 80, 200), width=int(.4 * k))
        d.line([(3 * k, cy + side * 24.6 * k), (W - 3 * k, cy + side * 24.6 * k)], fill=(40, 80, 200) if side < 0 else (200, 40, 40), width=int(.4 * k))
    im.save(os.path.join(T, "breadboard.png"))


def relay():
    W, H = int(50 * MM / 2), int(26 * MM / 2)        # 10 px/mm is plenty
    s = MM / 2
    im = Image.new("RGB", (W, H), (22, 86, 170)); d = ImageDraw.Draw(im)
    wht = (236, 240, 245)
    d.text((W * .52, H - 2.2 * s), "1 Relay Module", font=font(ARIALB, int(2 * s)), fill=wht, anchor="mm")
    for i, lab in enumerate(("NO", "COM", "NC")):
        d.text((46.5 * s, (5 + i * 5) * s), lab, font=font(ARIALB, int(1.7 * s)), fill=wht, anchor="mm")
    for i, lab in enumerate(("DC+", "DC-", "IN")):
        d.text((6.5 * s, (7 + i * 2.54) * s), lab, font=font(ARIALB, int(1.5 * s)), fill=wht, anchor="mm")
    d.text((10 * s, 3 * s), "LOW  HIGH", font=font(ARIALB, int(1.3 * s)), fill=wht, anchor="lm")
    for y in (7, 9.54, 12.08):
        d.ellipse([1.6 * s, (y - .9) * s, 3.4 * s, (y + .9) * s], fill=(214, 186, 110))
    im.save(os.path.join(T, "relay_pcb.png"))
    W, H = 19 * MM, int(15.5 * MM)
    im = Image.new("RGB", (W, H), (38, 92, 196)); d = ImageDraw.Draw(im)
    lines = [("SONGLE", ARIALB, 2.2), ("SRD-05VDC-SL-C", ARIALB, 1.6), ("10A 250VAC  10A 30VDC", ARIAL, 1.2), ("10A 125VAC  10A 28VDC", ARIAL, 1.2)]
    y = 3 * MM
    for txt, fn, sz in lines:
        d.text((W / 2, y), txt, font=font(fn, int(sz * MM)), fill=(240, 242, 246), anchor="mm"); y += sz * MM * 1.6
    im.save(os.path.join(T, "relay_top.png"))


def resistor():
    W, H = 256, 64
    im = Image.new("RGB", (W, H), (214, 190, 146)); d = ImageDraw.Draw(im)
    for x, c in ((60, (230, 190, 20)), (90, (130, 60, 170)), (120, (200, 40, 30)), (190, (190, 150, 60))):   # yellow violet red gold = 4.7k
        d.rectangle([x, 0, x + 16, H], fill=c)
    im.save(os.path.join(T, "resistor.png"))


for fn in (potting_mix, probe, esp32, breadboard, relay, resistor):
    fn(); print("made", fn.__name__)
