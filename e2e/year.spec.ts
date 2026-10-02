import { expect, test } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn } from './helpers.ts';

test('year in review totals the year and ranks where it went', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(0) });
  await addExpense(page, { name: 'Headphones', amount: '2999', on: daysFromToday(0) });
  await page.getByRole('link', { name: 'What I spent ›' }).click();
  await page.getByRole('dialog', { name: 'What I spent' }).getByRole('link', { name: 'Year in review ›' }).click();
  const year = daysFromToday(0).slice(0, 4);
  const panel = page.getByRole('dialog', { name: 'Year in review' });
  await expect(panel.getByText(`${year} so far`)).toBeVisible();
  await expect(panel.getByText('₹3,198', { exact: true })).toBeVisible();
  await expect(panel.getByText('₹199 on plans · ₹2,999 everyday')).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Netflix' })).toHaveAttribute('href', /#\/plan\//);
  await expect(panel.getByText('Biggest single expense')).toBeVisible();
  // Nothing tracked before this year, and no future years to page into.
  await expect(panel.getByRole('link', { name: /Previous year/ })).toHaveCount(0);
  await expect(panel.getByRole('link', { name: /Next year/ })).toHaveCount(0);
});
