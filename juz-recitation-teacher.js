(function () {
  'use strict';

  const INTRO_VERSION = '20260726-1';
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
          '<div><h2 class="virtual-teacher-title" id="virtual-teacher-title">الأستاذ الذكي</h2><p class="virtual-teacher-subtitle" id="virtual-teacher-subtitle"></p></div>',
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
      '<p class="virtual-teacher-note">استعد في مكان هادئ، ثم اقرأ السورة كاملة. سيقدم الأستاذ الذكي ملاحظات مكتوبة في النهاية. هذا التدريب اختياري ولا يغيّر تقدمك أو نجومك.</p>',
      '<button type="button" class="virtual-teacher-action" id="virtual-teacher-start">🎙️ ابدأ التسميع</button>'
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
      restartTimer: 0
    };
    const modal = ensureModal();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('virtual-teacher-subtitle').textContent = juz.name + ' · تدريب اختياري';
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
    renderListening();
    createAndStartRecognition();
    clearInterval(state.timer);
    state.timer = setInterval(updateTimer, 500);
  }

  function renderListening() {
    const body = document.getElementById('virtual-teacher-body');
    body.innerHTML = [
      '<div class="virtual-teacher-listening">',
        '<div class="virtual-teacher-mic" aria-hidden="true">🎙️</div>',
        '<div class="virtual-teacher-status" id="virtual-teacher-status">أستمع إليك... ابدأ الآن</div>',
        '<div class="virtual-teacher-timer" id="virtual-teacher-timer">00:00</div>',
        '<div class="virtual-teacher-live" id="virtual-teacher-live">ستظهر الكلمات التي يسمعها النظام هنا.</div>',
        '<button type="button" class="virtual-teacher-action danger" id="virtual-teacher-stop">إنهاء التسميع</button>',
      '</div>'
    ].join('');
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
    recognition.lang = 'ar-MA';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    state.recognition = recognition;
    recognition.onresult = event => {
      if (!state) return;
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const text = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) state.transcriptParts.push(text.trim());
        else interim += ' ' + text;
      }
      state.interim = interim.trim();
      state.restartFailures = 0;
      const live = document.getElementById('virtual-teacher-live');
      if (live) live.textContent = (state.transcriptParts.join(' ') + ' ' + state.interim).trim() || 'أستمع إليك...';
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
    if (normalizeArabic(transcript).split(' ').filter(Boolean).length < 3) {
      showError('لم أسمع كلمات كافية للتحليل. اقترب من الميكروفون وأعد المحاولة في مكان هادئ.', true);
      return;
    }
    const body = document.getElementById('virtual-teacher-body');
    body.innerHTML = '<div class="py-12 text-center font-black text-gray-500">يحلل الأستاذ الذكي تسميعك...</div>';
    setTimeout(() => renderResult(analyzeRecitation(state.verses, transcript)), 120);
  }

  function normalizeArabic(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[ٱأإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ـ/g, '')
      .replace(/[^ء-غف-ي\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  function similarity(left, right) {
    const longest = Math.max(left.length, right.length, 1);
    return Math.max(0, 1 - editDistance(left, right) / longest);
  }

  function bestSequentialMatch(target, heard, cursor) {
    if (!target.length || !heard.length || cursor >= heard.length) return { score: 0, next: cursor };
    const startMin = Math.max(0, cursor - 2);
    const startMax = Math.min(heard.length - 1, cursor + Math.max(7, Math.min(22, target.length)));
    const lengths = [...new Set([
      Math.max(1, Math.floor(target.length * .72)),
      Math.max(1, target.length - 2),
      target.length,
      target.length + 2,
      Math.ceil(target.length * 1.28)
    ])];
    let best = { score: 0, next: cursor };
    for (let start = startMin; start <= startMax; start++) {
      for (const length of lengths) {
        const sample = heard.slice(start, Math.min(heard.length, start + length));
        if (!sample.length) continue;
        const score = similarity(target, sample);
        if (score > best.score) best = { score, next: start + sample.length };
      }
    }
    return best;
  }

  function analyzeRecitation(verses, transcript) {
    const heard = normalizeArabic(transcript).split(' ').filter(Boolean);
    let cursor = 0;
    let weightedScore = 0;
    let wordCount = 0;
    const verseScores = verses.map(verse => {
      const target = normalizeArabic(verse.text).split(' ').filter(Boolean);
      const match = bestSequentialMatch(target, heard, cursor);
      if (match.score >= .22) cursor = match.next;
      weightedScore += match.score * target.length;
      wordCount += target.length;
      return { num: verse.num, score: match.score, words: target.length };
    });
    const coverage = Math.round((weightedScore / Math.max(1, wordCount)) * 100);
    const mastered = verseScores.filter(item => item.score >= .72).length;
    const review = verseScores.filter(item => item.score < .58).sort((a, b) => a.score - b.score).slice(0, 5);
    let appreciation = 'يحتاج إلى مراجعة';
    let encouragement = 'محاولة طيبة. راجع المواضع المحددة، ثم أعد التسميع بهدوء.';
    if (coverage >= 90) { appreciation = 'ممتاز'; encouragement = 'أحسنت كثيرا! تسميع متقن وواضح، حافظ على هذا المستوى.'; }
    else if (coverage >= 78) { appreciation = 'جيد جدا'; encouragement = 'تقدم جميل! بقيت مواضع قليلة، ومراجعتها ستجعل تسميعك أقوى.'; }
    else if (coverage >= 64) { appreciation = 'جيد'; encouragement = 'عمل جيد. ركز على الآيات المحددة ثم حاول مرة أخرى.'; }
    return { coverage, mastered, total: verseScores.length, review, appreciation, encouragement };
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
    publishTeacherResult(result);
    const body = document.getElementById('virtual-teacher-body');
    const reviewText = result.review.length
      ? 'راجع الآيات: ' + result.review.map(item => item.num).join('، ') + '. ثم أعدها ببطء ووضوح.'
      : 'لم أجد موضعا رئيسيا يحتاج إلى إعادة. واصل المراجعة المنتظمة.';
    body.innerHTML = [
      '<div class="virtual-teacher-result">',
        '<div class="virtual-teacher-score">' + result.coverage + '%</div>',
        '<h3 class="virtual-teacher-appreciation">' + escapeHtml(result.appreciation) + '</h3>',
        '<p class="virtual-teacher-encouragement">' + escapeHtml(result.encouragement) + '</p>',
        '<div class="virtual-teacher-metrics">',
          '<div class="virtual-teacher-metric"><strong>' + result.mastered + ' / ' + result.total + '</strong><span>آيات واضحة</span></div>',
          '<div class="virtual-teacher-metric"><strong>' + result.coverage + '%</strong><span>التطابق التقريبي</span></div>',
        '</div>',
        '<div class="virtual-teacher-review">' + escapeHtml(reviewText) + '<br><small>قد يحتاج التجويد الدقيق ومخارج الحروف إلى مراجعة الأستاذ.</small></div>',
        '<div class="virtual-teacher-actions">',
          '<button type="button" class="virtual-teacher-action secondary" id="virtual-teacher-back">اختيار سورة أخرى</button>',
          '<button type="button" class="virtual-teacher-action" id="virtual-teacher-again">إعادة التسميع</button>',
        '</div>',
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
    intro.innerHTML = '<div class="virtual-teacher-spotlight"></div><section class="virtual-teacher-coach"><span class="virtual-teacher-coach-arrow" aria-hidden="true">⬇</span><h3>الأستاذ الذكي وصل!</h3><p>اختر سورة من هذا الجزء، ثم سمّعها لتحصل على ملاحظات مكتوبة وتشجيع. التدريب اختياري ولا يغيّر تقدمك أو نجومك.</p><button type="button">فهمت</button></section>';
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
  window.MawahibVirtualTeacher = { analyzeRecitation, normalizeArabic, flushPending: flushTeacherQueue, showIntro: () => showIntroWhenReady(0) };

  addEventListener('online', flushTeacherQueue);
  setTimeout(flushTeacherQueue, 1400);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => showIntroWhenReady(0), 900));
  else setTimeout(() => showIntroWhenReady(0), 900);
})();