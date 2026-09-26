# The rig in 3D: plan

Goal: replace the 2D drawing of the box, pump, water, probes and electronics with a high-quality, real-time 3D model on the web, driven by the same data as today (the simulator on Demo). It should look like a photographed object, not a game or a render demo, and stay honest: what's modeled is labeled.

## 1. What already exists (reuse, don't rebuild)

| Asset | Where | Notes |
|---|---|---|
| Blender model of the real build | `farm-hand/laptop/static/models/farmhand.glb` (6.2 MB) | Built by `farm-hand/blender/build_farmhand.py` + `hardware.py`. 24 named nodes: `Soil, Pot, Rim, Lid, Cup, Water, Pump, Tube, Nozzle, Probe, ProbeLED, TempProbe, ESP32, Relay, Breadboard, Wires, BoardJumpers, DupontEnds, RelayWireEnds, Resistor, BinderClip, UsbCable, Crumbs, WaterFront`. 44 materials, 10 textures, `KHR_materials_transmission`. |
| Soil + water shader | `farm-hand/laptop/static/soil_shader.js` | Adapted from Prompt Grass Grow Grass (MIT). Dry/wet soil, grain, cracks that close when wet, fingered wetting front, puddle, splash rings, a soak layer. The MIT notice travels with it. |
| Studio light | `farm-hand/laptop/static/models/studio.hdr` (Poly Haven `ferndale_studio_03`, CC0) | Image-based light and reflections. |
| The team's three.js scene | `farm-hand/laptop/static/scene.js` | The working reference for how each part is driven: soil moisture, the pour choreography (the ml pumped sets the spread and soak depth), the stream and drops, the probe LED and the rim glow. |

## 2. Stack

- **three.js**, used directly (not react-three-fiber). The scene is one imperative object with a small API, mounted by a React component. Reasons:
  - The team's reference is vanilla three, so it ports almost line for line.
  - It adds one dependency, not three.
  - It drops into the per-frame loop in `src/motion.js` without React re-renders.
- **Loaders:** `GLTFLoader` with `MeshoptDecoder`, and `HDRLoader`/`RGBELoader` (`three/addons`).
- **Code-split:** the 3D module loads with `import()` only on the page that shows it, so Live, Vs timer and Outside stay light.

## 3. Asset pipeline (quality and weight)

1. Copy the GLB, HDR and soil texture into `ui-mui/public/rig/` so Vite serves them as static files and the Mac mini deploy picks them up.
2. Optimize the GLB with glTF-Transform (`npx @gltf-transform/cli optimize`):
   - meshopt compression;
   - textures resized to at most 1024 px and converted to WebP;
   - weld and dedupe, with node names kept.

   Target: under 1.5 MB, from 6.2 MB.
3. Keep the HDR small (1K). The environment is prefiltered once with `PMREMGenerator`.
4. Credit the sources in `ui-mui/THIRD_PARTY_NOTICES.md`: the MIT text for the shader, and Poly Haven CC0.

## 4. Look (photographed object, not a render demo)

- **Color and exposure:**
  - `outputColorSpace = SRGB`;
  - AgX (or ACES) tone mapping, exposure tuned against the page's paper tone so the scene sits in the page instead of floating on black;
  - a transparent canvas over the page background.
- **Light:**
  - the HDRI for image-based light and reflections;
  - one soft key light with PCF soft shadows (a 2048 map, tight frustum);
  - a shadow catcher under the box.
  - No colored rim lights and no bloom.
- **Materials:**
  - **Tote:** frosted polypropylene: `MeshPhysicalMaterial` with low opacity, a clearcoat and roughness of about 0.15. Not glass, because refraction made the soil read as water.
  - **Cup water:** transmission with IOR 1.33.
  - **Soil:** the shader, colored with the nature palette's soil tones: dry 10YR 5/3, wet 10YR 3/2, blended in OKLab.
  - **The probe tip's temperature tint:** uses the madder temperature token.
- **Camera:**
  - a fixed three-quarter view from slightly above, like a product photo;
  - light orbit on drag, clamped, with damping; no auto-rotation or idle sway (motion comes only from data);
  - it frames the whole build at 16:9 and at phone width, with the field of view fitted to the aspect.
- **Anti-aliasing:** MSAA with a device-pixel-ratio cap of 2, down to 1.5 on weak GPUs if frame time rises.

## 5. What the data drives (every effect maps to a reading)

| Data (the sim, `window.farmHand`) | In 3D |
|---|---|
| Moisture % (`nowPct`) | Soil darkens (shader `uM`, spring-smoothed like today) |
| Pump A running (`board.activePot === 'A'`) | The water column fills the tube, then a stream from the nozzle with splash drops |
| ml poured this pour | Wetting front spreads over the top, then an even layer soaks down (team's model: ml ÷ (434 cm² × 0.15)), labeled "modeled" |
| The pour's soak result | The receipt chip stays an HTML overlay pinned to the nozzle: "+4.1% from 100 ml" |
| Tube pinched | A clamp mesh on the tube; the water stops at the clamp, no stream |
| Cup level (`world.cupMl`) | The `Water` mesh's height scales with ml left |
| Hand pour (the sim's detector) | A wet patch at the far side of the soil, not under the nozzle |
| Soil temperature | The DS18B20 tip tint (madder), with the °C value in an HTML label |
| Each reading (1 Hz) | `ProbeLED` blinks once |
| Target run | A thin, translucent plane at the target moisture height inside the tote, with an HTML label |
| Agents working | Nothing. The rim glow is dropped (ambient decoration) |

Labels are HTML (MUI Typography), positioned from projected 3D points each frame. They stay crisp, use the page fonts, and remain in the accessibility tree. The honesty label "waterline (modeled)" and the "Fig. 1" caption stay.

## 6. Performance

- One render loop, driven by `src/motion.js`. Render **on demand**: continuously only while something moves (a pour, a spring settling, a drag); otherwise re-render only when a reading changes.
- Pause when the canvas is off screen (`IntersectionObserver`) or the tab is hidden.
- Budget: 60 fps on a laptop iGPU at 1440 px; the first view in under 2 s on a local network. Measure with `renderer.info` and frame times.
- Dispose of geometries, materials and textures on unmount.

## 7. Fallbacks and accessibility

- No WebGL (or it fails to load) → the existing 2D `Rig.jsx`, unchanged.
- `prefers-reduced-motion` → no stream or drop animation. The tube shows full or empty and the soil color changes directly, so every data change is still shown.
- The canvas gets an `aria-label` summarizing the state (as the 2D drawing's does), and the HTML labels remain.
- While loading, show a still of the 2D drawing in the same box (no spinner), then cross-fade in 200 ms.

## 8. Where it goes

- **Demo (`#/demo`):** replaces the 2D drawing in the stage.
- **Live (`#/`, real data):** later, as an option. The same scene can be driven by `/farmhand/data` (moisture, pump, temperature), with "modeled" labels on the water effects. Off until the owner decides.

## 9. Files

| File | What |
|---|---|
| `src/rig3d/scene.js` | three.js scene: renderer, light, camera, load, `update(state)`, `render()`, `dispose()` |
| `src/rig3d/soilShader.js` | The team's shader, with the MIT header kept and palette uniforms added |
| `src/rig3d/Rig3D.jsx` | React mount: canvas, HTML label layer, fallback, visibility, reduced motion |
| `src/rig3d/drive.js` | Maps `window.farmHand` state to scene state (the table in section 5) |
| `public/rig/farmhand.glb`, `studio.hdr`, `soil_grain.webp` | Optimized assets |
| `THIRD_PARTY_NOTICES.md` | Credits |

## 10. Done when

- It renders on Demo at 1920, 1440 and 390. The screenshots read as a photographed object, and nothing overlaps.
- These all match the 2D behavior, checked frame by frame: a 1x test pour, a target run, a pinch, a hand pour, and an empty cup.
- 60 fps on the dev machine's production build, with no console errors or WebGL warnings.
- The page with the 3D view loads under 2 MB (code split plus the optimized GLB).
- Reduced motion and the no-WebGL fallback both work.
