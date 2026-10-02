// Last month in a few lines, shown during the first week of a new month:
// what it cost, how that compares, where it went, and one thing to try.
import { addDays, dayOfMonth, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { formatRupees, paise, sum, type Paise } from './money.ts';
import type { Category, Payment, Plan, PlanEvent } from './model.ts';
import { monthTotal, trackingSince } from './month.ts';
import { overlaps, stillUsing } from './overlap.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount } from './share.ts';

export interface MonthSummary {
  month: Day;
  total: Paise;
  change: Paise | null;   // against the month before, when that was tracked
  lines: string[];
  tip: string | null;
}

export function monthSummary(today: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[], categories: readonly Category[]): MonthSummary | null {
  if (dayOfMonth(today) > 7) return null;
  const month = startOfMonth(addDays(startOfMonth(today), -1));
  const since = trackingSince(plans, payments);
  if (!since || since > month) return null; // last month wasn't fully tracked
  const last = endOfMonth(month);
  const total = monthTotal(month, plans, events, payments);
  if (total <= 0) return null;
  const before = startOfMonth(addDays(month, -1));
  const change = since <= before ? paise(total - monthTotal(before, plans, events, payments)) : null;

  // Where it went: by category, renewals included.
  const byCat = new Map<string, number>();
  const name = (id: string | null) => categories.find(c => c.id === id)?.name ?? 'Uncategorised';
  for (const p of payments.filter(p => p.on >= month && p.on <= last)) byCat.set(name(p.categoryId), (byCat.get(name(p.categoryId)) ?? 0) + ownAmount(p));
  for (const plan of plans) {
    const r = sum(renewalsBetween(plan, events.filter(e => e.planId === plan.id), month, last).map(x => x.amount));
    if (r) byCat.set(name(plan.categoryId), (byCat.get(name(plan.categoryId)) ?? 0) + r);
  }
  const lines: string[] = [];
  const top = [...byCat].sort((a, b) => b[1] - a[1])[0];
  if (top) lines.push(`Most went on ${top[0]}: ${formatRupees(top[1] as Paise)} (${Math.round((top[1] / total) * 100)}%).`);
  const biggest = payments.filter(p => p.on >= month && p.on <= last).sort((a, b) => ownAmount(b) - ownAmount(a))[0];
  if (biggest) lines.push(`Biggest single expense: ${biggest.name}, ${formatRupees(ownAmount(biggest))}.`);
  const count = payments.filter(p => p.on >= month && p.on <= last).length;
  if (count) lines.push(`${count} expense${count === 1 ? '' : 's'} logged.`);

  const overlap = overlaps(plans)[0];
  const idle = stillUsing(plans, events, today)[0];
  const tip = overlap ? `${overlap.note} ${overlap.group === 'bundle' ? 'The extra costs' : 'Together'} ${formatRupees(overlap.perMonth)} a month.`
    : idle ? `Still using ${idle.plan.name}? It's ${formatRupees(idle.perMonth)} a month.`
    : change !== null && change > 0 && top ? `Spending rose ${formatRupees(change)}. A budget on ${top[0]} would show it coming.`
    : null;
  return { month, total, change, lines, tip };
}
