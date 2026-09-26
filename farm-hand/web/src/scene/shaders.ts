/**
 * Soil + water look for one Farm Hand box.
 *
 * ADAPTED FROM Prompt Grass Grow Grass (HackMIT 2026), web/src/scene/shaders.ts
 *   https://github.com/SamisLife/PromptGrassGrowGrass (MIT License, Copyright (c) 2026 PromptGrassGrowGrass contributors)
 * via farm-hand/laptop/static/soil_shader.js (our earlier three.js scene).
 * Kept: procedural dirt (dry/wet colours, grain, cracks that close when wet), the pour (fingered wetting front,
 * puddle, ripples, splash rings) and the seepage seen through the box wall.
 * Added: uKnown, so a disconnected probe shows flat grey soil instead of a made-up moisture.
 */
import * as THREE from 'three';

const FIELD = /* glsl */ `
uniform float uTime, uScale, uTopY, uThick, uInset;
uniform float uM;                 // 0..1 settled moisture from the probe (smoothed on the CPU)
uniform float uTemp;              // 0..1 cold..warm, -1 unknown
uniform vec3 uPour;               // xy = where the water lands (scaled xz), z = front radius (scaled)
uniform float uPourActive, uPourWet, uPourAge;
uniform float uLayer;             // depth (0..1 of the soil) the spread water has soaked down to (modeled)
uniform float uKnown;             // 1 = probe reporting, 0 = disconnected: neutral grey, never a fake reading

float sstep(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0., 1.); return t*t*(3. - 2.*t); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }

// wetting front: a noisy, fingered edge, so it reads as water finding its way through earth
float pourFront(vec2 p){
  float d = distance(p, uPour.xy);
  float n = fbm(p*1.7 + 11.) * .62 + vnoise(p*7.) * .22 + vnoise(p*19.) * .08;
  float edge = uPour.z * (.72 + .56*n);
  float soft = .08 + .30 * min(1., uPour.z);
  return 1. - sstep(edge - soft, edge + .03, d);
}
float pourInside(vec2 p){
  float d = distance(p, uPour.xy);
  float n = fbm(p*1.7 + 11.) * .62 + vnoise(p*7.) * .22 + vnoise(p*19.) * .08;
  float edge = uPour.z * (.72 + .56*n);
  return clamp((edge - d) / max(edge, .001), 0., 1.);
}
float fieldMoistureBase(vec2 p){ return clamp(uM * (1. + (fbm(p*2.3 + uTime*.02) - .5) * .22), 0., 1.); }
float fieldMoisture(vec2 p){
  float m = fieldMoistureBase(p);
  if(uPourActive > 0.) m = max(m, pourFront(p) * uPourWet * uPourActive);
  return clamp(m, 0., 1.);
}
`;

export const SOIL_VERT = /* glsl */ `
varying vec3 vWorld; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const SOIL_FRAG = /* glsl */ `
${FIELD}
varying vec3 vWorld; varying vec3 vN;
uniform float uLens;              // 0 natural, 1 moisture, 2 temperature
uniform sampler2D uGrain;         // Farm Hand: real soil scan (Poly Haven farm_soil, CC0, greyscale) for the crumb detail on the sides
uniform vec3 cSoilDry, cSoilWet, cSoilSub, cSoilDeep, cWater, cWarm, cCool;
const vec3 L = normalize(vec3(.45, .85, .35));

float cracks(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i+g);
    float d = length(g + o - f);
    if(d < d1){ d2 = d1; d1 = d; } else if(d < d2){ d2 = d; }
  }
  return d2 - d1;
}
vec3 bumpNormal(vec3 N, float h, float scale){
  vec3 sx = dFdx(vWorld * uScale), sy = dFdy(vWorld * uScale);
  vec3 r1 = cross(sy, N), r2 = cross(N, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * N - scale * grad);
}
vec3 moistureRamp(float m){
  vec3 a = vec3(.62,.50,.36), b = vec3(.30,.55,.45), c = vec3(.10,.42,.85);
  return m < .5 ? mix(a, b, m*2.) : mix(b, c, (m-.5)*2.);
}

void main(){
  vec3 P = vWorld * uScale;
  vec2 p = P.xz;
  vec3 V = normalize(cameraPosition - vWorld);
  bool top = vN.y > .5;
  vec2 pm = top ? p : p - normalize(vN.xz + 1e-5) * uInset;   // the sides sample a little inside, like a cross-section
  float m = fieldMoisture(pm);
  vec3 col;

  if(top){
    float g1 = fbm(p*2.6), g2 = fbm(p*5. + 4.), g3 = vnoise(p*17.);
    float grain = g1*.58 + g2*.36 + g3*.06;
    float wetness = sstep(.06, .82, m);
    vec3 dry = cSoilDry * (.80 + .40*grain);
    vec3 wet = cSoilWet * (.70 + .65*grain);
    col = mix(dry, wet, wetness);
    // parched soil cracks; the cracks close as it wets
    float ck = cracks(p*2.4 + fbm(p*1.3)*.6);
    float crackMask = (1. - sstep(.0, .07, ck)) * (1. - sstep(.12, .38, m));
    col *= 1. - .6*crackMask;
    // (Farm Hand: no grey-out when dry. Dry soil should look like dry tan dirt, not dull grey.)
    vec3 N = bumpNormal(vec3(0,1,0), g1*.8 + g2*.2 - crackMask*.5, mix(.9, .22, wetness));
    // standing water where it lands, with ripples
    float pool = 0.;
    if(uPourActive > 0.){
      float d = distance(p, uPour.xy);
      pool = sstep(.55, .0, d / clamp(uPour.z*.45, .35, .6)) * uPourActive * sstep(8., 0., max(uPourAge, 0.) - 6.);   // Farm Hand: puddle stays small
      float rip = sin(d*34. - uTime*7.) * .5 + .5;
      N = normalize(mix(N, vec3(0,1,0) + vec3(rip-.5, 0., rip-.5)*.18, pool*.85));
      float e = pourFront(p);
      float lead = sstep(.02,.35,e) * (1. - sstep(.35,.9,e));            // the leading edge: darker, glistening
      col = mix(col, cSoilWet*.55, lead*.5*uPourActive);
      col = mix(col, cWater*.55 + col*.4, pool*.55);
      if(uPourAge >= 0. && uPourAge < 4.){                              // splash rings in the first seconds
        float rr = uPourAge*.55;
        float ring = sstep(.07, 0., abs(d - rr)) + sstep(.05, 0., abs(d - rr*.55));
        col += cWater * ring * .35 * (1. - uPourAge/4.);
      }
    }
    float diff = max(dot(N, L), 0.);
    vec3 H = normalize(L + V);
    vec3 Ns = normalize(mix(bumpNormal(vec3(0,1,0), g1, .22), N, pool));
    float spec = min(pow(max(dot(Ns, H), 0.), mix(10., 40., wetness)) * mix(.02, .14, sstep(.35, .95, m)), .09) + pow(max(dot(Ns, H), 0.), 90.) * pool * .8;
    float rim = pow(1. - max(dot(N, V), 0.), 3.);
    col = col * (.34 + .86*diff) + vec3(.85,.93,1.) * spec + col * rim * .25;
    if(uTemp >= 0.){
      vec3 tcol = mix(cCool, cWarm, sstep(.15,.85,uTemp));
      col += tcol * .035;
      if(uLens > 1.5) col = mix(col, tcol * (.55 + .5*grain), .78);
    }
    if(uLens > .5 && uLens < 1.5) col = mix(col, moistureRamp(m) * (.6 + .5*grain), .82);
  } else {
    // the side against the plastic: strata, and water seeping down under wet ground
    float depth = clamp((uTopY - vWorld.y) / uThick, 0., 1.);
    float along = abs(vN.x) > .5 ? P.z : P.x;
    vec2 sp = vec2(along, P.y);
    float warp = (fbm(vec2(along*1.4, 3.)) - .5) * .16;
    float d = depth + warp;
    // Farm Hand change: the side is the soil pressed against the plastic, so draw it as clumps with dark gaps
    // (same dry/wet colors as the top), not smooth strata. Smooth bands + light dots read as muddy water.
    float grain = fbm(sp*2.6)*.6 + fbm(sp*5. + 4.)*.4;
    float photo = mix(texture2D(uGrain, sp * .75).r, texture2D(uGrain, sp.yx * .29 + .37).r, .4);   // two sizes of the scan: visible crumbs, no tile repeat
    float pore = sstep(.72, .84, vnoise(sp * 30.) * .7 + vnoise(sp * 71. + 3.) * .3);               // little dark air gaps between crumbs
    photo = clamp((photo - .42) * 2.1 + .5, 0., 1.);                                 // more contrast: crumbs and the gaps between them
    // settled moisture has soaked deep; behind a fresh front the water is only as deep as it has had time to go
    float wob = (vnoise(sp*5.) - .5) * .18;
    float mB = fieldMoistureBase(pm);
    // Farm Hand change: settled moisture darkens the whole side evenly (a bit more low down, where water drains).
    // A dark band with a level edge read as a water line in a tank.
    // Farm Hand: realistic infiltration seen through the wall. Starts as a wet dome under the tube, widens as the
    // water spreads over the top, and flattens into a layer. A few fingers run ahead (water finding paths), a
    // lighter damp band leads the wet edge, and it is wettest near the top.
    float wetSide = 0., dampBand = 0.;
    if(uPourActive > 0.){
      float dist = distance(pm, uPour.xy);
      float n = fbm(pm*1.7 + 11.) * .62 + vnoise(pm*7.) * .22;
      float R = uPour.z * (.75 + .5*n);
      float cover = 1. - sstep(R*.55, R*1.02, dist);                        // has the spreading water reached above this spot?
      float near = sstep(1.6, .2, dist);                                    // right under the tube
      float finger = (vnoise(vec2(along*4., uTime*.04)) - .5) * .18 + (vnoise(vec2(along*11., 3.)) - .5) * .07 + (vnoise(sp*18.) - .5) * .05
                   - pow(vnoise(vec2(along*2.3, 7.)), 3.) * .35 * uLayer;   // preferential-flow fingers run ahead
      float front = uLayer * cover * (1. + .5*near) + .05 * near;
      float x = depth + finger;
      float has = step(.001, front) * uPourActive;
      wetSide = (1. - sstep(front - .05, front + .02, x)) * has;
      dampBand = (1. - sstep(front, front + .11, x)) * (1. - wetSide) * has;
      wetSide *= 1. - .4 * clamp(x / max(front, .01), 0., 1.);              // wettest near the top
    }
    float wetness = max(wetSide, max(dampBand * .3, sstep(.06, .82, mB) * (.72 + .25*depth)));
    vec3 dryCol = cSoilDry * (.3 + 1.2 * photo) * (.9 + .2*grain) * (1. - .55 * pore);
    vec3 wetCol = cSoilWet * 1.3 * (.45 + 1.1 * photo) * (.9 + .2*grain) * (1. - .25 * pore);   // wet: darker, but the grain still shows
    col = mix(dryCol, wetCol, wetness);
    float gh = hash12(floor(sp * 110.));
    col += vec3(.45, .5, .55) * step(.992, gh) * wetSide * (.5 + .5 * sin(uTime * 1.5 + gh * 40.));   // water glints against the plastic
    col *= mix(1., .82, sstep(.3, 1., depth));
    float diff = max(dot(vN, L), 0.);
    col *= .95 + .3*diff;                                              // our side faces the camera, not the light: keep it readable
    col *= .75 + .25*sstep(0., .06, depth);
    if(uLens > .5 && uLens < 1.5) col = mix(col, moistureRamp(max(mB, max(wetSide, dampBand * .4) * uPourWet)) * (.6 + .5*grain), .7);
    if(uLens > 1.5 && uTemp >= 0.) col = mix(col, mix(cCool, cWarm, sstep(.15,.85,uTemp)) * (.55 + .5*grain), .7);
  }
  // unknown moisture is its own look (flat grey earth), not a fabricated dry value
  float lumU = dot(col, vec3(.3,.59,.11));
  col = mix(col, vec3(.50,.50,.49) * (.75 + .5*lumU), 1. - uKnown);
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;


let grain: THREE.Texture | null = null;
function grainTex(): THREE.Texture {
  if (grain) return grain;
  grain = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'models/soil_grain.jpg');
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.colorSpace = THREE.NoColorSpace;
  return grain;
}

export type SoilUniforms = {
  uTime: { value: number }; uScale: { value: number }; uTopY: { value: number }; uThick: { value: number }; uInset: { value: number };
  uM: { value: number }; uTemp: { value: number }; uLens: { value: number }; uKnown: { value: number };
  uPour: { value: THREE.Vector3 }; uPourActive: { value: number }; uPourWet: { value: number }; uPourAge: { value: number }; uLayer: { value: number };
  [k: string]: { value: unknown };
};

/** Colours: dry tan to wet near-black; warm/cool match the temperature probe tint. */
export function soilMaterial(): THREE.ShaderMaterial & { uniforms: SoilUniforms } {
  const c = (h: string) => ({ value: new THREE.Color(h) });
  const uniforms: SoilUniforms = {
    uTime: { value: 0 }, uScale: { value: 2.5 }, uTopY: { value: .96 }, uThick: { value: .93 }, uInset: { value: 1.2 },
    uM: { value: .3 }, uTemp: { value: -1 }, uLens: { value: 0 }, uKnown: { value: 0 },
    uPour: { value: new THREE.Vector3() }, uPourActive: { value: 0 }, uPourWet: { value: .95 }, uPourAge: { value: -1 }, uLayer: { value: 0 },
    cSoilDry: c('#b0915f'), cSoilWet: c('#2e2319'), cSoilSub: c('#6b5138'), cSoilDeep: c('#3a2a1e'), cWater: c('#3aa8ff'),
    cWarm: c('#e0772e'), cCool: c('#3f82d6'), uGrain: { value: grainTex() },
  };
  return new THREE.ShaderMaterial({ vertexShader: SOIL_VERT, fragmentShader: SOIL_FRAG, uniforms }) as THREE.ShaderMaterial & { uniforms: SoilUniforms };
}
