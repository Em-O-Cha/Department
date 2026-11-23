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
  function load() { return call('apLoad', state.token).then(function (d) { P.data = d; P.loadedAt = Date.now(); return d; }); }
  // รีเฟรชอัตโนมัติ (accounting.js autoTick)
  P.refresh = function () { return call('apLoad', state.token).then(function (d) { var ch = !P.data || JSON.stringify([d.lines, d.poDone, d.vendors, d.settings]) !== JSON.stringify([P.data.lines, P.data.poDone, P.data.vendors, P.data.settings]); if (ch) P.data = d; P.loadedAt = Date.now(); return ch; }); };
  P.age = function () { return P.data ? Date.now() - (P.loadedAt || 0) : 0; };
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
  // เครดิตที่เก็บไว้ของผู้ขาย: 0 / ว่าง = ยังไม่ได้ตั้ง (ผู้ใช้แจ้ง 20/11/69 ว่าบิลของผู้ขายที่มีอยู่แล้วเครดิตไม่ขึ้น — เดิม 0 จากการนำเข้าทับค่าที่อ่านได้จากบิล)
  function vCredit(v) { var n = v ? Number(v.creditDays) : 0; return v && v.creditDays !== '' && v.creditDays != null && n > 0 ? n : null; }
  function roundOf(nom) { return (P.data.rounds || []).filter(function (r) { return r.nominal === nom; })[0] || { nominal: nom, actual: nom, why: '' }; }
  // รอบจ่ายเริ่มต้น = วันจ่ายรอบแรกที่ไม่ก่อนวันครบกำหนด (แก้ได้)
  function defaultRound(due) {
    var rs = (P.data.rounds || []).map(function (r) { return r.nominal; }).filter(function (d) { return d.slice(8) === pad(P.data.settings.payDay); });
    var base = due || P.data.today;
    return rs.filter(function (d) { return d >= base; })[0] || rs[rs.length - 1] || '';
  }
  // เครดิต (ตามตารางของผู้ใช้ 23/11/69): ครบเครดิต = วันที่ส่งของ / วันที่บิล + เครดิต นับเป็นเดือน (30 วัน = 1 เดือน, 60 = 2 เดือน, 45 = 1 เดือน + 15 วัน)
  // ครบกำหนดวันที่ 1–19 (วันตัดรอบ) → จ่ายวันที่ 10 ของเดือนนั้น · หลังวันที่ 19 → จ่ายวันที่ 10 เดือนถัดไป
  // เช่น ส่งของ 19/3 เครดิต 60 → ครบ 19/5 → จ่าย 10/5 · ส่งของ 21/3 → ครบ 21/5 → จ่าย 10/6 · ส่งของ 1/3 เครดิต 45 → 1/4 + 15 = 16/4 → จ่าย 10/4
  function addMonths(iso, n) {
    var p = String(iso).split('-'), y = +p[0], m = +p[1] - 1 + n, d = +p[2];
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(y, m + 1, 0).getDate();
    return y + '-' + pad(m + 1) + '-' + pad(Math.min(d, last));
  }
  function creditDue(iso, credit) { var c = Math.max(0, Math.round(Number(credit) || 0)); return addDays(addMonths(iso, Math.floor(c / 30)), c % 30); }
  function roundInfo(iso, credit) {
    var cd = Number(P.data.settings.cutDay) || 19, pd = Number(P.data.settings.payDay) || 10, due = creditDue(iso, credit), p = due.split('-'), y = +p[0], m = +p[1];
    if (+p[2] > cd) { m++; if (m > 12) { m = 1; y++; } }
    var nom = y + '-' + pad(m) + '-' + pad(pd);
    while (nom < iso) nom = addMonths(nom, 1);   // เครดิตสั้นมาก (เช่น 0) ไม่ให้รอบจ่ายก่อนวันที่บิล
    var rs = (P.data.rounds || []).map(function (r) { return r.nominal; });
    return { due: due, cut: cd, round: rs.indexOf(nom) >= 0 ? nom : defaultRound(nom) };
  }
  function roundFor(iso, credit) { return roundInfo(iso, credit).round; }
  // ผู้ใช้ขอ 23/11/69: ส่วนลด/มัดจำ (disc, บาท ต่อบรรทัด) หักก่อนคิด VAT · หัก ณ ที่จ่าย = มูลค่ารายการ × % (เหมือนเดิม)
  // รวม = มูลค่ารายการ − ส่วนลด/มัดจำ + VAT · ชำระ = รวม − หัก ณ ที่จ่าย
  function calc(l, mode, pct) {
    var amount = r2(mode === 'inc' ? l.qty * l.price * 100 / 107 : l.qty * l.price), disc = r2(Number(l.disc) || 0);
    var vat = mode === 'none' ? 0 : r2((amount - disc) * 0.07);
    return { amount: amount, disc: disc, vat: vat, total: r2(amount - disc + vat), wht: r2(amount * (Number(pct) || 0) / 100) };
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
    var T = lines.map(function (l) { return String(l).replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); }).replace(/\u0E4D\u0E32/g, '\u0E33').replace(/\t/g, '  ').replace(/[ \u00a0]{3,}/g, '  ')
      .replace(/(\d{1,3})((?:\.\d{3})+)\.(\d{2})(?!\d)/g, function (m, a, b, c) { return a + b.replace(/\./g, ',') + '.' + c; })   // OCR อ่านจุลภาคเป็นจุด: 42.420.00 → 42,420.00
      .trim(); }).filter(Boolean);
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
    var dscL = last(/ส่วนลด|Discount/i, /ภาษี|VAT|ทั้งสิ้น|Grand/i);   // ส่วนลด: บรรทัดที่มีคำว่า "ส่วนลด"
    var dscO = last(/มัดจำ|Deposit|หัก|Less/i, /ภาษี|VAT|ทั้งสิ้น|Grand|ณ\s*ที่จ่าย|Withholding/i);   // ไม่มีคำว่าส่วนลด → ยอดหักอื่นที่เกิน 5% ของยอดสินค้า (หัก ณ ที่จ่ายไม่เกิน 5% และกดเลือกเองในข้อ 2)
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
    var S = out.lines.reduce(function (s, x) { return s + x.amt; }, 0), base = out.sub || S;
    out.disc = dscL ? Math.abs(dscL) : dscO && base && Math.abs(dscO) / base > 0.05 ? Math.abs(dscO) : 0;
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
        + '<label class="btn apbig">' + icon('table', 20) + ' นำเข้าจาก Excel ค่าใช้จ่ายเดิม (เลือกได้หลายไฟล์)<input type="file" id="apXlsIn" accept=".xlsx" multiple hidden></label>'
        + '<button class="btn apbig appob" id="apPoNew">' + icon('clock', 20) + ' PO ล่วงหน้า (ยังไม่ได้รับบิล)</button>'
        + '<small>เลือกได้หลายภาพพร้อมกัน (หลายหน้าของบิลเดียวกัน) · ภาพชัด ตรง ไม่เอียง จะอ่านได้แม่นขึ้น</small></div>'
        + '<div id="apMsg"></div>' + recentHtml();
      ['apCam', 'apFile'].forEach(function (id) {
        $(id).addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files); this.value = ''; if (fs.length) start(fs); });
      });
      $('apManual').addEventListener('click', function () { P.cur = newBill(); form(); });
      $('apXlsIn').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files || []); this.value = ''; if (fs.length) importBook(fs); });
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
  P.render = function () { ({ a_ap_dash: P.dashPage, a_apin: P.importPage, a_ap: P.roundPage, a_apv: P.vendorPage, a_appo: P.poPage }[state.page] || P.importPage)(); };
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
    b.creditDays = vCredit(v) != null ? vCredit(v) : r.creditDays !== '' ? r.creditDays : v && v.creditDays !== '' && v.creditDays != null ? v.creditDays : '';
    if (r.vatMode) b.vatMode = r.vatMode;
    if (r.lines.length) b.lines = r.lines.map(function (x) { return { desc: x.desc, qty: x.qty, price: x.price }; });
    putDisc(b, r.disc);
    return b;
  }
  // ส่วนลด / มัดจำท้ายบิล → ใส่ที่บรรทัดแรก (VAT คิดจากยอดหลังหัก ให้ตรงกับบิล)
  function putDisc(b, d) { d = Number(d) || 0; if (d > 0 && b.lines.length && !b.lines.some(function (l) { return Number(l.disc) > 0; })) { b.lines[0].disc = r2(d); delete b.lines[0].discPct; } }
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
      b.lines.push(l); b.amount += Number(l.amount) || 0; b.disc = (b.disc || 0) + (Number(l.disc) || 0); b.vat += Number(l.vat) || 0; b.total += Number(l.lineTotal) || 0; b.wht += Number(l.wht) || 0;
    });
    out.forEach(function (b) {
      b.lines.sort(function (x, y) { return x.lineNo - y.lineNo; }); b.pay = r2(b.total - b.wht);
      b.poRef = b.lines[0].poRef || '';
      b.log = (b.lines.filter(function (l) { return l.poLog && l.poLog.length; })[0] || {}).poLog || [];   // ประวัติรับบิลของ PO
      b.recv = b.lines.reduce(function (t, l) { return t + (Number(l.recvQty) || 0); }, 0);
    });
    return out;
  }
  function editBill(id) {
    var b = billsOf(P.data.lines.filter(function (l) { return l.billId === id; }))[0];
    if (!b) return toast('ไม่พบบิลนี้');
    var v = vendorOf(b.vendor);
    P.cur = Object.assign(newBill(b.kind), { billId: b.billId, category: b.category, vendor: b.vendor, taxId: b.taxId, invNo: b.invNo, issueDate: b.issueDate, creditDays: b.creditDays, payRound: b.payRound,
      vatMode: b.vatMode || 'exc', pct: b.pct, note: b.note, bank: v ? v.bank || '' : '', keepFiles: b.files, autoRound: false, poRef: b.poRef, log: b.log,
      lines: b.lines.map(function (l) { return { desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0, disc: Number(l.disc) || 0, recv: Number(l.recvQty) || 0 }; }) });
    var pg = b.kind === 'po' ? 'a_appo' : 'a_apin';
    if (state.page !== pg && !(state.page === 'a_appo' && pg === 'a_apin')) go(pg); else form();
  }
  P.editBill = editBill;
  // PO ล่วงหน้า → รับบิล (ครบ หรือบางส่วน — ผู้ใช้ขอ 23/11/69): บิลจริงเป็นบิลใหม่ · แต่ละรายการเลือกว่าหักจาก PO บรรทัดไหน
  // จำนวนในบิลหักออกจาก PO · ยอดเงินรวมของบิลบันทึกเป็นประวัติ · PO ที่ยังเหลือเก็บไว้รอบิลถัดไปจนครบ (apReceivePo)
  function receivePo(id) {
    var b = billsOf(P.data.lines.filter(function (l) { return l.billId === id; }))[0];
    if (!b) return toast('ไม่พบ PO นี้');
    var v = vendorOf(b.vendor);
    var pl = poCtx(id).lines;
    P.cur = Object.assign(newBill(), { billId: '', fromPo: b.billId, po: poCtx(id),
      category: b.category, vendor: b.vendor, taxId: (v && v.taxId) || '', issueDate: P.data.today, creditDays: vCredit(v) != null ? vCredit(v) : '',
      vatMode: b.vatMode || 'exc', pct: b.pct, note: '', bank: v ? v.bank || '' : '', autoRound: true, payRound: '',
      lines: pl.filter(function (l) { return l.qty > 0; }).map(function (l) { return { desc: l.desc, qty: l.qty, price: l.price, po: l.n }; }) });
    if (state.page !== 'a_appo') go('a_appo'); else form();
  }
  function poCtx(id) {
    var b = billsOf(P.data.lines.filter(function (l) { return l.billId === id && l.kind === 'po'; }))[0];
    if (!b) return null;
    return { id: id, lines: b.lines.map(function (l) { return { n: Number(l.lineNo), desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0, disc: Number(l.disc) || 0, recv: Number(l.recvQty) || 0 }; }),
      vatMode: b.vatMode || 'exc', pct: b.pct, log: b.log, pay: b.pay, total: b.total, vendor: b.vendor, round: b.payRound };
  }
  // นำเข้าบิลตามปกติ (ผู้ใช้ขอ 23/11/69): ตรวจ PO ล่วงหน้าที่รอบิลของบริษัทเดียวกัน (สแกนรวมหลายใบก็ตรวจทีละใบ)
  // พบ 1 PO → หักจาก PO นั้นให้เลย (กด "ไม่หักจาก PO" ได้) · พบหลาย PO → ให้เลือก
  function posOfVendor(name) {
    var v = vendorOf(name), k = loose(v ? v.name : name); if (!k) return [];
    return billsOf(P.data.lines.filter(function (l) { return l.kind === 'po'; })).filter(function (b) {
      var bv = vendorOf(b.vendor); return (v && bv && v.name === bv.name) || loose(b.vendor) === k; });
  }
  function linkPo(b, id, auto) {
    var c = poCtx(id); if (!c) return;
    b.fromPo = id; b.po = c; b.autoPo = !!auto; b.noPo = false;
    b.lines.forEach(function (l) { delete l.po; delete l.dup; delete l.dupSet; });
    if (!b.lines.some(function (l) { return String(l.desc).trim() || l.price; })) b.lines = c.lines.filter(function (p) { return p.qty > 0; }).map(function (p) { return { desc: p.desc, qty: p.qty, price: p.price, po: p.n }; });
  }
  function unlinkPo(b) { b.fromPo = ''; b.po = null; b.noPo = true; b.lines.forEach(function (l) { delete l.po; l.dup = false; delete l.dupSet; }); }
  function poCheck(b) {
    if (b.kind === 'po' || b.billId || b.fromPo || b.noPo) return;
    var list = posOfVendor(b.vendor);
    if (list.length === 1) linkPo(b, list[0].billId, true);
  }
  function poChoose(b) {
    if (b.kind === 'po' || b.billId || b.fromPo) return '';
    var list = posOfVendor(b.vendor); if (!list.length) return '';
    return '<div class="appoban info apchoose">' + icon('clock', 18) + '<div><span>พบ <b>PO ล่วงหน้า (รอบิล)</b> ของ ' + esc(list[0].vendor) + ' ' + list.length + ' ใบ — บิลนี้หักจาก PO ไหน?</span><div class="apbtns">'
      + list.map(function (x) { return '<button type="button" class="btn apsm" data-lpo="' + esc(x.billId) + '">รอบจ่าย ' + dotAD(x.payRound, true) + ' · ค้าง ' + m2(x.pay) + '<small>' + esc(x.lines.filter(function (l) { return Number(l.qty) > 0; }).map(function (l) { return l.desc; }).slice(0, 3).join(', ')) + '</small></button>'; }).join('')
      + '</div></div></div>';
  }
  // จับคู่รายการในบิลกับบรรทัดใน PO (ชื่อคล้ายกัน) · รายการที่ยังไม่ได้จับคู่เท่านั้น (ผู้ใช้เลือกเองแล้วไม่ทับ)
  function pairs(s) { var o = {}; for (var i = 0; i < s.length - 1; i++) o[s.substr(i, 2)] = 1; return o; }
  function sim(a, b) {
    if (!a || !b) return 0; if (a === b) return 1; if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 0.9;
    var x = pairs(a), y = pairs(b), n = 0, kx = Object.keys(x), ky = Object.keys(y);
    kx.forEach(function (k) { if (y[k]) n++; });
    return kx.length + ky.length ? 2 * n / (kx.length + ky.length) : 0;
  }
  function poAuto(b) {
    var pl = b.po.lines.filter(function (p) { return p.qty > 0; });
    var fresh = b.lines.filter(function (l) { return l.po === undefined && (String(l.desc).trim() || l.qty > 1 || l.price); });   // บรรทัดเพิ่มเองที่ยังว่าง รอพิมพ์ก่อน
    fresh.forEach(function (l) {
      var k = loose(l.desc), toks = String(l.desc || '').split(/[\s\d\-_()\/.,:;#*+]+/).map(loose).filter(function (t) { return t.length >= 2; }), best = 0, bs = 0;
      pl.forEach(function (p) {
        var pk = loose(p.desc), sc = sim(k, pk);
        if (toks.some(function (t) { return pk.indexOf(t) >= 0; })) sc = Math.max(sc, 0.6);   // มีคำเดียวกัน เช่น "กระป๋อง" / "ฝา"
        if (sc > bs) { bs = sc; best = p.n; }
      });
      var v = bs >= 0.5 ? best : pl.length === 1 ? pl[0].n : 0;
      if (v || l.qty > 1) l.po = v;   // ยังไม่มีจำนวน → รอจับคู่ตามจำนวนทีหลัง
    });
    // ชุดเดียวกัน: บรรทัดที่ยังไม่ได้จับคู่ แต่จำนวนเท่ากับบรรทัดที่จับคู่แล้ว → หัก PO บรรทัดเดียวกัน
    fresh.forEach(function (l) {
      if (l.po || !(l.qty > 1)) return;
      var m = b.lines.filter(function (o) { return o !== l && o.po && q0(o.qty) === q0(l.qty); })[0];
      if (m) l.po = m.po;
    });
    dupAuto(b);
  }
  // รายการซ้ำ (ผู้ใช้ขอ 23/11/69): สินค้าเดียวกัน (บรรทัด PO เดียวกัน หรือชื่อเดียวกัน) + จำนวนเท่ากัน = ยอดเดียวกัน → นับครั้งเดียว
  // เช่น แนบทั้งใบกำกับภาษีและใบส่งของ · ผู้ใช้กด "นับด้วย" / "ไม่นับ" เองได้ (dupSet)
  // ซ้ำจริง = ชื่อ + จำนวน + ราคาเท่ากัน (เช่น ใบกำกับ + ใบส่งของ) → ไม่นับเลย · ผู้ใช้กดเปลี่ยนเองได้ (dupSet)
  // ชุดเดียวกัน (ผู้ใช้ขอ 23/11/69) = หัก PO บรรทัดเดียวกัน + จำนวนเท่ากัน แต่คนละสินค้า (เช่น กระป๋อง + ฝา) → ยอดเงินนับทุกบรรทัด จำนวนหักครั้งเดียว
  function dupAuto(b) {
    var seen = {};
    b.lines.forEach(function (l) {
      if (!String(l.desc).trim() && !l.qty) return;
      var k = loose(l.desc) + '|' + q0(l.qty) + '|' + q0(l.price);
      if (!l.dupSet) l.dup = !!seen[k];
      if (!l.dup) seen[k] = 1;
    });
  }
  // รวมรายการในบิลตามบรรทัด PO: จำนวน = ผลรวมของจำนวนที่ไม่ซ้ำกัน (จำนวนเท่ากัน = ชุดเดียวกัน นับครั้งเดียว) · มูลค่า / VAT / รวม = ผลรวมทุกบรรทัด
  function poGroups(b) {
    var g = {};
    counted(b).forEach(function (l, i) {
      if (!l.po) return;
      var x = g[l.po] = g[l.po] || { n: l.po, qs: {}, q: 0, amount: 0, disc: 0, vat: 0, total: 0, wht: 0, rows: 0 };
      var c = calc(l, b.vatMode, b.pct), qk = q0(l.qty);
      if (!x.qs[qk]) { x.qs[qk] = 1; x.q += Number(l.qty) || 0; }
      x.amount += r2(c.amount - c.disc); x.disc += c.disc; x.vat += c.vat; x.total += c.total; x.wht += c.wht; x.rows++;
    });
    Object.keys(g).forEach(function (k) { var x = g[k]; x.unit = x.q ? x.amount / x.q : 0; });
    return g;
  }
  // PO หลังหักบิลนี้ (เหมือน apDeductPo_ หลังบ้าน): จำนวนคงเหลือ = PO − จำนวนในบิล · มูลค่าคงเหลือ = มูลค่า PO − มูลค่าในบิล
  // มูลค่าในบิลเกิน PO หรือจำนวนครบ = บรรทัดนี้ใช้หมด (ใช้ยอดตามบิลทั้งหมด)
  function poAfter(p, x, po) {
    var pc = calc({ qty: p.qty, price: p.price, disc: p.disc }, po.vatMode, po.pct), amt = r2(pc.amount - pc.disc);
    if (!x) return { amt: amt, q: p.qty, ra: amt, done: p.qty <= 0, over: 0 };
    var rq = Math.max(0, Math.round((p.qty - x.q) * 10000) / 10000), ra = Math.max(0, r2(amt - x.amount));
    var done = rq <= 0 || ra <= 0.005;
    return { amt: amt, q: done ? 0 : rq, ra: done ? 0 : ra, done: done, over: x.amount - amt > 0.005 ? r2(x.amount - amt) : 0, short: rq <= 0 && ra > 0.005 ? ra : 0 };
  }
  function counted(b) { return b.lines.filter(function (l) { return !l.dup && (String(l.desc).trim() || l.qty || l.price); }); }
  // สรุปการหัก PO ใต้ตาราง: แต่ละบรรทัด PO สั่ง / รับแล้ว / บิลนี้ / คงเหลือ + ยอดเงิน + ประวัติบิลก่อนหน้า
  function poSum() {
    var b = P.cur, el = $('apPoSum'); if (!el || !b.fromPo) return;
    var po = b.po, use = counted(b), G = poGroups(b), before = 0, after = 0, billPo = 0, other = 0, over = [], left = 0, short = [];
    var rows = po.lines.map(function (p) {
      var x = G[p.n], a = poAfter(p, x, po);
      before += a.amt; after += a.ra;
      if (a.over) over.push(p.desc + ' เกิน ' + m2(a.over));
      if (a.short) short.push(p.desc);
      if (!a.done) left++;
      var unit = function (q, v) { return q ? '<small>@ ' + m2(v / q) + '/หน่วย</small>' : ''; };
      return '<tr' + (p.qty <= 0 ? ' class="apdone"' : '') + '><td>' + p.n + '. ' + esc(p.desc || '-') + (p.recv ? '<small>รับบิลไปแล้ว ' + q0(p.recv) + '</small>' : '') + '</td>'
        + '<td>' + q0(p.qty) + '<small>' + m2(a.amt) + '</small>' + unit(p.qty, a.amt) + '</td>'
        + '<td class="apthis">' + (x ? '−' + q0(x.q) + '<small>−' + m2(x.amount) + '</small>' + unit(x.q, x.amount) + (x.rows > 1 ? '<small>' + x.rows + ' บรรทัดรวมกัน</small>' : '') : '-') + '</td>'
        + '<td><b>' + (a.done ? '✓ หมด' : q0(a.q)) + '</b>' + (a.done ? '' : '<small>' + m2(a.ra) + '</small>' + unit(a.q, a.ra)) + '</td></tr>';
    }).join('');
    use.forEach(function (l) { var t = calc(l, b.vatMode, b.pct).amount; if (l.po) billPo += t; else other += t; });
    var dups = b.lines.filter(function (l) { return l.dup; }).length;
    el.innerHTML = '<div class="appos"><h4>' + icon('clock', 18) + ' หักจาก PO ล่วงหน้า</h4>'
      + '<div class="cpwrap"><table class="apposT"><thead><tr><th>สินค้าใน PO</th><th>PO คงค้าง</th><th>บิลนี้</th><th>PO คงเหลือ</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<p class="apnote">แต่ละช่อง: จำนวน · มูลค่ารายการ (ก่อน VAT) บาท · ราคา/หน่วย — หักยอดเงินของบิลออกจากยอด PO · ถ้ายอดบิลเกินยอด PO ใช้ยอดตามบิลทั้งหมด PO รายการนั้นหมด</p>'
      + '<div class="apsum"><span>PO คงค้าง (ก่อน VAT)<b>' + m2(before) + '</b></span><span class="apred">หักตามบิลนี้<b>−' + m2(billPo) + '</b></span><span class="appay">PO คงเหลือหลังบันทึก (ก่อน VAT)<b>' + m2(after) + '</b></span></div>'
      + (short.length ? '<p class="apnote">' + esc(short.join(', ')) + ' — จำนวนครบแล้วแต่ยอดเงินยังเหลือ (บิลถูกกว่า PO) → PO รายการนี้ปิดตามจำนวน</p>' : '')
      + (other ? '<p class="apnote">รายการที่ไม่ได้หักจาก PO รวม ' + m2(other) + ' — ยังอยู่ในบิลนี้ตามปกติ</p>' : '')
      + (dups ? '<p class="apnote">' + dups + ' บรรทัดซ้ำ (ชื่อ จำนวน ราคาเท่ากัน) — ไม่นับ ไม่บันทึกซ้ำในบิล</p>' : '')
      + (over.length ? '<p class="apwarn">⚠ ยอดบิลเกินยอด PO: ' + esc(over.join(', ')) + ' บาท — ใช้ยอดตามบิลทั้งหมด PO รายการนั้นหมด</p>' : '')
      + '<div class="appost ' + (left ? 'part' : 'full') + '">' + (left ? '⏳ หลังบันทึก PO ยังค้าง <b>' + left + ' รายการ</b> — เก็บไว้รอบิลถัดไป' : '✓ หลังบันทึก PO นี้<b>รับครบ</b> — ย้ายไป "รับครบแล้ว"') + '</div>'
      + (po.log && po.log.length ? '<details class="apolog"><summary>ประวัติรับบิลของ PO นี้ ' + po.log.length + ' ใบ · หักแล้ว ' + m2(po.log.reduce(function (t, e) { return t + (Number(e.total) || 0); }, 0)) + '</summary>' + logRows(po.log) + '</details>' : '')
      + '</div>';
  }
  function logRows(log) {
    return log.map(function (e) {
      return '<div class="apolr"><span>' + slash(e.date || String(e.at || '').slice(0, 10)) + (e.invNo ? ' · เลขที่ ' + esc(e.invNo) : '') + '<small>' + (e.lines || []).map(function (x) { return esc(x.desc || '') + ' ' + q0(x.q) + (x.a ? ' = ' + m2(x.a) : ''); }).join(' · ') + '</small></span><b>' + m2(e.total) + '</b></div>';
    }).join('');
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
      putDisc(b, r.disc);
      form();
      if (r.lines.length && b.fromPo) toast('ใช้รายการจากบิลจริงแทนรายการใน PO แล้ว — ตรวจอีกครั้ง');
    }).catch(function (e) { msg(esc(e.message || e), 'bad'); });
  }

  // ==================== อ่านบิลด้วย AI (ผู้ใช้ขอ 20/11/69) ====================
  // กดเมื่ออ่านแบบปกติแล้วข้อมูลไม่ครบ / ไม่ถูก · ส่งภาพหน้าบิลไป AccPayAi.gs → Claude · คิดเงินตามครั้งที่อ่าน
  var USD_THB = 34;   // อัตราโดยประมาณ ใช้แสดงค่าใช้จ่ายคร่าว ๆ เท่านั้น
  function baht(usd) { var t = usd * USD_THB; return t < 1 ? 'ไม่ถึง 1 บาท' : 'ประมาณ ' + (t < 10 ? t.toFixed(1) : Math.round(t)) + ' บาท'; }
  function aiBox(b) {
    var r = b.read || {}, weak = !r.invNo || !(r.lines || []).length || !r.vendor;
    if (b.ai) return '<div class="apai done"><b>✨ อ่านด้วย AI แล้ว</b><small>ครั้งนี้ใช้ ' + baht(b.ai.usd) + (b.ai.note ? ' · ' + esc(b.ai.note) : '') + (aiCheck(b) ? '<br><span class="apwarn">' + esc(aiCheck(b)) + '</span>' : '') + '</small><button type="button" class="btn apsm" id="apAi">อ่านด้วย AI อีกครั้ง</button></div>';
    return '<div class="apai' + (weak ? ' weak' : '') + '"><div><b>' + (weak ? 'ข้อมูลไม่ครบ? ' : '') + 'ให้ AI อ่านบิลนี้</b><small>' + (P.data.ai && P.data.ai.set ? 'แม่นยำกว่าการอ่านแบบปกติ · คิดเงินตามครั้งที่กด ประมาณ 1–3 บาทต่อบิล' : 'ต้องตั้งค่าคีย์ AI ก่อน (หน้า ผู้ขาย / ตั้งค่า)') + '</small></div>'
      + '<button type="button" class="btn ' + (weak ? 'btn-primary' : '') + ' apsm" id="apAi">✨ อ่านด้วย AI</button></div>';
  }
  // ตรวจยอดรวมรายการกับยอดในบิล — ไม่นับรายการซ้ำ (เช่น ใบกำกับ + ใบส่งของ)
  function aiCheck(b) {
    var a = b.ai; if (!a) return '';
    if (a.off == null) return a.check || '';
    if (a.off) return a.off + ' รายการ จำนวน × ราคา ไม่เท่าจำนวนเงินในบิล — ตรวจอีกครั้ง';
    var sum = b.lines.filter(function (l) { return !l.dup; }).reduce(function (t, l) { return t + (Number(l.qty) || 0) * (Number(l.price) || 0); }, 0);
    var dsc = b.lines.reduce(function (t, l) { return t + (Number(l.disc) || 0); }, 0);
    return a.sub && Math.abs(sum - a.sub) > 1 && Math.abs(sum - dsc - a.sub) > 1 && (!a.total || Math.abs(sum - a.total) > 1) ? 'ยอดรวมรายการ ' + m2(sum) + ' ไม่ตรงกับยอดในบิล ' + m2(a.sub) + ' — อาจขาดบางรายการ' : '';
  }
  function smallJpeg(src) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      im.onerror = function () { ok(''); };
      im.src = src;
    });
  }
  function aiRead() {
    var b = P.cur, btn = $('apAi');
    if (!P.data.ai || !P.data.ai.set) return ask({ title: 'ยังไม่ได้ตั้งค่าคีย์ AI', text: 'วางคีย์ (API key) ที่หน้า "ผู้ขาย / ตั้งค่า (จ่าย)" ก่อน แล้วกลับมากดอ่านอีกครั้ง', ok: 'ไปหน้าตั้งค่า', cancel: 'ไว้ก่อน', tone: 'info' }).then(function (y) { if (y) go('a_apv'); });
    var keep = collect();
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> AI กำลังอ่าน… (10–40 วินาที)';
    Promise.all(b.pages.slice(0, 6).map(function (p) { return smallJpeg(p.src); })).then(function (imgs) {
      imgs = imgs.filter(Boolean).map(function (x) { return { b64: x }; });
      return call('apAiRead', state.token, imgs, (P.data.vendors || []).map(function (v) { return v.name; }));
    }).then(function (r) {
      if (r.ai) P.data.ai = r.ai;
      if (!r.ok) { btn.disabled = false; btn.textContent = '✨ อ่านด้วย AI'; if (r.needKey) P.data.ai = Object.assign({}, P.data.ai, { set: false }); return toast(r.error); }
      var x = r.bill, vs = P.data.vendors || [];
      var v = (x.taxId && vs.filter(function (y) { return String(y.taxId || '') === x.taxId; })[0]) || vendorOf(x.vendor);
      Object.assign(b, keep);
      b.vendor = v ? v.name : (x.vendor || b.vendor);
      b.taxId = x.taxId || (v && v.taxId) || b.taxId;
      if (x.invNo) b.invNo = x.invNo;
      if (x.issueDate) b.issueDate = x.issueDate;
      if (vCredit(v) != null) b.creditDays = vCredit(v); else if (x.creditDays >= 0) b.creditDays = x.creditDays;
      if (v) { if (!b.category) b.category = v.category || ''; if (!b.pct) b.pct = Number(v.pct) || 0; b.bank = v.bank || b.bank; }
      if (x.vatMode) b.vatMode = x.vatMode; else if (v && v.vatMode) b.vatMode = v.vatMode;
      if ((x.lines || []).length) b.lines = x.lines.map(function (l) { return { desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0 }; });
      putDisc(b, x.discount);
      // ตรวจผลรวม: จำนวน × ราคา และยอดรวมรายการ เทียบกับยอดในบิล
      var check = '', sum = (x.lines || []).reduce(function (s2, l) { return s2 + (Number(l.amount) || 0); }, 0);
      var off = (x.lines || []).filter(function (l) { return Math.abs((Number(l.qty) || 0) * (Number(l.price) || 0) - (Number(l.amount) || 0)) > 1; }).length;
      if (off) check = off + ' รายการ จำนวน × ราคา ไม่เท่าจำนวนเงินในบิล — ตรวจอีกครั้ง';
      else if (x.subtotal && Math.abs(sum - x.subtotal) > 1 && (!x.total || Math.abs(sum - x.total) > 1)) check = 'ยอดรวมรายการ ' + m2(sum) + ' ไม่ตรงกับยอดในบิล ' + m2(x.subtotal || x.total) + ' — อาจขาดบางรายการ';
      b.ai = { usd: r.usd || 0, note: x.note || '', check: check, off: off, sub: x.subtotal || 0, total: x.total || 0 };
      b.read = Object.assign({}, b.read || {}, { vendor: x.vendor, invNo: x.invNo, lines: b.lines, sub: x.subtotal || null, vat: x.vat || null, grand: x.total || null });   // คำเตือนยอดรวมเทียบกับที่ AI อ่าน
      b.autoRound = true; b.payRound = '';
      form();
      toast('✨ AI อ่านบิลแล้ว · ครั้งนี้ ' + baht(r.usd || 0) + ' — ตรวจกับภาพก่อนบันทึก');
    }).catch(function (e) { btn.disabled = false; btn.textContent = '✨ อ่านด้วย AI'; onServerError(e); });
  }
  // เก็บค่าที่ผู้ใช้เลือกในฟอร์มไว้ก่อนอ่านใหม่ (หมวด / % / หมายเหตุ)
  function collect() {
    var o = {}, c = $('main').querySelector('input[name=apCat]:checked'), pc = $('main').querySelector('input[name=apPct]:checked');
    if (c) o.category = c.value;
    if (pc) o.pct = Number(pc.value) || 0;
    if ($('apPctX') && $('apPctX').value.trim()) o.pct = Number($('apPctX').value) || 0;
    return o;
  }
  function aiPanel() {
    var a = P.data.ai || { set: false, usage: [] };
    return '<div class="panel pbox"><h4>✨ อ่านบิลด้วย AI</h4>'
      + '<p class="muted">ปุ่ม "อ่านด้วย AI" ในหน้าตรวจข้อมูลบิล ใช้เมื่ออ่านแบบปกติแล้วข้อมูลไม่ครบหรือไม่ถูก · ใช้ Claude ของ Anthropic · <b>คิดเงินตามครั้งที่กดอ่าน</b> (ไม่มีค่ารายเดือน): บิล 1 หน้าประมาณ $0.02–0.08 (ราว 1–3 บาท) ขึ้นกับจำนวนหน้าและรายการ · จ่ายผ่านบัญชี Anthropic ที่ผูกบัตรไว้ (เติมเงินล่วงหน้าได้ และตั้งวงเงินสูงสุดต่อเดือนได้ที่ console.anthropic.com)</p>'
      + '<div class="panel status ' + (a.set ? 'on' : 'off') + ' cpst"><div class="dot">' + icon(a.set ? 'check' : 'warn', 20) + '</div><div><b>' + (a.set ? 'ตั้งค่าคีย์แล้ว — ใช้งานได้' : 'ยังไม่ได้ตั้งค่าคีย์') + '</b><span>' + (a.set ? 'คีย์เก็บไว้ในระบบหลังบ้าน ไม่แสดงในหน้าเว็บ' : 'สมัคร / เข้าสู่ระบบที่ console.anthropic.com → API Keys → Create Key แล้วคัดลอกมาวางด้านล่าง') + '</span></div></div>'
      + '<div class="cplink"><input id="apAiKey" type="password" autocomplete="off" placeholder="' + (a.set ? 'วางคีย์ใหม่เพื่อเปลี่ยน (sk-ant-…)' : 'วางคีย์ sk-ant-…') + '"><button class="btn btn-primary" id="apAiSave">บันทึกคีย์</button>' + (a.set ? '<button class="btn apdel" id="apAiDel">ลบคีย์</button>' : '') + '</div>'
      + (a.usage && a.usage.length ? '<p class="muted" style="margin-top:8px">การใช้งาน: ' + a.usage.map(function (u) { return monthTh(u.ym) + ' ' + u.n + ' ครั้ง ≈ $' + u.usd.toFixed(2) + ' (' + baht(u.usd) + ')'; }).join(' · ') + '</p>' : '')
      + '</div>';
  }
  function monthTh(ym) { var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return M[+ym.slice(5, 7) - 1] + ' ' + String(+ym.slice(0, 4) + 543).slice(2); }
  function bindAiPanel() {
    var sv = $('apAiSave'), dl = $('apAiDel');
    if (sv) sv.addEventListener('click', function () {
      var k = $('apAiKey').value.trim(); if (!k) { $('apAiKey').focus(); return toast('วางคีย์ก่อน'); }
      sv.disabled = true; sv.innerHTML = '<span class="spinner"></span> กำลังตรวจคีย์…';
      call('apSetAiKey', state.token, k).then(function (r) { sv.disabled = false; sv.textContent = 'บันทึกคีย์'; if (!r.ok) return toast(r.error); P.data.ai = r.ai; toast('✓ บันทึกคีย์แล้ว ใช้ปุ่มอ่านด้วย AI ได้'); P.vendorPage(); }).catch(onServerError);
    });
    if (dl) dl.addEventListener('click', function () {
      ask({ title: 'ลบคีย์ AI?', text: 'ปุ่มอ่านด้วย AI จะใช้ไม่ได้จนกว่าจะวางคีย์ใหม่', ok: 'ลบคีย์', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (y) {
        if (y) call('apSetAiKey', state.token, '').then(function (r) { P.data.ai = r.ai; toast('ลบคีย์แล้ว'); P.vendorPage(); }).catch(onServerError);
      });
    });
  }

  function form() {
    var b = P.cur, d = P.data, r = b.read;
    poCheck(b);
    if (b.fromPo) poAuto(b);
    if (!b.payRound) b.payRound = roundFor(b.issueDate || P.data.today, b.creditDays);
    var rounds = d.rounds.filter(function (x) { return x.nominal.slice(8) === pad(d.settings.payDay) || x.nominal === b.payRound; });
    var vlist = '<datalist id="apVlist">' + (d.vendors || []).map(function (v) { return '<option value="' + esc(v.name) + '">'; }).join('') + '</datalist>';
    var po = b.kind === 'po';
    $('main').innerHTML = '<h3>' + (po ? (b.billId ? 'แก้ไข PO ล่วงหน้า' : 'เพิ่ม PO ล่วงหน้า') : b.fromPo && !b.autoPo ? 'รับบิลจาก PO ล่วงหน้า' : b.billId ? 'แก้ไขบิลค่าใช้จ่าย' : 'ตรวจข้อมูลบิล') + '</h3><p class="lead">'
      + (po ? 'สั่งซื้อแล้วแต่ยังไม่ได้รับบิล — กรอกชื่อสินค้า จำนวน ราคา · ในรายงานรอบจ่ายจะแสดงเป็นตัวแดงจนกว่าจะได้รับบิล'
        : b.fromPo ? 'ใส่เลขที่ใบกำกับ / วันที่ตามบิลจริง (หรือแนบภาพบิลให้ระบบอ่าน) แล้วบันทึก — PO นี้จะกลายเป็นบิลจริง ตัวแดงหายไป'
        : b.pages.length ? 'ตรวจข้อมูลที่ระบบอ่านได้กับภาพบิล แก้ช่องที่ผิด แล้วกดบันทึก' : 'กรอกข้อมูลบิล แล้วกดบันทึก') + '</p>'
      + (d.linked ? '' : linkPanel())
      + (P.queue && P.queue.indexOf(b) >= 0 ? '<div class="apqban">' + icon('pdf', 18) + ' ใบที่ <b>' + (P.qi + 1) + ' / ' + P.queue.length + '</b> จากไฟล์ ' + esc((b.pages[0] && b.pages[0].pdf) || '') + ' · หน้า ' + ((b.pages[0] && b.pages[0].pageNo) || '') + '</div>' : '')
      + (po ? '<div class="appoban">' + icon('clock', 18) + ' PO ล่วงหน้า · แสดงเป็น<b>ตัวแดง</b>ในรายงานรอบจ่าย</div>' : '')
      + (po && b.log && b.log.length ? '<div class="appoban info">' + icon('check', 18) + '<span>รับบิลไปแล้ว ' + b.log.length + ' ใบ — จำนวนในตารางคือ<b>จำนวนที่ยังค้าง</b></span></div>' : '')
      + (b.fromPo ? '<div class="appoban info">' + icon('clock', 18) + '<span>' + (b.autoPo ? 'พบ PO ล่วงหน้า (รอบิล) ของบริษัทนี้ — <b>หักจาก PO ให้แล้ว</b> · ' : '') + 'PO ของ <b>' + esc(b.po.vendor) + '</b> รอบจ่าย ' + dotAD(b.po.round, true) + ' · ค้างชำระ ' + m2(b.po.pay) + ' · บิลมาไม่ครบได้ — ระบบหักเฉพาะจำนวนในบิล ที่เหลือเก็บไว้รอบิลถัดไป</span><button type="button" class="btn apsm" id="apUnPo">ไม่หักจาก PO</button></div>' : poChoose(b))
      + (!po && !b.fromPo && b.poRef ? '<div class="appoban info">' + icon('clock', 18) + '<span>บิลนี้หักจาก PO ล่วงหน้าแล้ว — ถ้าจำนวนผิด ให้<b>ลบบิลนี้</b> (จำนวนจะคืนให้ PO) แล้วกดรับบิลใหม่</span></div>' : '')
      + '<div class="apform' + (b.pages.length || b.keepFiles.length ? '' : ' nofile') + (po ? ' ispo' : '') + '">'
      + (b.pages.length || b.keepFiles.length ? '<div class="apimgs">' + b.pages.map(function (p, i) { return '<figure><img src="' + p.src + '" alt="ภาพบิล" data-zoom="' + i + '">' + (p.file ? '<button type="button" class="btn apsm" data-rot="' + p.fi + '">↻ หมุนภาพแล้วอ่านใหม่</button>' : '') + '</figure>'; }).join('')
        + (!po && b.files && b.files.length ? '<label class="btn apsm apmore">' + icon('upload', 16) + ' + แนบไฟล์บิลเพิ่ม<input type="file" id="apAttachMore" accept="image/*,application/pdf" multiple hidden></label>' : '')
        + b.keepFiles.map(function (u, i) { return '<a class="btn apsm" href="' + esc(u) + '" target="_blank" rel="noopener">' + icon('pdf', 16) + ' ไฟล์บิลที่บันทึกไว้ ' + (b.keepFiles.length > 1 ? i + 1 : '') + '</a>'; }).join('')
        + (b.text && b.text.length ? '<details class="aptext"><summary>ข้อความที่อ่านได้</summary><pre>' + esc(b.text.join('\n')) + '</pre></details>' : '') + '</div>' : '')
      + '<div class="apfields">'
      + (!po && b.pages.length ? aiBox(b) : '')
      + (!po && !b.pages.length ? '<div class="apatt"><label class="btn apsm">' + icon('upload', 16) + ' ถ่ายรูป / แนบไฟล์บิล<input type="file" id="apAttach" accept="image/*,application/pdf" multiple hidden></label><small>' + (b.fromPo ? 'เลือกได้หลายไฟล์ (ใบกำกับ / ใบส่งของ / หลายหน้า) · ระบบอ่านรายการแล้วจับคู่กับ PO ให้' : 'ระบบอ่านเลขที่ใบกำกับ วันที่ และรายการให้') + '</small></div>' : '')
      + '<div class="aphl"><b>1. หมวดของ' + (po ? ' PO' : 'บิล') + 'นี้ <span class="req">*</span></b><div class="apchips" id="apCats">' + d.cats.map(function (c, i) {
          return '<label><input type="radio" name="apCat" value="' + c.key + '"' + (b.category === c.key ? ' checked' : '') + '><span>' + (i + 1) + '. ' + esc(c.name) + '</span></label>'; }).join('') + '</div></div>'
      + '<div class="aphl"><b>2. % หัก ณ ที่จ่าย</b> <small>หัก ณ ที่จ่าย = มูลค่ารายการ × % · เลือกที่นี่เท่านั้น · <b class="apred">ส่วนลด / มัดจำ</b> แยกต่างหาก — ระบบอ่านจากบิล (คำว่า "ส่วนลด" หรือยอดหักที่เกิน 5%) ลงช่อง "ส่วนลด/มัดจำ" ในตาราง แก้เป็นบาทได้</small><div class="apchips sm" id="apPcts">' + PCTS.map(function (p) {
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
      + '<div class="cpwrap"><table class="aptab' + (po ? ' po' : '') + '"><thead><tr><th>' + (po ? 'ชื่อสินค้า' : 'คำอธิบาย') + (b.fromPo ? ' / หักจาก PO' : '') + '</th><th>' + (po && b.log && b.log.length ? 'จำนวนค้าง' : 'จำนวน') + '</th><th>ราคา</th><th>มูลค่ารายการ</th><th class="apred">ส่วนลด/มัดจำ<small>บาท · ตามบิล</small></th><th>VAT<small>หลังหักส่วนลด</small></th><th>รวม</th><th class="apred">หัก ณ ที่จ่าย</th><th></th></tr></thead><tbody id="apLines"></tbody></table></div>'
      + '<button type="button" class="btn apsm" id="apAdd">+ เพิ่มรายการ</button>'
      + '<div id="apSum"></div><div id="apPoSum"></div>'
      + '<div class="apgrid"><label class="apwide">บัญชีธนาคารของผู้ขาย (แสดงที่แถวรวมในรายงาน)<input id="apBank" value="' + esc(b.bank) + '" placeholder="เช่น ธ.กสิกรไทย 123-4-56789-0 บริษัท …"></label>'
      + '<label class="apwide">หมายเหตุ<input id="apNote" value="' + esc(b.note) + '"></label></div>'
      + '<div id="apMsg"></div>'
      + '<div class="apbtns"><button class="btn btn-primary" id="apSave">' + icon('check', 18) + (po ? ' บันทึก PO ล่วงหน้า' : b.fromPo ? ' บันทึกบิล + หัก PO' : ' บันทึกบิล') + '</button>'
      + (po && b.billId ? '<button class="btn" id="apRecv">' + icon('check', 18) + ' รับบิล (ครบ / บางส่วน)</button>' : '')
      + (b.billId && !b.fromPo ? '<button class="btn apdel" id="apDel">' + icon('trash', 18) + (po ? ' ลบ PO' : ' ลบบิล') + '</button>' : '')
      + (P.queue && P.queue.indexOf(b) >= 0 && P.qi < P.queue.length - 1 ? '<button class="btn" id="apSkip">ข้ามใบนี้ →</button>' : '')
      + '<button class="btn" id="apBack">ยกเลิก</button></div>'
      + '</div></div>';
    bindLink();
    if ($('apUnPo')) $('apUnPo').addEventListener('click', function () { var keep = collect(); unlinkPo(b); Object.assign(b, keep); form(); toast('บิลนี้จะไม่หักจาก PO'); });
    on('[data-lpo]', 'click', function (el) { var keep = collect(); linkPo(b, el.getAttribute('data-lpo'), true); Object.assign(b, keep); form(); });
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
        if (vCredit(v) != null) $('apCredit').value = b.creditDays = vCredit(v);
        if (v.taxId && !$('apTax').value) $('apTax').value = b.taxId = v.taxId;
        if (v.bank) $('apBank').value = b.bank = v.bank;
        b.vatMode = v.vatMode || b.vatMode; b.pct = Number(v.pct) || 0;
        Array.prototype.forEach.call(document.querySelectorAll('input[name=apVat]'), function (x) { x.checked = x.value === b.vatMode; });
        Array.prototype.forEach.call(document.querySelectorAll('input[name=apPct]'), function (x) { x.checked = num(x.value) === b.pct; });
        $('apPctX').value = PCTS.indexOf(b.pct) < 0 ? b.pct : '';
        recalcLines();   // ไม่สร้างช่องใหม่ (ผู้ใช้อาจกำลังแตะช่องรายการอยู่)
      }
      if (!b.billId && b.kind !== 'po' && (b.autoPo || !b.fromPo)) {   // เปลี่ยนผู้ขาย → ตรวจ PO ล่วงหน้าของผู้ขายใหม่
        var have = posOfVendor(b.vendor), still = b.fromPo && have.some(function (x) { return x.billId === b.fromPo; });
        if (!still && (b.fromPo || have.length)) { var keep = collect(); if (b.fromPo) unlinkPo(b); b.noPo = false; Object.assign(b, keep); return form(); }
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
    if ($('apAi')) $('apAi').addEventListener('click', aiRead);
    if ($('apRecv')) $('apRecv').addEventListener('click', function () { receivePo(b.billId); });
    if ($('apAttach')) $('apAttach').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files); this.value = ''; if (fs.length) attach(fs); });
    if ($('apAttachMore')) $('apAttachMore').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files); this.value = ''; if (fs.length) attach((b.files || []).concat(fs)); });
    if ($('apDel')) $('apDel').addEventListener('click', function () {
      ask({ title: po ? 'ลบ PO ล่วงหน้านี้?' : 'ลบบิลนี้?', text: b.vendor + ' ' + (b.invNo || '') + (b.poRef ? ' — จำนวนในบิลนี้จะคืนให้ PO ล่วงหน้า' : po && b.log && b.log.length ? ' — บิลที่รับไปแล้ว ' + b.log.length + ' ใบยังอยู่' : ''), ok: po ? 'ลบ PO' : 'ลบบิล', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
        if (!yes) return;
        call('apDeleteBill', state.token, b.billId).then(function (r) { if (!r.ok) return toast(r.error); P.cur = null; toast(r.restored ? 'ลบบิลแล้ว — คืนจำนวนให้ PO ล่วงหน้าแล้ว' : 'ลบบิลแล้ว'); load().then(P.render); }).catch(onServerError);
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
        putDisc(b, r.disc);
        Object.assign(b, keep); form();
      }).catch(function (e) { toast(e.message || e); form(); });
    });
    vhint(); dupCheck();
  }
  function due() { var b = P.cur; return b.issueDate ? creditDue(b.issueDate, b.creditDays) : ''; }
  function refresh(dates) {
    var b = P.cur;
    $('apDue').value = due() ? slash(due()) : '';
    var ri = roundInfo(b.issueDate || P.data.today, b.creditDays), rh = $('apRoundHint');
    if (rh) rh.textContent = 'ครบเครดิต ' + slash(ri.due) + ' (เครดิต ' + (Number(b.creditDays) || 0) + ' วัน · ' + (+ri.due.slice(8) <= ri.cut ? 'ครบไม่เกินวันที่ ' + ri.cut + ' → จ่ายเดือนนั้น' : 'ครบหลังวันที่ ' + ri.cut + ' → จ่ายเดือนถัดไป') + ') → จ่าย ' + dotAD(ri.round, true) + (b.payRound && b.payRound !== ri.round ? ' (เลือกรอบอื่นไว้)' : '');
    if (dates && b.autoRound) { b.payRound = ri.round; var s = $('apRound'); if (s && s.querySelector('option[value="' + b.payRound + '"]')) s.value = b.payRound; }
    var t = { amount: 0, disc: 0, vat: 0, total: 0, wht: 0 };
    b.lines.forEach(function (l) { if (l.dup) return; var c = calc(l, b.vatMode, b.pct); t.amount += c.amount; t.disc += c.disc; t.vat += c.vat; t.total += c.total; t.wht += c.wht; });
    var pay = r2(t.total - t.wht), r = b.read, checks = '';
    poSum();
    if (r) {
      var bill = r.grand != null ? r.grand : null;
      if (bill != null) checks += chk(Math.abs(bill - t.total) < 0.06 ? true : 'warn', 'ยอดรวมท้ายบิลที่อ่านได้ ' + m2(bill) + (Math.abs(bill - t.total) < 0.06 ? ' ตรงกับรวมในตาราง' : ' — ในตารางรวม ' + m2(t.total) + ' ตรวจรายการ / ราคา / แบบ VAT อีกครั้ง'));
      if (r.vat != null && b.vatMode !== 'none') checks += chk(Math.abs(r.vat - t.vat) < 0.06 ? true : 'warn', 'VAT ท้ายบิล ' + m2(r.vat) + (Math.abs(r.vat - t.vat) < 0.06 ? ' ตรงกัน' : ' — ในตาราง ' + m2(t.vat)));
      if (!r.lines.length) checks += chk('warn', 'อ่านรายการสินค้าจากภาพไม่ได้ — พิมพ์รายการเองตามภาพ');
      if (!b.invNo) checks += chk('warn', 'อ่านเลขที่ใบกำกับจากภาพไม่ได้ — พิมพ์เองตามภาพ (กด "ข้อความที่อ่านได้" ใต้ภาพเพื่อดูว่าระบบอ่านได้อะไร)');
      if (!vendorOf(b.vendor)) checks += chk('warn', 'ผู้ขายใหม่ — ระบบจะจำ หมวด เครดิต แบบ VAT % และบัญชีธนาคารไว้ใช้ครั้งต่อไป');
    }
    $('apSum').innerHTML = '<div class="apsum"><span>มูลค่ารายการ<b>' + m2(t.amount) + '</b></span>' + (t.disc ? '<span class="apred">ส่วนลด/มัดจำ<b>−' + m2(t.disc) + '</b></span>' : '') + '<span>VAT<b>' + m2(t.vat) + '</b></span><span>รวม<b>' + m2(t.total) + '</b></span><span class="apred">หัก ' + (b.pct || 0) + '%<b>' + m2(t.wht) + '</b></span><span class="appay">ชำระ<b>' + m2(pay) + '</b></span></div>' + (checks ? '<div class="a7checks">' + checks + '</div>' : '');
  }
  function drawLines() {
    var b = P.cur;
    var G = b.fromPo ? poGroups(b) : {}, lastOf = {};
    b.lines.forEach(function (l, i) { if (b.fromPo && !l.dup && l.po && G[l.po] && G[l.po].rows > 1) lastOf[l.po] = i; });
    $('apLines').innerHTML = b.lines.map(function (l, i) {
      var c = calc(l, b.vatMode, b.pct);
      var set = b.fromPo && !l.dup && l.po && G[l.po] && G[l.po].rows > 1;
      var map = b.fromPo ? '<div class="apmap"><select data-po="' + i + '" aria-label="หักจาก PO บรรทัด"><option value="0">— ไม่หักจาก PO —</option>' + b.po.lines.map(function (p) {
          return '<option value="' + p.n + '"' + (l.po === p.n ? ' selected' : '') + (p.qty <= 0 && l.po !== p.n ? ' disabled' : '') + '>หัก PO: ' + p.n + '. ' + esc(p.desc || '-') + ' (ค้าง ' + q0(p.qty) + ')</option>'; }).join('') + '</select>'
        + (l.dup || l.dupSet ? '<button type="button" class="apdupb' + (l.dup ? ' on' : '') + '" data-dup="' + i + '">' + (l.dup ? 'ซ้ำ · ไม่นับ — กดเพื่อนับด้วย' : 'นับรายการนี้ด้วย — กดถ้าซ้ำ') + '</button>' : '') + '</div>' : '';
      return '<tr data-row="' + i + '"' + (l.dup ? ' class="apdupl"' : set ? ' class="apset"' : '') + '><td><input data-i="' + i + '" data-k="desc" value="' + esc(l.desc) + '">' + map + '</td><td><input class="apn" data-i="' + i + '" data-k="qty" inputmode="decimal" value="' + esc(l.qty) + '"></td><td><input class="apn" data-i="' + i + '" data-k="price" inputmode="decimal" value="' + esc(l.price) + '"></td>'
        + '<td class="apv" data-c="amount">' + m2(c.amount) + '</td><td><input class="apn apdisc" data-i="' + i + '" data-k="disc" inputmode="decimal" value="' + (c.disc ? esc(l.disc) : '') + '" placeholder="0" aria-label="ส่วนลด/มัดจำ"></td><td class="apv" data-c="vat">' + m2(c.vat) + '</td><td class="apv" data-c="total">' + m2(c.total) + '</td><td class="apv apred" data-c="wht">' + m2(c.wht) + '</td>'
        + '<td>' + (b.lines.length > 1 ? '<button type="button" class="apx" data-del="' + i + '" aria-label="ลบรายการ">✕</button>' : '') + '</td></tr>'
        + (lastOf[l.po] === i ? '<tr class="apgrp" data-grp="' + l.po + '">' + grpCells(G[l.po], b) + '</tr>' : '');
    }).join('');
    on('#apLines input', 'input', function (el) {
      var i = +el.getAttribute('data-i'), k = el.getAttribute('data-k'), l = b.lines[i];
      l[k] = k === 'desc' ? el.value : num(el.value);
      discOf(l, b);
      var c = calc(l, b.vatMode, b.pct), tr = el.closest('tr');
      ['amount', 'vat', 'total', 'wht'].forEach(function (f) { tr.querySelector('[data-c=' + f + ']').textContent = m2(c[f]); });
      updGroups(); refresh();
    });
    on('[data-del]', 'click', function (el) { b.lines.splice(+el.getAttribute('data-del'), 1); drawLines(); refresh(); });
    if (!b.fromPo) return;
    on('[data-po]', 'change', function (el) { b.lines[+el.getAttribute('data-po')].po = +el.value; dupAuto(b); drawLines(); refresh(); });
    on('[data-dup]', 'click', function (el) { var l = b.lines[+el.getAttribute('data-dup')]; l.dup = !l.dup; l.dupSet = true; drawLines(); refresh(); });
    on('#apLines input[data-k=qty], #apLines input[data-k=desc], #apLines input[data-k=price]', 'change', function () { var sig = function () { return b.lines.map(function (l) { return l.dup; }).join() + JSON.stringify(Object.keys(poGroups(b)).map(function (k) { return poGroups(b)[k].rows; })); }, pos = function () { return b.lines.map(function (l) { return l.po || 0; }).join(); }, was = sig() + pos(); poAuto(b); if (sig() + pos() !== was) setTimeout(function () { redrawKeep(); }, 0); });
  }
  // วาดตารางใหม่แต่คงช่องที่ผู้ใช้กำลังพิมพ์ไว้ (เปลี่ยนช่องแล้วตารางจัดกลุ่มใหม่ ไม่ให้เคอร์เซอร์หาย)
  function redrawKeep() {
    var a = document.activeElement, i = a && a.getAttribute && a.getAttribute('data-i'), k = a && a.getAttribute && a.getAttribute('data-k');
    drawLines(); refresh();
    if (i != null && k) { var el = $('apLines').querySelector('input[data-i="' + i + '"][data-k="' + k + '"]'); if (el) { el.focus(); try { el.select(); } catch (e) {} } }
  }
  function recalcLines() {
    var b = P.cur;
    Array.prototype.forEach.call($('apLines').querySelectorAll('tr[data-row]'), function (tr) {
      var l = b.lines[+tr.getAttribute('data-row')]; if (!l) return;
      discOf(l, b);
      var c = calc(l, b.vatMode, b.pct);
      ['amount', 'vat', 'total', 'wht'].forEach(function (f) { var el = tr.querySelector('[data-c=' + f + ']'); if (el) el.textContent = m2(c[f]); });
    });
    updGroups();
  }
  // แถว "รวมหัก PO" ใต้กลุ่มบรรทัดที่หัก PO บรรทัดเดียวกัน (ผู้ใช้ขอ 23/11/69): จำนวน (นับครั้งเดียวถ้าเท่ากัน) · ราคา/หน่วยรวม = มูลค่ารวม ÷ จำนวน · มูลค่า / VAT / รวม / หัก
  // ส่วนลด/มัดจำ พิมพ์เป็น % ได้ (เช่น 5%) → คิดเป็นบาทจากมูลค่ารายการ
  function discOf(l, b) { if (l.discPct != null) l.disc = r2(calc({ qty: l.qty, price: l.price }, b.vatMode, 0).amount * l.discPct / 100); }
  function grpCells(x, b) {
    var p = b.po.lines.filter(function (y) { return y.n === x.n; })[0] || {};
    return '<td>รวมหัก PO ' + x.n + '. ' + esc(p.desc || '') + '<small>' + x.rows + ' บรรทัด · จำนวนเท่ากันนับครั้งเดียว</small></td><td class="apv">' + q0(x.q) + '</td><td class="apv">' + m2(x.unit) + '</td>'
      + '<td class="apv">' + m2(x.amount + x.disc) + '</td><td class="apv apred">' + (x.disc ? '−' + m2(x.disc) : '') + '</td><td class="apv">' + m2(x.vat) + '</td><td class="apv">' + m2(x.total) + '</td><td class="apv apred">' + m2(x.wht) + '</td><td></td>';
  }
  function updGroups() {
    var b = P.cur; if (!b.fromPo) return;
    var G = poGroups(b);
    Array.prototype.forEach.call($('apLines').querySelectorAll('tr.apgrp'), function (tr) { var x = G[tr.getAttribute('data-grp')]; if (x) tr.innerHTML = grpCells(x, b); });
  }
  function vhint() { var el = $('apVhint'); if (!el) return; var v = vendorOf(P.cur.vendor); el.innerHTML = v ? '✓ ผู้ขายในระบบ · ' + esc(cat(v.category).name) + (vCredit(v) != null ? ' · เครดิต ' + vCredit(v) + ' วัน' : ' · <span class="apwarn">ยังไม่ได้ตั้งเครดิต (ตั้งได้ที่หน้า ผู้ขาย / ตั้งค่า)</span>') : (P.cur.vendor ? 'ผู้ขายใหม่' : ''); el.className = v ? 'apok' : 'apwarn'; }
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
    var lines = b.fromPo ? counted(b) : b.lines.filter(function (l) { return String(l.desc).trim() || l.qty || l.price; });
    if (!lines.length) { toast('ไม่มีรายการในบิล'); return; }
    var po = b.kind === 'po', label = po ? ' บันทึก PO ล่วงหน้า' : b.fromPo ? ' บันทึกบิล + หัก PO' : ' บันทึกบิล';
    if (b.fromPo && !b.noPoOk && !lines.some(function (l) { return l.po; })) {
      return ask({ title: 'ไม่ได้หักจาก PO เลย', text: 'ทุกรายการในบิลตั้งเป็น "ไม่หักจาก PO" — บันทึกเป็นบิลธรรมดา PO จะค้างเท่าเดิม', ok: 'บันทึกต่อ', cancel: 'กลับไปเลือก' }).then(function (y) { if (y) { b.noPoOk = true; save(); } });
    }
    var payload = { kind: b.kind, billId: b.billId, category: b.category, vendor: b.vendor.trim(), taxId: b.taxId, invNo: b.invNo, issueDate: b.issueDate, creditDays: b.creditDays, dueDate: due(), payRound: b.payRound,
      vatMode: b.vatMode, pct: b.pct, note: b.note, bank: b.bank, lines: lines, keepFiles: b.keepFiles };
    var send = function (allowDup) {
      payload.allowDup = !!allowDup;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
      var ups = b.uploads.map(function (u) { return { mime: u.mime, b64: u.b64, name: u.name }; });
      return (b.fromPo ? call('apReceivePo', state.token, b.fromPo, payload, ups) : call('apSaveBill', state.token, payload, ups)).then(function (r) {
        btn.disabled = false; btn.innerHTML = icon('check', 18) + label;
        if (r.dup) return ask({ title: 'บิลซ้ำ', text: r.error + ' — บันทึกซ้ำอีกใบไหม?', ok: 'บันทึกซ้ำ', cancel: 'ไม่บันทึก' }).then(function (yes) { if (yes) return send(true); });
        if (!r.ok) return toast(r.error);
        var round = b.payRound; P.round = round;
        if (P.queue && P.queue.indexOf(b) >= 0 && P.qi < P.queue.length - 1) return load().then(function () { queueNext('บันทึก ' + payload.vendor + ' ' + (payload.invNo || '') + ' แล้ว'); });
        P.cur = null; P.queue = null;
        var pl = r.po && r.po.left ? r.po.left.filter(function (x) { return x.qty > 0; }).length : 0;
        toast((po ? 'บันทึก PO ล่วงหน้าแล้ว' : b.fromPo ? (r.po && r.po.missing ? 'บันทึกบิลแล้ว แต่ไม่พบ PO (ไม่ได้หัก)' : r.po && r.po.done ? 'บันทึกบิลแล้ว — PO นี้รับครบแล้ว' : 'บันทึกบิลแล้ว — PO ยังค้าง ' + pl + ' รายการ รอบิลถัดไป') : 'บันทึกบิลแล้ว') + (b.uploads.length && !r.uploaded ? ' (เก็บไฟล์บิลไม่ได้ — ตรวจโฟลเดอร์ฝ่าย)' : ''));
        if (po || (b.fromPo && !b.autoPo)) return load().then(function () { P.poPage(); });
        var poMsg = b.fromPo && r.po ? (r.po.done ? ' · หัก PO ล่วงหน้าแล้ว — PO รับครบ' : r.po.missing ? '' : ' · หัก PO ล่วงหน้าแล้ว — PO ยังค้าง ' + pl + ' รายการ') : '';
        return load().then(function () { P.importPage(); msg('✓ บันทึก ' + esc(payload.vendor) + ' ' + esc(payload.invNo || '') + ' ลงรอบจ่าย ' + dotAD(roundOf(round).actual) + ' แล้ว' + poMsg + ' · <a href="#" id="apGoRound">ดูรายงานรอบนี้</a>', 'ok'); var g = $('apGoRound'); if (g) g.addEventListener('click', function (e) { e.preventDefault(); go('a_ap'); }); });
      }).catch(function (e) { btn.disabled = false; btn.innerHTML = icon('check', 18) + label; onServerError(e); });
    };
    send(false);
  }

  // ==================== โครงรายงาน (ใช้ทั้งหน้าเว็บและ Excel) ====================
  // สไตล์ตามไฟล์ต้นแบบ: Angsana New · หัว 18 ตัวหนา · ข้อมูล 18 · เส้นบาง (thin) ซ้าย-ขวา / เส้นจาง (hair) บน-ล่าง · แถวรวมผู้ขายพื้น #FFF2CC ตัวแดง · ช่องชำระรวมพื้นเหลือง
  var RED = 'FF0000', NF_AMT = '#,##0.00_);(#,##0.00)', NF2 = '#,##0.00', NF_ACC = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';
  // คอลัมน์ (ผู้ใช้ขอ 23/11/69): J % หัก ณ ที่จ่าย · K ส่วนลด/มัดจำ · L มูลค่ารายการ · M VAT (หลังหักส่วนลด) · N รวม · O ชำระ (= รวม − มูลค่า × %)
  //   ไม่มีคอลัมน์ยอดหัก ณ ที่จ่ายแยก (ผู้ใช้: มี % อยู่แล้ว) — ยอดหักคิดในสูตรช่องชำระ
  // v27 (ผู้ใช้ขอ 23/11/69): J % · K หัก ณ ที่จ่าย (= M × J%) · L ส่วนลด/มัดจำ · M มูลค่ารายการ · N VAT (หลังหักส่วนลด) · O รวม · P ชำระ
  var WIDTHS = [3.85546875, 8.5703125, 32.42578125, 15.7109375, 16.5703125, 19, 56.85546875, 13.28515625, 15.7109375, 11, 15, 15, 17.5703125, 17.5703125, 17.5703125, 17.5703125];
  var COLS = 'ABCDEFGHIJKLMNOP';
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
    dR: S({ sz: 18, h: 'center', bd: 'tthh', nf: 'mm-dd-yy', c: RED }), invR: S({ sz: 18, h: 'left', bd: 'tthh', c: RED }), amtR: S({ sz: 18, h: 'right', bd: 'tthh', nf: NF_AMT, c: RED }), payR: S({ sz: 18, b: 1, h: 'right', bd: 'tthh', nf: NF_AMT, c: RED }),   // PO ล่วงหน้า: ทั้งแถวตัวแดง ยกเว้นชื่อบริษัท (ผู้ใช้ขอ 23/11/69)
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
    var lines = d.lines.filter(function (l) { return l.payRound === nominal && !(l.kind === 'po' && !(Number(l.qty) > 0)); });   // บรรทัด PO ที่รับครบแล้ว (เหลือ 0) ไม่แสดง
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
        'BCDEF'.split('').forEach(function (x) { put(r1, x, '', ST.t20); }); 'HLMNOP'.split('').forEach(function (x) { put(r1, x, '', ST.t20r); });
        put(r1, 'G', c.title + ' ' + payTxt, si ? ST.title : ST.title18); put(r1, 'I', 'อัพเดทวันที่', ST.upd); merge('I' + r1, 'J' + r1);
        if (si === 1 && ci) put(r1, 'K', upd, ST.updv, '=K1'); else put(r1, 'K', upd, ST.updv);
        var rB = R(28.5); put(rB, 'B', c.title + ' ' + payTxt, si ? ST.big : ST.big18, '=G' + r1); put(rB, 'C', '', si ? ST.big : ST.big18); merge('B' + rB, 'C' + rB);
        var r3 = R(48.95);
        [['B', 'ผู้ขาย/ผู้จ่ายเงิน', ST.hd], ['C', '', ST.hd], ['D', 'วันที่ออก', ST.hd], ['E', 'วันที่ครบกำหนด', ST.hd], ['F', 'เลขที่ใบกำกับภาษี', ST.hd], ['G', 'คำอธิบาย', ST.hd], ['H', 'จำนวน', ST.hd], ['I', 'ราคา', ST.hd],
          ['J', '% หัก ณ ที่จ่าย', ST.hdK], ['K', 'หัก ณ ที่จ่าย', ST.hdK], ['L', 'ส่วนลด/มัดจำ', ST.hdK], ['M', 'มูลค่ารายการ', ST.hd], ['N', 'ภาษีมูลค่าเพิ่ม', ST.hd], ['O', 'รวม', ST.hd], ['P', 'ชำระ', ST.hdR]].forEach(function (x) { put(r3, x[0], x[1], x[2]); });
        merge('B' + r3, 'C' + r3);
        var first = r3 + 1, totRows = [], secTotal = 0;
        var bills = billsOf(lines.filter(function (l) { return l.category === ck; }));
        var byV = {}, vs = [];
        bills.forEach(function (b) { var k = norm(b.vendor); if (!byV[k]) { byV[k] = { name: b.vendor, bills: [] }; vs.push(byV[k]); } byV[k].bills.push(b); });
        vs.sort(function (a, b) { return (vOrder[norm(a.name)] || 999) - (vOrder[norm(b.name)] || 999) || a.name.localeCompare(b.name, 'th'); });
        if (!vs.length) vs.push({ name: '', bills: [{ empty: 1, lines: [{}] }] });
        vs.forEach(function (v) {
          var vStart = 0, anyWht = false, sums = { K: 0, L: 0, M: 0, N: 0, O: 0, P: 0 };
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
              if (b.empty) { 'DEFGHIJKLMNOP'.split('').forEach(function (cc) { put(r, cc, '', /[MNO]/.test(cc) ? ST.amt : cc === 'P' ? ST.pay : cc === 'D' || cc === 'E' ? ST.d : ST.desc); }); return; }
              var pct = Number(b.pct) || 0, qty = Number(l.qty) || 0, price = Number(l.price) || 0;
              var c = calc({ qty: qty, price: price, disc: l.disc }, b.vatMode, pct);
              var isPo = b.kind === 'po';
              if (!li) {
                put(r, 'D', b.issueDate ? { date: b.issueDate } : '', isPo ? ST.dR : ST.d);
                put(r, 'E', b.dueDate ? { date: b.dueDate } : '', isPo ? ST.dR : ST.d, b.issueDate ? (function (c) { c = Math.max(0, Math.round(Number(c) || 0)); var mo = Math.floor(c / 30), dd = c % 30; return mo ? '=EDATE(D' + x + ',' + mo + ')' + (dd ? '+' + dd : '') : '=+D' + x + '+' + dd; })(b.creditDays) : null);
                put(r, 'F', b.invNo || '', isPo ? ST.invR : ST.inv);
              } else { put(r, 'D', '', isPo ? ST.dR : ST.d); put(r, 'E', '', isPo ? ST.dR : ST.d); put(r, 'F', '', isPo ? ST.invR : ST.inv); }
              if (isPo) sh.rows[r - 1].po = 1;
              put(r, 'G', l.desc || '', isPo ? ST.descR : ST.desc);
              put(r, 'H', qty, Math.round(qty) === qty ? (isPo ? ST.qtyR : ST.qty) : (isPo ? ST.qty2R : ST.qty2));
              put(r, 'I', price, price < 0 || isPo ? (isPo ? ST.priceR : ST.priceNeg) : ST.price);
              put(r, 'J', pct || '', ST.pct);
              put(r, 'K', pct ? c.wht : '', ST.wht, pct ? '=ROUND(M' + x + '*J' + x + '%,2)' : null);   // หัก ณ ที่จ่าย = มูลค่ารายการ × % (ผู้ใช้ขอให้อยู่หน้าส่วนลด 23/11/69)
              put(r, 'L', c.disc ? c.disc : '', ST.wht);
              put(r, 'M', c.amount, isPo ? ST.amtR : ST.amt, b.vatMode === 'inc' ? '=H' + x + '*I' + x + '*100/107' : '=+H' + x + '*I' + x);
              put(r, 'N', c.vat, isPo ? ST.amtR : ST.amt, b.vatMode === 'none' ? null : '=ROUND((M' + x + '-L' + x + ')*7%,2)');   // VAT จากยอดหลังหักส่วนลด/มัดจำ
              put(r, 'O', c.total, isPo ? ST.amtR : ST.amt, '=+M' + x + '-L' + x + '+N' + x);
              put(r, 'P', '', isPo ? ST.payR : ST.pay);
              nSum += c.total; kSum += pct ? c.wht : 0; if (c.disc || pct) anyWht = true;
              sums.K += pct ? c.wht : 0; sums.L += c.disc; sums.M += c.amount; sums.N += c.vat; sums.O += c.total;
            });
            if (b.empty) return;
            var bEnd = bStart + b.lines.length - 1, ns = [], ks = [];
            for (var q = bStart; q <= bEnd; q++) { ns.push('O' + q); if (Number(b.pct)) ks.push('K' + q); }   // ชำระ = Σ รวม − Σ หัก ณ ที่จ่าย
            var payV = r2(nSum - kSum);
            put(bStart, 'P', payV, b.kind === 'po' ? ST.payR : ST.pay, '=+' + ns.join('+') + (ks.length ? '-' + ks.join('-') : ''));
            if (bEnd > bStart) merge('P' + bStart, 'P' + bEnd);
            sums.P += payV;
          });
          var tr = R(26.25), from = vStart, to = tr - 1;
          put(tr, 'A', '', ST.no, '=IF(B' + tr + '="","",COUNTA($B$' + first + ':B' + tr + '))');
          var vend = vendorOf(v.name), bankTxt = vend && vend.bank ? vend.bank : 'ธ.';
          put(tr, 'B', '', ST.bankB); put(tr, 'C', bankTxt, ST.bank);
          if (anyWht) { 'DEFG'.split('').forEach(function (cc) { put(tr, cc, '', ST.edge); }); merge('C' + tr, 'G' + tr); 'HIJ'.split('').forEach(function (cc) { put(tr, cc, '', ST.bankF); }); ['K', 'L'].forEach(function (cc) { put(tr, cc, sums[cc] ? r2(sums[cc]) : '', ST.sumK, sums[cc] ? '=SUM(' + cc + from + ':' + cc + to + ')' : null); }); }
          else { 'DEFGHI'.split('').forEach(function (cc) { put(tr, cc, '', ST.edge); }); put(tr, 'J', '', ST.edgeR); merge('C' + tr, 'J' + tr); put(tr, 'K', '', ST.bankF); put(tr, 'L', '', ST.bankF); }
          ['M', 'N', 'O'].forEach(function (cc) { put(tr, cc, r2(sums[cc]), ST.sumA, '=SUM(' + cc + from + ':' + cc + to + ')'); });
          put(tr, 'P', r2(sums.P), ST.sumO, '=SUM(P' + from + ':P' + to + ')');
          totRows.push(tr); secTotal += sums.P;
        });
        put(rB, 'D', r2(secTotal), si ? ST.bigTot : ST.bigTot18, '=+' + totRows.map(function (t) { return 'P' + t; }).join('+')); put(rB, 'E', '', si ? ST.bigTot : ST.bigTot18); merge('D' + rB, 'E' + rB);
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

  // ---------- ดูรายงานเต็มจอ (ผู้ใช้ขอ 23/11/69): ทับทั้งหน้า + เต็มจอของเบราว์เซอร์ · ขนาดพอดีความกว้างจอ หรือซูมเอง ----------
  function tableW() { return WIDTHS.reduce(function (t, w) { return t + Math.round(w * 5.6 + 4); }, 0); }
  function fitZoom() { var el = $('apSheets'); return Math.max(0.4, Math.min(2.5, ((el ? el.clientWidth : window.innerWidth) - 40) / tableW())); }
  function curZoom() { return P.zoom === 'fit' || !P.zoom ? fitZoom() : P.zoom; }
  function fsZoom() {
    var z = P.fs ? curZoom() : 1;
    Array.prototype.forEach.call(document.querySelectorAll('#apSheets .apx1'), function (t) { t.style.zoom = z === 1 ? '' : z; });
    if ($('apZv')) $('apZv').textContent = Math.round(z * 100) + '%';
  }
  function fsOn(again) {
    var el = $('apSheets'); if (!el) return;
    P.fs = true; el.classList.add('fs'); document.body.classList.add('apfsopen');
    if (!again && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    fsZoom();
  }
  function fsOff() {
    if (!P.fs) return;
    P.fs = false; var el = $('apSheets'); if (el) el.classList.remove('fs'); document.body.classList.remove('apfsopen');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    fsZoom();
  }
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && P.fs) fsOff(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && P.fs) fsOff(); });
  window.addEventListener('resize', function () { if (P.fs && P.zoom === 'fit') fsZoom(); });

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
      for (var ci = 0; ci < COLS.length; ci++) {
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
          printArea: 'A1:P' + sh.rows.length, printTitlesRow: '3:3' }   // หัวคอลัมน์ (แถว 3) พิมพ์ซ้ำทุกหน้า — ผู้ใช้ขอ 23/11/69
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
      var tot = bills.reduce(function (t, b) { t.pay += b.pay; t.wht += b.wht; t.disc += b.disc || 0; t.vat += b.vat; if (b.kind === 'po') { t.po++; t.poPay += b.pay; } return t; }, { pay: 0, wht: 0, disc: 0, vat: 0, po: 0, poPay: 0 });
      $('main').innerHTML = '<h3>รายงานจ่ายตามรอบ</h3><p class="lead">หน้าตาเหมือนไฟล์ค่าใช้จ่ายเดิม · แตะแถวเพื่อแก้บิล · ปุ่ม Excel ได้ไฟล์ตามแบบฟอร์ม (ฟอนต์ สี ขนาดช่องเหมือนเดิม)</p>'
        + (d.linked ? '' : linkPanel())
        + '<div class="apchips rounds noprint">' + list.map(function (r) {
            var x = cnt[r.nominal];
            return '<button class="apround' + (r.nominal === P.round ? ' on' : '') + '" data-r="' + r.nominal + '"><b>จ่าย ' + dotAD(r.nominal, true) + '</b><small>' + (x ? Object.keys(x.bills).length + ' บิล · ' + m2(x.pay) : 'ยังไม่มีบิล') + '</small></button>';
          }).join('') + '</div>'
        + (model ? '<div class="kpis xk"><div class="kpi"><b>' + m2(tot.pay) + '</b><span>ยอดชำระรอบนี้ (บาท)</span></div><div class="kpi"><b>' + (bills.length - tot.po) + (tot.po ? ' <em class="apred">+ PO ' + tot.po + '</em>' : '') + '</b><span>บิล' + (tot.po ? ' · PO ล่วงหน้า ' + m2(tot.poPay) + ' บาท (ตัวแดง)' : '') + '</span></div><div class="kpi"><b>' + m2(tot.wht) + '</b><span>หัก ณ ที่จ่าย' + (tot.disc ? ' · ส่วนลด/มัดจำ ' + m2(tot.disc) : '') + '</span></div><div class="kpi"><b>' + dotAD(model.actual) + '</b><span>วันจ่ายจริง' + (roundOf(P.round).why ? ' (' + esc(roundOf(P.round).why) + ' เลื่อนจาก ' + dotAD(P.round) + ')' : '') + '</span></div></div>'
          + '<div class="apbtns noprint"><button class="btn btn-primary" id="apXls">' + icon('table', 18) + ' Excel ตามแบบฟอร์ม</button><button class="btn" id="apPdf">' + icon('pdf', 18) + ' PDF</button><button class="btn" id="apNew">' + icon('upload', 18) + ' นำเข้าบิล</button><button class="btn appob" id="apNewPo">' + icon('clock', 18) + ' + PO ล่วงหน้า</button><button class="btn apdesk" id="apFull" title="ขยายรายงานเต็มหน้าจอ">⛶ ดูเต็มจอ</button></div>'
          + '<div class="apcats">' + d.cats.map(function (c, i) { var t = model.catTotals[c.key]; return '<span><i>' + (i + 1) + '</i>' + esc(c.name) + '<b>' + m2(t ? t.total : 0) + '</b></span>'; }).join('') + '</div>'
          + (tot.po ? '<div class="aplegend"><i></i> ตัวแดง = PO ล่วงหน้า ยังไม่ได้รับบิล (แตะแถวเพื่อแก้ / กด "ได้รับบิลแล้ว")</div>' : '')
          + '<div id="apInc" class="noprint"></div>'
          + '<div id="apSheets" class="apsheets"><div class="apfsbar noprint"><b>รายงานจ่าย ' + dotAD(model.actual) + '</b><span class="apfsz"><button type="button" class="btn apsm" id="apZo" aria-label="ย่อ">−</button><span id="apZv">100%</span><button type="button" class="btn apsm" id="apZi" aria-label="ขยาย">+</button><button type="button" class="btn apsm" id="apZf">พอดีจอ</button></span><button type="button" class="btn btn-primary apsm" id="apFsX">✕ ออกจากเต็มจอ</button></div>'
          + model.sheets.map(function (sh) { return sheetHtml(sh); }).join('') + '</div>' : '<div class="panel">ยังไม่มีรอบจ่าย</div>');
      on('[data-r]', 'click', function (el) { P.round = el.getAttribute('data-r'); P.roundPage(); });
      bindLink();
      if (!model) return;
      $('apXls').addEventListener('click', function () { var b = this; b.disabled = true; P.excel().catch(function (e) { toast('สร้าง Excel ไม่ได้: ' + (e.message || e)); }).then(function () { b.disabled = false; }); });
      $('apPdf').addEventListener('click', function () { $('pdfBtn').click(); });
      $('apFull').addEventListener('click', function () { P.zoom = 'fit'; fsOn(); });
      $('apFsX').addEventListener('click', fsOff);
      $('apZf').addEventListener('click', function () { P.zoom = 'fit'; fsZoom(); });
      $('apZi').addEventListener('click', function () { P.zoom = Math.min(2.5, curZoom() + 0.1); fsZoom(); });
      $('apZo').addEventListener('click', function () { P.zoom = Math.max(0.4, curZoom() - 0.1); fsZoom(); });
      if (P.fs) fsOn(true);   // หน้าวาดใหม่ (เช่น ได้รายการเงินเข้า) ระหว่างดูเต็มจอ → คงเต็มจอไว้
      $('apNew').addEventListener('click', function () { P.cur = null; go('a_apin'); });
      $('apNewPo').addEventListener('click', function () { P.cur = Object.assign(newBill('po'), { payRound: P.round, autoRound: false }); go('a_appo'); });
      // แถวที่เป็นบิล → แตะเพื่อแก้
      on('tr.apbill', 'click', function (el) { fsOff(); editBill(el.getAttribute('data-bill')); });
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
      var done = billsOf(d.poDone || []).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
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
            return '<div class="appocard"><div class="appoh"><b>' + esc(b.vendor) + '</b><span>' + catNo(b.category) + '. ' + esc(cat(b.category).name) + (b.pct ? ' · หัก ' + b.pct + '%' : '') + '</span>' + (b.log.length ? '<span class="appart">รับบิลแล้ว ' + b.log.length + ' ใบ · ยังค้าง</span>' : '') + '</div>'
              + '<div class="appoit">' + b.lines.map(function (l) {
                var rq = Number(l.recvQty) || 0, q = Number(l.qty) || 0;
                return '<div' + (q > 0 ? '' : ' class="apdone"') + '><span>' + esc(l.desc || '-') + (rq ? '<small>สั่ง ' + q0(q + rq) + ' · รับแล้ว ' + q0(rq) + '</small>' : '') + '</span><span>' + (q > 0 ? (rq ? 'ค้าง ' : '') + q0(q) + ' × ' + m2(l.price) + '<small>= ' + m2(l.lineTotal) + (b.vatMode === 'none' ? '' : ' (รวม VAT)') + '</small>' : '✓ ครบ') + '</span></div>'; }).join('') + '</div>'
              + (b.log.length ? poMoney(b) : '')
              + '<div class="appof"><span>' + (b.log.length ? 'คงเหลือ ชำระ' : 'ชำระ') + ' <b>' + m2(b.pay) + '</b></span><button class="btn apsm" data-pe="' + esc(b.billId) + '">แก้ไข</button>'
              + (b.log.length ? '<button class="btn apsm" data-pc="' + esc(b.billId) + '">ปิด PO</button>' : '')
              + '<button class="btn btn-primary apsm" data-pr="' + esc(b.billId) + '">' + icon('check', 16) + ' รับบิล</button></div></div>';
          }).join('') + '</div>';
        }).join('') : '<div class="panel">ยังไม่มี PO ล่วงหน้า</div>')
        + (done.length ? '<details class="panel pbox apodone"><summary><b>รับครบแล้ว / ปิดแล้ว</b> <span class="muted">' + done.length + ' PO</span></summary>' + done.map(function (b) {
          return '<div class="appocard done"><div class="appoh"><b>' + esc(b.vendor) + '</b><span>รอบจ่าย ' + dotAD(b.payRound, true) + (b.lines.some(function (l) { return Number(l.qty) > 0; }) ? ' · ปิดก่อนรับครบ' : ' · รับครบ') + '</span></div>'
            + '<div class="appoit">' + b.lines.map(function (l) { var rq = Number(l.recvQty) || 0, q = Number(l.qty) || 0; return '<div><span>' + esc(l.desc || '-') + '</span><span>รับ ' + q0(rq) + ' / สั่ง ' + q0(q + rq) + ' × ' + m2(l.price) + '<small>= ' + m2(calc({ qty: rq, price: Number(l.price) || 0 }, b.vatMode, b.pct).total) + '</small></span></div>'; }).join('') + '</div>'
            + (b.log.length ? poMoney(b) : '') + '</div>';
        }).join('') + '</details>' : '');
      bindLink();
      $('apPoAdd').addEventListener('click', function () { P.cur = newBill('po'); form(); });
      on('[data-pe]', 'click', function (el) { editBill(el.getAttribute('data-pe')); });
      on('[data-pr]', 'click', function (el) { receivePo(el.getAttribute('data-pr')); });
      on('[data-pb]', 'click', function (el) { var id = el.getAttribute('data-pb'); if (P.data.lines.some(function (l) { return l.billId === id; })) editBill(id); else toast('ไม่พบบิลนี้ (อาจถูกลบแล้ว)'); });
      on('[data-pc]', 'click', function (el) {
        var id = el.getAttribute('data-pc'), b = pos.filter(function (x) { return x.billId === id; })[0];
        ask({ title: 'ปิด PO นี้?', text: b.vendor + ' — ยอดที่ยังค้าง ' + m2(b.pay) + ' จะไม่นับในรายงานรอบจ่ายอีก (ใช้เมื่อผู้ขายไม่ส่งส่วนที่เหลือแล้ว) · บิลที่รับไปแล้วยังอยู่ครบ', ok: 'ปิด PO', cancel: 'ไม่ปิด', tone: 'danger' }).then(function (y) {
          if (y) call('apClosePo', state.token, id).then(function (r) { if (!r.ok) return toast(r.error); toast('ปิด PO แล้ว — ดูได้ที่ "รับครบแล้ว / ปิดแล้ว"'); load().then(P.poPage); }).catch(onServerError);
        });
      });
    });
  };
  // ยอดเงินของ PO ที่รับบิลไปบางส่วน: ยอดเดิม · หักตามบิลแล้ว (ยอดรวมของบิล) · คงเหลือ + ประวัติ (แตะเพื่อเปิดบิล)
  function poMoney(b) {
    var orig = b.lines.reduce(function (t, l) { return t + calc({ qty: (Number(l.qty) || 0) + (Number(l.recvQty) || 0), price: Number(l.price) || 0 }, b.vatMode, b.pct).total; }, 0);
    var ded = b.log.reduce(function (t, e) { return t + (Number(e.total) || 0); }, 0);
    return '<div class="apomoney"><span>ยอด PO เดิม<b>' + m2(orig) + '</b></span><span class="apred">หักตามบิลแล้ว<b>−' + m2(ded) + '</b></span><span>คงเหลือ (รวม VAT)<b>' + m2(b.total) + '</b></span></div>'
      + '<details class="apolog"><summary>ประวัติรับบิล ' + b.log.length + ' ใบ</summary>' + b.log.map(function (e) {
        return '<button type="button" class="apolr" data-pb="' + esc(e.billId) + '"><span>' + slash(e.date || String(e.at || '').slice(0, 10)) + (e.invNo ? ' · เลขที่ ' + esc(e.invNo) : '') + '<small>' + (e.lines || []).map(function (x) { return esc(x.desc || '') + ' ' + q0(x.q) + (x.a ? ' = ' + m2(x.a) : ''); }).join(' · ') + '</small></span><b>' + m2(e.total) + '</b></button>';
      }).join('') + '</details>';
  }

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
      b.dueDate = b.issueDate ? creditDue(b.issueDate, b.creditDays) : '';
      var t = { total: 0, wht: 0 }; b.lines.forEach(function (l) { var c = calc(l, b.vatMode, b.pct); t.total += c.total; t.wht += c.wht; }); b.pay = r2(t.total - t.wht);
    });
    return bills;
  };
  // เลือกได้หลายไฟล์ (ผู้ใช้ขอ 20/11/69): อ่านทุกไฟล์ รวมบิล / ผู้ขาย · บิลเดียวกัน (ผู้ขาย + เลขที่) ที่ซ้ำระหว่างไฟล์นับครั้งเดียว
  function readBook(f) {
    return f.arrayBuffer().then(function (b) {
      var wb = new window.ExcelJS.Workbook();
      return wb.xlsx.load(b.slice(0)).then(function (w) { return { bills: P.parseBillBook(w), vendors: P.parseVendorBook(XLSX.read(b, { type: 'array', cellFormula: true })) }; });
    }).catch(function (e) { throw new Error(f.name + ': ' + (e.message || e)); });
  }
  function importBook(files) {
    if (!P.data.linked) return toast('เชื่อม Google Sheet "ค่าใช้จ่าย (จ่าย) ฝ่ายบัญชี" ก่อน แล้วค่อยนำเข้า');
    msg('<span class="spinner dark"></span> กำลังอ่าน' + (files.length > 1 ? ' ' + files.length + ' ไฟล์' : 'ไฟล์') + ' Excel…');
    Promise.all([script(XJS_URL, function () { return !!window.ExcelJS; }), script(XLSX_URL, function () { return !!window.XLSX; })]).then(function () {
      return Promise.all(files.map(readBook));
    }).then(function (res) {
      msg('');
      var bills = [], vendors = [], vSeen = {}, inBatch = {};
      res.forEach(function (x) {
        x.bills.forEach(function (b) { var k = b.invNo && b.kind !== 'po' ? norm(b.vendor) + '|' + b.invNo : ''; if (k && inBatch[k]) return; if (k) inBatch[k] = 1; bills.push(b); });
        x.vendors.forEach(function (v) { var k = norm(v.name); if (vSeen[k]) return; vSeen[k] = 1; vendors.push(v); });
      });
      if (!bills.length) return toast('ไม่พบบิลในแผ่น "…จ่าย DD.MM.YY" ของ' + (files.length > 1 ? 'ไฟล์ที่เลือก' : 'ไฟล์นี้'));
      var have = {}; P.data.lines.forEach(function (l) { if (l.invNo) have[norm(l.vendor) + '|' + l.invNo] = 1; });
      bills.forEach(function (b) { b.dup = !!(b.invNo && b.kind !== 'po' && have[norm(b.vendor) + '|' + b.invNo]); });
      var ok = bills.filter(function (b) { return !b.dup; }), byR = {};
      ok.forEach(function (b) { var x = byR[b.payRound] = byR[b.payRound] || { n: 0, po: 0, pay: 0 }; x.n++; if (b.kind === 'po') x.po++; x.pay += b.pay; });
      openModal({ title: 'นำเข้าบิลจาก Excel', icon: 'table', color: state.dept.color, wide: true, ok: 'นำเข้า ' + ok.length + ' บิล',
        body: '<p>' + (files.length > 1 ? 'จาก ' + files.length + ' ไฟล์<br>' : '') + Object.keys(byR).sort().map(function (k) { var x = byR[k]; return '<b>รอบจ่าย ' + dotAD(k, true) + '</b>: ' + x.n + ' บิล' + (x.po ? ' (PO ล่วงหน้า ' + x.po + ' · ตัวแดง)' : '') + ' · ชำระ ' + m2(x.pay); }).join('<br>')
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
        + '<label>วันตัดรอบบิล (วันที่)<input id="apCutDay" inputmode="numeric" value="' + (d.settings.cutDay || 19) + '"><small>ครบเครดิตวันที่ 1 ถึงวันนี้ → จ่ายวันจ่ายของเดือนนั้น · หลังวันนี้ → จ่ายเดือนถัดไป (เครดิต 30 วัน = 1 เดือน)</small></label>'
        + '<label>เลขผู้เสียภาษีของบริษัทเรา<input id="apOurTax" inputmode="numeric" value="' + esc(d.settings.ourTaxId) + '" placeholder="13 หลัก"><small>ไม่ให้ระบบจับเลขของเราเป็นเลขของผู้ขาย</small></label>'
        + '</div><button class="btn btn-primary" id="apSetSave">บันทึกตั้งค่า</button></div>'
        + aiPanel()
        + '<div class="apbtns"><button class="btn btn-primary" id="apVAdd">+ เพิ่มผู้ขาย</button><label class="btn">' + icon('upload', 18) + ' นำเข้าผู้ขาย / เครดิต Supplier จาก Excel<input type="file" id="apVImp" accept=".xlsx,.xls" multiple hidden></label></div>'
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
      bindAiPanel();
      on('[data-v]', 'click', function (el) { vendorDialog((d.vendors || []).filter(function (v) { return v.id === el.getAttribute('data-v'); })[0] || {}); });
      $('apVImp').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files || []); this.value = ''; if (fs.length) importVendors(fs); });
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
        if (b && !/^=/.test(b) && !/^\d+\)\./.test(b) && !/ค่าใช้จ่าย/.test(b) && !/^(supp?l?ier|suppier|ผู้ขาย|ชื่อผู้ขาย|ชื่อบริษัท|ลำดับ)$/i.test(b) && !/^รายละเอียด\s*supp/i.test(b)) {   // ข้ามหัวตาราง (เคยหลุดเข้าเป็นผู้ขายชื่อ "Suppier")
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
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false }), hc = -1, cc = -1, tc = -1;
      rows.forEach(function (r) {
        // หัวตาราง: ชื่อผู้ขาย + เครดิต และ/หรือ เลขผู้เสียภาษี (ผู้ใช้ขอเก็บเลขผู้เสียภาษีด้วย 20/11/69)
        if (hc < 0) { r.forEach(function (v, i) { var t = String(v).trim(); if (/^supp?l?ier$|suppier|ผู้ขาย|ชื่อบริษัท/i.test(t)) hc = i; else if (/เครดิต/.test(t)) cc = i; else if (/ภาษี|tax/i.test(t)) tc = i; }); if (hc < 0 || (cc < 0 && tc < 0)) hc = cc = tc = -1; return; }
        var name = String(r[hc] || '').replace(/\s+/g, ' ').trim(), rawC = cc < 0 ? '' : String(r[cc]).trim(), cr = Number(rawC.replace(/[^\d.]/g, ''));
        var tax = tc < 0 ? '' : String(r[tc]).replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); }).replace(/\D/g, '');
        if (tax.length !== 13) tax = '';
        var hasC = rawC !== '' && /\d/.test(rawC) && isFinite(cr);
        if (!name || /^supp?l?ier$|suppier|ผู้ขาย|ชื่อบริษัท|ลำดับ/i.test(name) || (!hasC && !tax)) return;
        var v = (tax && (P.data.vendors || []).filter(function (x) { return String(x.taxId || '').replace(/\D/g, '') === tax; })[0]) || vendorOf(name);
        out.push({ name: v ? v.name : name, fileName: name, matched: !!v, creditDays: hasC ? Math.round(cr) : '', taxId: tax, category: v ? v.category : /วัตถุดิบ/.test(sn) ? 'raw' : 'pack' });
      });
    });
    return out;
  };
  // หลายไฟล์ได้: ไฟล์เครดิต Supplier และไฟล์ค่าใช้จ่ายเดิม รวมกัน (ชื่อซ้ำใช้ค่าจากไฟล์แรก)
  function importVendors(files) {
    toast('กำลังอ่านไฟล์…');
    script(XLSX_URL, function () { return !!window.XLSX; }).then(function () { return Promise.all(files.map(function (f) { return f.arrayBuffer(); })); }).then(function (bufs) {
      var books = bufs.map(function (b) { return XLSX.read(b, { type: 'array', cellFormula: true }); });
      var uniq = function (arr, key) { var seen = {}; return arr.filter(function (x) { var k = norm(key(x)); if (seen[k]) return false; seen[k] = 1; return true; }); };
      var cr = uniq([].concat.apply([], books.map(P.parseCreditBook)), function (x) { return x.name; });
      if (cr.length) {
        var m = cr.filter(function (x) { return x.matched; }).length;
        var nTax = cr.filter(function (x) { return x.taxId; }).length;
        return openModal({ title: 'ข้อมูล Supplier ' + cr.length + ' ราย', icon: 'upload', color: state.dept.color, ok: 'บันทึกเครดิต / เลขผู้เสียภาษี', wide: true,
          body: '<p>ตรงกับผู้ขายที่มีอยู่ ' + m + ' ราย (ตั้งตามไฟล์) · ผู้ขายใหม่ ' + (cr.length - m) + ' ราย (เพิ่มให้)' + (nTax ? ' · มีเลขผู้เสียภาษี ' + nTax + ' ราย' : ' · <span class="apwarn">ไฟล์นี้ไม่มีคอลัมน์เลขผู้เสียภาษี</span>') + ' — บิลที่โหลดเข้ามาของเจ้านั้นจะใส่เครดิตและจับชื่อจากเลขผู้เสียภาษีให้อัตโนมัติ</p><div class="apvimp">' + cr.map(function (v) { return '<div class="cprow"><b>' + esc(v.fileName) + '</b><span>' + (v.creditDays !== '' ? 'เครดิต ' + v.creditDays + ' วัน' : 'ไม่มีเครดิตในไฟล์') + (v.taxId ? ' · เลขผู้เสียภาษี ' + esc(v.taxId) : '') + '</span><small>' + (v.matched ? '✓ ' + esc(v.name) : 'ผู้ขายใหม่ · ' + esc(cat(v.category).name)) + '</small></div>'; }).join('') + '</div>',
          submit: function () {
            // ชื่อในไฟล์อาจเขียนต่างจากชื่อในระบบหลายแบบ (เช่น "บริษัท เอ.ที.บี" / "บริษัท เอ.ที.บี บรรจุภัณฑ์ จำกัด") → ตั้งเครดิตให้ทุกชื่อที่ตรงกันแบบหลวม
            var all = [], seenN = {};
            cr.forEach(function (v) {
              var ln = loose(v.fileName);
              (P.data.vendors || []).forEach(function (x) { var k = loose(x.name); if (!seenN[x.name] && (k === ln || (ln.length >= 4 && k.length >= 4 && (k.indexOf(ln) >= 0 || ln.indexOf(k) >= 0)))) { seenN[x.name] = 1; all.push({ name: x.name, category: x.category, creditDays: v.creditDays, taxId: v.taxId, vatMode: x.vatMode || 'exc' }); } });
              if (!seenN[v.name]) { seenN[v.name] = 1; all.push({ name: v.name, category: v.category, creditDays: v.creditDays, taxId: v.taxId, vatMode: 'exc' }); }
            });
            return call('apImportVendors', state.token, all, { credit: true }).then(function (r) { if (!r.ok) return r.error; closeModal(); toast('บันทึกแล้ว · เพิ่มใหม่ ' + r.added + ' ราย · อัปเดต ' + r.filled + ' ราย'); load().then(P.vendorPage); });
          } });
      }
      var list = uniq([].concat.apply([], books.map(P.parseVendorBook)), function (x) { return x.name; });
      if (!list.length) return toast('ไม่พบรายชื่อผู้ขายในไฟล์');
      openModal({ title: 'นำเข้าผู้ขาย ' + list.length + ' ราย', icon: 'upload', color: state.dept.color, ok: 'นำเข้า', wide: true,
        body: '<p>ผู้ขายที่มีอยู่แล้วจะเติมเฉพาะช่องที่ว่าง</p><div class="apvimp">' + list.map(function (v) { return '<div class="cprow"><b>' + esc(v.name) + '</b><span>' + esc(cat(v.category).name) + (v.creditDays !== '' ? ' · เครดิต ' + v.creditDays : '') + ' · ' + VAT_SHORT[v.vatMode || 'exc'] + (v.pct ? ' · ' + v.pct + '%' : '') + '</span><small>' + esc(v.bank || '-') + '</small></div>'; }).join('') + '</div>',
        submit: function () {
          return call('apImportVendors', state.token, list.map(function (v) { return Object.assign({}, v, { vatMode: v.vatMode || 'exc' }); })).then(function (r) { if (!r.ok) return r.error; closeModal(); toast('เพิ่ม ' + r.added + ' ราย · เติมข้อมูล ' + r.filled + ' ราย'); load().then(P.vendorPage); });
        } });
    }).catch(function (e) { toast('อ่านไฟล์ไม่ได้: ' + (e.message || e)); });
  }

  // ปุ่ม Excel ด้านบน (index.html) ในหน้ารายงานรอบจ่าย → ไฟล์ตามแบบฟอร์ม
  // ==================== Dashboard การจ่าย (ผู้ใช้ขอ 21/11/69: ทั้งหน้าฝ่ายบัญชี a_ap_dash และหน้าผู้บริหาร) ====================
  // ข้อมูล d = { linked, lines [{payRound, category, vendor, billId, kind, amount, vat, lineTotal, wht}], rounds [{nominal, actual, why}], cats, today }
  // ยอดชำระต่อบิล = Σ รวม − Σ หัก ณ ที่จ่าย (เหมือนรายงานตามรอบ) · รอบที่วันจ่ายจริง ≥ วันนี้ = รอจ่าย · ก่อนหน้า = จ่ายแล้ว (ตามรอบ)
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var CAT_C = { raw: '#16a34a', pack: '#f97316', misc: '#eab308', ship: '#0ea5e9', svc: '#6366f1', fac: '#ec4899' };
  function thd(iso, noYear) { if (!iso) return '-'; var p = String(iso).split('-'); return +p[2] + ' ' + MS[+p[1] - 1] + (noYear ? '' : ' ' + String(+p[0] + 543).slice(2)); }
  var DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  function wday(iso) { var p = String(iso).split('-'); return DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function b0(v) { return Math.round(Number(v) || 0).toLocaleString('en-US'); }
  var RANGES = [['6m', '6 เดือนล่าสุด'], ['12m', '12 เดือน'], ['y', 'ปีนี้'], ['all', 'ทั้งหมด']];
  P.dashModel = function (d, range) {
    var today = d.today, rmap = {}, cats = d.cats || [];
    (d.rounds || []).forEach(function (r) { rmap[r.nominal] = r; });
    var by = {};
    (d.lines || []).forEach(function (l) {
      if (!l.payRound) return;
      var r = by[l.payRound] = by[l.payRound] || { nominal: l.payRound, actual: (rmap[l.payRound] || {}).actual || l.payRound, why: (rmap[l.payRound] || {}).why || '', pay: 0, vat: 0, wht: 0, bills: {}, po: {}, poPay: 0, cat: {}, ven: {} };
      var pay = (Number(l.lineTotal) || 0) - (Number(l.wht) || 0);
      r.pay += pay; r.vat += Number(l.vat) || 0; r.wht += Number(l.wht) || 0; r.bills[l.billId] = 1;
      if (l.kind === 'po') { r.po[l.billId] = 1; r.poPay += pay; }
      r.cat[l.category || ''] = (r.cat[l.category || ''] || 0) + pay;
      var v = r.ven[l.vendor || '-'] = r.ven[l.vendor || '-'] || { pay: 0, bills: {} }; v.pay += pay; v.bills[l.billId] = 1;
    });
    var all = Object.keys(by).sort().map(function (k) { return by[k]; });
    var t = today.split('-'), y = +t[0], mo = +t[1];
    var back = function (n) { var m = mo - n, yy = y + Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return yy + '-' + pad(m) + '-01'; };
    var lo = range === '6m' ? back(6) : range === '12m' ? back(12) : range === 'y' ? y + '-01-01' : '', hi = range === 'y' ? y + '-12-31' : '9999';
    var list = all.filter(function (r) { return r.actual >= lo && r.actual <= hi; });
    var up = all.filter(function (r) { return r.actual >= today; }), past = list.filter(function (r) { return r.actual < today; });
    var sum = function (a, f) { return a.reduce(function (s, r) { return s + f(r); }, 0); };
    var cnt = function (a, f) { var o = {}; a.forEach(function (r) { Object.keys(f(r)).forEach(function (k) { o[k] = 1; }); }); return Object.keys(o).length; };
    var cat = {}, ven = {};
    list.forEach(function (r) {
      Object.keys(r.cat).forEach(function (k) { cat[k] = (cat[k] || 0) + r.cat[k]; });
      Object.keys(r.ven).forEach(function (k) { var v = ven[k] = ven[k] || { name: k, pay: 0, bills: 0 }; v.pay += r.ven[k].pay; v.bills += Object.keys(r.ven[k].bills).length; });
    });
    var next = up[0] || null, prevOfNext = next ? all[all.indexOf(next) - 1] || null : null;
    return {
      all: all, list: list, up: up, next: next, prevOfNext: prevOfNext,
      upPay: sum(up, function (r) { return r.pay; }), upBills: cnt(up, function (r) { return r.bills; }),
      upPo: cnt(up, function (r) { return r.po; }), upPoPay: sum(up, function (r) { return r.poPay; }),
      pastPay: sum(past, function (r) { return r.pay; }), pastN: past.length,
      vat: sum(list, function (r) { return r.vat; }), wht: sum(list, function (r) { return r.wht; }), pay: sum(list, function (r) { return r.pay; }),
      cats: cats.map(function (c) { return { key: c.key, name: c.name, n: r2(cat[c.key] || 0), color: CAT_C[c.key] } }).concat(cat[''] ? [{ key: '', name: 'ไม่ระบุหมวด', n: r2(cat['']), color: '#94a3b8' }] : []),
      vendors: Object.keys(ven).map(function (k) { return ven[k]; }).sort(function (a, b) { return b.pay - a.pay; })
    };
  };
  P.dashHtml = function (d, opt) {
    opt = opt || {};
    if (!d || !d.linked) return '<div class="panel">ยังไม่ได้เชื่อมชีตค่าใช้จ่าย (จ่าย) — ตั้งได้ที่หน้า "นำเข้าบิล" ของฝ่ายบัญชี</div>';
    var range = opt.range || '6m', M = P.dashModel(d, range), DCH = window.DCH;
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var nx = M.next, rangeName = RANGES.filter(function (x) { return x[0] === range; })[0][1];
    var html = '<div class="pbar noprint apdr"><div class="pchips" style="margin:0">' + RANGES.map(function (x) { return '<button class="chip' + (x[0] === range ? ' on' : '') + '" data-apdr="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>'
      + '</div>';
    if (!M.all.length) return html + '<div class="empty"><div class="icon">' + icon('chart', 28) + '</div><h4>ยังไม่มีบิลค่าใช้จ่าย</h4><div>นำเข้าบิลที่หน้า "นำเข้าบิล" แล้วข้อมูลจะขึ้นที่นี่</div></div>';
    html += '<div class="kpis">'
      + tile(nx ? b0(nx.pay) : '–', 'รอบจ่ายถัดไป (บาท)', '#dc2626', nx ? wday(nx.actual) + ' ' + thd(nx.actual) + ' · ' + Object.keys(nx.bills).length + ' บิล' + (Object.keys(nx.po).length ? ' (PO ' + Object.keys(nx.po).length + ')' : '') + (M.prevOfNext && DCH ? ' ' + DCH.delta(nx.pay, M.prevOfNext.pay, { good: 'down', label: 'จากรอบก่อน' }) : '') : 'ยังไม่มีบิลในรอบที่จะถึง')
      + tile(b0(M.upPay), 'ยอดรอจ่ายทั้งหมด (บาท)', '#ea580c', M.up.length + ' รอบ · ' + M.upBills + ' บิล')
      + tile(M.upPo ? M.upPo + ' ใบ' : '0', 'PO ล่วงหน้า (รอบิล)', '#b91c1c', M.upPo ? b0(M.upPoPay) + ' บาท · ยังไม่ได้รับบิล' : 'ไม่มีรายการรอบิล')
      + tile(b0(M.pay), 'ยอดจ่ายตามรอบ · ' + rangeName, '#2563eb', M.list.length + ' รอบ · จ่ายไปแล้ว ' + b0(M.pastPay))
      + tile(b0(M.vat), 'ภาษีซื้อ (VAT) · ' + rangeName, '#0d9488', 'จากบิลที่มี VAT')
      + tile(b0(M.wht), 'หัก ณ ที่จ่าย · ' + rangeName, '#7c3aed', 'หักออกจากยอดชำระแล้ว')
      + '</div>';
    var chart = M.list.length && DCH ? DCH.area({
      labels: M.list.map(function (r) { return thd(r.actual, true); }), unit: ' บาท', height: 200, fmt: function (v) { return b0(v); },
      calloutLabel: function (i) { return 'จ่าย ' + thd(M.list[i].actual); },
      series: [{ name: 'ยอดชำระรวม', color: '#dc2626', values: M.list.map(function (r) { return r2(r.pay); }), fill: true },
        { name: 'วัตถุดิบ', color: '#16a34a', values: M.list.map(function (r) { return r2(r.cat.raw || 0); }) }]
    }) : '<div class="muted">ไม่มีรอบจ่ายในช่วงนี้</div>';
    var catHtml = DCH ? DCH.donut(M.cats, { sub: 'บาท', center: DCH.short(M.pay), unit: ' บาท', fmt: b0, max: 7, title: 'แยกตามหมวด' }) : '';
    var top = M.vendors.slice(0, 8), mx = top.length ? top[0].pay : 1;
    var venHtml = top.length ? top.map(function (v, i) {
      return '<div class="apdv"><span><em>' + (i + 1) + '</em>' + esc(v.name) + '<small>' + v.bills + ' บิล</small></span><i><b style="width:' + Math.max(3, Math.round(v.pay / mx * 100)) + '%"></b></i><strong>' + b0(v.pay) + '</strong></div>';
    }).join('') + (M.vendors.length > 8 ? '<small class="muted">และผู้ขายอื่นอีก ' + (M.vendors.length - 8) + ' ราย · รวม ' + M.vendors.length + ' ราย</small>' : '') : '<div class="muted">ไม่มีข้อมูล</div>';
    var upHtml = M.up.length ? M.up.slice(0, 5).map(function (r) {
      var nb = Object.keys(r.bills).length, np = Object.keys(r.po).length, days = Math.round((new Date(r.actual) - new Date(d.today)) / 864e5);
      var bar = (d.cats || []).map(function (c) { var v = r.cat[c.key] || 0; return v > 0 ? '<i style="width:' + (v / r.pay * 100).toFixed(1) + '%;background:' + CAT_C[c.key] + '" title="' + esc(c.name) + ' ' + b0(v) + '"></i>' : ''; }).join('');
      return '<div class="apdu' + (opt.click ? ' clk" role="button" tabindex="0" data-apdgo="' + r.nominal : '') + '"><div><b>' + wday(r.actual) + ' ' + thd(r.actual) + '</b><small>' + (days <= 0 ? 'วันนี้' : 'อีก ' + days + ' วัน') + ' · ' + nb + ' บิล' + (np ? ' · <span class="apred">PO ' + np + '</span>' : '')
        + (r.why ? '<br><em>เลื่อนจาก ' + thd(r.nominal) + ' (' + esc(r.why) + ')</em>' : '') + '</small><span class="apdcb">' + bar + '</span></div><strong>' + b0(r.pay) + '</strong></div>';
    }).join('') : '<div class="muted">ไม่มีรอบจ่ายที่จะถึง</div>';
    html += '<div class="pgrid">'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' ยอดจ่ายตามรอบ <small class="muted">' + rangeName + '</small></h4>' + chart + '</div>'
      + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' รอบจ่ายที่จะถึง' + (opt.click ? ' <small class="muted">แตะเพื่อเปิดรายงาน</small>' : '') + '</h4>' + upHtml
      + '<div class="apdleg">' + (d.cats || []).map(function (c) { return '<span><i style="background:' + CAT_C[c.key] + '"></i>' + esc(c.name.replace(/^ค่าใช้จ่าย\s*/, '')) + '</span>'; }).join('') + '</div></div>'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' แยกตามหมวด <small class="muted">' + rangeName + '</small></h4>' + catHtml + '</div>'
      + '<div class="panel pbox"><h4>' + icon('table', 18) + ' ผู้ขายที่จ่ายมากที่สุด <small class="muted">' + rangeName + '</small></h4>' + venHtml + '</div>'
      + '</div>';
    return html;
  };
  // วาด + ผูกปุ่มช่วงเวลา ในกล่องใดก็ได้ (หน้าฝ่าย / หน้าผู้บริหาร)
  P.mountDash = function (box, d, opt) {
    opt = opt || {};
    var draw = function () {
      box.innerHTML = P.dashHtml(d, opt);
      on('[data-apdr]', 'click', function (el) { opt.range = el.getAttribute('data-apdr'); try { localStorage.setItem('ap_dash_range', opt.range); } catch (e) {} draw(); }, box);
      if (opt.click) on('[data-apdgo]', 'click', function (el) { opt.click(el.getAttribute('data-apdgo')); }, box);
    };
    if (!opt.range) { try { opt.range = localStorage.getItem('ap_dash_range') || '6m'; } catch (e) { opt.range = '6m'; } }
    draw();
  };
  // ส่วนการจ่ายในหน้า Dashboard ฝ่ายบัญชี (ผู้ใช้ขอ 21/11/69: รวมรับ + จ่ายไว้หน้าเดียว)
  P.mountInto = function (box) {
    var draw = function () { if (!box.isConnected) return; P.mountDash(box, P.data, { click: function (nom) { P.round = nom; go('a_ap'); } }); };
    if (P.data) return draw();
    load().then(draw).catch(function (e) { if (box.isConnected) box.innerHTML = '<div class="panel">โหลดค่าใช้จ่ายไม่ได้: ' + esc(e.message || e) + '</div>'; });
  };
  P.dashPage = function () {
    ensure('Dashboard การจ่าย', function () {
      $('main').innerHTML = '<h3>Dashboard การจ่าย</h3><p class="lead">ภาพรวมค่าใช้จ่ายตามรอบจ่าย · ยอดชำระ = รวม − หัก ณ ที่จ่าย (เหมือนรายงานจ่ายตามรอบ)</p>'
        + (P.data.linked ? '' : linkPanel()) + '<div id="apDash"></div>';
      bindLink();
      P.mountDash($('apDash'), P.data, { click: function (nom) { P.round = nom; go('a_ap'); } });
    });
  };
  P.exportFile = function (page, kind) { return page === 'a_ap' && kind === 'xlsx' && P.model ? P.excel() : null; };

  var css = document.createElement('style');
  css.textContent = [
    '.apdr{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:12px}.apdr small{font-size:12px}',
    '.apdv{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(60px,1fr) auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13.5px}.apdv span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.apdv em{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#fee2e2;color:#b91c1c;font-style:normal;font-size:11px;font-weight:700;margin-right:6px}.apdv small{color:var(--muted);margin-left:6px;font-size:11.5px}.apdv i{height:8px;border-radius:6px;background:#f1f5f9;overflow:hidden}.apdv i b{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#f87171,#dc2626)}.apdv strong{font-variant-numeric:tabular-nums;font-size:13.5px}',
    '.apdu{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#fff7f7;border:1px solid #fee2e2;margin-bottom:8px}.apdu>div{flex:1;min-width:0}.apdu b{font-size:14px}.apdu small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.apdu em{color:#b45309;font-style:normal}.apdu strong{font-size:16px;color:#b91c1c;font-variant-numeric:tabular-nums;white-space:nowrap}.apdu.clk{cursor:pointer}.apdu.clk:hover{border-color:#fca5a5;background:#fff1f1}',
    '.apdcb{display:flex;height:6px;border-radius:6px;overflow:hidden;background:#f1f5f9;margin-top:7px}.apdcb i{display:block;height:100%}.apdleg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--muted);margin-top:4px}.apdleg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px}',
    '.appick{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.appick small{flex-basis:100%;color:var(--muted)}.apbig{width:auto;flex:1 1 200px;justify-content:center;gap:8px;padding:14px;font-size:16px;cursor:pointer}',
    '.apform{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:18px;align-items:start}.apform.nofile{grid-template-columns:1fr}',
    '.apimgs{position:sticky;top:12px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 24px);overflow:auto}.apimgs figure{margin:0}.apimgs img{width:100%;border:1px solid var(--line);border-radius:10px;cursor:zoom-in;background:#fff}',
    '.apai{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;border:1.5px dashed #a78bfa;background:#f5f3ff;border-radius:14px;padding:10px 12px;margin-bottom:12px}.apai>div{flex:1 1 220px}.apai b{display:block;color:#5b21b6}.apai small{display:block;color:var(--muted)}.apai.weak{border-style:solid;border-color:#7c3aed}.apai.done{background:#f0fdf4;border:1.5px solid #86efac}.apai.done b{color:#15803d}.apai .btn{margin-top:0}',
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
    '.apfsbar{display:none}.apsheets.fs{position:fixed;inset:0;z-index:1000;background:#fff;overflow:auto;padding:0 16px 24px}.apsheets.fs .apfsbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:sticky;top:0;left:0;z-index:3;background:#fff;padding:10px 0;margin-bottom:8px;border-bottom:1px solid var(--line)}.apfsbar b{flex:1;font-size:17px}.apfsz{display:flex;gap:6px;align-items:center}.apfsz #apZv{min-width:48px;text-align:center;font-variant-numeric:tabular-nums;font-weight:700}.apfsbar .btn{margin:0;min-height:38px}',
    '.apsheets.fs .apsheet .cpwrap{max-height:none;overflow:visible;border:0}.apsheets.fs .apsheet{margin-bottom:28px}body.apfsopen{overflow:hidden}@media(max-width:900px){.apdesk{display:none}}',
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
    '.appoit small{display:block;color:var(--muted);font-size:12.5px;font-weight:400}.appoit div.apdone{color:#15803d;text-decoration:none}.appoit div.apdone span:first-child{text-decoration:line-through;color:var(--muted)}.appart{background:#fef3c7;color:#92400e;border-radius:999px;padding:1px 9px;font-size:12.5px;font-weight:700}',
    '.apomoney{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0;font-size:12.5px;color:var(--muted)}.apomoney span{background:#f8fafc;border-radius:8px;padding:5px 8px}.apomoney b{display:block;font-size:15px;color:var(--ink,#0f172a);font-variant-numeric:tabular-nums}.apomoney .apred b{color:#dc2626}',
    '.apolog{margin:4px 0 8px;font-size:13.5px}.apolog summary{cursor:pointer;color:#1d4ed8;font-weight:600;padding:4px 0}.apolr{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px dashed var(--line);background:none;padding:6px 2px;font:inherit;color:inherit;cursor:pointer}.apolr small{display:block;color:var(--muted)}.apolr b{white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.apodone summary{cursor:pointer;padding:2px 0}.appocard.done{border-color:#bbf7d0;background:#f0fdf4}.appocard.done .appoit{color:#166534}.appocard.done .appoit div{border-color:#bbf7d0}',
    '.appoban.info{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a;font-weight:500}.appoban.info b{color:#1e3a8a}.apmap{display:flex;flex-direction:column;gap:3px;padding:0 4px 4px}.apmap select{font:inherit;font-size:14px;min-height:36px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:6px;padding:4px 6px;max-width:100%}',
    '.apdupb{border:1px solid #fcd34d;background:#fffbeb;color:#92400e;border-radius:6px;padding:8px 10px;min-height:36px;font:inherit;font-size:12.5px;cursor:pointer;text-align:left}.apdupb.on{background:#fef3c7;font-weight:700}.apdupl td input{text-decoration:line-through;color:var(--muted)}.apdupl td.apv{color:#cbd5e1;text-decoration:line-through}',
    '.appos{margin-top:12px;border:1.5px solid #bfdbfe;border-radius:12px;padding:10px 12px;background:#fff}.appos h4{margin:0 0 8px;display:flex;gap:6px;align-items:center;color:#1e3a8a}.apposT{border-collapse:collapse;width:100%;font-size:14px}.apposT th,.apposT td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:right;white-space:nowrap}.apposT th:first-child,.apposT td:first-child{text-align:left;white-space:normal}.apposT th{background:#f1f5f9;font-size:13px}.apposT .apthis{color:#dc2626;font-weight:700}.aptab th small{display:block;font-weight:400;font-size:11.5px;color:var(--muted)}.aptab input.apdisc{color:#dc2626;min-width:80px}.aptab tr.apgrp td{background:#eff6ff;color:#1e3a8a;font-weight:700;border-top:2px solid #93c5fd;padding:6px}.aptab tr.apgrp td small{display:block;font-weight:400;font-size:12px;color:#475569}.aptab tr.apset td:first-child{box-shadow:inset 3px 0 #93c5fd}.apposT small{display:block;font-size:12px;color:var(--muted);font-weight:400}.apposT .apthis small{color:#dc2626}.appoit span:last-child small{text-align:right}.apposT tr.apdone td{color:var(--muted)}',
    '.apchoose{align-items:flex-start}.apchoose .apbtns{margin-top:6px}.apchoose .btn small{display:block;font-weight:400;color:var(--muted);font-size:12px}.appoban.info #apUnPo{margin:0 0 0 auto;flex:none}',
    '.apnote{margin:6px 0 0;font-size:13px;color:var(--muted)}.appost{margin-top:8px;border-radius:8px;padding:8px 10px;font-size:14px}.appost.part{background:#fffbeb;color:#92400e}.appost.full{background:#f0fdf4;color:#166534}.apmore{margin-top:6px}',
    '.apmap select{width:100%;text-overflow:ellipsis}@media(max-width:560px){.apomoney{grid-template-columns:1fr 1fr 1fr;font-size:11.5px}.apomoney b{font-size:13.5px}.aptab td:first-child{min-width:170px;max-width:190px}.apposT,.apposT thead,.apposT tbody{display:block}.apposT tr{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)}.apposT th,.apposT td{border:0;padding:4px 3px;font-size:13px}.apposT td:first-child{grid-column:1/-1;font-weight:600;padding-top:8px}.apposT th:first-child{display:none}.apposT small{font-size:11px}}',
    '@media (max-width:860px){.apform{grid-template-columns:1fr}.apimgs{position:static;max-height:none}.apgrid{grid-template-columns:1fr}}'
  ].join('\n');
  document.head.appendChild(css);
})();
