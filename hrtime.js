// ==================== ฝ่ายบุคคล — ลงเวลา (ไฟล์จากเครื่องสแกน) ====================
// เมนู "ลงเวลา (เครื่องสแกน)" (h_time) — hr.js เรียก HRTIME.page() · API ใน HrTime.gs
// อ่านไฟล์รายงานจากโปรแกรมเครื่องสแกน (PDF ด้วย pdf.js / Excel ด้วย SheetJS) ในเบราว์เซอร์ → ตรวจ + จับคู่รหัสที่เครื่องกับพนักงาน → บันทึก
// มาสาย / ขาดงาน เซิร์ฟเวอร์ลงในแท็บการลาให้เป็นข้อมูล (ไม่ต้องอนุมัติ) · ลืมสแกน / ออกก่อน ดูได้ในหน้านี้
(function () {
  var T = window.HRTIME = { init: null, ym: '', rows: null, day: '', f: 'all', tab: 'day' };
  var PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function th(iso) { var p = String(iso).split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + (+p[0] + 543); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || $('main')).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function load(src) { return new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { fail(new Error('โหลดตัวอ่านไฟล์ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); }; document.head.appendChild(s); }); }
  function mm(n) { n = Number(n) || 0; return n >= 60 ? Math.floor(n / 60) + ' ชม. ' + (n % 60) + ' น.' : n + ' นาที'; }
  T.reset = function () { T.init = null; T.rows = null; T.ym = ''; T.day = ''; };

  // ---------- อ่านไฟล์ ----------
  var ATT_COLS = [['machineId', /รหัส/], ['name', /ชื่อ/], ['dept', /แผนก/], ['date', /วัน\s*\/\s*เวลา|วันที่/], ['dayStatus', /สถานะ/], ['workTime', /เวลาทำงาน/],
    ['brk', /พัก/], ['otBefore', /OT\s*ก่อน/i], ['otAfter', /OT\s*หลัง/i], ['shift', /เข้า\s*-\s*ออก/], ['early', /ออกก่อน/], ['timeIn', /^เข้า(\s|\[|$)/], ['timeOut', /^ออก(\s|\[|$)/],
    ['late', /^สาย/], ['remark', /remark|หมายเหตุ/i]];
  var RX_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  function attHeaderCols(line) {   // line = items เรียงตาม x · รวมคำที่ติดกันเป็นวลี แล้วหาว่าแต่ละคอลัมน์อยู่ตรงไหน
    var ph = [];
    line.forEach(function (it) { var p = ph[ph.length - 1]; if (p && it.x - p.x2 < 3.5) { p.s += ' ' + it.s; p.x2 = it.x + it.w; } else ph.push({ s: it.s, x: it.x, x2: it.x + it.w }); });
    var cols = {};
    ph.forEach(function (p) { var s = p.s.trim(); for (var i = 0; i < ATT_COLS.length; i++) { var k = ATT_COLS[i][0]; if (!cols[k] && ATT_COLS[i][1].test(s)) { cols[k] = (p.x + p.x2) / 2; break; } } });
    return cols.machineId != null && cols.date != null && cols.name != null ? cols : null;
  }
  function attLines(items) {   // จัดกลุ่มตามบรรทัด (y ใกล้กัน) บนลงล่าง
    var ls = [];
    items.filter(function (it) { return String(it.s).trim(); }).sort(function (a, b) { return b.y - a.y || a.x - b.x; }).forEach(function (it) {
      var l = ls[ls.length - 1];
      if (l && Math.abs(l.y - it.y) <= 2.5) l.items.push(it); else ls.push({ y: it.y, items: [it] });
    });
    ls.forEach(function (l) { l.items.sort(function (a, b) { return a.x - b.x; }); });
    return ls;
  }
  function attDate(s) {
    var m = String(s).trim().match(RX_DATE); if (!m) return '';
    var a = +m[1], b = +m[2], y = +m[3]; if (y > 2400) y -= 543;
    var mo = a, d = b; if (a > 12) { d = a; mo = b; }   // รายงานเครื่องสแกนเป็น เดือน/วัน/ปี · ถ้าตัวแรกเกิน 12 = วัน/เดือน
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
  }
  function attMin(s) { var m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; }
  function attHHMM(s) { var m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
  // cols = ตำแหน่งคอลัมน์ (จากหัวตาราง หน้าแรก ใช้ต่อกับหน้าถัดไปที่ไม่มีหัว) · คืน { cols, rows }
  function attParsePage(items, cols) {
    var out = [];
    attLines(items).forEach(function (l) {
      var hc = attHeaderCols(l.items); if (hc) { cols = hc; return; }
      if (!cols || !l.items.some(function (it) { return RX_DATE.test(String(it.s).trim()); })) return;
      var keys = Object.keys(cols), v = {};
      l.items.forEach(function (it) {
        var c = it.x + it.w / 2, best = null, bd = 1e9;
        keys.forEach(function (k) { var dd = Math.abs(cols[k] - c); if (dd < bd) { bd = dd; best = k; } });
        v[best] = (v[best] ? v[best] + ' ' : '') + String(it.s).trim();
      });
      var row = attRow(v); if (row) out.push(row);
    });
    return { cols: cols, rows: out };
  }
  function attRow(v) {   // ค่าดิบตามคอลัมน์ → แถวลงเวลา (ข้ามแถวรหัสว่างในเครื่อง)
    var mid = String(v.machineId || '').replace(/\D/g, ''), date = attDate(v.date || ''), name = String(v.name || '').replace(/\s+/g, ' ').trim();
    if (!mid || !date) return null;
    if (!name || name === mid || /start department/i.test(String(v.dept || ''))) return null;
    return { machineId: mid, name: name, dept: String(v.dept || '').trim(), date: date, dayStatus: String(v.dayStatus || '').trim(), shift: String(v.shift || '').replace(/\s+/g, ' ').trim(),
      timeIn: attHHMM(v.timeIn), timeOut: attHHMM(v.timeOut), workTime: attHHMM(v.workTime), lateMin: attMin(v.late), earlyMin: attMin(v.early),
      otBefore: attHHMM(v.otBefore), otAfter: attHHMM(v.otAfter), remark: String(v.remark || '').trim() };
  }
  function readPdf(file) {
    var ready = window.pdfjsLib ? Promise.resolve() : load(PDF_URL).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; });
    return ready.then(function () { return file.arrayBuffer(); }).then(function (buf) { return window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise; }).then(function (doc) {
      var rows = [], cols = null, chain = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) (function (n) {
        chain = chain.then(function () { return doc.getPage(n); }).then(function (pg) {
          var vp = pg.getViewport({ scale: 1 });   // หน้ากระดาษแนวนอน (หมุน) → แปลงเป็นพิกัดที่เห็นจริง
          return pg.getTextContent().then(function (tc) {
            var items = tc.items.map(function (t) { var m = window.pdfjsLib.Util.transform(vp.transform, t.transform); return { x: m[4], y: -m[5], w: t.width, s: t.str }; });
            var r = attParsePage(items, cols); cols = r.cols; rows = rows.concat(r.rows);
          });
        });
      })(i);
      return chain.then(function () { if (!cols) throw new Error('ไม่พบหัวตาราง "รหัสที่เครื่อง / ชื่อพนักงาน / วัน/เวลา" ในไฟล์'); return rows; });
    });
  }
  // Excel: หาแถวหัวตารางจากชื่อคอลัมน์แบบเดียวกับ PDF (ยังไม่เคยเห็นไฟล์ Excel จริง — ถ้าอ่านไม่ได้ให้ส่งไฟล์มาปรับ)
  function cellStr(v, key) {
    if (v instanceof Date) {
      if (key === 'date') return (v.getMonth() + 1) + '/' + v.getDate() + '/' + v.getFullYear();
      return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
    }
    if (typeof v === 'number' && key !== 'machineId' && v > 0 && v < 1) { var t = Math.round(v * 1440); return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
    return v == null ? '' : String(v);
  }
  function readXlsx(file) {
    var ready = window.XLSX ? Promise.resolve() : load(XLSX_URL);
    return ready.then(function () { return file.arrayBuffer(); }).then(function (buf) {
      var wb = window.XLSX.read(buf, { type: 'array', cellDates: true }), rows = [];
      wb.SheetNames.forEach(function (sn) {
        var aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' }), map = null;
        aoa.forEach(function (r) {
          if (!map) {
            var m = {};
            r.forEach(function (c, i) { var s = String(c).trim(); for (var j = 0; j < ATT_COLS.length; j++) { var k = ATT_COLS[j][0]; if (m[k] == null && ATT_COLS[j][1].test(s)) { m[k] = i; break; } } });
            if (m.machineId != null && m.date != null && m.name != null) map = m;
            return;
          }
          var v = {}; Object.keys(map).forEach(function (k) { v[k] = cellStr(r[map[k]], k); });
          var row = attRow(v); if (row) rows.push(row);
        });
      });
      if (!rows.length) throw new Error('ไม่พบข้อมูลลงเวลาในไฟล์ Excel (หาหัวคอลัมน์ "รหัสที่เครื่อง / ชื่อพนักงาน / วัน/เวลา" ไม่เจอ)');
      return rows;
    });
  }

  // ---------- จับคู่รหัสที่เครื่อง → พนักงาน ----------
  function norm(s) { return String(s || '').toLowerCase().replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|miss\.?|mrs\.?|mr\.?|ms\.?)\s*/i, '').replace(/[\s.()\-_,]/g, ''); }
  function guess(r) {
    var main = r.name.replace(/\(.*$/, ''), nick = (r.name.match(/\(([^)]*)/) || [])[1] || '', P = T.init.people.filter(function (p) { return !p.out; });
    var a = P.filter(function (p) { return norm(p.name) && norm(p.name) === norm(main); });
    if (a.length === 1) return a[0].id;
    if (nick) { a = P.filter(function (p) { return p.nick && norm(p.nick) === norm(nick); }); if (a.length === 1) return a[0].id; }
    a = P.filter(function (p) { var n = norm(p.name); return n.length > 3 && (n.indexOf(norm(main)) >= 0 || norm(main).indexOf(n) >= 0); });
    return a.length === 1 ? a[0].id : '';
  }
  function person(id) { return T.init.people.filter(function (p) { return p.id === id; })[0]; }
  function pLabel(p) { return p.name + (p.nick ? ' (' + p.nick + ')' : '') + (p.job ? ' · Job' : ''); }

  // ---------- โหลด ----------
  function ymNow() { return (T.init ? T.init.today : new Date().toISOString()).slice(0, 7); }
  function endOf(ym) { var p = ym.split('-'); return ym + '-' + ('0' + new Date(+p[0], +p[1], 0).getDate()).slice(-2); }
  function loadMonth(ym) {
    T.ym = ym; T.rows = null; render();
    return call('hrTimeList', state.token, ym + '-01', endOf(ym)).then(function (r) {
      if (!r.ok) { toast(r.error); return; }
      T.rows = r.rows; T.init.map = r.map;
      var days = uniqDays(); if (days.indexOf(T.day) < 0) T.day = days[days.length - 1] || '';
      render();
    }).catch(onServerError);
  }
  function uniqDays() { return (T.rows || []).map(function (r) { return r.date; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(); }
  T.page = function () {
    if (!T.init) {
      $('main').innerHTML = '<h3>ลงเวลา (เครื่องสแกน)</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลด…</div>';
      return call('hrTimeInit', state.token).then(function (r) { T.init = r; loadMonth(T.ym || ymNow()); }).catch(onServerError);
    }
    render();
  };

  // ---------- หน้า ----------
  var FILTERS = [['all', 'ทั้งหมด'], ['late', 'มาสาย'], ['absent', 'ขาดงาน'], ['miss', 'ลืมสแกน'], ['early', 'ออกก่อน'], ['nomap', 'ยังไม่จับคู่']];
  function isAbsent(r) { return /ขาดงาน/.test(r.remark); }
  function isMiss(r) { return /ไม่สแกน/.test(r.remark); }
  function pass(r, f) {
    return f === 'all' || (f === 'late' && r.lateMin > 0) || (f === 'absent' && isAbsent(r)) || (f === 'miss' && isMiss(r)) || (f === 'early' && r.earlyMin > 0) || (f === 'nomap' && !r.empId);
  }
  function who(r) { var p = r.empId && person(r.empId); return p ? '<b>' + esc(p.name) + '</b>' + (p.nick ? ' <small>(' + esc(p.nick) + ')</small>' : '') + (p.job ? ' <small class="htjob">Job</small>' : '') : '<b>' + esc(r.name) + '</b> <small class="htnomap">ยังไม่จับคู่</small>'; }
  function render() {
    var days = uniqDays(), all = (T.rows || []).filter(function (r) { return r.date === T.day; });
    var cnt = function (f) { return all.filter(function (r) { return pass(r, f); }).length; };
    var head = '<h3>ลงเวลา (เครื่องสแกน)</h3><p class="lead">นำเข้าไฟล์รายงานจากโปรแกรมเครื่องสแกน (PDF / Excel) · มาสาย และ ขาดงาน ระบบลงในหน้าการลาให้เป็นข้อมูล (ไม่ต้องอนุมัติ)</p>'
      + '<div class="pbar htbar"><button class="btn btn-sm btn-primary" id="htImport">' + icon('sheet', 16) + ' นำเข้าไฟล์ลงเวลา (PDF / Excel)</button>'
      + '<label class="htlb">เดือน <input type="month" id="htYm" value="' + T.ym + '"></label>'
      + '<div class="htab"><button class="chip' + (T.tab === 'day' ? ' on' : '') + '" data-tab="day">รายวัน</button><button class="chip' + (T.tab === 'sum' ? ' on' : '') + '" data-tab="sum">สรุปทั้งเดือน</button></div></div>';
    if (!T.rows) { $('main').innerHTML = head + '<div class="panel"><span class="spinner dark"></span> กำลังโหลด…</div>'; bindTop(); return; }
    if (!days.length) { $('main').innerHTML = head + '<div class="panel muted">ยังไม่มีข้อมูลลงเวลาในเดือนนี้ — กด "นำเข้าไฟล์ลงเวลา"</div>'; bindTop(); return; }
    var body = T.tab === 'sum' ? sumHtml() : '<div class="pbar htbar"><label class="htlb">วันที่ <select id="htDay">' + days.map(function (d) { return '<option value="' + d + '"' + (d === T.day ? ' selected' : '') + '>' + th(d) + '</option>'; }).join('') + '</select></label>'
      + '<div class="pchips">' + FILTERS.map(function (f) { var n = cnt(f[0]); return '<button class="chip' + (T.f === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + ' ' + n + '</button>'; }).join('') + '</div></div>'
      + '<div class="panel httab"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>แผนก</th><th>เข้า</th><th>ออก</th><th>เวลาทำงาน</th><th>สาย</th><th>ออกก่อน</th><th>OT</th><th>หมายเหตุ</th></tr></thead><tbody>'
      + (all.filter(function (r) { return pass(r, T.f); }).map(function (r) {
        var cls = r.dayStatus === 'วันหยุด' ? 'off' : isAbsent(r) ? 'abs' : r.lateMin > 0 ? 'late' : isMiss(r) || r.earlyMin > 0 ? 'warn' : '';
        return '<tr class="' + cls + '"><td>' + esc(r.machineId) + '</td><td>' + who(r) + '</td><td>' + esc(r.dept) + '</td><td>' + esc(r.timeIn || '–') + '</td><td>' + esc(r.timeOut || '–') + '</td><td>' + esc(r.workTime || '') + '</td>'
          + '<td>' + (r.lateMin ? '<b class="neg">' + mm(r.lateMin) + '</b>' : '') + '</td><td>' + (r.earlyMin ? mm(r.earlyMin) : '') + '</td><td>' + esc([r.otBefore, r.otAfter].filter(String).join(' / ')) + '</td>'
          + '<td>' + esc(r.dayStatus === 'วันหยุด' ? 'วันหยุด' : r.remark) + '</td></tr>';
      }).join('') || '<tr><td colspan="10" class="muted">ไม่มีรายการ</td></tr>') + '</tbody></table></div>'
      + (cnt('nomap') ? '<p class="muted">มี ' + cnt('nomap') + ' คนที่ยังไม่จับคู่กับทะเบียน — มาสาย / ขาดงานของคนกลุ่มนี้ยังไม่ลงในหน้าการลา · <button class="link-btn" id="htRemap">จับคู่รายชื่อ</button></p>' : '');
    $('main').innerHTML = head + body;
    bindTop();
    if ($('htDay')) $('htDay').addEventListener('change', function () { T.day = this.value; render(); });
    on('[data-f]', 'click', function (el) { T.f = el.getAttribute('data-f'); render(); });
    if ($('htRemap')) $('htRemap').addEventListener('click', function () { mapDialog(T.rows.filter(function (r) { return !r.empId; }), true); });
  }
  function bindTop() {
    $('htImport').addEventListener('click', pickFile);
    $('htYm').addEventListener('change', function () { if (this.value) loadMonth(this.value); });
    on('[data-tab]', 'click', function (el) { T.tab = el.getAttribute('data-tab'); render(); });
  }
  // สรุปทั้งเดือนต่อคน
  function sumHtml() {
    var by = {};
    T.rows.forEach(function (r) {
      var k = r.empId || 'M' + r.machineId, s = by[k] = by[k] || { r: r, work: 0, late: 0, lateMin: 0, absent: 0, miss: 0, early: 0 };
      if (r.dayStatus === 'วันหยุด') return;
      if (r.timeIn || r.timeOut) s.work++;
      if (r.lateMin > 0) { s.late++; s.lateMin += r.lateMin; }
      if (isAbsent(r)) s.absent++;
      if (isMiss(r)) s.miss++;
      if (r.earlyMin > 0) s.early++;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (b.absent * 3 + b.late) - (a.absent * 3 + a.late) || (Number(a.r.machineId) - Number(b.r.machineId)); });
    return '<div class="panel httab"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>มาทำงาน (วัน)</th><th>มาสาย</th><th>ขาดงาน</th><th>ลืมสแกน</th><th>ออกก่อน</th></tr></thead><tbody>'
      + list.map(function (s) {
        return '<tr class="' + (s.absent ? 'abs' : s.late ? 'late' : '') + '"><td>' + esc(s.r.machineId) + '</td><td>' + who(s.r) + '</td><td>' + s.work + '</td><td>' + (s.late ? '<b class="neg">' + s.late + ' ครั้ง</b> · ' + mm(s.lateMin) : '') + '</td>'
          + '<td>' + (s.absent ? '<b class="neg">' + s.absent + ' วัน</b>' : '') + '</td><td>' + (s.miss ? s.miss + ' ครั้ง' : '') + '</td><td>' + (s.early ? s.early + ' ครั้ง' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // ---------- นำเข้า ----------
  function pickFile() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,.xlsx,.xls,application/pdf'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; document.body.removeChild(inp); if (!f) return;
      var b = $('htImport'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังอ่านไฟล์';
      (/\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? readPdf(f) : readXlsx(f)).then(function (rows) {
        b.disabled = false; b.innerHTML = icon('sheet', 16) + ' นำเข้าไฟล์ลงเวลา (PDF / Excel)';
        if (!rows.length) { toast('ไม่พบข้อมูลลงเวลาในไฟล์'); return; }
        previewDialog(rows, f.name);
      }).catch(function (e) { b.disabled = false; b.innerHTML = icon('sheet', 16) + ' นำเข้าไฟล์ลงเวลา (PDF / Excel)'; toast(e.message || 'อ่านไฟล์ไม่ได้'); });
    });
    inp.click();
  }
  // จับคู่: แสดงเฉพาะรหัสที่ยังไม่เคยจับคู่ (เดาจากชื่อ / ชื่อเล่นในวงเล็บให้ก่อน) · remap = เปิดจากหน้าหลักเพื่อจับคู่ที่ค้าง
  function mapRows(rows) {
    var seen = {}, out = [];
    rows.forEach(function (r) { if (seen[r.machineId] || r.dayStatus === 'วันหยุด' && !r.timeIn) return; seen[r.machineId] = 1; if (!T.init.map[r.machineId]) out.push({ machineId: r.machineId, name: r.name, dept: r.dept, guess: guess(r) }); });
    return out;
  }
  function mapHtml(list) {
    if (!list.length) return '';
    var opts = T.init.people.filter(function (p) { return !p.out; }).sort(function (a, b) { return (a.job - b.job) || a.name.localeCompare(b.name, 'th'); });
    return '<h4 style="margin:14px 0 6px">จับคู่รายชื่อในเครื่องสแกนกับทะเบียน (' + list.length + ' คน · ทำครั้งเดียว ระบบจำไว้)</h4><p class="muted" style="margin:0 0 8px">ระบบเดาจากชื่อให้แล้ว — ตรวจคนที่ยังว่าง · ถ้าไม่ใช่พนักงานในทะเบียนให้เว้นว่าง</p>'
      + '<div class="htmap">' + list.map(function (m, i) {
        return '<div class="htmr' + (m.guess ? '' : ' need') + '"><span><b>' + esc(m.machineId) + '</b> ' + esc(m.name) + ' <small class="muted">' + esc(m.dept) + '</small></span><select data-mi="' + i + '"><option value="">— ไม่จับคู่ —</option>'
          + opts.map(function (p) { return '<option value="' + p.id + '"' + (p.id === m.guess ? ' selected' : '') + '>' + esc(pLabel(p)) + '</option>'; }).join('') + '</select></div>';
      }).join('') + '</div>';
  }
  function readMap(list) { var out = {}; list.forEach(function (m, i) { var el = $('mBody').querySelector('[data-mi="' + i + '"]'); out[m.machineId] = el ? el.value : ''; }); return out; }
  function previewDialog(rows, fname) {
    var days = rows.map(function (r) { return r.date; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    var work = rows.filter(function (r) { return r.dayStatus !== 'วันหยุด'; });
    var n = function (fn) { return work.filter(fn).length; }, list = mapRows(rows);
    openModal({ color: state.dept.color, icon: 'cal', wide: true, title: 'นำเข้าไฟล์ลงเวลา', sub: fname,
      body: '<div class="htsum"><div><b>' + (days.length === 1 ? th(days[0]) : th(days[0]) + ' – ' + th(days[days.length - 1])) + '</b><span>' + days.length + ' วัน · ' + rows.length + ' รายการ</span></div>'
        + '<div class="late"><b>' + n(function (r) { return r.lateMin > 0; }) + '</b><span>มาสาย</span></div><div class="abs"><b>' + n(isAbsent) + '</b><span>ขาดงาน</span></div>'
        + '<div><b>' + n(isMiss) + '</b><span>ลืมสแกน</span></div><div><b>' + n(function (r) { return r.earlyMin > 0; }) + '</b><span>ออกก่อน</span></div></div>'
        + '<p class="muted" style="margin:8px 0 0">บันทึกแล้ว: มาสาย / ขาดงาน ลงในหน้าการลาให้เอง (ขาดงานเฉพาะคนที่ไม่มีใบลาวันนั้น) · นำเข้าวันเดิมซ้ำ = แทนข้อมูลเดิมของวันนั้น</p>'
        + mapHtml(list),
      ok: 'บันทึก ' + rows.length + ' รายการ',
      submit: function () {
        return call('hrTimeSave', state.token, rows, readMap(list)).then(function (r) {
          if (!r.ok) return r.error;
          closeModal(); T.init.map = r.map;
          toast('บันทึกแล้ว ' + r.saved + ' รายการ · มาสาย ' + r.late + ' · ขาดงาน ' + r.absent + (r.unmatched ? ' · ยังไม่จับคู่ ' + r.unmatched + ' คน' : ''));
          if (window.HRM && window.HRM.dirtyLeaves) window.HRM.dirtyLeaves();
          T.day = r.days[r.days.length - 1]; loadMonth(T.day.slice(0, 7));
        });
      } });
  }
  // จับคู่ที่ค้างจากหน้าหลัก → บันทึกการจับคู่ แล้วส่งแถวของเดือนนี้ไปบันทึกซ้ำ (ให้มาสาย / ขาดงานลงหน้าการลา)
  function mapDialog(rows) {
    var list = mapRows(rows);
    if (!list.length) { toast('ไม่มีรายชื่อที่ต้องจับคู่'); return; }
    openModal({ color: state.dept.color, icon: 'users', wide: true, title: 'จับคู่รายชื่อเครื่องสแกน', body: mapHtml(list), ok: 'บันทึกการจับคู่',
      submit: function () {
        return call('hrTimeSave', state.token, T.rows, readMap(list)).then(function (r) {
          if (!r.ok) return r.error;
          closeModal(); T.init.map = r.map; toast('จับคู่แล้ว · มาสาย ' + r.late + ' · ขาดงาน ' + r.absent); loadMonth(T.ym);
        });
      } });
  }

  var css = document.createElement('style');
  css.textContent = [
    '.htbar{flex-wrap:wrap;gap:10px;align-items:center}.htlb{display:flex;gap:6px;align-items:center;font-weight:600}.htlb input,.htlb select{padding:7px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}.htab{display:flex;gap:6px;margin-left:auto}',
    '.httab{overflow-x:auto;padding:0}.httab table{width:100%;border-collapse:collapse;font-size:14px}.httab th{background:#f1f5f9;text-align:left;padding:8px;white-space:nowrap;position:sticky;top:0}.httab td{padding:7px 8px;border-top:1px solid var(--line);vertical-align:top}',
    '.httab tr.off td{color:#94a3b8}.httab tr.abs td{background:#fef2f2}.httab tr.late td{background:#fff7ed}.httab tr.warn td{background:#fffbeb}.htnomap{color:#b45309;background:#fef3c7;border-radius:6px;padding:1px 6px}.htjob{color:#c2410c}',
    '.htsum{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:8px}.htsum div{background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}.htsum b{display:block;font-size:20px}.htsum span{font-size:13px;color:#475569}.htsum .late b{color:#c2410c}.htsum .abs b{color:#dc2626}',
    '.htmap{max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:10px}.htmr{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:7px 10px;border-top:1px solid var(--line)}.htmr:first-child{border-top:0}.htmr.need{background:#fffbeb}.htmr select{max-width:320px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit}',
    '@media (max-width:700px){.htsum{grid-template-columns:repeat(2,1fr)}.htsum div:first-child{grid-column:1/-1}.htab{margin-left:0}}'
  ].join('\n');
  document.head.appendChild(css);
})();
