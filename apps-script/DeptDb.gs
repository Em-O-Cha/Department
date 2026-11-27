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
  if (!key) {   // เว้นว่าง = กุญแจเดิมของฝ่ายนี้ หรือของฝ่ายอื่นที่ใช้โปรเจกต์เดียวกัน (ลิงก์เดียวกัน)
    var old = all[dept.key] && all[dept.key].url === url ? all[dept.key] : null;
    if (!old) Object.keys(all).some(function (k) { if (all[k] && all[k].url === url && all[k].key) { old = all[k]; return true; } return false; });
    if (!old && all[dept.key]) old = all[dept.key];
    if (!old || !old.key) return { ok: false, error: 'ใส่กุญแจ Secret (sb_secret_…)' };
    key = old.key;
  }
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
// ตั้งแต่ 27/11/69 จดทีละแท็บ (dbMarkTab_) แทนการถือว่าทั้งฝ่ายไม่สด — เหลือไว้เป็นชื่อเดิมเพื่อไม่ให้ Api.gs พัง
function deptDbNoteCall_(fn) {}
function dbFetch_(cfg, path, opt) {
  opt = opt || {};
  var o = { method: opt.method || 'get', headers: deptDbHeaders_(cfg.key), muteHttpExceptions: true };
  if (opt.body !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(opt.body); }
  var r = UrlFetchApp.fetch(cfg.url + path, o), c = r.getResponseCode();
  if (c < 200 || c >= 300) throw new Error('ฐานข้อมูลตอบกลับ ' + c + ': ' + String(r.getContentText()).slice(0, 160));
  return r.getContentText();
}
// อ่านแท็บจากฐานข้อมูล: จำนวนแถวจาก dept_sync (คัดลอกพร้อมกัน) → ดึงทุกหน้าพร้อมกันด้วย fetchAll (เดิมทีละหน้า = ช้าเมื่อแถวเยอะ)
function dbReadTab_(cfg, dept, book, tab, known) {
  var t0 = Date.now(), size = 1000, base = '/rest/v1/dept_rows?select=data&dept=eq.' + encodeURIComponent(dept) + '&book=eq.' + encodeURIComponent(book) + '&tab=eq.' + encodeURIComponent(tab) + '&order=row_no.asc&limit=' + size + '&offset=';
  var n = known >= 0 ? known : -1;
  if (n < 0) try {
    var s = JSON.parse(dbFetch_(cfg, '/rest/v1/dept_sync?select=rows&dept=eq.' + encodeURIComponent(dept) + '&book=eq.' + encodeURIComponent(book) + '&tab=eq.' + encodeURIComponent(tab)) || '[]');
    if (s.length) n = Number(s[0].rows) || 0;
  } catch (e) { n = -1; }
  var out = [];
  if (n >= 0) {
    var reqs = [];
    for (var off = 0; off < Math.max(n, 1); off += size) reqs.push({ url: cfg.url + base + off, method: 'get', headers: deptDbHeaders_(cfg.key), muteHttpExceptions: true });
    UrlFetchApp.fetchAll(reqs).forEach(function (r) {
      var c = r.getResponseCode();
      if (c < 200 || c >= 300) throw new Error('ฐานข้อมูลตอบกลับ ' + c);
      JSON.parse(r.getContentText() || '[]').forEach(function (x) { out.push(x.data); });
    });
    if (out.length !== n) throw new Error('จำนวนแถวไม่ตรง');   // กำลังคัดลอกอยู่ → อ่านจากชีตแทน
  } else {
    for (var o = 0; o < 200000; o += size) {
      var page = JSON.parse(dbFetch_(cfg, base + o) || '[]');
      page.forEach(function (x) { out.push(x.data); });
      if (page.length < size) break;
    }
  }
  if (PERF_) { PERF_.dbMs = (PERF_.dbMs || 0) + Date.now() - t0; PERF_.rows = (PERF_.rows || 0) + out.length; }
  return out;
}
// รูปที่ฝังในชีต (data:image… เช่น รูปย่อพนักงาน) ไม่คัดลอกขึ้นฐานข้อมูล (ผู้ใช้ขอ 27/11/69: ไม่ให้เปลืองพื้นที่ Supabase)
// หน้าที่ต้องใช้รูป (hrPhotos / hrFormPhotos / hrJobs) อ่านจากชีตโดยตรง
function dbNoImg_(rows) {
  return rows.map(function (r) {
    var o = {};
    Object.keys(r).forEach(function (k) { var v = r[k]; o[k] = typeof v === 'string' && v.indexOf('data:image/') === 0 ? '' : v; });
    return o;
  });
}
function dbReplaceTab_(cfg, dept, book, tab, rows) {
  rows = dbNoImg_(rows);
  dbFetch_(cfg, '/rest/v1/rpc/replace_tab', { method: 'post', body: { p_dept: dept, p_book: book, p_tab: tab, p_rows: rows } });
}
// สมุดเสมือน: purRead_ อ่านจากฐานข้อมูลแทนชีต · opener() = เปิดชีตจริง (เมื่อจำเป็นเท่านั้น)
function dbBook_(deptKey, book, cfg, opener, sheetId) {
  var d = { dept: deptKey, book: book, cfg: cfg, cache: {}, opener: opener, real: null, sheetId: sheetId || '' };
  var real = function () { if (!d.real) { d.real = opener(); try { CacheService.getScriptCache().put('DBN_' + deptKey + '_' + book, d.real.getName(), 21600); } catch (e) {} } return d.real; };
  d.realFn = real;
  // เขียนผ่านสมุดเสมือน (เช่น เปลี่ยนเป็นลาออกอัตโนมัติใน hrLoad) → ใช้ชีตจริง + ถือว่าสำเนาไม่สดแล้ว
  // เขียนผ่านสมุดเสมือน → ใช้ชีตจริง + จดว่าแท็บนั้นถูกแก้ (เฉพาะแท็บนั้น)
  var w = function (tab) { d.cache = {}; dbStampTab_(sheetId, tab); return real(); };
  return { __db: d, getId: function () { return sheetId || real().getId(); },
    getSheetByName: function (n) { return w(n).getSheetByName(n); }, insertSheet: function (n) { return w(n).insertSheet(n); },
    getSheets: function () { return real().getSheets(); }, getSpreadsheetTimeZone: function () { return PUR_TZ_; },
    getUrl: function () { return sheetId ? 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit' : real().getUrl(); },
    getName: function () { return CacheService.getScriptCache().get('DBN_' + deptKey + '_' + book) || real().getName(); } };
}
function dbBookRead_(ss, name) {
  var d = ss.__db;
  if (!d.cache[name]) {
    var c = CacheService.getScriptCache(), k = 'DBT_' + d.dept + '_' + d.book + '_' + name + (/^hr_(emps|jobs)$/.test(name) ? '_v2' : '');   // _v2 = คัดลอกใหม่ครั้งเดียวเพื่อลบรูปที่เคยขึ้นไปแล้ว
    var kv = String(c.get(k) || '').split('|'), ts = Number(kv[0] || 0), known = kv.length > 1 ? Number(kv[1]) : -1, dirty = Number(c.get('DBD_' + d.dept) || 0), now = Date.now(), rows = null;
    // ผู้ใช้แจ้ง 27/11/69 ว่ายังช้า 40 วิ: เดิมเชื่อสำเนาแค่ 30 นาที → เกินแล้วต้องอ่านชีต + อัปโหลดใหม่ทุกครั้ง (ช้ากว่าไม่มีฐานข้อมูล)
    // ตอนนี้: ใช้สำเนาได้ตราบใดที่ชีตยังไม่ถูกแก้ (เวลาแก้ไขล่าสุดของไฟล์ใน Drive ≤ เวลาที่คัดลอก) และระบบไม่ได้บันทึกอะไรหลังจากนั้น
    // แยกทีละแท็บ (ผู้ใช้ขอ 27/11/69): บันทึกแท็บไหน → อ่านใหม่จากชีตเฉพาะแท็บนั้น แท็บอื่นยังใช้สำเนา
    var tab = (PUR_TABLES_[name] || {}).tab || name, tabDirty = d.sheetId ? Number(c.get('DBW_' + d.sheetId + '_' + tab) || 0) : 0;
    var fresh = ts && ts > dirty && ts > tabDirty && (now - ts < DB_STALE_MS_ || dbSheetEdited_(d) <= Math.max(ts, dbSysWrite_(d) + 120000));
    if (fresh) { try { rows = dbReadTab_(d.cfg, d.dept, d.book, name, known); perfNote_('db'); } catch (e) { rows = null; } }
    if (!rows) {
      var t1 = Date.now();
      rows = purRead_(d.realFn(), name);   // ชีตจริง (ไม่มี __db)
      var full = rows; rows = dbNoImg_(rows);   // ให้ผลเหมือนอ่านจากฐานข้อมูล (ไม่มีรูป) ทุกครั้ง
      perfNote_('sheet'); if (PERF_) PERF_.sheetMs = (PERF_.sheetMs || 0) + Date.now() - t1;
      try { dbReplaceTab_(d.cfg, d.dept, d.book, name, full); c.put(k, now + '|' + rows.length, 21600); } catch (e) {}
    }
    d.cache[name] = rows;
  }
  return JSON.parse(JSON.stringify(d.cache[name]));
}
// ---------- แท็บไหนถูกแก้ (แยกทีละแท็บ) ----------
// DB_READING_ = purRead_ กำลังอ่าน (ไม่ใช่การแก้) · DB_TRACK_ = คำสั่งที่กำลังทำงานเป็นคำสั่งบันทึก (doPost ตั้งให้)
var DB_READING_ = false, DB_TRACK_ = null;
function dbStampTab_(sheetId, tab) {
  if (!sheetId || !tab) return;
  try {
    var c = CacheService.getScriptCache(), now = String(Date.now());
    c.putAll(function () { var o = {}; o['DBW_' + sheetId + '_' + tab] = now; o['DBS_' + sheetId] = now; return o; }(), 21600);
  } catch (e) {}
  if (DB_TRACK_) DB_TRACK_[sheetId + '\u0001' + tab] = 1;
}
// เรียกจาก purSheet_ (ชีตจริง) เมื่อไม่ใช่การอ่าน · ไม่รู้ว่าเป็นไฟล์ไหน = ข้าม
function dbMarkTab_(ss, tab) {
  if (!ss || ss.__db) return;
  var id = ''; try { id = ss.getId(); } catch (e) { return; }
  if (DB_TRACK_ && DB_TRACK_[id + '\u0001' + tab]) return;   // จดไปแล้วในคำสั่งนี้
  dbStampTab_(id, tab);
}
// จบคำสั่งบันทึก: จดเวลาอีกครั้ง (คนที่อ่านระหว่างกำลังบันทึกจะได้ไม่ใช้สำเนาที่ยังไม่ครบ)
function dbTrackStart_(isWrite) { DB_TRACK_ = isWrite ? {} : null; }
function dbTrackEnd_() {
  var t = DB_TRACK_; DB_TRACK_ = null;
  if (!t) return;
  Object.keys(t).forEach(function (k) { var p = k.split('\u0001'); dbStampTab_(p[0], p[1]); });
}
// เวลาที่ระบบบันทึกลงไฟล์นี้ล่าสุด (ใช้แยกว่าไฟล์เปลี่ยนเพราะระบบ ไม่ใช่มีคนแก้ในชีตเอง)
function dbSysWrite_(d) { return d.sheetId ? Number(CacheService.getScriptCache().get('DBS_' + d.sheetId) || 0) : 0; }
// เวลาแก้ไขล่าสุดของไฟล์ชีต (ms) — เก็บไว้ 60 วิ ต่อไฟล์ · อ่านไม่ได้ = ถือว่าเพิ่งแก้ (อ่านชีต)
function dbSheetEdited_(d) {
  if (!d.sheetId) return Infinity;
  if (d.edited != null) return d.edited;
  var c = CacheService.getScriptCache(), k = 'DBE_' + d.sheetId, v = c.get(k);
  if (v) return (d.edited = Number(v));
  try { d.edited = DriveApp.getFileById(d.sheetId).getLastUpdated().getTime(); c.put(k, String(d.edited), 60); } catch (e) { d.edited = Infinity; }
  return d.edited;
}
// ---------- บันทึกเวลาที่ใช้ต่อคำสั่ง (ไว้ตรวจว่าช้าตรงไหน; ไม่มีข้อมูลลูกค้า) ----------
var PERF_ = null;
function perfStart_(fn) { PERF_ = { fn: fn, t0: Date.now(), db: 0, sheet: 0, rc: '' }; }
function perfNote_(kind) { if (PERF_) PERF_[kind] = (PERF_[kind] || 0) + 1; }
function perfEnd_() {
  if (!PERF_) return;
  try {
    var c = CacheService.getScriptCache(), list = JSON.parse(c.get('PERF_LOG') || '[]');
    list.unshift({ at: Utilities.formatDate(new Date(), PUR_TZ_, 'dd/MM HH:mm:ss'), fn: PERF_.fn, ms: Date.now() - PERF_.t0, cache: PERF_.rc, dbTabs: PERF_.db, sheetTabs: PERF_.sheet, dbMs: PERF_.dbMs || 0, rows: PERF_.rows || 0, sheetMs: PERF_.sheetMs || 0 });
    c.put('PERF_LOG', JSON.stringify(list.slice(0, 60)), 21600);
  } catch (e) {}
  PERF_ = null;
}
// สาธารณะ (ไม่มีข้อมูลลับ): ชื่อคำสั่ง + เวลาที่ใช้ล่าสุด 60 รายการ
function deptPerfLog() { return { ok: true, log: JSON.parse(CacheService.getScriptCache().get('PERF_LOG') || '[]') }; }
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


// สมุดฝ่ายบุคคลสำหรับคำสั่งที่อ่านอย่างเดียว (ผู้ใช้ขอ 27/11/69): ฐานข้อมูลสำเนา (ถ้าเชื่อมต่อ HR ไว้) หรือชีต
// prep = ลงทะเบียนตารางเพิ่ม (hr_jobs / hr_time / hr_daily) · การบันทึกยังใช้ hrBook_ (ชีตจริง) เหมือนเดิม
function hrReadBook_(dept, prep) {
  hrRegister_();
  if (prep) prep();
  var cfg = deptDbCfg_(dept.key);
  if (!cfg) return hrBook_(dept);
  return dbBook_(dept.key, 'main', cfg, function () { return hrBook_(dept); }, deptConfig_(dept.key).sheetId);
}
function hrPrepJob_() { PUR_TABLES_.hr_jobs = HRJ_TABLE_; PUR_NUM_KEYS_.seq = 1; }
function hrPrepTime_() { PUR_TABLES_.hr_time = HRT_TABLE_; PUR_NUM_KEYS_.lateMin = 1; PUR_NUM_KEYS_.earlyMin = 1; }
function hrPrepDaily_() { PUR_TABLES_.hr_daily = HRD_TABLE_; PUR_NUM_KEYS_.total = 1; PUR_NUM_KEYS_.leaveCount = 1; PUR_NUM_KEYS_.resign = 1; }

// สมุดฝ่ายจัดซื้อสำหรับคำสั่งที่อ่านอย่างเดียว (ผู้ใช้ขอ 27/11/69): ฐานข้อมูลสำเนา (ถ้าเชื่อมต่อ PUR ไว้) หรือชีต · การบันทึกยังใช้ purBook_
function purReadBook_(dept) {
  var cfg = deptDbCfg_(dept.key);
  if (!cfg) return purBook_(dept);
  return dbBook_(dept.key, 'main', cfg, function () { return purBook_(dept); }, deptConfig_(dept.key).sheetId);
}
