// ==================== SHE — ตรวจประจำเดือน (FM-SHE-05-04 … 05-08) ====================
//
// ผู้ใช้ขอ 20/11/69: แบบฟอร์มตรวจเดือนละครั้ง 5 แบบ กรอกในระบบแล้วพิมพ์ออกมาเป็นแบบฟอร์ม
//   05-04 ไฟส่องทางออกฉุกเฉิน · 05-05 ป้ายทางออกฉุกเฉิน · 05-06 ประตูทางออกฉุกเฉิน
//   05-07 ปุ่มกดสัญญาณแจ้งเหตุเพลิงไหม้ · 05-08 เครื่องตรวจจับควัน (Smoke Detector)
// หัวข้อ / ช่อง / ผู้ลงนามของแต่ละแบบอยู่ในหน้าเว็บ (safety.js SHEM_FORMS) — ที่นี่เก็บผลเป็น JSON ต่อ 1 แบบ × 1 เดือน
// แท็บ "ตรวจประจำเดือน" (1 แถว = แบบฟอร์ม + เดือน) · จุดติดตั้งของแต่ละแบบจำไว้ในแท็บตั้งค่า (mLoc_<แบบ>) ใช้เป็นรายการตั้งต้นเดือนถัดไป
// รหัสแบบฟอร์ม (มุมขวาบน) ตั้งได้ในหน้าตั้งค่า: fm0504 … fm0508

var SHEM_FORM_KEYS_ = ['05-04', '05-05', '05-06', '05-07', '05-08'];
var SHEM_TABLE_ = { tab: 'ตรวจประจำเดือน', cols: [
  ['id', 'รหัส'], ['form', 'แบบฟอร์ม'], ['ym', 'เดือน'], ['rows', 'ผลตรวจ'], ['okCount', 'ปกติ'], ['badCount', 'ผิดปกติ'],
  ['inspector', 'ผู้ตรวจสอบ'], ['inspDate', 'วันที่ตรวจสอบ'], ['approver', 'ผู้อนุมัติ'], ['approveDate', 'วันที่อนุมัติ'],
  ['tester', 'ผู้ทดสอบ'], ['testDate', 'วันที่ทดสอบ'], ['note', 'หมายเหตุ'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] };
// ลงทะเบียนตาราง / ค่าตั้งต้นตอนเปิดชีต (sheRegister_ เรียก) — ไม่พึ่งลำดับไฟล์ของ Apps Script
function shemInit_() {
  SHE_TABLES_.she_monthly = SHEM_TABLE_; PUR_TABLES_.she_monthly = SHEM_TABLE_;
  ['inspDate', 'approveDate', 'testDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['okCount', 'badCount'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
  SHEM_FORM_KEYS_.forEach(function (k) { var id = 'fm' + k.replace('-', ''); if (!SHE_SETTINGS_DEFAULT_[id]) SHE_SETTINGS_DEFAULT_[id] = 'FM-SHE-' + k + ' Rev.00 วันที่ประกาศใช้ 05/01/2026'; });
}

function shemId_(form, ym) { return 'M' + form.replace('-', '') + '_' + ym; }
function shemOut_(r) {
  return { id: r.id, form: String(r.form), ym: String(r.ym).replace(/^'/, ''), rows: sheJson_(r.rows, []), okCount: Number(r.okCount) || 0, badCount: Number(r.badCount) || 0,
    inspector: r.inspector || '', inspDate: r.inspDate || '', approver: r.approver || '', approveDate: r.approveDate || '',
    tester: r.tester || '', testDate: r.testDate || '', note: r.note || '', updatedAt: r.updatedAt || r.createdAt || '' };
}
function shemLocs_(ss) {
  var s = sheSettings_(ss), out = {};
  SHEM_FORM_KEYS_.forEach(function (k) { out[k] = sheJson_(s['mLoc_' + k], []); });
  return out;
}

// ข้อมูลของเดือน ym: ผลทุกแบบ + จุดติดตั้งที่จำไว้ + รหัสแบบฟอร์ม + เดือนที่ตรวจแล้วย้อนหลัง 12 เดือน
function sheMonthly(token, ym) {
  var dept = requireShe_(token);
  ym = String(ym || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return { ok: false, error: 'เลือกเดือน' };
  var ss = sheReadBook_(dept), all = purRead_(ss, 'she_monthly').map(shemOut_), recs = {}, done = {};
  var from = (function () { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 11; while (m < 1) { m += 12; y--; } return y + '-' + ('0' + m).slice(-2); })();
  all.forEach(function (r) {
    if (r.ym === ym) recs[r.form] = r;
    if (r.ym >= from && r.ym <= ym) (done[r.form] = done[r.form] || []).push({ ym: r.ym, bad: r.badCount });
  });
  var s = sheSettings_(ss), fm = {};
  SHEM_FORM_KEYS_.forEach(function (k) { fm[k] = s['fm' + k.replace('-', '')]; });
  return { ok: true, ym: ym, today: purToday_(), records: recs, locs: shemLocs_(ss), fm: fm, done: done, settings: s };
}

// rec = { form, ym, rows: [{ loc, r: ['P'|'X'|'-'|'O'|''], sum, note }], inspector, inspDate, approver, approveDate, tester, testDate, note }
function sheSaveMonthly(token, rec) {
  var dept = requireShe_(token);
  rec = rec || {};
  var form = String(rec.form || ''), ym = String(rec.ym || '').slice(0, 7);
  if (SHEM_FORM_KEYS_.indexOf(form) < 0) return { ok: false, error: 'ไม่รู้จักแบบฟอร์ม' };
  if (!/^\d{4}-\d{2}$/.test(ym)) return { ok: false, error: 'เลือกเดือน' };
  var ok = 0, bad = 0;
  var rows = (Array.isArray(rec.rows) ? rec.rows : []).slice(0, 200).map(function (x) {
    var r = (Array.isArray(x && x.r) ? x.r : []).slice(0, 10).map(function (c) { c = String(c || ''); return /^[PX\-O]$/.test(c) ? c : ''; });
    r.forEach(function (c) { if (c === 'P') ok++; if (c === 'X' || c === 'O') bad++; });
    // detail / files = บันทึกปัญหาของจุดที่ผิดปกติ (ผู้ใช้ขอ 20/11/69: เก็บไว้ดูในระบบ ไม่แสดงในเอกสาร — เอกสารพิมพ์แค่หมายเหตุ)
    var files = (Array.isArray(x && x.files) ? x.files : []).slice(0, 10).filter(function (f) { return f && /^[\w-]{20,}$/.test(String(f.id)); })
      .map(function (f) { return { id: String(f.id), name: sheText_(f.name, 100), url: 'https://drive.google.com/file/d/' + String(f.id) + '/view', at: sheText_(f.at, 20) }; });
    return { loc: sheText_(x && x.loc, 150), r: r, sum: sheText_(x && x.sum, 30), note: sheText_(x && x.note, 300), detail: sheText_(x && x.detail, 1000), files: files };
  }).filter(function (x) { return x.loc || x.r.some(String) || x.note || x.detail || x.files.length; });
  return purLocked_(function () {
    var ss = sheBook_(dept), id = shemId_(form, ym), now = purNow_();
    var old = purRead_(ss, 'she_monthly').filter(function (r) { return r.id === id; })[0];
    var row = old || { id: id, createdAt: now };
    Object.assign(row, { form: form, ym: "'" + ym, rows: JSON.stringify(rows), okCount: ok, badCount: bad,
      inspector: sheText_(rec.inspector, 80), inspDate: purDate_(rec.inspDate), approver: sheText_(rec.approver, 80), approveDate: purDate_(rec.approveDate),
      tester: sheText_(rec.tester, 80), testDate: purDate_(rec.testDate), note: sheText_(rec.note, 500), updatedAt: now });
    purWrite_(ss, 'she_monthly', row);
    // จำจุดติดตั้งไว้ใช้เดือนถัดไป (ตามลำดับที่กรอก)
    var locs = rows.map(function (x) { return x.loc; }).filter(function (l, i, a) { return l && a.indexOf(l) === i; });
    if (locs.length) {
      var key = 'mLoc_' + form, sr = purRead_(ss, 'she_settings').filter(function (x) { return x.id === key; })[0];
      purWrite_(ss, 'she_settings', sr ? Object.assign(sr, { value: JSON.stringify(locs) }) : { id: key, value: JSON.stringify(locs) });
    }
    purLogWrite_(ss, old ? 'แก้ผลตรวจประจำเดือน' : 'บันทึกผลตรวจประจำเดือน', 'she_monthly', id, 'FM-SHE-' + form + ' ' + ym + ' · ' + rows.length + ' จุด · ผิดปกติ ' + bad);
    return { ok: true, record: shemOut_(purRead_(ss, 'she_monthly').filter(function (r) { return r.id === id; })[0]) };
  });
}
function sheDeleteMonthly(token, form, ym) {
  var dept = requireShe_(token);
  return purLocked_(function () {
    var ss = sheBook_(dept), id = shemId_(String(form || ''), String(ym || '').slice(0, 7));
    var old = purRead_(ss, 'she_monthly').filter(function (r) { return r.id === id; })[0];
    if (!old) return { ok: false, error: 'ไม่พบรายการ' };
    sheDeleteRow_(ss, 'she_monthly', old);
    purLogWrite_(ss, 'ลบผลตรวจประจำเดือน', 'she_monthly', id, '');
    return { ok: true };
  });
}

// รูปของจุดที่ผิดปกติ → โฟลเดอร์ฝ่าย / "รูปตรวจประจำเดือน" (อัปโหลดทันทีที่ถ่าย · ผูกกับจุดตอนกดบันทึก)
function sheMonthlyPhoto(token, form, ym, fileName, mimeType, base64) {
  var dept = requireShe_(token);
  if (SHEM_FORM_KEYS_.indexOf(String(form)) < 0) return { ok: false, error: 'ไม่รู้จักแบบฟอร์ม' };
  if (!/^image\/(jpeg|png|webp)$/.test(String(mimeType))) return { ok: false, error: 'แนบได้เฉพาะรูปภาพ' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return { ok: false, error: 'ไฟล์ว่างหรือใหญ่เกิน 10 MB' };
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์เก็บรูปของฝ่าย' };
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รูปตรวจประจำเดือน'), folder = it.hasNext() ? it.next() : parent.createFolder('รูปตรวจประจำเดือน');
  var safe = purClean_(fileName, 100).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
  var f = folder.createFile(Utilities.newBlob(bytes, mimeType, 'FM-SHE-' + form + '_' + String(ym).slice(0, 7) + '_' + safe));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { ok: true, file: { id: f.getId(), name: safe, url: 'https://drive.google.com/file/d/' + f.getId() + '/view', at: purNow_() } };
}
