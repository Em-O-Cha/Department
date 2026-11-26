// ==================== ฝ่ายบัญชี — ค่าใช้จ่าย (จ่าย) ตามรอบจ่าย ====================
//
// ผู้ใช้ขอ 20/11/69: แยกเมนู รับ / จ่าย · ฝั่งจ่ายนำเข้าบิลจากภาพถ่าย / สแกน / PDF (หน้าเว็บอ่านภาพเองด้วย OCR แล้วให้ตรวจก่อนบันทึก)
// เลือกหมวด + % หัก ณ ที่จ่าย → ส่วนลด/มัดจำ/หัก ณ ที่จ่าย = มูลค่ารายการ × % · รายงานตามรอบจ่ายหน้าตาเหมือนไฟล์ "ค่าใช้จ่าย … จ่าย 10.01.27"
// (Excel ตามแบบฟอร์มสร้างในหน้าเว็บด้วย ExcelJS · PDF จากหน้ารายงาน)
// ข้อมูลอยู่ใน Google Sheet แยก "ค่าใช้จ่าย (จ่าย) ฝ่ายบัญชี" ที่ฝ่ายบัญชีสร้างเอง แชร์ให้บัญชีระบบเป็นผู้แก้ไข แล้ววางลิงก์ในหน้าเว็บ
//   แท็บ "รายการค่าใช้จ่าย" (1 แถว = 1 รายการในบิล) · "ผู้ขาย (จ่าย)"
// ไฟล์บิลต้นฉบับเก็บในโฟลเดอร์ฝ่าย → โฟลเดอร์ย่อย "บิลค่าใช้จ่าย (จ่าย)"
// ลิงก์ชีต (apSheet) และค่าตั้ง (apSettings: วันจ่าย, เลขผู้เสียภาษีของบริษัท) เก็บในแท็บตั้งค่าของชีตหลักฝ่ายบัญชี

var AP_TABLES_ = {
  ap_lines: { tab: 'รายการค่าใช้จ่าย', cols: [
    ['id', 'รหัส'], ['billId', 'รหัสบิล'], ['payRound', 'รอบจ่าย'], ['category', 'หมวด'], ['vendor', 'ผู้ขาย/ผู้จ่ายเงิน'], ['taxId', 'เลขผู้เสียภาษีผู้ขาย'],
    ['issueDate', 'วันที่ออก'], ['creditDays', 'เครดิต (วัน)'], ['dueDate', 'วันที่ครบกำหนด'], ['invNo', 'เลขที่ใบกำกับภาษี'], ['lineNo', 'ลำดับ'],
    ['desc', 'คำอธิบาย'], ['qty', 'จำนวน'], ['price', 'ราคา'], ['vatMode', 'ราคา / VAT'], ['pct', '%'], ['wht', 'หัก ณ ที่จ่าย'], ['disc', 'ส่วนลด/มัดจำ'],
    ['amount', 'มูลค่ารายการ'], ['vat', 'ภาษีมูลค่าเพิ่ม'], ['lineTotal', 'รวม'], ['note', 'หมายเหตุ'], ['files', 'ไฟล์บิล'],
    ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขเมื่อ'], ['kind', 'ประเภท'],
    ['recvQty', 'รับบิลแล้ว (จำนวน)'], ['poLog', 'ประวัติรับบิล (PO)'], ['poRef', 'หักจาก PO']] },
  ap_vendors: { tab: 'ผู้ขาย (จ่าย)', cols: [
    ['id', 'รหัส'], ['name', 'ชื่อผู้ขาย'], ['taxId', 'เลขผู้เสียภาษี'], ['category', 'หมวด'], ['bank', 'บัญชีธนาคาร (แถวรวม)'],
    ['creditDays', 'เครดิต (วัน)'], ['vatMode', 'ราคา / VAT'], ['pct', '% หัก ณ ที่จ่าย'], ['keywords', 'คำที่ใช้จับในบิล'], ['sort', 'ลำดับ'],
    ['note', 'หมายเหตุ'], ['updatedAt', 'แก้ไขเมื่อ']] }
};
// หมวดตามไฟล์ของผู้ใช้ (ลำดับ = เลขหมวด) · title = ข้อความหัวตารางในไฟล์
var AP_CATS_ = [
  { key: 'raw', name: 'ค่าใช้จ่ายวัตถุดิบ', title: '1). ค่าใช้จ่ายวัตถุดิบ', sheet: 'วัตถุดิบจ่าย' },
  { key: 'pack', name: 'ค่าใช้จ่ายบรรจุภัณฑ์', title: '2).ค่าใช้จ่ายบรรจุภัณฑ์', sheet: 'บรรจุภัณฑ์จ่าย' },
  { key: 'misc', name: 'ค่าใช้จ่ายจิปะถะ', title: '3).ค่าใช้จ่ายจิปะถะ', sheet: 'บรรจุภัณฑ์จ่าย' },
  { key: 'ship', name: 'ค่าขนส่ง', title: '4).ค่าขนส่ง ', sheet: 'บรรจุภัณฑ์จ่าย' },
  { key: 'svc', name: 'ค่าบริการอื่น ๆ', title: '5).ค่าบริการอื่น ๆ ', sheet: 'บรรจุภัณฑ์จ่าย' },
  { key: 'fac', name: 'ค่าใช้จ่าย โรงงานใหม่', title: '6).ค่าใช้จ่าย โรงงานใหม่ ', sheet: 'บรรจุภัณฑ์จ่าย' }
];
var AP_VAT_ = { inc: 'ราคารวม VAT แล้ว', exc: 'ราคายังไม่รวม VAT', none: 'ไม่มี VAT' };
var AP_FOLDER_ = 'บิลค่าใช้จ่าย (จ่าย)';
// PO ล่วงหน้า (ผู้ใช้ขอ 20/11/69): สั่งซื้อแล้วแต่ยังไม่ได้รับบิล — มีแค่ ชื่อสินค้า / จำนวน / ราคา · แสดงตัวแดงในรายงานเหมือนในไฟล์ · รับบิลแล้ว = บันทึกทับ billId เดิมเป็นบิลจริง
var AP_PO_ = 'PO ล่วงหน้า';
// รับบิลบางส่วน (ผู้ใช้ขอ 23/11/69): บิลที่มาไม่ครบหักจำนวน / ยอดเงินออกจาก PO · PO เก็บไว้จนรับครบ แล้วเปลี่ยนเป็น "ครบแล้ว" (ไม่นับในรายงาน)
//   แถว PO: qty = จำนวนคงเหลือ · price ปรับให้ qty × price = มูลค่าคงเหลือ · recvQty = รับบิลแล้ว
//   poLog (แถวแรก) = JSON [{at, billId, invNo, date, total, pay, lines: [{n, desc, q, amt (ก่อน VAT), a (รวม VAT), pq / pp (จำนวน / ราคาก่อนหัก), rq}]}]
//   แถวบิลที่หักจาก PO: poRef = billId ของ PO (ลบบิล → คืนจำนวนให้ PO)
var AP_PO_DONE_ = 'PO ล่วงหน้า (รับครบแล้ว)';

function apRegister_() {
  accRegister_();
  Object.keys(AP_TABLES_).forEach(function (k) { PUR_TABLES_[k] = AP_TABLES_[k]; });
  ['payRound', 'issueDate', 'dueDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['creditDays', 'lineNo', 'qty', 'price', 'pct', 'wht', 'disc', 'amount', 'vat', 'lineTotal', 'sort', 'recvQty'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function apR2_(n) { return Math.round(Number(n || 0) * 100) / 100; }
function apTxt_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function apSettingRow_(ss, id) { return purRead_(ss, 'acc_settings').filter(function (x) { return x.id === id; })[0]; }
function apSettings_(main) {
  var row = apSettingRow_(main, 'apSettings'), s = {};
  try { s = row ? JSON.parse(row.value || '{}') : {}; } catch (e) { s = {}; }
  var pd = Math.round(Number(s.payDay) || 10), cd = Math.round(Number(s.cutDay) || 19);
  // cutDay = วันตัดรอบบิล (ผู้ใช้ขอ 20/11/69: ตัดรอบทุกวันที่ 19) → รอบจ่าย = วันจ่ายรอบแรกที่ไม่ก่อน (วันตัดรอบของบิล + เครดิตของผู้ขาย) — คิดในหน้าเว็บ (payables.js roundFor)
  return { payDay: pd >= 1 && pd <= 28 ? pd : 10, cutDay: cd >= 1 && cd <= 28 ? cd : 19, ourTaxId: String(s.ourTaxId || '').replace(/\D/g, '').slice(0, 13) };
}
function apSheetId_(main) { var r = apSettingRow_(main, 'apSheet'); return r ? String(r.value || '') : ''; }
function apBook_(main) {
  if (main && main.__db) { var vid = apSheetId_(main); return vid ? dbSubBook_(main, 'ap', vid, apHeadV2_) : null; }
  var id = apSheetId_(main);
  if (!id) return null;
  var ss = SpreadsheetApp.openById(id);
  try { if (ss.getSpreadsheetTimeZone() !== PUR_TZ_) ss.setSpreadsheetTimeZone(PUR_TZ_); } catch (e) {}
  apHeadV2_(ss);
  return ss;
}
// 23/11/69 (ผู้ใช้ขอแยก ส่วนลด/มัดจำ กับ หัก ณ ที่จ่าย): หัวคอลัมน์เดิม "ส่วนลด/มัดจำ/หัก ณที่จ่าย" (เก็บหัก ณ ที่จ่าย) → เปลี่ยนชื่อเป็น "หัก ณ ที่จ่าย" ครั้งเดียว
function apHeadV2_(ss) {
  var key = 'AP_HEAD_V2_' + ss.getId(), cache = CacheService.getScriptCache();
  if (cache.get(key)) return;
  try {
    var sh = ss.getSheetByName(AP_TABLES_.ap_lines.tab);
    if (sh && sh.getLastColumn()) {
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), i = head.indexOf('ส่วนลด/มัดจำ/หัก ณที่จ่าย');
      if (i >= 0 && head.indexOf('หัก ณ ที่จ่าย') < 0) sh.getRange(1, i + 1).setValue('หัก ณ ที่จ่าย');
    }
    cache.put(key, '1', 21600);
  } catch (e) {}
}
function apFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายบัญชี');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName(AP_FOLDER_);
  return it.hasNext() ? it.next() : parent.createFolder(AP_FOLDER_);
}
// วันจ่ายจริง: วันจ่ายตามรอบ (เช่นวันที่ 10) ตรงเสาร์-อาทิตย์ / วันหยุดราชการ → เลื่อนเป็นวันทำการถัดไป (วันหยุดชุดเดียวกับ 7-11)
function apShift_(iso, hol) {
  var d = iso;
  for (var i = 0; i < 15; i++) {
    var p = d.split('-'), wd = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    if (wd !== 0 && wd !== 6 && !(hol && hol[d])) break;
    d = accAddDays_(d, 1);
  }
  return d;
}
// รอบจ่ายตั้งแต่ 14 เดือนก่อน ถึง 18 เดือนข้างหน้า (+ รอบที่มีข้อมูล)
function apRounds_(st, hol, extra) {
  var t = purToday_().split('-'), y = +t[0], m = +t[1] - 14, set = {};
  for (var i = 0; i < 33; i++) {
    var mm = m + i, yy = y + Math.floor((mm - 1) / 12); mm = ((mm - 1) % 12 + 12) % 12 + 1;
    set[yy + '-' + ('0' + mm).slice(-2) + '-' + ('0' + st.payDay).slice(-2)] = 1;
  }
  (extra || []).forEach(function (d) { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set[d] = 1; });
  return Object.keys(set).sort().map(function (d) { var a = apShift_(d, hol); return { nominal: d, actual: a, why: a !== d ? accDueWhy_(d, hol) : '' }; });
}

function apLoad(token) {
  var dept = requireAcc_(token); apRegister_();
  accRegister_();
  var main = accReadBook_(dept), st = apSettings_(main), ss = null, err = '';
  try { ss = apBook_(main); } catch (e) { err = 'เปิดชีตค่าใช้จ่ายไม่ได้ — ตรวจว่าแชร์ให้บัญชีระบบเป็นผู้แก้ไขแล้ว'; }
  var hol = accHolidaySet_(accMap_(main));
  var all = ss ? purRead_(ss, 'ap_lines').map(apOut_) : [];
  var lines = all.filter(function (l) { return l.kind !== 'podone'; }), poDone = all.filter(function (l) { return l.kind === 'podone'; });
  var vendors = ss ? purRead_(ss, 'ap_vendors').map(function (v) { v.taxId = apTxt_(v.taxId); delete v._row; return v; }) : [];
  var used = {}; lines.forEach(function (l) { if (l.payRound) used[l.payRound] = 1; });
  return { ok: true, linked: !!ss, error: err, sheetUrl: ss ? ss.getUrl() : '', sheetName: ss ? ss.getName() : '', settings: st,
    cats: AP_CATS_, vatModes: AP_VAT_, lines: lines, poDone: poDone, vendors: vendors, rounds: apRounds_(st, hol, Object.keys(used)), today: purToday_(), ai: typeof apAiInfo_ === 'function' ? apAiInfo_() : null };
}
// Dashboard การจ่าย (ผู้ใช้ขอ 21/11/69): ข้อมูลเบา ๆ ของทุกบรรทัดบิล + รอบจ่าย — ใช้ในหน้าผู้บริหาร (หน้าฝ่ายใช้ apLoad)
function apDashData_(dept) {
  apRegister_();
  accRegister_();
  var main = accReadBook_(dept), st = apSettings_(main), ss = apBook_(main);
  if (!ss) return { linked: false };
  var hol = accHolidaySet_(accMap_(main)), used = {};
  var lines = purRead_(ss, 'ap_lines').filter(function (l) { return String(l.kind || '') !== AP_PO_DONE_; }).map(function (l) {
    if (l.payRound) used[l.payRound] = 1;
    return { payRound: l.payRound, category: l.category, vendor: l.vendor, billId: l.billId, kind: String(l.kind || '') === AP_PO_ ? 'po' : '',
      amount: Number(l.amount) || 0, vat: Number(l.vat) || 0, lineTotal: Number(l.lineTotal) || 0, wht: Number(l.wht) || 0 };
  });
  return { linked: true, settings: { payDay: st.payDay }, cats: AP_CATS_, lines: lines, rounds: apRounds_(st, hol, Object.keys(used)), today: purToday_() };
}
function apOut_(l) {
  var k = String(l.kind || '');
  l.invNo = apTxt_(l.invNo); l.taxId = apTxt_(l.taxId); l.kind = k === AP_PO_ ? 'po' : k === AP_PO_DONE_ ? 'podone' : '';
  l.recvQty = Number(l.recvQty) || 0; l.poRef = String(l.poRef || '');
  try { l.poLog = l.poLog ? JSON.parse(l.poLog) : []; } catch (e) { l.poLog = []; }
  delete l._row; return l;
}

function apSetSheet(token, url) {
  var dept = requireAcc_(token); apRegister_();
  var m = String(url || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || String(url || '').match(/^([a-zA-Z0-9_-]{25,})$/);
  if (!m) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง — คัดลอกลิงก์จากแถบที่อยู่ของ Google Sheet' };
  var ss;
  try { ss = SpreadsheetApp.openById(m[1]); } catch (e) { return { ok: false, error: 'เปิดไฟล์ไม่ได้ — แชร์ไฟล์ให้บัญชีระบบเป็น "ผู้แก้ไข" ก่อน' }; }
  try { purSheet_(ss, 'ap_lines'); purSheet_(ss, 'ap_vendors'); } catch (e) { return { ok: false, error: 'ไฟล์นี้แก้ไขไม่ได้ — ต้องแชร์ให้บัญชีระบบเป็น "ผู้แก้ไข"' }; }
  var first = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) { try { ss.deleteSheet(first); } catch (e) {} }
  return purLocked_(function () {
    var main = purBook_(dept), row = apSettingRow_(main, 'apSheet') || { id: 'apSheet' };
    row.value = ss.getId();
    purWrite_(main, 'acc_settings', row);
    purLogWrite_(main, 'เชื่อมชีตค่าใช้จ่าย (จ่าย)', 'acc_settings', 'apSheet', ss.getName());
    return { ok: true, sheetName: ss.getName(), sheetUrl: ss.getUrl() };
  });
}
function apSaveSettings(token, s) {
  var dept = requireAcc_(token); apRegister_();
  var pd = Math.round(Number(s && s.payDay));
  if (!(pd >= 1 && pd <= 28)) return { ok: false, error: 'วันจ่ายต้องเป็นวันที่ 1–28' };
  var cd = Math.round(Number(s && s.cutDay) || 19);
  if (!(cd >= 1 && cd <= 28)) return { ok: false, error: 'วันตัดรอบบิลต้องเป็นวันที่ 1–28' };
  var tax = String(s && s.ourTaxId || '').replace(/\D/g, '');
  if (tax && tax.length !== 13) return { ok: false, error: 'เลขผู้เสียภาษีต้องมี 13 หลัก' };
  return purLocked_(function () {
    var main = purBook_(dept), row = apSettingRow_(main, 'apSettings') || { id: 'apSettings' };
    row.value = JSON.stringify({ payDay: pd, cutDay: cd, ourTaxId: tax });
    purWrite_(main, 'acc_settings', row);
    return { ok: true };
  });
}

// ---------- บิล ----------
// ครบเครดิต (ผู้ใช้ 23/11/69): เครดิตนับเป็นเดือน 30 วัน = 1 เดือน (45 = 1 เดือน + 15 วัน) — เหมือน creditDue ใน payables.js
function apCreditDue_(iso, credit) {
  var c = Math.max(0, Math.round(Number(credit) || 0)), p = String(iso).split('-'), y = +p[0], m = +p[1] - 1 + Math.floor(c / 30), d = +p[2];
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  d = Math.min(d, new Date(y, m + 1, 0).getDate());
  return accAddDays_(y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2), c % 30);
}
function apCat_(k) { return AP_CATS_.some(function (c) { return c.key === k; }) ? k : ''; }
function apCleanBill_(b) {
  b = b || {};
  var x = {
    billId: accClean_(b.billId, 40), payRound: accDate_(b.payRound), category: apCat_(b.category), vendor: accClean_(b.vendor, 120),
    taxId: String(b.taxId || '').replace(/\D/g, '').slice(0, 13), issueDate: accDate_(b.issueDate), creditDays: Math.max(0, Math.min(365, Math.round(Number(purNum_(b.creditDays)) || 0))),
    invNo: accClean_(b.invNo, 40), vatMode: AP_VAT_[b.vatMode] ? b.vatMode : 'exc', pct: Math.max(0, Math.min(100, Number(purNum_(b.pct)) || 0)),
    note: accClean_(b.note, 300), bank: accClean_(b.bank, 150), kind: b.kind === 'po' ? 'po' : '', poRef: b.kind === 'po' ? '' : accClean_(b.poRef, 40)
  };
  if (x.kind === 'po') { x.invNo = ''; x.issueDate = ''; x.creditDays = 0; }
  x.dueDate = accDate_(b.dueDate) || (x.issueDate ? apCreditDue_(x.issueDate, x.creditDays) : '');
  x.lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 80).map(function (l) {
    var qty = Number(purNum_(l.qty)), price = Number(purNum_(l.price)), disc = Number(purNum_(l.disc));
    return { desc: accClean_(l.desc, 200), qty: isFinite(qty) ? qty : 0, price: isFinite(price) ? price : 0, disc: isFinite(disc) ? apR2_(disc) : 0, po: Math.max(0, Math.round(Number(l.po) || 0)) };
  }).filter(function (l) { return l.desc || l.qty || l.price; });
  return x;
}
// คำนวณเหมือนสูตรในไฟล์: ราคารวม VAT → มูลค่า = จำนวน × ราคา × 100/107 · ไม่รวม VAT → จำนวน × ราคา · VAT = ROUND(มูลค่า × 7%, 2)
// ส่วนลด/หัก ณ ที่จ่าย = มูลค่า × % · รวม = มูลค่า + VAT
// ผู้ใช้ขอ 23/11/69: ส่วนลด/มัดจำ (disc บาท) หักก่อนคิด VAT · หัก ณ ที่จ่าย = มูลค่ารายการ × % เหมือนเดิม · รวม = มูลค่า − ส่วนลด + VAT
function apCalc_(l, vatMode, pct) {
  var amount = apR2_(vatMode === 'inc' ? l.qty * l.price * 100 / 107 : l.qty * l.price), disc = apR2_(Number(l.disc) || 0);
  var vat = vatMode === 'none' ? 0 : apR2_((amount - disc) * 0.07);
  return { amount: amount, disc: disc, vat: vat, lineTotal: apR2_(amount - disc + vat), wht: apR2_(amount * (Number(pct) || 0) / 100) };
}
function apSaveBill(token, bill, files) {
  var dept = requireAcc_(token); apRegister_();
  var x = apCleanBill_(bill);
  if (!x.category) return { ok: false, error: 'เลือกหมวดของบิล' };
  if (!x.vendor) return { ok: false, error: 'ใส่ชื่อผู้ขาย' };
  if (!x.payRound) return { ok: false, error: 'เลือกรอบจ่าย' };
  if (!x.lines.length) return { ok: false, error: 'ไม่มีรายการในบิล' };
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  // ไฟล์บิล (ภาพ / PDF) — อัปโหลดก่อนล็อก
  var saved = [];
  (Array.isArray(files) ? files : []).slice(0, 6).forEach(function (f, i) {
    if (!f || typeof f.b64 !== 'string' || f.b64.length > 14000000 || !/^[A-Za-z0-9+\/=]+$/.test(f.b64)) return;
    var mime = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime) ? f.mime : 'image/jpeg';
    try {
      var name = (x.vendor + ' ' + (x.invNo || x.issueDate || '') + (files.length > 1 ? ' (' + (i + 1) + ')' : '')).replace(/[\\\/:*?"<>|]/g, '-') + (mime === 'application/pdf' ? '.pdf' : mime === 'image/png' ? '.png' : '.jpg');
      var file = apFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(f.b64), mime, name));
      exShare_(file);
      saved.push(file.getUrl());
    } catch (e) { /* ไม่มีโฟลเดอร์ / สิทธิ์ — ข้อมูลยังบันทึกได้ */ }
  });
  return purLocked_(function () {
    var now = purNow_(), all = purRead_(ss, 'ap_lines');
    var mine = x.billId ? all.filter(function (l) { return l.billId === x.billId; }) : [];
    var dup = x.kind === 'po' ? null : all.filter(function (l) { return l.billId !== x.billId && x.invNo && apTxt_(l.invNo) === x.invNo && accNorm_(l.vendor) === accNorm_(x.vendor); })[0];
    if (dup && !(bill && bill.allowDup)) return { ok: false, dup: true, error: 'บิลเลขที่ ' + x.invNo + ' ของ ' + x.vendor + ' บันทึกไว้แล้ว (รอบจ่าย ' + dup.payRound + ')' };
    var billId = mine.length ? x.billId : purId_('AP');
    var keepFiles = (bill && Array.isArray(bill.keepFiles) ? bill.keepFiles : String(mine[0] && mine[0].files || '').split(/\s+/)).filter(function (u) { return /^https:\/\/drive\.google\.com\//.test(u); });
    var createdAt = mine[0] && mine[0].createdAt || now;
    // แก้ PO ที่รับบิลไปบางส่วนแล้ว: เก็บประวัติ + จำนวนที่รับแล้ว (จับคู่ชื่อสินค้า แล้วค่อยลำดับ) · แก้บิลที่หักจาก PO: เก็บ poRef
    var first = mine.slice().sort(function (a, b) { return a.lineNo - b.lineNo; })[0] || {};
    var poLog = x.kind === 'po' ? String(first.poLog || '') : '', poRef = x.kind === 'po' ? '' : (x.poRef || String(first.poRef || ''));
    var recvOf = function (l, i) {
      if (x.kind !== 'po') return '';
      var m = mine.filter(function (o) { return accNorm_(o.desc) === accNorm_(l.desc); })[0] || mine.filter(function (o) { return Number(o.lineNo) === i + 1; })[0];
      return m && Number(m.recvQty) ? Number(m.recvQty) : '';
    };
    var sh = purSheet_(ss, 'ap_lines');
    mine.map(function (l) { return l._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var filesTxt = keepFiles.concat(saved).join(' ');
    var values = x.lines.map(function (l, i) {
      var c = apCalc_(l, x.vatMode, x.pct);
      return purRowValues_(sh, 'ap_lines', {
        id: purId_('APL'), billId: billId, payRound: x.payRound, category: x.category, vendor: x.vendor, taxId: x.taxId ? "'" + x.taxId : '',
        issueDate: x.issueDate, creditDays: x.creditDays, dueDate: x.dueDate, invNo: x.invNo ? "'" + x.invNo : '', lineNo: i + 1,
        desc: l.desc, qty: l.qty, price: l.price, vatMode: x.vatMode, pct: x.pct, wht: c.wht, disc: c.disc || '', amount: c.amount, vat: c.vat, lineTotal: c.lineTotal,
        note: i ? '' : x.note, files: filesTxt, createdAt: createdAt, updatedAt: mine.length ? now : '', kind: x.kind === 'po' ? AP_PO_ : '',
        recvQty: recvOf(l, i), poLog: i ? '' : poLog, poRef: poRef
      }, head);
    });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    // จำข้อมูลผู้ขายไว้ใช้ครั้งต่อไป (หมวด / เครดิต / VAT / % / เลขผู้เสียภาษี / บัญชีธนาคาร)
    var vs = purRead_(ss, 'ap_vendors'), v = vs.filter(function (o) { return accNorm_(o.name) === accNorm_(x.vendor); })[0]
      || (x.taxId ? vs.filter(function (o) { return apTxt_(o.taxId) === x.taxId; })[0] : null);
    if (!v) v = { id: purId_('APV'), name: x.vendor, sort: vs.length + 1, keywords: '', note: '' };
    v.category = x.category; v.vatMode = x.vatMode; v.pct = x.pct;
    if (x.kind !== 'po') v.creditDays = x.creditDays;
    if (x.taxId) v.taxId = "'" + x.taxId; else if (v.taxId) v.taxId = "'" + apTxt_(v.taxId);
    if (x.bank) v.bank = x.bank;
    v.updatedAt = now;
    purWrite_(ss, 'ap_vendors', v);
    purLogWrite_(main, (mine.length ? 'แก้' : 'บันทึก') + (x.kind === 'po' ? 'PO ล่วงหน้า' : (mine.length && String(mine[0].kind) === AP_PO_ ? 'บิลจาก PO ล่วงหน้า' : 'บิลค่าใช้จ่าย')), 'ap_lines', billId, x.vendor + ' ' + x.invNo + ' รอบ ' + x.payRound);
    return { ok: true, billId: billId, files: filesTxt, uploaded: saved.length, lines: x.lines.map(function (l) { var c = apCalc_(l, x.vatMode, x.pct); return { po: l.po, desc: l.desc, qty: l.qty, amount: apR2_(c.amount - c.disc), total: c.lineTotal, wht: c.wht }; }) };
  });
}

// ---------- รับบิลจาก PO ล่วงหน้า (ครบ หรือบางส่วน) — ผู้ใช้ขอ 23/11/69 ----------
// บิลจริงบันทึกเป็นบิลใหม่ (poRef = PO) · แต่ละรายการในบิลบอกว่าหักจาก PO บรรทัดไหน (po = ลำดับ, 0 = ไม่หัก)
// PO: จำนวนคงเหลือ = เดิม − จำนวนในบิล · ยอดเงินคำนวณใหม่จากจำนวนคงเหลือ · บันทึกประวัติ (ยอดเงินรวมของบิลที่หัก) · คงเหลือ 0 ทุกบรรทัด = รับครบ
function apReceivePo(token, poId, bill, files) {
  var dept = requireAcc_(token); apRegister_();
  poId = String(poId || '');
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  if (!purRead_(ss, 'ap_lines').some(function (l) { return l.billId === poId && String(l.kind) === AP_PO_; })) return { ok: false, error: 'ไม่พบ PO นี้ (อาจรับครบหรือถูกลบไปแล้ว) — โหลดหน้าใหม่' };
  var b = Object.assign({}, bill || {}, { kind: '', billId: '', poRef: poId });
  var r = apSaveBill(token, b, files);
  if (!r.ok) return r;
  var res = apDeductPo_(main, ss, poId, r.billId, apCleanBill_(b), r.lines);
  r.po = res;
  return r;
}
function apDeductPo_(main, ss, poId, billId, x, lines) {
  return purLocked_(function () {
    var rows = purRead_(ss, 'ap_lines').filter(function (l) { return l.billId === poId && String(l.kind) === AP_PO_; }).sort(function (a, b) { return a.lineNo - b.lineNo; });
    if (!rows.length) return { done: false, missing: true };
    // รวมตามบรรทัด PO (ผู้ใช้ขอ 23/11/69): จำนวน = ผลรวมจำนวนที่ไม่ซ้ำกัน (จำนวนเท่ากัน เช่น กระป๋อง + ฝา = ชุดเดียว นับครั้งเดียว)
    // มูลค่า (ก่อน VAT) = ผลรวมทุกบรรทัด → หักออกจากมูลค่า PO · เกิน PO หรือจำนวนครบ = บรรทัดนั้นหมด
    var by = {}, total = 0, pay = 0;
    (lines || []).forEach(function (l) {
      if (!l.po) return;
      var d = by[l.po] = by[l.po] || { q: 0, qs: {}, amt: 0, a: 0 };
      var qk = String(Math.round((Number(l.qty) || 0) * 10000));
      if (!d.qs[qk]) { d.qs[qk] = 1; d.q += Number(l.qty) || 0; }
      d.amt += Number(l.amount) || 0; d.a += Number(l.total) || 0;
      total += Number(l.total) || 0; pay += (Number(l.total) || 0) - (Number(l.wht) || 0);
    });
    var now = purNow_(), logLines = [];
    rows.forEach(function (row) {
      var d = by[row.lineNo]; if (!d) return;
      var pq = Number(row.qty) || 0, pp = Number(row.price) || 0, pd = Number(row.disc) || 0, pc = apCalc_({ qty: pq, price: pp, disc: pd }, row.vatMode, Number(row.pct) || 0), pa = apR2_(pc.amount - pc.disc);   // มูลค่าสุทธิหลังส่วนลด
      var rq = Math.max(0, Math.round((pq - d.q) * 10000) / 10000), ra = Math.max(0, apR2_(pa - d.amt));
      if (rq <= 0 || ra <= 0.005) { rq = 0; ra = 0; }
      var price = rq ? Math.round((String(row.vatMode) === 'inc' ? ra * 1.07 : ra) / rq * 1e6) / 1e6 : pp;   // ราคาต่อหน่วยใหม่ให้ จำนวนคงเหลือ × ราคา = มูลค่าคงเหลือ
      row.recvQty = Math.round(((Number(row.recvQty) || 0) + Math.min(pq, d.q)) * 10000) / 10000;
      row.qty = rq; row.price = price; row.disc = '';   // ส่วนลดเดิมรวมอยู่ในราคาใหม่แล้ว
      var c = apCalc_({ qty: rq, price: price }, row.vatMode, Number(row.pct) || 0);
      row.amount = c.amount; row.vat = c.vat; row.lineTotal = c.lineTotal; row.wht = c.wht; row.updatedAt = now;
      logLines.push({ n: row.lineNo, desc: row.desc, q: d.q, amt: apR2_(d.amt), a: apR2_(d.a), pq: pq, pp: pp, pd: pd, rq: Math.min(pq, d.q) });
    });
    var log = []; try { log = rows[0].poLog ? JSON.parse(rows[0].poLog) : []; } catch (e) { log = []; }
    log.push({ at: now, billId: billId, invNo: x.invNo, date: x.issueDate, round: x.payRound, total: apR2_(total), pay: apR2_(pay), lines: logLines });
    rows[0].poLog = log;
    var done = rows.every(function (row) { return !(Number(row.qty) > 0); });
    if (done) rows.forEach(function (row) { row.kind = AP_PO_DONE_; });
    rows.forEach(function (row) {
      row.taxId = apTxt_(row.taxId); row.invNo = apTxt_(row.invNo);
      if (!row.updatedAt) row.updatedAt = now;
      purWrite_(ss, 'ap_lines', row);
    });
    purLogWrite_(main, done ? 'รับบิลจาก PO ล่วงหน้า (ครบ)' : 'รับบิลจาก PO ล่วงหน้า (บางส่วน)', 'ap_lines', poId, x.vendor + ' บิล ' + x.invNo + ' หัก ' + apR2_(total) + ' บาท');
    return { done: done, left: rows.map(function (row) { return { n: row.lineNo, desc: row.desc, qty: row.qty }; }) };
  });
}
// ลบบิลที่หักจาก PO → คืนจำนวนให้ PO (ลบประวัติรายการนั้น · ถ้า PO รับครบแล้วกลับเป็นรอบิล)
function apRestorePo_(ss, poId, billId) {
  var rows = purRead_(ss, 'ap_lines').filter(function (l) { return l.billId === poId && (String(l.kind) === AP_PO_ || String(l.kind) === AP_PO_DONE_); }).sort(function (a, b) { return a.lineNo - b.lineNo; });
  if (!rows.length) return false;
  var log = []; try { log = rows[0].poLog ? JSON.parse(rows[0].poLog) : []; } catch (e) { log = []; }
  var ent = log.filter(function (e) { return e.billId === billId; })[0];
  if (!ent) return false;
  var now = purNow_();
  (ent.lines || []).forEach(function (el) {
    var row = rows.filter(function (r) { return Number(r.lineNo) === Number(el.n); })[0]; if (!row) return;
    var back = el.rq != null ? Number(el.rq) : Number(el.q) || 0;
    if (el.pq != null) { row.qty = Number(el.pq) || 0; row.price = Number(el.pp) || 0; row.disc = Number(el.pd) || ''; }   // คืนจำนวน + ราคาก่อนหักบิลนี้
    else row.qty = Math.round(((Number(row.qty) || 0) + (Number(el.q) || 0)) * 10000) / 10000;
    row.recvQty = Math.max(0, Math.round(((Number(row.recvQty) || 0) - back) * 10000) / 10000) || '';
    var c = apCalc_({ qty: row.qty, price: Number(row.price) || 0, disc: row.disc }, row.vatMode, Number(row.pct) || 0);
    row.amount = c.amount; row.vat = c.vat; row.lineTotal = c.lineTotal; row.wht = c.wht;
  });
  rows[0].poLog = log.filter(function (e) { return e !== ent; });
  rows.forEach(function (row) { row.kind = AP_PO_; row.updatedAt = now; row.taxId = apTxt_(row.taxId); row.invNo = apTxt_(row.invNo); purWrite_(ss, 'ap_lines', row); });
  return true;
}
// ปิด PO เอง (ผู้ขายไม่ส่งส่วนที่เหลือแล้ว) → ย้ายไป "รับครบแล้ว" ไม่นับในรายงาน · ยังเปิดดูประวัติได้
function apClosePo(token, poId) {
  var dept = requireAcc_(token); apRegister_();
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  return purLocked_(function () {
    var rows = purRead_(ss, 'ap_lines').filter(function (l) { return l.billId === String(poId || '') && String(l.kind) === AP_PO_; });
    if (!rows.length) return { ok: false, error: 'ไม่พบ PO นี้' };
    var now = purNow_();
    rows.forEach(function (row) { row.kind = AP_PO_DONE_; row.updatedAt = now; row.taxId = apTxt_(row.taxId); row.invNo = apTxt_(row.invNo); purWrite_(ss, 'ap_lines', row); });
    purLogWrite_(main, 'ปิด PO ล่วงหน้า (ไม่รอส่วนที่เหลือ)', 'ap_lines', poId, rows[0].vendor);
    return { ok: true };
  });
}
function apDeleteBill(token, billId) {
  var dept = requireAcc_(token); apRegister_();
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  return purLocked_(function () {
    var rows = purRead_(ss, 'ap_lines').filter(function (l) { return l.billId === String(billId || ''); });
    if (!rows.length) return { ok: false, error: 'ไม่พบบิลนี้' };
    var sh = purSheet_(ss, 'ap_lines'), ref = String(rows[0].poRef || '');
    rows.map(function (l) { return l._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
    var restored = ref && String(rows[0].kind) !== AP_PO_ && String(rows[0].kind) !== AP_PO_DONE_ ? apRestorePo_(ss, ref, String(billId)) : false;
    purLogWrite_(main, 'ลบบิลค่าใช้จ่าย' + (restored ? ' (คืนจำนวนให้ PO ' + ref + ')' : ''), 'ap_lines', billId, rows[0].vendor + ' ' + apTxt_(rows[0].invNo));
    return { ok: true, restored: restored };
  });
}
// ย้ายบิลไปรอบจ่ายอื่น
function apMoveBill(token, billId, payRound) {
  var dept = requireAcc_(token); apRegister_();
  var r = accDate_(payRound);
  if (!r) return { ok: false, error: 'เลือกรอบจ่าย' };
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  return purLocked_(function () {
    var rows = purRead_(ss, 'ap_lines').filter(function (l) { return l.billId === String(billId || ''); });
    if (!rows.length) return { ok: false, error: 'ไม่พบบิลนี้' };
    var sh = purSheet_(ss, 'ap_lines'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), c = head.indexOf('รอบจ่าย') + 1;
    rows.forEach(function (l) { sh.getRange(l._row, c).setValue(r); });
    return { ok: true };
  });
}

// นำเข้าบิลหลายใบจากไฟล์ Excel ค่าใช้จ่ายเดิม (ผู้ใช้ขอ 20/11/69 · หน้าเว็บอ่านไฟล์เอง: แผ่น "...จ่าย DD.MM.YY" = รอบจ่าย, แถวตัวแดง = PO ล่วงหน้า)
// ข้ามบิลที่มีอยู่แล้ว (ผู้ขาย + เลขที่ใบกำกับ) · เขียนทีเดียวด้วย setValues
function apImportBills(token, bills) {
  var dept = requireAcc_(token); apRegister_();
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  var list = (Array.isArray(bills) ? bills : []).slice(0, 500).map(apCleanBill_).filter(function (x) { return x.category && x.vendor && x.payRound && x.lines.length; });
  if (!list.length) return { ok: false, error: 'ไม่พบบิลที่นำเข้าได้' };
  return purLocked_(function () {
    var now = purNow_(), all = purRead_(ss, 'ap_lines'), seen = {}, add = [], skipped = 0, nBills = 0;
    all.forEach(function (l) { if (apTxt_(l.invNo)) seen[accNorm_(l.vendor) + '|' + apTxt_(l.invNo)] = 1; });
    var sh = purSheet_(ss, 'ap_lines'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    list.forEach(function (x) {
      var k = accNorm_(x.vendor) + '|' + x.invNo;
      if (x.invNo && x.kind !== 'po' && seen[k]) { skipped++; return; }
      if (x.invNo) seen[k] = 1;
      var billId = purId_('AP'); nBills++;
      x.lines.forEach(function (l, i) {
        var c = apCalc_(l, x.vatMode, x.pct);
        add.push(purRowValues_(sh, 'ap_lines', { id: purId_('APL'), billId: billId, payRound: x.payRound, category: x.category, vendor: x.vendor, taxId: x.taxId ? "'" + x.taxId : '',
          issueDate: x.issueDate, creditDays: x.creditDays, dueDate: x.dueDate, invNo: x.invNo ? "'" + x.invNo : '', lineNo: i + 1, desc: l.desc, qty: l.qty, price: l.price,
          vatMode: x.vatMode, pct: x.pct, wht: c.wht, disc: c.disc || '', amount: c.amount, vat: c.vat, lineTotal: c.lineTotal, note: i ? '' : x.note, files: '', createdAt: now, updatedAt: '',
          kind: x.kind === 'po' ? AP_PO_ : '' }, head));
      });
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    purLogWrite_(main, 'นำเข้าบิลจาก Excel', 'ap_lines', '', 'บิล ' + nBills + ' · รายการ ' + add.length + ' · ข้าม ' + skipped);
    return { ok: true, bills: nBills, lines: add.length, skipped: skipped };
  });
}

// ---------- ผู้ขาย ----------
function apCleanVendor_(v) {
  v = v || {};
  return { id: accClean_(v.id, 40), name: accClean_(v.name, 120), taxId: String(v.taxId || '').replace(/\D/g, '').slice(0, 13), category: apCat_(v.category) || 'raw',
    bank: accClean_(v.bank, 150), creditDays: v.creditDays === '' || v.creditDays == null ? '' : Math.max(0, Math.min(365, Math.round(Number(purNum_(v.creditDays)) || 0))), vatMode: AP_VAT_[v.vatMode] ? v.vatMode : 'exc',
    pct: Math.max(0, Math.min(100, Number(purNum_(v.pct)) || 0)), keywords: accClean_(v.keywords, 200), note: accClean_(v.note, 200), sort: Number(v.sort) || '' };
}
function apSaveVendor(token, v) {
  var dept = requireAcc_(token); apRegister_();
  var x = apCleanVendor_(v);
  if (!x.name) return { ok: false, error: 'ใส่ชื่อผู้ขาย' };
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  return purLocked_(function () {
    var vs = purRead_(ss, 'ap_vendors'), old = x.id ? vs.filter(function (o) { return o.id === x.id; })[0] : null;
    if (vs.some(function (o) { return o.id !== x.id && accNorm_(o.name) === accNorm_(x.name); })) return { ok: false, error: 'มีผู้ขายชื่อนี้แล้ว' };
    var rec = Object.assign(old || { id: purId_('APV'), sort: vs.length + 1 }, x, { id: old ? old.id : purId_('APV'), sort: x.sort || (old && old.sort) || vs.length + 1, taxId: x.taxId ? "'" + x.taxId : '', updatedAt: purNow_() });
    purWrite_(ss, 'ap_vendors', rec);
    return { ok: true, id: rec.id };
  });
}
function apDeleteVendor(token, id) {
  var dept = requireAcc_(token); apRegister_();
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  return purLocked_(function () {
    var v = purRead_(ss, 'ap_vendors').filter(function (o) { return o.id === String(id || ''); })[0];
    if (!v) return { ok: false, error: 'ไม่พบผู้ขาย' };
    purSheet_(ss, 'ap_vendors').deleteRow(v._row);
    return { ok: true };
  });
}
// นำเข้าผู้ขายจากไฟล์ Excel แบบฟอร์มเดิม (หน้าเว็บอ่านไฟล์เอง) — เพิ่มเฉพาะชื่อที่ยังไม่มี · ที่มีแล้วเติมเฉพาะช่องที่ว่าง
function apImportVendors(token, list, opts) {   // opts.credit = ตั้งเครดิตตามไฟล์ทับของเดิม (ไฟล์เครดิต Supplier 20/11/69)
  var dept = requireAcc_(token); apRegister_();
  var main = purBook_(dept), ss = apBook_(main);
  if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อม Google Sheet ค่าใช้จ่าย' };
  var items = (Array.isArray(list) ? list : []).slice(0, 400).map(apCleanVendor_).filter(function (v) { return v.name; });
  return purLocked_(function () {
    var vs = purRead_(ss, 'ap_vendors'), sh = purSheet_(ss, 'ap_vendors'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var add = [], filled = 0, now = purNow_();
    items.forEach(function (x) {
      var old = vs.filter(function (o) { return accNorm_(o.name) === accNorm_(x.name); })[0];
      if (old) {
        var ch = false;
        ['bank', 'creditDays', 'pct', 'taxId'].forEach(function (k) { if ((old[k] === '' || old[k] == null) && x[k]) { old[k] = k === 'taxId' ? "'" + x[k] : x[k]; ch = true; } });
        if (opts && opts.credit && x.creditDays !== '' && Number(old.creditDays) !== Number(x.creditDays)) { old.creditDays = x.creditDays; ch = true; }
        // ไฟล์ Supplier มีเลขผู้เสียภาษี (ผู้ใช้ขอ 20/11/69) → ใช้ตามไฟล์ (13 หลัก) ทับของเดิม
        if (opts && opts.credit && x.taxId.length === 13 && apTxt_(old.taxId) !== x.taxId) { old.taxId = x.taxId; ch = true; }
        if (ch) { old.updatedAt = now; if (old.taxId) old.taxId = "'" + apTxt_(old.taxId); purWrite_(ss, 'ap_vendors', old); filled++; }
        return;
      }
      var rec = Object.assign({}, x, { id: purId_('APV'), sort: vs.length + add.length + 1, taxId: x.taxId ? "'" + x.taxId : '', updatedAt: now });
      vs.push(Object.assign({}, rec));
      add.push(purRowValues_(sh, 'ap_vendors', rec, head));
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    purLogWrite_(main, 'นำเข้าผู้ขาย (จ่าย)', 'ap_vendors', '', 'เพิ่ม ' + add.length + ' · เติมข้อมูล ' + filled);
    return { ok: true, added: add.length, filled: filled };
  });
}

// ---------- รายการเงินเข้า (ท้ายรายงาน เหมือนในไฟล์) ----------
// รอบจ่ายเดือนไหน → แสดงเงินเข้าของเดือนนั้น: CP ALL (7-11) และ CP Ram รอบส่งสินค้าวันที่ 1–15 (เงินเข้าราววันที่ 10) และ 16–สิ้นเดือน (ราววันที่ 25)
// ยอดรวม VAT · คิดจากวันส่งสินค้าตามกติกาเดียวกับ Dashboard (accDueDate_ เลื่อนตามวันหยุด)
function apIncome(token, payRound) {
  var dept = requireAcc_(token); apRegister_();
  var ym = String(accDate_(payRound) || '').slice(0, 7);
  if (!ym) return { ok: false, error: 'เลือกรอบจ่าย' };
  accRegister_();
  var main = accReadBook_(dept), map = accMap_(main), hol = accHolidaySet_(map);
  var mk = function () { return [{ half: 1, date: '', amount: 0, count: 0 }, { half: 2, date: '', amount: 0, count: 0 }]; };
  var add = function (arr, deliveryIso, amt) {
    var due = accDueDate_(deliveryIso, hol);
    if (!due || accDueBase_(deliveryIso).slice(0, 7) !== ym) return;
    var x = arr[+String(deliveryIso).slice(8, 10) <= 15 ? 0 : 1];
    x.date = due; x.amount += amt; x.count++;
  };
  var cpall = mk(), cpram = mk();
  purRead_(main, 'acc_711').forEach(function (l) { add(cpall, l.deliveryDate, (Number(l.amount) || 0) * (1 + (Number(l.vatRate) || 0) / 100)); });
  try {
    cpRegister_(); CP_HOL_ = hol;
    var cs = cpBook_(main);
    if (cs) purRead_(cs, 'cp_lines').forEach(function (l) { if (l.status !== 'cancel') add(cpram, l.deliveryDate, Number(l.net) || (Number(l.amount) || 0) * 1.07); });
  } catch (e) {}
  [cpall, cpram].forEach(function (arr) {
    arr.forEach(function (x, i) {
      x.amount = apR2_(x.amount);
      if (!x.date) { x.date = apShift_(ym + (i ? '-25' : '-10'), hol); }
    });
  });
  return { ok: true, ym: ym, cpall: cpall, cpram: cpram };
}
