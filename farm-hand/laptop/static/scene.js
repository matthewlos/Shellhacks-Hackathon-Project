// Farm Hand 3D view. Loads the Blender model (models/farmhand.glb, built by blender/build_farmhand.py)
// and drives its named parts from the live data:
//   Soil              procedural dirt, dry vs wet from the probe %; a pour spreads a wetting front and seeps down the sides (modeled)
//   ProbeLED          green ok / red dry / blue pumping
//   Rim               glows while the agent team is working
//   Nozzle            water drops fall from it while the pump runs
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { soilMaterial } from './soil_shader.js';   // soil + water look adapted from Prompt Grass (MIT), see that file

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
// The wet patch (a model): its final size is set by the water actually pumped: ml / 0.3 (pore space it fills)
// = volume of a half-bulb. The front grows fast, then slows, like water spreading through dry mix.
const PORE = .3, DEEPER = 1.25;
const COVER = 4.5, SPREAD_TAU = 7;               // spread across the top: about half the box in 7 s, all of it by ~20 s
const BOX_AREA_CM2 = 434, TAKES_UP = .15;         // soil surface 26 x 16.7 cm; dry mix takes ~15% of its volume in water before it drains
function bulbRadius(ml) { return Math.cbrt(3 * (ml / PORE) / (2 * Math.PI * DEEPER)) / 10; }
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const moist01 = pct => Math.max(0, Math.min(1, (pct - 30) / 50));    // 30% looks dry, 80% looks soaked

const CFG = await fetch('/api/live').then(r => r.json()).then(x => x.cfg || {}).catch(() => ({}));
const ONE = CFG.one_pot ?? true;
const gltf = await new GLTFLoader().loadAsync('models/farmhand.glb');

function makePot(x, rimHex) {
  const root = gltf.scene.clone(true); root.position.x = x; scene.add(root);
  const parts = {};
  root.traverse(o => { if (o.isMesh) { o.castShadow = !/Tube|Nozzle|Water|Cup/.test(o.name); o.receiveShadow = true; o.material = o.material.clone(); }
    parts[o.name] = o; });
  const soil = parts.Soil;
  soil.material = soilMaterial();
  const su = soil.material.uniforms;
  if (parts.Crumbs) parts.Crumbs.visible = false;                   // the shader draws the grain now
  // clear plastic container: real refraction (transmission) so the soil shows through the wall
  // frosted polypropylene like the real box: see-through but milky, not glass
  // plain see-through plastic (no glass refraction): refraction blurred the soil behind it and made it read as water
  const clear = new THREE.MeshPhysicalMaterial({ color: 0xf4f7fa, transparent: true, opacity: .16, roughness: .12, metalness: 0, clearcoat: .4, clearcoatRoughness: .1, envMapIntensity: .8, depthWrite: false });
  for (const n of ['Pot', 'Rim', 'Cup']) if (parts[n]) { parts[n].material = clear; parts[n].castShadow = false; }
  if (parts.Water) { parts.Water.material = new THREE.MeshPhysicalMaterial({ color: 0xdff0fa, transmission: 1, thickness: .5, roughness: .02, ior: 1.33, envMapIntensity: 1 }); parts.Water.castShadow = false; }
  const rim = parts.Rim; rim.material = clear.clone(); rim.material.emissive = new THREE.Color(rimHex); rim.material.emissiveIntensity = 0;
  if (parts.Nozzle) parts.Nozzle.material.color.setHex(rimHex);
  if (parts.WaterFront) parts.WaterFront.visible = false;          // replaced by the wetting front in the soil shader
  const noz = new THREE.Vector3(); parts.Nozzle?.getWorldPosition(noz); noz.sub(root.position);
  // the stream from the tube and the splash where it hits the soil
  const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xd9ecfb, transmission: .6, roughness: .04, ior: 1.33, transparent: true, opacity: .8, thickness: .05 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, 1, 14, 1, true), streamMat);
  stream.visible = false; root.add(stream);
  const drops = [];
  for (let i = 0; i < 24; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 8), streamMat);
    d.visible = false; d.userData.v = Math.random(); root.add(d); drops.push(d); }
  return { root, soil, su, rim, stream, led: parts.ProbeLED, drops, noz, shown: 50, ml: 0, front: 0, layer: 0, active: 0, t0: 0, tPump: 0, x };
}
const pots = ONE ? { A: makePot(0, 0x2a78d6) } : { A: makePot(-1.6, 0x2a78d6), B: makePot(1.6, 0xeb6834) };
const POTS = Object.keys(pots);
window.FH = pots;   // handle for tests (tools/*.py read the pour state)
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
    const u = p.su, pumping = L.pumping === k;
    u.uTime.value = ms / 1000; u.uM.value = damp(u.uM.value, moist01(p.shown), 1.5, dt);
    u.uLens.value = lens === 'moisture' ? 1 : lens === 'temp' ? 2 : 0;
    u.uTemp.value = L.temp != null ? Math.max(0, Math.min(1, (L.temp - 18) / 16)) : -1;
    // pour choreography (after Prompt Grass): water lands, puddles, spreads across the whole top, then sinks as one even layer.
    // How far it spreads and how deep it sinks come from the ml pumped: depth = ml / (box area x water the dry mix can still take).
    if (pumping) { if (!p.ml) p.t0 = now; p.ml += dt * (L.cfg?.flow ?? 20); p.tPump = now; }
    const on = p.ml > 0 && now - p.tPump < 45, age = now - p.t0;
    const cover = Math.min(COVER, bulbRadius(p.ml) * 4);
    p.front = damp(p.front, on ? cover * (1 - 1 / (1 + age / SPREAD_TAU)) : p.front, 3, dt);
    const layerGoal = Math.min(.95, p.ml / (BOX_AREA_CM2 * TAKES_UP) / DEPTH_CM);
    p.layer = damp(p.layer, on && age > 2 ? layerGoal : p.layer, .35, dt);
    p.active = damp(p.active, on ? 1 : 0, on ? 5 : .4, dt);
    if (!on && p.active < .01) { p.ml = 0; p.front = 0; p.layer = 0; }
    const S = u.uScale.value;
    u.uPour.value.set((p.x + p.noz.x) * S, p.noz.z * S, p.front * S);
    u.uPourActive.value = p.active < .005 ? 0 : p.active; u.uPourAge.value = p.ml ? age : -1; u.uLayer.value = p.layer;
    p.led.material.color.setHex(L.pumping === k ? 0x2a78d6 : p.shown < dry ? 0xd03b3b : 0x0ca30c);
    if (k === 'A') p.rim.material.emissiveIntensity = glow * (.6 + .4 * Math.sin(ms / 180));
    const fall = p.noz.y - .03 - (H + .01);
    p.stream.visible = pumping;
    if (pumping) { const wob = 1 + .18 * Math.sin(ms / 45); p.stream.scale.set(wob, fall, 2 - wob); p.stream.position.set(p.noz.x, H + .01 + fall / 2, p.noz.z); }
    p.drops.forEach(d => { d.visible = pumping || d.userData.fall; if (!d.visible) return; d.userData.v += dt * 2.2;
      if (d.userData.v > 1) { d.userData.v = 0; d.userData.fall = pumping; }
      const t = d.userData.v, a = d.id * 2.4;       // splash droplets hop out from the impact point
      d.position.set(p.noz.x + Math.cos(a) * t * .12, H + .03 + Math.sin(t * Math.PI) * .07, p.noz.z + Math.sin(a) * t * .12); });
  }
  if (!REDUCE && !touched) cam.position.x = Math.sin(ms / 7000) * (ONE ? 1.4 : 1.5);
  controls.update(); renderer.render(scene, cam);
  if (pots.B) place(tagB, new THREE.Vector3(pots.B.x, -.55, .9));
  const fp = pots.A.active > .3 && pots.A.front > .05 ? pots.A : pots.B && pots.B.active > .3 && pots.B.front > .05 ? pots.B : null;
  if (fp) { frontTag.hidden = false; frontTag.textContent = fp.layer > .05 ? `water soaking down, ${(fp.layer * DEPTH_CM).toFixed(1)} cm (modeled)` : 'water spreading (modeled)';
    place(frontTag, new THREE.Vector3(fp.x - .4, H - Math.max(.08, fp.layer * .93), .85)); } else frontTag.hidden = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
