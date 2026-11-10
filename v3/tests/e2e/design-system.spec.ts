import { expect, test } from "@playwright/test";

const shells = [
  ["/ar", "دار القرآن والحديث"],
  ["/student", null],
  ["/family", "متابعة الأبناء"],
  ["/teacher", "ملخص العمل"],
  ["/admin", "الصفحة الرئيسية"],
] as const;

for (const [path, heading] of shells) {
  test(`${path} renders in RTL without horizontal overflow`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    else await expect(page.getByLabel("معلومات الحصة")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("French public pages expose an LTR document and localized skip link", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toHaveAttribute("href", "#main-content");
});

test("public and login layouts reflow at the required representative widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome", "The viewport matrix only needs one browser engine.");
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const path of ["/ar", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} must not overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.locator("main").first()).toBeVisible();
    }
  }
});

test("saved dark appearance remains readable", async ({ page }) => {
  await page.goto("/student/settings");
  await page.evaluate(() => localStorage.setItem("emawahib.appearance", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(247, 247, 245)");
});

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
  await page.goto("/family");
  if ((page.viewportSize()?.width ?? 1280) <= 720) {
    await expect(page.getByRole("navigation", { name: "التنقل الرئيسي للهاتف" })).toBeVisible();
    return;
  }
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
  await search.fill("الواجبات");
  await expect(page.getByRole("link", { name: /الواجبات/ })).toBeVisible();
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
