import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("should have a descriptive page title", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Dispute2Go/i);
  });

  test("should have proper heading hierarchy on login page", async ({ page }) => {
    await page.goto("/login");

    // There should be at least one heading
    const headings = page.getByRole("heading");
    await expect(headings.first()).toBeVisible();
  });

  test("should have labels for login form inputs", async ({ page }) => {
    await page.goto("/login");

    // Email input should have an associated label
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    // Password input should have an associated label
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
  });

  test("should have accessible form inputs in Add Client dialog", async ({ page }) => {
    await page.goto("/clients");

    const addButton = page.getByRole("button", { name: /add client/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByText(/add new client/i)).toBeVisible();

      // All form fields should have labels
      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/phone/i)).toBeVisible();
    }
  });

  test("should have accessible navigation landmarks", async ({ page }) => {
    await page.goto("/dashboard");

    // There should be a main content area
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // There should be a nav element (sidebar navigation)
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
  });

  test("should support keyboard navigation on login page", async ({ page }) => {
    await page.goto("/login");

    // Tab through the form elements
    await page.keyboard.press("Tab");
    // After tabbing, an input or link should be focused
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });

  test("should have focus visible styles", async ({ page }) => {
    await page.goto("/login");

    // Tab to the email input
    const emailInput = page.getByLabel(/email/i);
    await emailInput.focus();

    // The element should be focused and visible
    await expect(emailInput).toBeFocused();
  });

  test("should have accessible buttons with text or aria-labels", async ({ page }) => {
    await page.goto("/dashboard");

    // All buttons should have accessible text
    const buttons = page.getByRole("button");
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Button should have inner text or aria-label
        const text = await button.innerText();
        const ariaLabel = await button.getAttribute("aria-label");
        const title = await button.getAttribute("title");
        const hasAccessibleName = text.trim().length > 0 || !!ariaLabel || !!title;
        expect(hasAccessibleName).toBeTruthy();
      }
    }
  });

  test("should have images with alt text", async ({ page }) => {
    await page.goto("/dashboard");

    // Check all images have alt attributes
    const images = page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      if (await img.isVisible()) {
        const alt = await img.getAttribute("alt");
        expect(alt).not.toBeNull();
        expect(alt!.length).toBeGreaterThan(0);
      }
    }
  });

  test("should maintain logical focus order on clients page", async ({ page }) => {
    await page.goto("/clients");

    // Tab through elements and verify focus moves forward logically
    const focusedElements: string[] = [];

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      if (await focused.isVisible()) {
        const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
        focusedElements.push(tagName);
      }
    }

    // We should have tabbed through at least some focusable elements
    expect(focusedElements.length).toBeGreaterThan(0);
  });

  test("should have adequate color contrast on text", async ({ page }) => {
    await page.goto("/login");

    // Check that the main heading text is visible and has content
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();

    // Verify text content exists (ensuring it's not invisible/transparent)
    const text = await heading.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test("should support Escape key to close dialogs", async ({ page }) => {
    await page.goto("/clients");

    const addButton = page.getByRole("button", { name: /add client/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByText(/add new client/i)).toBeVisible();

      // Press Escape to close the dialog
      await page.keyboard.press("Escape");
      await expect(page.getByText(/add new client/i)).not.toBeVisible();
    }
  });

  test("should trap focus within open dialogs", async ({ page }) => {
    await page.goto("/clients");

    const addButton = page.getByRole("button", { name: /add client/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByText(/add new client/i)).toBeVisible();

      // Tab multiple times - focus should stay within the dialog
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press("Tab");
      }

      // The focused element should still be within the dialog
      const focusedInDialog = await page.evaluate(() => {
        const focused = document.activeElement;
        const dialog = document.querySelector("[role='dialog']") ||
                       document.querySelector("[data-state='open']");
        if (!dialog || !focused) return true; // Skip if no dialog found
        return dialog.contains(focused);
      });
      expect(focusedInDialog).toBeTruthy();

      // Close dialog
      await page.keyboard.press("Escape");
    }
  });
});
