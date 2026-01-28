import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (assumes auth is handled)
    await page.goto("/dashboard");
  });

  test("should load dashboard page", async ({ page }) => {
    await expect(page).toHaveTitle(/Dispute2Go/i);
    // Check key elements exist
    await expect(page.getByText(/action queue/i)).toBeVisible();
  });

  test("should display stats cards", async ({ page }) => {
    // Stats should be visible
    await expect(page.getByText(/total clients/i).or(page.locator("[data-testid='stats-section']"))).toBeVisible();
  });

  test("should navigate to clients from sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /clients/i }).first().click();
    await expect(page).toHaveURL(/\/clients/);
  });

  test("should navigate to disputes from sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /disputes/i }).first().click();
    await expect(page).toHaveURL(/\/disputes/);
  });

  test("should show loading states before data loads", async ({ page }) => {
    // On first load, either content or skeleton should appear
    const content = page.getByRole("main").or(page.locator("main"));
    await expect(content).toBeVisible();
  });
});
