import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { advanceLearning, currentRound, initialLearningState, makeLearningPlan, learningOrder, upgradeLearningState, type LearningState } from '@/features/quran/learning-plan';
import { isCorrect } from '@/features/games/engine';
import { hasTrustedOrigin } from '@/lib/http/same-origin';
import { getActiveStudentContext } from '@/features/learning/student-context';

const inputSchema = z.object({ key: z.string().regex(/^(surah|review|juz)-\d+$/), version: z.number().int().nonnegative(), answer: z.string().max(20000).optional(), retry: z.boolean().optional() });
async function context(key: string) {
  const client = await createClient();
  const active = await getActiveStudentContext();
  if (!active) throw new Error('unauthorized');
  const studentId = active.studentId;
  const [profile, roles, progress, session, juzEvents] = await Promise.all([
    client.from('profiles').select('status').eq('id', studentId).single(),
    client.from('user_roles').select('role').eq('user_id', studentId),
    client.from('student_surah_progress').select('surah_number,status').eq('student_id', studentId),
    client.from('student_learning_sessions').select('state,version').eq('student_id', studentId).eq('learning_key', key).maybeSingle(),
    client.from('learning_events').select('metadata').eq('student_id', studentId).eq('event_kind', 'juz_completed'),
  ]);
  if (profile.error || roles.error || progress.error || session.error || juzEvents.error) throw new Error('storage_unavailable');
  if (profile.data.status !== 'active' || !roles.data.some(r => r.role === 'student')) throw new Error('unauthorized');
  const state: LearningState = session.data ? upgradeLearningState(session.data.state) : { ...initialLearningState };
  const plan = makeLearningPlan(key, state.attempt);
  const mastered = new Set(progress.data.filter(p => p.status === 'mastered').map(p => p.surah_number));
  const completedJuz = new Set((juzEvents.data ?? []).map((event) => {
    const metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {};
    return Number(metadata.juz_number);
  }));
  const previousJuzComplete = plan.mode !== 'juz_exam' || plan.juz === 30 || completedJuz.has((plan.juz ?? 30) + 1);
  if (plan.surah === null ? !plan.group.every(n => mastered.has(n)) || !previousJuzComplete : !mastered.has(plan.surah) && learningOrder.find(n => !mastered.has(n)) !== plan.surah) throw new Error('locked');
  return { student: studentId, state, plan, version: session.data?.version ?? 0 };
}
function view(value: Awaited<ReturnType<typeof context>>) {
  const round = currentRound(value.plan, value.state);
  const exercise = value.plan.exercises[value.state.cursor];
  return { state: value.state, version: value.version, round: round ? { kind: round.kind, prompt: round.prompt, options: round.options, verseNumber: round.verseNumber } : null, finalStart: value.plan.finalStart, total: value.plan.exercises.length, questionTotal: exercise?.rounds.length ?? 0, mode: value.plan.mode, passScore: value.plan.passScore, juz: value.plan.juz };
}
async function restartInterrupted(value: Awaited<ReturnType<typeof context>>) {
  if (value.state.question <= 0 || value.state.passed || value.state.failed) return value;
  const next: LearningState = { ...value.state, question: 0, questionMistake: false, errors: 0, correct: 0, score: null, attempt: value.state.attempt + 1, lastResult: null };
  const saved = await createAdminClient().rpc('restart_student_learning', { target_student: value.student, target_key: value.plan.key, expected_version: value.version, next_state: next });
  if (saved.error) throw new Error(saved.error.message.includes('learning_version_conflict') ? 'conflict' : 'storage_unavailable');
  return { ...value, state: next, version: saved.data, plan: makeLearningPlan(value.plan.key, next.attempt) };
}
export async function GET(request: Request) {
  try { return NextResponse.json(view(await restartInterrupted(await context(new URL(request.url).searchParams.get('key') ?? ''))), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const input = inputSchema.parse(await request.json());
    const value = await context(input.key);
    if (input.version !== value.version) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    const current = currentRound(value.plan, value.state);
    const answerCorrect = Boolean(current && isCorrect(current, input.answer ?? ''));
    const next = advanceLearning(value.plan, value.state, answerCorrect, input.retry);
    const saved = await createAdminClient().rpc('save_student_learning', { target_student: value.student, target_key: input.key, expected_version: input.version, next_state: next });
    if (saved.error) throw new Error(saved.error.message.includes('learning_version_conflict') ? 'conflict' : 'storage_unavailable');
    return NextResponse.json({ ...view({ ...value, state: next, version: saved.data, plan: makeLearningPlan(input.key, next.attempt) }), answerCorrect: input.retry ? null : answerCorrect }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) { const message = error instanceof Error ? error.message : ''; const status = message === 'unauthorized' ? 401 : message === 'locked' ? 403 : message === 'conflict' ? 409 : message === 'storage_unavailable' ? 503 : 400; return NextResponse.json({ error: status === 503 ? 'unavailable' : 'request_failed' }, { status }); }
