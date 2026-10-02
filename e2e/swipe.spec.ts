import { expect, test, type Locator, type Page } from '@playwright/test';
import { addPlan, daysFromToday, signIn } from './helpers.ts';

// A real one-finger swipe across the middle of `on`, sent as touch input.
async function swipe(page: Page, on: Locator, direction: 'left' | 'right') {
  await expect(on).toBeVisible();
  const box = (await on.boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 200);
  const [from, to] = direction === 'left' ? [box.x + box.width * 0.8, box.x + box.width * 0.2] : [box.x + box.width * 0.2, box.x + box.width * 0.8];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + ((to - from) * i) / 5, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const monthLabel = (offset: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-3) });
});

test('swiping moves between Month and Plans, and back from a plan', async ({ page }) => {
  const main = page.locator('main');
  await swipe(page, main, 'left');
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeAttached();

  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Netflix/ }).click();
  await expect(page.getByRole('heading', { name: 'Netflix' })).toBeVisible();
  await swipe(page, main, 'right');
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeAttached();

  await swipe(page, main, 'right');
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
  // Nothing sits to the right of Plans or the left of Month.
  await swipe(page, main, 'right');
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
});

test('swiping the calendar changes month and leaves the page behind alone', async ({ page }) => {
  await page.getByRole('link', { name: 'Calendar ›' }).click();
  const panel = page.getByRole('dialog', { name: 'Calendar' });
  const title = panel.getByRole('heading', { level: 2 });
  await expect(title).toHaveText(monthLabel(0));

  await swipe(page, panel.getByRole('group', { name: /by day/ }), 'left');
  await expect(title).toHaveText(monthLabel(1));
  await swipe(page, panel.getByRole('group', { name: /by day/ }), 'right');
  await expect(title).toHaveText(monthLabel(0));
  await swipe(page, panel.getByRole('group', { name: /by day/ }), 'right');
  await expect(title).toHaveText(monthLabel(-1));

  await panel.getByRole('button', { name: 'Close calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
});

test('a mostly vertical drag is a scroll, not a swipe', async ({ page }) => {
  const box = (await page.locator('main').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 30, y: 400 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30, y: 250 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Your plans' })).toHaveCount(0);
});
