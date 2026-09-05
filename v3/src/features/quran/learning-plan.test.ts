import { describe, expect, it } from 'vitest';
import { getAllSurahs, getSurah } from './canonical';
import { advanceLearning, initialLearningState, learningOrder, makeLearningPlan, passage, phasesFor, reviewGroups } from './learning-plan';

describe('four-surah reviews', () => {
  it('uses deterministic continuous groups, with no remainder invented', () => {
    expect(reviewGroups[0]).toEqual([114,113,112,111]);
    expect(reviewGroups.flat()).toEqual(learningOrder.slice(0,112));
    for (let i=0;i<reviewGroups.length;i++) {
      const plan=makeLearningPlan(`review-${i}`);
      expect(plan.rounds).toHaveLength(4);
      expect(plan.rounds.map(r=>Number(r.id.split('-')[0]))).toEqual(reviewGroups[i]);
    }
  });
  it.each([0,1,2])('handles %i errors without changing the main path', errors => {
    const plan=makeLearningPlan('review-0'); let state={...initialLearningState};
    for(let i=0;i<errors;i++) state=advanceLearning(plan,state,false);
    for(let i=0;i<4;i++) state=advanceLearning(plan,state,true);
    expect(state.passed).toBe(errors<=1);
    expect(reviewGroups[1]?.[0]).toBe(110);
  });
  it('keeps a passed review passed when replayed or restored',()=>{
    const plan=makeLearningPlan('review-0'); let state={...initialLearningState};
    for(let i=0;i<4;i++) state=advanceLearning(plan,state,true);
    expect(advanceLearning(plan,JSON.parse(JSON.stringify(state)),false,true)).toEqual(state);
  });
});
describe('surah phases',()=>{
  it('preserves the short surah workflow',()=>{const plan=makeLearningPlan('surah-114');expect(plan.phases).toEqual([{from:1,to:6}]);expect(plan.finalStart).toBe(4);expect(plan.rounds).toHaveLength(5);});
  it('covers every canonical verse exactly once for all 114 surahs',()=>{
    for(const surah of getAllSurahs()) {
      const phases=phasesFor(surah);
      expect(phases.flatMap(p=>passage(surah,p).verses)).toEqual(surah.verses);
      if(surah.verseCount>=13) expect(phases.length).toBeGreaterThan(1);
      const plan=makeLearningPlan(`surah-${surah.number}`);
      phases.forEach((phase,i)=>plan.rounds.slice(i*4,i*4+4).forEach(round=>{expect(round.verseNumber).toBeGreaterThanOrEqual(phase.from);expect(round.verseNumber).toBeLessThanOrEqual(phase.to);}));
    }
  });
  it('honors reviewed overrides and retains original verse/audio identifiers',()=>{
    const surah=getSurah(96)!;expect(phasesFor(surah)).toEqual([{from:1,to:5},{from:6,to:10},{from:11,to:19}]);
    expect(passage(surah,phasesFor(surah)[1]!).verses[0]).toEqual(surah.verses[5]);
  });
  it('cannot advance after two errors, then resumes the same exercise',()=>{
    const plan=makeLearningPlan('surah-96');let state={...initialLearningState};
    state=advanceLearning(plan,state,false);state=advanceLearning(plan,state,false);
    expect(advanceLearning(plan,state,true).cursor).toBe(0);
    state=advanceLearning(plan,state,false,true);expect(state.cursor).toBe(0);
    for(let i=0;i<4;i++) state=advanceLearning(plan,state,true);
    expect(state.cursor).toBe(4);expect(state.passed).toBe(false);
    const restored=JSON.parse(JSON.stringify(state));expect(advanceLearning(plan,restored,true).cursor).toBe(5);
  });
  it('requires the global test and preserves phases after a failed final',()=>{
    const plan=makeLearningPlan('surah-96');let state={...initialLearningState};
    for(let i=0;i<plan.finalStart;i++) state=advanceLearning(plan,state,true);
    expect(state.passed).toBe(false);
    state=advanceLearning(plan,state,false);state=advanceLearning(plan,state,false);
    expect(state.failed).toBe(true);expect(state.passed).toBe(false);
    state=advanceLearning(plan,state,false,true);expect(state.cursor).toBe(plan.finalStart);
    while(!state.passed) state=advanceLearning(plan,state,true);
    expect(state.cursor).toBe(plan.rounds.length);
  });
});
