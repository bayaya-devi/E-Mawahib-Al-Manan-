(function () {
  if (typeof window.confetti !== 'function') window.confetti = function () {};

  const storageKey = 'mawahib_theme';
  const soundKey = 'mawahib_sound_enabled';
  const fallback = 'traditional';
  const themes = ['traditional', 'emerald', 'indigo', 'rose', 'amber'];
  const lessonAudioEvent = 'mawahib:lesson-audio-ended';

  function instrumentLessonAudio() {
    if (window.__mawahibAudioInstrumented || typeof window.Audio !== 'function') return;
    const NativeAudio = window.Audio;
    function TrackedAudio(...args) {
      const audio = new NativeAudio(...args);
      audio.addEventListener('ended', () => {
        window.dispatchEvent(new CustomEvent(lessonAudioEvent, { detail: { src: audio.currentSrc || audio.src || '' } }));
      });
      audio.addEventListener('error', () => {
        window.dispatchEvent(new CustomEvent(lessonAudioEvent, { detail: { src: audio.currentSrc || audio.src || '', failed: true } }));
      });
      return audio;
    }
    TrackedAudio.prototype = NativeAudio.prototype;
    Object.setPrototypeOf(TrackedAudio, NativeAudio);
    window.Audio = TrackedAudio;
    window.__mawahibAudioInstrumented = true;
  }

  function createLessonXp(phases) {
    const isSurahPage = /(^|\/)surah-|Al_|al_kadr|quraysh|fil|bayina|qaria/.test(location.pathname);
    if (!isSurahPage) return null;
    const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
    const storageId = 'mawahib_lesson_xp_' + (session?.username || 'local') + '_' + location.pathname.split('/').pop();
    let state = { xp: 0, awards: [] };
    try { state = { ...state, ...(JSON.parse(sessionStorage.getItem(storageId) || 'null') || {}) }; } catch (error) {}
    state.awards = Array.isArray(state.awards) ? state.awards : [];

    let label = document.getElementById('xp-label');
    let bar = document.getElementById('xp-bar');
    if (!label) {
      const panel = document.createElement('section');
      panel.className = 'mawahib-unified-xp';
      panel.innerHTML = '<div><strong>نقاط الخبرة</strong><span id="xp-label">0</span></div><div class="mawahib-unified-xp-track"><span id="xp-bar"></span></div>';
      const anchor = document.querySelector('main') || document.body.firstElementChild;
      if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor);
      label = panel.querySelector('#xp-label');
      bar = panel.querySelector('#xp-bar');
    }

    function save() {
      try { sessionStorage.setItem(storageId, JSON.stringify(state)); } catch (error) {}
    }

    function render() {
      const value = String(Math.max(0, Math.min(100, state.xp || 0)));
      const width = value + '%';
      if (label && label.textContent !== value) label.textContent = value;
      if (bar && bar.style.width !== width) bar.style.width = width;
    }

    function award(key) {
      if (!key || state.awards.includes(key)) return false;
      const partCount = Math.max(1, document.querySelectorAll('.part-btn').length);
      const totalSteps = Math.max(1, partCount * phases.length);
      state.awards.push(key);
      state.xp = Math.min(100, Math.round(state.awards.length / totalSteps * 100));
      save();
      queueMicrotask(render);
      return true;
    }

    function finish() {
      state.xp = 100;
      save();
      render();
    }

    const observer = new MutationObserver(() => queueMicrotask(render));
    if (label) observer.observe(label, { childList: true, characterData: true, subtree: true });
    if (bar) observer.observe(bar, { attributes: true, attributeFilter: ['style'] });
    const api = { award, finish, state };
    window.__mawahibLessonXp = api;
    render();
    return api;
  }

  function initLessonGuard() {
    const phases = [...document.querySelectorAll('[id^="phase-"]')]
      .filter(element => /^phase-\d+$/.test(element.id))
      .sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]));
    if (phases.length < 2 || typeof window.goToPhase !== 'function') return;

    const completed = new Set();
    const awarded = new Set();
    const listened = new Map();
    const originalGoToPhase = window.goToPhase;
    const originalUpdateStats = typeof window.updateStats === 'function' ? window.updateStats : null;
    const originalFinishMission = typeof window.finishMission === 'function' ? window.finishMission : null;
    const lessonXp = createLessonXp(phases);
    const interacted = new Set();
    const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
    const lessonFile = location.pathname.split('/').pop();
    const completionStorageId = 'mawahib_lesson_steps_' + (session?.username || 'local') + '_' + lessonFile;
    let completionState = { completed: [] };
    let transitionSequence = 0;
    let finishing = false;

    try {
      completionState = { ...completionState, ...(JSON.parse(localStorage.getItem(completionStorageId) || 'null') || {}) };
    } catch (error) {}
    completionState.completed = Array.isArray(completionState.completed)
      ? [...new Set(completionState.completed.filter(key => /^\d+:\d+$/.test(key)))]
      : [];

    function saveCompletedSteps() {
      try { localStorage.setItem(completionStorageId, JSON.stringify(completionState)); } catch (error) {}
    }

    if (typeof window.buildSpeedGame === 'function' && typeof window.currentVerses === 'function' && typeof window.answerSpeed === 'function') {
      const originalBuildSpeedGame = window.buildSpeedGame;
      window.buildSpeedGame = function buildSpeedGameWithDistinctChoices() {
        const result = originalBuildSpeedGame.apply(this, arguments);
        const container = document.getElementById('speed-options');
        if (!container) return result;
        let question = null;
        try { question = window.eval('speedQuestion'); } catch (error) {}
        if (!question?.answer) return result;
        const source = window.currentVerses();
        const seen = new Set([question.answer.text]);
        const distractors = source
          .filter(verse => verse.num !== question.answer.num && verse.num !== question.base?.num && verse.text !== question.answer.text)
          .sort(() => Math.random() - 0.5)
          .filter(verse => {
            if (seen.has(verse.text)) return false;
            seen.add(verse.text);
            return true;
          })
          .slice(0, 3);
        if (!distractors.length) return result;
        container.innerHTML = '';
        [question.answer, ...distractors].sort(() => Math.random() - 0.5).forEach(verse => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'verse-card bg-white rounded-xl p-4 quran-text text-xl md:text-2xl font-bold text-right';
          button.textContent = verse.text;
          button.onclick = () => window.answerSpeed(verse.num);
          container.appendChild(button);
        });
        return result;
      };
    }

    (lessonXp?.state.awards || []).forEach(key => {
      if (/^\d+:\d+$/.test(key)) {
        awarded.add(key);
      }
    });
    completionState.completed.forEach(key => completed.add(key));

    function currentPartIndex() {
      const buttons = [...document.querySelectorAll('.part-btn')];
      const active = buttons.findIndex(button => button.classList.contains('active'));
      return active < 0 ? 0 : active;
    }

    function currentPhaseIndex() {
      const visible = phases.findIndex(phase => !phase.classList.contains('hidden'));
      return visible < 0 ? 0 : visible;
    }

    function stepKey(phase, part = currentPartIndex()) {
      return part + ':' + phase;
    }

    function isOptionalPhase(index) {
      const phase = phases[index];
      if (!phase) return false;
      if (index === 0) return true;
      return Boolean(phase.querySelector(
        '#mic-btn, [onclick*="toggleMic"], [onclick*="startMic"], [onclick*="skipVoice"]'
      ));
    }

    function showBlockedMessage() {
      let toast = document.getElementById('mawahib-lesson-lock-message');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mawahib-lesson-lock-message';
        toast.setAttribute('role', 'status');
        toast.style.cssText = 'position:fixed;left:50%;bottom:94px;z-index:220;transform:translate(-50%,18px);max-width:calc(100vw - 28px);padding:12px 18px;border-radius:14px;background:#7f1d1d;color:#fff;font-family:var(--platform-font-ui,Cairo),sans-serif;font-weight:900;text-align:center;box-shadow:0 14px 35px rgba(15,23,42,.25);opacity:0;transition:.2s ease;pointer-events:none';
        document.body.appendChild(toast);
      }
      toast.textContent = '🧩 أكمل التمرين الحالي أولاً';
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%,0)';
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%,18px)';
      }, 1900);
    }

    function canOpenPhase(target, part = currentPartIndex()) {
      for (let phase = 0; phase < target; phase++) {
        if (isOptionalPhase(phase)) continue;
        if (!completed.has(stepKey(phase, part))) return false;
      }
      return true;
    }

    function visibleSuccess(phase) {
      if (phase.dataset.mawahibCompleted === 'true') return true;
      const pairsLeft = phase.querySelector('#pairs-left');
      if (pairsLeft && /^\s*0\b/.test(pairsLeft.textContent || '')) return true;
      const wordsFound = phase.querySelector('#words-found');
      if (wordsFound) {
        const values = (wordsFound.textContent || '').match(/\d+/g) || [];
        if (values.length >= 2 && Number(values[0]) === Number(values[1])) return true;
      }
      return [...phase.querySelectorAll('[id*="feedback"]')].some(element =>
        !element.classList.contains('hidden') && /success|emerald|green/.test(element.className)
      );
    }

    function verifiedSuccess(index) {
      const phase = phases[index];
      if (!phase) return false;
      const fillFeedback = phase.querySelector('#fill-feedback');
      if (fillFeedback) {
        const percentage = (fillFeedback.textContent || '').match(/(\d+)\s*%/);
        if (percentage) return Number(percentage[1]) === 100;
      }
      return visibleSuccess(phase);
    }

    function scheduleVerifiedAdvance(phase, part, delay = 950) {
      const key = stepKey(phase, part);
      const sequence = ++transitionSequence;
      setTimeout(() => {
        if (sequence !== transitionSequence || currentPhaseIndex() !== phase || currentPartIndex() !== part) return;
        if (!completed.has(key)) return;
        if (phase < phases.length - 1) {
          window.goToPhase(phase + 1);
        } else if (originalFinishMission && !finishing) {
          window.finishMission();
        }
      }, delay);
    }

    function completeVerifiedStep(phase = currentPhaseIndex(), part = currentPartIndex()) {
      const key = stepKey(phase, part);
      completed.add(key);
      if (!completionState.completed.includes(key)) {
        completionState.completed.push(key);
        saveCompletedSteps();
      }
      lessonXp?.award(key);
      scheduleVerifiedAdvance(phase, part);
      return key;
    }

    function surahId() {
      const file = location.pathname.split('/').pop();
      if (typeof SURAH_REGISTRY !== 'undefined' && Array.isArray(SURAH_REGISTRY)) {
        const meta = SURAH_REGISTRY.find(item => item.file === file);
        if (meta) return meta.id;
      }
      return file.replace(/^surah-/, '').replace(/\.html$/i, '').toLowerCase();
    }

    function completeListening() {
      const key = stepKey(0);
      if (completed.has(key)) return;
      completed.add(key);
      awarded.add(key);
      if (originalUpdateStats) originalUpdateStats(10, true);
      lessonXp?.award(key);
      if (typeof Auth !== 'undefined' && typeof Auth.recordActivity === 'function') {
        Auth.recordActivity(surahId(), 'listening-part-' + currentPartIndex(), 100);
      }
      setTimeout(() => window.goToPhase(1), 650);
    }

    function expectedListeningState() {
      let codes = [];
      try {
        if (window.MawahibSurahAudio?.currentCodes) codes = window.MawahibSurahAudio.currentCodes();
        else if (typeof window.currentVerses === 'function') codes = window.currentVerses().map(verse => verse?.audio);
      } catch (error) {}
      const normalized = new Set((codes || []).map(String).filter(code => /^\d{6}$/.test(code)));
      const fallbackCount = document.querySelectorAll('#audio-list > *, #audio-verses-box > *').length;
      return { codes: normalized, count: normalized.size || fallbackCount };
    }

    window.addEventListener(lessonAudioEvent, event => {
      if (currentPhaseIndex() !== 0 || event.detail?.failed) return;
      const src = String(event.detail?.src || '');
      const audioCode = (src.match(/(\d{6})(?:\.mp3)?(?:\?|$)/) || [])[1] || src;
      if (!audioCode) return;
      const part = currentPartIndex();
      const key = String(part);
      const heard = listened.get(key) || new Set();
      const expected = expectedListeningState();
      if (expected.codes.size && !expected.codes.has(audioCode)) return;
      heard.add(audioCode);
      listened.set(key, heard);
      if (expected.count > 0 && heard.size >= expected.count) completeListening();
    });

    window.goToPhase = function guardedGoToPhase(target) {
      const phase = Number(target);
      const current = currentPhaseIndex();
      if (!Number.isInteger(phase) || phase < 0 || phase >= phases.length) return false;
      if (phase === current) return true;
      if (phase === current + 1 && current > 0 && verifiedSuccess(current)) {
        completeVerifiedStep(current);
      }
      if (phase > currentPhaseIndex() && !canOpenPhase(phase)) {
        const feedback = document.getElementById('fill-feedback');
        if (phase === 3 && feedback && /100\s*%/.test(feedback.textContent || '')) {
          completed.add(stepKey(2));
        }
      }
      if (!canOpenPhase(phase)) {
        showBlockedMessage();
        return false;
      }
      transitionSequence++;
      if (phase === 0) finishing = false;
      return originalGoToPhase.apply(this, arguments);
    };

    if (originalUpdateStats) {
      window.updateStats = function guardedUpdateStats(delta = 0, ok = true) {
        const phase = currentPhaseIndex();
        const key = stepKey(phase);
        if (Number(delta) <= 0 || ok !== true) return originalUpdateStats.call(this, delta, ok);
        if (phase === 0) return originalUpdateStats.call(this, 0, ok);
        const isVerified = phase === 2 ? verifiedSuccess(phase) : true;
        if (isVerified) completeVerifiedStep(phase);
        const xpDelta = awarded.has(key) ? 0 : (phase === phases.length - 1 ? 100 : delta);
        if (!awarded.has(key)) awarded.add(key);
        return originalUpdateStats.call(this, xpDelta, ok);
      };
    }

    if (originalFinishMission) {
      window.finishMission = function guardedFinishMission() {
        if (!completed.has(stepKey(phases.length - 1))) {
          showBlockedMessage();
          return false;
        }
        if (finishing) return false;
        finishing = true;
        transitionSequence++;
        return originalFinishMission.apply(this, arguments);
      };
    }


    document.addEventListener('click', event => {
      const phase = event.target.closest('[id^="phase-"]');
      if (phase && !phase.classList.contains('hidden')) interacted.add(stepKey(currentPhaseIndex()));
    }, true);

    const successObserver = new MutationObserver(() => {
      const phase = currentPhaseIndex();
      if (phase === 0) return;
      const key = stepKey(phase);
      const wordsFound = phases[phase]?.querySelector('#words-found');
      const values = (wordsFound?.textContent || '').match(/\d+/g) || [];
      const completedWordExplorer = values.length >= 2 && Number(values[0]) > 0 && Number(values[0]) === Number(values[1]);
      if ((!interacted.has(key) && !completedWordExplorer) || completed.has(key) || !verifiedSuccess(phase)) return;
      completeVerifiedStep(phase);
    });
    phases.forEach(phase => successObserver.observe(phase, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'data-mawahib-completed']
    }));

    document.addEventListener('click', event => {
      const partButton = event.target.closest('.part-btn');
      if (!partButton) return;
      const buttons = [...document.querySelectorAll('.part-btn')];
      const targetPart = buttons.indexOf(partButton);
      const activePart = currentPartIndex();
      if (targetPart > activePart && !completed.has(stepKey(phases.length - 1, activePart))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showBlockedMessage();
      }
    }, true);
  }

  function initScreenLessonGuard() {
    const screens = [...document.querySelectorAll('[id^="screen-"]')]
      .filter(element => /^screen-\d+$/.test(element.id))
      .sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]));
    if (screens.length < 2 || typeof window.validateCurrentScreen !== 'function') return;
    const originalValidate = window.validateCurrentScreen;
    const originalGoNext = typeof window.goNext === 'function' ? window.goNext : null;
    const heard = new Set();
    let listeningCompleted = false;
    let validationInProgress = false;
    let delayedAdvanceAllowed = false;
    const lessonXp = createLessonXp(screens);
    const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
    const lessonFile = location.pathname.split('/').pop();
    const completionStorageId = 'mawahib_lesson_steps_' + (session?.username || 'local') + '_' + lessonFile;
    let completionState = { completed: [] };
    listeningCompleted = Boolean(lessonXp?.state.awards?.includes('screen:0'));
    try {
      completionState = { ...completionState, ...(JSON.parse(localStorage.getItem(completionStorageId) || 'null') || {}) };
    } catch (error) {}
    completionState.completed = Array.isArray(completionState.completed)
      ? [...new Set(completionState.completed.filter(key => /^\d+:\d+$/.test(key)))]
      : [];

    function screenPartIndex() {
      try {
        const value = window.eval(
          'typeof currentPart === "number" ? currentPart : ' +
          '(typeof currentQuarterIndex === "number" ? currentQuarterIndex : 0)'
        );
        return Number.isInteger(Number(value)) ? Number(value) : 0;
      } catch (error) {
        return 0;
      }
    }

    function saveScreenStep(screen = visibleScreen(), part = screenPartIndex()) {
      const key = part + ':' + screen;
      if (!completionState.completed.includes(key)) {
        completionState.completed.push(key);
        try { localStorage.setItem(completionStorageId, JSON.stringify(completionState)); } catch (error) {}
      }
      return key;
    }

    function visibleScreen() {
      const index = screens.findIndex(screen => !screen.classList.contains('hidden'));
      return index < 0 ? 0 : index;
    }

    function showMessage() {
      let toast = document.getElementById('mawahib-screen-lock-message');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mawahib-screen-lock-message';
        toast.style.cssText = 'position:fixed;left:50%;bottom:94px;z-index:220;transform:translateX(-50%);max-width:calc(100vw - 28px);padding:12px 18px;border-radius:14px;background:#7f1d1d;color:#fff;font-family:var(--platform-font-ui,Cairo),sans-serif;font-weight:900;text-align:center;box-shadow:0 14px 35px rgba(15,23,42,.25)';
        document.body.appendChild(toast);
      }
      toast.textContent = 'أكمل التمرين الحالي أولاً';
      toast.hidden = false;
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => { toast.hidden = true; }, 1900);
    }

    window.addEventListener(lessonAudioEvent, event => {
      if (visibleScreen() !== 0 || listeningCompleted || event.detail?.failed) return;
      const src = String(event.detail?.src || '');
      const audioCode = (src.match(/(\d{6})(?:\.mp3)?(?:\?|$)/) || [])[1] || src;
      if (!audioCode) return;
      let expectedCodes = [];
      try {
        if (window.MawahibSurahAudio?.currentCodes) expectedCodes = window.MawahibSurahAudio.currentCodes();
      } catch (error) {}
      const normalized = new Set((expectedCodes || []).map(String).filter(code => /^\d{6}$/.test(code)));
      if (normalized.size && !normalized.has(audioCode)) return;
      heard.add(audioCode);
      const expected = normalized.size || document.querySelectorAll('#audio-verses-box > *, #audio-list > *').length;
      if (expected > 0 && heard.size >= expected) {
        listeningCompleted = true;
        lessonXp?.award('screen:0');
        setTimeout(() => window.validateCurrentScreen(), 650);
      }
    });

    window.validateCurrentScreen = function guardedValidation() {
      if (visibleScreen() === 0 && !listeningCompleted) {
        return originalGoNext ? originalGoNext.call(this) : originalValidate.apply(this, arguments);
      }
      const screenBeforeValidation = visibleScreen();
      validationInProgress = true;
      try {
        const result = originalValidate.apply(this, arguments);
        const feedback = document.querySelector('#feedback-message, [id*="feedback"]');
        const showsSuccess = feedback && !feedback.classList.contains('hidden') && /green|emerald|success/.test(feedback.className);
        if (visibleScreen() === screenBeforeValidation && showsSuccess) delayedAdvanceAllowed = true;
        return result;
      } finally {
        validationInProgress = false;
      }
    };

    if (originalGoNext) {
      window.goNext = function guardedScreenAdvance() {
        if (!validationInProgress && !delayedAdvanceAllowed) {
          showMessage();
          return false;
        }
        delayedAdvanceAllowed = false;
        const screen = visibleScreen();
        const part = screenPartIndex();
        saveScreenStep(screen, part);
        lessonXp?.award(part + ':' + screen);
        return originalGoNext.apply(this, arguments);
      };
    }

    queueMicrotask(() => {
      const part = screenPartIndex();
      const completedScreens = completionState.completed
        .filter(key => key.startsWith(part + ':'))
        .map(key => Number(key.split(':')[1]))
        .filter(Number.isInteger);
      const resumeTarget = completedScreens.length ? Math.min(screens.length - 1, Math.max(...completedScreens) + 1) : 0;
      let safety = screens.length;
      while (originalGoNext && visibleScreen() < resumeTarget && safety-- > 0) {
        originalGoNext.call(window);
      }
    });
  }

  function currentAccountKey() {
    try {
      const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
      return session?.username ? String(session.username) : 'guest';
    } catch (error) {
      return 'guest';
    }
  }

  function scopedStorageKey(base) {
    const user = currentAccountKey();
    return user === 'guest' ? base : base + '_' + user;
  }

  function readTheme() {
    try {
      const scoped = localStorage.getItem(scopedStorageKey(storageKey));
      if (themes.includes(scoped)) return scoped;
      const legacy = localStorage.getItem(storageKey);
      return themes.includes(legacy) ? legacy : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function applyTheme(theme) {
    const nextTheme = themes.includes(theme) ? theme : fallback;
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(scopedStorageKey(storageKey), nextTheme);
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {}
    syncSurahTheme();
    window.dispatchEvent(new CustomEvent('mawahib:theme-change', { detail: { theme: nextTheme } }));
    return nextTheme;
  }

  function isSoundEnabled() {
    try {
      const value = localStorage.getItem(scopedStorageKey(soundKey));
      if (value === 'false') return false;
      if (value === 'true') return true;
      const legacy = localStorage.getItem(soundKey);
      return legacy !== 'false';
    } catch (error) {
      return true;
    }
  }

  function setSoundEnabled(enabled) {
    const next = enabled !== false;
    try {
      localStorage.setItem(scopedStorageKey(soundKey), next ? 'true' : 'false');
      localStorage.setItem(soundKey, next ? 'true' : 'false');
    } catch (error) {}
    window.dispatchEvent(new CustomEvent('mawahib:sound-change', { detail: { enabled: next } }));
    return next;
  }

  function normalizeDigits(text) {
    const map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
    return String(text).replace(/[٠-٩۰-۹]/g, d => map[d] || d);
  }

  function normalizeNodeDigits(root) {
    if (!root) return;
    const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skip.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /[٠-٩۰-۹]/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { node.nodeValue = normalizeDigits(node.nodeValue); });

    if (root.querySelectorAll) {
      root.querySelectorAll('[title], [aria-label], [placeholder]').forEach(el => {
        ['title', 'aria-label', 'placeholder'].forEach(attr => {
          const value = el.getAttribute(attr);
          if (value && /[٠-٩۰-۹]/.test(value)) el.setAttribute(attr, normalizeDigits(value));
        });
      });
    }
  }

  function initDigitNormalizer() {
    normalizeNodeDigits(document.body);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (/[٠-٩۰-۹]/.test(node.nodeValue)) node.nodeValue = normalizeDigits(node.nodeValue);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            normalizeNodeDigits(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function initScrollAnimations() {
    let lastY = window.scrollY || 0;
    document.documentElement.dataset.scrollDir = 'down';
    window.addEventListener('scroll', () => {
      const y = window.scrollY || 0;
      document.documentElement.dataset.scrollDir = y >= lastY ? 'down' : 'up';
      lastY = y;
    }, { passive: true });

    const selector = [
      'main > section', '.card', '.dashboard-section', '.profile-card', '.parent-card', '.quiz-card',
      '.lesson-card', '.surah-card', '.station-card', '.juz-section', '.daily-tile',
      '.top-row', '.feed-item', '.alert-card'
    ].join(',');

    const apply = () => {
      document.querySelectorAll(selector).forEach((el, index) => {
        if (!el.classList.contains('mawahib-reveal')) {
          el.classList.add('mawahib-reveal');
          el.classList.add(['reveal-from-bottom', 'reveal-from-left', 'reveal-from-right', 'reveal-from-top'][index % 4]);
          el.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 45}ms`);
        }
      });
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -8% 0px' });

    apply();
    document.querySelectorAll('.mawahib-reveal').forEach(el => {
      el.dataset.revealBound = 'true';
      observer.observe(el);
    });

    let mutationFrame = null;
    const mutationObserver = new MutationObserver(() => {
      if (mutationFrame) return;
      mutationFrame = requestAnimationFrame(() => {
        mutationFrame = null;
        apply();
        document.querySelectorAll('.mawahib-reveal:not([data-reveal-bound])').forEach(el => {
          el.dataset.revealBound = 'true';
          observer.observe(el);
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function isStaffSensoryContext() {
    const path = String(location.pathname || '').toLowerCase();
    if (/(admin|controle-|dashboard_prof|prof-)/.test(path) || /(^|-)admin/.test(path)) return true;
    const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
    return session && (session.role === 'prof' || session.role === 'admin');
  }

  function initStaffQuietMode() {
    if (!isStaffSensoryContext() || document.getElementById('mawahib-staff-quiet-style')) return;
    document.documentElement.classList.add('mawahib-staff-quiet-mode');
    const style = document.createElement('style');
    style.id = 'mawahib-staff-quiet-style';
    style.textContent = [
      'html.mawahib-staff-quiet-mode *,html.mawahib-staff-quiet-mode *::before,html.mawahib-staff-quiet-mode *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
      'html.mawahib-staff-quiet-mode .mawahib-reveal{opacity:1!important;transform:none!important}',
      'html.mawahib-staff-quiet-mode body.mawahib-platform-strobe::after{display:none!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function initPlatformSensory() {
    if (window.__mawahibPlatformSensory || !document.body) return;
    if (isStaffSensoryContext()) {
      window.__mawahibPlatformSensory = 'staff-disabled';
      document.documentElement.classList.add('mawahib-staff-sensory-off');
      document.body.classList.remove('mawahib-platform-strobe');
      return;
    }
    window.__mawahibPlatformSensory = true;

    const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const lowPowerDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    const maxSparks = lowPowerDevice ? 5 : 14;
    if (lowPowerDevice) document.documentElement.classList.add('mawahib-low-power');
    let audioContext = null;

    const style = document.createElement('style');
    style.id = 'mawahib-platform-sensory-style';
    style.textContent = [
      '.mawahib-sensory-hit{animation:mawahibSensoryHit .46s cubic-bezier(.2,.8,.2,1)}',
      '.mawahib-sensory-spark{position:fixed;z-index:240;width:10px;height:10px;border-radius:999px;pointer-events:none;background:radial-gradient(circle,#fff 0 24%,var(--spark-color,#22c55e) 36% 100%);box-shadow:0 0 14px var(--spark-color,#22c55e),0 0 28px rgba(255,255,255,.55);animation:mawahibSensorySpark .78s ease-out forwards}',
      '.mawahib-click-ring{position:fixed;z-index:241;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid color-mix(in srgb,var(--platform-accent,#f59e0b) 76%,#fff);border-radius:50%;pointer-events:none;box-shadow:0 0 18px color-mix(in srgb,var(--platform-primary,#16a34a) 58%,transparent);animation:mawahibClickRing .5s cubic-bezier(.16,1,.3,1) forwards}',
      '.mawahib-ambient-focus{animation:mawahibAmbientFocus 6s ease-in-out infinite}',
      'html.mawahib-low-power .mawahib-ambient-focus{animation:none}',
      'body.mawahib-platform-strobe::after{content:"";position:fixed;inset:0;z-index:235;pointer-events:none;background:radial-gradient(circle at 30% 25%,rgba(250,204,21,.2),transparent 28%),radial-gradient(circle at 78% 70%,rgba(59,130,246,.16),transparent 30%);mix-blend-mode:screen;animation:mawahibPlatformStrobe 1.15s ease-out forwards}',
      '@keyframes mawahibSensoryHit{0%,100%{filter:brightness(1) saturate(1);transform:scale(1)}42%{filter:brightness(1.16) saturate(1.22);transform:scale(.975);box-shadow:0 0 0 6px rgba(34,197,94,.12),0 0 20px rgba(250,204,21,.18)}}',
      '@keyframes mawahibClickRing{0%{opacity:.9;transform:scale(.35)}100%{opacity:0;transform:scale(4.4)}}',
      '@keyframes mawahibAmbientFocus{0%,78%,100%{filter:brightness(1);box-shadow:var(--platform-shadow-soft)}86%{filter:brightness(1.08);box-shadow:0 0 0 5px color-mix(in srgb,var(--platform-accent,#f59e0b) 14%,transparent),0 12px 30px color-mix(in srgb,var(--platform-primary,#16a34a) 18%,transparent)}92%{filter:brightness(1.02)}}',
      '@keyframes mawahibSensorySpark{0%{opacity:1;transform:translate(0,0) scale(.45)}72%{opacity:.95}100%{opacity:0;transform:translate(var(--spark-x),var(--spark-y)) scale(1.65)}}',
      '@keyframes mawahibPlatformStrobe{0%,100%{opacity:0}24%{opacity:.48}48%{opacity:.12}68%{opacity:.34}84%{opacity:.08}}',
      '.mawahib-surah-burst{position:fixed;inset:0;z-index:238;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.9),transparent 12%),conic-gradient(from 0deg,rgba(34,197,94,.2),rgba(250,204,21,.24),rgba(59,130,246,.2),rgba(236,72,153,.18),rgba(34,197,94,.2));mix-blend-mode:screen;animation:mawahibSurahBurst 1.35s cubic-bezier(.16,1,.3,1) forwards}',
      '.mawahib-juz-burst{position:fixed;inset:0;z-index:242;pointer-events:none;display:grid;place-items:center;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.96),transparent 9%),conic-gradient(from 0deg,#ff174488,#ffea0088,#00e67688,#00b0ff88,#d500f988,#ff174488);mix-blend-mode:screen;animation:mawahibJuzBurst 2.7s ease-out forwards}',
      '.mawahib-juz-reward{position:relative;padding:22px 30px;border:3px solid #fff;border-radius:18px;background:rgba(15,23,42,.9);color:#fff;text-align:center;font:1000 24px var(--platform-font-ui,Cairo),sans-serif;line-height:1.5;box-shadow:0 0 34px #fff,0 0 70px #facc15;mix-blend-mode:normal;animation:mawahibJuzReward 2.7s cubic-bezier(.16,1,.3,1) forwards}',
      '.mawahib-juz-reward strong{display:block;color:#fde047;font-size:44px}',
      '@keyframes mawahibJuzBurst{0%{opacity:0;filter:hue-rotate(0deg) brightness(1.2)}12%{opacity:1}25%{filter:hue-rotate(80deg) brightness(1.8)}40%{filter:hue-rotate(160deg) brightness(1.25)}55%{filter:hue-rotate(240deg) brightness(1.8)}72%{filter:hue-rotate(320deg) brightness(1.35)}100%{opacity:0;filter:hue-rotate(420deg) brightness(1.6)}}',
      '@keyframes mawahibJuzReward{0%{opacity:0;transform:scale(.35) rotate(-5deg)}18%{opacity:1;transform:scale(1.12) rotate(2deg)}38%{transform:scale(.98) rotate(-1deg)}75%{opacity:1;transform:scale(1.04)}100%{opacity:0;transform:scale(1.25)}}',
      '@keyframes mawahibSurahBurst{0%{opacity:0;transform:scale(.8) rotate(0deg)}18%{opacity:.95}55%{opacity:.72;transform:scale(1.06) rotate(18deg)}100%{opacity:0;transform:scale(1.18) rotate(34deg)}}',
      '@media (prefers-reduced-motion: reduce){.mawahib-sensory-hit,.mawahib-click-ring,.mawahib-ambient-focus,body.mawahib-platform-strobe::after,.mawahib-sensory-spark,.mawahib-surah-burst,.mawahib-juz-burst,.mawahib-juz-reward{animation:none!important}.mawahib-click-ring,.mawahib-sensory-spark,.mawahib-surah-burst,.mawahib-juz-burst{display:none!important}}'
    ].join('\\n');
    document.head.appendChild(style);
    if (!motionQuery.matches && !lowPowerDevice) {
      [...document.querySelectorAll('.btn-primary,.juz-game-button,.reward-rank-button,[data-primary-action]')]
        .slice(0, 6)
        .forEach(element => element.classList.add('mawahib-ambient-focus'));
    }

    function isTextInput(element) {
      if (!element) return false;
      const tag = element.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
    }

    function findSensoryTarget(start) {
      if (!start || isTextInput(start)) return null;
      return start.closest('button,a,[role="button"],.surah-card,.lesson-card,.choice,.part-btn,.verse-card,.station-card,.theme-choice,.reward-rank-button,.juz-game-button,.settings-action');
    }

    function kindFor(target) {
      const text = ((target.textContent || '') + ' ' + (target.className || '')).toLowerCase();
      if (/wrong|error|rose|red|خطأ|حاول/.test(text)) return 'error';
      if (/correct|success|complete|done|emerald|green|تحقق|إنهاء|متابعة|ممتاز|رائع/.test(text)) return 'success';
      if (target.matches && target.matches('a,.nav-bottom a,.prof-nav a,.admin-nav a')) return 'nav';
      return 'tap';
    }

    function vibrate(kind) {
      if (!navigator.vibrate) return;
      const patterns = {
        tap: lowPowerDevice ? 12 : [18, 16, 18],
        nav: lowPowerDevice ? 10 : [14, 14, 20],
        success: lowPowerDevice ? [28, 22, 40] : [45, 30, 65, 38, 90],
        error: lowPowerDevice ? [28, 24, 28] : [42, 30, 42, 30, 58]
      };
      navigator.vibrate(patterns[kind] || patterns.tap);
    }

    function lights(target, kind) {
      if (motionQuery.matches || !target) return;
      target.classList.remove('mawahib-sensory-hit');
      void target.offsetWidth;
      target.classList.add('mawahib-sensory-hit');
      setTimeout(() => target.classList.remove('mawahib-sensory-hit'), 780);
      if (kind === 'success' && !lowPowerDevice) {
        document.body.classList.remove('mawahib-platform-strobe');
        void document.body.offsetWidth;
        document.body.classList.add('mawahib-platform-strobe');
        setTimeout(() => document.body.classList.remove('mawahib-platform-strobe'), 950);
      }
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const color = kind === 'error' ? '#ef4444' : kind === 'nav' ? '#3b82f6' : kind === 'success' ? '#22c55e' : '#f59e0b';
      const count = kind === 'success' ? maxSparks : Math.max(3, Math.floor(maxSparks * 0.65));
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('span');
        const angle = Math.PI * 2 * (i / count) + Math.random() * 0.35;
        const distance = 28 + Math.random() * (kind === 'success' ? 66 : 38);
        spark.className = 'mawahib-sensory-spark';
        spark.style.left = centerX + (Math.random() * 18 - 9) + 'px';
        spark.style.top = centerY + (Math.random() * 18 - 9) + 'px';
        spark.style.setProperty('--spark-color', color);
        spark.style.setProperty('--spark-x', Math.cos(angle) * distance + 'px');
        spark.style.setProperty('--spark-y', Math.sin(angle) * distance + 'px');
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 850);
      }
    }

    function clickRing(event) {
      if (motionQuery.matches || lowPowerDevice) return;
      const ring = document.createElement('span');
      ring.className = 'mawahib-click-ring';
      ring.style.left = event.clientX + 'px';
      ring.style.top = event.clientY + 'px';
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 550);
    }

    function modernSound(kind) {
      try {
        if (!isSoundEnabled()) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContext = audioContext || new AudioCtx();
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        const ctx = audioContext;
        const now = ctx.currentTime;
        const profiles = {
          tap: { tones: [540, 810], volume: lowPowerDevice ? 0.024 : 0.038, duration: 0.052, noise: 0.018 },
          nav: { tones: [420, 630, 840], volume: lowPowerDevice ? 0.02 : 0.034, duration: 0.055, noise: 0.014 },
          success: { tones: [620, 780, 980, 1240], volume: lowPowerDevice ? 0.028 : 0.052, duration: 0.074, noise: 0.02 },
          exercise: { tones: [520, 740, 980, 1320], volume: lowPowerDevice ? 0.034 : 0.058, duration: 0.086, noise: 0.018 },
          surah: { tones: [392, 588, 784, 988, 1318, 1760], volume: lowPowerDevice ? 0.038 : 0.068, duration: 0.105, noise: 0.024 },
          juz: { tones: [196, 294, 392, 523, 659, 784, 1046, 1318, 1568, 2093], volume: lowPowerDevice ? 0.042 : 0.078, duration: 0.13, noise: 0.032 },
          error: { tones: [260, 190, 240], volume: lowPowerDevice ? 0.026 : 0.044, duration: 0.065, noise: 0.028 }
        };
        const profile = profiles[kind] || profiles.tap;
        const master = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = kind === 'error' ? 'lowpass' : 'highpass';
        filter.frequency.value = kind === 'error' ? 900 : 480;
        master.gain.value = 0.68;
        filter.connect(master).connect(ctx.destination);
        profile.tones.forEach((tone, index) => {
          const start = now + index * 0.048;
          const osc = ctx.createOscillator();
          const shimmer = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = kind === 'error' ? 'triangle' : (/surah|juz/.test(kind) ? 'sine' : 'triangle');
          shimmer.type = 'triangle';
          osc.frequency.setValueAtTime(tone, start);
          shimmer.frequency.setValueAtTime(tone * (kind === 'error' ? 0.52 : 1.51), start);
          if (kind !== 'error') osc.frequency.exponentialRampToValueAtTime(tone * (/surah|juz/.test(kind) ? 1.32 : 1.18), start + profile.duration);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(profile.volume, start + 0.009);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
          osc.connect(gain);
          shimmer.connect(gain);
          gain.connect(filter);
          osc.start(start);
          shimmer.start(start);
          osc.stop(start + profile.duration + 0.02);
          shimmer.stop(start + profile.duration + 0.02);
        });
        const length = Math.max(1, Math.floor(ctx.sampleRate * 0.075));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
        const noise = ctx.createBufferSource();
        const noiseFilter = ctx.createBiquadFilter();
        const noiseGain = ctx.createGain();
        noise.buffer = buffer;
        noiseFilter.type = kind === 'error' ? 'bandpass' : 'highpass';
        noiseFilter.frequency.value = kind === 'error' ? 320 : 2600;
        noiseFilter.Q.value = kind === 'error' ? 4 : 0.9;
        noiseGain.gain.setValueAtTime(profile.noise, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.072);
        noise.connect(noiseFilter).connect(noiseGain).connect(master);
        noise.start(now);
        noise.stop(now + 0.075);
      } catch (error) {}
    }

    function surahBurst() {
      if (motionQuery.matches) return;
      const burst = document.createElement('div');
      burst.className = 'mawahib-surah-burst';
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 1450);
      lights(document.body, 'success');
      if (!lowPowerDevice && typeof window.confetti === 'function') {
        window.confetti({ particleCount: 95, spread: 92, origin: { y: 0.62 }, scalar: 1.05 });
        setTimeout(() => window.confetti({ particleCount: 55, angle: 60, spread: 72, origin: { x: 0, y: 0.72 }, scalar: 0.9 }), 170);
        setTimeout(() => window.confetti({ particleCount: 55, angle: 120, spread: 72, origin: { x: 1, y: 0.72 }, scalar: 0.9 }), 170);
      }
    }

    function juzBurst(detail) {
      const points = Number(detail?.points || 20);
      if (!motionQuery.matches) {
        const burst = document.createElement('div');
        burst.className = 'mawahib-juz-burst';
        burst.innerHTML = '<div class="mawahib-juz-reward"><strong>+' + points + ' ★</strong>مبروك! تم فتح الجزء التالي</div>';
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), lowPowerDevice ? 1900 : 2850);
      }
      if (!motionQuery.matches && typeof window.confetti === 'function') {
        const particleCount = lowPowerDevice ? 55 : 150;
        window.confetti({ particleCount, spread: lowPowerDevice ? 78 : 125, startVelocity: lowPowerDevice ? 32 : 52, origin: { y: .58 }, scalar: lowPowerDevice ? .85 : 1.1 });
        if (!lowPowerDevice && !motionQuery.matches) {
          setTimeout(() => window.confetti({ particleCount: 90, angle: 58, spread: 95, origin: { x: 0, y: .72 }, scalar: 1.05 }), 320);
          setTimeout(() => window.confetti({ particleCount: 90, angle: 122, spread: 95, origin: { x: 1, y: .72 }, scalar: 1.05 }), 320);
          setTimeout(() => window.confetti({ particleCount: 120, spread: 150, origin: { y: .35 }, scalar: .95 }), 760);
        }
      }
    }

    let lastExerciseSound = '';
    let lastExerciseSoundAt = 0;
    window.addEventListener('mawahib:activity-recorded', event => {
      const detail = event.detail || {};
      if (Number(detail.score || 0) < 70) return;
      const key = [detail.surahId, detail.activityKey, detail.score].join(':');
      const now = Date.now();
      if (key === lastExerciseSound && now - lastExerciseSoundAt < 1800) return;
      lastExerciseSound = key;
      lastExerciseSoundAt = now;
      vibrate('success');
      lights(document.querySelector('main') || document.body, 'success');
      modernSound('exercise');
    });

    window.addEventListener('mawahib:surah-completed', () => {
      vibrate('success');
      surahBurst();
      modernSound('surah');
    });

    window.addEventListener('mawahib:juz-completed', event => {
      if (navigator.vibrate) navigator.vibrate(lowPowerDevice ? [90,55,120,60,160] : [180,55,220,55,280,70,340,80,460]);
      juzBurst(event.detail || {});
      modernSound('juz');
    });

    document.addEventListener('click', event => {
      const target = findSensoryTarget(event.target);
      if (!target || target.closest('[data-no-sensory]')) return;
      const kind = kindFor(target);
      clickRing(event);
      vibrate(kind);
      lights(target, kind);
      modernSound(kind);
    }, true);
  }

  function initNavAutoHide() {
    let lastY = window.scrollY || 0;
    let revealTimer = null;

    window.addEventListener('scroll', () => {
      const y = window.scrollY || 0;
      const navs = Array.from(document.querySelectorAll('.nav-bottom, .prof-nav, .admin-nav, .admin-simple-nav'));
      if (!navs.length) { lastY = y; return; }
      const delta = Math.abs(y - lastY);
      if (delta < 10) return;

      const scrollingDown = y > lastY;
      const nearTop = y < 80;
      navs.forEach(nav => nav.classList.toggle('nav-scroll-hidden', scrollingDown && !nearTop));
      lastY = y;

      clearTimeout(revealTimer);
    }, { passive: true });
  }

  function syncSurahTheme() {
    const isSurahPage = /(^|\/)surah-|Al_|al_kadr|quraysh|fil|bayina/.test(location.pathname);
    if (!isSurahPage) return;
    document.documentElement.style.setProperty('--surah', 'var(--platform-primary)');
    let style = document.getElementById('mawahib-surah-theme-sync');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mawahib-surah-theme-sync';
      style.textContent = [
        'header[style*="background"],',
        '#xp-bar[style*="background"],',
        'button[style*="background"],',
        '.choice.selected,',
        '.part-btn.active {',
        '  background: linear-gradient(135deg, var(--platform-primary), var(--platform-primary-dark)) !important;',
        '  color: #fff !important;',
        '  border-color: var(--platform-primary) !important;',
        '}',
        '.tab-active {',
        '  border-color: var(--platform-primary) !important;',
        '  color: var(--platform-primary) !important;',
        '  background: color-mix(in srgb, var(--platform-surface) 88%, #ffffff) !important;',
        '  box-shadow: 0 10px 24px color-mix(in srgb, var(--platform-primary) 18%, transparent) !important;',
        '}',
        '.verse-card:hover, .choice.selected, .part-btn.active { border-color: var(--platform-primary) !important; }',
        '.app-shell {',
        '  background: linear-gradient(180deg, color-mix(in srgb, var(--platform-surface) 92%, #ffffff), color-mix(in srgb, var(--platform-primary-soft) 38%, #ffffff)) !important;',
        '  border-color: color-mix(in srgb, var(--platform-primary) 22%, transparent) !important;',
        '}',
        'body { background: color-mix(in srgb, var(--platform-primary-soft) 24%, #f8fafc) !important; }',
        'main { border-radius: 18px !important; border-color: color-mix(in srgb, var(--platform-primary) 18%, #e2e8f0) !important; box-shadow: 0 12px 32px rgba(15,23,42,.08) !important; }',
        'button, a[class*="rounded"] { border-radius: 12px !important; }',
        '[id^="tab-"] { min-height: 48px; display:flex; align-items:center; justify-content:center; }',
        '.mawahib-unified-xp { width:min(calc(100% - 24px),64rem); margin:12px auto; padding:12px 16px; border:1px solid color-mix(in srgb,var(--platform-primary) 20%,#e2e8f0); border-radius:14px; background:#fff; box-shadow:0 8px 24px rgba(15,23,42,.06); }',
        '.mawahib-unified-xp>div:first-child { display:flex; align-items:center; justify-content:space-between; gap:12px; color:var(--platform-primary-dark); font-weight:900; }',
        '.mawahib-unified-xp-track { height:7px; margin-top:8px; overflow:hidden; border-radius:999px; background:#e2e8f0; }',
        '.mawahib-unified-xp-track>span { display:block; height:100%; width:0; border-radius:inherit; background:linear-gradient(90deg,var(--platform-primary),var(--platform-primary-dark)); transition:width .35s ease; }',
        '@media(max-width:640px){main{border-radius:14px !important}.mawahib-unified-xp{width:calc(100% - 16px);margin:8px auto;padding:10px 12px}}'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  function initInclusiveArabic() {
    const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;
    if (!session || !['student', 'prof'].includes(session.role) || window.__mawahibInclusiveArabic) return;
    window.__mawahibInclusiveArabic = true;
    const replacements = [
      ['الطلاب', 'الطلاب(ات)'], ['الأساتذة', 'الأساتذة(ات)'], ['المعلمون', 'المعلمون(ات)'], ['المعلمين', 'المعلمين(ات)'],
      ['الطالب', 'الطالب(ة)'], ['الأستاذ', 'الأستاذ(ة)'], ['المعلم', 'المعلم(ة)'],
      ['اختر', 'اختر(ي)'], ['اضغط', 'اضغط(ي)'], ['أكمل', 'أكمل(ي)'], ['ابدأ', 'ابدأ(ي)'],
      ['استمع', 'استمع(ي)'], ['راجع', 'راجع(ي)'], ['حاول', 'حاول(ي)'], ['اكتب', 'اكتب(ي)'],
      ['أرسل', 'أرسل(ي)'], ['سجل', 'سجل(ي)'], ['حدد', 'حدد(ي)'], ['اسحب', 'اسحب(ي)'],
      ['رتب', 'رتب(ي)'], ['ضع', 'ضع(ي)'], ['انتقل', 'انتقل(ي)'], ['أعد', 'أعد(ي)'],
      ['صحح', 'صحح(ي)'], ['كرر', 'كرر(ي)'], ['واصل', 'واصل(ي)'], ['احفظ', 'احفظ(ي)'],
      ['تعلم', 'تعلم(ي)'], ['تأكد', 'تأكد(ي)'], ['اقرأ', 'اقرأ(ي)']
    ];
    const quranSelector = '.quran-font,.quran-text,.ayah,.verse,[data-ayah],[data-verse],[class*="ayah"],[class*="verse"],[id*="ayah"],[id*="verse"],audio';
    const uiSelector = 'button,label,a,h1,h2,h3,h4,h5,h6,p,span,option,[role="alert"],[role="status"],.instruction,.feedback,.small-muted';
    function adapt(value) {
      let output = String(value || '');
      replacements.forEach(([masculine, inclusive]) => {
        output = output.replace(new RegExp(masculine + '(?![\\u0600-\\u06FF]|\\(ي\\)|\\(ة\\)|\\(ات\\))', 'g'), inclusive);
      });
      return output;
    }
    function isInterfaceNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(quranSelector) || !parent.closest(uiSelector)) return false;
      const text = (node.nodeValue || '').trim();
      return text.length > 0 && text.length <= 220;
    }
    function process(root) {
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) if (isInterfaceNode(walker.currentNode)) nodes.push(walker.currentNode);
      nodes.forEach(node => { const next = adapt(node.nodeValue); if (next !== node.nodeValue) node.nodeValue = next; });
      const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('input,textarea,button,a,[title],[aria-label]')] : [];
      elements.forEach(element => {
        if (element.closest(quranSelector)) return;
        ['placeholder', 'title', 'aria-label'].forEach(attribute => {
          if (!element.hasAttribute(attribute)) return;
          const value = element.getAttribute(attribute);
          const next = adapt(value);
          if (next !== value) element.setAttribute(attribute, next);
        });
      });
    }
    document.title = adapt(document.title);
    process(document.body);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) process(node);
        else if (node.nodeType === 3 && isInterfaceNode(node)) {
          const next = adapt(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        }
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function initEnhancements() {
    if (!document.body) return;
    applyTheme(readTheme());
    initInclusiveArabic();
    syncSurahTheme();
    initDigitNormalizer();
    initStaffQuietMode();
    initNavAutoHide();
    initPlatformSensory();
    initLessonGuard();
    initScreenLessonGuard();
    window.addEventListener('mawahib:surah-completed', () => {
      if (window.__mawahibLessonXp) window.__mawahibLessonXp.finish();
    });
    if (!isStaffSensoryContext() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) initScrollAnimations();
  }

  window.PlatformTheme = {
    themes,
    get: readTheme,
    set: applyTheme,
    apply: applyTheme,
    normalizeDigits,
    isSoundEnabled,
    setSoundEnabled
  };

  instrumentLessonAudio();
  applyTheme(readTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements, { once: true });
  } else {
    initEnhancements();
  }
})();

