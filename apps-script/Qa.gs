// ==================== ฝ่ายประกันคุณภาพ (QA) — ข้อร้องเรียนลูกค้า ====================
//
// ข้อมูลเก็บใน Google Sheet ของฝ่าย (ตั้งลิงก์ในหน้าผู้ดูแลระบบ) · รูปถ่ายเก็บในโฟลเดอร์ Drive ของฝ่าย
// 1 เรื่องร้องเรียน = 1 แถวในแท็บ "ข้อร้องเรียนลูกค้า":
//   รับเรื่อง (ลูกค้า / สินค้า / LOT / ปัญหา / ความรุนแรง / รูป) → ตรวจสอบสาเหตุ (4M1E) → การแก้ไขเป็นรอบ (รอบ 1, 2, …
//   แต่ละรอบ: วิธีแก้ไข ผู้รับผิดชอบ กำหนดเสร็จ วันทวนสอบ ผล แก้ไขได้ / แก้ไขไม่ได้) → การป้องกันซ้ำ → แจ้งผลลูกค้า → ปิดเรื่อง
// ระยะเวลา: ตอบลูกค้าครั้งแรก · แต่ละรอบ (เริ่ม → ทวนสอบ) · ทั้งเรื่อง (รับเรื่อง → ปิด) เทียบเป้าหมายในหน้าตั้งค่า
// ใช้ตัวอ่าน/เขียนชีตของ Purchasing.gs (อ่านตามชื่อหัวคอลัมน์) · ทุกฟังก์ชันต้องมีตั๋วของฝ่าย QA (requireQa_)

var QA_TABLES_ = {
  qa_complaints: { tab: 'ข้อร้องเรียนลูกค้า', cols: [
    ['id', 'รหัส'], ['code', 'เลขที่'], ['recvDate', 'วันที่รับเรื่อง'], ['recvTime', 'เวลา'], ['channel', 'ช่องทาง'], ['receiver', 'ผู้รับเรื่อง'],
    ['custName', 'ชื่อลูกค้า'], ['custPhone', 'เบอร์โทรลูกค้า'], ['custType', 'ประเภทลูกค้า'], ['custPlace', 'ที่อยู่ / สาขา'],
    ['product', 'สินค้า'], ['lot', 'LOT'], ['mfgDate', 'วันผลิต'], ['expDate', 'วันหมดอายุ'], ['qty', 'จำนวนที่มีปัญหา'], ['buyFrom', 'ซื้อจาก'],
    ['issueType', 'ประเภทปัญหา'], ['detail', 'รายละเอียดปัญหา'], ['severity', 'ความรุนแรง'], ['sample', 'ตัวอย่างสินค้า'],
    ['valid', 'ผลพิสูจน์ข้อร้องเรียน'], ['investigation', 'ผลการตรวจสอบ'], ['causeCat', 'หมวดสาเหตุ'], ['rootCause', 'สาเหตุที่แท้จริง'],
    ['remedy', 'การชดเชยลูกค้า'], ['remedyDetail', 'รายละเอียดการชดเชย'], ['remedyCost', 'มูลค่าชดเชย (บาท)'],
    ['rounds', 'การแก้ไข (ทุกรอบ)'], ['roundCount', 'จำนวนรอบ'], ['lastResult', 'ผลรอบล่าสุด'],
    ['preventive', 'การป้องกันไม่ให้เกิดซ้ำ'], ['replyDate', 'วันที่ตอบลูกค้าครั้งแรก'], ['informDate', 'วันที่แจ้งผลลูกค้า'], ['satisfaction', 'ความพึงพอใจลูกค้า'],
    ['status', 'สถานะ'], ['closeDate', 'วันที่ปิดเรื่อง'], ['closeNote', 'สรุปการปิดเรื่อง'], ['closedBy', 'ผู้ปิดเรื่อง'], ['days', 'ระยะเวลาทั้งเรื่อง (วัน)'],
    ['files', 'รูปปัญหา'], ['fixFiles', 'รูปหลังแก้ไข'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  qa_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] },
  // งานตรวจวิเคราะห์ / ค่าใช้จ่าย: 1 แถว = ตัวอย่าง 1 รายการ × รายการตรวจ 1 อย่าง (kind test) หรือค่าใช้จ่ายอื่น 1 รายการ (kind other)
  qa_tests: { tab: 'ตรวจวิเคราะห์', cols: [
    ['id', 'รหัส'], ['year', 'ปี (ค.ศ.)'], ['kind', 'ประเภท'], ['sample', 'ตัวอย่าง / รายการ'], ['testType', 'รายการตรวจ'], ['price', 'ราคา (บาท)'],
    ['lab', 'ห้องแล็บ / ผู้ให้บริการ'], ['status', 'สถานะ'], ['sentDate', 'วันที่ส่งตรวจ / จ่าย'], ['resultDate', 'วันที่ได้ผล'], ['result', 'ผลตรวจ'],
    ['note', 'หมายเหตุ'], ['files', 'ใบผล / เอกสาร'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  qa_newprod: { tab: 'ผลิตภัณฑ์ใหม่', cols: [
    ['id', 'รหัส'], ['year', 'ปี (ค.ศ.)'], ['market', 'ตลาด'], ['name', 'ชื่อผลิตภัณฑ์'], ['stage', 'ขั้นตอน'], ['fdaNo', 'เลข อย.'],
    ['note', 'หมายเหตุ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] }
};
var QA_STATUS_ = { open: 'รับเรื่อง', investigating: 'ตรวจสอบสาเหตุ', fixing: 'กำลังแก้ไข', closed_ok: 'ปิดเรื่อง · แก้ไขได้', closed_fail: 'ปิดเรื่อง · แก้ไขไม่ได้', record: 'บันทึกย้อนหลัง' };
// record = เรื่องเก่าที่บันทึกไว้เป็นสถิติ (นับในยอดรวม/สินค้า/ประเภทปัญหา/รายเดือน แต่ไม่นับว่าค้างหรือเกินกำหนด)
var QA_TEST_ST_ = { plan: 'ตามแผน · ยังไม่ส่ง', sent: 'ส่งตรวจแล้ว · รอผล', done: 'ได้ผลแล้ว / จ่ายแล้ว', cancel: 'ยกเลิก' };
var QA_STAGES_ = ['พัฒนาสูตร', 'ส่งตรวจวิเคราะห์', 'ขอเลข อย.', 'พร้อมขาย / วางขายแล้ว', 'ยกเลิก'];
var QA_SEV_ = { L: 'ต่ำ', M: 'ปานกลาง', H: 'สูง', C: 'วิกฤต (ความปลอดภัยอาหาร)' };
var QA_RESULT_ = { wait: 'รอทวนสอบ', ok: 'แก้ไขได้', fail: 'แก้ไขไม่ได้' };
var QA_SETTINGS_DEFAULT_ = {
  channels: 'LINE OA, Facebook, โทรศัพท์, Shopee / Lazada / TikTok, 7-Eleven (CP ALL), ตัวแทนจำหน่าย, หน้าร้าน / บูธ, อื่น ๆ',
  custTypes: 'ผู้บริโภค, ตัวแทนจำหน่าย, ร้านค้า / ห้าง, ลูกค้าออนไลน์',
  issueTypes: 'สิ่งแปลกปลอม, รสชาติ / กลิ่นผิดปกติ, เชื้อรา / เน่าเสีย, บรรจุภัณฑ์เสียหาย / รั่ว, ฉลาก / วันหมดอายุไม่ถูกต้อง, น้ำหนัก / ปริมาณไม่ครบ, สี / ลักษณะผิดปกติ, ขนส่ง / ส่งผิด / ส่งช้า, อื่น ๆ',
  causeCats: 'คน (Man), เครื่องจักร (Machine), วัตถุดิบ (Material), วิธีการ (Method), สิ่งแวดล้อม (Environment), ขนส่ง / ร้านค้า, ไม่พบสาเหตุจากโรงงาน',
  remedies: 'เปลี่ยนสินค้าใหม่, คืนเงิน, ส่งสินค้าชดเชย, ให้ส่วนลด / คูปอง, ขอโทษ / ชี้แจง, ไม่มีการชดเชย',
  products: '', people: '',
  testTypes: 'Microbiological and Chemical, Nutrition, Gluten Free, MSG, Non-GMO', labs: '',
  replyDays: '1', closeDays: '15', roundDays: '7',
  formCode: '', signRecv: 'ผู้รับเรื่อง', signQa: 'ผู้ตรวจสอบ (QA)', signApprove: 'ผู้อนุมัติ'
};

// ---------- พื้นฐาน ----------
function requireQa_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'quality') throw new Error('แผนกนี้ไม่มีระบบประกันคุณภาพ');
  return dept;
}
function qaRegister_() {
  Object.keys(QA_TABLES_).forEach(function (k) { PUR_TABLES_[k] = QA_TABLES_[k]; });
  ['recvDate', 'mfgDate', 'expDate', 'replyDate', 'informDate', 'closeDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['remedyCost', 'roundCount', 'days', 'year'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
  ['sentDate', 'resultDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
}
function qaBook_(dept) { qaRegister_(); return purBook_(dept); }
function qaText_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 1000); }
function qaDays_(a, b) { return a && b ? Math.round((purToDate_(b) - purToDate_(a)) / 864e5) : ''; }
function qaSettings_(ss) {
  var s = {};
  Object.keys(QA_SETTINGS_DEFAULT_).forEach(function (k) { s[k] = QA_SETTINGS_DEFAULT_[k]; });
  purRead_(ss, 'qa_settings').forEach(function (x) { if (x.id) s[x.id] = String(x.value == null ? '' : x.value); });
  return s;
}
function qaOut_(c) {
  c.files = purParseFiles_(c.files); c.fixFiles = purParseFiles_(c.fixFiles);
  try { c.rounds = JSON.parse(c.rounds || '[]'); } catch (e) { c.rounds = []; }
  if (!Array.isArray(c.rounds)) c.rounds = [];
  return c;
}
function qaNextCode_(ss, date) {
  var pre = 'CC' + String(date).slice(2, 4) + String(date).slice(5, 7) + '-', n = 0;
  purRead_(ss, 'qa_complaints').forEach(function (x) { if (String(x.code).indexOf(pre) === 0) n = Math.max(n, parseInt(String(x.code).slice(pre.length), 10) || 0); });
  return pre + ('00' + (n + 1)).slice(-3);
}

// ---------- โหลดหน้า ----------
function qaLoad(token) {
  var dept = requireQa_(token), ss = qaBook_(dept);
  return { ok: true, today: purToday_(), sheetUrl: ss.getUrl(), hasFolder: !!deptConfig_(dept.key).folderId, settings: qaSettings_(ss),
    complaints: purRead_(ss, 'qa_complaints').map(qaOut_).sort(function (a, b) { return String(b.recvDate + b.code).localeCompare(String(a.recvDate + a.code)); }),
    tests: purRead_(ss, 'qa_tests').map(function (t) { t.files = purParseFiles_(t.files); return t; }),
    newprods: purRead_(ss, 'qa_newprod') };
}

// ---------- บันทึกเรื่องร้องเรียน (ใหม่ / แก้ไข) ----------
// rounds = [{ no, startDate, action, responsible, dueDate, verifyDate, result: wait|ok|fail, resultNote, verifier }]
function qaCleanRounds_(list) {
  return (Array.isArray(list) ? list : []).slice(0, 10).map(function (r, i) {
    r = r || {};
    return { no: i + 1, startDate: purDate_(r.startDate), action: qaText_(r.action, 1500), responsible: purClean_(r.responsible, 120),
      dueDate: purDate_(r.dueDate), verifyDate: purDate_(r.verifyDate), result: QA_RESULT_[r.result] ? r.result : 'wait',
      resultNote: qaText_(r.resultNote, 1000), verifier: purClean_(r.verifier, 120) };
  }).filter(function (r) { return r.action || r.startDate || r.responsible; });
}
function qaSave(token, c) {
  var dept = requireQa_(token);
  c = c || {};
  if (!purClean_(c.product, 150)) return { ok: false, error: 'ระบุสินค้าที่ถูกร้องเรียน' };
  if (!purClean_(c.issueType, 80)) return { ok: false, error: 'เลือกประเภทปัญหา' };
  if (!qaText_(c.detail)) return { ok: false, error: 'เขียนรายละเอียดปัญหา' };
  var rounds = qaCleanRounds_(c.rounds);
  // ตรวจลำดับรอบ: เริ่มรอบใหม่ได้เมื่อรอบก่อนหน้า "แก้ไขไม่ได้" · ผลรอบต้องมีวันที่ทวนสอบ
  for (var i = 0; i < rounds.length; i++) {
    var r = rounds[i];
    if (!r.action) return { ok: false, error: 'รอบที่ ' + r.no + ': เขียนวิธีการแก้ไข' };
    if (r.result !== 'wait' && !r.verifyDate) return { ok: false, error: 'รอบที่ ' + r.no + ': ใส่วันที่ทวนสอบผล' };
    if (r.verifyDate && r.startDate && r.verifyDate < r.startDate) return { ok: false, error: 'รอบที่ ' + r.no + ': วันที่ทวนสอบต้องไม่ก่อนวันที่เริ่มแก้ไข' };
    if (i > 0 && rounds[i - 1].result !== 'fail') return { ok: false, error: 'เริ่มรอบที่ ' + r.no + ' ได้เมื่อรอบที่ ' + (r.no - 1) + ' ผลเป็น "แก้ไขไม่ได้"' };
  }
  var status = QA_STATUS_[c.status] ? c.status : 'open';
  // ยังไม่ปิด → สถานะตามขั้นตอนที่ทำแล้ว (มีรอบแก้ไข = กำลังแก้ไข · มีผลตรวจสอบ = ตรวจสอบสาเหตุ)
  if (status.indexOf('closed') !== 0 && status !== 'record') status = rounds.length ? 'fixing' : (qaText_(c.investigation) || qaText_(c.rootCause) || purClean_(c.causeCat)) ? 'investigating' : 'open';
  var last = rounds.length ? rounds[rounds.length - 1] : null;
  if (status === 'closed_ok' && (!last || last.result !== 'ok')) return { ok: false, error: 'ปิดเรื่องแบบ "แก้ไขได้" ต้องมีรอบการแก้ไขที่ผลเป็น "แก้ไขได้"' };
  if (status === 'closed_fail' && (!last || last.result !== 'fail')) return { ok: false, error: 'ปิดเรื่องแบบ "แก้ไขไม่ได้" ต้องมีรอบล่าสุดที่ผลเป็น "แก้ไขไม่ได้"' };
  if (status === 'closed_fail' && !qaText_(c.closeNote)) return { ok: false, error: 'ปิดเรื่องแบบแก้ไขไม่ได้ ต้องเขียนสรุปเหตุผล / สิ่งที่ทำต่อ' };
  return purLocked_(function () {
    var ss = qaBook_(dept), list = purRead_(ss, 'qa_complaints');
    var old = c.id ? list.filter(function (x) { return x.id === c.id; })[0] : null;
    if (c.id && !old) return { ok: false, error: 'ไม่พบเรื่องร้องเรียนนี้' };
    var now = purNow_(), recvDate = purDate_(c.recvDate) || purToday_();
    var o = old || { id: purId_('CC'), code: qaNextCode_(ss, recvDate), files: '[]', fixFiles: '[]', createdAt: now };
    o.recvDate = recvDate; o.recvTime = purClean_(c.recvTime, 5);
    ['channel', 'receiver', 'custName', 'custPhone', 'custType', 'product', 'lot', 'qty', 'buyFrom', 'issueType', 'sample', 'valid', 'causeCat', 'remedy', 'satisfaction', 'closedBy']
      .forEach(function (k) { o[k] = purClean_(c[k], 150); });
    ['custPlace', 'detail', 'investigation', 'rootCause', 'remedyDetail', 'preventive', 'closeNote'].forEach(function (k) { o[k] = qaText_(c[k], 2000); });
    o.mfgDate = purDate_(c.mfgDate); o.expDate = purDate_(c.expDate); o.replyDate = purDate_(c.replyDate); o.informDate = purDate_(c.informDate);
    o.severity = QA_SEV_[c.severity] ? c.severity : 'M';
    o.remedyCost = purNum_(c.remedyCost);
    o.rounds = JSON.stringify(rounds); o.roundCount = rounds.length; o.lastResult = last ? QA_RESULT_[last.result] : '';
    if (status.indexOf('closed') === 0) {
      o.closeDate = purDate_(c.closeDate) || (old && old.closeDate) || purToday_();
      if (o.closeDate < o.recvDate) return { ok: false, error: 'วันที่ปิดเรื่องต้องไม่ก่อนวันที่รับเรื่อง' };
    } else o.closeDate = '';
    o.status = status;
    o.days = status === 'record' ? '' : qaDays_(o.recvDate, o.closeDate || purToday_());
    o.updatedAt = now;
    purWrite_(ss, 'qa_complaints', o);
    purLogWrite_(ss, old ? 'แก้ไขเรื่องร้องเรียน' : 'รับเรื่องร้องเรียน', 'qa_complaints', o.id,
      o.code + ' · ' + o.product + ' · ' + o.issueType + ' · ' + QA_STATUS_[status] + (old && old.status !== status ? ' (เดิม ' + (QA_STATUS_[old.status] || old.status) + ')' : ''));
    var saved = purRead_(ss, 'qa_complaints').filter(function (x) { return x.id === o.id; })[0];
    return { ok: true, complaint: qaOut_(saved) };
  });
}
function qaDelete(token, id) {
  var dept = requireQa_(token);
  return purLocked_(function () {
    var ss = qaBook_(dept), row = purRead_(ss, 'qa_complaints').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบเรื่องร้องเรียนนี้' };
    purParseFiles_(row.files).concat(purParseFiles_(row.fixFiles)).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    purSheet_(ss, 'qa_complaints').deleteRow(row._row);
    purLogWrite_(ss, 'ลบเรื่องร้องเรียน', 'qa_complaints', id, row.code + ' ' + row.product + ' · ' + row.issueType);
    return { ok: true };
  });
}

// ---------- รูปถ่าย (รูปปัญหา / รูปหลังแก้ไข) ----------
var QA_SLOTS_ = { files: 'files', fix: 'fixFiles', test: 'files' };
function qaSlotTable_(slot) { return slot === 'test' ? 'qa_tests' : 'qa_complaints'; }
function qaUploadFile(token, id, slot, fileName, mimeType, base64) {
  var dept = requireQa_(token), col = QA_SLOTS_[slot];
  if (!col) return { ok: false, error: 'ไม่รู้ว่าจะแนบกับส่วนไหน' };
  if (!/^image\/(jpeg|png|webp|heic)$/.test(mimeType) && mimeType !== 'application/pdf') return { ok: false, error: 'แนบได้เฉพาะรูปภาพหรือ PDF' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return { ok: false, error: 'ไฟล์ว่างหรือใหญ่เกิน 10 MB' };
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์เก็บรูปของฝ่าย' };
  return purLocked_(function () {
    var tbl = qaSlotTable_(slot), ss = qaBook_(dept), row = purRead_(ss, tbl).filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: slot === 'test' ? 'ไม่พบรายการตรวจนี้' : 'ไม่พบเรื่องร้องเรียนนี้' };
    var safe = purClean_(fileName, 100).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
    var pre = slot === 'test' ? 'ผลตรวจ_' + row.sample + '_' + (row.testType || '') : row.code + '_' + (slot === 'fix' ? 'หลังแก้ไข' : 'ปัญหา');
    var f = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mimeType, pre + '_' + safe));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    var files = purParseFiles_(row[col]);
    var rec = { id: f.getId(), name: safe, mime: mimeType, url: 'https://drive.google.com/file/d/' + f.getId() + '/view', at: purNow_() };
    files.push(rec);
    row[col] = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, tbl, row);
    purLogWrite_(ss, 'แนบไฟล์', tbl, id, (row.code || row.sample) + ' ' + slot + ' ' + safe);
    return { ok: true, file: rec, files: files };
  });
}
function qaRemoveFile(token, id, slot, fileId) {
  var dept = requireQa_(token), col = QA_SLOTS_[slot];
  if (!col) return { ok: false, error: 'ไม่รู้ว่าจะลบจากส่วนไหน' };
  return purLocked_(function () {
    var tbl = qaSlotTable_(slot), ss = qaBook_(dept), row = purRead_(ss, tbl).filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    var files = purParseFiles_(row[col]);
    if (!files.some(function (x) { return x.id === fileId; })) return { ok: false, error: 'ไม่พบรูป' };
    files = files.filter(function (x) { return x.id !== fileId; });
    row[col] = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, tbl, row);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    purLogWrite_(ss, 'ลบไฟล์', tbl, id, (row.code || row.sample) + ' ' + slot);
    return { ok: true, files: files };
  });
}

// ---------- ตั้งค่า / ประวัติ ----------
function qaSaveSettings(token, s) {
  var dept = requireQa_(token);
  s = s || {};
  return purLocked_(function () {
    var ss = qaBook_(dept), rows = purRead_(ss, 'qa_settings'), changed = [];
    Object.keys(QA_SETTINGS_DEFAULT_).forEach(function (k) {
      if (s[k] === undefined) return;
      var val = qaText_(s[k], 3000);
      if (/Days$/.test(k)) { var n = Math.round(Number(val)); if (!(n >= 0 && n <= 365)) return; val = String(n); }
      var r = rows.filter(function (x) { return x.id === k; })[0];
      if (r && String(r.value) === val) return;
      purWrite_(ss, 'qa_settings', r ? Object.assign(r, { value: val }) : { id: k, value: val });
      changed.push(k);
    });
    if (changed.length) purLogWrite_(ss, 'แก้ตั้งค่า', 'qa_settings', '', changed.join(', '));
    return { ok: true, settings: qaSettings_(ss) };
  });
}
function qaLog(token, limit) {
  var dept = requireQa_(token), ss = qaBook_(dept);
  return { ok: true, rows: purRead_(ss, 'log').reverse().slice(0, Math.min(500, Number(limit) || 200)) };
}

// ---------- Dashboard (หน้าภาพรวมของฝ่าย + Dashboard ผู้บริหาร) ----------
function qaDashboard(token, from, to) {
  var dept = requireQa_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var d = qaDashboard_(dept, from, to); d.ok = true; return d;
}
function qaDashboard_(dept, from, to) {
  var ss = qaBook_(dept), s = qaSettings_(ss), today = purToday_(), closeDays = Number(s.closeDays) || 15, replyDays = Number(s.replyDays) || 1;
  var all = purRead_(ss, 'qa_complaints').map(qaOut_);
  var inRange = all.filter(function (c) { return c.recvDate >= from && c.recvDate <= to; });
  var isClosed = function (c) { return String(c.status).indexOf('closed') === 0; };
  var openAll = all.filter(function (c) { return !isClosed(c) && c.status !== 'record'; });
  var overdue = openAll.filter(function (c) { return qaDays_(c.recvDate, today) > closeDays; });
  var closed = inRange.filter(isClosed);
  var closedOk = closed.filter(function (c) { return c.status === 'closed_ok'; });
  var firstRound = closedOk.filter(function (c) { return c.rounds.length === 1; }).length;
  var avg = function (arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length * 10) / 10 : null; };
  var closeTimes = closed.map(function (c) { return qaDays_(c.recvDate, c.closeDate); }).filter(function (n) { return n !== ''; });
  var replyTimes = inRange.filter(function (c) { return c.replyDate; }).map(function (c) { return qaDays_(c.recvDate, c.replyDate); });
  var count = function (key) {
    var m = {};
    inRange.forEach(function (c) { var k = c[key] || 'ไม่ระบุ'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { name: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n; });
  };
  // แนวโน้ม 6 เดือน (นับจากเดือนของวันที่สิ้นสุด)
  var trend = [], end = purToDate_(to);
  for (var i = 5; i >= 0; i--) {
    var d = new Date(end.getFullYear(), end.getMonth() - i, 1), ym = Utilities.formatDate(d, PUR_TZ_, 'yyyy-MM');
    var mon = all.filter(function (c) { return String(c.recvDate).slice(0, 7) === ym; });
    trend.push({ ym: ym, n: mon.length, closed: mon.filter(isClosed).length, critical: mon.filter(function (c) { return c.severity === 'C' || c.severity === 'H'; }).length });
  }
  return { kind: 'quality', from: from, to: to, today: today, targets: { closeDays: closeDays, replyDays: replyDays },
    kpi: { total: inRange.length, record: inRange.filter(function (c) { return c.status === 'record'; }).length, open: openAll.length, overdue: overdue.length, closed: closed.length, closedOk: closedOk.length,
      closedFail: closed.length - closedOk.length, firstRoundPct: closedOk.length ? Math.round(firstRound / closedOk.length * 100) : null,
      avgClose: avg(closeTimes), avgReply: avg(replyTimes), replyLate: replyTimes.filter(function (n) { return n > replyDays; }).length,
      severe: inRange.filter(function (c) { return c.severity === 'C' || c.severity === 'H'; }).length,
      cost: Math.round(inRange.reduce(function (a, c) { return a + (Number(c.remedyCost) || 0); }, 0)),
      validPct: (function () { var v = inRange.filter(function (c) { return c.valid === 'จริง (ปัญหาจากโรงงาน)'; }).length, k = inRange.filter(function (c) { return c.valid; }).length; return k ? Math.round(v / k * 100) : null; })() },
    byIssue: count('issueType'), byProduct: count('product').slice(0, 8), byChannel: count('channel'), byCause: count('causeCat'),
    bySeverity: ['C', 'H', 'M', 'L'].map(function (k) { return { key: k, name: QA_SEV_[k], n: inRange.filter(function (c) { return c.severity === k; }).length }; }),
    overdueList: overdue.sort(function (a, b) { return String(a.recvDate).localeCompare(String(b.recvDate)); }).slice(0, 10).map(function (c) {
      return { id: c.id, code: c.code, recvDate: c.recvDate, product: c.product, issueType: c.issueType, severity: c.severity, status: c.status, days: qaDays_(c.recvDate, today), rounds: c.rounds.length };
    }),
    trend: trend };
}

// ---------- งานตรวจวิเคราะห์ / ค่าใช้จ่าย ----------
function qaSaveTest(token, t) {
  var dept = requireQa_(token);
  t = t || {};
  var kind = t.kind === 'other' ? 'other' : 'test';
  var sample = purClean_(t.sample, 150), testType = purClean_(t.testType, 100), year = Math.round(Number(t.year));
  if (!sample) return { ok: false, error: kind === 'test' ? 'ระบุตัวอย่าง (ชื่อสินค้า)' : 'ระบุรายการค่าใช้จ่าย' };
  if (kind === 'test' && !testType) return { ok: false, error: 'เลือกรายการตรวจ' };
  if (!(year >= 2020 && year <= 2100)) return { ok: false, error: 'ปีไม่ถูกต้อง' };
  var price = purNum_(t.price);
  if (price !== '' && price < 0) return { ok: false, error: 'ราคาต้องไม่ติดลบ' };
  var status = QA_TEST_ST_[t.status] ? t.status : 'plan';
  var sent = purDate_(t.sentDate), res = purDate_(t.resultDate);
  if (sent && res && res < sent) return { ok: false, error: 'วันที่ได้ผลต้องไม่ก่อนวันที่ส่งตรวจ' };
  return purLocked_(function () {
    var ss = qaBook_(dept), old = t.id ? purRead_(ss, 'qa_tests').filter(function (x) { return x.id === t.id; })[0] : null;
    if (t.id && !old) return { ok: false, error: 'ไม่พบรายการนี้' };
    var now = purNow_(), o = old || { id: purId_('QT'), files: '[]', createdAt: now };
    o.year = year; o.kind = kind; o.sample = sample; o.testType = kind === 'test' ? testType : ''; o.price = price;
    o.lab = purClean_(t.lab, 120); o.status = status; o.sentDate = sent; o.resultDate = res;
    o.result = kind === 'test' ? purClean_(t.result, 40) : ''; o.note = qaText_(t.note, 1000); o.updatedAt = now;
    purWrite_(ss, 'qa_tests', o);
    purLogWrite_(ss, old ? 'แก้รายการตรวจวิเคราะห์' : 'เพิ่มรายการตรวจวิเคราะห์', 'qa_tests', o.id, o.year + ' · ' + o.sample + (o.testType ? ' · ' + o.testType : '') + ' · ' + QA_TEST_ST_[status] + (price !== '' ? ' · ' + price + ' บาท' : ''));
    var saved = purRead_(ss, 'qa_tests').filter(function (x) { return x.id === o.id; })[0];
    saved.files = purParseFiles_(saved.files);
    return { ok: true, test: saved };
  });
}
function qaDeleteTest(token, id) {
  var dept = requireQa_(token);
  return purLocked_(function () {
    var ss = qaBook_(dept), row = purRead_(ss, 'qa_tests').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    purParseFiles_(row.files).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    purSheet_(ss, 'qa_tests').deleteRow(row._row);
    purLogWrite_(ss, 'ลบรายการตรวจวิเคราะห์', 'qa_tests', id, row.year + ' · ' + row.sample + (row.testType ? ' · ' + row.testType : ''));
    return { ok: true };
  });
}
// ---------- ผลิตภัณฑ์ใหม่ ----------
function qaSaveNewProd(token, n) {
  var dept = requireQa_(token);
  n = n || {};
  var name = purClean_(n.name, 150), year = Math.round(Number(n.year));
  if (!name) return { ok: false, error: 'ระบุชื่อผลิตภัณฑ์' };
  if (!(year >= 2020 && year <= 2100)) return { ok: false, error: 'ปีไม่ถูกต้อง' };
  return purLocked_(function () {
    var ss = qaBook_(dept), list = purRead_(ss, 'qa_newprod'), old = n.id ? list.filter(function (x) { return x.id === n.id; })[0] : null;
    if (n.id && !old) return { ok: false, error: 'ไม่พบผลิตภัณฑ์นี้' };
    if (list.some(function (x) { return x.id !== n.id && Number(x.year) === year && String(x.name).trim() === name; })) return { ok: false, error: 'มีผลิตภัณฑ์ชื่อนี้ในปี ' + year + ' แล้ว' };
    var now = purNow_(), o = old || { id: purId_('NP'), createdAt: now };
    o.year = year; o.market = n.market === 'ต่างประเทศ' ? 'ต่างประเทศ' : 'ในประเทศ'; o.name = name;
    o.stage = QA_STAGES_.indexOf(n.stage) >= 0 ? n.stage : ''; o.fdaNo = purClean_(n.fdaNo, 40); o.note = qaText_(n.note, 1000); o.updatedAt = now;
    purWrite_(ss, 'qa_newprod', o);
    purLogWrite_(ss, old ? 'แก้ผลิตภัณฑ์ใหม่' : 'เพิ่มผลิตภัณฑ์ใหม่', 'qa_newprod', o.id, o.year + ' · ' + o.market + ' · ' + o.name + (o.stage ? ' · ' + o.stage : ''));
    return { ok: true, item: purRead_(ss, 'qa_newprod').filter(function (x) { return x.id === o.id; })[0] };
  });
}
function qaDeleteNewProd(token, id) {
  var dept = requireQa_(token);
  return purLocked_(function () {
    var ss = qaBook_(dept), row = purRead_(ss, 'qa_newprod').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบผลิตภัณฑ์นี้' };
    purSheet_(ss, 'qa_newprod').deleteRow(row._row);
    purLogWrite_(ss, 'ลบผลิตภัณฑ์ใหม่', 'qa_newprod', id, row.year + ' · ' + row.name);
    return { ok: true };
  });
}
