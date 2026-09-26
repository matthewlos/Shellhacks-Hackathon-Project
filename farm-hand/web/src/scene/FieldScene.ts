/**
 * FieldScene: the Farm Hand bench in 3D.
 *
 * Two clear Mainstays "Deep Rectangle" totes of soil side by side: A = Farm Hand (AI-watered), B = Timer (control).
 * Each is a clone of the Blender model (public/models/farmhand.glb, built by farm-hand/blender/build_farmhand.py):
 * soil, capacitive probe v1.2, DS18B20 steel probe, pump in a cup of water, tube clipped to the rim.
 *
 * Everything that changes is driven by real data, read from the store every frame (no React in the hot path):
 *   soil colour        <- that box's moisture %   (grey when the probe is disconnected: no fake value)
 *   probe pulse        <- a new sample arriving   (heartbeat)
 *   steel probe tint   <- that box's temperature  (18 °C blue .. 34 °C orange; plain steel when unknown)
 *   stream + wet front <- that box's pump state   (front size/depth is MODELED from pump-on time, not measured)
 *   rim glow on A      <- a new AI decision
 * HTML labels are positioned from the React side through `project()`.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useApp } from '../data/store';
import { BOXES, decisionKey, readBox, type BoxId } from './sceneData';
import { soilMaterial, type SoilUniforms } from './shaders';

const BOX_X: Record<BoxId, number> = { A: -2.1, B: 2.1 };   // 1 unit = 10 cm; box is 27 x 18 cm
const SOIL_TOP = 0.97, RIM_Y = 1.12;
const HOME = new THREE.Vector3(-3.1, 5.4, 10.8), HOME_TARGET = new THREE.Vector3(-0.5, 0.8, 0);
// what the opening view must show, around HOME_TARGET: both boxes plus the cups (x) and the boxes seen from 3/4 above (y)
const BENCH_HALF_W = 4.1, BENCH_HALF_H = 1.9;
// Modeled wet front (after the earlier Farm Hand scene): its size follows how long the pump has run.
const FLOW_ML_S = 20, PORE = .3, DEEPER = 1.25, COVER = 4.5, SPREAD_TAU = 7, BOX_AREA_CM2 = 434, TAKES_UP = .15, DEPTH_CM = 9.5;
const HIDE = /^(Lid|Crumbs|WaterFront|Breadboard|BoardJumpers|ESP32|DupontEnds|Relay|RelayWireEnds|Resistor|ProbeLED|Wires|UsbCable)$/;
const TEMP_LO = 18, TEMP_HI = 34;
const STEEL = new THREE.Color('#c4d2d8'), COOL = new THREE.Color('#3f82d6'), WARM = new THREE.Color('#ff8a2a');
const PULSE = new THREE.Color('#6bd66b');
/** house palette: blue = Farm Hand (AI, box A), orange = Timer (control, box B) */
export const BOX_COLOR: Record<BoxId, string> = { A: '#2a78d6', B: '#eb6834' };
// Motion (Emil Kowalski's rules): exponential ease-out everywhere, feedback settles in < 300 ms, driven by damped
// values so every change is interruptible, nothing grows from zero. The pour is the one authored moment; the rest is quiet.
const PULSE_S = 0.28;                                        // heartbeat: status feedback, under 300 ms
const STREAM_LAMBDA = 14;                                    // stream on/off: ~95% settled in ~210 ms
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

const damp = (cur: number, target: number, lambda: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const bulbRadius = (ml: number) => Math.cbrt((3 * (ml / PORE)) / (2 * Math.PI * DEEPER)) / 10;

interface Box {
  id: BoxId; x: number; root: THREE.Object3D; su: SoilUniforms;
  rim: THREE.MeshPhysicalMaterial; probeMats: THREE.MeshStandardMaterial[]; tempMats: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; probePos: THREE.Vector3;
  stream: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshPhysicalMaterial>; drops: THREE.Mesh[]; noz: THREE.Vector3; flow: number;
  shown: number | null; known: number; lastKey: unknown; pulseAt: number;
  ml: number; front: number; layer: number; active: number; t0: number; tPump: number; wasPumping: boolean;
}

export class FieldScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  readonly controls: OrbitControls;
  onFrame: (() => void) | null = null;
  /** world positions the React overlay anchors to (label above each box, wet-front note) */
  readonly anchors = new Map<string, THREE.Vector3>();
  /** true while a modeled wet front is on screen for that box */
  readonly modeled: Record<BoxId, boolean> = { A: false, B: false };

  private boxes: Box[] = [];
  private raf = 0;
  private last = performance.now();
  private disposed = false;
  private readonly reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly ro: ResizeObserver;
  private readonly canvas: HTMLCanvasElement;
  private decKey: unknown = undefined;
  private decAt = -1e9;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 0);   // transparent: the app's own (light) backdrop shows through
    this.renderer = r;

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c6, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(4, 9, 7); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5 });
    key.shadow.bias = -0.0004; key.shadow.radius = 4;
    this.scene.add(key);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002; floor.receiveShadow = true;
    this.scene.add(floor);

    // pleasant 3/4 view of both boxes, from the front-left and above
    const target = HOME_TARGET.clone();
    this.camera.position.copy(HOME).add(target);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enablePan: false, enableDamping: true, dampingFactor: 0.08, minDistance: 6, maxDistance: 30,
      minPolarAngle: 0.45, maxPolarAngle: 1.45, minAzimuthAngle: -1.1, maxAzimuthAngle: 1.1, rotateSpeed: 0.6, zoomSpeed: 0.7,
    });
    this.controls.target.copy(target);
    this.controls.update();
    if (this.reduce) this.controls.enableDamping = false;   // reduced motion: no inertia after a drag
    canvas.addEventListener('wheel', this.onZoom, { passive: true });

    for (const b of BOXES) this.anchors.set('label:' + b.id, new THREE.Vector3(BOX_X[b.id], RIM_Y + 0.55, -0.35));
    for (const b of BOXES) this.anchors.set('front:' + b.id, new THREE.Vector3(BOX_X[b.id] - 0.2, 0.55, 1.0));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
    void this.load();
    this.raf = requestAnimationFrame(this.frame);
  }

  private userZoomed = false;
  private onZoom = () => { this.userZoomed = true; };

  /** the scene sits full-screen behind the top bar (~64 px) and the dock (~120 px): frame the boxes in the band between */
  static readonly INSET = { top: 64, bottom: 120 };

  /** distance at which both boxes (and their cups) fill the visible band, at any aspect */
  private homeDist(w: number, h: number): number {
    const { top, bottom } = FieldScene.INSET;
    const band = Math.max(0.35, (h - top - bottom) / h);          // share of the height the boxes may use
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const byWidth = (BENCH_HALF_W * 1.12) / Math.tan(hHalf);
    const byHeight = (BENCH_HALF_H * 1.1) / (Math.tan(vHalf) * band);
    return Math.max(byWidth, byHeight);
  }

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 44 : w / h < 1.1 ? 36 : 28;   // portrait phones: wider lens, so the boxes aren't specks
    // centre the boxes in the band between the bar and the dock, not in the full canvas
    const { top, bottom } = FieldScene.INSET;
    const shift = Math.round((bottom - top) / 2);
    if (h > top + bottom + 100) this.camera.setViewOffset(w, h, 0, shift, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const fit = this.homeDist(w, h);
    this.controls.maxDistance = Math.max(30, fit * 1.6);
    if (this.userZoomed) return;
    // always open on the two boxes: home target, home direction, fitted distance
    this.controls.target.copy(HOME_TARGET);
    this.camera.position.copy(HOME_TARGET).addScaledVector(HOME.clone().normalize(), fit);
    this.controls.update();
  }

  private async load() {
    let gltf;
    try { gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/farmhand.glb'); } catch (e) { console.error('farmhand.glb failed to load', e); return; }
    if (this.disposed) return;
    const src = gltf.scene;
    for (const b of BOXES) this.boxes.push(this.makeBox(src, b.id));
    this.addController(src);
  }

  private makeBox(src: THREE.Object3D, id: BoxId): Box {
    const x = BOX_X[id];
    const root = src.clone(true);
    root.position.x = x;
    this.scene.add(root);
    const parts: Record<string, THREE.Object3D> = {};
    root.traverse((o) => { if (o.name) parts[o.name] ??= o; });
    for (const [n, o] of Object.entries(parts)) if (HIDE.test(n)) o.visible = false;

    const clear = new THREE.MeshPhysicalMaterial({
      color: 0xf4f7fa, transparent: true, opacity: 0.17, roughness: 0.18, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.15, depthWrite: false,
    });
    const rim = clear.clone(); rim.opacity = 0.3; rim.emissive = new THREE.Color(BOX_COLOR[id]); rim.emissiveIntensity = 0;
    const setMat = (name: string, m: THREE.Material, shadow = false) => parts[name]?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = m; o.castShadow = shadow; o.receiveShadow = true; }
    });
    // clone every other material so the two boxes can differ (probe pulse, temperature tint)
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = !/Tube|Nozzle|Water|Cup|Pot|Rim/.test(nameOf(m)); m.receiveShadow = true;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    });
    setMat('Pot', clear); setMat('Cup', clear); setMat('Rim', rim);
    setMat('Water', new THREE.MeshPhysicalMaterial({ color: 0xbfe2f7, transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false }));
    parts.Nozzle?.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if ((o as THREE.Mesh).isMesh && m?.color) m.color.set(BOX_COLOR[id]); });
    const soilMat = soilMaterial();
    setMat('Soil', soilMat, false);

    const matsOf = (name: string) => {
      const out: THREE.MeshStandardMaterial[] = [];
      parts[name]?.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if ((o as THREE.Mesh).isMesh && m && 'emissive' in m) out.push(m); });
      return out;
    };
    const probeMats = matsOf('Probe');
    // the DS18B20 sits a little higher than in the Blender file so its steel end shows above the soil
    if (parts.TempProbe) parts.TempProbe.position.y += 0.26;
    const tempMats = matsOf('TempProbe');

    const probePos = new THREE.Vector3(0.72, SOIL_TOP + 0.006, 0.74);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: PULSE, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(probePos); ring.visible = false;
    root.add(ring);

    const noz = new THREE.Vector3();
    if (parts.Nozzle) { root.updateMatrixWorld(true); parts.Nozzle.getWorldPosition(noz); noz.sub(root.position); } else noz.set(-0.62, 1.2, 0.38);
    const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6fa, transparent: true, opacity: 0.8, roughness: 0.05, depthWrite: false });
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 1, 14, 1, true), streamMat);
    stream.visible = false; root.add(stream);
    const drops: THREE.Mesh[] = [];
    const dropGeo = new THREE.SphereGeometry(0.011, 8, 8);
    for (let i = 0; i < 18; i++) {
      const d = new THREE.Mesh(dropGeo, streamMat);
      d.visible = false; d.userData = { v: Math.random(), a: i * 2.4, fall: false }; root.add(d); drops.push(d);
    }

    // soil probe cable and temperature cable run back over the rear rim to the ESP32 (decorative)
    const cable = new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 0.7 });
    const toBoard = new THREE.Vector3(-x * 0.55, 0.08, -1.55);
    const run = (from: THREE.Vector3, sideways: number) => {
      const c = new THREE.CatmullRomCurve3([
        from, from.clone().add(new THREE.Vector3(0, 0.22, -0.1)),
        new THREE.Vector3(from.x + sideways, RIM_Y + 0.12, -0.95), new THREE.Vector3(from.x + sideways * 1.5, 0.5, -1.25), toBoard,
      ]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 48, 0.014, 6, false), cable);
      m.castShadow = true; root.add(m);
    };
    run(new THREE.Vector3(0.72, 1.25, 0.8), 0.05);
    run(new THREE.Vector3(1.05, SOIL_TOP + 0.2, 0.83), 0.1);

    return {
      id, x, root, su: soilMat.uniforms, rim, probeMats, tempMats, ring, probePos, stream, drops, noz,
      shown: null, known: 0, lastKey: undefined, pulseAt: -1e9, flow: 0,
      ml: 0, front: 0, layer: 0, active: 0, t0: 0, tPump: 0, wasPumping: false,
    };
  }

  /** ESP32 dev board on a green perfboard, behind and between the boxes (decorative). */
  private addController(src: THREE.Object3D) {
    const g = new THREE.Group();
    g.position.set(0, 0, -1.7);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.7), new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.6 }));
    board.position.y = 0.015; board.castShadow = board.receiveShadow = true; g.add(board);
    // copper pads grid
    const pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 8), new THREE.MeshStandardMaterial({ color: 0xc58a4a, metalness: 0.8, roughness: 0.35 }), 17 * 12);
    const m4 = new THREE.Matrix4(); let i = 0;
    for (let a = 0; a < 17; a++) for (let b = 0; b < 12; b++) pads.setMatrixAt(i++, m4.makeTranslation(-0.44 + a * 0.055, 0.032, -0.3 + b * 0.055));
    g.add(pads);
    const esp = src.getObjectByName('ESP32');
    if (esp) {
      const e = esp.clone(true);
      e.position.set(0.02, 0.03, 0.13); e.rotation.set(0, Math.PI / 2, 0); e.visible = true;
      e.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      g.add(e);
    }
    this.scene.add(g);
  }

  /** screen position (CSS px, relative to the canvas) of a world point */
  project(w: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = w.clone().project(this.camera);
    const el = this.canvas;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight, visible: v.z < 1 && v.z > -1 };
  }

  private frame = (ms: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const realDt = Math.max(0, (ms - this.last) / 1000), dt = Math.min(0.5, realDt);   // smoothing stays time-correct at any frame rate
    this.last = ms;
    const now = ms / 1000;
    const st = useApp.getState() as unknown as { lens?: string };
    const lens = st.lens === 'moisture' ? 1 : st.lens === 'temperature' ? 2 : 0;
    const time = this.reduce ? 0 : now;

    const dk = decisionKey(st);
    if (dk !== this.decKey) { if (this.decKey !== undefined && dk != null) this.decAt = now; this.decKey = dk; }
    const decGlow = 1 - easeOutExpo(Math.min(1, (now - this.decAt) / 1.2));   // brief, quiet: the AI just decided

    for (const b of this.boxes) {
      const d = readBox(st, b.id);
      const u = b.su;
      u.uTime.value = time; u.uLens.value = lens;

      // moisture -> soil colour; unknown -> grey (and we stop showing the last value)
      if (d.moisturePct != null) {
        // qualitative colour ramp, not a measurement: ~15% reads as dry tan, ~80% as wet near-black
        const target = Math.max(0, Math.min(1, (d.moisturePct - 15) / 65));
        b.shown = b.shown == null ? target : damp(b.shown, target, 2.5, dt);
        u.uM.value = b.shown;
      }
      b.known = damp(b.known, d.moisturePct != null ? 1 : 0, 3, dt);
      u.uKnown.value = b.known;

      // temperature -> steel probe tint and a faint wash on the soil
      const t01 = d.tempC != null ? Math.max(0, Math.min(1, (d.tempC - TEMP_LO) / (TEMP_HI - TEMP_LO))) : -1;
      u.uTemp.value = t01;
      for (const m of b.tempMats) {
        if (t01 < 0) { m.color.copy(STEEL); m.emissive.setRGB(0, 0, 0); }
        else {
          // cool blue -> plain steel (mid-range) -> warm orange; avoids the muddy purple of a straight blue-orange mix
          const tint = t01 < 0.5 ? COOL.clone().lerp(STEEL, t01 * 2) : STEEL.clone().lerp(WARM, (t01 - 0.5) * 2);
          m.color.copy(tint); m.emissive.copy(tint).multiplyScalar(0.3 * Math.abs(t01 - 0.5) * 2);
        }
      }

      // heartbeat: a new sample from a working probe
      if (d.sampleKey !== b.lastKey) { if (b.lastKey !== undefined && d.probeOk && d.sampleKey != null) b.pulseAt = now; b.lastKey = d.sampleKey; }
      // one quick ease-out flash on the probe + a ring that starts already visible (70% size) and settles outward
      const k = Math.min(1, (now - b.pulseAt) / PULSE_S), pulse = 1 - easeOutExpo(k);
      for (const m of b.probeMats) { m.emissive.copy(PULSE); m.emissiveIntensity = pulse * 0.5; }
      b.ring.visible = pulse > 0.01;
      if (b.ring.visible) {
        b.ring.scale.setScalar(this.reduce ? 0.16 : 0.16 * (0.7 + 0.3 * easeOutExpo(k)));   // reduced motion: fade only, no movement
        b.ring.material.opacity = pulse * 0.7;
      }

      // pump -> stream from the nozzle and a MODELED wet front spreading from where it lands
      const pumping = d.pumping;
      if (pumping) { if (!b.wasPumping && (b.ml === 0 || now - b.tPump > 45)) { b.ml = 0; b.t0 = now; } b.ml += realDt * FLOW_ML_S; b.tPump = now; }
      b.wasPumping = pumping;
      const on = b.ml > 0 && now - b.tPump < 45, pAge = now - b.t0;
      const cover = Math.min(COVER, bulbRadius(b.ml) * 4);
      b.front = damp(b.front, on ? cover * (1 - 1 / (1 + pAge / SPREAD_TAU)) : b.front, 3, dt);
      const layerGoal = Math.min(0.95, b.ml / (BOX_AREA_CM2 * TAKES_UP) / DEPTH_CM);
      b.layer = damp(b.layer, on && pAge > 2 ? layerGoal : b.layer, 0.35, dt);
      b.active = damp(b.active, on ? 1 : 0, on ? 5 : 0.4, dt);
      if (!on && b.active < 0.01) { b.ml = 0; b.front = 0; b.layer = 0; }
      const S = u.uScale.value;
      u.uPour.value.set((b.x + b.noz.x) * S, b.noz.z * S, b.front * S);
      u.uPourActive.value = b.active < 0.005 ? 0 : b.active;
      u.uPourAge.value = b.ml ? (this.reduce ? 5 : pAge) : -1;
      u.uLayer.value = b.layer;
      this.modeled[b.id] = b.active > 0.3 && b.front > 0.05;

      // the authored moment: the stream reaches down from the nozzle (from a visible stub, never from nothing),
      // retracts when the pump stops, and reverses smoothly if the pump flips mid-way
      b.flow = this.reduce ? (pumping ? 1 : 0) : damp(b.flow, pumping ? 1 : 0, STREAM_LAMBDA, dt);
      const fall = b.noz.y - 0.03 - SOIL_TOP;
      b.stream.visible = b.flow > 0.01;
      if (b.stream.visible) {
        const len = fall * (0.15 + 0.85 * b.flow);
        const wob = this.reduce ? 1 : 1 + 0.12 * Math.sin(ms / 45);
        b.stream.scale.set(wob, len, 2 - wob);
        b.stream.position.set(b.noz.x, b.noz.y - 0.03 - len / 2, b.noz.z);
        b.stream.material.opacity = 0.8 * b.flow;
      }
      for (const dr of b.drops) {
        const ud = dr.userData as { v: number; a: number; fall: boolean };
        dr.visible = !this.reduce && b.flow > 0.9 && (pumping || ud.fall);
        if (!dr.visible) continue;
        ud.v += dt * 2.2;
        if (ud.v > 1) { ud.v = 0; ud.fall = pumping; }
        const t = ud.v;
        dr.position.set(b.noz.x + Math.cos(ud.a) * t * 0.12, SOIL_TOP + 0.03 + Math.sin(t * Math.PI) * 0.07, b.noz.z + Math.sin(ud.a) * t * 0.12);
      }

      b.rim.emissiveIntensity = b.id === 'A' ? decGlow * 0.6 : 0;
    }


    // no idle camera motion: nothing moves on its own except in response to data or the user
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('wheel', this.onZoom);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const x of mats) x.dispose();
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}

function nameOf(o: THREE.Object3D): string {
  // glTF multi-primitive nodes load as a Group of meshes; the part name sits on the parent
  return o.name + ' ' + (o.parent?.name ?? '');
}
