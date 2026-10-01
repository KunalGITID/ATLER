// Flags an everyday expense that is far above what you usually spend in the
// same category (or at the same merchant when it's Unlisted). Robust stats on
// purpose: medians and the interquartile range aren't dragged around by the
// very outliers we're looking for, and they work with a handful of points.
import { normalizeDateOnly, parseDateValue } from './dates.js';

export const MIN_HISTORY = 5;
export const MIN_AMOUNT = 200;

function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const groupKey = exp => (exp.category && exp.category !== 'unlisted'
    ? `cat:${exp.category}`
    : `name:${String(exp.name).trim().toLowerCase()}`);

// `history` = the user's other expenses. Returns null, or how unusual it is.
export function unusualness(exp, history) {
    if (exp.type === 'auto') return null;
    const amount = parseFloat(exp.amount);
    if (!(amount >= MIN_AMOUNT)) return null;
    const key = groupKey(exp);
    const past = history
        .filter(h => h.id !== exp.id && h.type !== 'auto' && groupKey(h) === key)
        .map(h => parseFloat(h.amount))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    if (past.length < MIN_HISTORY) return null;
    const median = quantile(past, 0.5);
    const q1 = quantile(past, 0.25);
    const q3 = quantile(past, 0.75);
    const fence = q3 + 1.5 * (q3 - q1);
    if (amount <= fence || amount < 2 * median) return null;
    return { median, fence, ratio: amount / median, compared: past.length };
}

// Unusual expenses from the last `days` days, most unusual first. Each is
// judged against everything before it, as it would have been when logged.
export function recentUnusual(expenses, today = new Date(), days = 7) {
    const cutoff = normalizeDateOnly(today);
    cutoff.setDate(cutoff.getDate() - days);
    return expenses
        .filter(e => e.type !== 'auto' && parseDateValue(e.date) > cutoff)
        .map(e => ({ exp: e, result: unusualness(e, expenses.filter(h => parseDateValue(h.date) <= parseDateValue(e.date))) }))
        .filter(x => x.result)
        .sort((a, b) => b.result.ratio - a.result.ratio);
}
