const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

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

const manual = {
  67: { id: "al-mulk", nameFr: "La Royauté", type: "مكية", color: "#334155", emoji: "👑" },
  68: { id: "al-qalam", nameFr: "La Plume", type: "مكية", color: "#4338ca", emoji: "✒️" },
  69: { id: "al-haqqa", nameFr: "L'Inévitable", type: "مكية", color: "#be123c", emoji: "⚖️" },
  70: { id: "al-maarij", nameFr: "Les Voies d'Ascension", type: "مكية", color: "#7c2d12", emoji: "🪜" },
  71: { id: "nuh", nameFr: "Noé", type: "مكية", color: "#0369a1", emoji: "🌊" },
  72: { id: "al-jinn", nameFr: "Les Djinns", type: "مكية", color: "#581c87", emoji: "🌌" },
  73: { id: "al-muzzammil", nameFr: "L'Enveloppé", type: "مكية", color: "#1e3a8a", emoji: "🌙" },
  74: { id: "al-muddaththir", nameFr: "Le Revêtu d'un Manteau", type: "مكية", color: "#9a3412", emoji: "🧥" },
  75: { id: "al-qiyama", nameFr: "La Résurrection", type: "مكية", color: "#111827", emoji: "⏳" },
  76: { id: "al-insan", nameFr: "L'Homme", type: "مدنية", color: "#0f766e", emoji: "🤲" },
  77: { id: "al-mursalat", nameFr: "Les Envoyés", type: "مكية", color: "#0e7490", emoji: "💨" },
  78: { id: "an-naba", nameFr: "La Nouvelle", type: "مكية", color: "#92400e", emoji: "📰" },
  79: { id: "an-naziat", nameFr: "Les Anges qui Arrachent", type: "مكية", color: "#7f1d1d", emoji: "⚡" },
  80: { id: "abasa", nameFr: "Il s'est Renfrogné", type: "مكية", color: "#365314", emoji: "🌿" },
  81: { id: "at-takwir", nameFr: "L'Obscurcissement", type: "مكية", color: "#713f12", emoji: "☀️" },
  82: { id: "al-infitar", nameFr: "La Rupture", type: "مكية", color: "#1d4ed8", emoji: "🌤️" },
  83: { id: "al-mutaffifin", nameFr: "Les Fraudeurs", type: "مكية", color: "#854d0e", emoji: "⚖️" },
  84: { id: "al-inshiqaq", nameFr: "La Déchirure", type: "مكية", color: "#6d28d9", emoji: "🌘" },
  85: { id: "al-buruj", nameFr: "Les Constellations", type: "مكية", color: "#1e40af", emoji: "✨" },
  86: { id: "at-tariq", nameFr: "L'Astre Nocturne", type: "مكية", color: "#0f172a", emoji: "🌟" },
  87: { id: "al-ala", nameFr: "Le Très-Haut", type: "مكية", color: "#047857", emoji: "⬆️" },
  88: { id: "al-ghashiya", nameFr: "L'Enveloppante", type: "مكية", color: "#b45309", emoji: "🌫️" },
  89: { id: "al-fajr", nameFr: "L'Aube", type: "مكية", color: "#ea580c", emoji: "🌅" },
  90: { id: "al-balad", nameFr: "La Cité", type: "مكية", color: "#78350f", emoji: "🏙️" },
  91: { id: "ash-shams", nameFr: "Le Soleil", type: "مكية", color: "#ca8a04", emoji: "☀️" },
  92: { id: "al-layl", nameFr: "La Nuit", type: "مكية", color: "#312e81", emoji: "🌃" },
  93: { id: "ad-duha", nameFr: "Le Jour Montant", type: "مكية", color: "#d97706", emoji: "🌤️" },
  94: { id: "ash-sharh", nameFr: "L'Ouverture", type: "مكية", color: "#059669", emoji: "🌱" },
  95: { id: "al-tin", nameFr: "Le Figuier", type: "مكية", color: "#4A148C", emoji: "🌿" },
  96: { id: "al-alaq", nameFr: "L'Adhérence", type: "مكية", color: "#059669", emoji: "📖" },
  97: { id: "al-qadr", nameFr: "La Nuit du Destin", type: "مكية", color: "#1e40af", emoji: "🌙" },
  98: { id: "al-bayyina", nameFr: "La Preuve", type: "مدنية", color: "#b45309", emoji: "📜" },
  99: { id: "al-zalzala", nameFr: "Le Séisme", type: "مدنية", color: "#be123c", emoji: "⚡" },
  100: { id: "al-adiyat", nameFr: "Les Coursiers", type: "مكية", color: "#0e7490", emoji: "⚔️" },
  101: { id: "al-qaria", nameFr: "Le Fracas", type: "مكية", color: "#7c3aed", emoji: "🌪️" },
  102: { id: "al-takathur", nameFr: "L'Accumulation", type: "مكية", color: "#065f46", emoji: "💰" },
  103: { id: "al-asr", nameFr: "Le Temps", type: "مكية", color: "#92400e", emoji: "⏳" },
  104: { id: "al-humaza", nameFr: "Le Calomniateur", type: "مكية", color: "#3f3f46", emoji: "⚠️" },
  105: { id: "al-fil", nameFr: "L'Éléphant", type: "مكية", color: "#6b7280", emoji: "🏔️" },
  106: { id: "quraysh", nameFr: "Les Qoraïchites", type: "مكية", color: "#78350f", emoji: "🕋" },
  107: { id: "al-maun", nameFr: "L'Ustensile", type: "مكية", color: "#134e4a", emoji: "🕌" },
  108: { id: "al-kawthar", nameFr: "L'Abondance", type: "مكية", color: "#1e3a5f", emoji: "💧" },
  109: { id: "al-kafirun", nameFr: "Les Mécréants", type: "مكية", color: "#3b0764", emoji: "🕊️" },
  110: { id: "al-nasr", nameFr: "Le Secours", type: "مدنية", color: "#14532d", emoji: "🏆" },
  111: { id: "al-masad", nameFr: "Les Fibres", type: "مكية", color: "#7f1d1d", emoji: "🔥" },
  112: { id: "al-ikhlas", nameFr: "La Pureté", type: "مكية", color: "#1e3a8a", emoji: "✨" },
  113: { id: "al-falaq", nameFr: "L'Aube", type: "مكية", color: "#451a03", emoji: "🌅" },
  114: { id: "al-nas", nameFr: "Les Hommes", type: "مكية", color: "#0c4a6e", emoji: "🌍" },
};

const arabicDigits = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
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
  if (ayat <= 12) return 2;
  if (ayat <= 20) return 3;
  if (ayat <= 30) return 4;
  if (ayat <= 45) return 5;
  return 6;
}

async function fetchSurah(num) {
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(`https://api.alquran.cloud/v1/surah/${num}/quran-uthmani`);
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  if (!res.ok) throw new Error(`Unable to fetch surah ${num}: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Unexpected API response for surah ${num}`);
  const base = manual[num];
  return {
    ...base,
    num,
    nameAr: json.data.name,
    ayat: json.data.ayahs.length,
    verses: json.data.ayahs.map((a, index) => ({
      num: index + 1,
      numAr: toArabicNumber(index + 1),
      text: a.text.replace(/\s*\u06dd\s*/g, "").trim(),
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
  const dark = color;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>منصة مواهب المنان - ${titleName}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
<style>
  :root { --surah:${color}; --surah-dark:${dark}; }
  body { font-family:'Cairo',sans-serif; background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%); min-height:100vh; user-select:none; }
  .quran-text { font-family:'Amiri',serif; line-height:2.35; }
  .tab-active { border-bottom:4px solid var(--surah); background:#f8fafc; color:var(--surah); }
  .tab-done { border-bottom:4px solid #10b981; background:#f0fdf4; color:#047857; }
  .tab-inactive { border-bottom:4px solid #e5e7eb; background:#f9fafb; color:#9ca3af; }
  .verse-card { transition:all .2s ease; border:2px solid rgba(148,163,184,.22); }
  .verse-card:hover { transform:translateY(-1px); border-color:var(--surah); background:#f8fafc; }
  .choice { transition:all .2s ease; }
  .choice.selected { background:var(--surah); color:white; border-color:var(--surah); }
  .order-pick.selected { background:#ecfdf5; border-color:#10b981; color:#047857; }
  .part-btn.active { background:var(--surah); color:white; border-color:var(--surah); }
  ::-webkit-scrollbar { width:6px; }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:10px; }
</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth.js"></script>
<script src="registry.js"></script>
</head>
<body class="p-3 md:p-6">

<div class="flex justify-center mb-4 mt-2">
  <img src="logo.webp" alt="مواهب المنان" class="h-20 object-contain drop-shadow-md" onerror="this.style.display='none'">
</div>

<header class="w-full max-w-4xl mx-auto bg-white shadow-md rounded-2xl p-4 mb-5 border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
  <div class="flex items-center gap-3 text-right">
    <div class="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 shrink-0" style="background:${color}14">
      <img src="logo.jpg" alt="Logo" class="w-full h-full object-cover" onerror="this.outerHTML='<span class=\\'text-3xl\\'>📖</span>'">
    </div>
    <div>
      <h1 class="text-lg md:text-xl font-black" style="color:${color}">جمعية مواهب المنان</h1>
      <p class="text-xs text-slate-600 font-bold">دار القرآن والحديث • عين العودة</p>
      <p class="text-[10px] text-gray-400 font-semibold">${titleName} التفاعلية - رواية ورش</p>
    </div>
  </div>
  <a href="dashboard.html" class="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 font-bold text-sm rounded-xl border border-slate-200 transition shrink-0" style="color:${color}">🏠 لوحتي</a>
</header>

<div class="w-full max-w-4xl mx-auto mb-5">
  <div class="rounded-2xl p-5 text-white text-center shadow-lg" style="background:linear-gradient(135deg,${color},#111827)">
    <h2 class="text-2xl md:text-4xl font-black quran-text mb-1">${titleName}</h2>
    <p class="text-white/80 text-sm font-bold">${toArabicNumber(meta.ayat)} آيات • ${meta.type} • الجزء التاسع والعشرون / الثلاثون</p>
  </div>
</div>

<div class="w-full max-w-4xl mx-auto mb-5">
  <div class="grid grid-cols-3 gap-2 text-center">
    <button id="tab-0" onclick="goToPhase(0)" class="py-3 rounded-xl font-bold text-xs md:text-sm tab-active cursor-pointer"><span class="block text-base">🎧</span>استماع وقراءة</button>
    <button id="tab-1" onclick="goToPhase(1)" class="py-3 rounded-xl font-bold text-xs md:text-sm tab-inactive cursor-pointer"><span class="block text-base">🔀</span>رتّب الآيات</button>
    <button id="tab-2" onclick="goToPhase(2)" class="py-3 rounded-xl font-bold text-xs md:text-sm tab-inactive cursor-pointer"><span class="block text-base">✍️</span>أكمل الفراغ</button>
  </div>
</div>

<main class="w-full max-w-4xl mx-auto bg-white shadow-lg rounded-3xl p-5 md:p-8 border border-slate-100">
  <div class="mb-5">
    <p class="text-center text-gray-500 font-bold text-xs mb-3">اختر المقدار الذي تريد مراجعته اليوم</p>
    <div id="part-buttons" class="grid grid-cols-2 sm:grid-cols-${Math.min(parts, 6)} gap-2"></div>
  </div>

  <section id="phase-0">
    <p class="text-center text-gray-500 font-bold text-sm mb-5">🎧 استمع للآيات برواية ورش ثم رددها، ويمكنك الضغط على أي آية لإعادتها</p>
    <div class="space-y-3" id="audio-list"></div>
    <div class="flex justify-center mt-6">
      <button onclick="playAll()" class="px-6 py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center gap-2 text-sm" style="background:${color}">🔊 استمع للمقدار كاملاً</button>
    </div>
    <div class="flex justify-end mt-6">
      <button onclick="goToPhase(1)" class="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition">متابعة ✔️</button>
    </div>
  </section>

  <section id="phase-1" class="hidden">
    <p class="text-center text-gray-500 font-bold text-sm mb-2">🔀 اضغط على الآيات بالترتيب الصحيح</p>
    <p class="text-center text-xs font-bold mb-5" style="color:${color}">ابدأ بالآية الأولى في هذا المقدار ثم اختر التالية</p>
    <div id="order-target" class="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mb-4 min-h-[72px] quran-text text-xl text-center"></div>
    <div id="order-list" class="grid grid-cols-1 gap-3"></div>
    <div id="order-feedback" class="hidden p-3 rounded-xl text-center font-bold text-sm my-4"></div>
    <div class="flex justify-between mt-6">
      <button onclick="buildOrderGame()" class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm">🔄 إعادة</button>
      <button onclick="checkOrderGame()" class="px-7 py-3 text-white font-bold rounded-xl shadow transition" style="background:${color}">تحقق ✔️</button>
    </div>
  </section>

  <section id="phase-2" class="hidden">
    <p class="text-center text-gray-500 font-bold text-sm mb-5">✍️ اختر الكلمة الصحيحة لإكمال الآية</p>
    <div id="fill-list" class="space-y-5"></div>
    <div id="fill-feedback" class="hidden p-3 rounded-xl text-center font-bold text-sm my-4"></div>
    <div class="flex justify-between mt-6">
      <button onclick="buildFillGame()" class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm">🔄 إعادة</button>
      <button onclick="checkFillGame()" class="px-7 py-3 text-white font-bold rounded-xl shadow transition" style="background:${color}">إنهاء 🏆</button>
    </div>
  </section>
</main>

<script>
const SURAH_ID = ${js(meta.id)};
const SURAH_COLOR = ${js(color)};
const verses = ${js(meta.verses)};
const partCount = ${parts};
let currentPart = 0;
let currentPhase = 0;
let audioPlayer = null;
let orderSample = [];
let orderAnswers = [];
let fillQuestions = [];
let fillAnswers = [];

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

function buildPartButtons() {
  const box = document.getElementById('part-buttons');
  box.innerHTML = '';
  for (let i = 0; i < partCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'part-btn border border-slate-200 rounded-xl px-3 py-2 text-xs font-black transition ' + (i === currentPart ? 'active' : 'bg-slate-50 text-slate-600');
    btn.textContent = partCount === 1 ? 'السورة كاملة' : 'المقدار ' + (i + 1);
    btn.onclick = () => {
      currentPart = i;
      stopAudio();
      buildAll();
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
    div.className = 'verse-card w-full flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm cursor-pointer text-right';
    div.onclick = () => playVerse(v.audio, div);
    div.innerHTML = \`
      <span class="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-black shrink-0" style="background:\${SURAH_COLOR}">\${v.numAr}</span>
      <span class="quran-text text-xl md:text-2xl text-slate-900 font-bold flex-grow leading-loose">\${v.text}</span>
      <span class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm shrink-0">▶️</span>
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
  orderSample = source.slice(0, Math.min(6, source.length));
  if (source.length > 6) {
    const maxStart = Math.max(0, source.length - 6);
    const start = Math.floor(Math.random() * (maxStart + 1));
    orderSample = source.slice(start, start + 6);
  }
  orderAnswers = [];
  document.getElementById('order-target').textContent = 'اختر الآية رقم ' + orderSample[0].numAr;
  document.getElementById('order-feedback').className = 'hidden p-3 rounded-xl text-center font-bold text-sm my-4';
  const list = document.getElementById('order-list');
  list.innerHTML = '';
  shuffle(orderSample).forEach(v => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'order-pick verse-card p-4 rounded-xl quran-text text-xl md:text-2xl font-bold text-slate-900 bg-white text-right';
    btn.textContent = v.text;
    btn.onclick = () => {
      if (btn.classList.contains('selected')) return;
      btn.classList.add('selected');
      orderAnswers.push(v.num);
      const next = orderSample[orderAnswers.length];
      document.getElementById('order-target').innerHTML = orderAnswers.map(n => '<span class="inline-block rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 mx-1 text-sm font-black">' + n + '</span>').join('') + (next ? '<p class="mt-3 text-sm text-slate-500 font-bold">اختر الآية رقم ' + next.numAr + '</p>' : '');
    };
    list.appendChild(btn);
  });
}

function checkOrderGame() {
  const ok = orderAnswers.length === orderSample.length && orderAnswers.every((n, i) => n === orderSample[i].num);
  const box = document.getElementById('order-feedback');
  box.className = 'p-3 rounded-xl text-center font-bold text-sm my-4 ' + (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700');
  box.textContent = ok ? 'أحسنت! الترتيب صحيح.' : 'راجع الترتيب وحاول مرة أخرى.';
  if (ok) {
    Auth.recordActivity(SURAH_ID, 'order-part-' + currentPart, 100);
    goToPhase(2);
  }
}

function makeFillQuestion(v, index, allWords) {
  const words = v.text.split(/\\s+/).map(normalizeWord).filter(w => w.length > 2);
  const answer = words[Math.max(0, words.length - 1)];
  const wrongs = shuffle(allWords.filter(w => w !== answer)).slice(0, 2);
  const options = shuffle([answer, ...wrongs]);
  return {
    verse: v,
    blank: v.text.replace(answer, '______'),
    answer,
    options,
    index,
  };
}

function buildFillGame() {
  const source = currentVerses();
  const allWords = [...new Set(source.flatMap(v => v.text.split(/\\s+/).map(normalizeWord).filter(w => w.length > 2)))];
  fillQuestions = source.slice(0, Math.min(5, source.length)).map((v, index) => makeFillQuestion(v, index, allWords));
  if (source.length > 5) fillQuestions = shuffle(source).slice(0, 5).map((v, index) => makeFillQuestion(v, index, allWords));
  fillAnswers = new Array(fillQuestions.length).fill(null);
  document.getElementById('fill-feedback').className = 'hidden p-3 rounded-xl text-center font-bold text-sm my-4';
  const list = document.getElementById('fill-list');
  list.innerHTML = '';
  fillQuestions.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'bg-slate-50 border border-slate-100 rounded-2xl p-4';
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
    });
  });
}

async function checkFillGame() {
  const total = fillQuestions.length || 1;
  const score = Math.round(fillAnswers.reduce((sum, a, i) => sum + (a === fillQuestions[i].answer ? 1 : 0), 0) / total * 100);
  const ok = score >= 70;
  const box = document.getElementById('fill-feedback');
  box.className = 'p-3 rounded-xl text-center font-bold text-sm my-4 ' + (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700');
  box.textContent = ok ? 'ممتاز! نتيجتك ' + score + '%.' : 'نتيجتك ' + score + '%. أعد المحاولة حتى تثبت الحفظ.';
  await Auth.recordActivity(SURAH_ID, 'fill-part-' + currentPart, score);
  if (ok) {
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: .65 } });
    if (currentPart === partCount - 1) await Auth.completeSurah(SURAH_ID);
  }
}

function goToPhase(phase) {
  currentPhase = phase;
  stopAudio();
  [0, 1, 2].forEach(i => {
    document.getElementById('phase-' + i).classList.toggle('hidden', i !== phase);
    const tab = document.getElementById('tab-' + i);
    tab.className = tab.className.replace(/tab-(active|inactive|done)/g, '').trim() + ' ' + (i === phase ? 'tab-active' : 'tab-inactive');
  });
  if (phase === 1) buildOrderGame();
  if (phase === 2) buildFillGame();
}

function buildAll() {
  buildPartButtons();
  buildAudioScreen();
  buildOrderGame();
  buildFillGame();
  goToPhase(currentPhase);
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.requireAuth();
  buildAll();
});
</script>
</body>
</html>
`;
}

function makeRegistry(items) {
  const sorted = items.slice().sort((a, b) => a.num - b.num);
  const entries = sorted.map((meta) => ({
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
 *  Pour ajouter une nouvelle sourate :
 *  1. Crée son fichier HTML  (ex: Al_Kawthar.html)
 *  2. Ajoute une entrée ici avec  available: true
 *  C'est tout — l'index se met à jour automatiquement.
 * =========================================================
 */

const SURAH_REGISTRY = ${js(entries)};
`;
}

async function main() {
  const items = [];
  for (let num = 67; num <= 114; num++) {
    items.push(await fetchSurah(num));
  }

  for (const meta of items) {
    if (existingFiles.has(meta.num)) continue;
    fs.writeFileSync(path.join(root, fileName(meta)), makeTemplate(meta), "utf8");
    console.log(`created ${fileName(meta)}`);
  }

  fs.writeFileSync(path.join(root, "registry.js"), makeRegistry(items), "utf8");
  console.log("updated registry.js");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
