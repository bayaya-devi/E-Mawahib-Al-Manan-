(function(){
  'use strict';
  const page=document.body.dataset.adminPage||'students';
  const allLinks=[['home','controle-mawahib-7x9k.html','⌂','الرئيسية'],['students','controle-487-eleves.html','👥','الطلاب'],['teachers','controle-487-profs.html','🧑‍🏫','الأساتذة'],['classes','controle-487-classes.html','🏫','الأقسام'],['activity','controle-487-activity.html','⚡','النشاط المباشر'],['parents','admin-quizparent.html','▤','إجابات الأولياء'],['finance','controle-487-finance.html','💳','المالية'],['stats','controle-487-stats.html','📊','الإحصاءات'],['messages','controle-487-messages.html','✉️','الرسائل']];
  const links=page==='activity'?[allLinks[0],allLinks.find(item=>item[0]==='activity')]:allLinks;
  const state={students:[],profs:{},reports:[],finance:[],selectedStudent:'',teacherNotes:{},editingProf:'',error:'',activityEvents:[],activityFilter:'all',activityStatus:'loading',activityUpdatedAt:null};
  const juzJourney=[
    {num:30,name:'جزء عمّ',start:78,end:114},{num:29,name:'جزء تبارك',start:67,end:77},{num:28,name:'جزء قد سمع',start:58,end:66},{num:27,name:'جزء الذاريات',start:51,end:57},{num:26,name:'جزء الأحقاف',start:46,end:50},{num:25,name:'جزء إليه يرد',start:42,end:45},{num:24,name:'جزء فمن أظلم',start:40,end:41},{num:23,name:'جزء وما لي',start:37,end:39},{num:22,name:'جزء ومن يقنت',start:34,end:36},{num:21,name:'جزء اتل ما أوحي',start:30,end:33},{num:20,name:'جزء أمن خلق',start:28,end:29},{num:19,name:'جزء وقال الذين',start:26,end:27},{num:18,name:'جزء قد أفلح',start:23,end:25},{num:17,name:'جزء اقترب للناس',start:21,end:22},{num:16,name:'جزء قال ألم',start:19,end:20},{num:15,name:'جزء سبحان الذي',start:17,end:18},{num:14,name:'جزء ربما',start:15,end:16},{num:13,name:'جزء وما أبرئ',start:13,end:14},{num:12,name:'جزء وما من دابة',start:12,end:12},{num:11,name:'جزء يعتذرون',start:11,end:11},{num:10,name:'جزء واعلموا',start:10,end:10},{num:9,name:'جزء قال الملأ',start:9,end:9},{num:8,name:'جزء ولو أننا',start:8,end:8},{num:7,name:'جزء وإذا سمعوا',start:7,end:7},{num:6,name:'جزء لا يحب الله',start:6,end:6},{num:5,name:'جزء والمحصنات',start:5,end:5},{num:4,name:'جزء لن تنالوا البر',start:4,end:4},{num:3,name:'جزء تلك الرسل',start:3,end:3},{num:2,name:'جزء سيقول',start:2,end:2},{num:1,name:'جزء الفاتحة',start:1,end:1}
  ];
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

  function layout(){document.getElementById('admin-app').innerHTML=`<div class="admin-shell"><header class="admin-head"><a class="admin-brand" href="controle-mawahib-7x9k.html" aria-label="الرئيسية"><img src="logo.webp" class="admin-logo" alt=""><div><div class="admin-title">إدارة مواهب المنان</div><div class="admin-subtitle">بيانات مباشرة من المنصة</div></div></a><button class="admin-small danger" onclick="adminLogout()">خروج</button></header><main id="admin-main" class="admin-main"></main></div><nav class="admin-nav" id="admin-nav">${links.map(item=>`<a href="${item[1]}" class="${item[0]===page?'active':''}"><span class="icon">${item[2]}</span><span>${item[3]}</span></a>`).join('')}</nav>`}
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
  function normalizedSurahId(id){return Auth.normalizeSurahId?Auth.normalizeSurahId(id):String(id||'').replace(/_/g,'-')}
  function surahMeta(id){const normalized=normalizedSurahId(id);const list=typeof SURAH_REGISTRY!=='undefined'?SURAH_REGISTRY:[];return list.find(item=>normalizedSurahId(item.id)===normalized)||null}
  function firstDate(values){return values.filter(value=>activityDate(value)).sort((a,b)=>activityDate(a)-activityDate(b))[0]||null}
  async function fetchAllRows(client,table,columns='*'){
    const rows=[];const pageSize=1000;
    for(let from=0;;from+=pageSize){const response=await client.from(table).select(columns).range(from,from+pageSize-1);if(response.error)throw response.error;const batch=response.data||[];rows.push(...batch);if(batch.length<pageSize)break}
    return rows;
  }
  function buildStudentCompletionEvents(progressRows,studentMap){
    const byStudent=new Map();
    progressRows.forEach(row=>{if(!row?.username||!studentMap.has(row.username))return;const meta=surahMeta(row.surah_id);if(!meta)return;if(!byStudent.has(row.username))byStudent.set(row.username,new Map());const rows=byStudent.get(row.username);const current=rows.get(meta.id)||{};rows.set(meta.id,{meta,completedAt:firstDate([current.completedAt,row.completed_at,row.completedAt]),activities:{...(current.activities||{}),...(row.activities||{})}})});
    const events=[];
    byStudent.forEach((rows,username)=>{const person=studentDisplay(studentMap,username);rows.forEach(row=>{if(row.completedAt)events.push({role:'student',type:'surah',date:row.completedAt,person,title:'أتم '+row.meta.nameAr,detail:'',score:0})});juzJourney.forEach(juz=>{const required=(typeof SURAH_REGISTRY!=='undefined'?SURAH_REGISTRY:[]).filter(item=>item.num>=juz.start&&item.num<=juz.end);if(!required.length||!required.every(item=>rows.get(item.id)?.completedAt))return;const examKey='juz_exam_'+juz.num;const exam=Array.from(rows.values()).map(item=>item.activities?.[examKey]).find(item=>Number(item?.score)===100);if(!exam)return;events.push({role:'student',type:'juz',date:exam.date||firstDate(required.map(item=>rows.get(item.id)?.completedAt)),person,title:'أتم '+juz.name,detail:'',score:0})})});
    return events;
  }
  function homeworkTimestamp(row){const direct=row.created_at||row.createdAt;const match=String(row.id||'').match(/\d{13}/);return direct||(match?new Date(Number(match[0])).toISOString():'')}
  function studentDisplay(map,id){const item=map.get(id);return item?studentName(item):(id||'طالب(ة)')}
  function profDisplay(map,id,fallback){const item=map.get(id);return item?.prenom||fallback||id||'أستاذ(ة)'}

  async function loadActivity(){
    const client=Auth.getSupabaseClient&&Auth.getSupabaseClient();
    if(!client){state.error='تعذر الاتصال ببيانات النشاط.';state.activityStatus='error';renderActivity();return}
    state.activityStatus=state.activityEvents.length?'refreshing':'loading';
    renderActivity();
    try{
      const [progressRows,studentRows,profRows,messageRows,dutyRows]=await Promise.all([
        fetchAllRows(client,'progressions'),fetchAllRows(client,'eleves','username,prenom,nom'),fetchAllRows(client,'profs','username,prenom,classe'),fetchAllRows(client,'messages'),fetchAllRows(client,'devoirs')
      ]);
      const studentMap=new Map(studentRows.map(item=>[item.username,item]));
      const profMap=new Map(profRows.map(item=>[item.username,item]));
      const events=buildStudentCompletionEvents(progressRows,studentMap);
      messageRows.forEach(row=>{
        const virtualRecitation=parseActivityPayload(row.text,'[VIRTUAL_TEACHER_RECITATION] ');
        if(virtualRecitation){
          const score=Math.max(0,Math.min(100,Number(virtualRecitation.score)||0));
          const review=Array.isArray(virtualRecitation.reviewVerses)&&virtualRecitation.reviewVerses.length?' · راجع الآيات '+virtualRecitation.reviewVerses.join('، '):'';
          events.push({role:'student',type:'virtual-recitation',date:virtualRecitation.createdAt||row.created_at,person:studentDisplay(studentMap,virtualRecitation.studentId),title:'تسميع مع الأستاذ الذكي · '+(virtualRecitation.surahName||'سورة'),detail:(virtualRecitation.juzName||'')+' · '+(virtualRecitation.appreciation||'')+' · '+score+'%'+review,score});return;
        }
        const note=parseActivityPayload(row.text,'[TEACHER_NOTE] ');
        if(note){events.push({role:'prof',type:'reading',date:note.savedAt||row.created_at,person:profDisplay(profMap,note.profId,note.profName),title:'قراءة مسجلة',detail:studentDisplay(studentMap,note.studentId)+' · '+(note.surah||note.surate||'سورة')+(note.scope?(' · '+note.scope):''),score:0});return}
        const report=parseActivityPayload(row.text,'[SIGNAL_ADMIN] ');
        if(report){events.push({role:'prof',type:'report',date:report.sentAt||row.created_at,person:profDisplay(profMap,report.profId,report.profName),title:'رسالة إلى الإدارة',detail:report.category||'متابعة',score:0});return}
        const lesson=parseActivityPayload(row.text,'[CLASS_SESSION] ');
        if(lesson)events.push({role:'prof',type:'session',date:lesson.savedAt||row.created_at,person:profDisplay(profMap,lesson.profId,lesson.profName),title:'حصة مسجلة',detail:lesson.classe||'',score:0});
      });
      dutyRows.forEach(row=>events.push({role:'prof',type:'homework',date:homeworkTimestamp(row),person:profDisplay(profMap,row.prof_id,row.prof_name),title:'واجب مرسل',detail:studentDisplay(studentMap,row.student_id)+' · '+(row.surate||'سورة'),score:0}));
      const unique=new Map();
      events.filter(item=>activityDate(item.date)).forEach(item=>unique.set([item.role,item.type,item.person,item.title,item.date].join('|'),item));
      state.activityEvents=Array.from(unique.values()).sort((a,b)=>activityDate(b.date)-activityDate(a.date)).slice(0,500);
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
    main.innerHTML=heading('النشاط المباشر','السور والأجزاء المكتملة، والتسميع الذكي، وآخر أعمال الأساتذة(ات).')+
      `<div class="admin-live-head"><div class="admin-live-state ${state.activityStatus}"><span></span>${statusText}</div><div class="admin-row-meta">آخر تحديث: ${state.activityUpdatedAt?activityTime(state.activityUpdatedAt):'—'}</div></div>`+
      `<div class="admin-kpis">${kpi(studentEvents.filter(item=>item.type==='surah').length,'سور مكتملة')}${kpi(studentEvents.filter(item=>item.type==='juz').length,'أجزاء مكتملة')}${kpi(studentEvents.filter(item=>item.type==='virtual-recitation').length,'تسميع ذكي')}${kpi(activeStudents,'طلاب(ات) نشطون')}${kpi(activeProfs,'أساتذة(ات) نشطون')}</div>`+
      `<div class="admin-live-filters"><button class="${state.activityFilter==='all'?'active':''}" onclick="setAdminActivityFilter('all')">الكل</button><button class="${state.activityFilter==='student'?'active':''}" onclick="setAdminActivityFilter('student')">الطلاب(ات)</button><button class="${state.activityFilter==='prof'?'active':''}" onclick="setAdminActivityFilter('prof')">الأساتذة(ات)</button><button onclick="refreshAdminActivity()">تحديث</button></div>`+
      `<div class="admin-live-list">${filtered.length?filtered.slice(0,100).map(item=>`<article class="admin-live-row ${item.role}"><div class="admin-live-icon">${item.type==='juz'?'✓':item.type==='virtual-recitation'?'🎙️':item.role==='student'?'📖':'🧑‍🏫'}</div><div class="admin-live-copy"><div class="admin-row-title">${esc(item.person)} · ${esc(item.title)}</div>${item.detail?`<div class="admin-row-meta">${esc(item.detail)}</div>`:''}</div><time>${activityTime(item.date)}</time></article>`).join(''):empty(state.activityStatus==='loading'?'جاري تحميل النشاط...':'لا يوجد نشاط مسجل بعد.')}</div>`;
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
    activityPoll=setInterval(()=>{if(!document.hidden)loadActivity()},10000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadActivity()});
    addEventListener('online',loadActivity);
    addEventListener('pageshow',event=>{if(event.persisted)loadActivity()});
    addEventListener('beforeunload',()=>{clearInterval(activityPoll);if(activityChannel&&client?.removeChannel)client.removeChannel(activityChannel)},{once:true});
  }
  async function reload(message){await load();if(message)toast(message)}
  function toast(text){const node=document.createElement('div');node.className='admin-status';node.style.cssText='position:fixed;z-index:200;top:14px;left:50%;transform:translateX(-50%);background:#124c35;color:#fff';node.textContent=text;document.body.appendChild(node);setTimeout(()=>node.remove(),2200)}
  function initNav(){const nav=document.getElementById('admin-nav');requestAnimationFrame(()=>nav.querySelector('.active')?.scrollIntoView({block:'nearest',inline:'center'}));let last=scrollY;addEventListener('scroll',()=>{const y=scrollY;if(Math.abs(y-last)<5)return;nav.classList.toggle('nav-scroll-hidden',y>last&&y>80);last=y},{passive:true})}

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
