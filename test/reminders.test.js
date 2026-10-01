import { describe, expect, it } from 'vitest';
import { dueReminders, reminderMessage } from '../src/lib/reminders.js';

const sub = overrides => ({
    id: 's1', name: 'Netflix', price: '199', cycle: 'Monthly', startDate: '2026-01-10',
    dateAdded: '2026-01-10', reminder: 'both', paused: false, ...overrides,
});
const day = (y, m, d) => new Date(y, m - 1, d);

describe('dueReminders', () => {
    it('fires 3 days and 1 day before the next renewal', () => {
        expect(dueReminders([sub()], day(2026, 10, 7)).map(r => [r.renewalDate, r.daysBefore])).toEqual([['2026-10-10', 3]]);
        expect(dueReminders([sub()], day(2026, 10, 9)).map(r => [r.renewalDate, r.daysBefore])).toEqual([['2026-10-10', 1]]);
        expect(dueReminders([sub()], day(2026, 10, 8))).toEqual([]);
    });

    it('respects the chosen timing', () => {
        expect(dueReminders([sub({ reminder: '1day' })], day(2026, 10, 7))).toEqual([]);
        expect(dueReminders([sub({ reminder: '3days' })], day(2026, 10, 7))).toHaveLength(1);
        expect(dueReminders([sub({ reminder: 'none' })], day(2026, 10, 9))).toEqual([]);
    });

    it('skips paused plans', () => {
        expect(dueReminders([sub({ paused: true })], day(2026, 10, 9))).toEqual([]);
    });

    it('counts across a month boundary and month-end clamping', () => {
        const endOfMonth = sub({ startDate: '2026-01-31' });
        // Next renewal after 26 Feb is 28 Feb (clamped), 2 days away; after 27 Feb it is 1 day.
        expect(dueReminders([endOfMonth], day(2026, 2, 27)).map(r => r.renewalDate)).toEqual(['2026-02-28']);
        expect(dueReminders([endOfMonth], day(2026, 3, 28)).map(r => [r.renewalDate, r.daysBefore])).toEqual([['2026-03-31', 3]]);
    });
});

describe('reminderMessage', () => {
    it('says when and how much', () => {
        expect(reminderMessage({ sub: sub(), renewalDate: '2026-10-10', daysBefore: 1 })).toEqual({
            title: 'Netflix renews tomorrow',
            body: '₹199.00 on 10 Oct',
            tag: 'renewal-s1-2026-10-10-1',
        });
        expect(reminderMessage({ sub: sub(), renewalDate: '2026-10-10', daysBefore: 3 }).title).toBe('Netflix renews in 3 days');
    });
});
