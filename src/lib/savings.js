// Money not spent because a plan was cancelled: every renewal that would have
// been charged after the cancellation date, up to today.
import { getMonthlyCost, getRenewalDatesUntil, normalizeDateOnly } from './dates.js';

export function savingsFor(sub, today = new Date()) {
    if (!sub.cancelledOn) return null;
    const cancelled = normalizeDateOnly(sub.cancelledOn);
    const skipped = getRenewalDatesUntil(sub.startDate || sub.dateAdded, sub.cycle, normalizeDateOnly(today))
        .filter(d => d > cancelled);
    const price = parseFloat(sub.price);
    return {
        sub,
        skippedRenewals: skipped.length,
        saved: skipped.length * price,
        perYear: getMonthlyCost(sub) * 12,
    };
}

export function savingsSummary(subs, today = new Date()) {
    const items = subs.map(s => savingsFor(s, today)).filter(Boolean)
        .sort((a, b) => b.saved - a.saved || b.perYear - a.perYear);
    return {
        items,
        saved: items.reduce((sum, i) => sum + i.saved, 0),
        perYear: items.reduce((sum, i) => sum + i.perYear, 0),
    };
}
