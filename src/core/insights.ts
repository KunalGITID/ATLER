// Next month's forecast, unusual spending, and what cancelling has kept.
// Each returns null/empty when it has nothing real to say, so the screen
// shows nothing rather than a filler card.
import { addDays, daysBetween, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween, type Renewal } from './renewals.ts';

const nextMonthStart = (d: Day) => addDays(endOfMonth(d), 1);

// ---------- forecast ----------

export interface Forecast {
  month: Day;              // first day of next month
  renewals: Renewal[];     // exact
  fixed: Paise;            // sum of renewals
  everyday: { estimate: Paise; low: Paise; high: Paise; months: number } | null;
  estimate: Paise;
  low: Paise;
  high: Paise;
}

// Everyday (logged) spending per complete month before this one, up to six,
// skipping months before anything was logged.
export function everydayByMonth(payments: readonly Payment[], today: Day, maxMonths = 6): Paise[] {
  if (!payments.length) return [];
  const first = startOfMonth([...payments].map(p => p.on).sort()[0]!);
  const totals: Paise[] = [];
  let monthStart = startOfMonth(addDays(startOfMonth(today), -1));
  for (let i = 0; i < maxMonths && monthStart >= first; i++) {
    const end = endOfMonth(monthStart);
    totals.unshift(sum(payments.filter(p => p.on >= monthStart && p.on <= end).map(p => p.amount)));
    monthStart = startOfMonth(addDays(monthStart, -1));
  }
  return totals;
}

export function forecastNextMonth(plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[], today: Day): Forecast | null {
  const month = nextMonthStart(today);
  const renewals = plans.flatMap(p => renewalsBetween(p, events.filter(e => e.planId === p.id), month, endOfMonth(month)))
    .sort((a, b) => (a.on < b.on ? -1 : 1));
  const fixed = sum(renewals.map(r => r.amount));
  const history = everydayByMonth(payments, today);
  if (!renewals.length && !history.length) return null;
  const everyday = history.length
    ? {
        estimate: paise(Math.round(history.reduce((a, b) => a + b, 0) / history.length)),
        low: paise(Math.min(...history)),
        high: paise(Math.max(...history)),
        months: history.length,
      }
    : null;
  return {
    month, renewals, fixed, everyday,
    estimate: paise(fixed + (everyday?.estimate ?? 0)),
    low: paise(fixed + (everyday?.low ?? 0)),
    high: paise(fixed + (everyday?.high ?? 0)),
  };
}

// ---------- unusual spending ----------

const MIN_HISTORY = 5;
const MIN_AMOUNT = 20000; // ₹200

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const groupOf = (p: Payment) => (p.categoryId ? `c:${p.categoryId}` : `n:${p.name.trim().toLowerCase()}`);

export interface Unusual { payment: Payment; median: Paise; times: number; compared: number }

// One expense against earlier ones in its category (or with the same name):
// above Tukey's fence (Q3 + 1.5 IQR), at least 2x the median, ₹200 or more,
// and with 5+ earlier expenses to judge by. Medians and the IQR aren't pulled
// around by the very outliers we're looking for.
export function unusualness(payment: Payment, history: readonly Payment[]): Unusual | null {
  if (payment.amount < MIN_AMOUNT) return null;
  const past = history
    .filter(h => h.id !== payment.id && groupOf(h) === groupOf(payment) && h.on <= payment.on)
    .map(h => h.amount as number)
    .sort((a, b) => a - b);
  if (past.length < MIN_HISTORY) return null;
  const median = quantile(past, 0.5);
  const q1 = quantile(past, 0.25);
  const q3 = quantile(past, 0.75);
  if (payment.amount <= q3 + 1.5 * (q3 - q1) || payment.amount < 2 * median) return null;
  return { payment, median: paise(Math.round(median)), times: payment.amount / median, compared: past.length };
}

// Unusual expenses from the last week, most unusual first.
export function recentUnusual(payments: readonly Payment[], today: Day, days = 7): Unusual[] {
  return payments
    .filter(p => daysBetween(p.on, today) >= 0 && daysBetween(p.on, today) < days)
    .map(p => unusualness(p, payments))
    .filter((u): u is Unusual => u !== null)
    .sort((a, b) => b.times - a.times);
}

// ---------- savings ----------

// Everything cancelled plans would have charged since their cancellation, and
// what they'd cost per year now.
export function keptByCancelling(plans: readonly Plan[], events: readonly PlanEvent[], today: Day) {
  let kept = 0;
  let perYear = 0;
  const items: Array<{ plan: Plan; kept: Paise }> = [];
  for (const plan of plans.filter(p => p.status === 'cancelled')) {
    const mine = events.filter(e => e.planId === plan.id);
    const cancelled = mine.filter(e => e.kind === 'cancelled').map(e => e.on).sort().at(-1);
    if (!cancelled) continue;
    const would = renewalsBetween({ ...plan, status: 'active' }, [], addDays(cancelled, 1), today);
    const amount = sum(would.map(() => plan.price));
    kept += amount;
    items.push({ plan, kept: amount });
    perYear += plan.cycle.unit === 'year' ? plan.price / plan.cycle.every
      : plan.cycle.unit === 'month' ? (plan.price * 12) / plan.cycle.every
      : (plan.price * 365.25) / plan.cycle.every;
  }
  if (!items.length) return null;
  return { kept: paise(kept), perYear: paise(Math.round(perYear)), items: items.sort((a, b) => b.kept - a.kept) };
}
