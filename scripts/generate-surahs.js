const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

// These pages were hand-crafted before the generator existed. Keep them as-is.
const existingFiles = new Map([
  [95, "Al_Tin.html"],
  [96, "Al_Alaq.html"],
  [97, "al_kadr.html"],
  [98, "bayina.html"],
  [99, "surah-zalzalah.html"],
  [100, "surah-adiyat.html"],
  [101, "qaria.html"],
  [102, "surah-takathur.html"],
  [103, "surah-asr.html"],
  [104, "surah-humaza.html"],
  [105, "fil.html"],
  [106, "quraysh.html"],
]);

const slugs = {
  1: "al-fatihah",
  2: "al-baqarah",
  3: "ali-imran",
  4: "an-nisa",
  5: "al-maidah",
  6: "al-anam",
  7: "al-araf",
  8: "al-anfal",
  9: "at-tawbah",
  10: "yunus",
  11: "hud",
  12: "yusuf",
  13: "ar-rad",
  14: "ibrahim",
  15: "al-hijr",
  16: "an-nahl",
  17: "al-isra",
  18: "al-kahf",
  19: "maryam",
  20: "taha",
  21: "al-anbiya",
  22: "al-hajj",
  23: "al-muminun",
  24: "an-nur",
  25: "al-furqan",
  26: "ash-shuara",
  27: "an-naml",
  28: "al-qasas",
  29: "al-ankabut",
  30: "ar-rum",
  31: "luqman",
  32: "as-sajdah",
  33: "al-ahzab",
  34: "saba",
  35: "fatir",
  36: "ya-sin",
  37: "as-saffat",
  38: "sad",
  39: "az-zumar",
  40: "ghafir",
  41: "fussilat",
  42: "ash-shura",
  43: "az-zukhruf",
  44: "ad-dukhan",
  45: "al-jathiyah",
  46: "al-ahqaf",
  47: "muhammad",
  48: "al-fath",
  49: "al-hujurat",
  50: "qaf",
  51: "adh-dhariyat",
  52: "at-tur",
  53: "an-najm",
  54: "al-qamar",
  55: "ar-rahman",
  56: "al-waqiah",
  57: "al-hadid",
  58: "al-mujadilah",
  59: "al-hashr",
  60: "al-mumtahanah",
  61: "as-saff",
  62: "al-jumuah",
  63: "al-munafiqun",
  64: "at-taghabun",
  65: "at-talaq",
  66: "at-tahrim",
  67: "al-mulk",
  68: "al-qalam",
  69: "al-haqqa",
  70: "al-maarij",
  71: "nuh",
  72: "al-jinn",
  73: "al-muzzammil",
  74: "al-muddaththir",
  75: "al-qiyama",
  76: "al-insan",
  77: "al-mursalat",
  78: "an-naba",
  79: "an-naziat",
  80: "abasa",
  81: "at-takwir",
  82: "al-infitar",
  83: "al-mutaffifin",
  84: "al-inshiqaq",
  85: "al-buruj",
  86: "at-tariq",
  87: "al-ala",
  88: "al-ghashiya",
  89: "al-fajr",
  90: "al-balad",
  91: "ash-shams",
  92: "al-layl",
  93: "ad-duha",
  94: "ash-sharh",
  95: "al-tin",
  96: "al-alaq",
  97: "al-qadr",
  98: "al-bayyina",
  99: "al-zalzala",
  100: "al-adiyat",
  101: "al-qaria",
  102: "al-takathur",
  103: "al-asr",
  104: "al-humaza",
  105: "al-fil",
  106: "quraysh",
  107: "al-maun",
  108: "al-kawthar",
  109: "al-kafirun",
  110: "al-nasr",
  111: "al-masad",
  112: "al-ikhlas",
  113: "al-falaq",
  114: "al-nas",
};

const palette = [
  "#334155", "#4338ca", "#be123c", "#7c2d12", "#0369a1", "#581c87",
  "#1e3a8a", "#9a3412", "#111827", "#0f766e", "#0e7490", "#92400e",
  "#7f1d1d", "#365314", "#713f12", "#1d4ed8", "#854d0e", "#6d28d9",
  "#1e40af", "#0f172a", "#047857", "#b45309", "#ea580c", "#78350f",
  "#ca8a04", "#312e81", "#d97706", "#059669", "#134e4a", "#3b0764",
];

const emojiPalette = ["📖", "🎧", "🌙", "✨", "⚡", "🌿", "🕌", "🏆", "💡", "🎯"];
const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toArabicNumber(value) {
  return String(value).replace(/\d/g, (d) => arabicDigits[Number(d)]);
}

function padAudio(num, aya) {
  return String(num).padStart(3, "0") + String(aya).padStart(3, "0");
}

function fileName(meta) {
  return existingFiles.get(meta.num) || `surah-${meta.id}.html`;
}

function partCount(ayat) {
  if (ayat <= 7) return 1;
  if (ayat <= 15) return 2;
  if (ayat <= 30) return 3;
  if (ayat <= 50) return 4;
  if (ayat <= 80) return 5;
  if (ayat <= 120) return 6;
  if (ayat <= 180) return 8;
  return 10;
}

function revelationType(type) {
  return type === "Medinan" ? "مدنية" : "مكية";
}

async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  throw lastError;
}

async function fetchSurah(num) {
  const json = await fetchJson(`https://api.alquran.cloud/v1/surah/${num}/quran-uthmani`);
  if (json.code !== 200) throw new Error(`Unexpected API response for surah ${num}`);
  return {
    id: slugs[num],
    num,
    nameAr: json.data.name,
    nameFr: json.data.englishName,
    ayat: json.data.ayahs.length,
    type: revelationType(json.data.revelationType),
    color: palette[(num - 1) % palette.length],
    emoji: emojiPalette[(num - 1) % emojiPalette.length],
    verses: json.data.ayahs.map((ayah, index) => ({
      num: index + 1,
      numAr: toArabicNumber(index + 1),
      text: ayah.text.replace(/\s*\u06dd\s*/g, "").trim(),
      audio: padAudio(num, index + 1),
    })),
  };
}

function js(value) {
  return JSON.stringify(value, null, 2);
}

function makeTemplate(meta) {
  const titleName = meta.nameAr.replace(/^سُورَةُ\s*/, "سورة ");
  const parts = partCount(meta.ayat);
  const color = meta.color;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>منصة مواهب المنان - ${titleName}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
<link rel="stylesheet" href="platform-theme.css">
<script src="platform-theme.js"></script>
<style>
  :root { --surah:${color}; }
  body { font-family:'Cairo',sans-serif; background:#f8fafc; min-height:100vh; user-select:none; }
  .quran-text { font-family:'Amiri',serif; line-height:2.25; }
  .app-shell { background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%); }
  .tab-active { border-color:var(--surah); background:#fff; color:var(--surah); box-shadow:0 8px 20px rgba(15,23,42,.08); }
  .tab-inactive { border-color:#e5e7eb; background:#f8fafc; color:#64748b; }
  .verse-card { transition:transform .18s ease, border-color .18s ease, background .18s ease; border:1px solid #e2e8f0; }
  .verse-card:hover { transform:translateY(-1px); border-color:var(--surah); background:#f8fafc; }
  .choice { transition:all .18s ease; }
  .choice.selected { background:var(--surah); color:white; border-color:var(--surah); }
  .part-btn.active { background:var(--surah); color:white; border-color:var(--surah); }
  .xp-bar { transition:width .35s ease; }
  ::-webkit-scrollbar { width:6px; }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:10px; }
</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth.js"></script>
<script src="registry.js"></script>
</head>
<body class="p-3 md:p-6">

<div class="w-full max-w-5xl mx-auto app-shell rounded-[28px] border border-slate-200 shadow-xl overflow-hidden">
  <header class="p-4 md:p-6 text-white" style="background:linear-gradient(135deg,${color},#111827)">
    <div class="flex flex-col md:flex-row justify-between gap-4 md:items-center">
      <div class="flex items-center gap-4">
        <img src="logo.webp" alt="مواهب المنان" class="h-16 w-16 object-contain rounded-2xl bg-white/90 p-1" onerror="this.style.display='none'">
        <div>
          <p class="text-xs font-bold text-white/70">دار القرآن والحديث • رواية ورش</p>
          <h1 class="quran-text text-3xl md:text-5xl font-black">${titleName}</h1>
          <p class="text-sm font-bold text-white/75">${toArabicNumber(meta.ayat)} آيات • ${meta.type} • ${meta.nameFr}</p>
        </div>
      </div>
      <a href="dashboard.html" class="self-start md:self-center px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 font-black text-sm">لوحتي</a>
    </div>
    <div class="grid grid-cols-3 gap-2 mt-5 text-center">
      <div class="rounded-2xl bg-white/12 border border-white/15 px-3 py-3">
        <p class="text-[11px] text-white/65 font-bold">XP المهمة</p>
        <p id="xp-label" class="text-xl font-black">0</p>
      </div>
      <div class="rounded-2xl bg-white/12 border border-white/15 px-3 py-3">
        <p class="text-[11px] text-white/65 font-bold">السلسلة</p>
        <p id="streak-label" class="text-xl font-black">0</p>
      </div>
      <div class="rounded-2xl bg-white/12 border border-white/15 px-3 py-3">
        <p class="text-[11px] text-white/65 font-bold">المستوى</p>
        <p id="level-label" class="text-xl font-black">هادئ</p>
      </div>
    </div>
  </header>

  <section class="p-4 md:p-6">
    <div class="mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <div>
          <p class="text-xs font-black text-slate-400">مهمة اليوم</p>
          <h2 class="text-base md:text-lg font-black text-slate-800">استمع، رتّب، أكمل، ثم اختم بتحدي السرعة</h2>
        </div>
        <div class="w-full md:w-56 h-3 bg-slate-200 rounded-full overflow-hidden">
          <div id="xp-bar" class="xp-bar h-full rounded-full" style="width:0%; background:${color}"></div>
        </div>
      </div>
      <div id="part-buttons" class="grid grid-cols-2 sm:grid-cols-${Math.min(parts, 6)} gap-2"></div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
      <button id="tab-0" onclick="goToPhase(0)" class="tab-active border rounded-2xl p-3 font-black text-xs md:text-sm">استماع</button>
      <button id="tab-1" onclick="goToPhase(1)" class="tab-inactive border rounded-2xl p-3 font-black text-xs md:text-sm">ترتيب</button>
      <button id="tab-2" onclick="goToPhase(2)" class="tab-inactive border rounded-2xl p-3 font-black text-xs md:text-sm">كلمات ناقصة</button>
      <button id="tab-3" onclick="goToPhase(3)" class="tab-inactive border rounded-2xl p-3 font-black text-xs md:text-sm">تحدي سريع</button>
    </div>

    <main class="bg-white rounded-3xl border border-slate-200 p-4 md:p-6">
      <section id="phase-0">
        <p class="text-center text-slate-500 font-bold text-sm mb-5">استمع للمقدار برواية ورش، ثم اضغط على الآية التي تريد تكرارها.</p>
        <div id="audio-list" class="space-y-3"></div>
        <div class="flex justify-center mt-6">
          <button onclick="playAll()" class="px-6 py-4 text-white font-black rounded-2xl shadow-md" style="background:${color}">استمع للمقدار كاملا</button>
        </div>
      </section>

      <section id="phase-1" class="hidden">
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
          <p class="text-xs font-black text-slate-400">تحدي التركيز</p>
          <p id="order-target" class="font-black text-slate-800 mt-1"></p>
        </div>
        <div id="order-list" class="grid grid-cols-1 gap-3"></div>
        <div id="order-feedback" class="hidden p-3 rounded-xl text-center font-bold text-sm my-4"></div>
        <div class="flex justify-between mt-6">
          <button onclick="buildOrderGame()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-sm">إعادة</button>
          <button onclick="checkOrderGame()" class="px-7 py-3 text-white font-black rounded-xl shadow" style="background:${color}">تحقق</button>
        </div>
      </section>

      <section id="phase-2" class="hidden">
        <p class="text-center text-slate-500 font-bold text-sm mb-5">اختر الكلمة الصحيحة. كل إجابة صحيحة ترفع الـ XP والسلسلة.</p>
        <div id="fill-list" class="space-y-5"></div>
        <div id="fill-feedback" class="hidden p-3 rounded-xl text-center font-bold text-sm my-4"></div>
        <div class="flex justify-between mt-6">
          <button onclick="buildFillGame()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-sm">إعادة</button>
          <button onclick="checkFillGame()" class="px-7 py-3 text-white font-black rounded-xl shadow" style="background:${color}">سجل النتيجة</button>
        </div>
      </section>

      <section id="phase-3" class="hidden">
        <div class="text-center mb-5">
          <p class="text-slate-500 font-bold text-sm">تحدي سريع: اختر الآية التي تأتي مباشرة بعد الآية المعروضة.</p>
          <p class="text-xs text-slate-400 font-bold mt-1">مصمم للمراجعة السريعة وليس للحفظ الأول.</p>
        </div>
        <div id="speed-card" class="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-4"></div>
        <div id="speed-options" class="grid grid-cols-1 gap-3"></div>
        <div id="speed-feedback" class="hidden p-3 rounded-xl text-center font-bold text-sm my-4"></div>
        <div class="flex justify-between mt-6">
          <button onclick="buildSpeedGame()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-sm">سؤال جديد</button>
          <button onclick="finishMission()" class="px-7 py-3 bg-emerald-600 text-white font-black rounded-xl shadow">إنهاء المهمة</button>
        </div>
      </section>
    </main>
  </section>
</div>

<script>
const SURAH_ID = ${js(meta.id)};
const SURAH_COLOR = ${js(color)};
const verses = ${js(meta.verses)};
const partCount = ${parts};
let currentPart = 0;
let currentPhase = 0;
let audioPlayer = null;
let xp = 0;
let streak = 0;
let orderSample = [];
let orderAnswers = [];
let fillQuestions = [];
let fillAnswers = [];
let speedQuestion = null;

function currentVerses() {
  const size = Math.ceil(verses.length / partCount);
  const start = currentPart * size;
  return verses.slice(start, start + size);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeWord(word) {
  return word.replace(/[ۖۗۘۙۚۛۜ۝،؛.؟]/g, '').trim();
}

function updateStats(delta = 0, ok = true) {
  xp = Math.max(0, Math.min(100, xp + delta));
  streak = ok ? streak + (delta > 0 ? 1 : 0) : 0;
  document.getElementById('xp-label').textContent = xp;
  document.getElementById('streak-label').textContent = streak;
  document.getElementById('xp-bar').style.width = xp + '%';
  document.getElementById('level-label').textContent = xp >= 85 ? 'متقدم' : xp >= 50 ? 'ثابت' : 'هادئ';
}

function buildPartButtons() {
  const box = document.getElementById('part-buttons');
  box.innerHTML = '';
  for (let i = 0; i < partCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'part-btn border border-slate-200 rounded-xl px-3 py-2 text-xs font-black transition ' + (i === currentPart ? 'active' : 'bg-white text-slate-600');
    btn.textContent = partCount === 1 ? 'السورة كاملة' : 'مهمة ' + (i + 1);
    btn.onclick = () => {
      currentPart = i;
      xp = 0;
      streak = 0;
      stopAudio();
      buildAll();
      updateStats(0, true);
    };
    box.appendChild(btn);
  }
}

function buildAudioScreen() {
  const list = document.getElementById('audio-list');
  list.innerHTML = '';
  currentVerses().forEach(v => {
    const div = document.createElement('button');
    div.type = 'button';
    div.className = 'verse-card w-full flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm text-right';
    div.onclick = () => {
      playVerse(v.audio, div);
      updateStats(2, true);
    };
    div.innerHTML = \`
      <span class="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-black shrink-0" style="background:\${SURAH_COLOR}">\${v.numAr}</span>
      <span class="quran-text text-xl md:text-2xl text-slate-900 font-bold flex-grow leading-loose">\${v.text}</span>
      <span class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm shrink-0">▶</span>
    \`;
    list.appendChild(div);
  });
}

function playVerse(audioCode, el) {
  stopAudio();
  document.querySelectorAll('.verse-card').forEach(c => c.style.background = '');
  audioPlayer = new Audio(\`https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps/\${audioCode}.mp3\`);
  if (el) el.style.background = '#f1f5f9';
  audioPlayer.onended = () => { if (el) el.style.background = ''; };
  audioPlayer.play().catch(() => {});
}

function playAll() {
  stopAudio();
  updateStats(8, true);
  const items = currentVerses();
  let i = 0;
  function next() {
    if (i >= items.length) return;
    audioPlayer = new Audio(\`https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps/\${items[i].audio}.mp3\`);
    audioPlayer.onended = next;
    audioPlayer.play().catch(() => {});
    i++;
  }
  next();
}

function stopAudio() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
}

function buildOrderGame() {
  const source = currentVerses();
  orderSample = source.slice(0, Math.min(7, source.length));
  if (source.length > 7) {
    const maxStart = Math.max(0, source.length - 7);
    const start = Math.floor(Math.random() * (maxStart + 1));
    orderSample = source.slice(start, start + 7);
  }
  orderAnswers = [];
  document.getElementById('order-target').textContent = 'اختر الآية رقم ' + orderSample[0].numAr + ' ثم واصل السلسلة.';
  document.getElementById('order-feedback').className = 'hidden p-3 rounded-xl text-center font-bold text-sm my-4';
  const list = document.getElementById('order-list');
  list.innerHTML = '';
  shuffle(orderSample).forEach(v => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'verse-card p-4 rounded-xl quran-text text-xl md:text-2xl font-bold text-slate-900 bg-white text-right';
    btn.textContent = v.text;
    btn.onclick = () => {
      if (btn.dataset.used === '1') return;
      btn.dataset.used = '1';
      btn.style.borderColor = '#10b981';
      btn.style.background = '#ecfdf5';
      orderAnswers.push(v.num);
      const next = orderSample[orderAnswers.length];
      document.getElementById('order-target').textContent = next ? 'الآن اختر الآية رقم ' + next.numAr : 'اكتملت السلسلة، نتحقق تلقائيا.';
      if (!next) setTimeout(checkOrderGame, 260);
    };
    list.appendChild(btn);
  });
}

function autoAdvancePhase(nextPhase) {
  setTimeout(() => {
    if (typeof goToPhase === 'function') goToPhase(nextPhase);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 850);
}

function completeExerciseSet() {
  setTimeout(() => {
    if (typeof finishMission === 'function') finishMission();
  }, 750);
}

function checkOrderGame() {
  const ok = orderAnswers.length === orderSample.length && orderAnswers.every((n, i) => n === orderSample[i].num);
  const box = document.getElementById('order-feedback');
  box.className = 'p-3 rounded-xl text-center font-bold text-sm my-4 ' + (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700');
  box.textContent = ok ? 'ترتيب ممتاز. +20 XP' : 'فيه خلل في السلسلة. أعدها بهدوء.';
  updateStats(ok ? 20 : -8, ok);
  if (ok) {
    Auth.recordActivity(SURAH_ID, 'teen-order-part-' + currentPart, 100);
    autoAdvancePhase(2);
  }
}

function makeFillQuestion(v, index, allWords) {
  const words = v.text.split(/\\s+/).map(normalizeWord).filter(w => w.length > 2);
  const answer = words[Math.max(0, Math.floor(words.length * 0.65))] || words[words.length - 1] || v.text;
  const wrongs = shuffle(allWords.filter(w => w !== answer)).slice(0, 2);
  while (wrongs.length < 2) wrongs.push(words[0] || answer);
  return { verse: v, blank: v.text.replace(answer, '______'), answer, options: shuffle([answer, ...wrongs]), index };
}

function buildFillGame() {
  const source = currentVerses();
  const allWords = [...new Set(source.flatMap(v => v.text.split(/\\s+/).map(normalizeWord).filter(w => w.length > 2)))];
  fillQuestions = shuffle(source).slice(0, Math.min(6, source.length)).map((v, index) => makeFillQuestion(v, index, allWords));
  fillAnswers = new Array(fillQuestions.length).fill(null);
  document.getElementById('fill-feedback').className = 'hidden p-3 rounded-xl text-center font-bold text-sm my-4';
  const list = document.getElementById('fill-list');
  list.innerHTML = '';
  fillQuestions.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'bg-slate-50 border border-slate-200 rounded-2xl p-4';
    card.innerHTML = \`
      <p class="quran-text text-2xl md:text-3xl text-slate-900 font-bold text-center mb-4 leading-loose">\${q.blank}</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        \${q.options.map(opt => \`<button type="button" class="choice border-2 border-slate-200 rounded-xl px-3 py-3 bg-white quran-text text-xl font-bold" data-q="\${qi}" data-value="\${opt}">\${opt}</button>\`).join('')}
      </div>
    \`;
    list.appendChild(card);
  });
  document.querySelectorAll('.choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const qi = Number(btn.dataset.q);
      fillAnswers[qi] = btn.dataset.value;
      document.querySelectorAll(\`.choice[data-q="\${qi}"]\`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (fillAnswers.every(Boolean) && fillAnswers.every((answer, index) => answer === fillQuestions[index].answer)) {
        setTimeout(checkFillGame, 260);
      }
    });
  });
}

async function checkFillGame() {
  const total = fillQuestions.length || 1;
  const correct = fillAnswers.reduce((sum, a, i) => sum + (a === fillQuestions[i].answer ? 1 : 0), 0);
  const score = Math.round(correct / total * 100);
  const ok = score >= 70;
  const box = document.getElementById('fill-feedback');
  box.className = 'p-3 rounded-xl text-center font-bold text-sm my-4 ' + (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700');
  box.textContent = ok ? 'نتيجة قوية: ' + score + '%. +25 XP' : 'نتيجتك ' + score + '%. أعد المحاولة لتثبيت الحفظ.';
  updateStats(ok ? 25 : -5, ok);
  await Auth.recordActivity(SURAH_ID, 'teen-fill-part-' + currentPart, score);
  if (score === 100) autoAdvancePhase(3);
}

function buildSpeedGame() {
  const source = currentVerses();
  const candidates = source.filter((v, i) => i < source.length - 1);
  const base = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : source[0];
  const answer = source[source.findIndex(v => v.num === base.num) + 1] || source[0];
  const wrongs = shuffle(source.filter(v => v.num !== answer.num && v.num !== base.num)).slice(0, 3);
  speedQuestion = { base, answer };
  document.getElementById('speed-card').innerHTML = \`
    <p class="text-xs font-black text-slate-400 mb-2">ما الآية التالية؟</p>
    <p class="quran-text text-2xl md:text-3xl text-slate-900 font-black leading-loose">\${base.text}</p>
  \`;
  const box = document.getElementById('speed-options');
  box.innerHTML = '';
  shuffle([answer, ...wrongs]).forEach(v => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'verse-card bg-white rounded-xl p-4 quran-text text-xl md:text-2xl font-bold text-right';
    btn.textContent = v.text;
    btn.onclick = () => answerSpeed(v.num);
    box.appendChild(btn);
  });
  document.getElementById('speed-feedback').className = 'hidden p-3 rounded-xl text-center font-bold text-sm my-4';
}

function answerSpeed(num) {
  const ok = speedQuestion && num === speedQuestion.answer.num;
  const box = document.getElementById('speed-feedback');
  box.className = 'p-3 rounded-xl text-center font-bold text-sm my-4 ' + (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700');
  box.textContent = ok ? 'صحيح. سرعة وتركيز! +15 XP' : 'ليست هي. خذ نفسا وأعد السؤال.';
  updateStats(ok ? 15 : -5, ok);
  if (ok) {
    Auth.recordActivity(SURAH_ID, 'teen-speed-part-' + currentPart, 100);
    completeExerciseSet();
  }
}

async function finishMission() {
  const score = Math.max(0, Math.min(100, xp));
  await Auth.recordActivity(SURAH_ID, 'teen-mission-part-' + currentPart, score);
  if (score >= 70 && currentPart === partCount - 1) await Auth.completeSurah(SURAH_ID);
  if (typeof confetti === 'function') confetti({ particleCount: score >= 70 ? 120 : 45, spread: 70, origin: { y: .65 } });
  if (score >= 70 && currentPart < partCount - 1) {
    currentPart++;
    currentPhase = 0;
    buildAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (score < 70) alert('تم حفظ المحاولة. أعد المهمة لتحسين النتيجة.');
}

function goToPhase(phase) {
  currentPhase = phase;
  stopAudio();
  [0, 1, 2, 3].forEach(i => {
    document.getElementById('phase-' + i).classList.toggle('hidden', i !== phase);
    const tab = document.getElementById('tab-' + i);
    tab.className = tab.className.replace(/tab-(active|inactive)/g, '').trim() + ' ' + (i === phase ? 'tab-active' : 'tab-inactive');
  });
  if (phase === 1) buildOrderGame();
  if (phase === 2) buildFillGame();
  if (phase === 3) buildSpeedGame();
}

function buildAll() {
  buildPartButtons();
  buildAudioScreen();
  buildOrderGame();
  buildFillGame();
  buildSpeedGame();
  goToPhase(currentPhase);
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.requireAuth();
  buildAll();
  updateStats(0, true);
});
</script>
</body>
</html>
`;
}

function makeRegistry(items) {
  const entries = items
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((meta) => ({
      id: meta.id,
      num: meta.num,
      nameAr: meta.nameAr,
      nameFr: meta.nameFr,
      ayat: meta.ayat,
      parts: partCount(meta.ayat),
      type: meta.type,
      color: meta.color,
      emoji: meta.emoji,
      file: fileName(meta),
      available: true,
    }));

  return `/**
 * =========================================================
 *  REGISTRE CENTRAL — منصة دار القرآن
 * =========================================================
 *  Ce fichier alimente automatiquement le dashboard eleve.
 *  Toutes les sourates du Coran sont disponibles.
 * =========================================================
 */

const SURAH_REGISTRY = ${js(entries)};
`;
}

async function main() {
  const items = [];
  for (let num = 1; num <= 114; num++) {
    const meta = await fetchSurah(num);
    items.push(meta);
    if (!existingFiles.has(num)) {
      fs.writeFileSync(path.join(root, fileName(meta)), makeTemplate(meta), "utf8");
      console.log(`generated ${fileName(meta)}`);
    }
  }

  fs.writeFileSync(path.join(root, "registry.js"), makeRegistry(items), "utf8");
  console.log("updated registry.js");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
