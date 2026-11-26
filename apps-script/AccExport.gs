// ==================== ฝ่ายบัญชี — ออเดอร์ต่างประเทศ (Invoice PDF) ====================
//
// ผู้ใช้ขอ 19/11/69: นำออเดอร์ต่างประเทศเข้าระบบจากไฟล์ PDF Invoice (จาก PEAK) แล้วส่งข้อความ + ภาพตารางเข้ากลุ่ม LINE เหมือน CP Ram
// หน้าเว็บ (exportorder.js) อ่าน PDF เอง: ถ้าไฟล์มีตัวหนังสือใช้ pdf.js · ถ้าเป็นภาพ (Print to PDF) อ่านด้วย OCR (tesseract.js) แล้วให้ตรวจ/แก้ก่อนบันทึก
// เก็บในชีตหลักฝ่ายบัญชี: แท็บ "ออเดอร์ต่างประเทศ" (1 แถว = 1 Invoice) + "รายการออเดอร์ต่างประเทศ" (1 แถว = 1 สินค้า)
// ไฟล์ Invoice ต้นฉบับ + ไฟล์ตาราง PDF / Excel + ภาพสำหรับ LINE เก็บในโฟลเดอร์ฝ่าย / "ออเดอร์ต่างประเทศ"
// LINE ใช้บอท / กลุ่มเดียวกับฝ่ายบัญชี (ACC_LINE_TOKEN / ACC_LINE_GROUP) · แสดงยอดเงิน (ผู้ใช้เลือก) · วันส่ง (ETD) ใส่เองตอนนำเข้า แก้ภายหลังได้

var EX_TABLES_ = {
  ex_orders: { tab: 'ออเดอร์ต่างประเทศ', cols: [
    ['id', 'รหัส'], ['invNo', 'เลขที่ Invoice'], ['issueDate', 'วันที่ Invoice'], ['ref', 'อ้างอิง'], ['customer', 'ลูกค้า'], ['address', 'ที่อยู่ลูกค้า'],
    ['email', 'อีเมลลูกค้า'], ['currency', 'สกุลเงิน'], ['incoterms', 'Incoterms'], ['port', 'ปลายทาง (Delivery Location)'], ['transport', 'การขนส่ง'],
    ['payTerms', 'เงื่อนไขการชำระเงิน'], ['shipDate', 'วันส่งสินค้า (ETD)'], ['status', 'สถานะ'], ['note', 'หมายเหตุ'], ['itemCount', 'จำนวนรายการ'],
    ['qty', 'จำนวนรวม'], ['amount', 'ยอดรวม'], ['wht', 'หัก ณ ที่จ่าย'], ['payAmount', 'ยอดชำระ'], ['fileName', 'ไฟล์'], ['invUrl', 'ไฟล์ Invoice ต้นฉบับ'],
    ['pdfUrl', 'ไฟล์ PDF (ตาราง)'], ['xlsxUrl', 'ไฟล์ Excel'], ['sheetUrl', 'ไฟล์รายงาน (Google Sheet)'], ['imgUrl', 'ภาพตาราง (LINE)'], ['sentAt', 'ส่ง LINE เมื่อ'],
    ['history', 'ประวัติการเปลี่ยนแปลง'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขเมื่อ']] },
  ex_lines: { tab: 'รายการออเดอร์ต่างประเทศ', cols: [
    ['id', 'รหัส'], ['orderId', 'รหัสออเดอร์'], ['invNo', 'เลขที่ Invoice'], ['lineNo', 'ลำดับ'], ['code', 'รหัสสินค้า'], ['name', 'สินค้า'],
    ['qty', 'จำนวน'], ['price', 'ราคา/หน่วย'], ['amount', 'จำนวนเงิน']] }
};
var EX_STATUS_ = { '': 'รอส่ง', done: 'ส่งสินค้าแล้ว', cancel: 'ยกเลิก' };
var EX_FOLDER_ = 'ออเดอร์ต่างประเทศ';
var EX_C_ = '#1E3A8A';   // สีหลักของการ์ด (น้ำเงินเข้ม) แยกจาก CP ALL / CP Ram ที่เป็นสีเขียว

function exRegister_() {
  accRegister_();
  Object.keys(EX_TABLES_).forEach(function (k) { PUR_TABLES_[k] = EX_TABLES_[k]; });
  ['issueDate', 'shipDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['lineNo', 'qty', 'price', 'amount', 'itemCount', 'wht', 'payAmount'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function exStrip_(x) { Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = x[k].replace(/^'/, ''); }); return x; }
function exR2_(n) { return Math.round(Number(n || 0) * 100) / 100; }
function exIso_(v) { var d = accDate_(v); return d || ''; }
function exSlash_(iso) { var p = String(iso || '').split('-'); return p.length < 3 ? '-' : p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2); }
function exMoney_(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function exQty_(n) { var v = Number(n || 0); return v % 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toLocaleString('en-US'); }

// ข้อมูลจากหน้าเว็บ → ตรวจ / ตัดให้สะอาด
function exClean_(inv) {
  inv = inv || {};
  var items = (Array.isArray(inv.items) ? inv.items : []).slice(0, 200).map(function (it, i) {
    return { lineNo: i + 1, code: accClean_(it && it.code, 30), name: accClean_(it && it.name, 150), qty: exR2_(it && it.qty), price: Math.round(Number(it && it.price || 0) * 10000) / 10000, amount: exR2_(it && it.amount) };
  }).filter(function (it) { return it.name || it.code; });
  return {
    invNo: accClean_(inv.invNo, 40).toUpperCase().replace(/\s+/g, ''), issueDate: exIso_(inv.issueDate), ref: accClean_(inv.ref, 80),
    customer: accClean_(inv.customer, 120), address: accClean_(inv.address, 300), email: accClean_(inv.email, 120),
    currency: (accClean_(inv.currency, 5) || 'USD').toUpperCase(), incoterms: accClean_(inv.incoterms, 20), port: accClean_(inv.port, 120),
    transport: accClean_(inv.transport, 60), payTerms: accClean_(inv.payTerms, 800), shipDate: exIso_(inv.shipDate),
    status: EX_STATUS_[inv.status] !== undefined ? String(inv.status || '') : '', note: accClean_(inv.note, 300),
    wht: exR2_(inv.wht), payAmount: exR2_(inv.payAmount), items: items
  };
}
function exFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายบัญชี');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName(EX_FOLDER_);
  return it.hasNext() ? it.next() : parent.createFolder(EX_FOLDER_);
}
function exShare_(f) { try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return true; } catch (e) { return false; } }
function exTrash_(urls) { urls.forEach(function (u) { var id = String(u || '').match(/[-\w]{25,}/); if (id) try { DriveApp.getFileById(id[0]).setTrashed(true); } catch (e) {} }); }
function exOrders_(ss) {
  var lines = purRead_(ss, 'ex_lines').map(exStrip_), by = {};
  lines.forEach(function (l) { delete l._row; });
  lines.forEach(function (l) { (by[l.orderId] = by[l.orderId] || []).push(l); });
  return purRead_(ss, 'ex_orders').map(exStrip_).map(function (o) {
    delete o._row;
    o.items = (by[o.id] || []).sort(function (a, b) { return a.lineNo - b.lineNo; });
    return o;
  }).sort(function (a, b) { return String(b.issueDate || b.createdAt).localeCompare(String(a.issueDate || a.createdAt)) || String(b.invNo).localeCompare(String(a.invNo)); });
}

// ---------- API ----------
function exLoad(token) {
  var dept = requireAcc_(token); exRegister_();
  accRegister_();
  var ss = accReadBook_(dept), lp = props_();
  return { ok: true, today: purToday_(), line: !!(lp.getProperty('ACC_LINE_TOKEN') && lp.getProperty('ACC_LINE_GROUP')), orders: exOrders_(ss) };
}
// ตรวจก่อนบันทึก: มี Invoice เลขนี้แล้วหรือยัง
function exCheck(token, invNo) {
  var dept = requireAcc_(token); exRegister_();
  var no = accClean_(invNo, 40).toUpperCase().replace(/\s+/g, '');
  var o = no ? purRead_(purBook_(dept), 'ex_orders').filter(function (x) { return String(x.invNo).replace(/^'/, '') === no; })[0] : null;
  return { ok: true, exists: !!o, order: o ? { id: o.id, status: o.status, shipDate: o.shipDate, sentAt: o.sentAt, amount: o.amount } : null };
}
// บันทึก (Invoice เลขเดิม = อัปเดตทั้งใบ + เก็บประวัติ) · pdfB64 = ไฟล์ต้นฉบับ (ไม่บังคับ)
function exSave(token, inv, fileName, pdfB64) {
  var dept = requireAcc_(token); exRegister_();
  var x = exClean_(inv);
  if (!x.invNo) return { ok: false, error: 'ใส่เลขที่ Invoice' };
  if (!x.issueDate) return { ok: false, error: 'ใส่วันที่ Invoice' };
  if (!x.customer) return { ok: false, error: 'ใส่ชื่อลูกค้า' };
  if (!x.items.length) return { ok: false, error: 'ไม่มีรายการสินค้า' };
  return purLocked_(function () {
    var ss = purBook_(dept), now = purNow_(), all = purRead_(ss, 'ex_orders');
    var old = all.filter(function (o) { return String(o.invNo).replace(/^'/, '') === x.invNo; })[0];
    var rec = old ? exStrip_(old) : { id: purId_('EX'), createdAt: now, status: '', sentAt: '', history: '' };
    var diff = [];
    if (old) {
      [['shipDate', 'วันส่ง'], ['customer', 'ลูกค้า'], ['port', 'ปลายทาง']].forEach(function (f) { if (String(rec[f[0]] || '') !== String(x[f[0]] || '')) diff.push(f[1] + ' ' + (rec[f[0]] || '-') + ' → ' + (x[f[0]] || '-')); });
      var oldAmt = exR2_(rec.amount), newAmt = exR2_(x.items.reduce(function (s, it) { return s + it.amount; }, 0));
      if (oldAmt !== newAmt) diff.push('ยอดรวม ' + exMoney_(oldAmt) + ' → ' + exMoney_(newAmt));
    }
    ['invNo', 'issueDate', 'ref', 'customer', 'address', 'email', 'currency', 'incoterms', 'port', 'transport', 'payTerms', 'shipDate', 'note', 'wht', 'payAmount'].forEach(function (k) { rec[k] = x[k]; });
    if (!old) rec.status = x.status;
    rec.itemCount = x.items.length;
    rec.qty = exR2_(x.items.reduce(function (s, it) { return s + it.qty; }, 0));
    rec.amount = exR2_(x.items.reduce(function (s, it) { return s + it.amount; }, 0));
    if (!rec.payAmount) rec.payAmount = exR2_(rec.amount - rec.wht);
    rec.fileName = accClean_(fileName, 150) || rec.fileName || '';
    if (old) { rec.updatedAt = now; rec.history = (rec.history ? rec.history + ' | ' : '') + now.slice(0, 10) + ': นำเข้าใหม่' + (diff.length ? ' (' + diff.join(', ') + ')' : ''); }
    // ไฟล์ Invoice ต้นฉบับ
    if (pdfB64 && typeof pdfB64 === 'string' && pdfB64.length < 14000000 && /^[A-Za-z0-9+\/=]+$/.test(pdfB64)) {
      try {
        var f = exFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(pdfB64), 'application/pdf', 'Invoice ' + x.invNo + '.pdf'));
        exShare_(f);
        if (rec.invUrl) exTrash_([rec.invUrl]);
        rec.invUrl = f.getUrl();
      } catch (e) { /* ไม่มีโฟลเดอร์ / สิทธิ์ — ข้อมูลยังบันทึกได้ */ }
    }
    purWrite_(ss, 'ex_orders', rec);
    // รายการสินค้า: ลบของเดิมของใบนี้ แล้วเขียนใหม่ทั้งชุด
    var sh = purSheet_(ss, 'ex_lines'), olds = purRead_(ss, 'ex_lines').filter(function (l) { return l.orderId === rec.id; }).map(function (l) { return l._row; }).sort(function (a, b) { return b - a; });
    olds.forEach(function (r) { sh.deleteRow(r); });
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var values = x.items.map(function (it) { return purRowValues_(sh, 'ex_lines', Object.assign({ id: purId_('EXL'), orderId: rec.id, invNo: x.invNo }, it), head); });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    purLogWrite_(ss, old ? 'อัปเดตออเดอร์ต่างประเทศ' : 'นำเข้าออเดอร์ต่างประเทศ', 'ex_orders', rec.id, x.invNo + ' · ' + x.customer + ' · ' + exMoney_(rec.amount) + ' ' + rec.currency);
    return { ok: true, id: rec.id, updated: !!old, order: exOrders_(ss).filter(function (o) { return o.id === rec.id; })[0] };
  });
}
// แก้วันส่ง / สถานะ / หมายเหตุ / ปลายทาง / การขนส่ง (หน้ารายการ)
function exUpdate(token, id, patch) {
  var dept = requireAcc_(token); exRegister_();
  patch = patch || {};
  return purLocked_(function () {
    var ss = purBook_(dept), o = purRead_(ss, 'ex_orders').filter(function (r) { return r.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบออเดอร์นี้' };
    exStrip_(o);
    var now = purNow_(), diff = [];
    var next = { shipDate: patch.shipDate !== undefined ? exIso_(patch.shipDate) : o.shipDate, status: patch.status !== undefined && EX_STATUS_[patch.status] !== undefined ? String(patch.status) : o.status,
      note: patch.note !== undefined ? accClean_(patch.note, 300) : o.note, port: patch.port !== undefined ? accClean_(patch.port, 120) : o.port, transport: patch.transport !== undefined ? accClean_(patch.transport, 60) : o.transport };
    if (patch.shipDate && !next.shipDate) return { ok: false, error: 'วันส่งไม่ถูกต้อง' };
    if (String(next.shipDate || '') !== String(o.shipDate || '')) diff.push('วันส่ง ' + (o.shipDate ? exSlash_(o.shipDate) : '-') + ' → ' + (next.shipDate ? exSlash_(next.shipDate) : '-') + (patch.reason ? ' (' + accClean_(patch.reason, 120) + ')' : ''));
    if (String(next.status || '') !== String(o.status || '')) diff.push('สถานะ ' + EX_STATUS_[o.status || ''] + ' → ' + EX_STATUS_[next.status || '']);
    Object.keys(next).forEach(function (k) { o[k] = next[k]; });
    if (diff.length) o.history = (o.history ? o.history + ' | ' : '') + now.slice(0, 10) + ': ' + diff.join(', ');
    o.updatedAt = now;
    delete o.items;
    purWrite_(ss, 'ex_orders', o);
    purLogWrite_(ss, 'แก้ออเดอร์ต่างประเทศ', 'ex_orders', id, o.invNo + (diff.length ? ' · ' + diff.join(', ') : ''));
    return { ok: true, order: exOrders_(ss).filter(function (r) { return r.id === id; })[0] };
  });
}
function exDelete(token, id) {
  var dept = requireAcc_(token); exRegister_();
  return purLocked_(function () {
    var ss = purBook_(dept), o = purRead_(ss, 'ex_orders').filter(function (r) { return r.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบออเดอร์นี้' };
    var sh = purSheet_(ss, 'ex_lines');
    purRead_(ss, 'ex_lines').filter(function (l) { return l.orderId === id; }).map(function (l) { return l._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
    purSheet_(ss, 'ex_orders').deleteRow(o._row);
    exTrash_([o.pdfUrl, o.xlsxUrl, o.sheetUrl, o.imgUrl]);
    purLogWrite_(ss, 'ลบออเดอร์ต่างประเทศ', 'ex_orders', id, String(o.invNo).replace(/^'/, ''));
    return { ok: true };
  });
}

// ---------- ไฟล์ตาราง PDF / Excel ----------
function exDraw_(sh, o) {
  sh.clear(); try { sh.setHiddenGridlines(true); } catch (e) {}
  var cur = o.currency || 'USD', st = EX_STATUS_[o.status || ''];
  sh.getRange('A1:F1').merge().setValue('ใบแจ้งออเดอร์ต่างประเทศ (Export Order)').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('A2:F2').merge().setValue('บริษัท สปังกี้ ฟู้ด จำกัด · อัพเดต ' + exSlash_(purToday_())).setFontSize(12).setHorizontalAlignment('center');
  var info = [['เลขที่ Invoice', o.invNo, 'วันที่ Invoice', exSlash_(o.issueDate)], ['ลูกค้า', o.customer, 'วันส่งสินค้า (ETD)', o.shipDate ? exSlash_(o.shipDate) : 'ยังไม่กำหนด'],
    ['ปลายทาง', o.port || '-', 'Incoterms', o.incoterms || '-'], ['การขนส่ง', o.transport || '-', 'สถานะ', st]];
  sh.getRange(4, 1, info.length, 4).setValues(info);
  sh.getRange(4, 1, info.length, 1).setFontWeight('bold'); sh.getRange(4, 3, info.length, 1).setFontWeight('bold');
  var hr = 4 + info.length + 1;
  sh.getRange(hr, 1, 1, 6).setValues([['ลำดับ', 'รหัสสินค้า', 'สินค้า', 'จำนวน', 'ราคา/หน่วย (' + cur + ')', 'จำนวนเงิน (' + cur + ')']]).setFontWeight('bold').setBackground('#DBEAFE').setHorizontalAlignment('center');
  var items = o.items || [];
  if (items.length) {
    sh.getRange(hr + 1, 1, items.length, 6).setValues(items.map(function (it) { return [it.lineNo, it.code, it.name, Number(it.qty) || 0, Number(it.price) || 0, Number(it.amount) || 0]; }));
    sh.getRange(hr + 1, 4, items.length, 1).setNumberFormat('#,##0.##');
    sh.getRange(hr + 1, 5, items.length, 2).setNumberFormat('#,##0.00');
  }
  var tr = hr + items.length + 1;
  sh.getRange(tr, 1, 1, 6).setValues([['', '', 'รวม', Number(o.qty) || 0, '', Number(o.amount) || 0]]).setFontWeight('bold').setBackground('#FEF3C7');
  sh.getRange(tr, 4).setNumberFormat('#,##0.##'); sh.getRange(tr, 6).setNumberFormat('#,##0.00');
  sh.getRange(hr, 1, tr - hr + 1, 6).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
  sh.getRange(hr + 1, 1, items.length + 1, 2).setHorizontalAlignment('center');
  var r = tr + 2;
  if (o.payTerms) { sh.getRange(r, 1).setValue('เงื่อนไขการชำระเงิน').setFontWeight('bold'); sh.getRange(r, 2, 1, 5).merge().setValue(o.payTerms).setWrap(true); sh.setRowHeight(r, 70); r++; }
  if (o.note) { sh.getRange(r, 1).setValue('หมายเหตุ').setFontWeight('bold'); sh.getRange(r, 2, 1, 5).merge().setValue(o.note).setWrap(true); r++; }
  sh.getRange(r + 2, 5).setValue('ผู้จัดทำ  __________________');
  sh.getRange(r + 3, 5).setValue('ผู้ตรวจสอบ  ________________');
  sh.getRange(1, 1, r + 3, 6).setFontFamily('Sarabun');
  [60, 100, 260, 80, 120, 140].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(4, 2, info.length, 1).setWrap(true);
}
function exMakeFiles_(dept, ss, o) {
  var folder = exFolder_(dept), name = 'ออเดอร์ต่างประเทศ ' + o.invNo;
  exTrash_([o.pdfUrl, o.xlsxUrl, o.sheetUrl]);
  var book = SpreadsheetApp.create(name);
  DriveApp.getFileById(book.getId()).moveTo(folder);
  var sh = book.getSheets()[0]; sh.setName('ออเดอร์');
  exDraw_(sh, o);
  SpreadsheetApp.flush();
  var pdf = accExportPdf_(book, folder, name, true), xlsx = accExportXlsx_(book, folder, name);
  var row = purRead_(ss, 'ex_orders').filter(function (r) { return r.id === o.id; })[0];
  if (row) { exStrip_(row); row.pdfUrl = pdf.getUrl(); row.xlsxUrl = xlsx.getUrl(); row.sheetUrl = book.getUrl(); purWrite_(ss, 'ex_orders', row); }
  o.pdfUrl = pdf.getUrl(); o.xlsxUrl = xlsx.getUrl(); o.sheetUrl = book.getUrl();
  return { pdfUrl: o.pdfUrl, xlsxUrl: o.xlsxUrl, xlsxDownload: accXlsxDownload_(o.xlsxUrl) };
}
function exMakeFiles(token, id) {
  var dept = requireAcc_(token); exRegister_();
  return purLocked_(function () {
    var ss = purBook_(dept), o = exOrders_(ss).filter(function (r) { return r.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบออเดอร์นี้' };
    var f = exMakeFiles_(dept, ss, o);
    return { ok: true, pdfUrl: f.pdfUrl, xlsxUrl: f.xlsxUrl, xlsxDownload: f.xlsxDownload };
  });
}

// ---------- LINE ----------
function exFlex_(o, hasImg) {
  var T = function (text, opt) { var x = { type: 'text', text: String(text == null || text === '' ? '-' : text), wrap: true }; Object.keys(opt || {}).forEach(function (k) { x[k] = opt[k]; }); return x; };
  var row = function (label, value, color) { return { type: 'box', layout: 'horizontal', margin: 'md', contents: [T(label, { size: 'sm', color: '#64748B', flex: 4 }), T(value, { size: 'sm', weight: 'bold', color: color || '#0F172A', flex: 7, align: 'end' })] }; };
  var cur = o.currency || 'USD', cancel = o.status === 'cancel';
  var body = [row('เลขที่ Invoice', o.invNo), row('วันที่ Invoice', accDot_(o.issueDate)), row('ลูกค้า', o.customer), row('ปลายทาง', o.port || '-'),
    row('Incoterms / ขนส่ง', [o.incoterms, o.transport].filter(String).join(' · ') || '-'),
    row('วันส่งสินค้า (ETD)', o.shipDate ? 'วัน' + accDayName_(o.shipDate) + ' ' + accDot_(o.shipDate) : 'ยังไม่กำหนด', o.shipDate ? EX_C_ : '#C2410C')];
  if (o.status) body.push(row('สถานะ', EX_STATUS_[o.status], cancel ? '#DC2626' : '#16A34A'));
  body.push({ type: 'box', layout: 'horizontal', margin: 'xl', backgroundColor: EX_C_, cornerRadius: '10px', paddingTop: '7px', paddingBottom: '7px', paddingStart: '12px', paddingEnd: '12px', contents: [
    T('รายการสินค้า ' + (o.items || []).length + ' รายการ', { size: 'sm', weight: 'bold', color: '#FFFFFF', flex: 7 }), T(cur, { size: 'sm', weight: 'bold', color: '#FFFFFF', flex: 3, align: 'end' })] });
  (o.items || []).forEach(function (it, i) {
    body.push({ type: 'box', layout: 'vertical', margin: i ? 'md' : 'sm', paddingStart: '4px', paddingEnd: '4px', contents: [
      { type: 'box', layout: 'horizontal', contents: [T((i + 1) + '. ' + (it.name || it.code), { size: 'sm', weight: 'bold', color: '#0F172A', flex: 7 }), T(exMoney_(it.amount), { size: 'sm', weight: 'bold', color: EX_C_, flex: 4, align: 'end' })] },
      T([it.code, exQty_(it.qty) + ' × ' + exMoney_(it.price)].filter(String).join(' · '), { size: 'xs', color: '#64748B', margin: 'xs' })] });
    if (i < o.items.length - 1) body.push({ type: 'separator', margin: 'md', color: '#E2E8F0' });
  });
  body.push({ type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: '#EFF6FF', cornerRadius: '16px', paddingAll: '14px', borderColor: '#BFDBFE', borderWidth: '1px', contents: [
    T('ยอดรวม (' + cur + ')', { size: 'sm', color: EX_C_, align: 'center' }), T(exMoney_(o.amount) + ' ' + cur, { size: '3xl', weight: 'bold', color: EX_C_, align: 'center', decoration: cancel ? 'line-through' : 'none' }),
    T('จำนวนรวม ' + exQty_(o.qty), { size: 'xs', color: '#475569', align: 'center', margin: 'xs' })] });
  if (o.payTerms) body.push(T('เงื่อนไขการชำระเงิน: ' + String(o.payTerms).slice(0, 400), { size: 'xxs', color: '#64748B', margin: 'md' }));
  if (o.note) body.push(T('หมายเหตุ: ' + o.note, { size: 'xs', color: '#C2410C', weight: 'bold', margin: 'md' }));
  if (hasImg) body.push(T('📊 ตารางออเดอร์ อยู่ในข้อความถัดไป (กดที่ภาพเพื่อเปิดภาพเต็ม)', { size: 'xxs', color: '#64748B', margin: 'md', align: 'center' }));
  var pdf = o.invUrl || o.pdfUrl;
  if (pdf) body.push({ type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: EX_C_, cornerRadius: '24px', paddingAll: '12px',
    action: { type: 'uri', label: 'เปิดไฟล์ PDF', uri: pdf }, contents: [T(o.invUrl ? 'เปิดไฟล์ Invoice (PDF)' : 'เปิดไฟล์ PDF', { size: 'md', weight: 'bold', color: '#FFFFFF', align: 'center' })] });
  if (o.xlsxUrl) body.push({ type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#FFFFFF', borderColor: EX_C_, borderWidth: '2px', cornerRadius: '24px', paddingAll: '11px',
    action: { type: 'uri', label: 'ดาวน์โหลด Excel', uri: accXlsxDownload_(o.xlsxUrl, true) }, contents: [T('ดาวน์โหลดไฟล์ Excel', { size: 'md', weight: 'bold', color: EX_C_, align: 'center' })] });
  var inner = [
    { type: 'box', layout: 'vertical', backgroundColor: EX_C_, cornerRadius: '18px', paddingAll: '18px', contents: [
      T('EXPORT ORDER · ' + (o.customer || ''), { size: 'xxs', color: '#BFDBFE', weight: 'bold' }),
      T('ใบแจ้งออเดอร์ต่างประเทศ', { size: 'xl', color: '#FFFFFF', weight: 'bold', margin: 'sm' }),
      T('บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายบัญชี', { size: 'xs', color: '#DBEAFE', margin: 'xs' })] },
    { type: 'box', layout: 'vertical', paddingStart: '6px', paddingEnd: '6px', paddingTop: '6px', paddingBottom: '4px', contents: body }];
  return { type: 'flex', altText: 'ออเดอร์ต่างประเทศ ' + o.invNo + ' · ' + o.customer + ' · ' + exMoney_(o.amount) + ' ' + cur + (o.shipDate ? ' · ส่ง ' + accDot_(o.shipDate) : ''),
    contents: { type: 'bubble', size: 'giga', body: { type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: '#FFFFFF', contents: inner } } };
}
function exSaveImage_(dept, o, png) {
  if (!png || typeof png !== 'string' || png.length > 6000000 || !/^[A-Za-z0-9+\/=]+$/.test(png)) return '';
  exTrash_([o.imgUrl]);
  var f = exFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(png), 'image/png', 'ตารางออเดอร์ต่างประเทศ ' + o.invNo + '.png'));
  if (!exShare_(f)) return '';
  return 'https://lh3.googleusercontent.com/d/' + f.getId();
}
function exSendLine(token, id, png, ratio) {
  var dept = requireAcc_(token); exRegister_();
  return purLocked_(function () {
    var ss = purBook_(dept), o = exOrders_(ss).filter(function (r) { return r.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบออเดอร์นี้' };
    var img = '';
    try { img = exSaveImage_(dept, o, png); } catch (e) { img = ''; }
    try { exMakeFiles_(dept, ss, o); } catch (e) {}
    var msgs = [exFlex_(o, !!img)];
    if (img) msgs.push({ type: 'flex', altText: 'ตารางออเดอร์ต่างประเทศ ' + o.invNo, contents: { type: 'bubble', size: 'giga', hero: { type: 'image', url: img, size: 'full',
      aspectRatio: /^\d{2,5}:\d{2,5}$/.test(String(ratio)) ? String(ratio) : '20:13', aspectMode: 'fit', backgroundColor: '#FFFFFF', action: { type: 'uri', uri: img } } } });
    var r = accLinePush_(msgs);
    if (!r.ok) return r;
    var row = purRead_(ss, 'ex_orders').filter(function (x) { return x.id === id; })[0];
    exStrip_(row);
    row.sentAt = purNow_(); if (img) row.imgUrl = img;
    purWrite_(ss, 'ex_orders', row);
    purLogWrite_(ss, 'ส่ง LINE ออเดอร์ต่างประเทศ', 'ex_orders', id, o.invNo);
    return { ok: true, sentAt: row.sentAt, pdfUrl: row.pdfUrl, xlsxUrl: row.xlsxUrl, imgUrl: row.imgUrl };
  });
}
