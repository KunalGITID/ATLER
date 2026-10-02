import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

// One short message at a time, optionally with an action ("Undo"). Undo
// replaces "are you sure?" dialogs for things that can be brought back.
interface Toast { text: string; action?: { label: string; run: () => void } }
const ToastContext = createContext<(t: Toast) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: Toast) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), t.action ? 6000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(96px,calc(env(safe-area-inset-bottom)+84px))] z-50 flex justify-center px-4">
        {toast && (
          <div role="status" className="pointer-events-auto flex max-w-md items-center gap-4 rounded-tile bg-here px-4 py-3 text-sm font-bold text-on-color shadow-2xl">
            <span>{toast.text}</span>
            {toast.action && (
              <button type="button" className="font-extrabold underline" onClick={() => { toast.action!.run(); setToast(null); }}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
