"use client";
import { useState } from 'react';
import { Dialog, Button } from '@/components/ui';
import { LearningExercise } from './learning-exercise';
import { getSurah } from './canonical';
export function ReviewCheckpoint({ index, group }: { index: number; group: readonly number[] }) {
  const [opened, setOpened] = useState(false);
  return <div className="review-checkpoint"><Dialog title="مراجعة أربع سور" description={group.map(n => getSurah(n)?.nameArabic).join(' · ')} trigger={<Button variant="secondary" onClick={() => setOpened(true)}>مراجعة اختيارية · 4 سور</Button>}>{opened ? <LearningExercise learningKey={`review-${index}`} /> : null}</Dialog></div>;
}
