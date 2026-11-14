import { expect, test } from "@playwright/test";
import { getSurah } from "../../src/features/quran/canonical";

test("same-origin Warsh audio serves several exact ayah codes with byte-range support", async ({ request }) => {
  for (const code of ["001001", "002255", "096019", "114006"]) {
    const response = await request.get(`/api/quran/audio/${code}`, { headers: { Range: "bytes=0-1023" }, timeout: 30_000 });
    expect([200, 206]).toContain(response.status());
    expect(response.headers()["content-type"]).toContain("audio");
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }
});

test("Warsh player plays, pauses, resumes and changes verse in a real browser", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/student/quran/${getSurah(114)!.slug}`);
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /api\/quran\/audio\/114001/);
  await audio.evaluate((element: HTMLAudioElement) => element.readyState >= 3
    ? undefined
    : new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("audio_canplay_timeout")), 30_000);
      element.addEventListener("canplay", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
      element.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("audio_load_failed")); }, { once: true });
      element.load();
    }));
  // Headless CI has no physical audio sink. Muting still exercises network
  // loading, media decoding, the play promise and every UI state transition.
  await audio.evaluate((element: HTMLAudioElement) => { element.muted = true; });

  await page.getByRole("button", { name: "تشغيل", exact: true }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
  await page.getByRole("button", { name: "إيقاف مؤقت", exact: true }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "تشغيل", exact: true }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);

  await page.getByRole("button", { name: "الآية التالية", exact: true }).click();
  await expect(audio).toHaveAttribute("src", /api\/quran\/audio\/114002/);
});

test("Warsh player exposes a clear error after both reviewed sources fail", async ({ page }) => {
  await page.route("**/api/quran/audio/**", (route) => route.abort("internetdisconnected"));
  await page.goto(`/student/quran/${getSurah(114)!.slug}`);
  await expect(page.locator(".audio-notice[role='alert']")).toContainText("تعذر تحميل الصوت");
});
