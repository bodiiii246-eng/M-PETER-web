/* ---------- pure logic ---------- */
const r2 = n => Math.round(n * 100) / 100;
const fmt = n => String(r2(n));

function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function toLatinDigits(s) {
  return String(s)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٫,،]/g, '.');
}

/* parse a typed grade: {empty}, {ok:false}, or {ok:true,val} */
function pg(raw, max) {
  const t = toLatinDigits(raw).trim();
  if (t === '') return { ok: true, empty: true };
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return { ok: false };
  const v = parseFloat(t);
  if (v < 0 || v > max) return { ok: false, over: v > max };
  return { ok: true, val: v };
}

/* totals and ranks for one class. Equal totals share a rank (1,2,2,4). */
function calc(S, classId) {
  const exams = S.exams.filter(e => e.classId === classId);
  const counted = exams.filter(e => {
    const g = S.grades[e.id];
    return g && Object.keys(g).length > 0;
  });
  const rows = S.students.filter(s => s.classId === classId).map(s => {
    let total = 0, max = 0, n = 0;
    const per = exams.map(e => {
      const v = (S.grades[e.id] || {})[s.id];
      const has = typeof v === 'number';
      if (has) { total += v; max += e.max; n++; }
      return { e, v: has ? v : null };
    });
    return { s, total: r2(total), max: r2(max), n, per };
  });
  const ranked = counted.length > 0;
  rows.forEach(r => {
    r.rank = null;
    if (ranked && r.n > 0) r.rank = 1 + rows.filter(o => o.n > 0 && o.total > r.total).length;
  });
  return { exams, counted, rows, ranked };
}

function sortRows(rows, mode) {
  const byName = (a, b) => a.s.name.localeCompare(b.s.name, 'ar');
  return rows.slice().sort((a, b) => {
    if (mode === 'name') return byName(a, b);
    const ra = a.rank == null ? 1e9 : a.rank, rb = b.rank == null ? 1e9 : b.rank;
    return ra - rb || byName(a, b);
  });
}
