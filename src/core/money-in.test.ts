import { describe, expect, it } from 'vitest';
import { parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Income, Payment, Plan, PlanEvent } from './model.ts';
import { billsToPay, evenSplit, goalView, incomeBetween, monthMoney, owedByPerson } from './money-in.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount } from './share.ts';

const d = (s: string) => parseDay(s) as Day;
const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'p', name: 'Rent', price: paise(2500000), cycle: { unit: 'month', every: 1 }, anchor: d('2026-08-05'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-08-05'), ...over,
});

describe('billsToPay', () => {
  const rent = plan({ autopay: false, kind: 'rent' });
  it('lists unpaid charges of hand-paid plans, overdue first', () => {
    const due = billsToPay([rent], [], d('2026-10-02'));
    expect(due.map(x => [x.on, x.overdue])).toEqual([['2026-09-05', true], ['2026-10-05', false]]);
  });
  it('drops ones marked paid, and ignores autopay plans', () => {
    const paid: PlanEvent = { id: 'e', planId: 'p', on: d('2026-09-05'), at: 1, kind: 'paid' };
    expect(billsToPay([rent], [paid], d('2026-10-02')).map(x => x.on)).toEqual(['2026-10-05']);
    expect(billsToPay([plan()], [], d('2026-10-02'))).toEqual([]);
  });
});

describe('plan extras in renewals', () => {
  it('an EMI stops after its last charge; a shared plan costs your share', () => {
    const emi = plan({ endsOn: d('2026-10-05') });
    expect(renewalsBetween(emi, [], d('2026-08-01'), d('2027-01-31')).map(r => r.on)).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
    const family = plan({ price: paise(64900), sharedBy: 4 });
    expect(renewalsBetween(family, [], d('2026-09-01'), d('2026-09-30'))[0]!.amount).toBe(16225);
  });
});

describe('income', () => {
  const salary: Income = { id: 's', name: 'Salary', amount: paise(9000000), on: d('2026-01-31'), repeat: 'monthly' };
  const bonus: Income = { id: 'b', name: 'Bonus', amount: paise(2000000), on: d('2026-10-15'), repeat: 'none' };
  it('repeats monthly on its day, clamped in short months', () => {
    expect(incomeBetween([salary], d('2026-02-01'), d('2026-04-30')).map(i => i.on)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('what is left this month and the savings rate', () => {
    const coffee: Payment = { id: 'c', name: 'Coffee', amount: paise(50000), on: d('2026-10-01'), categoryId: null, source: 'manual' };
    const m = monthMoney(d('2026-10-20'), [salary, bonus], [plan()], [], [coffee]);
    expect(m.income).toBe(11000000);
    expect(m.received).toBe(2000000); // salary comes on the 31st
    expect(m.spent).toBe(2550000);    // rent on the 5th + coffee
    expect(m.left).toBe(11000000 - 2550000);
    expect(m.savingsRate).toBeCloseTo(0.768, 3);
  });
});

describe('goals', () => {
  it('how much to save each month to make it', () => {
    const g = goalView({ id: 'g', name: 'Laptop', target: paise(9000000), saved: paise(3000000), by: d('2027-04-01') }, d('2026-10-01'));
    expect(g.monthsLeft).toBe(6);
    expect(g.perMonth).toBe(1000000);
    expect(g.done).toBeCloseTo(1 / 3);
  });
});

describe('splits', () => {
  const dinner: Payment = {
    id: 'd', name: 'Dinner', amount: paise(300000), on: d('2026-10-01'), categoryId: null, source: 'manual',
    split: [{ who: 'Asha', amount: paise(100000), settled: false }, { who: 'Ravi', amount: paise(100000), settled: true }],
  };
  const cab: Payment = { id: 'c', name: 'Cab', amount: paise(60000), on: d('2026-10-02'), categoryId: null, source: 'manual', split: [{ who: 'asha ', amount: paise(30000), settled: false }] };
  it('your part of a split expense', () => expect(ownAmount(dinner)).toBe(100000));
  it('who owes you, one line per person', () => {
    expect(owedByPerson([dinner, cab]).map(o => [o.who, o.amount, o.payments.length])).toEqual([['Asha', 130000, 2]]);
  });
  it('even split keeps odd paise with you', () => {
    expect(evenSplit(paise(100001), ['A', 'B'])).toEqual([{ who: 'A', amount: 33333 }, { who: 'B', amount: 33333 }]);
  });
});
