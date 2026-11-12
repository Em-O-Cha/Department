// ==================== แผนกจัดซื้อ & สต๊อกสินค้า (PUR) ====================
// หน้าเว็บของโมดูล "purchasing" — index.html เรียก PUR.menus() / PUR.render(page)
// ข้อมูลอยู่ใน Google Sheet ของแผนก ผ่าน API Purchasing.gs (purLoad, purSaveMove, ...)
(function () {
  var P = window.PUR = { data: null, loading: null, q: {}, report: null };

  Object.assign(ICONS, {
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    clip: '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    print: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    line: '<path d="M21 11.5C21 7 17 3.5 12 3.5S3 7 3 11.5c0 4 3.2 7.3 7.6 7.9.3.1.7.2.8.5.1.2 0 .6 0 .9l-.1.8c0 .2-.2 1 .9.5s5.8-3.4 7.9-5.9c1.3-1.4 1.9-2.9 1.9-4.7z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
  });

  var MENUS = [
    { id: 'p_dash', label: 'ภาพรวม', ic: 'home' },
    { id: 'p_stock', label: 'รับเข้า / จ่ายออก', ic: 'box' },
    { id: 'p_mat', label: 'วัตถุดิบ & ราคา', ic: 'tag' },
    { id: 'p_doc', label: 'ใบ PR / PO', ic: 'doc' },
    { id: 'p_rfq', label: 'เปรียบเทียบราคา', ic: 'list' },
    { id: 'p_ven', label: 'ผู้ขาย (Vendor)', ic: 'phone' },
    { id: 'p_rep', label: 'รายงาน / พิมพ์', ic: 'chart' },
    { id: 'p_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var TYPE = { IN: 'รับเข้า', OUT: 'จ่ายออก', RETURN: 'ส่งคืนผู้ขาย', ADJ: 'ปรับยอด' };
  var DOC_ST = { draft: 'ร่าง', approved: 'อนุมัติแล้ว', ordered: 'สั่งแล้ว', partial: 'รับบางส่วน', received: 'รับของครบ', cancelled: 'ยกเลิก' };
  var MATCH_TAG = { ok: ['ok', '✓ ตรง 3 ทาง'], diff: ['lock', '⚠ ตรวจ 3 ทางไม่ตรง'], noinv: ['no', 'รอใบแจ้งหนี้'], norecv: ['', 'รอรับของ'] };
  function matchTag(d) { var m = d.type === 'PO' && d.status !== 'cancelled' && d.match && MATCH_TAG[d.match.status]; return m ? '<span class="tag ' + m[0] + '">' + m[1] + '</span>' : ''; }
  var PAY_ST = { unpaid: 'ยังไม่ชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระแล้ว', none: '-' };
  // ชื่อที่ใส่ให้อัตโนมัติตอนจ่ายออก (แก้ในช่องได้)
  var DEF_REQUESTER = 'ณิชกมล', DEF_ISSUER = 'สุชาดา';
  var STAFF = ['วิจิตรา', 'สุชาดา', 'ณิชกมล'];   // รายชื่อให้เลือก ผู้รับของ / ผู้เบิก / ผู้จ่าย
  function staffSel(id, label, value) {
    var opts = [['', '— เลือกชื่อ —']].concat(STAFF.map(function (n) { return [n, n]; }));
    if (value && STAFF.indexOf(value) < 0) opts.push([value, value]);   // ชื่อเดิมในข้อมูลเก่า
    return S(id, label, opts, value || '');
  }
  var FILE_LABELS = ['ไฟล์ PR / PO', 'ใบแจ้งหนี้ / ใบกำกับภาษี', 'PR ที่อนุมัติ', 'PO ที่อนุมัติ', 'ภาพอนุมัติทาง LINE', 'ใบเสนอราคา', 'ใบส่งของ / ใบกำกับ', 'COA / ผลตรวจ', 'หลักฐานการชำระเงิน', 'อื่น ๆ'];

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : esc(iso); }
  function n3(v) { return v === '' || v == null ? '-' : Number(v).toLocaleString('th-TH', { maximumFractionDigits: 3 }); }
  function baht(v) { return v === '' || v == null ? '-' : '฿' + Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function days(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function mat(id) { return P.idx.mat[id]; }
  function ven(id) { return P.idx.ven[id]; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('pur_' + k) || ''; localStorage.setItem('pur_' + k, v); } catch (e) { return ''; } }
  function telHref(p) { return 'tel:' + String(p).replace(/[^\d+]/g, ''); }

  function F(id, label, value, type, attrs) {
    return '<div class="pf"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + '></div>';
  }
  function S(id, label, options, value, attrs) {
    return '<div class="pf"><label for="' + id + '">' + label + '</label><select id="' + id + '"' + (attrs || '') + '>' + options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select></div>';
  }
  function hl(html) { return html.replace('<div class="pf">', '<div class="pf hl">'); }   // ช่องสำคัญ: ไฮไลต์สี
  function T(id, label, value) { return '<div class="pf full"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="2">' + esc(value || '') + '</textarea></div>'; }
  function v(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function wide(cfg) { cfg.wide = true; cfg.color = cfg.color || state.dept.color; openModal(cfg); }
  function vendorOptions(blank) {
    return [['', blank || '— ไม่ระบุ —']].concat(P.data.vendors.filter(function (x) { return x.active !== 'ปิด'; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'th'); }).map(function (x) { return [x.id, x.name]; }));
  }
  function materialList() { return P.data.materials.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'th'); }); }

  // ---------- โหลดข้อมูล ----------
  P.load = function () {
    if (P.loading) return P.loading;
    P.loading = call('purLoad', state.token).then(function (d) {
      P.data = d; P.idx = { mat: {}, ven: {}, doc: {} };
      d.materials.forEach(function (m) { P.idx.mat[m.id] = m; });
      d.vendors.forEach(function (x) { P.idx.ven[x.id] = x; });
      d.docs.forEach(function (x) { P.idx.doc[x.id] = x; });
      P.loading = null;
      return d;
    }, function (e) { P.loading = null; throw e; });
    return P.loading;
  };
  function reload(msg) {
    if (msg) toast(msg);
    return P.load().then(function () { if (String(state.page).indexOf('p_') === 0) P.render(state.page); }).catch(onServerError);
  }
  P.reset = function () { P.data = null; P.report = null; P.q = {}; };
  P.menus = function () { return MENUS; };

  P.render = function (page) {
    if (!P.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">กำลังโหลดข้อมูลจาก Google Sheet…</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      P.load().then(function () { if (state.page === page) P.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">เปิดข้อมูลไม่ได้</p><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet ของแผนก และเจ้าของชีตแชร์ให้บัญชีระบบเป็นผู้แก้ไข</span></div></div>';
      });
      return;
    }
    ({ p_dash: dash, p_stock: stock, p_mat: materials, p_doc: docs, p_rfq: rfqs, p_ven: vendors, p_rep: report, p_log: logPage }[page] || dash)();
  };

  // ==================== ภาพรวม ====================
  function dash() {
    var d = P.data, t = d.today || todayIso();
    var active = d.materials.filter(function (m) { return m.active !== 'ปิด'; });
    var low = active.filter(function (m) { return m.minStock !== '' && m.minStock != null && m.balance <= m.minStock; });
    var neg = active.filter(function (m) { return m.balance < 0; });
    var exp = [];
    active.forEach(function (m) { m.lots.forEach(function (l) { if (l.expDate && days(t, l.expDate) <= 30) exp.push({ m: m, l: l, left: days(t, l.expDate) }); }); });
    exp.sort(function (a, b) { return a.left - b.left; });
    var waiting = d.docs.filter(function (x) { return x.type === 'PO' && /approved|ordered|partial/.test(x.status); });
    var unpaid = d.docs.filter(function (x) { return x.type === 'PO' && x.status !== 'cancelled' && x.paymentStatus !== 'paid' && x.paymentStatus !== 'none'; });
    var unpaidSum = unpaid.reduce(function (s, x) { return s + (Number(x.total) || 0) - (Number(x.paidAmount) || 0); }, 0);
    var kpi = function (n, label, color, page) { return '<button class="kpi" data-go="' + page + '" style="--k:' + color + '"><b>' + n + '</b><span>' + label + '</span></button>'; };
    var html = '<h3>ภาพรวม จัดซื้อ & สต๊อก</h3><p class="lead">ข้อมูล ณ ' + dd(t) + ' · <a href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + '<div class="kpis">' + kpi(active.length, 'วัตถุดิบ', '#0f766e', 'p_mat') + kpi(low.length, 'สินค้าที่ต้องจัดซื้อ (ต่ำกว่า Minimum)', low.length ? '#dc2626' : '#64748b', 'p_stock')
      + kpi(exp.length, 'LOT ใกล้หมดอายุ (30 วัน)', exp.length ? '#d97706' : '#64748b', 'p_stock') + kpi(waiting.length, 'PO รอรับของ', '#2563eb', 'p_doc')
      + kpi(baht(unpaidSum).replace('.00', ''), 'ค้างชำระผู้ขาย (' + unpaid.length + ' ใบ)', unpaid.length ? '#7c3aed' : '#64748b', 'p_doc') + '</div>';
    var box = function (title, rows, empty) { return '<div class="panel pbox"><h4>' + title + '</h4>' + (rows.length ? rows.join('') : '<div class="muted">' + empty + '</div>') + '</div>'; };
    html += '<div class="pgrid">'
      + box(icon('warn', 18) + ' สินค้าที่ต้องจัดซื้อ (ต่ำกว่า Minimum)', low.concat(neg.filter(function (m) { return low.indexOf(m) < 0; })).slice(0, 30).map(function (m) {
        return '<div class="li"><span>' + esc(m.name) + '</span><b class="' + (m.balance < 0 ? 'neg' : 'warn') + '">' + n3(m.balance) + ' ' + esc(m.unit) + '</b><small>' + (m.minStock === '' || m.minStock == null ? 'ยอดติดลบ — ควรนับสต๊อกจริง' : 'Minimum ' + n3(m.minStock)) + '</small></div>';
      }), 'ยังไม่มีสินค้าที่ต้องจัดซื้อ (ตั้งค่า Minimum ได้ที่เมนูวัตถุดิบ & ราคา)')
      + box(icon('clock', 18) + ' LOT ใกล้หมดอายุ', exp.slice(0, 30).map(function (x) {
        return '<div class="li"><span>' + esc(x.m.name) + ' <small>LOT ' + esc(x.l.lot) + '</small></span><b class="' + (x.left < 0 ? 'neg' : 'warn') + '">' + (x.left < 0 ? 'หมดอายุแล้ว' : 'อีก ' + x.left + ' วัน') + '</b><small>' + dd(x.l.expDate) + ' · เหลือ ' + n3(x.l.qty) + '</small></div>';
      }), 'ไม่มี LOT ที่หมดอายุใน 30 วัน')
      + box(icon('doc', 18) + ' PO รอรับของ', waiting.map(function (x) {
        var late = x.deliveryDate && x.deliveryDate < t;
        return '<div class="li click" data-doc="' + x.id + '"><span>' + esc(x.docNo) + ' · ' + esc(x.vendorName) + '</span><b class="' + (late ? 'neg' : '') + '">ส่ง ' + dd(x.deliveryDate) + '</b><small>' + DOC_ST[x.status] + '</small></div>';
      }), 'ไม่มี PO ค้างรับ')
      + box(icon('warn', 18) + ' PO ตรวจ 3 ทางไม่ตรง', d.docs.filter(function (x) { return x.type === 'PO' && x.status !== 'cancelled' && x.match && x.match.status === 'diff'; }).map(function (x) {
        return '<div class="li click" data-doc="' + x.id + '"><span>' + esc(x.docNo) + ' · ' + esc(x.vendorName) + '</span><b class="neg">ไม่ตรง</b><small>' + esc((x.match.lines.filter(function (l) { return !l.ok; })[0] || { issues: [''] }).issues[0]) + '</small></div>';
      }), 'ไม่มี — PO ที่มีใบแจ้งหนี้ตรงกันทั้งหมด')
      + box(icon('doc', 18) + ' สัญญาผู้ขายใกล้หมด / หมดแล้ว (60 วัน)', d.vendors.filter(function (x) { var c = contractInfo(x); return c && c.left <= 60 && x.active !== 'ปิด'; }).map(function (x) {
        var c = contractInfo(x); return '<div class="li"><span>' + esc(x.name) + '</span><b class="' + (c.left < 0 ? 'neg' : 'warn') + '">' + (c.left < 0 ? 'หมดแล้ว' : 'อีก ' + c.left + ' วัน') + '</b><small>สิ้นสุด ' + dd(x.contractEnd) + '</small></div>';
      }), 'ไม่มีสัญญาที่ใกล้หมดอายุ')
      + box(icon('tag', 18) + ' ค้างชำระผู้ขาย', unpaid.sort(function (a, b) { return String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')); }).map(function (x) {
        var over = x.dueDate && x.dueDate < t;
        return '<div class="li click" data-doc="' + x.id + '"><span>' + esc(x.docNo) + ' · ' + esc(x.vendorName) + '</span><b class="' + (over ? 'neg' : '') + '">' + baht((Number(x.total) || 0) - (Number(x.paidAmount) || 0)) + '</b><small>ครบกำหนด ' + dd(x.dueDate) + (over ? ' (เลยกำหนด)' : '') + '</small></div>';
      }), 'ไม่มียอดค้างชำระ')
      + '</div>';
    $('main').innerHTML = html;
    on('[data-go]', 'click', function (el) { go(el.getAttribute('data-go')); }, $('main'));
    on('[data-doc]', 'click', function (el) { docModal(P.idx.doc[el.getAttribute('data-doc')]); }, $('main'));
  }

  // ==================== รับเข้า / จ่ายออก ====================
  function searchBar(key, ph, extra) {
    return '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="pq" type="search" placeholder="' + ph + '" value="' + esc(P.q[key] || '') + '"></div>' + (extra || '') + '</div>';
  }
  function bindSearch(key, fn) {
    var el = $('pq'); if (!el) return;
    el.addEventListener('input', function () { P.q[key] = el.value; fn(); });
  }
  function match(q, s) { q = String(q || '').trim().toLowerCase(); return !q || String(s).toLowerCase().indexOf(q) >= 0; }

  function stock() {
    $('main').innerHTML = '<h3>รับเข้า / จ่ายออก</h3><p class="lead">เลือกวัตถุดิบ แล้วกด รับเข้า หรือ จ่ายออก (วันที่ตั้งเป็นวันนี้ให้ก่อน แก้ได้)</p>'
      + searchBar('stock', 'ค้นหาวัตถุดิบ / ผู้ขาย', '<label class="pchk"><input type="checkbox" id="pLowOnly"' + (P.q.lowOnly ? ' checked' : '') + '> เฉพาะสินค้าที่ต้องจัดซื้อ</label>')
      + '<div id="pList" class="plist"></div>';
    var draw = function () {
      var q = P.q.stock;
      var list = materialList().filter(function (m) {
        if (m.active === 'ปิด') return false;
        if (P.q.lowOnly && !(m.minStock !== '' && m.balance <= m.minStock)) return false;
        var vn = ven(m.vendorId); return match(q, m.name + ' ' + (vn ? vn.name : '') + ' ' + m.category);
      });
      $('pList').innerHTML = list.length ? list.map(function (m) {
        var low = m.minStock !== '' && m.minStock != null && m.balance <= m.minStock, vn = ven(m.vendorId);
        return '<div class="prow"><div class="pinfo"><b>' + esc(m.name) + '</b><small>' + (vn ? esc(vn.name) : 'ไม่ระบุผู้ขาย') + (m.lastMove ? ' · เคลื่อนไหวล่าสุด ' + dd(m.lastMove) : '') + '</small></div>'
          + '<div class="pbal ' + (m.balance < 0 ? 'neg' : low ? 'warn' : '') + '">' + n3(m.balance) + '<small>' + esc(m.unit || 'หน่วย') + '</small></div>'
          + '<div class="pbtns"><button class="btn btn-sm pin" data-in="' + m.id + '">' + icon('plus', 16) + 'รับเข้า</button>'
          + '<button class="btn btn-sm pout" data-out="' + m.id + '">' + icon('minus', 16) + 'จ่ายออก</button>'
          + '<button class="btn btn-sm btn-line" data-hist="' + m.id + '" title="ประวัติ">' + icon('list', 16) + '<span class="hide-sm">ประวัติ</span></button></div></div>';
      }).join('') : '<div class="panel muted">ไม่พบวัตถุดิบ</div>';
      on('[data-in]', 'click', function (el) { moveModal({ type: 'IN', materialId: el.getAttribute('data-in') }); }, $('pList'));
      on('[data-out]', 'click', function (el) { moveModal({ type: 'OUT', materialId: el.getAttribute('data-out') }); }, $('pList'));
      on('[data-hist]', 'click', function (el) { historyModal(el.getAttribute('data-hist')); }, $('pList'));
    };
    bindSearch('stock', draw);
    $('pLowOnly').addEventListener('change', function () { P.q.lowOnly = this.checked; draw(); });
    draw();
  }

  // กล่องบันทึกรับเข้า / จ่ายออก / แก้ไขรายการ
  function moveModal(m, back) {
    var mm = mat(m.materialId); if (!mm) return;
    var edit = !!m.id, type = m.type, unit = mm.unit || 'หน่วย';
    var lots = mm.lots || [];
    var openPOs = P.data.docs.filter(function (d) { return d.type === 'PO' && (/approved|ordered|partial/.test(d.status) || d.id === m.docId) && d.items.some(function (it) { return it.materialId === mm.id; }); });
    var body = '<div class="pform">'
      + (edit ? S('mvType', 'ประเภท', Object.keys(TYPE).map(function (k) { return [k, TYPE[k]]; }), type) : (type === 'OUT' ? S('mvType', 'ประเภท', [['OUT', 'จ่ายออก (เบิกใช้)'], ['RETURN', 'ส่งคืนผู้ขาย']], 'OUT') : ''))
      + F('mvDate', 'วันที่คีย์ข้อมูล', m.date || todayIso(), 'date')
      + hl(F('mvQty', 'จำนวน (' + esc(unit) + ')' + (type === 'ADJ' ? ' (+ เพิ่ม / − ลด)' : ''), m.qty, 'number', ' step="any" inputmode="decimal" placeholder="0"'))
      + (type === 'IN'
        ? hl(F('mvLot', 'LOT (ตั้งเป็นวันที่รับให้อัตโนมัติ แก้ได้)', m.lot || dd(m.date || todayIso()), 'text')) + F('mvMfg', 'วันที่ผลิต', m.mfgDate, 'date') + F('mvExp', 'วันหมดอายุ', m.expDate, 'date')
          + S('mvDoc', 'อ้างอิงใบ PO', [['', '— ไม่อ้างอิง —']].concat(openPOs.map(function (d) { return [d.id, d.docNo + ' · ' + d.vendorName]; })), m.docId)
          + S('mvQc', 'ผลตรวจรับ (QC)', [['', '— ยังไม่ระบุ —'], ['ผ่าน', 'ผ่าน'], ['ผ่านแบบมีเงื่อนไข', 'ผ่านแบบมีเงื่อนไข'], ['ไม่ผ่าน', 'ไม่ผ่าน']], m.qc)
          + F('mvQcNote', 'หมายเหตุตรวจรับ', m.qcNote, 'text', ' placeholder="เช่น อุณหภูมิ, สภาพบรรจุภัณฑ์, COA"')
          + hl(staffSel('mvIssuer', 'ผู้รับของ', m.issuer != null ? m.issuer : store('receiver')))
        : S('mvLot', 'LOT', (lots.length ? lots.map(function (l) { return [l.lot, l.lot + ' (เหลือ ' + n3(l.qty) + (l.mfgDate ? ' · ผลิต ' + dd(l.mfgDate) : '') + (l.expDate ? ' · หมดอายุ ' + dd(l.expDate) : '') + ')']; }) : [['', '— ไม่มี LOT คงเหลือ —']])
            .concat(m.lot && !lots.some(function (l) { return l.lot === m.lot; }) ? [[m.lot, m.lot]] : []), m.lot || (lots[0] && lots[0].lot))
          + staffSel('mvReq', 'ผู้เบิก', m.requester != null ? m.requester : DEF_REQUESTER) + staffSel('mvIssuer', 'ผู้จ่าย', m.issuer != null ? m.issuer : DEF_ISSUER))
      + T('mvNote', 'หมายเหตุ', m.note)
      + (!edit && type === 'IN' ? '<div class="pf full"><label>แนบไฟล์ (ใบส่งของ / COA / รูป) — ไม่บังคับ</label><input id="mvFile" type="file" accept="image/*,application/pdf"></div>' : '')
      + '</div>'
      + '<div class="note">คงเหลือตอนนี้: <b>' + n3(mm.balance) + ' ' + esc(unit) + '</b>' + (edit ? ' · ที่มา: ' + esc(m.source || '-') : '') + '</div>';
    wide({
      icon: type === 'IN' ? 'plus' : type === 'ADJ' ? 'edit' : 'minus', title: (edit ? 'แก้ไขรายการ · ' : TYPE[type] + ' · ') + mm.name, sub: edit ? dd(m.date) + ' ' + TYPE[type] : 'บันทึกลง Google Sheet ของแผนก',
      body: body, ok: 'บันทึก',
      foot: edit ? '<button type="button" class="link-btn danger" id="mvDel">' + icon('trash', 16) + 'ลบรายการนี้</button>' : '',
      onOpen: function () {
        // LOT ของรับเข้า = วันที่ (dd/mm/yyyy) · เปลี่ยนวันที่แล้ว LOT เปลี่ยนตาม ถ้ายังไม่ได้พิมพ์ LOT เอง
        if (type === 'IN' && $('mvLot')) {
          var autoLot = $('mvLot').value === dd(v('mvDate'));
          $('mvLot').addEventListener('input', function () { autoLot = false; });
          $('mvDate').addEventListener('change', function () { if (autoLot && v('mvDate')) $('mvLot').value = dd(v('mvDate')); });
        }
        var del = $('mvDel'); if (del) del.addEventListener('click', function () { confirmDelete('ลบรายการ ' + TYPE[type] + ' ' + n3(m.qty) + ' ' + unit + ' วันที่ ' + dd(m.date) + ' ?', function () { return call('purDeleteMove', state.token, m.id); }, back); });
      },
      onCancel: back,
      check: function () {
        var q = Number(v('mvQty'));
        if (!v('mvQty') || !isFinite(q) || q === 0 || (v('mvType') !== 'ADJ' && type !== 'ADJ' && q < 0)) return 'กรอกจำนวนให้ถูกต้อง';
        if (!v('mvDate')) return 'เลือกวันที่คีย์ข้อมูล';
        if ($('mvMfg') && v('mvMfg') && v('mvExp') && v('mvMfg') > v('mvExp')) return 'วันที่ผลิตต้องไม่หลังวันหมดอายุ';
        if (v('mvDate') > todayIso()) return 'วันที่ต้องไม่เกินวันนี้';
        var nt = $('mvType') ? v('mvType') : type;
        if (nt === 'OUT' || nt === 'RETURN') {
          var old = !edit ? 0 : m.type === 'IN' ? -Number(m.qty) : m.type === 'ADJ' ? -Number(m.qty) : Number(m.qty);
          var avail = Math.round((mm.balance + old) * 1000) / 1000;
          if (q > avail + 0.0005) return 'จ่ายเกินคงเหลือ (เหลือ ' + n3(avail) + ' ' + unit + ') — ถ้ายอดจริงไม่ตรง ให้กด "ประวัติ" → "นับสต๊อกจริง / ปรับยอด"';
        }
        return '';
      },
      submit: function () {
        var rec = { id: m.id || '', type: $('mvType') ? v('mvType') : type, materialId: mm.id, date: v('mvDate'), qty: v('mvQty'), lot: v('mvLot'), expDate: v('mvExp'), mfgDate: $('mvMfg') ? v('mvMfg') : (m.mfgDate || ''),
          docId: v('mvDoc') || (edit ? m.docId : ''), qc: v('mvQc') || (edit ? m.qc : ''), qcNote: v('mvQcNote') || (edit && !$('mvQcNote') ? m.qcNote : ''),
          requester: v('mvReq'), issuer: v('mvIssuer'), note: v('mvNote') };
        if (type === 'IN' && rec.type === 'IN') rec.requester = edit ? m.requester : '';
        if (rec.type === 'IN' && v('mvIssuer')) store('receiver', v('mvIssuer'));
        var file = $('mvFile') && $('mvFile').files[0];
        return call('purSaveMove', state.token, rec).then(function (r) {
          if (!r.ok) return r.error;
          var done = function () { closeModal(); reload('บันทึก' + TYPE[rec.type] + 'แล้ว').then(function () { if (back) back(); }); };
          if (!file) return done();
          return upload('move', r.id, file, 'ใบส่งของ / COA').then(done, function (e) { closeModal(); reload('บันทึกแล้ว แต่แนบไฟล์ไม่สำเร็จ: ' + e.message); });
        });
      }
    });
  }

  function confirmDelete(msg, fn, back) {
    openModal({ color: '#dc2626', icon: 'trash', title: 'ยืนยันการลบ', sub: 'ลบแล้วกู้คืนไม่ได้ (มีบันทึกในประวัติการแก้ไข)', body: '<div class="note">' + esc(msg) + '</div>', ok: 'ลบ', onCancel: back,
      submit: function () { return fn().then(function (r) { if (r && r.ok === false) return r.error; closeModal(); reload('ลบแล้ว').then(function () { if (back) back(); }); }); } });
  }

  // ประวัติของวัตถุดิบ (ทุกรายการ) + ยอดคงเหลือสะสม
  function historyModal(id) {
    var mm = mat(id); if (!mm) return;
    wide({ icon: 'list', title: 'ประวัติ · ' + mm.name, sub: 'คงเหลือ ' + n3(mm.balance) + ' ' + (mm.unit || ''), body: '<div class="panel">กำลังโหลด…</div>', noOk: true, cancel: 'ปิด',
      foot: '<div class="pfoot"><button type="button" class="btn btn-sm btn-line" id="hAdj">' + icon('edit', 16) + 'นับสต๊อกจริง / ปรับยอด</button><button type="button" class="btn btn-sm btn-line" id="hPrint">' + icon('print', 16) + 'พิมพ์สต๊อกการ์ด</button></div>',
      onOpen: function () {
        $('hAdj').addEventListener('click', function () { adjustModal(mm); });
        $('hPrint').addEventListener('click', function () { closeModal(); P.q.repMat = mm.id; P.q.repDetail = true; P.q.repFrom = P.q.repFrom || ''; go('p_rep'); });
        call('purMoves', state.token, '', '', id).then(function (r) {
          if (!$('hAdj')) return;
          var bal = 0, rows = r.moves.map(function (x) { var s = x.type === 'IN' ? +x.qty : x.type === 'ADJ' ? +x.qty : -x.qty; bal = Math.round((bal + s) * 1000) / 1000; x._bal = bal; x._s = s; return x; }).reverse();
          P._hist = {}; rows.forEach(function (x) { P._hist[x.id] = x; });
          $('mBody').innerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>วันที่คีย์ข้อมูล</th><th>รายการ</th><th class="r">จำนวน</th><th class="r">คงเหลือ</th><th>LOT</th><th>ผู้เบิก/ผู้จ่าย</th><th></th></tr></thead><tbody>'
            + (rows.map(function (x) {
              return '<tr><td>' + dd(x.date) + '</td><td><span class="mt ' + x.type + '">' + TYPE[x.type] + '</span>' + (x.qc ? ' <small>QC: ' + esc(x.qc) + '</small>' : '') + (x.note ? '<br><small>' + esc(x.note) + '</small>' : '') + (x.files && x.files.length ? '<br>' + x.files.map(fileLink).join(' ') : '') + '</td>'
                + '<td class="r ' + (x._s < 0 ? 'neg' : 'pos') + '">' + (x._s > 0 ? '+' : '') + n3(x._s) + '</td><td class="r"><b>' + n3(x._bal) + '</b></td><td>' + esc(x.lot) + (x.mfgDate ? '<br><small>ผลิต ' + dd(x.mfgDate) + '</small>' : '') + (x.expDate ? '<br><small>หมดอายุ ' + dd(x.expDate) + '</small>' : '') + '</td>'
                + '<td><small>' + esc([x.requester, x.issuer].filter(String).join(' / ')) + '</small></td><td><button type="button" class="icon-btn" data-edit="' + x.id + '" title="แก้ไข">' + icon('edit', 16) + '</button></td></tr>';
            }).join('') || '<tr><td colspan="7" class="muted">ยังไม่มีรายการ</td></tr>') + '</tbody></table></div>';
          on('[data-edit]', 'click', function (el) { moveModal(P._hist[el.getAttribute('data-edit')], function () { historyModal(id); }); }, $('mBody'));
        }).catch(function (e) { if ($('mBody')) $('mBody').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
      } });
  }
  function adjustModal(mm) {
    wide({ icon: 'edit', title: 'นับสต๊อกจริง · ' + mm.name, sub: 'ระบบบันทึกส่วนต่างเป็นรายการ "ปรับยอด"',
      body: '<div class="note">คงเหลือในระบบ: <b>' + n3(mm.balance) + ' ' + esc(mm.unit || '') + '</b></div><div class="pform">' + F('adjCount', 'นับได้จริง (' + esc(mm.unit || 'หน่วย') + ')', '', 'number', ' step="any" inputmode="decimal"') + F('adjDate', 'วันที่นับ', todayIso(), 'date') + T('adjNote', 'หมายเหตุ', '') + '</div>',
      ok: 'บันทึกการปรับยอด', onCancel: function () { historyModal(mm.id); },
      check: function () { return v('adjCount') === '' || !isFinite(Number(v('adjCount'))) ? 'กรอกจำนวนที่นับได้' : Math.abs(Number(v('adjCount')) - mm.balance) < 0.0005 ? 'ยอดตรงกับระบบแล้ว ไม่ต้องปรับ' : ''; },
      submit: function () {
        var diff = Math.round((Number(v('adjCount')) - mm.balance) * 1000) / 1000;
        return call('purSaveMove', state.token, { type: 'ADJ', materialId: mm.id, qty: diff, date: v('adjDate'), note: ('นับสต๊อกได้ ' + v('adjCount') + ' ' + v('adjNote')).trim() }).then(function (r) {
          if (!r.ok) return r.error; closeModal(); reload('ปรับยอดแล้ว (' + (diff > 0 ? '+' : '') + diff + ')').then(function () { historyModal(mm.id); });
        });
      } });
  }

  // ==================== วัตถุดิบ & ราคา ====================
  function materials() {
    $('main').innerHTML = '<h3>วัตถุดิบ & ราคา</h3><p class="lead">แก้ชื่อ หน่วย ผู้ขาย Minimum · ปรับราคา (เก็บประวัติราคาทุกครั้ง)</p>'
      + searchBar('mat', 'ค้นหาวัตถุดิบ', '<button class="btn btn-sm btn-primary" id="pAddMat">' + icon('plus', 16) + 'เพิ่มวัตถุดิบ</button>') + '<div id="pList" class="plist"></div>';
    var draw = function () {
      var list = materialList().filter(function (m) { var vn = ven(m.vendorId); return match(P.q.mat, m.name + ' ' + (vn ? vn.name : '') + ' ' + m.category); });
      $('pList').innerHTML = list.map(function (m) {
        var vn = ven(m.vendorId);
        return '<button class="prow click" data-mat="' + m.id + '"><div class="pinfo"><b>' + esc(m.name) + (m.active === 'ปิด' ? ' <span class="tag no">ปิดใช้งาน</span>' : '') + '</b><small>'
          + (m.unit ? 'หน่วย: ' + esc(m.unit) : '<span class="warn">ยังไม่ระบุหน่วย</span>') + ' · ' + (vn ? esc(vn.name) : 'ไม่ระบุผู้ขาย') + (m.minStock !== '' ? ' · Minimum ' + n3(m.minStock) : '') + '</small></div>'
          + '<div class="pprice">' + (m.price !== '' ? baht(m.price) + '<small>ณ ' + dd(m.priceDate) + '</small>' : '<small>ยังไม่มีราคา</small>') + '</div></button>';
      }).join('') || '<div class="panel muted">ไม่พบวัตถุดิบ</div>';
      on('[data-mat]', 'click', function (el) { materialModal(mat(el.getAttribute('data-mat'))); }, $('pList'));
    };
    bindSearch('mat', draw);
    $('pAddMat').addEventListener('click', function () { materialModal(null); });
    draw();
  }
  function materialModal(m) {
    var edit = !!m; m = m || { name: '', unit: '', category: '', vendorId: '', minStock: '', note: '', active: 'ใช้งาน' };
    var body = '<div class="pform">' + F('maName', 'ชื่อวัตถุดิบ *', m.name) + F('maUnit', 'หน่วย', m.unit, 'text', ' placeholder="เช่น กก. / ถุง / ลัง / ขวด" list="unitList"')
      + '<datalist id="unitList">' + ['กก.', 'กรัม', 'ถุง', 'ลัง', 'ขวด', 'แกลลอน', 'ถัง', 'กล่อง', 'แพ็ค', 'ลิตร', 'ปี๊บ', 'กระสอบ'].map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>'
      + S('maVendor', 'ผู้ขายหลัก', vendorOptions(), m.vendorId) + F('maCat', 'หมวด', m.category, 'text', ' placeholder="เช่น เครื่องเทศ, น้ำมัน, บรรจุภัณฑ์"')
      + F('maMin', 'Minimum (จำนวนขั้นต่ำที่ต้องมี — เหลือเท่านี้ระบบเตือนให้สั่งซื้อ)', m.minStock, 'number', ' step="any" inputmode="decimal"')
      + S('maActive', 'สถานะ', [['ใช้งาน', 'ใช้งาน'], ['ปิด', 'ปิดใช้งาน (ซ่อนจากรายการรับ-จ่าย)']], m.active) + T('maNote', 'หมายเหตุ', m.note) + '</div>'
      + (edit ? '<div class="psec"><div class="psec-h"><b>ราคา</b><button type="button" class="btn btn-sm btn-primary" id="maPrice">' + icon('plus', 16) + 'ปรับราคา</button></div><div id="maPrices"><div class="muted">กำลังโหลดประวัติราคา…</div></div></div>' : '<div class="note">บันทึกแล้วจึงใส่ราคาได้</div>');
    wide({
      icon: 'tag', title: edit ? m.name : 'เพิ่มวัตถุดิบ', sub: edit ? 'คงเหลือ ' + n3(m.balance) + ' ' + (m.unit || '') : 'ข้อมูลวัตถุดิบ', body: body, ok: 'บันทึก',
      onOpen: function () {
        if (!edit) return;
        $('maPrice').addEventListener('click', function () { priceModal(m, null); });
        call('purPriceHistory', state.token, m.id).then(function (r) { drawPrices(m, r.prices); }).catch(function () { drawPrices(m, null); });
      },
      check: function () { return v('maName') ? '' : 'กรอกชื่อวัตถุดิบ'; },
      submit: function () {
        return call('purSaveMaterial', state.token, { id: edit ? m.id : '', name: v('maName'), unit: v('maUnit'), vendorId: v('maVendor'), category: v('maCat'), minStock: v('maMin'), active: v('maActive'), note: v('maNote') }).then(function (r) {
          if (!r.ok) return r.error; closeModal(); reload('บันทึกวัตถุดิบแล้ว').then(function () { if (!edit) materialModal(mat(r.material.id)); });
        });
      }
    });
  }
  function drawPrices(m, prices) {
    var box = $('maPrices'); if (!box) return;
    if (!prices) { box.innerHTML = '<div class="err">โหลดประวัติราคาไม่ได้</div>'; return; }
    P._prices = {}; prices.forEach(function (p) { P._prices[p.id] = p; });
    box.innerHTML = prices.length ? '<table class="ptable"><thead><tr><th>มีผลวันที่</th><th class="r">ราคา/หน่วย</th><th>ผู้ขาย</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' + prices.slice().reverse().map(function (p, i) {
      var vn = ven(p.vendorId);
      return '<tr' + (i === 0 ? ' class="cur"' : '') + '><td>' + dd(p.effectiveDate) + (i === 0 ? ' <span class="tag ok">ปัจจุบัน</span>' : '') + '</td><td class="r"><b>' + baht(p.price) + '</b></td><td><small>' + (vn ? esc(vn.name) : '-') + '</small></td><td><small>' + esc(p.note) + '</small></td>'
        + '<td><button type="button" class="icon-btn" data-pe="' + p.id + '">' + icon('edit', 16) + '</button></td></tr>';
    }).join('') + '</tbody></table>' : '<div class="muted">ยังไม่มีราคา — กด "ปรับราคา" เพื่อใส่ราคาแรก</div>';
    on('[data-pe]', 'click', function (el) { priceModal(m, P._prices[el.getAttribute('data-pe')]); }, box);
  }
  function priceModal(m, p) {
    var edit = !!p; p = p || { price: '', effectiveDate: todayIso(), vendorId: m.vendorId, note: '' };
    wide({ icon: 'tag', title: (edit ? 'แก้ไขราคา · ' : 'ปรับราคา · ') + m.name, sub: 'ราคาต่อ ' + (m.unit || 'หน่วย') + ' (ราคาเดิมยังเก็บเป็นประวัติ)',
      body: '<div class="pform">' + F('prPrice', 'ราคาต่อหน่วย (บาท)', p.price, 'number', ' step="any" inputmode="decimal"') + F('prDate', 'มีผลตั้งแต่วันที่', p.effectiveDate, 'date')
        + S('prVendor', 'ผู้ขาย', vendorOptions(), p.vendorId) + T('prNote', 'หมายเหตุ', p.note) + '</div>',
      foot: edit ? '<button type="button" class="link-btn danger" id="prDel">' + icon('trash', 16) + 'ลบราคานี้</button>' : '', ok: 'บันทึกราคา',
      onCancel: function () { materialModal(mat(m.id)); },
      onOpen: function () { var d = $('prDel'); if (d) d.addEventListener('click', function () { confirmDelete('ลบราคา ' + baht(p.price) + ' (มีผล ' + dd(p.effectiveDate) + ') ?', function () { return call('purDeletePrice', state.token, p.id); }, function () { materialModal(mat(m.id)); }); }); },
      check: function () { return v('prPrice') === '' || Number(v('prPrice')) < 0 ? 'กรอกราคา' : !v('prDate') ? 'เลือกวันที่มีผล' : ''; },
      submit: function () {
        return call('purSavePrice', state.token, { id: edit ? p.id : '', materialId: m.id, price: v('prPrice'), effectiveDate: v('prDate'), vendorId: v('prVendor'), note: v('prNote') }).then(function (r) {
          if (!r.ok) return r.error; closeModal(); reload('บันทึกราคาแล้ว').then(function () { materialModal(mat(m.id)); });
        });
      } });
  }

  // ==================== ใบ PR / PO ====================
  function docs() {
    var f = P.q.docType || '';
    $('main').innerHTML = '<h3>ใบ PR / PO</h3><p class="lead">ลง PR / PO: ใส่เลขที่ + แนบไฟล์ + รายการ · ใช้รับของตาม PO และตรวจ 3 ทางกับใบแจ้งหนี้ · ใบขอซื้อ (PR) และใบสั่งซื้อ (PO) หลายรายการต่อใบ · แนบไฟล์ใบที่อนุมัติ / ภาพอนุมัติทาง LINE · ติดตามการชำระเงิน</p>'
      + searchBar('doc', 'ค้นหาเลขที่ / ผู้ขาย / วัตถุดิบ', '<button class="btn btn-sm btn-primary" data-new="PR">' + icon('plus', 16) + 'PR</button><button class="btn btn-sm btn-primary" data-new="PO">' + icon('plus', 16) + 'PO</button>')
      + '<div class="pchips">' + [['', 'ทั้งหมด'], ['PR', 'PR'], ['PO', 'PO'], ['open', 'PO รอรับของ'], ['unpaid', 'ค้างชำระ']].map(function (c) { return '<button class="chip' + (f === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
      + '<div id="pList" class="plist"></div>';
    var draw = function () {
      var t = P.data.today;
      var list = P.data.docs.filter(function (d) {
        if (f === 'PR' || f === 'PO') { if (d.type !== f) return false; }
        if (f === 'open' && !(d.type === 'PO' && /approved|ordered|partial/.test(d.status))) return false;
        if (f === 'unpaid' && !(d.type === 'PO' && d.status !== 'cancelled' && d.paymentStatus !== 'paid' && d.paymentStatus !== 'none')) return false;
        return match(P.q.doc, d.docNo + ' ' + d.vendorName + ' ' + d.items.map(function (i) { return i.materialName; }).join(' '));
      }).sort(function (a, b) { return String(b.orderDate).localeCompare(String(a.orderDate)) || String(b.docNo).localeCompare(String(a.docNo)); });
      $('pList').innerHTML = list.map(function (d) {
        var over = d.type === 'PO' && d.paymentStatus !== 'paid' && d.dueDate && d.dueDate < t;
        return '<button class="prow click" data-doc="' + d.id + '"><div class="pinfo"><b><span class="dt ' + d.type + '">' + d.type + '</span> ' + esc(d.docNo) + ' · ' + esc(d.vendorName || '-') + '</b>'
          + '<small>สั่ง ' + dd(d.orderDate) + ' · ส่ง ' + dd(d.deliveryDate) + ' · ' + d.items.length + ' รายการ' + (d.files.length ? ' · ' + icon('clip', 12) + d.files.length : '') + '</small>'
          + '<div><span class="tag st-' + d.status + '">' + (DOC_ST[d.status] || d.status) + '</span>' + matchTag(d) + (d.type === 'PO' ? '<span class="tag ' + (d.paymentStatus === 'paid' ? 'ok' : over ? 'lock' : 'no') + '">' + PAY_ST[d.paymentStatus] + (over ? ' · เลยกำหนด' : '') + '</span>' : '') + '</div></div>'
          + '<div class="pprice">' + baht(d.total) + '</div></button>';
      }).join('') || '<div class="panel muted">ยังไม่มีเอกสาร</div>';
      on('[data-doc]', 'click', function (el) { docModal(P.idx.doc[el.getAttribute('data-doc')]); }, $('pList'));
    };
    bindSearch('doc', draw);
    on('[data-f]', 'click', function (el) { P.q.docType = el.getAttribute('data-f'); docs(); }, $('main'));
    on('[data-new]', 'click', function (el) { docModal(null, el.getAttribute('data-new')); }, $('main'));
    draw();
  }

  function docModal(d, newType, from) {
    var edit = !!d, t = todayIso();
    d = d || { type: newType, docNo: '', rfqId: from && from.rfqId || '', refId: from ? from.id || '' : '', vendorId: from ? from.vendorId : '', vendorName: from ? from.vendorName : '', vendorPhone: from ? from.vendorPhone : '',
      orderDate: t, deliveryDate: from ? from.deliveryDate : '', status: 'draft', approvedBy: '', approvedDate: '', paymentStatus: newType === 'PO' ? 'unpaid' : 'none', dueDate: '', paidDate: '', paidAmount: '', note: '',
      items: from ? from.items.map(function (i) { return { materialId: i.materialId, materialName: i.materialName, qty: i.qty, unit: i.unit, price: i.price }; }) : [], files: [] };
    var isPO = d.type === 'PO';
    var prs = P.data.docs.filter(function (x) { return x.type === 'PR' && x.status !== 'cancelled'; });
    var body = '<datalist id="matList">' + materialList().filter(function (m) { return m.active !== 'ปิด'; }).map(function (m) { return '<option value="' + esc(m.name) + '">'; }).join('') + '</datalist>'
      + '<div class="pform">'
      + hl(F('dNo', 'เลขที่ ' + d.type + ' *', d.docNo, 'text', ' placeholder="เลขที่ตามใบ ' + d.type + '"'))
      + (isPO ? S('dRef', 'อ้างอิง PR', [['', '— ไม่อ้างอิง —']].concat(prs.map(function (x) { return [x.id, x.docNo + ' · ' + (x.vendorName || '')]; })), d.refId) : '')
      + (isPO ? hl(S('dVendor', 'ผู้ขาย (เลือกจากรายชื่อ) *', vendorOptions('— เลือกผู้ขาย —'), d.vendorId)) : S('dVendor', 'ผู้ขาย (เลือกจากรายชื่อ)', vendorOptions('— เลือก / พิมพ์เองด้านล่าง —'), d.vendorId))
      + F('dVName', 'ชื่อผู้ขาย', d.vendorName) + F('dVPhone', 'เบอร์โทรผู้ขาย', d.vendorPhone, 'tel')
      + F('dOrder', 'วันที่สั่ง', d.orderDate, 'date') + (isPO ? hl(F('dDeliver', 'วันที่ส่งของ (กำหนดส่ง) *', d.deliveryDate, 'date')) : F('dDeliver', 'วันที่ส่งของ', d.deliveryDate, 'date'))
      + S('dStatus', 'สถานะ', Object.keys(DOC_ST).filter(function (k) { return isPO || !/ordered|partial|received/.test(k); }).map(function (k) { return [k, DOC_ST[k]]; }), d.status)
      + F('dAppBy', 'ผู้อนุมัติ', d.approvedBy) + F('dAppDate', 'วันที่อนุมัติ', d.approvedDate, 'date')
      + '</div>'
      + '<div class="psec"><div class="psec-h"><b>รายการ</b><button type="button" class="btn btn-sm btn-line" id="dAdd">' + icon('plus', 16) + 'เพิ่มรายการ</button></div><div id="dItems"></div><div class="ptotal">รวม <b id="dTotal">฿0.00</b></div></div>'
      + (isPO ? '<div class="psec"><div class="psec-h"><b>การชำระเงินผู้ขาย</b></div><div class="pform">'
        + S('dPay', 'สถานะชำระเงิน', [['unpaid', 'ยังไม่ชำระ'], ['partial', 'ชำระบางส่วน'], ['paid', 'ชำระแล้ว']], d.paymentStatus)
        + F('dDue', 'ครบกำหนดชำระ', d.dueDate, 'date') + F('dPaidDate', 'วันที่ชำระ', d.paidDate, 'date') + F('dPaid', 'ยอดที่ชำระ (บาท)', d.paidAmount, 'number', ' step="any" inputmode="decimal"')
        + '<div class="pf full"><label for="dMatchNote">เหตุผลที่ชำระแม้ตรวจ 3 ทางไม่ตรง (ใส่เมื่อจำเป็นเท่านั้น)</label><input id="dMatchNote" type="text" value="' + esc(d.matchNote || '') + '"></div></div></div>'
        + (edit ? '<div class="psec"><div class="psec-h"><b>ตรวจ 3 ทาง: PO ↔ รับของ ↔ ใบแจ้งหนี้</b><button type="button" class="btn btn-sm btn-line" id="dInv">' + icon('plus', 16) + 'เพิ่มใบแจ้งหนี้</button></div><div id="dMatch"></div></div>' : '') : '')
      + '<div class="pform">' + T('dNote', 'หมายเหตุ', d.note) + '</div>'
      + '<div class="psec"><div class="psec-h"><b>' + icon('clip', 16) + ' ไฟล์แนบ</b></div>' + (edit
        ? '<div id="dFiles"></div><div class="pupload">' + S('dFileLabel', 'ประเภทไฟล์', FILE_LABELS.map(function (x) { return [x, x]; }), 'ไฟล์ PR / PO') + '<div class="pf"><label>เลือกรูป / PDF (อัปโหลดทันที)</label><input id="dFile" type="file" accept="image/*,application/pdf" multiple></div></div>'
        : '<div class="note">กดบันทึกก่อน แล้วจึงแนบไฟล์ PR/PO ที่อนุมัติ หรือภาพอนุมัติทาง LINE ได้</div>') + '</div>';
    var items = d.items.map(function (i) { return { materialId: i.materialId, materialName: i.materialName, qty: i.qty, unit: i.unit, price: i.price }; });
    if (!items.length) items.push({ materialId: '', materialName: '', qty: '', unit: '', price: '' });
    var drawItems = function () {
      $('dItems').innerHTML = '<div class="pitems">' + items.map(function (it, i) {
        return '<div class="pitem" data-i="' + i + '"><input class="iname" list="matList" placeholder="วัตถุดิบ" value="' + esc(it.materialName) + '">'
          + '<input class="iqty" type="number" step="any" inputmode="decimal" placeholder="จำนวน" value="' + esc(it.qty) + '"><input class="iunit" placeholder="หน่วย" value="' + esc(it.unit) + '">'
          + '<input class="iprice" type="number" step="any" inputmode="decimal" placeholder="ราคา/หน่วย" value="' + esc(it.price) + '"><span class="iamt">' + (it.qty !== '' && it.price !== '' ? baht(it.qty * it.price) : '-') + '</span>'
          + '<button type="button" class="icon-btn" data-rm="' + i + '" title="ลบรายการ">' + icon('trash', 16) + '</button></div>';
      }).join('') + '</div>';
      sumItems();
      on('.pitem input', 'input', function (el) {
        var row = el.closest('.pitem'), it = items[+row.getAttribute('data-i')];
        if (el.classList.contains('iname')) {
          it.materialName = el.value;
          var m = P.data.materials.filter(function (x) { return x.name === el.value; })[0];
          it.materialId = m ? m.id : '';
          if (m) { if (!it.unit) { it.unit = m.unit; row.querySelector('.iunit').value = m.unit; } if (it.price === '' && m.price !== '') { it.price = m.price; row.querySelector('.iprice').value = m.price; } }
        } else if (el.classList.contains('iqty')) it.qty = el.value;
        else if (el.classList.contains('iunit')) it.unit = el.value;
        else it.price = el.value;
        row.querySelector('.iamt').textContent = it.qty !== '' && it.price !== '' ? baht(it.qty * it.price) : '-';
        sumItems();
      }, $('dItems'));
      on('[data-rm]', 'click', function (el) { items.splice(+el.getAttribute('data-rm'), 1); if (!items.length) items.push({ materialId: '', materialName: '', qty: '', unit: '', price: '' }); drawItems(); }, $('dItems'));
    };
    var sumItems = function () { $('dTotal').textContent = baht(items.reduce(function (s, it) { return s + (it.qty !== '' && it.price !== '' ? it.qty * it.price : 0); }, 0)); };
    var drawFiles = function (files) {
      var box = $('dFiles'); if (!box) return;
      box.innerHTML = files.length ? files.map(function (f) {
        return '<div class="pfile">' + fileLink(f) + '<small>' + esc(f.at || '') + '</small><button type="button" class="icon-btn" data-rf="' + esc(f.id) + '" title="ลบไฟล์">' + icon('trash', 16) + '</button></div>';
      }).join('') : '<div class="muted">ยังไม่มีไฟล์แนบ</div>';
      on('[data-rf]', 'click', function (el) {
        if (!confirm('ลบไฟล์นี้?')) return;
        call('purRemoveFile', state.token, 'doc', d.id, el.getAttribute('data-rf')).then(function (r) { if (!r.ok) return toast(r.error); d.files = r.files; drawFiles(r.files); reload(); }).catch(onServerError);
      }, box);
    };
    wide({
      icon: 'doc', title: (edit ? d.type + ' ' + d.docNo : 'สร้าง ' + d.type) + (from ? ' จาก ' + from.docNo : ''), sub: edit ? (DOC_ST[d.status] || '') + ' · ' + baht(d.total) : (isPO ? 'ใบสั่งซื้อ' : 'ใบขอซื้อ'),
      body: body, ok: 'บันทึก',
      foot: '<div class="pfoot">' + (edit && !isPO ? '<button type="button" class="btn btn-sm btn-line" id="dToPO">' + icon('doc', 16) + 'ลง PO ที่อ้างอิง PR นี้</button>' : '')
        + (edit && isPO && /approved|ordered|partial/.test(d.status) ? '<button type="button" class="btn btn-sm btn-line" id="dRecv">' + icon('plus', 16) + 'รับของตาม PO</button>' : '') + '</div>',
      onOpen: function () {
        drawItems();
        $('dAdd').addEventListener('click', function () { items.push({ materialId: '', materialName: '', qty: '', unit: '', price: '' }); drawItems(); var all = $('dItems').querySelectorAll('.iname'); all[all.length - 1].focus(); });
        $('dVendor').addEventListener('change', function () {
          var vn = ven(this.value); if (!vn) return;
          $('dVName').value = vn.name; $('dVPhone').value = vn.phone || vn.phone2 || '';
          if (isPO && vn.creditDays !== '' && !v('dDue') && v('dOrder')) $('dDue').value = addDays(v('dOrder'), Number(vn.creditDays) || 0);
        });
        if (isPO) $('dPay').addEventListener('change', function () { if (this.value === 'paid' && !v('dPaid')) { $('dPaid').value = items.reduce(function (s, it) { return s + (it.qty !== '' && it.price !== '' ? it.qty * it.price : 0); }, 0).toFixed(2); if (!v('dPaidDate')) $('dPaidDate').value = todayIso(); } });
        if (edit) {
          drawFiles(d.files || []);
          $('dFile').addEventListener('change', function () {
            var files = Array.prototype.slice.call(this.files), label = v('dFileLabel'), inp = this;
            if (!files.length) return;
            inp.disabled = true; $('mErr').textContent = 'กำลังอัปโหลด ' + files.length + ' ไฟล์…';
            files.reduce(function (p, f) { return p.then(function () { return upload('doc', d.id, f, label).then(function (r) { d.files = r.files; drawFiles(r.files); }); }); }, Promise.resolve())
              .then(function () { $('mErr').textContent = ''; toast('แนบไฟล์แล้ว'); reload(); }, function (e) { $('mErr').textContent = 'อัปโหลดไม่สำเร็จ: ' + e.message; })
              .then(function () { inp.disabled = false; inp.value = ''; });
          });
          if (isPO) {
            drawMatch($('dMatch'), d);
            $('dInv').addEventListener('click', function () { invoiceModal(d, null); });
          }
          if ($('dToPO')) $('dToPO').addEventListener('click', function () { docModal(null, 'PO', d); });
          if ($('dRecv')) $('dRecv').addEventListener('click', function () {
            var first = d.items.filter(function (i) { return mat(i.materialId); })[0];
            if (!first) return toast('รายการในใบนี้ไม่ได้ผูกกับวัตถุดิบในระบบ');
            moveModal({ type: 'IN', materialId: first.materialId, qty: first.qty, docId: d.id }, function () { docModal(P.idx.doc[d.id]); });
          });
        }
      },
      check: function () {
        var filled = items.filter(function (it) { return it.materialName.trim() && it.qty !== ''; });
        if (!v('dNo')) return 'กรอกเลขที่ ' + d.type;
        if (isPO && !v('dVendor')) return 'เลือกผู้ขายจากรายชื่อ (ใช้ทำรายงานผู้บริหาร) — ถ้ายังไม่มี เพิ่มที่เมนูผู้ขายก่อน';
        if (isPO && !v('dDeliver')) return 'ใส่วันที่ส่งของ (ใช้วัดว่าผู้ขายส่งตรงเวลาหรือไม่)';
        if (!filled.length) return 'เพิ่มรายการวัตถุดิบ (ชื่อ + จำนวน) อย่างน้อย 1 รายการ';
        if (items.some(function (it) { return it.materialName.trim() && it.qty === ''; })) return 'กรอกจำนวนให้ครบทุกรายการ';
        return '';
      },
      submit: function () {
        var rec = { id: edit ? d.id : '', type: d.type, docNo: v('dNo'), refId: v('dRef'), vendorId: v('dVendor'), vendorName: v('dVName'), vendorPhone: v('dVPhone'), orderDate: v('dOrder'), deliveryDate: v('dDeliver'),
          status: v('dStatus'), approvedBy: v('dAppBy'), approvedDate: v('dAppDate'), paymentStatus: isPO ? v('dPay') : 'none', dueDate: v('dDue'), paidDate: v('dPaidDate'), paidAmount: v('dPaid'), note: v('dNote'), matchNote: v('dMatchNote'), rfqId: d.rfqId || '' };
        return call('purSaveDoc', state.token, rec, items.filter(function (it) { return it.materialName.trim(); })).then(function (r) {
          if (!r.ok) { if (r.needReason && $('dMatchNote')) $('dMatchNote').focus(); return r.error; }
          closeModal();
          reload((edit ? 'บันทึก ' : 'ลง ') + r.docNo + ' แล้ว').then(function () { if (!edit) docModal(P.idx.doc[r.id]); });
        });
      }
    });
  }
  function fileLink(f) { return '<a class="flink" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + icon('clip', 14) + esc(f.label ? f.label + ': ' : '') + esc(f.name) + '</a>'; }

  // อ่านไฟล์ → base64 (รูปใหญ่ย่อเหลือด้านยาว 2000px) → purUploadFile
  function upload(ownerType, ownerId, file, label) {
    if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error('ไฟล์ใหญ่เกิน 15 MB'));
    var read = function (blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(blob); }); };
    var shrink = function () {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return Promise.resolve({ blob: file, type: file.type, name: file.name });
      return new Promise(function (res) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var k = Math.min(1, 2000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { res({ blob: b || file, type: b ? 'image/jpeg' : file.type, name: b ? file.name.replace(/\.\w+$/, '') + '.jpg' : file.name }); }, 'image/jpeg', 0.85);
        };
        img.onerror = function () { res({ blob: file, type: file.type, name: file.name }); };
        img.src = url;
      });
    };
    var type = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
    if (!/^image\/|^application\/pdf$/.test(type)) return Promise.reject(new Error('แนบได้เฉพาะรูปภาพหรือ PDF'));
    return shrink().then(function (x) {
      return read(x.blob).then(function (b64) { return call('purUploadFile', state.token, ownerType, ownerId, x.name, x.type === 'image/jpg' ? 'image/jpeg' : x.type, b64, label); });
    }).then(function (r) { if (!r.ok) throw new Error(r.error); return r; });
  }

  // ==================== ผู้ขาย ====================
  function vendors() {
    $('main').innerHTML = '<h3>ผู้ขาย (Vendor)</h3><p class="lead">กดเบอร์เพื่อโทรได้ทันที · เก็บข้อมูลติดต่อ เครดิต บัญชีธนาคาร สินค้าที่ขาย</p>'
      + searchBar('ven', 'ค้นหาชื่อ / ผู้ติดต่อ / สินค้า', '<button class="btn btn-sm btn-primary" id="pAddVen">' + icon('plus', 16) + 'เพิ่มผู้ขาย</button>') + '<div id="pList" class="pcards"></div>';
    var draw = function () {
      var list = P.data.vendors.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'th'); }).filter(function (x) { return match(P.q.ven, [x.name, x.contact, x.items, x.phone, x.note].join(' ')); });
      $('pList').innerHTML = list.map(function (x) {
        var mats = P.data.materials.filter(function (m) { return m.vendorId === x.id; });
        var phones = [x.phone, x.phone2].filter(String);
        return '<div class="vcard' + (x.active === 'ปิด' ? ' off' : '') + '"><div class="vhead"><b>' + esc(x.name) + '</b><button type="button" class="icon-btn" data-ven="' + x.id + '" title="แก้ไข">' + icon('edit', 16) + '</button></div>'
          + (x.contact ? '<div class="muted">ผู้ติดต่อ: ' + esc(x.contact) + '</div>' : '')
          + (function () { var c = contractInfo(x), e = latestEval(x.id); return c || e ? '<div>' + (c ? '<span class="tag ' + c.cls + '">' + c.text + '</span>' : '') + (e ? '<span class="tag code">' + qLabel(e.period) + ' ' + stars(e.score) + ' ' + e.score + '</span>' : '') + '</div>' : ''; })()
          + '<div class="vacts">' + phones.map(function (p) { return '<a class="btn btn-sm vcall" href="' + telHref(p) + '">' + icon('phone', 16) + esc(p) + '</a>'; }).join('')
          + (x.line ? '<span class="btn btn-sm btn-line">' + icon('line', 16) + esc(x.line) + '</span>' : '') + (x.email ? '<a class="btn btn-sm btn-line" href="mailto:' + esc(x.email) + '">' + icon('mail', 16) + 'อีเมล</a>' : '')
          + (!phones.length ? '<span class="muted">ยังไม่มีเบอร์โทร — กดแก้ไขเพื่อเพิ่ม</span>' : '') + '</div>'
          + '<div class="vmeta">' + (x.creditDays !== '' ? '<span>เครดิต ' + x.creditDays + ' วัน</span>' : '') + (x.bank ? '<span>' + esc(x.bank) + ' ' + esc(x.bankAccount) + '</span>' : '')
          + (mats.length ? '<span>วัตถุดิบ: ' + mats.map(function (m) { return esc(m.name); }).slice(0, 6).join(', ') + (mats.length > 6 ? ' +' + (mats.length - 6) : '') + '</span>' : '') + (x.items ? '<span>สินค้า: ' + esc(x.items) + '</span>' : '') + '</div></div>';
      }).join('') || '<div class="panel muted">ไม่พบผู้ขาย</div>';
      on('[data-ven]', 'click', function (el) { vendorModal(ven(el.getAttribute('data-ven'))); }, $('pList'));
    };
    bindSearch('ven', draw);
    $('pAddVen').addEventListener('click', function () { vendorModal(null); });
    draw();
  }
  function vendorModal(x) {
    var edit = !!x; x = x || { name: '', active: 'ใช้งาน', creditDays: '' };
    wide({ icon: 'phone', title: edit ? x.name : 'เพิ่มผู้ขาย', sub: 'ข้อมูลผู้ขาย',
      body: '<div class="pform">' + F('vnName', 'ชื่อผู้ขาย / บริษัท *', x.name) + F('vnContact', 'ผู้ติดต่อ', x.contact) + F('vnPhone', 'เบอร์โทร', x.phone, 'tel') + F('vnPhone2', 'เบอร์โทร 2', x.phone2, 'tel')
        + F('vnLine', 'LINE ID', x.line) + F('vnEmail', 'อีเมล', x.email, 'email') + F('vnTax', 'เลขผู้เสียภาษี', x.taxId, 'text', ' inputmode="numeric"') + F('vnCredit', 'เครดิต (วัน)', x.creditDays, 'number', ' inputmode="numeric"')
        + F('vnBank', 'ธนาคาร', x.bank) + F('vnAcc', 'เลขบัญชี', x.bankAccount, 'text', ' inputmode="numeric"') + T('vnAddr', 'ที่อยู่', x.address) + T('vnItems', 'สินค้าที่ขาย', x.items) + T('vnNote', 'หมายเหตุ', x.note)
        + S('vnActive', 'สถานะ', [['ใช้งาน', 'ใช้งาน'], ['ปิด', 'เลิกใช้']], x.active) + '</div>'
        + '<div class="psec"><div class="psec-h"><b>สัญญา / ข้อตกลง</b></div><div class="pform">' + F('vnCs', 'สัญญาเริ่ม', x.contractStart, 'date') + F('vnCe', 'สัญญาสิ้นสุด', x.contractEnd, 'date') + T('vnCn', 'รายละเอียดสัญญา (ราคาตกลง, เงื่อนไข)', x.contractNote) + '</div>'
        + (edit ? '<div id="vnFiles"></div><div class="pupload">' + S('vnFileLabel', 'ประเภทไฟล์', [['สัญญา / ข้อตกลง', 'สัญญา / ข้อตกลง'], ['เอกสารบริษัท (ภพ.20 / หนังสือรับรอง)', 'เอกสารบริษัท (ภพ.20 / หนังสือรับรอง)'], ['ใบรับรองมาตรฐาน (GMP / HACCP / อย.)', 'ใบรับรองมาตรฐาน (GMP / HACCP / อย.)'], ['อื่น ๆ', 'อื่น ๆ']], 'สัญญา / ข้อตกลง') + '<div class="pf"><label>เลือกรูป / PDF (อัปโหลดทันที)</label><input id="vnFile" type="file" accept="image/*,application/pdf" multiple></div></div>' : '<div class="note">บันทึกก่อนแล้วจึงแนบไฟล์สัญญาได้</div>') + '</div>'
        + (edit ? '<div class="psec"><div class="psec-h"><b>ผลประเมินผู้ขาย (รายไตรมาส)</b><button type="button" class="btn btn-sm btn-primary" id="vnEval">' + icon('check', 16) + 'ประเมิน</button></div><div id="vnEvals"></div></div>' : ''),
      ok: 'บันทึก', check: function () { return v('vnName') ? '' : 'กรอกชื่อผู้ขาย'; },
      onOpen: function () {
        if (!edit) return;
        var drawF = function (files) {
          $('vnFiles').innerHTML = files.length ? files.map(function (f) { return '<div class="pfile">' + fileLink(f) + '<small>' + esc(f.at || '') + '</small><button type="button" class="icon-btn" data-rf="' + esc(f.id) + '">' + icon('trash', 16) + '</button></div>'; }).join('') : '<div class="muted">ยังไม่มีไฟล์แนบ</div>';
          on('[data-rf]', 'click', function (el) { if (!confirm('ลบไฟล์นี้?')) return; call('purRemoveFile', state.token, 'vendor', x.id, el.getAttribute('data-rf')).then(function (r) { if (!r.ok) return toast(r.error); x.files = r.files; drawF(r.files); reload(); }).catch(onServerError); }, $('vnFiles'));
        };
        drawF(x.files || []);
        $('vnFile').addEventListener('change', function () {
          var files = Array.prototype.slice.call(this.files), label = v('vnFileLabel'), inp = this;
          if (!files.length) return; inp.disabled = true; $('mErr').textContent = 'กำลังอัปโหลด…';
          files.reduce(function (pr, f) { return pr.then(function () { return upload('vendor', x.id, f, label).then(function (r) { x.files = r.files; drawF(r.files); }); }); }, Promise.resolve())
            .then(function () { $('mErr').textContent = ''; toast('แนบไฟล์แล้ว'); reload(); }, function (e2) { $('mErr').textContent = 'อัปโหลดไม่สำเร็จ: ' + e2.message; }).then(function () { inp.disabled = false; inp.value = ''; });
        });
        var evs = P.data.evals.filter(function (e) { return e.vendorId === x.id; }).sort(function (a, b) { return b.period.localeCompare(a.period); });
        $('vnEvals').innerHTML = evs.length ? '<table class="ptable"><thead><tr><th>รอบ</th><th class="r">คุณภาพ</th><th class="r">ตรงเวลา</th><th class="r">ราคา</th><th class="r">บริการ</th><th class="r">เฉลี่ย</th><th></th></tr></thead><tbody>'
          + evs.map(function (e) { return '<tr><td>' + qLabel(e.period) + (e.comment ? '<br><small class="muted">' + esc(e.comment) + '</small>' : '') + '</td><td class="r">' + e.quality + '</td><td class="r">' + e.delivery + '</td><td class="r">' + e.price + '</td><td class="r">' + e.service + '</td><td class="r"><b>' + e.score + '</b><br>' + stars(e.score) + '</td><td><button type="button" class="icon-btn" data-ev="' + e.id + '">' + icon('edit', 16) + '</button></td></tr>'; }).join('')
          + '</tbody></table>' : '<div class="muted">ยังไม่มีผลประเมิน</div>';
        on('[data-ev]', 'click', function (el) { evalModal(x, evs.filter(function (e) { return e.id === el.getAttribute('data-ev'); })[0]); }, $('vnEvals'));
        $('vnEval').addEventListener('click', function () { evalModal(x, null); });
      },
      submit: function () {
        return call('purSaveVendor', state.token, { id: edit ? x.id : '', name: v('vnName'), contact: v('vnContact'), phone: v('vnPhone'), phone2: v('vnPhone2'), line: v('vnLine'), email: v('vnEmail'), taxId: v('vnTax'),
          creditDays: v('vnCredit'), bank: v('vnBank'), bankAccount: v('vnAcc'), address: v('vnAddr'), items: v('vnItems'), note: v('vnNote'), active: v('vnActive'),
          contractStart: v('vnCs'), contractEnd: v('vnCe'), contractNote: v('vnCn') }).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('บันทึกผู้ขายแล้ว'); });
      } });
  }

  // ==================== ตรวจ 3 ทาง (PO ↔ รับของ ↔ ใบแจ้งหนี้) ====================
  function drawMatch(box, d) {
    var m = d.match; if (!box || !m) return;
    var tag = MATCH_TAG[m.status] || ['', ''];
    var invs = P.data.invoices.filter(function (x) { return x.docId === d.id; });
    box.innerHTML = '<div class="mstat ' + m.status + '">' + (m.status === 'ok' ? '✓ ' : m.status === 'diff' ? '⚠ ' : '') + esc(m.label) + '</div>'
      + '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>รายการ</th><th class="r">PO</th><th class="r">รับจริง</th><th class="r">ใบแจ้งหนี้</th><th class="r">ราคา PO</th><th class="r">ราคาใบแจ้งหนี้</th><th></th></tr></thead><tbody>'
      + m.lines.map(function (l) {
        return '<tr><td>' + esc(l.name) + '<br><small class="muted">' + esc(l.unit) + '</small>' + (l.issues.length ? '<br><small class="neg">' + l.issues.map(esc).join('<br>') + '</small>' : '') + '</td>'
          + '<td class="r">' + n3(l.ordered) + '</td><td class="r">' + n3(l.received) + '</td><td class="r">' + (m.invoiceCount ? n3(l.invoiced) : '–') + '</td>'
          + '<td class="r">' + (l.poPrice === '' ? '–' : baht(l.poPrice)) + '</td><td class="r">' + (l.invPrice === '' ? '–' : baht(l.invPrice)) + '</td><td>' + (m.status === 'norecv' || m.status === 'noinv' ? '' : l.ok ? '<span class="pos">✓</span>' : '<span class="neg">✗</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + (invs.length ? '<div class="minv">' + invs.map(function (x) {
        return '<div class="pfile"><b>ใบแจ้งหนี้ ' + esc(x.invoiceNo) + '</b><small>' + dd(x.invoiceDate) + ' · ' + baht(x.amount) + (x.files.length ? ' · ' + x.files.map(fileLink).join(' ') : '') + '</small><button type="button" class="icon-btn" data-inv="' + x.id + '" title="แก้ไข">' + icon('edit', 16) + '</button></div>';
      }).join('') + '</div>' : '<div class="muted" style="margin-top:6px">ยังไม่มีใบแจ้งหนี้ — กด "เพิ่มใบแจ้งหนี้" เมื่อได้รับจากผู้ขาย</div>');
    on('[data-inv]', 'click', function (el) { invoiceModal(d, P.data.invoices.filter(function (x) { return x.id === el.getAttribute('data-inv'); })[0]); }, box);
  }
  function invoiceModal(d, inv) {
    var edit = !!inv, recv = {};
    (d.match ? d.match.lines : []).forEach(function (l) { recv[l.key] = l.received; });
    var items = edit ? inv.items.map(function (it) { return Object.assign({}, it); }) : d.items.map(function (it) {
      var k = it.materialId || ('n:' + it.materialName);
      return { materialId: it.materialId, materialName: it.materialName, qty: recv[k] !== undefined && recv[k] !== 0 ? recv[k] : it.qty, unit: it.unit, price: it.price };
    });
    var back = function () { docModal(P.idx.doc[d.id]); };
    wide({ icon: 'doc', title: (edit ? 'ใบแจ้งหนี้ ' + inv.invoiceNo : 'เพิ่มใบแจ้งหนี้') + ' · ' + d.docNo, sub: d.vendorName + ' · ใส่จำนวนและราคาตามใบแจ้งหนี้ของผู้ขาย',
      body: '<div class="pform">' + hl(F('ivNo', 'เลขที่ใบแจ้งหนี้ / ใบกำกับภาษี *', edit ? inv.invoiceNo : '')) + F('ivDate', 'วันที่ใบแจ้งหนี้', edit ? inv.invoiceDate : todayIso(), 'date') + '</div>'
        + '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>รายการ</th><th class="r">จำนวน</th><th class="r">ราคา/หน่วย</th></tr></thead><tbody>'
        + items.map(function (it, i) { return '<tr><td>' + esc(it.materialName) + ' <small class="muted">' + esc(it.unit || '') + '</small></td><td class="r"><input class="ivq" data-i="' + i + '" type="number" step="any" inputmode="decimal" value="' + esc(it.qty) + '"></td><td class="r"><input class="ivp" data-i="' + i + '" type="number" step="any" inputmode="decimal" value="' + esc(it.price) + '"></td></tr>'; }).join('')
        + '</tbody></table></div><div class="ptotal">รวม <b id="ivTotal"></b></div>'
        + '<div class="pform">' + F('ivAmount', 'ยอดตามใบแจ้งหนี้ (เว้นว่าง = คำนวณจากรายการ)', edit ? inv.amount : '', 'number', ' step="any" inputmode="decimal"') + T('ivNote', 'หมายเหตุ', edit ? inv.note : '')
        + '<div class="pf full"><label>แนบไฟล์ใบแจ้งหนี้ (รูป / PDF)</label><input id="ivFile" type="file" accept="image/*,application/pdf"></div></div>'
        + (edit && inv.files.length ? '<div>' + inv.files.map(fileLink).join(' ') + '</div>' : ''),
      ok: 'บันทึก', onCancel: back,
      foot: edit ? '<button type="button" class="link-btn danger" id="ivDel">' + icon('trash', 16) + 'ลบใบแจ้งหนี้นี้</button>' : '',
      onOpen: function () {
        var sum = function () { $('ivTotal').textContent = baht(items.reduce(function (s2, it) { return s2 + (Number(it.qty) || 0) * (Number(it.price) || 0); }, 0)); };
        on('.ivq', 'input', function (el) { items[+el.getAttribute('data-i')].qty = el.value; sum(); }, $('mBody'));
        on('.ivp', 'input', function (el) { items[+el.getAttribute('data-i')].price = el.value; sum(); }, $('mBody'));
        sum();
        if ($('ivDel')) $('ivDel').addEventListener('click', function () { confirmDelete('ลบใบแจ้งหนี้ ' + inv.invoiceNo + ' ?', function () { return call('purDeleteInvoice', state.token, inv.id); }, back); });
      },
      check: function () { return v('ivNo') ? '' : 'กรอกเลขที่ใบแจ้งหนี้'; },
      submit: function () {
        var file = $('ivFile').files[0];
        return call('purSaveInvoice', state.token, { id: edit ? inv.id : '', docId: d.id, invoiceNo: v('ivNo'), invoiceDate: v('ivDate'), amount: v('ivAmount'), note: v('ivNote'), items: items }).then(function (r) {
          if (!r.ok) return r.error;
          var done = function () { closeModal(); reload('บันทึกใบแจ้งหนี้แล้ว').then(back); };
          if (!file) return done();
          return upload('invoice', r.id, file, 'ใบแจ้งหนี้ / ใบกำกับภาษี').then(done, function (e) { closeModal(); reload('บันทึกแล้ว แต่แนบไฟล์ไม่สำเร็จ: ' + e.message).then(back); });
        });
      } });
  }

  // ==================== เปรียบเทียบราคา (ใบเสนอราคาหลายเจ้า) ====================
  function rfqs() {
    $('main').innerHTML = '<h3>เปรียบเทียบราคา</h3><p class="lead">รวบรวมใบเสนอราคาจากผู้ขายหลายเจ้า เทียบราคา ระยะเวลาส่ง เงื่อนไขชำระเงิน และคุณภาพ ก่อนตัดสินใจสั่งซื้อ</p>'
      + searchBar('rfq', 'ค้นหาเรื่อง / ผู้ขาย', '<button class="btn btn-sm btn-primary" id="pAddRfq">' + icon('plus', 16) + 'เปรียบเทียบใหม่</button>') + '<div id="pList" class="plist"></div>';
    var draw = function () {
      var list = P.data.rfqs.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).filter(function (r) {
        var qs = P.data.quotes.filter(function (q) { return q.rfqId === r.id; });
        return match(P.q.rfq, r.title + ' ' + qs.map(function (q) { return q.vendorName; }).join(' '));
      });
      $('pList').innerHTML = list.map(function (r) {
        var qs = P.data.quotes.filter(function (q) { return q.rfqId === r.id; }), win = qs.filter(function (q) { return q.id === r.winnerId; })[0];
        var po = r.poId ? P.idx.doc[r.poId] : null;
        return '<button class="prow click" data-rfq="' + r.id + '"><div class="pinfo"><b>' + esc(r.title) + '</b><small>' + r.items.length + ' รายการ · ใบเสนอราคา ' + qs.length + ' เจ้า · สร้าง ' + dd(String(r.createdAt).slice(0, 10)) + '</small>'
          + '<div>' + (win ? '<span class="tag ok">เลือก: ' + esc(win.vendorName) + '</span>' : '<span class="tag no">ยังไม่ได้เลือก</span>') + (po ? '<span class="tag code">PO ' + esc(po.docNo) + '</span>' : '') + '</div></div>'
          + '<div class="pprice">' + (win ? baht(win.total) : qs.length ? 'ต่ำสุด ' + baht(Math.min.apply(null, qs.map(function (q) { return q.total; }))) : '') + '</div></button>';
      }).join('') || '<div class="panel muted">ยังไม่มีการเปรียบเทียบราคา — กด "เปรียบเทียบใหม่"</div>';
      on('[data-rfq]', 'click', function (el) { rfqDetail(el.getAttribute('data-rfq')); }, $('pList'));
    };
    bindSearch('rfq', draw);
    $('pAddRfq').addEventListener('click', function () { rfqModal(null); });
    draw();
  }
  function rfqModal(r) {
    var edit = !!r;
    var prs = P.data.docs.filter(function (x) { return x.type === 'PR' && x.status !== 'cancelled'; });
    var items = edit ? r.items.map(function (it) { return Object.assign({}, it); }) : [{ materialId: '', materialName: '', qty: '', unit: '' }];
    wide({ icon: 'list', title: edit ? 'แก้ไข · ' + r.title : 'เปรียบเทียบราคาใหม่', sub: 'ระบุสิ่งที่จะซื้อ แล้วเพิ่มใบเสนอราคาของแต่ละผู้ขาย',
      body: '<datalist id="matList2">' + materialList().map(function (m) { return '<option value="' + esc(m.name) + '">'; }).join('') + '</datalist>'
        + '<div class="pform">' + hl(F('rqTitle', 'เรื่อง *', edit ? r.title : '', 'text', ' placeholder="เช่น ซื้อพริกป่น ธ.ค. 69"'))
        + S('rqPr', 'อ้างอิง PR (ดึงรายการมาให้)', [['', '— ไม่อ้างอิง —']].concat(prs.map(function (x) { return [x.id, x.docNo + ' · ' + x.items.length + ' รายการ']; })), edit ? r.prId : '') + '</div>'
        + '<div class="psec"><div class="psec-h"><b>รายการที่ต้องการซื้อ</b><button type="button" class="btn btn-sm btn-line" id="rqAdd">' + icon('plus', 16) + 'เพิ่มรายการ</button></div><div id="rqItems"></div></div>'
        + '<div class="pform">' + T('rqNote', 'หมายเหตุ', edit ? r.note : '') + '</div>',
      ok: 'บันทึก', onCancel: edit ? function () { rfqDetail(r.id); } : null,
      foot: edit ? '<button type="button" class="link-btn danger" id="rqDel">' + icon('trash', 16) + 'ลบเรื่องนี้ (รวมใบเสนอราคา)</button>' : '',
      onOpen: function () {
        var draw = function () {
          $('rqItems').innerHTML = '<div class="pitems">' + items.map(function (it, i) {
            return '<div class="pitem rq" data-i="' + i + '"><input class="iname" list="matList2" placeholder="วัตถุดิบ" value="' + esc(it.materialName) + '"><input class="iqty" type="number" step="any" inputmode="decimal" placeholder="จำนวน" value="' + esc(it.qty) + '"><input class="iunit" placeholder="หน่วย" value="' + esc(it.unit) + '"><button type="button" class="icon-btn" data-rm="' + i + '">' + icon('trash', 16) + '</button></div>';
          }).join('') + '</div>';
          on('.pitem input', 'input', function (el) {
            var it = items[+el.closest('.pitem').getAttribute('data-i')];
            if (el.classList.contains('iname')) { it.materialName = el.value; var m = P.data.materials.filter(function (x) { return x.name === el.value; })[0]; it.materialId = m ? m.id : ''; if (m && !it.unit) { it.unit = m.unit; el.closest('.pitem').querySelector('.iunit').value = m.unit; } }
            else if (el.classList.contains('iqty')) it.qty = el.value; else it.unit = el.value;
          }, $('rqItems'));
          on('[data-rm]', 'click', function (el) { items.splice(+el.getAttribute('data-rm'), 1); if (!items.length) items.push({ materialId: '', materialName: '', qty: '', unit: '' }); draw(); }, $('rqItems'));
        };
        draw();
        $('rqAdd').addEventListener('click', function () { items.push({ materialId: '', materialName: '', qty: '', unit: '' }); draw(); });
        $('rqPr').addEventListener('change', function () {
          var pr = P.idx.doc[this.value]; if (!pr) return;
          items = pr.items.map(function (it) { return { materialId: it.materialId, materialName: it.materialName, qty: it.qty, unit: it.unit }; }); draw();
          if (!v('rqTitle')) $('rqTitle').value = 'ตาม ' + pr.docNo;
        });
        if ($('rqDel')) $('rqDel').addEventListener('click', function () { confirmDelete('ลบ "' + r.title + '" และใบเสนอราคาทั้งหมด?', function () { return call('purDeleteRfq', state.token, r.id); }); });
      },
      check: function () { return !v('rqTitle') ? 'กรอกเรื่อง' : !items.some(function (it) { return it.materialName.trim() && it.qty !== ''; }) ? 'เพิ่มรายการ (ชื่อ + จำนวน) อย่างน้อย 1 รายการ' : ''; },
      submit: function () {
        var keep = items.filter(function (it) { return it.materialName.trim() && it.qty !== ''; }).map(function (it, i) { return Object.assign({}, it, { key: it.key || ('L' + Date.now().toString(36) + i) }); });
        return call('purSaveRfq', state.token, { id: edit ? r.id : '', title: v('rqTitle'), prId: v('rqPr'), note: v('rqNote'), items: keep }).then(function (res) {
          if (!res.ok) return res.error; closeModal(); reload('บันทึกแล้ว').then(function () { rfqDetail(res.id); });
        });
      } });
  }
  function rfqDetail(id) {
    var r = P.data.rfqs.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var qs = P.data.quotes.filter(function (q) { return q.rfqId === id; }).sort(function (a, b) { return a.total - b.total; });
    var priceOf = function (q, key) { var p = q.items.filter(function (x) { return x.key === key; })[0]; return p && p.price !== '' ? Number(p.price) : null; };
    var best = {}; r.items.forEach(function (it) { var ps = qs.map(function (q) { return priceOf(q, it.key); }).filter(function (p) { return p !== null; }); best[it.key] = ps.length ? Math.min.apply(null, ps) : null; });
    var minTotal = qs.length ? Math.min.apply(null, qs.map(function (q) { return q.total; })) : null;
    var minLead = Math.min.apply(null, qs.map(function (q) { return q.leadDays === '' ? 1e9 : q.leadDays; }).concat([1e9]));
    var head = '<tr><th>รายการ</th><th class="r">จำนวน</th>' + qs.map(function (q) { return '<th class="r qh' + (q.id === r.winnerId ? ' win' : '') + '">' + esc(q.vendorName) + (q.id === r.winnerId ? '<br><span class="tag ok">เลือกแล้ว</span>' : '') + '</th>'; }).join('') + '</tr>';
    var rows = r.items.map(function (it) {
      return '<tr><td>' + esc(it.materialName) + '</td><td class="r">' + n3(it.qty) + ' ' + esc(it.unit) + '</td>' + qs.map(function (q) {
        var p = priceOf(q, it.key);
        return '<td class="r' + (p !== null && p === best[it.key] && qs.length > 1 ? ' best' : '') + '">' + (p === null ? '<span class="muted">ไม่เสนอ</span>' : baht(p) + '<br><small class="muted">รวม ' + baht(p * (Number(it.qty) || 0)) + '</small>') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var row = function (label, fn) { return '<tr class="sub"><td colspan="2"><b>' + label + '</b></td>' + qs.map(function (q) { return '<td class="r">' + fn(q) + '</td>'; }).join('') + '</tr>'; };
    var table = qs.length ? '<div class="ptable-wrap"><table class="ptable cmp"><thead>' + head + '</thead><tbody>' + rows
      + row('ยอดรวม', function (q) { return '<b' + (q.total === minTotal && qs.length > 1 ? ' class="pos"' : '') + '>' + baht(q.total) + '</b>' + (q.total === minTotal && qs.length > 1 ? '<br><small class="pos">ถูกที่สุด</small>' : ''); })
      + row('ส่งของภายใน', function (q) { return q.leadDays === '' ? '–' : '<span' + (q.leadDays === minLead && qs.length > 1 ? ' class="pos"' : '') + '>' + q.leadDays + ' วัน</span>'; })
      + row('เครดิต / เงื่อนไขชำระ', function (q) { return (q.creditDays !== '' ? q.creditDays + ' วัน' : '–') + (q.paymentTerms ? '<br><small>' + esc(q.paymentTerms) + '</small>' : ''); })
      + row('ยืนราคาถึง', function (q) { return q.validUntil ? dd(q.validUntil) : '–'; })
      + row('สเปก / คุณภาพ', function (q) { return q.spec ? '<small>' + esc(q.spec) + '</small>' : '–'; })
      + row('ไฟล์', function (q) { return q.files.length ? q.files.map(fileLink).join('<br>') : '–'; })
      + row('', function (q) { return '<button type="button" class="btn btn-sm btn-line" data-qe="' + q.id + '">แก้ไข</button> ' + (q.id === r.winnerId ? '' : '<button type="button" class="btn btn-sm btn-primary" data-qw="' + q.id + '">เลือกเจ้านี้</button>'); })
      + '</tbody></table></div>' : '<div class="muted">ยังไม่มีใบเสนอราคา — กด "เพิ่มใบเสนอราคา" ของแต่ละผู้ขาย</div>';
    var win = qs.filter(function (q) { return q.id === r.winnerId; })[0], po = r.poId ? P.idx.doc[r.poId] : null;
    wide({ icon: 'list', title: r.title, sub: r.items.length + ' รายการ · ' + qs.length + ' ผู้ขาย', noOk: true, cancel: 'ปิด',
      body: (win ? '<div class="note"><b>เลือก: ' + esc(win.vendorName) + '</b> (' + baht(win.total) + ') · ' + dd(r.decidedAt) + (r.reason ? '<br>เหตุผล: ' + esc(r.reason) : '') + (po ? '<br>PO: ' + esc(po.docNo) : '') + '</div>' : '') + table,
      foot: '<div class="pfoot"><button type="button" class="btn btn-sm btn-primary" id="qAdd">' + icon('plus', 16) + 'เพิ่มใบเสนอราคา</button><button type="button" class="btn btn-sm btn-line" id="rqEdit">' + icon('edit', 16) + 'แก้ไขรายการ</button>'
        + (win && !po ? '<button type="button" class="btn btn-sm btn-line" id="rqPo">' + icon('doc', 16) + 'ลง PO (ผู้ขายที่เลือก)</button>' : '') + (win ? '<button type="button" class="btn btn-sm btn-line" id="rqUndo">ยกเลิกการเลือก</button>' : '') + '</div>',
      onOpen: function () {
        $('qAdd').addEventListener('click', function () { quoteModal(r, null); });
        $('rqEdit').addEventListener('click', function () { rfqModal(r); });
        on('[data-qe]', 'click', function (el) { quoteModal(r, qs.filter(function (q) { return q.id === el.getAttribute('data-qe'); })[0]); }, $('mBody'));
        on('[data-qw]', 'click', function (el) { decideModal(r, qs.filter(function (q) { return q.id === el.getAttribute('data-qw'); })[0], minTotal); }, $('mBody'));
        if ($('rqUndo')) $('rqUndo').addEventListener('click', function () { call('purDecideRfq', state.token, r.id, '', '').then(function () { closeModal(); reload('ยกเลิกการเลือกแล้ว').then(function () { rfqDetail(r.id); }); }).catch(onServerError); });
        if ($('rqPo')) $('rqPo').addEventListener('click', function () {
          var vn = ven(win.vendorId);
          docModal(null, 'PO', { id: r.prId || '', rfqId: r.id, docNo: r.title, vendorId: win.vendorId, vendorName: win.vendorName, vendorPhone: vn ? (vn.phone || vn.phone2 || '') : '', deliveryDate: win.leadDays !== '' ? addDays(todayIso(), Number(win.leadDays)) : '',
            items: r.items.map(function (it) { return { materialId: it.materialId, materialName: it.materialName, qty: it.qty, unit: it.unit, price: priceOf(win, it.key) === null ? '' : priceOf(win, it.key) }; }) });
        });
      } });
  }
  function decideModal(r, q, minTotal) {
    wide({ icon: 'check', title: 'เลือก ' + q.vendorName, sub: r.title + ' · ' + baht(q.total),
      body: (q.total > minTotal ? '<div class="note">เจ้านี้ไม่ใช่ราคาต่ำสุด (ต่ำสุด ' + baht(minTotal) + ') — ควรระบุเหตุผล เช่น คุณภาพดีกว่า ส่งเร็วกว่า เครดิตยาวกว่า</div>' : '')
        + '<div class="pform">' + T('dcReason', 'เหตุผลที่เลือก', '') + '</div>',
      ok: 'ยืนยันเลือกเจ้านี้', onCancel: function () { rfqDetail(r.id); },
      check: function () { return q.total > minTotal && !v('dcReason') ? 'เจ้านี้ไม่ใช่ราคาต่ำสุด กรุณาใส่เหตุผล' : ''; },
      submit: function () { return call('purDecideRfq', state.token, r.id, q.id, v('dcReason')).then(function (res) { if (!res.ok) return res.error; closeModal(); reload('เลือกผู้ขายแล้ว').then(function () { rfqDetail(r.id); }); }); } });
  }
  function quoteModal(r, q) {
    var edit = !!q, prices = {};
    if (edit) q.items.forEach(function (p) { prices[p.key] = p.price; });
    wide({ icon: 'doc', title: (edit ? 'แก้ไขใบเสนอราคา · ' + q.vendorName : 'เพิ่มใบเสนอราคา') , sub: r.title,
      body: '<div class="pform">' + S('qtVen', 'ผู้ขาย', vendorOptions('— เลือก / พิมพ์ชื่อด้านขวา —'), edit ? q.vendorId : '') + F('qtVName', 'ชื่อผู้ขาย *', edit ? q.vendorName : '')
        + F('qtNo', 'เลขที่ใบเสนอราคา', edit ? q.quoteNo : '') + F('qtDate', 'วันที่เสนอ', edit ? q.quoteDate : todayIso(), 'date')
        + F('qtValid', 'ยืนราคาถึง', edit ? q.validUntil : '', 'date') + F('qtLead', 'ส่งของภายใน (วัน)', edit ? q.leadDays : '', 'number', ' inputmode="numeric"')
        + F('qtCredit', 'เครดิต (วัน)', edit ? q.creditDays : '', 'number', ' inputmode="numeric"') + F('qtTerms', 'เงื่อนไขชำระเงิน', edit ? q.paymentTerms : '', 'text', ' placeholder="เช่น โอนก่อนส่ง / วางบิล 30 วัน"') + '</div>'
        + '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>รายการ</th><th class="r">จำนวน</th><th class="r">ราคา/หน่วย</th></tr></thead><tbody>'
        + r.items.map(function (it) { return '<tr><td>' + esc(it.materialName) + '</td><td class="r">' + n3(it.qty) + ' ' + esc(it.unit) + '</td><td class="r"><input class="qtp" data-k="' + esc(it.key) + '" type="number" step="any" inputmode="decimal" placeholder="ไม่เสนอ = ว่าง" value="' + esc(prices[it.key] === undefined ? '' : prices[it.key]) + '"></td></tr>'; }).join('')
        + '</tbody></table></div><div class="ptotal">รวม <b id="qtTotal"></b></div>'
        + '<div class="pform">' + T('qtSpec', 'สเปก / คุณภาพ', edit ? q.spec : '') + T('qtNote', 'หมายเหตุ', edit ? q.note : '')
        + '<div class="pf full"><label>แนบไฟล์ใบเสนอราคา (รูป / PDF)</label><input id="qtFile" type="file" accept="image/*,application/pdf"></div></div>',
      ok: 'บันทึก', onCancel: function () { rfqDetail(r.id); },
      foot: edit ? '<button type="button" class="link-btn danger" id="qtDel">' + icon('trash', 16) + 'ลบใบเสนอราคานี้</button>' : '',
      onOpen: function () {
        var sum = function () { var t2 = 0; Array.prototype.forEach.call($('mBody').querySelectorAll('.qtp'), function (el) { var it = r.items.filter(function (x) { return x.key === el.getAttribute('data-k'); })[0]; if (el.value !== '') t2 += Number(el.value) * (Number(it.qty) || 0); }); $('qtTotal').textContent = baht(t2); };
        on('.qtp', 'input', sum, $('mBody')); sum();
        $('qtVen').addEventListener('change', function () { var vn = ven(this.value); if (vn) { $('qtVName').value = vn.name; if (!v('qtCredit') && vn.creditDays !== '') $('qtCredit').value = vn.creditDays; } });
        if ($('qtDel')) $('qtDel').addEventListener('click', function () { confirmDelete('ลบใบเสนอราคาของ ' + q.vendorName + ' ?', function () { return call('purDeleteQuote', state.token, q.id); }, function () { rfqDetail(r.id); }); });
      },
      check: function () { return !v('qtVName') ? 'เลือกหรือกรอกชื่อผู้ขาย' : !Array.prototype.some.call($('mBody').querySelectorAll('.qtp'), function (el) { return el.value !== ''; }) ? 'ใส่ราคาอย่างน้อย 1 รายการ' : ''; },
      submit: function () {
        var items = Array.prototype.map.call($('mBody').querySelectorAll('.qtp'), function (el) { return { key: el.getAttribute('data-k'), price: el.value }; });
        var file = $('qtFile').files[0];
        return call('purSaveQuote', state.token, { id: edit ? q.id : '', rfqId: r.id, vendorId: v('qtVen'), vendorName: v('qtVName'), quoteNo: v('qtNo'), quoteDate: v('qtDate'), validUntil: v('qtValid'),
          leadDays: v('qtLead'), creditDays: v('qtCredit'), paymentTerms: v('qtTerms'), spec: v('qtSpec'), note: v('qtNote'), items: items }).then(function (res) {
          if (!res.ok) return res.error;
          var done = function () { closeModal(); reload('บันทึกใบเสนอราคาแล้ว').then(function () { rfqDetail(r.id); }); };
          if (!file) return done();
          return upload('quote', res.id, file, 'ใบเสนอราคา').then(done, function (e) { closeModal(); reload('บันทึกแล้ว แต่แนบไฟล์ไม่สำเร็จ: ' + e.message).then(function () { rfqDetail(r.id); }); });
        });
      } });
  }

  // ==================== บริหารคู่ค้า: สัญญา + ประเมินผู้ขาย ====================
  function quarterOf(iso) { return iso.slice(0, 4) + '-Q' + (Math.floor((+iso.slice(5, 7) - 1) / 3) + 1); }
  function quarterList(n) {
    var out = [], y = +todayIso().slice(0, 4), q = +quarterOf(todayIso()).slice(-1);
    for (var i = 0; i < n; i++) { out.push(y + '-Q' + q); q--; if (!q) { q = 4; y--; } }
    return out;
  }
  function qLabel(p) { var y = +p.slice(0, 4); return 'ไตรมาส ' + p.slice(-1) + '/' + (y + 543); }
  function contractInfo(x) {
    if (!x.contractEnd) return null;
    var left = days(todayIso(), x.contractEnd);
    return { left: left, cls: left < 0 ? 'lock' : left <= 60 ? 'no' : 'ok', text: left < 0 ? 'สัญญาหมดอายุแล้ว' : left <= 60 ? 'สัญญาเหลือ ' + left + ' วัน' : 'สัญญาถึง ' + dd(x.contractEnd) };
  }
  function latestEval(vid) { return P.data.evals.filter(function (e) { return e.vendorId === vid; }).sort(function (a, b) { return b.period.localeCompare(a.period); })[0]; }
  function stars(n) { var r = Math.round(Number(n) || 0); return '<span class="stars">' + '★★★★★'.slice(0, r) + '<i>' + '★★★★★'.slice(r) + '</i></span>'; }
  function evalModal(x, e) {
    var periods = quarterList(6), cur = e ? e.period : periods[0];
    var K = [['quality', 'คุณภาพสินค้า'], ['delivery', 'ส่งตรงเวลา'], ['price', 'ราคา'], ['service', 'บริการ / การติดต่อ']];
    var opts = [['', '—'], ['5', '5 ดีมาก'], ['4', '4 ดี'], ['3', '3 พอใช้'], ['2', '2 ต้องปรับปรุง'], ['1', '1 ไม่ผ่าน']];
    wide({ icon: 'check', title: 'ประเมินผู้ขาย · ' + x.name, sub: 'ให้คะแนน 1–5 ต่อไตรมาส · ระบบเสนอคะแนนจากข้อมูลจริงให้ แก้ได้',
      body: '<div class="pform">' + S('evP', 'รอบประเมิน', periods.map(function (p) { return [p, qLabel(p)]; }), cur) + '<div class="pf"></div></div>'
        + '<div id="evMet" class="note">กำลังดึงข้อมูลจริงของไตรมาสนี้…</div>'
        + '<div class="pform">' + K.map(function (k) { return S('ev_' + k[0], k[1], opts, e ? e[k[0]] : ''); }).join('') + T('evComment', 'ความเห็น', e ? e.comment : '') + staffSel('evBy', 'ผู้ประเมิน', e ? e.evaluator : '') + '</div>',
      ok: 'บันทึกผลประเมิน', onCancel: function () { vendorModal(ven(x.id)); },
      foot: e ? '<button type="button" class="link-btn danger" id="evDel">' + icon('trash', 16) + 'ลบผลประเมินนี้</button>' : '',
      onOpen: function () {
        var loadMet = function () {
          var p = v('evP'), ex = P.data.evals.filter(function (z) { return z.vendorId === x.id && z.period === p; })[0];
          call('purVendorMetrics', state.token, p).then(function (r) {
            if (!$('evMet') || v('evP') !== p) return;
            var m = r.metrics && r.metrics[x.id];
            $('evMet').innerHTML = !m ? 'ไตรมาสนี้ยังไม่มีข้อมูล PO / รับของ ของผู้ขายนี้ — ให้คะแนนตามความเห็น'
              : 'ข้อมูลจริง ' + qLabel(p) + ': PO ' + m.poCount + ' ใบ (' + baht(m.poTotal) + ')' + (m.delivered ? ' · ส่งตรงเวลา ' + m.onTime + '/' + m.delivered + ' (' + m.onTimeRate + '%)' : '')
                + (m.qcChecked ? ' · QC ไม่ผ่าน ' + m.qcFail + '/' + m.qcChecked : '') + (m.priceUp || m.priceDown ? ' · ขึ้นราคา ' + m.priceUp + ' ครั้ง ลด ' + m.priceDown + ' ครั้ง' : '');
            if (!ex && m) {
              if (m.suggestQuality !== '' && !v('ev_quality')) $('ev_quality').value = String(m.suggestQuality);
              if (m.suggestDelivery !== '' && !v('ev_delivery')) $('ev_delivery').value = String(m.suggestDelivery);
              if (m.suggestPrice !== '' && !v('ev_price')) $('ev_price').value = String(m.suggestPrice);
            }
          }).catch(function () { if ($('evMet')) $('evMet').textContent = 'ดึงข้อมูลจริงไม่ได้ — ให้คะแนนตามความเห็น'; });
          if (ex) { K.forEach(function (k) { $('ev_' + k[0]).value = String(ex[k[0]]); }); $('evComment').value = ex.comment || ''; }
        };
        $('evP').addEventListener('change', loadMet); loadMet();
        if ($('evDel')) $('evDel').addEventListener('click', function () { confirmDelete('ลบผลประเมิน ' + qLabel(e.period) + ' ?', function () { return call('purDeleteEval', state.token, e.id); }, function () { vendorModal(ven(x.id)); }); });
      },
      check: function () { return K.some(function (k) { return !v('ev_' + k[0]); }) ? 'ให้คะแนนครบ 4 หัวข้อ' : ''; },
      submit: function () {
        var rec = { vendorId: x.id, period: v('evP'), comment: v('evComment'), evaluator: v('evBy') };
        K.forEach(function (k) { rec[k[0]] = v('ev_' + k[0]); });
        return call('purSaveEval', state.token, rec).then(function (r) { if (!r.ok) return r.error; closeModal(); reload('บันทึกผลประเมินแล้ว').then(function () { vendorModal(ven(x.id)); }); });
      } });
  }

  // ==================== รายงาน ====================
  function monthStart(iso) { return iso.slice(0, 8) + '01'; }
  function report() {
    var t = todayIso(), from = P.q.repFrom || monthStart(t), to = P.q.repTo || t;
    var lastM = addDays(monthStart(t), -1);
    $('main').innerHTML = '<h3>รายงาน / พิมพ์</h3><p class="lead">เลือกช่วงวันที่ → แสดงรายงาน → พิมพ์ หรือบันทึกเป็น PDF (เลือก "บันทึกเป็น PDF" ในหน้าพิมพ์)</p>'
      + '<div class="panel noprint"><div class="pform">' + S('rType', 'ประเภทรายงาน', [['stock', 'รายงานเบิกจ่ายสินค้า (รับเข้า-จ่ายออก)'], ['reorder', 'รายงานสินค้าที่ต้องจัดซื้อ (ต่ำกว่า Minimum)'], ['balance', 'รายงานสต๊อกคงเหลือ + มูลค่า (ณ วันที่)'], ['price', 'รายงานประวัติราคา (ตามผู้ขาย / วัตถุดิบ)'], ['match', 'รายงานตรวจ 3 ทาง (PO / รับของ / ใบแจ้งหนี้)'], ['veval', 'รายงานประเมินผู้ขาย (จัดอันดับ)'], ['PO', 'รายงานใบสั่งซื้อ (PO)'], ['PR', 'รายงานใบขอซื้อ (PR)']], P.q.repType || 'stock') + '<div class="pf"></div>'
      + F('rFrom', 'ตั้งแต่วันที่', from, 'date') + F('rTo', 'ถึงวันที่', to, 'date')
      + S('rPeriod', 'รอบประเมิน', quarterList(8).map(function (p) { return [p, qLabel(p)]; }), P.q.repPeriod || quarterList(1)[0])
      + S('rVen', 'ผู้ขาย', [['', 'ทุกผู้ขาย']].concat(P.data.vendors.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'th'); }).map(function (x) { return [x.id, x.name]; })), P.q.repVen || '')
      + S('rMat', 'วัตถุดิบ', [['', 'ทุกรายการ']].concat(materialList().map(function (m) { return [m.id, m.name]; })), P.q.repMat || '')
      + '<div class="pf"><label>&nbsp;</label><label class="pchk"><input type="checkbox" id="rDetail"' + (P.q.repDetail ? ' checked' : '') + '> แสดงรายการรับเข้า-จ่ายออกทุกรายการ</label></div></div>'
      + '<div class="pchips">' + [['เดือนนี้', monthStart(t), t], ['เดือนก่อน', monthStart(lastM), lastM], ['3 เดือน', addDays(t, -90), t], ['ทั้งหมด', '2020-01-01', t]].map(function (q) { return '<button class="chip" data-r="' + q[1] + '|' + q[2] + '">' + q[0] + '</button>'; }).join('') + '</div>'
      + '<div class="actions"><button class="btn btn-primary" id="rGo">' + icon('chart', 18) + 'แสดงรายงาน</button><button class="btn btn-line" id="rPrint">' + icon('print', 18) + 'พิมพ์ / PDF</button></div></div>'
      + '<div id="rOut"></div>';
    var stockOpts = function () {
      var ty = v('rType'), st = ty === 'stock', bal = ty === 'balance', pr = ty === 'price', ro = ty === 'reorder' || ty === 'veval';
      $('rPeriod').closest('.pf').style.display = ty === 'veval' ? '' : 'none';
      $('rMat').closest('.pf').style.display = st || pr ? '' : 'none';
      $('rDetail').closest('.pf').style.display = st ? '' : 'none';
      $('rVen').closest('.pf').style.display = pr ? '' : 'none';
      $('rFrom').closest('.pf').style.display = bal || ro ? 'none' : '';
      $('rTo').closest('.pf').style.display = ro ? 'none' : '';
      $('rTo').closest('.pf').querySelector('label').textContent = bal ? 'ยอดคงเหลือ ณ วันที่' : 'ถึงวันที่';
      $('main').querySelector('.pchips').style.display = bal || ro ? 'none' : '';
    };
    stockOpts();
    $('rType').addEventListener('change', function () { P.q.repType = this.value; stockOpts(); $('rOut').innerHTML = ''; });
    var run = function (print) {
      P.q.repFrom = v('rFrom'); P.q.repTo = v('rTo'); P.q.repMat = v('rMat'); P.q.repDetail = $('rDetail').checked; P.q.repType = v('rType');
      if (P.q.repType === 'veval') {
        P.q.repPeriod = v('rPeriod');
        $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
        return call('purVendorReport', state.token, P.q.repPeriod).then(function (r) {
          if (state.page !== 'p_rep') return;
          if (!r.ok) { $('rOut').innerHTML = '<div class="panel err">' + esc(r.error) + '</div>'; return; }
          drawVendorReport(r); if (print) setTimeout(function () { window.print(); }, 300);
        }).catch(onServerError);
      }
      if (P.q.repType === 'match' && P.q.repFrom && P.q.repTo && P.q.repFrom <= P.q.repTo) {
        $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
        P.data = null;
        return P.load().then(function () { if (state.page !== 'p_rep') return; drawMatchReport(P.q.repFrom, P.q.repTo); if (print) setTimeout(function () { window.print(); }, 300); }).catch(onServerError);
      }
      if (P.q.repType === 'reorder') {   // ใช้ยอดคงเหลือปัจจุบัน — โหลดข้อมูลใหม่ก่อน
        $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
        P.data = null;
        return P.load().then(function () { if (state.page !== 'p_rep') return; drawReorderReport(); if (print) setTimeout(function () { window.print(); }, 300); }).catch(onServerError);
      }
      if (P.q.repType === 'balance') {
        if (!P.q.repTo) return toast('เลือกวันที่');
        $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
        return call('purStockReport', state.token, P.q.repTo).then(function (r) {
          if (state.page !== 'p_rep') return;
          if (!r.ok) { $('rOut').innerHTML = '<div class="panel err">' + esc(r.error) + '</div>'; return; }
          drawBalanceReport(r); if (print) setTimeout(function () { window.print(); }, 300);
        }).catch(onServerError);
      }
      if (!P.q.repFrom || !P.q.repTo || P.q.repFrom > P.q.repTo) return toast('เลือกช่วงวันที่ให้ถูกต้อง');
      if (P.q.repType === 'price') {
        P.q.repVen = v('rVen');
        $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
        return call('purPriceReport', state.token, P.q.repFrom, P.q.repTo).then(function (r) {
          if (state.page !== 'p_rep') return;
          if (!r.ok) { $('rOut').innerHTML = '<div class="panel err">' + esc(r.error) + '</div>'; return; }
          P.priceRep = r; drawPriceReport(r); if (print) setTimeout(function () { window.print(); }, 300);
        }).catch(onServerError);
      }
      if (P.q.repType !== 'stock') {
        $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
        return P.load().then(function () { if (state.page !== 'p_rep') return; drawDocReport(P.q.repType, P.q.repFrom, P.q.repTo); if (print) setTimeout(function () { window.print(); }, 300); }).catch(onServerError);
      }
      var key = P.q.repFrom + '|' + P.q.repTo;
      var show = function (r) { drawReport(r); if (print) setTimeout(function () { window.print(); }, 300); };
      if (P.report && P.report.key === key) return show(P.report);
      $('rOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังสร้างรายงาน…</div>';
      call('purReport', state.token, P.q.repFrom, P.q.repTo).then(function (r) { if (!r.ok) { $('rOut').innerHTML = '<div class="panel err">' + esc(r.error) + '</div>'; return; } r.key = key; P.report = r; if (state.page === 'p_rep') show(r); }).catch(onServerError);
    };
    on('[data-r]', 'click', function (el) { var p = el.getAttribute('data-r').split('|'); $('rFrom').value = p[0]; $('rTo').value = p[1]; run(); }, $('main'));
    $('rGo').addEventListener('click', function () { run(false); });
    $('rPrint').addEventListener('click', function () { run(true); });
    $('rVen').addEventListener('change', function () { P.q.repVen = v('rVen'); if (P.priceRep && v('rType') === 'price') drawPriceReport(P.priceRep); });
    $('rMat').addEventListener('change', function () { if (P.priceRep && v('rType') === 'price') { P.q.repMat = v('rMat'); drawPriceReport(P.priceRep); return; } if (P.report && v('rType') === 'stock') { P.q.repMat = v('rMat'); drawReport(P.report); } });
    $('rDetail').addEventListener('change', function () { if (P.report && v('rType') === 'stock') { P.q.repDetail = this.checked; drawReport(P.report); } });
    if ((P.q.repType || 'stock') !== 'stock') run(false);   // PO / PR / คงเหลือ
    else if (P.report && P.report.key === from + '|' + to) drawReport(P.report); else if (P.q.repMat) run(false);
  }
  // หัวกระดาษรายงาน: หน้าแรก = โลโก้ + ชื่อบริษัท + รหัสแบบฟอร์ม + ชื่อรายงาน · หน้าถัดไป = ชื่อบริษัท + รหัสแบบฟอร์ม (@page ด้านล่าง)
  var COMPANY = 'บริษัท สปังกี้ฟู้ด จำกัด';
  var FORM_CODE = 'FM-WH-01-01 Rev.00 วันที่ประกาศใช้ : 01/10/2024';
  function drawReport(r) {
    var mid = P.q.repMat, mm = mid ? mat(mid) : null, vn = mm ? ven(mm.vendorId) : null;
    var sum = r.summary.filter(function (x) { return !mid || x.id === mid; });
    var det = r.detail.filter(function (x) { return !mid || x.materialId === mid; });
    var hasValue = sum.some(function (x) { return x.inValue || x.outValue; });
    var tot = sum.reduce(function (a, x) { a.inV += x.inValue; a.outV += x.outValue; return a; }, { inV: 0, outV: 0 });
    var now = new Date(), logo = document.querySelector('.brand-logo');
    var q = function (x) { return x ? n3(x) : '–'; };
    var html = '<div class="preport"><div class="rhead">' + (logo ? '<img class="rlogo" src="' + logo.src + '" alt="">' : '')
      + '<div class="rco"><b>' + COMPANY + '</b><span>แผนกจัดซื้อ & สต๊อกสินค้า</span></div>'
      + '<div class="rform">' + FORM_CODE.replace(' วันที่', '<br>วันที่') + '</div></div>'
      + '<h4 class="rtitle">' + (mm ? 'สต๊อกการ์ด (STOCK CARD)' : 'รายงานรับเข้า-จ่ายออก วัตถุดิบ') + '</h4>'
      + '<div class="rinfo">' + (mm ? '<span>รายการ <b>' + esc(mm.name) + '</b></span><span>Supplier <b>' + (vn ? esc(vn.name) : '-') + '</b></span><span>หน่วย <b>' + esc(mm.unit || '-') + '</b></span>' : '')
      + '<span>ช่วงวันที่ <b>' + dd(r.from) + ' – ' + dd(r.to) + '</b></span><span>พิมพ์เมื่อ ' + dd(todayIso()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' น.</span></div>';
    var headEnd = html.length;
    if (mm) {
      var s0 = sum[0] || { open: 0, inQty: 0, outQty: 0, close: 0 };
      html += '<div class="rbox">' + [['ยกมา', s0.open], ['รับเข้า', s0.inQty], ['จ่ายออก', s0.outQty], ['คงเหลือ', s0.close]].map(function (b) { return '<div><span>' + b[0] + '</span><b>' + n3(b[1]) + '</b></div>'; }).join('') + '</div>';
    } else {
      html += '<h5>สรุปยอดตามวัตถุดิบ <small>(' + sum.length + ' รายการ)</small></h5><table class="rt"><thead><tr><th class="c">#</th><th>วัตถุดิบ</th><th>หน่วย</th><th class="r">ยกมา</th><th class="r">รับเข้า</th><th class="r">จ่ายออก</th><th class="r">คงเหลือ</th>'
        + (hasValue ? '<th class="r">มูลค่ารับเข้า</th><th class="r">มูลค่าจ่ายออก</th>' : '') + '</tr></thead><tbody>'
        + (sum.map(function (x, i) {
          return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.unit) + '</td><td class="r">' + q(x.open) + '</td><td class="r">' + q(x.inQty) + '</td><td class="r">' + q(x.outQty) + '</td><td class="r b">' + n3(x.close) + '</td>'
            + (hasValue ? '<td class="r">' + (x.inValue ? baht(x.inValue) : '–') + '</td><td class="r">' + (x.outValue ? baht(x.outValue) : '–') + '</td>' : '') + '</tr>';
        }).join('') || '<tr><td colspan="9" class="c muted">ไม่มีข้อมูลในช่วงนี้</td></tr>')
        + '</tbody>' + (hasValue ? '<tfoot><tr><td colspan="7" class="r">รวมมูลค่า (ราคา ณ วันที่ของแต่ละรายการ)</td><td class="r">' + baht(tot.inV) + '</td><td class="r">' + baht(tot.outV) + '</td></tr></tfoot>' : '') + '</table>';
    }
    if (P.q.repDetail || mm) {
      var bal = {};
      sum.forEach(function (x) { bal[x.id] = x.open; });
      html += '<h5>' + (mm ? 'รายการเคลื่อนไหว' : 'รายการรับเข้า-จ่ายออก') + ' <small>(' + det.length + ' รายการ)</small></h5><table class="rt"><thead><tr><th>วัน/เดือน/ปี</th>' + (mm ? '' : '<th>วัตถุดิบ</th>')
        + '<th class="r">รับเข้า</th><th class="r">จ่ายออก</th><th class="r">คงเหลือ</th><th>LOT</th><th>ผู้เบิก</th><th>ผู้จ่าย</th><th>หมายเหตุ</th></tr></thead><tbody>'
        + (mm ? '<tr class="sub"><td>' + dd(r.from) + '</td><td colspan="2">ยอดยกมา</td><td class="r b">' + n3(bal[mid] || 0) + '</td><td colspan="4"></td></tr>' : '')
        + (det.map(function (x) {
          var s = x.type === 'IN' || (x.type === 'ADJ' && x.qty > 0) ? Math.abs(x.qty) : -Math.abs(x.qty);
          bal[x.materialId] = Math.round(((bal[x.materialId] || 0) + s) * 1000) / 1000;
          var note = [x.type === 'RETURN' ? 'ส่งคืนผู้ขาย' : x.type === 'ADJ' ? 'ปรับยอด' : '', x.note].filter(String).join(' · ');
          return '<tr><td class="nw">' + dd(x.date) + '</td>' + (mm ? '' : '<td>' + esc(x.name) + '</td>') + '<td class="r">' + (s > 0 ? n3(s) : '') + '</td><td class="r">' + (s < 0 ? n3(-s) : '') + '</td><td class="r b">' + n3(bal[x.materialId]) + '</td>'
            + '<td class="nw">' + esc(x.lot) + '</td><td class="nw">' + esc(x.requester) + '</td><td class="nw">' + esc(x.issuer) + '</td><td>' + esc(note) + '</td></tr>';
        }).join('') || '<tr><td colspan="9" class="c muted">ไม่มีรายการ</td></tr>') + '</tbody></table>';
    }
    // หัวรายงานอยู่ใน <thead> ของตารางครอบ → เวลาพิมพ์ขึ้นซ้ำทุกหน้า
    var head = html.slice('<div class="preport">'.length, headEnd), body = html.slice(headEnd, html.length - '</div>'.length);
    $('rOut').innerHTML = '<div class="preport"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
  }
  // หัวรายงาน (ขึ้นซ้ำทุกหน้าเวลาพิมพ์) + เนื้อหา
  function reportWrap(title, info, body) {
    var now = new Date(), logo = document.querySelector('.brand-logo');
    var head = '<div class="rhead">' + (logo ? '<img class="rlogo" src="' + logo.src + '" alt="">' : '')
      + '<div class="rco"><b>' + COMPANY + '</b><span>แผนกจัดซื้อ & สต๊อกสินค้า</span></div>'
      + '</div>'   // รหัสแบบฟอร์ม FM-WH-01-01 ใช้เฉพาะรายงานเบิกจ่าย (drawReport)
      + '<h4 class="rtitle">' + title + '</h4><div class="rinfo">' + info + '<span>พิมพ์เมื่อ ' + dd(todayIso()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' น.</span></div>';
    return '<div class="preport"><table class="rwrap"><thead><tr><td>' + head + '</td></tr></thead><tbody><tr><td>' + body + '</td></tr></tbody></table></div>';
  }

  // รายงานประวัติราคา: จัดกลุ่มตามผู้ขาย · เทียบกับราคาก่อนหน้าของวัตถุดิบเดียวกัน
  function drawPriceReport(r) {
    var rows = r.rows.filter(function (x) { return (!P.q.repVen || x.vendorId === P.q.repVen) && (!P.q.repMat || x.materialId === P.q.repMat); });
    var up = rows.filter(function (x) { return x.change !== '' && x.change > 0; }).length, down = rows.filter(function (x) { return x.change !== '' && x.change < 0; }).length;
    var first = rows.filter(function (x) { return x.prevPrice === ''; }).length;
    var body = '<div class="rbox">' + [['ปรับราคาทั้งหมด', rows.length + ' ครั้ง'], ['ขึ้นราคา', up + ' ครั้ง'], ['ลดราคา', down + ' ครั้ง'], ['ราคาแรก (ไม่มีราคาเดิม)', first + ' ครั้ง']]
      .map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<h5>ประวัติราคา <small>(' + rows.length + ' รายการ)</small></h5><table class="rt"><thead><tr><th>วันที่มีผล</th><th>วัตถุดิบ</th><th>หน่วย</th><th class="r">ราคาเดิม</th><th class="r">ราคาใหม่</th><th class="r">เปลี่ยนแปลง</th><th>หมายเหตุ</th></tr></thead><tbody>';
    var lastVen = null;
    rows.forEach(function (x) {
      if (x.vendor !== lastVen) { lastVen = x.vendor; body += '<tr class="sub"><td colspan="7"><b>' + esc(x.vendor || 'ไม่ระบุผู้ขาย') + '</b></td></tr>'; }
      var ch = x.change === '' ? '<span class="muted">ราคาแรก</span>' : (x.change > 0 ? '<span class="neg">▲ ' : x.change < 0 ? '<span class="pos">▼ ' : '<span>') + baht(Math.abs(x.change)) + (x.pct !== '' ? ' (' + (x.pct > 0 ? '+' : '') + x.pct + '%)' : '') + '</span>';
      body += '<tr><td class="nw">' + dd(x.date) + '</td><td>' + esc(x.material) + '</td><td>' + esc(x.unit) + '</td><td class="r">' + (x.prevPrice === '' ? '–' : baht(x.prevPrice) + '<br><small class="muted">' + dd(x.prevDate) + '</small>') + '</td>'
        + '<td class="r b">' + baht(x.price) + '</td><td class="r">' + ch + '</td><td>' + esc(x.note) + '</td></tr>';
    });
    if (!rows.length) body += '<tr><td colspan="7" class="c muted">ไม่มีการปรับราคาในช่วงนี้</td></tr>';
    body += '</tbody></table>';
    var vn = P.q.repVen ? ven(P.q.repVen) : null, mm = P.q.repMat ? mat(P.q.repMat) : null;
    $('rOut').innerHTML = reportWrap('รายงานประวัติราคา', '<span>วันที่มีผล <b>' + dd(r.from) + ' – ' + dd(r.to) + '</b></span>' + (vn ? '<span>ผู้ขาย <b>' + esc(vn.name) + '</b></span>' : '') + (mm ? '<span>วัตถุดิบ <b>' + esc(mm.name) + '</b></span>' : ''), body);
  }

  // รายงานตรวจ 3 ทาง: PO ตามวันที่สั่ง
  function drawMatchReport(from, to) {
    var pos = P.data.docs.filter(function (d) { return d.type === 'PO' && d.status !== 'cancelled' && d.orderDate >= from && d.orderDate <= to; })
      .sort(function (a, b) { return String(a.orderDate).localeCompare(String(b.orderDate)) || String(a.docNo).localeCompare(String(b.docNo)); });
    var cnt = function (st) { return pos.filter(function (d) { return d.match && d.match.status === st; }).length; };
    var body = '<div class="rbox">' + [['PO ทั้งหมด', pos.length + ' ใบ'], ['ตรงกันครบ 3 ทาง', cnt('ok') + ' ใบ'], ['ไม่ตรง', cnt('diff') + ' ใบ'], ['รอรับของ / รอใบแจ้งหนี้', (cnt('norecv') + cnt('noinv')) + ' ใบ']]
        .map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<h5>ผลตรวจ 3 ทาง <small>(' + pos.length + ' ใบ)</small></h5><table class="rt"><thead><tr><th>PO / วันที่</th><th>ผู้ขาย</th><th class="r">ยอด PO</th><th>ใบแจ้งหนี้</th><th class="r">ยอดใบแจ้งหนี้</th><th>ผล</th><th>รายละเอียดที่ไม่ตรง</th><th>การชำระ</th></tr></thead><tbody>'
      + (pos.map(function (d) {
        var m = d.match || {}, invs = P.data.invoices.filter(function (x) { return x.docId === d.id; });
        var issues = (m.lines || []).filter(function (l) { return !l.ok; }).map(function (l) { return esc(l.name) + ': ' + l.issues.map(esc).join(', '); });
        return '<tr><td class="nw"><b>' + esc(d.docNo) + '</b><br>' + dd(d.orderDate) + '</td><td>' + esc(d.vendorName) + '</td><td class="r">' + baht(d.total) + '</td><td>' + (invs.map(function (x) { return esc(x.invoiceNo); }).join('<br>') || '–') + '</td>'
          + '<td class="r">' + (invs.length ? baht(m.invoiceTotal) : '–') + '</td><td class="nw ' + (m.status === 'ok' ? 'pos' : m.status === 'diff' ? 'neg' : '') + '">' + esc(m.label || '') + '</td><td><small>' + (m.status === 'diff' ? issues.join('<br>') : '') + '</small></td>'
          + '<td>' + (PAY_ST[d.paymentStatus] || '') + (d.matchNote ? '<br><small class="neg">ชำระแม้ไม่ตรง: ' + esc(d.matchNote) + '</small>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="c muted">ไม่มี PO ในช่วงนี้</td></tr>') + '</tbody></table>';
    $('rOut').innerHTML = reportWrap('รายงานตรวจ 3 ทาง (PO / รับของ / ใบแจ้งหนี้)', '<span>วันที่สั่ง <b>' + dd(from) + ' – ' + dd(to) + '</b></span>', body);
  }
  // รายงานประเมินผู้ขาย (จัดอันดับตามคะแนนเฉลี่ย) + ตัวชี้วัดจากข้อมูลจริง
  function drawVendorReport(r) {
    var ev = r.rows.filter(function (x) { return x.eval; });
    var avg = ev.length ? Math.round(ev.reduce(function (a, x) { return a + x.eval.score; }, 0) / ev.length * 100) / 100 : '';
    var body = '<div class="rbox">' + [['ผู้ขายที่ประเมินแล้ว', ev.length + ' ราย'], ['ยังไม่ประเมิน (มี PO)', (r.rows.length - ev.length) + ' ราย'], ['คะแนนเฉลี่ย', avg === '' ? '–' : avg + ' / 5'], ['ต่ำกว่า 3 คะแนน', ev.filter(function (x) { return x.eval.score < 3; }).length + ' ราย']]
        .map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<h5>จัดอันดับผู้ขาย <small>(' + qLabel(r.period) + ')</small></h5><table class="rt"><thead><tr><th class="c">อันดับ</th><th>ผู้ขาย</th><th class="r">คุณภาพ</th><th class="r">ตรงเวลา</th><th class="r">ราคา</th><th class="r">บริการ</th><th class="r">เฉลี่ย</th>'
      + '<th class="r">PO (ใบ / บาท)</th><th class="r">ส่งตรงเวลา</th><th class="r">QC ไม่ผ่าน</th><th>ความเห็น</th></tr></thead><tbody>'
      + (r.rows.map(function (x, i) {
        var e = x.eval;
        return '<tr><td class="c">' + (e ? i + 1 : '–') + '</td><td>' + esc(x.name) + '</td>' + (e ? '<td class="r">' + e.quality + '</td><td class="r">' + e.delivery + '</td><td class="r">' + e.price + '</td><td class="r">' + e.service + '</td><td class="r b' + (e.score < 3 ? ' neg' : '') + '">' + e.score + '</td>' : '<td colspan="5" class="c muted">ยังไม่ประเมิน</td>')
          + '<td class="r">' + x.poCount + ' / ' + baht(x.poTotal) + '</td><td class="r">' + (x.onTimeRate === '' ? '–' : x.onTimeRate + '%') + '</td><td class="r">' + (x.qcFailRate === '' ? '–' : x.qcFailRate + '%') + '</td><td><small>' + esc(e ? e.comment : '') + '</small></td></tr>';
      }).join('') || '<tr><td colspan="11" class="c muted">ยังไม่มีข้อมูลของไตรมาสนี้</td></tr>') + '</tbody></table>';
    $('rOut').innerHTML = reportWrap('รายงานประเมินผู้ขาย', '<span>รอบ <b>' + qLabel(r.period) + '</b> (' + dd(r.from) + ' – ' + dd(r.to) + ')</span>', body);
  }

  // รายงานสินค้าที่ต้องจัดซื้อ: คงเหลือ ≤ Minimum (หรือติดลบ) · ควรสั่งอย่างน้อย = Minimum − คงเหลือ − ที่สั่งแล้วรอรับ
  function drawReorderReport() {
    var onOrder = {};
    P.data.docs.forEach(function (d) {
      if (d.type !== 'PO' || !/approved|ordered|partial/.test(d.status)) return;
      d.items.forEach(function (it) { if (it.materialId) (onOrder[it.materialId] = onOrder[it.materialId] || []).push({ qty: Number(it.qty) || 0, docNo: d.docNo }); });
    });
    var rows = P.data.materials.filter(function (m) { return m.active !== 'ปิด' && ((m.minStock !== '' && m.minStock != null && m.balance <= m.minStock) || m.balance < 0); })
      .map(function (m) {
        var oo = onOrder[m.id] || [], ordered = oo.reduce(function (a, x) { return a + x.qty; }, 0);
        var need = Math.max(0, Math.round(((Number(m.minStock) || 0) - m.balance - ordered) * 1000) / 1000);
        return { m: m, vn: ven(m.vendorId), ordered: ordered, poNos: oo.map(function (x) { return x.docNo; }), need: need, cost: m.price !== '' && need ? Math.round(need * m.price * 100) / 100 : '' };
      })
      .sort(function (a, b) { var va = a.vn ? a.vn.name : 'ฮ', vb = b.vn ? b.vn.name : 'ฮ'; return va.localeCompare(vb, 'th') || a.m.name.localeCompare(b.m.name, 'th'); });
    var total = rows.reduce(function (a, r) { return a + (r.cost || 0); }, 0);
    var body = '<div class="rbox">' + [['สินค้าที่ต้องจัดซื้อ', rows.length + ' รายการ'], ['ยอดติดลบ', rows.filter(function (r) { return r.m.balance < 0; }).length + ' รายการ'],
        ['สั่งแล้วรอรับ', rows.filter(function (r) { return r.ordered; }).length + ' รายการ'], ['ประมาณการค่าสั่งซื้อ', baht(total)]]
        .map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<h5>สินค้าที่ต้องจัดซื้อ <small>(' + rows.length + ' รายการ · แยกตามผู้ขาย)</small></h5><table class="rt"><thead><tr><th class="c">#</th><th>วัตถุดิบ</th><th>หน่วย</th><th class="r">คงเหลือ</th><th class="r">Minimum</th>'
      + '<th class="r">สั่งแล้วรอรับ</th><th class="r">ควรสั่งอย่างน้อย</th><th class="r">ราคา/หน่วย</th><th class="r">ประมาณการ (บาท)</th></tr></thead><tbody>';
    var lastV = null;
    rows.forEach(function (r, i) {
      var vname = r.vn ? r.vn.name : 'ไม่ระบุผู้ขาย';
      if (vname !== lastV) { lastV = vname; body += '<tr class="sub"><td colspan="9"><b>' + esc(vname) + '</b>' + (r.vn && (r.vn.phone || r.vn.phone2) ? ' · โทร ' + esc(r.vn.phone || r.vn.phone2) : '') + (r.vn && r.vn.contact ? ' · ' + esc(r.vn.contact) : '') + '</td></tr>'; }
      body += '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(r.m.name) + '</td><td>' + esc(r.m.unit) + '</td><td class="r b' + (r.m.balance < 0 ? ' neg' : '') + '">' + n3(r.m.balance) + '</td>'
        + '<td class="r">' + (r.m.minStock === '' || r.m.minStock == null ? '–' : n3(r.m.minStock)) + '</td><td class="r">' + (r.ordered ? n3(r.ordered) + '<br><small class="muted">' + esc(r.poNos.join(', ')) + '</small>' : '–') + '</td>'
        + '<td class="r b">' + (r.need ? n3(r.need) : '–') + '</td><td class="r">' + (r.m.price === '' ? '–' : baht(r.m.price)) + '</td><td class="r">' + (r.cost === '' ? '–' : baht(r.cost)) + '</td></tr>';
    });
    if (!rows.length) body += '<tr><td colspan="9" class="c muted">ไม่มีสินค้าที่ต้องจัดซื้อ (ตั้งค่า Minimum ได้ที่เมนู "วัตถุดิบ & ราคา")</td></tr>';
    body += '</tbody>' + (rows.length ? '<tfoot><tr><td colspan="8" class="r">ประมาณการค่าสั่งซื้อรวม (เฉพาะรายการที่มีราคา)</td><td class="r">' + baht(total) + '</td></tr></tfoot>' : '') + '</table>'
      + '<p class="muted" style="margin-top:8px">* ควรสั่งอย่างน้อย = Minimum − คงเหลือ − จำนวนใน PO ที่สั่งแล้วยังไม่ได้รับ (สั่งมากกว่านี้ได้ตามรอบการสั่งซื้อ)</p>';
    $('rOut').innerHTML = reportWrap('รายงานสินค้าที่ต้องจัดซื้อ', '<span>ข้อมูล ณ วันที่ <b>' + dd(P.data.today || todayIso()) + '</b></span>', body);
  }

  // รายงานสต๊อกคงเหลือ ณ วันที่ + มูลค่า (คงเหลือ × ราคา ณ วันนั้น)
  function drawBalanceReport(r) {
    var body = '<div class="rbox">' + [['จำนวนวัตถุดิบที่มีของ', r.rows.length + ' รายการ'], ['มูลค่าคงเหลือรวม', baht(r.total)], ['ยังไม่มีราคา', r.noPrice + ' รายการ'], ['ณ วันที่', dd(r.asOf)]]
        .map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<h5>สต๊อกคงเหลือ <small>(' + r.rows.length + ' รายการ)</small></h5><table class="rt"><thead><tr><th class="c">#</th><th>วัตถุดิบ</th><th>หน่วย</th><th class="r">คงเหลือ</th><th class="r">ราคา/หน่วย</th><th>ราคา ณ วันที่</th><th class="r">มูลค่า (บาท)</th></tr></thead><tbody>'
      + (r.rows.map(function (x, i) {
        return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.unit) + '</td><td class="r b' + (x.qty < 0 ? ' neg' : '') + '">' + n3(x.qty) + '</td>'
          + '<td class="r">' + (x.price === '' ? '<span class="muted">ยังไม่มีราคา</span>' : baht(x.price)) + '</td><td class="nw">' + (x.priceDate ? dd(x.priceDate) : '–') + '</td><td class="r b">' + (x.value === '' ? '–' : baht(x.value)) + '</td></tr>';
      }).join('') || '<tr><td colspan="7" class="c muted">ไม่มีสต๊อกคงเหลือ ณ วันที่นี้</td></tr>')
      + '</tbody>' + (r.rows.length ? '<tfoot><tr><td colspan="6" class="r">มูลค่าคงเหลือรวม</td><td class="r">' + baht(r.total) + '</td></tr></tfoot>' : '') + '</table>'
      + (r.noPrice ? '<p class="muted" style="margin-top:8px">* รายการที่ยังไม่มีราคาไม่ได้รวมในมูลค่า — ใส่ราคาได้ที่เมนู "วัตถุดิบ & ราคา"</p>' : '');
    $('rOut').innerHTML = reportWrap('รายงานสต๊อกคงเหลือ', '<span>ยอดคงเหลือ ณ วันที่ <b>' + dd(r.asOf) + '</b></span>', body);
  }

  // รายงานใบ PO / PR ตามวันที่สั่ง
  function drawDocReport(type, from, to) {
    var isPO = type === 'PO';
    var list = P.data.docs.filter(function (d) { return d.type === type && d.orderDate >= from && d.orderDate <= to; })
      .sort(function (a, b) { return String(a.orderDate).localeCompare(String(b.orderDate)) || String(a.docNo).localeCompare(String(b.docNo)); });
    var live = list.filter(function (d) { return d.status !== 'cancelled'; });
    var total = live.reduce(function (s, d) { return s + (Number(d.total) || 0); }, 0);
    var paid = live.reduce(function (s, d) { return s + (Number(d.paidAmount) || 0); }, 0);
    var boxes = [['จำนวนใบ', live.length + (list.length > live.length ? ' <small>(ยกเลิก ' + (list.length - live.length) + ')</small>' : '')], ['ยอดรวม', baht(total)]]
      .concat(isPO ? [['ชำระแล้ว', baht(paid)], ['ค้างชำระ', baht(total - paid)]] : [['อนุมัติแล้ว', live.filter(function (d) { return d.status !== 'draft'; }).length + ' ใบ'], ['รออนุมัติ', live.filter(function (d) { return d.status === 'draft'; }).length + ' ใบ']]);
    var body = '<div class="rbox">' + boxes.map(function (b) { return '<div><span>' + b[0] + '</span><b>' + b[1] + '</b></div>'; }).join('') + '</div>'
      + '<h5>' + (isPO ? 'ใบสั่งซื้อ' : 'ใบขอซื้อ') + ' <small>(' + list.length + ' ใบ)</small></h5><table class="rt"><thead><tr><th class="c">#</th><th>เลขที่ / วันที่</th><th>ผู้ขาย</th><th>รายการ</th><th>ส่งของ</th><th>สถานะ</th><th class="r">ยอดรวม</th>'
      + (isPO ? '<th>การชำระ</th><th class="r">ค้างชำระ</th>' : '<th>ผู้อนุมัติ</th>') + '</tr></thead><tbody>'
      + (list.map(function (d, i) {
        var cx = d.status === 'cancelled', due = (Number(d.total) || 0) - (Number(d.paidAmount) || 0);
        return '<tr' + (cx ? ' class="cx"' : '') + '><td class="c">' + (i + 1) + '</td><td class="nw"><b>' + esc(d.docNo) + '</b><br>' + dd(d.orderDate) + '</td><td>' + esc(d.vendorName || '-') + (d.vendorPhone ? '<br><small>' + esc(d.vendorPhone) + '</small>' : '') + '</td>'
          + '<td>' + d.items.map(function (it) { return esc(it.materialName) + ' <span class="nw">' + n3(it.qty) + ' ' + esc(it.unit) + (it.price !== '' ? ' × ' + baht(it.price).replace('฿', '') : '') + '</span>'; }).join('<br>') + '</td>'
          + '<td class="nw">' + dd(d.deliveryDate) + '</td><td>' + (DOC_ST[d.status] || '') + (d.approvedDate && !isPO ? '' : '') + '</td><td class="r b">' + baht(d.total) + '</td>'
          + (isPO ? '<td>' + (PAY_ST[d.paymentStatus] || '-') + (d.paymentStatus !== 'paid' && d.dueDate ? '<br><small>ครบกำหนด ' + dd(d.dueDate) + '</small>' : d.paidDate ? '<br><small>' + dd(d.paidDate) + '</small>' : '') + '</td><td class="r">' + (cx ? '–' : baht(due)) + '</td>'
            : '<td>' + esc(d.approvedBy || '-') + (d.approvedDate ? '<br><small>' + dd(d.approvedDate) + '</small>' : '') + '</td>') + '</tr>';
      }).join('') || '<tr><td colspan="9" class="c muted">ไม่มี' + (isPO ? 'ใบสั่งซื้อ' : 'ใบขอซื้อ') + 'ในช่วงนี้</td></tr>')
      + '</tbody>' + (list.length ? '<tfoot><tr><td colspan="6" class="r">รวม (ไม่นับใบที่ยกเลิก)</td><td class="r">' + baht(total) + '</td>' + (isPO ? '<td></td><td class="r">' + baht(total - paid) + '</td>' : '<td></td>') + '</tr></tfoot>' : '') + '</table>';
    $('rOut').innerHTML = reportWrap(isPO ? 'รายงานใบสั่งซื้อ (PO)' : 'รายงานใบขอซื้อ (PR)', '<span>วันที่สั่ง <b>' + dd(from) + ' – ' + dd(to) + '</b></span>', body);
  }

  // หัวกระดาษของเบราว์เซอร์ (ถ้าเบราว์เซอร์ยังแสดง) ใช้ชื่อหน้า → ตั้งเป็นชื่อบริษัท + รหัสแบบฟอร์มระหว่างพิมพ์
  var oldTitle = '';
  window.addEventListener('beforeprint', function () { if (state.page === 'p_rep') { oldTitle = document.title; document.title = COMPANY + ((P.q.repType || 'stock') === 'stock' ? '   ' + FORM_CODE : ''); } });
  window.addEventListener('afterprint', function () { if (oldTitle) { document.title = oldTitle; oldTitle = ''; } });



  // ==================== ประวัติการแก้ไข ====================
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><p class="lead">ทุกการเพิ่ม / แก้ไข / ลบ บันทึกไว้ในแท็บ "ประวัติแก้ไข" ของ Google Sheet</p><div id="pList" class="panel">กำลังโหลด…</div>';
    call('purLog', state.token, 300).then(function (r) {
      if (state.page !== 'p_log') return;
      $('pList').innerHTML = r.log.length ? '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>ข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody>' + r.log.map(function (x) {
        return '<tr><td><small>' + esc(x.time) + '</small></td><td>' + esc(x.action) + '</td><td>' + esc(x.table) + '</td><td><small>' + esc(labelIds(x.detail)) + '</small></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="muted">ยังไม่มีประวัติ</div>';
    }).catch(onServerError);
  }
  function labelIds(s) { return String(s || '').replace(/\b(M[0-9A-Z]{2,})\b/g, function (x) { var m = mat(x); return m ? m.name : x; }); }

  // ---------- สไตล์ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    '.dialog.wide{max-width:720px}.dialog.wide .dialog-body{max-height:calc(100vh - 170px);overflow:auto}',
    '#modalOverlay{align-items:start;overflow:auto}#modalOverlay .dialog{margin:4vh 0}',
    '.pform{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-bottom:12px}.pf{min-width:0}.pf.full{grid-column:1/-1}',
    '.pf label{font-size:13px;color:var(--muted);margin-bottom:4px}.pf input,.pf select,.pf textarea,.pitem input,.psearch input{width:100%;padding:9px 11px;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:15px;background:#fff;color:var(--ink)}',
    '.pf input:focus,.pf select:focus,.pf textarea:focus,.pitem input:focus{outline:none;border-color:var(--c)}',
    '.pbar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;background:rgba(255,255,255,.92);padding:10px;border-radius:12px;box-shadow:var(--shadow)}',
    '.psearch{flex:1;min-width:180px;position:relative}.psearch svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted)}.psearch input{padding-left:36px}',
    '.pchk{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;margin:0;white-space:nowrap}',
    '.plist{display:flex;flex-direction:column;gap:8px}.prow{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-align:left;color:inherit;width:100%;box-shadow:var(--shadow)}',
    '.prow.click:hover{border-color:var(--c)}.pinfo{flex:1;min-width:0}.pinfo b{display:block}.pinfo small{color:var(--muted)}',
    '.pbal{font-size:20px;font-weight:700;text-align:right;min-width:84px}.pbal small{display:block;font-size:11px;font-weight:500;color:var(--muted)}',
    '.pprice{text-align:right;font-weight:600;white-space:nowrap}.pprice small{display:block;font-weight:400;color:var(--muted);font-size:11.5px}',
    '.pbtns{display:flex;gap:6px}.pin{background:#16a34a;color:#fff}.pout{background:#dc2626;color:#fff}.pbtns svg.ic,.pbar svg.ic,.vacts svg.ic,.pfoot svg.ic,.psec svg.ic{width:16px;height:16px}',
    '.neg{color:#dc2626}.warn{color:#d97706}.pos{color:#15803d}.muted{color:var(--muted);font-size:13px}',
    '.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}.kpi{border:0;background:var(--surface);border-radius:12px;padding:14px;text-align:left;box-shadow:var(--shadow);border-top:4px solid var(--k)}',
    '.kpi b{display:block;font-size:22px;color:var(--k)}.kpi span{font-size:12.5px;color:var(--muted)}',
    '.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.pbox h4{margin:0 0 8px;display:flex;align-items:center;gap:6px}.pbox h4 svg{width:18px;height:18px;color:var(--c)}',
    '.li{display:grid;grid-template-columns:1fr auto;gap:0 10px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.li small{grid-column:1/-1;color:var(--muted);font-size:12px}.li.click{cursor:pointer}.li.click:hover span{color:var(--c)}',
    '.pchips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.chip{border:1.5px solid var(--line);background:#fff;border-radius:99px;padding:5px 12px;font-size:13px}.chip.on{background:var(--c);border-color:var(--c);color:#fff}',
    '.dt{display:inline-block;font-size:11px;padding:1px 7px;border-radius:6px;color:#fff;background:#7c3aed;vertical-align:2px}.dt.PO{background:#2563eb}',
    '.tag.st-received{background:#dcfce7;color:#15803d}.tag.st-cancelled{background:#f1f5f9;color:#64748b;text-decoration:line-through}.tag.st-draft{background:#f1f5f9;color:#475569}.tag.st-approved,.tag.st-ordered,.tag.st-partial{background:#dbeafe;color:#1d4ed8}',
    '.psec{border-top:1px solid var(--line);padding-top:12px;margin:12px 0}.psec-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}.psec-h .btn,.pbar .btn{flex:none}',
    '.pitems{display:flex;flex-direction:column;gap:6px}.pitem{display:grid;grid-template-columns:2.2fr .9fr .8fr 1fr .9fr auto;gap:6px;align-items:center}.pitem input{padding:7px 9px;font-size:14px}.iamt{text-align:right;font-size:13px;font-weight:600}',
    '.ptotal{text-align:right;margin-top:8px}.ptotal b{font-size:18px}',
    '.icon-btn{border:0;background:#f1f5f9;border-radius:8px;padding:6px;display:inline-grid;color:var(--muted)}.icon-btn:hover{color:var(--ink)}.icon-btn svg.ic{width:16px;height:16px}',
    '.link-btn.danger{color:#dc2626}.pfoot{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
    '.pfile{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed var(--line)}.pfile small{color:var(--muted);flex:1}.flink{display:inline-flex;align-items:center;gap:4px;color:var(--c);font-weight:500;font-size:13px;word-break:break-all}.flink svg{width:14px;height:14px}',
    '.pupload{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:8px}',
    '.ptable-wrap{overflow-x:auto;background:var(--surface);border-radius:10px}.ptable{width:100%;border-collapse:collapse;font-size:13.5px}.ptable th,.ptable td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.ptable th{background:#f8fafc;font-weight:600;white-space:nowrap}.ptable .r{text-align:right;white-space:nowrap}.ptable tfoot td{font-weight:700;background:#f8fafc}.ptable tr.cur td{background:#f0fdf4}',
    '.mt{font-weight:600}.mt.IN{color:#15803d}.mt.OUT,.mt.RETURN{color:#dc2626}.mt.ADJ{color:#7c3aed}',
    '.pcards{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vcard{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}.vcard.off{opacity:.55}',
    '.vhead{display:flex;justify-content:space-between;gap:8px}.vacts{display:flex;gap:6px;flex-wrap:wrap}.vcall{background:#16a34a;color:#fff;text-decoration:none;font-size:15px}.vacts .btn-line{text-decoration:none}.vmeta{display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--muted)}',
    '.preport{background:#fff;border-radius:14px;padding:22px;margin-top:14px;box-shadow:var(--shadow);color:#0f172a}',
    '.rhead{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2px solid #0f172a}.rlogo{height:46px;width:auto}.rco{flex:1}.rco b{display:block;font-size:16px}.rco span{font-size:12.5px;color:#475569}',
    '.rform{font-size:11px;color:#334155;text-align:right;line-height:1.5;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;white-space:nowrap}',
    '.rtitle{text-align:center;font-size:19px;margin:14px 0 6px}.rinfo{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 18px;font-size:12.5px;color:#334155;margin-bottom:12px}',
    '.rbox{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #cbd5e1;border-radius:8px;margin:6px 0 4px;overflow:hidden}.rbox div{padding:8px;text-align:center;border-left:1px solid #cbd5e1}.rbox div:first-child{border-left:0}.rbox span{display:block;font-size:11.5px;color:#64748b}.rbox b{font-size:17px}',
    '.preport h5{font-size:13.5px;margin:16px 0 6px;padding-left:8px;border-left:4px solid var(--c)}.preport h5 small{font-weight:400;color:#64748b}',
    '.pf.hl label{color:#b45309;font-weight:600}.pf.hl input{background:#fef9c3;border-color:#f59e0b}.pf.hl input:focus{border-color:#d97706;box-shadow:0 0 0 3px rgba(245,158,11,.25)}.rt tr.cx td{color:#94a3b8;text-decoration:line-through}',
    '.mstat{display:inline-block;font-weight:700;border-radius:8px;padding:4px 10px;margin-bottom:8px;background:#f1f5f9;color:#475569}.mstat.ok{background:#dcfce7;color:#15803d}.mstat.diff{background:#fee2e2;color:#b91c1c}.mstat.noinv{background:#fef3c7;color:#b45309}',
    '.minv{margin-top:6px}.minv .pfile b{font-size:13px}.ptable input{width:100%;min-width:70px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:14px;text-align:right}',
    '.ptable.cmp th.qh{min-width:120px}.ptable.cmp th.win{background:#dcfce7}.ptable.cmp td.best{background:#f0fdf4;color:#15803d;font-weight:700}.ptable.cmp tr.sub td{background:#f8fafc}.ptable.cmp td .btn{margin:2px 0}',
    '.stars{color:#f59e0b;letter-spacing:1px}.stars i{color:#e2e8f0;font-style:normal}.pitem.rq{grid-template-columns:2.2fr 1fr 1fr auto}',
    '.preport p.muted{font-size:11.5px}.rt .muted{font-size:inherit}.rt{width:100%;border-collapse:collapse;font-size:12.5px}.rt th{background:#f1f5f9;font-weight:600;text-align:left;padding:5px 6px;border:1px solid #cbd5e1;white-space:nowrap}.rt td{padding:4px 6px;border:1px solid #e2e8f0;vertical-align:top}',
    '.rt tbody tr:nth-child(even) td{background:#f8fafc}.rt .r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.rt .c{text-align:center}.rt .b{font-weight:700}.rt .nw{white-space:nowrap}.rt tfoot td{font-weight:700;background:#f1f5f9;border:1px solid #cbd5e1}.rt tr.sub td{background:#fefce8}',
    '.psign{display:flex;justify-content:space-around;gap:16px;margin-top:44px;text-align:center;font-size:12px;line-height:1.9;break-inside:avoid}.psign span{display:block;width:150px;border-bottom:1px dotted #475569;height:22px;margin:0 auto 4px}',
    '.spinner.dark{border-color:rgba(15,23,42,.2);border-top-color:var(--c);display:inline-block;vertical-align:-3px;margin-right:6px}',
    '@media (max-width:860px){.kpis{grid-template-columns:repeat(2,1fr)}.pgrid,.pcards{grid-template-columns:1fr}}',
    '@media (max-width:560px){.pform{grid-template-columns:1fr}.prow{flex-wrap:wrap}.pbtns{width:100%}.pbtns .btn{flex:1}.hide-sm{display:none}.pitem{grid-template-columns:1fr 1fr 1fr;}.pitem .iname{grid-column:1/-1}.pupload{grid-template-columns:1fr}.dialog.wide .dialog-body{max-height:none}}',
    '@page{size:A4 portrait;margin:10mm 11mm 13mm 11mm;@bottom-right{content:"หน้า " counter(page) " / " counter(pages);font:8pt "IBM Plex Sans Thai",sans-serif;color:#64748b}}',
    '.rwrap{width:100%;border-collapse:collapse}.rwrap>thead>tr>td,.rwrap>tbody>tr>td{padding:0;border:0;background:none}.rwrap>thead>tr>td{padding-bottom:4px}',
    '@media print{html,body{background:#fff!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.topbar,.side,.noprint,.page-head,#toast,.pbar,#modalOverlay{display:none!important}.app{display:block;min-height:0}.main{padding:0;max-width:none}',
    '.preport{box-shadow:none;padding:0;margin:0;border-radius:0}.rhead{padding-bottom:6px}.rlogo{height:38px}.rco b{font-size:13pt}.rco span{font-size:9pt}.rform{font-size:8pt}.rtitle{font-size:14pt;margin:10px 0 4px}.rinfo{font-size:9pt;margin-bottom:8px}',
    '.preport h5{font-size:10.5pt;margin:12px 0 4px;break-after:avoid}.rt{font-size:8.5pt}.rt th{padding:3px 4px}.rt td{padding:2.5px 4px}.rt thead,.rwrap>thead{display:table-header-group}.rt tr{break-inside:avoid}.rbox b{font-size:12pt}.psign{margin-top:36px;font-size:9pt}}',
  ].join('\n');
  document.head.appendChild(css);
})();
