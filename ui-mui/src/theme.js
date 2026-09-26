import { createTheme, alpha } from '@mui/material/styles';

/*
 * Farm Hand theme (round 6). Every color, font and size the components use comes from here: no hex in any
 * component file. SVG and canvas read theme.palette.*.
 *
 * The page is quiet ink on paper (ISA-101 "grey by default"). Color appears only for:
 *   water / Farm Hand data  moisture.main (creek blue)
 *   timer data              timer.*
 *   one fault / Stop pump   error.*
 *   "healthy" only          success.* (and the Phase 2 sage band)
 * Everything interactive is ink (primary = ink): links, sliders, focus rings, selected choices, Go.
 * Temperature (madder) lives only inside the drawing.
 */

// Phase 2 (the nature layer) is one flip. Phase-2-only details check theme.phase >= 2.
export const PHASE = 1;
const P2 = PHASE >= 2;

// Neutrals (nature.md 2a). Ink is "spruce black"; rules are soil-tinted and opaque, so crossings never darken.
export const INK = '#1B211D';      // 16.4:1 on white, 15.4 on paper
export const INK_2 = '#525A54';    // 7.0:1 on white, 6.7 on paper, 5.6 on track
const RULE = '#E1DED6';            // decorative hairline (not a control boundary)
const RULE_UI = '#85857A';         // borders that identify a control: 3.7:1 on white, 3.5 on paper
const TRACK = '#E4E4DC';
const PAPER = P2 ? '#F8F8F4' : '#FFFFFF';
const WATER = '#1D5F8A';           // creek blue: water + Farm Hand DATA only. 6.9:1 on white
const SAGE = '#B9CEB0';
const ERROR = '#B3261E';           // 6.5:1 on white

// One family (Public Sans, the USWDS face: plain zero, tabular figures) for display, body, numerals and canvas.
// Atkinson Hyperlegible Mono is for code only (brain.py, agent ids, Serial).
const SANS = "'Public Sans Variable', system-ui, sans-serif";
const CODE = "'Atkinson Hyperlegible Mono Variable', ui-monospace, monospace";
const tnum = { fontVariantNumeric: 'tabular-nums' };
const px = (n) => `${n / 16}rem`;

export const GRID = {
  max: 1520,
  gutter: { xs: 2, sm: 3, md: 4 },   // spacing units: 16 / 24 / 32 px
  gap: { xs: 2, sm: 3, md: 4 },
  cols: { xs: 4, sm: 8, md: 12 },
};
export const SPACE = { section: { xs: 4, md: 6 }, block: 3, stack: 2, tight: 1 };   // x 8 px
export const RADIUS = { none: '0', tag: '2px', control: '4px' };                      // strings: sx multiplies numbers
// Motion (emil-design-eng): strong ease-out, never ease-in, UI under 300 ms.
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const DUR = { press: 120, tip: 150, panel: 250, number: 250, pulse: 600 };
// Tier 1 (the two live readings only): 48px phone, ~82px at 1440, 96px at 1920 and up.
const TIER1 = 'clamp(3rem, 1.6rem + 3.9vw, 6rem)';
const BELOW_SM = '@media (max-width:599.95px)';

export const theme = createTheme({
  phase: PHASE,
  spacing: 8,
  shape: { borderRadius: 4 },
  // One easing family for MUI internals too: no M3 legacy cubic-bezier(0.4,0,0.2,1).
  transitions: {
    easing: { easeInOut: EASE_OUT, easeOut: EASE_OUT, easeIn: EASE_OUT, sharp: EASE_OUT },
    duration: { shortest: 120, shorter: 150, short: 200, standard: 250, complex: 250, enteringScreen: 250, leavingScreen: 150 },
  },
  palette: {
    mode: 'light',
    primary: { main: INK, light: '#2B332E', dark: '#000000', contrastText: '#FFFFFF' },   // interactive = ink
    ink: { main: INK, light: '#2B332E', dark: '#000000', contrastText: '#FFFFFF' },
    info: { main: INK, contrastText: '#FFFFFF' },
    error: { main: ERROR, light: '#F7E7E4', contrastText: '#FFFFFF' },
    success: { main: '#3A6934', text: '#3A6934', band: SAGE, contrastText: '#FFFFFF' },   // "healthy" only
    // no custom `warning`: nothing may use it (it was a hidden fourth orange)
    background: { default: PAPER, paper: PAPER },
    text: { primary: INK, secondary: INK_2, disabled: alpha(INK, 0.38) },
    divider: RULE,
    ruleUI: RULE_UI,
    track: TRACK,
    wash: alpha(INK, 0.04),                  // stepper field, table highlight row, hover
    moisture: { main: WATER, light: '#E3ECF2', tip: '#8DB3CF' },
    timer: { main: '#B5650C', text: '#8C4A0C', light: '#F6ECDC', tip: '#DCAE74' },   // lines 4.3:1 / words 6.8:1
    temp: { main: '#86305A', tip: '#D3A3BB' },                                     // drawing only
    range: { low: alpha(INK, 0.22), good: P2 ? SAGE : alpha(INK, 0.07), high: alpha(INK, 0.14), edge: INK_2 },
    chartBand: P2 ? alpha(SAGE, 0.35) : alpha(INK, 0.04),
    shadow: 'rgba(27, 33, 29, 0.12)',
    dotRecent: RULE_UI,
    cursor: '#9A9A8F',
    selection: '#D6E3EC',
    scroll: '#B9B8AE',
    serial: { bg: INK, fg: '#C9CFC6' },      // 10.3:1
    rig: {
      halo: PAPER, stage: PAPER,             // `stage` only until the redrawn Rig drops its background rect
      table: '#DCD8CE', tableEdge: '#C9C3B6', plastic: '#A9B2B0', rim: '#C3CAC7', tube: '#D3DAD8',
      water: '#3F7FAE', cupWater: '#A8C7DC',
      soilDry: P2 ? '#8A7660' : '#B39D80', soilWet: P2 ? '#4A3D30' : '#3A291E', wet: P2 ? '#2F271F' : '#241810',
      humus: '#3B3024', perlite: '#E6E3DA',
      ledOk: '#6DAA5E', ledPump: '#3F7FAE',
      label: INK_2, labelDim: INK_2, leader: alpha(INK_2, 0.6), outline: INK_2, targetLine: INK, tag: '#FFFFFF',
      // Hardware colors, unchanged from round 5. Only one red thing on screen: the clamp, relay LED and dry LED are not red.
      wireRed: '#d33a2c', wireBlack: '#1f2328',
      clamp: '#3a4150', clampDark: '#262b35', relayOn: '#f0a030', relayOff: '#3a2a22', ledDry: '#e0a13a',
      probe: '#b8c0c9', probeEdge: '#8c96a1',
      relayEdge: '#23384f', espBoard: '#1a1c20', probeHead: '#1d1f24', relayTerminal: '#1e8a4a', relayBoard: '#34506e', probeBlade: '#23262c', relayCoil: '#46688c', pump: '#2b2f36', usb: '#2c3036', espLed: '#2f6fd6', probeChip: '#34373e', wireGrey: '#4a4f57', jumperGrey: '#8a8f98', espPort: '#9aa3ad', pins: '#c7a64a', espShield: '#c9cdd2', screw: '#c9d1d9', jumperWhite: '#f1f1f1',
    },
  },
  typography: {
    fontFamily: SANS,
    // Six sizes: 12 / 14 / 16 / 24 / 32 / tier1. 12px is the floor. Weight: 400 text, 500 data, 600 labels/buttons, 700 display.
    h1: { fontWeight: 700, fontSize: px(24), lineHeight: 32 / 24, letterSpacing: '-0.01em' },   // app name
    h2: { fontWeight: 700, fontSize: px(24), lineHeight: 32 / 24, letterSpacing: '-0.01em' },   // page titles
    h3: { fontWeight: 600, fontSize: px(16), lineHeight: 24 / 16 },                              // section titles
    h4: undefined, h5: undefined, h6: undefined,
    // The page sentence (Vs timer, Outside): 32/40, 24/32 on phones.
    headline: { fontWeight: 700, fontSize: px(32), lineHeight: 40 / 32, letterSpacing: '-0.01em', ...tnum, [BELOW_SM]: { fontSize: px(24), lineHeight: 32 / 24 } },
    subtitle1: { fontWeight: 600, fontSize: px(16), lineHeight: 24 / 16 },
    subtitle2: { fontWeight: 600, fontSize: px(14), lineHeight: 20 / 14 },                      // form and group labels
    body1: { fontSize: px(16), lineHeight: 24 / 16 },
    body2: { fontSize: px(14), lineHeight: 20 / 14 },
    caption: { fontSize: px(12), lineHeight: 16 / 12 },
    overline: { fontWeight: 600, fontSize: px(12), lineHeight: 16 / 12, textTransform: 'none', letterSpacing: 0 },
    button: { fontWeight: 600, fontSize: px(14), lineHeight: 20 / 14, textTransform: 'none' },
    tier1: { fontWeight: 700, fontSize: TIER1, lineHeight: 1, letterSpacing: '-0.02em', ...tnum },
    status: { fontWeight: 600, fontSize: px(24), lineHeight: 32 / 24, ...tnum },                 // state word, stepper, slider value
    // Units ride inside big numbers at half their size, at weight 400.
    unit: { fontWeight: 400, fontSize: '0.5em', color: INK_2 },
    data: { fontWeight: 500, fontSize: px(14), lineHeight: 20 / 14, ...tnum },
    code: { fontFamily: CODE, fontWeight: 500, fontSize: px(12), lineHeight: 18 / 12 },
  },
  fonts: { body: SANS, code: CODE },
  radius: RADIUS,
  ease: EASE_OUT,
  dur: DUR,
  grid: GRID,
});

const coarse = '@media (pointer: coarse)';
const focus = { outline: `2px solid ${INK}`, outlineOffset: 2 };
const colorEase = (...props) => props.map((p) => `${p} ${DUR.press}ms ${EASE_OUT}`).join(', ');
// Motion scales with how often a control is used: only contained and outlined buttons press (scale 0.97).
const press = {
  transition: colorEase('transform', 'background-color', 'border-color', 'color'),
  '&:active:not(.Mui-disabled)': { transform: 'scale(0.97)' },
  '@media (prefers-reduced-motion: reduce)': { '&:active:not(.Mui-disabled)': { transform: 'none' } },
};

theme.components = {
  MuiCssBaseline: {
    styleOverrides: {
      'html, body': { backgroundColor: PAPER },
      body: { ...tnum },
      // Browser surfaces from the palette: selection, caret, scrollbars.
      '::selection': { backgroundColor: '#D6E3EC', color: INK },
      '*': { scrollbarColor: '#B9B8AE transparent', scrollbarWidth: 'thin', caretColor: INK },
    },
  },
  MuiTypography: {
    defaultProps: {
      // MUI maps subtitle1/2 to <h6>, which skipped heading levels.
      variantMapping: { tier1: 'p', status: 'p', headline: 'p', unit: 'span', data: 'span', code: 'span', h3: 'h3', subtitle1: 'p', subtitle2: 'p' },
    },
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: { root: { borderRadius: RADIUS.control }, outlined: { borderColor: RULE } },
  },
  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'inherit' },
    styleOverrides: { root: { backgroundColor: PAPER, color: INK, boxShadow: 'none', borderRadius: 0 } },
  },
  MuiDivider: { styleOverrides: { root: { borderColor: RULE } } },
  // Press feedback is color (or a 0.97 scale on contained/outlined), never the ripple.
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        minHeight: 40, whiteSpace: 'nowrap', borderRadius: RADIUS.control,
        transition: colorEase('background-color', 'border-color', 'color'),
        '&.Mui-focusVisible': focus, [coarse]: { minHeight: 44 },
        variants: [
          { props: { variant: 'contained' }, style: press },
          { props: { variant: 'outlined' }, style: { ...press, borderColor: RULE_UI, '&:hover': { borderColor: INK, backgroundColor: alpha(INK, 0.04) } } },
          { props: { variant: 'outlined', color: 'error' }, style: { borderColor: ERROR, '&:hover': { borderColor: ERROR, backgroundColor: alpha(ERROR, 0.06) } } },
          { props: { variant: 'text' }, style: { textDecoration: 'none', '&:hover': { backgroundColor: alpha(INK, 0.04) } } },
        ],
      },
      sizeSmall: { fontSize: px(14) },
      sizeLarge: { minHeight: 48, fontSize: px(16) },
      text: { paddingLeft: 8, paddingRight: 8 },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        width: 40, height: 40, borderRadius: RADIUS.control,
        transition: colorEase('background-color', 'color'),
        variants: [{ props: { color: 'default' }, style: { color: INK } }],
        '&:hover': { backgroundColor: alpha(INK, 0.06) },
        '&.Mui-focusVisible': focus, [coarse]: { width: 44, height: 44 },
      },
    },
  },
  // One lever still uses it (Pinch tube). The ToggleButtonGroup is gone everywhere.
  MuiToggleButton: {
    styleOverrides: {
      root: {
        textTransform: 'none', fontWeight: 600, fontSize: px(14), lineHeight: '20px', color: INK, padding: '0 12px', whiteSpace: 'nowrap',
        borderRadius: RADIUS.control, border: `1px solid ${RULE_UI}`,
        transition: colorEase('background-color', 'border-color', 'color'),
        '&:hover': { backgroundColor: alpha(INK, 0.06), borderColor: INK },
        '&.Mui-selected': { color: '#FFFFFF', backgroundColor: INK, borderColor: INK },
        '&.Mui-selected:hover': { backgroundColor: alpha(INK, 0.85) },
        '&.Mui-focusVisible': { ...focus, zIndex: 1 },
      },
      sizeSmall: { height: 32, [coarse]: { height: 44 } },
    },
  },
  // "Keep soil above": an ink needle on a ruler. No blue, no halo, no layout transitions (B20).
  MuiSlider: {
    defaultProps: { track: 'inverted', valueLabelDisplay: 'off' },
    styleOverrides: {
      root: {
        color: INK, height: 2, borderRadius: 0,
        '& .MuiSlider-rail, & .MuiSlider-track, & .MuiSlider-thumb, & .MuiSlider-mark': { transition: 'none' },
        '@media (pointer: coarse)': { padding: '20px 0' },
      },
      // Normal track: the kept range is left of the thumb. Inverted (the default here): right of it.
      rail: { height: 2, opacity: 1, borderRadius: 0, backgroundColor: RULE_UI },
      track: { height: 2, border: 0, borderRadius: 0, backgroundColor: INK },
      trackInverted: {
        '& .MuiSlider-rail': { backgroundColor: INK },
        '& .MuiSlider-track': { backgroundColor: RULE_UI, borderColor: RULE_UI },
      },
      thumb: {
        width: 4, height: 20, borderRadius: 1, backgroundColor: INK, boxShadow: 'none',
        '&::before': { boxShadow: 'none' },
        '&::after': { width: 32, height: 32, borderRadius: 0, [coarse]: { width: 44, height: 44 } },
        '&:hover, &.Mui-active, &.Mui-focusVisible': { boxShadow: 'none' },
        '&.Mui-focusVisible': focus,
      },
      mark: { width: 1, height: 6, borderRadius: 0, backgroundColor: INK_2, opacity: 1 },
      markActive: { backgroundColor: INK_2, opacity: 1 },
      markLabel: { fontSize: px(12), lineHeight: 16 / 12, color: INK_2 },
      markLabelActive: { color: INK_2 },
    },
  },
  // A square tag only (the honesty stamp). No pills.
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: RADIUS.tag, fontSize: px(12), color: INK_2, backgroundColor: 'transparent' },
      sizeSmall: { height: 24 },
      outlined: { borderColor: RULE_UI },
      label: { fontWeight: 600, lineHeight: '16px', paddingLeft: 8, paddingRight: 8 },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: { backgroundColor: INK, color: '#FFFFFF', fontSize: px(12), lineHeight: 16 / 12, fontWeight: 500, borderRadius: RADIUS.control, padding: '6px 8px' },
    },
  },
  // Lab table: head over a 1px ink rule, bare rows, one closing hairline. Units live in the header.
  MuiTable: { styleOverrides: { root: { '& tbody tr:last-of-type td': { borderBottom: `1px solid ${RULE}` } } } },
  MuiTableCell: {
    styleOverrides: {
      root: { fontSize: px(14), ...tnum, borderColor: RULE },
      body: { borderBottom: 0, paddingTop: 6, paddingBottom: 6 },
      sizeSmall: { padding: '6px 8px' },
      head: { fontSize: px(12), lineHeight: '16px', fontWeight: 600, color: INK_2, borderBottom: `1px solid ${INK}` },
    },
  },
  // The overlay only (refusals are the Notice primitive). Error = filled red; info = paper box, ink border.
  MuiAlert: {
    styleOverrides: {
      root: { boxShadow: 'none', fontSize: px(14), borderRadius: RADIUS.control, '& .MuiAlert-action .MuiIconButton-root': { width: 44, height: 44, color: 'inherit' } },
      filledError: { backgroundColor: ERROR, color: '#FFFFFF', '& .MuiIconButton-root.Mui-focusVisible': { outlineColor: '#FFFFFF' } },
      filledInfo: { backgroundColor: PAPER, color: INK, border: `1px solid ${INK}`, '& .MuiAlert-icon': { color: INK } },
    },
  },
  MuiDrawer: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      paper: { backgroundColor: PAPER, backgroundImage: 'none', borderRadius: 0 },
      paperAnchorRight: { borderLeft: `1px solid ${RULE}` },
      paperAnchorLeft: { borderRight: `1px solid ${RULE}` },
      paperAnchorBottom: { borderTop: `1px solid ${RULE}` },
    },
  },
  MuiBackdrop: { styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: alpha(INK, 0.2) } } } },
  MuiMenu: {
    styleOverrides: { paper: { border: `1px solid ${RULE}`, boxShadow: `0 6px 16px rgba(27, 33, 29, 0.12)` } },
  },
  MuiMenuItem: { styleOverrides: { root: { fontSize: px(14), minHeight: 40, '&.Mui-focusVisible': { ...focus, outlineOffset: -2 }, [coarse]: { minHeight: 44 } } } },
  // Flat accordion: one top hairline, no card.
  MuiAccordion: {
    // Opens without a height animation (no layout transitions anywhere).
    defaultProps: { elevation: 0, square: true, disableGutters: true, slotProps: { transition: { timeout: 0 } } },
    styleOverrides: { root: { backgroundColor: 'transparent', borderTop: `1px solid ${RULE}`, transition: 'none', '&::before': { display: 'none' } } },
  },
  MuiAccordionSummary: {
    styleOverrides: {
      root: { minHeight: 48, padding: 0, transition: colorEase('color'), '&.Mui-focusVisible': { ...focus, backgroundColor: 'transparent' } },
      content: { margin: 0, transition: 'none' },
      expandIconWrapper: { color: INK_2 },
    },
  },
  MuiCollapse: { styleOverrides: { root: { transition: 'none' } } },
  MuiAccordionDetails: { styleOverrides: { root: { padding: '0 0 24px' } } },
  MuiLink: {
    defaultProps: { underline: 'always' },
    styleOverrides: {
      root: {
        color: INK, textDecorationColor: RULE_UI, textUnderlineOffset: '0.2em',
        transition: colorEase('text-decoration-color'),
        '&:hover': { textDecorationColor: INK },
        '&.Mui-focusVisible, &:focus-visible': { ...focus, borderRadius: 1 },
      },
    },
  },
};

// Plain values for non-React modules (canvas, WebGL): the same tokens as theme.palette, no MUI needed to read them.
export const tokens = {
  phase: PHASE,
  ink: INK, ink2: INK_2, paper: PAPER, rule: RULE, ruleUI: RULE_UI, track: TRACK, water: WATER, sage: SAGE, error: ERROR,
  moisture: theme.palette.moisture, timer: theme.palette.timer, temp: theme.palette.temp,
  rig: theme.palette.rig,          // soilDry, soilWet, wet, humus, perlite, water, cupWater, plastic, rim, tube, table, ...
  fonts: { body: SANS, code: CODE },
};
