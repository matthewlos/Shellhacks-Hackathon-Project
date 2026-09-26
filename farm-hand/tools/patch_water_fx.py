"""Replace the blue sliding slab with water that looks like water in potting mix:
a stream + splash while the pump runs, and a dark, glossy wet bulb that grows down and out from where it lands.
The bulb's size comes from the ml actually pumped (pump seconds x measured flow); its shape and speed are modeled."""
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

s = s.replace("""//   WaterFront        slides down through the soil while a pour soaks in
""", """//   Soil (wet bulb)   while/after a pour, a dark glossy wet bulb grows down and out from where the water lands
""")
cut("// moisture by depth (the model)", "const CFG = await", """// moisture by depth (the model): the probe reads its sensing centre (~4.5 cm); surface drier, deeper wetter.
function profile(pct) { return { at: d => Math.max(0, Math.min(100, pct + (d - 4.5) * 1.8)) }; }

// The wet bulb (a model): water from a drip spreads in potting mix as a bulb, a bit deeper than wide.
// Its size is set by the water actually pumped: ml / 0.3 (pore space it fills) = bulb volume, half-ellipsoid.
const PORE = .3, DEEPER = 1.25, SPEED = .08;      // SPEED: how fast the front moves, units (10 cm) per second
function bulbRadius(ml) { return Math.cbrt(3 * (ml / PORE) / (2 * Math.PI * DEEPER)) / 10; }

""")
cut("  // keep the scanned soil texture from Blender;", "  soil.material.needsUpdate = true;", """  // keep the potting-mix texture from Blender; tint it per depth, then darken + gloss the wet bulb
  const cols = [...Array(LAYERS)].map(() => new THREE.Color(1, 1, 1));
  const wetU = { uWetC: { value: new THREE.Vector3() }, uWetR: { value: 0 }, uWetD: { value: 0 }, uWet: { value: 0 },
                 uWetTint: { value: new THREE.Color(.5, .47, .45) } };
  soil.material.onBeforeCompile = sh => {
    sh.uniforms.uCols = { value: cols }; Object.assign(sh.uniforms, wetU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      varying float vDepth; varying vec3 vPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vDepth = clamp(1.0 - position.y / 0.95, 0.0, 1.0); vPos = position;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uCols[6]; varying float vDepth; varying vec3 vPos;
      uniform vec3 uWetC; uniform float uWetR, uWetD, uWet; uniform vec3 uWetTint;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float f = vDepth * 5.0; int i = int(floor(f)); float t = smoothstep(0.0, 1.0, fract(f));
      diffuseColor.rgb *= mix(uCols[i], uCols[min(i + 1, 5)], t);
      float dxz = length(vPos.xz - uWetC.xz), dd = max(0.0, uWetC.y - vPos.y);
      float q = dxz * dxz / (uWetR * uWetR + 1e-5) + dd * dd / (uWetD * uWetD + 1e-5);
      q *= 1.0 + 0.22 * sin(vPos.x * 41.0) * sin(vPos.z * 37.0) * sin(vPos.y * 53.0);   // ragged front, not a perfect shape
      float wet = uWet * (1.0 - smoothstep(0.72, 1.0, q));
      float edge = uWet * (smoothstep(0.7, 0.92, q) - smoothstep(0.92, 1.08, q));
      diffuseColor.rgb *= mix(vec3(1.0), uWetTint, wet) * (1.0 - 0.18 * edge);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.28, wet);`);
  };
""")
rep("  const front = parts.WaterFront; front.visible = false; front.material.transparent = true; front.material.opacity = .6; front.material.depthWrite = false;",
    "  if (parts.WaterFront) parts.WaterFront.visible = false;          // replaced by the wet bulb in the soil shader")
cut("  const drops = [];", "  return { root,", """  // the stream from the tube and the splash where it hits the soil
  const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xd9ecfb, transmission: .6, roughness: .04, ior: 1.33, transparent: true, opacity: .8, thickness: .05 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, 1, 14, 1, true), streamMat);
  stream.visible = false; root.add(stream);
  const rings = [0, .5].map(o => { const r = new THREE.Mesh(new THREE.RingGeometry(.02, .032, 40), new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.userData.o = o; r.visible = false; root.add(r); return r; });
  const drops = [];
  for (let i = 0; i < 24; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 8), streamMat);
    d.visible = false; d.userData.v = Math.random(); root.add(d); drops.push(d); }
  wetU.uWetC.value.set(noz.x, H + .01, noz.z);
""")
rep("  return { root, soil, cols, rim, front, led: parts.ProbeLED, drops, noz, shown: 50, frontCm: null, x };",
    "  return { root, soil, cols, rim, wetU, stream, rings, led: parts.ProbeLED, drops, noz, shown: 50, ml: 0, r: 0, w: 0, tPump: 0, x };")
cut("    const pr = profile(p.shown, s.pot === k ? s : null, now);", "    p.led.material.color", """    const pr = profile(p.shown);
    p.cols.forEach((col, i) => { const m = pr.at(i * DEPTH_CM / (LAYERS - 1)), w = Math.max(0, Math.min(1, m / 80));
      if (lens === 'moisture') col.setRGB(1.1 - .75 * w, 1.1 - .45 * w, 1.1 + .9 * w);
      else if (lens === 'temp') { const t = Math.max(0, Math.min(1, ((L.temp ?? 27) - 18) / 16)); col.setRGB(.7 + .9 * t, .95, 1.6 - 1.0 * t); }
      else { const k = 1.08 - .5 * w; col.setRGB(k, k * .97, k * .94); } });   // wet potting mix goes darker, dry stays its real color
    // wet bulb: grows with every ml pumped, then fades as the water spreads through the whole box
    const pumping = L.pumping === k;
    if (pumping) { p.ml += dt * (L.cfg?.flow ?? 20); p.tPump = now; }
    const goal = Math.min(bulbRadius(p.ml), (H - .04) / DEEPER, .9);
    p.r += Math.max(-SPEED * dt, Math.min(SPEED * dt, goal - p.r));
    const since = now - p.tPump, wgoal = p.ml > 0 ? (since < 40 ? 1 : Math.exp(-(since - 40) / 60)) : 0;
    p.w += (wgoal - p.w) * Math.min(1, dt * 3);
    if (p.ml > 0 && since > 40 && p.w < .02) { p.ml = 0; p.r = 0; p.w = 0; }
    p.wetU.uWetR.value = p.r; p.wetU.uWetD.value = p.r * DEEPER; p.wetU.uWet.value = p.w;
    p.wetU.uWetTint.value.setRGB(...(lens === 'moisture' ? [.55, .78, 1.6] : lens === 'temp' ? [1, 1, 1] : [.5, .47, .45]));
""")
cut("    const pumping = L.pumping === k;\n    p.drops.forEach", "  }\n  if (!REDUCE", """    const fall = p.noz.y - .03 - (H + .01);
    p.stream.visible = pumping;
    if (pumping) { const wob = 1 + .18 * Math.sin(ms / 45); p.stream.scale.set(wob, fall, 2 - wob); p.stream.position.set(p.noz.x, H + .01 + fall / 2, p.noz.z); }
    p.rings.forEach(r => { r.visible = pumping || r.material.opacity > .01; if (!r.visible) return;
      const t = ((ms / 700) + r.userData.o) % 1; r.position.set(p.noz.x, H + .025, p.noz.z); r.scale.setScalar(1 + t * 4);
      r.material.opacity = pumping ? .55 * (1 - t) : r.material.opacity * .9; });
    p.drops.forEach(d => { d.visible = pumping || d.userData.fall; if (!d.visible) return; d.userData.v += dt * 2.2;
      if (d.userData.v > 1) { d.userData.v = 0; d.userData.fall = pumping; }
      const t = d.userData.v, a = d.id * 2.4;       // splash droplets hop out from the impact point
      d.position.set(p.noz.x + Math.cos(a) * t * .12, H + .03 + Math.sin(t * Math.PI) * .07, p.noz.z + Math.sin(a) * t * .12); });
""")
cut("  const fp = pots.A.frontCm != null ?", "  requestAnimationFrame(frame);\n}", """  const fp = pots.A.w > .3 && pots.A.r > .05 ? pots.A : pots.B && pots.B.w > .3 && pots.B.r > .05 ? pots.B : null;
  if (fp) { frontTag.hidden = false; frontTag.textContent = 'water soaking in (modeled)';
    place(frontTag, new THREE.Vector3(fp.x + fp.noz.x + fp.r * .6, H - fp.r * DEEPER * .8, .85)); } else frontTag.hidden = true;
""")
p.write_text(s, encoding="utf-8")

sv = H / "laptop/server.py"; t = sv.read_text(encoding="utf-8")
a = '"cfg": {"dry": config.DRY_PCT,'
if '"flow": config.load_cal()' not in t:
    assert t.count(a) == 1
    t = t.replace(a, '"cfg": {"flow": config.load_cal()["flow_ml_per_s"]["A"], "dry": config.DRY_PCT,')
    sv.write_text(t, encoding="utf-8")
print("ok")
