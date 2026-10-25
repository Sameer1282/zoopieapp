import { test, expect } from '@playwright/test';

test.describe('Zoopie Phase 2 Smoke & Navigation Test', () => {
  test('homepage renders hero, mode actions, and core sections', async ({ page }) => {
    await page.goto('/');

    // Check title / heading
    await expect(page.locator('h1')).toContainText('Spontaneous connections');

    // Check action buttons
    await expect(page.getByRole('button', { name: /start video chat/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start text chat/i })).toBeVisible();

    // Check How It Works and Features sections
    await expect(page.getByRole('heading', { name: /how zoopie works/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /built for privacy/i })).toBeVisible();

    // Check footer links
    await expect(page.getByRole('link', { name: /safety & community guide/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
  });

  test('navigates to video chat setup route', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start video chat/i }).click();

    await expect(page).toHaveURL(/\/chat\?mode=video/);
    await expect(page.getByText('Camera & Audio Setup')).toBeVisible();
    await expect(page.getByText('Matchmaking Queue Staged for Phase 3')).toBeVisible();
  });

  test('navigates to safety guidelines page', async ({ page }) => {
    await page.goto('/safety');
    await expect(page.getByRole('heading', { name: /safety & guidelines/i })).toBeVisible();
    await expect(page.getByText('Age Requirement: 18+ Only')).toBeVisible();
  });

  test('dev-status page preserves Phase 1 gateway diagnostics', async ({ page }) => {
    await page.goto('/dev-status');
    await expect(page.getByText('System Health & Gateways')).toBeVisible();
    await expect(page.getByText('Express Backend Status')).toBeVisible();
    await expect(page.getByText('Socket.IO Connection Test')).toBeVisible();
  });
});
