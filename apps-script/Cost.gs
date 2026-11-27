// ==================== ต้นทุนสินค้า (การ์ด COST แยกจาก RD — ผู้ใช้ขอ 24/11/69) ====================
// เข้าได้ทั้งจากการ์ด COST (รหัสผ่านของตัวเอง) และจาก RD · ข้อมูลต้นทุนอยู่ในชีต / โฟลเดอร์ของฝ่าย RD (แท็บ ต้นทุนสินค้า)
// ราคาวัตถุดิบดึงจากระบบจัดซื้อ & สต๊อก (PUR): รายการสินค้าของผู้ขาย + ราคาปัจจุบันของวัตถุดิบ + ประวัติราคาล่าสุดต่อผู้ขาย
function costDept_(token) {
  var dept = requireDept_(token), m = DEPT_MODULES_[dept.key];
  if (m !== 'rd' && m !== 'cost') throw new Error('แผนกนี้ไม่มีระบบต้นทุนสินค้า');
  return costHome_();
}
// ที่เก็บข้อมูลต้นทุน: ชีต / โฟลเดอร์ของการ์ด COST ถ้าผูกแล้ว (ผู้ใช้ 24/11/69) · ยังไม่ผูก = ใช้ของฝ่าย RD เหมือนเดิม
function costHome_() {
  var key = deptConfig_('COST').sheetId ? 'COST' : 'RD';
  return DEPARTMENTS.filter(function (x) { return x.key === key; })[0];
}
// ผูกชีต COST ครั้งแรก: คัดลอกต้นทุนที่เคยบันทึกในชีต RD มาให้ (ครั้งเดียว · ชีต RD ไม่ถูกแก้)
function costMigrate_(ss) {
  var P = PropertiesService.getScriptProperties(), flag = 'COST_MIGRATED_' + deptConfig_('COST').sheetId;
  if (P.getProperty(flag)) return;
  if (!deptConfig_('RD').sheetId || purRead_(ss, 'rd_costs').length) { P.setProperty(flag, '1'); return; }
  var rd = DEPARTMENTS.filter(function (x) { return x.key === 'RD'; })[0], rows = [];
  try { rows = purRead_(rdBook_(rd), 'rd_costs'); } catch (e) { return; }
  rows.forEach(function (r) { var o = Object.assign({}, r); delete o._row; purWrite_(ss, 'rd_costs', o); });
  if (rows.length) purLogWrite_(ss, 'คัดลอกต้นทุนจากชีต RD', 'rd_costs', '', rows.length + ' รายการ');
  P.setProperty(flag, '1');
}
function costPurItems_() {
  var pur = DEPARTMENTS.filter(function (x) { return x.key === 'PUR'; })[0], ss;
  try { ss = purReadBook_(pur); } catch (e) { return { items: [], error: 'เปิดข้อมูลฝ่ายจัดซื้อไม่ได้: ' + (e && e.message || e) }; }
  var vendors = purRead_(ss, 'vendors'), vmap = {}, items = [], best = {};
  vendors.forEach(function (v) { vmap[v.id] = v; });
  var put = function (x) {
    if (!x.name || x.price === '' || x.price == null || isNaN(Number(x.price))) return;
    var k = String(x.name).replace(/\s+/g, '') + '|' + (x.vendorId || x.vendor) + '|' + x.unit;
    if (best[k] && String(best[k].date || '') >= String(x.date || '')) return;
    best[k] = x;
  };
  vendors.forEach(function (v) {
    if (v.active === 'ปิด') return;
    purVendorProducts_(purJson_(v.products)).forEach(function (p) { put({ name: p.name, unit: p.unit, price: Number(p.price), date: p.date || '', vendor: v.name, vendorId: v.id, src: 'ผู้ขาย' }); });
  });
  var mats = purRead_(ss, 'materials'), mmap = {};
  mats.forEach(function (m) {
    mmap[m.id] = m; if (m.active === 'ปิด') return;
    var v = vmap[m.vendorId];
    if (m.price !== '') put({ name: m.name, unit: m.unit, price: Number(m.price), date: m.priceDate || '', vendor: v ? v.name : '', vendorId: m.vendorId || '', src: 'วัตถุดิบ' });
  });
  purRead_(ss, 'prices').forEach(function (h) {
    var m = mmap[h.materialId], v = vmap[h.vendorId];
    if (!m || m.active === 'ปิด') return;
    put({ name: m.name, unit: m.unit, price: Number(h.price), date: h.effectiveDate || '', vendor: v ? v.name : '', vendorId: h.vendorId || '', src: 'ประวัติราคา' });
  });
  Object.keys(best).forEach(function (k) { items.push(best[k]); });
  items.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)) || a.price - b.price; });
  return { items: items.slice(0, 3000) };
}
// โหลดหน้าต้นทุน (การ์ด COST)
function costLoad(token) {
  var home = costDept_(token), ss = rdReadBook_(home), today = purToday_(), prods = [];
  if (home.key === 'COST') purLocked_(function () { costMigrate_(ss); });
  try {
    var rd = DEPARTMENTS.filter(function (x) { return x.key === 'RD'; })[0];
    if (deptConfig_('RD').sheetId) prods = purRead_(home.key === 'RD' ? ss : rdReadBook_(rd), 'rd_products').map(function (p) { return rdOut_(p, today); });
  } catch (e) {}
  return { ok: true, today: today, settings: rdSettings_(ss), costs: purRead_(ss, 'rd_costs').map(rdCostOut_),
    products: prods, pur: costPurItems_(), hasFolder: !!deptConfig_(home.key).folderId, home: home.key };
}
// ราคาจากจัดซื้อ (ใช้ทั้งการ์ด COST และ RD)
function costPurPrices(token) { costDept_(token); return Object.assign({ ok: true }, costPurItems_()); }

// Dashboard ต้นทุนสินค้า สำหรับหน้าผู้บริหาร (ผู้ใช้ขอ 26/11/69) — ข้อมูลเดียวกับหน้าการ์ด COST (COSTM.dashHtml คิดในหน้าเว็บ)
// ราคาจัดซื้อส่งเฉพาะผู้ขายที่ใช้ในสูตรต้นทุน (ข้อมูลไม่ใหญ่เกิน)
function costDashData_() {
  var home = costHome_(), ss = rdReadBook_(home), costs = purRead_(ss, 'rd_costs').map(rdCostOut_), used = {};
  costs.forEach(function (c) { (c.ingredients || []).concat(c.packaging || []).forEach(function (x) { if (x && x.vendor) used[x.vendor] = 1; }); });
  var pur = costPurItems_();
  return { kind: 'cost', today: purToday_(), costs: costs, pur: { items: (pur.items || []).filter(function (x) { return used[x.vendor]; }), error: pur.error } };
}
