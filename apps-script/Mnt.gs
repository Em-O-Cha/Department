// ==================== ฝ่ายช่าง (MNT) — แจ้งซ่อม · ทะเบียนเครื่องจักร · แผนบำรุงรักษา (PM) · อะไหล่ & ค่าใช้จ่าย ====================
// ผู้ใช้ขอ 28/11/69: "ขอเพิ่มระบบของช่าง โดยมีไลน์เพื่อแจ้งซ่อมได้ด้วย เหมือนระบบ HR" — การ์ดใหม่ · แจ้งซ่อมได้ทั้งปุ่มเมนู LINE (OA ของฝ่ายช่าง) และ QR
// หน้าเว็บของฝ่าย: Department/mnt.js (window.MNTM) · แบบฟอร์มแจ้งซ่อม / หน้าช่างอัปเดตงาน: Department/repair.html (MntLine.gs)
// ข้อมูลอยู่ใน Google Sheet ของฝ่ายช่าง (ตั้งลิงก์ในหน้าผู้ดูแล) · รูปอยู่ใน Drive (โฟลเดอร์ของฝ่าย / สำรองใน Drive ของบัญชีสคริปต์)
// ใบแจ้งซ่อม: รอรับงาน → รับงานแล้ว → กำลังซ่อม / รออะไหล่ → ซ่อมเสร็จ (รอตรวจรับ) → ปิดงาน · ผู้แจ้งตรวจรับว่า "ยังไม่หาย" → กลับไปกำลังซ่อม
// อะไหล่: คงเหลือ = รับเข้า − เบิก ± ปรับยอด (แท็บรับเข้า-เบิกอะไหล่) · อะไหล่ที่ใช้ในใบแจ้งซ่อม = รายการเบิกที่ผูกกับใบนั้น (แก้ใบ = เขียนรายการเบิกใหม่)

var MNT_TABLES_ = {
  mnt_repairs: { tab: 'ใบแจ้งซ่อม', cols: [
    ['id', 'รหัส'], ['code', 'เลขที่ใบแจ้งซ่อม'], ['reportAt', 'วันเวลาที่แจ้ง'], ['reportDate', 'วันที่แจ้ง'], ['reporter', 'ผู้แจ้ง'], ['reporterDept', 'ฝ่าย / แผนกผู้แจ้ง'],
    ['phone', 'เบอร์ติดต่อ'], ['lineUserId', 'LINE ผู้แจ้ง (ID)'], ['lineName', 'ชื่อ LINE ผู้แจ้ง'], ['source', 'ช่องทางแจ้ง'],
    ['building', 'อาคาร'], ['location', 'จุด / ตำแหน่ง'], ['machineId', 'รหัสเครื่องจักร'], ['machineName', 'เครื่องจักร / อุปกรณ์'], ['category', 'ประเภทงาน'],
    ['problem', 'อาการ / ปัญหา'], ['urgency', 'ความเร่งด่วน'], ['stopLine', 'กระทบการผลิต'], ['photos', 'รูปก่อนซ่อม'], ['status', 'สถานะ'],
    ['assignee', 'ช่างผู้รับผิดชอบ'], ['acceptedAt', 'รับงานเมื่อ'], ['startAt', 'เริ่มซ่อมเมื่อ'], ['doneAt', 'ซ่อมเสร็จเมื่อ'], ['closedAt', 'ปิดงานเมื่อ'],
    ['cause', 'สาเหตุ'], ['fix', 'วิธีแก้ไข'], ['afterPhotos', 'รูปหลังซ่อม'], ['downtimeMin', 'เวลาหยุดเครื่อง (นาที)'], ['partsUsed', 'อะไหล่ที่ใช้'],
    ['partsCost', 'ค่าอะไหล่'], ['outsideCost', 'ค่าจ้างภายนอก'], ['outsideVendor', 'ผู้รับเหมา / ร้าน'], ['totalCost', 'ค่าใช้จ่ายรวม'],
    ['confirm', 'ผลตรวจรับ'], ['confirmBy', 'ผู้ตรวจรับ'], ['confirmNote', 'หมายเหตุตรวจรับ'], ['timeline', 'ประวัติงาน'], ['note', 'หมายเหตุ'],
    ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  mnt_machines: { tab: 'ทะเบียนเครื่องจักร', cols: [
    ['id', 'รหัส'], ['code', 'รหัสเครื่อง'], ['name', 'ชื่อเครื่องจักร / อุปกรณ์'], ['type', 'ประเภท'], ['building', 'อาคาร'], ['location', 'จุดติดตั้ง'],
    ['brand', 'ยี่ห้อ'], ['model', 'รุ่น'], ['serial', 'หมายเลขเครื่อง'], ['installDate', 'วันที่ติดตั้ง'], ['warrantyEnd', 'ประกันถึง'],
    ['vendor', 'ผู้ขาย / ผู้ดูแล'], ['status', 'สถานะ'], ['photo', 'รูปเครื่อง'], ['note', 'หมายเหตุ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  mnt_pm: { tab: 'แผนบำรุงรักษา (PM)', cols: [
    ['id', 'รหัส'], ['machineId', 'รหัสเครื่องจักร'], ['machineName', 'เครื่องจักร / อุปกรณ์'], ['title', 'งาน PM'], ['tasks', 'รายการตรวจ / บำรุง'],
    ['everyN', 'ทุก ๆ'], ['everyUnit', 'หน่วยรอบ'], ['startDate', 'เริ่มรอบแรก'], ['lastDate', 'ทำล่าสุด'], ['nextDate', 'ครบกำหนดครั้งถัดไป'],
    ['assignee', 'ผู้รับผิดชอบ'], ['active', 'ใช้งาน'], ['note', 'หมายเหตุ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  mnt_pmlog: { tab: 'ประวัติ PM', cols: [
    ['id', 'รหัส'], ['pmId', 'รหัสแผน PM'], ['machineId', 'รหัสเครื่องจักร'], ['machineName', 'เครื่องจักร / อุปกรณ์'], ['title', 'งาน PM'], ['date', 'วันที่ทำ'],
    ['by', 'ผู้ทำ'], ['result', 'ผล'], ['checks', 'ผลตรวจรายข้อ'], ['pmCost', 'ค่าใช้จ่าย'], ['repairId', 'ใบแจ้งซ่อมที่เปิด'], ['note', 'หมายเหตุ'], ['createdAt', 'บันทึกเมื่อ']] },
  mnt_parts: { tab: 'อะไหล่', cols: [
    ['id', 'รหัส'], ['code', 'รหัสอะไหล่'], ['name', 'ชื่ออะไหล่'], ['unit', 'หน่วย'], ['minStock', 'จุดสั่งซื้อขั้นต่ำ'], ['price', 'ราคาต่อหน่วย'],
    ['place', 'ที่เก็บ'], ['machines', 'ใช้กับเครื่อง'], ['note', 'หมายเหตุ'], ['active', 'ใช้งาน'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  mnt_moves: { tab: 'รับเข้า-เบิกอะไหล่', cols: [
    ['id', 'รหัส'], ['date', 'วันที่'], ['partId', 'รหัสอะไหล่'], ['partName', 'ชื่ออะไหล่'], ['type', 'ประเภท'], ['qty', 'จำนวน'], ['price', 'ราคาต่อหน่วย'],
    ['amount', 'มูลค่า'], ['repairId', 'ใบแจ้งซ่อม'], ['ref', 'อ้างอิง'], ['note', 'หมายเหตุ'], ['by', 'ผู้บันทึก'], ['createdAt', 'บันทึกเมื่อ']] },
  mnt_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] }
};
var MNT_ST_ = { 'new': 'รอรับงาน', accepted: 'รับงานแล้ว', doing: 'กำลังซ่อม', wait: 'รออะไหล่ / รอช่างนอก', done: 'ซ่อมเสร็จ รอตรวจรับ', closed: 'ปิดงานแล้ว', cancel: 'ยกเลิก' };
var MNT_OPEN_ = { 'new': 1, accepted: 1, doing: 1, wait: 1 };
var MNT_URG_ = { low: 'ไม่เร่ง', normal: 'ปกติ', high: 'ด่วน', urgent: 'ด่วนมาก (หยุดผลิต)' };
var MNT_UNITS_ = { day: 'วัน', week: 'สัปดาห์', month: 'เดือน', year: 'ปี' };
var MNT_SETTINGS_DEFAULT_ = {
  techs: '',
  categories: 'เครื่องจักร, ไฟฟ้า, ประปา, อาคาร / โครงสร้าง, แอร์ / ระบบทำความเย็น, ลม / แก๊ส / หม้อไอน้ำ, อื่น ๆ',
  buildings: 'G1, G2, G3, G4, G5, ออฟฟิศ, คลังสินค้า, อื่น ๆ',
  depts: 'ฝ่ายผลิต, QA / QC, คลังสินค้า, ออฟฟิศ, แม่บ้าน, อื่น ๆ',
  machineTypes: 'เครื่องผัด / กระทะ, เครื่องทอด, เครื่องบรรจุ, เครื่องซีล, สายพาน, ปั๊มลม, ตู้เย็น / ห้องเย็น, หม้อไอน้ำ, ระบบไฟฟ้า, อื่น ๆ',
  notifyReporter: '1', notifyGroupDone: ''
};

// ---------- พื้นฐาน ----------
function requireMnt_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'maintenance') throw new Error('แผนกนี้ไม่มีระบบช่าง');
  return dept;
}
function mntRegister_() {
  Object.keys(MNT_TABLES_).forEach(function (k) { PUR_TABLES_[k] = MNT_TABLES_[k]; });
  ['reportDate', 'installDate', 'warrantyEnd', 'startDate', 'lastDate', 'nextDate', 'date'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['downtimeMin', 'partsCost', 'outsideCost', 'totalCost', 'everyN', 'qty', 'price', 'amount', 'minStock', 'pmCost'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function mntBook_(dept) { mntRegister_(); return purBook_(dept); }
function mntReadBook_(dept) { return deptReadBook_(dept, mntBook_, mntRegister_); }
function mntDept_() { return DEPARTMENTS.filter(function (x) { return x.key === 'MNT'; })[0]; }
function mntText_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 1000); }
function mntJson_(v, def) { try { var o = typeof v === 'string' ? JSON.parse(v || '') : v; return o == null ? def : o; } catch (e) { return def; } }
function mntList_(s) { return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
function mntSettings_(ss) {
  var s = {};
  Object.keys(MNT_SETTINGS_DEFAULT_).forEach(function (k) { s[k] = MNT_SETTINGS_DEFAULT_[k]; });
  purRead_(ss, 'mnt_settings').forEach(function (x) { if (x.id) s[x.id] = String(x.value == null ? '' : x.value); });
  return s;
}
function mntNextCode_(list, date) {
  var pre = 'MR' + String(date).slice(2, 4) + String(date).slice(5, 7) + '-', n = 0;
  list.forEach(function (x) { if (String(x.code).indexOf(pre) === 0) n = Math.max(n, parseInt(String(x.code).slice(pre.length), 10) || 0); });
  return pre + ('00' + (n + 1)).slice(-3);
}
// วันที่ + n รอบ (วัน / สัปดาห์ / เดือน / ปี) · วันที่ 31 + 1 เดือน = วันสุดท้ายของเดือนถัดไป
function mntAddCycle_(iso, n, unit) {
  var p = String(iso).split('-').map(Number); n = Math.max(1, Number(n) || 1);
  if (unit === 'day' || unit === 'week') { var d = new Date(p[0], p[1] - 1, p[2] + n * (unit === 'week' ? 7 : 1)); return Utilities.formatDate(d, PUR_TZ_, 'yyyy-MM-dd'); }
  var m = p[1] - 1 + n * (unit === 'year' ? 12 : 1), y = p[0] + Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var last = new Date(y, m + 1, 0).getDate();
  return Utilities.formatDate(new Date(y, m, Math.min(p[2], last)), PUR_TZ_, 'yyyy-MM-dd');
}
function mntMinutes_(a, b) {   // 'yyyy-MM-dd HH:mm:ss' สองค่า → นาที
  var t = function (s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN; };
  var x = t(a), y = t(b);
  return isFinite(x) && isFinite(y) && y >= x ? Math.round((y - x) / 60000) : '';
}
function mntRepairOut_(r) {
  r.photos = purParseFiles_(r.photos); r.afterPhotos = purParseFiles_(r.afterPhotos); r.partsUsed = mntJson_(r.partsUsed, []); r.timeline = mntJson_(r.timeline, []);
  if (!MNT_ST_[r.status]) r.status = 'new';
  if (!MNT_URG_[r.urgency]) r.urgency = 'normal';
  r.stopLine = r.stopLine === 'yes' || r.stopLine === true || r.stopLine === 'ใช่' ? 'yes' : '';
  r.open = !!MNT_OPEN_[r.status];
  // เวลาหยุดเครื่อง: ใส่เองก่อน · ไม่ได้ใส่แต่กระทบการผลิต = ตั้งแต่แจ้งจนซ่อมเสร็จ
  r.downtime = r.downtimeMin !== '' && r.downtimeMin != null ? Number(r.downtimeMin) || 0 : r.stopLine && r.doneAt ? (mntMinutes_(r.reportAt, r.doneAt) || 0) : 0;
  r.hoursToDone = r.doneAt ? Math.round((mntMinutes_(r.reportAt, r.doneAt) || 0) / 6) / 10 : '';
  delete r.lineUserId;
  return r;
}
function mntStock_(moves) {
  var bal = {};
  moves.forEach(function (m) { var q = Number(m.qty) || 0; bal[m.partId] = (bal[m.partId] || 0) + (m.type === 'OUT' ? -q : q); });
  return bal;
}
function mntPartsOut_(parts, moves) {
  var bal = mntStock_(moves);
  return parts.map(function (p) { p.balance = Math.round((bal[p.id] || 0) * 1000) / 1000; p.low = p.active !== 'off' && p.minStock !== '' && p.balance <= Number(p.minStock); return p; });
}
function mntPmOut_(p, today) {
  p.tasks = mntList_(String(p.tasks || '').replace(/\n/g, ','));
  p.active = p.active === 'off' ? 'off' : 'on';
  p.overdue = p.active === 'on' && p.nextDate && p.nextDate < today;
  return p;
}
function mntAddTimeline_(o, text, by) {
  var t = mntJson_(o.timeline, []);
  t.push({ at: purNow_(), t: String(text).slice(0, 300), by: String(by || '').slice(0, 60) });
  o.timeline = JSON.stringify(t.slice(-60));
}

// ---------- รูป ----------
function mntFolder_(dept, name) {
  var fid = deptConfig_(dept.key).folderId;
  if (fid) {
    try { var parent = DriveApp.getFolderById(fid), it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); } catch (e) {}
  }
  return mntFallback_();
}
function mntFallback_() {
  var name = 'รูปแจ้งซ่อม (ฝ่ายช่าง)', it = DriveApp.getRootFolder().getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(name);
}
// แชร์แบบมีลิงก์ดูได้ (ให้หน้าเว็บ / การ์ด LINE แสดงรูปได้) · โฟลเดอร์ของบัญชีฝ่ายแชร์ไม่ได้ → ย้ายสำเนาไป Drive ของบัญชีสคริปต์
function mntShare_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return file; }
  catch (e) {
    var copy = file.makeCopy(file.getName(), mntFallback_());
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    try { file.setTrashed(true); } catch (e2) {}
    return copy;
  }
}
// รูปจากหน้าเว็บ (base64 JPEG / PNG ย่อแล้ว) → ไฟล์ใน Drive · คืน {id, name, url}
function mntSavePhoto_(dept, folderName, prefix, name, mime, b64) {
  mime = /^image\/(jpeg|png|webp)$/.test(mime) ? mime : 'image/jpeg';
  var bytes = Utilities.base64Decode(String(b64 || '').replace(/^data:[^,]+,/, ''));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('รูปว่างหรือใหญ่เกิน 8 MB');
  var safe = purClean_(name, 60).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
  var f = mntShare_(mntFolder_(dept, folderName).createFile(Utilities.newBlob(bytes, mime, prefix + '_' + safe)));
  return { id: f.getId(), name: safe, url: 'https://lh3.googleusercontent.com/d/' + f.getId(), at: purNow_() };
}
function mntTrash_(files) { (files || []).forEach(function (f) { try { if (f && f.id) DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} }); }

// ---------- โหลด ----------
function mntLoad(token) {
  var dept = requireMnt_(token), ss = mntReadBook_(dept), today = purToday_();
  var moves = purRead_(ss, 'mnt_moves');
  return { ok: true, today: today, sheetUrl: ss.getUrl(), settings: mntSettings_(ss), hasFolder: !!deptConfig_(dept.key).folderId,
    repairs: purRead_(ss, 'mnt_repairs').map(mntRepairOut_),
    machines: purRead_(ss, 'mnt_machines'),
    pm: purRead_(ss, 'mnt_pm').map(function (p) { return mntPmOut_(p, today); }),
    pmlog: purRead_(ss, 'mnt_pmlog').slice(-600).map(function (l) { l.checks = mntJson_(l.checks, []); return l; }),
    parts: mntPartsOut_(purRead_(ss, 'mnt_parts'), moves),
    moves: moves.slice(-400) };
}
function mntLog(token, limit) {
  var dept = requireMnt_(token), ss = mntBook_(dept);
  return { ok: true, rows: purRead_(ss, 'log').reverse().slice(0, Math.min(500, Number(limit) || 200)) };
}
function mntSaveSettings(token, o) {
  var dept = requireMnt_(token);
  o = o || {};
  return purLocked_(function () {
    var ss = mntBook_(dept), rows = purRead_(ss, 'mnt_settings');
    Object.keys(MNT_SETTINGS_DEFAULT_).forEach(function (k) {
      if (o[k] === undefined) return;
      var v = mntText_(o[k], 3000), row = rows.filter(function (x) { return x.id === k; })[0];
      purWrite_(ss, 'mnt_settings', row ? { _row: row._row, id: k, value: v } : { id: k, value: v });
    });
    purLogWrite_(ss, 'แก้ตั้งค่าฝ่ายช่าง', 'mnt_settings', '', Object.keys(o).join(', '));
    return { ok: true, settings: mntSettings_(ss) };
  });
}

// ---------- ใบแจ้งซ่อม ----------
// อะไหล่ที่ใช้: [{partId, name, qty, unit, price}] · partId = อะไหล่ในสต๊อก (เขียนรายการเบิก) · ไม่มี partId = ซื้อมาใช้เลย (คิดแค่ค่าใช้จ่าย)
function mntCleanParts_(a, parts) {
  var byId = {}; (parts || []).forEach(function (p) { byId[p.id] = p; });
  return (Array.isArray(a) ? a : []).slice(0, 30).map(function (x) {
    x = x || {}; var p = byId[x.partId], q = purNum_(x.qty), pr = purNum_(x.price);
    return { partId: p ? p.id : '', name: purClean_(x.name || (p && p.name), 120), qty: q === '' || q < 0 ? 0 : Math.round(q * 1000) / 1000,
      unit: purClean_(x.unit || (p && p.unit), 20), price: pr === '' || pr < 0 ? (p && Number(p.price)) || 0 : pr };
  }).filter(function (x) { return x.name && x.qty > 0; });
}
// เขียนรายการเบิกอะไหล่ของใบแจ้งซ่อมใหม่ (ลบของเดิมของใบนี้ก่อน) — ต้องถือ lock อยู่
function mntSyncMoves_(ss, rep, used, by) {
  var sh = purSheet_(ss, 'mnt_moves'), old = purRead_(ss, 'mnt_moves').filter(function (m) { return m.repairId === rep.id && m.type === 'OUT'; });
  old.sort(function (a, b) { return b._row - a._row; }).forEach(function (m) { sh.deleteRow(m._row); });
  var date = String(rep.doneAt || rep.startAt || purNow_()).slice(0, 10), now = purNow_();
  used.filter(function (x) { return x.partId; }).forEach(function (x) {
    purWrite_(ss, 'mnt_moves', { id: purId_('MV'), date: date, partId: x.partId, partName: x.name, type: 'OUT', qty: x.qty, price: x.price,
      amount: Math.round(x.qty * x.price * 100) / 100, repairId: rep.id, ref: rep.code, note: 'ใช้ซ่อม ' + rep.code, by: by || '', createdAt: now });
  });
}
function mntCosts_(o, used) {
  o.partsUsed = JSON.stringify(used);
  o.partsCost = Math.round(used.reduce(function (t, x) { return t + x.qty * x.price; }, 0) * 100) / 100;
  var out = purNum_(o.outsideCost); o.outsideCost = out === '' || out < 0 ? '' : out;
  o.totalCost = Math.round(((Number(o.partsCost) || 0) + (Number(o.outsideCost) || 0)) * 100) / 100;
}
// เปลี่ยนสถานะ → ลงเวลาให้อัตโนมัติ (รับงาน / เริ่มซ่อม / ซ่อมเสร็จ / ปิดงาน)
function mntApplyStatus_(o, st, by) {
  var now = purNow_(), was = o.status;
  if (!MNT_ST_[st] || st === was) return false;
  o.status = st;
  if (st !== 'new' && st !== 'cancel' && !o.acceptedAt) o.acceptedAt = now;
  if ((st === 'doing' || st === 'wait' || st === 'done' || st === 'closed') && !o.startAt) o.startAt = now;
  if (st === 'done' || st === 'closed') { if (!o.doneAt) o.doneAt = now; }
  else if (st !== 'cancel') { o.doneAt = ''; o.confirm = ''; }
  if (st === 'closed') { if (!o.closedAt) o.closedAt = now; } else o.closedAt = '';
  if (st === 'new') { o.acceptedAt = ''; o.startAt = ''; }
  mntAddTimeline_(o, MNT_ST_[was] ? MNT_ST_[was] + ' → ' + MNT_ST_[st] : MNT_ST_[st], by);
  return true;
}
function mntSaveRepair(token, r) {
  var dept = requireMnt_(token);
  r = r || {};
  var problem = mntText_(r.problem, 2000);
  if (!problem) return { ok: false, error: 'ใส่อาการ / ปัญหาที่พบ' };
  if (!purClean_(r.machineName, 150) && !purClean_(r.location, 150)) return { ok: false, error: 'ใส่เครื่องจักร / อุปกรณ์ หรือจุดที่เสีย' };
  var res = purLocked_(function () {
    var ss = mntBook_(dept), list = purRead_(ss, 'mnt_repairs'), now = purNow_(), by = purClean_(r.by, 60) || 'ฝ่ายช่าง';
    var old = r.id ? list.filter(function (x) { return x.id === r.id; })[0] : null;
    if (r.id && !old) return { ok: false, error: 'ไม่พบใบแจ้งซ่อมนี้ (อาจถูกลบไปแล้ว)' };
    var o = old || { id: purId_('MR'), code: mntNextCode_(list, purToday_()), reportAt: now, reportDate: purToday_(), source: 'web', status: 'new', photos: '[]', afterPhotos: '[]', timeline: '[]', createdAt: now };
    if (!old) mntAddTimeline_(o, 'แจ้งซ่อม (ฝ่ายช่างบันทึกเอง)', by);
    if (r.reportAt && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(r.reportAt)) { o.reportAt = String(r.reportAt).replace('T', ' ').slice(0, 16) + ':00'; o.reportDate = o.reportAt.slice(0, 10); }
    ['reporter', 'reporterDept', 'phone', 'building', 'location', 'machineName', 'category', 'assignee', 'outsideVendor', 'confirmBy'].forEach(function (k) { if (r[k] !== undefined) o[k] = purClean_(r[k], k === 'machineName' || k === 'location' ? 150 : 80); });
    o.problem = problem;
    ['cause', 'fix', 'note', 'confirmNote'].forEach(function (k) { if (r[k] !== undefined) o[k] = mntText_(r[k], 2000); });
    if (r.machineId !== undefined) o.machineId = purClean_(r.machineId, 40);
    if (MNT_URG_[r.urgency]) o.urgency = r.urgency;
    if (r.stopLine !== undefined) o.stopLine = r.stopLine === 'yes' || r.stopLine === true ? 'yes' : '';
    if (r.downtimeMin !== undefined) { var dm = purNum_(r.downtimeMin); o.downtimeMin = dm === '' || dm < 0 ? '' : Math.round(dm); }
    if (r.outsideCost !== undefined) o.outsideCost = r.outsideCost;
    if (r.confirm !== undefined) o.confirm = r.confirm === 'ok' || r.confirm === 'no' ? r.confirm : '';
    if (r.status) mntApplyStatus_(o, r.status, by);
    var used = r.partsUsed !== undefined ? mntCleanParts_(r.partsUsed, purRead_(ss, 'mnt_parts')) : mntJson_(o.partsUsed, []);
    mntCosts_(o, used);
    o.updatedAt = now;
    purWrite_(ss, 'mnt_repairs', o);
    if (r.partsUsed !== undefined || (old && old.status !== o.status)) mntSyncMoves_(ss, o, used, by);
    purLogWrite_(ss, old ? 'แก้ใบแจ้งซ่อม' : 'เพิ่มใบแจ้งซ่อม', 'mnt_repairs', o.id, o.code + ' · ' + (o.machineName || o.location) + ' · ' + MNT_ST_[o.status]);
    var row = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === o.id; })[0];
    return { ok: true, repair: row, wasStatus: old ? old.status : '', isNew: !old };
  });
  if (!res.ok) return res;
  var line = '';
  try { line = mntAfterChange_(res.repair, res.wasStatus, res.isNew); } catch (e) { line = 'ส่ง LINE ไม่สำเร็จ: ' + e.message; }
  return { ok: true, repair: mntRepairOut_(res.repair), line: line };
}
function mntDeleteRepair(token, id) {
  var dept = requireMnt_(token);
  return purLocked_(function () {
    var ss = mntBook_(dept), row = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบใบแจ้งซ่อมนี้' };
    mntSyncMoves_(ss, row, [], '');
    mntTrash_(purParseFiles_(row.photos).concat(purParseFiles_(row.afterPhotos)));
    purSheet_(ss, 'mnt_repairs').deleteRow(purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0]._row);
    purLogWrite_(ss, 'ลบใบแจ้งซ่อม', 'mnt_repairs', id, row.code + ' · ' + (row.machineName || row.location));
    return { ok: true };
  });
}
// slot = photos (ก่อนซ่อม) | afterPhotos (หลังซ่อม)
function mntUploadPhoto(token, id, slot, name, mime, b64) {
  var dept = requireMnt_(token);
  slot = slot === 'afterPhotos' ? 'afterPhotos' : 'photos';
  var ss0 = mntBook_(dept), cur = purRead_(ss0, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
  if (!cur) return { ok: false, error: 'บันทึกใบแจ้งซ่อมก่อน แล้วค่อยแนบรูป' };
  if (purParseFiles_(cur[slot]).length >= 8) return { ok: false, error: 'แนบได้สูงสุด 8 รูป' };
  var f = mntSavePhoto_(dept, 'รูปแจ้งซ่อม', cur.code + (slot === 'afterPhotos' ? '_หลังซ่อม' : '_ก่อนซ่อม'), name, mime, b64);
  return purLocked_(function () {
    var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
    if (!o) { mntTrash_([f]); return { ok: false, error: 'ไม่พบใบแจ้งซ่อม' }; }
    var files = purParseFiles_(o[slot]); files.push(f);
    o[slot] = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'mnt_repairs', o);
    return { ok: true, files: files };
  });
}
function mntRemovePhoto(token, id, slot, fileId) {
  var dept = requireMnt_(token);
  slot = slot === 'afterPhotos' ? 'afterPhotos' : 'photos';
  return purLocked_(function () {
    var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบใบแจ้งซ่อม' };
    var files = purParseFiles_(o[slot]).filter(function (x) { return x.id !== fileId; });
    o[slot] = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'mnt_repairs', o);
    mntTrash_([{ id: fileId }]);
    return { ok: true, files: files };
  });
}

// ---------- เครื่องจักร ----------
function mntSaveMachine(token, m) {
  var dept = requireMnt_(token);
  m = m || {};
  var name = purClean_(m.name, 150);
  if (!name) return { ok: false, error: 'ใส่ชื่อเครื่องจักร / อุปกรณ์' };
  return purLocked_(function () {
    var ss = mntBook_(dept), list = purRead_(ss, 'mnt_machines'), now = purNow_();
    var old = m.id ? list.filter(function (x) { return x.id === m.id; })[0] : null;
    if (m.id && !old) return { ok: false, error: 'ไม่พบเครื่องนี้ (อาจถูกลบไปแล้ว)' };
    var code = purClean_(m.code, 40);
    if (code && list.some(function (x) { return x.id !== m.id && String(x.code).toLowerCase() === code.toLowerCase(); })) return { ok: false, error: 'มีรหัสเครื่อง ' + code + ' อยู่แล้ว' };
    var o = old || { id: purId_('MC'), createdAt: now };
    o.code = code; o.name = name;
    ['type', 'building', 'location', 'brand', 'model', 'serial', 'vendor'].forEach(function (k) { o[k] = purClean_(m[k], 120); });
    o.installDate = purDate_(m.installDate); o.warrantyEnd = purDate_(m.warrantyEnd);
    o.status = { active: 1, standby: 1, retired: 1 }[m.status] ? m.status : 'active';
    o.note = mntText_(m.note, 1000); o.updatedAt = now;
    purWrite_(ss, 'mnt_machines', o);
    // ชื่อเครื่องเปลี่ยน → แผน PM ของเครื่องนี้ใช้ชื่อใหม่
    if (old && old.name !== name) purRead_(ss, 'mnt_pm').filter(function (p) { return p.machineId === o.id; }).forEach(function (p) { p.machineName = name; purWrite_(ss, 'mnt_pm', p); });
    purLogWrite_(ss, old ? 'แก้ทะเบียนเครื่องจักร' : 'เพิ่มเครื่องจักร', 'mnt_machines', o.id, (code ? code + ' ' : '') + name);
    return { ok: true, machine: purRead_(ss, 'mnt_machines').filter(function (x) { return x.id === o.id; })[0] };
  });
}
function mntDeleteMachine(token, id) {
  var dept = requireMnt_(token);
  return purLocked_(function () {
    var ss = mntBook_(dept), row = purRead_(ss, 'mnt_machines').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบเครื่องนี้' };
    var n = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.machineId === id; }).length, p = purRead_(ss, 'mnt_pm').filter(function (x) { return x.machineId === id; }).length;
    if (n || p) return { ok: false, error: 'เครื่องนี้มีประวัติแจ้งซ่อม ' + n + ' ใบ / แผน PM ' + p + ' รายการ — เปลี่ยนสถานะเป็น "เลิกใช้" แทนการลบ' };
    if (row.photo) mntTrash_([{ id: String(row.photo).replace(/^.*\/d\//, '') }]);
    purSheet_(ss, 'mnt_machines').deleteRow(row._row);
    purLogWrite_(ss, 'ลบเครื่องจักร', 'mnt_machines', id, row.name);
    return { ok: true };
  });
}
function mntMachinePhoto(token, id, name, mime, b64) {
  var dept = requireMnt_(token), ss0 = mntBook_(dept), cur = purRead_(ss0, 'mnt_machines').filter(function (x) { return x.id === id; })[0];
  if (!cur) return { ok: false, error: 'บันทึกเครื่องก่อน แล้วค่อยใส่รูป' };
  var f = mntSavePhoto_(dept, 'รูปเครื่องจักร', cur.code || cur.name, name, mime, b64);
  return purLocked_(function () {
    var ss = mntBook_(dept), o = purRead_(ss, 'mnt_machines').filter(function (x) { return x.id === id; })[0];
    if (!o) { mntTrash_([f]); return { ok: false, error: 'ไม่พบเครื่อง' }; }
    if (o.photo) mntTrash_([{ id: String(o.photo).replace(/^.*\/d\//, '') }]);
    o.photo = f.url; o.updatedAt = purNow_();
    purWrite_(ss, 'mnt_machines', o);
    return { ok: true, photo: f.url };
  });
}

// ---------- แผน PM ----------
function mntSavePm(token, p) {
  var dept = requireMnt_(token);
  p = p || {};
  var title = purClean_(p.title, 150), n = Math.round(Number(p.everyN));
  if (!title) return { ok: false, error: 'ใส่ชื่องาน PM เช่น "เปลี่ยนน้ำมันเกียร์"' };
  if (!(n >= 1 && n <= 999)) return { ok: false, error: 'ใส่รอบการทำ (ทุก ๆ กี่วัน / สัปดาห์ / เดือน / ปี)' };
  var unit = MNT_UNITS_[p.everyUnit] ? p.everyUnit : 'month', start = purDate_(p.startDate) || purToday_();
  return purLocked_(function () {
    var ss = mntBook_(dept), list = purRead_(ss, 'mnt_pm'), now = purNow_();
    var old = p.id ? list.filter(function (x) { return x.id === p.id; })[0] : null;
    if (p.id && !old) return { ok: false, error: 'ไม่พบแผน PM นี้ (อาจถูกลบไปแล้ว)' };
    var mc = purRead_(ss, 'mnt_machines').filter(function (x) { return x.id === p.machineId; })[0];
    var o = old || { id: purId_('PM'), createdAt: now };
    o.machineId = mc ? mc.id : ''; o.machineName = mc ? mc.name : purClean_(p.machineName, 150);
    o.title = title; o.tasks = mntList_(String(p.tasks || '').replace(/\n/g, ',')).slice(0, 40).join('\n');
    o.everyN = n; o.everyUnit = unit; o.startDate = start; o.assignee = purClean_(p.assignee, 80);
    o.active = p.active === 'off' ? 'off' : 'on'; o.note = mntText_(p.note, 1000);
    // ครบกำหนดครั้งถัดไป: ใส่เองได้ · ไม่ใส่ = ทำล่าสุด + รอบ (ยังไม่เคยทำ = วันเริ่มรอบแรก)
    o.nextDate = purDate_(p.nextDate) || (o.lastDate ? mntAddCycle_(o.lastDate, n, unit) : start);
    o.updatedAt = now;
    purWrite_(ss, 'mnt_pm', o);
    purLogWrite_(ss, old ? 'แก้แผน PM' : 'เพิ่มแผน PM', 'mnt_pm', o.id, o.title + ' · ' + (o.machineName || '-') + ' · ทุก ' + n + ' ' + MNT_UNITS_[unit]);
    return { ok: true, pm: mntPmOut_(purRead_(ss, 'mnt_pm').filter(function (x) { return x.id === o.id; })[0], purToday_()) };
  });
}
function mntDeletePm(token, id) {
  var dept = requireMnt_(token);
  return purLocked_(function () {
    var ss = mntBook_(dept), row = purRead_(ss, 'mnt_pm').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบแผน PM นี้' };
    purSheet_(ss, 'mnt_pm').deleteRow(row._row);
    purLogWrite_(ss, 'ลบแผน PM', 'mnt_pm', id, row.title + ' · ' + row.machineName);
    return { ok: true };
  });
}
// บันทึกว่าทำ PM แล้ว → ประวัติ PM + เลื่อนกำหนดครั้งถัดไป · พบปัญหา + ติ๊กเปิดใบแจ้งซ่อม → สร้างใบแจ้งซ่อมให้เลย
function mntDonePm(token, pmId, d) {
  var dept = requireMnt_(token);
  d = d || {};
  var date = purDate_(d.date) || purToday_(), by = purClean_(d.by, 80);
  if (!by) return { ok: false, error: 'ใส่ชื่อผู้ทำ PM' };
  if (date > purToday_()) return { ok: false, error: 'วันที่ทำต้องไม่เกินวันนี้' };
  var res = purLocked_(function () {
    var ss = mntBook_(dept), p = purRead_(ss, 'mnt_pm').filter(function (x) { return x.id === pmId; })[0];
    if (!p) return { ok: false, error: 'ไม่พบแผน PM นี้' };
    var checks = (Array.isArray(d.checks) ? d.checks : []).slice(0, 40).map(function (c) { return { t: purClean_(c && c.t, 150), ok: !!(c && c.ok) }; }).filter(function (c) { return c.t; });
    var issue = d.result === 'issue' || checks.some(function (c) { return !c.ok; }), now = purNow_(), rep = null;
    if (issue && d.openRepair) {
      var list = purRead_(ss, 'mnt_repairs');
      rep = { id: purId_('MR'), code: mntNextCode_(list, purToday_()), reportAt: now, reportDate: purToday_(), reporter: by, reporterDept: 'ฝ่ายช่าง (PM)', source: 'pm',
        machineId: p.machineId, machineName: p.machineName, category: 'เครื่องจักร', urgency: 'normal', status: 'new', photos: '[]', afterPhotos: '[]', timeline: '[]',
        problem: 'พบระหว่าง PM "' + p.title + '": ' + (checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.t; }).join(', ') || '-') + (d.note ? ' — ' + mntText_(d.note, 500) : ''), createdAt: now, updatedAt: now };
      mntAddTimeline_(rep, 'เปิดจาก PM ' + p.title, by);
      var mc = purRead_(ss, 'mnt_machines').filter(function (x) { return x.id === p.machineId; })[0];
      if (mc) { rep.building = mc.building; rep.location = mc.location; }
      mntCosts_(rep, []);
      purWrite_(ss, 'mnt_repairs', rep);
    }
    var cost = purNum_(d.pmCost);
    purWrite_(ss, 'mnt_pmlog', { id: purId_('PL'), pmId: p.id, machineId: p.machineId, machineName: p.machineName, title: p.title, date: date, by: by,
      result: issue ? 'issue' : 'ok', checks: JSON.stringify(checks), pmCost: cost === '' || cost < 0 ? '' : cost, repairId: rep ? rep.id : '', note: mntText_(d.note, 1000), createdAt: now });
    if (!p.lastDate || date >= p.lastDate) { p.lastDate = date; p.nextDate = mntAddCycle_(date, p.everyN, p.everyUnit); }
    p.updatedAt = now;
    purWrite_(ss, 'mnt_pm', p);
    purLogWrite_(ss, 'บันทึกทำ PM', 'mnt_pm', p.id, p.title + ' · ' + p.machineName + ' · ' + date + (issue ? ' · พบปัญหา' : ' · ปกติ') + (rep ? ' → ' + rep.code : ''));
    return { ok: true, rep: rep };
  });
  if (res.ok && res.rep) { try { mntAfterChange_(res.rep, '', true); } catch (e) {} }
  return res.ok ? { ok: true, repairCode: res.rep ? res.rep.code : '' } : res;
}
function mntDeletePmLog(token, id) {
  var dept = requireMnt_(token);
  return purLocked_(function () {
    var ss = mntBook_(dept), row = purRead_(ss, 'mnt_pmlog').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    purSheet_(ss, 'mnt_pmlog').deleteRow(row._row);
    // ทำล่าสุดของแผน = รายการที่เหลือล่าสุด
    var p = purRead_(ss, 'mnt_pm').filter(function (x) { return x.id === row.pmId; })[0];
    if (p) {
      var rest = purRead_(ss, 'mnt_pmlog').filter(function (x) { return x.pmId === p.id; }).map(function (x) { return x.date; }).sort();
      p.lastDate = rest.length ? rest[rest.length - 1] : '';
      p.nextDate = p.lastDate ? mntAddCycle_(p.lastDate, p.everyN, p.everyUnit) : (p.startDate || purToday_());
      purWrite_(ss, 'mnt_pm', p);
    }
    purLogWrite_(ss, 'ลบประวัติ PM', 'mnt_pmlog', id, row.title + ' · ' + row.date);
    return { ok: true };
  });
}

// ---------- อะไหล่ ----------
function mntSavePart(token, p) {
  var dept = requireMnt_(token);
  p = p || {};
  var name = purClean_(p.name, 150);
  if (!name) return { ok: false, error: 'ใส่ชื่ออะไหล่' };
  return purLocked_(function () {
    var ss = mntBook_(dept), list = purRead_(ss, 'mnt_parts'), now = purNow_();
    var old = p.id ? list.filter(function (x) { return x.id === p.id; })[0] : null;
    if (p.id && !old) return { ok: false, error: 'ไม่พบอะไหล่นี้ (อาจถูกลบไปแล้ว)' };
    if (list.some(function (x) { return x.id !== p.id && String(x.name).trim().toLowerCase() === name.toLowerCase(); })) return { ok: false, error: 'มีอะไหล่ชื่อนี้อยู่แล้ว' };
    var o = old || { id: purId_('PT'), createdAt: now };
    o.code = purClean_(p.code, 40); o.name = name; o.unit = purClean_(p.unit, 20) || 'ชิ้น';
    var mn = purNum_(p.minStock), pr = purNum_(p.price);
    o.minStock = mn === '' || mn < 0 ? '' : mn; o.price = pr === '' || pr < 0 ? '' : pr;
    o.place = purClean_(p.place, 120); o.machines = purClean_(p.machines, 300); o.note = mntText_(p.note, 1000);
    o.active = p.active === 'off' ? 'off' : 'on'; o.updatedAt = now;
    purWrite_(ss, 'mnt_parts', o);
    // ยอดตั้งต้นตอนเพิ่มอะไหล่ใหม่
    var init = purNum_(p.initQty);
    if (!old && init !== '' && init > 0) purWrite_(ss, 'mnt_moves', { id: purId_('MV'), date: purToday_(), partId: o.id, partName: name, type: 'ADJ', qty: init, price: o.price, amount: o.price === '' ? '' : Math.round(init * o.price * 100) / 100, note: 'ยอดตั้งต้น', by: purClean_(p.by, 60), createdAt: now });
    purLogWrite_(ss, old ? 'แก้อะไหล่' : 'เพิ่มอะไหล่', 'mnt_parts', o.id, name);
    var moves = purRead_(ss, 'mnt_moves');
    return { ok: true, part: mntPartsOut_(purRead_(ss, 'mnt_parts').filter(function (x) { return x.id === o.id; }), moves)[0] };
  });
}
function mntDeletePart(token, id) {
  var dept = requireMnt_(token);
  return purLocked_(function () {
    var ss = mntBook_(dept), row = purRead_(ss, 'mnt_parts').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบอะไหล่นี้' };
    var n = purRead_(ss, 'mnt_moves').filter(function (m) { return m.partId === id; }).length;
    if (n) return { ok: false, error: 'อะไหล่นี้มีรายการรับเข้า / เบิก ' + n + ' รายการ — เปลี่ยนเป็น "เลิกใช้" แทนการลบ' };
    purSheet_(ss, 'mnt_parts').deleteRow(row._row);
    purLogWrite_(ss, 'ลบอะไหล่', 'mnt_parts', id, row.name);
    return { ok: true };
  });
}
// รับเข้า (IN) / เบิกใช้ทั่วไป (OUT ไม่ผูกใบแจ้งซ่อม) / ปรับยอดตามนับจริง (ADJ: qty = ยอดที่นับได้ → บันทึกส่วนต่าง)
function mntMovePart(token, m) {
  var dept = requireMnt_(token);
  m = m || {};
  var type = { IN: 1, OUT: 1, ADJ: 1 }[m.type] ? m.type : '', q = purNum_(m.qty), date = purDate_(m.date) || purToday_();
  if (!type) return { ok: false, error: 'เลือกรับเข้า / เบิก / ปรับยอด' };
  if (q === '' || q < 0 || (type !== 'ADJ' && q === 0)) return { ok: false, error: 'ใส่จำนวน' };
  return purLocked_(function () {
    var ss = mntBook_(dept), p = purRead_(ss, 'mnt_parts').filter(function (x) { return x.id === m.partId; })[0];
    if (!p) return { ok: false, error: 'ไม่พบอะไหล่' };
    var moves = purRead_(ss, 'mnt_moves'), bal = mntStock_(moves)[p.id] || 0, qty = q;
    if (type === 'ADJ') { qty = Math.round((q - bal) * 1000) / 1000; if (!qty) return { ok: false, error: 'ยอดที่นับได้เท่ากับยอดในระบบอยู่แล้ว' }; }
    if (type === 'OUT' && q > bal) return { ok: false, error: 'คงเหลือ ' + bal + ' ' + p.unit + ' — เบิกเกินยอดคงเหลือไม่ได้' };
    var pr = purNum_(m.price); if (pr === '' || pr < 0) pr = Number(p.price) || 0;
    purWrite_(ss, 'mnt_moves', { id: purId_('MV'), date: date, partId: p.id, partName: p.name, type: type, qty: qty, price: pr, amount: Math.round(Math.abs(qty) * pr * 100) / 100,
      ref: purClean_(m.ref, 80), note: mntText_(m.note, 500) + (type === 'ADJ' ? (m.note ? ' · ' : '') + 'นับได้ ' + q : ''), by: purClean_(m.by, 60), createdAt: purNow_() });
    // รับเข้าราคาใหม่ → ราคาต่อหน่วยของอะไหล่ = ราคาล่าสุด
    if (type === 'IN' && purNum_(m.price) !== '' && Number(m.price) !== Number(p.price)) { p.price = Number(m.price); p.updatedAt = purNow_(); purWrite_(ss, 'mnt_parts', p); }
    purLogWrite_(ss, { IN: 'รับอะไหล่เข้า', OUT: 'เบิกอะไหล่', ADJ: 'ปรับยอดอะไหล่' }[type], 'mnt_moves', p.id, p.name + ' ' + qty + ' ' + p.unit);
    var all = purRead_(ss, 'mnt_moves');
    return { ok: true, part: mntPartsOut_([purRead_(ss, 'mnt_parts').filter(function (x) { return x.id === p.id; })[0]], all)[0], moves: all.slice(-400) };
  });
}
function mntDeleteMove(token, id) {
  var dept = requireMnt_(token);
  return purLocked_(function () {
    var ss = mntBook_(dept), row = purRead_(ss, 'mnt_moves').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    if (row.repairId) return { ok: false, error: 'รายการนี้มาจากใบแจ้งซ่อม ' + (row.ref || '') + ' — แก้ที่ใบแจ้งซ่อมแทน' };
    purSheet_(ss, 'mnt_moves').deleteRow(row._row);
    purLogWrite_(ss, 'ลบรายการอะไหล่', 'mnt_moves', id, row.partName + ' ' + row.type + ' ' + row.qty);
    return { ok: true };
  });
}

// ---------- Dashboard (หน้าฝ่าย + ผู้บริหาร) ----------
function mntDashboard(token, from, to) {
  var dept = requireMnt_(token);
  return mntDashboard_(dept, from, to);
}
function mntDashboard_(dept, from, to) {
  var ss = mntReadBook_(dept), today = purToday_();
  from = purDate_(from) || today.slice(0, 4) + '-01-01'; to = purDate_(to) || today;
  var reps = purRead_(ss, 'mnt_repairs').map(mntRepairOut_), mcs = purRead_(ss, 'mnt_machines'), pm = purRead_(ss, 'mnt_pm').map(function (p) { return mntPmOut_(p, today); });
  var pmlog = purRead_(ss, 'mnt_pmlog'), parts = mntPartsOut_(purRead_(ss, 'mnt_parts'), purRead_(ss, 'mnt_moves'));
  var inR = function (d) { return d && d >= from && d <= to; };
  var open = reps.filter(function (r) { return r.open; }), rep = reps.filter(function (r) { return inR(r.reportDate) && r.status !== 'cancel'; });
  var done = reps.filter(function (r) { return r.doneAt && inR(String(r.doneAt).slice(0, 10)) && r.status !== 'cancel'; });
  var costOf = function (r) { return Number(r.totalCost) || 0; };
  var avg = function (a) { return a.length ? Math.round(a.reduce(function (t, x) { return t + x; }, 0) / a.length * 10) / 10 : ''; };
  var accMin = rep.map(function (r) { return r.acceptedAt ? mntMinutes_(r.reportAt, r.acceptedAt) : ''; }).filter(function (x) { return x !== ''; });
  var pmDue = pm.filter(function (p) { return p.active === 'on' && p.nextDate; });
  var plus = function (d, n) { var p = d.split('-'); return Utilities.formatDate(new Date(+p[0], +p[1] - 1, +p[2] + n), PUR_TZ_, 'yyyy-MM-dd'); };
  var d14 = plus(today, 14);
  var pmDone = pmlog.filter(function (l) { return inR(l.date); });
  var pmPlanned = 0;   // จำนวนครั้งที่ควรทำในช่วงนี้ (ประมาณจากรอบ) → % ทำตามแผน
  pm.filter(function (p) { return p.active === 'on'; }).forEach(function (p) {
    var d = p.startDate || p.nextDate, guard = 0; if (!d) return;
    while (d < from && guard++ < 500) d = mntAddCycle_(d, p.everyN, p.everyUnit);
    while (d <= to && d <= today && guard++ < 1000) { pmPlanned++; d = mntAddCycle_(d, p.everyN, p.everyUnit); }
  });
  // รายเดือนในช่วง (ไม่เกิน 24 เดือน)
  var months = [], ym = from.slice(0, 7), endYm = to.slice(0, 7), g = 0;
  while (ym <= endYm && g++ < 24) { months.push(ym); var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } ym = y + '-' + ('0' + m).slice(-2); }
  var byMonth = months.map(function (k) {
    return { ym: k, reported: rep.filter(function (r) { return String(r.reportDate).slice(0, 7) === k; }).length,
      done: done.filter(function (r) { return String(r.doneAt).slice(0, 7) === k; }).length,
      cost: Math.round(done.filter(function (r) { return String(r.doneAt).slice(0, 7) === k; }).reduce(function (t, r) { return t + costOf(r); }, 0) + pmDone.filter(function (l) { return String(l.date).slice(0, 7) === k; }).reduce(function (t, l) { return t + (Number(l.pmCost) || 0); }, 0)) };
  });
  var group = function (arr, keyFn) { var o = {}; arr.forEach(function (r) { var k = keyFn(r) || 'ไม่ระบุ'; o[k] = (o[k] || 0) + 1; }); return Object.keys(o).map(function (k) { return { name: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }); };
  var mstat = {};
  rep.concat(done.filter(function (r) { return rep.indexOf(r) < 0; })).forEach(function (r) {
    var k = r.machineId || ('n:' + (r.machineName || r.location || 'ไม่ระบุ'));
    var s = mstat[k] || (mstat[k] = { name: r.machineName || r.location || 'ไม่ระบุ', building: r.building || '', n: 0, down: 0, cost: 0 });
    if (inR(r.reportDate)) s.n++;
    if (r.doneAt && inR(String(r.doneAt).slice(0, 10))) { s.down += r.downtime || 0; s.cost += costOf(r); }
  });
  var techs = {};
  done.forEach(function (r) { var k = r.assignee || 'ไม่ระบุ', t = techs[k] || (techs[k] = { name: k, n: 0, h: [] }); t.n++; if (r.hoursToDone !== '') t.h.push(r.hoursToDone); });
  var urgRank = { urgent: 0, high: 1, normal: 2, low: 3 };
  var mini = function (r) {
    return { id: r.id, code: r.code, machineName: r.machineName, location: r.location, building: r.building, problem: String(r.problem).slice(0, 160), status: r.status, urgency: r.urgency,
      stopLine: r.stopLine, assignee: r.assignee, reportAt: r.reportAt, ageH: Math.round((mntMinutes_(r.reportAt, purNow_()) || 0) / 60), photo: (r.photos[0] || {}).url || '', category: r.category };
  };
  var partsCost = done.reduce(function (t, r) { return t + (Number(r.partsCost) || 0); }, 0), outCost = done.reduce(function (t, r) { return t + (Number(r.outsideCost) || 0); }, 0);
  var pmCost = pmDone.reduce(function (t, l) { return t + (Number(l.pmCost) || 0); }, 0);
  return { ok: true, kind: 'maintenance', today: today, from: from, to: to,
    kpi: { open: open.length, urgentOpen: open.filter(function (r) { return r.urgency === 'urgent' || r.stopLine; }).length, waiting: open.filter(function (r) { return r.status === 'new'; }).length,
      waitConfirm: reps.filter(function (r) { return r.status === 'done'; }).length,
      reported: rep.length, done: done.length, avgHours: avg(done.map(function (r) { return r.hoursToDone; }).filter(function (x) { return x !== ''; })), avgAcceptMin: avg(accMin),
      downtime: done.reduce(function (t, r) { return t + (r.downtime || 0); }, 0), cost: Math.round(partsCost + outCost + pmCost), partsCost: Math.round(partsCost), outCost: Math.round(outCost), pmCost: Math.round(pmCost),
      pmOverdue: pmDue.filter(function (p) { return p.nextDate < today; }).length, pmSoon: pmDue.filter(function (p) { return p.nextDate >= today && p.nextDate <= d14; }).length,
      pmDone: pmDone.length, pmPlanned: pmPlanned, pmIssue: pmDone.filter(function (l) { return l.result === 'issue'; }).length,
      machines: mcs.filter(function (m) { return m.status !== 'retired'; }).length, machinesDown: Object.keys(open.reduce(function (o, r) { if (r.machineId) o[r.machineId] = 1; return o; }, {})).length,
      partsLow: parts.filter(function (p) { return p.low; }).length },
    byMonth: byMonth, byCategory: group(rep, function (r) { return r.category; }), byBuilding: group(rep, function (r) { return r.building; }),
    byStatus: Object.keys(MNT_ST_).map(function (k) { return { key: k, name: MNT_ST_[k], n: reps.filter(function (r) { return r.status === k; }).length }; }).filter(function (x) { return x.n && MNT_OPEN_[x.key] || x.key === 'done' && x.n; }),
    topMachines: Object.keys(mstat).map(function (k) { return mstat[k]; }).filter(function (s) { return s.n || s.down || s.cost; }).sort(function (a, b) { return b.n - a.n || b.down - a.down || b.cost - a.cost; }).slice(0, 8),
    techs: Object.keys(techs).map(function (k) { var t = techs[k]; return { name: t.name, n: t.n, avgH: avg(t.h) }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8),
    openList: open.sort(function (a, b) { return (urgRank[a.urgency] - urgRank[b.urgency]) || (b.stopLine ? 1 : 0) - (a.stopLine ? 1 : 0) || String(a.reportAt).localeCompare(String(b.reportAt)); }).slice(0, 12).map(mini),
    confirmList: reps.filter(function (r) { return r.status === 'done'; }).slice(0, 8).map(mini),
    pmList: pmDue.filter(function (p) { return p.nextDate <= d14; }).sort(function (a, b) { return String(a.nextDate).localeCompare(String(b.nextDate)); }).slice(0, 12)
      .map(function (p) { return { id: p.id, title: p.title, machineName: p.machineName, nextDate: p.nextDate, overdue: p.overdue, assignee: p.assignee, every: p.everyN + ' ' + (MNT_UNITS_[p.everyUnit] || '') }; }),
    lowParts: parts.filter(function (p) { return p.low; }).slice(0, 10).map(function (p) { return { id: p.id, name: p.name, balance: p.balance, minStock: p.minStock, unit: p.unit }; }) };
}
