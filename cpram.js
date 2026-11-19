// ==================== ฝ่ายบัญชี — ใบสั่งซื้อ CP Ram (PDF) ====================
// เมนูในโมดูลบัญชี: "นำเข้า PO CP Ram" (a_cp) · "ตารางส่งสินค้า CP Ram" (a_cpl) — accounting.js เรียก ACCCP.importPage() / ACCCP.listPage()
// หน้าเว็บอ่าน PDF เอง (pdf.js): ตัวหนังสือไทยใน PDF ของ CPRAM อ่านไม่ได้ จึงเก็บเฉพาะตัวเลข/อังกฤษตามตำแหน่งบนหน้า
//   เลขที่เอกสาร + วันที่ (ขวาบน) · ส่งที่ (0400 / WD01 …) · แถวรายการ (ลำดับ เลขใบขอซื้อ รหัสสินค้า กำหนดส่ง จำนวน หน่วย ราคา จำนวนเงิน) · ยอดท้ายใบ
// ชื่อสินค้าจับจากรหัสสินค้า และคลัง/สถานที่ส่งจากข้อความ "ส่งที่" (ตั้งครั้งแรกในหน้าตรวจ แล้วระบบจำ) · API ใน AccCpram.gs
(function () {
  var C = window.ACCCP = { data: null, imp: null, month: '' };
  var PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var STATUS = { '': 'รอส่ง', done: 'ส่งสินค้าแล้ว', cancel: 'ยกเลิก' };

  function slash(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2); }
  function dayOf(iso) { var p = String(iso).split('-'); return DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function monthTh(ym) { var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[0] + 543); }
  function n0(v) { return Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function n2(v) { return Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || $('main')).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function chk(ok, text) { var c = ok === 'warn' ? 'warn' : ok ? 'ok' : 'bad'; return '<div class="a7chk ' + c + '"><i>' + (c === 'ok' ? '✓' : c === 'warn' ? '!' : '✕') + '</i><span>' + text + '</span></div>'; }
  function steps(n) {
    return '<ol class="a7steps">' + ['เลือกไฟล์ PDF', 'ตรวจข้อมูล', 'บันทึกลง Google Sheet'].map(function (t, i) {
      return '<li class="' + (i + 1 < n ? 'done' : i + 1 === n ? 'on' : '') + '"><i>' + (i + 1 < n ? '✓' : i + 1) + '</i>' + t + '</li>';
    }).join('') + '</ol>';
  }
  function msg(html, kind) { var el = $('cpMsg'); if (el) el.innerHTML = html ? '<div class="a7msg ' + (kind || '') + '">' + html + '</div>' : ''; }
  function load() { return call('cpLoad', state.token).then(function (d) { C.data = d; return d; }); }
  function loading(title) { $('main').innerHTML = '<h3>' + title + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูล…</div>'; }
  C.reset = function () { C.data = null; C.imp = null; C.month = ''; };

  // ==================== อ่าน PDF ====================
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = PDF_URL;
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; ok(); };
      s.onerror = function () { fail(new Error('โหลดตัวอ่าน PDF ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
      document.head.appendChild(s);
    });
  }
  var RX = { date: /^\d{2}\.\d{2}\.\d{4}$/, money: /^-?[\d,]+\.\d{2}$/, po: /^\d{9,10}$/, ship: /^\d{3,5}\s*\/\s*\S/, qtyUnit: /^([\d,]+(?:\.\d+)?)\s+([A-Z]{2,4})$/, unit: /^[A-Z]{2,4}$/, int: /^\d+$/ };
  function num(s) { return parseFloat(String(s).replace(/,/g, '')) || 0; }
  function isoOf(d) { var p = d.split('.'); return p[2] + '-' + p[1] + '-' + p[0]; }
  // items = [{x, y, s}] ของหน้าเดียว (y มาก = อยู่บน)
  C.parsePage = function (items) {
    items = items.filter(function (t) { return t.s && !/[\u0000-\u001f]/.test(t.s); }).map(function (t) { return { x: t.x, y: t.y, s: t.s.trim() }; });
    var topRight = items.filter(function (t) { return t.x > 380 && t.y > 560; }).sort(function (a, b) { return b.y - a.y; });
    var po = topRight.filter(function (t) { return RX.po.test(t.s); })[0];
    var pd = topRight.filter(function (t) { return RX.date.test(t.s); })[0];
    var term = topRight.filter(function (t) { return /^:\s*\d+$/.test(t.s); })[0];
    var ship = items.filter(function (t) { return RX.ship.test(t.s); })[0];
    var pg = items.filter(function (t) { return /^\d+\s*\/\s*\d+$/.test(t.s) && t.y > 700; })[0];
    // แถวรายการ: ยึดวันที่กำหนดส่ง (คอลัมน์กลาง) แล้วเก็บของในบรรทัดเดียวกัน
    var lines = items.filter(function (t) { return RX.date.test(t.s) && t.x > 200 && t.x < 360 && t.y < 590; }).map(function (d) {
      var row = items.filter(function (t) { return Math.abs(t.y - d.y) <= 3; }).sort(function (a, b) { return a.x - b.x; });
      var l = { deliveryDate: isoOf(d.s), lineNo: 0, prNo: '', itemCode: '', qty: 0, unit: '', price: 0, amount: 0 };
      var nums = [];
      row.forEach(function (t) {
        if (t.x < 35 && RX.int.test(t.s)) l.lineNo = +t.s;
        else if (t.x < 95 && RX.po.test(t.s)) l.prNo = t.s;
        else if (t.x >= 90 && t.x < 140 && /^\d{6,10}$/.test(t.s)) l.itemCode = t.s;
        else if (t.x > 330 && RX.qtyUnit.test(t.s)) { var m = t.s.match(RX.qtyUnit); l.qty = num(m[1]); l.unit = m[2]; }
        else if (t.x > 330 && t.x < 420 && /^[\d,]+$/.test(t.s) && !l.qty) l.qty = num(t.s);
        else if (t.x > 330 && RX.unit.test(t.s)) l.unit = t.s;
        else if (t.x > 400 && RX.money.test(t.s)) nums.push(num(t.s));
      });
      if (nums.length) { l.amount = nums[nums.length - 1]; l.price = nums[0] !== l.amount || nums.length === 1 ? nums[0] : 0; if (nums.length === 1) l.price = l.qty ? Math.round(l.amount / l.qty * 100) / 100 : 0; }
      l.y = d.y;
      return l;
    }).filter(function (l) { return l.lineNo; });
    var minY = lines.length ? Math.min.apply(null, lines.map(function (l) { return l.y; })) : 560;
    var tot = items.filter(function (t) { return t.x > 480 && t.y < minY - 15 && t.y > 150 && RX.money.test(t.s); }).sort(function (a, b) { return b.y - a.y; }).map(function (t) { return num(t.s); });
    var totals = tot.length >= 5 ? { sub: tot[0], discount: tot[1], vat: tot[3], net: tot[4] } : tot.length === 3 ? { sub: tot[0], vat: tot[1], net: tot[2] } : {};
    lines.forEach(function (l) { delete l.y; });
    return { poNo: po ? po.s : '', poDate: pd ? isoOf(pd.s) : '', termDays: term ? +term.s.replace(/\D/g, '') : '', shipTo: ship ? ship.s : '',
      pageOf: pg ? pg.s.replace(/\s/g, '') : '', lines: lines, totals: totals };
  };
  function readPdf(file) {
    return file.arrayBuffer().then(function (buf) { return window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise; }).then(function (doc) {
      var out = [], chain = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) (function (n) {
        chain = chain.then(function () { return doc.getPage(n); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
          var p = C.parsePage(tc.items.map(function (t) { return { x: Math.round(t.transform[4]), y: Math.round(t.transform[5]), s: t.str }; }));
          p.file = file.name; p.page = n;
          var prev = out[out.length - 1];
          if ((!p.poNo || (prev && prev.poNo === p.poNo)) && prev) { prev.lines = prev.lines.concat(p.lines); if (p.totals.sub != null) prev.totals = p.totals; }   // ใบสั่งหลายหน้า
          else out.push(p);
        });
      })(i);
      return chain.then(function () { return out; });
    });
  }
  function readFiles(files) {
    files = Array.prototype.filter.call(files, function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!files.length) { msg(icon('warn', 18) + ' เลือกไฟล์ PDF ใบสั่งซื้อของ CP Ram', 'bad'); return; }
    msg('<span class="spinner dark"></span> กำลังอ่าน ' + files.length + ' ไฟล์…');
    loadPdfJs().then(function () {
      return files.reduce(function (pr, f) { return pr.then(function (all) { return readPdf(f).then(function (x) { return all.concat(x); }); }); }, Promise.resolve([]));
    }).then(function (pos) {
      var bad = pos.filter(function (p) { return !p.poNo || !p.lines.length; });
      pos = pos.filter(function (p) { return p.poNo && p.lines.length; });
      if (!pos.length) throw new Error('ไม่พบใบสั่งซื้อ CP Ram ในไฟล์นี้ (ต้องเป็น PDF ที่ดาวน์โหลดจากระบบ ไม่ใช่ภาพสแกน)');
      C._lastPos = pos;
      C.imp = { fileName: files.map(function (f) { return f.name; }).join(', '), pos: pos, unread: bad.length };
      return runPreview();
    }).catch(function (e) { msg(icon('warn', 18) + ' ' + esc(e.message || String(e)), 'bad'); });
  }
  function runPreview() {
    return call('cpPreview', state.token, C.imp.pos).then(function (r) {
      if (!r.ok) throw new Error(r.error);
      C.imp.preview = r; previewPage();
    });
  }

  // ==================== หน้า 1: เลือกไฟล์ ====================
  C.importPage = function () {
    if (C.imp && C.imp.preview) return previewPage();
    if (!C.data) { loading('นำเข้า PO CP Ram'); load().then(C.importPage).catch(onServerError); return; }
    var d = C.data;
    $('main').innerHTML = '<h3>นำเข้าใบสั่งซื้อ CP Ram (PDF)</h3><p class="lead">เลือกไฟล์ PDF ใบสั่งซื้อจาก CPRAM (เลือกได้หลายไฟล์ · 1 หน้า = 1 ใบสั่ง) ระบบจะอ่านเลขที่ PO วันส่ง จำนวน และราคา ให้ตรวจก่อนบันทึก</p>'
      + steps(1) + linkPanel()
      + '<label class="a7drop" id="cpDrop" tabindex="0"><input type="file" id="cpFile" accept=".pdf,application/pdf" multiple hidden>'
      + '<span class="a7dic">' + icon('upload', 34) + '</span><b>แตะเพื่อเลือกไฟล์ PDF</b><span>หรือลากไฟล์มาวางตรงนี้ · ใบสั่งซื้อ (PURCHASE ORDER) ของ CP Ram</span></label>'
      + '<div id="cpMsg"></div>'
      + (d.imports.length ? '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('clock', 18) + ' นำเข้าล่าสุด</h4>' + d.imports.slice(0, 5).map(function (x) {
        return '<div class="cprow"><b>' + esc(String(x.createdAt).slice(0, 10) ? slash(String(x.createdAt).slice(0, 10)) : '') + '</b><span>' + esc(x.fileName) + '</span><small>' + n0(x.poCount) + ' ใบสั่ง · เพิ่ม ' + n0(x.added) + ' · อัปเดต ' + n0(x.changed) + '</small></div>';
      }).join('') + '</div>' : '');
    var inp = $('cpFile'), drop = $('cpDrop');
    inp.addEventListener('change', function () { if (inp.files.length) readFiles(inp.files); inp.value = ''; });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files); });
    bindLink();
  };
  function linkPanel() {
    var d = C.data;
    if (d.linked) return '<div class="panel status on cpst"><div class="dot">' + icon('check', 20) + '</div><div><b>บันทึกลง: ' + esc(d.sheetName) + '</b><span><a href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a> · <a href="#" id="cpRelink">เปลี่ยนไฟล์</a></span></div></div>';
    return '<div class="panel status off cpst"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + (d.error ? esc(d.error) : 'ยังไม่ได้เชื่อม Google Sheet "ตารางส่งสินค้า CP Ram"') + '</b>'
      + '<span>สร้าง Google Sheet ชื่อ "ตารางส่งสินค้า CP Ram" ในโฟลเดอร์ฝ่ายบัญชี แชร์ให้บัญชีระบบเป็นผู้แก้ไข แล้ววางลิงก์ที่นี่ (ตรวจไฟล์ได้ก่อน แต่บันทึกได้เมื่อเชื่อมแล้ว)</span>'
      + '<div class="cplink"><input id="cpUrl" placeholder="https://docs.google.com/spreadsheets/d/…"><button class="btn btn-primary" id="cpLinkBtn">เชื่อมไฟล์</button></div></div></div>';
  }
  function bindLink() {
    var rl = $('cpRelink');
    if (rl) rl.addEventListener('click', function (e) { e.preventDefault(); C.data.linked = false; C.data.error = ''; C.importPage(); });
    var b = $('cpLinkBtn');
    if (b) b.addEventListener('click', function () {
      var u = $('cpUrl').value.trim(); if (!u) { $('cpUrl').focus(); return; }
      b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      call('cpSetSheet', state.token, u).then(function (r) {
        if (!r.ok) { b.disabled = false; b.textContent = 'เชื่อมไฟล์'; toast(r.error); return; }
        toast('เชื่อม "' + r.sheetName + '" แล้ว'); return load().then(function () { if (C.imp && C.imp.preview) runPreview(); else C.importPage(); });
      }).catch(onServerError);
    });
  }

  // ==================== ตาราง (หน้าตาเหมือนไฟล์ Excel) ====================
  // rows เรียงตามวันส่ง · opt.preview = แสดงสถานะ ใหม่/มีแล้ว/เปลี่ยน · opt.edit = แตะแถวเพื่อแก้สถานะ
  function schedTable(rows, opt) {
    var groups = [], g = null;
    rows.forEach(function (r) { if (!g || g.date !== r.deliveryDate) { g = { date: r.deliveryDate, rows: [] }; groups.push(g); } g.rows.push(r); });
    var total = 0, body = groups.map(function (gr) {
      var sum = gr.rows.reduce(function (s, r) { return s + (r.status === 'cancel' ? 0 : Number(r.qty) || 0); }, 0), n = gr.rows.length;
      total += sum;
      var sameP = gr.rows.every(function (r) { return r.product === gr.rows[0].product; }), sameL = gr.rows.every(function (r) { return r.place === gr.rows[0].place; });
      return gr.rows.map(function (r, i) {
        var first = i === 0, rs = ' rowspan="' + n + '"', cancel = r.status === 'cancel';
        return '<tr class="' + (cancel ? 'cpx' : '') + (opt.edit ? ' cped' : '') + '"' + (opt.edit ? ' data-cpl="' + esc(r.id) + '" tabindex="0"' : '') + '>'
          + (first ? '<td' + rs + '>' + dayOf(gr.date) + '</td><td' + rs + '>' + slash(gr.date) + '</td>' : '')
          + (sameP ? (first ? '<td' + rs + ' class="cpp">' + pname(r) + '</td>' : '') : '<td class="cpp">' + pname(r) + '</td>')
          + '<td class="cpo">' + esc(r.poNo) + '</td><td>' + esc(r.wh || (r.place ? '-' : '?')) + '</td><td class="cpq">' + n0(r.qty) + '</td><td>' + esc(r.unitTh || r.unit || 'ลัง') + '</td>'
          + (first ? '<td' + rs + ' class="cpt">' + n0(sum) + '</td>' : '')
          + (sameL ? (first ? '<td' + rs + '>' + (r.place ? esc(r.place) : '<span class="cpq0">?</span>') + '</td>' : '') : '<td>' + (r.place ? esc(r.place) : '<span class="cpq0">?</span>') + '</td>')
          + (opt.noNote ? '' : '<td class="cpn">' + (opt.preview ? stateTag(r) : noteHtml(r)) + '</td>') + '</tr>';
      }).join('');
    }).join('');
    return '<div class="cpwrap"><table class="cptab"><thead><tr><th>วัน</th><th>วันที่</th><th>สินค้า</th><th>PO</th><th>คลัง</th><th>จำนวนสินค้า</th><th>หน่วย</th><th>Total</th><th>สถานที่ส่ง</th>' + (opt.noNote ? '' : '<th>' + (opt.preview ? 'สถานะ' : 'หมายเหตุ') + '</th>') + '</tr></thead>'
      + '<tbody>' + body + '</tbody><tfoot><tr><td colspan="4"></td><td class="cpy">Total</td><td class="cpy">' + n0(total) + '</td><td class="cpy">ลัง</td><td colspan="' + (opt.noNote ? 2 : 3) + '"></td></tr></tfoot></table></div>';
  }
  function pname(r) { return r.product ? esc(r.product) : '<span class="cpq0">รหัส ' + esc(r.itemCode) + '</span>'; }
  function histText(h) { var t = String(h).split(' | ').pop().replace(/^[\d-]+: /, ''); return /^เลื่อนส่ง/.test(t) ? '📅 ' + t : 'เปลี่ยน: ' + t; }
  function stateTag(r) {
    if (r.state === 'new') return '<span class="cptag new">ใหม่</span>';
    if (r.state === 'dup') return '<span class="cptag same">ซ้ำในไฟล์</span>';
    if (r.state === 'same') return '<span class="cptag same">มีแล้ว</span>';
    return '<span class="cptag chg">อัปเดต</span>' + r.diff.map(function (d) { return '<small>' + esc(d.f) + ' ' + esc(fmtV(d.from)) + ' → ' + esc(fmtV(d.to)) + '</small>'; }).join('');
  }
  function fmtV(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? slash(v) : String(v); }
  function noteHtml(r) {
    var t = r.status === 'done' ? '<span class="cptag done">*ส่งสินค้าแล้ว</span>' : r.status === 'cancel' ? '<span class="cptag cancel">ยกเลิก</span>' : '';
    return t + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + (r.history ? '<small class="cph">' + esc(histText(r.history)) + '</small>' : '');
  }
  function roundsTable(rounds) {
    if (!rounds.length) return '';
    var sum = rounds.reduce(function (s, x) { return s + x.total; }, 0);
    return '<div class="cpwrap"><table class="cptab cpr"><thead><tr><th>รอบเงินเข้า</th><th>จำนวน</th><th>ราคา</th><th>ยอดเงิน</th><th>Vat 7%</th><th>Total</th></tr></thead><tbody>'
      + rounds.map(function (x) { return '<tr><td>' + slash(x.dueDate) + '</td><td>' + n0(x.qty) + '</td><td>' + (x.price === '' ? '-' : n2(x.price)) + '</td><td>' + n2(x.amount) + '</td><td>' + n2(x.vat) + '</td><td><b>' + n2(x.total) + '</b></td></tr>'; }).join('')
      + '</tbody><tfoot><tr><td colspan="4"></td><td class="cpy">รวม</td><td class="cpy">' + n2(sum) + '</td></tr></tfoot></table></div>';
  }
  function kpis(list) {
    var a = list.filter(function (r) { return r.status !== 'cancel'; }), amt = a.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    var pos = {}; a.forEach(function (r) { pos[r.poNo] = 1; });
    var tile = function (v, l, c) { return '<div class="kpi" style="--k:' + c + '"><b>' + v + '</b><span>' + l + '</span></div>'; };
    return '<div class="kpis xk">' + tile(n0(Object.keys(pos).length), 'ใบสั่งซื้อ', '#2563eb') + tile(n0(a.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0)), 'ลัง', '#16a34a')
      + tile('฿' + n0(amt), 'มูลค่า (ก่อน VAT)', '#d97706') + tile('฿' + n0(amt * 1.07), 'รวม VAT 7%', '#7c3aed') + '</div>';
  }

  // ==================== หน้า 2: ตรวจข้อมูลก่อนบันทึก ====================
  function previewPage() {
    var I = C.imp, r = I.preview, rows = r.rows;
    var cnt = { new: 0, same: 0, changed: 0, dup: 0 }; rows.forEach(function (x) { cnt[x.state]++; });
    var unP = r.unmatchedProducts, unS = r.unmatchedShips, todo = cnt.new + cnt.changed;
    var linked = C.data && C.data.linked;
    var checks = [chk(true, 'อ่านได้ ' + r.poCount + ' ใบสั่งซื้อ · ' + rows.length + ' รายการ' + (I.unread ? ' (มี ' + I.unread + ' หน้าที่อ่านไม่ได้)' : ''))];
    checks.push(r.checks.length ? chk('warn', r.checks.map(esc).join('<br>')) : chk(true, 'ยอดเงินตรงกับท้ายใบสั่งซื้อทุกใบ (จำนวน × ราคา, รวม, VAT 7%)'));
    checks.push(chk(!unP.length, unP.length ? 'มี ' + unP.length + ' รหัสสินค้าที่ยังไม่รู้จัก — ใส่ชื่อสินค้าด้านล่าง' : 'จับคู่ชื่อสินค้าจากรหัสได้ครบ'));
    checks.push(chk(!unS.length, unS.length ? 'มี ' + unS.length + ' สถานที่ส่งที่ยังไม่รู้จัก — ใส่คลัง / สถานที่ส่งด้านล่าง' : 'จับคู่คลัง / สถานที่ส่งได้ครบ'));
    checks.push(todo ? chk(true, 'ใหม่ ' + cnt.new + ' รายการ' + (cnt.changed ? ' · อัปเดต ' + cnt.changed + ' รายการ (PO เดิมที่วันส่ง/จำนวนเปลี่ยน)' : '') + (cnt.same ? ' · มีในระบบแล้ว ' + cnt.same + ' (ข้าม)' : ''))
      : chk(false, 'ใบสั่งซื้อทุกใบมีในระบบแล้ว ไม่มีอะไรเปลี่ยน'));
    if (!linked) checks.push(chk(false, 'ยังไม่ได้เชื่อม Google Sheet — เชื่อมไฟล์ก่อนกดบันทึก'));
    var fix = '';
    if (unP.length || unS.length) {
      fix = '<div class="panel pbox a7fix"><h4>' + icon('warn', 18) + ' ตั้งค่าครั้งแรก (ระบบจำไว้ใช้ครั้งต่อไป)</h4>'
        + unP.map(function (u, i) { return '<div class="a7fixrow"><span>รหัสสินค้า <b>' + esc(u.itemCode) + '</b> <small>(' + n0(u.qty) + ' ลัง)</small></span><input data-cpp="' + i + '" list="cpPL" placeholder="ชื่อสินค้า เช่น น้ำพริกหนังไก่กรอบ"></div>'; }).join('')
        + unS.map(function (u, i) { return '<div class="a7fixrow cps"><span>ส่งที่ <b>' + esc(u.shipTo) + '</b> <small>(PO ' + esc(u.pos.slice(0, 3).join(', ')) + (u.pos.length > 3 ? ' …' : '') + ')</small></span><input data-cpw="' + i + '" placeholder="คลัง เช่น ขอนแก่น / -"><input data-cps="' + i + '" list="cpSL" placeholder="สถานที่ส่ง เช่น คล้ายนคร"></div>'; }).join('')
        + '<datalist id="cpPL">' + r.map.products.map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('') + '</datalist>'
        + '<datalist id="cpSL">' + uniq(r.map.ships.map(function (s) { return s.place; }).concat(['ลาดหลุมแก้ว', 'คล้ายนคร'])).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>'
        + '<button class="btn btn-primary" id="cpMapSave">' + icon('check', 16) + ' บันทึกการจับคู่ แล้วตรวจใหม่</button></div>';
    }
    var live = rows.filter(function (x) { return x.state !== 'dup'; });
    var canSave = linked && todo > 0 && !unP.length && !unS.length;
    $('main').innerHTML = '<h3>ตรวจข้อมูล PO CP Ram ก่อนบันทึก</h3><p class="lead">' + esc(I.fileName) + ' · ตรวจตัวเลขกับใบสั่งซื้อ ถ้าถูกต้องกดบันทึก</p>'
      + steps(2) + (linked ? '' : linkPanel())
      + '<div class="panel pbox a7checks"><h4>' + icon('check', 18) + ' ผลการตรวจไฟล์</h4>' + checks.join('') + '</div>'
      + fix + kpis(live)
      + '<div class="panel pbox"><h4>' + icon('table', 18) + ' ตารางส่งสินค้า (ตามกำหนดส่งในใบสั่งซื้อ)</h4>' + schedTable(live, { preview: true }) + '</div>'
      + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' รอบเงินเข้า <small class="muted">(เหมือน CP ALL: ส่งวันที่ 1–15 → วันที่ 10 เดือนถัดไป · 16–31 → วันที่ 25 · ตรงวันหยุดเลื่อนเป็นวันทำการถัดไป)</small></h4>' + roundsTable(r.rounds) + '</div>'
      + '<div id="cpMsg"></div>'
      + '<div class="a7bar"><button class="btn btn-line" id="cpBack">' + icon('back', 16) + ' เลือกไฟล์ใหม่</button>'
      + '<button class="btn btn-primary" id="cpSave"' + (canSave ? '' : ' disabled') + '>' + icon('check', 18) + (canSave ? ' ข้อมูลถูกต้อง บันทึก ' + todo + ' รายการ' : !todo ? ' ไม่มีรายการใหม่' : !linked ? ' เชื่อม Google Sheet ก่อน' : ' ตั้งค่าที่ขาดก่อน') + '</button></div>';
    $('cpBack').addEventListener('click', function () { C.imp = null; C.importPage(); });
    $('cpSave').addEventListener('click', save);
    var ms = $('cpMapSave');
    if (ms) ms.addEventListener('click', function () {
      var cfg = { products: [], ships: [] }, miss = 0;
      unP.forEach(function (u, i) { var v = $('main').querySelector('[data-cpp="' + i + '"]').value.trim(); if (v) cfg.products.push({ code: u.itemCode, name: v }); else miss++; });
      unS.forEach(function (u, i) {
        var w = $('main').querySelector('[data-cpw="' + i + '"]').value.trim(), p = $('main').querySelector('[data-cps="' + i + '"]').value.trim();
        if (p) cfg.ships.push({ key: shipKey(u.shipTo), wh: w || '-', place: p }); else miss++;
      });
      if (miss) { toast('ใส่ให้ครบทุกช่องก่อน'); return; }
      ms.disabled = true; ms.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
      call('cpSaveMap', state.token, JSON.stringify(cfg)).then(function (x) { if (!x.ok) throw new Error(x.error); return runPreview(); }).catch(function (e) { ms.disabled = false; toast(e.message); });
    });
    bindLink();
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { return x && !s[x] && (s[x] = 1); }); }
  // "0400 / WD01 LLKC RM WHD" → "WD01 LLKC" (คำที่ใช้จับคู่ — ตัดรหัสโรงงานและคำท้ายทั่วไปออก)
  function shipKey(s) { var t = String(s).replace(/^\d+\s*\/\s*/, '').trim().split(/\s+/); return t.slice(0, 2).join(' ') || s; }
  function save() {
    var b = $('cpSave'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังบันทึกลง Google Sheet';
    call('cpSave', state.token, C.imp.pos, C.imp.fileName).then(function (r) {
      if (!r.ok) { b.disabled = false; b.textContent = 'บันทึก'; msg(icon('warn', 18) + ' ' + esc(r.error), 'bad'); return; }
      C.imp = null;
      toast('บันทึกแล้ว: ใหม่ ' + r.added + ' · อัปเดต ' + r.changed);
      C.month = r.months[0] || ''; C.data = null; C.justSaved = r.importId;
      var nb = document.querySelector('#nav button[data-page="a_cpl"]');
      if (nb) nb.click(); else C.listPage();
    }).catch(onServerError);
  }

  // ==================== หน้าตารางส่งสินค้า (รายเดือน) ====================
  C.listPage = function () {
    if (!C.data) { loading('ตารางส่งสินค้า CP Ram'); load().then(C.listPage).catch(onServerError); return; }
    var d = C.data, lines = d.lines.slice().sort(function (a, b) { return String(a.deliveryDate).localeCompare(String(b.deliveryDate)) || String(a.poNo).localeCompare(String(b.poNo)) || a.lineNo - b.lineNo; });
    if (!d.linked) { C.importPage(); return; }
    var months = uniq(lines.map(function (x) { return String(x.deliveryDate).slice(0, 7); })).filter(Boolean);
    var cur = d.today.slice(0, 7);
    if (!C.month || months.indexOf(C.month) < 0) C.month = months.indexOf(cur) >= 0 ? cur : (months.filter(function (m) { return m > cur; })[0] || months[months.length - 1] || cur);
    var rows = lines.filter(function (x) { return String(x.deliveryDate).slice(0, 7) === C.month; });
    var rounds = roundsOf(rows);
    $('main').innerHTML = '<h3>ตารางส่งสินค้า CP Ram</h3><p class="lead">แตะแถวเพื่อบันทึกว่าส่งสินค้าแล้ว / ยกเลิก / หมายเหตุ · ข้อมูลอยู่ใน <a href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">' + esc(d.sheetName) + '</a> (แท็บรายเดือนสร้างให้อัตโนมัติ)</p>'
      + linePanel(d) + movesPanel(d)
      + '<div class="pchips cpchips">' + (months.length ? months.map(function (m) { return '<button class="chip' + (m === C.month ? ' on' : '') + '" data-cpm="' + m + '">' + monthTh(m) + '</button>'; }).join('') : '<span class="muted">ยังไม่มีข้อมูล — นำเข้า PO ก่อน</span>') + '</div>'
      + (rows.length ? kpis(rows)
        + '<div class="panel pbox"><h4 class="cph4">' + icon('table', 18) + ' ตารางส่งสินค้า CP Ram ' + monthTh(C.month) + '<button class="btn btn-sm btn-line" id="cpMonthFiles">' + icon('pdf', 15) + ' PDF / Excel ทั้งเดือน</button></h4>' + schedTable(rows, { edit: true }) + '</div>'
        + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' รอบเงินเข้า</h4>' + roundsTable(rounds) + '</div>' : '');
    on('[data-cpm]', 'click', function (el) { C.month = el.getAttribute('data-cpm'); C.listPage(); });
    on('[data-cpsend]', 'click', function (el) { sendLine(el.getAttribute('data-cpsend')); });
    on('[data-cpmv]', 'click', function (el) { sendMove(el.getAttribute('data-cpmv')); });
    on('[data-cpfiles]', 'click', function (el) { makeFiles(el); });
    var mf = $('cpMonthFiles'); if (mf) mf.addEventListener('click', function () { monthFiles(mf); });
    if (C.justSaved) { var js = C.justSaved; C.justSaved = null; if (d.line) sendLine(js, true); }
    on('[data-cpl]', 'click', function (el) { editLine(el.getAttribute('data-cpl')); });
    on('[data-cpl]', 'keydown', function (el, e) { if (e.key === 'Enter') editLine(el.getAttribute('data-cpl')); });
  };
  // ---------- ส่ง LINE (ใบแจ้งออเดอร์ CP Ram — เฉพาะออเดอร์ ไม่มียอดเงิน) ----------
  function linePanel(d) {
    if (!d.imports.length) return '';
    return '<div class="panel pbox cpline"><h4>' + icon('send', 18) + ' ส่งออเดอร์เข้ากลุ่ม LINE <small class="muted">(ส่งเฉพาะออเดอร์ ไม่มียอดเงิน / รอบเงินเข้า)</small></h4>'
      + (d.line ? '' : '<p class="muted" style="margin:0 0 8px">ยังไม่ได้ตั้งค่า LINE ของฝ่ายบัญชี — ตั้งในเมนู "ตั้งค่าศูนย์ / สินค้า 7-11 / LINE"</p>')
      + d.imports.slice(0, 4).map(function (x) {
        return '<div class="cprow cpimp"><span><b>นำเข้า ' + slash(String(x.createdAt).slice(0, 10)) + ' ' + esc(String(x.createdAt).slice(11, 16)) + '</b><small>' + esc(x.fileName) + ' · ใหม่ ' + n0(x.added) + ' · อัปเดต ' + n0(x.changed) + ' · ' + n0(x.qty) + ' ลัง</small></span>'
          + (x.sentAt ? '<span class="cptag done">ส่งแล้ว ' + esc(String(x.sentAt).slice(11, 16)) + '</span>' : '<span class="cptag">ยังไม่ส่ง</span>')
          + (x.pdfUrl ? fileLinks(x.pdfUrl, x.xlsxUrl) : (+x.added || +x.changed) ? '<button class="btn btn-sm btn-line" data-cpfiles="' + esc(x.id) + '">' + icon('pdf', 15) + ' PDF / Excel</button>' : '')
          + (d.line && (+x.added || +x.changed) ? '<button class="btn btn-sm ' + (x.sentAt ? 'btn-line' : 'btn-primary') + '" data-cpsend="' + esc(x.id) + '">' + icon('send', 15) + (x.sentAt ? ' ส่งอีกครั้ง' : ' ส่ง LINE') + '</button>' : '') + '</div>';
      }).join('') + '</div>';
  }
  function xlsxDl(u) { var m = String(u || '').match(/[-\w]{25,}/); return m ? 'https://drive.google.com/uc?export=download&id=' + m[0] : u; }
  function fileLinks(pdf, xlsx) {
    return '<span class="cpfl">' + (pdf ? '<a class="btn btn-sm btn-line" href="' + esc(pdf) + '" target="_blank" rel="noopener">' + icon('pdf', 15) + ' PDF</a>' : '')
      + (xlsx ? '<a class="btn btn-sm btn-line" href="' + esc(xlsxDl(xlsx)) + '" target="_blank" rel="noopener" download>' + icon('table', 15) + ' Excel</a>' : '') + '</span>';
  }
  function makeFiles(el) {
    var id = el.getAttribute('data-cpfiles'), x = C.data.imports.filter(function (i) { return i.id === id; })[0];
    el.disabled = true; el.innerHTML = '<span class="spinner dark"></span> กำลังสร้างไฟล์';
    call('cpMakeImportFiles', state.token, id).then(function (r) {
      if (!r.ok) { el.disabled = false; el.textContent = 'PDF / Excel'; toast(r.error); return; }
      x.pdfUrl = r.pdfUrl; x.xlsxUrl = r.xlsxUrl; C.listPage();
    }).catch(onServerError);
  }
  function monthFiles(el) {
    el.disabled = true; el.innerHTML = '<span class="spinner dark"></span> กำลังสร้างไฟล์';
    call('cpMonthFiles', state.token, C.month).then(function (r) {
      if (!r.ok) { el.disabled = false; el.textContent = 'PDF / Excel ทั้งเดือน'; toast(r.error); return; }
      el.outerHTML = fileLinks(r.pdfUrl, r.xlsxUrl);
    }).catch(onServerError);
  }
  function sendLine(id, afterSave) {
    var x = C.data.imports.filter(function (i) { return i.id === id; })[0]; if (!x) return;
    ask({ title: afterSave ? 'บันทึกแล้ว · ส่งออเดอร์เข้ากลุ่ม LINE เลยไหม?' : 'ส่งออเดอร์ CP Ram เข้ากลุ่ม LINE?', text: 'ใบแจ้งออเดอร์ ' + n0(+x.added + +x.changed) + ' รายการ · ' + n0(x.qty) + ' ลัง (ไม่มียอดเงิน)' + (x.sentAt ? ' · เคยส่งแล้วเมื่อ ' + x.sentAt : ''), ok: 'ส่ง LINE', cancel: afterSave ? 'ไว้ทีหลัง' : 'ยกเลิก', tone: 'info' }).then(function (yes) {
      if (!yes) return;
      toast('กำลังสร้างภาพตารางและส่ง LINE…');
      var lines = C.data.lines.filter(function (l) { return l.importId === id; });
      lineImage(lines).catch(function () { return null; }).then(function (img) {
        return call('cpSendLine', state.token, id, img ? img.png : '', img ? img.ratio : '');
      }).then(function (r) {
        if (!r.ok) { toast(r.error); return; }
        x.sentAt = r.sentAt; if (r.pdfUrl) { x.pdfUrl = r.pdfUrl; x.xlsxUrl = r.xlsxUrl; } toast('ส่ง LINE แล้ว'); C.listPage();
      }).catch(onServerError);
    });
  }
  // ภาพตารางส่งสินค้า (หน้าตาเดียวกับในหน้าเว็บ ไม่มียอดเงิน) สำหรับส่ง LINE — html2canvas
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  function lineImage(lines) {
    if (!lines.length) return Promise.resolve(null);
    var ready = window.html2canvas ? Promise.resolve() : new Promise(function (ok, fail) { var sc = document.createElement('script'); sc.src = H2C_URL; sc.onload = ok; sc.onerror = fail; document.head.appendChild(sc); });
    return ready.then(function () { return document.fonts ? document.fonts.ready : null; }).then(function () {
      var rows = lines.slice().sort(function (a, b) { return String(a.deliveryDate).localeCompare(String(b.deliveryDate)) || String(a.poNo).localeCompare(String(b.poNo)) || a.lineNo - b.lineNo; });
      var dates = uniq(rows.map(function (r) { return r.deliveryDate; })), pos = uniq(rows.map(function (r) { return r.poNo; }));
      var box = document.createElement('div'); box.className = 'cpimgbox';
      box.innerHTML = '<div class="cpimg"><div class="cpimh"><b>ตารางส่งสินค้า CP Ram</b><span>ส่ง ' + slash(dates[0]) + (dates.length > 1 ? ' – ' + slash(dates[dates.length - 1]) : '') + ' · ' + pos.length + ' ใบสั่งซื้อ</span></div>' + schedTable(rows, { noNote: !rows.some(function (r) { return r.status === 'cancel' || r.note || r.history; }) }) + '</div>';
      document.body.appendChild(box);
      return window.html2canvas(box.firstChild, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (cv) {
        document.body.removeChild(box);
        var w = cv.width, h = Math.min(cv.height, w * 3), url = cv.toDataURL('image/png');
        return { png: url.split(',')[1], ratio: w + ':' + h };
      }, function (e) { document.body.removeChild(box); throw e; });
    });
  }
  function roundsOf(rows) {
    var by = {};
    rows.forEach(function (r) {
      if (r.status === 'cancel' || !r.dueDate) return;
      var o = by[r.dueDate] = by[r.dueDate] || { dueDate: r.dueDate, qty: 0, amount: 0, prices: {} };
      o.qty += Number(r.qty) || 0; o.amount += Number(r.amount) || 0; o.prices[r.price] = 1;
    });
    return Object.keys(by).sort().map(function (k) { var o = by[k], pr = Object.keys(o.prices); return { dueDate: k, qty: o.qty, price: pr.length === 1 ? Number(pr[0]) : '', amount: o.amount, vat: o.amount * 0.07, total: o.amount * 1.07 }; });
  }
  function editLine(id) {
    var r = C.data.lines.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var mv = (C.data.moves || []).filter(function (m) { return m.lineId === id; });
    openModal({ color: state.dept.color, icon: 'edit', title: 'PO ' + r.poNo, sub: (r.product || '') + ' · ' + n0(r.qty) + ' ' + (r.unit || 'ลัง') + (r.place ? ' · ' + r.place : ''),
      body: '<label class="cpnl">วันที่ส่ง<input type="date" id="cpDate" value="' + esc(r.deliveryDate) + '"></label>'
        + '<div id="cpMoveBox" class="cpmove" hidden><div class="cpmh">📅 เลื่อนส่งจาก <b>' + slash(r.deliveryDate) + '</b> เป็น <b id="cpNewD"></b></div>'
        + '<label class="cpnl">เหตุผลที่เลื่อนส่ง <span class="req">*</span><input id="cpWhy" maxlength="200" list="cpWhyL" placeholder="เช่น ลูกค้าขอเลื่อน / คลังเต็ม"></label>'
        + '<datalist id="cpWhyL"><option value="ลูกค้า (CP Ram) ขอเลื่อน"><option value="สินค้ายังผลิตไม่ทัน"><option value="คลังลูกค้าเต็ม"><option value="รถขนส่งไม่ว่าง"></datalist>'
        + (C.data.line ? '<label class="cpchk"><input type="checkbox" id="cpNotify" checked> ส่ง LINE แจ้งเลื่อนส่งเข้ากลุ่มด้วย</label>' : '') + '</div>'
        + '<div class="cpst3">' + Object.keys(STATUS).map(function (k) { return '<label><input type="radio" name="cpS" value="' + k + '"' + ((r.status || '') === k ? ' checked' : '') + '><span>' + STATUS[k] + '</span></label>'; }).join('') + '</div>'
        + '<label class="cpnl">หมายเหตุ<textarea id="cpNote" rows="2" maxlength="200">' + esc(r.note || '') + '</textarea></label>'
        + (mv.length ? '<div class="cpmh2">ประวัติเลื่อนส่ง</div>' + mv.map(function (m) {
          return '<div class="cpmrow"><span>' + slash(m.fromDate) + ' → <b>' + slash(m.toDate) + '</b> · ' + esc(m.reason) + '</span><small>' + esc(String(m.createdAt).slice(0, 16)) + (m.sentAt ? ' · ส่ง LINE แล้ว' : '') + '</small></div>'; }).join('') : ''),
      ok: 'บันทึก',
      onOpen: function () {
        var d = $('cpDate'), box = $('cpMoveBox');
        d.addEventListener('change', function () { var ch = d.value && d.value !== r.deliveryDate; box.hidden = !ch; if (ch) { $('cpNewD').textContent = slash(d.value); $('cpWhy').focus(); } });
      },
      check: function () {
        var d = $('cpDate').value;
        if (!d) return 'เลือกวันที่ส่ง';
        if (d !== r.deliveryDate && !$('cpWhy').value.trim()) return 'ใส่เหตุผลที่เลื่อนส่ง';
        return '';
      },
      submit: function () {
        var st = ($('mBody').querySelector('input[name=cpS]:checked') || {}).value || '', d = $('cpDate').value, moved = d !== r.deliveryDate;
        var notify = moved && $('cpNotify') && $('cpNotify').checked;
        return call('cpUpdateLine', state.token, id, st, $('cpNote').value, moved ? d : '', moved ? $('cpWhy').value : '').then(function (x) {
          if (!x.ok) return x.error;
          r.status = st; r.note = $('cpNote').value.trim();
          if (x.moveId) { r.deliveryDate = x.deliveryDate; r.dueDate = x.dueDate; r.history = x.history; C.month = String(x.deliveryDate).slice(0, 7); }
          closeModal();
          if (!x.moveId || !notify) { toast(x.moveId ? 'บันทึกการเลื่อนส่งแล้ว' : 'บันทึกแล้ว'); C.data = null; C.listPage(); return; }
          toast('บันทึกแล้ว · กำลังส่ง LINE แจ้งเลื่อนส่ง…');
          return call('cpSendMoveLine', state.token, x.moveId).then(function (y) { toast(y.ok ? 'ส่ง LINE แจ้งเลื่อนส่งแล้ว' : y.error); C.data = null; C.listPage(); });
        });
      } });
  }
  // กล่องประวัติเลื่อนส่งล่าสุด (หน้าตารางส่งสินค้า) — ส่ง LINE ย้อนหลังได้
  function movesPanel(d) {
    var mv = (d.moves || []).slice(0, 5); if (!mv.length) return '';
    return '<div class="panel pbox cpline"><h4>📅 ประวัติเลื่อนส่งล่าสุด</h4>' + mv.map(function (m) {
      return '<div class="cprow cpimp"><span><b>PO ' + esc(m.poNo) + ' · ' + slash(m.fromDate) + ' → ' + slash(m.toDate) + '</b><small>' + esc(m.product || '') + ' · ' + n0(m.qty) + ' ' + esc(m.unit || 'ลัง') + ' · ' + esc(m.reason) + '</small></span>'
        + (m.sentAt ? '<span class="cptag done">ส่ง LINE แล้ว</span>' : '<span class="cptag">ยังไม่ส่ง</span>')
        + (d.line ? '<button class="btn btn-sm ' + (m.sentAt ? 'btn-line' : 'btn-primary') + '" data-cpmv="' + esc(m.id) + '">' + icon('send', 15) + (m.sentAt ? ' ส่งอีกครั้ง' : ' ส่ง LINE') + '</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function sendMove(id) {
    var m = C.data.moves.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    ask({ title: 'ส่ง LINE แจ้งเลื่อนส่ง?', text: 'PO ' + m.poNo + ' · ' + slash(m.fromDate) + ' → ' + slash(m.toDate), ok: 'ส่ง LINE', tone: 'info' }).then(function (yes) {
      if (!yes) return;
      call('cpSendMoveLine', state.token, id).then(function (r) { if (!r.ok) return toast(r.error); m.sentAt = r.sentAt; toast('ส่ง LINE แล้ว'); C.listPage(); }).catch(onServerError);
    });
  }

  var css = document.createElement('style');
  css.textContent = [
    '.cpwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}',
    '.cptab{border-collapse:collapse;width:100%;min-width:760px;font-size:14.5px;background:#fff}.cptab.cpr{min-width:520px}',
    '.cptab th{background:#C6E0B4;font-weight:700;padding:7px 6px;border:1px solid #1f2937;white-space:nowrap}',
    '.cptab td{border:1px solid #1f2937;padding:6px;text-align:center;vertical-align:middle}',
    '.cptab tfoot td{border:0;padding-top:10px}.cptab td.cpy{background:#FFFF00;font-weight:700}',
    '.cptab .cpp{white-space:nowrap}.cptab .cpt{font-weight:700;font-size:16px}.cptab .cpq{font-variant-numeric:tabular-nums}.cptab .cpo{font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.cptab .cpn{text-align:left;min-width:150px}.cptab .cpn small{display:block;color:#64748b;font-size:12.5px;line-height:1.35}.cptab .cpn small.cph{color:#b45309}',
    '.cptab tr.cpx td{color:#9ca3af}.cptab tr.cpx .cpq{text-decoration:line-through}',
    '.cptab tr.cped{cursor:pointer}.cptab tr.cped:hover td,.cptab tr.cped:focus td{background:#f0fdf4;outline:none}',
    '.cpq0{color:#dc2626;font-weight:700}',
    '.cptag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12.5px;font-weight:700;background:#e2e8f0;color:#334155}',
    '.cptag.new{background:#dcfce7;color:#166534}.cptag.chg{background:#ffedd5;color:#9a3412}.cptag.done{background:#dcfce7;color:#166534}.cptag.cancel{background:#fee2e2;color:#991b1b}',
    '.cprow{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid var(--line)}.cprow:last-child{border:0}.cprow small{color:var(--muted)}',
    '.cpst{margin-bottom:12px}.cpst a{color:var(--c);font-weight:600}.cplink{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.cplink input{flex:1;min-width:220px;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.a7fixrow.cps{flex-wrap:wrap}.a7fixrow input{padding:9px 11px;border:1.5px solid var(--line);border-radius:10px;font:inherit;min-width:0;flex:1}.a7fixrow.cps input{flex:1 1 140px}',
    '.cpnl{display:block;font-weight:600}.cpnl textarea{display:block;width:100%;margin-top:5px;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-weight:400}.kpis.xk{grid-template-columns:repeat(4,1fr)}@media (max-width:860px){.kpis.xk{grid-template-columns:repeat(2,1fr)}}',
    '.cpline h4{flex-wrap:wrap}.cpline h4 small{font-weight:400;font-size:12.5px;flex-basis:100%;margin-left:24px}.cpimp{align-items:center;flex-wrap:wrap}.cpimp>span:first-child{flex:1 1 220px;min-width:0}.cpimp .btn{flex:none;width:auto;white-space:nowrap}.cpimp .cptag{flex:none}.cpimp small{display:block}',
    '.cpimgbox{position:fixed;left:-3000px;top:0}.cpimg{display:inline-block;width:auto;min-width:640px;padding:20px;background:#fff;font-family:inherit}.cpimh{gap:24px}.cpimg .cpwrap{overflow:visible;margin:0;padding:0}.cpimg .cptab{font-size:18px;min-width:0}.cpimg .cptab th,.cpimg .cptab td{padding:8px 6px}.cpimg .cptab .cpt{font-size:20px}.cpimh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}.cpimh b{font-size:22px}.cpimh span{color:#475569;font-size:15px}',
    '.cpfl{display:inline-flex;gap:6px;flex:none}.cpfl .btn{width:auto;text-decoration:none}.cph4{flex-wrap:wrap}.cph4 .btn,.cph4 .cpfl{margin-left:auto;width:auto}',
    '.cpnl input{display:block;width:100%;margin-top:5px;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-weight:400}.cpnl{margin-bottom:12px}.cpnl .req{color:#dc2626}',
    '.cpmove{border:1.5px solid #fdba74;background:#fff7ed;border-radius:12px;padding:12px;margin-bottom:12px}.cpmh{color:#9a3412;margin-bottom:8px}.cpchk{display:flex;gap:8px;align-items:center;font-weight:600;color:#9a3412}.cpchk input{width:18px;height:18px}',
    '.cpmh2{font-weight:700;margin:6px 0 4px}.cpmrow{padding:6px 0;border-top:1px solid var(--line);font-size:14px}.cpmrow small{display:block;color:var(--muted)}',
    '#cpMapSave{margin-top:10px}.cpchips{margin:4px 0 12px}',
    '.cpst3{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.cpst3 label{flex:1 1 30%}.cpst3 input{position:absolute;opacity:0}.cpst3 span{display:block;text-align:center;padding:11px 8px;border:1.5px solid var(--line);border-radius:12px;font-weight:600;cursor:pointer}',
    '.cpst3 input:checked+span{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,white);color:var(--c)}.cpst3 input:focus-visible+span{outline:2px solid var(--c)}'
  ].join('\n');
  document.head.appendChild(css);
})();
