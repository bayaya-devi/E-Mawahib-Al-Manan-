(function(){
  'use strict';

  const page = document.body.dataset.profPage || 'recitation';
  const today = () => new Date().toISOString().slice(0,10);
  const names = {recitation:'التسميع',students:'الطلاب',homework:'الواجبات',report:'الإدارة'};

  function studentName(student){return ((student?.prenom||'')+' '+(student?.nom||'')).trim()||student?.username||''}
  function options(items,selected){return items.map(item=>'<option value="'+escapeHtml(item.value)+'" '+(item.value===selected?'selected':'')+'>'+escapeHtml(item.label)+'</option>').join('')}
  function studentOptions(selected){return options(myStudents.map(student=>({value:student.username,label:studentName(student)})),selected)}
  function surahs(){return typeof SURAH_REGISTRY!=='undefined'?SURAH_REGISTRY:[]}
  function surahOptionsSimple(selected){return options(surahs().filter(s=>s.available).map(s=>({value:s.nameAr,label:s.nameAr})),selected)}
  function surahAyat(name){const item=surahs().find(s=>s.nameAr===name);return item?.ayat||1}
  function setBusy(button,busy){if(button){button.disabled=busy;button.textContent=busy?'جار الحفظ...':button.dataset.label}}
  function showRange(scopeId,rangeId){const scope=document.getElementById(scopeId);const range=document.getElementById(rangeId);if(range)range.classList.toggle('prof-hidden',!scope||scope.value!=='جزء')}
  function resetForm(id){const form=document.getElementById(id);if(form)form.reset();document.querySelectorAll('.prof-range').forEach(node=>node.classList.add('prof-hidden'))}

  function shell(){
    document.querySelector('.shell').outerHTML='<div class="prof-simple-shell"><header class="prof-simple-head"><div class="prof-simple-identity"><img src="logo.webp" class="prof-simple-logo" alt=""><div class="min-w-0"><div class="prof-simple-title">'+escapeHtml(session?.prenom||'الأستاذ')+'</div><div class="prof-simple-subtitle">'+escapeHtml(session?.nom||'')+'</div></div></div><button type="button" class="prof-small-action danger" onclick="deconnexion()">خروج</button></header><main id="prof-simple-main" class="prof-simple-main"></main></div>';
  }

  function pageHeader(title,help){return '<h1 class="prof-simple-heading">'+title+'</h1><p class="prof-simple-help">'+help+'</p>'}

  function renderRecitation(){
    const main=document.getElementById('prof-simple-main');
    const selected=document.getElementById('rec-student')?.value||myStudents[0]?.username||'';
    main.innerHTML=pageHeader('تسجيل تلاوة','اختر الطالب ثم أدخل التلاوة فقط.')+
      '<form id="rec-form" class="prof-simple-form" onsubmit="saveSimpleRecitation(event)">'+
      '<label class="prof-field"><span>الطالب</span><select id="rec-student" class="prof-control" required>'+studentOptions(selected)+'</select></label>'+
      '<label class="prof-field"><span>السورة</span><select id="rec-surah" class="prof-control" required><option value="">اختر السورة</option>'+surahOptionsSimple('')+'</select></label>'+
      '<label class="prof-field"><span>المقدار</span><select id="rec-scope" class="prof-control" onchange="showSimpleRange(\'rec-scope\',\'rec-range\')"><option value="كاملة">السورة كاملة</option><option value="جزء">من آية إلى آية</option></select></label>'+
      '<div id="rec-range" class="prof-range prof-hidden"><label class="prof-field"><span>من الآية</span><input id="rec-start" type="number" min="1" class="prof-control"></label><label class="prof-field"><span>إلى الآية</span><input id="rec-end" type="number" min="1" class="prof-control"></label></div>'+
      '<label class="prof-field"><span>التقدير</span><select id="rec-result" class="prof-control"><option>ممتاز</option><option>جيد جدا</option><option>جيد</option><option>يحتاج مراجعة</option><option>غير متقن</option></select></label>'+
      '<label class="prof-field"><span>ملاحظة قصيرة</span><textarea id="rec-comment" class="prof-control" placeholder="اختياري"></textarea></label>'+
      '<div class="prof-actions"><button data-label="حفظ التلاوة" class="prof-action prof-action-primary" type="submit">حفظ التلاوة</button><button class="prof-action prof-action-secondary" type="button" onclick="resetSimpleForm(\'rec-form\')">إلغاء</button></div></form>';
  }

  function renderHomework(){
    const main=document.getElementById('prof-simple-main');
    const selected=document.getElementById('hw-student')?.value||myStudents[0]?.username||'';
    main.innerHTML=pageHeader('إرسال واجب','اختر الطالب والسورة والمقدار.')+
      '<form id="hw-form" class="prof-simple-form" onsubmit="sendSimpleHomework(event)">'+
      '<label class="prof-field"><span>الطالب</span><select id="hw-student" class="prof-control" required>'+studentOptions(selected)+'</select></label>'+
      '<label class="prof-field"><span>السورة</span><select id="hw-surah" class="prof-control" required><option value="">اختر السورة</option>'+surahOptionsSimple('')+'</select></label>'+
      '<label class="prof-field"><span>المقدار</span><select id="hw-scope" class="prof-control" onchange="showSimpleRange(\'hw-scope\',\'hw-range\')"><option value="كاملة">السورة كاملة</option><option value="جزء">من آية إلى آية</option></select></label>'+
      '<div id="hw-range" class="prof-range prof-hidden"><label class="prof-field"><span>من الآية</span><input id="hw-start" type="number" min="1" class="prof-control"></label><label class="prof-field"><span>إلى الآية</span><input id="hw-end" type="number" min="1" class="prof-control"></label></div>'+
      '<label class="prof-field"><span>موعد الواجب</span><input id="hw-date" type="date" class="prof-control" value="'+today()+'" required></label>'+
      '<div class="prof-actions"><button data-label="إرسال الواجب" class="prof-action prof-action-primary" type="submit">إرسال الواجب</button><button class="prof-action prof-action-secondary" type="button" onclick="resetSimpleForm(\'hw-form\')">إلغاء</button></div></form><div id="prof-homework-list" class="prof-list"></div>';
    renderHomeworkList();
  }

  function renderHomeworkList(){
    const box=document.getElementById('prof-homework-list');if(!box)return;
    const open=myDevoirs.filter(item=>item.statut!=='termine').slice(0,12);
    box.innerHTML=open.length?'<h2 class="prof-row-title">الواجبات الحالية</h2>'+open.map(item=>{const student=myStudents.find(s=>s.username===item.student_id);return '<div class="prof-row"><div class="prof-row-title">'+escapeHtml(studentName(student))+' · '+escapeHtml(item.surate||'')+'</div><div class="prof-row-meta">من '+escapeHtml(item.aya_debut||'')+' إلى '+escapeHtml(item.aya_fin||'')+' · '+escapeHtml(item.date_limite||'')+'</div><div class="prof-row-actions"><button class="prof-small-action" onclick="remindSimpleHomework(\''+escapeArg(item.id)+'\')">تذكير اليوم</button><button class="prof-small-action danger" onclick="deleteSimpleHomework(\''+escapeArg(item.id)+'\')">حذف</button></div></div>'}).join(''):'<div class="prof-empty">لا توجد واجبات حالية.</div>';
  }

  function renderStudents(){
    const main=document.getElementById('prof-simple-main');
    const dueIds=[...new Set(myDevoirs.filter(item=>item.statut!=='termine'&&item.date_limite===today()).map(item=>item.student_id))];
    const selected=sessionStorage.getItem('mawahib_prof_student')||dueIds[0]||myStudents[0]?.username||'';
    main.innerHTML=pageHeader('متابعة الطلاب','اختر طالبا لعرض آخر التلاوات والواجبات الحالية.')+
      (dueIds.length?'<section class="prof-today"><div class="prof-today-title">لديهم واجب اليوم</div><div class="prof-today-students">'+dueIds.map(id=>{const student=myStudents.find(s=>s.username===id);return '<button class="prof-today-student" onclick="selectSimpleStudent(\''+escapeArg(id)+'\')">'+escapeHtml(studentName(student))+'</button>'}).join('')+'</div></section>':'')+
      '<label class="prof-field"><span>الطالب</span><select id="simple-student-select" class="prof-control" onchange="selectSimpleStudent(this.value)">'+studentOptions(selected)+'</select></label><div id="simple-student-detail" class="prof-list"></div>';
    renderStudentDetail(selected);
  }

  function renderStudentDetail(username){
    const box=document.getElementById('simple-student-detail');if(!box)return;
    const notes=(teacherNotesCache[username]||[]).slice(0,8);
    const duties=myDevoirs.filter(item=>item.student_id===username&&item.statut!=='termine').slice(0,8);
    box.innerHTML='<h2 class="prof-row-title">التلاوات السابقة</h2>'+(notes.length?notes.map(note=>'<div class="prof-row"><div class="prof-row-title">'+escapeHtml(note.surah||'تلاوة')+' · '+escapeHtml(note.validation||'')+'</div><div class="prof-row-meta">'+escapeHtml(note.comment||'')+' '+escapeHtml(formatDate(note.savedAt||note.date))+'</div></div>').join(''):'<div class="prof-empty">لا توجد تلاوات مسجلة.</div>')+'<h2 class="prof-row-title">الواجبات الحالية</h2>'+(duties.length?duties.map(item=>'<div class="prof-row"><div class="prof-row-title">'+escapeHtml(item.surate||'')+'</div><div class="prof-row-meta">من '+escapeHtml(item.aya_debut||'')+' إلى '+escapeHtml(item.aya_fin||'')+' · '+escapeHtml(item.date_limite||'')+'</div></div>').join(''):'<div class="prof-empty">لا يوجد واجب حالي.</div>');
  }

  function renderReport(){
    const main=document.getElementById('prof-simple-main');
    main.innerHTML=pageHeader('رسالة إلى الإدارة','اكتب الرسالة ثم أرسلها.')+'<form id="report-form" class="prof-simple-form" onsubmit="sendSimpleReport(event)"><label class="prof-field"><span>المعني</span><select id="simple-report-student" class="prof-control"><option value="القسم كاملا">القسم كاملا</option>'+myStudents.map(s=>'<option>'+escapeHtml(studentName(s))+'</option>').join('')+'</select></label><label class="prof-field"><span>الرسالة</span><textarea id="simple-report-text" class="prof-control" required placeholder="اكتب الرسالة"></textarea></label><div class="prof-actions"><button data-label="إرسال الرسالة" class="prof-action prof-action-primary" type="submit">إرسال الرسالة</button><button class="prof-action prof-action-secondary" type="button" onclick="resetSimpleForm(\'report-form\')">إلغاء</button></div></form>';
  }

  function render(){if(!document.querySelector('.prof-simple-shell'))shell();document.querySelectorAll('[data-prof-tab]').forEach(link=>link.classList.toggle('active',link.dataset.profTab===page));if(page==='recitation')renderRecitation();else if(page==='homework')renderHomework();else if(page==='students')renderStudents();else renderReport()}

  window.showSimpleRange=showRange;
  window.resetSimpleForm=resetForm;
  window.selectSimpleStudent=function(username){sessionStorage.setItem('mawahib_prof_student',username);const select=document.getElementById('simple-student-select');if(select)select.value=username;renderStudentDetail(username)};
  window.saveSimpleRecitation=async function(event){event.preventDefault();const button=event.submitter;const username=document.getElementById('rec-student').value;const surah=document.getElementById('rec-surah').value;const scope=document.getElementById('rec-scope').value;const start=document.getElementById('rec-start').value;const end=document.getElementById('rec-end').value;if(!username||!surah||(scope==='جزء'&&(!start||!end))){showToast('أكمل المعلومات المطلوبة');return}setBusy(button,true);const note={validation:document.getElementById('rec-result').value,comment:document.getElementById('rec-comment').value.trim(),surah,scope,ayahStart:scope==='جزء'?start:'',ayahEnd:scope==='جزء'?end:'',source:'recitation',date:today()};await Auth.saveTeacherNote(username,note);await Auth.saveClassSession(session.username,{id:'session_'+Date.now(),date:today(),present:[username],absent:[],validations:[{username,...note}],total:1});await refreshProfDashboard(false);render();showToast('تم حفظ التلاوة')};
  window.sendSimpleHomework=async function(event){event.preventDefault();const button=event.submitter;const student=document.getElementById('hw-student').value;const surah=document.getElementById('hw-surah').value;const scope=document.getElementById('hw-scope').value;const start=scope==='جزء'?document.getElementById('hw-start').value:'1';const end=scope==='جزء'?document.getElementById('hw-end').value:String(surahAyat(surah));const date=document.getElementById('hw-date').value;if(!student||!surah||!start||!end||!date){showToast('أكمل المعلومات المطلوبة');return}setBusy(button,true);const result=await Auth.ajouterDevoir(student,session.prenom,surah,start,end,date);if(result.ok){await refreshProfDashboard(false);render();showToast('تم إرسال الواجب')}else{setBusy(button,false);showToast(result.error||'تعذر الإرسال')}};
  window.deleteSimpleHomework=async function(id){if(!confirm('حذف هذا الواجب؟'))return;await Auth.annulerDevoir(id);await refreshProfDashboard(false);render();showToast('تم حذف الواجب')};
  window.remindSimpleHomework=async function(id){const item=myDevoirs.find(row=>row.id===id);if(!item)return;await Auth.sendMessage(item.student_id,'تذكير: لديك واجب اليوم في '+(item.surate||'السورة'));showToast('تم إرسال التذكير')};
  window.sendSimpleReport=async function(event){event.preventDefault();const button=event.submitter;const student=document.getElementById('simple-report-student').value;const text=document.getElementById('simple-report-text').value.trim();if(!text){showToast('اكتب الرسالة');return}setBusy(button,true);const result=await Auth.sendAdminReport(session.username,session.prenom,session.nom,'المعني: '+student+'\n'+text,'متابعة');if(result.ok){resetForm('report-form');showToast('تم إرسال الرسالة')}else{setBusy(button,false);showToast(result.error||'تعذر الإرسال')}};

  window.addEventListener('DOMContentLoaded',function(){window.renderAll=render;const wait=setInterval(function(){if(typeof session!=='undefined'&&session&&Array.isArray(myStudents)){clearInterval(wait);render()}},80);setTimeout(()=>clearInterval(wait),10000)});
})();
