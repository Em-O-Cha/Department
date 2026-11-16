// ==================== ฝ่ายบัญชี (ACC) — รายงานรับออเดอร์ 7-Eleven ====================
//
// ฝ่ายบัญชีดาวน์โหลดไฟล์ Excel ใบสั่งซื้อจากระบบ 7-11 (po_export: 1 แถว = 1 สินค้าในใบสั่ง) แล้วนำเข้าในหน้าเว็บ
// หน้าเว็บอ่านไฟล์เอง (SheetJS) ส่งเฉพาะคอลัมน์ที่ใช้มา → acc711Preview จัดเป็นตาราง "ต้นแบบรับออเดอร์ 7-11"
//   แถว = ศูนย์กระจายสินค้า (จับคำสำคัญจาก Delivery Location กับชื่อศูนย์ในคอลัมน์ B ของต้นแบบ)
//   คอลัมน์ = สินค้า (จับจากรหัสสินค้า 7-11 / คำสำคัญในชื่อ) สีตามต้นแบบ · ช่อง = จำนวนลังที่สั่ง
// ตรวจแล้วกดบันทึก (acc711Save) → แท็บ "ออเดอร์ 7-11" (1 แถว = 1 รายการ) + "นำเข้าไฟล์ 7-11" (1 แถว = 1 ไฟล์)
// ใบสั่งที่เคยบันทึกแล้ว (เลขใบสั่ง + ลำดับรายการ) ไม่บันทึกซ้ำ
// รายงาน PDF: สร้าง Google Sheet หน้าตาเหมือนต้นแบบในโฟลเดอร์ของฝ่าย แล้ว export เป็น PDF (แนวนอน A4)
// ส่ง LINE: LINE OA ของฝ่ายบัญชี — Script Properties ACC_LINE_TOKEN (Channel access token) และ ACC_LINE_GROUP (Group ID)
// ทุกฟังก์ชันต้องมีตั๋วของฝ่ายบัญชี (requireAcc_) · การบันทึก/ลบ/ส่ง บันทึกในแท็บประวัติแก้ไข

var ACC_TABLES_ = {
  acc_711: { tab: 'ออเดอร์ 7-11', cols: [
    ['id', 'รหัส'], ['importId', 'รหัสการนำเข้า'], ['poNo', 'เลขที่ใบสั่งซื้อ'], ['lineNo', 'ลำดับรายการ'], ['poDate', 'วันที่สั่ง'],
    ['deliveryDate', 'วันที่ส่ง'], ['deliveryTime', 'เวลาส่ง'], ['locCode', 'รหัสคลัง 7-11'], ['location', 'Delivery Location'], ['dc', 'ศูนย์กระจายสินค้า'],
    ['itemCode', 'รหัสสินค้า 7-11'], ['barcode', 'บาร์โค้ด'], ['itemName', 'ชื่อสินค้า (7-11)'], ['product', 'สินค้าในรายงาน'], ['cases', 'จำนวนลัง'],
    ['packSize', 'ชิ้นต่อลัง'], ['casePrice', 'ราคาต่อลัง (สุทธิ)'], ['amount', 'มูลค่า (ไม่รวม VAT)'], ['vatRate', 'VAT %'],
    ['termDays', 'เครดิต (วัน)'], ['dueDate', 'ครบกำหนดรับเงิน'], ['createdAt', 'บันทึกเมื่อ']] },
  acc_imports: { tab: 'นำเข้าไฟล์ 7-11', cols: [
    ['id', 'รหัส'], ['fileName', 'ชื่อไฟล์'], ['poDate', 'วันที่สั่ง'], ['deliveryDate', 'วันที่ส่ง'], ['poCount', 'จำนวนใบสั่ง'],
    ['lineCount', 'จำนวนรายการ'], ['cases', 'รวมลัง'], ['amount', 'มูลค่ารวม (ไม่รวม VAT)'], ['vat', 'VAT'], ['skipped', 'ข้าม (เคยบันทึกแล้ว)'],
    ['pdfUrl', 'ไฟล์ PDF'], ['sheetUrl', 'ไฟล์รายงาน (Google Sheet)'], ['xlsxUrl', 'ไฟล์ Excel'], ['imgUrl', 'ภาพตาราง (LINE)'], ['imgRatio', 'สัดส่วนภาพ'], ['sentAt', 'ส่ง LINE เมื่อ'], ['createdAt', 'นำเข้าเมื่อ']] },
  acc_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] }
};

// ---------- ต้นแบบรับออเดอร์ 7-11 (ลำดับ ชื่อ สี ตามไฟล์ต้นแบบ) — แก้การจับคู่ได้ในหน้าตั้งค่า ----------
// ศูนย์: name = ชื่อในคอลัมน์ B ของต้นแบบ · keywords = คำที่ต้องพบใน Delivery Location · codes = รหัสคลัง (Delivery Location Number) สำรอง
var ACC_DC_DEFAULT_ = [
  { name: 'มหาชัย', keywords: ['มหาชัย'], codes: ['W901'] },
  { name: 'ขอนแก่น', keywords: ['ขอนแก่น'], codes: ['W801'] },
  { name: 'สุวรรณภูมิ', keywords: ['สุวรรณภูมิ'], codes: ['W501'] },
  { name: 'สุราษฎร์', keywords: ['สุราษฎร์'], codes: ['W401'] },
  { name: 'ลำพูน', keywords: ['ลำพูน'], codes: ['W301'] },
  { name: 'นครสวรรค์', keywords: ['นครสวรรค์'], codes: ['W151'] },
  { name: 'หาดใหญ่', keywords: ['หาดใหญ่'], codes: ['W141'] },
  { name: 'บุรีรัมย์', keywords: ['บุรีรัมย์'], codes: ['W131'] },
  { name: 'ชลบุรี', keywords: ['ชลบุรี'], codes: ['W121'] },
  { name: 'บางบัวทอง', keywords: ['บางบัวทอง'], codes: ['W101'] }
];
// สินค้า: key = รหัสคอลัมน์ · l1/l2 = หัวคอลัมน์ 2 บรรทัด · color = สีตามต้นแบบ · codes = รหัสสินค้า 7-11 (Buyer's internal Product Code)
var ACC_PRODUCT_DEFAULT_ = [
  { key: 'P01', l1: 'น้ำพริก', l2: 'ปลาดุกฟูผัดพริกขิง', color: '#B3CEFB', codes: ['3202403'], keywords: ['ปลาดุกฟู'] },
  { key: 'P02', l1: 'น้ำพริก', l2: 'ปลาแซลมอน (35 กรัม)', color: '#FFA766', codes: ['3203072'], keywords: [] },
  { key: 'P03', l1: 'น้ำพริก', l2: 'หมึกย่างสามรส', color: '#FDD768', codes: ['3203391'], keywords: ['หมึกย่าง'] },
  { key: 'P04', l1: 'น้ำพริก 80g', l2: 'ปลาแซลมอน', color: '#FF7053', codes: ['3203892'], keywords: [] },
  { key: 'P05', l1: 'น้ำพริก', l2: 'น้ำย้อย', color: '#FF9999', codes: ['3203912'], keywords: ['น้ำย้อย'] },
  { key: 'P06', l1: 'น้ำพริก', l2: 'ลงเรือกรอบ', color: '#CC9900', codes: ['3203914'], keywords: ['ลงเรือ'] },
  { key: 'P07', l1: 'น้ำพริก', l2: 'ตะไคร้หอม', color: '#A6E4B7', codes: ['3203916'], keywords: ['ตะไคร้'] },
  { key: 'P08', l1: 'น้ำพริกแซลมอน', l2: 'รสต้มยำ', color: '#FFC000', codes: ['3203976'], keywords: [] },
  { key: 'P09', l1: 'น้ำพริกแซลมอน', l2: 'รสผัดฉ่า', color: '#92D050', codes: ['3203978'], keywords: ['ผัดฉ่า'] },
  { key: 'P10', l1: 'น้ำพริกแซลมอน', l2: 'รสคั่วกลิ้ง', color: '#FFFF00', codes: ['3203980'], keywords: ['คั่วกลิ้ง'] },
  { key: 'P11', l1: 'น้ำพริก 70g', l2: 'หนังปลาแซลม่อน', color: '#F7B4AE', codes: ['3204254'], keywords: [] },
  { key: 'P12', l1: 'น้ำพริก 70g', l2: 'ปูอัดกรอบ', color: '#F7CFED', codes: ['3204267'], keywords: ['ปูอัด'] },
  { key: 'P13', l1: 'พริกผัด', l2: 'น้ำมันมะกอก', color: '#D3F1DB', codes: ['3204430'], keywords: ['มะกอก'] },
  { key: 'P14', l1: 'ก๋วยเตี๋ยวเรือ', l2: '', color: '#FF7C80', codes: ['3301919'], keywords: ['ก๋วยเตี๋ยวเรือ'] },
  { key: 'P15', l1: 'ก๋วยเตี๋ยวแห้ง', l2: '', color: '#FDE49B', codes: [], keywords: ['ก๋วยเตี๋ยวแห้ง'] },
  { key: 'P16', l1: 'หมี่คลุก', l2: '', color: '#DAF2F4', codes: ['3302174'], keywords: ['หมี่คลุก'] },
  { key: 'P17', l1: 'หมี่ชมพู', l2: '', color: '#FBD9D7', codes: ['3302176'], keywords: ['หมี่ชมพู'] }
];
// URL /exec ของเว็บแอประบบงานองค์กร (deployment เดิมเสมอ) = Webhook URL ของ LINE OA ฝ่ายบัญชี
var ACC_WEBHOOK_URL_ = 'https://script.google.com/macros/s/AKfycbyWj0ra2zC_T-qOE6kAr0cHHzIV944lk_5n4Nk54md9WkHcslA_Pwx7UBNF5Uc0LXTc/exec';
// รูปสินค้าตั้งต้น (ดึงจากไฟล์ต้นแบบรับออเดอร์ · ไฟล์ในโฟลเดอร์ "รูปสินค้า (รายงาน 7-11)" แชร์แบบทุกคนที่มีลิงก์ดูได้) — เปลี่ยน/เพิ่มได้ในหน้าตั้งค่า
var ACC_PRODUCT_IMG_DEFAULT_ = { P01: '1vrBBdaiORa4WZFO7_gaE3q_6AINvhkhS', P02: '1cABt98Kw7BgQFrs88ONWrovXDpAdKRnq', P03: '1DPPjPyRgVoYcT69F_ttgBJK0ABM4UuFE', P04: '1vN0dOAc5r9QP98b2nYnxjfl2k8nSTSf5', P05: '1TFhvL48ctMIyll2Wt5rEl3GP8FPOhWFe', P06: '1GU8kJgnA2w9F1AwjxD2OIyZOVL_iH-cJ', P07: '1m5L1tbfLm1LlFCuEWcNofNb1wytiIhHl', P08: '13zpspqxHmKVqgoBDBliHTjuPEk6wh0RP', P09: '1jJAEGBrdY0De9vEKemjfBVJuvig7sJxV', P10: '1bPdH-9lkXGCGSSJDUCscMbHEMuAeodu7', P14: '1qDOu6Dj3NajYOIoveVZtS2TPOLkek0ZX', P15: '1LjyEpSbld34J-NeaC9DXAt0mwBVYz1pJ' };
function accImgUrl_(id) { return id ? 'https://lh3.googleusercontent.com/d/' + id : ''; }
var ACC_REPORT_TITLE_ = 'แบบฟอร์มบันทึกออเดอร์ 7-11';
var ACC_TOTAL_COLOR_ = '#FEF2CB';

// ---------- พื้นฐาน ----------
function requireAcc_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'accounting') throw new Error('แผนกนี้ไม่มีระบบบัญชี');
  return dept;
}
function accRegister_() {
  Object.keys(ACC_TABLES_).forEach(function (k) { PUR_TABLES_[k] = ACC_TABLES_[k]; });
  ['poDate', 'deliveryDate', 'dueDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  ['lineNo', 'cases', 'packSize', 'casePrice', 'amount', 'vatRate', 'termDays', 'poCount', 'lineCount', 'vat', 'skipped'].forEach(function (k) { PUR_NUM_KEYS_[k] = 1; });
}
function accBook_(dept) { accRegister_(); return purBook_(dept); }
function accClean_(v, max) { return purClean_(v, max); }
// "12/11/2026" / "2026-11-12" / Date → "2026-11-12" (ปี พ.ศ. แปลงให้)
function accDate_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, PUR_TZ_, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim(), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else { m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/); if (!m) return ''; d = +m[1]; mo = +m[2]; y = +m[3]; }
  if (y > 2400) y -= 543;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
}
function accAddDays_(iso, n) {
  var p = iso.split('-'), dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return Utilities.formatDate(dt, 'UTC', 'yyyy-MM-dd');
}
// ---------- กำหนดรับเงิน 7-11 (CP ALL) ----------
// ส่งสินค้าวันที่ 1–15 → ชำระวันที่ 10 ของเดือนถัดไป · ส่งวันที่ 16–31 → ชำระวันที่ 25 ของเดือนถัดไป
// ถ้าวันชำระตรงกับเสาร์-อาทิตย์ หรือวันหยุดราชการ → เลื่อนออกไปวันทำการถัดไป
function accDueBase_(deliveryIso) {
  var p = String(deliveryIso).split('-'), y = +p[0], mo = +p[1] + 1;
  if (mo > 12) { mo = 1; y++; }
  return y + '-' + ('0' + mo).slice(-2) + '-' + (+p[2] <= 15 ? '10' : '25');
}
function accDueDate_(deliveryIso, hol) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deliveryIso || ''))) return '';
  var d = accDueBase_(deliveryIso);
  for (var i = 0; i < 15; i++) {
    var p = d.split('-'), wd = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    if (wd !== 0 && wd !== 6 && !(hol && hol[d])) break;
    d = accAddDays_(d, 1);
  }
  return d;
}
// วันหยุดราชการไทยจากปฏิทินวันหยุดของ Google (เฉพาะ "วันหยุดนักขัตฤกษ์" ไม่นับวันสำคัญอย่างวาเลนไทน์/ตรุษจีน)
// แคช 6 ชม. + เก็บชุดล่าสุดใน Script Properties ไว้ใช้ถ้าดึงไม่ได้ · วันหยุดเพิ่มเติมตั้งในหน้าตั้งค่า (map.holidays)
var ACC_HOLIDAY_ICS_ = 'https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics';
function accHolidays_() {
  var set = {};
  accHolidayList_().forEach(function (h) { set[h[0]] = h[1] || 1; });
  return set;
}
// [[yyyy-mm-dd, ชื่อวันหยุด], ...]
function accHolidayList_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('ACC_HOL2');
  var list = hit ? JSON.parse(hit) : null;
  if (!list) {
    try {
      var res = UrlFetchApp.fetch(ACC_HOLIDAY_ICS_, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        list = [];
        res.getContentText().split('BEGIN:VEVENT').forEach(function (ev) {
          var d = ev.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/), ds = ev.match(/DESCRIPTION:([^\r\n]*)/), nm = ev.match(/SUMMARY:([^\r\n]*)/);
          if (d && ds && /^(วันหยุดนักขัตฤกษ์|Public holiday)/.test(ds[1])) list.push([d[1] + '-' + d[2] + '-' + d[3], accClean_(nm ? nm[1].replace(/\u200b/g, '') : '', 60)]);
        });
        list.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
        if (list.length) PropertiesService.getScriptProperties().setProperty('ACC_HOLIDAYS', JSON.stringify(list));
      }
    } catch (e) { list = null; }
    if (!list || !list.length) list = JSON.parse(PropertiesService.getScriptProperties().getProperty('ACC_HOLIDAYS') || '[]');
    cache.put('ACC_HOL2', JSON.stringify(list), 21600);
  }
  return list;
}
// เหตุที่วันชำระถูกเลื่อน (แสดงใน Dashboard)
function accDueWhy_(iso, hol) {
  var p = iso.split('-'), wd = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  if (wd === 0 || wd === 6) return 'ตรงวัน' + (wd ? 'เสาร์' : 'อาทิตย์');
  return hol[iso] ? (hol[iso] === 1 ? 'วันหยุดราชการ' : String(hol[iso])) : '';
}
function accHolidaySet_(map) {
  var set = accHolidays_();
  ((map && map.holidays) || []).forEach(function (d) { set[d] = set[d] || 'วันหยุดที่ตั้งเพิ่ม'; });
  return set;
}
function accKey_(l) { return String(l.poNo).replace(/^'/, '') + '|' + Number(l.lineNo); }
function accNorm_(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }

// ---------- การจับคู่ (ตั้งค่า) ----------
function accMap_(ss) {
  var row = purRead_(ss, 'acc_settings').filter(function (x) { return x.id === 'map711'; })[0];
  var saved = {};
  try { saved = row ? JSON.parse(row.value || '{}') : {}; } catch (e) { saved = {}; }
  var dcs = Array.isArray(saved.dcs) && saved.dcs.length ? saved.dcs : ACC_DC_DEFAULT_;
  var products = Array.isArray(saved.products) && saved.products.length ? saved.products : ACC_PRODUCT_DEFAULT_;
  products = products.map(accCleanProduct_);
  // ยังไม่เคยตั้งรูป (img ไม่มีค่าเลย) → ใช้รูปตั้งต้นของคอลัมน์นั้น · ตั้งเป็น "none" = ไม่ใช้รูป
  products.forEach(function (p) { if (!p.img && ACC_PRODUCT_IMG_DEFAULT_[p.key]) p.img = accImgUrl_(ACC_PRODUCT_IMG_DEFAULT_[p.key]); if (p.img === 'none') { p.img = ''; p.noImg = true; } });
  return { dcs: dcs.map(accCleanDc_), products: products, holidays: accDates_(saved.holidays) };
}
function accDates_(a) { return (Array.isArray(a) ? a : []).map(String).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort().slice(0, 100); }
function accList_(a, max) {
  return (Array.isArray(a) ? a : String(a || '').split(/[,\n]/)).map(function (x) { return accClean_(x, 80); }).filter(String).slice(0, max || 30);
}
function accCleanDc_(d) { return { name: accClean_(d.name, 40), keywords: accList_(d.keywords), codes: accList_(d.codes) }; }
function accCleanProduct_(p) {
  return { key: accClean_(p.key, 10), l1: accClean_(p.l1, 40), l2: accClean_(p.l2, 40), color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color.toUpperCase() : '#FFFFFF',
    codes: accList_(p.codes, 60), keywords: accList_(p.keywords),
    img: p.img === 'none' || p.noImg ? 'none' : /^https:\/\/lh3\.googleusercontent\.com\/d\/[-\w]{20,}$/.test(String(p.img || '')) ? String(p.img) : '' };
}
// อัปโหลดรูปสินค้า (หน้าตั้งค่า) → โฟลเดอร์ "รูปสินค้า (รายงาน 7-11)" ในโฟลเดอร์ของฝ่าย แชร์ทุกคนที่มีลิงก์ดูได้ (LINE / PDF ต้องเปิดรูปได้)
function accUploadProductImage(token, fileName, mimeType, base64) {
  var dept = requireAcc_(token);
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) return { ok: false, error: 'แนบได้เฉพาะรูป JPG / PNG' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) return { ok: false, error: 'รูปว่างหรือใหญ่เกิน 3 MB' };
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่าย' };
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รูปสินค้า (รายงาน 7-11)');
  var folder = it.hasNext() ? it.next() : parent.createFolder('รูปสินค้า (รายงาน 7-11)');
  var f = folder.createFile(Utilities.newBlob(bytes, mimeType, accClean_(fileName, 80).replace(/[\\/:*?"<>|]/g, '_') || 'product.jpg'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: accImgUrl_(f.getId()) };
}
function accMatchDc_(map, location, code) {
  var n = accNorm_(location), c = String(code || '').trim().toUpperCase();
  for (var i = 0; i < map.dcs.length; i++) {
    var d = map.dcs[i];
    if (d.keywords.some(function (k) { return k && n.indexOf(accNorm_(k)) >= 0; })) return d.name;
  }
  for (var j = 0; j < map.dcs.length; j++) if (c && map.dcs[j].codes.some(function (x) { return x.toUpperCase() === c; })) return map.dcs[j].name;
  return '';
}
function accMatchProduct_(map, itemCode, itemName) {
  var code = String(itemCode || '').trim(), n = accNorm_(itemName);
  for (var i = 0; i < map.products.length; i++) if (code && map.products[i].codes.indexOf(code) >= 0) return map.products[i].key;
  for (var j = 0; j < map.products.length; j++) {
    if (map.products[j].keywords.some(function (k) { return k && n.indexOf(accNorm_(k)) >= 0; })) return map.products[j].key;
  }
  return '';
}

// ---------- แปลงแถวจากไฟล์ (หน้าเว็บส่งมาเฉพาะคอลัมน์ที่ใช้) ----------
function accCleanLines_(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new Error('ไม่พบรายการในไฟล์ — ตรวจว่าเป็นไฟล์ po_export จากระบบ 7-11');
  if (lines.length > 3000) throw new Error('ไฟล์ใหญ่เกินไป (เกิน 3,000 รายการ) — แบ่งไฟล์ก่อนนำเข้า');
  return lines.map(function (r, i) {
    var poNo = accClean_(r.poNo, 30);
    if (!/^\d{4,20}$/.test(poNo)) throw new Error('แถวที่ ' + (i + 2) + ': ไม่มีเลขที่ใบสั่งซื้อ (Purchase Order Number)');
    var cases = purNum_(r.cases);
    return {
      poNo: poNo, lineNo: purNum_(r.lineNo) === '' ? i + 1 : purNum_(r.lineNo), poDate: accDate_(r.poDate), deliveryDate: accDate_(r.deliveryDate),
      deliveryTime: accClean_(r.deliveryTime, 10), locCode: accClean_(r.locCode, 20), location: accClean_(r.location, 120),
      itemCode: accClean_(r.itemCode, 30), barcode: accClean_(r.barcode, 30), itemName: accClean_(r.itemName, 150),
      cases: cases === '' ? 0 : cases, unit: accClean_(r.unit, 10), freeQty: purNum_(r.freeQty) || 0, packSize: purNum_(r.packSize),
      casePrice: purNum_(r.casePrice), amount: purNum_(r.amount), vatRate: purNum_(r.vatRate), termDays: purNum_(r.termDays)
    };
  });
}

// ตาราง ศูนย์ × สินค้า (+ ยอดเงิน) จากรายการที่จับคู่แล้ว
function accMatrix_(map, lines) {
  var dcs = map.dcs.map(function (d) { return { name: d.name, cells: {}, cases: 0, amount: 0, pos: {} }; });
  var byName = {}; dcs.forEach(function (d) { byName[d.name] = d; });
  var byProduct = {}, cases = 0, amount = 0, vat = 0, pos = {}, poDates = {}, delDates = {};
  lines.forEach(function (l) {
    var d = byName[l.dc];
    if (!d || !l.product) return;
    d.cells[l.product] = (d.cells[l.product] || 0) + l.cases;
    d.cases += l.cases; d.amount += Number(l.amount) || 0; d.pos[l.poNo] = 1;
    byProduct[l.product] = (byProduct[l.product] || 0) + l.cases;
    cases += l.cases; amount += Number(l.amount) || 0; vat += (Number(l.amount) || 0) * (Number(l.vatRate) || 0) / 100;
    pos[l.poNo] = 1; if (l.poDate) poDates[l.poDate] = 1; if (l.deliveryDate) delDates[l.deliveryDate] = 1;
  });
  dcs.forEach(function (d) { d.poCount = Object.keys(d.pos).length; delete d.pos; d.amount = Math.round(d.amount * 100) / 100; });
  return { dcs: dcs, byProduct: byProduct, cases: cases, amount: Math.round(amount * 100) / 100, vat: Math.round(vat * 100) / 100,
    poCount: Object.keys(pos).length, poDates: Object.keys(poDates).sort(), deliveryDates: Object.keys(delDates).sort() };
}

// ---------- API: โหลดหน้า ----------
function accLoad(token) {
  var dept = requireAcc_(token), ss = accBook_(dept);
  var imports = purRead_(ss, 'acc_imports').sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  var p = props_();
  return { ok: true, today: purToday_(), map: accMap_(ss), imports: imports.slice(0, 200),
    hasFolder: !!deptConfig_(dept.key).folderId, sheetUrl: ss.getUrl(),
    holidays: accHolidayList_().filter(function (h) { return h[0] >= purToday_(); }).slice(0, 30),
    line: { token: !!p.getProperty('ACC_LINE_TOKEN'), group: !!p.getProperty('ACC_LINE_GROUP'), setupCode: hrProp_('ACC_LINE_SETUP', hrSetupCode_),
      webhook: ACC_WEBHOOK_URL_ } };
}

// ---------- API: ตรวจไฟล์ก่อนบันทึก ----------
function acc711Preview(token, lines, fileName) {
  var dept = requireAcc_(token), ss = accBook_(dept), map = accMap_(ss);
  var rows = accCleanLines_(lines);
  var saved = {};
  purRead_(ss, 'acc_711').forEach(function (x) { saved[accKey_(x)] = x.importId; });
  var unLoc = {}, unItem = {}, dupPo = {}, warn = [];
  rows.forEach(function (l) {
    l.dc = accMatchDc_(map, l.location, l.locCode);
    l.product = accMatchProduct_(map, l.itemCode, l.itemName);
    if (!l.dc) { var k = l.locCode + '|' + l.location; unLoc[k] = unLoc[k] || { locCode: l.locCode, location: l.location, cases: 0 }; unLoc[k].cases += l.cases; }
    if (!l.product) { var k2 = l.itemCode || l.itemName; unItem[k2] = unItem[k2] || { itemCode: l.itemCode, itemName: l.itemName, cases: 0 }; unItem[k2].cases += l.cases; }
    if (saved[accKey_(l)]) dupPo[l.poNo] = 1;
  });
  var units = {}; rows.forEach(function (l) { if (l.unit && l.unit !== 'CT') units[l.unit] = 1; });
  if (Object.keys(units).length) warn.push('มีรายการที่หน่วยไม่ใช่ลัง (' + Object.keys(units).join(', ') + ') — ตรวจจำนวนให้ถูกก่อนบันทึก');
  var free = rows.filter(function (l) { return l.freeQty > 0; });
  if (free.length) warn.push('มีของแถม (Free Quantity) ' + free.length + ' รายการ — รายงานนับเฉพาะจำนวนที่สั่ง');
  var m = accMatrix_(map, rows);
  var newLines = rows.filter(function (l) { return !saved[accKey_(l)]; }).length;
  return { ok: true, fileName: accClean_(fileName, 120), map: map, matrix: m, lineCount: rows.length, newLines: newLines,
    unmatchedLocations: Object.keys(unLoc).map(function (k) { return unLoc[k]; }),
    unmatchedItems: Object.keys(unItem).map(function (k) { return unItem[k]; }),
    assign: rows.map(function (l) { return [l.dc, l.product, saved[accKey_(l)] ? 1 : 0]; }),
    duplicatePos: Object.keys(dupPo), warnings: warn };
}

// ---------- API: บันทึก ----------
function acc711Save(token, lines, fileName) {
  var dept = requireAcc_(token);
  var rows = accCleanLines_(lines);
  return purLocked_(function () {
    var ss = accBook_(dept), map = accMap_(ss);
    var saved = {};
    purRead_(ss, 'acc_711').forEach(function (x) { saved[accKey_(x)] = 1; });
    var bad = [];
    rows.forEach(function (l) {
      l.dc = accMatchDc_(map, l.location, l.locCode);
      l.product = accMatchProduct_(map, l.itemCode, l.itemName);
      if (!l.dc || !l.product) bad.push(l);
    });
    if (bad.length) return { ok: false, error: 'ยังมี ' + bad.length + ' รายการที่จับคู่ศูนย์/สินค้าไม่ได้ — จับคู่ให้ครบก่อนบันทึก' };
    var fresh = rows.filter(function (l) { return !saved[accKey_(l)]; });
    if (!fresh.length) return { ok: false, error: 'ไฟล์นี้บันทึกไปแล้ว (ใบสั่งซื้อทุกใบมีในระบบแล้ว)' };
    var importId = purId_('IMP'), now = purNow_(), hol = accHolidaySet_(map);
    var sh = purSheet_(ss, 'acc_711'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var values = fresh.map(function (l) {
      var o = Object.assign({}, l, { id: purId_('O'), importId: importId, createdAt: now,
        dueDate: accDueDate_(l.deliveryDate, hol) });
      return purRowValues_(sh, 'acc_711', o, head);
    });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    var m = accMatrix_(map, fresh);
    purWrite_(ss, 'acc_imports', { id: importId, fileName: accClean_(fileName, 120), poDate: m.poDates[0] || '', deliveryDate: m.deliveryDates[0] || '',
      poCount: m.poCount, lineCount: fresh.length, cases: m.cases, amount: m.amount, vat: m.vat, skipped: rows.length - fresh.length, createdAt: now });
    purLogWrite_(ss, 'นำเข้าไฟล์ 7-11', 'acc_imports', importId, (fileName || '') + ' · ' + m.poCount + ' ใบสั่ง · ' + m.cases + ' ลัง');
    return { ok: true, importId: importId, saved: fresh.length, skipped: rows.length - fresh.length, cases: m.cases };
  });
}

// ---------- API: ลบการนำเข้า (นำเข้าผิดไฟล์) ----------
function acc711DeleteImport(token, importId) {
  var dept = requireAcc_(token);
  return purLocked_(function () {
    var ss = accBook_(dept), imp = purRead_(ss, 'acc_imports').filter(function (x) { return x.id === importId; })[0];
    if (!imp) return { ok: false, error: 'ไม่พบการนำเข้านี้' };
    var sh = purSheet_(ss, 'acc_711');
    var rows = purRead_(ss, 'acc_711').filter(function (x) { return x.importId === importId; }).map(function (x) { return x._row; }).sort(function (a, b) { return b - a; });
    rows.forEach(function (r) { sh.deleteRow(r); });
    purSheet_(ss, 'acc_imports').deleteRow(imp._row);
    purLogWrite_(ss, 'ลบการนำเข้า 7-11', 'acc_imports', importId, (imp.fileName || '') + ' · ' + rows.length + ' รายการ');
    return { ok: true, deleted: rows.length };
  });
}

// ---------- รายงาน (ตารางเหมือนต้นแบบ) จากข้อมูลที่บันทึกแล้ว ----------
// q = { importId } หรือ { from, to, basis: 'po'|'delivery', dc }
function accReportLines_(ss, q) {
  var lines = purRead_(ss, 'acc_711');
  if (q.importId) return lines.filter(function (l) { return l.importId === q.importId; });
  var key = q.basis === 'po' ? 'poDate' : 'deliveryDate';
  return lines.filter(function (l) {
    var d = l[key];
    return (!q.from || d >= q.from) && (!q.to || d <= q.to) && (!q.dc || l.dc === q.dc);
  });
}
function acc711Report(token, q) {
  var dept = requireAcc_(token), ss = accBook_(dept), map = accMap_(ss);
  q = q || {};
  var lines = accReportLines_(ss, q), m = accMatrix_(map, lines);
  var imp = q.importId ? purRead_(ss, 'acc_imports').filter(function (x) { return x.id === q.importId; })[0] : null;
  var slim = lines.length <= 3000 ? lines.map(function (l) {
    return { poNo: l.poNo, deliveryDate: l.deliveryDate, location: l.location, itemName: l.itemName, cases: l.cases, amount: l.amount, dc: l.dc, product: l.product };
  }) : [];
  return { ok: true, map: map, matrix: m, importRec: imp || null, lineCount: lines.length, lines: slim };
}

// ---------- PDF: Google Sheet หน้าตาเหมือนต้นแบบ → export PDF ----------
function accReportFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายบัญชี (หน้าผู้ดูแล → ลิงก์ Sheet / โฟลเดอร์)');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รายงานออเดอร์ 7-11');
  return it.hasNext() ? it.next() : parent.createFolder('รายงานออเดอร์ 7-11');
}
function accThaiDate_(iso) {
  if (!iso) return '-';
  var p = iso.split('-');
  return +p[2] + '/' + +p[1] + '/' + (+p[0] + 543);
}
function accRangeText_(list) {
  if (!list.length) return '-';
  return list.length === 1 ? accThaiDate_(list[0]) : accThaiDate_(list[0]) + ' – ' + accThaiDate_(list[list.length - 1]);
}
function accBuildReportSheet_(dept, map, m, title) {
  var folder = accReportFolder_(dept);
  var ss = SpreadsheetApp.create(title);
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);
  var sh = ss.getSheets()[0];
  sh.setName('ออเดอร์ 7-11');
  var P = map.products, nP = P.length, firstCol = 4, lastCol = firstCol + nP - 1, totCol = lastCol + 1;
  var hasImg = P.some(function (p) { return p.img; }), H = hasImg ? 4 : 3, rName = hasImg ? 7 : 6;   // มีรูป = แถวรูปแทรกเหนือชื่อสินค้า
  var rows = 9 + (H - 3) + m.dcs.length * 3 + 2;
  if (sh.getMaxColumns() < totCol) sh.insertColumnsAfter(sh.getMaxColumns(), totCol - sh.getMaxColumns());
  if (sh.getMaxRows() < rows + 3) sh.insertRowsAfter(sh.getMaxRows(), rows + 3 - sh.getMaxRows());
  sh.getRange(1, 1, rows + 3, totCol).setFontFamily('Sarabun').setFontSize(11).setVerticalAlignment('middle').setHorizontalAlignment('center');
  // หัวรายงาน
  sh.getRange(1, 1, 1, totCol).merge().setValue(ACC_REPORT_TITLE_).setFontSize(16).setFontWeight('bold');
  sh.getRange(2, 1, 1, totCol).merge().setValue('วันที่สั่ง ' + accRangeText_(m.poDates) + '     วันที่ส่ง ' + accRangeText_(m.deliveryDates)).setFontWeight('bold');
  sh.getRange(3, 1, 1, totCol).merge().setValue('ใบสั่งซื้อ ' + m.poCount + ' ใบ · รวม ' + m.cases.toLocaleString() + ' ลัง').setFontSize(10);
  // หัวตาราง (แถว 5 ถึง 4+H): รายการสินค้า · รูปสินค้า (ถ้ามี) · ชื่อบรรทัด 1 · ชื่อบรรทัด 2
  sh.getRange(5, 1, H, 1).merge().setValue('ที่');
  sh.getRange(5, 2, H, 2).merge().setValue('ศูนย์กระจายสินค้า\nDC').setWrap(true);
  sh.getRange(5, firstCol, 1, nP).merge().setValue('รายการสินค้า').setBackground(ACC_TOTAL_COLOR_);
  sh.getRange(5, totCol, H, 1).merge().setValue('รวม (ลัง)');
  if (hasImg) sh.getRange(6, firstCol, 1, nP).setBackgrounds([P.map(function (p) { return p.color; })]);
  sh.getRange(rName, firstCol, 1, nP).setValues([P.map(function (p) { return p.l1; })]).setBackgrounds([P.map(function (p) { return p.color; })]);
  sh.getRange(rName + 1, firstCol, 1, nP).setValues([P.map(function (p) { return p.l2; })]).setBackgrounds([P.map(function (p) { return p.color; })]);
  sh.getRange(5, 1, H, totCol).setFontWeight('bold').setWrap(true);
  // ศูนย์ละ 3 แถว: แถวแรก = จำนวนลัง (ระบายสีเฉพาะช่องที่มีตัวเลข) · อีก 2 แถวเว้นไว้
  var r = 5 + H;
  m.dcs.forEach(function (d, i) {
    sh.getRange(r, 1, 3, 1).merge().setValue(i + 1).setFontWeight('bold');
    sh.getRange(r, 2, 3, 1).merge().setValue(d.name).setFontWeight('bold').setHorizontalAlignment('left');
    sh.getRange(r, 3, 3, 1).merge().setValue('Lot./จำนวนลัง').setFontSize(8);
    var vals = P.map(function (p) { return d.cells[p.key] || ''; });
    sh.getRange(r, firstCol, 1, nP).setValues([vals]).setFontWeight('bold').setFontSize(12)
      .setBackgrounds([P.map(function (p) { return d.cells[p.key] ? p.color : '#FFFFFF'; })]);
    sh.getRange(r, totCol, 1, 1).setValue(d.cases || '').setFontWeight('bold');
    r += 3;
  });
  // รวม
  sh.getRange(r, 1, 1, 3).merge().setValue('รวม').setBackground(ACC_TOTAL_COLOR_).setFontWeight('bold');
  sh.getRange(r, firstCol, 1, nP).setValues([P.map(function (p) { return m.byProduct[p.key] || 0; })])
    .setBackgrounds([P.map(function (p) { return p.color; })]).setFontWeight('bold').setFontSize(12);
  sh.getRange(r, totCol).setValue(m.cases).setFontWeight('bold').setBackground(ACC_TOTAL_COLOR_);
  sh.getRange(r + 1, 1, 1, 3).merge().setValue('รวมทั้งหมด').setFontWeight('bold').setBackground(ACC_TOTAL_COLOR_);
  sh.getRange(r + 1, firstCol, 1, nP + 1).merge().setValue(m.cases.toLocaleString() + ' ลัง').setFontWeight('bold').setBackground(ACC_TOTAL_COLOR_).setHorizontalAlignment('right');
  sh.getRange(5, 1, r - 4 + 1, totCol).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(r + 3, 2).setValue('ผู้จัดทำ ________________').setHorizontalAlignment('left');
  sh.getRange(r + 3, firstCol + Math.floor(nP / 2)).setValue('ผู้ตรวจสอบ ________________').setHorizontalAlignment('left');
  // ขนาด
  sh.setColumnWidth(1, 28); sh.setColumnWidth(2, 90); sh.setColumnWidth(3, 46);
  for (var c = firstCol; c <= lastCol; c++) sh.setColumnWidth(c, 62);
  sh.setColumnWidth(totCol, 56);
  sh.setRowHeight(5, 26); if (hasImg) sh.setRowHeight(6, 56); sh.setRowHeight(rName, 34); sh.setRowHeight(rName + 1, 34);
  sh.setRowHeights(5 + H, m.dcs.length * 3, 18);
  // รูปสินค้า = รูปลอยวางในช่อง (ติดไปทั้ง PDF และไฟล์ Excel · สูตร IMAGE() ไม่ติดไปตอน export)
  if (hasImg) P.forEach(function (p, i) { if (p.img) accPlaceImage_(sh, p.img, 6, firstCol + i, 62, 56); });
  SpreadsheetApp.flush();
  return { ss: ss, file: file, folder: folder };
}
function accPlaceImage_(sh, url, row, col, cellW, cellH) {
  try {
    var res = UrlFetchApp.fetch(url + '=w240', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    var im = sh.insertImage(res.getBlob(), col, row);
    var w = im.getWidth(), h = im.getHeight(), k = Math.min((cellW - 6) / w, (cellH - 6) / h);
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    im.setWidth(w).setHeight(h).setAnchorCellXOffset(Math.round((cellW - w) / 2)).setAnchorCellYOffset(Math.round((cellH - h) / 2));
  } catch (e) {}   // รูปเสีย/ลบไปแล้ว → เว้นว่าง ไม่ทำให้สร้างรายงานไม่ได้
}
// ไฟล์ Excel (.xlsx) ของรายงาน → โฟลเดอร์รายงาน · ทุกคนที่มีลิงก์ดาวน์โหลดได้ (ปุ่มใน LINE)
function accExportXlsx_(ss, folder, name) {
  var res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('สร้างไฟล์ Excel ไม่สำเร็จ (HTTP ' + res.getResponseCode() + ')');
  var f = folder.createFile(res.getBlob().setName(name + '.xlsx'));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return f;
}
function accXlsxDownload_(url) {
  var id = String(url || '').match(/[-\w]{25,}/);
  return id ? 'https://drive.google.com/uc?export=download&id=' + id[0] : '';
}
function accExportPdf_(ss, folder, name) {
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&size=A4&portrait=false&fitw=true&gridlines=false'
    + '&printtitle=false&sheetnames=false&pagenumbers=false&fzr=false&top_margin=0.3&bottom_margin=0.3&left_margin=0.3&right_margin=0.3'
    + '&horizontal_alignment=CENTER&gid=' + ss.getSheets()[0].getSheetId();
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('สร้าง PDF ไม่สำเร็จ (HTTP ' + res.getResponseCode() + ')');
  var pdf = folder.createFile(res.getBlob().setName(name + '.pdf'));
  try { pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return pdf;
}
// สร้าง/สร้างใหม่ PDF ของการนำเข้าหนึ่งครั้ง → เก็บลิงก์ในแท็บนำเข้า
function acc711Pdf(token, importId) {
  var dept = requireAcc_(token);
  return purLocked_(function () { return accMakePdf_(dept, importId); });
}
function accMakePdf_(dept, importId) {
  var ss = accBook_(dept), map = accMap_(ss);
  var imp = purRead_(ss, 'acc_imports').filter(function (x) { return x.id === importId; })[0];
  if (!imp) return { ok: false, error: 'ไม่พบการนำเข้านี้' };
  var m = accMatrix_(map, accReportLines_(ss, { importId: importId }));
  var name = 'ออเดอร์ 7-11 สั่ง ' + accThaiDate_(m.poDates[0] || '').replace(/\//g, '-') + ' ส่ง ' + accThaiDate_(m.deliveryDates[0] || '').replace(/\//g, '-') + ' (' + importId.slice(-4) + ')';
  // สร้างใหม่ → ย้ายไฟล์รายงานเดิมของการนำเข้านี้ลงถังขยะ
  [imp.pdfUrl, imp.sheetUrl, imp.xlsxUrl].forEach(function (u) {
    var id = String(u || '').match(/[-\w]{25,}/);
    if (id) try { DriveApp.getFileById(id[0]).setTrashed(true); } catch (e) {}
  });
  var built = accBuildReportSheet_(dept, map, m, name);
  var pdf = accExportPdf_(built.ss, built.folder, name), xlsx = accExportXlsx_(built.ss, built.folder, name);
  imp.pdfUrl = pdf.getUrl(); imp.sheetUrl = built.ss.getUrl(); imp.xlsxUrl = xlsx.getUrl();
  purWrite_(ss, 'acc_imports', imp);
  return { ok: true, pdfUrl: imp.pdfUrl, sheetUrl: imp.sheetUrl, xlsxUrl: imp.xlsxUrl };
}

// ---------- ส่ง LINE เข้ากลุ่มของฝ่ายบัญชี ----------
function accLinePush_(messages) {
  var p = props_(), token = p.getProperty('ACC_LINE_TOKEN'), group = p.getProperty('ACC_LINE_GROUP');
  if (!token || !group) return { ok: false, error: !token ? 'ยังไม่ได้ใส่ ACC_LINE_TOKEN ใน Script Properties' : 'ยังไม่ได้ใส่ ACC_LINE_GROUP (Group ID) ใน Script Properties' };
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: group, messages: messages }), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'LINE ตอบกลับ ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200) };
  return { ok: true };
}
// วันที่แบบที่ฝ่ายบัญชีใช้: 12.11.26 (ค.ศ. 2 หลัก) · วันในสัปดาห์ภาษาไทย
var ACC_DAYS_ = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function accDot_(iso) { if (!iso) return '-'; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0].slice(2); }
function accDayName_(iso) { var p = iso.split('-'); return ACC_DAYS_[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]; }
function accDotRange_(list) { return !list.length ? '-' : list.length === 1 ? accDot_(list[0]) : accDot_(list[0]) + ' – ' + accDot_(list[list.length - 1]); }
function accDeliveryText_(list) { return !list.length ? '-' : list.length === 1 ? 'วัน' + accDayName_(list[0]) + ' ที่ ' + accDot_(list[0]) : accDotRange_(list); }
// ส่ง 2 ข้อความ: (1) การ์ดสรุป หัวสีเขียวเข้ม · รอบวันที่ / ลูกค้า / วันส่ง · ยอดรวมลัง · ปุ่ม PDF
// (2) ภาพตารางสี (ข้อความรูป กดขยายในไลน์ได้) · img = { url } ภาพที่หน้าเว็บสร้างให้ · ไม่มีภาพ = ส่งการ์ดอย่างเดียว
// การ์ดสรุป: การ์ดขาว · แถบหัวสีเขียวมุมมน · กล่องยอดรวม · ปุ่ม PDF ทรงมน
function accFlex_(m, pdfUrl, img, xlsxUrl) {
  var T = function (text, o) { var x = { type: 'text', text: String(text), wrap: true }; Object.keys(o || {}).forEach(function (k) { x[k] = o[k]; }); return x; };
  var row = function (label, value) {
    return { type: 'box', layout: 'horizontal', margin: 'md', contents: [T(label, { size: 'sm', color: '#64748B', flex: 5 }), T(value, { size: 'sm', weight: 'bold', color: '#0F172A', flex: 6, align: 'end' })] };
  };
  var dcN = m.dcs.filter(function (d) { return d.cases; }).length;
  var body = [
    row('ออเดอร์ รอบวันที่', accDotRange_(m.poDates)),
    row('ลูกค้า', 'CP ALL (7-Eleven)'),
    row('วันที่ส่งสินค้า', accDeliveryText_(m.deliveryDates)),
    row('ใบสั่งซื้อ', m.poCount + ' ใบ · ' + dcN + ' ศูนย์'),
    { type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: '#ECFDF5', cornerRadius: '16px', paddingAll: '14px', borderColor: '#A7F3D0', borderWidth: '1px', contents: [
      T('สินค้าจำนวนรวม', { size: 'sm', color: '#047857', align: 'center' }),
      T(m.cases.toLocaleString() + ' ลัง', { size: '3xl', weight: 'bold', color: '#047857', align: 'center' })] }];
  if (img && img.url) body.push(T('📊 ตารางออเดอร์แยกศูนย์ / สินค้า อยู่ในข้อความถัดไป (กดที่ภาพเพื่อเปิดภาพเต็ม)', { size: 'xxs', color: '#64748B', margin: 'md', align: 'center' }));
  // ปุ่มทรงมน (กล่องมุมโค้งที่กดได้)
  if (pdfUrl) body.push({ type: 'box', layout: 'vertical', margin: 'xl', backgroundColor: '#0F5132', cornerRadius: '24px', paddingAll: '12px',
    action: { type: 'uri', label: 'เปิดรายงาน PDF', uri: pdfUrl }, contents: [T('เปิดรายงาน PDF', { size: 'md', weight: 'bold', color: '#FFFFFF', align: 'center' })] });
  if (xlsxUrl) body.push({ type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#FFFFFF', borderColor: '#0F5132', borderWidth: '2px', cornerRadius: '24px', paddingAll: '11px',
    action: { type: 'uri', label: 'ดาวน์โหลด Excel', uri: xlsxUrl }, contents: [T('ดาวน์โหลดไฟล์ Excel', { size: 'md', weight: 'bold', color: '#0F5132', align: 'center' })] });
  // หัวสีเขียวเป็นกล่องมนอยู่ในการ์ดขาว (ไม่ใช้พื้นโปร่งใส — LINE บนคอมไม่รองรับ จะเห็นมุมขาวโผล่)
  var inner = [
    { type: 'box', layout: 'vertical', backgroundColor: '#0F5132', cornerRadius: '18px', paddingAll: '18px', contents: [
      T('ORDER CONFIRMATION · 7-ELEVEN', { size: 'xxs', color: '#A7F3D0', weight: 'bold' }),
      T('ใบแจ้งออเดอร์ CP ALL', { size: 'xl', color: '#FFFFFF', weight: 'bold', margin: 'sm' }),
      T('บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายบัญชี', { size: 'xs', color: '#D1FAE5', margin: 'xs' })] },
    { type: 'box', layout: 'vertical', paddingStart: '6px', paddingEnd: '6px', paddingTop: '6px', paddingBottom: '4px', contents: body }];
  return { type: 'flex', altText: 'ออเดอร์ รอบวันที่ ' + accDotRange_(m.poDates) + ' · CP ALL ส่ง' + accDeliveryText_(m.deliveryDates) + ' · สินค้าจำนวน ' + m.cases.toLocaleString() + ' ลัง',
    contents: { type: 'bubble', size: 'giga', body: { type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: '#FFFFFF', contents: inner } } };
}
// การ์ดภาพตาราง (ขนาด giga แบบปกติ ไม่ทำมุมมน) · กดภาพ = เปิดภาพเต็มความละเอียด
function accImageFlex_(m, url, ratio) {
  return { type: 'flex', altText: 'ตารางออเดอร์ 7-11 แยกศูนย์ / สินค้า (' + m.cases.toLocaleString() + ' ลัง)',
    contents: { type: 'bubble', size: 'giga', hero: { type: 'image', url: url, size: 'full', aspectRatio: ratio || '20:13', aspectMode: 'fit', backgroundColor: '#FFFFFF', action: { type: 'uri', uri: url } } } };
}
// ภาพตาราง (PNG base64 จากหน้าเว็บ) → ไฟล์ในโฟลเดอร์รายงาน (ทุกคนที่มีลิงก์ดูได้) → URL ภาพตรงสำหรับ LINE
function accSaveLineImage_(dept, imp, png) {
  if (!png || typeof png !== 'string' || png.length > 6000000 || !/^[A-Za-z0-9+\/=]+$/.test(png)) return '';
  var old = String(imp.imgUrl || '').match(/[-\w]{25,}/);
  if (old) try { DriveApp.getFileById(old[0]).setTrashed(true); } catch (e) {}
  var f = accReportFolder_(dept).createFile(Utilities.newBlob(Utilities.base64Decode(png), 'image/png', 'ตารางออเดอร์ 7-11 ' + imp.id + '.png'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + f.getId();
}
function acc711SendLine(token, importId, png, ratio) {
  var dept = requireAcc_(token);
  return purLocked_(function () {
    var ss = accBook_(dept), map = accMap_(ss);
    var imp = purRead_(ss, 'acc_imports').filter(function (x) { return x.id === importId; })[0];
    if (!imp) return { ok: false, error: 'ไม่พบการนำเข้านี้' };
    var pdfUrl = imp.pdfUrl;
    // ยังไม่มีไฟล์ หรือไฟล์รุ่นเก่า (ไม่มี Excel / ไม่มีรูปสินค้า) → สร้างใหม่
    if (!pdfUrl || !imp.xlsxUrl) { var made = accMakePdf_(dept, importId); if (!made.ok) return made; pdfUrl = made.pdfUrl; imp = purRead_(ss, 'acc_imports').filter(function (x) { return x.id === importId; })[0]; }
    if (png) { imp.imgUrl = accSaveLineImage_(dept, imp, png); imp.imgRatio = /^\d{2,5}:\d{2,5}$/.test(String(ratio)) ? String(ratio) : '20:13'; }
    var m = accMatrix_(map, accReportLines_(ss, { importId: importId }));
    var msgs = [accFlex_(m, pdfUrl, imp.imgUrl ? { url: imp.imgUrl } : null, accXlsxDownload_(imp.xlsxUrl))];
    // ภาพตารางเป็นการ์ด Flex ขนาด giga (กว้างเท่าการ์ดสรุป = ใหญ่สุดที่ LINE แสดงได้)
    if (imp.imgUrl) msgs.push(accImageFlex_(m, imp.imgUrl, imp.imgRatio));
    var r = accLinePush_(msgs);
    if (!r.ok) { purWrite_(ss, 'acc_imports', imp); return r; }
    imp.sentAt = purNow_();
    purWrite_(ss, 'acc_imports', imp);
    purLogWrite_(ss, 'ส่ง LINE รายงาน 7-11', 'acc_imports', importId, m.cases + ' ลัง');
    return { ok: true, sentAt: imp.sentAt, pdfUrl: pdfUrl, sheetUrl: imp.sheetUrl, xlsxUrl: imp.xlsxUrl, imgUrl: imp.imgUrl };
  });
}
// ---------- Webhook ของ LINE OA ฝ่ายบัญชี: ผูกกลุ่มอัตโนมัติ (ไม่ต้องหา Group ID เอง) ----------
// ตั้ง Webhook URL ของ OA ฝ่ายบัญชี = URL /exec ของระบบนี้ · เชิญบอทเข้ากลุ่ม แล้วพิมพ์ "ตั้งค่ากลุ่ม บัญชี <รหัสตั้งค่า>"
// (รหัสดูได้ที่ระบบฝ่ายบัญชี → ตั้งค่า) → ระบบบันทึก ACC_LINE_GROUP ให้เอง · รหัสใช้ได้ครั้งเดียว
// doPost (Api.gs) แยก OA จากช่อง destination ของ webhook: ตรงกับบอทของ ACC_LINE_TOKEN → ฝ่ายบัญชี, ไม่ตรง → ฝ่ายบุคคล
function accIsMyBot_(destination) {
  try { return accIsMyBot2_(destination); } catch (e) { accDiagLog_({ ev: 'error', result: String(e.message || e).slice(0, 150) }); return false; }
}
function accIsMyBot2_(destination) {
  var token = props_().getProperty('ACC_LINE_TOKEN');
  if (!token || !destination) return false;
  var c = CacheService.getScriptCache(), id = c.get('acc_bot_id');
  if (!id) {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return false;
    id = JSON.parse(res.getContentText()).userId || '';
    if (id) c.put('acc_bot_id', id, 21600);
  }
  return id === destination;
}
// กดรันฟังก์ชันนี้ครั้งเดียวในหน้าแก้ไข Apps Script เพื่ออนุญาตสิทธิ์ (เชื่อมต่อ LINE / สร้างไฟล์ PDF / Drive) ให้ระบบ
function authorizeOnce() {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { muteHttpExceptions: true });
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('อนุญาตสิทธิ์เรียบร้อย');
}
// บันทึกการทำงานของ webhook 10 ครั้งล่าสุด (เวลา / ผล เท่านั้น ไม่เก็บข้อความหรือ token) — ไว้ตรวจปัญหาบอทไม่ตอบ
function accDiagLog_(o) {
  try {
    var p = props_(), log = JSON.parse(p.getProperty('ACC_WEBHOOK_LOG') || '[]');
    o.at = purNow_(); log.unshift(o);
    p.setProperty('ACC_WEBHOOK_LOG', JSON.stringify(log.slice(0, 10)));
  } catch (e) {}
}
// ตรวจสถานะ LINE ฝ่ายบัญชี (ไม่มีข้อมูลลับ: ใส่ token แล้วหรือยัง / LINE ยอมรับ token ไหม / ผูกกลุ่มแล้วหรือยัง / webhook ล่าสุด)
function accLineDiag() {
  var p = props_(), token = p.getProperty('ACC_LINE_TOKEN'), info = 0, name = '';
  if (token) {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    info = res.getResponseCode();
    if (info === 200) name = JSON.parse(res.getContentText()).displayName || '';
  }
  return { ok: true, token: !!token, tokenAccepted: info === 200, lineStatus: info, botName: name, group: !!p.getProperty('ACC_LINE_GROUP'),
    log: JSON.parse(p.getProperty('ACC_WEBHOOK_LOG') || '[]') };
}
function accLineReply_(replyToken, text) {
  var token = props_().getProperty('ACC_LINE_TOKEN');
  if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }) });
}
function accLineWebhook_(events) {
  (events || []).forEach(function (ev) {
    try {
      var gid = (ev.source || {}).groupId || '';
      if (ev.type === 'join' && gid) {
        accDiagLog_({ ev: 'join', group: true, result: 'บอทเข้ากลุ่ม' });
        accLineReply_(ev.replyToken, 'สวัสดีค่ะ 🙏 ถ้าต้องการให้กลุ่มนี้รับรายงานออเดอร์ 7-11 ให้พิมพ์\nตั้งค่ากลุ่ม บัญชี <รหัสตั้งค่า>\n(ดูรหัสได้ที่ระบบฝ่ายบัญชี → ตั้งค่าศูนย์ / สินค้า / LINE)');
        return;
      }
      if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
      var text = String(ev.message.text).trim();
      var m = text.match(/^ตั้งค่ากลุ่ม\s*(?:บัญชี|ACC)\s+([A-Z0-9]{8})$/i);
      if (!m) {
        accDiagLog_({ ev: 'text', group: !!gid, result: 'ไม่ใช่คำสั่ง' });
        // พิมพ์ใกล้เคียงแต่ไม่ถูกรูปแบบ → บอกวิธีพิมพ์
        if (/^ตั้ง(ค่า)?\s*กลุ่ม/.test(text) && /บัญชี|acc/i.test(text)) accLineReply_(ev.replyToken, 'พิมพ์ให้ตรงรูปแบบนี้ค่ะ\nตั้งค่ากลุ่ม บัญชี <รหัส 8 ตัว>\n(คัดลอกได้จากระบบฝ่ายบัญชี → ตั้งค่าศูนย์ / สินค้า / LINE)');
        return;
      }
      if (!gid) { accDiagLog_({ ev: 'command', group: false, result: 'พิมพ์ในแชทส่วนตัว' }); accLineReply_(ev.replyToken, 'พิมพ์คำสั่งนี้ในกลุ่ม LINE ที่ต้องการให้รับรายงาน (ไม่ใช่ในแชทส่วนตัว)'); return; }
      hrRate_('accbind', 10, 3600);
      if (m[1].toUpperCase() !== hrProp_('ACC_LINE_SETUP', hrSetupCode_)) { accDiagLog_({ ev: 'command', group: true, result: 'รหัสไม่ถูกต้อง' }); accLineReply_(ev.replyToken, 'รหัสตั้งค่าไม่ถูกต้อง (รหัสใช้ได้ครั้งเดียว — คัดลอกรหัสล่าสุดจากหน้าตั้งค่าอีกครั้ง)'); return; }
      props_().setProperty('ACC_LINE_GROUP', gid);
      props_().setProperty('ACC_LINE_SETUP', hrSetupCode_());   // ใช้ครั้งเดียว
      accDiagLog_({ ev: 'command', group: true, result: 'ผูกกลุ่มแล้ว' });
      accLineReply_(ev.replyToken, '✅ ตั้งกลุ่มนี้เป็นกลุ่มรับรายงานออเดอร์ 7-11 ของฝ่ายบัญชีแล้ว\nกด "ส่ง LINE เข้ากลุ่ม" ในระบบ รายงานจะขึ้นในกลุ่มนี้');
    } catch (err) { Logger.log('accLineWebhook_ ' + err); }
  });
}
function accLineTest(token) {
  requireAcc_(token);
  return accLinePush_([{ type: 'text', text: '✅ ทดสอบการเชื่อมต่อ: ระบบงานองค์กร ฝ่ายบัญชี ส่งข้อความเข้ากลุ่มนี้ได้แล้ว' }]);
}

// ---------- ตั้งค่าการจับคู่ ----------
function accSaveMap(token, json) {
  var dept = requireAcc_(token);
  var cfg; try { cfg = JSON.parse(json || '{}'); } catch (e) { return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }; }
  var dcs = (cfg.dcs || []).map(accCleanDc_).filter(function (d) { return d.name; });
  var products = (cfg.products || []).map(accCleanProduct_).filter(function (p) { return p.key && (p.l1 || p.l2); });
  if (!dcs.length || !products.length) return { ok: false, error: 'ต้องมีศูนย์และสินค้าอย่างน้อยอย่างละ 1 รายการ' };
  var names = {}, keys = {};
  if (dcs.some(function (d) { return names[d.name] ? true : (names[d.name] = 1, false); })) return { ok: false, error: 'ชื่อศูนย์ซ้ำกัน' };
  if (products.some(function (p) { return keys[p.key] ? true : (keys[p.key] = 1, false); })) return { ok: false, error: 'รหัสคอลัมน์สินค้าซ้ำกัน' };
  return purLocked_(function () {
    var ss = accBook_(dept), row = purRead_(ss, 'acc_settings').filter(function (x) { return x.id === 'map711'; })[0] || { id: 'map711' };
    row.value = JSON.stringify({ dcs: dcs, products: products, holidays: accDates_(cfg.holidays) });
    purWrite_(ss, 'acc_settings', row);
    purLogWrite_(ss, 'แก้การจับคู่ 7-11', 'acc_settings', 'map711', dcs.length + ' ศูนย์ · ' + products.length + ' สินค้า');
    return { ok: true, map: accMap_(ss) };
  });
}

// ---------- Dashboard (ฝ่ายบัญชี + ผู้บริหาร) ----------
function accDashboard(token, q) {
  var dept = requireAcc_(token);
  return accDashboard_(dept, q && q.from, q && q.to, q && q.basis, q && q.dc);
}
function accDashboard_(dept, from, to, basis, dc) {
  var ss = accBook_(dept), map = accMap_(ss);
  basis = basis === 'po' ? 'po' : 'delivery';
  var all = purRead_(ss, 'acc_711');
  var key = basis === 'po' ? 'poDate' : 'deliveryDate';
  var lines = all.filter(function (l) { var d = l[key]; return d >= from && d <= to && (!dc || l.dc === dc); });
  var m = accMatrix_(map, lines);
  // แนวโน้มรายวัน
  var days = {};
  lines.forEach(function (l) { var d = l[key]; days[d] = days[d] || { date: d, cases: 0, amount: 0 }; days[d].cases += l.cases; days[d].amount += Number(l.amount) || 0; });
  // ช่วงก่อนหน้า (ยาวเท่ากัน) ไว้เทียบ
  var len = Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8))) / 864e5) + 1;
  var pFrom = accAddDays_(from, -len), pTo = accAddDays_(from, -1);
  var prev = accMatrix_(map, all.filter(function (l) { var d = l[key]; return d >= pFrom && d <= pTo && (!dc || l.dc === dc); }));
  // เงินที่จะได้รับ (ตามวันครบกำหนด) — ทุกออเดอร์ที่ครบกำหนดตั้งแต่วันนี้ไป 60 วัน
  // คิดใหม่จากวันที่ส่งทุกครั้ง (ใช้เงื่อนไขล่าสุด + วันหยุดล่าสุด)
  var today = purToday_(), until = accAddDays_(today, 75), due = {}, hol = accHolidaySet_(map);
  all.forEach(function (l) {
    var dd = accDueDate_(l.deliveryDate, hol);
    if (!dd || dd < today || dd > until || (dc && l.dc !== dc)) return;
    var amt = (Number(l.amount) || 0) * (1 + (Number(l.vatRate) || 0) / 100);
    var x = due[dd] = due[dd] || { amount: 0, base: accDueBase_(l.deliveryDate), from: l.deliveryDate, to: l.deliveryDate, po: {} };
    if (x.why === undefined) x.why = accDueWhy_(x.base, hol);
    x.amount += amt; x.po[l.poNo] = 1;
    if (l.deliveryDate < x.from) x.from = l.deliveryDate;
    if (l.deliveryDate > x.to) x.to = l.deliveryDate;
  });
  var amountByProduct = {};
  lines.forEach(function (l) { amountByProduct[l.product] = (amountByProduct[l.product] || 0) + (Number(l.amount) || 0); });
  return { ok: true, kind: 'accounting', from: from, to: to, basis: basis, dc: dc || '', map: map, matrix: m,
    prev: { cases: prev.cases, amount: prev.amount, poCount: prev.poCount, from: pFrom, to: pTo },
    days: Object.keys(days).sort().map(function (k) { var x = days[k]; x.amount = Math.round(x.amount); return x; }),
    amountByProduct: amountByProduct,
    due: Object.keys(due).sort().map(function (k) { var x = due[k]; return { date: k, amount: Math.round(x.amount), base: x.base, from: x.from, to: x.to, poCount: Object.keys(x.po).length, why: x.why || '' }; }),
    lastImport: (purRead_(ss, 'acc_imports').sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })[0] || {}).createdAt || '' };
}
