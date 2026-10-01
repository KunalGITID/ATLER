import type { MonthRing as Ring } from '../core/month.ts';
import { formatRupees } from '../core/money.ts';
import { planHref } from '../route.ts';

// The calendar of the month, drawn on the money block (black on lime).
//   faint track = the whole month, shaded arc = 1st -> today,
//   ring marker = today, black dot = renewal paid, coral dot = renewal coming.
const SIZE = 168;
const R = 70;
const C = 2 * Math.PI * R;
const point = (turn: number) => {
  const a = turn * 2 * Math.PI;
  return { x: SIZE / 2 + R * Math.sin(a), y: SIZE / 2 - R * Math.cos(a) };
};

export function MonthRing({ ring, label }: { ring: Ring; label: string }) {
  const todayAt = point(ring.elapsed - 0.5 / ring.days);
  const description = [
    `${label}: day ${Math.round(ring.elapsed * ring.days)} of ${ring.days}.`,
    ...ring.markers.map(m => `${m.name} ${formatRupees(m.amount)} on the ${Number(m.on.slice(8))}, ${m.status === 'paid' ? 'paid' : 'still to come'}.`),
  ].join(' ');
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none" role="group" aria-label={description}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgb(10 10 10 / 0.14)" strokeWidth={16} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke="rgb(10 10 10 / 0.38)" strokeWidth={16}
          strokeDasharray={`${C * ring.elapsed} ${C}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        {ring.markers.map(m => {
          const p = point(m.at + 0.5 / ring.days);
          return m.status === 'paid'
            ? <circle key={m.planId + m.on} cx={p.x} cy={p.y} r={6} fill="#0a0a0a" />
            : (
              // A coming charge: tap it to open that plan.
              <a key={m.planId + m.on} href={planHref(m.planId)} aria-label={`${m.name}, ${formatRupees(m.amount)} on the ${Number(m.on.slice(8))}`}>
                <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={7} className="fill-soon" stroke="#0a0a0a" strokeWidth={2} />
              </a>
            );
        })}
        <circle cx={todayAt.x} cy={todayAt.y} r={5} className="fill-money" stroke="#0a0a0a" strokeWidth={3} />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-on-color">
        <div className="text-[10px] font-extrabold tracking-[0.12em] uppercase">Spent · {label}</div>
        <div className="num text-[30px] leading-tight font-bold">{formatRupees(ring.spent)}</div>
      </div>
    </div>
  );
}
