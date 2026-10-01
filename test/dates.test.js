import { describe, expect, it } from 'vitest';
import {
    addBillingCycle,
    getLastRenewalDate,
    getLocalDateKey,
    getMonthlyCost,
    getNextRenewalDate,
    getRenewalDatesUntil,
    getUnloggedRenewals,
    isWithinRange,
    parseDateValue,
} from '../src/lib/dates.js';

const keys = dates => dates.map(getLocalDateKey);
const day = (y, m, d) => new Date(y, m - 1, d);

describe('parseDateValue', () => {
    it('reads YYYY-MM-DD as a local date, not UTC midnight', () => {
        expect(getLocalDateKey(parseDateValue('2026-03-01'))).toBe('2026-03-01');
    });

    it('uses the date part of a timestamp', () => {
        expect(getLocalDateKey(parseDateValue('2026-03-01T23:30:00+00:00'))).toBe('2026-03-01');
    });
});

describe('addBillingCycle', () => {
    it('clamps month-end to the last day of shorter months', () => {
        expect(getLocalDateKey(addBillingCycle('2026-01-31', 'Monthly'))).toBe('2026-02-28');
    });

    it('moves Feb 29 to Feb 28 in a non-leap year', () => {
        expect(getLocalDateKey(addBillingCycle('2024-02-29', 'Yearly'))).toBe('2025-02-28');
    });

    it('treats a numeric cycle as a number of days', () => {
        expect(getLocalDateKey(addBillingCycle('2026-12-20', '14'))).toBe('2027-01-03');
    });

    it('falls back to 30 days for a nonsense cycle', () => {
        expect(getLocalDateKey(addBillingCycle('2026-01-01', 'abc'))).toBe('2026-01-31');
    });
});

describe('renewal schedule', () => {
    it('returns to the 31st after a short month instead of drifting', () => {
        expect(keys(getRenewalDatesUntil('2026-01-31', 'Monthly', day(2026, 5, 31)))).toEqual([
            '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31',
        ]);
    });

    it('lands back on Feb 29 in the next leap year', () => {
        expect(keys(getRenewalDatesUntil('2024-02-29', 'Yearly', day(2028, 3, 1)))).toEqual([
            '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29',
        ]);
    });

    it('caps the number of dates', () => {
        expect(getRenewalDatesUntil('2000-01-01', '1', day(2026, 1, 1), 50)).toHaveLength(50);
    });

    it('next renewal is strictly after today', () => {
        expect(getLocalDateKey(getNextRenewalDate('2026-01-31', 'Monthly', day(2026, 3, 31)))).toBe('2026-04-30');
    });

    it('last renewal includes today', () => {
        expect(getLocalDateKey(getLastRenewalDate('2026-01-31', 'Monthly', day(2026, 3, 31)))).toBe('2026-03-31');
        expect(getLocalDateKey(getLastRenewalDate('2026-01-31', 'Monthly', day(2026, 3, 30)))).toBe('2026-02-28');
    });
});

describe('getUnloggedRenewals', () => {
    const sub = { cycle: 'Monthly', startDate: '2026-01-10', dateAdded: '2026-01-10T08:00:00+00:00', lastLoggedRenewal: '2026-02-10' };

    it('backfills every month the app was not opened', () => {
        expect(keys(getUnloggedRenewals(sub, day(2026, 5, 15)))).toEqual(['2026-03-10', '2026-04-10', '2026-05-10']);
    });

    it('returns nothing when already up to date', () => {
        expect(getUnloggedRenewals({ ...sub, lastLoggedRenewal: '2026-05-10' }, day(2026, 5, 15))).toEqual([]);
    });

    it('never logs renewals from before the subscription was added', () => {
        const old = { cycle: 'Monthly', startDate: '2025-06-05', dateAdded: '2026-03-01', lastLoggedRenewal: null };
        expect(keys(getUnloggedRenewals(old, day(2026, 4, 20)))).toEqual(['2026-03-05', '2026-04-05']);
    });

    it('logs the start date itself on the day it is added', () => {
        const fresh = { cycle: 'Yearly', startDate: '2026-04-20', dateAdded: '2026-04-20', lastLoggedRenewal: null };
        expect(keys(getUnloggedRenewals(fresh, day(2026, 4, 20)))).toEqual(['2026-04-20']);
    });
});

describe('getMonthlyCost', () => {
    it.each([
        [{ cycle: 'Monthly', price: '199' }, 199],
        [{ cycle: 'Yearly', price: '1200' }, 100],
        [{ cycle: '15', price: '50' }, 100],
        [{ cycle: '0', price: '50' }, 50],
    ])('%o costs %d a month', (sub, expected) => {
        expect(getMonthlyCost(sub)).toBeCloseTo(expected);
    });
});

describe('isWithinRange', () => {
    const now = new Date(2026, 9, 15, 12);

    it('month means the current calendar month', () => {
        expect(isWithinRange('2026-10-01', 'month', now)).toBe(true);
        expect(isWithinRange('2026-09-30', 'month', now)).toBe(false);
    });

    it('30d covers today and the 29 days before it', () => {
        expect(isWithinRange('2026-09-16', '30d', now)).toBe(true);
        expect(isWithinRange('2026-09-15', '30d', now)).toBe(false);
    });

    it('year means the current calendar year', () => {
        expect(isWithinRange('2026-01-01', 'year', now)).toBe(true);
        expect(isWithinRange('2025-12-31', 'year', now)).toBe(false);
    });
});
