// ==================== ฝ่ายความปลอดภัยและสิ่งแวดล้อม (SHE) ====================
// หน้าเว็บของโมดูล "safety" — index.html เรียก SHE.menus() / SHE.render(page)
// ข้อมูลอยู่ใน Google Sheet ของฝ่าย ผ่าน API She.gs (sheLoad, sheSaveCheck, ...) · รูปถ่ายเก็บในโฟลเดอร์ Drive ของฝ่าย
// ออกแบบให้ใช้บน iPad: เดินตรวจตามพื้นที่ กดผ่าน/ไม่ผ่าน ถ่ายรูปข้อที่ไม่ผ่าน → ระบบสร้างรายการข้อบกพร่อง (FM-SHE-01-05) ให้เอง
(function () {
  var H = window.SHE = { data: null, loading: null, q: {} };

  Object.assign(ICONS, {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
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
    { id: 's_abn', label: 'รายงานสิ่งผิดปกติ (Abnormality)', ic: 'warn' },
    { id: 's_mon', label: 'ตรวจประจำเดือน (ทางออกฉุกเฉิน / แจ้งเหตุเพลิงไหม้)', ic: 'clock' },
    { id: 's_doc', label: 'แฟ้มเอกสาร (Word / Excel / PowerPoint)', ic: 'folder' },
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
  var DEF_INSPECTOR = 'จิราลักษณ์ สุนทรวัฒน์';   // ผู้ตรวจของฝ่าย (ใส่ให้อัตโนมัติ · แก้ในช่องได้ · ตั้งรายชื่อเพิ่มได้ในหน้าตั้งค่า)
  function inspectors() { var l = list(H.data.settings.inspectors); return l.length ? l : [DEF_INSPECTOR]; }

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
  // "ตรวจพบล่าสุด 17 พ.ย. 69 รอบ 3 · พบ 4 ครั้ง" (แสดงเมื่อพบซ้ำ)
  function seenText(f) {
    if (!f || (Number(f.seenCount) || 1) < 2) return '';
    return 'ตรวจพบล่าสุด ' + dd(f.lastSeen || f.date) + (f.lastRound ? ' รอบ ' + f.lastRound : '') + ' · พบ ' + f.seenCount + ' ครั้ง';
  }
  // ใหม่สุดก่อน: ตรวจพบล่าสุด → รอบ → เลขที่
  function seenSort(a, b) {
    var k = function (f) { return String(f.lastSeen || f.date) + ('0' + (Number(f.lastRound) || 0)).slice(-2) + String(f.code); };
    return k(b).localeCompare(k(a));
  }
  // ข้อบกพร่องเดิมที่ยังไม่แก้ของพื้นที่ + หัวข้อเดียวกัน (ล่าสุด)
  function openFindingOf(areaId, itemId) {
    return H.data.findings.filter(function (f) { return f.areaId === areaId && f.itemId === itemId && f.status !== 'done'; })
      .sort(seenSort)[0];
  }
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
    ({ s_dash: dash, s_check: walk, s_find: findings, s_inc: incidents, s_abn: abnormals, s_mon: monthly, s_doc: docsPage, s_rep: report, s_set: settings, s_log: logPage }[page] || dash)();
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
    dashCall('sheDashboard', [q.from, q.to], function (r) {
      if (my !== H.dseq || state.page !== 's_dash') return;
      if (!r.ok) { $('dOut').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
      $('dOut').innerHTML = H.dashHtml(r);
      on('[data-fd]', 'click', function (el) { var f = H.data.findings.filter(function (x) { return x.id === el.getAttribute('data-fd'); })[0]; if (f) findingModal(f); }, $('dOut'));
      on('[data-abo]', 'click', function (el) { var a = (H.data.abnormals || []).filter(function (x) { return x.id === el.getAttribute('data-abo'); })[0]; if (a) abModal(a); }, $('dOut'));
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
      + (r.abnormal ? tile(r.abnormal.open, 'สิ่งผิดปกติยังไม่ปิด', r.abnormal.overdue ? '#dc2626' : r.abnormal.open ? '#d97706' : '#16a34a', 'เกินกำหนด ' + r.abnormal.overdue + ' · แจ้งในช่วงนี้ ' + r.abnormal.total + ' · ปิดแล้ว ' + r.abnormal.closed) : '')
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
        return '<div class="li click' + (o.photo ? ' sabli' : '') + '" data-fd="' + esc(o.id) + '">' + (o.photo ? '<img src="' + img(o.photo, 240) + '" alt="" loading="lazy">' : '') + '<span>' + esc(o.code) + ' · ' + esc(o.location) + ' · ' + esc(o.problem) + '</span><b class="neg">' + dd(o.dueDate) + '</b><small>ผู้รับผิดชอบ ' + esc(o.responsible || '-') + ' · ความเสี่ยง' + (RISK[o.risk] || '') + '</small></div>';
      }), 'ไม่มีรายการเกินกำหนด')
      + box(icon('chart', 18) + ' ข้อบกพร่องแยกพื้นที่ / ความเสี่ยง', f.byArea.map(function (a) { return bar(a.name, a.n, f.byArea[0].n, '#d97706'); })
        .concat(f.byRisk.length ? ['<div class="xsep" style="margin:12px 0"></div>' + (window.DCH ? window.DCH.donut(f.byRisk.map(function (rk) { return { name: 'ความเสี่ยง' + rk.name, n: rk.n, color: /สูง|วิกฤต/.test(rk.name) ? '#dc2626' : /กลาง/.test(rk.name) ? '#f59e0b' : /ต่ำ/.test(rk.name) ? '#16a34a' : null }; }), { sub: 'ข้อบกพร่อง', unit: ' เรื่อง', title: 'ข้อบกพร่องแยกความเสี่ยง' }) : '<div class="srisk">' + f.byRisk.map(function (rk) { return '<span>' + esc(rk.name) + ' <b>' + rk.n + '</b></span>'; }).join('') + '</div>')] : []), 'ไม่มีข้อบกพร่องในช่วงนี้')
      + (window.DCH ? (function () {   // กราฟเส้นแบบใหม่ (21/11/69)
        var T = r.trend, last = T[T.length - 1] || {}, prev = T[T.length - 2] || {};
        return '<div class="panel pbox"><h4>' + icon('chart', 18) + ' แนวโน้ม 6 เดือน</h4>'
          + '<div class="dch-head"><b>' + (last.pass == null ? '–' : last.pass + '%') + '</b><span>ผลตรวจผ่าน เดือนล่าสุด</span>' + (last.pass != null && prev.pass != null ? window.DCH.delta(last.pass, prev.pass, { pct: false, unit: '%', label: 'จากเดือนก่อน' }) : '') + '</div>'
          + window.DCH.area({ labels: T.map(function (m) { return MONTHS[+m.ym.slice(5, 7) - 1]; }), calloutLabel: function (i) { return ymLabel(T[i].ym); },
            series: [{ name: 'ข้อบกพร่อง', color: '#f97316', values: T.map(function (m) { return m.findings; }) }, { name: 'แก้เสร็จ', color: '#16a34a', fill: false, values: T.map(function (m) { return m.closed; }) },
              { name: 'อุบัติเหตุ / เกือบเกิด', color: '#dc2626', fill: false, dash: true, values: T.map(function (m) { return m.incidents + m.near; }) }], unit: ' เรื่อง' }) + '</div>';
      })() : '')
      + box(icon('alert', 18) + ' อุบัติเหตุ / เกือบเกิดเหตุ', (x.byType.length ? ['<div class="srisk">' + x.byType.map(function (t) { return '<span>' + esc(t.name) + ' <b>' + t.n + '</b></span>'; }).join('') + '</div>'] : [])
        .concat(x.list.map(function (o) { return '<div class="li' + (o.photo ? ' sabli' : '') + '">' + (o.photo ? '<img src="' + img(o.photo, 240) + '" alt="" loading="lazy">' : '') + '<span>' + dd(o.date) + ' · ' + esc(o.type) + '</span><b>' + esc(o.location || '') + '</b><small>' + esc([o.person, o.injury, o.lostDays ? 'หยุดงาน ' + o.lostDays + ' วัน' : ''].filter(String).join(' · ')) + '</small></div>'; })), 'ไม่มีเหตุการณ์ในช่วงนี้')
      + (r.abnormal ? box(icon('warn', 18) + ' รายงานสิ่งผิดปกติ (ยังไม่ปิด)', (r.abnormal.byTopic.length ? ['<div class="srisk">' + r.abnormal.byTopic.map(function (t) { return '<span>' + esc(t.name) + ' <b>' + t.n + '</b></span>'; }).join('') + '</div>'] : [])
        .concat(r.abnormal.list.map(function (o) {
          return '<div class="li click' + (o.photo ? ' sabli' : '') + '" data-abo="' + esc(o.id) + '">' + (o.photo ? '<img src="' + img(o.photo, 240) + '" alt="" loading="lazy">' : '') + '<span>' + esc(o.code) + ' · ' + esc(o.place || '-') + ' · ' + esc(o.detail) + '</span>'
            + '<b class="' + (o.late || o.fail ? 'neg' : '') + '">' + (o.dueDate ? 'กำหนด ' + dd(o.dueDate) : 'ยังไม่กำหนดวันเสร็จ') + '</b><small>แจ้ง ' + dd(o.reportDate) + ' · ผู้รับผิดชอบ ' + esc(o.responsible || '-') + (o.late ? ' · เกินกำหนด' : '') + (o.fail ? ' · ตรวจแล้วยังไม่เรียบร้อย' : '') + '</small></div>';
        })), 'ไม่มีรายงานที่ค้าง 👍') : '')
      + '</div>';
    if (f.recent.length) html += '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('camera', 18) + ' ข้อบกพร่องล่าสุด</h4><div class="srecent">' + f.recent.map(function (o) {
      return '<div class="src" data-fd="' + esc(o.id) + '">' + (o.photo ? '<img src="' + img(o.photo, 400) + '" alt="" loading="lazy">' : '<div class="snoimg">ไม่มีรูป</div>') + '<b>' + esc(o.location) + '</b><span>' + esc(o.problem) + '</span>' + (seenText(o) ? '<small class="sseen">🔁 ' + esc(seenText(o)) + '</small>' : '') + stTag(o) + '</div>';
    }).join('') + '</div></div>';
    return html;
  };

  // ==================== ตรวจเช็คประจำวันแต่ละอาคาร ====================
  function walk() {
    var w = H.walk = H.walk || {};
    if (!w.date) w.date = H.data.today;
    if (!w.inspector) w.inspector = store('inspector') || inspectors()[0];
    if (!w.areaId || !area(w.areaId)) return walkAreas();
    var a = area(w.areaId);
    if (!w.round) return walkRounds(a);
    return walkForm(a);
  }
  function checkOf(date, areaId, round) { return H.data.checks.filter(function (c) { return c.date === date && c.areaId === areaId && Number(c.round) === Number(round); })[0]; }
  function inspectorField(id) {
    var opts = inspectors();
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
      }).join('') + '</div>'
      + histHtml();
    $('wDate').addEventListener('change', function () { if (v('wDate')) { w.date = v('wDate'); walkAreas(); } });
    on('[data-ck]', 'click', function (el) {
      var c = H.data.checks.filter(function (x) { return x.id === el.getAttribute('data-ck'); })[0]; if (!c) return;
      w.date = c.date; w.areaId = c.areaId; w.round = Number(c.round); w.draft = null; walk(); window.scrollTo(0, 0);
    }, $('main'));
    var hq = $('hDate'); if (hq) hq.addEventListener('change', function () { H.q.hDate = hq.value; walkAreas(); });
    // วันที่เก่ากว่าข้อมูลที่โหลดไว้ (70 วัน) → ดึงผลตรวจของวันนั้นมาเพิ่ม จะได้เห็น/แก้รอบที่ตรวจแล้ว
    [t, H.q.hDate].forEach(function (d) {
      if (!d || d >= addDays(H.data.today, -69) || (H.loadedDays = H.loadedDays || {})[d]) return;
      H.loadedDays[d] = 1;
      call('sheChecks', state.token, d, d).then(function (r) {
        if (!r.ok) return;
        var have = {}; H.data.checks.forEach(function (c) { have[c.id] = 1; });
        r.checks.forEach(function (c) { if (!have[c.id]) H.data.checks.push(c); });
        if (state.page === 's_check' && !H.walk.areaId) walkAreas();
      }).catch(onServerError);
    });
    $('wInsp').addEventListener('change', function () { w.inspector = v('wInsp'); store('inspector', w.inspector); });
    on('[data-a]', 'click', function (el) { w.inspector = v('wInsp'); store('inspector', w.inspector); w.areaId = el.getAttribute('data-a'); w.round = 0; walk(); }, $('main'));
  }
  // ผลตรวจที่บันทึกแล้ว (แตะเพื่อเปิดดู / แก้ไข) — เลือกวันที่ดูได้ · ไม่เลือก = ล่าสุด 30 รายการ
  function histHtml() {
    var q = H.q, rows = H.data.checks.filter(function (c) { return !q.hDate || c.date === q.hDate; })
      .sort(function (a, b) { return String(b.date + pad(b.round)).localeCompare(String(a.date + pad(a.round))) || String(b.updatedAt).localeCompare(String(a.updatedAt)); }).slice(0, q.hDate ? 50 : 30);
    return '<div class="panel" style="margin-top:16px"><div class="psec-h" style="flex-wrap:wrap"><b>' + icon('edit', 16) + ' ผลตรวจที่บันทึกแล้ว · แตะเพื่อดู / แก้ไข</b>'
      + '<label class="pchk">วันที่ <input type="date" id="hDate" value="' + esc(q.hDate || '') + '" max="' + H.data.today + '"></label></div>'
      + '<div class="plist">' + (rows.map(function (c) {
        var a = area(c.areaId) || { name: '-' };
        return '<button class="prow click" data-ck="' + c.id + '"><div class="pinfo"><b>' + thDate(c.date) + ' · ' + esc(a.name) + ' · รอบที่ ' + c.round + '</b><small>ผ่าน ' + (c.passCount || 0) + ' · <span class="' + (c.failCount ? 'neg' : '') + '">ไม่ผ่าน ' + (c.failCount || 0) + '</span>'
          + (c.inspector ? ' · ' + esc(c.inspector) : '') + (c.updatedAt && c.updatedAt !== c.createdAt ? ' · แก้ไขล่าสุด ' + esc(String(c.updatedAt).slice(0, 16)) : '') + '</small></div><span class="sedit">' + icon('edit', 16) + ' แก้ไข</span></button>';
      }).join('') || '<div class="muted">' + (q.hDate ? 'ไม่มีผลตรวจในวันที่เลือก' : 'ยังไม่มีผลตรวจ') + '</div>') + '</div></div>';
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
    // ข้อที่ยังมีข้อบกพร่องเดิมค้างอยู่ (จากรอบ/วันก่อน) → ไม่สร้างซ้ำ ยกเว้นผู้ตรวจเลือกว่าเป็นปัญหาใหม่
    var prev = {};
    a.items.forEach(function (it) { if (!linked[it.id]) { var o = openFindingOf(a.id, it.id); if (o) prev[it.id] = o; } });
    if (!w.draft) {
      var saved = null; try { saved = JSON.parse(store(draftKey()) || 'null'); } catch (e) {}
      w.draft = saved || { results: ex ? Object.assign({}, ex.results) : {}, problem: ex ? ex.problem : '', fix: ex ? ex.fix : '', fails: {}, fresh: {} };
      w.draft.photos = {};   // รูปที่ยังไม่อัปโหลด (อยู่ในเครื่องเท่านั้น)
      w.draft.gphotos = [];  // รูปปัญหาที่พบ (ภาพรวมรอบนี้) ที่ยังไม่อัปโหลด
    }
    var D = w.draft, depts = list(H.data.settings.depts);
    D.fresh = D.fresh || {};
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
          var pv = prev[it.id];
          if (lk) h += '<div class="sfail linked">มีรายการข้อบกพร่องแล้ว <b>' + esc(lk.code) + '</b> · ' + esc(lk.problem) + ' ' + stTag(lk) + ' <button type="button" class="link-btn" data-fd="' + lk.id + '">เปิดดู / เพิ่มรูป</button></div>';
          else if (pv && !D.fresh[it.id]) h += '<div class="sfail linked srepeat"><div class="srph">' + ((pv.beforeFiles || [])[0] ? '<img src="' + img(pv.beforeFiles[0].id, 200) + '" alt="">' : '') + '<div><b>ข้อบกพร่องเดิมยังไม่ได้แก้ไข</b> · ' + esc(pv.code) + ' ' + stTag(pv)
            + '<div>' + esc(pv.problem) + '</div><small class="muted">พบครั้งแรก ' + dd(pv.date) + (seenText(pv) ? ' · ' + esc(seenText(pv)) : '') + '</small>'
            + '<div class="srpn">บันทึกรอบนี้แล้ว ระบบจะนับเป็น "ตรวจพบซ้ำ" ในรายการเดิม (ไม่สร้างรายการใหม่ ไม่ต้องถ่ายรูปซ้ำ)</div>'
            + '<div class="srpb"><button type="button" class="link-btn" data-fd="' + pv.id + '">เปิดดู / เพิ่มรูป</button><button type="button" class="link-btn" data-fresh="' + it.id + '">เป็นปัญหาใหม่ (สร้างรายการใหม่)</button></div></div></div></div>';
          else h += '<div class="sfail">' + (pv ? '<div class="srpn">สร้างเป็นรายการใหม่ (แยกจาก ' + esc(pv.code) + ') · <button type="button" class="link-btn" data-fresh="' + it.id + '">ยกเลิก ใช้รายการเดิม</button></div>' : '') + '<div class="pform">'
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
      + '<div class="panel"><div class="pform" style="margin:0">' + T('wProb', 'ปัญหาที่พบ (ภาพรวมรอบนี้ · ไม่บังคับ)', D.problem)
        + '<div class="pf full"><label>รูปปัญหาที่พบ (ไม่บังคับ)</label><div class="sphotos">' + thumbs(ex ? ex.files : [], ex ? 'ckfile' : '')
        + thumbs((D.gphotos || []).map(function (p, k) { return { dataUrl: p.dataUrl, tmp: 'g:' + k }; }), 'gtmp') + shotBtns('gshot', '1', 'ปัญหาที่พบ') + '</div></div>'
        + T('wFix', 'แนวทางการแก้ไข (ไม่บังคับ)', D.fix) + inspectorField('wInsp2') + '</div></div>'
      + datalist('sDepts', depts)
      + '<div class="ssave"><button class="btn btn-primary" id="wSave">' + icon('check', 18) + (ex ? ' บันทึกการแก้ไข รอบที่ ' : ' บันทึกผลตรวจรอบที่ ') + w.round + '</button>' + (ex ? '<button class="btn btn-line" id="wDel">' + icon('trash', 16) + ' ลบผลรอบนี้</button>' : '') + '</div>';
    $('main').innerHTML = html;
    var keep = function () { var c = Object.assign({}, D); delete c.photos; store(draftKey(), JSON.stringify(c)); };
    $('wBack').addEventListener('click', function () { w.round = 0; w.draft = null; walk(); });
    $('wAllP').addEventListener('click', function () { items.forEach(function (it) { if (!D.results[it.id]) D.results[it.id] = 'P'; }); keep(); walkForm(a); });
    on('[data-res]', 'click', function (el) {
      var id = el.getAttribute('data-it'), r = el.getAttribute('data-res');
      D.results[id] = D.results[id] === r ? '' : r;
      if (!D.results[id]) delete D.results[id];
      keep(); var y = window.scrollY; walkForm(a); window.scrollTo(0, y);
      if (r === 'O' && D.results[id] === 'O' && !linked[id] && !(prev[id] && !D.fresh[id]) && !(D.photos[id] || []).length) setTimeout(function () { var b = document.querySelector('[data-shot="' + id + '"]'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
    }, $('main'));
    on('[data-ff]', 'input', function (el) { var id = el.getAttribute('data-it'); D.fails[id] = D.fails[id] || {}; D.fails[id][el.getAttribute('data-ff')] = el.value; keep(); }, $('main'));
    on('[data-fresh]', 'click', function (el) { var id = el.getAttribute('data-fresh'); D.fresh[id] = !D.fresh[id]; keep(); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, $('main'));
    on('[data-risk]', 'click', function (el) { var id = el.getAttribute('data-it'); D.fails[id] = D.fails[id] || {}; D.fails[id].risk = el.getAttribute('data-risk'); keep(); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, $('main'));
    on('[data-shot]', 'click', function (el) {
      var id = el.getAttribute('data-shot');
      pickPhotos(function (arr) { D.photos[id] = (D.photos[id] || []).concat(arr).slice(0, 6); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, el.getAttribute('data-src') === 'cam');
    }, $('main'));
    on('[data-del="tmp"]', 'click', function (el) { var p = el.getAttribute('data-fid').split(':'); (D.photos[p[0]] || []).splice(+p[1], 1); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, $('main'));
    on('[data-fd]', 'click', function (el) { var f = H.data.findings.filter(function (x) { return x.id === el.getAttribute('data-fd'); })[0]; if (f) findingModal(f); }, $('main'));
    on('[data-gshot]', 'click', function (el) {
      pickPhotos(function (arr) { D.gphotos = (D.gphotos || []).concat(arr).slice(0, 6); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, el.getAttribute('data-src') === 'cam');
    }, $('main'));
    on('[data-del="gtmp"]', 'click', function (el) { D.gphotos.splice(+el.getAttribute('data-fid').split(':')[1], 1); var y = window.scrollY; walkForm(a); window.scrollTo(0, y); }, $('main'));
    on('[data-del="ckfile"]', 'click', function (el) {
      ask('ลบรูปนี้?').then(function (ok) { if (!ok) return;
      call('sheRemoveFile', state.token, 'check', ex.id, 'files', el.getAttribute('data-fid')).then(function (r) {
        if (!r.ok) return toast(r.error);
        ex.files = r.files; var y = window.scrollY; walkForm(a); window.scrollTo(0, y);
      }).catch(onServerError); });
    }, $('main'));
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
      var reps = items.filter(function (it) { return D.results[it.id] === 'O' && !linked[it.id] && prev[it.id] && !D.fresh[it.id]; }).map(function (it) { return prev[it.id].id; });
      var nf = items.filter(function (it) { return D.results[it.id] === 'O' && !linked[it.id] && !(prev[it.id] && !D.fresh[it.id]); }).map(function (it) {
        var fl = D.fails[it.id] || {};
        return { itemId: it.id, problem: fl.problem || it.detail, dept: fl.dept || '', responsible: fl.responsible || '', risk: fl.risk || 'M', dueDate: fl.dueDate || addDays(w.date, 7), recommendation: fl.recommendation || '' };
      });
      var btn = $('wSave'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก…';
      call('sheSaveCheck', state.token, { id: ex ? ex.id : '', date: w.date, areaId: a.id, round: w.round, results: D.results, problem: D.problem, fix: D.fix, inspector: w.inspector }, nf, reps).then(function (r) {
        if (!r.ok) throw new Error(r.error);
        var jobs = [];
        r.findings.forEach(function (f) { (D.photos[f.itemId] || []).forEach(function (p) { jobs.push(['finding', f.id, 'before', p]); }); });
        (D.gphotos || []).forEach(function (p) { jobs.push(['check', r.check.id, 'files', p]); });
        return uploadAll(jobs).then(function (fails) {
          store(draftKey(), null);
          var n = r.findings.length;
          w.round = 0; w.draft = null;
          reload('บันทึกผลตรวจแล้ว' + (n ? ' · สร้างรายการข้อบกพร่อง ' + n + ' รายการ' : '') + ((r.repeated || []).length ? ' · ข้อบกพร่องเดิมพบซ้ำ ' + r.repeated.length + ' รายการ' : '') + (fails ? ' · อัปโหลดรูปไม่สำเร็จ ' + fails + ' รูป (เพิ่มได้ที่หน้าข้อบกพร่อง)' : ''));
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
      + dupHtml()
      + '<div class="sfinds">' + (rows.map(function (f) {
        var b = f.beforeFiles[0], a2 = f.afterFiles[0];
        return '<button class="sfind" data-fd="' + f.id + '"><div class="sfimg">' + (b ? '<img src="' + img(b.id, 300) + '" alt="" loading="lazy">' : '<div class="snoimg">ไม่มีรูปก่อน</div>') + (a2 ? '<img class="aft" src="' + img(a2.id, 300) + '" alt="" loading="lazy">' : '') + '</div>'
          + '<div class="sfinfo"><div><span class="sedit" style="float:right">' + icon('edit', 15) + ' แก้ไข</span><b>' + esc(f.code) + '</b> · ' + dd(f.date) + ' · ' + esc(f.location) + ' ' + stTag(f) + ' ' + riskTag(f.risk) + '</div><div class="sfp">' + esc(f.problem) + '</div>'
          + '<small>' + esc([f.dept, f.responsible ? 'ผู้รับผิดชอบ ' + f.responsible : '', f.status === 'done' ? 'เสร็จ ' + dd(f.doneDate) : f.dueDate ? 'กำหนด ' + dd(f.dueDate) : ''].filter(String).join(' · ')) + '</small>'
          + (seenText(f) ? '<small class="sseen">🔁 ' + esc(seenText(f)) + '</small>' : '') + '</div></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ</div>') + '</div>';
    on('[data-fst]', 'click', function (el) { q.fst = el.getAttribute('data-fst'); findings(); }, $('main'));
    $('fq').addEventListener('input', function () { q.fq = $('fq').value; clearTimeout(H.ft); H.ft = setTimeout(function () { findings(); var e = $('fq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('fArea').addEventListener('change', function () { q.farea = $('fArea').value; findings(); });
    $('fNew').addEventListener('click', function () { findingModal(null); });
    on('[data-merge]', 'click', function (el) {
      var g = dupGroups()[+el.getAttribute('data-merge')]; if (!g) return;
      var keep = g[0];
      ask({ title: 'รวม ' + g.length + ' รายการให้เหลือรายการเดียว?', text: 'เก็บ ' + keep.code + ' (ล่าสุด) ไว้ · ' + g.slice(1).map(function (x) { return x.code; }).join(', ') + ' จะถูกรวมเข้าไป\nวันที่พบครั้งแรก จำนวนครั้งที่พบ และรูป จะรวมไว้ในรายการเดียว', ok: 'รวมรายการ' }).then(function (ok) {
        if (!ok) return;
        el.disabled = true;
        call('sheMergeFindings', state.token, keep.id, g.slice(1).map(function (x) { return x.id; })).then(function (r) {
          if (!r.ok) { el.disabled = false; return toast(r.error); }
          reload('รวมรายการแล้ว');
        }).catch(onServerError);
      });
    }, $('main'));
    on('[data-fd]', 'click', function (el) { findingModal(H.data.findings.filter(function (x) { return x.id === el.getAttribute('data-fd'); })[0]); }, $('main'));
  }
  // กลุ่มข้อบกพร่องที่ยังไม่แก้ซ้ำกัน (พื้นที่ + หัวข้อตรวจเดียวกัน) — ใหม่สุดก่อน
  function dupGroups() {
    var by = {};
    H.data.findings.forEach(function (f) { if (f.status === 'done' || !f.itemId) return; var k = f.areaId + '|' + f.itemId; (by[k] = by[k] || []).push(f); });
    return Object.keys(by).map(function (k) { return by[k].sort(seenSort); }).filter(function (g) { return g.length > 1; });
  }
  function dupHtml() {
    var gs = dupGroups(); if (!gs.length) return '';
    return '<div class="panel sdup"><b>🔁 พบรายการซ้ำ ' + gs.length + ' กลุ่ม</b> — ข้อบกพร่องเดิมถูกบันทึกใหม่ทุกรอบที่ตรวจ รวมให้เหลือรายการเดียวได้ (เก็บรายการล่าสุดไว้)'
      + gs.map(function (g, k) { return '<div class="sdupr"><span>' + esc(g[0].location) + ' · ' + esc(g[0].problem) + '<small>' + g.map(function (x) { return x.code; }).join(', ') + '</small></span><button class="btn btn-sm btn-line" data-merge="' + k + '">รวม ' + g.length + ' รายการ</button></div>'; }).join('') + '</div>';
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
        ask('ลบรูปนี้?').then(function (ok) { if (!ok) return;
        call('sheRemoveFile', state.token, 'finding', f.id, slot, fid).then(function (r) {
          if (!r.ok) return toast(r.error);
          if (slot === 'before') f.beforeFiles = r.files; else f.afterFiles = r.files;
          gallery(); H.data.findings.forEach(function (x) { if (x.id === f.id) { x.beforeFiles = f.beforeFiles; x.afterFiles = f.afterFiles; } });
        }).catch(onServerError); });
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
          + '<small>' + esc([x.location, x.person, x.injury, x.lostDays ? 'หยุดงาน ' + x.lostDays + ' วัน' : ''].filter(String).join(' · ')) + '</small></div>' + (x.files.length ? '<img class="sinc-img" src="' + img(x.files[0].id, 200) + '" alt="">' : '') + '<span class="sedit">' + icon('edit', 16) + ' แก้ไข</span></button>';
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
        ask('ลบรูปนี้?').then(function (ok) { if (!ok) return;
        call('sheRemoveFile', state.token, 'incident', x.id, 'files', el.getAttribute('data-fid')).then(function (r) { if (!r.ok) return toast(r.error); x.files = r.files; gallery(); }).catch(onServerError); });
      }, $('mBody'));
    }
    wide({
      icon: 'alert', title: isNew ? 'บันทึกเหตุการณ์' : 'เหตุการณ์ ' + dd(x.date), sub: 'อุบัติเหตุ / เกือบเกิดเหตุ',
      body: '<div class="pform">' + F('iDate', 'วันที่เกิดเหตุ *', x.date, 'date') + F('iTime', 'เวลา', x.time, 'time')
        + S('iType', 'ประเภท *', Object.keys(INC).map(function (k) { return [k, INC[k]]; }), x.type)
        + S('iArea', 'พื้นที่', [['', '— อื่นๆ —']].concat(H.data.areas.map(function (a) { return [a.id, a.name]; })), x.areaId || '')
        + F('iLoc', 'สถานที่ (ระบุจุด)', x.location) + F('iPerson', 'ผู้ประสบเหตุ', x.person) + F('iDept', 'แผนก', x.dept, 'text', ' list="sDepts3"') + datalist('sDepts3', list(H.data.settings.depts))
        + F('iLost', 'จำนวนวันหยุดงาน', x.lostDays, 'number', ' min="0"') + T('iInj', 'การบาดเจ็บ / ความเสียหาย', x.injury) + T('iCause', 'สาเหตุ', x.cause)
        + T('iAct', 'การแก้ไข / มาตรการป้องกัน', x.action) + F('iRep', 'ผู้รายงาน', x.reporter || store('inspector') || inspectors()[0]) + '</div>'
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

  // ==================== แบบรายงานสิ่งผิดปกติ (ABNORMALITY REPORT) — จากไฟล์ Word ของผู้ใช้ (27/11/69) ====================
  var AB_BUILD = ['G1', 'G2', 'G3', 'G4', 'G5', 'other'];
  var AB_TOPIC = { safety: 'ความปลอดภัย', machine: 'เครื่องจักร', elec: 'ไฟฟ้า', building: 'อาคาร / สถานที่', chem: 'สารเคมี / ก๊าซ', fire: 'อัคคีภัย', env: 'สิ่งแวดล้อม', other: 'อื่น ๆ' };
  var AB_INIT = { none: 'ยังไม่ได้ดำเนินการ', notify: 'แจ้งหัวหน้างาน', fence: 'กั้นพื้นที่ / หยุดใช้งาน', fixed: 'แก้ไขเบื้องต้นแล้ว' };
  var AB_ST = { open: ['รอดำเนินการ', '#dc2626'], prog: ['กำลังแก้ไข', '#d97706'], fail: ['ตรวจแล้ว ยังไม่เรียบร้อย', '#b91c1c'], done: ['แก้ไขเรียบร้อย · ปิดรายงาน', '#16a34a'] };
  function abSt(x) { return x.result === 'ok' ? 'done' : x.result === 'fail' ? 'fail' : (x.responsible || x.fixPlan || x.doneDate) ? 'prog' : 'open'; }
  function abLate(x) { return abSt(x) !== 'done' && x.dueDate && x.dueDate < H.data.today; }
  function abPlace(x) { return [x.building === 'other' ? (x.buildingOther || 'อื่น ๆ') : x.building, x.spot].filter(String).join(' · '); }
  function abTopics(x) { return (x.topics || []).map(function (k) { return k === 'other' ? 'อื่น ๆ' + (x.topicOther ? ': ' + x.topicOther : '') : AB_TOPIC[k]; }).join(', '); }
  function abnormals() {
    var q = H.q, rows = H.data.abnormals || [];
    q.abf = q.abf || 'pending';
    var test = { pending: function (x) { return abSt(x) !== 'done'; }, late: abLate, done: function (x) { return abSt(x) === 'done'; }, all: function () { return true; } };
    var show = rows.filter(test[q.abf]);
    $('main').innerHTML = '<h3>รายงานสิ่งผิดปกติ (Abnormality Report)</h3>'
      + '<div class="kpis">' + [[rows.length, 'รายงานทั้งหมด', '#475569'], [rows.filter(function (x) { return abSt(x) === 'open'; }).length, 'รอดำเนินการ', '#dc2626'],
        [rows.filter(function (x) { return abSt(x) === 'prog' || abSt(x) === 'fail'; }).length, 'กำลังแก้ไข', '#d97706'], [rows.filter(abLate).length, 'เกินกำหนดแล้วเสร็จ', '#b91c1c'],
        [rows.filter(function (x) { return abSt(x) === 'done'; }).length, 'แก้ไขเรียบร้อย', '#16a34a']]
        .map(function (k) { return '<div class="kpi" style="--k:' + k[2] + '"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>'; }).join('') + '</div>'
      + '<div class="pbar"><div class="pchips" style="margin:0;flex:1">' + [['pending', 'ยังไม่ปิด'], ['late', 'เกินกำหนด'], ['done', 'แก้ไขเรียบร้อย'], ['all', 'ทั้งหมด']].map(function (c) {
          return '<button class="chip' + (q.abf === c[0] ? ' on' : '') + '" data-abf="' + c[0] + '">' + c[1] + ' (' + rows.filter(test[c[0]]).length + ')</button>'; }).join('') + '</div>'
      + '<button class="btn btn-sm btn-primary" id="abNew">' + icon('plus', 16) + ' แจ้งสิ่งผิดปกติ</button></div>'
      + '<div class="plist">' + (show.map(function (x) {
        var st = AB_ST[abSt(x)];
        return '<button class="prow click" data-ab="' + x.id + '"><div class="pinfo"><b>' + esc(x.code) + ' · ' + dd(x.reportDate) + ' · <span class="sabst" style="--s:' + st[1] + '">' + st[0] + '</span>' + (abLate(x) ? ' <span class="sabst" style="--s:#b91c1c">เกินกำหนด</span>' : '') + '</b>'
          + '<small>' + esc([abPlace(x), abTopics(x)].filter(String).join(' · ')) + '</small><small class="sab1">' + esc(x.detail) + '</small>'
          + '<small>' + esc(['แจ้งโดย ' + x.reporter + (x.reporterDept ? ' (' + x.reporterDept + ')' : ''), x.responsible ? 'ผู้รับผิดชอบ ' + x.responsible : '', x.dueDate ? 'กำหนดเสร็จ ' + dd(x.dueDate) : ''].filter(String).join(' · ')) + '</small></div>'
          + (x.files.length ? '<img class="sinc-img" src="' + img(x.files[0].id, 200) + '" alt="">' : '') + '<span class="sedit">' + icon('edit', 16) + ' เปิด</span></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ</div>') + '</div>';
    on('[data-abf]', 'click', function (el) { q.abf = el.getAttribute('data-abf'); abnormals(); }, $('main'));
    $('abNew').addEventListener('click', function () { abModal(null); });
    on('[data-ab]', 'click', function (el) { abModal(rows.filter(function (x) { return x.id === el.getAttribute('data-ab'); })[0]); }, $('main'));
  }
  function abChecks(name, dict, picked, radio) {
    return '<div class="sabchk">' + Object.keys(dict).map(function (k) {
      return '<label><input type="' + (radio ? 'radio' : 'checkbox') + '" name="' + name + '" value="' + k + '"' + (picked.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(dict[k]) + '</label>';
    }).join('') + '</div>';
  }
  function abSec(n, title, body) { return '<div class="sabsec"><div class="sabh">' + n + '. ' + title + '</div><div class="pform">' + body + '</div></div>'; }
  function abModal(x) {
    var isNew = !x, pend = [];
    x = x || { reportDate: H.data.today, reporter: store('abReporter'), reporterDept: store('abDept'), building: '', topics: [], initial: [], files: [] };
    var bdict = {}; AB_BUILD.forEach(function (b) { bdict[b] = b === 'other' ? 'อื่น ๆ' : b; });
    function gallery() {
      $('g_ab').innerHTML = thumbs(x.files, isNew ? '' : 'files') + thumbs(pend.map(function (p, k) { return { dataUrl: p.dataUrl, tmp: 'i:' + k }; }), 'tmp') + shotBtns('pick', '1', '');
      on('[data-pick]', 'click', function (el) { pickPhotos(function (arr) { pend = pend.concat(arr).slice(0, 6); gallery(); }, el.getAttribute('data-src') === 'cam'); }, $('g_ab'));
      on('[data-del="tmp"]', 'click', function (el) { pend.splice(+el.getAttribute('data-fid').split(':')[1], 1); gallery(); }, $('g_ab'));
      on('[data-del="files"]', 'click', function (el) {
        ask('ลบรูปนี้?').then(function (ok) { if (!ok) return;
          call('sheRemoveFile', state.token, 'abnormal', x.id, 'files', el.getAttribute('data-fid')).then(function (r) { if (!r.ok) return toast(r.error); x.files = r.files; gallery(); }).catch(onServerError); });
      }, $('g_ab'));
    }
    var picked = function (name) { return Array.prototype.map.call(document.querySelectorAll('#mBody input[name="' + name + '"]:checked'), function (i) { return i.value; }); };
    wide({
      icon: 'warn', title: isNew ? 'แจ้งสิ่งผิดปกติ' : 'รายงานสิ่งผิดปกติ ' + x.code, sub: 'แบบรายงานสิ่งผิดปกติ · ABNORMALITY REPORT',
      body: '<div class="pform">' + (isNew ? '<div class="pf"><label>เลขที่รายงาน</label><input value="ระบบออกเลขให้เมื่อบันทึก" disabled></div>' : '<div class="pf"><label>เลขที่รายงาน</label><input value="' + esc(x.code) + '" disabled></div>')
          + F('abDate', 'วันที่แจ้ง *', x.reportDate, 'date') + '</div>'
        + abSec(1, 'ผู้แจ้ง', F('abRep', 'ชื่อ-สกุล *', x.reporter) + F('abRDept', 'แผนก', x.reporterDept, 'text', ' list="sDeptsAb"') + datalist('sDeptsAb', list(H.data.settings.depts)))
        + abSec(2, 'สถานที่พบสิ่งผิดปกติ', '<div class="pf full"><label>อาคาร</label>' + abChecks('abB', bdict, [x.building], true) + '</div>'
          + '<div class="pf' + (x.building === 'other' ? '' : ' hidden') + '" id="abBOw">' + '<label for="abBO">อาคารอื่น ๆ (ระบุ)</label><input id="abBO" value="' + esc(x.buildingOther || '') + '"></div>'
          + '<div class="pf full"><label for="abSpot">บริเวณ / จุดที่พบ</label><input id="abSpot" value="' + esc(x.spot || '') + '"></div>')
        + abSec(3, 'หัวข้อสิ่งผิดปกติ', '<div class="pf full">' + abChecks('abT', AB_TOPIC, x.topics) + '</div><div class="pf full' + (x.topics.indexOf('other') >= 0 ? '' : ' hidden') + '" id="abTOw"><label for="abTO">หัวข้ออื่น ๆ (ระบุ)</label><input id="abTO" value="' + esc(x.topicOther || '') + '"></div>')
        + abSec(4, 'รายละเอียดสิ่งผิดปกติที่พบ', T('abDet', 'รายละเอียด *', x.detail, 'พบอะไร ที่ไหน อันตรายอย่างไร'))
        + '<div class="sabsec"><div class="sabh">5. ภาพประกอบ</div><div class="sphotos" id="g_ab"></div><p class="muted" style="margin:6px 0 0;font-size:12.5px">มีรูป = "มีภาพประกอบ" · ไม่มีรูป = "ไม่มีภาพประกอบ" (ระบบติ๊กในแบบฟอร์มให้เอง)</p></div>'
        + abSec(6, 'การดำเนินการเบื้องต้น', '<div class="pf full">' + abChecks('abI', AB_INIT, x.initial) + '</div>' + T('abIN', 'รายละเอียดเพิ่มเติม (ถ้ามี)', x.initialNote))
        + abSec(7, 'สำหรับผู้รับผิดชอบดำเนินการ', F('abResp', 'หน่วยงาน / ผู้รับผิดชอบ', x.responsible) + T('abPlan', 'แนวทางการแก้ไข', x.fixPlan)
          + F('abDue', 'กำหนดแล้วเสร็จ', x.dueDate, 'date') + F('abDone', 'วันที่แก้ไขเสร็จ', x.doneDate, 'date'))
        + abSec(8, 'ผลการตรวจสอบและปิดรายงาน', '<div class="pf full">' + abChecks('abRes', { '': 'ยังไม่ตรวจสอบ', ok: 'แก้ไขเรียบร้อย', fail: 'ยังไม่เรียบร้อย / ต้องแก้ไขเพิ่มเติม' }, [x.result || ''], true) + '</div>'
          + F('abVer', 'ผู้ตรวจสอบ', x.verifier || '', 'text', ' list="sInspAb"') + datalist('sInspAb', inspectors()) + F('abVD', 'วันที่ตรวจสอบ', x.verifyDate, 'date'))
        + '<p class="sabnote">หมายเหตุ: หากพบเหตุฉุกเฉินหรืออันตรายร้ายแรง ให้แจ้งหัวหน้างานและผู้เกี่ยวข้องทันที ไม่ต้องรอการบันทึกในระบบ</p>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn" id="abPrint">' + icon('print', 16) + ' พิมพ์แบบฟอร์ม / PDF</button><button type="button" class="link-btn danger" id="abDel">' + icon('trash', 16) + ' ลบรายงานนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        gallery();
        on('input[name="abB"]', 'change', function () { $('abBOw').classList.toggle('hidden', picked('abB')[0] !== 'other'); }, $('mBody'));
        on('input[name="abT"]', 'change', function () { $('abTOw').classList.toggle('hidden', picked('abT').indexOf('other') < 0); }, $('mBody'));
        on('input[name="abI"]', 'change', function (el) {   // "ยังไม่ได้ดำเนินการ" เลือกคู่กับข้ออื่นไม่ได้
          if (!el.checked) return;
          Array.prototype.forEach.call(document.querySelectorAll('#mBody input[name="abI"]'), function (i) { if (i !== el && (el.value === 'none' || i.value === 'none')) i.checked = false; });
        }, $('mBody'));
        $('abVD').addEventListener('focus', function () { if (!$('abVD').value && picked('abRes')[0]) $('abVD').value = H.data.today; });
        if (!isNew) {
          $('abPrint').addEventListener('click', function () { closeModal(); H.q.rep = 'ab'; H.q.abId = x.id; go('s_rep'); });
          $('abDel').addEventListener('click', function () { confirmBox('ลบรายงาน ' + x.code + ' และรูปทั้งหมด?', function () { return call('sheDeleteAbnormal', state.token, x.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); }); });
        }
      },
      submit: function () {
        var res = picked('abRes')[0] || '';
        if (res && !v('abVer')) return Promise.resolve('ใส่ชื่อผู้ตรวจสอบก่อนปิดรายงาน');
        store('abReporter', v('abRep')); store('abDept', v('abRDept'));
        return call('sheSaveAbnormal', state.token, { id: x.id || '', reportDate: v('abDate'), reporter: v('abRep'), reporterDept: v('abRDept'), building: picked('abB')[0] || '', buildingOther: v('abBO'),
          spot: v('abSpot'), topics: picked('abT'), topicOther: v('abTO'), detail: v('abDet'), initial: picked('abI'), initialNote: v('abIN'), responsible: v('abResp'), fixPlan: v('abPlan'),
          dueDate: v('abDue'), doneDate: v('abDone'), result: res, verifier: v('abVer'), verifyDate: v('abVD') || (res ? H.data.today : '') }).then(function (r) {
          if (!r.ok) return r.error;
          return uploadAll(pend.map(function (p) { return ['abnormal', r.abnormal.id, 'files', p]; })).then(function (fails) { closeModal(); reload((isNew ? 'บันทึกแล้ว เลขที่ ' + r.abnormal.code : 'บันทึกแล้ว') + (fails ? ' · อัปโหลดรูปไม่สำเร็จ ' + fails + ' รูป' : '')); });
        });
      }
    });
  }
  // แบบฟอร์มพิมพ์ A4 แนวตั้ง — วางเหมือนไฟล์ Word (หัวข้อ 1–8 ช่อง ☐ / ☑)
  function abHtml(x) {
    var bx = function (on) { return '<span class="sabx">' + (on ? '☑' : '☐') + '</span>'; }, line = function (t) { return t ? '<b>' + esc(t) + '</b>' : '<span class="sabdot"></span>'; };
    var row = function (a) { return '<tr><td colspan="2">' + a + '</td></tr>'; }, h = function (t) { return '<tr><th colspan="2">' + t + '</th></tr>'; };
    return '<div class="sreport sabform"><div class="sabtitle"><b>แบบรายงานสิ่งผิดปกติ</b><span>ABNORMALITY REPORT</span></div><table class="sabt">'
      + '<tr><td>เลขที่รายงาน: ' + line(x.code) + '</td><td>วันที่แจ้ง: ' + line(thDate(x.reportDate)) + '</td></tr>'
      + h('1. ผู้แจ้ง') + '<tr><td>ชื่อ-สกุล: ' + line(x.reporter) + '</td><td>แผนก: ' + line(x.reporterDept) + '</td></tr>'
      + h('2. สถานที่พบสิ่งผิดปกติ') + row('อาคาร: ' + AB_BUILD.map(function (b) { return bx(x.building === b) + (b === 'other' ? ' อื่น ๆ ' + line(x.buildingOther) : ' ' + b); }).join(' &nbsp; '))
      + row('บริเวณ / จุดที่พบ: ' + line(x.spot))
      + h('3. หัวข้อสิ่งผิดปกติ') + row(Object.keys(AB_TOPIC).map(function (k) { return bx(x.topics.indexOf(k) >= 0) + ' ' + AB_TOPIC[k] + (k === 'other' ? ' ' + line(x.topicOther) : ''); }).join(' &nbsp; '))
      + h('4. รายละเอียดสิ่งผิดปกติที่พบ') + row('<div class="sabbox">' + esc(x.detail || '') + '</div>')
      + h('5. ภาพประกอบ') + row(bx(x.files.length) + ' มีภาพประกอบ &nbsp; ' + bx(!x.files.length) + ' ไม่มีภาพประกอบ'
        + (x.files.length ? '<div class="sabpics">' + x.files.slice(0, 4).map(function (f) { return '<img src="' + img(f.id, 700) + '" alt="">'; }).join('') + '</div>' : ''))
      + h('6. การดำเนินการเบื้องต้น') + row(Object.keys(AB_INIT).map(function (k) { return bx(x.initial.indexOf(k) >= 0) + ' ' + AB_INIT[k]; }).join(' &nbsp; '))
      + row('รายละเอียดเพิ่มเติม (ถ้ามี): ' + line(x.initialNote))
      + h('7. สำหรับผู้รับผิดชอบดำเนินการ') + row('หน่วยงาน / ผู้รับผิดชอบ: ' + line(x.responsible)) + row('แนวทางการแก้ไข: ' + line(x.fixPlan))
      + '<tr><td>กำหนดแล้วเสร็จ: ' + line(x.dueDate ? thDate(x.dueDate) : '') + '</td><td>วันที่แก้ไขเสร็จ: ' + line(x.doneDate ? thDate(x.doneDate) : '') + '</td></tr>'
      + h('8. ผลการตรวจสอบและปิดรายงาน') + row(bx(x.result === 'ok') + ' แก้ไขเรียบร้อย &nbsp; ' + bx(x.result === 'fail') + ' ยังไม่เรียบร้อย / ต้องแก้ไขเพิ่มเติม')
      + '<tr><td>ผู้ตรวจสอบ: ' + line(x.verifier) + '</td><td>วันที่: ' + line(x.verifyDate ? thDate(x.verifyDate) : '') + '</td></tr>'
      + '</table><p class="sabnote2">หมายเหตุ: หากพบเหตุฉุกเฉินหรืออันตรายร้ายแรง ให้แจ้งหัวหน้างานและผู้เกี่ยวข้องทันที ไม่ต้องรอการบันทึกในระบบ</p></div>';
  }

  // ==================== รายงาน / พิมพ์ PDF ====================
  function report() {
    var q = H.q, t = H.data.today;
    q.rep = q.rep || 'f05';
    if (!q.rFrom) { q.rFrom = t.slice(0, 8) + '01'; q.rTo = t; }
    if (!q.rYm) q.rYm = t.slice(0, 7);
    if (!q.rArea) q.rArea = (activeAreas()[0] || {}).id || '';
    var areaOpts = H.data.areas.map(function (a) { return '<option value="' + a.id + '"' + (q.rArea === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('');
    var mf = /^m/.test(q.rep) ? q.rep.slice(1) : '';
    var abl = H.data.abnormals || [];
    if (q.rep === 'ab' && !q.abId && abl.length) q.abId = abl[0].id;
    var ctl = q.rep === 'ab' ? '<select id="rAb">' + (abl.map(function (x) { return '<option value="' + x.id + '"' + (q.abId === x.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + dd(x.reportDate) + ' · ' + String(x.detail).slice(0, 40)) + '</option>'; }).join('') || '<option value="">ยังไม่มีรายงาน — พิมพ์แบบฟอร์มเปล่า</option>') + '</select>'
      : mf ? '<label class="pchk">เดือน <input type="month" id="rYm" value="' + q.rYm + '"></label>' : q.rep === 'f05'
      ? '<label class="pchk">ตั้งแต่ <input type="date" id="rFrom" value="' + q.rFrom + '"></label><label class="pchk">ถึง <input type="date" id="rTo" value="' + q.rTo + '"></label>'
        + '<select id="rArea5"><option value="">ทุกพื้นที่</option>' + H.data.areas.map(function (a) { return '<option value="' + a.id + '"' + (q.r5Area === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>'
        + '<select id="rSt"><option value="">ทุกสถานะ</option><option value="pending"' + (q.rSt === 'pending' ? ' selected' : '') + '>ค้างแก้ไข</option><option value="done"' + (q.rSt === 'done' ? ' selected' : '') + '>แก้ไขเรียบร้อย</option></select>'
      : '<label class="pchk">เดือน <input type="month" id="rYm" value="' + q.rYm + '"></label><select id="rArea">' + areaOpts + '</select>';
    $('main').innerHTML = '<h3>รายงาน / พิมพ์ PDF</h3><p class="lead">กด "พิมพ์ / บันทึก PDF" แล้วเลือก "บันทึกเป็น PDF" (บน iPad: พิมพ์ → แตะแชร์ → บันทึกไปยังไฟล์) · กระดาษ A4 ตามแบบฟอร์ม (แนวนอน / แนวตั้ง)</p>'
      + '<div class="pchips noprint">' + [['f05', 'FM-SHE-01-05 สรุปรายงานสำรวจตรวจสอบ'], ['f06', 'FM-SHE-01-06 แบบตรวจความปลอดภัย (รายเดือน)'], ['ab', 'แบบรายงานสิ่งผิดปกติ (Abnormality)']].concat(Object.keys(SHEM).map(function (k) { return ['m' + k, 'FM-SHE-' + k + ' ' + SHEM[k].name]; })).map(function (c) { return '<button class="chip' + (q.rep === c[0] ? ' on' : '') + '" data-rep="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
      + '<div class="pbar noprint">' + ctl + '<button class="btn btn-sm btn-primary" id="rGo">ดูรายงาน</button><button class="btn btn-sm btn-line" id="rPrint">' + icon('print', 16) + ' พิมพ์ / บันทึก PDF</button></div>'
      + '<div id="rOut"></div>';
    on('[data-rep]', 'click', function (el) { q.rep = el.getAttribute('data-rep'); report(); }, $('main'));
    $('rPrint').addEventListener('click', function () {
      if (!$('rOut').innerHTML) return toast('กด "ดูรายงาน" ก่อน');
      var old = document.title; document.title = q.rep === 'ab' ? 'แบบรายงานสิ่งผิดปกติ_' + ((abl.filter(function (x) { return x.id === q.abId; })[0] || {}).code || 'เปล่า') : mf ? 'FM-SHE-' + mf + '_' + q.rYm : q.rep === 'f05' ? 'FM-SHE-01-05_' + q.rFrom + '_' + q.rTo : 'FM-SHE-01-06_' + ((area(q.rArea) || {}).name || '') + '_' + q.rYm;
      window.print(); setTimeout(function () { document.title = old; }, 1500);
    });
    $('rGo').addEventListener('click', function () {
      if (q.rep === 'ab') q.abId = v('rAb');
      else if (mf) q.rYm = v('rYm');
      else if (q.rep === 'f05') { q.rFrom = v('rFrom'); q.rTo = v('rTo'); q.r5Area = v('rArea5'); q.rSt = v('rSt'); } else { q.rYm = v('rYm'); q.rArea = v('rArea'); }
      runReport();
    });
    runReport();
  }
  function runReport() {
    var q = H.q;
    $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
    if (q.rep === 'ab') {   // แบบรายงานสิ่งผิดปกติ: A4 แนวตั้ง จากข้อมูลในหน้า (ไม่ต้องโหลดใหม่)
      landscape(false);
      var ab = (H.data.abnormals || []).filter(function (x) { return x.id === q.abId; })[0] || { code: '', reportDate: '', topics: [], initial: [], files: [] };
      $('rOut').innerHTML = abHtml(ab);
      return;
    }
    if (/^m/.test(q.rep)) {
      var form = q.rep.slice(1); landscape(!!SHEM[form].land);
      return call('sheMonthly', state.token, q.rYm).then(function (r) {
        if (!r.ok) { $('rOut').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
        $('rOut').innerHTML = stmHtml(form, r.records[form], r.fm[form], r.ym) + (r.records[form] ? '' : '<p class="muted noprint">ยังไม่ได้บันทึกผลตรวจเดือนนี้ — พิมพ์เป็นแบบฟอร์มเปล่าได้</p>');
      }).catch(onServerError);
    }
    landscape(true);
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
    var gimgs = [];
    r.checks.slice().sort(function (x, y2) { return String(x.date + x.round).localeCompare(String(y2.date + y2.round)); }).forEach(function (c) {
      (c.files || []).forEach(function (f) { gimgs.push({ id: f.id, cap: +c.date.slice(8, 10) + '/' + m + ' ร.' + c.round }); });
    });
    var insp = r.checks.map(function (c) { return c.inspector; }).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; }).join(', ');
    var head = '<div class="shead s6">' + logoHtml() + '<div class="sco"><b>' + COMPANY_TH + '</b><span>' + COMPANY_EN + '</span></div><div class="stitle">' + esc(a.title) + '</div><div class="sfm">' + esc(s.fm06).replace(' วันที่', '<br>วันที่') + '</div></div>';
    var cols = '<colgroup><col style="width:2.6%"><col style="width:8.6%"><col style="width:17.5%"><col style="width:3.3%">' + new Array(32).join('<col style="width:2.193%">') + '</colgroup>';
    var body = '<table class="st06">' + cols + '<thead><tr><td colspan="' + (4 + 31) + '" class="smonths">เดือน&nbsp;&nbsp; ' + monthsRow + '&nbsp;&nbsp;&nbsp; ปี พ.ศ. ' + (y + 543) + '</td></tr>'
      + '<tr><th class="c">ลำดับ</th><th>หมวด</th><th>รายละเอียด</th><th class="c">ความถี่</th>' + dayHead + '</tr></thead><tbody>' + rows
      + '<tr class="sbottom"><td colspan="3"><b>ปัญหาที่พบ</b></td><td colspan="32">' + (probs.map(esc).join(' · ') || '-')
      + (gimgs.length ? '<div class="s6imgs">' + gimgs.map(function (g) { return '<figure><img src="' + img(g.id, 300) + '" alt=""><figcaption>' + esc(g.cap) + '</figcaption></figure>'; }).join('') + '</div>' : '') + '</td></tr>'
      + '<tr class="sbottom"><td colspan="3"><b>แนวทางการแก้ไข</b></td><td colspan="32">' + (fixes.map(esc).join(' · ') || '-') + '</td></tr>'
      + '<tr><td colspan="35" class="snote">หมายเหตุ เลือก ✓ ผ่าน / ✗ ไม่ผ่าน / – ไม่มีหรือไม่เกี่ยวข้องกับพื้นที่ หากพบข้อบกพร่องให้ระบุห้องและบันทึกการแก้ไขด้านล่าง</td></tr></tbody></table>'
      + '<div class="ssign s6"><div><span>' + esc(insp) + '</span>' + esc(s.signCheck) + '</div><div><span></span>' + esc(s.signReview) + '</div></div>';
    return '<div class="sreport"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
  }

  // ==================== ตรวจประจำเดือน FM-SHE-05-04 … 05-08 (ผู้ใช้ขอ 20/11/69) ====================
  // หัวข้อ / ช่อง / ผู้ลงนามตามไฟล์ Excel ของฝ่าย · ผล P ปกติ / X ผิดปกติ / - ไม่มีในรายการ / O อยู่ระหว่างแก้ไข (เฉพาะ 05-07) · API ใน SheMonthly.gs
  var SHEM = {
    '05-04': { name: 'ไฟส่องทางออกฉุกเฉิน', title: 'บันทึกการตรวจสอบไฟส่องทางออกฉุกเฉิน', no: 'ที่', loc: 'สถานที่ติดตั้ง', group: 'ผลการตรวจสอบ',
      items: ['สภาพทั่วไป', 'สัญญาณเตือน', 'สัญญาณไฟ', 'อื่น ๆ'], note: 'หมายเหตุ', ok: '/', rows: 24, legend: 'หมายเหตุ&nbsp;&nbsp; 1.) ผลการตรวจสอบ :&nbsp; <b>/</b> ปกติ ;&nbsp; <b>X</b> ผิดปกติ &nbsp;และ&nbsp; <b>-</b> ไม่มีในรายการนั้น' },
    '05-05': { name: 'ป้ายทางออกฉุกเฉิน', title: 'บันทึกการตรวจสอบป้ายทางออกฉุกเฉิน', no: 'ที่', loc: 'สถานที่ติดตั้ง', group: 'ผลการตรวจสอบ',
      items: ['สภาพทั่วไป', 'ไฟป้าย'], sum: 'สรุปผลการตรวจสอบ', note: 'หมายเหตุ', ok: '/', rows: 26, legend: 'หมายเหตุ&nbsp;&nbsp; 1.) ผลการตรวจสอบ :&nbsp; <b>/</b> ปกติ ;&nbsp; <b>X</b> ผิดปกติ &nbsp;และ&nbsp; <b>-</b> ไม่มีในรายการนั้น' },
    '05-06': { name: 'ประตูทางออกฉุกเฉิน', title: 'บันทึกการตรวจสอบประตูทางออกฉุกเฉิน', no: 'ที่', loc: 'สถานที่ติดตั้ง', group: 'ผลการตรวจสอบ',
      items: ['สภาพทั่วไป', 'สัญญาณเตือน', 'ไฟป้าย', 'สิ่งกีดขวาง', 'บันไดหนีไฟ'], note: 'หมายเหตุ', ok: '/', rows: 25, legend: 'หมายเหตุ&nbsp;&nbsp; 1.) ผลการตรวจสอบ :&nbsp; <b>/</b> ปกติ ;&nbsp; <b>X</b> ผิดปกติ &nbsp;และ&nbsp; <b>-</b> ไม่มีในรายการนั้น' },
    '05-07': { name: 'ปุ่มกดสัญญาณแจ้งเหตุเพลิงไหม้', title: 'บันทึกการตรวจและทดสอบปุ่มกดสัญญาณแจ้งเหตุเพลิงไหม้', no: 'ลำดับ', loc: 'จุดติดตั้ง (Installation Point)', group: 'รายละเอียดการตรวจสอบ (ITEMS INSPECTION)',
      items: ['สภาพจุดที่ติดตั้ง<br><small>(Areal)</small>', 'สภาพภายนอกทั่วไป<br><small>(External Conditions)</small>', 'สวิตช์ปุ่มกด<br><small>(Bottons)</small>', 'สภาพของสายไฟ<br><small>(Conditions Wiring)</small>', 'เสียงดัง<br><small>(Noisc)</small>', 'ไม่มีสิ่งกีดขวาง<br><small>(No Obstacleobjects)</small>'],
      note: 'รายละเอียด / การแก้ไขปรับปรุง (Improvement)', ok: '√', withO: true, rows: 17, land: true, legend: 'หมายเหตุ&nbsp; กรุณาทำเครื่องหมาย :&nbsp;&nbsp; <b>√</b> = ปกติ (Normal)&nbsp;&nbsp;&nbsp; <b>X</b> = ผิดปกติ (Abnormal)&nbsp;&nbsp;&nbsp; <b>O</b> = อยู่ระหว่างการแก้ไข (Improving)' },
    '05-08': { name: 'เครื่องตรวจจับควัน (Smoke Detector)', title: 'บันทึกการตรวจสอบเครื่องตรวจจับควัน(Smoke Detector)', no: 'ลำดับ', loc: 'สถานที่ติดตั้ง', group: 'รายการตรวจสอบ',
      items: ['สภาพภายนอก ไม่มีรอยแตก, ชำรุด, หรือสิ่งสกปรกเกาะ', 'เมื่อฉีดพ่นน้ำยาทดสอบการทำงาน Smoke Detector มีไฟกระพริบติดที่ตัวอุปกรณ์นั้น', 'มีการส่งสัญญาณไปยังห้องควบคุมแสดงจุดที่เกิดการทำงานของ Smoke Detector', 'ทำการ reset จุดแจ้งเตือนที่ปุ่มติดตั้งและห้องควบคุม ได้ตามปกติ'],
      note: 'หมายเหตุ<br>(ระบุให้ชัดเจน)', ok: '✓', rows: 24, smoke: true, legend: 'ผลการตรวจสอบ :&nbsp; <b>✓</b> ปกติ ;&nbsp; <b>X</b> ผิดปกติ &nbsp;และ&nbsp; <b>-</b> ไม่มีในรายการนั้น' }
  };
  var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  function thd(iso) { if (!iso) return ''; var p = String(iso).split('-'); return +p[2] + '/' + +p[1] + '/' + (+p[0] + 543); }
  function mSym(def, c) { return c === 'P' ? def.ok : c === 'X' ? 'X' : c === 'O' ? 'O' : c === '-' ? '-' : ''; }
  function mSum(def, r) { var f = (r || []).slice(0, def.items.length); if (!f.some(String)) return ''; return f.some(function (c) { return c === 'X' || c === 'O'; }) ? 'ไม่ผ่าน' : 'ผ่าน'; }
  function monthly() {
    var q = H.q, t = H.data.today;
    q.mYm = q.mYm || t.slice(0, 7); q.mForm = q.mForm || '05-04';
    $('main').innerHTML = '<h3>ตรวจประจำเดือน</h3><p class="lead">แบบฟอร์มที่ตรวจเดือนละครั้ง (FM-SHE-05-04 … 05-08) · แตะช่องเพื่อเลือกผล · บันทึกแล้วพิมพ์เป็นแบบฟอร์มได้</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด…</div>';
    call('sheMonthly', state.token, q.mYm).then(function (r) {
      if (!r.ok) return toast(r.error);
      H.mon = r; monthlyForm();
    }).catch(onServerError);
  }
  // หน้ากรอก (ปรับใหม่ 20/11/69 ตามที่ผู้ใช้บอกว่ากรอกแบบตารางไม่สะดวก): 1 การ์ด = 1 จุดติดตั้ง · แต่ละหัวข้อมีปุ่มผลชัด ๆ ให้แตะครั้งเดียว
  // แถบความคืบหน้า + ปุ่มบันทึกติดล่างจอ · ผิดปกติแล้วต้องระบุรายละเอียด · เตือนก่อนเปลี่ยนเดือน / แบบฟอร์มถ้ายังไม่บันทึก
  var M_OPTS = { P: 'ปกติ', X: 'ผิดปกติ', O: 'กำลังแก้ไข', '-': 'ไม่มี' };
  function mItem(def, j) { return def.items[j].replace(/<br>/g, ' '); }
  function mState(def, row) {
    var n = def.items.length, done = 0, bad = 0;
    for (var j = 0; j < n; j++) { var c = row.r[j] || ''; if (c) done++; if (c === 'X' || c === 'O') bad++; }
    return { done: done, n: n, bad: bad, full: done === n, empty: !done };
  }
  // กล่องบันทึกปัญหา (เฉพาะจุดที่มี ✕ / ⟳): รายละเอียด + รูป — เก็บในระบบ ไม่ออกในแบบฟอร์มที่พิมพ์
  function mProblem(row, i, bad) {
    var need = bad && !String(row.detail).trim();
    var th = row.files.map(function (f, k) {
      var src = (H.mThumb && H.mThumb[f.id]) || img(f.id, 240);
      return '<span class="smph"><a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="รูปปัญหา ' + (k + 1) + '"></a><button class="smphx" data-phx="' + i + ':' + k + '" aria-label="ลบรูปนี้">✕</button></span>';
    }).join('') + (H.mUp && H.mUp[i] ? '<span class="smph up"><span class="spinner"></span>' + H.mUp[i] + ' รูป</span>' : '');
    return '<div class="smprob"><div class="smpt">⚠ บันทึกปัญหา <em>เก็บไว้ดูในระบบ · ไม่แสดงในเอกสาร</em></div>'
      + '<label class="smdet' + (need ? ' need' : '') + '"><span>ผิดปกติอะไร / พบอะไร' + (bad ? ' *' : '') + '</span><textarea data-detail="' + i + '" rows="2" placeholder="เช่น หลอดไฟด้านซ้ายไม่ติด แบตเตอรี่บวม">' + esc(row.detail) + '</textarea></label>'
      + '<div class="smphs">' + th + '<button type="button" class="smadd2" data-mph="' + i + '" data-src="cam">' + icon('camera', 20) + '<span>ถ่ายรูป</span></button>'
      + '<button type="button" class="smadd2" data-mph="' + i + '" data-src="lib">' + icon('image', 20) + '<span>เลือกรูป</span></button></div></div>';
  }
  function monthlyForm() {
    var q = H.q, r = H.mon, form = q.mForm, def = SHEM[form], rec = r.records[form];
    var ed = H.mEdit && H.mEdit.form === form && H.mEdit.ym === r.ym ? H.mEdit : null;
    if (!ed) {
      // detail / files = บันทึกปัญหาของจุดที่ผิดปกติ เก็บในระบบเท่านั้น (เอกสารพิมพ์แค่หมายเหตุ — ผู้ใช้ขอ 20/11/69)
      var rows = rec ? rec.rows.map(function (x) { return { loc: x.loc, r: x.r.slice(), note: x.note || '', detail: x.detail || (mState(def, x).bad ? x.note || '' : ''), files: (x.files || []).slice() }; })
        : (r.locs[form] || []).map(function (l) { return { loc: l, r: [], note: '', detail: '', files: [] }; });
      ed = H.mEdit = { form: form, ym: r.ym, rows: rows, inspector: rec ? rec.inspector : inspectors()[0], inspDate: rec ? rec.inspDate : r.today,
        approver: rec ? rec.approver : '', approveDate: rec ? rec.approveDate : '', tester: rec ? rec.tester : '', testDate: rec ? rec.testDate : (def.smoke ? r.today : ''), dirty: false, open: {}, up: 0 };
    }
    var opts = def.withO ? ['P', 'X', 'O', '-'] : ['P', 'X', '-'];
    var guard = function (fn) { if (!ed.dirty) return fn(); ask({ title: 'ยังไม่ได้บันทึก', text: 'ผลตรวจที่กรอกไว้ของ ' + def.name + ' จะหายถ้าออกจากหน้านี้', ok: 'ออกโดยไม่บันทึก', cancel: 'กลับไปบันทึก' }).then(function (yes) { if (yes) { ed.dirty = false; fn(); } }); };
    var chips = Object.keys(SHEM).map(function (k) {
      var x = r.records[k];
      return '<button class="smf' + (k === form ? ' on' : '') + '" data-mf="' + k + '" aria-pressed="' + (k === form) + '"><b>FM-SHE-' + k + '</b><span>' + esc(SHEM[k].name) + '</span><small class="' + (x ? (x.badCount ? 'bad' : 'ok') : '') + '">' + (x ? (x.badCount ? '⚠ ผิดปกติ ' + x.badCount + ' ข้อ' : '✓ ตรวจแล้ว') : 'ยังไม่ตรวจเดือนนี้') + '</small></button>';
    }).join('');
    var cards = ed.rows.map(function (row, i) {
      var st = mState(def, row), cls = st.bad ? ' bad' : st.full ? ' ok' : '';
      var badge = st.bad ? '<span class="smbadge bad">ผิดปกติ ' + st.bad + '</span>' : st.full ? '<span class="smbadge ok">✓ ครบ</span>' : '<span class="smbadge">' + st.done + '/' + st.n + '</span>';
      return '<section class="smcard' + cls + '" data-card="' + i + '"><div class="smch"><span class="smnum">' + (i + 1) + '</span>'
        + '<input class="smloc" data-i="' + i + '" value="' + esc(row.loc) + '" placeholder="ชื่อจุดติดตั้ง" aria-label="จุดติดตั้งที่ ' + (i + 1) + '">' + badge
        + '<button class="smicon" data-del="' + i + '" aria-label="ลบจุดนี้" title="ลบจุดนี้">' + icon('trash', 18) + '</button></div>'
        + '<div class="smitems">' + def.items.map(function (x, j) {
          var c = row.r[j] || '';
          return '<div class="smrow"><div class="smlab">' + x + '</div><div class="smseg" role="radiogroup" aria-label="' + esc(mItem(def, j)) + '">' + opts.map(function (o) {
            return '<button class="smo o' + (o === '-' ? 'N' : o) + (c === o ? ' on' : '') + '" role="radio" aria-checked="' + (c === o) + '" data-i="' + i + '" data-j="' + j + '" data-o="' + o + '"><i>' + (o === 'P' ? '✓' : o === 'X' ? '✕' : o === 'O' ? '⟳' : '–') + '</i>' + M_OPTS[o] + '</button>';
          }).join('') + '</div></div>';
        }).join('') + '</div>'
        + '<div class="smfoot"><button class="smallok" data-allok="' + i + '">✓ ทุกข้อปกติ</button>'
        + (st.bad || row.detail || row.files.length ? mProblem(row, i, st.bad) : '')
        + '<label class="smnote"><span>หมายเหตุ <em>(พิมพ์ในเอกสาร · ถ้ามี)</em></span><input data-note="' + i + '" value="' + esc(row.note) + '" placeholder="' + (st.bad ? 'เช่น แจ้งช่างแล้ว รอเปลี่ยนหลอด' : '') + '"></label></div></section>';
    }).join('');
    var total = ed.rows.filter(function (x) { return String(x.loc).trim(); }).length;
    var doneN = ed.rows.filter(function (x) { return String(x.loc).trim() && mState(def, x).full; }).length;
    var badN = ed.rows.filter(function (x) { return mState(def, x).bad; }).length;
    var sign = (def.smoke ? F('mTester', 'ผู้ทดสอบ (เจ้าหน้าที่อาคารสถานที่)', ed.tester) + F('mTestDate', 'วันที่ทดสอบ', ed.testDate, 'date') : '')
      + F('mInsp', def.smoke ? 'ผู้ตรวจสอบ (จป.วิชาชีพ)' : 'ตรวจสอบโดย (จป.วิชาชีพ)', ed.inspector, 'text', ' list="mPeople"') + F('mInspDate', 'วันที่ตรวจสอบ', ed.inspDate, 'date')
      + F('mAppr', def.smoke ? 'ผู้ตรวจสอบ (ผู้จัดการ)' : 'อนุมัติโดย (ผู้จัดการ)', ed.approver) + F('mApprDate', 'วันที่อนุมัติ', ed.approveDate, 'date');
    $('main').innerHTML = '<h3>ตรวจประจำเดือน</h3><p class="lead">เลือกเดือนและแบบฟอร์ม แล้วเดินตรวจทีละจุด แตะผลของแต่ละข้อ · บันทึกแล้วพิมพ์เป็นแบบฟอร์มได้</p>'
      + '<div class="pbar"><label class="pchk">เดือน <input type="month" id="mYm" value="' + r.ym + '"></label><b>' + TH_MONTHS[+r.ym.slice(5, 7) - 1] + ' ' + (+r.ym.slice(0, 4) + 543) + '</b></div>'
      + '<div class="smfs">' + chips + '</div>'
      + '<div class="smhead"><div><b>' + esc(def.title) + '</b><small>' + esc(r.fm[form] || '') + '</small></div>'
      + (rec ? '<span class="muted">บันทึกล่าสุด ' + esc(String(rec.updatedAt).slice(0, 16)) + '</span>' : '<span class="muted">ยังไม่ได้บันทึกเดือนนี้</span>') + '</div>'
      + (ed.rows.length ? '' : '<div class="panel smempty"><b>ยังไม่มีจุดติดตั้ง</b><span>เพิ่มจุดแรกด้านล่าง เช่น "อาคาร G1 ประตูหน้า" — ระบบจะจำรายชื่อจุดไว้ใช้เดือนถัดไป</span></div>')
      + '<div class="smcards">' + cards + '</div>'
      + '<div class="smadd"><input id="mNewLoc" placeholder="ชื่อจุดติดตั้งใหม่ เช่น อาคาร G2 ทางออกหลัง" aria-label="ชื่อจุดติดตั้งใหม่"><button class="btn btn-line" id="mAdd">' + icon('plus', 16) + ' เพิ่มจุด</button></div>'
      + '<details class="panel smsign"' + (ed.inspector && ed.approver ? '' : ' open') + '><summary><b>ผู้ลงนาม</b> <span class="muted">' + esc([ed.tester, ed.inspector, ed.approver].filter(String).join(' · ') || 'ยังไม่ระบุ') + '</span></summary><div class="pform">' + sign + '</div>' + datalist('mPeople', inspectors()) + '</details>'
      + (rec ? '<div class="pbar"><button class="btn btn-sm btn-line smdel" id="mDel">' + icon('trash', 16) + ' ลบผลตรวจเดือนนี้</button></div>' : '')
      + '<div class="smbar"><div class="smprog"><div><b>' + doneN + '/' + total + '</b> จุดตรวจครบ' + (badN ? ' · <span class="bad">ผิดปกติ ' + badN + ' จุด</span>' : '') + (ed.dirty ? ' · <span class="dirty">ยังไม่บันทึก</span>' : '') + '</div><i><s style="width:' + (total ? Math.round(doneN / total * 100) : 0) + '%"></s></i></div>'
      + '<button class="btn btn-line" id="mPrint">' + icon('print', 16) + ' พิมพ์</button><button class="btn btn-primary" id="mSave">' + icon('check', 16) + ' บันทึก</button></div>';
    var keep = function () { ['tester:mTester', 'testDate:mTestDate', 'inspector:mInsp', 'inspDate:mInspDate', 'approver:mAppr', 'approveDate:mApprDate'].forEach(function (p) { var a = p.split(':'); if ($(a[1])) ed[a[0]] = v(a[1]); }); };
    var redraw = function (focusSel) { keep(); var y = window.scrollY; monthlyForm(); window.scrollTo(0, y); if (focusSel) { var el = $('main').querySelector(focusSel); if (el) el.focus(); } };
    $('mYm').addEventListener('change', function () { var val = this.value; if (!val) return; guard(function () { q.mYm = val; H.mEdit = null; monthly(); }); this.value = r.ym; });
    on('[data-mf]', 'click', function (el) { var k = el.getAttribute('data-mf'); if (k === form) return; keep(); guard(function () { H.mEdit = null; q.mForm = k; monthlyForm(); }); });
    on('.smloc', 'input', function (el) { ed.rows[+el.getAttribute('data-i')].loc = el.value; ed.dirty = true; });
    on('[data-note]', 'input', function (el) { ed.rows[+el.getAttribute('data-note')].note = el.value; ed.dirty = true; });
    on('[data-detail]', 'input', function (el) { var row = ed.rows[+el.getAttribute('data-detail')]; row.detail = el.value; ed.dirty = true; el.closest('.smdet').classList.toggle('need', mState(def, row).bad > 0 && !el.value.trim()); });
    // รูป: อัปโหลดทันทีที่ถ่าย/เลือก (ทีละรูป) แล้วผูกกับจุดนั้น · บันทึกจริงตอนกด "บันทึก"
    on('[data-mph]', 'click', function (el) {
      var i = +el.getAttribute('data-mph');
      pickPhotos(function (arr) {
        if (!arr.length) return;
        H.mUp = H.mUp || {}; H.mThumb = H.mThumb || {}; H.mUp[i] = (H.mUp[i] || 0) + arr.length; ed.up += arr.length; redraw();
        var k = 0, fails = 0;
        (function next() {
          if (k >= arr.length) { if (fails) toast('อัปโหลดไม่สำเร็จ ' + fails + ' รูป — ลองใหม่อีกครั้ง'); else toast('✓ แนบรูปแล้ว — กดบันทึกเพื่อเก็บผล'); return; }
          var ph = arr[k++];
          call('sheMonthlyPhoto', state.token, form, r.ym, ph.name, 'image/jpeg', ph.b64).then(function (x) {
            if (!x.ok) throw new Error(x.error);
            H.mThumb[x.file.id] = ph.dataUrl; if (ed.rows[i]) ed.rows[i].files.push(x.file); ed.dirty = true;
          }).catch(function (e) { fails++; console.warn(e); }).then(function () {
            H.mUp[i]--; ed.up--; if (H.mEdit === ed && q.mForm === form && $('mSave')) redraw(); next();
          });
        })();
      }, el.getAttribute('data-src') === 'cam');
    });
    on('[data-phx]', 'click', function (el) {
      var a = el.getAttribute('data-phx').split(':'), row = ed.rows[+a[0]];
      ask({ title: 'ลบรูปนี้?', text: 'รูปจะถูกเอาออกจากจุด "' + (row.loc || '') + '"', ok: 'ลบรูป', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) { if (yes) { row.files.splice(+a[1], 1); ed.dirty = true; redraw(); } });
    });
    on('.smo', 'click', function (el) {
      var i = +el.getAttribute('data-i'), j = +el.getAttribute('data-j'), o = el.getAttribute('data-o'), row = ed.rows[i];
      row.r[j] = row.r[j] === o ? '' : o; ed.dirty = true;   // แตะซ้ำ = ล้างค่า
      redraw((row.r[j] === 'X' || row.r[j] === 'O') && !String(row.detail).trim() ? '[data-detail="' + i + '"]' : null);
    });
    on('[data-allok]', 'click', function (el) { var row = ed.rows[+el.getAttribute('data-allok')]; for (var j = 0; j < def.items.length; j++) if (!row.r[j]) row.r[j] = 'P'; ed.dirty = true; redraw(); });
    on('[data-del]', 'click', function (el) {
      var i = +el.getAttribute('data-del'), row = ed.rows[i];
      var go2 = function () { keep(); ed.rows.splice(i, 1); ed.dirty = true; redraw(); };
      if (!row.loc && mState(def, row).empty) return go2();
      ask({ title: 'ลบจุด "' + (row.loc || 'ไม่มีชื่อ') + '"?', text: 'ผลตรวจของจุดนี้ในเดือนนี้จะหายไป (เดือนถัดไปจะไม่มีจุดนี้ในรายการ)', ok: 'ลบจุดนี้', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) { if (yes) go2(); });
    });
    var addLoc = function () {
      var name = v('mNewLoc'); if (!name) { $('mNewLoc').focus(); return toast('พิมพ์ชื่อจุดติดตั้งก่อน'); }
      if (ed.rows.some(function (x) { return String(x.loc).trim() === name; })) return toast('มีจุดชื่อนี้แล้ว');
      keep(); ed.rows.push({ loc: name, r: [], note: '', detail: '', files: [] }); ed.dirty = true; redraw('#mNewLoc');
      var cs = $('main').querySelectorAll('.smcard'); if (cs.length) cs[cs.length - 1].scrollIntoView({ block: 'center' });
    };
    $('mAdd').addEventListener('click', addLoc);
    $('mNewLoc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLoc(); } });
    if ($('mDel')) $('mDel').addEventListener('click', function () {
      ask({ title: 'ลบผลตรวจเดือนนี้?', text: 'FM-SHE-' + form + ' ' + TH_MONTHS[+r.ym.slice(5, 7) - 1] + ' ' + (+r.ym.slice(0, 4) + 543) + ' (รายชื่อจุดยังอยู่)', ok: 'ลบ', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
        if (yes) call('sheDeleteMonthly', state.token, form, r.ym).then(function (x) { if (!x.ok) return toast(x.error); H.mEdit = null; toast('ลบแล้ว'); monthly(); }).catch(onServerError);
      });
    });
    var save = function (then) {
      keep();
      var named = ed.rows.filter(function (x) { return String(x.loc).trim(); });
      if (!named.length) { $('mNewLoc').focus(); return toast('เพิ่มจุดติดตั้งอย่างน้อย 1 จุด'); }
      var noName = ed.rows.filter(function (x) { return !String(x.loc).trim() && !mState(def, x).empty; });
      if (noName.length) { toast('มีจุดที่กรอกผลแล้วแต่ยังไม่มีชื่อ — ใส่ชื่อจุดก่อน'); var e1 = $('main').querySelector('.smloc[value=""]'); if (e1) e1.focus(); return; }
      if (ed.up > 0) return toast('รอรูปอัปโหลดเสร็จก่อน แล้วกดบันทึกอีกครั้ง');
      var needNote = ed.rows.map(function (x, i) { return i; }).filter(function (i) { return mState(def, ed.rows[i]).bad && !String(ed.rows[i].detail).trim(); });
      if (needNote.length) { toast('ระบุว่าผิดปกติอะไร ก่อนบันทึก'); var e2 = $('main').querySelector('[data-detail="' + needNote[0] + '"]'); if (e2) { e2.scrollIntoView({ block: 'center' }); e2.focus(); } return; }
      if (!ed.inspector) { $('main').querySelector('.smsign').open = true; $('mInsp').focus(); return toast('ใส่ชื่อผู้ตรวจสอบ'); }
      var part = named.filter(function (x) { return !mState(def, x).full; }).length;
      var doSave = function () {
        var b = $('mSave'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังบันทึก';
        return call('sheSaveMonthly', state.token, { form: form, ym: r.ym, rows: ed.rows.filter(function (x) { return String(x.loc).trim() || !mState(def, x).empty; }), inspector: ed.inspector, inspDate: ed.inspDate, approver: ed.approver, approveDate: ed.approveDate, tester: ed.tester, testDate: ed.testDate })
          .then(function (x) {
            if (!x.ok) { b.disabled = false; b.innerHTML = icon('check', 16) + ' บันทึก'; return toast(x.error); }
            r.records[form] = x.record; r.locs[form] = named.map(function (y) { return y.loc; }); H.mEdit = null; toast('✓ บันทึกผลตรวจ ' + def.name + ' แล้ว'); if (then) then(); else monthlyForm();
          }).catch(function (e) { b.disabled = false; b.innerHTML = icon('check', 16) + ' บันทึก'; onServerError(e); });
      };
      if (part) return ask({ title: 'ยังตรวจไม่ครบ ' + part + ' จุด', text: 'บันทึกไว้ก่อนแล้วค่อยกลับมากรอกต่อได้', ok: 'บันทึกไว้ก่อน', cancel: 'กลับไปกรอก', tone: 'info' }).then(function (yes) { if (yes) doSave(); });
      doSave();
    };
    $('mSave').addEventListener('click', function () { save(); });
    $('mPrint').addEventListener('click', function () {
      var goPrint = function () { q.rep = 'm' + form; q.rYm = r.ym; go('s_rep'); };
      if (ed.dirty) save(goPrint); else goPrint();
    });
  }
  // ==================== แฟ้มเอกสาร (ผู้ใช้ขอ 20/11/69) ====================
  // เก็บไฟล์ Word / Excel / PowerPoint (+ PDF) แยกตามปี พ.ศ. · อัปโหลดแล้วกด "เปิดดู" ได้ทุกเมื่อ (เปิดในตัวแสดงไฟล์ของ Google Drive) · API SheDocs.gs
  var DOC_KIND = [[/\.docx?$/i, 'W', 'Word', '#2563eb'], [/\.(xlsx?|xlsm|csv)$/i, 'X', 'Excel', '#16a34a'], [/\.pptx?$/i, 'P', 'PowerPoint', '#ea580c'], [/\.pdf$/i, 'PDF', 'PDF', '#dc2626']];
  function docKind(name) { for (var i = 0; i < DOC_KIND.length; i++) if (DOC_KIND[i][0].test(name)) return DOC_KIND[i]; return null; }
  function docSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function beYear() { return new Date().getFullYear() + 543; }
  // หมวดเอกสาร: บรรทัดขึ้นต้น "หมวด" = หมวดหลัก · บรรทัดอื่น = หมวดย่อย · ที่เลือกเก็บไฟล์ได้ = หมวดย่อย หรือหมวดหลักที่ไม่มีหมวดย่อย
  // ค่าที่เก็บในแถว = "หมวดหลัก › หมวดย่อย" (หรือชื่อหมวดหลัก)
  function docTree(text) {
    var mains = [];
    String(text || '').split(/\n/).map(function (l) { return l.trim(); }).filter(String).forEach(function (l) {
      if (/^หมวด/.test(l) || !mains.length) mains.push({ name: l, subs: [] }); else mains[mains.length - 1].subs.push(l);
    });
    // โฟลเดอร์หลักเก็บไฟล์ได้เองด้วย แม้มีโฟลเดอร์ย่อยแล้ว (สร้างโฟลเดอร์ย่อยทีหลัง ไฟล์เดิมไม่หาย — 23/11/69)
    mains.forEach(function (m) { m.leaves = [{ key: m.name, label: m.subs.length ? '(ไว้ใน ' + m.name + ' โดยตรง)' : m.name }].concat(m.subs.map(function (x) { return { key: m.name + ' › ' + x, label: x }; })); });
    return mains;
  }
  // โฟลเดอร์ชั้นบนสุด: ปี พ.ศ. (ตัวเลข, หมวดใช้ docCats ร่วมกันทุกปี) หรือโฟลเดอร์ตั้งชื่อเอง (ข้อความ, มีโฟลเดอร์ย่อยของตัวเองใน roots) — ผู้ใช้ขอ 23/11/69
  function rootLabel(y) { return typeof y === 'number' ? 'ปี ' + y : String(y); }
  function rootTree(rt) {
    return (rt && rt.cats || []).map(function (c) {
      var mm = { name: c.name, subs: (c.subs || []).slice() };
      mm.leaves = [{ key: mm.name, label: mm.subs.length ? '(ไว้ใน ' + mm.name + ' โดยตรง)' : mm.name }].concat(mm.subs.map(function (x) { return { key: mm.name + ' › ' + x, label: x }; }));
      return mm;
    });
  }
  function rootOf(y) { return typeof y === 'string' ? (H.docs.roots || []).filter(function (x) { return x.name === y; })[0] || null : null; }
  function treeFor(y) { return typeof y === 'string' ? rootTree(rootOf(y)) : docTree(H.docs.cats); }
  function goDoc(p) { var q = H.q; q.dHist = (q.dHist || []).concat([q.dPath || []]); q.dPath = p; q.dTerm = ''; docsPage(); window.scrollTo(0, 0); }
  // หน้าแฟ้มเอกสารแบบ File Explorer ของ Windows (ผู้ใช้ขอ 20/11/69): โฟลเดอร์ ปี → หมวด → หมวดย่อย → ไฟล์
  // แตะโฟลเดอร์ = เข้าไปข้างใน · แถบที่อยู่ (breadcrumb) + ปุ่มย้อนกลับ / ขึ้นระดับ · มุมมอง ไอคอน / รายละเอียด · ลากไฟล์มาวางในโฟลเดอร์ปลายทาง = อัปโหลด
  var FOLDER_SVG = '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h17l6 6h29a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#E0A82E"/><path d="M2 17a3 3 0 0 1 3-3h54a3 3 0 0 1 3 3v29a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#FFCA4F"/></svg>';
  function fileSvg(name) {
    var k = docKind(name) || ['', '?', 'ไฟล์', '#64748b'];
    return '<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#cbd5e1" stroke-width="2"/><path d="M32 2v12h12" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2"/>'
      + '<rect x="0" y="30" width="' + (k[1].length > 1 ? 34 : 26) + '" height="20" rx="3" fill="' + k[3] + '"/><text x="' + (k[1].length > 1 ? 17 : 13) + '" y="45" text-anchor="middle" font-size="' + (k[1].length > 1 ? 12 : 14) + '" font-weight="700" fill="#fff" font-family="Arial,sans-serif">' + k[1] + '</text></svg>';
  }
  function docsPage() {
    var D = H.docs;
    if (!D) {
      $('main').innerHTML = '<h3>แฟ้มเอกสาร</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลด…</div>';
      return call('sheDocs', state.token).then(function (r) { if (!r.ok) return toast(r.error); H.docs = r; if (state.page === 's_doc') docsPage(); }).catch(onServerError);
    }
    var q = H.q, years = D.years, roots = D.roots || [], rnames = roots.map(function (x) { return x.name; });
    var p0 = (q.dPath || [])[0], isNamed = typeof p0 === 'string', rootObj = isNamed ? rootOf(p0) : null, tree = treeFor(p0);
    var view = q.dView || (function () { try { return localStorage.getItem('she_doc_view') || 'icon'; } catch (e) { return 'icon'; } })();
    // ตำแหน่งปัจจุบัน: path = [] (ราก = ทุกปี) · [ปี] · [ปี, หมวด] · [ปี, หมวด, หมวดย่อย]
    var path = q.dPath || [], y = path[0], m = path.length > 1 ? tree[path[1]] : null, sub = m && path.length > 2 ? m.subs[path[2]] : null;
    if (path.length && years.indexOf(y) < 0 && rnames.indexOf(y) < 0) { path = q.dPath = []; y = null; m = null; isNamed = false; rootObj = null; tree = docTree(D.cats); }
    if (path.length > 1 && path[1] !== -1 && !m) { path = q.dPath = [y]; }
    var leafKey = m ? (sub != null ? m.name + ' › ' + sub : m.name) : (isNamed && path.length === 1 ? '' : null), canUp = leafKey != null;   // โฟลเดอร์ที่อัปโหลดได้ (หมวดหลัก / โฟลเดอร์ตั้งชื่อเองก็อัปโหลดได้)
    var term = String(q.dTerm || '').toLowerCase().trim();
    var known = {}; tree.forEach(function (mm) { mm.leaves.forEach(function (l) { known[l.key] = 1; }); }); if (isNamed) known[''] = 1;
    var cnt = function (filter) { return D.docs.filter(filter).length; };
    var items = [];   // { kind: 'folder'|'file', name, sub, go | doc }
    if (term) {
      D.docs.filter(function (d) { return (d.title + ' ' + d.fileName + ' ' + d.category + ' ' + d.note).toLowerCase().indexOf(term) >= 0 && (!y || d.year === y); })
        .forEach(function (d) { items.push({ kind: 'file', doc: d, where: rootLabel(d.year) + (d.category ? ' › ' + d.category : typeof d.year === 'number' ? ' › อื่น ๆ' : '') }); });
    } else if (!path.length) {
      years.forEach(function (yy) { items.push({ kind: 'folder', name: 'ปี ' + yy, n: cnt(function (d) { return d.year === yy; }), go: [yy] }); });
      rnames.forEach(function (nm) { items.push({ kind: 'folder', name: nm, n: cnt(function (d) { return d.year === nm; }), go: [nm] }); });
    } else if (path.length === 1) {
      tree.forEach(function (mm, i) { var ks = {}; mm.leaves.forEach(function (l) { ks[l.key] = 1; }); items.push({ kind: 'folder', name: mm.name, n: cnt(function (d) { return d.year === y && ks[d.category]; }), go: [y, i] }); });
      var other = D.docs.filter(function (d) { return d.year === y && !known[d.category]; });
      if (other.length) items.push({ kind: 'folder', name: 'อื่น ๆ / ยังไม่ได้จัดหมวด', n: other.length, go: [y, -1] });
      if (isNamed) D.docs.filter(function (d) { return d.year === y && d.category === ''; }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title), 'th'); }).forEach(function (d) { items.push({ kind: 'file', doc: d }); });
    } else if (path[1] === -1) {
      D.docs.filter(function (d) { return d.year === y && !known[d.category]; }).forEach(function (d) { items.push({ kind: 'file', doc: d }); });
    } else if (m.subs.length && sub == null) {
      m.subs.forEach(function (s, i) { var k = m.name + ' › ' + s; items.push({ kind: 'folder', name: s, n: cnt(function (d) { return d.year === y && d.category === k; }), go: [y, path[1], i] }); });
      D.docs.filter(function (d) { return d.year === y && d.category === m.name; }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title), 'th'); }).forEach(function (d) { items.push({ kind: 'file', doc: d }); });
    } else {
      D.docs.filter(function (d) { return d.year === y && d.category === leafKey; }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title), 'th'); }).forEach(function (d) { items.push({ kind: 'file', doc: d }); });
    }
    var crumbs = [['แฟ้มเอกสาร', []]];
    if (y) crumbs.push([rootLabel(y), [y]]);
    if (path[1] === -1) crumbs.push(['อื่น ๆ', [y, -1]]); else if (m) crumbs.push([m.name, [y, path[1]]]);
    if (sub != null) crumbs.push([sub, path.slice()]);
    // ลบโฟลเดอร์ได้ทุกโฟลเดอร์ (ผู้ใช้ขอ 23/11/69 — เดิมลบได้เฉพาะโฟลเดอร์ว่าง) · มีไฟล์ข้างใน → ไฟล์ถูกลบไปถังขยะด้วย (ยืนยันก่อน)
    // ยกเว้นปีสุดท้ายที่เหลือ และโฟลเดอร์หลักอันสุดท้ายของปี
    var delKind = null, delDocs = [];
    if (!term && path.length && path[1] !== -1) {
      if (path.length === 1) { if (isNamed || years.length > 1 || roots.length) { delKind = isNamed ? 'root' : 'year'; delDocs = D.docs.filter(function (d) { return d.year === y; }); } }
      else if (m) {
        var dkeys = sub != null ? [m.name + ' › ' + sub] : m.leaves.map(function (l) { return l.key; });
        if (isNamed || sub != null || tree.length > 1) { delKind = 'dir'; delDocs = D.docs.filter(function (d) { return (isNamed ? d.year === y : typeof d.year === 'number') && dkeys.indexOf(d.category) >= 0; }); }
      }
    }
    var fdate = function (s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(2) + ' ' + String(s).slice(11, 16) : ''; };
    var tile = function (it, i) {
      if (it.kind === 'folder') return '<button class="sxitem" data-xgo="' + i + '" title="' + esc(it.name) + '">' + '<span class="sxic">' + FOLDER_SVG + '</span><span class="sxnm">' + esc(it.name) + '</span><small>' + it.n + ' ไฟล์</small></button>';
      var d = it.doc;
      return '<div class="sxitem sxfile"><a class="sxopen" href="' + esc(d.url) + '" target="_blank" rel="noopener" title="' + esc(d.title + ' (' + d.fileName + ')') + '"><span class="sxic">' + fileSvg(d.fileName) + '</span><span class="sxnm">' + esc(d.title) + '</span><small>' + docSize(d.size) + (it.where ? ' · ' + esc(it.where) : '') + '</small></a>'
        + '<button class="sxmore" data-xmore="' + esc(d.id) + '" aria-label="ตัวเลือกของ ' + esc(d.title) + '">⋮</button><button class="sxdelf" data-xdel="' + esc(d.id) + '" aria-label="ลบไฟล์ ' + esc(d.title) + '" title="ลบไฟล์">' + icon('trash', 14) + '</button></div>';
    };
    var row = function (it, i) {
      if (it.kind === 'folder') return '<tr class="sxrow" data-xgo="' + i + '" tabindex="0"><td class="sxn"><span class="sxsm">' + FOLDER_SVG + '</span>' + esc(it.name) + '</td><td>' + it.n + ' ไฟล์</td><td>โฟลเดอร์</td><td></td><td></td></tr>';
      var d = it.doc, k = docKind(d.fileName) || ['', '', 'ไฟล์'];
      return '<tr class="sxrow"><td class="sxn"><a href="' + esc(d.url) + '" target="_blank" rel="noopener"><span class="sxsm">' + fileSvg(d.fileName) + '</span>' + esc(d.title) + '</a>' + (it.where ? '<small>' + esc(it.where) + '</small>' : '') + '</td><td>' + fdate(d.updatedAt || d.createdAt) + '</td><td>' + k[2] + '</td><td class="r">' + docSize(d.size) + '</td><td class="r sxact"><button class="sxdelf" data-xdel="' + esc(d.id) + '" aria-label="ลบไฟล์ ' + esc(d.title) + '" title="ลบไฟล์">' + icon('trash', 14) + '</button><button class="sxmore" data-xmore="' + esc(d.id) + '" aria-label="ตัวเลือกของ ' + esc(d.title) + '">⋮</button></td></tr>';
    };
    var body = items.length ? (view === 'list'
      ? '<table class="sxtab"><thead><tr><th>ชื่อ</th><th>วันที่แก้ไข</th><th>ชนิด</th><th class="r">ขนาด</th><th></th></tr></thead><tbody>' + items.map(row).join('') + '</tbody></table>'
      : '<div class="sxgrid">' + items.map(tile).join('') + '</div>')
      : '<div class="sxempty">' + (term ? 'ไม่พบเอกสารที่ค้นหา' : canUp ? 'โฟลเดอร์นี้ยังไม่มีไฟล์<br><small>ลากไฟล์มาวางตรงนี้ หรือกด "อัปโหลดไฟล์"</small>' : 'ว่าง') + '</div>';
    $('main').innerHTML = '<h3>แฟ้มเอกสาร</h3><p class="lead">เก็บไฟล์ Word / Excel / PowerPoint (และ PDF) ของฝ่าย · แตะโฟลเดอร์เพื่อเปิด แตะไฟล์เพื่อเปิดดู</p>'
      + '<div class="sxwin">'
      + '<div class="sxbar"><button class="sxnav" id="xBack" aria-label="ย้อนกลับ" title="ย้อนกลับ"' + (path.length || term ? '' : ' disabled') + '>←</button>'
      + '<button class="sxnav" id="xUp" aria-label="ขึ้นหนึ่งระดับ" title="ขึ้นหนึ่งระดับ"' + (path.length ? '' : ' disabled') + '>↑</button>'
      + '<nav class="sxcrumb" aria-label="ตำแหน่งโฟลเดอร์">' + crumbs.map(function (c, i) { return (i ? '<span class="sxsep">›</span>' : '') + '<button data-xcr="' + i + '"' + (i === crumbs.length - 1 ? ' aria-current="page"' : '') + '>' + (i ? '' : '<span class="sxsm">' + FOLDER_SVG + '</span>') + esc(c[0]) + '</button>'; }).join('') + '</nav>'
      + '<input id="dTerm" type="search" placeholder="ค้นหาใน ' + esc(crumbs[crumbs.length - 1][0]) + '" value="' + esc(q.dTerm || '') + '" aria-label="ค้นหาเอกสาร"></div>'
      + '<div class="sxtools">' + (canUp ? '<button class="btn btn-sm btn-primary" id="xUpl">' + icon('up', 15) + ' อัปโหลดไฟล์</button>' : '')
      + (!term && (path.length === 1 || (path.length === 2 && m)) ? '<button class="btn btn-sm btn-line" id="dNewDir">' + icon('folder', 15) + ' สร้างโฟลเดอร์</button>' : '')
      + (!path.length && !term ? '<button class="btn btn-sm btn-primary" id="dNewRoot">' + icon('folder', 15) + ' สร้างโฟลเดอร์</button>' : '') + (path.length === 1 && !isNamed ? '<button class="btn btn-sm btn-line" id="dCats">' + icon('pen', 15) + ' แก้หมวด</button>' : '')
      + (!term && path.length === 1 ? '<button class="btn btn-sm btn-line" id="dRename">' + icon('pen', 15) + ' เปลี่ยนชื่อโฟลเดอร์</button>' : '')
      + (delKind ? '<button class="btn btn-sm btn-line sddel" id="dDelDir">' + icon('trash', 15) + ' ลบโฟลเดอร์นี้</button>' : '')
      + '<span class="sxcount">' + items.length + ' รายการ</span>'
      + '<div class="sxview" role="group" aria-label="มุมมอง"><button data-xv="icon" aria-pressed="' + (view === 'icon') + '" title="ไอคอน">▦</button><button data-xv="list" aria-pressed="' + (view === 'list') + '" title="รายละเอียด">☰</button></div></div>'
      + '<div class="sxbody' + (canUp ? ' droppable' : '') + '" id="xBody">' + body + '<div id="dProg"></div></div>'
      + '<div class="sxstatus">' + (canUp ? 'อัปโหลดเข้า: ' + esc(crumbs.slice(1).map(function (c) { return c[0]; }).join(' › ')) + ' · Word / Excel / PowerPoint / PDF ไม่เกิน 20 MB ต่อไฟล์ · ผู้อัปโหลด <input id="dBy" list="dPeople" value="' + esc(q.dBy || inspectors()[0]) + '" aria-label="ผู้อัปโหลด">' + datalist('dPeople', inspectors()) : (!path.length ? 'เปิดโฟลเดอร์' : path.length === 1 ? 'เลือกหมวด' : 'เลือกหมวดย่อย') + ' แล้วจึงอัปโหลดไฟล์ได้') + '</div>'
      + '<input type="file" id="dFile" multiple hidden accept=".doc,.docx,.xls,.xlsx,.xlsm,.csv,.ppt,.pptx,.pdf"></div>';
    var nav = function (p) { q.dHist = (q.dHist || []).concat([path]); q.dPath = p; q.dTerm = ''; docsPage(); window.scrollTo(0, 0); };
    on('[data-xgo]', 'click', function (el) { nav(items[+el.getAttribute('data-xgo')].go); }, $('main'));
    on('tr[data-xgo]', 'keydown', function (el, e) { if (e.key === 'Enter') nav(items[+el.getAttribute('data-xgo')].go); }, $('main'));
    on('[data-xcr]', 'click', function (el) { var c = crumbs[+el.getAttribute('data-xcr')]; if (c) nav(c[1]); }, $('main'));
    $('xBack').addEventListener('click', function () { if (q.dTerm) { q.dTerm = ''; return docsPage(); } var h = q.dHist || []; q.dPath = h.length ? h.pop() : path.slice(0, -1); q.dHist = h; docsPage(); });
    $('xUp').addEventListener('click', function () { nav(path[1] === -1 ? [y] : path.slice(0, -1)); });
    on('[data-xv]', 'click', function (el) { q.dView = el.getAttribute('data-xv'); try { localStorage.setItem('she_doc_view', q.dView); } catch (e) {} docsPage(); }, $('main'));
    var t; $('dTerm').addEventListener('input', function () { var val = this.value; clearTimeout(t); t = setTimeout(function () { q.dTerm = val; docsPage(); var el = $('dTerm'); el.focus(); el.setSelectionRange(val.length, val.length); }, 250); });
    if ($('dBy')) $('dBy').addEventListener('change', function () { q.dBy = this.value; });
    var inp = $('dFile');
    if ($('xUpl')) $('xUpl').addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () { var fs = Array.prototype.slice.call(inp.files || []); inp.value = ''; if (fs.length && canUp) uploadDocs(fs, y, leafKey); });
    var xb = $('xBody');
    if (canUp) {
      ['dragenter', 'dragover'].forEach(function (ev) { xb.addEventListener(ev, function (e) { e.preventDefault(); xb.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { xb.addEventListener(ev, function (e) { e.preventDefault(); xb.classList.remove('over'); }); });
      xb.addEventListener('drop', function (e) { var fs = Array.prototype.slice.call(e.dataTransfer.files || []); if (fs.length) uploadDocs(fs, y, leafKey); });
    }
    if ($('dNewRoot')) $('dNewRoot').addEventListener('click', function () { newRoot(); });
    if ($('dRename')) $('dRename').addEventListener('click', function () { renameRoot(y); });
    if ($('dDelDir')) $('dDelDir').addEventListener('click', function () {
      var label = crumbs[crumbs.length - 1][0], everyYear = delKind === 'dir' && !isNamed, nYears = {};
      delDocs.forEach(function (d) { nYears[d.year] = 1; });
      ask({ title: 'ลบโฟลเดอร์ "' + label + '"?', text: (everyYear ? 'โฟลเดอร์นี้มีในทุกปี จะหายจากทุกปี · ' : '') + (delDocs.length ? 'ไฟล์ข้างใน ' + delDocs.length + ' ไฟล์' + (everyYear && Object.keys(nYears).length > 1 ? ' (รวมทุกปี)' : '') + ' จะถูกลบไปถังขยะของ Google Drive ด้วย' : 'โฟลเดอร์ว่าง ไม่มีไฟล์ข้างใน'), ok: delDocs.length ? 'ลบโฟลเดอร์และไฟล์ ' + delDocs.length + ' ไฟล์' : 'ลบโฟลเดอร์', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
        if (!yes) return;
        var done = function (r) { if (!r.ok) return toast(r.error); toast('ลบโฟลเดอร์ "' + label + '" แล้ว' + (delDocs.length ? ' (ลบไฟล์ ' + delDocs.length + ' ไฟล์)' : '')); q.dHist = []; q.dPath = path.length > 1 ? (path.length === 3 ? path.slice(0, 2) : [y]) : []; docsPage(); };
        var btn = $('dDelDir'); btn.disabled = true; btn.innerHTML = '<span class="spinner dark"></span> กำลังลบ…';
        // ลบไฟล์ข้างในก่อน แล้วค่อยลบโฟลเดอร์
        var pre = delDocs.length ? call('sheDeleteDocs', state.token, delDocs.map(function (d) { return d.id; })).then(function (r) {
          if (!r.ok) throw new Error(r.error || 'ลบไฟล์ไม่ได้');
          var gone = {}; delDocs.forEach(function (d) { gone[d.id] = 1; }); D.docs = D.docs.filter(function (d) { return !gone[d.id]; });
        }) : Promise.resolve();
        pre.then(function () { delFolder(done); }).catch(function (e) { btn.disabled = false; btn.innerHTML = icon('trash', 15) + ' ลบโฟลเดอร์นี้'; toast(e.message || e); });
      });
    });
    function delFolder(done) {
        if (delKind === 'year') return call('sheDocYears', state.token, years.filter(function (x) { return x !== y; })).then(function (r) { if (r.ok) D.years = r.years; done(r); }).catch(onServerError);
        if (isNamed) {
          var rs = JSON.parse(JSON.stringify(roots)), ro = rs.filter(function (x) { return x.name === y; })[0];
          if (delKind === 'root') rs = rs.filter(function (x) { return x.name !== y; });
          else if (sub != null) ro.cats[path[1]].subs.splice(path[2], 1); else ro.cats.splice(path[1], 1);
          return call('sheDocRoots', state.token, rs).then(function (r) { if (r.ok) D.roots = r.roots; done(r); }).catch(onServerError);
        }
        var lines = [];
        tree.forEach(function (x, i) { if (sub == null && i === path[1]) return; lines.push(x.name); x.subs.forEach(function (s2, j) { if (!(i === path[1] && j === path[2])) lines.push(s2); }); });
        call('sheDocCats', state.token, lines.join('\n')).then(function (r) { if (r.ok) D.cats = r.cats; done(r); }).catch(onServerError);
    }
    if ($('dNewDir')) $('dNewDir').addEventListener('click', function () { newFolder(tree, y, path.length === 2 ? path[1] : null); });
    if ($('dCats')) $('dCats').addEventListener('click', function () {
      openModal({ title: 'แก้หมวดเอกสาร', icon: 'folder', color: state.dept.color, ok: 'บันทึก',
        body: '<p class="muted">1 บรรทัด = 1 โฟลเดอร์ · บรรทัดที่ขึ้นต้นด้วย "หมวด" เป็นโฟลเดอร์หลัก บรรทัดถัดไปเป็นโฟลเดอร์ย่อยของหมวดนั้น (เช่น 1.1 …) · ทุกปีใช้หมวดชุดเดียวกัน</p><textarea id="dCatText" rows="10" style="width:100%;font:inherit;padding:10px;border:1.5px solid var(--line);border-radius:10px">' + esc(D.cats) + '</textarea><p class="muted">ถ้าเปลี่ยนชื่อหมวดที่มีไฟล์อยู่ ไฟล์เดิมจะไปอยู่ในโฟลเดอร์ "อื่น ๆ" ให้ย้ายเข้าหมวดใหม่ด้วยปุ่ม ⋮ → แก้ไข</p>',
        submit: function () {
          return call('sheDocCats', state.token, $('dCatText').value).then(function (r) { if (!r.ok) return r.error; D.cats = r.cats; closeModal(); toast('บันทึกหมวดแล้ว'); docsPage(); });
        } });
    });
    on('[data-xmore]', 'click', function (el, e) {
      e.preventDefault(); e.stopPropagation();
      var d = D.docs.filter(function (x) { return x.id === el.getAttribute('data-xmore'); })[0]; if (!d) return;
      docMenu(d, tree, years, known);
    }, $('main'));
    // ลบไฟล์ (ผู้ใช้ขอ 23/11/69): ปุ่มถังขยะบนไฟล์ — ยืนยันก่อน
    on('[data-xdel]', 'click', function (el, e) {
      e.preventDefault(); e.stopPropagation();
      var d = D.docs.filter(function (x) { return x.id === el.getAttribute('data-xdel'); })[0]; if (!d) return;
      ask({ title: 'ลบไฟล์ "' + d.title + '"?', text: 'ไฟล์ ' + d.fileName + ' จะถูกย้ายไปถังขยะของ Google Drive และหายจากโฟลเดอร์', ok: 'ลบไฟล์', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
        if (!yes) return;
        el.disabled = true;
        call('sheDeleteDoc', state.token, d.id).then(function (r) { if (!r.ok) { el.disabled = false; return toast(r.error); } D.docs = D.docs.filter(function (x) { return x.id !== d.id; }); toast('ลบไฟล์แล้ว'); docsPage(); }).catch(onServerError);
      });
    }, $('main'));
  }
  // สร้างโฟลเดอร์เอง (ผู้ใช้ขอ 23/11/69): ในปี = โฟลเดอร์หลัก (หมวด) · ในโฟลเดอร์หลัก = โฟลเดอร์ย่อย · มีให้ทุกปีเหมือนกัน (เก็บใน docCats)
  // สร้างโฟลเดอร์ชั้นบนสุด: พิมพ์ปี พ.ศ. = โฟลเดอร์ปี (มีหมวดเหมือนปีอื่น) · พิมพ์ข้อความ = โฟลเดอร์ตั้งชื่อเอง
  // เปลี่ยนชื่อโฟลเดอร์ชั้นบน (ผู้ใช้ขอ 23/11/69): ปี → ปีอื่น หรือชื่ออื่น (หมวดของปีติดไปด้วย) · ชื่อ → ชื่ออื่น
  function renameRoot(y) {
    var D = H.docs, isY = typeof y === 'number', n = D.docs.filter(function (d) { return d.year === y; }).length;
    openModal({ color: state.dept.color, icon: 'pen', title: 'เปลี่ยนชื่อโฟลเดอร์ "' + (isY ? 'ปี ' + y : y) + '"',
      sub: n ? 'ไฟล์ข้างใน ' + n + ' ไฟล์ย้ายตามไปด้วย' : 'โฟลเดอร์นี้ยังไม่มีไฟล์',
      body: F('dRnName', 'ชื่อใหม่ *', isY ? String(y) : y, 'text', ' maxlength="60" placeholder="เช่น 2571 หรือ เอกสารตรวจประจำปี" autocomplete="off"')
        + '<p class="muted" style="font-size:13px;margin:8px 0 0">' + (isY ? 'พิมพ์ปี พ.ศ. 4 หลัก = ยังเป็นโฟลเดอร์ปี · พิมพ์ข้อความอื่น = เป็นโฟลเดอร์ตั้งชื่อเอง (หมวด / หมวดย่อยของปีนี้ติดไปด้วย)' : 'โฟลเดอร์ที่ตั้งชื่อเองเปลี่ยนเป็นชื่ออื่นได้ (ไม่ใช่ตัวเลขปี)') + '</p>',
      ok: 'บันทึกชื่อใหม่',
      check: function () {
        var v = $('dRnName').value.replace(/^ปี\s*/, '').trim();
        if (!v) return 'ใส่ชื่อโฟลเดอร์ใหม่';
        if (/›/.test(v)) return 'ห้ามใช้เครื่องหมาย ›';
        var yv = /^\d{4}$/.test(v) ? +v : null;
        if (yv != null && (yv < 2500 || yv > 2700)) return 'ปี พ.ศ. ต้องอยู่ระหว่าง 2500–2700';
        if (yv != null && !isY) return 'โฟลเดอร์ที่ตั้งชื่อเองเปลี่ยนเป็นปีไม่ได้';
        if (String(yv != null ? yv : v) === String(y)) return 'ชื่อเหมือนเดิม';
        if ((yv != null && D.years.indexOf(yv) >= 0) || (D.roots || []).some(function (r) { return r.name === v; })) return 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว';
        return '';
      },
      submit: function () {
        return call('sheRenameDocRoot', state.token, y, $('dRnName').value.trim()).then(function (r) {
          if (!r.ok) return r.error;
          D.years = r.years; D.roots = r.roots; D.docs = r.docs.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
          closeModal(); toast('เปลี่ยนชื่อโฟลเดอร์แล้ว' + (r.moved ? ' (ย้ายไฟล์ ' + r.moved + ' ไฟล์)' : ''));
          H.q.dHist = []; H.q.dPath = [r.to]; docsPage();
        });
      } });
  }
  function newRoot() {
    var D = H.docs, roots = D.roots || [];
    var parse = function () { var t = String(v('dRootName') || '').replace(/\s+/g, ' ').trim(), m = /^(?:ปี\s*)?(\d{4})$/.exec(t); return m ? { year: +m[1] } : { name: t }; };
    openModal({ title: 'สร้างโฟลเดอร์ใหม่', sub: 'ชั้นบนสุดของแฟ้มเอกสาร', icon: 'folder', color: state.dept.color, ok: 'สร้างโฟลเดอร์',
      body: F('dRootName', 'ชื่อโฟลเดอร์ *', '', 'text', ' maxlength="60" placeholder="เช่น ใบอนุญาต / สัญญา / 2571" autocomplete="off"')
        + '<div class="sxprev" id="dRootPrev" aria-live="polite"></div>'
        + '<p class="muted" style="margin:8px 0 0">พิมพ์ชื่ออะไรก็ได้ เช่น ใบอนุญาต · ถ้าพิมพ์ปี พ.ศ. 4 หลัก (เช่น 2571) จะได้โฟลเดอร์ปีที่มีหมวดเหมือนปีอื่น</p>',
      onOpen: function () {
        var upd = function () { var x = parse(); $('dRootPrev').innerHTML = x.year ? '<span class="sxsm">' + FOLDER_SVG + '</span> ปี ' + x.year + ' <small class="muted">(มีหมวดเหมือนปีอื่น)</small>' : x.name ? '<span class="sxsm">' + FOLDER_SVG + '</span> ' + esc(x.name) : ''; };
        $('dRootName').addEventListener('input', upd); $('dRootName').focus();
      },
      submit: function () {
        var x = parse();
        if (x.year) {
          if (!(x.year >= 2500 && x.year <= 2700)) return 'ปี พ.ศ. ต้องอยู่ระหว่าง 2500–2700 เช่น 2571';
          if (D.years.indexOf(x.year) >= 0) return 'มีโฟลเดอร์ปี ' + x.year + ' อยู่แล้ว';
          return call('sheDocYears', state.token, D.years.concat([x.year])).then(function (r) { if (!r.ok) return r.error; D.years = r.years; closeModal(); toast('สร้างโฟลเดอร์ปี ' + x.year + ' แล้ว'); goDoc([x.year]); });
        }
        if (!x.name) return 'ใส่ชื่อโฟลเดอร์';
        if (x.name.indexOf('›') >= 0) return 'ชื่อโฟลเดอร์ห้ามมีเครื่องหมาย ›';
        if (/^\d+$/.test(x.name)) return 'ชื่อที่เป็นตัวเลขล้วนใช้ได้เฉพาะปี พ.ศ. 4 หลัก';
        var k = function (t) { return String(t).replace(/\s+/g, '').toLowerCase(); };
        if (roots.some(function (r) { return k(r.name) === k(x.name); })) return 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว';
        return call('sheDocRoots', state.token, roots.concat([{ name: x.name, cats: [] }])).then(function (r) { if (!r.ok) return r.error; D.roots = r.roots; closeModal(); toast('สร้างโฟลเดอร์ "' + x.name + '" แล้ว'); goDoc([x.name]); });
      } });
  }
  function newFolder(tree, y, mi) {
    var D = H.docs, parent = mi != null ? tree[mi] : null, named = typeof y === 'string';
    var mainNo = function (name) { var mm = /^หมวด\s*(\d+)/.exec(name); return mm ? +mm[1] : null; };
    var auto = function (name) {
      if (!parent) {
        if (/^หมวด/.test(name)) return name;
        var n = tree.reduce(function (a, x) { return Math.max(a, mainNo(x.name) || 0); }, 0) + 1;
        return 'หมวด ' + n + ' ' + name;
      }
      var no = mainNo(parent.name); if (no == null || /^\d+(\.\d+)*\s/.test(name)) return name;
      var k = parent.subs.reduce(function (a, x) { var mm = new RegExp('^' + no + '\\.(\\d+)').exec(x); return Math.max(a, mm ? +mm[1] : 0); }, 0) + 1;
      return no + '.' + k + ' ' + name;
    };
    var finalName = function () { var nm = String(v('dDirName') || '').replace(/\s+/g, ' ').trim(); return nm && !named && $('dDirAuto').checked ? auto(nm) : nm; };
    openModal({ title: parent ? 'สร้างโฟลเดอร์ย่อย' : 'สร้างโฟลเดอร์ใหม่', sub: parent ? 'ใน ' + parent.name : named ? 'ใน ' + y : 'โฟลเดอร์หลัก (หมวด)', icon: 'folder', color: state.dept.color, ok: 'สร้างโฟลเดอร์',
      body: F('dDirName', 'ชื่อโฟลเดอร์ *', '', 'text', ' maxlength="80" placeholder="' + (parent ? 'เช่น การตรวจวัดเสียง' : 'เช่น การตรวจระบบไฟฟ้า') + '" autocomplete="off"')
        + (named ? '' : '<label class="pchk" style="margin-top:8px"><input type="checkbox" id="dDirAuto" checked> ใส่เลขลำดับให้อัตโนมัติ</label>')
        + '<div class="sxprev" id="dDirPrev" aria-live="polite"></div>'
        + (named ? '' : '<p class="muted" style="margin:8px 0 0">โฟลเดอร์นี้จะมีในทุกปี (ปี ' + esc(H.docs.years.join(', ')) + ') เหมือนโฟลเดอร์อื่น · แก้ชื่อหรือลบภายหลังได้ที่ "แก้หมวด" ในหน้าปี</p>'),
      onOpen: function () {
        var upd = function () { var nm = finalName(); $('dDirPrev').innerHTML = nm ? '<span class="sxsm">' + FOLDER_SVG + '</span> ' + esc(nm) : ''; };
        $('dDirName').addEventListener('input', upd); if ($('dDirAuto')) $('dDirAuto').addEventListener('change', upd); $('dDirName').focus();
      },
      submit: function () {
        var nm = finalName();
        if (!nm) return 'ใส่ชื่อโฟลเดอร์';
        if (nm.indexOf('›') >= 0) return 'ชื่อโฟลเดอร์ห้ามมีเครื่องหมาย ›';
        var bare = function (x) { return String(x).replace(/^(หมวด\s*)?\d+(\.\d+)*\s*/, '').replace(/\s+/g, ''); };   // เทียบชื่อโดยไม่สนเลขลำดับ
        var same = (parent ? parent.subs : tree.map(function (x) { return x.name; })).some(function (x) { return bare(x) === bare(nm); });
        if (same) return 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว';
        if (named) {   // โฟลเดอร์ตั้งชื่อเอง: เก็บใน roots
          var rs = JSON.parse(JSON.stringify(D.roots || [])), ro = rs.filter(function (x) { return x.name === y; })[0];
          if (!ro) return 'ไม่พบโฟลเดอร์ ' + y;
          if (parent) ro.cats[mi].subs.push(nm); else ro.cats.push({ name: nm, subs: [] });
          return call('sheDocRoots', state.token, rs).then(function (r) {
            if (!r.ok) return r.error;
            D.roots = r.roots; closeModal(); toast('สร้างโฟลเดอร์ "' + nm + '" แล้ว');
            var t3 = rootTree(rootOf(y));
            goDoc(parent ? [y, mi, t3[mi].subs.indexOf(nm)] : [y, t3.length - 1]);
          });
        }
        if (parent && /^หมวด/.test(nm)) return 'ชื่อโฟลเดอร์ย่อยห้ามขึ้นต้นด้วยคำว่า "หมวด" (ระบบจะนับเป็นโฟลเดอร์หลัก)';
        var lines = [];
        tree.forEach(function (x, i) { lines.push(x.name); x.subs.forEach(function (s2) { lines.push(s2); }); if (parent && i === mi) lines.push(nm); });
        if (!parent) lines.push(nm);
        return call('sheDocCats', state.token, lines.join('\n')).then(function (r) {
          if (!r.ok) return r.error;
          D.cats = r.cats; closeModal(); toast('สร้างโฟลเดอร์ "' + nm + '" แล้ว');
          var t2 = docTree(D.cats), q = H.q;
          q.dHist = (q.dHist || []).concat([q.dPath || []]);
          q.dPath = parent ? [y, mi, t2[mi].subs.indexOf(nm)] : [y, t2.length - 1];   // เข้าไปในโฟลเดอร์ใหม่เลย
          docsPage();
        });
      } });
  }
  // เมนู ⋮ ของไฟล์: เปิดดู / ดาวน์โหลด / แก้ไข (ชื่อ ปี หมวด หมายเหตุ) / ลบ
  function docMenu(d, tree, years, known) {
    var D = H.docs, k = docKind(d.fileName) || ['', '?', 'ไฟล์'];
    openModal({ title: d.title, icon: 'folder', color: state.dept.color, noCancel: true, ok: 'ปิด',
      body: '<p class="muted">' + esc(d.fileName) + ' · ' + k[2] + ' · ' + docSize(d.size) + ' · อัปโหลด ' + esc(String(d.createdAt).slice(0, 16)) + (d.by ? ' โดย ' + esc(d.by) : '') + (d.note ? '<br>หมายเหตุ: ' + esc(d.note) : '') + '</p>'
        + '<div class="sxmenu"><a class="btn btn-primary" href="' + esc(d.url) + '" target="_blank" rel="noopener">เปิดดู</a>'
        + '<a class="btn btn-line" href="https://drive.google.com/uc?export=download&id=' + encodeURIComponent(d.fileId) + '" target="_blank" rel="noopener">' + icon('dl', 16) + ' ดาวน์โหลด</a>'
        + '<button class="btn btn-line" id="xEdit">' + icon('pen', 16) + ' แก้ไข / ย้ายโฟลเดอร์</button><button class="btn btn-line sddel" id="xDel">' + icon('trash', 16) + ' ลบ</button></div>',
      submit: function () { closeModal(); } });
    $('xEdit').addEventListener('click', function () {
      // โฟลเดอร์ (หมวด) ตามโฟลเดอร์ชั้นบนที่เลือก — ปีใช้หมวดร่วม · โฟลเดอร์ตั้งชื่อเองมีโฟลเดอร์ย่อยของตัวเอง + "ไว้ในโฟลเดอร์นี้โดยตรง"
      var allRoots = years.concat((D.roots || []).map(function (x) { return x.name; }));
      var catOpts = function (rv) {
        var t = treeFor(rv), kn = {}; t.forEach(function (mm) { mm.leaves.forEach(function (l) { kn[l.key] = 1; }); });
        var same = rv === d.year, named = typeof rv === 'string';
        return (named ? '<option value=""' + (same && d.category === '' ? ' selected' : '') + '>(ไว้ใน ' + esc(rv) + ' โดยตรง)</option>' : '')
          + (same && !kn[d.category] && !(named && d.category === '') ? '<option value="' + esc(d.category) + '" selected>' + esc(d.category || '— ยังไม่ได้จัดหมวด —') + '</option>' : '')
          + t.map(function (mm) { return '<optgroup label="' + esc(mm.name) + '">' + mm.leaves.map(function (l) { return '<option value="' + esc(l.key) + '"' + (same && l.key === d.category ? ' selected' : '') + '>' + esc(l.label) + '</option>'; }).join('') + '</optgroup>'; }).join('');
      };
      var rootVal = function () { var i = +$('deYear').value; return allRoots[i]; };
      openModal({ title: 'แก้ข้อมูลเอกสาร', icon: 'pen', color: state.dept.color, ok: 'บันทึก',
        body: F('deTitle', 'ชื่อเอกสาร', d.title) + '<div class="pf"><label for="deYear">โฟลเดอร์ชั้นบน (ปี / ชื่อโฟลเดอร์)</label><select id="deYear">' + allRoots.map(function (yy, i) { return '<option value="' + i + '"' + (yy === d.year ? ' selected' : '') + '>' + esc(rootLabel(yy)) + '</option>'; }).join('') + '</select></div>'
          + '<div class="pf"><label for="deCat">โฟลเดอร์ (หมวด)</label><select id="deCat">' + catOpts(d.year) + '</select></div>' + F('deNote', 'หมายเหตุ', d.note),
        onOpen: function () { $('deYear').addEventListener('change', function () { $('deCat').innerHTML = catOpts(rootVal()); }); },
        submit: function () {
          if (!v('deTitle')) return 'ใส่ชื่อเอกสาร';
          return call('sheUpdateDoc', state.token, d.id, { title: v('deTitle'), category: $('deCat').value, year: rootVal(), note: v('deNote') }).then(function (r) {
            if (!r.ok) return r.error; Object.assign(d, r.doc); closeModal(); toast('บันทึกแล้ว'); docsPage();
          });
        } });
    });
    $('xDel').addEventListener('click', function () {
      ask({ title: 'ลบเอกสาร "' + d.title + '"?', text: 'ไฟล์ ' + d.fileName + ' จะถูกย้ายไปถังขยะของ Google Drive และหายจากโฟลเดอร์', ok: 'ลบเอกสาร', cancel: 'ไม่ลบ', tone: 'danger' }).then(function (yes) {
        if (!yes) return;
        call('sheDeleteDoc', state.token, d.id).then(function (r) { if (!r.ok) return toast(r.error); D.docs = D.docs.filter(function (x) { return x.id !== d.id; }); closeModal(); toast('ลบแล้ว'); docsPage(); }).catch(onServerError);
      });
    });
  }
  function readB64(file) {
    return new Promise(function (ok, fail) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); }; fr.onerror = function () { fail(new Error('อ่านไฟล์ไม่ได้')); }; fr.readAsDataURL(file); });
  }
  function uploadDocs(files, year, cat) {
    var q = H.q, D = H.docs, by = $('dBy') ? $('dBy').value.trim() : (q.dBy || '');
    q.dBy = by;
    var bad = files.filter(function (f) { return !docKind(f.name) || f.size > 20 * 1024 * 1024; });
    var good = files.filter(function (f) { return bad.indexOf(f) < 0; });
    var done = 0, fails = [];
    if (bad.length) toast('ข้าม ' + bad.length + ' ไฟล์ (ไม่ใช่ Word / Excel / PowerPoint / PDF หรือใหญ่เกิน 20 MB)');
    if (!good.length) return;
    var show = function (cur) { var prog = $('dProg'); if (prog) prog.innerHTML = '<div class="sdprog"><span class="spinner dark"></span> กำลังอัปโหลด ' + (done + 1) + '/' + good.length + ' · ' + esc(cur) + '</div>'; };
    var i = 0;
    (function next() {
      if (i >= good.length) {
        toast(fails.length ? 'อัปโหลดได้ ' + done + ' ไฟล์ · ไม่สำเร็จ ' + fails.length + ' (' + fails.join(', ') + ')' : '✓ อัปโหลด ' + done + ' ไฟล์แล้ว');
        if (state.page === 's_doc') docsPage();
        return;
      }
      var f = good[i++]; show(f.name);
      readB64(f).then(function (b64) {
        return call('sheUploadDoc', state.token, { year: year, category: cat, by: by }, f.name, f.type || 'application/octet-stream', b64);
      }).then(function (r) { if (!r.ok) throw new Error(r.error); D.docs.unshift(r.doc); done++; })
        .catch(function (e) { if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e); fails.push(f.name); console.warn(e); })
        .then(next);
    })();
  }

  // แบบฟอร์มสำหรับพิมพ์ (หน้าตาตามไฟล์ Excel ของฝ่าย + หัวกระดาษแบบรายงานอื่นของระบบ)
  function stmHtml(form, rec, fm, ym) {
    var def = SHEM[form], nI = def.items.length, rows = (rec && rec.rows) || [], n = Math.max(def.rows, rows.length);
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    var head = '<div class="shead">' + logoHtml() + '<div class="sco"><b>' + COMPANY_TH + '</b><span>' + COMPANY_EN + '</span></div><div class="stitle">' + esc(def.title) + '</div><div class="sfm">' + esc(fm || '').replace(' วันที่', '<br>วันที่') + '</div></div>'
      + '<div class="smmonth">ประจำเดือน <b>' + TH_MONTHS[m - 1] + '</b> พ.ศ. <b>' + (y + 543) + '</b></div>';
    var th = '<tr><th rowspan="2" class="smno">' + def.no + '</th><th rowspan="2" class="smloc">' + esc(def.loc) + '</th><th colspan="' + nI + '">' + esc(def.group) + '</th>' + (def.sum ? '<th rowspan="2" class="smsumh">' + def.sum + '</th>' : '') + '<th rowspan="2" class="smnote">' + def.note + '</th></tr>'
      + '<tr>' + def.items.map(function (x) { return '<th class="smi' + (def.smoke ? ' long' : '') + '">' + x + '</th>'; }).join('') + '</tr>';
    var tb = '';
    for (var i = 0; i < n; i++) {
      var row = rows[i] || { loc: '', r: [], note: '' };
      tb += '<tr><td class="c">' + (row.loc ? i + 1 : '') + '</td><td>' + esc(row.loc) + '</td>' + def.items.map(function (x, j) { var c = row.r[j] || ''; return '<td class="c smr s' + (c || 'e') + '">' + mSym(def, c) + '</td>'; }).join('')
        + (def.sum ? '<td class="c">' + mSum(def, row.r) + '</td>' : '') + '<td>' + esc(row.note) + '</td></tr>';
    }
    var line = function (label, name, role, date) { return '<div class="smsg"><b>' + label + '</b><div>ลงชื่อ <span>' + esc(name || '') + '</span></div><div class="smrole">' + role + '</div><div>วันที่ <span>' + thd(date) + '</span></div></div>'; };
    var sign = def.smoke
      ? '<div class="smsigns s3">' + line('ผู้ทดสอบ', rec && rec.tester, 'เจ้าหน้าที่อาคารสถานที่', rec && rec.testDate) + line('ผู้ตรวจสอบ', rec && rec.inspector, 'จป.วิชาชีพ', rec && rec.inspDate) + line('ผู้ตรวจสอบ', rec && rec.approver, 'ผู้จัดการ', rec && rec.approveDate) + '</div>'
      : '<div class="smsigns">' + line('ตรวจสอบโดย', rec && rec.inspector, 'จป.วิชาชีพ', rec && rec.inspDate) + line('อนุมัติโดย', rec && rec.approver, 'ผู้จัดการ', rec && rec.approveDate) + '</div>';
    var body = '<table class="stm' + (def.land ? ' land' : '') + '"><thead>' + th + '</thead><tbody>' + tb + '</tbody></table>'
      + '<div class="smleg">' + def.legend + '</div>' + sign;
    return '<div class="sreport smrep' + (def.land ? '' : ' port') + '"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
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
      + Object.keys(SHEM).map(function (k) { return F('sFm' + k.replace('-', ''), 'รหัสแบบฟอร์ม ' + SHEM[k].name, s['fm' + k.replace('-', '')] || 'FM-SHE-' + k + ' Rev.00 วันที่ประกาศใช้ 05/01/2026'); }).join('')
      + T('sInsp', 'รายชื่อผู้ตรวจ (คั่นด้วย , )', s.inspectors, 'เช่น สมชาย, สมหญิง') + T('sDepts', 'หน่วยงาน / แผนก / ฝ่าย (คั่นด้วย , )', s.depts)
      + F('sPrep', 'FM-05 จัดทำโดย (ตำแหน่ง)', s.signPrep) + F('sAppr', 'FM-05 อนุมัติโดย (ตำแหน่ง)', s.signApprove)
      + F('sChk', 'FM-06 ผู้ตรวจสอบ', s.signCheck) + F('sRev', 'FM-06 ผู้ทวนสอบ', s.signReview)
      + '</div><button class="btn btn-primary" id="sSave">' + icon('check', 16) + ' บันทึกการตั้งค่า</button></div>';
    $('aNew').addEventListener('click', function () { areaModal(null); });
    on('[data-area]', 'click', function (el) { areaModal(area(el.getAttribute('data-area'))); }, $('main'));
    $('sSave').addEventListener('click', function () {
      var b = $('sSave'); b.disabled = true;
      var fmx = {}; Object.keys(SHEM).forEach(function (k) { var id = 'fm' + k.replace('-', ''); if ($('sFm' + k.replace('-', ''))) fmx[id] = v('sFm' + k.replace('-', '')); });
      call('sheSaveSettings', state.token, Object.assign(fmx, { fm05: v('sFm05'), fm06: v('sFm06'), inspectors: v('sInsp'), depts: v('sDepts'), signPrep: v('sPrep'), signApprove: v('sAppr'), signCheck: v('sChk'), signReview: v('sRev') }))
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
    '.sedit{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:600;color:var(--c);white-space:nowrap}.sedit svg{width:15px;height:15px}.s6imgs{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.s6imgs figure{margin:0;text-align:center;font-size:9px;color:#475569}.s6imgs img{height:70px;width:auto;max-width:110px;object-fit:cover;border-radius:4px;display:block}.sshot.lib{border-style:solid;background:#fff}.sshot{width:96px;height:96px;border:2px dashed var(--c);border-radius:10px;background:color-mix(in srgb,var(--c) 7%,white);color:var(--c);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:600;line-height:1.2}',
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
    '.sseen{display:block;color:#7c3aed;font-size:12px}.srepeat{display:block}.srph{display:flex;gap:10px;align-items:flex-start}.srph img{width:72px;height:72px;object-fit:cover;border-radius:8px;flex:none}.srpn{font-size:12.5px;color:#5b21b6;background:#f5f3ff;border-radius:8px;padding:6px 8px;margin:6px 0}.srpb{display:flex;gap:14px;flex-wrap:wrap}',
    '.sdup{background:#f5f3ff;border:1.5px solid #ddd6fe;font-size:14px;margin-bottom:12px}.sdupr{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px dashed #ddd6fe;margin-top:8px}.sdupr small{display:block;color:var(--muted);font-size:12px}',
    '.srecent{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.src{border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:4px;font-size:13px;cursor:pointer}.src img,.src .snoimg{width:100%;height:110px;object-fit:cover;border-radius:8px}.src span{color:#334155}',
    // รายงาน FM-05 / FM-06 (A4 แนวนอน)
    '.sabst{display:inline-block;font-size:11.5px;font-weight:700;color:var(--s);background:color-mix(in srgb,var(--s) 12%,white);border-radius:99px;padding:1px 8px;vertical-align:1px}.sab1{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#334155!important}',
    '.li.sabli{grid-template-columns:auto 1fr auto}.sabli img{grid-row:1/3;width:76px;height:76px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0}.li.sabli small{grid-column:2/-1}',
    '.sabsec{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-top:12px}.sabh{font-weight:800;color:#fff;background:var(--c);border-radius:8px;padding:6px 10px;margin:-2px -2px 10px;font-size:14px}',
    '.sabchk{display:flex;flex-wrap:wrap;gap:8px}.sabchk label{display:flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:14px;background:#fff}.sabchk label:has(input:checked){border-color:var(--c);background:color-mix(in srgb,var(--c) 10%,white);font-weight:700}.sabchk input{width:18px;height:18px;margin:0;accent-color:var(--c)}',
    '.sabnote{margin:12px 0 0;font-size:12.5px;color:#b91c1c;font-style:italic}',
    '.sabform{max-width:820px;margin-left:auto;margin-right:auto;font-size:14px}.sabtitle{text-align:center;margin-bottom:8px}.sabtitle b{display:block;font-size:22px}.sabtitle span{font-family:Arial,sans-serif;font-weight:700;font-size:13px}',
    '.sabt{width:100%;border-collapse:collapse;table-layout:fixed}.sabt td,.sabt th{border:1px solid #a6b0ba;padding:6px 8px;vertical-align:top;text-align:left;line-height:1.6}.sabt th{background:#dbe5f1;color:#1f3864;font-weight:700}.sabx{font-size:16px}',
    '.sabdot{display:inline-block;min-width:160px;border-bottom:1px dotted #475569;height:1em}.sabbox{min-height:70px;white-space:pre-wrap}.sabpics{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px}.sabpics img{width:100%;max-height:200px;object-fit:contain;border:1px solid #e2e8f0}.sabnote2{font-style:italic;font-size:12.5px;margin:8px 0 0;text-align:center}',
    '@media print{.sabform{font-size:11pt;max-width:none}.sabpics img{max-height:55mm}.sabt tr{break-inside:avoid}}',
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
    '.smfs{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:0 0 14px}.smf{border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:9px 11px;text-align:left;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:2px}.smf b{font-size:12.5px;color:var(--muted)}.smf span{font-weight:700}.smf small{font-size:12px;color:var(--muted)}.smf small.ok{color:#15803d;font-weight:700}.smf small.bad{color:#b91c1c;font-weight:700}.smf.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 10%,white)}',
    '.smhead{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 10px}.smhead b{display:block;font-size:17px}.smhead small{color:var(--muted)}.smempty{display:flex;flex-direction:column;gap:4px}.smempty span{color:var(--muted)}',
    '.smcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:12px}.smcard{min-width:0}.smcard{background:#fff;border:1.5px solid var(--line);border-left:6px solid #cbd5e1;border-radius:14px;padding:12px;box-shadow:var(--shadow)}.smcard.ok{border-left-color:#16a34a}.smcard.bad{border-left-color:#dc2626;background:#fffafa}',
    '.smch{display:flex;align-items:center;gap:8px;margin-bottom:8px}.smnum{flex:none;width:28px;height:28px;border-radius:50%;background:#f1f5f9;display:grid;place-items:center;font-weight:700;font-size:13px}.smloc{flex:1;min-width:0;border:1.5px solid transparent;border-radius:8px;padding:8px;font:inherit;font-weight:700;font-size:16px;background:transparent}.smloc:hover,.smloc:focus{border-color:var(--line);background:#fff;outline:none}.smloc:placeholder-shown{border-color:#fca5a5}',
    '.smbadge{flex:none;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:#f1f5f9;color:#475569}.smbadge.ok{background:#dcfce7;color:#15803d}.smbadge.bad{background:#fee2e2;color:#b91c1c}.smicon{flex:none;width:40px;height:40px;border:0;border-radius:10px;background:none;color:#94a3b8;cursor:pointer}.smicon:hover{background:#fef2f2;color:#dc2626}',
    '.smitems{display:flex;flex-direction:column;gap:8px}.smrow{display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px dashed var(--line)}.smlab{font-size:14px;font-weight:600;color:#334155}.smlab small{font-weight:400;color:var(--muted)}',
    '.smseg{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:6px}.smo{min-height:44px;border:1.5px solid var(--line);border-radius:10px;background:#fff;font:inherit;font-size:14px;font-weight:600;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:4px}.smo i{font-style:normal;font-weight:800}',
    '.smo.oP.on{background:#16a34a;border-color:#16a34a;color:#fff}.smo.oX.on{background:#dc2626;border-color:#dc2626;color:#fff}.smo.oO.on{background:#ea580c;border-color:#ea580c;color:#fff}.smo.oN.on{background:#64748b;border-color:#64748b;color:#fff}.smo:focus-visible{outline:3px solid var(--c);outline-offset:1px}',
    '.smfoot{display:flex;flex-direction:column;gap:8px;margin-top:10px}.smallok{align-self:flex-start;min-height:40px;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#15803d;border-radius:10px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}.smnote span{display:block;font-size:13px;color:var(--muted);margin-bottom:3px}.smnote em,.smpt em{font-style:normal;font-weight:400;color:var(--muted);font-size:12.5px}.smnote input{width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.sdup .pform{margin:8px 0}.sddrop{display:flex;flex-direction:column;align-items:center;gap:4px;border:2px dashed var(--line);border-radius:14px;padding:22px 12px;text-align:center;cursor:pointer;background:#fafafa;color:var(--muted)}.sddrop b{color:var(--ink)}.sddrop.over,.sddrop:hover{border-color:var(--c, #ea580c);background:#fff7ed}',
    '.sdprog{margin-top:10px;font-weight:600}.sdoc{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.sdoc:first-of-type{border-top:0}.sdic{flex:0 0 44px;height:44px;border-radius:10px;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px}',
    '#dTerm{flex:1 1 200px;min-width:0;padding:9px 11px;border:1.5px solid var(--line);border-radius:10px;font:inherit}.sdmh{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:4px 2px;font:inherit;text-align:left;cursor:pointer;color:var(--ink)}.sdmh b{font-size:17px;flex:1}.sdcnt{color:var(--muted);font-size:13.5px;white-space:nowrap}.sdchev{font-style:normal;font-size:18px;color:var(--muted);width:20px;text-align:center}.sdmain:not(.open):hover{background:#fff7ed}.sdbody{margin-top:6px}.sdmain h4{margin-bottom:6px}.sdleaf{border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin-top:8px}.sdlh{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.sdlh .btn{width:auto;margin-left:auto}.sdnone{margin:6px 0 2px}.sdtx{flex:1;min-width:0}.sdtx b{display:block;overflow-wrap:anywhere}.sdtx small{display:block;color:var(--muted);overflow-wrap:anywhere}.sdbt{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.sdbt .btn{width:auto}.sddel{color:#dc2626}.sdempty{color:var(--muted)}',
    '@media (max-width:640px){.sdoc{flex-wrap:wrap}.sdbt{flex-basis:100%;justify-content:flex-start;padding-left:56px}}',
    '.sxprev{margin-top:10px;padding:10px 12px;border-radius:12px;background:#fffbeb;border:1px dashed #f59e0b;font-weight:700;display:flex;align-items:center;gap:8px;min-height:22px}.sxprev:empty{display:none}.sxprev .sxsm{width:22px;display:inline-flex}',
    '.sxwin{background:#fff;border:1px solid #d6dbe3;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,.06)}.sxbar{display:flex;align-items:center;gap:6px;padding:8px;background:#f3f6fa;border-bottom:1px solid #e2e8f0;flex-wrap:wrap}',
    '.sxnav{flex:0 0 36px;width:36px!important;min-width:0;padding:0;height:36px;border:1px solid transparent;border-radius:8px;background:none;font-size:18px;cursor:pointer;color:#334155}.sxnav:hover:not(:disabled){background:#e2e8f0}.sxnav:disabled{color:#cbd5e1;cursor:default}',
    '.sxcrumb{flex:1 1 280px;min-width:0;display:flex;align-items:center;flex-wrap:wrap;gap:2px;min-height:36px;background:#fff;border:1px solid #d6dbe3;border-radius:8px;padding:2px 6px}.sxcrumb button{border:0;background:none;font:inherit;font-size:14px;padding:4px 6px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;color:#1e293b}.sxcrumb button:hover{background:#e0ecff}.sxcrumb [aria-current]{font-weight:700}.sxsep{color:#94a3b8}',
    '.sxsm{display:inline-block;width:20px;height:18px;vertical-align:middle}.sxsm svg{width:100%;height:100%}.sxbar #dTerm{flex:1 1 180px;max-width:320px;min-width:0;padding:7px 10px;border:1px solid #d6dbe3;border-radius:8px;font:inherit;font-size:14px}',
    '.sxtools{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #eef2f6;flex-wrap:wrap}.sxtools .btn{width:auto!important;flex:0 0 auto}.sxcount{color:var(--muted);font-size:13px;margin-left:auto}.sxview{display:inline-flex;border:1px solid #d6dbe3;border-radius:8px;overflow:hidden}.sxview button{width:34px!important;min-width:0;padding:0;border:0;background:#fff;width:34px;height:30px;cursor:pointer;font-size:15px}.sxview button[aria-pressed=true]{background:#dbeafe;color:#1d4ed8}',
    '.sxbody{min-height:260px;padding:12px;position:relative}.sxbody.over{background:#eff6ff;outline:2px dashed #3b82f6;outline-offset:-8px}.sxgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}',
    '.sxitem{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:10px 6px;border:1px solid transparent;border-radius:8px;background:none;font:inherit;cursor:pointer;color:#0f172a}.sxitem:hover,.sxitem:focus-within{background:#e5f1fb;border-color:#cce4f7}',
    '.sxopen{display:flex;flex-direction:column;align-items:center;gap:4px;color:inherit;text-decoration:none;width:100%}.sxic{width:64px;height:54px;display:flex;align-items:center;justify-content:center}.sxic svg{max-width:64px;max-height:54px}.sxfile .sxic svg{height:54px;width:auto}',
    '.sxnm{font-size:13.5px;line-height:1.3;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.sxitem small{font-size:11.5px;color:var(--muted)}.sxmore{position:absolute;top:4px;right:4px;width:28px;height:28px;border:0;border-radius:6px;background:none;font-size:18px;cursor:pointer;color:#475569}.sxmore:hover{background:#cbd5e1}',
    '.sxtab{width:100%;border-collapse:collapse;font-size:14px}.sxtab th{text-align:left;font-weight:600;color:#475569;padding:6px 8px;border-bottom:1px solid #e2e8f0}.sxtab td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}.sxtab .r{text-align:right}.sxrow:hover{background:#e5f1fb}.sxrow[data-xgo]{cursor:pointer}',
    '.sxn a{color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:8px}.sxn{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sxn .sxsm{width:22px;height:22px}.sxn small{flex-basis:100%;color:var(--muted);font-size:12px;padding-left:30px}.sxtab .sxmore{position:static}.sxdelf{position:absolute;top:4px;left:4px;width:28px;height:28px;border:0;border-radius:6px;background:rgba(255,255,255,.85);cursor:pointer;color:#dc2626;display:inline-flex;align-items:center;justify-content:center;opacity:.75}.sxdelf:hover,.sxdelf:focus-visible{opacity:1;background:#fee2e2}.sxtab .sxdelf{position:static;margin-right:4px}.sxact{white-space:nowrap}@media(hover:hover){.sxitem .sxdelf{opacity:0}.sxitem:hover .sxdelf,.sxitem .sxdelf:focus-visible{opacity:1}}',
    '.sxempty{text-align:center;color:var(--muted);padding:50px 10px}.sxstatus{padding:8px 12px;border-top:1px solid #eef2f6;background:#f8fafc;font-size:13px;color:#475569}.sxstatus input{padding:4px 8px;border:1px solid #d6dbe3;border-radius:6px;font:inherit;font-size:13px;width:180px}.sxmenu{display:flex;flex-wrap:wrap;gap:8px}.sxmenu .btn{width:auto}',
    '@media (max-width:640px){.sxgrid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}.sxbar #dTerm{flex:1 1 100%;max-width:none}.sxcrumb{flex-basis:calc(100% - 90px)}.sxtab th:nth-child(2),.sxtab td:nth-child(2),.sxtab th:nth-child(3),.sxtab td:nth-child(3){display:none}}',
    '.smprob{border:1.5px solid #fecaca;background:#fff7f7;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}.smpt{font-weight:700;color:#b91c1c;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}',
    '.smdet span{display:block;font-size:13px;color:#7f1d1d;margin-bottom:3px}.smdet textarea{width:100%;padding:10px;border:1.5px solid #fca5a5;border-radius:10px;font:inherit;resize:vertical;background:#fff}.smdet.need span{font-weight:700;color:#b91c1c}.smdet.need textarea{border-color:#dc2626;box-shadow:0 0 0 3px #fee2e2}',
    '.smphs{display:flex;flex-wrap:wrap;gap:8px}.smph{position:relative;width:76px;height:76px;border-radius:10px;overflow:hidden;background:#fee2e2;display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;color:#7f1d1d;flex-direction:column}.smph img{width:76px;height:76px;object-fit:cover;display:block}',
    '.smphx{position:absolute;top:3px;right:3px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:13px;cursor:pointer;line-height:26px;padding:0}',
    '.smadd2{width:76px;height:76px;border:1.5px dashed #f87171;border-radius:10px;background:#fff;color:#b91c1c;font:inherit;font-size:12.5px;font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}.smadd2:active{background:#fee2e2}',
    '.smadd{display:flex;gap:8px;margin:14px 0}.smadd input{flex:1;min-width:0;padding:11px 12px;border:1.5px dashed #94a3b8;border-radius:12px;font:inherit}.smadd .btn{width:auto}.smsign{margin-bottom:12px}.smsign summary{cursor:pointer;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;padding:2px 0}.smsign[open] summary{margin-bottom:10px}.smdel{color:#b91c1c;width:auto}',
    '.smbar{position:sticky;bottom:0;z-index:5;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-top:12px;box-shadow:0 -4px 16px rgba(15,23,42,.10)}.smbar .btn{width:auto}.smprog{flex:1;min-width:0;font-size:14px}.smprog .bad{color:#b91c1c;font-weight:700}.smprog .dirty{color:#c2410c;font-weight:700}.smprog i{display:block;height:6px;background:#e2e8f0;border-radius:99px;margin-top:5px;overflow:hidden}.smprog s{display:block;height:100%;background:#16a34a;text-decoration:none}',
    '@media (max-width:700px){.smcards{grid-template-columns:minmax(0,1fr)}.smo{font-size:13px;gap:3px}.smbar{margin:12px -4px 0;border-radius:12px}.smbar .btn{padding:10px 12px}}',
    '.smrep .smmonth{text-align:center;margin:8px 0;font-size:14px}.stm{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed}.stm th{border:1px solid #0f172a;padding:4px;text-align:center;font-weight:700;background:#fff;font-size:12px}.stm th small{font-weight:400}.stm td{border:1px solid #0f172a;padding:3px 5px;height:22px;word-wrap:break-word}.stm .c{text-align:center}',
    '.stm .smno{width:6%}.stm .smloc{width:30%}.stm .smnote{width:16%}.stm .smsumh{width:14%}.stm.land .smloc{width:22%}.stm.land .smnote{width:20%}.stm th.smi.long{font-size:10.5px;font-weight:600}.stm .smr{font-size:15px;font-weight:700}.stm .smr.sX,.stm .smr.sO{color:#b91c1c}',
    '.smleg{margin-top:8px;font-size:12.5px}.smsigns{display:flex;justify-content:space-around;gap:16px;margin-top:20px;font-size:12.5px;break-inside:avoid}.smsigns.s3{flex-direction:column;align-items:flex-start;gap:10px;padding-left:6%}.smsigns.s3 .smsg{display:flex;gap:14px;align-items:baseline;text-align:left}.smsg{text-align:center;line-height:2}.smsg span{display:inline-block;min-width:170px;border-bottom:1px dotted #475569;text-align:center;line-height:1.5}.smrole{font-weight:600}',
    '@media print{.sreport{box-shadow:none;padding:0;margin:0;border-radius:0;overflow:visible}.st05{font-size:8.5pt}.st05 th{font-size:8pt}.sph img{max-height:34mm}.st06{font-size:7.5pt}.shead{padding:4px 8px}.slogo{height:36px}.stitle{font-size:11pt}.sfm{font-size:7.5pt}.sinfo{font-size:8.5pt}.st05 tr,.st06 tr{break-inside:avoid}.ssign{font-size:9pt}.ssave,.swalk-h .btn{display:none}}'
  ].join('\n');
  document.head.appendChild(css);
})();
