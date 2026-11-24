// ==================== ฝ่ายบัญชี — ใบสั่งซื้อ CP Ram (PDF) → ตารางส่งสินค้า CP Ram ====================
//
// หน้าเว็บอ่านไฟล์ PDF ใบสั่งซื้อของ CPRAM เอง (pdf.js · 1 หน้า = 1 ใบสั่ง) ส่งเฉพาะตัวเลขที่อ่านได้มา
// (ตัวหนังสือไทยใน PDF อ่านไม่ได้ — ชื่อสินค้าจึงจับจากรหัสสินค้า และสถานที่ส่งจากข้อความ "ส่งที่" เช่น 0400 / WD01 LLKC RM WHD)
// cpPreview ตรวจกับข้อมูลเดิม (ใหม่ / มีแล้ว / เปลี่ยนแปลง) → แสดงในหน้าเว็บก่อน → cpSave บันทึกลง Google Sheet แยก
// "ตารางส่งสินค้า CP Ram" (ฝ่ายบัญชีสร้างเอง แชร์ให้บัญชีสคริปต์เป็น Editor แล้ววางลิงก์ในหน้าเว็บ)
//   แท็บ "PO CP Ram" (1 แถว = 1 รายการในใบสั่ง) · "นำเข้า PO" (1 แถว = 1 ครั้ง) · "เดือน MM.YY" สร้างใหม่ทุกครั้ง หน้าตาเหมือนไฟล์ Excel เดิม
// การจับคู่สินค้า / สถานที่ส่ง เก็บในแท็บตั้งค่าของชีตหลักฝ่ายบัญชี (cpramMap) · ลิงก์ชีตเก็บเป็น cpramSheet

var CP_TABLES_ = {
  cp_lines: { tab: 'PO CP Ram', cols: [
    ['id', 'รหัส'], ['poNo', 'เลขที่ใบสั่งซื้อ (PO)'], ['lineNo', 'ลำดับ'], ['poDate', 'วันที่เอกสาร'], ['prNo', 'เลขที่ใบขอซื้อ'],
    ['itemCode', 'รหัสสินค้า CP Ram'], ['product', 'สินค้า'], ['deliveryDate', 'วันที่ส่ง'], ['qty', 'จำนวน'], ['unit', 'หน่วย'],
    ['price', 'ราคา/หน่วย'], ['amount', 'จำนวนเงิน'], ['vat', 'VAT 7%'], ['net', 'รวมสุทธิ'], ['shipTo', 'ส่งที่ (ตามใบสั่ง)'],
    ['wh', 'คลัง'], ['place', 'สถานที่ส่ง'], ['termDays', 'เครดิต (วัน)'], ['dueDate', 'รอบเงินเข้า'], ['status', 'สถานะ'], ['note', 'หมายเหตุ'],
    ['history', 'ประวัติการเปลี่ยนแปลง'], ['fileName', 'ไฟล์'], ['importId', 'รหัสการนำเข้าล่าสุด'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขเมื่อ']] },
  cp_imports: { tab: 'นำเข้า PO', cols: [
    ['id', 'รหัส'], ['fileName', 'ชื่อไฟล์'], ['poCount', 'จำนวนใบสั่ง'], ['added', 'เพิ่มใหม่'], ['changed', 'อัปเดต'], ['skipped', 'ข้าม (มีแล้ว)'],
    ['qty', 'รวมจำนวน'], ['amount', 'มูลค่ารวม (ไม่รวม VAT)'], ['sentAt', 'ส่ง LINE เมื่อ'], ['imgUrl', 'ภาพตาราง (LINE)'], ['pdfUrl', 'ไฟล์ PDF'], ['xlsxUrl', 'ไฟล์ Excel'], ['sheetUrl', 'ไฟล์รายงาน (Google Sheet)'], ['createdAt', 'นำเข้าเมื่อ']] }
};
// ประวัติเลื่อนวันส่ง (แก้ในหน้าเว็บ) — 1 แถว = เลื่อน 1 ครั้ง · ส่ง LINE แจ้งเลื่อนส่งได้
CP_TABLES_.cp_moves = { tab: 'ประวัติเลื่อนส่ง', cols: [
  ['id', 'รหัส'], ['lineId', 'รหัสรายการ'], ['poNo', 'เลขที่ใบสั่งซื้อ (PO)'], ['lineNo', 'ลำดับ'], ['product', 'สินค้า'], ['qty', 'จำนวน'], ['unit', 'หน่วย'],
  ['place', 'สถานที่ส่ง'], ['fromDate', 'วันส่งเดิม'], ['toDate', 'วันส่งใหม่'], ['reason', 'เหตุผล'], ['createdAt', 'บันทึกเมื่อ'], ['sentAt', 'ส่ง LINE เมื่อ'], ['imgUrl', 'ภาพตาราง (LINE)'],
  ['fromQty', 'จำนวนเดิม'], ['toQty', 'จำนวนใหม่']] };   // เพิ่ม / ลดจำนวน (ผู้ใช้ขอ 24/11/69) — จำนวนตามหน่วยใน PO
var CP_PRODUCTS_DEFAULT_ = [{ code: '72400524', name: 'น้ำพริกหนังไก่กรอบ' }];
var CP_SHIPS_DEFAULT_ = [{ key: 'WD01 LLKC', wh: '-', place: 'ลาดหลุมแก้ว' }];
var CP_STATUS_ = { '': 'รอส่ง', done: 'ส่งสินค้าแล้ว', cancel: 'ยกเลิก' };
var CP_MONTHS_ = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var CP_HEAD_BG_ = '#C6E0B4', CP_TOTAL_BG_ = '#FFFF00';

// รอบเงินเข้าแบบเดียวกับ CP ALL (accDueDate_): ส่งวันที่ 1–15 → วันที่ 10 เดือนถัดไป · 16–31 → วันที่ 25 · ตรงเสาร์-อาทิตย์/วันหยุดราชการ → วันทำการถัดไป
// วันหยุดใช้ชุดเดียวกับ 7-11 (ปฏิทินวันหยุดไทย + วันหยุดที่ตั้งเพิ่มในหน้าตั้งค่า) · คำนวณใหม่ทุกครั้งที่โหลด/สร้างแท็บเดือน
var CP_HOL_ = null;
function cpHolInit_(main) { try { CP_HOL_ = accHolidaySet_(accMap_(main)); } catch (e) { CP_HOL_ = {}; } try { cpMap_(main); } catch (e) {} }
function cpDue_(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? accDueDate_(String(iso), CP_HOL_ || {}) : ''; }
function cpRegister_() {
  accRegister_();
  Object.keys(CP_TABLES_).forEach(function (k) { PUR_TABLES_[k] = CP_TABLES_[k]; });
  ['poDate', 'deliveryDate', 'dueDate', 'fromDate', 'toDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['lineNo', 'qty', 'price', 'amount', 'vat', 'net', 'termDays', 'poCount', 'added', 'changed', 'skipped', 'fromQty', 'toQty'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function cpSettingRow_(ss, id) { return purRead_(ss, 'acc_settings').filter(function (x) { return x.id === id; })[0]; }
function cpMap_(ss) {
  var row = cpSettingRow_(ss, 'cpramMap'), saved = {};
  try { saved = row ? JSON.parse(row.value || '{}') : {}; } catch (e) { saved = {}; }
  var products = (Array.isArray(saved.products) ? saved.products : []).map(cpCleanProduct_).filter(function (p) { return p.code && p.name; });
  // saved.full = บันทึกจากหน้าตั้งค่าแล้ว (ลบค่าเริ่มต้นได้) — ก่อนนั้นเติมค่าเริ่มต้นให้
  if (!saved.full) CP_PRODUCTS_DEFAULT_.forEach(function (d) { if (!products.some(function (p) { return p.code === d.code; })) products.push(d); });
  var ships = (Array.isArray(saved.ships) ? saved.ships : []).map(cpCleanShip_).filter(function (s) { return s.key && s.place; });
  if (!saved.full) CP_SHIPS_DEFAULT_.forEach(function (d) { if (!ships.some(function (s) { return accNorm_(s.key) === accNorm_(d.key); })) ships.push(d); });
  CP_MAP_ = { products: products, ships: ships };
  return CP_MAP_;
}
function cpMapFull_(ss) { var r = cpSettingRow_(ss, 'cpramMap'); try { return !!(r && JSON.parse(r.value || '{}').full); } catch (e) { return false; } }
function cpCleanProduct_(p) { var o = { code: accClean_(p && p.code, 20).replace(/\D/g, ''), name: accClean_(p && p.name, 80) }, n = Number(purNum_(p && p.perCase)) || 0; if (n > 0) o.perCase = n; return o; }
// แปลงชิ้น → ลัง สำหรับแสดงผล (ข้อมูลในชีตเก็บตามใบ PO): สินค้าที่ตั้ง "ชิ้นต่อ 1 ลัง" ไว้ (ผู้ใช้ขอ 23/11/69)
// คืนสำเนา: qty = ลัง, unit = ลัง, price = ราคาต่อลัง, pcs / pcsUnit = จำนวนเดิมตามใบ PO
var CP_MAP_ = null;
function cpPerCase_(r) {
  var m = CP_MAP_ || { products: [] }, code = String(r.itemCode || '').replace(/^'/, '');
  var p = m.products.filter(function (x) { return (code && x.code === code) || (!code && r.product && x.name === r.product); })[0];
  return p && p.perCase > 0 ? p.perCase : 0;
}
function cpIsCase_(u) { return /^(ลัง|CAS|CTN|CT)$/i.test(String(u || '').trim()); }
function cpCase_(rows) {
  return (rows || []).map(function (r) {
    var u = r.unitTh || r.unit, n = cpPerCase_(r);
    if (!n || cpIsCase_(u)) return r;
    var o = Object.assign({}, r);
    o.pcs = Number(r.qty) || 0; o.pcsUnit = cpUnitTh_(u || 'ชิ้น'); o.perCase = n;
    o.qty = Math.round(o.pcs / n * 100) / 100; o.unit = 'ลัง'; o.unitTh = 'ลัง';
    o.price = Math.round((Number(r.price) || 0) * n * 10000) / 10000;
    return o;
  });
}
function cpPcsNote_(r) { return r.pcs ? r.pcs.toLocaleString() + ' ' + r.pcsUnit + ' (' + r.perCase.toLocaleString() + ' ' + r.pcsUnit + '/ลัง)' : ''; }
function cpCleanShip_(s) { return { key: accClean_(s && s.key, 60), wh: accClean_(s && s.wh, 30) || '-', place: accClean_(s && s.place, 40) }; }
function cpSheetId_(ss) { var r = cpSettingRow_(ss, 'cpramSheet'); return r ? String(r.value || '') : ''; }
function cpBook_(main) {
  var id = cpSheetId_(main);
  if (!id) return null;
  var ss = SpreadsheetApp.openById(id);
  try { if (ss.getSpreadsheetTimeZone() !== PUR_TZ_) ss.setSpreadsheetTimeZone(PUR_TZ_); } catch (e) {}
  return ss;
}
function cpKey_(l) { return String(l.poNo).replace(/^'/, '') + '|' + Number(l.lineNo); }
function cpR2_(n) { return Math.round(Number(n || 0) * 100) / 100; }
function cpMatchProduct_(map, code) { var p = map.products.filter(function (x) { return x.code === code; })[0]; return p ? p.name : ''; }
// ส่งที่ในใบ PO มี 2 แบบ: "0400 / WD01 LLKC RM WHD" หรือรหัสอย่างเดียว "0412"
// คำค้นที่เป็นตัวเลขล้วน = รหัส ต้องตรงกับรหัสหน้าสุดของช่อง "ส่งที่" ทั้งตัว · คำค้นอื่น = มีอยู่ในข้อความ
function cpMatchShip_(map, shipTo) {
  var t = accNorm_(shipTo), code = (String(shipTo).match(/^\s*(\d+)/) || [])[1] || '';
  if (!t) return null;
  return map.ships.filter(function (s) { var k = accNorm_(s.key); return /^\d+$/.test(k) ? k === code : t.indexOf(k) >= 0; })[0] || null;
}

// รับข้อมูลจากหน้าเว็บ: [{poNo, poDate, shipTo, termDays, page, file, lines:[{lineNo, prNo, itemCode, deliveryDate, qty, unit, price, amount}], totals:{sub, discount, vat, net}}]
function cpCleanPos_(pos) {
  return (Array.isArray(pos) ? pos : []).slice(0, 300).map(function (p) {
    var o = { poNo: accClean_(p.poNo, 20).replace(/\D/g, ''), poDate: accDate_(p.poDate), shipTo: accClean_(p.shipTo, 80), termDays: purNum_(p.termDays) || '',
      file: accClean_(p.file, 120), page: Number(p.page) || '', totals: {} };
    ['sub', 'discount', 'vat', 'net'].forEach(function (k) { var v = purNum_(p.totals && p.totals[k]); o.totals[k] = v === '' ? '' : v; });
    o.lines = (Array.isArray(p.lines) ? p.lines : []).slice(0, 50).map(function (l) {
      return { poNo: o.poNo, lineNo: Number(l.lineNo) || 0, prNo: accClean_(l.prNo, 20), itemCode: accClean_(l.itemCode, 20).replace(/\D/g, ''),
        deliveryDate: accDate_(l.deliveryDate), qty: Number(purNum_(l.qty)) || 0, unit: accClean_(l.unit, 10) || 'CAS',
        price: Number(purNum_(l.price)) || 0, amount: Number(purNum_(l.amount)) || 0 };
    }).filter(function (l) { return l.lineNo; });
    return o;
  }).filter(function (p) { return p.poNo && p.lines.length; });
}
// หน่วยของยอดรวม: ทุกแถวหน่วยเดียวกัน → หน่วยนั้น (ลัง / ชิ้น …) · ปนกัน → "หน่วย"
function cpUnitOf_(rows) { var u = {}; (rows || []).forEach(function (r) { u[String(r.unitTh || r.unit || 'ลัง')] = 1; }); var k = Object.keys(u); return k.length === 1 ? k[0] : k.length ? 'หน่วย' : 'ลัง'; }
function cpUnitTh_(u) { return { CAS: 'ลัง', CTN: 'ลัง', CT: 'ลัง', PAC: 'แพ็ค', PCS: 'ชิ้น', PC: 'ชิ้น', EA: 'ชิ้น' }[String(u).toUpperCase()] || u; }

// จัดรายการ + ตรวจกับของเดิม
function cpPrepare_(map, pos, savedList) {
  var saved = {}; savedList.forEach(function (x) { saved[cpKey_(x)] = x; });
  var rows = [], unProd = {}, unShip = {}, checks = [], seen = {};
  pos.forEach(function (p) {
    var ship = cpMatchShip_(map, p.shipTo), sum = 0;
    if (!ship) { unShip[p.shipTo] = unShip[p.shipTo] || { shipTo: p.shipTo, pos: [] }; unShip[p.shipTo].pos.push(p.poNo); }
    p.lines.forEach(function (l) {
      var product = cpMatchProduct_(map, l.itemCode);
      if (!product) { unProd[l.itemCode] = unProd[l.itemCode] || { itemCode: l.itemCode, qty: 0, unit: cpUnitTh_(l.unit) }; unProd[l.itemCode].qty += l.qty; }
      var r = Object.assign({}, l, { poDate: p.poDate, shipTo: p.shipTo, termDays: p.termDays, file: p.file, product: product,
        wh: ship ? ship.wh : '', place: ship ? ship.place : '', unitTh: cpUnitTh_(l.unit),
        vat: cpR2_(l.amount * 0.07), net: cpR2_(l.amount * 1.07), dueDate: cpDue_(l.deliveryDate) });
      if (Math.abs(cpR2_(l.qty * l.price) - l.amount) > 0.01) checks.push('PO ' + p.poNo + ' รายการ ' + l.lineNo + ': จำนวน × ราคา ไม่เท่ากับจำนวนเงิน');
      sum += l.amount;
      var k = cpKey_(r), old = saved[k];
      if (seen[k]) { r.state = 'dup'; } else if (!old) r.state = 'new';
      else {
        var diff = [];
        if (old.deliveryDate !== r.deliveryDate) diff.push({ f: 'วันที่ส่ง', from: old.deliveryDate, to: r.deliveryDate });
        if (Number(old.qty) !== r.qty) diff.push({ f: 'จำนวน', from: old.qty, to: r.qty });
        if (Number(old.price) !== r.price) diff.push({ f: 'ราคา', from: old.price, to: r.price });
        if (String(old.itemCode).replace(/^'/, '') !== r.itemCode) diff.push({ f: 'รหัสสินค้า', from: String(old.itemCode).replace(/^'/, ''), to: r.itemCode });
        r.state = diff.length ? 'changed' : 'same'; r.diff = diff; r.oldId = old.id;
      }
      seen[k] = 1;
      rows.push(r);
    });
    if (p.totals.sub !== '' && Math.abs(cpR2_(sum) - p.totals.sub) > 0.01) checks.push('PO ' + p.poNo + ': ผลรวมรายการ ' + cpR2_(sum) + ' ไม่เท่ากับรวมมูลค่าสินค้าท้ายใบ ' + p.totals.sub);
    if (p.totals.vat !== '' && p.totals.sub !== '' && Math.abs(cpR2_((p.totals.sub - (p.totals.discount || 0)) * 0.07) - p.totals.vat) > 0.05) checks.push('PO ' + p.poNo + ': VAT ท้ายใบไม่เท่ากับ 7%');
    if (!p.poDate) checks.push('PO ' + p.poNo + ': อ่านวันที่เอกสารไม่ได้');
    p.lines.forEach(function (l) { if (!l.deliveryDate) checks.push('PO ' + p.poNo + ' รายการ ' + l.lineNo + ': อ่านกำหนดส่งไม่ได้'); });
  });
  rows.sort(function (a, b) { return (a.deliveryDate || '9').localeCompare(b.deliveryDate || '9') || String(a.poNo).localeCompare(String(b.poNo)) || a.lineNo - b.lineNo; });
  return { rows: rows, checks: checks,
    unmatchedProducts: Object.keys(unProd).map(function (k) { return unProd[k]; }),
    unmatchedShips: Object.keys(unShip).map(function (k) { return unShip[k]; }) };
}
function cpRounds_(rows) {
  var by = {};
  rows.forEach(function (r) {
    if (r.status === 'cancel' || !r.dueDate) return;
    var o = by[r.dueDate] = by[r.dueDate] || { dueDate: r.dueDate, qty: 0, amount: 0, prices: {} };
    o.qty += Number(r.qty) || 0; o.amount += Number(r.amount) || 0; o.prices[r.price] = 1;
  });
  return Object.keys(by).sort().map(function (k) {
    var o = by[k], pr = Object.keys(o.prices);
    return { dueDate: k, qty: o.qty, price: pr.length === 1 ? Number(pr[0]) : '', amount: cpR2_(o.amount), vat: cpR2_(o.amount * 0.07), total: cpR2_(o.amount * 1.07) };
  });
}

// ---------- API ----------
function cpLoad(token) {
  var dept = requireAcc_(token); cpRegister_();
  var main = purBook_(dept), map = cpMap_(main), ss = null, err = ''; cpHolInit_(main);
  try { ss = cpBook_(main); } catch (e) { err = 'เปิดชีต CP Ram ไม่ได้ — ตรวจว่าแชร์ให้บัญชีระบบเป็นผู้แก้ไขแล้ว'; }
  var lines = [], imports = [], moves = [];
  if (ss) {
    lines = purRead_(ss, 'cp_lines').map(function (x) { delete x._row; Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); x.dueDate = cpDue_(x.deliveryDate) || x.dueDate; return x; });
    moves = purRead_(ss, 'cp_moves').map(function (x) { delete x._row; Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); return x; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 100);
    imports = purRead_(ss, 'cp_imports').map(function (x) { delete x._row; Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); return x; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 30);
  }
  var lp = props_();
  return { ok: true, today: purToday_(), line: !!(lp.getProperty('ACC_LINE_TOKEN') && lp.getProperty('ACC_LINE_GROUP')), linked: !!ss, sheetUrl: ss ? ss.getUrl() : '', sheetName: ss ? ss.getName() : '', error: err,
    map: map, lines: lines, imports: imports, moves: moves, rounds: cpRounds_(cpCase_(lines)) };
}
function cpSetSheet(token, url) {
  var dept = requireAcc_(token); cpRegister_();
  var m = String(url || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || String(url || '').match(/^([a-zA-Z0-9_-]{25,})$/);
  if (!m) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง — คัดลอกลิงก์จากแถบที่อยู่ของ Google Sheet' };
  var ss;
  try { ss = SpreadsheetApp.openById(m[1]); } catch (e) { return { ok: false, error: 'เปิดไฟล์ไม่ได้ — แชร์ไฟล์ให้บัญชีระบบเป็น "ผู้แก้ไข" ก่อน' }; }
  try { purSheet_(ss, 'cp_lines'); purSheet_(ss, 'cp_imports'); } catch (e) { return { ok: false, error: 'ไฟล์นี้แก้ไขไม่ได้ — ต้องแชร์ให้บัญชีระบบเป็น "ผู้แก้ไข"' }; }
  var first = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) { try { ss.deleteSheet(first); } catch (e) {} }
  return purLocked_(function () {
    var main = purBook_(dept), row = cpSettingRow_(main, 'cpramSheet') || { id: 'cpramSheet' }; cpHolInit_(main);
    row.value = ss.getId();
    purWrite_(main, 'acc_settings', row);
    purLogWrite_(main, 'เชื่อมชีต CP Ram', 'acc_settings', 'cpramSheet', ss.getName());
    return { ok: true, sheetName: ss.getName(), sheetUrl: ss.getUrl() };
  });
}
function cpPreview(token, pos) {
  var dept = requireAcc_(token); cpRegister_();
  var main = purBook_(dept), map = cpMap_(main), ss = cpBook_(main); cpHolInit_(main);
  var list = cpCleanPos_(pos);
  if (!list.length) return { ok: false, error: 'ไม่พบใบสั่งซื้อในไฟล์' };
  var r = cpPrepare_(map, list, ss ? purRead_(ss, 'cp_lines') : []);
  return { ok: true, map: map, linked: !!ss, poCount: list.length, rows: r.rows, checks: r.checks, unmatchedProducts: r.unmatchedProducts,
    unmatchedShips: r.unmatchedShips, rounds: cpRounds_(cpCase_(r.rows.filter(function (x) { return x.state !== 'dup'; }))),
    totals: list.reduce(function (t, p) { ['sub', 'vat', 'net'].forEach(function (k) { t[k] += Number(p.totals[k]) || 0; }); return t; }, { sub: 0, vat: 0, net: 0 }) };
}
function cpSave(token, pos, fileName) {
  var dept = requireAcc_(token); cpRegister_();
  var list = cpCleanPos_(pos);
  return purLocked_(function () {
    var main = purBook_(dept), map = cpMap_(main), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต "ตารางส่งสินค้า CP Ram"' };
    var savedList = purRead_(ss, 'cp_lines'), byId = {};
    savedList.forEach(function (x) { byId[x.id] = x; });
    var r = cpPrepare_(map, list, savedList);
    if (r.unmatchedProducts.length || r.unmatchedShips.length) return { ok: false, error: 'ยังมีสินค้า/สถานที่ส่งที่จับคู่ไม่ได้ — ใส่ให้ครบก่อนบันทึก' };
    var impId = purId_('CPI'), now = purNow_(), add = r.rows.filter(function (x) { return x.state === 'new'; }), chg = r.rows.filter(function (x) { return x.state === 'changed'; });
    if (!add.length && !chg.length) return { ok: false, error: 'ใบสั่งซื้อทุกใบมีในระบบแล้ว ไม่มีอะไรเปลี่ยน' };
    var sh = purSheet_(ss, 'cp_lines'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), months = {};
    var fields = function (x) { return { poNo: x.poNo, lineNo: x.lineNo, poDate: x.poDate, prNo: x.prNo, itemCode: x.itemCode, product: x.product, deliveryDate: x.deliveryDate,
      qty: x.qty, unit: x.unitTh, price: x.price, amount: x.amount, vat: x.vat, net: x.net, shipTo: x.shipTo, wh: x.wh, place: x.place,
      termDays: x.termDays, dueDate: x.dueDate, fileName: x.file || accClean_(fileName, 120) }; };
    if (add.length) {
      var values = add.map(function (x) {
        months[x.deliveryDate.slice(0, 7)] = 1;
        return purRowValues_(sh, 'cp_lines', Object.assign(fields(x), { id: purId_('CP'), status: '', note: '', history: '', importId: impId, createdAt: now, updatedAt: '' }), head);
      });
      sh.getRange(sh.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    }
    chg.forEach(function (x) {
      var old = byId[x.oldId]; if (!old) return;
      if (old.deliveryDate) months[String(old.deliveryDate).slice(0, 7)] = 1;
      months[x.deliveryDate.slice(0, 7)] = 1;
      var h = x.diff.map(function (d) { return d.f + ' ' + cpHistVal_(d.from) + ' → ' + cpHistVal_(d.to); }).join(', ');
      purWrite_(ss, 'cp_lines', Object.assign(old, fields(x), { history: (old.history ? old.history + ' | ' : '') + now.slice(0, 10) + ': ' + h, importId: impId, updatedAt: now }));
    });
    var qty = 0, amt = 0; add.concat(chg).forEach(function (x) { qty += x.qty; amt += x.amount; });
    purWrite_(ss, 'cp_imports', { id: impId, fileName: accClean_(fileName, 120), poCount: list.length, added: add.length, changed: chg.length,
      skipped: r.rows.length - add.length - chg.length, qty: qty, amount: cpR2_(amt), createdAt: now });
    purLogWrite_(main, 'นำเข้า PO CP Ram', 'cp_imports', impId, (fileName || '') + ' · เพิ่ม ' + add.length + ' · อัปเดต ' + chg.length);
    cpRebuildMonths_(ss, Object.keys(months));
    return { ok: true, importId: impId, added: add.length, changed: chg.length, skipped: r.rows.length - add.length - chg.length, months: Object.keys(months).sort() };
  });
}
// วันที่ของหมายเหตุ "อัพเดท" = วันที่ PO เปลี่ยนครั้งล่าสุด (จากประวัติ) หรือวันที่เพิ่ม PO เข้าระบบ (createdAt) — ผู้ใช้ขอ 24/11/69
// หมายเหตุ "อัพเดท" ในแท็บรายเดือน / PDF / Excel: วันที่ PO เปลี่ยนครั้งล่าสุด หรือวันที่นำเข้า PO (ผู้ใช้ขอ 24/11/69 — เอาออกเฉพาะภาพที่ส่ง LINE)
function cpUpd_(r) { var m = String(r.history || '').split(' | ').pop().match(/^(\d{4}-\d{2}-\d{2}):/), c = String(r.createdAt || '').replace(/^'/, '').slice(0, 10); return m ? m[1] : /^\d{4}-\d{2}-\d{2}$/.test(c) ? c : ''; }
function cpHistLast_(h) { var t = String(h).split(' | ').pop().replace(/^[\d-]+: /, ''); return /^(เลื่อนส่ง|เพิ่มจำนวน|ลดจำนวน)/.test(t) ? t : 'เปลี่ยน: ' + t; }
function cpHistVal_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? cpSlash_(v) : String(v); }
function cpSaveMap(token, json) {
  var dept = requireAcc_(token); cpRegister_();
  var cfg; try { cfg = JSON.parse(json || '{}'); } catch (e) { return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }; }
  return purLocked_(function () {
    var main = purBook_(dept), cur = cpMap_(main); cpHolInit_(main);
    // cfg.full = หน้าตั้งค่า ส่งรายการทั้งหมดมา (แทนที่ของเดิม ลบได้)
    var products = cfg.full ? [] : cur.products.slice(), ships = cfg.full ? [] : cur.ships.slice();
    (cfg.products || []).map(cpCleanProduct_).forEach(function (p) {
      if (!p.code || !p.name) return;
      var i = products.map(function (x) { return x.code; }).indexOf(p.code);
      if (i >= 0) products[i] = p; else products.push(p);
    });
    (cfg.ships || []).map(cpCleanShip_).forEach(function (s) {
      if (!s.key || !s.place) return;
      var i = ships.map(function (x) { return accNorm_(x.key); }).indexOf(accNorm_(s.key));
      if (i >= 0) ships[i] = s; else ships.push(s);
    });
    var row = cpSettingRow_(main, 'cpramMap') || { id: 'cpramMap' };
    var o = { products: products, ships: ships }; if (cfg.full || cpMapFull_(main)) o.full = 1;
    row.value = JSON.stringify(o);
    purWrite_(main, 'acc_settings', row);
    purLogWrite_(main, 'แก้การจับคู่ CP Ram', 'acc_settings', 'cpramMap', products.length + ' สินค้า · ' + ships.length + ' สถานที่ส่ง');
    return { ok: true, map: cpMap_(main) };
  });
}
// สถานะ (รอส่ง / ส่งสินค้าแล้ว / ยกเลิก) + หมายเหตุ ของรายการ
function cpUpdateLine(token, id, status, note, newDate, reason, newQty) {
  var dept = requireAcc_(token); cpRegister_();
  if (!CP_STATUS_.hasOwnProperty(String(status || ''))) return { ok: false, error: 'สถานะไม่ถูกต้อง' };
  var nd = newDate ? accDate_(newDate) : '', why = accClean_(reason, 200);
  if (newDate && !nd) return { ok: false, error: 'วันที่ส่งไม่ถูกต้อง' };
  var nq = newQty === '' || newQty == null ? '' : Math.round(Number(newQty) * 10000) / 10000;
  if (nq !== '' && !(nq > 0 && nq < 1e9)) return { ok: false, error: 'จำนวนต้องมากกว่า 0 (ถ้าไม่ส่งแล้วให้เลือก "ยกเลิก")' };
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    var row = purRead_(ss, 'cp_lines').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var now = purNow_(), old = String(row.deliveryDate || ''), move = null, months = old ? [old.slice(0, 7)] : [];
    // เลื่อนวันส่ง / เพิ่ม-ลดจำนวน → เก็บประวัติ (แท็บ ประวัติเลื่อนส่ง + ช่องประวัติของรายการ) แล้วคำนวณรอบเงินเข้าใหม่
    var dMove = nd && nd !== old, oq = Number(row.qty) || 0, qMove = nq !== '' && Math.abs(nq - oq) > 1e-9;
    if (dMove || qMove) {
      if (!why) return { ok: false, error: dMove ? 'ใส่เหตุผลที่เลื่อนส่ง' : 'ใส่เหตุผลที่เพิ่ม / ลดจำนวน' };
      var qtxt = function (q) { var c = cpCase_([Object.assign({}, row, { qty: q })])[0]; return (Math.round(c.qty * 100) / 100).toLocaleString() + ' ' + cpUnitTh_(c.unitTh || c.unit || 'ลัง'); };
      var parts = [dMove ? 'เลื่อนส่ง ' + cpSlash_(old) + ' → ' + cpSlash_(nd) : '', qMove ? (nq > oq ? 'เพิ่ม' : 'ลด') + 'จำนวน ' + qtxt(oq) + ' → ' + qtxt(nq) : ''].filter(String);
      move = { id: purId_('CPM'), lineId: row.id, poNo: String(row.poNo).replace(/^'/, ''), lineNo: row.lineNo, product: row.product, qty: qMove ? nq : oq, unit: row.unit, itemCode: row.itemCode,
        place: row.place, fromDate: old, toDate: dMove ? nd : old, fromQty: qMove ? oq : '', toQty: qMove ? nq : '', reason: why, createdAt: now, sentAt: '' };
      purWrite_(ss, 'cp_moves', move);
      row.history = (row.history ? row.history + ' | ' : '') + now.slice(0, 10) + ': ' + parts.join(' · ') + ' (' + why + ')';
      if (dMove) { row.deliveryDate = nd; row.dueDate = cpDue_(nd); months.push(nd.slice(0, 7)); }
      if (qMove) { row.qty = nq; row.amount = Math.round(nq * (Number(row.price) || 0) * 100) / 100; }
      purLogWrite_(main, dMove && !qMove ? 'เลื่อนส่ง CP Ram' : 'เปลี่ยนแปลงออเดอร์ CP Ram', 'cp_moves', move.id, 'PO ' + move.poNo + ' · ' + parts.join(' · ') + ' · ' + why);
    }
    row.status = String(status || ''); row.note = accClean_(note, 200); row.updatedAt = now;
    purWrite_(ss, 'cp_lines', row);
    cpRebuildMonths_(ss, months.filter(function (m, i) { return months.indexOf(m) === i; }));
    return { ok: true, moveId: move ? move.id : '', deliveryDate: row.deliveryDate, dueDate: row.dueDate, history: row.history, qty: row.qty, amount: row.amount };
  });
}
function cpRebuild(token, ym) {
  var dept = requireAcc_(token); cpRegister_();
  if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return { ok: false, error: 'เดือนไม่ถูกต้อง' };
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    cpRebuildMonths_(ss, [ym]);
    return { ok: true };
  });
}

// ---------- แท็บรายเดือน (หน้าตาเหมือนไฟล์ Excel "ตารางส่งสินค้า CP Ram") ----------
var CP_DAYS_ = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
function cpSlash_(iso) { var p = String(iso).split('-'); return p.length < 3 ? '' : p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2); }
function cpTabName_(ym) { var p = ym.split('-'); return 'เดือน ' + p[1] + '.' + String(+p[0] + 543).slice(2); }
function cpRebuildMonths_(ss, months) {
  var all = purRead_(ss, 'cp_lines');
  months.filter(function (m) { return /^\d{4}-\d{2}$/.test(m); }).forEach(function (ym) {
    cpBuildMonth_(ss, ym, all.filter(function (x) { return String(x.deliveryDate).slice(0, 7) === ym; }));
  });
}
function cpBuildMonth_(ss, ym, rows) {
  var name = cpTabName_(ym), sh = ss.getSheetByName(name);
  if (!rows.length) { if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh); return; }
  if (!sh) {
    // เรียงแท็บเดือนต่อจากแท็บข้อมูล ตามลำดับเดือน
    var after = ss.getSheets().filter(function (s) { return /^เดือน \d{2}\.\d{2}$/.test(s.getName()) && cpTabYm_(s.getName()) < ym; }).length;
    var data = ss.getSheets().filter(function (s) { return !/^เดือน \d{2}\.\d{2}$/.test(s.getName()); }).length;   // แท็บข้อมูล (PO / นำเข้า / ประวัติเลื่อนส่ง) อยู่หน้าสุด
    sh = ss.insertSheet(name, Math.min(ss.getSheets().length, data + after));
  }
  var p = ym.split('-');
  cpDraw_(sh, rows, 'ตารางส่งสินค้า CP Ram ' + CP_MONTHS_[+p[1] - 1] + ' ' + (+p[0] + 543), true);
}
// วาดตารางส่งสินค้าลงแท็บ (แท็บรายเดือน = มีตารางรอบเงินเข้า · ไฟล์ PDF/Excel ที่ส่ง LINE = เฉพาะออเดอร์)
function cpDraw_(sh, rows, title, withRounds) {
  sh.clear(); sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  try { sh.setHiddenGridlines(true); } catch (e) {}
  rows = cpCase_(rows);
  rows.forEach(function (r) { r.dueDate = cpDue_(r.deliveryDate) || r.dueDate; });
  rows.sort(function (a, b) { return String(a.deliveryDate).localeCompare(String(b.deliveryDate)) || String(a.poNo).localeCompare(String(b.poNo)) || a.lineNo - b.lineNo; });
  var head = ['วัน', 'วันที่', 'สินค้า', 'PO', 'คลัง', 'จำนวนสินค้า', 'หน่วย', 'Total', 'สถานที่ส่ง', 'หมายเหตุ'];
  sh.getRange('A1:J1').merge().setValue(title).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('A2:J2').merge().setValue('Update ' + cpSlash_(purToday_())).setFontSize(13).setFontWeight('bold').setFontColor('#C2410C').setHorizontalAlignment('center');
  sh.getRange(4, 1, 1, 10).setValues([head]).setFontWeight('bold').setBackground(CP_HEAD_BG_);
  var groups = [], g = null;
  rows.forEach(function (r) { if (!g || g.date !== r.deliveryDate) { g = { date: r.deliveryDate, rows: [] }; groups.push(g); } g.rows.push(r); });
  var vals = [], merges = [], row = 5, cancelRows = [], total = 0, redCells = [];
  // วันที่อัพเดทล่าสุดของตาราง → ข้อความ "อัพเดท …" ของแถวนั้นเป็นสีแดง (ผู้ใช้ขอ 24/11/69)
  var maxU = rows.reduce(function (m, r) { var u = cpUpd_(r); return u > m ? u : m; }, '');
  groups.forEach(function (gr) {
    // วันเดียวกันแต่คนละสถานที่ส่ง → แยก Total ตามสถานที่ (ผู้ใช้ขอ 24/11/69): เรียงให้สถานที่เดียวกันติดกัน แล้ว Total / สถานที่ส่ง รวมช่องทีละสถานที่
    var pl = []; gr.rows.forEach(function (r) { var k = String(r.place || ''); if (pl.indexOf(k) < 0) pl.push(k); });
    gr.rows = gr.rows.map(function (r, i) { return { r: r, i: i }; }).sort(function (x, y) { return pl.indexOf(String(x.r.place || '')) - pl.indexOf(String(y.r.place || '')) || x.i - y.i; }).map(function (x) { return x.r; });
    var n = gr.rows.length, subs = [], sg = null;
    gr.rows.forEach(function (r, i) {
      var cancel = r.status === 'cancel', upd = cpUpd_(r);
      var note = [upd ? 'อัพเดท ' + cpSlash_(upd) : '', cpPcsNote_(r), cancel ? 'ยกเลิก' : r.status === 'done' ? '*ส่งสินค้าแล้ว' : '', r.note, r.history ? cpHistLast_(r.history) : ''].filter(String).join(' · ');
      if (!sg || sg.place !== String(r.place || '')) { sg = { place: String(r.place || ''), start: i, n: 0, sum: 0 }; subs.push(sg); }
      sg.n++; if (!cancel) sg.sum += Number(r.qty) || 0;
      if (cancel) cancelRows.push(row + i);
      if (upd && upd === maxU) redCells.push({ r: row + i, text: note, len: ('อัพเดท ' + cpSlash_(upd)).length });
      if (/^[=+\-@]/.test(note)) note = "'" + note;   // กันชีตอ่านหมายเหตุเป็นสูตร (#ERROR!)
      vals.push([i ? '' : CP_DAYS_[new Date(gr.date + 'T00:00:00').getDay()], i ? '' : "'" + cpSlash_(gr.date), r.product, "'" + String(r.poNo).replace(/^'/, ''), String(r.wh || '-').replace(/^'/, ''), Number(r.qty) || 0,
        r.unit || 'ลัง', '', r.place, note]);
    });
    var base = vals.length - n;
    subs.forEach(function (x) {
      total += x.sum;
      vals[base + x.start][7] = x.sum;
      for (var k = 1; k < x.n; k++) vals[base + x.start + k][8] = '';
      if (x.n > 1) ['H', 'I'].forEach(function (c) { merges.push(c + (row + x.start) + ':' + c + (row + x.start + x.n - 1)); });
    });
    if (n > 1) {
      ['A', 'B'].forEach(function (c) { merges.push(c + row + ':' + c + (row + n - 1)); });
      var same = gr.rows.every(function (r) { return String(r.product) === String(gr.rows[0].product); });   // สินค้า: รวมช่องเมื่อเหมือนกันทั้งวัน
      if (same) { merges.push('C' + row + ':C' + (row + n - 1)); for (var k = 1; k < n; k++) vals[base + k][2] = ''; }
    }
    row += n;
  });
  var last = row - 1;
  sh.getRange(5, 1, vals.length, 10).setValues(vals);
  merges.forEach(function (a) { sh.getRange(a).merge(); });
  sh.getRange(5, 8, vals.length, 1).setFontWeight('bold');
  cancelRows.forEach(function (r) { sh.getRange(r, 1, 1, 10).setFontColor('#9ca3af'); sh.getRange(r, 6).setFontLine('line-through'); });
  sh.getRange(4, 1, last - 3, 10).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(5, 10, vals.length, 1).setFontSize(11).setWrap(true);
  sh.getRange(5, 3, vals.length, 1).setWrap(true);   // ชื่อสินค้ายาว (เช่น พริกผัดน้ำมันมะกอกอัลมอนด์ 15g.) ขึ้นบรรทัดใหม่ ไม่โดนตัด
  var red = SpreadsheetApp.newTextStyle().setForegroundColor('#DC2626').setBold(true).build();
  redCells.forEach(function (c) { try { sh.getRange(c.r, 10).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(c.text).setTextStyle(0, c.len, red).build()); } catch (e) {} });
  var tr = last + 2;
  sh.getRange(tr, 5, 1, 3).setValues([['Total', total, cpUnitOf_(rows.filter(function (r) { return r.status !== 'cancel'; }))]]).setFontWeight('bold').setBackground(CP_TOTAL_BG_).setHorizontalAlignment('center');
  sh.getRange(tr + 3, 10).setValue('ผู้จัดทำ            __________________');
  sh.getRange(tr + 4, 10).setValue('ผู้ตรวจสอบ    ___________________');
  var rt = tr;
  if (withRounds) {
  // ตารางรอบเงินเข้า (M:R)
  var rounds = cpRounds_(rows);
  sh.getRange(5, 13, 1, 6).setValues([['รอบเงินเข้า', 'จำนวน', 'ราคา', 'ยอดเงิน', 'Vat 7%', 'Total']]).setFontWeight('bold').setBackground(CP_HEAD_BG_).setHorizontalAlignment('center');
  if (rounds.length) {
    sh.getRange(6, 13, rounds.length, 6).setValues(rounds.map(function (x) { return ["'" + cpSlash_(x.dueDate), x.qty, x.price, x.amount, x.vat, x.total]; }));
    sh.getRange(6, 15, rounds.length, 4).setNumberFormat('#,##0.00');
    sh.getRange(6, 14, rounds.length, 1).setNumberFormat('#,##0');
  }
  rt = 6 + rounds.length;
  sh.getRange(rt, 17, 1, 2).setValues([['รวม', cpR2_(rounds.reduce(function (s, x) { return s + x.total; }, 0))]]).setFontWeight('bold').setBackground(CP_TOTAL_BG_);
  sh.getRange(rt, 18).setNumberFormat('#,##0.00');
  sh.getRange(5, 13, rounds.length + 1, 6).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }
  sh.getRange(1, 1, Math.max(tr + 4, rt), 18).setFontFamily('Sarabun');
  [70, 80, 200, 100, 80, 95, 50, 65, 100, 210, 20, 20, 95, 70, 70, 100, 90, 110].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(4);
}
function cpTabYm_(name) { var m = name.match(/(\d{2})\.(\d{2})$/); return m ? (2000 + +m[2] - 43) + '-' + m[1] : ''; }

// ---------- LINE: ใบแจ้งออเดอร์ CP Ram (เฉพาะออเดอร์ — ไม่ส่งยอดเงิน / รอบเงินเข้า) ----------
// ส่งรายการของการนำเข้าครั้งนั้น (ใหม่ + PO เดิมที่เปลี่ยน) เข้ากลุ่ม LINE เดียวกับรายงาน 7-11 (ACC_LINE_TOKEN / ACC_LINE_GROUP)
function cpFlex_(lines, hasImg, files) {
  var T = function (text, o) { var x = { type: 'text', text: String(text), wrap: true }; Object.keys(o || {}).forEach(function (k) { x[k] = o[k]; }); return x; };
  var row = function (label, value, o) { return { type: 'box', layout: 'horizontal', margin: 'md', contents: [T(label, { size: 'sm', color: '#64748B', flex: 5 }), T(value, Object.assign({ size: 'sm', weight: 'bold', color: '#0F172A', flex: 6, align: 'end' }, o || {}))] }; };
  lines = cpCase_(lines);
  var live = lines.filter(function (x) { return x.status !== 'cancel'; });
  var pos = {}, dates = {}, poDates = {}, total = 0;
  live.forEach(function (x) { pos[x.poNo] = 1; dates[x.deliveryDate] = 1; if (x.poDate) poDates[x.poDate] = 1; total += Number(x.qty) || 0; });
  total = Math.round(total * 100) / 100;
  var dl = Object.keys(dates).sort(), pd = Object.keys(poDates).sort();
  var body = [row('วันที่ใบสั่งซื้อ', accDotRange_(pd)), row('ลูกค้า', 'CPRAM (ซีพีแรม)'), row('วันที่ส่งสินค้า', accDotRange_(dl)), row('ใบสั่งซื้อ', Object.keys(pos).length + ' ใบ')];
  // สรุปจำนวน ไม่แยกตาม PO (ผู้ใช้ขอ 23/11/69 — การ์ดเดิมยาวเกินและเกิน 30 KB) · รายละเอียดแต่ละ PO อยู่ในภาพตาราง / PDF / Excel
  var byP = {}, places = {}, nCancel = 0, nChg = 0;
  lines.forEach(function (x) {
    if (x.status === 'cancel') { nCancel++; return; }
    if (x._changed) nChg++;
    var k = x.product || ('รหัส ' + x.itemCode), o = byP[k] = byP[k] || { qty: 0, unit: x.unit || 'ลัง', pcs: 0, pcsUnit: x.pcsUnit || '' };
    o.qty += Number(x.qty) || 0; if (x.pcs) o.pcs += x.pcs;
    var pl = [x.wh && x.wh !== '-' ? 'คลัง' + x.wh : '', x.place].filter(String).join(' · '); if (pl) places[pl] = 1;
  });
  var qtyTxt = function (o) { return (Math.round(o.qty * 100) / 100).toLocaleString() + ' ' + o.unit + (o.pcs ? ' (' + o.pcs.toLocaleString() + ' ' + o.pcsUnit + ')' : ''); };
  var pk = Object.keys(byP);
  if (pk.length === 1) { body.push(row('สินค้า', pk[0])); body.push(row('จำนวน', qtyTxt(byP[pk[0]]))); }
  else pk.forEach(function (k) { body.push(row(k, qtyTxt(byP[k]))); });
  if (Object.keys(places).length) body.push(row('สถานที่ส่ง', Object.keys(places).join(', ')));
  // หมายเหตุ: วันที่เพิ่ม / อัพเดท PO ของรายการที่ส่ง (เหมือนช่องหมายเหตุในตาราง — ผู้ใช้ขอ 24/11/69)
  body.push(row('หมายเหตุ', 'Update ' + accDot_(purToday_()), { color: '#C2410C' }));
  if (nChg || nCancel) body.push(T([nChg ? '⚠ มี PO เปลี่ยนแปลง ' + nChg + ' รายการ' : '', nCancel ? 'ยกเลิก ' + nCancel + ' รายการ' : ''].filter(String).join(' · ') + ' — ดูในภาพตาราง', { size: 'xs', color: '#C2410C', weight: 'bold', margin: 'md' }));
  body.push({ type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: '#ECFDF5', cornerRadius: '16px', paddingAll: '14px', borderColor: '#A7F3D0', borderWidth: '1px', contents: [
    T('สินค้าจำนวนรวม', { size: 'sm', color: '#047857', align: 'center' }), T(total.toLocaleString() + ' ' + cpUnitOf_(live), { size: '3xl', weight: 'bold', color: '#047857', align: 'center' })] });
  if (hasImg) body.push(T('📊 ตารางส่งสินค้าแยก PO อยู่ในข้อความถัดไป (กดที่ภาพเพื่อเปิดภาพเต็ม)', { size: 'xxs', color: '#64748B', margin: 'md', align: 'center' }));
  if (files && files.pdfUrl) body.push({ type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: '#0F5132', cornerRadius: '24px', paddingAll: '12px',
    action: { type: 'uri', label: 'เปิดไฟล์ PDF', uri: files.pdfUrl }, contents: [T('เปิดไฟล์ PDF', { size: 'md', weight: 'bold', color: '#FFFFFF', align: 'center' })] });
  if (files && files.xlsxUrl) body.push({ type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#FFFFFF', borderColor: '#0F5132', borderWidth: '2px', cornerRadius: '24px', paddingAll: '11px',
    action: { type: 'uri', label: 'ดาวน์โหลด Excel', uri: accXlsxDownload_(files.xlsxUrl, true) }, contents: [T('ดาวน์โหลดไฟล์ Excel', { size: 'md', weight: 'bold', color: '#0F5132', align: 'center' })] });
  var inner = [
    { type: 'box', layout: 'vertical', backgroundColor: '#0F5132', cornerRadius: '18px', paddingAll: '18px', contents: [
      T('ORDER CONFIRMATION · CP RAM', { size: 'xxs', color: '#A7F3D0', weight: 'bold' }),
      T('ใบแจ้งออเดอร์ CP Ram', { size: 'xl', color: '#FFFFFF', weight: 'bold', margin: 'sm' }),
      T('บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายบัญชี', { size: 'xs', color: '#D1FAE5', margin: 'xs' })] },
    { type: 'box', layout: 'vertical', paddingStart: '6px', paddingEnd: '6px', paddingTop: '6px', paddingBottom: '4px', contents: body }];
  var bubbleOf = function () { return { type: 'bubble', size: 'giga', body: { type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: '#FFFFFF', contents: [inner[0], { type: 'box', layout: 'vertical', paddingStart: '6px', paddingEnd: '6px', paddingTop: '6px', paddingBottom: '4px', contents: body }] } }; };
  return { type: 'flex', altText: 'ออเดอร์ CP Ram · ' + Object.keys(pos).length + ' ใบสั่ง · ส่ง ' + accDotRange_(dl) + ' · รวม ' + total.toLocaleString() + ' ' + cpUnitOf_(live),
    contents: bubbleOf() };
}
function cpImportLines_(ss, imp) {
  var lines = purRead_(ss, 'cp_lines').filter(function (x) { return x.importId === imp.id; });
  lines.forEach(function (x) { Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); x._changed = !!x.history && String(x.updatedAt || '') >= String(imp.createdAt || ''); });
  return lines;
}
// ภาพตารางส่งสินค้า (หน้าเว็บสร้างด้วย html2canvas) → PNG สาธารณะในโฟลเดอร์ฝ่าย / "รายงาน CP Ram"
function cpFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายบัญชี');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รายงาน CP Ram');
  return it.hasNext() ? it.next() : parent.createFolder('รายงาน CP Ram');
}
// ไฟล์ PDF + Excel (+ Google Sheet ต้นทาง) ของตารางส่งสินค้า — withRounds = ใส่ตารางรอบเงินเข้า (ใช้ในระบบเท่านั้น ไม่ใช้กับ LINE)
function cpMakeFiles_(dept, rows, title, name, withRounds) {
  var folder = cpFolder_(dept), ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  var sh = ss.getSheets()[0]; sh.setName('ตารางส่งสินค้า');
  cpDraw_(sh, rows.map(function (r) { return Object.assign({}, r); }), title, withRounds);
  // หลายหน้า: ตรึงแถวหัว (ชื่อตาราง + หัวคอลัมน์ แถว 1–4) → PDF พิมพ์หัวคอลัมน์ซ้ำทุกหน้า (fzr) — ผู้ใช้ขอ 23/11/69
  var onePage = rows.length <= 28;
  sh.setFrozenRows(onePage ? 0 : 4);
  SpreadsheetApp.flush();
  var pdf = accExportPdf_(ss, folder, name, onePage), xlsx = accExportXlsx_(ss, folder, name, 4);
  return { pdfUrl: pdf.getUrl(), xlsxUrl: xlsx.getUrl(), xlsxDownload: accXlsxDownload_(xlsx.getUrl()), sheetUrl: ss.getUrl() };
}
function cpTrash_(urls) { urls.forEach(function (u) { var id = String(u || '').match(/[-\w]{25,}/); if (id) try { DriveApp.getFileById(id[0]).setTrashed(true); } catch (e) {} }); }
function cpImportFiles_(dept, ss, imp, lines) {
  cpTrash_([imp.pdfUrl, imp.xlsxUrl, imp.sheetUrl]);
  var dates = lines.map(function (x) { return x.deliveryDate; }).filter(String).sort();
  var rng = dates.length ? cpSlash_(dates[0]) + (dates[dates.length - 1] !== dates[0] ? ' – ' + cpSlash_(dates[dates.length - 1]) : '') : '';
  var f = cpMakeFiles_(dept, lines, 'ใบแจ้งออเดอร์ CP Ram · ส่ง ' + rng, 'ออเดอร์ CP Ram ส่ง ' + rng.replace(/\//g, '-') + ' (' + imp.id.slice(-4) + ')', false);
  imp.pdfUrl = f.pdfUrl; imp.xlsxUrl = f.xlsxUrl; imp.sheetUrl = f.sheetUrl;
  purWrite_(ss, 'cp_imports', imp);
  return f;
}
// API: สร้าง / สร้างใหม่ ไฟล์ของการนำเข้า (หน้าเว็บ)
function cpMakeImportFiles(token, importId) {
  var dept = requireAcc_(token); cpRegister_();
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    var imp = purRead_(ss, 'cp_imports').filter(function (x) { return x.id === importId; })[0];
    if (!imp) return { ok: false, error: 'ไม่พบการนำเข้านี้' };
    var lines = cpImportLines_(ss, imp);
    if (!lines.length) return { ok: false, error: 'การนำเข้านี้ไม่มีรายการ' };
    var f = cpImportFiles_(dept, ss, imp, lines);
    return { ok: true, pdfUrl: f.pdfUrl, xlsxUrl: f.xlsxUrl, xlsxDownload: f.xlsxDownload };
  });
}
// API: ไฟล์ของทั้งเดือน (มีตารางรอบเงินเข้า เหมือนแท็บเดือน) — สร้างใหม่ทุกครั้ง ไฟล์เดือนเดียวกันรอบก่อนลงถังขยะ
function cpMonthFiles(token, ym) {
  var dept = requireAcc_(token); cpRegister_();
  if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return { ok: false, error: 'เดือนไม่ถูกต้อง' };
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    var rows = purRead_(ss, 'cp_lines').filter(function (x) { return String(x.deliveryDate).slice(0, 7) === ym; });
    rows.forEach(function (x) { Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); });
    if (!rows.length) return { ok: false, error: 'เดือนนี้ไม่มีรายการ' };
    var key = 'cpramFiles_' + ym, row = cpSettingRow_(main, key) || { id: key }, old = {};
    try { old = JSON.parse(row.value || '{}'); } catch (e) {}
    cpTrash_([old.pdfUrl, old.xlsxUrl, old.sheetUrl]);
    try { cpRebuildMonths_(ss, [ym]); } catch (e) {}   // แท็บเดือนในชีตสร้างใหม่ด้วย (แก้ #ERROR! ในหมายเหตุของแท็บเดิม)
    var p = ym.split('-'), f = cpMakeFiles_(dept, rows, 'ตารางส่งสินค้า CP Ram ' + CP_MONTHS_[+p[1] - 1] + ' ' + (+p[0] + 543), 'ตารางส่งสินค้า CP Ram ' + cpTabName_(ym), true);
    row.value = JSON.stringify({ pdfUrl: f.pdfUrl, xlsxUrl: f.xlsxUrl, sheetUrl: f.sheetUrl });
    purWrite_(main, 'acc_settings', row);
    return { ok: true, pdfUrl: f.pdfUrl, xlsxUrl: f.xlsxUrl, xlsxDownload: f.xlsxDownload };
  });
}
function cpSaveImage_(dept, imp, png) {
  if (!png || typeof png !== 'string' || png.length > 6000000 || !/^[A-Za-z0-9+\/=]+$/.test(png)) return '';
  var folderId = deptConfig_(dept.key).folderId; if (!folderId) return '';
  var old = String(imp.imgUrl || '').match(/[-\w]{25,}/);
  if (old) try { DriveApp.getFileById(old[0]).setTrashed(true); } catch (e) {}
  var f = cpFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(png), 'image/png', 'ตารางส่งสินค้า CP Ram ' + imp.id + '.png'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + f.getId();
}
function cpSendLine(token, importId, png, ratio) {
  var dept = requireAcc_(token); cpRegister_();
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    var imp = purRead_(ss, 'cp_imports').filter(function (x) { return x.id === importId; })[0];
    if (!imp) return { ok: false, error: 'ไม่พบการนำเข้านี้' };
    var lines = cpImportLines_(ss, imp);
    if (!lines.length) return { ok: false, error: 'การนำเข้านี้ไม่มีรายการ (อาจถูกนำเข้าซ้ำภายหลังแล้ว — ส่งจากการนำเข้าครั้งล่าสุดแทน)' };
    var img = '';
    try { img = cpSaveImage_(dept, imp, png); } catch (e) { img = ''; }
    if (img) imp.imgUrl = img;
    var files = null;
    try { files = cpImportFiles_(dept, ss, imp, lines); } catch (e) { files = null; }
    var msgs = [cpFlex_(lines, !!img, files)];
    if (img) msgs.push({ type: 'flex', altText: 'ตารางส่งสินค้า CP Ram', contents: { type: 'bubble', size: 'giga', hero: { type: 'image', url: img, size: 'full',
      aspectRatio: /^\d{2,5}:\d{2,5}$/.test(String(ratio)) ? String(ratio) : '20:9', aspectMode: 'fit', backgroundColor: '#FFFFFF', action: { type: 'uri', uri: img } } } });
    var r = accLinePush_(msgs);
    if (!r.ok) return r;
    imp.sentAt = purNow_();
    purWrite_(ss, 'cp_imports', imp);
    purLogWrite_(main, 'ส่ง LINE ออเดอร์ CP Ram', 'cp_imports', importId, lines.length + ' รายการ');
    return { ok: true, sentAt: imp.sentAt, pdfUrl: imp.pdfUrl, xlsxUrl: imp.xlsxUrl };
  });
}

// ---------- LINE: แจ้งเลื่อนส่ง (เฉพาะออเดอร์ ไม่มียอดเงิน) ----------
function cpMoveFlex_(mv, hasImg) {
  var T = function (text, o) { var x = { type: 'text', text: String(text), wrap: true }; Object.keys(o || {}).forEach(function (k) { x[k] = o[k]; }); return x; };
  var row = function (label, value, o) { return { type: 'box', layout: 'horizontal', margin: 'md', contents: [T(label, { size: 'sm', color: '#64748B', flex: 4 }), T(value, Object.assign({ size: 'sm', weight: 'bold', color: '#0F172A', flex: 7, align: 'end' }, o || {}))] }; };
  var day = function (iso) { return 'วัน' + accDayName_(iso) + ' ' + accDot_(iso); };
  var qtxt = function (q) { var c = cpCase_([Object.assign({}, mv, { qty: q })])[0]; return (Math.round((Number(c.qty) || 0) * 100) / 100).toLocaleString() + ' ' + cpUnitTh_(c.unitTh || c.unit || 'ลัง') + (c.pcs ? ' (' + c.pcs.toLocaleString() + ' ' + c.pcsUnit + ')' : ''); };
  // เลื่อนวันส่ง และ / หรือ เพิ่ม-ลดจำนวน (ผู้ใช้ขอ 24/11/69)
  var dMove = mv.toDate && mv.fromDate && mv.toDate !== mv.fromDate, qMove = mv.toQty !== '' && mv.toQty != null && mv.fromQty !== '' && mv.fromQty != null && Number(mv.toQty) !== Number(mv.fromQty);
  var up = qMove && Number(mv.toQty) > Number(mv.fromQty);
  var title = dMove && qMove ? 'แจ้งเลื่อนส่ง / เปลี่ยนจำนวน CP Ram' : qMove ? (up ? 'แจ้งเพิ่มจำนวนสินค้า CP Ram' : 'แจ้งลดจำนวนสินค้า CP Ram') : 'แจ้งเลื่อนส่งสินค้า CP Ram';
  var kick = dMove && qMove ? 'ORDER CHANGED · CP RAM' : qMove ? 'QUANTITY CHANGED · CP RAM' : 'DELIVERY RESCHEDULED · CP RAM';
  var body = [row('ลูกค้า', 'CPRAM (ซีพีแรม)'), row('ใบสั่งซื้อ (PO)', mv.poNo), row('สินค้า', mv.product || '-')];
  if (!qMove) body.push(row('จำนวน', qtxt(mv.qty)));
  if (!dMove) body.push(row('วันที่ส่ง', day(mv.toDate || mv.fromDate)));
  if (mv.place) body.push(row('สถานที่ส่ง', mv.place));
  body.push(row('หมายเหตุ', 'Update ' + accDot_(purToday_()), { color: '#C2410C' }));
  var pair = function (l1, v1, l2, v2) { return [
    { type: 'box', layout: 'horizontal', contents: [T(l1, { size: 'sm', color: '#9A3412', flex: 4 }), T(v1, { size: 'sm', color: '#94A3B8', decoration: 'line-through', flex: 7, align: 'end' })] },
    { type: 'box', layout: 'horizontal', margin: 'md', contents: [T(l2, { size: 'md', color: '#9A3412', weight: 'bold', flex: 4 }), T(v2, { size: 'lg', color: '#C2410C', weight: 'bold', flex: 7, align: 'end' })] }]; };
  var box = [];
  if (dMove) box = box.concat(pair('วันส่งเดิม', day(mv.fromDate), 'เลื่อนเป็น', day(mv.toDate)));
  if (qMove) {
    if (box.length) box.push({ type: 'separator', margin: 'lg', color: '#FED7AA' });
    box = box.concat(pair('จำนวนเดิม', qtxt(mv.fromQty), up ? 'เพิ่มเป็น' : 'ลดเป็น', qtxt(mv.toQty)));
    box[box.length - 1].margin = 'md';
    if (dMove) box[box.length - 2].margin = 'lg';
  }
  body.push({ type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: '#FFF7ED', cornerRadius: '16px', paddingAll: '14px', borderColor: '#FDBA74', borderWidth: '1px', contents: box });
  if (mv.reason) body.push(T('เหตุผล: ' + mv.reason, { size: 'sm', color: '#334155', margin: 'lg' }));
  if (hasImg) body.push(T('📊 ตารางส่งสินค้าทั้งเดือน ' + CP_MONTHS_[+String(mv.toDate || mv.fromDate).slice(5, 7) - 1] + ' (หลังเปลี่ยน) อยู่ในภาพถัดไป', { size: 'xs', color: '#64748B', margin: 'lg' }));
  var inner = [
    { type: 'box', layout: 'vertical', backgroundColor: '#C2410C', cornerRadius: '18px', paddingAll: '18px', contents: [
      T(kick, { size: 'xxs', color: '#FED7AA', weight: 'bold' }),
      T(title, { size: 'xl', color: '#FFFFFF', weight: 'bold', margin: 'sm' }),
      T('บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายบัญชี', { size: 'xs', color: '#FFEDD5', margin: 'xs' })] },
    { type: 'box', layout: 'vertical', paddingStart: '6px', paddingEnd: '6px', paddingTop: '6px', paddingBottom: '4px', contents: body }];
  var alt = [dMove ? accDot_(mv.fromDate) + ' → ' + accDot_(mv.toDate) : '', qMove ? 'จำนวน ' + qtxt(mv.fromQty) + ' → ' + qtxt(mv.toQty) : ''].filter(String).join(' · ');
  return { type: 'flex', altText: title.replace(' CP Ram', '') + ' CP Ram · PO ' + mv.poNo + ' · ' + alt,
    contents: { type: 'bubble', size: 'giga', body: { type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: '#FFFFFF', contents: inner } } };
}
function cpSendMoveLine(token, moveId, png, ratio) {
  var dept = requireAcc_(token); cpRegister_();
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    var mv = purRead_(ss, 'cp_moves').filter(function (x) { return x.id === moveId; })[0];
    if (!mv) return { ok: false, error: 'ไม่พบประวัติการเลื่อนส่งนี้' };
    Object.keys(mv).forEach(function (k) { if (typeof mv[k] === 'string') mv[k] = mv[k].replace(/^'/, ''); });
    // ภาพตารางทั้งเดือนที่เลื่อนไป (ผู้ใช้ขอ 24/11/69) — สร้างในหน้าเว็บ เก็บเป็น PNG สาธารณะในโฟลเดอร์ "รายงาน CP Ram"
    var img = '';
    try { img = cpSaveImage_(dept, { id: 'เลื่อนส่ง ' + moveId, imgUrl: mv.imgUrl }, png); } catch (e) { img = ''; }
    if (img) mv.imgUrl = img;
    var msgs = [cpMoveFlex_(mv, !!img)];
    if (img) msgs.push({ type: 'flex', altText: 'ตารางส่งสินค้า CP Ram (หลังเลื่อนส่ง)', contents: { type: 'bubble', size: 'giga', hero: { type: 'image', url: img, size: 'full',
      aspectRatio: /^\d{2,5}:\d{2,5}$/.test(String(ratio)) ? String(ratio) : '20:9', aspectMode: 'fit', backgroundColor: '#FFFFFF', action: { type: 'uri', uri: img } } } });
    var r = accLinePush_(msgs);
    if (!r.ok) return r;
    mv.sentAt = purNow_();
    purWrite_(ss, 'cp_moves', mv);
    purLogWrite_(main, 'ส่ง LINE แจ้งเลื่อนส่ง CP Ram', 'cp_moves', moveId, 'PO ' + mv.poNo);
    return { ok: true, sentAt: mv.sentAt };
  });
}
