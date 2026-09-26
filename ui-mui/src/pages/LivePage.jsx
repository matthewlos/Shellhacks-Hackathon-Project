import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { visuallyHidden } from '@mui/utils';
import { grid12 } from '../components/Page.jsx';
import Bullet from '../components/Bullet.jsx';
import Roll from '../components/Roll.jsx';
import RealChart from '../components/RealChart.jsx';
import { useBoxData, clockAt, agoText, IMPLAUSIBLE_PCT } from '../boxData.js';

/*
 * Live: box A, the real one, read-only (spec 12.3). Everything here comes from GET /farmhand/data; nothing is
 * simulated and nothing is drawn that the data doesn't carry (no rig drawing, no "full" line: the server only
 * publishes a baseline). Four states get the same care, because "offline" is the likely one on demo day:
 *   live       the server heard from the board in the last 2 min
 *   offline    it hasn't: the last values show greyed, with their clock time, never as current
 *   no server  the fetch failed (anything already loaded stays, greyed)
 *   no data    the server is up and has no readings
 * Layout: the Demo page's plate grid, with the history chart where the drawing was.
 */

// Optional photo of the real box (spec 2.8): drop ui-mui/src/assets/box-a.{jpg,png,webp} in; no file, nothing renders.
const PHOTO = Object.values(import.meta.glob('../assets/box-a.*', { eager: true, query: '?url', import: 'default' }))[0];
const PHOTO_CAPTION = 'Box A, the real build.';

const SAY = { live: 'Box A is live.', offline: 'Box A is offline.', unreachable: "Can't reach the server.", empty: 'No readings yet.' };
const PICK = { water: 'Water', wait: 'Wait', wait_moist: 'Wait, the soil has water', wait_rain: 'Wait for rain' };
const BRAIN = { laya: 'Laya', rules: 'Baseline rule' };

/*
 * The server's reason, shaped for display only (as sim sentences are): Laya's "Laya: water (soil 30.1%, baseline
 * 45%)" loses the prefix the pick and brain already say; the first letter is capitalized; a period ends it.
 */
function reason(d) {
  let s = d.why.trim();
  const m = s.match(/^Laya:\s*\w+\s*\((.*)\)\s*$/i);
  if (m) s = m[1];
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1);
  return /[.!?)]$/.test(s) ? s : `${s}.`;
}

const moistureFit = (b) => (mn, mx) => {
  const a = Math.min(mn ?? b ?? 40, b ?? Infinity), z = Math.max(mx ?? b ?? 60, b ?? -Infinity);
  const lo = Math.max(0, Math.floor((a - 3) / 5) * 5), hi = Math.min(100, Math.ceil((z + 3) / 5) * 5);
  return [lo, hi, hi - lo <= 25 ? 5 : hi - lo <= 60 ? 10 : 20];
};
const tempFit = (mn, mx) => {
  if (mn == null) return [15, 30, 5];
  const r = mx - mn, g = r <= 3 ? 1 : r <= 10 ? 2 : 5;
  const lo = Math.floor((mn - 0.5) / g) * g, hi = Math.ceil((mx + 0.5) / g) * g;
  return [lo, Math.max(hi, lo + 2 * g), g];
};
const pickA = (r) => (r.a == null || r.a >= IMPLAUSIBLE_PCT ? null : r.a);
const pickT = (r) => r.t1;

// ---- the rail ---------------------------------------------------------------------------------------------

function Dot({ live, beat }) {
  return (
    <Box
      key={beat}
      aria-hidden="true"
      sx={(t) => ({
        width: 6, height: 6, borderRadius: '50%', boxSizing: 'border-box',
        ...(live
          ? { bgcolor: 'text.primary', opacity: 0.25, animation: `fhBeat ${t.dur.pulse}ms ${t.ease}` }
          : { border: '1.5px solid', borderColor: 'text.primary' }),
        '@keyframes fhBeat': { from: { opacity: 1 }, to: { opacity: 0.25 } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 1 },
      })}
    />
  );
}

function StatusBlock({ status, box }) {
  const at = box?.rx != null ? clockAt(box.rx / 1000) : null;
  let word, line;
  // The header tag already names the state ("Live from box A" / "Box A offline"), so the page says the time.
  if (status === 'live') {
    word = `Last reading ${at}`;
    line = 'Box A reports every 10\u00a0s.';
  } else if (status === 'offline') {
    word = `Last reading ${at}`;
    line = `${agoText(box.age).replace(' ', '\u00a0')} ago. Everything here is from then.`;
  } else if (status === 'unreachable') {
    word = "Can't reach the server";
    line = `Trying again every 5\u00a0s.${at ? ` Showing what box A sent at ${at}.` : ''}`;
  } else if (status === 'empty') {
    word = 'No readings yet';
    line = 'The server is up and waiting for box A.';
  } else {
    word = 'Connecting';
    line = '';
  }
  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', columnGap: 2 }}>
        <Typography variant="status" component="h2" sx={{ m: 0 }}>{word}</Typography>
        {status && status !== 'empty' && <Dot live={status === 'live'} beat={status === 'live' ? box?.ms : 'off'} />}
      </Box>
      {/* Screen readers hear state changes only, not the clock ticking over. */}
      <Box component="span" aria-live="polite" sx={visuallyHidden}>{SAY[status] || ''}</Box>
      <Typography variant="body1" sx={{ mt: 0.5, maxWidth: '60ch', minHeight: 48 }}>{line}</Typography>
    </Box>
  );
}

function Reading({ label, value, unit, fault, stale, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
      {fault ? (
        // A fault is the reading's state, not a number (spec 12.3.3). Same line box as tier 1 so the rail holds still.
        <Typography variant="subtitle1" sx={{ color: stale ? 'text.secondary' : 'text.primary', maxWidth: '20ch' }}>{fault}</Typography>
      ) : (
        <Typography variant="tier1" sx={{ whiteSpace: 'nowrap', color: stale ? 'text.secondary' : 'text.primary', fontSize: { xs: '3rem', md: undefined } }}>
          {value == null ? '-' : <Roll value={value} />}
          {value != null && <Typography variant="unit" sx={{ ml: '0.06em' }}>{unit}</Typography>}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function Rail({ status, box }) {
  const stale = status !== 'live';
  const has = box && !box.empty;
  const d = has ? box.decision : null;
  const pumpOn = has && box.pumpA;
  return (
    <Box component="section" aria-label="Box A now">
      <StatusBlock status={status} box={box} />
      {/* Nothing to show yet (loading, no server, no readings): the status says so, and no empty slots pretend otherwise. */}
      {has && (<>

      <Box sx={{ mt: { xs: 3, md: 4 }, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1fr' }, columnGap: 2, rowGap: 4 }}>
        <Reading
          label="Soil moisture" unit="%" stale={stale}
          value={has ? box.soil : null}
          fault={has ? box.soilFault : null}
        >
          {has && box.baseline != null && !box.soilFault && (
            <Bullet
              value={box.soilFault ? null : box.soil} min={box.baseline} scale={[0, 100]}
              sx={{ mt: 1.5, display: { xs: 'none', md: 'block' }, opacity: stale ? 0.7 : 1, overflowX: 'clip' }}
            />
          )}
        </Reading>
        <Reading
          label="Soil temperature" unit=" °C" stale={stale}
          value={has ? box.temp : null}
          fault={has ? box.tempFault : null}
        />
        {/* Phone: the bullet spans both columns under the two numbers. */}
        {has && box.baseline != null && !box.soilFault && (
          <Bullet
            value={box.soilFault ? null : box.soil} min={box.baseline} scale={[0, 100]}
            sx={{ gridColumn: '1 / -1', mt: -2.5, display: { xs: 'block', md: 'none' }, opacity: stale ? 0.7 : 1, overflowX: 'clip' }}
          />
        )}
      </Box>

      <Box sx={{ mt: 4, display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">Pump A</Typography>
        <Typography variant="data" sx={{ color: pumpOn && !stale ? 'moisture.main' : stale ? 'text.secondary' : 'text.primary', fontWeight: 600 }}>
          {!has || box.pumpA == null ? '-' : pumpOn ? (stale ? 'On' : 'Watering') : 'Off'}
        </Typography>
      </Box>

      <Box component="section" aria-label="Last decision" sx={{ mt: 4, minHeight: 92 }}>
        <Typography variant="body2" color="text.secondary">Last decision</Typography>
        {d ? (
          <>
            <Typography variant="body1" sx={{ mt: 0.5, maxWidth: '60ch', color: stale ? 'text.secondary' : 'text.primary' }}>
              <Box component="span" sx={{ fontWeight: 600, color: stale ? 'text.secondary' : 'text.primary' }}>
                {PICK[d.pick] || d.pick}{d.pick === 'water' && d.pumpS ? ` ${Math.round(d.pumpS)} s` : ''}.
              </Box>{' '}
              {reason(d)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
              {BRAIN[d.brain] || d.brain}{box.rx != null ? `, ${clockAt(box.rx / 1000)}` : ''}
            </Typography>
          </>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            None since the server restarted.
          </Typography>
        )}
      </Box>
      </>)}
    </Box>
  );
}

// ---- the history ------------------------------------------------------------------------------------------

function History({ box, phone }) {
  const hist = box && !box.empty ? box.hist : [];
  const pA = useCallback(pickA, []);
  const pT = useCallback(pickT, []);
  if (!hist.length) return null;   // the status line already says there's nothing yet
  const t0 = hist[0].ts, t1 = hist[hist.length - 1].ts;
  const dropped = hist.some((r) => r.a != null && r.a >= IMPLAUSIBLE_PCT);
  const hasT = hist.some((r) => r.t1 != null);
  return (
    <Box component="section" aria-label="History">
      <RealChart
        rows={hist} pick={pA} domain={[t0, t1]} name="Box A" unit="%" tickUnit="%"
        colorKey="moisture.main"
        baseline={box.baseline} height={phone ? 240 : 320} yFit={moistureFit(box.baseline)}
        title="Soil moisture, %" ariaName="Soil moisture in box A"
      />
      {hasT && (
        <Box sx={{ mt: 3 }}>
          <RealChart
            rows={hist} pick={pT} domain={[t0, t1]} name="Soil" unit=" °C"
            colorKey="text.primary" height={phone ? 140 : 160} yFit={tempFit}
            title="Soil temperature, °C" ariaName="Soil temperature in box A"
          />
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, maxWidth: '60ch' }}>
        The last {hist.length.toLocaleString()} readings, {clockAt(t0)} to {clockAt(t1)}, as one-minute medians.
        Breaks are times with no reading.{dropped ? ' Readings of 100% are the probe unplugged and are left out.' : ''}
      </Typography>
    </Box>
  );
}

// ---- the page ---------------------------------------------------------------------------------------------

export default function LivePage() {
  const { box, status } = useBoxData();
  const phone = useMediaQuery((t) => t.breakpoints.down('sm'));
  return (
    <Box sx={{ ...grid12, rowGap: 0 }}>
      <Box sx={{ gridColumn: { xs: '1 / -1', md: '1 / span 4', xl: '1 / span 3' }, alignSelf: 'start' }}>
        <Rail status={status} box={box} />
      </Box>
      <Box sx={{ gridColumn: { xs: '1 / -1', md: '5 / -1', xl: '4 / -1' }, alignSelf: 'start', mt: { xs: 4, md: 0 } }}>
        <History box={box} phone={phone} />
      </Box>
      <Box
        sx={{
          gridColumn: '1 / -1', mt: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          flexWrap: 'wrap', gap: 3,
        }}
      >
        <Typography variant="body1">
          Try it with a simulated box on the <Link href="#/demo">Demo page</Link>.
        </Typography>
        {PHOTO && (
          <Box component="figure" sx={{ m: 0, width: 160 }}>
            <Box component="img" src={PHOTO} alt="Box A on the bench" sx={{ display: 'block', width: '100%', border: '1px solid', borderColor: 'divider' }} />
            <Typography variant="caption" color="text.secondary" component="figcaption" sx={{ mt: 0.5 }}>{PHOTO_CAPTION}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
