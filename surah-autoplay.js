(function () {
  'use strict';

  const AUDIO_ROOTS = [
    'https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps/',
    'https://everyayah.com/data/warsh/warsh_yassin_al_jazaery_64kbps/'
  ];
  const NativeAudio = window.Audio;
  let currentAudio = null;
  let preloadAudio = null;
  let queueToken = 0;
  let autoplayStarted = false;
  let autoplayAttempting = false;
  let observedSection = '';
  let observedListening = false;
  let sectionTimer = null;

  function prepareConnection() {
    if (document.querySelector('link[data-warsh-preconnect]')) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://everyayah.com';
    link.crossOrigin = 'anonymous';
    link.dataset.warshPreconnect = 'true';
    document.head.appendChild(link);
  }

  function normalizeCodes(codes) {
    return Array.from(new Set((codes || []).map(String).filter(code => /^\d{6}$/.test(code))));
  }

  function currentSectionCodes() {
    if (typeof window.currentVerses === 'function') {
      try {
        const codes = window.currentVerses().map(verse => verse && verse.audio);
        if (normalizeCodes(codes).length) return normalizeCodes(codes);
      } catch (error) {}
    }

    const visibleButtons = Array.from(document.querySelectorAll('[onclick*="playSingleAudio"], [onclick*="playVerse"]'))
      .filter(element => element.offsetParent !== null);
    const visibleCodes = visibleButtons.map(element => {
      const match = (element.getAttribute('onclick') || '').match(/\b(\d{6})\b/);
      return match ? match[1] : '';
    });
    if (normalizeCodes(visibleCodes).length) return normalizeCodes(visibleCodes);

    const scripts = Array.from(document.scripts).map(script => script.textContent || '').join('\n');
    return normalizeCodes(Array.from(scripts.matchAll(/["']?audio["']?\s*:\s*["'](\d{6})["']/g), match => match[1]));
  }

  function createAudio(code, sourceIndex = 0) {
    const audio = new NativeAudio();
    audio.preload = 'auto';
    audio.src = AUDIO_ROOTS[sourceIndex] + code + '.mp3';
    audio.dataset.mawahibSourceIndex = String(sourceIndex);
    audio.setAttribute('playsinline', '');
    audio.addEventListener('loadedmetadata', () => {
      try { audio.currentTime = 0; } catch (error) {}
    }, { once: true });
    audio.load();
    return audio;
  }

  function stopPlayback() {
    queueToken++;
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.onstalled = null;
      currentAudio.pause();
      try { currentAudio.currentTime = 0; } catch (error) {}
      currentAudio.removeAttribute('src');
      currentAudio.load();
      currentAudio = null;
    }
    if (preloadAudio) {
      preloadAudio.removeAttribute('src');
      preloadAudio.load();
      preloadAudio = null;
    }
  }

  function warm(code) {
    if (!code) return;
    if (preloadAudio) {
      preloadAudio.removeAttribute('src');
      preloadAudio.load();
    }
    preloadAudio = createAudio(code);
  }

  function playCodes(codes, options) {
    const queue = normalizeCodes(codes);
    if (!queue.length) return Promise.reject(new Error('No Warsh audio found'));
    stopPlayback();
    const token = queueToken;
    let index = 0;
    let firstPlay = null;

    function playNext() {
      if (token !== queueToken || index >= queue.length) {
        if (options && typeof options.onComplete === 'function' && token === queueToken) options.onComplete();
        return;
      }
      const code = queue[index];
      const prepared = preloadAudio && preloadAudio.src.endsWith('/' + code + '.mp3') ? preloadAudio : createAudio(code);
      preloadAudio = null;
      currentAudio = prepared;
      try { currentAudio.currentTime = 0; } catch (error) {}
      if (queue[index + 1]) warm(queue[index + 1]);

      let retried = false;
      currentAudio.onended = () => {
        if (token !== queueToken) return;
        index++;
        playNext();
      };
      currentAudio.onerror = () => {
        if (token !== queueToken) return;
        if (!retried) {
          retried = true;
          const retry = createAudio(code, 1);
          currentAudio = retry;
          retry.onended = () => { index++; playNext(); };
          retry.onerror = () => {
            if (token !== queueToken) return;
            if (options && typeof options.onError === 'function') options.onError(code);
          };
          retry.play().then(() => { autoplayStarted = true; }).catch(error => {
            if (token !== queueToken) return;
            if (options && typeof options.onError === 'function') options.onError(code, error);
          });
        }
      };
      currentAudio.onstalled = currentAudio.onerror;
      const promise = currentAudio.play();
      if (!firstPlay) firstPlay = promise;
      promise.then(() => { autoplayStarted = true; }).catch(error => {
        if (token !== queueToken || error?.name === 'NotAllowedError') return;
        if (!retried && typeof currentAudio.onerror === 'function') currentAudio.onerror();
      });
    }

    playNext();
    return firstPlay || Promise.resolve();
  }

  function awardListeningOnce(codes) {
    if (typeof window.updateStats !== 'function') return;
    const key = 'mawahib_audio_xp_' + location.pathname + '_' + normalizeCodes(codes).join('-');
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    window.updateStats(8, true);
  }

  function playCurrentSection() {
    const codes = currentSectionCodes();
    return playCodes(codes, { onComplete: () => awardListeningOnce(codes) });
  }

  function sectionSignature(codes) {
    return normalizeCodes(codes).join('-');
  }

  function isListeningSectionVisible() {
    const phase = document.getElementById('phase-0');
    if (phase) return !phase.classList.contains('hidden');
    const screen = document.getElementById('screen-0');
    if (screen) return !screen.classList.contains('hidden');
    return true;
  }

  function watchSectionChange() {
    clearTimeout(sectionTimer);
    sectionTimer = setTimeout(() => {
      const codes = currentSectionCodes();
      const signature = sectionSignature(codes);
      const listening = isListeningSectionVisible();
      const enteredListening = listening && !observedListening;
      const sectionChanged = signature && signature !== observedSection;
      observedListening = listening;

      if (!listening) {
        autoplayAttempting = false;
        stopPlayback();
        return;
      }
      if (!signature || (!enteredListening && !sectionChanged)) return;
      observedSection = signature;
      autoplayStarted = false;
      autoplayAttempting = false;
      stopPlayback();
      warm(codes[0]);
      window.setTimeout(attemptAutoplay, 180);
    }, 90);
  }

  function installPageControls() {
    window.stopAudio = stopPlayback;
    window.playAll = playCurrentSection;
    window.playFullQuarter = playCurrentSection;
    window.playVerse = function (code, element) {
      document.querySelectorAll('.verse-card').forEach(card => { card.style.background = ''; });
      if (element) element.style.background = '#f1f5f9';
      return playCodes([code], { onComplete: () => { if (element) element.style.background = ''; } });
    };
    window.playSingleAudio = function (code, element) {
      document.querySelectorAll('.verse-play-btn').forEach(button => button.classList.remove('bg-emerald-200', 'animate-pulse'));
      if (element) element.classList.add('bg-emerald-200', 'animate-pulse');
      return playCodes([code], { onComplete: () => { if (element) element.classList.remove('bg-emerald-200', 'animate-pulse'); } });
    };
    window.MawahibSurahAudio = {
      currentCodes: currentSectionCodes,
      playAll: playCurrentSection,
      playVerse: (code, element) => window.playVerse(code, element),
      stop: stopPlayback
    };
  }

  function attemptAutoplay() {
    if (autoplayStarted || autoplayAttempting || document.hidden || !isListeningSectionVisible()) return;
    autoplayAttempting = true;
    playCurrentSection()
      .then(() => { autoplayStarted = true; })
      .catch(() => {})
      .finally(() => { autoplayAttempting = false; });
  }

  function initialize() {
    installPageControls();
    const codes = currentSectionCodes();
    observedSection = sectionSignature(codes);
    observedListening = isListeningSectionVisible();
    if (codes[0]) warm(codes[0]);
    window.setTimeout(attemptAutoplay, 250);

    const observer = new MutationObserver(watchSectionChange);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    const unlockAudio = () => {
      if (!autoplayStarted) attemptAutoplay();
    };
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    window.addEventListener('pagehide', () => { observer.disconnect(); stopPlayback(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && currentAudio) currentAudio.pause();
      else if (!document.hidden && currentAudio && currentAudio.paused && !currentAudio.ended) currentAudio.play().catch(() => {});
    });
  }

  prepareConnection();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
