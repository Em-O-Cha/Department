// ==================== รหัสผ่าน: แต่ละแผนกตั้ง/เปลี่ยนเองในเว็บแอป ====================
//
// หลักการ: รหัสผ่านของแผนกรู้แค่คนในแผนกนั้น — ผู้ดูแลระบบ "ไม่เห็นและตั้งรหัสผ่านแทนแผนกไม่ได้"
//   - ผู้ดูแลระบบ (เจ้าของระบบ) ทำได้แค่ "ออกรหัสตั้งค่า" ใช้ครั้งเดียว ให้แผนก (ไม่ใช่รหัสผ่าน)
//     แผนกเอารหัสตั้งค่าไปตั้งรหัสผ่านของตัวเองในหน้าเว็บ — ใช้ทั้งตอนตั้งครั้งแรกและตอนลืมรหัส
//   - แผนกเปลี่ยนรหัสผ่านเองได้ตลอด (ต้องใส่รหัสเดิม)
//   - เปลี่ยน/รีเซ็ตรหัสแล้ว ตั๋วเข้าระบบเก่าของแผนกนั้นใช้ไม่ได้ทันที
//   - ผู้ดูแลระบบเข้าด้วยรหัสของตัวเอง ตั้งครั้งแรก/ลืมรหัส = ยืนยันด้วยรหัส 6 หลักที่ส่งไปอีเมลเจ้าของระบบ
//   - ไม่ตรวจว่ารหัสซ้ำกับแผนกอื่น (ถ้าตรวจ แผนกหนึ่งจะลองเดารหัสของแผนกอื่นได้) — แต่ละรหัสใช้ได้แค่กับแผนกของตัวเองอยู่แล้ว

var ADMIN_KEY_ = '__ADMIN__';
var DEPT_CODE_TTL_MS_ = 3 * 24 * 3600 * 1000;   // รหัสตั้งค่าของแผนกใช้ได้ 3 วัน
var EMAIL_CODE_TTL_SEC_ = 10 * 60;               // รหัสยืนยันทางอีเมลของผู้ดูแลใช้ได้ 10 นาที
var CODE_MAX_FAILS_ = 5;

// ---------- ตัวช่วย ----------
function props_() { return PropertiesService.getScriptProperties(); }
function pwVersion_(key) { return props_().getProperty('PWV_' + key) || '0'; }
function setPasswordHash_(key, password) {
  var salt = Utilities.getUuid();
  props_().setProperty(pwPropKey_(key), salt + '$' + hashPassword_(String(password), salt));
  props_().setProperty('PWV_' + key, String(Date.now()));   // ตั๋วเก่าของแผนกนี้ใช้ไม่ได้อีก
  CacheService.getScriptCache().removeAll(['fail_' + key, 'lock_' + key]);
}
function newPasswordError_(pw) {
  pw = String(pw || '');
  if (pw.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
  if (pw.length > 100) return 'รหัสผ่านยาวเกินไป';
  return '';
}
function createSession_(key) {
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('sess_' + token, key + '|' + pwVersion_(key), SESSION_TTL_SEC_);
  return token;
}
// ตั๋วของคีย์นี้ยังใช้ได้ไหม (คืนคีย์ / null) + ต่ออายุ
function sessionKey_(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var v = cache.get('sess_' + token);
  if (!v) return null;
  var parts = v.split('|'), key = parts[0];
  if (parts[1] !== pwVersion_(key)) { cache.remove('sess_' + token); return null; }
  cache.put('sess_' + token, v, SESSION_TTL_SEC_);
  return key;
}
function requireAdmin_(token) {
  if (sessionKey_(token) !== ADMIN_KEY_) throw new Error('SESSION_EXPIRED');
}
function randomCode_(n, alphabet) {
  var out = '';
  while (out.length < n) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid());
    for (var i = 0; i < b.length && out.length < n; i++) out += alphabet.charAt(((b[i] + 256) % 256) % alphabet.length);
  }
  return out;
}
function ownerEmail_() { try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; } }
function maskEmail_(email) { var m = String(email || '').match(/^(.)[^@]*(@.+)$/); return m ? m[1] + '•••' + m[2] : ''; }
function normCode_(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// ==================== แผนก (ทำเองในหน้าเว็บ) ====================

// ตั้ง/รีเซ็ตรหัสผ่านด้วยรหัสตั้งค่าจากผู้ดูแลระบบ แล้วเข้าระบบเลย
function deptSetPasswordWithCode(deptKey, code, newPassword) {
  var dept = findDept_(deptKey);
  if (!dept) return { ok: false, error: 'ไม่พบแผนก' };
  var cache = CacheService.getScriptCache();
  var raw = props_().getProperty('CODE_' + dept.key);
  var rec = raw ? JSON.parse(raw) : null;
  if (!rec || rec.exp < Date.now()) {
    if (rec) props_().deleteProperty('CODE_' + dept.key);
    return { ok: false, error: 'ไม่มีรหัสตั้งค่าที่ใช้ได้ (หมดอายุหรือใช้ไปแล้ว) ขอรหัสใหม่จากผู้ดูแลระบบ' };
  }
  if (!verifyPassword_(normCode_(code), rec.h)) {
    var fails = Number(cache.get('codefail_' + dept.key) || 0) + 1;
    if (fails >= CODE_MAX_FAILS_) {
      props_().deleteProperty('CODE_' + dept.key);
      cache.remove('codefail_' + dept.key);
      return { ok: false, error: 'ใส่รหัสตั้งค่าผิด ' + CODE_MAX_FAILS_ + ' ครั้ง รหัสนี้ถูกยกเลิกแล้ว ขอรหัสใหม่จากผู้ดูแลระบบ' };
    }
    cache.put('codefail_' + dept.key, String(fails), 3600);
    return { ok: false, error: 'รหัสตั้งค่าไม่ถูกต้อง (เหลือ ' + (CODE_MAX_FAILS_ - fails) + ' ครั้ง)' };
  }
  var err = newPasswordError_(newPassword);
  if (err) return { ok: false, error: err };
  setPasswordHash_(dept.key, newPassword);
  props_().deleteProperty('CODE_' + dept.key);
  cache.remove('codefail_' + dept.key);
  return { ok: true, token: createSession_(dept.key), dept: deptView_(dept) };
}

// แผนกเปลี่ยนรหัสผ่านเอง (ต้องใส่รหัสเดิม) — คืนตั๋วใหม่ (ตั๋วเดิมใช้ไม่ได้แล้ว)
function changeMyPassword(token, currentPassword, newPassword) {
  var dept = requireDept_(token);
  var stored = props_().getProperty(pwPropKey_(dept.key));
  if (!stored || !verifyPassword_(String(currentPassword || ''), stored)) return { ok: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
  var err = newPasswordError_(newPassword);
  if (err) return { ok: false, error: err };
  if (String(newPassword) === String(currentPassword)) return { ok: false, error: 'รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม' };
  setPasswordHash_(dept.key, newPassword);
  return { ok: true, token: createSession_(dept.key) };
}

// ==================== ผู้ดูแลระบบ ====================

function getAdminStatus() {
  return { hasAdmin: !!props_().getProperty(pwPropKey_(ADMIN_KEY_)), email: maskEmail_(ownerEmail_()) };
}

// ส่งรหัสยืนยัน 6 หลักไปอีเมลเจ้าของระบบ (ตั้งรหัสผู้ดูแลครั้งแรก / ลืมรหัส)
function adminSendEmailCode() {
  var cache = CacheService.getScriptCache();
  if (cache.get('admin_code_sent')) return { ok: false, error: 'เพิ่งส่งรหัสไปแล้ว รอ 1 นาทีแล้วลองใหม่' };
  var email = ownerEmail_();
  if (!email) return { ok: false, error: 'ไม่พบอีเมลเจ้าของระบบ' };
  var code = randomCode_(6, '0123456789');
  var salt = Utilities.getUuid();
  cache.put('admin_code', salt + '$' + hashPassword_(code, salt), EMAIL_CODE_TTL_SEC_);
  cache.remove('admin_code_fail');
  cache.put('admin_code_sent', '1', 60);
  MailApp.sendEmail(email, APP_NAME + ': รหัสยืนยันผู้ดูแลระบบ ' + code,
    'รหัสยืนยันสำหรับตั้งรหัสผ่านผู้ดูแลระบบ: ' + code + '\n\nใช้ได้ 10 นาที ครั้งเดียว\n'
    + 'ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร (ไม่มีใครเข้าระบบได้ถ้าไม่มีรหัสนี้)');
  return { ok: true, email: maskEmail_(email) };
}

function adminSetPasswordWithEmailCode(code, newPassword) {
  var cache = CacheService.getScriptCache();
  var stored = cache.get('admin_code');
  if (!stored) return { ok: false, error: 'รหัสยืนยันหมดอายุหรือยังไม่ได้ขอ กดส่งรหัสใหม่' };
  if (!verifyPassword_(String(code || '').replace(/\D/g, ''), stored)) {
    var fails = Number(cache.get('admin_code_fail') || 0) + 1;
    if (fails >= CODE_MAX_FAILS_) { cache.removeAll(['admin_code', 'admin_code_fail']); return { ok: false, error: 'ใส่รหัสยืนยันผิดหลายครั้ง รหัสถูกยกเลิก กดส่งรหัสใหม่' }; }
    cache.put('admin_code_fail', String(fails), EMAIL_CODE_TTL_SEC_);
    return { ok: false, error: 'รหัสยืนยันไม่ถูกต้อง (เหลือ ' + (CODE_MAX_FAILS_ - fails) + ' ครั้ง)' };
  }
  var err = newPasswordError_(newPassword);
  if (err) return { ok: false, error: err };
  setPasswordHash_(ADMIN_KEY_, newPassword);
  cache.removeAll(['admin_code', 'admin_code_fail']);
  return { ok: true, token: createSession_(ADMIN_KEY_) };
}

function adminLogin(password) {
  var cache = CacheService.getScriptCache();
  if (cache.get('lock_' + ADMIN_KEY_)) return { ok: false, error: 'ใส่รหัสผิดหลายครั้ง ถูกล็อกชั่วคราว ลองใหม่ในอีก 10 นาที' };
  var stored = props_().getProperty(pwPropKey_(ADMIN_KEY_));
  if (!stored) return { ok: false, error: 'ยังไม่ได้ตั้งรหัสผู้ดูแลระบบ' };
  if (!verifyPassword_(String(password || ''), stored)) {
    var fails = Number(cache.get('fail_' + ADMIN_KEY_) || 0) + 1;
    if (fails >= MAX_FAILS_) { cache.put('lock_' + ADMIN_KEY_, '1', LOCK_SEC_); cache.remove('fail_' + ADMIN_KEY_); return { ok: false, error: 'ใส่รหัสผิด ' + MAX_FAILS_ + ' ครั้ง ถูกล็อก 10 นาที' }; }
    cache.put('fail_' + ADMIN_KEY_, String(fails), LOCK_SEC_);
    return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง (เหลือ ' + (MAX_FAILS_ - fails) + ' ครั้ง)' };
  }
  cache.remove('fail_' + ADMIN_KEY_);
  return { ok: true, token: createSession_(ADMIN_KEY_) };
}

function adminChangePassword(token, currentPassword, newPassword) {
  requireAdmin_(token);
  var stored = props_().getProperty(pwPropKey_(ADMIN_KEY_));
  if (!stored || !verifyPassword_(String(currentPassword || ''), stored)) return { ok: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
  var err = newPasswordError_(newPassword);
  if (err) return { ok: false, error: err };
  setPasswordHash_(ADMIN_KEY_, newPassword);
  return { ok: true, token: createSession_(ADMIN_KEY_) };
}

// สถานะแต่ละแผนก (ไม่มีรหัสผ่าน/ค่าแฮชออกไป)
function adminOverview(token) {
  requireAdmin_(token);
  var cache = CacheService.getScriptCache(), p = props_();
  return { ok: true, depts: activeDepartments_().map(function (d) {
    var managed = !!findDept_(d.key);
    var rec = p.getProperty('CODE_' + d.key); rec = rec ? JSON.parse(rec) : null;
    return { key: d.key, name: d.name, en: d.en, color: d.color, managed: managed, appUrl: d.appUrl || '',
      hasPassword: !!p.getProperty(pwPropKey_(d.key)), locked: !!cache.get('lock_' + d.key),
      codeExpires: rec && rec.exp > Date.now() ? rec.exp : 0, links: managed ? deptLinksStatus_(d.key) : null };
  }) };
}

// ออกรหัสตั้งค่าให้แผนก (ใช้ครั้งเดียว) — ผู้ดูแลส่งให้หัวหน้าแผนกเอง · ออกใหม่ = รหัสเก่ายกเลิก
// รหัสผ่านเดิมของแผนก (ถ้ามี) ยังใช้ได้จนกว่าแผนกจะใช้รหัสตั้งค่านี้ตั้งรหัสใหม่
function adminIssueDeptCode(token, deptKey) {
  requireAdmin_(token);
  var dept = findDept_(deptKey);
  if (!dept) return { ok: false, error: 'ไม่พบแผนก' };
  var code = randomCode_(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  var salt = Utilities.getUuid(), exp = Date.now() + DEPT_CODE_TTL_MS_;
  props_().setProperty('CODE_' + dept.key, JSON.stringify({ h: salt + '$' + hashPassword_(code, salt), exp: exp }));
  CacheService.getScriptCache().remove('codefail_' + dept.key);
  return { ok: true, code: code.slice(0, 4) + '-' + code.slice(4), expires: exp };
}

function adminCancelDeptCode(token, deptKey) {
  requireAdmin_(token);
  props_().deleteProperty('CODE_' + String(deptKey));
  return { ok: true };
}

function adminUnlockDept(token, deptKey) {
  requireAdmin_(token);
  CacheService.getScriptCache().removeAll(['fail_' + deptKey, 'lock_' + deptKey]);
  return { ok: true };
}

// ==================== ลิงก์ Google Sheet / โฟลเดอร์ไฟล์ ของแผนก ====================
function idFromLink_(link) {
  var t = String(link || '').trim();
  if (!t) return '';
  var m = t.match(/\/d\/([A-Za-z0-9_-]{20,})/) || t.match(/\/folders\/([A-Za-z0-9_-]{20,})/) || t.match(/[?&]id=([A-Za-z0-9_-]{20,})/) || t.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}
function deptLinksStatus_(key) {
  var c = deptConfig_(key), out = { sheetId: c.sheetId, folderId: c.folderId, sheet: '', sheetError: '', folder: '', folderError: '' };
  if (c.sheetId) { try { out.sheet = SpreadsheetApp.openById(c.sheetId).getName(); } catch (e) { out.sheetError = 'เปิดไม่ได้ — ให้เจ้าของแชร์ให้ ' + ownerEmail_() + ' เป็นผู้แก้ไข'; } }
  if (c.folderId) { try { out.folder = DriveApp.getFolderById(c.folderId).getName(); } catch (e2) { out.folderError = 'เปิดไม่ได้ — ให้เจ้าของแชร์ให้ ' + ownerEmail_() + ' เป็นผู้แก้ไข'; } }
  return out;
}
// ใส่ลิงก์ (ว่าง = ลบ) แล้วเช็กทันทีว่าระบบเปิดได้
function adminSetDeptLinks(token, deptKey, sheetLink, folderLink) {
  requireAdmin_(token);
  var dept = findDept_(deptKey);
  if (!dept) return { ok: false, error: 'ไม่พบแผนก' };
  var sheetId = idFromLink_(sheetLink), folderId = idFromLink_(folderLink);
  if (sheetId === null) return { ok: false, error: 'ลิงก์ Google Sheet ไม่ถูกต้อง' };
  if (folderId === null) return { ok: false, error: 'ลิงก์โฟลเดอร์ไม่ถูกต้อง' };
  props_().setProperty('DEPT_CFG_' + dept.key, JSON.stringify({ sheetId: sheetId, folderId: folderId }));
  return { ok: true, links: deptLinksStatus_(dept.key) };
}
