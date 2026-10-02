import { useEffect, useRef, type ReactNode } from 'react';

// Floating cards on the native <dialog>: focus is trapped, Escape closes them,
// and the page behind stays visible but dimmed and inert.
const card = 'mx-auto w-full max-w-md overflow-y-auto overscroll-contain rounded-block bg-ground outline-2 outline-block-2 transition-[opacity,translate] duration-200 ease-out starting:translate-y-4 starting:opacity-0';
const dialogCls = 'm-0 h-full max-h-none w-full max-w-none bg-transparent p-3 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] text-ink backdrop:bg-black/70 backdrop:backdrop-blur-[2px] open:flex open:flex-col';

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return ref;
}

// A form or confirmation: floats near the bottom, within thumb reach.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useModal(open);
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} className={`${dialogCls} justify-end`}>
      <div className={`${card} max-h-full px-4 pt-4 pb-5`}>{children}</div>
    </dialog>
  );
}

// A whole view (what I spent, calendar, year) floating over the home screen.
export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useModal(true);
  return (
    <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }} className={`${dialogCls} justify-center`}>
      <div className={`${card} max-h-full p-2.5`}>
        <div className="flex items-center justify-between px-2 pt-1 pb-2.5">
          <h1 className="font-display text-lg font-bold tracking-[0.04em]">{title}</h1>
          <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="flex size-9 items-center justify-center rounded-xl bg-block-2 text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
