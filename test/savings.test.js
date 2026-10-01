import { describe, expect, it } from 'vitest';
import { savingsFor, savingsSummary } from '../src/lib/savings.js';

const today = new Date(2026, 9, 15);
const sub = o => ({ name: 'Hotstar', price: '299', cycle: 'Monthly', startDate: '2026-01-10', dateAdded: '2026-01-10', ...o });

describe('savings', () => {
    it('counts renewals skipped since cancelling', () => {
        // Cancelled 1 Jul: Jul 10, Aug 10, Sep 10, Oct 10 not paid.
        expect(savingsFor(sub({ cancelledOn: '2026-07-01' }), today)).toMatchObject({ skippedRenewals: 4, saved: 1196, perYear: 3588 });
    });

    it('cancelling on the renewal day itself still pays that one', () => {
        expect(savingsFor(sub({ cancelledOn: '2026-10-10' }), today).skippedRenewals).toBe(0);
    });

    it('ignores plans that are not cancelled and totals the rest', () => {
        const summary = savingsSummary([
            sub({ cancelledOn: '2026-07-01' }),
            sub({ name: 'Gym', price: '1200', cycle: 'Yearly', startDate: '2025-03-01', cancelledOn: '2026-02-01' }),
            sub({ name: 'Netflix' }),
        ], today);
        expect(summary.items.map(i => [i.sub.name, i.saved])).toEqual([['Hotstar', 1196], ['Gym', 1200]].sort((a, b) => b[1] - a[1]));
        expect(summary.saved).toBe(2396);
        expect(summary.perYear).toBeCloseTo(3588 + 1200);
    });
});
