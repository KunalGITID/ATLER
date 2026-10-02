import { expect, test } from '@playwright/test';

// The reset email links back with a recovery token in the URL; supabase-js
// turns that into a PASSWORD_RECOVERY event.
test('a password-reset link lands on "Set a new password" and then into the app', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  const token = 'mock-access.00000000-0000-4000-8000-0000000000a1';
  await page.goto(`./#access_token=${token}&refresh_token=r&expires_in=3600&expires_at=${Math.floor(Date.now() / 1000) + 3600}&token_type=bearer&type=recovery`);
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();

  await page.getByLabel('New password').fill('short');
  await page.getByLabel('Type it again').fill('short');
  await page.getByRole('button', { name: 'SAVE PASSWORD' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use at least 8 characters.');

  await page.getByLabel('New password').fill('a-better-password');
  await page.getByLabel('Type it again').fill('a-better-pasword');
  await page.getByRole('button', { name: 'SAVE PASSWORD' }).click();
  await expect(page.getByRole('alert')).toHaveText('The two passwords don’t match.');

  await page.getByLabel('Type it again').fill('a-better-password');
  await page.getByRole('button', { name: 'SAVE PASSWORD' }).click();
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
});
