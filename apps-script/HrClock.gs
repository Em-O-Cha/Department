// ==================== ฝ่ายบุคคล — ลงเวลาด้วยใบหน้า + GPS ผ่าน LINE (ผู้ใช้ขอ 27/11/69) ====================
//
// พนักงานออฟฟิศกดปุ่ม "ลงเวลา" ในเมนู LINE OA ของฝ่ายบุคคล → หน้า LIFF clock.html (repo Department)
//   ครั้งแรก: เลือกชื่อตัวเอง (เฉพาะคนที่ HR เปิดให้ใช้) แล้วถ่ายหน้าเองจนระบบมั่นใจ → เก็บ "รหัสใบหน้า" (ตัวเลข 128 ค่า × หลายรูป)
//   ทุกวัน: ตรวจตำแหน่ง (ต้องอยู่ในรัศมีจุดลงเวลา) → สแกนหน้า + กะพริบตา → บันทึกเวลาเข้า / ออก + รูปที่ถ่าย
// เทียบใบหน้าที่เซิร์ฟเวอร์เท่านั้น (รหัสใบหน้าที่ลงทะเบียนไว้ไม่ส่งออกไปที่หน้าเว็บ) · เวลาใช้เวลาของเซิร์ฟเวอร์ ไม่ใช่ของมือถือ
// ผลลงแท็บ "ลงเวลา" (แถว F<วันที่>_<รหัสพนักงาน>) เหมือนข้อมูลเครื่องสแกน → มาสายลงแท็บการลาอัตโนมัติ (hrtSyncLeaves_)
// ตั้งค่า (หน้าตั้งค่าฝ่ายบุคคล): Script Property HR_CLOCK_LIFF_ID · hr_settings clockCfg = {lat, lng, radius, maxAcc, inTime, outMonThu, outFri, emps}
// รูปที่ถ่ายเก็บในโฟลเดอร์ฝ่ายบุคคล / "รูปลงเวลา" (ไม่เปิดสาธารณะ) · ข้อมูลใบหน้าเป็นข้อมูลอ่อนไหว (PDPA) — HR ลบได้ทุกเมื่อ

var HRF_TABLE_ = { tab: 'ใบหน้าลงเวลา', cols: [
  ['id', 'รหัส'], ['empId', 'รหัสพนักงานในระบบ'], ['name', 'ชื่อ'], ['lineUserId', 'บัญชี LINE'], ['lineName', 'ชื่อใน LINE'],
  ['faces', 'รหัสใบหน้า'], ['photo', 'รูปตอนลงทะเบียน'], ['enrolledAt', 'ลงทะเบียนเมื่อ'], ['lastUsedAt', 'ใช้ล่าสุด']] };
var HRC_SRC_ = 'ใบหน้า';
var HRC_MATCH_ = 0.45;      // ระยะห่างรหัสใบหน้าที่ยอมรับว่าเป็นคนเดียวกัน (ยิ่งน้อยยิ่งเข้ม · ค่ามาตรฐาน 0.6)
var HRC_OTHER_ = 0.42;      // ลงทะเบียนใหม่: หน้าเหมือนคนที่ลงทะเบียนแล้วเกินนี้ = ไม่รับ
var HRC_CFG_DEFAULT_ = { lat: '', lng: '', radius: 200, maxAcc: 100, inTime: '07:00', outMonThu: '18:00', outFri: '16:00', emps: [] };

// คอลัมน์รูป / ตำแหน่ง / ความตรงของหน้า อยู่ใน HRT_TABLE_ (HrTime.gs) — ห้ามมีโค้ดนอกฟังก์ชันที่อ้างไฟล์อื่น (ลำดับโหลดไฟล์ไม่แน่นอน)

function hrcBook_() {
  var dept = findDept_('HR');
  if (!dept) throw new Error('ไม่พบฝ่ายบุคคล');
  hrRegister_(); PUR_TABLES_.hr_time = HRT_TABLE_; PUR_TABLES_.hr_faces = HRF_TABLE_;
  PUR_NUM_KEYS_.lateMin = 1; PUR_NUM_KEYS_.earlyMin = 1;
  return { dept: dept, ss: purBook_(dept) };
}
function hrcLiffId_() { return props_().getProperty('HR_CLOCK_LIFF_ID') || ''; }
function hrcCfg_(ss) {
  var row = purRead_(ss, 'hr_settings').filter(function (x) { return x.id === 'clockCfg'; })[0], c = {};
  try { c = JSON.parse((row && row.value) || '{}') || {}; } catch (e) { c = {}; }
  var o = {}; Object.keys(HRC_CFG_DEFAULT_).forEach(function (k) { o[k] = c[k] != null && c[k] !== '' ? c[k] : HRC_CFG_DEFAULT_[k]; });
  if (!Array.isArray(o.emps)) o.emps = [];
  return o;
}
function hrcUser_(idToken) {
  var L = hrcLiffId_();
  if (!L) throw new Error('ฝ่ายบุคคลยังไม่ได้ตั้งค่าหน้าลงเวลา');
  if (!idToken) throw new Error('กรุณาเปิดหน้านี้จากปุ่ม "ลงเวลา" ในแอป LINE');
  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'post', payload: { id_token: String(idToken), client_id: L.split('-')[0] }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('ยืนยันตัวตน LINE ไม่ผ่าน — ปิดหน้านี้แล้วกดปุ่ม "ลงเวลา" ใหม่');
  var j = JSON.parse(res.getContentText());
  return { id: j.sub, name: j.name || '' };
}
function hrcFaces_(row) { try { var a = JSON.parse(row.faces || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function hrcDesc_(d) {
  if (!Array.isArray(d) || d.length !== 128) return null;
  var o = d.map(Number);
  return o.every(function (x) { return isFinite(x) && Math.abs(x) < 2; }) ? o : null;
}
function hrcDist_(a, b) { var s = 0; for (var i = 0; i < 128; i++) { var t = a[i] - b[i]; s += t * t; } return Math.sqrt(s); }
function hrcBest_(faces, d) { var m = 9; faces.forEach(function (f) { var x = hrcDist_(f, d); if (x < m) m = x; }); return m; }
function hrcScore_(dist) { return Math.max(0, Math.min(100, Math.round((1 - dist / 1.2) * 100))); }   // แสดงเป็น % ให้คนอ่านง่าย
function hrcMeters_(lat1, lng1, lat2, lng2) {
  var R = 6371000, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function hrcMin_(t) { var m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
// เวลาเข้า-ออกของวันนั้น: จ-พฤ เข้า inTime ออก outMonThu · ศ ออก outFri · ส-อา ไม่ใช่วันทำงาน
function hrcDay_(cfg, date) {
  var d = purToDate_(date), wd = d ? d.getDay() : 1;
  if (wd === 0 || wd === 6) return { work: false, inT: '', outT: '' };
  return { work: true, inT: cfg.inTime, outT: wd === 5 ? cfg.outFri : cfg.outMonThu };
}
function hrcFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId, parent = null, name = 'รูปลงเวลา';
  if (folderId) try { parent = DriveApp.getFolderById(folderId); parent.getName(); } catch (e) { parent = null; }
  if (!parent) { parent = DriveApp.getRootFolder(); name = 'รูปลงเวลา (ฝ่ายบุคคล)'; }
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function hrcSavePhoto_(dept, b64, name) {
  var s = String(b64 || '').replace(/^data:image\/jpeg;base64,/, '');
  if (!s || s.length > 1500000 || !/^[A-Za-z0-9+\/=]+$/.test(s)) return '';
  try { return hrcFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(s), 'image/jpeg', name + '.jpg')).getId(); } catch (e) { return ''; }
}
function hrcEmpOut_(e) { return { id: e.id, name: e.fullName || '', nick: e.nickname || '', pos: e.position || '', group: e.group || '' }; }
function hrcTodayRow_(ss, empId, date) { return hrById_(purRead_(ss, 'hr_time'), 'F' + date.replace(/-/g, '') + '_' + empId); }
function hrcRowOut_(r) { return r ? { timeIn: r.timeIn || '', timeOut: r.timeOut || '', lateMin: Number(r.lateMin) || 0, earlyMin: Number(r.earlyMin) || 0 } : null; }

// ---------- หน้า LIFF (ไม่มีรหัสผ่าน — ยืนยันตัวตนด้วย LINE) ----------
function hrClockInfo() { return { ok: true, liffId: hrcLiffId_() }; }   // LIFF ID ไม่ใช่ความลับ
function hrClockInit(idToken) {
  try {
    var u = hrcUser_(idToken), b = hrcBook_(), ss = b.ss, cfg = hrcCfg_(ss), today = purToday_();
    var me = purRead_(ss, 'hr_faces').filter(function (f) { return f.lineUserId === u.id; })[0];
    var day = hrcDay_(cfg, today), base = { ok: true, today: today, now: purNow_().slice(11, 16), day: day,
      geo: { set: !!(cfg.lat && cfg.lng), lat: Number(cfg.lat) || 0, lng: Number(cfg.lng) || 0, radius: Number(cfg.radius) || 200, maxAcc: Number(cfg.maxAcc) || 100 } };
    if (me) {
      var emp = hrById_(purRead_(ss, 'hr_emps'), me.empId);
      if (!emp || emp.status === 'ลาออก') return Object.assign(base, { registered: false, blocked: 'บัญชีนี้ไม่ได้อยู่ในรายชื่อพนักงานที่ทำงานอยู่ — ติดต่อฝ่ายบุคคล' });
      return Object.assign(base, { registered: true, emp: hrcEmpOut_(emp), rec: hrcRowOut_(hrcTodayRow_(ss, emp.id, today)) });
    }
    var used = {}; purRead_(ss, 'hr_faces').forEach(function (f) { used[f.empId] = 1; });
    var allow = {}; cfg.emps.forEach(function (id) { allow[id] = 1; });
    var list = purRead_(ss, 'hr_emps').filter(function (e) { return allow[e.id] && e.status !== 'ลาออก' && !used[e.id]; }).map(hrcEmpOut_)
      .sort(function (a, b) { return (a.nick || a.name).localeCompare(b.nick || b.name, 'th'); });
    return Object.assign(base, { registered: false, lineName: u.name, people: list });
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
// ลงทะเบียนใบหน้าครั้งแรก: descs = รหัสใบหน้าหลายรูปที่หน้าเว็บถ่ายจนมั่นใจ (3–8 รูป)
function hrClockEnroll(idToken, empId, descs, photo) {
  try {
    var u = hrcUser_(idToken), b = hrcBook_();
    var list = (Array.isArray(descs) ? descs : []).map(hrcDesc_).filter(Boolean);
    if (list.length < 3 || list.length > 8) return { ok: false, error: 'ข้อมูลใบหน้าไม่ครบ — ถ่ายใหม่อีกครั้ง' };
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++)
      if (hrcDist_(list[i], list[j]) > 0.5) return { ok: false, error: 'รูปที่ถ่ายไม่ใช่หน้าเดียวกันทั้งหมด — ถ่ายใหม่คนเดียวในกล้อง' };
    return purLocked_(function () {
      var ss = b.ss, cfg = hrcCfg_(ss), faces = purRead_(ss, 'hr_faces');
      if (cfg.emps.indexOf(String(empId)) < 0) return { ok: false, error: 'ชื่อนี้ยังไม่ได้เปิดให้ลงเวลาด้วยใบหน้า — ติดต่อฝ่ายบุคคล' };
      var emp = hrById_(purRead_(ss, 'hr_emps'), String(empId));
      if (!emp || emp.status === 'ลาออก') return { ok: false, error: 'ไม่พบชื่อนี้ในทะเบียนพนักงาน' };
      if (faces.some(function (f) { return f.lineUserId === u.id; })) return { ok: false, error: 'บัญชี LINE นี้ลงทะเบียนไว้แล้ว — ปิดแล้วเปิดหน้าใหม่' };
      if (faces.some(function (f) { return f.empId === emp.id; })) return { ok: false, error: 'ชื่อนี้มีคนลงทะเบียนไว้แล้ว — ถ้าไม่ใช่คุณ แจ้งฝ่ายบุคคลให้ล้างข้อมูล' };
      var dup = faces.filter(function (f) { var fs = hrcFaces_(f); return list.some(function (d) { return hrcBest_(fs, d) < HRC_OTHER_; }); })[0];
      if (dup) return { ok: false, error: 'ใบหน้านี้ลงทะเบียนเป็นชื่ออื่นไว้แล้ว — ติดต่อฝ่ายบุคคล' };
      var now = purNow_(), pid = hrcSavePhoto_(b.dept, photo, (emp.nickname || emp.fullName) + '_ลงทะเบียนใบหน้า_' + now.slice(0, 10));
      purWrite_(ss, 'hr_faces', { id: emp.id, empId: emp.id, name: emp.fullName, lineUserId: u.id, lineName: purClean_(u.name, 80),
        faces: JSON.stringify(list.map(function (d) { return d.map(function (x) { return Math.round(x * 10000) / 10000; }); })), photo: pid, enrolledAt: now, lastUsedAt: '' });
      purLogWrite_(ss, 'ลงทะเบียนใบหน้าลงเวลา', 'hr_faces', emp.id, (emp.nickname || emp.fullName) + ' · LINE ' + u.name + ' · ' + list.length + ' รูป');
      rcTouchDept_('HR');
      return { ok: true, emp: hrcEmpOut_(emp) };
    });
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
// เวลาตอนกดปุ่มสแกน (ผู้ใช้ห่วงว่าโหลดนานแล้วจะสาย 27/11/69): หน้าเว็บขอเวลานี้ทันทีที่กด → ลงเวลาตามเวลาที่กด ถ้าส่งผลภายใน 3 นาที
// เวลามาจากเซิร์ฟเวอร์ + ลายเซ็น (แก้เวลาในมือถือไม่ได้)
function hrClockStamp() { var t = Date.now(); return { ok: true, t: t, s: hrSign_('clk|' + t) }; }
function hrcStampTime_(st) {
  var t = st && Number(st.t), age = Date.now() - t;
  return t && st.s === hrSign_('clk|' + t) && age >= 0 && age <= 180000 ? new Date(t) : null;
}
// ลงเวลา: kind in | out · desc = รหัสใบหน้าตอนนี้ · geo = {lat, lng, acc} · live = กะพริบตาผ่าน (หน้าเว็บตรวจ)
function hrClockPunch(idToken, kind, desc, photo, geo, live, stamp) {
  try {
    var u = hrcUser_(idToken), b = hrcBook_();
    if (kind !== 'in' && kind !== 'out') return { ok: false, error: 'คำสั่งไม่ถูกต้อง' };
    var d = hrcDesc_(desc);
    if (!d) return { ok: false, error: 'อ่านใบหน้าไม่ได้ — สแกนใหม่อีกครั้ง' };
    if (!live) return { ok: false, error: 'ยังไม่ผ่านการกะพริบตา — สแกนใหม่อีกครั้ง' };
    return purLocked_(function () {
      var ss = b.ss, cfg = hrcCfg_(ss), me = purRead_(ss, 'hr_faces').filter(function (f) { return f.lineUserId === u.id; })[0];
      if (!me) return { ok: false, error: 'ยังไม่ได้ลงทะเบียนใบหน้า — ปิดแล้วเปิดหน้าใหม่' };
      var emp = hrById_(purRead_(ss, 'hr_emps'), me.empId);
      if (!emp || emp.status === 'ลาออก') return { ok: false, error: 'บัญชีนี้ไม่ได้อยู่ในรายชื่อพนักงานที่ทำงานอยู่' };
      var dist = hrcBest_(hrcFaces_(me), d);
      if (dist > HRC_MATCH_) return { ok: false, face: true, error: 'ใบหน้าไม่ตรงกับที่ลงทะเบียนไว้ — ถอดหน้ากาก / แว่นกันแดด หันหน้าตรงในที่สว่าง แล้วลองใหม่' };
      // ตำแหน่ง: ตรวจซ้ำที่เซิร์ฟเวอร์
      if (!(cfg.lat && cfg.lng)) return { ok: false, error: 'ฝ่ายบุคคลยังไม่ได้ตั้งจุดลงเวลา' };
      var g = geo || {}, lat = Number(g.lat), lng = Number(g.lng), acc = Math.round(Number(g.acc) || 9999);
      if (!isFinite(lat) || !isFinite(lng) || !lat) return { ok: false, error: 'ไม่ได้รับตำแหน่ง — เปิด GPS แล้วลองใหม่' };
      if (acc > Number(cfg.maxAcc || 100)) return { ok: false, error: 'ตำแหน่งยังไม่แม่นพอ (คลาดเคลื่อน ' + acc + ' ม.) — ออกไปที่โล่ง / เปิด GPS แล้วลองใหม่' };
      var m = hrcMeters_(lat, lng, Number(cfg.lat), Number(cfg.lng));
      if (m > Number(cfg.radius || 200)) return { ok: false, error: 'อยู่นอกพื้นที่บริษัท (ห่าง ' + m + ' ม.)' };
      var now = purNow_(), at = hrcStampTime_(stamp), atS = at ? Utilities.formatDate(at, PUR_TZ_, 'yyyy-MM-dd HH:mm:ss') : now;
      var date = atS.slice(0, 10), hm = atS.slice(11, 16), day = hrcDay_(cfg, date);
      var row = hrcTodayRow_(ss, emp.id, date);
      if (kind === 'in' && row && row.timeIn) return { ok: false, error: 'วันนี้ลงเวลาเข้างานไปแล้ว ' + row.timeIn + ' น.', rec: hrcRowOut_(row) };
      if (kind === 'out' && !(row && row.timeIn)) return { ok: false, error: 'ยังไม่ได้ลงเวลาเข้างานวันนี้' };
      if (!row) row = { id: 'F' + date.replace(/-/g, '') + '_' + emp.id, date: date, machineId: HRC_SRC_, empId: emp.id, kind: '', editedAt: '' };
      row.name = emp.fullName; row.dept = emp.group || ''; row.dayStatus = day.work ? 'วันทำงาน' : 'วันหยุด';
      row.shift = day.work ? day.inT + '-' + day.outT : ''; row.importedAt = now;
      var tag = (emp.nickname || emp.fullName) + '_' + date + '_' + (kind === 'in' ? 'เข้า' : 'ออก') + '_' + hm.replace(':', '');
      var pid = hrcSavePhoto_(b.dept, photo, tag), geoTxt = lat.toFixed(6) + ',' + lng.toFixed(6) + ' ±' + acc + ' ม. · ห่าง ' + m + ' ม.';
      if (kind === 'in') {
        row.timeIn = hm; row.inPhoto = pid; row.inGeo = geoTxt; row.inScore = hrcScore_(dist);
        var late = day.work ? hrcMin_(hm) - hrcMin_(day.inT) : 0; row.lateMin = late > 0 ? late : 0;
      } else {
        row.timeOut = hm; row.outPhoto = pid; row.outGeo = geoTxt; row.outScore = hrcScore_(dist);
        var early = day.work ? hrcMin_(day.outT) - hrcMin_(hm) : 0; row.earlyMin = early > 0 ? early : 0;
      }
      purWrite_(ss, 'hr_time', row);
      if (kind === 'in') hrtSyncLeaves_(ss, [row], now);
      me.lastUsedAt = now; purWrite_(ss, 'hr_faces', me);
      rcTouchDept_('HR');
      return { ok: true, kind: kind, time: hm, date: date, work: day.work, lateMin: Number(row.lateMin) || 0, earlyMin: Number(row.earlyMin) || 0,
        dist: m, score: hrcScore_(dist), rec: hrcRowOut_(row) };
    });
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ---------- หน้าตั้งค่าฝ่ายบุคคล ----------
function hrClockAdmin(token) {
  var dept = requireHr_(token), ss = hrBook_(dept); PUR_TABLES_.hr_faces = HRF_TABLE_;
  var faces = purRead_(ss, 'hr_faces').map(function (f) { return { empId: f.empId, name: f.name, lineName: f.lineName, enrolledAt: String(f.enrolledAt || '').slice(0, 16), lastUsedAt: String(f.lastUsedAt || '').slice(0, 16), photo: f.photo || '' }; });
  var people = purRead_(ss, 'hr_emps').filter(function (e) { return e.status !== 'ลาออก'; }).map(hrcEmpOut_);
  var L = hrcLiffId_();
  return { ok: true, cfg: hrcCfg_(ss), liffId: L, liffUrl: L ? 'https://liff.line.me/' + L : '', page: HR_CLOCK_PAGE_, faces: faces, people: people };
}
var HR_CLOCK_PAGE_ = 'https://em-o-cha.github.io/Department/clock.html';
function hrClockSave(token, c) {
  var dept = requireHr_(token);
  c = c || {};
  var lat = Number(c.lat), lng = Number(c.lng);
  if ((c.lat !== '' || c.lng !== '') && (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) return { ok: false, error: 'พิกัดจุดลงเวลาไม่ถูกต้อง' };
  var t = function (v, d) { return /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : d; };
  var cfg = { lat: c.lat === '' ? '' : Math.round(lat * 1e6) / 1e6, lng: c.lng === '' ? '' : Math.round(lng * 1e6) / 1e6,
    radius: Math.max(50, Math.min(2000, Math.round(Number(c.radius) || 200))), maxAcc: Math.max(20, Math.min(500, Math.round(Number(c.maxAcc) || 100))),
    inTime: t(c.inTime, '07:00'), outMonThu: t(c.outMonThu, '18:00'), outFri: t(c.outFri, '16:00'),
    emps: (Array.isArray(c.emps) ? c.emps : []).map(String).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 500) };
  return purLocked_(function () {
    var ss = hrBook_(dept), r = purRead_(ss, 'hr_settings').filter(function (x) { return x.id === 'clockCfg'; })[0];
    purWrite_(ss, 'hr_settings', r ? Object.assign(r, { value: JSON.stringify(cfg) }) : { id: 'clockCfg', value: JSON.stringify(cfg) });
    purLogWrite_(ss, 'ตั้งค่าลงเวลาด้วยใบหน้า', 'hr_settings', 'clockCfg', 'จุด ' + cfg.lat + ',' + cfg.lng + ' รัศมี ' + cfg.radius + ' ม. · ' + cfg.emps.length + ' คน');
    return { ok: true, cfg: cfg };
  });
}
function hrClockSetLiff(token, liffId) {
  requireHr_(token);
  var v = String(liffId || '').trim();
  if (v && !/^\d{10}-[A-Za-z0-9]{8}$/.test(v)) return { ok: false, error: 'LIFF ID ไม่ถูกต้อง (รูปแบบ 1234567890-AbCdEfGh)' };
  if (v) props_().setProperty('HR_CLOCK_LIFF_ID', v); else props_().deleteProperty('HR_CLOCK_LIFF_ID');
  return { ok: true, liffId: v, liffUrl: v ? 'https://liff.line.me/' + v : '' };
}
// ล้างข้อมูลใบหน้า 1 คน (ลงทะเบียนใหม่ได้ / เปลี่ยนมือถือ)
function hrClockReset(token, empId) {
  var dept = requireHr_(token);
  return purLocked_(function () {
    var ss = hrBook_(dept); PUR_TABLES_.hr_faces = HRF_TABLE_;
    var row = purRead_(ss, 'hr_faces').filter(function (f) { return f.empId === String(empId); })[0];
    if (!row) return { ok: false, error: 'ไม่พบข้อมูลใบหน้าของคนนี้' };
    if (row.photo) try { DriveApp.getFileById(row.photo).setTrashed(true); } catch (e) {}
    purSheet_(ss, 'hr_faces').deleteRow(row._row);
    purLogWrite_(ss, 'ล้างข้อมูลใบหน้าลงเวลา', 'hr_faces', row.empId, row.name + ' · LINE ' + row.lineName);
    return { ok: true };
  });
}
// รูปที่ถ่ายตอนลงเวลา / ลงทะเบียน (ไม่เปิดสาธารณะ) → ส่งเป็น data URL ให้หน้า HR เท่านั้น
function hrClockPhoto(token, fileId) {
  var dept = requireHr_(token), id = String(fileId || '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) return { ok: false, error: 'ไม่พบรูป' };
  var ss = hrBook_(dept); PUR_TABLES_.hr_time = HRT_TABLE_; PUR_TABLES_.hr_faces = HRF_TABLE_;
  var known = purRead_(ss, 'hr_time').some(function (r) { return r.inPhoto === id || r.outPhoto === id; }) || purRead_(ss, 'hr_faces').some(function (f) { return f.photo === id; });
  if (!known) return { ok: false, error: 'ไม่พบรูป' };
  try { var bl = DriveApp.getFileById(id).getBlob(); return { ok: true, url: 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes()) }; }
  catch (e) { return { ok: false, error: 'เปิดรูปไม่ได้ (อาจถูกลบแล้ว)' }; }
}
