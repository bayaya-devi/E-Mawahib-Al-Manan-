import { expect, test } from "@playwright/test";

const emptyContent = { ok: true, profile: null, schedules: [], news: [], replays: [] };
const replayId = "11111111-1111-4111-8111-111111111111";

test("language switch preserves the current public page", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: emptyContent }));
  await page.goto("/ar/programs");
  await page.locator(".public-v3__language summary").click();
  await page.getByRole("link", { name: "Français", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/programs$/);
  await expect(page.locator(".public-v3")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1, name: "Que peuvent apprendre les bénéficiaires ?" })).toBeVisible();
});

test("published schedule is rendered from the shared content endpoint", async ({ page }) => {
  await page.route("**/api/public/content**", (route) => route.fulfill({ json: { ...emptyContent, schedules: [{ id: replayId, audience: "الطلاب", dayOfWeek: 1, startsAt: "17:30:00", endsAt: "19:00:00", location: "عين العودة", title: "حصة القرآن", notes: null }] } }));
  await page.goto("/ar/schedule");
  await expect(page.getByRole("heading", { name: "حصة القرآن" })).toBeVisible();
  await expect(page.getByText("17:30 – 19:00")).toBeVisible();
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
