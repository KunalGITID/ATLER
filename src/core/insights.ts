// Next month's forecast, unusual spending, and what cancelling has kept.
// Each returns null/empty when it has nothing real to say, so the screen
// shows nothing rather than a filler card.
import { addDays, daysBetween, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { barFor, learnBars, type Bars, type Verdict } from './alertFeedback.ts';
import { knownMerchant } from './import/merchants.ts';
import { renewalsBetween, type Renewal } from './renewals.ts';
import { ownAmount, yourShare } from './share.ts';

const nextMonthStart = (d: Day) => addDays(endOfMonth(d), 1);

// ---------- forecast ----------

export interface Forecast {
  month: Day;              // first day of next month
  renewals: Renewal[];     // exact
  fixed: Paise;            // sum of renewals
  // seasonal: how this month ran against the months before it a year ago
  // (1.2 = 20% busier); applied to the estimate. null without a year of data.
  everyday: { estimate: Paise; low: Paise; high: Paise; months: number; seasonal: number | null } | null;
  estimate: Paise;
  low: Paise;
  high: Paise;
}

// Everyday (logged) spending per complete month before this one, up to six,
// skipping months before anything was logged.
export function everydayByMonth(payments: readonly Payment[], today: Day, maxMonths = 6): Paise[] {
  return everydayMonthsBefore(payments, startOfMonth(today), maxMonths);
}

// Everyday totals of up to `maxMonths` complete months before `month`, oldest first.
function everydayMonthsBefore(payments: readonly Payment[], month: Day, maxMonths: number): Paise[] {
  if (!payments.length) return [];
  const first = startOfMonth([...payments].map(p => p.on).sort()[0]!);
  const totals: Paise[] = [];
  let monthStart = startOfMonth(addDays(month, -1));
  for (let i = 0; i < maxMonths && monthStart >= first; i++) {
    const end = endOfMonth(monthStart);
    totals.unshift(sum(payments.filter(p => p.on >= monthStart && p.on <= end).map(ownAmount)));
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
  const seasonal = seasonality(payments, month);
  const k = seasonal ?? 1;
  const everyday = history.length
    ? {
        estimate: paise(Math.round((k * history.reduce((a, b) => a + b, 0)) / history.length)),
        low: paise(Math.round(k * Math.min(...history))),
        high: paise(Math.round(k * Math.max(...history))),
        months: history.length,
        seasonal,
      }
    : null;
  return {
    month, renewals, fixed, everyday,
    estimate: paise(fixed + (everyday?.estimate ?? 0)),
    low: paise(fixed + (everyday?.low ?? 0)),
    high: paise(fixed + (everyday?.high ?? 0)),
  };
}

// Was this month busier or quieter than usual last year? The same month a
// year ago against the (up to six) months before it, when there are at least
// three to compare with. Kept within 0.75..1.5 so one odd year can't swing it.
export function seasonality(payments: readonly Payment[], month: Day): number | null {
  const lastYear = startOfMonth(addDays(month, -365 + 14));
  const before = everydayMonthsBefore(payments.filter(p => p.on < lastYear), lastYear, 6);
  if (before.length < 3) return null;
  const usual = before.reduce((a, b) => a + b, 0) / before.length;
  const then = sum(payments.filter(p => p.on >= lastYear && p.on <= endOfMonth(lastYear)).map(ownAmount));
  if (usual <= 0 || then <= 0) return null;
  const k = Math.min(1.5, Math.max(0.75, then / usual));
  return Math.abs(k - 1) < 0.05 ? null : Math.round(k * 100) / 100;
}

export interface Accuracy { month: Day; forecast: Paise; low: Paise; high: Paise; actual: Paise; off: number; within: boolean }

// How good was last month's forecast? Re-run it as it would have been made
// at the end of the month before (only what was known then) and compare.
export function forecastAccuracy(plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[], today: Day): Accuracy | null {
  const month = startOfMonth(addDays(startOfMonth(today), -1));
  const asOf = addDays(month, -1);
  const known = payments.filter(p => p.on <= asOf);
  if (!known.length) return null;
  const f = forecastNextMonth(plans.filter(p => p.createdOn <= asOf), events.filter(e => e.on <= asOf), known, asOf);
  if (!f || !f.everyday) return null;
  const renewals = plans.flatMap(p => renewalsBetween(p, events.filter(e => e.planId === p.id), month, endOfMonth(month)));
  const actual = sum([...renewals.map(r => r.amount), ...payments.filter(p => p.on >= month && p.on <= endOfMonth(month)).map(ownAmount)]);
  if (actual <= 0) return null;
  return { month, forecast: f.estimate, low: f.low, high: f.high, actual, off: Math.abs(actual - f.estimate) / actual, within: actual >= f.low && actual <= f.high };
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

// "SWIGGY*BLR 8823" and "Swiggy" are the same place.
export const merchantOf = (p: Payment) => (knownMerchant(p.name) ?? p.name).trim().toLowerCase().replace(/\s+/g, ' ');

export interface Unusual { payment: Payment; median: Paise; times: number; compared: number }

// One expense against your earlier ones at the same place: above Tukey's
// fence (Q3 + 1.5 IQR), at least 2x the median (or the bar your answers have
// set, core/alertFeedback.ts), ₹200 or more, and with 5+
// earlier spends there to judge by. Medians and the IQR aren't pulled around
// by the very outliers we're looking for.
// Not against the category: a category mixes places (a ₹1,400 DMart shop next
// to ₹150 corner-shop runs), and in the KunalGITID/atler-ml benchmark only 7%
// of category-based alerts were real, against 16% (rising with the multiple)
// for same-place ones.
export function unusualness(payment: Payment, history: readonly Payment[], bars?: Bars): Unusual | null {
  if (ownAmount(payment) < MIN_AMOUNT) return null;
  const merchant = merchantOf(payment);
  const past = history
    .filter(h => h.id !== payment.id && h.on <= payment.on && merchantOf(h) === merchant)
    .map(h => ownAmount(h) as number)
    .sort((a, b) => a - b);
  if (past.length < MIN_HISTORY) return null;
  const median = quantile(past, 0.5);
  const q1 = quantile(past, 0.25);
  const q3 = quantile(past, 0.75);
  const amount = ownAmount(payment);
  if (amount <= q3 + 1.5 * (q3 - q1) || amount < barFor(bars, merchant) * median) return null;
  return { payment, median: paise(Math.round(median)), times: amount / median, compared: past.length };
}

// Unusual expenses from the last week you haven't answered yet, most unusual first.
export function recentUnusual(payments: readonly Payment[], today: Day, days = 7, verdicts: readonly Verdict[] = []): Unusual[] {
  const bars = learnBars(verdicts);
  const answered = new Set(verdicts.map(v => v.paymentId));
  return payments
    .filter(p => daysBetween(p.on, today) >= 0 && daysBetween(p.on, today) < days && !answered.has(p.id))
    .map(p => unusualness(p, payments, bars))
    .filter((u): u is Unusual => u !== null)
    .sort((a, b) => b.times - a.times);
}

// Your biggest unanswered jumps from before the last week, for a one-off
// "teach ATLER" review while you have only a few answers. Each judged
// against what came before it. Answering 5 of these when you start roughly
// doubled how often alerts were real in the first months (atler-ml feedback.py).
export const REVIEW_UNTIL = 4; // answers
export function pastJumps(payments: readonly Payment[], today: Day, verdicts: readonly Verdict[] = [], n = 5): Unusual[] {
  if (verdicts.length >= REVIEW_UNTIL) return [];
  const bars = learnBars(verdicts);
  const answered = new Set(verdicts.map(v => v.paymentId));
  return payments
    .filter(p => daysBetween(p.on, today) >= 7 && !answered.has(p.id))
    .map(p => unusualness(p, payments, bars))
    .filter((u): u is Unusual => u !== null)
    .sort((a, b) => b.times - a.times)
    .slice(0, n);
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
    const price = yourShare(plan, plan.price);
    const amount = sum(would.map(() => price));
    kept += amount;
    items.push({ plan, kept: amount });
    perYear += plan.cycle.unit === 'year' ? price / plan.cycle.every
      : plan.cycle.unit === 'month' ? (price * 12) / plan.cycle.every
      : (price * 365.25) / plan.cycle.every;
  }
  if (!items.length) return null;
  return { kept: paise(kept), perYear: paise(Math.round(perYear)), items: items.sort((a, b) => b.kept - a.kept) };
}
