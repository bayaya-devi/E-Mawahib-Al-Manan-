(function () {
  const storageKey = 'mawahib_theme';
  const fallback = 'traditional';
  const themes = ['traditional', 'emerald', 'indigo', 'rose', 'amber'];

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

  function initMascotGuide() {
    if (document.getElementById('mawahib-mascot')) return;
    const session = window.Auth && Auth.getSession ? Auth.getSession() : null;
    if (session && session.role && session.role !== 'student') return;

    const path = location.pathname.split('/').pop() || 'dashboard.html';
    const isDashboard = path === 'dashboard.html' || path === '';
    const isSurah = /^(surah-|Al_|al_kadr|quraysh|fil|bayina|qaria)/.test(path);
    const isCelebration = path === 'celebration.html';
    const isInactivity = path === 'inactivity.html';
    if (!isDashboard && !isSurah && !isCelebration && !isInactivity) return;
    const isSmallScreen = window.matchMedia('(max-width: 640px)').matches;
    const lowPowerDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    const performanceMode = isSmallScreen || lowPowerDevice;

    injectMascotStyles();
    const mascot = document.createElement('div');
    mascot.id = 'mawahib-mascot';
    mascot.className = 'mawahib-mascot';
    mascot.dir = 'rtl';
    mascot.innerHTML = [
      '<div class="mascot-thought" id="mascot-thought"></div>',
      '<div class="mascot-stage"><img src="assets/mascot.png" alt="رفيق مواهب المنان" loading="lazy" decoding="async"></div>',
      '<div class="mascot-z">Zz</div>'
    ].join('');
    document.body.appendChild(mascot);

    const setMessage = (text, state = 'point') => {
      if (mascot.dataset.state !== state) mascot.dataset.state = state;
      const bubble = document.getElementById('mascot-thought');
      if (bubble && bubble.textContent !== text) bubble.textContent = text;
    };

    const hideTemporarily = (duration = 760) => {
      mascot.classList.add('is-hidden');
      window.clearTimeout(mascot._hideTimer);
      mascot._hideTimer = window.setTimeout(() => mascot.classList.remove('is-hidden'), duration);
    };

    const placeNear = (target, fallback = 'bottom') => {
      if (performanceMode) {
        if (mascot.dataset.place !== fallback) mascot.dataset.place = fallback;
        mascot.style.removeProperty('--mascot-x');
        mascot.style.removeProperty('--mascot-y');
        return;
      }
      if (!target) {
        if (mascot.dataset.place !== fallback) mascot.dataset.place = fallback;
        mascot.style.removeProperty('--mascot-x');
        mascot.style.removeProperty('--mascot-y');
        return;
      }
      const rect = target.getBoundingClientRect();
      const width = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
      const x = Math.max(10, Math.min(width - 136, rect.left + rect.width / 2 - 68));
      const y = Math.max(76, Math.min(window.innerHeight - 176, rect.top + rect.height / 2 - 76));
      const nextX = `${Math.round(x)}px`;
      const nextY = `${Math.round(y)}px`;
      if (mascot.dataset.place !== 'target') mascot.dataset.place = 'target';
      if (mascot.style.getPropertyValue('--mascot-x') !== nextX) mascot.style.setProperty('--mascot-x', nextX);
      if (mascot.style.getPropertyValue('--mascot-y') !== nextY) mascot.style.setProperty('--mascot-y', nextY);
    };

    const updateDashboard = () => {
      const current = document.querySelector('[data-journey-focus="current"]');
      const last = document.querySelector('[data-journey-focus="last-completed"]');
      const rewardStars = Number(document.getElementById('reward-stars')?.textContent || 0);
      const target = current || last;
      if (current) {
        setMessage('هذه هي التالية.', 'point');
        placeNear(current);
      } else if (last) {
        setMessage('أحسنت، أكمل بثبات.', 'happy');
        placeNear(last);
      } else if (rewardStars === 0) {
        setMessage('نبدأ بخطوة صغيرة.', 'point');
        placeNear(document.getElementById('section-available'));
      } else {
        setMessage('تابع المسار بهدوء.', 'point');
        placeNear(target);
      }
    };

    const updateSurah = () => {
      const activePhase = document.querySelector('[id^="phase-"]:not(.hidden)');
      const selected = document.querySelector('.choice.selected, .correct, .wrong, .tab-active, .part-btn.active');
      const target = selected || activePhase || document.querySelector('main');
      const wrong = document.querySelector('.wrong, [id$="-feedback"]:not(.hidden).bg-rose-50, [id$="-feedback"]:not(.hidden).bg-red-100, [id$="-feedback"]:not(.hidden).text-rose-700');
      const success = document.querySelector('.correct, [id$="-feedback"]:not(.hidden).bg-emerald-50, [id$="-feedback"]:not(.hidden).bg-emerald-100, [id$="-feedback"]:not(.hidden).bg-green-100, [id$="-feedback"]:not(.hidden).text-green-700');
      if (wrong) setMessage('راجع بهدوء.', 'sad');
      else if (success) setMessage('أحسنت، نكمل بثبات.', 'happy');
      else setMessage('ركّز هنا.', 'point');
      placeNear(target, 'bottom');
    };

    let updateFrame = null;
    const scheduleUpdate = (delay = 0) => {
      window.setTimeout(() => {
        if (updateFrame) return;
        updateFrame = requestAnimationFrame(() => {
          updateFrame = null;
          if (isDashboard) updateDashboard();
          if (isSurah) updateSurah();
        });
      }, delay);
    };

    if (isCelebration) {
      setMessage('أحسنت، خطوة قوية.', 'happy');
      placeNear(document.querySelector('.victory-card, main'), 'bottom');
    } else if (isInactivity) {
      setMessage('لنبدأ بخطوة صغيرة.', 'sleep');
      placeNear(document.querySelector('.return-card, main'), 'bottom');
    } else if (isDashboard) {
      setMessage('هذه هي التالية.', 'point');
      scheduleUpdate(350);
    } else if (isSurah) {
      scheduleUpdate(350);
      if (!performanceMode) document.addEventListener('click', () => scheduleUpdate(220), true);
    }

    let thoughtIndex = 0;
    const thoughtPool = isDashboard
      ? ['هذه هي التالية.', 'خطوة صغيرة تكفي.', 'تابع بثبات.']
      : isSurah
        ? ['ركّز هنا.', 'استمع بهدوء.', 'راجع بهدوء.']
        : ['أحسنت.', 'نواصل بهدوء.'];
    mascot.addEventListener('click', () => {
      thoughtIndex = (thoughtIndex + 1) % thoughtPool.length;
      setMessage(thoughtPool[thoughtIndex], mascot.dataset.state || 'point');
      mascot.classList.remove('is-peeking');
      mascot.classList.add('is-interacting');
      window.setTimeout(() => mascot.classList.remove('is-interacting'), 580);
    });

    if (!performanceMode) {
      window.setInterval(() => {
        if (document.hidden || mascot.classList.contains('is-hidden')) return;
        mascot.classList.add('is-wiggling');
        window.setTimeout(() => mascot.classList.remove('is-wiggling'), 900);
      }, 12000);
    }

    window.setInterval(() => {
      if (document.hidden || mascot.classList.contains('is-hidden') || mascot.dataset.state === 'sad') return;
      mascot.classList.add('is-peeking');
      window.setTimeout(() => mascot.classList.remove('is-peeking'), 2400);
    }, performanceMode ? 18000 : 15000);

    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      mascot.classList.remove('is-peeking', 'is-wiggling');
      hideTemporarily(640);
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        mascot.classList.remove('is-hidden');
      }, 680);
    }, { passive: true });

    if (!performanceMode) {
      window.addEventListener('resize', () => {
        scheduleUpdate();
      }, { passive: true });
    }

    const observerTarget = isDashboard ? document.getElementById('available-grid') : document.querySelector('main');
    if (observerTarget && !performanceMode) {
      let observerRuns = 0;
      const limitedObserver = new MutationObserver(() => {
        observerRuns++;
        scheduleUpdate(120);
        if (observerRuns > 6) limitedObserver.disconnect();
      });
      limitedObserver.observe(observerTarget, { childList: true, subtree: false });
    }
  }

  function injectMascotStyles() {
    if (document.getElementById('mawahib-mascot-style')) return;
    const style = document.createElement('style');
    style.id = 'mawahib-mascot-style';
    style.textContent = [
      '.mawahib-mascot{position:fixed;right:14px;bottom:92px;z-index:48;width:118px;pointer-events:auto;transition:transform .28s ease,opacity .2s ease;will-change:transform,opacity}',
      '.mawahib-mascot.is-hidden{opacity:0;transform:translateY(16px) scale(.94);pointer-events:none}',
      '.mawahib-mascot[data-place="target"]{right:auto;bottom:auto;transform:translate3d(var(--mascot-x),var(--mascot-y),0)}',
      '.mawahib-mascot.is-peeking,.mawahib-mascot.is-peeking[data-place="target"]{right:-52px;bottom:34%;transform:none;opacity:.46;filter:grayscale(.55);pointer-events:none}',
      '.mawahib-mascot.is-peeking .mascot-thought{display:none}',
      '.mascot-stage{width:100%;aspect-ratio:1;display:grid;place-items:end center;animation:mascotBreathe 4.4s ease-in-out infinite;cursor:pointer}',
      '.mawahib-mascot.is-interacting .mascot-stage{animation:mascotHello .58s ease both}',
      '.mawahib-mascot.is-wiggling .mascot-stage{animation:mascotWiggle .9s ease both}',
      '.mascot-stage img{width:100%;height:100%;object-fit:contain;display:block}',
      '.mascot-thought{position:absolute;right:78%;bottom:72%;min-width:122px;max-width:172px;padding:9px 11px;border-radius:18px 18px 6px 18px;background:linear-gradient(135deg,var(--platform-primary-soft,#dcfce7),#fff);border:1px solid color-mix(in srgb,var(--platform-primary,#14532d) 24%,#fff);color:var(--platform-primary-dark,#0c4a3b);font:900 12px/1.45 var(--platform-font-ui,Cairo),sans-serif;text-align:center;box-shadow:0 8px 18px rgba(15,23,42,.09)}',
      '.mascot-thought::after{content:"";position:absolute;right:14px;bottom:-8px;border:8px solid transparent;border-top-color:color-mix(in srgb,var(--platform-primary-soft,#dcfce7) 65%,#fff)}',
      '.mascot-z{position:absolute;right:9px;top:-8px;display:none;color:var(--platform-primary,#14532d);font-weight:900}',
      '.mawahib-mascot[data-state="happy"] .mascot-stage{transform:translateY(-5px) scale(1.02)}',
      '.mawahib-mascot[data-state="sad"] .mascot-stage{opacity:.82;transform:rotate(-2deg)}',
      '.mawahib-mascot[data-state="sleep"] .mascot-stage{opacity:.78;animation:none}',
      '.mawahib-mascot[data-state="sleep"] .mascot-z{display:block}',
      '@keyframes mascotBreathe{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(-1deg)}}',
      '@keyframes mascotHello{0%,100%{transform:translateY(0) rotate(0) scale(1)}35%{transform:translateY(-8px) rotate(-4deg) scale(1.04)}70%{transform:translateY(-3px) rotate(3deg) scale(1.02)}}',
      '@keyframes mascotWiggle{0%,100%{transform:translateX(0) rotate(0)}18%{transform:translateX(-3px) rotate(-3deg)}38%{transform:translateX(3px) rotate(3deg)}58%{transform:translateX(-2px) rotate(-2deg)}78%{transform:translateX(2px) rotate(2deg)}}',
      '@keyframes mascotFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
      '@keyframes mascotWin{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.035)}}',
      '@keyframes mascotSleep{0%{opacity:.2;transform:translateY(4px) scale(.9)}50%{opacity:1}100%{opacity:.1;transform:translateY(-10px) scale(1.08)}}',
      '@media(max-width:640px){.mawahib-mascot{width:68px;bottom:92px;right:4px;z-index:42;transition:opacity .18s ease,transform .18s ease}.mawahib-mascot[data-place="target"]{right:4px;bottom:92px;transform:none}.mawahib-mascot.is-peeking,.mawahib-mascot.is-peeking[data-place="target"]{right:-36px;bottom:142px;transform:none;opacity:.38;filter:grayscale(.65);pointer-events:none}.mascot-stage{animation:mascotBreathe 5.8s ease-in-out infinite}.mascot-thought{right:58%;bottom:76%;min-width:86px;max-width:106px;font-size:9px;padding:6px 8px;box-shadow:0 5px 12px rgba(15,23,42,.08)}.mawahib-mascot.is-peeking .mascot-thought,.mawahib-mascot.is-hidden .mascot-thought{display:none}.mawahib-mascot[data-state="happy"] .mascot-stage{transform:none}}'
    ].join('\n');
    document.head.appendChild(style);
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
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  function initEnhancements() {
    if (!document.body) return;
    syncSurahTheme();
    initDigitNormalizer();
    initNavAutoHide();
    initMascotGuide();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !window.matchMedia('(max-width: 768px)').matches) initScrollAnimations();
  }

  window.PlatformTheme = {
    themes,
    get: readTheme,
    set: applyTheme,
    apply: applyTheme,
    normalizeDigits
  };

  applyTheme(readTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements, { once: true });
  } else {
    initEnhancements();
  }
})();
