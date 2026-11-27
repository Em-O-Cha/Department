// ==================== ฝ่ายบุคคล — ทะเบียนพนักงาน Job ====================
//
// แยกจากทะเบียนพนักงานประจำ (แท็บ "พนักงาน") ตามที่ผู้ใช้ขอ 19/11/69 — ไม่นับรวมในทะเบียน / Dashboard / แบบฟอร์มขอลา
// แท็บ "พนักงาน Job" ในชีตฝ่ายบุคคล · รูปย่อเก็บในเซลล์ (data URL ไม่เกิน 48,000 ตัวอักษร) เหมือนทะเบียนพนักงานเดิม
// ข้อมูลตั้งต้นจากไฟล์ผู้ใช้ "ทะเบียนพนักงาน JOB" (27 คน: ลำดับ รูป ชื่อ อาคาร วันเริ่มงาน ศาสนา + คอลัมน์ C ที่ซ่อนไว้ = ผู้แนะนำ / ผู้ดูแล)

var HRJ_TABLE_ = { tab: 'พนักงาน Job', cols: [
  ['id', 'รหัส'], ['seq', 'ลำดับ'], ['name', 'ชื่อ'], ['nickname', 'ชื่อเล่น'], ['building', 'อาคาร'], ['startDate', 'วันเริ่มงาน'],
  ['religion', 'ศาสนา'], ['agent', 'ผู้แนะนำ / ผู้ดูแล'], ['phone', 'เบอร์โทร'], ['status', 'สถานะ'], ['endDate', 'วันที่ออก'],
  ['note', 'หมายเหตุ'], ['photoThumb', 'รูปย่อ'], ['nationality', 'สัญชาติ'], ['gender', 'เพศ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] };
var HRJ_FIELDS_ = { name: 120, nickname: 60, building: 40, religion: 40, nationality: 40, gender: 10, agent: 80, phone: 40, status: 20, note: 300 };

function hrjBook_(dept) { var ss = hrBook_(dept); PUR_TABLES_.hr_jobs = HRJ_TABLE_; PUR_NUM_KEYS_.seq = 1; hrjInitNat_(ss); return ss; }
// สัญชาติ (เพิ่ม 19/11/69 เพื่อ Dashboard คนไทย / พม่า): ครั้งแรกตั้งคนที่ยังว่างเป็น "เมียนมา" (นำเข้าจากไฟล์ JOB แรงงานพม่า) — HR แก้รายคนได้
function hrjInitNat_(ss) {
  var p = props_(); if (p.getProperty('HRJ_NAT_INIT')) return;
  p.setProperty('HRJ_NAT_INIT', purNow_());   // ตั้งก่อน กันทำซ้ำถ้ามีหลายคำขอพร้อมกัน
  PUR_TABLES_.hr_jobs = HRJ_TABLE_;
  purRead_(ss, 'hr_jobs').forEach(function (j) { if (!j.nationality) { j.nationality = 'เมียนมา'; purWrite_(ss, 'hr_jobs', j); } });
}
function hrjOut_(j) { var o = {}; HRJ_TABLE_.cols.forEach(function (c) { o[c[0]] = j[c[0]] == null ? '' : j[c[0]]; }); return o; }
function hrjThumb_(v) { return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(v) && v.length < 48000 ? v : ''; }

function hrJobs(token) {
  var dept = requireHr_(token), ss = hrReadBook_(dept, hrPrepJob_);
  var rows = purRead_(ss, 'hr_jobs').sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); });
  return { ok: true, today: purToday_(), jobs: rows.map(hrjOut_), buildings: hrSettings_(ss).buildings };
}
function hrSaveJob(token, j) {
  var dept = requireHr_(token);
  j = j || {};
  if (!hrText_(j.name)) return { ok: false, error: 'ระบุชื่อ' };
  if (j.startDate && !purDate_(j.startDate)) return { ok: false, error: 'วันเริ่มงานไม่ถูกต้อง' };
  if (j.endDate && !purDate_(j.endDate)) return { ok: false, error: 'วันที่ออกไม่ถูกต้อง' };
  return purLocked_(function () {
    var ss = hrjBook_(dept), all = purRead_(ss, 'hr_jobs'), now = purNow_();
    var row = j.id ? hrById_(all, j.id) : null;
    if (j.id && !row) return { ok: false, error: 'ไม่พบรายชื่อ' };
    var rec = row || { id: purId_('JB'), createdAt: now, seq: all.reduce(function (m, x) { return Math.max(m, Number(x.seq) || 0); }, 0) + 1 };
    Object.keys(HRJ_FIELDS_).forEach(function (k) { if (j[k] !== undefined) rec[k] = hrText_(j[k], HRJ_FIELDS_[k]); });
    if (rec.gender && rec.gender !== 'ชาย' && rec.gender !== 'หญิง') rec.gender = '';
    rec.startDate = purDate_(j.startDate);
    rec.endDate = purDate_(j.endDate);
    if (!rec.status) rec.status = 'ทำงานอยู่';
    if (rec.endDate && rec.endDate <= purToday_()) rec.status = 'ลาออก';   // ถึงวันที่ออกแล้ว = ลาออก (ผู้ใช้ขอ 27/11/69)
    if (j.removePhoto) rec.photoThumb = '';
    else if (hrjThumb_(j.photoThumb)) rec.photoThumb = j.photoThumb;
    rec.updatedAt = now;
    purWrite_(ss, 'hr_jobs', rec);
    purLogWrite_(ss, row ? 'แก้ข้อมูลพนักงาน Job' : 'เพิ่มพนักงาน Job', 'hr_jobs', rec.id, rec.name);
    return { ok: true, job: hrjOut_(rec) };
  });
}
function hrDeleteJob(token, id) {
  var dept = requireHr_(token);
  return purLocked_(function () {
    var ss = hrjBook_(dept), row = hrById_(purRead_(ss, 'hr_jobs'), id);
    if (!row) return { ok: false, error: 'ไม่พบรายชื่อ' };
    purSheet_(ss, 'hr_jobs').deleteRow(row._row);
    purLogWrite_(ss, 'ลบพนักงาน Job', 'hr_jobs', id, row.name);
    return { ok: true };
  });
}
