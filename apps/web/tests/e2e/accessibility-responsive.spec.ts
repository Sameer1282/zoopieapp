import { test, expect } from '@playwright/test';

test.describe('Phase 8: Accessibility & Responsive Layouts', () => {
  const viewports = [
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Mobile (375x667)', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`renders landing page responsively on ${vp.name} without horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Check core elements are visible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByRole('button', { name: /start video chat/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /start text chat/i })).toBeVisible();

      // Check no horizontal scroll overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });
  }

  test('accessible form controls and keyboard behavior in chat', async ({ browser }) => {
    test.setTimeout(60000);
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    await context1.addInitScript(() => {
      localStorage.setItem('zoopie_terms_accepted_v1', new Date().toISOString());
    });
    await context2.addInitScript(() => {
      localStorage.setItem('zoopie_terms_accepted_v1', new Date().toISOString());
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const fixtureRoom = `test-a11y-${Date.now()}`;
    await page1.goto(`/chat?mode=text&room=${fixtureRoom}`);
    await page2.goto(`/chat?mode=text&room=${fixtureRoom}`);

    const input = page1.getByRole('textbox', { name: /type a message/i });
    await expect(input).toBeEnabled({ timeout: 15000 });

    // Focus input and test typing
    await input.focus();
    await input.fill('Testing keyboard enter key submission');

    // Press Enter to submit
    await input.press('Enter');

    // Input should be cleared upon submission
    await expect(input).toHaveValue('');

    // Verify message appears in message list on both pages
    await expect(page1.getByText('Testing keyboard enter key submission')).toBeVisible({
      timeout: 10000,
    });
    await expect(page2.getByText('Testing keyboard enter key submission')).toBeVisible({
      timeout: 10000,
    });

    await context1.close();
    await context2.close();
  });
});
