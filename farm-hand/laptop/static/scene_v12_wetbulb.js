// Farm Hand 3D view. Loads the Blender model (models/farmhand.glb, built by blender/build_farmhand.py)
// and drives its named parts from the live data:
//   Soil              one body; a shader paints moisture by depth, smooth top to bottom (a model; only the probe % is measured)
//   Soil (wet bulb)   while/after a pour, a dark glossy wet bulb grows down and out from where the water lands
//   ProbeLED          green ok / red dry / blue pumping
//   Rim               glows while the agent team is working
//   Nozzle            water drops fall from it while the pump runs
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const canvas = document.getElementById('field'), stage = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
const controls = new OrbitControls(cam, canvas);
controls.enablePan = false; controls.enableDamping = true; controls.minDistance = 2.5; controls.maxDistance = 18;
controls.minAzimuthAngle = -.9; controls.maxAzimuthAngle = .9; controls.minPolarAngle = .9; controls.maxPolarAngle = 1.55;
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
let touched = false; canvas.addEventListener('pointerdown', () => touched = true);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6de, .5));
// real studio lighting: a Poly Haven HDRI (ferndale_studio_03, CC0) for reflections and soft light
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('models/studio.hdr', t => { scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose(); });
scene.environmentIntensity = .9;
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 9, 7); key.castShadow = true;
key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); key.shadow.bias = -.0004; key.shadow.radius = 5;
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .14 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; scene.add(floor);

// Mainstays Deep Rectangle box (size estimated): taper 0.9 bottom/top, soil 9.5 cm deep, 1 unit = 10 cm
const H = .95, HC = 1.1, TAPER = .9, BOX_L = 2.7, DEPTH_CM = 9.5, LAYERS = 6;
const widthAt = y => (TAPER + (1 - TAPER) * y / HC) / (TAPER + (1 - TAPER) * H / HC);
const PAL = { natural: [[200,168,120],[122,85,52],[42,28,18]], moisture: [[200,168,120],[90,143,200],[31,95,176]], temp: [[42,120,214],[201,184,154],[235,104,52]] };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function soilRGB(m, lens, temp) { const p = PAL[lens] || PAL.natural;
  const t = lens === 'temp' ? Math.max(0, Math.min(1, ((temp ?? 27) - 18) / 16)) : Math.max(0, Math.min(1, m / 80));
  return t < .5 ? lerp(p[0], p[1], t * 2) : lerp(p[1], p[2], (t - .5) * 2); }

// moisture by depth (the model): the probe reads its sensing centre (~4.5 cm); surface drier, deeper wetter.
function profile(pct) { return { at: d => Math.max(0, Math.min(100, pct + (d - 4.5) * 1.8)) }; }

// The wet bulb (a model): water from a drip spreads in potting mix as a bulb, a bit deeper than wide.
// Its size is set by the water actually pumped: ml / 0.3 (pore space it fills) = bulb volume, half-ellipsoid.
const PORE = .3, DEEPER = 1.25, SPEED = .08;      // SPEED: how fast the front moves, units (10 cm) per second
function bulbRadius(ml) { return Math.cbrt(3 * (ml / PORE) / (2 * Math.PI * DEEPER)) / 10; }

const CFG = await fetch('/api/live').then(r => r.json()).then(x => x.cfg || {}).catch(() => ({}));
const ONE = CFG.one_pot ?? true;
const gltf = await new GLTFLoader().loadAsync('models/farmhand.glb');

function makePot(x, rimHex) {
  const root = gltf.scene.clone(true); root.position.x = x; scene.add(root);
  const parts = {};
  root.traverse(o => { if (o.isMesh) { o.castShadow = !/Tube|Nozzle|Water|Cup/.test(o.name); o.receiveShadow = true; o.material = o.material.clone(); }
    parts[o.name] = o; });
  const soil = parts.Soil;
  // keep the potting-mix texture from Blender; tint it per depth, then darken + gloss the wet bulb
  const cols = [...Array(LAYERS)].map(() => new THREE.Color(1, 1, 1));
  const wetU = { uWetC: { value: new THREE.Vector3() }, uWetR: { value: 0 }, uWetD: { value: 0 }, uWet: { value: 0 },
                 uWetTint: { value: new THREE.Color(.3, .27, .25) } };
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
      diffuseColor.rgb *= mix(vec3(1.0), uWetTint, wet) * (1.0 - 0.3 * edge);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.6, wet);`);
  };
  soil.material.needsUpdate = true;
  // clear plastic container: real refraction (transmission) so the soil shows through the wall
  // frosted polypropylene like the real box: see-through but milky, not glass
  const clear = new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, transmission: .97, thickness: .03, roughness: .05, ior: 1.49, metalness: 0, clearcoat: .5, clearcoatRoughness: .15, envMapIntensity: 1.1 });
  for (const n of ['Pot', 'Rim', 'Cup']) if (parts[n]) { parts[n].material = clear; parts[n].castShadow = false; }
  if (parts.Water) { parts.Water.material = new THREE.MeshPhysicalMaterial({ color: 0xdff0fa, transmission: 1, thickness: .5, roughness: .02, ior: 1.33, envMapIntensity: 1 }); parts.Water.castShadow = false; }
  const rim = parts.Rim; rim.material = clear.clone(); rim.material.emissive = new THREE.Color(rimHex); rim.material.emissiveIntensity = 0;
  if (parts.Nozzle) parts.Nozzle.material.color.setHex(rimHex);
  if (parts.WaterFront) parts.WaterFront.visible = false;          // replaced by the wet bulb in the soil shader
  const noz = new THREE.Vector3(); parts.Nozzle?.getWorldPosition(noz); noz.sub(root.position);
  // the stream from the tube and the splash where it hits the soil
  const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xd9ecfb, transmission: .6, roughness: .04, ior: 1.33, transparent: true, opacity: .8, thickness: .05 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, 1, 14, 1, true), streamMat);
  stream.visible = false; root.add(stream);
  const rings = [0, .5].map(o => { const r = new THREE.Mesh(new THREE.RingGeometry(.02, .032, 40), new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.userData.o = o; r.visible = false; root.add(r); return r; });
  const drops = [];
  for (let i = 0; i < 24; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 8), streamMat);
    d.visible = false; d.userData.v = Math.random(); root.add(d); drops.push(d); }
  wetU.uWetC.value.set(noz.x, H + .01, noz.z);
  return { root, soil, cols, rim, wetU, stream, rings, led: parts.ProbeLED, drops, noz, shown: 50, ml: 0, r: 0, w: 0, tPump: 0, x };
}
const pots = ONE ? { A: makePot(0, 0x2a78d6) } : { A: makePot(-1.6, 0x2a78d6), B: makePot(1.6, 0xeb6834) };
const POTS = Object.keys(pots);
window.FH = pots;   // handle for tests (tools/*.py read the wet bulb state)
if (ONE) document.getElementById('tagB').hidden = true;
cam.position.set(.35, 3.9, ONE ? 8.3 : 13); controls.target.set(ONE ? .2 : 0, .5, .4);

const tagA = document.getElementById('tagA'), tagB = document.getElementById('tagB'), frontTag = document.getElementById('front');
const v = new THREE.Vector3();
function place(el, p) { v.copy(p).project(cam); el.style.transform = `translate(${(v.x + 1) / 2 * canvas.clientWidth}px, ${(1 - v.y) / 2 * canvas.clientHeight}px) translate(-50%, -50%)`; }
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage); resize();

let last = performance.now(), glow = 0;
function frame(ms) {
  const dt = Math.min(.05, (ms - last) / 1000); last = ms;
  const now = Date.now() / 1000, L = window.LIVE || {}, lens = window.LENS || 'natural', dry = L.cfg?.dry ?? 35, s = L.soak || {};
  const working = Object.keys(L.busy || {}).some(k => k !== 'farm_helper');
  glow += ((working ? 1 : 0) - glow) * Math.min(1, dt * 4);
  for (const k of POTS) {
    const p = pots[k], target = k === 'A' ? L.a : L.b;
    if (target != null) p.shown += (target - p.shown) * Math.min(1, dt * 2.5);
    const pr = profile(p.shown);
    p.cols.forEach((col, i) => { const m = pr.at(i * DEPTH_CM / (LAYERS - 1)), w = Math.max(0, Math.min(1, m / 80));
      if (lens === 'moisture') col.setRGB(1.1 - .75 * w, 1.1 - .45 * w, 1.1 + .9 * w);
      else if (lens === 'temp') { const t = Math.max(0, Math.min(1, ((L.temp ?? 27) - 18) / 16)); col.setRGB(.7 + .9 * t, .95, 1.6 - 1.0 * t); }
      else { const k = 1.22 - .3 * w; col.setRGB(k, k * .97, k * .94); } });   // dry mix is light brown; the wet bulb below is what goes near-black
    // wet bulb: grows with every ml pumped, then fades as the water spreads through the whole box
    const pumping = L.pumping === k;
    if (pumping) { p.ml += dt * (L.cfg?.flow ?? 20); p.tPump = now; }
    const goal = Math.min(bulbRadius(p.ml), (H - .04) / DEEPER, .9);
    p.r += Math.max(-SPEED * dt, Math.min(SPEED * dt, goal - p.r));
    const since = now - p.tPump, wgoal = p.ml > 0 ? (since < 40 ? 1 : Math.exp(-(since - 40) / 60)) : 0;
    p.w += (wgoal - p.w) * Math.min(1, dt * 3);
    if (p.ml > 0 && since > 40 && p.w < .02) { p.ml = 0; p.r = 0; p.w = 0; }
    p.wetU.uWetR.value = p.r; p.wetU.uWetD.value = p.r * DEEPER; p.wetU.uWet.value = p.w;
    p.wetU.uWetTint.value.setRGB(...(lens === 'moisture' ? [.55, .78, 1.6] : lens === 'temp' ? [1, 1, 1] : [.3, .27, .25]));
    p.led.material.color.setHex(L.pumping === k ? 0x2a78d6 : p.shown < dry ? 0xd03b3b : 0x0ca30c);
    if (k === 'A') p.rim.material.emissiveIntensity = glow * (.6 + .4 * Math.sin(ms / 180));
    const fall = p.noz.y - .03 - (H + .01);
    p.stream.visible = pumping;
    if (pumping) { const wob = 1 + .18 * Math.sin(ms / 45); p.stream.scale.set(wob, fall, 2 - wob); p.stream.position.set(p.noz.x, H + .01 + fall / 2, p.noz.z); }
    p.rings.forEach(r => { r.visible = pumping || r.material.opacity > .01; if (!r.visible) return;
      const t = ((ms / 700) + r.userData.o) % 1; r.position.set(p.noz.x, H + .025, p.noz.z); r.scale.setScalar(1 + t * 4);
      r.material.opacity = pumping ? .55 * (1 - t) : r.material.opacity * .9; });
    p.drops.forEach(d => { d.visible = pumping || d.userData.fall; if (!d.visible) return; d.userData.v += dt * 2.2;
      if (d.userData.v > 1) { d.userData.v = 0; d.userData.fall = pumping; }
      const t = d.userData.v, a = d.id * 2.4;       // splash droplets hop out from the impact point
      d.position.set(p.noz.x + Math.cos(a) * t * .12, H + .03 + Math.sin(t * Math.PI) * .07, p.noz.z + Math.sin(a) * t * .12); });
  }
  if (!REDUCE && !touched) cam.position.x = Math.sin(ms / 7000) * (ONE ? 1.4 : 1.5);
  controls.update(); renderer.render(scene, cam);
  if (pots.B) place(tagB, new THREE.Vector3(pots.B.x, -.55, .9));
  const fp = pots.A.w > .3 && pots.A.r > .05 ? pots.A : pots.B && pots.B.w > .3 && pots.B.r > .05 ? pots.B : null;
  if (fp) { frontTag.hidden = false; frontTag.textContent = 'water soaking in (modeled)';
    place(frontTag, new THREE.Vector3(fp.x + fp.noz.x + fp.r * .6, H - fp.r * DEEPER * .8, .85)); } else frontTag.hidden = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
