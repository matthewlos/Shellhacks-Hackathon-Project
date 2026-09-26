import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { CFG } from '../sim.js';
import { onFrame, prefs } from '../motion.js';
import { createDriver } from './drive.js';

/*
 * The rig in 3D (RIG3D.md). Mounted by the Demo stage (Stage.jsx, builder L) with React.lazy:
 *
 *   const Rig3D = lazy(() => import('../rig3d/Rig3D.jsx'));
 *   <Suspense fallback={rig2d}><Rig3D fh={fh} fallback={rig2d} /></Suspense>
 *
 * It fills its parent (position: absolute; inset: 0); the parent sets the size. While the model loads, with no
 * WebGL, or if anything fails, it shows `fallback` (the 2D drawing) centered, then cross-fades to the 3D view in
 * 200 ms. Labels are HTML over the canvas, placed from projected 3D points each frame; they hide under 600 px,
 * where the stage's phone line carries the same facts.
 * three.js is imported only inside the effect (a separate chunk), so the page's first paint doesn't wait for it.
 */

const BASE = `${import.meta.env.BASE_URL || '/'}rig/`;
const mlFmt = new Intl.NumberFormat();

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// Labels. Parts get a 1px leader ending in a 2px dot on the part (as in the 2D drawing); data chips sit on their line.
// `lead` is the leader in CSS px at a 1300 px wide stage (scaled with the stage); `place` sets where the text sits
// relative to the leader's end.
const PLACE = {
  above: 'translate(-50%, calc(-100% - 3px))',
  below: 'translate(-50%, 3px)',
  right: 'translate(5px, -50%)',
  left: 'translate(calc(-100% - 5px), -50%)',
  aboveRight: 'translate(4px, calc(-100% - 2px))',
  underLine: 'translate(0, 3px)',
  overLine: 'translate(0, calc(-100% - 3px))',
};
const LABELS = {
  probe: { anchor: 'probe', lead: [-24, -84], place: 'above' },
  temp: { anchor: 'temp', lead: [86, -58], place: 'right' },
  pump: { anchor: 'pump', lead: null, place: 'below' },
  relay: { anchor: 'relay', lead: [70, 34], place: 'right' },
  esp: { anchor: 'esp', lead: [-8, 92], place: 'below' },
  level: { anchor: 'level', place: 'underLine' },
  min: { anchor: 'min', place: 'underLine' },
  target: { anchor: 'target', place: 'overLine' },
  pour: { anchor: 'nozzle', place: 'aboveRight' },
};
const LEADERS = ['probe', 'temp', 'relay', 'esp'];

function summary(fh, s) {
  const pct = fh.nowPct();
  const bits = [
    pct != null ? `Soil ${pct.toFixed(0)}%` : 'No reading yet',
    s.relayOn ? (fh.world.pinched ? 'pump running, tube pinched' : 'pump running') : fh.world.pinched ? 'pump off, tube pinched' : 'pump off',
    s.cupMl > 0.5 ? `cup ${mlFmt.format(Math.round(s.cupMl))} ml` : 'cup empty',
  ];
  if (s.target != null) bits.push(`target ${s.target}%`);
  return `Three-quarter view of the rig: a clear tote of soil with a soil probe and a temperature probe, pump A in a cup of water, and the relay and ESP32 on a breadboard. ${bits.join(', ')}.`;
}

export default function Rig3D({ fh, fallback = null, sx }) {
  const theme = useTheme();
  const { palette } = theme;
  const holder = useRef(null);
  const labels = useRef({});
  const [mode, setMode] = useState('loading');   // loading | ready | failed
  const [fallbackGone, setFallbackGone] = useState(false);

  useEffect(() => {
    if (!hasWebGL()) { setMode('failed'); return undefined; }
    let alive = true, stage = null, off = null, io = null, ro = null, visible = true, first = true, lastAria = '', ariaAt = 0;
    const drive = createDriver(fh);
    const onVis = () => { if (!document.hidden) force = true; };
    let force = true;

    import('./scene.js')
      .then(({ createScene }) => createScene({ container: holder.current, palette, base: BASE, reduced: prefs.reduced }))
      .then((s) => {
        if (!alive) { s.dispose(); return; }
        stage = s;
        const canvas = s.canvas;
        canvas.setAttribute('role', 'img');
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (alive) setMode('failed'); });
        const size = () => { const r = holder.current.getBoundingClientRect(); s.resize(r.width, r.height); force = true; };
        ro = new ResizeObserver(size);
        ro.observe(holder.current);
        size();
        io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) force = true; });
        io.observe(holder.current);
        document.addEventListener('visibilitychange', onVis);

        off = onFrame((now, dt) => {
          const st = drive(now, dt);
          const need = s.update(st, now, dt);
          if (!visible || document.hidden) return;
          if (need || force) {
            s.render();
            force = false;
            placeLabels(s, st);
            if (first) { first = false; setMode('ready'); }
          }
          if (now - ariaAt > 1000) {
            ariaAt = now;
            const a = summary(fh, st);
            if (a !== lastAria) { lastAria = a; canvas.setAttribute('aria-label', a); }
          }
        }, 20);
      })
      .catch((err) => {
        console.info('Rig3D: showing the 2D drawing instead.', err?.message || err);
        if (alive) setMode('failed');
      });

    // Labels: position from projected anchors; text from the state. Written to the DOM, no React state per frame.
    function placeLabels(s, st) {
      const n = labels.current;
      const k = Math.max(0.6, Math.min(1.2, (holder.current?.clientWidth || 1300) / 1300));
      const put = (key, show, text) => {
        const el = n[key], spec = LABELS[key];
        if (!el) return null;
        const p = show ? s.project(spec.anchor) : null;
        const on = !!(p && p.ok);
        if (text != null && el.__t !== text) { el.__t = text; el.firstChild.textContent = text; }
        const lx = on && spec.lead ? spec.lead[0] * k : 0, ly = on && spec.lead ? spec.lead[1] * k : 0;
        if (on) el.style.transform = `translate(${(p.x + lx).toFixed(1)}px, ${(p.y + ly).toFixed(1)}px) ${PLACE[spec.place]}`;
        el.style.visibility = on ? 'visible' : 'hidden';
        const line = n[`${key}Lead`], dot = n[`${key}Dot`];
        if (line && dot) {
          line.style.visibility = dot.style.visibility = on ? 'visible' : 'hidden';
          if (on) {
            line.setAttribute('x1', p.x.toFixed(1)); line.setAttribute('y1', p.y.toFixed(1));
            line.setAttribute('x2', (p.x + lx).toFixed(1)); line.setAttribute('y2', (p.y + ly).toFixed(1));
            dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1));
          }
        }
        return on ? p : null;
      };
      put('probe', true);
      put('temp', true);
      const tv = n.temp?.querySelector('[data-val]');
      const tText = st.tempC != null ? `${st.tempC.toFixed(1)} °C` : '';
      if (tv && tv.__t !== tText) { tv.__t = tText; tv.textContent = tText; }
      put('pump', true);
      const cupEl = n.pump?.querySelector('[data-cup]');
      const cupText = st.cupMl > 0.5 ? `${mlFmt.format(Math.round(st.cupMl))} ml left` : 'Cup empty';
      if (cupEl && cupEl.__t !== cupText) { cupEl.__t = cupText; cupEl.textContent = cupText; }
      put('relay', true);
      put('esp', true);
      const lv = put('level', true);
      const tg = put('target', st.target != null, st.target != null ? `target ${st.target}%` : null);
      // the min label steps aside when the waterline or target label would crowd it (as in 2D)
      const mp = s.project('min');
      const crowd = mp && ((lv && Math.abs(mp.y - lv.y) < 26) || (tg && Math.abs(mp.y - tg.y) < 30));
      put('min', !crowd, `min ${CFG.DRY_PCT}%`);
      const pe = n.pour;
      if (pe) {
        put('pour', st.chip.alpha > 0.001, st.chip.text);
        pe.style.opacity = st.chip.alpha.toFixed(3);
        pe.style.marginTop = `${st.chip.rise.toFixed(1)}px`;
      }
    }

    return () => {
      alive = false;
      off?.();
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      stage?.dispose();
    };
  }, [fh, palette]);

  // cross-fade: the fallback leaves 200 ms after the first 3D frame (at once with reduced motion)
  useEffect(() => {
    if (mode !== 'ready') return undefined;
    const t = setTimeout(() => setFallbackGone(true), prefs.reduced ? 0 : 200);
    return () => clearTimeout(t);
  }, [mode]);

  const R = palette.rig;
  const fade = prefs.reduced ? 'none' : `opacity 200ms ${theme.ease || 'ease-out'}`;
  const chipBase = {
    position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', px: 0.75, py: 0.125,
    bgcolor: R.tag, borderRadius: theme.radius?.tag ?? '2px', opacity: 1, visibility: 'hidden',
    '@supports (background: color-mix(in srgb, red, blue))': { bgcolor: `color-mix(in srgb, ${R.tag} 92%, transparent)` },
  };
  const part = {
    position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', visibility: 'hidden', color: 'text.secondary',
    fontWeight: 600, textShadow: `0 0 3px ${R.halo}, 0 0 3px ${R.halo}, 0 0 2px ${R.halo}`, textAlign: 'center',
  };
  const ref = (k) => (el) => { labels.current[k] = el; };

  return (
    <Box sx={{ position: 'absolute', inset: 0, ...sx }}>
      {mode !== 'failed' && (
        <Box ref={holder} sx={{ position: 'absolute', inset: 0, opacity: mode === 'ready' ? 1 : 0, transition: fade }} />
      )}
      {mode !== 'failed' && (
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', display: { xs: 'none', sm: 'block' }, opacity: mode === 'ready' ? 1 : 0, transition: fade }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
            {LEADERS.map((k) => (
              <g key={k}>
                <line ref={ref(`${k}Lead`)} stroke={R.leader} strokeWidth="1" style={{ visibility: 'hidden' }} />
                <circle ref={ref(`${k}Dot`)} r="2" fill={R.label} style={{ visibility: 'hidden' }} />
              </g>
            ))}
          </svg>
          <Typography ref={ref('probe')} variant="caption" component="div" sx={part}><span>Soil probe D32</span></Typography>
          <Typography ref={ref('temp')} variant="caption" component="div" sx={{ ...part, textAlign: 'left' }}>
            <span>Temp probe D4</span><br /><Box component="span" data-val="" sx={{ typography: 'data', fontWeight: 600, color: palette.temp.main }} />
          </Typography>
          <Typography ref={ref('pump')} variant="caption" component="div" sx={part}>
            <span>Pump A, 20 ml/s</span><br /><span data-cup="" />
          </Typography>
          <Typography ref={ref('relay')} variant="caption" component="div" sx={part}><span>Relay D26</span></Typography>
          <Typography ref={ref('esp')} variant="caption" component="div" sx={part}><span>ESP32</span></Typography>
          <Typography ref={ref('level')} variant="caption" component="div" sx={{ ...chipBase, fontWeight: 600, color: 'text.primary' }}><span>waterline (modeled)</span></Typography>
          <Typography ref={ref('min')} variant="caption" component="div" sx={{ ...chipBase, fontWeight: 600, color: 'text.secondary' }}><span /></Typography>
          <Typography ref={ref('target')} variant="caption" component="div" sx={{ ...chipBase, fontWeight: 600, color: 'text.primary' }}><span /></Typography>
          <Typography ref={ref('pour')} variant="subtitle1" component="div" role="status" sx={{ ...chipBase, color: palette.moisture.main, fontVariantNumeric: 'tabular-nums', opacity: 0 }}><span /></Typography>
        </Box>
      )}
      {(!fallbackGone || mode === 'failed') && (
        <Box
          aria-hidden={mode === 'ready' || undefined}
          sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: mode === 'ready' ? 0 : 1, transition: fade, pointerEvents: mode === 'ready' ? 'none' : 'auto',
            '& > *': { width: '100%', maxHeight: '100%' },
          }}
        >
          {fallback}
        </Box>
      )}
    </Box>
  );
}
