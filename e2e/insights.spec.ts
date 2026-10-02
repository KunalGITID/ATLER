import { expect, test } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn, tab } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
});

const nextMonthName = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-IN', { month: 'long' });
// The 10th of a month n months before this one, as YYYY-MM-DD.
const tenthOf = (monthsAgo: number) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - monthsAgo, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`;
};

test('next month: renewals only until there is everyday history, then a range', async ({ page }) => {
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-3) });
  const forecast = page.getByRole('region', { name: new RegExp(`${nextMonthName()}, likely`) });
  await expect(forecast).toContainText('₹199');
  await expect(forecast).toContainText('log everyday expenses for a month to include them');

  await addExpense(page, { name: 'Groceries', amount: '2000', on: tenthOf(2) });
  await addExpense(page, { name: 'Groceries', amount: '3000', on: tenthOf(1) });
  await expect(forecast).toContainText('₹2,699');                          // 199 + average 2,500
  await expect(forecast).toContainText('Probably ₹2,199 – ₹3,199');
  await expect(forecast).toContainText('your last 2 months');
});

test('an expense far above your usual for its category is flagged', async ({ page }) => {
  await tab(page, 'You');
  await page.getByRole('button', { name: 'Add a category' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Food');
  await page.getByRole('dialog').getByRole('button', { name: 'SAVE' }).click();
  for (const [i, amount] of ['180', '250', '220', '300', '260', '210'].entries()) {
    await addExpense(page, { name: 'Swiggy', amount, on: daysFromToday(-30 - i), category: 'Food' });
  }
  await tab(page, 'Month');
  await expect(page.getByText('Unusual spend')).toHaveCount(0);

  await addExpense(page, { name: 'Birthday dinner', amount: '1400', on: daysFromToday(0), category: 'Food' });
  const card = page.locator('text=Unusual spend').locator('..');
  await expect(card).toContainText('Birthday dinner · ₹1,400');
  await expect(card).toContainText('6.0× your usual Food spend of ₹235');
});

test('no "kept" card until cancelling has actually kept something', async ({ page }) => {
  await addPlan(page, { name: 'Hotstar', amount: '299', lastCharged: daysFromToday(-3) });
  await tab(page, 'Plans');
  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Hotstar/ }).click();
  await page.getByRole('button', { name: /I CANCELLED IT/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, I cancelled it' }).click();
  await tab(page, 'Month');
  await expect(page.getByText('Kept since cancelling')).toHaveCount(0);
});
