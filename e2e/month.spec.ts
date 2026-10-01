import { expect, test } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
});

test('a new account sees an empty month that asks for the first plan', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Your month is empty')).toBeVisible();
  await page.getByRole('button', { name: 'Add your first plan' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('plans and expenses fill in the month: ring, next up, coming up', async ({ page }) => {
  await signIn(page);
  // Netflix was charged 29 days ago, so it renews tomorrow; Spotify renews in 6 days.
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-30 + 1) });
  await addPlan(page, { name: 'Spotify', amount: '139', lastCharged: daysFromToday(-30 + 6) });
  await addExpense(page, { name: 'Groceries', amount: '1200', on: daysFromToday(0) });

  const ring = page.getByRole('img', { name: /day \d+ of \d+/ });
  await expect(ring).toBeVisible();
  await expect(page.getByText('Next up')).toBeVisible();
  await expect(page.locator('text=Next up').locator('..')).toContainText('Netflix');
  await expect(page.locator('text=Next up').locator('..')).toContainText('Tomorrow · ₹199');
  // The coming-up list continues after Next up instead of repeating it.
  await expect(page.locator('section[aria-labelledby="coming-up"]')).toContainText('Spotify');
  await expect(page.locator('section[aria-labelledby="coming-up"]')).not.toContainText('Netflix');
  // Tracking started today, so there is no honest "vs last month" yet.
  await expect(page.getByText('Plans per month')).toBeVisible();
  await expect(page.getByText(/^vs /i)).toHaveCount(0);
});

test('the month survives a reload (stored on the device)', async ({ page }) => {
  await signIn(page);
  await addPlan(page, { name: 'iCloud', amount: '75', lastCharged: daysFromToday(-3) });
  await page.reload();
  await expect(page.getByRole('img', { name: /iCloud ₹75/ })).toBeVisible();
});
