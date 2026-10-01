import { useEffect, useRef, type ReactNode } from 'react';

// A bottom sheet on the native <dialog>: focus is trapped, Escape closes it,
// and the page behind is inert.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/60 open:flex"
    >
      <div className="mx-auto w-full max-w-md rounded-t-block bg-ground px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-block-2" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}
