import { expect, test } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn, tab } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
});

async function newCategory(page: import('@playwright/test').Page, name: string, budget = '') {
  await tab(page, 'You');
  await page.getByRole('button', { name: 'Add a category' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name').fill(name);
  await sheet.getByLabel('Monthly budget (₹, optional)').fill(budget);
  await sheet.getByRole('button', { name: 'SAVE' }).click();
  await expect(sheet).toBeHidden();
}

test('a budget shows spent and what is left, and flags going over', async ({ page }) => {
  await newCategory(page, 'Entertainment', '300');
  await expect(page.getByRole('button', { name: /Entertainment ₹300\/mo/ })).toBeVisible();

  // Charged today (so already spent this month) plus an expense today.
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(0), category: 'Entertainment' });
  await tab(page, 'Month');
  await expect(page.getByRole('img', { name: /Entertainment: ₹199 spent and ₹0 still coming of ₹300\. ₹101 left\./ })).toBeVisible();

  await addExpense(page, { name: 'Movie', amount: '150', on: daysFromToday(0), category: 'Entertainment' });
  await expect(page.getByText('Over by ₹49')).toBeVisible();
});

test('a category can be made right from the add sheet', async ({ page }) => {
  await addPlan(page, { name: 'Swiggy One', amount: '99', lastCharged: daysFromToday(-3) });
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByLabel('What for').fill('Groceries');
  await sheet.getByLabel('Amount (₹)').fill('800');
  await sheet.getByLabel('Category').selectOption({ label: 'New category…' });
  await sheet.getByLabel('New category name').fill('Food');
  await sheet.getByRole('button', { name: 'ADD EXPENSE' }).click();
  await tab(page, 'You');
  await expect(page.getByRole('button', { name: /Food No budget/ })).toBeVisible();
});

test('deleting a category keeps its plans, uncategorised', async ({ page }) => {
  await newCategory(page, 'Streaming');
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-3), category: 'Streaming' });
  await tab(page, 'Plans');
  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Netflix/ }).click();
  await expect(page.locator('dl[aria-label="About this plan"] > div').filter({ hasText: 'Category' })).toContainText('Streaming');

  await tab(page, 'You');
  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete category' }).click();
  await tab(page, 'Plans');
  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Netflix/ }).click();
  await expect(page.locator('dl[aria-label="About this plan"] > div').filter({ hasText: 'Category' })).toContainText('None');
});

test('typing a name suggests the category you used for it before', async ({ page }) => {
  await newCategory(page, 'Food');
  await newCategory(page, 'Treats');
  // A keyword hint, because a "Food" category exists.
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  let sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByLabel('What for').fill('Swiggy');
  await expect(sheet.getByLabel('Category')).toHaveValue(/.+/);
  await expect(sheet.getByLabel('Category').locator('option:checked')).toHaveText('Food');
  // You overrule it; next time your choice is remembered.
  await sheet.getByLabel('Category').selectOption({ label: 'Treats' });
  await sheet.getByLabel('Amount (₹)').fill('250');
  await sheet.getByRole('button', { name: 'ADD EXPENSE' }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByLabel('What for').fill('swiggy');
  await expect(sheet.getByLabel('Category').locator('option:checked')).toHaveText('Treats');
});
