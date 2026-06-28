/* ═══════════════════════════════════════════════════════════
   CHATBOT مواهب المنان
   Dépendances : auth.js chargé avant ce fichier
   Clé API     : remplace YOUR_API_KEY_HERE ci-dessous
═══════════════════════════════════════════════════════════ */

const CHATBOT_API_KEY = 'YOUR_API_KEY_HERE'; // 🔑 remplace ici

/* ── Suggestions rapides ── */
const QUICK_CHIPS = [
    { label: '📅 ما هو جدولي؟',        msg: 'ما هو جدول حصصي؟' },
    { label: '📖 كيف أشاهد سوري؟',      msg: 'كيف يمكنني مشاهدة تقدمي في السور؟' },
    { label: '📝 أين واجباتي؟',          msg: 'أين يمكنني مشاهدة الواجبات؟' },
    { label: '✉️ هل لدي رسائل؟',         msg: 'هل لدي رسائل من الإدارة؟' },
    { label: '❓ مساعدة',               msg: 'ماذا يمكنني أن أفعل في هذه المنصة؟' },
];

/* ── État ── */
let _cbOpen       = false;
let _cbLoading    = false;
let _cbHistory    = [];   // { role, content }[]
let _cbSchedule   = null;
let _cbSession    = null;

/* ═══════════════════════════════════════════════════════════
   INIT — appelé automatiquement au chargement
═══════════════════════════════════════════════════════════ */
(async function initChatbot() {
    // Vérifier session élève
    if (typeof Auth === 'undefined') return;
    _cbSession = Auth.getSession();
    if (!_cbSession || _cbSession.role !== 'student') return;

    // Charger l'horaire une fois
    try { _cbSchedule = await Auth.getSchedule(_cbSession.username); }
    catch { _cbSchedule = null; }

    // Injecter le HTML
    document.body.insertAdjacentHTML('beforeend', buildHTML());

    // Événements
    document.getElementById('chatbot-toggle').addEventListener('click', toggleChat);
    document.getElementById('chatbot-close-btn').addEventListener('click', toggleChat);
    document.getElementById('chatbot-send').addEventListener('click', handleSend);
    document.getElementById('chatbot-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    document.getElementById('chatbot-input').addEventListener('input', autoResize);

    // Chips
    document.querySelectorAll('.cb-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('chatbot-input').value = btn.dataset.msg;
            handleSend();
        });
    });

    // Message de bienvenue
    appendBotMsg(`مرحباً ${_cbSession.prenom}! 👋\nأنا مساعدك في منصة مواهب المنان. يمكنني مساعدتك في:\n• معرفة جدول حصصك\n• التنقل في المنصة\n• الإجابة على أسئلتك العامة\n\nكيف يمكنني مساعدتك اليوم؟`);
})();

/* ═══════════════════════════════════════════════════════════
   BUILD HTML
═══════════════════════════════════════════════════════════ */
function buildHTML() {
    const chips = QUICK_CHIPS.map(c =>
        `<button class="cb-chip" data-msg="${c.msg}">${c.label}</button>`
    ).join('');

    return `
    <!-- Bouton flottant -->
    <button id="chatbot-toggle" aria-label="فتح المساعد">
        <span id="cb-icon">💬</span>
        <span class="cb-badge" id="cb-badge"></span>
    </button>

    <!-- Fenêtre -->
    <div id="chatbot-window" role="dialog" aria-label="المساعد الذكي">
        <div id="chatbot-header">
            <div class="cb-title">
                <div class="cb-avatar">🤖</div>
                <div>
                    <div class="cb-name">مساعد مواهب المنان</div>
                    <div class="cb-status" id="cb-status-text">متاح الآن ✓</div>
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
   SEND
═══════════════════════════════════════════════════════════ */
async function handleSend() {
    if (_cbLoading) return;
    const input = document.getElementById('chatbot-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    autoResize.call(input);

    // Afficher message utilisateur
    appendUserMsg(text);

    // Ajouter à l'historique
    _cbHistory.push({ role: 'user', content: text });

    // Typing indicator
    const typingId = showTyping();
    setLoading(true);

    try {
        const reply = await callClaude(_cbHistory);
        hideTyping(typingId);
        appendBotMsg(reply);
        _cbHistory.push({ role: 'assistant', content: reply });

        // Garder l'historique à 20 messages max
        if (_cbHistory.length > 20) _cbHistory = _cbHistory.slice(-20);
    } catch (err) {
        hideTyping(typingId);
        appendBotMsg('عذراً، حدث خطأ في الاتصال. حاول مجدداً. 🔄');
        console.error('[Chatbot]', err);
    }

    setLoading(false);
}

/* ═══════════════════════════════════════════════════════════
   API CLAUDE
═══════════════════════════════════════════════════════════ */
async function callClaude(history) {
    const systemPrompt = buildSystemPrompt();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            system: systemPrompt,
            messages: history
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || 'API error ' + response.status);
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'لم أتمكن من الإجابة، حاول مجدداً.';
}

/* ═══════════════════════════════════════════════════════════
   SYSTEM PROMPT
═══════════════════════════════════════════════════════════ */
function buildSystemPrompt() {
    const name     = _cbSession ? `${_cbSession.prenom} ${_cbSession.nom || ''}`.trim() : 'الطالب';
    const username = _cbSession?.username || '';
    const schedule = _cbSchedule && _cbSchedule !== 'لم يتم تحديد أوقات الحصص بعد.'
        ? _cbSchedule
        : 'لم يتم تحديد الجدول بعد، يرجى التواصل مع الإدارة.';

    return `أنت مساعد ذكي لمنصة "مواهب المنان" التعليمية، وهي منصة تابعة لجمعية مواهب المنان - دار القرآن والحديث.

معلومات الطالب الحالي:
- الاسم: ${name}
- اسم المستخدم: ${username}
- جدول الحصص: ${schedule}

دورك:
- الإجابة على أسئلة الطالب باللغة العربية الفصحى البسيطة
- مساعدته في التنقل داخل المنصة
- إخباره بجدول حصصه عند السؤال
- شرح ميزات المنصة بوضوح

المنصة تحتوي على:
• لوحة التحكم (dashboard.html): تقدم السور، الواجبات، الرسائل
• الملف الشخصي (profil.html): معلومات الحساب، الجدول الشخصي
• صفحة الأولياء (parent.html): معلومات خاصة بأولياء الأمور

قواعد مهمة:
- لا تتحدث عن تفسير القرآن أو الأحاديث في هذه المرحلة
- إذا سُئلت عن شيء خارج نطاقك قل بلطف أنك غير متاح لذلك حالياً
- كن مختصراً وودوداً، استخدم إيموجي باعتدال
- لا تخترع معلومات غير موجودة في ما زودتك به`;
}

/* ═══════════════════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════════════════ */
function appendBotMsg(text) {
    const msgs = document.getElementById('chatbot-messages');
    const div  = document.createElement('div');
    div.className = 'cb-msg bot';
    div.textContent = text;
    msgs.appendChild(div);
    scrollToBottom();
    // Badge si fenêtre fermée
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

function showTyping() {
    const msgs = document.getElementById('chatbot-messages');
    const div  = document.createElement('div');
    div.className = 'cb-typing';
    div.id = 'cb-typing-' + Date.now();
    div.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(div);
    scrollToBottom();
    return div.id;
}

function hideTyping(id) {
    document.getElementById(id)?.remove();
}

function setLoading(val) {
    _cbLoading = val;
    document.getElementById('chatbot-send').disabled = val;
    document.getElementById('cb-status-text').textContent = val ? 'يكتب...' : 'متاح الآن ✓';
}

function scrollToBottom() {
    const msgs = document.getElementById('chatbot-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function autoResize() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
}
