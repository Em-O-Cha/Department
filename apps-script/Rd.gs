// ==================== วิจัยและพัฒนา (RD) — ผลิตภัณฑ์ใหม่ · คู่ค้า · ต้นทุนสินค้า ====================
// หน้าเว็บ: Department/rd.js (window.RDM) · ข้อมูลอยู่ใน Google Sheet ของฝ่าย RD (ตั้งลิงก์ในหน้าผู้ดูแล)
// ผลิตภัณฑ์ใหม่ 1 แถว = 1 โครงการพัฒนา: ชื่อ ประเภท ตลาด (ในประเทศ / ต่างประเทศ) คู่ค้า ช่วงพัฒนา (วันที่เริ่ม → วันที่สิ้นสุด) สถานะ
// คู่ค้า 1 แถว = 1 เจ้า: ในประเทศ / ต่างประเทศ ประเทศ ช่องทางขาย ผู้ติดต่อ เบอร์โทร สินค้าที่ส่งขาย (บรรทัดละ 1 รายการ)
// ต้นทุนสินค้า (เดิมการ์ด "ต้นทุนสินค้า" แยก) รวมมาอยู่ที่ RD — ตามไฟล์ของผู้ใช้ "ต้นทุนสินค้า … 15 g" (24/11/69):
// ส่วนผสม (น้ำหนัก × ราคา/กก. รวม VAT) · น้ำหนักสินค้าที่ได้ / สูญเสีย / จำนวนสินค้าที่ได้ · บรรจุภัณฑ์ (ราคา/ชิ้น รวม VAT + หมายเหตุ) · รูปสินค้า

var RD_TABLES_ = {
  rd_products: { tab: 'ผลิตภัณฑ์ใหม่', cols: [
    ['id', 'รหัส'], ['code', 'เลขที่'], ['name', 'ชื่อผลิตภัณฑ์'], ['category', 'ประเภทสินค้า'], ['market', 'ตลาด'],
    ['partners', 'คู่ค้า'], ['startDate', 'วันที่เริ่ม'], ['endDate', 'วันที่สิ้นสุด (กำหนด)'], ['status', 'สถานะ'], ['doneDate', 'วันที่เสร็จจริง'],
    ['owner', 'ผู้รับผิดชอบ'], ['note', 'หมายเหตุ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  rd_partners: { tab: 'คู่ค้า', cols: [
    ['id', 'รหัส'], ['name', 'ชื่อคู่ค้า'], ['type', 'ในประเทศ / ต่างประเทศ'], ['country', 'ประเทศ'], ['channel', 'ช่องทางขาย'],
    ['contact', 'ผู้ติดต่อ'], ['phone', 'เบอร์โทร'], ['products', 'สินค้าที่ส่งขาย'], ['note', 'หมายเหตุ'], ['active', 'สถานะ'],
    ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  // แบบรายงานการทดลองผลิตภัณฑ์ใหม่ FM-RD-01-01 — 1 แถว = การทดลอง 1 ครั้ง ของผลิตภัณฑ์ 1 ตัว
  rd_trials: { tab: 'การทดลอง', cols: [
    ['id', 'รหัส'], ['productId', 'รหัสผลิตภัณฑ์'], ['productName', 'ชื่อสินค้า'], ['round', 'สูตรการทดลองครั้งที่'], ['date', 'วันที่ทำการทดลอง'],
    ['group', 'กลุ่มสินค้า'], ['unit', 'หน่วยปริมาณ'], ['ingredients', 'ส่วนผสม (R&D / 1st Batch)'], ['weightBefore', 'น้ำหนักก่อนอบ'], ['weightAfter', 'น้ำหนักหลังอบ'],
    ['brixRd', 'BRIX / SALI สูตร R&D'], ['brixBatch', 'BRIX / SALI สูตร 1st Batch'], ['moisture', 'ค่าความชื้น'], ['packing', 'ลักษณะการบรรจุ'],
    ['prep', 'ขั้นตอนการเตรียมวัตถุดิบ'], ['process', 'ขั้นตอนการทำ'], ['diff', 'ความแตกต่าง R&D กับ 1st Batch'], ['sensory', 'คะแนนประสาทสัมผัส'],
    ['result', 'ผลการประเมิน'], ['comment', 'ผลการประเมิน / ข้อเสนอแนะ'], ['trialBy', 'ผู้ทดลอง'], ['approvedBy', 'ผู้อนุมัติ'], ['photos', 'รูปภาพ'],
    ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  // ต้นทุนสินค้า — 1 แถว = 1 สินค้า (ส่วนผสม / บรรจุภัณฑ์ เก็บเป็น JSON)
  rd_costs: { tab: 'ต้นทุนสินค้า', cols: [
    ['id', 'รหัส'], ['name', 'ชื่อสินค้า'], ['size', 'ขนาด'], ['brand', 'ตรา'], ['productId', 'รหัสผลิตภัณฑ์ใหม่'], ['costDate', 'วันที่อัพเดท'],
    ['ingredients', 'ส่วนผสม'], ['yieldQty', 'น้ำหนักสินค้าที่ได้'], ['yieldUnit', 'หน่วยน้ำหนักที่ได้'], ['lossQty', 'น้ำหนักที่สูญเสีย'], ['lossUnit', 'หน่วยน้ำหนักสูญเสีย'],
    ['outQty', 'จำนวนสินค้าที่ได้'], ['outUnit', 'หน่วยสินค้า'], ['packaging', 'บรรจุภัณฑ์'], ['matCost', 'ราคาวัตถุดิบรวม'], ['photo', 'รูปสินค้า'],
    ['note', 'หมายเหตุ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  rd_settings: { tab: 'ตั้งค่า', cols: [['id', 'รายการ'], ['value', 'ค่า']] }
};
var RD_SENSORY_ = [['look', 'ลักษณะปรากฏ'], ['color', 'สี'], ['smell', 'กลิ่น'], ['taste', 'รส'], ['texture', 'เนื้อสัมผัส']];
var RD_MARKETS_ = { dom: 'ในประเทศ', exp: 'ต่างประเทศ' };
var RD_STATUS_ = { dev: 'กำลังพัฒนา', done: 'พัฒนาเสร็จ', launched: 'วางจำหน่ายแล้ว', hold: 'พักไว้', cancel: 'ยกเลิก' };
var RD_SETTINGS_DEFAULT_ = {
  categories: 'น้ำพริก, พริกน้ำมัน, ซอส, ก๋วยเตี๋ยว, ทอด',
  channels: '7-Eleven, ห้างสรรพสินค้า, ร้านค้าส่ง, ออนไลน์, ส่งออก, OEM'
};

// ---------- พื้นฐาน ----------
function requireRd_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'rd') throw new Error('แผนกนี้ไม่มีระบบวิจัยและพัฒนา');
  return dept;
}
function rdRegister_() {
  Object.keys(RD_TABLES_).forEach(function (k) { PUR_TABLES_[k] = RD_TABLES_[k]; });
  ['startDate', 'endDate', 'doneDate', 'date', 'costDate'].forEach(function (k) { PUR_DATE_KEYS_[k] = 1; });
  PUR_NUM_KEYS_.round = 1;
}
function rdBook_(dept) { rdRegister_(); return purBook_(dept); }
function rdText_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 1000); }
function rdSettings_(ss) {
  var s = {};
  Object.keys(RD_SETTINGS_DEFAULT_).forEach(function (k) { s[k] = RD_SETTINGS_DEFAULT_[k]; });
  purRead_(ss, 'rd_settings').forEach(function (x) { if (x.id) s[x.id] = String(x.value == null ? '' : x.value); });
  return s;
}
// รายการคู่ค้า / สินค้า เก็บเป็นข้อความบรรทัดละรายการ
function rdLines_(v, maxN, maxLen) {
  var a = Array.isArray(v) ? v : String(v || '').split(/\n|,(?=\s*\S)/);
  var seen = {}, out = [];
  a.forEach(function (x) { x = purClean_(x, maxLen || 150); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out.slice(0, maxN || 100);
}
function rdNextCode_(list, date) {
  var pre = 'NP' + String(date).slice(2, 4) + String(date).slice(5, 7) + '-', n = 0;
  list.forEach(function (x) { if (String(x.code).indexOf(pre) === 0) n = Math.max(n, parseInt(String(x.code).slice(pre.length), 10) || 0); });
  return pre + ('00' + (n + 1)).slice(-3);
}
function rdOut_(p, today) {
  p.partners = rdLines_(p.partners, 50);
  p.overdue = p.status === 'dev' && p.endDate && p.endDate < today;
  return p;
}
function rdPartnerOut_(x) { x.products = rdLines_(x.products, 200); return x; }

// ---------- โหลด ----------
// ต้นทุนอยู่ชีตการ์ด COST เมื่อผูกแล้ว (Cost.gs costHome_) ไม่งั้นอยู่ชีต RD
function rdCostsFor_(ss) {
  try { var h = costHome_(); return purRead_(h.key === 'RD' ? ss : rdBook_(h), 'rd_costs').map(rdCostOut_); } catch (e) { return []; }
}
function rdLoad(token) {
  var dept = requireRd_(token), ss = rdBook_(dept), today = purToday_();
  return { ok: true, today: today, sheetUrl: ss.getUrl(), settings: rdSettings_(ss),
    products: purRead_(ss, 'rd_products').map(function (p) { return rdOut_(p, today); }),
    partners: purRead_(ss, 'rd_partners').map(rdPartnerOut_),
    trials: purRead_(ss, 'rd_trials').map(rdTrialOut_), costs: rdCostsFor_(ss), hasFolder: !!deptConfig_(dept.key).folderId };
}
function rdJson_(v, def) { try { var o = typeof v === 'string' ? JSON.parse(v || '') : v; return o == null ? def : o; } catch (e) { return def; } }
function rdTrialOut_(t) {
  t.ingredients = rdJson_(t.ingredients, []); t.sensory = rdJson_(t.sensory, {}); t.photos = purParseFiles_(t.photos);
  t.round = Number(t.round) || 1;
  return t;
}

// ---------- ผลิตภัณฑ์ใหม่ ----------
function rdSaveProduct(token, p) {
  var dept = requireRd_(token);
  p = p || {};
  var name = purClean_(p.name, 150);
  if (!name) return { ok: false, error: 'ใส่ชื่อผลิตภัณฑ์' };
  var start = purDate_(p.startDate), end = purDate_(p.endDate);
  if (!start) return { ok: false, error: 'ใส่วันที่เริ่ม' };
  if (!end) return { ok: false, error: 'ใส่วันที่สิ้นสุด (กำหนดเสร็จ)' };
  if (end < start) return { ok: false, error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม' };
  var st = RD_STATUS_[p.status] ? p.status : 'dev', done = purDate_(p.doneDate);
  if ((st === 'done' || st === 'launched') && !done) done = purToday_();
  if (st === 'dev' || st === 'hold') done = '';
  if (done && done < start) return { ok: false, error: 'วันที่เสร็จจริงต้องไม่ก่อนวันที่เริ่ม' };
  return purLocked_(function () {
    var ss = rdBook_(dept), list = purRead_(ss, 'rd_products'), now = purNow_();
    var old = p.id ? list.filter(function (x) { return x.id === p.id; })[0] : null;
    if (p.id && !old) return { ok: false, error: 'ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)' };
    var o = old || { id: purId_('NP'), code: rdNextCode_(list, start), createdAt: now };
    o.name = name; o.category = purClean_(p.category, 60); o.market = RD_MARKETS_[p.market] ? p.market : 'dom';
    o.partners = rdLines_(p.partners, 50).join('\n'); o.startDate = start; o.endDate = end; o.status = st; o.doneDate = done;
    o.owner = purClean_(p.owner, 80); o.note = rdText_(p.note, 1000); o.updatedAt = now;
    purWrite_(ss, 'rd_products', o);
    purLogWrite_(ss, old ? 'แก้ผลิตภัณฑ์ใหม่' : 'เพิ่มผลิตภัณฑ์ใหม่', 'rd_products', o.id, o.code + ' ' + o.name + ' · ' + RD_STATUS_[st]);
    var row = purRead_(ss, 'rd_products').filter(function (x) { return x.id === o.id; })[0];
    return { ok: true, product: rdOut_(row, purToday_()) };
  });
}
function rdDeleteProduct(token, id) {
  var dept = requireRd_(token);
  return purLocked_(function () {
    var ss = rdBook_(dept), row = purRead_(ss, 'rd_products').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการนี้' };
    var n = purRead_(ss, 'rd_trials').filter(function (x) { return x.productId === id; }).length;
    if (n) return { ok: false, error: 'มีบันทึกการทดลอง ' + n + ' ครั้ง — ลบการทดลองก่อน หรือเปลี่ยนสถานะเป็น "ยกเลิก" แทน' };
    purSheet_(ss, 'rd_products').deleteRow(row._row);
    purLogWrite_(ss, 'ลบผลิตภัณฑ์ใหม่', 'rd_products', id, row.code + ' ' + row.name);
    return { ok: true };
  });
}

// ---------- การทดลอง (FM-RD-01-01) ----------
// ส่วนผสม: [{ name, rd, batch }] ปริมาณต่อ batch (หน่วยตาม unit) · % คำนวณที่หน้าเว็บ/ตอนพิมพ์
function rdCleanIngredients_(a) {
  var num = function (v) { var n = purNum_(v); return n === '' || n < 0 || n > 1e7 ? '' : Math.round(n * 1000) / 1000; };
  return (Array.isArray(a) ? a : []).slice(0, 60).map(function (x) { x = x || {}; return { name: purClean_(x.name, 100), rd: num(x.rd), batch: num(x.batch) }; })
    .filter(function (x) { return x.name || x.rd !== '' || x.batch !== ''; });
}
function rdSaveTrial(token, t) {
  var dept = requireRd_(token);
  t = t || {};
  var date = purDate_(t.date);
  if (!date) return { ok: false, error: 'ใส่วันที่ทำการทดลอง' };
  var ing = rdCleanIngredients_(t.ingredients);
  if (ing.some(function (x) { return !x.name; })) return { ok: false, error: 'ส่วนผสมทุกแถวต้องมีชื่อ' };
  var sens = {}; RD_SENSORY_.forEach(function (k) { var n = Math.round(Number((t.sensory || {})[k[0]])); if (n >= 1 && n <= 5) sens[k[0]] = n; });
  return purLocked_(function () {
    var ss = rdBook_(dept), prod = purRead_(ss, 'rd_products').filter(function (x) { return x.id === t.productId; })[0];
    if (!prod) return { ok: false, error: 'ไม่พบผลิตภัณฑ์' };
    var all = purRead_(ss, 'rd_trials'), now = purNow_();
    var old = t.id ? all.filter(function (x) { return x.id === t.id; })[0] : null;
    if (t.id && !old) return { ok: false, error: 'ไม่พบการทดลองนี้ (อาจถูกลบไปแล้ว)' };
    var mine = all.filter(function (x) { return x.productId === prod.id; });
    var round = Math.round(Number(t.round)) || (mine.reduce(function (m, x) { return Math.max(m, Number(x.round) || 0); }, 0) + 1);
    if (round < 1 || round > 999) return { ok: false, error: 'ครั้งที่ทดลองไม่ถูกต้อง' };
    if (mine.some(function (x) { return x.id !== t.id && Number(x.round) === round; })) return { ok: false, error: 'มีการทดลองครั้งที่ ' + round + ' ของสินค้านี้แล้ว' };
    var o = old || { id: purId_('TR'), photos: '[]', createdAt: now };
    o.productId = prod.id; o.productName = prod.name; o.round = round; o.date = date; o.group = purClean_(t.group, 80);
    o.unit = purClean_(t.unit, 20) || 'กรัม'; o.ingredients = JSON.stringify(ing);
    ['weightBefore', 'weightAfter', 'brixRd', 'brixBatch', 'moisture', 'trialBy', 'approvedBy'].forEach(function (k) { o[k] = purClean_(t[k], 120); });
    ['packing', 'prep', 'process', 'diff', 'comment'].forEach(function (k) { o[k] = rdText_(t[k], 4000); });
    o.sensory = JSON.stringify(sens); o.result = t.result === 'pass' || t.result === 'fail' ? t.result : ''; o.updatedAt = now;
    purWrite_(ss, 'rd_trials', o);
    purLogWrite_(ss, old ? 'แก้การทดลอง' : 'บันทึกการทดลอง', 'rd_trials', o.id, prod.code + ' ' + prod.name + ' ครั้งที่ ' + round + (o.result ? ' · ' + (o.result === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน') : ''));
    return { ok: true, trial: rdTrialOut_(purRead_(ss, 'rd_trials').filter(function (x) { return x.id === o.id; })[0]) };
  });
}
function rdDeleteTrial(token, id) {
  var dept = requireRd_(token);
  return purLocked_(function () {
    var ss = rdBook_(dept), row = purRead_(ss, 'rd_trials').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบการทดลองนี้' };
    purParseFiles_(row.photos).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    purSheet_(ss, 'rd_trials').deleteRow(row._row);
    purLogWrite_(ss, 'ลบการทดลอง', 'rd_trials', id, row.productName + ' ครั้งที่ ' + row.round);
    return { ok: true };
  });
}
function rdPhotoFolder_(dept) {
  var folderId = deptConfig_(dept.key).folderId;
  if (!folderId) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่าย');
  var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName('รูปการทดลอง RD');
  return it.hasNext() ? it.next() : parent.createFolder('รูปการทดลอง RD');
}
// รูปของการทดลอง (รูปแรก = ภาพสินค้าในแบบรายงาน) — แชร์แบบมีลิงก์ดูได้ เพื่อให้หน้าเว็บ / แบบพิมพ์แสดงรูปได้
function rdUploadTrialPhoto(token, trialId, fileName, mimeType, base64, caption) {
  var dept = requireRd_(token);
  if (!/^image\/(jpeg|png)$/.test(mimeType)) return { ok: false, error: 'แนบได้เฉพาะรูป JPG / PNG' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return { ok: false, error: 'รูปว่างหรือใหญ่เกิน 8 MB' };
  return purLocked_(function () {
    var ss = rdBook_(dept), o = purRead_(ss, 'rd_trials').filter(function (x) { return x.id === trialId; })[0];
    if (!o) return { ok: false, error: 'บันทึกการทดลองก่อน แล้วค่อยแนบรูป' };
    var files = purParseFiles_(o.photos);
    if (files.length >= 10) return { ok: false, error: 'แนบได้สูงสุด 10 รูปต่อการทดลอง' };
    var safe = purClean_(fileName, 80).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
    var f = rdPhotoFolder_(dept).createFile(Utilities.newBlob(bytes, mimeType, String(o.productName).slice(0, 40) + '_ครั้งที่' + o.round + '_' + safe));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    files.push({ id: f.getId(), name: safe, caption: purClean_(caption, 80), url: 'https://lh3.googleusercontent.com/d/' + f.getId(), at: purNow_() });
    o.photos = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'rd_trials', o);
    return { ok: true, photos: files };
  });
}
function rdRemoveTrialPhoto(token, trialId, fileId) {
  var dept = requireRd_(token);
  return purLocked_(function () {
    var ss = rdBook_(dept), o = purRead_(ss, 'rd_trials').filter(function (x) { return x.id === trialId; })[0];
    if (!o) return { ok: false, error: 'ไม่พบการทดลอง' };
    var files = purParseFiles_(o.photos).filter(function (x) { return x.id !== fileId; });
    o.photos = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'rd_trials', o);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    return { ok: true, photos: files };
  });
}

// ---------- คู่ค้า ----------
function rdSavePartner(token, x) {
  var dept = requireRd_(token);
  x = x || {};
  var name = purClean_(x.name, 150);
  if (!name) return { ok: false, error: 'ใส่ชื่อคู่ค้า' };
  return purLocked_(function () {
    var ss = rdBook_(dept), list = purRead_(ss, 'rd_partners'), now = purNow_();
    var old = x.id ? list.filter(function (r) { return r.id === x.id; })[0] : null;
    if (x.id && !old) return { ok: false, error: 'ไม่พบคู่ค้านี้ (อาจถูกลบไปแล้ว)' };
    if (list.some(function (r) { return r.id !== x.id && String(r.name).trim().toLowerCase() === name.toLowerCase(); })) return { ok: false, error: 'มีคู่ค้าชื่อนี้อยู่แล้ว' };
    var o = old || { id: purId_('CP'), createdAt: now };
    o.name = name; o.type = RD_MARKETS_[x.type] ? x.type : 'dom'; o.country = purClean_(x.country, 80); o.channel = purClean_(x.channel, 80);
    o.contact = purClean_(x.contact, 120); o.phone = purClean_(x.phone, 60); o.products = rdLines_(x.products, 200).join('\n');
    o.note = rdText_(x.note, 1000); o.active = x.active === 'off' ? 'off' : 'on'; o.updatedAt = now;
    purWrite_(ss, 'rd_partners', o);
    purLogWrite_(ss, old ? 'แก้คู่ค้า' : 'เพิ่มคู่ค้า', 'rd_partners', o.id, o.name + ' · ' + RD_MARKETS_[o.type] + ' · สินค้า ' + rdLines_(o.products).length + ' รายการ');
    // ชื่อคู่ค้าเปลี่ยน → แก้ชื่อในผลิตภัณฑ์ใหม่ที่อ้างถึงให้ตรงกัน
    if (old && String(old.name) !== name) purRead_(ss, 'rd_products').forEach(function (p) {
      var a = rdLines_(p.partners, 50), i = a.indexOf(String(old.name));
      if (i >= 0) { a[i] = name; p.partners = a.join('\n'); purWrite_(ss, 'rd_products', p); }
    });
    return { ok: true, partner: rdPartnerOut_(purRead_(ss, 'rd_partners').filter(function (r) { return r.id === o.id; })[0]) };
  });
}
function rdDeletePartner(token, id) {
  var dept = requireRd_(token);
  return purLocked_(function () {
    var ss = rdBook_(dept), row = purRead_(ss, 'rd_partners').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบคู่ค้านี้' };
    purSheet_(ss, 'rd_partners').deleteRow(row._row);
    purLogWrite_(ss, 'ลบคู่ค้า', 'rd_partners', id, row.name);
    return { ok: true };
  });
}

// ---------- ตั้งค่า / ประวัติ ----------
function rdSaveSettings(token, s) {
  var dept = requireRd_(token);
  s = s || {};
  return purLocked_(function () {
    var ss = rdBook_(dept), rows = purRead_(ss, 'rd_settings'), changed = [];
    Object.keys(RD_SETTINGS_DEFAULT_).forEach(function (k) {
      if (s[k] === undefined) return;
      var val = rdLines_(s[k], 60, 80).join(', ');
      var r = rows.filter(function (x) { return x.id === k; })[0];
      if (r && String(r.value) === val) return;
      purWrite_(ss, 'rd_settings', r ? Object.assign(r, { value: val }) : { id: k, value: val });
      changed.push(k);
    });
    if (changed.length) purLogWrite_(ss, 'แก้ตั้งค่า', 'rd_settings', changed.join(','), '');
    return { ok: true, settings: rdSettings_(ss) };
  });
}
function rdLog(token, limit) {
  var dept = requireRd_(token), ss = rdBook_(dept);
  return { ok: true, rows: purRead_(ss, 'log').reverse().slice(0, Math.min(500, Number(limit) || 200)) };
}

// ---------- Dashboard (หน้าฝ่าย + ผู้บริหาร) ----------
function rdDashboard(token, from, to) {
  var dept = requireRd_(token);
  if (!purDate_(from) || !purDate_(to) || from > to) return { ok: false, error: 'เลือกช่วงวันที่ให้ถูกต้อง' };
  var d = rdDashboard_(dept, from, to); d.ok = true; return d;
}
function rdDashboard_(dept, from, to) {
  var ss = rdBook_(dept), today = purToday_();
  var all = purRead_(ss, 'rd_products').map(function (p) { return rdOut_(p, today); });
  var partners = purRead_(ss, 'rd_partners').map(rdPartnerOut_).filter(function (x) { return x.active !== 'off'; });
  // โครงการในช่วง = ช่วงพัฒนาคาบเกี่ยวกับช่วงที่เลือก (เริ่มก่อนสิ้นช่วง และยังไม่จบก่อนต้นช่วง)
  var inRange = all.filter(function (p) { var end = p.doneDate || (p.status === 'dev' || p.status === 'hold' ? today : p.endDate); return p.startDate <= to && (end || p.endDate) >= from; });
  var cnt = function (arr, fn) { var o = {}; arr.forEach(function (x) { var k = fn(x) || '-'; o[k] = (o[k] || 0) + 1; }); return Object.keys(o).map(function (k) { return { name: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }); };
  var finished = all.filter(function (p) { return p.doneDate && p.doneDate >= from && p.doneDate <= to; });
  var onTime = finished.filter(function (p) { return p.doneDate <= p.endDate; }).length;
  var dev = all.filter(function (p) { return p.status === 'dev'; });
  var trials = purRead_(ss, 'rd_trials').filter(function (t) { return t.date >= from && t.date <= to; });
  var brief = function (p) { return { id: p.id, code: p.code, name: p.name, category: p.category, market: p.market, startDate: p.startDate, endDate: p.endDate, doneDate: p.doneDate, status: p.status, overdue: p.overdue, partners: p.partners }; };
  return { kind: 'rd', from: from, to: to, today: today,
    kpi: { inRange: inRange.length, dev: dev.length, overdue: dev.filter(function (p) { return p.overdue; }).length, finished: finished.length, onTime: onTime,
      launched: all.filter(function (p) { return p.status === 'launched'; }).length, partners: partners.length,
      trials: trials.length, trialPass: trials.filter(function (t) { return t.result === 'pass'; }).length, trialFail: trials.filter(function (t) { return t.result === 'fail'; }).length,
      partnersDom: partners.filter(function (x) { return x.type !== 'exp'; }).length, partnersExp: partners.filter(function (x) { return x.type === 'exp'; }).length },
    byCategory: cnt(inRange, function (p) { return p.category; }),
    byMarket: cnt(inRange, function (p) { return RD_MARKETS_[p.market]; }),
    byStatus: cnt(inRange, function (p) { return RD_STATUS_[p.status]; }),
    dueList: dev.slice().sort(function (a, b) { return String(a.endDate).localeCompare(String(b.endDate)); }).slice(0, 15).map(brief),
    finishedList: finished.sort(function (a, b) { return String(b.doneDate).localeCompare(String(a.doneDate)); }).slice(0, 10).map(brief),
    topPartners: partners.map(function (x) { return { name: x.name, type: x.type, country: x.country, n: x.products.length }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10) };
}

// ---------- ต้นทุนสินค้า (ผู้ใช้ขอ 24/11/69 — ตามแบบไฟล์ Excel ของ R&D) ----------
var RD_WUNITS_ = { 'กรัม': 1, 'กก.': 1000 };
function rdNum_(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function rdCostOut_(c) {
  c.ingredients = rdJson_(c.ingredients, []); c.packaging = rdJson_(c.packaging, []);
  var ph = purParseFiles_(c.photo); c.photo = ph[0] || null;
  return c;
}
// ราคาวัตถุดิบ 1 แถว = (ราคา/กก. ÷ 1000) × น้ำหนัก (กรัม) — เหมือนสูตรในไฟล์ =(L6/1000)*I6
// หน่วยส่วนผสม (ผู้ใช้ขอ 24/11/69): กรัม / กก. → ราคาต่อ กก. · มล. / ลิตร → ราคาต่อลิตร · หน่วยอื่นที่พิมพ์เอง → ราคาต่อหน่วยนั้น
var RD_UNIT_F_ = { 'กรัม': 0.001, 'กก.': 1, 'มล.': 0.001, 'ลิตร': 1 };
function rdIngCost_(x) { var f = RD_UNIT_F_[x.unit]; return Math.round(rdNum_(x.price) * rdNum_(x.qty) * (f == null ? 1 : f) * 100) / 100; }
function rdSaveCost(token, c) {
  var dept = costDept_(token); c = c || {};
  var name = rdText_(c.name, 150);
  if (!name) return { ok: false, error: 'กรอกชื่อสินค้า' };
  var ing = (Array.isArray(c.ingredients) ? c.ingredients : []).slice(0, 80).map(function (x) {
    return { name: rdText_(x && x.name, 120), qty: rdNum_(x && x.qty) || '', unit: rdText_(x && x.unit, 20) || 'กรัม', price: rdNum_(x && x.price) || '', vendor: rdText_(x && x.vendor, 120), pnote: rdText_(x && x.pnote, 80) };
  }).filter(function (x) { return x.name || x.qty || x.price; });
  var pack = (Array.isArray(c.packaging) ? c.packaging : []).slice(0, 40).map(function (x) {
    return { name: rdText_(x && x.name, 120), price: rdNum_(x && x.price) || '', per: rdNum_(x && x.per) || '', note: rdText_(x && x.note, 200), vendor: rdText_(x && x.vendor, 120), pnote: rdText_(x && x.pnote, 80) };
  }).filter(function (x) { return x.name || x.price; });
  return purLocked_(function () {
    var ss = rdBook_(dept), now = purNow_();
    var old = c.id ? purRead_(ss, 'rd_costs').filter(function (x) { return x.id === c.id; })[0] : null;
    var o = old || { id: purId_('CO'), photo: '[]', createdAt: now };
    o.name = name; o.size = rdText_(c.size, 40); o.brand = rdText_(c.brand, 60); o.productId = rdText_(c.productId, 40);
    o.costDate = /^\d{4}-\d{2}-\d{2}$/.test(String(c.costDate)) ? c.costDate : purToday_();
    o.ingredients = JSON.stringify(ing); o.packaging = JSON.stringify(pack);
    ['yieldQty', 'lossQty', 'outQty'].forEach(function (k) { o[k] = rdNum_(c[k]) || ''; });
    o.yieldUnit = rdText_(c.yieldUnit, 20) || 'กรัม'; o.lossUnit = rdText_(c.lossUnit, 20) || 'กรัม'; o.outUnit = rdText_(c.outUnit, 20) || 'ซอง';
    o.matCost = Math.round(ing.reduce(function (t, x) { return t + rdIngCost_(x); }, 0) * 100) / 100;
    o.note = rdText_(c.note, 1000); o.updatedAt = now;
    purWrite_(ss, 'rd_costs', o);
    purLogWrite_(ss, (old ? 'แก้ไข' : 'เพิ่ม') + 'ต้นทุนสินค้า', 'rd_costs', o.id, name + (o.size ? ' ' + o.size : '') + ' · วัตถุดิบ ' + o.matCost + ' บาท');
    return { ok: true, cost: rdCostOut_(Object.assign({}, o)) };
  });
}
function rdDeleteCost(token, id) {
  var dept = costDept_(token);
  return purLocked_(function () {
    var ss = rdBook_(dept), row = purRead_(ss, 'rd_costs').filter(function (x) { return x.id === id; })[0];
    if (!row) return { ok: false, error: 'ไม่พบรายการ' };
    purParseFiles_(row.photo).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    purSheet_(ss, 'rd_costs').deleteRow(row._row);
    purLogWrite_(ss, 'ลบต้นทุนสินค้า', 'rd_costs', id, row.name);
    return { ok: true };
  });
}
// รูปสินค้า 1 รูปต่อรายการ (อัปโหลดใหม่ = แทนรูปเดิม) · โฟลเดอร์ฝ่าย / "รูปต้นทุนสินค้า RD" · แชร์แบบมีลิงก์ดูได้
function rdUploadCostPhoto(token, costId, fileName, mimeType, base64) {
  var dept = costDept_(token);
  if (!/^image\/(jpeg|png)$/.test(mimeType)) return { ok: false, error: 'แนบได้เฉพาะรูป JPG / PNG' };
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return { ok: false, error: 'รูปว่างหรือใหญ่เกิน 8 MB' };
  return purLocked_(function () {
    var ss = rdBook_(dept), o = purRead_(ss, 'rd_costs').filter(function (x) { return x.id === costId; })[0];
    if (!o) return { ok: false, error: 'บันทึกรายการก่อน แล้วค่อยใส่รูป' };
    var folderId = deptConfig_(dept.key).folderId;
    if (!folderId) return { ok: false, error: 'ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่าย' };
    var parent = DriveApp.getFolderById(folderId), it = parent.getFoldersByName(dept.key === 'COST' ? 'รูปต้นทุนสินค้า' : 'รูปต้นทุนสินค้า RD');
    var folder = it.hasNext() ? it.next() : parent.createFolder(dept.key === 'COST' ? 'รูปต้นทุนสินค้า' : 'รูปต้นทุนสินค้า RD');
    var safe = purClean_(fileName, 80).replace(/[\\/:*?"<>|]/g, '_') || 'photo.jpg';
    var f = folder.createFile(Utilities.newBlob(bytes, mimeType, String(o.name).slice(0, 40) + '_' + safe));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    purParseFiles_(o.photo).forEach(function (x) { try { DriveApp.getFileById(x.id).setTrashed(true); } catch (e) {} });
    var files = [{ id: f.getId(), name: safe, url: 'https://lh3.googleusercontent.com/d/' + f.getId(), at: purNow_() }];
    o.photo = JSON.stringify(files); o.updatedAt = purNow_();
    purWrite_(ss, 'rd_costs', o);
    return { ok: true, photo: files[0] };
  });
}
function rdRemoveCostPhoto(token, costId) {
  var dept = costDept_(token);
  return purLocked_(function () {
    var ss = rdBook_(dept), o = purRead_(ss, 'rd_costs').filter(function (x) { return x.id === costId; })[0];
    if (!o) return { ok: false, error: 'ไม่พบรายการ' };
    purParseFiles_(o.photo).forEach(function (x) { try { DriveApp.getFileById(x.id).setTrashed(true); } catch (e) {} });
    o.photo = '[]'; o.updatedAt = purNow_();
    purWrite_(ss, 'rd_costs', o);
    return { ok: true };
  });
}
