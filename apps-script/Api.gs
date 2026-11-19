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
    purSaveVendor: purSaveVendor, purImportVendors: purImportVendors, purSaveMaterial: purSaveMaterial, purSavePrice: purSavePrice, purDeletePrice: purDeletePrice, purPriceHistory: purPriceHistory,
    purSaveDoc: purSaveDoc, purSaveMove: purSaveMove, purDeleteMove: purDeleteMove,
    purUploadFile: purUploadFile, purRemoveFile: purRemoveFile, purLog: purLog,
    // ตรวจ 3 ทาง / เปรียบเทียบราคา / บริหารคู่ค้า (PurchasingPlus.gs)
    purDeleteDoc: purDeleteDoc, purSaveInvoice: purSaveInvoice, purDeleteInvoice: purDeleteInvoice,
    purSaveRfq: purSaveRfq, purDeleteRfq: purDeleteRfq, purSaveQuote: purSaveQuote, purDeleteQuote: purDeleteQuote, purDecideRfq: purDecideRfq,
    purVendorMetrics: purVendorMetrics, purSaveEval: purSaveEval, purDeleteEval: purDeleteEval, purVendorReport: purVendorReport,
    // ความปลอดภัยและสิ่งแวดล้อม (She.gs)
    sheLoad: sheLoad, sheChecks: sheChecks, sheSaveCheck: sheSaveCheck, sheDeleteCheck: sheDeleteCheck, sheSaveFinding: sheSaveFinding, sheDeleteFinding: sheDeleteFinding, sheMergeFindings: sheMergeFindings,
    sheSaveIncident: sheSaveIncident, sheDeleteIncident: sheDeleteIncident, sheUploadFile: sheUploadFile, sheRemoveFile: sheRemoveFile,
    sheSaveArea: sheSaveArea, sheSaveSettings: sheSaveSettings, sheMonthReport: sheMonthReport, sheFindingReport: sheFindingReport,
    sheDashboard: sheDashboard, sheLog: sheLog,
    // ฝ่ายบุคคล (Hr.gs)
    hrLoad: hrLoad, hrPhotos: hrPhotos, hrSaveEmp: hrSaveEmp, hrDeleteEmp: hrDeleteEmp, hrSaveDoc: hrSaveDoc, hrSaveLeave: hrSaveLeave,
    hrSaveTraining: hrSaveTraining, hrSaveDisc: hrSaveDisc, hrDeleteRow: hrDeleteRow, hrUploadFile: hrUploadFile, hrRemoveFile: hrRemoveFile,
    hrSaveSettings: hrSaveSettings, hrDailyLoad: hrDailyLoad, hrDailySave: hrDailySave, hrDailySaveRoles: hrDailySaveRoles, hrDailySendLine: hrDailySendLine, hrDailyLineInfo: hrDailyLineInfo, hrDailyLineTest: hrDailyLineTest, hrLeaves: hrLeaves, hrLog: hrLog, hrDashboard: hrDashboard, hrDecideLeave: hrDecideLeave,
    hrFormInfo: hrFormInfo, hrSetLineToken: hrSetLineToken, accCompare: accCompare, exLoad: exLoad, exCheck: exCheck, exSave: exSave, exUpdate: exUpdate, exDelete: exDelete, exMakeFiles: exMakeFiles, exSendLine: exSendLine, hrApproverCode: hrApproverCode, hrApproverList: hrApproverList, hrRemoveApprover: hrRemoveApprover, hrFormNewKey: hrFormNewKey, hrLineTest: hrLineTest,
    // แบบฟอร์มขอลาของพนักงาน (HrPublic.gs) — ใช้รหัสแบบฟอร์มแทนตั๋ว
    hrTimeInit: hrTimeInit, hrTimeList: hrTimeList, hrTimeSave: hrTimeSave, hrTimeEdit: hrTimeEdit, hrJobs: hrJobs, hrSaveJob: hrSaveJob, hrDeleteJob: hrDeleteJob, hrFormInit: hrFormInit, hrFormFind: hrFormFind, hrFormPhotos: hrFormPhotos, hrFormBalance: hrFormBalance, hrFormSubmit: hrFormSubmit, hrFormUpload: hrFormUpload,
    // ฝ่ายบัญชี — รายงานรับออเดอร์ 7-11 (Acc.gs)
    accLoad: accLoad, cpLoad: cpLoad, cpSetSheet: cpSetSheet, cpPreview: cpPreview, cpSave: cpSave, cpSaveMap: cpSaveMap, cpUpdateLine: cpUpdateLine, cpRebuild: cpRebuild, cpSendLine: cpSendLine, cpSendMoveLine: cpSendMoveLine, cpMakeImportFiles: cpMakeImportFiles, cpMonthFiles: cpMonthFiles, acc711Preview: acc711Preview, acc711Save: acc711Save, acc711DeleteImport: acc711DeleteImport, acc711Report: acc711Report,
    acc711Pdf: acc711Pdf, acc711SendLine: acc711SendLine, accLineTest: accLineTest, accLineDiag: accLineDiag, accSaveMap: accSaveMap, accUploadProductImage: accUploadProductImage, accDashboard: accDashboard,
    // ฝ่ายประกันคุณภาพ — ข้อร้องเรียนลูกค้า (Qa.gs)
    qaLoad: qaLoad, qaSave: qaSave, qaDelete: qaDelete, qaUploadFile: qaUploadFile, qaRemoveFile: qaRemoveFile, qaSaveSettings: qaSaveSettings,
    qaLog: qaLog, qaDashboard: qaDashboard, qaSaveTest: qaSaveTest, qaDeleteTest: qaDeleteTest, qaSaveNewProd: qaSaveNewProd, qaDeleteNewProd: qaDeleteNewProd,
    // ฝ่ายผลิต (Prod.gs)
    rdLoad: rdLoad, rdSaveProduct: rdSaveProduct, rdDeleteProduct: rdDeleteProduct, rdSavePartner: rdSavePartner, rdDeletePartner: rdDeletePartner,
    rdSaveSettings: rdSaveSettings, rdLog: rdLog, rdDashboard: rdDashboard,
    rdSaveTrial: rdSaveTrial, rdDeleteTrial: rdDeleteTrial, rdUploadTrialPhoto: rdUploadTrialPhoto, rdRemoveTrialPhoto: rdRemoveTrialPhoto,
    prdLoad: prdLoad, prdSaveProduct: prdSaveProduct, prdSavePlans: prdSavePlans, prdDeletePlan: prdDeletePlan, prdSaveBreakdown: prdSaveBreakdown, prdUploadBdPhoto: prdUploadBdPhoto, prdRemoveBdPhoto: prdRemoveBdPhoto,
    prdDeleteBreakdown: prdDeleteBreakdown, prdSaveReport: prdSaveReport, prdUploadPhoto: prdUploadPhoto, prdRemovePhoto: prdRemovePhoto,
    prdSaveSettings: prdSaveSettings, prdLog: prdLog, prdDashboard: prdDashboard, prdSendLine: prdSendLine, prdLinePreview: prdLinePreview, prdLineTest: prdLineTest, prdSetLineToken: prdSetLineToken, prdUseAccBot: prdUseAccBot,
    // ผู้บริหาร (Executive.gs)
    execOverview: execOverview, execDashboard: execDashboard, execVerify: execVerify
  };
}

function lineFreshEvents_(events) {
  var c = CacheService.getScriptCache();
  return events.filter(function (ev) {
    if (ev && ev.deliveryContext && ev.deliveryContext.isRedelivery) return false;
    var id = ev && ev.webhookEventId;
    if (!id) return true;
    if (c.get('lev_' + id)) return false;
    c.put('lev_' + id, '1', 21600);
    return true;
  });
}
function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (Array.isArray(req.events)) {
      // LINE ส่งเหตุการณ์ซ้ำ (redelivery) เพราะเว็บแอปตอบกลับเป็น redirect → ข้ามเหตุการณ์ที่เคยทำแล้ว ไม่ให้ตอบ/ทำซ้ำ
      req.events = lineFreshEvents_(req.events);   // Webhook ของ LINE OA: ฝ่ายบัญชี (Acc.gs) แยกด้วย destination ไม่ใช่ = ฝ่ายบุคคล (HrPublic.gs)
      var isAcc = accIsMyBot_(req.destination), isPrd = prdIsMyBot_(req.destination);
      if (req.events.length) accDiagLog_({ ev: 'webhook', acc: isAcc, prd: isPrd, types: req.events.map(function (x) { return x.type + (x.source ? '/' + x.source.type : ''); }).join(',') });
      // ฝ่ายผลิต (Prod.gs) ใช้ OA ของตัวเอง หรือใช้ OA เดียวกับฝ่ายบัญชีก็ได้ (แยกด้วยคำว่า "ผลิต" ในคำสั่ง)
      // ฝ่ายบุคคล (HrDaily.gs) ส่งเช็คพนักงานผ่านบอทฝ่ายบัญชีเข้ากลุ่มเดียวกับฝ่ายบัญชี — ไม่มีคำสั่งผูกกลุ่มของตัวเอง
      if (isPrd && !isAcc) prdLineWebhook_(req.events);
      else if (isAcc && isPrd) { prdLineWebhook_(req.events.filter(prdIsCommand_), true); accLineWebhook_(req.events.filter(function (x) { return !prdIsCommand_(x); })); }
      else if (isAcc) accLineWebhook_(req.events);
      else hrLineWebhook_(req.events);
      return ContentService.createTextOutput('OK');
    }
    var fns = apiFunctions_(), fn = String(req.fn || '');
    if (!Object.prototype.hasOwnProperty.call(fns, fn)) throw new Error('ไม่รองรับคำสั่งนี้');
    var args = Array.isArray(req.args) ? req.args.slice(0, 8) : [];
    out = { ok: true, val: fns[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, err: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
