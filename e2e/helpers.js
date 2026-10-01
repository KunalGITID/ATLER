import { expect } from '@playwright/test';

export const MOCK = 'http://127.0.0.1:54329';
export const USER_ID = '00000000-0000-4000-8000-0000000000a1';

export async function resetDb(request, seed = {}) {
    await request.post(`${MOCK}/__reset`);
    await request.post(`${MOCK}/__seed`, {
        data: { profiles: [{ name: 'Test User', theme: 'default', currency: 'INR' }], ...seed },
    });
}

export async function dbRows(request, table) {
    return (await (await request.get(`${MOCK}/__db`)).json())[table];
}

export async function failNextWrite(request, table) {
    await request.post(`${MOCK}/__fail?table=${table}`);
}

export async function signIn(page) {
    await page.goto('./');
    await page.locator('#auth-email').fill('test@atler.mock');
    await page.locator('#auth-password').fill('password123');
    await page.locator('#auth-submit-btn').click();
    await expect(page.locator('#dashboard-page')).toBeVisible();
    await expect(page.locator('#ls-screen')).toBeHidden({ timeout: 15_000 });
}

export async function addSubscription(page, { name, price, cycle = 'Monthly', startDate }) {
    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-sub').click();
    await page.locator('#add-name').fill(name);
    await page.locator('#add-price').fill(String(price));
    await page.locator('#add-cycle').selectOption(cycle);
    if (startDate) await page.locator('#add-start-date').fill(startDate);
    await page.locator('#add-form button[type="submit"]').click();
}

export const isoDaysAgo = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA');
};

export async function goTo(page, target) {
    await page.locator(`.nav-item[data-target="${target}"]`).click();
    await expect(page.locator(`#${target}`)).toBeVisible();
}

export async function openSubscription(page, name) {
    await goTo(page, 'analytics-page');
    const item = page.locator('#category-groups-container .list-item', { hasText: name });
    if (!(await item.isVisible())) {
        // Categories start collapsed: open the group that holds it.
        const groups = page.locator('#category-groups-container .category-group');
        for (let i = 0; i < await groups.count(); i++) {
            const group = groups.nth(i);
            if (await group.locator('.list-item', { hasText: name }).count()) {
                await group.locator('.category-group-head').click();
                break;
            }
        }
    }
    await item.click();
    await expect(page.locator('#detail-name')).toHaveText(name);
}
