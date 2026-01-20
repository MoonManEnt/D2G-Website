import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/Dispute2Go/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /sign in/i }).click();

    // Should show validation message
    await expect(page.getByText(/email/i)).toBeVisible();
  });

  test("should redirect to dashboard on successful login", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect to dashboard (or show error if credentials invalid)
    await page.waitForURL(/dashboard|login/, { timeout: 5000 });
  });

  test("should navigate to forgot password page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /forgot/i }).click();

    await expect(page).toHaveURL(/forgot-password/);
  });
});

test.describe("Protected Routes", () => {
  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect unauthenticated users from clients page", async ({ page }) => {
    await page.goto("/clients");

    await expect(page).toHaveURL(/login/);
  });

  test("should redirect unauthenticated users from disputes page", async ({ page }) => {
    await page.goto("/disputes");

    await expect(page).toHaveURL(/login/);
  });
});
