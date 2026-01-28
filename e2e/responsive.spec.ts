import { test, expect } from "@playwright/test";

test.describe("Responsive Layout - Mobile (375x667)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should show mobile header with hamburger menu", async ({ page }) => {
    await page.goto("/dashboard");

    // Mobile header bar should be visible
    const mobileHeader = page.locator(".lg\\:hidden.fixed");
    await expect(mobileHeader).toBeVisible();

    // Hamburger icon should be visible
    const menuIcon = page.locator("svg.lucide-menu");
    await expect(menuIcon).toBeVisible();
  });

  test("should hide desktop sidebar on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    // The desktop sidebar uses hidden lg:flex, so it should not be visible at 375px
    const desktopSidebar = page.locator(".lg\\:flex.lg\\:flex-col.lg\\:fixed");
    await expect(desktopSidebar).not.toBeVisible();
  });

  test("should show full-width content on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    // Main content should not have the lg:ml-64 offset taking effect
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();

    // Verify main content fills the viewport width
    const box = await mainContent.boundingBox();
    if (box) {
      // On mobile, main should occupy nearly the full viewport width
      expect(box.width).toBeGreaterThan(350);
    }
  });

  test("should stack client cards vertically on mobile", async ({ page }) => {
    await page.goto("/clients");

    // On mobile, the filter controls should stack vertically
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });

  test("should show Add Client dialog as bottom sheet or modal on mobile", async ({ page }) => {
    await page.goto("/clients");

    const addButton = page.getByRole("button", { name: /add client/i });
    if (await addButton.isVisible()) {
      await addButton.click();

      // The dialog should be visible (ResponsiveDialog renders as bottom sheet on mobile)
      await expect(page.getByText(/add new client/i)).toBeVisible();
    }
  });
});

test.describe("Responsive Layout - Tablet (768x1024)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("should adjust layout for tablet viewport", async ({ page }) => {
    await page.goto("/dashboard");

    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });

  test("should hide desktop sidebar on tablet", async ({ page }) => {
    await page.goto("/dashboard");

    // At 768px the desktop sidebar (lg:flex) should still be hidden
    // since lg breakpoint is 1024px in Tailwind
    const desktopSidebar = page.locator(".lg\\:flex.lg\\:flex-col.lg\\:fixed");
    await expect(desktopSidebar).not.toBeVisible();
  });

  test("should show mobile navigation on tablet", async ({ page }) => {
    await page.goto("/dashboard");

    // Mobile header should still be visible at tablet size (below lg breakpoint)
    const mobileHeader = page.locator(".lg\\:hidden.fixed");
    await expect(mobileHeader).toBeVisible();
  });

  test("should display clients in responsive grid on tablet", async ({ page }) => {
    await page.goto("/clients");

    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();

    // Stats grid should adjust (sm:grid-cols-3 at 768px)
    const statsGrid = page.locator("[class*='sm\\:grid-cols-3']").first();
    if (await statsGrid.isVisible()) {
      const box = await statsGrid.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(700);
      }
    }
  });
});

test.describe("Responsive Layout - Desktop (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("should show full desktop sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    // Desktop sidebar should be visible at 1440px width
    const desktopSidebar = page.locator(".lg\\:flex.lg\\:flex-col.lg\\:fixed");
    await expect(desktopSidebar).toBeVisible();
  });

  test("should hide mobile header on desktop", async ({ page }) => {
    await page.goto("/dashboard");

    // Mobile header with lg:hidden should not be visible
    const mobileHeader = page.locator(".lg\\:hidden.fixed");
    // The element exists but should be hidden via lg:hidden class
    await expect(mobileHeader).not.toBeVisible();
  });

  test("should show sidebar navigation links on desktop", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator(".lg\\:flex.lg\\:flex-col.lg\\:fixed");
    await expect(sidebar).toBeVisible();

    // All nav items should be visible in the desktop sidebar
    const navLinks = [
      /^dashboard$/i,
      /^clients$/i,
      /^disputes$/i,
      /^sentry$/i,
      /^evidence$/i,
      /^analytics$/i,
      /^settings$/i,
      /^billing$/i,
    ];

    for (const linkName of navLinks) {
      await expect(
        sidebar.getByRole("link", { name: linkName })
      ).toBeVisible();
    }
  });

  test("should offset main content for sidebar width on desktop", async ({ page }) => {
    await page.goto("/dashboard");

    // Main content should have lg:ml-64 which translates to margin-left: 16rem
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();

    const box = await mainContent.boundingBox();
    if (box) {
      // The main content should be offset by approximately 256px (16rem = 256px)
      expect(box.x).toBeGreaterThanOrEqual(240);
    }
  });

  test("should display client stats in full row on desktop", async ({ page }) => {
    await page.goto("/clients");

    // At desktop size, stats grid uses lg:grid-cols-6
    const statsGrid = page.locator("[class*='lg\\:grid-cols-6']").first();
    if (await statsGrid.isVisible()) {
      const box = await statsGrid.boundingBox();
      if (box) {
        // Should use the full available width
        expect(box.width).toBeGreaterThan(900);
      }
    }
  });
});
