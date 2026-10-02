import { describe, expect, it } from 'vitest';
import { MONTHLY, YEARLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { everydayByMonth, forecastAccuracy, forecastNextMonth, keptByCancelling, recentUnusual, seasonality, unusualness } from './insights.ts';

const d = (s: string) => parseDay(s) as Day;
const today = d('2026-10-15');
const plan = (o: Partial<Plan>): Plan => ({
  id: o.name ?? 'p', name: 'Plan', price: paise(10000), cycle: MONTHLY, anchor: d('2026-01-10'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01'), ...o,
});
let n = 0;
const pay = (on: string, rupees: number, o: Partial<Payment> = {}): Payment => ({ id: `p${++n}`, name: 'x', amount: paise(rupees * 100), on: d(on), categoryId: null, source: 'manual', ...o });

describe('forecast', () => {
  it('everyday totals per complete month, quiet months as 0, none before the first expense, max six', () => {
    expect(everydayByMonth([pay('2026-07-03', 500), pay('2026-07-20', 250), pay('2026-09-09', 1000), pay('2026-10-02', 9999)], today))
      .toEqual([75000, 0, 100000]);
    expect(everydayByMonth([pay('2025-01-01', 10)], today)).toHaveLength(6);
    expect(everydayByMonth([], today)).toEqual([]);
  });

  it('renewals next month are exact; everyday is the average with the lowest..highest month as the range', () => {
    const f = forecastNextMonth(
      [plan({ name: 'Netflix', price: paise(19900) }), plan({ name: 'Prime', price: paise(149900), cycle: YEARLY, anchor: d('2025-11-05') }), plan({ name: 'Off', status: 'cancelled' })],
      [{ id: 'c', planId: 'Off', on: d('2026-01-01'), at: 1, kind: 'cancelled' }],
      [pay('2026-08-03', 2000), pay('2026-09-03', 3000)],
      today,
    )!;
    expect(f.month).toBe('2026-11-01');
    expect(f.renewals.map(r => r.name)).toEqual(['Prime', 'Netflix']);
    expect(f.fixed).toBe(169800);
    expect(f.everyday).toEqual({ estimate: 250000, low: 200000, high: 300000, months: 2, seasonal: null });
    expect([f.low, f.estimate, f.high]).toEqual([369800, 419800, 469800]);
  });

  it('nothing to say -> null', () => {
    expect(forecastNextMonth([], [], [], today)).toBeNull();
  });
});

describe('unusual spending', () => {
  const swiggy = (on: string, r: number, name = 'Swiggy') => pay(on, r, { categoryId: 'food', name });
  const usual = [swiggy('2026-09-01', 180), swiggy('2026-09-03', 250), swiggy('2026-09-05', 220), swiggy('2026-09-07', 300), swiggy('2026-09-09', 260), swiggy('2026-09-11', 210)];

  it('flags a spend far above the usual at the same place', () => {
    const u = unusualness(swiggy('2026-10-14', 1400, 'SWIGGY*BLR 8823'), usual)!;
    expect(u.compared).toBe(6);
    expect(u.median).toBe(23500);
    expect(u.times).toBeCloseTo(5.96, 1);
  });

  it('leaves normal and mildly high spends alone; needs history and ₹200', () => {
    expect(unusualness(swiggy('2026-10-14', 320), usual)).toBeNull();
    expect(unusualness(swiggy('2026-10-14', 400), usual)).toBeNull(); // above the fence but < 2x median
    expect(unusualness(swiggy('2026-10-14', 5000), usual.slice(0, 4))).toBeNull();
    const tea = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].map(on => pay(on, 20, { name: 'Tea' }));
    expect(unusualness(pay('2026-10-14', 150, { name: 'Tea' }), tea)).toBeNull();
  });

  it('a big shop is not unusual because its category is mostly small ones', () => {
    const groceries = (on: string, r: number, name: string) => pay(on, r, { categoryId: 'groceries', name });
    const corner = ['01', '02', '03', '04', '05', '06', '07', '08'].map(d => groceries(`2026-09-${d}`, 150, 'Anna Stores'));
    const dmart = [1300, 1500, 1400, 1450, 1350].map((r, i) => groceries(`2026-09-1${i}`, r, 'DMart'));
    expect(unusualness(groceries('2026-10-14', 1450, 'DMart'), [...corner, ...dmart])).toBeNull();
    expect(unusualness(groceries('2026-10-14', 1450, 'New Shop'), [...corner, ...dmart])).toBeNull(); // nothing to judge by
    expect(unusualness(groceries('2026-10-14', 6000, 'DMart'), [...corner, ...dmart])!.compared).toBe(5);
  });

  it('names match loosely; only the last week is shown', () => {
    const cabs = [90, 120, 100, 110, 95].map((r, i) => pay(`2026-09-0${i + 1}`, r, { name: 'Uber' }));
    expect(unusualness(pay('2026-10-14', 650, { name: ' uber ' }), [...cabs, pay('2026-09-20', 50000, { name: 'Croma' })])!.compared).toBe(5);
    const list = recentUnusual([...usual, swiggy('2026-09-20', 2000), swiggy('2026-10-12', 1500)], today);
    expect(list.map(u => u.payment.on)).toEqual(['2026-10-12']);
  });
});

describe('keptByCancelling', () => {
  it('sums what cancelled plans would have charged since cancelling', () => {
    const plans = [plan({ name: 'Hotstar', price: paise(29900), status: 'cancelled' }), plan({ name: 'Netflix' })];
    const events: PlanEvent[] = [{ id: 'e', planId: 'Hotstar', on: d('2026-07-01'), at: 1, kind: 'cancelled' }];
    expect(keptByCancelling(plans, events, today)).toMatchObject({ kept: 4 * 29900, perYear: 12 * 29900 }); // Jul–Oct 10th
    expect(keptByCancelling([plan({})], [], today)).toBeNull();
  });
});

describe('seasonality and accuracy', () => {
  // ₹10,000 a month, except last November (Diwali) at ₹15,000.
  const months = ['2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const history = months.map(m => pay(`${m}-10`, m === '2025-11' ? 15000 : 10000));
  it('a month that ran busy last year is forecast busy again', () => {
    expect(seasonality(history, d('2026-11-01'))).toBe(1.5);
    expect(seasonality(history, d('2026-12-01'))).toBe(0.92); // ordinary, against months that include November
    const f = forecastNextMonth([], [], history, d('2026-10-15'))!;
    expect(f.everyday!.seasonal).toBe(1.5);
    expect(f.estimate).toBe(Math.round(1.5 * 1000000));
  });
  it('without a year of history there is no seasonal factor', () => {
    expect(seasonality(history.slice(-4), d('2026-11-01'))).toBeNull();
  });
  it('last month: what the forecast said then against what happened', () => {
    const a = forecastAccuracy([], [], [...history, pay('2026-09-20', 2000)], d('2026-10-05'))!;
    expect(a.month).toBe('2026-09-01');
    expect(a.forecast).toBe(1000000);
    expect(a.actual).toBe(1200000);
    expect(a.off).toBeCloseTo(1 / 6);
    expect(a.within).toBe(false);
  });
});
