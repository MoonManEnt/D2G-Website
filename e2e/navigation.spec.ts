import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should navigate to all sidebar links", async ({ page }) => {
    // The sidebar navigation items defined in the app
    const navItems = [
      { name: /^dashboard$/i, url: /\/dashboard/ },
      { name: /^clients$/i, url: /\/clients/ },
      { name: /^disputes$/i, url: /\/disputes/ },
      { name: /^sentry$/i, url: /\/sentry/ },
      { name: /^evidence$/i, url: /\/evidence/ },
      { name: /^analytics$/i, url: /\/analytics/ },
      { name: /^settings$/i, url: /\/settings/ },
      { name: /^billing$/i, url: /\/billing/ },
    ];

    for (const item of navItems) {
      // Use the desktop sidebar links
      const link = page.locator("nav").getByRole("link", { name: item.name }).first();
      if (await link.isVisible()) {
        await link.click();
        await expect(page).toHaveURL(item.url);
        // Navigate back to dashboard for the next iteration
        await page.goto("/dashboard");
      }
    }
  });

  test("should highlight active navigation item", async ({ page }) => {
    // When on the dashboard, the Dashboard link should be styled as active
    // The active indicator uses a ChevronRight icon
    const dashboardLink = page.locator("nav").getByRole("link", { name: /^dashboard$/i }).first();
    await expect(dashboardLink).toBeVisible();
    // The active link should contain a chevron-right icon
    const chevron = dashboardLink.locator("svg.lucide-chevron-right");
    await expect(chevron).toBeVisible();
  });

  test("should show Dispute2Go branding in sidebar", async ({ page }) => {
    // The sidebar should display the Dispute2Go brand name
    await expect(page.getByText("Dispute2Go").first()).toBeVisible();
  });

  test("should show user info in sidebar", async ({ page }) => {
    // The sidebar footer should show the user's name and organization
    const sidebar = page.locator(".lg\\:flex.lg\\:flex-col");
    if (await sidebar.isVisible()) {
      // There should be a Sign Out button
      await expect(
        sidebar.getByRole("button", { name: /sign out/i })
      ).toBeVisible();
    }
  });

  test("should navigate back with browser back button", async ({ page }) => {
    // Go to clients page
    await page.getByRole("link", { name: /^clients$/i }).first().click();
    await expect(page).toHaveURL(/\/clients/);

    // Use browser back button
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should navigate to client detail from clients page", async ({ page }) => {
    await page.goto("/clients");

    // If there are clients, clicking on one should navigate to client detail
    const clientRow = page.locator("[class*='cursor-pointer']").first();
    if (await clientRow.isVisible()) {
      await clientRow.click();
      // Should navigate to /clients/[id]
      await expect(page).toHaveURL(/\/clients\/.+/);
    }
  });
});

test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should show hamburger menu on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    // On mobile, the hamburger button should be visible
    const menuButton = page.locator("button").filter({
      has: page.locator("svg.lucide-menu"),
    });
    await expect(menuButton).toBeVisible();
  });

  test("should open and close mobile menu", async ({ page }) => {
    await page.goto("/dashboard");

    // Open the menu
    const menuButton = page.locator("button").filter({
      has: page.locator("svg.lucide-menu, svg.lucide-x"),
    });
    await menuButton.click();

    // Mobile nav should now be visible with navigation links
    const mobileNav = page.locator("nav").first();
    await expect(mobileNav).toBeVisible();

    // Check that navigation links are present
    await expect(
      page.getByRole("link", { name: /^dashboard$/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^clients$/i }).first()
    ).toBeVisible();

    // Close the menu by clicking a link
    await page.getByRole("link", { name: /^clients$/i }).first().click();
    await expect(page).toHaveURL(/\/clients/);
  });

  test("should navigate via mobile menu", async ({ page }) => {
    await page.goto("/dashboard");

    // Open the menu
    const menuButton = page.locator("button").filter({
      has: page.locator("svg.lucide-menu, svg.lucide-x"),
    });
    await menuButton.click();

    // Click on Disputes link in mobile menu
    await page.getByRole("link", { name: /^disputes$/i }).first().click();
    await expect(page).toHaveURL(/\/disputes/);
  });
});
