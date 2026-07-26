(function () {
  'use strict';

  function connectionAllowsBackgroundDownload() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return !['slow-2g', '2g'].includes(connection.effectiveType);
  }

  async function prepareOfflineLibrary() {
    if (!('serviceWorker' in navigator) || !navigator.onLine || !connectionAllowsBackgroundDownload()) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active || navigator.serviceWorker.controller;
      if (worker) worker.postMessage({ type: 'PREFETCH_LESSON_LIBRARY' });
    } catch (_) {}
  }

  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type !== 'OFFLINE_LIBRARY_READY') return;
    try {
      localStorage.setItem('mawahib_offline_library', JSON.stringify({
        cached: event.data.cached || 0,
        total: event.data.total || 0,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
  });
  window.addEventListener('load', () => {
    window.setTimeout(prepareOfflineLibrary, 4500);
  }, { once: true });
})();
