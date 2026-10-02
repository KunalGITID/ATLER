import { useState } from 'react';
import { addDays, endOfMonth, startOfMonth, today as todayDay, type Day } from '../core/dates.ts';
import { calendarMonth, type CalendarDay } from '../core/calendar.ts';
import { formatRupees, sum } from '../core/money.ts';
import type { Payment, Plan, PlanEvent } from '../core/model.ts';
import { planHref } from '../route.ts';
import { Block, Kicker } from '../ui/Block.tsx';

const monthLabel = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const short = (n: number) => (n >= 100000 ? `₹${Math.round(n / 100000)}k` : `₹${Math.round(n / 100)}`);

export function Calendar({ month, plans, events, payments }: { month: Day; plans: Plan[]; events: PlanEvent[]; payments: Payment[] }) {
  const today = todayDay();
  const days = calendarMonth(month, today, plans, events, payments);
  const [picked, setPicked] = useState<CalendarDay | null>(null);
  const shown = picked && picked.inMonth ? picked : null;
  const prev = startOfMonth(addDays(month, -1));
  const next = addDays(endOfMonth(month), 1);
  const inMonth = days.filter(d => d.inMonth);
  const total = sum(inMonth.map(d => d.total));
  const coming = sum(inMonth.flatMap(d => d.entries.filter(e => !e.paid).map(e => e.amount)));

  return (
    <div className="flex flex-col gap-2.5">
      <Block className="!p-4">
        <div className="flex items-center justify-between">
          <a href={`#/calendar/${prev.slice(0, 7)}`} aria-label={`Previous month, ${monthLabel(prev)}`} className="flex size-10 items-center justify-center rounded-xl bg-block-2 text-ink no-underline">‹</a>
          <h2 className="font-display text-xl font-bold">{monthLabel(month)}</h2>
          <a href={`#/calendar/${next.slice(0, 7)}`} aria-label={`Next month, ${monthLabel(next)}`} className="flex size-10 items-center justify-center rounded-xl bg-block-2 text-ink no-underline">›</a>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs font-bold text-ink-2">
          <span>{formatRupees(total)} in the month</span>
          {coming > 0 && <span className="text-soon">{formatRupees(coming)} still coming</span>}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-ink-2" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <div key={i}>{w}</div>)}
        </div>
        <div role="group" aria-label={`${monthLabel(month)} by day`} className="mt-1 grid grid-cols-7 gap-1">
          {days.map(day => {
            const isToday = day.on === today;
            const hasComing = day.entries.some(e => !e.paid);
            const hasPaid = day.entries.some(e => e.paid);
            return (
              <button
                key={day.on}
                type="button"
                disabled={!day.inMonth}
                aria-pressed={shown?.on === day.on}
                aria-label={`${Number(day.on.slice(8))}${day.entries.length ? `: ${day.entries.map(e => `${e.name} ${formatRupees(e.amount)}`).join(', ')}` : ''}`}
                onClick={() => setPicked(day)}
                className={`flex h-14 flex-col items-center justify-start rounded-xl pt-1.5 text-sm font-bold ${!day.inMonth ? 'opacity-0' : shown?.on === day.on ? 'bg-here text-on-color' : `${day.entries.length ? 'bg-block-2' : ''} ${isToday ? 'ring-2 ring-money ring-inset' : ''}`}`}
              >
                {Number(day.on.slice(8))}
                {day.inMonth && day.entries.length > 0 && (
                  <span className="mt-auto mb-1 flex items-center gap-0.5 text-[9px] font-extrabold">
                    {hasPaid && <span className="size-1.5 rounded-full bg-money" />}
                    {hasComing && <span className="size-1.5 rounded-full bg-soon" />}
                    {short(day.total)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-center gap-4 text-[11px] font-bold text-ink-2">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-money" />Paid</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-soon" />Coming</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm ring-2 ring-money" />Today</span>
        </div>
      </Block>

      {shown && (
        <Block className="!p-4" aria-live="polite">
          <Kicker className="text-ink-2">{new Date(`${shown.on}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</Kicker>
          {shown.entries.length ? (
            <ul className="mt-1">
              {shown.entries.map((e, i) => (
                <li key={i} className={`flex justify-between py-2.5 ${i ? 'border-t-2 border-ground' : ''}`}>
                  {e.planId ? <a href={planHref(e.planId)} className="font-bold text-ink">{e.name}</a> : <span className="font-bold">{e.name}</span>}
                  <span className={`num font-bold ${e.paid ? '' : 'text-soon'}`}>{formatRupees(e.amount)}{e.paid ? '' : ' · coming'}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-ink-2">Nothing on this day.</p>}
        </Block>
      )}
    </div>
  );
}
