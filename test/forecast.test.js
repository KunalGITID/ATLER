import { describe, expect, it } from 'vitest';
import { forecastNextMonth, manualMonthlyTotals, renewalsBetween } from '../src/lib/forecast.js';

const today = new Date(2026, 9, 15); // 15 Oct 2026 -> forecast November
const sub = o => ({ id: 'x', name: 'x', price: '100', cycle: 'Monthly', startDate: '2026-01-10', dateAdded: '2026-01-10', paused: false, ...o });
const exp = (date, amount, type = 'manual') => ({ date, amount, type });

describe('renewalsBetween', () => {
    it('counts each renewal inside the window, including weekly-ish plans twice or more', () => {
        const items = renewalsBetween(
            [sub({ name: 'Monthly' }), sub({ name: 'Every 14 days', cycle: '14', startDate: '2026-10-25' }), sub({ name: 'Paused', paused: true })],
            new Date(2026, 10, 1), new Date(2026, 10, 30),
        );
        expect(items.map(i => [i.sub.name, i.date.getDate()])).toEqual([['Monthly', 10], ['Every 14 days', 8], ['Every 14 days', 22]]);
    });

    it('a yearly plan only counts in its renewal month', () => {
        expect(renewalsBetween([sub({ cycle: 'Yearly', startDate: '2025-11-20' })], new Date(2026, 10, 1), new Date(2026, 10, 30))).toHaveLength(1);
        expect(renewalsBetween([sub({ cycle: 'Yearly', startDate: '2025-12-20' })], new Date(2026, 10, 1), new Date(2026, 10, 30))).toHaveLength(0);
    });
});

describe('manualMonthlyTotals', () => {
    it('sums complete months, counts quiet months as zero, ignores auto renewals and the current month', () => {
        const totals = manualMonthlyTotals([
            exp('2026-07-03', 500), exp('2026-07-20', 250),
            exp('2026-09-09', 1000),
            exp('2026-09-10', 199, 'auto'),
            exp('2026-10-02', 9999),
        ], today);
        expect(totals).toEqual([
            { month: '2026-07', total: 750 },
            { month: '2026-08', total: 0 },
            { month: '2026-09', total: 1000 },
        ]);
    });

    it('looks back at most six months', () => {
        expect(manualMonthlyTotals([exp('2025-01-01', 10)], today)).toHaveLength(6);
    });

    it('is empty with no manual expenses', () => {
        expect(manualMonthlyTotals([exp('2026-09-10', 199, 'auto')], today)).toEqual([]);
    });
});

describe('forecastNextMonth', () => {
    it('adds the known renewals to the everyday estimate and its range', () => {
        const f = forecastNextMonth(
            [sub({ price: '199' }), sub({ price: '1499', cycle: 'Yearly', startDate: '2025-11-05' })],
            [exp('2026-08-03', 2000), exp('2026-09-03', 3000), exp('2026-10-01', 50)],
            today,
        );
        expect(f.month).toEqual(new Date(2026, 10, 1));
        expect(f.fixed).toBe(1698);
        expect(f.everyday).toEqual({ estimate: 2500, low: 2000, high: 3000, months: 2 });
        expect([f.low, f.estimate, f.high]).toEqual([3698, 4198, 4698]);
    });

    it('with no history the forecast is just the renewals', () => {
        const f = forecastNextMonth([sub()], [], today);
        expect([f.low, f.estimate, f.high, f.everyday.months]).toEqual([100, 100, 100, 0]);
    });
});
