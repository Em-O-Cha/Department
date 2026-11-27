// ==================== ผู้บริหาร: Dashboard ทุกฝ่าย (ดูอย่างเดียว) ====================
//
// เข้าด้วยการ์ด "ผู้บริหาร" (key EXEC) + รหัสผ่านของผู้บริหารเอง (ตั้งด้วยรหัสตั้งค่าจากผู้ดูแลระบบ เหมือนแผนก)
// ตั๋วผู้บริหารเรียกได้เฉพาะ execOverview / execDashboard — ฟังก์ชันแก้ไขข้อมูลของแผนก (pur*) ใช้ตั๋วนี้ไม่ได้
// ฝ่ายที่มีระบบข้อมูลแล้วจะมีตัวสรุปของฝ่ายนั้น (เช่น PUR = purDashboard_ ใน Purchasing.gs)

// ส่วนที่เพิ่มในหน้าฝ่ายภายหลัง ให้ขึ้นในหน้าผู้บริหารด้วย (ผู้ใช้ขอ 19/11/69): PUR ราคาปรับขึ้น · QA ค่าใช้จ่าย · ACC เปรียบเทียบ + สรุปรายเดือนทุกบริษัท
function execExtra_(d) { for (var i = 1; i < arguments.length; i++) { try { arguments[i](d); } catch (e) { d.extraError = (d.extraError ? d.extraError + ' · ' : '') + String(e.message || e); } } return d; }
// ตัวสรุปหลักของแต่ละฝ่าย (ขึ้นก่อน) + ส่วนเสริม (โหลดแยกทีละส่วนด้วย execPart · ผู้ใช้ขอ 22/11/69 ให้ค่อย ๆ ขึ้นจากบนลงล่าง ไม่ต้องรอทั้งหน้า)
var EXEC_BASE_ = { PUR: function (dept, from, to) { return purDashboard_(dept, from, to); },
  HR: function (dept, from, to) { return hrDashboard_(dept, from, to); },
  SHE: function (dept, from, to) { var d = sheDashboard_(dept, from, to); d.kind = 'safety'; return d; },
  QA: function (dept, from, to) { return qaDashboard_(dept, from, to); },
  ACC: function (dept, from, to) { return accDashboard_(dept, from, to, 'po', ''); },
  PROD: function (dept, from, to) { return prdDashboard_(dept, from, to); },
  RD: function (dept, from, to) { return rdDashboard_(dept, from, to); },
  COST: function () { return costDashData_(); } };
// ลำดับ = ลำดับที่แสดงในหน้า (บนลงล่าง)
var EXEC_PARTS_ = {
  PUR: [['rises', function (dept, from, to) { return purPriceReport_(purReadBook_(dept), from, to); }],
        ['vendorInfo', function (dept) { return purVendorDash_(purReadBook_(dept)); }]],
  QA: [['cost', function (dept) {
    var ss = qaReadBook_(dept);
    return { today: purToday_(), tests: purRead_(ss, 'qa_tests').map(function (t) { return { year: t.year, kind: t.kind, status: t.status, price: t.price, sentDate: t.sentDate, testType: t.testType, sample: t.sample, lab: t.lab }; }),
      complaints: purRead_(ss, 'qa_complaints').filter(function (c) { return Number(c.remedyCost) > 0; }).map(function (c) { return { recvDate: c.recvDate, remedyCost: c.remedyCost, product: c.product }; }) };
  }]],
  ACC: [['compare', function (dept) { return accCompareData_(dept); }],
        ['monthly', function (dept) { return accMonthlyData_(dept); }],
        ['payables', function (dept) { return apDashData_(dept); }]] };
// ของเดิม (หน้าเว็บเวอร์ชันเก่าที่ยังค้างในเครื่อง): ทุกส่วนในครั้งเดียว
var EXEC_DASHBOARDS_ = {};
Object.keys(EXEC_BASE_).forEach(function (k) {
  EXEC_DASHBOARDS_[k] = function (dept, from, to) {
    var d = EXEC_BASE_[k](dept, from, to);
    (EXEC_PARTS_[k] || []).forEach(function (p) { execExtra_(d, function (x) { x[p[0]] = p[1](dept, from, to); }); });
    return d;
  };
});

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

// ฝ่ายขาย = Meeting Dashboard (repo dashboard-meeting + meeting-dashboard/DashboardApi.gs) เปิดในกรอบหน้า Dashboard ผู้บริหาร
// หน้านั้นตรวจตั๋วผู้บริหารกับ execVerify (ไม่ต้องใส่รหัส Meeting Dashboard ซ้ำ)
var EXEC_SALES_ = { key: 'SALES', name: 'ฝ่ายขาย', en: 'Sales (Meeting Dashboard)', color: '#e11d48', ready: true,
  embed: 'https://em-o-cha.github.io/Dashboard-Meeting/?embed=exec' };
// ฝ่ายการตลาด = Marketing Command Center (apps-script/marketing-dashboard) เปิดในกรอบเหมือนฝ่ายขาย · ตรวจตั๋วผู้บริหารกับ execVerify (ดูอย่างเดียว)
var EXEC_MARKETING_ = { key: 'MKT', name: 'ฝ่ายการตลาด', en: 'Marketing Command Center', color: '#f97316', ready: true,
  embed: 'https://script.google.com/macros/s/AKfycbwD2aku-huwQA87WJlW3fIWUH4ghcQ2veJYTNmjuOcPS6BI-MkhyMlOdzadfS0EYOV46w/exec?embed=exec' };

// ต้นทุนสินค้า (COST) ใช้ชีตของ RD จนกว่าจะผูกชีตของตัวเอง
function execCfgKey_(key) { return key === 'COST' ? costHome_().key : key; }

// รายชื่อฝ่าย + ฝ่ายไหนมี Dashboard แล้ว
function execOverview(token) {
  requireExec_(token);
  return { ok: true, depts: [EXEC_SALES_, EXEC_MARKETING_].concat(activeDepartments_().filter(function (d) { return !d.exec && !d.noExec; }).map(function (d) {
    return { key: d.key, name: d.name, en: d.en, color: d.color, ready: !!EXEC_DASHBOARDS_[d.key] && !!deptConfig_(execCfgKey_(d.key)).sheetId };
  })) };
}

// ใช้โดย Meeting Dashboard (ฝั่ง Apps Script) ตรวจว่าตั๋วนี้เป็นของผู้บริหารที่ยังเข้าระบบอยู่
function execVerify(token) {
  requireExec_(token);
  return { ok: true };
}

// Dashboard ของฝ่ายที่เลือก ในช่วงวันที่
function execDashboard(token, deptKey, from, to, lite) {
  requireExec_(token);
  var r = execRange_(from, to);
  var dept = findDept_(deptKey);
  if (!dept || dept.exec) return { ok: false, error: 'ไม่พบฝ่าย' };
  var fn = lite ? EXEC_BASE_[dept.key] : EXEC_DASHBOARDS_[dept.key];
  if (!fn) return { ok: true, ready: false, message: 'ฝ่ายนี้ยังไม่มีระบบเก็บข้อมูล — Dashboard จะขึ้นเมื่อทำระบบของฝ่ายนี้แล้ว' };
  if (!deptConfig_(execCfgKey_(dept.key)).sheetId) return { ok: true, ready: false, message: 'ฝ่ายนี้ยังไม่ได้เชื่อม Google Sheet' };
  var data = fn(dept, r.from, r.to);
  data.ok = true; data.ready = true; data.from = r.from; data.to = r.to;
  if (lite) data.parts = (EXEC_PARTS_[dept.key] || []).map(function (p) { return p[0]; });
  return data;
}
// ส่วนเสริมทีละส่วน (หน้าเว็บเรียกต่อจาก execDashboard แบบ lite)
function execPart(token, deptKey, part, from, to) {
  requireExec_(token);
  var r = execRange_(from, to), dept = findDept_(deptKey);
  if (!dept || dept.exec) return { ok: false, error: 'ไม่พบฝ่าย' };
  var p = (EXEC_PARTS_[dept.key] || []).filter(function (x) { return x[0] === part; })[0];
  if (!p) return { ok: false, error: 'ไม่พบส่วนข้อมูล' };
  try { return { ok: true, part: part, data: p[1](dept, r.from, r.to) }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}
