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
