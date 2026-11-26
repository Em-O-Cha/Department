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

// ==================== ฝ่ายบัญชี: ทุกหน้าอ่านจากฐานข้อมูลสำเนา (ผู้ใช้ขอ 26/11/69) ====================
// อ่านทีละแท็บ ไม่ใช้ตัวตั้งเวลา (ต้องขอสิทธิ์เพิ่ม):
//  · แท็บที่คัดลอกขึ้นฐานข้อมูลหลังการแก้ไขครั้งล่าสุด และไม่เกิน 30 นาที → อ่านจากฐานข้อมูล (เร็ว)
//  · มีการบันทึก / แก้ / ลบ ในระบบฝ่ายบัญชีหลังจากนั้น หรือเกิน 30 นาที (เผื่อแก้ในชีตโดยตรง) → อ่านแท็บนั้นจากชีต แล้วคัดลอกขึ้นฐานข้อมูล
//  · ฐานข้อมูลมีปัญหา → อ่านจากชีตเหมือนเดิม
// การบันทึกทั้งหมดยังเขียนลง Google Sheet (ข้อมูลหลัก) เหมือนเดิม
var DB_STALE_MS_ = 30 * 60 * 1000;
var DB_ACC_READS_ = /^(accLoad|accDashboard|accCompare|accMonthly|acc711Report|acc711Preview|apLoad|cpLoad|exLoad|exCheck|cpPreview|apIncome|apAiStatus|apAiRead|accLineDiag|accLineOaInfo|accLineTest)$/;

// เรียกจาก doPost ทุกคำสั่ง (ก่อนและหลังทำงาน): คำสั่งที่แก้ข้อมูลฝ่ายบัญชี → จดเวลาที่แก้
function deptDbNoteCall_(fn) {
  if (/^(acc|cp|ex|ap)[A-Z0-9]/.test(fn) && !DB_ACC_READS_.test(fn)) CacheService.getScriptCache().put('DBD_ACC', String(Date.now()), 21600);
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
// สมุดเสมือน: purRead_ อ่านจากฐานข้อมูลแทนชีต · opener() = เปิดชีตจริง (เมื่อจำเป็นเท่านั้น)
function dbBook_(deptKey, book, cfg, opener, sheetId) {
  var d = { dept: deptKey, book: book, cfg: cfg, cache: {}, opener: opener, real: null };
  var real = function () { if (!d.real) { d.real = opener(); try { CacheService.getScriptCache().put('DBN_' + deptKey + '_' + book, d.real.getName(), 21600); } catch (e) {} } return d.real; };
  d.realFn = real;
  return { __db: d, getId: function () { return sheetId || real().getId(); },
    getUrl: function () { return sheetId ? 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit' : real().getUrl(); },
    getName: function () { return CacheService.getScriptCache().get('DBN_' + deptKey + '_' + book) || real().getName(); } };
}
function dbBookRead_(ss, name) {
  var d = ss.__db;
  if (!d.cache[name]) {
    var c = CacheService.getScriptCache(), k = 'DBT_' + d.dept + '_' + d.book + '_' + name;
    var ts = Number(c.get(k) || 0), dirty = Number(c.get('DBD_' + d.dept) || 0), now = Date.now(), rows = null;
    if (ts && ts > dirty && now - ts < DB_STALE_MS_) { try { rows = dbReadTab_(d.cfg, d.dept, d.book, name); } catch (e) { rows = null; } }
    if (!rows) {
      rows = purRead_(d.realFn(), name);   // ชีตจริง (ไม่มี __db)
      try { dbReplaceTab_(d.cfg, d.dept, d.book, name, rows); c.put(k, String(now), 21600); } catch (e) {}
    }
    d.cache[name] = rows;
  }
  return JSON.parse(JSON.stringify(d.cache[name]));
}
// สมุดย่อย CP Ram / ค่าใช้จ่าย ของสมุดเสมือน
function dbSubBook_(main, book, id, prep) {
  var d = main.__db;
  return dbBook_(d.dept, book, d.cfg, function () { var ss = SpreadsheetApp.openById(id); try { if (ss.getSpreadsheetTimeZone() !== PUR_TZ_) ss.setSpreadsheetTimeZone(PUR_TZ_); } catch (e) {} if (prep) prep(ss); return ss; }, id);
}
// สมุดหลักฝ่ายบัญชีสำหรับหน้าที่อ่านอย่างเดียว: ฐานข้อมูล (ถ้าเชื่อมต่อไว้) หรือชีต
function accReadBook_(dept) {
  var cfg = deptDbCfg_(dept.key);
  if (!cfg) return purBook_(dept);
  return dbBook_(dept.key, 'main', cfg, function () { return purBook_(dept); }, deptConfig_(dept.key).sheetId);
}

// ==================== เก็บผลลัพธ์หน้าอ่านอย่างเดียวของฝ่ายบัญชีไว้ (ผู้ใช้บอก 26/11/69 ว่ายังช้าแม้ใช้ฐานข้อมูลสำเนา) ====================
// คำนวณ Dashboard / ตาราง ครั้งแรกแล้วเก็บผลไว้ใน CacheService · ครั้งต่อไปตอบทันทีจนกว่าจะมีการแก้ข้อมูลฝ่ายบัญชี (DBD_ACC เปลี่ยน)
// หรือครบ 30 นาที (เผื่อแก้ในชีตด้วยมือ / วันที่เปลี่ยน) · ผลใหญ่เกิน 100KB แบ่งเก็บหลายช่อง
var RC_FNS_ = { accLoad: 1, accDashboard: 1, accCompare: 1, accMonthly: 1, apLoad: 1, apIncome: 1, cpLoad: 1, exLoad: 1 };
var RC_TTL_ = 1800;
function rcKey_(fn, deptKey, args) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(args.slice(1)) + '|' + Utilities.formatDate(new Date(), PUR_TZ_, 'yyyy-MM-dd'));
  return 'RC_' + fn + '_' + deptKey + '_' + h.map(function (b) { return ((b + 256) % 256).toString(16); }).join('');
}
function rcGet_(key) {
  try {
    var c = CacheService.getScriptCache(), head = c.get(key);
    if (!head) return undefined;
    var m = JSON.parse(head);
    if (String(m.d) !== String(c.get('DBD_ACC') || '')) return undefined;   // มีการแก้ข้อมูลหลังเก็บผล
    var keys = []; for (var i = 0; i < m.n; i++) keys.push(key + '_' + i);
    var parts = c.getAll(keys), s = '';
    for (var j = 0; j < m.n; j++) { if (parts[keys[j]] == null) return undefined; s += parts[keys[j]]; }
    return JSON.parse(s);
  } catch (e) { return undefined; }
}
function rcPut_(key, val) {
  try {
    var c = CacheService.getScriptCache(), s = JSON.stringify(val), size = 90000, map = {}, n = Math.ceil(s.length / size) || 1;
    if (n > 40) return;   // ใหญ่เกินไป ไม่เก็บ
    for (var i = 0; i < n; i++) map[key + '_' + i] = s.slice(i * size, (i + 1) * size);
    c.putAll(map, RC_TTL_);
    c.put(key, JSON.stringify({ n: n, d: c.get('DBD_ACC') || '' }), RC_TTL_);
  } catch (e) {}
}
// เรียกจาก doPost: คืนผลที่เก็บไว้ (ตรวจสิทธิ์ก่อนเสมอ) หรือคำนวณใหม่แล้วเก็บ
function rcCall_(fn, f, args) {
  if (!RC_FNS_[fn]) return f.apply(null, args);
  var dept = requireAcc_(args[0]), key = rcKey_(fn, dept.key, args), hit = rcGet_(key);
  if (hit !== undefined) return hit;
  var val = f.apply(null, args);
  rcPut_(key, val);
  return val;
}
