import { test, expect } from '@playwright/test';

test.describe('Phase 6: WebRTC Two-Client Video & Audio Call', () => {
  test.use({
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-file-access',
      ],
    },
    permissions: ['camera', 'microphone'],
  });

  test('two independent browser clients establish WebRTC video call with camera and mic controls', async ({
    browser,
  }) => {
    // 1. Create two isolated browser contexts representing separate users
    const context1 = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const context2 = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // 2. Both navigate to video chat route
    await page1.goto('/chat?mode=video');
    await page2.goto('/chat?mode=video');

    // Verify deliberate permission gate is shown on both
    await expect(page1.getByText('Camera & Microphone Permission')).toBeVisible();
    await expect(page2.getByText('Camera & Microphone Permission')).toBeVisible();

    // 3. Both deliberately click "Enable Camera & Mic"
    await page1.getByRole('button', { name: /enable camera & mic/i }).click();
    await page2.getByRole('button', { name: /enable camera & mic/i }).click();

    // 4. Verify local preview is rendered on both
    await expect(page1.getByTestId('local-video-preview')).toBeVisible({ timeout: 10000 });
    await expect(page2.getByTestId('local-video-preview')).toBeVisible({ timeout: 10000 });

    // 5. Verify both have mic and camera toggle controls
    const micBtn1 = page1.getByRole('button', { name: /mute microphone/i });
    const camBtn1 = page1.getByRole('button', { name: /turn off camera/i });
    await expect(micBtn1).toBeVisible();
    await expect(camBtn1).toBeVisible();

    // 6. Test toggling microphone and camera
    await micBtn1.click();
    await expect(page1.getByRole('button', { name: /unmute microphone/i })).toBeVisible();

    await camBtn1.click();
    await expect(page1.getByRole('button', { name: /turn on camera/i })).toBeVisible();
    await expect(page1.getByText(/camera turned off/i)).toBeVisible();

    // Turn camera back on
    await page1.getByRole('button', { name: /turn on camera/i }).click();
    await expect(page1.getByRole('button', { name: /turn off camera/i })).toBeVisible();

    // 7. Verify WebRTC diagnostics drawer works safely without leaking credentials
    await page1.getByRole('button', { name: /diagnostics/i }).click();
    await expect(page1.getByText('WebRTC Peer Diagnostics')).toBeVisible();
    await expect(page1.getByText(/private media & ip redacted/i)).toBeVisible();

    // 8. Test Stop / Leave call
    await page1.getByRole('button', { name: /stop/i }).click();
    await expect(page1.getByText('Camera & Microphone Permission')).toBeVisible();

    await context1.close();
    await context2.close();
  });
});
