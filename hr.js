// ==================== ฝ่ายบุคคล (HR) ====================
// หน้าเว็บของโมดูล "hr" — index.html เรียก HRM.menus() / HRM.render(page)
// ข้อมูลอยู่ใน Google Sheet ของฝ่าย ผ่าน API Hr.gs (hrLoad, hrSaveEmp, ...) · ไฟล์เอกสาร/รูปเก็บในโฟลเดอร์ Drive ของฝ่าย (ไม่เปิดสาธารณะ)
// รูปพนักงาน: รูปย่อเก็บในชีต (โหลดด้วย hrPhotos) · รูปเต็มเก็บใน Drive
(function () {
  var H = window.HRM = { data: null, loading: null, q: {}, photos: {} };

  Object.assign(ICONS, {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h5M14 14h4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    gavel: '<path d="M14 13l-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>'
  });

  var MENUS = [
    { id: 'h_dash', label: 'ภาพรวม / Dashboard', ic: 'home' },
    { id: 'h_emp', label: 'ทะเบียนพนักงาน', ic: 'users' },
    { id: 'h_leave', label: 'การลา / ขาด / มาสาย', ic: 'cal' },
    { id: 'h_doc', label: 'เอกสาร & วันหมดอายุ', ic: 'idcard' },
    { id: 'h_train', label: 'การอบรม', ic: 'book' },
    { id: 'h_disc', label: 'วินัย / ใบเตือน', ic: 'gavel' },
    { id: 'h_rep', label: 'รายงาน / พิมพ์ PDF', ic: 'print' },
    { id: 'h_set', label: 'ตั้งค่า', ic: 'gear' },
    { id: 'h_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var LT = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', maternity: 'ลาคลอด', ordain: 'ลาบวช', military: 'ลารับราชการทหาร', training: 'ลาเพื่อฝึกอบรม', other: 'ลาอื่นๆ', absent: 'ขาดงาน', late: 'มาสาย' };
  var DT = { idcard: 'บัตรประชาชน', passport: 'พาสปอร์ต', visa: 'วีซ่า', workpermit: 'ใบอนุญาตทำงาน (Work Permit)', pink: 'บัตรชมพู / บัตรประจำตัวคนต่างด้าว',
    health: 'ตรวจสุขภาพประจำปี / ใบรับรองแพทย์', food: 'อบรมสุขาภิบาลอาหาร', driving: 'ใบขับขี่', contract: 'สัญญาจ้าง', other: 'อื่นๆ' };
  var DL = { verbal: 'ตักเตือนด้วยวาจา', written1: 'ใบเตือนครั้งที่ 1', written2: 'ใบเตือนครั้งที่ 2', suspend: 'พักงาน', terminate: 'เลิกจ้าง' };
  var STATUS = ['ทำงาน', 'ทดลองงาน', 'พักงาน', 'ลาออก'];
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var COMPANY_TH = 'บริษัท สปังกี้ ฟู้ด จำกัด', COMPANY_EN = 'Spunky Food Co., Ltd.';

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : esc(iso); }
  function thDate(iso) { if (!iso) return '-'; var p = String(iso).split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + (+p[0] + 543); }
  function days(a, b) { var p = a.split('-'), q = b.split('-'); return Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5); }
  function yrs(a) { if (!a) return ''; var n = days(a, H.data.today) / 365.25; return n < 1 ? Math.max(0, Math.round(n * 12)) + ' เดือน' : (Math.floor(n * 10) / 10) + ' ปี'; }
  function ymLabel(ym) { return MONTHS[+ym.slice(5, 7) - 1] + ' ' + (+ym.slice(0, 4) + 543); }
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
  function opts(arr, blank) { return (blank ? [['', blank]] : []).concat(arr.map(function (x) { return [x, x]; })); }
  function emp(id) { return H.idx[id] || null; }
  function active() { return H.data.emps.filter(function (e) { return e.status !== 'ลาออก'; }); }
  function uniq(arr) { return arr.filter(function (x, i, a) { return x && a.indexOf(x) === i; }); }
  function confirmBox(msg, fn) { openModal({ color: '#dc2626', icon: 'warn', title: 'ยืนยัน', body: '<p>' + esc(msg) + '</p>', ok: 'ยืนยัน', submit: fn }); }
  function photo(e, cls) {
    var src = e && H.photos[e.id];
    return src ? '<img class="' + (cls || 'hph') + '" src="' + src + '" alt="">' : '<span class="' + (cls || 'hph') + ' none">' + esc(String((e && (e.nickname || e.fullName)) || '?').replace(/^(นาย|นางสาว|นาง|คุณ|MISS\.?|MR\.?|MRS\.?)\s*/i, '').slice(0, 1)) + '</span>';
  }
  // ---------- สิทธิ์วันลา (นับตามปีปฏิทิน ม.ค.–ธ.ค. · ขึ้นปีใหม่เริ่มนับใหม่เอง) ----------
  var QK = ['sick', 'personal', 'vacation', 'maternity', 'ordain'];
  function quotaOf(e, k, year) {   // null = ไม่จำกัด/ไม่ได้ตั้ง · พักร้อน: ต้องทำงานครบ 1 ปี (ถ้ารู้วันเริ่มงาน)
    var q = (H.data.settings.quotaMap || {})[k];
    if (q == null || q === '' || QK.indexOf(k) < 0) return null;
    q = Number(q) || 0;
    if (k === 'vacation' && e && e.startDate) { var ref = year + '-12-31' < H.data.today ? year + '-12-31' : H.data.today; if (days(e.startDate, ref) < 365) return 0; }
    return q;
  }
  function usedOf(empId, k, year, skipId) {
    return H.data.leaves.filter(function (l) { return l.empId === empId && l.type === k && String(l.dateFrom).slice(0, 4) === year && l.status !== 'ไม่อนุมัติ' && l.id !== skipId; })
      .reduce(function (s, l) { return s + (k === 'late' ? 1 : Number(l.days) || 0); }, 0);
  }
  function loadedYear(y) { return y >= String(+H.data.today.slice(0, 4) - 1); }
  function empLabel(e) { return (e.code ? e.code + ' · ' : '') + e.fullName + (e.nickname ? ' (' + e.nickname + ')' : ''); }
  // ช่องเลือกพนักงาน (พิมพ์ค้นชื่อ/ชื่อเล่น/รหัส)
  function empField(id, label, empId) {
    var e = emp(empId);
    return '<div class="pf"><label for="' + id + '">' + label + '</label><input id="' + id + '" list="' + id + 'L" value="' + esc(e ? empLabel(e) : '') + '" placeholder="พิมพ์ชื่อ / ชื่อเล่น / รหัส">'
      + '<datalist id="' + id + 'L">' + active().concat(e && e.status === 'ลาออก' ? [e] : []).map(function (x) { return '<option value="' + esc(empLabel(x)) + '">'; }).join('') + '</datalist></div>';
  }
  function empIdOf(id) { var val = v(id), hit = H.data.emps.filter(function (x) { return empLabel(x) === val; })[0]; return hit ? hit.id : ''; }
  function fileLinks(files, kind, ownerId) {
    return (files || []).map(function (f) {
      return '<span class="hfile"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + icon('clip', 14) + esc(f.name) + '</a>'
        + (kind ? '<button type="button" class="link-btn danger" data-rmf="' + esc(f.id) + '" data-k="' + kind + '" data-o="' + esc(ownerId) + '">ลบ</button>' : '') + '</span>';
    }).join('');
  }

  // ---------- ไฟล์ / รูป ----------
  function pick(cb, cam, accept) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || 'image/*';
    if (cam) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function () { var f = Array.prototype.slice.call(inp.files || []); document.body.removeChild(inp); cb(f); });
    inp.click();
  }
  function readB64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = rej; r.readAsDataURL(blob); }); }
  function loadImg(file) { return new Promise(function (res, rej) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { res({ im: im, u: u }); }; im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('เปิดรูปไม่ได้')); }; im.src = u; }); }
  function canvasOf(im, w, h, crop) {
    var c = document.createElement('canvas'), sw = im.width, sh = im.height, sx = 0, sy = 0;
    if (crop) { var r = w / h; if (sw / sh > r) { sx = (sw - sh * r) / 2; sw = sh * r; } else { sy = (sh - sw / r) / 4; sh = sw / r; } }
    c.width = w; c.height = h; c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, w, h); return c;
  }
  // ไฟล์ → { b64, mime, name } (รูปใหญ่ย่อเหลือด้านยาว 1800px)
  function prepFile(file) {
    var mime = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
    if (mime === 'application/pdf') return readB64(file).then(function (d) { return { b64: d.split(',')[1], mime: mime, name: file.name }; });
    if (!/^image\//.test(mime)) return Promise.reject(new Error('แนบได้เฉพาะรูปภาพหรือ PDF'));
    return loadImg(file).then(function (x) {
      var k = Math.min(1, 1800 / Math.max(x.im.width, x.im.height)), c = canvasOf(x.im, Math.round(x.im.width * k), Math.round(x.im.height * k));
      URL.revokeObjectURL(x.u);
      return { b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg', name: (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg' };
    });
  }
  function uploadFiles(kind, ownerId, files) {
    var i = 0, fails = 0, out = null;
    function next() {
      if (i >= files.length) return Promise.resolve({ fails: fails, files: out });
      var f = files[i++]; toast('กำลังอัปโหลดไฟล์ ' + i + '/' + files.length + '…');
      return prepFile(f).then(function (p) { return call('hrUploadFile', state.token, kind, ownerId, p.name, p.mime, p.b64, ''); })
        .then(function (r) { if (!r.ok) throw new Error(r.error); out = r.files; }).catch(function () { fails++; }).then(next);
    }
    return next();
  }
  // รูปพนักงาน: รูปย่อ 240×300 (เก็บในชีต) + รูปเต็ม (Drive)
  function uploadPhoto(empId, file) {
    return loadImg(file).then(function (x) {
      var thumb = canvasOf(x.im, 240, 300, true).toDataURL('image/jpeg', 0.75);
      var k = Math.min(1, 1600 / Math.max(x.im.width, x.im.height)), full = canvasOf(x.im, Math.round(x.im.width * k), Math.round(x.im.height * k)).toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(x.u);
      return call('hrUploadFile', state.token, 'photo', empId, 'photo.jpg', 'image/jpeg', full.split(',')[1], thumb).then(function (r) { if (!r.ok) throw new Error(r.error); H.photos[empId] = thumb; return r; });
    });
  }
  function attachBtns(kind) {
    return '<button type="button" class="btn btn-sm btn-line" data-att="' + kind + '" data-src="cam">' + icon('camera', 16) + ' ถ่ายรูป</button>'
      + '<button type="button" class="btn btn-sm btn-line" data-att="' + kind + '" data-src="lib">' + icon('clip', 16) + ' เลือกไฟล์ / รูปจากเครื่อง</button>';
  }

  // ---------- โหลดข้อมูล ----------
  H.load = function () {
    if (H.loading) return H.loading;
    H.loading = call('hrLoad', state.token).then(function (d) {
      H.data = d; H.idx = {}; d.emps.forEach(function (e) { H.idx[e.id] = e; }); H.loading = null;
      if (!H.photosLoaded) { H.photosLoaded = true; call('hrPhotos', state.token).then(function (r) { if (r.ok) { H.photos = r.photos; if (String(state.page).indexOf('h_') === 0) H.render(state.page); } }).catch(function () { H.photosLoaded = false; }); }
      return d;
    }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  function reload(msg) {
    if (msg) toast(msg);
    return H.load().then(function () { if (String(state.page).indexOf('h_') === 0) H.render(state.page); }).catch(onServerError);
  }
  H.reset = function () { H.data = null; H.q = {}; H.photos = {}; H.photosLoaded = false; pageSize(''); };
  H.menus = function () { return MENUS; };
  H.render = function (page) {
    pageSize('');
    if (!H.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">กำลังโหลดข้อมูลจาก Google Sheet…</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      H.load().then(function () { if (state.page === page) H.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">เปิดข้อมูลไม่ได้</p><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet และโฟลเดอร์ของฝ่าย แล้วแชร์ให้บัญชีของระบบเป็นผู้แก้ไข</span></div></div>';
      });
      return;
    }
    ({ h_dash: dash, h_emp: emps, h_leave: leaves, h_doc: docs, h_train: trainings, h_disc: discs, h_rep: report, h_set: settings, h_log: logPage }[page] || dash)();
  };
  function pageSize(sz) {   // ขนาดกระดาษตอนพิมพ์ (แนวนอน/แนวตั้ง) ของรายงานที่เปิดอยู่
    var el = document.getElementById('hrPage');
    if (!sz) { if (el) el.parentNode.removeChild(el); return; }
    if (!el) { el = document.createElement('style'); el.id = 'hrPage'; document.head.appendChild(el); }
    el.textContent = '@page{size:A4 ' + sz + ';margin:9mm 9mm 12mm 9mm}';
  }

  // ==================== ภาพรวม / Dashboard ====================
  function dash() {
    var t = H.data.today, q = H.q;
    if (!q.from) { q.from = t.slice(0, 8) + '01'; q.to = t; }
    var quick = [['เดือนนี้', t.slice(0, 8) + '01', t], ['เดือนก่อน', addDays(t.slice(0, 8) + '01', -1).slice(0, 8) + '01', addDays(t.slice(0, 8) + '01', -1)],
      ['3 เดือน', addDays(t, -89), t], ['ปีนี้', t.slice(0, 4) + '-01-01', t]];
    $('main').innerHTML = '<h3>ภาพรวม ฝ่ายบุคคล</h3><p class="lead">ข้อมูล ณ ' + dd(t) + ' · <a href="' + esc(H.data.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + '<div class="pbar noprint"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<input type="date" id="dFrom" value="' + q.from + '"> – <input type="date" id="dTo" value="' + q.to + '"><button class="btn btn-sm btn-line" id="dPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div id="dOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>';
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['dFrom', 'dTo'].forEach(function (id) { $(id).addEventListener('change', function () { if (v('dFrom') && v('dTo') && v('dFrom') <= v('dTo')) { q.from = v('dFrom'); q.to = v('dTo'); dash(); } }); });
    $('dPrint').addEventListener('click', function () { window.print(); });
    var my = H.dseq = (H.dseq || 0) + 1;
    call('hrDashboard', state.token, q.from, q.to).then(function (r) {
      if (my !== H.dseq || state.page !== 'h_dash') return;
      $('dOut').innerHTML = r.ok ? H.dashHtml(r) : '<div class="panel">' + esc(r.error) + '</div>';
      on('[data-emp]', 'click', function (el) { profile(el.getAttribute('data-emp')); }, $('dOut'));
    }).catch(onServerError);
  }
  // ใช้ร่วมกับ Dashboard ผู้บริหาร (executive.js)
  H.dashHtml = function (r) {
    var h = r.head, L = r.leave, D = r.docs, Tn = r.training;
    var tile = function (val, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + val + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var box = function (title, rows, empty) { return '<div class="panel pbox"><h4>' + title + '</h4>' + (rows.length ? rows.join('') : '<div class="muted">' + empty + '</div>') + '</div>'; };
    var bar = function (label, n, max, color, right) { return '<div class="sbar"><span>' + esc(label) + '</span><i><em style="width:' + Math.max(2, Math.round(n / Math.max(1, max) * 100)) + '%;background:' + (color || 'var(--c)') + '"></em></i><b>' + (right != null ? right : n) + '</b></div>'; };
    var bars = function (arr, color, unit) { var m = arr.length ? Math.max.apply(null, arr.map(function (x) { return x.n; })) : 1; return arr.map(function (x) { return bar(x.name, x.n, m, color, x.n + (unit || '')); }); };
    var html = '<div class="kpis">'
      + tile(h.active, 'พนักงานปัจจุบัน', '#2563eb', 'ต่างด้าว ' + h.foreign + ' · ทั้งหมดในทะเบียน ' + h.total)
      + tile('+' + h.hires + ' / −' + h.exits, 'เข้าใหม่ / ลาออก (ช่วงนี้)', h.exits > h.hires ? '#dc2626' : '#16a34a', h.turnover == null ? '' : 'อัตราลาออก ' + h.turnover + '%')
      + tile(L.absenteeism == null ? '–' : L.absenteeism + '%', 'อัตราการลา/ขาด', L.absenteeism > 3 ? '#dc2626' : L.absenteeism > 1.5 ? '#d97706' : '#16a34a', 'ป่วย + กิจ + ขาดงาน ต่อวันทำงาน')
      + tile(D.expired + ' / ' + D.soon, 'เอกสารหมดอายุ / ใกล้หมด', D.expired ? '#dc2626' : D.soon ? '#d97706' : '#16a34a', 'ใน ' + D.alertDays + ' วัน' + (D.noWorkPermit ? ' · ต่างด้าวไม่มี WP ' + D.noWorkPermit : ''))
      + tile(Tn.hours, 'ชั่วโมงอบรม (คน-ชม.)', '#7c3aed', Tn.sessions + ' หลักสูตร · ' + Tn.people + ' คน' + (Tn.coverage != null ? ' · ' + Tn.coverage + '% ของพนักงาน' : ''))
      + '</div>';
    html += '<div class="panel pbox sins"><h4>' + icon('chart', 18) + ' ข้อสังเกต</h4>' + r.insights.map(function (s) { return '<div class="sin ' + s.level + '">' + esc(s.text) + '</div>'; }).join('') + '</div>';
    var maxT = Math.max.apply(null, r.trend.map(function (m) { return Math.max(m.hires, m.exits); }).concat([1]));
    var maxLd = Math.max.apply(null, r.trend.map(function (m) { return m.leaveDays; }).concat([1]));
    html += '<div class="pgrid">'
      + box(icon('users', 18) + ' พนักงานแยกแผนก / อาคาร', bars(h.byGroup, '#2563eb', ' คน').concat(['<div class="xsep"></div>']).concat(bars(h.byBuilding, '#0891b2', ' คน')), 'ยังไม่มีข้อมูล')
      + box(icon('users', 18) + ' สัญชาติ / เพศ', bars(h.byNationality, '#7c3aed', ' คน').concat(['<div class="xsep"></div>']).concat(bars(h.byGender, '#db2777', ' คน')), 'ยังไม่มีข้อมูล')
      + box(icon('cal', 18) + ' การลาแยกประเภท (ช่วงนี้)', L.byType.map(function (x) { return bar(x.name, x.name === 'มาสาย' ? x.times : x.days, Math.max.apply(null, L.byType.map(function (y) { return y.name === 'มาสาย' ? y.times : y.days; }).concat([1])), x.name === 'ขาดงาน' ? '#dc2626' : '#d97706', x.name === 'มาสาย' ? x.times + ' ครั้ง' + (x.minutes ? ' · ' + x.minutes + ' นาที' : '') : x.days + ' วัน · ' + x.times + ' ครั้ง'); }), 'ไม่มีการลาในช่วงนี้')
      + box(icon('warn', 18) + ' ลา / ขาด / สาย มากที่สุด', L.top.map(function (x) { return '<div class="li click" data-emp="' + esc(x.id) + '"><span>' + esc(x.name) + '</span><b>' + (x.sick + x.personal + x.absent) + ' วัน</b><small>ป่วย ' + x.sick + ' · กิจ ' + x.personal + ' · ขาด ' + x.absent + ' · สาย ' + x.late + ' ครั้ง</small></div>'; }), 'ไม่มีข้อมูล')
      + box(icon('idcard', 18) + ' เอกสารหมดอายุ / ใกล้หมดอายุ', D.expiring.map(function (x) { return '<div class="li click" data-emp="' + esc(x.empId) + '"><span>' + esc(x.name) + '</span><b class="' + (x.left < 0 ? 'neg' : 'warn') + '">' + (x.left < 0 ? 'หมดแล้ว ' + (-x.left) + ' วัน' : 'อีก ' + x.left + ' วัน') + '</b><small>' + esc(x.type) + (x.number ? ' ' + esc(x.number) : '') + ' · หมด ' + dd(x.expiryDate) + '</small></div>'; }), 'ไม่มีเอกสารที่หมดอายุใน ' + D.alertDays + ' วัน')
      + box(icon('chart', 18) + ' แนวโน้ม 6 เดือน', ['<div class="strend">' + r.trend.map(function (m) {
        return '<div class="stm"><div class="stbars"><em class="b2" style="height:' + Math.round(m.hires / maxT * 100) + '%" title="เข้าใหม่ ' + m.hires + '"></em><em class="b3" style="height:' + Math.round(m.exits / maxT * 100) + '%" title="ลาออก ' + m.exits + '"></em><em class="b1" style="height:' + Math.round(m.leaveDays / maxLd * 100) + '%" title="วันลา ' + m.leaveDays + '"></em></div>'
          + '<b>' + m.head + '</b><span>' + ymLabel(m.ym) + '</span></div>';
      }).join('') + '</div><div class="slegend"><i class="b2"></i>เข้าใหม่ <i class="b3"></i>ลาออก <i class="b1"></i>วันลา · ตัวเลข = จำนวนพนักงานสิ้นเดือน</div>'], '')
      + box(icon('users', 18) + ' อายุงาน / อายุตัว', (h.tenureKnown ? bars(h.tenure, '#16a34a', ' คน').concat(['<small class="muted">เฉลี่ย ' + h.avgTenure + ' ปี (' + h.tenureKnown + ' คนที่มีวันเริ่มงาน)</small>']) : ['<div class="muted">ยังไม่มีวันเริ่มงาน — ใส่ได้ในทะเบียนพนักงาน</div>'])
        .concat(['<div class="xsep"></div>']).concat(h.agesKnown ? bars(h.ages, '#0891b2', ' คน') : ['<div class="muted">ยังไม่มีวันเกิด</div>']), '')
      + box(icon('book', 18) + ' การอบรมล่าสุด', Tn.list.map(function (t) { return '<div class="li"><span>' + esc(t.title) + '</span><b>' + t.n + ' คน</b><small>' + dd(t.date) + ' · ' + t.hours + ' ชม.</small></div>'; }), 'ยังไม่มีการอบรมในช่วงนี้')
      + box(icon('users', 18) + ' เข้าใหม่ / ลาออก', h.hireList.map(function (x) { return '<div class="li"><span>' + esc(x.name) + '</span><b class="pos">เข้า ' + dd(x.date) + '</b><small>' + esc(x.position || '') + '</small></div>'; })
        .concat(h.exitList.map(function (x) { return '<div class="li"><span>' + esc(x.name) + '</span><b class="neg">ออก ' + dd(x.date) + '</b><small>' + esc([x.position, x.reason].filter(String).join(' · ')) + '</small></div>'; })), 'ไม่มีคนเข้า-ออกในช่วงนี้')
      + (r.birthdays.length ? box('🎂 วันเกิดเดือนนี้', r.birthdays.map(function (b) { return '<div class="li"><span>' + esc(b.name) + (b.nickname ? ' (' + esc(b.nickname) + ')' : '') + '</span><b>' + b.day + '</b></div>'; }), '') : '')
      + '</div>';
    return html;
  };

  // ==================== ทะเบียนพนักงาน ====================
  function emps() {
    var q = H.q, all = H.data.emps;
    q.est = q.est || 'active';
    var rows = all.filter(function (e) {
      if (q.est === 'active' && e.status === 'ลาออก') return false;
      if (q.est === 'out' && e.status !== 'ลาออก') return false;
      if (q.eg && e.group !== q.eg) return false;
      if (q.eb && e.building !== q.eb) return false;
      if (q.en && e.nationality !== q.en) return false;
      var s = String(q.eq || '').toLowerCase();
      return !s || [e.code, e.fullName, e.nickname, e.position, e.phone].join(' ').toLowerCase().indexOf(s) >= 0;
    });
    var sel = function (id, label, vals, cur) { return '<select id="' + id + '"><option value="">' + label + '</option>' + vals.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
    $('main').innerHTML = '<h3>ทะเบียนพนักงาน</h3><p class="lead">แตะการ์ดเพื่อดูประวัติ / แก้ไข / เปลี่ยนรูป · ทั้งหมด ' + all.length + ' คน · ทำงานอยู่ ' + active().length + ' คน</p>'
      + '<div class="pchips">' + [['active', 'ทำงานอยู่'], ['out', 'ลาออกแล้ว'], ['all', 'ทั้งหมด']].map(function (c) { return '<button class="chip' + (q.est === c[0] ? ' on' : '') + '" data-est="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
      + '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="eq" type="search" placeholder="ค้นหา ชื่อ / ชื่อเล่น / รหัส / ตำแหน่ง" value="' + esc(q.eq || '') + '"></div>'
      + sel('eG', 'ทุกแผนก', uniq(all.map(function (e) { return e.group; })), q.eg) + sel('eB', 'ทุกอาคาร', uniq(all.map(function (e) { return e.building; })), q.eb)
      + sel('eN', 'ทุกสัญชาติ', uniq(all.map(function (e) { return e.nationality; })), q.en)
      + '<button class="btn btn-sm btn-primary" id="eNew">' + icon('plus', 16) + ' เพิ่มพนักงาน</button></div>'
      + '<div class="hgrid">' + (rows.map(function (e) {
        return '<button class="hcard' + (e.status === 'ลาออก' ? ' off' : '') + '" data-emp="' + e.id + '">' + photo(e) + '<div class="hinfo"><b>' + esc(e.fullName) + '</b>'
          + '<span>' + esc([e.nickname, e.code].filter(String).join(' · ')) + '</span><small>' + esc(e.position || '-') + '</small>'
          + '<small class="muted">' + esc([e.group, e.building, e.nationality].filter(String).join(' · ')) + (e.status !== 'ทำงาน' ? ' · <b class="' + (e.status === 'ลาออก' ? 'neg' : 'warn') + '">' + esc(e.status) + '</b>' : '') + '</small></div></button>';
      }).join('') || '<div class="panel muted">ไม่พบพนักงาน</div>') + '</div>';
    on('[data-est]', 'click', function (el) { q.est = el.getAttribute('data-est'); emps(); }, $('main'));
    $('eq').addEventListener('input', function () { q.eq = $('eq').value; clearTimeout(H.et); H.et = setTimeout(function () { emps(); var e = $('eq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('eG').addEventListener('change', function () { q.eg = $('eG').value; emps(); });
    $('eB').addEventListener('change', function () { q.eb = $('eB').value; emps(); });
    $('eN').addEventListener('change', function () { q.en = $('eN').value; emps(); });
    $('eNew').addEventListener('click', function () { empModal(null); });
    on('[data-emp]', 'click', function (el) { profile(el.getAttribute('data-emp')); }, $('main'));
  }
  // ประวัติรายบุคคล (หน้าเต็ม)
  function profile(id) {
    var e = emp(id); if (!e) return;
    if (state.page !== 'h_emp') { state.page = 'h_emp'; renderNav(); }
    var y = H.data.today.slice(0, 4), quotas = H.data.settings.quotaMap || {};
    var lv = H.data.leaves.filter(function (l) { return l.empId === id; }).sort(function (a, b) { return String(b.dateFrom).localeCompare(String(a.dateFrom)); });
    var used = {}; lv.filter(function (l) { return l.dateFrom.slice(0, 4) === y && l.status !== 'ไม่อนุมัติ'; }).forEach(function (l) { used[l.type] = (used[l.type] || 0) + (l.type === 'late' ? 1 : Number(l.days) || 0); });
    var dc = H.data.docs.filter(function (d) { return d.empId === id; }).sort(function (a, b) { return String(a.expiryDate || '9').localeCompare(String(b.expiryDate || '9')); });
    var tr = H.data.trainings.filter(function (t) { return t.attendees.indexOf(id) >= 0; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var ds = H.data.disc.filter(function (x) { return x.empId === id; });
    var row = function (k, val) { return val ? '<div class="hkv"><span>' + k + '</span><b>' + esc(val) + '</b></div>' : ''; };
    $('main').innerHTML = '<div class="swalk-h"><button class="btn btn-sm btn-line" id="pBack">' + icon('back', 16) + ' ทะเบียนพนักงาน</button><div><h3 style="margin:0">' + esc(e.fullName) + '</h3><span class="muted">' + esc([e.nickname, e.code, e.position].filter(String).join(' · ')) + '</span></div>'
      + '<button class="btn btn-sm btn-line" id="pPrint">' + icon('print', 16) + ' พิมพ์ประวัติ</button><button class="btn btn-sm btn-primary" id="pEdit">' + icon('edit', 16) + ' แก้ไข</button></div>'
      + '<div class="hprof panel"><div class="hprof-ph">' + photo(e, 'hbig') + '<button type="button" class="btn btn-sm btn-line" data-ph="cam">' + icon('camera', 16) + ' ถ่ายรูป</button><button type="button" class="btn btn-sm btn-line" data-ph="lib">' + icon('clip', 16) + ' เลือกรูป</button></div>'
      + '<div class="hkvs">' + row('สถานะ', e.status + (e.status === 'ลาออก' && e.endDate ? ' (' + thDate(e.endDate) + ')' : '')) + row('รหัสพนักงาน', e.code) + row('ตำแหน่ง', e.position) + row('แผนก', e.group) + row('อาคาร', e.building)
      + row('ประเภทการจ้าง', e.empType) + row('วันเริ่มงาน', e.startDate ? thDate(e.startDate) + ' (อายุงาน ' + yrs(e.startDate) + ')' : '') + row('เพศ', e.gender) + row('สัญชาติ', e.nationality) + row('ศาสนา', e.religion)
      + row('วันเกิด', e.birthDate ? thDate(e.birthDate) + ' (อายุ ' + yrs(e.birthDate) + ')' : '') + row('เลขบัตร / พาสปอร์ต', e.idNo) + row('เบอร์โทร', e.phone) + row('วุฒิการศึกษา', e.education)
      + row('ที่อยู่ตามทะเบียนบ้าน', e.addrReg) + row('ที่อยู่ปัจจุบัน', e.addrNow) + row('ผู้ติดต่อฉุกเฉิน', [e.emergencyName, e.emergencyPhone].filter(String).join(' · ')) + row('เหตุผลที่ออก', e.endReason) + row('หมายเหตุ', e.note)
      + '</div></div>'
      + '<div class="pgrid">'
      + '<div class="panel pbox"><h4>' + icon('cal', 18) + ' วันลาปี ' + (+y + 543) + ' <button class="btn btn-sm btn-line" style="margin-left:auto" data-new="leave">' + icon('plus', 14) + ' บันทึกการลา</button></h4><div class="hquota">'
        + ['sick', 'personal', 'vacation', 'absent', 'late'].map(function (k) {
          var u = used[k] || 0, qq = quotaOf(e, k, y);
          return '<div><span>' + LT[k] + '</span><b class="' + (qq != null && u > qq ? 'neg' : '') + '">' + u + (qq != null ? '/' + qq : '') + '</b><small>' + (k === 'late' ? 'ครั้ง' : 'วัน') + '</small>'
            + (qq != null ? '<em class="' + (qq - u < 0 ? 'neg' : '') + '">' + (qq - u < 0 ? 'เกิน ' + (u - qq) : 'เหลือ ' + (qq - u)) + '</em>' : '') + (k === 'vacation' && qq === 0 && e.startDate ? '<em>ยังไม่ครบ 1 ปี</em>' : '') + '</div>';
        }).join('') + '</div>'
        + lv.slice(0, 12).map(function (l) { return '<div class="li click" data-lv="' + l.id + '"><span>' + LT[l.type] + (l.reason ? ' · ' + esc(l.reason) : '') + '</span><b>' + (l.type === 'late' ? (l.minutes || 0) + ' นาที' : l.days + ' วัน') + '</b><small>' + dd(l.dateFrom) + (l.dateTo && l.dateTo !== l.dateFrom ? ' – ' + dd(l.dateTo) : '') + (l.status !== 'อนุมัติ' ? ' · ' + esc(l.status) : '') + '</small></div>'; }).join('') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('idcard', 18) + ' เอกสาร <button class="btn btn-sm btn-line" style="margin-left:auto" data-new="doc">' + icon('plus', 14) + ' เพิ่มเอกสาร</button></h4>'
        + (dc.map(function (d) { var left = d.expiryDate ? days(H.data.today, d.expiryDate) : null; return '<div class="li click" data-dc="' + d.id + '"><span>' + esc(DT[d.type] || d.type) + (d.number ? ' · ' + esc(d.number) : '') + '</span><b class="' + (left != null && left < 0 ? 'neg' : left != null && left <= Number(H.data.settings.alertDays || 60) ? 'warn' : '') + '">' + (d.expiryDate ? 'หมด ' + dd(d.expiryDate) : '-') + '</b><small>' + (left != null ? (left < 0 ? 'หมดอายุแล้ว ' + (-left) + ' วัน' : 'เหลือ ' + left + ' วัน') : '') + (d.files.length ? ' · ไฟล์ ' + d.files.length : '') + '</small></div>'; }).join('') || '<div class="muted">ยังไม่มีเอกสาร</div>') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('book', 18) + ' การอบรม (' + tr.length + ' หลักสูตร · ' + tr.reduce(function (s, t) { return s + (Number(t.hours) || 0); }, 0) + ' ชม.)</h4>'
        + (tr.map(function (t) { return '<div class="li"><span>' + esc(t.title) + '</span><b>' + t.hours + ' ชม.</b><small>' + dd(t.date) + (t.trainer ? ' · ' + esc(t.trainer) : '') + '</small></div>'; }).join('') || '<div class="muted">ยังไม่มีประวัติอบรม</div>') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('gavel', 18) + ' วินัย / ใบเตือน <button class="btn btn-sm btn-line" style="margin-left:auto" data-new="disc">' + icon('plus', 14) + ' บันทึก</button></h4>'
        + (ds.map(function (x) { return '<div class="li click" data-ds="' + x.id + '"><span>' + esc(DL[x.level]) + '</span><b>' + dd(x.date) + '</b><small>' + esc(x.reason) + '</small></div>'; }).join('') || '<div class="muted">ไม่มี</div>') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('clip', 18) + ' ไฟล์แนบของพนักงาน</h4><div class="hfiles">' + (fileLinks(e.files, 'emp', e.id) || '<span class="muted">ยังไม่มีไฟล์ (เช่น ใบสมัคร สำเนาบัตร สัญญาจ้าง)</span>') + '</div><div class="pfoot">' + attachBtns('emp') + '</div></div>'
      + '</div>';
    $('pBack').addEventListener('click', function () { emps(); });
    $('pEdit').addEventListener('click', function () { empModal(e); });
    $('pPrint').addEventListener('click', function () { H.q.rep = 'profile'; H.q.rEmp = id; go('h_rep'); });
    on('[data-ph]', 'click', function (el) {
      pick(function (files) { if (!files[0]) return; toast('กำลังอัปโหลดรูป…'); uploadPhoto(id, files[0]).then(function () { toast('เปลี่ยนรูปแล้ว'); profile(id); }).catch(function (err) { toast(err.message); }); }, el.getAttribute('data-ph') === 'cam');
    }, $('main'));
    on('[data-new]', 'click', function (el) { var k = el.getAttribute('data-new'); ({ leave: leaveModal, doc: docModal, disc: discModal })[k](null, id); }, $('main'));
    on('[data-lv]', 'click', function (el) { leaveModal(H.data.leaves.filter(function (x) { return x.id === el.getAttribute('data-lv'); })[0]); }, $('main'));
    on('[data-dc]', 'click', function (el) { docModal(H.data.docs.filter(function (x) { return x.id === el.getAttribute('data-dc'); })[0]); }, $('main'));
    on('[data-ds]', 'click', function (el) { discModal(H.data.disc.filter(function (x) { return x.id === el.getAttribute('data-ds'); })[0]); }, $('main'));
    on('[data-att]', 'click', function (el) { pick(function (files) { uploadFiles('emp', id, files).then(function (r) { reload(r.fails ? 'อัปโหลดไม่สำเร็จ ' + r.fails + ' ไฟล์' : 'แนบไฟล์แล้ว').then(function () { profile(id); }); }); }, el.getAttribute('data-src') === 'cam', 'image/*,application/pdf'); }, $('main'));
    on('[data-rmf]', 'click', function (el) { removeFile(el, function () { profile(id); }); }, $('main'));
    window.scrollTo(0, 0);
  }
  function removeFile(el, after) {
    if (!window.confirm('ลบไฟล์นี้?')) return;
    call('hrRemoveFile', state.token, el.getAttribute('data-k'), el.getAttribute('data-o'), el.getAttribute('data-rmf')).then(function (r) {
      if (!r.ok) return toast(r.error);
      reload('ลบไฟล์แล้ว').then(after);
    }).catch(onServerError);
  }
  function empModal(e) {
    var isNew = !e, s = H.data.settings;
    e = e || { status: 'ทำงาน', nationality: 'ไทย', startDate: H.data.today };
    var pend = null;
    wide({
      icon: 'HR', title: isNew ? 'เพิ่มพนักงาน' : 'แก้ไขข้อมูล ' + e.fullName, sub: 'ทะเบียนประวัติพนักงาน',
      body: (isNew ? '<div class="hnewph"><span id="npPrev">' + photo(null) + '</span><button type="button" class="btn btn-sm btn-line" data-np="cam">' + icon('camera', 16) + ' ถ่ายรูป</button><button type="button" class="btn btn-sm btn-line" data-np="lib">' + icon('clip', 16) + ' เลือกรูป</button></div>' : '')
        + '<div class="pform">' + F('mName', 'ชื่อ-นามสกุล * (มีคำนำหน้า เช่น นาย / นางสาว / MISS.)', e.fullName) + F('mNick', 'ชื่อเล่น', e.nickname)
        + F('mCode', 'รหัสพนักงาน', e.code) + S('mStatus', 'สถานะ', STATUS.map(function (x) { return [x, x]; }), e.status)
        + F('mPos', 'ตำแหน่ง', e.position, 'text', ' list="hPos"') + '<datalist id="hPos">' + uniq(H.data.emps.map(function (x) { return x.position; })).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'
        + S('mGroup', 'แผนก', opts(uniq(list(s.groups).concat([e.group])), '— ไม่ระบุ —'), e.group) + S('mBld', 'อาคาร', opts(uniq(list(s.buildings).concat([e.building])), '— ไม่ระบุ —'), e.building)
        + S('mType', 'ประเภทการจ้าง', opts(uniq(['รายเดือน', 'รายวัน', 'สัญญาจ้าง', 'พาร์ทไทม์', e.empType]), '— ไม่ระบุ —'), e.empType)
        + F('mStart', 'วันเริ่มงาน', e.startDate, 'date') + F('mEnd', 'วันที่ออก (ถ้าลาออก)', e.endDate, 'date')
        + S('mGender', 'เพศ', opts(['หญิง', 'ชาย'], '— ไม่ระบุ —'), e.gender) + F('mNat', 'สัญชาติ', e.nationality, 'text', ' list="hNat"') + '<datalist id="hNat"><option value="ไทย"><option value="เมียนมา"><option value="กัมพูชา"><option value="ลาว"></datalist>'
        + F('mRel', 'ศาสนา', e.religion) + F('mBirth', 'วันเกิด', e.birthDate, 'date') + F('mIdNo', 'เลขบัตรประชาชน / พาสปอร์ต', e.idNo) + F('mPhone', 'เบอร์โทร', e.phone, 'tel')
        + F('mEdu', 'วุฒิการศึกษา', e.education) + F('mEmName', 'ผู้ติดต่อฉุกเฉิน', e.emergencyName) + F('mEmPhone', 'เบอร์ผู้ติดต่อฉุกเฉิน', e.emergencyPhone, 'tel')
        + T('mAddr1', 'ที่อยู่ตามทะเบียนบ้าน', e.addrReg) + T('mAddr2', 'ที่อยู่ปัจจุบัน', e.addrNow) + T('mEndR', 'เหตุผลที่ออก', e.endReason) + T('mNote', 'หมายเหตุ', e.note) + '</div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="mDel">' + icon('trash', 16) + ' ลบพนักงาน (ใช้กรณีบันทึกผิด)</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        $('mStatus').addEventListener('change', function () { if ($('mStatus').value === 'ลาออก' && !v('mEnd')) $('mEnd').value = H.data.today; });
        on('[data-np]', 'click', function (el) { pick(function (f) { if (!f[0]) return; pend = f[0]; loadImg(f[0]).then(function (x) { $('npPrev').innerHTML = '<img class="hph" src="' + canvasOf(x.im, 240, 300, true).toDataURL('image/jpeg', 0.7) + '">'; URL.revokeObjectURL(x.u); }); }, el.getAttribute('data-np') === 'cam'); }, $('mBody'));
        if (!isNew) $('mDel').addEventListener('click', function () { confirmBox('ลบ ' + e.fullName + ' ออกจากทะเบียน? (ถ้าพนักงานลาออก ให้เปลี่ยนสถานะเป็น "ลาออก" แทน)', function () { return call('hrDeleteEmp', state.token, e.id).then(function (r) { if (!r.ok) return r.error; closeModal(); H.q.est = 'active'; reload('ลบแล้ว'); }); }); });
      },
      check: function () { return v('mName') ? '' : 'ระบุชื่อ-นามสกุล'; },
      submit: function () {
        var rec = { id: e.id || '', fullName: v('mName'), nickname: v('mNick'), code: v('mCode'), status: v('mStatus'), position: v('mPos'), group: v('mGroup'), building: v('mBld'), empType: v('mType'),
          startDate: v('mStart'), endDate: v('mEnd'), gender: v('mGender'), nationality: v('mNat'), religion: v('mRel'), birthDate: v('mBirth'), idNo: v('mIdNo'), phone: v('mPhone'),
          education: v('mEdu'), emergencyName: v('mEmName'), emergencyPhone: v('mEmPhone'), addrReg: v('mAddr1'), addrNow: v('mAddr2'), endReason: v('mEndR'), note: v('mNote') };
        return call('hrSaveEmp', state.token, rec).then(function (r) {
          if (!r.ok) return r.error;
          var id = r.emp.id;
          return (pend ? uploadPhoto(id, pend).catch(function () { toast('อัปโหลดรูปไม่สำเร็จ'); }) : Promise.resolve()).then(function () {
            closeModal(); return reload('บันทึกแล้ว').then(function () { profile(id); });
          });
        });
      }
    });
  }

  // ==================== การลา ====================
  function leaves() {
    var q = H.q, t = H.data.today;
    if (!q.lm) q.lm = t.slice(0, 7);
    var rows = H.data.leaves.filter(function (l) { return (!q.lm || l.dateFrom.slice(0, 7) === q.lm || String(l.dateTo).slice(0, 7) === q.lm) && (!q.lt || l.type === q.lt); })
      .sort(function (a, b) { return String(b.dateFrom).localeCompare(String(a.dateFrom)); });
    var y = q.lm.slice(0, 4), quotas = H.data.settings.quotaMap || {}, sum = {};
    H.data.leaves.filter(function (l) { return l.dateFrom.slice(0, 4) === y && l.status !== 'ไม่อนุมัติ'; }).forEach(function (l) { sum[l.empId] = sum[l.empId] || {}; sum[l.empId][l.type] = (sum[l.empId][l.type] || 0) + (l.type === 'late' ? 1 : Number(l.days) || 0); });
    var over = Object.keys(sum).filter(function (id) { return ['sick', 'personal', 'vacation'].some(function (k) { return quotas[k] && (sum[id][k] || 0) > quotas[k]; }); });
    q.lview = q.lview || 'list';
    if (q.lview === 'bal') return leaveBalances(y);
    $('main').innerHTML = '<h3>การลา / ขาดงาน / มาสาย</h3><p class="lead">บันทึกการลาทุกประเภท · ระบบนับวันทำงาน (ไม่นับวันอาทิตย์) ให้เอง แก้เป็นครึ่งวันได้</p>'
      + (over.length ? '<div class="panel sins" style="margin-bottom:12px"><div class="sin bad">ลาเกินสิทธิ์ปี ' + (+y + 543) + ': ' + over.map(function (id) { return esc((emp(id) || {}).fullName || id); }).join(', ') + '</div></div>' : '')
      + leaveTabs()
      + '<div class="pbar"><label class="pchk">เดือน <input type="month" id="lM" value="' + esc(q.lm) + '"></label><select id="lT"><option value="">ทุกประเภท</option>' + Object.keys(LT).map(function (k) { return '<option value="' + k + '"' + (q.lt === k ? ' selected' : '') + '>' + LT[k] + '</option>'; }).join('') + '</select>'
      + '<b style="flex:1">' + rows.length + ' รายการ</b><button class="btn btn-sm btn-primary" id="lNew">' + icon('plus', 16) + ' บันทึกการลา</button></div>'
      + '<div class="plist">' + (rows.map(function (l) {
        var e = emp(l.empId) || { fullName: '(ไม่พบพนักงาน)' };
        return '<button class="prow click" data-lv="' + l.id + '">' + photo(e, 'hph sm') + '<div class="pinfo"><b>' + esc(e.fullName) + (e.nickname ? ' (' + esc(e.nickname) + ')' : '') + '</b><small>' + dd(l.dateFrom) + (l.dateTo && l.dateTo !== l.dateFrom ? ' – ' + dd(l.dateTo) : '') + (l.reason ? ' · ' + esc(l.reason) : '') + (l.status !== 'อนุมัติ' ? ' · <b class="warn">' + esc(l.status) + '</b>' : '') + '</small></div>'
          + '<div class="pprice"><span class="htype ' + l.type + '">' + LT[l.type] + '</span><small>' + (l.type === 'late' ? (l.minutes || 0) + ' นาที' : l.days + ' วัน') + '</small></div></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ</div>') + '</div>';
    $('lM').addEventListener('change', function () { q.lm = v('lM'); if (q.lm && q.lm.slice(0, 4) < String(+H.data.today.slice(0, 4) - 1)) loadOld(q.lm); else leaves(); });
    $('lT').addEventListener('change', function () { q.lt = v('lT'); leaves(); });
    $('lNew').addEventListener('click', function () { leaveModal(null); });
    on('[data-lv]', 'click', function (el) { leaveModal(H.data.leaves.filter(function (x) { return x.id === el.getAttribute('data-lv'); })[0]); }, $('main'));
    bindLeaveTabs();
  }
  function leaveTabs() { return '<div class="pchips">' + [['list', 'รายการลา'], ['bal', 'สิทธิ์คงเหลือรายคน']].map(function (c) { return '<button class="chip' + (H.q.lview === c[0] ? ' on' : '') + '" data-lview="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'; }
  function bindLeaveTabs() { on('[data-lview]', 'click', function (el) { H.q.lview = el.getAttribute('data-lview'); leaves(); }, $('main')); }
  // สิทธิ์วันลาคงเหลือของทุกคน ในปีที่เลือก
  function leaveBalances(y) {
    var q = H.q, years = [H.data.today.slice(0, 4), String(+H.data.today.slice(0, 4) - 1)];
    if (years.indexOf(y) < 0) y = years[0];
    var ks = ['sick', 'personal', 'vacation'], s = String(q.bq || '').toLowerCase();
    var rows = active().filter(function (e) { return !s || (e.fullName + ' ' + e.nickname + ' ' + e.code).toLowerCase().indexOf(s) >= 0; });
    var cell = function (e, k) {
      var u = usedOf(e.id, k, y), qq = quotaOf(e, k, y);
      if (qq == null) return '<td class="c">' + (u || '') + '</td>';
      var r = qq - u;
      return '<td class="c"><b class="' + (r < 0 ? 'neg' : r <= 1 && qq ? 'warn' : '') + '">' + (r < 0 ? 'เกิน ' + (-r) : r) + '</b><small>ใช้ ' + u + '/' + qq + '</small></td>';
    };
    $('main').innerHTML = '<h3>การลา / ขาดงาน / มาสาย</h3><p class="lead">สิทธิ์คงเหลือ = สิทธิ์ต่อปี − วันที่ลาไปแล้วในปีนั้น (ไม่นับรายการ "ไม่อนุมัติ") · ขึ้นปีใหม่ระบบเริ่มนับใหม่ให้เอง</p>'
      + leaveTabs()
      + '<div class="pbar"><select id="bY">' + years.map(function (x) { return '<option value="' + x + '"' + (x === y ? ' selected' : '') + '>ปี ' + (+x + 543) + '</option>'; }).join('') + '</select>'
      + '<div class="psearch">' + icon('search', 18) + '<input id="bq" type="search" placeholder="ค้นหาชื่อ" value="' + esc(q.bq || '') + '"></div></div>'
      + '<div class="ptable-wrap"><table class="ptable hbal"><thead><tr><th>พนักงาน</th>' + ks.map(function (k) { return '<th class="c">' + LT[k] + '<br><small>คงเหลือ (วัน)</small></th>'; }).join('') + '<th class="c">ขาดงาน<br><small>วัน</small></th><th class="c">มาสาย<br><small>ครั้ง</small></th></tr></thead><tbody>'
      + rows.map(function (e) { return '<tr data-emp="' + e.id + '"><td>' + esc(e.fullName) + (e.nickname ? ' <small>(' + esc(e.nickname) + ')</small>' : '') + '</td>' + ks.map(function (k) { return cell(e, k); }).join('')
        + '<td class="c">' + (usedOf(e.id, 'absent', y) || '') + '</td><td class="c">' + (usedOf(e.id, 'late', y) || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    bindLeaveTabs();
    $('bY').addEventListener('change', function () { q.lm = v('bY') + H.q.lm.slice(4); leaves(); });
    $('bq').addEventListener('input', function () { q.bq = $('bq').value; clearTimeout(H.bt); H.bt = setTimeout(function () { leaves(); var el = $('bq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250); });
    on('[data-emp]', 'click', function (el) { profile(el.getAttribute('data-emp')); }, $('main'));
  }
  function loadOld(ym) {   // เดือนที่เก่ากว่าที่โหลดไว้ → ดึงเพิ่ม
    call('hrLeaves', state.token, ym + '-01', ym + '-31').then(function (r) {
      if (!r.ok) return toast(r.error);
      var have = {}; H.data.leaves.forEach(function (l) { have[l.id] = 1; }); r.leaves.forEach(function (l) { if (!have[l.id]) H.data.leaves.push(l); });
      leaves();
    }).catch(onServerError);
  }
  function leaveModal(l, empId) {
    var isNew = !l, t = H.data.today, pend = [];
    l = l || { empId: empId || '', type: 'sick', dateFrom: t, dateTo: t, status: 'อนุมัติ', files: [] };
    var overAck = false;
    // แสดงสิทธิ์: ปีของวันที่ลา · สิทธิ์ · ใช้ไปแล้ว (ไม่รวมรายการนี้) · คงเหลือหลังบันทึก — คืนจำนวนวันที่เกินสิทธิ์
    var quotaInfo = function () {
      var box = $('lQuota'); if (!box) return 0;
      var id = empIdOf('lEmp'), e = emp(id), k = v('lType'), y = String(v('lFrom') || t).slice(0, 4);
      if (!e) { box.innerHTML = ''; return 0; }
      if (!loadedYear(y)) { box.innerHTML = '<span class="muted">ปี ' + (+y + 543) + ' เก่ากว่าข้อมูลที่โหลดไว้ — ระบบไม่ได้คำนวณสิทธิ์คงเหลือ</span>'; return 0; }
      var used = usedOf(id, k, y, l.id), qq = quotaOf(e, k, y), now = v('lSt') === 'ไม่อนุมัติ' ? 0 : (k === 'late' ? 1 : Number(v('lDays')) || 0);
      if (qq == null) { box.innerHTML = '<b>' + esc(LT[k]) + ' ปี ' + (+y + 543) + '</b> · ' + esc(e.nickname || e.fullName) + ' ใช้ไปแล้ว ' + used + (k === 'late' ? ' ครั้ง' : ' วัน') + ' (ไม่มีกำหนดสิทธิ์)'; box.className = 'hqinfo'; return 0; }
      var left = qq - used, after = left - now;
      box.className = 'hqinfo' + (after < 0 ? ' bad' : after <= 1 ? ' warn' : ' ok');
      box.innerHTML = '<b>สิทธิ์' + esc(LT[k]) + ' ปี ' + (+y + 543) + ' ของ ' + esc(e.nickname || e.fullName) + '</b>'
        + '<div class="hqrow"><span>สิทธิ์ทั้งปี <b>' + qq + '</b></span><span>ใช้ไปแล้ว <b>' + used + '</b></span><span>คงเหลือ <b>' + left + '</b></span><span>หลังบันทึกครั้งนี้ <b>' + (after < 0 ? 'เกิน ' + (-after) : after) + '</b> วัน</span></div>'
        + (k === 'vacation' && qq === 0 && e.startDate ? '<small>ยังทำงานไม่ครบ 1 ปี จึงยังไม่มีสิทธิ์ลาพักร้อน</small>' : '');
      return after < 0 ? -after : 0;
    };
    var calc = function () {
      if (v('lType') === 'late') return;
      var f = v('lFrom'), to = v('lTo') || f; if (!f || to < f) return;
      var n = 0, d = f; while (d <= to) { var w = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay(); if (w !== 0 && !(H.data.settings.workDays === 'จ-ศ' && w === 6)) n++; d = addDays(d, 1); }
      $('lDays').value = n; quotaInfo();
    };
    wide({
      icon: 'cal', title: isNew ? 'บันทึกการลา' : 'แก้ไขการลา', sub: (emp(l.empId) || {}).fullName || 'การลา / ขาดงาน / มาสาย',
      body: '<div class="pform">' + empField('lEmp', 'พนักงาน *', l.empId) + S('lType', 'ประเภท *', Object.keys(LT).map(function (k) { return [k, LT[k]]; }), l.type)
        + F('lFrom', 'ตั้งแต่วันที่ *', l.dateFrom, 'date') + F('lTo', 'ถึงวันที่', l.dateTo || l.dateFrom, 'date')
        + F('lDays', 'จำนวนวัน (ครึ่งวัน = 0.5)', l.days === '' || l.days == null ? '' : l.days, 'number', ' step="0.5" min="0"') + F('lMin', 'มาสาย (นาที)', l.minutes, 'number', ' min="0"')
        + S('lSt', 'สถานะ', [['อนุมัติ', 'อนุมัติ'], ['รออนุมัติ', 'รออนุมัติ'], ['ไม่อนุมัติ', 'ไม่อนุมัติ']], l.status) + F('lAppr', 'ผู้อนุมัติ', l.approver)
        + T('lReason', 'เหตุผล', l.reason) + '</div><div id="lQuota" class="hqinfo"></div>'
        + '<div class="psec"><div class="psec-h"><b>ใบรับรองแพทย์ / เอกสารประกอบ</b></div><div class="hfiles" id="lFiles"></div><div class="pfoot">' + attachBtns('leave') + '</div></div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="lDel">' + icon('trash', 16) + ' ลบรายการนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        var drawF = function () { $('lFiles').innerHTML = fileLinks(l.files, isNew ? '' : 'leave', l.id) + pend.map(function (f) { return '<span class="hfile">' + icon('clip', 14) + esc(f.name) + ' (รอบันทึก)</span>'; }).join(''); on('[data-rmf]', 'click', function (el) { removeFile(el, function () { closeModal(); }); }, $('lFiles')); };
        drawF();
        on('[data-att]', 'click', function (el) { pick(function (f) { pend = pend.concat(f); drawF(); }, el.getAttribute('data-src') === 'cam', 'image/*,application/pdf'); }, $('mBody'));
        var syncT = function () { var late = v('lType') === 'late'; $('lMin').closest('.pf').style.display = late ? '' : 'none'; $('lDays').closest('.pf').style.display = late ? 'none' : ''; };
        syncT(); $('lType').addEventListener('change', function () { syncT(); calc(); });
        $('lFrom').addEventListener('change', function () { if (!v('lTo') || v('lTo') < v('lFrom')) $('lTo').value = v('lFrom'); calc(); });
        $('lTo').addEventListener('change', calc);
        if (isNew) calc();
        ['lEmp', 'lType', 'lFrom', 'lTo', 'lDays', 'lSt'].forEach(function (id) { ['input', 'change'].forEach(function (ev) { $(id).addEventListener(ev, function () { overAck = false; quotaInfo(); }); }); });
        quotaInfo();
        if (!isNew) $('lDel').addEventListener('click', function () { confirmBox('ลบรายการลานี้?', function () { return call('hrDeleteRow', state.token, 'leave', l.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); }); });
      },
      check: function () {
        if (!empIdOf('lEmp')) return 'เลือกพนักงานจากรายชื่อ';
        var o = quotaInfo();
        if (o > 0 && !overAck) { overAck = true; return 'ลาเกินสิทธิ์ ' + o + ' วัน — ถ้ายืนยัน (เช่น ลาไม่รับค่าจ้าง) กด "บันทึก" อีกครั้ง'; }
        return '';
      },
      submit: function () {
        return call('hrSaveLeave', state.token, { id: l.id || '', empId: empIdOf('lEmp'), type: v('lType'), dateFrom: v('lFrom'), dateTo: v('lTo'), days: v('lDays'), minutes: v('lMin'), status: v('lSt'), approver: v('lAppr'), reason: v('lReason') }).then(function (r) {
          if (!r.ok) return r.error;
          return uploadFiles('leave', r.row.id, pend).then(function (u) { closeModal(); reload('บันทึกแล้ว' + (u.fails ? ' · อัปโหลดไม่สำเร็จ ' + u.fails + ' ไฟล์' : '')); });
        });
      }
    });
  }

  // ==================== เอกสาร & วันหมดอายุ ====================
  function docs() {
    var q = H.q, t = H.data.today, alert = Number(H.data.settings.alertDays) || 60;
    q.dst = q.dst || 'soon';
    var rows = H.data.docs.filter(function (d) { var e = emp(d.empId); return e && (q.dst === 'all' || e.status !== 'ลาออก'); }).map(function (d) { d._left = d.expiryDate ? days(t, d.expiryDate) : null; return d; })
      .filter(function (d) { return q.dst === 'soon' ? d._left != null && d._left <= alert : q.dst === 'expired' ? d._left != null && d._left < 0 : true; })
      .filter(function (d) { return !q.dtype || d.type === q.dtype; })
      .sort(function (a, b) { return (a._left == null ? 99999 : a._left) - (b._left == null ? 99999 : b._left); });
    var foreign = active().filter(function (e) { return e.nationality && e.nationality !== 'ไทย'; });
    var noWP = foreign.filter(function (e) { return !H.data.docs.some(function (d) { return d.empId === e.id && (d.type === 'workpermit' || d.type === 'pink'); }); });
    $('main').innerHTML = '<h3>เอกสารพนักงาน & วันหมดอายุ</h3><p class="lead">บัตรประชาชน พาสปอร์ต วีซ่า ใบอนุญาตทำงาน ตรวจสุขภาพ ฯลฯ · แจ้งเตือนล่วงหน้า ' + alert + ' วัน (แก้ได้ในตั้งค่า)</p>'
      + (noWP.length ? '<div class="panel sins" style="margin-bottom:12px"><div class="sin warn">พนักงานต่างด้าวที่ยังไม่บันทึกใบอนุญาตทำงาน / บัตรชมพู ' + noWP.length + ' คน: ' + noWP.slice(0, 12).map(function (e) { return esc(e.nickname || e.fullName); }).join(', ') + (noWP.length > 12 ? ' …' : '') + '</div></div>' : '')
      + '<div class="pchips">' + [['soon', 'หมดแล้ว / ใกล้หมด'], ['expired', 'หมดอายุแล้ว'], ['all', 'ทั้งหมด']].map(function (c) { return '<button class="chip' + (q.dst === c[0] ? ' on' : '') + '" data-dst="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
      + '<div class="pbar"><select id="dType"><option value="">ทุกประเภท</option>' + Object.keys(DT).map(function (k) { return '<option value="' + k + '"' + (q.dtype === k ? ' selected' : '') + '>' + DT[k] + '</option>'; }).join('') + '</select><b style="flex:1">' + rows.length + ' รายการ</b>'
      + '<button class="btn btn-sm btn-primary" id="dNew">' + icon('plus', 16) + ' เพิ่มเอกสาร</button></div>'
      + '<div class="plist">' + (rows.map(function (d) {
        var e = emp(d.empId);
        return '<button class="prow click" data-dc="' + d.id + '">' + photo(e, 'hph sm') + '<div class="pinfo"><b>' + esc(e.fullName) + '</b><small>' + esc(DT[d.type] || d.type) + (d.number ? ' · ' + esc(d.number) : '') + (d.files.length ? ' · ไฟล์ ' + d.files.length : '') + '</small></div>'
          + '<div class="pprice ' + (d._left != null && d._left < 0 ? 'neg' : d._left != null && d._left <= alert ? 'warn' : '') + '">' + (d.expiryDate ? dd(d.expiryDate) : '-') + '<small>' + (d._left == null ? 'ไม่มีวันหมดอายุ' : d._left < 0 ? 'หมดแล้ว ' + (-d._left) + ' วัน' : 'เหลือ ' + d._left + ' วัน') + '</small></div></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ</div>') + '</div>';
    on('[data-dst]', 'click', function (el) { q.dst = el.getAttribute('data-dst'); docs(); }, $('main'));
    $('dType').addEventListener('change', function () { q.dtype = v('dType'); docs(); });
    $('dNew').addEventListener('click', function () { docModal(null); });
    on('[data-dc]', 'click', function (el) { docModal(H.data.docs.filter(function (x) { return x.id === el.getAttribute('data-dc'); })[0]); }, $('main'));
  }
  function docModal(d, empId) {
    var isNew = !d, pend = [];
    d = d || { empId: empId || '', type: (emp(empId) || {}).nationality && emp(empId).nationality !== 'ไทย' ? 'workpermit' : 'idcard', files: [] };
    wide({
      icon: 'idcard', title: isNew ? 'เพิ่มเอกสารพนักงาน' : 'แก้ไขเอกสาร', sub: (emp(d.empId) || {}).fullName || '',
      body: '<div class="pform">' + empField('dEmp', 'พนักงาน *', d.empId) + S('dTypeM', 'ประเภทเอกสาร *', Object.keys(DT).map(function (k) { return [k, DT[k]]; }), d.type)
        + F('dNo', 'เลขที่เอกสาร', d.number) + F('dIssue', 'วันที่ออก', d.issueDate, 'date') + F('dExp', 'วันหมดอายุ', d.expiryDate, 'date') + T('dNote', 'หมายเหตุ', d.note) + '</div>'
        + '<div class="psec"><div class="psec-h"><b>ไฟล์ / รูปเอกสาร</b></div><div class="hfiles" id="dFiles"></div><div class="pfoot">' + attachBtns('doc') + '</div></div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="dDel">' + icon('trash', 16) + ' ลบเอกสารนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        var drawF = function () { $('dFiles').innerHTML = fileLinks(d.files, isNew ? '' : 'doc', d.id) + pend.map(function (f) { return '<span class="hfile">' + icon('clip', 14) + esc(f.name) + ' (รอบันทึก)</span>'; }).join(''); on('[data-rmf]', 'click', function (el) { removeFile(el, function () { closeModal(); }); }, $('dFiles')); };
        drawF();
        on('[data-att]', 'click', function (el) { pick(function (f) { pend = pend.concat(f); drawF(); }, el.getAttribute('data-src') === 'cam', 'image/*,application/pdf'); }, $('mBody'));
        if (!isNew) $('dDel').addEventListener('click', function () { confirmBox('ลบเอกสารนี้และไฟล์แนบ?', function () { return call('hrDeleteRow', state.token, 'doc', d.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); }); });
      },
      check: function () { return empIdOf('dEmp') ? '' : 'เลือกพนักงานจากรายชื่อ'; },
      submit: function () {
        return call('hrSaveDoc', state.token, { id: d.id || '', empId: empIdOf('dEmp'), type: v('dTypeM'), number: v('dNo'), issueDate: v('dIssue'), expiryDate: v('dExp'), note: v('dNote') }).then(function (r) {
          if (!r.ok) return r.error;
          return uploadFiles('doc', r.row.id, pend).then(function (u) { closeModal(); reload('บันทึกแล้ว' + (u.fails ? ' · อัปโหลดไม่สำเร็จ ' + u.fails + ' ไฟล์' : '')); });
        });
      }
    });
  }

  // ==================== การอบรม ====================
  function trainings() {
    var rows = H.data.trainings.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var y = H.data.today.slice(0, 4), yr = rows.filter(function (t) { return t.date.slice(0, 4) === y; });
    $('main').innerHTML = '<h3>การอบรม</h3><p class="lead">บันทึกหลักสูตรและรายชื่อผู้เข้าอบรม · ใช้ทำรายงานชั่วโมงอบรมต่อคน</p>'
      + '<div class="kpis">' + [[yr.length, 'หลักสูตรปีนี้', '#7c3aed'], [yr.reduce(function (s, t) { return s + (Number(t.hours) || 0) * t.attendees.length; }, 0), 'คน-ชั่วโมง ปีนี้', '#2563eb'],
        [uniq([].concat.apply([], yr.map(function (t) { return t.attendees; }))).length, 'พนักงานที่ได้อบรมปีนี้', '#16a34a']].map(function (k) { return '<div class="kpi" style="--k:' + k[2] + '"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>'; }).join('') + '</div>'
      + '<div class="pbar"><b style="flex:1">ทั้งหมด ' + rows.length + ' หลักสูตร</b><button class="btn btn-sm btn-primary" id="tNew">' + icon('plus', 16) + ' บันทึกการอบรม</button></div>'
      + '<div class="plist">' + (rows.map(function (t) {
        return '<button class="prow click" data-tr="' + t.id + '"><div class="pinfo"><b>' + esc(t.title) + '</b><small>' + dd(t.date) + ' · ' + t.hours + ' ชม.' + (t.kind ? ' · ' + esc(t.kind) : '') + (t.trainer ? ' · ' + esc(t.trainer) : '') + '</small></div><div class="pprice">' + t.attendees.length + ' คน</div></button>';
      }).join('') || '<div class="panel muted">ยังไม่มีการอบรม</div>') + '</div>';
    $('tNew').addEventListener('click', function () { trainingModal(null); });
    on('[data-tr]', 'click', function (el) { trainingModal(H.data.trainings.filter(function (x) { return x.id === el.getAttribute('data-tr'); })[0]); }, $('main'));
  }
  function trainingModal(t) {
    var isNew = !t, pend = [];
    t = t || { date: H.data.today, hours: 1, attendees: [], files: [], kind: 'ภายใน' };
    var picked = {}; t.attendees.forEach(function (id) { picked[id] = 1; });
    function drawPeople() {
      var s = String(v('tFind') || '').toLowerCase(), g = v('tGroup');
      var people = H.data.emps.filter(function (e) { return (e.status !== 'ลาออก' || picked[e.id]) && (!g || e.group === g || e.building === g) && (!s || (e.fullName + ' ' + e.nickname + ' ' + e.code).toLowerCase().indexOf(s) >= 0); });
      $('tPeople').innerHTML = people.map(function (e) { return '<label class="hpick' + (picked[e.id] ? ' on' : '') + '"><input type="checkbox" data-pp="' + e.id + '"' + (picked[e.id] ? ' checked' : '') + '>' + photo(e, 'hph xs') + '<span>' + esc(e.nickname || e.fullName) + '<small>' + esc(e.fullName) + '</small></span></label>'; }).join('');
      $('tCount').textContent = 'เลือกแล้ว ' + Object.keys(picked).length + ' คน';
      on('[data-pp]', 'change', function (el) { var id = el.getAttribute('data-pp'); if (el.checked) picked[id] = 1; else delete picked[id]; el.closest('.hpick').classList.toggle('on', el.checked); $('tCount').textContent = 'เลือกแล้ว ' + Object.keys(picked).length + ' คน'; }, $('tPeople'));
    }
    var groups = uniq(H.data.emps.map(function (e) { return e.group; }).concat(H.data.emps.map(function (e) { return e.building; })));
    wide({
      icon: 'book', title: isNew ? 'บันทึกการอบรม' : 'แก้ไขการอบรม', sub: 'หลักสูตร + รายชื่อผู้เข้าอบรม',
      body: '<div class="pform">' + F('tTitle', 'หลักสูตร *', t.title) + F('tDate', 'วันที่อบรม *', t.date, 'date') + F('tHours', 'จำนวนชั่วโมง', t.hours, 'number', ' step="0.5" min="0"')
        + S('tKind', 'ประเภท', opts(uniq(['ภายใน', 'ภายนอก', 'ตามกฎหมายกำหนด', 'ปฐมนิเทศพนักงานใหม่', t.kind])), t.kind) + F('tTrainer', 'วิทยากร', t.trainer) + F('tPlace', 'สถานที่', t.place) + T('tNote', 'หมายเหตุ', t.note) + '</div>'
        + '<div class="psec"><div class="psec-h"><b id="tCount"></b><span class="pfoot" style="margin:0"><button type="button" class="btn btn-sm btn-line" id="tAll">เลือกทั้งหมดที่แสดง</button><button type="button" class="btn btn-sm btn-line" id="tNone">ล้าง</button></span></div>'
        + '<div class="pbar" style="box-shadow:none;padding:0"><div class="psearch">' + icon('search', 18) + '<input id="tFind" type="search" placeholder="ค้นชื่อ"></div><select id="tGroup"><option value="">ทุกแผนก/อาคาร</option>' + groups.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select></div>'
        + '<div class="hpicks" id="tPeople"></div></div>'
        + '<div class="psec"><div class="psec-h"><b>ไฟล์ (ใบลงชื่อ / รูปการอบรม / ใบประกาศ)</b></div><div class="hfiles" id="tFiles"></div><div class="pfoot">' + attachBtns('training') + '</div></div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="tDel">' + icon('trash', 16) + ' ลบการอบรมนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        drawPeople();
        $('tFind').addEventListener('input', drawPeople); $('tGroup').addEventListener('change', drawPeople);
        $('tAll').addEventListener('click', function () { Array.prototype.forEach.call(document.querySelectorAll('[data-pp]'), function (el) { picked[el.getAttribute('data-pp')] = 1; }); drawPeople(); });
        $('tNone').addEventListener('click', function () { picked = {}; drawPeople(); });
        var drawF = function () { $('tFiles').innerHTML = fileLinks(t.files, isNew ? '' : 'training', t.id) + pend.map(function (f) { return '<span class="hfile">' + icon('clip', 14) + esc(f.name) + ' (รอบันทึก)</span>'; }).join(''); on('[data-rmf]', 'click', function (el) { removeFile(el, function () { closeModal(); }); }, $('tFiles')); };
        drawF();
        on('[data-att]', 'click', function (el) { pick(function (f) { pend = pend.concat(f); drawF(); }, el.getAttribute('data-src') === 'cam', 'image/*,application/pdf'); }, $('mBody'));
        if (!isNew) $('tDel').addEventListener('click', function () { confirmBox('ลบการอบรม "' + t.title + '"?', function () { return call('hrDeleteRow', state.token, 'training', t.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); }); });
      },
      check: function () { if (!v('tTitle')) return 'ระบุหลักสูตร'; if (!Object.keys(picked).length) return 'เลือกผู้เข้าอบรมอย่างน้อย 1 คน'; return ''; },
      submit: function () {
        return call('hrSaveTraining', state.token, { id: t.id || '', title: v('tTitle'), date: v('tDate'), hours: v('tHours'), kind: v('tKind'), trainer: v('tTrainer'), place: v('tPlace'), note: v('tNote'), attendees: Object.keys(picked) }).then(function (r) {
          if (!r.ok) return r.error;
          return uploadFiles('training', r.row.id, pend).then(function (u) { closeModal(); reload('บันทึกแล้ว' + (u.fails ? ' · อัปโหลดไม่สำเร็จ ' + u.fails + ' ไฟล์' : '')); });
        });
      }
    });
  }

  // ==================== วินัย / ใบเตือน ====================
  function discs() {
    var rows = H.data.disc.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    $('main').innerHTML = '<h3>วินัย / ใบเตือน</h3><p class="lead">บันทึกการตักเตือน ใบเตือน พักงาน เลิกจ้าง พร้อมแนบเอกสาร</p>'
      + '<div class="pbar"><b style="flex:1">ทั้งหมด ' + rows.length + ' รายการ</b><button class="btn btn-sm btn-primary" id="xNew">' + icon('plus', 16) + ' บันทึก</button></div>'
      + '<div class="plist">' + (rows.map(function (x) {
        var e = emp(x.empId) || { fullName: '-' };
        return '<button class="prow click" data-ds="' + x.id + '">' + photo(e, 'hph sm') + '<div class="pinfo"><b>' + esc(e.fullName) + '</b><small>' + dd(x.date) + ' · ' + esc(x.reason) + '</small></div><div class="pprice warn">' + esc(DL[x.level] || x.level) + '</div></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ</div>') + '</div>';
    $('xNew').addEventListener('click', function () { discModal(null); });
    on('[data-ds]', 'click', function (el) { discModal(H.data.disc.filter(function (x) { return x.id === el.getAttribute('data-ds'); })[0]); }, $('main'));
  }
  function discModal(x, empId) {
    var isNew = !x, pend = [];
    x = x || { empId: empId || '', date: H.data.today, level: 'verbal', files: [] };
    wide({
      icon: 'gavel', title: isNew ? 'บันทึกวินัย / ใบเตือน' : 'แก้ไข', sub: (emp(x.empId) || {}).fullName || '',
      body: '<div class="pform">' + empField('xEmp', 'พนักงาน *', x.empId) + F('xDate', 'วันที่ *', x.date, 'date') + S('xLevel', 'ระดับ', Object.keys(DL).map(function (k) { return [k, DL[k]]; }), x.level)
        + T('xReason', 'ความผิด / เหตุผล', x.reason) + T('xAction', 'การดำเนินการ', x.action) + '</div>'
        + '<div class="psec"><div class="psec-h"><b>ไฟล์ (ใบเตือนที่เซ็นแล้ว ฯลฯ)</b></div><div class="hfiles" id="xFiles"></div><div class="pfoot">' + attachBtns('disc') + '</div></div>',
      foot: isNew ? '' : '<div class="pfoot"><button type="button" class="link-btn danger" id="xDel">' + icon('trash', 16) + ' ลบรายการนี้</button></div>',
      ok: 'บันทึก',
      onOpen: function () {
        var drawF = function () { $('xFiles').innerHTML = fileLinks(x.files, isNew ? '' : 'disc', x.id) + pend.map(function (f) { return '<span class="hfile">' + icon('clip', 14) + esc(f.name) + ' (รอบันทึก)</span>'; }).join(''); on('[data-rmf]', 'click', function (el) { removeFile(el, function () { closeModal(); }); }, $('xFiles')); };
        drawF();
        on('[data-att]', 'click', function (el) { pick(function (f) { pend = pend.concat(f); drawF(); }, el.getAttribute('data-src') === 'cam', 'image/*,application/pdf'); }, $('mBody'));
        if (!isNew) $('xDel').addEventListener('click', function () { confirmBox('ลบรายการนี้?', function () { return call('hrDeleteRow', state.token, 'disc', x.id).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('ลบแล้ว'); }); }); });
      },
      check: function () { return empIdOf('xEmp') ? '' : 'เลือกพนักงานจากรายชื่อ'; },
      submit: function () {
        return call('hrSaveDisc', state.token, { id: x.id || '', empId: empIdOf('xEmp'), date: v('xDate'), level: v('xLevel'), reason: v('xReason'), action: v('xAction') }).then(function (r) {
          if (!r.ok) return r.error;
          return uploadFiles('disc', r.row.id, pend).then(function (u) { closeModal(); reload('บันทึกแล้ว' + (u.fails ? ' · อัปโหลดไม่สำเร็จ ' + u.fails + ' ไฟล์' : '')); });
        });
      }
    });
  }

  // ==================== รายงาน / พิมพ์ PDF ====================
  var REPS = [['register', 'ทะเบียนประวัติพนักงาน'], ['profile', 'ประวัติพนักงานรายบุคคล'], ['leave', 'สรุปการลารายบุคคล'], ['docs', 'เอกสารใกล้หมดอายุ'], ['train', 'สรุปการอบรม'], ['move', 'พนักงานเข้า-ออก']];
  function report() {
    var q = H.q, t = H.data.today;
    q.rep = q.rep || 'register';
    if (!q.rFrom) { q.rFrom = t.slice(0, 4) + '-01-01'; q.rTo = t; }
    var ctl = '';
    if (q.rep === 'register') ctl = '<select id="rSt"><option value="active"' + (q.rSt !== 'all' ? ' selected' : '') + '>เฉพาะที่ทำงานอยู่</option><option value="all"' + (q.rSt === 'all' ? ' selected' : '') + '>รวมที่ลาออก</option></select>'
      + '<select id="rG"><option value="">ทุกแผนก</option>' + uniq(H.data.emps.map(function (e) { return e.group; })).map(function (g) { return '<option' + (q.rG === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select>'
      + '<select id="rB"><option value="">ทุกอาคาร</option>' + uniq(H.data.emps.map(function (e) { return e.building; })).map(function (g) { return '<option' + (q.rB === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select>';
    else if (q.rep === 'profile') ctl = '<select id="rEmp">' + H.data.emps.map(function (e) { return '<option value="' + e.id + '"' + (q.rEmp === e.id ? ' selected' : '') + '>' + esc(empLabel(e)) + '</option>'; }).join('') + '</select>';
    else if (q.rep !== 'docs') ctl = '<label class="pchk">ตั้งแต่ <input type="date" id="rFrom" value="' + q.rFrom + '"></label><label class="pchk">ถึง <input type="date" id="rTo" value="' + q.rTo + '"></label>';
    $('main').innerHTML = '<h3>รายงาน / พิมพ์ PDF</h3><p class="lead">กด "พิมพ์ / บันทึก PDF" แล้วเลือกบันทึกเป็น PDF</p>'
      + '<div class="pchips noprint">' + REPS.map(function (c) { return '<button class="chip' + (q.rep === c[0] ? ' on' : '') + '" data-rep="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
      + '<div class="pbar noprint">' + ctl + '<button class="btn btn-sm btn-primary" id="rGo">ดูรายงาน</button><button class="btn btn-sm btn-line" id="rPrint">' + icon('print', 16) + ' พิมพ์ / บันทึก PDF</button></div><div id="rOut"></div>';
    on('[data-rep]', 'click', function (el) { q.rep = el.getAttribute('data-rep'); report(); }, $('main'));
    var read = function () { ['rSt', 'rG', 'rB', 'rEmp', 'rFrom', 'rTo'].forEach(function (id) { if ($(id)) q[id] = v(id); }); };
    $('rGo').addEventListener('click', function () { read(); run(); });
    $('rPrint').addEventListener('click', function () {
      var old = document.title; document.title = 'HR_' + (REPS.filter(function (r) { return r[0] === q.rep; })[0] || [])[1] + '_' + t;
      window.print(); setTimeout(function () { document.title = old; }, 1500);
    });
    run();
  }
  function run() {
    var q = H.q, out = $('rOut');
    if (q.rep === 'leave' && q.rFrom < String(+H.data.today.slice(0, 4) - 1) + '-01-01') {
      out.innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังโหลด…</div>';
      return call('hrLeaves', state.token, q.rFrom, q.rTo).then(function (r) { out.innerHTML = r.ok ? leaveRep(r.leaves) : esc(r.error); }).catch(onServerError);
    }
    pageSize(q.rep === 'register' || q.rep === 'leave' ? 'landscape' : 'portrait');
    out.innerHTML = { register: regRep, profile: profRep, leave: function () { return leaveRep(H.data.leaves); }, docs: docRep, train: trainRep, move: moveRep }[q.rep]();
  }
  function logoHtml() { var l = document.querySelector('.brand-logo'); return l ? '<img class="slogo" src="' + l.src + '" alt="">' : ''; }
  function wrap(title, info, fm, body) {
    var head = '<div class="shead">' + logoHtml() + '<div class="sco"><b>' + COMPANY_TH + '</b><span>' + COMPANY_EN + ' · ฝ่ายบุคคล</span></div><div class="stitle">' + title + '</div>'
      + (fm ? '<div class="sfm">' + esc(fm).replace(' วันที่', '<br>วันที่') + '</div>' : '<div></div>') + '</div>' + (info ? '<div class="sinfo">' + info + '</div>' : '');
    return '<div class="sreport"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
  }
  function printedAt() { var n = new Date(); return '<span>พิมพ์เมื่อ ' + dd(H.data.today) + ' ' + pad(n.getHours()) + ':' + pad(n.getMinutes()) + ' น.</span>'; }
  function regRep() {
    var q = H.q, rows = H.data.emps.filter(function (e) { return (q.rSt === 'all' || e.status !== 'ลาออก') && (!q.rG || e.group === q.rG) && (!q.rB || e.building === q.rB); });
    var f = rows.filter(function (e) { return e.gender === 'หญิง'; }).length, m = rows.filter(function (e) { return e.gender === 'ชาย'; }).length;
    var body = '<table class="hrt"><thead><tr><th style="width:3%">ลำดับ<br><small>No.</small></th><th style="width:5%">อาคาร</th><th style="width:7%">รูป</th><th style="width:15%">ชื่อ-นามสกุล<br><small>Full Name</small></th><th style="width:3.5%">หญิง</th><th style="width:3.5%">ชาย</th>'
      + '<th style="width:7%">ชื่อเล่น<br><small>Nickname</small></th><th style="width:5%">สัญชาติ</th><th style="width:5%">ศาสนา</th><th style="width:17%">ที่อยู่ ตามทะเบียนบ้าน</th><th style="width:17%">ที่อยู่ ปัจจุบัน</th><th style="width:8%">ตำแหน่ง<br><small>Position</small></th><th style="width:5%">แผนก</th></tr></thead><tbody>'
      + rows.map(function (e, i) {
        return '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + esc(e.building || '') + '</td><td class="c">' + photo(e, 'hrimg') + '</td><td><b>' + esc(e.fullName) + '</b>' + (e.code ? '<div class="ssm">' + esc(e.code) + '</div>' : '') + '</td>'
          + '<td class="c">' + (e.gender === 'หญิง' ? '1' : '') + '</td><td class="c">' + (e.gender === 'ชาย' ? '1' : '') + '</td><td>' + esc(e.nickname) + '</td><td>' + esc(e.nationality) + '</td><td>' + esc(e.religion) + '</td>'
          + '<td>' + esc(e.addrReg) + '</td><td>' + esc(e.addrNow) + '</td><td>' + esc(e.position) + (e.status !== 'ทำงาน' ? '<div class="ssm">' + esc(e.status) + '</div>' : '') + '</td><td>' + esc(e.group) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td colspan="4" class="r">รวม ' + rows.length + ' คน</td><td class="c">' + f + '</td><td class="c">' + m + '</td><td colspan="7"></td></tr></tfoot></table>';
    return wrap('ทะเบียนประวัติพนักงาน (Employee Profile Record)', [q.rG ? '<span>แผนก <b>' + esc(q.rG) + '</b></span>' : '', q.rB ? '<span>อาคาร <b>' + esc(q.rB) + '</b></span>' : ''].join('') + printedAt(), H.data.settings.fmRegister, body);
  }
  function profRep() {
    var e = emp(H.q.rEmp) || H.data.emps[0]; if (!e) return '<div class="panel">ยังไม่มีพนักงาน</div>';
    H.q.rEmp = e.id;
    var y = H.data.today.slice(0, 4), used = {};
    H.data.leaves.filter(function (l) { return l.empId === e.id && l.dateFrom.slice(0, 4) === y && l.status !== 'ไม่อนุมัติ'; }).forEach(function (l) { used[l.type] = (used[l.type] || 0) + (l.type === 'late' ? 1 : Number(l.days) || 0); });
    var r = function (k, val) { return '<tr><th>' + k + '</th><td>' + esc(val || '-') + '</td></tr>'; };
    var dc = H.data.docs.filter(function (d) { return d.empId === e.id; });
    var tr = H.data.trainings.filter(function (t) { return t.attendees.indexOf(e.id) >= 0; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var ds = H.data.disc.filter(function (x) { return x.empId === e.id; });
    var body = '<div class="hpr"><div>' + photo(e, 'hprimg') + '</div><table class="hkt">' + r('ชื่อ-นามสกุล', e.fullName) + r('ชื่อเล่น', e.nickname) + r('รหัสพนักงาน', e.code) + r('ตำแหน่ง', e.position) + r('แผนก / อาคาร', [e.group, e.building].filter(String).join(' / '))
      + r('ประเภทการจ้าง', e.empType) + r('วันเริ่มงาน', e.startDate ? thDate(e.startDate) + ' (อายุงาน ' + yrs(e.startDate) + ')' : '') + r('สถานะ', e.status + (e.endDate ? ' ' + thDate(e.endDate) : '')) + '</table></div>'
      + '<h5 class="hh">ข้อมูลส่วนตัว</h5><table class="hkt full">' + r('เพศ', e.gender) + r('สัญชาติ / ศาสนา', [e.nationality, e.religion].filter(String).join(' / ')) + r('วันเกิด', e.birthDate ? thDate(e.birthDate) + ' (อายุ ' + yrs(e.birthDate) + ')' : '')
      + r('เลขบัตรประชาชน / พาสปอร์ต', e.idNo) + r('เบอร์โทร', e.phone) + r('วุฒิการศึกษา', e.education) + r('ที่อยู่ตามทะเบียนบ้าน', e.addrReg) + r('ที่อยู่ปัจจุบัน', e.addrNow)
      + r('ผู้ติดต่อฉุกเฉิน', [e.emergencyName, e.emergencyPhone].filter(String).join(' · ')) + '</table>'
      + '<h5 class="hh">เอกสาร</h5><table class="hrt sm"><thead><tr><th>ประเภท</th><th>เลขที่</th><th>วันที่ออก</th><th>วันหมดอายุ</th></tr></thead><tbody>' + (dc.map(function (d) { return '<tr><td>' + esc(DT[d.type] || d.type) + '</td><td>' + esc(d.number) + '</td><td>' + dd(d.issueDate) + '</td><td>' + dd(d.expiryDate) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="c muted">-</td></tr>') + '</tbody></table>'
      + '<h5 class="hh">สรุปวันลา ปี ' + (+y + 543) + '</h5><table class="hrt sm"><thead><tr>' + ['sick', 'personal', 'vacation', 'maternity', 'ordain', 'absent', 'late'].map(function (k) { return '<th>' + LT[k] + '</th>'; }).join('') + '</tr></thead><tbody><tr>'
      + ['sick', 'personal', 'vacation', 'maternity', 'ordain', 'absent', 'late'].map(function (k) { var qq = (H.data.settings.quotaMap || {})[k]; return '<td class="c">' + (used[k] || 0) + (qq ? ' / ' + qq : '') + '</td>'; }).join('') + '</tr></tbody></table>'
      + '<h5 class="hh">ประวัติการอบรม</h5><table class="hrt sm"><thead><tr><th>วันที่</th><th>หลักสูตร</th><th>ชั่วโมง</th><th>วิทยากร</th></tr></thead><tbody>' + (tr.map(function (t) { return '<tr><td>' + dd(t.date) + '</td><td>' + esc(t.title) + '</td><td class="c">' + t.hours + '</td><td>' + esc(t.trainer) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="c muted">-</td></tr>') + '</tbody></table>'
      + (ds.length ? '<h5 class="hh">วินัย / ใบเตือน</h5><table class="hrt sm"><thead><tr><th>วันที่</th><th>ระดับ</th><th>เหตุผล</th></tr></thead><tbody>' + ds.map(function (x) { return '<tr><td>' + dd(x.date) + '</td><td>' + esc(DL[x.level]) + '</td><td>' + esc(x.reason) + '</td></tr>'; }).join('') + '</tbody></table>' : '');
    return wrap('ประวัติพนักงาน', printedAt(), H.data.settings.fmProfile, body);
  }
  function leaveRep(all) {
    var q = H.q, from = q.rFrom, to = q.rTo, quotas = H.data.settings.quotaMap || {};
    var ks = ['sick', 'personal', 'vacation', 'maternity', 'ordain', 'other', 'absent', 'late'];
    var sum = {};
    all.filter(function (l) { return l.status !== 'ไม่อนุมัติ' && l.dateFrom <= to && (l.dateTo || l.dateFrom) >= from; }).forEach(function (l) {
      sum[l.empId] = sum[l.empId] || {}; var k = ks.indexOf(l.type) >= 0 ? l.type : 'other';
      sum[l.empId][k] = (sum[l.empId][k] || 0) + (l.type === 'late' ? 1 : Number(l.days) || 0);
      if (l.type === 'late') sum[l.empId].min = (sum[l.empId].min || 0) + (Number(l.minutes) || 0);
    });
    var rows = H.data.emps.filter(function (e) { return sum[e.id] || e.status !== 'ลาออก'; });
    var oneYear = from.slice(0, 4) === to.slice(0, 4) && loadedYear(from.slice(0, 4));   // คงเหลือ = สิทธิ์ทั้งปีของปีนั้น
    var body = '<table class="hrt"><thead><tr><th>ลำดับ</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>แผนก</th>' + ks.map(function (k) { return '<th class="c">' + LT[k] + (quotas[k] ? '<br><small>สิทธิ์ ' + quotas[k] + '</small>' : '') + '</th>'; }).join('') + '<th class="c">รวมวันลา</th></tr></thead><tbody>'
      + rows.map(function (e, i) {
        var s = sum[e.id] || {}, tot = ks.filter(function (k) { return k !== 'late'; }).reduce(function (a, k) { return a + (s[k] || 0); }, 0);
        return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(e.fullName) + (e.nickname ? ' (' + esc(e.nickname) + ')' : '') + '</td><td>' + esc(e.position) + '</td><td>' + esc(e.group) + '</td>'
          + ks.map(function (k) {
            var n = s[k] || 0, qq = oneYear ? quotaOf(e, k, from.slice(0, 4)) : null, rem = qq != null ? qq - usedOf(e.id, k, from.slice(0, 4)) : null;
            return '<td class="c' + (rem != null && rem < 0 ? ' neg b' : '') + '">' + (n ? n + (k === 'late' ? ' ครั้ง' + (s.min ? '<br><small>' + s.min + ' นาที</small>' : '') : '') : '')
              + (rem != null ? '<br><small>' + (rem < 0 ? 'เกิน ' + (-rem) : 'เหลือ ' + rem) + '</small>' : '') + '</td>';
          }).join('') + '<td class="c b">' + (tot || '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    return wrap('สรุปการลา ขาดงาน มาสาย รายบุคคล', '<span>ช่วงวันที่ <b>' + thDate(from) + ' – ' + thDate(to) + '</b></span>' + printedAt(), H.data.settings.fmLeave, body);
  }
  function docRep() {
    var t = H.data.today, alert = Number(H.data.settings.alertDays) || 60;
    var rows = H.data.docs.filter(function (d) { var e = emp(d.empId); return e && e.status !== 'ลาออก' && d.expiryDate && days(t, d.expiryDate) <= alert; }).sort(function (a, b) { return String(a.expiryDate).localeCompare(String(b.expiryDate)); });
    var body = '<table class="hrt"><thead><tr><th>ลำดับ</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>ประเภทเอกสาร</th><th>เลขที่</th><th>วันหมดอายุ</th><th>สถานะ</th></tr></thead><tbody>'
      + (rows.map(function (d, i) { var e = emp(d.empId), left = days(t, d.expiryDate); return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(e.fullName) + '</td><td>' + esc(e.position) + '</td><td>' + esc(DT[d.type] || d.type) + '</td><td>' + esc(d.number) + '</td><td class="c">' + dd(d.expiryDate) + '</td><td class="c ' + (left < 0 ? 'neg b' : 'warn') + '">' + (left < 0 ? 'หมดแล้ว ' + (-left) + ' วัน' : 'อีก ' + left + ' วัน') + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="c muted">ไม่มีเอกสารที่หมดอายุใน ' + alert + ' วัน</td></tr>') + '</tbody></table>';
    return wrap('รายงานเอกสารพนักงานหมดอายุ / ใกล้หมดอายุ', '<span>ภายใน <b>' + alert + ' วัน</b></span>' + printedAt(), '', body);
  }
  function trainRep() {
    var q = H.q, rows = H.data.trainings.filter(function (t) { return t.date >= q.rFrom && t.date <= q.rTo; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var per = {}; rows.forEach(function (t) { t.attendees.forEach(function (id) { per[id] = (per[id] || 0) + (Number(t.hours) || 0); }); });
    var body = '<h5 class="hh">หลักสูตร (' + rows.length + ')</h5><table class="hrt"><thead><tr><th>วันที่</th><th>หลักสูตร</th><th>ประเภท</th><th>วิทยากร</th><th class="c">ชั่วโมง</th><th class="c">ผู้เข้าอบรม</th><th class="c">คน-ชั่วโมง</th></tr></thead><tbody>'
      + (rows.map(function (t) { return '<tr><td>' + dd(t.date) + '</td><td>' + esc(t.title) + '</td><td>' + esc(t.kind) + '</td><td>' + esc(t.trainer) + '</td><td class="c">' + t.hours + '</td><td class="c">' + t.attendees.length + '</td><td class="c">' + (t.hours * t.attendees.length) + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="c muted">-</td></tr>') + '</tbody></table>'
      + '<h5 class="hh">ชั่วโมงอบรมรายบุคคล</h5><table class="hrt"><thead><tr><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>แผนก</th><th class="c">ชั่วโมงรวม</th></tr></thead><tbody>'
      + active().map(function (e) { return '<tr><td>' + esc(e.fullName) + '</td><td>' + esc(e.position) + '</td><td>' + esc(e.group) + '</td><td class="c' + (per[e.id] ? '' : ' muted') + '">' + (per[e.id] || 0) + '</td></tr>'; }).join('') + '</tbody></table>';
    return wrap('รายงานการอบรม', '<span>ช่วงวันที่ <b>' + thDate(q.rFrom) + ' – ' + thDate(q.rTo) + '</b></span>' + printedAt(), '', body);
  }
  function moveRep() {
    var q = H.q, ins = H.data.emps.filter(function (e) { return e.startDate && e.startDate >= q.rFrom && e.startDate <= q.rTo; }), outs = H.data.emps.filter(function (e) { return e.status === 'ลาออก' && e.endDate && e.endDate >= q.rFrom && e.endDate <= q.rTo; });
    var tb = function (rows, k, extra) { return '<table class="hrt"><thead><tr><th>ลำดับ</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>แผนก</th><th>วันที่</th>' + (extra ? '<th>เหตุผล</th>' : '') + '</tr></thead><tbody>' + (rows.map(function (e, i) { return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(e.fullName) + '</td><td>' + esc(e.position) + '</td><td>' + esc(e.group) + '</td><td>' + dd(e[k]) + '</td>' + (extra ? '<td>' + esc(e.endReason) + '</td>' : '') + '</tr>'; }).join('') || '<tr><td colspan="6" class="c muted">-</td></tr>') + '</tbody></table>'; };
    return wrap('รายงานพนักงานเข้า-ออก', '<span>ช่วงวันที่ <b>' + thDate(q.rFrom) + ' – ' + thDate(q.rTo) + '</b></span><span>เข้าใหม่ <b>' + ins.length + '</b> · ลาออก <b>' + outs.length + '</b> · ปัจจุบัน <b>' + active().length + '</b> คน</span>' + printedAt(), '',
      '<h5 class="hh">พนักงานเข้าใหม่</h5>' + tb(ins, 'startDate') + '<h5 class="hh">พนักงานลาออก</h5>' + tb(outs, 'endDate', true));
  }

  // ==================== ตั้งค่า ====================
  function settings() {
    var s = H.data.settings, qm = s.quotaMap || {};
    $('main').innerHTML = '<h3>ตั้งค่าฝ่ายบุคคล</h3><p class="lead">สิทธิ์วันลาต่อปี รายชื่อแผนก/อาคาร การแจ้งเตือนเอกสาร และรหัสแบบฟอร์มบนรายงาน</p>'
      + '<div class="panel"><h4 style="margin-top:0">สิทธิ์วันลาต่อปี (วัน)</h4><div class="pform">' + ['sick', 'personal', 'vacation', 'maternity', 'ordain'].map(function (k) { return F('q_' + k, LT[k], qm[k] == null ? '' : qm[k], 'number', ' min="0"'); }).join('') + '</div>'
      + '<h4>รายชื่อ / การแจ้งเตือน</h4><div class="pform">' + F('sGroups', 'แผนก (คั่นด้วย , )', s.groups) + F('sBld', 'อาคาร (คั่นด้วย , )', s.buildings)
      + F('sAlert', 'แจ้งเตือนเอกสารล่วงหน้า (วัน)', s.alertDays, 'number', ' min="7"') + S('sWork', 'วันทำงาน (ใช้นับวันลา)', [['จ-ส', 'จันทร์–เสาร์'], ['จ-ศ', 'จันทร์–ศุกร์']], s.workDays) + '</div>'
      + '<h4>รหัสแบบฟอร์ม (แสดงมุมขวาบนของรายงาน · เว้นว่าง = ไม่แสดง)</h4><div class="pform">' + F('sFmR', 'ทะเบียนประวัติพนักงาน', s.fmRegister, 'text', ' placeholder="เช่น FM-HR-01-01 Rev.00 วันที่ประกาศใช้ 01/01/2026"')
      + F('sFmP', 'ประวัติพนักงานรายบุคคล', s.fmProfile) + F('sFmL', 'สรุปการลา', s.fmLeave) + '</div>'
      + '<button class="btn btn-primary" id="sSave">' + icon('check', 16) + ' บันทึกการตั้งค่า</button></div>';
    $('sSave').addEventListener('click', function () {
      var qq = {}; ['sick', 'personal', 'vacation', 'maternity', 'ordain'].forEach(function (k) { if (v('q_' + k) !== '') qq[k] = Number(v('q_' + k)); });
      var b = $('sSave'); b.disabled = true;
      call('hrSaveSettings', state.token, { quotas: JSON.stringify(qq), groups: v('sGroups'), buildings: v('sBld'), alertDays: v('sAlert'), workDays: v('sWork'), fmRegister: v('sFmR'), fmProfile: v('sFmP'), fmLeave: v('sFmL') })
        .then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); H.data.settings = r.settings; toast('บันทึกการตั้งค่าแล้ว'); }).catch(onServerError);
    });
  }
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><p class="lead">บันทึกทุกครั้งที่เพิ่ม/แก้/ลบข้อมูล</p><div id="lOut" class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
    call('hrLog', state.token, 300).then(function (r) {
      $('lOut').outerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>ข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody>'
        + (r.rows.map(function (x) { return '<tr><td class="nw">' + esc(x.time) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.table) + '</td><td>' + esc(String(x.detail).replace(/data:image\/[^"]+/g, '[รูป]')) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีประวัติ</td></tr>') + '</tbody></table></div>';
    }).catch(onServerError);
  }

  // ---------- CSS ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    '.hgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.hcard{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;text-align:left;box-shadow:var(--shadow);color:inherit}.hcard:hover{border-color:var(--c)}.hcard.off{opacity:.55}',
    '.hph{width:64px;height:80px;object-fit:cover;border-radius:10px;flex:none;background:#e2e8f0;display:inline-grid;place-items:center;font-weight:700;font-size:22px;color:#64748b}.hph.sm{width:40px;height:50px;font-size:15px;border-radius:8px}.hph.xs{width:28px;height:35px;font-size:12px;border-radius:6px}',
    '.hinfo{min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13.5px}.hinfo b{font-size:14.5px}.hinfo span{color:#334155}.hinfo small{font-size:12px}',
    '.hprof{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:14px}.hprof-ph{display:flex;flex-direction:column;gap:6px;align-items:center}.hbig{width:150px;height:188px;object-fit:cover;border-radius:14px;background:#e2e8f0;display:inline-grid;place-items:center;font-size:48px;font-weight:700;color:#64748b}',
    '.hkvs{flex:1;min-width:260px;display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}.hkv{display:flex;flex-direction:column;font-size:14px;border-bottom:1px dashed var(--line);padding-bottom:4px}.hkv span{font-size:12px;color:var(--muted)}',
    '.hquota{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px}.hquota div{background:#f8fafc;border-radius:10px;padding:6px;text-align:center}.hquota span{display:block;font-size:11.5px;color:var(--muted)}.hquota b{font-size:18px}.hquota small{font-size:11px;color:var(--muted);margin-left:2px}.hquota em{display:block;font-style:normal;font-size:11.5px;font-weight:600;color:#15803d}.hquota em.neg{color:#dc2626}.hqinfo{margin:4px 0 10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border-left:4px solid #94a3b8;font-size:13.5px}.hqinfo:empty{display:none}.hqinfo.ok{background:#f0fdf4;border-color:#16a34a}.hqinfo.warn{background:#fffbeb;border-color:#d97706}.hqinfo.bad{background:#fef2f2;border-color:#dc2626}.hqrow{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:4px}.hqrow b{font-size:16px}.hbal td small{display:block;font-size:11px;color:var(--muted)}.hbal tr{cursor:pointer}.hbal tr:hover td{background:#f8fafc}',
    '.hfiles{display:flex;flex-direction:column;gap:4px}.hfile{display:flex;align-items:center;gap:8px;font-size:13.5px}.hfile a{display:inline-flex;gap:4px;align-items:center;color:var(--c);word-break:break-all}.hfile svg{width:14px;height:14px}',
    '.htype{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;background:#fef3c7;color:#b45309}.htype.sick{background:#dbeafe;color:#1d4ed8}.htype.absent{background:#fee2e2;color:#b91c1c}.htype.late{background:#f1f5f9;color:#475569}.htype.vacation{background:#dcfce7;color:#15803d}',
    '.hpicks{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;max-height:320px;overflow:auto;margin-top:8px}.hpick{display:flex;align-items:center;gap:8px;border:1.5px solid var(--line);border-radius:10px;padding:5px 8px;font-size:13.5px;cursor:pointer;margin:0}.hpick.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 7%,white)}.hpick small{display:block;font-size:11px;color:var(--muted)}',
    '.hnewph{display:flex;align-items:center;gap:10px;margin-bottom:10px}.xsep{height:1px;background:var(--line);margin:8px 0}',
    '.hrt{width:100%;border-collapse:collapse;font-size:11.5px;table-layout:auto}.hrt th{background:#f1f5f9;border:1px solid #0f172a;padding:4px;text-align:center;font-size:11px}.hrt th small{font-weight:400;color:#475569}.hrt td{border:1px solid #0f172a;padding:4px;vertical-align:top}.hrt .c{text-align:center}.hrt .r{text-align:right}.hrt .b{font-weight:700}.hrt tfoot td{background:#f1f5f9;font-weight:700}.hrt.sm{font-size:11.5px;margin-bottom:6px}',
    '.hrimg{width:52px;height:65px;object-fit:cover;border-radius:4px;display:inline-grid;place-items:center;background:#e2e8f0;font-size:16px;font-weight:700;color:#64748b}',
    '.hpr{display:flex;gap:16px;align-items:flex-start;margin:8px 0}.hprimg{width:130px;height:163px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;display:inline-grid;place-items:center;background:#e2e8f0;font-size:40px;color:#64748b}',
    '.hkt{border-collapse:collapse;font-size:12.5px;flex:1}.hkt.full{width:100%}.hkt th{text-align:left;font-weight:600;color:#334155;background:#f8fafc;border:1px solid #cbd5e1;padding:4px 8px;width:30%}.hkt td{border:1px solid #cbd5e1;padding:4px 8px}.hh{font-size:13px;margin:12px 0 4px;padding-left:8px;border-left:4px solid var(--c)}',
    '@media (max-width:700px){.hkvs{grid-template-columns:1fr}.hquota{grid-template-columns:repeat(3,1fr)}.hgrid{grid-template-columns:1fr}}',
    '@media print{.hrt{font-size:7.5pt}.hrt th{font-size:7pt}.hrimg{width:38px;height:48px}.hrt tr{break-inside:avoid}.hkt{font-size:9pt}.hh{font-size:10pt}}'
  ].join('\n');
  document.head.appendChild(css);
})();
