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

  test('navigates to video chat setup route and handles 18+ terms gate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start video chat/i }).click();

    await expect(page).toHaveURL(/\/chat\?mode=video/, { timeout: 15000 });

    // Handle 18+ terms modal if visible
    const termsHeading = page.getByText(/Safety & Guidelines/i);
    try {
      await expect(termsHeading).toBeVisible({ timeout: 5000 });
      const checkbox = page.getByRole('checkbox');
      await checkbox.click();
      await page.getByRole('button', { name: /I Agree & Enter Chat/i }).click();
    } catch {
      // Bypassed if already accepted
    }

    await expect(page.getByText('Camera & Microphone Permission')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /enable camera & mic/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('navigates to text chat mode from homepage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zoopie_terms_accepted_v1', new Date().toISOString());
    });
    await page.goto('/');
    await page.getByRole('button', { name: /start text chat/i }).click();

    await expect(page).toHaveURL(/\/chat\?mode=text/, { timeout: 15000 });
    await expect(page.getByText(/Text Mode/i).first()).toBeVisible({ timeout: 10000 });
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
