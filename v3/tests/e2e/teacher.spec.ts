import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("teacher home keeps the essential mobile actions accessible", async ({ page }) => {
  await page.goto("/teacher");
  await expect(page.getByRole("heading", { name: /مرحبًا/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /بدء حصة/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /تسجيل الخروج/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /فتح البحث العام/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("session mode explains why a session cannot start without an assigned class", async ({ page }) => {
  await page.goto("/teacher/session");
  await expect(page.getByRole("link", { name: "الرئيسية" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "هل أنت مستعد(ة) لبدء الحصة؟" })).toBeVisible();
  await expect(page.getByRole("button", { name: /بدء الحصة/ })).toBeDisabled();
  await expect(page.getByText(/تعذر التحقق|لا يوجد قسم مسند/)).toBeVisible();
  await expect(page.getByText("تسجيل الحضور")).not.toBeVisible();
});

test("teacher navigation reaches every workspace", async ({ page }) => {
  await page.goto("/teacher/classes");
  await expect(page.getByRole("heading", { name: "الأقسام المسندة" })).toBeVisible();
  await page.goto("/teacher/professional");
  await expect(page.getByText("الملف المهني")).toBeVisible();
  await expect(page.getByRole("button", { name: "الطلبات" })).toBeVisible();
  await page.goto("/teacher/students");
  await expect(page.getByRole("heading", { name: "الطلاب" })).toBeVisible();
  await page.goto("/teacher/messages");
  await expect(page.getByRole("heading", { name: "المراسلات" })).toBeVisible();
  await expect(page.getByRole("button", { name: "الواردة" })).toBeVisible();
  await expect(page.getByRole("button", { name: "المرسلة" })).toBeVisible();
  await page.getByRole("button", { name: "رسالة جديدة" }).click();
  await expect(page.getByText("الإدارة", { exact: true })).toBeVisible();
  await expect(page.getByLabel("الموضوع")).toBeVisible();
  await expect(page.getByLabel("الرسالة")).toBeVisible();
  await page.goto("/teacher/settings");
  await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "المظهر" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "الحسابات" })).toBeVisible();
});

test("teacher student enrollment entry point stays explicit when no class is assigned", async ({ page }) => {
  await page.goto("/teacher/students");
  await page.getByRole("button", { name: "إضافة طالب" }).click();
  await expect(page.getByRole("heading", { name: "إضافة طالب" })).toBeVisible();
  await expect(page.getByText("لا يوجد قسم مسند", { exact: true })).toBeVisible();
  await expect(page.getByText(/لا يمكنك تسجيل طالب/)).toBeVisible();
});
