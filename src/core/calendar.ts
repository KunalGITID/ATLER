// A month as a calendar grid (weeks start Monday), each day with the charges
// on it: renewals (paid or coming) and logged expenses.
import { addDays, daysInMonth, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount } from './share.ts';

export interface CalendarEntry { name: string; amount: Paise; kind: 'renewal' | 'expense'; planId: string | null; paid: boolean }
export interface CalendarDay { on: Day; inMonth: boolean; entries: CalendarEntry[]; total: Paise }

export function calendarMonth(month: Day, today: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]): CalendarDay[] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const byDay = new Map<Day, CalendarEntry[]>();
  const add = (on: Day, e: CalendarEntry) => byDay.set(on, [...(byDay.get(on) ?? []), e]);
  for (const p of plans) {
    for (const r of renewalsBetween(p, events.filter(e => e.planId === p.id), first, last)) {
      add(r.on, { name: r.name, amount: r.amount, kind: 'renewal', planId: p.id, paid: r.on <= today });
    }
  }
  for (const p of payments.filter(x => x.on >= first && x.on <= last)) add(p.on, { name: p.name, amount: ownAmount(p), kind: 'expense', planId: null, paid: true });

  // Pad to whole weeks, Monday first.
  const weekday = (d: Day) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -weekday(first));
  const cells = Math.ceil((weekday(first) + daysInMonth(first)) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const on = addDays(start, i);
    const entries = byDay.get(on) ?? [];
    return { on, inMonth: on >= first && on <= last, entries, total: sum(entries.map(e => e.amount)) };
  });
}
