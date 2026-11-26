// ==================== ฐานข้อมูลสำเนา (Supabase) ของระบบงานองค์กร (ผู้ใช้ขอ 26/11/69) ====================
// Google Sheet ยังเป็นข้อมูลหลัก · ฐานข้อมูลนี้เก็บสำเนาไว้ให้ Dashboard อ่านเร็ว (เริ่มที่ฝ่ายบัญชี)
// ที่อยู่ + กุญแจเก็บใน Script Properties (SUPABASE_URL / SUPABASE_SECRET_KEY) ใส่จากหน้าผู้ดูแลระบบ — ไม่อยู่ในโค้ด ไม่ส่งกลับไปหน้าเว็บ
function deptDbCfg_() {
  var p = props_(), u = String(p.getProperty('SUPABASE_URL') || '').trim().replace(/\/+$/, ''), k = String(p.getProperty('SUPABASE_SECRET_KEY') || '').trim();
  return u && k ? { url: u, key: k } : null;
}
function deptDbHeaders_(k) { var h = { apikey: k }; if (k.indexOf('eyJ') === 0) h.Authorization = 'Bearer ' + k; return h; }
function deptDbCheck_(cfg) {
  try {
    var r = UrlFetchApp.fetch(cfg.url + '/rest/v1/dept_sync?select=tab&limit=1', { headers: deptDbHeaders_(cfg.key), muteHttpExceptions: true }), c = r.getResponseCode();
    if (c === 200) return { ok: true };
    if (c === 401 || c === 403) return { ok: false, error: 'กุญแจไม่ถูกต้อง — ใช้กุญแจ Secret ที่ขึ้นต้นด้วย sb_secret_' };
    if (c === 404) return { ok: false, error: 'เชื่อมต่อได้ แต่ยังไม่พบตาราง — รันชุดคำสั่ง SQL ใน SQL Editor ก่อน' };
    return { ok: false, error: 'เชื่อมต่อไม่ได้ (รหัส ' + c + ')' };
  } catch (e) { return { ok: false, error: 'เชื่อมต่อไม่ได้ — ตรวจลิงก์ API URL (' + String(e.message || e).slice(0, 80) + ')' }; }
}
function adminDbStatus(token) {
  requireAdmin_(token);
  var c = deptDbCfg_();
  if (!c) return { ok: true, set: false };
  var chk = deptDbCheck_(c);
  return { ok: true, set: true, host: c.url.replace(/^https?:\/\//, ''), conn: chk.ok, error: chk.error || '' };
}
// url + key (key ว่าง = ใช้กุญแจเดิม) · ทั้งสองว่าง = ลบการเชื่อมต่อ
function adminSetDb(token, url, key) {
  requireAdmin_(token);
  var p = props_();
  url = String(url || '').trim().replace(/\/+$/, ''); key = String(key || '').trim();
  if (!url && !key) { p.deleteProperty('SUPABASE_URL'); p.deleteProperty('SUPABASE_SECRET_KEY'); return { ok: true, set: false }; }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return { ok: false, error: 'ลิงก์ต้องเป็นแบบ https://xxxx.supabase.co (คัดลอกจาก Data API → API URL)' };
  if (!key) { var old = deptDbCfg_(); if (!old) return { ok: false, error: 'ใส่กุญแจ Secret (sb_secret_…)' }; key = old.key; }
  if (!/^(sb_secret_|eyJ)/.test(key)) return { ok: false, error: 'กุญแจต้องขึ้นต้นด้วย sb_secret_ (อย่าใช้กุญแจ Publishable)' };
  var chk = deptDbCheck_({ url: url, key: key });
  if (!chk.ok) return chk;
  p.setProperty('SUPABASE_URL', url); p.setProperty('SUPABASE_SECRET_KEY', key);
  return adminDbStatus(token);
}
