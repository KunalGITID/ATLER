// Your answers to unusual-spend alerts ("Expected" / "Not expected"), and what
// ATLER learns from them. They stay on this phone.
//
// Your bar ("alert when it's at least N times your usual") starts at 2x.
// After 4+ answers it moves to just above the jumps you've called expected
// (their 90th percentile), halfway (geometrically) to the next one you
// called not expected, or 10% above if there isn't one. A place you've
// called expected also gets its own bar 25% above that jump. Bars only go
// up from 2x. Tuned and measured in KunalGITID/atler-ml (feedback.py): on
// synthetic statements, people who answer most alerts see ~80% of them be
// real by their third quarter, against 16% with no answers.

export interface Verdict {
  paymentId: string;
  merchant: string;   // insights.merchantOf
  times: number;      // how many times the usual it was when shown
  expected: boolean;  // true = "Expected", false = "Not expected"
  at: number;         // when answered (ms)
}

export const DEFAULT_BAR = 2;
const MIN_ANSWERS = 4;

function quantile(sorted: readonly number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo]! + (sorted[Math.ceil(pos)]! - sorted[lo]!) * (pos - lo);
}

export interface Bars { user: number; merchants: Map<string, number> }

export function learnBars(verdicts: readonly Verdict[]): Bars {
  let user = DEFAULT_BAR;
  const fine = verdicts.filter(v => v.expected).map(v => v.times).sort((a, b) => a - b);
  if (verdicts.length >= MIN_ANSWERS && fine.length) {
    const high = quantile(fine, 0.9);
    const next = verdicts.filter(v => !v.expected && v.times > high).map(v => v.times).sort((a, b) => a - b)[0];
    user = Math.max(DEFAULT_BAR, next ? Math.sqrt(high * next) : high * 1.1);
  }
  const merchants = new Map<string, number>();
  const byMerchant = new Map<string, Verdict[]>();
  for (const v of verdicts) byMerchant.set(v.merchant, [...(byMerchant.get(v.merchant) ?? []), v]);
  for (const [m, vs] of byMerchant) {
    const ok = vs.filter(v => v.expected).map(v => v.times);
    if (!ok.length) continue;
    const real = vs.filter(v => !v.expected && v.times > DEFAULT_BAR).map(v => v.times);
    const bar = Math.min(1.25 * Math.max(...ok), ...real);
    if (bar > user) merchants.set(m, bar);
  }
  return { user, merchants };
}

export const barFor = (bars: Bars | undefined, merchant: string) =>
  Math.max(bars?.user ?? DEFAULT_BAR, bars?.merchants.get(merchant) ?? 0);

// How ATLER's alerts have done by your own account.
export function alertTrackRecord(verdicts: readonly Verdict[]) {
  if (!verdicts.length) return null;
  const real = verdicts.filter(v => !v.expected).length;
  return { answered: verdicts.length, real, precision: real / verdicts.length };
}
