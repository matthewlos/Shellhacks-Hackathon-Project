import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { soilMaterial } from './soilShader.js';
import { PINCH_AT } from './drive.js';

/*
 * The rig in three.js (RIG3D.md). One imperative object with a small API:
 *   const s = await createScene({ container, palette, base })
 *   s.update(state, now, dt)  -> applies the driver's state (drive.js); returns true if the frame must be drawn
 *   s.render()                 -> draws one frame
 *   s.project(name)            -> { x, y, ok } in CSS px, for the HTML label layer
 *   s.dispose()
 * The model is farm-hand/blender/build_farmhand.py's (units: 1 = 10 cm, y up), optimized into public/rig/.
 * Nothing moves on its own: no auto-rotation, no idle sway, no rim glow. Every change maps to the data.
 */

// The build's own dimensions (build_farmhand.py): box 27 x 18 x 11 cm with a 0.9 taper, soil 9.5 cm deep.
const L = 2.7, W = 1.8, HC = 1.1, TAPER = 0.9, WALL = 0.03, HS = 0.95, SOIL_BOT = WALL;
const kAt = (y) => TAPER + ((1 - TAPER) * y) / HC;
const soilFrontZ = (y) => (W * kAt(y) - 2 * WALL - 0.05) / 2;
const soilHalfX = (y) => (L * kAt(y) - 2 * WALL) / 2;
const levelAt = (pct) => SOIL_BOT + (Math.max(0, Math.min(100, pct)) / 100) * (HS - SOIL_BOT);

// The tube's centerline: hardware.py's curve points, Blender (x, y, z) -> glTF (x, z, -y).
const TUBE_PTS = [[-1.95, 0.45, -0.4], [-1.95, 1.05, -0.4], [-1.7, 1.42, -0.05], [-1.37, 1.24, 0.3], [-1.05, 1.28, 0.4], [-0.75, 1.25, 0.39], [-0.62, 1.23, 0.38]];
const NOZZLE = new THREE.Vector3(-0.62, 1.18, 0.38);     // the nozzle's mouth
const SOIL_AT_NOZZLE = 0.962;                            // the lumpy top under it
const HAND = new THREE.Vector3(0.35, 0, -0.4);           // where a person tips a cup: the far side, away from the nozzle
const TEMP_TIP = new THREE.Vector3(1.05, 0.35, 0.776);   // the DS18B20's rounded tip (hardware.py M_DS origin)
const WATER_BASE = 0.012;                                 // the cup water's floor

// What the camera frames: the tote, the cup and the electronics (the USB cable is allowed to leave the frame).
const FRAME = new THREE.Box3(new THREE.Vector3(-2.45, 0, -0.9), new THREE.Vector3(2.22, 1.47, 1.78));
const VIEW = { azimuth: -0.3, polar: 1.1, fov: 26 };      // three-quarter from front-left and above, like a product photo

export async function createScene({ container, palette, base = '/rig/', reduced = false, onRender }) {
  const R = palette.rig;
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', outline: 'none' });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;   // Khronos PBR Neutral: keeps the palette's hues true on white paper
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;              // the casters don't move: redraw the map only when the clamp appears

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 60);

  // ---- load: model, studio light, soil scan ----
  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, hdr, grain] = await Promise.all([
    gltfLoader.loadAsync(`${base}farmhand.glb`),
    new HDRLoader().loadAsync(`${base}studio.hdr`),
    new THREE.TextureLoader().loadAsync(`${base}soil_grain.webp`),
  ]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.colorSpace = THREE.NoColorSpace;

  // ---- light: the HDRI, one soft key with a tight shadow, and a shadow catcher on the paper ----
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3.5, 8, 5);
  key.target.position.set(0, 0.4, 0.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3, bottom: -3, near: 4, far: 16 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.ShadowMaterial({ color: new THREE.Color(palette.text.primary), opacity: 0.18 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -0.003;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // ---- the model ----
  const root = gltf.scene;
  scene.add(root);
  const parts = {};
  root.traverse((o) => {
    if (o.name && !parts[o.name]) parts[o.name] = o;
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  const each = (node, fn) => node?.traverse((o) => { if (o.isMesh) fn(o); });
  if (parts.Lid) parts.Lid.visible = false;   // the blue lid on the table behind: not part of the system, and blue means water here

  // the tote: frosted polypropylene (see-through, milky, a clearcoat). Not glass: refraction made the soil read as water.
  const frosted = new THREE.MeshPhysicalMaterial({
    color: 0xf4f7fa, transparent: true, opacity: 0.16, roughness: 0.15, metalness: 0,
    clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 0.9, depthWrite: false,
  });
  for (const n of ['Pot', 'Rim', 'Cup']) each(parts[n], (o) => { o.material = frosted; o.castShadow = false; o.renderOrder = 2; });

  // the cup's water: clear with a creek tint, IOR 1.33; its height follows the ml left
  const cupWater = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(R.cupWater).lerp(new THREE.Color(R.water), 0.45), transparent: true, opacity: 0.7, roughness: 0.06, ior: 1.33,
    specularIntensity: 1, envMapIntensity: 0.5, depthWrite: false,
  });
  const waterNode = parts.Water;
  each(waterNode, (o) => { o.material = cupWater; o.castShadow = false; o.renderOrder = 1; });
  const water0 = waterNode ? { py: waterNode.position.y, sy: waterNode.scale.y } : null;

  // the tube: clear silicone, so the water column inside shows
  const tubeMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(R.tube), transparent: true, opacity: 0.38, roughness: 0.25, depthWrite: false, envMapIntensity: 0.8 });
  each(parts.Tube, (o) => { o.material = tubeMat; o.castShadow = false; o.renderOrder = 3; });

  // the soil: the team's shader, colored from the theme's soil tokens
  const soil = parts.Soil;
  const soilMat = soilMaterial({
    colors: { soilDry: R.soilDry, soilWet: R.soilWet, water: R.water, line: palette.moisture.main, min: palette.text.secondary, target: palette.text.primary },
    grain,
  });
  each(soil, (o) => { o.material = soilMat; o.castShadow = false; });
  const su = soilMat.uniforms;
  su.uTopY.value = HS + 0.001;
  su.uThick.value = HS - SOIL_BOT;
  su.uSoilBot.value = SOIL_BOT;
  const S = su.uScale.value;
  su.uPour.value.set(NOZZLE.x * S, NOZZLE.z * S, 0);
  su.uHand.value.set(HAND.x * S, HAND.z * S, 0);

  // the board LED (ProbeLED sits on the ESP32 board) and the relay's LED
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(R.ledOk), emissiveIntensity: 0.35, roughness: 0.3 });
  each(parts.ProbeLED, (o) => { o.material = ledMat; });
  const relayLed = new THREE.MeshStandardMaterial({ color: 0x3a2a22, emissive: new THREE.Color(R.relayOn), emissiveIntensity: 0, roughness: 0.3 });
  each(parts.Relay, (o) => { if (o.material?.name === 'LedRed') o.material = relayLed; });

  // ---- what the web scene adds: water column, stream, drops, clamp, temperature tip ----
  const curve = new THREE.CatmullRomCurve3(TUBE_PTS.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const TSEG = 160;
  const colGeo = new THREE.TubeGeometry(curve, TSEG, 0.024, 12, false);
  const waterMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(R.water), roughness: 0.12, metalness: 0 });
  const column = new THREE.Mesh(colGeo, waterMat);
  column.renderOrder = 2.5;
  const perSeg = colGeo.index.count / TSEG;
  colGeo.setDrawRange(0, 0);
  column.visible = false;
  scene.add(column);

  const streamMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(R.water), roughness: 0.08, transparent: true, opacity: 0.9 });
  const fall = NOZZLE.y - SOIL_AT_NOZZLE;
  const streamGeo = new THREE.CylinderGeometry(0.014, 0.01, 1, 16, 1, true);
  streamGeo.translate(0, -0.5, 0);   // origin at the top: scale.y extends it downward from the nozzle
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.position.copy(NOZZLE);
  stream.visible = false;
  scene.add(stream);
  const drops = [];
  const dropGeo = new THREE.SphereGeometry(0.011, 10, 8);
  for (let i = 0; i < 10; i++) {
    const d = new THREE.Mesh(dropGeo, streamMat);
    d.visible = false;
    scene.add(d);
    drops.push(d);
  }

  // the pinch: a black binder clip squeezing the tube, square to it, where the 2D drawing puts it
  const clamp = new THREE.Group();
  {
    const black = new THREE.MeshStandardMaterial({ color: new THREE.Color(R.clamp), roughness: 0.45 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d7da, roughness: 0.22, metalness: 1 });
    const jaw = new THREE.BoxGeometry(0.19, 0.035, 0.12);
    const a = new THREE.Mesh(jaw, black), b = new THREE.Mesh(jaw, black);
    a.position.y = 0.036; b.position.y = -0.036;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.105, 0.03), black);
    back.position.z = -0.06;
    const handle = (s) => {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 6, 20, Math.PI * 0.9), steel);
      h.position.set(0, s * 0.05, -0.07);
      h.rotation.set(0, Math.PI / 2, s > 0 ? 0.3 : Math.PI - 0.3);
      return h;
    };
    clamp.add(a, b, back, handle(1), handle(-1));
    clamp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const at = curve.getPointAt(PINCH_AT), tan = curve.getTangentAt(PINCH_AT);
    clamp.position.copy(at);
    // jaws close across the tube: the clip's y axis is perpendicular to the tube, its x runs along it
    clamp.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
    clamp.visible = false;
    scene.add(clamp);
  }

  const tipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.temp.tip), roughness: 0.35 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), tipMat);
  tip.position.copy(TEMP_TIP);
  scene.add(tip);
  const tempLo = new THREE.Color(palette.temp.tip), tempHi = new THREE.Color(palette.temp.main);

  const ledColors = { ok: new THREE.Color(R.ledOk), pump: new THREE.Color(R.ledPump), dry: new THREE.Color(R.ledDry) };

  // ---- camera: fixed three-quarter view fitted to the box; light orbit on drag (mouse only), clamped, damped ----
  const controls = new OrbitControls(cam, canvas);
  controls.enablePan = false;
  controls.enableZoom = false;       // the wheel scrolls the page
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.5;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  controls.enabled = !coarse;         // on touch, a drag scrolls the page instead of turning the box
  if (coarse) canvas.style.touchAction = 'pan-y';
  let controlsMoved = false;
  controls.addEventListener('change', () => { controlsMoved = true; });

  // Fit on the geometry itself (sampled vertices), not a bounding box: the frame hugs what is actually drawn.
  const corners = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || /UsbCable|Lid/.test(o.name) || /UsbCable|Lid/.test(o.parent?.name || '')) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) corners.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  const tmp = new THREE.Vector3();
  function fit(w, h) {
    cam.aspect = w / h;
    // a longer lens on wide stages, a slightly wider one on narrow ones, so the build fills the frame either way
    cam.fov = cam.aspect >= 1.5 ? VIEW.fov : VIEW.fov + 6;
    cam.updateProjectionMatrix();
    const target = FRAME.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3().setFromSphericalCoords(1, VIEW.polar, VIEW.azimuth);
    const margin = w < 600 ? 0.96 : 0.9;
    const extent = (dist) => {
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) { tmp.copy(c).project(cam); x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x); y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y); }
      return { x0, x1, y0, y1 };
    };
    // center the projected box, then find the distance where it just fits
    for (let pass = 0; pass < 3; pass++) {
      let lo = 2, hi = 40;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2, e = extent(mid);
        if (Math.max(e.x1 - e.x0, (e.y1 - e.y0)) / 2 > margin || Math.max(-e.x0, e.x1, -e.y0, e.y1) > 1) lo = mid; else hi = mid;
      }
      const e = extent(hi);
      // shift the target so the projection is centered (screen-space offset -> world, on the target's plane)
      const cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2;
      const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * hi, halfW = halfH * cam.aspect;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      target.addScaledVector(right, cx * halfW).addScaledVector(up, cy * halfH);
      extent(hi);
      if (Math.abs(cx) < 0.005 && Math.abs(cy) < 0.005) break;
    }
    controls.target.copy(target);
    const sph = new THREE.Spherical().setFromVector3(cam.position.clone().sub(target));
    controls.minAzimuthAngle = sph.theta - 0.45; controls.maxAzimuthAngle = sph.theta + 0.45;
    controls.minPolarAngle = Math.max(0.5, sph.phi - 0.35); controls.maxPolarAngle = Math.min(1.45, sph.phi + 0.25);
    controls.update();
  }

  let width = 1, height = 1;
  function resize(w, h) {
    if (w < 2 || h < 2) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    fit(w, h);
    dirty = true;
  }

  // ---- per-frame state ----
  let dirty = true, lastSig = '';
  const lvl = { level: -1 };
  function update(s, now, dt) {
    // soil
    su.uM.value = s.wet;
    su.uLevel.value = (s.level ?? 0) / 100;
    su.uMin.value = Math.abs(s.min - s.level) > 0.5 ? s.min / 100 : -1;   // the min line hides under the waterline when they meet
    su.uTarget.value = s.target != null ? s.target / 100 : -1;
    su.uTime.value = now / 1000;
    su.uPourActive.value = s.pour.active < 0.005 ? 0 : s.pour.active;
    su.uPour.value.z = s.pour.front * S;
    su.uPourAge.value = s.pour.age;
    su.uLayer.value = s.pour.layer;
    su.uHandA.value = s.hand.a;
    su.uHand.value.z = Math.min(0.9, 0.3 + 0.07 * s.hand.rise) * S;

    // tube column: fills along the tube from the pump; stops at the clamp when pinched
    const segs = Math.round(s.tube * TSEG);
    column.visible = segs > 0;
    colGeo.setDrawRange(0, segs * perSeg);
    if (clamp.visible !== s.pinched) { clamp.visible = s.pinched; renderer.shadowMap.needsUpdate = true; }

    // stream + drops
    stream.visible = s.stream.alpha > 0.01;
    if (stream.visible) {
      stream.scale.y = fall * s.stream.reach * (1 - s.stream.drop * 0.999);
      stream.position.y = NOZZLE.y - s.stream.drop * fall;
      streamMat.opacity = 0.9 * s.stream.alpha;
    }
    const dropsOn = s.stream.on && !reduced;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.visible = dropsOn;
      if (!dropsOn) continue;
      // splash droplets hop out from the impact point, spaced evenly in phase (no randomness)
      const t = (s.pour.t * 2.2 + i / drops.length) % 1, a = i * 2.39996;
      d.position.set(NOZZLE.x + Math.cos(a) * t * 0.12, SOIL_AT_NOZZLE + 0.01 + Math.sin(t * Math.PI) * 0.07, NOZZLE.z + Math.sin(a) * t * 0.12);
    }

    // cup water height
    if (waterNode) {
      const k = s.cupK;
      waterNode.visible = k > 0.004;
      waterNode.scale.y = water0.sy * Math.max(k, 0.004);
      waterNode.position.y = WATER_BASE * (1 - k) + water0.py * k;
    }

    // LEDs
    ledMat.emissive.copy(ledColors[s.led] || ledColors.ok);
    ledMat.emissiveIntensity = 0.35 + 1.4 * s.beat;
    relayLed.emissiveIntensity = s.relayOn ? 1.6 : 0;

    // temperature tip
    tipMat.color.copy(tempLo).lerp(tempHi, s.tempK);

    lvl.level = s.level;
    const sig = `${s.pinched}|${s.target}|${s.min}|${s.led}|${s.relayOn}|${s.cupK.toFixed(4)}|${s.level.toFixed(2)}|${s.tempK.toFixed(3)}`;
    if (sig !== lastSig) { lastSig = sig; dirty = true; }
    const moved = controls.update() || controlsMoved;
    controlsMoved = false;
    return s.busy || dirty || moved;
  }

  // ---- anchors for the HTML labels ----
  const anchors = {
    probe: () => tmp.set(0.72, 1.3, 0.82),
    temp: () => tmp.set(1.08, 0.9, 0.82),
    pump: () => tmp.set(-2.0, 0, 0.05),
    relay: () => tmp.set(1.95, 0.18, 1.35),
    esp: () => tmp.set(1.06, 0.17, 1.52),
    nozzle: () => tmp.set(NOZZLE.x + 0.08, NOZZLE.y + 0.12, NOZZLE.z),
    level: () => { const y = levelAt(lvl.level); return tmp.set(-soilHalfX(y) + 0.28, y, soilFrontZ(y) + 0.03); },
    min: () => { const y = levelAt(su.uMin.value * 100); return tmp.set(-soilHalfX(y) + 0.28, y, soilFrontZ(y) + 0.03); },
    target: () => { const y = levelAt(su.uTarget.value * 100); return tmp.set(-soilHalfX(y) + 0.28, y, soilFrontZ(y) + 0.03); },
  };
  function project(name) {
    const f = anchors[name];
    if (!f) return null;
    f().project(cam);
    return { x: ((tmp.x + 1) / 2) * width, y: ((1 - tmp.y) / 2) * height, ok: tmp.z < 1 && Math.abs(tmp.x) <= 1.05 && Math.abs(tmp.y) <= 1.05 };
  }

  // ---- render, with a device-pixel-ratio step down if frames run long on a weak GPU ----
  let frames = 0, slow = 0, lastT = 0;
  function render() {
    renderer.render(scene, cam);
    dirty = false;
    const t = performance.now();
    if (lastT && t - lastT < 100) { frames++; if (t - lastT > 22) slow++; }
    lastT = t;
    if (frames >= 90) {
      if (slow / frames > 0.5 && dpr > 1.5) { dpr = 1.5; renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); dirty = true; }
      frames = 0; slow = 0;
    }
    onRender?.();
  }
  renderer.shadowMap.needsUpdate = true;
  container.appendChild(canvas);

  function dispose() {
    controls.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) u.value.dispose();
        m.dispose();
      }
    });
    envRT.dispose();
    grain.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return { canvas, renderer, update, render, resize, project, dispose, get info() { return renderer.info; }, levelAt };
}
