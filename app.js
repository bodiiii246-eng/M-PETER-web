/* ---------- app ---------- */
const LOGO_A = '__LOGO_A__';
const LOGO_B = '__LOGO_B__';
const HEAD_TAGS = __HEAD_TAGS__;
const DOC_PREFIX = __DOC_PREFIX__;

document.documentElement.setAttribute('lang', 'ar');
document.documentElement.setAttribute('dir', 'rtl');

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (arr, id) => arr.find(x => x.id === id);
const uid = p => p + Math.random().toString(36).slice(2, 8);
const ld = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const sv = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { } };
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h5"/>',
  layers: '<path d="m12 4 9 5-9 5-9-5 9-5zM3 14l9 5 9-5"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  home: '<path d="M4 11 12 4l8 7M6 10v10h12V10"/>'
};
const ic = (n, sz = 20) => '<svg class="ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
const PYR = '<svg class="pyr" viewBox="0 0 120 70" fill="none" stroke="#ffd93b" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 66 44 10l40 56zM40 66 76 18l40 48z"/></svg>';

/* ---------- state ---------- */
let S = JSON.parse(document.getElementById('data').textContent);
let isAdmin = ld('gp-admin') === '1';
let dirty = false;
const savedDraft = (() => { try { return JSON.parse(ld('gp-draft') || 'null'); } catch (e) { return null; } })();
if (isAdmin && savedDraft && savedDraft.rev === S.rev) { S = savedDraft; dirty = true; }

const ui = { view: 'home', classId: null, q: '', sort: 'rank', tab: ld('gp-tab') || 'students', aClass: null, aExam: null };
let md = null;            // student editor draft
let pendingConfirm = null;
let artifactNS = null, userNS = null, canPublish = false;
let fails = 0, lockUntil = 0;

function ensureSel() {
  if (!byId(S.classes, ui.aClass)) ui.aClass = S.classes[0] ? S.classes[0].id : null;
  if (ui.aExam && (!byId(S.exams, ui.aExam) || byId(S.exams, ui.aExam).classId !== ui.aClass)) ui.aExam = null;
}

let draftTimer = 0;
function markDirty() {
  dirty = true;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => sv('gp-draft', JSON.stringify(S)), 300);
  updateSavebar();
}
function updateSavebar() {
  const bar = $('#savebar'); if (!bar) return;
  const show = isAdmin && dirty;
  bar.hidden = !show;
  document.body.classList.toggle('has-save', show);
  const b = $('#sv-btn'); if (b) b.disabled = !canPublish;
}

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- publishing ---------- */
function buildDoc(state) {
  const css = document.getElementById('appstyle').textContent;
  const code = document.getElementById('appcode').textContent;
  const json = JSON.stringify(state).replace(/</g, '\\u003c').split(String.fromCharCode(8232)).join('\\u2028').split(String.fromCharCode(8233)).join('\\u2029');
  return DOC_PREFIX + HEAD_TAGS +
    '<style id="appstyle">' + css + '</style>' +
    '<div id="app"></div>' +
    '<script id="data" type="application/json">' + json + '<\/script>' +
    '<script id="appcode">' + code + '<\/script>' +
    '</body></html>';
}

async function publish() {
  if (!artifactNS || !canPublish) { toast('لازم تفتح اللينك من حساب Claude بتاع صاحب الصفحة عشان تنشر'); return; }
  const btn = $('#sv-btn'); if (btn) btn.disabled = true;
  const prevRev = S.rev;
  S.rev = (S.rev || 1) + 1;
  sv('gp-just', '1');
  try {
    await artifactNS.publish(buildDoc(S));
    dirty = false; sv('gp-draft', null); updateSavebar();
    toast('تم النشر. التعديلات ظاهرة للكل دلوقتي');
  } catch (e) {
    S.rev = prevRev; sv('gp-just', null);
    const code = e && e.code;
    if (code === 'conflict') toast('اتنشرت نسخة أحدث من الصفحة. اعمل تحديث وجرب تاني');
    else if (code === 'not_writer' || code === 'not_granted') toast('الحساب ده مش مسموح له ينشر على الصفحة');
    else toast('تعذر النشر. جرب تاني بعد شوية');
    updateSavebar();
  }
}

/* ---------- shared view pieces ---------- */
function avatar(p, size, cls) {
  const photo = p.photo && String(p.photo).indexOf('data:image/') === 0 ? p.photo : null;
  if (photo) return '<span class="av ' + (cls || '') + '" style="--s:' + size + 'px"><img src="' + photo + '" alt=""></span>';
  const ch = esc(Array.from((p.name || '').trim())[0] || '؟');
  return '<span class="av ph ' + (cls || '') + '" style="--s:' + size + 'px"><b>' + ch + '</b></span>';
}

function topbar(mode) {
  let right = '';
  if (mode === 'admin') {
    right = '<a class="btn sm" href="#">' + ic('home', 18) + '<span>عرض الموقع</span></a>' +
      (isAdmin ? '<button class="btn sm dan" data-act="logout">' + ic('logout', 18) + '<span>خروج</span></button>' : '');
  } else if (isAdmin) {
    right = '<a class="btn sm" href="#admin">' + ic('settings', 18) + '<span>لوحة الأدمن</span></a>';
  }
  return '<header class="top"><a class="brand" href="#"><img src="' + LOGO_A + '" alt="" width="42" height="42"><span>' + esc(S.settings.title) + '</span></a><span class="sp"></span>' + right + '</header>';
}

/* ---------- public views ---------- */
function homeHTML() {
  const cards = S.classes.map((c, i) => {
    const n = S.students.filter(s => s.classId === c.id).length;
    const m = S.exams.filter(e => e.classId === c.id && S.grades[e.id] && Object.keys(S.grades[e.id]).length).length;
    return '<a class="card cls in" style="--i:' + i + '" href="#class-' + c.id + '">' + PYR +
      '<h3>' + esc(c.name) + '</h3><p>' + (n ? n + ' طالب' : 'لسه مفيش طلاب') + (m ? ' · ' + m + ' امتحان' : '') + '</p>' +
      '<span class="go">عرض الدرجات ' + ic('arrow', 16) + '</span></a>';
  }).join('');
  return topbar() +
    '<section class="hero in"><div class="logo-lg"><img src="' + LOGO_A + '" alt="شعار الموقع"></div><h1>' + esc(S.settings.title) + '</h1><p class="sub">' + esc(S.settings.subtitle) + '</p></section>' +
    '<h2 class="sec">اختر الصف</h2>' +
    (cards ? '<div class="grid cls-grid">' + cards + '</div>' : '<div class="empty">لسه ما اتضافتش صفوف. الأدمن هيضيفها قريب.</div>') +
    '<footer class="foot"><a href="#admin">' + ic('lock', 14) + '<span>دخول الأدمن</span></a></footer>';
}

function classHTML() {
  const c = byId(S.classes, ui.classId);
  const d = calc(S, c.id);
  return topbar() +
    '<a class="back" href="#">' + ic('arrow', 18) + '<span>كل الصفوف</span></a>' +
    '<section class="chead in"><h1>' + esc(c.name) + '</h1><p class="sub">' + d.rows.length + ' طالب · ' + d.counted.length + ' امتحان</p></section>' +
    '<div class="tools in" style="--i:2"><label class="search">' + ic('search', 18) +
    '<input id="q" type="search" placeholder="ابحث باسم الطالب" autocomplete="off" value="' + esc(ui.q) + '"></label>' +
    '<div class="seg" role="group" aria-label="طريقة الترتيب"><button data-act="sort" data-id="rank" class="' + (ui.sort === 'rank' ? 'on' : '') + '">حسب الترتيب</button>' +
    '<button data-act="sort" data-id="name" class="' + (ui.sort === 'name' ? 'on' : '') + '">أبجدي</button></div></div>' +
    '<div class="slist" id="slist"></div>';
}

function fillList(animate) {
  const box = $('#slist'); if (!box) return;
  const d = calc(S, ui.classId);
  const q = norm(ui.q);
  const rows = sortRows(d.rows, ui.sort).filter(r => !q || norm(r.s.name).indexOf(q) !== -1);
  if (!rows.length) {
    box.innerHTML = '<div class="empty">' + (d.rows.length ? 'مفيش طالب بالاسم ده.' : 'لسه ما اتضافش طلاب في الصف ده.') + '</div>';
    return;
  }
  box.innerHTML = rows.map((r, i) => {
    const med = r.rank && r.rank <= 3 ? ' m' + r.rank : '';
    const rkCls = r.rank && r.rank <= 3 ? ' r' + r.rank : '';
    const rk = r.rank != null ? '<span class="rk' + rkCls + '" aria-label="الترتيب ' + r.rank + '">' + r.rank + '</span>' : '';
    const tot = r.n ? '<b data-count="' + r.total + '">' + fmt(r.total) + '</b><small>من ' + fmt(r.max) + '</small>' : '<b>—</b><small>لا توجد درجات</small>';
    return '<button class="card stu' + med + (animate ? ' in' : '') + '" style="--i:' + i + '" data-act="open" data-id="' + r.s.id + '">' +
      '<span class="avwrap">' + avatar(r.s, 58) + rk + '</span><span class="nm">' + esc(r.s.name) + '</span><span class="tot">' + tot + '</span></button>';
  }).join('');
  if (animate) runCounts(box);
}

function runCounts(root) {
  const rm = reduced();
  root.querySelectorAll('[data-count]').forEach((el, i) => {
    const to = parseFloat(el.dataset.count);
    if (rm || isNaN(to)) { el.textContent = fmt(to); return; }
    const dur = 900, t0 = performance.now() + Math.min(i, 14) * 55 + 150;
    el.textContent = '0';
    const step = now => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? String(Math.round(to * e)) : fmt(to);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function openDetails(id) {
  const st = byId(S.students, id); if (!st) return;
  const d = calc(S, st.classId);
  const r = d.rows.find(x => x.s.id === id);
  const rows = r.per.map((p, i) => {
    const v = p.v;
    const pct = v == null ? 0 : Math.min(100, v / p.e.max * 100);
    return '<li class="in" style="--i:' + (i + 2) + '"><div class="exh"><span class="exn">' + esc(p.e.name) + '</span><span class="exs">' +
      (v == null ? '<em>—</em>' : '<b>' + fmt(v) + '</b><small> / ' + fmt(p.e.max) + '</small>') +
      '</span></div><div class="bar"><i style="--w:' + pct.toFixed(1) + '%;--i:' + i + '"></i></div></li>';
  }).join('');
  const pct = r.max ? Math.round(r.total / r.max * 100) : null;
  const rkPill = r.rank != null ? '<span class="pill">الترتيب <b>' + r.rank + '</b></span>' : '';
  const totPill = r.n ? '<span class="pill">المجموع <b>' + fmt(r.total) + '</b> من ' + fmt(r.max) + '</span>' : '';
  const pctPill = pct != null ? '<span class="pill">النسبة <b>' + pct + '%</b></span>' : '';
  showModal('<div class="mb"><div class="sheet" role="dialog" aria-modal="true" aria-label="تفاصيل ' + esc(st.name) + '">' +
    '<button class="btn ico x" data-act="close" aria-label="إغلاق">' + ic('close') + '</button>' +
    '<div class="sh-head">' + avatar(st, 92) + '<div><h2>' + esc(st.name) + '</h2><div class="pills">' + rkPill + totPill + pctPill + '</div></div></div>' +
    (d.exams.length ? '<ul class="rows">' + rows + '</ul>' : '<p class="hint">لسه ما اتضافتش امتحانات للصف ده.</p>') +
    '</div></div>');
}

/* ---------- modal plumbing ---------- */
function showModal(html) {
  const root = $('#modal-root');
  root.innerHTML = html; root.hidden = false;
  document.body.classList.add('lock');
  const f = root.querySelector('.x, input, button'); if (f) f.focus({ preventScroll: true });
}
function closeModal() {
  const root = $('#modal-root'); if (!root) return;
  root.hidden = true; root.innerHTML = '';
  document.body.classList.remove('lock');
  md = null; pendingConfirm = null;
}
function confirmBox(msg, yesLabel, fn) {
  pendingConfirm = fn;
  showModal('<div class="mb"><div class="sheet small" role="alertdialog" aria-modal="true"><div class="sh-top"><h2>تأكيد</h2></div>' +
    '<p style="margin:0 0 6px">' + esc(msg) + '</p><div class="btns"><button class="btn dan" data-act="confirm-yes">' + esc(yesLabel) + '</button><button class="btn" data-act="close">إلغاء</button></div></div></div>');
}

/* ---------- admin ---------- */
function loginHTML() {
  return topbar('admin') +
    '<div class="card login in"><div class="logo-lg"><img src="' + LOGO_A + '" alt="شعار الموقع"></div><h1>دخول الأدمن</h1><p class="sub">اكتب اسم المستخدم وكلمة المرور</p>' +
    '<form data-form="login" autocomplete="on"><div class="field"><label for="lg-u">اسم المستخدم</label><input id="lg-u" type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>' +
    '<div class="field"><label for="lg-p">كلمة المرور</label><input id="lg-p" type="password" name="password" autocomplete="current-password" required></div>' +
    '<p class="err" id="lg-err" role="alert"></p><button class="btn pri" style="width:100%" type="submit">' + ic('lock', 18) + 'دخول</button></form></div>';
}

function classChips(sel, act) {
  if (!S.classes.length) return '';
  return '<div class="chips" role="group" aria-label="اختيار الصف">' + S.classes.map(c =>
    '<button class="chip' + (c.id === sel ? ' on' : '') + '" data-act="' + act + '" data-id="' + c.id + '">' + esc(c.name) + '</button>').join('') + '</div>';
}

function adminHTML() {
  if (!isAdmin) return loginHTML();
  ensureSel();
  const tabs = [['students', 'users', 'الطلاب'], ['grades', 'exam', 'الدرجات'], ['classes', 'layers', 'الصفوف'], ['settings', 'settings', 'الإعدادات']];
  let panel = '';
  if (ui.tab === 'students') panel = studentsPanel();
  else if (ui.tab === 'grades') panel = gradesPanel();
  else if (ui.tab === 'classes') panel = classesPanel();
  else panel = settingsPanel();
  const warn = canPublish ? '' : '<div class="note" id="pub-note">عشان تنشر التعديلات لازم تفتح اللينك وانت مسجل دخول بحساب Claude بتاع صاحب الصفحة. تقدر تجرب التعديل هنا، بس النشر مش هيشتغل من غير كده.</div>';
  return topbar('admin') + '<div class="adm">' + warn +
    '<div class="tabs" role="tablist">' + tabs.map(t => '<button class="tab' + (ui.tab === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (ui.tab === t[0]) + '" data-act="tab" data-id="' + t[0] + '">' + ic(t[1], 18) + '<span>' + t[2] + '</span></button>').join('') + '</div>' +
    '<div class="panel">' + panel + '</div></div>';
}

function noClass() {
  return '<div class="pbox"><p class="hint">ضيف صف الأول من تبويب "الصفوف".</p></div>';
}

function studentsPanel() {
  if (!S.classes.length) return noClass();
  const list = S.students.filter(s => s.classId === ui.aClass).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const exams = S.exams.filter(e => e.classId === ui.aClass);
  const rows = list.map(s => {
    const n = exams.filter(e => S.grades[e.id] && typeof S.grades[e.id][s.id] === 'number').length;
    return '<div class="arow">' + avatar(s, 44) + '<span class="nm">' + esc(s.name) + '</span><span class="meta">' + n + '/' + exams.length + ' درجة</span>' +
      '<button class="btn sm ico" data-act="stu-edit" data-id="' + s.id + '" aria-label="تعديل ' + esc(s.name) + '">' + ic('edit', 18) + '</button>' +
      '<button class="btn sm ico dan" data-act="stu-del" data-id="' + s.id + '" aria-label="مسح ' + esc(s.name) + '">' + ic('trash', 18) + '</button></div>';
  }).join('');
  return '<div class="pbox"><h3>الصف</h3>' + classChips(ui.aClass, 'aclass') + '</div>' +
    '<div class="pbox"><h3>طلاب الصف (' + list.length + ')</h3><div class="btns" style="margin:0 0 14px"><button class="btn pri sm" data-act="stu-new">' + ic('plus', 18) + 'طالب جديد</button><button class="btn sm" data-act="stu-bulk">' + ic('users', 18) + 'إضافة عدة طلاب</button></div>' +
    (rows ? '<div class="alist">' + rows + '</div>' : '<p class="hint">لسه مفيش طلاب في الصف ده.</p>') + '</div>';
}

function gradesPanel() {
  if (!S.classes.length) return noClass();
  const exams = S.exams.filter(e => e.classId === ui.aClass);
  const chips = '<div class="chips">' + exams.map(e => '<button class="chip' + (e.id === ui.aExam ? ' on' : '') + '" data-act="aexam" data-id="' + e.id + '">' + esc(e.name) + '</button>').join('') +
    '<button class="chip add" data-act="exam-new">+ امتحان جديد</button></div>';
  let body = '<p class="hint">اختار امتحان عشان تدخل أو تعدل الدرجات، أو ضيف امتحان جديد.</p>';
  const ex = ui.aExam ? byId(S.exams, ui.aExam) : null;
  if (ex) {
    const studs = S.students.filter(s => s.classId === ui.aClass).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const g = S.grades[ex.id] || {};
    body = '<div class="ehead"><div class="field"><label for="ex-name">اسم الامتحان</label><input id="ex-name" type="text" data-bind="ename" data-id="' + ex.id + '" value="' + esc(ex.name) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="ex-max">الدرجة العظمى</label><input id="ex-max" type="text" inputmode="decimal" data-bind="emax" data-id="' + ex.id + '" value="' + fmt(ex.max) + '" autocomplete="off"></div></div>' +
      '<div class="alist">' + (studs.length ? studs.map(s => '<div class="arow">' + avatar(s, 40) + '<span class="nm">' + esc(s.name) + '</span>' +
        '<input class="gin" id="g-' + s.id + '" inputmode="decimal" autocomplete="off" placeholder="—" aria-label="درجة ' + esc(s.name) + '" data-bind="grade" data-ex="' + ex.id + '" data-st="' + s.id + '" value="' + (typeof g[s.id] === 'number' ? fmt(g[s.id]) : '') + '"></div>').join('') : '<p class="hint">مفيش طلاب في الصف ده لسه.</p>') + '</div>' +
      '<div class="btns"><button class="btn dan sm" data-act="exam-del" data-id="' + ex.id + '">' + ic('trash', 18) + 'مسح الامتحان</button></div>';
  }
  return '<div class="pbox"><h3>الصف</h3>' + classChips(ui.aClass, 'aclass') + '</div>' +
    '<div class="pbox"><h3>الامتحانات</h3>' + chips + '</div>' + (ex ? '<div class="pbox"><h3>' + esc(ex.name) + '</h3>' + body + '</div>' : '<div class="pbox">' + body + '</div>');
}

function classesPanel() {
  const rows = S.classes.map(c => {
    const n = S.students.filter(s => s.classId === c.id).length;
    const m = S.exams.filter(e => e.classId === c.id).length;
    return '<div class="arow"><input type="text" data-bind="cname" data-id="' + c.id + '" value="' + esc(c.name) + '" aria-label="اسم الصف" autocomplete="off"><span class="meta">' + n + ' طالب · ' + m + ' امتحان</span>' +
      '<button class="btn sm ico dan" data-act="cls-del" data-id="' + c.id + '" aria-label="مسح ' + esc(c.name) + '">' + ic('trash', 18) + '</button></div>';
  }).join('');
  return '<div class="pbox"><h3>الصفوف</h3>' + (rows ? '<div class="alist">' + rows + '</div>' : '<p class="hint">لسه مفيش صفوف.</p>') + '</div>' +
    '<div class="pbox"><h3>صف جديد</h3><form data-form="addclass" class="arow" style="background:none;border:0;padding:0"><input id="new-class" type="text" placeholder="مثال: الصف الأول" autocomplete="off" aria-label="اسم الصف الجديد"><button class="btn pri" type="submit">' + ic('plus', 18) + 'إضافة</button></form></div>';
}

function settingsPanel() {
  return '<div class="pbox"><h3>بيانات الموقع</h3>' +
    '<div class="field"><label for="st-title">اسم الموقع</label><input id="st-title" type="text" data-bind="title" value="' + esc(S.settings.title) + '" autocomplete="off"></div>' +
    '<div class="field"><label for="st-sub">الجملة تحت الاسم</label><input id="st-sub" type="text" data-bind="subtitle" value="' + esc(S.settings.subtitle) + '" autocomplete="off"></div></div>' +
    '<div class="pbox"><h3>بيانات الدخول</h3><form data-form="changepw" autocomplete="off">' +
    '<div class="field"><label for="pw-u">اسم المستخدم</label><input id="pw-u" type="text" value="' + esc(S.admin.u) + '" autocomplete="off" autocapitalize="none"></div>' +
    '<div class="field"><label for="pw-old">كلمة المرور الحالية</label><input id="pw-old" type="password" autocomplete="current-password"></div>' +
    '<div class="field"><label for="pw-new">كلمة مرور جديدة (6 حروف على الأقل)</label><input id="pw-new" type="password" autocomplete="new-password"></div>' +
    '<p class="err" id="pw-err" role="alert"></p><button class="btn pri" type="submit">' + ic('check', 18) + 'تغيير بيانات الدخول</button></form></div>';
}

/* student editor */
function openStudentEditor(sid) {
  const st = sid ? byId(S.students, sid) : null;
  md = { id: sid || null, name: st ? st.name : '', classId: st ? st.classId : ui.aClass, photo: st ? st.photo : null, grades: {}, bad: {} };
  if (st) S.exams.filter(e => e.classId === st.classId).forEach(e => { const v = (S.grades[e.id] || {})[sid]; if (typeof v === 'number') md.grades[e.id] = v; });
  showModal(editorHTML());
}
function edGrades() {
  const ex = S.exams.filter(e => e.classId === md.classId);
  if (!ex.length) return '<p class="hint">مفيش امتحانات للصف ده لسه.</p>';
  return '<h3 class="sub-h">الدرجات</h3><div class="grades">' + ex.map(e =>
    '<div class="grow"><label for="eg-' + e.id + '">' + esc(e.name) + ' <small>من ' + fmt(e.max) + '</small></label><input class="gin" id="eg-' + e.id + '" inputmode="decimal" autocomplete="off" placeholder="—" data-bind="d-grade" data-ex="' + e.id + '" value="' + (md.grades[e.id] != null ? fmt(md.grades[e.id]) : '') + '"></div>').join('') + '</div>';
}
function editorHTML() {
  const opts = S.classes.map(c => '<option value="' + c.id + '"' + (c.id === md.classId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  return '<div class="mb"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + (md.id ? 'تعديل طالب' : 'طالب جديد') + '">' +
    '<div class="sh-top"><h2>' + (md.id ? 'تعديل الطالب' : 'طالب جديد') + '</h2><button class="btn ico" data-act="close" aria-label="إغلاق">' + ic('close') + '</button></div>' +
    '<div class="ed-photo">' + avatar({ name: md.name || '؟', photo: md.photo }, 84) + '<div class="col"><button class="btn sm" data-act="photo-pick">' + ic('camera', 18) + (md.photo ? 'تغيير الصورة' : 'رفع صورة') + '</button>' +
    (md.photo ? '<button class="btn sm dan" data-act="photo-clear">' + ic('trash', 18) + 'حذف الصورة</button>' : '') + '</div></div>' +
    '<div class="field"><label for="ed-name">اسم الطالب</label><input id="ed-name" type="text" data-bind="d-name" value="' + esc(md.name) + '" autocomplete="off"></div>' +
    '<div class="field"><label for="ed-class">الصف</label><select id="ed-class" data-bind="d-class">' + opts + '</select></div>' +
    '<div id="ed-grades">' + edGrades() + '</div>' +
    '<div class="btns"><button class="btn pri" data-act="ed-save">' + ic('check', 18) + 'حفظ</button>' +
    (md.id ? '<button class="btn dan" data-act="stu-del" data-id="' + md.id + '">' + ic('trash', 18) + 'مسح الطالب</button>' : '') + '</div></div></div>';
}
function commitStudent() {
  const name = md.name.trim();
  if (!name) { toast('اكتب اسم الطالب الأول'); const i = $('#ed-name'); if (i) i.focus(); return; }
  if (!md.classId) { toast('اختار الصف'); return; }
  if (Object.keys(md.bad).some(k => md.bad[k])) { toast('فيه درجة مش صح. صححها الأول'); return; }
  let st;
  if (md.id) {
    st = byId(S.students, md.id);
    if (st.classId !== md.classId) S.exams.filter(e => e.classId === st.classId).forEach(e => { if (S.grades[e.id]) delete S.grades[e.id][st.id]; });
    st.name = name; st.classId = md.classId; st.photo = md.photo;
  } else {
    st = { id: uid('s'), classId: md.classId, name: name, photo: md.photo };
    S.students.push(st);
  }
  S.exams.filter(e => e.classId === md.classId).forEach(e => {
    const v = md.grades[e.id];
    const g = S.grades[e.id] || (S.grades[e.id] = {});
    if (typeof v === 'number') g[st.id] = v; else delete g[st.id];
    if (!Object.keys(g).length) delete S.grades[e.id];
  });
  ui.aClass = md.classId;
  closeModal(); markDirty(); render(false);
  toast('تم الحفظ. افتكر تنشر التعديلات');
}

function readPhoto(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('read'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => rej(new Error('img'));
      im.onload = () => {
        try {
          const N = 256, c = document.createElement('canvas');
          c.width = c.height = N;
          const m = Math.min(im.naturalWidth, im.naturalHeight);
          const sx = (im.naturalWidth - m) / 2, sy = (im.naturalHeight - m) * 0.3;
          c.getContext('2d').drawImage(im, sx, sy, m, m, 0, 0, N, N);
          res(c.toDataURL('image/jpeg', 0.82));
        } catch (e) { rej(e); }
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- render + routing ---------- */
function render(animate) {
  const v = $('#view');
  if (ui.view === 'admin') v.innerHTML = adminHTML();
  else if (ui.view === 'class') { v.innerHTML = classHTML(); fillList(animate !== false); }
  else v.innerHTML = homeHTML();
  if (ui.view === 'home') runCounts(v);
  updateSavebar();
}

function route() {
  const h = location.hash.slice(1);
  closeModal();
  if (h === 'admin') ui.view = 'admin';
  else if (h.indexOf('class-') === 0 && byId(S.classes, h.slice(6))) { ui.view = 'class'; ui.classId = h.slice(6); }
  else ui.view = 'home';
  ui.q = '';
  render(true);
  window.scrollTo(0, 0);
}

function boot() {
  const app = $('#app');
  app.setAttribute('dir', 'rtl');
  app.innerHTML =
    '<div class="bg" aria-hidden="true"><svg viewBox="0 0 600 260" fill="none" stroke="#ffd93b" stroke-width="2" stroke-linejoin="round"><path d="M20 250 180 60l160 190zM150 250 300 20l170 230zM330 250l120-140 130 140z"/></svg></div>' +
    '<div class="page" id="view"></div><div id="modal-root" hidden></div>' +
    '<div class="savebar" id="savebar" hidden><div class="sv-in"><span>فيه تعديلات لسه ما اتنشرتش</span><button class="btn pri" id="sv-btn" data-act="save">' + ic('check', 18) + 'نشر التعديلات</button></div></div>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>';

  app.addEventListener('click', onClick);
  app.addEventListener('input', onInput);
  app.addEventListener('change', onChange);
  app.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal-root').hidden) closeModal(); });
  window.addEventListener('hashchange', route);

  route();

  if (ld('gp-just') === '1') { sv('gp-just', null); toast('تم النشر. التعديلات ظاهرة للكل'); }

  if (!ld('gp-splash') && !reduced() && location.hash === '') {
    sv('gp-splash', '1');
    const sp = document.createElement('div');
    sp.className = 'splash';
    sp.innerHTML = '<div class="sp-logo"><img src="' + LOGO_B + '" alt=""></div><h2>' + esc(S.settings.title) + '</h2>';
    app.appendChild(sp);
    const kill = () => { sp.classList.add('out'); setTimeout(() => sp.remove(), 700); };
    sp.addEventListener('click', kill);
    setTimeout(kill, 1900);
  }

  (async () => {
    try {
      if (window.claude && claude.use) {
        artifactNS = await claude.use('artifact');
        userNS = await claude.use('user');
      }
    } catch (e) { }
    canPublish = !!artifactNS && (userNS ? !!userNS.canEdit() : true);
    updateSavebar();
    if (ui.view === 'admin' && isAdmin && !canPublish && !md && $('#modal-root').hidden && document.activeElement === document.body) render(false);
  })();
}

/* ---------- events ---------- */
function onClick(e) {
  if (e.target.classList && e.target.classList.contains('mb')) { closeModal(); return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  switch (a) {
    case 'open': openDetails(id); break;
    case 'close': closeModal(); break;
    case 'sort': ui.sort = id; document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.id === id)); fillList(false); break;
    case 'logout':
      if (dirty) confirmBox('فيه تعديلات لسه ما اتنشرتش وهتضيع لو خرجت. تخرج؟', 'اخرج', doLogout); else doLogout();
      break;
    case 'tab': ui.tab = id; sv('gp-tab', id); render(false); break;
    case 'aclass': ui.aClass = id; ui.aExam = null; render(false); break;
    case 'aexam': ui.aExam = id; render(false); break;
    case 'stu-new': if (!S.classes.length) { toast('ضيف صف الأول'); break; } openStudentEditor(null); break;
    case 'stu-edit': openStudentEditor(id); break;
    case 'stu-del': {
      const st = byId(S.students, id); if (!st) break;
      confirmBox('هتمسح "' + st.name + '" ودرجاته نهائيًا. متأكد؟', 'امسح الطالب', () => {
        S.students = S.students.filter(s => s.id !== id);
        Object.keys(S.grades).forEach(k => { delete S.grades[k][id]; if (!Object.keys(S.grades[k]).length) delete S.grades[k]; });
        closeModal(); markDirty(); render(false);
      });
      break;
    }
    case 'stu-bulk':
      if (!S.classes.length) { toast('ضيف صف الأول'); break; }
      showModal('<div class="mb"><div class="sheet" role="dialog" aria-modal="true" aria-label="إضافة عدة طلاب"><div class="sh-top"><h2>إضافة عدة طلاب</h2><button class="btn ico" data-act="close" aria-label="إغلاق">' + ic('close') + '</button></div>' +
        '<div class="field"><label for="bulk">اكتب اسم كل طالب في سطر</label><textarea id="bulk" placeholder="أحمد محمد&#10;منة الله علي&#10;يوسف خالد"></textarea></div><p class="hint">هيتضافوا في صف: ' + esc((byId(S.classes, ui.aClass) || {}).name) + '</p>' +
        '<div class="btns"><button class="btn pri" data-act="bulk-save">' + ic('plus', 18) + 'إضافة</button></div></div></div>');
      break;
    case 'bulk-save': {
      const names = ($('#bulk').value || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!names.length) { toast('اكتب اسم واحد على الأقل'); break; }
      names.forEach(n => S.students.push({ id: uid('s'), classId: ui.aClass, name: n, photo: null }));
      closeModal(); markDirty(); render(false); toast('اتضاف ' + names.length + ' طالب');
      break;
    }
    case 'exam-new':
      showModal('<div class="mb"><div class="sheet small" role="dialog" aria-modal="true" aria-label="امتحان جديد"><div class="sh-top"><h2>امتحان جديد</h2><button class="btn ico" data-act="close" aria-label="إغلاق">' + ic('close') + '</button></div>' +
        '<form data-form="newexam"><div class="field"><label for="ne-name">اسم الامتحان</label><input id="ne-name" type="text" autocomplete="off" placeholder="مثال: امتحان الشهر الأول"></div>' +
        '<div class="field"><label for="ne-max">الدرجة العظمى</label><input id="ne-max" type="text" inputmode="decimal" value="20" autocomplete="off"></div>' +
        '<div class="btns"><button class="btn pri" type="submit">' + ic('plus', 18) + 'إضافة</button></div></form></div></div>');
      break;
    case 'exam-del': {
      const ex = byId(S.exams, id); if (!ex) break;
      confirmBox('هتمسح امتحان "' + ex.name + '" وكل درجاته. متأكد؟', 'امسح الامتحان', () => {
        S.exams = S.exams.filter(x => x.id !== id); delete S.grades[id]; ui.aExam = null;
        closeModal(); markDirty(); render(false);
      });
      break;
    }
    case 'cls-del': {
      const c = byId(S.classes, id); if (!c) break;
      const n = S.students.filter(s => s.classId === id).length;
      confirmBox('هتمسح صف "' + c.name + '" بكل ' + n + ' طالب وامتحاناته ودرجاته. متأكد؟', 'امسح الصف', () => {
        const exIds = S.exams.filter(x => x.classId === id).map(x => x.id);
        const stIds = S.students.filter(s => s.classId === id).map(s => s.id);
        exIds.forEach(k => delete S.grades[k]);
        S.exams = S.exams.filter(x => x.classId !== id);
        S.students = S.students.filter(s => stIds.indexOf(s.id) === -1);
        S.classes = S.classes.filter(x => x.id !== id);
        closeModal(); markDirty(); render(false);
      });
      break;
    }
    case 'photo-pick': {
      let f = $('#photo-file');
      if (!f) { f = document.createElement('input'); f.type = 'file'; f.id = 'photo-file'; f.accept = 'image/*'; f.hidden = true; $('#app').appendChild(f); }
      f.value = ''; f.click();
      break;
    }
    case 'photo-clear': md.photo = null; showModal(editorHTML()); break;
    case 'ed-save': commitStudent(); break;
    case 'confirm-yes': { const fn = pendingConfirm; pendingConfirm = null; if (fn) fn(); break; }
    case 'save': publish(); break;
  }
}

function doLogout() {
  isAdmin = false; sv('gp-admin', null); sv('gp-draft', null);
  if (dirty) { dirty = false; location.reload(); return; }
  closeModal(); location.hash = ''; route();
}

function onInput(e) {
  const t = e.target, b = t.dataset && t.dataset.bind; if (!b) return;
  switch (b) {
    case 'title': S.settings.title = t.value; markDirty(); break;
    case 'subtitle': S.settings.subtitle = t.value; markDirty(); break;
    case 'cname': { const c = byId(S.classes, t.dataset.id); if (c) { c.name = t.value; markDirty(); } break; }
    case 'ename': { const x = byId(S.exams, t.dataset.id); if (x) { x.name = t.value; markDirty(); } break; }
    case 'emax': {
      const x = byId(S.exams, t.dataset.id); const p = pg(t.value, 100000);
      if (x && p.ok && !p.empty && p.val > 0) { x.max = p.val; t.classList.remove('bad'); markDirty(); } else t.classList.add('bad');
      break;
    }
    case 'grade': {
      const ex = byId(S.exams, t.dataset.ex); if (!ex) break;
      const p = pg(t.value, ex.max);
      if (!p.ok) { t.classList.add('bad'); break; }
      t.classList.remove('bad');
      const g = S.grades[ex.id] || (S.grades[ex.id] = {});
      if (p.empty) delete g[t.dataset.st]; else g[t.dataset.st] = p.val;
      if (!Object.keys(g).length) delete S.grades[ex.id];
      markDirty();
      break;
    }
    case 'd-name': md.name = t.value; break;
    case 'd-grade': {
      const ex = byId(S.exams, t.dataset.ex); if (!ex) break;
      const p = pg(t.value, ex.max);
      md.bad[ex.id] = !p.ok; t.classList.toggle('bad', !p.ok);
      if (p.ok) { if (p.empty) delete md.grades[ex.id]; else md.grades[ex.id] = p.val; }
      break;
    }
  }
}

function onChange(e) {
  const t = e.target;
  if (t.id === 'photo-file') {
    const f = t.files && t.files[0]; if (!f || !md) return;
    readPhoto(f).then(url => { md.photo = url; showModal(editorHTML()); }).catch(() => toast('الصورة دي مش مفهومة. جرب صورة تانية'));
    return;
  }
  const b = t.dataset && t.dataset.bind;
  if (b === 'd-class') { md.classId = t.value; md.grades = {}; md.bad = {}; $('#ed-grades').innerHTML = edGrades(); }
  if (b === 'grade' || b === 'd-grade') {
    const ex = byId(S.exams, t.dataset.ex);
    if (t.classList.contains('bad') && ex) {
      const cur = b === 'grade' ? (S.grades[ex.id] || {})[t.dataset.st] : md.grades[ex.id];
      t.value = typeof cur === 'number' ? fmt(cur) : ''; t.classList.remove('bad');
      if (b === 'd-grade') md.bad[ex.id] = false;
      toast('الدرجة لازم تكون رقم من صفر لحد ' + fmt(ex.max));
    }
  }
  if (b === 'emax' && t.classList.contains('bad')) { const x = byId(S.exams, t.dataset.id); if (x) t.value = fmt(x.max); t.classList.remove('bad'); toast('الدرجة العظمى لازم تكون رقم أكبر من صفر'); }
}

async function onSubmit(e) {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  if (kind === 'login') {
    const err = $('#lg-err'), u = $('#lg-u').value, p = $('#lg-p').value;
    const now = Date.now();
    if (lockUntil > now) { err.textContent = 'محاولات كتير. جرب بعد ' + Math.ceil((lockUntil - now) / 1000) + ' ثانية'; return; }
    let ok = false;
    try { ok = u.trim().toLowerCase() === S.admin.u.toLowerCase() && (await sha(S.admin.s + ':' + p)) === S.admin.h; }
    catch (x) { err.textContent = 'المتصفح ده مش بيدعم تسجيل الدخول'; return; }
    if (ok) { isAdmin = true; sv('gp-admin', '1'); fails = 0; render(true); }
    else {
      fails++; if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
      err.textContent = 'اسم المستخدم أو كلمة المرور غلط';
      const card = $('.login'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }
  } else if (kind === 'addclass') {
    const i = $('#new-class'), name = i.value.trim();
    if (!name) { toast('اكتب اسم الصف'); i.focus(); return; }
    const c = { id: uid('c'), name: name }; S.classes.push(c); ui.aClass = c.id;
    markDirty(); render(false);
  } else if (kind === 'newexam') {
    const name = $('#ne-name').value.trim(), p = pg($('#ne-max').value, 100000);
    if (!name) { toast('اكتب اسم الامتحان'); $('#ne-name').focus(); return; }
    if (!p.ok || p.empty || p.val <= 0) { toast('الدرجة العظمى لازم تكون رقم أكبر من صفر'); return; }
    const x = { id: uid('e'), classId: ui.aClass, name: name, max: p.val };
    S.exams.push(x); ui.aExam = x.id;
    closeModal(); markDirty(); render(false);
  } else if (kind === 'changepw') {
    const err = $('#pw-err'), u = $('#pw-u').value.trim(), o = $('#pw-old').value, n = $('#pw-new').value;
    err.textContent = '';
    if (!u) { err.textContent = 'اكتب اسم المستخدم'; return; }
    try {
      if ((await sha(S.admin.s + ':' + o)) !== S.admin.h) { err.textContent = 'كلمة المرور الحالية غلط'; return; }
      if (n.length < 6) { err.textContent = 'كلمة المرور الجديدة لازم تكون 6 حروف على الأقل'; return; }
      const salt = uid('k') + uid('k');
      S.admin = { u: u, s: salt, h: await sha(salt + ':' + n) };
    } catch (x) { err.textContent = 'المتصفح ده مش بيدعم تغيير كلمة المرور'; return; }
    $('#pw-old').value = ''; $('#pw-new').value = '';
    markDirty(); toast('اتغيرت. انشر التعديلات عشان تتفعل');
  }
}

boot();
