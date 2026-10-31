// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QuranCatalog } from './quran-catalog';
import { makeLearningPlan, initialLearningState } from './learning-plan';
import { getSurah } from './canonical';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('only shows the reached review and leaves the following surah accessible', async()=>{
  const plan=makeLearningPlan('review-0');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({state:{...initialLearningState,passed:true,cursor:4},version:4,round:null,finalStart:plan.finalStart,total:plan.exercises.length,questionTotal:0})}));
  render(<QuranCatalog progress={[114,113,112,111].map(surahNumber=>({surahNumber,status:'mastered',percent:100,stars:4}))}/>);
  expect(screen.getAllByRole('button',{name:'مراجعة اختيارية · 4 سور'})).toHaveLength(1);
  expect(screen.getByRole('link',{name:name=>name.includes(getSurah(110)!.nameArabic)})).toHaveAttribute('href','/student/quran/al-nasr');
  fireEvent.click(screen.getByRole('button',{name:'مراجعة اختيارية · 4 سور'}));
  await waitFor(()=>expect(screen.getByText('✓ تم بنجاح')).toBeVisible());
  expect(screen.getByRole('dialog')).toHaveTextContent('سُورَةُ النَّاسِ');
  expect(screen.getByRole('dialog')).toHaveTextContent(getSurah(111)!.nameArabic);
  fireEvent.click(screen.getByRole('button',{name:'إغلاق'}));
  expect(screen.getByRole('link',{name:name=>name.includes(getSurah(110)!.nameArabic)})).toBeVisible();
});
it('does not create review questions on locked surahs',()=>{
  render(<QuranCatalog progress={[]}/>);
  expect(screen.queryByRole('button',{name:'مراجعة اختيارية · 4 سور'})).not.toBeInTheDocument();
});
