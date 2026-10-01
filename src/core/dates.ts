// Calendar days and billing cycles. A Day is a plain 'YYYY-MM-DD' string and
// all maths happens in UTC, so a phone's time zone can never shift a date.

import { paise, type Paise } from './money.ts';

export type Day = string & { readonly __day: unique symbol };

export type Cycle =
  | { unit: 'month'; every: number } // monthly = 1, quarterly = 3
  | { unit: 'year'; every: number }
  | { unit: 'day'; every: number }; // 28-day mobile plans, weekly = 7

export const MONTHLY: Cycle = { unit: 'month', every: 1 };
export const YEARLY: Cycle = { unit: 'year', every: 1 };

const pad = (n: number) => String(n).padStart(2, '0');
const toUtc = (d: Day) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const fromUtc = (ms: number): Day => {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` as Day;
};

export function makeDay(year: number, month: number, date: number): Day | null {
  const t = new Date(Date.UTC(year, month - 1, date));
  if (t.getUTCFullYear() !== year || t.getUTCMonth() !== month - 1 || t.getUTCDate() !== date) return null;
  return fromUtc(t.getTime());
}

// Strict 'YYYY-MM-DD' (a timestamp's date part is accepted) that is a real day.
export function parseDay(text: string): Day | null {
  const m = String(text).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  return m ? makeDay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

// The user's calendar day right now (their device's local date).
export function today(now = new Date()): Day {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` as Day;
}

export const addDays = (d: Day, n: number): Day => fromUtc(toUtc(d) + n * 86_400_000);
export const daysBetween = (from: Day, to: Day): number => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
export const daysInMonth = (d: Day): number => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate();
export const dayOfMonth = (d: Day): number => Number(d.slice(8, 10));
export const startOfMonth = (d: Day): Day => `${d.slice(0, 8)}01` as Day;
export const endOfMonth = (d: Day): Day => `${d.slice(0, 8)}${pad(daysInMonth(d))}` as Day;

function addMonthsClamped(d: Day, months: number): Day {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - 1 + months;
  const target = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(dayOfMonth(d), last));
  return fromUtc(target.getTime());
}

// The n-th billing date of a plan. Always counted from the anchor, never from
// the previous date: a plan started on the 31st goes 28 Feb -> 31 Mar.
export function nthDate(anchor: Day, cycle: Cycle, n: number): Day {
  if (cycle.unit === 'day') return addDays(anchor, cycle.every * n);
  return addMonthsClamped(anchor, (cycle.unit === 'year' ? 12 : 1) * cycle.every * n);
}

// Every billing date from the anchor up to and including `until`.
export function datesUntil(anchor: Day, cycle: Cycle, until: Day, max = 2000): Day[] {
  const out: Day[] = [];
  for (let n = 0; n < max; n++) {
    const d = nthDate(anchor, cycle, n);
    if (d > until) break;
    out.push(d);
  }
  return out;
}

// The first billing date strictly after `after`.
export function nextDate(anchor: Day, cycle: Cycle, after: Day): Day {
  if (anchor > after) return anchor;
  const past = datesUntil(anchor, cycle, after);
  return nthDate(anchor, cycle, past.length);
}

// The billing cycle `on` falls in: [start, end) and how far through it is.
// Drives the countdown ring.
export function cycleProgress(anchor: Day, cycle: Cycle, on: Day) {
  const end = nextDate(anchor, cycle, on);
  const past = datesUntil(anchor, cycle, on);
  const start = past.length ? past[past.length - 1]! : anchor;
  const total = Math.max(1, daysBetween(start, end));
  const left = daysBetween(on, end);
  return { start, end, total, left, done: (total - left) / total };
}

// Average monthly cost of a plan, rounded to whole paise.
export function monthlyCost(price: Paise, cycle: Cycle): Paise {
  const perMonth =
    cycle.unit === 'month' ? price / cycle.every
    : cycle.unit === 'year' ? price / (12 * cycle.every)
    : (price / cycle.every) * (365.25 / 12);
  return paise(Math.round(perMonth));
}

export function describeCycle(cycle: Cycle): string {
  if (cycle.unit === 'month') return cycle.every === 1 ? 'Monthly' : cycle.every === 3 ? 'Quarterly' : `Every ${cycle.every} months`;
  if (cycle.unit === 'year') return cycle.every === 1 ? 'Yearly' : `Every ${cycle.every} years`;
  return cycle.every === 7 ? 'Weekly' : `Every ${cycle.every} days`;
}
