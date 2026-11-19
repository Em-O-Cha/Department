// ==================== ฝ่ายบุคคล: แบบฟอร์มขอลาของพนักงาน (ไม่ต้องเข้าระบบ) + แจ้ง LINE กลุ่ม HR ====================
//
// หน้าแบบฟอร์ม: https://em-o-cha.github.io/Department/leave.html?k=<รหัสแบบฟอร์ม> (repo Department, ไฟล์ leave.html)
//   รหัสแบบฟอร์ม (HR_FORM_KEY) อยู่ใน QR ที่ติดในบริษัท — ไม่มีรหัส = เปิดรายชื่อไม่ได้ · ฝ่ายบุคคลออกรหัสใหม่ได้ (ลิงก์เดิมใช้ไม่ได้ทันที)
//   คำขอที่ส่งมา = การลาสถานะ "รออนุมัติ" ช่องทาง "แบบฟอร์มพนักงาน" → ฝ่ายบุคคลอนุมัติในระบบ หรือกดปุ่มในการ์ด LINE กลุ่ม
// LINE: ใช้ LINE OA (Messaging API) ของฝ่ายบุคคล — Script Properties: HR_LINE_TOKEN (Channel access token)
//   ตั้ง Webhook URL ของ OA = URL /exec ของระบบนี้ · เชิญบอทเข้ากลุ่ม แล้วพิมพ์ "ตั้งค่ากลุ่ม HR <รหัสตั้งค่า>" (รหัสดูได้ในหน้าตั้งค่า HR)
//   Apps Script อ่าน header ลายเซ็นของ LINE ไม่ได้ → ปุ่มอนุมัติใส่ลายเซ็นของระบบเอง (HMAC) · ผูกกลุ่มต้องใช้รหัสตั้งค่า

var HR_FORM_TYPES_ = ['sick', 'personal', 'vacation', 'maternity', 'ordain', 'other'];
var HR_FORM_URL_ = 'https://em-o-cha.github.io/Department/leave.html';
var HR_APP_URL_ = 'https://em-o-cha.github.io/Department/';

function hrProp_(k, gen) {
  var p = props_(), v = p.getProperty(k);
  if (!v && gen) { v = gen(); p.setProperty(k, v); }
  return v || '';
}
function hrRand_(n) { var s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }
function hrSetupCode_() { var c = ''; for (var i = 0; i < 8; i++) c += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32)); return c; }
function hrFormKey_() { return hrProp_('HR_FORM_KEY', function () { return hrRand_(12); }); }
function hrSign_(text) {
  var secret = hrProp_('HR_SIGN_SECRET', function () { return hrRand_(32); });
  return Utilities.computeHmacSha256Signature(String(text), secret).slice(0, 8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function hrFormCheck_(key) {
  if (!key || String(key) !== hrFormKey_()) throw new Error('ลิงก์แบบฟอร์มไม่ถูกต้อง หรือฝ่ายบุคคลเปลี่ยนลิงก์แล้ว — สแกน QR ใหม่');
  var dept = findDept_('HR');
  if (!dept || !deptConfig_('HR').sheetId) throw new Error('ระบบฝ่ายบุคคลยังไม่พร้อม');
  return dept;
}
function hrRate_(name, max, sec) {   // จำกัดจำนวนครั้ง (กันส่งรัว ๆ)
  var c = CacheService.getScriptCache(), k = 'hrrate_' + name, n = Number(c.get(k) || 0);
  if (n >= max) throw new Error('ส่งถี่เกินไป ลองใหม่อีกสักครู่');
  c.put(k, String(n + 1), sec);
}

// ---------- สำหรับหน้า HR: ลิงก์แบบฟอร์ม / สถานะ LINE ----------
function hrFormInfo(token) {
  requireHr_(token);
  return { ok: true, key: hrFormKey_(), url: HR_FORM_URL_ + '?k=' + hrFormKey_(),
    line: hrLineInfo_() };
}
// LINE OA แจ้งเตือนการลา: ต้องเป็นคนละ OA กับบอทรายงาน (ฝ่ายบัญชี/ผลิต) และคนละกลุ่ม (ผู้ใช้ขอ 19/11/69)
// webhook URL เดียวกับระบบ — doPost แยกด้วย destination: ไม่ใช่บอทบัญชี/ผลิต = บอท HR
function hrLineInfo_() {
  var p = props_();
  return { token: !!p.getProperty('HR_LINE_TOKEN'), group: !!p.getProperty('HR_LINE_GROUP'), setupCode: hrProp_('HR_LINE_SETUP', hrSetupCode_), webhook: ACC_WEBHOOK_URL_, botName: hrBotName_(), approvers: hrApproversOut_() };
}
// ผู้มีสิทธิ์กดอนุมัติ / ไม่อนุมัติในการ์ด LINE (ผู้ใช้ขอ 19/11/69) — กำหนดด้วยบัญชี LINE (userId) ไม่ใช่ชื่อ
// Script Property HR_LINE_APPROVERS = [{ userId, name, addedAt }] · ว่าง = ทุกคนในกลุ่มที่ผูกไว้กดได้ (แบบเดิม)
// เพิ่มคน: HR ขอรหัสในหน้าตั้งค่า (ใช้ได้ครั้งเดียว อายุ 30 นาที, HR_LINE_APPR_CODE) → คนนั้นพิมพ์ "ขอสิทธิ์อนุมัติ <รหัส>" ในกลุ่มที่ผูกไว้
function hrApprovers_() { try { var a = JSON.parse(props_().getProperty('HR_LINE_APPROVERS') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function hrApproversOut_() { return hrApprovers_().map(function (a) { return { id: a.userId, name: a.name, addedAt: a.addedAt }; }); }
function hrIsApprover_(userId) { var a = hrApprovers_(); return !a.length || a.some(function (x) { return x.userId === userId; }); }
function hrApproverCode(token) {
  var dept = requireHr_(token), code = hrSetupCode_(), exp = Date.now() + 30 * 60000;
  props_().setProperty('HR_LINE_APPR_CODE', JSON.stringify({ code: code, exp: exp }));
  return { ok: true, code: code, expires: Utilities.formatDate(new Date(exp), 'Asia/Bangkok', 'HH:mm'), approvers: hrApproversOut_() };
}
function hrApproverList(token) { requireHr_(token); return { ok: true, approvers: hrApproversOut_() }; }
function hrRemoveApprover(token, userId) {
  var dept = requireHr_(token);
  return purLocked_(function () {
    var a = hrApprovers_(), gone = a.filter(function (x) { return x.userId === userId; })[0];
    if (!gone) return { ok: false, error: 'ไม่พบรายชื่อนี้' };
    props_().setProperty('HR_LINE_APPROVERS', JSON.stringify(a.filter(function (x) { return x.userId !== userId; })));
    try { purLogWrite_(hrBook_(dept), 'ลบผู้มีสิทธิ์อนุมัติใน LINE', 'hr_settings', '', gone.name); } catch (e) {}
    return { ok: true, approvers: hrApproversOut_() };
  });
}
function hrAddApproverFromLine_(ev, gid, codeIn) {
  var src = ev.source || {}, p = props_(), c = {};
  try { c = JSON.parse(p.getProperty('HR_LINE_APPR_CODE') || '{}'); } catch (e) {}
  if (!c.code || c.code !== String(codeIn).toUpperCase() || Date.now() > c.exp) { hrLineReply_(ev.replyToken, [{ type: 'text', text: 'รหัสขอสิทธิ์ไม่ถูกต้อง หรือหมดอายุแล้ว — ให้ฝ่ายบุคคลกด "เพิ่มผู้อนุมัติ" เพื่อขอรหัสใหม่' }]); return; }
  if (!src.userId) return;
  var name = hrLineName_(gid, src.userId);
  var res = purLocked_(function () {
    var a = hrApprovers_();
    p.deleteProperty('HR_LINE_APPR_CODE');   // ใช้ครั้งเดียว
    if (a.some(function (x) { return x.userId === src.userId; })) return 'มีสิทธิ์อยู่แล้ว';
    a.push({ userId: src.userId, name: name, addedAt: purNow_() });
    p.setProperty('HR_LINE_APPROVERS', JSON.stringify(a));
    try { purLogWrite_(hrBook_(findDept_('HR')), 'เพิ่มผู้มีสิทธิ์อนุมัติใน LINE', 'hr_settings', '', name); } catch (e) {}
    return '';
  });
  hrLineReply_(ev.replyToken, [{ type: 'text', text: res ? '✅ ' + name + ' ' + res : '✅ เพิ่ม ' + name + ' เป็นผู้มีสิทธิ์อนุมัติการลาแล้ว\nตั้งแต่นี้เฉพาะคนในรายชื่อเท่านั้นที่กดอนุมัติ / ไม่อนุมัติในกลุ่มนี้ได้' }]);
}
function hrBotName_() {
  try {
    var token = props_().getProperty('HR_LINE_TOKEN'); if (!token) return '';
    var nk = 'hr_bot_name_' + lineTokKey_(token), c = CacheService.getScriptCache(), n = c.get(nk);
    if (n) return n;
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return '';
    n = JSON.parse(res.getContentText()).displayName || '';
    if (n) c.put(nk, n, 21600);
    return n;
  } catch (e) { return ''; }
}
// วาง Channel access token ของ OA ฝ่ายบุคคลในหน้าเว็บ (ตรวจกับ LINE ก่อนบันทึก · ไม่ส่ง token กลับ · ห้ามเป็นบอทเดียวกับรายงาน)
function hrSetLineToken(token, value) {
  requireHr_(token);
  var v = String(value || '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+\/=]{100,400}$/.test(v)) return { ok: false, error: 'รูปแบบ token ไม่ถูกต้อง — คัดลอก Channel access token (long-lived) จาก LINE Developers มาวางทั้งหมด' };
  hrRate_('hrtoken', 10, 3600);
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + v }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'LINE ไม่ยอมรับ token นี้ (รหัส ' + res.getResponseCode() + ') — ตรวจว่าคัดลอกครบ และเป็น token ของ OA ที่ถูกต้อง' };
  var info = JSON.parse(res.getContentText() || '{}');
  if (info.userId && (accIsMyBot_(info.userId) || prdIsMyBot_(info.userId))) return { ok: false, error: 'นี่คือบอทเดียวกับที่ใช้ส่งรายงาน (' + (info.displayName || '') + ') — การแจ้งเตือนการลาต้องใช้ LINE OA อีกตัวหนึ่ง' };
  var p = props_(), old = p.getProperty('HR_LINE_TOKEN');
  p.setProperty('HR_LINE_TOKEN', v);
  if (old && old !== v) p.deleteProperty('HR_LINE_GROUP');   // เปลี่ยน OA → ต้องผูกกลุ่มใหม่
  return { ok: true, botName: info.displayName || '', regroup: !!(old && old !== v), line: hrLineInfo_() };
}
function hrFormNewKey(token) {
  var dept = requireHr_(token);
  props_().setProperty('HR_FORM_KEY', hrRand_(12));
  try { purLogWrite_(hrBook_(dept), 'เปลี่ยนลิงก์แบบฟอร์มขอลา', 'hr_settings', '', 'ลิงก์/QR เดิมใช้ไม่ได้แล้ว'); } catch (e) {}
  return hrFormInfo(token);
}
function hrLineTest(token) {
  requireHr_(token);
  var r = hrLinePush_([{ type: 'text', text: '🔔 ทดสอบแจ้งเตือนจากระบบฝ่ายบุคคล — ถ้าเห็นข้อความนี้ แปลว่าตั้งค่าเรียบร้อย' }]);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ---------- หน้าแบบฟอร์มพนักงาน (เรียกด้วยรหัสแบบฟอร์ม) ----------
// ไม่ส่งรายชื่อพนักงานทั้งหมดให้หน้าฟอร์มแล้ว (19/11/69: หน้าสแกนขอลาไม่ควรเห็นทุกคน) — ค้นด้วย hrFormFind ทีละชื่อ
// emps: [] เผื่อหน้าเก่าที่ยังค้างในเครื่อง
function hrFormInit(key) {
  var dept = hrFormCheck_(key), ss = hrBook_(dept), st = hrSettings_(ss);
  // รายชื่อให้เลือก (พร้อมรูปจาก hrFormPhotos) — กลับมาแสดงรายชื่อตามที่ผู้ใช้ขอ 19/11/69 · รวมพนักงาน Job
  return { ok: true, today: purToday_(), workDays: st.workDays,
    emps: hrPeople_(ss).filter(hrActive_).sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); })
      .map(function (e) { var o = hrFormEmp_(e); delete o.photo; return o; }) };
}
function hrFormEmp_(e) {
  return { id: e.id, name: e.fullName, nick: e.nickname, building: e.building, group: e.group, position: e.position, job: !!e.isJob,
    photo: /^data:image\//.test(String(e.photoThumb)) ? e.photoThumb : '' };
}
// ค้นชื่อ / ชื่อเล่น (พิมพ์แล้วค่อยขึ้น) — คืนไม่เกิน 8 คน
function hrFormFind(key, q) {
  var dept = hrFormCheck_(key), s = String(q || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
  if (!s) return { ok: true, emps: [] };
  hrRate_('hrfind', 400, 600);
  var ss = hrBook_(dept);
  return { ok: true, emps: hrPeople_(ss).filter(function (e) {
    return hrActive_(e) && (String(e.fullName || '') + ' ' + String(e.nickname || '')).toLowerCase().indexOf(s) >= 0;
  }).slice(0, 8).map(hrFormEmp_) };
}
function hrFormPhotos(key) {   // รูปย่อทุกคน (พนักงาน + Job) สำหรับหน้าเลือกชื่อ
  var dept = hrFormCheck_(key), ss = hrBook_(dept), out = {};
  hrPeople_(ss).forEach(function (e) { if (hrActive_(e) && /^data:image\//.test(String(e.photoThumb))) out[e.id] = e.photoThumb; });
  return { ok: true, photos: out };
}
function hrQuota_(st, e, k, year, today) {
  var q = (st.quotaMap || {})[k];
  if (q == null || q === '') return null;
  q = Number(q) || 0;
  if (k === 'vacation' && e && e.startDate) { var ref = year + '-12-31' < today ? year + '-12-31' : today; if (hrDays_(e.startDate, ref) < 365) return 0; }
  return q;
}
function hrBalance_(ss, e, year) {
  var st = hrSettings_(ss), today = purToday_(), used = {}, pend = {};
  purRead_(ss, 'hr_leaves').forEach(function (l) {
    if (l.empId !== e.id || String(l.dateFrom).slice(0, 4) !== year) return;
    if (l.status === 'อนุมัติ') used[l.type] = (used[l.type] || 0) + (Number(l.days) || 0);
    if (l.status === 'รออนุมัติ') pend[l.type] = (pend[l.type] || 0) + (Number(l.days) || 0);
  });
  var out = {};
  HR_FORM_TYPES_.forEach(function (k) { var q = hrQuota_(st, e, k, year, today); out[k] = { quota: q, used: used[k] || 0, pending: pend[k] || 0, left: q == null ? null : q - (used[k] || 0) }; });
  return out;
}
function hrFormBalance(key, empId) {
  var dept = hrFormCheck_(key), ss = hrBook_(dept), e = hrById_(hrPeople_(ss), empId);
  if (!e || !hrActive_(e)) return { ok: false, error: 'ไม่พบชื่อพนักงาน' };
  var year = purToday_().slice(0, 4);
  var mine = purRead_(ss, 'hr_leaves').filter(function (l) { return l.empId === e.id; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 8)
    .map(function (l) { return { type: l.type, dateFrom: l.dateFrom, dateTo: l.dateTo, days: l.days, minutes: l.type === 'late' ? '' : l.minutes, status: l.status, reason: l.reason }; });
  return { ok: true, year: year, balance: hrBalance_(ss, e, year), recent: mine, emp: hrFormEmp_(e) };
}
// r = { empId, type, dateFrom, dateTo, half (true = ครึ่งวัน), reason }
var HR_HOURS_PER_DAY_ = 8;   // ลาเป็นชั่วโมง: 8 ชม. = 1 วัน (แก้ได้ถ้าบริษัทนับต่างไป)
function hrHoursTxt_(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + ' ชม.' : '') + (m ? (h ? ' ' : '') + m + ' นาที' : ''); }
function hrFormSubmit(key, r) {
  var dept = hrFormCheck_(key);
  r = r || {};
  hrRate_('submit', 40, 600);
  if (HR_FORM_TYPES_.indexOf(r.type) < 0) return { ok: false, error: 'เลือกประเภทการลา' };
  var today = purToday_(), f = purDate_(r.dateFrom), t = purDate_(r.dateTo) || f;
  if (!f) return { ok: false, error: 'เลือกวันที่ลา' };
  if (t < f) return { ok: false, error: 'วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม' };
  if (f < hrAddDays_(today, -30) || t > hrAddDays_(today, 365)) return { ok: false, error: 'วันที่ลาต้องอยู่ในช่วง 30 วันที่ผ่านมา ถึง 1 ปีข้างหน้า' };
  if (hrDays_(f, t) > 120) return { ok: false, error: 'ลาได้ครั้งละไม่เกิน 120 วัน' };
  var res = purLocked_(function () {
    var ss = hrBook_(dept), st = hrSettings_(ss), emps = hrPeople_(ss), e = hrById_(emps, r.empId);
    if (!e || !hrActive_(e)) return { ok: false, error: 'ไม่พบชื่อพนักงาน' };
    var all = purRead_(ss, 'hr_leaves');
    if (all.some(function (l) { return l.empId === e.id && l.status !== 'ไม่อนุมัติ' && l.dateFrom <= t && (l.dateTo || l.dateFrom) >= f; })) return { ok: false, error: 'มีการลาในวันที่นี้อยู่แล้ว (รออนุมัติหรืออนุมัติแล้ว)' };
    var days = r.half === true && f === t ? 0.5 : hrWorkDays_(f, t, st.workDays);
    if (!days) return { ok: false, error: 'วันที่เลือกเป็นวันหยุด' };
    // ลาเป็นชั่วโมง (ผู้ใช้ขอ 19/11/69): วันเดียว + เวลาเริ่ม–สิ้นสุด → เก็บนาทีในช่อง "นาที" · จำนวนวัน = ชั่วโมง ÷ 8 (HR_HOURS_PER_DAY_)
    var mins = '', hrsTxt = '';
    if (r.timeFrom || r.timeTo) {
      var tm = function (v) { var m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : -1; };
      var a = tm(r.timeFrom), b = tm(r.timeTo);
      if (f !== t) return { ok: false, error: 'ลาเป็นชั่วโมงได้ทีละ 1 วัน' };
      if (a < 0 || b < 0 || b <= a) return { ok: false, error: 'ระบุเวลาเริ่ม–สิ้นสุดให้ถูกต้อง' };
      mins = b - a;
      if (mins > 12 * 60) return { ok: false, error: 'ลาเป็นชั่วโมงได้ไม่เกิน 12 ชั่วโมง' };
      days = Math.round(mins / 60 / HR_HOURS_PER_DAY_ * 100) / 100;
      hrsTxt = 'ลา ' + hrHoursTxt_(mins) + ' (' + r.timeFrom + '–' + r.timeTo + ')';
    }
    var now = purNow_(), rec = { id: purId_('LV'), empId: e.id, type: r.type, dateFrom: f, dateTo: t, days: days, minutes: mins, reason: hrText_((hrsTxt ? hrsTxt + (r.reason ? ' · ' : '') : '') + (r.reason || ''), 300),
      status: 'รออนุมัติ', approver: '', files: '[]', createdAt: now, updatedAt: now, source: 'แบบฟอร์มพนักงาน', decidedAt: '' };
    purWrite_(ss, 'hr_leaves', rec);
    purLogWrite_(ss, 'คำขอลาจากแบบฟอร์ม', 'hr_leaves', rec.id, e.fullName + ' · ' + HR_LEAVE_TYPES_[r.type] + ' ' + f + (t !== f ? '–' + t : '') + ' (' + days + ' วัน)');
    return { ok: true, id: rec.id, rec: rec, emp: e, bal: hrBalance_(ss, e, f.slice(0, 4))[r.type] };
  });
  if (!res.ok) return res;
  var notified = false;
  try { notified = hrLinePush_([hrLeaveFlex_(res.rec, res.emp, res.bal, false)]).ok; } catch (err) {}
  return { ok: true, id: res.id, sig: hrSign_('up|' + res.id), days: res.rec.days, notified: notified };
}
// แนบรูปใบรับรองแพทย์ ฯลฯ ให้คำขอที่เพิ่งส่ง (ไม่เกิน 3 ไฟล์ · ภายใน 3 ชม. · ยังรออนุมัติ)
function hrFormUpload(key, leaveId, sig, fileName, mimeType, base64) {
  var dept = hrFormCheck_(key);
  if (!sig || sig !== hrSign_('up|' + leaveId)) return { ok: false, error: 'แนบไฟล์ไม่ได้' };
  if (!/^image\/(jpeg|png|webp|heic)$|^application\/pdf$/.test(mimeType)) return { ok: false, error: 'แนบได้เฉพาะรูปภาพหรือ PDF' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return { ok: false, error: 'ไฟล์ว่างหรือใหญ่เกิน 10 MB' };
  var folderId = deptConfig_('HR').folderId;
  if (!folderId) return { ok: false, error: 'ยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายบุคคล' };
  return purLocked_(function () {
    var ss = hrBook_(dept), row = hrById_(purRead_(ss, 'hr_leaves'), leaveId);
    if (!row || row.source !== 'แบบฟอร์มพนักงาน' || row.status !== 'รออนุมัติ') return { ok: false, error: 'แนบไฟล์ไม่ได้' };
    var files = purParseFiles_(row.files);
    if (files.length >= 3) return { ok: false, error: 'แนบได้ไม่เกิน 3 ไฟล์' };
    var emp = hrById_(hrPeople_(ss), row.empId);
    var safe = purClean_(fileName, 80).replace(/[\\/:*?"<>|]/g, '_') || 'file.jpg';
    var f = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mimeType, (emp ? emp.fullName : '') + '_ใบลา_' + row.dateFrom + '_' + safe));
    files.push({ id: f.getId(), name: safe, mime: mimeType, url: 'https://drive.google.com/file/d/' + f.getId() + '/view', at: purNow_() });
    row.files = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, 'hr_leaves', row);
    return { ok: true, count: files.length };
  });
}

// ---------- LINE ----------
function hrLinePush_(messages) {
  var token = props_().getProperty('HR_LINE_TOKEN'), group = props_().getProperty('HR_LINE_GROUP');
  if (!token || !group) return { ok: false, error: !token ? 'ยังไม่ได้ใส่ HR_LINE_TOKEN' : 'ยังไม่ได้ผูกกลุ่ม LINE' };
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ to: group, messages: messages }) });
  return res.getResponseCode() === 200 ? { ok: true } : { ok: false, error: 'LINE ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 150) };
}
function hrLineReply_(replyToken, messages) {
  var token = props_().getProperty('HR_LINE_TOKEN');
  if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ replyToken: replyToken, messages: messages }) });
}
function hrThDate_(iso) { var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ' + m[+p[1] - 1] + ' ' + ((+p[0] + 543) % 100) : iso; }
// การ์ดคำขอลา (decided = แสดงผลแล้ว ไม่มีปุ่ม)
function hrLeaveFlex_(l, e, bal, decided) {
  var T = function (t, o) { var x = { type: 'text', text: String(t), wrap: true }; Object.keys(o || {}).forEach(function (k) { x[k] = o[k]; }); return x; };
  var row = function (a, b, color) { return { type: 'box', layout: 'horizontal', contents: [T(a, { size: 'sm', color: '#64748b', flex: 3 }), T(b, { size: 'sm', weight: 'bold', color: color || '#0f172a', flex: 5 })] }; };
  var dates = hrThDate_(l.dateFrom) + (l.dateTo && l.dateTo !== l.dateFrom ? ' – ' + hrThDate_(l.dateTo) : '');
  var body = [T((e.fullName || '') + (e.nickname ? ' (' + e.nickname + ')' : ''), { size: 'lg', weight: 'bold' }),
    T([e.position, e.group, e.building].filter(String).join(' · ') || ' ', { size: 'xs', color: '#64748b' }), { type: 'separator', margin: 'md' },
    { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: [row('ประเภท', HR_LEAVE_TYPES_[l.type] || l.type), row('วันที่', dates), row('จำนวน', l.type !== 'late' && Number(l.minutes) ? hrHoursTxt_(Number(l.minutes)) + ' (' + l.days + ' วัน)' : l.days + ' วัน')]
      .concat(l.reason ? [row('เหตุผล', l.reason)] : [])
      .concat(bal && bal.quota != null ? [row('สิทธิ์คงเหลือ', bal.left + ' วัน → หลังอนุมัติ ' + (bal.left - l.days) + ' วัน', bal.left - l.days < 0 ? '#dc2626' : '#15803d')] : []) }];
  var bubble = { type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: decided ? (l.status === 'อนุมัติ' ? '#16a34a' : '#dc2626') : '#2563eb', paddingAll: '12px',
      contents: [T(decided ? (l.status === 'อนุมัติ' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ') + (l.approver ? ' · ' + l.approver : '') : '📝 คำขอลาใหม่ · รออนุมัติ', { color: '#ffffff', weight: 'bold', size: 'md' })] },
    body: { type: 'box', layout: 'vertical', paddingAll: '14px', contents: body } };
  if (!decided) bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '10px', contents: [
    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
      { type: 'button', style: 'primary', color: '#16a34a', height: 'sm', action: { type: 'postback', label: '✅ อนุมัติ', data: 'hr|ok|' + l.id + '|' + hrSign_('ok|' + l.id), displayText: 'อนุมัติการลา' } },
      { type: 'button', style: 'primary', color: '#dc2626', height: 'sm', action: { type: 'postback', label: '❌ ไม่อนุมัติ', data: 'hr|no|' + l.id + '|' + hrSign_('no|' + l.id), displayText: 'ไม่อนุมัติการลา' } }] },
    { type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label: 'เปิดในระบบฝ่ายบุคคล', uri: HR_APP_URL_ } }] };
  return { type: 'flex', altText: (decided ? l.status + ' · ' : '📝 คำขอลา · ') + (e.nickname || e.fullName) + ' · ' + (HR_LEAVE_TYPES_[l.type] || '') + ' ' + dates, contents: bubble };
}
function hrLineName_(groupId, userId) {
  try {
    var token = props_().getProperty('HR_LINE_TOKEN');
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + encodeURIComponent(groupId) + '/member/' + encodeURIComponent(userId), { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) return JSON.parse(res.getContentText()).displayName || 'LINE';
  } catch (e) {}
  return 'LINE';
}
// Webhook จาก LINE (ส่งมาที่ doPost เดียวกับ API — แยกด้วยช่อง events)
function hrLineWebhook_(events) {
  (events || []).forEach(function (ev) {
    try {
      var src = ev.source || {}, gid = src.groupId || '';
      if (ev.type === 'join' && gid) {
        hrLineReply_(ev.replyToken, [{ type: 'text', text: 'สวัสดีค่ะ 🙏 ถ้าต้องการให้กลุ่มนี้รับแจ้งเตือนคำขอลา ให้พิมพ์\nตั้งค่ากลุ่ม HR <รหัสตั้งค่า>\n(ดูรหัสได้ที่ระบบฝ่ายบุคคล → ตั้งค่า)' }]);
        return;
      }
      // บอทถูกนำออกจากกลุ่มที่ผูกไว้ → ยกเลิกการผูก (หน้าตั้งค่าจะขึ้นว่ายังไม่ผูกกลุ่ม)
      if (ev.type === 'leave' && gid && gid === props_().getProperty('HR_LINE_GROUP')) { props_().deleteProperty('HR_LINE_GROUP'); return; }
      if (ev.type === 'message' && ev.message && ev.message.type === 'text' && gid) {
        var ma = String(ev.message.text).trim().match(/^ขอสิทธิ์อนุมัติ\s*([A-Z0-9]{8})$/i);
        if (ma) {
          if (gid !== props_().getProperty('HR_LINE_GROUP')) return;   // ขอสิทธิ์ได้เฉพาะในกลุ่มแจ้งการลาที่ผูกไว้
          hrRate_('appr', 10, 3600);
          hrAddApproverFromLine_(ev, gid, ma[1]);
          return;
        }
        var m = String(ev.message.text).trim().match(/^ตั้งค่ากลุ่ม\s*HR\s+([A-Z0-9]{8})$/i);
        if (!m) return;
        hrRate_('bind', 10, 3600);
        if (m[1].toUpperCase() !== hrProp_('HR_LINE_SETUP', hrSetupCode_)) { hrLineReply_(ev.replyToken, [{ type: 'text', text: 'รหัสตั้งค่าไม่ถูกต้อง' }]); return; }
        props_().setProperty('HR_LINE_GROUP', gid);
        props_().setProperty('HR_LINE_SETUP', hrSetupCode_());   // ใช้ครั้งเดียว
        hrLineReply_(ev.replyToken, [{ type: 'text', text: '✅ ตั้งกลุ่มนี้เป็นกลุ่มแจ้งเตือนคำขอลาของฝ่ายบุคคลแล้ว\nคำขอลาใหม่จะขึ้นในกลุ่มนี้ พร้อมปุ่มอนุมัติ / ไม่อนุมัติ' }]);
        return;
      }
      if (ev.type === 'postback' && ev.postback) {
        var p = String(ev.postback.data || '').split('|');
        if (p[0] !== 'hr' || (p[1] !== 'ok' && p[1] !== 'no') || !p[2]) return;
        if (gid !== props_().getProperty('HR_LINE_GROUP') || p[3] !== hrSign_(p[1] + '|' + p[2])) return;
        if (!hrIsApprover_(src.userId)) {
          hrLineReply_(ev.replyToken, [{ type: 'text', text: '⛔ ' + hrLineName_(gid, src.userId) + ' ไม่มีสิทธิ์อนุมัติการลา — คำขอนี้ยังรออนุมัติอยู่\n(ฝ่ายบุคคลเพิ่มสิทธิ์ได้ที่ ตั้งค่า → ผู้มีสิทธิ์อนุมัติใน LINE)' }]);
          return;
        }
        var dept = findDept_('HR'), who = hrLineName_(gid, src.userId) + ' (LINE)';
        var r = hrDecideLeave_(dept, p[2], p[1] === 'ok', who);
        if (r.ok) hrLineReply_(ev.replyToken, [hrLeaveFlex_(r.leave, r.emp || {}, null, true)]);
        else hrLineReply_(ev.replyToken, [{ type: 'text', text: r.error || 'ทำรายการไม่ได้' }]);
      }
    } catch (err) { Logger.log('hrLineWebhook_ ' + err); }
  });
}
