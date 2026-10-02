import { expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Plan } from './model.ts';
import { plansCsv, spendingCsv } from './exportCsv.ts';

const d = (s: string) => parseDay(s) as Day;
const plan: Plan = { id: 'n', name: 'Netflix, Premium', price: paise(64900), cycle: MONTHLY, anchor: d('2026-08-05'), categoryId: 'fun', status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-08-01') };
const cats = [{ id: 'fun', name: 'Entertainment', budget: null }];

it('plans export with quoting and rupee amounts', () => {
  expect(plansCsv([plan], [], cats, d('2026-10-18')).split('\n')).toEqual([
    'Name,Price (₹),Billed,Status,Next charge,Per month (₹),Category,Tracked since',
    '"Netflix, Premium",649.00,Monthly,active,2026-11-05,649.00,Entertainment,2026-08-01',
  ]);
});

it('spending export: expenses and renewals, newest first, nothing in the future', () => {
  const lines = spendingCsv([plan], [], [
    { id: 'a', name: 'Groceries', amount: paise(120050), on: d('2026-10-12'), categoryId: null, source: 'manual' },
    { id: 'b', name: 'Later', amount: paise(100), on: d('2026-12-01'), categoryId: null, source: 'manual' },
  ], cats, d('2026-10-18')).split('\n');
  expect(lines).toEqual([
    'Date,What,Amount (₹),Category,Type',
    '2026-10-12,Groceries,1200.50,,Expense',
    '2026-10-05,"Netflix, Premium",649.00,Entertainment,Renewal',
    '2026-09-05,"Netflix, Premium",649.00,Entertainment,Renewal',
    '2026-08-05,"Netflix, Premium",649.00,Entertainment,Renewal',
  ]);
});
