// ==================== จัดซื้อ: ตรวจ 3 ทาง · เปรียบเทียบราคา · บริหารคู่ค้า ====================
// ใช้ตาราง/ตัวช่วยจาก Purchasing.gs (PUR_TABLES_, purRead_, purWrite_, purLocked_ ...)
// PR / PO ออกจากระบบ PEAK → นำเลขที่ + ไฟล์ + รายการมาลงที่นี่ (purSaveDoc)

function purJson_(v) { try { var a = typeof v === 'string' ? JSON.parse(v || '[]') : v; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function purR2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function purR3_(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

// ---------- ตรวจ 3 ทาง: PO ↔ รับของ (รับเข้าที่อ้างอิง PO) ↔ ใบแจ้งหนี้ ----------
// status: ok = ตรงกันทุกรายการ · diff = มีรายการไม่ตรง · noinv = ยังไม่มีใบแจ้งหนี้ · norecv = ยังไม่ได้รับของ
function purMatch_(doc, items, moves, invoices) {
  var key = function (it) { return it.materialId || ('n:' + String(it.materialName || '').trim()); };
  var lines = {}, order = [];
  var line = function (k, it) {
    if (!lines[k]) { lines[k] = { key: k, materialId: it.materialId || '', name: it.materialName || it.name || '', unit: it.unit || '', ordered: 0, poAmount: 0, received: 0, invoiced: 0, invAmount: 0 }; order.push(k); }
    return lines[k];
  };
  (items || []).forEach(function (it) { var l = line(key(it), it); l.ordered += Number(it.qty) || 0; l.poAmount += Number(it.amount) || (Number(it.qty) || 0) * (Number(it.price) || 0); });
  (moves || []).forEach(function (m) {
    if (m.docId !== doc.id || m.type !== 'IN') return;
    var l = lines[m.materialId]; if (!l) l = line(m.materialId, { materialId: m.materialId, materialName: m.materialId });
    l.received += Number(m.qty) || 0;
  });
  var invs = (invoices || []).filter(function (x) { return x.docId === doc.id; });
  invs.forEach(function (inv) {
    purJson_(inv.items).forEach(function (it) { var l = line(key(it), it); l.invoiced += Number(it.qty) || 0; l.invAmount += Number(it.amount) || (Number(it.qty) || 0) * (Number(it.price) || 0); });
  });
  var out = order.map(function (k) {
    var l = lines[k], issues = [];
    l.ordered = purR3_(l.ordered); l.received = purR3_(l.received); l.invoiced = purR3_(l.invoiced);
    l.poPrice = l.ordered ? purR2_(l.poAmount / l.ordered) : ''; l.invPrice = l.invoiced ? purR2_(l.invAmount / l.invoiced) : '';
    if (Math.abs(l.received - l.ordered) > 0.0005) issues.push(l.received < l.ordered ? 'รับของน้อยกว่า PO ' + purR3_(l.ordered - l.received) : 'รับของเกิน PO ' + purR3_(l.received - l.ordered));
    if (invs.length && Math.abs(l.invoiced - l.received) > 0.0005) issues.push('ใบแจ้งหนี้ ' + l.invoiced + ' ไม่ตรงกับรับจริง ' + l.received);
    if (invs.length && l.invoiced && l.poPrice !== '' && Math.abs(l.invPrice - l.poPrice) > 0.01) issues.push('ราคาในใบแจ้งหนี้ ' + l.invPrice + ' ไม่ตรง PO ' + l.poPrice);
    l.issues = issues; l.ok = !issues.length;
    delete l.poAmount; l.invAmount = purR2_(l.invAmount);
    return l;
  });
  var invTotal = purR2_(invs.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0));
  var anyRecv = out.some(function (l) { return l.received; });
  var status = !anyRecv ? 'norecv' : !invs.length ? 'noinv' : out.every(function (l) { return l.ok; }) ? 'ok' : 'diff';
  var label = { ok: 'ตรงกันครบ 3 ทาง', diff: 'มีรายการไม่ตรง', noinv: 'ยังไม่มีใบแจ้งหนี้', norecv: 'ยังไม่ได้รับของ' }[status];
  return { status: status, label: label, lines: out, invoiceCount: invs.length, invoiceTotal: invTotal, poTotal: purR2_(doc.total) };
}

// ---------- ใบแจ้งหนี้ผู้ขาย ----------
function purSaveInvoice(token, inv) {
  var dept = requirePur_(token);
  inv = inv || {};
  var lines = (Array.isArray(inv.items) ? inv.items : []).map(function (it) {
    var qty = purNum_(it.qty), price = purNum_(it.price);
    return { materialId: purClean_(it.materialId, 40), materialName: purClean_(it.materialName, 200), qty: qty, unit: purClean_(it.unit, 30), price: price,
      amount: qty !== '' && price !== '' ? purR2_(qty * price) : '' };
  }).filter(function (it) { return it.materialName && it.qty !== '' && it.qty > 0; });
  if (!purClean_(inv.invoiceNo)) return { ok: false, error: 'กรอกเลขที่ใบแจ้งหนี้' };
  if (!lines.length) return { ok: false, error: 'ใส่จำนวนในใบแจ้งหนี้อย่างน้อย 1 รายการ' };
  return purLocked_(function () {
    var ss = purBook_(dept), doc = purRead_(ss, 'docs').filter(function (x) { return x.id === inv.docId && x.type === 'PO'; })[0];
    if (!doc) return { ok: false, error: 'ไม่พบใบ PO' };
    var list = purRead_(ss, 'invoices'), old = inv.id ? list.filter(function (x) { return x.id === inv.id; })[0] : null;
    if (inv.id && !old) return { ok: false, error: 'ไม่พบใบแจ้งหนี้นี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('B'), createdAt: purNow_(), files: '[]' };
    o.docId = doc.id; o.invoiceNo = purClean_(inv.invoiceNo, 60); o.invoiceDate = purDate_(inv.invoiceDate) || purToday_(); o.vendorName = doc.vendorName;
    o.items = JSON.stringify(lines); o.amount = purNum_(inv.amount) !== '' ? purNum_(inv.amount) : purR2_(lines.reduce(function (s, it) { return s + (Number(it.amount) || 0); }, 0));
    o.note = purClean_(inv.note, 500); o.updatedAt = purNow_();
    if (typeof o.files !== 'string') o.files = JSON.stringify(o.files || []);
    purWrite_(ss, 'invoices', o);
    purLogWrite_(ss, old ? 'แก้ไข' : 'เพิ่ม', 'invoices', o.id, doc.docNo + ' ใบแจ้งหนี้ ' + o.invoiceNo + ' ฿' + o.amount);
    return { ok: true, id: o.id };
  });
}
function purDeleteInvoice(token, id) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), old = purRead_(ss, 'invoices').filter(function (x) { return x.id === id; })[0];
    if (!old) return { ok: false, error: 'ไม่พบใบแจ้งหนี้' };
    purSheet_(ss, 'invoices').deleteRow(old._row);
    purLogWrite_(ss, 'ลบ', 'invoices', id, old.invoiceNo + ' ฿' + old.amount);
    return { ok: true };
  });
}

// ---------- เปรียบเทียบราคา (หลายผู้ขาย) ----------
function purSaveRfq(token, r) {
  var dept = requirePur_(token);
  r = r || {};
  var title = purClean_(r.title, 200);
  var items = (Array.isArray(r.items) ? r.items : []).map(function (it, i) {
    return { key: purClean_(it.key, 20) || ('L' + (i + 1)), materialId: purClean_(it.materialId, 40), materialName: purClean_(it.materialName, 200), qty: purNum_(it.qty), unit: purClean_(it.unit, 30) };
  }).filter(function (it) { return it.materialName && it.qty !== ''; });
  if (!title) return { ok: false, error: 'กรอกเรื่องที่จะเปรียบเทียบ' };
  if (!items.length) return { ok: false, error: 'เพิ่มรายการที่ต้องการซื้ออย่างน้อย 1 รายการ' };
  return purLocked_(function () {
    var ss = purBook_(dept), list = purRead_(ss, 'rfqs'), old = r.id ? list.filter(function (x) { return x.id === r.id; })[0] : null;
    if (r.id && !old) return { ok: false, error: 'ไม่พบเรื่องนี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('Q'), createdAt: purNow_(), status: 'open' };
    o.title = title; o.prId = purClean_(r.prId, 40); o.items = JSON.stringify(items); o.note = purClean_(r.note, 1000); o.updatedAt = purNow_();
    purWrite_(ss, 'rfqs', o);
    if (old) purRecalcQuotes_(ss, o.id, items);
    purLogWrite_(ss, old ? 'แก้ไข' : 'สร้าง', 'rfqs', o.id, title);
    return { ok: true, id: o.id };
  });
}
function purRecalcQuotes_(ss, rfqId, items) {
  purRead_(ss, 'quotes').filter(function (q) { return q.rfqId === rfqId; }).forEach(function (q) {
    var prices = purJson_(q.items), byKey = {};
    prices.forEach(function (p) { byKey[p.key] = p.price; });
    q.total = purR2_(items.reduce(function (s, it) { var p = byKey[it.key]; return s + (p === '' || p == null ? 0 : p * (Number(it.qty) || 0)); }, 0));
    purWrite_(ss, 'quotes', q);
  });
}
function purDeleteRfq(token, id) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), old = purRead_(ss, 'rfqs').filter(function (x) { return x.id === id; })[0];
    if (!old) return { ok: false, error: 'ไม่พบเรื่องนี้' };
    var qs = purRead_(ss, 'quotes').filter(function (q) { return q.rfqId === id; }).map(function (q) { return q._row; }).sort(function (a, c) { return c - a; });
    var qsh = purSheet_(ss, 'quotes'); qs.forEach(function (row) { qsh.deleteRow(row); });
    purSheet_(ss, 'rfqs').deleteRow(old._row);
    purLogWrite_(ss, 'ลบ', 'rfqs', id, old.title + ' (ใบเสนอราคา ' + qs.length + ' ใบ)');
    return { ok: true };
  });
}
function purSaveQuote(token, q) {
  var dept = requirePur_(token);
  q = q || {};
  return purLocked_(function () {
    var ss = purBook_(dept), rfq = purRead_(ss, 'rfqs').filter(function (x) { return x.id === q.rfqId; })[0];
    if (!rfq) return { ok: false, error: 'ไม่พบเรื่องเปรียบเทียบราคา' };
    var items = purJson_(rfq.items), prices = Array.isArray(q.items) ? q.items : [];
    var byKey = {}; prices.forEach(function (p) { byKey[String(p.key)] = purNum_(p.price); });
    var lines = items.map(function (it) { return { key: it.key, price: byKey[it.key] === undefined ? '' : byKey[it.key] }; });
    if (!lines.some(function (l) { return l.price !== ''; })) return { ok: false, error: 'ใส่ราคาอย่างน้อย 1 รายการ' };
    var vendorName = purClean_(q.vendorName, 200);
    if (!vendorName) return { ok: false, error: 'เลือกหรือกรอกชื่อผู้ขาย' };
    var list = purRead_(ss, 'quotes'), old = q.id ? list.filter(function (x) { return x.id === q.id; })[0] : null;
    if (q.id && !old) return { ok: false, error: 'ไม่พบใบเสนอราคานี้' };
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('T'), createdAt: purNow_(), files: '[]' };
    o.rfqId = rfq.id; o.vendorId = purClean_(q.vendorId, 40); o.vendorName = vendorName; o.quoteNo = purClean_(q.quoteNo, 60);
    o.quoteDate = purDate_(q.quoteDate); o.validUntil = purDate_(q.validUntil); o.leadDays = purNum_(q.leadDays); o.paymentTerms = purClean_(q.paymentTerms, 200);
    o.creditDays = purNum_(q.creditDays); o.spec = purClean_(q.spec, 1000); o.note = purClean_(q.note, 500);
    o.items = JSON.stringify(lines);
    o.total = purR2_(items.reduce(function (s, it, i) { var p = lines[i].price; return s + (p === '' ? 0 : p * (Number(it.qty) || 0)); }, 0));
    o.updatedAt = purNow_();
    if (typeof o.files !== 'string') o.files = JSON.stringify(o.files || []);
    purWrite_(ss, 'quotes', o);
    purLogWrite_(ss, old ? 'แก้ไข' : 'เพิ่ม', 'quotes', o.id, rfq.title + ' · ' + vendorName + ' ฿' + o.total);
    return { ok: true, id: o.id };
  });
}
function purDeleteQuote(token, id) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), old = purRead_(ss, 'quotes').filter(function (x) { return x.id === id; })[0];
    if (!old) return { ok: false, error: 'ไม่พบใบเสนอราคา' };
    purSheet_(ss, 'quotes').deleteRow(old._row);
    var rfq = purRead_(ss, 'rfqs').filter(function (x) { return x.id === old.rfqId; })[0];
    if (rfq && rfq.winnerId === id) { rfq.winnerId = ''; rfq.status = 'open'; rfq.reason = ''; rfq.decidedAt = ''; rfq.updatedAt = purNow_(); purWrite_(ss, 'rfqs', rfq); }
    purLogWrite_(ss, 'ลบ', 'quotes', id, old.vendorName + ' ฿' + old.total);
    return { ok: true };
  });
}
// เลือกผู้ขาย (quoteId ว่าง = ยกเลิกการเลือก)
function purDecideRfq(token, rfqId, quoteId, reason) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), rfq = purRead_(ss, 'rfqs').filter(function (x) { return x.id === rfqId; })[0];
    if (!rfq) return { ok: false, error: 'ไม่พบเรื่องนี้' };
    if (quoteId && !purRead_(ss, 'quotes').some(function (q) { return q.id === quoteId && q.rfqId === rfqId; })) return { ok: false, error: 'ไม่พบใบเสนอราคา' };
    rfq.winnerId = quoteId || ''; rfq.status = quoteId ? 'decided' : 'open'; rfq.reason = purClean_(reason, 500); rfq.decidedAt = quoteId ? purToday_() : ''; rfq.updatedAt = purNow_();
    purWrite_(ss, 'rfqs', rfq);
    purLogWrite_(ss, quoteId ? 'เลือกผู้ขาย' : 'ยกเลิกการเลือก', 'rfqs', rfqId, rfq.title + ' ' + rfq.reason);
    return { ok: true };
  });
}

// ---------- บริหารคู่ค้า: ประเมินผู้ขาย + ตัวชี้วัดจากข้อมูลจริง ----------
function purQuarterRange_(period) {
  var m = String(period || '').match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  var y = Number(m[1]), q = Number(m[2]), sm = (q - 1) * 3 + 1, em = sm + 2;
  var last = new Date(y, em, 0).getDate();
  return { from: y + '-' + ('0' + sm).slice(-2) + '-01', to: y + '-' + ('0' + em).slice(-2) + '-' + last };
}
// ตัวชี้วัดต่อผู้ขายในช่วงวันที่: PO, ส่งตรงเวลา (วันรับของครั้งแรกเทียบวันส่งใน PO), QC ไม่ผ่าน, ขึ้นราคา
function purVendorMetricsData_(ss, from, to) {
  var docs = purRead_(ss, 'docs'), moves = purRead_(ss, 'moves'), prices = purRead_(ss, 'prices'), mats = purRead_(ss, 'materials');
  var matVendor = {}; mats.forEach(function (m) { matVendor[m.id] = m.vendorId; });
  var firstRecv = {}, out = {};
  var get = function (vid) { return (out[vid] = out[vid] || { vendorId: vid, poCount: 0, poTotal: 0, delivered: 0, onTime: 0, late: 0, qcChecked: 0, qcFail: 0, priceUp: 0, priceDown: 0 }); };
  moves.forEach(function (m) { if (m.type === 'IN' && m.docId && (!firstRecv[m.docId] || m.date < firstRecv[m.docId])) firstRecv[m.docId] = m.date; });
  var docVendor = {};
  docs.forEach(function (d) {
    if (d.type !== 'PO' || d.status === 'cancelled' || !d.vendorId) return;
    docVendor[d.id] = d.vendorId;
    if (d.orderDate < from || d.orderDate > to) return;
    var v = get(d.vendorId); v.poCount++; v.poTotal += Number(d.total) || 0;
    var r = firstRecv[d.id];
    if (r && d.deliveryDate) { v.delivered++; if (r <= d.deliveryDate) v.onTime++; else v.late++; }
  });
  moves.forEach(function (m) {
    if (m.type !== 'IN' || !m.qc || m.date < from || m.date > to) return;
    var vid = (m.docId && docVendor[m.docId]) || matVendor[m.materialId]; if (!vid) return;
    var v = get(vid); v.qcChecked++; if (m.qc === 'ไม่ผ่าน') v.qcFail++;
  });
  var byMat = {}; prices.forEach(function (p) { (byMat[p.materialId] = byMat[p.materialId] || []).push(p); });
  Object.keys(byMat).forEach(function (mid) {
    var list = byMat[mid].sort(function (a, c) { return a.effectiveDate.localeCompare(c.effectiveDate); });
    list.forEach(function (p, i) {
      if (!i || p.effectiveDate < from || p.effectiveDate > to) return;
      var vid = p.vendorId || matVendor[mid]; if (!vid) return;
      var v = get(vid); if (p.price > list[i - 1].price) v.priceUp++; else if (p.price < list[i - 1].price) v.priceDown++;
    });
  });
  Object.keys(out).forEach(function (k) {
    var v = out[k]; v.poTotal = purR2_(v.poTotal);
    v.onTimeRate = v.delivered ? Math.round(v.onTime / v.delivered * 100) : '';
    v.qcFailRate = v.qcChecked ? Math.round(v.qcFail / v.qcChecked * 100) : '';
    // คะแนนแนะนำ (1-5) จากข้อมูลจริง — ผู้ประเมินแก้ได้
    v.suggestDelivery = v.delivered ? Math.max(1, Math.min(5, Math.round(1 + 4 * v.onTime / v.delivered))) : '';
    v.suggestQuality = v.qcChecked ? Math.max(1, Math.min(5, Math.round(5 - 4 * v.qcFail / v.qcChecked))) : '';
    v.suggestPrice = v.priceUp || v.priceDown ? Math.max(1, Math.min(5, 4 - v.priceUp + v.priceDown)) : '';
  });
  return out;
}
function purVendorMetrics(token, period) {
  var dept = requirePur_(token), ss = purBook_(dept), r = purQuarterRange_(period);
  if (!r) return { ok: false, error: 'รอบประเมินไม่ถูกต้อง' };
  return { ok: true, period: period, from: r.from, to: r.to, metrics: purVendorMetricsData_(ss, r.from, r.to) };
}
function purSaveEval(token, e) {
  var dept = requirePur_(token);
  e = e || {};
  if (!purQuarterRange_(e.period)) return { ok: false, error: 'เลือกรอบประเมิน' };
  var sc = ['quality', 'delivery', 'price', 'service'].map(function (k) { var n = purNum_(e[k]); return n === '' ? '' : Math.max(1, Math.min(5, Math.round(n))); });
  if (sc.some(function (n) { return n === ''; })) return { ok: false, error: 'ให้คะแนนครบ 4 หัวข้อ (1-5)' };
  return purLocked_(function () {
    var ss = purBook_(dept);
    if (!purRead_(ss, 'vendors').some(function (v) { return v.id === e.vendorId; })) return { ok: false, error: 'ไม่พบผู้ขาย' };
    var list = purRead_(ss, 'evals');
    var old = e.id ? list.filter(function (x) { return x.id === e.id; })[0] : list.filter(function (x) { return x.vendorId === e.vendorId && x.period === e.period; })[0];
    var o = old ? JSON.parse(JSON.stringify(old)) : { id: purId_('E'), createdAt: purNow_() };
    o.vendorId = e.vendorId; o.period = e.period; o.quality = sc[0]; o.delivery = sc[1]; o.price = sc[2]; o.service = sc[3];
    o.score = Math.round((sc[0] + sc[1] + sc[2] + sc[3]) / 4 * 100) / 100; o.comment = purClean_(e.comment, 1000); o.evaluator = purClean_(e.evaluator, 100); o.updatedAt = purNow_();
    purWrite_(ss, 'evals', o);
    purLogWrite_(ss, old ? 'แก้ไขประเมิน' : 'ประเมิน', 'evals', o.id, e.vendorId + ' ' + o.period + ' คะแนน ' + o.score);
    return { ok: true, id: o.id };
  });
}
function purDeleteEval(token, id) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), old = purRead_(ss, 'evals').filter(function (x) { return x.id === id; })[0];
    if (!old) return { ok: false, error: 'ไม่พบผลประเมิน' };
    purSheet_(ss, 'evals').deleteRow(old._row);
    purLogWrite_(ss, 'ลบประเมิน', 'evals', id, old.vendorId + ' ' + old.period);
    return { ok: true };
  });
}
// รายงานจัดอันดับผู้ขายของรอบ: คะแนนประเมิน + ตัวชี้วัด
function purVendorReport(token, period) {
  var dept = requirePur_(token), ss = purBook_(dept), r = purQuarterRange_(period);
  if (!r) return { ok: false, error: 'เลือกรอบประเมิน' };
  var metrics = purVendorMetricsData_(ss, r.from, r.to), evals = purRead_(ss, 'evals').filter(function (x) { return x.period === period; });
  var byV = {}; evals.forEach(function (x) { byV[x.vendorId] = x; });
  var rows = purRead_(ss, 'vendors').filter(function (v) { return byV[v.id] || metrics[v.id]; }).map(function (v) {
    var e = byV[v.id] || null, m = metrics[v.id] || {};
    return { vendorId: v.id, name: v.name, eval: e ? { quality: e.quality, delivery: e.delivery, price: e.price, service: e.service, score: e.score, comment: e.comment, evaluator: e.evaluator } : null,
      poCount: m.poCount || 0, poTotal: m.poTotal || 0, onTimeRate: m.onTimeRate === undefined ? '' : m.onTimeRate, delivered: m.delivered || 0,
      qcFailRate: m.qcFailRate === undefined ? '' : m.qcFailRate, qcChecked: m.qcChecked || 0, priceUp: m.priceUp || 0, priceDown: m.priceDown || 0 };
  }).sort(function (a, c) { return (c.eval ? c.eval.score : -1) - (a.eval ? a.eval.score : -1) || c.poTotal - a.poTotal; });
  return { ok: true, period: period, from: r.from, to: r.to, rows: rows };
}

// ---------- Dashboard ผู้บริหาร: ข้อมูลเชิงลึกการจัดซื้อในช่วงวันที่ ----------
// 1) ซื้อไปเท่าไร (PO + ใบแจ้งหนี้ เทียบช่วงก่อนหน้า)  2) ราคาขึ้น/ลง  3) ผู้ขายส่งช้า  4) พึ่งพาผู้ขายรายใดมากเกินไป
// 5) PO ค้าง (รอรับของ / ค้างชำระ)  6) โอกาสลดต้นทุน (ประมาณการเงินที่ประหยัดได้)
function purInsights_(ss, from, to) {
  var today = purToday_();
  var docs = purRead_(ss, 'docs'), items = purRead_(ss, 'docItems'), moves = purRead_(ss, 'moves'), prices = purRead_(ss, 'prices');
  var vendors = purRead_(ss, 'vendors'), mats = purRead_(ss, 'materials'), invoices = purRead_(ss, 'invoices'), rfqs = purRead_(ss, 'rfqs'), quotes = purRead_(ss, 'quotes');
  var vName = {}, mInfo = {}; vendors.forEach(function (v) { vName[v.id] = v.name; }); mats.forEach(function (m) { mInfo[m.id] = m; });
  var itemsByDoc = {}; items.forEach(function (it) { (itemsByDoc[it.docId] = itemsByDoc[it.docId] || []).push(it); });
  var pos = docs.filter(function (d) { return d.type === 'PO' && d.status !== 'cancelled'; });
  var inRange = function (dt) { return dt >= from && dt <= to; };
  var span = Math.round((purToDate_(to) - purToDate_(from)) / 864e5) + 1;
  var pFrom = Utilities.formatDate(new Date(purToDate_(from).getTime() - span * 864e5), PUR_TZ_, 'yyyy-MM-dd');
  var pTo = Utilities.formatDate(new Date(purToDate_(from).getTime() - 864e5), PUR_TZ_, 'yyyy-MM-dd');
  var vendorKey = function (d) { return d.vendorId || ('n:' + (d.vendorName || 'ไม่ระบุผู้ขาย')); };
  var vendorLabel = function (d) { return vName[d.vendorId] || d.vendorName || 'ไม่ระบุผู้ขาย'; };

  // 1) ยอดซื้อ
  var cur = pos.filter(function (d) { return inRange(d.orderDate); }), prev = pos.filter(function (d) { return d.orderDate >= pFrom && d.orderDate <= pTo; });
  var sum = function (list) { return purR2_(list.reduce(function (a, d) { return a + (Number(d.total) || 0); }, 0)); };
  var invCur = invoices.filter(function (x) { return inRange(x.invoiceDate); });
  var spend = { poTotal: sum(cur), poCount: cur.length, prevTotal: sum(prev), prevFrom: pFrom, prevTo: pTo,
    invTotal: purR2_(invCur.reduce(function (a, x) { return a + (Number(x.amount) || 0); }, 0)), invCount: invCur.length };
  spend.changePct = spend.prevTotal ? Math.round((spend.poTotal - spend.prevTotal) / spend.prevTotal * 1000) / 10 : '';

  // 4) สัดส่วนตามผู้ขาย + วัตถุดิบที่ซื้อจากผู้ขายรายเดียว (ดูย้อน 12 เดือน)
  var byV = {};
  cur.forEach(function (d) { var k = vendorKey(d), x = (byV[k] = byV[k] || { name: vendorLabel(d), total: 0, count: 0 }); x.total += Number(d.total) || 0; x.count++; });
  var vendorShare = Object.keys(byV).map(function (k) { var x = byV[k]; x.total = purR2_(x.total); x.share = spend.poTotal ? Math.round(x.total / spend.poTotal * 1000) / 10 : 0; return x; })
    .sort(function (a, c) { return c.total - a.total; });
  var yearAgo = Utilities.formatDate(new Date(purToDate_(to).getTime() - 365 * 864e5), PUR_TZ_, 'yyyy-MM-dd');
  var matVendors = {};
  pos.filter(function (d) { return d.orderDate >= yearAgo && d.orderDate <= to; }).forEach(function (d) {
    (itemsByDoc[d.id] || []).forEach(function (it) {
      var mk = it.materialId || ('n:' + it.materialName), x = (matVendors[mk] = matVendors[mk] || { name: (mInfo[it.materialId] || {}).name || it.materialName, vendors: {}, spend: 0 });
      x.vendors[vendorLabel(d)] = 1; x.spend += Number(it.amount) || 0;
    });
  });
  var singleSource = Object.keys(matVendors).map(function (k) { var x = matVendors[k]; return { name: x.name, vendor: Object.keys(x.vendors)[0], vendorCount: Object.keys(x.vendors).length, spend: purR2_(x.spend) }; })
    .filter(function (x) { return x.vendorCount === 1; }).sort(function (a, c) { return c.spend - a.spend; }).slice(0, 15);

  // 2) ราคาขึ้น/ลง: ราคาล่าสุดในช่วง เทียบราคาก่อนหน้า (ก่อนช่วง หรือรายการแรกในช่วง)
  var pByMat = {}; prices.forEach(function (p) { (pByMat[p.materialId] = pByMat[p.materialId] || []).push(p); });
  var priceChanges = [];
  Object.keys(pByMat).forEach(function (mid) {
    var list = pByMat[mid].sort(function (a, c) { return a.effectiveDate.localeCompare(c.effectiveDate) || String(a.createdAt).localeCompare(String(c.createdAt)); });
    var inR = list.filter(function (p) { return inRange(p.effectiveDate); }); if (!inR.length) return;
    var before = list.filter(function (p) { return p.effectiveDate < from; }), base = before.length ? before[before.length - 1] : (inR.length > 1 ? inR[0] : null);
    var last = inR[inR.length - 1]; if (!base || base === last || !base.price) return;
    var pct = Math.round((last.price - base.price) / base.price * 1000) / 10; if (!pct) return;
    priceChanges.push({ name: (mInfo[mid] || {}).name || mid, unit: (mInfo[mid] || {}).unit || '', vendor: vName[last.vendorId || (mInfo[mid] || {}).vendorId] || '', from: base.price, to: last.price, fromDate: base.effectiveDate, toDate: last.effectiveDate, pct: pct });
  });
  priceChanges.sort(function (a, c) { return c.pct - a.pct; });

  // 3) ส่งของช้า: PO ในช่วงที่มีวันส่ง เทียบวันรับของครั้งแรก + PO ที่เลยวันส่งแต่ยังไม่ได้รับ
  var firstRecv = {}, recvQty = {};
  moves.forEach(function (m) { if (m.type === 'IN' && m.docId) { if (!firstRecv[m.docId] || m.date < firstRecv[m.docId]) firstRecv[m.docId] = m.date; recvQty[m.docId] = (recvQty[m.docId] || 0) + (Number(m.qty) || 0); } });
  var dv = {};
  cur.forEach(function (d) {
    var r = firstRecv[d.id]; if (!r || !d.deliveryDate) return;
    var k = vendorKey(d), x = (dv[k] = dv[k] || { name: vendorLabel(d), delivered: 0, late: 0, lateDays: 0 });
    x.delivered++; var ld = Math.round((purToDate_(r) - purToDate_(d.deliveryDate)) / 864e5); if (ld > 0) { x.late++; x.lateDays += ld; }
  });
  var delivery = Object.keys(dv).map(function (k) { var x = dv[k]; x.onTimeRate = Math.round((x.delivered - x.late) / x.delivered * 100); x.avgLateDays = x.late ? Math.round(x.lateDays / x.late * 10) / 10 : 0; delete x.lateDays; return x; })
    .sort(function (a, c) { return a.onTimeRate - c.onTimeRate || c.late - a.late; });
  var overdue = pos.filter(function (d) { return /approved|ordered|partial/.test(d.status) && d.deliveryDate && d.deliveryDate < today; })
    .map(function (d) { return { docNo: d.docNo, vendor: vendorLabel(d), deliveryDate: d.deliveryDate, daysLate: Math.round((purToDate_(today) - purToDate_(d.deliveryDate)) / 864e5), partial: d.status === 'partial' }; })
    .sort(function (a, c) { return c.daysLate - a.daysLate; });

  // 5) PO ค้าง
  var openPOs = pos.filter(function (d) { return /approved|ordered|partial/.test(d.status) || (d.paymentStatus !== 'paid' && d.paymentStatus !== 'none'); }).map(function (d) {
    return { docNo: d.docNo, vendor: vendorLabel(d), orderDate: d.orderDate, deliveryDate: d.deliveryDate, total: d.total, due: purR2_((Number(d.total) || 0) - (Number(d.paidAmount) || 0)),
      waitGoods: /approved|ordered|partial/.test(d.status), partial: d.status === 'partial', unpaid: d.paymentStatus !== 'paid', dueDate: d.dueDate, overduePay: !!d.dueDate && d.dueDate < today && d.paymentStatus !== 'paid' };
  }).sort(function (a, c) { return String(a.orderDate).localeCompare(String(c.orderDate)); });

  // 6) โอกาสลดต้นทุน
  var opps = [];
  // 6.1 จ่ายแพงกว่าราคาต่ำสุดที่เคยได้ (12 เดือน: ราคา PO / ประวัติราคา / ใบเสนอราคา)
  var low = {};
  var seeLow = function (mid, price, src) { if (!mid || price === '' || price == null || !(price > 0)) return; if (!low[mid] || price < low[mid].price) low[mid] = { price: price, src: src }; };
  pos.filter(function (d) { return d.orderDate >= yearAgo && d.orderDate <= to; }).forEach(function (d) { (itemsByDoc[d.id] || []).forEach(function (it) { seeLow(it.materialId, Number(it.price), 'PO ' + d.docNo + ' (' + vendorLabel(d) + ')'); }); });
  prices.filter(function (p) { return p.effectiveDate >= yearAgo && p.effectiveDate <= to; }).forEach(function (p) { seeLow(p.materialId, Number(p.price), 'ราคา ' + p.effectiveDate); });
  var rfqItems = {}; rfqs.forEach(function (r) { rfqItems[r.id] = purJson_(r.items); });
  quotes.forEach(function (q) { var its = rfqItems[q.rfqId] || []; purJson_(q.items).forEach(function (p) { var it = its.filter(function (x) { return x.key === p.key; })[0]; if (it) seeLow(it.materialId, Number(p.price), 'ใบเสนอราคา ' + q.vendorName); }); });
  var paidMore = {};
  cur.forEach(function (d) {
    (itemsByDoc[d.id] || []).forEach(function (it) {
      var l = low[it.materialId], pr = Number(it.price), q = Number(it.qty) || 0;
      if (!l || !(pr > l.price + 0.005)) return;
      var x = (paidMore[it.materialId] = paidMore[it.materialId] || { name: (mInfo[it.materialId] || {}).name || it.materialName, unit: it.unit, low: l.price, lowSrc: l.src, paid: 0, qty: 0, extra: 0 });
      x.qty += q; x.paid += pr * q; x.extra += (pr - l.price) * q;
    });
  });
  Object.keys(paidMore).forEach(function (k) { var x = paidMore[k]; opps.push({ kind: 'price', title: x.name + ': จ่ายเฉลี่ย ' + purR2_(x.paid / x.qty) + ' แต่เคยได้ ' + x.low + ' ต่อ' + (x.unit || 'หน่วย'), detail: 'ราคาต่ำสุด: ' + x.lowSrc, amount: purR2_(x.extra) }); });
  // 6.2 เลือกผู้ขายที่ไม่ใช่ราคาต่ำสุด (ใบเปรียบเทียบที่ตัดสินในช่วงนี้)
  rfqs.filter(function (r) { return r.status === 'decided' && r.winnerId && inRange(String(r.decidedAt)); }).forEach(function (r) {
    var qs = quotes.filter(function (q) { return q.rfqId === r.id; }), win = qs.filter(function (q) { return q.id === r.winnerId; })[0];
    if (!win || qs.length < 2) return;
    var min = Math.min.apply(null, qs.map(function (q) { return Number(q.total) || 0; }));
    if (win.total > min + 0.005) opps.push({ kind: 'rfq', title: r.title + ': เลือก ' + win.vendorName + ' แพงกว่าราคาต่ำสุด', detail: 'เหตุผล: ' + (r.reason || '-'), amount: purR2_(win.total - min) });
  });
  // 6.3 ราคาขึ้น → เจรจา/หาราคาเทียบ (ไม่มีตัวเลข)
  priceChanges.filter(function (x) { return x.pct >= 5; }).slice(0, 5).forEach(function (x) { opps.push({ kind: 'up', title: x.name + ' ราคาขึ้น ' + x.pct + '%', detail: 'ควรขอใบเสนอราคาเทียบ / เจรจากับ ' + (x.vendor || 'ผู้ขาย'), amount: '' }); });
  // 6.4 ซื้อจากผู้ขายรายเดียว ยอดสูง → หาผู้ขายสำรองเพื่อเทียบราคา
  singleSource.slice(0, 3).filter(function (x) { return x.spend > 0; }).forEach(function (x) { opps.push({ kind: 'single', title: x.name + ' ซื้อจาก ' + x.vendor + ' รายเดียว (12 เดือน ' + String(purR2_(x.spend)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' บาท)', detail: 'หาผู้ขายสำรองและขอใบเสนอราคาเทียบ', amount: '' }); });
  opps.sort(function (a, c) { return (Number(c.amount) || 0) - (Number(a.amount) || 0); });
  var saveTotal = purR2_(opps.reduce(function (a, x) { return a + (Number(x.amount) || 0); }, 0));

  // 7) การเปรียบเทียบราคา: เรื่องที่สร้างหรือตัดสินในช่วงนี้ · ประหยัดได้ = ใบที่แพงที่สุด − ใบที่เลือก
  var rfqList = rfqs.filter(function (r) { return inRange(String(r.createdAt).slice(0, 10)) || (r.decidedAt && inRange(String(r.decidedAt))); }).map(function (r) {
    var qs = quotes.filter(function (q) { return q.rfqId === r.id; }), tot = qs.map(function (q) { return Number(q.total) || 0; });
    var win = qs.filter(function (q) { return q.id === r.winnerId; })[0], min = tot.length ? Math.min.apply(null, tot) : 0, max = tot.length ? Math.max.apply(null, tot) : 0;
    var po = r.poId ? docs.filter(function (d) { return d.id === r.poId; })[0] : null;
    return { title: r.title, quotes: qs.length, decided: !!win, winner: win ? win.vendorName : '', winTotal: win ? purR2_(win.total) : '', minTotal: purR2_(min), maxTotal: purR2_(max),
      cheapest: win ? win.total <= min + 0.005 : null, saved: win && qs.length > 1 ? purR2_(max - win.total) : 0, extra: win ? purR2_(win.total - min) : 0, reason: r.reason || '', decidedAt: r.decidedAt || '', poNo: po ? po.docNo : '' };
  }).sort(function (a, c) { return (a.decided ? 1 : 0) - (c.decided ? 1 : 0) || String(c.decidedAt).localeCompare(String(a.decidedAt)); });
  var rfqDec = rfqList.filter(function (x) { return x.decided; });
  var rfqSummary = { total: rfqList.length, decided: rfqDec.length, open: rfqList.length - rfqDec.length, cheapest: rfqDec.filter(function (x) { return x.cheapest; }).length,
    notCheapest: rfqDec.filter(function (x) { return !x.cheapest; }).length, saved: purR2_(rfqDec.reduce(function (a, x) { return a + x.saved; }, 0)),
    extra: purR2_(rfqDec.reduce(function (a, x) { return a + x.extra; }, 0)), avgQuotes: rfqList.length ? Math.round(rfqList.reduce(function (a, x) { return a + x.quotes; }, 0) / rfqList.length * 10) / 10 : 0,
    poWithRfq: cur.filter(function (d) { return d.rfqId; }).length, poCount: cur.length };
  return { rfq: rfqSummary, rfqList: rfqList.slice(0, 20), spend: spend, vendorShare: vendorShare.slice(0, 12), singleSource: singleSource, priceChanges: priceChanges.slice(0, 30),
    priceUp: priceChanges.filter(function (x) { return x.pct > 0; }).length, priceDown: priceChanges.filter(function (x) { return x.pct < 0; }).length,
    delivery: delivery, overdue: overdue.slice(0, 20), openPOs: openPOs.slice(0, 40), opportunities: opps.slice(0, 20), saveTotal: saveTotal,
    missingVendor: cur.filter(function (d) { return !d.vendorId; }).length, missingDelivery: cur.filter(function (d) { return !d.deliveryDate; }).length };
}

// ---------- ลบใบ PR / PO (ทดลองบันทึก / บันทึกผิด) ----------
// ลบได้เมื่อยังไม่มีการรับของที่อ้างอิงใบนี้ (กันยอดสต๊อกเพี้ยน) · ลบรายการ ใบแจ้งหนี้ และไฟล์แนบของใบนี้ด้วย
function purDeleteDoc(token, docId) {
  var dept = requirePur_(token);
  return purLocked_(function () {
    var ss = purBook_(dept), doc = purRead_(ss, 'docs').filter(function (x) { return x.id === docId; })[0];
    if (!doc) return { ok: false, error: 'ไม่พบเอกสารนี้' };
    var recv = purRead_(ss, 'moves').filter(function (m) { return m.docId === docId; });
    if (recv.length) return { ok: false, error: 'ใบนี้มีการรับของอ้างอิงอยู่ ' + recv.length + ' รายการ — ลบรายการรับของก่อน (เมนูรับเข้า/จ่ายออก → ประวัติ) หรือเปลี่ยนสถานะเป็น "ยกเลิก" แทน' };
    var trash = function (files) { purParseFiles_(files).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} }); };
    var delRows = function (name, rows) { var sh = purSheet_(ss, name); rows.sort(function (a, c) { return c - a; }).forEach(function (r) { sh.deleteRow(r); }); };
    var invs = purRead_(ss, 'invoices').filter(function (x) { return x.docId === docId; });
    invs.forEach(function (x) { trash(x.files); });
    delRows('invoices', invs.map(function (x) { return x._row; }));
    delRows('docItems', purRead_(ss, 'docItems').filter(function (x) { return x.docId === docId; }).map(function (x) { return x._row; }));
    purRead_(ss, 'rfqs').filter(function (r) { return r.poId === docId; }).forEach(function (r) { r.poId = ''; r.updatedAt = purNow_(); purWrite_(ss, 'rfqs', r); });
    trash(doc.files);
    purSheet_(ss, 'docs').deleteRow(doc._row);
    purLogWrite_(ss, 'ลบ', 'docs', docId, doc.type + ' ' + doc.docNo + ' ' + (doc.vendorName || '') + ' ฿' + doc.total + (invs.length ? ' (+ใบแจ้งหนี้ ' + invs.length + ')' : ''));
    return { ok: true };
  });
}
