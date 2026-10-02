// Spreadsheet exports. Amounts are plain rupees with two decimals so they sum
// correctly in Excel / Sheets; dates are YYYY-MM-DD.
import { describeCycle, today as todayDay, type Day } from './dates.ts';
import { toCsv } from './import/csv.ts';
import { monthlyCost } from './dates.ts';
import type { Paise } from './money.ts';
import type { Category, Payment, Plan, PlanEvent } from './model.ts';
import { plansSummary } from './plans.ts';
import { renewalsBetween } from './renewals.ts';

const rupees = (p: Paise) => (p / 100).toFixed(2);

export function plansCsv(plans: readonly Plan[], events: readonly PlanEvent[], categories: readonly Category[], today: Day = todayDay()): string {
  const s = plansSummary(plans, events, today);
  const cat = (id: string | null) => categories.find(c => c.id === id)?.name ?? '';
  const rows = [...s.billing, ...s.paused, ...s.cancelled].map(r => [
    r.plan.name, rupees(r.plan.price), describeCycle(r.plan.cycle), r.plan.status, r.next ?? '',
    rupees(monthlyCost(r.plan.price, r.plan.cycle)), cat(r.plan.categoryId), r.plan.createdOn,
  ]);
  return toCsv([['Name', 'Price (₹)', 'Billed', 'Status', 'Next charge', 'Per month (₹)', 'Category', 'Tracked since'], ...rows]);
}

export function spendingCsv(plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[], categories: readonly Category[], today: Day = todayDay()): string {
  const cat = (id: string | null) => categories.find(c => c.id === id)?.name ?? '';
  const rows: Array<[Day, string, string, string, string]> = [
    ...payments.filter(p => p.on <= today).map(p => [p.on, p.name, rupees(p.amount), cat(p.categoryId), p.source === 'manual' ? 'Expense' : p.source === 'sms' ? 'Expense (SMS)' : 'Expense (statement)'] as [Day, string, string, string, string]),
    ...plans.flatMap(p => renewalsBetween(p, events.filter(e => e.planId === p.id), p.anchor, today)
      .map(r => [r.on, r.name, rupees(r.amount), cat(p.categoryId), 'Renewal'] as [Day, string, string, string, string])),
  ];
  rows.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  return toCsv([['Date', 'What', 'Amount (₹)', 'Category', 'Type'], ...rows]);
}
