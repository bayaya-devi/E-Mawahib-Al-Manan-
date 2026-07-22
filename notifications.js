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
    lastTeacherReminder: 'mawahib_last_teacher_reminder_',
    teacherSeen: 'mawahib_teacher_seen_',
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

  function isTeacher() {
    return state.session && state.session.role === 'prof';
  }

  function isStudent() {
    return state.session && state.session.role === 'student';
  }

  async function init() {
    if (typeof Auth === 'undefined') return;
    state.session = Auth.getSession();
    if (!state.session || !['student', 'prof'].includes(state.session.role)) return;
    state.supabase = Auth.getSupabaseClient();

    await registerServiceWorker();
    bindPermissionButtons();
    await loadExistingIds();
    startRealtime();
    startPolling();
    if (isStudent()) startSurahReminder();
    if (isTeacher()) startTeacherReminders();
    updatePermissionUi();
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('sw.js?v=20260723-prof-notifications-1');
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
      button.textContent = isTeacher() ? 'تفعيل إشعارات الأستاذ' : 'تفعيل إشعارات الهاتف والكمبيوتر';
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
        body: isTeacher()
          ? 'ستصلك تنبيهات الواجبات، الغياب، والتسميع الخاص بطلابك.'
          : 'ستصلك رسائل الإدارة، الواجبات الجديدة، وتذكير السورة بإذن الله.',
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
    const text = isTeacher()
      ? '🔔 فعّل إشعارات الأستاذ لتصلك تذكيرات الواجبات، الغياب، والتسميع على الهاتف أو الكمبيوتر.'
      : '🔔 فعّل الإشعارات لتصلك الواجبات والرسائل وتذكير السورة على الهاتف أو الكمبيوتر.';
    banner.innerHTML = '<div style="font-weight:900;font-size:13px;line-height:1.55">' + text + '</div><div style="display:flex;gap:8px;flex-shrink:0"><button id="notif-allow" style="background:#fff;color:#14532d;border:0;border-radius:14px;padding:8px 12px;font-weight:900;cursor:pointer">تفعيل</button><button id="notif-later" style="background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.24);border-radius:14px;padding:8px 10px;font-weight:900;cursor:pointer">لاحقا</button></div>';
    document.body.appendChild(banner);
    document.getElementById('notif-allow').onclick = async () => { banner.remove(); await requestPermission(); };
    document.getElementById('notif-later').onclick = () => { localStorage.setItem(keys.enabled, 'dismissed'); banner.remove(); };
  }

  function restoreSeen(storageKey) {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey + currentUserKey()) || '[]')); }
    catch { return new Set(); }
  }

  function persistSeen(storageKey, set) {
    localStorage.setItem(storageKey + currentUserKey(), JSON.stringify(Array.from(set).slice(-150)));
  }

  async function loadExistingIds() {
    state.lastMsgIds = restoreSeen(keys.seenMessages);
    state.lastDevIds = restoreSeen(keys.seenDevoirs);
    try {
      const msgQuery = state.supabase.from('messages').select('id').eq('username', state.session.username);
      const devQuery = isTeacher()
        ? state.supabase.from('devoirs').select('id').eq('prof_id', state.session.username)
        : state.supabase.from('devoirs').select('id').eq('student_id', state.session.username);
      const [{ data: msgs }, { data: devs }] = await Promise.all([msgQuery, devQuery]);
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
    const channel = state.supabase.channel('notif-' + state.session.username)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'username=eq.' + state.session.username }, payload => handleMessage(payload.new));
    if (isTeacher()) {
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devoirs', filter: 'prof_id=eq.' + state.session.username }, payload => handleTeacherDevoir(payload.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devoirs', filter: 'prof_id=eq.' + state.session.username }, payload => handleTeacherDevoirUpdate(payload.new));
    } else {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devoirs', filter: 'student_id=eq.' + state.session.username }, payload => handleDevoir(payload.new));
    }
    state.channel = channel.subscribe();
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(checkForUpdates, 60000);
    setTimeout(checkForUpdates, 8000);
  }

  async function checkForUpdates() {
    if (!state.session || !state.supabase) return;
    try {
      const msgsPromise = state.supabase.from('messages').select('*').eq('username', state.session.username).order('id', { ascending: false }).limit(5);
      const devsPromise = isTeacher()
        ? state.supabase.from('devoirs').select('*').eq('prof_id', state.session.username).order('date_limite', { ascending: true }).limit(20)
        : state.supabase.from('devoirs').select('*').eq('student_id', state.session.username).order('date_limite', { ascending: true }).limit(10);
      const [{ data: msgs }, { data: devs }] = await Promise.all([msgsPromise, devsPromise]);
      (msgs || []).reverse().forEach(handleMessage);
      (devs || []).forEach(isTeacher() ? handleTeacherDevoir : handleDevoir);
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
      url: isTeacher() ? 'dashboard_prof.html' : 'dashboard.html'
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

  function handleTeacherDevoir(row) {
    if (!row || state.lastDevIds.has(row.id)) return;
    state.lastDevIds.add(row.id);
    persistSeen(keys.seenDevoirs, state.lastDevIds);
    trigger({
      title: 'واجب مسجل',
      body: studentLabel(row.student_id) + ' لديه واجب في سورة ' + (row.surate || ''),
      tag: 'teacher-dev-' + row.id,
      type: 'teacher',
      url: 'prof-homework.html'
    });
  }

  function handleTeacherDevoirUpdate(row) {
    if (!row || String(row.statut || '').toLowerCase() !== 'termine') return;
    trigger({
      title: 'واجب منجز',
      body: studentLabel(row.student_id) + ' أنهى واجب سورة ' + (row.surate || ''),
      tag: 'teacher-dev-done-' + row.id,
      type: 'teacher',
      url: 'prof-homework.html'
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

  function startTeacherReminders() {
    if (state.reminderTimer) clearInterval(state.reminderTimer);
    state.reminderTimer = setInterval(sendTeacherRemindersIfNeeded, 30 * 60 * 1000);
    setTimeout(sendTeacherRemindersIfNeeded, 15000);
  }

  async function sendTeacherRemindersIfNeeded(force = false) {
    if (!isTeacher() || !state.supabase) return;
    const today = todayKey();
    const key = keys.lastTeacherReminder + state.session.username;
    const hour = new Date().getHours();
    if (!force && localStorage.getItem(key) === today) return;
    if (!force && (hour < 7 || hour > 22)) return;
    const seen = restoreTeacherSeen(today);
    const reminders = await buildTeacherReminders(today);
    reminders.forEach(item => {
      if (seen.has(item.tag)) return;
      seen.add(item.tag);
      trigger(item);
    });
    persistTeacherSeen(today, seen);
    localStorage.setItem(key, today);
  }

  async function buildTeacherReminders(today) {
    const reminders = [];
    const profId = state.session.username;
    const profRes = await state.supabase.from('profs').select('students').eq('username', profId).maybeSingle();
    const devoirsRes = await state.supabase.from('devoirs').select('*').eq('prof_id', profId).order('date_limite', { ascending: true }).limit(120);
    const devoirs = devoirsRes.data || [];
    const assignedIds = Array.isArray(profRes.data?.students) ? profRes.data.students.filter(Boolean) : [];
    const ids = Array.from(new Set([...assignedIds, ...devoirs.map(d => d.student_id).filter(Boolean)]));
    const names = await fetchStudentNames(ids);

    devoirs.forEach(row => {
      const date = normalizeDate(row.date_limite || row.date || row.created_at);
      const done = String(row.statut || '').toLowerCase() === 'termine';
      const name = names[row.student_id] || studentLabel(row.student_id);
      if (!done && date === today) {
        reminders.push({
          title: 'واجب اليوم',
          body: name + ' لديه واجب اليوم في سورة ' + (row.surate || '') + '.',
          tag: 'teacher-homework-today-' + row.id + '-' + today,
          type: 'teacher',
          url: 'prof-homework.html'
        });
      }
      if (!done && date && date < today) {
        reminders.push({
          title: 'واجب متأخر',
          body: name + ' لم ينجز بعد واجب سورة ' + (row.surate || '') + '.',
          tag: 'teacher-homework-late-' + row.id + '-' + today,
          type: 'teacher',
          url: 'prof-homework.html'
        });
      }
    });

    if (ids.length) {
      reminders.push({
        title: 'تذكير الحضور',
        body: 'لا تنس تسجيل الحضور والغياب اليوم لطلابك.',
        tag: 'teacher-attendance-' + today,
        type: 'reminder',
        url: 'prof-recitation.html'
      });
      const latestNotes = await fetchLatestRecitations(ids);
      ids.forEach(id => {
        const last = latestNotes[id];
        const days = last ? daysSince(last) : 999;
        if (days >= 14) {
          reminders.push({
            title: 'تسميع متأخر',
            body: (names[id] || studentLabel(id)) + (last ? ' لم يسجل تسميعا منذ ' + days + ' يوما.' : ' لم يسجل له تسميع بعد.'),
            tag: 'teacher-recitation-' + id + '-' + today,
            type: 'reminder',
            url: 'prof-recitation.html'
          });
        }
      });
    }

    return reminders.slice(0, 8);
  }

  async function fetchStudentNames(ids) {
    const names = {};
    if (!ids.length) return names;
    try {
      const { data } = await state.supabase.from('eleves').select('username, prenom, nom').in('username', ids);
      (data || []).forEach(row => { names[row.username] = [row.prenom, row.nom].filter(Boolean).join(' ') || row.username; });
    } catch (error) {
      console.warn('[Notif] student names unavailable', error);
    }
    return names;
  }

  async function fetchLatestRecitations(ids) {
    const latest = {};
    if (!ids.length) return latest;
    try {
      const noteKeys = ids.map(id => '__teacher_notes__:' + id);
      const { data } = await state.supabase.from('messages').select('*').in('username', noteKeys).order('id', { ascending: false }).limit(250);
      (data || []).forEach(row => {
        const studentId = String(row.username || '').replace('__teacher_notes__:', '');
        const note = parseTeacherNote(row);
        if (!note || !(note.source === 'recitation' || note.surah || note.validation)) return;
        const stamp = note.savedAt || row.created_at || row.date;
        if (!latest[studentId] || new Date(stamp) > new Date(latest[studentId])) latest[studentId] = stamp;
      });
    } catch (error) {
      console.warn('[Notif] recitation reminders unavailable', error);
    }
    return latest;
  }

  function parseTeacherNote(row) {
    const raw = String(row.text || '');
    const jsonStart = raw.indexOf('{');
    if (jsonStart < 0) return null;
    try { return JSON.parse(raw.slice(jsonStart)); }
    catch { return null; }
  }

  function restoreTeacherSeen(today) {
    try { return new Set(JSON.parse(localStorage.getItem(keys.teacherSeen + currentUserKey() + '_' + today) || '[]')); }
    catch { return new Set(); }
  }

  function persistTeacherSeen(today, seen) {
    localStorage.setItem(keys.teacherSeen + currentUserKey() + '_' + today, JSON.stringify(Array.from(seen).slice(-80)));
  }

  function todayKey() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function normalizeDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  function daysSince(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 999;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  function studentLabel(id) {
    return id ? 'الطالب ' + id : 'أحد الطلاب';
  }

  async function getCurrentSurahToWork() {
    if (typeof SURAH_REGISTRY === 'undefined' || !Auth.getProgress) return null;
    const progress = await Auth.getProgress(state.session.username);
    const order = SURAH_REGISTRY.slice().sort((a, b) => b.num - a.num);
    return order.find(s => {
      const canonicalId = Auth.normalizeSurahId ? Auth.normalizeSurahId(s.id) : s.id;
      const p = progress[canonicalId] || progress[s.id] || progress[String(s.id).replace('_', '-')];
      return !p || !p.completedAt;
    }) || order[0] || null;
  }

  async function trigger(payload) {
    const color = payload.type === 'devoir' ? '#be123c' : payload.type === 'reminder' ? '#b45309' : payload.type === 'teacher' ? '#2563eb' : 'var(--platform-primary,#14532d)';
    if (isEnabled()) await notifySystem(payload);
    showInAppToast('🔔 ' + payload.title + '\n' + payload.body, color);
    flashTitle(payload.title);
    pulsePage(payload.type);
  }

  async function notifySystem({ title, body, tag, url }) {
    const options = {
      body,
      tag,
      icon: 'logo.webp',
      badge: 'logo.webp',
      dir: 'rtl',
      lang: 'ar',
      data: { url: url || (isTeacher() ? 'dashboard_prof.html' : 'dashboard.html') }
    };
    try {
      const registration = state.swReady ? await state.swReady : null;
      if (registration && registration.showNotification) return registration.showNotification(title, options);
      return new Notification(title, options);
    } catch (error) {
      console.warn('[Notif] system notification failed', error);
    }
  }

  function pulsePage(type) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = document.documentElement;
    el.classList.add('mawahib-notif-pulse-' + (type || 'default'));
    setTimeout(() => { el.className = el.className.replace(/\bmawahib-notif-pulse-\S+/g, '').trim(); }, 900);
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
    remindNow: () => isTeacher() ? sendTeacherRemindersIfNeeded(true) : sendSurahReminderIfNeeded(true),
    checkNow: checkForUpdates,
    isEnabled
  };
})();

window.Notif = Notif;

document.addEventListener('DOMContentLoaded', () => Notif.init());
