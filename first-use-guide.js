(function () {
  'use strict';

  const VERSION = 'v1';
  const guides = {
    student: [
      { icon: '👋', title: 'مرحبا بك في مواهب المنان', text: 'هنا تتقدم خطوة بخطوة في حفظ السور ومراجعتها.' },
      { icon: '📖', title: 'مسار السور', text: 'ابدأ بالسورة المتاحة. عند إتمامها تُفتح السورة التالية تلقائيا.' },
      { icon: '✓', title: 'التعلم والتمارين', text: 'أتم النشاط الحالي أولا، ثم تنتقل تلقائيا إلى النشاط التالي.' },
      { icon: '📘', title: 'واجباتك ومعلوماتك', text: 'في الصفحة الرئيسية تجد واجبات الأستاذ ورسائل الإدارة وموعد الحصة.' },
      { icon: '⭐', title: 'تابع تقدمك', text: 'اجمع النجوم والأوسمة، واستعمل الشريط السفلي للوصول إلى صفحاتك.' }
    ],
    prof: [
      { icon: '👋', title: 'مرحبا بك في حساب الأستاذ', text: 'كل مهمة أساسية لها صفحة واضحة في الشريط السفلي.' },
      { icon: '📖', title: 'تسجيل الحفظ', text: 'اختر الطالب والسورة والآيات والتقدير، ثم سجّل النتيجة.' },
      { icon: '📘', title: 'إرسال الواجبات', text: 'اختر الطالب وحدد السورة والآيات والموعد، ثم أرسل الواجب.' },
      { icon: '📊', title: 'متابعة الطلاب', text: 'راجع سجل كل طالب وافتح الإحصاءات لمعرفة تقدمه والتوصية المناسبة.' },
      { icon: '📩', title: 'التواصل والتنقل', text: 'أرسل ملاحظاتك إلى الإدارة وانتقل بين الصفحات من الشريط السفلي.' }
    ]
  };

  let active = false;
  let pending = false;

  function session() {
    try { return window.Auth && Auth.getSession ? Auth.getSession() : JSON.parse(localStorage.getItem('quran_session') || 'null'); }
    catch (_) { return null; }
  }

  function keyFor(value) {
    return 'mawahib_first_use_' + VERSION + '_' + value.role + '_' + value.username;
  }

  function shouldShow() {
    const value = session();
    if (!value || !guides[value.role] || !value.username) return false;
    try { return localStorage.getItem(keyFor(value)) !== '1'; }
    catch (_) { return false; }
  }

  function finish(modal, value) {
    try { localStorage.setItem(keyFor(value), '1'); } catch (_) {}
    active = false;
    pending = false;
    modal.remove();
    document.body.style.overflow = '';
    window.dispatchEvent(new CustomEvent('mawahib:first-use-complete'));
  }

  function openGuide() {
    const value = session();
    if (!value || !guides[value.role] || !shouldShow()) {
      pending = false;
      return;
    }

    const steps = guides[value.role];
    let index = 0;
    active = true;
    pending = false;

    const modal = document.createElement('div');
    modal.className = 'first-use-guide';
    modal.id = 'first-use-guide';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = [
      '<section class="first-use-panel">',
      '<button class="first-use-skip" type="button">تخطي</button>',
      '<div class="first-use-count"></div>',
      '<div class="first-use-icon"></div>',
      '<h2 class="first-use-title"></h2>',
      '<p class="first-use-text"></p>',
      '<div class="first-use-dots" aria-hidden="true"></div>',
      '<div class="first-use-actions">',
      '<button class="first-use-prev" type="button">السابق</button>',
      '<button class="first-use-next" type="button">التالي</button>',
      '</div>',
      '</section>'
    ].join('');

    const style = document.createElement('style');
    style.textContent = [
      '.first-use-guide{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(7,24,18,.72);backdrop-filter:blur(6px);font-family:Cairo,Tajawal,system-ui,sans-serif;direction:rtl}',
      '.first-use-panel{position:relative;width:min(430px,100%);min-height:390px;padding:25px 22px 20px;border:1px solid rgba(255,255,255,.7);border-radius:20px;background:#fff;color:#17231e;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center}',
      '.first-use-skip{position:absolute;top:14px;left:14px;border:0;background:transparent;color:#68766f;font:800 12px inherit;padding:7px;cursor:pointer}',
      '.first-use-count{align-self:flex-start;color:#76827c;font-size:11px;font-weight:900}',
      '.first-use-icon{width:78px;height:78px;margin:19px 0 13px;display:grid;place-items:center;border-radius:22px;background:#e9f5ee;color:#0f5137;font-size:39px;box-shadow:inset 0 0 0 1px #d5e9dc}',
      '.first-use-title{margin:0;color:#0f5137;font-size:22px;font-weight:900;line-height:1.45}',
      '.first-use-text{margin:9px auto 0;max-width:340px;color:#4f5f57;font-size:14px;font-weight:800;line-height:1.9}',
      '.first-use-dots{display:flex;gap:7px;justify-content:center;margin:auto 0 16px}.first-use-dot{width:7px;height:7px;border-radius:50%;background:#d5ded9;transition:width .2s,background .2s}.first-use-dot.active{width:22px;border-radius:99px;background:#0f5137}',
      '.first-use-actions{display:grid;grid-template-columns:auto minmax(130px,1fr);gap:9px;width:100%}',
      '.first-use-actions button{min-height:46px;border-radius:12px;font:900 14px inherit;cursor:pointer}.first-use-prev{border:1px solid #d7e2dc;background:#fff;color:#405149}.first-use-next{border:0;background:#0f5137;color:#fff}.first-use-prev:disabled{visibility:hidden}',
      '@media(max-width:380px){.first-use-guide{padding:8px}.first-use-panel{min-height:350px;padding:20px 16px 15px;border-radius:16px}.first-use-icon{width:66px;height:66px;margin-top:15px;font-size:32px}.first-use-title{font-size:19px}.first-use-text{font-size:12px}.first-use-actions button{min-height:43px}}',
      '@media(prefers-reduced-motion:no-preference){.first-use-panel{animation:firstUseIn .25s ease-out}.first-use-icon{animation:firstUseFloat 2.4s ease-in-out infinite}@keyframes firstUseIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}@keyframes firstUseFloat{50%{transform:translateY(-4px)}}}'
    ].join('');
    modal.appendChild(style);
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const count = modal.querySelector('.first-use-count');
    const icon = modal.querySelector('.first-use-icon');
    const title = modal.querySelector('.first-use-title');
    const text = modal.querySelector('.first-use-text');
    const dots = modal.querySelector('.first-use-dots');
    const previous = modal.querySelector('.first-use-prev');
    const next = modal.querySelector('.first-use-next');

    function render() {
      const step = steps[index];
      count.textContent = (index + 1) + ' / ' + steps.length;
      icon.textContent = step.icon;
      title.textContent = step.title;
      text.textContent = step.text;
      dots.innerHTML = steps.map((_, position) => '<span class="first-use-dot' + (position === index ? ' active' : '') + '"></span>').join('');
      previous.disabled = index === 0;
      next.textContent = index === steps.length - 1 ? 'ابدأ' : 'التالي';
      next.focus();
    }

    previous.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
    next.addEventListener('click', () => { if (index < steps.length - 1) { index += 1; render(); } else finish(modal, value); });
    modal.querySelector('.first-use-skip').addEventListener('click', () => finish(modal, value));
    modal.addEventListener('keydown', event => { if (event.key === 'Escape') finish(modal, value); });
    render();
  }

  pending = shouldShow();
  window.MawahibFirstUseGuide = {
    shouldShow,
    isActiveOrPending: () => active || pending || shouldShow()
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openGuide, { once: true });
  else openGuide();
})();
