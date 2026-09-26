/**
 * The dock: one row of buttons floating over the 3D scene. Each opens one panel over the scene.
 * One panel at a time; Esc, the close button, or a click (not a drag) on the scene closes it.
 * The open panel lives in the URL hash (#box-a, #laya, #map...) so it can be linked.
 *
 * Motion (Emil): panels ride CSS transitions (interruptible), 220 ms ease-out in, 160 ms out,
 * from 12 px and transparent, never from scale(0). The shell stays mounted so a close can animate.
 */
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { brand } from '../brand';
import { BoxPanel, useBoxGlance } from './Boxes';
import { CropsPanel } from './Crops';
import { Forecast } from './Forecast';
import { History } from './History';
import { IconClose } from './icons';
import { LayaCall, useCallGlance } from './LayaCall';
import { MapPanel } from './Region';
import { ResultsPanel } from './Results';
import { SavingsPanel, useSavings } from './Savings';

export type PanelId = 'box-a' | 'box-b' | 'laya' | 'saves' | 'results' | 'history' | 'forecast' | 'crops' | 'map';
type Place = 'side' | 'bottom' | 'wide';

const PANELS: Record<PanelId, { title: string; place: Place; body: () => ReactNode }> = {
  'box-a': { title: `Box A, ${brand.boxes.A.name}`, place: 'side', body: () => <BoxPanel id="A" /> },
  'box-b': { title: `Box B, ${brand.boxes.B.name}`, place: 'side', body: () => <BoxPanel id="B" /> },
  laya: { title: "Laya's call for box A", place: 'side', body: () => <LayaCall /> },
  saves: { title: 'What Farm Hand saves', place: 'side', body: () => <SavingsPanel /> },
  results: { title: 'Results (fake)', place: 'wide', body: () => <ResultsPanel /> },
  history: { title: 'Soil moisture over time', place: 'bottom', body: () => <History /> },
  forecast: { title: 'Rain forecast', place: 'side', body: () => <Forecast /> },
  crops: { title: 'What can grow in each box', place: 'side', body: () => <CropsPanel /> },
  map: { title: 'Farms near you', place: 'wide', body: () => <MapPanel /> },
};
const IDS = Object.keys(PANELS) as PanelId[];
const fromHash = (): PanelId | null => { const h = location.hash.slice(1) as PanelId; return IDS.includes(h) ? h : null; };

export function usePanel(): [PanelId | null, (p: PanelId | null) => void] {
  const [open, setOpen] = useState<PanelId | null>(fromHash);
  useEffect(() => { const on = () => setOpen(fromHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  const set = (p: PanelId | null) => { history.replaceState(null, '', p ? '#' + p : location.pathname + location.search); setOpen(p); };
  return [open, set];
}

/** Where a panel sits, so the app can make room for it (the 3D scene shrinks beside a side sheet). */
export const placeOf = (id: PanelId | null): Place | null => (id ? PANELS[id].place : null);

function DockButton({ id, open, onToggle, label, short, glance }: { id: PanelId; open: PanelId | null; onToggle: (p: PanelId | null) => void; label: string; short?: string; glance?: string }) {
  const on = open === id;
  return (
    <button className={`dock-btn ${on ? 'is-on' : ''}`} aria-expanded={on} aria-controls="panel" aria-label={label} onClick={() => onToggle(on ? null : id)}>
      <span className="dock-label"><span className="dl-full">{label}</span><span className="dl-short" aria-hidden>{short ?? label}</span></span>
      {glance && <span className="dock-glance num">{glance}</span>}
    </button>
  );
}

export function Dock({ open, onToggle }: { open: PanelId | null; onToggle: (p: PanelId | null) => void }) {
  const a = useBoxGlance('A'), b = useBoxGlance('B'), call = useCallGlance();
  const s = useSavings();
  return (
    <nav className="dock" aria-label="Panels">
      <DockButton id="box-a" open={open} onToggle={onToggle} label="Box A" glance={a} />
      <DockButton id="box-b" open={open} onToggle={onToggle} label="Box B" glance={b} />
      <DockButton id="laya" open={open} onToggle={onToggle} label="Laya's call" short="Laya" glance={call} />
      <DockButton id="saves" open={open} onToggle={onToggle} label="Saves" glance={s.checks != null ? `${s.checks.toLocaleString()} checks` : undefined} />
      <DockButton id="results" open={open} onToggle={onToggle} label="Results" />
      <i className="dock-sep" aria-hidden />
      <DockButton id="history" open={open} onToggle={onToggle} label="History" />
      <DockButton id="forecast" open={open} onToggle={onToggle} label="Forecast" short="Rain" />
      <DockButton id="crops" open={open} onToggle={onToggle} label="Crops" />
      <DockButton id="map" open={open} onToggle={onToggle} label="Map" />
    </nav>
  );
}

/** One panel failing must never blank the app: show a short note in the panel instead. */
class PanelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error('[panel]', e); }
  render() { return this.state.failed ? <p className="muted">This panel couldn't load. Close it and open it again.</p> : this.props.children; }
}

/** One shell per placement, always mounted; the last opened content stays while it animates out. */
export function Panels({ open, onClose }: { open: PanelId | null; onClose: () => void }) {
  const [last, setLast] = useState<PanelId | null>(open);
  useEffect(() => { if (open) setLast(open); }, [open]);
  const ref = useRef<HTMLElement>(null);

  // Esc closes; a click on the scene closes, a drag (orbiting the 3D) does not.
  useEffect(() => {
    let down: { x: number; y: number } | null = null;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const pd = (e: PointerEvent) => { down = (e.target as Element).closest('.panel-shell, .dock, .topbar') ? null : { x: e.clientX, y: e.clientY }; };
    const pu = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) onClose(); down = null; };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', pd);
    window.addEventListener('pointerup', pu);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', pd); window.removeEventListener('pointerup', pu); };
  }, [onClose]);

  const id = open ?? last;
  const p = id ? PANELS[id] : null;
  return (
    <section
      id="panel"
      ref={ref}
      className={`panel-shell place-${p?.place ?? 'side'} ${open ? 'is-open' : ''}`}
      role="dialog"
      aria-labelledby="panel-title"
      aria-hidden={!open}
      inert={!open}
    >
      {p && (
        <>
          <header className="panel-head">
            <h2 id="panel-title">{p.title}</h2>
            <button className="btn btn-icon" onClick={onClose} aria-label="Close panel"><IconClose /></button>
          </header>
          <div className="panel-body" key={id}><PanelBoundary>{p.body()}</PanelBoundary></div>
        </>
      )}
    </section>
  );
}
