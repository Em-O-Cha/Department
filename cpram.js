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
  function load() { return call('cpLoad', state.token).then(function (d) { C.data = d; C.loadedAt = Date.now(); return d; }); }
  function loading(title) { $('main').innerHTML = '<h3>' + title + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูล…</div>'; }
  // รีเฟรชอัตโนมัติ (accounting.js autoTick): โหลดใหม่ เปลี่ยนจริงค่อยวาดหน้าใหม่
  C.refresh = function () { return call('cpLoad', state.token).then(function (d) { var ch = JSON.stringify(d) !== JSON.stringify(C.data); if (ch) C.data = d; C.loadedAt = Date.now(); return ch; }); };
  C.age = function () { return C.data ? Date.now() - (C.loadedAt || 0) : 0; };
  C.reset = function () { C.data = null; C.imp = null; C.month = ''; C.set = null; };

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
    // ส่งที่: แบบเดิม "0400 / WD01 LLKC RM WHD" · แบบใหม่มีแค่รหัส "0412" (อยู่แถวเดียวกับสกุลเงิน THB ด้านขวา)
    var ship = items.filter(function (t) { return RX.ship.test(t.s); })[0];
    if (!ship) {
      var cur = items.filter(function (t) { return /^[A-Z]{3}$/.test(t.s) && t.x > 380 && t.y > 540 && t.y < 640; })[0];
      ship = items.filter(function (t) { return /^\d{3,5}$/.test(t.s) && t.x > 40 && t.x < 200 && (cur ? Math.abs(t.y - cur.y) <= 4 : t.y > 575 && t.y < 615); })[0];
    }
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
    if (C.imp && C.imp.preview) {
      if (!C.imp.stale) return previewPage();
      C.imp.stale = 0; loading('นำเข้า PO CP Ram'); runPreview().catch(onServerError); return;   // เพิ่งแก้หน้าตั้งค่า → ตรวจใหม่
    }
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
  // ชิ้น → ลัง (เหมือน cpCase_ ใน AccCpram.gs): สินค้าที่ตั้ง "ชิ้นต่อ 1 ลัง" ไว้ แสดงเป็นลัง + จำนวนชิ้นตามใบ PO
  function curMap() { return (C.imp && C.imp.preview && C.imp.preview.map) || (C.data && C.data.map) || { products: [] }; }
  function isCase(u) { return /^(ลัง|CAS|CTN|CT)$/i.test(String(u || '').trim()); }
  function caseRows(rows) {
    var ps = curMap().products || [];
    return rows.map(function (r) {
      var code = String(r.itemCode || ''), p = ps.filter(function (x) { return (code && x.code === code) || (!code && r.product && x.name === r.product); })[0];
      var n = p && Number(p.perCase) > 0 ? Number(p.perCase) : 0, u = r.unitTh || r.unit;
      if (!n || isCase(u) || r.pcs) return r;
      var o = Object.assign({}, r);
      o.pcs = Number(r.qty) || 0; o.pcsUnit = /^PCS?$|^EA$/i.test(String(u)) ? 'ชิ้น' : (u || 'ชิ้น'); o.perCase = n;
      o.qty = Math.round(o.pcs / n * 100) / 100; o.unit = o.unitTh = 'ลัง'; o.price = (Number(r.price) || 0) * n;
      return o;
    });
  }
  function isoToday() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function nq(v) { return Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
  function schedTable(rows, opt) {
    rows = caseRows(rows);
    // วันที่อัพเดทล่าสุดในตาราง → ข้อความ "อัพเดท …" ของแถวนั้นเป็นสีแดง (ผู้ใช้ขอ 24/11/69)
    var maxU = rows.reduce(function (m, r) { var u = updOf(r, opt && opt.line); return /^\d{4}-\d{2}-\d{2}$/.test(u) && u > m ? u : m; }, '');
    var groups = [], g = null;
    rows.forEach(function (r) { if (!g || g.date !== r.deliveryDate) { g = { date: r.deliveryDate, rows: [] }; groups.push(g); } g.rows.push(r); });
    var total = 0, body = groups.map(function (gr) {
      // วันเดียวกันแต่คนละสถานที่ส่ง → แยก Total ตามสถานที่ (ผู้ใช้ขอ 24/11/69): เรียงแถวในวันให้สถานที่เดียวกันติดกัน แล้วรวม Total / สถานที่ส่ง ทีละสถานที่
      var pl = uniq(gr.rows.map(function (r) { return r.place || '\u0000'; }));
      gr.rows = gr.rows.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) { return pl.indexOf(a.r.place || '\u0000') - pl.indexOf(b.r.place || '\u0000') || a.i - b.i; }).map(function (x) { return x.r; });
      var subs = [], sg = null;
      gr.rows.forEach(function (r, i) { if (!sg || sg.place !== (r.place || '')) { sg = { place: r.place || '', start: i, n: 0, sum: 0 }; subs.push(sg); } sg.n++; if (r.status !== 'cancel') sg.sum += Number(r.qty) || 0; });
      var n = gr.rows.length;
      total += subs.reduce(function (s, x) { return s + x.sum; }, 0);
      var sameP = gr.rows.every(function (r) { return r.product === gr.rows[0].product; });
      return gr.rows.map(function (r, i) {
        var first = i === 0, rs = ' rowspan="' + n + '"', cancel = r.status === 'cancel';
        var sub = subs.filter(function (x) { return x.start === i; })[0], srs = sub ? ' rowspan="' + sub.n + '"' : '';
        return '<tr class="' + (cancel ? 'cpx' : '') + (opt.edit ? ' cped' : '') + (opt.hi && opt.hi === r.id ? ' cphi' : '') + '"' + (opt.edit ? ' data-cpl="' + esc(r.id) + '" tabindex="0"' : '') + '>'
          + (first ? '<td' + rs + '>' + dayOf(gr.date) + '</td><td' + rs + '>' + slash(gr.date) + '</td>' : '')
          + (sameP ? (first ? '<td' + rs + ' class="cpp">' + pname(r) + '</td>' : '') : '<td class="cpp">' + pname(r) + '</td>')
          + '<td class="cpo">' + esc(r.poNo) + '</td><td class="cpwh">' + esc(r.wh || (r.place ? '-' : '?')) + '</td><td class="cpq">' + nq(r.qty) + (r.pcs ? '<small class="cppcs">= ' + n0(r.pcs) + ' ' + esc(r.pcsUnit) + '</small>' : '') + '</td><td>' + esc(r.unitTh || r.unit || 'ลัง') + '</td>'
          + (sub ? '<td' + srs + ' class="cpt">' + nq(sub.sum) + '</td><td' + srs + '>' + (r.place ? esc(r.place) : '<span class="cpq0">?</span>') + '</td>' : '')
          + (opt.noNote ? '' : '<td class="cpn">' + (opt.preview ? stateTag(r) : noteHtml(r, opt.line, maxU)) + '</td>') + '</tr>';
      }).join('');
    }).join('');
    return '<div class="cpwrap"><table class="cptab"><thead><tr><th>วัน</th><th>วันที่</th><th>สินค้า</th><th>PO</th><th>คลัง</th><th>จำนวนสินค้า</th><th>หน่วย</th><th>Total</th><th>สถานที่ส่ง</th>' + (opt.noNote ? '' : '<th>' + (opt.preview ? 'สถานะ' : 'หมายเหตุ') + '</th>') + '</tr></thead>'
      + '<tbody>' + body + '</tbody><tfoot><tr><td colspan="4"></td><td class="cpy">Total</td><td class="cpy">' + nq(total) + '</td><td class="cpy">' + unitOf(rows.filter(function (r) { return r.status !== 'cancel'; })) + '</td><td colspan="' + (opt.noNote ? 2 : 3) + '"></td></tr></tfoot></table></div>';
  }
  function pname(r) { return r.product ? esc(r.product) : '<span class="cpq0">รหัส ' + esc(r.itemCode) + '</span>'; }
  function histText(h) { var t = String(h).split(' | ').pop().replace(/^[\d-]+: /, ''); return /^เลื่อนส่ง/.test(t) ? '📅 ' + t : /^(เพิ่ม|ลด)จำนวน/.test(t) ? (/^เพิ่ม/.test(t) ? '➕ ' : '➖ ') + t : 'เปลี่ยน: ' + t; }
  function stateTag(r) {
    if (r.state === 'new') return '<span class="cptag new">ใหม่</span>';
    if (r.state === 'dup') return '<span class="cptag same">ซ้ำในไฟล์</span>';
    if (r.state === 'same') return '<span class="cptag same">มีแล้ว</span>';
    return '<span class="cptag chg">อัปเดต</span>' + r.diff.map(function (d) { return '<small>' + esc(d.f) + ' ' + esc(fmtV(d.from)) + ' → ' + esc(fmtV(d.to)) + '</small>'; }).join('');
  }
  function fmtV(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? slash(v) : String(v); }
  // หมายเหตุ "อัพเดท dd/mm/yy" = วันที่เพิ่ม PO เข้าระบบ หรือวันที่ PO เปลี่ยนครั้งล่าสุด (ผู้ใช้ขอ 24/11/69 — เหมือน cpUpd_ ใน AccCpram.gs)
  // ภาพที่ส่ง LINE: PO ใหม่ไม่มีหมายเหตุ "อัพเดท" (วันที่อยู่บนหัวตารางสีแดง) · หน้าจอ / PDF / Excel ยังแสดงวันที่นำเข้า PO (ผู้ใช้ขอ 24/11/69)
  function updOf(r, line) { var m = String(r.history || '').split(' | ').pop().match(/^(\d{4}-\d{2}-\d{2}):/); return m ? m[1] : line ? '' : String(r.createdAt || '').slice(0, 10); }
  function noteHtml(r, line, maxU) {
    var t = r.status === 'done' ? '<span class="cptag done">*ส่งสินค้าแล้ว</span>' : r.status === 'cancel' ? '<span class="cptag cancel">ยกเลิก</span>' : '', u = updOf(r, line);
    return t + (/^\d{4}-\d{2}-\d{2}$/.test(u) ? '<small class="cpu' + (u === maxU ? ' new' : '') + '">อัพเดท ' + slash(u) + '</small>' : '') + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + (r.history ? '<small class="cph">' + esc(histText(r.history)) + '</small>' : '');
  }
  function roundsTable(rounds) {
    if (!rounds.length) return '';
    var sum = rounds.reduce(function (s, x) { return s + x.total; }, 0);
    return '<div class="cpwrap"><table class="cptab cpr"><thead><tr><th>รอบเงินเข้า</th><th>จำนวน</th><th>ราคา</th><th>ยอดเงิน</th><th>Vat 7%</th><th>Total</th></tr></thead><tbody>'
      + rounds.map(function (x) { return '<tr><td>' + slash(x.dueDate) + '</td><td>' + nq(x.qty) + '</td><td>' + (x.price === '' ? '-' : n2(x.price)) + '</td><td>' + n2(x.amount) + '</td><td>' + n2(x.vat) + '</td><td><b>' + n2(x.total) + '</b></td></tr>'; }).join('')
      + '</tbody><tfoot><tr><td colspan="4"></td><td class="cpy">รวม</td><td class="cpy">' + n2(sum) + '</td></tr></tfoot></table></div>';
  }
  function kpis(list) {
    list = caseRows(list);
    var a = list.filter(function (r) { return r.status !== 'cancel'; }), amt = a.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    var pos = {}; a.forEach(function (r) { pos[r.poNo] = 1; });
    var tile = function (v, l, c) { return '<div class="kpi" style="--k:' + c + '"><b>' + v + '</b><span>' + l + '</span></div>'; };
    return '<div class="kpis xk">' + tile(n0(Object.keys(pos).length), 'ใบสั่งซื้อ', '#2563eb') + tile(nq(a.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0)), 'จำนวนสินค้า (' + unitOf(a) + ')', '#16a34a')
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
      fix = '<div class="panel pbox a7fix"><h4>' + icon('warn', 18) + ' จับคู่ครั้งแรก (ระบบจำไว้ใช้ครั้งต่อไป)</h4>'
        + '<p class="cphow">พิมพ์ชื่อให้ครบทุกช่อง แล้วกด <b>บันทึกการจับคู่ แล้วตรวจใหม่</b> — ระบบจะจำรหัสนี้ไว้ ใบ PO ครั้งต่อไปขึ้นชื่อเอง · แก้ / ลบภายหลังได้ที่เมนู <a href="#" id="cpGoSet">ตั้งค่าคลัง / สถานที่ส่ง CP Ram</a></p>'
        + unP.map(function (u, i) { return '<div class="a7fixrow"><span>รหัสสินค้า <b>' + esc(u.itemCode) + '</b> <small>(' + n0(u.qty) + ' ' + esc(u.unit || 'ลัง') + ')</small></span><input data-cpp="' + i + '" list="cpPL" placeholder="ชื่อสินค้า เช่น น้ำพริกหนังไก่กรอบ" aria-label="ชื่อสินค้า">' + (/ลัง/.test(u.unit || 'ลัง') ? '' : '<input data-cppc="' + i + '" inputmode="numeric" placeholder="กี่' + esc(u.unit) + ' = 1 ลัง (ไม่ใส่ก็ได้)" aria-label="ชิ้นต่อ 1 ลัง" class="cppc">') + '</div>'; }).join('')
        + unS.map(function (u, i) { return '<div class="a7fixrow cps"><span>ส่งที่ <b>' + (esc(u.shipTo) || '<i class="cpbad">อ่านรหัสไม่ได้</i>') + '</b> <small>(PO ' + esc(u.pos.slice(0, 3).join(', ')) + (u.pos.length > 3 ? ' …' : '') + ')</small></span><input data-cpw="' + i + '" placeholder="คลัง เช่น บ่อเงิน / -" aria-label="คลัง"><input data-cps="' + i + '" list="cpSL" placeholder="สถานที่ส่ง เช่น คล้ายนคร" aria-label="สถานที่ส่ง"></div>'; }).join('')
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
      unP.forEach(function (u, i) { var v = $('main').querySelector('[data-cpp="' + i + '"]').value.trim(), pe = $('main').querySelector('[data-cppc="' + i + '"]'), pc = pe ? Number(pe.value.replace(/,/g, '')) || '' : ''; if (v) cfg.products.push({ code: u.itemCode, name: v, perCase: pc }); else miss++; });
      unS.forEach(function (u, i) {
        var w = $('main').querySelector('[data-cpw="' + i + '"]').value.trim(), p = $('main').querySelector('[data-cps="' + i + '"]').value.trim();
        if (p && u.shipTo) cfg.ships.push({ key: shipKey(u.shipTo), wh: w || '-', place: p }); else miss++;
      });
      if (unS.some(function (u) { return !u.shipTo; })) { toast('อ่านรหัส "ส่งที่" จากไฟล์ไม่ได้ — ส่งไฟล์ให้ผู้ดูแลระบบตรวจ'); return; }
      if (miss) { toast('ใส่สถานที่ส่ง / ชื่อสินค้าให้ครบทุกช่องก่อน'); return; }
      ms.disabled = true; ms.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
      call('cpSaveMap', state.token, JSON.stringify(cfg)).then(function (x) { if (!x.ok) throw new Error(x.error); if (C.data) C.data.map = x.map; C.set = null; toast('จำการจับคู่แล้ว — ตรวจใหม่'); return runPreview(); }).catch(function (e) { ms.disabled = false; toast(e.message); });
    });
    var gs = $('cpGoSet'); if (gs) gs.addEventListener('click', function (e) { e.preventDefault(); go('a_cps'); });
    bindLink();
  }
  // หน่วยของยอดรวม (เหมือน cpUnitOf_): หน่วยเดียวกันทั้งหมด → หน่วยนั้น · ปนกัน → "หน่วย"
  function unitOf(rows) { var u = {}; rows.forEach(function (r) { u[String(r.unitTh || r.unit || 'ลัง')] = 1; }); var k = Object.keys(u); return k.length === 1 ? k[0] : k.length ? 'หน่วย' : 'ลัง'; }
  function uniq(a) { var s = {}; return a.filter(function (x) { return x && !s[x] && (s[x] = 1); }); }
  // "0400 / WD01 LLKC RM WHD" → "WD01 LLKC" (คำที่ใช้จับคู่ — ตัดรหัสโรงงานและคำท้ายทั่วไปออก)
  // "0412" (รหัสอย่างเดียว) → "0412"
  function shipKey(s) { s = String(s).trim(); if (/^\d+$/.test(s)) return s; var t = s.replace(/^\d+\s*\/\s*/, '').trim().split(/\s+/); return t.slice(0, 2).join(' ') || s; }
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
  // ---------- ตั้งค่าคลัง / สถานที่ส่ง + สินค้า (จับคู่จากใบ PO) ----------
  C.settingsPage = function () {
    if (!C.data) { loading('ตั้งค่าคลัง / สถานที่ส่ง CP Ram'); load().then(C.settingsPage).catch(onServerError); return; }
    if (!C.set) C.set = JSON.parse(JSON.stringify(C.data.map || { products: [], ships: [] }));
    var cfg = C.set, used = {};
    (C.data.lines || []).forEach(function (l) { if (l.shipTo) used[l.shipTo] = 1; });
    var seen = Object.keys(used).filter(function (t) { return !cfg.ships.some(function (s) { return matchShip(s.key, t); }); });
    $('main').innerHTML = '<h3>ตั้งค่าคลัง / สถานที่ส่ง CP Ram</h3>'
      + '<div class="panel pbox"><h4>' + icon('table', 18) + ' คลัง / สถานที่ส่ง</h4>'
      + '<p class="cphow">ระบบอ่านช่อง <b>"ส่งที่"</b> ในใบ PO แล้วหาแถวที่ตรงกัน: ใส่<b>รหัส</b> (ตัวเลขล้วน เช่น 0412 — ต้องตรงทั้งรหัส) หรือ<b>คำค้น</b> (เช่น WD01 LLKC — มีอยู่ในข้อความ) · คลังไม่มีให้ใส่ -</p>'
      + '<div class="ptable-wrap"><table class="ptable a7set cpset"><thead><tr><th>รหัส / คำค้น "ส่งที่"</th><th>คลัง</th><th>สถานที่ส่ง</th><th><span class="sr">ลบ</span></th></tr></thead><tbody>'
      + cfg.ships.map(function (r, i) {
        return '<tr><td data-l="รหัส / คำค้น &quot;ส่งที่&quot;"><input data-ss="' + i + '" data-k="key" value="' + esc(r.key) + '" placeholder="เช่น 0412" aria-label="รหัส / คำค้น"></td><td data-l="คลัง"><input data-ss="' + i + '" data-k="wh" value="' + esc(r.wh === '-' ? '-' : r.wh) + '" placeholder="-" aria-label="คลัง"></td>'
          + '<td data-l="สถานที่ส่ง"><input data-ss="' + i + '" data-k="place" value="' + esc(r.place) + '" list="cpSL2" placeholder="เช่น ลาดหลุมแก้ว" aria-label="สถานที่ส่ง"></td><td><button class="icon-btn" data-rms="' + i + '" aria-label="ลบแถวนี้">' + icon('x', 16) + '</button></td></tr>';
      }).join('') + (cfg.ships.length ? '' : '<tr><td colspan="4" class="muted">ยังไม่มี — กด + เพิ่มคลัง / สถานที่ส่ง</td></tr>')
      + '</tbody></table></div><datalist id="cpSL2">' + uniq(cfg.ships.map(function (s) { return s.place; }).concat(['ลาดหลุมแก้ว', 'คล้ายนคร'])).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>'
      + '<button class="btn btn-line btn-sm" id="cpAddS" style="margin-top:8px">+ เพิ่มคลัง / สถานที่ส่ง</button>'
      + (seen.length ? '<div class="a7chk warn" style="margin-top:10px"><i>!</i><span>ข้อมูลเดิมมี "ส่งที่" ที่ยังไม่ได้ตั้ง: ' + seen.map(esc).join(', ') + '</span></div>' : '')
      + '</div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('table', 18) + ' สินค้า</h4>'
      + '<p class="cphow">จับคู่จาก<b>รหัสสินค้า</b>ในใบ PO (ตัวเลข 8 หลัก เช่น 72400524) กับชื่อที่ใช้ในตารางส่งสินค้า · ใบ PO สั่งเป็น<b>ชิ้น</b>แต่อยากดูเป็น<b>ลัง</b> ให้ใส่ <b>ชิ้นต่อ 1 ลัง</b> — ตาราง ไฟล์ และ LINE จะแสดงเป็นลัง พร้อมจำนวนชิ้นตามใบ PO</p>'
      + '<div class="ptable-wrap"><table class="ptable a7set cpset"><thead><tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>ชิ้นต่อ 1 ลัง</th><th><span class="sr">ลบ</span></th></tr></thead><tbody>'
      + cfg.products.map(function (r, i) {
        return '<tr><td data-l="รหัสสินค้า"><input data-sp="' + i + '" data-k="code" value="' + esc(r.code) + '" inputmode="numeric" placeholder="เช่น 72400524" aria-label="รหัสสินค้า"></td><td data-l="ชื่อสินค้า"><input data-sp="' + i + '" data-k="name" value="' + esc(r.name) + '" placeholder="ชื่อสินค้า" aria-label="ชื่อสินค้า"></td><td data-l="ชิ้นต่อ 1 ลัง"><input data-sp="' + i + '" data-k="perCase" value="' + esc(r.perCase || '') + '" inputmode="numeric" placeholder="เช่น 200 (ว่าง = หน่วยตามใบ PO)" aria-label="ชิ้นต่อ 1 ลัง"></td><td><button class="icon-btn" data-rmp="' + i + '" aria-label="ลบแถวนี้">' + icon('x', 16) + '</button></td></tr>';
      }).join('') + (cfg.products.length ? '' : '<tr><td colspan="4" class="muted">ยังไม่มี</td></tr>')
      + '</tbody></table></div><button class="btn btn-line btn-sm" id="cpAddP" style="margin-top:8px">+ เพิ่มสินค้า</button></div>'
      + '<p class="muted cpnote">การตั้งค่านี้ใช้กับใบ PO ที่นำเข้าครั้งต่อไป — รายการที่บันทึกไปแล้วไม่เปลี่ยน</p>'
      + '<div class="a7bar"><button class="btn btn-line" id="cpSUndo">ยกเลิกการแก้ไข</button><button class="btn btn-primary" id="cpSSave">' + icon('check', 18) + ' บันทึกการตั้งค่า</button></div>';
    on('input[data-ss]', 'input', function (el) { cfg.ships[+el.getAttribute('data-ss')][el.getAttribute('data-k')] = el.value; el.classList.remove('bad'); });
    on('input[data-sp]', 'input', function (el) { cfg.products[+el.getAttribute('data-sp')][el.getAttribute('data-k')] = el.value; el.classList.remove('bad'); });
    on('[data-rms]', 'click', function (el) { cfg.ships.splice(+el.getAttribute('data-rms'), 1); C.settingsPage(); });
    on('[data-rmp]', 'click', function (el) { cfg.products.splice(+el.getAttribute('data-rmp'), 1); C.settingsPage(); });
    $('cpAddS').addEventListener('click', function () { cfg.ships.push({ key: seen[0] || '', wh: '-', place: '' }); C.settingsPage(); focusLast('data-ss', 'place'); });
    $('cpAddP').addEventListener('click', function () { cfg.products.push({ code: '', name: '' }); C.settingsPage(); focusLast('data-sp', 'code'); });
    $('cpSUndo').addEventListener('click', function () { C.set = null; C.settingsPage(); toast('กลับเป็นค่าที่บันทึกไว้'); });
    $('cpSSave').addEventListener('click', function () {
      var bad = [], keys = {}, codes = {};
      var ships = cfg.ships.map(function (r, i) { return { i: i, key: String(r.key || '').trim(), wh: String(r.wh || '').trim() || '-', place: String(r.place || '').trim() }; })
        .filter(function (r) { return r.key || r.place || (r.wh && r.wh !== '-'); });
      ships.forEach(function (r) {
        var k = r.key.replace(/\s+/g, '').toLowerCase();
        if (!r.key) bad.push(['ss', r.i, 'key']); if (!r.place) bad.push(['ss', r.i, 'place']);
        if (k && keys[k]) bad.push(['ss', r.i, 'key']); keys[k] = 1;
      });
      var prods = cfg.products.map(function (r, i) { var pc = String(r.perCase == null ? '' : r.perCase).replace(/,/g, '').trim(); return { i: i, code: String(r.code || '').replace(/\D/g, ''), name: String(r.name || '').trim(), pcRaw: pc, perCase: pc === '' ? 0 : Number(pc) }; }).filter(function (r) { return r.code || r.name; });
      prods.forEach(function (r) { if (!r.code) bad.push(['sp', r.i, 'code']); if (!r.name) bad.push(['sp', r.i, 'name']); if (r.pcRaw !== '' && !(r.perCase > 0)) bad.push(['sp', r.i, 'perCase']); if (r.code && codes[r.code]) bad.push(['sp', r.i, 'code']); codes[r.code] = 1; });
      if (bad.length) {
        bad.forEach(function (b) { var el = $('main').querySelector('input[data-' + b[0] + '="' + b[1] + '"][data-k="' + b[2] + '"]'); if (el) el.classList.add('bad'); });
        var f = $('main').querySelector('input.bad'); if (f) f.focus();
        toast('ช่องสีแดง: ยังไม่ได้ใส่ / รหัสซ้ำกัน / ชิ้นต่อลังต้องเป็นตัวเลขมากกว่า 0'); return;
      }
      var btn = this; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
      call('cpSaveMap', state.token, JSON.stringify({ full: 1, ships: ships.map(function (r) { return { key: r.key, wh: r.wh, place: r.place }; }), products: prods.map(function (r) { return { code: r.code, name: r.name, perCase: r.perCase || '' }; }) })).then(function (x) {
        if (!x.ok) throw new Error(x.error);
        C.data.map = x.map; C.set = null; if (C.imp && C.imp.preview) C.imp.stale = 1; C.settingsPage(); toast('บันทึกการตั้งค่าแล้ว');
      }).catch(function (e) { btn.disabled = false; btn.innerHTML = icon('check', 18) + ' บันทึกการตั้งค่า'; toast(e.message || 'บันทึกไม่สำเร็จ'); });
    });
  };
  function focusLast(attr, k) { var a = $('main').querySelectorAll('input[' + attr + '][data-k="' + k + '"]'); if (a.length) a[a.length - 1].focus(); }
  // เหมือน cpMatchShip_ ใน AccCpram.gs
  function matchShip(key, shipTo) {
    var k = String(key).replace(/\s+/g, '').toLowerCase(), t = String(shipTo).replace(/\s+/g, '').toLowerCase(), code = (String(shipTo).match(/^\s*(\d+)/) || [])[1] || '';
    return !!k && !!t && (/^\d+$/.test(k) ? k === code : t.indexOf(k) >= 0);
  }
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
  // ส่ง LINE: สร้างภาพตารางก่อน แล้วให้ดูตัวอย่างในหน้าต่าง ค่อยกดส่ง (ผู้ใช้ขอ 23/11/69)
  function sendLine(id, afterSave) {
    var x = C.data.imports.filter(function (i) { return i.id === id; })[0]; if (!x) return;
    var lines = C.data.lines.filter(function (l) { return l.importId === id; });
    var live = caseRows(lines).filter(function (l) { return l.status !== 'cancel'; });
    var tot = live.reduce(function (s2, l) { return s2 + (Number(l.qty) || 0); }, 0), pos = uniq(live.map(function (l) { return l.poNo; }));
    var dts = uniq(live.map(function (l) { return l.deliveryDate; })).sort();
    var img = null;
    openModal({ color: state.dept.color, icon: 'send', wide: true, title: afterSave ? 'บันทึกแล้ว · ส่งออเดอร์เข้ากลุ่ม LINE เลยไหม?' : 'ส่งออเดอร์ CP Ram เข้ากลุ่ม LINE?',
      sub: pos.length + ' ใบสั่งซื้อ · ' + nq(tot) + ' ' + unitOf(live) + (dts.length ? ' · ส่ง ' + slash(dts[0]) + (dts.length > 1 ? ' – ' + slash(dts[dts.length - 1]) : '') : '') + ' (ไม่มียอดเงิน)',
      body: (x.sentAt ? '<div class="a7chk warn"><i>!</i><span>เคยส่งแล้วเมื่อ ' + esc(slash(String(x.sentAt).slice(0, 10)) + ' ' + String(x.sentAt).slice(11, 16) + ' น.') + ' — กดส่งอีกครั้งจะส่งซ้ำเข้ากลุ่ม</span></div>' : '')
        + '<p class="cpsendh">จะส่ง 2 ข้อความ: <b>การ์ดสรุปจำนวน</b> (ไม่แยก PO) และ <b>ภาพตารางด้านล่าง</b></p>'
        + '<div id="cpPrev" class="cpprev"><span class="spinner dark"></span> กำลังสร้างภาพตัวอย่าง…</div>',
      ok: 'ส่ง LINE', cancel: afterSave ? 'ไว้ทีหลัง' : 'ยกเลิก',
      onOpen: function () {
        var okb = $('mOk'); okb.disabled = true;
        lineImage(lines).catch(function () { return null; }).then(function (r) {
          img = r; var box = $('cpPrev'); if (!box) return;
          box.innerHTML = r ? '<img src="data:image/png;base64,' + r.png + '" alt="ภาพตารางส่งสินค้าที่จะส่งเข้า LINE">' : '<div class="a7chk warn"><i>!</i><span>สร้างภาพตารางไม่ได้ — จะส่งเฉพาะการ์ดสรุป</span></div>';
          okb.disabled = false; okb.focus();
        });
      },
      submit: function () {
        return call('cpSendLine', state.token, id, img ? img.png : '', img ? img.ratio : '').then(function (r) {
          if (!r.ok) return r.error || 'ส่งไม่สำเร็จ';
          closeModal(); x.sentAt = r.sentAt; if (r.pdfUrl) { x.pdfUrl = r.pdfUrl; x.xlsxUrl = r.xlsxUrl; } toast('ส่ง LINE แล้ว'); C.listPage();
        });
      } });
  }
  // ภาพตารางส่งสินค้า (หน้าตาเดียวกับในหน้าเว็บ ไม่มียอดเงิน) สำหรับส่ง LINE — html2canvas
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  function lineImage(lines, o) {
    o = o || {};
    if (!lines.length) return Promise.resolve(null);
    var ready = window.html2canvas ? Promise.resolve() : new Promise(function (ok, fail) { var sc = document.createElement('script'); sc.src = H2C_URL; sc.onload = ok; sc.onerror = fail; document.head.appendChild(sc); });
    return ready.then(function () { return document.fonts ? document.fonts.ready : null; }).then(function () {
      var rows = lines.slice().sort(function (a, b) { return String(a.deliveryDate).localeCompare(String(b.deliveryDate)) || String(a.poNo).localeCompare(String(b.poNo)) || a.lineNo - b.lineNo; });
      var dates = uniq(rows.map(function (r) { return r.deliveryDate; })), pos = uniq(rows.map(function (r) { return r.poNo; }));
      var box = document.createElement('div'); box.className = 'cpimgbox';
      box.innerHTML = '<div class="cpimg"><div class="cpimh"><b>' + esc(o.title || 'ตารางส่งสินค้า CP Ram') + '</b><span>' + (o.sub ? esc(o.sub) : 'ส่ง ' + slash(dates[0]) + (dates.length > 1 ? ' – ' + slash(dates[dates.length - 1]) : '')) + ' · ' + pos.length + ' ใบสั่งซื้อ · <b class="cpupd">Update ' + slash(isoToday()) + '</b></span></div>'
        + schedTable(rows, { hi: o.hi, line: true, noNote: !rows.some(function (r) { return r.status === 'cancel' || r.note || r.history; }) }) + '</div>';
      document.body.appendChild(box);
      return window.html2canvas(box.firstChild, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (cv) {
        document.body.removeChild(box);
        var w = cv.width, h = Math.min(cv.height, w * 3), url = cv.toDataURL('image/png');
        return { png: url.split(',')[1], ratio: w + ':' + h };
      }, function (e) { document.body.removeChild(box); throw e; });
    });
  }
  function roundsOf(rows) {
    rows = caseRows(rows);
    var by = {};
    rows.forEach(function (r) {
      if (r.status === 'cancel' || !r.dueDate) return;
      var o = by[r.dueDate] = by[r.dueDate] || { dueDate: r.dueDate, qty: 0, amount: 0, prices: {} };
      o.qty += Number(r.qty) || 0; o.amount += Number(r.amount) || 0; o.prices[r.price] = 1;
    });
    return Object.keys(by).sort().map(function (k) { var o = by[k], pr = Object.keys(o.prices); return { dueDate: k, qty: o.qty, price: pr.length === 1 ? Number(pr[0]) : '', amount: o.amount, vat: o.amount * 0.07, total: o.amount * 1.07 }; });
  }
  // ข้อความการเปลี่ยนแปลง 1 ครั้ง: เลื่อนวันส่ง และ / หรือ เพิ่ม-ลดจำนวน (จำนวนแสดงเป็นลังเมื่อตั้งชิ้นต่อลังไว้)
  function qtyTxt(m, q) { var c = caseRows([{ itemCode: m.itemCode, product: m.product, qty: q, unit: m.unit }])[0]; return nq(c.qty) + ' ' + esc(c.unitTh || c.unit || 'ลัง'); }
  function chgParts(m) {
    var a = [];
    if (m.fromDate && m.toDate && m.fromDate !== m.toDate) a.push('📅 ' + slash(m.fromDate) + ' → ' + slash(m.toDate));
    if (m.fromQty !== '' && m.fromQty != null && m.toQty !== '' && m.toQty != null && Number(m.fromQty) !== Number(m.toQty)) a.push((Number(m.toQty) > Number(m.fromQty) ? '➕ เพิ่มจำนวน ' : '➖ ลดจำนวน ') + qtyTxt(m, m.fromQty) + ' → ' + qtyTxt(m, m.toQty));
    return a;
  }
  function editLine(id) {
    var r = C.data.lines.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var mv = (C.data.moves || []).filter(function (m) { return m.lineId === id; });
    var cv = caseRows([r])[0], per = cv.perCase || 0, uTh = esc(cv.unitTh || cv.unit || 'ลัง');
    var toRaw = function (v) { return per ? Math.round(v * per) : v; };   // ช่องจำนวนเป็นลัง → เก็บเป็นชิ้นตาม PO
    openModal({ color: state.dept.color, icon: 'edit', title: 'PO ' + r.poNo, sub: (r.product || '') + ' · ' + nq(cv.qty) + ' ' + (cv.unit || 'ลัง') + (cv.pcs ? ' (' + n0(cv.pcs) + ' ' + cv.pcsUnit + ')' : '') + (r.place ? ' · ' + r.place : ''),
      body: '<div class="cp2"><label class="cpnl">วันที่ส่ง<input type="date" id="cpDate" value="' + esc(r.deliveryDate) + '"></label>'
        + '<label class="cpnl">จำนวน<span class="cpqin"><input id="cpQty" inputmode="decimal" value="' + esc(String(cv.qty)) + '"><em>' + uTh + '</em></span>' + (per ? '<small class="cpqp" id="cpQtyP">= ' + n0(cv.pcs) + ' ' + esc(cv.pcsUnit) + '</small>' : '') + '</label></div>'
        + '<div id="cpMoveBox" class="cpmove" hidden><div class="cpmh" id="cpChg"></div>'
        + '<label class="cpnl">เหตุผลที่เปลี่ยน <span class="req">*</span><input id="cpWhy" maxlength="200" list="cpWhyL" placeholder="เช่น ลูกค้าขอเลื่อน / ลูกค้าขอเพิ่มจำนวน"></label>'
        + '<datalist id="cpWhyL"><option value="ลูกค้า (CP Ram) ขอเลื่อน"><option value="ลูกค้า (CP Ram) ขอเพิ่มจำนวน"><option value="ลูกค้า (CP Ram) ขอลดจำนวน"><option value="สินค้ายังผลิตไม่ทัน"><option value="สินค้าไม่พอส่ง"><option value="คลังลูกค้าเต็ม"><option value="รถขนส่งไม่ว่าง"></datalist>'
        + (C.data.line ? '<label class="cpchk"><input type="checkbox" id="cpNotify" checked> ส่ง LINE แจ้งการเปลี่ยนแปลงเข้ากลุ่มด้วย</label>' : '') + '</div>'
        + '<div class="cpst3">' + Object.keys(STATUS).map(function (k) { return '<label><input type="radio" name="cpS" value="' + k + '"' + ((r.status || '') === k ? ' checked' : '') + '><span>' + STATUS[k] + '</span></label>'; }).join('') + '</div>'
        + '<label class="cpnl">หมายเหตุ<textarea id="cpNote" rows="2" maxlength="200">' + esc(r.note || '') + '</textarea></label>'
        + (mv.length ? '<div class="cpmh2">ประวัติเลื่อนส่ง / เปลี่ยนจำนวน</div>' + mv.map(function (m) {
          return '<div class="cpmrow"><span>' + chgParts(m).join(' · ') + ' · ' + esc(m.reason) + '</span><small>' + esc(String(m.createdAt).slice(0, 16)) + (m.sentAt ? ' · ส่ง LINE แล้ว' : '') + '</small></div>'; }).join('') : ''),
      ok: 'บันทึก',
      onOpen: function () {
        var d = $('cpDate'), q = $('cpQty'), box = $('cpMoveBox');
        var upd = function () {
          var qv = Number(String(q.value).replace(/,/g, '')), qOk = q.value.trim() !== '' && qv > 0, dCh = d.value && d.value !== r.deliveryDate, qCh = qOk && Math.abs(qv - Number(cv.qty)) > 1e-9;
          if ($('cpQtyP')) $('cpQtyP').textContent = qOk ? '= ' + n0(toRaw(qv)) + ' ' + cv.pcsUnit : '';
          var a = chgParts({ itemCode: r.itemCode, product: r.product, unit: r.unit, fromDate: r.deliveryDate, toDate: dCh ? d.value : r.deliveryDate, fromQty: qCh ? r.qty : '', toQty: qCh ? toRaw(qv) : '' });
          var was = box.hidden; box.hidden = !a.length; $('cpChg').innerHTML = a.map(function (t) { return '<div>' + t + '</div>'; }).join('');
          if (was && a.length) $('cpWhy').focus();
        };
        d.addEventListener('change', upd); q.addEventListener('input', upd); q.addEventListener('change', upd);
      },
      check: function () {
        var d = $('cpDate').value, qs = $('cpQty').value.trim(), qv = Number(qs.replace(/,/g, ''));
        if (!d) return 'เลือกวันที่ส่ง';
        if (!qs || !(qv > 0)) return 'ใส่จำนวนมากกว่า 0 (ถ้าไม่ส่งแล้วให้เลือก "ยกเลิก")';
        if (!$('cpMoveBox').hidden && !$('cpWhy').value.trim()) return 'ใส่เหตุผลที่เปลี่ยน';
        return '';
      },
      submit: function () {
        var st = ($('mBody').querySelector('input[name=cpS]:checked') || {}).value || '', d = $('cpDate').value, moved = d !== r.deliveryDate, old = r.deliveryDate, oq = r.qty;
        var qv = Number($('cpQty').value.replace(/,/g, '')), qCh = Math.abs(qv - Number(cv.qty)) > 1e-9, raw = qCh ? toRaw(qv) : '';
        var notify = (moved || qCh) && $('cpNotify') && $('cpNotify').checked, why = $('cpWhy').value.trim();
        return call('cpUpdateLine', state.token, id, st, $('cpNote').value, moved ? d : '', moved || qCh ? why : '', raw).then(function (x) {
          if (!x.ok) return x.error;
          r.status = st; r.note = $('cpNote').value.trim();
          if (x.moveId) { r.deliveryDate = x.deliveryDate; r.dueDate = x.dueDate; r.history = x.history; r.qty = x.qty; r.amount = x.amount; C.month = String(x.deliveryDate).slice(0, 7); }
          closeModal();
          var msg = moved && qCh ? 'บันทึกการเลื่อนส่งและเปลี่ยนจำนวนแล้ว' : moved ? 'บันทึกการเลื่อนส่งแล้ว' : qCh ? 'บันทึกการเปลี่ยนจำนวนแล้ว' : 'บันทึกแล้ว';
          if (!x.moveId || !notify) { toast(msg); C.data = null; C.listPage(); return; }
          var m = { id: x.moveId, poNo: r.poNo, product: r.product, itemCode: r.itemCode, unit: r.unit, qty: r.qty, lineId: r.id, fromDate: old, toDate: x.deliveryDate, fromQty: qCh ? oq : '', toQty: qCh ? x.qty : '', reason: why };
          (C.data.moves = C.data.moves || []).unshift(m);
          toast(msg); C.listPage();
          sendMove(x.moveId, true);
        });
      } });
  }
  // กล่องประวัติเลื่อนส่งล่าสุด (หน้าตารางส่งสินค้า) — ส่ง LINE ย้อนหลังได้
  function movesPanel(d) {
    var mv = (d.moves || []).slice(0, 5); if (!mv.length) return '';
    return '<div class="panel pbox cpline"><h4>📅 ประวัติเลื่อนส่ง / เปลี่ยนจำนวนล่าสุด</h4>' + mv.map(function (m) {
      return '<div class="cprow cpimp"><span><b>PO ' + esc(m.poNo) + ' · ' + chgParts(m).join(' · ') + '</b><small>' + esc(m.product || '') + ' · ' + qtyTxt(m, m.qty) + ' · ' + esc(m.reason) + '</small></span>'
        + (m.sentAt ? '<span class="cptag done">ส่ง LINE แล้ว</span>' : '<span class="cptag">ยังไม่ส่ง</span>')
        + (d.line ? '<button class="btn btn-sm ' + (m.sentAt ? 'btn-line' : 'btn-primary') + '" data-cpmv="' + esc(m.id) + '">' + icon('send', 15) + (m.sentAt ? ' ส่งอีกครั้ง' : ' ส่ง LINE') + '</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  // ส่ง LINE แจ้งเลื่อนส่ง: การ์ดแจ้งเลื่อน + ภาพตารางทั้งเดือนที่เลื่อนไป — ดูตัวอย่างก่อนส่ง (ผู้ใช้ขอ 24/11/69)
  function sendMove(id, afterSave) {
    var m = (C.data.moves || []).filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var ym = String(m.toDate || m.fromDate).slice(0, 7), p = ym.split('-'), chg = chgParts(m).join(' · ').replace(/<[^>]+>/g, '');
    var lines = C.data.lines.filter(function (l) { return String(l.deliveryDate).slice(0, 7) === ym; });
    var mName = MONTHS[+p[1] - 1] + ' ' + (+p[0] + 543), img = null;
    openModal({ color: state.dept.color, icon: 'send', wide: true, title: afterSave ? 'ส่ง LINE แจ้งการเปลี่ยนแปลงเลยไหม?' : 'ส่ง LINE แจ้งการเปลี่ยนแปลง?',
      sub: 'PO ' + m.poNo + ' · ' + chg + (m.reason ? ' · ' + m.reason : ''),
      body: (m.sentAt ? '<div class="a7chk warn"><i>!</i><span>เคยส่งแล้วเมื่อ ' + esc(slash(String(m.sentAt).slice(0, 10)) + ' ' + String(m.sentAt).slice(11, 16) + ' น.') + ' — กดส่งอีกครั้งจะส่งซ้ำเข้ากลุ่ม</span></div>' : '')
        + '<p class="cpsendh">จะส่ง 2 ข้อความ: <b>การ์ดแจ้งการเปลี่ยนแปลง</b> และ <b>ภาพตารางส่งสินค้าทั้งเดือน ' + esc(mName) + '</b> (แถวที่เปลี่ยนเป็นสีเหลือง)</p>'
        + '<div id="cpPrev" class="cpprev"><span class="spinner dark"></span> กำลังสร้างภาพตัวอย่าง…</div>',
      ok: 'ส่ง LINE', cancel: afterSave ? 'ไว้ทีหลัง' : 'ยกเลิก',
      onOpen: function () {
        var okb = $('mOk'); okb.disabled = true;
        lineImage(lines, { title: 'ตารางส่งสินค้า CP Ram เดือน' + mName, sub: 'หลังเปลี่ยน PO ' + m.poNo + ' (' + chg + ')', hi: m.lineId })
          .catch(function () { return null; }).then(function (r) {
            img = r; var box = $('cpPrev'); if (!box) return;
            box.innerHTML = r ? '<img src="data:image/png;base64,' + r.png + '" alt="ภาพตารางส่งสินค้าทั้งเดือนที่จะส่งเข้า LINE">' : '<div class="a7chk warn"><i>!</i><span>สร้างภาพตารางไม่ได้ — จะส่งเฉพาะการ์ดแจ้งการเปลี่ยนแปลง</span></div>';
            okb.disabled = false; okb.focus();
          });
      },
      submit: function () {
        return call('cpSendMoveLine', state.token, id, img ? img.png : '', img ? img.ratio : '').then(function (r) {
          if (!r.ok) return r.error || 'ส่งไม่สำเร็จ';
          closeModal(); m.sentAt = r.sentAt; toast('ส่ง LINE แจ้งการเปลี่ยนแปลงแล้ว'); C.data = null; C.listPage();
        });
      } });
  }


  var css = document.createElement('style');
  css.textContent = [
    '.cpwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}',
    '.cptab{border-collapse:collapse;width:100%;min-width:760px;font-size:14.5px;background:#fff}.cptab.cpr{min-width:520px}',
    '.cptab th{background:#C6E0B4;font-weight:700;padding:7px 6px;border:1px solid #1f2937;white-space:nowrap}',
    '.cptab td{border:1px solid #1f2937;padding:6px;text-align:center;vertical-align:middle}',
    '.cptab tfoot td{border:0;padding-top:10px}.cptab td.cpy{background:#FFFF00;font-weight:700}',
    '.cptab .cpp{white-space:nowrap}.cptab .cpt{font-weight:700;font-size:16px}.cptab .cpq{font-variant-numeric:tabular-nums}.cptab .cpo{font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.cptab .cpn{text-align:left;min-width:150px}.cptab .cpn small{display:block;color:#64748b;font-size:12.5px;line-height:1.35}.cptab .cpn small.cph{color:#b45309}.cptab .cpn small.cpu{color:#334155;font-weight:600}.cptab .cpn small.cpu.new{color:#dc2626;font-weight:700}',
    '.cp2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:420px){.cp2{grid-template-columns:1fr}}.cpqin{display:flex;align-items:center;gap:6px}.cpqin input{flex:1;min-width:0}.cpqin em{font-style:normal;color:var(--muted);font-size:14px}.cpqp{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}.cpmh div+div{margin-top:4px}',
    '.cptab tr.cphi td{background:#FEF08A}.cptab tr.cpx td{color:#9ca3af}.cptab tr.cpx .cpq{text-decoration:line-through}',
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
    '.cppcs{display:block;font-size:12px;color:var(--muted);font-weight:400;white-space:nowrap}.cptab .cpwh{white-space:nowrap}.a7fixrow .cppc{flex:0 1 190px}',
    '.cpimh span .cpupd{font-size:inherit;color:#C2410C}.cpimg .cppcs{font-size:14px;color:#475569}',
    '.cpsendh{margin:4px 0 10px;font-size:14px}.cpprev{max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:12px;background:#fff;padding:6px;text-align:center;min-height:80px}.cpprev img{width:100%;height:auto;display:block}',
    '.cphow{margin:0 0 10px;font-size:13.5px;color:var(--muted);line-height:1.55}.cphow b{color:var(--ink,#0f172a)}.cphow a{color:var(--c);font-weight:600}.cpbad{color:#dc2626;font-style:normal}.cpnote{font-size:13px;margin:12px 2px 0}',
    '@media (max-width:640px){.cpset{min-width:0!important}.cpset thead{display:none}.cpset tr{display:grid;grid-template-columns:1fr 1fr 44px;gap:6px 8px;padding:10px 0;border-bottom:1px solid var(--line)}.cpset td{display:block;padding:0!important;border:0!important}.cpset td[data-l]::before{content:attr(data-l);display:block;font-size:12.5px;color:var(--muted);margin-bottom:3px}.cpset td:first-child{grid-column:1/3}.cpset td:last-child{grid-column:3;grid-row:1;align-self:end;width:auto}.cpset tr>td:nth-child(3):not(:last-child){grid-column:2/4}.cpset td[colspan]{grid-column:1/-1}.cpset td[data-l="ชื่อสินค้า"],.cpset td[data-l="ชิ้นต่อ 1 ลัง"]{grid-column:1/3}.cpset .icon-btn{width:44px;height:44px}}',
    '.cpset td:last-child,.cpset th:last-child{width:44px;text-align:center}.cpset input.bad{border-color:#dc2626;background:#fef2f2}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.cpst3{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.cpst3 label{flex:1 1 30%}.cpst3 input{position:absolute;opacity:0}.cpst3 span{display:block;text-align:center;padding:11px 8px;border:1.5px solid var(--line);border-radius:12px;font-weight:600;cursor:pointer}',
    '.cpst3 input:checked+span{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,white);color:var(--c)}.cpst3 input:focus-visible+span{outline:2px solid var(--c)}'
  ].join('\n');
  document.head.appendChild(css);
})();
