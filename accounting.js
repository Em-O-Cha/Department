// ==================== ฝ่ายบัญชี (ACC) — รายงานรับออเดอร์ 7-Eleven ====================
// หน้าเว็บของโมดูล "accounting" — index.html เรียก ACC.menus() / ACC.render(page)
// ข้อมูลอยู่ใน Google Sheet ของฝ่าย ผ่าน API Acc.gs (accLoad, acc711Preview, acc711Save, ...)
// ขั้นตอน: เลือกไฟล์ Excel po_export จากระบบ 7-11 → หน้าเว็บอ่านไฟล์เอง (SheetJS) → ตรวจตาราง (หน้าตาเหมือนต้นแบบรับออเดอร์)
//          → บันทึก → ส่ง LINE เข้ากลุ่ม (สรุป + ปุ่มเปิด PDF) · ข้อมูลทุกบรรทัดเก็บไว้ทำ Dashboard
(function () {
  var H = window.ACC = { data: null, loading: null, q: {}, imp: null, cur: null, pendingCur: null };
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  Object.assign(ICONS, {
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 18h4"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'
  });

  var MENUS = [
    { id: 'a_dash', label: 'Dashboard ฝ่ายบัญชี', ic: 'chart' },
    { id: 'a_mon', label: 'รายงานสรุปรายเดือน (ทุกบริษัท)', ic: 'table' },
    { section: 'รับ (เงินเข้า)', tone: 'in' },
    { group: 'ออเดอร์ 7-11' },
    { id: 'a_imp', label: 'นำเข้าไฟล์ออเดอร์ 7-11', ic: 'upload' },
    { id: 'a_hist', label: 'รายงาน / ประวัติการนำเข้า 7-11', ic: 'table' },
    { group: 'CP Ram' },
    { id: 'a_cp', label: 'นำเข้า PO CP Ram (PDF)', ic: 'upload' },
    { id: 'a_cpl', label: 'ตารางส่งสินค้า CP Ram', ic: 'table' },
    { group: 'ต่างประเทศ' },
    { id: 'a_ex', label: 'นำเข้า Invoice ต่างประเทศ (PDF)', ic: 'upload' },
    { id: 'a_exl', label: 'ออเดอร์ต่างประเทศ', ic: 'table' },
    { section: 'จ่าย (เงินออก)', tone: 'out' },
    { id: 'a_apin', label: 'นำเข้าบิล (ภาพถ่าย / สแกน / PDF)', ic: 'upload' },
    { id: 'a_appo', label: 'PO ล่วงหน้า (รอบิล)', ic: 'clock' },
    { id: 'a_ap', label: 'รายงานจ่ายตามรอบ', ic: 'table' },
    { id: 'a_apv', label: 'ผู้ขาย / ตั้งค่า (จ่าย)', ic: 'gear' },
    { section: 'ตั้งค่า', tone: '' },
    { id: 'a_set', label: 'ตั้งค่าศูนย์ / สินค้า 7-11 / LINE', ic: 'gear' },
    { id: 'a_cps', label: 'ตั้งค่าคลัง / สถานที่ส่ง CP Ram', ic: 'gear' }
  ];
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TOTAL_BG = '#FEF2CB', HEAD_BG = '#FFF2CC', GRAND_BG = '#FEF2CD';   // สีตามไฟล์ต้นแบบ (เหมือน Acc.gs)

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'); return isoOf(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function monthEnd(iso) { var p = iso.split('-'); return isoOf(new Date(+p[0], +p[1], 0)); }
  function dayName(iso) { var p = String(iso).split('-'); return 'วัน' + ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'][new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function thDate(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(2); }
  function thRange(list) { return !list || !list.length ? '-' : list.length === 1 ? thDate(list[0]) : thDate(list[0]) + ' – ' + thDate(list[list.length - 1]); }
  function n0(v) { return Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function baht(v) { return '฿' + Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function wide(cfg) { cfg.wide = true; cfg.color = cfg.color || state.dept.color; openModal(cfg); }
  function product(map, key) { return map.products.filter(function (p) { return p.key === key; })[0]; }
  function pname(p) { return p ? (p.l1 + (p.l2 ? ' ' + p.l2 : '')) : ''; }
  // ตัวอักษรดำ/ขาวตามความสว่างของพื้น (อ่านง่ายทุกสี)
  function ink(hex) { var h = String(hex || '#ffffff').replace('#', ''); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (r * 299 + g * 587 + b * 114) / 1000 < 140 ? '#fff' : '#0f172a'; }
  function logoHtml() { var l = document.querySelector('.brand-logo'); return l ? '<img class="a7logo" src="' + l.src + '" alt="">' : ''; }
  function landscape(onOff) {
    var el = document.getElementById('accLandscape');
    if (onOff && !el) { el = document.createElement('style'); el.id = 'accLandscape'; el.textContent = '@page{size:A4 landscape;margin:7mm}'; document.head.appendChild(el); }
    if (!onOff && el) el.parentNode.removeChild(el);
  }

  // ---------- โหลดข้อมูล ----------
  H.load = function () {
    if (H.loading) return H.loading;
    H.loading = call('accLoad', state.token).then(function (d) { H.data = d; H.loadedAt = Date.now(); H.loading = null; return d; }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  function reload(msg) {
    if (msg) toast(msg);
    H.dcache = null; H.cmp = null; H.mon = null; H.cmpAt = H.monAt = 0;   // มีการบันทึก → ผลสรุปที่เก็บไว้ใช้ไม่ได้แล้ว
    return H.load().then(function () { if (String(state.page).indexOf('a_') === 0) H.render(state.page); }).catch(onServerError);
  }
  H.reset = function () { H.dcache = null; H.dashDcs = null; H.cmpAt = H.monAt = 0; H.cmp = null; H.cmpSel = ''; if (window.ACCCP) ACCCP.reset(); if (window.ACCEX) ACCEX.reset(); if (window.ACCAP) ACCAP.reset(); H.data = null; H.q = {}; H.imp = null; H.cur = null; H.pendingCur = null; H.setDraft = null; landscape(false); };
  H.menus = function () { return MENUS; };
  H.exportFile = function (page, kind) { return window.ACCAP && /^a_ap/.test(page) ? ACCAP.exportFile(page, kind) : null; };
  H.render = function (page) {
    landscape(false);
    // Dashboard ไม่ต้องรอโหลดข้อมูลหลักก่อน: วาดหน้าทันที แล้วแต่ละส่วนค่อยขึ้นจากบนลงล่าง (ผู้ใช้ขอ 22/11/69)
    if (!H.data && page === 'a_dash') {
      H.load().then(function () { if (state.page === 'a_dash') fillDcs(); }).catch(function (e) { if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) onServerError(e); });
      return dash();
    }
    if (!H.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">กำลังโหลดข้อมูลจาก Google Sheet…</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      H.load().then(function () { if (state.page === page) H.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">เปิดข้อมูลไม่ได้</p><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet และโฟลเดอร์ไฟล์ของฝ่าย แล้วแชร์ให้บัญชีของระบบเป็นผู้แก้ไข</span></div></div>';
      });
      return;
    }
    // ผลสรุปเก็บไว้ 5 นาที: กลับมาหน้า Dashboard ภายใน 5 นาทีขึ้นทันที (เกินนั้นคำนวณใหม่ · กด "คำนวณใหม่" ได้ตลอด)
    setTimeout(function () { H.autoTick(true); }, 800);   // เปิดหน้า: ข้อมูลเก่าเกิน 15 วินาที → เช็กของใหม่
    if (!fresh(H.cmpAt)) H.cmp = null;
    if (!fresh(H.monAt)) H.mon = null;   // กลับมาหน้า Dashboard = คำนวณเปรียบเทียบใหม่ (อาจมีออเดอร์ใหม่)
    ({ a_imp: importPage, a_hist: histPage, a_dash: dash, a_mon: monthly, a_set: settings, a_cp: function () { window.ACCCP.importPage(); }, a_cpl: function () { window.ACCCP.listPage(); }, a_cps: function () { window.ACCCP.settingsPage(); }, a_ex: function () { window.ACCEX.importPage(); }, a_exl: function () { window.ACCEX.listPage(); }, a_ap_dash: function () { go('a_dash'); }, a_apin: function () { window.ACCAP.importPage(); }, a_ap: function () { window.ACCAP.roundPage(); }, a_apv: function () { window.ACCAP.vendorPage(); }, a_appo: function () { window.ACCAP.poPage(); } }[page] || importPage)();
  };

  // ==================== รีเฟรชข้อมูลอัตโนมัติ (ผู้ใช้ขอ 23/11/69) ====================
  // หน้ารายงาน / รายการของบัญชี: ทุก 1 นาที (และทันทีเมื่อเปิดหน้าที่ข้อมูลเก่าเกิน 15 วินาที) โหลดข้อมูลใหม่ — เปลี่ยนจริงค่อยวาดหน้าใหม่ คงตำแหน่งเลื่อนไว้
  // ไม่รีเฟรชตอนกำลังพิมพ์ / เปิดหน้าต่าง / กรอกฟอร์มบิล / หน้านำเข้า · หน้าซ่อนอยู่ไม่โหลด
  var AUTO_PAGES = { a_dash: 1, a_mon: 1, a_hist: 1, a_cpl: 1, a_exl: 1, a_ap: 1, a_appo: 1 };
  function fp(x) { try { return JSON.stringify(x); } catch (e) { return String(Math.random()); } }
  function autoBusy() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('main').contains(a)) return true;
    var mo = document.getElementById('modalOverlay');
    if (mo && !mo.classList.contains('hidden')) return true;
    if (document.querySelector('.askov')) return true;
    if (window.ACCAP && ACCAP.cur) return true;   // กำลังกรอกบิล / PO
    return false;
  }
  function keepScroll() {
    var boxes = Array.prototype.map.call(document.querySelectorAll('#main .cpwrap, #apSheets'), function (e) { return [e.scrollTop, e.scrollLeft]; });
    var y = window.scrollY;
    return function () { window.scrollTo(0, y); Array.prototype.forEach.call(document.querySelectorAll('#main .cpwrap, #apSheets'), function (e, i) { if (boxes[i]) { e.scrollTop = boxes[i][0]; e.scrollLeft = boxes[i][1]; } }); };
  }
  H.syncAt = {};
  H.autoTick = function (onOpen) {
    var pg = state.page;
    if (!state.dept || state.admin || document.hidden || !AUTO_PAGES[pg] || autoBusy() || H.autoRun) return;
    var age = pg === 'a_cpl' ? (window.ACCCP && ACCCP.age()) : pg === 'a_exl' ? (window.ACCEX && ACCEX.age()) : /^a_ap/.test(pg) ? (window.ACCAP && ACCAP.age()) : Date.now() - (H.loadedAt || 0);
    if (onOpen && (Date.now() - (H.syncAt[pg] || 0) < 15000 || (age || 0) < 15000)) return;   // เพิ่งโหลดมา ไม่ต้องโหลดซ้ำ
    var job;
    if (pg === 'a_cpl' && window.ACCCP) job = ACCCP.refresh();
    else if (pg === 'a_exl' && window.ACCEX) job = ACCEX.refresh();
    else if ((pg === 'a_ap' || pg === 'a_appo') && window.ACCAP) job = ACCAP.refresh();
    else if (pg === 'a_hist') job = call('accLoad', state.token).then(function (d) { var ch = fp(d) !== fp(H.data); if (ch) H.data = d; H.loadedAt = Date.now(); return ch; });
    else job = Promise.all([call('accMonthly', state.token), call('accLoad', state.token), window.ACCAP ? ACCAP.refresh() : false]).then(function (r) {   // Dashboard / สรุปรายเดือน: ทุกบริษัท + ค่าใช้จ่าย
      var m = r[0] && r[0].ok ? r[0] : null, ch = !!r[2];
      if (m && fp(m.companies) !== fp(H.mon && H.mon.companies)) { H.mon = m; H.monAt = Date.now(); ch = true; }
      if (fp(r[1]) !== fp(H.data)) { H.data = r[1]; H.loadedAt = Date.now(); ch = true; }
      if (ch) { H.dcache = null; H.cmp = null; H.cmpAt = 0; if (m) { H.mon = m; H.monAt = Date.now(); } }
      return ch;
    });
    if (!job) return;
    H.autoRun = true; H.syncAt[pg] = Date.now();
    job.then(function (ch) {
      H.autoRun = false;
      if (!ch || state.page !== pg || autoBusy()) return;
      var back = keepScroll();
      H.render(pg); back(); setTimeout(back, 1500);   // Dashboard ค่อย ๆ ขึ้น → คืนตำแหน่งอีกรอบ
      toast('มีข้อมูลใหม่ — อัปเดตหน้าแล้ว');
    }).catch(function () { H.autoRun = false; });   // เน็ตหลุด / หมดเวลา: ข้ามรอบนี้เงียบ ๆ
  };
  if (!H.autoTimer) H.autoTimer = setInterval(function () { if (state.dept && state.dept.module === 'accounting') H.autoTick(false); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && state.dept && state.dept.module === 'accounting') H.autoTick(true); });

  // ==================== ตาราง "ต้นแบบรับออเดอร์ 7-11" ====================
  // m = matrix จาก Acc.gs (dcs[{name,cells,cases}], byProduct, cases) · full = ศูนย์ละ 3 แถวเหมือนต้นแบบ (แถวแรก = จำนวนลัง)
  H.tplHtml = function (map, m, opt) {
    opt = opt || {};
    var P = map.products, full = opt.full !== false;
    var hc = function (p) { return ' style="background:' + p.color + ';color:' + ink(p.color) + '"'; };
    var hasImg = P.some(function (p) { return p.img; }), RS = hasImg ? 4 : 3;
    var h = '<div class="a7wrap"><table class="a7t' + (full ? ' full' : '') + '"><thead>'
      + '<tr><th rowspan="' + RS + '" class="a7no">ที่</th><th rowspan="' + RS + '" class="a7dc">ศูนย์กระจายสินค้า<br>DC</th><th colspan="' + P.length + '" style="background:' + HEAD_BG + '">รายการสินค้า (จำนวนลัง)</th><th rowspan="' + RS + '" class="a7sum">รวม<br>(ลัง)</th></tr>'
      // แถวรูปสินค้า (ตั้งรูปได้ในหน้าตั้งค่า) · crossorigin เพื่อให้ html2canvas ใส่รูปลงภาพ LINE ได้
      + (hasImg ? '<tr>' + P.map(function (p) { return '<th class="a7pi"' + hc(p) + '>' + (p.img ? '<img src="' + esc(p.img) + '=w160" crossorigin="anonymous" alt="" loading="eager">' : '') + '</th>'; }).join('') + '</tr>' : '')
      // ชื่อสินค้า 2 บรรทัดอยู่ในช่องเดียว (เหมือน Merge Cells — ผู้ใช้ขอ 23/11/69 ไม่ให้มีเส้นคั่นระหว่างบรรทัด)
      + '<tr>' + P.map(function (p) { return '<th class="a7p" rowspan="2"' + hc(p) + '>' + esc(p.l1) + (p.l2 ? '<br>' + esc(p.l2) : '') + '</th>'; }).join('') + '</tr>'
      + '<tr class="a7pz"></tr></thead><tbody>';
    m.dcs.forEach(function (d, i) {
      var rows = full ? 3 : 1;
      h += '<tr class="a7r' + (d.cases ? ' has' : ' none') + '"' + (opt.click && d.cases ? ' data-dc="' + esc(d.name) + '" tabindex="0" title="ดูใบสั่งซื้อของศูนย์นี้"' : '') + '>'
        + '<td rowspan="' + rows + '" class="a7no">' + (i + 1) + '</td><td rowspan="' + rows + '" class="a7dc"><b>' + esc(d.name) + '</b>' + (d.poCount ? '<small>' + d.poCount + ' ใบสั่ง</small>' : '') + '</td>'
        + P.map(function (p) { var v = d.cells[p.key]; return '<td class="a7v"' + (v ? hc(p) : '') + '>' + (v ? n0(v) : '') + '</td>'; }).join('')
        + '<td class="a7sum">' + (d.cases ? n0(d.cases) : '') + '</td></tr>';
      if (full) h += '<tr class="a7blank"><td colspan="' + (P.length + 1) + '"></td></tr><tr class="a7blank"><td colspan="' + (P.length + 1) + '"></td></tr>';
    });
    h += '</tbody><tfoot><tr><td colspan="2" style="background:' + TOTAL_BG + '">รวม</td>'
      + P.map(function (p) { var v = m.byProduct[p.key] || 0; return '<td class="a7v"' + hc(p) + '>' + n0(v) + '</td>'; }).join('')
      + '<td class="a7sum">' + n0(m.cases) + '</td></tr>'
      + '<tr class="a7grand"><td colspan="2" style="background:' + GRAND_BG + '">รวมทั้งหมด</td><td colspan="' + (P.length + 1) + '" style="background:' + GRAND_BG + '">' + n0(m.cases) + ' ลัง</td></tr></tfoot></table></div>';
    return h;
  };
  function mainOrOrdered(map, m) {
    var by = m.byProduct || {};
    if (!map.products.some(function (p) { return p.main; })) return map;   // ข้อมูลเก่าไม่มีธงสินค้าหลัก → แสดงทั้งหมด
    return Object.assign({}, map, { products: map.products.filter(function (p) { return p.main || (by[p.key] || 0) > 0; }) });
  }
  // หัวรายงาน + ตาราง + ช่องเซ็น (ใช้ทั้งหน้าจอและพิมพ์)
  function reportHtml(map, m, sub) {
    // ตัดศูนย์ที่ไม่มีออเดอร์ออก (ผู้ใช้ขอ 23/11/69) · สินค้าหลัก 17 ตัวแสดงเสมอ · สินค้าที่เพิ่มเอง (เช่น เจ) แสดงเมื่อมีออเดอร์ (ผู้ใช้ขอ 24/11/69)
    map = mainOrOrdered(map, m);
    var dz = m.dcs.filter(function (d) { return d.cases; });
    if (dz.length) m = Object.assign({}, m, { dcs: dz });
    return '<div class="a7rep"><div class="a7head">' + logoHtml() + '<div class="a7title"><b>แบบฟอร์มบันทึกออเดอร์ 7-Eleven</b><span>บริษัท สปังกี้ ฟู้ด จำกัด</span></div>'
      + '<div class="a7meta"><div>วันที่สั่ง <b>' + thRange(m.poDates) + '</b></div><div>วันที่ส่ง <b>' + thRange(m.deliveryDates) + '</b></div>' + (sub ? '<div>' + sub + '</div>' : '') + '</div></div>'
      + H.tplHtml(map, m, { full: true, click: true })
      + '<div class="a7sign"><div>ผู้จัดทำ <span></span></div><div>ผู้ตรวจสอบ <span></span></div></div></div>';
  }
  function kpiRow(m) {
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var dcN = m.dcs.filter(function (d) { return d.cases; }).length;
    return '<div class="kpis a7k">' + tile(n0(m.cases), 'รวมจำนวนลัง', '#059669') + tile(m.poCount, 'ใบสั่งซื้อ', '#2563eb', dcN + ' จาก ' + m.dcs.length + ' ศูนย์')
      + tile(baht(m.amount), 'มูลค่า (ไม่รวม VAT)', '#7c3aed', 'VAT ' + baht(m.vat)) + tile(baht(m.amount + m.vat), 'มูลค่ารวม VAT', '#d97706') + '</div>';
  }

  // ==================== 1) นำเข้าไฟล์ ====================
  function steps(n) {
    return '<ol class="a7steps">' + ['เลือกไฟล์ Excel / PDF', 'ตรวจข้อมูล', 'บันทึก & ส่ง LINE'].map(function (t, i) {
      return '<li class="' + (i + 1 < n ? 'done' : i + 1 === n ? 'on' : '') + '"><i>' + (i + 1 < n ? '✓' : i + 1) + '</i>' + t + '</li>';
    }).join('') + '</ol>';
  }
  function importPage() {
    var I = H.imp;
    if (I && I.preview) return previewPage();
    $('main').innerHTML = '<h3>นำเข้าไฟล์ออเดอร์ 7-11</h3><p class="lead">ดาวน์โหลดไฟล์ใบสั่งซื้อ (po_export) จากระบบ 7-11 แล้วเลือกไฟล์ที่นี่ · ระบบจะจัดเป็นตารางเหมือนต้นแบบรับออเดอร์ให้ตรวจก่อนบันทึก</p>'
      + steps(1)
      + (H.data.hasFolder ? '' : '<div class="panel status off" style="margin-bottom:12px"><div class="dot">' + icon('warn', 20) + '</div><div><b>ยังไม่ได้ตั้งโฟลเดอร์ไฟล์ของฝ่าย</b><span>นำเข้าและบันทึกได้ แต่จะสร้าง PDF / ส่ง LINE พร้อมไฟล์ได้เมื่อผู้ดูแลระบบใส่ลิงก์โฟลเดอร์ Google Drive ของฝ่ายแล้ว</span></div></div>')
      + '<label class="a7drop" id="aDrop" tabindex="0"><input type="file" id="aFile" accept=".xlsx,.xls,.csv,.pdf,application/pdf" multiple hidden>'
      + '<span class="a7dic">' + icon('upload', 34) + '</span><b>แตะเพื่อเลือกไฟล์ Excel หรือ PDF (เลือกได้หลายไฟล์)</b><span>หรือลากไฟล์มาวางตรงนี้ · ไฟล์ .xlsx (po_export) จากระบบ 7-11 หรือใบสั่งซื้อ PDF ของ CP ALL · หลายไฟล์จะรวมเป็นรอบเดียว</span></label>'
      + '<div id="aMsg"></div>'
      + (H.data.imports.length ? '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('clock', 18) + ' นำเข้าล่าสุด</h4>' + H.data.imports.slice(0, 5).map(impRow).join('') + '</div>' : '');
    var inp = $('aFile'), drop = $('aDrop');
    inp.addEventListener('change', function () { if (inp.files.length) readFiles(Array.prototype.slice.call(inp.files)); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var fs = Array.prototype.slice.call(e.dataTransfer.files || []); if (fs.length) readFiles(fs); });
    on('[data-imp]', 'click', function (el) { openImport(el.getAttribute('data-imp')); }, $('main'));
  }
  function impRow(x) {
    return '<button class="a7imp" data-imp="' + esc(x.id) + '"><span class="a7d"><b>ส่ง ' + thDate(x.deliveryDate) + '</b><small>สั่ง ' + thDate(x.poDate) + '</small></span>'
      + '<span class="a7f"><b>' + n0(x.cases) + ' ลัง</b><small>' + n0(x.poCount) + ' ใบสั่ง · ' + baht(x.amount) + ' · ' + esc(x.fileName || '') + '</small></span>'
      + (x.sentAt ? '<span class="a7tag ok">ส่ง LINE แล้ว</span>' : '<span class="a7tag">ยังไม่ส่ง LINE</span>') + '</button>';
  }
  // ลิงก์ดาวน์โหลดไฟล์ .xlsx ตรง ๆ (ไม่เปิดในหน้าแสดงตัวอย่างของ Drive / Google Sheets)
  function xlsxDl(u) { var m = String(u || '').match(/[-\w]{25,}/); return m ? 'https://drive.google.com/uc?export=download&id=' + m[0] : u; }
  function msg(html, kind) { var el = $('aMsg'); if (el) el.innerHTML = html ? '<div class="a7msg ' + (kind || '') + '">' + html + '</div>' : ''; }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = XLSX_URL; s.onload = ok; s.onerror = function () { fail(new Error('โหลดตัวอ่านไฟล์ Excel ไม่ได้ — ตรวจอินเทอร์เน็ต')); };
      document.head.appendChild(s);
    });
  }
  // อ่านไฟล์ po_export → รายการ (เฉพาะคอลัมน์ที่ใช้) — หาคอลัมน์จากชื่อหัวตาราง ไม่ยึดตำแหน่ง
  var COLS = { poNo: 'purchase order number', poDate: 'purchase order date', deliveryDate: 'delivery date', deliveryTime: 'delivery time',
    locCode: 'delivery location number', location: 'delivery location', termDays: 'term of payment', lineNo: 'line item number',
    barcode: 'item number (product code)', itemName: 'item name', itemCode: "buyer's internal product code", packSize: 'packing size',
    cases: 'ordered quantity', unit: 'unit type', freeQty: 'free quantity', casePrice: 'net case price', vatRate: 'vat rate' };
  function parseRows(aoa) {
    var hr = -1, head;
    for (var i = 0; i < Math.min(aoa.length, 10); i++) {
      head = aoa[i].map(function (h) { return String(h).replace(/\s+/g, ' ').trim().toLowerCase(); });
      if (head.indexOf('purchase order number') >= 0) { hr = i; break; }
    }
    if (hr < 0) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ใบสั่งซื้อ (po_export) จากระบบ 7-11 — ไม่พบคอลัมน์ "Purchase Order Number"');
    var idx = {};
    Object.keys(COLS).forEach(function (k) { idx[k] = head.indexOf(COLS[k]); });
    // "Total Amount" มี 2 คอลัมน์: ยอดทั้งใบ กับ ยอดของรายการ (อยู่หลัง Line Item Number) → ใช้ตัวหลัง
    idx.amount = -1;
    head.forEach(function (h, j) { if (h === 'total amount' && j > idx.lineNo) idx.amount = j; });
    var miss = ['poNo', 'location', 'cases'].concat(idx.itemCode < 0 ? ['itemName'] : []).filter(function (k) { return idx[k] < 0; });
    if (miss.length) throw new Error('ไฟล์ไม่มีคอลัมน์: ' + miss.map(function (k) { return COLS[k]; }).join(', '));
    var out = [];
    for (var r = hr + 1; r < aoa.length; r++) {
      var row = aoa[r], o = {};
      if (!String(row[idx.poNo] || '').trim()) continue;
      Object.keys(idx).forEach(function (k) {
        var v = idx[k] >= 0 ? row[idx[k]] : '';
        if (v instanceof Date) v = isoOf(v);
        o[k] = v == null ? '' : typeof v === 'number' ? v : String(v).trim();
      });
      o.poNo = String(o.poNo);
      out.push(o);
    }
    if (!out.length) throw new Error('ไม่พบรายการสั่งซื้อในไฟล์');
    return out;
  }
  // ---- ใบสั่งซื้อ CP ALL แบบ PDF (ผู้ใช้ขอ 24/11/69) — 1 หน้า = 1 ใบสั่งซื้อ (ใบเดียวหลายหน้าจะรวมกัน) → แถวรูปแบบเดียวกับไฟล์ po_export
  // อ่านตัวหนังสือจากชั้นข้อความของ PDF (pdf.js) แล้วจัดเป็นบรรทัดตามตำแหน่ง y
  function pdfRows(items) {
    var rows = [];
    items.filter(function (i) { return String(i.s).trim(); }).sort(function (a, b) { return b.y - a.y || a.x - b.x; }).forEach(function (i) {
      var r = null; for (var k = 0; k < rows.length; k++) if (Math.abs(rows[k].y - i.y) <= 2) { r = rows[k]; break; }
      if (!r) { r = { y: i.y, it: [] }; rows.push(r); }
      r.it.push(i);
    });
    rows.forEach(function (r) { r.it.sort(function (a, b) { return a.x - b.x; }); r.text = r.it.map(function (i) { return String(i.s).trim(); }).join(' ').replace(/\s+/g, ' '); });
    return rows;
  }
  var PO_NUM = /^-?[\d,]+(\.\d+)?$/;
  function poNum(s) { return Number(String(s).replace(/,/g, '')); }
  function parsePoPage(items) {
    var rows = pdfRows(items), all = rows.map(function (r) { return r.text; }).join('\n'), m;
    var po = { poNo: '', poDate: '', deliveryDate: '', deliveryTime: '', locCode: '', location: '', termDays: '', page: 1, pages: 1, lines: [], taxable: '', total: '' };
    if ((m = all.match(/เลขที่\s*:\s*(\d{6,15})/))) po.poNo = m[1];
    if ((m = all.match(/วันที่\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/))) po.poDate = m[1];
    if ((m = all.match(/กำหนดส่ง\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})(?:\s*เวลา\s*(\d{1,2}:\d{2}))?/))) { po.deliveryDate = m[1]; po.deliveryTime = m[2] || ''; }
    if ((m = all.match(/หน้าที่\s*:\s*(\d+)\s*\/\s*(\d+)/))) { po.page = +m[1]; po.pages = +m[2]; }
    if ((m = all.match(/เงื่อนไขการชำระเงิน\s*(\d+)\s*วัน/))) po.termDays = +m[1];
    rows.forEach(function (r) {
      var t = r.text;
      if ((m = t.match(/^นำส่ง\s*:\s*([A-Z]\d{2,5})\s+(.*?)(?:\s+อ้างถึง.*)?$/))) { po.locCode = m[1]; po.location = m[2].trim(); }
      if ((m = t.match(/มูลค่าสินค้าที่เสีย VAT\s*([\d,]+\.\d\d)/)) || (/มูลค่าสินค้าที่ไม่เสีย VAT/.test(t) && (m = t.match(/([\d,]+\.\d\d)\s+([\d,]+\.\d\d)\s+([\d,]+\.\d\d)\s*$/)))) po.taxable = poNum(m[1] && m[2] && m[3] ? m[2] : m[1]);
      if ((m = t.match(/จำนวนเงินที่ต้องชำระ\s*([\d,]+\.\d\d)/))) po.total = poNum(m[1]);
    });
    // รายการ: บรรทัดหลัก = ลำดับ · บาร์โค้ด · ชื่อสินค้า · ขนาดบรรจุ · จำนวนหีบ · แถม · ราคาต่อหีบ · ส่วนลด 4 ช่อง · จำนวนเงิน
    rows.forEach(function (r, i) {
      var it = r.it;
      if (it.length < 6 || !/^\d{1,3}$/.test(String(it[0].s).trim()) || !/^\d{8,14}$/.test(String(it[1].s).trim())) return;
      var name = [], nums = [];
      for (var k = 2; k < it.length; k++) { var s = String(it[k].s).trim(); if (PO_NUM.test(s) && (nums.length || it[k].x > 300)) nums.push(poNum(s)); else if (!nums.length) name.push(s); }
      if (nums.length < 5) return;
      var prev = rows[i - 1], next = rows[i + 1], code = '', tax = '', vat = '';
      if (prev && prev.y - r.y < 14) {
        var pm = prev.text.match(/^(\d{5,10})\s*\/\s*(INC|EXC|NON)?\s*([\d.]+)?/); if (pm) { code = pm[1]; tax = pm[2] || ''; vat = pm[3] ? Number(pm[3]) : ''; }
      }
      // ชื่อสินค้าต่อบรรทัดถัดไป (เช่น "G.") — บรรทัดที่มีแต่ข้อความในช่องรายการ
      if (next && r.y - next.y < 12 && next.it.every(function (x) { return x.x > 90 && x.x < 305; }) && !/^\d{5,10}\s*\//.test(next.text)) name.push(next.text);
      var nm = name.join(' ').replace(/\s+/g, ' ').replace(/^[@H]+(?=[^\x00-\x7F])/, '').trim();
      po.lines.push({ lineNo: +String(it[0].s).trim(), barcode: String(it[1].s).trim(), itemCode: code, itemName: nm, packSize: nums[0], cases: nums[1],
        freeQty: nums[2], casePrice: nums[3], amount: nums[nums.length - 1], vatRate: vat === '' ? 7 : vat, taxType: tax });
    });
    return po;
  }
  // หลายหน้า → ใบสั่งซื้อ (ใบเดียวกันหลายหน้ารวมกัน) → แถวแบบ po_export + ข้อตรวจ
  function poPdfToRows(pages) {
    var pos = [], by = {};
    pages.forEach(function (items, pi) {
      var p = parsePoPage(items); p.pageNo = pi + 1;
      if (!p.poNo) return;
      if (by[p.poNo]) { var o = by[p.poNo]; o.lines = o.lines.concat(p.lines); if (p.taxable !== '') o.taxable = p.taxable; if (p.total !== '') o.total = p.total; o.pageNos.push(pi + 1); return; }
      p.pageNos = [pi + 1]; by[p.poNo] = p; pos.push(p);
    });
    var rows = [], warn = [];
    pos.forEach(function (p) {
      if (!p.lines.length) warn.push('ใบสั่งซื้อ ' + p.poNo + ' (หน้า ' + p.pageNos.join(', ') + '): อ่านรายการสินค้าไม่ได้');
      var sum = p.lines.reduce(function (s, l) { return s + (Number(l.amount) || 0); }, 0);
      if (p.taxable !== '' && Math.abs(sum - p.taxable) > 0.05 * Math.max(1, p.lines.length)) warn.push('ใบสั่งซื้อ ' + p.poNo + ': ยอดรวมรายการ ' + sum.toFixed(2) + ' ไม่ตรงกับมูลค่าสินค้าในใบ ' + p.taxable.toFixed(2));
      p.lines.forEach(function (l) {
        if (!l.itemCode) warn.push('ใบสั่งซื้อ ' + p.poNo + ' รายการที่ ' + l.lineNo + ': ไม่พบรหัสสินค้า');
        rows.push({ poNo: p.poNo, poDate: p.poDate, deliveryDate: p.deliveryDate, deliveryTime: p.deliveryTime, locCode: p.locCode, location: p.location, termDays: p.termDays,
          lineNo: l.lineNo, barcode: l.barcode, itemName: l.itemName, itemCode: l.itemCode, packSize: l.packSize, cases: l.cases, unit: 'CT', freeQty: l.freeQty,
          casePrice: l.casePrice, vatRate: l.vatRate, amount: l.amount });
      });
    });
    return { rows: rows, pos: pos, warn: warn };
  }
  var PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = PDF_URL;
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; ok(); };
      s.onerror = function () { fail(new Error('โหลดตัวอ่าน PDF ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
      document.head.appendChild(s);
    });
  }
  function isPdf(f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; }
  function readPdf(file) {
    return file.arrayBuffer().then(function (buf) { return window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise; }).then(function (doc) {
      var pages = [], chain = Promise.resolve();
      for (var n = 1; n <= doc.numPages; n++) (function (n) {
        chain = chain.then(function () { return doc.getPage(n); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
          pages.push(tc.items.map(function (i) { return { s: i.str, x: i.transform[4], y: i.transform[5] }; }));
        });
      })(n);
      return chain.then(function () {
        var r = poPdfToRows(pages);
        if (!r.rows.length) throw new Error(file.name + ': ไม่พบรายการสั่งซื้อในไฟล์ PDF — ต้องเป็นใบสั่งซื้อ CP ALL ที่ดาวน์โหลดจากระบบ (ไม่ใช่ภาพสแกน)');
        var out = r.rows; out.pdf = { pos: r.pos.length, warn: r.warn.map(function (w) { return file.name + ': ' + w; }) };
        return out;
      });
    }, function () { throw new Error(file.name + ': เปิดไฟล์ PDF ไม่ได้'); });
  }
  // เลือกได้หลายไฟล์ (ผู้ใช้ขอ 20/11/69): อ่านทุกไฟล์แล้วรวมเป็นรอบเดียว · ใบสั่ง + ลำดับรายการเดียวกันที่ซ้ำกันระหว่างไฟล์นับครั้งเดียว
  function readOne(file) {
    if (isPdf(file)) return readPdf(file);
    return new Promise(function (ok, fail) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: true });
          var ws = wb.Sheets[wb.SheetNames[0]];
          ok(parseRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })));
        } catch (e) { fail(new Error(file.name + ': ' + e.message)); }
      };
      fr.onerror = function () { fail(new Error(file.name + ': อ่านไฟล์ไม่ได้')); };
      fr.readAsArrayBuffer(file);
    });
  }
  function readFiles(files) {
    msg('<span class="spinner dark"></span> กำลังอ่าน ' + (files.length > 1 ? files.length + ' ไฟล์' : 'ไฟล์ ' + esc(files[0].name)) + '…');
    var anyPdf = files.some(isPdf), anyX = files.some(function (f) { return !isPdf(f); });
    Promise.all([anyX ? loadXlsx() : null, anyPdf ? loadPdfJs() : null]).then(function () {
      return Promise.all(files.map(readOne));
    }).then(function (all) {
      var seen = {}, lines = [], dup = 0, pdfPos = 0, pdfWarn = [];
      all.forEach(function (ls) { if (ls.pdf) { pdfPos += ls.pdf.pos; pdfWarn = pdfWarn.concat(ls.pdf.warn); } });
      all.forEach(function (ls) { ls.forEach(function (l) { var k = String(l.poNo) + '|' + Number(l.lineNo); if (seen[k]) { dup++; return; } seen[k] = 1; lines.push(l); }); });
      H.imp = { fileName: files.map(function (f) { return f.name; }).join(', '), lines: lines, files: files.length, dupAcross: dup, pdfPos: pdfPos, pdfWarn: pdfWarn };
      msg('<span class="spinner dark"></span> อ่านได้ ' + lines.length + ' รายการ' + (files.length > 1 ? ' จาก ' + files.length + ' ไฟล์' + (dup ? ' (ตัดรายการซ้ำระหว่างไฟล์ ' + dup + ')' : '') : '') + ' — กำลังจัดเป็นตารางตามต้นแบบ…');
      return runPreview();
    }).catch(function (e) {
      if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
      msg('<b>นำเข้าไม่ได้</b><br>' + esc(e.message), 'bad');
      var f = $('aFile'); if (f) f.value = '';
    });
  }
  function runPreview() {
    return call('acc711Preview', state.token, H.imp.lines, H.imp.fileName).then(function (r) {
      H.imp.preview = r; H.data.map = r.map;
      if (state.page === 'a_imp') previewPage();
    });
  }

  // ---------- ขั้นที่ 2: ตรวจข้อมูล ----------
  function previewPage() {
    var I = H.imp, r = I.preview, m = r.matrix, map = r.map;
    var unLoc = r.unmatchedLocations, unItem = r.unmatchedItems, blockers = unLoc.length + unItem.length;
    var dup = r.lineCount - r.newLines;
    var checks = [];
    checks.push(chk(!unLoc.length, unLoc.length ? 'มี ' + unLoc.length + ' คลังที่ไม่ตรงกับชื่อศูนย์ในต้นแบบ — เลือกศูนย์ให้ด้านล่าง' : 'จับคู่ Delivery Location กับศูนย์กระจายสินค้าได้ครบทุกใบ'));
    checks.push(chk(!unItem.length, unItem.length ? 'มี ' + unItem.length + ' สินค้าที่ยังไม่มีคอลัมน์ในรายงาน — เลือกคอลัมน์ให้ด้านล่าง' : 'จับคู่สินค้าได้ครบทุกรายการ'));
    checks.push(dup ? (r.newLines ? chk('warn', dup + ' รายการเคยบันทึกแล้ว (ใบสั่ง ' + r.duplicatePos.slice(0, 4).join(', ') + (r.duplicatePos.length > 4 ? ' …' : '') + ') — จะบันทึกเฉพาะ ' + r.newLines + ' รายการใหม่')
      : chk(false, 'ไฟล์นี้บันทึกไปแล้วทั้งหมด — ไม่ต้องบันทึกซ้ำ')) : chk(true, 'ไม่มีใบสั่งซื้อซ้ำกับที่บันทึกไว้'));
    if (I.pdfPos) checks.push(I.pdfWarn && I.pdfWarn.length ? chk('warn', 'อ่านจาก PDF ' + I.pdfPos + ' ใบสั่งซื้อ — มีจุดที่ต้องตรวจ: ' + I.pdfWarn.slice(0, 3).join(' · ') + (I.pdfWarn.length > 3 ? ' …' : ''))
      : chk(true, 'อ่านจาก PDF ' + I.pdfPos + ' ใบสั่งซื้อ · ยอดเงินรวมรายการตรงกับมูลค่าสินค้าในใบทุกใบ'));
    if (I.files > 1) checks.push(chk(true, 'รวม ' + I.files + ' ไฟล์เป็นรอบเดียว' + (I.dupAcross ? ' · ตัดรายการที่ซ้ำกันระหว่างไฟล์ ' + I.dupAcross + ' รายการ' : '')));
    if (m.deliveryDates && m.deliveryDates.length > 1) checks.push(chk('warn', 'มีวันส่งหลายวัน (' + m.deliveryDates.map(thDate).join(', ') + ') — ถ้าต้องการแยกรายงานตามวันส่ง ให้นำเข้าทีละรอบ'));
    r.warnings.forEach(function (w) { checks.push(chk('warn', w)); });
    var canSave = !blockers && r.newLines > 0;
    var fix = '';
    if (unLoc.length) fix += '<div class="panel pbox a7fix"><h4>' + icon('warn', 18) + ' คลังที่จับคู่ไม่ได้</h4><p class="muted">เลือกศูนย์ในต้นแบบที่ตรงกัน ระบบจะจำรหัสคลังนี้ไว้ใช้ครั้งต่อไป</p>' + unLoc.map(function (u, i) {
      return '<div class="a7fixrow"><span><b>' + esc(u.locCode) + '</b> ' + esc(u.location) + ' <small>(' + n0(u.cases) + ' ลัง)</small></span><select data-fl="' + i + '"><option value="">— เลือกศูนย์ —</option>'
        + map.dcs.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</div>';
    if (unItem.length) fix += '<div class="panel pbox a7fix"><h4>' + icon('warn', 18) + ' สินค้าที่ยังไม่มีคอลัมน์</h4><p class="muted">เลือกคอลัมน์ที่ตรงกัน หรือเพิ่มเป็นคอลัมน์ใหม่ ระบบจะจำรหัสสินค้านี้ไว้</p>' + unItem.map(function (u, i) {
      return '<div class="a7fixrow"><span><b>' + esc(u.itemCode || '-') + '</b> ' + esc(u.itemName) + ' <small>(' + n0(u.cases) + ' ลัง)</small></span><select data-fi="' + i + '"><option value="">— เลือกคอลัมน์ —</option>'
        + map.products.map(function (p) { return '<option value="' + esc(p.key) + '">' + esc(pname(p)) + '</option>'; }).join('') + '<option value="__new">+ เพิ่มเป็นสินค้าใหม่</option></select></div>';
    }).join('') + '</div>';
    $('main').innerHTML = '<h3>ตรวจข้อมูลก่อนบันทึก</h3><p class="lead">ไฟล์ ' + esc(I.fileName) + ' · ' + r.lineCount + ' รายการ · ตรวจตัวเลขในตารางกับระบบ 7-11 แล้วกดบันทึก</p>'
      + steps(2)
      + '<div class="panel pbox a7checks"><h4>' + icon('check', 18) + ' ผลการตรวจไฟล์</h4>' + checks.join('') + '</div>'
      + fix + kpiRow(m)
      + reportHtml(map, m, r.lineCount + ' รายการจาก ' + m.poCount + ' ใบสั่งซื้อ')
      + '<p class="muted a7hint">แตะชื่อศูนย์เพื่อดูใบสั่งซื้อและสินค้าของศูนย์นั้น</p>'
      + '<div class="a7bar"><button class="btn btn-line" id="aBack">' + icon('back', 16) + ' เลือกไฟล์ใหม่</button>'
      + '<button class="btn btn-primary" id="aSave"' + (canSave ? '' : ' disabled') + '>' + icon('check', 18) + (canSave ? ' ข้อมูลถูกต้อง บันทึก ' + n0(r.newLines) + ' รายการ' : blockers ? ' จับคู่ให้ครบก่อนบันทึก' : ' บันทึกไปแล้ว') + '</button></div>';
    $('aBack').addEventListener('click', function () { H.imp = null; importPage(); });
    $('aSave').addEventListener('click', save);
    bindDc(map, I.lines, r.assign);
    on('[data-fl]', 'change', function (el) {
      if (!el.value) return;
      var u = unLoc[+el.getAttribute('data-fl')], cfg = clone(map);
      cfg.dcs.forEach(function (d) { if (d.name === el.value && u.locCode && d.codes.indexOf(u.locCode) < 0) d.codes.push(u.locCode); });
      saveMapThenPreview(cfg, 'จับคู่ ' + u.locCode + ' → ' + el.value);
    }, $('main'));
    on('[data-fi]', 'change', function (el) {
      if (!el.value) return;
      var u = unItem[+el.getAttribute('data-fi')], cfg = clone(map), key = el.value;
      if (key === '__new') {
        var n = cfg.products.reduce(function (mx, p) { var x = parseInt(String(p.key).replace(/\D/g, ''), 10) || 0; return Math.max(mx, x); }, 0) + 1;
        key = 'P' + pad(n);
        cfg.products.push({ key: key, l1: shortName(u.itemName), l2: '', color: '#E2E8F0', codes: [], keywords: [] });
      }
      cfg.products.forEach(function (p) {
        if (p.key !== key) return;
        if (u.itemCode) { if (p.codes.indexOf(u.itemCode) < 0) p.codes.push(u.itemCode); }
        else p.keywords.push(u.itemName);
      });
      saveMapThenPreview(cfg, el.value === '__new' ? 'เพิ่มคอลัมน์สินค้าใหม่แล้ว (แก้ชื่อ/สีได้ในหน้าตั้งค่า)' : 'จับคู่สินค้าแล้ว');
    }, $('main'));
  }
  function chk(ok, text) { var c = ok === 'warn' ? 'warn' : ok ? 'ok' : 'bad'; return '<div class="a7chk ' + c + '"><i>' + (c === 'ok' ? '✓' : c === 'warn' ? '!' : '✕') + '</i><span>' + esc(text) + '</span></div>'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function shortName(s) { return String(s || '').replace(/^H(?=[ก-๙])/, '').replace(/เอมโอชา.*$/, '').trim().slice(0, 30) || 'สินค้าใหม่'; }
  function saveMapThenPreview(cfg, done) {
    $('main').querySelectorAll('select').forEach(function (s) { s.disabled = true; });
    call('accSaveMap', state.token, JSON.stringify(cfg)).then(function (r) {
      if (!r.ok) { toast(r.error); return previewPage(); }
      H.data.map = r.map; toast(done);
      return runPreview();
    }).catch(onServerError);
  }
  // แตะศูนย์ → รายการใบสั่งซื้อ/สินค้าของศูนย์นั้น (ใช้ตรวจกับระบบ 7-11)
  function bindDc(map, lines, assign) {
    on('[data-dc]', 'click', function (el) { dcModal(map, lines, assign, el.getAttribute('data-dc')); }, $('main'));
    on('[data-dc]', 'keydown', function (el, e) { if (e.key === 'Enter') dcModal(map, lines, assign, el.getAttribute('data-dc')); }, $('main'));
  }
  function dcModal(map, lines, assign, dc) {
    var pos = {};
    lines.forEach(function (l, i) {
      var a = assign ? assign[i] : [l.dc, l.product];
      if (a[0] !== dc) return;
      var po = pos[l.poNo] = pos[l.poNo] || { poNo: l.poNo, deliveryDate: l.deliveryDate, location: l.location, items: [], cases: 0, amount: 0 };
      po.items.push({ p: product(map, a[1]), name: l.itemName, cases: Number(l.cases) || 0 });
      po.cases += Number(l.cases) || 0; po.amount += Number(l.amount) || 0;
    });
    var list = Object.keys(pos).map(function (k) { return pos[k]; });
    wide({ icon: 'table', title: 'ศูนย์ ' + dc, sub: list.length + ' ใบสั่งซื้อ · ' + n0(list.reduce(function (s, p) { return s + p.cases; }, 0)) + ' ลัง', noCancel: true, ok: 'ปิด',
      body: list.map(function (p) {
        return '<div class="a7po"><div class="a7poh"><b>PO ' + esc(p.poNo) + '</b><span>' + esc(p.location) + '</span><em>' + n0(p.cases) + ' ลัง · ' + baht(p.amount) + '</em></div>'
          + p.items.map(function (it) { return '<div class="a7poi"><i style="background:' + (it.p ? it.p.color : '#e2e8f0') + '"></i><span>' + esc(it.p ? pname(it.p) : it.name) + '<small>' + esc(it.name) + '</small></span><b>' + n0(it.cases) + '</b></div>'; }).join('') + '</div>';
      }).join('') });
  }

  // ---------- ขั้นที่ 3: บันทึก ----------
  function save() {
    var b = $('aSave'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังบันทึก…';
    call('acc711Save', state.token, H.imp.lines, H.imp.fileName).then(function (r) {
      if (!r.ok) { toast(r.error); b.disabled = false; b.textContent = 'ลองบันทึกอีกครั้ง'; return; }
      H.imp = null;
      toast('บันทึกแล้ว ' + r.saved + ' รายการ · ' + n0(r.cases) + ' ลัง');
      return H.load().then(function () { H.justSaved = r.importId; openImport(r.importId); });
    }).catch(function (e) { b.disabled = false; b.textContent = 'ลองบันทึกอีกครั้ง'; onServerError(e); });
  }

  // ==================== 2) รายงาน / ประวัติ ====================
  // เปิดรายงานของการนำเข้า (กดเมนูซ้ายอีกครั้ง = กลับไปหน้ารายการ)
  function openImport(id) { H.pendingCur = id; go('a_hist'); }
  function histPage() {
    if (H.pendingCur) { H.cur = H.pendingCur; H.pendingCur = null; return reportPage(H.cur); }
    H.cur = null;
    var list = H.data.imports;
    $('main').innerHTML = '<h3>รายงาน / ประวัติการนำเข้า</h3><p class="lead">แตะรายการเพื่อดูรายงาน พิมพ์ สร้าง PDF หรือส่ง LINE เข้ากลุ่ม · <a href="' + esc(H.data.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + (list.length ? '<div class="a7imps">' + list.map(impRow).join('') + '</div>'
        : '<div class="empty"><div class="icon">' + icon('table', 28) + '</div><h4>ยังไม่มีข้อมูล</h4><div>เริ่มจากเมนู "นำเข้าไฟล์ออเดอร์ 7-11"</div></div>');
    on('[data-imp]', 'click', function (el) { openImport(el.getAttribute('data-imp')); }, $('main'));
  }
  function impOf(id) { return H.data.imports.filter(function (x) { return x.id === id; })[0]; }
  function reportPage(id) {
    var x = impOf(id);
    if (!x) { H.cur = null; return histPage(); }
    landscape(true);
    var fresh = H.justSaved === id; H.justSaved = null;
    $('main').innerHTML = '<h3>' + (fresh ? 'บันทึกเรียบร้อย ✅' : 'รายงานออเดอร์ 7-11') + '</h3>'
      + '<p class="lead noprint">' + (fresh ? 'ตรวจรายงานอีกครั้ง แล้วกด "ส่ง LINE เข้ากลุ่ม" · ' : '') + esc(x.fileName || '') + ' · นำเข้าเมื่อ ' + esc(String(x.createdAt).replace(/^'/, '')) + '</p>'
      + (fresh ? steps(3) : '')
      + '<div class="a7acts noprint"><button class="btn btn-line btn-sm" id="aList">' + icon('back', 16) + ' รายการทั้งหมด</button>'
      + '<span class="a7sp"></span>'
      + '<button class="btn btn-line btn-sm" id="aPrint">' + icon('print', 16) + ' พิมพ์</button>'
      + '<button class="btn btn-line btn-sm" id="aPdf">' + icon('pdf', 16) + (x.pdfUrl && x.xlsxUrl ? ' เปิด PDF' : x.pdfUrl ? ' สร้าง PDF / Excel ใหม่ (ใส่รูปสินค้า)' : ' สร้าง PDF / Excel') + '</button>'
      + '<button class="btn btn-primary btn-sm a7line" id="aLine">' + icon('send', 16) + (x.sentAt ? ' ส่ง LINE อีกครั้ง' : ' ส่ง LINE เข้ากลุ่ม') + '</button></div>'
      + '<div class="a7status noprint">' + (x.sentAt ? '<span class="a7tag ok">ส่ง LINE แล้ว ' + esc(x.sentAt) + '</span>' : '<span class="a7tag">ยังไม่ได้ส่ง LINE</span>')
      + (x.xlsxUrl ? ' <a class="flink" href="' + esc(xlsxDl(x.xlsxUrl)) + '" target="_blank" rel="noopener" download>' + icon('sheet', 14) + ' ดาวน์โหลด Excel (.xlsx)</a>' : '')
      + (x.sheetUrl ? ' <a class="flink" href="' + esc(x.sheetUrl) + '" target="_blank" rel="noopener">' + icon('sheet', 14) + ' Google Sheet</a>' : '')
      + (x.pdfUrl && x.xlsxUrl ? ' <button type="button" class="flink" id="aRebuild" title="สร้างไฟล์ใหม่จากข้อมูลและการตั้งค่าล่าสุด (ไฟล์เดิมย้ายลงถังขยะ)">↻ สร้างไฟล์ใหม่</button>' : '') + '</div>'
      + '<div id="aRep"><div class="panel"><span class="spinner dark"></span> กำลังโหลดรายงาน…</div></div>'
      + '<div class="noprint a7del"><button class="link-btn danger" id="aDel">' + icon('trash', 14) + ' ลบการนำเข้านี้ (นำเข้าผิดไฟล์)</button></div>';
    $('aList').addEventListener('click', function () { landscape(false); histPage(); });
    $('aPrint').addEventListener('click', function () { window.print(); });
    $('aPdf').addEventListener('click', function () { x.pdfUrl && x.xlsxUrl ? window.open(x.pdfUrl, '_blank', 'noopener') : makePdf(x); });
    if ($('aRebuild')) $('aRebuild').addEventListener('click', function () { this.disabled = true; makePdf(x); });
    $('aLine').addEventListener('click', function () { lineConfirm(x); });
    $('aDel').addEventListener('click', function () { delImport(x); });
    var my = H.rseq = (H.rseq || 0) + 1;
    call('acc711Report', state.token, { importId: id }).then(function (r) {
      if (my !== H.rseq || state.page !== 'a_hist') return;
      if (!r.ok) { $('aRep').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
      H.rep = r;
      $('aRep').innerHTML = '<div class="noprint">' + kpiRow(r.matrix) + '</div>' + reportHtml(r.map, r.matrix, n0(r.matrix.poCount) + ' ใบสั่งซื้อ')
        + '<p class="muted a7hint">แตะชื่อศูนย์เพื่อดูใบสั่งซื้อและสินค้าของศูนย์นั้น</p>';
      bindDc(r.map, r.lines, null);
    }).catch(onServerError);
  }
  function makePdf(x) {
    var b = $('aPdf'); b.disabled = true; b.innerHTML = '<span class="spinner dark"></span> กำลังสร้าง PDF / Excel…';
    call('acc711Pdf', state.token, x.id).then(function (r) {
      if (!r.ok) { toast(r.error); b.disabled = false; b.textContent = 'สร้าง PDF'; return; }
      x.pdfUrl = r.pdfUrl; x.sheetUrl = r.sheetUrl; x.xlsxUrl = r.xlsxUrl;
      toast('สร้าง PDF / Excel แล้ว — กดเปิดได้เลย'); reportPage(x.id);
    }).catch(function (e) { b.disabled = false; b.textContent = 'สร้าง PDF'; onServerError(e); });
  }
  // ---------- ภาพตารางสีสำหรับ LINE (สร้างในเบราว์เซอร์ด้วย html2canvas) ----------
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  function dot(iso) { if (!iso) return '-'; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + String(+p[0] + 543).slice(2); }
  function dotRange(l) { return !l || !l.length ? '-' : l.length === 1 ? dot(l[0]) : dot(l[0]) + ' – ' + dot(l[l.length - 1]); }
  function delivText(l) { if (!l || !l.length) return '-'; if (l.length > 1) return dotRange(l); var p = l[0].split('-'); return 'วัน' + DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] + ' ที่ ' + dot(l[0]); }
  // ตารางสำหรับภาพ: กว้าง 1080px ศูนย์ละ 1 แถว ตัวเลขใหญ่ อ่านบนมือถือได้
  H.lineImageHtml = function (map, m) {
    var P = map.products;
    var hc = function (p) { return 'background:' + p.color + ';color:' + ink(p.color); };
    var dcN = m.dcs.filter(function (d) { return d.cases; }).length;
    return '<div class="a7img"><div class="a7ih"><div><b>ออเดอร์ 7-Eleven · CP ALL</b><span>บริษัท สปังกี้ ฟู้ด จำกัด</span></div>'
      + '<div class="a7ir"><span>รอบวันที่ <b>' + dotRange(m.poDates) + '</b></span><span>ส่ง <b>' + delivText(m.deliveryDates) + '</b></span></div></div>'
      + '<table><thead><tr><th class="dc" rowspan="2">ศูนย์กระจายสินค้า</th>' + P.map(function (p) { return '<th' + (p.l2 ? '' : ' rowspan="2"') + ' style="' + hc(p) + '">' + esc(p.l1) + '</th>'; }).join('') + '<th class="tt" rowspan="2">รวม<br>(ลัง)</th></tr>'
      + '<tr>' + P.filter(function (p) { return p.l2; }).map(function (p) { return '<th style="' + hc(p) + '">' + esc(p.l2) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + m.dcs.map(function (d) {
        return '<tr' + (d.cases ? '' : ' class="no"') + '><td class="dc">' + esc(d.name) + '</td>' + P.map(function (p) { var v = d.cells[p.key]; return '<td' + (v ? ' style="' + hc(p) + '"' : '') + '>' + (v ? n0(v) : '') + '</td>'; }).join('') + '<td class="tt">' + (d.cases ? n0(d.cases) : '') + '</td></tr>';
      }).join('')
      + '</tbody><tfoot><tr><td class="dc">รวม</td>' + P.map(function (p) { return '<td style="' + hc(p) + '">' + n0(m.byProduct[p.key] || 0) + '</td>'; }).join('') + '<td class="tt">' + n0(m.cases) + '</td></tr></tfoot></table>'
      + '<div class="a7if"><span>' + m.poCount + ' ใบสั่งซื้อ · ' + dcN + ' ศูนย์</span><b>สินค้าจำนวน ' + n0(m.cases) + ' ลัง</b></div></div>';
  };
  function loadScript(url, ok) { if (ok()) return Promise.resolve(); return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = function () { rej(new Error('โหลดตัวสร้างภาพไม่ได้')); }; document.head.appendChild(s); }); }
  // รอรูปสินค้าโหลดเสร็จก่อนจับภาพ (รูปที่โหลดไม่ได้จะเว้นว่าง ไม่ทำให้ส่งไม่ได้)
  function imgsReady(el) {
    return Promise.all([].map.call(el.querySelectorAll('img'), function (im) {
      return im.complete ? null : new Promise(function (res) { im.onload = im.onerror = res; setTimeout(res, 8000); });
    }));
  }
  function makeLineImage(map, m) {
    return loadScript(H2C_URL, function () { return !!window.html2canvas; }).then(function () { return document.fonts ? document.fonts.ready : null; }).then(function () {
      // ภาพ = รายงานแบบเดียวกับที่เห็นในระบบ (ต้นแบบรับออเดอร์) ความกว้างคงที่ 1200px
      // ตัดสินค้าที่ไม่มีออเดอร์ (รวม 0 ลัง) และศูนย์ที่ไม่มีออเดอร์ออกจากภาพ LINE (ผู้ใช้ขอ 23/11/69) — หน้าจอ / PDF / Excel ยังครบทุกคอลัมน์
      // สินค้าแสดงครบทุกตัวแม้ไม่มีออเดอร์ (ผู้ใช้ขอ 24/11/69) · ศูนย์ที่ไม่มีออเดอร์ยังตัดออก
      var dz = m.dcs.filter(function (d) { return d.cases; });
      var mapL = mainOrOrdered(map, m), mL = dz.length ? Object.assign({}, m, { dcs: dz }) : m;
      var box = document.createElement('div'); box.className = 'a7imgbox'; box.innerHTML = '<div class="a7imgrep">' + reportHtml(mapL, mL, n0(m.poCount) + ' ใบสั่งซื้อ') + '</div>'; document.body.appendChild(box);
      var el = box.firstChild;
      return imgsReady(el).then(function () { return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }); }).then(function (cv) {
        document.body.removeChild(box);
        var url = cv.toDataURL('image/png');
        return { url: url, png: url.split(',')[1], ratio: cv.width + ':' + cv.height };
      }, function (e) { document.body.removeChild(box); throw e; });
    });
  }
  // หน้าตาการ์ด LINE (ตรงกับ accFlex_ ใน Acc.gs)
  function cardHtml(m, img, hasPdf) {
    var dcN = m.dcs.filter(function (d) { return d.cases; }).length;
    var row = function (a, b) { return '<div class="a7lr"><span>' + a + '</span><b>' + b + '</b></div>'; };
    return '<div class="a7lc"><div class="a7lh"><small>ORDER CONFIRMATION · 7-ELEVEN</small><b>ใบแจ้งออเดอร์ CP ALL</b><span>บริษัท สปังกี้ ฟู้ด จำกัด · ฝ่ายบัญชี</span></div>'
      + '<div class="a7lb">' + row('ออเดอร์ รอบวันที่', dotRange(m.poDates)) + row('ลูกค้า', 'CP ALL (7-Eleven)') + row('วันที่ส่งสินค้า', delivText(m.deliveryDates)) + row('ใบสั่งซื้อ', m.poCount + ' ใบ · ' + dcN + ' ศูนย์')
      + '<div class="a7ltot"><span>สินค้าจำนวนรวม</span><b>' + n0(m.cases) + ' ลัง</b></div><small class="a7lnote">📊 ตารางออเดอร์แยกศูนย์ / สินค้า อยู่ในข้อความถัดไป (กดที่ภาพเพื่อเปิดภาพเต็ม)</small></div>'
      + '<div class="a7lf"><div class="p">เปิดรายงาน PDF</div><div class="x">ดาวน์โหลดไฟล์ Excel</div></div></div>'
      + '<div class="a7limg">' + (img ? '<img src="' + img + '" alt="ตารางออเดอร์">' : '<div class="a7lwait"><span class="spinner dark"></span> กำลังสร้างภาพตาราง…</div>') + '</div>';
  }
  H.cardHtml = cardHtml;
  // ยืนยันก่อนส่ง: แสดงหน้าตาข้อความที่จะเข้ากลุ่ม (พร้อมภาพตารางจริง)
  function lineConfirm(x) {
    var L = H.data.line;
    if (!L.token || !L.group) {
      wide({ icon: 'send', title: 'ยังส่ง LINE ไม่ได้', noCancel: true, ok: 'เข้าใจแล้ว',
        body: '<p>ตั้งค่า LINE OA ฝ่ายบัญชีให้ครบก่อน (เมนู "ตั้งค่าศูนย์ / สินค้า / LINE")</p><ul class="a7ul">'
          + '<li>Channel access token (<code>ACC_LINE_TOKEN</code>) ' + (L.token ? '✅ ใส่แล้ว' : '❌ ยังไม่มี') + '</li>'
          + '<li>กลุ่ม LINE ที่รับรายงาน ' + (L.group ? '✅ ผูกแล้ว' : '❌ ยังไม่ได้ผูก') + '</li></ul>' });
      return;
    }
    var m = H.rep && H.rep.matrix; if (!m) return;
    var img = null;
    wide({ icon: 'send', title: x.sentAt ? 'ส่ง LINE อีกครั้ง?' : 'ส่งรายงานเข้ากลุ่ม LINE', sub: 'ข้อความนี้จะส่งเข้ากลุ่มทันที' + (x.sentAt ? ' (เคยส่งแล้วเมื่อ ' + x.sentAt + ')' : ''),
      ok: 'ส่งเข้ากลุ่มเลย', body: '<div class="a7prev" id="aCard">' + cardHtml(m, null) + '</div><p class="muted">ส่ง 2 ข้อความ: การ์ดสรุป + การ์ดภาพตาราง (กว้างเท่าการ์ดสรุป กดภาพเพื่อเปิดภาพเต็ม)' + (x.pdfUrl && x.xlsxUrl ? '' : ' · ระบบจะสร้าง PDF / Excel ให้ก่อนส่ง (ใช้เวลาสักครู่)') + '</p>',
      onOpen: function () {
        $('mOk').disabled = true;
        makeLineImage(H.rep.map, m).then(function (r) { img = r; var c = $('aCard'); if (c) c.innerHTML = cardHtml(m, r.url); $('mOk').disabled = false; },
          function (e) { var c = $('aCard'); if (c) c.innerHTML = cardHtml(m, null).replace(/<div class="a7lwait">[\s\S]*?<\/div>/, '<div class="a7lwait">สร้างภาพไม่ได้ (' + esc(e.message) + ') — ส่งได้แบบไม่มีภาพ</div>'); $('mOk').disabled = false; });
      },
      submit: function () {
        return call('acc711SendLine', state.token, x.id, img ? img.png : '', img ? img.ratio : '').then(function (r) {
          if (!r.ok) return r.error;
          closeModal(); x.sentAt = r.sentAt; x.pdfUrl = r.pdfUrl; x.sheetUrl = r.sheetUrl; x.xlsxUrl = r.xlsxUrl;
          toast('ส่ง LINE เข้ากลุ่มแล้ว ✅');
          H.load().then(function () { if (state.page === 'a_hist' && H.cur === x.id) reportPage(x.id); }).catch(onServerError);
        });
      } });
  }
  function delImport(x) {
    openModal({ color: '#dc2626', icon: 'warn', title: 'ลบการนำเข้านี้?', body: '<p>ลบข้อมูลออเดอร์ ' + n0(x.lineCount) + ' รายการ (' + n0(x.cases) + ' ลัง) จากไฟล์ ' + esc(x.fileName || '') + ' ออกจากระบบ — Dashboard จะไม่นับรายการเหล่านี้</p><p class="muted">ใช้เมื่อนำเข้าผิดไฟล์ แล้วนำเข้าไฟล์ที่ถูกต้องใหม่</p>',
      ok: 'ลบ', submit: function () {
        return call('acc711DeleteImport', state.token, x.id).then(function (r) {
          if (!r.ok) return r.error;
          closeModal(); H.cur = null; reload('ลบแล้ว');
        });
      } });
  }

  // ==================== 3) Dashboard ====================
  function fresh(at) { return at && Date.now() - at < 5 * 60 * 1000; }
  function bkkToday() { var d = new Date(Date.now() + 7 * 3600 * 1000); return d.toISOString().slice(0, 10); }
  function dcList() { return (H.data && H.data.map && H.data.map.dcs) || H.dashDcs || []; }
  function fillDcs() {   // เติมรายชื่อศูนย์ในตัวกรอง เมื่อข้อมูลหลักโหลดเสร็จทีหลัง
    var sel = $('dDc'); if (!sel || sel.options.length > 1) return;
    dcList().forEach(function (d) { var o = document.createElement('option'); o.textContent = d.name; if (H.q.dc === d.name) o.selected = true; sel.appendChild(o); });
  }
  function dash() {
    var t = (H.data && H.data.today) || bkkToday(), q = H.q;
    if (!q.from) { q.from = t.slice(0, 8) + '01'; q.to = monthEnd(t); q.basis = 'po'; q.dc = ''; }
    var lm = addDays(t.slice(0, 8) + '01', -1);
    var quick = [['7 วัน', addDays(t, -6), t], ['เดือนนี้', t.slice(0, 8) + '01', monthEnd(t)], ['เดือนก่อน', lm.slice(0, 8) + '01', lm], ['3 เดือน', addDays(t.slice(0, 8) + '01', -61).slice(0, 8) + '01', monthEnd(t)], ['ปีนี้', t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31']];
    $('main').innerHTML = '<h3>Dashboard ฝ่ายบัญชี</h3><p class="lead">รับ (เงินเข้า): ยอดสั่งซื้อทุกบริษัท + ออเดอร์ 7-11 · จ่าย (เงินออก): ค่าใช้จ่ายตามรอบจ่าย — <a href="javascript:void 0" class="a7jump" onclick="document.getElementById(\'apDashBoxH\').scrollIntoView({behavior:\'smooth\'})">ไปส่วนการจ่าย ↓</a></p>'
      + '<div class="a7band in">⬇ รับ (เงินเข้า)</div>'
      + '<h4 class="a7h4">' + icon('chart', 18) + ' ออเดอร์ 7-11 ตามช่วงวันที่</h4>'
      + '<div class="pbar noprint a7filter"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<label class="a7lb">ตั้งแต่ <input type="date" id="dFrom" value="' + q.from + '"></label><label class="a7lb">ถึง <input type="date" id="dTo" value="' + q.to + '"></label>'
      + '<select id="dBasis" aria-label="นับตามวันที่"><option value="po"' + (q.basis === 'po' ? ' selected' : '') + '>ตามวันที่สั่ง</option><option value="delivery"' + (q.basis === 'delivery' ? ' selected' : '') + '>ตามวันที่ส่ง</option></select>'
      + '<select id="dDc" aria-label="ศูนย์กระจายสินค้า"><option value="">ทุกศูนย์</option>' + dcList().map(function (d) { return '<option' + (q.dc === d.name ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select>'
      + '<button class="btn btn-sm btn-line" id="dPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div id="dOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>'
      + '<div class="panel pbox a7cmp" id="cmpBox" style="margin-top:16px"><h4>' + icon('chart', 18) + ' เปรียบเทียบยอดสั่งซื้อ แยกบริษัท / สินค้า</h4><div id="cmpOut"><span class="spinner dark"></span> กำลังคำนวณ…</div></div>'
      + '<h4 class="a7h4">' + icon('table', 18) + ' สรุปรายเดือน ทุกบริษัท</h4><div id="dMon"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>'
      + '<div class="a7band out" id="apDashBoxH">⬆ จ่าย (เงินออก)</div><div id="apDashBox"><div class="panel"><span class="spinner dark"></span> กำลังโหลดค่าใช้จ่าย…</div></div>';
    // สรุปรายเดือนทุกบริษัท ต่อท้ายส่วนรับ ก่อนส่วนจ่าย (ผู้ใช้ขอ 22/11/69) — ใช้ข้อมูลชุดเดียวกับหน้า "รายงานสรุปรายเดือน"
    var monLoad = function (force) {
      var box = $('dMon'); if (!box) return;
      if (H.mon && !force) return H.mountMonthly(box, H.mon, function () { H.mon = null; box.innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div>'; monLoad(true); });
      call('accMonthly', state.token).then(function (r) { if (!r.ok) throw new Error(r.error); H.mon = r; H.monAt = Date.now(); if ($('dMon') === box) monLoad(); })
        .catch(function (e) { if (box.isConnected) box.innerHTML = '<div class="panel">สรุปรายเดือนไม่ได้: ' + esc(e.message || e) + '</div>'; });
    };
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['dFrom', 'dTo'].forEach(function (id) { $(id).addEventListener('change', function () {
      var f = $('dFrom').value, to = $('dTo').value;
      if (!f || !to || f > to) return toast('เลือกช่วงวันที่ให้ถูกต้อง');
      q.from = f; q.to = to; dash();
    }); });
    $('dBasis').addEventListener('change', function () { q.basis = this.value; dash(); });
    $('dDc').addEventListener('change', function () { q.dc = this.value; dash(); });
    $('dPrint').addEventListener('click', function () { window.print(); });
    // เรียกข้อมูลเรียงจากบนลงล่าง (ส่วนบนขึ้นก่อน) · ผลแต่ละช่วงวันที่เก็บไว้ 5 นาที
    var my = H.dseq = (H.dseq || 0) + 1, key = [q.from, q.to, q.basis, q.dc].join('|');
    var show = function (r) {
      if (my !== H.dseq || state.page !== 'a_dash') return;
      if (!r.ok) { $('dOut').innerHTML = '<div class="panel">' + esc(r.error) + '</div>'; return; }
      if (r.map && r.map.dcs && !H.dashDcs) { H.dashDcs = r.map.dcs; fillDcs(); }
      $('dOut').innerHTML = H.dashHtml(r, true);
      on('[data-dcf]', 'click', function (el) { q.dc = el.getAttribute('data-dcf'); dash(); }, $('dOut'));
    };
    H.dcache = H.dcache || {};
    var hit = H.dcache[key];
    if (hit && fresh(hit.at)) show(hit.r);
    else call('accDashboard', state.token, { from: q.from, to: q.to, basis: q.basis, dc: q.dc }).then(function (r) { if (r.ok) H.dcache[key] = { r: r, at: Date.now() }; show(r); }).catch(onServerError);
    cmpLoad();
    monLoad();
    if (window.ACCAP && window.ACCAP.mountInto) window.ACCAP.mountInto($('apDashBox'));
  }
  // ---------- เปรียบเทียบยอดสั่งซื้อ (ครั้งล่าสุด vs ครั้งก่อน · เดือนล่าสุด vs เดือนก่อน) แยกบริษัท — accCompare (AccCompare.gs) ----------
  function cmpLoad(force) {
    if (H.cmp && !force) return cmpRender();
    call('accCompare', state.token).then(function (r) {
      if (!r.ok) { if ($('cmpOut')) $('cmpOut').innerHTML = esc(r.error || 'คำนวณไม่ได้'); return; }
      H.cmp = r; H.cmpAt = Date.now(); cmpRender();
    }).catch(onServerError);
  }
  function monthTh(ym) { if (!ym) return '-'; var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(2); }
  function cmpRender() { var box = $('cmpOut'); if (box && H.cmp) H.mountCmp(box, H.cmp, function () { box.innerHTML = '<span class="spinner dark"></span> กำลังคำนวณ…'; cmpLoad(true); }); }
  // ใช้ร่วมกับหน้า Dashboard ผู้บริหาร (executive.js): วาดลงกล่อง box + ผูกปุ่มเลือกบริษัท · reload = ปุ่มคำนวณใหม่ (ไม่ส่ง = ไม่มีปุ่ม)
  H.mountCmp = function (box, data, reload) {
    var cs = (data.companies || []).filter(function (c) { return c.error || c.count; });
    if (!cs.length) { box.innerHTML = '<p class="muted">ยังไม่มีข้อมูลออเดอร์</p>'; return; }
    var sel = box.getAttribute('data-sel') || H.cmpSel;
    if (!sel || !cs.some(function (c) { return c.key === sel; })) sel = cs[0].key;
    var c = cs.filter(function (x) { return x.key === sel; })[0];
    var money = function (v) { var n = Number(v || 0); return c.currency === 'บาท' ? '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };   // สกุลอื่นบอกไว้ที่หัวตาราง
    var qty = function (v) { return Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + (c.unit ? ' ' + c.unit : ''); };
    var diff = function (now, before, fmt) {
      var d = Math.round((now - before) * 100) / 100;
      if (!d) return '<span class="cmz">เท่าเดิม</span>';
      var pc = before ? ' (' + (d > 0 ? '+' : '') + Math.round(d / before * 100) + '%)' : ' (ใหม่)';
      return '<span class="' + (d > 0 ? 'cmu' : 'cmd') + '">' + (d > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(d)) + pc + '</span>';
    };
    var cell = function (q, a) { return '<b>' + qty(q) + '</b><small>' + money(a) + '</small>'; };
    var table = function (k, prevL, lastL) {
      if (!c.products.some(function (p) { return p[k][0] || p[k][2]; })) return '<p class="muted">ไม่มีข้อมูล</p>';
      var row = function (name, color, a, cls) {
        return '<tr class="' + (cls || '') + '"><td class="cmn">' + (color ? '<i class="a7sw" style="background:' + color + '"></i>' : '') + esc(name) + '</td><td>' + cell(a[0], a[1]) + '</td><td>' + cell(a[2], a[3]) + '</td>'
          + '<td><b>' + diff(a[2], a[0], qty) + '</b><small>' + diff(a[3], a[1], money) + '</small></td></tr>';
      };
      return '<div class="cpwrap"><table class="cptab cmtab"><thead><tr><th>สินค้า</th><th>' + prevL + '</th><th>' + lastL + '</th><th>เปลี่ยนแปลง</th></tr></thead><tbody>'
        + c.products.filter(function (p) { return p[k][0] || p[k][2]; }).map(function (p) { return row(p.name, p.color, p[k]); }).join('')
        + '</tbody><tfoot>' + row('รวม', '', c.total[k], 'cmt') + '</tfoot></table></div>';
    };
    var sec = function (k, no, title, sub, body) {
      return '<section class="cmsec ' + k + '"><div class="cmsh"><span class="cmno">' + no + '</span><div><b>' + title + '</b><small>' + sub + '</small></div></div><div class="cmsb">' + body + '</div></section>';
    };
    box.innerHTML = '<div class="pchips cmchips">' + cs.map(function (x) { return '<button class="chip' + (x.key === c.key ? ' on' : '') + '" data-cmp="' + esc(x.key) + '">' + esc(x.name) + '</button>'; }).join('')
      + (reload ? '<button class="btn btn-sm btn-line noprint" data-cmpre="1">↻ คำนวณใหม่</button>' : '') + '</div>'
      + (c.error ? '<p class="muted">' + esc(c.error) + '</p>' : '<p class="muted cmnote">นับ' + esc(c.basis) + ' · ' + esc(c.note) + (c.currency !== 'บาท' ? ' · ยอดเงินเป็น ' + esc(c.currency) : '') + '</p>'
        + sec('r', '①', 'ครั้งล่าสุด เทียบครั้งก่อน', 'รอบ ' + (c.round.last ? thDate(c.round.last) : '-') + ' เทียบกับ ' + (c.round.prev ? thDate(c.round.prev) : '-'),
          table('r', 'ครั้งก่อน<small>' + (c.round.prev ? thDate(c.round.prev) : '-') + '</small>', 'ครั้งล่าสุด<small>' + (c.round.last ? thDate(c.round.last) : '-') + '</small>'))
        + sec('m', '②', 'เดือนล่าสุด เทียบเดือนก่อน', 'ยอดทั้งเดือน ' + monthTh(c.month.last) + ' เทียบกับ ' + monthTh(c.month.prev),
          table('m', 'เดือนก่อน<small>' + monthTh(c.month.prev) + '</small>', 'เดือนล่าสุด<small>' + monthTh(c.month.last) + '</small>')));
    on('[data-cmp]', 'click', function (el) { var k = el.getAttribute('data-cmp'); box.setAttribute('data-sel', k); if (reload) H.cmpSel = k; H.mountCmp(box, data, reload); }, box);
    on('[data-cmpre]', 'click', function () { reload(); }, box);
  };
  // ---------- รายงานสรุปรายเดือน ทุกบริษัท (accMonthly ใน AccCompare.gs) ----------
  function monthly() {
    if (!H.mon) {
      $('main').innerHTML = '<h3>รายงานสรุปรายเดือน (ทุกบริษัท)</h3><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div>';
      call('accMonthly', state.token).then(function (r) { if (!r.ok) throw new Error(r.error); H.mon = r; if (state.page === 'a_mon') monthly(); }).catch(onServerError);
      return;
    }
    var box = $('main');
    box.innerHTML = '<h3>รายงานสรุปรายเดือน (ทุกบริษัท)</h3><p class="lead">ยอดสั่งซื้อทุกเดือนของแต่ละบริษัท · จำนวน / ยอดเงิน (ไม่รวม VAT) / จำนวนใบสั่ง · ไม่นับรายการที่ยกเลิก</p><div id="monOut"></div>';
    H.mountMonthly($('monOut'), H.mon, function () { H.mon = null; monthly(); });
  }
  // ใช้ร่วมกับหน้า Dashboard ผู้บริหาร: วาดสรุปรายเดือนลง box + ผูกปุ่มเลือกปี
  H.mountMonthly = function (box, r, reload) {
    var cs = (r.companies || []).filter(function (c) { return c.error || Object.keys(c.months || {}).length; });
    var all = {}; cs.forEach(function (c) { Object.keys(c.months || {}).forEach(function (k) { all[k] = 1; }); });
    var yms = Object.keys(all).sort(), years = []; yms.forEach(function (k) { var y = k.slice(0, 4); if (years.indexOf(y) < 0) years.push(y); });
    var Y = box.getAttribute('data-y') || (reload ? H.monY : '');
    if (!Y || (Y !== 'all' && years.indexOf(Y) < 0)) Y = years.indexOf(r.today.slice(0, 4)) >= 0 ? r.today.slice(0, 4) : (years[years.length - 1] || 'all');
    var list = Y === 'all' ? yms : ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(function (m) { return Y + '-' + m; });
    var cur = r.today.slice(0, 7);
    var mny = function (c, v) { var n = Number(v || 0); return c.currency === 'บาท' ? '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var qn = function (c, v) { return Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + (c.unit ? ' ' + c.unit : ''); };
    var cell = function (c, q, a, extra) { return (q || a) ? '<b>' + qn(c, q) + '</b><small>' + mny(c, a) + (extra || '') + '</small>' : '<span class="muted">–</span>'; };
    var cname = function (c) { return esc(c.name) + (c.currency !== 'บาท' && c.currency ? ' <small>(' + esc(c.currency) + ')</small>' : ''); };
    var ok = cs.filter(function (c) { return !c.error; }), thb = ok.filter(function (c) { return c.currency === 'บาท'; });
    // ตาราง 1: เดือน × บริษัท
    var tot = {}; ok.forEach(function (c) { tot[c.key] = [0, 0, 0]; }); var gt = [0, 0];
    var rows = list.map(function (ym) {
      var tq = 0, ta = 0, fut = ym > cur;
      var tds = ok.map(function (c) {
        var x = c.months[ym]; if (!x) return '<td><span class="muted">–</span></td>';
        tot[c.key][0] += x.qty; tot[c.key][1] += x.amt; tot[c.key][2] += x.docs;
        if (c.currency === 'บาท') { tq += x.qty; ta += x.amt; }
        return '<td>' + cell(c, x.qty, x.amt, ' · ' + x.docs + (c.export ? ' ใบ' : ' PO')) + '</td>';   // ไม่ใส่ป้าย "ตามกำหนดส่ง" ในช่อง (มีคำอธิบายด้านบนตารางแล้ว · ผู้ใช้ขอ 22/11/69)
      }).join('');
      gt[0] += tq; gt[1] += ta;
      return '<tr><td class="cmn"><b>' + monthTh(ym) + '</b></td>' + tds + '<td class="mtot">' + (ta || tq ? '<b>' + n0(tq) + ' ลัง</b><small>' + baht(ta) + '</small>' : '<span class="muted">–</span>') + '</td></tr>';
    }).join('');
    var t1 = '<div class="cpwrap"><table class="cptab cmtab mtab"><thead><tr><th>เดือน</th>' + ok.map(function (c) { return '<th>' + cname(c) + '</th>'; }).join('') + '<th>รวม (บาท)</th></tr></thead><tbody>' + rows + '</tbody>'
      + '<tfoot><tr class="cmt"><td class="cmn">รวม' + (Y === 'all' ? 'ทั้งหมด' : 'ปี ' + (+Y + 543)) + '</td>' + ok.map(function (c) { return '<td>' + cell(c, tot[c.key][0], tot[c.key][1], ' · ' + tot[c.key][2] + (c.export ? ' ใบ' : ' PO')) + '</td>'; }).join('')
      + '<td class="mtot"><b>' + n0(gt[0]) + ' ลัง</b><small>' + baht(gt[1]) + '</small></td></tr></tfoot></table></div>';
    // ตาราง 2: แต่ละบริษัท สินค้า × เดือน
    var per = ok.map(function (c) {
      var ms = list.filter(function (ym) { return c.months[ym]; });
      if (!ms.length) return '';
      var body = c.products.filter(function (p) { return ms.some(function (ym) { return p.m[ym]; }); }).map(function (p) {
        var sq = 0, sa = 0;
        return '<tr><td class="cmn">' + (p.color ? '<i class="a7sw" style="background:' + p.color + '"></i>' : '') + esc(p.name) + '</td>' + ms.map(function (ym) { var x = p.m[ym]; if (!x) return '<td><span class="muted">–</span></td>'; sq += x[0]; sa += x[1]; return '<td>' + cell(c, x[0], x[1]) + '</td>'; }).join('')
          + '<td class="mtot">' + cell(c, sq, sa) + '</td></tr>';
      }).join('');
      var ft = ms.map(function (ym) { return '<td>' + cell(c, c.months[ym].qty, c.months[ym].amt) + '</td>'; }).join(''), fq = 0, fa = 0;
      ms.forEach(function (ym) { fq += c.months[ym].qty; fa += c.months[ym].amt; });
      return '<div class="panel pbox"><h4>' + icon('table', 18) + ' ' + cname(c) + '</h4><p class="muted cmnote">นับ' + esc(c.basis) + ' · ' + esc(c.note) + '</p>'
        + '<div class="cpwrap"><table class="cptab cmtab mtab"><thead><tr><th>สินค้า</th>' + ms.map(function (ym) { return '<th>' + monthTh(ym) + (ym > cur && c.future ? '<small>ตามกำหนดส่ง</small>' : '') + '</th>'; }).join('') + '<th>รวม</th></tr></thead><tbody>' + body + '</tbody>'
        + '<tfoot><tr class="cmt"><td class="cmn">รวม</td>' + ft + '<td class="mtot">' + cell(c, fq, fa) + '</td></tr></tfoot></table></div></div>';
    }).join('');
    box.innerHTML = '<div class="pchips cmchips noprint">' + years.map(function (y) { return '<button class="chip' + (Y === y ? ' on' : '') + '" data-my="' + y + '">ปี ' + (+y + 543) + '</button>'; }).join('')
      + '<button class="chip' + (Y === 'all' ? ' on' : '') + '" data-my="all">ทั้งหมด</button>' + (reload ? '<button class="btn btn-sm btn-line" data-monre="1">↻ คำนวณใหม่</button>' : '') + '</div>'
      + cs.filter(function (c) { return c.error; }).map(function (c) { return '<div class="a7msg bad">' + esc(c.name) + ': ' + esc(c.error) + '</div>'; }).join('')
      + (ok.length ? '<div class="panel pbox"><h4>' + icon('chart', 18) + ' ภาพรวมทุกบริษัท ' + (Y === 'all' ? '(ทุกเดือน)' : 'ปี ' + (+Y + 543)) + '</h4>'
        + '<p class="muted cmnote">CP ALL นับตามวันที่สั่ง · CP Ram ตามวันส่งสินค้า (เดือนหลังจากนี้ = ตามกำหนดส่ง) · ต่างประเทศตามวันที่ Invoice · ช่อง "รวม (บาท)" รวมเฉพาะบริษัทที่เป็นเงินบาท</p>' + t1 + '</div>' + per
        : '<div class="panel pbox muted">ยังไม่มีข้อมูลออเดอร์</div>');
    on('[data-my]', 'click', function (el) { var y = el.getAttribute('data-my'); box.setAttribute('data-y', y); if (reload) H.monY = y; H.mountMonthly(box, r, reload); }, box);
    on('[data-monre]', 'click', function () { reload(); }, box);
  };
  // ใช้ร่วมกับหน้า Dashboard ผู้บริหาร (executive.js) — ข้อมูลจาก accDashboard_
  H.dashHtml = function (r, interactive) {
    var m = r.matrix, map = r.map, pv = r.prev;
    if (!m.cases) return '<div class="empty"><div class="icon">' + icon('chart', 28) + '</div><h4>ไม่มีออเดอร์ในช่วงนี้</h4><div>' + thDate(r.from) + ' – ' + thDate(r.to) + (r.dc ? ' · ศูนย์ ' + esc(r.dc) : '') + ' (นับ' + (r.basis === 'po' ? 'ตามวันที่สั่ง' : 'ตามวันที่ส่ง') + ')</div></div>';
    var delta = function (now, before) {
      if (!before) return 'ช่วงก่อนหน้าไม่มีข้อมูล';
      if (window.DCH) return window.DCH.delta(now, before, { label: 'จากช่วงก่อน' }) + ' (' + n0(before) + ')';
      var p = Math.round((now - before) / before * 100);
      return '<span class="' + (p >= 0 ? 'pos' : 'neg') + '">' + (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%</span> จากช่วงก่อน (' + n0(before) + ')';
    };
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var dueSum = r.due.reduce(function (s, d) { return s + d.amount; }, 0);
    var html = '<div class="kpis a7k">'
      + tile(n0(m.cases), 'รวมจำนวนลัง', '#059669', delta(m.cases, pv.cases))
      + tile(baht(m.amount), 'มูลค่าสั่งซื้อ (ไม่รวม VAT)', '#7c3aed', delta(Math.round(m.amount), Math.round(pv.amount)))
      + tile(n0(m.poCount), 'ใบสั่งซื้อ', '#2563eb', 'เฉลี่ย ' + n0(m.poCount ? m.cases / m.poCount : 0) + ' ลัง/ใบ')
      + tile(baht(dueSum), 'เงินที่จะได้รับ (รอบชำระที่จะถึง)', '#d97706', 'รวม VAT · ' + (r.due.length ? 'ภายใน ' + thDate(r.due[r.due.length - 1].date) : 'ประมาณการ'))
      + '</div>';
    var maxDc = Math.max.apply(null, m.dcs.map(function (d) { return d.cases; }).concat([1]));
    var prods = map.products.map(function (p) { return { p: p, n: m.byProduct[p.key] || 0, amt: (r.amountByProduct || {})[p.key] || 0 }; }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
    var maxP = prods.length ? prods[0].n : 1;
    var bar = function (label, n, max, color, right, attr) {
      return '<div class="sbar a7bar1"' + (attr || '') + ' title="' + esc(label) + ': ' + n0(n) + ' ลัง"><span>' + label + '</span><i><em style="width:' + Math.max(2, Math.round(n / max * 100)) + '%;background:' + color + '"></em></i><b>' + right + '</b></div>';
    };
    var maxDay = Math.max.apply(null, r.days.map(function (d) { return d.cases; }).concat([1]));
    html += '<div class="pgrid">'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' จำนวนลังแยกศูนย์' + (interactive ? ' <small class="muted">แตะเพื่อกรอง</small>' : '') + '</h4>' + m.dcs.slice().sort(function (a, b) { return b.cases - a.cases; }).map(function (d) {
        return bar(esc(d.name), d.cases, maxDc, '#059669', d.cases ? n0(d.cases) + ' <small>(' + Math.round(d.cases / m.cases * 100) + '%)</small>' : '–', d.cases && interactive ? ' data-dcf="' + esc(d.name) + '" role="button" tabindex="0"' : '');
      }).join('') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' จำนวนลังแยกสินค้า</h4>' + (window.DCH && prods.length ? window.DCH.donut(prods.map(function (x) { return { name: pname(x.p), n: x.n, color: x.p.color }; }), { sub: 'ลังทั้งหมด', unit: ' ลัง', max: 8, title: 'จำนวนลังแยกสินค้า' }) + '<div class="xsep" style="margin:12px 0 4px"></div>' : '') + prods.map(function (x) {
        return bar('<i class="a7sw" style="background:' + x.p.color + '"></i>' + esc(pname(x.p)), x.n, maxP, x.p.color, n0(x.n));
      }).join('') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' ลังต่อวัน (' + (r.basis === 'po' ? 'วันที่สั่ง' : 'วันที่ส่ง') + ')</h4>' + (window.DCH ? window.DCH.area({ labels: r.days.map(function (d) { return thDate(d.date).replace(/ \d+$/, ''); }), calloutLabel: function (i) { return thDate(r.days[i].date); }, unit: ' ลัง', height: 200, series: [{ name: 'ลัง', color: '#059669', values: r.days.map(function (d) { return d.cases; }) }] }) : '<div class="a7days">' + r.days.map(function (d) {
        return '<div class="a7day" title="' + thDate(d.date) + ': ' + n0(d.cases) + ' ลัง · ' + baht(d.amount) + '"><b>' + n0(d.cases) + '</b><em style="height:' + Math.max(3, Math.round(d.cases / maxDay * 100)) + '%"></em><span>' + thDate(d.date).replace(/ \d+$/, '') + '</span></div>';
      }).join('') + '</div>') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' กำหนดรับเงิน (ประมาณการ)</h4>' + (r.due.length ? r.due.slice(0, 10).map(function (d) {
        return '<div class="a7due"><div><b>' + dayName(d.date) + ' ' + thDate(d.date) + '</b><small>สินค้าส่ง ' + (d.from === d.to ? thDate(d.from) : thDate(d.from).replace(/ \S+ \d+$/, '') + '–' + thDate(d.to)) + ' · ' + d.poCount + ' ใบสั่ง'
          + (d.base && d.base !== d.date ? '<br><em>เลื่อนจาก ' + thDate(d.base) + (d.why ? ' (' + esc(d.why) + ')' : '') + '</em>' : '') + '</small></div><b>' + baht(d.amount) + '</b></div>';
      }).join('') + '<small class="muted">ส่งวันที่ 1–15 รับเงินวันที่ 10 เดือนถัดไป · ส่งวันที่ 16–31 รับเงินวันที่ 25 เดือนถัดไป · ตรงวันเสาร์-อาทิตย์หรือวันหยุดราชการ เลื่อนไปวันทำการถัดไป · รวม VAT</small>' : '<div class="muted">ไม่มียอดที่รอรับเงิน</div>') + '</div>'
      + '</div>';
    html += '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('table', 18) + ' ตารางสรุปแบบต้นแบบรับออเดอร์ <small class="muted">' + thDate(r.from) + ' – ' + thDate(r.to) + '</small></h4>' + H.tplHtml(map, m, { full: false }) + '</div>';
    return html;
  };

  // ==================== 4) ตั้งค่า ====================
  // ย่อรูปเป็น JPG ด้านยาวไม่เกิน max px (พื้นขาว) → base64
  function shrinkImage(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('อ่านไฟล์รูปไม่ได้')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error('ไฟล์นี้ไม่ใช่รูปที่เปิดได้')); };
        im.onload = function () {
          var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.88).split(',')[1]);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function settings() {
    var cfg = H.setDraft = H.setDraft || clone(H.data.map), L = H.data.line;
    var list = function (a) { return esc((a || []).join(', ')); };
    $('main').innerHTML = '<h3>ตั้งค่าศูนย์ / สินค้า / LINE</h3><p class="lead">ระบบจับคู่ Delivery Location กับ "คำค้น" ของศูนย์ (ถ้าไม่พบใช้รหัสคลัง) และจับคู่สินค้าจากรหัสสินค้า 7-11 (ถ้าไม่พบใช้คำค้นในชื่อ) · ลำดับในตาราง = ลำดับในรายงาน</p>'
      + '<div class="panel pbox"><h4>' + icon('send', 18) + ' LINE กลุ่มฝ่ายบัญชี</h4>'
      + (L.token && L.group
        ? '<div class="a7chk ok"><i>✓</i><span>เชื่อมต่อ LINE เรียบร้อย — รายงานจะส่งเข้ากลุ่มที่ผูกไว้</span></div>'
          + '<div class="a7lineacts"><button class="btn btn-line btn-sm" id="sTest">' + icon('send', 16) + ' ส่งข้อความทดสอบเข้ากลุ่ม</button>'
          + '<button class="btn btn-line btn-sm" id="sGroup">' + icon('gear', 16) + ' เปลี่ยนกลุ่มที่รับรายงาน</button></div>'
        : '<div class="a7chk ' + (L.token ? 'ok' : 'bad') + '"><i>' + (L.token ? '✓' : '✕') + '</i><span>ACC_LINE_TOKEN (Channel access token) ' + (L.token ? 'ใส่แล้ว' : 'ยังไม่ได้ใส่') + '</span></div>'
          + '<div class="a7chk bad"><i>✕</i><span>กลุ่ม LINE ที่รับรายงาน ยังไม่ได้ผูก</span></div>'
          + '<ol class="a7ol">'
          + (L.token ? '' : '<li>ใส่ Channel access token ของ OA ฝ่ายบัญชีใน Apps Script → Project Settings → Script Properties ชื่อ <code>ACC_LINE_TOKEN</code></li>'
            + '<li>ใน LINE Developers → Messaging API ของ OA ฝ่ายบัญชี: ใส่ Webhook URL ด้านล่าง แล้วเปิด Use webhook และ Allow bot to join group chats'
            + (L.webhook ? copyBox(L.webhook, 'Webhook URL') : '') + '</li>')
          + '<li>' + bindStep(L.setupCode) + '</li></ol>')
      + '</div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('table', 18) + ' ศูนย์กระจายสินค้า</h4><div class="ptable-wrap"><table class="ptable a7set"><thead><tr><th></th><th>ชื่อศูนย์ (ในรายงาน)</th><th>คำค้นใน Delivery Location</th><th>รหัสคลัง</th><th></th></tr></thead><tbody>'
      + cfg.dcs.map(function (d, i) {
        return '<tr><td>' + mv('d', i, cfg.dcs.length) + '</td><td><input data-d="' + i + '" data-k="name" value="' + esc(d.name) + '"></td><td><input data-d="' + i + '" data-k="keywords" value="' + list(d.keywords) + '"></td><td><input data-d="' + i + '" data-k="codes" value="' + list(d.codes) + '"></td><td><button class="icon-btn" data-rm="d' + i + '" aria-label="ลบ">' + icon('x', 16) + '</button></td></tr>';
      }).join('') + '</tbody></table></div><button class="btn btn-line btn-sm" id="sAddD" style="margin-top:8px">+ เพิ่มศูนย์</button></div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('table', 18) + ' สินค้า (คอลัมน์ในรายงาน)</h4><div class="ptable-wrap"><table class="ptable a7set"><thead><tr><th></th><th>สี / รหัสสี</th><th>รูป</th><th>บรรทัด 1</th><th>บรรทัด 2</th><th>รหัสสินค้า 7-11</th><th>คำค้นในชื่อสินค้า</th><th></th></tr></thead><tbody>'
      + cfg.products.map(function (p, i) {
        return '<tr><td>' + mv('p', i, cfg.products.length) + '</td><td class="a7clr"><input type="color" data-p="' + i + '" data-k="color" value="' + esc(p.color) + '" aria-label="สีคอลัมน์"><input class="a7hex" data-hexp="' + i + '" value="' + esc(String(p.color).toUpperCase()) + '" maxlength="7" spellcheck="false" aria-label="รหัสสี"></td>'
          + '<td class="a7simg"><label class="a7up" title="' + (p.img ? 'เปลี่ยนรูป' : 'ใส่รูปสินค้า') + '" style="background:' + esc(p.color) + '">' + (p.img ? '<img src="' + esc(p.img) + '=w96" alt="">' : '<span>+ รูป</span>') + '<input type="file" accept="image/*" data-pimg="' + i + '" hidden></label>'
          + (p.img ? '<button class="a7rmimg" data-pnoimg="' + i + '" type="button">เอารูปออก</button>' : '') + '</td><td><input data-p="' + i + '" data-k="l1" value="' + esc(p.l1) + '"></td><td><input data-p="' + i + '" data-k="l2" value="' + esc(p.l2) + '"></td>'
          + '<td><input data-p="' + i + '" data-k="codes" value="' + list(p.codes) + '"></td><td><input data-p="' + i + '" data-k="keywords" value="' + list(p.keywords) + '"></td><td><button class="icon-btn" data-rm="p' + i + '" aria-label="ลบ">' + icon('x', 16) + '</button></td></tr>';
      }).join('') + '</tbody></table></div><button class="btn btn-line btn-sm" id="sAddP" style="margin-top:8px">+ เพิ่มสินค้า</button></div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('table', 18) + ' สีส่วนอื่นของตาราง <small class="muted">(ตามไฟล์ต้นแบบ)</small></h4><div class="a7fixc">'
      + [['หัว "รายการสินค้า"', HEAD_BG], ['แถว "รวม"', TOTAL_BG], ['แถว "รวมทั้งหมด"', GRAND_BG], ['ช่องรวม (ลัง) / ช่องที่ไม่มีออเดอร์', '#FFFFFF']].map(function (c) {
        return '<div><i style="background:' + c[1] + '"></i><span>' + c[0] + '</span><code>' + c[1] + '</code></div>'; }).join('') + '</div></div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('clock', 18) + ' วันหยุด (ใช้คิดกำหนดรับเงิน)</h4>'
      + '<p class="muted" style="margin:0 0 8px;font-size:13px">ส่งวันที่ 1–15 รับเงินวันที่ 10 เดือนถัดไป · ส่งวันที่ 16–31 รับเงินวันที่ 25 เดือนถัดไป · ถ้าตรงวันเสาร์-อาทิตย์หรือวันหยุด เลื่อนไปวันทำการถัดไป · วันหยุดราชการดึงจากปฏิทินวันหยุดไทยของ Google อัตโนมัติ</p>'
      + '<details class="a7hol"><summary>วันหยุดราชการที่จะถึง (' + (H.data.holidays || []).length + ' วัน)</summary>' + ((H.data.holidays || []).map(function (h) { return '<div><b>' + dayName(h[0]) + ' ' + thDate(h[0]) + '</b> ' + esc(h[1]) + '</div>'; }).join('') || '<div class="muted">ดึงรายการวันหยุดไม่ได้ในตอนนี้</div>') + '</details>'
      + '<div style="margin-top:10px"><b style="font-size:13.5px">วันหยุดเพิ่มเติม</b> <small class="muted">เช่น วันหยุดพิเศษที่ประกาศภายหลัง</small></div><div class="a7hx">'
      + (cfg.holidays || []).map(function (d, i) { return '<span class="a7tag">' + dayName(d) + ' ' + thDate(d) + ' <button type="button" data-rmh="' + i + '" aria-label="ลบวันหยุด">✕</button></span>'; }).join('')
      + '<input type="date" id="sHol" aria-label="เพิ่มวันหยุด"><button class="btn btn-line btn-sm" id="sAddH" type="button">+ เพิ่มวันหยุด</button></div></div>'
      + '<div class="a7bar"><button class="btn btn-line" id="sUndo">ยกเลิกการแก้ไข</button><button class="btn btn-primary" id="sSave">' + icon('check', 18) + ' บันทึกการตั้งค่า</button></div>';
    var split = function (s) { return String(s).split(',').map(function (x) { return x.trim(); }).filter(String); };
    on('input[data-d]', 'input', function (el) { var d = cfg.dcs[+el.getAttribute('data-d')], k = el.getAttribute('data-k'); d[k] = k === 'name' ? el.value : split(el.value); }, $('main'));
    // รหัสสี: พิมพ์ #RRGGBB (หรือไม่มี #) → อัปเดตตัวเลือกสี · เลือกสี → อัปเดตรหัส
    on('input[data-hexp]', 'input', function (el) {
      var i = +el.getAttribute('data-hexp'), v = el.value.trim().replace(/^#?/, '#').toUpperCase(), ok = /^#[0-9A-F]{6}$/.test(v);
      el.classList.toggle('bad', !ok && el.value.trim() !== '');
      if (ok) { cfg.products[i].color = v; var c = $('main').querySelector('input[type=color][data-p="' + i + '"]'); if (c) c.value = v.toLowerCase(); }
    }, $('main'));
    on('input[data-hexp]', 'blur', function (el) { el.value = String(cfg.products[+el.getAttribute('data-hexp')].color).toUpperCase(); el.classList.remove('bad'); }, $('main'));
    on('input[type=color][data-p]', 'input', function (el) { var h = $('main').querySelector('input[data-hexp="' + el.getAttribute('data-p') + '"]'); if (h) { h.value = el.value.toUpperCase(); h.classList.remove('bad'); } }, $('main'));
    on('input[data-p]', 'input', function (el) { var p = cfg.products[+el.getAttribute('data-p')], k = el.getAttribute('data-k'); p[k] = k === 'codes' || k === 'keywords' ? split(el.value) : el.value; }, $('main'));
    on('[data-pnoimg]', 'click', function (el) { var p = cfg.products[+el.getAttribute('data-pnoimg')]; p.img = ''; p.noImg = true; settings(); }, $('main'));
    on('input[data-pimg]', 'change', function (el) {
      var p = cfg.products[+el.getAttribute('data-pimg')], f = el.files && el.files[0]; if (!f) return;
      toast('กำลังอัปโหลดรูป…');
      shrinkImage(f, 400).then(function (b64) { return call('accUploadProductImage', state.token, (p.l1 || p.key) + '.jpg', 'image/jpeg', b64); }).then(function (r) {
        if (!r.ok) return toast(r.error);
        p.img = r.url; p.noImg = false; settings(); toast('ใส่รูปแล้ว — กด "บันทึกการตั้งค่า" เพื่อใช้ในรายงาน');
      }).catch(function (e) { onServerError(e); });
    }, $('main'));
    on('[data-mv]', 'click', function (el) {
      var a = el.getAttribute('data-mv').split(':'), arr = a[0] === 'd' ? cfg.dcs : cfg.products, i = +a[1], j = i + (+a[2]);
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; settings();
    }, $('main'));
    on('[data-rm]', 'click', function (el) { var k = el.getAttribute('data-rm'); (k[0] === 'd' ? cfg.dcs : cfg.products).splice(+k.slice(1), 1); settings(); }, $('main'));
    $('sAddD').addEventListener('click', function () { cfg.dcs.push({ name: '', keywords: [], codes: [] }); settings(); });
    $('sAddP').addEventListener('click', function () {
      var n = cfg.products.reduce(function (mx, p) { return Math.max(mx, parseInt(String(p.key).replace(/\D/g, ''), 10) || 0); }, 0) + 1;
      cfg.products.push({ key: 'P' + pad(n), l1: '', l2: '', color: '#E2E8F0', codes: [], keywords: [] }); settings();
    });
    $('sUndo').addEventListener('click', function () { H.setDraft = null; settings(); });
    $('sAddH').addEventListener('click', function () {
      var v = $('sHol').value; if (!v) return toast('เลือกวันที่ก่อน');
      cfg.holidays = cfg.holidays || []; if (cfg.holidays.indexOf(v) < 0) cfg.holidays.push(v); cfg.holidays.sort(); settings();
    });
    on('[data-rmh]', 'click', function (el) { cfg.holidays.splice(+el.getAttribute('data-rmh'), 1); settings(); }, $('main'));
    $('sSave').addEventListener('click', function () {
      var b = this; b.disabled = true;
      call('accSaveMap', state.token, JSON.stringify(cfg)).then(function (r) {
        b.disabled = false;
        if (!r.ok) return toast(r.error);
        H.data.map = r.map; H.setDraft = null; toast('บันทึกการตั้งค่าแล้ว'); settings();
      }).catch(function (e) { b.disabled = false; onServerError(e); });
    });
    bindCopy($('main'));
    if ($('sGroup')) $('sGroup').addEventListener('click', changeGroup);
    if ($('sTest')) $('sTest').addEventListener('click', function () {
      var b = this; b.disabled = true;
      call('accLineTest', state.token).then(function (r) { b.disabled = false; toast(r.ok ? 'ส่งข้อความทดสอบแล้ว — ดูในกลุ่ม LINE' : r.error); }).catch(function (e) { b.disabled = false; onServerError(e); });
    });
  }
  function copyBox(text, label) { return '<div class="a7copy"><input readonly value="' + esc(text) + '" aria-label="' + esc(label) + '"><button class="btn btn-line btn-sm" data-copy="' + esc(text) + '">คัดลอก</button></div>'; }
  function bindStep(code) {
    return 'เชิญ OA ฝ่ายบัญชีเข้ากลุ่ม แล้วพิมพ์ข้อความนี้ในกลุ่ม ระบบจะจำกลุ่มให้เอง' + copyBox('ตั้งค่ากลุ่ม บัญชี ' + (code || ''), 'คำสั่งผูกกลุ่ม')
      + '<small class="muted">รหัสใช้ได้ครั้งเดียว</small>';
  }
  function bindCopy(root) {
    on('[data-copy]', 'click', function (el) {
      var t = el.getAttribute('data-copy'), done = function () { toast('คัดลอกแล้ว'); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { el.previousSibling.select(); });
      else { el.previousSibling.select(); document.execCommand('copy'); done(); }
    }, root);
  }
  // เปลี่ยนกลุ่ม: ดึงรหัสล่าสุดก่อน (รหัสเดิมใช้ไปแล้ว)
  function changeGroup() {
    wide({ icon: 'send', title: 'เปลี่ยนกลุ่มที่รับรายงาน', noCancel: true, ok: 'ปิด',
      body: '<div id="gBody"><span class="spinner dark"></span> กำลังโหลดรหัสล่าสุด…</div><p class="muted">พิมพ์ในกลุ่มใหม่แล้ว รายงานครั้งต่อไปจะส่งไปกลุ่มใหม่แทน (กลุ่มเดิมจะไม่ได้รับ)</p>',
      onOpen: function () {
        call('accLoad', state.token).then(function (d) {
          H.data.line = d.line;
          var g = $('gBody'); if (!g) return;
          g.innerHTML = '<ol class="a7ol"><li>' + bindStep(d.line.setupCode) + '</li></ol>'; bindCopy(g);
        }).catch(onServerError);
      } });
  }
  function mv(t, i, n) {
    return '<span class="a7mv">' + (i > 0 ? '<button class="icon-btn" data-mv="' + t + ':' + i + ':-1" aria-label="เลื่อนขึ้น">▲</button>' : '') + (i < n - 1 ? '<button class="icon-btn" data-mv="' + t + ':' + i + ':1" aria-label="เลื่อนลง">▼</button>' : '') + '</span>';
  }

  // ---------- CSS ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    '.a7band{margin:22px 0 12px;padding:10px 16px;border-radius:14px;font-weight:800;font-size:16px;color:#fff;letter-spacing:.2px}.a7band.in{background:linear-gradient(90deg,#15803d,#22c55e)}.a7band.out{background:linear-gradient(90deg,#b91c1c,#ef4444);margin-top:30px}.a7band:first-of-type{margin-top:6px}.a7jump{color:#b91c1c;font-weight:700;white-space:nowrap}',
    '.a7steps{display:flex;gap:6px;list-style:none;padding:0;margin:0 0 14px;flex-wrap:wrap}.a7steps li{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid var(--line);border-radius:99px;padding:5px 12px 5px 5px;font-size:13.5px;color:var(--muted)}',
    '.a7steps i{font-style:normal;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#f1f5f9;font-weight:700;font-size:12.5px}.a7steps li.on{border-color:var(--c);color:var(--ink);font-weight:600}.a7steps li.on i{background:var(--c);color:#fff}.a7steps li.done i{background:#16a34a;color:#fff}',
    '.a7drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:200px;border:2.5px dashed var(--c);border-radius:18px;background:color-mix(in srgb,var(--c) 6%,white);cursor:pointer;text-align:center;padding:24px;color:var(--ink)}',
    '.a7drop:hover,.a7drop.over,.a7drop:focus{background:color-mix(in srgb,var(--c) 13%,white);outline:none}.a7drop b{font-size:19px}.a7drop span{color:var(--muted);font-size:14px}.a7dic{color:var(--c)!important}',
    '.a7msg{margin-top:12px;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid var(--line);display:flex;align-items:center;gap:8px;flex-wrap:wrap}.a7msg.bad{background:#fef2f2;border-color:#fca5a5;color:#991b1b;display:block}',
    '.a7imps{display:flex;flex-direction:column;gap:8px}.a7imp{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;color:inherit;box-shadow:var(--shadow)}.pbox .a7imp{box-shadow:none;margin-top:6px}.a7imp:hover{border-color:var(--c)}',
    '.a7imp small{display:block;color:var(--muted);font-size:12.5px}.a7d{min-width:96px}.a7f{flex:1;min-width:0}.a7f small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.a7tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:99px;background:#f1f5f9;color:#475569;white-space:nowrap}.a7tag.ok{background:#dcfce7;color:#15803d}',
    '.a7checks .a7chk,.pbox .a7chk{display:flex;gap:8px;align-items:flex-start;padding:5px 0;font-size:14.5px}.a7chk i{font-style:normal;flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:12px;color:#fff}',
    '.a7chk.ok i{background:#16a34a}.a7chk.warn i{background:#d97706}.a7chk.bad i{background:#dc2626}.a7chk.bad span{color:#991b1b;font-weight:600}',
    '.a7fix{margin-top:12px;border-color:#fca5a5}.a7fix p{margin:0 0 6px}.a7fixrow{display:grid;grid-template-columns:1fr minmax(180px,260px);gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.a7fixrow small{color:var(--muted)}',
    '.a7fixrow select,.a7filter select,.a7lb input{padding:8px 10px;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:14px;background:#fff}.a7lb{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);margin:0}',
    '.a7cmp{margin-bottom:18px}.a7h4{display:flex;gap:6px;align-items:center;margin:6px 0 8px}.cmchips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.cmchips #cmpRe{margin-left:auto}',
    '.cptab.mtab{min-width:0}.mtab td{min-width:92px}.mtab td.mtot{background:#f8fafc}.mtab .cmt td.mtot{background:#fde68a}.mfut{display:block;font-style:normal;font-size:11px;color:#c2410c;margin-top:2px}.mtab th small{color:#475569}',
    '.cptab.cmtab{min-width:0}.cmnote{font-size:12.5px;margin:6px 0 0}.cmh{margin:14px 0 6px;font-size:14.5px}.cmsec{margin:16px 0 0;border:1.5px solid var(--cmc);border-radius:14px;overflow:hidden;background:#fff}.cmsec.r{--cmc:#2563EB;--cmt:#EFF6FF}.cmsec.m{--cmc:#7C3AED;--cmt:#F5F3FF}.cmsec+.cmsec{margin-top:22px}.cmsh{display:flex;align-items:center;gap:10px;background:var(--cmc);color:#fff;padding:10px 14px}.cmsh b{display:block;font-size:15px}.cmsh small{display:block;font-size:12.5px;opacity:.9}.cmno{flex:none;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700}.cmsb{padding:8px 10px 10px}.cmsb .cpwrap{margin:0}.cmsec .cmtab thead th{background:var(--cmt)}.cmsec .cmtab tfoot td{background:var(--cmt)}.cmtab th small{display:block;font-weight:400;font-size:12px}.cmtab td{vertical-align:top}.cmtab td b,.cmtab td small{display:block;white-space:nowrap}.cmtab td small{color:var(--muted);font-size:12.5px;margin-top:2px}',
    '@media (max-width:700px){.cptab.cmtab{font-size:12.5px}.cmtab th,.cmtab td{padding:6px 4px}.cmtab th{white-space:normal}.cmtab td.cmn{min-width:0!important;max-width:96px;font-size:12px}.cmtab td small{font-size:11px}.a7cmp .cpwrap{overflow-x:auto}}',
    '.cmtab td.cmn{text-align:left;white-space:normal;min-width:130px}.cmtab .cmt td{background:#fef9c3;font-weight:700}.cmu{color:#15803d}.cmd{color:#dc2626}.cmz{color:var(--muted)}.cmtab td small .cmu,.cmtab td small .cmd{color:inherit}.cmtab td small .cmu{color:#15803d}.cmtab td small .cmd{color:#dc2626}',
    '.a7checks{margin-bottom:12px}.a7k{grid-template-columns:repeat(4,1fr);margin-top:12px}.kpi small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}',
    // รายงานแบบต้นแบบ
    '.a7rep{background:#fff;border-radius:14px;padding:16px;box-shadow:var(--shadow);color:#0f172a}.a7head{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}.a7logo{height:42px}',
    '.a7title{flex:1;min-width:180px}.a7title b{display:block;font-size:17px}.a7title span{font-size:12.5px;color:#475569}.a7meta{font-size:13px;text-align:right;line-height:1.6}.a7meta b{font-size:14px}',
    '.a7wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #0f172a}.a7t{border-collapse:collapse;width:100%;min-width:760px;font-size:12.5px;table-layout:fixed}',
    '.a7t th,.a7t td{border:1px solid #334155;padding:3px 2px;text-align:center;vertical-align:middle}.a7t thead th{font-weight:600;line-height:1.25;font-size:11.5px}.a7t th.a7p{height:34px;font-size:10.5px;padding:2px 1px}.a7t th.a7pi{height:58px;padding:3px 2px}.a7t th.a7pi img{display:block;margin:0 auto;max-width:100%;max-height:52px;object-fit:contain}.a7simg{white-space:nowrap}.a7up{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:8px;border:1.5px dashed #94a3b8;cursor:pointer;overflow:hidden;vertical-align:middle;font-size:11px;color:#334155}.a7up img{max-width:100%;max-height:100%;object-fit:contain}.a7rmimg{display:block;margin-top:3px;font-size:11px;border:0;background:none;color:#b91c1c;cursor:pointer;padding:0;text-decoration:underline}',
    '.a7t .a7no{width:30px}.a7t .a7dc{width:78px;text-align:left;padding-left:6px;position:sticky;left:0;background:#fff;z-index:1}.a7t thead .a7dc{text-align:center}.a7t .a7sum{width:52px;font-weight:700}',
    '.a7t td.a7dc b{display:block;font-size:13px}.a7t td.a7dc small{display:block;font-size:10.5px;color:#64748b;font-weight:400}.a7t td.a7v{font-weight:700;font-size:14px;height:30px}',
    '.a7t tr.a7blank td{height:9px;padding:0}.a7t tr.none td.a7dc b{color:#94a3b8}.a7t tr[data-dc]{cursor:pointer}.a7t tr[data-dc]:hover td.a7dc,.a7t tr[data-dc]:focus td.a7dc{background:#ecfdf5;outline:none}',
    '.a7t tfoot td{font-weight:700;font-size:14px;height:30px}.a7t tr.a7grand td{text-align:right;padding-right:10px;font-size:15px}.a7t tr.a7grand td:first-child{text-align:center}',
    '.a7sign{display:flex;justify-content:space-around;margin-top:22px;font-size:13px;gap:16px;flex-wrap:wrap}.a7sign span{display:inline-block;width:180px;border-bottom:1px dotted #475569;margin-left:6px}',
    '.a7hint{margin:8px 2px 0}.a7bar{position:sticky;bottom:0;display:flex;gap:10px;padding:12px 0;margin-top:8px;background:linear-gradient(transparent,rgba(244,246,250,.95) 30%);z-index:5}.a7bar .btn-line{flex:none}.a7bar .btn-primary{font-size:16px;padding:14px}',
    '.a7clr{white-space:nowrap}.a7clr input[type=color]{vertical-align:middle}.a7hex{width:88px!important;margin-left:6px;font-family:ui-monospace,Menlo,monospace!important;font-size:13px!important;text-transform:uppercase;vertical-align:middle}.a7hex.bad{border-color:#dc2626!important;background:#fef2f2}'
    + '.a7fixc{display:flex;flex-wrap:wrap;gap:8px 18px}.a7fixc div{display:flex;align-items:center;gap:8px;font-size:13.5px}.a7fixc i{width:26px;height:26px;border-radius:6px;border:1px solid #cbd5e1;flex:none}.a7fixc code{font-size:13px;background:#f1f5f9;padding:2px 6px;border-radius:6px}',
    '.a7due{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)}.a7due>div{flex:1}.a7due small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.a7due em{font-style:normal;color:#b45309}.a7due>b{white-space:nowrap}',
    '.a7hol summary{cursor:pointer;font-weight:600;font-size:13.5px}.a7hol div{font-size:13px;padding:3px 0;border-bottom:1px dashed var(--line)}.a7hx{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}.a7hx .a7tag button{border:0;background:none;cursor:pointer;color:#b91c1c;padding:0 0 0 4px}.a7hx input[type=date]{padding:5px 8px;border:1px solid var(--line);border-radius:8px}',
    '.a7acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.a7sp{flex:1}.a7acts .btn-primary{flex:none}.a7line{background:#06c755!important}.a7status{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.a7status .a7tag,.a7status .flink{display:inline-flex;align-items:center;gap:5px;font-size:13.5px;font-weight:600;padding:6px 13px;border-radius:99px;background:#fff;color:#334155;border:1.5px solid #cbd5e1;box-shadow:0 1px 3px rgba(15,23,42,.12);text-decoration:none;line-height:1.2}.a7status .a7tag{color:#b45309;border-color:#f59e0b;background:#fffbeb}.a7status .a7tag.ok{color:#15803d;border-color:#22c55e;background:#f0fdf4}.a7status .flink{color:#1d4ed8;border-color:#93c5fd}.a7status .flink:hover{background:#eff6ff}.a7status .flink svg{flex:none}.a7status button.flink{cursor:pointer;font-family:inherit;color:#475569;border-color:#cbd5e1}.a7status button.flink:disabled{opacity:.5}',
    '.a7del{margin-top:18px;text-align:right}.link-btn{border:0;background:none;padding:4px;display:inline-flex;align-items:center;gap:4px;font-size:13px;color:var(--muted)}.link-btn svg{width:14px;height:14px}',
    '.a7po{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:8px}.a7poh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px}.a7poh span{flex:1;color:var(--muted);font-size:12.5px}.a7poh em{font-style:normal;font-weight:600;font-size:13px}',
    '.a7poi{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:13.5px;border-top:1px dashed var(--line)}.a7poi i{width:14px;height:14px;border-radius:3px;border:1px solid rgba(0,0,0,.15)}.a7poi small{display:block;color:var(--muted);font-size:11.5px}',
    '.a7prev{background:#8da7cf;border-radius:12px;padding:14px;display:flex;justify-content:center}.a7card{background:#fff;border-radius:14px;padding:14px 16px;width:100%;max-width:330px;font-size:13.5px}.a7ct{color:#059669;font-size:16px;display:block}.a7card small{color:#64748b;font-size:11.5px}',
    '.a7card hr{border:0;border-top:1px solid #e2e8f0;margin:8px 0}.a7cr{display:flex;justify-content:space-between;padding:2px 0}.a7cr.big{font-weight:700;font-size:15px}.a7cr.big b{color:#059669}.a7cbtn{background:#059669;color:#fff;text-align:center;border-radius:8px;padding:8px;margin-top:10px;font-weight:600}',
    '.a7ol{margin:10px 0;padding-left:20px;font-size:14px}.a7ol li{margin:8px 0}.a7ol code{background:#f1f5f9;padding:1px 6px;border-radius:5px}.a7copy{display:flex;gap:6px;margin-top:6px}.a7lineacts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.a7copy input{flex:1;min-width:0;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px;background:#f8fafc}',
    '.a7imgrep{width:1200px;background:#fff;padding:18px}.a7imgrep .a7rep{box-shadow:none;border-radius:0;padding:0}.a7imgrep .a7wrap{overflow:visible}.a7imgrep .a7t{min-width:0}.a7imgrep .a7t .a7dc{position:static}.a7imgrep .a7t tr[data-dc]{cursor:default}.a7imgrep .a7sign{display:none}',
    '.a7imgbox{position:fixed;left:-20000px;top:0}.a7img{width:1080px;background:#fff;padding:22px;font-family:"IBM Plex Sans Thai",sans-serif;color:#0f172a}',
    '.a7ih{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;background:#0F5132;color:#fff;border-radius:12px;padding:16px 20px;margin-bottom:14px}.a7ih b{display:block;font-size:26px}.a7ih span{font-size:15px;color:#D1FAE5}',
    '.a7ir{text-align:right;display:flex;flex-direction:column;gap:2px}.a7ir span{font-size:17px!important;color:#fff!important}.a7ir b{display:inline;font-size:19px}',
    '.a7img table{width:100%;border-collapse:collapse;table-layout:fixed}.a7img th,.a7img td{border:1.5px solid #334155;text-align:center;padding:4px 1px}.a7img th{font-size:13.5px;font-weight:700;line-height:1.2;height:38px}',
    '.a7img td{font-size:25px;font-weight:700;height:44px}.a7img .dc{width:122px;text-align:left;padding-left:8px;font-size:19px;background:#f8fafc}.a7img th.dc{font-size:15px}.a7img .tt{width:76px;background:#FEF2CB;font-size:23px}',
    '.a7img tr.no td.dc{color:#94a3b8}.a7img tfoot td{background:#FEF2CB;height:48px;font-size:22px}',
    '.a7if{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:16px;color:#475569}.a7if b{font-size:26px;color:#0F5132}',
    '.a7lc{background:#fff;border-radius:12px;padding:14px;overflow:hidden;width:100%;max-width:420px;box-shadow:0 2px 8px rgba(0,0,0,.15)}.a7lh{background:#0F5132;color:#fff;padding:16px 18px;border-radius:18px}.a7lh small{display:block;font-size:10px;color:#A7F3D0;font-weight:700;letter-spacing:.04em}.a7lh b{display:block;font-size:20px;margin-top:4px}.a7lh span{font-size:12px;color:#D1FAE5}',
    '.a7prev{flex-direction:column;align-items:center;gap:10px}.a7limg{width:100%;max-width:420px}.a7limg img{display:block;width:100%;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.15)}.a7lnote{display:block;text-align:center;color:#64748b;font-size:11px;margin-top:10px}.a7limg .a7lwait{border-radius:14px}.a7lwait{padding:30px;text-align:center;color:#64748b;font-size:13px;background:#f8fafc}.a7lb{padding:10px 6px 4px}.a7lr{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:13.5px}.a7lr span{color:#64748b}.a7lr b{text-align:right}',
    '.a7ltot{margin-top:12px;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:10px;text-align:center;color:#047857}.a7ltot span{display:block;font-size:13px}.a7ltot b{font-size:30px}',
    '.a7lf{padding:10px 6px 0;display:flex;flex-direction:column;gap:8px}.a7lf div{text-align:center;border-radius:24px;padding:9px;font-weight:600;font-size:14px}.a7lf .p{background:#0F5132;color:#fff}.a7lf .s{background:#475569;color:#fff}.a7lf .x{background:#fff;color:#0F5132;border:2px solid #0F5132}',
    '.a7ul{margin:6px 0 0 18px;padding:0}.a7ul li{margin:4px 0}.a7ul code{background:#f1f5f9;padding:1px 6px;border-radius:5px}',
    '.a7bar1{cursor:default}.a7bar1[data-dcf]{cursor:pointer}.a7bar1[data-dcf]:hover span{color:var(--c)}.a7bar1 b small{font-weight:400;color:var(--muted)}.a7bar1 span i.a7sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:0;border:1px solid rgba(0,0,0,.2);overflow:visible}',
    '.a7days{display:flex;gap:4px;align-items:flex-end;height:150px;overflow-x:auto;padding-top:4px}.a7day{flex:1;min-width:30px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:11px}',
    '.a7day em{width:70%;max-width:26px;background:#059669;border-radius:4px 4px 0 0;display:block}.a7day b{font-size:11px;margin-bottom:2px}.a7day span{color:var(--muted);font-size:10.5px;white-space:nowrap;margin-top:3px}',
    '.a7set input{text-align:left;width:100%;min-width:90px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px}.a7set input[type=color]{width:42px;min-width:42px;height:34px;padding:2px}.a7mv{display:inline-flex;gap:2px}.a7mv .icon-btn{font-size:10px;padding:4px 6px}',
    '@media (max-width:860px){.a7k{grid-template-columns:repeat(2,1fr)}.a7fixrow{grid-template-columns:1fr}.a7meta{text-align:left}}',
    '@media print{.a7rep{box-shadow:none;padding:0;border-radius:0}.a7wrap{overflow:visible;border:0}.a7t{min-width:0;font-size:8.5pt}.a7t thead th{font-size:7.5pt}.a7t td.a7v,.a7t tfoot td{font-size:10pt}.a7t .a7dc{position:static}.a7t tr[data-dc] td.a7dc small{display:none}.a7hint,.a7bar,.a7steps,.a7del{display:none}',
    '.a7t th,.a7t td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
  ].join('\n');
  document.head.appendChild(css);
})();
