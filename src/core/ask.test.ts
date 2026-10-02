import { describe, expect, it } from 'vitest';
import { ask, periodOf, type AskData } from './ask.ts';
import { parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan } from './model.ts';

const d = (s: string) => parseDay(s) as Day;
const today = d('2026-10-15');
let n = 0;
const pay = (name: string, rupees: number, on: string, o: Partial<Payment> = {}): Payment =>
  ({ id: `p${++n}`, name, amount: paise(rupees * 100), on: d(on), categoryId: null, source: 'manual', ...o });
const plan = (name: string, rupees: number, o: Partial<Plan> = {}): Plan => ({
  id: name, name, price: paise(rupees * 100), cycle: { unit: 'month', every: 1 }, anchor: d('2026-01-05'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01'), ...o,
});
const data: AskData = {
  categories: [{ id: 'food', name: 'Food', budget: null }],
  plans: [plan('Netflix', 649, { categoryId: null }), plan('Spotify', 119)],
  events: [],
  payments: [
    pay('Swiggy dinner', 450, '2026-09-12', { categoryId: 'food' }), pay('SWIGGY*BLR', 300, '2026-09-20', { categoryId: 'food' }),
    pay('Groceries', 2000, '2026-10-03', { categoryId: 'food' }), pay('Flight to Goa', 6000, '2026-08-01', { tags: ['goa'] }),
    pay('Dinner', 3000, '2026-10-10', { split: [{ who: 'Asha', amount: paise(100000), settled: false }] }),
  ],
  incomes: [{ id: 'i', name: 'Salary', amount: paise(80000 * 100), on: d('2026-01-01'), repeat: 'monthly' }],
};

describe('periodOf', () => {
  it.each([
    ['spent last month', '2026-09-01', '2026-09-30'], ['in march', '2026-03-01', '2026-03-31'], ['in december', '2025-12-01', '2025-12-31'],
    ['this year', '2026-01-01', '2026-10-15'], ['last 7 days', '2026-10-09', '2026-10-15'], ['anything', '2026-10-01', '2026-10-15'],
    ['aug 2025', '2025-08-01', '2025-08-31'],
  ])('%s', (q, from, to) => expect(periodOf(q, today)).toMatchObject({ from, to }));
});

describe('ask', () => {
  it('spent on a merchant or category in a period', () => {
    expect(ask('How much did I spend on Swiggy last month?', data, today).text).toBe('You spent ₹750 on Swiggy in September 2026 (2 payments).');
    expect(ask('how much on food this month', data, today).text).toBe('You spent ₹2,000 on Food this month (1 payment).');
    expect(ask('how many times swiggy last month', data, today).text).toBe('Swiggy: 2 times in September 2026, ₹750 in all.');
    expect(ask('spent on food this month', data, today).text).toBe('You spent ₹2,000 on Food this month (1 payment).');
    expect(ask('spent on goa this year', data, today).text).toBe('You spent ₹6,000 on Goa this year (1 payment).');
  });
  it('what cancelling keeps', () => {
    expect(ask('What if I cancel Netflix?', data, today).text).toBe('Cancelling Netflix keeps ₹7,788 a year (₹649 a month).');
  });
  it('totals count only your share of split expenses', () => {
    expect(ask('total spent this month', data, today).text).toBe('You spent ₹4,768 this month: ₹768 on plans and ₹4,000 on everyday expenses.');
  });
  it('who owes you', () => expect(ask('Who owes me?', data, today).text).toBe('Asha owes you ₹1,000.'));
  it('plans and income', () => {
    expect(ask('How much do my subscriptions cost?', data, today).text).toBe('Your plans cost ₹768 a month, ₹9,216 a year.');
    expect(ask('income last month', data, today).text).toMatch(/^Income in September 2026: ₹80,000\. ₹1,518 went out, so ₹78,482 was left \(98% saved\)\.$/);
  });
  it('biggest expense and where it went', () => {
    expect(ask('biggest expense this year', data, today).text).toBe('Your biggest expense this year was Flight to Goa: ₹6,000 on 2026-08-01.');
    expect(ask('where did my money go last month', data, today).text).toBe('₹1,518 in September 2026, most of it on Uncategorised.');
  });
  it('helps when it cannot tell', () => {
    expect(ask('hello there', data, today).lines!.length).toBeGreaterThan(3);
  });
});
