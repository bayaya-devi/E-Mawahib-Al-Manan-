/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS — مواهب المنان
   Gratuit — Supabase Realtime
   Dépendances : auth.js + supabase chargés avant ce fichier
   Intégration : <script src="notifications.js"></script>
                 avant </body> sur dashboard.html, profil.html, parent.html
═══════════════════════════════════════════════════════════ */

const Notif = (() => {

    let _session      = null;
    let _supabase     = null;
    let _channel      = null;
    let _lastMsgIds   = new Set();
    let _lastDevIds   = new Set();
    let _toastQueue   = [];
    let _toastBusy    = false;

    /* ─────────────────────────────────────────
       INIT
    ───────────────────────────────────────── */
    async function init() {
        if (typeof Auth === 'undefined') return;
        _session  = Auth.getSession();
        if (!_session || _session.role !== 'student') return;
        _supabase = Auth.getSupabaseClient();

        // Demander permission notifications navigateur
        await requestPermission();

        // Snapshot des IDs déjà existants (pour ne pas notifier l'historique)
        await loadExistingIds();

        // Démarrer l'écoute Supabase Realtime
        startListening();

        console.log('[Notif] ✅ Actif pour', _session.username);
    }

    /* ─────────────────────────────────────────
       PERMISSION NAVIGATEUR
    ───────────────────────────────────────── */
    async function requestPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            // Petite bannière maison d'abord pour expliquer
            showPermissionBanner();
        }
    }

    function showPermissionBanner() {
        if (document.getElementById('notif-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'notif-banner';
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: #fff; padding: 12px 16px;
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; font-family: 'Cairo', sans-serif;
            box-shadow: 0 2px 12px rgba(0,0,0,0.2);
            animation: slideDown 0.3s ease;
        `;
        banner.innerHTML = `
            <style>
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to   { transform: translateY(0); }
                }
            </style>
            <div style="display:flex;align-items:center;gap:10px;flex:1;">
                <span style="font-size:22px;">🔔</span>
                <span style="font-size:13px;font-weight:700;">
                    فعّل الإشعارات لتصلك رسائل الأستاذ والواجبات فوراً
                </span>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button id="notif-allow" style="
                    background:#fff; color:#7c3aed; border:none;
                    padding:7px 14px; border-radius:10px;
                    font-family:'Cairo',sans-serif; font-weight:900;
                    font-size:12px; cursor:pointer;">
                    تفعيل ✓
                </button>
                <button id="notif-deny" style="
                    background:rgba(255,255,255,0.15); color:#fff; border:none;
                    padding:7px 10px; border-radius:10px;
                    font-family:'Cairo',sans-serif; font-weight:700;
                    font-size:12px; cursor:pointer;">
                    لاحقاً
                </button>
            </div>
        `;
        document.body.appendChild(banner);

        document.getElementById('notif-allow').onclick = async () => {
            banner.remove();
            const perm = await Notification.requestPermission();
            if (perm === 'granted') showInAppToast('🔔 تم تفعيل الإشعارات بنجاح!', 'success');
        };
        document.getElementById('notif-deny').onclick = () => banner.remove();
    }

    /* ─────────────────────────────────────────
       SNAPSHOT IDs EXISTANTS
    ───────────────────────────────────────── */
    async function loadExistingIds() {
        try {
            const { data: msgs } = await _supabase
                .from('messages').select('id').eq('username', _session.username);
            (msgs || []).forEach(m => _lastMsgIds.add(m.id));

            const { data: devs } = await _supabase
                .from('devoirs').select('id').eq('student_id', _session.username);
            (devs || []).forEach(d => _lastDevIds.add(d.id));
        } catch(e) {
            console.warn('[Notif] snapshot error', e);
        }
    }

    /* ─────────────────────────────────────────
       SUPABASE REALTIME
    ───────────────────────────────────────── */
    function startListening() {
        _channel = _supabase.channel('notif-' + _session.username)

            /* Nouveau message */
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `username=eq.${_session.username}`
            }, payload => {
                const row = payload.new;
                if (_lastMsgIds.has(row.id)) return;
                _lastMsgIds.add(row.id);
                trigger({
                    title: '✉️ رسالة جديدة',
                    body:  row.text || 'لديك رسالة من الإدارة',
                    icon:  'logo.webp',
                    tag:   'msg-' + row.id,
                    type:  'message'
                });
            })

            /* Nouveau devoir */
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'devoirs',
                filter: `student_id=eq.${_session.username}`
            }, payload => {
                const row = payload.new;
                if (_lastDevIds.has(row.id)) return;
                _lastDevIds.add(row.id);
                trigger({
                    title: '📝 واجب جديد',
                    body:  `سورة ${row.surate || ''} — الآية ${row.aya_debut || ''} إلى ${row.aya_fin || ''}`,
                    icon:  'logo.webp',
                    tag:   'dev-' + row.id,
                    type:  'devoir'
                });
            })

            .subscribe(status => {
                console.log('[Notif] Realtime status:', status);
            });
    }

    /* ─────────────────────────────────────────
       DÉCLENCHER UNE NOTIFICATION
    ───────────────────────────────────────── */
    function trigger({ title, body, icon, tag, type }) {
        // 1) Notification navigateur (si permission)
        if (Notification.permission === 'granted') {
            try {
                new Notification(title, { body, icon, tag, dir: 'rtl', lang: 'ar' });
            } catch(e) {
                console.warn('[Notif] browser notif failed', e);
            }
        }

        // 2) Toast in-app (toujours visible)
        const color = type === 'message' ? '#6d28d9' : '#0369a1';
        const emoji = type === 'message' ? '✉️' : '📝';
        showInAppToast(`${emoji} ${title}\n${body}`, 'notif', color);

        // 3) Faire clignoter le titre de la page
        flashTitle(title);
    }

    /* ─────────────────────────────────────────
       TOAST IN-APP
    ───────────────────────────────────────── */
    function showInAppToast(text, type = 'notif', color = '#7c3aed') {
        _toastQueue.push({ text, type, color });
        if (!_toastBusy) processToastQueue();
    }

    function processToastQueue() {
        if (_toastQueue.length === 0) { _toastBusy = false; return; }
        _toastBusy = true;
        const { text, color } = _toastQueue.shift();

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%) translateY(-80px);
            background: ${color};
            color: #fff;
            padding: 12px 20px;
            border-radius: 16px;
            font-family: 'Cairo', sans-serif;
            font-weight: 700;
            font-size: 13px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.2);
            z-index: 99999;
            max-width: calc(100vw - 32px);
            text-align: center;
            direction: rtl;
            line-height: 1.5;
            transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.3s;
            white-space: pre-line;
        `;
        toast.textContent = text;
        document.body.appendChild(toast);

        // Slide in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });
        });

        // Slide out après 4s
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-80px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
                setTimeout(processToastQueue, 200);
            }, 350);
        }, 4000);
    }

    /* ─────────────────────────────────────────
       CLIGNOTEMENT TITRE
    ───────────────────────────────────────── */
    let _flashInterval = null;
    let _originalTitle = '';

    function flashTitle(msg) {
        if (_flashInterval) return; // déjà en cours
        _originalTitle = document.title;
        let toggle = false;
        _flashInterval = setInterval(() => {
            document.title = toggle ? _originalTitle : '🔔 ' + msg;
            toggle = !toggle;
        }, 1000);

        // Arrêter quand l'utilisateur revient sur la page
        const stop = () => {
            clearInterval(_flashInterval);
            _flashInterval = null;
            document.title = _originalTitle;
            window.removeEventListener('focus', stop);
        };
        window.addEventListener('focus', stop);

        // Arrêter automatiquement après 30s
        setTimeout(stop, 30000);
    }

    /* ─────────────────────────────────────────
       CLEANUP
    ───────────────────────────────────────── */
    function destroy() {
        if (_channel) _supabase.removeChannel(_channel);
    }

    window.addEventListener('beforeunload', destroy);

    return { init };
})();

/* ── Auto-init ── */
document.addEventListener('DOMContentLoaded', () => Notif.init());
