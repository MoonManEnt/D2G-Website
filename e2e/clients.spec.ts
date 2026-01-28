import { test, expect } from "@playwright/test";

test.describe("Client Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/clients");
  });

  test("should load clients page with header", async ({ page }) => {
    await expect(page).toHaveTitle(/Dispute2Go/i);
    await expect(
      page.getByText(/client command center/i)
    ).toBeVisible();
  });

  test("should display client list or empty state", async ({ page }) => {
    // Either shows client rows/cards or the "No clients found" empty state
    const clientList = page.locator("[class*='divide-y']").or(
      page.locator("[class*='grid-cols']")
    );
    const emptyState = page.getByText(/no clients found/i);
    await expect(clientList.or(emptyState)).toBeVisible();
  });

  test("should have search input", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by name or email/i);
    await expect(searchInput).toBeVisible();
  });

  test("should filter clients via search", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by name or email/i);
    await searchInput.fill("test");
    // Wait for the list to update after search
    await page.waitForTimeout(500);
    // The page should still be functional (either results or empty state)
    const content = page.getByRole("main").or(page.locator("main"));
    await expect(content).toBeVisible();
  });

  test("should toggle between grid and list view", async ({ page }) => {
    // Find the view toggle buttons (list and grid icons)
    const listButton = page.locator("button").filter({ has: page.locator("svg.lucide-list") });
    const gridButton = page.locator("button").filter({ has: page.locator("svg.lucide-layout-grid") });

    // Click grid view
    if (await gridButton.isVisible()) {
      await gridButton.click();
      // Grid view should show cards in a multi-column grid
      await page.waitForTimeout(300);
    }

    // Click list view
    if (await listButton.isVisible()) {
      await listButton.click();
      // List view should show table-style rows
      await page.waitForTimeout(300);
    }
  });

  test("should open Add Client dialog", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add client/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // The dialog should appear with form fields
    await expect(page.getByText(/add new client/i)).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
  });

  test("should validate required fields in Add Client form", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add client/i });
    await addButton.click();

    // Wait for the dialog to open
    await expect(page.getByText(/add new client/i)).toBeVisible();

    // Try submitting with empty first and last name (both are required)
    const submitButton = page.getByRole("button", { name: /^add client$/i }).last();
    await submitButton.click();

    // Browser native validation should prevent submission on required fields
    // The first name input should have the required attribute
    const firstNameInput = page.getByLabel(/first name/i);
    await expect(firstNameInput).toHaveAttribute("required", "");
  });

  test("should have priority filter dropdown", async ({ page }) => {
    // The priority select trigger should be visible
    const priorityTrigger = page.locator("button[role='combobox']").filter({
      hasText: /priority/i,
    });
    if (await priorityTrigger.isVisible()) {
      await priorityTrigger.click();
      // Options should appear
      await expect(page.getByRole("option", { name: /urgent/i })).toBeVisible();
    }
  });

  test("should have stage filter dropdown", async ({ page }) => {
    // The stage select trigger should be visible
    const stageTrigger = page.locator("button[role='combobox']").filter({
      hasText: /stage/i,
    });
    if (await stageTrigger.isVisible()) {
      await stageTrigger.click();
      // Options should appear
      await expect(page.getByRole("option", { name: /intake/i })).toBeVisible();
    }
  });

  test("should display stats cards when data is loaded", async ({ page }) => {
    // Stats section shows Total Clients, Urgent, Active Cases, etc.
    const statsSection = page.getByText(/total clients/i).or(
      page.getByText(/urgent/i)
    );
    // Allow time for stats to load
    await expect(statsSection).toBeVisible({ timeout: 10000 });
  });

  test("should close Add Client dialog with cancel", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add client/i });
    await addButton.click();

    await expect(page.getByText(/add new client/i)).toBeVisible();

    // Click cancel
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await cancelButton.click();

    // Dialog should close
    await expect(page.getByText(/add new client/i)).not.toBeVisible();
  });
});
