import { useCallback, useRef } from 'react';

// Returns a ref: a quick, mostly sideways one-finger swipe on that element
// calls `left` (finger moved left: go to what's next) or `right` (go to what's
// before). Vertical scrolling, form fields, the screen edges (the phone's own
// back gesture) and dialogs floating over the element are left alone, so a
// swipe in a panel never also moves the page behind it.
const MIN_DISTANCE = 50;   // px
const MAX_TIME = 800;      // ms
const EDGE = 20;           // px from either side of the screen

export function useSwipe(handlers: { left?: () => void; right?: () => void }) {
  const latest = useRef(handlers);
  latest.current = handlers;

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const target = e.target as Element;
      // While pages slide (a view transition), touches land on <html>.
      if (!el.contains(target) && target !== document.documentElement) return;
      const dialog = target.closest('dialog');
      if (dialog && !dialog.contains(el)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const { clientX: x, clientY: y } = e.touches[0]!;
      if (x < EDGE || x > window.innerWidth - EDGE) return;
      start = { x, y, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      const from = start;
      start = null;
      const touch = e.changedTouches[0];
      if (!from || !touch || Date.now() - from.t > MAX_TIME) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return;
      (dx < 0 ? latest.current.left : latest.current.right)?.();
    };
    const onCancel = () => { start = null; };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onCancel);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, []);
}
