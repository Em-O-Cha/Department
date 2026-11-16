// ==================== ฝ่ายประกันคุณภาพ (QA) — ข้อร้องเรียนลูกค้า ====================
// หน้าเว็บของโมดูล "quality" — index.html เรียก QAM.menus() / QAM.render(page)
// ข้อมูลผ่าน API Qa.gs (qaLoad, qaSave, ...) · รูปเก็บในโฟลเดอร์ Drive ของฝ่าย
// 1 เรื่อง = 4 ขั้น: รับเรื่อง → ตรวจสอบสาเหตุ → แก้ไขเป็นรอบ (รอบ 1, 2, … แก้ไขได้ / ไม่ได้) → แจ้งผลลูกค้า & ปิดเรื่อง
(function () {
  var H = window.QAM = { data: null, loading: null, q: {}, cur: null, open: null };

  Object.assign(ICONS, {
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'
  });
  var MENUS = [
    { id: 'q_dash', label: 'ภาพรวม / Dashboard', ic: 'home' },
    { id: 'q_list', label: 'ข้อร้องเรียนลูกค้า', ic: 'msg' },
    { id: 'q_rep', label: 'รายงาน / พิมพ์', ic: 'print' },
    { id: 'q_set', label: 'ตั้งค่า', ic: 'gear' },
    { id: 'q_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var ST = { open: 'รับเรื่อง', investigating: 'ตรวจสอบสาเหตุ', fixing: 'กำลังแก้ไข', closed_ok: 'ปิด · แก้ไขได้', closed_fail: 'ปิด · แก้ไขไม่ได้' };
  var SEV = { C: 'วิกฤต', H: 'สูง', M: 'ปานกลาง', L: 'ต่ำ' };
  var SEV_HINT = { C: 'กระทบความปลอดภัยผู้บริโภค เช่น สิ่งแปลกปลอมมีคม เชื้อรา', H: 'สินค้าใช้ไม่ได้ / ลูกค้าหลายราย', M: 'คุณภาพไม่ตรงมาตรฐาน', L: 'ไม่กระทบการบริโภค' };
  var RES = { wait: 'รอทวนสอบ', ok: 'แก้ไขได้', fail: 'แก้ไขไม่ได้' };
  var VALID = ['จริง (ปัญหาจากโรงงาน)', 'ไม่จริง / ไม่ได้เกิดจากโรงงาน', 'ยังไม่สรุป'];
  var SAMPLE = ['ได้รับตัวอย่างคืนแล้ว', 'รอรับตัวอย่าง', 'ไม่มีตัวอย่าง (มีแต่รูป)'];
  var SATIS = ['พอใจ', 'เฉย ๆ', 'ไม่พอใจ', 'ติดต่อลูกค้าไม่ได้'];
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var COMPANY = 'บริษัท สปังกี้ฟู้ด จำกัด';

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function days(a, b) { if (!a || !b) return null; var p = a.split('-'), q = b.split('-'); return Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(2) : esc(iso); }
  function ymLabel(ym) { return MONTHS[+ym.slice(5, 7) - 1] + ' ' + String(+ym.slice(0, 4) + 543).slice(2); }
  function list(s) { return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
  function S_() { return H.data.settings; }
  function closed(c) { return String(c.status).indexOf('closed') === 0; }
  function ageOf(c) { return days(c.recvDate, closed(c) ? c.closeDate : H.data.today); }
  function late(c) { return !closed(c) && ageOf(c) > (Number(S_().closeDays) || 15); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function v(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function F(id, label, value, type, attrs, req) { return '<div class="pf"><label for="' + id + '">' + label + (req ? ' <b class="qreq">*</b>' : '') + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + '></div>'; }
  function S(id, label, opts, value, req, ph) {
    var o = opts.map(function (x) { return Array.isArray(x) ? x : [x, x]; });
    if (value && !o.some(function (x) { return x[0] === value; })) o.push([value, value]);
    return '<div class="pf"><label for="' + id + '">' + label + (req ? ' <b class="qreq">*</b>' : '') + '</label><select id="' + id + '"><option value="">' + (ph || '— เลือก —') + '</option>'
      + o.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(value || '') ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function T(id, label, value, ph, req, rows) { return '<div class="pf full"><label for="' + id + '">' + label + (req ? ' <b class="qreq">*</b>' : '') + '</label><textarea id="' + id + '" rows="' + (rows || 2) + '" placeholder="' + esc(ph || '') + '">' + esc(value || '') + '</textarea></div>'; }
  function DL(id, label, value, opts, attrs, req) { return F(id, label, value, 'text', ' list="' + id + 'L"' + (attrs || ''), req) + '<datalist id="' + id + 'L">' + opts.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'; }
  function stTag(c) { var l = late(c); return '<span class="qtag q' + c.status + (l ? ' late' : '') + '">' + (l ? 'เกินกำหนด · ' : '') + (ST[c.status] || c.status) + '</span>'; }
  function sevTag(k) { return '<span class="qsev s' + (k || 'M') + '">' + (SEV[k] || 'ปานกลาง') + '</span>'; }
  function roundChips(c) {
    return (c.rounds || []).map(function (r) { return '<span class="qrc ' + r.result + '">รอบ ' + r.no + ' ' + (r.result === 'ok' ? '✓' : r.result === 'fail' ? '✕' : '…') + ' ' + RES[r.result] + '</span>'; }).join('');
  }
  function img(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 400); }

  // ---------- รูปถ่าย ----------
  function shrink(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var data = c.toDataURL('image/jpeg', 0.8);
        res({ dataUrl: data, b64: data.split(',')[1], name: (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', tmp: 't' + Math.random().toString(36).slice(2) });
      };
      im.onerror = function () { URL.revokeObjectURL(url); res(null); };
      im.src = url;
    });
  }
  function pickPhotos(cb, cam) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    if (cam) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function () { var files = Array.prototype.slice.call(inp.files || []); document.body.removeChild(inp); Promise.all(files.map(shrink)).then(function (a) { cb(a.filter(Boolean)); }); });
    inp.click();
  }

  // ---------- โหลด ----------
  H.load = function () {
    if (H.loading) return H.loading;
    H.loading = call('qaLoad', state.token).then(function (d) { H.data = d; H.loading = null; return d; }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  function reload(msg) { if (msg) toast(msg); return H.load().then(function () { if (String(state.page).indexOf('q_') === 0) H.render(state.page); }).catch(onServerError); }
  H.reset = function () { H.data = null; H.q = {}; H.cur = null; H.open = null; };
  H.menus = function () { return MENUS; };
  H.render = function (page) {
    if (!H.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">กำลังโหลดข้อมูลจาก Google Sheet…</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      H.load().then(function () { if (state.page === page) H.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">เปิดข้อมูลไม่ได้</p><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet และโฟลเดอร์รูปของฝ่าย แล้วแชร์ให้บัญชีของระบบเป็นผู้แก้ไข</span></div></div>';
      });
      return;
    }
    if (page === 'q_list' && H.open) { var id = H.open; H.open = null; return caseForm(id === 'new' ? null : H.data.complaints.filter(function (c) { return c.id === id; })[0]); }
    ({ q_dash: dash, q_list: listPage, q_rep: report, q_set: settings, q_log: logPage }[page] || dash)();
  };
  function openCase(id) { H.open = id || 'new'; go('q_list'); }

  // ==================== ภาพรวม ====================
  function dash() {
    var t = H.data.today, q = H.q;
    if (!q.from) { q.from = t.slice(0, 8) + '01'; q.to = t; }
    var lm = addDays(t.slice(0, 8) + '01', -1);
    var quick = [['เดือนนี้', t.slice(0, 8) + '01', t], ['เดือนก่อน', lm.slice(0, 8) + '01', lm], ['3 เดือน', addDays(t, -89), t], ['ปีนี้', t.slice(0, 4) + '-01-01', t]];
    var open = H.data.complaints.filter(function (c) { return !closed(c); });
    $('main').innerHTML = '<h3>ภาพรวม ข้อร้องเรียนลูกค้า</h3><p class="lead">ข้อมูล ณ ' + dd(t) + ' · <a href="' + esc(H.data.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + '<div class="qtop"><button class="btn btn-primary qbig" id="dNew">' + icon('plus', 20) + ' รับเรื่องร้องเรียนใหม่</button>'
      + '<button class="btn btn-line" id="dOpen">' + icon('msg', 18) + ' เรื่องที่ยังไม่ปิด <b>' + open.length + '</b></button></div>'
      + '<div class="pbar noprint"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<input type="date" id="dFrom" value="' + q.from + '" aria-label="ตั้งแต่"> – <input type="date" id="dTo" value="' + q.to + '" aria-label="ถึง">'
      + '<button class="btn btn-sm btn-line" id="dPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div id="dOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>';
    $('dNew').addEventListener('click', function () { openCase(null); });
    $('dOpen').addEventListener('click', function () { H.q.lst = 'open'; go('q_list'); });
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['dFrom', 'dTo'].forEach(function (id) { $(id).addEventListener('change', function () { if (v('dFrom') && v('dTo') && v('dFrom') <= v('dTo')) { q.from = v('dFrom'); q.to = v('dTo'); dash(); } else toast('เลือกช่วงวันที่ให้ถูกต้อง'); }); });
    $('dPrint').addEventListener('click', function () { window.print(); });
    var my = H.dseq = (H.dseq || 0) + 1;
    call('qaDashboard', state.token, q.from, q.to).then(function (r) {
      if (my !== H.dseq || state.page !== 'q_dash') return;
      if (!r.ok) { $('dOut').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
      $('dOut').innerHTML = H.dashHtml(r, true);
      on('[data-cc]', 'click', function (el) { openCase(el.getAttribute('data-cc')); }, $('dOut'));
    }).catch(onServerError);
  }
  // ใช้ร่วมกับ Dashboard ผู้บริหาร (executive.js)
  H.dashHtml = function (r, interactive) {
    var k = r.kpi, tg = r.targets;
    var tile = function (val, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + val + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var bar = function (label, n, max, color) { return '<div class="sbar"><span>' + esc(label) + '</span><i><em style="width:' + Math.max(2, Math.round(n / Math.max(1, max) * 100)) + '%;background:' + color + '"></em></i><b>' + n + '</b></div>'; };
    var box = function (title, rows, empty) { return '<div class="panel pbox"><h4>' + title + '</h4>' + (rows.length ? rows.join('') : '<div class="muted">' + empty + '</div>') + '</div>'; };
    var bars = function (arr, color) { var mx = arr.length ? arr[0].n : 1; return arr.map(function (x) { return bar(x.name, x.n, mx, color); }); };
    var html = '<div class="kpis">'
      + tile(k.total, 'เรื่องร้องเรียน (ช่วงนี้)', '#7c3aed', 'สูง/วิกฤต ' + k.severe + ' เรื่อง')
      + tile(k.open, 'ยังไม่ปิด (ทั้งหมด)', k.overdue ? '#dc2626' : k.open ? '#d97706' : '#16a34a', 'เกินกำหนด ' + tg.closeDays + ' วัน: ' + k.overdue + ' เรื่อง')
      + tile(k.firstRoundPct == null ? '–' : k.firstRoundPct + '%', 'แก้ไขได้ในรอบแรก', '#2563eb', 'ปิดแล้ว ' + k.closed + ' · แก้ได้ ' + k.closedOk + ' · ไม่ได้ ' + k.closedFail)
      + tile(k.avgClose == null ? '–' : k.avgClose + ' วัน', 'เวลาปิดเรื่องเฉลี่ย', k.avgClose != null && k.avgClose > tg.closeDays ? '#dc2626' : '#16a34a', 'เป้าหมาย ≤ ' + tg.closeDays + ' วัน')
      + tile(k.avgReply == null ? '–' : k.avgReply + ' วัน', 'ตอบลูกค้าครั้งแรกเฉลี่ย', k.replyLate ? '#d97706' : '#16a34a', 'ช้ากว่าเป้า (' + tg.replyDays + ' วัน) ' + k.replyLate + ' เรื่อง')
      + '</div>';
    var mxT = Math.max.apply(null, r.trend.map(function (m) { return m.n; }).concat([1]));
    html += '<div class="pgrid">'
      + box(icon('warn', 18) + ' เรื่องค้างเกินกำหนด', r.overdueList.map(function (o) {
        return '<div class="li' + (interactive ? ' click" data-cc="' + esc(o.id) : '') + '"><span>' + esc(o.code) + ' · ' + esc(o.product) + ' · ' + esc(o.issueType) + '</span><b class="neg">' + o.days + ' วัน</b><small>รับเรื่อง ' + dd(o.recvDate) + ' · ' + (ST[o.status] || '') + ' · แก้ไขแล้ว ' + o.rounds + ' รอบ · ความรุนแรง' + (SEV[o.severity] || '') + '</small></div>';
      }), 'ไม่มีเรื่องค้างเกินกำหนด 👍')
      + box(icon('chart', 18) + ' ประเภทปัญหา', bars(r.byIssue, '#7c3aed'), 'ไม่มีข้อร้องเรียนในช่วงนี้')
      + box(icon('chart', 18) + ' สินค้าที่ถูกร้องเรียน', bars(r.byProduct, '#2563eb'), 'ไม่มีข้อร้องเรียนในช่วงนี้')
      + box(icon('chart', 18) + ' หมวดสาเหตุ (4M1E)', bars(r.byCause, '#d97706'), 'ยังไม่มีการระบุสาเหตุ')
      + box(icon('chart', 18) + ' ช่องทางที่รับเรื่อง', bars(r.byChannel, '#0891b2'), 'ไม่มีข้อร้องเรียนในช่วงนี้')
      + box(icon('chart', 18) + ' ความรุนแรง · มูลค่าชดเชย', r.bySeverity.map(function (x) { return bar(x.name, x.n, Math.max.apply(null, r.bySeverity.map(function (y) { return y.n; }).concat([1])), { C: '#991b1b', H: '#dc2626', M: '#d97706', L: '#16a34a' }[x.key]); })
        .concat(['<div class="li"><span>มูลค่าชดเชยลูกค้ารวม</span><b>฿' + Number(k.cost || 0).toLocaleString('th-TH') + '</b></div>', '<div class="li"><span>ข้อร้องเรียนที่เป็นจริง (ปัญหาจากโรงงาน)</span><b>' + (k.validPct == null ? '–' : k.validPct + '%') + '</b></div>']), '')
      + '</div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('chart', 18) + ' แนวโน้ม 6 เดือน</h4><div class="qtrend">' + r.trend.map(function (m) {
        return '<div class="qtm" title="' + ymLabel(m.ym) + ': ' + m.n + ' เรื่อง · ปิดแล้ว ' + m.closed + ' · สูง/วิกฤต ' + m.critical + '"><b>' + m.n + '</b><div class="qtb"><em class="b1" style="height:' + Math.round(m.n / mxT * 100) + '%"></em><em class="b2" style="height:' + Math.round(m.closed / mxT * 100) + '%"></em><em class="b3" style="height:' + Math.round(m.critical / mxT * 100) + '%"></em></div><span>' + ymLabel(m.ym) + '</span></div>';
      }).join('') + '</div><div class="slegend"><i class="b1"></i>รับเรื่อง <i class="b2"></i>ปิดแล้ว <i class="b3"></i>ความรุนแรงสูง/วิกฤต</div></div>';
    return html;
  };

  // ==================== รายการข้อร้องเรียน ====================
  function listPage() {
    var all = H.data.complaints, f = H.q.lst || 'open';
    var cnt = { all: all.length, open: all.filter(function (c) { return !closed(c); }).length, late: all.filter(late).length, closed: all.filter(closed).length };
    $('main').innerHTML = '<h3>ข้อร้องเรียนลูกค้า</h3><p class="lead">แตะรายการเพื่อดู / บันทึกการตรวจสอบ การแก้ไขแต่ละรอบ และปิดเรื่อง</p>'
      + '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="qSearch" placeholder="ค้นหาเลขที่ / สินค้า / LOT / ลูกค้า / ปัญหา" value="' + esc(H.q.search || '') + '"></div>'
      + '<button class="btn btn-sm btn-primary" id="qNew">' + icon('plus', 16) + 'รับเรื่องใหม่</button></div>'
      + '<div class="pchips">' + [['open', 'ยังไม่ปิด'], ['late', 'เกินกำหนด'], ['closed', 'ปิดแล้ว'], ['all', 'ทั้งหมด']].map(function (x) {
        return '<button class="chip' + (f === x[0] ? ' on' : '') + (x[0] === 'late' && cnt.late ? ' qlatechip' : '') + '" data-f="' + x[0] + '">' + x[1] + ' (' + cnt[x[0]] + ')</button>';
      }).join('') + '</div><div id="qList" class="qlist"></div>';
    var draw = function () {
      var s = (H.q.search || '').toLowerCase();
      var rows = all.filter(function (c) { return f === 'all' || (f === 'open' && !closed(c)) || (f === 'late' && late(c)) || (f === 'closed' && closed(c)); })
        .filter(function (c) { return !s || [c.code, c.product, c.lot, c.custName, c.custPhone, c.issueType, c.detail].join(' ').toLowerCase().indexOf(s) >= 0; });
      $('qList').innerHTML = rows.map(function (c) {
        var age = ageOf(c);
        return '<button class="qcard s' + (c.severity || 'M') + '" data-id="' + esc(c.id) + '"><div class="qc1"><b>' + esc(c.code) + '</b><span>' + dd(c.recvDate) + (c.channel ? ' · ' + esc(c.channel) : '') + '</span>' + stTag(c) + sevTag(c.severity) + '</div>'
          + '<div class="qc2"><b>' + esc(c.product) + '</b>' + (c.lot ? ' <small>LOT ' + esc(c.lot) + '</small>' : '') + ' · ' + esc(c.issueType) + '</div>'
          + '<div class="qc3">' + esc(c.detail).slice(0, 140) + '</div>'
          + '<div class="qc4">' + (roundChips(c) || '<span class="qrc none">ยังไม่เริ่มแก้ไข</span>') + '<span class="qage' + (late(c) ? ' late' : '') + '">' + (closed(c) ? 'ปิดเรื่องใน ' + age + ' วัน' : 'เปิดมา ' + age + ' วัน') + '</span></div></button>';
      }).join('') || '<div class="empty"><div class="icon">' + icon('msg', 28) + '</div><h4>ไม่มีรายการ</h4><div>' + (all.length ? 'ลองเปลี่ยนตัวกรองหรือคำค้นหา' : 'กด "รับเรื่องใหม่" เพื่อบันทึกข้อร้องเรียนแรก') + '</div></div>';
      on('[data-id]', 'click', function (el) { caseForm(H.data.complaints.filter(function (c) { return c.id === el.getAttribute('data-id'); })[0]); window.scrollTo(0, 0); }, $('qList'));
    };
    $('qSearch').addEventListener('input', function () { H.q.search = this.value; draw(); });
    $('qNew').addEventListener('click', function () { caseForm(null); window.scrollTo(0, 0); });
    on('[data-f]', 'click', function (el) { H.q.lst = el.getAttribute('data-f'); listPage(); }, $('main'));
    draw();
  }

  // ==================== แบบบันทึก 1 เรื่อง (รับเรื่อง → สาเหตุ → แก้ไขรอบ → ปิด) ====================
  function caseForm(c) {
    var s = S_(), isNew = !c, t = H.data.today;
    var x = H.cur = c ? JSON.parse(JSON.stringify(c)) : { recvDate: t, severity: 'M', rounds: [], files: [], fixFiles: [], status: 'open' };
    x.pending = { files: [], fix: [] };
    var dirty = false;
    var people = list(s.people);
    var draw = function () {
      var rounds = x.rounds, last = rounds[rounds.length - 1];
      var age = days(x.recvDate, closed(x) ? x.closeDate : t), reply = days(x.recvDate, x.replyDate);
      var step = closed(x) ? 4 : rounds.length ? 3 : (x.investigation || x.rootCause) ? 2 : 1;
      $('main').innerHTML = '<div class="qhead"><button class="btn btn-line btn-sm" id="cBack">' + icon('back', 16) + ' รายการ</button>'
        + '<div class="qht"><h3>' + (isNew ? 'รับเรื่องร้องเรียนใหม่' : esc(x.code)) + '</h3>' + (isNew ? '' : stTag(x) + sevTag(x.severity)) + '</div>'
        + (isNew ? '' : '<button class="btn btn-line btn-sm" id="cPrint">' + icon('print', 16) + ' พิมพ์แบบฟอร์ม</button>') + '</div>'
        + (isNew ? '<p class="lead">กรอกข้อมูลรับเรื่องอย่างน้อย สินค้า · ประเภทปัญหา · รายละเอียด แล้วกดบันทึก ส่วนที่เหลือกลับมาเพิ่มได้ภายหลัง</p>' : '')
        + '<ol class="qsteps">' + ['รับเรื่อง', 'ตรวจสอบสาเหตุ', 'แก้ไข' + (rounds.length ? ' (' + rounds.length + ' รอบ)' : ''), 'แจ้งผล & ปิดเรื่อง'].map(function (n, i) {
          return '<li class="' + (i + 1 < step ? 'done' : i + 1 === step ? 'on' : '') + '"><i>' + (i + 1 < step ? '✓' : i + 1) + '</i>' + n + '</li>'; }).join('') + '</ol>'
        + (isNew ? '' : '<div class="qtimes"><div><span>ตอบลูกค้าครั้งแรก</span><b class="' + (reply != null && reply > (+s.replyDays || 1) ? 'neg' : '') + '">' + (reply == null ? 'ยังไม่ได้ตอบ' : reply + ' วัน') + '</b><small>เป้า ≤ ' + s.replyDays + ' วัน</small></div>'
          + '<div><span>' + (closed(x) ? 'ใช้เวลาทั้งเรื่อง' : 'เปิดเรื่องมาแล้ว') + '</span><b class="' + (age > (+s.closeDays || 15) ? 'neg' : '') + '">' + age + ' วัน</b><small>เป้า ≤ ' + s.closeDays + ' วัน</small></div>'
          + rounds.map(function (r) { var dur = days(r.startDate, r.verifyDate || (r.result === 'wait' ? t : '')); return '<div><span>รอบที่ ' + r.no + ' · ' + RES[r.result] + '</span><b class="' + (r.result === 'fail' ? 'neg' : r.result === 'ok' ? 'pos' : '') + '">' + (dur == null ? '–' : dur + ' วัน') + '</b><small>' + (r.startDate ? dd(r.startDate) + ' → ' + (r.verifyDate ? dd(r.verifyDate) : 'ยังไม่ทวนสอบ') : 'ยังไม่ระบุวันเริ่ม') + '</small></div>'; }).join('') + '</div>')
        // ---- 1 รับเรื่อง
        + sec(1, 'รับเรื่อง', 'ข้อมูลลูกค้า สินค้า และปัญหาที่พบ',
          '<div class="pform">' + F('fRecv', 'วันที่รับเรื่อง', x.recvDate, 'date', ' max="' + t + '"', true) + F('fTime', 'เวลา', x.recvTime, 'time')
          + S('fChannel', 'ช่องทาง', list(s.channels), x.channel) + DL('fReceiver', 'ผู้รับเรื่อง', x.receiver, people) + '</div>'
          + '<h5 class="qsub">ลูกค้า</h5><div class="pform">' + F('fCust', 'ชื่อลูกค้า / ร้านค้า', x.custName) + F('fCustPhone', 'เบอร์โทร', x.custPhone, 'tel')
          + S('fCustType', 'ประเภทลูกค้า', list(s.custTypes), x.custType) + F('fCustPlace', 'ที่อยู่ / สาขา', x.custPlace) + '</div>'
          + '<h5 class="qsub">สินค้า</h5><div class="pform">' + DL('fProduct', 'สินค้า', x.product, list(s.products), ' placeholder="พิมพ์หรือเลือกจากรายการ"', true) + F('fLot', 'LOT / รหัสการผลิต', x.lot)
          + F('fMfg', 'วันผลิต', x.mfgDate, 'date') + F('fExp', 'วันหมดอายุ', x.expDate, 'date') + F('fQty', 'จำนวนที่มีปัญหา', x.qty, 'text', ' placeholder="เช่น 2 ซอง"') + F('fBuy', 'ซื้อจาก (ร้าน / สาขา / แพลตฟอร์ม)', x.buyFrom) + '</div>'
          + '<h5 class="qsub">ปัญหา</h5><div class="pform">' + S('fIssue', 'ประเภทปัญหา', list(s.issueTypes), x.issueType, true) + S('fSample', 'ตัวอย่างสินค้า', SAMPLE, x.sample)
          + '<div class="pf full"><label>ความรุนแรง</label><div class="qseg" id="fSev">' + ['L', 'M', 'H', 'C'].map(function (k) { return '<button type="button" class="s' + k + (x.severity === k ? ' on' : '') + '" data-sev="' + k + '" aria-pressed="' + (x.severity === k) + '"><b>' + SEV[k] + '</b><small>' + SEV_HINT[k] + '</small></button>'; }).join('') + '</div></div>'
          + T('fDetail', 'รายละเอียดปัญหา', x.detail, 'ลูกค้าพบอะไร เมื่อไร อย่างไร (ตามคำบอกเล่าของลูกค้า)', true, 3) + '</div>'
          + photoBox('files', 'รูปปัญหา / รูปจากลูกค้า'))
        // ---- 2–4 แสดงหลังบันทึกรับเรื่องแล้ว (เรื่องใหม่กรอกแค่ขั้นที่ 1 — ไม่ให้ฟอร์มยาวเกิน)
        + (isNew ? '<div class="qnext">' + icon('info', 18) + ' หลังบันทึกรับเรื่อง จะมีส่วน <b>ตรวจสอบสาเหตุ · การแก้ไขรอบ 1, 2 … · ปิดเรื่อง</b> ให้กรอกต่อ</div>' : sec(2, 'ตรวจสอบสาเหตุ & ชดเชยลูกค้า', 'ผลตรวจตัวอย่าง / ย้อนดูบันทึกการผลิต LOT นี้',
          '<div class="pform">' + S('fValid', 'ผลพิสูจน์ข้อร้องเรียน', VALID, x.valid) + S('fCause', 'หมวดสาเหตุ (4M1E)', list(s.causeCats), x.causeCat)
          + T('fInv', 'ผลการตรวจสอบ', x.investigation, 'เช่น ตรวจตัวอย่างคืน / ตรวจ LOT เดียวกันในคลัง / ดูบันทึกการผลิต', false, 3)
          + T('fRoot', 'สาเหตุที่แท้จริง (Root cause)', x.rootCause, 'ทำไมจึงเกิด (ถามทำไม 5 ครั้ง)') + '</div>'
          + '<h5 class="qsub">การชดเชยลูกค้า</h5><div class="pform">' + S('fRemedy', 'วิธีชดเชย', list(s.remedies), x.remedy) + F('fCost', 'มูลค่าชดเชย (บาท)', x.remedyCost, 'number', ' min="0" inputmode="decimal"')
          + T('fRemedyD', 'รายละเอียดการชดเชย', x.remedyDetail) + F('fReply', 'วันที่ตอบลูกค้าครั้งแรก', x.replyDate, 'date', ' max="' + t + '"') + '</div>')
        // ---- 3 แก้ไขเป็นรอบ
        + sec(3, 'การแก้ไข (Corrective action)', 'แก้ไขเป็นรอบ ทวนสอบผลทุกรอบ · ถ้ารอบไหน "แก้ไขไม่ได้" เพิ่มรอบถัดไป',
          '<div id="cRounds">' + rounds.map(roundHtml).join('') + '</div>'
          + (!rounds.length ? '<button type="button" class="btn btn-line qaddr" id="cAddR">' + icon('plus', 18) + ' เริ่มการแก้ไขรอบที่ 1</button>'
            : last.result === 'fail' && !closed(x) ? '<button type="button" class="btn btn-line qaddr" id="cAddR">' + icon('plus', 18) + ' เพิ่มการแก้ไขรอบที่ ' + (rounds.length + 1) + '</button>'
            : last.result === 'wait' ? '<p class="muted qhint">ทวนสอบผลรอบที่ ' + last.no + ' ก่อน (แก้ไขได้ / แก้ไขไม่ได้) จึงจะปิดเรื่องหรือเพิ่มรอบถัดไปได้</p>' : '')
          + '<div class="pform" style="margin-top:12px">' + T('fPrev', 'การป้องกันไม่ให้เกิดซ้ำ (Preventive action)', x.preventive, 'เช่น ปรับขั้นตอน / อบรมพนักงาน / เพิ่มจุดตรวจ') + '</div>'
          + photoBox('fix', 'รูปหลังแก้ไข'))
        // ---- 4 ปิดเรื่อง
        + sec(4, 'แจ้งผลลูกค้า & ปิดเรื่อง', '',
          '<div class="pform">' + F('fInform', 'วันที่แจ้งผลลูกค้า', x.informDate, 'date', ' max="' + t + '"') + S('fSatis', 'ความพึงพอใจของลูกค้า', SATIS, x.satisfaction) + '</div>'
          + '<div class="pf full"><label>สถานะเรื่อง</label><div class="qseg qst" id="fStatus">'
          + [['', 'ยังไม่ปิด', 'สถานะตามขั้นตอนอัตโนมัติ'], ['closed_ok', 'ปิด · แก้ไขได้', last && last.result === 'ok' ? 'รอบล่าสุดแก้ไขได้' : 'ต้องมีรอบที่ผล "แก้ไขได้"'], ['closed_fail', 'ปิด · แก้ไขไม่ได้', last && last.result === 'fail' ? 'ต้องเขียนสรุปเหตุผล' : 'ต้องมีรอบล่าสุดที่ "แก้ไขไม่ได้"']].map(function (o) {
            var dis = (o[0] === 'closed_ok' && !(last && last.result === 'ok')) || (o[0] === 'closed_fail' && !(last && last.result === 'fail'));
            var cur = o[0] ? x.status === o[0] : !closed(x);
            return '<button type="button" class="' + (o[0] || 'none') + (cur ? ' on' : '') + '" data-st="' + o[0] + '"' + (dis ? ' disabled' : '') + ' aria-pressed="' + cur + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>';
          }).join('') + '</div></div>'
          + '<div class="pform" id="cCloseBox"' + (closed(x) ? '' : ' style="display:none"') + '>' + F('fClose', 'วันที่ปิดเรื่อง', x.closeDate || t, 'date', ' max="' + t + '"') + DL('fClosedBy', 'ผู้ปิดเรื่อง', x.closedBy, people)
          + T('fCloseNote', 'สรุปการปิดเรื่อง', x.closeNote, x.status === 'closed_fail' ? 'จำเป็น: ทำไมแก้ไขไม่ได้ และจะดำเนินการต่ออย่างไร' : 'สรุปผลสั้น ๆ') + '</div>'))
        + '<div class="qsave"><button class="btn btn-line" id="cCancel">ยกเลิก</button><button class="btn btn-primary" id="cSave">' + icon('check', 18) + (isNew ? ' บันทึกรับเรื่อง' : ' บันทึก') + '</button></div>'
        + (isNew ? '' : '<div class="qdel"><button class="link-btn danger" id="cDel">' + icon('trash', 14) + ' ลบเรื่องนี้ (บันทึกผิด)</button></div>');
      bind();
    };
    function sec(n, title, hint, body) {
      return '<section class="panel qsec"><h4><i>' + n + '</i>' + title + (hint ? '<small>' + hint + '</small>' : '') + '</h4>' + body + '</section>';
    }
    function roundHtml(r, i) {
      var isLast = i === x.rounds.length - 1, lateR = r.result === 'wait' && r.dueDate && r.dueDate < t;
      return '<div class="qround ' + r.result + '" data-ri="' + i + '"><div class="qrh"><b>รอบที่ ' + r.no + '</b><span class="qrc ' + r.result + '">' + RES[r.result] + '</span>' + (lateR ? '<span class="qtag late">เกินกำหนดเสร็จ</span>' : '')
        + (isLast && !closed(x) ? '<button type="button" class="icon-btn" data-rdel="' + i + '" title="ลบรอบนี้" aria-label="ลบรอบที่ ' + r.no + '">' + icon('trash', 16) + '</button>' : '') + '</div>'
        + '<div class="pform">' + rf(i, 'startDate', 'วันที่เริ่มแก้ไข', r.startDate, 'date') + rf(i, 'dueDate', 'กำหนดเสร็จ', r.dueDate, 'date')
        + '<div class="pf"><label>ผู้รับผิดชอบ</label><input data-r="' + i + '" data-k="responsible" value="' + esc(r.responsible) + '" list="pplL"></div>'
        + '<div class="pf full"><label>วิธีการแก้ไข <b class="qreq">*</b></label><textarea rows="2" data-r="' + i + '" data-k="action" placeholder="ทำอะไร ที่ไหน กับ LOT ไหน">' + esc(r.action) + '</textarea></div>'
        + '<div class="pf full"><label>ผลการแก้ไข (ทวนสอบ)</label><div class="qseg qres">' + ['wait', 'ok', 'fail'].map(function (k) { return '<button type="button" class="' + k + (r.result === k ? ' on' : '') + '" data-rres="' + i + '" data-v="' + k + '" aria-pressed="' + (r.result === k) + '"><b>' + (k === 'ok' ? '✓ ' : k === 'fail' ? '✕ ' : '') + RES[k] + '</b></button>'; }).join('') + '</div></div>'
        + rf(i, 'verifyDate', 'วันที่ทวนสอบผล' + (r.result !== 'wait' ? ' *' : ''), r.verifyDate, 'date') + '<div class="pf"><label>ผู้ทวนสอบ</label><input data-r="' + i + '" data-k="verifier" value="' + esc(r.verifier) + '" list="pplL"></div>'
        + '<div class="pf full"><label>หมายเหตุผลการทวนสอบ</label><textarea rows="2" data-r="' + i + '" data-k="resultNote" placeholder="' + (r.result === 'fail' ? 'ทำไมยังแก้ไม่ได้ (ใช้วางแผนรอบถัดไป)' : 'สิ่งที่ตรวจพบหลังแก้ไข') + '">' + esc(r.resultNote) + '</textarea></div></div>'
        + '<datalist id="pplL">' + people.map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist></div>';
    }
    function rf(i, k, label, val, type) { return '<div class="pf"><label>' + label + '</label><input type="' + type + '" data-r="' + i + '" data-k="' + k + '" value="' + esc(val || '') + '"></div>'; }
    function photoBox(slot, label) {
      var files = (slot === 'fix' ? x.fixFiles : x.files) || [], pend = x.pending[slot];
      return '<div class="qphotos"><label>' + label + '</label><div class="qph">'
        + files.map(function (f) { return '<span class="sth"><a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + img(f.id) + '" alt="" loading="lazy"></a><button type="button" class="sth-x" data-fdel="' + slot + '|' + esc(f.id) + '" title="ลบรูป">' + icon('x', 14) + '</button></span>'; }).join('')
        + pend.map(function (p) { return '<span class="sth pend"><img src="' + p.dataUrl + '" alt=""><button type="button" class="sth-x" data-pdel="' + slot + '|' + p.tmp + '" title="เอาออก">' + icon('x', 14) + '</button></span>'; }).join('')
        + (H.data.hasFolder ? '<button type="button" class="sshot" data-shot="' + slot + '" data-src="cam">' + icon('camera', 22) + '<span>ถ่ายรูป</span></button><button type="button" class="sshot lib" data-shot="' + slot + '" data-src="lib">' + icon('image', 22) + '<span>เลือกรูป</span></button>'
          : '<span class="muted">ให้ผู้ดูแลระบบตั้งโฟลเดอร์ Drive ของฝ่ายก่อน จึงจะแนบรูปได้</span>') + '</div>'
        + (pend.length ? '<small class="muted">รูปใหม่ ' + pend.length + ' รูป จะอัปโหลดเมื่อกดบันทึก</small>' : '') + '</div>';
    }
    function collect() {   // อ่านค่าจากฟอร์มกลับเข้า x (เรียกก่อนวาดใหม่ทุกครั้ง ไม่ให้ข้อมูลที่พิมพ์หาย)
      if (!$('fRecv')) return;
      var map = { fRecv: 'recvDate', fTime: 'recvTime', fChannel: 'channel', fReceiver: 'receiver', fCust: 'custName', fCustPhone: 'custPhone', fCustType: 'custType', fCustPlace: 'custPlace',
        fProduct: 'product', fLot: 'lot', fMfg: 'mfgDate', fExp: 'expDate', fQty: 'qty', fBuy: 'buyFrom', fIssue: 'issueType', fSample: 'sample', fDetail: 'detail',
        fValid: 'valid', fCause: 'causeCat', fInv: 'investigation', fRoot: 'rootCause', fRemedy: 'remedy', fCost: 'remedyCost', fRemedyD: 'remedyDetail', fReply: 'replyDate',
        fPrev: 'preventive', fInform: 'informDate', fSatis: 'satisfaction', fClose: 'closeDate', fClosedBy: 'closedBy', fCloseNote: 'closeNote' };
      Object.keys(map).forEach(function (id) { if ($(id)) x[map[id]] = v(id); });
      Array.prototype.forEach.call($('main').querySelectorAll('[data-r][data-k]'), function (el) { var r = x.rounds[+el.getAttribute('data-r')]; if (r) r[el.getAttribute('data-k')] = el.value.trim(); });
    }
    function redraw() { collect(); var y = window.scrollY; draw(); window.scrollTo(0, y); }
    function bind() {
      $('main').addEventListener('input', function () { dirty = true; }, { once: true });
      $('cBack').addEventListener('click', leave);
      $('cCancel').addEventListener('click', leave);
      if ($('cPrint')) $('cPrint').addEventListener('click', function () { if (dirty) return toast('บันทึกก่อนพิมพ์'); H.q.repCase = x.id; H.q.repType = 'case'; go('q_rep'); });
      if ($('cDel')) $('cDel').addEventListener('click', function () {
        openModal({ color: '#dc2626', icon: 'warn', title: 'ลบเรื่อง ' + x.code + '?', body: '<p>ลบเรื่องร้องเรียนนี้และรูปที่แนบทั้งหมด ใช้เมื่อบันทึกผิดเท่านั้น (ข้อร้องเรียนจริงให้ปิดเรื่องแทน)</p>', ok: 'ลบ',
          submit: function () { return call('qaDelete', state.token, x.id).then(function (r) { if (!r.ok) return r.error; closeModal(); dirty = false; H.q.lst = H.q.lst || 'open'; reload('ลบแล้ว'); go('q_list'); }); } });
      });
      on('[data-sev]', 'click', function (el) { x.severity = el.getAttribute('data-sev'); dirty = true; redraw(); }, $('main'));
      on('[data-st]', 'click', function (el) { if (el.disabled) return; var st = el.getAttribute('data-st'); collect(); x.status = st || autoStatus(); dirty = true; redraw(); }, $('main'));
      on('[data-rres]', 'click', function (el) {
        collect(); var r = x.rounds[+el.getAttribute('data-rres')]; r.result = el.getAttribute('data-v');
        if (r.result !== 'wait' && !r.verifyDate) r.verifyDate = t;
        if (closed(x) && !(x.status === 'closed_ok' && r.result === 'ok') && !(x.status === 'closed_fail' && r.result === 'fail')) x.status = autoStatus();
        dirty = true; draw();
      }, $('main'));
      on('[data-rdel]', 'click', function (el) {
        if (!confirm('ลบรอบที่ ' + (+el.getAttribute('data-rdel') + 1) + '?')) return;
        collect(); x.rounds.splice(+el.getAttribute('data-rdel'), 1); if (closed(x)) x.status = autoStatus(); dirty = true; draw();
      }, $('main'));
      if ($('cAddR')) $('cAddR').addEventListener('click', function () {
        collect(); var n = x.rounds.length + 1;
        x.rounds.push({ no: n, startDate: t, dueDate: addDays(t, +S_().roundDays || 7), responsible: '', action: '', verifyDate: '', result: 'wait', resultNote: '', verifier: '' });
        if (!closed(x)) x.status = 'fixing';
        dirty = true; draw();
        var last = $('main').querySelectorAll('.qround'); last = last[last.length - 1]; if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); var ta = last.querySelector('textarea'); if (ta) ta.focus(); }
      });
      on('[data-shot]', 'click', function (el) {
        var slot = el.getAttribute('data-shot');
        pickPhotos(function (arr) { collect(); x.pending[slot] = x.pending[slot].concat(arr); dirty = true; draw(); }, el.getAttribute('data-src') === 'cam');
      }, $('main'));
      on('[data-pdel]', 'click', function (el) { var p = el.getAttribute('data-pdel').split('|'); collect(); x.pending[p[0]] = x.pending[p[0]].filter(function (q) { return q.tmp !== p[1]; }); draw(); }, $('main'));
      on('[data-fdel]', 'click', function (el) {
        var p = el.getAttribute('data-fdel').split('|'); if (!confirm('ลบรูปนี้?')) return;
        call('qaRemoveFile', state.token, x.id, p[0], p[1]).then(function (r) { if (!r.ok) return toast(r.error); collect(); if (p[0] === 'fix') x.fixFiles = r.files; else x.files = r.files; draw(); H.data = null; }).catch(onServerError);
      }, $('main'));
      $('cSave').addEventListener('click', save);
    }
    function autoStatus() { return x.rounds.length ? 'fixing' : (x.investigation || x.rootCause || x.causeCat) ? 'investigating' : 'open'; }
    function leave() {
      if (dirty && !confirm('ยังไม่ได้บันทึก — ออกโดยไม่บันทึก?')) return;
      H.cur = null; listPage(); window.scrollTo(0, 0);
    }
    function firstError() {
      if (!x.product) return ['fProduct', 'ระบุสินค้าที่ถูกร้องเรียน'];
      if (!x.issueType) return ['fIssue', 'เลือกประเภทปัญหา'];
      if (!x.detail) return ['fDetail', 'เขียนรายละเอียดปัญหา'];
      for (var i = 0; i < x.rounds.length; i++) { var r = x.rounds[i];
        if (!r.action) return [null, 'รอบที่ ' + (i + 1) + ': เขียนวิธีการแก้ไข', i];
        if (r.result !== 'wait' && !r.verifyDate) return [null, 'รอบที่ ' + (i + 1) + ': ใส่วันที่ทวนสอบผล', i]; }
      if (x.status === 'closed_fail' && !x.closeNote) return ['fCloseNote', 'ปิดเรื่องแบบแก้ไขไม่ได้ ต้องเขียนสรุปเหตุผล'];
      return null;
    }
    function save() {
      collect();
      if (!closed(x)) x.status = autoStatus();
      var err = firstError();
      if (err) {
        toast(err[1]);
        var el = err[0] ? $(err[0]) : $('main').querySelectorAll('.qround')[err[2]];
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('qerr'); if (el.focus) el.focus(); setTimeout(function () { el.classList.remove('qerr'); }, 2500); }
        return;
      }
      var b = $('cSave'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังบันทึก…';
      var payload = JSON.parse(JSON.stringify(x)); delete payload.pending; delete payload.files; delete payload.fixFiles;
      call('qaSave', state.token, payload).then(function (r) {
        if (!r.ok) { b.disabled = false; b.innerHTML = icon('check', 18) + ' บันทึก'; return toast(r.error); }
        var id = r.complaint.id, jobs = [];
        ['files', 'fix'].forEach(function (slot) { x.pending[slot].forEach(function (p) { jobs.push([slot, p]); }); });
        var i = 0, fails = 0;
        var next = function () {
          if (i >= jobs.length) return Promise.resolve();
          var j = jobs[i++]; toast('กำลังอัปโหลดรูป ' + i + '/' + jobs.length + '…');
          return call('qaUploadFile', state.token, id, j[0], j[1].name, 'image/jpeg', j[1].b64).then(function (u) { if (!u.ok) fails++; }, function () { fails++; }).then(next);
        };
        return next().then(function () {
          dirty = false;
          return H.load().then(function () {
            toast((isNew ? 'บันทึกรับเรื่อง ' + r.complaint.code + ' แล้ว' : 'บันทึกแล้ว') + (fails ? ' · อัปโหลดรูปไม่สำเร็จ ' + fails + ' รูป' : ''));
            caseForm(H.data.complaints.filter(function (c) { return c.id === id; })[0]);
          });
        });
      }).catch(function (e) { b.disabled = false; b.innerHTML = icon('check', 18) + ' บันทึก'; onServerError(e); });
    }
    draw();
  }

  // ==================== รายงาน / พิมพ์ ====================
  function report() {
    var t = H.data.today, q = H.q;
    q.repType = q.repType || 'sum'; q.repFrom = q.repFrom || t.slice(0, 8) + '01'; q.repTo = q.repTo || t;
    var cases = H.data.complaints;
    $('main').innerHTML = '<h3>รายงาน / พิมพ์</h3><p class="lead">เลือกรายงาน → แสดง → พิมพ์ หรือบันทึกเป็น PDF</p>'
      + '<div class="panel noprint"><div class="pform">' + S('rType', 'ประเภทรายงาน', [['sum', 'สรุปข้อร้องเรียนลูกค้า (ตามช่วงวันที่)'], ['case', 'แบบบันทึกข้อร้องเรียน + การแก้ไข (รายเรื่อง)']], q.repType)
      + S('rCase', 'เรื่องร้องเรียน', cases.map(function (c) { return [c.id, c.code + ' · ' + c.product + ' · ' + c.issueType]; }), q.repCase, false, '— เลือกเรื่อง —')
      + F('rFrom', 'ตั้งแต่วันที่รับเรื่อง', q.repFrom, 'date') + F('rTo', 'ถึงวันที่', q.repTo, 'date') + '</div>'
      + '<div class="actions"><button class="btn btn-primary" id="rGo">' + icon('chart', 18) + 'แสดงรายงาน</button><button class="btn btn-line" id="rPrint">' + icon('print', 18) + 'พิมพ์ / PDF</button></div></div><div id="rOut"></div>';
    var opts = function () { var c = v('rType') === 'case'; $('rCase').closest('.pf').style.display = c ? '' : 'none'; $('rFrom').closest('.pf').style.display = c ? 'none' : ''; $('rTo').closest('.pf').style.display = c ? 'none' : ''; };
    opts(); $('rType').addEventListener('change', function () { opts(); $('rOut').innerHTML = ''; });
    var run = function (print) {
      q.repType = v('rType'); q.repCase = v('rCase'); q.repFrom = v('rFrom'); q.repTo = v('rTo');
      if (q.repType === 'case') { var c = cases.filter(function (x) { return x.id === q.repCase; })[0]; if (!c) return toast('เลือกเรื่องร้องเรียน'); $('rOut').innerHTML = caseReport(c); }
      else { if (!q.repFrom || !q.repTo || q.repFrom > q.repTo) return toast('เลือกช่วงวันที่ให้ถูกต้อง'); $('rOut').innerHTML = sumReport(q.repFrom, q.repTo); }
      if (print) setTimeout(function () { window.print(); }, 300);
    };
    $('rGo').addEventListener('click', function () { run(false); });
    $('rPrint').addEventListener('click', function () { run(true); });
    if (q.repType === 'case' && q.repCase) run(false);
  }
  function repHead(title, info) {
    var logo = document.querySelector('.brand-logo'), s = S_();
    return '<div class="rhead">' + (logo ? '<img class="rlogo" src="' + logo.src + '" alt="">' : '') + '<div class="rco"><b>' + COMPANY + '</b><span>ฝ่ายประกันคุณภาพ (QA)</span></div>'
      + (s.formCode ? '<div class="rform">' + esc(s.formCode).replace(' วันที่', '<br>วันที่') + '</div>' : '') + '</div><h4 class="rtitle">' + title + '</h4><div class="rinfo">' + info + '</div>';
  }
  function signs() { var s = S_(); return '<div class="qsign">' + [s.signRecv, s.signQa, s.signApprove].map(function (n) { return '<div><span></span>' + esc(n) + '<br>วันที่ ........../........../..........</div>'; }).join('') + '</div>'; }
  function caseReport(c) {
    var row = function (a, b) { return '<tr><th>' + a + '</th><td>' + (b || '-') + '</td></tr>'; };
    var age = days(c.recvDate, closed(c) ? c.closeDate : H.data.today);
    return '<div class="preport">' + repHead('บันทึกข้อร้องเรียนลูกค้าและการแก้ไข', '<span>เลขที่ <b>' + esc(c.code) + '</b></span><span>สถานะ <b>' + (ST[c.status] || '') + '</b></span><span>' + (closed(c) ? 'ใช้เวลา' : 'เปิดมาแล้ว') + ' <b>' + age + ' วัน</b></span>')
      + '<h5>1. รับเรื่อง</h5><table class="qrt">' + row('วันที่รับเรื่อง', dd(c.recvDate) + (c.recvTime ? ' ' + esc(c.recvTime) + ' น.' : '') + ' · ช่องทาง ' + esc(c.channel || '-') + ' · ผู้รับเรื่อง ' + esc(c.receiver || '-'))
      + row('ลูกค้า', esc([c.custName, c.custPhone, c.custType, c.custPlace].filter(String).join(' · ')))
      + row('สินค้า', esc(c.product) + (c.lot ? ' · LOT ' + esc(c.lot) : '') + (c.mfgDate ? ' · ผลิต ' + dd(c.mfgDate) : '') + (c.expDate ? ' · หมดอายุ ' + dd(c.expDate) : '') + (c.qty ? ' · จำนวน ' + esc(c.qty) : '') + (c.buyFrom ? ' · ซื้อจาก ' + esc(c.buyFrom) : ''))
      + row('ปัญหา', '<b>' + esc(c.issueType) + '</b> · ความรุนแรง' + (SEV[c.severity] || '') + '<br>' + esc(c.detail).replace(/\n/g, '<br>')) + row('ตัวอย่างสินค้า', esc(c.sample)) + '</table>'
      + (c.files.length ? '<div class="qrimgs">' + c.files.slice(0, 6).map(function (f) { return '<img src="' + img(f.id, 500) + '" alt="">'; }).join('') + '</div>' : '')
      + '<h5>2. ตรวจสอบสาเหตุ & ชดเชยลูกค้า</h5><table class="qrt">' + row('ผลพิสูจน์', esc(c.valid)) + row('ผลการตรวจสอบ', esc(c.investigation).replace(/\n/g, '<br>'))
      + row('หมวดสาเหตุ', esc(c.causeCat)) + row('สาเหตุที่แท้จริง', esc(c.rootCause).replace(/\n/g, '<br>'))
      + row('การชดเชย', esc([c.remedy, c.remedyDetail].filter(String).join(' · ')) + (c.remedyCost !== '' && c.remedyCost != null ? ' · มูลค่า ' + Number(c.remedyCost).toLocaleString('th-TH') + ' บาท' : ''))
      + row('ตอบลูกค้าครั้งแรก', c.replyDate ? dd(c.replyDate) + ' (' + days(c.recvDate, c.replyDate) + ' วันหลังรับเรื่อง)' : '-') + '</table>'
      + '<h5>3. การแก้ไข</h5><table class="rt qrr"><thead><tr><th>รอบ</th><th>วิธีการแก้ไข</th><th>ผู้รับผิดชอบ</th><th>เริ่ม / กำหนดเสร็จ</th><th>ทวนสอบ</th><th>ผล</th><th>ใช้เวลา</th></tr></thead><tbody>'
      + (c.rounds.map(function (r) { var dur = days(r.startDate, r.verifyDate); return '<tr><td class="c">' + r.no + '</td><td>' + esc(r.action).replace(/\n/g, '<br>') + (r.resultNote ? '<br><small>ผลทวนสอบ: ' + esc(r.resultNote) + '</small>' : '') + '</td><td>' + esc(r.responsible) + '</td><td class="nw">' + dd(r.startDate) + '<br>' + dd(r.dueDate) + '</td><td class="nw">' + dd(r.verifyDate) + (r.verifier ? '<br>' + esc(r.verifier) : '') + '</td><td class="nw"><b class="' + (r.result === 'ok' ? 'pos' : r.result === 'fail' ? 'neg' : '') + '">' + RES[r.result] + '</b></td><td class="r nw">' + (dur == null ? '-' : dur + ' วัน') + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="c muted">ยังไม่มีการแก้ไข</td></tr>')
      + '</tbody></table><table class="qrt" style="margin-top:6px">' + row('การป้องกันไม่ให้เกิดซ้ำ', esc(c.preventive).replace(/\n/g, '<br>')) + '</table>'
      + '<h5>4. แจ้งผลลูกค้า & ปิดเรื่อง</h5><table class="qrt">' + row('แจ้งผลลูกค้า', dd(c.informDate) + (c.satisfaction ? ' · ' + esc(c.satisfaction) : ''))
      + row('ปิดเรื่อง', closed(c) ? (ST[c.status] + ' · ' + dd(c.closeDate) + (c.closedBy ? ' · โดย ' + esc(c.closedBy) : '')) : 'ยังไม่ปิด') + row('สรุป', esc(c.closeNote).replace(/\n/g, '<br>')) + '</table>'
      + signs() + '</div>';
  }
  function sumReport(from, to) {
    var rows = H.data.complaints.filter(function (c) { return c.recvDate >= from && c.recvDate <= to; }).sort(function (a, b) { return String(a.recvDate + a.code).localeCompare(String(b.recvDate + b.code)); });
    var cl = rows.filter(closed), ok = cl.filter(function (c) { return c.status === 'closed_ok'; });
    return '<div class="preport">' + repHead('สรุปข้อร้องเรียนลูกค้า', '<span>วันที่รับเรื่อง <b>' + dd(from) + ' – ' + dd(to) + '</b></span>')
      + '<div class="rbox">' + [['ทั้งหมด', rows.length + ' เรื่อง'], ['ปิดแล้ว', cl.length + ' เรื่อง'], ['แก้ไขได้', ok.length + ' เรื่อง'], ['ยังไม่ปิด', (rows.length - cl.length) + ' เรื่อง']].map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<table class="rt qsum"><thead><tr><th>#</th><th>เลขที่ / วันที่</th><th>สินค้า / LOT</th><th>ปัญหา</th><th>สาเหตุ</th><th>การแก้ไข</th><th>สถานะ</th><th class="r">วัน</th></tr></thead><tbody>'
      + (rows.map(function (c, i) {
        return '<tr><td class="c">' + (i + 1) + '</td><td class="nw">' + esc(c.code) + '<br>' + dd(c.recvDate) + '</td><td>' + esc(c.product) + (c.lot ? '<br><small>LOT ' + esc(c.lot) + '</small>' : '') + '</td><td>' + esc(c.issueType) + '<br><small>' + (SEV[c.severity] || '') + '</small></td>'
          + '<td>' + esc(c.causeCat || '-') + (c.rootCause ? '<br><small>' + esc(c.rootCause).slice(0, 80) + '</small>' : '') + '</td><td>' + (c.rounds.map(function (r) { return 'รอบ ' + r.no + ': ' + RES[r.result]; }).join('<br>') || '-') + '</td>'
          + '<td class="nw">' + (ST[c.status] || '') + '</td><td class="r">' + days(c.recvDate, closed(c) ? c.closeDate : H.data.today) + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="c muted">ไม่มีข้อร้องเรียนในช่วงนี้</td></tr>') + '</tbody></table>' + signs() + '</div>';
  }

  // ==================== ตั้งค่า ====================
  function settings() {
    var s = S_();
    var ta = function (k, label, hint) { return T('s_' + k, label, s[k], hint, false, 2); };
    $('main').innerHTML = '<h3>ตั้งค่า</h3><p class="lead">รายการตัวเลือกในแบบบันทึก (คั่นด้วย , หรือขึ้นบรรทัดใหม่) · เป้าหมายระยะเวลา · หัวแบบฟอร์ม</p>'
      + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' เป้าหมายระยะเวลา</h4><div class="pform">'
      + F('s_replyDays', 'ตอบลูกค้าครั้งแรกภายใน (วัน)', s.replyDays, 'number', ' min="0" max="30"') + F('s_closeDays', 'ปิดเรื่องภายใน (วัน)', s.closeDays, 'number', ' min="1" max="365"')
      + F('s_roundDays', 'กำหนดเสร็จแต่ละรอบ (วัน นับจากวันเริ่ม)', s.roundDays, 'number', ' min="1" max="90"') + '</div></div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('list', 18) + ' ตัวเลือก</h4><div class="pform">'
      + ta('products', 'รายชื่อสินค้า', 'เช่น น้ำพริกปลาแซลมอน 35 กรัม, …') + ta('people', 'รายชื่อผู้รับเรื่อง / ผู้รับผิดชอบ', 'ชื่อพนักงาน')
      + ta('channels', 'ช่องทางรับเรื่อง') + ta('custTypes', 'ประเภทลูกค้า') + ta('issueTypes', 'ประเภทปัญหา') + ta('causeCats', 'หมวดสาเหตุ') + ta('remedies', 'วิธีชดเชยลูกค้า') + '</div></div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('print', 18) + ' หัวแบบฟอร์ม / ช่องลงนาม</h4><div class="pform">'
      + F('s_formCode', 'รหัสแบบฟอร์ม (มุมขวาบนของรายงาน)', s.formCode, 'text', ' placeholder="เช่น FM-QA-01-01 Rev.00 วันที่ประกาศใช้ 01/10/2024"')
      + F('s_signRecv', 'ช่องลงนาม 1', s.signRecv) + F('s_signQa', 'ช่องลงนาม 2', s.signQa) + F('s_signApprove', 'ช่องลงนาม 3', s.signApprove) + '</div></div>'
      + '<div class="qsave"><button class="btn btn-primary" id="sSave">' + icon('check', 18) + ' บันทึกการตั้งค่า</button></div>';
    $('sSave').addEventListener('click', function () {
      var o = {}, b = this; Object.keys(s).forEach(function (k) { if ($('s_' + k)) o[k] = $('s_' + k).value.trim(); });
      b.disabled = true;
      call('qaSaveSettings', state.token, o).then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); H.data.settings = r.settings; toast('บันทึกการตั้งค่าแล้ว'); }).catch(function (e) { b.disabled = false; onServerError(e); });
    });
  }
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><p class="lead">บันทึกทุกครั้งที่เพิ่ม/แก้/ลบข้อมูล</p><div id="lOut" class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
    call('qaLog', state.token, 300).then(function (r) {
      $('lOut').outerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>รายละเอียด</th></tr></thead><tbody>'
        + (r.rows.map(function (x) { return '<tr><td class="nw">' + esc(x.time) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.detail) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีประวัติ</td></tr>') + '</tbody></table></div>';
    }).catch(onServerError);
  }

  // ---------- CSS ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    '.qtop{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.qbig{flex:none;font-size:16px;padding:13px 20px}.qtop .btn-line b{background:#f1f5f9;border-radius:99px;padding:0 8px;margin-left:4px}',
    '.qreq{color:#dc2626}.qsub{margin:14px 0 6px;font-size:14px;color:#475569}',
    '.qtag{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:99px;white-space:nowrap}.qtag.qopen{background:#e0e7ff;color:#3730a3}.qtag.qinvestigating{background:#fef3c7;color:#92400e}.qtag.qfixing{background:#ffedd5;color:#9a3412}',
    '.qtag.qclosed_ok{background:#dcfce7;color:#166534}.qtag.qclosed_fail{background:#f1f5f9;color:#334155;border:1px solid #cbd5e1}.qtag.late{background:#b91c1c;color:#fff}',
    '.qsev{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:99px;border:1px solid}.qsev.sL{color:#166534;border-color:#86efac}.qsev.sM{color:#92400e;border-color:#fcd34d}.qsev.sH{color:#b91c1c;border-color:#fca5a5}.qsev.sC{color:#fff;background:#991b1b;border-color:#991b1b}',
    '.qlatechip{border-color:#fca5a5;color:#b91c1c}.qlist{display:flex;flex-direction:column;gap:10px}',
    '.qcard{display:flex;flex-direction:column;gap:5px;text-align:left;width:100%;background:#fff;border:1px solid var(--line);border-left:6px solid #fcd34d;border-radius:12px;padding:12px 14px;box-shadow:var(--shadow);color:inherit}.qcard:hover{border-color:var(--c)}',
    '.qcard.sL{border-left-color:#86efac}.qcard.sH{border-left-color:#f87171}.qcard.sC{border-left-color:#991b1b}.qc1{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.qc1 span{color:var(--muted);font-size:13px}',
    '.qc2{font-size:15px}.qc2 small{color:var(--muted)}.qc3{font-size:13.5px;color:#475569}.qc4{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.qrc{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:8px;background:#f1f5f9;color:#475569}.qrc.ok{background:#dcfce7;color:#166534}.qrc.fail{background:#fee2e2;color:#b91c1c}.qrc.wait{background:#fef3c7;color:#92400e}',
    '.qage{margin-left:auto;font-size:12.5px;color:var(--muted)}.qage.late{color:#b91c1c;font-weight:700}',
    '.qhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.qht{flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:200px}.qht h3{margin:0}',
    '.qsteps{display:flex;gap:6px;list-style:none;padding:0;margin:0 0 12px;flex-wrap:wrap}.qsteps li{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid var(--line);border-radius:99px;padding:5px 12px 5px 5px;font-size:13.5px;color:var(--muted)}',
    '.qsteps i{font-style:normal;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#f1f5f9;font-weight:700;font-size:12.5px}.qsteps li.on{border-color:var(--c);color:var(--ink);font-weight:600}.qsteps li.on i{background:var(--c);color:#fff}.qsteps li.done i{background:#16a34a;color:#fff}',
    '.qtimes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:12px}.qtimes div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 12px}.qtimes span{display:block;font-size:12px;color:var(--muted)}.qtimes b{font-size:18px}.qtimes small{display:block;font-size:11.5px;color:var(--muted)}',
    '.qsec{margin-bottom:14px}.qsec h4{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}.qsec h4 i{font-style:normal;width:26px;height:26px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;font-size:13px}.qsec h4 small{font-weight:400;color:var(--muted);font-size:12.5px;width:100%;padding-left:34px;margin-top:-4px}',
    '.qseg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.qseg button{border:2px solid var(--line);background:#fff;border-radius:12px;padding:10px 8px;text-align:left;display:flex;flex-direction:column;gap:2px;min-height:48px}.qseg button small{font-size:11.5px;color:var(--muted);line-height:1.35}',
    '.qseg .sL.on{border-color:#16a34a;background:#f0fdf4}.qseg .sM.on{border-color:#d97706;background:#fffbeb}.qseg .sH.on{border-color:#dc2626;background:#fef2f2}.qseg .sC.on{border-color:#991b1b;background:#991b1b;color:#fff}.qseg .sC.on small{color:#fecaca}',
    '.qseg.qres,.qseg.qst{grid-template-columns:repeat(3,1fr)}.qres .wait.on{border-color:#d97706;background:#fffbeb}.qres .ok.on{border-color:#16a34a;background:#16a34a;color:#fff}.qres .fail.on{border-color:#dc2626;background:#dc2626;color:#fff}',
    '.qst .none.on{border-color:#64748b;background:#f8fafc}.qst .closed_ok.on{border-color:#16a34a;background:#16a34a;color:#fff}.qst .closed_ok.on small,.qst .closed_fail.on small{color:#e2e8f0}.qst .closed_fail.on{border-color:#334155;background:#334155;color:#fff}.qseg button:disabled{opacity:.45;cursor:not-allowed}',
    '.qround{border:2px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px;background:#fff}.qround.ok{border-color:#86efac}.qround.fail{border-color:#fca5a5;background:#fffafa}.qround.wait{border-color:#fcd34d}',
    '.qrh{display:flex;align-items:center;gap:8px;margin-bottom:8px}.qrh b{font-size:16px}.qrh .icon-btn{margin-left:auto}',
    '.qaddr{width:100%;border-style:dashed;border-width:2px;padding:14px;font-size:15px}.qhint{margin:6px 0 0}',
    '.qphotos{margin-top:10px}.qphotos>label{font-size:13px;color:var(--muted);display:block;margin-bottom:6px}.qph{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.sth.pend img{outline:3px dashed #d97706;outline-offset:-3px}',
    '.qsave{position:sticky;bottom:0;display:flex;gap:10px;padding:12px 0;background:linear-gradient(transparent,rgba(244,246,250,.96) 30%);z-index:5}.qsave .btn-primary{flex:1;font-size:17px;padding:15px}.qsave .btn-line{flex:none}',
    '.qnext{display:flex;gap:8px;align-items:center;background:#f5f3ff;border:1px dashed #c4b5fd;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:14px;color:#4c1d95}',
    '.qdel{text-align:right;margin-top:6px}.qerr{outline:3px solid #dc2626!important;outline-offset:2px;border-radius:10px}',
    '.qtrend{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;align-items:end}.qtm{text-align:center;font-size:11.5px}.qtm b{display:block;font-size:13px}.qtm span{color:var(--muted)}.qtb{height:100px;display:flex;align-items:flex-end;justify-content:center;gap:3px;border-bottom:1px solid var(--line)}',
    '.qtb em{width:12px;border-radius:3px 3px 0 0;min-height:1px}.qtb .b1{background:#7c3aed}.qtb .b2{background:#16a34a}.qtb .b3{background:#dc2626}.slegend .b1{background:#7c3aed}',
    '.qrt{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px}.qrt th{width:150px;text-align:left;background:#f8fafc;border:1px solid #cbd5e1;padding:5px 8px;vertical-align:top;font-weight:600}.qrt td{border:1px solid #cbd5e1;padding:5px 8px;vertical-align:top}',
    '.qrr td small{color:#475569}.qrimgs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.qrimgs img{height:90px;border-radius:4px;border:1px solid #cbd5e1}.qsum td small{color:#64748b}',
    '.qsign{display:flex;justify-content:space-around;gap:16px;margin-top:26px;text-align:center;font-size:12.5px;line-height:2;break-inside:avoid}.qsign span{display:block;width:180px;border-bottom:1px dotted #475569;height:28px;margin:0 auto}',
    '@media (max-width:700px){.qseg{grid-template-columns:1fr 1fr}.qseg.qres,.qseg.qst{grid-template-columns:1fr}.qrt th{width:100px}.qage{margin-left:0}}',
    '@media print{.qsign{font-size:9pt}.qrt,.qrr{font-size:8.5pt}.qrimgs img{height:60px}}'
  ].join('\n');
  document.head.appendChild(css);
})();
