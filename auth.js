// auth.js - VERSION CORRIGÉE (trim anti-espaces)
const Auth = (() => {
    const supabaseUrl = 'https://mdgofogpghlwesaduxrq.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZ29mb2dwZ2hsd2VzYWR1eHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjIwNjksImV4cCI6MjA5NzQzODA2OX0.DpBoUIZbxzKjOOWw4r-7Vhtupva_fIg5cEhcKgb19ic';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const SESSION_KEY = 'quran_session';
    const ACCOUNTS_KEY = 'mawahib_saved_accounts';

    // --- GESTION DE LA SESSION LOCALE ---
    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
        catch { return null; }
    }

    function _readSavedAccounts() {
        try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); }
        catch { return []; }
    }

    function _writeSavedAccounts(accounts) {
        const unique = [];
        const seen = new Set();
        accounts.forEach(account => {
            if (!account || !account.username || seen.has(account.username)) return;
            seen.add(account.username);
            unique.push(account);
        });
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(unique.slice(0, 12)));
    }

    function _rememberAccount(session) {
        const accounts = _readSavedAccounts().filter(account => account.username !== session.username);
        accounts.unshift({ ...session, lastUsedAt: new Date().toISOString() });
        _writeSavedAccounts(accounts);
    }

    function _setSession(username, prenom, nomOrClasse, role = 'student') {
        const session = { username, prenom, nom: nomOrClasse, role };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        _rememberAccount(session);
    }

    function getSavedAccounts() {
        return _readSavedAccounts();
    }

    function switchAccount(username) {
        const account = _readSavedAccounts().find(item => item.username === username);
        if (!account) return false;
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: account.username, prenom: account.prenom, nom: account.nom, role: account.role }));
        _rememberAccount(account);
        return true;
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    function requireAuth(redirectTo = 'login.html') {
        if (!getSession()) { window.location.href = redirectTo; return false; }
        return true;
    }

    // ✅ _genId : trim() sur les deux paramètres pour éviter les espaces parasites
    function _genId(str1, str2) {
        return (str1.trim() + '.' + str2.trim())
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_');
    }

    function logError(context, error) {
        console.error(`[${context}]`, error);
    }

    // --- 1. ÉLÈVES ---
    async function register(prenom, nom, password, bypassSession = false) {
        // ✅ trim() en entrée de fonction
        prenom   = prenom.trim();
        nom      = nom.trim();
        password = password.trim();

        if (!prenom || !nom || !password) return { ok: false, error: 'يرجى ملء جميع الحقول' };
        if (password.length < 4) return { ok: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' };

        const username = _genId(prenom, nom);
        const { error } = await supabase.from('eleves').insert([{
            username, prenom, nom, password: btoa(password), is_suspended: false
        }]);

        if (error) {
            logError('register', error);
            return { ok: false, error: error.code === '23505' ? 'هذا الاسم مستخدم بالفعل' : 'خطأ في التسجيل: ' + error.message };
        }

        if (!bypassSession) _setSession(username, prenom, nom, 'student');
        return { ok: true, username };
    }

    async function login(prenom, nom, password) {
        // ✅ trim() en entrée de fonction
        prenom   = prenom.trim();
        nom      = nom.trim();
        password = password.trim();

        if (!prenom || !nom || !password) return { ok: false, error: 'يرجى ملء جميع الحقول' };
        const username = _genId(prenom, nom);
        const { data, error } = await supabase.from('eleves').select('*').eq('username', username).single();

        if (error) {
            logError('login', error);
            return { ok: false, error: 'خطأ: ' + (error.message || 'فشل الاتصال بالخادم') };
        }
        if (!data) return { ok: false, error: 'لم يتم العثور على هذا الحساب' };
        if (data.is_suspended) return { ok: false, error: '⚠️ هذا الحساب مغلق حالياً' };
        if (data.password !== btoa(password)) return { ok: false, error: 'كلمة المرور غير صحيحة' };

        _setSession(username, data.prenom, data.nom, 'student');
        return { ok: true, username };
    }

    // --- 2. PROFESSEURS ---
    async function registerProf(prenom, classe, password) {
        // ✅ trim() en entrée de fonction
        prenom   = prenom.trim();
        classe   = classe.trim();
        password = password.trim();

        if (!prenom || !classe || !password) return { ok: false, error: 'يرجى ملء جميع الحقول' };
        const username = _genId(prenom, classe);
        const { error } = await supabase.from('profs').insert([{
            username, prenom, classe, password: btoa(password), students: []
        }]);

        if (error) {
            logError('registerProf', error);
            return { ok: false, error: 'هذا الأستاذ مسجل بالفعل أو حدث خطأ' };
        }
        return { ok: true, username };
    }

    async function loginProf(prenom, classe, password) {
        // ✅ trim() en entrée de fonction
        prenom   = prenom.trim();
        classe   = classe.trim();
        password = password.trim();

        const username = _genId(prenom, classe);
        const { data, error } = await supabase.from('profs').select('*').eq('username', username).single();

        if (error) {
            logError('loginProf', error);
            return { ok: false, error: 'خطأ في الاتصال: ' + error.message };
        }
        if (!data) return { ok: false, error: 'لم يتم العثور على حساب الأستاذ' };
        if (data.password !== btoa(password)) return { ok: false, error: 'كلمة المرور غير صحيحة' };

        _setSession(username, data.prenom, data.classe, 'prof');
        return { ok: true, username };
    }

    // --- 3. FONCTIONS ADMINISTRATEUR ---
    async function getAllStudents() {
        const [elevesRes, progsRes, msgsRes, profilsRes, devoirsRes, horairesRes] = await Promise.all([
            supabase.from('eleves').select('*'),
            supabase.from('progressions').select('*'),
            supabase.from('messages').select('*'),
            supabase.from('profils_admin').select('*'),
            supabase.from('devoirs').select('*'),
            supabase.from('horaires').select('*')
        ]);

        const errors = { e1: elevesRes.error, e2: progsRes.error, e3: msgsRes.error, e4: profilsRes.error, e5: devoirsRes.error, e6: horairesRes.error };
        if (Object.values(errors).some(Boolean)) logError('getAllStudents', errors);

        const progs = progsRes.data || [];
        const msgs = msgsRes.data || [];
        const profils = profilsRes.data || [];
        const devoirs = devoirsRes.data || [];
        const horaires = horairesRes.data || [];
        const profilMap = {};
        profils.forEach(p => { profilMap[p.username] = p; });
        const scheduleMap = {};
        horaires.forEach(h => { scheduleMap[h.username] = h.schedule_text || ''; });

        return (elevesRes.data || []).map(e => {
            const userProgs = progs.filter(p => p.username === e.username);
            const progressDict = {};
            userProgs.forEach(p => progressDict[p.surah_id] = {
                activities: p.activities || {},
                completedAt: p.completed_at || null,
                globalScore: p.global_score ?? null,
                updatedAt: p.updated_at || p.completed_at || null
            });
            const profile = profilMap[e.username] || {};
            const payments = Array.isArray(profile.payments) ? profile.payments : [];
            return {
                username: e.username,
                prenom: e.prenom,
                nom: e.nom,
                isSuspended: Boolean(e.is_suspended),
                createdAt: e.created_at,
                progress: progressDict,
                messages: msgs.filter(m => m.username === e.username).sort((a, b) => (b.id || 0) - (a.id || 0)),
                devoirs: devoirs.filter(d => d.student_id === e.username),
                scheduleText: scheduleMap[e.username] || '',
                cinProvided: Boolean(profile.cin_provided),
                birthCertProvided: Boolean(profile.birth_cert_provided),
                payments
            };
        });
    }

    async function getAllUsers() {
        const students = await getAllStudents();
        const dict = {};
        students.forEach(e => { dict[e.username] = e; });
        return dict;
    }

    async function getProfs() {
        const { data, error } = await supabase.from('profs').select('*');
        if (error) logError('getProfs', error);
        const dict = {};
        (data || []).forEach(p => dict[p.username] = p);
        return dict;
    }

    // --- 4. GESTION ET SUPPRESSION ---
    async function deleteStudent(username) {
        await supabase.from('eleves').delete().eq('username', username);
        await supabase.from('progressions').delete().eq('username', username);
        await supabase.from('devoirs').delete().eq('student_id', username);
        await supabase.from('horaires').delete().eq('username', username);
        await supabase.from('messages').delete().eq('username', username);
        await supabase.from('profils_admin').delete().eq('username', username);
    }

    async function deleteProf(username) {
        await supabase.from('profs').delete().eq('username', username);
        await supabase.from('devoirs').delete().eq('prof_id', username);
    }

    async function toggleSuspension(username) {
        const { data, error } = await supabase.from('eleves').select('is_suspended').eq('username', username).single();
        if (error) { logError('toggleSuspension', error); return; }
        if (data) await supabase.from('eleves').update({ is_suspended: !data.is_suspended }).eq('username', username);
    }

    async function assignStudentToProf(profId, studentId) {
        const { data, error } = await supabase.from('profs').select('students').eq('username', profId).single();
        if (error) { logError('assignStudentToProf', error); return; }
        let students = data?.students || [];
        if (!students.includes(studentId)) {
            students.push(studentId);
            await supabase.from('profs').update({ students }).eq('username', profId);
        }
    }

    async function removeStudentFromProf(profId, studentId) {
        const { data, error } = await supabase.from('profs').select('students').eq('username', profId).single();
        if (error) { logError('removeStudentFromProf', error); return; }
        if (data) {
            let students = data.students.filter(id => id !== studentId);
            await supabase.from('profs').update({ students }).eq('username', profId);
        }
    }

    // --- 5. HORAIRES ---
    async function getSchedule(username) {
        const { data, error } = await supabase.from('horaires').select('schedule_text').eq('username', username).single();
        if (error) logError('getSchedule', error);
        return data ? data.schedule_text : "لم يتم تحديد أوقات الحصص بعد.";
    }

    async function setSchedule(username, schedule_text) {
        const { error } = await supabase.from('horaires').upsert([{ username, schedule_text }]);
        if (error) logError('setSchedule', error);
    }

    // --- 6. MESSAGES ---
    async function getMessages(username) {
        const { data, error } = await supabase.from('messages').select('*').eq('username', username).order('id', { ascending: false });
        if (error) logError('getMessages', error);
        return data || [];
    }

    async function sendMessage(username, text) {
        const date = new Date().toLocaleDateString('ar-MA', { day: 'numeric', month: 'long' });
        const { error } = await supabase.from('messages').insert([{ username, text, date }]);
        if (error) logError('sendMessage', error);
    }

    async function deleteMessageById(id) {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) logError('deleteMessageById', error);
    }

    async function clearMessages(username) {
        const { error } = await supabase.from('messages').delete().eq('username', username);
        if (error) logError('clearMessages', error);
    }

    async function sendAdminReport(profId, profName, classe, text, category = 'متابعة') {
        const date = new Date().toLocaleDateString('ar-MA', { day: 'numeric', month: 'long' });
        const body = '[SIGNAL_ADMIN] ' + JSON.stringify({ profId, profName, classe, category, text, sentAt: new Date().toISOString() });
        const { error } = await supabase.from('messages').insert([{ username: '__admin__', text: body, date }]);
        if (error) { logError('sendAdminReport', error); return { ok: false, error: error.message }; }
        return { ok: true };
    }

    async function getAdminReports() {
        const { data, error } = await supabase.from('messages').select('*').eq('username', '__admin__').order('id', { ascending: false });
        if (error) { logError('getAdminReports', error); return []; }
        return (data || []).map(row => {
            const raw = row.text || '';
            if (raw.startsWith('[SIGNAL_ADMIN] ')) {
                try { return { id: row.id, date: row.date, ...JSON.parse(raw.replace('[SIGNAL_ADMIN] ', '')) }; }
                catch (e) {}
            }
            return { id: row.id, date: row.date, profName: 'أستاذ', classe: '', category: 'متابعة', text: raw, sentAt: row.created_at || '' };
        });
    }

    // --- 7. PROFILS ADMINISTRATIFS ---
    async function getProfile(username) {
        const { data, error } = await supabase.from('profils_admin').select('*').eq('username', username).single();
        if (error && error.code !== 'PGRST116') logError('getProfile', error);
        return data
            ? { cinProvided: data.cin_provided, birthCertProvided: data.birth_cert_provided, payments: data.payments || [] }
            : { cinProvided: false, birthCertProvided: false, payments: [] };
    }

    async function updateProfile(username, profileData) {
        const { error } = await supabase.from('profils_admin').upsert([{
            username,
            cin_provided: profileData.cinProvided,
            birth_cert_provided: profileData.birthCertProvided,
            payments: profileData.payments
        }]);
        if (error) logError('updateProfile', error);
    }

    // --- 8. PROGRESSIONS ---
    async function getProgress(username) {
        const { data, error } = await supabase.from('progressions').select('*').eq('username', username);
        if (error) logError('getProgress', error);
        const res = {};
        (data || []).forEach(p => res[p.surah_id] = {
            activities: p.activities || {},
            completedAt: p.completed_at,
            globalScore: p.global_score
        });
        return res;
    }

    async function recordActivity(surahId, activityKey, score) {
        const session = getSession(); if (!session) return;
        const { data, error } = await supabase.from('progressions').select('activities')
            .eq('username', session.username).eq('surah_id', surahId).single();
        if (error && error.code !== 'PGRST116') logError('recordActivity', error);
        let activities = data?.activities || {};
        if (!activities[activityKey] || score > activities[activityKey].score) {
            activities[activityKey] = { score, date: new Date().toISOString() };
            await supabase.from('progressions').upsert([{ username: session.username, surah_id: surahId, activities }]);
        }
    }

    async function completeSurah(surahId) {
        const session = getSession(); if (!session) return;
        const { data, error } = await supabase.from('progressions').select('activities')
            .eq('username', session.username).eq('surah_id', surahId).single();
        if (error && error.code !== 'PGRST116') logError('completeSurah', error);
        const activities = data?.activities || {};
        const scores = Object.values(activities).map(a => a.score);
        const globalScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
        await supabase.from('progressions').upsert([{
            username: session.username, surah_id: surahId, activities,
            completed_at: new Date().toISOString(), global_score: globalScore
        }]);
    }

    // --- 9. DEVOIRS ---
    async function ajouterDevoir(studentId, profName, surate, ayaDebut, ayaFin, dateLimite) {
        const session = getSession();
        const id = 'dev_' + Date.now() + Math.floor(Math.random() * 1000);
        const { error } = await supabase.from('devoirs').insert([{
            id, student_id: studentId, prof_name: profName,
            surate, aya_debut: ayaDebut, aya_fin: ayaFin,
            date_limite: dateLimite, statut: 'en_attente', prof_id: session.username
        }]);
        if (error) { logError('ajouterDevoir', error); return { ok: false, error: error.message }; }
        return { ok: true };
    }

    async function getDevoirs(role, username) {
        const field = role === 'prof' ? 'prof_id' : 'student_id';
        const { data, error } = await supabase.from('devoirs').select('*').eq(field, username).order('date_limite', { ascending: true });
        if (error) logError('getDevoirs', error);
        return data || [];
    }

    async function annulerDevoir(id) {
        const { error } = await supabase.from('devoirs').delete().eq('id', id);
        if (error) logError('annulerDevoir', error);
    }

    async function marquerDevoirTermine(id) {
        const { error } = await supabase.from('devoirs').update({ statut: 'termine' }).eq('id', id);
        if (error) logError('marquerDevoirTermine', error);
    }

    function getSupabaseClient() { return supabase; }

    return {
        register, login, registerProf, loginProf, logout, getSession, getSavedAccounts, switchAccount, requireAuth,
        getAllStudents, getAllUsers, getProfs, deleteStudent, deleteProf, toggleSuspension,
        assignStudentToProf, removeStudentFromProf,
        getSchedule, setSchedule, getMessages, sendMessage, deleteMessageById, clearMessages, sendAdminReport, getAdminReports,
        getProfile, updateProfile, getProgress, recordActivity, completeSurah,
        ajouterDevoir, getDevoirs, annulerDevoir, marquerDevoirTermine,
        getSupabaseClient
    };
})();
