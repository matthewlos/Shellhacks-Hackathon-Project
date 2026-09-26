import { createTheme, alpha } from '@mui/material/styles';

/*
 * Farm Hand theme. Every color, font and size the components use comes from here.
 * One meaning per color (see DESIGN.md): blue = AI + moisture, orange = timer (lines only; timer.text for words),
 * purple = temperature, green = healthy band, red = danger / refused / blocked.
 * Contrast numbers are against white unless noted (WCAG 2.2 SC 1.4.3 text 4.5:1, SC 1.4.11 UI/graphics 3:1).
 */
const INK = '#141820';          // 17.6:1
const MUTED = '#5b6472';        // 5.9:1 on white, 5.28:1 on the stage
const AI = '#1f5fbf';           // 6.2:1
const LINE = '#e2e6eb';

const DISPLAY = "'Bricolage Grotesque Variable', 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
const BODY = "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
const CODE = "'Atkinson Hyperlegible Mono Variable', ui-monospace, monospace";
const tnum = { fontVariantNumeric: 'tabular-nums' };
const px = (n) => `${n / 16}rem`;

// One radius scale (taste-skill 4.4 "shape consistency lock"): 6px controls, 12px panels, 999px chips only.
export const RADIUS = { control: 6, panel: 12, chip: 999 };
// Motion (emil-design-eng): strong ease-out, never ease-in, UI under 300 ms.
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const DUR = { press: 120, tip: 150, panel: 250, number: 250 };
// Tier 1 readouts (PLAN 5d): ~96px on a 1920 projector, readable from 3 m; 72px at 1440; 56px on a phone.
const TIER1 = 'clamp(3.5rem, 5vw, 6rem)';

export const theme = createTheme({
  spacing: 8,
  shape: { borderRadius: RADIUS.control },
  palette: {
    mode: 'light',
    primary: { main: AI, light: '#e8f0fc', contrastText: '#fff' },
    ink: { main: INK, light: '#2b313c', dark: '#000', contrastText: '#fff' },
    info: { main: AI, contrastText: '#fff' },                      // hand-pour banner: white on AI blue 6.1:1 (MUI default #0288d1 was 3.86:1)
    error: { main: '#c62b2b', light: '#fcebeb' },                 // 5.6:1
    success: { main: '#1f8a4c', text: '#1b7a43', light: '#bfe3cc' }, // main for fills; text 5.37:1
    warning: { main: '#b54708', light: '#fff4e5', contrastText: INK },
    background: { default: '#f4f6f8', paper: '#ffffff' },
    text: { primary: INK, secondary: MUTED },
    divider: LINE,
    moisture: { main: AI, light: '#e8f0fc', tip: '#8fb6f0' },
    timer: { main: '#d0571b', text: '#a84a12', light: '#fdeee6', tip: '#f2a67d' },
    temp: { main: '#7a3fc0', tip: '#c7a4f0' },
    track: '#e8ebef',
    shadow: 'rgba(20, 24, 32, 0.12)',   // tinted to the ink, with offset + blur (impeccable depth rule)
    dotIdle: '#d5dae1',
    dotRecent: '#8fb2e6',
    cursor: '#9aa3ad',
    rig: {
      stage: '#eef1f4', table: '#efe9e0', tableEdge: '#ddd3c5', soilDry: '#c9b498', soilWet: '#3a291e', wet: '#241810',
      water: '#4f95d8', cupWater: '#8fc1ea', tube: '#d5dee6', plastic: '#aebccb', wireRed: '#d33a2c', wireBlack: '#1f2328',
      // Only one red thing on screen (von Restorff): the clamp, relay LED and dry LED are not red.
      clamp: '#3a4150', clampDark: '#262b35', relayOn: '#f0a030', relayOff: '#3a2a22', ledOk: '#2fbf6a', ledPump: '#2f7de1', ledDry: '#e0a13a',
      tipCool: '#3d7fc4', tipWarm: '#e07a2e', targetLine: INK, tag: '#ffffff',
      probe: '#b8c0c9', probeEdge: '#8c96a1', label: '#4b5563', labelDim: MUTED,
      relayEdge: '#174a95', espBoard: '#1a1c20', probeHead: '#1d1f24', relayTerminal: '#1e8a4a', relayBoard: '#1f5fbf', probeBlade: '#23262c', relayCoil: '#2a74e0', pump: '#2b2f36', usb: '#2c3036', espLed: '#2f6fd6', probeChip: '#34373e', wireGrey: '#4a4f57', jumperGrey: '#8a8f98', espPort: '#9aa3ad', pins: '#c7a64a', espShield: '#c9cdd2', screw: '#c9d1d9', rim: '#e8eef3', jumperWhite: '#f1f1f1',
    },
    serial: { bg: '#10141a', fg: '#b9c6d3' },  // 10.9:1
  },
  typography: {
    fontFamily: BODY,
    // M3 type scale (m3.material.io/styles/typography/type-scale-tokens); 12px is the floor.
    h1: { fontFamily: DISPLAY, fontWeight: 700, fontSize: px(24), lineHeight: 32 / 24, letterSpacing: '-0.01em' },
    h2: { fontFamily: DISPLAY, fontWeight: 700, fontSize: px(32), lineHeight: 40 / 32, letterSpacing: '-0.01em' },
    h3: { fontFamily: DISPLAY, fontWeight: 600, fontSize: px(20), lineHeight: 28 / 20 },
    h4: undefined, h5: undefined, h6: undefined,
    subtitle1: { fontWeight: 600, fontSize: px(16), lineHeight: 24 / 16 },
    subtitle2: { fontWeight: 600, fontSize: px(14), lineHeight: 20 / 14 },
    body1: { fontSize: px(16), lineHeight: 24 / 16 },
    body2: { fontSize: px(14), lineHeight: 20 / 14 },
    caption: { fontSize: px(12), lineHeight: 16 / 12 },
    button: { fontWeight: 600, fontSize: px(14), lineHeight: 20 / 14, textTransform: 'none' },
    overline: { fontWeight: 600, fontSize: px(12), lineHeight: 16 / 12, textTransform: 'none', letterSpacing: 0 },
    tier1: { fontFamily: DISPLAY, fontWeight: 700, fontSize: TIER1, lineHeight: 1, letterSpacing: '-0.02em', ...tnum },
    readout: { fontFamily: DISPLAY, fontWeight: 700, fontSize: px(32), lineHeight: 40 / 32, ...tnum },
    readoutXL: { fontFamily: DISPLAY, fontWeight: 700, fontSize: px(40), lineHeight: 48 / 40, ...tnum },
    unit: { fontFamily: BODY, fontWeight: 400, fontSize: px(20), lineHeight: 28 / 20, color: MUTED },
    data: { fontFamily: BODY, fontWeight: 600, fontSize: px(14), lineHeight: 20 / 14, ...tnum },
    code: { fontFamily: CODE, fontWeight: 500, fontSize: px(12), lineHeight: 18 / 12 },
  },
  fonts: { body: BODY, code: CODE },
  radius: RADIUS,
  ease: EASE_OUT,
  dur: DUR,
});

const coarse = '@media (pointer: coarse)';
const focus = { outline: `2px solid ${AI}`, outlineOffset: 2 };

const pressable = {
  transition: `transform ${DUR.press}ms ${EASE_OUT}, background-color ${DUR.press}ms ${EASE_OUT}, border-color ${DUR.press}ms ${EASE_OUT}, color ${DUR.press}ms ${EASE_OUT}`,
  '&:active:not(.Mui-disabled)': { transform: 'scale(0.97)' },
  '@media (prefers-reduced-motion: reduce)': { '&:active:not(.Mui-disabled)': { transform: 'none' } },
};

theme.components = {
  MuiCssBaseline: {
    styleOverrides: {
      body: { ...tnum },
      // Browser surfaces (impeccable craft floor): selection, caret, scrollbars from the palette.
      '::selection': { backgroundColor: '#cfe0f7', color: INK },
      '*': { scrollbarColor: '#b7bfca transparent', scrollbarWidth: 'thin', caretColor: AI },
    },
  },
  MuiTypography: {
    defaultProps: {
      variantMapping: { tier1: 'p', readout: 'p', readoutXL: 'p', unit: 'span', data: 'span', code: 'span', h3: 'h3' },
    },
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: { root: { borderRadius: RADIUS.panel }, outlined: { borderColor: LINE } },
  },
  // Press feedback is a 0.97 scale (emil-design-eng), not the ripple.
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: { minHeight: 40, whiteSpace: 'nowrap', ...pressable, '&.Mui-focusVisible': focus, [coarse]: { minHeight: 44 } },
      sizeLarge: { minHeight: 48, fontSize: px(16) },
    },
  },
  MuiIconButton: {
    styleOverrides: { root: { width: 40, height: 40, borderRadius: RADIUS.control, ...pressable, '&.Mui-focusVisible': focus, [coarse]: { width: 44, height: 44 } } },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: {
        textTransform: 'none', fontWeight: 600, fontSize: px(13), lineHeight: '16px', color: MUTED, padding: '0 12px', whiteSpace: 'nowrap', ...pressable,
        '&:hover': { backgroundColor: alpha(INK, 0.06) },
        // Selected = solid ink (17.6:1), not blue: blue means AI, and these also pick speed and chart window.
        '&.Mui-selected': { color: '#fff', backgroundColor: INK },
        '&.Mui-selected:hover': { backgroundColor: alpha(INK, 0.85) },
        '&.Mui-focusVisible': { ...focus, zIndex: 1 },
      },
      sizeSmall: { height: 32, [coarse]: { height: 44 } },
    },
  },
  MuiTab: {
    styleOverrides: { root: { textTransform: 'none', fontWeight: 600, fontSize: px(14), minHeight: 48, '&.Mui-focusVisible': focus } },
  },
  MuiChip: { styleOverrides: { root: { borderRadius: RADIUS.chip }, label: { fontWeight: 600 } } },
  MuiTableCell: {
    styleOverrides: {
      root: { fontSize: px(13), ...tnum, borderColor: LINE },
      sizeSmall: { height: 36, padding: '4px 8px' },
      head: { fontSize: px(12), lineHeight: '16px', fontWeight: 600, color: MUTED },
    },
  },
  MuiAlert: { styleOverrides: { root: { boxShadow: 'none', fontSize: px(14), borderRadius: RADIUS.panel } } },
};
