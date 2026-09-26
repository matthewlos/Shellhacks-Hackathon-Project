import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { BOX_COLOR, FieldScene } from './FieldScene';
import { BOXES, useBox, type BoxId } from './sceneData';

/**
 * The 3D view: Farm Hand's two boxes (A = Farm Hand, B = Timer). No props; it reads the store itself.
 * Labels are HTML anchored to the scene. Every number on them is a live reading; nothing is filled in.
 */
export function FieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const reg = (key: string) => (el: HTMLElement | null) => { if (el) els.current.set(key, el); else els.current.delete(key); };

  const sceneRef = useRef<FieldScene | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    let scene: FieldScene;
    try { scene = new FieldScene(canvasRef.current); } catch (e) { console.error('WebGL unavailable', e); return; }
    sceneRef.current = scene;
    scene.onFrame = () => {
      for (const [key, el] of els.current) {
        const w = scene.anchors.get(key);
        if (!w) { el.style.opacity = '0'; continue; }
        const p = scene.project(w);
        const show = p.visible && (!key.startsWith('front:') || scene.modeled[key.slice(6) as BoxId]);
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        el.style.opacity = show ? '1' : '0';
      }
    };
    return () => { scene.dispose(); sceneRef.current = null; };
  }, []);

  return (
    <div className="field">
      <canvas
        ref={canvasRef} className="field-canvas"
        aria-label="3D view of the two soil boxes: A, Farm Hand, watered by the AI; B, Timer, the control"
      />
      <div className="field-overlay">
        {BOXES.map((b) => (
          <div key={b.id} ref={reg('label:' + b.id)} className="anchor" style={{ transition: 'opacity 200ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
            <BoxLabel id={b.id} name={b.name} role={b.role} />
          </div>
        ))}
        {BOXES.map((b) => (
          <div key={'f' + b.id} ref={reg('front:' + b.id)} className="anchor" style={{ opacity: 0, transition: 'opacity 200ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
            <div style={note}>wet front: modeled</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Just which box is which: the readings live in the top bar's readout, so the labels don't repeat them. */
function BoxLabel({ id, name, role }: { id: BoxId; name: string; role: string }) {
  const r = useBox(id);
  const narrow = useNarrow();
  const color = `var(--box-${id.toLowerCase()}, ${BOX_COLOR[id]})`;
  return (
    <div style={{ ...chip, ...(narrow ? { fontSize: 11.5, padding: '4px 8px' } : null), pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...badge, background: color }}>{id}</span>
        <b style={{ fontWeight: 650 }}>{name}</b>
        {!narrow && <span style={{ opacity: 0.6 }}>{role}</span>}
        {r.pumping && <span style={{ color, fontWeight: 650 }}>watering</span>}
      </div>
    </div>
  );
}

const NARROW = '(max-width: 600px)';
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(NARROW); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(NARROW).matches,
    () => false,
  );
}

const chip: CSSProperties = {
  whiteSpace: 'nowrap', font: '500 13px/1.3 var(--font-ui, system-ui, sans-serif)', color: 'var(--text, #1d2320)',
  background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(20,30,25,0.10)', borderRadius: 10, padding: '6px 10px',
  boxShadow: '0 2px 8px rgba(20,30,25,0.08)',
};
const badge: CSSProperties = {
  display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 700,
};
const note: CSSProperties = {
  whiteSpace: 'nowrap', font: '500 11px/1.2 var(--font-ui, system-ui, sans-serif)', color: 'rgba(29,35,32,0.72)',
  background: 'rgba(255,255,255,0.75)', borderRadius: 6, padding: '3px 7px', pointerEvents: 'none',
};
