// ==================== ฝ่ายบุคคล — เช็คพนักงานรายวัน (ตารางจำนวนพนักงาน + คนลา) → ส่งภาพตารางเข้า LINE ====================
//
// หน้าเว็บ (hrdaily.js) คีย์คนลาประจำวัน: แตะชื่อในแต่ละฝ่ายงาน → ประเภทการลา + เหตุผล (ชื่อหายจากช่อง "ชื่อ" ไปอยู่ช่อง "การลา")
// ฝ่ายงานที่ไม่มีรายชื่อ (พนักงานผลิตประจำ / ทดลองงาน / job) กรอกจำนวนเอง + เพิ่มชื่อคนลาเอง
// จำนวนพนักงานนับทั้งหมด (รวมคนลา) ตามที่ผู้ใช้เลือก 19/11/69
// แท็บ "เช็คพนักงานรายวัน" (1 แถว = 1 วัน, ข้อมูลเป็น JSON) · ฝ่ายงาน + รายชื่อตั้งต้นเก็บใน hr_settings: dailyRoles
// LINE: ใช้บอทฝ่ายบัญชี (ACC_LINE_TOKEN) ส่งเข้ากลุ่มเดียวกับฝ่ายบัญชี/ฝ่ายผลิต (ACC_LINE_GROUP) ตามที่ผู้ใช้ขอ 19/11/69 — ไม่มีการผูกกลุ่มแยกของ HR
// ภาพตารางสร้างในเบราว์เซอร์ (html2canvas) → PNG ในโฟลเดอร์ฝ่าย / "รายงานเช็คพนักงาน"

var HRD_TABLE_ = { tab: 'เช็คพนักงานรายวัน', cols: [
  ['id', 'รหัสวัน'], ['day', 'วันที่'], ['data', 'ข้อมูล (JSON)'], ['total', 'พนักงานทั้งหมด'], ['leaveCount', 'ลางาน (คน)'], ['resign', 'ลาออก (คน)'],
  ['imgUrl', 'ภาพตาราง (LINE)'], ['sentAt', 'ส่ง LINE เมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] };
// ตั้งต้นจากไฟล์ของผู้ใช้ "เช็คพนักงาน" (19/11/69) · names ว่าง = กรอกจำนวนเอง
var HRD_ROLES_DEFAULT_ = [
  { role: 'พนักงานผลิตประจำ', names: '', count: 11 },
  { role: 'QC', names: 'แป้ง, ลูกศร, จอย, จี, ปลา' },
  { role: 'ช่าง', names: 'วิสูตร' },
  { role: 'แม่บ้าน', names: 'คิมมาซุย, เปียว จี, แตะ แตะ เอม, เอ วีน, ซาน ปรี ปรี พิว, แปอีสอง' },
  { role: 'พนักงานทดลองงาน', names: '', count: 28 },
  { role: 'job', names: '', count: 23 },
  { role: 'หัวหน้าผลิต', names: 'โมเม' },
  { role: 'หัวหน้าไลน์ผลิต', names: 'พุฒ, เมย์G3, ไข่มุก, โน้ต' },
  { role: 'หัวหน้า QA', names: 'กิ้ง' },
  { role: 'QA', names: 'แป๊ะฉ่าย' },
  { role: 'หัวหน้า QC', names: 'มายด์, แตงโม' },
  { role: 'ผู้ช่วย/ฝ่ายจัดซื้อ', names: 'ตาล (ผู้ช่วยเนย)' },
  { role: 'เช็คเกอร์ / คลังสินค้า', names: 'เจมมี่ (ผู้ช่วยพี่ก้อย)' },
  { role: 'พนักงานออฟฟิศ', names: 'พี่นะห์, พี่เตย, เนย, มิ้ว, ผิงผิง, พี่ก้อย, พี่ปุ๊ก, ป๊อป, เมย์, เบนซ์, พี่ต้อย, ดา, ตุ๊กตา' },
  { role: 'ผู้ช่วย/RD', names: 'พลอย (ผู้ช่วยพี่เตย)' },
  { role: 'ผู้บริหาร', names: 'พี่เก้' },
  { role: 'ผู้บริหาร', names: 'คุณอเล็ก' }
];
var HRD_LEAVE_TYPES_ = ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาไม่แจ้ง', 'ขาดงาน', 'ลาคลอด', 'อื่น ๆ'];

function hrdBook_(dept) { var ss = hrBook_(dept); PUR_TABLES_.hr_daily = HRD_TABLE_; PUR_NUM_KEYS_.total = 1; PUR_NUM_KEYS_.leaveCount = 1; PUR_NUM_KEYS_.resign = 1; return ss; }
function hrdClean_(v, max) { return purClean_(v, max || 80); }
function hrdRoles_(ss) {
  var row = purRead_(ss, 'hr_settings').filter(function (x) { return x.id === 'dailyRoles'; })[0], list = null;
  try { list = row ? JSON.parse(row.value || '[]') : null; } catch (e) { list = null; }
  return (Array.isArray(list) && list.length ? list : HRD_ROLES_DEFAULT_).map(hrdCleanRole_).filter(function (r) { return r.role; });
}
function hrdCleanRole_(r) {
  var names = String((r && r.names) || '').split(/[,\n]+/).map(function (n) { return hrdClean_(n, 60); }).filter(String);
  return { role: hrdClean_(r && r.role, 60), names: names.join(', '), count: names.length ? names.length : Math.max(0, Math.round(Number(r && r.count) || 0)) };
}
function hrdLineInfo_() {
  var p = props_();
  return { token: !!p.getProperty('ACC_LINE_TOKEN'), group: !!p.getProperty('ACC_LINE_GROUP') };
}
// วันนั้น: ข้อมูลที่บันทึกไว้ หรือ (ยังไม่มี) ตั้งต้นจากรายชื่อ + จำนวนล่าสุดของฝ่ายที่กรอกจำนวนเอง
function hrDailyLoad(token, date) {
  var dept = requireHr_(token), ss = hrdBook_(dept), d = accDate_(date) || purToday_();
  // รหัสแถว = "D" + yyyy-MM-dd (ข้อความ — ถ้าเป็นวันที่ล้วน ชีตจะแปลงเป็นค่าวันที่แล้วเทียบไม่ได้)
  var all = purRead_(ss, 'hr_daily').filter(function (x) { return /^D\d{4}-\d{2}-\d{2}$/.test(String(x.id)); }).map(function (x) { x.d = String(x.id).slice(1); return x; })
    .sort(function (a, b) { return b.d.localeCompare(a.d); });
  var row = all.filter(function (x) { return x.d === d; })[0], day = null;
  if (row) { try { day = JSON.parse(row.data || 'null'); } catch (e) { day = null; } }
  var prev = all.filter(function (x) { return x.d < d; })[0], lastCounts = {};
  if (prev) { try { (JSON.parse(prev.data || '{}').roles || []).forEach(function (r) { if (!r.names || !r.names.length) lastCounts[r.role] = r.count; }); } catch (e) {} }
  return { ok: true, today: purToday_(), date: d, roles: hrdRoles_(ss), day: day, sentAt: row ? row.sentAt : '', lastCounts: lastCounts,
    days: all.slice(0, 14).map(function (x) { return { date: x.d, total: x.total, leaveCount: x.leaveCount, sentAt: x.sentAt }; }),
    leaveTypes: HRD_LEAVE_TYPES_, line: hrdLineInfo_() };
}
function hrdCleanDay_(day) {
  day = day || {};
  var roles = (Array.isArray(day.roles) ? day.roles : []).slice(0, 60).map(function (r) {
    var names = (Array.isArray(r.names) ? r.names : []).slice(0, 80).map(function (n) { return hrdClean_(n, 60); }).filter(String);
    var leaves = (Array.isArray(r.leaves) ? r.leaves : []).slice(0, 80).map(function (l) {
      return { name: hrdClean_(l.name, 60), type: hrdClean_(l.type, 30) || 'ลา', reason: hrdClean_(l.reason, 120) };
    }).filter(function (l) { return l.name; });
    var resigns = (Array.isArray(r.resigns) ? r.resigns : []).slice(0, 80).map(function (x) {
      return { name: hrdClean_(x && x.name, 60), reason: hrdClean_(x && x.reason, 120) };
    }).filter(function (x) { return x.name; });
    var count = names.length ? names.length : Math.max(0, Math.round(Number(r.count) || 0));
    return { role: hrdClean_(r.role, 60), names: names, count: count, leaves: leaves, resigns: resigns, note: hrdClean_(r.note, 120) };
  }).filter(function (r) { return r.role; });
  // ลาออก: รายชื่อในแต่ละฝ่ายงาน (roles[].resigns, แสดงในช่องหมายเหตุ) — จำนวน = จำนวนชื่อ
  // ข้อมูลเก่า: resignNames (รวมทั้งวัน) / ตัวเลขอย่างเดียว ยังนับให้
  var resignNames = (Array.isArray(day.resignNames) ? day.resignNames : []).slice(0, 80).map(function (n) { return hrdClean_(n, 60); }).filter(String);
  var named = roles.reduce(function (s, r) { return s + r.resigns.length; }, 0) + resignNames.length;
  return { roles: roles, resignNames: resignNames, resign: named || Math.max(0, Math.round(Number(day.resign) || 0)) };
}
function hrDailySave(token, date, day) {
  var dept = requireHr_(token), d = accDate_(date);
  if (!d) return { ok: false, error: 'วันที่ไม่ถูกต้อง' };
  var c = hrdCleanDay_(day);
  if (!c.roles.length) return { ok: false, error: 'ไม่มีข้อมูล' };
  return purLocked_(function () {
    var ss = hrdBook_(dept), row = purRead_(ss, 'hr_daily').filter(function (x) { return x.id === 'D' + d; })[0] || { id: 'D' + d };
    row.day = cpSlash_(d);
    row.data = JSON.stringify(c);
    row.total = c.roles.reduce(function (s, r) { return s + r.count; }, 0);
    row.leaveCount = c.roles.reduce(function (s, r) { return s + r.leaves.length; }, 0);
    row.resign = c.resign; row.updatedAt = purNow_();
    purWrite_(ss, 'hr_daily', row);
    purLogWrite_(ss, 'บันทึกเช็คพนักงานรายวัน', 'hr_daily', d, 'ทั้งหมด ' + row.total + ' · ลา ' + row.leaveCount);
    return { ok: true, total: row.total, leaveCount: row.leaveCount };
  });
}
// แก้ฝ่ายงาน / รายชื่อตั้งต้น
function hrDailySaveRoles(token, roles) {
  var dept = requireHr_(token);
  var list = (Array.isArray(roles) ? roles : []).slice(0, 60).map(hrdCleanRole_).filter(function (r) { return r.role; });
  if (!list.length) return { ok: false, error: 'ต้องมีฝ่ายงานอย่างน้อย 1 รายการ' };
  return purLocked_(function () {
    var ss = hrdBook_(dept), row = purRead_(ss, 'hr_settings').filter(function (x) { return x.id === 'dailyRoles'; })[0] || { id: 'dailyRoles' };
    row.value = JSON.stringify(list);
    purWrite_(ss, 'hr_settings', row);
    purLogWrite_(ss, 'แก้ฝ่ายงาน/รายชื่อ (เช็คพนักงาน)', 'hr_settings', 'dailyRoles', list.length + ' ฝ่ายงาน');
    return { ok: true, roles: list };
  });
}
function hrdFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายบุคคล');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รายงานเช็คพนักงาน');
  return it.hasNext() ? it.next() : parent.createFolder('รายงานเช็คพนักงาน');
}
function hrDailySendLine(token, date, png, ratio) {
  var dept = requireHr_(token), d = accDate_(date);
  if (!d) return { ok: false, error: 'วันที่ไม่ถูกต้อง' };
  if (!png || typeof png !== 'string' || png.length > 6000000 || !/^[A-Za-z0-9+\/=]+$/.test(png)) return { ok: false, error: 'สร้างภาพตารางไม่สำเร็จ' };
  var p = props_(), tok = p.getProperty('ACC_LINE_TOKEN'), group = p.getProperty('ACC_LINE_GROUP');
  if (!tok) return { ok: false, error: 'ยังไม่ได้ตั้งบอท LINE (ใช้บอทของฝ่ายบัญชี)' };
  if (!group) return { ok: false, error: 'ฝ่ายบัญชียังไม่ได้ผูกกลุ่ม LINE — ให้ฝ่ายบัญชีผูกกลุ่มก่อน (ตารางนี้ส่งเข้ากลุ่มเดียวกับฝ่ายบัญชี/ฝ่ายผลิต)' };
  return purLocked_(function () {
    var ss = hrdBook_(dept), row = purRead_(ss, 'hr_daily').filter(function (x) { return x.id === 'D' + d; })[0];
    if (!row) return { ok: false, error: 'บันทึกข้อมูลวันนี้ก่อนส่ง' };
    var old = String(row.imgUrl || '').match(/[-\w]{25,}/);
    if (old) try { DriveApp.getFileById(old[0]).setTrashed(true); } catch (e) {}
    var f = hrdFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(png), 'image/png', 'เช็คพนักงาน ' + d + '.png'));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://lh3.googleusercontent.com/d/' + f.getId(), dd = cpSlash_(d);
    var rt = /^\d{2,5}:\d{2,5}$/.test(String(ratio)) ? String(ratio) : '3:4';
    var msg = { type: 'flex', altText: 'จำนวนพนักงาน วันที่ ' + dd + ' · ทั้งหมด ' + row.total + ' คน · ลา ' + row.leaveCount + ' คน',
      contents: { type: 'bubble', size: 'giga', hero: { type: 'image', url: url, size: 'full', aspectRatio: rt, aspectMode: 'fit', backgroundColor: '#FFFFFF', action: { type: 'uri', uri: url } } } };
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok }, payload: JSON.stringify({ to: group, messages: [msg] }) });
    row.imgUrl = url;
    if (res.getResponseCode() !== 200) { purWrite_(ss, 'hr_daily', row); return { ok: false, error: 'LINE ตอบกลับ ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 150) }; }
    row.sentAt = purNow_();
    purWrite_(ss, 'hr_daily', row);
    purLogWrite_(ss, 'ส่ง LINE เช็คพนักงาน', 'hr_daily', d, 'ทั้งหมด ' + row.total + ' · ลา ' + row.leaveCount);
    return { ok: true, sentAt: row.sentAt };
  });
}
