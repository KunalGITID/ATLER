import { expect, test } from '@playwright/test';
import { addPlan, daysFromToday, signIn } from './helpers.ts';

test('the calendar shows charges on their days, and the months ahead', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-10) });
  await page.getByRole('link', { name: 'Calendar ›' }).click();
  const grid = page.getByRole('group', { name: /by day/ });
  const day = Number(daysFromToday(-10).slice(8));
  await expect(grid.getByRole('button', { name: new RegExp(`^${day}: Netflix ₹199$`) })).toHaveCount(1);
  await grid.getByRole('button', { name: new RegExp(`^${day}: Netflix`) }).click();
  await expect(page.getByRole('link', { name: 'Netflix' })).toBeVisible();

  // Next month: Netflix is coming again.
  await page.getByRole('link', { name: /^Next month/ }).click();
  await expect(page.getByText(/₹199 still coming/)).toBeVisible();
});
