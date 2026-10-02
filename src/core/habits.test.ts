import { describe, expect, it } from 'vitest';
import { addDays, parseDay, type Day } from './dates.ts';
import { habits } from './habits.ts';
import { paise } from './money.ts';
import type { Category, Payment, Plan } from './model.ts';
import { monthSummary } from './summary.ts';

const d = (s: string) => parseDay(s) as Day;
let n = 0;
const pay = (on: Day, rupees: number, name = 'Groceries', categoryId: string | null = null): Payment =>
  ({ id: `p${++n}`, name, amount: paise(rupees * 100), on, categoryId, source: 'manual' });

describe('habits', () => {
  const today = d('2026-10-20'); // a Tuesday
  it('weekend-heavy spending and a merchant you keep going back to', () => {
    const ps: Payment[] = [];
    for (let i = 0; i < 80; i++) {
      const day = addDays(today, -i);
      const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (wd === 0 || wd === 6) ps.push(pay(day, 2000));
      else if (i % 3 === 0) ps.push(pay(day, 200));
    }
    for (let i = 0; i < 5; i++) ps.push(pay(addDays(today, -i * 5), 800, 'SWIGGY ORDER'));
    const h = habits(ps, [], today);
    expect(h.map(x => x.id)).toEqual(expect.arrayContaining(['weekend', 'merchant']));
    expect(h.find(x => x.id === 'merchant')!.title).toBe('Swiggy: 5 times in 30 days');
  });
  it('a category well above its usual pace', () => {
    const food: Category[] = [{ id: 'food', name: 'Food', budget: null }];
    const ps = [...Array.from({ length: 30 }, (_, i) => pay(addDays(d('2026-09-30'), -i * 3), 300, 'Lunch', 'food')),
      pay(d('2026-10-03'), 4000, 'Party', 'food'), pay(d('2026-10-10'), 3000, 'Dinner', 'food')];
    expect(habits(ps, food, today).map(x => x.title)).toContain('Food is running 250% above usual');
  });
  it('quiet with too little data', () => expect(habits([pay(today, 100)], [], today)).toEqual([]));
});

describe('monthSummary', () => {
  const plan: Plan = { id: 'nf', name: 'Netflix', price: paise(64900), cycle: { unit: 'month', every: 1 }, anchor: d('2026-07-12'), categoryId: null, status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-07-01') };
  const ps = [pay(d('2026-08-10'), 5000), pay(d('2026-09-03'), 8000, 'Flight'), pay(d('2026-09-15'), 2000)];
  it('last month in a few lines during the first week', () => {
    const s = monthSummary(d('2026-10-03'), [plan], [], ps, [])!;
    expect(s.month).toBe('2026-09-01');
    expect(s.total).toBe(1000000 + 64900);
    expect(s.change).toBe(500000);
    expect(s.lines).toEqual(['Most went on Uncategorised: ₹10,649 (100%).', 'Biggest single expense: Flight, ₹8,000.', '2 expenses logged.']);
    expect(s.tip).toMatch(/^Spending rose ₹5,000/);
  });
  it('not after the first week', () => expect(monthSummary(d('2026-10-08'), [plan], [], ps, [])).toBeNull());
});
