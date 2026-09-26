/**
 * BRAND: the one place to change name, logo, colors and product copy.
 *
 * CSS reads the tokens below as custom properties and the
 * 3D scene reads `brand.colors` and `brand.scene`: keep every existing key when you edit.
 */
export const brand = {
  name: 'Farm Hand',
  tagline: "Watches your crop so you don't have to. Saves time, money, water, and the crop.",
  pitch: 'When a crop dies, you lose the time it took to grow it. Farm Hand waters from the soil, not the clock.',
  credit: '',   // third-party notice lives in LICENSE-PromptGrassGrowGrass (MIT); nothing shown on the site
  /** "What it saves". Sources: PLAN 5e (season replay, laya/data/eval.md) and PLAN 7 (parts order, CropX retail 2026-09-26). */
  savings: {
    partsUsd: '$72.94',
    sensorUsd: '$1,200-1,512',
    sensorYearly: '$309',
    waterLessPct: 56,
    stressHoursFarmHand: 0,
    stressHoursTimer: 12,
  },

  /** Inline SVG path for the mark (24x24 viewBox). A drop that is also a seed. */
  logoPath:
    'M12 2.5c3.4 4.2 6 7.300 6 10.700a6 6 0 1 1-12 0c0-3.400 2.600-6.500 6-10.700zm0 6.200c-1.500 2.100-2.500 3.600-2.500 5a2.500 2.500 0 0 0 2.500 2.500',

  /** The two storage-tote boxes. Box A is the AI, box B is the control. */
  boxes: {
    A: { name: 'Farm Hand', how: 'Watered by the decision model', color: 'var(--water)' },
    B: { name: 'Timer', how: 'Watered on a fixed schedule', color: 'var(--warm)' },
  },
  /** The baseline rule Laya falls back to, and the line drawn on the meters and the chart. */
  baselinePct: 45,
  /**
   * The pumps are disarmed in firmware until the box wiring mapping is confirmed.
   * Flip to true when they are armed (a store field `pumpsArmed`, if the data layer adds one, wins).
   */
  pumpsArmed: false,
  disarmedReason: 'disarmed until wiring is confirmed',

  /**
   * UI tokens -> CSS custom properties (see applyBrand).
   * Light theme on purpose: the demo runs on a projector in a bright hall (PLAN 5d).
   * Blue is Farm Hand (box A, Laya), orange is the Timer (box B). Red is kept for one alert at a time.
   */
  colors: {
    bg: '#e9ede7',
    bgGlow: '#f4f6f2',
    panel: '#fafbf8',
    panelSolid: '#fafbf8',
    sunk: '#f0f3ee',
    transcript: '#f0f3ee',
    line: 'rgba(22, 32, 26, 0.13)',
    lineStrong: 'rgba(22, 32, 26, 0.24)',
    text: '#16201a',
    textDim: '#44504a',
    textFaint: '#5e6a63',
    accent: '#1b66c9',
    accentInk: '#fafbf8',
    water: '#1b66c9',
    waterSoft: 'rgba(27, 102, 201, 0.12)',
    warm: '#b3540c',
    warmSoft: 'rgba(179, 84, 12, 0.12)',
    cool: '#1b66c9',
    agent: '#1b66c9',
    good: '#2b7a45',
    caution: '#8a5a00',
    cautionSoft: 'rgba(176, 116, 0, 0.12)',
    danger: '#b9362a',
    dangerSoft: 'rgba(185, 54, 42, 0.1)',
  },

  fonts: {
    display: "'Archivo Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
    ui: "'Archivo Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace",
  },

  /** Colors used inside the 3D scene (linear-ish sRGB hex). */
  scene: {
    probeBoard: '#151918',
    probeInk: '#eeeade',
    probeSteel: '#c4d2d8',
    probeCable: '#171b1a',
    probeRed: '#b94638',
    probeYellow: '#d1ab48',
    soilUnknown: '#655e50',
    soilDry: '#8d7d68',
    soilWet: '#2b2117',
    soilSub: '#6b5138',
    soilDeep: '#3a2a1e',
    sproutAlive: '#9be05a',
    sproutDead: '#7a6a48',
    water: '#3aa8ff',
    warm: '#ff9a3c',
    cool: '#4f8dff',
    agent: '#a596ff',
    blueprint: '#0d2a26',
    blueprintLine: '#5fffd0',
  },
} as const;

export function applyBrand(): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(brand.colors)) {
    root.style.setProperty(`--${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`, v);
  }
  root.style.setProperty('--font-display', brand.fonts.display);
  root.style.setProperty('--font-ui', brand.fonts.ui);
  root.style.setProperty('--font-mono', brand.fonts.mono);
  document.title = brand.name;
}
