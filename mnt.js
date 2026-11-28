// ==================== ฝ่ายช่าง (MNT) — ผู้ใช้ขอ 28/11/69 ====================
// หน้าเว็บของโมดูล "maintenance" — index.html เรียก MNTM.menus() / MNTM.render(page) · API ใน Mnt.gs / MntLine.gs (repo apps-script/departments)
// ใบแจ้งซ่อม (แจ้งจาก LINE / QR → การ์ดเข้ากลุ่มช่าง) · ทะเบียนเครื่องจักร · แผนบำรุงรักษา (PM) · อะไหล่ & สต๊อก · ตั้งค่า & LINE
// Dashboard ใช้ร่วมกับการ์ดผู้บริหาร: MNTM.dashHtml(r, opt)
(function () {
  var H = window.MNTM = { data: null, loading: null, q: {} };
  Object.assign(ICONS, {
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    machine: '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="9" cy="13" r="3"/><path d="M15 11h3M15 14h3M7 7V4h4v3"/>',
    calcheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/>',
    part: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'
  });
  var MENUS = [
    { id: 'mt_dash', label: 'Dashboard ฝ่ายช่าง', ic: 'chart' },
    { id: 'mt_rep', label: 'ใบแจ้งซ่อม', ic: 'wrench' },
    { id: 'mt_mac', label: 'ทะเบียนเครื่องจักร', ic: 'machine' },
    { id: 'mt_pm', label: 'แผนบำรุงรักษา (PM)', ic: 'calcheck' },
    { id: 'mt_part', label: 'อะไหล่ & สต๊อก', ic: 'part' },
    { id: 'mt_set', label: 'ตั้งค่า & LINE แจ้งซ่อม', ic: 'gear' },
    { id: 'mt_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var ST = { 'new': 'รอรับงาน', accepted: 'รับงานแล้ว', doing: 'กำลังซ่อม', wait: 'รอ (อะไหล่ / ช่างนอก / อื่น ๆ)', done: 'ซ่อมเสร็จ รอตรวจรับ', closed: 'ปิดงานแล้ว', cancel: 'ยกเลิก' };
  var STC = { 'new': '#c2410c', accepted: '#1d4ed8', doing: '#1d4ed8', wait: '#a16207', done: '#15803d', closed: '#475569', cancel: '#94a3b8' };
  var URG = { low: 'ไม่เร่ง', normal: 'ปกติ', high: 'ด่วน', urgent: 'ด่วนมาก' }, URGC = { low: '#64748b', normal: '#475569', high: '#ea580c', urgent: '#dc2626' };
  var UNITS = { day: 'วัน', week: 'สัปดาห์', month: 'เดือน', year: 'ปี' };
  var MST = { active: 'ใช้งาน', standby: 'สำรอง / ไม่ได้ใช้', retired: 'เลิกใช้' };
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var SRC = { line: 'LINE', qr: 'QR', web: 'ฝ่ายช่างบันทึก', pm: 'จาก PM' };

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(2) : esc(iso); }
  function dt(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? dd(s) + ' ' + m[4] + ':' + m[5] : dd(s); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function days(a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 864e5); }
  function list(s) { return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function nf(v, d) { return v === '' || v == null || isNaN(v) ? '-' : Number(v).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 2 : d }); }
  function baht(v) { return nf(Math.round(Number(v) || 0), 0) + ' บาท'; }
  function hm(min) { min = Math.round(Number(min) || 0); if (!min) return '0 นาที'; var h = Math.floor(min / 60), m = min % 60; return (h ? h + ' ชม. ' : '') + (m ? m + ' นาที' : '').trim(); }
  function S_() { return H.data.settings; }
  function wide(cfg) { cfg.wide = true; cfg.color = cfg.color || state.dept.color; openModal(cfg); }
  function upsert(a, o) { var i = a.map(function (x) { return x.id; }).indexOf(o.id); if (i >= 0) a[i] = o; else a.unshift(o); }
  function stTag(s) { return '<span class="mtst" style="--s:' + (STC[s] || '#475569') + '">' + esc(ST[s] || s) + '</span>'; }
  function urgTag(r) { return r.urgency === 'urgent' || r.urgency === 'high' || r.stopLine ? '<span class="mtst" style="--s:' + URGC[r.urgency] + '">' + (r.stopLine ? '⛔ ' : '') + URG[r.urgency] + '</span>' : ''; }
  function ageTxt(at) { var m = String(at || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); if (!m) return ''; var h = Math.max(0, (Date.now() - new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()) / 36e5); return h < 1 ? Math.max(1, Math.round(h * 60)) + ' นาทีก่อน' : h < 48 ? Math.round(h) + ' ชม.ก่อน' : Math.round(h / 24) + ' วันก่อน'; }
  function shrink(file, max) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, (max || 1280) / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        res(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(''); }; im.src = u;
    });
  }
  function pickFiles(cam, cb) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (cam) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function () { var f = Array.prototype.slice.call(inp.files || []); document.body.removeChild(inp); if (f.length) cb(f); });
    inp.click();
  }
  function copy(text) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('คัดลอกแล้ว'); }, function () { toast('คัดลอกไม่ได้ — กดค้างที่ข้อความเพื่อคัดลอก'); }); }
  function machineOf(id) { return H.data.machines.filter(function (m) { return m.id === id; })[0]; }
  // โหลดข้อมูลล่าสุดเงียบ ๆ (ยอดอะไหล่ / Dashboard) — วาดหน้าใหม่เมื่อไม่มีหน้าต่างเปิดอยู่
  function quietRefresh() {
    call.quiet = true; var p = call('mntLoad', state.token); call.quiet = false;
    p.then(function (d) { H.data = d; window.dashCall.cache = {}; renderNav(); if ($('modalOverlay').classList.contains('hidden')) H.render(state.page); }).catch(function () {});
  }
  function reload(msg) { H.data = null; window.dashCall.cache = {}; return H.load().then(function () { if (msg) toast(msg); H.render(state.page); }); }

  // ---------- โหลด ----------
  H.load = function () {
    if (H.loading) return H.loading;
    H.loading = call('mntLoad', state.token).then(function (d) { H.data = d; H.loading = null; return d; }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  H.reset = function () { H.data = null; H.q = {}; };
  H.menus = function () {
    var d = H.data, n = d ? d.repairs.filter(function (r) { return r.status === 'new'; }).length : 0, pm = d ? d.pm.filter(function (p) { return p.overdue; }).length : 0;
    return MENUS.map(function (m) { return m.id === 'mt_rep' && n ? Object.assign({}, m, { label: m.label + ' 🔴 ' + n }) : m.id === 'mt_pm' && pm ? Object.assign({}, m, { label: m.label + ' ⚠ ' + pm }) : m; });
  };
  H.render = function (page) {
    if (!H.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      H.load().then(function () { renderNav(); if (state.page === page) H.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet / โฟลเดอร์ของฝ่ายช่างในหน้าผู้ดูแลระบบ</span></div></div>';
      });
      return;
    }
    ({ mt_dash: dash, mt_rep: repPage, mt_mac: macPage, mt_pm: pmPage, mt_part: partPage, mt_set: setPage, mt_log: logPage }[page] || dash)();
  };

  // ==================== Dashboard ====================
  function dash() {
    var t = H.data.today, q = H.q;
    if (!q.from) { q.from = t.slice(0, 8) + '01'; q.to = t; }
    var quick = [['เดือนนี้', t.slice(0, 8) + '01', t], ['3 เดือน', addDays(t, -89), t], ['ปีนี้', t.slice(0, 4) + '-01-01', t], ['12 เดือน', addDays(t, -364), t]];
    $('main').innerHTML = '<h3>Dashboard ฝ่ายช่าง</h3>'
      + '<div class="pbar noprint"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<input type="date" id="qFrom" value="' + q.from + '" aria-label="ตั้งแต่"> – <input type="date" id="qTo" value="' + q.to + '" aria-label="ถึง"></div>'
      + '<div id="qOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>';
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['qFrom', 'qTo'].forEach(function (id) { $(id).addEventListener('change', function () { var a = $('qFrom').value, b = $('qTo').value; if (a && b && a <= b) { q.from = a; q.to = b; dash(); } else toast('เลือกช่วงวันที่ให้ถูกต้อง'); }); });
    var my = H.dseq = (H.dseq || 0) + 1;
    dashCall('mntDashboard', [q.from, q.to], function (r) {
      if (my !== H.dseq || state.page !== 'mt_dash') return;
      $('qOut').innerHTML = r.ok ? H.dashHtml(r, { click: true }) : '<div class="panel">' + esc(r.error) + '</div>';
      on('[data-rep]', 'click', function (el) { H.q.rst = 'all'; openRepair(el.getAttribute('data-rep')); }, $('qOut'));
      on('[data-go]', 'click', function (el) { go(el.getAttribute('data-go')); }, $('qOut'));
    }).catch(onServerError);
  }
  H.dashHtml = function (r, opt) {
    opt = opt || {};
    var k = r.kpi, D = window.DCH, c = opt.click;
    var tile = function (v, label, color, sub, goto) { return '<' + (c && goto ? 'button data-go="' + goto + '"' : 'div') + ' class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</' + (c && goto ? 'button' : 'div') + '>'; };
    var bars = function (arr, color) {
      var mx = Math.max.apply(null, arr.map(function (x) { return x.n; }).concat([1]));
      return arr.length ? arr.map(function (x) { return '<div class="mtbr"><span>' + esc(x.name) + '</span><i><em style="width:' + Math.max(4, x.n / mx * 100) + '%;background:' + color + '"></em></i><b>' + x.n + '</b></div>'; }).join('') : '<div class="muted">ไม่มีข้อมูล</div>';
    };
    var row = function (x, right) {
      return '<div class="li mtli' + (c ? ' tap' : '') + '"' + (c ? ' data-rep="' + esc(x.id) + '" role="button" tabindex="0"' : '') + '>' + (x.photo ? '<img class="mtth" src="' + esc(x.photo) + '=w160" alt="" loading="lazy">' : '<span class="mtth mtnoph">' + icon('wrench', 22) + '</span>')
        + '<span><b>' + esc(x.machineName || x.location || '-') + '</b><small>' + esc(x.code) + ' · ' + esc(String(x.problem || '').slice(0, 90)) + '</small><small>' + stTag(x.status) + ' ' + urgTag(x) + (x.assignee ? ' 👷 ' + esc(x.assignee) : '') + '</small></span>' + right + '</div>';
    };
    var ym = function (s) { return MONTHS[+s.slice(5, 7) - 1] + ' ' + String(+s.slice(0, 4) + 543).slice(2); };
    var pmPct = k.pmPlanned ? Math.min(100, Math.round(k.pmDone / k.pmPlanned * 100)) : '';
    return '<div class="kpis">'
      + tile(k.open, 'งานซ่อมค้าง', k.open ? '#ea580c' : '#16a34a', 'รอรับงาน ' + k.waiting + (k.urgentOpen ? ' · ⛔ ด่วน/หยุดผลิต ' + k.urgentOpen : ''), 'mt_rep')
      + tile(k.done, 'ซ่อมเสร็จในช่วงนี้', '#16a34a', 'แจ้งเข้ามา ' + k.reported + ' งาน' + (k.waitConfirm ? ' · รอตรวจรับ ' + k.waitConfirm : ''))
      + tile(k.avgHours === '' ? '-' : k.avgHours + ' ชม.', 'เวลาซ่อมเฉลี่ย', '#2563eb', k.avgAcceptMin === '' ? 'ตั้งแต่แจ้งจนซ่อมเสร็จ' : 'รับงานเฉลี่ย ' + hm(k.avgAcceptMin) + ' หลังแจ้ง')
      + tile(hm(k.downtime), 'เวลาเครื่องหยุด', k.downtime ? '#dc2626' : '#16a34a', 'รวมงานที่ซ่อมเสร็จในช่วงนี้')
      + tile(baht(k.cost), 'ค่าใช้จ่ายซ่อมบำรุง', '#7c3aed', 'อะไหล่ ' + baht(k.partsCost) + ' · ภายนอก ' + baht(k.outCost) + (k.pmCost ? ' · PM ' + baht(k.pmCost) : ''))
      + tile(k.pmOverdue, 'PM เลยกำหนด', k.pmOverdue ? '#dc2626' : '#16a34a', 'ถึงกำหนดใน 14 วัน ' + k.pmSoon + (pmPct !== '' ? ' · ทำตามแผน ' + pmPct + '%' : ''), 'mt_pm')
      + tile(k.machines, 'เครื่องจักรในทะเบียน', '#475569', k.machinesDown ? 'มีงานซ่อมค้าง ' + k.machinesDown + ' เครื่อง' : 'ไม่มีเครื่องเสียค้าง', 'mt_mac')
      + tile(k.partsLow, 'อะไหล่ใกล้หมด', k.partsLow ? '#d97706' : '#16a34a', 'ต่ำกว่าจุดสั่งซื้อ', 'mt_part')
      + '</div>'
      + (r.byMonth.length > 1 && D ? '<div class="panel pbox mtfull"><h4>' + icon('chart', 18) + ' งานแจ้งซ่อม / ซ่อมเสร็จ รายเดือน</h4>' + D.area({ labels: r.byMonth.map(function (x) { return ym(x.ym); }), series: [
        { name: 'แจ้งซ่อม', color: '#ea580c', values: r.byMonth.map(function (x) { return x.reported; }), fill: true }, { name: 'ซ่อมเสร็จ', color: '#16a34a', values: r.byMonth.map(function (x) { return x.done; }) }], unit: ' งาน', height: 200 })
        + (r.byMonth.some(function (x) { return x.cost; }) ? '<div class="xsub2">ค่าใช้จ่ายรายเดือน (บาท)</div>' + D.area({ labels: r.byMonth.map(function (x) { return ym(x.ym); }), series: [{ name: 'ค่าใช้จ่าย', color: '#7c3aed', values: r.byMonth.map(function (x) { return x.cost; }), fill: true }], unit: ' บาท', height: 160 }) : '') + '</div>' : '')
      + '<div class="pgrid">'
      + '<div class="panel pbox"><h4>' + icon('wrench', 18) + ' งานซ่อมค้าง (' + k.open + ')</h4>' + (r.openList.length ? r.openList.map(function (x) { return row(x, '<b class="' + (x.ageH >= 24 ? 'neg' : '') + '">' + esc(ageTxt(x.reportAt)) + '</b>'); }).join('') : '<div class="mtok">🎉 ไม่มีงานค้าง</div>') + '</div>'
      + (r.confirmList.length ? '<div class="panel pbox"><h4>' + icon('check', 18) + ' ซ่อมเสร็จ รอผู้แจ้งตรวจรับ</h4>' + r.confirmList.map(function (x) { return row(x, ''); }).join('') + '</div>' : '')
      + '<div class="panel pbox"><h4>' + icon('calcheck', 18) + ' PM ถึงกำหนด (14 วัน)</h4>' + (r.pmList.length ? r.pmList.map(function (p) {
        var n = days(r.today, p.nextDate);
        return '<div class="li"><span>' + esc(p.title) + '<small>' + esc(p.machineName || '-') + ' · ทุก ' + esc(p.every) + (p.assignee ? ' · 👷 ' + esc(p.assignee) : '') + '</small></span><b class="' + (n < 0 ? 'neg' : '') + '">' + dd(p.nextDate) + '<small>' + (n < 0 ? 'เลย ' + (-n) + ' วัน' : n === 0 ? 'วันนี้' : 'อีก ' + n + ' วัน') + '</small></b></div>';
      }).join('') : '<div class="mtok">✅ ไม่มี PM ถึงกำหนด</div>') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' ประเภทงานซ่อม (' + k.reported + ')</h4>' + (D && r.byCategory.length ? D.donut(r.byCategory, { sub: 'งานแจ้งซ่อม', unit: ' งาน', title: 'งาน' }) : bars(r.byCategory, '#475569'))
      + (r.byBuilding.length ? '<div class="xsub2">แยกอาคาร</div>' + bars(r.byBuilding, '#0891b2') : '') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('machine', 18) + ' เครื่องที่เสียบ่อย</h4>' + (r.topMachines.length ? r.topMachines.map(function (m) {
        return '<div class="li"><span>' + esc(m.name) + '<small>' + esc(m.building || '') + (m.down ? ' · หยุด ' + hm(m.down) : '') + (m.cost ? ' · ' + baht(m.cost) : '') + '</small></span><b>' + m.n + ' ครั้ง</b></div>';
      }).join('') : '<div class="muted">ไม่มีข้อมูล</div>') + '</div>'
      + (r.techs.length ? '<div class="panel pbox"><h4>' + icon('users', 18) + ' ผลงานช่าง (ซ่อมเสร็จ)</h4>' + r.techs.map(function (x) { return '<div class="li"><span>' + esc(x.name) + '<small>' + (x.avgH !== '' ? 'เฉลี่ย ' + x.avgH + ' ชม. / งาน' : '') + '</small></span><b>' + x.n + ' งาน</b></div>'; }).join('') + '</div>' : '')
      + (r.lowParts.length ? '<div class="panel pbox"><h4>' + icon('part', 18) + ' อะไหล่ใกล้หมด</h4>' + r.lowParts.map(function (p) { return '<div class="li"><span>' + esc(p.name) + '<small>จุดสั่งซื้อ ' + nf(p.minStock) + ' ' + esc(p.unit) + '</small></span><b class="neg">' + nf(p.balance) + ' ' + esc(p.unit) + '</b></div>'; }).join('') + '</div>' : '')
      + '</div>';
  };

  // ==================== ใบแจ้งซ่อม ====================
  function repPage() {
    var q = H.q, all = H.data.repairs, bl = list(S_().buildings);
    q.rst = q.rst || 'open';
    var match = function (r, st) { return st === 'all' || (st === 'open' ? r.open : st === 'new' ? r.status === 'new' : st === 'done' ? r.status === 'done' : st === 'closed' ? r.status === 'closed' || r.status === 'cancel' : true); };
    var s = String(q.rs || '').toLowerCase();
    var rows = all.filter(function (r) { return match(r, q.rst) && (!q.rb || r.building === q.rb) && (!s || [r.code, r.machineName, r.location, r.problem, r.reporter, r.assignee, r.category].join(' ').toLowerCase().indexOf(s) >= 0); })
      .sort(function (a, b) { var u = { urgent: 0, high: 1, normal: 2, low: 3 }; return q.rst === 'open' ? (u[a.urgency] - u[b.urgency]) || String(a.reportAt).localeCompare(String(b.reportAt)) : String(b.reportAt).localeCompare(String(a.reportAt)); });
    var chips = [['open', 'ยังไม่เสร็จ'], ['new', 'รอรับงาน'], ['done', 'รอตรวจรับ'], ['closed', 'ปิด / ยกเลิก'], ['all', 'ทั้งหมด']];
    $('main').innerHTML = '<h3>ใบแจ้งซ่อม</h3>'
      + '<div class="mttool"><button class="btn btn-primary" id="rAdd">' + icon('plus', 18) + ' เปิดใบแจ้งซ่อม</button></div>'
      + '<div class="pchips mtchips">' + chips.map(function (c) { return '<button class="chip' + (q.rst === c[0] ? ' on' : '') + '" data-rst="' + c[0] + '">' + c[1] + ' (' + all.filter(function (r) { return match(r, c[0]); }).length + ')</button>'; }).join('') + '</div>'
      + '<div class="pbar mtbar"><div class="psearch">' + icon('search', 18) + '<input id="rS" type="search" placeholder="ค้นหา เลขที่ / เครื่อง / อาการ / ผู้แจ้ง / ช่าง" value="' + esc(q.rs || '') + '"></div>'
      + '<select id="rB" aria-label="อาคาร"><option value="">ทุกอาคาร</option>' + bl.map(function (b) { return '<option' + (q.rb === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') + '</select></div>'
      + '<div class="mtcards">' + (rows.map(function (r) {
        var ph = r.photos[0] || r.afterPhotos[0];
        return '<button class="mtcard" data-r="' + esc(r.id) + '" style="--s:' + (r.open ? URGC[r.urgency] : STC[r.status]) + '">' + (ph ? '<img src="' + esc(ph.url) + '=w240" alt="" loading="lazy">' : '<span class="mtnoimg">' + icon('wrench', 26) + '</span>')
          + '<span class="mtci"><span class="mtch"><span class="mtcode">' + esc(r.code) + '</span>' + stTag(r.status) + '</span><b>' + esc(r.machineName || r.location || '-') + '</b>'
          + '<small class="mtprob">' + esc(r.problem) + '</small><small>' + esc([r.building, r.category].filter(String).join(' · ')) + '</small>'
          + '<span class="mtcm">' + urgTag(r) + '<small>👤 ' + esc(r.reporter || '-') + ' · ' + (r.open ? ageTxt(r.reportAt) : dd(r.reportDate)) + '</small>' + (r.assignee ? '<small>👷 ' + esc(r.assignee) + '</small>' : '') + '</span></span></button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ' + (all.length ? '' : ' — ใบแจ้งซ่อมจาก LINE / QR จะขึ้นที่นี่ หรือกด "เปิดใบแจ้งซ่อม"') + '</div>') + '</div>';
    on('[data-rst]', 'click', function (el) { q.rst = el.getAttribute('data-rst'); repPage(); }, $('main'));
    $('rS').addEventListener('input', function () { q.rs = this.value; clearTimeout(H.t); H.t = setTimeout(function () { repPage(); var e = $('rS'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('rB').addEventListener('change', function () { q.rb = this.value; repPage(); });
    $('rAdd').addEventListener('click', function () { repForm(null); });
    on('[data-r]', 'click', function (el) { openRepair(el.getAttribute('data-r')); }, $('main'));
  }
  function openRepair(id) {
    var r = H.data.repairs.filter(function (x) { return x.id === id; })[0];
    if (!r) return toast('ไม่พบใบแจ้งซ่อม (อาจถูกลบไปแล้ว)');
    if (state.page !== 'mt_rep') { state.page = 'mt_rep'; renderNav(); repPage(); }
    repForm(r);
  }
  // ฟอร์มเดียว: เปิดใหม่ / ดู + แก้ทุกช่อง (สถานะ ช่าง สาเหตุ วิธีแก้ อะไหล่ ค่าใช้จ่าย รูป)
  function repForm(r) {
    var d = H.data, s = S_(), isNew = !r, x = r || { status: 'new', urgency: 'normal', photos: [], afterPhotos: [], partsUsed: [], timeline: [] };
    var parts = d.parts.filter(function (p) { return p.active !== 'off' || x.partsUsed.some(function (u) { return u.partId === p.id; }); });
    var U = { parts: x.partsUsed.map(function (p) { return Object.assign({}, p); }) };
    var opt = function (arr, cur, ph) { return '<option value="">' + (ph || '— เลือก —') + '</option>' + arr.concat(cur && arr.indexOf(cur) < 0 ? [cur] : []).map(function (v) { return '<option' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); };
    var F = function (id, label, html, full) { return '<div class="pf' + (full ? ' full' : '') + '"><label for="' + id + '">' + label + '</label>' + html + '</div>'; };
    var inp = function (id, v, attrs) { return '<input id="' + id + '" value="' + esc(v == null ? '' : v) + '"' + (attrs || '') + '>'; };
    var ta = function (id, v, ph) { return '<textarea id="' + id + '" rows="2" placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea>'; };
    var gal = function (slot) { return '<div class="mtgal" id="g_' + slot + '">' + (x[slot] || []).map(function (f) { return '<span><a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(f.url) + '=w200" alt="" loading="lazy"></a><button type="button" class="mtx" data-delph="' + slot + '|' + esc(f.id) + '" aria-label="ลบรูป">✕</button></span>'; }).join('')
      + (isNew ? '<small class="muted">บันทึกใบก่อน แล้วค่อยเพิ่มรูป</small>' : '<button type="button" class="mtaddph" data-addph="' + slot + '">' + icon('camera', 20) + '<span>เพิ่มรูป</span></button>') + '</div>'; };
    var partRows = function () {
      return U.parts.map(function (u, i) {
        var stock = u.partId || u.stock;
        return '<div class="mtpr" data-i="' + i + '">' + (stock ? '<select data-k="partId" aria-label="อะไหล่"><option value="">— อะไหล่ในสต๊อก —</option>' + parts.map(function (p) { return '<option value="' + esc(p.id) + '"' + (u.partId === p.id ? ' selected' : '') + '>' + esc(p.name) + ' (เหลือ ' + nf(p.balance) + ' ' + esc(p.unit) + ')</option>'; }).join('') + '</select>'
          : '<input data-k="name" placeholder="ชื่ออะไหล่ / วัสดุที่ซื้อมาใช้" value="' + esc(u.name) + '">')
          + '<input data-k="qty" inputmode="decimal" placeholder="จำนวน" value="' + esc(u.qty) + '" aria-label="จำนวน"><input data-k="price" inputmode="decimal" placeholder="ราคา/หน่วย" value="' + esc(u.price) + '" aria-label="ราคาต่อหน่วย">'
          + '<b>' + nf((Number(u.qty) || 0) * (Number(u.price) || 0)) + '</b><button type="button" class="mtrm" data-rmp="' + i + '" aria-label="ลบรายการ">✕</button></div>';
      }).join('') || '<div class="muted" style="padding:6px 0">ยังไม่มี</div>';
    };
    var body = '<div class="pform">'
      + (isNew ? '' : '<div class="pf full mthead">' + stTag(x.status) + ' ' + urgTag(x) + '<small>แจ้งเมื่อ ' + dt(x.reportAt) + ' · ช่องทาง ' + (SRC[x.source] || x.source || '-') + (x.lineName ? ' · LINE: ' + esc(x.lineName) : '') + '</small></div>')
      + F('rMac', 'เครื่องจักร / อุปกรณ์', '<input id="rMac" list="rMacL" value="' + esc(x.machineName || '') + '" placeholder="พิมพ์ / เลือกจากทะเบียน"><datalist id="rMacL">' + d.machines.filter(function (m) { return m.status !== 'retired'; }).map(function (m) { return '<option value="' + esc(m.name) + '">' + esc([m.code, m.building].filter(String).join(' · ')) + '</option>'; }).join('') + '</datalist>')
      + F('rLoc', 'จุด / ตำแหน่ง', inp('rLoc', x.location))
      + F('rBld', 'อาคาร', '<select id="rBld">' + opt(list(s.buildings), x.building) + '</select>')
      + F('rCat', 'ประเภทงาน', '<select id="rCat">' + opt(list(s.categories), x.category) + '</select>')
      + F('rProb', 'อาการ / ปัญหา *', ta('rProb', x.problem, 'เช่น มอเตอร์ไม่หมุน มีกลิ่นไหม้'), true)
      + F('rUrg', 'ความเร่งด่วน', '<select id="rUrg">' + Object.keys(URG).map(function (k) { return '<option value="' + k + '"' + (x.urgency === k ? ' selected' : '') + '>' + URG[k] + '</option>'; }).join('') + '</select>')
      + '<div class="pf"><label>&nbsp;</label><label class="mtcheck"><input type="checkbox" id="rStop"' + (x.stopLine ? ' checked' : '') + '> ⛔ เครื่องหยุด / กระทบการผลิต</label></div>'
      + F('rRep', 'ผู้แจ้ง', inp('rRep', x.reporter)) + F('rDept', 'ฝ่าย / แผนกผู้แจ้ง', '<input id="rDept" list="rDeptL" value="' + esc(x.reporterDept || '') + '"><datalist id="rDeptL">' + list(s.depts).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>')
      + (isNew ? F('rAt', 'วันเวลาที่แจ้ง', '<input id="rAt" type="datetime-local" value="' + d.today + 'T' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + '">') : '')
      + '<div class="pf full mtsec">การซ่อม</div>'
      + F('rSt', 'สถานะ', '<select id="rSt">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (x.status === k ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join('') + '</select>')
      + F('rWait', 'เหตุผลที่รอ / รออะไร', '<input id="rWait" list="rWaitL" value="' + esc(x.waitReason || '') + '" placeholder="เช่น รออะไหล่ลูกปืน"><datalist id="rWaitL"><option value="รออะไหล่"><option value="รอช่างภายนอก"><option value="รอหยุดเครื่อง / ไลน์ว่าง"><option value="รออนุมัติซื้อ"></datalist>')
      + F('rAs', 'ช่างผู้รับผิดชอบ', '<input id="rAs" list="rAsL" value="' + esc(x.assignee || '') + '"><datalist id="rAsL">' + list(s.techs).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>')
      + F('rCause', 'สาเหตุ', ta('rCause', x.cause)) + F('rFix', 'วิธีแก้ไข', ta('rFix', x.fix))
      + F('rDown', 'เวลาหยุดเครื่อง (นาที)', inp('rDown', x.downtimeMin, ' inputmode="numeric" placeholder="' + (x.stopLine ? 'ไม่ใส่ = นับจากแจ้งถึงซ่อมเสร็จ' : '') + '"'))
      + F('rOut', 'ค่าจ้างภายนอก (บาท)', inp('rOut', x.outsideCost, ' inputmode="decimal"'))
      + F('rVen', 'ร้าน / ผู้รับเหมา', inp('rVen', x.outsideVendor))
      + '<div class="pf full"><label>อะไหล่ / วัสดุที่ใช้ <small class="muted">อะไหล่ในสต๊อกจะถูกตัดยอดอัตโนมัติ</small></label><div class="mtprh"><span>รายการ</span><span>จำนวน</span><span>ราคา/หน่วย</span><span>รวม</span><span></span></div><div id="rParts">' + partRows() + '</div>'
      + '<div class="mtrow2"><button type="button" class="btn btn-sm btn-line" id="pAdd">+ อะไหล่ในสต๊อก</button><button type="button" class="btn btn-sm btn-line" id="pOther">+ ซื้อมาใช้เลย</button></div><div class="mtsum" id="rSum"></div></div>'
      + (isNew ? '' : '<div class="pf full mtsec">ตรวจรับ</div>'
        + F('rCf', 'ผลตรวจรับ', '<select id="rCf"><option value="">ยังไม่ตรวจรับ</option><option value="ok"' + (x.confirm === 'ok' ? ' selected' : '') + '>✓ ใช้งานได้</option><option value="no"' + (x.confirm === 'no' ? ' selected' : '') + '>✕ ยังไม่หาย</option></select>')
        + F('rCfBy', 'ผู้ตรวจรับ', inp('rCfBy', x.confirmBy)) + F('rCfN', 'หมายเหตุตรวจรับ', inp('rCfN', x.confirmNote), true))
      + F('rNote', 'หมายเหตุ', ta('rNote', x.note), true)
      + (isNew ? '' : '<div class="pf full"><label class="mtcheck"><input type="checkbox" id="rNotify" checked> 📤 ส่งอัปเดตเข้ากลุ่ม LINE ช่าง (เมื่อเปลี่ยนสถานะ)</label></div>')
      + (isNew ? '' : '<div class="pf full"><label>รูปก่อนซ่อม</label>' + gal('photos') + '</div><div class="pf full"><label>รูปหลังซ่อม</label>' + gal('afterPhotos') + '</div>'
        + (x.timeline.length ? '<div class="pf full"><label>ประวัติงาน</label><div class="mttl">' + x.timeline.slice().reverse().map(function (t) { return '<div>' + esc(t.t) + ' <small>· ' + dt(t.at) + (t.by ? ' · ' + esc(t.by) : '') + '</small></div>'; }).join('') + '</div></div>' : ''))
      + '</div>';
    wide({ title: isNew ? 'เปิดใบแจ้งซ่อม' : x.code + ' · ' + (x.machineName || x.location || ''), icon: 'wrench', body: body, ok: 'บันทึก', sticky: true,
      foot: isNew ? '' : '<div class="mtfoot"><button type="button" class="btn btn-sm btn-line" id="rLine">' + icon('chat', 16) + ' ส่งการ์ดเข้ากลุ่ม LINE อีกครั้ง</button><button type="button" class="btn btn-sm btn-line mtdel" id="rDel">' + icon('trash', 16) + ' ลบใบนี้</button></div>',
      onOpen: function () {
        var sum = function () { var p = U.parts.reduce(function (t, u) { return t + (Number(u.qty) || 0) * (Number(u.price) || 0); }, 0), o = Number($('rOut').value) || 0; $('rSum').innerHTML = p || o ? 'ค่าอะไหล่ <b>' + nf(p) + '</b> + ภายนอก <b>' + nf(o) + '</b> = รวม <b>' + nf(p + o) + ' บาท</b>' : ''; };
        var draw = function () {
          $('rParts').innerHTML = partRows(); sum();
          on('#rParts [data-k]', 'change', function (el) {
            var u = U.parts[+el.closest('.mtpr').getAttribute('data-i')], k = el.getAttribute('data-k');
            if (k === 'partId') { var p = parts.filter(function (y) { return y.id === el.value; })[0]; u.partId = el.value; u.name = p ? p.name : ''; u.unit = p ? p.unit : ''; if (p && p.price !== '') u.price = p.price; u.stock = 1; }
            else u[k] = el.value;
            draw();
          });
          on('[data-rmp]', 'click', function (b) { U.parts.splice(+b.getAttribute('data-rmp'), 1); draw(); });
        };
        draw();
        // ช่องที่ต้องกรอกตามสถานะ = สีส้ม (ผู้ใช้ขอ 28/11/69)
        var NEED = { accepted: ['rAs'], doing: ['rAs'], wait: ['rAs', 'rWait'], done: ['rAs', 'rCause', 'rFix'] };
        var need = function () {
          var st = $('rSt').value, req = NEED[st] || [];
          ['rAs', 'rWait', 'rCause', 'rFix'].forEach(function (id) { var pf = $(id).closest('.pf'), on = req.indexOf(id) >= 0; pf.classList.toggle('mtmust', on && !$(id).value.trim()); pf.classList.toggle('mtreq', on); });
          $('rWait').closest('.pf').style.display = st === 'wait' || $('rWait').value ? '' : 'none';
        };
        ['rSt', 'rAs', 'rWait', 'rCause', 'rFix'].forEach(function (id) { $(id).addEventListener(id === 'rSt' ? 'change' : 'input', need); });
        need();
        $('rOut').addEventListener('input', sum);
        $('pAdd').addEventListener('click', function () { U.parts.push({ partId: '', name: '', qty: 1, price: '', stock: 1 }); draw(); });
        $('pOther').addEventListener('click', function () { U.parts.push({ partId: '', name: '', qty: 1, price: '' }); draw(); });
        $('rMac').addEventListener('change', function () { var m = d.machines.filter(function (y) { return y.name === $('rMac').value; })[0]; if (m) { if (!$('rBld').value && m.building) { var o = $('rBld'); if (![].some.call(o.options, function (z) { return z.value === m.building; })) o.add(new Option(m.building, m.building)); o.value = m.building; } if (!$('rLoc').value) $('rLoc').value = m.location || ''; } });
        $('rUrg').addEventListener('change', function () { if (this.value === 'urgent') $('rStop').checked = true; });
        // รูป: อัปโหลด / ลบทันที แล้ววาดเฉพาะกล่องรูปใหม่ (ช่องอื่นที่พิมพ์ค้างไว้ไม่หาย)
        var bindGal = function (slot) {
          var box = $('g_' + slot); if (!box) return;
          on('[data-addph]', 'click', function (b) {
            pickFiles(false, function (files) {
              var i = 0; b.disabled = true; b.querySelector('span').textContent = 'กำลังอัปโหลด…';
              var next = function () {
                if (i >= files.length) { var cur = H.data.repairs.filter(function (y) { return y.id === x.id; })[0]; if (cur) cur[slot] = x[slot]; box.outerHTML = gal(slot); bindGal(slot); toast('เพิ่มรูปแล้ว'); return; }
                var f = files[i++];
                shrink(f, 1600).then(function (b64) { return call('mntUploadPhoto', state.token, x.id, slot, f.name || 'photo.jpg', 'image/jpeg', b64); })
                  .then(function (res) { if (!res.ok) throw new Error(res.error); x[slot] = res.files; next(); }).catch(function (e) { toast(e.message); box.outerHTML = gal(slot); bindGal(slot); });
              };
              next();
            });
          }, box);
          on('[data-delph]', 'click', function (b) {
            var p = b.getAttribute('data-delph').split('|');
            ask({ title: 'ลบรูปนี้?', tone: 'danger' }).then(function (ok) { if (!ok) return; b.disabled = true;
              call('mntRemovePhoto', state.token, x.id, p[0], p[1]).then(function (res) { if (!res.ok) return toast(res.error); x[p[0]] = res.files; var cur = H.data.repairs.filter(function (y) { return y.id === x.id; })[0]; if (cur) cur[p[0]] = res.files; b.closest('span').remove(); toast('ลบรูปแล้ว'); }).catch(onServerError); });
          }, box);
        };
        bindGal('photos'); bindGal('afterPhotos');
        if ($('rLine')) $('rLine').addEventListener('click', function () { var b = this; b.disabled = true; call('mntResendLine', state.token, x.id).then(function (res) { b.disabled = false; toast(res.ok ? 'ส่งเข้ากลุ่ม LINE แล้ว' : res.error); }).catch(function (e) { b.disabled = false; onServerError(e); }); });
        if ($('rDel')) $('rDel').addEventListener('click', function () {
          ask({ title: 'ลบใบแจ้งซ่อม ' + x.code + '?', text: 'รูปและรายการเบิกอะไหล่ของใบนี้จะถูกลบด้วย (ยอดอะไหล่คืนสต๊อก) · ถ้าไม่ได้ซ่อม แนะนำเปลี่ยนสถานะเป็น "ยกเลิก" แทน', tone: 'danger' }).then(function (ok) {
            if (!ok) return;
            call('mntDeleteRepair', state.token, x.id).then(function (res) { if (!res.ok) return toast(res.error); closeModal(); reload('ลบแล้ว'); }).catch(onServerError);
          });
        });
      },
      check: function () {
        if (!$('rProb').value.trim()) return 'ใส่อาการ / ปัญหา';
        if (!$('rMac').value.trim() && !$('rLoc').value.trim()) return 'ใส่เครื่องจักร / อุปกรณ์ หรือจุดที่เสีย';
        if ($('rSt').value === 'wait' && !$('rWait').value.trim()) return 'ใส่เหตุผลที่ต้องรอ (รออะไร)';
        if ($('rSt').value === 'done' && !$('rCause').value.trim()) return 'ใส่สาเหตุ ก่อนบันทึกว่าซ่อมเสร็จ';
        if ($('rSt').value === 'done' && !$('rFix').value.trim()) return 'ใส่วิธีแก้ไข ก่อนบันทึกว่าซ่อมเสร็จ';
        if (U.parts.some(function (u) { return (u.partId || String(u.name || '').trim()) && !(Number(u.qty) > 0); })) return 'ใส่จำนวนอะไหล่ที่ใช้';
        return '';
      },
      submit: function () {
        var m = d.machines.filter(function (y) { return y.name === $('rMac').value.trim(); })[0];
        var o = { id: x.id || '', machineId: m ? m.id : (x.machineName === $('rMac').value.trim() ? x.machineId : ''), machineName: $('rMac').value, location: $('rLoc').value, building: $('rBld').value, category: $('rCat').value,
          problem: $('rProb').value, urgency: $('rUrg').value, stopLine: $('rStop').checked ? 'yes' : '', reporter: $('rRep').value, reporterDept: $('rDept').value,
          status: $('rSt').value, assignee: $('rAs').value, cause: $('rCause').value, fix: $('rFix').value, downtimeMin: $('rDown').value, outsideCost: $('rOut').value, outsideVendor: $('rVen').value, note: $('rNote').value, waitReason: $('rWait').value, notify: !!($('rNotify') && $('rNotify').checked),
          partsUsed: U.parts.filter(function (u) { return u.partId || String(u.name || '').trim(); }), by: state.dept.name };
        if (isNew) o.reportAt = $('rAt').value;
        else { o.confirm = $('rCf').value; o.confirmBy = $('rCfBy').value; o.confirmNote = $('rCfN').value; }
        return call('mntSaveRepair', state.token, o).then(function (res) {
          if (!res.ok) return res.error;
          upsert(H.data.repairs, res.repair); closeModal();
          toast((isNew ? 'เปิดใบ ' + res.repair.code + ' แล้ว — เพิ่มรูปได้เลย' : 'บันทึกแล้ว') + (res.line ? ' · ' + res.line : ''));
          if (state.page === 'mt_rep') repPage();
          if (isNew) repForm(res.repair);   // เปิดใบเดิมต่อทันที (ไม่ต้องรอโหลดใหม่) ให้เพิ่มรูปได้
          quietRefresh();
        });
      } });
  }
  // ==================== ทะเบียนเครื่องจักร ====================
  function macPage() {
    var q = H.q, d = H.data, s = String(q.ms || '').toLowerCase();
    if (q.macId) { var cur = machineOf(q.macId); if (cur) return macDetail(cur); q.macId = ''; }
    var openBy = {}; d.repairs.forEach(function (r) { if (r.open && r.machineId) openBy[r.machineId] = (openBy[r.machineId] || 0) + 1; });
    var pmBy = {}; d.pm.forEach(function (p) { if (p.active === 'on' && p.machineId && (!pmBy[p.machineId] || p.nextDate < pmBy[p.machineId].nextDate)) pmBy[p.machineId] = p; });
    var rows = d.machines.filter(function (m) { return (q.mret || m.status !== 'retired') && (!s || [m.code, m.name, m.type, m.building, m.location, m.brand, m.model, m.serial].join(' ').toLowerCase().indexOf(s) >= 0); });
    var groups = {}; rows.forEach(function (m) { var k = m.building || 'ไม่ระบุอาคาร'; (groups[k] = groups[k] || []).push(m); });
    $('main').innerHTML = '<h3>ทะเบียนเครื่องจักร</h3>'
      + '<div class="mttool"><button class="btn btn-primary" id="mAdd">' + icon('plus', 18) + ' เพิ่มเครื่องจักร / อุปกรณ์</button></div>'
      + '<div class="pbar mtbar r1"><div class="psearch">' + icon('search', 18) + '<input id="mS" type="search" placeholder="ค้นหา รหัส / ชื่อ / ยี่ห้อ / จุดติดตั้ง" value="' + esc(q.ms || '') + '"></div><label class="mtcheck"><input type="checkbox" id="mRet"' + (q.mret ? ' checked' : '') + '> แสดงเครื่องที่เลิกใช้</label></div>'
      + (Object.keys(groups).sort().map(function (g) {
        return '<h4 class="mtgh">' + esc(g) + ' <small>' + groups[g].length + ' เครื่อง</small></h4><div class="mtcards">' + groups[g].sort(function (a, b) { return String(a.code || a.name).localeCompare(String(b.code || b.name), 'th'); }).map(function (m) {
          var o = openBy[m.id], p = pmBy[m.id], late = p && p.overdue;
          return '<button class="mtcard mtmc' + (m.status === 'retired' ? ' off' : '') + '" data-m="' + esc(m.id) + '" style="--s:' + (o ? '#dc2626' : '#475569') + '">' + (m.photo ? '<img src="' + esc(m.photo) + '=w240" alt="" loading="lazy">' : '<span class="mtnoimg">' + icon('machine', 26) + '</span>')
            + '<span class="mtci"><span class="mtch"><span class="mtcode">' + esc(m.code || '—') + '</span>' + (o ? '<span class="mtst" style="--s:#dc2626">🔧 ซ่อมค้าง ' + o + '</span>' : m.status !== 'active' ? '<span class="mtst" style="--s:#94a3b8">' + MST[m.status] + '</span>' : '') + '</span>'
            + '<b>' + esc(m.name) + '</b><small>' + esc([m.type, m.location].filter(String).join(' · ')) + '</small>'
            + (p ? '<small class="' + (late ? 'neg' : '') + '">🛠 PM ' + esc(p.title) + ' · ' + (late ? 'เลยกำหนด ' : '') + dd(p.nextDate) + '</small>' : '<small class="muted">ยังไม่มีแผน PM</small>') + '</span></button>';
        }).join('') + '</div>';
      }).join('') || '<div class="panel muted">ยังไม่มีเครื่องจักร — กด "เพิ่มเครื่องจักร / อุปกรณ์" (ใส่แล้วพนักงานเลือกเครื่องตอนแจ้งซ่อมได้)</div>');
    $('mS').addEventListener('input', function () { q.ms = this.value; clearTimeout(H.t); H.t = setTimeout(function () { macPage(); var e = $('mS'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('mRet').addEventListener('change', function () { q.mret = this.checked; macPage(); });
    $('mAdd').addEventListener('click', function () { macForm(null); });
    on('[data-m]', 'click', function (el) { q.macId = el.getAttribute('data-m'); window.scrollTo(0, 0); macPage(); }, $('main'));
  }
  function macDetail(m) {
    var d = H.data, reps = d.repairs.filter(function (r) { return r.machineId === m.id; }).sort(function (a, b) { return String(b.reportAt).localeCompare(String(a.reportAt)); });
    var pms = d.pm.filter(function (p) { return p.machineId === m.id; }), logs = d.pmlog.filter(function (l) { return l.machineId === m.id; }).slice().reverse();
    var cost = reps.reduce(function (t, r) { return t + (Number(r.totalCost) || 0); }, 0) + logs.reduce(function (t, l) { return t + (Number(l.pmCost) || 0); }, 0), down = reps.reduce(function (t, r) { return t + (r.downtime || 0); }, 0);
    var kv = function (k, v) { return v ? '<span>' + k + '</span><b>' + esc(v) + '</b>' : ''; };
    $('main').innerHTML = '<div class="mtdh noprint"><button class="btn btn-line btn-sm" id="mBack">' + icon('back', 16) + ' เครื่องจักรทั้งหมด</button></div>'
      + '<div class="panel pbox mtmd">' + (m.photo ? '<a href="' + esc(m.photo) + '" target="_blank" rel="noopener"><img src="' + esc(m.photo) + '=w600" alt=""></a>' : '<span class="mtnoimg big">' + icon('machine', 40) + '</span>')
      + '<div><span class="mtcode">' + esc(m.code || '—') + '</span><h3 style="margin:2px 0 8px">' + esc(m.name) + '</h3>'
      + '<div class="mtkv">' + kv('ประเภท', m.type) + kv('อาคาร', m.building) + kv('จุดติดตั้ง', m.location) + kv('ยี่ห้อ / รุ่น', [m.brand, m.model].filter(String).join(' ')) + kv('หมายเลขเครื่อง', m.serial)
      + kv('ติดตั้ง', m.installDate && dd(m.installDate)) + kv('ประกันถึง', m.warrantyEnd && dd(m.warrantyEnd) + (m.warrantyEnd < d.today ? ' (หมดแล้ว)' : '')) + kv('ผู้ขาย / ผู้ดูแล', m.vendor) + kv('สถานะ', MST[m.status]) + kv('หมายเหตุ', m.note) + '</div>'
      + '<div class="mtrow2" style="margin-top:10px"><button class="btn btn-line btn-sm" id="mEdit">' + icon('edit', 16) + ' แก้ไขข้อมูล</button><button class="btn btn-line btn-sm" id="mPh">' + icon('camera', 16) + ' ' + (m.photo ? 'เปลี่ยนรูป' : 'ใส่รูปเครื่อง') + '</button><button class="btn btn-primary btn-sm" id="mRep">' + icon('wrench', 16) + ' เปิดใบแจ้งซ่อมเครื่องนี้</button></div></div></div>'
      + '<div class="kpis mtk3"><div class="kpi" style="--k:#ea580c"><b>' + reps.length + '</b><span>แจ้งซ่อมทั้งหมด</span><small>ค้างอยู่ ' + reps.filter(function (r) { return r.open; }).length + '</small></div>'
      + '<div class="kpi" style="--k:#dc2626"><b>' + hm(down) + '</b><span>เวลาเครื่องหยุดรวม</span></div><div class="kpi" style="--k:#7c3aed"><b>' + baht(cost) + '</b><span>ค่าซ่อม + PM รวม</span></div></div>'
      + '<div class="pgrid"><div class="panel pbox"><h4>' + icon('calcheck', 18) + ' แผน PM ของเครื่องนี้</h4>' + (pms.map(function (p) {
        return '<div class="li"><span>' + esc(p.title) + '<small>ทุก ' + p.everyN + ' ' + UNITS[p.everyUnit] + (p.lastDate ? ' · ทำล่าสุด ' + dd(p.lastDate) : '') + (p.active === 'off' ? ' · ปิดใช้' : '') + '</small></span><b class="' + (p.overdue ? 'neg' : '') + '">' + dd(p.nextDate) + '</b></div>';
      }).join('') || '<div class="muted">ยังไม่มี</div>') + '<button class="btn btn-line btn-sm" id="mPm" style="margin-top:10px">' + icon('plus', 16) + ' เพิ่มแผน PM</button>'
      + (logs.length ? '<div class="xsub2">ประวัติ PM</div>' + logs.slice(0, 10).map(function (l) { return '<div class="li"><span>' + esc(l.title) + '<small>' + esc(l.by) + (l.note ? ' · ' + esc(l.note) : '') + '</small></span><b class="' + (l.result === 'issue' ? 'neg' : 'pos') + '">' + dd(l.date) + '<small>' + (l.result === 'issue' ? 'พบปัญหา' : 'ปกติ') + '</small></b></div>'; }).join('') : '') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('wrench', 18) + ' ประวัติการซ่อม</h4>' + (reps.map(function (r) {
        return '<div class="li tap" data-rep="' + esc(r.id) + '" role="button" tabindex="0"><span>' + esc(r.problem).slice(0, 120) + '<small>' + esc(r.code) + ' · ' + dd(r.reportDate) + (r.assignee ? ' · 👷 ' + esc(r.assignee) : '') + (r.fix ? ' · แก้: ' + esc(r.fix).slice(0, 80) : '') + '</small></span><b>' + stTag(r.status) + (r.totalCost ? '<small>' + baht(r.totalCost) + '</small>' : '') + '</b></div>';
      }).join('') || '<div class="muted">ยังไม่เคยแจ้งซ่อม</div>') + '</div></div>';
    $('mBack').addEventListener('click', function () { H.q.macId = ''; macPage(); });
    $('mEdit').addEventListener('click', function () { macForm(m); });
    $('mPh').addEventListener('click', function () {
      var b = this; pickFiles(false, function (files) { b.disabled = true; b.textContent = 'กำลังอัปโหลด…';
        shrink(files[0], 1280).then(function (b64) { return call('mntMachinePhoto', state.token, m.id, files[0].name || 'machine.jpg', 'image/jpeg', b64); })
          .then(function (res) { if (!res.ok) throw new Error(res.error); m.photo = res.photo; toast('ใส่รูปแล้ว'); macDetail(m); }).catch(function (e) { toast(e.message); macDetail(m); }); });
    });
    $('mRep').addEventListener('click', function () { repForm(null); setTimeout(function () { $('rMac').value = m.name; $('rLoc').value = m.location || ''; var o = $('rBld'); if (m.building) { if (![].some.call(o.options, function (z) { return z.value === m.building; })) o.add(new Option(m.building, m.building)); o.value = m.building; } $('rProb').focus(); }, 60); });
    $('mPm').addEventListener('click', function () { pmForm(null, m.id); });
    on('[data-rep]', 'click', function (el) { repForm(H.data.repairs.filter(function (r) { return r.id === el.getAttribute('data-rep'); })[0]); }, $('main'));
  }
  function macForm(m) {
    var s = S_(), x = m || { status: 'active' };
    var F = function (id, label, v, attrs, full) { return '<div class="pf' + (full ? ' full' : '') + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(v || '') + '"' + (attrs || '') + '></div>'; };
    var dl = function (id, arr) { return '<datalist id="' + id + '">' + arr.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; };
    wide({ title: m ? 'แก้ไข ' + m.name : 'เพิ่มเครื่องจักร / อุปกรณ์', icon: 'machine', ok: 'บันทึก',
      body: '<div class="pform">' + F('cName', 'ชื่อเครื่องจักร / อุปกรณ์ *', x.name, ' placeholder="เช่น เครื่องผัดอัตโนมัติ 200 ลิตร"', true) + F('cCode', 'รหัสเครื่อง', x.code, ' placeholder="เช่น G2-FRY-01"')
        + F('cType', 'ประเภท', x.type, ' list="cTypeL"') + dl('cTypeL', list(s.machineTypes)) + F('cBld', 'อาคาร', x.building, ' list="cBldL"') + dl('cBldL', list(s.buildings))
        + F('cLoc', 'จุดติดตั้ง', x.location) + F('cBrand', 'ยี่ห้อ', x.brand) + F('cModel', 'รุ่น', x.model) + F('cSer', 'หมายเลขเครื่อง (Serial)', x.serial)
        + F('cInst', 'วันที่ติดตั้ง', x.installDate, ' type="date"') + F('cWar', 'ประกันถึง', x.warrantyEnd, ' type="date"') + F('cVen', 'ผู้ขาย / ผู้ดูแล (เบอร์)', x.vendor)
        + '<div class="pf"><label for="cSt">สถานะ</label><select id="cSt">' + Object.keys(MST).map(function (k) { return '<option value="' + k + '"' + (x.status === k ? ' selected' : '') + '>' + MST[k] + '</option>'; }).join('') + '</select></div>'
        + '<div class="pf full"><label for="cNote">หมายเหตุ</label><textarea id="cNote" rows="2">' + esc(x.note || '') + '</textarea></div></div>',
      foot: m ? '<div class="mtfoot"><button type="button" class="btn btn-sm btn-line mtdel" id="cDel">' + icon('trash', 16) + ' ลบเครื่องนี้</button></div>' : '',
      onOpen: function () { if ($('cDel')) $('cDel').addEventListener('click', function () { ask({ title: 'ลบ ' + m.name + '?', text: 'ลบได้เฉพาะเครื่องที่ยังไม่มีประวัติซ่อม / แผน PM', tone: 'danger' }).then(function (ok) { if (!ok) return; call('mntDeleteMachine', state.token, m.id).then(function (r) { if (!r.ok) return toast(r.error); closeModal(); H.q.macId = ''; reload('ลบแล้ว'); }).catch(onServerError); }); }); },
      check: function () { return $('cName').value.trim() ? '' : 'ใส่ชื่อเครื่องจักร / อุปกรณ์'; },
      submit: function () {
        return call('mntSaveMachine', state.token, { id: x.id || '', name: $('cName').value, code: $('cCode').value, type: $('cType').value, building: $('cBld').value, location: $('cLoc').value, brand: $('cBrand').value, model: $('cModel').value,
          serial: $('cSer').value, installDate: $('cInst').value, warrantyEnd: $('cWar').value, vendor: $('cVen').value, status: $('cSt').value, note: $('cNote').value }).then(function (r) {
          if (!r.ok) return r.error; closeModal(); H.q.macId = r.machine.id; reload(m ? 'บันทึกแล้ว' : 'เพิ่มเครื่องแล้ว — ใส่รูป / แผน PM ต่อได้เลย');
        });
      } });
  }

  // ==================== แผน PM ====================
  function pmPage() {
    var q = H.q, d = H.data, t = d.today; q.pst = q.pst || 'due';
    var d30 = addDays(t, 30);
    var match = function (p, st) { return st === 'all' ? true : st === 'off' ? p.active === 'off' : p.active === 'on' && (st === 'due' ? p.nextDate <= addDays(t, 7) : st === 'm30' ? p.nextDate <= d30 : true); };
    var rows = d.pm.filter(function (p) { return match(p, q.pst); }).sort(function (a, b) { return String(a.nextDate).localeCompare(String(b.nextDate)); });
    var chips = [['due', 'เลยกำหนด / ภายใน 7 วัน'], ['m30', 'ภายใน 30 วัน'], ['on', 'ใช้งานทั้งหมด'], ['off', 'ปิดใช้'], ['all', 'ทั้งหมด']];
    $('main').innerHTML = '<h3>แผนบำรุงรักษา (PM)</h3>'
      + '<div class="mttool"><button class="btn btn-line" id="pSend">' + icon('chat', 18) + ' ส่งสรุป PM เข้ากลุ่ม LINE</button><button class="btn btn-primary" id="pAddPm">' + icon('plus', 18) + ' เพิ่มแผน PM</button></div>'
      + '<div class="pchips mtchips">' + chips.map(function (c) { return '<button class="chip' + (q.pst === c[0] ? ' on' : '') + '" data-pst="' + c[0] + '">' + c[1] + ' (' + d.pm.filter(function (p) { return match(p, c[0]); }).length + ')</button>'; }).join('') + '</div>'
      + '<div class="mtpml">' + (rows.map(function (p) {
        var n = p.nextDate ? days(t, p.nextDate) : null, last = d.pmlog.filter(function (l) { return l.pmId === p.id; }).slice(-1)[0];
        return '<div class="panel mtpm' + (p.overdue ? ' late' : n != null && n <= 7 ? ' soon' : '') + (p.active === 'off' ? ' off' : '') + '"><div class="mtpmh"><div><b>' + esc(p.title) + '</b><small>' + icon('machine', 14) + ' ' + esc(p.machineName || 'ไม่ผูกเครื่อง') + ' · ทุก ' + p.everyN + ' ' + UNITS[p.everyUnit] + (p.assignee ? ' · 👷 ' + esc(p.assignee) : '') + '</small></div>'
          + '<div class="mtdue"><b>' + dd(p.nextDate) + '</b><small>' + (p.active === 'off' ? 'ปิดใช้' : n < 0 ? 'เลยกำหนด ' + (-n) + ' วัน' : n === 0 ? 'ถึงกำหนดวันนี้' : 'อีก ' + n + ' วัน') + '</small></div></div>'
          + (p.tasks.length ? '<div class="mttasks">' + p.tasks.map(function (x) { return '<span>☐ ' + esc(x) + '</span>'; }).join('') + '</div>' : '')
          + '<div class="mtpmf"><small class="muted">' + (last ? 'ทำล่าสุด ' + dd(last.date) + ' โดย ' + esc(last.by) + (last.result === 'issue' ? ' · <b class="neg">พบปัญหา</b>' : ' · ปกติ') : 'ยังไม่เคยบันทึก') + '</small>'
          + '<span><button class="btn btn-line btn-sm" data-pmh="' + esc(p.id) + '">ประวัติ</button><button class="btn btn-line btn-sm" data-pme="' + esc(p.id) + '">' + icon('edit', 15) + ' แก้ไข</button>'
          + (p.active === 'on' ? '<button class="btn btn-primary btn-sm" data-pmd="' + esc(p.id) + '">' + icon('check', 15) + ' บันทึกว่าทำแล้ว</button>' : '') + '</span></div></div>';
      }).join('') || '<div class="panel muted">' + (d.pm.length ? 'ไม่มีงาน PM ในกลุ่มนี้ 🎉' : 'ยังไม่มีแผน PM — กด "เพิ่มแผน PM" เช่น "อัดจาระบีมอเตอร์ ทุก 1 เดือน"') + '</div>') + '</div>';
    on('[data-pst]', 'click', function (el) { q.pst = el.getAttribute('data-pst'); pmPage(); }, $('main'));
    $('pAddPm').addEventListener('click', function () { pmForm(null); });
    $('pSend').addEventListener('click', function () { var b = this; b.disabled = true; call('mntSendPmDue', state.token).then(function (r) { b.disabled = false; toast(r.ok ? 'ส่งสรุป PM เข้ากลุ่ม LINE แล้ว' : r.error); }).catch(function (e) { b.disabled = false; onServerError(e); }); });
    var pmOf = function (id) { return d.pm.filter(function (p) { return p.id === id; })[0]; };
    on('[data-pme]', 'click', function (el) { pmForm(pmOf(el.getAttribute('data-pme'))); }, $('main'));
    on('[data-pmd]', 'click', function (el) { pmDone(pmOf(el.getAttribute('data-pmd'))); }, $('main'));
    on('[data-pmh]', 'click', function (el) { pmHist(pmOf(el.getAttribute('data-pmh'))); }, $('main'));
  }
  function pmForm(p, machineId) {
    var d = H.data, x = p || { everyN: 1, everyUnit: 'month', active: 'on', startDate: d.today, machineId: machineId || '', tasks: [] };
    wide({ title: p ? 'แก้ไขแผน PM' : 'เพิ่มแผน PM', icon: 'calcheck', ok: 'บันทึก',
      body: '<div class="pform"><div class="pf full"><label for="pTitle">งาน PM *</label><input id="pTitle" value="' + esc(x.title || '') + '" placeholder="เช่น อัดจาระบี / เปลี่ยนน้ำมันเกียร์ / ล้างแผงคอยล์แอร์"></div>'
        + '<div class="pf full"><label for="pMac">เครื่องจักร / อุปกรณ์</label><select id="pMac"><option value="">— ไม่ผูกเครื่อง —</option>' + d.machines.filter(function (m) { return m.status !== 'retired' || m.id === x.machineId; }).map(function (m) { return '<option value="' + esc(m.id) + '"' + (x.machineId === m.id ? ' selected' : '') + '>' + esc([m.code, m.name, m.building].filter(String).join(' · ')) + '</option>'; }).join('') + '</select></div>'
        + '<div class="pf"><label for="pN">ทำทุก ๆ *</label><div class="mtrow2"><input id="pN" inputmode="numeric" value="' + esc(x.everyN) + '" style="max-width:90px"><select id="pU">' + Object.keys(UNITS).map(function (k) { return '<option value="' + k + '"' + (x.everyUnit === k ? ' selected' : '') + '>' + UNITS[k] + '</option>'; }).join('') + '</select></div></div>'
        + '<div class="pf"><label for="pStart">เริ่มรอบแรก</label><input id="pStart" type="date" value="' + esc(x.startDate || d.today) + '"></div>'
        + '<div class="pf"><label for="pNext">ครบกำหนดครั้งถัดไป <small class="muted">(ไม่ใส่ = คำนวณให้)</small></label><input id="pNext" type="date" value="' + esc(p ? x.nextDate : '') + '"></div>'
        + '<div class="pf"><label for="pAs">ผู้รับผิดชอบ</label><input id="pAs" list="pAsL" value="' + esc(x.assignee || '') + '"><datalist id="pAsL">' + list(S_().techs).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist></div>'
        + '<div class="pf full"><label for="pTasks">รายการตรวจ / บำรุง (บรรทัดละ 1 ข้อ — ใช้เป็นเช็กลิสต์ตอนบันทึก)</label><textarea id="pTasks" rows="4" placeholder="ตรวจเสียงผิดปกติ&#10;อัดจาระบีลูกปืน&#10;ตรวจสายพาน">' + esc((x.tasks || []).join('\n')) + '</textarea></div>'
        + '<div class="pf"><label for="pAct">สถานะ</label><select id="pAct"><option value="on">ใช้งาน</option><option value="off"' + (x.active === 'off' ? ' selected' : '') + '>ปิดใช้ (หยุดชั่วคราว)</option></select></div>'
        + '<div class="pf full"><label for="pNote">หมายเหตุ</label><textarea id="pNote" rows="2">' + esc(x.note || '') + '</textarea></div></div>',
      foot: p ? '<div class="mtfoot"><button type="button" class="btn btn-sm btn-line mtdel" id="pDel">' + icon('trash', 16) + ' ลบแผนนี้</button></div>' : '',
      onOpen: function () { if ($('pDel')) $('pDel').addEventListener('click', function () { ask({ title: 'ลบแผน PM "' + p.title + '"?', text: 'ประวัติที่เคยทำยังเก็บไว้', tone: 'danger' }).then(function (ok) { if (!ok) return; call('mntDeletePm', state.token, p.id).then(function (r) { if (!r.ok) return toast(r.error); closeModal(); reload('ลบแล้ว'); }).catch(onServerError); }); }); },
      check: function () { if (!$('pTitle').value.trim()) return 'ใส่ชื่องาน PM'; if (!(Number($('pN').value) >= 1)) return 'ใส่รอบการทำ (ตัวเลข 1 ขึ้นไป)'; return ''; },
      submit: function () {
        return call('mntSavePm', state.token, { id: x.id || '', title: $('pTitle').value, machineId: $('pMac').value, everyN: $('pN').value, everyUnit: $('pU').value, startDate: $('pStart').value, nextDate: $('pNext').value,
          assignee: $('pAs').value, tasks: $('pTasks').value, active: $('pAct').value, note: $('pNote').value }).then(function (r) { if (!r.ok) return r.error; closeModal(); reload(p ? 'บันทึกแล้ว' : 'เพิ่มแผน PM แล้ว'); });
      } });
  }
  function pmDone(p) {
    var d = H.data, checks = p.tasks.map(function (t) { return { t: t, ok: true }; });
    var draw = function () {
      $('pdChecks').innerHTML = checks.length ? checks.map(function (c, i) { return '<div class="mtck"><span>' + esc(c.t) + '</span><div><button type="button" class="' + (c.ok ? 'on ok' : '') + '" data-ck="' + i + '|1">✓ ปกติ</button><button type="button" class="' + (!c.ok ? 'on bad' : '') + '" data-ck="' + i + '|0">✕ พบปัญหา</button></div></div>'; }).join('') : '<div class="muted">แผนนี้ไม่มีรายการเช็กลิสต์</div>';
      var bad = checks.some(function (c) { return !c.ok; }) || $('pdRes').value === 'issue';
      $('pdOpen').closest('label').style.display = bad ? '' : 'none';
      on('[data-ck]', 'click', function (b) { var a = b.getAttribute('data-ck').split('|'); checks[+a[0]].ok = a[1] === '1'; draw(); }, $('pdChecks'));
    };
    wide({ title: '✓ บันทึกทำ PM: ' + p.title, sub: p.machineName || '', icon: 'calcheck', ok: 'บันทึก',
      body: '<div class="pform"><div class="pf"><label for="pdDate">วันที่ทำ</label><input id="pdDate" type="date" value="' + d.today + '" max="' + d.today + '"></div>'
        + '<div class="pf"><label for="pdBy">ผู้ทำ *</label><input id="pdBy" list="pdByL" value="' + esc(p.assignee || '') + '"><datalist id="pdByL">' + list(S_().techs).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist></div>'
        + '<div class="pf full"><label>เช็กลิสต์</label><div id="pdChecks"></div></div>'
        + '<div class="pf"><label for="pdRes">ผลโดยรวม</label><select id="pdRes"><option value="ok">ปกติ</option><option value="issue">พบปัญหา</option></select></div>'
        + '<div class="pf"><label for="pdCost">ค่าใช้จ่าย (บาท)</label><input id="pdCost" inputmode="decimal"></div>'
        + '<div class="pf full"><label for="pdNote">หมายเหตุ</label><textarea id="pdNote" rows="2" placeholder="เช่น เปลี่ยนน้ำมัน 2 ลิตร"></textarea></div>'
        + '<div class="pf full"><label class="mtcheck"><input type="checkbox" id="pdOpen" checked> เปิดใบแจ้งซ่อมจากปัญหาที่พบ (ส่งเข้ากลุ่มช่างด้วย)</label></div></div>'
        + '<p class="muted" style="margin:6px 0 0">ครบกำหนดครั้งถัดไปจะเลื่อนเป็น วันที่ทำ + ' + p.everyN + ' ' + UNITS[p.everyUnit] + ' ให้อัตโนมัติ</p>',
      onOpen: function () { draw(); $('pdRes').addEventListener('change', draw); },
      check: function () { return $('pdBy').value.trim() ? '' : 'ใส่ชื่อผู้ทำ PM'; },
      submit: function () {
        var issue = $('pdRes').value === 'issue' || checks.some(function (c) { return !c.ok; });
        return call('mntDonePm', state.token, p.id, { date: $('pdDate').value, by: $('pdBy').value, result: issue ? 'issue' : 'ok', checks: checks, pmCost: $('pdCost').value, note: $('pdNote').value, openRepair: issue && $('pdOpen').checked })
          .then(function (r) { if (!r.ok) return r.error; closeModal(); reload('บันทึก PM แล้ว' + (r.repairCode ? ' · เปิดใบแจ้งซ่อม ' + r.repairCode : '')); });
      } });
  }
  function pmHist(p) {
    var logs = H.data.pmlog.filter(function (l) { return l.pmId === p.id; }).slice().reverse();
    wide({ title: 'ประวัติ PM: ' + p.title, sub: p.machineName || '', icon: 'clock', noOk: true, cancel: 'ปิด',
      body: logs.length ? logs.map(function (l) {
        return '<div class="li"><span>' + dd(l.date) + ' · ' + esc(l.by) + '<small>' + (l.checks || []).map(function (c) { return (c.ok ? '✓ ' : '✕ ') + esc(c.t); }).join(' · ') + (l.note ? ' — ' + esc(l.note) : '') + (l.pmCost ? ' · ' + baht(l.pmCost) : '') + '</small></span>'
          + '<b class="' + (l.result === 'issue' ? 'neg' : 'pos') + '">' + (l.result === 'issue' ? 'พบปัญหา' : 'ปกติ') + '<button type="button" class="mtrm" data-pld="' + esc(l.id) + '" aria-label="ลบประวัตินี้">✕</button></b></div>';
      }).join('') : '<div class="muted">ยังไม่เคยบันทึก</div>',
      onOpen: function () { on('[data-pld]', 'click', function (b) { ask({ title: 'ลบประวัติ PM นี้?', text: 'วันทำล่าสุดและกำหนดครั้งถัดไปจะคำนวณใหม่', tone: 'danger' }).then(function (ok) { if (!ok) return; call('mntDeletePmLog', state.token, b.getAttribute('data-pld')).then(function (r) { if (!r.ok) return toast(r.error); closeModal(); reload('ลบแล้ว'); }).catch(onServerError); }); }, $('mBody')); } });
  }

  // ==================== อะไหล่ & สต๊อก ====================
  function partPage() {
    var q = H.q, d = H.data, s = String(q.ps || '').toLowerCase();
    var rows = d.parts.filter(function (p) { return (q.poff || p.active !== 'off') && (!q.plow || p.low) && (!s || [p.code, p.name, p.place, p.machines].join(' ').toLowerCase().indexOf(s) >= 0); })
      .sort(function (a, b) { return (b.low ? 1 : 0) - (a.low ? 1 : 0) || String(a.name).localeCompare(String(b.name), 'th'); });
    var val = d.parts.reduce(function (t, p) { return t + Math.max(0, p.balance) * (Number(p.price) || 0); }, 0);
    var mv = d.moves.slice().reverse().slice(0, 60), TYPE = { IN: ['รับเข้า', '#16a34a'], OUT: ['เบิก', '#dc2626'], ADJ: ['ปรับยอด', '#a16207'] };
    $('main').innerHTML = '<h3>อะไหล่ & สต๊อก</h3>'
      + '<div class="kpis mtk3"><div class="kpi" style="--k:#475569"><b>' + d.parts.filter(function (p) { return p.active !== 'off'; }).length + '</b><span>รายการอะไหล่</span></div>'
      + '<div class="kpi" style="--k:' + (d.parts.some(function (p) { return p.low; }) ? '#d97706' : '#16a34a') + '"><b>' + d.parts.filter(function (p) { return p.low; }).length + '</b><span>ใกล้หมด / ต่ำกว่าจุดสั่งซื้อ</span></div>'
      + '<div class="kpi" style="--k:#7c3aed"><b>' + baht(val) + '</b><span>มูลค่าคงเหลือ</span></div></div>'
      + '<div class="mttool"><button class="btn btn-primary" id="ptAdd">' + icon('plus', 18) + ' เพิ่มอะไหล่</button></div>'
      + '<div class="pbar mtbar r1"><div class="psearch">' + icon('search', 18) + '<input id="ptS" type="search" placeholder="ค้นหา ชื่อ / รหัส / ที่เก็บ / ใช้กับเครื่อง" value="' + esc(q.ps || '') + '"></div>'
      + '<label class="mtcheck"><input type="checkbox" id="ptLow"' + (q.plow ? ' checked' : '') + '> เฉพาะใกล้หมด</label><label class="mtcheck"><input type="checkbox" id="ptOff"' + (q.poff ? ' checked' : '') + '> แสดงที่เลิกใช้</label></div>'
      + '<div class="ptable-wrap mtdesk"><table class="ptable"><thead><tr><th>อะไหล่</th><th>ที่เก็บ</th><th style="text-align:right">คงเหลือ</th><th style="text-align:right">จุดสั่งซื้อ</th><th style="text-align:right">ราคา/หน่วย</th><th></th></tr></thead><tbody>'
      + (rows.map(function (p) {
        return '<tr class="' + (p.low ? 'mtlow' : '') + (p.active === 'off' ? ' mtoff' : '') + '"><td><b>' + esc(p.name) + '</b>' + (p.code ? '<small class="muted"> · ' + esc(p.code) + '</small>' : '') + (p.machines ? '<br><small class="muted">ใช้กับ ' + esc(p.machines) + '</small>' : '') + '</td><td>' + esc(p.place || '-') + '</td>'
          + '<td style="text-align:right"><b>' + nf(p.balance) + '</b> ' + esc(p.unit) + (p.low ? ' <span class="mtst" style="--s:#d97706">ใกล้หมด</span>' : '') + '</td><td style="text-align:right">' + (p.minStock === '' ? '-' : nf(p.minStock)) + '</td><td style="text-align:right">' + (p.price === '' ? '-' : nf(p.price)) + '</td>'
          + '<td class="nw"><button class="btn btn-sm btn-line" data-mv="IN|' + esc(p.id) + '">+ รับเข้า</button> <button class="btn btn-sm btn-line" data-mv="OUT|' + esc(p.id) + '">− เบิก</button> <button class="btn btn-sm btn-line" data-mv="ADJ|' + esc(p.id) + '">นับยอด</button> <button class="btn btn-sm btn-line" data-pe="' + esc(p.id) + '" aria-label="แก้ไข">' + icon('edit', 15) + '</button></td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีอะไหล่ — กด "เพิ่มอะไหล่"</td></tr>') + '</tbody></table></div>'
      + '<div class="mtmob">' + rows.map(function (p) {
        return '<div class="panel mtpc' + (p.low ? ' mtlow' : '') + '"><div class="mtpmh"><div><b>' + esc(p.name) + '</b><small>' + esc([p.code, p.place].filter(String).join(' · ')) + '</small></div><div class="mtdue"><b>' + nf(p.balance) + ' ' + esc(p.unit) + '</b><small>' + (p.low ? '⚠ ใกล้หมด' : p.minStock !== '' ? 'สั่งเมื่อ ≤ ' + nf(p.minStock) : '') + '</small></div></div>'
          + '<div class="mtrow4"><button class="btn btn-sm btn-line" data-mv="IN|' + esc(p.id) + '">+ รับเข้า</button><button class="btn btn-sm btn-line" data-mv="OUT|' + esc(p.id) + '">− เบิก</button><button class="btn btn-sm btn-line" data-mv="ADJ|' + esc(p.id) + '">นับยอด</button><button class="btn btn-sm btn-line" data-pe="' + esc(p.id) + '">แก้ไข</button></div></div>';
      }).join('') + '</div>'
      + '<h4 class="mtgh">รายการรับเข้า / เบิกล่าสุด</h4><div class="ptable-wrap"><table class="ptable"><thead><tr><th>วันที่</th><th>อะไหล่</th><th>ประเภท</th><th style="text-align:right">จำนวน</th><th>อ้างอิง / หมายเหตุ</th><th></th></tr></thead><tbody>'
      + (mv.map(function (m) { var T = TYPE[m.type] || [m.type, '#475569']; return '<tr><td class="nw">' + dd(m.date) + '</td><td>' + esc(m.partName) + '</td><td><span class="mtst" style="--s:' + T[1] + '">' + T[0] + '</span></td><td style="text-align:right">' + nf(m.qty) + '</td><td>' + esc([m.ref, m.note, m.by].filter(String).join(' · ')) + '</td><td>' + (m.repairId ? '' : '<button class="mtrm" data-mvd="' + esc(m.id) + '" aria-label="ลบรายการ">✕</button>') + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีรายการ</td></tr>') + '</tbody></table></div>';
    $('ptS').addEventListener('input', function () { q.ps = this.value; clearTimeout(H.t); H.t = setTimeout(function () { partPage(); var e = $('ptS'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('ptLow').addEventListener('change', function () { q.plow = this.checked; partPage(); });
    $('ptOff').addEventListener('change', function () { q.poff = this.checked; partPage(); });
    $('ptAdd').addEventListener('click', function () { partForm(null); });
    var pOf = function (id) { return d.parts.filter(function (p) { return p.id === id; })[0]; };
    on('[data-pe]', 'click', function (el) { partForm(pOf(el.getAttribute('data-pe'))); }, $('main'));
    on('[data-mv]', 'click', function (el) { var a = el.getAttribute('data-mv').split('|'); moveForm(pOf(a[1]), a[0]); }, $('main'));
    on('[data-mvd]', 'click', function (el) { ask({ title: 'ลบรายการนี้?', text: 'ยอดคงเหลือจะคำนวณใหม่', tone: 'danger' }).then(function (ok) { if (!ok) return; call('mntDeleteMove', state.token, el.getAttribute('data-mvd')).then(function (r) { if (!r.ok) return toast(r.error); reload('ลบแล้ว'); }).catch(onServerError); }); }, $('main'));
  }
  function partForm(p) {
    var x = p || { unit: 'ชิ้น', active: 'on' };
    var F = function (id, label, v, attrs, full) { return '<div class="pf' + (full ? ' full' : '') + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(v == null ? '' : v) + '"' + (attrs || '') + '></div>'; };
    wide({ title: p ? 'แก้ไข ' + p.name : 'เพิ่มอะไหล่', icon: 'part', ok: 'บันทึก',
      body: '<div class="pform">' + F('aName', 'ชื่ออะไหล่ *', x.name, ' placeholder="เช่น ลูกปืน 6204 / สายพาน B-42"', true) + F('aCode', 'รหัสอะไหล่', x.code) + F('aUnit', 'หน่วย', x.unit, ' list="aUnitL"')
        + '<datalist id="aUnitL"><option value="ชิ้น"><option value="ตัว"><option value="เส้น"><option value="ม้วน"><option value="ลิตร"><option value="กระป๋อง"><option value="ชุด"><option value="เมตร"></datalist>'
        + F('aMin', 'จุดสั่งซื้อขั้นต่ำ', x.minStock, ' inputmode="decimal" placeholder="เหลือเท่านี้ให้เตือน"') + F('aPrice', 'ราคาต่อหน่วย (บาท)', x.price, ' inputmode="decimal"')
        + (p ? '' : F('aInit', 'ยอดตั้งต้น (มีอยู่ตอนนี้)', '', ' inputmode="decimal"'))
        + F('aPlace', 'ที่เก็บ', x.place, ' placeholder="เช่น ตู้อะไหล่ ชั้น 2"') + F('aMac', 'ใช้กับเครื่อง', x.machines, '', true)
        + '<div class="pf"><label for="aAct">สถานะ</label><select id="aAct"><option value="on">ใช้งาน</option><option value="off"' + (x.active === 'off' ? ' selected' : '') + '>เลิกใช้</option></select></div>'
        + '<div class="pf full"><label for="aNote">หมายเหตุ</label><textarea id="aNote" rows="2">' + esc(x.note || '') + '</textarea></div></div>',
      foot: p ? '<div class="mtfoot"><button type="button" class="btn btn-sm btn-line mtdel" id="aDel">' + icon('trash', 16) + ' ลบอะไหล่นี้</button></div>' : '',
      onOpen: function () { if ($('aDel')) $('aDel').addEventListener('click', function () { ask({ title: 'ลบ ' + p.name + '?', text: 'ลบได้เฉพาะอะไหล่ที่ยังไม่มีรายการรับเข้า / เบิก', tone: 'danger' }).then(function (ok) { if (!ok) return; call('mntDeletePart', state.token, p.id).then(function (r) { if (!r.ok) return toast(r.error); closeModal(); reload('ลบแล้ว'); }).catch(onServerError); }); }); },
      check: function () { return $('aName').value.trim() ? '' : 'ใส่ชื่ออะไหล่'; },
      submit: function () {
        return call('mntSavePart', state.token, { id: x.id || '', name: $('aName').value, code: $('aCode').value, unit: $('aUnit').value, minStock: $('aMin').value, price: $('aPrice').value, initQty: $('aInit') ? $('aInit').value : '',
          place: $('aPlace').value, machines: $('aMac').value, active: $('aAct').value, note: $('aNote').value, by: state.dept.name }).then(function (r) { if (!r.ok) return r.error; closeModal(); reload(p ? 'บันทึกแล้ว' : 'เพิ่มอะไหล่แล้ว'); });
      } });
  }
  function moveForm(p, type) {
    var T = { IN: 'รับอะไหล่เข้า', OUT: 'เบิกอะไหล่ (ไม่ผูกใบแจ้งซ่อม)', ADJ: 'นับยอดจริง / ปรับยอด' }[type];
    wide({ title: T, sub: p.name + ' · คงเหลือ ' + nf(p.balance) + ' ' + p.unit, icon: 'part', ok: 'บันทึก',
      body: '<div class="pform"><div class="pf"><label for="vDate">วันที่</label><input id="vDate" type="date" value="' + H.data.today + '"></div>'
        + '<div class="pf"><label for="vQty">' + (type === 'ADJ' ? 'ยอดที่นับได้จริง (' + esc(p.unit) + ')' : 'จำนวน (' + esc(p.unit) + ')') + ' *</label><input id="vQty" inputmode="decimal"></div>'
        + (type === 'IN' ? '<div class="pf"><label for="vPrice">ราคาต่อหน่วย (บาท)</label><input id="vPrice" inputmode="decimal" value="' + esc(p.price) + '"></div><div class="pf"><label for="vRef">เลขที่บิล / ร้าน</label><input id="vRef"></div>' : '')
        + '<div class="pf full"><label for="vNote">หมายเหตุ</label><input id="vNote"></div></div>',
      check: function () { var v = Number($('vQty').value); return $('vQty').value === '' || !(v >= 0) || (type !== 'ADJ' && !v) ? 'ใส่จำนวน' : type === 'OUT' && v > p.balance ? 'เบิกเกินยอดคงเหลือ (' + nf(p.balance) + ')' : ''; },
      submit: function () {
        return call('mntMovePart', state.token, { partId: p.id, type: type, date: $('vDate').value, qty: $('vQty').value, price: $('vPrice') ? $('vPrice').value : '', ref: $('vRef') ? $('vRef').value : '', note: $('vNote').value, by: state.dept.name })
          .then(function (r) { if (!r.ok) return r.error; closeModal(); reload('บันทึกแล้ว · คงเหลือ ' + nf(r.part.balance) + ' ' + r.part.unit); });
      } });
  }

  // ==================== ตั้งค่า & LINE ====================
  function setPage() {
    var s = S_();
    $('main').innerHTML = '<h3>ตั้งค่า & LINE แจ้งซ่อม</h3><div id="lnBox" class="panel pbox"><span class="spinner dark"></span> กำลังตรวจสอบ LINE…</div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('gear', 18) + ' รายการตัวเลือก (คั่นด้วย , หรือขึ้นบรรทัดใหม่)</h4><div class="pform">'
      + ['techs|รายชื่อช่าง (ใช้เลือกตอนรับงาน / ปิดงาน)|ช่างเอ, ช่างบี', 'categories|ประเภทงานซ่อม|', 'buildings|อาคาร|', 'depts|ฝ่าย / แผนกผู้แจ้ง|', 'machineTypes|ประเภทเครื่องจักร|'].map(function (x) {
        var a = x.split('|'); return '<div class="pf full"><label for="s_' + a[0] + '">' + a[1] + '</label><textarea id="s_' + a[0] + '" rows="2" placeholder="' + esc(a[2]) + '">' + esc(s[a[0]] || '') + '</textarea></div>';
      }).join('')
      + '<div class="pf full"><label class="mtcheck"><input type="checkbox" id="s_nr"' + (s.notifyReporter ? ' checked' : '') + '> ซ่อมเสร็จแล้ว ส่ง LINE ถึงผู้แจ้งให้กดตรวจรับ (เฉพาะคนที่แจ้งผ่านปุ่มเมนู LINE)</label>'
      + '<label class="mtcheck"><input type="checkbox" id="s_ng"' + (s.notifyGroupDone ? ' checked' : '') + '> ส่งการ์ด "ซ่อมเสร็จ" เข้ากลุ่มช่างด้วย (ใช้โควตาข้อความ LINE เพิ่ม)</label></div></div>'
      + '<div class="qsave"><button class="btn btn-primary" id="sSave">' + icon('check', 18) + ' บันทึกการตั้งค่า</button></div></div>';
    $('sSave').addEventListener('click', function () {
      var b = this, o = { notifyReporter: $('s_nr').checked ? '1' : '', notifyGroupDone: $('s_ng').checked ? '1' : '' };
      ['techs', 'categories', 'buildings', 'depts', 'machineTypes'].forEach(function (k) { o[k] = $('s_' + k).value; });
      if (!list(o.categories).length) return toast('ใส่ประเภทงานอย่างน้อย 1 ประเภท');
      b.disabled = true;
      call('mntSaveSettings', state.token, o).then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); H.data.settings = r.settings; toast('บันทึกแล้ว'); }).catch(function (e) { b.disabled = false; onServerError(e); });
    });
    lineBox();
  }
  function lineBox() {
    call('mntLineInfo', state.token).then(function (r) {
      if (state.page !== 'mt_set') return;
      var step = function (n, done, title, html) { return '<div class="mtstep' + (done ? ' done' : '') + '"><div class="mtsn">' + (done ? '✓' : n) + '</div><div><b>' + title + '</b>' + html + '</div></div>'; };
      var cp = function (text, id) { return '<div class="mtcp"><code id="' + id + '">' + esc(text) + '</code><button type="button" class="btn btn-sm btn-line" data-cp="' + id + '">' + icon('copy', 15) + ' คัดลอก</button></div>'; };
      $('lnBox').innerHTML = '<h4>' + icon('chat', 18) + ' LINE แจ้งซ่อม (OA ของฝ่ายช่าง)</h4>'
        + step(1, r.tokenOk, 'ใส่ Channel access token ของ LINE OA ฝ่ายช่าง', r.tokenOk ? '<p>เชื่อมกับบอท <b>' + esc(r.botName) + '</b> แล้ว · <button type="button" class="btn btn-sm btn-line" id="lnTokEdit">เปลี่ยน OA</button></p>'
          : '<p class="muted">สร้าง LINE Official Account ใหม่ → เปิด Messaging API → LINE Developers → Channel access token (long-lived) → คัดลอกมาวาง</p><div class="mtcp"><input id="lnTok" type="password" placeholder="วาง Token ที่นี่" autocomplete="off"><button type="button" class="btn btn-sm btn-primary" id="lnTokSave">บันทึก</button></div>')
        + step(2, false, 'ตั้ง Webhook URL ใน LINE Developers (Messaging API → Webhook settings → เปิด Use webhook)', cp(r.webhookUrl, 'lnWh'))
        + step(3, r.group, 'ผูกกลุ่ม LINE ของช่าง', (r.group ? '<p>ส่งงานเข้ากลุ่ม <b>' + esc(r.groupName || '(อ่านชื่อกลุ่มไม่ได้)') + '</b> · <button type="button" class="btn btn-sm btn-line" id="lnTest">ส่งข้อความทดสอบ</button></p>' : '')
          + '<p class="muted">เชิญบอทเข้ากลุ่มช่าง แล้วพิมพ์คำสั่งนี้ในกลุ่ม (ใช้ได้ครั้งเดียว)</p>' + cp(r.bindCmd, 'lnCmd') + '<div class="mtrow2"><button type="button" class="btn btn-sm btn-line" id="lnNew">ขอรหัสใหม่</button><button type="button" class="btn btn-sm btn-line" id="lnRe">↻ ตรวจสอบว่าผูกแล้ว</button></div>'
          + (r.seen.filter(function (g) { return !g.current; }).length ? '<div class="xsub2">หรือเลือกกลุ่มที่บอทอยู่แล้ว</div>' + r.seen.filter(function (g) { return !g.current; }).map(function (g) { return '<div class="li"><span>' + esc(g.name) + '</span><b><button type="button" class="btn btn-sm btn-line" data-use="' + esc(g.id) + '">ใช้กลุ่มนี้</button></b></div>'; }).join('') : ''))
        + step('3.1', !!r.techs.length, 'ช่างที่มีสิทธิ์กด "✋ รับงาน" ในกลุ่ม', (r.techs.length ? r.techs.map(function (t) { return '<div class="li"><span>👷 ' + esc(t.name) + '<small>เพิ่มเมื่อ ' + dt(t.addedAt) + '</small></span><b><button type="button" class="btn btn-sm btn-line mtdel" data-rmt="' + esc(t.userId) + '" data-nm="' + esc(t.name) + '">ลบสิทธิ์</button></b></div>'; }).join('') : '<p class="mtwarn">⚠ ยังไม่ได้กำหนด — ตอนนี้ทุกคนในกลุ่มกดรับงานได้</p>')
          + (r.techCode ? '<p>ให้ช่างพิมพ์คำสั่งนี้ในกลุ่มช่าง (ใช้ได้ 5 นาที · ครั้งเดียว):</p>' + cp(r.techCode.cmd, 'lnTc') : '')
          + '<div class="mtrow2"><button type="button" class="btn btn-sm btn-primary" id="lnTech" style="width:auto">+ เพิ่มช่างที่กดรับงานได้</button></div><p class="muted">ช่างพิมพ์ "ติดตามงานซ่อม" ในแชท → เห็นงานที่ตัวเองรับ แตะเพื่ออัปเดตได้</p>')
        + step(4, true, 'ลิงก์ / QR แจ้งซ่อม (พิมพ์ติดหน้างาน — สแกนแล้วแจ้งได้เลย ไม่ต้องมี LINE)', cp(r.formUrl, 'lnForm') + '<div id="lnQr" class="mtqr"></div><div class="mtrow2"><a class="btn btn-sm btn-line" href="' + esc(r.formUrl) + '" target="_blank" rel="noopener">เปิดดูฟอร์ม</a><button type="button" class="btn btn-sm btn-line" id="lnPoster">' + icon('print', 15) + ' ป้าย QR (A4)</button><button type="button" class="btn btn-sm btn-line mtdel" id="lnRot">เปลี่ยนลิงก์ (ลิงก์เดิมใช้ไม่ได้)</button></div>')
        + step(5, !!r.liffId, 'ปุ่ม "แจ้งซ่อม" ในเมนู LINE (Rich menu) — รู้ว่าใครแจ้ง และแจ้งกลับเมื่อซ่อมเสร็จ',
          '<p class="muted">LINE Developers → สร้าง LINE Login channel (Provider เดียวกับ OA ฝ่ายช่าง) → LIFF → Add: Size <b>Full</b>, Scope <b>openid + profile</b>, Endpoint URL ใส่ลิงก์ด้านล่าง → คัดลอก LIFF ID มาวาง</p>'
          + cp(r.endpoint, 'lnEp') + '<div class="mtcp"><input id="lnLiff" value="' + esc(r.liffId) + '" placeholder="LIFF ID เช่น 1234567890-AbCdEfGh"><button type="button" class="btn btn-sm btn-primary" id="lnLiffSave">บันทึก</button></div>'
          + (r.liffUrl ? '<p>ลิงก์สำหรับปุ่ม Rich menu ใน LINE Official Account Manager (Action: Link):</p>' + cp(r.liffUrl, 'lnRich') + '<p class="muted">หลังบันทึก LIFF ID แล้ว Endpoint URL จะมี &amp;l=… ต่อท้าย — คัดลอกไปใส่ใน LIFF อีกครั้ง</p>' : ''))
        + '<p class="muted" style="margin:10px 0 0">คำสั่งในแชท (บอทตอบกลับ ไม่เสียโควตาข้อความ): "แจ้งซ่อม" = เมนูแจ้งซ่อม · "ติดตามงานซ่อม" = งานที่ฉันแจ้ง / งานที่ฉันรับ · ในกลุ่มช่าง "งานค้าง" / "PM"</p>';
      on('[data-cp]', 'click', function (b) { copy($(b.getAttribute('data-cp')).textContent); }, $('lnBox'));
      loadQr(function () { if (window.QRCode && $('lnQr')) new window.QRCode($('lnQr'), { text: r.formUrl, width: 150, height: 150, correctLevel: window.QRCode.CorrectLevel.M }); });
      var busy = function (b, p, okMsg) { b.disabled = true; p.then(function (x) { b.disabled = false; if (x && x.ok === false) return toast(x.error); if (okMsg) toast(okMsg); lineBox(); }).catch(function (e) { b.disabled = false; onServerError(e); }); };
      if ($('lnTokSave')) $('lnTokSave').addEventListener('click', function () { var v = $('lnTok').value.trim(); if (!v) return toast('วาง Token ก่อน'); busy(this, call('mntSetToken', state.token, v), 'เชื่อม LINE OA แล้ว'); });
      if ($('lnTokEdit')) $('lnTokEdit').addEventListener('click', function () { ask({ title: 'เปลี่ยน LINE OA?', text: 'ต้องวาง Token ใหม่และผูกกลุ่มใหม่', ok: 'เปลี่ยน' }).then(function (ok) { if (ok) call('mntSetToken', state.token, '').then(lineBox).catch(onServerError); }); });
      if ($('lnTest')) $('lnTest').addEventListener('click', function () { busy(this, call('mntLineTest', state.token), 'ส่งข้อความทดสอบแล้ว — ดูในกลุ่ม LINE'); });
      $('lnNew').addEventListener('click', function () { busy(this, call('mntNewCode', state.token), 'ได้รหัสใหม่แล้ว'); });
      $('lnRe').addEventListener('click', lineBox);
      $('lnTech').addEventListener('click', function () { busy(this, call('mntTechCode', state.token), 'ได้รหัสแล้ว — ให้ช่างพิมพ์ในกลุ่มภายใน 5 นาที'); });
      on('[data-rmt]', 'click', function (b) { ask({ title: 'ลบสิทธิ์รับงานของ ' + b.getAttribute('data-nm') + '?', tone: 'danger', ok: 'ลบสิทธิ์' }).then(function (ok) { if (ok) busy(b, call('mntRemoveTech', state.token, b.getAttribute('data-rmt')), 'ลบสิทธิ์แล้ว'); }); }, $('lnBox'));
      on('[data-use]', 'click', function (b) { busy(b, call('mntUseGroup', state.token, b.getAttribute('data-use')), 'เปลี่ยนกลุ่มแล้ว'); }, $('lnBox'));
      $('lnRot').addEventListener('click', function () { var b = this; ask({ title: 'เปลี่ยนลิงก์แจ้งซ่อม?', text: 'QR / ลิงก์เดิมที่พิมพ์ติดไว้และปุ่มเมนู LINE จะใช้ไม่ได้ ต้องพิมพ์ QR ใหม่และแก้ Endpoint URL ของ LIFF', tone: 'danger', ok: 'เปลี่ยนลิงก์' }).then(function (ok) { if (ok) busy(b, call('mntNewFormKey', state.token), 'เปลี่ยนลิงก์แล้ว'); }); });
      $('lnLiffSave').addEventListener('click', function () { busy(this, call('mntSetLiff', state.token, $('lnLiff').value.trim()), 'บันทึก LIFF แล้ว'); });
      $('lnPoster').addEventListener('click', function () { poster(r.formUrl); });
    }).catch(function (e) { if ($('lnBox')) $('lnBox').innerHTML = '<div class="muted">' + esc(e.message) + '</div>'; });
  }
  function loadQr(cb) {
    if (window.QRCode) return cb();
    var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = cb; document.head.appendChild(sc);
  }
  function poster(url) {   // ป้าย A4 ติดหน้างาน
    var logo = document.querySelector('.brand-logo');
    $('main').innerHTML = '<div class="pbar noprint"><button class="btn btn-sm btn-line" id="pBack">' + icon('back', 16) + ' กลับ</button><button class="btn btn-sm btn-primary" id="pPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div class="mtposter">' + (logo ? '<img class="mtplogo" src="' + logo.src + '" alt="">' : '') + '<h2>🔧 แจ้งซ่อม สแกนที่นี่</h2><h3 lang="my">ပြင်ဆင်ရန် ဤနေရာကို စကင်ဖတ်ပါ</h3><div id="qrBig"></div>'
      + '<p>1. สแกน QR ด้วยกล้องมือถือ · 2. เลือกเครื่อง / ใส่จุดที่เสีย · 3. ถ่ายรูป แล้วกดส่ง</p><p class="mtpsub">ช่างจะได้รับแจ้งในกลุ่ม LINE ทันที · ฝ่ายช่าง</p></div>';
    loadQr(function () { new window.QRCode($('qrBig'), { text: url, width: 380, height: 380, correctLevel: window.QRCode.CorrectLevel.M }); });
    $('pBack').addEventListener('click', setPage);
    $('pPrint').addEventListener('click', function () { window.print(); });
  }
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><div id="lOut" class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
    call('mntLog', state.token, 300).then(function (r) {
      $('lOut').outerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>รายละเอียด</th></tr></thead><tbody>'
        + (r.rows.map(function (x) { return '<tr><td class="nw">' + esc(x.time) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.detail) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีประวัติ</td></tr>') + '</tbody></table></div>';
    }).catch(onServerError);
  }

  // ---------- CSS ของโมดูล (คลาสขึ้นต้น mt) ----------
  var css = document.createElement('style');
  css.textContent = [
    '.mttool{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:0 0 12px}.mttool .btn{width:auto;flex:0 0 auto;min-height:44px;padding:0 18px;font-size:15px}',
    '.mtchips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.mtchips .chip{white-space:nowrap}',
    '.mtbar{display:grid!important;grid-template-columns:minmax(0,1fr) 200px;gap:10px;align-items:center}.mtbar.r1{grid-template-columns:minmax(0,1fr) auto auto}.mtbar select{width:100%;height:44px;margin:0;border:1.5px solid var(--line);border-radius:10px;padding:0 10px;background:#fff;font:inherit;font-size:14px;color:inherit}.mtbar .psearch{min-width:0;margin:0}',
    '.pf.mtreq>label::after{content:" *";color:#c2410c}.pf.mtmust input,.pf.mtmust select,.pf.mtmust textarea{border:2px solid #f97316!important;background:#fff7ed!important}.pf.mtmust>label{color:#c2410c!important;font-weight:700}.mtwarn{color:#b45309;font-weight:600}',
    '.mtcheck{display:flex!important;align-items:center;gap:8px;font-size:14px;color:var(--ink)!important;margin:4px 0;cursor:pointer;white-space:nowrap}.mtcheck input{width:20px;height:20px;flex:none}',
    '.mtst{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:color-mix(in srgb,var(--s) 12%,white);color:var(--s);white-space:nowrap;line-height:1.5}',
    '.mtcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px;margin-bottom:8px}',
    '.mtcard{display:flex;gap:12px;align-items:flex-start;text-align:left;background:#fff;border:1.5px solid var(--line);border-left:6px solid var(--s);border-radius:14px;padding:10px 12px;box-shadow:var(--shadow);cursor:pointer;font:inherit;color:var(--ink);min-width:0;width:100%}.mtcard:hover{border-color:var(--s)}.mtcard:focus-visible{outline:3px solid #94a3b8;outline-offset:2px}.mtcard.off{opacity:.6}',
    '.mtcard>img,.mtnoimg{width:84px;height:84px;flex:none;border-radius:10px;object-fit:cover;background:#f1f5f9;display:grid;place-items:center;color:#94a3b8}.mtnoimg.big{width:160px;height:160px}',
    '.mtci{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.mtci b{font-size:15.5px;line-height:1.35}.mtci small{color:var(--muted);font-size:12.5px}.mtprob{color:#334155!important;font-size:13.5px!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.mtch{display:flex;justify-content:space-between;gap:8px;align-items:center}.mtcode{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.3px}.mtcm{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin-top:2px}',
    '.mtgh{margin:18px 0 8px;font-size:16px}.mtgh small{color:var(--muted);font-weight:400;margin-left:6px}',
    '.mthead{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.mthead small{color:var(--muted);font-size:13px;width:100%}.mtsec{font-weight:700;font-size:14px;color:#334155;border-top:1px solid var(--line);padding-top:10px;margin-top:4px}',
    '.mtprh,.mtpr{display:grid;grid-template-columns:minmax(0,2.2fr) 80px 100px 90px 34px;gap:6px;align-items:center}.mtprh{font-size:12px;color:var(--muted);font-weight:700;padding:0 0 4px}.mtpr{margin-bottom:6px}.mtpr input,.mtpr select{min-width:0;width:100%;height:40px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:14px;background:#fff}.mtpr b{text-align:right;font-size:14px}',
    '.mtrow2 a.btn{text-decoration:none}.mtrm{width:32px;height:32px;border:1.5px solid #fecaca;border-radius:8px;background:#fff;color:#b91c1c;font-size:14px;cursor:pointer;margin-left:6px}.mtrow2{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.mtrow2 .btn{width:auto}.mtrow4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.mtrow4 .btn{width:100%;padding:8px 4px}',
    '.mtsum{margin-top:8px;font-size:14px;color:#334155}.mtgal{display:flex;flex-wrap:wrap;gap:8px}.mtgal span{position:relative}.mtgal img{width:96px;height:96px;object-fit:cover;border-radius:10px;display:block}.mtx{position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;border:0;background:#0f172a;color:#fff;font-size:12px;cursor:pointer}',
    '.mtaddph{width:96px;height:96px;border:2px dashed var(--line);border-radius:10px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;font-size:12px;color:var(--muted);cursor:pointer}',
    '.mttl{font-size:13.5px;border-left:3px solid var(--line);padding-left:10px}.mttl div{padding:3px 0}.mttl small{color:var(--muted)}',
    '.mtfoot{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;width:100%}.mtfoot .btn{width:auto}.mtdel{color:#b91c1c!important;border-color:#fecaca!important}',
    '.mtdh{display:flex;gap:8px;margin-bottom:12px}.mtdh .btn{width:auto}.mtmd{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}.mtmd>a img{width:220px;height:220px;object-fit:cover;border-radius:12px;display:block}',
    '.mtkv{display:grid;grid-template-columns:120px minmax(0,1fr);gap:4px 10px;font-size:14px}.mtkv span{color:var(--muted)}.mtk3{grid-template-columns:repeat(3,1fr)!important;margin-top:14px}',
    '.mtpml{display:grid;gap:10px}.mtpm{border-left:6px solid #475569;padding:12px 14px}.mtpm.soon{border-left-color:#d97706}.mtpm.late{border-left-color:#dc2626;background:#fffafa}.mtpm.off{opacity:.6}',
    '.mtpmh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.mtpmh b{font-size:15.5px;display:block}.mtpmh small{color:var(--muted);font-size:13px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}.mtdue{text-align:right;flex:none}.mtdue b{font-size:15px}.mtpm.late .mtdue small{color:#b91c1c;font-weight:700}',
    '.mttasks{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;color:#334155;margin-top:6px}.mtpmf{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}.mtpmf span{display:flex;gap:6px;flex-wrap:wrap}.mtpmf .btn{width:auto}',
    '.mtck{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px dashed var(--line);padding:6px 0}.mtck span{font-size:14px}.mtck div{display:flex;gap:4px;flex:none}.mtck button{border:1.5px solid var(--line);background:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.mtck button.on.ok{background:#16a34a;border-color:#16a34a;color:#fff}.mtck button.on.bad{background:#dc2626;border-color:#dc2626;color:#fff}',
    '.mtlow td{background:#fffbeb}.mtoff{opacity:.55}.mtmob{display:none}.mtpc{padding:12px;margin-bottom:8px}.mtpc.mtlow{border-left:5px solid #d97706}',
    '.mtstep{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.mtstep:first-of-type{border-top:0}.mtsn{width:30px;height:30px;flex:none;border-radius:50%;background:#e2e8f0;color:#334155;display:grid;place-items:center;font-weight:700}.mtstep.done .mtsn{background:#16a34a;color:#fff}.mtstep>div:last-child{min-width:0;flex:1}.mtstep p{margin:6px 0;font-size:14px}',
    '.mtcp{display:flex;gap:6px;align-items:center;margin:6px 0}.mtcp code,.mtcp input{flex:1;min-width:0;background:#f8fafc;border:1.5px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;overflow-wrap:anywhere;font-family:inherit}.mtcp .btn{width:auto;flex:none}.mtqr{margin:8px 0}.mtqr img{display:block}',
    '.mtbr{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 34px;gap:8px;align-items:center;padding:4px 0;font-size:13px}.mtbr span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mtbr i{display:block;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden}.mtbr em{display:block;height:100%;border-radius:99px}.mtbr b{text-align:right}',
    '.li.mtli{display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:10px;align-items:center}.li.mtli>b{justify-self:end}.mtth{width:76px;height:76px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0}.mtnoph{display:grid;place-items:center;background:#f1f5f9;color:#94a3b8}.li.mtli small{display:block;margin-top:2px}',
    '.tap{cursor:pointer;border-radius:8px}.tap:hover{background:#f8fafc}.tap:focus-visible{outline:2px solid #475569;outline-offset:1px}.mtok{color:#15803d;font-weight:700;font-size:14px;padding:6px 0}.mtfull{margin-bottom:16px}.xsub2{font-size:12.5px;color:var(--muted);font-weight:700;margin:10px 0 2px}',
    '.mtposter{text-align:center;background:#fff;padding:30px;border-radius:12px}.mtplogo{height:70px}.mtposter h2{font-size:40px;margin:10px 0 4px}.mtposter h3{font-weight:500;color:#475569;margin:0 0 16px}.mtposter #qrBig{display:inline-block;padding:14px;border:3px solid #475569;border-radius:16px}.mtposter p{font-size:18px}.mtpsub{color:#64748b}',
    '@media (max-width:760px){.mtcards{grid-template-columns:minmax(0,1fr)}.mtbar,.mtbar.r1{grid-template-columns:1fr}.mttool .btn{flex:1 1 auto;justify-content:center}.mtmd{grid-template-columns:1fr}.mtmd>a img{width:100%;height:220px}.mtk3{grid-template-columns:1fr 1fr 1fr!important}.mtk3 .kpi b{font-size:16px}',
    '.mtprh{display:none}.mtpr{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 34px;row-gap:4px}.mtpr>:first-child{grid-column:1/-1}.mtpr b{display:none}.mtdesk{display:none}.mtmob{display:block}.mtkv{grid-template-columns:100px minmax(0,1fr)}}'
  ].join('\n');
  document.head.appendChild(css);
})();
