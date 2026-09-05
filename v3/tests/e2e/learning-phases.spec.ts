import { expect, test } from '@playwright/test';
import { getSurah } from '../../src/features/quran/canonical';
import { advanceLearning, initialLearningState, makeLearningPlan } from '../../src/features/quran/learning-plan';

test('long-surah resume, phase audio bounds, errors and global validation', async ({ page }) => {
  let state={...initialLearningState}; let version=0;
  const key='surah-96';
  await page.route('**/api/student/learning**',async route=>{
    let plan=makeLearningPlan(key,state.attempt);
    if(route.request().method()==='POST') {
      const body=route.request().postDataJSON();
      if(body.version!==version) { await route.fulfill({status:409,json:{error:'conflict'}});return; }
      state=advanceLearning(plan,state,body.answer===plan.rounds[state.cursor]?.answer,body.retry);version++;
      plan=makeLearningPlan(key,state.attempt);
    }
    const round=plan.rounds[state.cursor];
    await route.fulfill({json:{state,version,round:round?{kind:round.kind,prompt:round.prompt,options:round.options,verseNumber:round.verseNumber}:null,finalStart:plan.finalStart,total:plan.rounds.length}});
  });
  await page.goto(`/student/quran/${getSurah(96)!.slug}`);
  await expect(page.locator('.learning-phase-label')).toContainText('1 / 3');
  await expect(page.locator('.verse-reader button')).toHaveCount(5);
  async function solve() {
    const continueButton=page.getByRole('button',{name:'متابعة',exact:true});
    if(await continueButton.isVisible().catch(()=>false)) await continueButton.click();
    const plan=makeLearningPlan(key,state.attempt);const round=plan.rounds[state.cursor]!;
    if(round.kind==='verse_order') {
      const ordered=[...round.options].sort((a,b)=>round.answer.indexOf(a)-round.answer.indexOf(b));
      for(const fragment of ordered) await page.locator('.learning-word-bank button:enabled').filter({hasText:fragment}).first().click();
      await page.getByRole('button',{name:'تحقق',exact:true}).click();
    } else await page.locator('.student-exercise__options button').filter({hasText:round.answer}).first().click();
    await expect(page.locator('.student-exercise')).toHaveAttribute('aria-busy','false');
  }
  for(let i=0;i<4;i++) await solve();
  await expect(page.locator('.learning-phase-label')).toContainText('2 / 3');
  await expect(page.locator('audio')).toHaveAttribute('src',/096006\.mp3$/);
  await page.reload();
  await expect(page.locator('.learning-phase-label')).toContainText('2 / 3');
  await page.locator('audio').evaluate(el => el.dispatchEvent(new Event('ended')));
  await expect(page.locator('audio')).toHaveAttribute('src',/096007\.mp3$/);
  for(let verse=7;verse<=10;verse++) await page.locator('audio').evaluate(el=>el.dispatchEvent(new Event('ended')));
  await expect(page.locator('audio')).toHaveAttribute('src',/096010\.mp3$/);
  for(let i=0;i<8;i++) await solve();
  await expect(page.locator('.learning-phase-label')).toContainText('الاختبار الشامل');
  const wrong=makeLearningPlan(key).rounds[state.cursor]!.options.find(o=>o!==makeLearningPlan(key).rounds[state.cursor]!.answer)!;
  for(let i=0;i<2;i++) {await page.getByRole('button',{name:wrong,exact:true}).click();await expect(page.locator('.student-exercise')).toHaveAttribute('aria-busy','false');}
  await expect(page.getByRole('heading',{name:'أعد المحاولة'})).toBeVisible();
  expect(state.passed).toBe(false);
  await page.getByRole('button',{name:'إعادة',exact:true}).last().click();
  await expect(page.locator('.student-exercise')).toHaveAttribute('aria-busy','false');
  for(let i=0;i<3;i++) await solve();
  await expect(page.getByRole('heading',{name:'✓ تم بنجاح'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'✓ تم بنجاح'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`test-results/phases-${page.viewportSize()?.width}.png`,fullPage:true});
});
