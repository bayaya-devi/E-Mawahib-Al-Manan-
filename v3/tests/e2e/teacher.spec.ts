import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("teacher home keeps the essential mobile actions accessible", async ({ page }) => {
  await page.goto("/teacher");
  await expect(page.getByRole("heading", { name: "ملخص العمل" })).toBeVisible();
  await expect(page.getByRole("link", { name: "الطلاب" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "ملفي" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /تسجيل الخروج/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /فتح البحث العام/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("retired session mode returns to the teacher dashboard", async ({ page }) => {
  await page.goto("/teacher/session");
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("heading", { name: "ملخص العمل" })).toBeVisible();
});

test("teacher navigation reaches every workspace", async ({ page }) => {
  await page.goto("/teacher/professional");
  await expect(page.getByText("الملف المهني")).toBeVisible();
  await expect(page.getByRole("button", { name: "الطلبات" })).toBeVisible();
  await page.goto("/teacher/students");
  await expect(page.getByRole("heading", { name: "الطلاب" })).toBeVisible();
  await page.goto("/teacher/messages");
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto("/teacher/settings");
  await expect(page).toHaveURL(/\/teacher$/);
});
