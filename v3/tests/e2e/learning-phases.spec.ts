import { expect, test } from "@playwright/test";
import { getSurah } from "../../src/features/quran/canonical";
import { advanceLearning, currentRound, initialLearningState, makeLearningPlan } from "../../src/features/quran/learning-plan";

test("multi-question learning, retry, final test and audio revisit", async ({ page }) => {
  test.setTimeout(120_000);
  let state = { ...initialLearningState }; let version = 0; const key = "surah-114";
  await page.route("**/api/student/learning**", async (route) => {
    let plan = makeLearningPlan(key, state.attempt);
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.version !== version) { await route.fulfill({ status: 409, json: { error: "conflict" } }); return; }
      const item = currentRound(plan, state);
      state = advanceLearning(plan, state, Boolean(item && body.answer === item.answer), body.retry); version += 1; plan = makeLearningPlan(key, state.attempt);
    }
    const item = currentRound(plan, state); const exercise = plan.exercises[state.cursor];
    await route.fulfill({ json: { state, version, round: item ? { kind: item.kind, prompt: item.prompt, options: item.options, verseNumber: item.verseNumber } : null, finalStart: plan.finalStart, total: plan.exercises.length, questionTotal: exercise?.rounds.length ?? 0 } });
  });
  await page.goto(`/student/quran/${getSurah(114)!.slug}`);
  await expect(page.locator("audio")).toHaveAttribute("src", /api\/quran\/audio\/114001/);
  await page.getByRole("button", { name: "قراءة الكل", exact: true }).click();
  await page.locator("audio").evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
  await expect(page.locator("audio")).toHaveAttribute("src", /api\/quran\/audio\/114002/);
  await page.reload();
  await expect(page.locator("audio")).toHaveAttribute("src", /api\/quran\/audio\/114001/);
  await page.getByRole("button", { name: "متابعة", exact: true }).click();

  async function answer(correct: boolean) {
    await expect(page.locator(".exercise-result")).toHaveCount(0, { timeout: 2_000 });
    const plan = makeLearningPlan(key, state.attempt); const item = currentRound(plan, state)!; const before = version;
    if (item.kind === "verse_order") {
      const ordered = correct ? [...item.options].sort((a, b) => item.answer.indexOf(a) - item.answer.indexOf(b)) : [...item.options].reverse();
      for (const fragment of ordered) await page.locator(".learning-word-bank button:enabled").filter({ hasText: fragment }).first().click();
      await page.getByRole("button", { name: "تحقق", exact: true }).click();
    } else {
      const value = correct ? item.answer : item.options.find((option) => option !== item.answer)!;
      await page.getByRole("button", { name: value, exact: true }).click();
    }
    await expect.poll(() => version).toBe(before + 1);
  }

  await answer(true); await answer(true); await answer(false); await answer(true); await answer(true); await answer(true);
  expect(state.cursor).toBe(1); expect(state.lastResult).toMatchObject({ correct: 5, errors: 1, passed: true });
  await answer(false); await answer(false);
  await expect(page.getByRole("heading", { name: "أعد المحاولة" })).toBeVisible();
  await page.getByRole("button", { name: "إعادة", exact: true }).click(); await expect.poll(() => state.failed).toBe(false);
  while (!state.passed) await answer(true);
  await expect(page.getByRole("heading", { name: "✓ تم بنجاح" })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "متابعة", exact: true }).click();
  await expect(page.getByRole("heading", { name: "✓ تم بنجاح" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
