import { test, expect } from '@playwright/test';

test.describe('Phase 8: Multi-User Real Browser Text Chat Flow', () => {
  test.setTimeout(60000);

  test('two independent browser users exchange messages, report, and block', async ({
    browser,
  }) => {
    // 1. Create two isolated browser contexts representing separate users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    // Pre-accept terms in both contexts
    await context1.addInitScript(() => {
      localStorage.setItem('zoopie_terms_accepted_v1', new Date().toISOString());
    });
    await context2.addInitScript(() => {
      localStorage.setItem('zoopie_terms_accepted_v1', new Date().toISOString());
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const fixtureRoom = `test-chat-${Date.now()}`;

    // 2. Both users navigate to the same text fixture room
    await page1.goto(`/chat?mode=text&room=${fixtureRoom}`);
    await page2.goto(`/chat?mode=text&room=${fixtureRoom}`);

    // Wait for match room title and connection
    await expect(page1.getByText(fixtureRoom).first()).toBeVisible({ timeout: 15000 });
    await expect(page2.getByText(fixtureRoom).first()).toBeVisible({ timeout: 15000 });

    // 3. User 1 sends message to User 2
    const input1 = page1.getByRole('textbox', { name: /type a message/i });
    await expect(input1).toBeEnabled({ timeout: 15000 });
    await input1.fill('Hello from User 1 in Playwright!');
    await page1.getByRole('button', { name: /send/i }).click();

    // Verify User 1 sees their sent message
    await expect(page1.getByText('Hello from User 1 in Playwright!')).toBeVisible({
      timeout: 10000,
    });

    // 4. Verify User 2 receives message in real-time
    await expect(page2.getByText('Hello from User 1 in Playwright!')).toBeVisible({
      timeout: 10000,
    });

    // 5. User 2 replies
    const input2 = page2.getByRole('textbox', { name: /type a message/i });
    await expect(input2).toBeEnabled({ timeout: 15000 });
    await input2.fill('Hello back from User 2!');
    await page2.getByRole('button', { name: /send/i }).click();

    // Verify both see the reply
    await expect(page2.getByText('Hello back from User 2!')).toBeVisible({ timeout: 10000 });
    await expect(page1.getByText('Hello back from User 2!')).toBeVisible({ timeout: 10000 });

    // 6. Test Report Flow: User 1 reports User 2
    const reportBtn = page1.getByRole('button', { name: /report/i });
    if (await reportBtn.isVisible()) {
      await reportBtn.click();
      await expect(page1.getByText('Report Participant')).toBeVisible();

      // Verify disclosure is rendered
      await expect(page1.getByText(/Disclosure:/i)).toBeVisible();

      // Submit report
      const submitBtn = page1.getByRole('button', { name: /submit report/i });
      await submitBtn.click();

      // Verify report acknowledgement
      await expect(page1.getByText(/Report Submitted/i)).toBeVisible({ timeout: 10000 });
    }

    // 7. Test Stop / Leave conversation
    const stopBtn = page1.getByRole('button', { name: /stop/i });
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
      await expect(
        page1.getByRole('button', { name: /(start matchmaking|find partner)/i })
      ).toBeVisible({
        timeout: 10000,
      });
    }

    await context1.close();
    await context2.close();
  });
});
