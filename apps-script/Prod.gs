// ==================== ฝ่ายผลิต (PROD) — แผนผลิตประจำวัน · Yield · ของเสีย · Breakdown · ส่ง LINE ====================
//
// ข้อมูลเก็บใน Google Sheet ของฝ่าย (ตั้งลิงก์ในหน้าผู้ดูแลระบบ) · รูปเก็บในโฟลเดอร์ Drive ของฝ่าย (โฟลเดอร์ย่อย "รูปรายงานผลิต")
// กลุ่มงาน: G2 = งานผัด · G1 = งานบรรจุลงซอง/ถ้วย · G3 = งานบรรจุลงลัง
// 1 รายการแผน (แท็บ "แผนผลิต") = สินค้า 1 ตัว ของกลุ่มงาน 1 กลุ่ม ในวันผลิต 1 วัน: แผน (batch / จำนวน / LOT / กำหนดส่ง) + ผลจริง
//   G2: น้ำหนักวัตถุดิบ / หลังผัด / หลังทำเย็น → Yield = หลังทำเย็น ÷ วัตถุดิบ × 100 (ไม่กรอกหลังทำเย็น ใช้หลังผัดแทน) · %Lost = 100 − Yield
//       จำนวนที่ผลิตได้จริง เทียบช่วงมาตรฐานต่อ batch × จำนวน batch (แท็บ "สินค้า (Yield)")
//   ทุกกลุ่ม: ของเสีย (กก. / ชิ้น) · วันที่เสร็จ เทียบกำหนดส่ง = ทันเวลาจัดส่งหรือไม่
// Breakdown (แท็บ "Breakdown เครื่องจักร"): เครื่อง · เวลาเริ่ม–จบ · ปัญหา · การแก้ไข
// LINE (OA ของฝ่ายผลิต — Script Properties PROD_LINE_TOKEN / PROD_LINE_GROUP ผูกด้วยการพิมพ์ "ตั้งค่ากลุ่ม ผลิต <รหัส>" ในกลุ่ม):
//   เช้า = แผนผลิตทั้งวัน 1 การ์ด · เย็น = สรุปแยกกลุ่ม G1 / G2 / G3 (คนที่กรอกกดส่งเอง) + รูปส่งแยกเป็นภาพ ๆ
// ใช้ตัวอ่าน/เขียนชีตของ Purchasing.gs · ทุกฟังก์ชันต้องมีตั๋วของฝ่ายผลิต (requirePrd_)

var PRD_TABLES_ = {
  prd_products: { tab: 'สินค้า (Yield)', cols: [
    ['id', 'รหัส'], ['category', 'หมวด'], ['name', 'ชื่อสินค้า'], ['rawKg', 'น้ำหนักวัตถุดิบต่อ batch (กก.)'], ['qtyMin', 'จำนวนที่ควรได้ต่อ batch (ต่ำสุด)'],
    ['qtyMax', 'จำนวนที่ควรได้ต่อ batch (สูงสุด)'], ['unit', 'หน่วย'], ['target', 'Yield ขั้นต่ำ (%)'], ['active', 'ใช้งาน'], ['sort', 'ลำดับ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prd_plans: { tab: 'แผนผลิต', cols: [
    ['id', 'รหัส'], ['date', 'วันผลิต'], ['grp', 'กลุ่มงาน'], ['productId', 'รหัสสินค้า'], ['product', 'สินค้า'], ['lot', 'LOT / วันที่ผลิต'],
    ['planBatch', 'แผน (batch)'], ['planQty', 'แผน (จำนวน)'], ['dueDate', 'กำหนดส่ง'],
    ['actBatch', 'ทำจริง (batch)'], ['rawKg', 'น้ำหนักวัตถุดิบ (กก.)'], ['fryKg', 'น้ำหนักหลังผัด (กก.)'], ['coolKg', 'น้ำหนักหลังทำเย็น (กก.)'],
    ['yieldPct', 'Yield (%)'], ['lossPct', '% Lost'], ['actQty', 'จำนวนที่ได้จริง'], ['unit', 'หน่วย'], ['actCases', 'จำนวนลัง'], ['expMin', 'ควรได้ (ต่ำสุด)'], ['expMax', 'ควรได้ (สูงสุด)'],
    ['lossKg', 'ของเสีย (กก.)'], ['lossQty', 'ของเสีย (ชิ้น)'], ['lossNote', 'สาเหตุของเสีย'], ['finishDate', 'วันที่เสร็จ'], ['lateCause', 'สาเหตุเสร็จช้ากว่ากำหนด'], ['status', 'สถานะ'], ['note', 'หมายเหตุ'],
    ['by', 'ผู้บันทึก'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prd_reports: { tab: 'รายงาน LINE', cols: [
    ['id', 'รหัส'], ['date', 'วันที่'], ['kind', 'รอบ'], ['grp', 'กลุ่มงาน'], ['title', 'หัวข้อข้อความ'], ['sections', 'หัวข้อเพิ่มเติม'], ['problems', 'ปัญหาที่พบ'], ['checks', 'ปิดงาน (ปิดน้ำ/ไฟ/แอร์)'], ['note', 'หมายเหตุ'],
    ['files', 'รูป'], ['sentAt', 'ส่ง LINE เมื่อ'], ['by', 'ผู้ส่ง'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prd_breakdowns: { tab: 'Breakdown เครื่องจักร', cols: [
    ['id', 'รหัส'], ['date', 'วันที่'], ['grp', 'กลุ่มงาน'], ['machine', 'เครื่องจักร / อุปกรณ์'], ['start', 'เวลาเริ่ม'], ['end', 'เวลาจบ'], ['minutes', 'เวลาที่เสีย (นาที)'],
    ['problem', 'ปัญหา'], ['fix', 'การแก้ไข'], ['by', 'ผู้บันทึก'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prd_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] }
};
var PRD_GROUPS_ = { G2: 'งานผัด', G1: 'งานบรรจุลงซอง/ถ้วย', G3: 'งานบรรจุลงลัง' };
// หัวข้อข้อความตอนเย็น (ค่าเริ่มต้น · แก้ได้ในหน้าสรุปเย็น)
var PRD_EVE_TITLE_ = { G2: 'สรุปงานเตรียม/ทอด/ผัด/อบ', G1: 'สรุปงานบรรจุ', G3: 'สรุปงานบรรจุ' };
var PRD_MOR_LABEL_ = { G2: 'งานเตรียมวัตถุดิบ/ทอด/ผัด/อบ', G1: 'งานบรรจุลงซอง/ถ้วย', G3: 'งานบรรจุลงลัง' };
var PRD_EVE_SEC_ = { G2: 'งานผัด/งานอบ/ทำเย็น', G1: 'งานบรรจุ', G3: 'ยอดสินค้าบรรจุลงลัง' };
var PRD_STATUS_ = { plan: 'ตามแผน', done: 'เสร็จแล้ว', cancel: 'ยกเลิก' };
var PRD_SETTINGS_DEFAULT_ = {
  target: '85', machines: '', people: '', units: 'ซอง, ถ้วย, กระปุก, ขวด, ชิ้น',
  checks: 'ปิดน้ำ, ปิดไฟ, ปิดแอร์', sectionTitles: 'เตรียมวัตถุดิบ, สรุปงานลงถ้วย, สรุปงานลงซอง, น้ำพริกค้างแพ็ค, หมายเหตุ', morningNote: 'ไลน์ผลิตและบรรจุเลิก 20.00', lateCauses: 'Breakdown เครื่องจักร, วัตถุดิบไม่พอ / มาช้า, คนไม่พอ, งานแทรก / เปลี่ยนแผน', lossCauses: 'ไหม้ / สุกเกิน, หกหล่น, ซีลไม่ติด / ซองรั่ว, น้ำหนักไม่ได้, สิ่งแปลกปลอม, อื่น ๆ'
};

var PRD_PRODUCT_SEED_ = [   // [หมวด, ชื่อสินค้า, น้ำหนักวัตถุดิบต่อ batch (kg), จำนวนที่ควรได้ต่ำสุด, สูงสุด] — จากไฟล์ Yield 02.11.2026
  ["น้ำพริก 4 ภาค", "น้ำพริกปลาทูกรอบ", 13.48, 530, 540],
  ["น้ำพริก 4 ภาค", "น้ำพริกปลาร้ากรอบ", 11.075, 420, 430],
  ["น้ำพริก 4 ภาค", "น้ำพริกอ่องกรอบ", 12.05, 490, 500],
  ["น้ำพริก 4 ภาค", "น้ำพริกกะปิกรอบ", 13.249, 540, 550],
  ["น้ำพริก 7-11", "น้ำพริกน้ำย้อย", 10.14, 450, 460],
  ["น้ำพริก 7-11", "น้ำพริกลงเรือกรอบ", 11.81, 500, 510],
  ["น้ำพริก 7-11", "น้ำพริกตะไคร้หอม", 12.8, 520, 530],
  ["น้ำพริก 7-11", "น้ำพริกปลาดุกฟูผัดพริกขิง", 11.472, 270, 280],
  ["น้ำพริก 7-11", "น้ำพริกไก่หยองกรอบ", 12.795, 300, 310],
  ["น้ำพริก 7-11", "น้ำพริกปลาซิวแก้วคั่วสมุนไพร", 11.37, 250, 260],
  ["น้ำพริก 7-11", "น้ำพริกปลาแซลมอนคั่วกรอบ 35 กรัม", 13.553, 350, 360],
  ["น้ำพริก 7-11", "น้ำพริกหมึกย่างสามรส", 12.3, 340, 350],
  ["น้ำพริก 7-11", "น้ำพริก รสผัดพริกขิงเจ", 11.976, 470, 480],
  ["น้ำพริก 7-11", "น้ำพริก รสต้มยำเจ", 11.994, 530, 540],
  ["น้ำพริก 7-11", "น้ำพริกฟองเต้าหู้ รสผัดพริกเผา", 12.32, 510, 520],
  ["น้ำพริก 7-11", "น้ำพริกฟองเต้าหู้ รสหม่าล่า", 12.886, 520, 530],
  ["น้ำพริก 7-11", "น้ำพริกฟองเต้าหู้ รสซอสเผ็ดสไตล์เกาหลี", 12.98, 530, 540],
  ["น้ำพริก 7-11", "น้ำพริกเต้าหู้ทอดผัดพริกขิง", 15.398, 350, 350],
  ["น้ำพริก 7-11", "น้ำพริกเต้าหู้ทอดผัดพริกแกงใต้", 17.085, 410, 410],
  ["น้ำพริก 7-11", "น้ำพริกอบกรอบรสแซ่บ", 12.25, 910, 920],
  ["น้ำพริก 7-11", "หอมเจียวทรงเครื่อง", 12.814, 180, 180],
  ["น้ำพริก 7-11", "น้ำพริกปลาแซลมอนคั่วกรอบ 80 กรัม", 13.553, 150, 160],
  ["น้ำพริก 7-11", "น้ำพริกปลาแซลมอนรสต้มยำ", 14.33, 620, 630],
  ["น้ำพริก 7-11", "น้ำพริกปลาแซลมอนรสคั่วกลิ้ง", 16.75, 700, 710],
  ["น้ำพริก 7-11", "น้ำพริกปลาแซลมอนรสผัดฉ่า", 16.483, 680, 690],
  ["น้ำพริก 7-11", "น้ำพริกหนังปลาแซลมอนกรอบ 10g.", 14.25, 1330, 1335],
  ["น้ำพริก 7-11", "น้ำพริกหนังปลาแซลมอนกรอบ 70g.", 13.436, 186, 190],
  ["น้ำพริก 7-11", "น้ำพริกปูอัดกรอบ 70g.", 14.998, 200, 205],
  ["น้ำพริก 7-11", "น้ำพริกหนังไก่กรอบรสแซ่บ", 13.082, 850, 860],
  ["พริกในน้ำมัน", "พริกในน้ำมัน สูตรดั้งเดิม", 16.137, 66, 66],
  ["พริกในน้ำมัน", "พริกในน้ำมัน สูตรเผ็ด", 16.407, 70, 70],
  ["พริกในน้ำมัน", "พริกในน้ำมัน สูตรตะไคร้", 17.4, 94, 94],
  ["พริกในน้ำมัน", "พริกในน้ำมัน สูตรน้ำย้อย", 17.136, 94, 94],
  ["พริกในน้ำมัน", "พริกผัดน้ำมันมะกอกอัลมอนด์", 16.968, 137, 137],
  ["Furikake", "สาหร่ายโรยข้าว (71 g)", 6.304, 87, 87],
  ["Furikake", "สาหร่ายโรยข้าว (500 g)", 6.304, 12.5, 12.5],
  ["Furikake", "สาหร่ายโรยข้าวรสยูซุ (71 g)", 6.64, 88, 88],
  ["Furikake", "สาหร่ายโรยข้าวรสยูซุ (500 g)", 6.64, 13, 13],
  ["Furikake", "สาหร่ายโรยข้าวรสวาซาบิ (71 g)", 6.562, 87, 87],
  ["Furikake", "สาหร่ายโรยข้าวรสวาซาบิ (500 g)", 6.562, 13, 13],
  ["Furikake", "สาหร่ายโรยข้าว สาหร่ายปรุงรส (71 g)", 6.92, 94, 94],
  ["Furikake", "สาหร่ายโรยข้าว สาหร่ายปรุงรส (500 g)", 6.92, 13.5, 13.5],
  ["Furikake", "สาหร่ายโรยข้าว วาซาบิ สาหร่ายปรุงรส (71 g)", 6.911, 94, 94],
  ["Furikake", "สาหร่ายโรยข้าว วาซาบิ สาหร่ายปรุงรส (500 g)", 6.911, 13.5, 13.5],
  ["Furikake", "สาหร่ายโรยข้าว ยูซุ สาหร่ายปรุงรส (71 g)", 6.925, 94, 94],
  ["Furikake", "สาหร่ายโรยข้าว ยูซุ สาหร่ายปรุงรส (500 g)", 6.925, 13.5, 13.5],
  ["Furikake", "สาหร่ายโรยข้าว สไปซี่ สาหร่ายปรุงรส (71 g)", 6.889, 94, 94],
  ["Furikake", "สาหร่ายโรยข้าว สไปซี่ สาหร่ายปรุงรส (500 g)", 6.889, 13.5, 13.5],
  ["หอมเจียว", "หอมเจียวทรงเครื่อง", 12.814, 162, 162],
  ["หอมเจียว", "หอมเจียวทรงเครื่อง 500g.", 12.814, 24, 24],
  ["ซอส", "ซอสก๋วยเตี๋ยวเรือ", 21.277, 320, 325],
  ["ซอส", "ซอสก๋วยเตี๋ยวแห้งคลุก", 21.189, 320, 325],
  ["ซอส", "ซอสหมี่ชมพู", 21.21, 520, 530],
  ["ซอส", "ซอสหมี่คลุก", 19.041, 500, 505],
  ["ท็อปปิ้ง", "น้ำพริกรสแกงกะหรี่", 17.085, 760, 770],
  ["ท็อปปิ้ง", "น้ำพริกรสน้ำย้อย", 17.316, 780, 790],
  ["ท็อปปิ้ง", "น้ำพริกอ่องฟองเต้าหู้", 16.48, 600, 600],
  ["ท็อปปิ้ง", "น้ำพริกรสผัดพริกของฟองเต้าหู้", 16.48, 750, 760],
  ["ท็อปปิ้ง", "น้ำพริกรสตะไคร้", 17.073, 640, 650],
  ["ท็อปปิ้ง", "น้ำพริกรสขิง", 17.144, 630, 640]
];

// ---------- พื้นฐาน ----------
function requirePrd_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'production') throw new Error('แผนกนี้ไม่มีระบบฝ่ายผลิต');
  return dept;
}
function prdRegister_() {
  Object.keys(PRD_TABLES_).forEach(function (k) { PUR_TABLES_[k] = PRD_TABLES_[k]; });
  ['date', 'dueDate', 'finishDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['rawKg', 'qtyMin', 'qtyMax', 'target', 'sort', 'planBatch', 'planQty', 'actBatch', 'fryKg', 'coolKg', 'yieldPct', 'lossPct', 'actQty', 'actCases',
    'expMin', 'expMax', 'lossKg', 'lossQty', 'minutes'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function prdBook_(dept) { prdRegister_(); return purBook_(dept); }
function prdText_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 1000); }
function prdNum_(v, max) { var n = purNum_(v); return n === '' || n < 0 || (max && n > max) ? '' : Math.round(n * 1000) / 1000; }
function prdTime_(v) { var m = String(v || '').trim().match(/^(\d{1,2})[:.](\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
function prdSettings_(ss) {
  var s = {};
  Object.keys(PRD_SETTINGS_DEFAULT_).forEach(function (k) { s[k] = PRD_SETTINGS_DEFAULT_[k]; });
  purRead_(ss, 'prd_settings').forEach(function (x) { if (x.id) s[x.id] = String(x.value == null ? '' : x.value); });
  return s;
}
// ครั้งแรก: ใส่สินค้าและมาตรฐานจากไฟล์ Yield (เขียนทีเดียวทั้งชุด)
function prdSeedProducts_(ss) {
  if (purRead_(ss, 'prd_products').length) return;
  var sh = purSheet_(ss, 'prd_products'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), now = purNow_();
  var rows = PRD_PRODUCT_SEED_.map(function (p, i) {
    return purRowValues_(sh, 'prd_products', { id: 'PD' + ('00' + (i + 1)).slice(-3), category: p[0], name: p[1], rawKg: p[2], qtyMin: p[3], qtyMax: p[4],
      unit: '', target: '', active: 'ใช้', sort: i + 1, createdAt: now, updatedAt: now }, head);
  });
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
// คำนวณผลของรายการแผน: Yield / %Lost / ช่วงจำนวนที่ควรได้
function prdCalc_(o, prod, s) {
  var base = o.coolKg !== '' ? o.coolKg : o.fryKg;
  o.yieldPct = o.grp === 'G2' && o.rawKg && base !== '' ? Math.round(base / o.rawKg * 10000) / 100 : '';
  o.lossPct = o.yieldPct === '' ? '' : Math.round((100 - o.yieldPct) * 100) / 100;
  var b = o.planBatch !== '' ? o.planBatch : o.actBatch;   // ช่วงที่ควรได้ คิดจากแผน (ไม่เปลี่ยนตามที่กรอกผล)
  o.expMin = prod && o.grp === 'G2' && b !== '' && prod.qtyMin !== '' ? Math.round(prod.qtyMin * b) : '';
  o.expMax = prod && o.grp === 'G2' && b !== '' && prod.qtyMax !== '' ? Math.round(prod.qtyMax * b) : '';
  return o;
}

// ---------- โหลดหน้า ----------
function prdLoad(token, from, to) {
  var dept = requirePrd_(token), ss = prdBook_(dept);
  prdSeedProducts_(ss);
  var today = purToday_();
  from = purDate_(from) || Utilities.formatDate(new Date(Date.now() - 45 * 864e5), PUR_TZ_, 'yyyy-MM-dd');
  to = purDate_(to) || Utilities.formatDate(new Date(Date.now() + 30 * 864e5), PUR_TZ_, 'yyyy-MM-dd');
  var inRange = function (x) { return x.date >= from && x.date <= to; };
  var p = props_();
  return { ok: true, today: today, from: from, to: to, sheetUrl: ss.getUrl(), hasFolder: !!deptConfig_(dept.key).folderId, settings: prdSettings_(ss),
    products: purRead_(ss, 'prd_products').sort(function (a, b) { return (Number(a.sort) || 0) - (Number(b.sort) || 0); }),
    plans: purRead_(ss, 'prd_plans').filter(inRange),
    reports: purRead_(ss, 'prd_reports').filter(inRange).map(function (r) { r.files = purParseFiles_(r.files); r.sections = prdSections_(r.sections); return r; }),
    breakdowns: purRead_(ss, 'prd_breakdowns').filter(inRange),
    line: { token: !!p.getProperty('PROD_LINE_TOKEN'), group: !!p.getProperty('PROD_LINE_GROUP'), setupCode: hrProp_('PROD_LINE_SETUP', hrSetupCode_), webhook: ACC_WEBHOOK_URL_ } };
}

// ---------- สินค้า (มาตรฐาน Yield) ----------
function prdSaveProduct(token, p) {
  var dept = requirePrd_(token);
  p = p || {};
  var name = purClean_(p.name, 120);
  if (!name) return { ok: false, error: 'ใส่ชื่อสินค้า' };
  var qMin = prdNum_(p.qtyMin, 1e6), qMax = prdNum_(p.qtyMax, 1e6);
  if (qMin !== '' && qMax !== '' && qMax < qMin) return { ok: false, error: 'จำนวนสูงสุดต้องไม่น้อยกว่าต่ำสุด' };
  var target = prdNum_(p.target, 100);
  return purLocked_(function () {
    var ss = prdBook_(dept), list = purRead_(ss, 'prd_products');
    var old = p.id ? list.filter(function (x) { return x.id === p.id; })[0] : null;
    if (p.id && !old) return { ok: false, error: 'ไม่พบสินค้านี้' };
    var cat = purClean_(p.category, 60);
    if (list.some(function (x) { return x.id !== p.id && String(x.name).trim() === name && String(x.category).trim() === cat; })) return { ok: false, error: 'มีสินค้าชื่อนี้ในหมวดนี้แล้ว' };
    var now = purNow_(), maxNo = list.reduce(function (m, x) { return Math.max(m, parseInt(String(x.id).replace(/\D/g, ''), 10) || 0); }, 0);
    var o = old || { id: 'PD' + ('00' + (maxNo + 1)).slice(-3), createdAt: now, sort: list.length + 1 };
    o.category = cat; o.name = name; o.rawKg = prdNum_(p.rawKg, 10000); o.qtyMin = qMin; o.qtyMax = qMax === '' ? qMin : qMax;
    o.unit = purClean_(p.unit, 20); o.target = target; o.active = p.active === false || p.active === 'ไม่ใช้' ? 'ไม่ใช้' : 'ใช้'; o.updatedAt = now;
    purWrite_(ss, 'prd_products', o);
    purLogWrite_(ss, old ? 'แก้สินค้า' : 'เพิ่มสินค้า', 'prd_products', o.id, o.name + ' · ' + o.rawKg + ' กก./batch · ' + o.qtyMin + '–' + o.qtyMax);
    return { ok: true, product: purRead_(ss, 'prd_products').filter(function (x) { return x.id === o.id; })[0] };
  });
}

// ---------- แผนผลิต + ผลจริง ----------
// LOT = วันที่ (yyyy-MM-dd) · รับแบบเดิม 16/11/26 หรือ 16/11/2569 แล้วแปลงให้
function prdLotIso_(v) {
  var s = String(v || '').trim().replace(/^'/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return '';
  var y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543;
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}
// กำหนดเสร็จ: G2 ต้องเสร็จในวันผลิต · G1 / G3 ไม่เกิน 3 วันหลังวันผลิต
var PRD_FINISH_DAYS_ = { G2: 0, G1: 3, G3: 3 };
function prdDeadline_(x) {
  var d = String(x.date || ''), n = PRD_FINISH_DAYS_[x.grp] || 0, p = d.split('-');
  if (p.length !== 3 || !n) return d;
  var t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2);
}
// สถานะเสร็จ: ok = ตามกำหนด · late = เสร็จช้า · over = ยังไม่เสร็จและเลยกำหนด · wait = ยังไม่เสร็จ ยังไม่ถึงกำหนด
function prdFinishState_(x, today) {
  var dl = prdDeadline_(x);
  if (x.finishDate) return x.finishDate <= dl ? 'ok' : 'late';
  return today > dl ? 'over' : 'wait';
}
function prdTh_(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2) : String(iso || ''); }
function prdCleanPlan_(p, s) {
  var grp = PRD_GROUPS_[p.grp] ? p.grp : 'G2';
  var o = { grp: grp, date: purDate_(p.date), productId: purClean_(p.productId, 20), product: purClean_(p.product, 150), lot: prdLotIso_(p.lot),
    planBatch: prdNum_(p.planBatch, 10000), planQty: prdNum_(p.planQty, 1e7), dueDate: purDate_(p.dueDate),
    actBatch: prdNum_(p.actBatch, 10000), rawKg: prdNum_(p.rawKg, 1e6), fryKg: prdNum_(p.fryKg, 1e6), coolKg: prdNum_(p.coolKg, 1e6),
    actQty: prdNum_(p.actQty, 1e7), unit: purClean_(p.unit, 20), actCases: prdNum_(p.actCases, 1e6), lossKg: prdNum_(p.lossKg, 1e6), lossQty: prdNum_(p.lossQty, 1e7),
    lossNote: prdText_(p.lossNote, 300), finishDate: purDate_(p.finishDate), lateCause: prdText_(p.lateCause, 300), status: PRD_STATUS_[p.status] ? p.status : 'plan', note: prdText_(p.note, 500), by: purClean_(p.by, 60) };
  return o;
}
function prdSavePlans(token, items) {
  var dept = requirePrd_(token);
  items = Array.isArray(items) ? items.slice(0, 80) : [];
  if (!items.length) return { ok: false, error: 'ไม่มีรายการ' };
  for (var i = 0; i < items.length; i++) {
    var c = prdCleanPlan_(items[i] || {});
    if (!c.date) return { ok: false, error: 'รายการที่ ' + (i + 1) + ': ใส่วันผลิต' };
    if (!c.product) return { ok: false, error: 'รายการที่ ' + (i + 1) + ': เลือกสินค้า' };
    if (c.grp === 'G2' && c.coolKg !== '' && c.rawKg === '') return { ok: false, error: c.product + ': ใส่น้ำหนักวัตถุดิบก่อน จึงคิด Yield ได้' };
    if (c.rawKg !== '' && ((c.coolKg !== '' && c.coolKg > c.rawKg * 1.5) || (c.fryKg !== '' && c.fryKg > c.rawKg * 1.5))) return { ok: false, error: c.product + ': น้ำหนักหลังผัด/หลังทำเย็นมากกว่าวัตถุดิบเกินจริง — ตรวจหน่วย (กก.)' };
    if (c.finishDate && c.date && c.finishDate < c.date) return { ok: false, error: c.product + ': วันที่เสร็จต้องไม่ก่อนวันผลิต' };
    if (c.status !== 'cancel' && c.finishDate && c.finishDate > prdDeadline_(c) && !c.lateCause) return { ok: false, error: c.grp + ' ' + c.product + ': เสร็จช้ากว่ากำหนด — ใส่สาเหตุ' };
  }
  return purLocked_(function () {
    var ss = prdBook_(dept), s = prdSettings_(ss), all = purRead_(ss, 'prd_plans'), prods = purRead_(ss, 'prd_products'), now = purNow_(), saved = [];
    items.forEach(function (it) {
      var c = prdCleanPlan_(it), old = it.id ? all.filter(function (x) { return x.id === it.id; })[0] : null;
      var o = old || { id: purId_('PL'), createdAt: now };
      Object.keys(c).forEach(function (k) { o[k] = c[k]; });
      // เสร็จแล้ว = เลือกวันที่เสร็จแล้วเท่านั้น (ผู้กรอกเลือกเอง ไม่เติมให้อัตโนมัติ)
      if (o.status === 'plan' && o.finishDate) o.status = 'done';
      if (o.status === 'done' && !o.finishDate) o.status = 'plan';
      if (!o.lot && o.grp === 'G2') o.lot = o.date;   // งานผัด: LOT = วันที่ผลิต
      prdCalc_(o, prods.filter(function (x) { return x.id === o.productId; })[0], s);
      o.updatedAt = now;
      purWrite_(ss, 'prd_plans', o);
      saved.push(o.id);
    });
    purLogWrite_(ss, 'บันทึกแผน/ผลผลิต', 'prd_plans', saved.join(','), items.length + ' รายการ · ' + (items[0].date || ''));
    var fresh = purRead_(ss, 'prd_plans');
    return { ok: true, plans: fresh.filter(function (x) { return saved.indexOf(x.id) >= 0; }) };
  });
}
function prdDeletePlan(token, id) {
  var dept = requirePrd_(token);
  return purLocked_(function () {
    var ss = prdBook_(dept), row = purRead_(ss, 'prd_plans').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    purSheet_(ss, 'prd_plans').deleteRow(row._row);
    purLogWrite_(ss, 'ลบรายการแผนผลิต', 'prd_plans', id, row.date + ' · ' + row.grp + ' · ' + row.product);
    return { ok: true };
  });
}

// ---------- Breakdown ----------
function prdSaveBreakdown(token, b) {
  var dept = requirePrd_(token);
  b = b || {};
  var machine = purClean_(b.machine, 80), start = prdTime_(b.start), end = prdTime_(b.end), date = purDate_(b.date);
  if (!date) return { ok: false, error: 'ใส่วันที่' };
  if (!machine) return { ok: false, error: 'ใส่ชื่อเครื่องจักร / อุปกรณ์' };
  if (!start) return { ok: false, error: 'ใส่เวลาเริ่ม (เช่น 09:30)' };
  if (!prdText_(b.problem)) return { ok: false, error: 'เขียนปัญหาที่เกิด' };
  var mins = '';
  if (end) { var a = start.split(':'), z = end.split(':'); mins = (+z[0] * 60 + +z[1]) - (+a[0] * 60 + +a[1]); if (mins < 0) mins += 1440; }
  return purLocked_(function () {
    var ss = prdBook_(dept), old = b.id ? purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === b.id; })[0] : null;
    if (b.id && !old) return { ok: false, error: 'ไม่พบรายการนี้' };
    var now = purNow_(), o = old || { id: purId_('BD'), createdAt: now };
    o.date = date; o.grp = PRD_GROUPS_[b.grp] ? b.grp : ''; o.machine = machine; o.start = start; o.end = end; o.minutes = mins;
    o.problem = prdText_(b.problem, 800); o.fix = prdText_(b.fix, 800); o.by = purClean_(b.by, 60); o.updatedAt = now;
    purWrite_(ss, 'prd_breakdowns', o);
    purLogWrite_(ss, old ? 'แก้ Breakdown' : 'บันทึก Breakdown', 'prd_breakdowns', o.id, date + ' · ' + machine + ' · ' + start + '–' + (end || '?'));
    return { ok: true, breakdown: purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === o.id; })[0] };
  });
}
function prdDeleteBreakdown(token, id) {
  var dept = requirePrd_(token);
  return purLocked_(function () {
    var ss = prdBook_(dept), row = purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    purSheet_(ss, 'prd_breakdowns').deleteRow(row._row);
    purLogWrite_(ss, 'ลบ Breakdown', 'prd_breakdowns', id, row.date + ' · ' + row.machine);
    return { ok: true };
  });
}

// ---------- รายงาน (ปัญหา / ปิดงาน / รูป) ----------
function prdReport_(ss, date, kind, grp) {
  return purRead_(ss, 'prd_reports').filter(function (x) { return x.date === date && x.kind === kind && String(x.grp || '') === String(grp || ''); })[0];
}
function prdSaveReport(token, r) {
  var dept = requirePrd_(token);
  r = r || {};
  var date = purDate_(r.date), kind = r.kind === 'evening' ? 'evening' : 'morning', grp = kind === 'evening' && PRD_GROUPS_[r.grp] ? r.grp : '';
  if (!date) return { ok: false, error: 'ใส่วันที่' };
  if (kind === 'evening' && !grp) return { ok: false, error: 'เลือกกลุ่มงาน' };
  return purLocked_(function () {
    var ss = prdBook_(dept), o = prdReport_(ss, date, kind, grp) || { id: purId_('RP'), date: date, kind: kind, grp: grp, files: '[]' };
    o.problems = prdText_(r.problems, 1500); o.checks = prdText_(r.checks, 300); o.note = prdText_(r.note, 500); o.by = purClean_(r.by, 60) || o.by; o.updatedAt = purNow_();
    if (kind === 'evening') { o.title = purClean_(r.title, 100); o.sections = JSON.stringify(prdCleanSections_(r.sections)); }
    purWrite_(ss, 'prd_reports', o);
    var x = prdReport_(ss, date, kind, grp); x.files = purParseFiles_(x.files); x.sections = prdSections_(x.sections);
    return { ok: true, report: x };
  });
}
// หัวข้อเพิ่มเติม [{ title, rows: [{ product, lot (yyyy-MM-dd), qty, unit }], text }] — rows = เลือกสินค้า + LOT + จำนวน · text = ข้อความอิสระ (บรรทัดละรายการ)
function prdCleanSections_(a) {
  return (Array.isArray(a) ? a : []).slice(0, 10).map(function (x) {
    x = x || {};
    var rows = (Array.isArray(x.rows) ? x.rows : []).slice(0, 40).map(function (r) {
      r = r || {}; return { product: purClean_(r.product, 150), lot: prdLotIso_(r.lot), qty: prdNum_(r.qty, 1e7), unit: purClean_(r.unit, 20) };
    }).filter(function (r) { return r.product || r.qty !== ''; });
    return { title: purClean_(x.title, 80), rows: rows, text: prdText_(x.text, 2000) };
  }).filter(function (x) { return x.title || x.rows.length || x.text; });
}
function prdSections_(v) { try { var a = typeof v === 'string' ? JSON.parse(v || '[]') : v; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function prdPhotoFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่าย');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รูปรายงานผลิต');
  return it.hasNext() ? it.next() : parent.createFolder('รูปรายงานผลิต');
}
function prdUploadPhoto(token, date, grp, fileName, mimeType, base64) {
  var dept = requirePrd_(token);
  date = purDate_(date); grp = PRD_GROUPS_[grp] ? grp : '';
  if (!date || !grp) return { ok: false, error: 'ข้อมูลไม่ครบ' };
  if (!/^image\/(jpeg|png)$/.test(mimeType)) return { ok: false, error: 'แนบได้เฉพาะรูป JPG / PNG' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return { ok: false, error: 'รูปว่างหรือใหญ่เกิน 8 MB' };
  return purLocked_(function () {
    var ss = prdBook_(dept), o = prdReport_(ss, date, 'evening', grp) || { id: purId_('RP'), date: date, kind: 'evening', grp: grp, files: '[]', updatedAt: purNow_() };
    var files = purParseFiles_(o.files);
    if (files.length >= 12) return { ok: false, error: 'แนบได้สูงสุด 12 รูปต่อรายงาน' };
    var safe = purClean_(fileName, 80).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
    var f = prdPhotoFolder_(dept).createFile(Utilities.newBlob(bytes, mimeType, date + '_' + grp + '_' + safe));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);   // LINE ต้องเปิดรูปได้
    files.push({ id: f.getId(), name: safe, url: 'https://lh3.googleusercontent.com/d/' + f.getId(), at: purNow_() });
    o.files = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'prd_reports', o);
    return { ok: true, files: files };
  });
}
function prdRemovePhoto(token, date, grp, fileId) {
  var dept = requirePrd_(token);
  return purLocked_(function () {
    var ss = prdBook_(dept), o = prdReport_(ss, purDate_(date), 'evening', grp);
    if (!o) return { ok: false, error: 'ไม่พบรายงาน' };
    var files = purParseFiles_(o.files).filter(function (x) { return x.id !== fileId; });
    o.files = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'prd_reports', o);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    return { ok: true, files: files };
  });
}

// ---------- ตั้งค่า / ประวัติ ----------
function prdSaveSettings(token, s) {
  var dept = requirePrd_(token);
  s = s || {};
  return purLocked_(function () {
    var ss = prdBook_(dept), rows = purRead_(ss, 'prd_settings'), changed = [];
    Object.keys(PRD_SETTINGS_DEFAULT_).forEach(function (k) {
      if (s[k] === undefined) return;
      var val = prdText_(s[k], 3000);
      if (k === 'target') { var n = Number(val); if (!(n > 0 && n <= 100)) return; val = String(n); }
      var r = rows.filter(function (x) { return x.id === k; })[0];
      if (r && String(r.value) === val) return;
      purWrite_(ss, 'prd_settings', r ? Object.assign(r, { value: val }) : { id: k, value: val });
      changed.push(k);
    });
    if (changed.length) purLogWrite_(ss, 'แก้ตั้งค่า', 'prd_settings', '', changed.join(', '));
    return { ok: true, settings: prdSettings_(ss) };
  });
}
function prdLog(token, limit) {
  var dept = requirePrd_(token), ss = prdBook_(dept);
  return { ok: true, rows: purRead_(ss, 'log').reverse().slice(0, Math.min(500, Number(limit) || 200)) };
}

// ---------- Dashboard (หน้าฝ่าย + ผู้บริหาร) ----------
function prdDashboard(token, from, to) {
  var dept = requirePrd_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var d = prdDashboard_(dept, from, to); d.ok = true; return d;
}
function prdDashboard_(dept, from, to) {
  var ss = prdBook_(dept), s = prdSettings_(ss), defTarget = Number(s.target) || 85, today = purToday_();
  var prods = {}; purRead_(ss, 'prd_products').forEach(function (p) { prods[p.id] = p; });
  var plans = purRead_(ss, 'prd_plans').filter(function (x) { return x.date >= from && x.date <= to && x.status !== 'cancel'; });
  var g2 = plans.filter(function (x) { return x.grp === 'G2' && x.yieldPct !== ''; });
  var tgt = function (x) { var p = prods[x.productId]; return p && p.target !== '' ? Number(p.target) : defTarget; };
  var sum = function (a, k) { return a.reduce(function (t, x) { return t + (Number(x[k]) || 0); }, 0); };
  var raw = sum(g2, 'rawKg'), cool = g2.reduce(function (t, x) { return t + (Number(x.coolKg !== '' ? x.coolKg : x.fryKg) || 0); }, 0);
  var byProd = {};
  g2.forEach(function (x) {
    var k = x.product, o = byProd[k] = byProd[k] || { name: k, runs: 0, raw: 0, out: 0, below: 0, qty: 0, expMin: 0, expMax: 0, lossKg: 0, target: tgt(x) };
    o.runs++; o.raw += Number(x.rawKg) || 0; o.out += Number(x.coolKg !== '' ? x.coolKg : x.fryKg) || 0; if (x.yieldPct < tgt(x)) o.below++;
    o.qty += Number(x.actQty) || 0; o.expMin += Number(x.expMin) || 0; o.expMax += Number(x.expMax) || 0; o.lossKg += Number(x.lossKg) || 0;
  });
  var prodList = Object.keys(byProd).map(function (k) { var o = byProd[k]; o.yieldPct = o.raw ? Math.round(o.out / o.raw * 1000) / 10 : null; return o; })
    .sort(function (a, b) { return (a.yieldPct == null ? 999 : a.yieldPct) - (b.yieldPct == null ? 999 : b.yieldPct); });
  plans.forEach(function (x) { x._fs = prdFinishState_(x, today); });
  var judged = plans.filter(function (x) { return x._fs !== 'wait'; });
  var onTime = judged.filter(function (x) { return x._fs === 'ok'; }).length;
  var late = judged.filter(function (x) { return x._fs !== 'ok'; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var byCause = {};
  late.forEach(function (x) { var k = x.lateCause || (x._fs === 'over' ? 'ยังไม่เสร็จ (ยังไม่ระบุสาเหตุ)' : 'ไม่ระบุ'); byCause[k] = (byCause[k] || 0) + 1; });
  var qtyRuns = g2.filter(function (x) { return x.actQty !== '' && x.expMin !== ''; });
  var bds = purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.date >= from && x.date <= to; });
  var byMachine = {};
  bds.forEach(function (b) { var o = byMachine[b.machine] = byMachine[b.machine] || { name: b.machine, n: 0, minutes: 0 }; o.n++; o.minutes += Number(b.minutes) || 0; });
  var days = {};
  g2.forEach(function (x) { var o = days[x.date] = days[x.date] || { date: x.date, raw: 0, out: 0 }; o.raw += Number(x.rawKg) || 0; o.out += Number(x.coolKg !== '' ? x.coolKg : x.fryKg) || 0; });
  return { kind: 'production', from: from, to: to, target: defTarget,
    kpi: { runs: g2.length, yieldPct: raw ? Math.round(cool / raw * 1000) / 10 : null, below: g2.filter(function (x) { return x.yieldPct < tgt(x); }).length,
      lossKg: Math.round(sum(plans, 'lossKg') * 100) / 100, lossQty: sum(plans, 'lossQty'), onTime: onTime, judged: judged.length, late: late.length,
      qtyIn: qtyRuns.filter(function (x) { return x.actQty >= x.expMin && x.actQty <= x.expMax; }).length, qtyLow: qtyRuns.filter(function (x) { return x.actQty < x.expMin; }).length, qtyRuns: qtyRuns.length,
      bdCount: bds.length, bdMinutes: sum(bds, 'minutes'),
      packed: sum(plans.filter(function (x) { return x.grp === 'G1'; }), 'actQty'), cases: sum(plans.filter(function (x) { return x.grp === 'G3'; }), 'actCases') },
    products: prodList.slice(0, 40),
    lateList: late.slice(0, 15).map(function (x) { return { date: x.date, grp: x.grp, product: x.product, deadline: prdDeadline_(x), finishDate: x.finishDate, cause: x.lateCause, state: x._fs }; }),
    lateCauses: Object.keys(byCause).map(function (k) { return { name: k, n: byCause[k] }; }).sort(function (a, b) { return b.n - a.n; }),
    machines: Object.keys(byMachine).map(function (k) { return byMachine[k]; }).sort(function (a, b) { return b.minutes - a.minutes; }),
    days: Object.keys(days).sort().map(function (k) { var o = days[k]; return { date: k, yieldPct: o.raw ? Math.round(o.out / o.raw * 1000) / 10 : null }; }) };
}

// ---------- LINE ----------
// วันที่แบบไลน์ผลิตใช้: 17.11.26
function prdDot_(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0].slice(2) : String(iso || ''); }
function prdSlash_(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0].slice(2) : String(iso || ''); }
function prdLotText_(v) { var iso = prdLotIso_(v); return iso ? prdSlash_(iso) : String(v || '').replace(/^'/, ''); }
function prdFmt_(n) { return n === '' || n == null ? '-' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function prdLinePush_(messages) {
  var p = props_(), token = p.getProperty('PROD_LINE_TOKEN'), group = p.getProperty('PROD_LINE_GROUP');
  if (!token || !group) return { ok: false, error: !token ? 'ยังไม่ได้ใส่ PROD_LINE_TOKEN ใน Script Properties' : 'ยังไม่ได้ผูกกลุ่ม LINE ของฝ่ายผลิต' };
  for (var i = 0; i < messages.length; i += 5) {   // LINE ส่งได้ครั้งละไม่เกิน 5 ข้อความ
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ to: group, messages: messages.slice(i, i + 5) }), muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'LINE ตอบกลับ ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200) };
  }
  return { ok: true };
}
var PRD_COLOR_ = '#0E7490';
function prdT_(text, o) { var x = { type: 'text', text: String(text == null || text === '' ? '-' : text), wrap: true }; Object.keys(o || {}).forEach(function (k) { x[k] = o[k]; }); return x; }
function prdBox_(contents, o) { var x = { type: 'box', layout: 'vertical', contents: contents }; Object.keys(o || {}).forEach(function (k) { x[k] = o[k]; }); return x; }
// การ์ดขาว + แถบหัวมน (แบบเดียวกับรายงานฝ่ายบัญชี — LINE บนคอมไม่รองรับพื้นโปร่งใส)
function prdCard_(kicker, title, sub, body, alt, headColor) {
  var inner = [prdBox_([prdT_(kicker, { size: 'xxs', color: '#A5F3FC', weight: 'bold' }), prdT_(title, { size: 'xl', color: '#FFFFFF', weight: 'bold', margin: 'sm' }),
    prdT_(sub, { size: 'xs', color: '#CFFAFE', margin: 'xs' })], { backgroundColor: headColor || PRD_COLOR_, cornerRadius: '18px', paddingAll: '18px' }),
    prdBox_(body, { paddingStart: '6px', paddingEnd: '6px', paddingTop: '4px', paddingBottom: '4px' })];
  return { type: 'flex', altText: alt.slice(0, 390), contents: { type: 'bubble', size: 'giga', body: prdBox_(inner, { paddingAll: '14px', backgroundColor: '#FFFFFF' }) } };
}
function prdSec_(label, color) {
  return { type: 'box', layout: 'horizontal', margin: 'xl', spacing: 'sm', contents: [
    prdBox_([], { width: '6px', backgroundColor: color, cornerRadius: '3px' }), prdT_(label, { size: 'md', weight: 'bold', color: '#0F172A', flex: 1 })] };
}
// แถวรายการ: เลข · ชื่อ (+ บรรทัดรอง) · ค่าทางขวา
function prdRow_(no, name, sub, right, rightColor) {
  var left = [prdT_(name, { size: 'sm', weight: 'bold', color: '#0F172A' })];
  (sub || []).forEach(function (s) { if (s) left.push(prdT_(s.t || s, { size: 'xs', color: s.c || '#64748B', margin: 'xs' })); });
  var c = [prdT_(no + '.', { size: 'sm', color: '#94A3B8', flex: 0 }), prdBox_(left, { flex: 6, margin: 'sm' })];
  if (right) c.push(prdT_(right, { size: 'sm', weight: 'bold', color: rightColor || '#0F172A', align: 'end', flex: 3 }));
  return { type: 'box', layout: 'horizontal', margin: 'md', contents: c };
}
var PRD_GCOLOR_ = { G2: '#EA580C', G1: '#2563EB', G3: '#16A34A' };
function prdMorningFlex_(date, plans, note) {
  var body = [], n = 0;
  ['G2', 'G1', 'G3'].forEach(function (g) {
    var list = plans.filter(function (x) { return x.grp === g && x.status !== 'cancel'; });
    if (!list.length) return;
    body.push(prdSec_(g + ' · ' + PRD_MOR_LABEL_[g] + ' (' + list.length + ' รายการ)', PRD_GCOLOR_[g]));
    list.forEach(function (x, i) {
      var amt = [x.planBatch !== '' ? prdFmt_(x.planBatch) + ' batch' : '', x.planQty !== '' ? prdFmt_(x.planQty) + (g === 'G3' ? ' ลัง' : ' ชิ้น') : ''].filter(String).join(' · ');
      body.push(prdRow_(i + 1, x.product, [x.lot ? 'LOT ' + prdLotText_(x.lot) : '', x.note], amt, PRD_GCOLOR_[g]));
      n++;
    });
  });
  if (!n) body.push(prdT_('ยังไม่มีรายการในแผน', { size: 'sm', color: '#64748B', margin: 'lg' }));
  if (note) body.push(prdBox_([prdT_('📌 ' + note, { size: 'sm', color: '#9A3412', weight: 'bold' })], { margin: 'xl', backgroundColor: '#FFF7ED', cornerRadius: '12px', paddingAll: '12px' }));
  return prdCard_('PRODUCTION PLAN', 'แผนผลิต ' + prdDot_(date), 'บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายผลิต · ' + n + ' รายการ', body,
    'แผนผลิต ' + prdDot_(date) + ' · ' + n + ' รายการ');
}
function prdEveningFlex_(date, grp, plans, rep, target, prods) {
  var body = [], list = plans.filter(function (x) { return x.grp === grp && x.status !== 'cancel'; });
  var dpt = String(date).split('-'), dTh = dpt[2] + '/' + dpt[1] + '/' + String(+dpt[0] + 543).slice(2);
  var title = (rep && rep.title) || PRD_EVE_TITLE_[grp] + ' ประจำวันที่ ' + dTh;
  if (!/ประจำวันที่/.test(title)) title += ' ประจำวันที่ ' + dTh;   // หัวข้อเก่าที่ไม่มีวันที่
  var unitOf = function (x) { return x.unit || (prods[x.productId] || {}).unit || 'ชิ้น'; };
  if (list.length) body.push(prdSec_(PRD_EVE_SEC_[grp], PRD_GCOLOR_[grp]));
  list.forEach(function (x, i) {
    var sub = [], right = '', rc = '#0F172A';
    if (x.lot) sub.push('LOT ' + prdLotText_(x.lot));
    if (grp === 'G2') {
      var b = x.actBatch !== '' ? x.actBatch : x.planBatch;
      sub.push((b !== '' ? prdFmt_(b) + ' batch' : '') + (x.rawKg !== '' ? (b !== '' ? ' · ' : '') + 'วัตถุดิบ ' + prdFmt_(x.rawKg) + ' → ' + prdFmt_(x.coolKg !== '' ? x.coolKg : x.fryKg) + ' กก.' + (x.coolKg === '' && x.fryKg !== '' ? ' (หลังผัด)' : '') : ''));
      if (x.actQty !== '') {
        var ok = x.expMin === '' || (x.actQty >= x.expMin && x.actQty <= x.expMax);
        var qc = ok ? '#15803D' : x.actQty < x.expMin ? '#C2410C' : '#B91C1C';   // ตามช่วง เขียว · น้อยกว่า ส้ม · เกิน แดง
        if (x.expMin !== '') sub.push({ t: (ok ? '✅ ตามช่วง' : x.actQty < x.expMin ? '🔻 ต่ำกว่าช่วง' : '🔺 เกินช่วง') + ' (ควรได้ ' + prdFmt_(x.expMin) + (x.expMax !== x.expMin ? '–' + prdFmt_(x.expMax) : '') + ')', c: qc });
        right = prdFmt_(x.actQty) + ' ' + unitOf(x); rc = x.expMin === '' ? '#0F172A' : qc;
      } else right = 'ยังไม่กรอก';
    } else if (grp === 'G1') {
      right = x.actQty !== '' ? prdFmt_(x.actQty) + ' ' + unitOf(x) : 'ยังไม่กรอก';
      if (x.planBatch !== '') sub[0] = (sub[0] ? sub[0] + ' · ' : '') + prdFmt_(x.planBatch) + ' batch';
    } else {
      right = [x.actQty !== '' ? prdFmt_(x.actQty) + ' ' + unitOf(x) : '', x.actCases !== '' ? prdFmt_(x.actCases) + ' ลัง' : ''].filter(String).join(' ; ') || 'ยังไม่กรอก';
    }
    if (x.lossKg !== '' || x.lossQty !== '') sub.push({ t: 'ของเสีย ' + [x.lossKg !== '' ? prdFmt_(x.lossKg) + ' กก.' : '', x.lossQty !== '' ? prdFmt_(x.lossQty) + ' ชิ้น' : ''].filter(String).join(' / ') + (x.lossNote ? ' · ' + x.lossNote : ''), c: '#B45309' });
    var fs = prdFinishState_(x, purToday_()), dl = prdDeadline_(x);
    if (fs === 'ok') sub.push({ t: '🏁 เสร็จ ' + prdTh_(x.finishDate) + ' ตามกำหนด', c: '#15803D' });
    else if (fs === 'wait') sub.push({ t: '⏳ ยังไม่เสร็จ · กำหนดเสร็จ ' + prdTh_(dl), c: '#64748B' });
    else sub.push({ t: '⚠️ ' + (fs === 'late' ? 'เสร็จ ' + prdTh_(x.finishDate) + ' ช้ากว่ากำหนด' : 'ยังไม่เสร็จ เลยกำหนด') + ' (กำหนด ' + prdTh_(dl) + ')' + (x.lateCause ? ' · สาเหตุ: ' + x.lateCause : ''), c: '#B91C1C' });
    if (x.note) sub.push(x.note);
    body.push(prdRow_(i + 1, x.product, sub, right, rc));
  });
  // หัวข้อที่พิมพ์เอง (เช่น เตรียมวัตถุดิบ / น้ำพริกค้างแพ็ค) — 1 บรรทัด = 1 รายการ
  var secs = prdSections_(rep && rep.sections);
  secs.forEach(function (sec) {
    body.push(prdSec_(sec.title || 'หัวข้อเพิ่มเติม', '#7C3AED'));
    (sec.rows || []).forEach(function (r, i) {
      var amt = r.qty !== '' && r.qty != null ? prdFmt_(r.qty) + ' ' + (r.unit || '') : '';
      body.push(prdRow_(i + 1, r.product || '-', [[r.lot ? 'LOT ' + prdLotText_(r.lot) : '', amt].filter(String).join(' · ')], ''));
    });
    var lines = String(sec.text || '').split('\n').map(function (l) { return l.trim(); }).filter(String);
    if (!lines.length && !(sec.rows || []).length) body.push(prdT_('-', { size: 'sm', color: '#64748B', margin: 'sm' }));
    lines.forEach(function (l) { var head = /^\d+[.)]/.test(l); body.push(prdT_(l, { size: 'sm', color: head ? '#0F172A' : '#475569', margin: head ? 'md' : 'xs', weight: head ? 'bold' : 'regular' })); });
  });
  if (!list.length && !secs.length) body.push(prdT_('ไม่มีรายการ', { size: 'sm', color: '#64748B', margin: 'md' }));
  body.push(prdSec_('ปัญหาที่พบ', '#64748B'));
  body.push(prdT_(rep && rep.problems ? rep.problems : '-', { size: 'sm', color: '#334155', margin: 'sm' }));
  if (rep && rep.checks) body.push(prdBox_([prdT_('✅ ' + rep.checks + ' เรียบร้อย', { size: 'sm', color: '#166534', weight: 'bold' })], { margin: 'xl', backgroundColor: '#F0FDF4', cornerRadius: '12px', paddingAll: '12px' }));
  var nPhotos = rep ? purParseFiles_(rep.files).length : 0;
  if (nPhotos) body.push(prdT_('📷 รูปประกอบ ' + nPhotos + ' รูป อยู่ในข้อความถัดไป', { size: 'xxs', color: '#64748B', margin: 'md', align: 'center' }));
  return prdCard_('DAILY REPORT · ' + grp, title, grp + ' · ' + PRD_GROUPS_[grp] + (rep && rep.by ? ' · รายงานโดย ' + rep.by : ''), body,
    title, PRD_GCOLOR_[grp] === '#16A34A' ? '#15803D' : PRD_GCOLOR_[grp] === '#2563EB' ? '#1D4ED8' : '#C2410C');
}
// ส่ง LINE: kind = morning (แผนทั้งวัน) | evening (สรุปของกลุ่ม grp + รูปแยกเป็นภาพ)
function prdSendLine(token, kind, date, grp, by) {
  var dept = requirePrd_(token);
  date = purDate_(date);
  if (!date) return { ok: false, error: 'ใส่วันที่' };
  kind = kind === 'evening' ? 'evening' : 'morning';
  if (kind === 'evening' && !PRD_GROUPS_[grp]) return { ok: false, error: 'เลือกกลุ่มงาน' };
  return purLocked_(function () {
    var ss = prdBook_(dept), s = prdSettings_(ss), plans = purRead_(ss, 'prd_plans').filter(function (x) { return x.date === date; });
    var prods = {}; purRead_(ss, 'prd_products').forEach(function (p) { prods[p.id] = p; });
    var rep = prdReport_(ss, date, kind, kind === 'evening' ? grp : ''), msgs;
    if (kind === 'morning') {
      if (!plans.length) return { ok: false, error: 'ยังไม่มีแผนผลิตของวันนี้' };
      msgs = [prdMorningFlex_(date, plans, rep && rep.note ? rep.note : s.morningNote)];
    } else {
      msgs = [prdEveningFlex_(date, grp, plans, rep, Number(s.target) || 85, prods)];
      (rep ? purParseFiles_(rep.files) : []).forEach(function (f) {
        msgs.push({ type: 'image', originalContentUrl: f.url + '=w1600', previewImageUrl: f.url + '=w600' });
      });
    }
    var r = prdLinePush_(msgs);
    if (!r.ok) return r;
    var o = rep || { id: purId_('RP'), date: date, kind: kind, grp: kind === 'evening' ? grp : '', files: '[]' };
    o.sentAt = purNow_(); o.by = purClean_(by, 60) || o.by || ''; o.updatedAt = purNow_();
    purWrite_(ss, 'prd_reports', o);
    purLogWrite_(ss, 'ส่ง LINE ' + (kind === 'morning' ? 'แผนผลิต' : 'สรุป ' + grp), 'prd_reports', o.id, date + ' · ' + msgs.length + ' ข้อความ');
    return { ok: true, sentAt: o.sentAt, messages: msgs.length };
  });
}
// ตัวอย่างการ์ด (หน้าเว็บแสดงก่อนส่ง) — ใช้ข้อมูลเดียวกับที่จะส่ง
function prdLinePreview(token, kind, date, grp) {
  var dept = requirePrd_(token), ss = prdBook_(dept), s = prdSettings_(ss);
  date = purDate_(date);
  var plans = purRead_(ss, 'prd_plans').filter(function (x) { return x.date === date; }), prods = {};
  purRead_(ss, 'prd_products').forEach(function (p) { prods[p.id] = p; });
  if (kind === 'evening') {
    var rep = prdReport_(ss, date, 'evening', grp);
    return { ok: true, flex: prdEveningFlex_(date, grp, plans, rep, Number(s.target) || 85, prods),
      photos: rep ? purParseFiles_(rep.files).length : 0 };
  }
  var mr = prdReport_(ss, date, 'morning', '');
  return { ok: true, flex: prdMorningFlex_(date, plans, mr && mr.note ? mr.note : s.morningNote), photos: 0 };
}
// ใส่ Channel access token จากหน้าตั้งค่าของฝ่ายผลิต (ไม่ต้องเข้า Apps Script) — ตรวจกับ LINE ก่อนว่า token ใช้ได้ แล้วเก็บใน Script Property PROD_LINE_TOKEN
// ไม่ส่งค่า token กลับไปหน้าเว็บ · ไม่บันทึกลงชีต/ประวัติ
function prdSetLineToken(token, value) {
  requirePrd_(token);
  var v = String(value || '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+\/=]{100,400}$/.test(v)) return { ok: false, error: 'รูปแบบ token ไม่ถูกต้อง — คัดลอก Channel access token (long-lived) จาก LINE Developers มาวางทั้งหมด' };
  hrRate_('prdtoken', 10, 3600);
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + v }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'LINE ไม่ยอมรับ token นี้ (รหัส ' + res.getResponseCode() + ') — ตรวจว่าคัดลอกครบ และเป็น token ของ OA ที่ถูกต้อง' };
  var info = JSON.parse(res.getContentText() || '{}'), p = props_(), old = p.getProperty('PROD_LINE_TOKEN');
  p.setProperty('PROD_LINE_TOKEN', v);
  CacheService.getScriptCache().remove('prd_bot_id');
  if (old && old !== v) p.deleteProperty('PROD_LINE_GROUP');   // เปลี่ยน OA → ต้องผูกกลุ่มใหม่
  return { ok: true, botName: info.displayName || '', regroup: !!(old && old !== v), line: { token: true, group: !!p.getProperty('PROD_LINE_GROUP'), setupCode: hrProp_('PROD_LINE_SETUP', hrSetupCode_), webhook: ACC_WEBHOOK_URL_ } };
}
function prdLineTest(token) {
  requirePrd_(token);
  return prdLinePush_([{ type: 'text', text: '✅ ทดสอบการเชื่อมต่อ: ระบบงานองค์กร ฝ่ายผลิต ส่งข้อความเข้ากลุ่มนี้ได้แล้ว' }]);
}
// webhook: บอทของ PROD_LINE_TOKEN — ผูกกลุ่มด้วย "ตั้งค่ากลุ่ม ผลิต <รหัส>"
function prdIsMyBot_(destination) {
  try {
    var token = props_().getProperty('PROD_LINE_TOKEN');
    if (!token || !destination) return false;
    var c = CacheService.getScriptCache(), id = c.get('prd_bot_id');
    if (!id) {
      var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return false;
      id = JSON.parse(res.getContentText()).userId || '';
      if (id) c.put('prd_bot_id', id, 21600);
    }
    return id === destination;
  } catch (e) { return false; }
}
function prdLineReply_(replyToken, text) {
  var token = props_().getProperty('PROD_LINE_TOKEN');
  if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }) });
}
function prdIsCommand_(ev) { return ev && ev.type === 'message' && ev.message && ev.message.type === 'text' && /ผลิต|prod/i.test(String(ev.message.text)); }
function prdLineWebhook_(events, quietJoin) {
  (events || []).forEach(function (ev) {
    try {
      var gid = (ev.source || {}).groupId || '';
      if (ev.type === 'join' && gid) {
        if (!quietJoin) prdLineReply_(ev.replyToken, 'สวัสดีค่ะ 🙏 ถ้าต้องการให้กลุ่มนี้รับแผนผลิต / สรุปงานประจำวัน ให้พิมพ์\nตั้งค่ากลุ่ม ผลิต <รหัสตั้งค่า>\n(ดูรหัสได้ที่ระบบฝ่ายผลิต → ตั้งค่า)');
        return;
      }
      if (!prdIsCommand_(ev)) return;
      var text = String(ev.message.text).trim(), m = text.match(/^ตั้งค่ากลุ่ม\s*(?:ผลิต|PROD)\s+([A-Z0-9]{8})$/i);
      if (!m) { if (/^ตั้ง(ค่า)?\s*กลุ่ม/.test(text)) prdLineReply_(ev.replyToken, 'พิมพ์ให้ตรงรูปแบบนี้ค่ะ\nตั้งค่ากลุ่ม ผลิต <รหัส 8 ตัว>\n(คัดลอกได้จากระบบฝ่ายผลิต → ตั้งค่า)'); return; }
      if (!gid) { prdLineReply_(ev.replyToken, 'พิมพ์คำสั่งนี้ในกลุ่ม LINE ที่ต้องการให้รับรายงาน (ไม่ใช่ในแชทส่วนตัว)'); return; }
      hrRate_('prdbind', 10, 3600);
      if (m[1].toUpperCase() !== hrProp_('PROD_LINE_SETUP', hrSetupCode_)) { prdLineReply_(ev.replyToken, 'รหัสตั้งค่าไม่ถูกต้อง (รหัสใช้ได้ครั้งเดียว — คัดลอกรหัสล่าสุดจากหน้าตั้งค่าอีกครั้ง)'); return; }
      props_().setProperty('PROD_LINE_GROUP', gid);
      props_().setProperty('PROD_LINE_SETUP', hrSetupCode_());
      prdLineReply_(ev.replyToken, '✅ ตั้งกลุ่มนี้เป็นกลุ่มรับแผนผลิตและสรุปงานของฝ่ายผลิตแล้ว');
    } catch (err) { Logger.log('prdLineWebhook_ ' + err); }
  });
}
