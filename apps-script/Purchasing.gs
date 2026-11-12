// ==================== แผนกจัดซื้อ & สต๊อกสินค้า (PUR) ====================
//
// ข้อมูลเก็บใน Google Sheet ของแผนก (ตั้งลิงก์ในหน้าผู้ดูแลระบบ) — แต่ละแท็บมีหัวคอลัมน์ภาษาไทยแถวแรก
// ระบบอ่าน/เขียนตามชื่อหัวคอลัมน์ (ย้ายลำดับคอลัมน์ในชีตได้ แต่ห้ามเปลี่ยนชื่อหัวคอลัมน์)
//   ผู้ขาย · วัตถุดิบ · ประวัติราคา · ใบPRPO · รายการPRPO · รับเข้าจ่ายออก · ประวัติแก้ไข
// ไฟล์แนบ (PR/PO ที่อนุมัติ, ภาพอนุมัติทาง LINE, COA, ใบส่งของ) เก็บในโฟลเดอร์ Drive ของแผนก
// ยอดคงเหลือ = ผลรวมรับเข้า - จ่ายออก (คำนวณจากแท็บรับเข้าจ่ายออก ไม่เก็บแยก) · แยกตาม LOT ได้
// ทุกฟังก์ชันต้องมีตั๋วของแผนก PUR (requirePur_) · แก้ไขทุกครั้งบันทึกในแท็บประวัติแก้ไข

var PUR_TABLES_ = {
  vendors: { tab: 'ผู้ขาย', cols: [
    ['id', 'รหัส'], ['name', 'ชื่อผู้ขาย'], ['contact', 'ผู้ติดต่อ'], ['phone', 'เบอร์โทร'], ['phone2', 'เบอร์โทร 2'],
    ['line', 'LINE'], ['email', 'อีเมล'], ['address', 'ที่อยู่'], ['taxId', 'เลขผู้เสียภาษี'], ['creditDays', 'เครดิต (วัน)'],
    ['bank', 'ธนาคาร'], ['bankAccount', 'เลขบัญชี'], ['items', 'สินค้าที่ขาย'], ['note', 'หมายเหตุ'], ['active', 'ใช้งาน'],
    ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด'],
    ['contractStart', 'สัญญาเริ่ม'], ['contractEnd', 'สัญญาสิ้นสุด'], ['contractNote', 'รายละเอียดสัญญา'], ['files', 'ไฟล์แนบ']] },
  materials: { tab: 'วัตถุดิบ', cols: [
    ['id', 'รหัส'], ['name', 'ชื่อวัตถุดิบ'], ['unit', 'หน่วย'], ['category', 'หมวด'], ['vendorId', 'รหัสผู้ขาย'],
    ['minStock', 'จุดสั่งซื้อขั้นต่ำ'], ['price', 'ราคาปัจจุบัน'], ['priceDate', 'ราคา ณ วันที่'], ['note', 'หมายเหตุ'],
    ['active', 'ใช้งาน'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prices: { tab: 'ประวัติราคา', cols: [
    ['id', 'รหัส'], ['materialId', 'รหัสวัตถุดิบ'], ['price', 'ราคาต่อหน่วย'], ['effectiveDate', 'มีผลวันที่'],
    ['vendorId', 'รหัสผู้ขาย'], ['note', 'หมายเหตุ'], ['createdAt', 'บันทึกเมื่อ']] },
  docs: { tab: 'ใบPRPO', cols: [
    ['id', 'รหัส'], ['type', 'ประเภท'], ['docNo', 'เลขที่'], ['refId', 'อ้างอิง PR'], ['vendorId', 'รหัสผู้ขาย'],
    ['vendorName', 'ชื่อผู้ขาย'], ['vendorPhone', 'เบอร์ผู้ขาย'], ['orderDate', 'วันที่สั่ง'], ['deliveryDate', 'วันที่ส่งของ'],
    ['status', 'สถานะ'], ['total', 'ยอดรวม'], ['approvedBy', 'ผู้อนุมัติ'], ['approvedDate', 'วันที่อนุมัติ'],
    ['paymentStatus', 'สถานะชำระเงิน'], ['dueDate', 'ครบกำหนดชำระ'], ['paidDate', 'วันที่ชำระ'], ['paidAmount', 'ยอดที่ชำระ'],
    ['note', 'หมายเหตุ'], ['files', 'ไฟล์แนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด'],
    ['matchNote', 'เหตุผลชำระแม้ตรวจ3ทางไม่ตรง'], ['rfqId', 'รหัสใบเปรียบเทียบราคา']] },
  docItems: { tab: 'รายการPRPO', cols: [
    ['id', 'รหัส'], ['docId', 'รหัสใบ'], ['line', 'ลำดับ'], ['materialId', 'รหัสวัตถุดิบ'], ['materialName', 'วัตถุดิบ'],
    ['qty', 'จำนวน'], ['unit', 'หน่วย'], ['price', 'ราคาต่อหน่วย'], ['amount', 'จำนวนเงิน']] },
  moves: { tab: 'รับเข้าจ่ายออก', cols: [
    ['id', 'รหัส'], ['date', 'วันที่'], ['type', 'ประเภท'], ['materialId', 'รหัสวัตถุดิบ'], ['qty', 'จำนวน'],
    ['lot', 'LOT'], ['expDate', 'วันหมดอายุ'], ['mfgDate', 'วันที่ผลิต'], ['requester', 'ผู้เบิก'], ['issuer', 'ผู้จ่าย/ผู้รับ'], ['docId', 'รหัสใบ PO'],
    ['qc', 'ผลตรวจรับ'], ['qcNote', 'หมายเหตุตรวจรับ'], ['files', 'ไฟล์แนบ'], ['note', 'หมายเหตุ'], ['source', 'ที่มา'],
    ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  // ใบแจ้งหนี้ผู้ขาย (สำหรับตรวจ 3 ทาง: PO ↔ รับของ ↔ ใบแจ้งหนี้) · items = JSON [{materialId, materialName, qty, unit, price, amount}]
  invoices: { tab: 'ใบแจ้งหนี้', cols: [
    ['id', 'รหัส'], ['docId', 'รหัสใบ PO'], ['invoiceNo', 'เลขที่ใบแจ้งหนี้'], ['invoiceDate', 'วันที่ใบแจ้งหนี้'], ['vendorName', 'ชื่อผู้ขาย'],
    ['amount', 'ยอดเงิน'], ['items', 'รายการ'], ['note', 'หมายเหตุ'], ['files', 'ไฟล์แนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  // เปรียบเทียบราคา: 1 เรื่อง (rfqs) มีหลายใบเสนอราคา (quotes) · items = JSON
  rfqs: { tab: 'เปรียบเทียบราคา', cols: [
    ['id', 'รหัส'], ['title', 'เรื่อง'], ['prId', 'อ้างอิง PR'], ['items', 'รายการ'], ['status', 'สถานะ'], ['winnerId', 'ใบที่เลือก'],
    ['reason', 'เหตุผลที่เลือก'], ['decidedAt', 'วันที่ตัดสิน'], ['poId', 'รหัสใบ PO'], ['note', 'หมายเหตุ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  quotes: { tab: 'ใบเสนอราคา', cols: [
    ['id', 'รหัส'], ['rfqId', 'รหัสเรื่อง'], ['vendorId', 'รหัสผู้ขาย'], ['vendorName', 'ชื่อผู้ขาย'], ['quoteNo', 'เลขที่ใบเสนอราคา'], ['quoteDate', 'วันที่เสนอ'],
    ['validUntil', 'ยืนราคาถึง'], ['leadDays', 'ส่งของภายใน (วัน)'], ['paymentTerms', 'เงื่อนไขชำระเงิน'], ['creditDays', 'เครดิต (วัน)'],
    ['items', 'ราคารายการ'], ['total', 'ยอดรวม'], ['spec', 'สเปก / คุณภาพ'], ['note', 'หมายเหตุ'], ['files', 'ไฟล์แนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  // ประเมินผู้ขาย รายไตรมาส (1-5)
  evals: { tab: 'ประเมินผู้ขาย', cols: [
    ['id', 'รหัส'], ['vendorId', 'รหัสผู้ขาย'], ['period', 'รอบประเมิน'], ['quality', 'คุณภาพ'], ['delivery', 'ส่งตรงเวลา'], ['price', 'ราคา'],
    ['service', 'บริการ'], ['score', 'คะแนนเฉลี่ย'], ['comment', 'ความเห็น'], ['evaluator', 'ผู้ประเมิน'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  log: { tab: 'ประวัติแก้ไข', cols: [['time', 'เวลา'], ['action', 'การทำงาน'], ['table', 'ข้อมูล'], ['id', 'รหัส'], ['detail', 'รายละเอียด']] }
};
var PUR_DATE_KEYS_ = { contractStart: 1, contractEnd: 1, invoiceDate: 1, quoteDate: 1, validUntil: 1, decidedAt: 1, mfgDate: 1, priceDate: 1, effectiveDate: 1, orderDate: 1, deliveryDate: 1, approvedDate: 1, dueDate: 1, paidDate: 1, date: 1, expDate: 1 };
var PUR_NUM_KEYS_ = { leadDays: 1, quality: 1, delivery: 1, service: 1, score: 1, creditDays: 1, minStock: 1, price: 1, total: 1, paidAmount: 1, line: 1, qty: 1, amount: 1 };
var PUR_MOVE_IN_ = { IN: 1 };                 // รับเข้า
var PUR_MOVE_OUT_ = { OUT: 1, RETURN: 1 };   // จ่ายออก / ส่งคืนผู้ขาย · ADJ = ปรับยอด (+/-)
var PUR_TZ_ = 'Asia/Bangkok';

// ---------- พื้นฐาน ----------
function requirePur_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'purchasing') throw new Error('แผนกนี้ไม่มีระบบจัดซื้อ');
  return dept;
}
// ชีตต้องใช้เวลาไทย ไม่งั้นวันที่ในชีตแสดงเลื่อนไป 1 วัน (ระบบเก็บวันที่เป็นเที่ยงคืนเวลาไทย)
function purBook_(dept) {
  var ss = openDeptSpreadsheet_(dept);
  try { if (ss.getSpreadsheetTimeZone() !== PUR_TZ_) ss.setSpreadsheetTimeZone(PUR_TZ_); } catch (e) {}
  return ss;
}
function purSheet_(ss, name) {
  var t = PUR_TABLES_[name];
  var sh = ss.getSheetByName(t.tab);
  if (!sh) {
    sh = ss.insertSheet(t.tab);
    sh.getRange(1, 1, 1, t.cols.length).setValues([t.cols.map(function (c) { return c[1]; })]).setFontWeight('bold').setBackground('#f1f5f9');
    sh.setFrozenRows(1);
  } else {
    // เพิ่มหัวคอลัมน์ที่ขาด (ต่อท้าย) — ไม่แตะคอลัมน์เดิม
    var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    var missing = t.cols.filter(function (c) { return head.indexOf(c[1]) === -1; });
    if (missing.length) sh.getRange(1, head.filter(String).length + 1, 1, missing.length).setValues([missing.map(function (c) { return c[1]; })]).setFontWeight('bold').setBackground('#f1f5f9');
  }
  return sh;
}
function purFmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, PUR_TZ_, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}
function purToDate_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}
function purToday_() { return Utilities.formatDate(new Date(), PUR_TZ_, 'yyyy-MM-dd'); }
function purNow_() { return Utilities.formatDate(new Date(), PUR_TZ_, 'yyyy-MM-dd HH:mm:ss'); }
function purId_(prefix) { return prefix + Date.now().toString(36).toUpperCase() + Utilities.getUuid().slice(0, 4).toUpperCase(); }

// อ่านทั้งแท็บ → [{key: value}] (+ _row = เลขแถวในชีต)
function purRead_(ss, name) {
  var sh = purSheet_(ss, name), t = PUR_TABLES_[name];
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2) return [];
  var vals = sh.getRange(1, 1, last, width).getValues();
  var head = vals[0].map(String), idx = {};
  t.cols.forEach(function (c) { idx[c[0]] = head.indexOf(c[1]); });
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    if (idx.id >= 0 && !row[idx.id] && name !== 'log') continue;
    var o = { _row: r + 1 };
    t.cols.forEach(function (c) {
      var v = idx[c[0]] >= 0 ? row[idx[c[0]]] : '';
      if (PUR_DATE_KEYS_[c[0]]) v = purFmtDate_(v);
      else if (PUR_NUM_KEYS_[c[0]]) v = v === '' || v === null ? '' : Number(v);
      else if (v instanceof Date) v = Utilities.formatDate(v, PUR_TZ_, /At$|^time$/.test(c[0]) ? 'yyyy-MM-dd HH:mm:ss' : 'dd/MM/yyyy');
      else v = v === null ? '' : v;
      o[c[0]] = v;
    });
    out.push(o);
  }
  return out;
}
function purRowValues_(sh, name, obj, head) {
  var t = PUR_TABLES_[name];
  head = head || sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var row = head.map(function () { return ''; });
  t.cols.forEach(function (c) {
    var i = head.indexOf(c[1]);
    if (i < 0) return;
    var v = obj[c[0]];
    if (v === undefined || v === null) v = '';
    if (PUR_DATE_KEYS_[c[0]]) v = purToDate_(v);
    else if (PUR_NUM_KEYS_[c[0]]) v = v === '' ? '' : Number(v);
    else if (typeof v === 'object') v = JSON.stringify(v);
    // ข้อความที่ชีตจะแปลงเอง (เบอร์โทร 08x, LOT 27/03/2026, สูตร =...) → บังคับเป็นข้อความ
    if (typeof v === 'string' && (/^[=+\-@]/.test(v) || /^[\d\s\/.:,\-]+$/.test(v))) v = "'" + v;
    row[i] = v;
  });
  return row;
}
// เพิ่ม/แก้แถว (มี _row = แก้แถวนั้น) — ต้องถือ lock อยู่แล้ว
function purWrite_(ss, name, obj) {
  var sh = purSheet_(ss, name), row = purRowValues_(sh, name, obj);
  if (obj._row) sh.getRange(obj._row, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}
function purLogWrite_(ss, action, table, id, detail) {
  try { purWrite_(ss, 'log', { time: purNow_(), action: action, table: PUR_TABLES_[table] ? PUR_TABLES_[table].tab : table, id: id, detail: String(detail || '').slice(0, 2000) }); } catch (e) {}
}
function purLocked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function purClean_(v, max) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, max || 300); }
function purNum_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : ''; }
function purDate_(v) { var s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function purDiff_(before, after, keys) {
  return keys.filter(function (k) { return String(before[k] == null ? '' : before[k]) !== String(after[k] == null ? '' : after[k]); })
    .map(function (k) { return k + ': ' + (before[k] === '' || before[k] == null ? '-' : before[k]) + ' → ' + (after[k] === '' || after[k] == null ? '-' : after[k]); }).join(' | ');
}

// ---------- คำนวณยอดคงเหลือ / LOT ----------
function purSigned_(m) {
  var q = Number(m.qty) || 0;
  if (PUR_MOVE_IN_[m.type]) return q;
  if (PUR_MOVE_OUT_[m.type]) return -q;
  return q;   // ADJ: บวก/ลบตามจำนวน
}
// LOT คงเหลือแบบ FIFO: จ่ายออกตัด LOT ที่ระบุก่อน ถ้า LOT นั้นไม่พอ/ไม่มี ตัด LOT เก่าสุดต่อ
function purBalances_(moves) {
  var bal = {}, lots = {}, last = {};
  moves.slice().sort(function (a, c) { return a.date === c.date ? (a._row || 0) - (c._row || 0) : (a.date < c.date ? -1 : 1); }).forEach(function (m) {
    var s = purSigned_(m), id = m.materialId;
    bal[id] = Math.round(((bal[id] || 0) + s) * 1000) / 1000;
    if (!last[id] || m.date > last[id]) last[id] = m.date;
    var L = (lots[id] = lots[id] || []);
    if (s > 0) {
      var lk = m.lot || '-', l = L.filter(function (x) { return x.lot === lk; })[0];
      if (!l) { l = { lot: lk, qty: 0, expDate: '', mfgDate: '', inDate: m.date }; L.push(l); }
      l.qty = Math.round((l.qty + s) * 1000) / 1000;
      if (m.expDate) l.expDate = m.expDate;
      if (m.mfgDate) l.mfgDate = m.mfgDate;
      return;
    }
    var need = -s;
    var take = function (l) { var q = Math.min(l.qty, need); l.qty = Math.round((l.qty - q) * 1000) / 1000; need = Math.round((need - q) * 1000) / 1000; };
    L.filter(function (x) { return x.lot === m.lot && x.qty > 0; }).forEach(take);
    for (var i = 0; i < L.length && need > 0; i++) if (L[i].qty > 0) take(L[i]);
  });
  Object.keys(lots).forEach(function (k) { lots[k] = lots[k].filter(function (l) { return l.qty > 0.0001; }); });
  return { bal: bal, lots: lots, last: last };
}

// ==================== API ====================

// โหลดข้อมูลหลัก (ไม่รวมประวัติรับเข้าจ่ายออกทั้งหมด — ใช้ purMoves)
function purLoad(token) {
  var dept = requirePur_(token), ss = purBook_(dept);
  var vendors = purRead_(ss, 'vendors'), materials = purRead_(ss, 'materials'), docs = purRead_(ss, 'docs'), items = purRead_(ss, 'docItems');
  var moves = purRead_(ss, 'moves'), b = purBalances_(moves);
  var itemsByDoc = {};
  items.forEach(function (it) { (itemsByDoc[it.docId] = itemsByDoc[it.docId] || []).push(it); });
  docs.forEach(function (d) { d.items = (itemsByDoc[d.id] || []).sort(function (a, c) { return a.line - c.line; }); d.files = purParseFiles_(d.files); });
  materials.forEach(function (m) {
    m.balance = b.bal[m.id] || 0;
    m.lastMove = b.last[m.id] || '';
    m.lots = b.lots[m.id] || [];
  });
  var invoices = purRead_(ss, 'invoices'), rfqs = purRead_(ss, 'rfqs'), quotes = purRead_(ss, 'quotes'), evals = purRead_(ss, 'evals');
  invoices.forEach(function (x) { x.items = purJson_(x.items); x.files = purParseFiles_(x.files); });
  rfqs.forEach(function (x) { x.items = purJson_(x.items); });
  quotes.forEach(function (x) { x.items = purJson_(x.items); x.files = purParseFiles_(x.files); });
  vendors.forEach(function (v) { v.files = purParseFiles_(v.files); });
  docs.forEach(function (d) { if (d.type === 'PO') d.match = purMatch_(d, d.items, moves, invoices); });
  var cfg = deptConfig_(dept.key);
  return { ok: true, vendors: vendors, materials: materials, docs: docs, invoices: invoices, rfqs: rfqs, quotes: quotes, evals: evals,
    moveCount: moves.length, today: purToday_(),
    sheetUrl: 'https://docs.google.com/spreadsheets/d/' + cfg.sheetId + '/edit', hasFolder: !!cfg.folderId };
}

// ประวัติรับเข้าจ่ายออก ตามช่วงวันที่ (และวัตถุดิบ ถ้าระบุ)
function purMoves(token, from, to, materialId) {
  var dept = requirePur_(token), ss = purBook_(dept);
  from = purDate_(from) || '0000-00-00'; to = purDate_(to) || '9999-99-99';
  var list = purRead_(ss, 'moves').filter(function (m) { return m.date >= from && m.date <= to && (!materialId || m.materialId === materialId); });
  list.forEach(function (m) { m.files = purParseFiles_(m.files); });
  list.sort(function (a, c) { return a.date === c.date ? a._row - c._row : a.date.localeCompare(c.date); });
  return { ok: true, moves: list.slice(-3000), total: list.length };
}

// รายงานช่วงวันที่: ยอดยกมา/รับเข้า/จ่ายออก/คงเหลือ ต่อวัตถุดิบ + มูลค่า (ราคา ณ วันที่) + ใบ PO + การชำระเงิน
function purReport(token, from, to) {
  var dept = requirePur_(token), ss = purBook_(dept);
  from = purDate_(from); to = purDate_(to);
  if (!from || !to || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var materials = purRead_(ss, 'materials'), moves = purRead_(ss, 'moves'), prices = purRead_(ss, 'prices'), docs = purRead_(ss, 'docs');
  var priceList = {};
  prices.forEach(function (p) { (priceList[p.materialId] = priceList[p.materialId] || []).push(p); });
  Object.keys(priceList).forEach(function (k) { priceList[k].sort(function (a, c) { return a.effectiveDate.localeCompare(c.effectiveDate); }); });
  var priceAt = function (mid, date) {
    var list = priceList[mid] || [], p = '';
    for (var i = 0; i < list.length; i++) { if (list[i].effectiveDate <= date) p = list[i].price; else break; }
    return p === '' && list.length ? list[0].price : p;
  };
  var rows = {}, detail = [];
  materials.forEach(function (m) { rows[m.id] = { id: m.id, name: m.name, unit: m.unit, open: 0, inQty: 0, outQty: 0, close: 0, inValue: 0, outValue: 0 }; });
  moves.forEach(function (m) {
    var r = rows[m.materialId]; if (!r) return;
    var s = purSigned_(m);
    if (m.date < from) { r.open += s; return; }
    if (m.date > to) return;
    var price = priceAt(m.materialId, m.date), value = price === '' ? '' : Math.round(Math.abs(s) * price * 100) / 100;
    if (s >= 0) { r.inQty += s; if (value !== '') r.inValue += value; } else { r.outQty += -s; if (value !== '') r.outValue += value; }
    detail.push({ date: m.date, type: m.type, materialId: m.materialId, name: r.name, unit: r.unit, qty: m.qty, lot: m.lot, requester: m.requester, issuer: m.issuer, note: m.note, price: price, value: value });
  });
  var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.close = Math.round((r.open + r.inQty - r.outQty) * 1000) / 1000; r.open = Math.round(r.open * 1000) / 1000; return r; })
    .filter(function (r) { return r.open || r.inQty || r.outQty || r.close; })
    .sort(function (a, c) { return a.name.localeCompare(c.name, 'th'); });
  detail.sort(function (a, c) { return a.date.localeCompare(c.date); });
  var pos = docs.filter(function (d) { return d.type === 'PO' && d.status !== 'cancelled' && d.orderDate >= from && d.orderDate <= to; })
    .map(function (d) { return { docNo: d.docNo, vendorName: d.vendorName, orderDate: d.orderDate, deliveryDate: d.deliveryDate, status: d.status, total: d.total, paymentStatus: d.paymentStatus, dueDate: d.dueDate, paidAmount: d.paidAmount }; });
  return { ok: true, from: from, to: to, summary: list, detail: detail.slice(0, 10000), pos: pos };
}

// ---------- ผู้ขาย ----------
function purSaveVendor(token, v) {
  var dept = requirePur_(token);
  v = v || {};
  var name = purClean_(v.name, 200);
  if (!name) return { ok: false, error: 'กรอกชื่อผู้ขาย' };
  return purLocked_(function () {
    var ss = purBook_(dept), list = purRead_(ss, 'vendors');
    var old = v.id ? list.filter(function (x) { return x.id === v.id; })[0] : null;
    if (v.id && !old) return { ok: false, error: 'ไม่พบผู้ขายนี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('V'), createdAt: purNow_(), active: 'ใช้งาน' };
    ['contact', 'phone', 'phone2', 'line', 'email', 'taxId', 'bank', 'bankAccount'].forEach(function (k) { o[k] = purClean_(v[k], 150); });
    ['address', 'items', 'note'].forEach(function (k) { o[k] = purClean_(v[k], 1000); });
    o.contractStart = purDate_(v.contractStart); o.contractEnd = purDate_(v.contractEnd); o.contractNote = purClean_(v.contractNote, 1000);
    if (typeof o.files !== 'string') o.files = JSON.stringify(o.files || []);
    o.name = name; o.creditDays = purNum_(v.creditDays); o.active = v.active === false || v.active === 'ปิด' ? 'ปิด' : 'ใช้งาน'; o.updatedAt = purNow_();
    purWrite_(ss, 'vendors', o);
    purLogWrite_(ss, old ? 'แก้ไข' : 'เพิ่ม', 'vendors', o.id, old ? purDiff_(old, o, ['name', 'contact', 'phone', 'phone2', 'line', 'email', 'address', 'taxId', 'creditDays', 'bank', 'bankAccount', 'items', 'note', 'active', 'contractStart', 'contractEnd', 'contractNote']) : name);
    delete o._row; o.files = purParseFiles_(o.files);
    return { ok: true, vendor: o };
  });
}

// ---------- วัตถุดิบ ----------
function purSaveMaterial(token, m) {
  var dept = requirePur_(token);
  m = m || {};
  var name = purClean_(m.name, 200);
  if (!name) return { ok: false, error: 'กรอกชื่อวัตถุดิบ' };
  return purLocked_(function () {
    var ss = purBook_(dept), list = purRead_(ss, 'materials');
    var old = m.id ? list.filter(function (x) { return x.id === m.id; })[0] : null;
    if (m.id && !old) return { ok: false, error: 'ไม่พบวัตถุดิบนี้' };
    if (list.some(function (x) { return x.name === name && (!old || x.id !== old.id); })) return { ok: false, error: 'มีวัตถุดิบชื่อนี้แล้ว' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('M'), createdAt: purNow_(), price: '', priceDate: '' };
    o.name = name; o.unit = purClean_(m.unit, 30); o.category = purClean_(m.category, 100); o.vendorId = purClean_(m.vendorId, 40);
    o.minStock = purNum_(m.minStock); o.note = purClean_(m.note, 1000); o.active = m.active === false || m.active === 'ปิด' ? 'ปิด' : 'ใช้งาน'; o.updatedAt = purNow_();
    purWrite_(ss, 'materials', o);
    purLogWrite_(ss, old ? 'แก้ไข' : 'เพิ่ม', 'materials', o.id, old ? purDiff_(old, o, ['name', 'unit', 'category', 'vendorId', 'minStock', 'note', 'active']) : name);
    delete o._row;
    return { ok: true, material: o };
  });
}

// ---------- ราคา (เพิ่ม/แก้รายการในประวัติ) — ราคาปัจจุบันของวัตถุดิบ = รายการล่าสุดตามวันที่มีผล ----------
function purRecalcPrice_(ss, materialId) {
  var list = purRead_(ss, 'prices').filter(function (p) { return p.materialId === materialId; })
    .sort(function (a, c) { return a.effectiveDate === c.effectiveDate ? String(a.createdAt).localeCompare(String(c.createdAt)) : a.effectiveDate.localeCompare(c.effectiveDate); });
  var mats = purRead_(ss, 'materials'), m = mats.filter(function (x) { return x.id === materialId; })[0];
  if (!m) return;
  var lastP = list[list.length - 1];
  m.price = lastP ? lastP.price : ''; m.priceDate = lastP ? lastP.effectiveDate : ''; m.updatedAt = purNow_();
  purWrite_(ss, 'materials', m);
}
function purSavePrice(token, p) {
  var dept = requirePur_(token);
  p = p || {};
  var price = purNum_(p.price), date = purDate_(p.effectiveDate) || purToday_();
  if (price === '' || price < 0) return { ok: false, error: 'กรอกราคาให้ถูกต้อง' };
  return purLocked_(function () {
    var ss = purBook_(dept);
    if (!purRead_(ss, 'materials').some(function (x) { return x.id === p.materialId; })) return { ok: false, error: 'ไม่พบวัตถุดิบ' };
    var list = purRead_(ss, 'prices');
    var old = p.id ? list.filter(function (x) { return x.id === p.id; })[0] : null;
    if (p.id && !old) return { ok: false, error: 'ไม่พบรายการราคานี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('P'), createdAt: purNow_() };
    o.materialId = p.materialId; o.price = price; o.effectiveDate = date; o.vendorId = purClean_(p.vendorId, 40); o.note = purClean_(p.note, 500);
    purWrite_(ss, 'prices', o);
    purRecalcPrice_(ss, p.materialId);
    purLogWrite_(ss, old ? 'แก้ไขราคา' : 'ปรับราคา', 'prices', o.id, old ? purDiff_(old, o, ['price', 'effectiveDate', 'vendorId', 'note']) : p.materialId + ' ราคา ' + price + ' มีผล ' + date);
    return { ok: true };
  });
}
function purDeletePrice(token, priceId) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), sh = purSheet_(ss, 'prices'), old = purRead_(ss, 'prices').filter(function (x) { return x.id === priceId; })[0];
    if (!old) return { ok: false, error: 'ไม่พบรายการราคานี้' };
    sh.deleteRow(old._row);
    purRecalcPrice_(ss, old.materialId);
    purLogWrite_(ss, 'ลบราคา', 'prices', priceId, old.materialId + ' ราคา ' + old.price + ' มีผล ' + old.effectiveDate);
    return { ok: true };
  });
}

// ---------- ใบ PR / PO (หลายรายการต่อใบ) ----------
var PUR_DOC_STATUS_ = { draft: 'ร่าง', approved: 'อนุมัติแล้ว', ordered: 'สั่งแล้ว', received: 'รับของครบ', partial: 'รับบางส่วน', cancelled: 'ยกเลิก' };
var PUR_PAY_STATUS_ = { unpaid: 'ยังไม่ชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระแล้ว', none: '-' };
function purNextDocNo_(docs, type, date) {
  var ym = String(date || purToday_()).slice(2, 4) + String(date || purToday_()).slice(5, 7);
  var pre = type + '-' + ym + '-', max = 0;
  docs.forEach(function (d) { if (String(d.docNo).indexOf(pre) === 0) max = Math.max(max, Number(String(d.docNo).slice(pre.length)) || 0); });
  return pre + ('00' + (max + 1)).slice(-3);
}
function purSaveDoc(token, d, items) {
  var dept = requirePur_(token);
  d = d || {}; items = Array.isArray(items) ? items : [];
  var type = d.type === 'PR' ? 'PR' : d.type === 'PO' ? 'PO' : '';
  if (!type) return { ok: false, error: 'เลือกประเภท PR หรือ PO' };
  var lines = items.map(function (it) {
    var qty = purNum_(it.qty), price = purNum_(it.price);
    return { materialId: purClean_(it.materialId, 40), materialName: purClean_(it.materialName, 200), qty: qty, unit: purClean_(it.unit, 30), price: price,
      amount: qty !== '' && price !== '' ? Math.round(qty * price * 100) / 100 : '' };
  }).filter(function (it) { return it.materialName && it.qty !== ''; });
  if (!lines.length) return { ok: false, error: 'เพิ่มรายการวัตถุดิบอย่างน้อย 1 รายการ' };
  return purLocked_(function () {
    var ss = purBook_(dept), docs = purRead_(ss, 'docs');
    var old = d.id ? docs.filter(function (x) { return x.id === d.id; })[0] : null;
    if (d.id && !old) return { ok: false, error: 'ไม่พบเอกสารนี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_(type), createdAt: purNow_(), files: '[]' };
    o.type = type;
    o.orderDate = purDate_(d.orderDate) || purToday_();
    o.docNo = purClean_(d.docNo, 40) || (old && old.docNo) || purNextDocNo_(docs, type, o.orderDate);
    if (docs.some(function (x) { return x.docNo === o.docNo && x.id !== o.id; })) return { ok: false, error: 'เลขที่เอกสารซ้ำ: ' + o.docNo };
    o.refId = purClean_(d.refId, 40); o.vendorId = purClean_(d.vendorId, 40); o.vendorName = purClean_(d.vendorName, 200); o.vendorPhone = purClean_(d.vendorPhone, 60);
    o.deliveryDate = purDate_(d.deliveryDate); o.status = PUR_DOC_STATUS_[d.status] ? d.status : 'draft';
    o.approvedBy = purClean_(d.approvedBy, 100); o.approvedDate = purDate_(d.approvedDate);
    o.paymentStatus = PUR_PAY_STATUS_[d.paymentStatus] ? d.paymentStatus : (type === 'PO' ? 'unpaid' : 'none');
    o.dueDate = purDate_(d.dueDate); o.paidDate = purDate_(d.paidDate); o.paidAmount = purNum_(d.paidAmount); o.note = purClean_(d.note, 1000);
    o.total = Math.round(lines.reduce(function (s, it) { return s + (Number(it.amount) || 0); }, 0) * 100) / 100;
    o.matchNote = purClean_(d.matchNote, 300);
    // ตรวจ 3 ทาง: จะบันทึก "ชำระแล้ว" ได้เมื่อ PO = รับของ = ใบแจ้งหนี้ หรือใส่เหตุผล
    if (type === 'PO' && o.paymentStatus === 'paid' && (!old || old.paymentStatus !== 'paid')) {
      var mt = purMatch_(o, lines, purRead_(ss, 'moves'), purRead_(ss, 'invoices').map(function (x) { x.items = purJson_(x.items); return x; }));
      if (mt.status !== 'ok' && !o.matchNote) return { ok: false, needReason: true, match: mt, error: 'ตรวจ 3 ทางยังไม่ผ่าน (' + mt.label + ') — ใส่เหตุผลในช่อง "เหตุผลที่ชำระแม้ไม่ตรง" ก่อนบันทึกชำระแล้ว' };
    }
    if (d.rfqId) o.rfqId = purClean_(d.rfqId, 40);
    o.updatedAt = purNow_();
    if (typeof o.files !== 'string') o.files = JSON.stringify(o.files || []);
    purWrite_(ss, 'docs', o);
    // รายการ: ลบของเดิมแล้วเขียนใหม่
    var sh = purSheet_(ss, 'docItems');
    purRead_(ss, 'docItems').filter(function (it) { return it.docId === o.id; }).map(function (it) { return it._row; })
      .sort(function (a, c) { return c - a; }).forEach(function (r) { sh.deleteRow(r); });
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var rows = lines.map(function (it, i) { it.id = purId_('I'); it.docId = o.id; it.line = i + 1; return purRowValues_(sh, 'docItems', it, head); });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);
    if (o.rfqId) { var rq = purRead_(ss, 'rfqs').filter(function (x) { return x.id === o.rfqId; })[0]; if (rq && !rq.poId) { rq.poId = o.id; rq.updatedAt = purNow_(); purWrite_(ss, 'rfqs', rq); } }
    purLogWrite_(ss, old ? 'แก้ไข' : 'สร้าง', 'docs', o.id, o.docNo + (old ? ' ' + purDiff_(old, o, ['docNo', 'vendorName', 'vendorPhone', 'orderDate', 'deliveryDate', 'status', 'total', 'approvedBy', 'paymentStatus', 'dueDate', 'paidDate', 'paidAmount', 'note']) : ' ' + o.vendorName + ' ฿' + o.total));
    return { ok: true, id: o.id, docNo: o.docNo };
  });
}

// ---------- รับเข้า / จ่ายออก / ส่งคืน / ปรับยอด ----------
var PUR_MOVE_TYPES_ = { IN: 'รับเข้า', OUT: 'จ่ายออก', RETURN: 'ส่งคืนผู้ขาย', ADJ: 'ปรับยอด' };
function purSaveMove(token, m) {
  var dept = requirePur_(token);
  m = m || {};
  if (!PUR_MOVE_TYPES_[m.type]) return { ok: false, error: 'เลือกประเภทรายการ' };
  var qty = purNum_(m.qty);
  if (qty === '' || (m.type !== 'ADJ' && qty <= 0) || qty === 0) return { ok: false, error: 'กรอกจำนวนให้ถูกต้อง' };
  return purLocked_(function () {
    var ss = purBook_(dept), list = purRead_(ss, 'moves');
    if (!purRead_(ss, 'materials').some(function (x) { return x.id === m.materialId; })) return { ok: false, error: 'เลือกวัตถุดิบ' };
    var old = m.id ? list.filter(function (x) { return x.id === m.id; })[0] : null;
    if (m.id && !old) return { ok: false, error: 'ไม่พบรายการนี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('T'), createdAt: purNow_(), source: 'ระบบ', files: '[]', date: purToday_() };
    if (purDate_(m.date)) o.date = purDate_(m.date);   // วันที่: หน้าเว็บตั้งเป็นวันนี้ให้ก่อน แก้ได้
    o.type = m.type; o.materialId = m.materialId; o.qty = qty;
    o.lot = purClean_(m.lot, 60) || (m.type === 'IN' ? o.date.split('-').reverse().join('/') : ''); o.expDate = purDate_(m.expDate); o.mfgDate = purDate_(m.mfgDate);
    o.requester = purClean_(m.requester, 100); o.issuer = purClean_(m.issuer, 100); o.docId = purClean_(m.docId, 40);
    o.qc = purClean_(m.qc, 40); o.qcNote = purClean_(m.qcNote, 500); o.note = purClean_(m.note, 500); o.updatedAt = purNow_();
    if (typeof o.files !== 'string') o.files = JSON.stringify(o.files || []);
    purWrite_(ss, 'moves', o);
    purLogWrite_(ss, old ? 'แก้ไข' : PUR_MOVE_TYPES_[o.type], 'moves', o.id, old ? purDiff_(old, o, ['date', 'type', 'materialId', 'qty', 'lot', 'expDate', 'requester', 'issuer', 'docId', 'qc', 'qcNote', 'note']) : o.materialId + ' ' + qty + ' LOT ' + o.lot);
    if (o.docId && o.type === 'IN') purUpdateDocReceipt_(ss, o.docId);
    return { ok: true, id: o.id };
  });
}
function purDeleteMove(token, moveId) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), old = purRead_(ss, 'moves').filter(function (x) { return x.id === moveId; })[0];
    if (!old) return { ok: false, error: 'ไม่พบรายการนี้' };
    purSheet_(ss, 'moves').deleteRow(old._row);
    purLogWrite_(ss, 'ลบ', 'moves', moveId, old.date + ' ' + old.type + ' ' + old.materialId + ' ' + old.qty + ' LOT ' + old.lot);
    if (old.docId) purUpdateDocReceipt_(ss, old.docId);
    return { ok: true };
  });
}
// PO: รับของครบ/บางส่วน ตามจำนวนที่รับเข้าเทียบกับรายการในใบ
function purUpdateDocReceipt_(ss, docId) {
  var doc = purRead_(ss, 'docs').filter(function (x) { return x.id === docId; })[0];
  if (!doc || doc.type !== 'PO' || doc.status === 'cancelled') return;
  var items = purRead_(ss, 'docItems').filter(function (x) { return x.docId === docId; });
  var got = {};
  purRead_(ss, 'moves').forEach(function (m) { if (m.docId === docId && m.type === 'IN') got[m.materialId] = (got[m.materialId] || 0) + (Number(m.qty) || 0); });
  var any = Object.keys(got).length > 0, all = items.length > 0 && items.every(function (it) { return (got[it.materialId] || 0) >= (Number(it.qty) || 0) - 0.0001; });
  var st = all ? 'received' : any ? 'partial' : (doc.status === 'received' || doc.status === 'partial' ? 'ordered' : doc.status);
  if (st !== doc.status) { doc.status = st; doc.updatedAt = purNow_(); purWrite_(ss, 'docs', doc); }
}

// ---------- ไฟล์แนบ (PR/PO ที่อนุมัติ, ภาพอนุมัติทาง LINE, COA, ใบส่งของ) ----------
function purParseFiles_(v) { try { var a = typeof v === 'string' ? JSON.parse(v || '[]') : v; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
var PUR_FILE_OWNERS_ = { move: 'moves', doc: 'docs', vendor: 'vendors', invoice: 'invoices', quote: 'quotes' };
var PUR_FILE_TYPES_ = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1, 'image/heic': 1, 'application/pdf': 1 };
function purUploadFile(token, ownerType, ownerId, fileName, mimeType, base64, label) {
  var dept = requirePur_(token);
  var table = PUR_FILE_OWNERS_[ownerType] || '';
  if (!table) return { ok: false, error: 'ไม่รู้ว่าจะแนบกับรายการไหน' };
  if (!PUR_FILE_TYPES_[mimeType]) return { ok: false, error: 'แนบได้เฉพาะรูปภาพหรือ PDF' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 15 * 1024 * 1024) return { ok: false, error: 'ไฟล์ว่างหรือใหญ่เกิน 15 MB' };
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์เก็บไฟล์ของแผนก' };
  return purLocked_(function () {
    var ss = purBook_(dept), row = purRead_(ss, table).filter(function (x) { return x.id === ownerId; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var folder = DriveApp.getFolderById(folderId);
    var safe = purClean_(fileName, 120).replace(/[\\/:*?"<>|]/g, '_') || 'file';
    var prefix = table === 'docs' ? (row.docNo || row.id) : table === 'moves' ? (row.date + '_' + row.id)
      : table === 'invoices' ? ('INV_' + (row.invoiceNo || row.id)) : table === 'quotes' ? ('QT_' + (row.vendorName || '') + '_' + (row.quoteNo || row.id)) : ('V_' + (row.name || row.id));
    var f = folder.createFile(Utilities.newBlob(bytes, mimeType, prefix + '_' + safe));
    var files = purParseFiles_(row.files);
    var rec = { id: f.getId(), name: safe, mime: mimeType, label: purClean_(label, 60), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', at: purNow_() };
    files.push(rec);
    row.files = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, table, row);
    purLogWrite_(ss, 'แนบไฟล์', table, ownerId, rec.label + ' ' + safe);
    return { ok: true, file: rec, files: files };
  });
}
function purRemoveFile(token, ownerType, ownerId, fileId) {
  var dept = requirePur_(token);
  var table = PUR_FILE_OWNERS_[ownerType] || '';
  if (!table) return { ok: false, error: 'ไม่รู้ว่าจะลบจากรายการไหน' };
  return purLocked_(function () {
    var ss = purBook_(dept), row = purRead_(ss, table).filter(function (x) { return x.id === ownerId; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var files = purParseFiles_(row.files), f = files.filter(function (x) { return x.id === fileId; })[0];
    if (!f) return { ok: false, error: 'ไม่พบไฟล์' };
    files = files.filter(function (x) { return x.id !== fileId; });
    row.files = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, table, row);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    purLogWrite_(ss, 'ลบไฟล์', table, ownerId, f.name);
    return { ok: true, files: files };
  });
}

// ประวัติราคาของวัตถุดิบ (เก่า → ใหม่)
function purPriceHistory(token, materialId) {
  var dept = requirePur_(token), ss = purBook_(dept);
  var list = purRead_(ss, 'prices').filter(function (p) { return p.materialId === materialId; })
    .sort(function (a, c) { return a.effectiveDate === c.effectiveDate ? String(a.createdAt).localeCompare(String(c.createdAt)) : a.effectiveDate.localeCompare(c.effectiveDate); });
  list.forEach(function (p) { delete p._row; });
  return { ok: true, prices: list };
}

// ประวัติการแก้ไขล่าสุด
function purLog(token, limit) {
  var dept = requirePur_(token), ss = purBook_(dept);
  var list = purRead_(ss, 'log');
  return { ok: true, log: list.slice(-Math.min(500, Number(limit) || 200)).reverse() };
}

// ---------- สรุปสำหรับ Dashboard ผู้บริหาร (ดูอย่างเดียว · เรียกจาก Executive.gs) ----------
function purDashboard_(dept, from, to) {
  var ss = purBook_(dept), today = purToday_();
  var materials = purRead_(ss, 'materials'), moves = purRead_(ss, 'moves'), prices = purRead_(ss, 'prices'), docs = purRead_(ss, 'docs');
  var b = purBalances_(moves), byId = {};
  materials.forEach(function (m) { byId[m.id] = m; });
  var priceList = {};
  prices.forEach(function (p) { (priceList[p.materialId] = priceList[p.materialId] || []).push(p); });
  Object.keys(priceList).forEach(function (k) { priceList[k].sort(function (a, c) { return a.effectiveDate.localeCompare(c.effectiveDate); }); });
  var priceAt = function (mid, date) {
    var list = priceList[mid] || [], p = '';
    for (var i = 0; i < list.length; i++) { if (list[i].effectiveDate <= date) p = list[i].price; else break; }
    return p === '' && list.length ? list[0].price : p;
  };
  var active = materials.filter(function (m) { return m.active !== 'ปิด'; });
  var low = [], exp = [];
  active.forEach(function (m) {
    var bal = b.bal[m.id] || 0;
    if ((m.minStock !== '' && bal <= m.minStock) || bal < 0) low.push({ name: m.name, unit: m.unit, balance: bal, minStock: m.minStock });
    (b.lots[m.id] || []).forEach(function (l) {
      if (!l.expDate) return;
      var left = Math.round((purToDate_(l.expDate) - purToDate_(today)) / 864e5);
      if (left <= 30) exp.push({ name: m.name, lot: l.lot, expDate: l.expDate, qty: l.qty, unit: m.unit, left: left });
    });
  });
  exp.sort(function (a, c) { return a.left - c.left; });
  // การเคลื่อนไหวในช่วงวันที่
  var days = {}, top = {}, inN = 0, outN = 0, inV = 0, outV = 0, qcFail = 0, returns = 0;
  moves.forEach(function (m) {
    if (m.date < from || m.date > to) return;
    var s = purSigned_(m), d = (days[m.date] = days[m.date] || { date: m.date, inN: 0, outN: 0 });
    var price = priceAt(m.materialId, m.date), value = price === '' ? 0 : Math.abs(s) * price;
    if (s >= 0) { inN++; d.inN++; inV += value; if (m.qc === 'ไม่ผ่าน') qcFail++; }
    else {
      outN++; d.outN++; outV += value; if (m.type === 'RETURN') returns++;
      var t = (top[m.materialId] = top[m.materialId] || { name: (byId[m.materialId] || {}).name || m.materialId, unit: (byId[m.materialId] || {}).unit || '', count: 0, qty: 0, value: 0 });
      t.count++; t.qty += -s; t.value += value;
    }
  });
  var topList = Object.keys(top).map(function (k) { var t = top[k]; t.qty = Math.round(t.qty * 1000) / 1000; t.value = Math.round(t.value * 100) / 100; return t; })
    .sort(function (a, c) { return c.count - a.count || c.qty - a.qty; }).slice(0, 10);
  // PR / PO ในช่วงวันที่ (ตามวันที่สั่ง) + ค้างทั้งหมด ณ วันนี้
  var inRange = docs.filter(function (d) { return d.status !== 'cancelled' && d.orderDate >= from && d.orderDate <= to; });
  var po = inRange.filter(function (d) { return d.type === 'PO'; }), pr = inRange.filter(function (d) { return d.type === 'PR'; });
  var sumOf = function (list, k) { return Math.round(list.reduce(function (s, d) { return s + (Number(d[k]) || 0); }, 0) * 100) / 100; };
  var unpaid = docs.filter(function (d) { return d.type === 'PO' && d.status !== 'cancelled' && d.paymentStatus !== 'paid' && d.paymentStatus !== 'none'; })
    .map(function (d) { return { docNo: d.docNo, vendorName: d.vendorName, dueDate: d.dueDate, due: Math.round(((Number(d.total) || 0) - (Number(d.paidAmount) || 0)) * 100) / 100, overdue: !!d.dueDate && d.dueDate < today }; })
    .sort(function (a, c) { return String(a.dueDate || '9').localeCompare(String(c.dueDate || '9')); });
  var waiting = docs.filter(function (d) { return d.type === 'PO' && /approved|ordered|partial/.test(d.status); })
    .map(function (d) { return { docNo: d.docNo, vendorName: d.vendorName, deliveryDate: d.deliveryDate, late: !!d.deliveryDate && d.deliveryDate < today, status: d.status }; });
  var dayList = Object.keys(days).sort().map(function (k) { return days[k]; });
  return {
    kind: 'purchasing', today: today, hasPrices: prices.length > 0,
    kpi: { materials: active.length, low: low.length, expiring: exp.length, inCount: inN, outCount: outN, inValue: Math.round(inV * 100) / 100, outValue: Math.round(outV * 100) / 100,
      qcFail: qcFail, returns: returns, poCount: po.length, poTotal: sumOf(po, 'total'), poPaid: sumOf(po, 'paidAmount'), prCount: pr.length, prTotal: sumOf(pr, 'total'),
      prDraft: pr.filter(function (d) { return d.status === 'draft'; }).length, unpaidTotal: Math.round(unpaid.reduce(function (s, d) { return s + d.due; }, 0) * 100) / 100,
      overdueCount: unpaid.filter(function (d) { return d.overdue; }).length, waitingCount: waiting.length },
    days: dayList, top: topList, low: low.slice(0, 30), expiring: exp.slice(0, 30), unpaid: unpaid.slice(0, 30), waiting: waiting.slice(0, 30),
    insights: purInsights_(ss, from, to)   // คำถามผู้บริหาร: ซื้อเท่าไร ราคาขึ้นลง ใครส่งช้า พึ่งพาใครมากไป PO ค้าง โอกาสลดต้นทุน (PurchasingPlus.gs)
  };
}


// ---------- รายงานสต๊อกคงเหลือ ณ วันที่ + มูลค่า (จำนวนคงเหลือ × ราคา ณ วันที่นั้น) ----------
function purStockReport(token, asOf) {
  var dept = requirePur_(token), ss = purBook_(dept);
  asOf = purDate_(asOf);
  if (!asOf) return { ok: false, error: 'เลือกวันที่' };
  var materials = purRead_(ss, 'materials'), prices = purRead_(ss, 'prices');
  var moves = purRead_(ss, 'moves').filter(function (m) { return m.date <= asOf; });
  var b = purBalances_(moves), byMat = {};
  prices.forEach(function (p) { (byMat[p.materialId] = byMat[p.materialId] || []).push(p); });
  var rows = materials.map(function (m) {
    var qty = b.bal[m.id] || 0, list = (byMat[m.id] || []).sort(function (a, c) { return a.effectiveDate.localeCompare(c.effectiveDate); });
    // ราคาล่าสุดที่มีผลไม่เกินวันที่เลือก · ถ้ายังไม่มีราคาก่อนวันนั้น ใช้ราคาแรกที่บันทึกไว้
    var before = list.filter(function (x) { return x.effectiveDate <= asOf; }), p = before.length ? before[before.length - 1] : list[0];
    var price = p ? p.price : '', value = price === '' ? '' : Math.round(qty * price * 100) / 100;
    return { id: m.id, name: m.name, unit: m.unit, qty: qty, price: price, priceDate: p ? p.effectiveDate : '', value: value, lastMove: b.last[m.id] || '', active: m.active };
  }).filter(function (r) { return Math.abs(r.qty) > 0.0005; })
    .sort(function (a, c) { return a.name.localeCompare(c.name, 'th'); });
  var total = Math.round(rows.reduce(function (s2, r) { return s2 + (r.value === '' ? 0 : r.value); }, 0) * 100) / 100;
  return { ok: true, asOf: asOf, rows: rows, total: total, noPrice: rows.filter(function (r) { return r.price === ''; }).length };
}

// ---------- รายงานประวัติราคา (ตามผู้ขาย / วัตถุดิบ) · ราคาที่มีผลในช่วงวันที่ + เทียบราคาก่อนหน้า ----------
function purPriceReport(token, from, to) {
  var dept = requirePur_(token), ss = purBook_(dept);
  from = purDate_(from); to = purDate_(to);
  if (!from || !to || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var mats = {}, vens = {};
  purRead_(ss, 'materials').forEach(function (m) { mats[m.id] = m; });
  purRead_(ss, 'vendors').forEach(function (v) { vens[v.id] = v.name; });
  var byMat = {};
  purRead_(ss, 'prices').forEach(function (p) { (byMat[p.materialId] = byMat[p.materialId] || []).push(p); });
  var rows = [];
  Object.keys(byMat).forEach(function (mid) {
    var list = byMat[mid].sort(function (a, c) { return a.effectiveDate === c.effectiveDate ? String(a.createdAt).localeCompare(String(c.createdAt)) : a.effectiveDate.localeCompare(c.effectiveDate); });
    list.forEach(function (p, i) {
      if (p.effectiveDate < from || p.effectiveDate > to) return;
      var prev = i > 0 ? list[i - 1] : null, m = mats[mid] || {};
      var vendorId = p.vendorId || m.vendorId || '';
      rows.push({ date: p.effectiveDate, materialId: mid, material: m.name || mid, unit: m.unit || '', vendorId: vendorId, vendor: vens[vendorId] || '',
        price: p.price, prevPrice: prev ? prev.price : '', prevDate: prev ? prev.effectiveDate : '',
        change: prev ? Math.round((p.price - prev.price) * 100) / 100 : '', pct: prev && prev.price ? Math.round((p.price - prev.price) / prev.price * 1000) / 10 : '', note: p.note });
    });
  });
  rows.sort(function (a, c) { return a.vendor.localeCompare(c.vendor, 'th') || a.material.localeCompare(c.material, 'th') || a.date.localeCompare(c.date); });
  return { ok: true, from: from, to: to, rows: rows };
}
