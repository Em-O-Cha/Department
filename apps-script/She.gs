// ==================== ฝ่ายความปลอดภัยและสิ่งแวดล้อม (SHE) ====================
//
// ข้อมูลเก็บใน Google Sheet ของฝ่าย (ตั้งลิงก์ในหน้าผู้ดูแลระบบ) · รูปถ่ายเก็บในโฟลเดอร์ Drive ของฝ่าย
//   พื้นที่ตรวจ · หัวข้อตรวจ        = แบบตรวจความปลอดภัย FM-SHE-01-06 (รอบโรงงาน / G1 / G2 / G3 …) แก้ได้ในหน้าตั้งค่า
//   ผลตรวจรายวัน                    = ตรวจแต่ละรอบ (ความถี่ 1–3 ต่อวัน) ผล P ผ่าน / O ไม่ผ่าน / - ไม่เกี่ยวข้อง ต่อหัวข้อ
//   ข้อบกพร่อง                       = FM-SHE-01-05 สรุปรายงานสำรวจตรวจสอบ: รูปก่อน/หลังปรับปรุง ผู้รับผิดชอบ สถานะ
//   อุบัติเหตุ                         = อุบัติเหตุ / เหตุการณ์เกือบเกิด (near miss) — ใช้ทำ Dashboard ผู้บริหาร
//   ตั้งค่า · ประวัติแก้ไข
// ใช้ตัวอ่าน/เขียนชีตของ Purchasing.gs (purRead_ / purWrite_ อ่านตามชื่อหัวคอลัมน์) — ตาราง SHE ลงทะเบียนเพิ่มใน PUR_TABLES_ ตอนเปิดชีต
// ทุกฟังก์ชันต้องมีตั๋วของฝ่าย SHE (requireShe_) · แก้ไขทุกครั้งบันทึกในแท็บประวัติแก้ไข

var SHE_TABLES_ = {
  she_areas: { tab: 'พื้นที่ตรวจ', cols: [
    ['id', 'รหัส'], ['name', 'ชื่อพื้นที่'], ['title', 'หัวแบบฟอร์ม'], ['rounds', 'ความถี่ต่อวัน'], ['order', 'ลำดับ'],
    ['active', 'ใช้งาน'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  she_items: { tab: 'หัวข้อตรวจ', cols: [
    ['id', 'รหัส'], ['areaId', 'รหัสพื้นที่'], ['no', 'ลำดับ'], ['category', 'หมวด'], ['detail', 'รายละเอียด'], ['active', 'ใช้งาน']] },
  she_checks: { tab: 'ผลตรวจรายวัน', cols: [
    ['id', 'รหัส'], ['date', 'วันที่ตรวจ'], ['areaId', 'รหัสพื้นที่'], ['round', 'รอบที่'], ['results', 'ผลตรวจ'],
    ['passCount', 'ผ่าน'], ['failCount', 'ไม่ผ่าน'], ['problem', 'ปัญหาที่พบ'], ['fix', 'แนวทางการแก้ไข'], ['inspector', 'ผู้ตรวจ'],
    ['files', 'รูปถ่าย'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  she_findings: { tab: 'ข้อบกพร่อง', cols: [
    ['id', 'รหัส'], ['code', 'เลขที่'], ['date', 'วันที่สำรวจ'], ['areaId', 'รหัสพื้นที่'], ['location', 'สถานที่ / พื้นที่'],
    ['dept', 'หน่วยงาน / แผนก / ฝ่าย'], ['category', 'หมวด'], ['itemId', 'รหัสหัวข้อตรวจ'], ['problem', 'ปัญหาที่ตรวจพบ'],
    ['risk', 'ระดับความเสี่ยง'], ['recommendation', 'ข้อเสนอแนะ / การปรับปรุงแก้ไข'], ['responsible', 'ผู้รับผิดชอบ'],
    ['dueDate', 'กำหนดเสร็จ'], ['status', 'สถานะ'], ['doneDate', 'วันที่แก้ไขเสร็จ'], ['remark', 'หมายเหตุ'],
    ['beforeFiles', 'รูปก่อนปรับปรุง'], ['afterFiles', 'รูปหลังปรับปรุง'], ['checkId', 'รหัสผลตรวจ'], ['inspector', 'ผู้ตรวจ'],
    ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  she_incidents: { tab: 'อุบัติเหตุ', cols: [
    ['id', 'รหัส'], ['date', 'วันที่เกิดเหตุ'], ['time', 'เวลา'], ['type', 'ประเภท'], ['areaId', 'รหัสพื้นที่'], ['location', 'สถานที่'],
    ['person', 'ผู้ประสบเหตุ'], ['dept', 'แผนก'], ['injury', 'การบาดเจ็บ / ความเสียหาย'], ['lostDays', 'วันหยุดงาน'],
    ['cause', 'สาเหตุ'], ['action', 'การแก้ไข / ป้องกัน'], ['reporter', 'ผู้รายงาน'], ['files', 'รูปถ่าย'],
    ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  she_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] }
};
var SHE_FINDING_ST_ = { open: 'พบปัญหา', progress: 'อยู่ระหว่างดำเนินการ', done: 'ปรับปรุงแก้ไขเรียบร้อย' };
var SHE_RISK_ = { L: 'ต่ำ', M: 'ปานกลาง', H: 'สูง' };
var SHE_INC_TYPES_ = { lti: 'อุบัติเหตุถึงขั้นหยุดงาน', acc: 'อุบัติเหตุไม่ถึงขั้นหยุดงาน', first: 'ปฐมพยาบาล', near: 'เหตุการณ์เกือบเกิด (Near miss)',
  prop: 'ทรัพย์สินเสียหาย', fire: 'ไฟไหม้ / เพลิงไหม้', env: 'สิ่งแวดล้อม (รั่วไหล / มลพิษ)' };
var SHE_ACCIDENT_TYPES_ = { lti: 1, acc: 1, first: 1 };
var SHE_SETTINGS_DEFAULT_ = {
  fm05: 'FM-SHE-01-05 Rev.00 วันที่ประกาศใช้ 11/11/2026',
  fm06: 'FM-SHE-01-06 Rev.00 วันที่ประกาศใช้ 11/11/2026',
  inspectors: '', depts: 'ฝ่ายผลิต, คลังสินค้า, ซ่อมบำรุง, QA, สำนักงาน', signPrep: 'จป.วิชาชีพ', signApprove: 'ผู้จัดการ',
  signCheck: 'ผู้ตรวจสอบ', signReview: 'ผู้ทวนสอบ'
};
// แบบตรวจตั้งต้น (จาก FM-SHE-01-06) — ใส่ให้ครั้งแรกเมื่อแท็บพื้นที่ตรวจยังว่าง
var SHE_SEED_ = [
  { name: 'รอบโรงงาน', title: 'แบบตรวจความปลอดภัย รอบโรงงาน', items: [
    ['พื้นที่และความสะอาด', 'พื้นไม่ลื่น ไม่มีน้ำขัง ขยะ หรือสิ่งกีดขวาง'],
    ['ระบบไฟฟ้าภายนอก', 'ตู้ไฟและสายไฟต้องสมบูรณ์ ไม่ชำรุด และไม่มีน้ำรั่วขัง'],
    ['สถานีจ่ายแก๊ส', 'ถังแก๊สและวาล์วต้องไม่มีการรั่วไหล พร้อมป้ายห้ามสูบบุหรี่และถังดับเพลิง'],
    ['พื้นที่สูบบุหรี่', 'ต้องอยู่ห่างจากจุดไวไฟ พร้อมมีภาชนะทิ้งก้นบุหรี่ที่ปลอดภัย'],
    ['เครื่องจักรและอุปกรณ์', 'มีอุปกรณ์ป้องกันส่วนที่เคลื่อนที่และได้รับการบำรุงรักษาตามกำหนด'],
    ['ความสะอาดและสิ่งแวดล้อม', 'พื้นสะอาด ไม่มีขยะ น้ำขัง น้ำมันหก หรือสารเคมีรั่วไหล']] },
  { name: 'G1', title: 'แบบตรวจความปลอดภัย G 1' }, { name: 'G2', title: 'แบบตรวจความปลอดภัย G 2' }, { name: 'G3', title: 'แบบตรวจความปลอดภัย G 3' }
];
var SHE_G_ITEMS_ = [
  ['พื้นที่และความสะอาด', 'พื้นไม่ลื่น ไม่มีน้ำขัง ขยะ หรือสิ่งกีดขวาง'],
  ['อาคารและสภาพแวดล้อม', 'พื้น ผนัง เพดาน ชั้นวาง แสงสว่าง และการระบายอากาศปกติ'],
  ['เครื่องจักรและอุปกรณ์', 'เครื่องจักรพร้อมใช้ การ์ดครอบและอุปกรณ์นิรภัยอยู่ครบ'],
  ['ระบบไฟฟ้าและอัคคีภัย', 'ไฟฟ้าไม่ชำรุด ไม่มีความเสี่ยงไฟไหม้ ถังดับเพลิงพร้อมใช้'],
  ['สารเคมีและการจัดเก็บ', 'สารเคมีมีฉลาก ภาชนะปิดสนิท จัดเก็บถูกต้อง วัสดุไม่เสี่ยงล้ม'],
  ['บุคลากรและสุขลักษณะ', 'สวม PPE ถูกต้อง ปฏิบัติงานปลอดภัย และพื้นที่สะอาดไม่ปนเปื้อน']
];

// ---------- พื้นฐาน ----------
function requireShe_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'safety') throw new Error('แผนกนี้ไม่มีระบบความปลอดภัย');
  return dept;
}
function sheRegister_() {
  Object.keys(SHE_TABLES_).forEach(function (k) { PUR_TABLES_[k] = SHE_TABLES_[k]; });
  ['doneDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['rounds', 'round', 'no', 'order', 'lostDays', 'passCount', 'failCount'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function sheBook_(dept) {
  sheRegister_();
  var ss = purBook_(dept);
  if (!purRead_(ss, 'she_areas').length) sheSeed_(ss);
  return ss;
}
function sheSeed_(ss) {
  purLocked_(function () {
    if (purRead_(ss, 'she_areas').length) return;
    var now = purNow_();
    SHE_SEED_.forEach(function (a, i) {
      var id = purId_('AR');
      purWrite_(ss, 'she_areas', { id: id, name: a.name, title: a.title, rounds: 3, order: i + 1, active: 'ใช้', createdAt: now, updatedAt: now });
      (a.items || SHE_G_ITEMS_).forEach(function (it, j) {
        purWrite_(ss, 'she_items', { id: purId_('IT'), areaId: id, no: j + 1, category: it[0], detail: it[1], active: 'ใช้' });
      });
    });
    var st = purRead_(ss, 'she_settings').map(function (x) { return x.id; });
    Object.keys(SHE_SETTINGS_DEFAULT_).forEach(function (k) { if (st.indexOf(k) < 0) purWrite_(ss, 'she_settings', { id: k, value: SHE_SETTINGS_DEFAULT_[k] }); });
    purLogWrite_(ss, 'สร้างแบบตรวจตั้งต้น', 'she_areas', '', 'รอบโรงงาน, G1, G2, G3 (จาก FM-SHE-01-06)');
  });
}
function sheSettings_(ss) {
  var s = {};
  Object.keys(SHE_SETTINGS_DEFAULT_).forEach(function (k) { s[k] = SHE_SETTINGS_DEFAULT_[k]; });
  purRead_(ss, 'she_settings').forEach(function (x) { if (x.id) s[x.id] = String(x.value == null ? '' : x.value); });
  return s;
}
function sheJson_(v, def) { try { var o = typeof v === 'string' ? JSON.parse(v || '') : v; return o == null ? def : o; } catch (e) { return def; } }
function sheText_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 1000); }
function sheDays_(a, b) { return Math.round((purToDate_(b) - purToDate_(a)) / 864e5); }
function sheAddDays_(iso, n) { var d = purToDate_(iso); d.setDate(d.getDate() + n); return Utilities.formatDate(d, PUR_TZ_, 'yyyy-MM-dd'); }
function sheDeleteRow_(ss, table, row) { purSheet_(ss, table).deleteRow(row._row); }
function sheFilesOf_(row, slot) { return purParseFiles_(row[slot]); }
function sheAreasWithItems_(ss) {
  var items = purRead_(ss, 'she_items');
  return purRead_(ss, 'she_areas').sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); }).map(function (a) {
    a.items = items.filter(function (x) { return x.areaId === a.id; }).sort(function (x, y) { return (Number(x.no) || 0) - (Number(y.no) || 0); });
    a.rounds = Math.max(1, Math.min(6, Number(a.rounds) || 1));
    return a;
  });
}
function sheCheckOut_(c) { c.results = sheJson_(c.results, {}); c.files = purParseFiles_(c.files); return c; }
function sheFindingOut_(f) { f.beforeFiles = purParseFiles_(f.beforeFiles); f.afterFiles = purParseFiles_(f.afterFiles); return f; }

// ---------- โหลดข้อมูลทั้งหมดของหน้า (ผลตรวจย้อนหลัง 70 วัน) ----------
function sheLoad(token) {
  var dept = requireShe_(token), ss = sheBook_(dept), today = purToday_(), since = sheAddDays_(today, -70);
  return {
    ok: true, today: today, sheetUrl: ss.getUrl(), hasFolder: !!deptConfig_(dept.key).folderId,
    settings: sheSettings_(ss), areas: sheAreasWithItems_(ss),
    checks: purRead_(ss, 'she_checks').filter(function (c) { return c.date >= since; }).map(sheCheckOut_),
    findings: purRead_(ss, 'she_findings').map(sheFindingOut_).sort(function (a, b) { return String(b.date + b.createdAt).localeCompare(String(a.date + a.createdAt)); }),
    incidents: purRead_(ss, 'she_incidents').map(function (x) { x.files = purParseFiles_(x.files); return x; }).sort(function (a, b) { return String(b.date + b.time).localeCompare(String(a.date + a.time)); })
  };
}

// ---------- ตรวจรอบ: บันทึกผล 1 รอบ ของ 1 พื้นที่ (+ สร้างข้อบกพร่องของข้อที่ไม่ผ่าน) ----------
// c = { id?, date, areaId, round, results: {itemId: 'P'|'O'|'-'}, problem, fix, inspector }
// newFindings = [{ itemId, problem, dept, risk, recommendation, responsible, dueDate }]
function sheSaveCheck(token, c, newFindings) {
  var dept = requireShe_(token);
  c = c || {};
  var date = purDate_(c.date);
  if (!date) return { ok: false, error: 'ระบุวันที่ตรวจ' };
  if (date > purToday_()) return { ok: false, error: 'บันทึกผลตรวจล่วงหน้าไม่ได้' };
  return purLocked_(function () {
    var ss = sheBook_(dept), area = sheAreasWithItems_(ss).filter(function (a) { return a.id === c.areaId; })[0];
    if (!area) return { ok: false, error: 'ไม่พบพื้นที่ตรวจ' };
    var round = Math.round(Number(c.round) || 0);
    if (round < 1 || round > area.rounds) return { ok: false, error: 'รอบที่ต้องอยู่ระหว่าง 1–' + area.rounds };
    var res = {}, raw = c.results || {}, pass = 0, fail = 0;
    area.items.forEach(function (it) {
      var r = String(raw[it.id] || '');
      if (r === 'P' || r === 'O' || r === '-') { res[it.id] = r; if (r === 'P') pass++; if (r === 'O') fail++; }
    });
    if (!Object.keys(res).length) return { ok: false, error: 'ยังไม่ได้เลือกผลตรวจ' };
    var all = purRead_(ss, 'she_checks'), now = purNow_();
    var row = (c.id && all.filter(function (x) { return x.id === c.id; })[0])
      || all.filter(function (x) { return x.date === date && x.areaId === area.id && Number(x.round) === round; })[0];
    var before = row ? JSON.stringify(row.results) : '';
    var rec = row || { id: purId_('CK'), createdAt: now, files: '[]' };
    rec.date = date; rec.areaId = area.id; rec.round = round; rec.results = JSON.stringify(res);
    rec.passCount = pass; rec.failCount = fail;
    rec.problem = sheText_(c.problem, 1000); rec.fix = sheText_(c.fix, 1000); rec.inspector = purClean_(c.inspector, 80);
    rec.updatedAt = now;
    purWrite_(ss, 'she_checks', rec);
    purLogWrite_(ss, row ? 'แก้ผลตรวจ' : 'บันทึกผลตรวจ', 'she_checks', rec.id, area.name + ' ' + date + ' รอบ ' + round + ' · ผ่าน ' + pass + ' ไม่ผ่าน ' + fail + (before ? ' (เดิม ' + before + ')' : ''));
    var created = [];
    (Array.isArray(newFindings) ? newFindings : []).slice(0, 30).forEach(function (f) {
      var it = area.items.filter(function (x) { return x.id === f.itemId; })[0];
      var fr = sheNewFinding_(ss, {
        date: date, areaId: area.id, location: area.name, dept: f.dept, category: it ? it.category : purClean_(f.category, 80),
        itemId: it ? it.id : '', problem: f.problem || (it ? it.detail : ''), risk: f.risk, recommendation: f.recommendation,
        responsible: f.responsible, dueDate: f.dueDate, remark: f.remark, checkId: rec.id, inspector: rec.inspector
      });
      created.push({ itemId: f.itemId || '', key: f.key || '', id: fr.id, code: fr.code });
    });
    return { ok: true, check: sheCheckOut_(purRead_(ss, 'she_checks').filter(function (x) { return x.id === rec.id; })[0]), findings: created };
  });
}
function sheDeleteCheck(token, id) {
  var dept = requireShe_(token);
  return purLocked_(function () {
    var ss = sheBook_(dept), row = purRead_(ss, 'she_checks').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบผลตรวจ' };
    sheDeleteRow_(ss, 'she_checks', row);
    purLogWrite_(ss, 'ลบผลตรวจ', 'she_checks', id, row.date + ' ' + row.areaId + ' รอบ ' + row.round + ' ' + row.results);
    return { ok: true };
  });
}

// ---------- ข้อบกพร่อง (FM-SHE-01-05) ----------
function sheNextCode_(ss, date) {
  var pre = 'F' + String(date).slice(2, 4) + String(date).slice(5, 7) + '-', n = 0;
  purRead_(ss, 'she_findings').forEach(function (x) { if (String(x.code).indexOf(pre) === 0) n = Math.max(n, parseInt(String(x.code).slice(pre.length), 10) || 0); });
  return pre + ('00' + (n + 1)).slice(-3);
}
function sheFindingFields_(rec, f) {
  rec.location = purClean_(f.location, 120); rec.dept = purClean_(f.dept, 120); rec.category = purClean_(f.category, 80);
  rec.problem = sheText_(f.problem, 1000); rec.risk = SHE_RISK_[f.risk] ? f.risk : 'M';
  rec.recommendation = sheText_(f.recommendation, 1000); rec.responsible = purClean_(f.responsible, 120);
  rec.dueDate = purDate_(f.dueDate); rec.remark = sheText_(f.remark, 500);
  if (f.areaId !== undefined) rec.areaId = purClean_(f.areaId, 40);
  if (f.itemId !== undefined) rec.itemId = purClean_(f.itemId, 40);
}
function sheNewFinding_(ss, f) {
  var now = purNow_(), date = purDate_(f.date) || purToday_();
  var rec = { id: purId_('FD'), code: sheNextCode_(ss, date), date: date, status: 'open', beforeFiles: '[]', afterFiles: '[]',
    checkId: purClean_(f.checkId, 40), inspector: purClean_(f.inspector, 80), createdAt: now, updatedAt: now };
  sheFindingFields_(rec, f);
  if (!rec.problem) rec.problem = '(ไม่ระบุ)';
  purWrite_(ss, 'she_findings', rec);
  purLogWrite_(ss, 'บันทึกข้อบกพร่อง', 'she_findings', rec.id, rec.code + ' ' + rec.location + ' · ' + rec.problem);
  return rec;
}
function sheSaveFinding(token, f) {
  var dept = requireShe_(token);
  f = f || {};
  if (!sheText_(f.problem)) return { ok: false, error: 'ระบุปัญหาที่ตรวจพบ' };
  return purLocked_(function () {
    var ss = sheBook_(dept);
    if (!f.id) {
      var nr = sheNewFinding_(ss, f);
      return { ok: true, finding: sheFindingOut_(purRead_(ss, 'she_findings').filter(function (x) { return x.id === nr.id; })[0]) };
    }
    var row = purRead_(ss, 'she_findings').filter(function (x) { return x.id === f.id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var old = JSON.stringify([row.status, row.problem, row.recommendation, row.responsible, row.dueDate]);
    if (purDate_(f.date)) row.date = purDate_(f.date);
    sheFindingFields_(row, f);
    var st = SHE_FINDING_ST_[f.status] ? f.status : row.status || 'open';
    if (st === 'done') {
      row.doneDate = purDate_(f.doneDate) || row.doneDate || purToday_();
      if (!purParseFiles_(row.afterFiles).length && !sheText_(f.remark) && f.forceDone !== true) return { ok: false, needAfter: true, error: 'ปิดงานต้องมีรูปหลังปรับปรุง หรือเขียนหมายเหตุ' };
    } else row.doneDate = '';
    row.status = st; row.updatedAt = purNow_();
    purWrite_(ss, 'she_findings', row);
    purLogWrite_(ss, 'แก้ข้อบกพร่อง', 'she_findings', row.id, row.code + ' ' + SHE_FINDING_ST_[st] + ' (เดิม ' + old + ')');
    return { ok: true, finding: sheFindingOut_(purRead_(ss, 'she_findings').filter(function (x) { return x.id === row.id; })[0]) };
  });
}
function sheDeleteFinding(token, id) {
  var dept = requireShe_(token);
  return purLocked_(function () {
    var ss = sheBook_(dept), row = purRead_(ss, 'she_findings').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    purParseFiles_(row.beforeFiles).concat(purParseFiles_(row.afterFiles)).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    sheDeleteRow_(ss, 'she_findings', row);
    purLogWrite_(ss, 'ลบข้อบกพร่อง', 'she_findings', id, row.code + ' ' + row.problem);
    return { ok: true };
  });
}

// ---------- อุบัติเหตุ / เกือบเกิดเหตุ ----------
function sheSaveIncident(token, x) {
  var dept = requireShe_(token);
  x = x || {};
  var date = purDate_(x.date);
  if (!date) return { ok: false, error: 'ระบุวันที่เกิดเหตุ' };
  if (!SHE_INC_TYPES_[x.type]) return { ok: false, error: 'เลือกประเภทเหตุการณ์' };
  return purLocked_(function () {
    var ss = sheBook_(dept), now = purNow_();
    var row = x.id ? purRead_(ss, 'she_incidents').filter(function (r) { return r.id === x.id; })[0] : null;
    if (x.id && !row) return { ok: false, error: 'ไม่พบรายการ' };
    var rec = row || { id: purId_('IN'), files: '[]', createdAt: now };
    rec.date = date; rec.time = /^\d{1,2}:\d{2}$/.test(String(x.time || '')) ? x.time : ''; rec.type = x.type;
    rec.areaId = purClean_(x.areaId, 40); rec.location = purClean_(x.location, 120); rec.person = purClean_(x.person, 120);
    rec.dept = purClean_(x.dept, 120); rec.injury = sheText_(x.injury, 1000); rec.lostDays = Math.max(0, Math.round(Number(x.lostDays) || 0));
    rec.cause = sheText_(x.cause, 1000); rec.action = sheText_(x.action, 1000); rec.reporter = purClean_(x.reporter, 80); rec.updatedAt = now;
    purWrite_(ss, 'she_incidents', rec);
    purLogWrite_(ss, row ? 'แก้เหตุการณ์' : 'บันทึกเหตุการณ์', 'she_incidents', rec.id, date + ' ' + SHE_INC_TYPES_[rec.type] + ' · ' + rec.location);
    var out = purRead_(ss, 'she_incidents').filter(function (r) { return r.id === rec.id; })[0];
    out.files = purParseFiles_(out.files);
    return { ok: true, incident: out };
  });
}
function sheDeleteIncident(token, id) {
  var dept = requireShe_(token);
  return purLocked_(function () {
    var ss = sheBook_(dept), row = purRead_(ss, 'she_incidents').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    purParseFiles_(row.files).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    sheDeleteRow_(ss, 'she_incidents', row);
    purLogWrite_(ss, 'ลบเหตุการณ์', 'she_incidents', id, row.date + ' ' + row.type + ' ' + row.location);
    return { ok: true };
  });
}

// ---------- รูปถ่าย (เก็บในโฟลเดอร์ Drive ของฝ่าย · เปิดดูได้ด้วยลิงก์ เพื่อแสดงในหน้าเว็บ/รายงาน) ----------
var SHE_FILE_SLOTS_ = { finding: { table: 'she_findings', slots: { before: 'beforeFiles', after: 'afterFiles' } },
  incident: { table: 'she_incidents', slots: { files: 'files' } }, check: { table: 'she_checks', slots: { files: 'files' } } };
function sheUploadFile(token, ownerType, ownerId, slot, fileName, mimeType, base64) {
  var dept = requireShe_(token);
  var o = SHE_FILE_SLOTS_[ownerType], col = o && o.slots[slot];
  if (!col) return { ok: false, error: 'ไม่รู้ว่าจะแนบกับรายการไหน' };
  if (!/^image\/(jpeg|png|webp|heic)$/.test(mimeType) && !(ownerType === 'incident' && mimeType === 'application/pdf')) return { ok: false, error: 'แนบได้เฉพาะรูปภาพ' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return { ok: false, error: 'ไฟล์ว่างหรือใหญ่เกิน 10 MB' };
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์เก็บรูปของฝ่าย' };
  return purLocked_(function () {
    var ss = sheBook_(dept), row = purRead_(ss, o.table).filter(function (x) { return x.id === ownerId; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var safe = purClean_(fileName, 100).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
    var prefix = ownerType === 'finding' ? (row.code || row.id) + '_' + (slot === 'before' ? 'ก่อน' : 'หลัง') : (row.date + '_' + row.id);
    var f = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mimeType, prefix + '_' + safe));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    var files = purParseFiles_(row[col]);
    var rec = { id: f.getId(), name: safe, mime: mimeType, url: 'https://drive.google.com/file/d/' + f.getId() + '/view', at: purNow_() };
    files.push(rec);
    row[col] = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, o.table, row);
    purLogWrite_(ss, 'แนบรูป', o.table, ownerId, slot + ' ' + safe);
    return { ok: true, file: rec, files: files };
  });
}
function sheRemoveFile(token, ownerType, ownerId, slot, fileId) {
  var dept = requireShe_(token);
  var o = SHE_FILE_SLOTS_[ownerType], col = o && o.slots[slot];
  if (!col) return { ok: false, error: 'ไม่รู้ว่าจะลบจากรายการไหน' };
  return purLocked_(function () {
    var ss = sheBook_(dept), row = purRead_(ss, o.table).filter(function (x) { return x.id === ownerId; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    var files = purParseFiles_(row[col]);
    if (!files.some(function (x) { return x.id === fileId; })) return { ok: false, error: 'ไม่พบรูป' };
    files = files.filter(function (x) { return x.id !== fileId; });
    row[col] = JSON.stringify(files); row.updatedAt = purNow_();
    purWrite_(ss, o.table, row);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    purLogWrite_(ss, 'ลบรูป', o.table, ownerId, slot);
    return { ok: true, files: files };
  });
}

// ---------- ตั้งค่า: พื้นที่ + หัวข้อตรวจ / รหัสแบบฟอร์ม / รายชื่อ ----------
// items = [{ id?, category, detail, active }] เรียงตามลำดับ · หัวข้อที่ไม่ส่งมา = ปิดใช้ (ผลตรวจเดิมยังอยู่)
function sheSaveArea(token, a, items) {
  var dept = requireShe_(token);
  a = a || {};
  var name = purClean_(a.name, 60);
  if (!name) return { ok: false, error: 'ระบุชื่อพื้นที่' };
  items = (Array.isArray(items) ? items : []).filter(function (x) { return x && sheText_(x.detail); }).slice(0, 40);
  if (!items.length) return { ok: false, error: 'ต้องมีหัวข้อตรวจอย่างน้อย 1 ข้อ' };
  return purLocked_(function () {
    var ss = sheBook_(dept), now = purNow_(), areas = purRead_(ss, 'she_areas');
    var row = a.id ? areas.filter(function (x) { return x.id === a.id; })[0] : null;
    if (a.id && !row) return { ok: false, error: 'ไม่พบพื้นที่' };
    if (areas.some(function (x) { return x.name === name && (!row || x.id !== row.id); })) return { ok: false, error: 'มีพื้นที่ชื่อนี้แล้ว' };
    var rec = row || { id: purId_('AR'), createdAt: now, order: areas.length + 1 };
    rec.name = name; rec.title = purClean_(a.title, 120) || 'แบบตรวจความปลอดภัย ' + name;
    rec.rounds = Math.max(1, Math.min(6, Math.round(Number(a.rounds) || 1)));
    if (a.order !== undefined && a.order !== '') rec.order = Math.round(Number(a.order) || rec.order);
    rec.active = a.active === 'ปิด' ? 'ปิด' : 'ใช้'; rec.updatedAt = now;
    purWrite_(ss, 'she_areas', rec);
    var old = purRead_(ss, 'she_items').filter(function (x) { return x.areaId === rec.id; }), keep = {};
    items.forEach(function (x, i) {
      var it = x.id ? old.filter(function (o) { return o.id === x.id; })[0] : null;
      var r = it || { id: purId_('IT'), areaId: rec.id };
      r.no = i + 1; r.category = purClean_(x.category, 80); r.detail = sheText_(x.detail, 300); r.active = x.active === 'ปิด' ? 'ปิด' : 'ใช้';
      keep[r.id] = 1;
      purWrite_(ss, 'she_items', r);
    });
    old.forEach(function (o) { if (!keep[o.id] && o.active !== 'ปิด') { o.active = 'ปิด'; purWrite_(ss, 'she_items', o); } });
    purLogWrite_(ss, row ? 'แก้พื้นที่ตรวจ' : 'เพิ่มพื้นที่ตรวจ', 'she_areas', rec.id, name + ' · ' + items.length + ' หัวข้อ · ' + rec.rounds + ' รอบ/วัน');
    return { ok: true, areas: sheAreasWithItems_(ss) };
  });
}
function sheSaveSettings(token, s) {
  var dept = requireShe_(token);
  s = s || {};
  return purLocked_(function () {
    var ss = sheBook_(dept), rows = purRead_(ss, 'she_settings'), changed = [];
    Object.keys(SHE_SETTINGS_DEFAULT_).forEach(function (k) {
      if (s[k] === undefined) return;
      var val = sheText_(s[k], 500), r = rows.filter(function (x) { return x.id === k; })[0];
      if (r && String(r.value) === val) return;
      purWrite_(ss, 'she_settings', r ? Object.assign(r, { value: val }) : { id: k, value: val });
      changed.push(k + '=' + val);
    });
    if (changed.length) purLogWrite_(ss, 'แก้ตั้งค่า', 'she_settings', '', changed.join(' · '));
    return { ok: true, settings: sheSettings_(ss) };
  });
}

// ---------- รายงาน ----------
// FM-SHE-01-06: ตารางรายเดือนของ 1 พื้นที่ (วันที่ 1–31 × รอบ) + ปัญหาที่พบ / แนวทางแก้ไข
function sheMonthReport(token, ym, areaId) {
  var dept = requireShe_(token);
  if (!/^\d{4}-\d{2}$/.test(String(ym))) return { ok: false, error: 'เลือกเดือน' };
  var ss = sheBook_(dept), area = sheAreasWithItems_(ss).filter(function (a) { return a.id === areaId; })[0];
  if (!area) return { ok: false, error: 'ไม่พบพื้นที่' };
  var checks = purRead_(ss, 'she_checks').filter(function (c) { return c.areaId === area.id && String(c.date).slice(0, 7) === ym; }).map(sheCheckOut_);
  var findings = purRead_(ss, 'she_findings').filter(function (f) { return f.areaId === area.id && String(f.date).slice(0, 7) === ym; }).map(sheFindingOut_);
  var used = {};
  checks.forEach(function (c) { Object.keys(c.results).forEach(function (k) { used[k] = 1; }); });
  return { ok: true, ym: ym, area: { id: area.id, name: area.name, title: area.title, rounds: area.rounds },
    items: area.items.filter(function (it) { return it.active !== 'ปิด' || used[it.id]; }),
    checks: checks, findings: findings, settings: sheSettings_(ss) };
}
// FM-SHE-01-05: ข้อบกพร่องในช่วงวันที่ (ตัวกรอง พื้นที่/สถานะ ทำที่หน้าเว็บ)
function sheFindingReport(token, from, to) {
  var dept = requireShe_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var ss = sheBook_(dept);
  return { ok: true, from: from, to: to, settings: sheSettings_(ss),
    findings: purRead_(ss, 'she_findings').filter(function (f) { return f.date >= from && f.date <= to; }).map(sheFindingOut_)
      .sort(function (a, b) { return String(a.date + a.code).localeCompare(String(b.date + b.code)); }) };
}
function sheLog(token, limit) {
  var dept = requireShe_(token), ss = sheBook_(dept);
  return { ok: true, rows: purRead_(ss, 'log').reverse().slice(0, Math.min(500, Number(limit) || 200)) };
}

// ---------- Dashboard (หน้าภาพรวมของฝ่าย + Dashboard ผู้บริหาร) ----------
function sheDashboard(token, from, to) {
  var dept = requireShe_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var d = sheDashboard_(dept, from, to);
  d.ok = true;
  return d;
}
function sheDashboard_(dept, from, to) {
  var ss = sheBook_(dept), today = purToday_(), areas = sheAreasWithItems_(ss);
  var activeAreas = areas.filter(function (a) { return a.active !== 'ปิด'; });
  var itemIdx = {}, areaIdx = {};
  areas.forEach(function (a) { areaIdx[a.id] = a; a.items.forEach(function (it) { itemIdx[it.id] = it; }); });
  var allChecks = purRead_(ss, 'she_checks').map(sheCheckOut_);
  var checks = allChecks.filter(function (c) { return c.date >= from && c.date <= to; });
  var findingsAll = purRead_(ss, 'she_findings').map(sheFindingOut_);
  var findings = findingsAll.filter(function (f) { return f.date >= from && f.date <= to; });
  var incAll = purRead_(ss, 'she_incidents');
  var inc = incAll.filter(function (x) { return x.date >= from && x.date <= to; });

  // การตรวจ: แผน (รอบต่อวัน × วัน ถึงวันนี้) เทียบที่ตรวจจริง · ผ่าน / ไม่ผ่าน
  var end = to < today ? to : today, nDays = end >= from ? sheDays_(from, end) + 1 : 0;
  var byArea = activeAreas.map(function (a) {
    var cs = checks.filter(function (c) { return c.areaId === a.id; });
    var P = 0, O = 0;
    cs.forEach(function (c) { Object.keys(c.results).forEach(function (k) { if (c.results[k] === 'P') P++; else if (c.results[k] === 'O') O++; }); });
    return { id: a.id, name: a.name, planned: a.rounds * nDays, done: cs.length, P: P, O: O, pass: P + O ? Math.round(P / (P + O) * 1000) / 10 : null };
  });
  var tot = byArea.reduce(function (s, a) { s.planned += a.planned; s.done += a.done; s.P += a.P; s.O += a.O; return s; }, { planned: 0, done: 0, P: 0, O: 0 });
  var catFail = {}, itemFail = {};
  checks.forEach(function (c) {
    Object.keys(c.results).forEach(function (k) {
      if (c.results[k] !== 'O') return;
      var it = itemIdx[k] || { category: 'อื่นๆ', detail: '' };
      catFail[it.category] = (catFail[it.category] || 0) + 1;
      var key = c.areaId + '|' + k;
      itemFail[key] = itemFail[key] || { area: (areaIdx[c.areaId] || {}).name || '', category: it.category, detail: it.detail, n: 0 };
      itemFail[key].n++;
    });
  });
  var sortObj = function (o) { return Object.keys(o).map(function (k) { return { name: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }); };

  // ข้อบกพร่อง
  var open = findingsAll.filter(function (f) { return f.status !== 'done'; });
  var overdue = open.filter(function (f) { return f.dueDate && f.dueDate < today; });
  var done = findings.filter(function (f) { return f.status === 'done'; });
  var closeDays = done.filter(function (f) { return f.doneDate; }).map(function (f) { return Math.max(0, sheDays_(f.date, f.doneDate)); });
  var cnt = function (arr, key, map) { var o = {}; arr.forEach(function (x) { var k = map ? (map[x[key]] || x[key] || '-') : (x[key] || '-'); o[k] = (o[k] || 0) + 1; }); return sortObj(o); };

  // อุบัติเหตุ: วันทำงานปลอดอุบัติเหตุ (นับจากอุบัติเหตุครั้งล่าสุดทุกช่วงเวลา)
  var accidents = incAll.filter(function (x) { return SHE_ACCIDENT_TYPES_[x.type]; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  var last = accidents[0] ? accidents[0].date : '';
  var lostDays = inc.reduce(function (s, x) { return s + (Number(x.lostDays) || 0); }, 0);

  // แนวโน้ม 6 เดือน
  var months = [], m0 = purToDate_(to.slice(0, 7) + '-01');
  for (var i = 5; i >= 0; i--) { var d = new Date(m0.getFullYear(), m0.getMonth() - i, 1); months.push(Utilities.formatDate(d, PUR_TZ_, 'yyyy-MM')); }
  var trend = months.map(function (ym) {
    var cs = allChecks.filter(function (c) { return String(c.date).slice(0, 7) === ym; }), P = 0, O = 0;
    cs.forEach(function (c) { Object.keys(c.results).forEach(function (k) { if (c.results[k] === 'P') P++; else if (c.results[k] === 'O') O++; }); });
    return { ym: ym, checks: cs.length, pass: P + O ? Math.round(P / (P + O) * 1000) / 10 : null,
      findings: findingsAll.filter(function (f) { return String(f.date).slice(0, 7) === ym; }).length,
      closed: findingsAll.filter(function (f) { return String(f.doneDate).slice(0, 7) === ym; }).length,
      incidents: incAll.filter(function (x) { return String(x.date).slice(0, 7) === ym && x.type !== 'near'; }).length,
      near: incAll.filter(function (x) { return String(x.date).slice(0, 7) === ym && x.type === 'near'; }).length };
  });

  // ข้อสังเกตสำหรับผู้บริหาร
  var insights = [];
  var compl = tot.planned ? Math.round(tot.done / tot.planned * 100) : null;
  if (compl !== null) insights.push({ level: compl >= 90 ? 'ok' : compl >= 70 ? 'warn' : 'bad', text: 'ตรวจตามแผน ' + tot.done + '/' + tot.planned + ' รอบ (' + compl + '%)' + (compl < 90 ? ' — ควรตรวจให้ครบทุกรอบ' : '') });
  byArea.filter(function (a) { return a.planned && a.done < a.planned * 0.7; }).forEach(function (a) { insights.push({ level: 'warn', text: 'พื้นที่ ' + a.name + ' ตรวจได้ ' + a.done + '/' + a.planned + ' รอบ' }); });
  var topItem = Object.keys(itemFail).map(function (k) { return itemFail[k]; }).sort(function (a, b) { return b.n - a.n; });
  if (topItem[0]) insights.push({ level: 'warn', text: 'ไม่ผ่านบ่อยสุด: ' + topItem[0].area + ' · ' + topItem[0].category + ' (' + topItem[0].n + ' ครั้ง)' });
  if (overdue.length) insights.push({ level: 'bad', text: 'ข้อบกพร่องเกินกำหนดแก้ไข ' + overdue.length + ' รายการ' });
  var highOpen = open.filter(function (f) { return f.risk === 'H'; });
  if (highOpen.length) insights.push({ level: 'bad', text: 'ความเสี่ยงสูงที่ยังไม่แก้ ' + highOpen.length + ' รายการ' });
  if (findings.length) insights.push({ level: done.length / findings.length >= 0.8 ? 'ok' : 'warn', text: 'แก้ไขเสร็จ ' + done.length + '/' + findings.length + ' รายการ (' + Math.round(done.length / findings.length * 100) + '%)' + (closeDays.length ? ' · เฉลี่ย ' + Math.round(closeDays.reduce(function (s, x) { return s + x; }, 0) / closeDays.length * 10) / 10 + ' วัน' : '') });
  var accIn = inc.filter(function (x) { return SHE_ACCIDENT_TYPES_[x.type]; });
  insights.push(accIn.length ? { level: 'bad', text: 'อุบัติเหตุ ' + accIn.length + ' ครั้ง' + (lostDays ? ' · หยุดงานรวม ' + lostDays + ' วัน' : '') }
    : { level: 'ok', text: 'ไม่มีอุบัติเหตุในช่วงนี้' + (last ? ' · ปลอดอุบัติเหตุมาแล้ว ' + sheDays_(last, today) + ' วัน' : '') });
  var near = inc.filter(function (x) { return x.type === 'near'; }).length;
  if (near) insights.push({ level: 'warn', text: 'เหตุการณ์เกือบเกิด (Near miss) ' + near + ' ครั้ง — ควรแก้ก่อนเกิดเหตุจริง' });

  var brief = function (f) { return { id: f.id, code: f.code, date: f.date, location: f.location, problem: f.problem, responsible: f.responsible, dueDate: f.dueDate, risk: f.risk, status: f.status,
    photo: (f.beforeFiles[0] || {}).id || '', after: (f.afterFiles[0] || {}).id || '' }; };
  return {
    from: from, to: to, today: today,
    inspect: { planned: tot.planned, done: tot.done, completion: compl, P: tot.P, O: tot.O, pass: tot.P + tot.O ? Math.round(tot.P / (tot.P + tot.O) * 1000) / 10 : null, byArea: byArea,
      byCategory: sortObj(catFail).slice(0, 8), topItems: topItem.slice(0, 6) },
    findings: { total: findings.length, open: open.length, progress: open.filter(function (f) { return f.status === 'progress'; }).length, done: done.length,
      overdue: overdue.length, highOpen: highOpen.length,
      avgCloseDays: closeDays.length ? Math.round(closeDays.reduce(function (s, x) { return s + x; }, 0) / closeDays.length * 10) / 10 : null,
      byArea: cnt(findings, 'location'), byRisk: cnt(findings, 'risk', SHE_RISK_), byCategory: cnt(findings, 'category').slice(0, 8),
      overdueList: overdue.sort(function (a, b) { return String(a.dueDate).localeCompare(String(b.dueDate)); }).slice(0, 15).map(brief),
      recent: findings.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 8).map(brief) },
    incidents: { total: inc.length, accidents: accIn.length, near: near, lostDays: lostDays, lastAccident: last, safeDays: last ? sheDays_(last, today) : null,
      byType: cnt(inc, 'type', SHE_INC_TYPES_),
      list: inc.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 10).map(function (x) {
        return { date: x.date, type: SHE_INC_TYPES_[x.type] || x.type, location: x.location, person: x.person, lostDays: x.lostDays, injury: x.injury };
      }) },
    trend: trend, insights: insights
  };
}
