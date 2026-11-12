// ==================== API สำหรับหน้าเว็บบน GitHub Pages ====================
//
// หน้าเว็บจริงอยู่ที่ https://em-o-cha.github.io/Department/ (repo Em-O-Cha/Department, ไฟล์ index.html)
// เพื่อไม่ให้มีแถบ "แอปพลิเคชันนี้สร้างโดยผู้ใช้ Google Apps Script" — หน้านั้นเรียกฟังก์ชันที่นี่ผ่าน POST
//   body (text/plain): {"fn": "login", "args": ["HR", "รหัสผ่าน"]}
//   ตอบกลับ: {"ok": true, "val": ...} หรือ {"ok": false, "err": "ข้อความ"}
// เรียกได้เฉพาะฟังก์ชันในรายการด้านล่าง · การตรวจรหัส/ตั๋ว/ล็อก อยู่ในตัวฟังก์ชันเองเหมือนเดิม
var APP_PAGE_URL = 'https://em-o-cha.github.io/Department/';

function apiFunctions_() {
  return {
    getDepartments: getDepartments, login: login, logout: logout, getDepartmentHome: getDepartmentHome,
    deptSetPasswordWithCode: deptSetPasswordWithCode, changeMyPassword: changeMyPassword,
    getAdminStatus: getAdminStatus, adminSendEmailCode: adminSendEmailCode, adminSetPasswordWithEmailCode: adminSetPasswordWithEmailCode,
    adminLogin: adminLogin, adminChangePassword: adminChangePassword, adminOverview: adminOverview,
    adminIssueDeptCode: adminIssueDeptCode, adminCancelDeptCode: adminCancelDeptCode, adminUnlockDept: adminUnlockDept,
    adminSetDeptLinks: adminSetDeptLinks,
    // จัดซื้อ & สต๊อก (Purchasing.gs)
    purLoad: purLoad, purMoves: purMoves, purReport: purReport, purStockReport: purStockReport, purPriceReport: purPriceReport,
    purSaveVendor: purSaveVendor, purSaveMaterial: purSaveMaterial, purSavePrice: purSavePrice, purDeletePrice: purDeletePrice, purPriceHistory: purPriceHistory,
    purSaveDoc: purSaveDoc, purSaveMove: purSaveMove, purDeleteMove: purDeleteMove,
    purUploadFile: purUploadFile, purRemoveFile: purRemoveFile, purLog: purLog,
    // ตรวจ 3 ทาง / เปรียบเทียบราคา / บริหารคู่ค้า (PurchasingPlus.gs)
    purDeleteDoc: purDeleteDoc, purSaveInvoice: purSaveInvoice, purDeleteInvoice: purDeleteInvoice,
    purSaveRfq: purSaveRfq, purDeleteRfq: purDeleteRfq, purSaveQuote: purSaveQuote, purDeleteQuote: purDeleteQuote, purDecideRfq: purDecideRfq,
    purVendorMetrics: purVendorMetrics, purSaveEval: purSaveEval, purDeleteEval: purDeleteEval, purVendorReport: purVendorReport,
    // ความปลอดภัยและสิ่งแวดล้อม (She.gs)
    sheLoad: sheLoad, sheSaveCheck: sheSaveCheck, sheDeleteCheck: sheDeleteCheck, sheSaveFinding: sheSaveFinding, sheDeleteFinding: sheDeleteFinding,
    sheSaveIncident: sheSaveIncident, sheDeleteIncident: sheDeleteIncident, sheUploadFile: sheUploadFile, sheRemoveFile: sheRemoveFile,
    sheSaveArea: sheSaveArea, sheSaveSettings: sheSaveSettings, sheMonthReport: sheMonthReport, sheFindingReport: sheFindingReport,
    sheDashboard: sheDashboard, sheLog: sheLog,
    // ผู้บริหาร (Executive.gs)
    execOverview: execOverview, execDashboard: execDashboard, execVerify: execVerify
  };
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fns = apiFunctions_(), fn = String(req.fn || '');
    if (!Object.prototype.hasOwnProperty.call(fns, fn)) throw new Error('ไม่รองรับคำสั่งนี้');
    var args = Array.isArray(req.args) ? req.args.slice(0, 8) : [];
    out = { ok: true, val: fns[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, err: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
