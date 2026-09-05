import { expect, test } from "@playwright/test";

test("admin home is compact and uses the required limits", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "الصفحة الرئيسية" }),
  ).toBeVisible();
  await expect(page.locator(".command-metrics article")).toHaveCount(4);
  await expect(
    page.locator(".compact-records").first().locator("details"),
  ).toHaveCount(0);
  await expect(page.getByText("مركز قيادة")).toHaveCount(0);
});

test("student and teacher directories expose real creation workflows", async ({
  page,
}) => {
  for (const [path, title, button] of [
    ["teachers", "الأساتذة", "إضافة أستاذ"],
    ["students", "الطلاب", "إضافة طالب"],
  ] as const) {
    await page.goto(`/admin/${path}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("اسم الدخول")).toBeVisible();
    await page.getByRole("button", { name: "إغلاق" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("all nine admin destinations are reachable on mobile", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const [path, heading] of [
    ["", "الصفحة الرئيسية"],
    ["teachers", "الأساتذة"],
    ["students", "الطلاب"],
    ["parents", "الوالدان"],
    ["finance", "المالية"],
    ["communications", "التواصل"],
    ["monitoring", "المتابعة"],
    ["site", "إدارة الموقع"],
    ["settings", "الإعدادات"],
  ] as const) {
    await page.goto(`/admin${path ? `/${path}` : ""}`);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }).first(),
    ).toBeVisible();
  }
});

test("admin navigation folds and global search is absent", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "فتح البحث العام" }),
  ).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1280) < 760) {
    const toggle = page.getByRole("button", { name: "إظهار قائمة التنقل" });
    await toggle.click();
    await expect(page.locator(".app-shell")).not.toHaveClass(
      /is-navigation-collapsed/,
    );
    await page.getByRole("button", { name: "إخفاء قائمة التنقل" }).click();
    await expect(page.locator(".app-shell")).toHaveClass(
      /is-navigation-collapsed/,
    );
    return;
  }
  const toggle = page.getByRole("button", { name: "طي قائمة التنقل" });
  await toggle.click();
  await expect(page.locator(".app-shell")).toHaveClass(
    /is-navigation-collapsed/,
  );
  await page.getByRole("button", { name: "فتح قائمة التنقل" }).click();
  await expect(page.locator(".app-shell")).not.toHaveClass(
    /is-navigation-collapsed/,
  );
});
