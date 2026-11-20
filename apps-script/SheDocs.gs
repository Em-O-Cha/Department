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
function shedOut_(d) {
  return { id: d.id, year: Number(d.year) || '', category: d.category || '', title: d.title || '', fileName: d.fileName || '', mime: d.mime || '', size: Number(d.size) || 0,
    fileId: d.fileId || '', url: d.url || '', note: d.note || '', by: d.by || '', createdAt: d.createdAt || '', updatedAt: d.updatedAt || '' };
}
function sheDocs(token) {
  var dept = requireShe_(token), ss = sheBook_(dept);
  return { ok: true, years: shedYears_(ss), cats: String(sheSettings_(ss).docCats || SHED_CATS_DEFAULT_), docs: purRead_(ss, 'she_docs').map(shedOut_).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }) };
}
// โฟลเดอร์ปลายทาง: ฝ่าย / แฟ้มเอกสาร SHE / ปี xxxx (central = Drive ของบัญชีระบบ)
function shedFolder_(dept, year, central) {
  var parent = null, top = 'แฟ้มเอกสาร SHE', folderId = central ? '' : deptConfig_(dept.key).folderId;
  if (folderId) try { parent = DriveApp.getFolderById(folderId); parent.getName(); } catch (e) { parent = null; }
  if (!parent) { parent = DriveApp.getRootFolder(); top = 'แฟ้มเอกสาร SHE (ฝ่ายความปลอดภัย)'; }
  var sub = function (p, name) { var it = p.getFoldersByName(name); return it.hasNext() ? it.next() : p.createFolder(name); };
  return sub(sub(parent, top), 'ปี ' + year);
}
// meta = { year, category, title, note, by } · อัปโหลดทีละไฟล์ (หน้าเว็บส่งต่อกันเอง)
function sheUploadDoc(token, meta, fileName, mimeType, base64) {
  var dept = requireShe_(token);
  meta = meta || {};
  var year = Number(meta.year);
  if (!(year >= 2500 && year <= 2700)) return { ok: false, error: 'เลือกปี (พ.ศ.)' };
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
    if (patch.year !== undefined) { var y = Number(patch.year); if (!(y >= 2500 && y <= 2700)) return { ok: false, error: 'ปีไม่ถูกต้อง' }; d.year = y; }
    if (patch.title !== undefined) d.title = sheText_(patch.title, 200) || d.title;
    if (patch.category !== undefined) d.category = sheText_(patch.category, 80);
    if (patch.note !== undefined) d.note = sheText_(patch.note, 500);
    d.updatedAt = purNow_();
    purWrite_(ss, 'she_docs', d);
    purLogWrite_(ss, 'แก้ข้อมูลเอกสาร', 'she_docs', id, d.year + ' · ' + d.title);
    return { ok: true, doc: shedOut_(d) };
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
  if (!ys.length) return { ok: false, error: 'ต้องมีอย่างน้อย 1 ปี' };
  return purLocked_(function () {
    var ss = sheBook_(dept), sr = purRead_(ss, 'she_settings').filter(function (x) { return x.id === 'docYears'; })[0];
    purWrite_(ss, 'she_settings', sr ? Object.assign(sr, { value: ys.join(', ') }) : { id: 'docYears', value: ys.join(', ') });
    return { ok: true, years: shedYears_(ss) };
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
