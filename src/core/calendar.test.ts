import { expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Plan } from './model.ts';
import { calendarMonth } from './calendar.ts';

const d = (s: string) => parseDay(s) as Day;
const netflix: Plan = { id: 'n', name: 'Netflix', price: paise(19900), cycle: MONTHLY, anchor: d('2026-01-19'), categoryId: null, status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01') };

it('October 2026 starts on a Thursday: padded Monday-first to whole weeks, with charges on their days', () => {
  const days = calendarMonth(d('2026-10-01'), d('2026-10-18'), [netflix], [], [
    { id: 'a', name: 'Groceries', amount: paise(120000), on: d('2026-10-05'), categoryId: null, source: 'manual' },
  ]);
  expect(days).toHaveLength(35);
  expect(days[0]!.on).toBe('2026-09-28');
  expect(days.filter(x => x.inMonth)).toHaveLength(31);
  const oct19 = days.find(x => x.on === '2026-10-19')!;
  expect(oct19.entries).toEqual([{ name: 'Netflix', amount: 19900, kind: 'renewal', planId: 'n', paid: false }]);
  expect(days.find(x => x.on === '2026-10-05')!.total).toBe(120000);
});
