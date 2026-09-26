"""PLAN + POCKET: credit the adapted Prompt Grass soil/water shader, describe the hardware model, add the relay 3.3 V check."""
from pathlib import Path
H = Path(__file__).resolve().parent.parent

def patch(p, reps):
    s = p.read_text(encoding="utf-8")
    for a, b in reps:
        assert s.count(a) == 1, (p.name, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

patch(H.parent / "POCKET.md", [
    ("## 2. Farm Hand (our build; idea started from HackMIT 2026 Prompt Grass, SpaceX AI winner, none of its code used)",
     "## 2. Farm Hand (our build; idea started from HackMIT 2026 Prompt Grass, SpaceX AI winner. Only its soil + water shader is reused, MIT, credited in `farm-hand/laptop/static/THIRD_PARTY_NOTICES.md`)"),
])
patch(H / "PLAN_BODY.md", [
    ("- Disclose the inspiration in the Devpost: the idea started from a HackMIT 2026 soil-sensor project. None of its code, model or design is used here: the firmware, laptop code, dashboard and 3D model were all written from scratch.",
     "- Disclose it in the Devpost: the idea started from a HackMIT 2026 soil-sensor project (Prompt Grass Grow Grass). One part of its code is reused: the soil + water shader (`laptop/static/soil_shader.js`, adapted from its `shaders.ts`, MIT License, credited in the file and in `laptop/static/THIRD_PARTY_NOTICES.md`). Everything else, the firmware, laptop code, agents, target mode, dashboard and 3D model, was written for Farm Hand."),
    ("- Soil uses a scanned soil texture (Poly Haven `farm_soil`, CC0), with crumbs and white perlite on top. The probe is a textured copy of the capacitive v1.2 board, pressed against the front wall so you see it through the plastic, with its 3 jumper wires.",
     "- The soil is drawn by a shader adapted from Prompt Grass (MIT, see `laptop/static/soil_shader.js`): dry soil is light grey-brown with cracks, wet soil goes near-black. A pour shows a stream, splash rings, standing water, a ragged wetting front spreading on top, and a wet plume seeping down the front wall. The plume's size comes from the ml actually pumped; its shape and speed are modeled (the label says so).\n"
     "- Every part of the real build is modeled at its real size in `blender/hardware.py`: the capacitive v1.2 probe (with its chips and JST plug) and the DS18B20 steel probe against the front wall, the ESP32 devkit (metal WROOM can, USB-C, pin labels) on an 830-point breadboard with the 4.7k pull-up, the 1-channel relay module, the mini pump in a cup of water, the tube clipped to the rim, and every jumper wire. Textures come from `blender/make_hw_textures.py`."),
    ("| Relay clicks but the pump doesn't run |",
     "| Relay stays ON and won't turn off (pump never stops) | The ESP32 pin only goes to 3.3 V, and some 5 V relay modules need the full 5 V to switch OFF in LOW-trigger mode. Move the module's jumper to HIGH trigger and set `RELAY_ACTIVE_LOW = false` in `farm_hand.ino`, then re-flash. Test this on Sep 23 with the pump unplugged: `P A 2000` should click on, then click off after 2 s. |\n"
     "| Soil probe reads the same number wet or dry | Some cheap v1.2 boards have an NE555 chip (needs 5 V) instead of a TLC555 (works at 3.3 V). Read the chip's label. If it says NE555, power the probe from VIN (5 V) instead of 3V3, but first check AOUT in a cup of water and in air stays under 3.3 V (the ESP32 pin's limit). |\n"
     "| Relay clicks but the pump doesn't run |"),
])
print("ok")
