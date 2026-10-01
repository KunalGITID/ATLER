import type { ButtonHTMLAttributes } from 'react';

// primary = the one main action on a screen (lime); plain = secondary (white);
// quiet = low-emphasis; danger = destructive.
type Kind = 'primary' | 'plain' | 'quiet' | 'danger';

const kinds: Record<Kind, string> = {
  primary: 'bg-money text-on-color h-[60px] rounded-[22px] font-display text-xl font-bold tracking-[0.06em]',
  plain: 'bg-here text-on-color h-14 rounded-[22px] text-[15px] font-extrabold',
  quiet: 'bg-block-2 text-ink h-12 rounded-control text-sm font-bold',
  danger: 'bg-transparent text-danger h-12 rounded-control text-[15px] font-bold',
};

export function Button({ kind = 'plain', className = '', type = 'button', ...rest }: { kind?: Kind } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2.5 px-5 transition-opacity active:opacity-70 disabled:opacity-40 ${kinds[kind]} ${className}`}
      {...rest}
    />
  );
}
