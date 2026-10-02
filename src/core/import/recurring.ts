// Finds recurring charges (likely subscriptions) in a bank statement.
// Runs on the phone; the statement is never uploaded.
import { daysBetween, monthlyCost, type Cycle, type Day } from '../dates.ts';
import type { Paise } from '../money.ts';
import { merchantName } from './merchants.ts';
import type { Debit } from './statement.ts';
import subscriptionModel from './subscriptionModel.json' with { type: 'json' };

// ---------- spotting the pattern ----------

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

// Billing rhythms: the typical gap in days, how far one gap may drift (months
// vary 28-31 days; banks post a day or two late), and the cycle it means.
const RHYTHMS: Array<{ days: number; slack: number; match: number; cycle: Cycle }> = [
  { days: 7, slack: 1, match: 1, cycle: { unit: 'day', every: 7 } },
  { days: 14, slack: 1, match: 1, cycle: { unit: 'day', every: 14 } },
  { days: 28, slack: 1, match: 1, cycle: { unit: 'day', every: 28 } }, // prepaid mobile
  { days: 30.4, slack: 3.5, match: 2.5, cycle: { unit: 'month', every: 1 } },
  { days: 56, slack: 2, match: 2, cycle: { unit: 'day', every: 56 } },
  { days: 84, slack: 3, match: 3, cycle: { unit: 'day', every: 84 } },
  { days: 91.3, slack: 5, match: 4, cycle: { unit: 'month', every: 3 } },
  { days: 182.6, slack: 8, match: 7, cycle: { unit: 'month', every: 6 } },
  { days: 365, slack: 12, match: 12, cycle: { unit: 'year', every: 1 } },
];

// Median gap -> a cycle, or null. 28 days on the dot is a 28-day plan; a
// monthly plan's median gap is 30-31.
export function cycleFromGap(days: number): Cycle | null {
  return RHYTHMS.find(r => Math.abs(days - r.days) <= r.match)?.cycle ?? null;
}

export interface Found {
  name: string;
  cycle: Cycle;
  price: Paise;         // the latest charge, so a price change is reflected
  lastCharged: Day;
  charges: number;
  active: boolean;      // charged within 1.5 cycles of today
  confidence: number;   // 0-100
  perMonth: Paise;
  alreadyTracked: boolean;
  priceChange: { from: Paise; to: Paise; on: Day } | null; // the latest step in price
  tracked: { id: string; price: Paise } | null;            // the plan you track it as, when its price differs
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(200, 0.1 * Math.max(a, b));

// ---------- is it a subscription? ----------
// A small gradient-boosted model decides, from how regular a series of
// charges is (not what it costs or who it's from). It's trained in
// KunalGITID/atler-ml on synthetic statements, using these same features
// (the benchmark calls this file), and shipped as plain JSON trees.

export const SERIES_FEATURES = ['n', 'medianGap', 'gapIqrRatio', 'gapRegular', 'rhythmDist', 'amountCv',
  'amountSteady', 'amountSteps', 'domSpread', 'spanRatio', 'sinceLastRatio'] as const;

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo]! + (sorted[Math.ceil(pos)]! - sorted[lo]!) * (pos - lo);
};

// `series` is oldest first, 2+ charges.
export function seriesFeatures(series: readonly Debit[], today: Day): number[] {
  const gaps = series.slice(1).map((t, i) => daysBetween(series[i]!.on, t.on));
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const gap = median(gaps);
  const nearest = RHYTHMS.reduce((a, b) => (Math.abs(gap - b.days) < Math.abs(gap - a.days) ? b : a));
  const amounts = series.map(t => t.amount as number);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length);
  const typical = median(amounts);
  const days = series.map(t => Number(t.on.slice(8, 10)));
  const dMean = days.reduce((a, b) => a + b, 0) / days.length;
  const span = daysBetween(series[0]!.on, series[series.length - 1]!.on) || 1;
  return [
    series.length,
    gap,
    gap ? (quantile(sortedGaps, 0.75) - quantile(sortedGaps, 0.25)) / gap : 9,
    gaps.filter(g => Math.abs(g - gap) <= Math.max(2, 0.1 * gap)).length / gaps.length,
    Math.abs(gap - nearest.days) / nearest.days,
    sd / mean,
    amounts.filter(a => Math.abs(a - typical) <= Math.max(200, 0.1 * a)).length / amounts.length,
    amounts.slice(1).filter((a, i) => !close(a, amounts[i]!)).length,
    Math.sqrt(days.reduce((a, b) => a + (b - dMean) ** 2, 0) / days.length),
    span / Math.max(gap, 1) / (series.length - 1),
    daysBetween(series[series.length - 1]!.on, today) / Math.max(gap, 1),
  ];
}

// sklearn GradientBoostingClassifier, exported tree by tree: a node is a leaf
// when its feature is -1; otherwise x[feature] <= threshold goes left.
export interface TreeModel {
  features: readonly string[];
  init: number;
  rate: number;
  trees: Array<{ feature: number[]; threshold: number[]; left: number[]; right: number[]; value: number[] }>;
}

export function treeProbability(model: TreeModel, x: readonly number[]): number {
  let raw = model.init;
  for (const t of model.trees) {
    let node = 0;
    while (t.feature[node]! >= 0) node = x[t.feature[node]!]! <= t.threshold[node]! ? t.left[node]! : t.right[node]!;
    raw += model.rate * t.value[node]!;
  }
  return 1 / (1 + Math.exp(-raw));
}

const model = subscriptionModel as TreeModel;
export const SURE = 0.5;

export interface Candidate { name: string; series: Debit[]; whole: boolean }

// What could be one plan: every merchant's charges, and when they come in
// clearly different amounts, each amount on its own (two plans at one
// merchant). Two charges only count when they're a year apart.
export function recurringCandidates(debits: readonly Debit[]): Candidate[] {
  const groups = new Map<string, Debit[]>();
  for (const d of debits) {
    const name = merchantName(d.description);
    if (name) groups.set(name, [...(groups.get(name) ?? []), d]);
  }
  const out: Candidate[] = [];
  const enough = (s: Debit[]) => s.length >= 3 || (s.length === 2 && Math.abs(daysBetween(s[0]!.on, s[1]!.on) - 365) <= 15);
  for (const [name, txns] of groups) {
    txns.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
    if (enough(txns)) out.push({ name, series: txns, whole: true });
    const buckets = splitByAmount(txns);
    if (buckets.length > 1 || (buckets[0] && buckets[0].length < txns.length)) {
      for (const b of buckets) if (enough(b)) out.push({ name, series: b, whole: false });
    }
  }
  return out;
}

function describe(name: string, series: Debit[], p: number, today: Day): Omit<Found, 'alreadyTracked' | 'tracked'> {
  const gaps = series.slice(1).map((t, i) => daysBetween(series[i]!.on, t.on));
  const gap = median(gaps);
  const rhythm = RHYTHMS.find(r => Math.abs(gap - r.days) <= r.match)
    ?? RHYTHMS.reduce((a, b) => (Math.abs(gap - b.days) < Math.abs(gap - a.days) ? b : a));
  let priceChange: Found['priceChange'] = null;
  for (let i = series.length - 1; i > 0; i--) {
    if (!close(series[i]!.amount, series[i - 1]!.amount)) { priceChange = { from: series[i - 1]!.amount, to: series[i]!.amount, on: series[i]!.on }; break; }
  }
  const last = series[series.length - 1]!;
  const active = daysBetween(last.on, today) <= rhythm.days * 1.5;
  return {
    name,
    cycle: rhythm.cycle,
    price: last.amount,
    lastCharged: last.on,
    charges: series.length,
    active,
    confidence: Math.round(100 * p * (active ? 1 : 0.6)),
    perMonth: monthlyCost(last.amount, rhythm.cycle),
    priceChange,
  };
}

function splitByAmount(txns: Debit[]): Debit[][] {
  const buckets: Debit[][] = [];
  for (const t of txns) {
    const bucket = buckets.find(b => Math.abs(t.amount - median(b.map(x => x.amount))) <= Math.max(200, 0.1 * t.amount));
    if (bucket) bucket.push(t); else buckets.push([t]);
  }
  return buckets.filter(b => b.length > 1);
}

// `existing`: what you already track, as names or plans (with a plan, a
// different detected price is reported so it can be updated).
type Tracked = string | { id: string; name: string; price: Paise };

export function findRecurring(debits: readonly Debit[], today: Day, existing: readonly Tracked[] = []): Found[] {
  const tracked = existing.map(t => (typeof t === 'string' ? { name: t.toLowerCase(), plan: null } : { name: t.name.toLowerCase(), plan: t }));
  const byMerchant = new Map<string, Array<Candidate & { p: number }>>();
  for (const c of recurringCandidates(debits)) {
    const scored = { ...c, p: treeProbability(model, seriesFeatures(c.series, today)) };
    byMerchant.set(c.name, [...(byMerchant.get(c.name) ?? []), scored]);
  }
  const found: Found[] = [];
  for (const [name, cands] of byMerchant) {
    // Usually all of a merchant's charges are one plan (allowing a price
    // change). If the model doesn't think so, try each amount on its own.
    const whole = cands.find(c => c.whole && c.p >= SURE);
    const picked = whole ? [whole] : cands.filter(c => !c.whole && c.p >= SURE);
    const match = tracked.find(t => t.name.includes(name.toLowerCase()) || name.toLowerCase().includes(t.name));
    for (const c of picked) {
      const r = describe(name, c.series, c.p, today);
      const plan = match?.plan;
      found.push({ ...r, alreadyTracked: !!match, tracked: plan && r.active && !close(plan.price, r.price) ? { id: plan.id, price: plan.price } : null });
    }
  }
  return found.sort((a, b) => b.confidence - a.confidence || b.perMonth - a.perMonth);
}
