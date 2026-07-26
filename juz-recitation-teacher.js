(function () {
  'use strict';

  const INTRO_VERSION = '20260726-2';
  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  let state = null;
  let introResizeHandler = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function getStudentKey() {
    try {
      const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
      if (session && session.username) return session.username;
      const stored = JSON.parse(localStorage.getItem('quran_session') || 'null');
      if (stored && stored.username) return stored.username;
      if (typeof dashboardState !== 'undefined' && dashboardState.studentKey) return dashboardState.studentKey;
    } catch (error) {}
    return 'guest';
  }

  function introStorageKey() {
    return 'mawahib_virtual_teacher_intro_' + INTRO_VERSION + '_' + getStudentKey();
  }

  function ensureModal() {
    let modal = document.getElementById('virtual-teacher-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'virtual-teacher-modal';
    modal.className = 'virtual-teacher-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'virtual-teacher-title');
    modal.innerHTML = [
      '<section class="virtual-teacher-panel" dir="rtl">',
        '<header class="virtual-teacher-head">',
          '<div><h2 class="virtual-teacher-title" id="virtual-teacher-title">الأستاذ الرقمي</h2><p class="virtual-teacher-subtitle" id="virtual-teacher-subtitle"></p></div>',
          '<button type="button" class="virtual-teacher-close" aria-label="إغلاق">×</button>',
        '</header>',
        '<div id="virtual-teacher-body"></div>',
      '</section>'
    ].join('');
    document.body.appendChild(modal);
    modal.querySelector('.virtual-teacher-close').addEventListener('click', closeVirtualTeacher);
    modal.addEventListener('click', event => { if (event.target === modal) closeVirtualTeacher(); });
    return modal;
  }

  function getJuzByNumber(juzNumber) {
    return typeof juzJourney !== 'undefined' ? juzJourney.find(item => item.num === Number(juzNumber)) : null;
  }

  function getSurahsForJuz(juz) {
    if (!juz) return [];
    if (typeof getJuzSurahs === 'function') return getJuzSurahs(juz);
    if (typeof SURAH_REGISTRY !== 'undefined') return SURAH_REGISTRY.filter(item => item.num >= juz.start && item.num <= juz.end).sort((a, b) => b.num - a.num);
    return [];
  }

  function renderSelection() {
    if (!state) return;
    const body = document.getElementById('virtual-teacher-body');
    const options = state.surahs.map(surah => '<option value="' + surah.num + '">' + escapeHtml(surah.nameAr) + '</option>').join('');
    body.innerHTML = [
      '<label class="virtual-teacher-label" for="virtual-teacher-surah">اختر السورة التي تريد تسميعها</label>',
      '<select class="virtual-teacher-select" id="virtual-teacher-surah">', options, '</select>',
      '<p class="virtual-teacher-note">استعد في مكان هادئ، ثم اقرأ السورة كاملة. سيحلل النظام الكلمات والترتيب، ولن يصدر تقييما إذا كانت دقة الصوت غير كافية. هذا التدريب اختياري ولا يغيّر تقدمك أو نجومك.</p>',
      '<button type="button" class="virtual-teacher-action" id="virtual-teacher-start">🎙️ ابدأ التسميع الواضح</button>'
    ].join('');
    document.getElementById('virtual-teacher-surah').value = String(state.selectedSurahNumber || state.surahs[0]?.num || '');
    document.getElementById('virtual-teacher-surah').addEventListener('change', event => { state.selectedSurahNumber = Number(event.target.value); });
    document.getElementById('virtual-teacher-start').addEventListener('click', startRecitation);
  }

  function openVirtualTeacher(juzNumber) {
    const juz = getJuzByNumber(juzNumber);
    if (!juz) return;
    closeVirtualTeacher();
    const surahs = getSurahsForJuz(juz);
    if (!surahs.length) return;
    state = {
      juz,
      surahs,
      selectedSurahNumber: surahs[0].num,
      verses: [],
      transcriptParts: [],
      interim: '',
      recognition: null,
      listening: false,
      manualStop: false,
      restartFailures: 0,
      startedAt: 0,
      timer: 0,
      restartTimer: 0,
      confidenceSamples: [],
      capturedSegments: 0
    };
    const modal = ensureModal();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('virtual-teacher-subtitle').textContent = juz.name + ' · تحليل محافظ للكلمات';
    renderSelection();
  }

  function closeVirtualTeacher() {
    stopRecognition(true);
    const modal = document.getElementById('virtual-teacher-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    state = null;
  }

  function showError(message, canRetry) {
    const body = document.getElementById('virtual-teacher-body');
    if (!body) return;
    body.innerHTML = '<div class="virtual-teacher-error">' + escapeHtml(message) + '</div>' + (canRetry ? '<button type="button" class="virtual-teacher-action secondary" id="virtual-teacher-retry">العودة</button>' : '');
    document.getElementById('virtual-teacher-retry')?.addEventListener('click', renderSelection);
  }

  async function requestMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    stream.getTracks().forEach(track => track.stop());
  }

  async function startRecitation() {
    if (!state) return;
    const selected = state.surahs.find(item => item.num === Number(state.selectedSurahNumber));
    if (!selected) return;
    const startButton = document.getElementById('virtual-teacher-start');
    if (startButton) { startButton.disabled = true; startButton.textContent = 'جاري التحضير...'; }
    if (!SpeechRecognitionApi) {
      showError('التحليل الصوتي غير متاح في هذا المتصفح. افتح المنصة في Google Chrome أو Microsoft Edge واسمح باستعمال الميكروفون.', true);
      return;
    }
    try {
      const loaded = typeof loadSurahVerses === 'function' ? await loadSurahVerses(selected) : { verses: [] };
      if (!loaded.verses || !loaded.verses.length) throw new Error('verses');
      state.verses = loaded.verses;
      state.selectedSurah = selected;
      await requestMicrophone();
      beginListening();
    } catch (error) {
      const denied = error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
      showError(denied ? 'يجب السماح باستعمال الميكروفون لبدء التسميع.' : 'تعذر تجهيز السورة الآن. تحقق من الاتصال ثم حاول مرة أخرى.', true);
    }
  }

  function beginListening() {
    if (!state) return;
    state.transcriptParts = [];
    state.interim = '';
    state.resultSent = false;
    state.listening = true;
    state.manualStop = false;
    state.startedAt = Date.now();
    state.restartFailures = 0;
    state.confidenceSamples = [];
    state.capturedSegments = 0;
    renderListening();
    createAndStartRecognition();
    clearInterval(state.timer);
    state.timer = setInterval(updateTimer, 500);
  }

  function renderListening() {
    const body = document.getElementById('virtual-teacher-body');
    body.innerHTML = [
      '<div class="virtual-teacher-listening">',
        '<div class="virtual-teacher-listening-surah">' + escapeHtml(state.selectedSurah?.nameAr || '') + '</div>',
        '<div class="virtual-teacher-mic" aria-hidden="true">🎙️</div>',
        '<div class="virtual-teacher-status" id="virtual-teacher-status">أستمع الآن</div>',
        '<div class="virtual-teacher-timer" id="virtual-teacher-timer">00:00</div>',
        '<div class="virtual-teacher-capture" id="virtual-teacher-live">ابدأ القراءة ولا تراقب الشاشة أثناء التسميع.</div>',
        '<div class="virtual-teacher-actions listening-actions">',
          '<button type="button" class="virtual-teacher-action secondary" id="virtual-teacher-cancel">إلغاء</button>',
          '<button type="button" class="virtual-teacher-action" id="virtual-teacher-stop">إنهاء وتحليل</button>',
        '</div>',
      '</div>'
    ].join('');
    document.getElementById('virtual-teacher-cancel').addEventListener('click', () => { stopRecognition(true); renderSelection(); });
    document.getElementById('virtual-teacher-stop').addEventListener('click', finishRecitation);
  }

  function updateTimer() {
    if (!state || !state.startedAt) return;
    const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    const element = document.getElementById('virtual-teacher-timer');
    if (element) element.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function createAndStartRecognition() {
    if (!state || !state.listening) return;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    state.recognition = recognition;
    recognition.onresult = event => {
      if (!state) return;
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const choice = chooseRecognitionAlternative(event.results[index]);
        if (!choice.text) continue;
        if (event.results[index].isFinal) {
          appendTranscriptPart(choice.text);
          if (choice.confidence > 0) state.confidenceSamples.push(choice.confidence);
          state.capturedSegments += 1;
        } else interim += ' ' + choice.text;
      }
      state.interim = interim.trim();
      state.restartFailures = 0;
      const live = document.getElementById('virtual-teacher-live');
      if (live) live.textContent = state.capturedSegments ? 'تم التقاط القراءة. واصل حتى آخر آية.' : 'أستمع إليك...';
    };


  recognition.onerror = event => {
      if (!state) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        state.listening = false;
        showError('تعذر استعمال الميكروفون. تحقق من الإذن ومن إعدادات الصوت ثم حاول مرة أخرى.', true);
        stopRecognition(true);
      } else if (event.error === 'network') {
        const status = document.getElementById('virtual-teacher-status');
        if (status) status.textContent = 'الاتصال ضعيف، أحاول متابعة الاستماع...';
      } else if (event.error === 'no-speech') {
        const status = document.getElementById('virtual-teacher-status');
        if (status) status.textContent = 'لم أسمع صوتا واضحا بعد...';
      }
    };
    recognition.onend = () => {
      if (!state || !state.listening || state.manualStop) return;
      state.restartFailures += 1;
      const delay = Math.min(1400, 250 * state.restartFailures);
      clearTimeout(state.restartTimer);
      state.restartTimer = setTimeout(() => {
        if (state && state.listening && !state.manualStop) createAndStartRecognition();
      }, delay);
    };
    try { recognition.start(); }
    catch (error) {
      state.restartFailures += 1;
      state.restartTimer = setTimeout(createAndStartRecognition, 500);
    }
  }

  function stopRecognition(abort) {
    if (!state) return;
    state.listening = false;
    state.manualStop = true;
    clearInterval(state.timer);
    clearTimeout(state.restartTimer);
    if (state.recognition) {
      try { abort ? state.recognition.abort() : state.recognition.stop(); } catch (error) {}
      state.recognition = null;
    }
  }

  function finishRecitation() {
    if (!state) return;
    const transcript = (state.transcriptParts.join(' ') + ' ' + state.interim).trim();
    stopRecognition(false);
    if (words(transcript).length < 4) {
      renderUnverified('لم ألتقط كلمات كافية.', 'اقترب من الميكروفون وأعد التسميع في مكان هادئ.');
      return;
    }
    document.getElementById('virtual-teacher-body').innerHTML = '<div class="virtual-teacher-analyzing"><span></span><strong>جاري التحقق من الكلمات وترتيب الآيات...</strong></div>';
    const confidences = state.confidenceSamples.slice();
    setTimeout(() => renderResult(analyzeRecitation(state.verses, transcript, { confidences })), 100);
  }

  function normalizeArabic(value) {
    return String(value || '').normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[^ء-غف-ي\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function words(value) { return normalizeArabic(value).split(' ').filter(Boolean); }

  function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = new Array(right.length + 1);
    for (let i = 1; i <= left.length; i++) {
      current[0] = i;
      for (let j = 1; j <= right.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      for (let j = 0; j <= right.length; j++) previous[j] = current[j];
    }
    return previous[right.length];
  }

  function wordSimilarity(left, right) {
    if (left === right) return 1;
    return Math.max(0, 1 - editDistance(left, right) / Math.max(left.length, right.length, 1));
  }

  function sequenceSimilarity(target, sample) {
    if (!target.length || !sample.length) return 0;
    const previous = Array.from({ length: sample.length + 1 }, (_, index) => index);
    const current = new Array(sample.length + 1);
    for (let i = 1; i <= target.length; i++) {
      current[0] = i;
      for (let j = 1; j <= sample.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + 1 - wordSimilarity(target[i - 1], sample[j - 1]));
      for (let j = 0; j <= sample.length; j++) previous[j] = current[j];
    }
    return Math.max(0, 1 - previous[sample.length] / Math.max(target.length, sample.length, 1));
  }

  function removeOptionalBasmala(list) {
    const basmala = ['بسم', 'الله', 'الرحمن', 'الرحيم'].map(normalizeArabic);
    if (list.length < 4) return list;
    const score = basmala.reduce((sum, item, index) => sum + wordSimilarity(item, list[index]), 0) / 4;
    return score >= .67 ? list.slice(4) : list;
  }

  function referenceVerseWords(verse, index) {
    const list = words(verse.text);
    return index === 0 ? removeOptionalBasmala(list) : list;
  }

  function bestSequentialMatch(target, heard, cursor) {
    if (!target.length || !heard.length || cursor >= heard.length) return { score: 0, next: cursor };
    const direct = heard.slice(cursor, cursor + target.length);
    const directScore = sequenceSimilarity(target, direct);
    if (directScore >= .82) return { score: directScore, next: cursor + direct.length };
    const startMin = Math.max(0, cursor - 2);
    const startMax = Math.min(heard.length - 1, cursor + Math.max(4, Math.min(12, Math.ceil(target.length * .45))));
    const lengths = [...new Set([Math.max(1, Math.floor(target.length * .68)), Math.max(1, target.length - 2), target.length, target.length + 2, Math.ceil(target.length * 1.32)])];
    let best = { score: 0, next: cursor };
    for (let start = startMin; start <= startMax; start++) for (const length of lengths) {
      const sample = heard.slice(start, Math.min(heard.length, start + length));
      const score = sequenceSimilarity(target, sample);
      if (score > best.score) best = { score, next: start + sample.length };
    }
    return best;
  }

  function analyzeRecitation(verses, transcript, meta = {}) {
    let heard = removeOptionalBasmala(words(transcript));
    const targets = verses.map(referenceVerseWords);
    const expectedWords = targets.reduce((sum, list) => sum + list.length, 0);
    let cursor = 0, weightedScore = 0;
    const verseScores = targets.map((target, index) => {
      const match = bestSequentialMatch(target, heard, cursor);
      if (match.score >= .28) cursor = match.next;
      weightedScore += match.score * target.length;
      return { num: verses[index].num, score: match.score, words: target.length };
    });
    const coverage = Math.round(weightedScore / Math.max(1, expectedWords) * 100);
    const heardRatio = heard.length / Math.max(1, expectedWords);
    const observed = verseScores.filter(item => item.score >= .38).length;
    const mastered = verseScores.filter(item => item.score >= .78).length;
    const review = verseScores.filter(item => item.score < .68).sort((a, b) => a.num - b.num).slice(0, 5);
    const confidenceValues = (meta.confidences || []).map(Number).filter(value => value > 0 && value <= 1);
    const confidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : null;
    const incomplete = heardRatio < .58 || observed < Math.ceil(verseScores.length * .55);
    const isConclusive = !incomplete && coverage >= 60;
    let status = isConclusive ? 'evaluated' : (incomplete ? 'incomplete' : 'unverified');
    let appreciation = '', encouragement = '';
    if (status === 'incomplete') { appreciation = 'التسميع غير مكتمل'; encouragement = 'أعد قراءة السورة كاملة، ثم أنهِ التسميع بعد آخر آية.'; }
    else if (status === 'unverified') { appreciation = 'لم أتمكن من التحقق'; encouragement = 'قد تكون جودة الصوت أو دقة التعرف غير كافية. لم أصدر أي نقطة.'; }
    else if (coverage >= 92) { appreciation = 'ممتاز'; encouragement = 'تم التعرف على السورة كاملة وبترتيب صحيح.'; }
    else if (coverage >= 84) { appreciation = 'جيد جدا'; encouragement = 'التسميع قريب جدا من النص، مع مواضع قليلة للمراجعة.'; }
    else if (coverage >= 74) { appreciation = 'جيد'; encouragement = 'راجع الآيات المحددة ثم أعد التسميع.'; }
    else { appreciation = 'يحتاج إلى مراجعة'; encouragement = 'تم التعرف على جزء معتبر، لكن توجد مواضع تحتاج إلى إعادة.'; }
    return { status, isConclusive, coverage, mastered, total: verseScores.length, review, appreciation, encouragement, heardWords: heard.length, expectedWords, heardRatio, confidence };
  }

  function alternativeAffinity(text) {
    if (!state?.verses?.length) return 0;
    const candidate = words(text), reference = state.verses.flatMap(referenceVerseWords);
    if (!candidate.length) return 0;
    return candidate.reduce((sum, word) => {
      let best = 0;
      for (const target of reference) { best = Math.max(best, wordSimilarity(word, target)); if (best === 1) break; }
      return sum + best;
    }, 0) / candidate.length;
  }

  function chooseRecognitionAlternative(result) {
    const alternatives = Array.from({ length: Math.min(result.length || 0, 5) }, (_, index) => result[index]).filter(Boolean);
    let best = { text: '', confidence: 0, rank: -1 };
    alternatives.forEach((alternative, index) => {
      const text = String(alternative.transcript || '').trim(), confidence = Number(alternative.confidence || 0);
      const rank = alternativeAffinity(text) + Math.min(.12, confidence * .12) - index * .01;
      if (text && rank > best.rank) best = { text, confidence, rank };
    });
    return best;
  }

  function appendTranscriptPart(text) {
    if (!state) return;
    const clean = String(text || '').trim(), normalized = normalizeArabic(clean);
    const last = state.transcriptParts[state.transcriptParts.length - 1] || '', lastNormalized = normalizeArabic(last);
    if (!clean || normalized === lastNormalized || (lastNormalized.length > 12 && lastNormalized.endsWith(normalized))) return;
    state.transcriptParts.push(clean);
  }

  function renderUnverified(title, message) {
    if (!state) return;
    stopRecognition(true);
    const body = document.getElementById('virtual-teacher-body');
    body.innerHTML = '<div class="virtual-teacher-unverified"><span aria-hidden="true">↻</span><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(message) + '</p><strong>لم تُسجل أي نقطة أو ملاحظة.</strong></div><div class="virtual-teacher-actions"><button type="button" class="virtual-teacher-action secondary" id="virtual-teacher-back">اختيار سورة أخرى</button><button type="button" class="virtual-teacher-action" id="virtual-teacher-again">إعادة المحاولة</button></div>';
    document.getElementById('virtual-teacher-back').addEventListener('click', renderSelection);
    document.getElementById('virtual-teacher-again').addEventListener('click', beginListening);
  }

  function teacherQueueKey() {
    return 'mawahib_virtual_teacher_queue_' + getStudentKey();
  }

  function readTeacherQueue() {
    try {
      const rows = JSON.parse(localStorage.getItem(teacherQueueKey()) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      return [];
    }
  }

  function writeTeacherQueue(rows) {
    try { localStorage.setItem(teacherQueueKey(), JSON.stringify((rows || []).slice(-20))); } catch (error) {}
  }

  async function flushTeacherQueue() {
    if (!navigator.onLine || typeof Auth === 'undefined' || !Auth.getSupabaseClient) return;
    const client = Auth.getSupabaseClient();
    if (!client) return;
    const rows = readTeacherQueue();
    if (!rows.length) return;
    const remaining = [];
    for (const payload of rows) {
      try {
        const response = await client.from('messages').insert([{
          username: '__virtual_teacher_activity__',
          text: '[VIRTUAL_TEACHER_RECITATION] ' + JSON.stringify(payload),
          date: new Date(payload.createdAt).toLocaleDateString('ar-MA', { day: 'numeric', month: 'long' })
        }]);
        if (response.error) remaining.push(payload);
      } catch (error) {
        remaining.push(payload);
      }
    }
    writeTeacherQueue(remaining);
  }

  function publishTeacherResult(result) {
    if (!state || state.resultSent || !state.selectedSurah) return;
    if (!result.isConclusive) return;
    state.resultSent = true;
    let session = null;
    try { session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null; } catch (error) {}
    const payload = {
      id: 'virtual_recitation_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      source: 'virtual_teacher',
      studentId: session?.username || getStudentKey(),
      studentName: [session?.prenom, session?.nom].filter(Boolean).join(' '),
      className: session?.classe || '',
      juzNumber: state.juz.num,
      juzName: state.juz.name,
      surahId: state.selectedSurah.id,
      surahName: state.selectedSurah.nameAr,
      score: result.coverage,
      engineVersion: 2,
      appreciation: result.appreciation,
      masteredVerses: result.mastered,
      totalVerses: result.total,
      reviewVerses: result.review.map(item => item.num),
      createdAt: new Date().toISOString()
    };
    const queue = readTeacherQueue();
    if (!queue.some(item => item.id === payload.id)) queue.push(payload);
    writeTeacherQueue(queue);
    flushTeacherQueue();
  }
  function renderResult(result) {
    if (!state) return;
    if (!result.isConclusive) { renderUnverified(result.appreciation, result.encouragement); return; }
    publishTeacherResult(result);
    const reviewText = result.review.length ? 'راجع الآيات: ' + result.review.map(item => item.num).join('، ') : 'لم يظهر موضع واضح يحتاج إلى إعادة.';
    const body = document.getElementById('virtual-teacher-body');
    body.innerHTML = [
      '<div class="virtual-teacher-result">',
        '<div class="virtual-teacher-result-head"><span>نتيجة التحليل</span><strong>' + escapeHtml(result.appreciation) + '</strong></div>',
        '<div class="virtual-teacher-match"><div><span style="width:' + result.coverage + '%"></span></div><strong>' + result.coverage + '%</strong><small>تطابق الكلمات والترتيب</small></div>',
        '<p class="virtual-teacher-encouragement">' + escapeHtml(result.encouragement) + '</p>',
        '<div class="virtual-teacher-review">' + escapeHtml(reviewText) + '<br><small>هذا التحليل للكلمات والترتيب فقط. التجويد ومخارج الحروف يراجعها الأستاذ.</small></div>',
        '<div class="virtual-teacher-actions"><button type="button" class="virtual-teacher-action secondary" id="virtual-teacher-back">اختيار سورة أخرى</button><button type="button" class="virtual-teacher-action" id="virtual-teacher-again">إعادة التسميع</button></div>',
      '</div>'
    ].join('');
    document.getElementById('virtual-teacher-back').addEventListener('click', renderSelection);
    document.getElementById('virtual-teacher-again').addEventListener('click', beginListening);
  }

  function ensureIntro() {
    let intro = document.getElementById('virtual-teacher-intro');
    if (intro) return intro;
    intro = document.createElement('div');
    intro.id = 'virtual-teacher-intro';
    intro.className = 'virtual-teacher-intro';
    intro.hidden = true;
    intro.innerHTML = '<div class="virtual-teacher-spotlight"></div><section class="virtual-teacher-coach"><span class="virtual-teacher-coach-arrow" aria-hidden="true">⬇</span><h3>الأستاذ الرقمي</h3><p>اختر سورة وسمّعها. إذا لم يكن الصوت واضحا فلن يعطيك النظام نقطة خاطئة، بل سيطلب إعادة المحاولة.</p><button type="button">فهمت</button></section>';
    document.body.appendChild(intro);
    intro.querySelector('button').addEventListener('click', acknowledgeIntro);
    return intro;
  }

  function positionIntro(target) {
    const intro = document.getElementById('virtual-teacher-intro');
    if (!intro || intro.hidden || !target) return;
    const rect = target.getBoundingClientRect();
    const spotlight = intro.querySelector('.virtual-teacher-spotlight');
    const coach = intro.querySelector('.virtual-teacher-coach');
    const padding = 5;
    spotlight.style.left = Math.max(4, rect.left - padding) + 'px';
    spotlight.style.top = Math.max(4, rect.top - padding) + 'px';
    spotlight.style.width = Math.min(innerWidth - 8, rect.width + padding * 2) + 'px';
    spotlight.style.height = rect.height + padding * 2 + 'px';
    const coachHeight = coach.offsetHeight || 180;
    const below = rect.bottom + coachHeight + 28 < innerHeight;
    coach.classList.toggle('is-below', below);
    coach.classList.toggle('is-above', !below);
    coach.style.left = Math.max(12, Math.min(innerWidth - coach.offsetWidth - 12, rect.left + rect.width / 2 - coach.offsetWidth / 2)) + 'px';
    coach.style.top = (below ? rect.bottom + 26 : Math.max(12, rect.top - coachHeight - 26)) + 'px';
  }

  function showIntroWhenReady(attempt) {
    if (localStorage.getItem(introStorageKey()) === '1') return;
    if (window.MawahibFirstUseGuide && MawahibFirstUseGuide.isActiveOrPending && MawahibFirstUseGuide.isActiveOrPending()) {
      window.addEventListener('mawahib:first-use-complete', () => showIntroWhenReady(0), { once: true });
      return;
    }
    if (!document.getElementById('medal-intro-modal')?.hidden) {
      if (attempt < 30) setTimeout(() => showIntroWhenReady(attempt + 1), 500);
      return;
    }
    const target = document.querySelector('.juz-section.is-active .juz-recitation-button') || document.querySelector('.juz-recitation-button');
    if (!target) {
      if (attempt < 30) setTimeout(() => showIntroWhenReady(attempt + 1), 350);
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const intro = ensureIntro();
    intro.hidden = false;
    intro.dataset.juzNumber = target.dataset.juzNumber || '';
    intro.dataset.storageKey = introStorageKey();
    setTimeout(() => positionIntro(target), 520);
    introResizeHandler = () => positionIntro(target);
    addEventListener('resize', introResizeHandler, { passive: true });
    addEventListener('scroll', introResizeHandler, { passive: true });
  }

  function acknowledgeIntro() {
    const intro = document.getElementById('virtual-teacher-intro');
    const storageKey = intro?.dataset.storageKey || introStorageKey();
    try { localStorage.setItem(storageKey, '1'); } catch (error) {}
    if (intro) intro.hidden = true;
    if (introResizeHandler) {
      removeEventListener('resize', introResizeHandler);
      removeEventListener('scroll', introResizeHandler);
      introResizeHandler = null;
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const intro = document.getElementById('virtual-teacher-intro');
    if (intro && !intro.hidden) acknowledgeIntro();
    else if (document.getElementById('virtual-teacher-modal')?.classList.contains('open')) closeVirtualTeacher();
  });

  window.openJuzRecitationTeacher = openVirtualTeacher;
  window.closeJuzRecitationTeacher = closeVirtualTeacher;
  window.MawahibVirtualTeacher = { analyzeRecitation, normalizeArabic, chooseRecognitionAlternative, flushPending: flushTeacherQueue, showIntro: () => showIntroWhenReady(0) };

  addEventListener('online', flushTeacherQueue);
  setTimeout(flushTeacherQueue, 1400);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => showIntroWhenReady(0), 900));
  else setTimeout(() => showIntroWhenReady(0), 900);
})();