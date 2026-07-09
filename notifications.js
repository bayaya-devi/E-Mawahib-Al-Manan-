const Notif = (() => {
  const state = {
    session: null,
    supabase: null,
    channel: null,
    lastMsgIds: new Set(),
    lastDevIds: new Set(),
    pollTimer: null,
    reminderTimer: null,
    toastQueue: [],
    toastBusy: false,
    swReady: null
  };

  const keys = {
    enabled: 'mawahib_notifications_enabled',
    lastReminder: 'mawahib_last_surah_reminder_',
    seenMessages: 'mawahib_seen_messages_',
    seenDevoirs: 'mawahib_seen_devoirs_'
  };

  function canNotify() {
    return 'Notification' in window;
  }

  function isEnabled() {
    return localStorage.getItem(keys.enabled) === 'true' && canNotify() && Notification.permission === 'granted';
  }

  function currentUserKey() {
    return state.session ? state.session.username : 'guest';
  }

  async function init() {
    if (typeof Auth === 'undefined') return;
    state.session = Auth.getSession();
    if (!state.session || state.session.role !== 'student') return;
    state.supabase = Auth.getSupabaseClient();

    await registerServiceWorker();
    bindPermissionButtons();
    await loadExistingIds();
    startRealtime();
    startPolling();
    startSurahReminder();
    updatePermissionUi();
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      state.swReady = navigator.serviceWorker.ready.then(() => registration);
    } catch (error) {
      console.warn('[Notif] service worker unavailable', error);
    }
  }

  function bindPermissionButtons() {
    const button = document.getElementById('notification-enable');
    if (button) button.addEventListener('click', requestPermission);
    if (canNotify() && Notification.permission === 'default' && localStorage.getItem(keys.enabled) !== 'dismissed') {
      showPermissionBanner();
    }
  }

  function updatePermissionUi() {
    const button = document.getElementById('notification-enable');
    if (!button) return;
    if (!canNotify()) {
      button.textContent = 'الإشعارات غير مدعومة';
      button.disabled = true;
      return;
    }
    if (Notification.permission === 'granted') {
      button.textContent = 'الإشعارات مفعلة';
      button.classList.add('is-active');
    } else if (Notification.permission === 'denied') {
      button.textContent = 'الإشعارات محظورة من المتصفح';
    } else {
      button.textContent = 'تفعيل إشعارات الهاتف والكمبيوتر';
    }
  }

  async function requestPermission() {
    if (!canNotify()) {
      showInAppToast('هذا المتصفح لا يدعم الإشعارات.', '#64748b');
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(keys.enabled, 'true');
      updatePermissionUi();
      await notifySystem({
        title: 'تم تفعيل الإشعارات',
        body: 'ستصلك رسائل الإدارة، الواجبات الجديدة، وتذكير السورة بإذن الله.',
        tag: 'notif-enabled',
        type: 'system'
      });
      return true;
    }
    localStorage.setItem(keys.enabled, permission === 'denied' ? 'denied' : 'dismissed');
    updatePermissionUi();
    return false;
  }

  function showPermissionBanner() {
    if (document.getElementById('notif-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'notif-banner';
    banner.dir = 'rtl';
    banner.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;z-index:99999;background:linear-gradient(135deg,var(--platform-primary,#14532d),var(--platform-primary-dark,#0c4a3b));color:#fff;border-radius:20px;padding:12px;box-shadow:0 18px 48px rgba(15,23,42,.24);font-family:Cairo,Tajawal,sans-serif;display:flex;align-items:center;justify-content:space-between;gap:12px;';
    banner.innerHTML = '<div style="font-weight:900;font-size:13px;line-height:1.55">🔔 فعّل الإشعارات لتصلك الواجبات والرسائل وتذكير السورة على الهاتف أو الكمبيوتر.</div><div style="display:flex;gap:8px;flex-shrink:0"><button id="notif-allow" style="background:#fff;color:#14532d;border:0;border-radius:14px;padding:8px 12px;font-weight:900;cursor:pointer">تفعيل</button><button id="notif-later" style="background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.24);border-radius:14px;padding:8px 10px;font-weight:900;cursor:pointer">لاحقا</button></div>';
    document.body.appendChild(banner);
    document.getElementById('notif-allow').onclick = async () => { banner.remove(); await requestPermission(); };
    document.getElementById('notif-later').onclick = () => { localStorage.setItem(keys.enabled, 'dismissed'); banner.remove(); };
  }

  function restoreSeen(storageKey) {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey + currentUserKey()) || '[]')); }
    catch { return new Set(); }
  }

  function persistSeen(storageKey, set) {
    localStorage.setItem(storageKey + currentUserKey(), JSON.stringify(Array.from(set).slice(-100)));
  }

  async function loadExistingIds() {
    state.lastMsgIds = restoreSeen(keys.seenMessages);
    state.lastDevIds = restoreSeen(keys.seenDevoirs);
    try {
      const { data: msgs } = await state.supabase.from('messages').select('id').eq('username', state.session.username);
      const { data: devs } = await state.supabase.from('devoirs').select('id').eq('student_id', state.session.username);
      (msgs || []).forEach(m => state.lastMsgIds.add(m.id));
      (devs || []).forEach(d => state.lastDevIds.add(d.id));
      persistSeen(keys.seenMessages, state.lastMsgIds);
      persistSeen(keys.seenDevoirs, state.lastDevIds);
    } catch (error) {
      console.warn('[Notif] initial snapshot failed', error);
    }
  }

  function startRealtime() {
    if (!state.supabase || state.channel) return;
    state.channel = state.supabase.channel('notif-' + state.session.username)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'username=eq.' + state.session.username }, payload => handleMessage(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devoirs', filter: 'student_id=eq.' + state.session.username }, payload => handleDevoir(payload.new))
      .subscribe();
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(checkForUpdates, 60000);
    setTimeout(checkForUpdates, 8000);
  }

  async function checkForUpdates() {
    if (!state.session || !state.supabase) return;
    try {
      const { data: msgs } = await state.supabase.from('messages').select('*').eq('username', state.session.username).order('id', { ascending: false }).limit(5);
      const { data: devs } = await state.supabase.from('devoirs').select('*').eq('student_id', state.session.username).order('date_limite', { ascending: true }).limit(10);
      (msgs || []).reverse().forEach(handleMessage);
      (devs || []).forEach(handleDevoir);
    } catch (error) {
      console.warn('[Notif] polling failed', error);
    }
  }

  function handleMessage(row) {
    if (!row || state.lastMsgIds.has(row.id)) return;
    state.lastMsgIds.add(row.id);
    persistSeen(keys.seenMessages, state.lastMsgIds);
    trigger({
      title: 'رسالة جديدة',
      body: row.text || 'وصلتك رسالة جديدة من الإدارة أو الأستاذ.',
      tag: 'msg-' + row.id,
      type: 'message',
      url: 'dashboard.html'
    });
  }

  function handleDevoir(row) {
    if (!row || state.lastDevIds.has(row.id)) return;
    state.lastDevIds.add(row.id);
    persistSeen(keys.seenDevoirs, state.lastDevIds);
    trigger({
      title: 'واجب جديد',
      body: 'سورة ' + (row.surate || '') + ' من الآية ' + (row.aya_debut || '') + ' إلى ' + (row.aya_fin || ''),
      tag: 'dev-' + row.id,
      type: 'devoir',
      url: 'dashboard.html'
    });
  }

  function startSurahReminder() {
    if (state.reminderTimer) clearInterval(state.reminderTimer);
    state.reminderTimer = setInterval(sendSurahReminderIfNeeded, 30 * 60 * 1000);
    setTimeout(sendSurahReminderIfNeeded, 15000);
  }

  async function sendSurahReminderIfNeeded(force = false) {
    if (!state.session) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = keys.lastReminder + state.session.username;
    const hour = new Date().getHours();
    if (!force && localStorage.getItem(key) === today) return;
    if (!force && (hour < 8 || hour > 21)) return;
    const surah = await getCurrentSurahToWork();
    if (!surah) return;
    localStorage.setItem(key, today);
    trigger({
      title: 'تذكير المراجعة',
      body: 'اليوم ركّز على ' + (surah.nameAr || surah.nameFr || surah.id) + '. خطوة صغيرة تكفي للاستمرار.',
      tag: 'surah-reminder-' + today,
      type: 'reminder',
      url: surah.file || 'dashboard.html'
    });
  }

  async function getCurrentSurahToWork() {
    if (typeof SURAH_REGISTRY === 'undefined' || !Auth.getProgress) return null;
    const progress = await Auth.getProgress(state.session.username);
    const order = SURAH_REGISTRY.slice().sort((a, b) => b.num - a.num);
    return order.find(s => {
      const p = progress[s.id] || progress[String(s.id).replace('_', '-')];
      return !p || !p.completedAt;
    }) || order[0] || null;
  }

  async function trigger(payload) {
    const color = payload.type === 'devoir' ? '#be123c' : payload.type === 'reminder' ? '#b45309' : 'var(--platform-primary,#14532d)';
    if (isEnabled()) await notifySystem(payload);
    showInAppToast('🔔 ' + payload.title + '\n' + payload.body, color);
    flashTitle(payload.title);
  }

  async function notifySystem({ title, body, tag, url }) {
    const options = {
      body,
      tag,
      icon: 'logo.webp',
      badge: 'logo.webp',
      dir: 'rtl',
      lang: 'ar',
      data: { url: url || 'dashboard.html' }
    };
    try {
      const registration = state.swReady ? await state.swReady : null;
      if (registration && registration.showNotification) return registration.showNotification(title, options);
      return new Notification(title, options);
    } catch (error) {
      console.warn('[Notif] system notification failed', error);
    }
  }

  function showInAppToast(text, color = 'var(--platform-primary,#14532d)') {
    state.toastQueue.push({ text, color });
    if (!state.toastBusy) processToastQueue();
  }

  function processToastQueue() {
    if (!state.toastQueue.length) { state.toastBusy = false; return; }
    state.toastBusy = true;
    const item = state.toastQueue.shift();
    const toast = document.createElement('div');
    toast.dir = 'rtl';
    toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-90px);background:' + item.color + ';color:#fff;padding:13px 18px;border-radius:18px;font-family:Cairo,Tajawal,sans-serif;font-weight:900;font-size:13px;box-shadow:0 16px 38px rgba(15,23,42,.22);z-index:99999;max-width:calc(100vw - 28px);white-space:pre-line;text-align:center;line-height:1.55;transition:transform .32s ease,opacity .24s ease;';
    toast.textContent = item.text;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(-90px)';
      toast.style.opacity = '0';
      setTimeout(() => { toast.remove(); setTimeout(processToastQueue, 180); }, 300);
    }, 4600);
  }

  let flashInterval = null;
  let originalTitle = '';
  function flashTitle(title) {
    if (flashInterval) return;
    originalTitle = document.title;
    let toggle = false;
    flashInterval = setInterval(() => {
      document.title = toggle ? originalTitle : '🔔 ' + title;
      toggle = !toggle;
    }, 1000);
    const stop = () => {
      clearInterval(flashInterval);
      flashInterval = null;
      document.title = originalTitle;
      window.removeEventListener('focus', stop);
    };
    window.addEventListener('focus', stop);
    setTimeout(stop, 30000);
  }

  function destroy() {
    if (state.channel && state.supabase) state.supabase.removeChannel(state.channel);
    if (state.pollTimer) clearInterval(state.pollTimer);
    if (state.reminderTimer) clearInterval(state.reminderTimer);
  }

  window.addEventListener('beforeunload', destroy);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdates();
  });

  return {
    init,
    requestPermission,
    remindNow: () => sendSurahReminderIfNeeded(true),
    checkNow: checkForUpdates,
    isEnabled
  };
})();

window.Notif = Notif;

document.addEventListener('DOMContentLoaded', () => Notif.init());
