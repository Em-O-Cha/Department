// ==================== ฝ่ายบัญชี — ออเดอร์ต่างประเทศ (Invoice PDF) ====================
// เมนูในโมดูลบัญชี: "นำเข้า Invoice ต่างประเทศ (PDF)" (a_ex) · "ออเดอร์ต่างประเทศ" (a_exl) — accounting.js เรียก ACCEX.importPage() / ACCEX.listPage()
// อ่าน PDF ในเบราว์เซอร์: มีตัวหนังสือในไฟล์ → pdf.js · ไฟล์เป็นภาพ (เช่น Microsoft Print to PDF จาก PEAK) → OCR ด้วย tesseract.js (ภาษาอังกฤษ)
// ทุกช่องแก้ได้ในหน้าตรวจก่อนบันทึก (OCR อาจอ่านผิด) · ระบบเช็ค จำนวน × ราคา = จำนวนเงิน และยอดรวมกับท้ายใบ · API ใน AccExport.gs
(function () {
  var C = window.ACCEX = { data: null, imp: null, filter: '' };
  var PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var OCR_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var OCR_LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int';
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var STATUS = { '': 'รอส่ง', done: 'ส่งสินค้าแล้ว', cancel: 'ยกเลิก' };
  var DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

  function slash(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length < 3 ? '-' : p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2); }
  function dayOf(iso) { var p = String(iso).split('-'); return DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function m2(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function q0(v) { return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function num(s) { var n = parseFloat(String(s == null ? '' : s).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || $('main')).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function chk(ok, text) { var c = ok === 'warn' ? 'warn' : ok ? 'ok' : 'bad'; return '<div class="a7chk ' + c + '"><i>' + (c === 'ok' ? '✓' : c === 'warn' ? '!' : '✕') + '</i><span>' + text + '</span></div>'; }
  function steps(n) {
    return '<ol class="a7steps">' + ['เลือกไฟล์ Invoice (PDF)', 'ตรวจ / แก้ข้อมูล', 'บันทึก + ส่ง LINE'].map(function (t, i) {
      return '<li class="' + (i + 1 < n ? 'done' : i + 1 === n ? 'on' : '') + '"><i>' + (i + 1 < n ? '✓' : i + 1) + '</i>' + t + '</li>';
    }).join('') + '</ol>';
  }
  function msg(html, kind) { var el = $('exMsg'); if (el) el.innerHTML = html ? '<div class="a7msg ' + (kind || '') + '">' + html + '</div>' : ''; }
  function load() { return call('exLoad', state.token).then(function (d) { C.data = d; C.loadedAt = Date.now(); return d; }); }
  function loading(title) { $('main').innerHTML = '<h3>' + title + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูล…</div>'; }
  function script(url, ready) {
    if (ready()) return Promise.resolve();
    return new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { fail(new Error('โหลดตัวอ่านไฟล์ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); }; document.head.appendChild(s); });
  }
  // รีเฟรชอัตโนมัติ (accounting.js autoTick): โหลดใหม่ เปลี่ยนจริงค่อยวาดหน้าใหม่
  C.refresh = function () { return call('exLoad', state.token).then(function (d) { var ch = JSON.stringify(d) !== JSON.stringify(C.data); if (ch) C.data = d; C.loadedAt = Date.now(); return ch; }); };
  C.age = function () { return C.data ? Date.now() - (C.loadedAt || 0) : 0; };
  C.reset = function () { C.data = null; C.imp = null; C.filter = ''; };

  // ==================== อ่านข้อความจาก Invoice ====================
  function cleanTail(s) {   // ตัดตัวอักษรขยะท้ายบรรทัดที่ OCR อ่านจากไอคอน (เช่น "&", "JC", "Pr.", "he")
    var t = String(s).replace(/\S+@\S+\.\S+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    var junk = function (w, prev) { return /^[^\w฀-๿]+$/.test(w) || (w.length <= 3 && !/\d/.test(w) && (/[a-z.]/.test(w) || /^[A-Z][a-z]{2,}$/.test(prev || ''))); };
    while (t.length > 1 && junk(t[t.length - 1], t[t.length - 2])) t.pop();
    return t.join(' ').replace(/\s[&=©@|]\s.*$/, '').trim();
  }
  function fixCode(c) { c = String(c || '').toUpperCase(); return /^[A-Z][0-9OIL]{3,}$/.test(c) ? c[0] + c.slice(1).replace(/O/g, '0').replace(/[IL]/g, '1') : c; }
  var MONEY = '(-?[\\d,]+\\.\\d{1,4})';
  C.parseText = function (lines) {
    var T = lines.map(function (l) { return String(l).replace(/[ \t ]+/g, ' ').trim(); }).filter(Boolean), all = T.join('\n'), m;
    var inv = { invNo: '', issueDate: '', ref: '', customer: '', address: '', email: '', currency: '', incoterms: '', port: '', transport: '', payTerms: '', items: [], total: null, wht: 0, payAmount: null };
    // เลขที่ Invoice = ค่าหลัง "Doc. No." (ผู้ใช้ยืนยัน 19/11/69) — รับทุกรูปแบบ เช่น IV-20260100003, IV2026…, INV/2026/001 (OCR อาจอ่าน No เป็น N0 / N o)
    if ((m = all.match(/Doc\s*\.?\s*N\s*[o0O]\s*\.?\s*[:;.,]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_.]{2,}(?:\s?-\s?[A-Za-z0-9]+)?(?:\s\d{4,}\b)?)/))) inv.invNo = m[1].replace(/\s/g, '').replace(/[.,;:]+$/, '').toUpperCase();
    else if ((m = all.match(/\b((?:IV|INV|EX|CI|PI)-?\d{8,})\b/i))) inv.invNo = m[1].toUpperCase();
    if ((m = all.match(/Issue\s*Date\s*[:;.]?\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})/i))) { var y = +m[3]; if (y > 2400) y -= 543; inv.issueDate = y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    if ((m = all.match(/Ref\.?\s*[:;]\s*([^\n]*)/i))) { var ref = m[1].trim(); inv.ref = /^[-–—_.]*$/.test(ref) ? '' : ref; }
    var ci = -1;
    T.some(function (l, i) { if (/^Customer\s*[:;]/i.test(l)) { ci = i; return true; } return false; });
    if (ci >= 0) {
      var cn = T[ci].replace(/^Customer\s*[:;]\s*/i, '').split(/\s{2,}/)[0];
      var co = cn.match(/^(.*?\b(?:Inc\.?|Ltd\.?|LLC|L\.L\.C\.|Corp\.?|Corporation|Company|Co\.,?|Limited|GmbH|Pte\.?\s*Ltd\.?|Pty\.?\s*Ltd\.?|S\.A\.|B\.V\.))/i);
      inv.customer = co ? co[1].trim() : cleanTail(cn);
      var em = all.slice(all.indexOf(T[ci])).match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/); if (em) inv.email = em[0];
      var addr = [];
      for (var i = ci + 1; i < Math.min(T.length, ci + 8); i++) {
        if (/^Tax\s*No/i.test(T[i]) || /^Description\b/i.test(T[i])) break;
        var a = T[i].replace(/^Address\s*[:;]\s*/i, '').split(/\s{2,}/)[0];
        a = cleanTail(a); if (a && !/^[-–]$/.test(a)) addr.push(a);
      }
      inv.address = addr.join(' ');
    }
    // รายการสินค้า: "1. (P01055) 816.00 19.32 15,765.12" แล้วชื่อสินค้าอยู่บรรทัดถัดไป
    var itemRx = new RegExp('^(\\d{1,3})\\s*[.,)]\\s*(?:\\(?\\s*([A-Z][A-Z0-9]{3,11})\\s*\\)?\\s+)?(.*?)\\s*' + MONEY + '\\s+' + MONEY + '\\s+' + MONEY + '\\s*$');
    var stopRx = /^(\d{1,3}\s*[.,)]\s|Description\b|Remark|.?\s*Summary|Payment|Currency|Delivery|Customs|Mode of|VAT|Total|WHT|Page \d)/i;
    var seen = {};
    T.forEach(function (l, i) {
      var x = l.match(itemRx); if (!x) return;
      var no = +x[1]; if (seen[no]) return; seen[no] = 1;
      var name = x[3].replace(/^[-–:]\s*/, '').trim(), nl = [];
      for (var k = i + 1; k < Math.min(T.length, i + 3) && !stopRx.test(T[k]) && !itemRx.test(T[k]); k++) nl.push(T[k]);
      if (nl.length) name = (name ? name + ' ' : '') + nl.join(' ');
      inv.items.push({ code: fixCode(x[2]), name: name.replace(/\s+/g, ' ').trim(), qty: num(x[4]), price: num(x[5]), amount: num(x[6]) });
    });
    var moneyIn = function (rx) { var r = null; T.forEach(function (l) { if (rx.test(l)) { var v = l.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2}/g); if (v) r = num(v[v.length - 1]); } }); return r; };
    inv.payAmount = moneyIn(/Payment\s*Amount/i);
    inv.wht = moneyIn(/WHT\s*Amount/i) || 0;
    inv.total = moneyIn(/Total\s*Amount/i);
    if (inv.total == null) inv.total = moneyIn(/Grand\s*Total|VAT\s*Exempted|Sub\s*Total/i);
    if ((m = all.match(/[Pp]rices?[^\n]*?\bin\s+([A-Z]{3})\b/)) || (m = all.match(/Currency\s*[:;]\s*([A-Z]{3})\b/))) inv.currency = m[1];
    else if ((m = all.match(/Total\s*Amount[^\n]*?\b(USD|EUR|JPY|CNY|SGD|AUD|GBP|THB)\b/i))) inv.currency = m[1].toUpperCase();
    if ((m = all.match(/Incoterms[^:\n]*[:;]\s*([A-Z]{3})\b/i))) inv.incoterms = m[1].toUpperCase();
    if ((m = all.match(/Delivery\s*Location\s*[:;]\s*([^\n]+)/i))) inv.port = m[1].trim();
    if ((m = all.match(/Mode\s*of\s*Transport\s*[:;]\s*([^,.\n]+)/i))) inv.transport = m[1].trim();
    var pi = -1; T.some(function (l, i) { if (/^Payment\s*terms\s*[:;]?/i.test(l)) { pi = i; return true; } return false; });
    if (pi >= 0) {
      var pt = [T[pi].replace(/^Payment\s*terms\s*[:;]?\s*/i, '')];
      for (var j = pi + 1; j < T.length && j < pi + 10; j++) { if (/Summary|VAT\s*Exempt|Total\s*Amount|Remark|Banking|WHT|Payment\s*Amount|Page \d/i.test(T[j])) break; pt.push(T[j]); }
      inv.payTerms = pt.join(' ').replace(/\s+/g, ' ').trim();
    }
    return inv;
  };

  // ข้อความของหน้า PDF: มีตัวหนังสือในไฟล์ → จัดเป็นบรรทัดตามตำแหน่ง · ไม่มี → OCR จากภาพ
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
  function bw(canvas) {   // ขาว-ดำ ช่วยให้ OCR อ่านตัวหนังสือในกล่องสีได้ (เช่น วันที่ในกรอบฟ้า)
    var ctx = canvas.getContext('2d'), img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) { var v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 > 170 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
  }
  function readInvoice(file) {
    var thumbs = [], text = [], ocr = false, worker = null;
    return script(PDF_URL, function () { return !!window.pdfjsLib; }).then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      return file.arrayBuffer();
    }).then(function (buf) { return window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise; }).then(function (doc) {
      var chain = Promise.resolve(), pages = Math.min(doc.numPages, 6);
      for (var n = 1; n <= pages; n++) (function (n) {
        chain = chain.then(function () { return doc.getPage(n); }).then(function (pg) {
          return pg.getTextContent().then(function (tc) {
            var lines = pdfLines(tc), vp1 = pg.getViewport({ scale: 1 }), scale = 1700 / vp1.width, vp = pg.getViewport({ scale: scale });
            var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            return pg.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
              var th = document.createElement('canvas'); th.width = 600; th.height = Math.round(cv.height * 600 / cv.width);
              th.getContext('2d').drawImage(cv, 0, 0, th.width, th.height); thumbs.push(th.toDataURL('image/jpeg', 0.8));
              if (lines.join('').replace(/\s/g, '').length > 40) { text = text.concat(lines); return; }
              ocr = true;
              msg('<span class="spinner dark"></span> ไฟล์นี้เป็นภาพ — กำลังอ่านตัวหนังสือจากภาพ หน้า ' + n + '/' + pages + '… <small>(ครั้งแรกต้องโหลดตัวอ่าน อาจใช้เวลา 10–30 วินาที)</small>');
              bw(cv);
              return script(OCR_URL, function () { return !!window.Tesseract; }).then(function () {
                return worker || window.Tesseract.createWorker('eng', 1, { langPath: OCR_LANG }).then(function (w) { worker = w; return w; });
              }).then(function (w) { return w.recognize(cv); }).then(function (r) { text = text.concat(String(r.data.text || '').split('\n')); });
            });
          });
        });
      })(n);
      return chain;
    }).then(function () {
      if (worker) worker.terminate();
      var inv = C.parseText(text);
      inv.ocr = ocr; inv.thumbs = thumbs; inv.raw = text.join('\n');
      return inv;
    }, function (e) { if (worker) worker.terminate(); throw e; });
  }
  function readFile(f) {
    if (!f || !(/\.pdf$/i.test(f.name) || f.type === 'application/pdf')) { msg(icon('warn', 18) + ' เลือกไฟล์ PDF ของ Invoice', 'bad'); return; }
    if (f.size > 10 * 1024 * 1024) { msg(icon('warn', 18) + ' ไฟล์ใหญ่เกิน 10 MB', 'bad'); return; }
    msg('<span class="spinner dark"></span> กำลังอ่านไฟล์ ' + esc(f.name) + '…');
    var b64 = f.arrayBuffer().then(function (buf) {
      var bin = '', u = new Uint8Array(buf); for (var i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    Promise.all([readInvoice(f), b64]).then(function (r) {
      var inv = r[0];
      if (!inv.items.length && !inv.invNo) throw new Error('อ่านข้อมูล Invoice จากไฟล์นี้ไม่ได้ — ตรวจว่าเป็นไฟล์ Invoice และภาพชัด');
      if (!inv.currency) inv.currency = 'USD';
      inv.shipDate = ''; inv.note = '';
      C.imp = { fileName: f.name, inv: inv, pdf: r[1], exists: null };
      return call('exCheck', state.token, inv.invNo).then(function (x) { C.imp.exists = x.exists ? x.order : null; if (x.exists && x.order.shipDate) inv.shipDate = x.order.shipDate; previewPage(); });
    }).catch(function (e) { msg(icon('warn', 18) + ' ' + esc(e.message || String(e)), 'bad'); });
  }

  // ==================== หน้า 1: เลือกไฟล์ ====================
  C.importPage = function () {
    if (C.imp) return previewPage();
    if (!C.data) { loading('นำเข้า Invoice ต่างประเทศ'); load().then(C.importPage).catch(onServerError); return; }
    var d = C.data;
    $('main').innerHTML = '<h3>นำเข้าออเดอร์ต่างประเทศ (Invoice PDF)</h3><p class="lead">เลือกไฟล์ PDF ของ Invoice (เช่น จาก PEAK) ระบบอ่านเลขที่ วันที่ ลูกค้า รายการสินค้า และยอดเงิน ให้ตรวจ / แก้ก่อนบันทึก แล้วส่งเข้ากลุ่ม LINE</p>'
      + steps(1)
      + '<label class="a7drop" id="exDrop" tabindex="0"><input type="file" id="exFile" accept=".pdf,application/pdf" hidden>'
      + '<span class="a7dic">' + icon('upload', 34) + '</span><b>แตะเพื่อเลือกไฟล์ Invoice (PDF)</b><span>หรือลากไฟล์มาวางตรงนี้ · ไฟล์ที่เป็นภาพก็อ่านได้ (ใช้เวลานานขึ้น)</span></label>'
      + '<div id="exMsg"></div>'
      + (d.orders.length ? '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('clock', 18) + ' นำเข้าล่าสุด</h4>' + d.orders.slice(0, 5).map(function (o) {
        return '<div class="cprow"><b>' + esc(o.invNo) + '</b><span>' + esc(o.customer) + '</span><small>' + slash(o.issueDate) + ' · ' + m2(o.amount) + ' ' + esc(o.currency) + ' · ' + STATUS[o.status || ''] + '</small></div>';
      }).join('') + '</div>' : '');
    var inp = $('exFile'), drop = $('exDrop');
    inp.addEventListener('change', function () { if (inp.files.length) readFile(inp.files[0]); inp.value = ''; });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) readFile(e.dataTransfer.files[0]); });
  };

  // ==================== หน้า 2: ตรวจ / แก้ข้อมูล ====================
  var FIELDS = [['invNo', 'เลขที่ Invoice (Doc. No.) *'], ['issueDate', 'วันที่ Invoice *', 'date'], ['customer', 'ลูกค้า *'], ['shipDate', 'วันส่งสินค้า (ETD)', 'date'],
    ['port', 'ปลายทาง (Delivery Location)'], ['incoterms', 'Incoterms'], ['transport', 'การขนส่ง'], ['currency', 'สกุลเงิน'], ['ref', 'อ้างอิง (Ref.)'], ['email', 'อีเมลลูกค้า'],
    ['address', 'ที่อยู่ลูกค้า', 'wide'], ['payTerms', 'เงื่อนไขการชำระเงิน', 'area'], ['note', 'หมายเหตุ', 'wide']];
  function checks(inv) {
    var out = [], sum = 0;
    inv.items.forEach(function (it, i) {
      sum += num(it.amount);
      if (Math.abs(num(it.qty) * num(it.price) - num(it.amount)) > Math.max(0.02, num(it.amount) * 0.0005)) out.push(chk('warn', 'รายการที่ ' + (i + 1) + ': จำนวน × ราคา = ' + m2(num(it.qty) * num(it.price)) + ' ไม่ตรงกับจำนวนเงิน ' + m2(it.amount) + ' — ตรวจตัวเลข'));
      if (!it.name) out.push(chk('warn', 'รายการที่ ' + (i + 1) + ': ยังไม่มีชื่อสินค้า'));
    });
    sum = r2(sum);
    if (inv.total != null) out.push(Math.abs(sum - inv.total) < 0.015 ? chk(true, 'ยอดรวมรายการ ' + m2(sum) + ' ' + esc(inv.currency) + ' ตรงกับยอดท้าย Invoice') : chk('warn', 'ยอดรวมรายการ ' + m2(sum) + ' ไม่ตรงกับยอดท้าย Invoice ' + m2(inv.total) + ' — ตรวจรายการที่ขาด / ตัวเลขที่อ่านผิด'));
    else out.push(chk('warn', 'ไม่พบยอดรวมท้าย Invoice — ตรวจยอดรวม ' + m2(sum) + ' เอง'));
    return { html: out.join(''), sum: sum };
  }
  function itemsTable(inv) {
    return '<div class="cpwrap"><table class="cptab exit"><thead><tr><th>#</th><th>รหัสสินค้า</th><th>สินค้า</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>จำนวนเงิน</th><th></th></tr></thead><tbody>'
      + inv.items.map(function (it, i) {
        return '<tr><td>' + (i + 1) + '</td><td><input data-ei="' + i + '" data-k="code" value="' + esc(it.code) + '" class="exc"></td><td><input data-ei="' + i + '" data-k="name" value="' + esc(it.name) + '" class="exn"></td>'
          + '<td><input data-ei="' + i + '" data-k="qty" inputmode="decimal" value="' + esc(it.qty) + '" class="exq"></td><td><input data-ei="' + i + '" data-k="price" inputmode="decimal" value="' + esc(it.price) + '" class="exq"></td>'
          + '<td><input data-ei="' + i + '" data-k="amount" inputmode="decimal" value="' + esc(it.amount) + '" class="exq"></td><td><button type="button" class="btn btn-sm btn-line" data-edel="' + i + '" title="ลบรายการ">✕</button></td></tr>';
      }).join('') + '</tbody></table></div><button type="button" class="btn btn-sm btn-line" id="exAdd" style="margin-top:8px">+ เพิ่มรายการ</button>';
  }
  function previewPage() {
    var I = C.imp, inv = I.inv;
    var head = [chk(true, 'อ่านไฟล์ได้ ' + (inv.ocr ? '(อ่านจากภาพด้วย OCR — ตรวจตัวเลขกับไฟล์ต้นฉบับด้านล่างอีกครั้ง)' : '(ตัวหนังสือในไฟล์)') + ' · ' + inv.items.length + ' รายการ'),
      chk(!!inv.invNo, inv.invNo ? 'เลขที่ Invoice (Doc. No.) ' + esc(inv.invNo) : 'ไม่พบเลขที่ Invoice (Doc. No.) — ใส่เอง'),
      chk(!!inv.issueDate, inv.issueDate ? 'วันที่ Invoice ' + slash(inv.issueDate) : 'ไม่พบวันที่ Invoice — ใส่เอง')];
    if (I.exists) head.push(chk('warn', 'Invoice เลขนี้มีในระบบแล้ว (สถานะ ' + STATUS[I.exists.status || ''] + (I.exists.sentAt ? ' · ส่ง LINE แล้ว' : '') + ') — บันทึกจะอัปเดตข้อมูลเดิม'));
    $('main').innerHTML = '<h3>ตรวจข้อมูล Invoice ก่อนบันทึก</h3><p class="lead">' + esc(I.fileName) + ' · แก้ได้ทุกช่อง ถ้าถูกต้องกดบันทึก</p>' + steps(2)
      + '<div class="panel pbox a7checks"><h4>' + icon('check', 18) + ' ผลการตรวจไฟล์</h4>' + head.join('') + '<div id="exChecks"></div></div>'
      + '<div class="panel pbox"><h4>' + icon('edit', 18) + ' ข้อมูล Invoice</h4><div class="exform">' + FIELDS.map(function (f) {
        var v = inv[f[0]] == null ? '' : inv[f[0]], cls = f[2] === 'wide' || f[2] === 'area' ? ' exw' : '';
        return '<label class="pf' + cls + '"><span>' + f[1] + (f[0] === 'shipDate' ? ' <small class="muted">ใส่เองได้ แก้ภายหลังได้</small>' : '') + '</span>'
          + (f[2] === 'area' ? '<textarea data-ef="' + f[0] + '" rows="3">' + esc(v) + '</textarea>' : '<input data-ef="' + f[0] + '"' + (f[2] === 'date' ? ' type="date"' : '') + ' value="' + esc(v) + '">') + '</label>';
      }).join('') + '</div></div>'
      + '<div class="panel pbox"><h4>' + icon('table', 18) + ' รายการสินค้า</h4><div id="exItems">' + itemsTable(inv) + '</div><div class="extot" id="exTot"></div></div>'
      + (inv.thumbs && inv.thumbs.length ? '<details class="panel pbox exsrc"' + (inv.ocr ? ' open' : '') + '><summary>' + icon('pdf', 18) + ' ไฟล์ต้นฉบับ (ไว้เทียบตัวเลข)</summary>' + inv.thumbs.map(function (t) { return '<img src="' + t + '" alt="">'; }).join('') + '</details>' : '')
      + '<div id="exMsg"></div>'
      + '<div class="a7bar"><button class="btn btn-line" id="exBack">' + icon('back', 16) + ' เลือกไฟล์ใหม่</button><button class="btn btn-primary" id="exSave">' + icon('check', 18) + ' ข้อมูลถูกต้อง บันทึก</button></div>';
    var refresh = function () {
      var c = checks(inv);
      $('exChecks').innerHTML = c.html;
      $('exTot').innerHTML = 'รวม ' + inv.items.length + ' รายการ · จำนวน ' + q0(inv.items.reduce(function (s, it) { return s + num(it.qty); }, 0)) + ' · <b>' + m2(c.sum) + ' ' + esc(inv.currency || '') + '</b>';
    };
    var bindItems = function () {
      on('[data-ei]', 'input', function (el) {
        var it = inv.items[+el.getAttribute('data-ei')], k = el.getAttribute('data-k');
        it[k] = k === 'code' || k === 'name' ? el.value : el.value;
        if (k === 'qty' || k === 'price') { var a = r2(num(it.qty) * num(it.price)); it.amount = a; var ai = $('exItems').querySelector('[data-ei="' + el.getAttribute('data-ei') + '"][data-k="amount"]'); if (ai) ai.value = a; }
        refresh();
      }, $('exItems'));
      on('[data-edel]', 'click', function (el) { inv.items.splice(+el.getAttribute('data-edel'), 1); $('exItems').innerHTML = itemsTable(inv); bindItems(); refresh(); }, $('exItems'));
      $('exAdd').addEventListener('click', function () { inv.items.push({ code: '', name: '', qty: 0, price: 0, amount: 0 }); $('exItems').innerHTML = itemsTable(inv); bindItems(); refresh(); });
    };
    on('[data-ef]', 'input', function (el) { inv[el.getAttribute('data-ef')] = el.value; if (el.getAttribute('data-ef') === 'currency') refresh(); });
    bindItems(); refresh();
    $('exBack').addEventListener('click', function () { C.imp = null; C.importPage(); });
    $('exSave').addEventListener('click', save);
  }
  function save() {
    var I = C.imp, inv = I.inv, b = $('exSave');
    if (!String(inv.invNo || '').trim()) { msg(icon('warn', 18) + ' ใส่เลขที่ Invoice', 'bad'); return; }
    if (!inv.issueDate) { msg(icon('warn', 18) + ' ใส่วันที่ Invoice', 'bad'); return; }
    if (!String(inv.customer || '').trim()) { msg(icon('warn', 18) + ' ใส่ชื่อลูกค้า', 'bad'); return; }
    var items = inv.items.filter(function (it) { return String(it.name || it.code).trim(); }).map(function (it) { return { code: it.code, name: it.name, qty: num(it.qty), price: num(it.price), amount: num(it.amount) }; });
    if (!items.length) { msg(icon('warn', 18) + ' ไม่มีรายการสินค้า', 'bad'); return; }
    var data = {}; FIELDS.forEach(function (f) { data[f[0]] = inv[f[0]]; }); data.items = items; data.wht = inv.wht; data.payAmount = inv.payAmount;
    b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
    call('exSave', state.token, data, I.fileName, I.pdf).then(function (r) {
      if (!r.ok) { b.disabled = false; b.textContent = 'บันทึก'; msg(icon('warn', 18) + ' ' + esc(r.error), 'bad'); return; }
      C.imp = null; C.data = null; C.justSaved = r.id;
      toast(r.updated ? 'อัปเดต Invoice เดิมแล้ว' : 'บันทึกแล้ว');
      var nb = document.querySelector('#nav button[data-page="a_exl"]');
      if (nb) nb.click(); else C.listPage();
    }).catch(onServerError);
  }

  // ==================== หน้ารายการออเดอร์ต่างประเทศ ====================
  function orderTable(o, opt) {
    opt = opt || {};
    return '<div class="cpwrap"><table class="cptab exl"><thead><tr><th>#</th><th>รหัส</th><th>สินค้า</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>จำนวนเงิน (' + esc(o.currency || 'USD') + ')</th></tr></thead><tbody>'
      + (o.items || []).map(function (it, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(it.code || '-') + '</td><td class="exnm">' + esc(it.name) + '</td><td class="cpq">' + q0(it.qty) + '</td><td>' + m2(it.price) + '</td><td class="cpq">' + m2(it.amount) + '</td></tr>'; }).join('')
      + '</tbody><tfoot><tr><td colspan="2"></td><td class="cpy">รวม</td><td class="cpy">' + q0(o.qty) + '</td><td class="cpy"></td><td class="cpy">' + m2(o.amount) + '</td></tr></tfoot></table></div>';
  }
  function tag(o) { return o.status === 'done' ? '<span class="cptag done">ส่งสินค้าแล้ว</span>' : o.status === 'cancel' ? '<span class="cptag cancel">ยกเลิก</span>' : '<span class="cptag chg">รอส่ง</span>'; }
  function xlsxDl(u) { var m = String(u || '').match(/[-\w]{25,}/); return m ? 'https://drive.google.com/uc?export=download&id=' + m[0] : u; }
  C.listPage = function () {
    if (!C.data) { loading('ออเดอร์ต่างประเทศ'); load().then(C.listPage).catch(onServerError); return; }
    var d = C.data, all = d.orders, f = C.filter;
    var list = all.filter(function (o) { return f === '' ? true : f === 'wait' ? !o.status : o.status === f; });
    var live = all.filter(function (o) { return o.status !== 'cancel'; }), cur = {};
    live.forEach(function (o) { cur[o.currency || 'USD'] = (cur[o.currency || 'USD'] || 0) + (Number(o.amount) || 0); });
    var tile = function (v, l, c) { return '<div class="kpi" style="--k:' + c + '"><b>' + v + '</b><span>' + l + '</span></div>'; };
    var cnt = function (s) { return all.filter(function (o) { return s === 'wait' ? !o.status : o.status === s; }).length; };
    $('main').innerHTML = '<h3>ออเดอร์ต่างประเทศ</h3><p class="lead">นำเข้าจากไฟล์ Invoice · แตะ "แก้ไข" เพื่อใส่วันส่ง / บันทึกว่าส่งแล้ว / ยกเลิก · ส่งเข้ากลุ่ม LINE เดียวกับรายงานฝ่ายบัญชี</p>'
      + (d.line ? '' : '<div class="a7msg bad">ยังไม่ได้ตั้งค่า LINE ของฝ่ายบัญชี — ตั้งในเมนู "ตั้งค่าศูนย์ / สินค้า 7-11 / LINE" ก่อนส่ง</div>')
      + '<div class="kpis xk">' + tile(all.length, 'Invoice ทั้งหมด', '#1e3a8a') + tile(cnt('wait'), 'รอส่ง', '#d97706') + tile(cnt('done'), 'ส่งสินค้าแล้ว', '#16a34a')
      + tile(Object.keys(cur).map(function (k) { return m2(cur[k]) + ' ' + k; }).join(' · ') || '0', 'ยอดรวม (ไม่รวมยกเลิก)', '#7c3aed') + '</div>'
      + '<div class="pchips">' + [['', 'ทั้งหมด'], ['wait', 'รอส่ง'], ['done', 'ส่งสินค้าแล้ว'], ['cancel', 'ยกเลิก']].map(function (x) { return '<button class="chip' + (f === x[0] ? ' on' : '') + '" data-exf="' + x[0] + '">' + x[1] + '</button>'; }).join('')
      + '<button class="btn btn-sm btn-primary" id="exNew" style="margin-left:auto">' + icon('upload', 15) + ' นำเข้า Invoice</button></div>'
      + (list.length ? list.map(function (o) {
        return '<div class="panel pbox exo"><div class="exoh"><div><b>' + esc(o.invNo) + '</b> · ' + esc(o.customer) + ' ' + tag(o) + (o.sentAt ? ' <span class="cptag done">ส่ง LINE ' + esc(slash(String(o.sentAt).slice(0, 10))) + ' ' + esc(String(o.sentAt).slice(11, 16)) + '</span>' : ' <span class="cptag">ยังไม่ส่ง LINE</span>') + '</div>'
          + '<b class="exam">' + m2(o.amount) + ' ' + esc(o.currency) + '</b></div>'
          + '<div class="exmeta">วันที่ Invoice ' + slash(o.issueDate) + ' · <b class="' + (o.shipDate ? '' : 'exwarn') + '">ส่ง (ETD) ' + (o.shipDate ? 'วัน' + dayOf(o.shipDate) + ' ' + slash(o.shipDate) : 'ยังไม่กำหนด') + '</b>'
          + (o.port ? ' · ' + esc(o.port) : '') + (o.incoterms ? ' · ' + esc(o.incoterms) : '') + (o.transport ? ' · ' + esc(o.transport) : '') + '</div>'
          + (o.note ? '<div class="exmeta">หมายเหตุ: ' + esc(o.note) + '</div>' : '')
          + (o.history ? '<div class="exmeta cph">' + esc(String(o.history).split(' | ').pop()) + '</div>' : '')
          + orderTable(o)
          + (o.payTerms ? '<details class="expt"><summary>เงื่อนไขการชำระเงิน</summary><p>' + esc(o.payTerms) + '</p></details>' : '')
          + '<div class="pfoot exbtn"><button class="btn btn-sm btn-line" data-exed="' + esc(o.id) + '">' + icon('edit', 15) + ' แก้ไข / วันส่ง / สถานะ</button>'
          + (d.line ? '<button class="btn btn-sm ' + (o.sentAt ? 'btn-line' : 'btn-primary') + '" data-exsend="' + esc(o.id) + '">' + icon('send', 15) + (o.sentAt ? ' ส่ง LINE อีกครั้ง' : ' ส่ง LINE') + '</button>' : '')
          + (o.invUrl ? '<a class="btn btn-sm btn-line" href="' + esc(o.invUrl) + '" target="_blank" rel="noopener">' + icon('pdf', 15) + ' Invoice ต้นฉบับ</a>' : '')
          + (o.pdfUrl ? '<a class="btn btn-sm btn-line" href="' + esc(o.pdfUrl) + '" target="_blank" rel="noopener">' + icon('pdf', 15) + ' PDF</a><a class="btn btn-sm btn-line" href="' + esc(xlsxDl(o.xlsxUrl)) + '" target="_blank" rel="noopener" download>' + icon('table', 15) + ' Excel</a>'
            : '<button class="btn btn-sm btn-line" data-exfiles="' + esc(o.id) + '">' + icon('pdf', 15) + ' สร้าง PDF / Excel</button>')
          + '<button class="btn btn-sm btn-line exdel" data-exdel="' + esc(o.id) + '">ลบ</button></div></div>';
      }).join('') : '<div class="panel pbox muted">' + (all.length ? 'ไม่มีออเดอร์ในสถานะนี้' : 'ยังไม่มีออเดอร์ต่างประเทศ — กด "นำเข้า Invoice"') + '</div>');
    on('[data-exf]', 'click', function (el) { C.filter = el.getAttribute('data-exf'); C.listPage(); });
    $('exNew').addEventListener('click', function () { var nb = document.querySelector('#nav button[data-page="a_ex"]'); if (nb) nb.click(); else C.importPage(); });
    on('[data-exed]', 'click', function (el) { editOrder(el.getAttribute('data-exed')); });
    on('[data-exsend]', 'click', function (el) { sendLine(el.getAttribute('data-exsend')); });
    on('[data-exfiles]', 'click', function (el) { makeFiles(el); });
    on('[data-exdel]', 'click', function (el) { delOrder(el.getAttribute('data-exdel')); });
    if (C.justSaved) { var js = C.justSaved; C.justSaved = null; if (d.line) sendLine(js, true); }
  };
  function byId(id) { return C.data.orders.filter(function (o) { return o.id === id; })[0]; }
  function editOrder(id) {
    var o = byId(id); if (!o) return;
    openModal({ color: state.dept.color, icon: 'edit', title: o.invNo + ' · ' + o.customer, sub: m2(o.amount) + ' ' + o.currency + ' · ' + (o.items || []).length + ' รายการ',
      body: '<label class="cpnl">วันส่งสินค้า (ETD)<input type="date" id="exD" value="' + esc(o.shipDate || '') + '"></label>'
        + '<label class="cpnl" id="exWhyL" hidden>เหตุผลที่เปลี่ยนวันส่ง<input id="exWhy" maxlength="120" placeholder="เช่น เรือเลื่อน / ลูกค้าขอเลื่อน"></label>'
        + '<div class="cpst3">' + Object.keys(STATUS).map(function (k) { return '<label><input type="radio" name="exS" value="' + k + '"' + ((o.status || '') === k ? ' checked' : '') + '><span>' + STATUS[k] + '</span></label>'; }).join('') + '</div>'
        + '<label class="cpnl">ปลายทาง<input id="exP" maxlength="120" value="' + esc(o.port || '') + '"></label>'
        + '<label class="cpnl">การขนส่ง<input id="exT" maxlength="60" value="' + esc(o.transport || '') + '"></label>'
        + '<label class="cpnl">หมายเหตุ<textarea id="exN" rows="2" maxlength="300">' + esc(o.note || '') + '</textarea></label>'
        + (o.history ? '<div class="cpmh2">ประวัติ</div>' + String(o.history).split(' | ').reverse().map(function (h) { return '<div class="cpmrow"><small>' + esc(h) + '</small></div>'; }).join('') : ''),
      ok: 'บันทึก',
      onOpen: function () { $('exD').addEventListener('change', function () { $('exWhyL').hidden = !(o.shipDate && $('exD').value !== o.shipDate); }); },
      submit: function () {
        var st = ($('mBody').querySelector('input[name=exS]:checked') || {}).value || '';
        return call('exUpdate', state.token, id, { shipDate: $('exD').value, status: st, port: $('exP').value, transport: $('exT').value, note: $('exN').value, reason: $('exWhy').value }).then(function (x) {
          if (!x.ok) return x.error;
          closeModal(); toast('บันทึกแล้ว');
          C.data.orders = C.data.orders.map(function (y) { return y.id === id ? x.order : y; }); C.listPage();
        });
      } });
  }
  function delOrder(id) {
    var o = byId(id); if (!o) return;
    ask({ title: 'ลบออเดอร์ ' + o.invNo + '?', text: 'ข้อมูล Invoice นี้และรายการสินค้าจะถูกลบออกจากระบบ (ถ้าแค่ยกเลิกออเดอร์ ให้ใช้ "แก้ไข" → ยกเลิก แทน)', ok: 'ลบ', tone: 'danger' }).then(function (yes) {
      if (!yes) return;
      call('exDelete', state.token, id).then(function (r) { if (!r.ok) { toast(r.error); return; } toast('ลบแล้ว'); C.data.orders = C.data.orders.filter(function (y) { return y.id !== id; }); C.listPage(); }).catch(onServerError);
    });
  }
  function makeFiles(el) {
    var id = el.getAttribute('data-exfiles'), o = byId(id);
    el.disabled = true; el.innerHTML = '<span class="spinner dark"></span> กำลังสร้างไฟล์';
    call('exMakeFiles', state.token, id).then(function (r) {
      if (!r.ok) { el.disabled = false; el.textContent = 'สร้าง PDF / Excel'; toast(r.error); return; }
      o.pdfUrl = r.pdfUrl; o.xlsxUrl = r.xlsxUrl; C.listPage();
    }).catch(onServerError);
  }
  // ส่ง LINE: สร้างภาพตารางก่อน ให้ดูตัวอย่างในหน้าต่าง แล้วค่อยกดส่ง (ผู้ใช้ขอ 24/11/69 — ดูภาพก่อนส่งทุกครั้ง)
  function sendLine(id, afterSave) {
    var o = byId(id); if (!o) return;
    var img = null;
    openModal({ color: state.dept.color, icon: 'send', wide: true, title: afterSave ? 'บันทึกแล้ว · ส่งออเดอร์เข้ากลุ่ม LINE เลยไหม?' : 'ส่งออเดอร์ต่างประเทศเข้ากลุ่ม LINE?',
      sub: o.invNo + ' · ' + o.customer + ' · ' + m2(o.amount) + ' ' + o.currency + (o.shipDate ? ' · ส่ง ' + slash(o.shipDate) : ' · ยังไม่กำหนดวันส่ง'),
      body: (o.sentAt ? '<div class="a7chk warn"><i>!</i><span>เคยส่งแล้วเมื่อ ' + esc(slash(String(o.sentAt).slice(0, 10)) + ' ' + String(o.sentAt).slice(11, 16) + ' น.') + ' — กดส่งอีกครั้งจะส่งซ้ำเข้ากลุ่ม</span></div>' : '')
        + '<p class="exsendh">จะส่ง 2 ข้อความ: <b>การ์ดใบแจ้งออเดอร์</b> และ <b>ภาพตารางด้านล่าง</b></p>'
        + '<div id="exPrev" class="exprev"><span class="spinner dark"></span> กำลังสร้างภาพตัวอย่าง…</div>',
      ok: 'ส่ง LINE', cancel: afterSave ? 'ไว้ทีหลัง' : 'ยกเลิก',
      onOpen: function () {
        var okb = $('mOk'); okb.disabled = true;
        lineImage(o).catch(function () { return null; }).then(function (r) {
          img = r; var box = $('exPrev'); if (!box) return;
          box.innerHTML = r ? '<img src="data:image/png;base64,' + r.png + '" alt="ภาพตารางออเดอร์ที่จะส่งเข้า LINE">' : '<div class="a7chk warn"><i>!</i><span>สร้างภาพตารางไม่ได้ — จะส่งเฉพาะการ์ด</span></div>';
          okb.disabled = false; okb.focus();
        });
      },
      submit: function () {
        return call('exSendLine', state.token, id, img ? img.png : '', img ? img.ratio : '').then(function (r) {
          if (!r.ok) return r.error || 'ส่งไม่สำเร็จ';
          closeModal(); o.sentAt = r.sentAt; if (r.pdfUrl) { o.pdfUrl = r.pdfUrl; o.xlsxUrl = r.xlsxUrl; } toast('ส่ง LINE แล้ว'); C.listPage();
        });
      } });
  }
  // ภาพตารางออเดอร์ (ส่ง LINE) — หน้าตาเหมือนในหน้าเว็บ มียอดเงิน (ผู้ใช้เลือก)
  function lineImage(o) {
    return script(H2C_URL, function () { return !!window.html2canvas; }).then(function () { return document.fonts ? document.fonts.ready : null; }).then(function () {
      var logo = document.querySelector('.brand-logo');
      var box = document.createElement('div'); box.className = 'eximgbox';
      box.innerHTML = '<div class="eximg"><div class="exih">' + (logo ? '<img src="' + logo.src + '" alt="">' : '') + '<div><b>ใบแจ้งออเดอร์ต่างประเทศ</b><span>บริษัท สปังกี้ ฟู้ด จำกัด · ' + esc(o.invNo) + '</span></div></div>'
        + '<div class="exig"><span>ลูกค้า</span><b>' + esc(o.customer) + '</b><span>วันที่ Invoice</span><b>' + slash(o.issueDate) + '</b><span>ปลายทาง</span><b>' + esc(o.port || '-') + '</b>'
        + '<span>วันส่งสินค้า (ETD)</span><b>' + (o.shipDate ? 'วัน' + dayOf(o.shipDate) + ' ' + slash(o.shipDate) : 'ยังไม่กำหนด') + '</b><span>Incoterms / ขนส่ง</span><b>' + esc([o.incoterms, o.transport].filter(Boolean).join(' · ') || '-') + '</b>'
        + '<span>สถานะ</span><b>' + STATUS[o.status || ''] + '</b></div>' + orderTable(o) + '</div>';
      document.body.appendChild(box);
      return window.html2canvas(box.firstChild, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }).then(function (cv) {
        document.body.removeChild(box);
        var w = cv.width, h = Math.min(cv.height, w * 3);
        return { png: cv.toDataURL('image/png').split(',')[1], ratio: w + ':' + h };
      }, function (e) { document.body.removeChild(box); throw e; });
    });
  }

  var css = document.createElement('style');
  css.textContent = [
    '.exform{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}.exform .exw{grid-column:1/-1}.exform .pf span{display:block;font-weight:600;font-size:13.5px;margin-bottom:4px}',
    '.exform input,.exform textarea{width:100%;padding:9px 11px;border:1.5px solid var(--line);border-radius:10px;font:inherit;background:#fff}.exform textarea{resize:vertical}',
    '.exit input{width:100%;min-width:60px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px}.exit .exn{min-width:200px}.exit .exc{min-width:80px}.exit .exq{text-align:right;min-width:80px}',
    '.extot{margin-top:10px;text-align:right;font-size:15px}.exsrc summary{cursor:pointer;font-weight:700;display:flex;gap:6px;align-items:center}.exsrc img{display:block;width:100%;max-width:760px;margin:10px auto 0;border:1px solid var(--line);border-radius:8px}',
    '.exo{margin-top:12px}.exoh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.exoh .cptag{margin-left:4px}.exam{font-size:18px;color:#1e3a8a;white-space:nowrap}',
    '.exmeta{color:var(--muted);font-size:13.5px;margin:4px 0}.exmeta b{color:var(--ink)}.exmeta .exwarn{color:#c2410c}.exnm{text-align:left!important}.expt{margin-top:8px;font-size:13.5px}.expt summary{cursor:pointer;color:var(--muted)}',
    '.exbtn{flex-wrap:wrap;gap:6px;margin-top:10px}.exbtn a.btn{text-decoration:none}#exNew{flex:0 0 auto}.exbtn .exdel{margin-left:auto;color:#b91c1c}',
    '.exsendh{margin:4px 0 10px;font-size:14px}.exprev{max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:12px;background:#fff;padding:6px;text-align:center;min-height:80px}.exprev img{width:100%;height:auto;display:block}',
    '.eximgbox{position:fixed;left:-3000px;top:0}.eximg{display:inline-block;width:900px;padding:22px;background:#fff;color:#0f172a;font-family:inherit}',
    '.exih{display:flex;gap:14px;align-items:center;border-bottom:3px solid #1e3a8a;padding-bottom:10px;margin-bottom:12px}.exih img{height:54px}.exih b{display:block;font-size:22px;color:#1e3a8a}.exih span{color:#475569;font-size:14px}',
    '.exig{display:grid;grid-template-columns:150px 1fr 150px 1fr;gap:6px 10px;font-size:14.5px;margin-bottom:14px}.exig span{color:#64748b}.eximg .cpwrap{overflow:visible}',
    '@media (max-width:700px){.exform{grid-template-columns:1fr}.exbtn .exdel{margin-left:0}}'
  ].join('');
  document.head.appendChild(css);
})();
