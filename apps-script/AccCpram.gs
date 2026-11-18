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
    ['history', 'ประวัติการเปลี่ยนแปลง'], ['fileName', 'ไฟล์'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขเมื่อ']] },
  cp_imports: { tab: 'นำเข้า PO', cols: [
    ['id', 'รหัส'], ['fileName', 'ชื่อไฟล์'], ['poCount', 'จำนวนใบสั่ง'], ['added', 'เพิ่มใหม่'], ['changed', 'อัปเดต'], ['skipped', 'ข้าม (มีแล้ว)'],
    ['qty', 'รวมจำนวน'], ['amount', 'มูลค่ารวม (ไม่รวม VAT)'], ['createdAt', 'นำเข้าเมื่อ']] }
};
var CP_PRODUCTS_DEFAULT_ = [{ code: '72400524', name: 'น้ำพริกหนังไก่กรอบ' }];
var CP_SHIPS_DEFAULT_ = [{ key: 'WD01 LLKC', wh: '-', place: 'ลาดหลุมแก้ว' }];
var CP_STATUS_ = { '': 'รอส่ง', done: 'ส่งสินค้าแล้ว', cancel: 'ยกเลิก' };
var CP_MONTHS_ = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var CP_HEAD_BG_ = '#C6E0B4', CP_TOTAL_BG_ = '#FFFF00';

// รอบเงินเข้าแบบเดียวกับ CP ALL (accDueDate_): ส่งวันที่ 1–15 → วันที่ 10 เดือนถัดไป · 16–31 → วันที่ 25 · ตรงเสาร์-อาทิตย์/วันหยุดราชการ → วันทำการถัดไป
// วันหยุดใช้ชุดเดียวกับ 7-11 (ปฏิทินวันหยุดไทย + วันหยุดที่ตั้งเพิ่มในหน้าตั้งค่า) · คำนวณใหม่ทุกครั้งที่โหลด/สร้างแท็บเดือน
var CP_HOL_ = null;
function cpHolInit_(main) { try { CP_HOL_ = accHolidaySet_(accMap_(main)); } catch (e) { CP_HOL_ = {}; } }
function cpDue_(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? accDueDate_(String(iso), CP_HOL_ || {}) : ''; }
function cpRegister_() {
  accRegister_();
  Object.keys(CP_TABLES_).forEach(function (k) { PUR_TABLES_[k] = CP_TABLES_[k]; });
  ['poDate', 'deliveryDate', 'dueDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['lineNo', 'qty', 'price', 'amount', 'vat', 'net', 'termDays', 'poCount', 'added', 'changed', 'skipped'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function cpSettingRow_(ss, id) { return purRead_(ss, 'acc_settings').filter(function (x) { return x.id === id; })[0]; }
function cpMap_(ss) {
  var row = cpSettingRow_(ss, 'cpramMap'), saved = {};
  try { saved = row ? JSON.parse(row.value || '{}') : {}; } catch (e) { saved = {}; }
  var products = (Array.isArray(saved.products) ? saved.products : []).map(cpCleanProduct_).filter(function (p) { return p.code && p.name; });
  CP_PRODUCTS_DEFAULT_.forEach(function (d) { if (!products.some(function (p) { return p.code === d.code; })) products.push(d); });
  var ships = (Array.isArray(saved.ships) ? saved.ships : []).map(cpCleanShip_).filter(function (s) { return s.key && s.place; });
  CP_SHIPS_DEFAULT_.forEach(function (d) { if (!ships.some(function (s) { return accNorm_(s.key) === accNorm_(d.key); })) ships.push(d); });
  return { products: products, ships: ships };
}
function cpCleanProduct_(p) { return { code: accClean_(p && p.code, 20).replace(/\D/g, ''), name: accClean_(p && p.name, 80) }; }
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
function cpMatchShip_(map, shipTo) {
  var t = accNorm_(shipTo);
  return map.ships.filter(function (s) { return t.indexOf(accNorm_(s.key)) >= 0; })[0] || null;
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
function cpUnitTh_(u) { return { CAS: 'ลัง', CTN: 'ลัง', CT: 'ลัง', PAC: 'แพ็ค', PCS: 'ชิ้น', EA: 'ชิ้น' }[String(u).toUpperCase()] || u; }

// จัดรายการ + ตรวจกับของเดิม
function cpPrepare_(map, pos, savedList) {
  var saved = {}; savedList.forEach(function (x) { saved[cpKey_(x)] = x; });
  var rows = [], unProd = {}, unShip = {}, checks = [], seen = {};
  pos.forEach(function (p) {
    var ship = cpMatchShip_(map, p.shipTo), sum = 0;
    if (!ship) { unShip[p.shipTo] = unShip[p.shipTo] || { shipTo: p.shipTo, pos: [] }; unShip[p.shipTo].pos.push(p.poNo); }
    p.lines.forEach(function (l) {
      var product = cpMatchProduct_(map, l.itemCode);
      if (!product) { unProd[l.itemCode] = unProd[l.itemCode] || { itemCode: l.itemCode, qty: 0 }; unProd[l.itemCode].qty += l.qty; }
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
        if (String(old.itemCode) !== r.itemCode) diff.push({ f: 'รหัสสินค้า', from: old.itemCode, to: r.itemCode });
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
  var lines = [], imports = [];
  if (ss) {
    lines = purRead_(ss, 'cp_lines').map(function (x) { delete x._row; Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); x.dueDate = cpDue_(x.deliveryDate) || x.dueDate; return x; });
    imports = purRead_(ss, 'cp_imports').sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 30);
  }
  return { ok: true, today: purToday_(), linked: !!ss, sheetUrl: ss ? ss.getUrl() : '', sheetName: ss ? ss.getName() : '', error: err,
    map: map, lines: lines, imports: imports, rounds: cpRounds_(lines) };
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
    unmatchedShips: r.unmatchedShips, rounds: cpRounds_(r.rows.filter(function (x) { return x.state !== 'dup'; })),
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
    var now = purNow_(), add = r.rows.filter(function (x) { return x.state === 'new'; }), chg = r.rows.filter(function (x) { return x.state === 'changed'; });
    if (!add.length && !chg.length) return { ok: false, error: 'ใบสั่งซื้อทุกใบมีในระบบแล้ว ไม่มีอะไรเปลี่ยน' };
    var sh = purSheet_(ss, 'cp_lines'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), months = {};
    var fields = function (x) { return { poNo: x.poNo, lineNo: x.lineNo, poDate: x.poDate, prNo: x.prNo, itemCode: x.itemCode, product: x.product, deliveryDate: x.deliveryDate,
      qty: x.qty, unit: x.unitTh, price: x.price, amount: x.amount, vat: x.vat, net: x.net, shipTo: x.shipTo, wh: x.wh, place: x.place,
      termDays: x.termDays, dueDate: x.dueDate, fileName: x.file || accClean_(fileName, 120) }; };
    if (add.length) {
      var values = add.map(function (x) {
        months[x.deliveryDate.slice(0, 7)] = 1;
        return purRowValues_(sh, 'cp_lines', Object.assign(fields(x), { id: purId_('CP'), status: '', note: '', history: '', createdAt: now, updatedAt: '' }), head);
      });
      sh.getRange(sh.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    }
    chg.forEach(function (x) {
      var old = byId[x.oldId]; if (!old) return;
      if (old.deliveryDate) months[String(old.deliveryDate).slice(0, 7)] = 1;
      months[x.deliveryDate.slice(0, 7)] = 1;
      var h = x.diff.map(function (d) { return d.f + ' ' + cpHistVal_(d.from) + ' → ' + cpHistVal_(d.to); }).join(', ');
      purWrite_(ss, 'cp_lines', Object.assign(old, fields(x), { history: (old.history ? old.history + ' | ' : '') + now.slice(0, 10) + ': ' + h, updatedAt: now }));
    });
    var qty = 0, amt = 0; add.concat(chg).forEach(function (x) { qty += x.qty; amt += x.amount; });
    var impId = purId_('CPI');
    purWrite_(ss, 'cp_imports', { id: impId, fileName: accClean_(fileName, 120), poCount: list.length, added: add.length, changed: chg.length,
      skipped: r.rows.length - add.length - chg.length, qty: qty, amount: cpR2_(amt), createdAt: now });
    purLogWrite_(main, 'นำเข้า PO CP Ram', 'cp_imports', impId, (fileName || '') + ' · เพิ่ม ' + add.length + ' · อัปเดต ' + chg.length);
    cpRebuildMonths_(ss, Object.keys(months));
    return { ok: true, added: add.length, changed: chg.length, skipped: r.rows.length - add.length - chg.length, months: Object.keys(months).sort() };
  });
}
function cpHistVal_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? cpSlash_(v) : String(v); }
function cpSaveMap(token, json) {
  var dept = requireAcc_(token); cpRegister_();
  var cfg; try { cfg = JSON.parse(json || '{}'); } catch (e) { return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }; }
  return purLocked_(function () {
    var main = purBook_(dept), cur = cpMap_(main); cpHolInit_(main);
    var products = cur.products.slice(), ships = cur.ships.slice();
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
    row.value = JSON.stringify({ products: products, ships: ships });
    purWrite_(main, 'acc_settings', row);
    purLogWrite_(main, 'แก้การจับคู่ CP Ram', 'acc_settings', 'cpramMap', products.length + ' สินค้า · ' + ships.length + ' สถานที่ส่ง');
    return { ok: true, map: cpMap_(main) };
  });
}
// สถานะ (รอส่ง / ส่งสินค้าแล้ว / ยกเลิก) + หมายเหตุ ของรายการ
function cpUpdateLine(token, id, status, note) {
  var dept = requireAcc_(token); cpRegister_();
  if (!CP_STATUS_.hasOwnProperty(String(status || ''))) return { ok: false, error: 'สถานะไม่ถูกต้อง' };
  return purLocked_(function () {
    var main = purBook_(dept), ss = cpBook_(main); cpHolInit_(main);
    if (!ss) return { ok: false, error: 'ยังไม่ได้เชื่อมชีต CP Ram' };
    var row = purRead_(ss, 'cp_lines').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    row.status = String(status || ''); row.note = accClean_(note, 200); row.updatedAt = purNow_();
    purWrite_(ss, 'cp_lines', row);
    if (row.deliveryDate) cpRebuildMonths_(ss, [String(row.deliveryDate).slice(0, 7)]);
    return { ok: true };
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
    sh = ss.insertSheet(name, Math.min(ss.getSheets().length, 2 + after));
  }
  sh.clear(); sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  try { sh.setHiddenGridlines(true); } catch (e) {}
  rows.forEach(function (r) { r.dueDate = cpDue_(r.deliveryDate) || r.dueDate; });
  rows.sort(function (a, b) { return String(a.deliveryDate).localeCompare(String(b.deliveryDate)) || String(a.poNo).localeCompare(String(b.poNo)) || a.lineNo - b.lineNo; });
  var p = ym.split('-'), title = 'ตารางส่งสินค้า CP Ram ' + CP_MONTHS_[+p[1] - 1] + ' ' + (+p[0] + 543);
  var head = ['วัน', 'วันที่', 'สินค้า', 'PO', 'คลัง', 'จำนวนสินค้า', 'หน่วย', 'Total', 'สถานที่ส่ง', 'หมายเหตุ'];
  sh.getRange('A1:J1').merge().setValue(title).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('A2:J2').merge().setValue('อัพเดต ' + cpSlash_(purToday_())).setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(4, 1, 1, 10).setValues([head]).setFontWeight('bold').setBackground(CP_HEAD_BG_);
  var groups = [], g = null;
  rows.forEach(function (r) { if (!g || g.date !== r.deliveryDate) { g = { date: r.deliveryDate, rows: [] }; groups.push(g); } g.rows.push(r); });
  var vals = [], merges = [], row = 5, cancelRows = [], total = 0;
  groups.forEach(function (gr) {
    var n = gr.rows.length, sum = 0;
    gr.rows.forEach(function (r, i) {
      var cancel = r.status === 'cancel', note = [cancel ? 'ยกเลิก' : r.status === 'done' ? '*ส่งสินค้าแล้ว' : '', r.note, r.history ? 'เปลี่ยน: ' + String(r.history).split(' | ').pop().replace(/^[\d-]+: /, '') : ''].filter(String).join(' · ');
      if (!cancel) sum += Number(r.qty) || 0;
      if (cancel) cancelRows.push(row + i);
      vals.push([i ? '' : CP_DAYS_[new Date(gr.date + 'T00:00:00').getDay()], i ? '' : cpSlash_(gr.date), r.product, "'" + String(r.poNo).replace(/^'/, ''), String(r.wh || '-').replace(/^'/, ''), Number(r.qty) || 0,
        r.unit || 'ลัง', '', r.place, note]);
    });
    total += sum;
    vals[vals.length - n][7] = sum;
    if (n > 1) {
      ['A', 'B', 'H'].forEach(function (c) { merges.push(c + row + ':' + c + (row + n - 1)); });
      [2, 8].forEach(function (ci) {   // สินค้า / สถานที่ส่ง: รวมช่องเมื่อเหมือนกันทั้งกลุ่ม
        var same = gr.rows.every(function (r) { return String(ci === 2 ? r.product : r.place) === String(ci === 2 ? gr.rows[0].product : gr.rows[0].place); });
        if (same) { merges.push(String.fromCharCode(65 + ci) + row + ':' + String.fromCharCode(65 + ci) + (row + n - 1)); for (var k = 1; k < n; k++) vals[vals.length - n + k][ci] = ''; }
      });
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
  var tr = last + 2;
  sh.getRange(tr, 5, 1, 3).setValues([['Total', total, 'ลัง']]).setFontWeight('bold').setBackground(CP_TOTAL_BG_).setHorizontalAlignment('center');
  sh.getRange(tr + 3, 10).setValue('ผู้จัดทำ            __________________');
  sh.getRange(tr + 4, 10).setValue('ผู้ตรวจสอบ    ___________________');
  // ตารางรอบเงินเข้า (M:R)
  var rounds = cpRounds_(rows);
  sh.getRange(5, 13, 1, 6).setValues([['รอบเงินเข้า', 'จำนวน', 'ราคา', 'ยอดเงิน', 'Vat 7%', 'Total']]).setFontWeight('bold').setBackground(CP_HEAD_BG_).setHorizontalAlignment('center');
  if (rounds.length) {
    sh.getRange(6, 13, rounds.length, 6).setValues(rounds.map(function (x) { return [cpSlash_(x.dueDate), x.qty, x.price, x.amount, x.vat, x.total]; }));
    sh.getRange(6, 15, rounds.length, 4).setNumberFormat('#,##0.00');
    sh.getRange(6, 14, rounds.length, 1).setNumberFormat('#,##0');
  }
  var rt = 6 + rounds.length;
  sh.getRange(rt, 17, 1, 2).setValues([['รวม', cpR2_(rounds.reduce(function (s, x) { return s + x.total; }, 0))]]).setFontWeight('bold').setBackground(CP_TOTAL_BG_);
  sh.getRange(rt, 18).setNumberFormat('#,##0.00');
  sh.getRange(5, 13, rounds.length + 1, 6).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, 1, Math.max(tr + 4, rt), 18).setFontFamily('Sarabun');
  [70, 80, 170, 100, 80, 95, 50, 65, 100, 210, 20, 20, 95, 70, 70, 100, 90, 110].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(4);
}
function cpTabYm_(name) { var m = name.match(/(\d{2})\.(\d{2})$/); return m ? (2000 + +m[2] - 43) + '-' + m[1] : ''; }
