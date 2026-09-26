/**
 * Crop icons for the map's field card: one per crop group, drawn on a 48x48 grid with a single
 * 2 px round stroke so they read as one set. Colour comes from the crop's map colour (currentColor).
 */
const S = ({ children }: { children: React.ReactNode }) => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const Avocado = () => (
  <S>
    <path d="M24 5c-5 0-7 6-9 12-2 5-6 9-6 15a15 15 0 0 0 30 0c0-6-4-10-6-15-2-6-4-12-9-12z" />
    <circle cx="24" cy="31" r="6" />
    <path d="M24 5c1-2 3-3 5-3" />
  </S>
);
const Vegetables = () => (
  <S>
    <path d="M24 42c-9 0-15-6-15-14 0-5 3-8 6-9-1-4 2-8 6-8 1-3 5-5 9-3 4-1 8 2 8 6 3 1 5 4 4 8 3 2 3 6 1 9-3 7-10 11-19 11z" />
    <path d="M24 42V20" />
    <path d="M24 30l-7-6M24 26l6-5M24 35l6-4" />
  </S>
);
const TreeFruit = () => (
  <S>
    <path d="M26 14c-9-1-17 6-17 16 0 8 6 13 14 13 10 0 16-8 16-17 0-7-5-12-13-12z" />
    <path d="M26 14c0-4 1-7 3-9" />
    <path d="M29 9c4-3 9-3 12-1-3 4-8 5-12 1z" />
  </S>
);
const Citrus = () => (
  <S>
    <circle cx="24" cy="26" r="15" />
    <path d="M24 11c0-3 2-5 5-6" />
    <path d="M24 11c-4-3-9-3-11 0 3 3 8 3 11 0z" />
    <path d="M24 26l0-9M24 26l8 5M24 26l-8 5" />
  </S>
);
const Sugarcane = () => (
  <S>
    <path d="M18 44V8M30 44V14" />
    <path d="M15 18h6M15 30h6M27 24h6M27 36h6" />
    <path d="M18 8c4-4 9-4 12-2M30 14c3-4 8-5 11-3M18 12C14 8 9 8 6 10" />
  </S>
);
const Grass = () => (
  <S>
    <path d="M6 42h36" />
    <path d="M10 42c0-8 2-15 6-20M17 42c0-10-1-18-3-24M24 42c0-11 1-20 4-27M31 42c0-8-1-15-4-21M38 42c0-7 1-13 4-17" />
  </S>
);
const Field = () => (
  <S>
    <path d="M6 38l12-24h12l12 24z" />
    <path d="M24 14v24M15 26h18" />
  </S>
);

export function CropIcon({ crop }: { crop: string }) {
  const c = crop.toLowerCase();
  if (c.includes('avocado')) return <Avocado />;
  if (c.includes('vegetable') || c.includes('row crop') || c.includes('tomato')) return <Vegetables />;
  if (c.includes('mango') || c.includes('lychee') || c.includes('tree fruit')) return <TreeFruit />;
  if (c.includes('citrus') || c.includes('orange')) return <Citrus />;
  if (c.includes('sugar')) return <Sugarcane />;
  if (c.includes('sod') || c.includes('grass') || c.includes('nursery')) return <Grass />;
  return <Field />;
}
