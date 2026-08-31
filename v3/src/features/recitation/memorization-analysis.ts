export type MemorizationError = Readonly<{
  kind: "omission" | "addition" | "substitution" | "order" | "uncertain";
  expected?: string;
  observed?: string;
  position: number;
}>;

export type MemorizationAnalysis = Readonly<{
  conclusive: boolean;
  score: number | null;
  matchedWords: number;
  expectedWords: number;
  errors: readonly MemorizationError[];
  recommendation: string;
}>;

export function analyseMemorization(expectedText: string, transcript: string, confidence?: number): MemorizationAnalysis {
  const expected = tokenize(expectedText);
  const observed = tokenize(transcript);
  if (expected.length === 0) throw new Error("Canonical text is required");

  const lowConfidence = confidence !== undefined && confidence < 0.45;
  const tooShort = observed.length < Math.max(2, Math.floor(expected.length * 0.25));
  if (observed.length === 0 || lowConfidence || tooShort) {
    return {
      conclusive: false,
      score: null,
      matchedWords: 0,
      expectedWords: expected.length,
      errors: [{ kind: "uncertain", position: 0 }],
      recommendation: "لم يكن التسجيل واضحا بما يكفي. أعد المحاولة في مكان هادئ.",
    };
  }

  const matches = longestCommonSubsequence(expected, observed);
  const errors = buildErrors(expected, observed, matches);
  const recall = matches.length / expected.length;
  const extraPenalty = Math.min(0.18, Math.max(0, observed.length - matches.length) / Math.max(expected.length, 1) * 0.25);
  const score = Math.max(0, Math.min(10, Number(((recall - extraPenalty) * 10).toFixed(1))));

  return {
    conclusive: true,
    score,
    matchedWords: matches.length,
    expectedWords: expected.length,
    errors,
    recommendation: recommendationFor(score, errors.length),
  };
}

export function normalizeArabic(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[ٱأإآ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^ء-ي\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeArabic(value);
  return normalized ? normalized.split(" ") : [];
}

function longestCommonSubsequence(expected: readonly string[], observed: readonly string[]): Array<[number, number]> {
  const matrix = Array.from({ length: expected.length + 1 }, () => Array<number>(observed.length + 1).fill(0));
  for (let left = 1; left <= expected.length; left += 1) {
    for (let right = 1; right <= observed.length; right += 1) {
      matrix[left]![right] = expected[left - 1] === observed[right - 1]
        ? (matrix[left - 1]![right - 1] ?? 0) + 1
        : Math.max(matrix[left - 1]![right] ?? 0, matrix[left]![right - 1] ?? 0);
    }
  }
  const matches: Array<[number, number]> = [];
  let left = expected.length;
  let right = observed.length;
  while (left > 0 && right > 0) {
    if (expected[left - 1] === observed[right - 1]) {
      matches.unshift([left - 1, right - 1]);
      left -= 1;
      right -= 1;
    } else if ((matrix[left - 1]![right] ?? 0) >= (matrix[left]![right - 1] ?? 0)) left -= 1;
    else right -= 1;
  }
  return matches;
}

function buildErrors(expected: readonly string[], observed: readonly string[], matches: readonly [number, number][]): MemorizationError[] {
  const errors: MemorizationError[] = [];
  const expectedMatched = new Set(matches.map(([index]) => index));
  const observedMatched = new Set(matches.map(([, index]) => index));
  expected.forEach((word, index) => {
    if (!expectedMatched.has(index)) errors.push({ kind: "omission", expected: word, position: index });
  });
  observed.forEach((word, index) => {
    if (!observedMatched.has(index)) errors.push({ kind: "addition", observed: word, position: index });
  });
  return errors.slice(0, 40);
}

function recommendationFor(score: number, errorCount: number): string {
  if (score >= 9) return "حفظ ممتاز. واصل المراجعة المنتظمة.";
  if (score >= 7.5) return "حفظ جيد جدا. راجع المواضع المحددة مرة أخرى.";
  if (score >= 6) return "تقدم جيد. كرر المقطع ببطء ثم أعد المحاولة.";
  if (errorCount <= 3) return "اقتربت من الإتقان. ركز على الكلمات الناقصة.";
  return "قسّم المقطع إلى أجزاء قصيرة، واستمع ثم كرر كل جزء.";
}

