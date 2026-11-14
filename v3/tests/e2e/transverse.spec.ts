import { expect, test } from "@playwright/test";

test("retired student messaging route returns to the student dashboard", async ({ page }) => {
  await page.goto("/student/messages");
  await expect(page).toHaveURL(/\/student$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("family and administration expose the unified communication workspace", async ({ page }) => {
  for (const path of ["/family/messages", "/admin/communications"]) {
    await page.goto(path);
    await expect(page.getByText("التواصل الموحّد")).toBeVisible();
    await expect(page.getByRole("button", { name: "الطلبات" })).toBeVisible();
  }
  await page.goto("/teacher/messages");
  await expect(page).toHaveURL(/\/teacher$/);
});

test("publishes a PWA manifest and notification entry point", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
  await page.goto("/student");
  await expect(page.getByRole("button", { name: "الإشعارات" })).toBeVisible();
});

test("family communication settings stay reachable while retired role settings redirect", async ({ page }) => {
  await page.goto("/family/settings");
  await expect(page.getByRole("heading", { name: "وسائل الاتصال" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تفضيلات الإشعارات" })).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto("/student/settings");
  await expect(page).toHaveURL(/\/student$/);
  await page.goto("/teacher/settings");
  await expect(page).toHaveURL(/\/teacher$/);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("administration exposes the audited notification composer", async ({ page }) => {
  await page.goto("/admin/communications");
  await expect(page.getByRole("heading", { name: "التواصل", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "معاينة المستلمين" })).toBeVisible();
});

test("sends the production security boundary headers", async ({ request }) => {
  const response = await request.get("/ar");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});

test("keeps a request in IndexedDB while the device is offline", async ({ page, context }) => {
  await page.goto("/family/messages");
  await page.getByRole("button", { name: "الطلبات" }).click();
  await page.getByLabel("العنوان").fill("مشكلة في الاتصال");
  await context.setOffline(true);
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("button", { name: "إعادة محاولة المزامنة" })).toContainText("غير متزامن", { timeout: 15_000 });
  await context.setOffline(false);
});
