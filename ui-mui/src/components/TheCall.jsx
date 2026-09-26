import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { BRAIN, PICK, callSentence, isStale, makeTime, soilAt, whenNext } from '../format.js';
import { useSim } from '../useFarmHand.js';
import Notice from './Notice.jsx';

/*
 * The call (spec 9.L.3): one sentence, Laya's first call while the Gemini team is on it, and a meta line that
 * ends in "Check now". A call whose soil has since moved more than 2 points becomes a past-tense line with the
 * next check time, so an old sentence never reads as the current state next to the live number.
 * The team's running count lives in the status word ("Checking 32 s"), so it isn't repeated here.
 */
export default function TheCall({ fh, act, covered }) {
  useSim(2);
  const [msg, setMsg] = useState('');
  const T = makeTime(fh);
  // Target runs are a person's, so they show in the status word and the receipt instead.
  const d = [...fh.decisions].reverse().find((x) => x.brain !== 'target run');
  const la = fh.LAST.laya;
  const stale = d && isStale(fh, d);
  let sentence;
  if (!d) {
    const s = fh.nextCheck - fh.t;
    sentence = `First check ${whenNext(fh, fh.nextCheck)}${s <= 90 ? ', then every 15 min' : ''}.`;
  } else if (stale) {
    const then = soilAt(fh, d.ts);
    const did = d.action === 'water' ? `Watered ${Math.round(d.seconds)} s` : 'Waited';
    sentence = `${did} at ${T.hhmm(d.ts)} (soil ${then.toFixed(1)}%). Next check ${T.hhmm(fh.nextCheck)}.`;
  } else sentence = callSentence(fh, d);

  // Laya's instant pick, only in Gemini mode (in Laya or rules mode the sentence already names the brain).
  const layaLine = fh.brainMode === 'gemini' && la && !stale
    && (fh.team || (d && d.brain === 'gemini (simulated)' && la.ts >= d.ts - 60));

  return (
    <Box
      component="section"
      aria-label="The call"
      inert={covered || undefined}
      aria-hidden={covered || undefined}
      sx={(t) => ({ opacity: covered ? 0 : 1, transition: `opacity ${t.dur.panel}ms ${t.ease}` })}
    >
      <Typography variant="body1" sx={{ maxWidth: '60ch' }} aria-live="polite">{sentence}</Typography>
      {layaLine && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Laya&apos;s first call: {PICK[la.pick] || la.pick}, <Box component="span" sx={{ fontWeight: 600 }}>{Math.round(la.sure * 100)}% sure</Box>.
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, mt: 0.5 }}>
        {d && <Typography variant="caption" color="text.secondary">{BRAIN[d.brain] || d.brain}, {T.hhmm(d.ts)}</Typography>}
        <Button
          variant="text"
          size="small"
          disabled={!!fh.team}
          onClick={() => setMsg(act((f) => f.checkNow('button')) ? '' : 'Already checking.')}
          sx={{ ml: d ? -0.5 : -1 }}
        >
          Check now
        </Button>
      </Box>
      {msg && <Notice reserve={1}>{msg}</Notice>}
    </Box>
  );
}
