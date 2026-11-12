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
