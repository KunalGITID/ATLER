import { expect, test } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn, tab } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
});

test('What I spent lists expenses and renewals by day; an expense can be edited', async ({ page }) => {
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(0) });
  await addExpense(page, { name: 'Groceries', amount: '1200', on: daysFromToday(0) });
  await page.getByRole('link', { name: 'What I spent ›' }).click();
  const todayGroup = page.getByRole('region', { name: 'Today' });
  await expect(todayGroup).toContainText('Groceries');
  await expect(todayGroup).toContainText('Netflix');
  await expect(todayGroup).toContainText('Renewal');
  await expect(todayGroup).toContainText('₹1,399');

  await todayGroup.getByRole('button', { name: /Groceries/ }).click();
  await page.getByRole('dialog').getByLabel('Amount (₹)').fill('1500');
  await page.getByRole('dialog').getByRole('button', { name: 'SAVE' }).click();
  await expect(todayGroup).toContainText('₹1,699');
});

test('deleting an expense can be undone', async ({ page }) => {
  await addExpense(page, { name: 'Chai', amount: '40', on: daysFromToday(0) });
  await page.getByRole('link', { name: 'What I spent ›' }).click();
  await page.getByRole('button', { name: /Chai/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete expense' }).click();
  await expect(page.getByRole('region', { name: 'Today' })).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: 'Today' })).toContainText('Chai');
});

test('deleting a plan can be undone', async ({ page }) => {
  await addPlan(page, { name: 'Spotify', amount: '139', lastCharged: daysFromToday(-3) });
  await tab(page, 'Plans');
  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Spotify/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Your month is empty')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Your month is empty')).toHaveCount(0);
});

test('earlier months can be browsed', async ({ page }) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15);
  const last = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
  await addExpense(page, { name: 'Shoes', amount: '2500', on: last });
  await page.getByRole('link', { name: 'What I spent ›' }).click();
  await page.getByRole('link', { name: /^Previous month/ }).click();
  await expect(page.getByText('Shoes')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Next month/ })).toBeVisible();
});
