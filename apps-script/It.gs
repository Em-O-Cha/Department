// ==================== ฝ่าย IT (ระบบจัดการองค์กร) — ผู้ใช้ขอ 27/11/69 ====================
// การ์ดที่ผู้ใช้เข้าเอง: ① หน้าแอดมิน Members LINE (เปิดในกรอบ) ② แก้ข้อมูล Master Data Sales ในชีตเดิม
// (ทุกระบบ — ระบบขาย, Stock Flow, LINE Shop, Dashboard Meeting — ยังอ่านชีตเดิม ไม่ได้ย้ายข้อมูล) ③ ลิงก์ Stripe Dashboard
// แท็บ SKU ใช้เฉพาะคอลัมน์ H–M (ผู้ใช้กำหนด) — M = สต๊อกคงเหลือที่ Stock Flow เขียนให้ จึงแก้ไม่ได้ (ย้ายตามแถวเมื่อลบ / เรียงใหม่)
// ลิงก์ / ไอดีอยู่ใน ItPrivate.gs (ไม่อยู่ใน repo สาธารณะ)
var IT_TABS_ = {
  sku: { tab: 'SKU', c0: 8, cols: [['Product_Name', 'text'], ['Pack', 'text'], ['Price on Line', 'num'], ['Link', 'url'], ['Weight', 'num'], ['สต๊อกคงเหลือ', 'ro']] },
  bulk: { tab: 'SKU Bulk', c0: 1, cols: [['Product_Name', 'text'], ['Pack', 'text'], ['5-9 ลัง', 'num'], ['10-19 ลัง', 'num'], ['20-29 ลัง', 'num'], ['30-49 ลัง', 'num'], ['50 ลังขึ้นไป', 'num'], ['Link', 'url'], ['Weight', 'num'], ['สต๊อกคงเหลือ', 'ro']] },
  exp: { tab: 'SKU ส่งออก', c0: 1, cols: [['ProductName', 'text'], ['ProductName (Eng)', 'text'], ['Price', 'num'], ['Weight', 'num']] },
  pay: { tab: 'Payment', c0: 1, cols: [['PaymentType', 'text']] },
  staff: { tab: 'Sales Name', c0: 1, cols: [['StaffName', 'text']] },
  camp: { tab: 'Campaign', c0: 1, cols: [['CampaignName', 'text']] },
  ad: { tab: 'AD', c0: 1, cols: [['Channel Name', 'text'], ['Channel Name (Eng)', 'text']] },
  cust: { tab: 'Customer', c0: 1, cols: [['Customer Type', 'text']] },
  target: { tab: 'Target', c0: 1, cols: [['Month', 'text'], ['Shopee', 'num'], ['TikTok', 'num'], ['Line Shop', 'num'], ['Facebook', 'num'], ['Bulk Buyers', 'num'], ['Total', 'ro']] },
  kwItem: { tab: 'DashboardKeywordGroups_Item', c0: 1, cols: [['GroupName', 'text'], ['Keywords (คั่นด้วย ,)', 'text']] },
  kwProd: { tab: 'DashboardKeywordGroups_Product', c0: 1, cols: [['GroupName', 'text'], ['Keywords (คั่นด้วย ,)', 'text']] }
};
function requireIt_(token) {
  var dept = requireDept_(token);
  if (DEPT_MODULES_[dept.key] !== 'it') throw new Error('การ์ดนี้ไม่มีระบบ IT');
  return dept;
}
function itInfo(token) {
  requireIt_(token);
  return { ok: true, membersUrl: typeof IT_MEMBERS_URL_ !== 'undefined' ? IT_MEMBERS_URL_ : '' };
}
function itSheet_(key) {
  var t = IT_TABS_[key];
  if (!t) throw new Error('ไม่รู้จักตารางนี้');
  if (typeof IT_MASTER_SHEET_ID_ === 'undefined' || !IT_MASTER_SHEET_ID_) throw new Error('ยังไม่ได้ตั้งชีต Master Data');
  var sh = SpreadsheetApp.openById(IT_MASTER_SHEET_ID_).getSheetByName(t.tab);
  if (!sh) throw new Error('ไม่พบแท็บ ' + t.tab + ' ในชีต Master Data');
  return { t: t, sh: sh };
}
// อ่านบล็อกคอลัมน์ของตาราง (แถว 2 ถึงแถวสุดท้ายที่มีข้อมูลในบล็อก) — สูตร (=...) คืนเป็นข้อความสูตร
function itRead_(o) {
  var t = o.t, sh = o.sh, n = sh.getLastRow() - 1, w = t.cols.length;
  if (n < 1) return [];
  var rg = sh.getRange(2, t.c0, n, w), v = rg.getValues(), f = rg.getFormulas(), out = [];
  for (var i = 0; i < n; i++) out.push(v[i].map(function (x, j) { return f[i][j] ? f[i][j] : (x instanceof Date ? Utilities.formatDate(x, PUR_TZ_, 'yyyy-MM-dd') : x); }));
  while (out.length && out[out.length - 1].every(function (x) { return x === '' || x == null; })) out.pop();
  return out;
}
function itSig_(rows, t) {
  var ed = rows.map(function (r) { return r.filter(function (x, j) { return t.cols[j][1] !== 'ro'; }).join('\u0001'); }).join('\u0002');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ed, Utilities.Charset.UTF_8));
}
function itMasterLoad(token, key) {
  requireIt_(token);
  var o = itSheet_(key), rows = itRead_(o);
  return { ok: true, key: key, tab: o.t.tab, col0: o.t.c0, cols: o.t.cols.map(function (c) { return { label: c[0], type: c[1] }; }), rows: rows, sig: itSig_(rows, o.t),
    url: 'https://docs.google.com/spreadsheets/d/' + IT_MASTER_SHEET_ID_ + '/edit#gid=' + o.sh.getSheetId() };
}
// rows = [{ from: เลขแถวเดิม (index ใน rows ที่โหลด, -1 = แถวใหม่), v: [ค่าคอลัมน์ที่แก้ได้ตามลำดับ] }]
// คอลัมน์ ro ใช้ค่าเดิมของแถวต้นทาง (เช่น สต๊อกคงเหลือ ย้ายตามสินค้า) · เขียนทับบล็อกทั้งก้อน แล้วล้างแถวที่เหลือ (เฉพาะคอลัมน์ของบล็อก)
function itMasterSave(token, key, rows, sig) {
  requireIt_(token);
  if (!Array.isArray(rows) || rows.length > 3000) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  return purLocked_(function () {
    var o = itSheet_(key), t = o.t, old = itRead_(o);
    if (sig && sig !== itSig_(old, t)) return { ok: false, conflict: true, error: 'มีคนแก้ข้อมูลตารางนี้ระหว่างที่คุณแก้ — กด "โหลดใหม่" แล้วแก้อีกครั้ง' };
    var w = t.cols.length, out = [];
    // สูตรที่อ้างแถวตัวเอง (เช่น Total =SUM(B2:F2)) เลื่อนเลขแถวตามตำแหน่งใหม่
    var shift = function (x, from, to) { return typeof x === 'string' && /^=/.test(x) && from !== to ? x.replace(new RegExp('([A-Z]{1,3})\\$?' + from + '(?![0-9])', 'g'), function (m, c) { return c + to; }) : x; };
    rows.forEach(function (r) {
      var src = r && r.from >= 0 && old[r.from] ? old[r.from] : null, k = 0, line = [];
      var rowNo = 2 + out.length, prev = out.length ? out[out.length - 1] : null;
      for (var j = 0; j < w; j++) {
        if (t.cols[j][1] === 'ro') {
          var rv = src ? shift(src[j], 2 + r.from, rowNo) : (prev && typeof prev[j] === 'string' && /^=/.test(prev[j]) ? shift(prev[j], rowNo - 1, rowNo) : '');
          line.push(rv); continue;
        }
        var x = r && Array.isArray(r.v) ? r.v[k++] : '';
        x = x == null ? '' : String(x).replace(/\r/g, '').trim().slice(0, 2000);
        if (t.cols[j][1] === 'num' && x !== '' && !/^=/.test(x)) { var n = Number(x.replace(/,/g, '')); x = isFinite(n) ? n : x; }
        if (/^=/.test(x) && src) x = shift(x, 2 + r.from, rowNo);
        line.push(x);
      }
      if (line.some(function (x, j) { return t.cols[j][1] !== 'ro' && x !== ''; })) out.push(line);
    });
    if (out.length) o.sh.getRange(2, t.c0, out.length, w).setValues(out);
    var extra = old.length - out.length;
    if (extra > 0) o.sh.getRange(2 + out.length, t.c0, extra, w).clearContent();
    SpreadsheetApp.flush();
    var now = itRead_(o);
    return { ok: true, rows: now, sig: itSig_(now, t), saved: out.length };
  });
}
