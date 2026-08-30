import { expect, test } from "@playwright/test";

test("renders the V3 foundation status", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/E-Mawahib Al-Manan V3/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Supabase Auth + RBAC + RLS")).toBeVisible();
});
