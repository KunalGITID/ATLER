import type { HTMLAttributes, ReactNode } from 'react';

// A block is ATLER's only container. Its colour carries meaning:
//   money = your money / the main thing on screen, soon = a charge coming,
//   dark = everything else.
type Tone = 'money' | 'soon' | 'dark';

const tones: Record<Tone, string> = {
  money: 'bg-money text-on-color',
  soon: 'bg-soon text-on-color',
  dark: 'bg-block text-ink',
};

export function Block({ tone = 'dark', className = '', children, ...rest }: { tone?: Tone; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-block p-5 ${tones[tone]} ${className}`} {...rest}>
      {children}
    </div>
  );
}

// Small caps label that names what a number or control is.
export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] font-extrabold tracking-[0.1em] uppercase ${className}`}>{children}</div>;
}
