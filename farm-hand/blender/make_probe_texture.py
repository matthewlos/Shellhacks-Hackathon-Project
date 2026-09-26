"""Draw the capacitive soil moisture sensor v1.2 board as a texture (black PCB, white silkscreen, gold pads,
the small chip and parts at the top). Real board: about 2.3 cm x 9.8 cm. Output: tex/probe_pcb.png (256 x 1100)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "tex" / "probe_pcb.png"
W, H = 256, 1100
img = Image.new("RGB", (W, H), (18, 20, 22))
d = ImageDraw.Draw(img)
white, gold, dark = (232, 234, 228), (196, 160, 72), (10, 11, 12)

# board edge + subtle solder-mask sheen
d.rectangle([2, 2, W - 3, H - 3], outline=(40, 44, 46), width=3)
for y in range(0, H, 6):
    d.line([(6, y), (W - 6, y)], fill=(22, 25, 27) if y % 12 else (20, 22, 24))

# the sensing electrode: the white outlined area down the blade
d.rounded_rectangle([34, 380, W - 34, H - 90], radius=26, outline=white, width=4)
d.line([(W // 2, 400), (W // 2, H - 110)], fill=(30, 33, 35), width=26)
# pointed tip
d.polygon([(8, H - 40), (W // 2, H - 4), (W - 8, H - 40)], fill=(18, 20, 22))

# top area: 3-pin header pads, chip, resistors, caps
for i, lab in enumerate(("AOUT", "VCC", "GND")):
    x = 52 + i * 76
    d.ellipse([x - 16, 34, x + 16, 66], fill=gold, outline=dark)
    d.ellipse([x - 6, 44, x + 6, 56], fill=dark)
d.rectangle([80, 120, 176, 190], fill=(8, 8, 9), outline=(60, 60, 60))          # TLC555 timer chip
for p in range(4):
    d.rectangle([84 + p * 24, 110, 94 + p * 24, 120], fill=(170, 170, 170))
    d.rectangle([84 + p * 24, 190, 94 + p * 24, 200], fill=(170, 170, 170))
for x, y in ((40, 230), (196, 230), (40, 290), (196, 290), (120, 250)):
    d.rectangle([x - 14, y - 8, x + 14, y + 8], fill=(40, 30, 20)); d.rectangle([x - 14, y - 8, x - 8, y + 8], fill=(200, 200, 200)); d.rectangle([x + 8, y - 8, x + 14, y + 8], fill=(200, 200, 200))

# silkscreen text, rotated along the blade like the real board
try:
    font = ImageFont.truetype("arialbd.ttf", 30)
    small = ImageFont.truetype("arial.ttf", 22)
except OSError:
    font = small = ImageFont.load_default()
txt = Image.new("RGBA", (620, 90), (0, 0, 0, 0)); td = ImageDraw.Draw(txt)
td.text((4, 4), "Capacitive Soil Moisture Sensor", font=font, fill=white)
td.text((4, 48), "v1.2", font=small, fill=white)
txt = txt.rotate(90, expand=True)
img.paste(txt, (W // 2 - 60, 400), txt)
d.text((20, 330), "VCC  3.3-5.5V", font=small, fill=white)

OUT.parent.mkdir(exist_ok=True)
img.save(OUT)
print("wrote", OUT, img.size)
