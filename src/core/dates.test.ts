import { describe, expect, it } from 'vitest';
import { cycleProgress, datesUntil, daysInMonth, describeCycle, MONTHLY, monthlyCost, nextDate, parseDay, today, YEARLY, type Day } from './dates.ts';
import { paise } from './money.ts';

const d = (s: string) => parseDay(s) as Day;

describe('parseDay', () => {
  it('accepts real calendar days only', () => {
    expect(parseDay('2028-02-29')).toBe('2028-02-29');
    expect(parseDay('2026-02-29')).toBeNull();
    expect(parseDay('2026-10-05T23:30:00Z')).toBe('2026-10-05');
    expect(parseDay('05/10/2026')).toBeNull();
  });

  it("today is the device's local date", () => {
    expect(today(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18');
  });
});

describe('billing dates', () => {
  it('month-end plans return to the 31st after a short month', () => {
    expect(datesUntil(d('2026-01-31'), MONTHLY, d('2026-05-31'))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('a Feb 29 yearly plan lands on Feb 28, then Feb 29 in a leap year', () => {
    expect(datesUntil(d('2024-02-29'), YEARLY, d('2028-03-01'))).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('28-day and quarterly cycles', () => {
    expect(datesUntil(d('2026-09-01'), { unit: 'day', every: 28 }, d('2026-11-30'))).toEqual(['2026-09-01', '2026-09-29', '2026-10-27', '2026-11-24']);
    expect(datesUntil(d('2026-01-15'), { unit: 'month', every: 3 }, d('2026-12-31'))).toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
  });

  it('next date is strictly after the given day; a future anchor is its own next date', () => {
    expect(nextDate(d('2026-01-31'), MONTHLY, d('2026-03-31'))).toBe('2026-04-30');
    expect(nextDate(d('2026-12-01'), MONTHLY, d('2026-10-18'))).toBe('2026-12-01');
  });

  it('works the same in any time zone', () => {
    // Pure string/UTC maths: no Date in local time is involved.
    expect(datesUntil(d('2026-03-29'), { unit: 'day', every: 1 }, d('2026-03-31'))).toEqual(['2026-03-29', '2026-03-30', '2026-03-31']);
    expect(daysInMonth(d('2026-02-10'))).toBe(28);
  });
});

describe('cycleProgress (the countdown ring)', () => {
  it('reports days left in the current cycle and how far through it is', () => {
    const p = cycleProgress(d('2026-01-19'), MONTHLY, d('2026-10-18'));
    expect(p).toMatchObject({ start: '2026-09-19', end: '2026-10-19', total: 30, left: 1 });
    expect(p.done).toBeCloseTo(29 / 30);
  });
});

describe('monthlyCost', () => {
  it.each([
    [paise(19900), MONTHLY, 19900],
    [paise(149900), YEARLY, 12492],
    [paise(34900), { unit: 'day', every: 28 } as const, 37938],
    [paise(30000), { unit: 'month', every: 3 } as const, 10000],
  ])('%i paise %o -> %i a month', (price, cycle, expected) => {
    expect(monthlyCost(price, cycle)).toBe(expected);
  });

  it('describes cycles in words', () => {
    expect([MONTHLY, YEARLY, { unit: 'month', every: 3 }, { unit: 'day', every: 28 }, { unit: 'day', every: 7 }].map(c => describeCycle(c as never)))
      .toEqual(['Monthly', 'Yearly', 'Quarterly', 'Every 28 days', 'Weekly']);
  });
});
