// ==================== ฝ่ายบัญชี — ค่าใช้จ่าย (จ่าย) ตามรอบจ่าย ====================
// เมนูในโมดูลบัญชี กลุ่ม "จ่าย": นำเข้าบิล (a_apin) · รายงานจ่ายตามรอบ (a_ap) · ผู้ขาย / ตั้งค่า (a_apv) — accounting.js เรียก ACCAP.xxxPage()
// นำเข้าบิลจากภาพถ่าย / สแกน / PDF: PDF ที่มีตัวหนังสือ → pdf.js · ภาพ → OCR (tesseract.js ไทย + อังกฤษ) แล้วให้ตรวจกับภาพก่อนบันทึก
// เลือกหมวด + % หัก ณ ที่จ่าย → ส่วนลด/มัดจำ/หัก ณ ที่จ่าย = มูลค่ารายการ × % · รายงานหน้าตาเหมือนไฟล์ "วัตถุดิบจ่าย / บรรจุภัณฑ์จ่าย 10.01.27"
// Excel ตามแบบฟอร์ม (ฟอนต์ Angsana New สี ขนาด ความกว้างช่อง ความสูงแถว เส้น สูตร) สร้างในเบราว์เซอร์ด้วย ExcelJS · API ใน AccPay.gs
// PO ล่วงหน้า (a_appo, ผู้ใช้ขอ 20/11/69): สั่งซื้อแล้วแต่ยังไม่ได้รับบิล — กรอกแค่ ชื่อสินค้า / จำนวน / ราคา → แสดงตัวแดงในรายงาน (เหมือนในไฟล์) · ได้รับบิลแล้ว = เปิดฟอร์มบิลจาก PO เดิม (แนบภาพ / สแกนได้)
(function () {
  var P = window.ACCAP = { data: null, cur: null, round: '', inc: {} };
  var PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var OCR_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';   // ภาษา tha + eng โหลดจาก jsdelivr (@tesseract.js-data) อัตโนมัติ
  var XJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var VAT_SHORT = { inc: 'ราคารวม VAT', exc: 'ราคาไม่รวม VAT', none: 'ไม่มี VAT' };
  var PCTS = [0, 1, 2, 3, 5];

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'); return isoOf(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function slash(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length < 3 ? '-' : p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2); }
  function dotAD(iso, short) { var p = String(iso).split('-'); return p[2] + '.' + p[1] + '.' + (short ? p[0].slice(2) : p[0]); }   // แบบในไฟล์: 11.01.2027 / 10.01.27
  function m2(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function q0(v) { return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 4 }); }
  function num(s) { var n = parseFloat(String(s == null ? '' : s).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || $('main')).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function chk(ok, text) { var c = ok === 'warn' ? 'warn' : ok ? 'ok' : 'bad'; return '<div class="a7chk ' + c + '"><i>' + (c === 'ok' ? '✓' : c === 'warn' ? '!' : '✕') + '</i><span>' + text + '</span></div>'; }
  function msg(html, kind) { var el = $('apMsg'); if (el) el.innerHTML = html ? '<div class="a7msg ' + (kind || '') + '">' + html + '</div>' : ''; }
  function load() { return call('apLoad', state.token).then(function (d) { P.data = d; return d; }); }
  function loading(title) { $('main').innerHTML = '<h3>' + title + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูล…</div>'; }
  function script(url, ready) {
    if (ready()) return Promise.resolve();
    return new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { fail(new Error('โหลดตัวช่วยไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); }; document.head.appendChild(s); });
  }
  function cat(k) { return (P.data.cats || []).filter(function (c) { return c.key === k; })[0] || { key: k, name: k, title: k }; }
  function catNo(k) { var i = (P.data.cats || []).map(function (c) { return c.key; }).indexOf(k); return i < 0 ? 9 : i + 1; }
  function norm(s) { return String(s || '').replace(/\u0E4D\u0E32/g, '\u0E33').toLowerCase().replace(/บริษัท|บจก\.?|จำกัด|\(มหาชน\)|มหาชน|ห้างหุ้นส่วน|หจก\.?|co\.?,?|ltd\.?|limited|\s|[.,()\-]/g, ''); }
  // เทียบแบบหลวม: ไม่สนวรรณยุกต์ / สระบน-ล่าง (OCR มักอ่านหล่น เช่น เทรดดิ้ง → เทรดดิง)
  function loose(s) { return norm(String(s || '').replace(/\u0E4D\u0E32/g, '\u0E33')).replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, ''); }
  // ชื่อตรงกันแบบหลวม: เหมือนกัน หรือชื่อหนึ่งอยู่ในอีกชื่อ (เช่น "บริษัท เอ.ที.บี" กับ "บริษัท เอ.ที.บี บรรจุภัณฑ์ จำกัด") — เลือกชื่อที่ใกล้ที่สุด
  function vendorOf(name) {
    var n = loose(name), vs = (P.data && P.data.vendors) || [];
    if (!n) return null;
    var hit = vs.filter(function (v) { return loose(v.name) === n; })[0];
    if (hit || n.length < 4) return hit || null;
    vs.forEach(function (v) { var k = loose(v.name); if (k.length >= 4 && (k.indexOf(n) >= 0 || n.indexOf(k) >= 0) && (!hit || Math.abs(k.length - n.length) < Math.abs(loose(hit.name).length - n.length))) hit = v; });
    return hit || null;
  }
  function roundOf(nom) { return (P.data.rounds || []).filter(function (r) { return r.nominal === nom; })[0] || { nominal: nom, actual: nom, why: '' }; }
  // รอบจ่ายเริ่มต้น = วันจ่ายรอบแรกที่ไม่ก่อนวันครบกำหนด (แก้ได้)
  function defaultRound(due) {
    var rs = (P.data.rounds || []).map(function (r) { return r.nominal; }).filter(function (d) { return d.slice(8) === pad(P.data.settings.payDay); });
    var base = due || P.data.today;
    return rs.filter(function (d) { return d >= base; })[0] || rs[rs.length - 1] || '';
  }
  // ตัดรอบบิล (ผู้ใช้ขอ 20/11/69 · เลือก "วันตัดรอบ + เครดิต"): บิลวันที่ ≤ วันตัดรอบ (19) → ตัดรอบวันที่ 19 เดือนนั้น · หลังวันที่ 19 → วันที่ 19 เดือนถัดไป
  // แล้วนับเครดิตของผู้ขายจากวันตัดรอบ → รอบจ่าย = วันจ่าย (10) รอบแรกที่ไม่ก่อนวันนั้น
  function cutOf(iso) {
    var cd = Number(P.data.settings.cutDay) || 19, p = String(iso || P.data.today).split('-'), y = +p[0], m = +p[1];
    if (+p[2] > cd) { m++; if (m > 12) { m = 1; y++; } }
    return y + '-' + pad(m) + '-' + pad(cd);
  }
  function roundInfo(iso, credit) { var cut = cutOf(iso), due = addDays(cut, Number(credit) || 0); return { cut: cut, due: due, round: defaultRound(due) }; }
  function roundFor(iso, credit) { return roundInfo(iso, credit).round; }
  function calc(l, mode, pct) {
    var amount = mode === 'inc' ? l.qty * l.price * 100 / 107 : l.qty * l.price;
    var vat = mode === 'none' ? 0 : r2(amount * 0.07);
    return { amount: r2(amount), vat: vat, total: r2(r2(amount) + vat), wht: r2(amount * pct / 100) };
  }
  P.reset = function () { P.data = null; P.cur = null; P.round = ''; P.inc = {}; };
  function ensure(title, fn) {
    if (P.data) return fn();
    loading(title);
    load().then(fn).catch(onServerError);
  }

  // ==================== อ่านบิล (OCR / PDF) ====================
  var TH_MONTHS = [['มกราคม', 'ม.ค'], ['กุมภาพันธ์', 'ก.พ'], ['มีนาคม', 'มี.ค'], ['เมษายน', 'เม.ย'], ['พฤษภาคม', 'พ.ค'], ['มิถุนายน', 'มิ.ย'], ['กรกฎาคม', 'ก.ค'], ['สิงหาคม', 'ส.ค'], ['กันยายน', 'ก.ย'], ['ตุลาคม', 'ต.ค'], ['พฤศจิกายน', 'พ.ย'], ['ธันวาคม', 'ธ.ค']];
  function fixYear(y) { y = +y; if (y < 100) y += y >= 60 ? 2500 : 2000; if (y > 2400) y -= 543; return y; }
  function mkIso(y, m, d) { y = fixYear(y); m = +m; d = +d; return m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000 && y < 2100 ? y + '-' + pad(m) + '-' + pad(d) : ''; }
  function findDate(s) {
    var m = s.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})(?!\d)/);
    if (m) { var a = mkIso(m[3], m[2], m[1]); if (a) return a; }
    for (var i = 0; i < 12; i++) {
      var rx = new RegExp('(\\d{1,2})\\s*(?:' + TH_MONTHS[i][0] + '|' + TH_MONTHS[i][1].replace('.', '\\.') + '\\.?)\\s*(\\d{4}|\\d{2})(?!\\d)');
      var t = s.match(rx); if (t) { var b = mkIso(t[2], i + 1, t[1]); if (b) return b; }
    }
    return '';
  }
  var MONEY_RX = /-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+\.\d{2}/g;
  // คำนำหน้าเลขที่ใบกำกับ (ยอมให้ OCR เว้นวรรค / ไม่มีไม้เอก) เรียงจากชัดที่สุด · "เลขที่" เฉย ๆ ข้ามถ้าเป็นที่อยู่ (หมู่ ถนน ซอย …)
  var INV_KEYS = [
    /เลข\s*ที่?\s*ใบ\s*กำ\s*กับ(?:\s*ภาษี)?(?:\s*\/\s*ใบ\s*\S+)?/,
    /เลข\s*ที่?\s*(?:บิล|เอกสาร)/,
    /(?:Tax\s*)?Invoice\s*No\.?|Bill\s*No\.?|Doc(?:ument)?\.?\s*No\.?/i,
    /(?:^|[^A-Za-z])No\s*[.:]/i,
    /เลข\s*ที่?(?!\s*(?:ประจำ|ผู้เสีย|บัญชี|ภาษี))/
  ];
  var ADDR_RX = /หมู่|ม\.\s*\d|ถนน|ถ\.|ซอย|ซ\.|ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.|กรุงเทพ|Moo|Road|Soi/i;
  function invToken(s) {
    s = String(s || '').replace(/^[\s:：.#\-]+/, '').replace(/^[1l|!]\s?V(?=\s?\d)/, 'IV');
    var m = s.match(/^([A-Za-z]{1,5})\s+(\d[\dA-Za-z\-\/]{2,})/) || s.match(/^([A-Za-z0-9][A-Za-z0-9\-\/.]{2,})/);
    if (!m) return '';
    var v = (m[2] ? m[1] + m[2] : m[1]).replace(/[.\-\/]+$/, '');
    if (!/\d/.test(v) || /^\d{13}$/.test(v) || /^0\d{8,9}$/.test(v)) return '';   // ต้องมีตัวเลข · ไม่ใช่เลขผู้เสียภาษี / เบอร์โทร
    var i = v.search(/\d/);   // หลังตัวเลขตัวแรก OCR มักอ่าน O→0, I/l→1
    return (v.slice(0, i) + v.slice(i).replace(/[Oo]/g, '0').replace(/[Il]/g, '1')).toUpperCase();
  }
  // OCR อ่านตัวพิมพ์ดอทเมทริกซ์ผิดบ่อย เช่น IV → 1V / |V / lV หรือมีขยะนำหน้า → หาเลขที่มีตัวเลข 5 หลักขึ้นไปในช่วงต้นข้อความแทน
  function invLoose(s) {
    s = String(s || '').slice(0, 40).replace(/(^|[^A-Za-z])[1l|!]\s?V(?=\s?\d)/g, '$1IV');
    var m = s.match(/([A-Za-z]{0,4})\s?[-\/]?\s?(\d[\d\-\/]{4,}[A-Za-z0-9]*)/);
    if (!m) return '';
    var v = (m[1] + m[2]).replace(/[.\-\/]+$/, '').toUpperCase();
    return /^\d{13}$/.test(v) || /^0\d{8,9}$/.test(v) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v) ? '' : v;   // ไม่ใช่เลขภาษี / เบอร์โทร / วันที่
  }
  // เรียนรู้รูปแบบเลขที่จากบิลเดิมของผู้ขายรายนั้น (บิลว่องไท 20/11/69: OCR อ่าน IV6901853 เป็น 156901853 และอ่านคำว่า "เลขที่" ไม่ออก)
  // เช่นเคยบันทึก IV6901783 → รูปแบบ = ตัวอักษร 2 ตัว + เลข 7 หลัก ขึ้นต้น 69 → หาคำในภาพที่ยาวเท่ากันแล้วใส่ตัวอักษรนำหน้าเดิม
  function invPatterns(vendor) {
    var key = loose(vendor), seen = {}, out = [];
    if (!key || !P.data) return out;
    P.data.lines.forEach(function (l) {
      var m = String(l.invNo || '').toUpperCase().match(/^([A-Z]{1,5})([-\/]?)(\d{4,})$/);
      if (!m || loose(l.vendor) !== key) return;
      var k = m[1] + m[2] + m[3].length + m[3].slice(0, 2);
      if (!seen[k]) { seen[k] = 1; out.push({ pre: m[1], sep: m[2], n: m[3].length, head: m[3].slice(0, 2) }); }
    });
    return out;
  }
  function fitsPattern(v, pats) { return pats.some(function (p) { return new RegExp('^' + p.pre + '\\' + (p.sep || '') + '?\\d{' + p.n + '}$').test(String(v || '').toUpperCase().replace('\\' + p.sep, p.sep)); }); }
  P.invByPattern = function (T, vendor) {
    var pats = invPatterns(vendor), text = T.join('  '), best = null;
    pats.forEach(function (p) {
      var rx = new RegExp('(?:^|[^A-Za-z0-9])([A-Za-z0-9|!]{' + p.pre.length + '})\\s?[-\\/]?\\s?(\\d{' + p.n + '})(?!\\d)', 'g'), m;
      while ((m = rx.exec(text))) {
        var pre = m[1].toUpperCase(), dg = m[2];
        if (/^0\d{8,9}$/.test(pre + dg) || /^\d{13}$/.test(pre + dg)) continue;
        var sc = (pre === p.pre ? 3 : /\d/.test(pre) || /[|!]/.test(pre) ? 1 : 0) + (dg.slice(0, 2) === p.head ? 2 : 0);
        if (sc >= 2 && (!best || sc > best.sc)) best = { sc: sc, v: p.pre + p.sep + dg };
      }
    });
    return best ? best.v : '';
  };
  P.findInvNo = function (T) {
    for (var k = 0; k < INV_KEYS.length; k++) {
      for (var i = 0; i < T.length; i++) {
        var m = T[i].match(INV_KEYS[k]); if (!m) continue;
        var rest = T[i].slice(m.index + m[0].length);
        if (k === INV_KEYS.length - 1 && ADDR_RX.test(rest.slice(0, 40))) continue;   // "เลขที่ 99/9 ถนน…" = ที่อยู่
        var seg = rest.split(/\s{2,}/)[0] || rest, v = invToken(seg) || (!rest.trim() && T[i + 1] ? invToken(T[i + 1].split(/\s{2,}/)[0]) : '');
        if (!v && k < INV_KEYS.length - 1) v = invLoose(rest) || (T[i + 1] ? invLoose(T[i + 1]) : '');   // คำนำหน้าชัด แต่ค่าอ่านเพี้ยน
        if (!v && k === INV_KEYS.length - 1) { var lv = invLoose(rest); if (/^[A-Z]{1,4}[-\/]?\d{5,}/.test(lv)) v = lv; }   // "เลขที่" + ขยะ + IV…
        if (k === INV_KEYS.length - 1 && /^\d{1,4}(\/\d{1,4})?$/.test(v)) continue;   // เลขสั้น ๆ แบบบ้านเลขที่
        if (v) return v;
      }
    }
    var x = T.join('\n').replace(/(^|[^A-Za-z])[1l|!]V(?=\d)/g, '$1IV').match(/\b((?:IV|INV|IN|TI|TX|BL|SI|RE|RV|DO)[-\/]?\d[\dA-Z\-\/]{3,})\b/i);
    return x ? x[1].toUpperCase() : '';
  };
  P.parseBill = function (lines) {
    // ตัวเลขไทย → อารบิก · "ํา" (OCR แยกสระอำ) → "ำ" · เว้นวรรคหลายช่อง = คนละคอลัมน์ (เก็บไว้ 2 ช่อง)
    var T = lines.map(function (l) { return String(l).replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); }).replace(/\u0E4D\u0E32/g, '\u0E33').replace(/\t/g, '  ').replace(/[ \u00a0]{3,}/g, '  ').trim(); }).filter(Boolean);
    var all = T.join('\n'), out = { vendor: '', taxId: '', invNo: '', issueDate: '', creditDays: '', lines: [], sub: null, vat: null, grand: null, vatMode: '' };
    var our = String(P.data && P.data.settings.ourTaxId || '');
    // เลขผู้เสียภาษี 13 หลัก (ตัดของบริษัทเราออก)
    var taxes = [];
    (all.match(/\d[\d \-]{11,20}\d/g) || []).forEach(function (t) { var d = t.replace(/\D/g, ''); if (d.length === 13 && d !== our && taxes.indexOf(d) < 0) taxes.push(d); });
    // ผู้ขาย: เลขผู้เสียภาษีตรงกับในระบบ → ชื่อตรงกับในระบบ / คำที่ตั้งไว้ → บรรทัดแรกที่มี บริษัท / หจก. / ร้าน
    var vs = (P.data && P.data.vendors) || [], nAll = loose(all), hit = null;
    (all.match(/\d{13}/g) || []).forEach(function (d) { if (d !== our && taxes.indexOf(d) < 0) taxes.push(d); });
    vs.forEach(function (v) { if (!hit && v.taxId && taxes.indexOf(String(v.taxId)) >= 0) hit = v; });
    // OCR อ่านเลขผู้เสียภาษีผิด 1 หลัก (เช่น 0745… เป็น 0765…) ยังจับผู้ขายได้
    if (!hit) vs.forEach(function (v) { var t = String(v.taxId || ''); if (hit || t.length !== 13) return; if (taxes.some(function (d) { var n = 0; for (var i = 0; i < 13; i++) if (d[i] !== t[i]) n++; return n <= 1; })) hit = v; });
    if (!hit) vs.forEach(function (v) {
      var keys = [loose(v.name)].concat(String(v.keywords || '').split(/[,\n]/).map(loose)).filter(function (k) { return k.length >= 4; });
      if (keys.some(function (k) { return nAll.indexOf(k) >= 0; }) && (!hit || norm(v.name).length > norm(hit.name).length)) hit = v;
    });
    if (hit) { out.vendor = hit.name; out.vendorId = hit.id; out.taxId = hit.taxId || taxes[0] || ''; }
    else {
      var vl = T.filter(function (l) { return /(บริษัท|บจก|ห้างหุ้นส่วน|หจก|ร้าน|Co\.,?\s*Ltd|Company)/i.test(l) && !/ลูกค้า|ผู้ซื้อ|Customer|Sold\s*to|Bill\s*to/i.test(l); })[0];
      if (vl) out.vendor = vl.replace(/^.*?(บริษัท|บจก\.?|ห้างหุ้นส่วน|หจก\.?|ร้าน)/, '$1').replace(/\s{2,}.*$/, '').replace(/(สำนักงานใหญ่|สาขา).*$/, '').trim().slice(0, 100);
      out.taxId = taxes[0] || '';
    }
    // เลขที่ใบกำกับภาษี — จับจากคำนำหน้า (ผู้ใช้กำหนด 20/11/69): เลขที่ใบกำกับภาษี / เลขที่ใบกำกับ / เลขที่บิล / เลขที่เอกสาร / No. / เลขที่ (เรียงจากชัดที่สุด)
    out.invNo = P.findInvNo(T);
    if (out.vendor) { var pv = P.invByPattern(T, out.vendor), ps = invPatterns(out.vendor); if (pv && (!out.invNo || (ps.length && !fitsPattern(out.invNo, ps)))) out.invNo = pv; }
    var m;
    // วันที่: หลังคำว่า วันที่ / Date ก่อน ไม่มีค่อยเอาวันแรกที่พบ
    T.some(function (l) { if (/วันที่|Date/i.test(l) && !/ครบกำหนด|Due/i.test(l)) { var d = findDate(l.replace(/^.*?(วันที่|Date)/i, '')); if (d) { out.issueDate = d; return true; } } return false; });
    if (!out.issueDate) T.some(function (l) { var d = findDate(l); if (d) out.issueDate = d; return !!d; });
    if ((m = all.match(/(?:เครดิต|Credit|เงื่อนไขการชำระ(?:เงิน)?|Term)[^\d\n]{0,20}(\d{1,3})\s*(?:วัน|days?)/i))) out.creditDays = +m[1];
    // ยอดท้ายบิล
    var last = function (rx, not) { var r = null; T.forEach(function (l) { if (rx.test(l) && !(not && not.test(l))) { var v = l.match(MONEY_RX); if (v) r = num(v[v.length - 1]); } }); return r; };
    out.grand = last(/รวมทั้งสิ้น|รวมเงินทั้งสิ้น|ยอดสุทธิ|รวมสุทธิ|จำนวนเงินรวม|Grand\s*Total|Net\s*Total|Total\s*Amount/i);
    out.vat = last(/ภาษีมูลค่าเพิ่ม|VAT/i, /ไม่รวม|ก่อน|รวมภาษี|exclud|includ/i);
    out.sub = last(/รวมเงิน|รวมเป็นเงิน|ยอดรวม|มูลค่าสินค้า|Sub\s*-?\s*Total|Total\b/i, /ทั้งสิ้น|สุทธิ|ภาษี|VAT|Grand|Net/i);
    // รายการ: บรรทัดที่ลงท้ายด้วย จำนวน … ราคา … จำนวนเงิน (จำนวน × ราคา ≈ จำนวนเงิน)
    var stop = /รวม|ภาษี|VAT|Total|ส่วนลด|Discount|ชำระ|หัก ณ/i;
    T.forEach(function (l) {
      if (stop.test(l)) return;
      var nums = l.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g);
      if (!nums || nums.length < 3) return;
      var a = num(nums[nums.length - 1]), cands = nums.slice(0, -1).map(num), found = null;
      for (var i = cands.length - 1; i > 0 && !found; i--) for (var j = i - 1; j >= 0 && !found; j--) {
        var q = cands[j], p = cands[i];
        if (q > 0 && p !== 0 && Math.abs(q * p - a) <= Math.max(0.05, Math.abs(a) * 0.002)) found = { qty: q, price: p, j: j };
      }
      if (!found || !a) return;
      var firstNum = l.indexOf(nums[found.j]), desc = l.slice(0, firstNum).replace(/^\s*\d{1,3}\s*[.)]?\s+/, '').replace(/\s+[ก-๙A-Za-z.]{1,8}\s*$/, '').trim();
      if (!desc) return;
      out.lines.push({ desc: desc.slice(0, 200), qty: found.qty, price: found.price, amt: a });
    });
    var S = out.lines.reduce(function (s, x) { return s + x.amt; }, 0);
    if (out.lines.length) {
      if (out.vat === 0 || (out.vat == null && out.grand != null && Math.abs(S - out.grand) < 1)) out.vatMode = 'none';
      else if (out.sub != null && Math.abs(S - out.sub) < 1) out.vatMode = 'exc';
      else if (out.grand != null && Math.abs(S - out.grand) < 1 && out.vat) out.vatMode = 'inc';
      else if (out.vat) out.vatMode = 'exc';
    }
    return out;
  };
  function pdfLines(tc) {
    var items = tc.items.filter(function (t) { return t.str && t.str.trim(); }).map(function (t) { return { x: t.transform[4], y: t.transform[5], s: t.str, w: t.width || 0 }; });
    items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var rows = [];
    items.forEach(function (t) { var r = rows.filter(function (x) { return Math.abs(x.y - t.y) <= 3; })[0]; if (!r) rows.push(r = { y: t.y, it: [] }); r.it.push(t); });
    return rows.map(function (r) {
      r.it.sort(function (a, b) { return a.x - b.x; });
      var out = '', end = null;
      r.it.forEach(function (t) { out += (end == null ? '' : t.x - end > 12 ? '  ' : ' ') + t.s; end = t.x + t.w; });
      return out;
    });
  }
  function canvasOfImage(file, rot) {
    return new Promise(function (ok, fail) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var mx = Math.max(img.width, img.height), s = mx < 1600 ? 1800 / mx : Math.min(1, 2200 / mx), /* ภาพเล็ก (สแกนความละเอียดต่ำ) ขยายก่อนอ่าน */ w = Math.round(img.width * s), h = Math.round(img.height * s);
        var cv = document.createElement('canvas'), turn = (rot || 0) % 180 !== 0;
        cv.width = turn ? h : w; cv.height = turn ? w : h;
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate((rot || 0) * Math.PI / 180); ctx.drawImage(img, -w / 2, -h / 2, w, h);
        URL.revokeObjectURL(url); ok(cv);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('เปิดภาพไม่ได้ — ใช้ไฟล์ JPG / PNG / PDF')); };
      img.src = url;
    });
  }
  function gray(cv) {
    var ctx = cv.getContext('2d'), img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) { var v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  function jpeg(cv, max) {
    var s = Math.min(1, max / Math.max(cv.width, cv.height)), c = document.createElement('canvas');
    c.width = Math.round(cv.width * s); c.height = Math.round(cv.height * s);
    c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }
  var worker = null;
  function ocr(cv, label) {
    msg('<span class="spinner dark"></span> กำลังอ่านตัวหนังสือจากภาพ ' + label + '… <small>(ครั้งแรกต้องโหลดตัวอ่านภาษาไทย อาจใช้เวลา 20–60 วินาที)</small>');
    return script(OCR_URL, function () { return !!window.Tesseract; }).then(function () {
      return worker || window.Tesseract.createWorker(['tha', 'eng'], 1).then(function (w) { worker = w; return w.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '4' }).then(function () { return w; }); });
    }).then(function (w) { return w.recognize(gray(cv)); }).then(function (r) { return String(r.data.text || '').split('\n'); });
  }
  function b64of(file) { return file.arrayBuffer().then(function (buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }); }
  // อ่านทุกไฟล์ที่เลือก (หลายภาพ = หลายหน้าของบิลเดียวกัน) → { pages:[{src}], uploads:[{mime,b64,name}], text:[] }
  function readFiles(files, rot) {
    var res = { pages: [], uploads: [], text: [], names: [] }, chain = Promise.resolve();
    Array.prototype.slice.call(files, 0, 6).forEach(function (f, fi) {
      res.names.push(f.name);
      chain = chain.then(function () {
        if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
          return script(PDF_URL, function () { return !!window.pdfjsLib; }).then(function () {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
            return f.arrayBuffer();
          }).then(function (buf) {
            if (buf.byteLength < 9 * 1024 * 1024) res.uploads.push({ mime: 'application/pdf', name: f.name, b64: '' , buf: buf });
            return window.pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
          }).then(function (doc) {
            var c2 = Promise.resolve(), n = Math.min(doc.numPages, 20);   /* PDF หลายใบเสร็จ (ผู้ใช้ขอ 20/11/69) → อ่านได้ถึง 20 หน้า */
            for (var k = 1; k <= n; k++) (function (k) {
              c2 = c2.then(function () { return doc.getPage(k); }).then(function (pg) {
                return pg.getTextContent().then(function (tc) {
                  var lines = pdfLines(tc), vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 2000 / vp1.width });
                  var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
                  var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
                  return pg.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
                    var pgx = { src: jpeg(cv, 1400), pdf: f.name || 'PDF', pageNo: k, pageCount: doc.numPages, text: [] }; res.pages.push(pgx);
                    var thai = (lines.join('').match(/[ก-๙]/g) || []).length;
                    if (lines.join('').replace(/\s/g, '').length > 60 && (thai > 20 || !/[^\x00-\x7F]/.test(lines.join('')))) { pgx.text = lines; res.text = res.text.concat(lines); return; }
                    return ocr(cv, (f.name || 'PDF') + ' หน้า ' + k + '/' + n).then(function (t) { pgx.text = t; res.text = res.text.concat(t); });
                  });
                });
              });
            })(k);
            return c2;
          });
        }
        return canvasOfImage(f, rot && rot[fi]).then(function (cv) {
          var src = jpeg(cv, 1600);
          var pgi = { src: src, file: f, fi: fi, text: [] }; res.pages.push(pgi);
          res.uploads.push({ mime: 'image/jpeg', name: f.name, b64: src.split(',')[1] });
          return ocr(cv, (files.length > 1 ? (fi + 1) + '/' + files.length : '')).then(function (t) { pgi.text = t; res.text = res.text.concat(t); });
        });
      });
    });
    return chain.then(function () {
      return Promise.all(res.uploads.map(function (u) { return u.buf ? b64of({ arrayBuffer: function () { return Promise.resolve(u.buf); } }).then(function (b) { u.b64 = b; delete u.buf; }) : null; })).then(function () { return res; });
    });
  }

  // ==================== หน้า: นำเข้าบิล ====================
  P.importPage = function () {
    ensure('นำเข้าบิลค่าใช้จ่าย', function () {
      var d = P.data;
      if (P.cur) return form();
      $('main').innerHTML = '<h3>นำเข้าบิลค่าใช้จ่าย (จ่าย)</h3><p class="lead">ถ่ายรูปบิล / ใบกำกับภาษี หรือเลือกไฟล์สแกน / PDF — ระบบอ่านข้อมูลให้ แล้วตรวจกับภาพ เลือกหมวดและ % หัก ณ ที่จ่าย ก่อนบันทึก</p>'
        + linkPanel()
        + '<div class="panel appick">'
        + '<label class="btn btn-primary apbig">' + icon('upload', 20) + ' ถ่ายรูปบิล<input type="file" id="apCam" accept="image/*" capture="environment" hidden></label>'
        + '<label class="btn apbig">' + icon('pdf', 20) + ' เลือกไฟล์ (รูป / สแกน / PDF)<input type="file" id="apFile" accept="image/*,application/pdf" multiple hidden></label>'
        + '<button class="btn apbig" id="apManual">' + icon('form', 20) + ' กรอกเองโดยไม่มีไฟล์</button>'
        + '<label class="btn apbig">' + icon('table', 20) + ' นำเข้าจาก Excel ค่าใช้จ่ายเดิม<input type="file" id="apXlsIn" accept=".xlsx" hidden></label>'
        + '<button class="btn apbig appob" id="apPoNew">' + icon('clock', 20) + ' PO ล่วงหน้า (ยังไม่ได้รับบิล)</button>'
        + '<small>เลือกได้หลายภาพพร้อมกัน (หลายหน้าของบิลเดียวกัน) · ภาพชัด ตรง ไม่เอียง จะอ่านได้แม่นขึ้น</small></div>'
        + '<div id="apMsg"></div>' + recentHtml();
      ['apCam', 'apFile'].forEach(function (id) {
        $(id).addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files); this.value = ''; if (fs.length) start(fs); });
      });
      $('apManual').addEventListener('click', function () { P.cur = newBill(); form(); });
      $('apXlsIn').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) importBook(f); });
      $('apPoNew').addEventListener('click', function () { P.cur = newBill('po'); go('a_appo'); });
      bindLink();
      on('[data-bill]', 'click', function (el) { editBill(el.getAttribute('data-bill')); });
    });
  };
  function recentHtml() {
    var bills = billsOf(P.data.lines).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 8);
    if (!bills.length) return '';
    return '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('clock', 18) + ' บันทึกล่าสุด</h4>' + bills.map(function (b) {
      return '<div class="cprow apr" data-bill="' + esc(b.billId) + '" tabindex="0"><b>' + esc(b.vendor) + '</b>' + (b.kind === 'po' ? '<span class="aptag">PO ล่วงหน้า</span>' : '<span>' + esc(b.invNo || '-') + ' · ' + slash(b.issueDate) + '</span>') + '<small>' + esc(cat(b.category).name) + ' · รอบจ่าย ' + dotAD(roundOf(b.payRound).actual) + ' · ชำระ ' + m2(b.pay) + '</small></div>';
    }).join('') + '</div>';
  }
  function linkPanel() {
    var d = P.data;
    if (d.linked) return '<div class="panel status on cpst"><div class="dot">' + icon('check', 20) + '</div><div><b>บันทึกลง: ' + esc(d.sheetName) + '</b><span><a href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a> · <a href="#" id="apRelink">เปลี่ยนไฟล์</a></span></div></div>';
    return '<div class="panel status off cpst"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + (d.error ? esc(d.error) : 'ยังไม่ได้เชื่อม Google Sheet "ค่าใช้จ่าย (จ่าย) ฝ่ายบัญชี"') + '</b>'
      + '<span>สร้าง Google Sheet ชื่อ "ค่าใช้จ่าย (จ่าย) ฝ่ายบัญชี" ในโฟลเดอร์ฝ่ายบัญชี แชร์ให้บัญชีระบบเป็นผู้แก้ไข แล้ววางลิงก์ที่นี่ (อ่านบิลได้ก่อน แต่บันทึกได้เมื่อเชื่อมแล้ว)</span>'
      + '<div class="cplink"><input id="apUrl" placeholder="https://docs.google.com/spreadsheets/d/…"><button class="btn btn-primary" id="apLinkBtn">เชื่อมไฟล์</button></div></div></div>';
  }
  function bindLink() {
    var rl = $('apRelink');
    if (rl) rl.addEventListener('click', function (e) { e.preventDefault(); P.data.linked = false; P.data.error = ''; P.render(); });
    var b = $('apLinkBtn');
    if (b) b.addEventListener('click', function () {
      var u = $('apUrl').value.trim(); if (!u) { $('apUrl').focus(); return; }
      b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      call('apSetSheet', state.token, u).then(function (r) {
        if (!r.ok) { b.disabled = false; b.textContent = 'เชื่อมไฟล์'; toast(r.error); return; }
        toast('เชื่อม "' + r.sheetName + '" แล้ว'); return load().then(function () { P.render(); });
      }).catch(onServerError);
    });
  }
  P.render = function () { ({ a_apin: P.importPage, a_ap: P.roundPage, a_apv: P.vendorPage, a_appo: P.poPage }[state.page] || P.importPage)(); };
  function newBill(kind) {
    return { kind: kind === 'po' ? 'po' : '', billId: '', category: '', vendor: '', taxId: '', invNo: '', issueDate: kind === 'po' ? '' : P.data.today, creditDays: '', payRound: '', vatMode: 'exc', pct: 0, note: '', bank: '',
      lines: [{ desc: '', qty: 1, price: 0 }], pages: [], uploads: [], keepFiles: [], read: null, autoRound: true };
  }
  // สร้างบิลจากผลการอ่าน · เครดิต: ใช้ของผู้ขายที่เก็บไว้ก่อน (ผู้ใช้ขอ 20/11/69) ไม่มีค่อยใช้ที่อ่านได้จากบิล
  function billFrom(text, pages, uploads, files) {
    var r = P.parseBill(text), b = newBill(), v = r.vendorId ? (P.data.vendors || []).filter(function (x) { return x.id === r.vendorId; })[0] : vendorOf(r.vendor);
    b.files = files; b.pages = pages; b.uploads = uploads; b.read = r; b.text = text;
    b.vendor = v ? v.name : r.vendor; b.taxId = r.taxId || (v && v.taxId) || ''; b.invNo = r.invNo; b.issueDate = r.issueDate || P.data.today;
    if (v) { b.category = v.category || ''; b.vatMode = v.vatMode || 'exc'; b.pct = Number(v.pct) || 0; b.bank = v.bank || ''; }
    b.creditDays = v && v.creditDays !== '' && v.creditDays != null ? v.creditDays : r.creditDays !== '' ? r.creditDays : '';
    if (r.vatMode) b.vatMode = r.vatMode;
    if (r.lines.length) b.lines = r.lines.map(function (x) { return { desc: x.desc, qty: x.qty, price: x.price }; });
    return b;
  }
  function start(files) {
    msg('<span class="spinner dark"></span> กำลังเปิดไฟล์…');
    P.queue = null;
    readFiles(files).then(function (res) {
      var multi = res.pages.filter(function (p) { return p.pdf; }).length > 1;
      if (!multi) { P.cur = billFrom(res.text, res.pages, res.uploads, files); return form(); }
      // PDF หลายหน้า: หลายใบเสร็จ → แยกกรอกทีละใบ (ผู้ใช้ขอ 20/11/69) · ระบบเดาจากเลขที่ใบกำกับที่ต่างกันในแต่ละหน้า
      var invs = {}; res.pages.forEach(function (p) { var v = P.findInvNo(p.text || []); if (v) invs[v] = 1; });
      var guess = Object.keys(invs).length > 1 || !Object.keys(invs).length;
      $('apMsg').innerHTML = '<div class="panel apsplit"><b>ไฟล์นี้มี ' + res.pages.length + ' หน้า</b><span>' + (Object.keys(invs).length > 1 ? 'พบเลขที่ใบกำกับ ' + Object.keys(invs).length + ' เลข (' + esc(Object.keys(invs).slice(0, 4).join(', ')) + ') — น่าจะเป็นหลายใบเสร็จ' : 'ถ้า 1 หน้า = 1 ใบเสร็จ ให้แยกกรอกทีละใบ') + '</span>'
        + '<div class="apbtns"><button class="btn' + (guess ? ' btn-primary' : '') + '" id="apSplitY">แยกเป็นบิลละหน้า (' + res.pages.length + ' ใบ)</button><button class="btn' + (guess ? '' : ' btn-primary') + '" id="apSplitN">รวมเป็นบิลเดียว</button></div></div>';
      $('apSplitN').addEventListener('click', function () { P.cur = billFrom(res.text, res.pages, res.uploads, files); form(); });
      $('apSplitY').addEventListener('click', function () {
        P.queue = res.pages.map(function (p) {
          var up = [{ mime: 'image/jpeg', name: (p.pdf || 'บิล').replace(/\.pdf$/i, '') + ' หน้า ' + p.pageNo + '.jpg', b64: p.src.split(',')[1] }];
          return billFrom(p.text || [], [p], up, null);
        });
        P.qi = 0; P.cur = P.queue[0]; form();
      });
    }).catch(function (e) { msg(esc(e.message || e), 'bad'); });
  }
  function queueNext(savedMsg) {
    if (!P.queue || P.qi >= P.queue.length - 1) { P.queue = null; return false; }
    P.qi++; P.cur = P.queue[P.qi]; form(); window.scrollTo(0, 0);
    toast((savedMsg || 'บันทึกแล้ว') + ' · ใบที่ ' + (P.qi + 1) + '/' + P.queue.length);
    return true;
  }
  function billsOf(lines) {
    var by = {}, out = [];
    lines.forEach(function (l) {
      var b = by[l.billId];
      if (!b) { b = by[l.billId] = { kind: l.kind || '', billId: l.billId, payRound: l.payRound, category: l.category, vendor: l.vendor, taxId: l.taxId, issueDate: l.issueDate, creditDays: l.creditDays, dueDate: l.dueDate, invNo: l.invNo, vatMode: l.vatMode, pct: Number(l.pct) || 0, note: '', files: String(l.files || '').split(/\s+/).filter(Boolean), createdAt: l.updatedAt || l.createdAt, lines: [], amount: 0, vat: 0, total: 0, wht: 0 }; out.push(b); }
      if (l.note) b.note = l.note;
      b.lines.push(l); b.amount += Number(l.amount) || 0; b.vat += Number(l.vat) || 0; b.total += Number(l.lineTotal) || 0; b.wht += Number(l.wht) || 0;
    });
    out.forEach(function (b) { b.lines.sort(function (x, y) { return x.lineNo - y.lineNo; }); b.pay = r2(b.total - b.wht); });
    return out;
  }
  function editBill(id) {
    var b = billsOf(P.data.lines.filter(function (l) { return l.billId === id; }))[0];
    if (!b) return toast('ไม่พบบิลนี้');
    var v = vendorOf(b.vendor);
    P.cur = Object.assign(newBill(b.kind), { billId: b.billId, category: b.category, vendor: b.vendor, taxId: b.taxId, invNo: b.invNo, issueDate: b.issueDate, creditDays: b.creditDays, payRound: b.payRound,
      vatMode: b.vatMode || 'exc', pct: b.pct, note: b.note, bank: v ? v.bank || '' : '', keepFiles: b.files, autoRound: false,
      lines: b.lines.map(function (l) { return { desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0 }; }) });
    var pg = b.kind === 'po' ? 'a_appo' : 'a_apin';
    if (state.page !== pg && !(state.page === 'a_appo' && pg === 'a_apin')) go(pg); else form();
  }
  P.editBill = editBill;
  // PO ล่วงหน้า → ได้รับบิลแล้ว: เปิดฟอร์มบิลจริงจากรายการ PO (billId เดิม → บันทึกแล้วแทนที่ PO) · แนบภาพ / สแกนบิลในฟอร์มได้
  function receivePo(id) {
    var b = billsOf(P.data.lines.filter(function (l) { return l.billId === id; }))[0];
    if (!b) return toast('ไม่พบ PO นี้');
    var v = vendorOf(b.vendor);
    P.cur = Object.assign(newBill(), { billId: b.billId, fromPo: true, category: b.category, vendor: b.vendor, taxId: (v && v.taxId) || '', issueDate: P.data.today, creditDays: v && v.creditDays !== '' && v.creditDays != null ? v.creditDays : '',
      payRound: b.payRound, vatMode: b.vatMode || 'exc', pct: b.pct, note: b.note, bank: v ? v.bank || '' : '', autoRound: false,
      lines: b.lines.map(function (l) { return { desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0 }; }) });
    if (state.page !== 'a_appo') go('a_appo'); else form();
  }
  // แนบภาพ / สแกนบิลในฟอร์ม (กรอกเอง หรือรับบิลจาก PO): อ่านแล้วเติมช่องที่ยังว่าง · ถ้าอ่านรายการได้ ใช้รายการจากบิลจริงแทน
  function attach(files) {
    var b = P.cur;
    msg('<span class="spinner dark"></span> กำลังเปิดไฟล์…');
    readFiles(files).then(function (res) {
      var r = P.parseBill(res.text);
      b.files = files; b.pages = res.pages; b.uploads = res.uploads; b.read = r; b.text = res.text;
      if (r.invNo) b.invNo = r.invNo;
      if (r.taxId && !b.taxId) b.taxId = r.taxId;
      if (r.issueDate) b.issueDate = r.issueDate;
      if (r.creditDays !== '') b.creditDays = r.creditDays;
      if (r.vatMode) b.vatMode = r.vatMode;
      if (!b.vendor && r.vendor) b.vendor = r.vendor;
      if (r.lines.length) b.lines = r.lines.map(function (x) { return { desc: x.desc, qty: x.qty, price: x.price }; });
      form();
      if (r.lines.length && b.fromPo) toast('ใช้รายการจากบิลจริงแทนรายการใน PO แล้ว — ตรวจอีกครั้ง');
    }).catch(function (e) { msg(esc(e.message || e), 'bad'); });
  }

  function form() {
    var b = P.cur, d = P.data, r = b.read;
    if (!b.payRound) b.payRound = roundFor(b.issueDate || P.data.today, b.creditDays);
    var rounds = d.rounds.filter(function (x) { return x.nominal.slice(8) === pad(d.settings.payDay) || x.nominal === b.payRound; });
    var vlist = '<datalist id="apVlist">' + (d.vendors || []).map(function (v) { return '<option value="' + esc(v.name) + '">'; }).join('') + '</datalist>';
    var po = b.kind === 'po';
    $('main').innerHTML = '<h3>' + (po ? (b.billId ? 'แก้ไข PO ล่วงหน้า' : 'เพิ่ม PO ล่วงหน้า') : b.fromPo ? 'ได้รับบิลแล้ว (จาก PO ล่วงหน้า)' : b.billId ? 'แก้ไขบิลค่าใช้จ่าย' : 'ตรวจข้อมูลบิล') + '</h3><p class="lead">'
      + (po ? 'สั่งซื้อแล้วแต่ยังไม่ได้รับบิล — กรอกชื่อสินค้า จำนวน ราคา · ในรายงานรอบจ่ายจะแสดงเป็นตัวแดงจนกว่าจะได้รับบิล'
        : b.fromPo ? 'ใส่เลขที่ใบกำกับ / วันที่ตามบิลจริง (หรือแนบภาพบิลให้ระบบอ่าน) แล้วบันทึก — PO นี้จะกลายเป็นบิลจริง ตัวแดงหายไป'
        : b.pages.length ? 'ตรวจข้อมูลที่ระบบอ่านได้กับภาพบิล แก้ช่องที่ผิด แล้วกดบันทึก' : 'กรอกข้อมูลบิล แล้วกดบันทึก') + '</p>'
      + (d.linked ? '' : linkPanel())
      + (P.queue && P.queue.indexOf(b) >= 0 ? '<div class="apqban">' + icon('pdf', 18) + ' ใบที่ <b>' + (P.qi + 1) + ' / ' + P.queue.length + '</b> จากไฟล์ ' + esc((b.pages[0] && b.pages[0].pdf) || '') + ' · หน้า ' + ((b.pages[0] && b.pages[0].pageNo) || '') + '</div>' : '')
      + (po ? '<div class="appoban">' + icon('clock', 18) + ' PO ล่วงหน้า · แสดงเป็น<b>ตัวแดง</b>ในรายงานรอบจ่าย</div>' : '')
      + '<div class="apform' + (b.pages.length || b.keepFiles.length ? '' : ' nofile') + (po ? ' ispo' : '') + '">'
      + (b.pages.length || b.keepFiles.length ? '<div class="apimgs">' + b.pages.map(function (p, i) { return '<figure><img src="' + p.src + '" alt="ภาพบิล" data-zoom="' + i + '">' + (p.file ? '<button type="button" class="btn apsm" data-rot="' + p.fi + '">↻ หมุนภาพแล้วอ่านใหม่</button>' : '') + '</figure>'; }).join('')
        + b.keepFiles.map(function (u, i) { return '<a class="btn apsm" href="' + esc(u) + '" target="_blank" rel="noopener">' + icon('pdf', 16) + ' ไฟล์บิลที่บันทึกไว้ ' + (b.keepFiles.length > 1 ? i + 1 : '') + '</a>'; }).join('')
        + (b.text && b.text.length ? '<details class="aptext"><summary>ข้อความที่อ่านได้</summary><pre>' + esc(b.text.join('\n')) + '</pre></details>' : '') + '</div>' : '')
      + '<div class="apfields">'
      + (!po && !b.pages.length ? '<div class="apatt"><label class="btn apsm">' + icon('upload', 16) + ' ถ่ายรูป / แนบไฟล์บิล<input type="file" id="apAttach" accept="image/*,application/pdf" multiple hidden></label><small>ระบบอ่านเลขที่ใบกำกับ วันที่ และรายการให้</small></div>' : '')
      + '<div class="aphl"><b>1. หมวดของ' + (po ? ' PO' : 'บิล') + 'นี้ <span class="req">*</span></b><div class="apchips" id="apCats">' + d.cats.map(function (c, i) {
          return '<label><input type="radio" name="apCat" value="' + c.key + '"' + (b.category === c.key ? ' checked' : '') + '><span>' + (i + 1) + '. ' + esc(c.name) + '</span></label>'; }).join('') + '</div></div>'
      + '<div class="aphl"><b>2. % หัก ณ ที่จ่าย</b> <small>ลงคอลัมน์ % · ส่วนลด/มัดจำ/หัก ณ ที่จ่าย = มูลค่ารายการ × %</small><div class="apchips sm" id="apPcts">' + PCTS.map(function (p) {
          return '<label><input type="radio" name="apPct" value="' + p + '"' + (Number(b.pct) === p ? ' checked' : '') + '><span>' + (p ? p + '%' : 'ไม่หัก') + '</span></label>'; }).join('')
        + '<label class="apother">อื่น ๆ <input id="apPctX" inputmode="decimal" value="' + (PCTS.indexOf(Number(b.pct)) < 0 ? esc(b.pct) : '') + '" placeholder="%"></label></div></div>'
      + '<div class="apgrid">'
      + '<label class="apwide">ผู้ขาย / ผู้จ่ายเงิน <span class="req">*</span><input id="apVendor" list="apVlist" value="' + esc(b.vendor) + '" autocomplete="off">' + vlist + '<small id="apVhint"></small></label>'
      + '<div class="apinv' + (po ? ' hidden' : '') + '">'
      + '<label>เลขผู้เสียภาษีผู้ขาย<input id="apTax" inputmode="numeric" value="' + esc(b.taxId) + '"></label>'
      + '<label>เลขที่ใบกำกับภาษี<input id="apInv" value="' + esc(b.invNo) + '"><small id="apDup" class="apwarn"></small></label>'
      + '<label>วันที่ออก<input type="date" id="apDate" value="' + esc(b.issueDate) + '"></label>'
      + '<label>เครดิต (วัน)<input id="apCredit" inputmode="numeric" value="' + esc(b.creditDays) + '" placeholder="เช่น 45"></label>'
      + '<label>วันที่ครบกำหนด<input id="apDue" readonly tabindex="-1"></label></div>'
      + '<label>รอบจ่าย <span class="req">*</span><select id="apRound">' + rounds.map(function (x) { return '<option value="' + x.nominal + '"' + (x.nominal === b.payRound ? ' selected' : '') + '>จ่าย ' + dotAD(x.nominal, true) + (x.actual !== x.nominal ? ' (จ่ายจริง ' + dotAD(x.actual) + ')' : '') + '</option>'; }).join('') + '</select><small id="apRoundHint"></small></label>'
      + '</div>'
      + '<div class="aphl"><b>ราคา' + (po ? 'ที่ตกลง' : 'ในบิล') + '</b><div class="apchips sm" id="apVat">' + Object.keys(VAT_SHORT).map(function (k) {
          return '<label><input type="radio" name="apVat" value="' + k + '"' + (b.vatMode === k ? ' checked' : '') + '><span>' + VAT_SHORT[k] + '</span></label>'; }).join('') + '</div></div>'
      + '<div class="cpwrap"><table class="aptab' + (po ? ' po' : '') + '"><thead><tr><th>' + (po ? 'ชื่อสินค้า' : 'คำอธิบาย') + '</th><th>จำนวน</th><th>ราคา</th><th>มูลค่ารายการ</th><th>VAT</th><th>รวม</th><th class="apred">หัก ณ ที่จ่าย</th><th></th></tr></thead><tbody id="apLines"></tbody></table></div>'
      + '<button type="button" class="btn apsm" id="apAdd">+ เพิ่มรายการ</button>'
      + '<div id="apSum"></div>'
      + '<div class="apgrid"><label class="apwide">บัญชีธนาคารของผู้ขาย (แสดงที่แถวรวมในรายงาน)<input id="apBank" value="' + esc(b.bank) + '" placeholder="เช่น ธ.กสิกรไทย 123-4-56789-0 บริษัท …"></label>'
      + '<label class="apwide">หมายเหตุ<input id="apNote" value="' + esc(b.note) + '"></label></div>'
      + '<div id="apMsg"></div>'
      + '<div class="apbtns"><button class="btn btn-primary" id="apSave">' + icon('check', 18) + (po ? ' บันทึก PO ล่วงหน้า' : ' บันทึกบิล') + '</button>'
      + (po && b.billId ? '<button class="btn" id="apRecv">' + icon('check', 18) + ' ได้รับบิลแล้ว</button>' : '')
      + (b.billId && !b.fromPo ? '<button class="btn apdel" id="apDel">' + icon('trash', 18) + (po ? ' ลบ PO' : ' ลบบิล') + '</button>' : '')
      + (P.queue && P.queue.indexOf(b) >= 0 && P.qi < P.queue.length - 1 ? '<button class="btn" id="apSkip">ข้ามใบนี้ →</button>' : '')
      + '<button class="btn" id="apBack">ยกเลิก</button></div>'
      + '</div></div>';
    bindLink();
    drawLines(); refresh();
    on('input[name=apCat]', 'change', function (el) { b.category = el.value; });
    on('input[name=apPct]', 'change', function (el) { b.pct = num(el.value); $('apPctX').value = ''; drawLines(); refresh(); });
    $('apPctX').addEventListener('input', function () { var v = this.value.trim(); if (v === '') return; b.pct = Math.max(0, Math.min(100, num(v))); Array.prototype.forEach.call(document.querySelectorAll('input[name=apPct]'), function (x) { x.checked = false; }); drawLines(); refresh(); });
    on('input[name=apVat]', 'change', function (el) { b.vatMode = el.value; drawLines(); refresh(); });
    $('apVendor').addEventListener('change', function () {
      b.vendor = this.value.trim(); var v = vendorOf(b.vendor);
      if (b.text && b.text.length && !b.invNo) { var gi = P.invByPattern(b.text, b.vendor); if (gi) { b.invNo = gi; $('apInv').value = gi; dupCheck(); } }   // เลือกผู้ขายเอง → ลองหาเลขที่ตามรูปแบบบิลเดิมของผู้ขายนั้น
      if (v) {
        if (v.category) { b.category = v.category; Array.prototype.forEach.call(document.querySelectorAll('input[name=apCat]'), function (x) { x.checked = x.value === b.category; }); }
        if (v.creditDays !== '' && v.creditDays != null) $('apCredit').value = b.creditDays = v.creditDays;
        if (v.taxId && !$('apTax').value) $('apTax').value = b.taxId = v.taxId;
        if (v.bank) $('apBank').value = b.bank = v.bank;
        b.vatMode = v.vatMode || b.vatMode; b.pct = Number(v.pct) || 0;
        Array.prototype.forEach.call(document.querySelectorAll('input[name=apVat]'), function (x) { x.checked = x.value === b.vatMode; });
        Array.prototype.forEach.call(document.querySelectorAll('input[name=apPct]'), function (x) { x.checked = num(x.value) === b.pct; });
        $('apPctX').value = PCTS.indexOf(b.pct) < 0 ? b.pct : '';
        recalcLines();   // ไม่สร้างช่องใหม่ (ผู้ใช้อาจกำลังแตะช่องรายการอยู่)
      }
      refresh(true);
    });
    $('apVendor').addEventListener('input', function () { b.vendor = this.value; vhint(); dupCheck(); });
    $('apTax').addEventListener('input', function () { b.taxId = this.value.replace(/\D/g, ''); });
    $('apInv').addEventListener('input', function () { b.invNo = this.value.trim(); dupCheck(); });
    $('apDate').addEventListener('change', function () { b.issueDate = this.value; refresh(true); });
    $('apCredit').addEventListener('input', function () { b.creditDays = this.value.replace(/[^\d]/g, ''); refresh(true); });
    $('apRound').addEventListener('change', function () { b.payRound = this.value; b.autoRound = false; });
    $('apBank').addEventListener('input', function () { b.bank = this.value; });
    $('apNote').addEventListener('input', function () { b.note = this.value; });
    $('apAdd').addEventListener('click', function () { b.lines.push({ desc: '', qty: 1, price: 0 }); drawLines(); refresh(); var x = $('apLines').querySelectorAll('input[data-k=desc]'); x[x.length - 1].focus(); });
    $('apBack').addEventListener('click', function () { P.cur = null; P.queue = null; P.render(); });
    if ($('apSkip')) $('apSkip').addEventListener('click', function () { queueNext('ข้ามแล้ว'); });
    $('apSave').addEventListener('click', save);
    if ($('apRecv')) $('apRecv').addEventListener('click', function () { receivePo(b.billId); });
    if ($('apAttach')) $('apAttach').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files); this.value = ''; if (fs.length) attach(fs); });
    if ($('apDel')) $('apDel').addEventListener('click', function () {
      ask({ title: po ? 'ลบ PO ล่วงหน้านี้?' : 'ลบบิลนี้?', text: b.vendor + ' ' + (b.invNo || ''), ok: po ? 'ลบ PO' : 'ลบบิล', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
        if (!yes) return;
        call('apDeleteBill', state.token, b.billId).then(function (r) { if (!r.ok) return toast(r.error); P.cur = null; toast('ลบบิลแล้ว'); load().then(P.render); }).catch(onServerError);
      });
    });
    on('[data-zoom]', 'click', function (el) { openModal({ title: 'ภาพบิล', wide: true, color: state.dept.color, icon: 'pdf', body: '<img src="' + b.pages[+el.getAttribute('data-zoom')].src + '" style="width:100%;border-radius:8px" alt="">', noCancel: true, ok: 'ปิด' }); });
    on('[data-rot]', 'click', function (el) {
      var fi = +el.getAttribute('data-rot'), rot = b.rot = b.rot || {}; rot[fi] = ((rot[fi] || 0) + 90) % 360;
      var keep = { category: b.category, pct: b.pct, payRound: b.payRound, autoRound: b.autoRound };
      $('main').querySelector('.apimgs').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังอ่านใหม่…</div>';
      readFiles(b.files, rot).then(function (res) {
        var r = P.parseBill(res.text);
        b.pages = res.pages; b.uploads = res.uploads; b.read = r; b.text = res.text;
        if (!b.invNo && r.invNo) b.invNo = r.invNo;
        if (r.vendor && !vendorOf(b.vendor)) b.vendor = r.vendor;
        if (r.issueDate) b.issueDate = r.issueDate;
        if (r.lines.length) b.lines = r.lines.map(function (x) { return { desc: x.desc, qty: x.qty, price: x.price }; });
        Object.assign(b, keep); form();
      }).catch(function (e) { toast(e.message || e); form(); });
    });
    vhint(); dupCheck();
  }
  function due() { var b = P.cur; return b.issueDate ? addDays(b.issueDate, Number(b.creditDays) || 0) : ''; }
  function refresh(dates) {
    var b = P.cur;
    $('apDue').value = due() ? slash(due()) : '';
    var ri = roundInfo(b.issueDate || P.data.today, b.creditDays), rh = $('apRoundHint');
    if (rh) rh.textContent = 'ตัดรอบ ' + slash(ri.cut) + ' + เครดิต ' + (Number(b.creditDays) || 0) + ' วัน = ' + slash(ri.due) + ' → จ่าย ' + dotAD(ri.round, true) + (b.payRound && b.payRound !== ri.round ? ' (เลือกรอบอื่นไว้)' : '');
    if (dates && b.autoRound) { b.payRound = ri.round; var s = $('apRound'); if (s && s.querySelector('option[value="' + b.payRound + '"]')) s.value = b.payRound; }
    var t = { amount: 0, vat: 0, total: 0, wht: 0 };
    b.lines.forEach(function (l) { var c = calc(l, b.vatMode, b.pct); t.amount += c.amount; t.vat += c.vat; t.total += c.total; t.wht += c.wht; });
    var pay = r2(t.total - t.wht), r = b.read, checks = '';
    if (r) {
      var bill = r.grand != null ? r.grand : null;
      if (bill != null) checks += chk(Math.abs(bill - t.total) < 0.06 ? true : 'warn', 'ยอดรวมท้ายบิลที่อ่านได้ ' + m2(bill) + (Math.abs(bill - t.total) < 0.06 ? ' ตรงกับรวมในตาราง' : ' — ในตารางรวม ' + m2(t.total) + ' ตรวจรายการ / ราคา / แบบ VAT อีกครั้ง'));
      if (r.vat != null && b.vatMode !== 'none') checks += chk(Math.abs(r.vat - t.vat) < 0.06 ? true : 'warn', 'VAT ท้ายบิล ' + m2(r.vat) + (Math.abs(r.vat - t.vat) < 0.06 ? ' ตรงกัน' : ' — ในตาราง ' + m2(t.vat)));
      if (!r.lines.length) checks += chk('warn', 'อ่านรายการสินค้าจากภาพไม่ได้ — พิมพ์รายการเองตามภาพ');
      if (!b.invNo) checks += chk('warn', 'อ่านเลขที่ใบกำกับจากภาพไม่ได้ — พิมพ์เองตามภาพ (กด "ข้อความที่อ่านได้" ใต้ภาพเพื่อดูว่าระบบอ่านได้อะไร)');
      if (!vendorOf(b.vendor)) checks += chk('warn', 'ผู้ขายใหม่ — ระบบจะจำ หมวด เครดิต แบบ VAT % และบัญชีธนาคารไว้ใช้ครั้งต่อไป');
    }
    $('apSum').innerHTML = '<div class="apsum"><span>มูลค่ารายการ<b>' + m2(t.amount) + '</b></span><span>VAT<b>' + m2(t.vat) + '</b></span><span>รวม<b>' + m2(t.total) + '</b></span><span class="apred">หัก ' + (b.pct || 0) + '%<b>' + m2(t.wht) + '</b></span><span class="appay">ชำระ<b>' + m2(pay) + '</b></span></div>' + (checks ? '<div class="a7checks">' + checks + '</div>' : '');
  }
  function drawLines() {
    var b = P.cur;
    $('apLines').innerHTML = b.lines.map(function (l, i) {
      var c = calc(l, b.vatMode, b.pct);
      return '<tr><td><input data-i="' + i + '" data-k="desc" value="' + esc(l.desc) + '"></td><td><input class="apn" data-i="' + i + '" data-k="qty" inputmode="decimal" value="' + esc(l.qty) + '"></td><td><input class="apn" data-i="' + i + '" data-k="price" inputmode="decimal" value="' + esc(l.price) + '"></td>'
        + '<td class="apv" data-c="amount">' + m2(c.amount) + '</td><td class="apv" data-c="vat">' + m2(c.vat) + '</td><td class="apv" data-c="total">' + m2(c.total) + '</td><td class="apv apred" data-c="wht">' + m2(c.wht) + '</td>'
        + '<td>' + (b.lines.length > 1 ? '<button type="button" class="apx" data-del="' + i + '" aria-label="ลบรายการ">✕</button>' : '') + '</td></tr>';
    }).join('');
    on('#apLines input', 'input', function (el) {
      var i = +el.getAttribute('data-i'), k = el.getAttribute('data-k'), l = b.lines[i];
      l[k] = k === 'desc' ? el.value : num(el.value);
      var c = calc(l, b.vatMode, b.pct), tr = el.closest('tr');
      ['amount', 'vat', 'total', 'wht'].forEach(function (f) { tr.querySelector('[data-c=' + f + ']').textContent = m2(c[f]); });
      refresh();
    });
    on('[data-del]', 'click', function (el) { b.lines.splice(+el.getAttribute('data-del'), 1); drawLines(); refresh(); });
  }
  function recalcLines() {
    var b = P.cur;
    Array.prototype.forEach.call($('apLines').querySelectorAll('tr'), function (tr, i) {
      var l = b.lines[i]; if (!l) return;
      var c = calc(l, b.vatMode, b.pct);
      ['amount', 'vat', 'total', 'wht'].forEach(function (f) { var el = tr.querySelector('[data-c=' + f + ']'); if (el) el.textContent = m2(c[f]); });
    });
  }
  function vhint() { var el = $('apVhint'); if (!el) return; var v = vendorOf(P.cur.vendor); el.innerHTML = v ? '✓ ผู้ขายในระบบ · ' + esc(cat(v.category).name) + (v.creditDays !== '' ? ' · เครดิต ' + v.creditDays + ' วัน' : '') : (P.cur.vendor ? 'ผู้ขายใหม่' : ''); el.className = v ? 'apok' : 'apwarn'; }
  function dupCheck() {
    var b = P.cur, el = $('apDup'); if (!el) return;
    var x = b.invNo && P.data.lines.filter(function (l) { return l.billId !== b.billId && String(l.invNo) === b.invNo && norm(l.vendor) === norm(b.vendor); })[0];
    el.textContent = x ? '⚠ บิลเลขนี้ของผู้ขายนี้บันทึกแล้ว (รอบจ่าย ' + dotAD(x.payRound, true) + ')' : '';
  }
  function save() {
    var b = P.cur, btn = $('apSave');
    if (!b.category) { toast('เลือกหมวดของบิลก่อน'); $('apCats').scrollIntoView({ block: 'center' }); $('apCats').classList.add('apneed'); return; }
    if (!String(b.vendor).trim()) { toast('ใส่ชื่อผู้ขาย'); $('apVendor').focus(); return; }
    if (!P.data.linked) { toast('เชื่อม Google Sheet ก่อนบันทึก'); return; }
    var lines = b.lines.filter(function (l) { return String(l.desc).trim() || l.qty || l.price; });
    if (!lines.length) { toast('ไม่มีรายการในบิล'); return; }
    var po = b.kind === 'po', label = po ? ' บันทึก PO ล่วงหน้า' : ' บันทึกบิล';
    var payload = { kind: b.kind, billId: b.billId, category: b.category, vendor: b.vendor.trim(), taxId: b.taxId, invNo: b.invNo, issueDate: b.issueDate, creditDays: b.creditDays, dueDate: due(), payRound: b.payRound,
      vatMode: b.vatMode, pct: b.pct, note: b.note, bank: b.bank, lines: lines, keepFiles: b.keepFiles };
    var send = function (allowDup) {
      payload.allowDup = !!allowDup;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
      return call('apSaveBill', state.token, payload, b.uploads.map(function (u) { return { mime: u.mime, b64: u.b64, name: u.name }; })).then(function (r) {
        btn.disabled = false; btn.innerHTML = icon('check', 18) + label;
        if (r.dup) return ask({ title: 'บิลซ้ำ', text: r.error + ' — บันทึกซ้ำอีกใบไหม?', ok: 'บันทึกซ้ำ', cancel: 'ไม่บันทึก' }).then(function (yes) { if (yes) return send(true); });
        if (!r.ok) return toast(r.error);
        var round = b.payRound; P.round = round;
        if (P.queue && P.queue.indexOf(b) >= 0 && P.qi < P.queue.length - 1) return load().then(function () { queueNext('บันทึก ' + payload.vendor + ' ' + (payload.invNo || '') + ' แล้ว'); });
        P.cur = null; P.queue = null;
        toast((po ? 'บันทึก PO ล่วงหน้าแล้ว' : b.fromPo ? 'บันทึกบิลแล้ว — PO นี้เป็นบิลจริงแล้ว' : 'บันทึกบิลแล้ว') + (b.uploads.length && !r.uploaded ? ' (เก็บไฟล์บิลไม่ได้ — ตรวจโฟลเดอร์ฝ่าย)' : ''));
        if (po || b.fromPo) return load().then(function () { P.poPage(); });
        return load().then(function () { P.importPage(); msg('✓ บันทึก ' + esc(payload.vendor) + ' ' + esc(payload.invNo || '') + ' ลงรอบจ่าย ' + dotAD(roundOf(round).actual) + ' แล้ว · <a href="#" id="apGoRound">ดูรายงานรอบนี้</a>', 'ok'); var g = $('apGoRound'); if (g) g.addEventListener('click', function (e) { e.preventDefault(); go('a_ap'); }); });
      }).catch(function (e) { btn.disabled = false; btn.innerHTML = icon('check', 18) + label; onServerError(e); });
    };
    send(false);
  }

  // ==================== โครงรายงาน (ใช้ทั้งหน้าเว็บและ Excel) ====================
  // สไตล์ตามไฟล์ต้นแบบ: Angsana New · หัว 18 ตัวหนา · ข้อมูล 18 · เส้นบาง (thin) ซ้าย-ขวา / เส้นจาง (hair) บน-ล่าง · แถวรวมผู้ขายพื้น #FFF2CC ตัวแดง · ช่องชำระรวมพื้นเหลือง
  var RED = 'FF0000', NF_AMT = '#,##0.00_);(#,##0.00)', NF2 = '#,##0.00', NF_ACC = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';
  var WIDTHS = [3.85546875, 8.5703125, 32.42578125, 15.7109375, 16.5703125, 19, 56.85546875, 13.28515625, 15.7109375, 12, 13.28515625, 17.5703125, 17.5703125, 17.5703125, 17.5703125];
  var COLS = 'ABCDEFGHIJKLMNO';
  function S(o) { return o; }
  var ST = {
    t20: S({ sz: 20, b: 1, h: 'center' }), t20r: S({ sz: 20, b: 1, h: 'right' }), title: S({ sz: 20, b: 1, h: 'center', fill: 'D9EAD3' }),
    upd: S({ sz: 20, b: 1, h: 'right', wrap: 1 }), updv: S({ sz: 20, b: 1, h: 'right' }),
    big: S({ sz: 22, b: 1, h: 'center', fill: 'D9EAD3' }), bigTot: S({ sz: 22, b: 1, h: 'center', fill: 'FFFF00', nf: NF2 }),
    title18: S({ sz: 18, b: 1, h: 'center', fill: 'D9EAD3' }), big18: S({ sz: 18, b: 1, h: 'center', fill: 'D9EAD3' }), bigTot18: S({ sz: 18, b: 1, h: 'center', fill: 'FFFF00', nf: NF2 }),   // แผ่นวัตถุดิบในไฟล์ใช้ตัว 18
    hd: S({ sz: 18, b: 1, h: 'center', wrap: 1, fill: 'FFFFFF', bd: 'tttt' }), hdR: S({ sz: 18, b: 1, h: 'center', wrap: 1, fill: 'FFFFFF', bd: 'tttt', c: RED }), hdK: S({ sz: 16, b: 1, h: 'center', wrap: 1, fill: 'FFFFFF', bd: 'tttt', c: RED }),
    no: S({ sz: 18, h: 'center' }), ven: S({ sz: 18, b: 1, bd: 't-hh' }), venC: S({ sz: 18, b: 1, bd: '-thh' }),
    d: S({ sz: 18, h: 'center', bd: 'tthh', nf: 'mm-dd-yy' }), inv: S({ sz: 18, h: 'left', bd: 'tthh' }), desc: S({ sz: 18, h: 'left', bd: 'tthh' }),
    qty: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0' }), qty2: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0.00' }), price: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0.00' }), priceNeg: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0.00', c: RED }),
    descR: S({ sz: 18, h: 'left', bd: 'tthh', c: RED }), qtyR: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0', c: RED }), qty2R: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0.00', c: RED }), priceR: S({ sz: 18, h: 'right', bd: 'tthh', nf: '#,##0.00', c: RED }),   // PO ล่วงหน้า = ตัวแดงเหมือนในไฟล์
    pct: S({ sz: 18, h: 'center', bd: 'tthh', nf: NF2, c: RED }), wht: S({ sz: 18, h: 'right', bd: 'tthh', nf: NF2, c: RED }),
    amt: S({ sz: 18, h: 'right', bd: 'tthh', nf: NF_AMT }), pay: S({ sz: 18, b: 1, h: 'right', bd: 'tthh', nf: NF_AMT }),
    bankB: S({ sz: 18, b: 1, c: RED, fill: 'FFF2CC', bd: 't-tt' }), bank: S({ sz: 18, b: 1, c: RED, fill: 'FFF2CC', h: 'left', bd: '-ttt' }), bankF: S({ sz: 18, b: 1, c: RED, fill: 'FFF2CC', bd: 'tttt' }),
    edge: S({ sz: 10, bd: '--tt' }), edgeR: S({ sz: 10, bd: '-ttt' }),
    sumK: S({ sz: 18, b: 1, c: RED, fill: 'FFF2CC', h: 'right', bd: 'tttt', nf: NF2 }), sumA: S({ sz: 18, b: 1, fill: 'FFF2CC', h: 'right', bd: 'tttt', nf: NF_AMT }), sumO: S({ sz: 18, b: 1, c: RED, fill: 'FFFF00', h: 'right', bd: 'tttt', nf: NF_AMT }),
    sL: S({ sz: 18, h: 'left', nf: '@' }), sD: S({ sz: 18, h: 'center', nf: NF_ACC }), sDt: S({ sz: 18, b: 1, h: 'center', nf: NF_ACC, fill: 'FFFF00' }),
    inHead: S({ sz: 20, b: 1, h: 'center' }), inG: S({ sz: 18, h: 'right' }), inGb: S({ sz: 18, b: 1, h: 'right' }), inI: S({ sz: 18, h: 'right', c: RED, fill: 'FBE5D6', nf: NF2 }), inIb: S({ sz: 18, b: 1, h: 'right', c: RED, fill: 'FBE5D6', nf: NF2 }),
    inJ: S({ sz: 16, h: 'left' }), inK: S({ sz: 18, h: 'left', c: RED })
  };
  // ข้อมูลรอบจ่าย → แผ่นงาน 2 แผ่นเหมือนไฟล์: "วัตถุดิบจ่าย" (หมวด 1) และ "บรรจุภัณฑ์จ่าย" (หมวด 2–6 + สรุป + รายการเงินเข้า)
  function buildModel(nominal, inc) {
    var d = P.data, rd = roundOf(nominal), payTxt = dotAD(rd.actual), upd = dotAD(d.today, true);
    var lines = d.lines.filter(function (l) { return l.payRound === nominal; });
    var vOrder = {}; (d.vendors || []).forEach(function (v, i) { vOrder[norm(v.name)] = Number(v.sort) || i + 1; });
    var sheets = [
      { name: 'วัตถุดิบจ่าย ' + dotAD(nominal, true), scale: 60, rows: [], merges: [], cats: ['raw'] },
      { name: 'บรรจุภัณฑ์จ่าย ' + dotAD(nominal, true), scale: 54, rows: [], merges: [], cats: ['pack', 'misc', 'ship', 'svc', 'fac'] }
    ];
    var catTotals = {};
    sheets.forEach(function (sh, si) {
      var R = function (h) { var r = { h: h || 26.25, c: {} }; sh.rows.push(r); return sh.rows.length; };
      var put = function (r, col, v, st, f) { sh.rows[r - 1].c[col] = { v: v, s: st, f: f }; };
      var merge = function (a, b) { sh.merges.push(a + ':' + b); };
      sh.cats.forEach(function (ck, ci) {
        if (ci) R(28.5);   // เว้นแถวระหว่างหมวด
        var c = cat(ck), r1 = R(28.5);
        'BCDEF'.split('').forEach(function (x) { put(r1, x, '', ST.t20); }); 'HLMNO'.split('').forEach(function (x) { put(r1, x, '', ST.t20r); });
        put(r1, 'G', c.title + ' ' + payTxt, si ? ST.title : ST.title18); put(r1, 'I', 'อัพเดทวันที่', ST.upd); merge('I' + r1, 'J' + r1);
        if (si === 1 && ci) put(r1, 'K', upd, ST.updv, '=K1'); else put(r1, 'K', upd, ST.updv);
        var rB = R(28.5); put(rB, 'B', c.title + ' ' + payTxt, si ? ST.big : ST.big18, '=G' + r1); put(rB, 'C', '', si ? ST.big : ST.big18); merge('B' + rB, 'C' + rB);
        var r3 = R(48.95);
        [['B', 'ผู้ขาย/ผู้จ่ายเงิน', ST.hd], ['C', '', ST.hd], ['D', 'วันที่ออก', ST.hd], ['E', 'วันที่ครบกำหนด', ST.hd], ['F', 'เลขที่ใบกำกับภาษี', ST.hd], ['G', 'คำอธิบาย', ST.hd], ['H', 'จำนวน', ST.hd], ['I', 'ราคา', ST.hd],
          ['J', '%', ST.hdR], ['K', 'ส่วนลด/มัดจำ/หัก ณที่จ่าย', ST.hdK], ['L', 'มูลค่ารายการ', ST.hd], ['M', 'ภาษีมูลค่าเพิ่ม', ST.hd], ['N', 'รวม', ST.hd], ['O', 'ชำระ', ST.hdR]].forEach(function (x) { put(r3, x[0], x[1], x[2]); });
        merge('B' + r3, 'C' + r3);
        var first = r3 + 1, totRows = [], secTotal = 0;
        var bills = billsOf(lines.filter(function (l) { return l.category === ck; }));
        var byV = {}, vs = [];
        bills.forEach(function (b) { var k = norm(b.vendor); if (!byV[k]) { byV[k] = { name: b.vendor, bills: [] }; vs.push(byV[k]); } byV[k].bills.push(b); });
        vs.sort(function (a, b) { return (vOrder[norm(a.name)] || 999) - (vOrder[norm(b.name)] || 999) || a.name.localeCompare(b.name, 'th'); });
        if (!vs.length) vs.push({ name: '', bills: [{ empty: 1, lines: [{}] }] });
        vs.forEach(function (v) {
          var vStart = 0, anyWht = false, sums = { K: 0, L: 0, M: 0, N: 0, O: 0 };
          v.bills.sort(function (a, b) { return String(a.issueDate || '').localeCompare(String(b.issueDate || '')) || String(a.invNo || '').localeCompare(String(b.invNo || '')); });
          v.bills.forEach(function (b) {
            var bStart = 0, nSum = 0, kSum = 0;
            b.lines.forEach(function (l, li) {
              var r = R(26.25), x = r;
              if (!vStart) vStart = r;
              if (!bStart) bStart = r;
              if (!b.empty) sh.rows[r - 1].bill = b.billId;
              put(r, 'A', '', ST.no, '=IF(B' + x + '="","",COUNTA($B$' + first + ':B' + x + '))');
              put(r, 'B', r === vStart ? v.name : '', ST.ven); put(r, 'C', '', ST.venC);
              if (b.empty) { 'DEFGHIJKLMNO'.split('').forEach(function (cc) { put(r, cc, '', /[LMN]/.test(cc) ? ST.amt : cc === 'O' ? ST.pay : cc === 'D' || cc === 'E' ? ST.d : ST.desc); }); return; }
              var pct = Number(b.pct) || 0, qty = Number(l.qty) || 0, price = Number(l.price) || 0;
              var c = calc({ qty: qty, price: price }, b.vatMode, pct);
              if (!li) {
                put(r, 'D', b.issueDate ? { date: b.issueDate } : '', ST.d);
                put(r, 'E', b.dueDate ? { date: b.dueDate } : '', ST.d, b.issueDate ? '=+D' + x + '+' + (Number(b.creditDays) || 0) : null);
                put(r, 'F', b.invNo || '', ST.inv);
              } else { put(r, 'D', '', ST.d); put(r, 'E', '', ST.d); put(r, 'F', '', ST.inv); }
              var isPo = b.kind === 'po';
              if (isPo) sh.rows[r - 1].po = 1;
              put(r, 'G', l.desc || '', isPo ? ST.descR : ST.desc);
              put(r, 'H', qty, Math.round(qty) === qty ? (isPo ? ST.qtyR : ST.qty) : (isPo ? ST.qty2R : ST.qty2));
              put(r, 'I', price, price < 0 || isPo ? (isPo ? ST.priceR : ST.priceNeg) : ST.price);
              put(r, 'J', pct || '', ST.pct);
              put(r, 'K', pct ? c.wht : '', ST.wht, pct ? '=+L' + x + '*' + pct + '%' : null);
              put(r, 'L', c.amount, ST.amt, b.vatMode === 'inc' ? '=H' + x + '*I' + x + '*100/107' : '=+H' + x + '*I' + x);
              put(r, 'M', c.vat, ST.amt, b.vatMode === 'none' ? null : '=ROUND(L' + x + '*7%,2)');
              put(r, 'N', c.total, ST.amt, '=+L' + x + '+M' + x);
              put(r, 'O', '', ST.pay);
              nSum += c.total; kSum += pct ? c.wht : 0; if (pct) anyWht = true;
              sums.K += pct ? c.wht : 0; sums.L += c.amount; sums.M += c.vat; sums.N += c.total;
            });
            if (b.empty) return;
            var bEnd = bStart + b.lines.length - 1, ns = [], ks = [];
            for (var q = bStart; q <= bEnd; q++) { ns.push('N' + q); if (Number(b.pct)) ks.push('K' + q); }
            var payV = r2(nSum - kSum);
            put(bStart, 'O', payV, ST.pay, '=+' + ns.join('+') + (ks.length ? '-' + ks.join('-') : ''));
            if (bEnd > bStart) merge('O' + bStart, 'O' + bEnd);
            sums.O += payV;
          });
          var tr = R(26.25), from = vStart, to = tr - 1;
          put(tr, 'A', '', ST.no, '=IF(B' + tr + '="","",COUNTA($B$' + first + ':B' + tr + '))');
          var vend = vendorOf(v.name), bankTxt = vend && vend.bank ? vend.bank : 'ธ.';
          put(tr, 'B', '', ST.bankB); put(tr, 'C', bankTxt, ST.bank);
          if (anyWht) { 'DEFG'.split('').forEach(function (cc) { put(tr, cc, '', ST.edge); }); merge('C' + tr, 'G' + tr); 'HIJ'.split('').forEach(function (cc) { put(tr, cc, '', ST.bankF); }); put(tr, 'K', r2(sums.K), ST.sumK, '=SUM(K' + from + ':K' + to + ')'); }
          else { 'DEFGHI'.split('').forEach(function (cc) { put(tr, cc, '', ST.edge); }); put(tr, 'J', '', ST.edgeR); merge('C' + tr, 'J' + tr); put(tr, 'K', '', ST.bankF); }
          ['L', 'M', 'N'].forEach(function (cc) { put(tr, cc, r2(sums[cc]), ST.sumA, '=SUM(' + cc + from + ':' + cc + to + ')'); });
          put(tr, 'O', r2(sums.O), ST.sumO, '=SUM(O' + from + ':O' + to + ')');
          totRows.push(tr); secTotal += sums.O;
        });
        put(rB, 'D', r2(secTotal), si ? ST.bigTot : ST.bigTot18, '=+' + totRows.map(function (t) { return 'O' + t; }).join('+')); put(rB, 'E', '', si ? ST.bigTot : ST.bigTot18); merge('D' + rB, 'E' + rB);
        catTotals[ck] = { total: r2(secTotal), titleRow: r1, sumRow: rB, sheet: sh.name };
      });
      if (si !== 1) return;
      // สรุปทุกหมวด + รายการเงินเข้า (ท้ายแผ่นที่ 2 เหมือนไฟล์)
      R(28.5);
      var s0 = sh.rows.length + 1, all = ['raw', 'pack', 'misc', 'ship', 'svc', 'fac'], grand = 0;
      var I = inc || { cpall: [{}, {}], cpram: [{}, {}] };
      var inRows = [
        ['รายได้', 'Cpall', I.cpall[0], 'รอบส่งสินค้าวันที่ 1-15'], ['รายได้', 'Cpall', I.cpall[1], 'รอบส่งสินค้าวันที่ 16-สิ้นเดือน'], ['รวมรายได้สุทธิ', 'Cpall', null],
        ['รายได้', 'Cpram', I.cpram[0], 'รอบส่งสินค้าวันที่ 1-15'], ['รายได้', 'Cpram', I.cpram[1], 'รอบส่งสินค้าวันที่ 16-สิ้นเดือน'], ['รวมรายได้สุทธิ', 'Cpram', null]
      ];
      for (var i = 0; i < 7; i++) {
        var r = R(28.5), ck = all[i];
        if (ck) {
          var ct = catTotals[ck], other = ct.sheet !== sh.name, ref = other ? "'" + ct.sheet + "'!" : '';
          put(r, 'B', cat(ck).title + ' ' + payTxt, ST.sL, '=' + ref + 'B' + ct.sumRow); put(r, 'C', '', ST.sL); merge('B' + r, 'C' + r);
          put(r, 'D', ct.total, ST.sD, '=SUM(' + ref + 'D' + ct.sumRow + ')'); put(r, 'E', '', ST.sD); merge('D' + r, 'E' + r);
          grand += ct.total;
        } else {
          put(r, 'D', r2(grand), ST.sDt, '=SUM(D' + s0 + ':E' + (r - 1) + ')'); put(r, 'E', '', ST.sDt); merge('D' + r, 'E' + r);
        }
        if (!i) { put(r, 'G', 'รายการเงินเข้า', ST.inHead); merge('G' + r, 'K' + r); continue; }
        var x = inRows[i - 1], tot = !x[2];
        put(r, 'G', x[0], tot ? ST.inGb : ST.inG); put(r, 'H', x[1], tot ? ST.inGb : ST.inG);
        if (tot) put(r, 'I', r2((x[1] === 'Cpall' ? I.cpall : I.cpram).reduce(function (s, y) { return s + (Number(y.amount) || 0); }, 0)), ST.inIb, '=+I' + (r - 2) + '+I' + (r - 1));
        else { put(r, 'I', x[2].amount ? r2(x[2].amount) : '', ST.inI); put(r, 'J', x[2].date ? 'วันที่ ' + +x[2].date.slice(8) + '/' + +x[2].date.slice(5, 7) + '/' + x[2].date.slice(2, 4) : '', ST.inJ); put(r, 'K', x[3], ST.inK); }
      }
    });
    return { nominal: nominal, actual: rd.actual, sheets: sheets, catTotals: catTotals, lines: lines };
  }

  // ---------- แสดงในหน้าเว็บ (หน้าตาเหมือน Excel) ----------
  function cellText(c) {
    var v = c.v;
    if (v === '' || v == null) return '';
    if (v && v.date) return slash(v.date);
    if (typeof v === 'number') {
      var nf = c.s.nf || '';
      if (/^#,##0$/.test(nf)) return Math.round(v).toLocaleString('en-US');
      var t = m2(Math.abs(v));
      if (v < 0) return /\(/.test(nf) ? '(' + t + ')' : '-' + t;
      return /_\(\*/.test(nf) && !v ? '-' : t;
    }
    return esc(v);
  }
  function bd(code, i) { var ch = (code || '----')[i]; return ch === 't' ? '1px solid #000' : ch === 'h' ? '1px solid #cbd5e1' : ''; }
  function sheetHtml(sh) {
    var cover = {}, span = {};
    sh.merges.forEach(function (m) {
      var a = m.split(':'), c1 = COLS.indexOf(a[0][0]), r1 = +a[0].slice(1), c2 = COLS.indexOf(a[1][0]), r2_ = +a[1].slice(1);
      span[a[0]] = [c2 - c1 + 1, r2_ - r1 + 1];
      for (var r = r1; r <= r2_; r++) for (var c = c1; c <= c2; c++) if (r !== r1 || c !== c1) cover[COLS[c] + r] = 1;
    });
    var h = '<div class="apsheet"><div class="apsn">' + esc(sh.name) + '</div><div class="cpwrap"><table class="apx1" style="width:' + WIDTHS.reduce(function (t, w) { return t + Math.round(w * 5.6 + 4); }, 0) + 'px"><colgroup>' + WIDTHS.map(function (w) { return '<col style="width:' + Math.round(w * 5.6 + 4) + 'px">'; }).join('') + '</colgroup><tbody>';
    sh.rows.forEach(function (row, ri) {
      var r = ri + 1;
      h += '<tr style="height:' + Math.round(row.h * 1.25) + 'px"' + (row.bill ? ' data-bill="' + esc(row.bill) + '" tabindex="0" class="apbill' + (row.po ? ' appo' : '') + '"' + (row.po ? ' title="PO ล่วงหน้า — ยังไม่ได้รับบิล"' : '') : '') + '>';
      for (var ci = 0; ci < 15; ci++) {
        var k = COLS[ci] + r; if (cover[k]) continue;
        var c = row.c[COLS[ci]] || { v: '', s: {} }, s = c.s || {}, sp = span[k];
        var css = 'font-size:' + Math.round((s.sz || 18) * 0.66) + 'px;' + (s.b ? 'font-weight:700;' : '') + (s.c ? 'color:#' + s.c + ';' : '') + (s.fill && s.fill !== 'FFFFFF' ? 'background:#' + s.fill + ';' : '') + 'text-align:' + (s.h || (typeof c.v === 'number' ? 'right' : 'left')) + ';'
          + (s.wrap ? 'white-space:normal;' : '') + ['left', 'right', 'top', 'bottom'].map(function (side, i) { var x = bd(s.bd, i); return x ? 'border-' + side + ':' + x + ';' : ''; }).join('');
        // ชื่อผู้ขาย (คอลัมน์ B แคบ) ล้นไปช่อง C ที่ว่างเหมือนใน Excel
        h += '<td' + (COLS[ci] === 'B' && !sp && c.v ? ' class="ov"' : '') + (sp ? (sp[0] > 1 ? ' colspan="' + sp[0] + '"' : '') + (sp[1] > 1 ? ' rowspan="' + sp[1] + '"' : '') : '') + ' style="' + css + '">' + cellText(c) + '</td>';
      }
      h += '</tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  // ---------- Excel ตามแบบฟอร์ม (ExcelJS) ----------
  function xlStyle(cell, s, v) {
    cell.font = { name: 'Angsana New', size: s.sz || 18, bold: !!s.b, color: { argb: 'FF' + (s.c || '000000') } };
    if (s.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + s.fill } };
    cell.alignment = { vertical: 'middle', horizontal: s.h || undefined, wrapText: !!s.wrap };
    var b = {}, map = { t: 'thin', h: 'hair' };
    ['left', 'right', 'top', 'bottom'].forEach(function (side, i) { var ch = (s.bd || '----')[i]; if (map[ch]) b[side] = { style: map[ch], color: { argb: 'FF000000' } }; });
    cell.border = b;
    if (s.nf) cell.numFmt = s.nf;
  }
  function xlValue(c) {
    var v = c.v;
    if (v && v.date) { var p = v.date.split('-'); v = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
    if (c.f) return { formula: c.f.replace(/^=/, ''), result: v === '' ? undefined : v };
    return v === '' ? null : v;
  }
  function buildXlsx(model) {
    var wb = new window.ExcelJS.Workbook();
    wb.creator = 'ระบบงานองค์กร — ฝ่ายบัญชี'; wb.created = new Date();
    wb.calcProperties = { fullCalcOnLoad: true };
    model.sheets.forEach(function (sh, si) {
      var ws = wb.addWorksheet(sh.name, {
        views: [{ showGridLines: false, zoomScale: 90, zoomScaleNormal: 90 }],
        properties: { defaultRowHeight: 28.5, defaultColWidth: 12.5703125 },
        pageSetup: { paperSize: 9, orientation: 'landscape', scale: sh.scale, fitToPage: false, fitToHeight: 0,
          margins: si ? { left: 0.0389, right: 0.118, top: 0.157, bottom: 0.0785, header: 0.157, footer: 0.0785 } : { left: 0.118, right: 0.0785, top: 0.157, bottom: 0, header: 0, footer: 0 },
          printArea: 'A1:O' + sh.rows.length }
      });
      WIDTHS.forEach(function (w, i) { ws.getColumn(i + 1).width = w; ws.getColumn(i + 1).font = { name: 'Angsana New', size: 18 }; });
      sh.rows.forEach(function (row, ri) {
        var xr = ws.getRow(ri + 1); xr.height = row.h;
        Object.keys(row.c).forEach(function (col) {
          var c = row.c[col], cell = xr.getCell(COLS.indexOf(col) + 1);
          var val = xlValue(c); if (val !== null) cell.value = val;
          xlStyle(cell, c.s || {}, c.v);
        });
      });
      sh.merges.forEach(function (m) { ws.mergeCells(m); });
    });
    return wb;
  }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  P.excel = function () {
    var model = P.model; if (!model) return Promise.resolve(false);
    return script(XJS_URL, function () { return !!window.ExcelJS; }).then(function () {
      return buildXlsx(model).xlsx.writeBuffer();
    }).then(function (buf) {
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'ค่าใช้จ่าย จ่าย ' + dotAD(model.nominal, true) + '.xlsx');
      toast('ดาวน์โหลด Excel ตามแบบฟอร์มแล้ว');
      return true;
    });
  };

  // ==================== หน้า: รายงานจ่ายตามรอบ ====================
  P.roundPage = function () {
    ensure('รายงานจ่ายตามรอบ', function () {
      var d = P.data, cnt = {};
      d.lines.forEach(function (l) { var x = cnt[l.payRound] = cnt[l.payRound] || { bills: {}, pay: 0 }; x.bills[l.billId] = 1; x.pay += (Number(l.lineTotal) || 0) - (Number(l.wht) || 0); });
      var payDay = pad(d.settings.payDay), today = d.today;
      var list = d.rounds.filter(function (r) { return cnt[r.nominal] || (r.nominal.slice(8) === payDay && r.nominal >= addDays(today, -20) && r.nominal <= addDays(today, 75)); });
      if (!P.round || !list.some(function (r) { return r.nominal === P.round; })) P.round = (list.filter(function (r) { return r.actual >= today && cnt[r.nominal]; })[0] || list.filter(function (r) { return r.actual >= today; })[0] || list[list.length - 1] || {}).nominal || '';
      var model = P.model = P.round ? buildModel(P.round, P.inc[P.round]) : null;
      var bills = model ? billsOf(model.lines) : [];
      var tot = bills.reduce(function (t, b) { t.pay += b.pay; t.wht += b.wht; t.vat += b.vat; if (b.kind === 'po') { t.po++; t.poPay += b.pay; } return t; }, { pay: 0, wht: 0, vat: 0, po: 0, poPay: 0 });
      $('main').innerHTML = '<h3>รายงานจ่ายตามรอบ</h3><p class="lead">หน้าตาเหมือนไฟล์ค่าใช้จ่ายเดิม · แตะแถวเพื่อแก้บิล · ปุ่ม Excel ได้ไฟล์ตามแบบฟอร์ม (ฟอนต์ สี ขนาดช่องเหมือนเดิม)</p>'
        + (d.linked ? '' : linkPanel())
        + '<div class="apchips rounds noprint">' + list.map(function (r) {
            var x = cnt[r.nominal];
            return '<button class="apround' + (r.nominal === P.round ? ' on' : '') + '" data-r="' + r.nominal + '"><b>จ่าย ' + dotAD(r.nominal, true) + '</b><small>' + (x ? Object.keys(x.bills).length + ' บิล · ' + m2(x.pay) : 'ยังไม่มีบิล') + '</small></button>';
          }).join('') + '</div>'
        + (model ? '<div class="kpis xk"><div class="kpi"><b>' + m2(tot.pay) + '</b><span>ยอดชำระรอบนี้ (บาท)</span></div><div class="kpi"><b>' + (bills.length - tot.po) + (tot.po ? ' <em class="apred">+ PO ' + tot.po + '</em>' : '') + '</b><span>บิล' + (tot.po ? ' · PO ล่วงหน้า ' + m2(tot.poPay) + ' บาท (ตัวแดง)' : '') + '</span></div><div class="kpi"><b>' + m2(tot.wht) + '</b><span>หัก ณ ที่จ่าย / ส่วนลด</span></div><div class="kpi"><b>' + dotAD(model.actual) + '</b><span>วันจ่ายจริง' + (roundOf(P.round).why ? ' (' + esc(roundOf(P.round).why) + ' เลื่อนจาก ' + dotAD(P.round) + ')' : '') + '</span></div></div>'
          + '<div class="apbtns noprint"><button class="btn btn-primary" id="apXls">' + icon('table', 18) + ' Excel ตามแบบฟอร์ม</button><button class="btn" id="apPdf">' + icon('pdf', 18) + ' PDF</button><button class="btn" id="apNew">' + icon('upload', 18) + ' นำเข้าบิล</button><button class="btn appob" id="apNewPo">' + icon('clock', 18) + ' + PO ล่วงหน้า</button></div>'
          + '<div class="apcats">' + d.cats.map(function (c, i) { var t = model.catTotals[c.key]; return '<span><i>' + (i + 1) + '</i>' + esc(c.name) + '<b>' + m2(t ? t.total : 0) + '</b></span>'; }).join('') + '</div>'
          + (tot.po ? '<div class="aplegend"><i></i> ตัวแดง = PO ล่วงหน้า ยังไม่ได้รับบิล (แตะแถวเพื่อแก้ / กด "ได้รับบิลแล้ว")</div>' : '')
          + '<div id="apInc" class="noprint"></div>'
          + model.sheets.map(function (sh) { return sheetHtml(sh); }).join('') : '<div class="panel">ยังไม่มีรอบจ่าย</div>');
      on('[data-r]', 'click', function (el) { P.round = el.getAttribute('data-r'); P.roundPage(); });
      bindLink();
      if (!model) return;
      $('apXls').addEventListener('click', function () { var b = this; b.disabled = true; P.excel().catch(function (e) { toast('สร้าง Excel ไม่ได้: ' + (e.message || e)); }).then(function () { b.disabled = false; }); });
      $('apPdf').addEventListener('click', function () { $('pdfBtn').click(); });
      $('apNew').addEventListener('click', function () { P.cur = null; go('a_apin'); });
      $('apNewPo').addEventListener('click', function () { P.cur = Object.assign(newBill('po'), { payRound: P.round, autoRound: false }); go('a_appo'); });
      // แถวที่เป็นบิล → แตะเพื่อแก้
      on('tr.apbill', 'click', function (el) { editBill(el.getAttribute('data-bill')); });
      on('tr.apbill', 'keydown', function (el, e) { if (e.key === 'Enter') editBill(el.getAttribute('data-bill')); });
      if (!P.inc[P.round]) {
        $('apInc').innerHTML = '<div class="a7msg"><span class="spinner dark"></span> กำลังคำนวณรายการเงินเข้า (CP ALL / CP Ram)…</div>';
        var rr = P.round;
        call('apIncome', state.token, rr).then(function (x) { if (x.ok) { P.inc[rr] = x; if (state.page === 'a_ap' && P.round === rr) P.roundPage(); } else $('apInc').innerHTML = ''; }).catch(function () { $('apInc').innerHTML = ''; });
      }
    });
  };

  // ==================== หน้า: PO ล่วงหน้า (ยังไม่ได้รับบิล) ====================
  P.poPage = function () {
    ensure('PO ล่วงหน้า', function () {
      var d = P.data;
      if (P.cur) return form();
      var pos = billsOf(d.lines.filter(function (l) { return l.kind === 'po'; })).sort(function (a, b) { return String(a.payRound).localeCompare(String(b.payRound)) || a.vendor.localeCompare(b.vendor, 'th'); });
      var byR = {}, order = [];
      pos.forEach(function (b) { if (!byR[b.payRound]) { byR[b.payRound] = []; order.push(b.payRound); } byR[b.payRound].push(b); });
      var total = pos.reduce(function (s, b) { return s + b.pay; }, 0);
      $('main').innerHTML = '<h3>PO ล่วงหน้า (รอบิล)</h3><p class="lead">สั่งซื้อแล้วแต่ยังไม่ได้รับบิล — กรอกชื่อสินค้า จำนวน ราคา ไว้ก่อน แสดงเป็น<b class="apred">ตัวแดง</b>ในรายงานรอบจ่ายและ Excel · ได้รับบิลจริงแล้วกด "ได้รับบิลแล้ว"</p>'
        + (d.linked ? '' : linkPanel())
        + '<div class="kpis xk"><div class="kpi"><b class="apred">' + pos.length + '</b><span>PO ที่รอบิล</span></div><div class="kpi"><b class="apred">' + m2(total) + '</b><span>ยอดที่จะต้องจ่าย (บาท)</span></div></div>'
        + '<div class="apbtns"><button class="btn btn-primary" id="apPoAdd">' + icon('clock', 18) + ' + เพิ่ม PO ล่วงหน้า</button></div>'
        + (order.length ? order.map(function (rd) {
          return '<div class="panel pbox appol"><h4>รอบจ่าย ' + dotAD(rd, true) + (roundOf(rd).actual !== rd ? ' <small>(จ่ายจริง ' + dotAD(roundOf(rd).actual) + ')</small>' : '') + '</h4>' + byR[rd].map(function (b) {
            return '<div class="appocard"><div class="appoh"><b>' + esc(b.vendor) + '</b><span>' + catNo(b.category) + '. ' + esc(cat(b.category).name) + (b.pct ? ' · หัก ' + b.pct + '%' : '') + '</span></div>'
              + '<div class="appoit">' + b.lines.map(function (l) { return '<div><span>' + esc(l.desc || '-') + '</span><span>' + q0(l.qty) + ' × ' + m2(l.price) + '</span></div>'; }).join('') + '</div>'
              + '<div class="appof"><span>ชำระ <b>' + m2(b.pay) + '</b></span><button class="btn apsm" data-pe="' + esc(b.billId) + '">แก้ไข</button><button class="btn btn-primary apsm" data-pr="' + esc(b.billId) + '">' + icon('check', 16) + ' ได้รับบิลแล้ว</button></div></div>';
          }).join('') + '</div>';
        }).join('') : '<div class="panel">ยังไม่มี PO ล่วงหน้า</div>');
      bindLink();
      $('apPoAdd').addEventListener('click', function () { P.cur = newBill('po'); form(); });
      on('[data-pe]', 'click', function (el) { editBill(el.getAttribute('data-pe')); });
      on('[data-pr]', 'click', function (el) { receivePo(el.getAttribute('data-pr')); });
    });
  };

  // ==================== นำเข้าบิลจากไฟล์ Excel ค่าใช้จ่ายเดิม (ผู้ใช้ขอ 20/11/69) ====================
  // อ่านด้วย ExcelJS (ต้องรู้สีตัวอักษร: แถวตัวแดง = PO ล่วงหน้า) · เฉพาะแผ่น "…จ่าย DD.MM.YY" (= รอบจ่าย) · แผ่น "ฟอร์ม …" เป็นแบบฟอร์มเปล่า ข้าม
  // หมวดจากหัวตาราง "1). … 6)." · ผู้ขายคอลัมน์ B จนถึงแถวรวม (ธ.…) · บิลใหม่เมื่อมีเลขที่ใบกำกับ / วันที่ · แถวที่ไม่มีทั้งสองต่อบิลก่อนหน้าของผู้ขายเดียวกัน
  function xv(c) {
    var v = c && c.value;
    if (v && typeof v === 'object' && !(v instanceof Date)) { if ('result' in v) v = v.result; else if (v.richText) v = v.richText.map(function (t) { return t.text; }).join(''); else if (v.text) v = v.text; else v = null; }
    return v;
  }
  function xf(c) { try { var f = c && c.formula; if (f) return String(f); } catch (e) {} var v = c && c.value; return v && typeof v === 'object' && v.formula ? String(v.formula) : ''; }   // สูตรแบบ shared ก็ได้สูตรจริงของช่องนั้น
  function xiso(v) { return v instanceof Date && !isNaN(v) ? v.getUTCFullYear() + '-' + pad(v.getUTCMonth() + 1) + '-' + pad(v.getUTCDate()) : ''; }
  function xred(c) { var col = c && c.font && c.font.color && c.font.color.argb; return /^(FF)?FF0000$/i.test(String(col || '')); }
  P.parseBillBook = function (wb) {
    var bills = [], cats = ['raw', 'pack', 'misc', 'ship', 'svc', 'fac'];
    wb.eachSheet(function (ws) {
      var m = ws.name.match(/จ่าย\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
      if (!m || /ฟอร์ม/.test(ws.name)) return;
      var y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543;
      var round = y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
      var ck = /วัตถุดิบ/.test(ws.name) ? 'raw' : 'pack', col = null, ven = null, bill = null;
      for (var r = 1; r <= ws.rowCount; r++) {
        var row = ws.getRow(r), t = function (i) { var v = xv(row.getCell(i)); return v == null ? '' : String(v).trim(); };
        var g = t(7);
        if (/รายการเงินเข้า/.test(g)) break;   // ส่วนสรุป / เงินเข้าท้ายแผ่น
        var tm = g.match(/^\s*(\d)\s*\)/); if (tm && /ค่า/.test(g)) { ck = cats[+tm[1] - 1] || ck; ven = null; bill = null; continue; }
        if (t(2) === 'ผู้ขาย/ผู้จ่ายเงิน') {
          col = {}; for (var c = 2; c <= 16; c++) { var h = t(c); if (h === 'วันที่ออก') col.d = c; else if (/ครบกำหนด/.test(h)) col.e = c; else if (/ใบกำกับ/.test(h)) col.f = c; else if (h === 'คำอธิบาย') col.g = c; else if (h === 'จำนวน') col.h = c; else if (h === 'ราคา') col.i = c; else if (h === '%') col.p = c; else if (/มูลค่ารายการ/.test(h)) col.a = c; else if (/ภาษีมูลค่าเพิ่ม/.test(h)) col.v = c; }
          continue;
        }
        if (!col) continue;
        var bName = t(2), bank = t(3);
        if (/^ธ/.test(bank) && !t(col.g)) { ven = null; bill = null; continue; }
        if (bName && !/^=/.test(bName) && !/ค่าใช้จ่าย|^\d\s*\)/.test(bName)) { ven = bName.replace(/\s+/g, ' '); bill = null; }
        if (!ven) continue;
        var qv = xv(row.getCell(col.h)), pv = xv(row.getCell(col.i)), desc = t(col.g);
        var qty = typeof qv === 'number' ? qv : num(qv), price = typeof pv === 'number' ? pv : num(pv);
        if (!price || (!desc && !qty)) continue;
        if (!qty) qty = 1;
        var inv = col.f ? t(col.f) : '', dv = col.d ? xv(row.getCell(col.d)) : null, iso = xiso(dv), red = xred(row.getCell(col.g));
        var ef = col.e ? xf(row.getCell(col.e)) : '', cm = ef.match(/D\d+\s*\+\s*(\d+)/), af = col.a ? xf(row.getCell(col.a)) : '', vc = col.v ? row.getCell(col.v) : null;
        if (!bill || inv || iso || (bill.kind === 'po') !== red) {
          if (bill && inv && bill.invNo === inv) { /* บรรทัดต่อของใบเดิม */ }
          else {
            bill = { category: ck, vendor: ven, payRound: round, invNo: red ? '' : inv, issueDate: red ? '' : iso, creditDays: cm ? +cm[1] : '', kind: red ? 'po' : '',
              vatMode: /100\s*\/\s*107/.test(af) ? 'inc' : (vc && !xf(vc) && xv(vc) === 0 ? 'none' : 'exc'), pct: col.p ? Number(xv(row.getCell(col.p))) || 0 : 0,
              note: red && iso ? 'วันที่ในไฟล์ ' + slash(iso) : '', lines: [], sheet: ws.name, row: r };
            bills.push(bill);
          }
        }
        if (cm && bill.creditDays === '') bill.creditDays = +cm[1];
        bill.lines.push({ desc: desc || '-', qty: qty, price: r2(price * 10000) / 10000 });
      }
    });
    var vc = {}; bills.forEach(function (b) { if (b.creditDays !== '' && vc[b.vendor] == null) vc[b.vendor] = b.creditDays; });
    bills.forEach(function (b) {
      if (b.creditDays === '' && vc[b.vendor] != null) b.creditDays = vc[b.vendor];   // เครดิตของผู้ขายตามไฟล์ (สูตร =D+45 / +60)
      b.dueDate = b.issueDate ? addDays(b.issueDate, Number(b.creditDays) || 0) : '';
      var t = { total: 0, wht: 0 }; b.lines.forEach(function (l) { var c = calc(l, b.vatMode, b.pct); t.total += c.total; t.wht += c.wht; }); b.pay = r2(t.total - t.wht);
    });
    return bills;
  };
  function importBook(f) {
    if (!P.data.linked) return toast('เชื่อม Google Sheet "ค่าใช้จ่าย (จ่าย) ฝ่ายบัญชี" ก่อน แล้วค่อยนำเข้า');
    msg('<span class="spinner dark"></span> กำลังอ่านไฟล์ Excel…');
    var buf;
    Promise.all([script(XJS_URL, function () { return !!window.ExcelJS; }), script(XLSX_URL, function () { return !!window.XLSX; })]).then(function () { return f.arrayBuffer(); }).then(function (b) {
      buf = b; var wb = new window.ExcelJS.Workbook(); return wb.xlsx.load(b.slice(0));
    }).then(function (wb) {
      msg('');
      var bills = P.parseBillBook(wb), vendors = P.parseVendorBook(XLSX.read(buf, { type: 'array', cellFormula: true }));
      if (!bills.length) return toast('ไม่พบบิลในแผ่น "…จ่าย DD.MM.YY" ของไฟล์นี้');
      var have = {}; P.data.lines.forEach(function (l) { if (l.invNo) have[norm(l.vendor) + '|' + l.invNo] = 1; });
      bills.forEach(function (b) { b.dup = !!(b.invNo && b.kind !== 'po' && have[norm(b.vendor) + '|' + b.invNo]); });
      var ok = bills.filter(function (b) { return !b.dup; }), byR = {};
      ok.forEach(function (b) { var x = byR[b.payRound] = byR[b.payRound] || { n: 0, po: 0, pay: 0 }; x.n++; if (b.kind === 'po') x.po++; x.pay += b.pay; });
      openModal({ title: 'นำเข้าบิลจาก Excel', icon: 'table', color: state.dept.color, wide: true, ok: 'นำเข้า ' + ok.length + ' บิล',
        body: '<p>' + Object.keys(byR).sort().map(function (k) { var x = byR[k]; return '<b>รอบจ่าย ' + dotAD(k, true) + '</b>: ' + x.n + ' บิล' + (x.po ? ' (PO ล่วงหน้า ' + x.po + ' · ตัวแดง)' : '') + ' · ชำระ ' + m2(x.pay); }).join('<br>')
          + (bills.length > ok.length ? '<br><span class="apwarn">ข้าม ' + (bills.length - ok.length) + ' บิลที่มีอยู่แล้ว</span>' : '') + '<br><small>รวมผู้ขาย ' + vendors.length + ' ราย (บัญชีธนาคาร / เครดิต / แบบ VAT / % จากไฟล์ — ที่มีอยู่แล้วเติมเฉพาะช่องว่าง)</small></p>'
          + '<div class="apvimp">' + bills.map(function (b) { return '<div class="cprow' + (b.dup ? ' apdup' : '') + '"><b' + (b.kind === 'po' ? ' class="apred"' : '') + '>' + esc(b.vendor) + '</b><span>' + (b.kind === 'po' ? '<span class="aptag">PO ล่วงหน้า</span>' : esc(b.invNo || '-') + ' · ' + slash(b.issueDate)) + ' · ' + catNo(b.category) + '. ' + esc(cat(b.category).name) + '</span><small>รอบ ' + dotAD(b.payRound, true) + ' · ' + b.lines.length + ' รายการ · ชำระ ' + m2(b.pay) + (b.creditDays !== '' ? ' · เครดิต ' + b.creditDays + ' วัน' : '') + (b.pct ? ' · หัก ' + b.pct + '%' : '') + (b.dup ? ' · มีแล้ว (ข้าม)' : '') + '</small></div>'; }).join('') + '</div>',
        submit: function () {
          if (!ok.length) return 'ไม่มีบิลใหม่';
          return call('apImportVendors', state.token, vendors.map(function (v) { return Object.assign({}, v, { vatMode: v.vatMode || 'exc' }); })).then(function () {
            return call('apImportBills', state.token, ok.map(function (b) { return { category: b.category, vendor: b.vendor, payRound: b.payRound, invNo: b.invNo, issueDate: b.issueDate, creditDays: b.creditDays, dueDate: b.dueDate, kind: b.kind, vatMode: b.vatMode, pct: b.pct, note: b.note, lines: b.lines }; }));
          }).then(function (r) {
            if (!r.ok) return r.error;
            closeModal(); toast('นำเข้า ' + r.bills + ' บิล (' + r.lines + ' รายการ)' + (r.skipped ? ' · ข้าม ' + r.skipped : ''));
            P.round = ok[0].payRound; return load().then(function () { go('a_ap'); });
          });
        } });
    }).catch(function (e) { msg('อ่านไฟล์ไม่ได้: ' + esc(e.message || e), 'bad'); });
  }

  // ==================== หน้า: ผู้ขาย / ตั้งค่า ====================
  P.vendorPage = function () {
    ensure('ผู้ขาย / ตั้งค่า (จ่าย)', function () {
      var d = P.data, q = P.vq || '';
      var vs = (d.vendors || []).filter(function (v) { return !q || norm(v.name + v.keywords + v.taxId).indexOf(norm(q)) >= 0 || String(v.name).indexOf(q) >= 0; });
      $('main').innerHTML = '<h3>ผู้ขาย / ตั้งค่า (จ่าย)</h3><p class="lead">ระบบจำข้อมูลผู้ขายให้เองเมื่อบันทึกบิล · ใช้จับชื่อผู้ขายจากภาพบิล หมวด เครดิต แบบ VAT % หัก ณ ที่จ่าย และบัญชีธนาคารที่แถวรวมของรายงาน</p>'
        + linkPanel()
        + '<div class="panel pbox"><h4>' + icon('gear', 18) + ' ตั้งค่า</h4><div class="apgrid">'
        + '<label>วันจ่ายประจำเดือน (วันที่)<input id="apPayDay" inputmode="numeric" value="' + d.settings.payDay + '"><small>ตรงวันหยุด → จ่ายวันทำการถัดไป (ใช้วันหยุดชุดเดียวกับ 7-11)</small></label>'
        + '<label>วันตัดรอบบิล (วันที่)<input id="apCutDay" inputmode="numeric" value="' + (d.settings.cutDay || 19) + '"><small>รอบจ่าย = วันตัดรอบของบิล + เครดิตผู้ขาย → วันจ่ายรอบแรกหลังจากนั้น</small></label>'
        + '<label>เลขผู้เสียภาษีของบริษัทเรา<input id="apOurTax" inputmode="numeric" value="' + esc(d.settings.ourTaxId) + '" placeholder="13 หลัก"><small>ไม่ให้ระบบจับเลขของเราเป็นเลขของผู้ขาย</small></label>'
        + '</div><button class="btn btn-primary" id="apSetSave">บันทึกตั้งค่า</button></div>'
        + '<div class="apbtns"><button class="btn btn-primary" id="apVAdd">+ เพิ่มผู้ขาย</button><label class="btn">' + icon('upload', 18) + ' นำเข้าผู้ขาย / เครดิต Supplier จาก Excel<input type="file" id="apVImp" accept=".xlsx,.xls" hidden></label></div>'
        + '<input type="search" id="apVq" class="apsearch" placeholder="ค้นหาผู้ขาย…" value="' + esc(q) + '">'
        + d.cats.map(function (c, i) {
          var list = vs.filter(function (v) { return (v.category || 'raw') === c.key; });
          if (!list.length) return '';
          return '<div class="panel pbox"><h4><i class="apno">' + (i + 1) + '</i> ' + esc(c.name) + ' <small>' + list.length + ' ราย</small></h4>' + list.map(function (v) {
            return '<div class="cprow apr" data-v="' + esc(v.id) + '" tabindex="0"><b>' + esc(v.name) + '</b><span>' + (v.creditDays !== '' && v.creditDays != null ? 'เครดิต ' + v.creditDays + ' วัน · ' : '') + VAT_SHORT[v.vatMode || 'exc'] + (Number(v.pct) ? ' · หัก ' + v.pct + '%' : '') + '</span><small>' + esc(v.bank || 'ยังไม่ใส่บัญชีธนาคาร') + (v.taxId ? ' · ' + esc(v.taxId) : '') + '</small></div>';
          }).join('') + '</div>';
        }).join('')
        + (vs.length ? '' : '<div class="panel">ยังไม่มีผู้ขาย — เพิ่มเอง หรือนำเข้าจากไฟล์ Excel ค่าใช้จ่ายเดิม</div>');
      bindLink();
      $('apVq').addEventListener('input', function () { P.vq = this.value; clearTimeout(P.vqT); P.vqT = setTimeout(function () { P.vendorPage(); var el = $('apVq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250); });
      $('apSetSave').addEventListener('click', function () {
        var b = this; b.disabled = true;
        call('apSaveSettings', state.token, { payDay: $('apPayDay').value, cutDay: $('apCutDay').value, ourTaxId: $('apOurTax').value }).then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); toast('บันทึกตั้งค่าแล้ว'); load().then(P.vendorPage); }).catch(onServerError);
      });
      $('apVAdd').addEventListener('click', function () { vendorDialog({}); });
      on('[data-v]', 'click', function (el) { vendorDialog((d.vendors || []).filter(function (v) { return v.id === el.getAttribute('data-v'); })[0] || {}); });
      $('apVImp').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) importVendors(f); });
    });
  };
  function vendorDialog(v) {
    var d = P.data;
    openModal({ title: v.id ? 'แก้ไขผู้ขาย' : 'เพิ่มผู้ขาย', icon: 'form', color: state.dept.color, ok: 'บันทึก',
      body: '<label class="cpnl">ชื่อผู้ขาย<input id="vN" value="' + esc(v.name || '') + '"></label>'
        + '<label class="cpnl">หมวด<select id="vC">' + d.cats.map(function (c, i) { return '<option value="' + c.key + '"' + ((v.category || 'raw') === c.key ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(c.name) + '</option>'; }).join('') + '</select></label>'
        + '<label class="cpnl">เลขผู้เสียภาษี<input id="vT" inputmode="numeric" value="' + esc(v.taxId || '') + '"></label>'
        + '<label class="cpnl">บัญชีธนาคาร (แถวรวมในรายงาน)<input id="vB" value="' + esc(v.bank || '') + '" placeholder="ธ.กสิกรไทย 123-4-56789-0 บริษัท …"></label>'
        + '<label class="cpnl">เครดิต (วัน)<input id="vD" inputmode="numeric" value="' + esc(v.creditDays == null ? '' : v.creditDays) + '"></label>'
        + '<label class="cpnl">ราคาในบิล<select id="vV">' + Object.keys(VAT_SHORT).map(function (k) { return '<option value="' + k + '"' + ((v.vatMode || 'exc') === k ? ' selected' : '') + '>' + VAT_SHORT[k] + '</option>'; }).join('') + '</select></label>'
        + '<label class="cpnl">% หัก ณ ที่จ่าย<input id="vP" inputmode="decimal" value="' + esc(v.pct || '') + '"></label>'
        + '<label class="cpnl">คำที่ใช้จับชื่อในบิล (คั่นด้วย ,)<input id="vK" value="' + esc(v.keywords || '') + '" placeholder="เช่น ชื่อย่อ / ชื่อภาษาอังกฤษ"></label>'
        + (v.id ? '<button type="button" class="btn apdel" id="vDel">' + icon('trash', 16) + ' ลบผู้ขาย</button>' : ''),
      onOpen: function () {
        var del = $('vDel');
        if (del) del.addEventListener('click', function () {
          closeModal();
          ask({ title: 'ลบผู้ขาย?', text: v.name + ' (บิลที่บันทึกไว้ไม่หาย)', ok: 'ลบ', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
            if (yes) call('apDeleteVendor', state.token, v.id).then(function (r) { if (!r.ok) return toast(r.error); toast('ลบแล้ว'); load().then(P.vendorPage); }).catch(onServerError);
          });
        });
      },
      submit: function () {
        return call('apSaveVendor', state.token, { id: v.id || '', name: val('vN'), category: val('vC'), taxId: val('vT'), bank: val('vB'), creditDays: val('vD'), vatMode: val('vV'), pct: val('vP'), keywords: val('vK'), sort: v.sort || '' })
          .then(function (r) { if (!r.ok) return r.error; closeModal(); toast('บันทึกแล้ว'); load().then(P.vendorPage); });
      } });
  }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  // อ่านไฟล์ Excel ค่าใช้จ่ายเดิม: ชื่อผู้ขาย (คอลัมน์ B), บัญชีธนาคาร (แถวรวม คอลัมน์ C), เครดิต (สูตร =D+45), แบบ VAT (สูตร *100/107 / VAT 0), % (คอลัมน์ % ถ้ามี) · หมวดจากหัวตาราง 1)–6)
  P.parseVendorBook = function (wb) {
    var out = [], seen = {};
    var catByTitle = function (t) { var m = String(t).match(/^\s*(\d)\s*\)/); return m ? ['raw', 'pack', 'misc', 'ship', 'svc', 'fac'][+m[1] - 1] : ''; };
    wb.SheetNames.forEach(function (sn) {
      var ws = wb.Sheets[sn], ref = ws['!ref']; if (!ref) return;
      var rg = XLSX.utils.decode_range(ref), cur = null, ck = '', pctCol = -1, kCol = -1;
      var cell = function (r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; };
      var txt = function (r, c) { var x = cell(r, c); return x && x.v != null ? String(x.v).trim() : ''; };
      for (var r = rg.s.r; r <= rg.e.r; r++) {
        var g = txt(r, 6); if (catByTitle(g)) ck = catByTitle(g);
        if (txt(r, 1) === 'ผู้ขาย/ผู้จ่ายเงิน') { pctCol = -1; for (var c = 7; c <= 16; c++) { if (txt(r, c) === '%') pctCol = c; if (/มูลค่ารายการ/.test(txt(r, c))) kCol = c; } continue; }
        var b = txt(r, 1), bank = txt(r, 2);
        if (b && !/^=/.test(b) && !/^\d+\)\./.test(b) && !/ค่าใช้จ่าย/.test(b)) {
          var k = norm(b); if (!k) continue;
          cur = seen[k] || (seen[k] = { name: b.replace(/\s+/g, ' ').trim(), category: ck || 'raw', bank: '', creditDays: '', vatMode: '', pct: '' });
          if (out.indexOf(cur) < 0) out.push(cur);
        }
        if (!cur) continue;
        var e = cell(r, 4); if (e && e.f && cur.creditDays === '') { var mm = String(e.f).match(/D\d+\s*\+\s*(\d+)/); if (mm) cur.creditDays = +mm[1]; }
        var kk = kCol >= 0 ? cell(r, kCol) : null;
        var vv = kCol >= 0 ? cell(r, kCol + 1) : null;
        if (kk && kk.f && !cur.vatMode) cur.vatMode = vv && !vv.f && vv.v === 0 ? 'none' : /100\/107/.test(kk.f) ? 'inc' : 'exc';   // ดูจากรายการแรกของผู้ขาย
        if (pctCol >= 0 && cur.pct === '') { var pc = cell(r, pctCol); if (pc && typeof pc.v === 'number' && pc.v > 0) cur.pct = pc.v; }
        if (/^ธ\./.test(bank)) { if (bank.length > 3 && !cur.bank) cur.bank = bank.replace(/\s+/g, ' ').trim(); cur = null; }
      }
    });
    return out;
  };
  // ไฟล์ "รายละเอียด Supplier" (ผู้ใช้ส่ง 20/11/69: แผ่นวัตถุดิบ / บรรจุภัณฑ์และอื่นๆ · คอลัมน์ Suppier + เครดิต/วัน) → เครดิตของแต่ละเจ้า
  // จับคู่ชื่อกับผู้ขายที่มีแบบหลวม (vendorOf) · ที่ไม่พบ = เพิ่มเป็นผู้ขายใหม่ (หมวดตามชื่อแผ่น)
  P.parseCreditBook = function (wb) {
    var out = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }), hc = -1, cc = -1;
      rows.forEach(function (r) {
        if (hc < 0) { r.forEach(function (v, i) { var t = String(v).trim(); if (/^supp?l?ier$|suppier|ผู้ขาย|ชื่อบริษัท/i.test(t)) hc = i; if (/เครดิต/.test(t)) cc = i; }); if (hc < 0 || cc < 0) hc = cc = -1; return; }
        var name = String(r[hc] || '').replace(/\s+/g, ' ').trim(), cr = Number(String(r[cc]).replace(/[^\d.]/g, ''));
        if (!name || !isFinite(cr) || String(r[cc]) === '') return;
        var v = vendorOf(name);
        out.push({ name: v ? v.name : name, fileName: name, matched: !!v, creditDays: Math.round(cr), category: v ? v.category : /วัตถุดิบ/.test(sn) ? 'raw' : 'pack' });
      });
    });
    return out;
  };
  function importVendors(f) {
    toast('กำลังอ่านไฟล์…');
    script(XLSX_URL, function () { return !!window.XLSX; }).then(function () { return f.arrayBuffer(); }).then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array', cellFormula: true }), cr = P.parseCreditBook(wb);
      if (cr.length) {
        var m = cr.filter(function (x) { return x.matched; }).length;
        return openModal({ title: 'เครดิต Supplier ' + cr.length + ' ราย', icon: 'upload', color: state.dept.color, ok: 'บันทึกเครดิต', wide: true,
          body: '<p>ตรงกับผู้ขายที่มีอยู่ ' + m + ' ราย (ตั้งเครดิตตามไฟล์) · ผู้ขายใหม่ ' + (cr.length - m) + ' ราย (เพิ่มให้) — บิลที่โหลดเข้ามาของเจ้านั้นจะใส่เครดิตให้อัตโนมัติ</p><div class="apvimp">' + cr.map(function (v) { return '<div class="cprow"><b>' + esc(v.fileName) + '</b><span>เครดิต ' + v.creditDays + ' วัน</span><small>' + (v.matched ? '✓ ' + esc(v.name) : 'ผู้ขายใหม่ · ' + esc(cat(v.category).name)) + '</small></div>'; }).join('') + '</div>',
          submit: function () {
            return call('apImportVendors', state.token, cr.map(function (v) { return { name: v.name, category: v.category, creditDays: v.creditDays, vatMode: 'exc' }; }), { credit: true }).then(function (r) { if (!r.ok) return r.error; closeModal(); toast('ตั้งเครดิตแล้ว · เพิ่มใหม่ ' + r.added + ' ราย · อัปเดต ' + r.filled + ' ราย'); load().then(P.vendorPage); });
          } });
      }
      var list = P.parseVendorBook(wb);
      if (!list.length) return toast('ไม่พบรายชื่อผู้ขายในไฟล์');
      openModal({ title: 'นำเข้าผู้ขาย ' + list.length + ' ราย', icon: 'upload', color: state.dept.color, ok: 'นำเข้า', wide: true,
        body: '<p>ผู้ขายที่มีอยู่แล้วจะเติมเฉพาะช่องที่ว่าง</p><div class="apvimp">' + list.map(function (v) { return '<div class="cprow"><b>' + esc(v.name) + '</b><span>' + esc(cat(v.category).name) + (v.creditDays !== '' ? ' · เครดิต ' + v.creditDays : '') + ' · ' + VAT_SHORT[v.vatMode || 'exc'] + (v.pct ? ' · ' + v.pct + '%' : '') + '</span><small>' + esc(v.bank || '-') + '</small></div>'; }).join('') + '</div>',
        submit: function () {
          return call('apImportVendors', state.token, list.map(function (v) { return Object.assign({}, v, { vatMode: v.vatMode || 'exc' }); })).then(function (r) { if (!r.ok) return r.error; closeModal(); toast('เพิ่ม ' + r.added + ' ราย · เติมข้อมูล ' + r.filled + ' ราย'); load().then(P.vendorPage); });
        } });
    }).catch(function (e) { toast('อ่านไฟล์ไม่ได้: ' + (e.message || e)); });
  }

  // ปุ่ม Excel ด้านบน (index.html) ในหน้ารายงานรอบจ่าย → ไฟล์ตามแบบฟอร์ม
  P.exportFile = function (page, kind) { return page === 'a_ap' && kind === 'xlsx' && P.model ? P.excel() : null; };

  var css = document.createElement('style');
  css.textContent = [
    '.appick{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.appick small{flex-basis:100%;color:var(--muted)}.apbig{width:auto;flex:1 1 200px;justify-content:center;gap:8px;padding:14px;font-size:16px;cursor:pointer}',
    '.apform{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:18px;align-items:start}.apform.nofile{grid-template-columns:1fr}',
    '.apimgs{position:sticky;top:12px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 24px);overflow:auto}.apimgs figure{margin:0}.apimgs img{width:100%;border:1px solid var(--line);border-radius:10px;cursor:zoom-in;background:#fff}',
    '.apsm{width:auto;padding:6px 12px;font-size:14px;margin-top:6px}.aptext pre{white-space:pre-wrap;font-size:12px;max-height:240px;overflow:auto;background:#f8fafc;padding:8px;border-radius:8px}',
    '.apfields{min-width:0}.aphl{border:2px solid var(--c);background:color-mix(in srgb,var(--c) 7%,white);border-radius:14px;padding:12px;margin-bottom:12px}.aphl small{color:var(--muted)}.aphl.apneed,.apneed{outline:3px solid #dc2626}',
    '.apchips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.apchips label{position:relative}.apchips input[type=radio]{position:absolute;opacity:0}.apchips span{display:block;padding:10px 14px;border:1.5px solid var(--line);border-radius:12px;background:#fff;font-weight:600;cursor:pointer}',
    '.apchips input:checked+span{border-color:var(--c);background:var(--c);color:#fff}.apchips input:focus-visible+span{outline:2px solid var(--c)}.apchips.sm span{padding:7px 12px}.apother{display:flex;align-items:center;gap:6px;font-weight:600}.apother input{width:70px;padding:7px 9px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.apgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;margin-bottom:12px}.apgrid label{font-weight:600;font-size:14px}.apgrid .apwide{grid-column:1/-1}.apgrid input,.apgrid select{display:block;width:100%;margin-top:4px;padding:9px 11px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-weight:400;background:#fff}.apgrid small{display:block;font-weight:400;color:var(--muted)}',
    '.apgrid input[readonly]{background:#f1f5f9}.req{color:#dc2626}.apwarn{color:#b45309!important}.apok{color:#15803d!important}.apred{color:#dc2626}',
    '.aptab{border-collapse:collapse;width:100%;min-width:640px;font-size:14px}.aptab th{background:#f1f5f9;padding:6px;border:1px solid var(--line);white-space:nowrap}.aptab td{border:1px solid var(--line);padding:3px}.aptab td.apv{text-align:right;white-space:nowrap;padding:3px 6px;font-variant-numeric:tabular-nums}',
    '.aptab input{width:100%;border:0;padding:6px;font:inherit;background:transparent}.aptab input.apn{text-align:right;min-width:70px}.aptab td:first-child{min-width:200px}.apx{border:0;background:none;color:#dc2626;font-size:16px;cursor:pointer;padding:4px 8px}',
    '.apsum{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.apsum span{flex:1 1 110px;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px;color:var(--muted)}.apsum b{display:block;font-size:17px;color:var(--ink);font-variant-numeric:tabular-nums}.apsum .apred b{color:#dc2626}.apsum .appay{background:#FFFF00;border-color:#eab308}.apsum .appay b{font-size:19px}',
    '.apbtns{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.apbtns .btn{width:auto}.apdel{color:#dc2626;border-color:#fecaca}.apr{cursor:pointer}.apr:hover{background:#f8fafc}',
    '.rounds{margin:0 0 14px}.apround{border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:8px 12px;text-align:left;cursor:pointer;font:inherit}.apround small{display:block;color:var(--muted);font-size:12px}.apround.on{border-color:var(--c);background:var(--c);color:#fff}.apround.on small{color:#fff}',
    '.apcats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.apcats span{flex:1 1 150px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px}.apcats i{font-style:normal;display:inline-block;width:20px;height:20px;border-radius:50%;background:#D9EAD3;text-align:center;margin-right:6px;font-weight:700}.apcats b{display:block;font-size:16px;font-variant-numeric:tabular-nums}',
    '.apsheet{margin:0 0 22px}.apsheet .cpwrap{max-height:calc(100vh - 90px);overflow:auto;border:1px solid var(--line);border-radius:0 8px 8px 8px;background:#fff}',
    '.apqban{display:flex;gap:8px;align-items:center;background:#eff6ff;border:1.5px solid #bfdbfe;color:#1e3a8a;border-radius:12px;padding:10px 12px;margin-bottom:12px}.apsplit{display:flex;flex-direction:column;gap:6px;margin-top:12px}.apsplit span{color:var(--muted)}.apsn{display:inline-block;background:#1f2937;color:#fff;border-radius:8px 8px 0 0;padding:4px 12px;font-size:13px;font-weight:600}',
    '.apx1{border-collapse:collapse;table-layout:fixed;background:#fff;font-variant-numeric:tabular-nums}.apx1 td{padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;line-height:1.25}.apx1 td.ov{overflow:visible;position:relative;z-index:1}.apx1 tr.apbill{cursor:pointer}.apx1 tr.apbill:hover td{box-shadow:inset 0 0 0 999px rgba(37,99,235,.06)}',
    '.apdup{opacity:.5}.apsearch{width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font:inherit;margin-bottom:12px}.apno{font-style:normal;display:inline-block;width:22px;height:22px;border-radius:50%;background:#D9EAD3;color:#0f172a;text-align:center}.apvimp{max-height:50vh;overflow:auto}',
    '.appob{color:#b91c1c;border-color:#fecaca}.appoban{display:flex;gap:8px;align-items:center;background:#fef2f2;border:1.5px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-weight:600}.appoban b{color:#dc2626;margin:0 3px}',
    '.aptab.po td:nth-child(-n+3) input{color:#dc2626;font-weight:600}.aptag{display:inline-block;background:#fee2e2;color:#b91c1c;border-radius:999px;padding:1px 9px;font-size:12.5px;font-weight:700}',
    '.apatt{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.apatt .btn{margin:0}.apatt small{color:var(--muted)}.apinv{display:contents}.apinv.hidden{display:none}',
    '.aplegend{display:flex;gap:8px;align-items:center;font-size:13.5px;color:#991b1b;margin:-4px 0 12px}.aplegend i{width:14px;height:14px;border-radius:3px;background:#dc2626;display:inline-block}.kpi em{font-style:normal;font-size:15px}',
    '.apx1 tr.appo td{background-image:linear-gradient(rgba(220,38,38,.05),rgba(220,38,38,.05))}',
    '.appol h4 small{font-weight:400;color:var(--muted)}.appocard{border:1.5px solid #fecaca;border-radius:12px;padding:10px 12px;margin-top:10px;background:#fff}.appoh{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline}.appoh span{color:var(--muted);font-size:13px}',
    '.appoit{margin:6px 0;color:#dc2626;font-size:14.5px}.appoit div{display:flex;justify-content:space-between;gap:10px;padding:2px 0;border-bottom:1px dashed #fecaca}.appoit div span:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.appof{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.appof>span{flex:1;font-size:14px}.appof b{color:#dc2626}.appof .btn{margin:0}',
    '@media (max-width:860px){.apform{grid-template-columns:1fr}.apimgs{position:static;max-height:none}.apgrid{grid-template-columns:1fr}}'
  ].join('\n');
  document.head.appendChild(css);
})();
