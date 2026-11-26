// ==================== ฐานข้อมูลสำเนา (Supabase) แยกตามฝ่าย (ผู้ใช้ขอ 26/11/69) ====================
// Google Sheet ยังเป็นข้อมูลหลัก · ฐานข้อมูลเก็บสำเนาไว้ให้ Dashboard อ่านเร็ว (เริ่มที่ฝ่ายบัญชี แล้วค่อยเพิ่มฝ่ายอื่น)
// แต่ละฝ่ายตั้งที่อยู่ + กุญแจของตัวเองได้ (คนละโปรเจกต์ หรือใช้โปรเจกต์เดียวกันก็ได้ — ตารางมีคอลัมน์ dept แยกไว้)
// เก็บรวมใน Script Property เดียว DEPT_DB = { ACC: { url, key, at } } (หน้าตั้งค่า Script Properties ครบ 50 ช่องแล้ว) · ไม่ส่งกุญแจกลับไปหน้าเว็บ
function deptDbAll_() {
  var p = props_(), m = {};
  try { m = JSON.parse(p.getProperty('DEPT_DB') || '{}') || {}; } catch (e) { m = {}; }
  // ค่าที่เคยใส่แบบเดิม (SUPABASE_URL / SUPABASE_SECRET_KEY) = ของฝ่ายบัญชี
  var u = String(p.getProperty('SUPABASE_URL') || '').trim(), k = String(p.getProperty('SUPABASE_SECRET_KEY') || '').trim();
  if (u && k && !m.ACC) { m.ACC = { url: u.replace(/\/+$/, ''), key: k, at: purNow_() }; p.setProperty('DEPT_DB', JSON.stringify(m)); }
  if (u || k) { p.deleteProperty('SUPABASE_URL'); p.deleteProperty('SUPABASE_SECRET_KEY'); }
  return m;
}
function deptDbCfg_(deptKey) { var c = deptDbAll_()[deptKey]; return c && c.url && c.key ? c : null; }
function deptDbHeaders_(k) { var h = { apikey: k }; if (k.indexOf('eyJ') === 0) h.Authorization = 'Bearer ' + k; return h; }
function deptDbCheck_(cfg) {
  try {
    var r = UrlFetchApp.fetch(cfg.url + '/rest/v1/dept_sync?select=tab&limit=1', { headers: deptDbHeaders_(cfg.key), muteHttpExceptions: true }), c = r.getResponseCode();
    if (c === 200) return { ok: true };
    var body = String(r.getContentText() || '');
    if (/42501|permission denied/i.test(body)) return { ok: false, error: 'กุญแจถูกต้อง แต่ตารางยังไม่เปิดสิทธิ์ — รันชุดคำสั่ง GRANT ใน SQL Editor ก่อน' };
    if (c === 401 || c === 403) return { ok: false, error: 'กุญแจไม่ถูกต้อง — ใช้กุญแจ Secret ที่ขึ้นต้นด้วย sb_secret_ (' + c + ': ' + body.replace(/\s+/g, ' ').slice(0, 120) + ')' };
    if (c === 404) return { ok: false, error: 'เชื่อมต่อได้ แต่ยังไม่พบตาราง — รันชุดคำสั่ง SQL ใน SQL Editor ก่อน' };
    return { ok: false, error: 'เชื่อมต่อไม่ได้ (รหัส ' + c + ')' };
  } catch (e) { return { ok: false, error: 'เชื่อมต่อไม่ได้ — ตรวจลิงก์ API URL (' + String(e.message || e).slice(0, 80) + ')' }; }
}
function deptDbOut_(d, c) {
  var o = { key: d.key, name: d.name, color: d.color, set: !!c };
  if (c) { var chk = deptDbCheck_(c); o.host = c.url.replace(/^https?:\/\//, ''); o.conn = chk.ok; o.error = chk.error || ''; o.at = c.at || ''; }
  return o;
}
// รายชื่อฝ่าย + สถานะการเชื่อมต่อของแต่ละฝ่าย
function adminDbStatus(token) {
  requireAdmin_(token);
  var all = deptDbAll_();
  return { ok: true, depts: activeDepartments_().filter(function (d) { return !d.exec && findDept_(d.key); }).map(function (d) {
    var c = all[d.key]; return deptDbOut_(d, c && c.url && c.key ? c : null);
  }) };
}
// ตั้งค่าของฝ่าย deptKey · key ว่าง = ใช้กุญแจเดิมของฝ่ายนี้ · url + key ว่างทั้งคู่ = ยกเลิกการเชื่อมต่อของฝ่ายนี้
function adminSetDb(token, deptKey, url, key) {
  requireAdmin_(token);
  var dept = findDept_(deptKey);
  if (!dept || dept.exec) return { ok: false, error: 'ไม่พบฝ่าย' };
  var all = deptDbAll_(), p = props_();
  // หน้า Data API ของ Supabase ให้ลิงก์ที่ต่อท้ายด้วย /rest/v1/ — ตัดส่วนท้ายออกเอง (ผู้ใช้วางมาแบบนั้น 26/11/69)
  url = String(url || '').trim().replace(/^(https:\/\/[a-z0-9-]+\.supabase\.co)(\/.*)?$/i, '$1').toLowerCase(); key = String(key || '').trim();
  if (!url && !key) { delete all[dept.key]; p.setProperty('DEPT_DB', JSON.stringify(all)); return { ok: true, dept: deptDbOut_(dept, null) }; }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return { ok: false, error: 'ลิงก์ต้องเป็นแบบ https://xxxx.supabase.co (คัดลอกจาก Data API → API URL)' };
  if (!key) { var old = all[dept.key]; if (!old || !old.key) return { ok: false, error: 'ใส่กุญแจ Secret (sb_secret_…)' }; key = old.key; }
  if (!/^(sb_secret_|eyJ)/.test(key)) return { ok: false, error: 'กุญแจต้องขึ้นต้นด้วย sb_secret_ (อย่าใช้กุญแจ Publishable)' };
  var chk = deptDbCheck_({ url: url, key: key });
  if (!chk.ok) return chk;
  all[dept.key] = { url: url, key: key, at: purNow_() };
  p.setProperty('DEPT_DB', JSON.stringify(all));
  return { ok: true, dept: deptDbOut_(dept, all[dept.key]) };
}

// ==================== ฝ่ายบัญชี: Dashboard อ่านจากฐานข้อมูลสำเนา (ผู้ใช้ขอ 26/11/69) ====================
// ไม่ใช้ตัวตั้งเวลา (ต้องขอสิทธิ์เพิ่ม) — ใช้กติกา:
//  · บันทึก / แก้ / ลบ ในระบบฝ่ายบัญชี → ตั้งธง "มีของใหม่" → ครั้งถัดไปที่เปิด Dashboard อ่านจากชีตแล้วคัดลอกขึ้นฐานข้อมูลทันที
//  · ไม่มีของใหม่ และคัดลอกล่าสุดไม่เกิน 30 นาที → อ่านจากฐานข้อมูล (เร็ว)
//  · เกิน 30 นาที (เผื่อมีคนแก้ในชีตโดยตรง) → อ่านจากชีตแล้วคัดลอกใหม่
//  · ฐานข้อมูลมีปัญหา → อ่านจากชีตเหมือนเดิม
var DB_STALE_MS_ = 30 * 60 * 1000;
var DB_ACC_TABS_ = { main: ['acc_settings', 'acc_711', 'acc_imports', 'ex_orders', 'ex_lines'], cp: ['cp_lines'], ap: ['ap_lines'] };
var DB_ACC_READS_ = /^(accLoad|accDashboard|accCompare|accMonthly|apLoad|cpLoad|exLoad|exCheck|cpPreview|apIncome|apAiStatus|apAiRead|accLineDiag|accLineOaInfo|accLineTest)$/;

// เรียกจาก doPost ทุกคำสั่ง: คำสั่งที่แก้ข้อมูลฝ่ายบัญชี → ตั้งธง
function deptDbNoteCall_(fn) {
  if (/^(acc|cp|ex|ap)[A-Z]/.test(fn) && !DB_ACC_READS_.test(fn)) CacheService.getScriptCache().put('DBD_ACC', String(Date.now()), 21600);
}
function dbFetch_(cfg, path, opt) {
  opt = opt || {};
  var o = { method: opt.method || 'get', headers: deptDbHeaders_(cfg.key), muteHttpExceptions: true };
  if (opt.body !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(opt.body); }
  var r = UrlFetchApp.fetch(cfg.url + path, o), c = r.getResponseCode();
  if (c < 200 || c >= 300) throw new Error('ฐานข้อมูลตอบกลับ ' + c + ': ' + String(r.getContentText()).slice(0, 160));
  return r.getContentText();
}
function dbReadTab_(cfg, dept, book, tab) {
  var out = [], size = 1000;
  for (var off = 0; off < 200000; off += size) {
    var q = '/rest/v1/dept_rows?select=data&dept=eq.' + encodeURIComponent(dept) + '&book=eq.' + encodeURIComponent(book) + '&tab=eq.' + encodeURIComponent(tab) + '&order=row_no.asc&limit=' + size + '&offset=' + off;
    var page = JSON.parse(dbFetch_(cfg, q) || '[]');
    page.forEach(function (x) { out.push(x.data); });
    if (page.length < size) break;
  }
  return out;
}
function dbReplaceTab_(cfg, dept, book, tab, rows) {
  dbFetch_(cfg, '/rest/v1/rpc/replace_tab', { method: 'post', body: { p_dept: dept, p_book: book, p_tab: tab, p_rows: rows } });
}
// สมุดเสมือน: purRead_ อ่านจากฐานข้อมูลแทนชีต (pre = แถวที่อ่านมาแล้วในคำขอนี้)
function dbBook_(deptKey, book, cfg, pre) {
  return { __db: { dept: deptKey, book: book, cfg: cfg, cache: pre || {} }, getId: function () { return 'db:' + deptKey + ':' + book; },
    getUrl: function () { return ''; }, getName: function () { return book; } };
}
function dbBookRead_(ss, name) {
  var d = ss.__db;
  if (!d.cache[name]) d.cache[name] = dbReadTab_(d.cfg, d.dept, d.book, name);
  return JSON.parse(JSON.stringify(d.cache[name]));
}
// สมุดย่อย (CP Ram / ค่าใช้จ่าย) ของสมุดเสมือน
function dbSubBook_(main, book) {
  var d = main.__db;
  if (d.pre && d.pre[book] === null) return null;
  return dbBook_(d.dept, book, d.cfg, d.pre && d.pre[book]);
}
// สมุดหลักฝ่ายบัญชีสำหรับ Dashboard: ฐานข้อมูล (ถ้าใช้ได้) หรือชีต
function accReadBook_(dept) {
  var cfg = deptDbCfg_(dept.key);
  if (!cfg) return purBook_(dept);
  var c = CacheService.getScriptCache(), dirty = c.get('DBD_ACC'), last = Number(c.get('DBS_ACC') || 0);
  if (!dirty && last && Date.now() - last < DB_STALE_MS_) return dbBook_(dept.key, 'main', cfg);
  var ss = purBook_(dept);
  try {
    c.remove('DBD_ACC');
    var pre = accDbSyncAll_(dept, ss, cfg);
    c.put('DBS_ACC', String(Date.now()), 21600);
    var b = dbBook_(dept.key, 'main', cfg, pre.main); b.__db.pre = pre;
    return b;
  } catch (e) { if (dirty) c.put('DBD_ACC', dirty, 21600); return ss; }
}
// อ่านทุกแท็บที่ Dashboard ใช้จากชีต แล้วคัดลอกขึ้นฐานข้อมูล
function accDbSyncAll_(dept, ss, cfg) {
  accRegister_(); try { exRegister_(); } catch (e) {} try { cpRegister_(); } catch (e) {} try { apRegister_(); } catch (e) {}
  var pre = { main: {}, cp: null, ap: null };
  var put = function (bk, book, tab, into) { var rows = purRead_(bk, tab); dbReplaceTab_(cfg, dept.key, book, tab, rows); into[tab] = rows; };
  DB_ACC_TABS_.main.forEach(function (t) { put(ss, 'main', t, pre.main); });
  var cs = null; try { cs = cpBook_(ss); } catch (e) { cs = null; }
  if (cs) { pre.cp = {}; DB_ACC_TABS_.cp.forEach(function (t) { put(cs, 'cp', t, pre.cp); }); }
  var as = null; try { as = apBook_(ss); } catch (e) { as = null; }
  if (as) { pre.ap = {}; DB_ACC_TABS_.ap.forEach(function (t) { put(as, 'ap', t, pre.ap); }); }
  return pre;
}
