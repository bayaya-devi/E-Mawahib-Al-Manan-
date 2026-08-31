import { expect, test } from "@playwright/test";

test("messaging and administrative requests stay distinct and mobile safe", async ({ page }) => {
  await page.goto("/student/messages");
  await expect(page.getByRole("heading", { name: "الرسائل والطلبات" })).toBeVisible();
  await expect(page.getByRole("button", { name: "الرسائل" })).toBeVisible();
  await page.getByRole("button", { name: "الطلبات" }).click();
  await expect(page.getByLabel("نوع الطلب")).toBeVisible();
  await expect(page.getByLabel("الأولوية")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("family, teacher and administration expose the unified communication workspace", async ({ page }) => {
  for (const path of ["/family/messages", "/teacher/messages", "/admin/communications"]) {
    await page.goto(path);
    await expect(page.getByText("التواصل الموحّد")).toBeVisible();
    await expect(page.getByRole("button", { name: "الطلبات" })).toBeVisible();
  }
});

test("publishes a PWA manifest and notification entry point", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
  await page.goto("/student");
  await expect(page.getByRole("button", { name: "الإشعارات" })).toBeVisible();
});

test("sends the production security boundary headers", async ({ request }) => {
  const response = await request.get("/ar");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});

test("keeps a request in IndexedDB while the device is offline", async ({ page, context }) => {
  await page.goto("/student/messages");
  await page.getByRole("button", { name: "الطلبات" }).click();
  await page.getByLabel("العنوان").fill("مشكلة في الاتصال");
  await context.setOffline(true);
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("button", { name: "إعادة محاولة المزامنة" })).toContainText("غير متزامن", { timeout: 15_000 });
  await context.setOffline(false);
});
