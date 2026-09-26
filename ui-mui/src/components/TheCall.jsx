import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { ago, BRAIN, PICK, callSentence, isStale, makeTime, soilAt } from '../format.js';
import { useSim } from '../useFarmHand.js';

/*
 * Tier 2 (PLAN 5d): the call in one sentence, Laya's pick, and the Gemini team counting while it works.
 * A call whose soil has since moved more than 2 points becomes a past-tense line with the next check time,
 * so an old sentence never reads as the current state next to the live number.
 */
export default function TheCall({ fh, act, frac, covered }) {
  useSim(2);
  const [msg, setMsg] = useState('');
  const T = makeTime(fh);
  // Target runs are a person's, so they show in the pump state and the receipt instead.
  const d = [...fh.decisions].reverse().find((x) => x.brain !== 'target run');
  const la = fh.LAST.laya;
  const then = d ? soilAt(fh, d.ts) : null;
  const stale = d && isStale(fh, d);
  let sentence;
  if (!d) sentence = `First check in ${Math.max(0, Math.ceil(fh.nextCheck - fh.t))} s, then every 15 min.`;
  else if (stale) {
    const did = d.action === 'water' ? `Watered ${Math.round(d.seconds)} s` : 'Waited';
    sentence = `${did} at ${T.hhmm(d.ts)} (soil ${then.toFixed(1)}%). Next check ${T.hhmm(fh.nextCheck)}.`;
  } else sentence = callSentence(fh, d);
  const layaFresh = la && fh.brainMode !== 'rules';

  return (
    <Box
      component="section"
      aria-label="The call"
      inert={covered || undefined}
      aria-hidden={covered || undefined}
      sx={(t) => ({ minHeight: 104, opacity: covered ? 0 : 1, transition: `opacity ${t.dur.panel}ms ${t.ease}` })}
    >
      <Typography variant="body1" sx={{ maxWidth: '60ch' }} aria-live="polite">{sentence}</Typography>
      {layaFresh && (
        <Typography variant="body2" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}>
          <b>Laya</b>: {PICK[la.pick] || la.pick}, <Box component="span" sx={{ color: 'moisture.main', fontWeight: 600 }}>{Math.round(la.sure * 100)}% sure, {Math.round(la.ms)} ms</Box>
        </Typography>
      )}
      {fh.team && (
        <Typography variant="body2" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }} aria-live="off">
          <b>Gemini team</b> thinking, <Box component="span" sx={{ color: 'moisture.main', fontWeight: 600 }}>{Math.floor(fh.t - fh.team.t0 + frac())} s</Box>
        </Typography>
      )}
      <Stack direction="row" useFlexGap sx={{ mt: 0.5, gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {d && <Typography variant="caption" color="text.secondary">{BRAIN[d.brain] || d.brain}, {ago(fh.t - d.ts)}</Typography>}
        <Button
          variant="text"
          disabled={!!fh.team}
          onClick={() => setMsg(act((f) => f.checkNow('button')) ? '' : 'Already checking.')}
          sx={{ ml: 'auto' }}
        >
          Check now
        </Button>
      </Stack>
      <Box role="status" aria-live="polite">
        {msg && <Alert severity="warning" onClose={() => setMsg('')} sx={{ mt: 1.5 }}>{msg}</Alert>}
      </Box>
    </Box>
  );
}
