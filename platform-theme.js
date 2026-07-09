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
      if (delta < 6) return;

      const scrollingDown = y > lastY;
      const nearTop = y < 80;
      nav.classList.toggle('nav-scroll-hidden', scrollingDown && !nearTop);
      lastY = y;

      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        nav.classList.remove('nav-scroll-hidden');
      }, 720);
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

    injectMascotStyles();
    const mascot = document.createElement('div');
    mascot.id = 'mawahib-mascot';
    mascot.className = 'mawahib-mascot';
    mascot.dir = 'rtl';
    mascot.innerHTML = [
      '<div class="mascot-thought" id="mascot-thought"></div>',
      '<div class="mascot-stage"><img src="assets/mascot.webp" alt="رفيق مواهب المنان" loading="lazy" decoding="async"></div>',
      '<div class="mascot-z">Zz</div>'
    ].join('');
    document.body.appendChild(mascot);

    const setMessage = (text, state = 'point') => {
      if (mascot.dataset.state !== state) mascot.dataset.state = state;
      const bubble = document.getElementById('mascot-thought');
      if (bubble && bubble.textContent !== text) bubble.textContent = text;
    };

    const placeNear = (target, fallback = 'bottom') => {
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
      const wrong = document.querySelector('.wrong, .bg-rose-50, .text-rose-700');
      if (wrong) setMessage('راجع بهدوء.', 'sad');
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
      document.addEventListener('click', () => scheduleUpdate(220), true);
    }

    window.addEventListener('resize', () => {
      scheduleUpdate();
    }, { passive: true });

    const isSmallScreen = window.matchMedia('(max-width: 640px)').matches;
    const observerTarget = isDashboard ? document.getElementById('available-grid') : document.querySelector('main');
    if (observerTarget && !isSmallScreen) {
      const observer = new MutationObserver(() => scheduleUpdate(120));
      observer.observe(observerTarget, { childList: true, subtree: false });
    }
  }

  function injectMascotStyles() {
    if (document.getElementById('mawahib-mascot-style')) return;
    const style = document.createElement('style');
    style.id = 'mawahib-mascot-style';
    style.textContent = [
      '.mawahib-mascot{position:fixed;right:14px;bottom:92px;z-index:48;width:118px;pointer-events:none;transition:transform .28s ease,opacity .2s ease}',
      '.mawahib-mascot[data-place="target"]{right:auto;bottom:auto;transform:translate3d(var(--mascot-x),var(--mascot-y),0)}',
      '.mascot-stage{width:100%;aspect-ratio:1;display:grid;place-items:end center}',
      '.mascot-stage img{width:100%;height:100%;object-fit:contain;display:block}',
      '.mascot-thought{position:absolute;right:78%;bottom:72%;min-width:122px;max-width:172px;padding:9px 11px;border-radius:18px 18px 6px 18px;background:linear-gradient(135deg,var(--platform-primary-soft,#dcfce7),#fff);border:1px solid color-mix(in srgb,var(--platform-primary,#14532d) 24%,#fff);color:var(--platform-primary-dark,#0c4a3b);font:900 12px/1.45 var(--platform-font-ui,Cairo),sans-serif;text-align:center;box-shadow:0 8px 18px rgba(15,23,42,.09)}',
      '.mascot-thought::after{content:"";position:absolute;right:14px;bottom:-8px;border:8px solid transparent;border-top-color:color-mix(in srgb,var(--platform-primary-soft,#dcfce7) 65%,#fff)}',
      '.mascot-z{position:absolute;right:9px;top:-8px;display:none;color:var(--platform-primary,#14532d);font-weight:900}',
      '.mawahib-mascot[data-state="happy"] .mascot-stage{transform:translateY(-5px) scale(1.02)}',
      '.mawahib-mascot[data-state="sad"] .mascot-stage{opacity:.82;transform:rotate(-2deg)}',
      '.mawahib-mascot[data-state="sleep"] .mascot-stage{opacity:.78;animation:none}',
      '.mawahib-mascot[data-state="sleep"] .mascot-z{display:block}',
      '@keyframes mascotFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
      '@keyframes mascotWin{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.035)}}',
      '@keyframes mascotSleep{0%{opacity:.2;transform:translateY(4px) scale(.9)}50%{opacity:1}100%{opacity:.1;transform:translateY(-10px) scale(1.08)}}',
      '@media(max-width:640px){.mawahib-mascot{width:74px;bottom:78px;right:6px;transition:opacity .18s ease}.mawahib-mascot[data-place="target"]{right:6px;bottom:78px;transform:none}.mascot-thought{right:62%;bottom:74%;min-width:92px;max-width:116px;font-size:9px;padding:6px 8px;box-shadow:0 5px 12px rgba(15,23,42,.08)}.mawahib-mascot[data-state="happy"] .mascot-stage{transform:none}}'
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
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) initScrollAnimations();
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
