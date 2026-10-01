import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page) {
  await page.goto('./');
  await page.getByLabel('Email').fill('test@atler.mock');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'SIGN IN →' }).click();
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
  await expect(page.locator('#launch')).toHaveCount(0);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

export async function addPlan(page: Page, { name, amount, billed = 'Monthly', lastCharged, category }: { name: string; amount: string; billed?: string; lastCharged: string; category?: string }) {
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Plan' }).click();
  await sheet.getByLabel('Name').fill(name);
  await sheet.getByLabel('Amount (₹)').fill(amount);
  await sheet.getByLabel('Billed').selectOption({ label: billed });
  await sheet.getByLabel('Last charged on').fill(lastCharged);
  if (category) await sheet.getByLabel('Category').selectOption({ label: category });
  await sheet.getByRole('button', { name: 'ADD PLAN' }).click();
  await expect(sheet).toBeHidden();
}

export async function addExpense(page: Page, { name, amount, on, category }: { name: string; amount: string; on: string; category?: string }) {
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByLabel('What for').fill(name);
  await sheet.getByLabel('Amount (₹)').fill(amount);
  await sheet.getByLabel('Date').fill(on);
  if (category) await sheet.getByLabel('Category').selectOption({ label: category });
  await sheet.getByRole('button', { name: 'ADD EXPENSE' }).click();
  await expect(sheet).toBeHidden();
}

export async function tab(page: Page, name: 'Month' | 'Plans' | 'You') {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();
}
