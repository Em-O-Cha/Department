// ==================== ฝ่ายบุคคล (HR) ====================
//
// ข้อมูลเก็บใน Google Sheet ของฝ่าย (ตั้งลิงก์ในหน้าผู้ดูแลระบบ) · ไฟล์เอกสารเก็บในโฟลเดอร์ Drive ของฝ่าย (ไม่เปิดสาธารณะ)
//   พนักงาน (ทะเบียนประวัติ + รูปย่อเก็บในเซลล์) · เอกสารพนักงาน (บัตร/พาสปอร์ต/วีซ่า/ใบอนุญาตทำงาน/ตรวจสุขภาพ + วันหมดอายุ)
//   การลา (ลาป่วย/กิจ/พักร้อน/... + ขาดงาน/มาสาย) · การอบรม (ผู้เข้าอบรมหลายคน) · วินัย / ใบเตือน · ตั้งค่า · ประวัติแก้ไข
// ใช้ตัวอ่าน/เขียนชีตของ Purchasing.gs (อ่านตามชื่อหัวคอลัมน์) — ตาราง HR ลงทะเบียนเพิ่มใน PUR_TABLES_ ตอนเปิดชีต
// ทุกฟังก์ชันต้องมีตั๋วของฝ่าย HR (requireHr_) · แก้ไขทุกครั้งบันทึกในแท็บประวัติแก้ไข

var HR_TABLES_ = {
  hr_emps: { tab: 'พนักงาน', cols: [
    ['id', 'รหัส'], ['code', 'รหัสพนักงาน'], ['seq', 'ลำดับ'], ['fullName', 'ชื่อ-นามสกุล'], ['nickname', 'ชื่อเล่น'], ['gender', 'เพศ'],
    ['nationality', 'สัญชาติ'], ['religion', 'ศาสนา'], ['birthDate', 'วันเกิด'], ['idNo', 'เลขบัตรประชาชน / พาสปอร์ต'], ['phone', 'เบอร์โทร'],
    ['addrReg', 'ที่อยู่ตามทะเบียนบ้าน'], ['addrNow', 'ที่อยู่ปัจจุบัน'], ['building', 'อาคาร'], ['position', 'ตำแหน่ง'], ['group', 'แผนก'],
    ['empType', 'ประเภทการจ้าง'], ['startDate', 'วันเริ่มงาน'], ['status', 'สถานะ'], ['endDate', 'วันที่ออก'], ['endReason', 'เหตุผลที่ออก'],
    ['emergencyName', 'ผู้ติดต่อฉุกเฉิน'], ['emergencyPhone', 'เบอร์ผู้ติดต่อฉุกเฉิน'], ['education', 'วุฒิการศึกษา'], ['note', 'หมายเหตุ'],
    ['photoThumb', 'รูปย่อ'], ['photo', 'รูปถ่าย (ไฟล์)'], ['files', 'เอกสารแนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  hr_docs: { tab: 'เอกสารพนักงาน', cols: [
    ['id', 'รหัส'], ['empId', 'รหัสพนักงานในระบบ'], ['type', 'ประเภทเอกสาร'], ['number', 'เลขที่'], ['issueDate', 'วันที่ออก'],
    ['expiryDate', 'วันหมดอายุ'], ['note', 'หมายเหตุ'], ['files', 'ไฟล์แนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  hr_leaves: { tab: 'การลา', cols: [
    ['id', 'รหัส'], ['empId', 'รหัสพนักงานในระบบ'], ['type', 'ประเภท'], ['dateFrom', 'ตั้งแต่วันที่'], ['dateTo', 'ถึงวันที่'],
    ['days', 'จำนวนวัน'], ['minutes', 'นาที (มาสาย)'], ['reason', 'เหตุผล'], ['status', 'สถานะ'], ['approver', 'ผู้อนุมัติ'],
    ['files', 'ไฟล์แนบ'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด'], ['source', 'ช่องทาง'], ['decidedAt', 'วันที่อนุมัติ']] },
  hr_trainings: { tab: 'การอบรม', cols: [
    ['id', 'รหัส'], ['title', 'หลักสูตร'], ['date', 'วันที่อบรม'], ['hours', 'จำนวนชั่วโมง'], ['kind', 'ประเภท'], ['trainer', 'วิทยากร'],
    ['place', 'สถานที่'], ['attendees', 'ผู้เข้าอบรม'], ['note', 'หมายเหตุ'], ['files', 'ไฟล์แนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  hr_disc: { tab: 'วินัย', cols: [
    ['id', 'รหัส'], ['empId', 'รหัสพนักงานในระบบ'], ['date', 'วันที่'], ['level', 'ระดับ'], ['reason', 'ความผิด / เหตุผล'],
    ['action', 'การดำเนินการ'], ['files', 'ไฟล์แนบ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  hr_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] }
};
var HR_LEAVE_TYPES_ = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', maternity: 'ลาคลอด', ordain: 'ลาบวช', military: 'ลารับราชการทหาร',
  training: 'ลาเพื่อฝึกอบรม', other: 'ลาอื่นๆ', absent: 'ขาดงาน', late: 'มาสาย' };
var HR_DOC_TYPES_ = { idcard: 'บัตรประชาชน', passport: 'พาสปอร์ต', visa: 'วีซ่า', workpermit: 'ใบอนุญาตทำงาน (Work Permit)', pink: 'บัตรชมพู / บัตรประจำตัวคนต่างด้าว',
  health: 'ตรวจสุขภาพประจำปี / ใบรับรองแพทย์', food: 'อบรมสุขาภิบาลอาหาร', driving: 'ใบขับขี่', contract: 'สัญญาจ้าง', other: 'อื่นๆ' };
var HR_DISC_LEVELS_ = { verbal: 'ตักเตือนด้วยวาจา', written1: 'ใบเตือนครั้งที่ 1', written2: 'ใบเตือนครั้งที่ 2', suspend: 'พักงาน', terminate: 'เลิกจ้าง' };
var HR_SETTINGS_DEFAULT_ = {
  quotas: JSON.stringify({ sick: 30, personal: 3, vacation: 6, maternity: 98, ordain: 15 }),
  buildings: 'G1, G2, G3, ออฟฟิศ', groups: 'ผลิต, ออฟฟิศ', alertDays: '60', workDays: 'จ-ส',
  fmRegister: '', fmProfile: '', fmLeave: ''
};
var HR_STATUS_ = { 'ทำงาน': 1, 'ทดลองงาน': 1, 'พักงาน': 1, 'ลาออก': 1 };

// ---------- พื้นฐาน ----------
function requireHr_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'hr') throw new Error('แผนกนี้ไม่มีระบบบุคคล');
  return dept;
}
function hrRegister_() {
  Object.keys(HR_TABLES_).forEach(function (k) { PUR_TABLES_[k] = HR_TABLES_[k]; });
  ['birthDate', 'startDate', 'endDate', 'issueDate', 'expiryDate', 'dateFrom', 'dateTo'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['seq', 'days', 'minutes', 'hours'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function hrBook_(dept) {
  hrRegister_();
  var ss = purBook_(dept);
  var have = purRead_(ss, 'hr_settings').map(function (x) { return x.id; });
  var miss = Object.keys(HR_SETTINGS_DEFAULT_).filter(function (k) { return have.indexOf(k) < 0; });
  if (miss.length) purLocked_(function () {
    var again = purRead_(ss, 'hr_settings').map(function (x) { return x.id; });
    miss.forEach(function (k) { if (again.indexOf(k) < 0) purWrite_(ss, 'hr_settings', { id: k, value: HR_SETTINGS_DEFAULT_[k] }); });
  });
  ['hr_emps', 'hr_docs', 'hr_leaves', 'hr_trainings', 'hr_disc'].forEach(function (t) { purSheet_(ss, t); });
  return ss;
}
function hrSettings_(ss) {
  var s = {};
  Object.keys(HR_SETTINGS_DEFAULT_).forEach(function (k) { s[k] = HR_SETTINGS_DEFAULT_[k]; });
  purRead_(ss, 'hr_settings').forEach(function (x) { if (x.id) s[x.id] = String(x.value == null ? '' : x.value); });
  var q = {}; try { q = JSON.parse(s.quotas || '{}') || {}; } catch (e) {}
  s.quotaMap = q;
  return s;
}
function hrText_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 500); }
function hrNum_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : ''; }
function hrDays_(a, b) { return Math.round((purToDate_(b) - purToDate_(a)) / 864e5); }
function hrAddDays_(iso, n) { var d = purToDate_(iso); d.setDate(d.getDate() + n); return Utilities.formatDate(d, PUR_TZ_, 'yyyy-MM-dd'); }
function hrById_(rows, id) { return rows.filter(function (x) { return x.id === id; })[0] || null; }
function hrEmpOut_(e) { delete e.photoThumb; e.photo = sheJsonOr_(e.photo); e.files = purParseFiles_(e.files); return e; }
function sheJsonOr_(v) { try { var o = typeof v === 'string' ? JSON.parse(v || 'null') : v; return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function hrFilesOut_(x) { x.files = purParseFiles_(x.files); return x; }
function hrActive_(e) { return e.status !== 'ลาออก'; }
// วันลา (นับวันทำงาน): ไม่นับวันอาทิตย์ (ตั้งค่า workDays = 'จ-ศ' ไม่นับเสาร์ด้วย)
function hrWorkDays_(from, to, workDays) {
  var n = 0, d = purToDate_(from), end = purToDate_(to);
  while (d <= end) { var w = d.getDay(); if (w !== 0 && !(workDays === 'จ-ศ' && w === 6)) n++; d.setDate(d.getDate() + 1); }
  return n;
}

// ---------- โหลดข้อมูลทั้งหมดของหน้า (การลาตั้งแต่ต้นปีที่แล้ว) ----------
function hrLoad(token) {
  var dept = requireHr_(token), ss = hrBook_(dept), today = purToday_(), since = (+today.slice(0, 4) - 1) + '-01-01';
  return {
    ok: true, today: today, sheetUrl: ss.getUrl(), hasFolder: !!deptConfig_(dept.key).folderId, settings: hrSettings_(ss),
    emps: purRead_(ss, 'hr_emps').map(hrEmpOut_).sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); }),
    docs: purRead_(ss, 'hr_docs').map(hrFilesOut_),
    leaves: purRead_(ss, 'hr_leaves').filter(function (l) { return String(l.dateTo || l.dateFrom) >= since; }).map(hrFilesOut_),
    trainings: purRead_(ss, 'hr_trainings').map(function (t) { t.attendees = sheJson_(t.attendees, []); return hrFilesOut_(t); }),
    disc: purRead_(ss, 'hr_disc').map(hrFilesOut_)
  };
}
// รูปย่อพนักงานทั้งหมด { empId: dataUrl } — แยกจาก hrLoad เพราะขนาดใหญ่ (โหลดครั้งเดียว)
function hrPhotos(token) {
  var dept = requireHr_(token), ss = hrBook_(dept), out = {};
  purRead_(ss, 'hr_emps').forEach(function (e) { if (/^data:image\//.test(String(e.photoThumb))) out[e.id] = e.photoThumb; });
  return { ok: true, photos: out };
}

// ---------- พนักงาน ----------
var HR_EMP_FIELDS_ = { code: 30, fullName: 120, nickname: 60, gender: 10, nationality: 40, religion: 40, idNo: 40, phone: 40, addrReg: 400, addrNow: 400,
  building: 40, position: 80, group: 60, empType: 30, endReason: 300, emergencyName: 120, emergencyPhone: 40, education: 120, note: 500 };
function hrSaveEmp(token, e) {
  var dept = requireHr_(token);
  e = e || {};
  if (!hrText_(e.fullName)) return { ok: false, error: 'ระบุชื่อ-นามสกุล' };
  return purLocked_(function () {
    var ss = hrBook_(dept), all = purRead_(ss, 'hr_emps'), now = purNow_();
    var row = e.id ? hrById_(all, e.id) : null;
    if (e.id && !row) return { ok: false, error: 'ไม่พบพนักงาน' };
    var code = hrText_(e.code, 30);
    if (code && all.some(function (x) { return x.code === code && (!row || x.id !== row.id); })) return { ok: false, error: 'รหัสพนักงาน ' + code + ' ซ้ำกับคนอื่น' };
    var rec = row || { id: purId_('EM'), createdAt: now, seq: all.reduce(function (m, x) { return Math.max(m, Number(x.seq) || 0); }, 0) + 1, files: '[]', photo: '' };
    var before = row ? JSON.stringify([row.fullName, row.position, row.group, row.status, row.endDate]) : '';
    Object.keys(HR_EMP_FIELDS_).forEach(function (k) { if (e[k] !== undefined) rec[k] = hrText_(e[k], HR_EMP_FIELDS_[k]); });
    ['birthDate', 'startDate', 'endDate'].forEach(function (k) { if (e[k] !== undefined) rec[k] = purDate_(e[k]); });
    rec.status = HR_STATUS_[e.status] ? e.status : (rec.status || 'ทำงาน');
    if (rec.status === 'ลาออก' && !rec.endDate) rec.endDate = purToday_();
    if (rec.status !== 'ลาออก') { rec.endDate = ''; }
    if (e.seq !== undefined && e.seq !== '') rec.seq = Math.round(Number(e.seq) || rec.seq);
    if (typeof e.photoThumb === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(e.photoThumb) && e.photoThumb.length < 48000) rec.photoThumb = e.photoThumb;
    rec.updatedAt = now;
    purWrite_(ss, 'hr_emps', rec);
    purLogWrite_(ss, row ? 'แก้ข้อมูลพนักงาน' : 'เพิ่มพนักงาน', 'hr_emps', rec.id, rec.fullName + (before ? ' (เดิม ' + before + ')' : ''));
    return { ok: true, emp: hrEmpOut_(hrById_(purRead_(ss, 'hr_emps'), rec.id)) };
  });
}
function hrDeleteEmp(token, id) {
  var dept = requireHr_(token);
  return purLocked_(function () {
    var ss = hrBook_(dept), row = hrById_(purRead_(ss, 'hr_emps'), id);
    if (!row) return { ok: false, error: 'ไม่พบพนักงาน' };
    var used = ['hr_docs', 'hr_leaves', 'hr_disc'].some(function (t) { return purRead_(ss, t).some(function (x) { return x.empId === id; }); })
      || purRead_(ss, 'hr_trainings').some(function (t) { return sheJson_(t.attendees, []).indexOf(id) >= 0; });
    if (used) return { ok: false, error: 'พนักงานคนนี้มีประวัติการลา/เอกสาร/อบรม/วินัยอยู่ — เปลี่ยนสถานะเป็น "ลาออก" แทนการลบ' };
    var ph = sheJsonOr_(row.photo);
    purParseFiles_(row.files).concat(ph ? [ph] : []).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    purSheet_(ss, 'hr_emps').deleteRow(row._row);
    purLogWrite_(ss, 'ลบพนักงาน', 'hr_emps', id, row.fullName);
    return { ok: true };
  });
}

// ---------- เอกสาร / การลา / อบรม / วินัย (บันทึกแบบเดียวกัน) ----------
function hrSaveRow_(token, table, x, build, label) {
  var dept = requireHr_(token);
  return purLocked_(function () {
    var ss = hrBook_(dept), now = purNow_(), emps = purRead_(ss, 'hr_emps');
    var row = x.id ? hrById_(purRead_(ss, table), x.id) : null;
    if (x.id && !row) return { ok: false, error: 'ไม่พบรายการ' };
    var rec = row || { id: purId_({ hr_docs: 'DC', hr_leaves: 'LV', hr_trainings: 'TR', hr_disc: 'DS' }[table]), createdAt: now, files: '[]' };
    var err = build(rec, x, emps, hrSettings_(ss));
    if (err) return { ok: false, error: err };
    rec.updatedAt = now;
    purWrite_(ss, table, rec);
    var emp = rec.empId ? hrById_(emps, rec.empId) : null;
    purLogWrite_(ss, (row ? 'แก้' : 'บันทึก') + label, table, rec.id, (emp ? emp.fullName + ' · ' : '') + JSON.stringify(x).slice(0, 300));
    var out = hrById_(purRead_(ss, table), rec.id);
    if (table === 'hr_trainings') out.attendees = sheJson_(out.attendees, []);
    return { ok: true, row: hrFilesOut_(out) };
  });
}
function hrNeedEmp_(rec, x, emps) {
  if (!hrById_(emps, x.empId)) return 'เลือกพนักงาน';
  rec.empId = x.empId; return '';
}
function hrSaveDoc(token, x) {
  x = x || {};
  return hrSaveRow_(token, 'hr_docs', x, function (rec, x, emps) {
    var e = hrNeedEmp_(rec, x, emps); if (e) return e;
    if (!HR_DOC_TYPES_[x.type]) return 'เลือกประเภทเอกสาร';
    rec.type = x.type; rec.number = hrText_(x.number, 60); rec.issueDate = purDate_(x.issueDate); rec.expiryDate = purDate_(x.expiryDate); rec.note = hrText_(x.note, 300);
    if (rec.issueDate && rec.expiryDate && rec.issueDate > rec.expiryDate) return 'วันหมดอายุต้องหลังวันที่ออก';
  }, 'เอกสาร');
}
function hrSaveLeave(token, x) {
  x = x || {};
  return hrSaveRow_(token, 'hr_leaves', x, function (rec, x, emps, st) {
    var e = hrNeedEmp_(rec, x, emps); if (e) return e;
    if (!HR_LEAVE_TYPES_[x.type]) return 'เลือกประเภทการลา';
    var f = purDate_(x.dateFrom), t = purDate_(x.dateTo) || f;
    if (!f) return 'ระบุวันที่';
    if (t < f) return 'วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม';
    rec.type = x.type; rec.dateFrom = f; rec.dateTo = t;
    var d = hrNum_(x.days);
    rec.days = x.type === 'late' ? 0 : (d === '' ? hrWorkDays_(f, t, st.workDays) : Math.max(0, Math.round(d * 2) / 2));
    rec.minutes = x.type === 'late' ? Math.max(0, Math.round(Number(x.minutes) || 0)) : '';
    rec.reason = hrText_(x.reason, 300); rec.status = ['อนุมัติ', 'รออนุมัติ', 'ไม่อนุมัติ'].indexOf(x.status) >= 0 ? x.status : 'อนุมัติ';
    rec.approver = hrText_(x.approver, 80);
  }, 'การลา');
}
function hrSaveTraining(token, x) {
  x = x || {};
  return hrSaveRow_(token, 'hr_trainings', x, function (rec, x, emps) {
    if (!hrText_(x.title)) return 'ระบุหลักสูตร';
    if (!purDate_(x.date)) return 'ระบุวันที่อบรม';
    var ids = (Array.isArray(x.attendees) ? x.attendees : []).filter(function (id) { return hrById_(emps, id); });
    rec.title = hrText_(x.title, 150); rec.date = purDate_(x.date); rec.hours = Math.max(0, hrNum_(x.hours) || 0); rec.kind = hrText_(x.kind, 40);
    rec.trainer = hrText_(x.trainer, 120); rec.place = hrText_(x.place, 120); rec.attendees = JSON.stringify(ids); rec.note = hrText_(x.note, 300);
  }, 'การอบรม');
}
function hrSaveDisc(token, x) {
  x = x || {};
  return hrSaveRow_(token, 'hr_disc', x, function (rec, x, emps) {
    var e = hrNeedEmp_(rec, x, emps); if (e) return e;
    if (!purDate_(x.date)) return 'ระบุวันที่';
    if (!HR_DISC_LEVELS_[x.level]) return 'เลือกระดับ';
    rec.date = purDate_(x.date); rec.level = x.level; rec.reason = hrText_(x.reason, 500); rec.action = hrText_(x.action, 300);
  }, 'วินัย');
}
// อนุมัติ / ไม่อนุมัติ คำขอลา (จากหน้า HR หรือปุ่มใน LINE)
function hrDecideLeave(token, id, approve) {
  var dept = requireHr_(token);
  var r = hrDecideLeave_(dept, id, approve, 'ฝ่ายบุคคล');
  if (r.ok && r.leave.source === 'แบบฟอร์มพนักงาน') { try { hrLinePush_([hrLeaveFlex_(r.leave, r.emp || {}, null, true)]); } catch (e) {} }   // แจ้งกลุ่มว่าจัดการแล้ว
  return r;
}
function hrDecideLeave_(dept, id, approve, who) {
  return purLocked_(function () {
    var ss = hrBook_(dept), row = hrById_(purRead_(ss, 'hr_leaves'), id);
    if (!row) return { ok: false, error: 'ไม่พบคำขอลา' };
    if (row.status !== 'รออนุมัติ') return { ok: false, already: true, status: row.status, approver: row.approver, error: 'คำขอนี้' + row.status + 'ไปแล้ว' + (row.approver ? ' โดย ' + row.approver : '') };
    row.status = approve ? 'อนุมัติ' : 'ไม่อนุมัติ'; row.approver = hrText_(who, 80); row.decidedAt = purNow_(); row.updatedAt = purNow_();
    purWrite_(ss, 'hr_leaves', row);
    var emp = hrById_(purRead_(ss, 'hr_emps'), row.empId);
    purLogWrite_(ss, row.status + 'คำขอลา', 'hr_leaves', id, (emp ? emp.fullName : '') + ' · ' + (HR_LEAVE_TYPES_[row.type] || row.type) + ' ' + row.dateFrom + ' · โดย ' + row.approver);
    return { ok: true, status: row.status, leave: hrFilesOut_(row), emp: emp ? { fullName: emp.fullName, nickname: emp.nickname } : null };
  });
}

var HR_DEL_TABLES_ = { doc: 'hr_docs', leave: 'hr_leaves', training: 'hr_trainings', disc: 'hr_disc' };
function hrDeleteRow(token, kind, id) {
  var dept = requireHr_(token), table = HR_DEL_TABLES_[kind];
  if (!table) return { ok: false, error: 'ไม่รู้จักรายการ' };
  return purLocked_(function () {
    var ss = hrBook_(dept), row = hrById_(purRead_(ss, table), id);
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    purParseFiles_(row.files).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    purSheet_(ss, table).deleteRow(row._row);
    purLogWrite_(ss, 'ลบ', table, id, JSON.stringify(row).slice(0, 400));
    return { ok: true };
  });
}

// ---------- ไฟล์ (โฟลเดอร์ของฝ่าย · ไม่เปิดสาธารณะ) ----------
// ownerType: emp (เอกสารแนบ) · photo (รูปถ่ายพนักงาน: แทนรูปเดิม + รูปย่อ thumb) · doc · leave · training · disc
var HR_FILE_OWNERS_ = { emp: 'hr_emps', photo: 'hr_emps', doc: 'hr_docs', leave: 'hr_leaves', training: 'hr_trainings', disc: 'hr_disc' };
function hrUploadFile(token, ownerType, ownerId, fileName, mimeType, base64, thumb) {
  var dept = requireHr_(token), table = HR_FILE_OWNERS_[ownerType];
  if (!table) return { ok: false, error: 'ไม่รู้ว่าจะแนบกับรายการไหน' };
  if (!/^image\/(jpeg|png|webp|heic)$|^application\/pdf$/.test(mimeType) || (ownerType === 'photo' && !/^image\//.test(mimeType))) return { ok: false, error: 'แนบได้เฉพาะรูปภาพหรือ PDF' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 15 * 1024 * 1024) return { ok: false, error: 'ไฟล์ว่างหรือใหญ่เกิน 15 MB' };
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์เก็บไฟล์ของฝ่าย' };
  return purLocked_(function () {
    var ss = hrBook_(dept), row = hrById_(purRead_(ss, table), ownerId);
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var emp = table === 'hr_emps' ? row : (row.empId ? hrById_(purRead_(ss, 'hr_emps'), row.empId) : null);
    var safe = purClean_(fileName, 100).replace(/[\\/:*?"<>|]/g, '_') || 'file';
    var prefix = (emp ? (emp.code || emp.fullName) : (row.title || row.id)) + '_' + (ownerType === 'photo' ? 'รูปถ่าย' : ownerType);
    var f = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mimeType, prefix + '_' + safe));
    var rec = { id: f.getId(), name: safe, mime: mimeType, url: 'https://drive.google.com/file/d/' + f.getId() + '/view', at: purNow_() };
    if (ownerType === 'photo') {
      var old = sheJsonOr_(row.photo);
      if (old) try { DriveApp.getFileById(old.id).setTrashed(true); } catch (e) {}
      row.photo = JSON.stringify(rec);
      if (typeof thumb === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(thumb) && thumb.length < 48000) row.photoThumb = thumb;
    } else {
      var files = purParseFiles_(row.files); files.push(rec); row.files = JSON.stringify(files);
    }
    row.updatedAt = purNow_();
    purWrite_(ss, table, row);
    purLogWrite_(ss, ownerType === 'photo' ? 'เปลี่ยนรูปพนักงาน' : 'แนบไฟล์', table, ownerId, safe);
    return { ok: true, file: rec, files: purParseFiles_(row.files) };
  });
}
function hrRemoveFile(token, ownerType, ownerId, fileId) {
  var dept = requireHr_(token), table = HR_FILE_OWNERS_[ownerType];
  if (!table || ownerType === 'photo') return { ok: false, error: 'ไม่รู้ว่าจะลบจากรายการไหน' };
  return purLocked_(function () {
    var ss = hrBook_(dept), row = hrById_(purRead_(ss, table), ownerId);
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var files = purParseFiles_(row.files);
    if (!files.some(function (x) { return x.id === fileId; })) return { ok: false, error: 'ไม่พบไฟล์' };
    files = files.filter(function (x) { return x.id !== fileId; });
    row.files = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, table, row);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    purLogWrite_(ss, 'ลบไฟล์', table, ownerId, fileId);
    return { ok: true, files: files };
  });
}

// ---------- ตั้งค่า / รายงาน ----------
function hrSaveSettings(token, s) {
  var dept = requireHr_(token);
  s = s || {};
  if (s.quotas !== undefined) { try { var q = JSON.parse(s.quotas); Object.keys(q).forEach(function (k) { if (!HR_LEAVE_TYPES_[k]) delete q[k]; else q[k] = Math.max(0, Number(q[k]) || 0); }); s.quotas = JSON.stringify(q); } catch (e) { return { ok: false, error: 'โควตาวันลาไม่ถูกต้อง' }; } }
  return purLocked_(function () {
    var ss = hrBook_(dept), rows = purRead_(ss, 'hr_settings'), changed = [];
    Object.keys(HR_SETTINGS_DEFAULT_).forEach(function (k) {
      if (s[k] === undefined) return;
      var val = hrText_(s[k], 1000), r = rows.filter(function (x) { return x.id === k; })[0];
      if (r && String(r.value) === val) return;
      purWrite_(ss, 'hr_settings', r ? Object.assign(r, { value: val }) : { id: k, value: val });
      changed.push(k + '=' + val);
    });
    if (changed.length) purLogWrite_(ss, 'แก้ตั้งค่า', 'hr_settings', '', changed.join(' · '));
    return { ok: true, settings: hrSettings_(ss) };
  });
}
// การลาในช่วงวันที่ใดก็ได้ (หน้าเว็บโหลดไว้แค่ตั้งแต่ปีที่แล้ว)
function hrLeaves(token, from, to) {
  var dept = requireHr_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var ss = hrBook_(dept);
  return { ok: true, leaves: purRead_(ss, 'hr_leaves').filter(function (l) { return l.dateFrom <= to && (l.dateTo || l.dateFrom) >= from; }).map(hrFilesOut_) };
}
function hrLog(token, limit) {
  var dept = requireHr_(token), ss = hrBook_(dept);
  return { ok: true, rows: purRead_(ss, 'log').reverse().slice(0, Math.min(500, Number(limit) || 200)) };
}

// ---------- Dashboard (หน้าภาพรวมของฝ่าย + Dashboard ผู้บริหาร) ----------
function hrDashboard(token, from, to) {
  var dept = requireHr_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var d = hrDashboard_(dept, from, to); d.ok = true; return d;
}
function hrDashboard_(dept, from, to) {
  var ss = hrBook_(dept), today = purToday_(), st = hrSettings_(ss);
  var emps = purRead_(ss, 'hr_emps'), active = emps.filter(hrActive_), idx = {};
  emps.forEach(function (e) { idx[e.id] = e; });
  var cnt = function (arr, fn) { var o = {}; arr.forEach(function (x) { var k = fn(x) || 'ไม่ระบุ'; o[k] = (o[k] || 0) + 1; }); return Object.keys(o).map(function (k) { return { name: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }); };
  // คนเข้า-ออก · อัตราการลาออก (เทียบจำนวนพนักงานเฉลี่ยต้น-ปลายช่วง)
  var hires = emps.filter(function (e) { return e.startDate && e.startDate >= from && e.startDate <= to; });
  var exits = emps.filter(function (e) { return e.status === 'ลาออก' && e.endDate && e.endDate >= from && e.endDate <= to; });
  var headAt = function (d) { return emps.filter(function (e) { return (!e.startDate || e.startDate <= d) && !(e.status === 'ลาออก' && e.endDate && e.endDate < d); }).length; };
  var avgHead = (headAt(from) + headAt(to)) / 2;
  // อายุงาน / อายุตัว
  var years = function (a) { return a ? hrDays_(a, today) / 365.25 : null; };
  var ten = active.map(function (e) { return years(e.startDate); }).filter(function (x) { return x != null && x >= 0; });
  var ages = active.map(function (e) { return years(e.birthDate); }).filter(function (x) { return x != null && x > 10; });
  var band = function (arr, cuts, labels) { var o = labels.map(function (l) { return { name: l, n: 0 }; }); arr.forEach(function (v) { for (var i = 0; i < cuts.length; i++) if (v < cuts[i]) { o[i].n++; return; } o[o.length - 1].n++; }); return o; };
  // การลา
  var leaves = purRead_(ss, 'hr_leaves').filter(function (l) { return l.status !== 'ไม่อนุมัติ' && l.dateFrom <= to && (l.dateTo || l.dateFrom) >= from; });
  var byType = {}, perEmp = {};
  leaves.forEach(function (l) {
    var k = HR_LEAVE_TYPES_[l.type] || l.type;
    byType[k] = byType[k] || { name: k, days: 0, times: 0, minutes: 0 };
    byType[k].days += Number(l.days) || 0; byType[k].times++; byType[k].minutes += Number(l.minutes) || 0;
    if (l.type === 'sick' || l.type === 'personal' || l.type === 'absent' || l.type === 'late') {
      perEmp[l.empId] = perEmp[l.empId] || { id: l.empId, name: (idx[l.empId] || {}).fullName || '-', sick: 0, personal: 0, absent: 0, late: 0 };
      perEmp[l.empId][l.type] += l.type === 'late' ? 1 : Number(l.days) || 0;
    }
  });
  var workDaysInRange = hrWorkDays_(from, to < today ? to : today, st.workDays);
  var absentDays = leaves.filter(function (l) { return l.type === 'absent' || l.type === 'sick' || l.type === 'personal'; }).reduce(function (s, l) { return s + (Number(l.days) || 0); }, 0);
  var absenteeism = active.length && workDaysInRange > 0 ? Math.round(absentDays / (active.length * workDaysInRange) * 1000) / 10 : null;
  // เอกสารหมดอายุ (พนักงานที่ยังทำงาน)
  var alertDays = Math.max(7, Number(st.alertDays) || 60), lim = hrAddDays_(today, alertDays);
  var docs = purRead_(ss, 'hr_docs').filter(function (d) { return d.expiryDate && idx[d.empId] && hrActive_(idx[d.empId]); });
  var latest = {};   // เอกสารประเภทเดียวกันของคนเดียวกัน ใช้ใบที่หมดอายุช้าสุด
  docs.forEach(function (d) { var k = d.empId + '|' + d.type; if (!latest[k] || d.expiryDate > latest[k].expiryDate) latest[k] = d; });
  var exp = Object.keys(latest).map(function (k) { return latest[k]; }).filter(function (d) { return d.expiryDate <= lim; })
    .sort(function (a, b) { return String(a.expiryDate).localeCompare(String(b.expiryDate)); })
    .map(function (d) { return { empId: d.empId, name: idx[d.empId].fullName, type: HR_DOC_TYPES_[d.type] || d.type, number: d.number, expiryDate: d.expiryDate, left: hrDays_(today, d.expiryDate) }; });
  var foreign = active.filter(function (e) { return e.nationality && e.nationality !== 'ไทย'; });
  var hasWP = {}; docs.forEach(function (d) { if (d.type === 'workpermit' || d.type === 'pink') hasWP[d.empId] = 1; });
  var noWP = foreign.filter(function (e) { return !hasWP[e.id]; });
  // อบรม / วินัย
  var trains = purRead_(ss, 'hr_trainings').filter(function (t) { return t.date >= from && t.date <= to; });
  var trainHours = 0, trained = {};
  trains.forEach(function (t) { var a = sheJson_(t.attendees, []); trainHours += (Number(t.hours) || 0) * a.length; a.forEach(function (id) { trained[id] = 1; }); });
  var disc = purRead_(ss, 'hr_disc').filter(function (x) { return x.date >= from && x.date <= to; });
  // วันเกิดเดือนนี้
  var mm = today.slice(5, 7);
  var bdays = active.filter(function (e) { return e.birthDate && e.birthDate.slice(5, 7) === mm; }).sort(function (a, b) { return a.birthDate.slice(8).localeCompare(b.birthDate.slice(8)); })
    .map(function (e) { return { name: e.fullName, nickname: e.nickname, day: +e.birthDate.slice(8, 10) }; });
  // แนวโน้ม 6 เดือน
  var months = [], m0 = purToDate_(to.slice(0, 7) + '-01');
  for (var i = 5; i >= 0; i--) { var dd = new Date(m0.getFullYear(), m0.getMonth() - i, 1); months.push(Utilities.formatDate(dd, PUR_TZ_, 'yyyy-MM')); }
  var allLeaves = purRead_(ss, 'hr_leaves').filter(function (l) { return l.status !== 'ไม่อนุมัติ'; });
  var trend = months.map(function (ym) {
    var end = ym + '-31';
    return { ym: ym, head: headAt(end > today ? today : end), hires: emps.filter(function (e) { return String(e.startDate).slice(0, 7) === ym; }).length,
      exits: emps.filter(function (e) { return e.status === 'ลาออก' && String(e.endDate).slice(0, 7) === ym; }).length,
      leaveDays: allLeaves.filter(function (l) { return String(l.dateFrom).slice(0, 7) === ym && l.type !== 'late'; }).reduce(function (s, l) { return s + (Number(l.days) || 0); }, 0) };
  });
  // ข้อสังเกต
  var insights = [];
  insights.push({ level: 'ok', text: 'พนักงานปัจจุบัน ' + active.length + ' คน' + (foreign.length ? ' (ต่างด้าว ' + foreign.length + ' คน)' : '') });
  if (hires.length || exits.length) insights.push({ level: exits.length > hires.length ? 'warn' : 'ok', text: 'เข้าใหม่ ' + hires.length + ' คน · ลาออก ' + exits.length + ' คน' + (avgHead ? ' · อัตราลาออก ' + Math.round(exits.length / avgHead * 1000) / 10 + '%' : '') });
  var expired = exp.filter(function (x) { return x.left < 0; });
  if (expired.length) insights.push({ level: 'bad', text: 'เอกสารหมดอายุแล้ว ' + expired.length + ' รายการ (เช่น ' + expired[0].name + ' · ' + expired[0].type + ')' });
  if (exp.length - expired.length) insights.push({ level: 'warn', text: 'เอกสารจะหมดอายุใน ' + alertDays + ' วัน ' + (exp.length - expired.length) + ' รายการ' });
  if (noWP.length) insights.push({ level: 'warn', text: 'พนักงานต่างด้าวที่ยังไม่บันทึกใบอนุญาตทำงาน ' + noWP.length + ' คน' });
  if (absenteeism != null) insights.push({ level: absenteeism > 3 ? 'bad' : absenteeism > 1.5 ? 'warn' : 'ok', text: 'อัตราการขาด/ลา (ป่วย กิจ ขาดงาน) ' + absenteeism + '% ของวันทำงาน' });
  var topLeave = Object.keys(perEmp).map(function (k) { return perEmp[k]; }).sort(function (a, b) { return (b.sick + b.personal + b.absent * 2) - (a.sick + a.personal + a.absent * 2); });
  if (topLeave[0] && topLeave[0].sick + topLeave[0].personal + topLeave[0].absent >= 3) insights.push({ level: 'warn', text: 'ลา/ขาดมากสุด: ' + topLeave[0].name + ' (ป่วย ' + topLeave[0].sick + ' · กิจ ' + topLeave[0].personal + ' · ขาด ' + topLeave[0].absent + ' วัน)' });
  if (disc.length) insights.push({ level: 'warn', text: 'มีการลงโทษทางวินัย ' + disc.length + ' ครั้ง' });
  if (trains.length) insights.push({ level: 'ok', text: 'อบรม ' + trains.length + ' หลักสูตร · ' + Object.keys(trained).length + ' คน · รวม ' + trainHours + ' ชั่วโมง-คน' });
  else insights.push({ level: 'warn', text: 'ยังไม่มีการอบรมในช่วงนี้' });
  return {
    from: from, to: to, today: today, kind: 'hr',
    head: { active: active.length, total: emps.length, foreign: foreign.length, hires: hires.length, exits: exits.length,
      turnover: avgHead ? Math.round(exits.length / avgHead * 1000) / 10 : null,
      byGroup: cnt(active, function (e) { return e.group; }), byBuilding: cnt(active, function (e) { return e.building; }),
      byNationality: cnt(active, function (e) { return e.nationality; }), byGender: cnt(active, function (e) { return e.gender; }),
      byPosition: cnt(active, function (e) { return e.position; }).slice(0, 10),
      avgTenure: ten.length ? Math.round(ten.reduce(function (s, x) { return s + x; }, 0) / ten.length * 10) / 10 : null,
      tenure: band(ten, [1, 3, 5, 10], ['ต่ำกว่า 1 ปี', '1–3 ปี', '3–5 ปี', '5–10 ปี', '10 ปีขึ้นไป']), tenureKnown: ten.length,
      ages: band(ages, [25, 35, 45, 55], ['ต่ำกว่า 25', '25–34', '35–44', '45–54', '55 ขึ้นไป']), agesKnown: ages.length,
      hireList: hires.map(function (e) { return { name: e.fullName, position: e.position, date: e.startDate }; }),
      exitList: exits.map(function (e) { return { name: e.fullName, position: e.position, date: e.endDate, reason: e.endReason }; }) },
    leave: { byType: Object.keys(byType).map(function (k) { return byType[k]; }).sort(function (a, b) { return b.days - a.days; }), absenteeism: absenteeism,
      top: topLeave.slice(0, 8) },
    docs: { expiring: exp.slice(0, 30), expired: expired.length, soon: exp.length - expired.length, alertDays: alertDays, noWorkPermit: noWP.length },
    training: { sessions: trains.length, people: Object.keys(trained).length, hours: trainHours, coverage: active.length ? Math.round(Object.keys(trained).filter(function (id) { return idx[id] && hrActive_(idx[id]); }).length / active.length * 100) : null,
      list: trains.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 8).map(function (t) { return { title: t.title, date: t.date, hours: t.hours, n: sheJson_(t.attendees, []).length }; }) },
    disc: { total: disc.length, byLevel: cnt(disc, function (x) { return HR_DISC_LEVELS_[x.level]; }) },
    birthdays: bdays, trend: trend, insights: insights
  };
}
