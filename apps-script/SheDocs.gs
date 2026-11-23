// ==================== SHE — แฟ้มเอกสาร (Word / Excel / PowerPoint / PDF) แยกตามปี ====================
//
// ผู้ใช้ขอ 20/11/69: ฝ่ายความปลอดภัยเก็บไฟล์ Word / Excel / PowerPoint ไว้ในระบบ เปิดดูได้ทุกเมื่อ แบ่งเป็นปี 2569 / 2570
// ไฟล์อยู่ในโฟลเดอร์ฝ่าย / "แฟ้มเอกสาร SHE" / "ปี 2569" (แชร์แบบมีลิงก์ดูได้) — ถ้าโฟลเดอร์ฝ่ายแชร์ไฟล์ไม่ได้ (เจ้าของโฟลเดอร์ปิดสิทธิ์)
// ย้ายไปไว้ใน Drive ของบัญชีระบบ "แฟ้มเอกสาร SHE (ฝ่ายความปลอดภัย)" แทน แบบเดียวกับภาพเช็คพนักงานของฝ่ายบุคคล
// ตาราง "แฟ้มเอกสาร" 1 แถว = 1 ไฟล์ · ปีที่แสดงเป็นแท็บตั้งในค่า docYears (เริ่มต้น 2569, 2570 · เพิ่มปีได้จากหน้าเว็บ)

var SHED_TABLE_ = { tab: 'แฟ้มเอกสาร', cols: [
  ['id', 'รหัส'], ['year', 'ปี (พ.ศ.)'], ['category', 'หมวด'], ['title', 'ชื่อเอกสาร'], ['fileName', 'ชื่อไฟล์'], ['mime', 'ชนิดไฟล์'],
  ['size', 'ขนาด (ไบต์)'], ['fileId', 'รหัสไฟล์'], ['url', 'ลิงก์เปิดดู'], ['note', 'หมายเหตุ'], ['by', 'ผู้อัปโหลด'], ['createdAt', 'อัปโหลดเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] };
var SHED_EXT_ = /\.(docx?|xlsx?|xlsm|csv|pptx?|pdf)$/i;
var SHED_MAX_ = 20 * 1024 * 1024;
// หมวดเอกสาร (ผู้ใช้ส่งรายการมา 20/11/69): บรรทัดขึ้นต้น "หมวด" = หมวดหลัก · บรรทัดอื่น = หมวดย่อยของหมวดหลักก่อนหน้า · แก้ได้ในหน้าเว็บ
var SHED_CATS_DEFAULT_ = 'หมวด 1 การตรวจวัดสภาพแวดล้อม\n1.1 การตรวจวัดความร้อน\n1.2 การตรวจวัดแสง\nหมวด 2 การตรวจ Boiler';

function shedInit_() {
  SHE_TABLES_.she_docs = SHED_TABLE_; PUR_TABLES_.she_docs = SHED_TABLE_;
  ['size'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
  if (!SHE_SETTINGS_DEFAULT_.docYears) SHE_SETTINGS_DEFAULT_.docYears = '2569, 2570';
  if (!SHE_SETTINGS_DEFAULT_.docCats) SHE_SETTINGS_DEFAULT_.docCats = SHED_CATS_DEFAULT_;
}
function shedYears_(ss) {
  var ys = String(sheSettings_(ss).docYears || '2569, 2570').split(/[,\s]+/).map(Number).filter(function (y) { return y >= 2500 && y <= 2700; });
  purRead_(ss, 'she_docs').forEach(function (d) { var y = Number(d.year); if (y && ys.indexOf(y) < 0) ys.push(y); });
  return ys.sort();
}
// โฟลเดอร์ชั้นบนสุดตั้งชื่อเองได้ (ผู้ใช้ขอ 23/11/69): นอกจากปี พ.ศ. แล้ว มีโฟลเดอร์ชื่อข้อความ เช่น "ใบอนุญาต"
// เก็บใน setting docRoots = JSON [{ name, cats: [{ name, subs: [..] }] }] · ไฟล์ในโฟลเดอร์ชื่อ: คอลัมน์ปีเก็บชื่อโฟลเดอร์, หมวด '' = ไว้ในโฟลเดอร์นั้นโดยตรง
function shedRoots_(ss) { try { var a = JSON.parse(sheSettings_(ss).docRoots || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function shedYearVal_(v) { var n = Number(v); return v !== '' && v != null && isFinite(n) && n >= 2500 && n <= 2700 ? n : String(v == null ? '' : v).trim(); }
// ปี (ตัวเลข) หรือชื่อโฟลเดอร์ที่มีอยู่จริง → คืนค่าที่ใช้เก็บ · ไม่ถูกต้อง = null
function shedRootOk_(ss, v) {
  var y = shedYearVal_(v);
  if (typeof y === 'number') return y;
  return y && shedRoots_(ss).some(function (x) { return x.name === y; }) ? y : null;
}
function shedOut_(d) {
  return { id: d.id, year: shedYearVal_(d.year), category: d.category || '', title: d.title || '', fileName: d.fileName || '', mime: d.mime || '', size: Number(d.size) || 0,
    fileId: d.fileId || '', url: d.url || '', note: d.note || '', by: d.by || '', createdAt: d.createdAt || '', updatedAt: d.updatedAt || '' };
}
function sheDocs(token) {
  var dept = requireShe_(token), ss = sheBook_(dept);
  return { ok: true, years: shedYears_(ss), roots: shedRoots_(ss), cats: String(sheSettings_(ss).docCats || SHED_CATS_DEFAULT_), docs: purRead_(ss, 'she_docs').map(shedOut_).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }) };
}
// โฟลเดอร์ปลายทาง: ฝ่าย / แฟ้มเอกสาร SHE / ปี xxxx (central = Drive ของบัญชีระบบ)
function shedFolder_(dept, year, central) {
  var parent = null, top = 'แฟ้มเอกสาร SHE', folderId = central ? '' : deptConfig_(dept.key).folderId;
  if (folderId) try { parent = DriveApp.getFolderById(folderId); parent.getName(); } catch (e) { parent = null; }
  if (!parent) { parent = DriveApp.getRootFolder(); top = 'แฟ้มเอกสาร SHE (ฝ่ายความปลอดภัย)'; }
  var sub = function (p, name) { var it = p.getFoldersByName(name); return it.hasNext() ? it.next() : p.createFolder(name); };
  return sub(sub(parent, top), typeof year === 'number' ? 'ปี ' + year : String(year).replace(/[\\/:*?"<>|]/g, '_'));
}
// meta = { year, category, title, note, by } · อัปโหลดทีละไฟล์ (หน้าเว็บส่งต่อกันเอง)
function sheUploadDoc(token, meta, fileName, mimeType, base64) {
  var dept = requireShe_(token);
  meta = meta || {};
  var year = shedRootOk_(sheBook_(dept), meta.year);
  if (year == null) return { ok: false, error: 'เลือกโฟลเดอร์ (ปี หรือชื่อโฟลเดอร์)' };
  var name = purClean_(fileName, 150).replace(/[\\/:*?"<>|]/g, '_');
  if (!SHED_EXT_.test(name)) return { ok: false, error: 'รับเฉพาะไฟล์ Word / Excel / PowerPoint / PDF' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length) return { ok: false, error: 'ไฟล์ว่าง' };
  if (bytes.length > SHED_MAX_) return { ok: false, error: 'ไฟล์ใหญ่เกิน 20 MB' };
  var blob = Utilities.newBlob(bytes, String(mimeType || 'application/octet-stream').slice(0, 120), name), f, moved = false;
  f = shedFolder_(dept, year).createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) {   // โฟลเดอร์ฝ่ายไม่ให้แชร์ → เก็บใน Drive ของบัญชีระบบแทน (เปิดดูได้จากหน้าเว็บเหมือนกัน)
    try { f.setTrashed(true); } catch (e2) {}
    f = shedFolder_(dept, year, true).createFile(blob); moved = true;
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e3) {}
  }
  return purLocked_(function () {
    var ss = sheBook_(dept), now = purNow_();
    var row = { id: purId_('DOC'), year: year, category: sheText_(meta.category, 80), title: sheText_(meta.title, 200) || name.replace(/\.[^.]+$/, ''), fileName: name,
      mime: blob.getContentType(), size: bytes.length, fileId: f.getId(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', note: sheText_(meta.note, 500),
      by: sheText_(meta.by, 60), createdAt: now, updatedAt: now };
    purWrite_(ss, 'she_docs', row);
    purLogWrite_(ss, 'อัปโหลดเอกสาร', 'she_docs', row.id, year + ' · ' + row.title + ' (' + name + ')' + (moved ? ' · เก็บใน Drive ระบบ' : ''));
    return { ok: true, doc: shedOut_(row) };
  });
}
function sheUpdateDoc(token, id, patch) {
  var dept = requireShe_(token);
  patch = patch || {};
  return purLocked_(function () {
    var ss = sheBook_(dept), d = purRead_(ss, 'she_docs').filter(function (x) { return x.id === id; })[0];
    if (!d) return { ok: false, error: 'ไม่พบเอกสาร' };
    if (patch.year !== undefined) { var y = shedRootOk_(ss, patch.year); if (y == null) return { ok: false, error: 'โฟลเดอร์ไม่ถูกต้อง' }; d.year = y; }
    if (patch.title !== undefined) d.title = sheText_(patch.title, 200) || d.title;
    if (patch.category !== undefined) d.category = sheText_(patch.category, 80);
    if (patch.note !== undefined) d.note = sheText_(patch.note, 500);
    d.updatedAt = purNow_();
    purWrite_(ss, 'she_docs', d);
    purLogWrite_(ss, 'แก้ข้อมูลเอกสาร', 'she_docs', id, d.year + ' · ' + d.title);
    return { ok: true, doc: shedOut_(d) };
  });
}
// ลบหลายไฟล์พร้อมกัน (ลบโฟลเดอร์ที่มีไฟล์ — ผู้ใช้ขอ 23/11/69): ไฟล์ไปถังขยะ Drive + ลบแถว · ลบจากแถวล่างขึ้นบน
function sheDeleteDocs(token, ids) {
  var dept = requireShe_(token);
  ids = (Array.isArray(ids) ? ids : []).map(String).slice(0, 500);
  if (!ids.length) return { ok: true, n: 0 };
  return purLocked_(function () {
    var ss = sheBook_(dept), want = {}, n = 0;
    ids.forEach(function (i) { want[i] = 1; });
    var rows = purRead_(ss, 'she_docs').filter(function (x) { return want[x.id]; }).sort(function (a, b) { return b._row - a._row; });
    rows.forEach(function (d) {
      try { DriveApp.getFileById(d.fileId).setTrashed(true); } catch (e) {}
      sheDeleteRow_(ss, 'she_docs', d); n++;
    });
    purLogWrite_(ss, 'ลบเอกสารหลายไฟล์ (ลบโฟลเดอร์)', 'she_docs', '', n + ' ไฟล์: ' + rows.map(function (d) { return d.title; }).slice(0, 30).join(', '));
    return { ok: true, n: n };
  });
}
function sheDeleteDoc(token, id) {
  var dept = requireShe_(token);
  return purLocked_(function () {
    var ss = sheBook_(dept), d = purRead_(ss, 'she_docs').filter(function (x) { return x.id === id; })[0];
    if (!d) return { ok: false, error: 'ไม่พบเอกสาร' };
    try { DriveApp.getFileById(d.fileId).setTrashed(true); } catch (e) {}
    sheDeleteRow_(ss, 'she_docs', d);
    purLogWrite_(ss, 'ลบเอกสาร', 'she_docs', id, d.year + ' · ' + d.title + ' (' + d.fileName + ')');
    return { ok: true };
  });
}
// เพิ่ม / ลบปีในแท็บ (ลบได้เฉพาะปีที่ไม่มีไฟล์)
function sheDocYears(token, years) {
  var dept = requireShe_(token);
  var ys = (Array.isArray(years) ? years : []).map(Number).filter(function (y) { return y >= 2500 && y <= 2700; })
    .filter(function (y, i, a) { return a.indexOf(y) === i; }).sort();
  return purLocked_(function () {
    var ss = sheBook_(dept), sr = purRead_(ss, 'she_settings').filter(function (x) { return x.id === 'docYears'; })[0];
    // ลบปีสุดท้ายได้ ถ้ายังมีโฟลเดอร์ตั้งชื่อเองอยู่ (ผู้ใช้ขอ 23/11/69) · ไม่มีปีเลย = เก็บ "-"
    if (!ys.length && !shedRoots_(ss).length) return { ok: false, error: 'ต้องมีอย่างน้อย 1 โฟลเดอร์' };
    var v = ys.length ? ys.join(', ') : '-';
    purWrite_(ss, 'she_settings', sr ? Object.assign(sr, { value: v }) : { id: 'docYears', value: v });
    return { ok: true, years: shedYears_(ss) };
  });
}
// บันทึกโฟลเดอร์ชื่อข้อความทั้งหมด (สร้าง / ลบโฟลเดอร์ว่าง / โฟลเดอร์ย่อยข้างใน) · ลบโฟลเดอร์ที่ยังมีไฟล์ไม่ได้
function sheDocRoots(token, roots) {
  var dept = requireShe_(token), clean = function (x) { return String(x || '').replace(/[›\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); };
  var list = (Array.isArray(roots) ? roots : []).slice(0, 40).map(function (r) {
    return { name: clean(r && r.name), cats: (Array.isArray(r && r.cats) ? r.cats : []).slice(0, 40).map(function (c) {
      return { name: clean(c && c.name), subs: (Array.isArray(c && c.subs) ? c.subs : []).slice(0, 40).map(clean).filter(String) };
    }).filter(function (c) { return c.name; }) };
  }).filter(function (r) { return r.name && typeof shedYearVal_(r.name) !== 'number'; });
  var names = list.map(function (r) { return r.name; });
  if (names.some(function (n, i) { return names.indexOf(n) !== i; })) return { ok: false, error: 'มีชื่อโฟลเดอร์ซ้ำกัน' };
  return purLocked_(function () {
    var ss = sheBook_(dept), docs = purRead_(ss, 'she_docs');
    var lost = shedRoots_(ss).filter(function (r) { return names.indexOf(r.name) < 0 && docs.some(function (d) { return String(d.year) === r.name; }); });
    if (lost.length) return { ok: false, error: 'โฟลเดอร์ "' + lost[0].name + '" ยังมีไฟล์อยู่ ลบไม่ได้' };
    var sr = purRead_(ss, 'she_settings').filter(function (x) { return x.id === 'docRoots'; })[0], val = JSON.stringify(list);
    purWrite_(ss, 'she_settings', sr ? Object.assign(sr, { value: val }) : { id: 'docRoots', value: val });
    purLogWrite_(ss, 'แก้โฟลเดอร์แฟ้มเอกสาร', 'she_settings', 'docRoots', names.join(' | '));
    return { ok: true, roots: list };
  });
}
function sheDocCats(token, text) {
  var dept = requireShe_(token);
  text = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(String).join('\n').slice(0, 3000);
  if (!text) return { ok: false, error: 'ต้องมีอย่างน้อย 1 หมวด' };
  return purLocked_(function () {
    var ss = sheBook_(dept), sr = purRead_(ss, 'she_settings').filter(function (x) { return x.id === 'docCats'; })[0];
    purWrite_(ss, 'she_settings', sr ? Object.assign(sr, { value: text }) : { id: 'docCats', value: text });
    purLogWrite_(ss, 'แก้หมวดแฟ้มเอกสาร', 'she_settings', 'docCats', text.replace(/\n/g, ' | '));
    return { ok: true, cats: text };
  });
}

// เปลี่ยนชื่อโฟลเดอร์ชั้นบน (ผู้ใช้ขอ 23/11/69): ปี → ปีอื่น / ชื่ออื่น (หมวดของปีติดไปเป็นโฟลเดอร์ย่อย) · ชื่อ → ชื่ออื่น
// ไฟล์ข้างในย้ายตาม (คอลัมน์ปีของไฟล์) · เปลี่ยนชื่อโฟลเดอร์ใน Drive ด้วยถ้าเจอ
function shedCatsFromText_(text) {
  var out = [];
  String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(String).forEach(function (l) {
    if (/^หมวด/.test(l) || !out.length) out.push({ name: l, subs: [] }); else out[out.length - 1].subs.push(l);
  });
  return out;
}
function shedDriveRename_(dept, from, to) {
  var oldN = typeof from === 'number' ? 'ปี ' + from : String(from).replace(/[\\/:*?"<>|]/g, '_');
  var newN = typeof to === 'number' ? 'ปี ' + to : String(to).replace(/[\\/:*?"<>|]/g, '_');
  var tops = [];
  try { var fid = deptConfig_(dept.key).folderId; if (fid) { var it = DriveApp.getFolderById(fid).getFoldersByName('แฟ้มเอกสาร SHE'); if (it.hasNext()) tops.push(it.next()); } } catch (e) {}
  try { var it2 = DriveApp.getRootFolder().getFoldersByName('แฟ้มเอกสาร SHE (ฝ่ายความปลอดภัย)'); if (it2.hasNext()) tops.push(it2.next()); } catch (e) {}
  tops.forEach(function (t) { try { var f = t.getFoldersByName(oldN); while (f.hasNext()) f.next().setName(newN); } catch (e) {} });
}
function sheRenameDocRoot(token, from, to) {
  var dept = requireShe_(token);
  var f = shedYearVal_(from), t = shedYearVal_(String(to == null ? '' : to).replace(/^ปี\s*/, '').replace(/[›\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60));
  if (t === '') return { ok: false, error: 'ใส่ชื่อโฟลเดอร์ใหม่' };
  return purLocked_(function () {
    var ss = sheBook_(dept), years = shedYears_(ss), roots = shedRoots_(ss);
    var isY = typeof f === 'number', ro = isY ? null : roots.filter(function (r) { return r.name === f; })[0];
    if (isY ? years.indexOf(f) < 0 : !ro) return { ok: false, error: 'ไม่พบโฟลเดอร์เดิม' };
    if (String(t) === String(f)) return { ok: true, years: years, roots: roots, docs: purRead_(ss, 'she_docs').map(shedOut_), to: t };
    if (years.indexOf(t) >= 0 || roots.some(function (r) { return r.name === String(t); })) return { ok: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว' };
    if (!isY && typeof t === 'number') return { ok: false, error: 'โฟลเดอร์ที่ตั้งชื่อเองเปลี่ยนเป็นปีไม่ได้ — ใช้ชื่อที่ไม่ใช่ตัวเลขปี' };
    // ย้ายไฟล์
    var n = 0, now = purNow_();
    purRead_(ss, 'she_docs').forEach(function (d) { if (String(shedYearVal_(d.year)) === String(f)) { d.year = t; d.updatedAt = now; purWrite_(ss, 'she_docs', d); n++; } });
    // ตั้งค่าโฟลเดอร์
    var st = sheSettings_(ss), w = function (id, v) { var sr = purRead_(ss, 'she_settings').filter(function (x) { return x.id === id; })[0]; purWrite_(ss, 'she_settings', sr ? Object.assign(sr, { value: v }) : { id: id, value: v }); };
    if (isY) {
      var ys = String(st.docYears || '').split(/[,\s]+/).map(Number).filter(function (y) { return y >= 2500 && y <= 2700 && y !== f; });
      if (typeof t === 'number') ys.push(t);
      else roots.push({ name: t, cats: shedCatsFromText_(st.docCats || SHED_CATS_DEFAULT_) });
      w('docYears', ys.length ? ys.sort().join(', ') : '-');
    } else ro.name = t;
    w('docRoots', JSON.stringify(roots));
    try { shedDriveRename_(dept, f, t); } catch (e) {}
    purLogWrite_(ss, 'เปลี่ยนชื่อโฟลเดอร์แฟ้มเอกสาร', 'she_settings', String(f), String(f) + ' → ' + String(t) + ' (' + n + ' ไฟล์)');
    return { ok: true, years: shedYears_(ss), roots: shedRoots_(ss), docs: purRead_(ss, 'she_docs').map(shedOut_), to: t, moved: n };
  });
}
