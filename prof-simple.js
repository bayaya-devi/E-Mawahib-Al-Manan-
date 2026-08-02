(function(){
  'use strict';

  const page = document.body.dataset.profPage || 'recitation';
  const today = () => new Date().toISOString().slice(0,10);
  const SHARED_STUDENT_KEY = 'mawahib_prof_student';
  const STUDENT_KEY_PREFIX = 'mawahib_prof_student_';
  const HISTORY_TAB_KEY = 'mawahib_prof_history_tab';
  const HOMEWORK_WARNING_PREFIX = '__mawahib_homework_not_done__';

  function studentName(student){return ((student?.prenom||'')+' '+(student?.nom||'')).trim()||student?.username||''}
  function options(items,selected){return items.map(item=>'<option value="'+escapeHtml(item.value)+'" '+(item.value===selected?'selected':'')+'>'+escapeHtml(item.label)+'</option>').join('')}
  function studentOptions(selected){return options(myStudents.map(student=>({value:student.username,label:studentName(student)})),selected)}
  function surahs(){return typeof SURAH_REGISTRY!=='undefined'?SURAH_REGISTRY:[]}
  function surahOptionsSimple(selected){return options(surahs().filter(s=>s.available).map(s=>({value:s.nameAr,label:s.nameAr})),selected)}
  function surahAyat(name){const item=surahs().find(s=>s.nameAr===name);return item?.ayat||1}
  function validVerseRange(scope,start,end){if(scope!=='جزء')return true;const first=Number(start);const last=Number(end);return Number.isInteger(first)&&Number.isInteger(last)&&first>=1&&last>=first}
  function homeworkIsOpen(item){return !['termine','complete','valide','non_realise'].includes(item?.statut)}
  function homeworkIsDone(item){return ['termine','complete','valide'].includes(item?.statut)}
  function homeworkStatusValue(item){return homeworkIsDone(item)?'termine':(item?.statut==='non_realise'?'non_realise':'en_attente')}
  function homeworkStatusLabel(status){return status==='termine'?'منجز':(status==='non_realise'?'غير منجز':'قيد العمل')}
  function homeworkStatusOptions(selected){return options([{value:'en_attente',label:'قيد العمل'},{value:'termine',label:'منجز'},{value:'non_realise',label:'غير منجز'}],selected)}
  function studentStorageKey(){return STUDENT_KEY_PREFIX+(session?.username||'teacher')}
  function isStudentId(username){return myStudents.some(student=>student.username===username)}
  function selectedStudentId(fallback=''){
    const candidates=[sessionStorage.getItem(SHARED_STUDENT_KEY),localStorage.getItem(studentStorageKey()),localStorage.getItem(SHARED_STUDENT_KEY),fallback];
    const stored=candidates.find(isStudentId);
    if(stored)return stored;
    localStorage.removeItem(studentStorageKey());
    localStorage.removeItem(SHARED_STUDENT_KEY);
    sessionStorage.removeItem(SHARED_STUDENT_KEY);
    return myStudents[0]?.username||''
  }
  function rememberStudent(username){
    if(!isStudentId(username))return '';
    localStorage.setItem(studentStorageKey(),username);
    localStorage.setItem(SHARED_STUDENT_KEY,username);
    sessionStorage.setItem(SHARED_STUDENT_KEY,username);
    return username
  }
  function syncSimpleStudentControls(username){
    const remembered=rememberStudent(username||selectedStudentId());
    if(!remembered)return '';
    const name=studentName(myStudents.find(student=>student.username===remembered));
    ['rec-student','hw-student','simple-student-select','simple-report-student','homework-student'].forEach(id=>{
      const select=document.getElementById(id);
      if(select&&[...select.options].some(option=>option.value===remembered))select.value=remembered
    });
    const reportSelect=document.getElementById('report-student');
    if(reportSelect&&name&&[...reportSelect.options].some(option=>option.value===name))reportSelect.value=name;
    return remembered
  }
  function setBusy(button,busy){if(button){button.disabled=busy;button.textContent=busy?'جار الحفظ...':button.dataset.label}}
  function showRange(scopeId,rangeId){const scope=document.getElementById(scopeId);const range=document.getElementById(rangeId);if(range)range.classList.toggle('prof-hidden',!scope||scope.value!=='جزء')}
  function resetForm(id){const form=document.getElementById(id);if(form)form.reset();document.querySelectorAll('.prof-range').forEach(node=>node.classList.add('prof-hidden'))}

  function shell(){
    document.querySelector('.shell').outerHTML='<div class="prof-simple-shell"><header class="prof-simple-head"><div class="prof-simple-identity"><img src="logo.webp" class="prof-simple-logo" alt=""><div class="min-w-0"><div class="prof-simple-title">'+escapeHtml(session?.prenom||'الأستاذ')+'</div><div class="prof-simple-subtitle">'+escapeHtml(session?.nom||'')+'</div></div></div><a href="remote-class.html" class="prof-small-action">عن بُعد</a><button type="button" class="prof-small-action danger" onclick="deconnexion()">خروج</button></header><main id="prof-simple-main" class="prof-simple-main"></main></div>';
  }

  function pageHeader(title,help){return '<h1 class="prof-simple-heading">'+title+'</h1><p class="prof-simple-help">'+help+'</p>'}

  function renderHome(){
    const main=document.getElementById('prof-simple-main');
    const todayHomework=myDevoirs.filter(item=>item.date_limite===today());
    const openToday=todayHomework.filter(homeworkIsOpen);
    const doneToday=todayHomework.filter(homeworkIsDone);
    const missedToday=todayHomework.filter(item=>item.statut==='non_realise');
    main.innerHTML=pageHeader('الرئيسية','ملخص سريع للطلاب وواجبات اليوم.')+
      '<section class="prof-home-grid">'+
      '<article class="prof-home-card"><div class="prof-home-label">عدد الطلاب</div><strong>'+myStudents.length+'</strong></article>'+
      '<article class="prof-home-card"><div class="prof-home-label">واجبات اليوم</div><strong>'+todayHomework.length+'</strong></article>'+
      '<article class="prof-home-card"><div class="prof-home-label">قيد العمل</div><strong>'+openToday.length+'</strong></article>'+
      '<article class="prof-home-card"><div class="prof-home-label">منجز / غير منجز</div><strong>'+doneToday.length+' / '+missedToday.length+'</strong></article>'+
      '</section><div id="prof-home-today" class="prof-list">'+renderTodayHomeworkRows(todayHomework)+'</div>';
  }

  function renderTodayHomeworkRows(items){
    if(!items.length)return '<div class="prof-empty">لا توجد واجبات لليوم.</div>';
    return '<h2 class="prof-section-title">واجبات اليوم</h2>'+items.map(homeworkRowHtml).join('');
  }

  function homeworkRowHtml(item){
    const student=myStudents.find(st=>st.username===item.student_id);
    const status=homeworkStatusValue(item);
    return '<div class="prof-row"><div class="prof-row-title">'+escapeHtml(studentName(student))+' · '+escapeHtml(item.surate||'')+'</div>'+
      '<div class="prof-row-meta">من '+escapeHtml(item.aya_debut||'')+' إلى '+escapeHtml(item.aya_fin||'')+' · '+escapeHtml(item.date_limite||'')+'</div>'+
      '<div class="prof-row-actions"><label class="prof-status-control"><span>الحالة</span><select class="prof-status-select" onchange="updateSimpleHomeworkStatus(\''+escapeArg(item.id)+'\', this.value)">'+homeworkStatusOptions(status)+'</select></label>'+
      '<button class="prof-small-action" onclick="remindSimpleHomework(\''+escapeArg(item.id)+'\')">تذكير اليوم</button><button class="prof-small-action danger" onclick="deleteSimpleHomework(\''+escapeArg(item.id)+'\')">حذف</button></div></div>';
  }

  function renderRecitation(){
    const main=document.getElementById('prof-simple-main');
    const selected=selectedStudentId(document.getElementById('rec-student')?.value);
    main.innerHTML=pageHeader('تسجيل حفظ','اختر الطالب ثم سجل الحفظ.')+
      '<form id="rec-form" class="prof-simple-form" onsubmit="saveSimpleRecitation(event)">'+
      '<label class="prof-field"><span>الطالب</span><select id="rec-student" class="prof-control" required onchange="rememberSimpleStudent(this.value)">'+studentOptions(selected)+'</select></label>'+
      '<label class="prof-field"><span>السورة</span><select id="rec-surah" class="prof-control" required><option value="">اختر السورة</option>'+surahOptionsSimple('')+'</select></label>'+
      '<label class="prof-field"><span>المقدار</span><select id="rec-scope" class="prof-control" onchange="showSimpleRange(\'rec-scope\',\'rec-range\')"><option value="كاملة">السورة كاملة</option><option value="جزء">من آية إلى آية</option></select></label>'+
      '<div id="rec-range" class="prof-range prof-hidden"><label class="prof-field"><span>من الآية</span><input id="rec-start" type="number" inputmode="numeric" min="1" step="1" class="prof-control"></label><label class="prof-field"><span>إلى الآية</span><input id="rec-end" type="number" inputmode="numeric" min="1" step="1" class="prof-control"></label></div>'+
      '<label class="prof-field"><span>التقدير</span><select id="rec-result" class="prof-control"><option>ممتاز</option><option>جيد جدا</option><option>جيد</option><option>يحتاج مراجعة</option><option>غير متقن</option></select></label>'+
      '<label class="prof-field prof-field-wide"><span>ملاحظة قصيرة</span><textarea id="rec-comment" class="prof-control" placeholder="اختياري"></textarea></label>'+
      '<div class="prof-actions"><button data-label="تسجيل الحفظ" class="prof-action prof-action-primary" type="submit">تسجيل الحفظ</button><button class="prof-action prof-action-secondary" type="button" onclick="resetSimpleForm(\'rec-form\')">إلغاء</button></div></form>';
  }

  function renderHomework(){
    const main=document.getElementById('prof-simple-main');
    const selected=selectedStudentId(document.getElementById('hw-student')?.value);
    main.innerHTML=pageHeader('إرسال واجب','اختر الطالب والسورة والمقدار.')+
      '<form id="hw-form" class="prof-simple-form" onsubmit="sendSimpleHomework(event)">'+
      '<label class="prof-field"><span>الطالب</span><select id="hw-student" class="prof-control" required onchange="rememberSimpleStudent(this.value)">'+studentOptions(selected)+'</select></label>'+
      '<label class="prof-field"><span>السورة</span><select id="hw-surah" class="prof-control" required><option value="">اختر السورة</option>'+surahOptionsSimple('')+'</select></label>'+
      '<label class="prof-field"><span>المقدار</span><select id="hw-scope" class="prof-control" onchange="showSimpleRange(\'hw-scope\',\'hw-range\')"><option value="كاملة">السورة كاملة</option><option value="جزء">من آية إلى آية</option></select></label>'+
      '<div id="hw-range" class="prof-range prof-hidden"><label class="prof-field"><span>من الآية</span><input id="hw-start" type="number" inputmode="numeric" min="1" step="1" class="prof-control"></label><label class="prof-field"><span>إلى الآية</span><input id="hw-end" type="number" inputmode="numeric" min="1" step="1" class="prof-control"></label></div>'+
      '<label class="prof-field"><span>موعد الواجب</span><input id="hw-date" type="date" class="prof-control" value="'+today()+'" required></label>'+
      '<div class="prof-actions"><button data-label="إرسال الواجب" class="prof-action prof-action-primary" type="submit">إرسال الواجب</button><button class="prof-action prof-action-secondary" type="button" onclick="resetSimpleForm(\'hw-form\')">إلغاء</button></div></form><div id="prof-homework-list" class="prof-list"></div>';
    renderHomeworkList();
  }

  function renderHomeworkList(){
    const box=document.getElementById('prof-homework-list');if(!box)return;
    const items=myDevoirs.slice(0,20);
    box.innerHTML=items.length?'<h2 class="prof-row-title">\u0627\u0644\u0648\u0627\u062c\u0628\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629</h2>'+items.map(homeworkRowHtml).join(''):'<div class="prof-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u0627\u062c\u0628\u0627\u062a \u062d\u0627\u0644\u064a\u0629.</div>';
  }

  function verseLabel(scope,start,end){return scope==='جزء'&&start&&end?'من الآية '+start+' إلى الآية '+end:'السورة كاملة'}
  function homeworkVerseLabel(item){return item.aya_debut&&item.aya_fin?'من الآية '+item.aya_debut+' إلى الآية '+item.aya_fin:'السورة كاملة'}

  function renderStudents(){
    const main=document.getElementById('prof-simple-main');
    const dueIds=[...new Set(myDevoirs.filter(item=>homeworkIsOpen(item)&&item.date_limite===today()).map(item=>item.student_id))];
    const selected=selectedStudentId(dueIds[0]);
    rememberStudent(selected);
    main.innerHTML=pageHeader('متابعة الطلاب','اختر طالبا لعرض سجل الحفظ والواجبات.')+
      (dueIds.length?'<section class="prof-today"><div class="prof-today-title">لديهم واجب اليوم</div><div class="prof-today-students">'+dueIds.map(id=>{const student=myStudents.find(s=>s.username===id);return '<button class="prof-today-student" onclick="selectSimpleStudent(\''+escapeArg(id)+'\')">'+escapeHtml(studentName(student))+'</button>'}).join('')+'</div></section>':'')+
      '<label class="prof-field"><span>الطالب</span><select id="simple-student-select" class="prof-control" onchange="selectSimpleStudent(this.value)">'+studentOptions(selected)+'</select></label><div id="simple-student-detail" class="prof-list"></div>';
    renderStudentDetail(selected);
  }

  function readingTable(notes){
    if(!notes.length)return '<div class="prof-empty">لا توجد قراءات مسجلة.</div>';
    return '<div class="prof-table-wrap"><table class="prof-history-table"><thead><tr><th>التاريخ</th><th>السورة</th><th>المقدار</th><th>التقدير</th><th>الملاحظة</th></tr></thead><tbody>'+notes.map(note=>'<tr><td>'+escapeHtml(formatDate(note.savedAt||note.date))+'</td><td>'+escapeHtml(note.surah||'')+'</td><td>'+escapeHtml(verseLabel(note.scope,note.ayahStart,note.ayahEnd))+'</td><td><span class="prof-evaluation">'+escapeHtml(note.validation||'')+'</span></td><td>'+escapeHtml(note.comment||'—')+'</td></tr>').join('')+'</tbody></table></div>';
  }

  function homeworkStatus(item){return homeworkStatusLabel(homeworkStatusValue(item))}
  function homeworkTable(duties){
    if(!duties.length)return '<div class="prof-empty">لا توجد واجبات مسجلة.</div>';
    return '<div class="prof-table-wrap"><table class="prof-history-table"><thead><tr><th>التاريخ</th><th>السورة</th><th>المقدار</th><th>الحالة</th></tr></thead><tbody>'+duties.map(item=>'<tr><td>'+escapeHtml(formatDate(item.date_limite||item.created_at||item.date))+'</td><td>'+escapeHtml(item.surate||'')+'</td><td>'+escapeHtml(homeworkVerseLabel(item))+'</td><td><span class="prof-status-pill">'+escapeHtml(homeworkStatus(item))+'</span></td></tr>').join('')+'</tbody></table></div>';
  }

  function renderStudentDetail(username){
    const box=document.getElementById('simple-student-detail');if(!box)return;
    const notes=(teacherNotesCache[username]||[]).slice(0,50);
    const duties=myDevoirs.filter(item=>item.student_id===username).slice(0,50);
    const activeTab=localStorage.getItem(HISTORY_TAB_KEY)==='homework'?'homework':'reading';
    box.innerHTML='<div class="prof-history-tabs" role="tablist" aria-label="سجل الطالب"><button type="button" role="tab" aria-selected="'+(activeTab==='reading')+'" class="prof-history-tab '+(activeTab==='reading'?'active':'')+'" onclick="setSimpleHistoryTab(\'reading\')">الحفظ</button><button type="button" role="tab" aria-selected="'+(activeTab==='homework')+'" class="prof-history-tab '+(activeTab==='homework'?'active':'')+'" onclick="setSimpleHistoryTab(\'homework\')">الواجبات</button></div>'+(activeTab==='reading'?readingTable(notes):homeworkTable(duties));
  }

  function renderReport(){
    const main=document.getElementById('prof-simple-main');
    const selected=selectedStudentId();
    main.innerHTML=pageHeader('رسالة إلى الإدارة','اكتب الرسالة ثم أرسلها.')+'<form id="report-form" class="prof-simple-form" onsubmit="sendSimpleReport(event)"><label class="prof-field"><span>المعني</span><select id="simple-report-student" class="prof-control" onchange="rememberSimpleStudent(this.value)"><option value="القسم كاملا">القسم كاملا</option>'+studentOptions(selected)+'</select></label><label class="prof-field prof-field-wide"><span>الرسالة</span><textarea id="simple-report-text" class="prof-control" required placeholder="اكتب الرسالة"></textarea></label><div class="prof-actions"><button data-label="إرسال الرسالة" class="prof-action prof-action-primary" type="submit">إرسال الرسالة</button><button class="prof-action prof-action-secondary" type="button" onclick="resetSimpleForm(\'report-form\')">إلغاء</button></div></form>';
  }

  function render(){if(!document.querySelector('.prof-simple-shell'))shell();document.querySelectorAll('[data-prof-tab]').forEach(link=>link.classList.toggle('active',link.dataset.profTab===page));if(page==='home')renderHome();else if(page==='recitation')renderRecitation();else if(page==='homework')renderHomework();else if(page==='students')renderStudents();else renderReport();syncSimpleStudentControls(selectedStudentId())}

  window.showSimpleRange=showRange;
  window.resetSimpleForm=resetForm;
  window.rememberSimpleStudent=function(username){syncSimpleStudentControls(username)};
  window.selectSimpleStudent=function(username){const remembered=syncSimpleStudentControls(username);if(remembered)renderStudentDetail(remembered)};
  window.setSimpleHistoryTab=function(tab){localStorage.setItem(HISTORY_TAB_KEY,tab==='homework'?'homework':'reading');renderStudentDetail(selectedStudentId())};
  window.addEventListener('storage',function(event){if(event.key===SHARED_STUDENT_KEY||event.key===studentStorageKey()){const remembered=syncSimpleStudentControls(selectedStudentId());if(page==='students'&&remembered)renderStudentDetail(remembered)}});
  window.saveSimpleRecitation=async function(event){event.preventDefault();const button=event.submitter;const username=document.getElementById('rec-student').value;const surah=document.getElementById('rec-surah').value;const scope=document.getElementById('rec-scope').value;const start=document.getElementById('rec-start').value;const end=document.getElementById('rec-end').value;if(!username||!surah||(scope==='جزء'&&(!start||!end))){showToast('أكمل المعلومات المطلوبة');return}if(!validVerseRange(scope,start,end)){showToast('تحقق من أرقام الآيات');return}rememberStudent(username);setBusy(button,true);const note={validation:document.getElementById('rec-result').value,comment:document.getElementById('rec-comment').value.trim(),surah,scope,ayahStart:scope==='جزء'?start:'',ayahEnd:scope==='جزء'?end:'',source:'recitation',date:today()};await Auth.saveTeacherNote(username,note);await Auth.saveClassSession(session.username,{id:'session_'+Date.now(),date:today(),present:[username],absent:[],validations:[{username,...note}],total:1});await refreshProfDashboard(false);render();showToast('تم تسجيل الحفظ')};
  window.sendSimpleHomework=async function(event){event.preventDefault();const button=event.submitter;const student=document.getElementById('hw-student').value;const surah=document.getElementById('hw-surah').value;const scope=document.getElementById('hw-scope').value;const start=scope==='جزء'?document.getElementById('hw-start').value:'1';const end=scope==='جزء'?document.getElementById('hw-end').value:String(surahAyat(surah));const date=document.getElementById('hw-date').value;if(!student||!surah||!start||!end||!date){showToast('أكمل المعلومات المطلوبة');return}if(!validVerseRange(scope,start,end)){showToast('تحقق من أرقام الآيات');return}rememberStudent(student);setBusy(button,true);const result=await Auth.ajouterDevoir(student,session.prenom,surah,start,end,date);if(result.ok){await refreshProfDashboard(false);render();showToast('تم إرسال الواجب')}else{setBusy(button,false);showToast(result.error||'تعذر الإرسال')}};
  window.deleteSimpleHomework=async function(id){if(!confirm('حذف هذا الواجب؟'))return;await Auth.annulerDevoir(id);await refreshProfDashboard(false);render();showToast('تم حذف الواجب')};
  window.updateSimpleHomeworkStatus=async function(id,status){const item=myDevoirs.find(row=>row.id===id);if(!item)return;const previous=homeworkStatusValue(item);if(previous===status)return;const result=await Auth.updateDevoirStatut(id,status);if(result&&result.ok===false){showToast(result.error||'تعذر تحديث الواجب');render();return}if(status==='non_realise'&&previous!=='non_realise'){const now=Date.now();const payload={type:'homework_not_done',devoirId:id,surah:item.surate||'',ayaDebut:item.aya_debut||'',ayaFin:item.aya_fin||'',createdAt:now,expiresAt:now+24*60*60*1000};await Auth.sendMessage(item.student_id,HOMEWORK_WARNING_PREFIX+JSON.stringify(payload))}await refreshProfDashboard(false);render();showToast('تم تحديث حالة الواجب')};
  window.remindSimpleHomework=async function(id){const item=myDevoirs.find(row=>row.id===id);if(!item)return;await Auth.sendMessage(item.student_id,'تذكير: لديك واجب اليوم في '+(item.surate||'السورة'));showToast('تم إرسال التذكير')};
  window.sendSimpleReport=async function(event){event.preventDefault();const button=event.submitter;const studentId=document.getElementById('simple-report-student').value;const student=myStudents.find(entry=>entry.username===studentId);const subject=student?studentName(student):studentId;const message=document.getElementById('simple-report-text').value.trim();if(!message){showToast('اكتب الرسالة');return}if(student)rememberStudent(studentId);setBusy(button,true);const result=await Auth.sendAdminReport(session.username,session.prenom,session.nom,'المعني: '+subject+'\n'+message,'متابعة');if(result.ok){resetForm('report-form');showToast('تم إرسال الرسالة')}else{setBusy(button,false);showToast(result.error||'تعذر الإرسال')}};

  window.addEventListener('DOMContentLoaded',function(){window.renderAll=render;const wait=setInterval(function(){if(typeof session!=='undefined'&&session&&Array.isArray(myStudents)){clearInterval(wait);render()}},80);setTimeout(()=>clearInterval(wait),10000)});
})();
