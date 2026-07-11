(function () {
  const storageKey = 'mawahib_theme';
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
    (lessonXp?.state.awards || []).forEach(key => {
      if (/^\d+:\d+$/.test(key)) {
        completed.add(key);
        awarded.add(key);
      }
    });

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

    function showBlockedMessage() {
      let toast = document.getElementById('mawahib-lesson-lock-message');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mawahib-lesson-lock-message';
        toast.setAttribute('role', 'status');
        toast.style.cssText = 'position:fixed;left:50%;bottom:94px;z-index:220;transform:translate(-50%,18px);max-width:calc(100vw - 28px);padding:12px 18px;border-radius:14px;background:#7f1d1d;color:#fff;font-family:var(--platform-font-ui,Cairo),sans-serif;font-weight:900;text-align:center;box-shadow:0 14px 35px rgba(15,23,42,.25);opacity:0;transition:.2s ease;pointer-events:none';
        document.body.appendChild(toast);
      }
      toast.textContent = 'أكمل التمرين الحالي أولاً';
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
        if (!completed.has(stepKey(phase, part))) return false;
      }
      return true;
    }

    function visibleSuccess(phase) {
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

    window.addEventListener(lessonAudioEvent, event => {
      if (currentPhaseIndex() !== 0) return;
      const src = String(event.detail?.src || '');
      const audioCode = (src.match(/(\d{6})(?:\.mp3)?(?:\?|$)/) || [])[1] || src;
      const part = currentPartIndex();
      const key = String(part);
      const heard = listened.get(key) || new Set();
      heard.add(audioCode);
      listened.set(key, heard);
      const expected = document.querySelectorAll('#audio-list > *').length;
      if (expected > 0 && heard.size >= expected) completeListening();
    });

    window.goToPhase = function guardedGoToPhase(target) {
      const phase = Number(target);
      const current = currentPhaseIndex();
      if (phase === current + 1 && current > 0 && visibleSuccess(phases[current])) {
        const key = stepKey(current);
        completed.add(key);
        lessonXp?.award(key);
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
      return originalGoToPhase.apply(this, arguments);
    };

    if (originalUpdateStats) {
      window.updateStats = function guardedUpdateStats(delta = 0, ok = true) {
        const phase = currentPhaseIndex();
        const key = stepKey(phase);
        if (Number(delta) <= 0) return originalUpdateStats.call(this, delta, ok);
        if (phase === 0 || awarded.has(key)) {
          if (phase === 2 && /100\s*%/.test(document.getElementById('fill-feedback')?.textContent || '')) {
            completed.add(key);
            lessonXp?.award(key);
          }
          return originalUpdateStats.call(this, 0, ok);
        }
        if (phase === 2) {
          awarded.add(key);
          if (/100\s*%/.test(document.getElementById('fill-feedback')?.textContent || '')) {
            completed.add(key);
            lessonXp?.award(key);
          }
          return originalUpdateStats.call(this, delta, ok);
        }
        completed.add(key);
        awarded.add(key);
        const result = originalUpdateStats.call(this, phase === phases.length - 1 ? 100 : delta, ok);
        lessonXp?.award(key);
        return result;
      };
    }

    if (originalFinishMission) {
      window.finishMission = function guardedFinishMission() {
        if (!completed.has(stepKey(phases.length - 1))) {
          showBlockedMessage();
          return false;
        }
        return originalFinishMission.apply(this, arguments);
      };
    }

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
    const lessonXp = createLessonXp(screens);
    listeningCompleted = Boolean(lessonXp?.state.awards?.includes('screen:0'));

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
      if (visibleScreen() !== 0 || listeningCompleted) return;
      const src = String(event.detail?.src || '');
      heard.add((src.match(/(\d{6})(?:\.mp3)?(?:\?|$)/) || [])[1] || src);
      const expected = document.querySelectorAll('#audio-verses-box > *, #audio-list > *').length;
      if (expected > 0 && heard.size >= expected) {
        listeningCompleted = true;
        lessonXp?.award('screen:0');
        setTimeout(() => window.validateCurrentScreen(), 650);
      }
    });

    window.validateCurrentScreen = function guardedValidation() {
      if (visibleScreen() === 0 && !listeningCompleted) {
        showMessage();
        return false;
      }
      return originalValidate.apply(this, arguments);
    };

    if (originalGoNext) {
      window.goNext = function guardedScreenAdvance() {
        lessonXp?.award('screen:' + visibleScreen());
        return originalGoNext.apply(this, arguments);
      };
    }
  }

  function readTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      return themes.includes(stored) ? stored : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function applyTheme(theme) {
    const nextTheme = themes.includes(theme) ? theme : fallback;
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {}
    syncSurahTheme();
    window.dispatchEvent(new CustomEvent('mawahib:theme-change', { detail: { theme: nextTheme } }));
    return nextTheme;
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

  function initNavAutoHide() {
    const nav = document.querySelector('.nav-bottom');
    if (!nav) return;
    let lastY = window.scrollY || 0;
    let revealTimer = null;

    window.addEventListener('scroll', () => {
      const y = window.scrollY || 0;
      const delta = Math.abs(y - lastY);
      if (delta < 10) return;

      const scrollingDown = y > lastY;
      const nearTop = y < 80;
      nav.classList.toggle('nav-scroll-hidden', scrollingDown && !nearTop);
      lastY = y;

      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        nav.classList.remove('nav-scroll-hidden');
      }, 520);
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

  function initEnhancements() {
    if (!document.body) return;
    syncSurahTheme();
    initDigitNormalizer();
    initNavAutoHide();
    initLessonGuard();
    initScreenLessonGuard();
    window.addEventListener('mawahib:surah-completed', () => {
      if (window.__mawahibLessonXp) window.__mawahibLessonXp.finish();
    });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) initScrollAnimations();
  }

  window.PlatformTheme = {
    themes,
    get: readTheme,
    set: applyTheme,
    apply: applyTheme,
    normalizeDigits
  };

  instrumentLessonAudio();
  applyTheme(readTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements, { once: true });
  } else {
    initEnhancements();
  }
})();
