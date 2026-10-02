import { useId } from 'react';

// On/off for one setting. On is lime: it turns on something about your money.
export function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (on: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-block px-4 py-3">
      <div>
        <label htmlFor={id} className="text-[15px] font-bold">{label}</label>
        {hint && <div className="text-xs text-ink-2">{hint}</div>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-money' : 'bg-block-2'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-[27px] rounded-full bg-here shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
