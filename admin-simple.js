(function(){
  'use strict';
  const page=document.body.dataset.adminPage||'students';
  const links=[['students','controle-487-eleves.html','👥','الطلاب'],['teachers','controle-487-profs.html','🧑‍🏫','الأساتذة'],['classes','controle-487-classes.html','🏫','الأقسام'],['activity','controle-487-activity.html','⚡','النشاط المباشر'],['finance','controle-487-finance.html','💳','المالية'],['stats','controle-487-stats.html','📊','الإحصاءات'],['messages','controle-487-messages.html','✉️','الرسائل']];
  const state={students:[],profs:{},reports:[],finance:[],selectedStudent:'',teacherNotes:{},editingProf:'',error:'',activityEvents:[],activityFilter:'all',activityStatus:'loading',activityUpdatedAt:null};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const arg=value=>esc(String(value??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
  const studentName=item=>`${item?.prenom||''} ${item?.nom||''}`.trim()||item?.username||'';
  const profName=item=>item?.prenom||item?.username||'';
  const profList=()=>Object.values(state.profs||{});
  function uniqueProgress(student){const seen=new Map();Object.entries(student?.progress||{}).forEach(([id,row])=>{const key=Auth.normalizeSurahId?Auth.normalizeSurahId(row?.surah_id||id):String(row?.surah_id||id).replace(/_/g,'-');const previous=seen.get(key);const currentDate=String(row?.completed_at||row?.completedAt||'');const previousDate=String(previous?.completed_at||previous?.completedAt||'');if(!previous||currentDate>=previousDate)seen.set(key,{...row,surahId:key})});return [...seen.values()]}
  const completedCount=student=>uniqueProgress(student).filter(row=>row&&(row.is_completed||row.completed_at||row.completedAt)).length;
  const pendingDuties=student=>(student?.devoirs||[]).filter(row=>row.statut!=='termine').length;
  function money(value){return (Number(value)||0).toLocaleString('fr-MA',{maximumFractionDigits:2})+' DH'}
  function options(items,valueKey,labeler){return items.map(item=>`<option value="${esc(item[valueKey])}">${esc(labeler(item))}</option>`).join('')}

  function layout(){document.getElementById('admin-app').innerHTML=`<div class="admin-shell"><header class="admin-head"><div class="admin-brand"><img src="logo.webp" class="admin-logo" alt=""><div><div class="admin-title">إدارة مواهب المنان</div><div class="admin-subtitle">بيانات مباشرة من المنصة</div></div></div><button class="admin-small danger" onclick="adminLogout()">خروج</button></header><main id="admin-main" class="admin-main"></main></div><nav class="admin-nav" id="admin-nav">${links.map(item=>`<a href="${item[1]}" class="${item[0]===page?'active':''}"><span class="icon">${item[2]}</span><span>${item[3]}</span></a>`).join('')}</nav>`}
  function heading(title,help){return `<h1 class="admin-page-title">${title}</h1><p class="admin-help">${help}</p>${state.error?`<div class="admin-status">${esc(state.error)}</div>`:''}`}
  function kpi(value,label){return `<div class="admin-kpi"><div class="admin-kpi-value">${esc(value)}</div><div class="admin-kpi-label">${label}</div></div>`}
  function empty(text){return `<div class="admin-empty">${text}</div>`}
  async function load(){try{const [students,profs,reports,finance]=await Promise.all([Auth.getAllStudents(),Auth.getProfs(),Auth.getAdminReports(),Auth.getFinanceEntries()]);state.students=Array.isArray(students)?students:[];state.profs=profs||{};state.reports=Array.isArray(reports)?reports:[];state.finance=Array.isArray(finance)?finance:[]}catch(error){state.error='تعذر تحميل بعض البيانات. أعد المحاولة.'}render()}
  function render(){if(page==='students')renderStudents();else if(page==='teachers')renderTeachers();else if(page==='classes')renderClasses();else if(page==='activity')renderActivity();else if(page==='finance')renderFinance();else if(page==='stats')renderStats();else renderMessages()}

  function renderStudents(filter=''){const main=document.getElementById('admin-main');const query=String(filter).trim().toLowerCase();const rows=state.students.filter(item=>(studentName(item)+' '+item.username).toLowerCase().includes(query));main.innerHTML=heading('إدارة الطلاب','الحسابات والتقدم والواجبات من البيانات المسجلة.')+`<div class="admin-toolbar admin-toolbar-compact"><label class="admin-field"><span>بحث</span><input class="admin-control" placeholder="الاسم" value="${esc(filter)}" oninput="renderAdminStudents(this.value)"></label></div><div class="admin-people-grid">${rows.length?rows.map(student=>`<article class="admin-person"><div><div class="admin-row-title">${esc(studentName(student))}</div><div class="admin-row-meta">${esc(student.username)}</div></div><div class="admin-person-stats"><span>${completedCount(student)} سورة</span><span>${pendingDuties(student)} واجب</span><span class="${student.isSuspended?'is-paused':'is-active'}">${student.isSuspended?'موقوف':'نشط'}</span></div><div class="admin-row-actions"><button class="admin-small" onclick="toggleAdminStudent('${arg(student.username)}')">${student.isSuspended?'تفعيل':'إيقاف'}</button><button class="admin-small danger" onclick="deleteAdminStudent('${arg(student.username)}')">حذف</button></div></article>`).join(''):empty('لا يوجد طالب مطابق.')}</div>`}

  function renderTeachers(){
    const main=document.getElementById('admin-main');
    const profs=profList();
    const editing=state.editingProf?state.profs[state.editingProf]:null;
    const editForm=editing?`<form id="edit-prof-form" class="admin-toolbar" onsubmit="saveAdminTeacherEdit(event)">
      <div class="admin-row-title">تعديل حساب الأستاذ</div>
      <label class="admin-field"><span>اسم الأستاذ</span><input id="edit-prof-name" class="admin-control" value="${esc(editing.prenom||'')}" required></label>
      <label class="admin-field"><span>القسم</span><input id="edit-prof-class" class="admin-control" value="${esc(editing.classe||'')}" required></label>
      <label class="admin-field"><span>كلمة مرور جديدة</span><input id="edit-prof-pass" type="password" dir="ltr" class="admin-control" minlength="4" placeholder="اتركها فارغة دون تغيير"></label>
      <button class="admin-action" type="submit">حفظ التعديلات</button>
      <button class="admin-small" type="button" onclick="cancelAdminTeacherEdit()">إلغاء</button>
    </form>`:'';
    main.innerHTML=heading('إدارة الأساتذة','إضافة الأستاذ أو تعديل اسمه وقسمه وكلمة مروره.')+
      `<form class="admin-toolbar" onsubmit="addAdminTeacher(event)">
        <label class="admin-field"><span>اسم الأستاذ</span><input id="new-prof-name" class="admin-control" required></label>
        <label class="admin-field"><span>القسم</span><input id="new-prof-class" class="admin-control" required></label>
        <label class="admin-field"><span>كلمة المرور</span><input id="new-prof-pass" type="password" dir="ltr" class="admin-control" minlength="4" required></label>
        <button class="admin-action" type="submit">إضافة</button>
      </form>`+editForm+
      `<div class="admin-people-grid">${profs.length?profs.map(prof=>`<article class="admin-person">
        <div><div class="admin-row-title">${esc(profName(prof))}</div><div class="admin-row-meta">${esc(prof.classe||'بدون قسم')}</div></div>
        <div class="admin-person-stats"><span>${(prof.students||[]).length} طالب</span></div>
        <div class="admin-row-actions">
          <button class="admin-small" onclick="openAdminTeacherEdit('${arg(prof.username)}')">تعديل</button>
          <button class="admin-small danger" onclick="deleteAdminTeacher('${arg(prof.username)}')">حذف</button>
        </div>
      </article>`).join(''):empty('لا يوجد أستاذ مسجل.')}</div>`;
  }

  function renderClasses(){const main=document.getElementById('admin-main');const profs=profList();main.innerHTML=heading('إدارة الأقسام','ربط الطلاب بالأساتذة وفق الحسابات الموجودة.')+`<form class="admin-toolbar" onsubmit="assignAdminStudent(event)"><label class="admin-field"><span>الأستاذ والقسم</span><select id="assign-prof" class="admin-control" required><option value="">اختر</option>${options(profs,'username',p=>`${profName(p)} · ${p.classe||''}`)}</select></label><label class="admin-field"><span>الطالب</span><select id="assign-student" class="admin-control" required><option value="">اختر</option>${options(state.students,'username',studentName)}</select></label><button class="admin-action" type="submit">ربط</button></form><div class="admin-list">${profs.length?profs.map(prof=>{const assigned=(prof.students||[]).map(id=>state.students.find(s=>s.username===id)).filter(Boolean);return `<div class="admin-row"><div><div class="admin-row-title">${esc(prof.classe||'بدون قسم')} · ${esc(profName(prof))}</div><div class="admin-row-meta">${assigned.length} طالب</div><div class="admin-row-actions">${assigned.map(student=>`<button class="admin-small" onclick="removeAdminAssignment('${arg(prof.username)}','${arg(student.username)}')">${esc(studentName(student))} ×</button>`).join('')}</div></div></div>`}).join(''):empty('لا يوجد قسم.')}</div>`}

  function paymentRows(){return state.students.map(student=>{const payments=Array.isArray(student.payments)?student.payments:[];const paid=payments.filter(p=>p.status==='payé').reduce((sum,p)=>sum+(Number(p.amount)||0),0);const pending=payments.filter(p=>p.status!=='payé').reduce((sum,p)=>sum+(Number(p.amount)||0),0);return {student,paid,pending,count:payments.length}})}
  function renderFinance(){const main=document.getElementById('admin-main');const rows=paymentRows();const paid=rows.reduce((sum,row)=>sum+row.paid,0);const pending=rows.reduce((sum,row)=>sum+row.pending,0);main.innerHTML=heading('إدارة المالية','المبالغ محسوبة من سجل المدفوعات فقط.')+`<div class="admin-kpis">${kpi(money(paid),'المحصّل')}${kpi(money(pending),'المتبقي')}${kpi(rows.filter(r=>r.count).length,'طلاب لهم سجل')}</div><div class="admin-list">${rows.filter(r=>r.count).length?rows.filter(r=>r.count).map(row=>`<div class="admin-row"><div><div class="admin-row-title">${esc(studentName(row.student))}</div><div class="admin-row-meta">محصّل: ${money(row.paid)} · متبق: ${money(row.pending)} · ${row.count} عملية</div></div></div>`).join(''):empty('لا توجد بيانات مالية مسجلة.')}</div>`}

  function renderStats(){const main=document.getElementById('admin-main');const completed=state.students.reduce((sum,s)=>sum+completedCount(s),0);const duties=state.students.reduce((sum,s)=>sum+pendingDuties(s),0);const suspended=state.students.filter(s=>s.isSuspended).length;main.innerHTML=heading('الإحصاءات','ملخص مباشر دون تقديرات أو بيانات افتراضية.')+`<div class="admin-kpis">${kpi(state.students.length,'الطلاب')}${kpi(profList().length,'الأساتذة')}${kpi(completed,'السور المكتملة')}${kpi(duties,'الواجبات المفتوحة')}${kpi(suspended,'الحسابات الموقوفة')}${kpi(state.reports.length,'رسائل الأساتذة')}</div>`}

  function renderMessages(){const main=document.getElementById('admin-main');main.innerHTML=heading('الرسائل','الرسائل الواردة من الأساتذة وإرسال رسالة لطالب.')+`<form class="admin-toolbar" onsubmit="sendAdminStudentMessage(event)"><label class="admin-field"><span>الطالب</span><select id="message-student" class="admin-control" required><option value="">اختر</option>${options(state.students,'username',studentName)}</select></label><label class="admin-field"><span>الرسالة</span><textarea id="message-text" class="admin-control" required></textarea></label><button class="admin-action" type="submit">إرسال</button></form><div class="admin-list"><div class="admin-row-title">الرسائل الواردة</div>${state.reports.length?state.reports.slice(0,30).map(report=>`<div class="admin-row"><div><div class="admin-row-title">${esc(report.profName||'أستاذ')} · ${esc(report.classe||'')}</div><div class="admin-row-meta">${esc(report.category||'متابعة')} · ${esc(report.date||'')}</div><div class="admin-row-meta">${esc(report.text||'')}</div></div></div>`).join(''):empty('لا توجد رسائل واردة.')}</div>`}

  function activityDate(value){const date=new Date(value||0);return Number.isNaN(date.getTime())?null:date}
  function activityTime(value){const date=activityDate(value);return date?date.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
  function parseActivityPayload(text,prefix){if(!String(text||'').startsWith(prefix))return null;try{return JSON.parse(String(text).slice(prefix.length))}catch(error){return null}}
  function surahLabel(id){const normalized=Auth.normalizeSurahId?Auth.normalizeSurahId(id):String(id||'').replace(/_/g,'-');const list=typeof SURAH_REGISTRY!=='undefined'?SURAH_REGISTRY:[];const found=list.find(item=>(Auth.normalizeSurahId?Auth.normalizeSurahId(item.id):item.id)===normalized);return found?.nameAr||normalized||'سورة'}
  function activityLabel(key){const value=String(key||'');if(value.startsWith('juz_exam_'))return 'امتحان جزء';if(value.startsWith('mini_exam_'))return 'اختبار مرحلي';if(/listen|audio/i.test(value))return 'استماع';if(/order|sort/i.test(value))return 'ترتيب الآيات';if(/fill|word/i.test(value))return 'إكمال الآيات';if(/speed/i.test(value))return 'تمرين سريع';return 'تمرين'}
  function homeworkTimestamp(row){const direct=row.created_at||row.createdAt;const match=String(row.id||'').match(/\d{13}/);return direct||(match?new Date(Number(match[0])).toISOString():'')}
  function studentDisplay(map,id){const item=map.get(id);return item?studentName(item):(id||'طالب(ة)')}
  function profDisplay(map,id,fallback){const item=map.get(id);return item?.prenom||fallback||id||'أستاذ(ة)'}

  async function loadActivity(){
    const client=Auth.getSupabaseClient&&Auth.getSupabaseClient();
    if(!client){state.error='تعذر الاتصال ببيانات النشاط.';state.activityStatus='error';renderActivity();return}
    state.activityStatus=state.activityEvents.length?'refreshing':'loading';
    renderActivity();
    try{
      const [progressRes,studentsRes,profsRes,messagesRes,dutiesRes]=await Promise.all([
        client.from('progressions').select('*').limit(1500),
        client.from('eleves').select('username,prenom,nom'),
        client.from('profs').select('username,prenom,classe'),
        client.from('messages').select('*').order('id',{ascending:false}).limit(700),
        client.from('devoirs').select('*').limit(700)
      ]);
      const errors=[progressRes.error,studentsRes.error,profsRes.error,messagesRes.error,dutiesRes.error].filter(Boolean);
      if(errors.length)throw errors[0];
      const studentMap=new Map((studentsRes.data||[]).map(item=>[item.username,item]));
      const profMap=new Map((profsRes.data||[]).map(item=>[item.username,item]));
      const events=[];
      (progressRes.data||[]).forEach(row=>{
        const person=studentDisplay(studentMap,row.username);
        const surah=surahLabel(row.surah_id);
        if(row.completed_at)events.push({role:'student',type:'completion',date:row.completed_at,person,title:'سورة مكتملة',detail:surah,score:Number(row.global_score||0)});
        Object.entries(row.activities||{}).forEach(([key,value])=>{
          if(!value?.date)return;
          events.push({role:'student',type:'exercise',date:value.date,person,title:activityLabel(key),detail:surah,score:Number(value.score||0)});
        });
      });
      (messagesRes.data||[]).forEach(row=>{
        const note=parseActivityPayload(row.text,'[TEACHER_NOTE] ');
        if(note){events.push({role:'prof',type:'reading',date:note.savedAt||row.created_at,person:profDisplay(profMap,note.profId,note.profName),title:'قراءة مسجلة',detail:studentDisplay(studentMap,note.studentId)+' · '+(note.surah||note.surate||'سورة')+(note.scope?(' · '+note.scope):''),score:0});return}
        const report=parseActivityPayload(row.text,'[SIGNAL_ADMIN] ');
        if(report){events.push({role:'prof',type:'report',date:report.sentAt||row.created_at,person:profDisplay(profMap,report.profId,report.profName),title:'رسالة إلى الإدارة',detail:report.category||'متابعة',score:0});return}
        const lesson=parseActivityPayload(row.text,'[CLASS_SESSION] ');
        if(lesson)events.push({role:'prof',type:'session',date:lesson.savedAt||row.created_at,person:profDisplay(profMap,lesson.profId,lesson.profName),title:'حصة مسجلة',detail:lesson.classe||'',score:0});
      });
      (dutiesRes.data||[]).forEach(row=>events.push({role:'prof',type:'homework',date:homeworkTimestamp(row),person:profDisplay(profMap,row.prof_id,row.prof_name),title:'واجب مرسل',detail:studentDisplay(studentMap,row.student_id)+' · '+(row.surate||'سورة'),score:0}));
      state.activityEvents=events.filter(item=>activityDate(item.date)).sort((a,b)=>activityDate(b.date)-activityDate(a.date)).slice(0,500);
      state.activityUpdatedAt=new Date();state.activityStatus='live';state.error='';
    }catch(error){state.activityStatus='error';state.error='تعذر تحديث النشاط الآن. ستتم إعادة المحاولة تلقائيا.'}
    renderActivity();
  }

  function renderActivity(){
    const main=document.getElementById('admin-main');if(!main)return;
    const filtered=state.activityFilter==='all'?state.activityEvents:state.activityEvents.filter(item=>item.role===state.activityFilter);
    const studentEvents=state.activityEvents.filter(item=>item.role==='student');
    const profEvents=state.activityEvents.filter(item=>item.role==='prof');
    const activeStudents=new Set(studentEvents.map(item=>item.person)).size;
    const activeProfs=new Set(profEvents.map(item=>item.person)).size;
    const statusText=state.activityStatus==='live'?'تحديث مباشر':state.activityStatus==='error'?'إعادة المحاولة':'جاري التحديث';
    main.innerHTML=heading('النشاط المباشر','آخر إنجازات الطلاب(ات) وآخر أعمال الأساتذة(ات) من البيانات المسجلة فعليا.')+
      `<div class="admin-live-head"><div class="admin-live-state ${state.activityStatus}"><span></span>${statusText}</div><div class="admin-row-meta">آخر تحديث: ${state.activityUpdatedAt?activityTime(state.activityUpdatedAt):'—'}</div></div>`+
      `<div class="admin-kpis">${kpi(studentEvents.length,'أنشطة الطلاب(ات)')}${kpi(profEvents.length,'أنشطة الأساتذة(ات)')}${kpi(activeStudents,'طلاب(ات) نشطون')}${kpi(activeProfs,'أساتذة(ات) نشطون')}</div>`+
      `<div class="admin-live-filters"><button class="${state.activityFilter==='all'?'active':''}" onclick="setAdminActivityFilter('all')">الكل</button><button class="${state.activityFilter==='student'?'active':''}" onclick="setAdminActivityFilter('student')">الطلاب(ات)</button><button class="${state.activityFilter==='prof'?'active':''}" onclick="setAdminActivityFilter('prof')">الأساتذة(ات)</button><button onclick="refreshAdminActivity()">تحديث</button></div>`+
      `<div class="admin-live-list">${filtered.length?filtered.slice(0,100).map(item=>`<article class="admin-live-row ${item.role}"><div class="admin-live-icon">${item.role==='student'?'📖':'🧑‍🏫'}</div><div class="admin-live-copy"><div class="admin-row-title">${esc(item.person)} · ${esc(item.title)}</div><div class="admin-row-meta">${esc(item.detail)}${item.score?(' · '+Math.round(item.score)+'%'):''}</div></div><time>${activityTime(item.date)}</time></article>`).join(''):empty(state.activityStatus==='loading'?'جاري تحميل النشاط...':'لا يوجد نشاط مسجل بعد.')}</div>`;
  }

  let activityChannel=null,activityPoll=null,activityDebounce=null;
  function scheduleActivityReload(){clearTimeout(activityDebounce);activityDebounce=setTimeout(loadActivity,450)}
  function initActivity(){
    loadActivity();
    const client=Auth.getSupabaseClient&&Auth.getSupabaseClient();
    if(client?.channel){
      activityChannel=client.channel('admin-live-activity-'+Date.now())
        .on('postgres_changes',{event:'*',schema:'public',table:'progressions'},scheduleActivityReload)
        .on('postgres_changes',{event:'*',schema:'public',table:'messages'},scheduleActivityReload)
        .on('postgres_changes',{event:'*',schema:'public',table:'devoirs'},scheduleActivityReload)
        .subscribe(status=>{if(status==='SUBSCRIBED'){state.activityStatus='live';renderActivity()}});
    }
    activityPoll=setInterval(loadActivity,15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadActivity()});
    addEventListener('beforeunload',()=>{clearInterval(activityPoll);if(activityChannel&&client?.removeChannel)client.removeChannel(activityChannel)},{once:true});
  }
  async function reload(message){await load();if(message)toast(message)}
  function toast(text){const node=document.createElement('div');node.className='admin-status';node.style.cssText='position:fixed;z-index:200;top:14px;left:50%;transform:translateX(-50%);background:#124c35;color:#fff';node.textContent=text;document.body.appendChild(node);setTimeout(()=>node.remove(),2200)}
  function initNav(){const nav=document.getElementById('admin-nav');let last=scrollY;addEventListener('scroll',()=>{const y=scrollY;if(Math.abs(y-last)<5)return;nav.classList.toggle('nav-scroll-hidden',y>last&&y>80);last=y},{passive:true})}

  window.renderAdminStudents=renderStudents;
  window.adminLogout=()=>{Auth.logout();location.replace('login.html')};
  window.toggleAdminStudent=async username=>{await Auth.toggleSuspension(username);await reload('تم تحديث الحساب')};
  window.deleteAdminStudent=async username=>{if(!confirm('حذف الطالب وكل بياناته؟'))return;await Auth.deleteStudent(username);await reload('تم حذف الطالب')};
  window.addAdminTeacher=async event=>{event.preventDefault();const result=await Auth.registerProf(document.getElementById('new-prof-name').value,document.getElementById('new-prof-class').value,document.getElementById('new-prof-pass').value);if(result.ok)await reload('تمت إضافة الأستاذ');else toast(result.error||'تعذر الإضافة')};
  window.openAdminTeacherEdit=username=>{if(!state.profs[username])return;state.editingProf=username;renderTeachers();document.getElementById('edit-prof-form')?.scrollIntoView({behavior:'smooth',block:'start'})};
  window.cancelAdminTeacherEdit=()=>{state.editingProf='';renderTeachers()};
  window.saveAdminTeacherEdit=async event=>{
    event.preventDefault();
    const username=state.editingProf;
    const result=await Auth.updateProfAccount(username,{
      prenom:document.getElementById('edit-prof-name').value,
      classe:document.getElementById('edit-prof-class').value,
      password:document.getElementById('edit-prof-pass').value
    });
    if(!result.ok){toast(result.error||'تعذر حفظ التعديلات');return}
    state.editingProf='';
    await reload('تم تعديل حساب الأستاذ');
  };
  window.deleteAdminTeacher=async username=>{if(!confirm('حذف حساب الأستاذ؟'))return;await Auth.deleteProf(username);await reload('تم حذف الأستاذ')};
  window.assignAdminStudent=async event=>{event.preventDefault();await Auth.assignStudentToProf(document.getElementById('assign-prof').value,document.getElementById('assign-student').value);await reload('تم ربط الطالب')};
  window.removeAdminAssignment=async(prof,student)=>{await Auth.removeStudentFromProf(prof,student);await reload('تم فك الارتباط')};
  window.sendAdminStudentMessage=async event=>{event.preventDefault();await Auth.sendMessage(document.getElementById('message-student').value,document.getElementById('message-text').value.trim());document.getElementById('message-text').value='';toast('تم إرسال الرسالة')};
  window.setAdminActivityFilter=filter=>{state.activityFilter=filter;renderActivity()};
  window.refreshAdminActivity=loadActivity;
  layout();initNav();if(page==='activity')initActivity();else load();
})();
