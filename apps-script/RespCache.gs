// ==================== เก็บผลลัพธ์หน้าอ่านอย่างเดียวของทุกแผนกไว้ (ผู้ใช้ขอ 26/11/69: "ทำแบบนี้กับทุกแผนก จะได้ไม่ช้า") ====================
// คำสั่งอ่านข้อมูล (RC_READ_) คำนวณครั้งแรกแล้วเก็บผลใน CacheService · ครั้งต่อไปตอบทันที
// ผลที่เก็บใช้ได้จนกว่า "ตราแก้ไข" ของแผนกนั้นเปลี่ยน (RCD_<แผนก>) หรือครบ 30 นาที (เผื่อแก้ในชีตด้วยมือ) · วันที่อยู่ในคีย์ด้วย
// ตราแก้ไข: ทุกคำสั่งที่ไม่ใช่การอ่าน (มี token ของแผนก) → ตราแผนกนั้นเปลี่ยน · ผู้ดูแลระบบแก้อะไร → ตรารวม (RCD__ALL) เปลี่ยน
// ทางที่แก้ข้อมูลโดยไม่มี token (แบบฟอร์มลา / ปุ่มอนุมัติใน LINE / LIFF) เรียก rcTouchDept_ เอง
// 'own' = อ่านข้อมูลแผนกตัวเอง · 'all' = อ่านข้ามแผนก (ผู้บริหาร / ต้นทุนสินค้า) → ใช้ตราของทุกแผนก
// 'target' = หน้าผู้บริหารของฝ่ายที่เลือก (args[1]) → ใช้ตราของฝ่ายนั้นเท่านั้น (ผู้ใช้ขอ 27/11/69: ฝ่ายอื่นบันทึกอะไร ไม่ต้องคำนวณใหม่)
var RC_READ_ = {
  accLoad: 'own', accDashboard: 'own', accCompare: 'own', accMonthly: 'own', apLoad: 'own', apIncome: 'own', cpLoad: 'own', exLoad: 'own',
  purLoad: 'own', purMoves: 'own', purReport: 'own', purStockReport: 'own', purPriceReport: 'own', purPriceHistory: 'own', purVendorMetrics: 'own', purVendorReport: 'own',
  sheLoad: 'own', sheChecks: 'own', sheMonthReport: 'own', sheFindingReport: 'own', sheDashboard: 'own', sheMonthly: 'own', sheDocs: 'own',
  hrLoad: 'own', hrPhotos: 'own', hrDailyLoad: 'own', hrDashboard: 'own', hrLeaves: 'own', hrTimeList: 'own', hrJobs: 'own',
  qaLoad: 'own', qaDashboard: 'own', rdLoad: 'own', rdDashboard: 'own', prdLoad: 'own', prdDashboard: 'own',
  costLoad: 'all', execOverview: 'all', execDashboard: 'target', execPart: 'target'
};
// คำสั่งที่ไม่แก้ข้อมูล (ไม่ต้องเปลี่ยนตรา) นอกเหนือจาก RC_READ_
var RC_NOWRITE_ = /^(getDepartments|getDepartmentHome|login|logout|getAdminStatus|adminOverview|adminDbStatus|adminSetDb|deptPerfLog|execVerify|.*Log|.*Info|.*Test|.*Diag|.*Preview|.*Status|.*List|.*Check|costPurPrices|purPoSigs|purPoFile|hrFormInit|hrFormFind|hrFormPhotos|hrFormBalance|hrLiffView|hrLiffLoad|hrLiffStatus|hrLiffInfo|apAiRead)$/;
var RC_TTL_ = 1800;
var RC_ALL_KEYS_ = null;
var RC_TARGET_EXTRA_ = { COST: ['PUR', 'RD'], ACC: [] };   // ต้นทุนสินค้าอ่านราคาจากจัดซื้อ + สูตรจาก R&D
function rcStampKeys_(kind, deptKey, target) {
  if (kind === 'target') return [target].concat(RC_TARGET_EXTRA_[target] || []).map(function (k) { return 'RCD_' + k; }).concat(['RCD__ALL']);
  if (kind !== 'all') return ['RCD_' + deptKey, 'RCD__ALL'];
  if (!RC_ALL_KEYS_) RC_ALL_KEYS_ = DEPARTMENTS.map(function (d) { return 'RCD_' + d.key; }).concat(['RCD__ALL']);
  return RC_ALL_KEYS_;
}
function rcStamp_(kind, deptKey, target) {
  var keys = rcStampKeys_(kind, deptKey, target), got = CacheService.getScriptCache().getAll(keys);
  return keys.map(function (k) { return got[k] || ''; }).join('.');
}
var RC_IN_CALL_ = false;   // อยู่ในคำสั่ง {fn} ของ doPost (การแก้ถูกจดทีละแท็บแล้ว)
function rcTouchDept_(deptKey) {
  try {
    var c = CacheService.getScriptCache();
    c.put('RCD_' + deptKey, Date.now() + '-' + Math.random().toString(36).slice(2, 8), 21600);
    if (deptKey !== '_ALL' && !DB_TRACK_ && !RC_IN_CALL_) c.put('DBD_' + deptKey, String(Date.now()), 21600);   // เส้นทางที่จดทีละแท็บไม่ได้ (เช่น LINE webhook) → ทั้งฝ่าย   // ฐานข้อมูลสำเนาของฝ่ายนี้ไม่สดแล้ว (DeptDb.gs)
  } catch (e) {}
}
// เรียกจาก doPost ก่อนและหลังทุกคำสั่ง
// คำสั่งที่ไม่แก้ข้อมูล · ชื่อที่มีคำว่า Save / Delete / Set … ถือว่าแก้ข้อมูลเสมอ (ผู้ใช้แจ้ง 27/11/69: ฝ่ายความปลอดภัยบันทึกแล้วไม่ขึ้น —
// sheSaveCheck ลงท้ายด้วย "Check" จึงถูกนับเป็นคำสั่งอ่าน ผลเดิมที่เก็บไว้ไม่หมดอายุ · เช่นเดียวกับ qaSaveTest / qaDeleteTest / sheDeleteCheck)
var RC_WRITE_HINT_ = /(Save|Delete|Set|Upload|Update|Import|Send|Decide|Remove|Add|Merge|Rename|Close|Receive|Ack|Confirm|Seen|Use|Move|New)/;
function rcIsRead_(fn) { return !RC_WRITE_HINT_.test(fn) && !!(RC_READ_[fn] || RC_NOWRITE_.test(fn)); }
function rcTouch_(fn, args) {
  if (rcIsRead_(fn)) return;
  var t = args && args[0];
  if (typeof t !== 'string' || t.length < 16) return;
  var key = sessionKey_(t);
  if (!key) return;
  rcTouchDept_(key === ADMIN_KEY_ ? '_ALL' : key);
  if (key !== ADMIN_KEY_ && /^(pur|cost|rd)/.test(fn)) rcTouchDept_('_ALL');   // ข้อมูลจัดซื้อ / R&D ถูกอ่านข้ามแผนก (ต้นทุนสินค้า)
}
function rcKey_(fn, deptKey, args) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, fn + '|' + JSON.stringify(args.slice(1)) + '|' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));
  return 'RC5_' + deptKey + '_' + h.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function rcGet_(key, stamp) {
  try {
    var c = CacheService.getScriptCache(), head = c.get(key);
    if (!head) return undefined;
    var m = JSON.parse(head);
    if (m.d !== stamp) return undefined;
    var keys = []; for (var i = 0; i < m.n; i++) keys.push(key + '_' + i);
    var parts = c.getAll(keys), s = '';
    for (var j = 0; j < m.n; j++) { if (parts[keys[j]] == null) return undefined; s += parts[keys[j]]; }
    return JSON.parse(s);
  } catch (e) { return undefined; }
}
function rcPut_(key, val, stamp) {
  try {
    var s = JSON.stringify(val), size = 90000, n = Math.ceil(s.length / size) || 1, map = {};
    if (n > 60) return;   // ใหญ่เกินไป ไม่เก็บ
    for (var i = 0; i < n; i++) map[key + '_' + i] = s.slice(i * size, (i + 1) * size);
    map[key] = JSON.stringify({ n: n, d: stamp });
    CacheService.getScriptCache().putAll(map, RC_TTL_);
  } catch (e) {}
}
function respCall_(fn, f, args) {
  var kind = RC_READ_[fn];
  if (!kind) return f.apply(null, args);
  var dept = requireDept_(args[0]);   // ตรวจสิทธิ์ก่อนเสมอ · คีย์แยกตามแผนก จึงไม่เห็นผลของแผนกอื่น
  var key = rcKey_(fn, dept.key, args), stamp = rcStamp_(kind, dept.key, String(args[1] || '').toUpperCase().replace(/[^A-Z_]/g, '')), hit = rcGet_(key, stamp);
  if (hit !== undefined) { if (typeof PERF_ !== 'undefined' && PERF_) PERF_.rc = 'hit'; return hit; }
  if (typeof PERF_ !== 'undefined' && PERF_) PERF_.rc = 'miss';
  var val = f.apply(null, args);
  rcPut_(key, val, stamp);
  return val;
}
