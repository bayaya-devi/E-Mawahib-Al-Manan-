import { expect, test } from "@playwright/test";

for (const [path, shell] of [["/student", "student"], ["/teacher", "teacher"]] as const) {
  test(`${shell} space uses the local zellige tapestry without horizontal overflow`, async ({ page }, testInfo) => {
    await page.goto(path);
    const appShell = page.locator(`.app-shell--${shell}`);
    await expect(appShell).toBeVisible();
    await expect(appShell).toHaveCSS("background-image", /dar-zellige\.svg/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`${shell}-zellige-light.png`), fullPage: true });
  });
}

test("student zellige tapestry adapts to the dark theme", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("emawahib.appearance", "dark"));
  await page.goto("/student");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(page.locator(".app-shell--student")).toHaveCSS("background-image", /dar-zellige-night\.svg/);
  await page.screenshot({ path: testInfo.outputPath("student-zellige-dark.png"), fullPage: true });
});
