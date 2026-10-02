// Everything that left your account in a month: logged expenses plus plan
// renewals, grouped by day, newest first.
import { endOfMonth, parseDay, startOfMonth, type Day } from './dates.ts';
import { sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount } from './share.ts';

export type SpentItem =
  | { kind: 'expense'; payment: Payment }
  | { kind: 'renewal'; planId: string; name: string; on: Day; amount: Paise };

export interface SpentDay { on: Day; items: SpentItem[]; total: Paise }

export const monthOf = (key: string | null, today: Day): Day => (key && parseDay(`${key}-01`)) || startOfMonth(today);

export function spentInMonth(month: Day, today: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]) {
  const first = startOfMonth(month);
  const last = endOfMonth(month) < today ? endOfMonth(month) : today; // only what has happened
  const items: Array<SpentItem & { on: Day; amount: Paise }> = [
    ...payments.filter(p => p.on >= first && p.on <= last).map(p => ({ kind: 'expense' as const, payment: p, on: p.on, amount: ownAmount(p) })),
    ...plans.flatMap(p => renewalsBetween(p, events.filter(e => e.planId === p.id), first, last))
      .map(r => ({ kind: 'renewal' as const, planId: r.planId, name: r.name, on: r.on, amount: r.amount })),
  ];
  const days = new Map<Day, SpentDay>();
  for (const it of items) {
    const day = days.get(it.on) ?? { on: it.on, items: [], total: 0 as Paise };
    day.items.push(it);
    day.total = sum([day.total, it.amount]);
    days.set(it.on, day);
  }
  const list = [...days.values()].sort((a, b) => (a.on < b.on ? 1 : -1));
  return { days: list, total: sum(items.map(i => i.amount)), expenses: items.filter(i => i.kind === 'expense').length };
}
