// ==================== ฝ่ายความปลอดภัยและสิ่งแวดล้อม (SHE) ====================
// หน้าเว็บของโมดูล "safety" — index.html เรียก SHE.menus() / SHE.render(page)
// ข้อมูลอยู่ใน Google Sheet ของฝ่าย ผ่าน API She.gs (sheLoad, sheSaveCheck, ...) · รูปถ่ายเก็บในโฟลเดอร์ Drive ของฝ่าย
// ออกแบบให้ใช้บน iPad: เดินตรวจตามพื้นที่ กดผ่าน/ไม่ผ่าน ถ่ายรูปข้อที่ไม่ผ่าน → ระบบสร้างรายการข้อบกพร่อง (FM-SHE-01-05) ให้เอง
(function () {
  var H = window.SHE = { data: null, loading: null, q: {} };

  Object.assign(ICONS, {
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>'
  });

  var MENUS = [
    { id: 's_dash', label: 'ภาพรวม / Dashboard', ic: 'home' },
    { id: 's_check', label: 'ตรวจเช็คประจำวันแต่ละอาคาร', ic: 'shield' },
    { id: 's_find', label: 'ข้อบกพร่อง / ติดตามแก้ไข', ic: 'warn' },
    { id: 's_inc', label: 'อุบัติเหตุ / เกือบเกิดเหตุ', ic: 'alert' },
    { id: 's_rep', label: 'รายงาน / พิมพ์ PDF', ic: 'print' },
    { id: 's_set', label: 'ตั้งค่าแบบตรวจ', ic: 'gear' },
    { id: 's_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var ST = { open: 'พบปัญหา', progress: 'กำลังแก้ไข', done: 'แก้ไขเรียบร้อย' };
  var RISK = { L: 'ต่ำ', M: 'ปานกลาง', H: 'สูง' };
  var INC = { lti: 'อุบัติเหตุถึงขั้นหยุดงาน', acc: 'อุบัติเหตุไม่ถึงขั้นหยุดงาน', first: 'ปฐมพยาบาล', near: 'เหตุการณ์เกือบเกิด (Near miss)',
    prop: 'ทรัพย์สินเสียหาย', fire: 'ไฟไหม้ / เพลิงไหม้', env: 'สิ่งแวดล้อม (รั่วไหล / มลพิษ)' };
  var ACC = { lti: 1, acc: 1, first: 1 };
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var COMPANY_TH = 'บริษัท สปังกี้ ฟู้ด จำกัด', COMPANY_EN = 'Spunky Food Co., Ltd.';

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sdd(iso) { if (!iso) return ''; var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : esc(iso); }
  function thDate(iso) { if (!iso) return '-'; var p = String(iso).split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + (+p[0] + 543 - 2500); }
  function days(a, b) { var p = a.split('-'), q = b.split('-'); return Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5); }
  function ymLabel(ym) { return MONTHS[+ym.slice(5, 7) - 1] + ' ' + (+ym.slice(0, 4) + 543); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('she_' + k) || ''; if (v === null) localStorage.removeItem('she_' + k); else localStorage.setItem('she_' + k, v); } catch (e) { return ''; } }
  function F(id, label, value, type, attrs) { return '<div class="pf"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + '></div>'; }
  function S(id, label, options, value, attrs) {
    return '<div class="pf"><label for="' + id + '">' + label + '</label><select id="' + id + '"' + (attrs || '') + '>' + options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select></div>';
  }
  function T(id, label, value, ph) { return '<div class="pf full"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="2" placeholder="' + esc(ph || '') + '">' + esc(value || '') + '</textarea></div>'; }
  function v(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function wide(cfg) { cfg.wide = true; cfg.color = cfg.color || state.dept.color; openModal(cfg); }
  function list(s) { return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
  function area(id) { return (H.data.areas.filter(function (a) { return a.id === id; })[0]) || null; }
  function activeAreas() { return H.data.areas.filter(function (a) { return a.active !== 'ปิด'; }); }
  function img(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 600); }
  function riskTag(r) { return '<span class="stag r' + (r || 'M') + '">' + (RISK[r] || 'ปานกลาง') + '</span>'; }
  function stTag(f) {
    var late = f.status !== 'done' && f.dueDate && f.dueDate < todayIso();
    return '<span class="stag s' + f.status + (late ? ' late' : '') + '">' + (late ? 'เกินกำหนด' : ST[f.status] || f.status) + '</span>';
  }
  function datalist(id, arr) { return '<datalist id="' + id + '">' + arr.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'; }

  // ---------- รูปถ่าย: กล้อง iPad → ย่อ (ด้านยาว 1600px) → base64 ----------
  // cam = true → เปิดกล้องถ่ายเลย · false → เลือกรูปที่มีในเครื่อง (คลังรูป / ไฟล์) ได้หลายรูป
  function pickPhotos(cb, cam) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (cam) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []);
      document.body.removeChild(inp);
      Promise.all(files.map(shrink)).then(function (arr) { cb(arr.filter(Boolean)); });
    });
    inp.click();
  }
  function shrink(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var data = c.toDataURL('image/jpeg', 0.8);
        res({ dataUrl: data, b64: data.split(',')[1], name: (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg' });
      };
      im.onerror = function () { URL.revokeObjectURL(url); res(null); };
      im.src = url;
    });
  }
  // ปุ่ม 2 ปุ่ม: ถ่ายรูป / เลือกจากเครื่อง (attr = ชื่อ data-* ของจุดนั้น, val = ค่า)
  function shotBtns(attr, val, label) {
    return '<button type="button" class="sshot" data-' + attr + '="' + esc(val) + '" data-src="cam">' + icon('camera', 22) + '<span>ถ่ายรูป' + (label ? '<br>' + label : '') + '</span></button>'
      + '<button type="button" class="sshot lib" data-' + attr + '="' + esc(val) + '" data-src="lib">' + icon('image', 22) + '<span>เลือกรูป<br>จากเครื่อง</span></button>';
  }
  function uploadPhoto(type, id, slot, p) {
    return call('sheUploadFile', state.token, type, id, slot, p.name, 'image/jpeg', p.b64).then(function (r) { if (!r.ok) throw new Error(r.error); return r; });
  }
  function uploadAll(jobs, label) {   // jobs = [[type, id, slot, photo]] — ทีละรูป (สัญญาณมือถือ/iPad ไม่ค่อยแรง)
    var i = 0, fails = 0;
    function next() {
      if (i >= jobs.length) return Promise.resolve(fails);
      var j = jobs[i++];
      toast((label || 'กำลังอัปโหลดรูป') + ' ' + i + '/' + jobs.length + '…');
      return uploadPhoto(j[0], j[1], j[2], j[3]).catch(function () { fails++; }).then(next);
    }
    return next();
  }
  function thumbs(files, del) {
    return (files || []).map(function (f) {
      var src = f.dataUrl || img(f.id, 400), href = f.url || f.dataUrl;
      return '<span class="sth"><a href="' + esc(href) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="" loading="lazy"></a>'
        + (del ? '<button type="button" class="sth-x" data-del="' + esc(del) + '" data-fid="' + esc(f.id || f.tmp) + '" title="ลบรูป">' + icon('x', 14) + '</button>' : '') + '</span>';
    }).join('');
  }

  // ---------- โหลดข้อมูล ----------
  H.load = function () {
    if (H.loading) return H.loading;
    H.loading = call('sheLoad', state.token).then(function (d) { H.data = d; H.loading = null; return d; }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  function reload(msg) {
    if (msg) toast(msg);
    return H.load().then(function () { if (String(state.page).indexOf('s_') === 0) H.render(state.page); }).catch(onServerError);
  }
  H.reset = function () { H.data = null; H.q = {}; H.walk = null; landscape(false); };
  H.menus = function () { return MENUS; };
  H.render = function (page) {
    landscape(page === 's_rep');
    if (!H.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">กำลังโหลดข้อมูลจาก Google Sheet…</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      H.load().then(function () { if (state.page === page) H.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">เปิดข้อมูลไม่ได้</p><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet และโฟลเดอร์รูปของฝ่าย แล้วแชร์ให้บัญชีของระบบเป็นผู้แก้ไข</span></div></div>';
      });
      return;
    }
    ({ s_dash: dash, s_check: walk, s_find: findings, s_inc: incidents, s_rep: report, s_set: settings, s_log: logPage }[page] || dash)();
  };
  function landscape(onOff) {
    var el = document.getElementById('sheLandscape');
    if (onOff && !el) { el = document.createElement('style'); el.id = 'sheLandscape'; el.textContent = '@page{size:A4 landscape;margin:8mm 8mm 11mm 8mm}'; document.head.appendChild(el); }
    if (!onOff && el) el.parentNode.removeChild(el);
  }

  // ==================== ภาพรวม / Dashboard ====================
  function dash() {
    var t = H.data.today, q = H.q;
    if (!q.from) { q.from = t.slice(0, 8) + '01'; q.to = t; }
    var quick = [['เดือนนี้', t.slice(0, 8) + '01', t], ['เดือนก่อน', addDays(t.slice(0, 8) + '01', -1).slice(0, 8) + '01', addDays(t.slice(0, 8) + '01', -1)],
      ['3 เดือน', addDays(t, -89), t], ['ปีนี้', t.slice(0, 4) + '-01-01', t]];
    var todayBox = activeAreas().map(function (a) {
      var done = H.data.checks.filter(function (c) { return c.date === t && c.areaId === a.id; }).map(function (c) { return Number(c.round); });
      var dots = ''; for (var r = 1; r <= a.rounds; r++) dots += '<i class="' + (done.indexOf(r) >= 0 ? 'ok' : '') + '">' + r + '</i>';
      return '<button class="stoday" data-walk="' + a.id + '"><b>' + esc(a.name) + '</b><span class="srounds">' + dots + '</span></button>';
    }).join('');
    $('main').innerHTML = '<h3>ภาพรวม ความปลอดภัยและสิ่งแวดล้อม</h3><p class="lead">ข้อมูล ณ ' + dd(t) + ' · <a href="' + esc(H.data.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + (H.data.hasFolder ? '' : '<div class="panel status off" style="margin-bottom:12px"><div class="dot">' + icon('warn', 20) + '</div><div><b>ยังไม่ได้ตั้งโฟลเดอร์เก็บรูป</b><span>ให้ผู้ดูแลระบบใส่ลิงก์โฟลเดอร์ Google Drive ของฝ่าย จึงจะแนบรูปได้</span></div></div>')
      + '<div class="panel pbox"><h4>' + icon('shield', 18) + ' ตรวจวันนี้ <small class="muted">แตะพื้นที่เพื่อเริ่มตรวจ · วงเขียว = ตรวจรอบนั้นแล้ว</small></h4><div class="stodays">' + todayBox + '</div></div>'
      + '<div class="pbar noprint"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<input type="date" id="dFrom" value="' + q.from + '"> – <input type="date" id="dTo" value="' + q.to + '">'
      + '<button class="btn btn-sm btn-line" id="dPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div id="dOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>';
    on('[data-walk]', 'click', function (el) { H.walk = { areaId: el.getAttribute('data-walk') }; go('s_check'); }, $('main'));
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['dFrom', 'dTo'].forEach(function (id) { $(id).addEventListener('change', function () { if (v('dFrom') && v('dTo') && v('dFrom') <= v('dTo')) { q.from = v('dFrom'); q.to = v('dTo'); dash(); } }); });
    $('dPrint').addEventListener('click', function () { window.print(); });
    var my = H.dseq = (H.dseq || 0) + 1;
    call('sheDashboard', state.token, q.from, q.to).then(function (r) {
      if (my !== H.dseq || state.page !== 's_dash') return;
      if (!r.ok) { $('dOut').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
      $('dOut').innerHTML = H.dashHtml(r);
      on('[data-fd]', 'click', function (el) { var f = H.data.findings.filter(function (x) { return x.id === el.getAttribute('data-fd'); })[0]; if (f) findingModal(f); }, $('dOut'));
    }).catch(onServerError);
  }
  // ใช้ร่วมกับหน้า Dashboard ผู้บริหาร (executive.js)
  H.dashHtml = function (r) {
    var i = r.inspect, f = r.findings, x = r.incidents;
    var pc = function (n) { return n == null ? '–' : n + '%'; };
    var tile = function (val, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + val + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var box = function (title, rows, empty) { return '<div class="panel pbox"><h4>' + title + '</h4>' + (rows.length ? rows.join('') : '<div class="muted">' + empty + '</div>') + '</div>'; };
    var bar = function (label, n, max, color, right) { return '<div class="sbar"><span>' + esc(label) + '</span><i><em style="width:' + Math.max(2, Math.round(n / Math.max(1, max) * 100)) + '%;background:' + (color || 'var(--c)') + '"></em></i><b>' + (right != null ? right : n) + '</b></div>'; };
    var html = '<div class="kpis">'
      + tile(pc(i.completion), 'ตรวจตามแผน', i.completion == null ? '#64748b' : i.completion >= 90 ? '#16a34a' : i.completion >= 70 ? '#d97706' : '#dc2626', i.done + ' / ' + i.planned + ' รอบ')
      + tile(pc(i.pass), 'ผลตรวจผ่าน', i.pass == null ? '#64748b' : i.pass >= 95 ? '#16a34a' : '#d97706', 'ผ่าน ' + i.P + ' · ไม่ผ่าน ' + i.O + ' ข้อ')
      + tile(f.open, 'ข้อบกพร่องค้างแก้ไข', f.open ? '#d97706' : '#16a34a', 'เกินกำหนด ' + f.overdue + ' · เสี่ยงสูง ' + f.highOpen)
      + tile(f.total ? Math.round(f.done / f.total * 100) + '%' : '–', 'แก้ไขเสร็จ (ช่วงนี้)', '#2563eb', f.done + ' / ' + f.total + (f.avgCloseDays != null ? ' · เฉลี่ย ' + f.avgCloseDays + ' วัน' : ''))
      + tile(x.safeDays == null ? '–' : x.safeDays, 'วันปลอดอุบัติเหตุ', x.accidents ? '#dc2626' : '#16a34a', x.lastAccident ? 'ครั้งล่าสุด ' + dd(x.lastAccident) : 'ยังไม่มีบันทึกอุบัติเหตุ')
      + '</div>';
    html += '<div class="panel pbox sins"><h4>' + icon('chart', 18) + ' ข้อสังเกต</h4>' + r.insights.map(function (s) { return '<div class="sin ' + s.level + '">' + esc(s.text) + '</div>'; }).join('') + '</div>';
    var maxA = Math.max.apply(null, i.byArea.map(function (a) { return a.planned; }).concat([1]));
    var maxT = Math.max.apply(null, r.trend.map(function (m) { return Math.max(m.findings, m.incidents + m.near); }).concat([1]));
    html += '<div class="pgrid">'
      + box(icon('shield', 18) + ' การตรวจแยกพื้นที่', i.byArea.map(function (a) {
        return '<div class="sarea-row"><b>' + esc(a.name) + '</b>' + bar('ตรวจ', a.done, maxA, '#2563eb', a.done + '/' + a.planned) + '<small>ผ่าน ' + pc(a.pass) + ' · ไม่ผ่าน ' + a.O + ' ข้อ</small></div>';
      }), 'ยังไม่มีพื้นที่ตรวจ')
      + box(icon('warn', 18) + ' หัวข้อที่ไม่ผ่านบ่อย', i.topItems.map(function (t) { return bar(t.area + ' · ' + t.category, t.n, i.topItems[0].n, '#dc2626'); }), 'ไม่มีข้อที่ไม่ผ่านในช่วงนี้ 👍')
      + box(icon('warn', 18) + ' ข้อบกพร่องเกินกำหนดแก้ไข', f.overdueList.map(function (o) {
        return '<div class="li click" data-fd="' + esc(o.id) + '"><span>' + esc(o.code) + ' · ' + esc(o.location) + ' · ' + esc(o.problem) + '</span><b class="neg">' + dd(o.dueDate) + '</b><small>ผู้รับผิดชอบ ' + esc(o.responsible || '-') + ' · ความเสี่ยง' + (RISK[o.risk] || '') + '</small></div>';
      }), 'ไม่มีรายการเกินกำหนด')
      + box(icon('chart', 18) + ' ข้อบกพร่องแยกพื้นที่ / ความเสี่ยง', f.byArea.map(function (a) { return bar(a.name, a.n, f.byArea[0].n, '#d97706'); })
        .concat(f.byRisk.length ? ['<div class="srisk">' + f.byRisk.map(function (rk) { return '<span>' + esc(rk.name) + ' <b>' + rk.n + '</b></span>'; }).join('') + '</div>'] : []), 'ไม่มีข้อบกพร่องในช่วงนี้')
      + box(icon('chart', 18) + ' แนวโน้ม 6 เดือน', ['<div class="strend">' + r.trend.map(function (m) {
        return '<div class="stm"><div class="stbars"><em class="b1" style="height:' + Math.round(m.findings / maxT * 100) + '%" title="ข้อบกพร่อง ' + m.findings + '"></em><em class="b2" style="height:' + Math.round(m.closed / maxT * 100) + '%" title="แก้เสร็จ ' + m.closed + '"></em><em class="b3" style="height:' + Math.round((m.incidents + m.near) / maxT * 100) + '%" title="อุบัติเหตุ/เกือบเกิด ' + (m.incidents + m.near) + '"></em></div>'
          + '<b>' + (m.pass == null ? '–' : m.pass + '%') + '</b><span>' + ymLabel(m.ym) + '</span></div>';
      }).join('') + '</div><div class="slegend"><i class="b1"></i>ข้อบกพร่อง <i class="b2"></i>แก้เสร็จ <i class="b3"></i>อุบัติเหตุ/เกือบเกิด · ตัวเลข = % ผ่าน</div>'], '')
      + box(icon('alert', 18) + ' อุบัติเหตุ / เกือบเกิดเหตุ', (x.byType.length ? ['<div class="srisk">' + x.byType.map(function (t) { return '<span>' + esc(t.name) + ' <b>' + t.n + '</b></span>'; }).join('') + '</div>'] : [])
        .concat(x.list.map(function (o) { return '<div class="li"><span>' + dd(o.date) + ' · ' + esc(o.type) + '</span><b>' + esc(o.location || '') + '</b><small>' + esc([o.person, o.injury, o.lostDays ? 'หยุดงาน ' + o.lostDays + ' วัน' : ''].filter(String).join(' · ')) + '</small></div>'; })), 'ไม่มีเหตุการณ์ในช่วงนี้')
      + '</div>';
    if (f.recent.length) html += '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('camera', 18) + ' ข้อบกพร่องล่าสุด</h4><div class="srecent">' + f.recent.map(function (o) {
      return '<div class="src" data-fd="' + esc(o.id) + '">' + (o.photo ? '<img src="' + img(o.photo, 400) + '" alt="" loading="lazy">' : '<div class="snoimg">ไม่มีรูป</div>') + '<b>' + esc(o.location) + '</b><span>' + esc(o.problem) + '</span>' + stTag(o) + '</div>';
    }).join('') + '</div></div>';
    return html;
  };

  // ==================== ตรวจเช็คประจำวันแต่ละอาคาร ====================
  function walk() {
    var w = H.walk = H.walk || {};
    if (!w.date) w.date = H.data.today;
    if (!w.inspector) w.inspector = store('inspector') || (list(H.data.settings.inspectors).length === 1 ? list(H.data.settings.inspectors)[0] : '');
    if (!w.areaId || !area(w.areaId)) return walkAreas();
    var a = area(w.areaId);
    if (!w.round) return walkRounds(a);
    return walkForm(a);
  }
  function checkOf(date, areaId, round) { return H.data.checks.filter(function (c) { return c.date === date && c.areaId === areaId && Number(c.round) === Number(round); })[0]; }
  function inspectorField(id) {
    var opts = list(H.data.settings.inspectors);
    return '<div class="pf"><label for="' + id + '">ผู้ตรวจ</label><input id="' + id + '" list="sInsp" value="' + esc(H.walk.inspector || '') + '" placeholder="ชื่อผู้ตรวจ">' + datalist('sInsp', opts) + '</div>';
  }
  function walkAreas() {
    var w = H.walk, t = w.date;
    $('main').innerHTML = '<h3>ตรวจเช็คประจำวันแต่ละอาคาร</h3><p class="lead">เลือกอาคาร / พื้นที่ที่จะตรวจ แล้วกด ผ่าน / ไม่ผ่าน ทีละข้อ · ข้อที่ไม่ผ่านถ่ายรูปได้เลย</p>'
      + '<div class="panel"><div class="pform" style="margin:0">' + F('wDate', 'วันที่ตรวจ', t, 'date', ' max="' + H.data.today + '"') + inspectorField('wInsp') + '</div></div>'
      + '<div class="sareas">' + activeAreas().map(function (a) {
        var done = H.data.checks.filter(function (c) { return c.date === t && c.areaId === a.id; });
        var fails = done.reduce(function (s, c) { return s + (Number(c.failCount) || 0); }, 0);
        var dots = ''; for (var r = 1; r <= a.rounds; r++) dots += '<i class="' + (done.some(function (c) { return Number(c.round) === r; }) ? 'ok' : '') + '">' + r + '</i>';
        return '<button class="sareabtn" data-a="' + a.id + '"><span class="sic">' + icon('shield', 26) + '</span><b>' + esc(a.name) + '</b><small>' + a.items.filter(function (it) { return it.active !== 'ปิด'; }).length + ' หัวข้อ · ' + a.rounds + ' รอบ/วัน</small>'
          + '<span class="srounds">' + dots + '</span>' + (fails ? '<em class="neg">ไม่ผ่าน ' + fails + ' ข้อ</em>' : '') + '</button>';
      }).join('') + '</div>';
    $('wDate').addEventListener('change', function () { if (v('wDate')) { w.date = v('wDate'); walkAreas(); } });
    $('wInsp').addEventListener('change', function () { w.inspector = v('wInsp'); store('inspector', w.inspector); });
    on('[data-a]', 'click', function (el) { w.inspector = v('wInsp'); store('inspector', w.inspector); w.areaId = el.getAttribute('data-a'); w.round = 0; walk(); }, $('main'));
  }
  function walkRounds(a) {
    var w = H.walk, next = 0, html = '';
    for (var r = 1; r <= a.rounds; r++) {
      var c = checkOf(w.date, a.id, r);
      if (!c && !next) next = r;
      html += '<button class="sroundbtn' + (c ? ' done' : '') + (!c && next === r ? ' next' : '') + '" data-r="' + r + '"><b>รอบที่ ' + r + '</b><span>' + (c ? '✓ ตรวจแล้ว · ผ่าน ' + c.passCount + ' ไม่ผ่าน ' + c.failCount + (c.inspector ? '<br>' + esc(c.inspector) : '') : 'ยังไม่ตรวจ') + '</span></button>';
    }
    $('main').innerHTML = '<div class="swalk-h"><button class="btn btn-sm btn-line" id="wBack">' + icon('back', 16) + ' เลือกพื้นที่</button><div><h3 style="margin:0">' + esc(a.name) + '</h3><span class="muted">' + thDate(w.date) + ' · ' + esc(a.title) + '</span></div></div>'
      + '<p class="lead">เลือกรอบที่จะตรวจ (ความถี่ ' + a.rounds + ' รอบต่อวัน) · รอบที่ตรวจแล้วแตะเพื่อดู/แก้ไขได้</p><div class="srounds-big">' + html + '</div>';
    $('wBack').addEventListener('click', function () { w.areaId = ''; walk(); });
    on('[data-r]', 'click', function (el) { w.round = +el.getAttribute('data-r'); w.draft = null; walk(); }, $('main'));
  }
  function draftKey() { var w = H.walk; return 'draft_' + w.date + '_' + w.areaId + '_' + w.round; }
  function walkForm(a) {
    var w = H.walk, ex = checkOf(w.date, a.id, w.round);
    var items = a.items.filter(function (it) { return it.active !== 'ปิด' || (ex && ex.results[it.id]); });
    var linked = {};   // ข้อที่ไม่ผ่านซึ่งมีรายการข้อบกพร่องแล้ว (จากการบันทึกรอบนี้ก่อนหน้า)
    if (ex) H.data.findings.forEach(function (f) { if (f.checkId === ex.id && f.itemId) linked[f.itemId] = f; });
    if (!w.draft) {
      var saved = null; try { saved = JSON.parse(store(draftKey()) || 'null'); } catch (e) {}
      w.draft = saved || { results: ex ? Object.assign({}, ex.results) : {}, problem: ex ? ex.problem : '', fix: ex ? ex.fix : '', fails: {} };
      w.draft.photos = {};   // รูปที่ยังไม่อัปโหลด (อยู่ในเครื่องเท่านั้น)
    }
    var D = w.draft, depts = list(H.data.settings.depts);
    var answered = items.filter(function (it) { return D.results[it.id]; }).length;
    var html = '<div class="swalk-h"><button class="btn btn-sm btn-line" id="wBack">' + icon('back', 16) + ' รอบ</button><div><h3 style="margin:0">' + esc(a.name) + ' · รอบที่ ' + w.round + '</h3><span class="muted">' + thDate(w.date) + (ex ? ' · แก้ไขผลตรวจเดิม' : '') + '</span></div>'
      + '<button class="btn btn-sm btn-line" id="wAllP">✓ ผ่านทุกข้อที่ยังว่าง</button></div>'
      + '<div class="sprog"><i style="width:' + Math.round(answered / Math.max(1, items.length) * 100) + '%"></i><span>ตรวจแล้ว ' + answered + ' / ' + items.length + ' ข้อ</span></div>'
      + '<div class="sitems">' + items.map(function (it, i) {
        var r = D.results[it.id] || '', fl = D.fails[it.id] || {}, lk = linked[it.id], ph = D.photos[it.id] || [];
        var h = '<div class="sitem r' + (r === '-' ? 'na' : r) + '" id="it_' + it.id + '"><div class="sitem-t"><span class="sno">' + (i + 1) + '</span><div><b>' + esc(it.category) + '</b><span>' + esc(it.detail) + '</span></div></div>'
          + '<div class="sbtns"><button type="button" class="sb p' + (r === 'P' ? ' on' : '') + '" data-res="P" data-it="' + it.id + '">✓ ผ่าน</button>'
          + '<button type="button" class="sb o' + (r === 'O' ? ' on' : '') + '" data-res="O" data-it="' + it.id + '">✗ ไม่ผ่าน</button>'
          + '<button type="button" class="sb n' + (r === '-' ? ' on' : '') + '" data-res="-" data-it="' + it.id + '">– ไม่เกี่ยวข้อง</button></div>';
        if (r === 'O') {
          if (lk) h += '<div class="sfail linked">มีรายการข้อบกพร่องแล้ว <b>' + esc(lk.code) + '</b> · ' + esc(lk.problem) + ' ' + stTag(lk) + ' <button type="button" class="link-btn" data-fd="' + lk.id + '">เปิดดู / เพิ่มรูป</button></div>';
          else h += '<div class="sfail"><div class="pform">'
            + '<div class="pf full"><label>ปัญหาที่พบ (ไม่ใส่ = ใช้ข้อความหัวข้อตรวจ)</label><textarea data-ff="problem" data-it="' + it.id + '" rows="2" placeholder="เช่น สายไฟชำรุดหน้าตู้ไฟ G2">' + esc(fl.problem || '') + '</textarea></div>'
            + '<div class="pf"><label>หน่วยงาน / แผนก / ฝ่าย</label><input data-ff="dept" data-it="' + it.id + '" list="sDepts" value="' + esc(fl.dept || '') + '"></div>'
            + '<div class="pf"><label>ผู้รับผิดชอบแก้ไข</label><input data-ff="responsible" data-it="' + it.id + '" value="' + esc(fl.responsible || '') + '"></div>'
            + '<div class="pf"><label>ระดับความเสี่ยง</label><div class="sseg">' + ['L', 'M', 'H'].map(function (k) { return '<button type="button" class="r' + k + ((fl.risk || 'M') === k ? ' on' : '') + '" data-risk="' + k + '" data-it="' + it.id + '">' + RISK[k] + '</button>'; }).join('') + '</div></div>'
            + '<div class="pf"><label>กำหนดแก้ไขเสร็จ</label><input type="date" data-ff="dueDate" data-it="' + it.id + '" value="' + esc(fl.dueDate || addDays(w.date, 7)) + '"></div>'
            + '<div class="pf full"><label>ข้อเสนอแนะ / การปรับปรุงแก้ไข</label><input data-ff="recommendation" data-it="' + it.id + '" value="' + esc(fl.recommendation || '') + '" placeholder="เช่น เปลี่ยนสายไฟใหม่ ติดป้ายเตือน"></div>'
            + '</div><div class="sphotos">' + thumbs(ph.map(function (p, k) { return { dataUrl: p.dataUrl, tmp: it.id + ':' + k }; }), 'tmp')
            + shotBtns('shot', it.id, 'ก่อนปรับปรุง') + '</div></div>';
        }
        return h + '</div>';
      }).join('') + '</div>'
      + '<div class="panel"><div class="pform" style="margin:0">' + T('wProb', 'ปัญหาที่พบ (ภาพรวมรอบนี้ · ไม่บังคับ)', D.problem) + T('wFix', 'แนวทางการแก้ไข (ไม่บังคับ)', D.fix) + inspectorField('wInsp2') + '</div></div>'
      + datalist('sDepts', depts)
      + '<div class="ssave"><button class="btn btn-primary" id="wSave">' + icon('check', 18) + ' บันทึกผลตรวจรอบที่ ' + w.round + '</button>' + (ex ? '<button class="btn btn-line" id="wDel">' + icon('trash', 16) + ' ลบผลรอบนี้</button>' : '') + '</div>';
    $('main').innerHTML = html;
    var keep = function () { var c = Object.assign({}, D); delete c.photos; store(draftKey(), JSON.stringify(c)); };
    $('wBack').addEventListener('click', function () { w.round = 0; w.draft = null; walk(); });
    $('wAllP').addEventListener('click', function () { items.forEach(function (it) { if (!D.results[it.id]) D.results[it.id] = 'P'; }); keep(); walkForm(a); });
    on('[data-res]', 'click', function (el) {
      var id = el.getAttribute('data-it'), r = el.getAttribute('data-res');
      D.results[id] = D.results[id] === r ? '' : r;
      if (!D.results[id]) delete D.results[id];
      keep(); var y = window.scrollY; walkForm(a); window.scrollTo(0, y);
      if (r === 'O' && D.results[id] === 'O' && !linked[id] && !(D.photos[id] || []).length) setTimeout(function () { var b = document.querySelector('[data-shot="' + id + '"]'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
    }, $('main'));
    on('[data-ff]', 'input', function (el) { var id = el.getAttribute('data-it'); D.fails[id] = D.fails[id] || {}; D.fails[id][el.getAttribute('data-ff')] = el.value; keep(); }, $('main'));
    on('[data-risk]', 'click', function (el) { var id = el.getAttribute('data-it'); D.fails[id] = D.fails[id] || {}; D.fails[id].risk = el.getAttribute('data-risk'); keep(); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, $('main'));
    on('[data-shot]', 'click', function (el) {
      var id = el.getAttribute('data-shot');
      pickPhotos(function (arr) { D.photos[id] = (D.photos[id] || []).concat(arr).slice(0, 6); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, el.getAttribute('data-src') === 'cam');
    }, $('main'));
    on('[data-del="tmp"]', 'click', function (el) { var p = el.getAttribute('data-fid').split(':'); (D.photos[p[0]] || []).splice(+p[1], 1); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, $('main'));
    on('[data-fd]', 'click', function (el) { var f = H.data.findings.filter(function (x) { return x.id === el.getAttribute('data-fd'); })[0]; if (f) findingModal(f); }, $('main'));
    ['wProb', 'wFix'].forEach(function (id) { $(id).addEventListener('input', function () { D[id === 'wProb' ? 'problem' : 'fix'] = $(id).value; keep(); }); });
    $('wInsp2').addEventListener('change', function () { w.inspector = v('wInsp2'); store('inspector', w.inspector); });
    if (ex) $('wDel').addEventListener('click', function () {
      confirmBox('ลบผลตรวจ ' + a.name + ' รอบที่ ' + w.round + ' วันที่ ' + dd(w.date) + '? (รายการข้อบกพร่องที่สร้างไว้ยังอยู่)', function () {
        return call('sheDeleteCheck', state.token, ex.id).then(function (r) { if (!r.ok) return r.error; closeModal(); store(draftKey(), null); w.round = 0; w.draft = null; reload('ลบผลตรวจแล้ว'); });
      });
    });
    $('wSave').addEventListener('click', function () {
      var miss = items.filter(function (it) { return !D.results[it.id]; });
      if (miss.length) { toast('ยังไม่ได้ตรวจ ' + miss.length + ' ข้อ'); var el = $('it_' + miss[0].id); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      w.inspector = v('wInsp2'); store('inspector', w.inspector);
      if (!w.inspector) { toast('ใส่ชื่อผู้ตรวจก่อนบันทึก'); $('wInsp2').focus(); return; }
      var nf = items.filter(function (it) { return D.results[it.id] === 'O' && !linked[it.id]; }).map(function (it) {
        var fl = D.fails[it.id] || {};
        return { itemId: it.id, problem: fl.problem || it.detail, dept: fl.dept || '', responsible: fl.responsible || '', risk: fl.risk || 'M', dueDate: fl.dueDate || addDays(w.date, 7), recommendation: fl.recommendation || '' };
      });
      var btn = $('wSave'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก…';
      call('sheSaveCheck', state.token, { id: ex ? ex.id : '', date: w.date, areaId: a.id, round: w.round, results: D.results, problem: D.problem, fix: D.fix, inspector: w.inspector }, nf).then(function (r) {
        if (!r.ok) throw new Error(r.error);
        var jobs = [];
        r.findings.forEach(function (f) { (D.photos[f.itemId] || []).forEach(function (p) { jobs.push(['finding', f.id, 'before', p]); }); });
        return uploadAll(jobs).then(function (fails) {
          store(draftKey(), null);
          var n = r.findings.length;
          w.round = 0; w.draft = null;
          reload('บันทึกผลตรวจแล้ว' + (n ? ' · สร้างรายการข้อบกพร่อง ' + n + ' รายการ' : '') + (fails ? ' · อัปโหลดรูปไม่สำเร็จ ' + fails + ' รูป (เพิ่มได้ที่หน้าข้อบกพร่อง)' : ''));
        });
      }).catch(function (e) { btn.disabled = false; btn.innerHTML = icon('check', 18) + ' บันทึกผลตรวจรอบที่ ' + w.round; if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e); toast(e.message); });
    });
  }
  function confirmBox(msg, fn) { openModal({ color: '#dc2626', icon: 'warn', title: 'ยืนยัน', body: '<p>' + esc(msg) + '</p>', ok: 'ยืนยัน', submit: fn }); }

  // ==================== ข้อบกพร่อง / ติดตามแก้ไข ====================
  function findings() {
    var q = H.q, t = H.data.today;
    q.fst = q.fst || 'pending';
    var areas = H.data.areas;
    var rows = H.data.findings.filter(function (f) {
      if (q.fst === 'pending' && f.status === 'done') return false;
      if (q.fst === 'late' && !(f.status !== 'done' && f.dueDate && f.dueDate < t)) return false;
      if (q.fst === 'done' && f.status !== 'done') return false;
      if (q.farea && f.areaId !== q.farea) return false;
      var s = String(q.fq || '').toLowerCase();
      return !s || [f.code, f.location, f.dept, f.problem, f.responsible, f.recommendation].join(' ').toLowerCase().indexOf(s) >= 0;
    });
    var count = function (k) { return H.data.findings.filter(function (f) { return k === 'pending' ? f.status !== 'done' : k === 'late' ? f.status !== 'done' && f.dueDate && f.dueDate < t : k === 'done' ? f.status === 'done' : true; }).length; };
    $('main').innerHTML = '<h3>ข้อบกพร่อง / ติดตามการแก้ไข</h3><p class="lead">รายการจากการตรวจเช็คประจำวัน (ข้อที่ไม่ผ่าน) และที่บันทึกเพิ่มเอง · แตะรายการเพื่อใส่รูปหลังปรับปรุงและปิดงาน</p>'
      + '<div class="pchips">' + [['pending', 'ค้างแก้ไข'], ['late', 'เกินกำหนด'], ['done', 'แก้ไขเรียบร้อย'], ['all', 'ทั้งหมด']].map(function (c) { return '<button class="chip' + (q.fst === c[0] ? ' on' : '') + '" data-fst="' + c[0] + '">' + c[1] + ' (' + count(c[0]) + ')</button>'; }).join('') + '</div>'
      + '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="fq" type="search" placeholder="ค้นหา เลขที่ / พื้นที่ / ปัญหา / ผู้รับผิดชอบ" value="' + esc(q.fq || '') + '"></div>'
      + '<select id="fArea"><option value="">ทุกพื้นที่</option>' + areas.map(function (a) { return '<option value="' + a.id + '"' + (q.farea === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>'
      + '<button class="btn btn-sm btn-primary" id="fNew">' + icon('plus', 16) + ' บันทึกข้อบกพร่อง</button></div>'
      + '<div class="sfinds">' + (rows.map(function (f) {
        var b = f.beforeFiles[0], a2 = f.afterFiles[0];
        return '<button class="sfind" data-fd="' + f.id + '"><div class="sfimg">' + (b ? '<img src="' + img(b.id, 300) + '" alt="" loading="lazy">' : '<div class="snoimg">ไม่มีรูปก่อน</div>') + (a2 ? '<img class="aft" src="' + img(a2.id, 300) + '" alt="" loading="lazy">' : '') + '</div>'
          + '<div class="sfinfo"><div><b>' + esc(f.code) + '</b> · ' + dd(f.date) + ' · ' + esc(f.location) + ' ' + stTag(f) + ' ' + riskTag(f.risk) + '</div><div class="sfp">' + esc(f.problem) + '</div>'
          + '<small>' + esc([f.dept, f.responsible ? 'ผู้รับผิดชอบ ' + f.responsible : '', f.status === 'done' ? 'เสร็จ ' + dd(f.doneDate) : f.dueDate ? 'กำหนด ' + dd(f.dueDate) : ''].filter(String).join(' · ')) + '</small></div></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ</div>') + '</div>';
    on('[data-fst]', 'click', function (el) { q.fst = el.getAttribute('data-fst'); findings(); }, $('main'));
    $('fq').addEventListener('input', function () { q.fq = $('fq').value; clearTimeout(H.ft); H.ft = setTimeout(function () { findings(); var e = $('fq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('fArea').addEventListener('change', function () { q.farea = $('fArea').value; findings(); });
    $('fNew').addEventListener('click', function () { findingModal(null); });
    on('[data-fd]', 'click', function (el) { findingModal(H.data.findings.filter(function (x) { return x.id === el.getAttribute('data-fd'); })[0]); }, $('main'));
  }
  function findingModal(f) {
    var isNew = !f, s = H.data.settings, t = H.data.today;
    f = f || { date: t, status: 'open', risk: 'M', dueDate: addDays(t, 7), beforeFiles: [], afterFiles: [] };
    var pend = { before: [], after: [] };
    var areaOpts = [['', '— อื่นๆ (พิมพ์สถานที่เอง) —']].concat(H.data.areas.map(function (a) { return [a.id, a.name]; }));
    function gallery() {
      ['before', 'after'].forEach(function (slot) {
        var box = $('g_' + slot); if (!box) return;
        var saved = (slot === 'before' ? f.beforeFiles : f.afterFiles) || [];
        box.innerHTML = thumbs(saved, isNew ? '' : slot) + thumbs(pend[slot].map(function (p, k) { return { dataUrl: p.dataUrl, tmp: slot + ':' + k }; }), 'tmp')
          + shotBtns('pick', slot, slot === 'before' ? 'ก่อนปรับปรุง' : 'หลังปรับปรุง');
      });
      on('[data-pick]', 'click', function (el) { var slot = el.getAttribute('data-pick'); pickPhotos(function (arr) { pend[slot] = pend[slot].concat(arr).slice(0, 6); gallery(); }, el.getAttribute('data-src') === 'cam'); }, $('mBody'));
      on('[data-del="tmp"]', 'click', function (el) { var p = el.getAttribute('data-fid').split(':'); pend[p[0]].splice(+p[1], 1); gallery(); }, $('mBody'));
      on('[data-del="before"],[data-del="after"]', 'click', function (el) {
        var slot = el.getAttribute('data-del'), fid = el.getAttribute('data-fid');
        if (!window.confirm('ลบรูปนี้?')) return;
        call('sheRemoveFile', state.token, 'finding', f.id, slot, fid).then(function (r) {
          if (!r.ok) return toast(r.error);
          if (slot === 'before') f.beforeFiles = r.files; else f.afterFiles = r.files;
          gallery(); H.data.findings.forEach(function (x) { if (x.id === f.id) { x.beforeFiles = f.beforeFiles; x.afterFiles = f.afterFiles; } });
        }).catch(onServerError);
      }, $('mBody'));
    }
    wide({
      icon: 'warn', title: isNew ? 'บันทึกข้อบกพร่อง' : 'ข้อบกพร่อง ' + f.code, sub: isNew ? 'FM-SHE-01-05 สรุปรายงานสำรวจตรวจสอบ' : dd(f.date) + ' · ' + f.location + (f.inspector ? ' · ตรวจโดย ' + f.inspector : ''),
      body: '<div class="pform">' + F('fDate', 'วันที่สำรวจ', f.date, 'date') + S('fArea2', 'พื้นที่', areaOpts, f.areaId || '')
        + '<div class="pf"><label for="fLoc">สถานที่ / พื้นที่ (ระบุจุด)</label><input id="fLoc" value="' + esc(f.location || '') + '" placeholder="เช่น G2 หน้าตู้ไฟ"></div>'
        + '<div class="pf"><label for="fDept">หน่วยงาน / แผนก / ฝ่าย</label><input id="fDept" list="sDepts2" value="' + esc(f.dept || '') + '"></div>' + datalist('sDepts2', list(s.depts))
        + T('fProb', 'ปัญหาที่ตรวจพบ *', f.problem) + T('fRec', 'ข้อเสนอแนะ / การปรับปรุงแก้ไข', f.recommendation)
        + F('fResp', 'ผู้รับผิดชอบ', f.responsible) + S('fRisk', 'ระดับความเสี่ยง', [['L', 'ต่ำ'], ['M', 'ปานกลาง'], ['H', 'สูง']], f.risk || 'M')
        + F('fDue', 'กำหนดแก้ไขเสร็จ', f.dueDate, 'date') + S('fSt', 'สถานะ', [['open', 'พบปัญหา (ยังไม่เริ่มแก้)'], ['progress', 'อยู่ในระหว่างดำเนินการ'], ['done', 'ปรับปรุงแก้ไขเรียบร้อย']], f.status)
        + F('fDone', 'วันที่แก้ไขเสร็จ', f.doneDate || '', 'date') + T('fRem', 'หมายเหตุ', f.remark) + '</div>'
        + '<div class="psec"><div class="psec-h"><b>รูปภาพก่อนการปรับปรุง</b></div><div class="sphotos" id="g_before"></div></div>'
        + '<div class="psec"><div class="psec-h"><b>รูปภาพหลังการปรับปรุง</b><small class="muted">ถ่ายหลังแก้ไขเสร็จ แล้วเลือกสถานะ "ปรับปรุงแก้ไขเรียบร้อย"</small></div><div class="sphotos" id="g_after"></div></div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="fDel">' + icon('trash', 16) + ' ลบรายการนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        gallery();
        $('fArea2').addEventListener('change', function () { var a = area($('fArea2').value); if (a && !v('fLoc')) $('fLoc').value = a.name; });
        $('fSt').addEventListener('change', function () { if ($('fSt').value === 'done' && !v('fDone')) $('fDone').value = t; });
        if (!isNew) $('fDel').addEventListener('click', function () {
          confirmBox('ลบข้อบกพร่อง ' + f.code + ' และรูปทั้งหมด?', function () { return call('sheDeleteFinding', state.token, f.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); });
        });
      },
      check: function () { if (!v('fProb')) return 'ระบุปัญหาที่ตรวจพบ'; if (!v('fLoc') && !v('fArea2')) return 'ระบุสถานที่ / พื้นที่'; return ''; },
      submit: function () {
        var a = area(v('fArea2'));
        var rec = { id: f.id || '', date: v('fDate'), areaId: v('fArea2'), location: v('fLoc') || (a ? a.name : ''), dept: v('fDept'), problem: v('fProb'), recommendation: v('fRec'),
          responsible: v('fResp'), risk: v('fRisk'), dueDate: v('fDue'), status: v('fSt'), doneDate: v('fDone'), remark: v('fRem'), forceDone: pend.after.length > 0 };
        var save = function (r) { return call('sheSaveFinding', state.token, r); };
        // ปิดงานพร้อมรูปหลังใหม่: บันทึกก่อน (สถานะเดิม) → อัปโหลดรูป → ปิดงาน
        var first = Object.assign({}, rec, isNew || pend.after.length ? { status: rec.status === 'done' ? 'progress' : rec.status } : {});
        return save(first).then(function (r) {
          if (!r.ok) return r.error;
          var id = r.finding.id, jobs = [];
          pend.before.forEach(function (p) { jobs.push(['finding', id, 'before', p]); });
          pend.after.forEach(function (p) { jobs.push(['finding', id, 'after', p]); });
          return uploadAll(jobs).then(function (fails) {
            var fin = rec.status === 'done' && first.status !== 'done' ? save(Object.assign({}, rec, { id: id, forceDone: false })) : Promise.resolve({ ok: true });
            return fin.then(function (r2) {
              if (!r2.ok) { closeModal(); reload(r2.error); return; }
              closeModal(); reload('บันทึกแล้ว' + (fails ? ' · อัปโหลดรูปไม่สำเร็จ ' + fails + ' รูป' : ''));
            });
          });
        });
      }
    });
  }
  H.findingModal = findingModal;

  // ==================== อุบัติเหตุ / เกือบเกิดเหตุ ====================
  function incidents() {
    var t = H.data.today, rows = H.data.incidents;
    var acc = rows.filter(function (x) { return ACC[x.type]; });
    var safe = acc.length ? days(acc[0].date, t) : null;
    var yr = rows.filter(function (x) { return x.date.slice(0, 4) === t.slice(0, 4); });
    $('main').innerHTML = '<h3>อุบัติเหตุ / เหตุการณ์เกือบเกิด</h3><p class="lead">บันทึกทุกเหตุการณ์ รวมถึงเกือบเกิดอุบัติเหตุ (Near miss) เพื่อวิเคราะห์และป้องกันก่อนเกิดเหตุจริง</p>'
      + '<div class="kpis">' + [[safe == null ? '–' : safe, 'วันปลอดอุบัติเหตุ', safe == null || safe > 30 ? '#16a34a' : '#d97706'],
        [yr.filter(function (x) { return ACC[x.type]; }).length, 'อุบัติเหตุ ปีนี้', '#dc2626'], [yr.filter(function (x) { return x.type === 'lti'; }).length, 'ถึงขั้นหยุดงาน ปีนี้', '#b91c1c'],
        [yr.reduce(function (s, x) { return s + (Number(x.lostDays) || 0); }, 0), 'วันหยุดงานรวม ปีนี้', '#7c3aed'], [yr.filter(function (x) { return x.type === 'near'; }).length, 'Near miss ปีนี้', '#d97706']]
        .map(function (k) { return '<div class="kpi" style="--k:' + k[2] + '"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>'; }).join('') + '</div>'
      + '<div class="pbar"><b style="flex:1">รายการทั้งหมด (' + rows.length + ')</b><button class="btn btn-sm btn-primary" id="iNew">' + icon('plus', 16) + ' บันทึกเหตุการณ์</button></div>'
      + '<div class="plist">' + (rows.map(function (x) {
        return '<button class="prow click" data-inc="' + x.id + '"><div class="pinfo"><b>' + dd(x.date) + (x.time ? ' ' + esc(x.time) + ' น.' : '') + ' · <span class="' + (ACC[x.type] ? 'neg' : 'warn') + '">' + esc(INC[x.type] || x.type) + '</span></b>'
          + '<small>' + esc([x.location, x.person, x.injury, x.lostDays ? 'หยุดงาน ' + x.lostDays + ' วัน' : ''].filter(String).join(' · ')) + '</small></div>' + (x.files.length ? '<img class="sinc-img" src="' + img(x.files[0].id, 200) + '" alt="">' : '') + '</button>';
      }).join('') || '<div class="panel muted">ยังไม่มีบันทึก</div>') + '</div>';
    $('iNew').addEventListener('click', function () { incidentModal(null); });
    on('[data-inc]', 'click', function (el) { incidentModal(rows.filter(function (x) { return x.id === el.getAttribute('data-inc'); })[0]); }, $('main'));
  }
  function incidentModal(x) {
    var isNew = !x, pend = [];
    x = x || { date: H.data.today, type: 'near', files: [] };
    function gallery() {
      $('g_inc').innerHTML = thumbs(x.files, isNew ? '' : 'files') + thumbs(pend.map(function (p, k) { return { dataUrl: p.dataUrl, tmp: 'i:' + k }; }), 'tmp')
        + shotBtns('pick', '1', '');
      on('[data-pick]', 'click', function (el) { pickPhotos(function (arr) { pend = pend.concat(arr).slice(0, 6); gallery(); }, el.getAttribute('data-src') === 'cam'); }, $('mBody'));
      on('[data-del="tmp"]', 'click', function (el) { pend.splice(+el.getAttribute('data-fid').split(':')[1], 1); gallery(); }, $('mBody'));
      on('[data-del="files"]', 'click', function (el) {
        if (!window.confirm('ลบรูปนี้?')) return;
        call('sheRemoveFile', state.token, 'incident', x.id, 'files', el.getAttribute('data-fid')).then(function (r) { if (!r.ok) return toast(r.error); x.files = r.files; gallery(); }).catch(onServerError);
      }, $('mBody'));
    }
    wide({
      icon: 'alert', title: isNew ? 'บันทึกเหตุการณ์' : 'เหตุการณ์ ' + dd(x.date), sub: 'อุบัติเหตุ / เกือบเกิดเหตุ',
      body: '<div class="pform">' + F('iDate', 'วันที่เกิดเหตุ *', x.date, 'date') + F('iTime', 'เวลา', x.time, 'time')
        + S('iType', 'ประเภท *', Object.keys(INC).map(function (k) { return [k, INC[k]]; }), x.type)
        + S('iArea', 'พื้นที่', [['', '— อื่นๆ —']].concat(H.data.areas.map(function (a) { return [a.id, a.name]; })), x.areaId || '')
        + F('iLoc', 'สถานที่ (ระบุจุด)', x.location) + F('iPerson', 'ผู้ประสบเหตุ', x.person) + F('iDept', 'แผนก', x.dept, 'text', ' list="sDepts3"') + datalist('sDepts3', list(H.data.settings.depts))
        + F('iLost', 'จำนวนวันหยุดงาน', x.lostDays, 'number', ' min="0"') + T('iInj', 'การบาดเจ็บ / ความเสียหาย', x.injury) + T('iCause', 'สาเหตุ', x.cause)
        + T('iAct', 'การแก้ไข / มาตรการป้องกัน', x.action) + F('iRep', 'ผู้รายงาน', x.reporter || store('inspector')) + '</div>'
        + '<div class="psec"><div class="psec-h"><b>รูปถ่าย</b></div><div class="sphotos" id="g_inc"></div></div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="iDel">' + icon('trash', 16) + ' ลบรายการนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        gallery();
        $('iArea').addEventListener('change', function () { var a = area($('iArea').value); if (a && !v('iLoc')) $('iLoc').value = a.name; });
        if (!isNew) $('iDel').addEventListener('click', function () { confirmBox('ลบเหตุการณ์นี้และรูปทั้งหมด?', function () { return call('sheDeleteIncident', state.token, x.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); }); });
      },
      submit: function () {
        return call('sheSaveIncident', state.token, { id: x.id || '', date: v('iDate'), time: v('iTime'), type: v('iType'), areaId: v('iArea'), location: v('iLoc') || ((area(v('iArea')) || {}).name || ''),
          person: v('iPerson'), dept: v('iDept'), lostDays: v('iLost'), injury: v('iInj'), cause: v('iCause'), action: v('iAct'), reporter: v('iRep') }).then(function (r) {
          if (!r.ok) return r.error;
          return uploadAll(pend.map(function (p) { return ['incident', r.incident.id, 'files', p]; })).then(function (fails) { closeModal(); reload('บันทึกแล้ว' + (fails ? ' · อัปโหลดรูปไม่สำเร็จ ' + fails + ' รูป' : '')); });
        });
      }
    });
  }

  // ==================== รายงาน / พิมพ์ PDF ====================
  function report() {
    var q = H.q, t = H.data.today;
    q.rep = q.rep || 'f05';
    if (!q.rFrom) { q.rFrom = t.slice(0, 8) + '01'; q.rTo = t; }
    if (!q.rYm) q.rYm = t.slice(0, 7);
    if (!q.rArea) q.rArea = (activeAreas()[0] || {}).id || '';
    var areaOpts = H.data.areas.map(function (a) { return '<option value="' + a.id + '"' + (q.rArea === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('');
    var ctl = q.rep === 'f05'
      ? '<label class="pchk">ตั้งแต่ <input type="date" id="rFrom" value="' + q.rFrom + '"></label><label class="pchk">ถึง <input type="date" id="rTo" value="' + q.rTo + '"></label>'
        + '<select id="rArea5"><option value="">ทุกพื้นที่</option>' + H.data.areas.map(function (a) { return '<option value="' + a.id + '"' + (q.r5Area === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>'
        + '<select id="rSt"><option value="">ทุกสถานะ</option><option value="pending"' + (q.rSt === 'pending' ? ' selected' : '') + '>ค้างแก้ไข</option><option value="done"' + (q.rSt === 'done' ? ' selected' : '') + '>แก้ไขเรียบร้อย</option></select>'
      : '<label class="pchk">เดือน <input type="month" id="rYm" value="' + q.rYm + '"></label><select id="rArea">' + areaOpts + '</select>';
    $('main').innerHTML = '<h3>รายงาน / พิมพ์ PDF</h3><p class="lead">กด "พิมพ์ / บันทึก PDF" แล้วเลือก "บันทึกเป็น PDF" (บน iPad: พิมพ์ → แตะแชร์ → บันทึกไปยังไฟล์) · กระดาษ A4 แนวนอน</p>'
      + '<div class="pchips noprint">' + [['f05', 'FM-SHE-01-05 สรุปรายงานสำรวจตรวจสอบ'], ['f06', 'FM-SHE-01-06 แบบตรวจความปลอดภัย (รายเดือน)']].map(function (c) { return '<button class="chip' + (q.rep === c[0] ? ' on' : '') + '" data-rep="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
      + '<div class="pbar noprint">' + ctl + '<button class="btn btn-sm btn-primary" id="rGo">ดูรายงาน</button><button class="btn btn-sm btn-line" id="rPrint">' + icon('print', 16) + ' พิมพ์ / บันทึก PDF</button></div>'
      + '<div id="rOut"></div>';
    on('[data-rep]', 'click', function (el) { q.rep = el.getAttribute('data-rep'); report(); }, $('main'));
    $('rPrint').addEventListener('click', function () {
      if (!$('rOut').innerHTML) return toast('กด "ดูรายงาน" ก่อน');
      var old = document.title; document.title = q.rep === 'f05' ? 'FM-SHE-01-05_' + q.rFrom + '_' + q.rTo : 'FM-SHE-01-06_' + ((area(q.rArea) || {}).name || '') + '_' + q.rYm;
      window.print(); setTimeout(function () { document.title = old; }, 1500);
    });
    $('rGo').addEventListener('click', function () {
      if (q.rep === 'f05') { q.rFrom = v('rFrom'); q.rTo = v('rTo'); q.r5Area = v('rArea5'); q.rSt = v('rSt'); } else { q.rYm = v('rYm'); q.rArea = v('rArea'); }
      runReport();
    });
    runReport();
  }
  function runReport() {
    var q = H.q;
    $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
    var p = q.rep === 'f05' ? call('sheFindingReport', state.token, q.rFrom, q.rTo) : call('sheMonthReport', state.token, q.rYm, q.rArea);
    p.then(function (r) {
      if (!r.ok) { $('rOut').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
      $('rOut').innerHTML = q.rep === 'f05' ? f05Html(r) : f06Html(r);
    }).catch(onServerError);
  }
  function logoHtml() { var l = document.querySelector('.brand-logo'); return l ? '<img class="slogo" src="' + l.src + '" alt="">' : ''; }
  function f05Html(r) {
    var q = H.q, s = r.settings, t = H.data.today;
    var rows = r.findings.filter(function (f) {
      if (q.r5Area && f.areaId !== q.r5Area) return false;
      if (q.rSt === 'pending' && f.status === 'done') return false;
      if (q.rSt === 'done' && f.status !== 'done') return false;
      return true;
    });
    var places = q.r5Area ? (area(q.r5Area) || {}).name : (rows.map(function (f) { return f.location; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(', ') || 'ทุกพื้นที่');
    var insp = rows.map(function (f) { return f.inspector; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(', ');
    var pic = function (files) { return (files || []).slice(0, 2).map(function (f) { return '<img src="' + img(f.id, 500) + '" alt="">'; }).join('') || '<span class="snone">–</span>'; };
    var head = '<div class="shead">' + logoHtml() + '<div class="sco"><b>' + COMPANY_TH + '</b><span>' + COMPANY_EN + '</span></div>'
      + '<div class="stitle">สรุปรายงานสำรวจตรวจสอบความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน</div><div class="sfm">' + esc(s.fm05).replace(' วันที่', '<br>วันที่') + '</div></div>'
      + '<div class="sinfo"><span>สถานที่ / ฝ่าย / แผนก / พื้นที่ <b>' + esc(places) + '</b></span><span>วันที่สำรวจตรวจสอบ <b>' + (r.from === r.to ? thDate(r.from) : thDate(r.from) + ' – ' + thDate(r.to)) + '</b></span><span>ตรวจสอบโดย <b>' + esc(insp || '................................') + '</b></span></div>';
    var body = '<table class="st05"><thead><tr><th style="width:3%">ลำดับ</th><th style="width:15%">รูปภาพก่อนการปรับปรุง</th><th style="width:14%">ปัญหาที่ตรวจพบ</th><th style="width:9%">หน่วยงาน / แผนก / ฝ่าย</th>'
      + '<th style="width:15%">รูปภาพหลังการปรับปรุง</th><th style="width:14%">ข้อเสนอแนะ / การปรับปรุงแก้ไข</th><th style="width:9%">ผู้รับผิดชอบ</th><th style="width:5.5%">อยู่ในระหว่างดำเนินการ</th><th style="width:5.5%">ปรับปรุงแก้ไขเรียบร้อย</th><th style="width:10%">หมายเหตุ</th></tr></thead><tbody>'
      + (rows.map(function (f, i) {
        var late = f.status !== 'done' && f.dueDate && f.dueDate < t;
        return '<tr><td class="c">' + (i + 1) + '</td><td class="sph">' + pic(f.beforeFiles) + '</td><td><b>' + esc(f.location) + '</b><br>' + esc(f.problem) + '<div class="ssm">' + dd(f.date) + ' · ' + esc(f.code) + ' · เสี่ยง' + (RISK[f.risk] || '') + '</div></td><td>' + esc(f.dept || '-') + '</td>'
          + '<td class="sph">' + pic(f.afterFiles) + '</td><td>' + esc(f.recommendation || '-') + '</td><td>' + esc(f.responsible || '-') + (f.dueDate ? '<div class="ssm">กำหนด ' + dd(f.dueDate) + '</div>' : '') + '</td>'
          + '<td class="c sck">' + (f.status !== 'done' ? '✓' : '') + '</td><td class="c sck">' + (f.status === 'done' ? '✓' : '') + (f.doneDate ? '<div class="ssm">' + sdd(f.doneDate) + '</div>' : '') + '</td><td>' + esc([f.remark, late ? 'เกินกำหนด' : ''].filter(String).join(' · ')) + '</td></tr>';
      }).join('') || '<tr><td colspan="10" class="c muted" style="padding:30px">ไม่มีข้อบกพร่องในช่วงนี้</td></tr>') + '</tbody></table>'
      + '<div class="ssign"><div><b>จัดทำโดย</b><span></span>ลงชื่อ<br>' + esc(s.signPrep) + '<br>วันที่ ..........................</div><div><b>อนุมัติโดย</b><span></span>ลงชื่อ<br>' + esc(s.signApprove) + '<br>วันที่ ..........................</div></div>'
      + '<div class="ssum noprint muted">ทั้งหมด ' + rows.length + ' รายการ · แก้ไขเรียบร้อย ' + rows.filter(function (f) { return f.status === 'done'; }).length + ' · อยู่ระหว่างดำเนินการ ' + rows.filter(function (f) { return f.status !== 'done'; }).length + '</div>';
    return '<div class="sreport"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
  }
  function f06Html(r) {
    var s = r.settings, a = r.area, ym = r.ym, y = +ym.slice(0, 4), m = +ym.slice(5, 7), nd = new Date(y, m, 0).getDate();
    var grid = {};   // grid[itemId][day][round] = 'P'|'O'|'-'
    r.checks.forEach(function (c) { var d = +c.date.slice(8, 10); Object.keys(c.results).forEach(function (k) { grid[k] = grid[k] || {}; grid[k][d] = grid[k][d] || {}; grid[k][d][c.round] = c.results[k]; }); });
    var sym = { P: '<span class="s6p">✓</span>', O: '<span class="s6o">✗</span>', '-': '<span class="s6n">–</span>' };
    var monthsRow = MONTHS.map(function (n, i) { return (i + 1 === m ? '☑' : '☐') + ' ' + n; }).join('&nbsp;&nbsp; ');
    var dayHead = ''; for (var d = 1; d <= 31; d++) dayHead += '<th class="sd' + (d > nd ? ' off' : '') + '">' + d + '</th>';
    var rows = r.items.map(function (it, i) {
      var h = '';
      for (var rd = 1; rd <= a.rounds; rd++) {
        h += '<tr class="' + (i % 2 ? 'alt' : '') + '">' + (rd === 1 ? '<td class="c" rowspan="' + a.rounds + '">' + (i + 1) + '</td><td rowspan="' + a.rounds + '" class="scat">' + esc(it.category) + '</td><td rowspan="' + a.rounds + '" class="sdet">' + esc(it.detail) + '</td>' : '') + '<td class="c">' + rd + '</td>';
        for (var dd2 = 1; dd2 <= 31; dd2++) { var res = ((grid[it.id] || {})[dd2] || {})[rd]; h += '<td class="sd' + (dd2 > nd ? ' off' : '') + '">' + (res ? sym[res] : '') + '</td>'; }
        h += '</tr>';
      }
      return h;
    }).join('');
    var probs = r.checks.filter(function (c) { return c.problem; }).map(function (c) { return +c.date.slice(8, 10) + '/' + m + ' ร.' + c.round + ': ' + c.problem; })
      .concat(r.findings.map(function (f) { return +f.date.slice(8, 10) + '/' + m + ': ' + f.problem + (f.status === 'done' ? ' (แก้แล้ว)' : ''); }));
    var fixes = r.checks.filter(function (c) { return c.fix; }).map(function (c) { return +c.date.slice(8, 10) + '/' + m + ': ' + c.fix; })
      .concat(r.findings.filter(function (f) { return f.recommendation; }).map(function (f) { return f.code + ': ' + f.recommendation; }));
    var insp = r.checks.map(function (c) { return c.inspector; }).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; }).join(', ');
    var head = '<div class="shead s6">' + logoHtml() + '<div class="sco"><b>' + COMPANY_TH + '</b><span>' + COMPANY_EN + '</span></div><div class="stitle">' + esc(a.title) + '</div><div class="sfm">' + esc(s.fm06).replace(' วันที่', '<br>วันที่') + '</div></div>';
    var cols = '<colgroup><col style="width:2.6%"><col style="width:8.6%"><col style="width:17.5%"><col style="width:3.3%">' + new Array(32).join('<col style="width:2.193%">') + '</colgroup>';
    var body = '<table class="st06">' + cols + '<thead><tr><td colspan="' + (4 + 31) + '" class="smonths">เดือน&nbsp;&nbsp; ' + monthsRow + '&nbsp;&nbsp;&nbsp; ปี พ.ศ. ' + (y + 543) + '</td></tr>'
      + '<tr><th class="c">ลำดับ</th><th>หมวด</th><th>รายละเอียด</th><th class="c">ความถี่</th>' + dayHead + '</tr></thead><tbody>' + rows
      + '<tr class="sbottom"><td colspan="3"><b>ปัญหาที่พบ</b></td><td colspan="32">' + (probs.map(esc).join(' · ') || '-') + '</td></tr>'
      + '<tr class="sbottom"><td colspan="3"><b>แนวทางการแก้ไข</b></td><td colspan="32">' + (fixes.map(esc).join(' · ') || '-') + '</td></tr>'
      + '<tr><td colspan="35" class="snote">หมายเหตุ เลือก ✓ ผ่าน / ✗ ไม่ผ่าน / – ไม่มีหรือไม่เกี่ยวข้องกับพื้นที่ หากพบข้อบกพร่องให้ระบุห้องและบันทึกการแก้ไขด้านล่าง</td></tr></tbody></table>'
      + '<div class="ssign s6"><div><span>' + esc(insp) + '</span>' + esc(s.signCheck) + '</div><div><span></span>' + esc(s.signReview) + '</div></div>';
    return '<div class="sreport"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
  }

  // ==================== ตั้งค่าแบบตรวจ ====================
  function settings() {
    var s = H.data.settings;
    $('main').innerHTML = '<h3>ตั้งค่าแบบตรวจ</h3><p class="lead">พื้นที่ตรวจ หัวข้อตรวจ ความถี่ต่อวัน รหัสแบบฟอร์ม และรายชื่อที่ใช้บ่อย</p>'
      + '<div class="pbar"><b style="flex:1">พื้นที่ตรวจ (' + H.data.areas.length + ')</b><button class="btn btn-sm btn-primary" id="aNew">' + icon('plus', 16) + ' เพิ่มพื้นที่</button></div>'
      + '<div class="plist">' + H.data.areas.map(function (a) {
        return '<button class="prow click' + (a.active === 'ปิด' ? ' off' : '') + '" data-area="' + a.id + '"><div class="pinfo"><b>' + esc(a.name) + (a.active === 'ปิด' ? ' (ปิดใช้)' : '') + '</b><small>' + esc(a.title) + ' · ' + a.items.filter(function (i) { return i.active !== 'ปิด'; }).length + ' หัวข้อ · ' + a.rounds + ' รอบ/วัน</small></div>' + icon('edit', 18) + '</button>';
      }).join('') + '</div>'
      + '<div class="panel" style="margin-top:14px"><h4 style="margin-top:0">รหัสแบบฟอร์ม / รายชื่อ / ผู้ลงนาม</h4><div class="pform">'
      + F('sFm05', 'รหัสแบบฟอร์มสรุปรายงานสำรวจ', s.fm05) + F('sFm06', 'รหัสแบบฟอร์มแบบตรวจรายเดือน', s.fm06)
      + T('sInsp', 'รายชื่อผู้ตรวจ (คั่นด้วย , )', s.inspectors, 'เช่น สมชาย, สมหญิง') + T('sDepts', 'หน่วยงาน / แผนก / ฝ่าย (คั่นด้วย , )', s.depts)
      + F('sPrep', 'FM-05 จัดทำโดย (ตำแหน่ง)', s.signPrep) + F('sAppr', 'FM-05 อนุมัติโดย (ตำแหน่ง)', s.signApprove)
      + F('sChk', 'FM-06 ผู้ตรวจสอบ', s.signCheck) + F('sRev', 'FM-06 ผู้ทวนสอบ', s.signReview)
      + '</div><button class="btn btn-primary" id="sSave">' + icon('check', 16) + ' บันทึกการตั้งค่า</button></div>';
    $('aNew').addEventListener('click', function () { areaModal(null); });
    on('[data-area]', 'click', function (el) { areaModal(area(el.getAttribute('data-area'))); }, $('main'));
    $('sSave').addEventListener('click', function () {
      var b = $('sSave'); b.disabled = true;
      call('sheSaveSettings', state.token, { fm05: v('sFm05'), fm06: v('sFm06'), inspectors: v('sInsp'), depts: v('sDepts'), signPrep: v('sPrep'), signApprove: v('sAppr'), signCheck: v('sChk'), signReview: v('sRev') })
        .then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); H.data.settings = r.settings; toast('บันทึกการตั้งค่าแล้ว'); }).catch(onServerError);
    });
  }
  function areaModal(a) {
    var isNew = !a;
    a = a || { name: '', title: '', rounds: 3, active: 'ใช้', items: [] };
    var items = a.items.filter(function (x) { return x.active !== 'ปิด'; }).map(function (x) { return { id: x.id, category: x.category, detail: x.detail }; });
    if (!items.length) items.push({ category: '', detail: '' });
    function draw() {
      $('aItems').innerHTML = items.map(function (x, i) {
        return '<div class="saitem"><span class="sno">' + (i + 1) + '</span><input data-ai="' + i + '" data-k="category" value="' + esc(x.category) + '" placeholder="หมวด เช่น ระบบไฟฟ้า">'
          + '<input data-ai="' + i + '" data-k="detail" value="' + esc(x.detail) + '" placeholder="รายละเอียดที่ต้องตรวจ">'
          + '<button type="button" class="icon-btn" data-up="' + i + '" title="เลื่อนขึ้น">▲</button><button type="button" class="icon-btn" data-rm="' + i + '" title="ลบ">' + icon('trash', 16) + '</button></div>';
      }).join('');
      on('[data-ai]', 'input', function (el) { items[+el.getAttribute('data-ai')][el.getAttribute('data-k')] = el.value; }, $('mBody'));
      on('[data-rm]', 'click', function (el) { items.splice(+el.getAttribute('data-rm'), 1); if (!items.length) items.push({ category: '', detail: '' }); draw(); }, $('mBody'));
      on('[data-up]', 'click', function (el) { var i = +el.getAttribute('data-up'); if (i > 0) { var t = items[i]; items[i] = items[i - 1]; items[i - 1] = t; draw(); } }, $('mBody'));
    }
    wide({
      icon: 'gear', title: isNew ? 'เพิ่มพื้นที่ตรวจ' : 'แก้ไขพื้นที่ ' + a.name, sub: 'หัวข้อที่ลบออก = ปิดใช้ (ผลตรวจเดิมยังอยู่ในรายงาน)',
      body: '<div class="pform">' + F('aName', 'ชื่อพื้นที่ *', a.name) + F('aTitle', 'หัวแบบฟอร์ม', a.title, 'text', ' placeholder="แบบตรวจความปลอดภัย ..."')
        + S('aRounds', 'ความถี่ (รอบต่อวัน)', [[1, '1 รอบ'], [2, '2 รอบ'], [3, '3 รอบ'], [4, '4 รอบ']], a.rounds) + S('aActive', 'สถานะ', [['ใช้', 'ใช้งาน'], ['ปิด', 'ปิดใช้']], a.active || 'ใช้') + '</div>'
        + '<div class="psec"><div class="psec-h"><b>หัวข้อตรวจ</b><button type="button" class="btn btn-sm btn-line" id="aAdd">' + icon('plus', 16) + ' เพิ่มหัวข้อ</button></div><div id="aItems" class="saitems"></div></div>',
      ok: 'บันทึก',
      onOpen: function () { draw(); $('aAdd').addEventListener('click', function () { items.push({ category: '', detail: '' }); draw(); }); },
      check: function () { if (!v('aName')) return 'ระบุชื่อพื้นที่'; if (!items.some(function (x) { return String(x.detail).trim(); })) return 'ต้องมีหัวข้อตรวจอย่างน้อย 1 ข้อ'; return ''; },
      submit: function () {
        return call('sheSaveArea', state.token, { id: a.id || '', name: v('aName'), title: v('aTitle'), rounds: v('aRounds'), active: v('aActive') }, items).then(function (r) {
          if (!r.ok) return r.error;
          H.data.areas = r.areas; closeModal(); settings(); toast('บันทึกแล้ว');
        });
      }
    });
  }

  // ==================== ประวัติการแก้ไข ====================
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><p class="lead">บันทึกทุกครั้งที่เพิ่ม/แก้/ลบข้อมูล</p><div id="lOut" class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
    call('sheLog', state.token, 300).then(function (r) {
      $('lOut').outerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>ข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody>'
        + (r.rows.map(function (x) { return '<tr><td class="nw">' + esc(x.time) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.table) + '</td><td>' + esc(x.detail) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีประวัติ</td></tr>') + '</tbody></table></div>';
    }).catch(onServerError);
  }

  // ---------- CSS ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    '.stodays{display:flex;gap:10px;flex-wrap:wrap}.stoday{border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:6px;min-width:120px;text-align:left}.stoday:hover{border-color:var(--c)}',
    '.srounds{display:flex;gap:5px}.srounds i{font-style:normal;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:#f1f5f9;color:#64748b}.srounds i.ok{background:#16a34a;color:#fff}',
    '.sareas{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-top:14px}',
    '.sareabtn{border:2px solid var(--line);background:#fff;border-radius:16px;padding:20px 16px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;box-shadow:var(--shadow);min-height:150px}.sareabtn:active{transform:scale(.98)}.sareabtn:hover{border-color:var(--c)}',
    '.sareabtn b{font-size:22px}.sareabtn small{color:var(--muted)}.sareabtn em{font-style:normal;font-size:13px;font-weight:600}.sic{color:var(--c)}',
    '.swalk-h{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}.swalk-h>div{flex:1;min-width:180px}',
    '.srounds-big{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}.sroundbtn{border:2px solid var(--line);background:#fff;border-radius:16px;padding:22px;text-align:left;display:flex;flex-direction:column;gap:6px;box-shadow:var(--shadow)}',
    '.sroundbtn b{font-size:22px}.sroundbtn span{color:var(--muted);font-size:14px}.sroundbtn.done{border-color:#86efac;background:#f0fdf4}.sroundbtn.done span{color:#15803d}.sroundbtn.next{border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 25%,transparent)}',
    '.sprog{position:relative;height:30px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:6px 0 14px}.sprog i{position:absolute;inset:0 auto 0 0;background:var(--c)}.sprog span{position:relative;display:block;text-align:center;line-height:30px;font-weight:600;font-size:13.5px;color:#0f172a}',
    '.sitems{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}.sitem{background:#fff;border:2px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow)}.sitem.rP{border-color:#86efac}.sitem.rO{border-color:#fca5a5;background:#fffafa}.sitem.rna{border-color:#cbd5e1}',
    '.sitem-t{display:flex;gap:12px;align-items:flex-start}.sitem-t b{display:block;font-size:17px}.sitem-t span{color:#334155;font-size:15px}.sno{flex:none;width:30px;height:30px;border-radius:50%;background:#f1f5f9;display:grid;place-items:center;font-weight:700;font-size:14px}',
    '.sbtns{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px}.sb{border:2px solid var(--line);background:#fff;border-radius:12px;padding:16px 6px;font-size:17px;font-weight:700;color:#475569;min-height:58px}',
    '.sb.p.on{background:#16a34a;border-color:#16a34a;color:#fff}.sb.o.on{background:#dc2626;border-color:#dc2626;color:#fff}.sb.n.on{background:#64748b;border-color:#64748b;color:#fff}',
    '.sfail{margin-top:12px;border-top:1px dashed #fca5a5;padding-top:12px}.sfail.linked{font-size:14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.sfail .pform{margin-bottom:8px}',
    '.sseg{display:flex;gap:6px}.sseg button{flex:1;border:1.5px solid var(--line);background:#fff;border-radius:9px;padding:9px 4px;font-weight:600}.sseg .rL.on{background:#16a34a;color:#fff;border-color:#16a34a}.sseg .rM.on{background:#d97706;color:#fff;border-color:#d97706}.sseg .rH.on{background:#dc2626;color:#fff;border-color:#dc2626}',
    '.sphotos{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.sth{position:relative;display:inline-block}.sth img{width:96px;height:96px;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:block;background:#f1f5f9}',
    '.sth-x{position:absolute;top:-8px;right:-8px;width:26px;height:26px;border-radius:50%;border:0;background:#dc2626;color:#fff;display:grid;place-items:center;padding:0}.sth-x svg{width:14px;height:14px}',
    '.sshot.lib{border-style:solid;background:#fff}.sshot{width:96px;height:96px;border:2px dashed var(--c);border-radius:10px;background:color-mix(in srgb,var(--c) 7%,white);color:var(--c);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:600;line-height:1.2}',
    '.ssave{position:sticky;bottom:0;display:flex;gap:10px;padding:12px 0;background:linear-gradient(transparent,var(--bg,#f1f5f9) 30%);z-index:5}.ssave .btn-primary{flex:1;font-size:18px;padding:16px}',
    '.stag{display:inline-block;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:99px;vertical-align:1px}.stag.sopen{background:#fee2e2;color:#b91c1c}.stag.sprogress{background:#fef3c7;color:#b45309}.stag.sdone{background:#dcfce7;color:#15803d}.stag.late{background:#b91c1c;color:#fff}',
    '.stag.rL{background:#f0fdf4;color:#15803d}.stag.rM{background:#fffbeb;color:#b45309}.stag.rH{background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5}',
    '.sfinds{display:flex;flex-direction:column;gap:10px}.sfind{display:flex;gap:12px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;text-align:left;box-shadow:var(--shadow);color:inherit}.sfind:hover{border-color:var(--c)}',
    '.sfimg{flex:none;display:flex;gap:4px}.sfimg img,.snoimg{width:92px;height:92px;object-fit:cover;border-radius:10px;background:#f1f5f9}.sfimg img.aft{outline:3px solid #16a34a;outline-offset:-3px}.snoimg{display:grid;place-items:center;font-size:11px;color:var(--muted);text-align:center}',
    '.sfinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;font-size:14px}.sfp{font-weight:600}.sfinfo small{color:var(--muted)}',
    '.sinc-img{width:56px;height:56px;object-fit:cover;border-radius:8px}.prow.off{opacity:.55}',
    '.saitems{display:flex;flex-direction:column;gap:6px}.saitem{display:grid;grid-template-columns:auto 1fr 2fr auto auto;gap:6px;align-items:center}.saitem input{padding:8px 10px;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:14px;min-width:0}',
    '.sbar{display:grid;grid-template-columns:minmax(90px,1.2fr) 2fr auto;gap:8px;align-items:center;font-size:13px;padding:4px 0}.sbar i{height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;display:block}.sbar em{display:block;height:100%;border-radius:99px}.sbar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.sarea-row{border-top:1px solid var(--line);padding:6px 0}.sarea-row small{color:var(--muted);font-size:12px}.srisk{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.srisk span{background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:3px 9px;font-size:13px}',
    '.sins .sin{padding:6px 10px;border-radius:8px;margin-top:6px;font-size:14px;border-left:4px solid}.sin.ok{background:#f0fdf4;border-color:#16a34a}.sin.warn{background:#fffbeb;border-color:#d97706}.sin.bad{background:#fef2f2;border-color:#dc2626}',
    '.strend{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;align-items:end}.stm{text-align:center;font-size:11.5px}.stm b{display:block;font-size:12.5px}.stm span{color:var(--muted)}.stbars{height:90px;display:flex;align-items:flex-end;justify-content:center;gap:3px;border-bottom:1px solid var(--line)}',
    '.stbars em{width:10px;border-radius:3px 3px 0 0;min-height:1px}.b1{background:#d97706}.b2{background:#16a34a}.b3{background:#dc2626}.slegend{font-size:11.5px;color:var(--muted);margin-top:6px}.slegend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 3px 0 8px;vertical-align:-1px}',
    '.srecent{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.src{border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:4px;font-size:13px;cursor:pointer}.src img,.src .snoimg{width:100%;height:110px;object-fit:cover;border-radius:8px}.src span{color:#334155}',
    // รายงาน FM-05 / FM-06 (A4 แนวนอน)
    '.sreport{background:#fff;border-radius:14px;padding:18px;margin-top:14px;box-shadow:var(--shadow);color:#0f172a;overflow-x:auto}',
    '.shead{display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:10px;border:1px solid #0f172a;padding:8px 10px}.slogo{height:52px}.sco b{display:block;font-size:13px}.sco span{font-size:12px;color:#334155}',
    '.stitle{text-align:center;font-weight:700;font-size:15px}.sfm{font-size:10.5px;text-align:right;line-height:1.5;border:1px solid #94a3b8;border-radius:4px;padding:3px 7px;white-space:nowrap}',
    '.sinfo{display:flex;flex-wrap:wrap;gap:4px 24px;font-size:12.5px;border:1px solid #0f172a;border-top:0;padding:6px 10px;margin-bottom:6px}',
    '.st05{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.st05 th{background:#f1f5f9;border:1px solid #0f172a;padding:5px 4px;font-size:11.5px;text-align:center}.st05 td{border:1px solid #0f172a;padding:5px;vertical-align:top;word-wrap:break-word}',
    '.st05 .c{text-align:center}.sph img{width:100%;max-height:130px;object-fit:cover;display:block;margin-bottom:3px;border-radius:3px}.snone{color:#94a3b8}.ssm{font-size:10.5px;color:#64748b;margin-top:3px}.sck{font-size:18px;color:#15803d;font-weight:700}',
    '.ssign{display:flex;justify-content:space-around;gap:16px;margin-top:22px;text-align:center;font-size:12.5px;line-height:2;break-inside:avoid;border:1px solid #0f172a;padding:10px}.ssign span{display:block;width:200px;border-bottom:1px dotted #475569;height:26px;margin:0 auto}',
    '.ssign.s6{border:0}.ssign.s6 span{line-height:26px;font-size:12px}.ssum{margin-top:8px}',
    '.st06{width:100%;border-collapse:collapse;font-size:10.5px;table-layout:fixed}.st06 th,.st06 td{border:1px solid #0f172a;padding:2px 3px}.st06 th{background:#d9f7d9;text-align:center}.st06 .sd{text-align:center;padding:1px 0}.st06 .off{background:#e5e7eb}',
    '.st06 .c{text-align:center}.st06 .scat,.st06 .sdet{font-size:9.5px;line-height:1.3}.st06 tr.alt td{background:#f3f4f6}.st06 tr.alt td.off{background:#d1d5db}.smonths{text-align:left;font-size:11px;padding:4px 6px!important}',
    '.s6p{color:#15803d;font-weight:700}.s6o{color:#dc2626;font-weight:700}.s6n{color:#64748b}.sbottom td{height:34px;vertical-align:top}.snote{font-size:10.5px}',
    '@media (max-width:700px){.sbtns{grid-template-columns:1fr 1fr 1fr}.sb{font-size:15px;padding:14px 4px}.sfimg img,.snoimg{width:72px;height:72px}.saitem{grid-template-columns:auto 1fr auto auto}.saitem input[data-k="detail"]{grid-column:2/-1}.shead{grid-template-columns:auto 1fr}.stitle,.sfm{grid-column:1/-1}}',
    '@media print{.sreport{box-shadow:none;padding:0;margin:0;border-radius:0;overflow:visible}.st05{font-size:8.5pt}.st05 th{font-size:8pt}.sph img{max-height:34mm}.st06{font-size:7.5pt}.shead{padding:4px 8px}.slogo{height:36px}.stitle{font-size:11pt}.sfm{font-size:7.5pt}.sinfo{font-size:8.5pt}.st05 tr,.st06 tr{break-inside:avoid}.ssign{font-size:9pt}.ssave,.swalk-h .btn{display:none}}'
  ].join('\n');
  document.head.appendChild(css);
})();
