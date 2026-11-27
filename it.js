// ==================== ฝ่าย IT (ระบบจัดการองค์กร) — ผู้ใช้ขอ 27/11/69 ====================
// ① หน้าแอดมิน Members LINE (เปิดในกรอบ) ② แก้ข้อมูล Master Data Sales ในชีตเดิม (API itMasterLoad / itMasterSave, It.gs)
// ③ ลิงก์ Stripe Dashboard (เปิดแท็บใหม่ — Stripe ไม่ยอมให้ฝังในหน้าอื่น) · ลิงก์ / ไอดีมาจาก API เท่านั้น (repo สาธารณะ)
(function () {
  var I = window.ITM = { info: null, cur: null };
  Object.assign(ICONS, {
    people2: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tag: '<path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
  });
  var TABLES = {
    it_sku: ['sku', 'สินค้า (SKU) · คอลัมน์ H–M', 'tag'], it_bulk: ['bulk', 'ราคาส่ง (SKU Bulk)', 'tag'],
    it_pay: ['pay', 'ช่องทางชำระเงิน (Payment)', 'card'], it_staff: ['staff', 'พนักงานขาย (Sales Name)', 'people2'], it_camp: ['camp', 'แคมเปญ (Campaign)', 'list'],
    it_ad: ['ad', 'ช่องทางโฆษณา (AD)', 'list'], it_cust: ['cust', 'ประเภทลูกค้า (Customer)', 'people2'], it_target: ['target', 'เป้าหมายรายเดือน (Target)', 'target']
  };
  I.menus = function () {
    var m = [{ section: '👥 ระบบสมาชิก', tone: 'it' }, { id: 'it_mem', label: 'จัดการสมาชิก (Members LINE)', ic: 'people2' },
      { section: '🗂 Master Data Sales', tone: 'it' }];
    Object.keys(TABLES).forEach(function (k) { m.push({ id: k, label: TABLES[k][1], ic: TABLES[k][2] }); });
    m.push({ section: '💳 ชำระเงิน', tone: 'it' }, { link: 'https://dashboard.stripe.com/', label: 'Stripe Dashboard (บัตรเครดิต)', ic: 'card' });
    return m;
  };
  I.reset = function () { I.cur = null; };
  I.exportFile = function () { return null; };
  function dirtyGuard() { return I.cur && I.cur.dirty; }
  I.render = function (page) {
    if (dirtyGuard() && I.cur.page !== page) {
      var back = I.cur.page;
      ask({ title: 'ยังไม่ได้บันทึก', text: 'ตาราง "' + TABLES[back][1] + '" ยังไม่ได้บันทึก จะออกโดยไม่บันทึกหรือไม่?', ok: 'ออกโดยไม่บันทึก', cancel: 'กลับไปบันทึก', tone: 'danger' }).then(function (ok) {
        if (ok) { I.cur = null; I.render(page); } else { state.page = back; renderNav(); }
      });
      return;
    }
    if (page === 'it_mem') return members();
    I.cur = null;
    if (TABLES[page]) return table(page);
    members();
  };
  // ---------- หน้าแอดมิน Members LINE ในกรอบ ----------
  function members() {
    $('main').innerHTML = '<div id="itWrap" class="itbox"><div class="slwait" id="itWait"><span class="spinner dark"></span><div><b>กำลังเปิดระบบจัดการสมาชิก…</b><span>ครั้งแรกอาจใช้เวลา 5–10 วินาที</span></div></div></div>';
    var go_ = function () {
      if (!$('itWrap')) return;
      var f = document.createElement('iframe');
      f.title = 'จัดการสมาชิก'; f.src = I.info.membersUrl + (I.info.membersUrl.indexOf('?') < 0 ? '?' : '&') + 'embed=it'; f.setAttribute('allow', 'clipboard-write; camera');
      f.onload = function () { var w = $('itWait'); if (w) w.classList.add('hidden'); };
      $('itWrap').appendChild(f);
    };
    if (I.info) return go_();
    call('itInfo', state.token).then(function (r) { if (!r || !r.ok || !r.membersUrl) throw new Error('ยังไม่ได้ตั้งลิงก์ระบบสมาชิก'); I.info = r; go_(); })
      .catch(function (e) { if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e); $('main').innerHTML = '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>เปิดระบบสมาชิกไม่ได้</b><span>' + esc(e.message) + '</span></div></div>'; });
  }
  // ---------- ตารางแก้ไข Master Data ----------
  function table(page) {
    var key = TABLES[page][0];
    $('main').innerHTML = '<h3>' + esc(TABLES[page][1]) + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูลจาก Master Data Sales…</div>';
    call('itMasterLoad', state.token, key).then(function (r) {
      if (state.page !== page) return;
      if (!r.ok) throw new Error(r.error || 'โหลดไม่สำเร็จ');
      I.cur = { page: page, key: key, d: r, rows: r.rows.map(function (v, i) { return { from: i, v: v.slice() }; }), dirty: false, q: '' };
      draw();
    }).catch(function (e) {
      if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
      $('main').innerHTML = '<h3>' + esc(TABLES[page][1]) + '</h3><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>เปิดข้อมูลไม่ได้</b><span>' + esc(e.message) + '</span></div></div>';
    });
  }
  function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function draw() {
    var c = I.cur, d = c.d, q = c.q.trim().toLowerCase();
    var head = '<tr><th class="itn">#</th>' + d.cols.map(function (col, j) { return '<th>' + esc(col.label) + '<small>' + colLetter(d.col0 + j) + (col.type === 'ro' ? ' · อ่านอย่างเดียว' : '') + '</small></th>'; }).join('') + '<th class="itact"></th></tr>';
    var body = c.rows.map(function (r, i) {
      if (q && !r.v.join(' ').toLowerCase().includes(q)) return '';
      return '<tr data-i="' + i + '"' + (r.from < 0 ? ' class="itnew"' : '') + '><td class="itn">' + (i + 1) + '</td>' + d.cols.map(function (col, j) {
        var v = r.v[j] == null ? '' : String(r.v[j]);
        if (col.type === 'ro') return '<td class="itro" title="' + esc(v) + '">' + esc(/^=/.test(v) ? 'คำนวณอัตโนมัติ' : v) + '</td>';
        return '<td><input data-j="' + j + '" value="' + esc(v) + '"' + (col.type === 'num' ? ' inputmode="decimal" class="itnum"' : '') + ' aria-label="' + esc(col.label) + ' แถว ' + (i + 1) + '">'
          + (col.type === 'url' && /^https?:/.test(v) ? '<a class="itopen" href="' + esc(v) + '" target="_blank" rel="noopener" title="เปิดลิงก์">↗</a>' : '') + '</td>';
      }).join('') + '<td class="itact"><button type="button" class="itbtn" data-up="' + i + '" title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น">↑</button><button type="button" class="itbtn" data-dn="' + i + '" title="เลื่อนลง" aria-label="เลื่อนลง">↓</button><button type="button" class="itbtn del" data-del="' + i + '" title="ลบแถว" aria-label="ลบแถว">' + icon('trash', 15) + '</button></td></tr>';
    }).join('');
    var y = window.scrollY;
    $('main').innerHTML = '<h3>' + esc(TABLES[c.page][1]) + '</h3>'
      + '<div class="itbar"><input id="itQ" type="search" placeholder="ค้นหาในตาราง…" value="' + esc(c.q) + '"><button class="btn btn-sm" id="itAdd">' + icon('plus', 16) + ' เพิ่มแถว</button>'
      + '<button class="btn btn-sm" id="itReload">↻ โหลดใหม่</button><a class="btn btn-sm" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + icon('sheet', 16) + ' เปิดในชีต</a>'
      + '<span class="itstat">' + c.rows.length + ' แถว · แท็บ "' + esc(d.tab) + '"</span></div>'
      + (c.key === 'sku' ? '<div class="itnote">ใช้เฉพาะคอลัมน์ H–M · คอลัมน์ A–F และตารางขนาดกล่องด้านขวาไม่ถูกแตะ · "สต๊อกคงเหลือ" ระบบ Stock Flow เขียนให้เอง</div>' : '')
      + '<div class="itscroll"><table class="ittab' + (/^(pay|staff|camp|ad|cust)$/.test(c.key) ? ' itleft' : '') + '"><thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="' + (d.cols.length + 2) + '" class="itempty">ไม่มีข้อมูล</td></tr>') + '</tbody></table></div>'
      + '<div class="itsave' + (c.dirty ? ' on' : '') + '"><span>' + (c.dirty ? '● มีการแก้ไขที่ยังไม่บันทึก' : '✓ ข้อมูลตรงกับชีตแล้ว') + '</span><button class="btn btn-primary" id="itSave"' + (c.dirty ? '' : ' disabled') + '>บันทึกลงชีต Master Data</button></div>';
    window.scrollTo(0, y);
    var mark = function () { if (!c.dirty) { c.dirty = true; var b = document.querySelector('.itsave'); if (b) { b.classList.add('on'); b.querySelector('span').textContent = '● มีการแก้ไขที่ยังไม่บันทึก'; $('itSave').disabled = false; } } };
    Array.prototype.forEach.call(document.querySelectorAll('.ittab input[data-j]'), function (el) {
      el.addEventListener('input', function () { var i = +el.closest('tr').getAttribute('data-i'); c.rows[i].v[+el.getAttribute('data-j')] = el.value; mark(); });
    });
    $('itQ').addEventListener('input', function () { c.q = $('itQ').value; clearTimeout(I.qt); I.qt = setTimeout(function () { draw(); var e = $('itQ'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('itAdd').addEventListener('click', function () { c.q = ''; c.rows.push({ from: -1, v: d.cols.map(function () { return ''; }) }); c.dirty = true; draw(); var ins = document.querySelectorAll('.ittab tbody tr:last-child input'); if (ins[0]) { ins[0].focus(); ins[0].scrollIntoView({ block: 'center' }); } });
    $('itReload').addEventListener('click', function () {
      var go = function () { I.cur = null; table(c.page); };
      if (!c.dirty) return go();
      ask({ title: 'โหลดใหม่?', text: 'การแก้ไขที่ยังไม่บันทึกจะหายไป', ok: 'โหลดใหม่', tone: 'danger' }).then(function (ok) { if (ok) go(); });
    });
    on('[data-up]', function (i) { if (i > 0) { var t = c.rows[i]; c.rows[i] = c.rows[i - 1]; c.rows[i - 1] = t; c.dirty = true; draw(); } });
    on('[data-dn]', function (i) { if (i < c.rows.length - 1) { var t = c.rows[i]; c.rows[i] = c.rows[i + 1]; c.rows[i + 1] = t; c.dirty = true; draw(); } });
    on('[data-del]', function (i) {
      var name = c.rows[i].v.filter(function (x, j) { return d.cols[j].type !== 'ro' && String(x || '').trim(); }).slice(0, 2).join(' · ') || 'แถวว่าง';
      ask({ title: 'ลบแถวนี้?', text: name + '\nจะหายจากชีตเมื่อกด "บันทึก"', ok: 'ลบแถว', tone: 'danger' }).then(function (ok) { if (ok) { c.rows.splice(i, 1); c.dirty = true; draw(); } });
    });
    $('itSave').addEventListener('click', save);
  }
  function on(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (b) { b.addEventListener('click', function () { fn(+b.getAttribute(sel.slice(1, -1))); }); }); }
  function save() {
    var c = I.cur, d = c.d, btn = $('itSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    var rows = c.rows.map(function (r) { return { from: r.from, v: r.v.filter(function (x, j) { return d.cols[j].type !== 'ro'; }) }; });
    call('itMasterSave', state.token, c.key, rows, d.sig).then(function (r) {
      if (!r.ok) { btn.disabled = false; btn.textContent = 'บันทึกลงชีต Master Data'; return ask({ title: 'บันทึกไม่ได้', text: r.error, ok: 'ตกลง', tone: 'warn' }); }
      d.rows = r.rows; d.sig = r.sig;
      I.cur = { page: c.page, key: c.key, d: d, rows: r.rows.map(function (v, i) { return { from: i, v: v.slice() }; }), dirty: false, q: c.q };
      draw(); toast('บันทึกลงชีตแล้ว ' + r.saved + ' แถว — ระบบอื่นจะเห็นข้อมูลใหม่ภายในไม่กี่นาที');
    }).catch(function (e) { btn.disabled = false; btn.textContent = 'บันทึกลงชีต Master Data'; onServerError(e); });
  }
  window.addEventListener('beforeunload', function (e) { if (dirtyGuard()) { e.preventDefault(); e.returnValue = ''; } });
  var css = document.createElement('style');
  css.textContent = '.main:has(#itWrap){padding:12px 14px}.itbox{position:relative;background:#fff;border-radius:14px;overflow:hidden;box-shadow:var(--shadow);height:calc(100vh - 100px);min-height:560px}.itbox iframe{display:block;width:100%;height:100%;border:0}'
    + '.itbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.itbar input[type=search]{flex:1 1 220px;min-width:0;padding:9px 12px;border:1px solid var(--line);border-radius:10px;font:inherit}.itstat{color:#64748b;font-size:13px;margin-left:auto}'
    + '.itnote{background:#eef2f8;border-left:4px solid #173B68;border-radius:8px;padding:8px 12px;font-size:13px;color:#173B68;margin-bottom:10px}'
    + '.itscroll{overflow:auto;max-height:calc(100vh - 250px);background:#fff;border-radius:12px;box-shadow:var(--shadow)}'
    + '.ittab{border-collapse:separate;border-spacing:0;width:100%;font-size:14px}.ittab th{position:sticky;top:0;z-index:1;background:#173B68;color:#fff;text-align:left;padding:8px 8px;font-weight:700;white-space:nowrap}.ittab th small{display:block;font-weight:400;opacity:.75;font-size:11px}'
    + '.ittab td{border-bottom:1px solid #eef2f7;padding:4px 6px;vertical-align:middle;position:relative}.ittab tr.itnew td{background:#f0fdf4}.ittab input{width:100%;min-width:120px;padding:7px 8px;border:1px solid transparent;border-radius:8px;font:inherit;background:transparent}.ittab input:hover{border-color:#e2e8f0}.ittab input:focus{outline:none;border-color:#173B68;background:#fff;box-shadow:0 0 0 3px rgba(23,59,104,.15)}.ittab input.itnum{min-width:80px;text-align:right}'
    + '.itn{width:36px;color:#94a3b8;text-align:right;font-size:12px}.itro{color:#64748b;background:#f8fafc;font-size:13px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.itopen{position:absolute;right:10px;top:50%;transform:translateY(-50%);text-decoration:none;color:#173B68;font-weight:700}'
    + '.itact{white-space:nowrap;width:1%}.itbtn{border:1px solid #e2e8f0;background:#fff;border-radius:8px;width:30px;height:30px;margin-left:3px;cursor:pointer;color:#475569;display:inline-grid;place-items:center}.itbtn:hover{border-color:#173B68;color:#173B68}.itbtn.del:hover{border-color:#dc2626;color:#dc2626}.itempty{text-align:center;color:#94a3b8;padding:24px}'
    + '.itsave{position:sticky;bottom:0;display:flex;align-items:center;gap:12px;justify-content:space-between;background:#fff;border-radius:12px;padding:10px 14px;margin-top:10px;box-shadow:0 -2px 12px rgba(15,23,42,.08);color:#16a34a;font-weight:600}.itsave.on{color:#b45309;background:#fffbeb}.itsave .btn{flex:none;min-width:240px}.ittab td:nth-child(2) input{min-width:220px}.ittab td:has(.itopen) input{padding-right:26px}'
    + '.ittab th,.ittab td,.ittab input,.ittab input.itnum,.itn,.itro{text-align:center}.ittab td:has(.itopen) input{padding-left:26px}'
    + '.itleft th,.itleft td,.itleft input{text-align:left}.itleft .itn{text-align:right}'   // Payment / Sales Name / Campaign / AD / Customer ชิดซ้ายเหมือนเดิม   // จัดกึ่งกลางทุกตาราง (ผู้ใช้ขอ 27/11/69)
    + '@media (max-width:700px){.itstat{margin-left:0;width:100%}.itsave{flex-direction:column;align-items:stretch}}';
  document.head.appendChild(css);
})();
