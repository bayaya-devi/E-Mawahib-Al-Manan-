// auth.js - VERSION CORRIGÉE (trim anti-espaces)
const Auth = (() => {
    const supabaseUrl = 'https://mdgofogpghlwesaduxrq.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZ29mb2dwZ2hsd2VzYWR1eHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjIwNjksImV4cCI6MjA5NzQzODA2OX0.DpBoUIZbxzKjOOWw4r-7Vhtupva_fIg5cEhcKgb19ic';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const SESSION_KEY = 'quran_session';
    const ACCOUNTS_KEY = 'mawahib_saved_accounts';
    const REWARDS_KEY_PREFIX = 'mawahib_rewards_';
    const CELEBRATION_KEY = 'mawahib_last_celebration';
    const INACTIVITY_KEY = 'mawahib_last_inactivity';
    const OFFLINE_CACHE_PREFIX = 'mawahib_offline_cache_';
    const OFFLINE_QUEUE_KEY = 'mawahib_offline_queue';
    const OFFLINE_STATUS_KEY = 'mawahib_offline_status';
    const SERVICE_WORKER_VERSION = '20260714-total-crash-1';
    const CLASS_SESSION_PREFIX = '[CLASS_SESSION] ';
    const TEACHER_NOTE_PREFIX = '[TEACHER_NOTE] ';
    const ADMIN_FINANCE_PREFIX = '[ADMIN_FINANCE] ';
    const SURAH_ID_ALIASES = {
        'al-zalzala': 'al-zalzala',
        'al-zalzalah': 'al-zalzala',
        'az-zalzalah': 'al-zalzala',
        'bayina': 'al-bayyina',
        'al-bayina': 'al-bayyina',
        'al-kadr': 'al-qadr',
        'qaria': 'al-qaria',
        'fil': 'al-fil'
    };

    function _registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            const refreshKey = 'mawahib_sw_refresh_' + SERVICE_WORKER_VERSION;
            if (refreshing || sessionStorage.getItem(refreshKey) === '1') return;
            refreshing = true;
            sessionStorage.setItem(refreshKey, '1');
            window.location.reload();
        });
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register(
                    'sw.js?v=' + SERVICE_WORKER_VERSION,
                    { updateViaCache: 'none' }
                );
                if (registration && typeof registration.update === 'function') {
                    await registration.update();
                }
            } catch (error) {
                logError('serviceWorker', error);
            }
        });
    }

    _registerServiceWorker();

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

    async function switchAccount(username) {
        const account = _readSavedAccounts().find(item => item.username === username);
        if (!account) return false;
        if (!_isOnline()) {
            _setSession(account.username, account.prenom || '', account.nom || '', account.role || 'student');
            return true;
        }
        const table = account.role === 'prof' ? 'profs' : 'eleves';
        const { data, error } = await supabase.from(table).select('*').eq('username', account.username).maybeSingle();
        if (error || !data || data.is_suspended) {
            _writeSavedAccounts(_readSavedAccounts().filter(item => item.username !== username));
            return false;
        }
        const nom = account.role === 'prof' ? data.classe : data.nom;
        _setSession(data.username, data.prenom, nom, account.role || 'student');
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
        return _cleanName(str1) + '.' + _cleanName(str2);
    }

    function _cleanName(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/['’`´]/g, '')
            .replace(/[^a-z0-9\u0600-\u06FF]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function _legacyGenId(str1, str2) {
        return (String(str1 || '').trim() + '.' + String(str2 || '').trim())
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_');
    }

    function _candidateUsernames(str1, str2) {
        const clean1 = _cleanName(str1);
        const clean2 = _cleanName(str2);
        const raw1 = String(str1 || '').trim().toLowerCase();
        const raw2 = String(str2 || '').trim().toLowerCase();
        return Array.from(new Set([
            _genId(str1, str2),
            _legacyGenId(str1, str2),
            clean1 + clean2,
            clean1 + '_' + clean2,
            clean1 + '-' + clean2,
            raw1 + '.' + raw2,
            raw1 + '_' + raw2
        ].filter(Boolean)));
    }

    function _encodePassword(password) {
        const clean = String(password || '').trim();
        if (window.TextEncoder) {
            const bytes = new TextEncoder().encode(clean);
            let binary = '';
            bytes.forEach(byte => { binary += String.fromCharCode(byte); });
            return btoa(binary);
        }
        return btoa(unescape(encodeURIComponent(clean)));
    }

    function _passwordMatches(stored, password) {
        if (!stored) return false;
        const clean = String(password || '').trim();
        const candidates = [_encodePassword(clean), clean];
        try { candidates.push(btoa(clean)); } catch (error) {}
        if (candidates.includes(stored)) return true;
        try { if (decodeURIComponent(escape(atob(stored))) === clean) return true; } catch (error) {}
        try { if (atob(stored) === clean) return true; } catch (error) {}
        return false;
    }

    function _sameIdentity(row, field2, value1, value2) {
        return _cleanName(row?.prenom) === _cleanName(value1) && _cleanName(row?.[field2]) === _cleanName(value2);
    }

    async function _findLoginRow(table, secondField, value1, value2) {
        const usernames = _candidateUsernames(value1, value2);
        const { data: matches, error } = await supabase.from(table).select('*').in('username', usernames);
        if (error) return { data: null, error };
        const byUsername = usernames.map(username => (matches || []).find(row => row.username === username)).find(Boolean);
        if (byUsername) return { data: byUsername, error: null };

        const { data: fallbackRows, error: fallbackError } = await supabase.from(table).select('*')
            .ilike('prenom', String(value1 || '').trim())
            .ilike(secondField, String(value2 || '').trim());
        if (fallbackError) return { data: null, error: fallbackError };
        const byIdentity = (fallbackRows || []).find(row => _sameIdentity(row, secondField, value1, value2));
        return { data: byIdentity || null, error: null };
    }

    function normalizeSurahId(surahId) {
        const id = String(surahId || '').trim().toLowerCase().replace(/_/g, '-');
        return SURAH_ID_ALIASES[id] || id;
    }

    function _progressAliases(surahId) {
        const normalized = normalizeSurahId(surahId);
        const aliases = new Set([normalized, String(surahId || '').trim(), String(surahId || '').trim().replace(/_/g, '-')]);
        Object.entries(SURAH_ID_ALIASES).forEach(([from, to]) => {
            if (to === normalized) aliases.add(from);
        });
        return Array.from(aliases).filter(Boolean);
    }

    function _rememberProgressAliases(result, row) {
        const value = {
            activities: row.activities || {},
            completedAt: row.completed_at || null,
            completed_at: row.completed_at || null,
            is_completed: Boolean(row.completed_at),
            globalScore: row.global_score ?? null,
            global_score: row.global_score ?? null,
            score: row.global_score ?? null,
            updatedAt: row.updated_at || row.completed_at || null
        };
        _progressAliases(row.surah_id).forEach(alias => {
            const existing = result[alias] || {};
            result[alias] = {
                ...existing,
                ...value,
                activities: { ...(existing.activities || {}), ...(value.activities || {}) },
                completedAt: existing.completedAt || value.completedAt,
                completed_at: existing.completed_at || value.completed_at,
                is_completed: Boolean(existing.is_completed || value.is_completed),
                globalScore: Math.max(Number(existing.globalScore || 0), Number(value.globalScore || 0)),
                global_score: Math.max(Number(existing.global_score || 0), Number(value.global_score || 0)),
                score: Math.max(Number(existing.score || 0), Number(value.score || 0)),
                updatedAt: existing.updatedAt || value.updatedAt
            };
        });
    }

    function logError(context, error) {
        console.error(`[${context}]`, error);
    }

    function _isOnline() {
        return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    }

    function _safeJsonRead(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function _safeJsonWrite(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (error) { logError('localStorage', error); }
    }

    function _offlineCacheKey(username, scope) {
        return OFFLINE_CACHE_PREFIX + String(username || 'guest') + '_' + scope;
    }

    function _readOfflineCache(username, scope, fallback) {
        return _safeJsonRead(_offlineCacheKey(username, scope), fallback);
    }

    function _writeOfflineCache(username, scope, value) {
        _safeJsonWrite(_offlineCacheKey(username, scope), value);
    }

    function _readOfflineQueue() {
        return _safeJsonRead(OFFLINE_QUEUE_KEY, []);
    }

    function _writeOfflineQueue(queue) {
        _safeJsonWrite(OFFLINE_QUEUE_KEY, queue);
        _setOfflineStatus(queue.length ? 'pending' : (_isOnline() ? 'synced' : 'offline'));
    }

    function _setOfflineStatus(status) {
        const payload = { status, online: _isOnline(), pending: _readOfflineQueue().length, updatedAt: new Date().toISOString() };
        _safeJsonWrite(OFFLINE_STATUS_KEY, payload);
        window.dispatchEvent(new CustomEvent('mawahib:offline-status', { detail: payload }));
    }

    function getOfflineStatus() {
        return _safeJsonRead(OFFLINE_STATUS_KEY, { status: _isOnline() ? 'synced' : 'offline', online: _isOnline(), pending: _readOfflineQueue().length });
    }

    function _queueOfflineMutation(type, payload) {
        const queue = _readOfflineQueue();
        const key = type + ':' + (payload.username || payload.studentId || '') + ':' + (payload.surahId || payload.id || payload.activityKey || Date.now());
        const item = { key, type, payload, createdAt: new Date().toISOString(), attempts: 0 };
        const filtered = queue.filter(existing => existing.key !== key);
        filtered.push(item);
        _writeOfflineQueue(filtered);
        return item;
    }

    function _mergeProgressCache(username, surahId, patch) {
        const normalizedId = normalizeSurahId(surahId);
        const cache = _readOfflineCache(username, 'progress', {});
        const current = cache[normalizedId] || {};
        const merged = {
            ...current,
            ...patch,
            activities: { ...(current.activities || {}), ...(patch.activities || {}) },
            updatedAt: patch.updatedAt || new Date().toISOString()
        };
        _progressAliases(normalizedId).forEach(alias => { cache[alias] = merged; });
        _writeOfflineCache(username, 'progress', cache);
        return merged;
    }

    function _cacheList(username, scope, rows) {
        if (Array.isArray(rows)) _writeOfflineCache(username, scope, rows);
        return rows || [];
    }

    function _updateCachedDevoir(username, id, patch) {
        const cached = _readOfflineCache(username, 'devoirs_student', []);
        const updated = cached.map(item => item && item.id === id ? { ...item, ...patch } : item);
        _writeOfflineCache(username, 'devoirs_student', updated);
    }

    async function _syncQueuedItem(item) {
        const payload = item.payload || {};
        if (item.type === 'recordActivity') {
            const { data: current, error: readError } = await supabase.from('progressions')
                .select('activities').eq('username', payload.username).eq('surah_id', payload.surahId).maybeSingle();
            if (readError && readError.code !== 'PGRST116') throw readError;
            const { error } = await supabase.from('progressions').upsert([{
                username: payload.username,
                surah_id: payload.surahId,
                activities: { ...(current?.activities || {}), ...(payload.activities || {}) }
            }]);
            if (error) throw error;
        }
        if (item.type === 'completeSurah') {
            const { data: current, error: readError } = await supabase.from('progressions')
                .select('activities,completed_at,global_score').eq('username', payload.username).eq('surah_id', payload.surahId).maybeSingle();
            if (readError && readError.code !== 'PGRST116') throw readError;
            const { error } = await supabase.from('progressions').upsert([{
                username: payload.username,
                surah_id: payload.surahId,
                activities: { ...(current?.activities || {}), ...(payload.activities || {}) },
                completed_at: current?.completed_at || payload.completedAt,
                global_score: Math.max(Number(current?.global_score || 0), Number(payload.globalScore || 100))
            }]);
            if (error) throw error;
        }
        if (item.type === 'homeworkDone') {
            const { error } = await supabase.from('devoirs').update({ statut: 'termine' }).eq('id', payload.id);
            if (error) throw error;
        }
        if (item.type === 'teacherNote') {
            const { error } = await supabase.from('messages').insert([payload.row]);
            if (error) throw error;
        }
    }

    async function syncOfflineQueue() {
        if (!_isOnline()) { _setOfflineStatus('offline'); return { ok: false, pending: _readOfflineQueue().length }; }
        const queue = _readOfflineQueue();
        if (!queue.length) { _setOfflineStatus('synced'); return { ok: true, pending: 0 }; }
        _setOfflineStatus('syncing');
        const failed = [];
        for (const item of queue) {
            try { await _syncQueuedItem(item); }
            catch (error) { failed.push({ ...item, attempts: (item.attempts || 0) + 1, lastError: error.message || String(error) }); }
        }
        _writeOfflineQueue(failed);
        _setOfflineStatus(failed.length ? 'pending' : 'synced');
        return { ok: failed.length === 0, pending: failed.length };
    }

    window.addEventListener('online', () => syncOfflineQueue());
    window.addEventListener('offline', () => _setOfflineStatus('offline'));
    setTimeout(() => _setOfflineStatus(_isOnline() ? (_readOfflineQueue().length ? 'pending' : 'synced') : 'offline'), 0);

    function _todayKey(date = new Date()) {
        return date.toISOString().slice(0, 10);
    }

    function _daysBetween(from, to = new Date()) {
        if (!from) return 0;
        const start = new Date(String(from).slice(0, 10) + 'T00:00:00');
        const end = new Date(_todayKey(to) + 'T00:00:00');
        return Math.max(0, Math.floor((end - start) / 86400000));
    }

    function _rewardKey(username) {
        return REWARDS_KEY_PREFIX + username;
    }

    function _readRewardState(username) {
        const fallback = {
            stars: 0,
            totalEarned: 0,
            totalLost: 0,
            streak: 0,
            bestStreak: 0,
            completed: {},
            lastActivity: null,
            decayPeriodsApplied: 0,
            lastDecayAt: null
        };
        try {
            return { ...fallback, ...(JSON.parse(localStorage.getItem(_rewardKey(username)) || '{}')) };
        } catch {
            return fallback;
        }
    }

    function _writeRewardState(username, state) {
        localStorage.setItem(_rewardKey(username), JSON.stringify(state));
    }

    function _applyStarDecay(state) {
        if (!state.lastActivity) return { state, lost: 0 };
        const inactiveDays = _daysBetween(state.lastActivity);
        const periods = Math.floor(inactiveDays / 7);
        const alreadyApplied = state.decayPeriodsApplied || 0;
        if (periods <= alreadyApplied) return { state, lost: 0 };
        const newPeriods = periods - alreadyApplied;
        const lost = Math.min(state.stars || 0, newPeriods * 2, 8);
        if (lost > 0) {
            state.stars = Math.max(0, (state.stars || 0) - lost);
            state.totalLost = (state.totalLost || 0) + lost;
            state.lastDecayAt = new Date().toISOString();
        }
        state.decayPeriodsApplied = periods;
        return { state, lost, inactiveDays, periods };
    }

    function _buildInactivityVariant(decay, state) {
        const days = decay.inactiveDays || 0;
        const lost = decay.lost || 0;
        if (days >= 90) return 'reset';
        if (days >= 60) return 'long-pause';
        if (days >= 30) return 'restart';
        if (days >= 21) return 'return-plan';
        if (days >= 14) return 'wake-up';
        if (lost >= 8) return 'heavy';
        if (lost >= 6) return 'medium';
        if ((state.stars || 0) <= 5) return 'protect';
        if ((state.streak || 0) === 0) return 'fresh';
        return 'soft';
    }

    function _storeInactivityPayload(decay, state) {
        if (!decay || !decay.lost) return null;
        const payload = {
            variant: _buildInactivityVariant(decay, state),
            lost: decay.lost || 0,
            inactiveDays: decay.inactiveDays || 0,
            stars: state.stars || 0,
            totalLost: state.totalLost || 0,
            lastActivity: state.lastActivity || null,
            createdAt: new Date().toISOString()
        };
        try { sessionStorage.setItem(INACTIVITY_KEY, JSON.stringify(payload)); } catch (error) {}
        return payload;
    }

    function _getSurahMeta(surahId) {
        const normalizedId = normalizeSurahId(surahId);
        if (typeof SURAH_REGISTRY !== 'undefined' && Array.isArray(SURAH_REGISTRY)) {
            const found = SURAH_REGISTRY.find(s => normalizeSurahId(s.id) === normalizedId);
            if (found) return found;
        }
        if (typeof verses !== 'undefined' && Array.isArray(verses)) {
            return { id: normalizedId, ayat: verses.length, nameAr: normalizedId, file: location.pathname.split('/').pop() };
        }
        return { id: normalizedId, ayat: 20, nameAr: normalizedId, file: location.pathname.split('/').pop() };
    }

    function _starsForSurah(meta) {
        const ayat = Number(meta?.ayat || 20);
        if (ayat <= 10) return 3;
        if (ayat <= 50) return 5;
        return 8;
    }

    function _getNextSurahFile(surahId) {
        if (typeof SURAH_REGISTRY === 'undefined' || !Array.isArray(SURAH_REGISTRY)) return 'dashboard.html';
        const order = SURAH_REGISTRY.filter(s => s.available).sort((a, b) => b.num - a.num);
        const index = order.findIndex(s => normalizeSurahId(s.id) === normalizeSurahId(surahId));
        return index >= 0 && order[index + 1] ? order[index + 1].file : 'dashboard.html';
    }

    function _buildCelebrationVariant(state, points, meta, wasComeback) {
        const completedCount = Object.keys(state.completed || {}).length;
        if (completedCount === 1) return 'first';
        if (wasComeback) return 'comeback';
        if ((state.streak || 0) >= 7) return 'streak';
        if (completedCount >= 50) return 'elite';
        if (completedCount >= 20) return 'mastery';
        if (completedCount >= 12) return 'deep-focus';
        if (completedCount >= 8) return 'momentum';
        if (completedCount % 4 === 0) return 'checkpoint';
        if (points >= 8) return 'major';
        return 'steady';
    }

    function _awardSurahStars(surahId) {
        const session = getSession();
        if (!session) return null;
        const normalizedId = normalizeSurahId(surahId);
        const meta = _getSurahMeta(normalizedId);
        const points = _starsForSurah(meta);
        const state = _readRewardState(session.username);
        const decay = _applyStarDecay(state);
        if (state.completed && state.completed[normalizedId]) {
            _writeRewardState(session.username, state);
            return null;
        }
        const inactiveDays = _daysBetween(state.lastActivity);
        const today = _todayKey();
        const yesterday = _todayKey(new Date(Date.now() - 86400000));
        const wasComeback = inactiveDays >= 7;
        state.stars = (state.stars || 0) + points;
        state.totalEarned = (state.totalEarned || 0) + points;
        state.completed = state.completed || {};
        state.completed[normalizedId] = { stars: points, date: new Date().toISOString() };
        state.streak = state.lastActivity === today ? (state.streak || 1) : (state.lastActivity === yesterday ? (state.streak || 0) + 1 : 1);
        state.bestStreak = Math.max(state.bestStreak || 0, state.streak || 0);
        state.lastActivity = today;
        state.decayPeriodsApplied = 0;
        const payload = {
            variant: _buildCelebrationVariant(state, points, meta, wasComeback),
            surahId: normalizedId,
            surahName: meta.nameAr || meta.nameFr || normalizedId,
            surahFile: meta.file || location.pathname.split('/').pop(),
            nextUrl: 'dashboard.html#surah-focus',
            points,
            stars: state.stars,
            totalEarned: state.totalEarned,
            completedCount: Object.keys(state.completed || {}).length,
            streak: state.streak || 1,
            lost: decay.lost || 0,
            earnedAt: new Date().toISOString()
        };
        _writeRewardState(session.username, state);
        try { sessionStorage.setItem(CELEBRATION_KEY, JSON.stringify(payload)); } catch (error) {}
        return payload;
    }

    function _maybeOpenCelebration(payload) {
        if (!payload || !location || /celebration\.html|dashboard\.html|login\.html|admin\.html/.test(location.pathname)) return;
        setTimeout(() => {
            try { window.location.href = 'celebration.html'; } catch (error) {}
        }, 900);
    }

    function _maybeOpenInactivity(payload) {
        if (!payload || !location || /inactivity\.html|celebration\.html|login\.html|admin\.html/.test(location.pathname)) return;
        setTimeout(() => {
            try { window.location.href = 'inactivity.html'; } catch (error) {}
        }, 700);
    }

    function storeMissionAttempt(surahId, score = 0, passed = false) {
        const session = getSession();
        if (!session) return null;
        const normalizedId = normalizeSurahId(surahId);
        const meta = _getSurahMeta(normalizedId);
        const state = _readRewardState(session.username);
        const payload = {
            variant: passed ? 'steady' : 'try-again',
            surahId: normalizedId,
            surahName: meta.nameAr || meta.nameFr || normalizedId,
            surahFile: meta.file || location.pathname.split('/').pop(),
            nextUrl: 'dashboard.html#surah-focus',
            points: 0,
            stars: state.stars || 0,
            totalEarned: state.totalEarned || 0,
            completedCount: Object.keys(state.completed || {}).length,
            streak: state.streak || 0,
            score: Math.max(0, Math.min(100, Number(score || 0))),
            failed: !passed,
            earnedAt: new Date().toISOString()
        };
        try { sessionStorage.setItem(CELEBRATION_KEY, JSON.stringify(payload)); } catch (error) {}
        return payload;
    }

    function getRewardState(username) {
        const session = getSession();
        const key = username || session?.username;
        if (!key) return null;
        const state = _readRewardState(key);
        const decay = _applyStarDecay(state);
        if (decay.lost > 0) {
            _storeInactivityPayload(decay, state);
            _writeRewardState(key, state);
        }
        return { ...state, lostNow: decay.lost || 0 };
    }

    function syncRewardsFromSurahs(surahs) {
        const session = getSession();
        if (!session || !Array.isArray(surahs)) return null;
        const state = _readRewardState(session.username);
        const decay = _applyStarDecay(state);
        const inactivityPayload = decay.lost > 0 ? _storeInactivityPayload(decay, state) : null;
        let added = 0;
        state.completed = state.completed || {};
        surahs.forEach(surah => {
            if (!surah || !surah.isCompleted) return;
            const id = normalizeSurahId(surah.id);
            if (state.completed[id]) return;
            const stars = _starsForSurah(surah);
            state.completed[id] = { stars, date: new Date().toISOString(), synced: true };
            state.stars = (state.stars || 0) + stars;
            state.totalEarned = (state.totalEarned || 0) + stars;
            added += stars;
        });
        if (added > 0 && !state.lastActivity) state.lastActivity = _todayKey();
        _writeRewardState(session.username, state);
        _maybeOpenInactivity(inactivityPayload);
        return state;
    }

    async function getClassStarRanking(username) {
        const session = getSession();
        const studentId = username || session?.username;
        if (!studentId) return null;
        try {
            const { data: profs, error: profsError } = await supabase.from('profs').select('username, classe, students');
            if (profsError) {
                logError('getClassStarRanking.profs', profsError);
                return null;
            }
            const klass = (profs || []).find(prof => Array.isArray(prof.students) && prof.students.includes(studentId));
            if (!klass || !Array.isArray(klass.students) || klass.students.length === 0) {
                const own = getRewardState(studentId);
                return { rank: null, total: 0, stars: own?.stars || 0, classe: '', isAssigned: false };
            }

            const classStudents = Array.from(new Set(klass.students.filter(Boolean)));
            const { data: rows, error: progressError } = await supabase
                .from('progressions')
                .select('username, surah_id, completed_at')
                .in('username', classStudents);
            if (progressError) {
                logError('getClassStarRanking.progressions', progressError);
                return null;
            }

            const scores = classStudents.map(id => {
                const completedIds = new Set();
                (rows || []).forEach(row => {
                    if (row.username !== id || !row.completed_at || !row.surah_id) return;
                    completedIds.add(normalizeSurahId(row.surah_id));
                });
                const stars = Array.from(completedIds).reduce((sum, surahId) => {
                    return sum + _starsForSurah(_getSurahMeta(surahId));
                }, 0);
                return { id, stars, completedCount: completedIds.size };
            }).sort((a, b) => (b.stars - a.stars) || (b.completedCount - a.completedCount) || a.id.localeCompare(b.id));

            const ownIndex = scores.findIndex(item => item.id === studentId);
            if (ownIndex < 0) return null;
            const own = scores[ownIndex];
            const betterCount = scores.filter(item => item.stars > own.stars || (item.stars === own.stars && item.completedCount > own.completedCount)).length;
            return {
                rank: betterCount + 1,
                total: scores.length,
                stars: own.stars,
                completedCount: own.completedCount,
                classe: klass.classe || '',
                isAssigned: true
            };
        } catch (error) {
            logError('getClassStarRanking', error);
            return null;
        }
    }

    function getLastCelebration() {
        try { return JSON.parse(sessionStorage.getItem(CELEBRATION_KEY) || 'null'); }
        catch { return null; }
    }

    function getLastInactivity() {
        try { return JSON.parse(sessionStorage.getItem(INACTIVITY_KEY) || 'null'); }
        catch { return null; }
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
            username, prenom, nom, password: _encodePassword(password), is_suspended: false
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
        const { data, error } = await _findLoginRow('eleves', 'nom', prenom, nom);

        if (error) {
            logError('login', error);
            return { ok: false, error: 'خطأ: ' + (error.message || 'فشل الاتصال بالخادم') };
        }
        if (!data) return { ok: false, error: 'لم يتم العثور على هذا الحساب' };
        if (data.is_suspended) return { ok: false, error: '⚠️ هذا الحساب مغلق حالياً' };
        if (!_passwordMatches(data.password, password)) return { ok: false, error: 'كلمة المرور غير صحيحة' };

        _setSession(data.username, data.prenom, data.nom, 'student');
        return { ok: true, username: data.username };
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
            username, prenom, classe, password: _encodePassword(password), students: []
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

        const isAdmin = _encodePassword(prenom) === 'QVVUSTE='
            && _encodePassword(classe) === 'NDg3IQ=='
            && _encodePassword(password) === 'ITAxMTA7';
        if (isAdmin) {
            _setSession('__admin__', 'الإدارة', 'مواهب المنان', 'admin');
            return { ok: true, username: '__admin__', role: 'admin' };
        }

        const { data, error } = await _findLoginRow('profs', 'classe', prenom, classe);

        if (error) {
            logError('loginProf', error);
            return { ok: false, error: 'خطأ في الاتصال: ' + error.message };
        }
        if (!data) return { ok: false, error: 'لم يتم العثور على حساب الأستاذ' };
        if (!_passwordMatches(data.password, password)) return { ok: false, error: 'كلمة المرور غير صحيحة' };

        _setSession(data.username, data.prenom, data.classe, 'prof');
        return { ok: true, username: data.username };
    }

    // --- 3. FONCTIONS ADMINISTRATEUR ---
    async function getAllStudents() {
        if (!_isOnline()) return _readOfflineCache('__admin__', 'all_students', []);
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

        const students = (elevesRes.data || []).map(e => {
            const userProgs = progs.filter(p => p.username === e.username);
            const progressDict = {};
            userProgs.forEach(p => _rememberProgressAliases(progressDict, p));
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
        _writeOfflineCache('__admin__', 'all_students', students);
        return students;
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
        const operations = [
            ['progressions', 'username'], ['devoirs', 'student_id'], ['horaires', 'username'],
            ['messages', 'username'], ['profils_admin', 'username'], ['eleves', 'username']
        ];
        for (const [table, field] of operations) {
            const { error } = await supabase.from(table).delete().eq(field, username);
            if (error) throw new Error(`${table}: ${error.message}`);
        }
    }

    async function deleteProf(username) {
        const devoirsResult = await supabase.from('devoirs').delete().eq('prof_id', username);
        if (devoirsResult.error) throw new Error(`devoirs: ${devoirsResult.error.message}`);
        const profResult = await supabase.from('profs').delete().eq('username', username);
        if (profResult.error) throw new Error(`profs: ${profResult.error.message}`);
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
        if (!_isOnline()) return _readOfflineCache(username, 'schedule', "لم يتم تحميل أوقات الحصص بعد.");
        const { data, error } = await supabase.from('horaires').select('schedule_text').eq('username', username).maybeSingle();
        if (error) {
            logError('getSchedule', error);
            return _readOfflineCache(username, 'schedule', "لم يتم تحديد أوقات الحصص بعد.");
        }
        const schedule = data ? data.schedule_text : "لم يتم تحديد أوقات الحصص بعد.";
        _writeOfflineCache(username, 'schedule', schedule);
        return schedule;
    }

    async function setSchedule(username, schedule_text) {
        const { error } = await supabase.from('horaires').upsert([{ username, schedule_text }]);
        if (error) logError('setSchedule', error);
    }

    // --- 6. MESSAGES ---
    async function getMessages(username) {
        if (!_isOnline()) return _readOfflineCache(username, 'messages', []);
        const { data, error } = await supabase.from('messages').select('*').eq('username', username).order('id', { ascending: false });
        if (error) {
            logError('getMessages', error);
            return _readOfflineCache(username, 'messages', []);
        }
        return _cacheList(username, 'messages', data || []);
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

    async function saveFinanceEntry(payload) {
        const date = new Date().toLocaleDateString('ar-MA', { day: 'numeric', month: 'long', year: 'numeric' });
        const entry = {
            id: payload.id || ('finance_' + Date.now()),
            operationDate: payload.operationDate || new Date().toISOString().slice(0, 10),
            type: payload.type || 'other',
            label: String(payload.label || '').trim(),
            amount: Number(payload.amount) || 0,
            note: String(payload.note || '').trim(),
            createdAt: new Date().toISOString()
        };
        const { error } = await supabase.from('messages').insert([{
            username: '__admin_finance__',
            text: ADMIN_FINANCE_PREFIX + JSON.stringify(entry),
            date
        }]);
        if (error) { logError('saveFinanceEntry', error); return { ok: false, error: error.message }; }
        return { ok: true, entry };
    }

    async function getFinanceEntries() {
        const { data, error } = await supabase.from('messages').select('*').eq('username', '__admin_finance__').order('id', { ascending: false });
        if (error) { logError('getFinanceEntries', error); return []; }
        return (data || []).map(row => {
            const raw = row.text || '';
            if (!raw.startsWith(ADMIN_FINANCE_PREFIX)) return null;
            try { return { rowId: row.id, ...JSON.parse(raw.slice(ADMIN_FINANCE_PREFIX.length)) }; }
            catch (parseError) { return null; }
        }).filter(Boolean);
    }

    async function deleteFinanceEntry(rowId) {
        const { error } = await supabase.from('messages').delete().eq('id', rowId).eq('username', '__admin_finance__');
        if (error) { logError('deleteFinanceEntry', error); return { ok: false, error: error.message }; }
        return { ok: true };
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

    function _parsePrefixedPayload(row, prefix) {
        const raw = row?.text || '';
        if (!raw.startsWith(prefix)) return null;
        try { return { id: row.id, date: row.date, createdAt: row.created_at || row.date || '', ...JSON.parse(raw.slice(prefix.length)) }; }
        catch (error) { return null; }
    }

    async function saveClassSession(profId, payload) {
        const date = new Date().toLocaleDateString('ar-MA', { day: 'numeric', month: 'long' });
        const body = CLASS_SESSION_PREFIX + JSON.stringify({ ...payload, profId, savedAt: new Date().toISOString() });
        const { error } = await supabase.from('messages').insert([{ username: '__class_session__:' + profId, text: body, date }]);
        if (error) { logError('saveClassSession', error); return { ok: false, error: error.message }; }
        return { ok: true };
    }

    async function getClassSessions(profId) {
        const { data, error } = await supabase.from('messages').select('*').eq('username', '__class_session__:' + profId).order('id', { ascending: false });
        if (error) { logError('getClassSessions', error); return []; }
        return (data || []).map(row => _parsePrefixedPayload(row, CLASS_SESSION_PREFIX)).filter(Boolean);
    }

    async function saveTeacherNote(studentId, payload) {
        const session = getSession();
        const date = new Date().toLocaleDateString('ar-MA', { day: 'numeric', month: 'long' });
        const body = TEACHER_NOTE_PREFIX + JSON.stringify({ ...payload, studentId, profId: session?.username || '', profName: session?.prenom || '', savedAt: new Date().toISOString() });
        const row = { username: '__teacher_notes__:' + studentId, text: body, date };
        if (!_isOnline()) {
            _queueOfflineMutation('teacherNote', { studentId, row });
            return { ok: true, offline: true };
        }
        const { error } = await supabase.from('messages').insert([row]);
        if (error) {
            logError('saveTeacherNote', error);
            _queueOfflineMutation('teacherNote', { studentId, row });
            return { ok: true, offline: true };
        }
        return { ok: true };
    }

    async function getTeacherNotes(studentId) {
        if (!_isOnline()) return _readOfflineCache(studentId, 'teacher_notes', []);
        const { data, error } = await supabase.from('messages').select('*').eq('username', '__teacher_notes__:' + studentId).order('id', { ascending: false });
        if (error) {
            logError('getTeacherNotes', error);
            return _readOfflineCache(studentId, 'teacher_notes', []);
        }
        return _cacheList(studentId, 'teacher_notes', (data || []).map(row => _parsePrefixedPayload(row, TEACHER_NOTE_PREFIX)).filter(Boolean));
    }

    async function getProfReports(profId) {
        const reports = await getAdminReports();
        return reports.filter(report => report.profId === profId);
    }

    // --- 7. PROFILS ADMINISTRATIFS ---
    async function getProfile(username) {
        const { data, error } = await supabase.from('profils_admin').select('*').eq('username', username).maybeSingle();
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
        const cached = _readOfflineCache(username, 'progress', {});
        if (!_isOnline()) return cached;
        const { data, error } = await supabase.from('progressions').select('*').eq('username', username);
        if (error) {
            logError('getProgress', error);
            return cached;
        }
        const res = {};
        (data || []).forEach(p => _rememberProgressAliases(res, p));
        Object.entries(cached).forEach(([id, local]) => {
            if (!local || typeof local !== 'object') return;
            const remote = res[id] || {};
            const mergedActivities = { ...(remote.activities || {}), ...(local.activities || {}) };
            const hasLocalChanges = Object.keys(local.activities || {}).length > 0 ||
                Boolean(local.completed_at || local.completedAt || local.is_completed);
            if (hasLocalChanges) _rememberProgressAliases(res, {
                ...remote,
                ...local,
                activities: mergedActivities,
                completed_at: remote.completed_at || remote.completedAt || local.completed_at || local.completedAt || null,
                global_score: Math.max(Number(remote.global_score || remote.globalScore || 0), Number(local.global_score || local.globalScore || 0)),
                surah_id: id
            });
        });
        _writeOfflineCache(username, 'progress', res);
        return res;
    }

    async function recordActivity(surahId, activityKey, score) {
        const session = getSession(); if (!session) return;
        const normalizedId = normalizeSurahId(surahId);
        const cachedProgress = _readOfflineCache(session.username, 'progress', {});
        let activities = { ...(cachedProgress[normalizedId]?.activities || {}) };
        const shouldSaveLocally = !activities[activityKey] || score > activities[activityKey].score;
        if (shouldSaveLocally) {
            activities[activityKey] = { score, date: new Date().toISOString() };
            _mergeProgressCache(session.username, normalizedId, { activities });
        }
        if (!_isOnline()) {
            _queueOfflineMutation('recordActivity', { username: session.username, surahId: normalizedId, activities });
            return { ok: true, offline: true };
        }
        const { data, error } = await supabase.from('progressions').select('activities')
            .eq('username', session.username).eq('surah_id', normalizedId).maybeSingle();
        if (error && error.code !== 'PGRST116') {
            logError('recordActivity', error);
            _queueOfflineMutation('recordActivity', { username: session.username, surahId: normalizedId, activities });
            return { ok: true, offline: true };
        }
        const serverActivities = data?.activities || {};
        activities = { ...serverActivities, ...activities };
        if (shouldSaveLocally || !serverActivities[activityKey] || score > serverActivities[activityKey].score) {
            activities[activityKey] = { score, date: new Date().toISOString() };
            const { error: upsertError } = await supabase.from('progressions').upsert([{ username: session.username, surah_id: normalizedId, activities }]);
            if (upsertError) _queueOfflineMutation('recordActivity', { username: session.username, surahId: normalizedId, activities });
        }
        return { ok: true };
    }

    function prepareOfflineLessons(surahs) {
        if (!Array.isArray(surahs) || !('serviceWorker' in navigator)) return;
        const selected = surahs
            .filter(surah => surah && surah.available !== false && (surah.isCompleted || surah.isCurrent || surah.isUnlocked))
            .slice(-8);
        const next = surahs.find(surah => surah && surah.available !== false && !surah.isCompleted);
        const urls = Array.from(new Set([
            'dashboard.html',
            'carnet-suivi.html',
            'profil.html',
            'parent.html',
            ...(selected.map(surah => surah.file).filter(Boolean)),
            next && next.file
        ].filter(Boolean)));
        const post = registration => {
            const worker = registration?.active || navigator.serviceWorker.controller;
            if (worker) worker.postMessage({ type: 'PREFETCH_URLS', urls });
        };
        navigator.serviceWorker.ready.then(post).catch(() => {});
    }

    const completionRequests = new Map();

    async function _completeSurahOnce(surahId) {
        const session = getSession(); if (!session) return;
        const normalizedId = normalizeSurahId(surahId);
        const cachedProgress = _readOfflineCache(session.username, 'progress', {});
        let data = cachedProgress[normalizedId] || null;
        let error = null;
        if (_isOnline()) {
            const response = await supabase.from('progressions').select('activities, completed_at')
                .eq('username', session.username).eq('surah_id', normalizedId).maybeSingle();
            data = response.data || data;
            error = response.error;
        }
        if (error && error.code !== 'PGRST116') logError('completeSurah', error);
        const wasCompleted = Boolean(data?.completed_at || data?.completedAt || data?.is_completed);
        if (wasCompleted) return { alreadyCompleted: true, surahId: normalizedId };
        const activities = data?.activities || {};
        const scores = Object.values(activities).map(a => a.score);
        const globalScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
        const completedAt = new Date().toISOString();
        _mergeProgressCache(session.username, normalizedId, {
            activities,
            completed_at: completedAt,
            completedAt,
            is_completed: true,
            global_score: globalScore,
            globalScore,
            score: globalScore
        });
        if (!_isOnline() || (error && error.code !== 'PGRST116')) {
            _queueOfflineMutation('completeSurah', { username: session.username, surahId: normalizedId, activities, completedAt, globalScore });
        } else {
            const { error: upsertError } = await supabase.from('progressions').upsert([{
                username: session.username, surah_id: normalizedId, activities,
                completed_at: completedAt, global_score: globalScore
            }]);
            if (upsertError) {
                logError('completeSurah.upsert', upsertError);
                _queueOfflineMutation('completeSurah', { username: session.username, surahId: normalizedId, activities, completedAt, globalScore });
            }
        }
        const payload = wasCompleted
            ? storeMissionAttempt(normalizedId, globalScore, true)
            : _awardSurahStars(normalizedId);
        window.dispatchEvent(new CustomEvent('mawahib:surah-completed', { detail: { surahId: normalizedId } }));
        _maybeOpenCelebration(payload);
        return payload;
    }

    function completeSurah(surahId) {
        const session = getSession(); if (!session) return Promise.resolve(null);
        const normalizedId = normalizeSurahId(surahId);
        const requestKey = session.username + ':' + normalizedId;
        if (completionRequests.has(requestKey)) return completionRequests.get(requestKey);
        const request = _completeSurahOnce(normalizedId).finally(() => completionRequests.delete(requestKey));
        completionRequests.set(requestKey, request);
        return request;
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
        const cacheScope = role === 'prof' ? 'devoirs_prof' : 'devoirs_student';
        if (!_isOnline()) return _readOfflineCache(username, cacheScope, []);
        const field = role === 'prof' ? 'prof_id' : 'student_id';
        const { data, error } = await supabase.from('devoirs').select('*').eq(field, username).order('date_limite', { ascending: true });
        if (error) {
            logError('getDevoirs', error);
            return _readOfflineCache(username, cacheScope, []);
        }
        return _cacheList(username, cacheScope, data || []);
    }

    async function annulerDevoir(id) {
        const { error } = await supabase.from('devoirs').delete().eq('id', id);
        if (error) logError('annulerDevoir', error);
    }

    async function marquerDevoirTermine(id) {
        const session = getSession();
        if (session) _updateCachedDevoir(session.username, id, { statut: 'termine' });
        if (!_isOnline()) {
            _queueOfflineMutation('homeworkDone', { id, username: session?.username || '' });
            return { ok: true, offline: true };
        }
        const { error } = await supabase.from('devoirs').update({ statut: 'termine' }).eq('id', id);
        if (error) {
            logError('marquerDevoirTermine', error);
            _queueOfflineMutation('homeworkDone', { id, username: session?.username || '' });
            return { ok: true, offline: true };
        }
        return { ok: true };
    }

    function getSupabaseClient() { return supabase; }

    return {
        register, login, registerProf, loginProf, logout, getSession, getSavedAccounts, switchAccount, requireAuth,
        getAllStudents, getAllUsers, getProfs, deleteStudent, deleteProf, toggleSuspension,
        assignStudentToProf, removeStudentFromProf,
        getSchedule, setSchedule, getMessages, sendMessage, deleteMessageById, clearMessages, sendAdminReport, getAdminReports, getProfReports,
        saveFinanceEntry, getFinanceEntries, deleteFinanceEntry,
        saveClassSession, getClassSessions, saveTeacherNote, getTeacherNotes,
        getProfile, updateProfile, getProgress, recordActivity, completeSurah, normalizeSurahId, getRewardState, getLastCelebration, getLastInactivity, syncRewardsFromSurahs, getClassStarRanking, storeMissionAttempt, prepareOfflineLessons,
        ajouterDevoir, getDevoirs, annulerDevoir, marquerDevoirTermine,
        getSupabaseClient, syncOfflineQueue, getOfflineStatus
    };
})();
