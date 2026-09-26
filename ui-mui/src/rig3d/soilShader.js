// Soil + water look for the Farm Hand box.
//
// ADAPTED FROM Prompt Grass Grow Grass (HackMIT 2026), web/src/scene/shaders.ts
//   https://github.com/SamisLife/PromptGrassGrowGrass  (MIT License, Copyright (c) 2026 PromptGrassGrowGrass contributors)
//   Full license text: ui-mui/THIRD_PARTY_NOTICES.md
// Taken: the procedural dirt (dry/wet colors, grain, cracks that close when wet, bump shading), the pour animation
// (fingered wetting front, standing water with ripples, splash rings) and the cut-side seepage.
// Changed for Farm Hand (farm-hand/laptop/static/soil_shader.js): after landing, the water spreads over the whole top
// and sinks as an even layer; the side uses a real soil scan for the crumbs; one probe instead of zones; a box
// instead of a slab; no zones / blueprint / scan / agent rings.
// Changed for the web UI (ui-mui/src/rig3d): soil colors come from the theme tokens (rig.soilDry / rig.soilWet) and
// are blended in OKLab; no lens modes and no temperature tint on the soil (the DS18B20 tip carries temperature);
// no time drift in the settled moisture (no ambient motion); a hand-pour patch away from the nozzle; and the
// waterline, the min and the target drawn on the soil's sides as screen-width lines, as in the 2D drawing.
import * as THREE from 'three';

const FIELD = /* glsl */ `
uniform float uTime, uScale, uTopY, uThick, uInset;
uniform float uM;                 // 0..1 settled moisture (the drawing's spring, mapped over the working band)
uniform vec3 uPour;               // xy = where the water lands (scaled xz), z = front radius (scaled)
uniform float uPourActive, uPourWet, uPourAge;
uniform float uLayer;             // depth (0..1 of the soil) the evenly spread water has soaked down to
uniform vec3 uHand;               // a hand pour: xy = where the cup was tipped (scaled xz), z = radius (scaled)
uniform float uHandA;             // 0..1, how visible that patch still is

float sstep(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0., 1.); return t*t*(3. - 2.*t); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }

// wetting front: a noisy, fingered edge, so it reads as water finding its way through earth
float frontAt(vec2 p, vec3 c){
  float d = distance(p, c.xy);
  float n = fbm(p*1.7 + 11.) * .62 + vnoise(p*7.) * .22 + vnoise(p*19.) * .08;
  float edge = c.z * (.72 + .56*n);
  float soft = .08 + .30 * min(1., c.z);
  return 1. - sstep(edge - soft, edge + .03, d);
}
float pourFront(vec2 p){ return frontAt(p, uPour); }
float fieldMoistureBase(vec2 p){ return clamp(uM * (1. + (fbm(p*2.3) - .5) * .22), 0., 1.); }
float fieldMoisture(vec2 p){
  float m = fieldMoistureBase(p);
  if(uPourActive > 0.) m = max(m, pourFront(p) * uPourWet * uPourActive);
  if(uHandA > 0.) m = max(m, frontAt(p, uHand) * uPourWet * uHandA);
  return clamp(m, 0., 1.);
}
`;

const VERT = /* glsl */ `
varying vec3 vWorld; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${FIELD}
varying vec3 vWorld; varying vec3 vN;
uniform sampler2D uGrain;         // real soil scan (Poly Haven farm_soil, CC0, greyscale) for the crumb detail on the sides
uniform vec3 cSoilDry, cSoilWet, cWater, cLine, cMin, cTarget;
uniform float uSoilBot;           // world y of the soil's floor; uTopY is its surface
uniform float uLevel;             // waterline height, 0..1 of the soil depth (-1 hides it)
uniform float uMin;               // the level box A keeps (-1 hides it)
uniform float uTarget;            // the target run's level (-1 hides it)
const vec3 L = normalize(vec3(.45, .85, .35));

// OKLab (Ottosson), on linear sRGB: the dry-to-wet blend stays a soil color, never a grey midpoint
vec3 toLab(vec3 c){
  vec3 l = vec3(.4122214708*c.r + .5363325363*c.g + .0514459929*c.b,
                .2119034982*c.r + .6806995451*c.g + .1073969566*c.b,
                .0883024619*c.r + .2817188376*c.g + .6299787005*c.b);
  l = pow(max(l, 0.), vec3(1./3.));
  return vec3(.2104542553*l.x + .7936177850*l.y - .0040720468*l.z,
              1.9779984951*l.x - 2.4285922050*l.y + .4505937099*l.z,
              .0259040371*l.x + .7827717662*l.y - .8086757660*l.z);
}
vec3 fromLab(vec3 c){
  vec3 l = vec3(c.x + .3963377774*c.y + .2158037573*c.z,
                c.x - .1055613458*c.y - .0638541728*c.z,
                c.x - .0894841775*c.y - 1.2914855480*c.z);
  l = l*l*l;
  return vec3( 4.0767416621*l.x - 3.3077115913*l.y + .2309699292*l.z,
              -1.2684380046*l.x + 2.6097574011*l.y - .3413193965*l.z,
              -.0041960863*l.x - .7034186147*l.y + 1.7076147010*l.z);
}
vec3 soilMix(float k){ return max(fromLab(mix(toLab(cSoilDry), toLab(cSoilWet), clamp(k, 0., 1.))), 0.); }

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
// a line at height y (world), about px pixels wide on screen whatever the zoom
float hline(float y, float px){
  float w = max(fwidth(vWorld.y), 1e-5);
  return 1. - sstep(px*.5*w, (px*.5 + 1.)*w, abs(vWorld.y - y));
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
    col = soilMix(wetness) * mix(.80 + .40*grain, .70 + .65*grain, wetness);
    // parched soil cracks; the cracks close as it wets
    float ck = cracks(p*2.4 + fbm(p*1.3)*.6);
    float crackMask = (1. - sstep(.0, .07, ck)) * (1. - sstep(.12, .38, m));
    col *= 1. - .6*crackMask;
    vec3 N = bumpNormal(vec3(0,1,0), g1*.8 + g2*.2 - crackMask*.5, mix(.9, .22, wetness));
    // standing water where it lands, with ripples (only during a pour)
    float pool = 0.;
    if(uPourActive > 0.){
      float d = distance(p, uPour.xy);
      pool = sstep(.55, .0, d / clamp(uPour.z*.45, .35, .6)) * uPourActive * sstep(8., 0., max(uPourAge, 0.) - 6.);
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
  } else {
    // the side against the plastic: crumbs from the scan, and water seeping down under wet ground
    float depth = clamp((uTopY - vWorld.y) / uThick, 0., 1.);
    float along = abs(vN.x) > .5 ? P.z : P.x;
    vec2 sp = vec2(along, P.y);
    float grain = fbm(sp*2.6)*.6 + fbm(sp*5. + 4.)*.4;
    float photo = mix(texture2D(uGrain, sp * .75).r, texture2D(uGrain, sp.yx * .29 + .37).r, .4);   // two sizes of the scan: visible crumbs, no tile repeat
    float pore = sstep(.72, .84, vnoise(sp * 30.) * .7 + vnoise(sp * 71. + 3.) * .3);               // little dark air gaps between crumbs
    photo = clamp((photo - .42) * 2.1 + .5, 0., 1.);
    float mB = fieldMoistureBase(pm);
    // realistic infiltration seen through the wall: a wet dome under the tube that widens and flattens into a layer,
    // a few fingers running ahead, a lighter damp band leading the wet edge, wettest near the top
    float wetSide = 0., dampBand = 0.;
    if(uPourActive > 0.){
      float dist = distance(pm, uPour.xy);
      float n = fbm(pm*1.7 + 11.) * .62 + vnoise(pm*7.) * .22;
      float R = uPour.z * (.75 + .5*n);
      float cover = 1. - sstep(R*.55, R*1.02, dist);
      float near = sstep(1.6, .2, dist);
      float finger = (vnoise(vec2(along*4., 1.7)) - .5) * .18 + (vnoise(vec2(along*11., 3.)) - .5) * .07 + (vnoise(sp*18.) - .5) * .05
                   - pow(vnoise(vec2(along*2.3, 7.)), 3.) * .35 * uLayer;
      float front = uLayer * cover * (1. + .5*near) + .05 * near;
      float x = depth + finger;
      float has = step(.001, front) * uPourActive;
      wetSide = (1. - sstep(front - .05, front + .02, x)) * has;
      dampBand = (1. - sstep(front, front + .11, x)) * (1. - wetSide) * has;
      wetSide *= 1. - .4 * clamp(x / max(front, .01), 0., 1.);
    }
    // the modeled waterline: under it the soil is a little wetter (the 2D drawing's 24% wet layer)
    float h01 = (vWorld.y - uSoilBot) / max(uTopY - uSoilBot, 1e-3);
    float below = uLevel >= 0. ? sstep(uLevel + .01, uLevel - .03, h01) : 0.;
    float wetness = max(wetSide, max(dampBand * .3, max(sstep(.06, .82, mB) * (.45 + .2*depth), below * .24 + sstep(.06, .82, mB) * .45)));
    float k = clamp(wetness, 0., 1.);
    float tone = mix((.3 + 1.2 * photo) * (1. - .55 * pore), 1.3 * (.45 + 1.1 * photo) * (1. - .25 * pore), k) * (.9 + .2*grain);
    col = soilMix(k) * tone;
    float gh = hash12(floor(sp * 110.));
    col += vec3(.45, .5, .55) * step(.992, gh) * wetSide * (.5 + .5 * sin(uTime * 1.5 + gh * 40.));   // water glints against the plastic, during a pour only
    col *= mix(1., .82, sstep(.3, 1., depth));
    float diff = max(dot(vN, L), 0.);
    col *= .95 + .3*diff;
    col *= .75 + .25*sstep(0., .06, depth);
    // lines on the sides only (the top is the surface). Solid water line, solid muted min, dashed ink target.
    if(abs(vN.y) < .5){
      float span = uTopY - uSoilBot;
      if(uMin >= 0.) col = mix(col, cMin, hline(uSoilBot + uMin * span, 1.5) * .9);
      if(uTarget >= 0.){
        float dash = step(.4, fract(along * 2.2));
        col = mix(col, cTarget, hline(uSoilBot + uTarget * span, 2.) * dash);
      }
      if(uLevel >= 0.) col = mix(col, cLine, hline(uSoilBot + uLevel * span, 2.) * .95);
    }
  }
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * The soil material. `colors` are CSS hex strings from the theme (rig.soilDry, rig.soilWet, rig.water, …),
 * read at runtime so the Phase 2 soils arrive without a code change. `grain` is the side scan texture.
 */
export function soilMaterial({ colors, grain }) {
  const c = (h) => ({ value: new THREE.Color(h) });
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 2.5 }, uTopY: { value: 0.95 }, uThick: { value: 0.92 }, uInset: { value: 1.2 },
      uSoilBot: { value: 0.03 },
      uM: { value: 0.3 },
      uPour: { value: new THREE.Vector3() }, uPourActive: { value: 0 }, uPourWet: { value: 0.95 }, uPourAge: { value: -1 }, uLayer: { value: 0 },
      uHand: { value: new THREE.Vector3() }, uHandA: { value: 0 },
      uLevel: { value: -1 }, uMin: { value: -1 }, uTarget: { value: -1 },
      cSoilDry: c(colors.soilDry), cSoilWet: c(colors.soilWet), cWater: c(colors.water),
      cLine: c(colors.line), cMin: c(colors.min), cTarget: c(colors.target),
      uGrain: { value: grain },
    },
  });
}
