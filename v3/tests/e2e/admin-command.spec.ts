import { expect, test } from "@playwright/test";

test("Command home exposes today and the treatment queue", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /مركز قيادة/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "معالجة مطلوبة" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ذكاء الإدارة" })).toBeVisible();
});

test("people directory has real account creation workflow", async ({ page }) => {
  await page.goto("/admin/people");
  await expect(page.getByRole("heading", { name: "الأشخاص والملفات" })).toBeVisible();
  await page.getByRole("button", { name: /إنشاء حساب/ }).click();
  await expect(page.getByRole("dialog")).toContainText("إنشاء حساب جديد");
  await expect(page.getByLabel("نوع الحساب")).toBeVisible();
});

test("every Command domain is reachable on small screens", async ({ page }) => {
  test.setTimeout(75_000);
  for (const [path, heading] of [["operations", "الدراسة والحضور"], ["workforce", "الفريق المهني"], ["resources", "المالية والمعدات"], ["communications", "التواصل والمحتوى"], ["governance", "الحسابات والصلاحيات والتدقيق"], ["system", "سلامة المنصة"]] as const) {
    await page.goto(`/admin/${path}`); await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
