// ==================== ฝ่ายบุคคล — ลงเวลา (ไฟล์จากเครื่องสแกน) ====================
//
// หน้าเว็บ (hrtime.js) อ่านไฟล์รายงานจากโปรแกรมเครื่องสแกน (PDF / Excel: รหัสที่เครื่อง ชื่อ แผนก วัน/เวลา สถานะ เวลาทำงาน
// พัก OT เข้า-ออก เข้า ออก สาย ออกก่อน Remark) แล้วส่งแถวที่อ่านได้มาบันทึก (ผู้ใช้ขอ 19/11/69)
// แท็บ "ลงเวลา" 1 แถว = 1 คน × 1 วัน (รหัส T<วันที่>_<รหัสที่เครื่อง>) · นำเข้าวันเดิมซ้ำ = แทนข้อมูลเดิม
// จับคู่รหัสที่เครื่อง → พนักงาน (รวม Job) เก็บใน hr_settings: timeMap
// มาสาย / ขาดงาน ลงเป็นข้อมูลในแท็บการลาเลย (สถานะอนุมัติ, ช่องทาง "เครื่องสแกน") — ไม่ต้องอนุมัติ ตามที่ผู้ใช้ขอ
//   ขาดงาน: ลงเฉพาะคนที่ไม่มีใบลาวันนั้น · นำเข้าใหม่แล้วไม่สาย/ไม่ขาด = ลบรายการที่เครื่องสแกนลงไว้
//   ไม่สแกนเข้า / ไม่สแกนออก / ออกก่อน เก็บไว้ดูในหน้าลงเวลาเท่านั้น

var HRT_TABLE_ = { tab: 'ลงเวลา', cols: [
  ['id', 'รหัส'], ['date', 'วันที่'], ['machineId', 'รหัสที่เครื่อง'], ['empId', 'รหัสพนักงานในระบบ'], ['name', 'ชื่อในเครื่อง'], ['dept', 'แผนก'],
  ['dayStatus', 'สถานะวัน'], ['shift', 'กะ'], ['timeIn', 'เข้า'], ['timeOut', 'ออก'], ['workTime', 'เวลาทำงาน'], ['lateMin', 'สาย (นาที)'],
  ['earlyMin', 'ออกก่อน (นาที)'], ['otBefore', 'OT ก่อน'], ['otAfter', 'OT หลัง'], ['remark', 'หมายเหตุ'], ['importedAt', 'นำเข้าเมื่อ'],
  ['kind', 'สถานะที่ HR แก้'], ['editedAt', 'HR แก้เมื่อ']] };
// HR แก้แถวลงเวลาได้ (ผู้ใช้ขอ 19/11/69): kind = '' (ตามไฟล์) | ok (มาทำงาน) | absent | sick | personal | vacation | other
// แถวที่ HR แก้แล้ว นำเข้าไฟล์วันเดิมซ้ำจะไม่ทับ
var HRT_KINDS_ = { ok: 'มาทำงาน', absent: 'ขาดงาน', sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', other: 'ลาอื่นๆ' };
var HRT_SRC_ = 'เครื่องสแกน';

function hrtBook_(dept) { var ss = hrBook_(dept); PUR_TABLES_.hr_time = HRT_TABLE_; PUR_NUM_KEYS_.lateMin = 1; PUR_NUM_KEYS_.earlyMin = 1; return ss; }
function hrtMap_(ss) {
  var row = purRead_(ss, 'hr_settings').filter(function (x) { return x.id === 'timeMap'; })[0];
  try { var m = JSON.parse((row && row.value) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; }
}
function hrtOut_(r) { var o = {}; HRT_TABLE_.cols.forEach(function (c) { o[c[0]] = r[c[0]] == null ? '' : r[c[0]]; }); return o; }
function hrtTime_(v) { var s = String(v || '').trim(); return /^\d{1,2}:\d{2}$/.test(s) ? s : ''; }

function hrTimeInit(token) {
  var dept = requireHr_(token), ss = hrtBook_(dept);
  return { ok: true, today: purToday_(), map: hrtMap_(ss),
    people: hrPeople_(ss).map(function (e) { return { id: e.id, name: e.fullName, nick: e.nickname || '', job: !!e.isJob, out: e.status === 'ลาออก' }; }) };
}
function hrTimeList(token, from, to) {
  var dept = requireHr_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var ss = hrReadBook_(dept, hrPrepTime_);
  return { ok: true, map: hrtMap_(ss), rows: purRead_(ss, 'hr_time').filter(function (r) { return r.date >= from && r.date <= to; }).map(hrtOut_) };
}
// rows = แถวที่หน้าเว็บอ่านจากไฟล์ · map = { รหัสที่เครื่อง: empId | '' } ที่ HR จับคู่ / แก้
function hrTimeSave(token, rows, map) {
  var dept = requireHr_(token);
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: 'ไม่มีข้อมูลในไฟล์' };
  if (rows.length > 6000) return { ok: false, error: 'ไฟล์ใหญ่เกิน (เกิน 6,000 แถว) — แบ่งไฟล์เป็นช่วงสั้นลง' };
  var clean = [];
  rows.forEach(function (r) {
    var d = purDate_(r && r.date), mid = purClean_(r && r.machineId, 20);
    if (!d || !mid) return;
    clean.push({ date: d, machineId: mid, name: purClean_(r.name, 80), dept: purClean_(r.dept, 60), dayStatus: purClean_(r.dayStatus, 20), shift: purClean_(r.shift, 30),
      timeIn: hrtTime_(r.timeIn), timeOut: hrtTime_(r.timeOut), workTime: hrtTime_(r.workTime), lateMin: Math.max(0, Math.round(Number(r.lateMin) || 0)),
      earlyMin: Math.max(0, Math.round(Number(r.earlyMin) || 0)), otBefore: hrtTime_(r.otBefore), otAfter: hrtTime_(r.otAfter), remark: purClean_(r.remark, 120) });
  });
  if (!clean.length) return { ok: false, error: 'อ่านข้อมูลในไฟล์ไม่ได้' };
  return purLocked_(function () {
    var ss = hrtBook_(dept), now = purNow_(), people = {};
    hrPeople_(ss).forEach(function (e) { people[e.id] = e; });
    // 1) จับคู่รหัสที่เครื่อง
    var tm = hrtMap_(ss);
    Object.keys(map || {}).slice(0, 500).forEach(function (k) {
      var mid = purClean_(k, 20), emp = String(map[k] || '');
      if (!mid) return;
      if (emp && people[emp]) tm[mid] = emp; else if (!emp) delete tm[mid];
    });
    var srow = purRead_(ss, 'hr_settings').filter(function (x) { return x.id === 'timeMap'; })[0] || { id: 'timeMap' };
    srow.value = JSON.stringify(tm); purWrite_(ss, 'hr_settings', srow);
    // 2) แท็บลงเวลา: รวมกับของเดิม (วัน + รหัสเดียวกัน = แทน) แล้วเขียนทั้งตารางครั้งเดียว
    var all = {}, order = [];
    purRead_(ss, 'hr_time').forEach(function (r) { var o = hrtOut_(r); all[o.id] = o; order.push(o.id); });
    clean.forEach(function (r) {
      r.id = 'T' + r.date + '_' + r.machineId; r.empId = tm[r.machineId] || ''; r.importedAt = now;
      var old = all[r.id];
      if (old && old.editedAt) { old.empId = r.empId; return; }   // HR แก้แล้ว → ไม่ทับ (อัปเดตแค่การจับคู่)
      if (!old) order.push(r.id);
      r.kind = ''; r.editedAt = '';
      all[r.id] = r;
    });
    var list = order.map(function (id) { return all[id]; }).sort(function (a, b) { return a.date === b.date ? (Number(a.machineId) || 0) - (Number(b.machineId) || 0) : (a.date < b.date ? -1 : 1); });
    var sh = purSheet_(ss, 'hr_time'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
    if (list.length) sh.getRange(2, 1, list.length, head.length).setValues(list.map(function (o) { return purRowValues_(sh, 'hr_time', o, head); }));
    // 3) มาสาย / ขาดงาน (+ การลาที่ HR แก้) → แท็บการลา — ใช้แถวสุดท้ายในตาราง (แถวที่ HR แก้แล้วคงไว้)
    var res = hrtSyncLeaves_(ss, clean.map(function (r) { return all[r.id]; }), now), nLate = res.late, nAbs = res.absent, unmatched = res.unmatched;
    var days = clean.map(function (r) { return r.date; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    purLogWrite_(ss, 'นำเข้าไฟล์ลงเวลา', 'hr_time', '', days[0] + (days.length > 1 ? ' – ' + days[days.length - 1] : '') + ' · ' + clean.length + ' แถว · สาย ' + nLate + ' · ขาด ' + nAbs);
    return { ok: true, saved: clean.length, days: days, late: nLate, absent: nAbs, unmatched: Object.keys(unmatched).length, map: tm };
  });
}

// มาสาย / ขาดงาน / การลาจากหน้าลงเวลา → แท็บการลา (ช่องทาง "เครื่องสแกน", สถานะอนุมัติ) · ต้องถือ lock อยู่แล้ว
function hrtSyncLeaves_(ss, rows, now) {
  var leaves = purRead_(ss, 'hr_leaves'), st = hrSettings_(ss), del = [], nLate = 0, nAbs = 0, unmatched = {};
  rows.forEach(function (r) {
    if (!r) return;
    if (!r.empId) { if (r.dayStatus !== 'วันหยุด') unmatched[r.machineId] = 1; return; }
    var mine = leaves.filter(function (l) { return l.empId === r.empId && l.dateFrom <= r.date && (l.dateTo || l.dateFrom) >= r.date && l.status !== 'ไม่อนุมัติ'; });
    var scan = mine.filter(function (l) { return l.source === HRT_SRC_ && l.dateFrom === r.date; });
    var other = mine.filter(function (l) { return l.source !== HRT_SRC_ && l.type !== 'late'; });
    var work = r.dayStatus !== 'วันหยุด' || r.kind;
    var lateMin = Number(r.lateMin) || 0;
    // ประเภทการขาด / ลาของวันนั้น: เฉพาะที่ HR เลือกเองในหน้าลงเวลา · "ขาดงาน" ตามไฟล์ไม่ลงหน้าการลาอัตโนมัติแล้ว (ผู้ใช้ขอ 24/11/69)
    // มีใบลาอื่นอยู่แล้ว = ไม่ลงซ้ำ · รายการขาดงานอัตโนมัติเดิมของวันนั้นจะถูกลบเมื่อนำเข้า / แก้แถวนั้นอีกครั้ง
    var off = r.kind ? (r.kind === 'ok' ? '' : r.kind) : '';
    if (off && other.length) off = '';
    var wantLate = work && lateMin > 0 && !(r.kind && r.kind !== 'ok');
    var keep = {};
    var put = function (type, build) {
      var cur = scan.filter(function (l) { return l.type === type; });
      var rec = cur[0] || { id: purId_('LV'), empId: r.empId, type: type, dateFrom: r.date, dateTo: r.date, files: '[]', createdAt: now, source: HRT_SRC_, decidedAt: '' };
      build(rec); rec.status = 'อนุมัติ'; rec.approver = r.editedAt ? 'HR (หน้าลงเวลา)' : HRT_SRC_; rec.updatedAt = now;
      purWrite_(ss, 'hr_leaves', rec); keep[rec.id] = 1;
    };
    if (wantLate) { put('late', function (rec) { rec.days = 0; rec.minutes = lateMin; rec.reason = 'สแกนเข้า ' + (r.timeIn || '-') + (r.shift ? ' (กะ ' + r.shift + ')' : ''); }); nLate++; }
    if (off) {
      put(off, function (rec) { rec.days = hrWorkDays_(r.date, r.date, st) || 1; rec.minutes = ''; rec.reason = r.kind ? (r.remark || HRT_KINDS_[off] + ' (HR บันทึกในหน้าลงเวลา)') : 'ไม่มีเวลาสแกน (จากเครื่องสแกน)'; });
      if (off === 'absent') nAbs++;
    }
    scan.forEach(function (l) { if (!keep[l.id]) del.push(l._row); });
  });
  if (del.length) { var lsh = purSheet_(ss, 'hr_leaves'); del.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return b - a; }).forEach(function (n) { lsh.deleteRow(n); }); }
  return { late: nLate, absent: nAbs, unmatched: Object.keys(unmatched) };
}
// HR แก้แถวลงเวลา 1 แถว (เวลาเข้า / ออก / สาย / ออกก่อน / สถานะ / หมายเหตุ) แล้วปรับแท็บการลาของวันนั้นตาม
function hrTimeEdit(token, id, x) {
  var dept = requireHr_(token);
  x = x || {};
  if (x.kind && !HRT_KINDS_[x.kind]) return { ok: false, error: 'สถานะไม่ถูกต้อง' };
  return purLocked_(function () {
    var ss = hrtBook_(dept), row = hrById_(purRead_(ss, 'hr_time'), String(id || ''));
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    if (!row.empId) return { ok: false, error: 'ยังไม่ได้จับคู่รายชื่อนี้กับทะเบียน — จับคู่ก่อนแล้วค่อยแก้' };
    var now = purNow_(), before = [row.timeIn, row.timeOut, row.lateMin, row.kind || '', row.remark].join(' / ');
    row.timeIn = hrtTime_(x.timeIn); row.timeOut = hrtTime_(x.timeOut);
    row.lateMin = Math.max(0, Math.round(Number(x.lateMin) || 0)); row.earlyMin = Math.max(0, Math.round(Number(x.earlyMin) || 0));
    row.kind = x.kind ? String(x.kind) : ''; row.remark = purClean_(x.remark, 120); row.editedAt = now;
    purWrite_(ss, 'hr_time', row);
    var res = hrtSyncLeaves_(ss, [row], now);
    purLogWrite_(ss, 'แก้ข้อมูลลงเวลา', 'hr_time', row.id, (row.name || '') + ' ' + row.date + ' · ' + before + ' → ' + [row.timeIn, row.timeOut, row.lateMin, row.kind, row.remark].join(' / '));
    return { ok: true, row: hrtOut_(row), late: res.late, absent: res.absent };
  });
}
