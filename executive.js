// ==================== ผู้บริหาร: Dashboard ทุกฝ่าย (ดูอย่างเดียว) ====================
// index.html เรียก EXEC.menus() / EXEC.render(page) เมื่อเข้าด้วยการ์ด "ผู้บริหาร"
// ข้อมูลมาจาก Executive.gs (execOverview / execDashboard) · ใช้สไตล์ร่วมกับ purchasing.js (.kpi .pbox .chip ...)
(function () {
  var X = window.EXEC = { depts: null, q: {}, data: null, seq: 0 };
  var IN_C = '#16a34a', OUT_C = '#dc2626';   // ตรงกับปุ่มรับเข้า (เขียว) / จ่ายออก (แดง) ในระบบจัดซื้อ

  function pad(n) { return ('0' + n).slice(-2); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function shift(s, n) { var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return iso(d); }
  function dd(s) { if (!s) return '-'; var p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function n3(v) { return Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 3 }); }
  function baht(v) { return '฿' + Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  X.menus = function () { return [{ id: 'x_dash', label: 'Dashboard ทุกฝ่าย', ic: 'chart' }]; };
  X.reset = function () { X.depts = null; X.data = null; X.q = {}; };

  X.render = function () {
    var t = today();
    X.q.from = X.q.from || t.slice(0, 8) + '01'; X.q.to = X.q.to || t;
    if (!X.depts) {
      $('main').innerHTML = '<h3>Dashboard ผู้บริหาร</h3><p class="lead">กำลังโหลด…</p>';
      call('execOverview', state.token).then(function (r) {
        X.depts = r.depts;
        if (!X.q.dept) X.q.dept = (r.depts.filter(function (d) { return d.ready; })[0] || r.depts[0]).key;
        X.render();
      }).catch(onServerError);
      return;
    }
    var lastM = shift(t.slice(0, 8) + '01', -1);
    var quick = [['เดือนนี้', t.slice(0, 8) + '01', t], ['เดือนก่อน', lastM.slice(0, 8) + '01', lastM], ['7 วัน', shift(t, -6), t], ['30 วัน', shift(t, -29), t], ['90 วัน', shift(t, -89), t], ['ปีนี้', t.slice(0, 4) + '-01-01', t]];
    $('main').innerHTML = '<h3>Dashboard ผู้บริหาร</h3><p class="lead">เลือกฝ่ายและช่วงวันที่ · ดูข้อมูลได้อย่างเดียว แก้ไขไม่ได้</p>'
      + '<div class="panel xfilter"><div class="xdepts">' + X.depts.map(function (d) {
        return '<button class="xdept' + (X.q.dept === d.key ? ' on' : '') + '" data-d="' + d.key + '" style="--dc:' + d.color + '"><span class="xi">' + icon(d.key, 18) + '</span>' + esc(d.name) + (d.ready ? '' : '<small>ยังไม่มีข้อมูล</small>') + '</button>';
      }).join('') + '</div>'
      + '<div class="xdates"' + (curDept().embed ? ' style="display:none"' : '') + '><label>ตั้งแต่<input type="date" id="xFrom" value="' + X.q.from + '"></label><label>ถึง<input type="date" id="xTo" value="' + X.q.to + '"></label>'
      + '<div class="pchips">' + quick.map(function (q) { return '<button class="chip' + (X.q.from === q[1] && X.q.to === q[2] ? ' on' : '') + '" data-q="' + q[1] + '|' + q[2] + '">' + q[0] + '</button>'; }).join('') + '</div></div></div>'
      + '<div id="xOut"></div>';
    on('[data-d]', function (el) { X.q.dept = el.getAttribute('data-d'); X.render(); });
    on('[data-q]', function (el) { var p = el.getAttribute('data-q').split('|'); X.q.from = p[0]; X.q.to = p[1]; X.render(); });
    ['xFrom', 'xTo'].forEach(function (id) { $(id).addEventListener('change', function () {
      var f = $('xFrom').value, to = $('xTo').value;
      if (!f || !to || f > to) return toast('เลือกช่วงวันที่ให้ถูกต้อง');
      X.q.from = f; X.q.to = to; X.render();
    }); });
    load();
  };
  function on(sel, fn) { Array.prototype.forEach.call($('main').querySelectorAll(sel), function (el) { el.addEventListener('click', function () { fn(el); }); }); }

  function curDept() { return (X.depts || []).filter(function (d) { return d.key === X.q.dept; })[0] || {}; }
  function load() {
    if (curDept().embed) return embed(curDept());
    var key = X.q.dept + '|' + X.q.from + '|' + X.q.to;
    if (X.data && X.data.key === key) return draw(X.data);
    var my = ++X.seq;
    $('xOut').innerHTML = '<div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูล…</div>';
    call('execDashboard', state.token, X.q.dept, X.q.from, X.q.to).then(function (r) {
      if (my !== X.seq || state.page !== 'x_dash') return;
      if (!r.ok) { $('xOut').innerHTML = '<div class="panel err">' + esc(r.error) + '</div>'; return; }
      r.key = key; X.data = r; draw(r);
    }).catch(onServerError);
  }

  function draw(r) {
    var d = X.depts.filter(function (x) { return x.key === X.q.dept; })[0] || {};
    if (!r.ready) {
      $('xOut').innerHTML = '<div class="empty" style="--c:' + d.color + '"><div class="icon">' + icon(d.key, 28) + '</div><h4>' + esc(d.name) + '</h4><div>' + esc(r.message) + '</div></div>';
      return;
    }
    if (r.kind === 'purchasing') drawPurchasing(r, d);
  }

  // ---------- ฝ่ายจัดซื้อ & สต๊อก ----------
  function drawPurchasing(r, d) {
    var k = r.kpi;
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var html = '<div class="xhead" style="--c:' + d.color + '"><span class="xi">' + icon(d.key, 20) + '</span><b>' + esc(d.name) + '</b><span>' + dd(r.from) + ' – ' + dd(r.to) + '</span></div>'
      + '<div class="kpis xk">'
      + tile(n3(k.inCount), 'รายการรับเข้า', IN_C, r.hasPrices ? 'มูลค่า ' + baht(k.inValue) : '')
      + tile(n3(k.outCount), 'รายการจ่ายออก', OUT_C, r.hasPrices ? 'มูลค่า ' + baht(k.outValue) : (k.returns ? 'ส่งคืนผู้ขาย ' + k.returns : ''))
      + tile(k.poCount + ' ใบ', 'ใบสั่งซื้อ (PO)', '#2563eb', baht(k.poTotal) + ' · ชำระแล้ว ' + baht(k.poPaid))
      + tile(k.prCount + ' ใบ', 'ใบขอซื้อ (PR)', '#7c3aed', baht(k.prTotal) + (k.prDraft ? ' · รออนุมัติ ' + k.prDraft : ''))
      + '</div><div class="kpis xk">'
      + tile(baht(k.unpaidTotal), 'ค้างชำระผู้ขาย (ทั้งหมด)', k.unpaidTotal ? '#b45309' : '#64748b', k.overdueCount ? 'เลยกำหนด ' + k.overdueCount + ' ใบ' : 'ไม่มีเลยกำหนด')
      + tile(k.waitingCount, 'PO รอรับของ', '#0891b2', '')
      + tile(k.low, 'สินค้าที่ต้องจัดซื้อ (ต่ำกว่า Minimum)', k.low ? '#dc2626' : '#64748b', 'จาก ' + k.materials + ' วัตถุดิบ')
      + tile(k.expiring, 'LOT ใกล้หมดอายุ (30 วัน)', k.expiring ? '#d97706' : '#64748b', k.qcFail ? 'QC ไม่ผ่านในช่วงนี้ ' + k.qcFail : '')
      + '</div>';
    html += '<div class="panel xchart"><div class="xch"><b>รับเข้า / จ่ายออก ' + (r.days.length > 62 ? 'รายเดือน' : 'รายวัน') + ' (จำนวนรายการ)</b>'
      + '<span class="xleg"><i style="background:' + IN_C + '"></i>รับเข้า<i style="background:' + OUT_C + '"></i>จ่ายออก</span></div>' + barChart(r) + '</div>';
    var maxTop = Math.max.apply(null, r.top.map(function (t) { return t.count; }).concat([1]));
    html += '<div class="pgrid">'
      + box('วัตถุดิบที่เบิกบ่อย (Top 10)', r.top.map(function (t) {
        return '<div class="xbar" title="' + esc(t.name) + ': ' + t.count + ' ครั้ง · ' + n3(t.qty) + ' ' + esc(t.unit) + '"><span class="xn">' + esc(t.name) + '</span><span class="xtrack"><span style="width:' + Math.max(3, t.count / maxTop * 100) + '%"></span></span><span class="xv">' + t.count + ' ครั้ง<small>' + n3(t.qty) + ' ' + esc(t.unit) + '</small></span></div>';
      }), 'ไม่มีการจ่ายออกในช่วงนี้')
      + box('ค้างชำระผู้ขาย', r.unpaid.map(function (x) {
        return '<div class="li"><span>' + esc(x.docNo) + ' · ' + esc(x.vendorName) + '</span><b class="' + (x.overdue ? 'neg' : '') + '">' + baht(x.due) + '</b><small>ครบกำหนด ' + dd(x.dueDate) + (x.overdue ? ' (เลยกำหนด)' : '') + '</small></div>';
      }), 'ไม่มียอดค้างชำระ')
      + box('สินค้าที่ต้องจัดซื้อ (ต่ำกว่า Minimum)', r.low.map(function (x) {
        return '<div class="li"><span>' + esc(x.name) + '</span><b class="' + (x.balance < 0 ? 'neg' : 'warn') + '">' + n3(x.balance) + ' ' + esc(x.unit) + '</b><small>' + (x.minStock === '' ? 'ยอดติดลบ — ควรนับสต๊อกจริง' : 'Minimum ' + n3(x.minStock)) + '</small></div>';
      }), 'ไม่มี')
      + box('LOT ใกล้หมดอายุ', r.expiring.map(function (x) {
        return '<div class="li"><span>' + esc(x.name) + ' <small>LOT ' + esc(x.lot) + '</small></span><b class="' + (x.left < 0 ? 'neg' : 'warn') + '">' + (x.left < 0 ? 'หมดอายุแล้ว' : 'อีก ' + x.left + ' วัน') + '</b><small>' + dd(x.expDate) + ' · เหลือ ' + n3(x.qty) + ' ' + esc(x.unit) + '</small></div>';
      }), 'ไม่มี LOT ที่หมดอายุใน 30 วัน')
      + box('PO รอรับของ', r.waiting.map(function (x) {
        return '<div class="li"><span>' + esc(x.docNo) + ' · ' + esc(x.vendorName) + '</span><b class="' + (x.late ? 'neg' : '') + '">ส่ง ' + dd(x.deliveryDate) + '</b><small>' + (x.late ? 'เลยวันส่งแล้ว' : '') + '</small></div>';
      }), 'ไม่มี PO ค้างรับ')
      + '</div>';
    $('xOut').innerHTML = html;
  }
  // ฝ่ายขาย: เปิด Meeting Dashboard ทั้งหน้าในกรอบ · ส่งตั๋วผู้บริหารให้ทาง postMessage (ไม่ต้องใส่รหัสซ้ำ)
  var EMBED_ORIGIN = 'https://em-o-cha.github.io';
  function embed(d) {
    $('xOut').innerHTML = '<div class="xhead" style="--c:' + d.color + '"><span class="xi">' + icon(d.key, 20) + '</span><b>' + esc(d.name) + '</b><span>' + esc(d.en) + '</span></div>'
      + '<div class="xframe"><iframe id="xFrame" title="Meeting Dashboard" src="' + esc(d.embed) + '"></iframe></div>';
  }
  window.addEventListener('message', function (ev) {
    var f = $('xFrame');
    if (!f || ev.source !== f.contentWindow || ev.origin !== EMBED_ORIGIN || !ev.data) return;
    if (ev.data.type === 'meeting-ready' && state.token) f.contentWindow.postMessage({ type: 'exec-token', token: state.token }, EMBED_ORIGIN);
    if (ev.data.type === 'meeting-height') f.style.height = Math.max(600, Number(ev.data.h) || 0) + 'px';
  });

  function box(title, rows, empty) { return '<div class="panel pbox"><h4>' + title + '</h4>' + (rows.length ? rows.join('') : '<div class="muted">' + empty + '</div>') + '</div>'; }

  // กราฟแท่งคู่ รับเข้า/จ่ายออก (รวมเป็นรายเดือนเมื่อช่วงยาวกว่า 62 วัน) · ชี้/แตะแท่งเพื่อดูตัวเลข
  function barChart(r) {
    var rows = [], i, map = {};
    var monthly = r.days.length > 62 || (new Date(r.to) - new Date(r.from)) / 864e5 > 62;
    if (monthly) {
      r.days.forEach(function (x) { var m = x.date.slice(0, 7); (map[m] = map[m] || { label: m, inN: 0, outN: 0 }); map[m].inN += x.inN; map[m].outN += x.outN; });
      for (var c = r.from.slice(0, 7); c <= r.to.slice(0, 7); c = shift(c + '-01', 32).slice(0, 7)) rows.push(map[c] || { label: c, inN: 0, outN: 0 });
      rows.forEach(function (x) { x.tip = TH_M[+x.label.slice(5) - 1] + ' ' + x.label.slice(0, 4); x.short = TH_M[+x.label.slice(5) - 1]; });
    } else {
      r.days.forEach(function (x) { map[x.date] = x; });
      for (var dt = r.from; dt <= r.to; dt = shift(dt, 1)) { var x = map[dt] || { date: dt, inN: 0, outN: 0 }; rows.push({ label: dt, inN: x.inN, outN: x.outN, tip: dd(dt), short: String(+dt.slice(8)) }); }
    }
    if (!rows.length) return '<div class="muted">ไม่มีข้อมูล</div>';
    var max = Math.max.apply(null, rows.map(function (x) { return Math.max(x.inN, x.outN); }).concat([1]));
    var W = 760, H = 220, padL = 34, padB = 26, padT = 8, cw = (W - padL) / rows.length, bw = Math.max(2, Math.min(18, cw / 2 - 2));
    var step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step, ticks = [0, nice / 2, nice];
    var y = function (v) { return H - padB - (v / nice) * (H - padB - padT); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xsvg" role="img" aria-label="กราฟรับเข้าและจ่ายออก">';
    ticks.forEach(function (t) { svg += '<line x1="' + padL + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="#e2e8f0"/><text x="' + (padL - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end" class="xax">' + n3(t) + '</text>'; });
    var every = Math.ceil(rows.length / 16);
    rows.forEach(function (x, i2) {
      var cx = padL + cw * i2 + cw / 2;
      var bar = function (v, dx, col, name) {
        if (!v) return '';
        var top = y(v), h = H - padB - top, r2 = Math.min(4, bw / 2, h);
        return '<path d="M' + (cx + dx) + ',' + (H - padB) + 'v' + (-(h - r2)) + 'q0,' + (-r2) + ' ' + r2 + ',' + (-r2) + 'h' + (bw - 2 * r2) + 'q' + r2 + ',0 ' + r2 + ',' + r2 + 'v' + (h - r2) + 'z" fill="' + col + '"/>';
      };
      svg += '<g class="xcol"><rect x="' + (cx - cw / 2) + '" y="' + padT + '" width="' + cw + '" height="' + (H - padB - padT) + '" fill="transparent"/>'
        + bar(x.inN, -bw - 1, IN_C) + bar(x.outN, 1, OUT_C)
        + '<title>' + x.tip + '\nรับเข้า ' + x.inN + ' รายการ\nจ่ายออก ' + x.outN + ' รายการ</title></g>';
      if (i2 % every === 0) svg += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" class="xax">' + x.short + '</text>';
    });
    return svg + '</svg>';
  }

  var css = document.createElement('style');
  css.textContent = [
    '.xfilter{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}.xdepts{display:flex;flex-wrap:wrap;gap:8px}',
    '.xdept{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:7px 12px;font-size:14px;color:var(--ink)}.xdept small{font-size:11px;color:var(--muted);margin-left:2px}',
    '.xdept .xi{color:var(--dc);display:inline-grid}.xdept .xi svg{width:18px;height:18px}.xdept.on{border-color:var(--dc);background:color-mix(in srgb,var(--dc) 12%,white);font-weight:600}',
    '.xdates{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.xdates label{display:flex;flex-direction:column;font-size:12.5px;color:var(--muted);margin:0;gap:3px}.xdates input{padding:7px 10px;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:14px}.xdates .pchips{margin:0}',
    '.xhead{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.92);border-radius:12px;padding:10px 14px;margin-bottom:10px;box-shadow:var(--shadow)}.xhead .xi{color:var(--c);display:inline-grid}.xhead b{font-size:16px}.xhead span:last-child{margin-left:auto;color:var(--muted);font-size:13px}',
    '.kpis.xk{grid-template-columns:repeat(4,1fr)}.kpi small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}',
    '.xchart{margin-bottom:14px}.xch{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.xleg{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)}.xleg i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-left:8px}',
    '.xsvg{width:100%;height:auto;display:block}.xax{font-size:11px;fill:#64748b}.xcol:hover rect{fill:rgba(15,23,42,.05)}',
    '.xbar{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr auto;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line);font-size:13.5px}.xn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xtrack{height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden}.xtrack span{display:block;height:100%;background:' + OUT_C + ';border-radius:99px}.xv{text-align:right;font-weight:600;white-space:nowrap}.xv small{display:block;font-weight:400;color:var(--muted);font-size:11px}',
    '.xframe{background:#fff;border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}.xframe iframe{display:block;width:100%;height:900px;border:0}',
    '@media (max-width:860px){.kpis.xk{grid-template-columns:repeat(2,1fr)}}'
  ].join('\n');
  document.head.appendChild(css);
})();
