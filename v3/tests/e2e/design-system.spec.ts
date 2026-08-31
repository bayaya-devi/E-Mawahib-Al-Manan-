import { expect, test } from "@playwright/test";

const shells = [
  ["/ar", "دار الحديث والقرآن"],
  ["/student", "تابع حفظك بهدوء وثبات"],
  ["/family", "متابعة الأبناء"],
  ["/teacher", "يومك الدراسي، خطوة بخطوة"],
  ["/admin", "مركز قيادة المؤسسة"],
] as const;

for (const [path, heading] of shells) {
  test(`${path} renders in RTL without horizontal overflow`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("application shell exposes responsive navigation", async ({ page }) => {
  await page.goto("/student");
  if ((page.viewportSize()?.width ?? 0) <= 720) {
    await expect(page.getByRole("navigation", { name: "التنقل الرئيسي للهاتف" })).toBeVisible();
    await expect(page.locator(".app-rail")).toBeHidden();
  } else {
    await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeVisible();
  }
});

test("global search opens from keyboard and closes with Escape", async ({ page }) => {
  await page.goto("/teacher");
  const trigger = page.getByRole("button", { name: "فتح البحث العام" });
  await trigger.click();
  const search = page.getByRole("textbox", { name: "ابحث في المنصة" });
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  if ((page.viewportSize()?.width ?? 0) > 720) {
    await trigger.focus();
    await page.keyboard.press("Control+K");
    await expect(search).toBeFocused();
  } else {
    await trigger.click();
  }
  await search.fill("الطلاب");
  await expect(page.getByRole("link", { name: /الطلاب/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
});

test("dialog traps focus and supports keyboard dismissal", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: "فتح نافذة" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  const focusInsideDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  expect(focusInsideDialog).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
