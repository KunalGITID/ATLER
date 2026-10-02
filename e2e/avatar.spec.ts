import { expect, test } from '@playwright/test';
import { signIn, tab } from './helpers.ts';

// A tiny real PNG; the app crops and re-encodes it as a 256 px WebP.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('a profile photo shows on You and on the profile button, and can be removed', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  const button = page.getByRole('link', { name: /^You: / });
  await expect(button.locator('img')).toHaveCount(0);
  await expect(button).toHaveText('T');

  await tab(page, 'You');
  await page.getByText('Add a photo').locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(button.locator('img')).toHaveAttribute('src', /\/storage\/v1\/object\/public\/avatars\/.+\/avatar\.webp\?v=\d+/);
  await expect(button.locator('img')).toHaveJSProperty('naturalWidth', 256);
  expect(await (await request.get('http://127.0.0.1:54329/__files')).json()).toEqual([expect.stringMatching(/^avatars\/.+\/avatar\.webp$/)]);

  // Still there after a reload (it's on the profile, not just this page).
  await page.reload();
  await expect(page.getByRole('link', { name: /^You: / }).locator('img')).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('link', { name: /^You: / })).toHaveText('T');
  expect(await (await request.get('http://127.0.0.1:54329/__files')).json()).toEqual([]);
});
