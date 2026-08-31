import { expect, test } from "@playwright/test";

test("teacher home keeps the essential mobile actions accessible", async ({ page }) => {
  await page.goto("/teacher");
  await expect(page.getByRole("heading", { name: "يومك الدراسي، خطوة بخطوة" })).toBeVisible();
  await expect(page.getByRole("link", { name: /وضع الحصة/ }).first()).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("session mode is progressive and does not invent a scheduled course", async ({ page }) => {
  await page.goto("/teacher/session");
  await expect(page.getByRole("heading", { name: "ابدأ الحصة بوضوح" })).toBeVisible();
  await expect(page.getByRole("button", { name: /بدء الحصة/ })).toBeDisabled();
  await expect(page.getByText("تسجيل الحضور")).not.toBeVisible();
});

test("teacher navigation reaches every workspace", async ({ page }) => {
  await page.goto("/teacher/professional");
  await expect(page.getByRole("heading", { name: "كل شؤونك المهنية في مكان واضح" })).toBeVisible();
  await expect(page.getByRole("button", { name: "الطلبات" })).toBeVisible();
  await page.goto("/teacher/students");
  await expect(page.getByRole("heading", { name: "الطلاب" })).toBeVisible();
  await page.goto("/teacher/messages");
  await expect(page.getByRole("heading", { name: "الرسائل" })).toBeVisible();
});
