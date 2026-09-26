// Farm Hand 3D view. Loads the Blender model (models/farmhand.glb, built by blender/build_farmhand.py)
// and drives its named parts from the live data:
//   Soil              one body; a shader paints moisture by depth, smooth top to bottom (a model; only the probe % is measured)
//   WaterFront        slides down through the soil while a pour soaks in
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
controls.enablePan = false; controls.enableDamping = true; controls.minDistance = 5; controls.maxDistance = 16;
controls.minAzimuthAngle = -.9; controls.maxAzimuthAngle = .9; controls.minPolarAngle = .9; controls.maxPolarAngle = 1.55;
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
let touched = false; canvas.addEventListener('pointerdown', () => touched = true);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6de, .5));
// real studio lighting: a Poly Haven HDRI (ferndale_studio_03, CC0) for reflections and soft light
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('models/studio.hdr', t => { scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose(); });
scene.environmentIntensity = .9;
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 9, 7); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); key.shadow.radius = 5;
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .14 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.09; floor.receiveShadow = true; scene.add(floor);

const H = 2.0, R_TOP = 1.3, R_BOT = 1.0, DEPTH_CM = 20, LAYERS = 6;
const PAL = { natural: [[200,168,120],[122,85,52],[42,28,18]], moisture: [[200,168,120],[90,143,200],[31,95,176]], temp: [[42,120,214],[201,184,154],[235,104,52]] };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function soilRGB(m, lens, temp) { const p = PAL[lens] || PAL.natural;
  const t = lens === 'temp' ? Math.max(0, Math.min(1, ((temp ?? 27) - 18) / 16)) : Math.max(0, Math.min(1, m / 80));
  return t < .5 ? lerp(p[0], p[1], t * 2) : lerp(p[1], p[2], (t - .5) * 2); }

// moisture by depth (the model): the probe reads its sensing centre (~7 cm); surface drier, deeper wetter.
// During a soak, the layers above the water front get wetter; the front's speed is timed, not measured.
function profile(pct, soak, now) {
  const base = d => pct + (d - 7) * .9;
  let front = null, add = 0;
  if (soak && soak.phase === 'soaking') { const prog = Math.min(1, (now - soak.t0) / Math.max(15, soak.watch_s * .5));
    front = 1 + prog * (DEPTH_CM - 2); add = Math.max(6, (soak.now - soak.before) * 1.6 + 8) * (1 - prog * .4); }
  return { at: d => Math.max(0, Math.min(100, base(d) + (front != null && d < front ? add * (1 - d / (front + 4)) + 4 : 0))), front };
}

const CFG = await fetch('/api/live').then(r => r.json()).then(x => x.cfg || {}).catch(() => ({}));
const ONE = CFG.one_pot ?? true;
const gltf = await new GLTFLoader().loadAsync('models/farmhand.glb');

function makePot(x, rimHex) {
  const root = gltf.scene.clone(true); root.position.x = x; scene.add(root);
  const parts = {};
  root.traverse(o => { if (o.isMesh) { o.castShadow = !/Tube|Nozzle/.test(o.name); o.receiveShadow = true; o.material = o.material.clone(); }
    parts[o.name] = o; });
  const soil = parts.Soil;
  // keep the scanned soil texture from Blender; tint it per depth (wet soil is darker, like the real thing)
  const cols = [...Array(LAYERS)].map(() => new THREE.Color(1, 1, 1));
  soil.material.onBeforeCompile = sh => {
    sh.uniforms.uCols = { value: cols };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      varying float vDepth;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vDepth = clamp(1.0 - position.y / 2.0, 0.0, 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uCols[6]; varying float vDepth;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float f = vDepth * 5.0; int i = int(floor(f)); float t = smoothstep(0.0, 1.0, fract(f));
      diffuseColor.rgb *= mix(uCols[i], uCols[min(i + 1, 5)], t);`);
  };
  soil.material.needsUpdate = true;
  // clear plastic container: real refraction (transmission) so the soil shows through the wall
  const clear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: .06, roughness: .06, ior: 1.49, metalness: 0, clearcoat: .6, clearcoatRoughness: .1, envMapIntensity: 1.2 });
  for (const n of ['Pot', 'Rim']) if (parts[n]) { parts[n].material = clear; parts[n].castShadow = false; }
  const rim = parts.Rim; rim.material = clear.clone(); rim.material.emissive = new THREE.Color(rimHex); rim.material.emissiveIntensity = 0;
  if (parts.Nozzle) parts.Nozzle.material.color.setHex(rimHex);
  const front = parts.WaterFront; front.visible = false; front.material.transparent = true; front.material.opacity = .6; front.material.depthWrite = false;
  const noz = new THREE.Vector3(); parts.Nozzle?.getWorldPosition(noz); noz.sub(root.position);
  const drops = [];
  for (let i = 0; i < 60; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2a78d6, roughness: .1, transparent: true, opacity: .85 }));
    d.visible = false; d.userData.v = Math.random(); root.add(d); drops.push(d); }
  return { root, soil, cols, rim, front, led: parts.ProbeLED, drops, noz, shown: 50, frontCm: null, x };
}
const pots = ONE ? { A: makePot(0, 0x2a78d6) } : { A: makePot(-1.75, 0x2a78d6), B: makePot(1.75, 0xeb6834) };
const POTS = Object.keys(pots);
if (ONE) document.getElementById('tagB').hidden = true;
cam.position.set(0, 3.6, ONE ? 10.5 : 14); controls.target.set(0, 1.1, 0);

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
    const pr = profile(p.shown, s.pot === k ? s : null, now);
    p.cols.forEach((col, i) => { const m = pr.at(i * DEPTH_CM / (LAYERS - 1)), w = Math.max(0, Math.min(1, m / 80));
      if (lens === 'moisture') col.setRGB(1.1 - .75 * w, 1.1 - .45 * w, 1.1 + .9 * w);
      else if (lens === 'temp') { const t = Math.max(0, Math.min(1, ((L.temp ?? 27) - 18) / 16)); col.setRGB(.7 + .9 * t, .95, 1.6 - 1.0 * t); }
      else { const k = 1.35 - .8 * w; col.setRGB(k, k * .97, k * .93); } });
    p.frontCm = pr.front;
    if (pr.front != null) { const y = H - pr.front / DEPTH_CM * H, r = (R_BOT + (R_TOP - R_BOT) * y / H) / R_TOP;
      p.front.visible = true; p.front.position.y = y - H; p.front.scale.set(r, 1, r); }
    else p.front.visible = false;
    p.led.material.color.setHex(L.pumping === k ? 0x2a78d6 : p.shown < dry ? 0xd03b3b : 0x0ca30c);
    if (k === 'A') p.rim.material.emissiveIntensity = glow * (.6 + .4 * Math.sin(ms / 180));
    const pumping = L.pumping === k;
    p.drops.forEach(d => { d.visible = pumping || d.userData.fall; if (!d.visible) return; d.userData.v += dt * 1.6;
      if (d.userData.v > 1) { d.userData.v = 0; d.userData.fall = pumping; }
      const t = d.userData.v; d.position.set(p.noz.x + Math.sin(t * 9 + d.id) * .04, p.noz.y - .05 - t * (p.noz.y - H + .05), p.noz.z + Math.cos(t * 7 + d.id) * .04); });
  }
  if (!REDUCE && !touched) cam.position.x = Math.sin(ms / 7000) * (ONE ? 1.2 : 1.5);
  controls.update(); renderer.render(scene, cam);
  if (pots.B) place(tagB, new THREE.Vector3(pots.B.x, -.55, .9));
  const fp = pots.A.frontCm != null ? pots.A : pots.B?.frontCm != null ? pots.B : null;
  if (fp) { frontTag.hidden = false; frontTag.textContent = 'water soaking down (modeled)';
    place(frontTag, new THREE.Vector3(fp.x - R_TOP * .35, H - fp.frontCm / DEPTH_CM * H, .1)); } else frontTag.hidden = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
