import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { CFG } from '../sim.js';
import { clamp, f1 } from '../format.js';

// Side view of the real build: the box of soil, soil + temp probes, pump in its cup, relay, ESP32.
// Same geometry as ui/index.html. Illustration colors live in theme.palette.rig.
const TUBE = 'M115 330 C 115 200, 175 150, 255 150 L 296 150 Q 306 150 306 160 L 306 204';

function mix(hexA, hexB, k) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = parse(hexA), b = parse(hexB);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
}

// The soil spans y 224..381 in the drawing. The waterline and the target line sit at the % on that scale.
const SOIL_TOP = 224, SOIL_BOT = 381;
const levelY = (pct) => SOIL_BOT - (clamp(pct, 0, 100) / 100) * (SOIL_BOT - SOIL_TOP);

// A white label chip (90%) so text stays readable over soil and wires. Width from the character count.
function Tag({ x, y, anchor = 'start', lines }) {
  const { palette } = useTheme();
  const w = Math.max(...lines.map((l) => l.text.length * (l.size || 12) * 0.56)) + 12;
  const h = lines.reduce((s, l) => s + (l.size || 12) + 4, 0) + 6;
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  let yy = y;
  return (
    <g className="tag">
      <rect x={left} y={y} width={w} height={h} rx="6" fill={palette.rig.tag} opacity=".9" />
      {lines.map((l, i) => {
        yy += (l.size || 12) + (i ? 4 : 5);
        return <text key={i} x={anchor === 'end' ? x - 6 : anchor === 'middle' ? x : x + 6} y={yy} textAnchor={anchor} className={l.cls || 'label'} fill={l.fill}>{l.text}</text>;
      })}
    </g>
  );
}

/*
 * Every effect is driven by a reading or the pump state (PLAN 5d "make the box act out the data"):
 * soil color and the waterline from the probe %, the ml counter from pump seconds x 20 ml/s (est.),
 * the temp probe tip from the DS18B20 reading (20 °C cool blue to 34 °C warm orange),
 * the probe LED pulses once per reading, the target line during Hit the Target. No ambient motion.
 */
export default function Rig({ fh, frac }) {
  const { palette } = useTheme();
  const R = palette.rig;
  const b = fh.board, w = fh.world, L = fh.latest;
  const m = fh.nowPct() ?? CFG.START_PCT;
  const cupH = Math.round((w.cupMl / CFG.PUMP_CUP_ML) * 110);
  const pumping = b.activePot === 'A', flowing = !w.pinched && w.cupMl > 0;
  const led = pumping ? R.ledPump : m < CFG.DRY_PCT ? R.ledDry : R.ledOk;
  const wl = levelY(m);
  const tip = L ? mix(R.tipCool, R.tipWarm, clamp((L.temp_c - 20) / 14, 0, 1)) : R.probe;
  const target = fh.tgt || (fh.run.phase !== 'idle' && fh.t - fh.run.t_end < 180) ? fh.run.target : null;
  const ran = pumping ? Math.min(b.pourMs, b.ms - b.pourStart + frac() * 1000) / 1000 : 0;
  const cls = [pumping && 'pumping', flowing && 'flowing', w.pinched && 'pinched'].filter(Boolean).join(' ');

  return (
    <Box
      component="svg"
      className={`rig ${cls}`}
      viewBox="0 0 800 430"
      role="img"
      aria-label={`Side view of the rig. Soil probe reads ${L ? f1(L.a_pct) : '-'}%, soil ${L ? f1(L.temp_c) : '-'}\u2009°C, ${Math.round(w.cupMl)} ml in the cup${pumping ? ', pump running' : ''}${w.pinched ? ', tube pinched' : ''}.`}
      sx={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <defs>
        <clipPath id="soilClip"><path d="M229 172 L631 172 L616 381 L244 381 Z" /></clipPath>
        <clipPath id="cupClip"><path d="M66 262 L162 262 L156 382 L72 382 Z" /></clipPath>
        <pattern id="speck" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="1.3" fill="rgba(0,0,0,.14)" />
          <circle cx="10" cy="10" r="1" fill="rgba(255,255,255,.14)" />
          <circle cx="11" cy="3" r=".8" fill="rgba(0,0,0,.1)" />
        </pattern>
      </defs>

      {/* table */}
      <rect x="0" y="384" width="800" height="46" fill={R.table} />
      <line x1="0" y1="384" x2="800" y2="384" stroke={R.tableEdge} strokeWidth="2" />

      {/* wires behind the box */}
      <path d="M106 338 C 96 230, 210 104, 430 104 S 730 150, 736 204" fill="none" stroke={R.wireRed} strokeWidth="2.5" />
      <path d="M112 338 C 104 238, 214 112, 430 112 S 740 158, 746 204" fill="none" stroke={R.wireBlack} strokeWidth="2.5" />
      <path d="M512 118 C 512 50, 640 50, 668 300" fill="none" stroke={R.wireGrey} strokeWidth="3" />
      <path d="M570 132 C 574 70, 650 90, 676 300" fill="none" stroke={R.wireBlack} strokeWidth="3" />

      {/* the box of soil */}
      <g clipPath="url(#soilClip)">
        <rect className="soil" x="220" y="224" width="420" height="170" fill={mix(R.soilDry, R.soilWet, clamp((m - 20) / 55, 0, 1))} />
        <rect x="220" y="224" width="420" height="170" fill="url(#speck)" />
        {/* waterline: the probe % on the soil's height. Modeled from one probe. */}
        <rect className="level" x="220" y={wl} width="420" height={SOIL_BOT + 10 - wl} fill={R.water} opacity=".16" />
        <line className="level" x1="220" x2="640" y1={wl} y2={wl} stroke={R.water} strokeWidth="2" />
        {/* baseline (PLAN 5e): the level box A keeps, solid 1px muted; the target stays dashed ink */}
        <line className="level" x1="220" x2="640" y1={levelY(CFG.DRY_PCT)} y2={levelY(CFG.DRY_PCT)} stroke={R.labelDim} strokeWidth="1.5" />
        {target != null && <line className="level" x1="220" x2="640" y1={levelY(target)} y2={levelY(target)} stroke={R.targetLine} strokeWidth="2" strokeDasharray="6 4" />}
        <ellipse className="puddle" cx="306" cy="225" rx={Math.min(90, w.soaking * 6)} ry="4" fill={R.water} opacity=".7" />
      </g>
      {/* Both tags sit left of the soil probe: the target's above its line, the waterline's below its line. */}
      <Tag x={250} y={wl + 6} lines={[{ text: 'waterline, modeled from one probe' }]} />
      {target != null && <Tag x={250} y={levelY(target) - 30} lines={[{ text: `target ${target}%`, fill: R.targetLine }]} />}
      {/* baseline chip in the same left column; hidden when it would crowd the waterline or target chip (the band tick still shows it) */}
      {Math.abs(levelY(CFG.DRY_PCT) - wl) > 30 && (target == null || Math.abs(levelY(CFG.DRY_PCT) - levelY(target)) > 34)
        && <Tag x={250} y={levelY(CFG.DRY_PCT) + 4} lines={[{ text: `keeping at least ${CFG.DRY_PCT}%` }]} />}

      {/* soil probe (capacitive v1.2) */}
      <g>
        <rect x="500" y="118" width="24" height="72" rx="3" fill={R.probeHead} />
        <rect x="505" y="150" width="14" height="10" rx="1" fill={R.probeChip} />
        <path d="M503 190 L521 190 L521 316 L512 328 L503 316 Z" fill={R.probeBlade} />
        <line x1="503" y1="222" x2="521" y2="222" stroke={R.tag} strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx="512" cy="132" r="4" fill={led} opacity=".35" />
        {/* heartbeat: re-mounts on every new reading and fades from full brightness */}
        {L && <circle key={L.ts} className="beat" cx="512" cy="132" r="4" fill={led} />}
        <text x="486" y="100" className="label" textAnchor="end">Soil probe on D32</text>
      </g>

      {/* temp probe (DS18B20) */}
      <g>
        <rect x="566" y="140" width="8" height="198" rx="4" fill={R.probe} stroke={R.probeEdge} strokeWidth="1" />
        <rect className="tip" x="566" y="296" width="8" height="42" rx="4" fill={tip} stroke={R.probeEdge} strokeWidth="1" />
        <rect x="564" y="132" width="12" height="12" rx="3" fill={R.wireBlack} />
        <Tag x={556} y={350} anchor="end" lines={[{ text: 'DS18B20 on D4' }]} />
      </g>

      {/* clear plastic walls, over the soil */}
      <path d="M226 172 L634 172 L618 384 L242 384 Z" fill="rgba(226,236,244,.16)" stroke={R.plastic} strokeWidth="2" />
      <rect x="220" y="164" width="420" height="9" rx="4" fill={R.rim} stroke={R.plastic} strokeWidth="1.5" />
      <line x1="238" y1="190" x2="250" y2="360" stroke={R.tag} strokeWidth="3" opacity=".5" />

      {/* cup of water + pump */}
      <g clipPath="url(#cupClip)">
        <rect className="grow" x="60" y={382 - cupH} width="110" height={cupH} fill={R.cupWater} opacity=".6" />
      </g>
      <rect className="pumpBody" x="96" y="336" width="40" height="42" rx="8" fill={R.pump} />
      <rect x="110" y="326" width="10" height="12" rx="2" fill={R.pump} />
      <path d="M64 262 L164 262 L158 384 L70 384 Z" fill="rgba(226,236,244,.2)" stroke={R.plastic} strokeWidth="2" />
      <text x="114" y="404" className="label" textAnchor="middle">Pump A, 20 ml/s</text>
      <text x="114" y="420" className={w.cupMl > 0 ? 'label dim' : 'label empty'} textAnchor="middle" fill={w.cupMl > 0 ? undefined : R.label}>
        {w.cupMl > 0 ? `${Math.round(w.cupMl)} ml in cup` : 'cup is empty'}
      </text>

      {/* tube to the soil */}
      <path d={TUBE} fill="none" stroke={R.tube} strokeWidth="7" strokeLinecap="round" />
      <path className="tubeWater" d={TUBE} fill="none" stroke={R.water} strokeWidth="3" strokeLinecap="round" />
      <g>
        <circle className="drop" cx="306" cy="208" r="3" fill={R.water} />
        <circle className="drop" cx="306" cy="208" r="2.5" fill={R.water} />
        <circle className="drop" cx="306" cy="208" r="3" fill={R.water} />
      </g>
      {w.pinched && (
        <g transform="translate(155 191) rotate(-38)">
          <rect x="-16" y="-9" width="32" height="6" rx="2" fill={R.clamp} />
          <rect x="-16" y="3" width="32" height="6" rx="2" fill={R.clamp} />
          <rect x="12" y="-9" width="6" height="18" rx="2" fill={R.clampDark} />
        </g>
      )}

      {/* relay module */}
      <g transform="translate(672 198)">
        <rect width="86" height="52" rx="4" fill={R.relayBoard} />
        <rect x="8" y="7" width="38" height="38" rx="2" fill={R.relayCoil} stroke={R.relayEdge} />
        <rect x="56" y="9" width="24" height="34" rx="2" fill={R.relayTerminal} />
        <circle cx="62" cy="17" r="2.5" fill={R.screw} /><circle cx="62" cy="26" r="2.5" fill={R.screw} /><circle cx="62" cy="35" r="2.5" fill={R.screw} />
        <circle cx="50" cy="46" r="3" fill={pumping ? R.relayOn : R.relayOff} />
        <Tag x={43} y={-28} anchor="middle" lines={[{ text: 'Relay on D26 via PN2222' }]} />
      </g>

      {/* ESP32 */}
      <path d="M690 292 L690 250" stroke={R.jumperGrey} strokeWidth="2.5" />
      <path d="M706 292 L706 250" stroke={R.jumperWhite} strokeWidth="2.5" />
      <path d="M722 292 L722 250" stroke={R.wireRed} strokeWidth="2.5" />
      <g transform="translate(664 292)">
        <rect width="120" height="76" rx="4" fill={R.espBoard} />
        <rect x="58" y="10" width="54" height="56" rx="2" fill={R.espShield} />
        <text x="85" y="42" className="chip" textAnchor="middle">ESP32</text>
        <rect x="-10" y="30" width="14" height="16" rx="2" fill={R.espPort} />
        <circle cx="18" cy="14" r="3" fill={R.espLed} />
        <g fill={R.pins}>
          {[12, 22, 32, 42, 52, 62, 72, 82, 92, 102, 112].map((x) => <circle key={x} cx={x} cy="70" r="1.6" />)}
        </g>
      </g>
      <path d="M654 330 C 640 330, 640 400, 620 420" fill="none" stroke={R.usb} strokeWidth="4" />
      <text x="724" y="388" className="label" textAnchor="middle">USB to laptop</text>
      {/* ml counter riding the stream while pump A runs: pump seconds x the pump's calibrated flow (20 ml/s),
          the same way the Control page counts water (PLAN 5e). */}
      {pumping && <Tag x={318} y={170} lines={[{ text: `+${Math.round(ran * CFG.FLOW_ML_S)} ml`, cls: 'val', size: 16, fill: palette.moisture.main }]} />}
    </Box>
  );
}
