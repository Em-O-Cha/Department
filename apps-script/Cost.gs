// ==================== ต้นทุนสินค้า (การ์ด COST แยกจาก RD — ผู้ใช้ขอ 24/11/69) ====================
// เข้าได้ทั้งจากการ์ด COST (รหัสผ่านของตัวเอง) และจาก RD · ข้อมูลต้นทุนอยู่ในชีต / โฟลเดอร์ของฝ่าย RD (แท็บ ต้นทุนสินค้า)
// ราคาวัตถุดิบดึงจากระบบจัดซื้อ & สต๊อก (PUR): รายการสินค้าของผู้ขาย + ราคาปัจจุบันของวัตถุดิบ + ประวัติราคาล่าสุดต่อผู้ขาย
function costDept_(token) {
  var dept = requireDept_(token), m = DEPT_MODULES_[dept.key];
  if (m !== 'rd' && m !== 'cost') throw new Error('แผนกนี้ไม่มีระบบต้นทุนสินค้า');
  return DEPARTMENTS.filter(function (x) { return x.key === 'RD'; })[0];
}
function costPurItems_() {
  var pur = DEPARTMENTS.filter(function (x) { return x.key === 'PUR'; })[0], ss;
  try { ss = purBook_(pur); } catch (e) { return { items: [], error: 'เปิดข้อมูลฝ่ายจัดซื้อไม่ได้: ' + (e && e.message || e) }; }
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
  var rd = costDept_(token), ss = rdBook_(rd), today = purToday_();
  return { ok: true, today: today, settings: rdSettings_(ss), costs: purRead_(ss, 'rd_costs').map(rdCostOut_),
    products: purRead_(ss, 'rd_products').map(function (p) { return rdOut_(p, today); }), pur: costPurItems_(), hasFolder: !!deptConfig_('RD').folderId };
}
// ราคาจากจัดซื้อ (ใช้ทั้งการ์ด COST และ RD)
function costPurPrices(token) { costDept_(token); return Object.assign({ ok: true }, costPurItems_()); }
