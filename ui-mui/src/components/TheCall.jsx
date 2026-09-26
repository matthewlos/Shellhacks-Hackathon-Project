import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ago, PICK, makeTime } from '../format.js';

const BRAIN = { 'gemini (simulated)': 'Gemini team', rules: 'Rules', 'laya (fast decider)': 'Laya' };

// The soil reading at (or just before) sim time t.
function soilAt(fh, t) {
  const h = fh.history;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i].a;
  return null;
}

// Tier 2 (PLAN 5d): the call in one sentence, Laya's pick with its confidence and time, and the
// Gemini team's reason when it finishes. While the team works it counts ("thinking, 6 s"), never a bare spinner.
export default function TheCall({ fh, act, frac, covered }) {
  const [msg, setMsg] = useState('');
  // The AI's latest call. Target runs are a person's, so they show in the pump state and the receipt instead.
  const d = [...fh.decisions].reverse().find((x) => x.brain !== 'target run');
  const la = fh.LAST.laya;
  let sentence = d ? d.sentence.replace(/^(WATER|WAIT|TARGET):\s*/, '') : 'The first check runs 20 s after start, then every 15 min.';
  sentence = sentence[0].toUpperCase() + sentence.slice(1);
  // If the soil has moved more than 2 points since the call, say when the call was made,
  // so an old sentence can't read as the current state next to the live number.
  const then = d ? soilAt(fh, d.ts) : null;
  // A stale call gets a past-tense summary instead of the brain's present-tense sentence, so it never shows a
  // second "current" number. The sentence word for word stays in the Agent team tab.
  const stale = d && then != null && fh.latest && Math.abs(fh.latest.a_pct - then) > 2;
  if (stale) {
    const who = BRAIN[d.brain] || d.brain;
    const did = d.action === 'water' ? `watered for ${Math.round(d.seconds)} s` : 'waited';
    sentence = `At ${makeTime(fh).hhmm(d.ts)} (soil ${then.toFixed(1)}%), ${who} ${did}. The soil has moved since; the next check decides again.`;
  }
  const meta = d ? `${BRAIN[d.brain] || d.brain}, ${ago(fh.t - d.ts)} (simulated)` : '';
  const layaFresh = la && fh.brainMode !== 'rules';

  return (
    <Box
      component="section"
      aria-label="The call"
      inert={covered ? '' : undefined}
      aria-hidden={covered || undefined}
      sx={(t) => ({ minHeight: 104, opacity: covered ? 0 : 1, transition: `opacity ${t.dur.panel}ms ${t.ease}` })}
    >
      <Typography variant="body1" sx={{ maxWidth: '60ch' }} aria-live="polite">{sentence}</Typography>
      {layaFresh && (
        <Typography variant="body2" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}>
          <Box component="b">Laya</Box>: {PICK[la.pick] || la.pick}, <Box component="span" sx={{ color: 'moisture.main', fontWeight: 600 }}>{Math.round(la.sure * 100)}% sure, {la.ms.toFixed(1)} ms</Box>
          <Box component="span" sx={{ color: 'text.secondary' }}> (simulated)</Box>
        </Typography>
      )}
      {fh.team && (
        <Typography variant="body2" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }} aria-live="off">
          <Box component="b">Gemini team</Box> thinking, <Box component="span" sx={{ color: 'moisture.main', fontWeight: 600 }}>{Math.floor(fh.t - fh.team.t0 + frac())} s</Box>
          <Box component="span" sx={{ color: 'text.secondary' }}> (simulated)</Box>
        </Typography>
      )}
      <Stack direction="row" useFlexGap sx={{ mt: 1, gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">{meta}</Typography>
        <Button
          variant="outlined"
          startIcon={<PlayArrowIcon />}
          disabled={!!fh.team}
          onClick={() => setMsg(act((f) => f.checkNow('button')) ? '' : 'The agents are already working.')}
          sx={{ ml: 'auto' }}
        >
          Run agents
        </Button>
      </Stack>
      <Box role="status" aria-live="polite">
        {msg && <Alert severity="warning" onClose={() => setMsg('')} sx={{ mt: 1.5 }}>{msg}</Alert>}
      </Box>
    </Box>
  );
}
