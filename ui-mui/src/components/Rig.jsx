import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { CFG } from '../sim.js';
import { useSimValue } from '../useFarmHand.js';
import { onFrame } from '../motion.js';
import { createRigWriter, levelY, NOZZLE, TUBE, PINCH_AT } from '../rigMotion.js';

/*
 * Side view of the real build, drawn to one scale (about 11.7 units per cm): the clear tote of soil, the
 * capacitive soil probe, the DS18B20 in its steel can, and pump A in its cup. The relay and the ESP32 are drawn
 * from above in an inset, at 0.72 of their old size, because a flat board seen edge-on is a line.
 *
 * This component renders structure only (it re-renders when the tube is pinched or the min moves).
 * Everything that follows a reading or the pump is written per frame by rigMotion.js (motion.md P1/P2).
 *
 * Line weights: 2 plastic, 2.5 cables (USB 4), 1 detail and leaders. The tube is a 7-unit volume.
 * Labels: halo text with a 1px leader ending in a 2px dot for parts; white chips only for data over soil.
 */

// Soil surface: uneven by a few units, heaved where each probe goes in (D6).
const SURFACE = 'M220 226 C 262 222, 300 228, 346 224 S 470 221, 500 222 L 505 219 L 521 219 L 526 222 C 545 224, 556 223, 563 222 L 566 220 L 574 220 L 577 222 C 600 221, 620 223, 640 226';
const SOIL = `${SURFACE} L 640 394 L 220 394 Z`;

// Pump leads: one bundled pair. Out of the cup with the tube, down to the table, along it behind the tote,
// and up into the relay's screw terminals (D3: cables lie and sag; they don't arch like rods).
const LEAD = 'M124 338 C 126 300, 138 262, 154 257 C 168 253, 172 296, 175 352 C 176 374, 188 381, 212 381 L 640 381 C 720 381, 781 384, 782 330 C 783 262, 782 214, 752 199';
// Probe cables leave the heads upward, turn over a small radius, then hang down to a header pin (D3, D4).
const SOIL_CABLE = 'M512 118 C 512 94, 532 84, 560 88 C 640 98, 700 150, 706.5 254';
const TEMP_CABLE = 'M570 292 L 570 128 C 570 112, 584 106, 600 110 C 650 122, 694 170, 699 254';
const USB = 'M773 289 C 787 289, 790 318, 776 346 C 764 370, 772 392, 800 398';

// ESP32 header: 11 pins along the top edge (inset coordinates are absolute, see D1/D2).
const PINS = Array.from({ length: 11 }, (_, k) => 684 + 7.5 * k);

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
      <rect ref={(n) => { r.current = n; if (rectRef) rectRef.current = n; }} x="0" y="0" width="0" height={h} rx="6" fill={palette.rig.tag} opacity=".92" />
      <text ref={(n) => { t.current = n; if (textRef) textRef.current = n; }} x={anchor === 'end' ? -6 : anchor === 'middle' ? 0 : 6} y={size + 3} textAnchor={anchor} className={cls} fill={fill}>{children}</text>
    </g>
  );
}

// A part label: halo text plus a 1px leader that ends in a 2px dot on the part.
function Callout({ x, y, anchor = 'end', d, dot, children }) {
  const { palette } = useTheme();
  return (
    <g className="callout">
      <path d={d} fill="none" stroke={palette.rig.label} strokeOpacity=".6" strokeWidth="1" />
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
  const speck = (id, s, dots) => (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      {dots.map(([cx, cy, r, c], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={c} />)}
    </pattern>
  );
  const dk = 'rgba(0,0,0,.13)', lt = 'rgba(255,255,255,.12)';

  return (
    <Box
      component="svg"
      ref={ref('svg')}
      className="rig"
      viewBox="0 64 800 366"
      role="img"
      aria-label="Side view of the rig: a clear tote of soil with a soil probe and a temperature probe, pump A in a cup of water, and the relay and ESP32 drawn from above."
      sx={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <defs>
        <clipPath id="soilClip"><path d="M229 172 L631 172 L616 381 L244 381 Z" /></clipPath>
        <clipPath id="soilShape"><path d={SOIL} /></clipPath>
        <clipPath id="cupClip"><path d="M66 262 L162 262 L156 382 L72 382 Z" /></clipPath>
        {/* three speckle tiles at coprime sizes: the repeat is 13 x 17 x 23 units, wider than the drawing (D6) */}
        {speck('speckA', 13, [[3, 4, 1.2, dk], [9.5, 10, 0.8, lt]])}
        {speck('speckB', 17, [[12, 3, 1, dk], [4, 13, 0.9, 'rgba(0,0,0,.09)'], [14.5, 11, 0.7, lt]])}
        {speck('speckC', 23, [[7, 17, 1.4, 'rgba(0,0,0,.08)'], [19, 6, 0.8, lt], [2, 9, 0.6, dk]])}
        {/* wet soil under the waterline: darker in the soil's own color, with a 6-unit soft edge (D7) */}
        <linearGradient id="wetEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={R.soilWet} stopOpacity="0" />
          <stop offset="1" stopColor={R.soilWet} stopOpacity=".24" />
        </linearGradient>
      </defs>

      {/* table */}
      <rect x="0" y="384" width="800" height="46" fill={R.table} />
      <line x1="0" y1="384" x2="800" y2="384" stroke={R.tableEdge} strokeWidth="2" />

      {/* cables behind everything: the pump pair on the table, the probe cables hanging to the ESP32 */}
      <path d={LEAD} fill="none" stroke={R.wireBlack} strokeWidth="2.5" strokeLinecap="round" />
      <path d={LEAD} fill="none" stroke={R.wireRed} strokeWidth="2.5" strokeLinecap="round" transform="translate(-2.5 -2)" />
      <rect width="3" height="7" rx="1" fill={R.clamp} transform="translate(169 300) rotate(-4)" />
      <rect width="3" height="7" rx="1" fill={R.clamp} transform="translate(779 262)" />
      <path d={SOIL_CABLE} fill="none" stroke={R.wireGrey} strokeWidth="2.5" strokeLinecap="round" />
      <path d={TEMP_CABLE} fill="none" stroke={R.wireBlack} strokeWidth="2.5" strokeLinecap="round" />

      {/* the soil: color, three speckle layers, then the wet layer under the waterline */}
      <g clipPath="url(#soilClip)">
        <path ref={ref('soil')} className="soil" d={SOIL} fill={R.soilDry} />
        <path d={SOIL} fill="url(#speckA)" />
        <path d={SOIL} fill="url(#speckB)" />
        <path d={SOIL} fill="url(#speckC)" />
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
      <Callout x={582} y={158} anchor="start" d="M578 154 H 571" dot={[571, 154]}>Temp probe D4</Callout>
      <Chip x={581} y={300} cls="val temp" fill={palette.temp.main} size={16} textRef={refObj('tempText')}>-</Chip>

      {/* clear plastic walls, over the soil; highlights run parallel to the wall, not a lone shine */}
      <path d="M226 172 L634 172 L618 384 L242 384 Z" fill="rgba(226,236,244,.16)" stroke={R.plastic} strokeWidth="2" />
      <rect x="220" y="164" width="420" height="9" rx="4" fill={R.rim} stroke={R.plastic} strokeWidth="2" />
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
      {[109, 115, 121].map((x) => <rect key={x} x={x} y="361" width="1.5" height="10" rx=".75" fill="#3a404a" />)}
      <path d="M64 262 L164 262 L158 384 L70 384 Z" fill="rgba(226,236,244,.2)" stroke={R.plastic} strokeWidth="2" />
      <path d="M70 268 L76 376" stroke={R.tag} strokeWidth="1.25" strokeOpacity=".25" />
      <text x="114" y="404" className="label" textAnchor="middle">Pump, 20 ml/s</text>
      <text ref={ref('cupText')} x="114" y="420" className="label" textAnchor="middle">-</text>

      {/* tube to the soil: water fills it from the pump (pathLength 1: dashoffset 1 = empty, 0 = full) */}
      <path ref={tubeRef} d={TUBE} fill="none" stroke={R.tube} strokeWidth="7" strokeLinecap="round" />
      <path ref={ref('tubeWater')} d={TUBE} pathLength="1" fill="none" stroke={R.water} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" />
      <rect x={NOZZLE.x - 4.5} y={NOZZLE.y - 7} width="9" height="7" rx="1.5" fill={R.plastic} />
      {/* one tapered stream that necks as it falls; its highlight moves with the pour's own elapsed time */}
      <g ref={ref('stream')} opacity="0">
        <path d={`M${NOZZLE.x - 2.6} ${NOZZLE.y} L${NOZZLE.x + 2.6} ${NOZZLE.y} C ${NOZZLE.x + 1.7} ${NOZZLE.y + 8}, ${NOZZLE.x + 1.5} 214, ${NOZZLE.x + 1.5} 223 L${NOZZLE.x - 1.5} 223 C ${NOZZLE.x - 1.5} 214, ${NOZZLE.x - 1.7} ${NOZZLE.y + 8}, ${NOZZLE.x - 2.6} ${NOZZLE.y} Z`} fill={R.water} />
        <line ref={ref('streamHi')} x1={NOZZLE.x - 0.3} y1={NOZZLE.y + 1} x2={NOZZLE.x - 0.3} y2="221" stroke="#fff" strokeOpacity=".75" strokeWidth="1.1" strokeDasharray="3 9" />
      </g>
      {pinched && (
        // a binder clip across the tube; the tube necks under its jaws and the water stops here
        <g ref={clampRef}>
          <path d="M-5 -2.2 L5 -2.2 L5 -5 L-5 -5 Z M-5 2.2 L5 2.2 L5 5 L-5 5 Z" fill={R.stage} />
          <rect x="-3.5" y="-15" width="7" height="12.5" rx="1.5" fill={R.clamp} />
          <rect x="-3.5" y="2.5" width="7" height="12.5" rx="1.5" fill={R.clamp} />
          <path d="M-2.5 -15 L-7 -24 M2.5 -15 L7 -24" stroke={R.clampDark} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      {/* the pour chip: counts ml while the pump runs, holds the total, then becomes the receipt */}
      <g ref={ref('pourChip')} opacity="0">
        <Chip x={NOZZLE.x + 10} y={180} cls="val" size={16} fill={palette.moisture.main} minW={74} textRef={refObj('pourText')} rectRef={refObj('pourRect')}>+0 ml</Chip>
      </g>

      {/* electronics, drawn from above in an inset (D1): its own honest view instead of mixed projections */}
      <rect x="652" y="150" width="140" height="222" rx="6" fill="none" stroke={R.plastic} strokeWidth="1" strokeDasharray="2 3" />
      <text x="660" y="364" className="label dim">from above</text>

      {/* relay module: board, relay cube, screw terminal, LED; pins on the bottom edge */}
      <g>
        <rect x="690" y="178" width="62" height="37" rx="3" fill={R.relayBoard} />
        <rect x="695" y="183" width="27" height="27" rx="1.5" fill={R.relayCoil} stroke={R.relayEdge} strokeWidth="1" />
        <rect x="731" y="183" width="17" height="25" rx="1.5" fill={R.relayTerminal} />
        {[189, 195.5, 202].map((y) => <circle key={y} cx="736" cy={y} r="1.9" fill={R.screw} />)}
        <circle ref={ref('relayLed')} cx="726" cy="211" r="2.2" fill={R.relayOff} />
        {[700, 707, 714].map((x) => <rect key={x} x={x - 1.5} y="213" width="3" height="4" fill={R.pins} />)}
      </g>
      <text x="721" y="170" className="label" textAnchor="middle">Relay D26</text>
      {/* jumpers relay -> ESP32, sagging a little, each ending in a dupont housing on a pin */}
      {[[700, PINS[6], R.jumperGrey], [707, PINS[7], R.jumperWhite], [714, PINS[8], R.wireRed]].map(([x0, x1, c]) => (
        <path key={x0} d={`M${x0} 217 C ${x0} 238, ${x1} 236, ${x1} 254`} fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      ))}

      {/* ESP32 devkit: antenna can at one end, USB at the other, a header row on each long edge */}
      <g>
        <rect x="680" y="262" width="86" height="55" rx="3" fill={R.espBoard} />
        <rect x="688" y="270" width="39" height="39" rx="1.5" fill={R.espShield} />
        <text x="707.5" y="293" className="chip" textAnchor="middle">ESP32</text>
        <rect x="763" y="283" width="10" height="12" rx="1.5" fill={R.espPort} />
        <circle cx="742" cy="274" r="2" fill={R.espLed} />
        <g fill={R.pins}>{PINS.map((x) => <g key={x}><rect x={x - 1.25} y="263.5" width="2.5" height="2.5" /><rect x={x - 1.25} y="312.5" width="2.5" height="2.5" /></g>)}</g>
      </g>
      {/* dupont housings where each wire meets its pin */}
      {[[PINS[2], R.wireBlack], [PINS[3], R.wireGrey], [PINS[6], R.jumperGrey], [PINS[7], '#d9dde2'], [PINS[8], R.wireRed]].map(([x, c]) => (
        <rect key={x} x={x - 2} y="254" width="4" height="8" rx="1" fill={c} />
      ))}
      <path d={USB} fill="none" stroke={R.usb} strokeWidth="4" strokeLinecap="round" />
      <text x="792" y="418" className="label" textAnchor="end">USB to laptop</text>
    </Box>
  );
}

export default memo(Rig);
