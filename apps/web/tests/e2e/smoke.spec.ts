import { test, expect } from '@playwright/test';

test.describe('Zoopie Smoke Test', () => {
  test('homepage renders correctly with title and foundation cards', async ({ page }) => {
    await page.goto('/');

    // Check title / heading
    await expect(page.locator('h1')).toContainText('Zoopie Real-Time Architecture');

    // Check cards
    await expect(page.getByText('Express Backend Status')).toBeVisible();
    await expect(page.getByText('Socket.IO Connection Test')).toBeVisible();
    await expect(page.getByText('Initial Component System')).toBeVisible();
  });
});
