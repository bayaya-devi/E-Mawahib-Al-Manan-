(function () {
  const storageKey = 'mawahib_theme';
  const fallback = 'traditional';
  const themes = ['traditional', 'emerald', 'indigo', 'rose', 'amber'];

  function readTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      return themes.includes(stored) ? stored : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function applyTheme(theme) {
    const nextTheme = themes.includes(theme) ? theme : fallback;
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {}
    syncSurahTheme();
    window.dispatchEvent(new CustomEvent('mawahib:theme-change', { detail: { theme: nextTheme } }));
    return nextTheme;
  }

  function normalizeDigits(text) {
    const map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
    return String(text).replace(/[٠-٩۰-۹]/g, d => map[d] || d);
  }

  function normalizeNodeDigits(root) {
    if (!root) return;
    const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skip.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /[٠-٩۰-۹]/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { node.nodeValue = normalizeDigits(node.nodeValue); });

    if (root.querySelectorAll) {
      root.querySelectorAll('[title], [aria-label], [placeholder]').forEach(el => {
        ['title', 'aria-label', 'placeholder'].forEach(attr => {
          const value = el.getAttribute(attr);
          if (value && /[٠-٩۰-۹]/.test(value)) el.setAttribute(attr, normalizeDigits(value));
        });
      });
    }
  }

  function initDigitNormalizer() {
    normalizeNodeDigits(document.body);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (/[٠-٩۰-۹]/.test(node.nodeValue)) node.nodeValue = normalizeDigits(node.nodeValue);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            normalizeNodeDigits(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function initScrollAnimations() {
    let lastY = window.scrollY || 0;
    document.documentElement.dataset.scrollDir = 'down';
    window.addEventListener('scroll', () => {
      const y = window.scrollY || 0;
      document.documentElement.dataset.scrollDir = y >= lastY ? 'down' : 'up';
      lastY = y;
    }, { passive: true });

    const selector = [
      'main > section', '.card', '.dashboard-section', '.profile-card', '.parent-card', '.quiz-card',
      '.lesson-card', '.surah-card', '.station-card', '.juz-section', '.daily-tile',
      '.top-row', '.feed-item', '.alert-card'
    ].join(',');

    const apply = () => {
      document.querySelectorAll(selector).forEach((el, index) => {
        if (!el.classList.contains('mawahib-reveal')) {
          el.classList.add('mawahib-reveal');
          el.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 45}ms`);
        }
      });
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -8% 0px' });

    apply();
    document.querySelectorAll('.mawahib-reveal').forEach(el => {
      el.dataset.revealBound = 'true';
      observer.observe(el);
    });

    let mutationFrame = null;
    const mutationObserver = new MutationObserver(() => {
      if (mutationFrame) return;
      mutationFrame = requestAnimationFrame(() => {
        mutationFrame = null;
        apply();
        document.querySelectorAll('.mawahib-reveal:not([data-reveal-bound])').forEach(el => {
          el.dataset.revealBound = 'true';
          observer.observe(el);
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function syncSurahTheme() {
    const isSurahPage = /(^|\/)surah-|Al_|al_kadr|quraysh|fil|bayina/.test(location.pathname);
    if (!isSurahPage) return;
    document.documentElement.style.setProperty('--surah', 'var(--platform-primary)');
    let style = document.getElementById('mawahib-surah-theme-sync');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mawahib-surah-theme-sync';
      style.textContent = [
        'header[style*="background"],',
        '#xp-bar[style*="background"],',
        'button[style*="background"],',
        '.choice.selected,',
        '.part-btn.active {',
        '  background: linear-gradient(135deg, var(--platform-primary), var(--platform-primary-dark)) !important;',
        '  color: #fff !important;',
        '  border-color: var(--platform-primary) !important;',
        '}',
        '.tab-active {',
        '  border-color: var(--platform-primary) !important;',
        '  color: var(--platform-primary) !important;',
        '  background: color-mix(in srgb, var(--platform-surface) 88%, #ffffff) !important;',
        '  box-shadow: 0 10px 24px color-mix(in srgb, var(--platform-primary) 18%, transparent) !important;',
        '}',
        '.verse-card:hover, .choice.selected, .part-btn.active { border-color: var(--platform-primary) !important; }',
        '.app-shell {',
        '  background: linear-gradient(180deg, color-mix(in srgb, var(--platform-surface) 92%, #ffffff), color-mix(in srgb, var(--platform-primary-soft) 38%, #ffffff)) !important;',
        '  border-color: color-mix(in srgb, var(--platform-primary) 22%, transparent) !important;',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  function initEnhancements() {
    if (!document.body) return;
    syncSurahTheme();
    initDigitNormalizer();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) initScrollAnimations();
  }

  window.PlatformTheme = {
    themes,
    get: readTheme,
    set: applyTheme,
    apply: applyTheme,
    normalizeDigits
  };

  applyTheme(readTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements, { once: true });
  } else {
    initEnhancements();
  }
})();


const MawahibSettings = (() => {
  const themeList = [['traditional','الأخضر التقليدي'],['emerald','زمردي'],['indigo','نيلي'],['rose','وردي'],['amber','ذهبي']];
  function init() { if (typeof Auth === 'undefined' || !Auth.getSession()) return; injectStyles(); injectButton(); injectPanel(); renderPanel(); }
  function injectStyles() { if (document.getElementById('mawahib-settings-style')) return; const style = document.createElement('style'); style.id = 'mawahib-settings-style'; style.textContent = [
    '.mawahib-settings-fab{position:fixed;top:14px;left:14px;z-index:90;width:44px;height:44px;border:0;border-radius:999px;display:grid;place-items:center;background:linear-gradient(135deg,var(--platform-primary,#14532d),var(--platform-primary-dark,#0c4a3b));color:#fff;box-shadow:0 14px 34px rgba(15,23,42,.22);cursor:pointer;font-size:21px}',
    '.mawahib-settings-overlay{position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55);backdrop-filter:blur(9px)}', '.mawahib-settings-overlay.open{display:flex}',
    '.mawahib-settings-panel{width:min(100%,560px);max-height:90vh;overflow:auto;border-radius:26px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.28);direction:rtl;font-family:var(--platform-font-ui,Cairo),sans-serif}',
    '.mawahib-settings-head{padding:18px;color:#fff;background:linear-gradient(135deg,var(--platform-primary-dark,#0c4a3b),var(--platform-primary,#14532d));display:flex;align-items:center;justify-content:space-between;gap:12px}', '.mawahib-settings-body{padding:16px;display:grid;gap:14px}',
    '.settings-card{border:1px solid var(--platform-border,#d1fae5);border-radius:20px;padding:14px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--platform-primary-soft,#dcfce7) 22%,#fff))}', '.settings-title{font-weight:900;color:#111827;margin-bottom:8px}',
    '.account-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e5e7eb;border-radius:16px;padding:10px;background:#fff;margin-top:8px;text-align:right}', '.account-row.active{border-color:var(--platform-primary,#14532d);background:color-mix(in srgb,var(--platform-primary-soft,#dcfce7) 38%,#fff)}',
    '.settings-action{border:0;border-radius:14px;padding:9px 12px;font-weight:900;cursor:pointer;background:var(--platform-primary,#14532d);color:#fff}', '.settings-action.secondary{background:#f1f5f9;color:#334155}',
    '.theme-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}', '.theme-choice{border:1px solid #e5e7eb;border-radius:16px;padding:10px;font-weight:900;background:#fff;cursor:pointer;text-align:center}', '.theme-choice.active{background:linear-gradient(135deg,var(--platform-primary,#14532d),var(--platform-primary-dark,#0c4a3b));color:#fff;border-color:transparent}', '@media(max-width:640px){.mawahib-settings-fab{top:auto;bottom:86px;left:12px}.theme-grid{grid-template-columns:1fr}}'
  ].join('\n'); document.head.appendChild(style); }
  function injectButton(){ if(document.getElementById('mawahib-settings-button')) return; const button=document.createElement('button'); button.id='mawahib-settings-button'; button.className='mawahib-settings-fab'; button.type='button'; button.title='الإعدادات'; button.setAttribute('aria-label','الإعدادات'); button.textContent='⚙'; button.addEventListener('click',open); document.body.appendChild(button); }
  function injectPanel(){ if(document.getElementById('mawahib-settings-overlay')) return; const overlay=document.createElement('div'); overlay.id='mawahib-settings-overlay'; overlay.className='mawahib-settings-overlay'; overlay.addEventListener('click',event=>{ if(event.target===overlay) close(); }); overlay.innerHTML='<div class="mawahib-settings-panel"><div class="mawahib-settings-head"><div><div style="font-size:12px;font-weight:900;opacity:.78">مواهب المنان</div><div style="font-size:22px;font-weight:900">الإعدادات</div></div><button type="button" class="settings-action secondary" onclick="MawahibSettings.close()">إغلاق</button></div><div id="mawahib-settings-body" class="mawahib-settings-body"></div></div>'; document.body.appendChild(overlay); }
  function accountTarget(account){ return account.role === 'prof' ? 'dashboard_prof.html' : 'dashboard.html'; }
  function renderPanel(){ const body=document.getElementById('mawahib-settings-body'); if(!body) return; const current=Auth.getSession(); const accounts=Auth.getSavedAccounts ? Auth.getSavedAccounts() : (current ? [current] : []); const currentTheme=window.PlatformTheme ? PlatformTheme.get() : 'traditional'; body.innerHTML='<section class="settings-card"><div class="settings-title">تبديل الحساب</div><p style="font-size:12px;color:#64748b;font-weight:800;line-height:1.6">الحسابات التي تم الدخول إليها سابقا على هذا الجهاز تظهر هنا. اختر حسابا للتبديل مباشرة.</p><div>'+ (accounts.map(account=>accountRow(account,current)).join('') || '<div class="account-row"><strong>لا يوجد حساب آخر محفوظ بعد.</strong></div>') +'</div></section><section class="settings-card"><div class="settings-title">لون المنصة</div><div class="theme-grid">'+ themeList.map(item=>'<button class="theme-choice '+(item[0]===currentTheme?'active':'')+'" onclick="MawahibSettings.setTheme(\''+item[0]+'\')">'+item[1]+'</button>').join('') +'</div></section><section class="settings-card"><div class="settings-title">الإشعارات</div><p style="font-size:12px;color:#64748b;font-weight:800;line-height:1.6">تنبيهات الرسائل والواجبات وتذكير السور على الهاتف أو الكمبيوتر.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="settings-action" onclick="MawahibSettings.enableNotifications()">تفعيل الإشعارات</button><button class="settings-action secondary" onclick="MawahibSettings.testNotification()">تجربة تنبيه</button></div></section>'; }
  function accountRow(account,current){ const active=current && current.username===account.username; const role=account.role==='prof'?'أستاذ':'تلميذ'; return '<button type="button" class="account-row '+(active?'active':'')+'" onclick="MawahibSettings.switchAccount(\''+escapeAttr(account.username)+'\')"><span style="flex:1"><strong style="display:block;color:#111827">'+escapeHtml(account.prenom||'')+' '+escapeHtml(account.nom||'')+'</strong><span style="font-size:11px;color:#64748b;font-weight:900">'+role+' · '+escapeHtml(account.username)+'</span></span><span class="settings-action secondary">فتح</span></button>'; }
  function escapeHtml(value){ return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function escapeAttr(value){ return escapeHtml(String(value||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")); }
  function open(){ renderPanel(); document.getElementById('mawahib-settings-overlay').classList.add('open'); } function close(){ document.getElementById('mawahib-settings-overlay').classList.remove('open'); }
  async function switchAccount(username){ if(!Auth.switchAccount) return; const ok=await Auth.switchAccount(username); if(!ok) { renderPanel(); return; } const session=Auth.getSession(); window.location.href=accountTarget(session); }
  function setTheme(theme){ if(window.PlatformTheme) PlatformTheme.set(theme); renderPanel(); }
  async function enableNotifications(){ if(window.Notif && typeof Notif.requestPermission==='function') await Notif.requestPermission(); else if('Notification' in window) await Notification.requestPermission(); renderPanel(); }
  async function testNotification(){ if(window.Notif && typeof Notif.remindNow==='function') return Notif.remindNow(); if('Notification' in window && Notification.permission==='granted') new Notification('مواهب المنان',{body:'تم اختبار الإشعارات بنجاح',icon:'logo.webp',dir:'rtl'}); else await enableNotifications(); }
  return { init, open, close, switchAccount, setTheme, enableNotifications, testNotification }; })(); document.addEventListener('DOMContentLoaded', () => MawahibSettings.init());
