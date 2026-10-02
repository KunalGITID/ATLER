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

test('an expense far above your usual at the same place is flagged', async ({ page }) => {
  await tab(page, 'You');
  await page.getByRole('button', { name: 'Add a category' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Food');
  await page.getByRole('dialog').getByRole('button', { name: 'SAVE' }).click();
  for (const [i, amount] of ['180', '250', '220', '300', '260', '210'].entries()) {
    await addExpense(page, { name: 'Swiggy', amount, on: daysFromToday(-30 - i), category: 'Food' });
  }
  await tab(page, 'Month');
  await expect(page.getByText('Unusual spend')).toHaveCount(0);

  // A one-off somewhere else isn't judged against Swiggy.
  await addExpense(page, { name: 'Birthday dinner', amount: '1400', on: daysFromToday(0), category: 'Food' });
  await expect(page.getByText('Unusual spend')).toHaveCount(0);

  // Adding an unusual expense asks right away; "Ask me later" leaves it on the Month card.
  await addExpense(page, { name: 'Swiggy', amount: '1600', on: daysFromToday(0), category: 'Food' });
  const ask = page.getByRole('dialog', { name: 'Was this expected?' });
  await expect(ask).toContainText('6.8× your usual spend at Swiggy of ₹235');
  await ask.getByRole('button', { name: 'Ask me later' }).click();
  const card = page.locator('text=Unusual spend').locator('..');
  await expect(card).toContainText('Swiggy · ₹1,600');
  await expect(card).toContainText('6.8× your usual spend at Swiggy of ₹235');

  // Answering clears the card; Undo brings it back.
  await card.getByRole('button', { name: 'Expected', exact: true }).click();
  await expect(page.getByText('Unusual spend')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(card).toContainText('Swiggy · ₹1,600');

  await card.getByRole('button', { name: 'Not expected' }).click();
  await expect(page.getByText('Unusual spend')).toHaveCount(0);
  await tab(page, 'You');
  await expect(page.getByText('1 of the 1 you answered was really unusual (100%)')).toBeVisible();
});

test('answering in the add sheet, and reviewing past jumps', async ({ page }) => {
  for (const [i, amount] of ['180', '250', '220', '300', '260'].entries()) {
    await addExpense(page, { name: 'Swiggy', amount, on: daysFromToday(-40 - i) });
  }
  await addExpense(page, { name: 'Swiggy', amount: '1500', on: daysFromToday(-20) });
  await page.getByRole('dialog', { name: 'Was this expected?' }).getByRole('button', { name: 'Ask me later' }).click();
  await addExpense(page, { name: 'Swiggy', amount: '1800', on: daysFromToday(-10) });
  await page.getByRole('dialog', { name: 'Was this expected?' }).getByRole('button', { name: 'Ask me later' }).click();

  // Older than a week, so they're for the review, not the live card.
  await tab(page, 'Month');
  await expect(page.getByText('Teach ATLER what’s unusual for you')).toBeVisible();
  await expect(page.getByText('2 big jumps in your spending so far')).toBeVisible();
  await page.getByRole('button', { name: 'Take a look' }).click();
  const review = page.getByRole('dialog', { name: 'Were these expected?' });
  await review.getByRole('button', { name: 'Expected', exact: true }).first().click();
  await review.getByRole('button', { name: 'Not expected' }).first().click();
  await expect(review).toContainText('All done. Thanks!');
  await review.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Teach ATLER what’s unusual for you')).toHaveCount(0);

  // Answered right after adding: no card afterwards.
  await addExpense(page, { name: 'Swiggy', amount: '5000', on: daysFromToday(0) });
  await page.getByRole('dialog', { name: 'Was this expected?' }).getByRole('button', { name: 'Not expected' }).click();
  await expect(page.getByText('Unusual spend')).toHaveCount(0);
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
