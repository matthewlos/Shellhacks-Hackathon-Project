import { useId, useRef } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

/*
 * A radio group drawn as text: the replacement for the segmented ToggleButtonGroup (chart window, "Decided by",
 * the log views). role="radiogroup"; each option is role="radio" with aria-checked. One tab stop (roving
 * tabindex); Left/Right (and Up/Down, Home/End) move the choice, as a native radio group does.
 * Selected: ink, weight 600, a 2 px ink underline 4 px below the text. Others: ink2, weight 400, hover ink.
 * The bold width is reserved on every option, so choosing never shifts its neighbours.
 */
export default function TextChoice({ label, hideLabel = false, value, onChange, options, sx }) {
  const id = useId();
  const refs = useRef([]);
  const at = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (i) => {
    const n = options.length, j = (i + n) % n;
    refs.current[j]?.focus();
    if (options[j].value !== value) onChange?.(options[j].value);
  };
  const onKeyDown = (e) => {
    const k = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: options.length - 1 }[e.key];
    if (k == null) return;
    e.preventDefault();
    move(k);
  };

  return (
    <Box sx={[{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {label && !hideLabel && <Box id={id} component="span" sx={{ typography: 'subtitle2', color: 'text.secondary' }}>{label}</Box>}
      <Box
        role="radiogroup"
        aria-labelledby={label && !hideLabel ? id : undefined}
        aria-label={label && hideLabel ? label : undefined}
        onKeyDown={onKeyDown}
        sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2 }}
      >
        {options.map((o, i) => {
          const on = i === at;
          return (
            <ButtonBase
              key={String(o.value)}
              ref={(el) => { refs.current[i] = el; }}
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => { if (!on) onChange?.(o.value); }}
              sx={(t) => ({
                height: 32, px: 0, borderRadius: t.radius.tag, typography: 'body2',
                fontWeight: on ? 600 : 400, color: on ? 'text.primary' : 'text.secondary',
                transition: `color ${t.dur.press}ms ${t.ease}`,
                '&:hover': { color: 'text.primary' },
                '&.Mui-focusVisible': { outline: `2px solid ${t.palette.ink.main}`, outlineOffset: 2 },
                '@media (pointer: coarse)': { height: 44 },
              })}
            >
              <Box component="span" data-text={o.label} sx={(t) => ({
                position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap',
                // Hold the bold width so the row never reflows when the choice moves.
                '&::after': { content: 'attr(data-text)', height: 0, overflow: 'hidden', visibility: 'hidden', fontWeight: 600, userSelect: 'none', pointerEvents: 'none' },
                '&::before': on ? { content: '""', position: 'absolute', left: 0, right: 0, bottom: -4, height: 2, bgcolor: t.palette.ink.main } : undefined,
              })}>
                {o.label}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
