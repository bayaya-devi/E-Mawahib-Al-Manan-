import { expect, test } from "@playwright/test";

const emptyContent = { ok: true, profile: null, schedules: [], news: [], replays: [] };
const replayId = "11111111-1111-4111-8111-111111111111";

test("language switch preserves the current public page", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/ar/programs");
  await page.locator(".public-v3__language > button").click();
  await page.getByRole("link", { name: "Français", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/programs$/);
  await expect(page.locator(".public-v3")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1, name: "Que peuvent apprendre les bénéficiaires ?" })).toBeVisible();
});

test("root selects a browser language once and preserves a manual choice", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr$/);
  await page.goto("/ar");
  await page.locator(".public-v3__language > button").click();
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await context.close();
});

test("mobile menu and language menu remain usable together", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/ar");
  await page.getByRole("button", { name: "القائمة" }).click();
  await page.locator(".public-v3__language > button").click();
  await expect(page.getByRole("link", { name: "Français", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Français", exact: true }).click();
  await expect(page).toHaveURL(/\/fr$/);
});

test("contact presents the official phone and the verified map", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/ar/contact");
  await expect(page.locator('a[href="tel:+212639598936"]')).toHaveText(/0639-598936/);
  await expect(page.getByTitle("دار القرآن والحديث - جمعية مواهب المنان")).toHaveAttribute("loading", "lazy");
  await expect(page.getByRole("link", { name: "فتح الخريطة" })).toHaveAttribute("href", "https://maps.app.goo.gl/EfrBwvpKfKZmuCSd9");
});

test("language menu closes with Escape and an outside click", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/ar");
  await page.locator(".public-v3__language > button").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Français", exact: true })).toHaveCount(0);
  await page.locator(".public-v3__language > button").click();
  await page.locator("main").click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("link", { name: "Français", exact: true })).toHaveCount(0);
});

test("reduced motion leaves public content immediately accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/ar/programs");
  await expect(page.getByRole("heading", { level: 1, name: "ماذا يتعلم المستفيدون؟" })).toBeVisible();
  await expect(page.locator("[data-public-reveal]")).toHaveCount(0);
});

test("published schedule is rendered from the shared content endpoint", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: { ...emptyContent, schedules: [{ id: replayId, audience: "الطلاب", dayOfWeek: 1, startsAt: "17:30:00", endsAt: "19:00:00", location: "عين العودة", title: "حصة القرآن", notes: null }] } }));
  await page.goto("/ar/schedule");
  await expect(page.getByRole("heading", { name: "حصة القرآن" })).toBeVisible();
  await expect(page.getByText("17:30 – 19:00")).toBeVisible();
});

test("schedule keeps administration hours without an empty-state rectangle", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/fr/schedule");
  await expect(page.getByText("Samedi : 11h00 – 13h00")).toBeVisible();
  await expect(page.getByText("Dimanche : 11h00 – 13h00")).toBeVisible();
  await expect(page.locator(".public-empty")).toHaveCount(0);
});

test("published back-to-school news is displayed in the active locale", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: { ...emptyContent, news: [{ id: replayId, title: "Rentrée des cours 2026-2027", excerpt: "La rentrée des cours à Dar Al-Qur’an wal-Hadith aura lieu le lundi 7 septembre 2026.", body: "", imageUrl: null, eventDate: "2026-09-07", publishedAt: "2026-09-05T09:00:00Z" }] } }));
  await page.goto("/fr/news");
  await expect(page.getByRole("heading", { name: "Rentrée des cours 2026-2027" })).toBeVisible();
  await expect(page.locator(".public-content-grid time")).toHaveText("7 septembre 2026");
});

test("replay like updates through the protected interaction endpoint", async ({ page }) => {
  let liked = false;
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: { ...emptyContent, replays: [{ id: replayId, title: "محاضرة التجويد", description: "لقاء تعليمي", videoUrl: "https://example.com/video", thumbnailUrl: null, speaker: "الأستاذ", eventDate: "2026-08-30", featured: true, viewsCount: 12, likesCount: 4 }] } }));
  await page.route(`**/api/public/replays/${replayId}/view`, (route) => route.fulfill({ json: { ok: true, viewsCount: 13 } }));
  await page.route(`**/api/public/replays/${replayId}/like`, (route) => { liked = !liked; return route.fulfill({ json: { ok: true, liked, likesCount: liked ? 5 : 4 } }); });
  await page.goto("/ar/replays");
  const like = page.getByRole("button", { name: /4 إعجاب/ });
  await like.click();
  await expect(page.getByRole("button", { name: /5 إعجاب/ })).toBeVisible();
  await page.getByRole("button", { name: /5 إعجاب/ }).click();
  await expect(page.getByRole("button", { name: /4 إعجاب/ })).toBeVisible();
});

test("admin can publish a multilingual news item", async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await mockAdminContent(page, (body) => { payload = body; });
  await page.goto("/admin/site");
  await fillTranslations(page, "خبر الجمعية", "تفاصيل الخبر");
  await page.getByLabel("حالة النشر").selectOption("published");
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("تم الحفظ بنجاح.")).toBeVisible();
  expect(payload?.resource).toBe("news");
  expect(payload?.status).toBe("published");
});

test("admin can publish a multilingual replay", async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await mockAdminContent(page, (body) => { payload = body; });
  await page.goto("/admin/site");
  await page.getByRole("button", { name: /المحاضرات/ }).click();
  await page.getByLabel("رابط الفيديو").fill("https://example.com/replay");
  await fillTranslations(page, "محاضرة نافعة", "وصف المحاضرة");
  await page.getByLabel("حالة النشر").selectOption("published");
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("تم الحفظ بنجاح.")).toBeVisible();
  expect(payload?.resource).toBe("replay");
  expect(payload?.status).toBe("published");
});

async function mockAdminContent(page: import("@playwright/test").Page, save: (body: Record<string, unknown>) => void) {
  await page.route("**/api/admin/public-content", async (route) => {
    if (route.request().method() === "POST") { save(route.request().postDataJSON() as Record<string, unknown>); await route.fulfill({ status: 200, json: { ok: true, id: replayId } }); }
    else await route.fulfill({ json: { ok: true, news: [], newsTranslations: [], replays: [], replayTranslations: [], schedules: [], scheduleTranslations: [] } });
  });
}

async function fillTranslations(page: import("@playwright/test").Page, title: string, summary: string) {
  for (const locale of ["ar", "fr", "en", "amz"]) {
    const details = page.locator(`details:has([name="${locale}-title"])`);
    if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
    await page.locator(`[name="${locale}-title"]`).fill(`${title} ${locale}`);
    await page.locator(`[name="${locale}-summary"]`).fill(`${summary} ${locale}`);
  }
}
