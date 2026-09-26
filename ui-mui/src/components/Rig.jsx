import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { CFG } from '../sim.js';
import { useSimValue } from '../useFarmHand.js';
import { onFrame } from '../motion.js';
import { createRigWriter, levelY, NOZZLE, TUBE, PINCH_AT } from '../rigMotion.js';

/*
 * Side view of the real build: the clear tote of soil, the capacitive soil probe, the DS18B20 in its steel can,
 * pump A in its cup, and the relay and ESP32 (on a half breadboard) standing on the bench, all in one view.
 * Round 6: this 2D drawing is the fallback for the 3D rig (src/rig3d), shown while it loads or without WebGL.
 *
 * This component renders structure only (it re-renders when the tube is pinched or the min moves).
 * Everything that follows a reading or the pump is written per frame by rigMotion.js (motion.md P1/P2).
 *
 * Line weights: 1.5 plastic, 2.5 cables (USB 4), 1 detail and leaders. The tube is a 7-unit volume.
 * Labels: halo text with a 1px leader ending in a 2px dot for parts; white chips only for data over soil.
 */

// Soil surface: uneven by a few units, heaved where each probe goes in (D6).
const SURFACE = 'M220 226 C 262 222, 300 228, 346 224 S 470 221, 500 222 L 505 219 L 521 219 L 526 222 C 545 224, 556 223, 563 222 L 566 220 L 574 220 L 577 222 C 600 221, 620 223, 640 226';
const SOIL = `${SURFACE} L 640 394 L 220 394 Z`;

// Pump leads: one bundled pair. Out of the cup with the tube, down to the table, along it behind the tote,
// and into the relay's screw terminal, which faces the tote (D3: cables lie and sag; they don't arch like rods).
const LEAD = 'M124 338 C 126 300, 138 262, 154 257 C 168 253, 172 296, 175 352 C 176 374, 188 381, 212 381 L 626 381 C 636 381, 640 370, 647 370';
// Probe cables leave the heads upward, turn over a small radius, then hang down to the breadboard (D3, D4).
// The soil cable runs outside the temp cable all the way, so the two never cross.
const SOIL_CABLE = 'M512 118 C 512 92, 534 82, 566 86 C 660 96, 701 150, 701 364';
const TEMP_CABLE = 'M570 292 L 570 128 C 570 112, 584 106, 600 110 C 660 124, 697 170, 697 364';
// USB: from the ESP32's port, out through the right edge of the frame (butt end, so nothing pokes out).
const USB = 'M764 360 C 776 360, 784 363, 800 363';
// Breadboard holes the wires plug into (left of the ESP32): three relay jumpers, then the two probe cables.
const HOLES = [686, 689.5, 693, 697, 701];
// ESP32 header pins, down into the breadboard.
const PINS = Array.from({ length: 17 }, (_, k) => 708 + 3.25 * k);

// Measured halo text needs no box; chips measure their text (getComputedTextLength), not a character guess.
function Chip({ x, y, anchor = 'start', children, cls = 'label', fill, size = 12, innerRef, rectRef, textRef, minW = 0 }) {
  const { palette } = useTheme();
  const t = useRef(null), r = useRef(null);
  const h = size + 10;
  useLayoutEffect(() => {
    const fit = () => {
      if (!t.current || !r.current) return;
      const w = Math.max(minW, t.current.getComputedTextLength() + 12);
      const left = anchor === 'end' ? -w : anchor === 'middle' ? -w / 2 : 0;
      r.current.setAttribute('width', w.toFixed(1));
      r.current.setAttribute('x', left.toFixed(1));
    };
    fit();
    document.fonts?.ready.then(fit);
  });
  return (
    <g className="tag" ref={innerRef} transform={`translate(${x} ${y})`}>
      <rect ref={(n) => { r.current = n; if (rectRef) rectRef.current = n; }} x="0" y="0" width="0" height={h} rx="2" fill={palette.rig.tag} opacity=".92" />
      <text ref={(n) => { t.current = n; if (textRef) textRef.current = n; }} x={anchor === 'end' ? -6 : anchor === 'middle' ? 0 : 6} y={size + 3} textAnchor={anchor} className={cls} fill={fill}>{children}</text>
    </g>
  );
}

// A part label: halo text plus a 1px leader that ends in a 2px dot on the part.
function Callout({ x, y, anchor = 'end', d, dot, children }) {
  const { palette } = useTheme();
  return (
    <g className="callout">
      <path d={d} fill="none" stroke={palette.rig.leader} strokeWidth="1" />
      <circle cx={dot[0]} cy={dot[1]} r="2" fill={palette.rig.label} />
      <text x={x} y={y} className="label" textAnchor={anchor}>{children}</text>
    </g>
  );
}

function Rig({ fh }) {
  const { palette } = useTheme();
  const R = palette.rig;
  // Structure changes only with these. Readings, the pump and the pour are written per frame.
  useSimValue(() => `${fh.world.pinched}|${CFG.DRY_PCT}`, 4);
  const pinched = fh.world.pinched;
  const n = useRef({});
  const ref = (k) => (el) => { n.current[k] = el; };
  const refObj = (k) => ({ set current(el) { n.current[k] = el; }, get current() { return n.current[k]; } });

  // Place the pinch clamp on the tube itself, square to it (D10).
  const tubeRef = useRef(null), clampRef = useRef(null);
  useLayoutEffect(() => {
    const p = tubeRef.current, c = clampRef.current;
    if (!p || !c) return;
    const L = p.getTotalLength(), a = p.getPointAtLength(L * PINCH_AT), b = p.getPointAtLength(L * PINCH_AT + 1);
    const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    c.setAttribute('transform', `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${deg.toFixed(1)})`);
  }, [pinched]);

  useEffect(() => {
    const write = createRigWriter(n.current, fh, palette);
    return onFrame(write, 20);
  }, [fh, palette]);

  const base = levelY(CFG.DRY_PCT);

  return (
    <Box
      component="svg"
      ref={ref('svg')}
      className="rig"
      viewBox="-40 64 840 366"
      role="img"
      aria-label="Side view of the rig: a clear tote of soil with a soil probe and a temperature probe, pump A in a cup of water, and the relay and ESP32 on the bench."
      sx={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <defs>
        <clipPath id="soilClip"><path d="M229 172 L631 172 L616 381 L244 381 Z" /></clipPath>
        <clipPath id="soilShape"><path d={SOIL} /></clipPath>
        <clipPath id="cupClip"><path d="M66 262 L162 262 L156 382 L72 382 Z" /></clipPath>
        {/* potting mix: one 17-unit tile of humus flecks, about 4% of the area (spec 2.14; no hatching) */}
        <pattern id="fleck" width="17" height="17" patternUnits="userSpaceOnUse">
          {[[3, 4, 1], [11, 2.5, 0.9], [7, 11, 1.1], [14, 14, 0.8]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} fill={R.humus} />)}
        </pattern>
        {/* wet soil under the waterline: darker in the soil's own color, with a 6-unit soft edge (D7) */}
        <linearGradient id="wetEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={R.soilWet} stopOpacity="0" />
          <stop offset="1" stopColor={R.soilWet} stopOpacity=".24" />
        </linearGradient>
      </defs>

      {/* table */}
      <rect x="-40" y="384" width="840" height="46" fill={R.table} />
      <line x1="-40" y1="384" x2="800" y2="384" stroke={R.tableEdge} strokeWidth="2" />

      {/* cables behind everything: the pump pair on the table, the probe cables hanging to the ESP32 */}
      <path d={LEAD} fill="none" stroke={R.wireBlack} strokeWidth="2.5" strokeLinecap="round" />
      <path d={LEAD} fill="none" stroke={R.wireRed} strokeWidth="2.5" strokeLinecap="round" transform="translate(-2.5 -2)" />
      <rect width="3" height="7" rx="1" fill={R.clamp} transform="translate(169 300) rotate(-4)" />
      <path d={SOIL_CABLE} fill="none" stroke={R.wireGrey} strokeWidth="2.5" strokeLinecap="round" />
      <path d={TEMP_CABLE} fill="none" stroke={R.wireBlack} strokeWidth="2.5" strokeLinecap="round" />

      {/* the soil: color, the fleck tile, then the wet layer under the waterline */}
      <g clipPath="url(#soilClip)">
        <path ref={ref('soil')} className="soil" d={SOIL} fill={R.soilDry} />
        <path d={SOIL} fill="url(#fleck)" opacity=".55" />
        <g clipPath="url(#soilShape)">
          {/* the wet patch under the nozzle: grows with the ml poured, fades as the probe confirms it */}
          <ellipse ref={ref('patch')} cx={NOZZLE.x} cy="222" rx="0" ry="0" fill={R.soilWet} opacity="0" />
          {/* a hand pour lands where a person tips a cup, not under the nozzle */}
          <ellipse ref={ref('handPatch')} cx="410" cy="223" rx="0" ry="0" fill={R.soilWet} opacity="0" />
          <g ref={ref('wet')} className="level" transform="translate(0 300)">
            <rect x="220" y="0" width="420" height="6" fill="url(#wetEdge)" />
            <rect x="220" y="6" width="420" height="200" fill={R.soilWet} opacity=".24" />
            <line x1="220" x2="640" y1="0" y2="0" stroke={R.water} strokeWidth="1.5" strokeOpacity=".9" />
          </g>
          {/* min (PLAN 5e): the level box A keeps, solid and muted; the target stays dashed ink */}
          <line x1="220" x2="640" y1={base} y2={base} stroke={R.labelDim} strokeWidth="1.5" />
          <line ref={ref('targetLine')} x1="220" x2="640" y1="0" y2="0" stroke={R.targetLine} strokeWidth="2" strokeDasharray="6 4" display="none" />
        </g>
        <path d={SURFACE} fill="none" stroke={R.soilWet} strokeOpacity=".25" strokeWidth="1.25" />
      </g>

      {/* soil probe (capacitive v1.2), about 98 mm */}
      <g>
        <rect x="500" y="118" width="24" height="72" rx="3" fill={R.probeHead} />
        <rect x="505" y="150" width="14" height="10" rx="1" fill={R.probeChip} />
        <path d="M503 190 L521 190 L521 290 L512 300 L503 290 Z" fill={R.probeBlade} />
        <line x1="503" y1="214" x2="521" y2="214" stroke={R.tag} strokeWidth="1" strokeDasharray="3 2" />
        <circle ref={ref('led')} cx="512" cy="132" r="4" fill={R.ledOk} opacity=".35" />
        {/* heartbeat: a 300 ms blip per reading, at most one per 800 ms (written per frame, never remounted) */}
        <circle ref={ref('beat')} cx="512" cy="132" r="4" fill={R.ledOk} opacity="0" />
      </g>
      <Callout x={488} y={104} d="M492 100 H 506 V 116" dot={[506, 118]}>Soil probe D32</Callout>

      {/* temp probe (DS18B20): a black cable into a short steel can; the tip color stays in the temperature hue */}
      <g>
        <rect x="565" y="292" width="10" height="46" rx="3" fill={R.probe} stroke={R.probeEdge} strokeWidth="1" />
        <rect ref={ref('tip')} x="565" y="324" width="10" height="14" rx="3" fill={palette.temp.tip} stroke={R.probeEdge} strokeWidth="1" />
        <rect x="564.5" y="291" width="11" height="3" rx="1" fill={R.probeEdge} />
      </g>
      <Callout x={580} y={200} anchor="start" d="M577 196 H 571" dot={[571, 196]}>Temp probe D4</Callout>
      <Chip x={559} y={300} anchor="end" cls="val temp" fill={palette.temp.main} size={16} textRef={refObj('tempText')}>-</Chip>

      {/* clear plastic walls, over the soil; highlights run parallel to the wall, not a lone shine */}
      <path d="M226 172 L634 172 L618 384 L242 384 Z" fill={R.rim} fillOpacity=".14" stroke={R.plastic} strokeWidth="1.5" />
      {/* the rolled lip: the rim line with a round 4-unit cap at each top corner */}
      <rect x="222" y="166" width="416" height="4" fill={R.rim} stroke={R.plastic} strokeWidth="1.5" />
      <circle cx="222" cy="168" r="4" fill={R.rim} stroke={R.plastic} strokeWidth="1.5" />
      <circle cx="638" cy="168" r="4" fill={R.rim} stroke={R.plastic} strokeWidth="1.5" />
      <path d="M234 180 L249 376" stroke={R.tag} strokeWidth="1.25" strokeOpacity=".3" />

      {/* data chips over the soil, left column: waterline (moves), target (above its line), min */}
      <Chip x={250} y={levelY(CFG.DRY_PCT) + 4} innerRef={refObj('baseTag')}>{`min ${CFG.DRY_PCT}%`}</Chip>
      <g ref={ref('targetTag')} display="none"><Chip x={250} y={0} textRef={refObj('targetText')} fill={R.targetLine}>target</Chip></g>
      <g ref={ref('wlTag')} transform="translate(0 300)"><Chip x={250} y={6}>waterline (modeled)</Chip></g>

      {/* cup of water + pump A */}
      <g clipPath="url(#cupClip)">
        <rect ref={ref('cup')} x="60" y="272" width="110" height="110" fill={R.cupWater} opacity=".6" />
      </g>
      <rect x="96" y="336" width="40" height="42" rx="8" fill={R.pump} />
      <rect x="110" y="326" width="10" height="12" rx="2" fill={R.pump} />
      <line x1="110.75" y1="328" x2="110.75" y2="336" stroke={R.tag} strokeOpacity=".35" strokeWidth="1" />
      {[109, 115, 121].map((x) => <rect key={x} x={x} y="361" width="1.5" height="10" rx=".75" fill={R.wireBlack} />)}
      <path d="M64 262 L164 262 L158 384 L70 384 Z" fill={R.rim} fillOpacity=".18" stroke={R.plastic} strokeWidth="1.5" />
      <path d="M70 268 L76 376" stroke={R.tag} strokeWidth="1.25" strokeOpacity=".25" />
      {/* the pump's label sits beside it, left of the cup, with a leader to the pump */}
      <Callout x={56} y={346} anchor="end" d="M59 350 H 96" dot={[96, 350]}>Pump A, 20 ml/s</Callout>
      <text ref={ref('cupText')} x="56" y="362" className="label dim" textAnchor="end">-</text>

      {/* tube to the soil: water fills it from the pump (pathLength 1: dashoffset 1 = empty, 0 = full) */}
      <path ref={tubeRef} d={TUBE} fill="none" stroke={R.tube} strokeWidth="7" strokeLinecap="round" />
      <path ref={ref('tubeWater')} d={TUBE} pathLength="1" fill="none" stroke={R.water} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" />
      <rect x={NOZZLE.x - 4.5} y={NOZZLE.y - 7} width="9" height="7" rx="1.5" fill={R.plastic} />
      {/* one tapered stream that necks as it falls; its highlight moves with the pour's own elapsed time */}
      <g ref={ref('stream')} opacity="0">
        <path d={`M${NOZZLE.x - 2.6} ${NOZZLE.y} L${NOZZLE.x + 2.6} ${NOZZLE.y} C ${NOZZLE.x + 1.7} ${NOZZLE.y + 8}, ${NOZZLE.x + 1.5} 214, ${NOZZLE.x + 1.5} 223 L${NOZZLE.x - 1.5} 223 C ${NOZZLE.x - 1.5} 214, ${NOZZLE.x - 1.7} ${NOZZLE.y + 8}, ${NOZZLE.x - 2.6} ${NOZZLE.y} Z`} fill={R.water} />
        <line ref={ref('streamHi')} x1={NOZZLE.x - 0.3} y1={NOZZLE.y + 1} x2={NOZZLE.x - 0.3} y2="221" stroke={R.tag} strokeOpacity=".75" strokeWidth="1.1" strokeDasharray="3 9" />
      </g>
      {pinched && (
        // a binder clip across the tube; the tube necks under its jaws and the water stops here
        <g ref={clampRef}>
          <path d="M-5 -2.2 L5 -2.2 L5 -5 L-5 -5 Z M-5 2.2 L5 2.2 L5 5 L-5 5 Z" fill={R.halo} />
          <rect x="-3.5" y="-15" width="7" height="12.5" rx="1.5" fill={R.clamp} />
          <rect x="-3.5" y="2.5" width="7" height="12.5" rx="1.5" fill={R.clamp} />
          <path d="M-2.5 -15 L-7 -24 M2.5 -15 L7 -24" stroke={R.clampDark} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      {/* the pour chip: counts ml while the pump runs, holds the total, then becomes the receipt */}
      <g ref={ref('pourChip')} opacity="0">
        <Chip x={NOZZLE.x + 10} y={180} cls="val" size={16} fill={palette.moisture.main} minW={74} textRef={refObj('pourText')} rectRef={refObj('pourRect')}>+0 ml</Chip>
      </g>

      {/* electronics in side view, standing on the bench right of the tote (B30) */}
      {/* relay module: a blue PCB on two standoffs, the relay cube, the green screw terminal facing the tote */}
      <g>
        {[649, 673].map((x) => <rect key={x} x={x - 1} y="378" width="2" height="6" fill={R.pins} />)}
        <rect x="645" y="375" width="32" height="3" fill={R.relayBoard} />
        <rect x="653" y="360" width="18" height="15" rx="1" fill={R.relayCoil} stroke={R.relayEdge} strokeWidth="1" />
        <rect x="645" y="365" width="8" height="10" rx="1" fill={R.relayTerminal} />
        <rect x="646.5" y="363.5" width="5" height="1.5" fill={R.screw} />
        <circle ref={ref('relayLed')} cx="674" cy="373.5" r="1.6" fill={R.relayOff} />
        {[672.5, 675].map((x) => <rect key={x} x={x - 0.6} y="369" width="1.2" height="6" fill={R.pins} />)}
      </g>
      <Callout x={662} y={343} anchor="middle" d="M662 347 V 358" dot={[662, 360]}>Relay D26</Callout>
      {/* jumpers relay -> breadboard, short arcs, each ending in a dupont housing */}
      {[[672.5, HOLES[0], R.jumperGrey], [675, HOLES[1], R.jumperWhite], [677.5, HOLES[2], R.wireRed]].map(([x0, x1, c]) => (
        <path key={x0} d={`M${x0} 367 C ${x0} 352, ${x1} 350, ${x1} 364`} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {[672.5, 675, 677.5].map((x) => <rect key={x} x={x - 1.2} y="365" width="2.4" height="4" fill={R.wireBlack} />)}

      {/* half breadboard, ESP32 devkit on it (pins down into the board, USB port at the right end) */}
      <rect x="682" y="372" width="92" height="12" fill={R.perlite} stroke={R.outline} strokeWidth="1" />
      <line x1="682" x2="774" y1="372.5" y2="372.5" stroke={R.plastic} strokeWidth="1.5" />
      <g fill={R.pins}>{PINS.map((x) => <rect key={x} x={x - 0.6} y="366" width="1.2" height="6" />)}</g>
      <rect x="704" y="362" width="58" height="4" fill={R.espBoard} />
      <rect x="708" y="357.5" width="24" height="4.5" fill={R.espShield} />
      <rect x="756" y="357.5" width="8" height="5" fill={R.espPort} />
      <circle cx="742" cy="360.5" r="1.3" fill={R.espLed} />
      {/* dupont housings where the wires meet the breadboard */}
      {HOLES.map((x, k) => <rect key={x} x={x - 1.5} y="364" width="3" height="8" fill={[R.jumperGrey, R.jumperWhite, R.wireRed, R.wireBlack, R.wireGrey][k]} />)}
      <Callout x={708} y={326} anchor="start" d="M713 330 V 356" dot={[713, 357]}>ESP32</Callout>
      <path d={USB} fill="none" stroke={R.usb} strokeWidth="4" strokeLinecap="butt" />
      <text x="798" y="350" className="label" textAnchor="end">USB to laptop</text>
    </Box>
  );
}

export default memo(Rig);
