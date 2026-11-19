// ==================== ฝ่ายบัญชี — เปรียบเทียบยอดสั่งซื้อแยกบริษัท / สินค้า (Dashboard) ====================
//
// ผู้ใช้ขอ 19/11/69: เทียบยอดสั่งสินค้าแต่ละตัว "ครั้งล่าสุด vs ครั้งก่อน" และ "เดือนล่าสุด vs เดือนก่อน" ทั้งจำนวนและยอดเงิน แยกทุกบริษัทที่สั่ง
//   CP ALL (7-Eleven)  → ครั้ง = วันที่สั่ง (poDate) · เดือนตามวันที่สั่ง · ลัง · บาท (ไม่รวม VAT)
//   CP Ram             → ครั้ง = วันส่งในตารางส่งสินค้า (ข้อมูลเดิมจาก Excel ไม่มีวันที่สั่ง) ถึงวันนี้ · เดือน = ทั้งเดือนตามตารางส่ง · ไม่นับที่ยกเลิก
//   ต่างประเทศ (แยกลูกค้า) → ครั้ง = วันที่ Invoice · ไม่นับที่ยกเลิก · สกุลเงินตาม Invoice
// เดือนล่าสุด = เดือนล่าสุดที่มีข้อมูล (ไม่เกินเดือนนี้) · เดือนก่อน = เดือนปฏิทินก่อนหน้า (ไม่มีข้อมูล = 0)

// ข้อมูลรายการสั่งซื้อของทุกบริษัท (ใช้ร่วมกัน: เปรียบเทียบใน Dashboard + รายงานสรุปรายเดือน)
function accSources_(dept) {
  accRegister_();
  var ss = purBook_(dept), map = accMap_(ss), out = [];
  var pn = {}, pc = {};
  map.products.forEach(function (p) { pn[p.key] = (p.l1 || '') + (p.l2 ? ' ' + p.l2 : ''); pc[p.key] = p.color || ''; });
  var l711 = purRead_(ss, 'acc_711').map(function (l) {
    return { date: String(l.poDate || '').slice(0, 10), name: pn[l.product] || l.itemName || l.product || '-', color: pc[l.product] || '', qty: Number(l.cases) || 0, amt: Number(l.amount) || 0, doc: String(l.poNo || '') };
  });
  out.push({ meta: { key: 'cpall', name: 'CP ALL (7-Eleven)', unit: 'ลัง', currency: 'บาท', basis: 'ตามวันที่สั่ง', note: 'ยอดเงินไม่รวม VAT', order: map.products.map(function (p) { return pn[p.key]; }) }, rows: l711, capToday: false });
  try {
    cpRegister_();
    var cs = cpBook_(ss);
    if (cs) {
      var cp = purRead_(cs, 'cp_lines').filter(function (l) { return l.status !== 'cancel'; }).map(function (l) {
        return { date: String(l.deliveryDate || '').slice(0, 10), name: l.product || ('รหัส ' + String(l.itemCode || '').replace(/^'/, '')), color: '', qty: Number(l.qty) || 0, amt: Number(l.amount) || 0, doc: String(l.poNo || '').replace(/^'/, '') };
      });
      out.push({ meta: { key: 'cpram', name: 'CP Ram', unit: 'ลัง', currency: 'บาท', basis: 'ตามวันส่งสินค้า (ครั้ง = วันส่งล่าสุดถึงวันนี้ · เดือน = ทั้งเดือนตามตารางส่ง)', note: 'ยอดเงินไม่รวม VAT · ไม่นับรายการที่ยกเลิก' }, rows: cp, capToday: true });
    }
  } catch (e) { out.push({ meta: { key: 'cpram', name: 'CP Ram' }, error: 'เปิดชีต CP Ram ไม่ได้' }); }
  try {
    exRegister_();
    var by = {};
    exOrders_(ss).filter(function (o) { return o.status !== 'cancel'; }).forEach(function (o) {
      var c = String(o.customer || 'ไม่ระบุลูกค้า').trim(), g = by[c] = by[c] || { rows: [], cur: o.currency || 'USD' };
      (o.items || []).forEach(function (it) { g.rows.push({ date: String(o.issueDate || '').slice(0, 10), name: it.name || it.code || '-', color: '', qty: Number(it.qty) || 0, amt: Number(it.amount) || 0, doc: String(o.invNo || '') }); });
    });
    Object.keys(by).sort().forEach(function (c, i) {
      out.push({ meta: { key: 'ex' + i, name: c, unit: '', currency: by[c].cur, basis: 'ตามวันที่ Invoice', note: 'ออเดอร์ต่างประเทศ · ไม่นับที่ยกเลิก', export: true }, rows: by[c].rows, capToday: false });
    });
  } catch (e) {}
  return out;
}
function accCompare(token) {
  var dept = requireAcc_(token), today = purToday_();
  return { ok: true, today: today, companies: accSources_(dept).map(function (s) {
    return s.error ? { key: s.meta.key, name: s.meta.name, error: s.error } : accCmp_(s.meta, s.rows, today, s.capToday);
  }) };
}
// รายงานสรุปรายเดือน ทุกบริษัท (ผู้ใช้ขอ 19/11/69): ทุกเดือนที่มีข้อมูล · ต่อบริษัท: จำนวน / ยอดเงิน / จำนวนเอกสาร ต่อเดือน + แยกสินค้า
// CP Ram นับตามวันส่ง (รวมวันส่งที่กำหนดไว้ในอนาคต → หน้าเว็บแสดงว่าเป็นยอดตามกำหนดส่ง)
function accMonthly(token) {
  var dept = requireAcc_(token), today = purToday_();
  return { ok: true, today: today, companies: accSources_(dept).map(function (s) {
    var m = s.meta;
    if (s.error) return { key: m.key, name: m.name, error: s.error };
    var months = {}, prods = {}, order = [];
    s.rows.forEach(function (r) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return;
      var ym = r.date.slice(0, 7), x = months[ym] = months[ym] || { qty: 0, amt: 0, docs: {} };
      x.qty += r.qty; x.amt += r.amt; if (r.doc) x.docs[r.doc] = 1;
      var p = prods[r.name];
      if (!p) { p = prods[r.name] = { name: r.name, color: r.color, m: {} }; order.push(r.name); }
      var pm = p.m[ym] = p.m[ym] || [0, 0]; pm[0] += r.qty; pm[1] += r.amt;
    });
    var r2 = function (v) { return Math.round(v * 100) / 100; };
    var mo = {}; Object.keys(months).forEach(function (k) { mo[k] = { qty: r2(months[k].qty), amt: r2(months[k].amt), docs: Object.keys(months[k].docs).length }; });
    var rank = m.order || [];
    var products = order.map(function (k) { var p = prods[k]; Object.keys(p.m).forEach(function (ym) { p.m[ym] = [r2(p.m[ym][0]), r2(p.m[ym][1])]; }); return p; })
      .sort(function (a, b) { var ia = rank.indexOf(a.name), ib = rank.indexOf(b.name); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.name.localeCompare(b.name); });
    return { key: m.key, name: m.name, unit: m.unit, currency: m.currency, basis: m.basis, note: m.note, export: !!m.export, future: !!s.capToday, months: mo, products: products };
  }) };
}
function accCmpMonthBefore_(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (!m) { y--; m = 12; } return y + '-' + ('0' + m).slice(-2); }
function accCmp_(meta, rows, today, capToday) {
  rows = rows.filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(r.date); });
  var dates = {}; rows.forEach(function (r) { if (!capToday || r.date <= today) dates[r.date] = 1; });   // ครั้ง: CP Ram นับถึงวันนี้ · เดือน: ทั้งเดือน (รวมวันส่งที่กำหนดไว้แล้ว)
  var ds = Object.keys(dates).sort(), lastD = ds[ds.length - 1] || '', prevD = ds[ds.length - 2] || '';
  var months = {}; rows.forEach(function (r) { if (r.date.slice(0, 7) <= today.slice(0, 7)) months[r.date.slice(0, 7)] = 1; });
  var ms = Object.keys(months).sort(), lastM = ms[ms.length - 1] || '', prevM = lastM ? accCmpMonthBefore_(lastM) : '';
  var P = {}, order = [];
  var add = function (r, slot) {
    var p = P[r.name];
    if (!p) { p = P[r.name] = { name: r.name, color: r.color, r: [0, 0, 0, 0], m: [0, 0, 0, 0] }; order.push(r.name); }
    var a = slot[0] === 'r' ? p.r : p.m, i = slot[1] === 'p' ? 0 : 2;
    a[i] += r.qty; a[i + 1] += r.amt;
  };
  rows.forEach(function (r) {
    if (r.date === prevD) add(r, 'rp'); if (r.date === lastD) add(r, 'rl');
    var ym = r.date.slice(0, 7);
    if (ym === prevM) add(r, 'mp'); if (ym === lastM) add(r, 'ml');
  });
  var round2 = function (a) { return a.map(function (v, i) { return i % 2 ? Math.round(v * 100) / 100 : Math.round(v * 100) / 100; }); };
  var products = order.map(function (k) { var p = P[k]; p.r = round2(p.r); p.m = round2(p.m); return p; })
    .sort(function (a, b) { return (b.r[2] + b.m[2]) - (a.r[2] + a.m[2]) || a.name.localeCompare(b.name); });
  var tot = function (k) { return round2(products.reduce(function (s, p) { return s.map(function (v, i) { return v + p[k][i]; }); }, [0, 0, 0, 0])); };
  return { key: meta.key, name: meta.name, unit: meta.unit, currency: meta.currency, basis: meta.basis, note: meta.note, export: !!meta.export,
    round: { prev: prevD, last: lastD }, month: { prev: prevM, last: lastM }, products: products, total: { r: tot('r'), m: tot('m') }, count: rows.length };
}
