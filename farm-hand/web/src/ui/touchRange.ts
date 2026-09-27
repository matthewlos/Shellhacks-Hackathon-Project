import { useCallback, useRef } from 'react';

/**
 * Touch dragging for a native <input type="range">.
 *
 * iPad Safari only moves a native range when the finger lands exactly on the thumb, and a drag that wobbles
 * vertically can hand the gesture to the scrolling sheet, so the slider stalls mid-drag. This takes over touch
 * and pen input on the element: the value jumps to the finger on touch-down and follows it 1:1 (pointer capture,
 * so the finger may leave the track). Mouse and keyboard keep the native behaviour, and the input stays the
 * accessible control. Pair it with `touch-action: none` on the input in CSS.
 *
 * `thumb` is the thumb's width in px: the value maps across the track between the thumb's centre positions.
 */
export function useTouchRange(onValue: (v: number) => void, thumb = 28) {
  const cb = useRef(onValue);
  cb.current = onValue;
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((el: HTMLInputElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;

    const valueAt = (x: number) => {
      const r = el.getBoundingClientRect();
      const min = Number(el.min || 0), max = Number(el.max || 100);
      const p = Math.min(1, Math.max(0, (x - r.left - thumb / 2) / Math.max(1, r.width - thumb)));
      let v = min + p * (max - min);
      const step = el.step === 'any' ? 0 : Number(el.step || 1);
      if (step > 0) v = Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
      return v;
    };
    let active: number | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || el.disabled) return;
      active = e.pointerId;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
      cb.current(valueAt(e.clientX));
    };
    const move = (e: PointerEvent) => { if (e.pointerId === active) { e.preventDefault(); cb.current(valueAt(e.clientX)); } };
    const up = (e: PointerEvent) => { if (e.pointerId === active) { active = null; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } };
    // stop Safari's own range handling (it would fight the finger) and any text selection or callout
    const touch = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('touchstart', touch, { passive: false });
    el.addEventListener('touchmove', touch, { passive: false });
    cleanup.current = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('touchstart', touch);
      el.removeEventListener('touchmove', touch);
    };
  }, [thumb]);
}
