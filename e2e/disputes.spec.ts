import { test, expect } from "@playwright/test";

test.describe("Dispute Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/disputes");
  });

  test("should load disputes page", async ({ page }) => {
    await expect(page).toHaveTitle(/Dispute2Go/i);
    // The disputes page should render its main content area
    const mainContent = page.getByRole("main").or(page.locator("main"));
    await expect(mainContent).toBeVisible();
  });

  test("should display dispute creation tab", async ({ page }) => {
    // DisputesEnhanced has tabs: create, history, responses, etc.
    const createTab = page.getByRole("tab", { name: /create/i }).or(
      page.getByText(/create/i).first()
    );
    await expect(createTab).toBeVisible();
  });

  test("should display history tab", async ({ page }) => {
    const historyTab = page.getByRole("tab", { name: /history/i }).or(
      page.getByText(/history/i).first()
    );
    await expect(historyTab).toBeVisible();
  });

  test("should switch between tabs", async ({ page }) => {
    // Click on history tab
    const historyTab = page.getByRole("tab", { name: /history/i }).or(
      page.getByText(/history/i).first()
    );
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(300);
    }

    // Switch back to create tab
    const createTab = page.getByRole("tab", { name: /create/i }).or(
      page.getByText(/create/i).first()
    );
    if (await createTab.isVisible()) {
      await createTab.click();
      await page.waitForTimeout(300);
    }
  });

  test("should show client selector in create tab", async ({ page }) => {
    // The create dispute flow requires selecting a client
    // Look for a client dropdown/selector
    const clientSelector = page.locator("button[role='combobox']").or(
      page.getByText(/select.*client/i)
    );
    await expect(clientSelector.first()).toBeVisible({ timeout: 10000 });
  });

  test("should show CRA selector options", async ({ page }) => {
    // The disputes page shows CRA selection (TransUnion, Experian, Equifax)
    const craSelector = page
      .getByText(/transunion/i)
      .or(page.getByText(/experian/i))
      .or(page.getByText(/equifax/i));
    await expect(craSelector.first()).toBeVisible({ timeout: 10000 });
  });

  test("should show dispute flow type options", async ({ page }) => {
    // Flow types include ACCURACY, FCRA, VALIDATION, etc.
    const flowOption = page
      .getByText(/accuracy/i)
      .or(page.getByText(/validation/i))
      .or(page.getByText(/fcra/i));
    await expect(flowOption.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display dispute history when history tab is active", async ({ page }) => {
    const historyTab = page.getByRole("tab", { name: /history/i }).or(
      page.getByText(/history/i).first()
    );
    if (await historyTab.isVisible()) {
      await historyTab.click();
      // Either dispute cards appear or an empty state message
      const disputeContent = page.getByText(/no disputes/i).or(
        page.locator("[class*='card']").first()
      );
      await expect(disputeContent).toBeVisible({ timeout: 10000 });
    }
  });

  test("should navigate to disputes page from URL", async ({ page }) => {
    await page.goto("/disputes");
    await expect(page).toHaveURL(/\/disputes/);
  });
});
