import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';

/*
 * Alerts slide in over the top of the right column (PLAN 5d): never a modal, never pushing the layout.
 * 10 px + opacity, 250 ms strong ease-out (emil-design-eng). Reduced motion: opacity only.
 * They don't time out (WCAG 2.2.1); they clear when the condition ends or when closed.
 */
export default function AlertOverlay({ alert }) {
  const [closed, setClosed] = useState(null);
  const [shown, setShown] = useState(false);
  const key = alert?.key;
  const open = !!alert && key !== closed;
  useEffect(() => {
    if (!open) { setShown(false); return undefined; }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open, key]);
  if (!open) return null;
  return (
    <Box
      sx={(t) => ({
        position: 'absolute', top: 0, left: { xs: 16, lg: 24 }, right: { xs: 16, lg: 24 }, zIndex: 5,
        opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(-10px)',
        transition: `opacity ${t.dur.panel}ms ${t.ease}, transform ${t.dur.panel}ms ${t.ease}`,
        '@media (prefers-reduced-motion: reduce)': { transform: 'none' },
      })}
    >
      <Alert
        variant="filled"
        severity={alert.severity}
        role={alert.severity === 'error' ? 'alert' : 'status'}
        onClose={() => setClosed(key)}
        slotProps={{ closeButton: { sx: { width: 44, height: 44 } } }}
        sx={(t) => ({ boxShadow: `0 6px 16px ${t.palette.shadow}` })}
      >
        <AlertTitle sx={{ fontWeight: 700, mb: 0.25 }}>{alert.title}</AlertTitle>
        {alert.msg}
      </Alert>
    </Box>
  );
}
