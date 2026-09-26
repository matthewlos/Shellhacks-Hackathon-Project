"""Swap scene.js onto soil_shader.js (the soil + water look adapted from Prompt Grass, MIT, credited)."""
from pathlib import Path
H = Path(__file__).resolve().parent.parent
p = H / "laptop/static/scene.js"; s = p.read_text(encoding="utf-8")

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

def cut(a, b, new):
    global s
    i, j = s.index(a), s.index(b)
    s = s[:i] + new + s[j:]

rep("import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';",
    "import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';\nimport { soilMaterial } from './soil_shader.js';   // soil + water look adapted from Prompt Grass (MIT), see that file")
s = s.replace("//   Soil              one body; a shader paints moisture by depth, smooth top to bottom (a model; only the probe % is measured)\n", "//   Soil              procedural dirt, dry vs wet from the probe %; a pour spreads a wetting front and seeps down the sides (modeled)\n")
s = s.replace("//   Soil (wet bulb)   while/after a pour, a dark glossy wet bulb grows down and out from where the water lands\n", "")
cut("const PAL = {", "const CFG = await", """// The wet patch (a model): its final size is set by the water actually pumped: ml / 0.3 (pore space it fills)
// = volume of a half-bulb. The front grows fast, then slows, like water spreading through dry mix.
const PORE = .3, DEEPER = 1.25, FRONT_TAU = 5;
function bulbRadius(ml) { return Math.cbrt(3 * (ml / PORE) / (2 * Math.PI * DEEPER)) / 10; }
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const moist01 = pct => Math.max(0, Math.min(1, (pct - 30) / 50));    // 30% looks dry, 80% looks soaked

""")
cut("  // keep the potting-mix texture from Blender;", "  // clear plastic container:", """  soil.material = soilMaterial();
  const su = soil.material.uniforms;
  if (parts.Crumbs) parts.Crumbs.visible = false;                   // the shader draws the grain now
""")
rep("  if (parts.WaterFront) parts.WaterFront.visible = false;          // replaced by the wet bulb in the soil shader",
    "  if (parts.WaterFront) parts.WaterFront.visible = false;          // replaced by the wetting front in the soil shader")
cut("  const rings = [0, .5].map", "  const drops = [];", "")
rep("  wetU.uWetC.value.set(noz.x, H + .01, noz.z);\n", "")
rep("  return { root, soil, cols, rim, wetU, stream, rings, led: parts.ProbeLED, drops, noz, shown: 50, ml: 0, r: 0, w: 0, tPump: 0, x };",
    "  return { root, soil, su, rim, stream, led: parts.ProbeLED, drops, noz, shown: 50, ml: 0, front: 0, active: 0, t0: 0, tPump: 0, x };")
cut("    const pr = profile(p.shown);", "    p.led.material.color", """    const u = p.su, pumping = L.pumping === k;
    u.uTime.value = ms / 1000; u.uM.value = damp(u.uM.value, moist01(p.shown), 1.5, dt);
    u.uLens.value = lens === 'moisture' ? 1 : lens === 'temp' ? 2 : 0;
    u.uTemp.value = L.temp != null ? Math.max(0, Math.min(1, (L.temp - 18) / 16)) : -1;
    // pour choreography (after Prompt Grass): the front grows on a slowing curve, stays ~35 s, then fades into the probe's reading
    if (pumping) { if (!p.ml) p.t0 = now; p.ml += dt * (L.cfg?.flow ?? 20); p.tPump = now; }
    const on = p.ml > 0 && now - p.tPump < 35, age = now - p.t0;
    const maxR = Math.min(bulbRadius(p.ml), 1.2);
    p.front = damp(p.front, on ? maxR * (1 - 1 / (1 + age / FRONT_TAU)) : p.front, 4, dt);
    p.active = damp(p.active, on ? 1 : 0, on ? 5 : .5, dt);
    if (!on && p.active < .01) { p.ml = 0; p.front = 0; }
    const S = u.uScale.value;
    u.uPour.value.set((p.x + p.noz.x) * S, p.noz.z * S, p.front * S);
    u.uPourActive.value = p.active < .005 ? 0 : p.active; u.uPourAge.value = p.ml ? age : -1;
""")
cut("    p.rings.forEach(r =>", "    p.drops.forEach(d =>", "")
cut("  const fp = pots.A.w > .3", "  requestAnimationFrame(frame);\n}", """  const fp = pots.A.active > .3 && pots.A.front > .05 ? pots.A : pots.B && pots.B.active > .3 && pots.B.front > .05 ? pots.B : null;
  if (fp) { frontTag.hidden = false; frontTag.textContent = 'water soaking in (modeled)';
    place(frontTag, new THREE.Vector3(fp.x + fp.noz.x + fp.front * .5, H - .3, .85)); } else frontTag.hidden = true;
""")
s = s.replace("window.FH = pots;   // handle for tests (tools/*.py read the wet bulb state)", "window.FH = pots;   // handle for tests (tools/*.py read the pour state)")
p.write_text(s, encoding="utf-8")

(H / "laptop/static/THIRD_PARTY_NOTICES.md").write_text("""# Third-party code in Farm Hand

## Prompt Grass Grow Grass (HackMIT 2026)

`laptop/static/soil_shader.js` adapts the soil and water shader from
`web/src/scene/shaders.ts` and the pour timing from `web/src/scene/FieldScene.ts` of
https://github.com/SamisLife/PromptGrassGrowGrass . Nothing else from that project is used.

```
""" + (Path(r"C:\Users\User\Documents\code\hackmit-winner-repos\2026-prompt-grass-grow-grass\LICENSE").read_text(encoding="utf-8").strip()) + """
```

## Poly Haven (CC0)

HDRI `ferndale_studio_03` and the `farm_soil` texture maps used to build the Blender model. CC0, no attribution required.
""", encoding="utf-8")
print("ok")
