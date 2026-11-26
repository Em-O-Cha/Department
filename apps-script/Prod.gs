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
    ['planBatch', 'แผน (batch)'], ['planQty', 'แผน (จำนวน)'], ['planUnit', 'หน่วยแผน'], ['dueDate', 'กำหนดส่ง'],
    ['actBatch', 'ทำจริง (batch)'], ['actBatchUnit', 'หน่วยทำจริง'], ['rawKg', 'น้ำหนักวัตถุดิบ (กก.)'], ['fryKg', 'น้ำหนักหลังผัด (กก.)'], ['coolKg', 'น้ำหนักหลังทำเย็น (กก.)'],
    ['yieldPct', 'Yield (%)'], ['lossPct', '% Lost'], ['actQty', 'จำนวนที่ได้จริง'], ['unit', 'หน่วย'], ['actQty2', 'จำนวนที่ได้จริง (หน่วยที่ 2)'], ['unit2', 'หน่วยที่ 2'], ['actCases', 'จำนวนลัง'], ['expMin', 'ควรได้ (ต่ำสุด)'], ['expMax', 'ควรได้ (สูงสุด)'],
    ['lossKg', 'ของเสีย (กก.)'], ['lossQty', 'ของเสีย (ชิ้น)'], ['rawUnit', 'หน่วยน้ำหนักวัตถุดิบ'], ['fryUnit', 'หน่วยน้ำหนักหลังผัด'], ['coolUnit', 'หน่วยน้ำหนักหลังทำเย็น'], ['lossKgUnit', 'หน่วยของเสีย (น้ำหนัก)'], ['lossQtyUnit', 'หน่วยของเสีย (จำนวน)'], ['lossNote', 'สาเหตุของเสีย'], ['finishDate', 'วันที่เสร็จ'], ['lateCause', 'สาเหตุเสร็จช้ากว่ากำหนด'], ['status', 'สถานะ'], ['note', 'หมายเหตุ'],
    ['by', 'ผู้บันทึก'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prd_reports: { tab: 'รายงาน LINE', cols: [
    ['id', 'รหัส'], ['date', 'วันที่'], ['kind', 'รอบ'], ['grp', 'กลุ่มงาน'], ['title', 'หัวข้อข้อความ'], ['sections', 'หัวข้อเพิ่มเติม'], ['problems', 'ปัญหาที่พบ'], ['checks', 'ปิดงาน (ปิดน้ำ/ไฟ/แอร์)'], ['note', 'หมายเหตุ'],
    ['files', 'รูป'], ['sentAt', 'ส่ง LINE เมื่อ'], ['by', 'ผู้ส่ง'], ['updatedAt', 'แก้ไขล่าสุด']] },
  prd_breakdowns: { tab: 'Breakdown เครื่องจักร', cols: [
    ['id', 'รหัส'], ['date', 'วันที่'], ['grp', 'กลุ่มงาน'], ['machine', 'เครื่องจักร / อุปกรณ์'], ['start', 'เวลาเริ่ม'], ['end', 'เวลาจบ'], ['minutes', 'เวลาที่เสีย (นาที)'],
    ['problem', 'ปัญหา'], ['cause', 'สาเหตุ'], ['fix', 'การแก้ไข'], ['by', 'ผู้บันทึก'], ['files', 'รูปถ่าย'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
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
  checks: 'ปิดน้ำ, ปิดไฟ, ปิดแอร์, ปิดแก๊ส', sectionTitles: 'เตรียมวัตถุดิบ, สรุปงานลงถ้วย, สรุปงานลงซอง, น้ำพริกค้างแพ็ค, หมายเหตุ', morningNote: 'ไลน์ผลิตและบรรจุเลิก 20.00', lateCauses: 'Breakdown เครื่องจักร, วัตถุดิบไม่พอ / มาช้า, บรรจุภัณฑ์ไม่พอ / มาช้า (ซอง ถ้วย ลัง ฉลาก), วัตถุดิบไม่ผ่าน QC / รอผลตรวจ, สินค้าไม่ผ่าน QC ต้องแก้ไข / ทำใหม่, รอสินค้าจากขั้นก่อนหน้า (ผัด / ทำเย็นยังไม่เสร็จ), คนไม่พอ / พนักงานขาดงาน, งานแทรก / เปลี่ยนแผนด่วน, ปริมาณงานมากกว่ากำลังผลิต, ไฟดับ / น้ำไม่ไหล / แก๊สหมด, ทำความสะอาด / ล้างไลน์ / เปลี่ยนสินค้า', lossCauses: 'ไหม้ / สุกเกิน, หกหล่น, ซีลไม่ติด / ซองรั่ว, น้ำหนักไม่ได้, สิ่งแปลกปลอม, อื่น ๆ',
  workDates: ''   // วันเสาร์ / อาทิตย์ที่มีทำงาน (yyyy-MM-dd คั่นด้วย ,) — ผู้ใช้ขอ 24/11/69
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
  ['rawKg', 'qtyMin', 'qtyMax', 'target', 'sort', 'planBatch', 'planQty', 'actBatch', 'fryKg', 'coolKg', 'yieldPct', 'lossPct', 'actQty', 'actQty2', 'actCases',
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
  // ชุดสาเหตุเสร็จช้าเดิม (ยังไม่เคยแก้เอง) → ใช้ชุดใหม่ที่ครบกว่า
  if (!String(s.people || '').trim() && typeof PRD_PEOPLE_DEFAULT_ !== 'undefined') s.people = PRD_PEOPLE_DEFAULT_;   // รายชื่อผู้บันทึกเริ่มต้น (ProdPeople.gs)
  // ผู้ใช้ขอ 21/11/69: ให้รายชื่อผู้บันทึกมี 5 ชื่อนี้ (ณิชกมล พรชัย ธัญญลักษณ์ ชัชชัย นงลักษณ์) — เติมชื่อที่ขาดลงชีตครั้งเดียว (หลังจากนั้นลบ / แก้เองได้ในตั้งค่า)
  if (typeof PRD_PEOPLE_DEFAULT_ !== 'undefined' && String(s.people || '').trim() && s.people !== PRD_PEOPLE_DEFAULT_) {
    var pp = PropertiesService.getScriptProperties();
    if (!pp.getProperty('PRD_PEOPLE_MERGED_691121')) {
      var cur = String(s.people).split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String);
      var add = PRD_PEOPLE_DEFAULT_.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x && cur.indexOf(x) < 0; });
      if (add.length) {
        s.people = cur.concat(add).join(', ');
        try { var row = purRead_(ss, 'prd_settings').filter(function (x) { return x.id === 'people'; })[0]; if (row) purWrite_(ss, 'prd_settings', Object.assign(row, { value: s.people })); } catch (e) {}
      }
      pp.setProperty('PRD_PEOPLE_MERGED_691121', '1');
    }
  }
  PRD_WORKD_ = String(s.workDates || '').split(/[,\s]+/).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
  if (s.checks === 'ปิดน้ำ, ปิดไฟ, ปิดแอร์') s.checks = PRD_SETTINGS_DEFAULT_.checks;   // ชุดเดิม → เพิ่มปิดแก๊ส
  if (s.lateCauses === 'Breakdown เครื่องจักร, วัตถุดิบไม่พอ / มาช้า, คนไม่พอ, งานแทรก / เปลี่ยนแผน') s.lateCauses = PRD_SETTINGS_DEFAULT_.lateCauses;
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
// แผน: จำนวน + หน่วย (แก้หน่วยได้เอง) — G1/G2 เก็บจำนวนใน planBatch (หน่วยเริ่มต้น batch) · G3 เก็บใน planQty (หน่วยเริ่มต้น ลัง)
function prdPlanUnit_(x) { return String(x.planUnit || '').trim() || (x.grp === 'G3' ? 'ลัง' : 'batch'); }
function prdIsBatch_(u) { return /^batch$/i.test(String(u || '').trim()); }
// น้ำหนัก: ชีตเก็บเป็น กก. เสมอ (คำนวณ Yield / Dashboard ได้ตรง) + เก็บหน่วยที่ผู้กรอกเลือกไว้แสดงกลับ
var PRD_W_ = { 'กก.': 1, 'กรัม': 0.001 };
function prdWUnit_(u) { return PRD_W_[String(u || '').trim()] ? String(u).trim() : 'กก.'; }
function prdToKg_(v, u) { return v === '' || v == null ? '' : Math.round(Number(v) * PRD_W_[prdWUnit_(u)] * 1000) / 1000; }
function prdW_(kg, u) { u = prdWUnit_(u); return kg === '' || kg == null ? '-' : prdFmt_(Math.round(Number(kg) / PRD_W_[u] * 1000) / 1000) + ' ' + u; }
// จำนวน batch ตามสัดส่วน: batch = ตามนั้น · น้ำหนัก (กก. / กรัม) = น้ำหนักวัตถุดิบ ÷ วัตถุดิบมาตรฐานต่อ batch
function prdBatches_(n, unit, prod) {
  if (n === '' || n == null) return '';
  if (!String(unit || '').trim() || prdIsBatch_(unit)) return Number(n);
  if (PRD_W_[String(unit).trim()] && prod && Number(prod.rawKg) > 0) return prdToKg_(n, unit) / Number(prod.rawKg);
  return '';
}
function prdPlanText_(x) {
  var n = x.grp === 'G3' ? x.planQty : x.planBatch;
  return n === '' || n == null ? '' : prdFmt_(n) + ' ' + prdPlanUnit_(x);
}
function prdCalc_(o, prod, s) {
  var base = o.coolKg !== '' ? o.coolKg : o.fryKg;
  o.yieldPct = o.grp === 'G2' && o.rawKg && base !== '' ? Math.round(base / o.rawKg * 10000) / 100 : '';
  o.lossPct = o.yieldPct === '' ? '' : Math.round((100 - o.yieldPct) * 100) / 100;
  // ช่วงที่ควรได้ คิดจากแผน (ไม่เปลี่ยนตามที่กรอกผล): แผนเป็น batch / น้ำหนัก → คิดตามสัดส่วน · แผนเป็นหน่วยสินค้า → ควรได้ = แผน
  var pu = prdPlanUnit_(o), b = prdBatches_(o.planBatch, pu, prod), same = prod && o.planBatch !== '' && String(pu).trim() === String(prod.unit || '').trim();
  if (b === '' && !same) b = prdBatches_(o.actBatch, o.actBatchUnit, prod);
  o.expMin = prod && o.grp === 'G2' ? (same ? Number(o.planBatch) : b !== '' && prod.qtyMin !== '' ? Math.round(prod.qtyMin * b) : '') : '';
  o.expMax = prod && o.grp === 'G2' ? (same ? Number(o.planBatch) : b !== '' && prod.qtyMax !== '' ? Math.round(prod.qtyMax * b) : '') : '';
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
    breakdowns: purRead_(ss, 'prd_breakdowns').filter(inRange).map(prdBdOut_),
    line: { token: !!p.getProperty('PROD_LINE_TOKEN'), group: !!p.getProperty('PROD_LINE_GROUP'), setupCode: hrProp_('PROD_LINE_SETUP', hrSetupCode_), webhook: ACC_WEBHOOK_URL_, botName: prdBotName_(), sharedAcc: !!p.getProperty('PROD_LINE_TOKEN') && p.getProperty('PROD_LINE_TOKEN') === p.getProperty('ACC_LINE_TOKEN'), accBot: !!p.getProperty('ACC_LINE_TOKEN') } };
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
// วันทำงานถัดไป: ข้ามเสาร์ / อาทิตย์ → วันจันทร์ ยกเว้นเสาร์ / อาทิตย์ที่ตั้งว่ามีทำงาน (setting workDates) หรือมีแผนผลิตของวันนั้น (ผู้ใช้ขอ 24/11/69)
var PRD_WORKD_ = [];
function prdIsWork_(iso, all) {
  var p = String(iso).split('-'), w = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  if (w !== 0 && w !== 6) return true;
  if (PRD_WORKD_.indexOf(iso) >= 0) return true;
  return (all || []).some(function (x) { return x.date === iso && x.status !== 'cancel'; });
}
function prdNextWork_(iso, all) {
  var p = String(iso).split('-'), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + 1));
  for (var k = 0; k < 7 && !prdIsWork_(t.toISOString().slice(0, 10), all); k++) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
// เปิด / ปิด วันเสาร์ / อาทิตย์เป็นวันทำงาน (งาน G1 ที่ค้างจะยกมาวันนั้น)
function prdSetWorkDate(token, date, on) {
  var dept = requirePrd_(token);
  date = purDate_(date);
  if (!date) return { ok: false, error: 'ใส่วันที่' };
  return purLocked_(function () {
    var ss = prdBook_(dept), s = prdSettings_(ss), list = PRD_WORKD_.filter(function (d) { return d !== date; });
    if (on) list.push(date);
    list = list.filter(function (d) { return d >= Utilities.formatDate(new Date(Date.now() - 400 * 864e5), PUR_TZ_, 'yyyy-MM-dd'); }).sort();
    var rows = purRead_(ss, 'prd_settings'), r = rows.filter(function (x) { return x.id === 'workDates'; })[0];
    purWrite_(ss, 'prd_settings', r ? Object.assign(r, { value: list.join(', ') }) : { id: 'workDates', value: list.join(', ') });
    purLogWrite_(ss, on ? 'ตั้งเป็นวันทำงาน' : 'ยกเลิกวันทำงาน', 'prd_settings', 'workDates', date);
    return { ok: true, workDates: list.join(', ') };
  });
}
// งานค้างจากวันก่อน (ย้อนไม่เกิน 14 วัน): ยังไม่เสร็จ หรือเพิ่งเสร็จในวันนี้ — แสดงต่อในสรุปเย็นของวันนี้
// G1: ค้างไปเป็นแผนของวันทำงานถัดไป (ตรงเสาร์ / อาทิตย์ → วันจันทร์; ผู้ใช้ขอ 24/11/69)
function prdCarried_(all, date) {
  var p = String(date).split('-'), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] - 14)), from = t.toISOString().slice(0, 10);
  return all.filter(function (x) { return x.date < date && x.date >= from && x.status !== 'cancel' && (!x.finishDate || x.finishDate === date) && (x.grp !== 'G1' || prdNextWork_(x.date, all) <= date); });
}
// แผนเช้า = แผนของวันนี้ + งาน G1 ที่ยังค้าง (ยังไม่เสร็จ)
function prdMorningPlans_(all, date) {
  return all.filter(function (x) { return x.date === date; }).concat(prdCarried_(all, date).filter(function (x) { return x.grp === 'G1' && !x.finishDate; }));
}
// จำนวนที่ได้จริง + หน่วยที่ 2 (G1 บรรจุได้ เป็นชิ้น · G2 ผลิตได้จริง เป็น batch)
function prdQty2_(x) { return x.actQty2 === '' || x.actQty2 == null ? '' : prdFmt_(x.actQty2) + ' ' + (x.unit2 || (x.grp === 'G2' ? 'batch' : 'ชิ้น')); }
function prdTh_(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2) : String(iso || ''); }
function prdCleanPlan_(p, s) {
  var grp = PRD_GROUPS_[p.grp] ? p.grp : 'G2';
  var o = { grp: grp, date: purDate_(p.date), productId: purClean_(p.productId, 20), product: purClean_(p.product, 150), lot: prdLotIso_(p.lot),
    planBatch: prdNum_(p.planBatch, 1e7), planQty: prdNum_(p.planQty, 1e7), planUnit: purClean_(p.planUnit, 20), dueDate: purDate_(p.dueDate),
    actBatch: prdNum_(p.actBatch, 1e7), actBatchUnit: /^(batch|กก\.|กรัม)$/.test(p.actBatchUnit) ? p.actBatchUnit : '',
    rawUnit: prdWUnit_(p.rawUnit), fryUnit: prdWUnit_(p.fryUnit), coolUnit: prdWUnit_(p.coolUnit), lossKgUnit: prdWUnit_(p.lossKgUnit), lossQtyUnit: purClean_(p.lossQtyUnit, 20),
    rawKg: prdNum_(prdToKg_(purNum_(p.rawKg), p.rawUnit), 1e6), fryKg: prdNum_(prdToKg_(purNum_(p.fryKg), p.fryUnit), 1e6), coolKg: prdNum_(prdToKg_(purNum_(p.coolKg), p.coolUnit), 1e6),
    actQty: prdNum_(p.actQty, 1e7), unit: purClean_(p.unit, 20), actQty2: prdNum_(p.actQty2, 1e7), unit2: purClean_(p.unit2, 20), actCases: prdNum_(p.actCases, 1e6), lossKg: prdNum_(prdToKg_(purNum_(p.lossKg), p.lossKgUnit), 1e6), lossQty: prdNum_(p.lossQty, 1e7),
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
    var now = purNow_(), o = old || { id: purId_('BD'), files: '[]', createdAt: now };
    o.date = date; o.grp = PRD_GROUPS_[b.grp] ? b.grp : ''; o.machine = machine; o.start = start; o.end = end; o.minutes = mins;
    o.problem = prdText_(b.problem, 800); o.cause = prdText_(b.cause, 800); o.fix = prdText_(b.fix, 800); o.by = purClean_(b.by, 60); o.updatedAt = now;
    purWrite_(ss, 'prd_breakdowns', o);
    purLogWrite_(ss, old ? 'แก้ Breakdown' : 'บันทึก Breakdown', 'prd_breakdowns', o.id, date + ' · ' + machine + ' · ' + start + '–' + (end || '?'));
    return { ok: true, breakdown: prdBdOut_(purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === o.id; })[0]) };
  });
}
function prdBdOut_(b) { b.files = purParseFiles_(b.files); return b; }
// รูปของ Breakdown (ถ่ายจากกล้อง / เลือกจากคลัง) — เก็บในโฟลเดอร์ "รูปรายงานผลิต" เดียวกับรูปสรุปเย็น
function prdUploadBdPhoto(token, id, fileName, mimeType, base64) {
  var dept = requirePrd_(token);
  if (!/^image\/(jpeg|png)$/.test(mimeType)) return { ok: false, error: 'แนบได้เฉพาะรูป JPG / PNG' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return { ok: false, error: 'รูปว่างหรือใหญ่เกิน 8 MB' };
  return purLocked_(function () {
    var ss = prdBook_(dept), o = purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, error: 'บันทึก Breakdown ก่อน แล้วค่อยแนบรูป' };
    var files = purParseFiles_(o.files);
    if (files.length >= 10) return { ok: false, error: 'แนบได้สูงสุด 10 รูปต่อรายการ' };
    var safe = purClean_(fileName, 80).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
    var f = prdPhotoFolder_(dept).createFile(Utilities.newBlob(bytes, mimeType, 'BD_' + o.date + '_' + String(o.machine).slice(0, 30) + '_' + safe));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    files.push({ id: f.getId(), name: safe, url: 'https://lh3.googleusercontent.com/d/' + f.getId(), at: purNow_() });
    o.files = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'prd_breakdowns', o);
    return { ok: true, files: files };
  });
}
function prdRemoveBdPhoto(token, id, fileId) {
  var dept = requirePrd_(token);
  return purLocked_(function () {
    var ss = prdBook_(dept), o = purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบรายการนี้' };
    var files = purParseFiles_(o.files).filter(function (x) { return x.id !== fileId; });
    o.files = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'prd_breakdowns', o);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    return { ok: true, files: files };
  });
}
function prdDeleteBreakdown(token, id) {
  var dept = requirePrd_(token);
  return purLocked_(function () {
    var ss = prdBook_(dept), row = purRead_(ss, 'prd_breakdowns').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    purParseFiles_(row.files).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
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
    var plans = (Array.isArray(x.plans) ? x.plans : []).slice(0, 80).map(function (id) { return purClean_(id, 30); }).filter(String);
    return { title: purClean_(x.title, 80), rows: rows, text: prdText_(x.text, 2000), plans: plans };
  }).filter(function (x) { return x.title || x.rows.length || x.text || x.plans.length; });
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
    // รายการ Breakdown ล่าสุด พร้อมปัญหา / สาเหตุ / การแก้ไข / รูป (ผู้ใช้ขอ 26/11/69 — แสดงทั้งหน้าฝ่ายผลิตและผู้บริหาร)
    bdList: bds.slice().sort(function (a, b) { return String(b.date + b.start).localeCompare(String(a.date + a.start)); }).slice(0, 30).map(function (b) {
      return { date: b.date, grp: b.grp, machine: b.machine, start: b.start, end: b.end, minutes: b.minutes, problem: b.problem, cause: b.cause || '', fix: b.fix, by: b.by,
        files: purParseFiles_(b.files).slice(0, 6).map(function (f) { return { url: f.url }; }) };
    }),
    machines: Object.keys(byMachine).map(function (k) { return byMachine[k]; }).sort(function (a, b) { return b.minutes - a.minutes; }),
    days: Object.keys(days).sort().map(function (k) { var o = days[k]; return { date: k, yieldPct: o.raw ? Math.round(o.out / o.raw * 1000) / 10 : null }; }) };
}

// ---------- LINE ----------
// วันที่แบบไลน์ผลิตใช้: 17.11.26
function prdDot_(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + String(+p[0] + 543).slice(2) : String(iso || ''); }
function prdSlash_(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2) : String(iso || ''); }
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
function prdCard_(kicker, title, sub, body, alt, headColor, by) {
  // ป้ายหัวการ์ด (DAILY REPORT · G1/G2/G3, PRODUCTION PLAN) = ป้ายขาวตัวใหญ่ ตัวอักษรสีกลุ่ม (ผู้ใช้ขอให้เห็นชัด 23/11/69)
  var badge = prdBox_([prdT_(kicker, { size: 'xl', color: headColor || PRD_COLOR_, weight: 'bold', align: 'center' })],
    { backgroundColor: '#FFFFFF', cornerRadius: '12px', paddingTop: '6px', paddingBottom: '6px', paddingStart: '12px', paddingEnd: '12px' });
  var inner = [prdBox_([badge, prdT_(title, { size: 'xl', color: '#FFFFFF', weight: 'bold', margin: 'md' }),
    prdT_(sub, { size: 'xs', color: '#CFFAFE', margin: 'xs' })]
    // ชื่อผู้รายงาน: แถบไฮไลท์ขนาดปกติ (ผู้ใช้ขอ 23/11/69 — ตัวใหญ่ชัดเกินไป)
    .concat(by ? [prdBox_([prdT_('รายงานโดย ' + by, { size: 'sm', color: '#FFFFFF', weight: 'bold' })], { margin: 'sm', backgroundColor: '#00000033', cornerRadius: '8px', paddingTop: '3px', paddingBottom: '3px', paddingStart: '10px', paddingEnd: '10px' })] : []),
    { backgroundColor: headColor || PRD_COLOR_, cornerRadius: '18px', paddingAll: '18px' }),
    prdBox_(body, { paddingStart: '6px', paddingEnd: '6px', paddingTop: '4px', paddingBottom: '4px' })];
  return { type: 'flex', altText: alt.slice(0, 390), contents: { type: 'bubble', size: 'giga', body: prdBox_(inner, { paddingAll: '14px', backgroundColor: '#FFFFFF' }) } };
}
// หัวข้อ = แถบสีเต็มแถบ ตัวอักษรขาว (ผู้ใช้ขอให้ชัดเจน 17/11/69)
function prdSec_(label, color) {
  return prdBox_([prdT_(label, { size: 'md', weight: 'bold', color: '#FFFFFF' })], { margin: 'xl', backgroundColor: color, cornerRadius: '10px', paddingTop: '8px', paddingBottom: '8px', paddingStart: '12px', paddingEnd: '12px' });
}
// แถวรายการ: เลข · ชื่อ (+ บรรทัดรอง) · ค่าทางขวา
function prdRow_(no, name, sub, right, rightColor) {
  var left = [prdT_(name, { size: 'sm', weight: 'bold', color: '#0F172A' })];
  (sub || []).forEach(function (s) { if (s) left.push(prdT_(s.t || s, { size: 'xs', color: s.c || '#64748B', margin: 'xs' })); });
  var c = [prdT_(no + '.', { size: 'sm', color: '#94A3B8', flex: 0 }), prdBox_(left, { flex: 6, margin: 'sm' })];
  // ผู้ใช้ขอ 26/11/69: จำนวน 2 หน่วย (เช่น 8,064 กระปุก ; 336 ลัง) ยาวเกินช่องขวา → ขึ้นบรรทัดเดียวเต็มแถวใต้ชื่อ ชิดขวา ไม่ตัดบรรทัด
  var wide = right && / ; /.test(right);
  if (right && !wide) c.push(prdT_(right, { size: 'sm', weight: 'bold', color: rightColor || '#0F172A', align: 'end', flex: 3 }));
  var rowBox = { type: 'box', layout: 'horizontal', margin: 'md', contents: c };
  if (!wide) return rowBox;
  rowBox.margin = 'none';
  return { type: 'box', layout: 'vertical', margin: 'md', contents: [rowBox, prdT_(right, { size: 'sm', weight: 'bold', color: rightColor || '#0F172A', align: 'end', wrap: false, margin: 'xs' })] };
}
var PRD_GCOLOR_ = { G2: '#EA580C', G1: '#2563EB', G3: '#16A34A' };
var PRD_GTINT_ = { G2: '#FFEDD5', G1: '#DBEAFE', G3: '#DCFCE7' };
function prdMorningFlex_(date, plans, note, by) {
  var body = [], n = 0;
  ['G2', 'G1', 'G3'].forEach(function (g) {
    var list = plans.filter(function (x) { return x.grp === g && x.status !== 'cancel'; });
    if (!list.length) return;
    // แต่ละกลุ่ม (อาคาร) เป็นกล่องสีของตัวเอง: แถบหัวสีเข้ม + พื้นสีอ่อน
    var rows = [prdBox_([prdT_(g + ' · ' + PRD_MOR_LABEL_[g], { size: 'md', weight: 'bold', color: '#FFFFFF' }), prdT_(list.length + ' รายการ', { size: 'xxs', color: '#FFFFFF', margin: 'xs' })],
      { backgroundColor: PRD_GCOLOR_[g], cornerRadius: '10px', paddingAll: '10px' })];
    list.forEach(function (x, i) {
      var amt = prdPlanText_(x);
      rows.push(prdRow_(i + 1, x.product, [x.date < date ? { t: '⏳ ค้างจากวันที่ ' + prdTh_(x.date), c: '#7C3AED' } : '', x.lot ? 'LOT ' + prdLotText_(x.lot) : '', x.note], amt, PRD_GCOLOR_[g]));
      n++;
    });
    body.push(prdBox_(rows, { margin: 'lg', backgroundColor: PRD_GTINT_[g], cornerRadius: '14px', paddingAll: '8px', paddingBottom: '12px', borderColor: PRD_GCOLOR_[g], borderWidth: '1px' }));
  });
  if (!n) body.push(prdT_('ยังไม่มีรายการในแผน', { size: 'sm', color: '#64748B', margin: 'lg' }));
  if (note) body.push(prdBox_([prdT_('📌 ' + note, { size: 'sm', color: '#9A3412', weight: 'bold' })], { margin: 'xl', backgroundColor: '#FFF7ED', cornerRadius: '12px', paddingAll: '12px' }));
  return prdCard_('PRODUCTION PLAN', 'แผนผลิต ' + prdDot_(date), 'บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายผลิต · ' + n + ' รายการ', body,
    'แผนผลิต ' + prdDot_(date) + ' · ' + n + ' รายการ', null, by || '');
}
function prdEveningFlex_(date, grp, plans, rep, target, prods) {
  var body = [], mine = plans.filter(function (x) { return x.grp === grp && x.status !== 'cancel'; });
  var list = mine.filter(function (x) { return x.date === date; }), carried = mine.filter(function (x) { return x.date < date; });
  var dpt = String(date).split('-'), dTh = dpt[2] + '/' + dpt[1] + '/' + String(+dpt[0] + 543).slice(2);
  // หัวข้อที่ผู้ใช้แก้ได้ + วันที่ต่อท้ายอัตโนมัติเสมอ (ถ้าเคยพิมพ์วันที่ไว้เองให้ตัดออกก่อน)
  var title = String((rep && rep.title) || PRD_EVE_TITLE_[grp]).replace(/\s*ประจำวันที่.*$/, '') || PRD_EVE_TITLE_[grp];
  title += ' ประจำวันที่ ' + dTh;
  var unitOf = function (x) { return x.unit || (prods[x.productId] || {}).unit || 'ชิ้น'; };
  var row = function (x, i) {
    var sub = [], right = '', rc = '#0F172A';
    if (x.lot) sub.push('LOT ' + prdLotText_(x.lot));
    if (grp === 'G2') {
      var b = x.actBatch !== '' ? x.actBatch : x.planBatch;
      // บรรทัดจำนวน batch / น้ำหนักวัตถุดิบ → หลังผัด / หลังทำเย็น ไม่แสดงใน LINE (ผู้ใช้ขอเอาออก 17/11/69) — ดูได้ในหน้าระบบ
      if (x.actQty !== '') {
        var ok = x.expMin === '' || (x.actQty >= x.expMin && x.actQty <= x.expMax);
        var qc = ok ? '#15803D' : x.actQty < x.expMin ? '#B91C1C' : '#C2410C';   // ตามช่วง เขียว · น้อยกว่า แดง · เกิน ส้ม
        // ไม่แสดงบรรทัด ตามช่วง / ควรได้ ใน LINE (ผู้ใช้ขอเอาออก 17/11/69) — ดูได้ในหน้าระบบ
        right = prdFmt_(x.actQty) + ' ' + unitOf(x);
      } else right = 'ยังไม่กรอก';
      // ผู้ใช้ขอ 24/11/69: แสดงจำนวนเดียว — ค่าที่ G1 กรอกเป็นหน่วย batch ก่อน (ช่องผลิตได้จริง batch / ช่องจำนวนที่ผลิตได้จริง) ถ้าไม่มี batch ใช้หน่วยอื่นที่กรอกไว้
      var qs = [{ q: x.actQty, u: unitOf(x) }, { q: x.actQty2, u: x.unit2 || 'batch' }].filter(function (o) { return o.q !== '' && o.q != null; });
      var pick = qs.filter(function (o) { return /^batch$/i.test(String(o.u).trim()); })[0] || qs[0];
      // ผู้ใช้ขอ 24/11/69: G1 ยังไม่กรอก → ใช้ "ทำจริง" ที่ G2 กรอกไว้เลย ไม่ต้องรอ G1
      if (!pick && x.actBatch !== '' && x.actBatch != null) pick = { q: x.actBatch, u: x.actBatchUnit || 'batch' };
      right = pick ? prdFmt_(pick.q) + ' ' + pick.u : 'ยังไม่กรอก';
    } else if (grp === 'G1') {
      right = [x.actQty !== '' ? prdFmt_(x.actQty) + ' ' + unitOf(x) : '', prdQty2_(x)].filter(String).join(' ; ') || 'ยังไม่กรอก';
      if (prdPlanText_(x)) sub[0] = (sub[0] ? sub[0] + ' · ' : '') + prdPlanText_(x);
    } else {
      right = [x.actQty !== '' ? prdFmt_(x.actQty) + ' ' + unitOf(x) : '', x.actCases !== '' ? prdFmt_(x.actCases) + ' ลัง' : ''].filter(String).join(' ; ') || 'ยังไม่กรอก';
    }
    // ของเสียไม่แสดงใน LINE (ผู้ใช้ขอเอาออก 17/11/69) — ดูได้ในหน้าระบบ / Dashboard
    var fs = prdFinishState_(x, purToday_()), dl = prdDeadline_(x);
    if (fs === 'ok') sub.push({ t: '🏁 เสร็จ ' + prdTh_(x.finishDate) + ' ตามกำหนด', c: '#15803D' });
    else if (fs === 'wait') sub.push({ t: '⏳ ยังไม่เสร็จ · กำหนดเสร็จ ' + prdTh_(dl), c: '#64748B' });
    else sub.push({ t: '⚠️ ' + (fs === 'late' ? 'เสร็จ ' + prdTh_(x.finishDate) + ' ช้ากว่ากำหนด' : 'ยังไม่เสร็จ เลยกำหนด') + ' (กำหนด ' + prdTh_(dl) + ')' + (x.lateCause ? ' · สาเหตุ: ' + x.lateCause : ''), c: '#B91C1C' });
    if (x.note) sub.push(x.note);
    if (x.date < date) sub.unshift({ t: 'ค้างจากวันที่ ' + prdTh_(x.date), c: '#7C3AED' });
    body.push(prdRow_(i + 1, x.product, sub, right, rc));
  };
  // หัวข้อในข้อความ: รายการจากแผนวันนี้ขึ้นให้อัตโนมัติ (อยู่หัวข้อที่เลือกไว้ / ไม่ได้เลือก = หัวข้อแรก) + รายการที่พิมพ์เพิ่ม — รูปแบบเดียวกัน
  var secs = prdSections_(rep && rep.sections);
  if (!secs.some(function (x) { return Array.isArray(x.plans); })) secs.unshift({ title: PRD_EVE_SEC_[grp], rows: [], text: '', plans: [] });   // รายงานเก่า
  var where = {};
  secs.forEach(function (sec, k) { (sec.plans || []).forEach(function (id) { if (where[id] == null) where[id] = k; }); });
  var shown = 0;
  secs.forEach(function (sec, k) {
    var its = list.filter(function (x) { return (where[x.id] != null && secs[where[x.id]] ? where[x.id] : 0) === k; });
    var rows = sec.rows || [], lines = String(sec.text || '').split('\n').map(function (l) { return l.trim(); }).filter(String);
    if (!its.length && !rows.length && !lines.length) return;
    shown++;
    body.push(prdSec_(sec.title || PRD_EVE_SEC_[grp], PRD_GCOLOR_[grp]));
    its.forEach(row);
    rows.forEach(function (r, i) {
      var amt = r.qty !== '' && r.qty != null ? prdFmt_(r.qty) + ' ' + (r.unit || '') : '';
      body.push(prdRow_(its.length + i + 1, r.product || '-', [r.lot ? 'LOT ' + prdLotText_(r.lot) : ''], amt.trim(), '#0F172A'));
    });
    lines.forEach(function (l) { var head = /^\d+[.)]/.test(l); body.push(prdT_(l, { size: 'sm', color: head ? '#0F172A' : '#475569', margin: head ? 'md' : 'xs', weight: head ? 'bold' : 'regular' })); });
  });
  if (carried.length) { body.push(prdSec_('งานค้างจากวันก่อน (' + carried.length + ' รายการ)', '#7C3AED')); carried.forEach(row); }
  if (!shown && !carried.length) body.push(prdT_('ไม่มีรายการ', { size: 'sm', color: '#64748B', margin: 'md' }));
  body.push(prdSec_('ปัญหาที่พบ', '#64748B'));
  body.push(prdT_(rep && rep.problems ? rep.problems : 'ไม่พบปัญหา', { size: 'sm', color: rep && rep.problems ? '#334155' : '#15803D', margin: 'sm' }));
  if (rep && rep.checks) body.push(prdBox_([prdT_('✅ ' + rep.checks + ' เรียบร้อย', { size: 'sm', color: '#166534', weight: 'bold' })], { margin: 'xl', backgroundColor: '#F0FDF4', cornerRadius: '12px', paddingAll: '12px' }));
  var nPhotos = rep ? purParseFiles_(rep.files).length : 0;
  if (nPhotos) body.push(prdT_('📷 รูปประกอบ ' + nPhotos + ' รูป อยู่ในข้อความถัดไป', { size: 'xxs', color: '#64748B', margin: 'md', align: 'center' }));
  return prdCard_('DAILY REPORT · ' + grp, title, grp + ' · ' + PRD_GROUPS_[grp], body,
    title, PRD_GCOLOR_[grp] === '#16A34A' ? '#15803D' : PRD_GCOLOR_[grp] === '#2563EB' ? '#1D4ED8' : '#C2410C', rep && rep.by ? rep.by : '');
}
// ส่ง LINE: kind = morning (แผนทั้งวัน) | evening (สรุปของกลุ่ม grp + รูปแยกเป็นภาพ)
function prdSendLine(token, kind, date, grp, by) {
  var dept = requirePrd_(token);
  date = purDate_(date);
  if (!date) return { ok: false, error: 'ใส่วันที่' };
  kind = kind === 'evening' ? 'evening' : 'morning';
  if (kind === 'evening' && !PRD_GROUPS_[grp]) return { ok: false, error: 'เลือกกลุ่มงาน' };
  return purLocked_(function () {
    var ss = prdBook_(dept), s = prdSettings_(ss), allPlans = purRead_(ss, 'prd_plans'), plans = allPlans.filter(function (x) { return x.date === date; });
    var prods = {}; purRead_(ss, 'prd_products').forEach(function (p) { prods[p.id] = p; });
    var rep = prdReport_(ss, date, kind, kind === 'evening' ? grp : ''), msgs;
    if (kind === 'morning') {
      plans = prdMorningPlans_(allPlans, date);
      if (!plans.length) return { ok: false, error: 'ยังไม่มีแผนผลิตของวันนี้' };
      msgs = [prdMorningFlex_(date, plans, rep && rep.note ? rep.note : s.morningNote, by || (rep && rep.by))];
    } else {
      msgs = [prdEveningFlex_(date, grp, plans.concat(prdCarried_(allPlans, date)), rep, Number(s.target) || 85, prods)];
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
  var allPlans = purRead_(ss, 'prd_plans'), plans = allPlans.filter(function (x) { return x.date === date; }), prods = {};
  purRead_(ss, 'prd_products').forEach(function (p) { prods[p.id] = p; });
  if (kind === 'evening') {
    var rep = prdReport_(ss, date, 'evening', grp);
    return { ok: true, flex: prdEveningFlex_(date, grp, plans.concat(prdCarried_(allPlans, date)), rep, Number(s.target) || 85, prods),
      photos: rep ? purParseFiles_(rep.files).length : 0 };
  }
  var mr = prdReport_(ss, date, 'morning', '');
  return { ok: true, flex: prdMorningFlex_(date, prdMorningPlans_(allPlans, date), mr && mr.note ? mr.note : s.morningNote, mr && mr.by), photos: 0 };
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
  CacheService.getScriptCache().remove('prd_bot_id'); CacheService.getScriptCache().remove('prd_bot_name');
  if (old && old !== v) p.deleteProperty('PROD_LINE_GROUP');   // เปลี่ยน OA → ต้องผูกกลุ่มใหม่
  return { ok: true, botName: info.displayName || '', regroup: !!(old && old !== v), line: { token: true, group: !!p.getProperty('PROD_LINE_GROUP'), setupCode: hrProp_('PROD_LINE_SETUP', hrSetupCode_), webhook: ACC_WEBHOOK_URL_ } };
}
// ใช้บอท LINE ตัวเดียวกับฝ่ายบัญชี (คัดลอก ACC_LINE_TOKEN ฝั่งเซิร์ฟเวอร์ ไม่ส่ง token ออกไป) → ต้องผูกกลุ่มฝ่ายผลิตใหม่ด้วยคำสั่ง "ตั้งค่ากลุ่ม ผลิต <รหัส>"
// ในกลุ่มที่มีบอทบัญชีอยู่ (webhook แยกคำสั่งที่มีคำว่า ผลิต ไปฝ่ายผลิต)
function prdUseAccBot(token) {
  requirePrd_(token);
  var p = props_(), acc = p.getProperty('ACC_LINE_TOKEN');
  if (!acc) return { ok: false, error: 'ฝ่ายบัญชียังไม่ได้ตั้งบอท LINE' };
  if (p.getProperty('PROD_LINE_TOKEN') === acc) return { ok: false, error: 'ใช้บอทเดียวกับฝ่ายบัญชีอยู่แล้ว' };
  p.setProperty('PROD_LINE_TOKEN', acc);
  p.deleteProperty('PROD_LINE_GROUP');
  var c = CacheService.getScriptCache(); c.remove('prd_bot_id'); c.remove('prd_bot_name');
  return { ok: true, line: { token: true, group: false, setupCode: hrProp_('PROD_LINE_SETUP', hrSetupCode_), webhook: ACC_WEBHOOK_URL_, botName: prdBotName_(), sharedAcc: true } };
}
function prdLineTest(token) {
  requirePrd_(token);
  return prdLinePush_([{ type: 'text', text: '✅ ทดสอบการเชื่อมต่อ: ระบบงานองค์กร ฝ่ายผลิต ส่งข้อความเข้ากลุ่มนี้ได้แล้ว' }]);
}
// webhook: บอทของ PROD_LINE_TOKEN — ผูกกลุ่มด้วย "ตั้งค่ากลุ่ม ผลิต <รหัส>"
// ชื่อบอท LINE ของฝ่ายผลิต (แสดงในหน้าตั้งค่า ให้รู้ว่าต้องเชิญบอทตัวไหนเข้ากลุ่ม) — แคช 6 ชม.
function prdBotName_() {
  try {
    var token = props_().getProperty('PROD_LINE_TOKEN'); if (!token) return '';
    var nk = 'prd_bot_name_' + lineTokKey_(token), c = CacheService.getScriptCache(), n = c.get(nk);
    if (n) return n;
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return '';
    n = JSON.parse(res.getContentText()).displayName || '';
    if (n) c.put(nk, n, 21600);
    return n;
  } catch (e) { return ''; }
}
function prdIsMyBot_(destination) {
  try {
    var token = props_().getProperty('PROD_LINE_TOKEN');
    if (!token || !destination) return false;
    var ck = 'prd_bot_id_' + lineTokKey_(token), c = CacheService.getScriptCache(), id = c.get(ck);
    if (!id) {
      var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return false;
      id = JSON.parse(res.getContentText()).userId || '';
      if (id) c.put(ck, id, 21600);
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
        // ไม่ทักทายเมื่อบอทเข้ากลุ่ม (ผู้ใช้ขอ 18/11/69)
        return;
      }
      // บอทถูกนำออกจากกลุ่มที่ผูกไว้ → ยกเลิกการผูก (หน้าตั้งค่าจะขึ้นว่ายังไม่ผูกกลุ่ม)
      if (ev.type === 'leave' && gid && gid === props_().getProperty('PROD_LINE_GROUP')) { props_().deleteProperty('PROD_LINE_GROUP'); return; }
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
