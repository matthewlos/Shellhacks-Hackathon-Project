/**
 * RegionLayer: the real fields around the Farm Hand bench, seen when the camera pulls back from the two boxes.
 *
 * Fed by `RegionView` (src/data/types.ts). For Farm Hand the backend fills it from an AlphaEarth v2 dataset
 * (Google DeepMind satellite embeddings around FIU / Redland): one instanced block per grid cell, tinted by the
 * legend colour of its PREDICTED crop type. Fields the backend ranks as similar to the Farm Hand box (`matches`)
 * stay in full colour and get a line to the pin; everything else steps back. Every tint comes from the data.
 *
 * NOT TO SCALE, on purpose: a cell is hundreds of metres of real land while the boxes in the middle are drawn at
 * bench scale, so they stay the object the user was just looking at. The pin marks where the bench really is.
 *
 * Motion: the land rises from the bench outward, once, with an exponential ease-out (the zoom-out is the authored
 * moment). It is driven by a damped value, so it reverses smoothly if the user heads back mid-way. Reduced motion:
 * instant. No idle pulsing.
 */
import * as THREE from 'three';
import type { FarmMatch, Region } from '../data/types';

export const CELL = 2.3;            // world units per grid cell
export const GROUND = -0.97;        // land tops sit just under the bench top (y = 0)
const CLEARING = 0.6;               // world units kept free around the bench

/** blue = Farm Hand (box A) in the house palette; similar fields and the pin use it */
const FH_BLUE = '#2a78d6';
const PAPER = '#efece4';

const VERT = /* glsl */ `
attribute vec3 aColor;
attribute vec4 aInfo;   // x: match strength 0..1, y: field index (-1 = not a field), z: random, w: 0 land / 1 rows / 2 trees
uniform float uRegion, uRadius, uRiseR, uSel, uHover;
uniform vec2 uHome;      // the bench, in grid coordinates
varying vec3 vColor; varying vec4 vInfo; varying vec3 vN; varying vec3 vW; varying vec2 vTop; varying float vRise; varying float vR;
void main() {
  vec2 centre = instanceMatrix[3].xz;
  vR = max(abs(centre.x), abs(centre.y)) / uRadius;   // square grid, soft edge
  // the land arrives from the bench outwards
  float rise = clamp(uRegion * 1.9 - length(centre - uHome) / uRiseR * 0.9, 0., 1.);
  rise = 1. - pow(1. - rise, 3.);                       // ease-out per cell
  vec4 p = instanceMatrix * vec4(position, 1.);
  float lift = aInfo.x * 0.32 * rise;
  if (aInfo.y >= 0. && abs(aInfo.y - uSel) < .5) lift += .34;
  else if (aInfo.y >= 0. && abs(aInfo.y - uHover) < .5) lift += .12;
  p.y += lift - (1. - rise) * 1.6;
  vColor = aColor; vInfo = aInfo; vN = normal; vW = p.xyz; vTop = position.xz; vRise = rise;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
}`;

const FRAG = /* glsl */ `
uniform float uSel, uHover, uHasMatches;
uniform vec3 cAccent, cPaper;
varying vec3 vColor; varying vec4 vInfo; varying vec3 vN; varying vec3 vW; varying vec2 vTop; varying float vRise; varying float vR;
void main() {
  float top = step(.5, vN.y);
  vec3 col = vColor;
  // fields read as fields: crop rows, or the dot grid of an orchard / grove
  if (vInfo.w > 1.5) {
    vec2 g = fract(vW.xz * 2.6 + vInfo.z) - .5;
    col *= mix(.8, 1.12, smoothstep(.34, .2, length(g)));
  } else if (vInfo.w > .5) {
    float a = floor(vInfo.z * 4.) * .7854;
    col *= 1. + .07 * sin(dot(vW.xz, vec2(cos(a), sin(a))) * 15.);
  } else {
    col *= .94 + .08 * fract(sin(dot(floor(vW.xz * 3.), vec2(12.9898, 78.233))) * 43758.5453);
  }
  float light = mix(.72 + .12 * vN.x, 1., top);
  float match = vInfo.x;
  float sel = (vInfo.y >= 0. && abs(vInfo.y - uSel) < .5) ? 1. : 0.;
  float hov = (vInfo.y >= 0. && abs(vInfo.y - uHover) < .5) ? 1. : 0.;
  // light theme: everything that is not a match fades toward the paper colour instead of going dark
  float keep = max(max(step(.01, match), sel), hov * .8);
  vec3 muted = mix(col, cPaper, .62);
  col = mix(col, mix(muted, col, keep), uHasMatches);
  col *= light;
  float edge = smoothstep(.40, .49, max(abs(vTop.x), abs(vTop.y))) * top;
  col = mix(col, cAccent, edge * max(match * .8, sel));
  col += vec3(.06) * hov;
  float alpha = vRise * (1. - smoothstep(.9, 1.04, vR));
  if (alpha < .01) discard;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const TREES = new Set(['orchard', 'vineyard', 'hops_herbs', 'forest']);
const LAND_HEIGHT: Record<string, number> = { forest: .5, shrub: .24, wetland: .12, water: .06, developed: .3, barren: .16, pasture: .2, fallow: .18, nodata: .05 };

export class RegionLayer {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private info: THREE.InstancedBufferAttribute | null = null;
  private lines = new THREE.Group();
  private bench: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private pin = new THREE.Group();
  private pinMats: THREE.Material[] = [];
  private uniforms = {
    uRegion: { value: 0 }, uRadius: { value: 1 }, uRiseR: { value: 1 }, uHome: { value: new THREE.Vector2() }, uSel: { value: -1 }, uHover: { value: -1 }, uHasMatches: { value: 0 },
    cAccent: { value: new THREE.Color(FH_BLUE) }, cPaper: { value: new THREE.Color(PAPER) },
  };
  private region: Region | null = null;
  private fieldIndex = new Map<string, number>();
  private matchKey = '';
  private clear = { x: 3, z: 2 };
  /**
   * Where the bench really is, in grid coordinates (from the place's lat/lon vs the region centre).
   * The whole layer is shifted by -home so the bench, and the boxes on it, sit at the world origin and every
   * field sits at its true direction and distance from them (in grid units).
   */
  readonly home = new THREE.Vector3(0, 0, 0);
  amount = 0;                                  // 0 = at the boxes, 1 = over the region (animated)

  constructor() {
    this.bench = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.9, transparent: true, opacity: 0 }));
    this.bench.geometry.translate(0, -0.5, 0);
    this.bench.receiveShadow = true;
    this.bench.position.y = -0.006;              // just under the shadow catcher the boxes stand on
    this.group.add(this.bench, this.lines, this.pin);

    // the Farm Hand pin: a thin blue beam with a soft halo, so the bench is findable from far away
    const beamMat = new THREE.MeshBasicMaterial({ color: FH_BLUE, transparent: true, opacity: 0, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 12, 1, true), beamMat);
    beam.geometry.translate(0, 0.5, 0);
    beam.scale.y = 9;
    const headMat = new THREE.MeshBasicMaterial({ color: FH_BLUE, transparent: true, opacity: 0 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), headMat);
    head.position.y = 9.4;
    const haloMat = new THREE.MeshBasicMaterial({ color: FH_BLUE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), haloMat);
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; halo.scale.setScalar(4.2);
    this.pin.add(beam, head, halo);
    this.pinMats = [beamMat, headMat, haloMat];
    this.group.visible = false;
  }

  get ready(): boolean { return !!this.mesh; }
  get half(): number { return this.region ? (this.region.n * CELL) / 2 : 30; }
  /** half-size of what the zoomed-out view has to show: the grid plus the bench, wherever it is */
  get extent(): number { return this.half + Math.hypot(this.home.x, this.home.z) / 2; }
  private get pinScale(): number { return Math.max(1, this.extent / 45); }
  /** world point to aim the zoomed-out camera at: halfway between the bench and the middle of the grid */
  viewCentre(out = new THREE.Vector3()): THREE.Vector3 { return out.set(-this.home.x / 2, GROUND, -this.home.z / 2); }
  /** world point the pin label anchors to (the bench is the world origin) */
  pinTop(out = new THREE.Vector3()): THREE.Vector3 { return out.set(0, 10.6 * this.pinScale, 0); }

  /** world position of a field's centroid, on top of the land */
  fieldPos(id: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    const f = this.region?.fields[this.fieldIndex.get(id) ?? -1];
    if (!f || !this.region) return null;
    const mid = (this.region.n - 1) / 2;
    return out.set((f.cx - mid) * CELL - this.home.x, GROUND + 0.75, (f.cy - mid) * CELL - this.home.z);
  }

  /** the field under a point on the ground plane, if there is one */
  fieldAt(wx: number, wz: number): string | null {
    const r = this.region;
    if (!r) return null;
    const x = wx + this.home.x, z = wz + this.home.z;
    const gx = Math.floor(x / CELL + r.n / 2), gy = Math.floor(z / CELL + r.n / 2);
    if (gx < 0 || gy < 0 || gx >= r.n || gy >= r.n) return null;
    if (Math.abs(wx) < this.clear.x && Math.abs(wz) < this.clear.z) return null;
    const idx = r.fieldOf[gy * r.n + gx];
    return idx >= 0 ? r.fields[idx]?.id ?? null : null;
  }

  /**
   * @param benchW, benchL  world size of the bench the boxes sit on (kept clear of land)
   * @param place           the bench's real location; the pin goes there (region centre when unknown)
   */
  setRegion(region: Region | null, benchW: number, benchL: number, place?: { lat: number; lon: number } | null): void {
    if (region === this.region) return;
    this.region = region;
    this.matchKey = '';
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh = null; this.info = null; }
    this.fieldIndex.clear();
    if (!region || !region.n || !region.cells?.length) return;
    region.fields.forEach((f, i) => this.fieldIndex.set(f.id, i));
    this.clear = { x: benchW / 2 + CLEARING, z: benchL / 2 + CLEARING };
    this.bench.scale.set(this.clear.x * 2 - 0.25, -GROUND + 0.02, this.clear.z * 2 - 0.25);

    // pin at the real location, relative to the grid centre (km -> cells -> world)
    this.home.set(0, 0, 0);
    if (place && region.centre && region.cellM > 0) {
      const kmE = (place.lon - region.centre.lon) * 111.32 * Math.cos((region.centre.lat * Math.PI) / 180);
      const kmN = (place.lat - region.centre.lat) * 110.57;
      const k = (1000 / region.cellM) * CELL;
      const lim = region.n * CELL * 4;              // guard against a bad coordinate, not a real limit
      this.home.set(THREE.MathUtils.clamp(kmE * k, -lim, lim), 0, THREE.MathUtils.clamp(-kmN * k, -lim, lim));
    }
    this.group.position.set(-this.home.x, 0, -this.home.z);
    this.pin.position.copy(this.home);
    this.pin.scale.setScalar(this.pinScale);
    this.bench.position.x = this.home.x; this.bench.position.z = this.home.z;
    this.uniforms.uHome.value.set(this.home.x, this.home.z);

    const n = region.n, mid = (n - 1) / 2;
    const byCode = new Map(region.legend.map((l) => [l.code, l]));
    const keep: number[] = [];
    for (let i = 0; i < n * n; i++) {
      const x = ((i % n) - mid) * CELL, z = (((i / n) | 0) - mid) * CELL;
      if (Math.abs(x - this.home.x) < this.clear.x && Math.abs(z - this.home.z) < this.clear.z) continue;
      keep.push(i);
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, -0.5, 0);                                   // origin on the top face
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true });
    const mesh = new THREE.InstancedMesh(geo, mat, keep.length);
    const colors = new Float32Array(keep.length * 3), info = new Float32Array(keep.length * 4);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    keep.forEach((i, k) => {
      const code = region.cells[i], l = byCode.get(code), fam = l?.family ?? 'nodata', r = rnd();
      const farmed = (region.fieldOf[i] ?? -1) >= 0;
      const top = GROUND + (farmed ? 0.3 + r * 0.12 + (TREES.has(fam) ? 0.12 : 0) : (LAND_HEIGHT[fam] ?? 0.15) + r * 0.05);
      m.makeScale(CELL * 0.94, 1.6, CELL * 0.94).setPosition(((i % n) - mid) * CELL, top, (((i / n) | 0) - mid) * CELL);
      mesh.setMatrixAt(k, m);
      c.set(l?.color ?? '#c9c4b8');
      colors.set([c.r, c.g, c.b], k * 3);
      info.set([0, region.fieldOf[i] ?? -1, r, !farmed && fam !== 'forest' ? 0 : TREES.has(fam) ? 2 : 1], k * 4);
    });
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    this.info = new THREE.InstancedBufferAttribute(info, 4);
    geo.setAttribute('aInfo', this.info);
    mesh.frustumCulled = false;
    this.uniforms.uRadius.value = this.half;
    this.uniforms.uRiseR.value = this.half + Math.hypot(this.home.x, this.home.z);
    this.mesh = mesh;
    this.group.add(mesh);
  }

  /** light the fields the backend ranks as similar, and draw their lines to the pin */
  setMatches(matches: FarmMatch[]): void {
    const key = matches.map((m) => m.fieldId + m.score).join('|');
    if (key === this.matchKey || !this.region || !this.info) return;
    this.matchKey = key;
    const strength = new Map<number, number>();
    const best = Math.max(...matches.map((m) => m.score), 1e-6);
    for (const m of matches) strength.set(this.fieldIndex.get(m.fieldId) ?? -2, 0.5 + 0.5 * Math.max(0, m.score / best));
    const a = this.info.array as Float32Array;
    for (let k = 0; k < a.length / 4; k++) a[k * 4] = strength.get(a[k * 4 + 1]) ?? 0;
    this.info.needsUpdate = true;
    this.uniforms.uHasMatches.value = matches.length ? 1 : 0;

    for (const l of [...this.lines.children]) { this.lines.remove(l); (l as THREE.Line).geometry.dispose(); ((l as THREE.Line).material as THREE.Material).dispose(); }
    const home = this.home.clone().setY(0.4);
    for (const m of matches) {
      const to = this.fieldPos(m.fieldId);
      if (!to) continue;
      to.x += this.home.x; to.z += this.home.z;        // lines live inside the shifted group
      const midPt = home.clone().lerp(to, 0.5);
      midPt.y += 1.6 + home.distanceTo(to) * 0.16;
      const pts = new THREE.QuadraticBezierCurve3(home, midPt, to).getPoints(40);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: FH_BLUE, transparent: true, opacity: 0, depthWrite: false }));
      line.userData.id = m.fieldId;
      this.lines.add(line);
    }
  }

  /** `instant`: prefers-reduced-motion, jump straight to the end state */
  update(dt: number, on: boolean, selected: string | null, hover: string | null, instant = false): void {
    const target = on && this.mesh ? 1 : 0;
    this.amount = instant ? target : this.amount + (target - this.amount) * (1 - Math.exp(-(on ? 1.6 : 3.2) * dt));
    if (Math.abs(target - this.amount) < 0.002) this.amount = target;
    this.group.visible = this.amount > 0.004;
    const u = this.uniforms;
    u.uRegion.value = this.amount;
    u.uSel.value = selected ? this.fieldIndex.get(selected) ?? -1 : -1;
    u.uHover.value = hover ? this.fieldIndex.get(hover) ?? -1 : -1;
    this.bench.material.opacity = Math.min(1, this.amount * 2);
    // the pin and the lines arrive after the land has
    const late = Math.max(0, this.amount * 2.2 - 1.2);
    const [beam, head, halo] = this.pinMats as THREE.MeshBasicMaterial[];
    beam.opacity = late * 0.6; head.opacity = late; halo.opacity = late * 0.35;
    for (const l of this.lines.children) {
      const mat = (l as THREE.Line).material as THREE.LineBasicMaterial;
      const focus = !selected || l.userData.id === selected;
      mat.opacity = late * (focus ? (selected ? 0.95 : 0.6) : 0.15);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const x of mats) x.dispose();
    });
  }
}
