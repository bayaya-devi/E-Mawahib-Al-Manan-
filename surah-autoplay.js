(function () {
  'use strict';

  const AUDIO_ROOT = 'https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps/';
  const NativeAudio = window.Audio;
  let currentAudio = null;
  let preloadAudio = null;
  let queueToken = 0;
  let autoplayStarted = false;
  let autoplayAttempting = false;

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

  function createAudio(code) {
    const audio = new NativeAudio();
    audio.preload = 'auto';
    audio.src = AUDIO_ROOT + code + '.mp3';
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
          const retry = createAudio(code);
          currentAudio = retry;
          retry.onended = () => { index++; playNext(); };
          retry.play().catch(() => {});
        }
      };
      const promise = currentAudio.play();
      if (!firstPlay) firstPlay = promise;
      promise.then(() => { autoplayStarted = true; }).catch(() => {});
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
  }

  function attemptAutoplay() {
    if (autoplayStarted || autoplayAttempting || document.hidden) return;
    autoplayAttempting = true;
    playCurrentSection()
      .then(() => { autoplayStarted = true; })
      .catch(() => {})
      .finally(() => { autoplayAttempting = false; });
  }

  function initialize() {
    installPageControls();
    const codes = currentSectionCodes();
    if (codes[0]) warm(codes[0]);
    window.setTimeout(attemptAutoplay, 250);

    const unlockAudio = () => {
      if (!autoplayStarted) attemptAutoplay();
    };
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    window.addEventListener('pagehide', stopPlayback);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && currentAudio) currentAudio.pause();
      else if (!document.hidden && currentAudio && currentAudio.paused && !currentAudio.ended) currentAudio.play().catch(() => {});
    });
  }

  prepareConnection();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
