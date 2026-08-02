'use strict';
(() => {
  let current = null;
  let allClasses = [];
  let jitsiApi = null;
  let attendanceTimer = null;
  let currentRoom = null;
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const nameOf = user => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.username || 'طالب';
  const isTeacher = () => current?.role === 'prof';
  const isAdmin = () => current?.role === 'admin';
  const dateLabel = value => new Date(value + 'T12:00:00').toLocaleDateString('ar-MA', { weekday: 'long', day: 'numeric', month: 'long' });
  const now = () => new Date();
  const isAllowed = item => isTeacher() && item.profId === current.username || isAdmin() || (current?.role === 'student' && (item.studentIds || []).includes(current.username));
  const isJoinable = item => {
    const start = new Date(`${item.date}T${item.time || '00:00'}`);
    const end = new Date(start.getTime() + Number(item.duration || 60) * 60000);
    return now() >= new Date(start.getTime() - 15 * 60000) && now() <= new Date(end.getTime() + 30 * 60000);
  };
  const sortByDate = list => list.slice().sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

  async function setup() {
    current = Auth.getSession();
    if (!current || !['student', 'prof', 'admin'].includes(current.role)) { location.replace('login.html'); return; }
    $('#remote-role').textContent = current.role === 'prof' ? 'الأستاذ' : current.role === 'admin' ? 'الإدارة' : 'التلميذ';
    if (isTeacher()) await setupTeacher();
    if (isAdmin()) { $('#remote-title').textContent = 'متابعة الحصص عن بُعد'; $('#remote-subtitle').textContent = 'يمكنك الدخول إلى أي حصة جارية لمتابعتها.'; }
    await loadRemoteClasses();
    setInterval(() => { if (!document.hidden) loadRemoteClasses(); }, 30000);
  }

  async function setupTeacher() {
    $('#remote-teacher-create').hidden = false;
    $('#remote-title').textContent = 'تنظيم حصة عن بُعد';
    $('#remote-subtitle').textContent = 'مكالمة جماعية بالصوت، مع حضور ومتابعة مباشرة.';
    $('#remote-date').value = new Date().toISOString().slice(0, 10);
    const profs = await Auth.getProfs();
    const teacher = profs?.[current.username] || {};
    const students = (await Auth.getAllStudents()).filter(student => (teacher.students || []).includes(student.username));
    $('#remote-student-list').innerHTML = students.length ? students.map(student => `<label><input type="checkbox" value="${escapeHtml(student.username)}" checked><span>${escapeHtml(nameOf(student))}</span></label>`).join('') : '<p class="remote-empty">لا يوجد طلاب مرتبطون بهذا الحساب.</p>';
    $('#remote-create-form').addEventListener('submit', createRemoteClass);
  }

  async function createRemoteClass(event) {
    event.preventDefault();
    const ids = [...document.querySelectorAll('#remote-student-list input:checked')].map(input => input.value);
    if (!ids.length) { alert('اختر طالبًا واحدًا على الأقل.'); return; }
    const submit = event.submitter;
    submit.disabled = true;
    const payload = { title: $('#remote-name').value.trim(), date: $('#remote-date').value, time: $('#remote-time').value, duration: Number($('#remote-duration').value), studentIds: ids };
    const result = await Auth.saveRemoteClass(payload);
    submit.disabled = false;
    if (!result.ok) { alert(result.error || 'تعذر تنظيم الحصة.'); return; }
    await Promise.all(ids.map(id => Auth.sendMessage(id, `حصة عن بُعد: ${payload.title} · ${payload.date} · ${payload.time}`)));
    event.target.reset();
    $('#remote-date').value = new Date().toISOString().slice(0, 10);
    selectAllRemoteStudents(true);
    await loadRemoteClasses();
  }

  async function loadRemoteClasses() {
    allClasses = (await Auth.getRemoteClasses()).filter(isAllowed);
    const list = sortByDate(allClasses).filter(item => new Date(`${item.date}T${item.time}`).getTime() + Number(item.duration || 60) * 60000 > Date.now() - 1800000);
    $('#remote-list-title').textContent = isTeacher() ? 'حصصي القادمة' : isAdmin() ? 'الحصص المبرمجة والجارية' : 'حصصي القادمة';
    $('#remote-classes').innerHTML = list.length ? list.map(item => {
      const join = isJoinable(item);
      const label = join ? (isAdmin() ? 'دخول للمراقبة' : 'دخول الحصة') : 'في الموعد';
      return `<article class="remote-class-card"><div class="remote-class-time"><b>${escapeHtml(item.time || '')}</b><small>${escapeHtml(item.date || '')}</small></div><div class="remote-class-main"><h3>${escapeHtml(item.title || 'حصة عن بُعد')}</h3><p>${escapeHtml(dateLabel(item.date))} · ${Number(item.duration || 60)} دقيقة · ${escapeHtml(item.profName || '')}</p></div><button class="remote-class-action" ${join ? '' : 'disabled'} onclick="joinRemoteClass('${escapeHtml(item.id)}')">${label}</button></article>`;
    }).join('') : '<div class="remote-empty">لا توجد حصة مبرمجة لك حاليًا.</div>';
  }

  function loadJitsiScript() {
    if (window.JitsiMeetExternalAPI) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Jitsi unavailable'));
      document.head.appendChild(script);
    });
  }

  async function joinRemoteClass(id) {
    const item = allClasses.find(entry => entry.id === id);
    if (!item) return;
    currentRoom = item;
    $('#remote-room').hidden = false;
    $('#remote-room-name').textContent = item.title || 'الحصة عن بُعد';
    $('#remote-room-status').textContent = 'جاري تجهيز الصوت...';
    $('#remote-mute-all').hidden = !isTeacher();
    try {
      await loadJitsiScript();
      const roomName = `mawahib-${item.id}`.replace(/[^a-zA-Z0-9-]/g, '');
      jitsiApi = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: $('#remote-jitsi'),
        width: '100%', height: '100%', lang: 'ar',
        userInfo: { displayName: `${nameOf(current)}${isAdmin() ? ' · الإدارة' : ''}` },
        configOverwrite: { startAudioOnly: true, startWithVideoMuted: true, prejoinConfig: { enabled: true }, disableDeepLinking: true, enableNoAudioDetection: true, enableNoisyMicDetection: true, startAudioMuted: isTeacher() ? 0 : 1 },
        interfaceConfigOverwrite: { TOOLBAR_BUTTONS: ['microphone', 'hangup', 'participants-pane', 'chat', 'raisehand', 'settings'], SHOW_JITSI_WATERMARK: false, MOBILE_APP_PROMO: false }
      });
      jitsiApi.addEventListener('videoConferenceJoined', async () => {
        $('#remote-room-status').textContent = 'متصل بالصوت';
        await Auth.recordRemoteAttendance(item.id, { action: 'joined' });
        refreshPresence();
        attendanceTimer = setInterval(() => { if (!document.hidden) refreshPresence(); }, 10000);
      });
      jitsiApi.addEventListener('videoConferenceLeft', leaveRemoteRoom);
      jitsiApi.addEventListener('participantJoined', refreshPresence);
      jitsiApi.addEventListener('participantLeft', refreshPresence);
    } catch (error) {
      $('#remote-room-status').textContent = 'تعذر تشغيل خدمة الصوت. تحقق من الإنترنت ثم أعد المحاولة.';
    }
  }

  async function refreshPresence() {
    if (!currentRoom) return;
    const list = await Auth.getRemoteAttendance(currentRoom.id);
    $('#remote-presence').innerHTML = list.length ? list.map(item => `<div>${escapeHtml(item.name || item.username)}</div>`).join('') : '<div>لم ينضم أحد بعد.</div>';
  }

  function muteEveryoneRemote() {
    if (!jitsiApi || !isTeacher()) return;
    try { jitsiApi.executeCommand('muteEveryone', 'audio'); $('#remote-room-status').textContent = 'تم كتم الجميع'; }
    catch (_) { $('#remote-room-status').textContent = 'استخدم قائمة المشاركين لكتم المشارك المطلوب.'; }
  }

  function leaveRemoteRoom() {
    if (attendanceTimer) clearInterval(attendanceTimer);
    attendanceTimer = null;
    if (jitsiApi) { try { jitsiApi.dispose(); } catch (_) {} }
    jitsiApi = null;
    currentRoom = null;
    $('#remote-jitsi').replaceChildren();
    $('#remote-room').hidden = true;
  }

  window.selectAllRemoteStudents = checked => document.querySelectorAll('#remote-student-list input[type="checkbox"]').forEach(input => { input.checked = checked; });
  window.loadRemoteClasses = loadRemoteClasses;
  window.joinRemoteClass = joinRemoteClass;
  window.leaveRemoteRoom = leaveRemoteRoom;
  window.muteEveryoneRemote = muteEveryoneRemote;
  window.remoteLogout = () => { Auth.logout(); location.replace('login.html'); };
  document.addEventListener('DOMContentLoaded', setup);
})();