// ==================== ฝ่ายขาย (SALES) — เปิดระบบ Revenue Spunky Online ในหน้าเดียวกัน (ผู้ใช้ขอ 27/11/69) ====================
// ระบบเดิมทำงานเหมือนเดิม ข้อมูลอยู่ที่เดิม · เมนูด้านซ้ายสลับหน้าในกรอบ (postMessage) ไม่โหลดกรอบใหม่
// ลิงก์ระบบได้จาก API salesInfo (เฉพาะตั๋วฝ่ายขาย) — ไม่อยู่ในโค้ดหน้านี้ (repo สาธารณะ)
(function () {
  var S = window.SALESM = { url: '', win: null, ready: false };
  Object.assign(ICONS, {
    plus: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    chart2: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>'
  });
  var TABS = [
    { id: 'sl_dash', tab: 'dashboard', label: 'Dashboard ยอดขาย', ic: 'chart2' },
    { id: 'sl_add', tab: 'add', label: 'เพิ่มยอดขาย', ic: 'plus' },
    { id: 'sl_search', tab: 'search', label: 'ค้นหา / แก้ไข', ic: 'search' },
    { id: 'sl_import', tab: 'import', label: 'นำเข้า Order', ic: 'upload' },
    { id: 'sl_aff', tab: 'affiliate', label: 'Affiliate', ic: 'people' },
    { id: 'sl_labels', tab: 'labels', label: 'ใบจัดส่ง', ic: 'printer' },
    { id: 'sl_stock', tab: 'stock', label: 'ตัดสต๊อก', ic: 'box' }
  ];
  function tabOf(page) { return (TABS.filter(function (t) { return t.id === page; })[0] || TABS[0]).tab; }
  S.menus = function () { return TABS.map(function (t) { return { id: t.id, label: t.label, ic: t.ic }; }); };
  S.reset = function () { S.win = null; S.ready = false; };
  S.exportFile = function () { return null; };

  // ข้อความจากระบบในกรอบ: ready = โหลดเสร็จ · tab = ระบบเปลี่ยนหน้าเอง (ให้เมนูซ้ายตรงกัน)
  window.addEventListener('message', function (e) {
    var m = e.data; if (!m || !m.rev || !/\.googleusercontent\.com$/.test(String(e.origin).replace(/^https:\/\//, ''))) return;
    if (!state.dept || state.dept.module !== 'sales') return;
    S.win = e.source;
    if (m.rev === 'ready') {
      S.ready = true;
      var w = $('slWait'); if (w) w.classList.add('hidden');
      send(tabOf(state.page));
    } else if (m.rev === 'tab') {
      var t = TABS.filter(function (x) { return x.tab === m.tab; })[0];
      if (t && state.page !== t.id) { state.page = t.id; renderNav(); keepSave(); }
    }
  });
  function send(tab) { try { if (S.win) S.win.postMessage({ rev: 'go', tab: tab }, '*'); } catch (e) {} }

  S.render = function (page) {
    xpShowSales();
    var box = $('slBox');
    if (box && $('main').contains(box)) { if (S.ready) send(tabOf(page)); return; }   // กรอบเดิมยังอยู่ — สลับหน้าในกรอบ ไม่โหลดใหม่
    S.ready = false; S.win = null;
    $('main').innerHTML = '<div id="slBox" class="slbox"><div id="slWait" class="slwait"><span class="spinner dark"></span><div><b>กำลังเปิดระบบ Revenue Spunky Online…</b><span>ครั้งแรกอาจใช้เวลา 5–10 วินาที</span></div></div></div>';
    var go_ = function () {
      if (!$('slBox')) return;
      var f = document.createElement('iframe');
      f.id = 'slFrame'; f.title = 'Revenue Spunky Online';
      f.setAttribute('allow', 'clipboard-write');
      f.src = S.url + (S.url.indexOf('?') >= 0 ? '&' : '?') + 'tab=' + encodeURIComponent(tabOf(page));
      $('slBox').appendChild(f);
      setTimeout(function () { var w = $('slWait'); if (w && !S.ready) w.querySelector('span:last-child').textContent = 'ยังโหลดอยู่ — ถ้าค้างนาน กดเมนูอีกครั้ง หรือรีเฟรชหน้า'; }, 20000);
    };
    if (S.url) return go_();
    call('salesInfo', state.token).then(function (r) {
      if (!r || !r.ok) throw new Error(r && r.error || 'เปิดระบบไม่ได้');
      S.url = r.url; go_();
    }).catch(function (e) {
      if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
      $('main').innerHTML = '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>เปิดระบบงานขายไม่ได้</b><span>' + esc(e.message || e) + '</span></div></div>';
    });
  };
  // ปุ่ม Excel / PDF ด้านบนใช้กับหน้าในกรอบไม่ได้ (ระบบขายมีปุ่มดาวน์โหลดของตัวเอง) — ซ่อนไว้
  function xpShowSales() { ['xlsBtn', 'pdfBtn'].forEach(function (id) { var b = $(id); if (b) b.classList.add('hidden'); }); }

  var css = document.createElement('style');
  css.textContent = '.slbox{position:relative;background:#fff;border-radius:14px;overflow:hidden;box-shadow:var(--shadow);height:calc(100vh - 110px);min-height:560px}'
    + '.slbox iframe{display:block;width:100%;height:100%;border:0}'
    + '.slwait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px;background:#fff;z-index:1;padding:20px;text-align:left}'
    + '.slwait div{display:flex;flex-direction:column;gap:4px}.slwait span:last-child{color:#64748b;font-size:13px}'
    + '@media (max-width:1023px){.slbox{height:calc(100vh - 96px);border-radius:10px}}';
  document.head.appendChild(css);
})();
