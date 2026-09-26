import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';

/*
 * Alerts slide in over the block they cover (the call on Demo, the headline on Vs timer): never a modal, never
 * pushing the layout. A fault is filled red (the one red thing on screen); a hand pour is a paper box with a 1 px
 * ink border (theme MuiAlert). The owner makes the covered content `inert` while an alert is up.
 * Enter: 10 px + opacity, 250 ms strong ease-out, 60 ms after the content under it starts fading, so the two
 * never double-expose. Exit: opacity only, 150 ms (exit faster than enter; Emil, impeccable). Reduced motion:
 * opacity only both ways. They don't time out (WCAG 2.2.1); they clear when the condition ends or when closed.
 */
const EXIT_MS = 150;

export default function AlertOverlay({ alert }) {
  const [closed, setClosed] = useState(null);
  const key = alert?.key;
  const open = !!alert && key !== closed;
  // Keep the last alert on screen while it fades out.
  const last = useRef(null);
  if (open) last.current = alert;
  const [phase, setPhase] = useState(open ? 'enter' : 'gone');   // 'enter' -> 'in' -> 'out' -> 'gone'

  useEffect(() => {
    if (open) {
      setPhase('enter');
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('in')));
      return () => cancelAnimationFrame(r);
    }
    setPhase((p) => (p === 'gone' ? 'gone' : 'out'));
    const t = setTimeout(() => setPhase('gone'), EXIT_MS);
    return () => clearTimeout(t);
  }, [open, key]);

  const a = open ? alert : last.current;
  if (!a || phase === 'gone') return null;
  const shown = phase === 'in';
  const leaving = phase === 'out';
  return (
    <Box
      aria-hidden={leaving || undefined}
      sx={(t) => ({
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,   // flush with the text it covers
        opacity: shown ? 1 : 0,
        transform: shown || leaving ? 'none' : 'translateY(-10px)',
        pointerEvents: leaving ? 'none' : undefined,
        transition: leaving
          ? `opacity ${EXIT_MS}ms ${t.ease}`
          : `opacity ${t.dur.panel}ms ${t.ease} 60ms, transform ${t.dur.panel}ms ${t.ease} 60ms`,
        '@media (prefers-reduced-motion: reduce)': { transform: 'none' },
      })}
    >
      <Alert
        variant="filled"
        severity={a.severity}
        role={a.severity === 'error' ? 'alert' : 'status'}
        onClose={() => setClosed(a.key)}
        slotProps={{ closeButton: { sx: { width: 44, height: 44 } } }}
        sx={(t) => ({ boxShadow: `0 6px 16px ${t.palette.shadow}`, alignItems: 'flex-start', '& .MuiAlert-message': { minWidth: 0 } })}
      >
        <AlertTitle sx={{ fontWeight: 600, fontSize: 16, lineHeight: '24px', mb: 0.25 }}>{a.title}</AlertTitle>
        {a.msg}
      </Alert>
    </Box>
  );
}
