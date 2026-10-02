import { expect, test } from '@playwright/test';
import { addPlan, daysFromToday, signIn } from './helpers.ts';

test('the calendar shows charges on their days, and the months ahead', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-10) });
  await page.getByRole('link', { name: 'Calendar ›' }).click();
  const panel = page.getByRole('dialog', { name: 'Calendar' });
  const grid = panel.getByRole('group', { name: /by day/ });
  const day = Number(daysFromToday(-10).slice(8));
  await expect(grid.getByRole('button', { name: new RegExp(`^${day}: Netflix ₹199$`) })).toHaveCount(1);
  await grid.getByRole('button', { name: new RegExp(`^${day}: Netflix`) }).click();
  await expect(panel.getByRole('link', { name: 'Netflix' })).toBeVisible();

  // Next month: Netflix is coming again.
  await panel.getByRole('link', { name: /^Next month/ }).click();
  await expect(panel.getByText(/₹199 still coming/)).toBeVisible();

  // Closing the panel goes back to the home screen underneath.
  await panel.getByRole('button', { name: 'Close calendar' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('link', { name: 'Calendar ›' })).toBeVisible();
});
