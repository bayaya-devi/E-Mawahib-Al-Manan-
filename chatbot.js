/* ═══════════════════════════════════════════════════════════
   CHATBOT مواهب المنان — version gratuite (sans API)
   Dépendances : auth.js chargé avant ce fichier
═══════════════════════════════════════════════════════════ */

/* ── Suggestions rapides ── */
const QUICK_CHIPS = [
    { label: '📅 جدولي',              msg: 'ما هو جدول حصصي؟' },
    { label: '📖 تقدمي',              msg: 'كيف أشاهد تقدمي في السور؟' },
    { label: '📝 واجباتي',            msg: 'أين أجد واجباتي؟' },
    { label: '✉️ رسائلي',             msg: 'كيف أقرأ رسائلي؟' },
    { label: '❓ مساعدة',             msg: 'ماذا يمكنني أن أفعل في المنصة؟' },
];

/* ── Règles de réponse ── */
const RULES = [
    {
        keys: ['جدول','حصص','وقت','موعد','متى','ساعة','يوم'],
        reply: (s) => s
            ? `📅 جدول حصصك:\n${s}`
            : '📅 لم يتم تحديد جدولك بعد.\nتواصل مع الأستاذ أو الإدارة لتحديد أوقات حصصك.'
    },
    {
        keys: ['سور','سورة','تقدم','إنجاز','حفظ','أنجزت'],
        reply: () => '📖 لمشاهدة تقدمك في السور:\n1. اذهب إلى لوحة التحكم\n2. ستجد قائمة السور التي بدأتها وأنجزتها\n3. يمكنك النقر على أي سورة لمشاهدة تفاصيل نشاطاتك'
    },
    {
        keys: ['واجب','تمرين','درس','مهمة','فرض'],
        reply: () => '📝 للوصول إلى واجباتك:\n1. افتح لوحة التحكم (dashboard)\n2. ابحث عن قسم "الواجبات"\n3. ستجد جميع الواجبات المسندة إليك من طرف أستاذك'
    },
    {
        keys: ['رسالة','رسائل','إشعار','تنبيه','الإدارة'],
        reply: () => '✉️ لقراءة رسائلك:\n1. افتح لوحة التحكم\n2. ستجد رسائل الإدارة والأستاذ في الأعلى\n3. يمكنك الاطلاع عليها مباشرة'
    },
    {
        keys: ['ملف','بيانات','معلومات','اسم','كلمة مرور','حساب'],
        reply: () => '👤 لعرض ملفك الشخصي:\n• انتقل إلى صفحة profil.html\n• ستجد معلومات حسابك وجدولك الشخصي هناك'
    },
    {
        keys: ['ولي','والد','والدة','أب','أم','أولياء','عائلة'],
        reply: () => '👨‍👩‍👧 صفحة الأولياء:\n• تحتوي على معلومات ومحتوى خاص بأولياء الأمور\n• يمكن الوصول إليها من خلال الرابط المخصص لهم'
    },
    {
        keys: ['مساعدة','مساعد','ماذا','يمكن','أفعل','خدمات','ميزات','المنصة'],
        reply: () => `🌟 ما يمكنني مساعدتك فيه:\n\n📅 جدولك — اسألني "ما جدولي؟"\n📖 السور — اسألني "كيف أشاهد تقدمي؟"\n📝 الواجبات — اسألني "أين واجباتي؟"\n✉️ الرسائل — اسألني "كيف أقرأ رسائلي؟"\n👤 الملف الشخصي — اسألني عن حسابك\n\nاكتب سؤالك وسأجيبك! 😊`
    },
    {
        keys: ['شكرا','شكراً','مرسي','أحسنت','ممتاز','رائع','بارك'],
        reply: () => 'العفو! 😊 يسعدني مساعدتك دائماً. هل هناك شيء آخر تريد معرفته؟'
    },
    {
        keys: ['مرحبا','السلام','أهلا','هلا','صباح','مساء'],
        reply: (s, name) => `وعليكم السلام ${name}! 👋\nكيف يمكنني مساعدتك اليوم؟`
    },
    {
        keys: ['خروج','تسجيل خروج','أغلق','إغلاق','خروج'],
        reply: () => '🚪 لتسجيل الخروج:\nانقر على زر "خروج" في الصفحة الرئيسية.'
    },
    {
        keys: ['نسيت','نسيت كلمة','مرور','password'],
        reply: () => '🔑 إذا نسيت كلمة المرور:\nتواصل مع الإدارة وسيساعدونك في إعادة تعيينها.'
    },
];

/* ── Réponse par défaut ── */
const DEFAULT_REPLIES = [
    'لم أفهم سؤالك جيداً 😅\nحاول السؤال بطريقة أخرى، أو اضغط على أحد الاختصارات أعلاه.',
    'لست متأكداً من ذلك 🤔\nيمكنك التواصل مع الإدارة أو أستاذك للحصول على مساعدة أفضل.',
    'هذا خارج ما يمكنني الإجابة عنه حالياً.\nجرب أن تسألني عن جدولك أو واجباتك أو رسائلك! 😊',
];

/* ── État ── */
let _cbOpen     = false;
let _cbSchedule = null;
let _cbSession  = null;
let _defIdx     = 0;

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
(async function initChatbot() {
    if (typeof Auth === 'undefined') return;
    _cbSession = Auth.getSession();
    if (!_cbSession || _cbSession.role !== 'student') return;

    try { _cbSchedule = await Auth.getSchedule(_cbSession.username); }
    catch { _cbSchedule = null; }

    document.body.insertAdjacentHTML('beforeend', buildHTML());

    document.getElementById('chatbot-toggle').addEventListener('click', toggleChat);
    document.getElementById('chatbot-close-btn').addEventListener('click', toggleChat);
    document.getElementById('chatbot-send').addEventListener('click', handleSend);
    document.getElementById('chatbot-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    document.getElementById('chatbot-input').addEventListener('input', autoResize);

    document.querySelectorAll('.cb-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            if (_cbOpen === false) toggleChat();
            document.getElementById('chatbot-input').value = btn.dataset.msg;
            handleSend();
        });
    });

    const name = _cbSession.prenom || 'طالب';
    appendBotMsg(`مرحباً ${name}! 👋\nأنا مساعدك في منصة مواهب المنان.\n\nيمكنني مساعدتك في:\n• جدول حصصك 📅\n• التنقل في المنصة 🧭\n• الواجبات والرسائل 📝\n\nاضغط على أحد الاختصارات أو اكتب سؤالك!`);
})();

/* ═══════════════════════════════════════════════════════════
   BUILD HTML
═══════════════════════════════════════════════════════════ */
function buildHTML() {
    const chips = QUICK_CHIPS.map(c =>
        `<button class="cb-chip" data-msg="${c.msg}">${c.label}</button>`
    ).join('');

    return `
    <button id="chatbot-toggle" aria-label="فتح المساعد">
        <span id="cb-icon">💬</span>
        <span class="cb-badge" id="cb-badge"></span>
    </button>

    <div id="chatbot-window" role="dialog" aria-label="المساعد الذكي">
        <div id="chatbot-header">
            <div class="cb-title">
                <div class="cb-avatar">🤖</div>
                <div>
                    <div class="cb-name">مساعد مواهب المنان</div>
                    <div class="cb-status">متاح دائماً ✓</div>
                </div>
            </div>
            <button class="cb-close" id="chatbot-close-btn" aria-label="إغلاق">✕</button>
        </div>
        <div id="chatbot-suggestions">${chips}</div>
        <div id="chatbot-messages"></div>
        <div id="chatbot-input-area">
            <button id="chatbot-send" aria-label="إرسال">➤</button>
            <textarea id="chatbot-input" rows="1" placeholder="اكتب سؤالك هنا..." dir="rtl"></textarea>
        </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   TOGGLE
═══════════════════════════════════════════════════════════ */
function toggleChat() {
    _cbOpen = !_cbOpen;
    document.getElementById('chatbot-window').classList.toggle('open', _cbOpen);
    document.getElementById('cb-icon').textContent = _cbOpen ? '✕' : '💬';
    if (_cbOpen) {
        document.getElementById('cb-badge').classList.remove('show');
        setTimeout(() => document.getElementById('chatbot-input').focus(), 250);
        scrollToBottom();
    }
}

/* ═══════════════════════════════════════════════════════════
   SEND + MATCHING
═══════════════════════════════════════════════════════════ */
function handleSend() {
    const input = document.getElementById('chatbot-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    appendUserMsg(text);

    // Délai naturel
    setTimeout(() => {
        const reply = getReply(text);
        appendBotMsg(reply);
    }, 400);
}

function getReply(text) {
    const normalized = text
        .toLowerCase()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ةت]/g, 'ت')
        .replace(/ى/g, 'ي');

    const name     = _cbSession?.prenom || '';
    const schedule = _cbSchedule && _cbSchedule !== 'لم يتم تحديد أوقات الحصص بعد.'
        ? _cbSchedule : null;

    for (const rule of RULES) {
        const match = rule.keys.some(k => {
            const kn = k.toLowerCase().replace(/[أإآا]/g, 'ا').replace(/[ةت]/g, 'ت').replace(/ى/g, 'ي');
            return normalized.includes(kn);
        });
        if (match) return rule.reply(schedule, name);
    }

    // Réponse par défaut (rotation)
    const reply = DEFAULT_REPLIES[_defIdx % DEFAULT_REPLIES.length];
    _defIdx++;
    return reply;
}

/* ═══════════════════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════════════════ */
function appendBotMsg(text) {
    const msgs = document.getElementById('chatbot-messages');
    const div  = document.createElement('div');
    div.className = 'cb-msg bot';
    // Convertir les sauts de ligne
    div.innerHTML = text.replace(/\n/g, '<br>');
    msgs.appendChild(div);
    scrollToBottom();
    if (!_cbOpen) {
        const badge = document.getElementById('cb-badge');
        badge.textContent = '';
        badge.classList.add('show');
    }
}

function appendUserMsg(text) {
    const msgs = document.getElementById('chatbot-messages');
    const div  = document.createElement('div');
    div.className = 'cb-msg user';
    div.textContent = text;
    msgs.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const msgs = document.getElementById('chatbot-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function autoResize() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
}
