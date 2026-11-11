// ==================== ผู้บริหาร: Dashboard ทุกฝ่าย (ดูอย่างเดียว) ====================
//
// เข้าด้วยการ์ด "ผู้บริหาร" (key EXEC) + รหัสผ่านของผู้บริหารเอง (ตั้งด้วยรหัสตั้งค่าจากผู้ดูแลระบบ เหมือนแผนก)
// ตั๋วผู้บริหารเรียกได้เฉพาะ execOverview / execDashboard — ฟังก์ชันแก้ไขข้อมูลของแผนก (pur*) ใช้ตั๋วนี้ไม่ได้
// ฝ่ายที่มีระบบข้อมูลแล้วจะมีตัวสรุปของฝ่ายนั้น (เช่น PUR = purDashboard_ ใน Purchasing.gs)

var EXEC_DASHBOARDS_ = { PUR: function (dept, from, to) { return purDashboard_(dept, from, to); } };

function requireExec_(token) {
  var d = requireDept_(token);
  if (!d.exec) throw new Error('สำหรับผู้บริหารเท่านั้น');
  return d;
}
function execRange_(from, to) {
  var re = /^\d{4}-\d{2}-\d{2}$/;
  from = re.test(String(from)) ? String(from) : ''; to = re.test(String(to)) ? String(to) : '';
  if (!from || !to || from > to) throw new Error('เลือกช่วงวันที่ให้ถูกต้อง');
  return { from: from, to: to };
}

// รายชื่อฝ่าย + ฝ่ายไหนมี Dashboard แล้ว
function execOverview(token) {
  requireExec_(token);
  return { ok: true, depts: activeDepartments_().filter(function (d) { return !d.exec; }).map(function (d) {
    return { key: d.key, name: d.name, en: d.en, color: d.color, ready: !!EXEC_DASHBOARDS_[d.key] && !!deptConfig_(d.key).sheetId };
  }) };
}

// Dashboard ของฝ่ายที่เลือก ในช่วงวันที่
function execDashboard(token, deptKey, from, to) {
  requireExec_(token);
  var r = execRange_(from, to);
  var dept = findDept_(deptKey);
  if (!dept || dept.exec) return { ok: false, error: 'ไม่พบฝ่าย' };
  var fn = EXEC_DASHBOARDS_[dept.key];
  if (!fn) return { ok: true, ready: false, message: 'ฝ่ายนี้ยังไม่มีระบบเก็บข้อมูล — Dashboard จะขึ้นเมื่อทำระบบของฝ่ายนี้แล้ว' };
  if (!deptConfig_(dept.key).sheetId) return { ok: true, ready: false, message: 'ฝ่ายนี้ยังไม่ได้เชื่อม Google Sheet' };
  var data = fn(dept, r.from, r.to);
  data.ok = true; data.ready = true; data.from = r.from; data.to = r.to;
  return data;
}
