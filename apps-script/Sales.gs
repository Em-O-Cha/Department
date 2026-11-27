// ==================== ฝ่ายขาย (SALES) — เปิดระบบ Revenue Spunky Online + ระบบสต๊อก Stock Flow ในหน้าเดียวกัน (ผู้ใช้ขอ 27/11/69) ====================
// ระบบเดิมยังทำงานเหมือนเดิม ข้อมูลอยู่ที่เดิม (โปรเจกต์ revenue-spunky) · การ์ดนี้มีรหัสผ่านของฝ่ายเอง
// ลิงก์ระบบ / ชีต อยู่ใน SalesUrl.gs (ไม่คัดลอกไป repo สาธารณะ) — คืนให้เฉพาะตั๋วของฝ่ายขาย
function salesInfo(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'sales') throw new Error('แผนกนี้ไม่มีระบบงานขาย');
  var url = typeof SALES_APP_URL_ !== 'undefined' ? SALES_APP_URL_ : '';
  if (!url) return { ok: false, error: 'ยังไม่ได้ตั้งลิงก์ระบบ Revenue Spunky Online' };
  return { ok: true, url: url, stockUrl: typeof SALES_STOCK_URL_ !== 'undefined' ? SALES_STOCK_URL_ : '' };
}
function salesSheetLinks_() {
  return typeof SALES_SHEETS_ !== 'undefined' ? SALES_SHEETS_.map(function (s) { return { label: s.label, url: 'https://docs.google.com/spreadsheets/d/' + s.id + '/edit' }; }) : [];
}
