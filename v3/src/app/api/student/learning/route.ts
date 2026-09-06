import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { advanceLearning, currentRound, initialLearningState, makeLearningPlan, learningOrder, upgradeLearningState, type LearningState } from '@/features/quran/learning-plan';
import { isCorrect } from '@/features/games/engine';

const inputSchema = z.object({ key: z.string().regex(/^(surah|review)-\d+$/), version: z.number().int().nonnegative(), answer: z.string().max(20000).optional(), retry: z.boolean().optional() });
async function context(key: string) {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('unauthorized');
  const [profile, roles, progress, session] = await Promise.all([
    client.from('profiles').select('status').eq('id', auth.user.id).single(),
    client.from('user_roles').select('role').eq('user_id', auth.user.id),
    client.from('student_surah_progress').select('surah_number,status').eq('student_id', auth.user.id),
    client.from('student_learning_sessions').select('state,version').eq('student_id', auth.user.id).eq('learning_key', key).maybeSingle(),
  ]);
  if (profile.error || roles.error || progress.error || session.error) throw new Error('storage_unavailable');
  if (profile.data.status !== 'active' || !roles.data.some(r => r.role === 'student')) throw new Error('unauthorized');
  const state: LearningState = session.data ? upgradeLearningState(session.data.state) : { ...initialLearningState };
  const plan = makeLearningPlan(key, state.attempt);
  const mastered = new Set(progress.data.filter(p => p.status === 'mastered').map(p => p.surah_number));
  if (plan.surah === null ? !plan.group.every(n => mastered.has(n)) : !mastered.has(plan.surah) && learningOrder.find(n => !mastered.has(n)) !== plan.surah) throw new Error('locked');
  return { student: auth.user.id, state, plan, version: session.data?.version ?? 0 };
}
function view(value: Awaited<ReturnType<typeof context>>) {
  const round = currentRound(value.plan, value.state);
  const exercise = value.plan.exercises[value.state.cursor];
  return { state: value.state, version: value.version, round: round ? { kind: round.kind, prompt: round.prompt, options: round.options, verseNumber: round.verseNumber } : null, finalStart: value.plan.finalStart, total: value.plan.exercises.length, questionTotal: exercise?.rounds.length ?? 0 };
}
export async function GET(request: Request) {
  try { return NextResponse.json(view(await context(new URL(request.url).searchParams.get('key') ?? '')), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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
