import { expect, test } from "@playwright/test";

test.describe("student and family V3", () => {
  test("uses one Quran route for the complete 114-surah catalog", async ({ page }) => {
    await page.goto("/student/quran");
    await expect(page.getByRole("heading", { name: "مسار السور" })).toBeVisible();
    await expect(page.locator(".juz-path")).toHaveCount(2);
    await expect(page.getByRole("link", { name: /سُورَةُ النَّاسِ/ })).toHaveAttribute("href", "/student/quran/al-nas");
    await page.goto("/student/quran/al-nas");
    await expect(page).toHaveURL(/\/student\/quran\/al-nas$/);
    await expect(page.getByRole("heading", { name: "سُورَةُ النَّاسِ" })).toBeVisible();
    await expect(page.locator(".verse-reader button")).toHaveCount(6);
    await expect(page.getByRole("button", { name: /تشغيل|إيقاف مؤقت/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /قراءة الكل/ })).toBeVisible();
  });

  test("keeps core student navigation visible and pages free of horizontal overflow", async ({ page }) => {
    await page.goto("/student");
    const viewport = page.viewportSize();
    const navigation = page.getByRole("navigation", { name: viewport && viewport.width <= 720 ? "التنقل الرئيسي للهاتف" : "التنقل الرئيسي" }).first();
    await expect(navigation).toBeVisible();
    for (const label of ["الرئيسية", "السور", "متابعة الحفظ", "ملفي"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "الألعاب" })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("shows a safe family empty state without exposing another child", async ({ page }) => {
    await page.goto("/family");
    await expect(page.getByRole("heading", { name: "لا يوجد حساب طفل مرتبط" })).toBeVisible();
    await expect(page.getByText("تظهر الحسابات هنا بعد أن تربطها الإدارة بحساب الأسرة.")).toBeVisible();
  });

  test("keeps pedagogical follow-up reachable and redirects retired student routes", async ({ page }) => {
    await page.goto("/student/follow-up");
    await expect(page.getByRole("heading", { name: "متابعة الحفظ" })).toBeVisible();
    await expect(page.getByText("لا توجد متابعة مسجلة")).toBeVisible();
    await page.goto("/student/settings");
    await expect(page).toHaveURL(/\/student$/);
    await page.goto("/student/games");
    await expect(page).toHaveURL(/\/student$/);
  });
});
