import { useId, type InputHTMLAttributes } from 'react';

export function Field({ label, className = '', ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">{label}</label>
      <input
        id={id}
        className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none placeholder:text-ink-2/60 focus:border-money"
        {...rest}
      />
    </div>
  );
}
