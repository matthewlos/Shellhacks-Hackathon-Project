import Box from '@mui/material/Box';
import InfoOutlined from '@mui/icons-material/InfoOutlined';

/*
 * One inline line of feedback (a refusal, a receipt, an answer). Replaces the MUI warning Alert.
 * `reserve` lines of height (20 px each) are always held, even when empty, so a message never shifts the layout.
 * The live region is always mounted so screen readers hear each new message. No timeout (WCAG 2.2.1): the owner
 * clears it on the next action.
 */
export default function Notice({ children, reserve = 1, sx }) {
  const has = children != null && children !== false && children !== '';
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={[{ minHeight: reserve * 20, display: 'flex', alignItems: 'flex-start', gap: 1, typography: 'body2', color: 'text.primary' }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {has && (
        <>
          <InfoOutlined aria-hidden="true" sx={{ fontSize: 16, color: 'text.secondary', flex: 'none', mt: '2px' }} />
          <Box component="span" sx={{ minWidth: 0 }}>{children}</Box>
        </>
      )}
    </Box>
  );
}
