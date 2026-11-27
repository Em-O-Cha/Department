// ==================== ฝ่ายขาย (SALES) — เปิดระบบ Revenue Spunky Online + ระบบสต๊อก Stock Flow ในหน้าเดียวกัน (ผู้ใช้ขอ 27/11/69) ====================
// ระบบเดิมทำงานเหมือนเดิม ข้อมูลอยู่ที่เดิม · เมนูด้านซ้ายสลับหน้าในกรอบ (postMessage) ไม่โหลดกรอบใหม่
// ลิงก์ระบบ (url / stockUrl) ได้จาก API salesInfo (เฉพาะตั๋วฝ่ายขาย) — ไม่อยู่ในโค้ดหน้านี้ (repo สาธารณะ)
(function () {
  var S = window.SALESM = { info: null };
  Object.assign(ICONS, {
    plus: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    chart2: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>',
    minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    clock2: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>'
  });
  // app: rev = Revenue Spunky Online · stock = Stock Flow (ระบบสต๊อก Sales & Marketing, ผู้ใช้ขอ 27/11/69 ให้อยู่เฉพาะการ์ดฝ่ายขาย)
  var TABS = [
    { section: '💰 ยอดขาย (Revenue)', tone: 'gold' },
    { id: 'sl_rdash', app: 'rev', tab: 'dashboard', label: 'Dashboard ยอดขาย', ic: 'chart2' },
    { id: 'sl_add', app: 'rev', tab: 'add', label: 'เพิ่มยอดขาย', ic: 'plus' },
    { id: 'sl_search', app: 'rev', tab: 'search', label: 'ค้นหา / แก้ไข', ic: 'search' },
    { id: 'sl_import', app: 'rev', tab: 'import', label: 'นำเข้า Order', ic: 'upload' },
    { id: 'sl_aff', app: 'rev', tab: 'affiliate', label: 'Affiliate', ic: 'people' },
    { id: 'sl_labels', app: 'rev', tab: 'labels', label: 'ใบจัดส่ง', ic: 'printer' },
    { id: 'sl_stock', app: 'rev', tab: 'stock', label: 'ตัดสต๊อกอัตโนมัติ', ic: 'box' },
    { section: '📦 สต๊อกสินค้า (Stock Flow)', tone: 'gold' },
    { id: 'st_over', app: 'stock', tab: 'dashboard', label: 'ภาพรวมสต๊อก', ic: 'box' },
    { id: 'st_receive', app: 'stock', tab: 'receive', label: 'รับเข้า', ic: 'plus' },
    { id: 'st_issue', app: 'stock', tab: 'issue', label: 'จ่ายออก', ic: 'minus' },
    { id: 'st_urgent', app: 'stock', tab: 'urgent', label: 'เบิกด่วน', ic: 'bolt' },
    { id: 'st_req', app: 'stock', tab: 'requisition', label: 'สร้างใบเบิกสินค้า', ic: 'form' },
    { id: 'st_hist', app: 'stock', tab: 'history', label: 'ประวัติรับ-จ่าย', ic: 'clock2' },
    { id: 'st_line', app: 'stock', tab: 'settings', label: 'ตั้งค่า LINE (สต๊อก)', ic: 'gear' }
  ];
  var PAGES = TABS.filter(function (t) { return t.id; });
  var APP = { rev: { title: 'Revenue Spunky Online', key: 'url' }, stock: { title: 'ระบบสต๊อก (Stock Flow)', key: 'stockUrl' } };
  var W = { rev: { win: null, ready: false }, stock: { win: null, ready: false } };
  function pageOf(id) { return PAGES.filter(function (t) { return t.id === id; })[0] || PAGES[0]; }
  S.menus = function () { return TABS.map(function (t) { return t.section ? { section: t.section, tone: t.tone } : { id: t.id, label: t.label, ic: t.ic }; }); };
  S.reset = function () { W.rev = { win: null, ready: false }; W.stock = { win: null, ready: false }; };
  S.exportFile = function () { return null; };

  // ข้อความจากระบบในกรอบ: ready = โหลดเสร็จ · tab = ระบบเปลี่ยนหน้าเอง (ให้เมนูซ้ายตรงกัน) · app = stock สำหรับ Stock Flow
  window.addEventListener('message', function (e) {
    var m = e.data; if (!m || !m.rev || !/\.googleusercontent\.com$/.test(String(e.origin).replace(/^https:\/\//, ''))) return;
    if (!state.dept || state.dept.module !== 'sales') return;
    var app = m.app === 'stock' ? 'stock' : 'rev', w = W[app];
    w.win = e.source;
    if (m.rev === 'ready') {
      w.ready = true;
      var wt = $('slWait_' + app); if (wt) wt.classList.add('hidden');
      var cur = pageOf(state.page); if (cur.app === app) send(app, cur.tab);
    } else if (m.rev === 'tab') {
      var t = PAGES.filter(function (x) { return x.app === app && x.tab === m.tab; })[0];
      if (t && state.page !== t.id && pageOf(state.page).app === app) { state.page = t.id; renderNav(); keepSave(); }
    }
  });
  function send(app, tab) { try { if (W[app].win) W[app].win.postMessage({ rev: 'go', tab: tab }, '*'); } catch (e) {} }

  function frameBox(app, tab) {
    var b = document.createElement('div');
    b.id = 'slBox_' + app; b.className = 'slbox';
    b.innerHTML = '<div id="slWait_' + app + '" class="slwait"><span class="spinner dark"></span><div><b>กำลังเปิด' + esc(APP[app].title) + '…</b><span>ครั้งแรกอาจใช้เวลา 5–10 วินาที</span></div></div>';
    var f = document.createElement('iframe'), url = S.info[APP[app].key];
    f.title = APP[app].title; f.setAttribute('allow', 'clipboard-write');
    f.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tab=' + encodeURIComponent(tab);
    b.appendChild(f);
    setTimeout(function () { var wt = $('slWait_' + app); if (wt && !W[app].ready) wt.querySelector('span:last-child').textContent = 'ยังโหลดอยู่ — ถ้าค้างนาน กดเมนูอีกครั้ง หรือรีเฟรชหน้า'; }, 20000);
    return b;
  }
  S.render = function (page) {
    xpShowSales();
    var p = pageOf(page), wrap = $('slWrap');
    if (!wrap || !$('main').contains(wrap)) {   // สร้างใหม่ (ครั้งแรก หรือกลับจากหน้าเปลี่ยนรหัสผ่าน)
      W.rev = { win: null, ready: false }; W.stock = { win: null, ready: false };
      $('main').innerHTML = '<div id="slWrap"></div>';
      wrap = $('slWrap');
    }
    var show = function () {
      if (!$('slWrap')) return;
      var url = S.info[APP[p.app].key];
      if (!url) { toast('ยังไม่ได้ตั้งลิงก์ ' + APP[p.app].title); return; }
      if (!$('slBox_' + p.app)) wrap.appendChild(frameBox(p.app, p.tab));   // กรอบของแต่ละระบบโหลดครั้งเดียว แล้วเก็บไว้ (สลับเร็ว)
      ['rev', 'stock'].forEach(function (a) { var b = $('slBox_' + a); if (b) b.classList.toggle('hidden', a !== p.app); });
      if (W[p.app].ready) send(p.app, p.tab);
    };
    if (S.info) return show();
    wrap.innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังเปิดระบบงานขาย…</div>';
    call('salesInfo', state.token).then(function (r) {
      if (!r || !r.ok) throw new Error(r && r.error || 'เปิดระบบไม่ได้');
      S.info = r; if ($('slWrap')) $('slWrap').innerHTML = ''; show();
    }).catch(function (e) {
      if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
      $('main').innerHTML = '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>เปิดระบบงานขายไม่ได้</b><span>' + esc(e.message || e) + '</span></div></div>';
    });
  };
  // ปุ่ม Excel / PDF ด้านบนใช้กับหน้าในกรอบไม่ได้ (ระบบขายมีปุ่มดาวน์โหลดของตัวเอง) — ซ่อนไว้
  function xpShowSales() { ['xlsBtn', 'pdfBtn'].forEach(function (id) { var b = $(id); if (b) b.classList.add('hidden'); }); }

  var css = document.createElement('style');
  css.textContent = '.main:has(#slWrap){padding:12px 14px}.slbox.hidden{display:none}.slbox{position:relative;background:#fff;border-radius:14px;overflow:hidden;box-shadow:var(--shadow);height:calc(100vh - 100px);min-height:560px}'
    + '.slbox iframe{display:block;width:100%;height:100%;border:0}'
    + '.slwait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px;background:#fff;z-index:1;padding:20px;text-align:left}'
    + '.slwait div{display:flex;flex-direction:column;gap:4px}.slwait span:last-child{color:#64748b;font-size:13px}'
    + '@media (max-width:1023px){.slbox{height:calc(100vh - 96px);border-radius:10px}}';
  document.head.appendChild(css);
})();
