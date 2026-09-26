import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import { CFG } from '../sim.js';
import { BY, RULE, callSentence, f1, isStale, ml, isBad, makeTime, signed } from '../format.js';
import { useSim } from '../useFarmHand.js';
import TextChoice from './TextChoice.jsx';

const AGENTS = [
  { node: 'laya', name: 'Laya', note: 'first call' },
  { group: 'Gemini team: gather' },
  { node: 'weather_agent', name: 'weather_agent', note: 'forecast', sub: true },
  { node: 'soil_agent', name: 'soil_agent', note: 'soil', sub: true },
  { node: 'memory_agent', name: 'memory_agent', note: 'past pours', sub: true },
  { group: 'Gemini team: decide (up to 3 rounds)' },
  { node: 'planner_agent', name: 'planner_agent', note: 'plans', sub: true },
  { node: 'critic_agent', name: 'critic_agent', note: 'checks', sub: true },
  { group: 'Plain code' },
  { node: 'guards', name: 'Safety rules', note: 'blocks unsafe pours' },
  { node: 'executor', name: 'Pump control' },
  { node: 'soak', name: 'Pour detector', note: 'learns soak rate' },
  { node: 'target_agent', name: 'Target run' },
];

// "working" = running right now: the team's current step, the soak watch, a target run.
// "recent" = logged something in the last 6 s (the /api/live "busy" window) but already finished.
function agentStates(fh) {
  const recent = {}, blocked = {}, working = {};
  for (const a of fh.activity) {
    if (fh.t - a.ts >= 6) continue;
    recent[a.agent] = true;
    if (isBad(a.what)) blocked[a.agent] = true;
  }
  if (fh.team) for (const s of fh.team.plan.slice(0, fh.team.i).slice(-1)) s.agents.forEach((a) => { working[a] = true; });
  if (fh.live.phase === 'soaking') working.soak = true;
  if (fh.tgt) working.target_agent = true;
  return (k) => (blocked[k] ? 'blocked' : working[k] ? 'working' : recent[k] ? 'recent' : 'idle');
}

function StatusDot({ state }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={(t) => ({
        width: 8, height: 8, borderRadius: '50%', flex: 'none',
        // Ink, never blue or red: blue is water, red is the one alert. The word beside it names the state.
        bgcolor: state === 'working' || state === 'blocked' ? 'text.primary' : state === 'recent' ? 'dotRecent' : 'transparent',
        transition: `background-color ${t.dur.tip}ms ${t.ease}`,
      })}
    />
  );
}

function TeamTab({ fh, act, hhmm }) {
  const state = agentStates(fh);
  return (
    <>
      <TextChoice
        label="Decided by"
        value={fh.brainMode}
        onChange={(v) => v && act((f) => { f.brainMode = v; })}
        options={[{ value: 'gemini', label: 'Gemini team' }, { value: 'laya', label: 'Laya' }, { value: 'rules', label: 'Rules' }]}
        sx={{ mb: 2 }}
      />
      {(() => {
        const d = [...fh.decisions].reverse().find((x) => x.brain !== 'target run');
        // The live column already shows a fresh call word for word; repeat it here only once it has gone stale.
        return d && isStale(fh, d) ? (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" component="h2">Last call, {hhmm(d.ts)}</Typography>
            <Typography variant="body2">{callSentence(fh, d)}</Typography>
          </Box>
        ) : null;
      })()}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
        On the real rig: Gemini team on Google ADK (<Typography variant="code">brain.py</Typography>), Laya fine-tuned (<Typography variant="code">laya/</Typography>).
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {AGENTS.map((a) => a.group ? (
          <Typography key={a.group} component="li" variant="overline" color="text.secondary" sx={{ display: 'block', pt: 1.5, pb: 0.25 }}>{a.group}</Typography>
        ) : (
          <Stack key={a.node} component="li" direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5, pl: a.sub ? 2 : 0 }}>
            <StatusDot state={state(a.node)} />
            {a.name.includes('_')
              ? <Typography variant="code">{a.name}</Typography>
              : <Typography variant="body2">{a.name}</Typography>}
            {(state(a.node) === 'working' || state(a.node) === 'blocked') && <Typography variant="caption" sx={{ fontWeight: 600 }}>{state(a.node)}</Typography>}
            {a.note && <Typography variant="caption" color="text.secondary">{a.note}</Typography>}
          </Stack>
        ))}
      </Box>

      <Typography variant="overline" color="text.secondary" component="h2" sx={{ display: 'block', mt: 1.5 }}>Safety rules</Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {fh.guardReport().map((g) => (
          <Stack key={g.rule} component="li" direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.25 }}>
            {g.ok ? <CheckCircleIcon sx={{ fontSize: 16, color: 'success.text' }} titleAccess="pass" /> : <BlockIcon sx={{ fontSize: 16, color: 'text.primary' }} titleAccess="blocked" />}
            <Typography variant="body2" sx={{ flex: 1, fontWeight: g.ok ? 400 : 600 }}>{RULE[g.rule] || g.rule}{g.ok ? '' : ': not now'}</Typography>
            <Typography variant="code" sx={{ color: g.ok ? 'text.secondary' : 'text.primary', textAlign: 'right' }}>{g.detail.replace(/\u2013/g, '-')}</Typography>
          </Stack>
        ))}
      </Box>

      <Typography variant="overline" color="text.secondary" component="h2" sx={{ display: 'block', mt: 1.5 }}>Activity</Typography>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 320, overflow: 'auto', borderTop: 1, borderColor: 'divider', pt: 0.5 }} tabIndex={0} aria-label="Activity log, newest first">
        {fh.activity.length === 0 && <Typography component="li" variant="body2" color="text.secondary">Nothing yet.</Typography>}
        {fh.activity.slice(-40).reverse().map((a, i) => (
          <Typography key={`${a.ts}-${i}`} component="li" variant="body2" sx={{ py: 0.25, fontWeight: isBad(a.what) ? 600 : 400 }}>
            <Box component="time" sx={{ typography: 'caption', fontVariantNumeric: 'tabular-nums', color: 'text.secondary', mr: 1 }}>{hhmm(a.ts)}</Box>
            {a.agent}: {a.what}
          </Typography>
        ))}
      </Box>
    </>
  );
}

function PoursTab({ fh, hhmm }) {
  // Live box page: box A only (PLAN 5e). Box B's pours are on the Control page.
  const rows = fh.soaks.filter((s) => s.pot !== 'B').slice(-30).reverse();
  const w = fh.watch && fh.watch.pot !== 'B' ? fh.watch : null;
  const num = { textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <TableContainer>
      <Table size="small" aria-label="Pours, newest first">
        <TableHead>
          <TableRow>{['Time', 'By', 'Pump (s)', 'Soil (%)', 'Rise (%)', 'Soak (%/s)'].map((h, i) => <TableCell key={h} align={i >= 2 ? 'right' : 'left'}>{h}</TableCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {!rows.length && !w && <TableRow><TableCell colSpan={6} sx={{ color: 'text.secondary' }}>No pours yet.</TableCell></TableRow>}
          {w && (
            <TableRow>
              <TableCell>{hhmm(w.t0)}</TableCell><TableCell>{BY[w.by] || w.by}</TableCell>
              <TableCell sx={num}>{w.poured_s}</TableCell><TableCell colSpan={3} sx={{ color: 'text.secondary' }}>soaking</TableCell>
            </TableRow>
          )}
          {rows.map((s, i) => {
            const bad = !s.ok ? { fontWeight: 600 } : {};
            return (
              <TableRow key={`${s.ts}-${i}`}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{hhmm(s.ts)}</TableCell>
                <TableCell>{s.note === 'target pulse' ? 'Target' : BY[s.by] || s.by}</TableCell>
                <TableCell sx={num}>{s.poured_s}<Box component="span" sx={{ display: 'block', typography: 'caption', color: 'text.secondary' }}>{Math.round(s.poured_s * CFG.FLOW_ML_S)} ml</Box></TableCell>
                <TableCell sx={{ ...num, ...bad }}>{f1(s.before_pct)} to {f1(s.peak_pct)}</TableCell>
                <TableCell sx={{ ...num, ...bad }}>{signed(s.rise_pct)}{!s.ok && <Box component="span" sx={{ display: 'block', typography: 'caption' }}>missed</Box>}</TableCell>
                <TableCell sx={{ ...num, ...bad }}>{s.pct_per_s == null ? '-' : s.pct_per_s.toFixed(2)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Item({ label, note, value }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', py: 1 }}>
      <Box component="dt" sx={{ minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        {note && <Typography variant="caption" color="text.secondary" component="p">{note}</Typography>}
      </Box>
      <Typography component="dd" variant="data" sx={{ m: 0, whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );
}

// Tier 4 (PLAN 5d): secondary numbers for box A, kept off the main screen (6-number limit).
function DetailsTab({ fh }) {
  const rep = fh.report();
  return (
    <Box component="dl" sx={{ m: 0 }}>
      <Item label="Water, 24 h" note={`cap ${CFG.DAILY_MAX_ML.toLocaleString()} ml`} value={ml(fh.mlToday())} />
      <Item label="Soak rate" note="median of last 5 pours" value={fh.learnedPctPerS().toFixed(2) + '% per s'} />
      <Item label="Time in band" value={rep.ai_pot_time_healthy_pct == null ? '-' : rep.ai_pot_time_healthy_pct.toFixed(1) + '%'} />
      <Item label="Test pours" note="included above" value={ml(rep.ai_pot_demo_ml)} />
      {/* Hard-coded for the demo, so its source sits next to it (copy audit call c). */}
      <Item label="Miami-Dade in drought" note="US Drought Monitor, Sep 15" value="100%" />
    </Box>
  );
}

function SerialTab({ fh, clock }) {
  const ref = useRef(null);
  const text = fh.serial.slice(-80).map((l) => `${clock(l.t)} ${l.dir} ${l.text}`).join('\n');
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [text]);
  return (
    <Box
      component="pre"
      ref={ref}
      tabIndex={0}
      aria-label="Serial log: > is laptop to chip, < is chip to laptop"
      onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 20; }}
      sx={{ m: 0, height: 260, overflow: 'auto', typography: 'code', bgcolor: 'serial.bg', color: 'serial.fg', p: 1.5, borderRadius: '4px', whiteSpace: 'pre' }}
    >
      {text}
    </Box>
  );
}

export const VIEWS = [
  { value: 'team', label: 'Agent team' },
  { value: 'pours', label: 'Pours' },
  { value: 'serial', label: 'Serial' },
  { value: 'details', label: 'Details' },
];

// The log drawer's views (spec 9.L.8): data unchanged from the old tabs, restyled. The drawer picks the view.
export default function LogViews({ fh, act, view }) {
  useSim(1);
  const T = makeTime(fh);
  return (
    <Box role="region" aria-label={VIEWS.find((v) => v.value === view)?.label}>
      {view === 'team' && <TeamTab fh={fh} act={act} hhmm={T.hhmm} />}
      {view === 'pours' && <PoursTab fh={fh} hhmm={T.hhmm} />}
      {view === 'serial' && <SerialTab fh={fh} clock={T.clock} />}
      {view === 'details' && <DetailsTab fh={fh} />}
    </Box>
  );
}
