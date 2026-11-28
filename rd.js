// ==================== วิจัยและพัฒนา (RD) ====================
// หน้าเว็บของโมดูล "rd" — index.html เรียก RDM.menus() / RDM.render(page) · ข้อมูลผ่าน API Rd.gs (rdLoad, rdSaveProduct, ...)
// ผลิตภัณฑ์ใหม่ (ช่วงพัฒนา วันที่เริ่ม → วันที่สิ้นสุด) · คู่ค้า (ในประเทศ / ต่างประเทศ + สินค้าที่ส่งขาย) · ต้นทุนสินค้า (รอวิธีคำนวณ)
(function () {
  var H = window.RDM = { data: null, loading: null, q: {} };
  Object.assign(ICONS, {
    flask: '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7 15h10"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.7 0-3 .9-3 2s1.3 1.8 3 2 3 .9 3 2-1.3 2-3 2c-1.1 0-2.1-.5-2.5-1.5"/><path d="M12 6.5V8M12 16v1.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>'
  });
  var MENUS = [
    { id: 'r_np', label: 'ผลิตภัณฑ์ใหม่', ic: 'flask' },
    { id: 'r_partner', label: 'คู่ค้า', ic: 'users' },
    { id: 'r_dash', label: 'ภาพรวม / Dashboard', ic: 'chart' },
    { id: 'r_set', label: 'ตั้งค่า', ic: 'gear' },
    { id: 'r_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var MKT = { dom: 'ในประเทศ', exp: 'ต่างประเทศ' }, MKTC = { dom: '#0891b2', exp: '#7c3aed' };
  var ST = { dev: 'กำลังพัฒนา', done: 'พัฒนาเสร็จ', launched: 'วางจำหน่ายแล้ว', hold: 'พักไว้', cancel: 'ยกเลิก' };
  var SENS = [['look', 'ลักษณะปรากฏ'], ['color', 'สี'], ['smell', 'กลิ่น'], ['taste', 'รส'], ['texture', 'เนื้อสัมผัส']];
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(2) : esc(iso); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function days(a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 864e5); }
  function list(s) { return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function S_() { return H.data.settings; }
  function wide(cfg) { cfg.wide = true; cfg.color = cfg.color || state.dept.color; openModal(cfg); }
  function upsert(a, o) { var i = a.map(function (x) { return x.id; }).indexOf(o.id); if (i >= 0) a[i] = o; else a.push(o); }
  function stTag(p) {
    var cls = p.overdue ? 'late' : p.status;
    return '<span class="rst ' + cls + '">' + (p.overdue ? 'เลยกำหนด ' + days(p.endDate, H.data.today) + ' วัน' : ST[p.status] || p.status) + '</span>';
  }
  function mktTag(m) { return '<span class="rmk" style="--m:' + (MKTC[m] || '#64748b') + '">' + (MKT[m] || m || '-') + '</span>'; }
  // แถบเวลา: ผ่านไปกี่ % ของช่วงพัฒนา
  function timeBar(p) {
    var t = H.data.today, tot = Math.max(1, days(p.startDate, p.endDate)), end = p.doneDate || t;
    var used = Math.max(0, days(p.startDate, end < p.startDate ? p.startDate : end)), pct = Math.min(100, Math.round(used / tot * 100));
    var done = p.status === 'done' || p.status === 'launched', late = p.overdue || (done && p.doneDate > p.endDate);
    var txt = done ? 'เสร็จ ' + dd(p.doneDate) + (p.doneDate > p.endDate ? ' (ช้า ' + days(p.endDate, p.doneDate) + ' วัน)' : ' (ทันกำหนด)')
      : p.status === 'dev' ? (t < p.startDate ? 'เริ่ม ' + dd(p.startDate) : p.overdue ? 'เลยกำหนดมา ' + days(p.endDate, t) + ' วัน' : 'เหลือ ' + days(t, p.endDate) + ' วัน') : ST[p.status];
    return '<div class="rbar"><div class="rbt"><span>' + dd(p.startDate) + ' → ' + dd(p.endDate) + '</span><b class="' + (late ? 'neg' : done ? 'pos' : '') + '">' + txt + '</b></div>'
      + '<i><em style="width:' + (done ? 100 : pct) + '%;background:' + (late ? '#dc2626' : done ? '#16a34a' : '#111827') + '"></em></i></div>';
  }

  // ---------- โหลด ----------
  H.load = function () {
    if (H.loading) return H.loading;
    H.loading = call('rdLoad', state.token).then(function (d) { H.data = d; H.loading = null; return d; }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  H.reset = function () { H.data = null; H.q = {}; };
  H.menus = function () { return MENUS; };
  H.render = function (page) {
    if (H.data && H.data._cost) H.data = null;   // ข้อมูลชุดของการ์ดต้นทุนสินค้า (ไม่มีคู่ค้า / การทดลอง) → โหลดของ RD ใหม่
    if (!H.data) {
      $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">กำลังโหลดข้อมูลจาก Google Sheet…</p><div class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
      H.load().then(function () { if (state.page === page) H.render(page); }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>' + esc(state.dept.name) + '</h3><p class="lead">เปิดข้อมูลไม่ได้</p><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>' + esc(e.message) + '</b><span>ให้ผู้ดูแลระบบตั้งลิงก์ Google Sheet และโฟลเดอร์ของฝ่าย แล้วแชร์ให้บัญชีของระบบเป็นผู้แก้ไข</span></div></div>';
      });
      return;
    }
    ({ r_np: npPage, r_partner: partnerPage, r_cost: costPage, r_dash: dash, r_set: settings, r_log: logPage }[page] || npPage)();
  };

  // ==================== ผลิตภัณฑ์ใหม่ ====================
  function npPage() {
    var q = H.q, all = H.data.products, cats = list(S_().categories);
    if (q.npId) { var cur = all.filter(function (x) { return x.id === q.npId; })[0]; if (cur) return q.print ? printTrial(cur, q.print) : npDetail(cur); q.npId = ''; }
    q.nst = q.nst || 'dev';
    var match = function (p, st) {
      if (st === 'dev' && p.status !== 'dev') return false;
      if (st === 'late' && !p.overdue) return false;
      if (st === 'fin' && p.status !== 'done' && p.status !== 'launched') return false;
      if (st === 'other' && p.status !== 'hold' && p.status !== 'cancel') return false;
      return true;
    };
    var s = String(q.ns || '').toLowerCase();
    var rows = all.filter(function (p) {
      if (!match(p, q.nst)) return false;
      if (q.ncat && p.category !== q.ncat) return false;
      if (q.nmkt && p.market !== q.nmkt) return false;
      return !s || [p.code, p.name, p.category, p.owner, p.note].concat(p.partners).join(' ').toLowerCase().indexOf(s) >= 0;
    }).sort(function (a, b) { return a.status === 'dev' && b.status === 'dev' ? String(a.endDate).localeCompare(String(b.endDate)) : String(b.startDate).localeCompare(String(a.startDate)); });
    var chips = [['dev', 'กำลังพัฒนา'], ['late', 'เลยกำหนด'], ['fin', 'เสร็จ / วางจำหน่าย'], ['other', 'พักไว้ / ยกเลิก'], ['all', 'ทั้งหมด']];
    $('main').innerHTML = '<h3>ผลิตภัณฑ์ใหม่</h3><p class="lead">ช่วงพัฒนาสินค้าแต่ละตัว (วันที่เริ่ม → วันที่สิ้นสุด) · ประเภท · ตลาดในประเทศ / ต่างประเทศ · คู่ค้าที่จะส่งขาย</p>'
      + '<div class="rtool"><button class="btn btn-primary" id="nAdd">' + icon('plus', 18) + ' เพิ่มผลิตภัณฑ์ใหม่</button></div>'
      + '<div class="pchips rchips">' + chips.map(function (c) { return '<button class="chip' + (q.nst === c[0] ? ' on' : '') + (c[0] === 'late' ? ' rlate' : '') + '" data-nst="' + c[0] + '">' + c[1] + ' (' + all.filter(function (p) { return match(p, c[0]); }).length + ')</button>'; }).join('') + '</div>'
      + '<div class="pbar rbar"><div class="psearch">' + icon('search', 18) + '<input id="nS" type="search" placeholder="ค้นหา ชื่อ / เลขที่ / คู่ค้า" value="' + esc(q.ns || '') + '"></div>'
      + '<select id="nCat"><option value="">ทุกประเภท</option>' + cats.map(function (c) { return '<option' + (q.ncat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>'
      + '<select id="nMkt"><option value="">ทุกตลาด</option>' + Object.keys(MKT).map(function (k) { return '<option value="' + k + '"' + (q.nmkt === k ? ' selected' : '') + '>' + MKT[k] + '</option>'; }).join('') + '</select></div>'
      + '<div class="rcards">' + (rows.map(function (p) {
        return '<button class="rcard" data-np="' + esc(p.id) + '"><div class="rch"><span class="rcode">' + esc(p.code) + '</span>' + stTag(p) + '</div>'
          + '<b class="rname">' + esc(p.name) + '</b><div class="rtags">' + (p.category ? '<span class="rcat">' + esc(p.category) + '</span>' : '') + mktTag(p.market) + (p.owner ? '<span class="rown">👤 ' + esc(p.owner) + '</span>' : '') + '</div>'
          + timeBar(p)
          + (p.partners.length ? '<div class="rpt">' + icon('users', 14) + ' ' + p.partners.map(esc).join(', ') + '</div>' : '')
          + (function () { var tr = trialsOf(p.id), last = tr[tr.length - 1]; return tr.length ? '<div class="rtr">🧪 ทดลอง ' + tr.length + ' ครั้ง · ล่าสุด ' + dd(last.date) + (last.result ? ' · <b class="' + (last.result === 'pass' ? 'pos' : 'neg') + '">' + (last.result === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน') + '</b>' : '') + '</div>' : ''; })() + '</button>';
      }).join('') || '<div class="panel muted">ไม่มีรายการ' + (all.length ? '' : ' — กด "เพิ่มผลิตภัณฑ์ใหม่" เพื่อเริ่ม') + '</div>') + '</div>';
    on('[data-nst]', 'click', function (el) { q.nst = el.getAttribute('data-nst'); npPage(); }, $('main'));
    $('nS').addEventListener('input', function () { q.ns = this.value; clearTimeout(H.t); H.t = setTimeout(function () { npPage(); var e = $('nS'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('nCat').addEventListener('change', function () { q.ncat = this.value; npPage(); });
    $('nMkt').addEventListener('change', function () { q.nmkt = this.value; npPage(); });
    $('nAdd').addEventListener('click', function () { npForm(null); });
    on('[data-np]', 'click', function (el) { q.npId = el.getAttribute('data-np'); q.print = ''; window.scrollTo(0, 0); npPage(); }, $('main'));
  }
  function trialsOf(pid) { return H.data.trials.filter(function (t) { return t.productId === pid; }).sort(function (a, b) { return a.round - b.round; }); }
  function pct(v, tot) { return v === '' || v == null || !tot ? '' : Math.round(v / tot * 10000) / 100; }
  function nf(v, d) { return v === '' || v == null || isNaN(v) ? '' : Number(v).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 2 : d }); }
  function sumOf(ing, k) { return ing.reduce(function (t, x) { return t + (Number(x[k]) || 0); }, 0); }
  function sensAvg(t) { var v = SENS.map(function (k) { return Number((t.sensory || {})[k[0]]) || 0; }).filter(Boolean); return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10 : ''; }
  // ---- หน้ารายละเอียดผลิตภัณฑ์ + การทดลองแต่ละครั้ง
  function npDetail(p) {
    var q = H.q, tr = trialsOf(p.id);
    $('main').innerHTML = '<div class="rdh noprint"><button class="btn btn-line btn-sm" id="dBack">' + icon('back', 16) + ' ผลิตภัณฑ์ใหม่ทั้งหมด</button></div>'
      + '<div class="panel pbox rdetail"><div class="rch"><span class="rcode">' + esc(p.code) + '</span>' + stTag(p) + '</div><h3 style="margin:4px 0 6px">' + esc(p.name) + '</h3>'
      + '<div class="rtags">' + (p.category ? '<span class="rcat">' + esc(p.category) + '</span>' : '') + mktTag(p.market) + (p.owner ? '<span class="rown">👤 ' + esc(p.owner) + '</span>' : '') + '</div>'
      + timeBar(p) + (p.partners.length ? '<div class="rpt">' + icon('users', 14) + ' คู่ค้า: ' + p.partners.map(esc).join(', ') + '</div>' : '')
      + (p.note ? '<div class="rnote">' + esc(p.note) + '</div>' : '')
      + '<div style="margin-top:10px"><button class="btn btn-line btn-sm" id="dEdit">' + icon('edit', 16) + ' แก้ไขข้อมูลผลิตภัณฑ์</button></div></div>'
      + '<div class="rtrh"><h4>🧪 แบบรายงานการทดลอง (FM-RD-01-01) <small>' + tr.length + ' ครั้ง</small></h4><button class="btn btn-primary btn-sm" id="tNew">' + icon('plus', 16) + ' บันทึกการทดลองครั้งที่ ' + ((tr.length ? tr[tr.length - 1].round : 0) + 1) + '</button></div>'
      + (tr.length ? tr.slice().reverse().map(function (t) {
        var tot = sumOf(t.ingredients, 'rd'), totB = sumOf(t.ingredients, 'batch'), av = sensAvg(t), ph = t.photos || [];
        return '<div class="panel rtrial"><div class="rtrt"><b>ครั้งที่ ' + t.round + '</b><span>' + dd(t.date) + '</span>' + (t.result ? '<span class="rres ' + t.result + '">' + (t.result === 'pass' ? '✓ ผ่าน' : '✗ ไม่ผ่าน') + '</span>' : '<span class="rres">รอผลประเมิน</span>') + '</div>'
          + '<div class="rtrm">' + [t.ingredients.length ? 'ส่วนผสม ' + t.ingredients.length + ' รายการ · R&D ' + nf(tot) + ' ' + esc(t.unit) + (totB ? ' · 1st Batch ' + nf(totB) + ' ' + esc(t.unit) : '') : '', av !== '' ? 'คะแนนเฉลี่ย ' + av + '/5' : '', t.trialBy ? 'ผู้ทดลอง ' + esc(t.trialBy) : ''].filter(String).join(' · ') + '</div>'
          + (t.comment ? '<div class="rnote">' + esc(t.comment) + '</div>' : '')
          + '<div class="rph">' + ph.map(function (f, i) { return '<span><a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(f.url) + '=w240" alt="" loading="lazy"></a>' + (i === 0 ? '<em>ภาพสินค้า</em>' : '') + '<button type="button" data-tpdel="' + esc(t.id) + '|' + esc(f.id) + '" aria-label="ลบรูป">' + icon('x', 13) + '</button></span>'; }).join('')
          + (H.data.hasFolder ? '<label class="radd">' + icon('camera', 20) + '<span>เพิ่มรูป</span><input type="file" accept="image/*" multiple data-tpadd="' + esc(t.id) + '" hidden></label>' : '') + '</div>'
          + '<div class="rtrb"><button class="btn btn-line btn-sm" data-topen="' + esc(t.id) + '">' + icon('edit', 15) + ' เปิด / แก้ไข</button><button class="btn btn-line btn-sm" data-tprint="' + esc(t.id) + '">' + icon('print', 15) + ' แบบรายงาน (พิมพ์)</button></div></div>';
      }).join('') : '<div class="panel muted">ยังไม่มีการทดลอง — กด "บันทึกการทดลองครั้งที่ 1"</div>');
    $('dBack').addEventListener('click', function () { q.npId = ''; npPage(); });
    $('dEdit').addEventListener('click', function () { npForm(p); });
    $('tNew').addEventListener('click', function () { trialForm(p, null); });
    on('[data-topen]', 'click', function (el) { trialForm(p, tr.filter(function (t) { return t.id === el.getAttribute('data-topen'); })[0]); }, $('main'));
    on('[data-tprint]', 'click', function (el) { q.print = el.getAttribute('data-tprint'); window.scrollTo(0, 0); npPage(); }, $('main'));
    on('[data-tpdel]', 'click', function (el) {
      var a = el.getAttribute('data-tpdel').split('|');
      ask({ title: 'ลบรูปนี้?', ok: 'ลบ', tone: 'danger' }).then(function (ok) {
        if (!ok) return;
        call('rdRemoveTrialPhoto', state.token, a[0], a[1]).then(function (r) { if (!r.ok) return toast(r.error); setTrial(a[0], { photos: r.photos }); npDetail(p); }).catch(onServerError);
      });
    }, $('main'));
    on('[data-tpadd]', 'change', function (el) {
      var id = el.getAttribute('data-tpadd'), files = Array.prototype.slice.call(el.files || []), i = 0, fails = 0;
      var next = function () {
        if (i >= files.length) { toast(fails ? 'อัปโหลดไม่สำเร็จ ' + fails + ' รูป' : 'แนบรูปแล้ว'); return npDetail(p); }
        var f = files[i++]; toast('กำลังอัปโหลดรูป ' + i + '/' + files.length + '…');
        shrink(f).then(function (x) {
          if (!x) { fails++; return next(); }
          return call('rdUploadTrialPhoto', state.token, id, x.name, 'image/jpeg', x.b64, '').then(function (r) { if (!r.ok) { fails++; toast(r.error); } else setTrial(id, { photos: r.photos }); next(); });
        }).catch(function (e) { fails++; onServerError(e); });
      };
      next();
    }, $('main'));
  }
  function setTrial(id, patch) { H.data.trials.forEach(function (t) { if (t.id === id) Object.assign(t, patch); }); }
  function shrink(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res({ b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], name: (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg' });
      };
      im.onerror = function () { URL.revokeObjectURL(url); res(null); };
      im.src = url;
    });
  }
  // ---- ฟอร์มบันทึกการทดลอง (ตามแบบ FM-RD-01-01)
  function trialForm(p, t0) {
    var isNew = !t0, tr = trialsOf(p.id), last = tr[tr.length - 1];
    var t = t0 ? JSON.parse(JSON.stringify(t0)) : { round: (last ? last.round : 0) + 1, date: H.data.today, group: last ? last.group : (p.category || ''), unit: last ? last.unit : 'กรัม',
      ingredients: last ? last.ingredients.map(function (x) { return { name: x.name, rd: x.rd, batch: '' }; }) : [{ name: '', rd: '', batch: '' }],
      moisture: last ? last.moisture : '', packing: last ? last.packing : '', prep: last ? last.prep : '', process: last ? last.process : '', sensory: {}, result: '', trialBy: last ? last.trialBy : '', approvedBy: last ? last.approvedBy : '' };
    var T = function (id, label, v, rows, ph) { return '<div class="pf full"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="' + (rows || 3) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v || '') + '</textarea></div>'; };
    var I = function (id, label, v, ph) { return '<div class="pf"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(v || '') + '" maxlength="120"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>'; };
    var body = (isNew && last ? '<div class="rhint">ดึงส่วนผสม การบรรจุ และขั้นตอนจากครั้งที่ ' + last.round + ' มาให้แล้ว — แก้เฉพาะที่เปลี่ยน</div>' : '')
      + '<div class="pform"><div class="pf"><label for="tR">สูตรการทดลองครั้งที่</label><input id="tR" inputmode="numeric" value="' + esc(t.round) + '"></div>'
      + '<div class="pf"><label for="tD">วันที่ทำการทดลอง *</label><input type="date" id="tD" value="' + esc(t.date || '') + '"></div>'
      + I('tG', 'กลุ่มสินค้า', t.group, 'เช่น น้ำพริกอบกรอบ')
      + '<div class="pf"><label for="tU">หน่วยปริมาณส่วนผสม</label><select id="tU">' + ['กรัม', 'กก.'].map(function (u) { return '<option' + (t.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div></div>'
      + '<div class="xsub2">ส่วนผสม (Ingredients List) — สูตร R&D และ สูตร 1st Batch · % คำนวณให้</div><div class="ring" id="tIng"></div>'
      + '<button type="button" class="btn btn-line btn-sm" id="tAddI">' + icon('plus', 15) + ' เพิ่มส่วนผสม</button>'
      + '<div class="pform" style="margin-top:12px">' + I('tWb', 'น้ำหนักก่อนอบ (สูตร 1st Batch)', t.weightBefore, 'เช่น 12403 กรัม') + I('tWa', 'น้ำหนักหลังอบ (สูตร 1st Batch)', t.weightAfter, 'เช่น 11671 กรัม')
      + I('tBr', 'ค่า BRIX / SALI สูตร R&D', t.brixRd) + I('tBb', 'ค่า BRIX / SALI สูตร 1st Batch', t.brixBatch) + I('tM', 'ค่าความชื้น', t.moisture, 'เช่น ความชื้นของสินค้า ≤ 6.0%')
      + T('tPk', 'ลักษณะการบรรจุ สูตร 1st Batch', t.packing, 3, 'เช่น ควบคุมอุณหภูมิก่อนบรรจุ 24-30 °C / ถุงฟอยด์ 70 x 30 mm / น้ำหนักสุทธิ 12 กรัม')
      + T('tPr', 'ขั้นตอนการเตรียมวัตถุดิบ', t.prep, 5) + T('tPc', 'ขั้นตอนการทำ', t.process, 5) + T('tDf', 'ความแตกต่างของวิธีการทำระหว่างสูตร R&D กับ สูตร 1st Batch', t.diff, 2) + '</div>'
      + '<div class="xsub2">ผลการประเมินทางประสาทสัมผัส (5 = ดีมาก · 4 = ดี · 3 = ปานกลาง · 2 = พอใช้ต้องปรับปรุง · 1 = ต้องแก้ไขอย่างเร่งด่วน)</div><div class="rsens">'
      + SENS.map(function (k) { var v = Number((t.sensory || {})[k[0]]) || 0; return '<div class="rsr"><span>' + k[1] + '</span><div>' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="rsb' + (v === n ? ' on' : '') + '" data-sk="' + k[0] + '" data-sv="' + n + '">' + n + '</button>'; }).join('') + '</div></div>'; }).join('') + '</div>'
      + '<div class="pform" style="margin-top:12px"><div class="pf full"><label>ผลการประเมิน</label><div class="rseg">' + [['pass', 'ผ่าน (ผ่านการประเมินและได้รับการยินยอมจากลูกค้า)'], ['fail', 'ไม่ผ่าน (ไม่ผ่านการประเมินหรือไม่ได้รับการยินยอมจากลูกค้า)'], ['', 'ยังไม่ประเมิน']].map(function (r) { return '<label><input type="radio" name="tRes" value="' + r[0] + '"' + ((t.result || '') === r[0] ? ' checked' : '') + '> ' + r[1] + '</label>'; }).join('') + '</div></div>'
      + T('tC', 'ผลการประเมิน / ข้อเสนอแนะ', t.comment, 3) + I('tBy', 'ผู้ทดลอง (R&D)', t.trialBy) + I('tAp', 'ผู้อนุมัติ (หัวหน้าทีม HACCP)', t.approvedBy)
      + (isNew ? '' : '<div class="pf full"><button type="button" class="btn btn-line btn-sm rdel" id="tDel">' + icon('trash', 16) + ' ลบการทดลองครั้งนี้</button></div>') + '</div>';
    var ing = t.ingredients.slice(), sens = Object.assign({}, t.sensory || {});
    var drawIng = function () {
      var tot = sumOf(ing, 'rd'), totB = sumOf(ing, 'batch');
      $('tIng').innerHTML = '<div class="rir rih"><span>#</span><span>ส่วนผสม</span><span>R&D</span><span>%</span><span>1st Batch</span><span>%</span><span></span></div>' + ing.map(function (x, i) {
        return '<div class="rir"><span class="xsn">' + (i + 1) + '</span><input data-ii="' + i + ':name" value="' + esc(x.name || '') + '" placeholder="ชื่อวัตถุดิบ" maxlength="100"><input data-ii="' + i + ':rd" value="' + esc(x.rd == null ? '' : x.rd) + '" inputmode="decimal"><em data-ip="' + i + ':rd">' + nf(pct(Number(x.rd), tot)) + '</em>'
          + '<input data-ii="' + i + ':batch" value="' + esc(x.batch == null ? '' : x.batch) + '" inputmode="decimal"><em data-ip="' + i + ':batch">' + nf(pct(Number(x.batch), totB)) + '</em><button type="button" class="icon-btn" data-idel="' + i + '" aria-label="ลบแถว">' + icon('x', 14) + '</button></div>';
      }).join('') + '<div class="rir rit"><span></span><b>รวมทั้งหมด</b><b id="tTot">' + nf(tot) + '</b><b>' + (tot ? '100' : '') + '</b><b id="tTotB">' + nf(totB) + '</b><b>' + (totB ? '100' : '') + '</b><span></span></div>';
    };
    var recalc = function () {
      var tot = sumOf(ing, 'rd'), totB = sumOf(ing, 'batch');
      ing.forEach(function (x, i) { ['rd', 'batch'].forEach(function (k) { var e = document.querySelector('[data-ip="' + i + ':' + k + '"]'); if (e) e.textContent = nf(pct(Number(x[k]), k === 'rd' ? tot : totB)); }); });
      $('tTot').textContent = nf(tot); $('tTotB').textContent = nf(totB);
    };
    wide({ icon: 'flask', title: (isNew ? 'บันทึกการทดลอง · ' : 'การทดลองครั้งที่ ' + t.round + ' · ') + p.name, ok: 'บันทึก', body: body,
      onOpen: function () {
        drawIng();
        $('tIng').addEventListener('input', function (e) { var a = (e.target.getAttribute('data-ii') || '').split(':'); if (a.length < 2) return; ing[+a[0]][a[1]] = a[1] === 'name' ? e.target.value : (e.target.value.trim() === '' ? '' : Number(e.target.value.replace(/,/g, ''))); if (a[1] !== 'name') recalc(); });
        $('tIng').addEventListener('click', function (e) { var b = e.target.closest('[data-idel]'); if (!b) return; ing.splice(+b.getAttribute('data-idel'), 1); if (!ing.length) ing.push({ name: '', rd: '', batch: '' }); drawIng(); });
        $('tAddI').addEventListener('click', function () { ing.push({ name: '', rd: '', batch: '' }); drawIng(); var a = document.querySelectorAll('[data-ii$=":name"]'); a[a.length - 1].focus(); });
        on('[data-sk]', 'click', function (el) { var k = el.getAttribute('data-sk'), v = +el.getAttribute('data-sv'); sens[k] = sens[k] === v ? 0 : v; Array.prototype.forEach.call(document.querySelectorAll('[data-sk="' + k + '"]'), function (b) { b.classList.toggle('on', +b.getAttribute('data-sv') === sens[k]); }); }, $('mBody'));
        if ($('tDel')) $('tDel').addEventListener('click', function () {
          ask({ title: 'ลบการทดลองครั้งที่ ' + t.round + '?', text: 'ข้อมูลและรูปของครั้งนี้จะหายไป กู้คืนไม่ได้', ok: 'ลบ', tone: 'danger' }).then(function (ok) {
            if (!ok) return;
            call('rdDeleteTrial', state.token, t.id).then(function (r) { if (!r.ok) return toast(r.error); H.data.trials = H.data.trials.filter(function (x) { return x.id !== t.id; }); closeModal(); toast('ลบแล้ว'); npDetail(p); }).catch(onServerError);
          });
        });
      },
      submit: function () {
        var res = document.querySelector('input[name="tRes"]:checked');
        var o = { id: t.id, productId: p.id, round: $('tR').value, date: $('tD').value, group: $('tG').value, unit: $('tU').value,
          ingredients: ing.filter(function (x) { return String(x.name || '').trim() || x.rd !== '' || x.batch !== ''; }),
          weightBefore: $('tWb').value, weightAfter: $('tWa').value, brixRd: $('tBr').value, brixBatch: $('tBb').value, moisture: $('tM').value,
          packing: $('tPk').value, prep: $('tPr').value, process: $('tPc').value, diff: $('tDf').value, sensory: sens, result: res ? res.value : '', comment: $('tC').value,
          trialBy: $('tBy').value, approvedBy: $('tAp').value };
        if (!o.date) return Promise.resolve('ใส่วันที่ทำการทดลอง');
        if (o.ingredients.some(function (x) { return !String(x.name || '').trim(); })) return Promise.resolve('ส่วนผสมทุกแถวต้องมีชื่อ');
        return call('rdSaveTrial', state.token, o).then(function (r) {
          if (!r.ok) return r.error;
          upsert(H.data.trials, r.trial); closeModal(); toast(isNew ? 'บันทึกการทดลองครั้งที่ ' + r.trial.round + ' แล้ว' : 'บันทึกแล้ว'); npDetail(p);
        });
      } });
  }
  // ---- แบบรายงานสำหรับพิมพ์ (หน้าตาแบบ FM-RD-01-01)
  function printTrial(p, tid) {
    var t = H.data.trials.filter(function (x) { return x.id === tid; })[0];
    if (!t) { H.q.print = ''; return npDetail(p); }
    var ing = t.ingredients, tot = sumOf(ing, 'rd'), totB = sumOf(ing, 'batch'), lines = function (s) { return esc(s || '').replace(/\n/g, '<br>'); };
    var ph = t.photos || [];
    $('main').innerHTML = '<div class="rdh noprint"><button class="btn btn-line btn-sm" id="pBack">' + icon('back', 16) + ' กลับ</button><button class="btn btn-primary btn-sm" id="pPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div class="rform"><div class="rfh"><div><b>บริษัท สปังกี้ ฟู้ด จำกัด</b><span>Spunky Food Co., Ltd.</span></div><div class="rfc"><b>แบบรายงานการทดลองผลิตภัณฑ์ใหม่</b><span>แผนกวิจัยและพัฒนาผลิตภัณฑ์ (R&D)</span></div><div class="rfr">FM-RD-01-01 Rev.00<br>วันที่ประกาศใช้ 01/10/2024</div></div>'
      + '<div class="rfrow"><span><b>ชื่อสินค้า :</b> ' + esc(p.name) + '</span><span><b>กลุ่มสินค้า :</b> ' + esc(t.group || p.category || '-') + '</span><span><b>วันที่ทำการทดลอง :</b> ' + dd(t.date) + '</span></div>'
      + '<div class="rfrow"><span><b>สูตรการทดลองครั้งที่ :</b> ' + t.round + '</span><span><b>เลขที่ผลิตภัณฑ์ :</b> ' + esc(p.code) + '</span></div>'
      + '<div class="rfgrid"><div><table class="rft"><thead><tr><th rowspan="2">Ingredients List</th><th colspan="2">สูตร R&D</th><th colspan="2">สูตร 1st Batch</th></tr><tr><th>Ing / Batch (' + esc(t.unit) + ')</th><th>Quantity (%)</th><th>Ing / Batch (' + esc(t.unit) + ')</th><th>Quantity (%)</th></tr></thead><tbody>'
      + ing.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="r">' + nf(x.rd) + '</td><td class="r">' + nf(pct(Number(x.rd), tot)) + '</td><td class="r">' + nf(x.batch) + '</td><td class="r">' + nf(pct(Number(x.batch), totB)) + '</td></tr>'; }).join('')
      + '<tr class="tot"><td>รวมทั้งหมด</td><td class="r">' + nf(tot) + '</td><td class="r">' + (tot ? '100' : '') + '</td><td class="r">' + nf(totB) + '</td><td class="r">' + (totB ? '100' : '') + '</td></tr></tbody></table>'
      + '<div class="rfs"><b>ขั้นตอนการเตรียมวัตถุดิบ</b><div>' + lines(t.prep) + '</div></div><div class="rfs"><b>ขั้นตอนการทำ</b><div>' + lines(t.process) + '</div></div>'
      + '<div class="rfs"><b>ความแตกต่างของวิธีการทำระหว่างสูตร R&D กับ สูตร 1st Batch</b><div>' + lines(t.diff) + '</div></div></div>'
      + '<div><div class="rfimg">' + (ph[0] ? '<img src="' + esc(ph[0].url) + '=w600" alt="" crossorigin="anonymous">' : '<span>ภาพสินค้า</span>') + '</div>'
      + '<table class="rft"><tr><th colspan="2">น้ำหนักสินค้า สูตร 1st Batch</th></tr><tr><td>น้ำหนักก่อนอบ</td><td>' + esc(t.weightBefore || '-') + '</td></tr><tr><td>น้ำหนักหลังอบ</td><td>' + esc(t.weightAfter || '-') + '</td></tr>'
      + '<tr><th colspan="2">ค่า BRIX , SALI</th></tr><tr><td>สูตร R&D</td><td>' + esc(t.brixRd || '-') + '</td></tr><tr><td>สูตร 1st Batch</td><td>' + esc(t.brixBatch || '-') + '</td></tr>'
      + '<tr><th colspan="2">ค่าความชื้น</th></tr><tr><td colspan="2">' + esc(t.moisture || '-') + '</td></tr></table>'
      + '<div class="rfs"><b>ลักษณะการบรรจุ สูตร 1st Batch</b><div>' + lines(t.packing) + '</div></div>'
      + '<table class="rft"><tr><th>การประเมิน</th><th>คะแนน</th><th>ระดับการให้คะแนน</th></tr>' + SENS.map(function (k, i) { return '<tr><td>' + k[1] + '</td><td class="c">' + ((t.sensory || {})[k[0]] || '') + '</td><td>' + ['5 = ดีมาก', '4 = ดี', '3 = ปานกลาง', '2 = พอใช้ต้องปรับปรุง', '1 = ต้องแก้ไขอย่างเร่งด่วน'][i] + '</td></tr>'; }).join('') + '</table>'
      + '<div class="rfres"><b>ผลการประเมิน</b><span>' + (t.result === 'pass' ? '☑' : '☐') + ' ผ่าน</span><span>' + (t.result === 'fail' ? '☑' : '☐') + ' ไม่ผ่าน</span></div>'
      + '<small class="rfnote">** ผ่าน คือ ผ่านการประเมินและได้รับการยินยอมจากลูกค้า · ** ไม่ผ่าน คือ ไม่ผ่านการประเมินหรือไม่ได้รับการยินยอมจากลูกค้า</small></div></div>'
      + (ph.length > 1 ? '<div class="rfphotos">' + ph.slice(1).map(function (f) { return '<img src="' + esc(f.url) + '=w400" alt="">'; }).join('') + '</div>' : '')
      + '<div class="rfs"><b>ผลการประเมิน / ข้อเสนอแนะ :</b><div>' + lines(t.comment) + '</div></div>'
      + '<div class="rfsign"><div>ลงชื่อ ผู้ทดลอง ..............................<br>( ' + esc(t.trialBy || '..............................') + ' )<br>R&D</div><div>ลงชื่อผู้อนุมัติ ..............................<br>( ' + esc(t.approvedBy || '..............................') + ' )<br>หัวหน้าทีม HACCP</div></div></div>';
    $('pBack').addEventListener('click', function () { H.q.print = ''; npDetail(p); });
    $('pPrint').addEventListener('click', function () { window.print(); });
  }
  function npForm(p0) {
    var isNew = !p0, t = H.data.today, cats = list(S_().categories);
    var p = p0 ? JSON.parse(JSON.stringify(p0)) : { market: 'dom', status: 'dev', startDate: t, endDate: addDays(t, 30), partners: [] };
    var otherCat = p.category && cats.indexOf(p.category) < 0;
    var parts = H.data.partners.filter(function (x) { return x.active !== 'off' || p.partners.indexOf(x.name) >= 0; });
    var extra = p.partners.filter(function (n) { return !parts.some(function (x) { return x.name === n; }); });
    var body = '<div class="pform"><div class="pf full"><label for="nN">ชื่อผลิตภัณฑ์ *</label><input id="nN" value="' + esc(p.name || '') + '" maxlength="150" placeholder="เช่น น้ำพริกปลาทูกรอบสูตรเผ็ดน้อย"></div>'
      + '<div class="pf"><label for="nC">ประเภทสินค้า</label><select id="nC"><option value="">— เลือก —</option>' + cats.map(function (c) { return '<option' + (p.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value="__o"' + (otherCat ? ' selected' : '') + '>อื่น ๆ (ระบุ)</option></select>'
      + '<input id="nCo" value="' + esc(otherCat ? p.category : '') + '" placeholder="ระบุประเภท" maxlength="60"' + (otherCat ? '' : ' hidden') + ' style="margin-top:6px"></div>'
      + '<div class="pf"><label>ตลาด</label><div class="rseg">' + Object.keys(MKT).map(function (k) { return '<label><input type="radio" name="nM" value="' + k + '"' + (p.market === k ? ' checked' : '') + '> ' + MKT[k] + '</label>'; }).join('') + '</div></div>'
      + '<div class="pf"><label for="nSd">วันที่เริ่ม *</label><input type="date" id="nSd" value="' + esc(p.startDate || '') + '"></div>'
      + '<div class="pf"><label for="nEd">วันที่สิ้นสุด (กำหนดเสร็จ) *</label><input type="date" id="nEd" value="' + esc(p.endDate || '') + '"></div>'
      + '<div class="pf"><label for="nSt">สถานะ</label><select id="nSt">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join('') + '</select></div>'
      + '<div class="pf" id="nDw"><label for="nDd">วันที่เสร็จจริง</label><input type="date" id="nDd" value="' + esc(p.doneDate || '') + '"></div>'
      + '<div class="pf"><label for="nO">ผู้รับผิดชอบ</label><input id="nO" value="' + esc(p.owner || '') + '" maxlength="80"></div>'
      + '<div class="pf full"><label>คู่ค้าที่จะส่งขาย</label>' + (parts.length || extra.length ? '<div class="rpick">' + parts.map(function (x) {
        return '<label class="' + x.type + '"><input type="checkbox" data-pt value="' + esc(x.name) + '"' + (p.partners.indexOf(x.name) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + ' <small>' + MKT[x.type] + (x.country ? ' · ' + esc(x.country) : '') + '</small></label>';
      }).join('') + extra.map(function (n) { return '<label><input type="checkbox" data-pt value="' + esc(n) + '" checked> ' + esc(n) + '</label>'; }).join('') + '</div>' : '<div class="muted" style="font-size:13px">ยังไม่มีคู่ค้า — เพิ่มได้ที่เมนู "คู่ค้า" หรือพิมพ์ชื่อด้านล่าง</div>')
      + '<input id="nPx" placeholder="คู่ค้าอื่น (พิมพ์ชื่อ คั่นด้วย , )" maxlength="300" style="margin-top:6px"></div>'
      + '<div class="pf full"><label for="nNote">หมายเหตุ / รายละเอียด</label><textarea id="nNote" rows="3" maxlength="1000">' + esc(p.note || '') + '</textarea></div>'
      + (isNew ? '' : '<div class="pf full"><button type="button" class="btn btn-line btn-sm rdel" id="nDel">' + icon('trash', 16) + ' ลบรายการนี้</button></div>') + '</div>';
    wide({ icon: 'flask', title: isNew ? 'เพิ่มผลิตภัณฑ์ใหม่' : 'แก้ไข ' + (p.code || ''), ok: 'บันทึก', body: body,
      onOpen: function () {
        var sync = function () { var st = $('nSt').value; $('nDw').hidden = !(st === 'done' || st === 'launched'); if (!$('nDw').hidden && !$('nDd').value) $('nDd').value = t; };
        $('nSt').addEventListener('change', sync); sync();
        $('nC').addEventListener('change', function () { $('nCo').hidden = this.value !== '__o'; if (!$('nCo').hidden) $('nCo').focus(); });
        if ($('nDel')) $('nDel').addEventListener('click', function () {
          ask({ title: 'ลบ ' + p.code + ' ' + p.name + '?', text: 'ลบแล้วกู้คืนไม่ได้ (ถ้าแค่หยุดพัฒนา ให้เปลี่ยนสถานะเป็น "พักไว้" หรือ "ยกเลิก")', ok: 'ลบ', tone: 'danger' }).then(function (ok) {
            if (!ok) return;
            call('rdDeleteProduct', state.token, p.id).then(function (r) {
              if (!r.ok) return toast(r.error);
              H.data.products = H.data.products.filter(function (x) { return x.id !== p.id; }); H.q.npId = ''; closeModal(); toast('ลบแล้ว'); npPage();
            }).catch(onServerError);
          });
        });
      },
      submit: function () {
        var pt = []; Array.prototype.forEach.call(document.querySelectorAll('[data-pt]'), function (el) { if (el.checked) pt.push(el.value); });
        pt = pt.concat(list($('nPx').value));
        var cat = $('nC').value === '__o' ? $('nCo').value.trim() : $('nC').value;
        var m = document.querySelector('input[name="nM"]:checked');
        var o = { id: p.id, name: $('nN').value.trim(), category: cat, market: m ? m.value : 'dom', startDate: $('nSd').value, endDate: $('nEd').value,
          status: $('nSt').value, doneDate: $('nDw').hidden ? '' : $('nDd').value, owner: $('nO').value.trim(), partners: pt, note: $('nNote').value };
        if (!o.name) return Promise.resolve('ใส่ชื่อผลิตภัณฑ์');
        if (!o.startDate || !o.endDate) return Promise.resolve('ใส่วันที่เริ่มและวันที่สิ้นสุด');
        if (o.endDate < o.startDate) return Promise.resolve('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');
        if ($('nC').value === '__o' && !cat) return Promise.resolve('ระบุประเภทสินค้า');
        return call('rdSaveProduct', state.token, o).then(function (r) {
          if (!r.ok) return r.error;
          upsert(H.data.products, r.product); closeModal(); toast(isNew ? 'เพิ่มแล้ว · ' + r.product.code : 'บันทึกแล้ว');
          if (isNew) H.q.npId = r.product.id; render();
        });
      } });
  }
  function render() { H.render(state.page); }

  // ==================== คู่ค้า ====================
  function partnerPage() {
    var q = H.q, all = H.data.partners;
    q.pt = q.pt || 'all';
    var s = String(q.ps || '').toLowerCase();
    var rows = all.filter(function (x) {
      if (q.pt !== 'all' && x.type !== q.pt) return false;
      return !s || [x.name, x.country, x.channel, x.contact, x.phone].concat(x.products).join(' ').toLowerCase().indexOf(s) >= 0;
    }).sort(function (a, b) { return (a.active === 'off') - (b.active === 'off') || String(a.name).localeCompare(String(b.name), 'th'); });
    var np = function (name) { return H.data.products.filter(function (p) { return p.partners.indexOf(name) >= 0; }); };
    $('main').innerHTML = '<h3>คู่ค้า</h3><p class="lead">คู่ค้าในประเทศ / ต่างประเทศ · ช่องทางขาย · ผู้ติดต่อ · สินค้าที่ส่งขายให้แต่ละเจ้า</p>'
      + '<div class="rtool"><button class="btn btn-primary" id="pAdd">' + icon('plus', 18) + ' เพิ่มคู่ค้า</button></div>'
      + '<div class="pchips rchips r3">' + [['all', 'ทั้งหมด'], ['dom', 'ในประเทศ'], ['exp', 'ต่างประเทศ']].map(function (c) { return '<button class="chip' + (q.pt === c[0] ? ' on' : '') + '" data-pt2="' + c[0] + '">' + c[1] + ' (' + all.filter(function (x) { return c[0] === 'all' || x.type === c[0]; }).length + ')</button>'; }).join('') + '</div>'
      + '<div class="pbar rbar r1"><div class="psearch">' + icon('search', 18) + '<input id="pS" type="search" placeholder="ค้นหา ชื่อ / ประเทศ / สินค้า / ผู้ติดต่อ" value="' + esc(q.ps || '') + '"></div></div>'
      + '<div class="rcards">' + (rows.map(function (x) {
        var dev = np(x.name);
        return '<button class="rcard rpc' + (x.active === 'off' ? ' off' : '') + '" data-pe="' + esc(x.id) + '" style="--m:' + MKTC[x.type] + '"><div class="rch"><b class="rname" style="margin:0">' + esc(x.name) + '</b>' + mktTag(x.type) + '</div>'
          + '<div class="rmeta">' + [x.country ? icon('globe', 14) + ' ' + esc(x.country) : '', x.channel ? '🛒 ' + esc(x.channel) : '', x.active === 'off' ? '<span class="muted">เลิกค้าขายแล้ว</span>' : ''].filter(String).join(' · ') + '</div>'
          + (x.contact || x.phone ? '<div class="rmeta">' + icon('phone', 14) + ' ' + esc([x.contact, x.phone].filter(String).join(' · ')) + '</div>' : '')
          + '<div class="rprods"><small>สินค้าที่ส่งขาย ' + x.products.length + ' รายการ</small>' + x.products.slice(0, 8).map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + (x.products.length > 8 ? '<span class="more">+' + (x.products.length - 8) + '</span>' : '') + '</div>'
          + (dev.length ? '<div class="rpt">' + icon('flask', 14) + ' ผลิตภัณฑ์ใหม่: ' + dev.map(function (p) { return esc(p.name); }).join(', ') + '</div>' : '') + '</button>';
      }).join('') || '<div class="panel muted">ยังไม่มีคู่ค้า' + (all.length ? 'ที่ตรงกับการค้นหา' : ' — กด "เพิ่มคู่ค้า" (หรือส่งไฟล์รายชื่อมาให้นำเข้าทีเดียว)') + '</div>') + '</div>';
    on('[data-pt2]', 'click', function (el) { q.pt = el.getAttribute('data-pt2'); partnerPage(); }, $('main'));
    $('pS').addEventListener('input', function () { q.ps = this.value; clearTimeout(H.t); H.t = setTimeout(function () { partnerPage(); var e = $('pS'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('pAdd').addEventListener('click', function () { partnerForm(null); });
    on('[data-pe]', 'click', function (el) { partnerForm(H.data.partners.filter(function (x) { return x.id === el.getAttribute('data-pe'); })[0]); }, $('main'));
  }
  function partnerForm(x0) {
    var isNew = !x0, x = x0 ? JSON.parse(JSON.stringify(x0)) : { type: 'dom', products: [], active: 'on' };
    var chans = list(S_().channels);
    var known = []; H.data.products.forEach(function (p) { if (known.indexOf(p.name) < 0) known.push(p.name); });
    H.data.partners.forEach(function (y) { y.products.forEach(function (n) { if (known.indexOf(n) < 0) known.push(n); }); });
    var body = '<div class="pform"><div class="pf full"><label for="cN">ชื่อคู่ค้า *</label><input id="cN" value="' + esc(x.name || '') + '" maxlength="150"></div>'
      + '<div class="pf"><label>ประเภท</label><div class="rseg">' + Object.keys(MKT).map(function (k) { return '<label><input type="radio" name="cT" value="' + k + '"' + (x.type === k ? ' checked' : '') + '> ' + MKT[k] + '</label>'; }).join('') + '</div></div>'
      + '<div class="pf"><label for="cCo">ประเทศ</label><input id="cCo" value="' + esc(x.country || '') + '" maxlength="80" placeholder="เช่น ไทย / ญี่ปุ่น / สหรัฐอเมริกา"></div>'
      + '<div class="pf"><label for="cCh">ช่องทางขาย</label><input id="cCh" list="cChL" value="' + esc(x.channel || '') + '" maxlength="80"><datalist id="cChL">' + chans.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>'
      + '<div class="pf"><label for="cCt">ผู้ติดต่อ</label><input id="cCt" value="' + esc(x.contact || '') + '" maxlength="120"></div>'
      + '<div class="pf"><label for="cPh">เบอร์โทร</label><input id="cPh" value="' + esc(x.phone || '') + '" maxlength="60" inputmode="tel"></div>'
      + '<div class="pf full"><label for="cP">สินค้าที่ส่งขาย (บรรทัดละ 1 รายการ)</label><textarea id="cP" rows="5" placeholder="น้ำพริกหนังไก่กรอบ&#10;พริกน้ำมันมะกอก">' + esc(x.products.join('\n')) + '</textarea>'
      + '<div class="raddp"><input id="cPa" list="cPaL" placeholder="เลือก / พิมพ์ชื่อสินค้า แล้วกด เพิ่ม" maxlength="150"><datalist id="cPaL">' + known.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><button type="button" class="btn btn-line btn-sm" id="cPaB">' + icon('plus', 14) + ' เพิ่ม</button></div></div>'
      + '<div class="pf full"><label for="cNote">หมายเหตุ</label><textarea id="cNote" rows="2" maxlength="1000">' + esc(x.note || '') + '</textarea></div>'
      + (isNew ? '' : '<label class="xchk pf full"><input type="checkbox" id="cOff"' + (x.active === 'off' ? ' checked' : '') + '> เลิกค้าขายกับคู่ค้านี้แล้ว</label><div class="pf full"><button type="button" class="btn btn-line btn-sm rdel" id="cDel">' + icon('trash', 16) + ' ลบคู่ค้านี้</button></div>') + '</div>';
    wide({ icon: 'users', title: isNew ? 'เพิ่มคู่ค้า' : 'แก้ไขคู่ค้า', ok: 'บันทึก', body: body,
      onOpen: function () {
        var add = function () { var v = $('cPa').value.trim(); if (!v) return; var a = list($('cP').value.replace(/,/g, '\n')); if (a.indexOf(v) < 0) a.push(v); $('cP').value = a.join('\n'); $('cPa').value = ''; $('cPa').focus(); };
        $('cPaB').addEventListener('click', add);
        $('cPa').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        if ($('cDel')) $('cDel').addEventListener('click', function () {
          ask({ title: 'ลบคู่ค้า ' + x.name + '?', text: 'ลบแล้วกู้คืนไม่ได้ (ถ้าแค่เลิกค้าขาย ให้ติ๊ก "เลิกค้าขายกับคู่ค้านี้แล้ว" แทน)', ok: 'ลบ', tone: 'danger' }).then(function (ok) {
            if (!ok) return;
            call('rdDeletePartner', state.token, x.id).then(function (r) {
              if (!r.ok) return toast(r.error);
              H.data.partners = H.data.partners.filter(function (y) { return y.id !== x.id; }); closeModal(); toast('ลบแล้ว'); partnerPage();
            }).catch(onServerError);
          });
        });
      },
      submit: function () {
        var t = document.querySelector('input[name="cT"]:checked');
        var o = { id: x.id, name: $('cN').value.trim(), type: t ? t.value : 'dom', country: $('cCo').value.trim(), channel: $('cCh').value.trim(), contact: $('cCt').value.trim(),
          phone: $('cPh').value.trim(), products: $('cP').value.split('\n'), note: $('cNote').value, active: $('cOff') && $('cOff').checked ? 'off' : 'on' };
        if (!o.name) return Promise.resolve('ใส่ชื่อคู่ค้า');
        return call('rdSavePartner', state.token, o).then(function (r) {
          if (!r.ok) return r.error;
          if (!isNew && x.name !== r.partner.name) H.data.products.forEach(function (p) { var i = p.partners.indexOf(x.name); if (i >= 0) p.partners[i] = r.partner.name; });
          upsert(H.data.partners, r.partner); closeModal(); toast(isNew ? 'เพิ่มคู่ค้าแล้ว' : 'บันทึกแล้ว'); partnerPage();
        });
      } });
  }

  // ==================== ต้นทุนสินค้า (ตามไฟล์ Excel ของ R&D — ผู้ใช้ขอ 24/11/69) ====================
  // ส่วนผสม: ราคารวม = (ราคา/กก. รวม VAT ÷ 1000) × น้ำหนัก (กรัม) · บรรจุภัณฑ์: ราคา/ชิ้น รวม VAT + หมายเหตุ
  // ช่อง "ใช้ได้กี่ (หน่วยสินค้า)" ของบรรจุภัณฑ์ไม่บังคับ — ใส่แล้วระบบคิดต้นทุนบรรจุภัณฑ์ต่อหน่วยให้ในกล่องสรุป
  var WU = { 'กรัม': 1, 'กก.': 1000 };
  // หน่วยส่วนผสม (ผู้ใช้ขอ 24/11/69: พิมพ์หน่วยอื่นเองได้): น้ำหนัก กรัม / กก. → ราคาต่อ กก. · ปริมาตร มล. / ลิตร → ราคาต่อลิตร · หน่วยอื่น (ฟอง ขวด ชิ้น …) → ราคาต่อหน่วยนั้น
  var UNIT_OPTS = ['กรัม', 'กก.', 'มล.', 'ลิตร', 'ชิ้น', 'ฟอง', 'ขวด', 'ซอง', 'ถุง', 'แพ็ค', 'กระป๋อง', 'ลูก'];
  function normUnit(u) {
    var t = String(u || '').trim(), k = t.toLowerCase().replace(/\.$/, '');
    if (!t) return 'กรัม';
    if (/^(กรัม|ก|g|gm|gram|grams)$/.test(k)) return 'กรัม';
    if (/^(กก|กิโล|กิโลกรัม|kg|kgs)$/.test(k)) return 'กก.';
    if (/^(มล|มิลลิลิตร|ml|cc|ซีซี)$/.test(k)) return 'มล.';
    if (/^(ลิตร|l|lt|ltr|liter|litre)$/.test(k)) return 'ลิตร';
    return t.slice(0, 20);
  }
  function uinfo(u) {
    u = normUnit(u);
    if (u === 'กรัม' || u === 'กก.') return { kind: 'w', f: u === 'กก.' ? 1000 : 1, per: 'กก.' };
    if (u === 'มล.' || u === 'ลิตร') return { kind: 'v', f: u === 'ลิตร' ? 1000 : 1, per: 'ลิตร' };
    return { kind: 'o', f: 1, per: u };
  }
  function usedUnits() { var o = []; ((H.data && H.data.costs) || []).forEach(function (c) { (c.ingredients || []).forEach(function (x) { var u = normUnit(x.unit); if (u && o.indexOf(u) < 0) o.push(u); }); }); return o; }
  function costRows(c) {
    var ing = (c.ingredients || []).map(function (x) {
      var ui = uinfo(x.unit), qn = Number(x.qty) || 0, price = Number(x.price) || 0;
      var cost = ui.kind === 'o' ? price * qn : price * qn * ui.f / 1000;
      return { name: x.name, qty: x.qty, unit: normUnit(x.unit), per: ui.per, kind: ui.kind, price: x.price, vendor: x.vendor || '', grams: ui.kind === 'w' ? qn * ui.f : 0, cost: Math.round(cost * 100) / 100, noPrice: !!x.name && (x.price === '' || x.price == null) };
    });
    var mat = Math.round(ing.reduce(function (t, x) { return t + x.cost; }, 0) * 100) / 100, grams = ing.reduce(function (t, x) { return t + x.grams; }, 0);
    var out = Number(c.outQty) || 0;
    var pack = (c.packaging || []).map(function (x) { var p = Number(x.price) || 0, per = Number(x.per) || 0; return { name: x.name, price: x.price, per: x.per, note: x.note, unitCost: per ? p / per : null }; });
    var packUnit = pack.reduce(function (t, x) { return t + (x.unitCost || 0); }, 0), packN = pack.filter(function (x) { return x.unitCost != null; }).length;
    var matUnit = out ? mat / out : null;
    return { ing: ing, mat: mat, grams: grams, pack: pack, packUnit: packUnit, packN: packN, matUnit: matUnit, total: matUnit != null ? matUnit + packUnit : null, out: out, unit: c.outUnit || 'ซอง', noPrice: ing.filter(function (x) { return x.noPrice; }).length };
  }
  function baht(v, d) { return v == null || v === '' || isNaN(v) ? '-' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); }
  function slashTh(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + String(+p[0] + 543).slice(-2) : '-'; }
  // ราคาจากผู้ขาย → ราคาตามหน่วยของแถว (ต่อ กก. / ต่อลิตร / ต่อหน่วยเดียวกัน) — ใช้ทั้งฟอร์มและ Dashboard
  function perKgOf(x, rowUnit) {
    var vu = normUnit(x.unit), want = uinfo(rowUnit || 'กรัม');
    if (want.kind === 'w') {
      if (vu === 'กก.') return { price: x.price, note: '' };
      if (vu === 'กรัม') return { price: Math.round(x.price * 1000 * 100) / 100, note: 'แปลงจาก ' + baht(x.price) + ' บาท/กรัม' };
      return { price: x.price, note: 'ราคาต่อ ' + (x.unit || 'หน่วย') + ' — ตรวจว่าเป็นราคา/กก.' };
    }
    if (want.kind === 'v') {
      if (vu === 'ลิตร') return { price: x.price, note: '' };
      if (vu === 'มล.') return { price: Math.round(x.price * 1000 * 100) / 100, note: 'แปลงจาก ' + baht(x.price) + ' บาท/มล.' };
      return { price: x.price, note: 'ราคาต่อ ' + (x.unit || 'หน่วย') + ' — ตรวจว่าเป็นราคา/ลิตร' };
    }
    return vu === want.per ? { price: x.price, note: '' } : { price: x.price, note: 'ราคาต่อ ' + (x.unit || 'หน่วย') + ' — ตรวจว่าเป็นราคา/' + want.per };
  }
  function costTitle(c) { return esc(c.name) + (c.size ? ' ' + esc(c.size) : ''); }

  function costPage() {
    var q = H.q, all = (H.data.costs || []).slice();
    if (q.costId) { var cur = all.filter(function (x) { return x.id === q.costId; })[0]; if (cur) return costReport(cur); q.costId = ''; }
    var s = String(q.cs || '').trim().toLowerCase();
    var rows = all.filter(function (c) { return !s || (c.name + ' ' + c.size + ' ' + c.brand).toLowerCase().indexOf(s) >= 0; })
      .sort(function (a, b) { return String(b.costDate).localeCompare(String(a.costDate)) || String(a.name).localeCompare(String(b.name)); });
    $('main').innerHTML = '<h3>ต้นทุนสินค้า</h3>'
      + '<div class="rtool rctool"><label class="btn btn-line" id="cImp" tabindex="0">' + icon('upload', 18) + ' นำเข้าจากไฟล์ Excel<input type="file" id="cImpF" accept=".xlsx,.xls" multiple hidden></label>'
      + '<button class="btn btn-primary" id="cAdd">' + icon('plus', 18) + ' เพิ่มต้นทุนสินค้า</button></div>'
      + '<div class="pbar rbar r1"><div class="psearch">' + icon('search', 18) + '<input id="cS" type="search" placeholder="ค้นหาชื่อสินค้า / ตรา" value="' + esc(q.cs || '') + '" aria-label="ค้นหาต้นทุนสินค้า"></div></div>'
      + (rows.length ? '<div class="rccards">' + rows.map(function (c) {
        var r = costRows(c);
        return '<button class="rccard" data-cost="' + esc(c.id) + '">'
          + '<span class="rcth">' + (c.photo ? '<img src="' + esc(c.photo.url) + '=w200" alt="" loading="lazy">' : icon('image', 26)) + '</span>'
          + '<span class="rcti"><b>' + costTitle(c) + '</b><small>' + (c.brand ? 'ตรา' + esc(c.brand) + ' · ' : '') + 'อัพเดท ' + slashTh(c.costDate) + '</small>'
          + '<span class="rcnum"><span>วัตถุดิบ <b>' + baht(r.mat) + '</b> บาท</span>' + (r.total != null ? '<span>ต้นทุน/' + esc(r.unit) + ' <b>' + baht(r.total) + '</b></span>' : '') + '</span>'
          + (r.noPrice ? '<span class="rcwait">รอใส่ราคา ' + r.noPrice + ' รายการ</span>' : '') + '</span></button>';
      }).join('') + '</div>'
        : '<div class="panel empty">' + (all.length ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีต้นทุนสินค้า — กด "เพิ่มต้นทุนสินค้า" เพื่อเริ่ม') + '</div>');
    $('cS').addEventListener('input', function () { q.cs = this.value; clearTimeout(H.t); H.t = setTimeout(function () { costPage(); var e = $('cS'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250); });
    $('cAdd').addEventListener('click', function () { costForm(null); });
    $('cImpF').addEventListener('change', function () { var f = this.files; costImport(f); this.value = ''; });
    $('cImp').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('cImpF').click(); } });
    on('[data-cost]', 'click', function (el) { q.costId = el.getAttribute('data-cost'); window.scrollTo(0, 0); costPage(); }, $('main'));
  }

  // ---- นำเข้าไฟล์ Excel ต้นทุน (แบบเดียวกับไฟล์ "ต้นทุนสินค้า … 15 g" ของ R&D — ผู้ใช้ขอ 24/11/69)
  // หาตำแหน่งจากหัวข้อ (ไม่ยึดเซลล์ตายตัว): "อัพเดท" · "ต้นทุนสินค้า :" · "ชื่อส่วนผสม" · Yield / Loss / จำนวนสินค้าที่ได้ · "ชื่อบรรจุภัณฑ์"
  // รูปสินค้า = รูปที่ใหญ่ที่สุดที่วางไว้ทางขวาของหัวกระดาษ (ไม่ใช่โลโก้มุมซ้าย)
  function costParseSheet(XLSX, ws) {
    var ref = ws['!ref']; if (!ref) return null;
    var R = XLSX.utils.decode_range(ref), cell = function (r, c) { var x = ws[XLSX.utils.encode_cell({ r: r, c: c })]; return x ? x.v : ''; };
    var txt = function (r, c) { var v = cell(r, c); return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); };
    var num = function (v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).replace(/,/g, '').trim(); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; };
    var find = function (re, r0, r1) { for (var r = r0 || R.s.r; r <= (r1 == null ? R.e.r : r1); r++) for (var c = R.s.c; c <= R.e.c; c++) if (re.test(txt(r, c))) return { r: r, c: c }; return null; };
    var out = { ingredients: [], packaging: [] }, m;
    // วันที่อัพเดท dd/mm/yyyy (ค.ศ. หรือ พ.ศ.)
    var u = find(/อัพเดท|อัปเดต/);
    if (u) {
      var raw = cell(u.r, u.c), dm = String(raw).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
      if (!dm) for (var c = u.c + 1; c <= Math.min(R.e.c, u.c + 6) && !dm; c++) { var v = cell(u.r, c); if (typeof v === 'number' && v > 30000) { var d0 = XLSX.SSF.parse_date_code(v); dm = [0, d0.d, d0.m, d0.y]; } else dm = String(v).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); }
      if (dm) { var y = +dm[3]; if (y < 100) y += 2500; if (y > 2400) y -= 543; out.costDate = y + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[1]).slice(-2); }
    }
    // ชื่อสินค้า / ขนาด / ตรา จากหัวข้อ "ต้นทุนสินค้า : …"
    var t = find(/ต้นทุนสินค้า/);
    if (t) {
      var lines = String(cell(t.r, t.c)).split(/\n/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(String);
      var first = (lines.shift() || '').replace(/^.*ต้นทุนสินค้า\s*:?\s*/, '').trim();
      lines.forEach(function (l) { if (/^ตรา/.test(l)) out.brand = l.replace(/^ตรา\s*/, '').trim(); else if (l && !out.brand) first += ' ' + l; });
      if ((m = first.match(/^(.*?)\s*(\d+(?:\.\d+)?\s*(?:g|gm|กรัม|kg|กก\.?|ml|มล\.?|ลิตร|l)\.?)\s*$/i))) { out.name = m[1].trim(); out.size = m[2].replace(/\s+/g, ' ').trim(); } else out.name = first;
      var bm = out.name.match(/^(.*?)\s*ตรา\s*(\S.*)$/); if (bm && !out.brand) { out.name = bm[1].trim(); out.brand = bm[2].trim(); }
    }
    // ส่วนผสม
    var hi = find(/ชื่อส่วนผสม/);
    if (hi) {
      var head = function (re) { for (var c = R.s.c; c <= R.e.c; c++) if (re.test(txt(hi.r, c))) return c; return -1; };
      var cW = head(/น้ำหนัก/), cP = head(/ราคา\s*\/\s*(กก|kg)/i);
      for (var r = hi.r + 1; r <= R.e.r; r++) {
        var nm = txt(r, hi.c);
        if (/น้ำหนักสินค้า|yield|บรรจุภัณฑ์/i.test(nm + ' ' + txt(r, R.s.c + 1) + ' ' + txt(r, R.s.c + 2))) break;
        if (!nm) { if (find(/น้ำหนักสินค้า|yield/i, r, r)) break; continue; }
        var qty = null, unit = 'กรัม';
        for (var c2 = cW < 0 ? hi.c + 1 : cW; c2 < (cP < 0 ? R.e.c : cP); c2++) { var q = num(cell(r, c2)); if (q != null) { qty = q; var un = txt(r, c2 + 1); if (un && un.length <= 20 && !/^[\d.,]+$/.test(un)) unit = normUnit(un); break; } }
        var price = cP >= 0 ? num(cell(r, cP)) : null;
        out.ingredients.push({ name: nm, qty: qty == null ? '' : qty, unit: unit, price: price == null ? '' : price });
      }
    }
    // Yield / Loss / จำนวนสินค้าที่ได้ — ตัวเลขตัวแรกทางขวา + หน่วยถัดไป
    [['yield', /น้ำหนักสินค้าที่ได้|yield/i], ['loss', /สูญเสีย|loss/i], ['out', /จำนวนสินค้าที่ได้/]].forEach(function (k) {
      var p = find(k[1], hi ? hi.r : 0); if (!p) return;
      for (var c = p.c + 1; c <= R.e.c; c++) { var v = num(cell(p.r, c)); if (v != null) { out[k[0] + 'Qty'] = v; var un = txt(p.r, c + 1); if (un && un.length < 15) out[k[0] + 'Unit'] = un; break; } }
    });
    // บรรจุภัณฑ์
    var hp = find(/ชื่อบรรจุภัณฑ์/);
    if (hp) {
      var cN = -1, cPr = -1;
      for (var c3 = R.s.c; c3 <= R.e.c; c3++) { var h = txt(hp.r, c3); if (/หมายเหตุ/.test(h)) cN = c3; if (/ราคา/.test(h)) cPr = c3; }
      for (var r2 = hp.r + 1; r2 <= R.e.r; r2++) {
        var pn = txt(r2, hp.c); if (!pn) continue;
        var pr = null;
        for (var c4 = cPr < 0 ? hp.c + 1 : cPr; c4 < (cN < 0 ? R.e.c + 1 : cN); c4++) { var pv = num(cell(r2, c4)); if (pv != null) { pr = pv; break; } }
        out.packaging.push({ name: pn, price: pr == null ? '' : pr, per: '', note: cN >= 0 ? txt(r2, cN) : '' });
      }
    }
    return out.name || out.ingredients.length ? out : null;
  }
  // รูปในชีต: อ่าน zip ของไฟล์ (SheetJS CFB) → drawing ของชีต → รูปที่วางทางขวา (คอลัมน์ ≥ 5) ที่ใหญ่ที่สุด
  function costSheetImage(XLSX, buf, sheetIdx) {
    try {
      var z = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
      var get = function (p) { for (var i = 0; i < z.FullPaths.length; i++) if (z.FullPaths[i].replace(/^Root Entry\//, '') === p) return z.FileIndex[i].content || null; return null; };
      var str = function (p) { var c = get(p); return c ? new TextDecoder().decode(c instanceof Uint8Array ? c : new Uint8Array(c)) : ''; };
      var wbx = str('xl/workbook.xml'), wbr = str('xl/_rels/workbook.xml.rels');
      var rids = []; wbx.replace(/<sheet\b[^>]*r:id="([^"]+)"/g, function (a, id) { rids.push(id); });
      var rel = function (xml, id) { var mm = xml.match(new RegExp('<Relationship\\b[^>]*Id="' + id + '"[^>]*Target="([^"]+)"')) || xml.match(new RegExp('<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="' + id + '"')); return mm ? mm[1] : ''; };
      var norm = function (base, t) { if (t.charAt(0) === '/') return t.slice(1); var parts = (base + t).split('/'), o = []; parts.forEach(function (p) { if (p === '..') o.pop(); else if (p && p !== '.') o.push(p); }); return o.join('/'); };
      var sheetPath = norm('xl/', rel(wbr, rids[sheetIdx] || 'x')); if (!sheetPath) return null;
      var sdir = sheetPath.replace(/[^\/]+$/, ''), srel = str(sdir + '_rels/' + sheetPath.split('/').pop() + '.rels');
      var dm = str(sheetPath).match(/<drawing\b[^>]*r:id="([^"]+)"/); if (!dm) return null;
      var dPath = norm(sdir, rel(srel, dm[1])), ddir = dPath.replace(/[^\/]+$/, ''), dxml = str(dPath), drel = str(ddir + '_rels/' + dPath.split('/').pop() + '.rels');
      var best = null;
      dxml.replace(/<xdr:(?:oneCellAnchor|twoCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:(?:oneCellAnchor|twoCellAnchor|absoluteAnchor)>/g, function (a) {
        var col = +((a.match(/<xdr:from>\s*<xdr:col>(\d+)<\/xdr:col>/) || [])[1] || 0), emb = (a.match(/r:embed="([^"]+)"/) || [])[1];
        if (!emb || col < 5) return a;
        var p = norm(ddir, rel(drel, emb)), data = get(p); if (!data) return a;
        if (!best || data.length > best.data.length) best = { data: data, name: p.split('/').pop() };
        return a;
      });
      if (!best) return null;
      var ext = best.name.split('.').pop().toLowerCase(), mime = ext === 'png' ? 'image/png' : /jpe?g/.test(ext) ? 'image/jpeg' : '';
      if (!mime) return null;
      return new Blob([best.data instanceof Uint8Array ? best.data : new Uint8Array(best.data)], { type: mime });
    } catch (e) { return null; }
  }

  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  function loadXlsx() {
    if (window.XLSX && window.XLSX.CFB) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, fail) { var sc = document.createElement('script'); sc.src = XLSX_URL; sc.onload = function () { ok(window.XLSX); }; sc.onerror = function () { fail(new Error('โหลดตัวอ่าน Excel ไม่ได้ — ตรวจอินเทอร์เน็ต')); }; document.head.appendChild(sc); });
  }
  function costImport(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /\.xlsx?$/i.test(f.name); });
    if (!files.length) return toast('เลือกไฟล์ Excel (.xlsx)');
    var btn = $('cImp'); if (btn) btn.classList.add('busy');
    loadXlsx().then(function (X) {
      return Promise.all(files.map(function (f) {
        return f.arrayBuffer().then(function (buf) {
          var wb = X.read(buf, { type: 'array' });
          return wb.SheetNames.map(function (sn, i) { var c = costParseSheet(X, wb.Sheets[sn]); if (!c) return null; c._file = f.name; c._sheet = sn; c._img = costSheetImage(X, buf, i); return c; }).filter(Boolean);
        }).catch(function () { return [{ _bad: f.name }]; });
      }));
    }).then(function (lists) {
      if (btn) btn.classList.remove('busy');
      var all = [].concat.apply([], lists), bad = all.filter(function (x) { return x._bad; }), ok = all.filter(function (x) { return !x._bad; });
      if (bad.length) toast('อ่านไฟล์ไม่ได้: ' + bad.map(function (x) { return x._bad; }).join(', '));
      if (!ok.length) { if (!bad.length) toast('ไม่พบข้อมูลต้นทุนในไฟล์ — ต้องมีหัวข้อ "ต้นทุนสินค้า" และตาราง "ชื่อส่วนผสม"'); return; }
      if (ok.length === 1) return openImported(ok[0]);
      wide({ icon: 'upload', title: 'พบ ' + ok.length + ' รายการในไฟล์', sub: 'เลือกรายการที่จะนำเข้า (ทีละรายการ ตรวจในฟอร์มก่อนบันทึก)', noOk: true, cancel: 'ปิด',
        body: '<div class="rcimpl">' + ok.map(function (c, i) {
          var r = costRows(c);
          return '<button type="button" class="rcimp" data-imp="' + i + '"><b>' + costTitle(c) + '</b><small>' + esc(c._file) + ' · ชีต ' + esc(c._sheet) + ' · ส่วนผสม ' + c.ingredients.length + ' · บรรจุภัณฑ์ ' + c.packaging.length + (c._img ? ' · มีรูป' : '') + '</small><span>วัตถุดิบ ' + baht(r.mat) + ' บาท</span></button>';
        }).join('') + '</div>',
        onOpen: function () { on('[data-imp]', 'click', function (el) { var c = ok[+el.getAttribute('data-imp')]; closeModal(); setTimeout(function () { openImported(c); }, 50); }, $('mBody')); } });
    }).catch(function (e) { if (btn) btn.classList.remove('busy'); toast(e.message || String(e)); });
  }
  // ชื่อ + ขนาดซ้ำกับรายการที่มี → ถามว่าจะอัปเดตรายการเดิม หรือเพิ่มเป็นรายการใหม่
  function openImported(c) {
    var key = function (x) { return (String(x.name || '') + '|' + String(x.size || '')).replace(/\s+/g, '').toLowerCase(); };
    var same = (H.data.costs || []).filter(function (x) { return key(x) === key(c); })[0];
    var go = function (id) {
      var img = c._img, x = { id: id || '', name: c.name || '', size: c.size || '', brand: c.brand || '', costDate: c.costDate || H.data.today, ingredients: c.ingredients, packaging: c.packaging,
        yieldQty: c.yieldQty, yieldUnit: c.yieldUnit || 'กรัม', lossQty: c.lossQty, lossUnit: c.lossUnit || 'กรัม', outQty: c.outQty, outUnit: c.outUnit || 'ซอง', productId: same && id ? same.productId : '', note: same && id ? same.note : '' };
      if (same && id) x.photo = same.photo;
      var open = function (pf) { costForm(x, false, { photoFile: pf, from: c._file }); };
      if (!img) return open(null);
      shrink(img).then(function (r) { open(r ? { b64: r.b64, name: 'รูปจากไฟล์.jpg', preview: 'data:image/jpeg;base64,' + r.b64 } : null); });
    };
    if (!same) return go('');
    // 3 ทาง (อัปเดต / เพิ่มใหม่ / ยกเลิก) — ปิดหน้าต่าง = ยกเลิก ไม่เพิ่มรายการโดยไม่ตั้งใจ
    openModal({ icon: 'warn', color: state.dept.color, title: 'มี "' + c.name + (c.size ? ' ' + c.size : '') + '" อยู่แล้ว', sub: 'อัปเดต ' + slashTh(same.costDate) + ' · จะใช้ข้อมูลจากไฟล์อย่างไร?', noOk: true, cancel: 'ยกเลิก',
      body: '<div class="rcdup"><button type="button" class="btn btn-primary" id="dUpd">อัปเดตรายการเดิม</button><button type="button" class="btn btn-line" id="dNew">เพิ่มเป็นรายการใหม่</button></div>',
      onOpen: function () {
        $('dUpd').addEventListener('click', function () { closeModal(); setTimeout(function () { go(same.id); }, 50); });
        $('dNew').addEventListener('click', function () { closeModal(); setTimeout(function () { go(''); }, 50); });
      } });
  }

  // ---- รายงานตามแบบไฟล์ (หน้าจอ + พิมพ์)
  function costSheet(c) {
    var r = costRows(c), logo = document.querySelector('.brand-logo');
    var minRows = function (n, cols) { var h = ''; for (var i = 0; i < n; i++) h += '<tr class="rcpe">' + new Array(cols + 1).join('<td></td>') + '</tr>'; return h; };
    return '<div class="rcp">'
      + '<div class="rcpu"><span>อัพเดท ' + slashTh(c.costDate) + '</span>' + (c.createdAt ? '<span class="rcpc">สร้างต้นทุนเมื่อ ' + slashTh(c.createdAt) + '</span>' : '') + '</div>'
      + '<div class="rcpb"><div class="rcph">'
      + '<div class="rcpl">' + (logo ? '<img src="' + logo.src + '" alt="">' : '') + '<div>บริษัท สปังกี้ฟู้ด จำกัด<br><span>Spunky Food Co., Ltd.</span></div></div>'
      + '<div class="rcpt">ต้นทุนสินค้า : ' + costTitle(c) + (c.brand ? '<br>ตรา' + esc(c.brand) : '') + '</div>'
      + '<div class="rcpi">' + (c.photo ? '<img src="' + esc(c.photo.url) + '=w600" alt="รูปสินค้า" crossorigin="anonymous">' : '<span>ภาพสินค้า</span>') + '</div></div>'
      + '<div class="rcpsec">ส่วนผสม</div>'
      + '<table class="rcpt1"><thead><tr><th class="n">No.</th><th>ชื่อส่วนผสม</th><th colspan="2">น้ำหนัก</th><th>ราคา/กก. รวม Vat</th><th>ราคารวม</th></tr></thead><tbody>'
      + r.ing.map(function (x, i) { return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td class="q">' + baht(x.qty, 0) + '</td><td class="u">' + esc(x.unit) + '</td><td class="m">' + baht(x.price) + (x.per !== 'กก.' && x.price !== '' && x.price != null ? '<small class="rcper"> /' + esc(x.per) + '</small>' : '') + '</td><td class="m">' + baht(x.cost) + '</td></tr>'; }).join('')
      + minRows(Math.max(0, 1 - r.ing.length), 6)
      + '<tr class="rcptot"><td></td><td></td><td class="q m">' + baht(r.grams, 0) + '</td><td class="u">กรัม</td><td></td><td class="m">' + baht(r.mat) + '</td></tr></tbody></table>'
      + '<table class="rcpy"><tr><td>น้ำหนักสินค้าที่ได้ Yield</td><td class="q">' + baht(c.yieldQty, 0) + '</td><td>' + esc(c.yieldUnit || 'กรัม') + '</td></tr>'
      + '<tr><td>น้ำหนักที่สูญเสีย Loss</td><td class="q">' + baht(c.lossQty, 0) + '</td><td>' + esc(c.lossUnit || 'กรัม') + '</td></tr>'
      + '<tr><td>จำนวนสินค้าที่ได้</td><td class="q">' + baht(c.outQty, 0) + '</td><td>' + esc(c.outUnit || 'ซอง') + '</td></tr></table>'
      + '<div class="rcpsec">บรรจุภัณฑ์</div>'
      + '<table class="rcpt2"><thead><tr><th class="n">No.</th><th>ชื่อบรรจุภัณฑ์</th><th>ราคา/ชิ้น รวม Vat</th><th>หมายเหตุ</th></tr></thead><tbody>'
      + r.pack.map(function (x, i) { return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td class="m c">' + baht(x.price) + '</td><td class="m">' + esc(x.note || '') + '</td></tr>'; }).join('')
      + minRows(Math.max(0, 4 - r.pack.length), 4) + '</tbody></table>'
      + (r.out ? '<table class="rcps"><tr><th colspan="2">สรุปต้นทุนต่อ 1 ' + esc(r.unit) + '</th></tr>'
        + '<tr><td>วัตถุดิบ (' + baht(r.mat) + ' ÷ ' + baht(r.out, 0) + ' ' + esc(r.unit) + ')</td><td class="m">' + baht(r.matUnit, 4) + '</td></tr>'
        + (r.packN ? '<tr><td>บรรจุภัณฑ์ (' + r.packN + ' รายการที่ระบุจำนวนต่อหน่วยราคา)</td><td class="m">' + baht(r.packUnit, 4) + '</td></tr>' : '')
        + '<tr class="t"><td>รวมต้นทุนต่อ 1 ' + esc(r.unit) + (r.packN < r.pack.length ? ' <small>(ยังไม่รวมบรรจุภัณฑ์ที่ไม่ได้ระบุจำนวน)</small>' : '') + '</td><td class="m">' + baht(r.total, 2) + ' บาท</td></tr></table>' : '')
      + (c.note ? '<div class="rcpn"><b>หมายเหตุ :</b> ' + esc(c.note).replace(/\n/g, '<br>') + '</div>' : '')
      + '</div></div>';
  }
  function costReport(c) {
    $('main').innerHTML = '<div class="rdh noprint"><button class="btn btn-line btn-sm" id="cBack">' + icon('back', 16) + ' ต้นทุนสินค้าทั้งหมด</button>'
      + '<button class="btn btn-line btn-sm" id="cEdit">' + icon('edit', 16) + ' แก้ไข</button>'
      + '<button class="btn btn-line btn-sm" id="cCopy">' + icon('copy', 16) + ' ทำสำเนาเป็นสินค้าใหม่</button>'
      + '<button class="btn btn-line btn-sm" id="cXls">' + icon('table', 16) + ' Excel ตามแบบ</button>'
      + '<button class="btn btn-primary btn-sm" id="cPrint">' + icon('print', 16) + ' พิมพ์ / PDF</button></div>'
      + '<div class="rcpwrap">' + costSheet(c) + '</div>';
    $('cBack').addEventListener('click', function () { H.q.costId = ''; costPage(); });
    $('cEdit').addEventListener('click', function () { costForm(c); });
    $('cCopy').addEventListener('click', function () { var x = JSON.parse(JSON.stringify(c)); delete x.id; x.photo = null; x.name = c.name + ' (สำเนา)'; x.costDate = H.data.today; costForm(x, true); });
    $('cPrint').addEventListener('click', printCost);
    $('cXls').addEventListener('click', function () { var b = this; b.disabled = true; costExcel(c).catch(function (e) { toast('สร้างไฟล์ Excel ไม่ได้: ' + (e && e.message || e)); }).then(function () { b.disabled = false; }); });
  }
  // พิมพ์เฉพาะแผ่นรายงาน (A4 แนวตั้ง) — ซ่อนเมนู / ปุ่มระหว่างพิมพ์
  function printCost() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('.rcp img'));
    Promise.all(imgs.map(function (im) { return im.complete ? 0 : new Promise(function (res) { im.onload = im.onerror = res; setTimeout(res, 4000); }); })).then(function () {
      document.body.classList.add('rcprint');
      var done = function () { document.body.classList.remove('rcprint'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1500);
    });
  }

  // ---- ฟอร์มกรอกต้นทุน
  function costForm(c0, isCopy, preset) {
    var isNew = !c0 || !c0.id, c = c0 ? JSON.parse(JSON.stringify(c0)) : { costDate: H.data.today, yieldUnit: 'กรัม', lossUnit: 'กรัม', outUnit: 'ซอง' };
    var ing = (c.ingredients || []).length ? c.ingredients : [{ name: '', qty: '', unit: 'กรัม', price: '' }];
    var pack = (c.packaging || []).length ? c.packaging : [{ name: '', price: '', per: '', note: '' }];
    var photoFile = preset && preset.photoFile || null, dropPhoto = false;
    var prods = H.data.products.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var I = function (id, label, v, ph, extra) { return '<div class="pf"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(v == null ? '' : v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '></div>'; };
    var N = function (id, v) { return '<input id="' + id + '" inputmode="decimal" value="' + esc(v == null ? '' : v) + '">'; };
    var body = '<div class="pform">'
      + '<div class="pf full"><label for="cN">ชื่อสินค้า *</label><input id="cN" value="' + esc(c.name || '') + '" maxlength="150" placeholder="เช่น พริกผัดน้ำมันมะกอกอัลมอนด์"></div>'
      + I('cSz', 'ขนาด', c.size, 'เช่น 15 g', ' maxlength="40"') + I('cBr', 'ตรา', c.brand, 'เช่น เอมโอชา', ' maxlength="60"')
      + '<div class="pf"><label for="cDt">วันที่อัพเดท</label><input type="date" id="cDt" value="' + esc(c.costDate || H.data.today) + '"></div>'
      + '<div class="pf"><label for="cP">ผลิตภัณฑ์ใหม่ที่เกี่ยวข้อง (ไม่บังคับ)</label><select id="cP"><option value="">— ไม่ผูก —</option>' + prods.map(function (p) { return '<option value="' + esc(p.id) + '"' + (c.productId === p.id ? ' selected' : '') + '>' + esc(p.code + ' ' + p.name) + '</option>'; }).join('') + '</select></div>'
      + '<div class="pf full"><label>รูปสินค้า</label><div class="rcph2"><div id="cPh" class="rcphv"></div><div class="rcphb">'
      + '<label class="btn btn-line btn-sm">' + icon('camera', 15) + ' ถ่ายรูป<input type="file" accept="image/*" capture="environment" id="cCam" hidden></label>'
      + '<label class="btn btn-line btn-sm">' + icon('image', 15) + ' เลือกรูป<input type="file" accept="image/*" id="cGal" hidden></label>'
      + '<button type="button" class="btn btn-line btn-sm" id="cPhDel">' + icon('trash', 15) + ' ลบรูป</button></div></div></div></div>'
      + '<h4 class="rch">ส่วนผสม <small>กรัม / กก. ใช้ราคาต่อ กก. · มล. / ลิตร ใช้ราคาต่อลิตร · หน่วยอื่นพิมพ์เองได้ (เช่น ฟอง) ใช้ราคาต่อหน่วยนั้น</small></h4><datalist id="cUnits">' + UNIT_OPTS.concat(usedUnits()).filter(function (u, i, a) { return a.indexOf(u) === i; }).map(function (u) { return '<option value="' + esc(u) + '">'; }).join('') + '</datalist><div id="cIng"></div>'
      + '<button type="button" class="btn btn-line btn-sm" id="cAddI">' + icon('plus', 15) + ' เพิ่มส่วนผสม</button>'
      + '<div class="pform rcyl"><div class="pf"><label for="cY">น้ำหนักสินค้าที่ได้ (Yield)</label><div class="rcu">' + N('cY', c.yieldQty) + '<input id="cYu" value="' + esc(c.yieldUnit || 'กรัม') + '" maxlength="20" aria-label="หน่วย"></div></div>'
      + '<div class="pf"><label for="cL">น้ำหนักที่สูญเสีย (Loss)</label><div class="rcu">' + N('cL', c.lossQty) + '<input id="cLu" value="' + esc(c.lossUnit || 'กรัม') + '" maxlength="20" aria-label="หน่วย"></div></div>'
      + '<div class="pf"><label for="cO">จำนวนสินค้าที่ได้</label><div class="rcu">' + N('cO', c.outQty) + '<input id="cOu" value="' + esc(c.outUnit || 'ซอง') + '" maxlength="20" aria-label="หน่วยสินค้า"></div></div></div>'
      + '<h4 class="rch">บรรจุภัณฑ์ <small>"ใช้ได้กี่ชิ้นสินค้า" ไม่บังคับ — ใส่แล้วระบบคิดต้นทุนบรรจุภัณฑ์ต่อชิ้นให้</small></h4><div id="cPk"></div>'
      + '<button type="button" class="btn btn-line btn-sm" id="cAddP">' + icon('plus', 15) + ' เพิ่มบรรจุภัณฑ์</button>'
      + '<div class="pform" style="margin-top:12px"><div class="pf full"><label for="cNt">หมายเหตุ</label><textarea id="cNt" rows="2" maxlength="1000">' + esc(c.note || '') + '</textarea></div></div>'
      + '<div class="rcsum" id="cSum"></div>'
      + (!isNew ? '<div style="margin-top:12px"><button type="button" class="btn btn-line btn-sm rdel" id="cDel">' + icon('trash', 15) + ' ลบรายการนี้</button></div>' : '');
    // ราคาจากฝ่ายจัดซื้อ & สต๊อก: พิมพ์ชื่อส่วนผสม → ผู้ขายทุกรายที่ขายของชื่อใกล้เคียง → เลือก = ใส่ราคา/กก. ให้ (ผู้ใช้ขอ 24/11/69)
    var PUR_ITEMS = (H.data.pur && H.data.pur.items) || [], SUG = [];
    var nrm = function (t) { return String(t || '').replace(/[\sัิ-ฺ็-๎().,\-]/g, '').toLowerCase(); };
    // ราคาจากผู้ขาย → ราคาตามหน่วยของแถว (ต่อ กก. / ต่อลิตร / ต่อหน่วยเดียวกัน)
    var perKg = perKgOf;
    // บรรจุภัณฑ์ (ผู้ใช้ 24/11/69): ราคาต่อหน่วยของผู้ขาย (ม้วน / ใบ / ชิ้น) ใช้ตามนั้น · หน่วยน้ำหนักให้ตรวจ
    var perPc = function (x) {
      var u = String(x.unit || '').trim().toLowerCase().replace(/\.$/, '');
      if (!u || /^(ชิ้น|pc|pcs|piece)$/.test(u)) return { price: x.price, note: '' };
      if (/^(กก|กิโล|กิโลกรัม|kg|kgs|กรัม|ก|g|gm|gram)$/.test(u)) return { price: x.price, note: 'ราคาต่อ ' + x.unit + ' — ตรวจหน่วย' };
      return { price: x.price, note: 'ราคาต่อ ' + x.unit };
    };
    // k = 'i' ส่วนผสม / 'p' บรรจุภัณฑ์ · คีย์แถว = 'i:3' / 'p:0'
    var KD = { i: { rows: function () { return ing; }, attr: 'data-ci', conv: perKg, draw: function () { drawIng(); } },
      p: { rows: function () { return pack; }, attr: 'data-cp', conv: perPc, draw: function () { drawPk(); } } };
    function priceHint(u, plain) { var p = uinfo(u).per; return plain ? 'ราคาต่อ ' + p : (PUR_ITEMS.length ? 'แตะเลือกผู้ขาย' : 'ราคา/' + p); }
    var vendLine = function (x, key) {
      return x.vendor || x.pnote ? '<div class="rcvend">' + (x.vendor ? 'ผู้ขาย <b>' + esc(x.vendor) + '</b>' : '') + (x.pnote ? ' <span class="' + (/ตรวจ/.test(x.pnote) ? 'warn' : '') + '">· ' + esc(x.pnote) + '</span>' : '') + ' <button type="button" class="rcx sm" data-vclr="' + key + '" >✕ ล้างผู้ขาย</button></div>' : '';
    };
    // ผู้ใช้ 24/11/69: คนคีย์ชื่อกับคนคีย์ราคาเป็นคนละคน → รายชื่อผู้ขายขึ้นที่ช่องราคา (ค้นจากชื่อในแถว แก้คำค้นได้)
    var sugHide = function (key) { var b = document.querySelector('[data-sug="' + key + '"]'); if (b) b.hidden = true; };
    var sugList = function (key, text) {
      var box = document.querySelector('[data-sug="' + key + '"]'), L = box && box.querySelector('.rcsl'); if (!L) return;
      var row0 = KD[key.charAt(0)].rows()[+key.slice(2)] || {}, conv0 = KD[key.charAt(0)].conv, conv = function (x) { return conv0(x, row0.unit); };
      var n = nrm(text), words = String(text || '').split(/\s+/).map(nrm).filter(function (w) { return w.length > 1; });
      var hits = !n ? [] : PUR_ITEMS.map(function (x) {
        var m = nrm(x.name); var sc = m === n ? 0 : m.indexOf(n) === 0 ? 1 : m.indexOf(n) >= 0 ? 2 : n.indexOf(m) >= 0 && m.length > 1 ? 3 : words.some(function (w) { return m.indexOf(w) >= 0; }) ? 4 : 9; return { x: x, sc: sc };
      }).filter(function (h) { return h.sc < 9; }).sort(function (a, b) { return a.sc - b.sc || String(a.x.name).localeCompare(String(b.x.name)) || conv(a.x).price - conv(b.x).price; }).slice(0, 12);
      SUG = hits.map(function (h) { return h.x; });
      if (!n) { L.innerHTML = '<div class="rcsn">พิมพ์ชื่อสินค้าในช่องค้นหาด้านบน หรือพิมพ์ราคาเองในช่องราคา</div>'; return; }
      if (!hits.length) { L.innerHTML = '<div class="rcsn">ไม่พบ "' + esc(text) + '" ในฝ่ายจัดซื้อ — ลองคำอื่นในช่องค้นหา หรือพิมพ์ราคาเองในช่องราคา</div>'; return; }
      // ถูกสุด = เทียบเฉพาะหน่วยเดียวกัน (ส่วนผสมแปลงเป็นต่อ กก. แล้ว)
      var low = {};
      SUG.forEach(function (x) { var u = key.charAt(0) === 'i' && !/ตรวจ/.test(conv(x).note) ? 'row' : String(x.unit || ''); var v = conv(x).price; if (low[u] == null || v < low[u].v) low[u] = { v: v, n: (low[u] ? low[u].n : 0) + 1 }; else low[u].n++; });
      L.innerHTML = '<div class="rcsh2">พบ ' + hits.length + ' รายการ — แตะเพื่อใส่ราคา</div>' + SUG.map(function (x, k) {
        var u = key.charAt(0) === 'i' && !/ตรวจ/.test(conv(x).note) ? 'row' : String(x.unit || ''), lw = low[u];
        return '<button type="button" class="rcsi" data-pick="' + key + ':' + k + '"><span><b>' + esc(x.vendor || 'ไม่ระบุผู้ขาย') + '</b><small>' + esc(x.name) + (x.date ? ' · ราคาวันที่ ' + slashTh(x.date) : '') + '</small></span>'
          + '<em>' + baht(x.price) + ' / ' + esc(x.unit || 'หน่วย') + (lw && lw.n > 1 && conv(x).price === lw.v ? ' <i>ถูกสุด</i>' : '') + '</em></button>';
      }).join('');
    };
    var showSug = function (key) {
      var box = document.querySelector('[data-sug="' + key + '"]'); if (!box) return;
      document.querySelectorAll('.rcsug').forEach(function (b) { if (b !== box) b.hidden = true; });
      if (!PUR_ITEMS.length) { box.hidden = true; return; }
      var row = KD[key.charAt(0)].rows()[+key.slice(2)] || {};
      if (box.hidden || !box.querySelector('.rcsl')) {
        box.innerHTML = '<div class="rcsh"><span>ผู้ขายจากฝ่ายจัดซื้อ</span><input data-sq="' + key + '" value="' + esc(row.name || '') + '" placeholder="ค้นหาชื่อสินค้า" autocomplete="off" aria-label="ค้นหาชื่อสินค้าในฝ่ายจัดซื้อ"><button type="button" class="rcx sm" data-sclose="' + key + '">ปิด</button></div><div class="rcsl"></div>';
        sugList(key, row.name);
      }
      box.hidden = false;
    };
    var applyPick = function (key, x) {
      if (!x) return; var K = KD[key.charAt(0)], r = K.rows()[+key.slice(2)], pk = K.conv(x, r && r.unit), diff;
      if (!r) return;
      if (!String(r.name || '').trim()) r.name = x.name;
      diff = nrm(x.name) !== nrm(r.name);
      r.price = pk.price; r.vendor = x.vendor || '';
      r.pnote = (diff ? 'สินค้า: ' + x.name : '') + (pk.note ? (diff ? ' · ' : '') + pk.note : '');
      K.draw(); toast('ใส่ราคาจาก ' + (x.vendor || 'ฝ่ายจัดซื้อ') + ' แล้ว');
    };
    var drawIng = function () {
      $('cIng').innerHTML = '<div class="rci rcih"><span>#</span><span>ชื่อส่วนผสม</span><span>ปริมาณ</span><span>หน่วย</span><span>ราคา รวม VAT</span><span>ราคารวม</span><span></span></div>'
        + ing.map(function (x, i) {
          return '<div class="rcirow"><div class="rci"><span class="n">' + (i + 1) + '</span><input data-ci="' + i + ':name" value="' + esc(x.name || '') + '" placeholder="ชื่อส่วนผสม" aria-label="ชื่อส่วนผสม ' + (i + 1) + '">'
            + '<input data-ci="' + i + ':qty" inputmode="decimal" value="' + esc(x.qty == null ? '' : x.qty) + '" placeholder="ปริมาณ" aria-label="ปริมาณ">'
            + '<input data-ci="' + i + ':unit" list="cUnits" value="' + esc(x.unit || 'กรัม') + '" autocomplete="off" aria-label="หน่วย (เลือกหรือพิมพ์เอง)" class="rcunit">'
            + '<input data-ci="' + i + ':price" inputmode="decimal" value="' + esc(x.price == null ? '' : x.price) + '" placeholder="' + priceHint(x.unit) + '" autocomplete="off" aria-label="' + esc(priceHint(x.unit, true)) + ' รวม VAT (แตะเพื่อเลือกผู้ขาย)">'
            + '<span class="m" data-cc="' + i + '" aria-label="ราคารวม"></span><button type="button" class="rcx" data-cdel="' + i + '" aria-label="ลบแถว">✕</button></div>'
            + '<div class="rcsug" data-sug="i:' + i + '" hidden></div>' + vendLine(x, 'i:' + i) + '</div>';
        }).join('') + '<div class="rci rcit"><span></span><span>รวม</span><span id="cTg"></span><span>กรัม</span><span></span><span class="m" id="cTm"></span><span></span></div>';
      recalc();
    };
    var drawPk = function () {
      $('cPk').innerHTML = '<div class="rcp2 rcih"><span>#</span><span>ชื่อบรรจุภัณฑ์</span><span>ราคา/ชิ้น รวม VAT</span><span>ใช้ได้กี่ชิ้นสินค้า</span><span>หมายเหตุ</span><span></span></div>'
        + pack.map(function (x, i) {
          return '<div class="rcirow"><div class="rcp2"><span class="n">' + (i + 1) + '</span><input data-cp="' + i + ':name" value="' + esc(x.name || '') + '" placeholder="ชื่อบรรจุภัณฑ์" aria-label="ชื่อบรรจุภัณฑ์ ' + (i + 1) + '">'
            + '<input data-cp="' + i + ':price" inputmode="decimal" value="' + esc(x.price == null ? '' : x.price) + '" placeholder="' + (PUR_ITEMS.length ? 'แตะเลือกผู้ขาย' : 'ราคา/ชิ้น') + '" autocomplete="off" aria-label="ราคาต่อชิ้น รวม VAT (แตะเพื่อเลือกผู้ขาย)">'
            + '<input data-cp="' + i + ':per" inputmode="decimal" value="' + esc(x.per == null ? '' : x.per) + '" placeholder="เช่น 4900" aria-label="ใช้ได้กี่ชิ้นสินค้า">'
            + '<input data-cp="' + i + ':note" value="' + esc(x.note || '') + '" placeholder="เช่น 1 ม้วน มี 4900 ซอง" aria-label="หมายเหตุ">'
            + '<button type="button" class="rcx" data-pdel="' + i + '" aria-label="ลบแถว">✕</button></div>'
            + '<div class="rcsug" data-sug="p:' + i + '" hidden></div>' + vendLine(x, 'p:' + i) + '</div>';
        }).join('');
      recalc();
    };
    var cur = function () {
      return { ingredients: ing, packaging: pack, outQty: $('cO') ? $('cO').value.replace(/,/g, '') : c.outQty, outUnit: $('cOu') ? $('cOu').value.trim() || 'ซอง' : c.outUnit };
    };
    var recalc = function () {
      if (!$('cSum')) return;
      var r = costRows(cur());
      r.ing.forEach(function (x, i) { var e = document.querySelector('[data-cc="' + i + '"]'); if (e) e.textContent = x.cost ? baht(x.cost) : ''; });
      if ($('cTg')) $('cTg').textContent = baht(r.grams, 0); if ($('cTm')) $('cTm').textContent = baht(r.mat);
      $('cSum').innerHTML = (r.noPrice ? '<div class="w"><span>ยังไม่ได้ใส่ราคา ' + r.noPrice + ' รายการ — บันทึกไว้ก่อนได้ แล้วค่อยเติมราคาทีหลัง</span></div>' : '') + '<div><span>ราคาวัตถุดิบรวม</span><b>' + baht(r.mat) + ' บาท</b></div>'
        + (r.out ? '<div><span>วัตถุดิบต่อ 1 ' + esc(r.unit) + '</span><b>' + baht(r.matUnit, 4) + '</b></div>'
          + '<div><span>บรรจุภัณฑ์ต่อ 1 ' + esc(r.unit) + (r.packN && r.packN < r.pack.filter(function (x) { return x.name || x.price; }).length ? ' <small>(เฉพาะที่ใส่จำนวน)</small>' : '') + '</span>' + (r.packN ? '<b>' + baht(r.packUnit, 4) + '</b>' : '<small class="muted">ใส่ "ใช้ได้กี่ชิ้นสินค้า" เพื่อคิดรวม</small>') + '</div>'
          + '<div class="t"><span>รวมต้นทุนต่อ 1 ' + esc(r.unit) + '</span><b>' + baht(r.total) + ' บาท</b></div>' : '<div class="muted">ใส่ "จำนวนสินค้าที่ได้" เพื่อดูต้นทุนต่อชิ้น</div>');
    };
    var showPhoto = function () {
      var src = photoFile ? photoFile.preview : (!dropPhoto && c.photo ? c.photo.url + '=w300' : '');
      $('cPh').innerHTML = src ? '<img src="' + esc(src) + '" alt="รูปสินค้า">' : '<span>ยังไม่มีรูป</span>';
      $('cPhDel').hidden = !src;
    };
    var pick = function (inp) {
      var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      shrink(f).then(function (x) { if (!x) return toast('อ่านรูปไม่ได้'); photoFile = { b64: x.b64, name: x.name, preview: 'data:image/jpeg;base64,' + x.b64 }; dropPhoto = false; showPhoto(); });
    };
    if (preset && preset.from) body = '<div class="rcfrom">' + icon('upload', 16) + ' อ่านจากไฟล์ <b>' + esc(preset.from) + '</b> — ตรวจข้อมูลแล้วกด "บันทึก"' + (isNew ? '' : ' (จะอัปเดตรายการเดิม)') + '</div>' + body;
    wide({ icon: 'coin', title: preset && preset.from ? (isNew ? 'นำเข้าต้นทุนจากไฟล์' : 'อัปเดตต้นทุนจากไฟล์') : isNew ? (isCopy ? 'ต้นทุนสินค้า (สำเนา)' : 'เพิ่มต้นทุนสินค้า') : 'แก้ไขต้นทุน · ' + c.name, ok: 'บันทึก', body: body,
      onOpen: function () {
        drawIng(); drawPk(); showPhoto();
        $('cIng').addEventListener('input', function (e) {
          var a = (e.target.getAttribute('data-ci') || '').split(':'); if (a.length < 2) return;
          ing[+a[0]][a[1]] = a[1] === 'name' || a[1] === 'unit' ? e.target.value : e.target.value.replace(/,/g, '').trim();
          if (a[1] === 'price') { ing[+a[0]].pnote = ''; sugHide('i:' + a[0]); }
          if (a[1] === 'unit') { var pr = document.querySelector('[data-ci="' + a[0] + ':price"]'); if (pr) { pr.placeholder = priceHint(e.target.value); pr.setAttribute('aria-label', priceHint(e.target.value, true) + ' รวม VAT (แตะเพื่อเลือกผู้ขาย)'); } }
          recalc();
        });
        $('cPk').addEventListener('input', function (e) {
          var a = (e.target.getAttribute('data-cp') || '').split(':'); if (a.length < 2) return;
          pack[+a[0]][a[1]] = a[1] === 'name' || a[1] === 'note' ? e.target.value : e.target.value.replace(/,/g, '').trim();
          if (a[1] === 'price') { pack[+a[0]].pnote = ''; sugHide('p:' + a[0]); }
          recalc();
        });
        // ช่องราคา → เปิดรายชื่อผู้ขาย (ใช้ร่วมกันทั้งส่วนผสม / บรรจุภัณฑ์)
        var priceKey = function (el) { var t = el.getAttribute('data-ci') ? 'i' : el.getAttribute('data-cp') ? 'p' : ''; if (!t) return ''; var a = el.getAttribute('data-c' + t).split(':'); return a[1] === 'price' ? t + ':' + a[0] : ''; };
        var inBox = function (key) { setTimeout(function () { var b = document.querySelector('[data-sug="' + key + '"]'), pr = document.querySelector('[' + KD[key.charAt(0)].attr + '="' + key.slice(2) + ':price"]'); if (b && !b.contains(document.activeElement) && document.activeElement !== pr) b.hidden = true; }, 200); };
        ['cIng', 'cPk'].forEach(function (id) {
          var el = $(id);
          el.addEventListener('input', function (e) { var q = e.target.getAttribute('data-sq'); if (q != null) sugList(q, e.target.value); });
          el.addEventListener('focusin', function (e) { var k = priceKey(e.target); if (k) showSug(k); });
          el.addEventListener('focusout', function (e) { var k = priceKey(e.target) || e.target.getAttribute('data-sq'); if (k) inBox(k); });
          el.addEventListener('keydown', function (e) { var k = priceKey(e.target) || e.target.getAttribute('data-sq'); if (k && e.key === 'Escape') sugHide(k); });
          el.addEventListener('mousedown', function (e) { if (e.target.closest('[data-pick]')) e.preventDefault(); });
          el.addEventListener('click', function (e) {
            var pk = e.target.closest('[data-pick]');
            if (pk) { var ab = pk.getAttribute('data-pick').split(':'); applyPick(ab[0] + ':' + ab[1], SUG[+ab[2]]); return; }
            var sc = e.target.closest('[data-sclose]'); if (sc) { sugHide(sc.getAttribute('data-sclose')); return; }
            var vx = e.target.closest('[data-vclr]');
            if (vx) { var vk = vx.getAttribute('data-vclr'), K = KD[vk.charAt(0)], r = K.rows()[+vk.slice(2)]; if (r) { r.vendor = ''; r.pnote = ''; } K.draw(); return; }
          });
        });
        $('cIng').addEventListener('change', function (e) { var a = (e.target.getAttribute('data-ci') || '').split(':'); if (a[1] === 'unit') { var nu = normUnit(e.target.value); ing[+a[0]].unit = nu; e.target.value = nu; recalc(); } });
        $('cIng').addEventListener('click', function (e) { var b = e.target.closest('[data-cdel]'); if (!b) return; ing.splice(+b.getAttribute('data-cdel'), 1); if (!ing.length) ing.push({ name: '', qty: '', unit: 'กรัม', price: '' }); drawIng(); });
        $('cPk').addEventListener('click', function (e) { var b = e.target.closest('[data-pdel]'); if (!b) return; pack.splice(+b.getAttribute('data-pdel'), 1); if (!pack.length) pack.push({ name: '', price: '', per: '', note: '' }); drawPk(); });
        $('cAddI').addEventListener('click', function () { ing.push({ name: '', qty: '', unit: 'กรัม', price: '' }); drawIng(); var a = document.querySelectorAll('[data-ci$=":name"]'); a[a.length - 1].focus(); });
        $('cAddP').addEventListener('click', function () { pack.push({ name: '', price: '', per: '', note: '' }); drawPk(); var a = document.querySelectorAll('[data-cp$=":name"]'); a[a.length - 1].focus(); });
        ['cO', 'cOu'].forEach(function (id) { $(id).addEventListener('input', recalc); });
        $('cCam').addEventListener('change', function () { pick(this); });
        $('cGal').addEventListener('change', function () { pick(this); });
        $('cPhDel').addEventListener('click', function () { photoFile = null; dropPhoto = true; showPhoto(); });
        if ($('cDel')) $('cDel').addEventListener('click', function () {
          ask({ title: 'ลบต้นทุน "' + c.name + '"?', text: 'ข้อมูลและรูปสินค้าของรายการนี้จะหายไป กู้คืนไม่ได้', ok: 'ลบ', tone: 'danger' }).then(function (ok) {
            if (!ok) return;
            call('rdDeleteCost', state.token, c.id).then(function (r) { if (!r.ok) return toast(r.error); H.data.costs = H.data.costs.filter(function (x) { return x.id !== c.id; }); H.q.costId = ''; closeModal(); toast('ลบแล้ว'); costPage(); }).catch(onServerError);
          });
        });
      },
      submit: function () {
        var o = { id: isNew ? '' : c.id, name: $('cN').value.trim(), size: $('cSz').value.trim(), brand: $('cBr').value.trim(), costDate: $('cDt').value, productId: $('cP').value,
          ingredients: ing.filter(function (x) { return String(x.name || '').trim() || x.qty !== '' || x.price !== ''; }),
          packaging: pack.filter(function (x) { return String(x.name || '').trim() || x.price !== ''; }),
          yieldQty: $('cY').value.replace(/,/g, ''), yieldUnit: $('cYu').value.trim(), lossQty: $('cL').value.replace(/,/g, ''), lossUnit: $('cLu').value.trim(),
          outQty: $('cO').value.replace(/,/g, ''), outUnit: $('cOu').value.trim(), note: $('cNt').value };
        if (!o.name) { $('cN').focus(); return Promise.resolve('กรอกชื่อสินค้า'); }
        if (o.ingredients.some(function (x) { return !String(x.name || '').trim(); })) return Promise.resolve('ส่วนผสมทุกแถวต้องมีชื่อ');
        if (o.packaging.some(function (x) { return !String(x.name || '').trim(); })) return Promise.resolve('บรรจุภัณฑ์ทุกแถวต้องมีชื่อ');
        var bad = o.ingredients.concat(o.packaging).some(function (x) { return ['qty', 'price', 'per'].some(function (k) { return x[k] !== undefined && x[k] !== '' && isNaN(Number(x[k])); }); });
        if (bad || ['yieldQty', 'lossQty', 'outQty'].some(function (k) { return o[k] !== '' && isNaN(Number(o[k])); })) return Promise.resolve('ช่องตัวเลขมีตัวอักษรปน — ใส่เป็นตัวเลขเท่านั้น');
        return call('rdSaveCost', state.token, o).then(function (r) {
          if (!r.ok) return r.error;
          var saved = r.cost;
          var after = function () { H.data.costs = H.data.costs || []; upsert(H.data.costs, saved); closeModal(); toast('บันทึกแล้ว'); H.q.costId = saved.id; window.scrollTo(0, 0); costPage(); };
          if (photoFile) return call('rdUploadCostPhoto', state.token, saved.id, photoFile.name, 'image/jpeg', photoFile.b64).then(function (p) { if (p.ok) saved.photo = p.photo; else toast(p.error); after(); });
          if (dropPhoto && saved.photo) return call('rdRemoveCostPhoto', state.token, saved.id).then(function () { saved.photo = null; after(); });
          return after();
        });
      } });
  }

  // ==================== Excel ตามแบบไฟล์ต้นทุน (ExcelJS) ====================
  var XJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  function loadXjs() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (ok, fail) { var sc = document.createElement('script'); sc.src = XJS_URL; sc.onload = ok; sc.onerror = function () { fail(new Error('โหลดตัวสร้าง Excel ไม่ได้')); }; document.head.appendChild(sc); });
  }
  function imgB64(src) {
    if (!src) return Promise.resolve(null);
    if (/^data:image\//.test(src)) return Promise.resolve({ b64: src.split(',')[1], ext: /png/.test(src.slice(0, 20)) ? 'png' : 'jpeg' });
    return fetch(src).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) {
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok({ b64: String(fr.result).split(',')[1], ext: /png/.test(b.type) ? 'png' : 'jpeg' }); }; fr.onerror = function () { ok(null); }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
  }
  function costExcel(c) {
    var r = costRows(c), logo = document.querySelector('.brand-logo');
    return Promise.all([loadXjs(), imgB64(logo && logo.src), imgB64(c.photo ? c.photo.url + '=w600' : '')]).then(function (res) {
      var lg = res[1], ph = res[2];
      var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('ต้นทุนสินค้า', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } } });
      var F = function (o) { return Object.assign({ name: 'Angsana New', size: 16 }, o || {}); };
      [4, 6, 7, 5, 9, 8, 11, 9, 10, 9, 8, 18, 19, 4].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
      var G = { style: 'thin', color: { argb: 'FF70AD47' } }, box = { top: G, left: G, bottom: G, right: G };
      var put = function (ref, v, o) { var cl = ws.getCell(ref); cl.value = v; cl.font = F(o && o.font); if (o && o.al) cl.alignment = o.al; if (o && o.fill) cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } }; if (o && o.fmt) cl.numFmt = o.fmt; if (o && o.border) cl.border = o.border; return cl; };
      var RED = { color: { argb: 'FFFF0000' } };
      // แถว 1: อัพเดท (แดง) · สร้างต้นทุนเมื่อ (ขวา)
      ws.mergeCells('B1:H1'); put('B1', 'อัพเดท ' + slashTh(c.costDate), { font: { size: 18, bold: true, color: { argb: 'FFFF0000' } } });
      ws.mergeCells('I1:M1'); put('I1', c.createdAt ? 'สร้างต้นทุนเมื่อ ' + slashTh(c.createdAt) : '', { font: { size: 16, bold: true }, al: { horizontal: 'right' } });
      ws.getRow(1).height = 27; ws.getRow(2).height = 70; ws.getRow(3).height = 60;
      ws.mergeCells('D2:F3'); put('D2', 'บริษัท สปังกี้ฟู้ด จำกัด\nSpunky Food  Co., Ltd.', { al: { vertical: 'middle', wrapText: true } });
      ws.mergeCells('G2:K3'); put('G2', 'ต้นทุนสินค้า  : ' + c.name + (c.size ? '  ' + c.size : '') + (c.brand ? '\nตรา' + c.brand : ''), { font: { size: 18, bold: true }, al: { horizontal: 'center', vertical: 'middle', wrapText: true } });
      ws.mergeCells('L2:M3');
      if (lg) ws.addImage(wb.addImage({ base64: lg.b64, extension: lg.ext }), { tl: { col: 1.15, row: 1.2 }, ext: { width: 64, height: 64 } });
      if (ph) ws.addImage(wb.addImage({ base64: ph.b64, extension: ph.ext }), { tl: { col: 11.3, row: 1.1 }, ext: { width: 150, height: 160 } });
      // ส่วนผสม
      put('C4', 'ส่วนผสม', { font: { bold: true, color: { argb: 'FFFF0000' } } });
      var hd = function (row, cells, fill) { cells.forEach(function (c2) { if (c2[2]) ws.mergeCells(c2[0] + row + ':' + c2[2] + row); put(c2[0] + row, c2[1], { font: { bold: true }, al: { horizontal: 'center', vertical: 'middle' }, fill: fill, border: box }); if (c2[2]) ws.getCell(c2[2] + row).border = box; }); };
      hd(5, [['C', 'No.'], ['D', 'ชื่อส่วนผสม', 'G'], ['H', 'น้ำหนัก', 'K'], ['L', 'ราคา/กก รวม Vat'], ['M', 'ราคารวม']], 'FFC6E0B4');
      var row = 6, first = row;
      r.ing.forEach(function (x, i) {
        put('C' + row, i + 1, { al: { horizontal: 'center' } }); ws.mergeCells('D' + row + ':G' + row); put('D' + row, x.name);
        put('I' + row, x.qty === '' || x.qty == null ? null : Number(x.qty), { al: { horizontal: 'right' } }); put('J' + row, x.unit);
        put('L' + row, x.price === '' || x.price == null ? null : Number(x.price), { font: RED, fmt: '#,##0.00', al: { horizontal: 'center' } });
        put('M' + row, { formula: x.kind === 'o' ? 'L' + row + '*I' + row : '(L' + row + '/1000)*I' + row + (x.unit === 'กก.' || x.unit === 'ลิตร' ? '*1000' : ''), result: x.cost }, { font: RED, fmt: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)', al: { horizontal: 'center' } });
        row++;
      });
      var last = row - 1; row++;
      put('I' + row, { formula: 'SUMPRODUCT(I' + first + ':I' + last + ',(J' + first + ':J' + last + '="กก.")*1000+(J' + first + ':J' + last + '="กรัม"))', result: r.grams }, { font: RED, al: { horizontal: 'center' }, fmt: '#,##0' }); put('J' + row, 'กรัม');
      put('M' + row, { formula: 'SUM(M' + first + ':M' + last + ')', result: r.mat }, { font: RED, fmt: '#,##0.00', al: { horizontal: 'center' } });
      for (var rr = 5; rr <= row; rr++) ['C', 'D', 'H', 'L', 'M'].forEach(function (col) { var cl = ws.getCell(col + rr); cl.border = Object.assign({}, cl.border || {}, { left: G }); });
      for (var rr2 = 5; rr2 <= row; rr2++) { var cr = ws.getCell('M' + rr2); cr.border = Object.assign({}, cr.border || {}, { right: G }); }
      ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach(function (col) { var cl = ws.getCell(col + row); cl.border = Object.assign({}, cl.border || {}, { bottom: G }); });
      row++;
      [['น้ำหนักสินค้าที่ได้  Yield', c.yieldQty, c.yieldUnit || 'กรัม'], ['น้ำหนักที่สูญเสีย Loss', c.lossQty, c.lossUnit || 'กรัม'], ['จำนวนสินค้าที่ได้', c.outQty, c.outUnit || 'ซอง']].forEach(function (y) {
        put('C' + row, y[0]); put('G' + row, y[1] === '' || y[1] == null ? null : Number(y[1]), { fmt: '#,##0', al: { horizontal: 'left' } }); put('H' + row, y[2]); row++;
      });
      row++;
      put('C' + row, 'บรรจุภัณฑ์', { font: { bold: true, color: { argb: 'FFFF0000' } } }); row++;
      hd(row, [['C', 'No.'], ['D', 'ชื่อบรรจุภัณฑ์', 'G'], ['H', 'ราคา/ชิ้น รวม Vat', 'K'], ['L', 'หมายเหตุ', 'M']], 'FFE2EFDA'); var ph1 = row; row++;
      r.pack.forEach(function (x, i) {
        put('C' + row, i + 1, { al: { horizontal: 'center' } }); ws.mergeCells('D' + row + ':G' + row); put('D' + row, x.name);
        ws.mergeCells('H' + row + ':K' + row); put('H' + row, x.price === '' || x.price == null ? null : Number(x.price), { font: RED, fmt: '#,##0.00', al: { horizontal: 'center' } });
        ws.mergeCells('L' + row + ':M' + row); put('L' + row, x.note || '', { font: RED });
        row++;
      });
      for (var k = 0; k < Math.max(0, 4 - r.pack.length); k++) row++;
      for (var rr3 = ph1; rr3 < row; rr3++) { ['C', 'D', 'H', 'L'].forEach(function (col) { var cl = ws.getCell(col + rr3); cl.border = Object.assign({}, cl.border || {}, { left: G }); }); var cm = ws.getCell('M' + rr3); cm.border = Object.assign({}, cm.border || {}, { right: G }); }
      ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach(function (col) { var cl = ws.getCell(col + (row - 1)); cl.border = Object.assign({}, cl.border || {}, { bottom: G }); });
      if (r.out) {
        row++;
        put('C' + row, 'สรุปต้นทุนต่อ 1 ' + r.unit, { font: { bold: true } }); row++;
        put('C' + row, 'วัตถุดิบ (' + baht(r.mat) + ' ÷ ' + baht(r.out, 0) + ' ' + r.unit + ')'); put('M' + row, Math.round(r.matUnit * 10000) / 10000, { font: RED, fmt: '#,##0.0000' }); row++;
        if (r.packN) { put('C' + row, 'บรรจุภัณฑ์ (' + r.packN + ' รายการที่ระบุจำนวนต่อหน่วยราคา)'); put('M' + row, Math.round(r.packUnit * 10000) / 10000, { font: RED, fmt: '#,##0.0000' }); row++; }
        put('C' + row, 'รวมต้นทุนต่อ 1 ' + r.unit + (r.packN < r.pack.length ? ' (ยังไม่รวมบรรจุภัณฑ์ที่ไม่ได้ระบุจำนวน)' : ''), { font: { bold: true } }); put('M' + row, Math.round(r.total * 100) / 100, { font: { bold: true, color: { argb: 'FFFF0000' } }, fmt: '#,##0.00' }); row++;
      }
      // กรอบเขียวรอบหัวกระดาษ (แถว 2–3) และทั้งแผ่น (B2 ถึงแถวสุดท้าย)
      for (var rb = 2; rb <= row; rb++) { var lb = ws.getCell('B' + rb); lb.border = Object.assign({}, lb.border || {}, { left: G }); var rbx = ws.getCell('N' + rb); rbx.border = Object.assign({}, rbx.border || {}, { right: G }); }
      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(function (col) { var t = ws.getCell(col + '2'); t.border = Object.assign({}, t.border || {}, { top: G }); var b3 = ws.getCell(col + '3'); b3.border = Object.assign({}, b3.border || {}, { bottom: G }); var bl = ws.getCell(col + row); bl.border = Object.assign({}, bl.border || {}, { bottom: G }); });
      ws.pageSetup.printArea = 'A1:N' + row;
      return wb.xlsx.writeBuffer().then(function (buf) {
        var a = document.createElement('a'), url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        a.href = url; a.download = ('ต้นทุนสินค้า ' + c.name + (c.size ? ' ' + c.size : '')).replace(/[\\/:*?"<>|]/g, '_') + '.xlsx';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
        toast('ดาวน์โหลดไฟล์ Excel แล้ว');
      });
    });
  }
  // ปุ่ม Excel ด้านบนของหน้า: ขณะดูรายงานต้นทุน = Excel ตามแบบไฟล์
  H.exportFile = function (page, kind) {
    if (kind !== 'xlsx' || !/^(r_cost|c_cost)$/.test(page) || !H.q.costId || !H.data) return null;
    var c = (H.data.costs || []).filter(function (x) { return x.id === H.q.costId; })[0];
    return c ? costExcel(c) : null;
  };

  // ==================== การ์ด "ต้นทุนสินค้า" (COST) — รหัสผ่านของตัวเอง · ข้อมูลต้นทุนของ RD + ราคาจากฝ่ายจัดซื้อ (ผู้ใช้ขอ 24/11/69) ====================
  var CM = window.COSTM = {};
  CM.menus = function () { return [{ id: 'c_dash', label: 'Dashboard ต้นทุนสินค้า', ic: 'chart' }, { id: 'c_cost', label: 'ต้นทุนสินค้า', ic: 'coin' }]; };
  CM.reset = function () { H.reset(); };
  // เช็กข้อมูลใหม่ทุก 1 นาที (index.html dashAuto, ผู้ใช้ขอ 28/11/69)
  CM.autoRefresh = function (done) {
    if (state.page !== 'c_dash' || !H.data || !H.data._cost) return;
    call.quiet = true; var pr = call('costLoad', state.token); call.quiet = false;
    pr.then(function (d) {
      if (!d || !d.ok || state.page !== 'c_dash') return;
      d._cost = true; d.partners = d.partners || []; d.trials = d.trials || [];
      var a = JSON.stringify(d), b = JSON.stringify(H.data); if (a === b) return;
      H.data = d; costDash(); done(true);
    }).catch(function () {});
  };
  CM.exportFile = function (page, kind) { return H.exportFile(page, kind); };
  CM.render = function (page) {
    if (!H.data || !H.data._cost) {
      $('main').innerHTML = '<h3>' + (page === 'c_dash' ? 'Dashboard ต้นทุนสินค้า' : 'ต้นทุนสินค้า') + '</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลดข้อมูลต้นทุน และราคาจากฝ่ายจัดซื้อ…</div>';
      call('costLoad', state.token).then(function (d) {
        if (!d || !d.ok) throw new Error(d && d.error || 'โหลดไม่สำเร็จ');
        d._cost = true; d.partners = d.partners || []; d.trials = d.trials || []; H.data = d;
        if (state.page === page) (page === 'c_dash' ? costDash : costPage)();
      }).catch(function (e) {
        if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
        $('main').innerHTML = '<h3>ต้นทุนสินค้า</h3><div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>เปิดข้อมูลไม่ได้</b><span>' + esc(e.message || e) + ' — ให้ผู้ดูแลระบบตั้งลิงก์ชีต / โฟลเดอร์ของการ์ด "ต้นทุนสินค้า" ในหน้าผู้ดูแลก่อน</span></div></div>';
      });
      return;
    }
    if (H.data.pur && H.data.pur.error && !H.q.purWarned) { H.q.purWarned = 1; toast(H.data.pur.error); }
    if (page === 'c_dash') return costDash();
    costPage();
  };

  // ==================== Dashboard ต้นทุนสินค้า (ผู้ใช้ขอ 26/11/69) — ใช้ทั้งหน้าการ์ด COST และหน้าผู้บริหาร ====================
  // ข้อมูลปัจจุบัน (ไม่ขึ้นกับช่วงวันที่): ต้นทุน/หน่วยแยกสินค้า · วัตถุดิบที่ต้นทุนสูงสุด · ราคาจัดซื้อล่าสุดเทียบราคาที่ใช้คิด · รายการที่ต้องอัปเดต
  function cdDays(a, b) { var p = function (d) { d = String(d || '').slice(0, 10); return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); }; return Math.round((p(b) - p(a)) / 864e5); }
  function cdModel(r) {
    var costs = r.costs || [], items = (r.pur && r.pur.items) || [], today = r.today;
    var nrm = function (t) { return String(t || '').replace(/[\sัิ-ฺ็-๎().,\-]/g, '').toLowerCase(); };
    var byV = {}; items.forEach(function (x) { if (!x.vendor) return; (byV[x.vendor] = byV[x.vendor] || []).push(x); });
    var find = function (row) {
      var list = byV[row.vendor]; if (!list) return null;
      var m = String(row.pnote || '').match(/สินค้า:\s*([^·]+)/), want = nrm(m ? m[1] : row.name), best = null;
      list.forEach(function (x) { if (nrm(x.name) === want && (!best || String(x.date) > String(best.date))) best = x; });
      return best;
    };
    var prods = [], ingAgg = {}, changes = [], todo = [];
    costs.forEach(function (c) {
      var k = costRows(c), age = c.costDate ? cdDays(c.costDate, today) : 9999;
      prods.push({ id: c.id, name: c.name + (c.size ? ' ' + c.size : ''), unit: k.unit, total: k.total, matUnit: k.matUnit, packUnit: k.packUnit, mat: k.mat, date: c.costDate, upd: c.updatedAt || c.costDate, photo: c.photo });
      k.ing.forEach(function (x) { if (!x.name || !x.cost) return; var key = nrm(x.name); var a = ingAgg[key] = ingAgg[key] || { name: x.name, n: 0, cost: 0, prods: 0 }; a.cost += x.cost; a.prods++; });
      var chk = function (row, isPack) {
        if (!row.vendor || row.price === '' || row.price == null) return;
        var it = find(row); if (!it) return;
        var now = isPack ? { price: Number(it.price) } : perKgOf(it, row.unit), used = Number(row.price) || 0, cur = Number(now.price) || 0;
        if (!used || Math.abs(cur - used) < 0.005) return;
        changes.push({ id: c.id, prod: c.name + (c.size ? ' ' + c.size : ''), item: row.name, vendor: row.vendor, used: used, cur: cur, pct: (cur - used) / used * 100, date: it.date, per: isPack ? 'ชิ้น' : uinfo(row.unit).per, costDate: c.costDate });
      };
      (c.ingredients || []).forEach(function (x) { chk(x, false); });
      (c.packaging || []).forEach(function (x) { chk(x, true); });
      var why = [];
      if (k.noPrice) why.push({ t: 'รอใส่ราคา ' + k.noPrice + ' รายการ', bad: 1 });
      if (k.total == null) why.push({ t: 'ยังไม่ใส่จำนวนสินค้าที่ได้', bad: 1 });
      if (age > 180) why.push({ t: 'ไม่ได้อัปเดต ' + (age >= 9999 ? 'นาน' : Math.floor(age / 30) + ' เดือน') });
      if (why.length) todo.push({ id: c.id, name: c.name + (c.size ? ' ' + c.size : ''), date: c.costDate, why: why });
    });
    var chgProds = {}; changes.forEach(function (x) { chgProds[x.id] = 1; });
    changes.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); });
    var withTotal = prods.filter(function (p) { return p.total != null; }).sort(function (a, b) { return b.total - a.total; });
    var ing = Object.keys(ingAgg).map(function (k) { return ingAgg[k]; }).sort(function (a, b) { return b.cost - a.cost; });
    return { prods: prods, withTotal: withTotal, ing: ing, changes: changes, chgProds: Object.keys(chgProds).length, todo: todo,
      noPrice: costs.filter(function (c) { return costRows(c).noPrice; }).length,
      stale: prods.filter(function (p) { return !p.date || cdDays(p.date, today) > 180; }).length,
      recent: prods.filter(function (p) { return p.date && cdDays(p.date, today) <= 30; }).length,
      latest: prods.slice().sort(function (a, b) { return String(b.upd).localeCompare(String(a.upd)); }).slice(0, 8) };
  }
  // o.click = true → แตะรายการแล้วเปิดต้นทุนสินค้านั้น (เฉพาะหน้าฝ่าย)
  CM.dashHtml = function (r, o) {
    o = o || {}; var M = cdModel(r);
    if (!M.prods.length) return '<div class="panel empty">ยังไม่มีข้อมูลต้นทุนสินค้า — เพิ่มที่เมนู "ต้นทุนสินค้า"</div>';
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var att = function (id) { return o.click ? ' data-cdo="' + esc(id) + '" role="button" tabindex="0"' : ''; };
    // รูปสินค้าในแถว (ผู้ใช้ขอ 27/11/69: รายการที่มีภาพให้แสดงภาพใน Dashboard)
    var phOf = {}; M.prods.forEach(function (p) { if (p.photo && p.photo.url) phOf[p.id] = p.photo.url; });
    var ph = function (id) { return phOf[id] ? '<img class="cdth" src="' + esc(phOf[id]) + '=w160" alt="" loading="lazy">' : ''; };
    var li = function (id) { return '<div class="li cdli' + (phOf[id] ? ' cdph' : '') + (o.click ? ' tap' : '') + '"' + att(id) + '>' + ph(id); };
    var mx = Math.max.apply(null, M.withTotal.map(function (p) { return p.total; }).concat([0.01]));
    var bars = M.withTotal.length ? '<div class="cdleg"><span><i style="background:#dc2626"></i>วัตถุดิบ</span><span><i style="background:#94a3b8"></i>บรรจุภัณฑ์</span></div>' + M.withTotal.map(function (p) {
      return '<div class="cdbar' + (o.click ? ' tap' : '') + '"' + att(p.id) + '><span class="cdn">' + esc(p.name) + '</span><i><em style="width:' + (p.matUnit / mx * 100).toFixed(1) + '%;background:#dc2626"></em><em style="width:' + (p.packUnit / mx * 100).toFixed(1) + '%;background:#94a3b8"></em></i>'
        + '<b>' + baht(p.total) + '<small>บาท/' + esc(p.unit) + '</small></b><small class="cds">วัตถุดิบ ' + baht(p.matUnit) + ' · บรรจุภัณฑ์ ' + baht(p.packUnit) + '</small></div>';
    }).join('') : '<div class="muted">ยังไม่มีสินค้าที่ใส่ "จำนวนสินค้าที่ได้" จึงคิดต้นทุนต่อหน่วยไม่ได้</div>';
    var chg = M.changes.length ? M.changes.slice(0, 12).map(function (x) {
      var up = x.cur > x.used;
      return li(x.id) + '<span>' + esc(x.item) + '<small>' + esc(x.prod) + ' · ' + esc(x.vendor) + (x.date ? ' · ราคา ' + slashTh(x.date) : '') + '</small></span>'
        + '<b class="' + (up ? 'neg' : 'pos') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(x.pct).toFixed(1) + '%<small>' + baht(x.used) + ' → ' + baht(x.cur) + ' /' + esc(x.per) + '</small></b></div>';
    }).join('') + (M.changes.length > 12 ? '<div class="muted" style="margin-top:6px">และอีก ' + (M.changes.length - 12) + ' รายการ</div>' : '')
      : '<div class="cdok">✓ ราคาที่ใช้คิดต้นทุนตรงกับราคาล่าสุดในระบบจัดซื้อ</div><div class="muted" style="font-size:12.5px">เทียบเฉพาะรายการที่เลือกผู้ขายจากระบบจัดซื้อไว้</div>';
    var todo = M.todo.length ? M.todo.slice(0, 12).map(function (x) {
      return li(x.id) + '<span>' + esc(x.name) + '<small>อัพเดท ' + slashTh(x.date) + '</small></span><b class="cdtags">' + x.why.map(function (w) { return '<em class="' + (w.bad ? 'bad' : '') + '">' + esc(w.t) + '</em>'; }).join('') + '</b></div>';
    }).join('') : '<div class="cdok">✓ ข้อมูลต้นทุนครบทุกรายการ</div>';
    var latest = M.latest.map(function (p) {
      return li(p.id) + '<span>' + esc(p.name) + '<small>อัพเดท ' + slashTh(p.date) + '</small></span><b>' + (p.total != null ? baht(p.total) + '<small>บาท/' + esc(p.unit) + '</small>' : baht(p.mat) + '<small>วัตถุดิบทั้งสูตร</small>') + '</b></div>';
    }).join('');
    var dn = window.DCH && M.ing.length ? window.DCH.donut(M.ing.map(function (x) { return { name: x.name, n: Math.round(x.cost * 100) / 100 }; }), { sub: 'บาท', unit: ' บาท', title: 'ต้นทุนวัตถุดิบ', max: 7, fmt: function (v) { return baht(v, 0); } }) : '<div class="muted">ไม่มีข้อมูล</div>';
    return '<div class="kpis">'
      + tile(M.prods.length, 'สินค้าที่คิดต้นทุน', '#dc2626', 'คิดต่อหน่วยได้ ' + M.withTotal.length + ' รายการ')
      + tile(M.changes.length, 'ราคาจัดซื้อเปลี่ยน', M.changes.length ? '#ea580c' : '#16a34a', M.changes.length ? 'ใน ' + M.chgProds + ' สินค้า · ควรอัปเดตต้นทุน' : 'ตรงกับราคาล่าสุด')
      + tile(M.noPrice, 'สินค้าที่รอใส่ราคา', M.noPrice ? '#dc2626' : '#16a34a', 'มีวัตถุดิบยังไม่มีราคา')
      + tile(M.prods.length - M.withTotal.length, 'ยังไม่ใส่จำนวนที่ได้', M.prods.length - M.withTotal.length ? '#b45309' : '#16a34a', 'คิดต้นทุน/หน่วยไม่ได้')
      + tile(M.stale, 'ไม่ได้อัปเดตเกิน 6 เดือน', M.stale ? '#b45309' : '#16a34a', '')
      + tile(M.recent, 'อัปเดตใน 30 วัน', '#0891b2', '')
      + '</div>'
      + '<div class="panel pbox cdfull"><h4>' + icon('coin', 18) + ' ต้นทุนต่อหน่วย แยกสินค้า <small class="muted">(สูง → ต่ำ)</small></h4>' + bars + '</div>'
      + '<div class="pgrid"><div class="panel pbox"><h4>' + icon('chart', 18) + ' ราคาจัดซื้อล่าสุด เทียบราคาที่ใช้คิดต้นทุน</h4>' + chg + '</div>'
      + '<div class="panel pbox"><h4>' + icon('warn', 18) + ' ต้องอัปเดตข้อมูล (' + M.todo.length + ')</h4>' + todo + '</div>'
      + '<div class="panel pbox"><h4>' + icon('chart', 18) + ' วัตถุดิบที่ต้นทุนสูงสุด <small class="muted">(รวมทุกสูตร)</small></h4>' + dn + '</div>'
      + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' อัปเดตล่าสุด</h4>' + latest + '</div></div>';
  };
  function costDash() {
    $('main').innerHTML = '<h3>Dashboard ต้นทุนสินค้า</h3><div class="cdnote">ข้อมูลปัจจุบัน · ราคาล่าสุดจากฝ่ายจัดซื้อ · แตะรายการเพื่อเปิดต้นทุนสินค้านั้น</div>' + CM.dashHtml(H.data, { click: true });
    on('[data-cdo]', 'click', function (el) { H.q.costId = el.getAttribute('data-cdo'); go('c_cost'); }, $('main'));
    on('[data-cdo]', 'keydown', function (el, e) { if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); H.q.costId = el.getAttribute('data-cdo'); go('c_cost'); } }, $('main'));
  }

  // ==================== Dashboard ====================
  function dash() {
    var t = H.data.today, q = H.q;
    if (!q.from) { q.from = t.slice(0, 4) + '-01-01'; q.to = t; }
    var quick = [['ปีนี้', t.slice(0, 4) + '-01-01', t], ['เดือนนี้', t.slice(0, 8) + '01', t], ['3 เดือน', addDays(t, -89), t], ['12 เดือน', addDays(t, -364), t]];
    $('main').innerHTML = '<h3>ภาพรวมวิจัยและพัฒนา</h3><p class="lead">ผลิตภัณฑ์ใหม่ · ความคืบหน้าเทียบกำหนด · คู่ค้า · <a href="' + esc(H.data.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + '<div class="pbar noprint"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<input type="date" id="qFrom" value="' + q.from + '" aria-label="ตั้งแต่"> – <input type="date" id="qTo" value="' + q.to + '" aria-label="ถึง"><button class="btn btn-sm btn-line" id="qPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div id="qOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>';
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['qFrom', 'qTo'].forEach(function (id) { $(id).addEventListener('change', function () { var a = $('qFrom').value, b = $('qTo').value; if (a && b && a <= b) { q.from = a; q.to = b; dash(); } else toast('เลือกช่วงวันที่ให้ถูกต้อง'); }); });
    $('qPrint').addEventListener('click', function () { window.print(); });
    var my = H.dseq = (H.dseq || 0) + 1;
    dashCall('rdDashboard', [q.from, q.to], function (r) {
      if (my !== H.dseq || state.page !== 'r_dash') return;
      $('qOut').innerHTML = r.ok ? H.dashHtml(r) : '<div class="panel">' + esc(r.error) + '</div>';
    }).catch(onServerError);
  }
  H.dashHtml = function (r) {
    var k = r.kpi, today = r.today;
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var bars = function (arr, color) {
      var mx = Math.max.apply(null, arr.map(function (x) { return x.n; }).concat([1]));
      return arr.length ? arr.map(function (x) { return '<div class="rbr"><span>' + esc(x.name) + '</span><i><em style="width:' + Math.max(4, x.n / mx * 100) + '%;background:' + color + '"></em></i><b>' + x.n + '</b></div>'; }).join('') : '<div class="muted">ไม่มีข้อมูล</div>';
    };
    var dl = function (d) { var n = Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 864e5); return n < 0 ? 'เลย ' + (-n) + ' วัน' : n === 0 ? 'ครบวันนี้' : 'อีก ' + n + ' วัน'; };
    return '<div class="kpis">'
      + tile(k.dev, 'กำลังพัฒนา', '#111827', 'ทั้งหมดตอนนี้')
      + tile(k.overdue, 'เลยกำหนด', k.overdue ? '#dc2626' : '#16a34a', 'ยังพัฒนาไม่เสร็จ')
      + tile(k.finished, 'พัฒนาเสร็จในช่วงนี้', '#16a34a', k.finished ? 'ทันกำหนด ' + k.onTime + ' จาก ' + k.finished : '')
      + tile(k.launched, 'วางจำหน่ายแล้ว', '#0891b2', 'ทั้งหมด')
      + tile(k.trials, 'การทดลองในช่วงนี้', '#ea580c', 'ผ่าน ' + k.trialPass + ' · ไม่ผ่าน ' + k.trialFail)
      + tile(k.partners, 'คู่ค้า', '#7c3aed', 'ในประเทศ ' + k.partnersDom + ' · ต่างประเทศ ' + k.partnersExp)
      + '</div><div class="pgrid"><div class="panel pbox"><h4>' + icon('chart', 18) + ' ผลิตภัณฑ์ใหม่ในช่วงนี้ (' + k.inRange + ')</h4><div class="xsub2">แยกประเภท</div>' + (window.DCH && r.byCategory.length ? window.DCH.donut(r.byCategory, { sub: 'ผลิตภัณฑ์', unit: ' รายการ', title: 'ผลิตภัณฑ์ใหม่แยกประเภท' }) : bars(r.byCategory, '#111827'))
      + '<div class="xsub2">แยกตลาด</div>' + bars(r.byMarket, '#7c3aed') + '<div class="xsub2">แยกสถานะ</div>' + bars(r.byStatus, '#0891b2') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('clock', 18) + ' กำหนดเสร็จ (กำลังพัฒนา)</h4>' + (r.dueList.length ? r.dueList.map(function (p) {
        return '<div class="li"><span>' + esc(p.name) + '<small>' + esc([p.code, p.category, MKT[p.market]].filter(String).join(' · ')) + '</small></span><b class="' + (p.overdue ? 'neg' : '') + '">' + dd(p.endDate) + '<small>' + dl(p.endDate) + '</small></b></div>';
      }).join('') : '<div class="muted">ไม่มีงานที่กำลังพัฒนา</div>')
      + (r.finishedList.length ? '<h4 style="margin-top:16px">' + icon('check', 18) + ' เสร็จในช่วงนี้</h4>' + r.finishedList.map(function (p) {
        return '<div class="li"><span>' + esc(p.name) + '<small>' + esc(p.code) + ' · กำหนด ' + dd(p.endDate) + '</small></span><b class="' + (p.doneDate > p.endDate ? 'neg' : 'pos') + '">' + dd(p.doneDate) + '</b></div>';
      }).join('') : '')
      + '</div></div>'
      + (r.topPartners.length ? '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('users', 18) + ' คู่ค้า (จำนวนสินค้าที่ส่งขาย)</h4>' + bars(r.topPartners.map(function (x) { return { name: x.name + ' · ' + MKT[x.type] + (x.country ? ' ' + x.country : ''), n: x.n }; }), '#7c3aed') + '</div>' : '');
  };

  // ==================== ตั้งค่า ====================
  function settings() {
    var s = S_();
    var ta = function (k, label, hint) { return '<div class="pf full"><label for="s_' + k + '">' + label + '</label><textarea id="s_' + k + '" rows="2" placeholder="' + esc(hint || '') + '">' + esc(s[k] || '') + '</textarea></div>'; };
    $('main').innerHTML = '<h3>ตั้งค่า</h3><p class="lead">รายการตัวเลือก (คั่นด้วย , )</p>'
      + '<div class="panel pbox"><div class="pform">' + ta('categories', 'ประเภทสินค้า', 'น้ำพริก, พริกน้ำมัน, ซอส, ก๋วยเตี๋ยว, ทอด') + ta('channels', 'ช่องทางขาย (ตัวเลือกในหน้าคู่ค้า)', '7-Eleven, ห้าง, ออนไลน์') + '</div>'
      + '<div class="qsave"><button class="btn btn-primary" id="sSave">' + icon('check', 18) + ' บันทึกการตั้งค่า</button></div></div>';
    $('sSave').addEventListener('click', function () {
      var b = this, o = { categories: $('s_categories').value, channels: $('s_channels').value };
      if (!list(o.categories).length) return toast('ใส่ประเภทสินค้าอย่างน้อย 1 ประเภท');
      b.disabled = true;
      call('rdSaveSettings', state.token, o).then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); H.data.settings = r.settings; toast('บันทึกแล้ว'); settings(); })
        .catch(function (e) { b.disabled = false; onServerError(e); });
    });
  }
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><p class="lead">บันทึกทุกครั้งที่เพิ่ม/แก้/ลบข้อมูล</p><div id="lOut" class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
    call('rdLog', state.token, 300).then(function (r) {
      $('lOut').outerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>รายละเอียด</th></tr></thead><tbody>'
        + (r.rows.map(function (x) { return '<tr><td class="nw">' + esc(x.time) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.detail) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีประวัติ</td></tr>') + '</tbody></table></div>';
    }).catch(onServerError);
  }

  // ---------- CSS ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    // จัดปุ่มหน้า ผลิตภัณฑ์ใหม่ / คู่ค้า ให้เป็นระเบียบ (ผู้ใช้ขอ 22/11/69): ปุ่มเพิ่มอยู่บนขวา · ชิปสถานะ · แถบค้นหา + ตัวกรองกว้างเท่ากัน
    '.rtool{display:flex;justify-content:flex-end;margin:0 0 12px}.rtool .btn{width:auto;flex:0 0 auto;min-height:44px;padding:0 20px;font-size:15px}',
    '.rchips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.rchips .chip{white-space:nowrap}',
    '.rbar{display:grid!important;grid-template-columns:minmax(0,1fr) 190px 190px;gap:10px;align-items:center}.rbar.r1{grid-template-columns:minmax(0,1fr)}.rbar select{width:100%;min-width:0;height:44px;margin:0;border:1.5px solid var(--line);border-radius:10px;padding:0 10px;background:#fff;font:inherit;font-size:14px;color:inherit}.rbar .psearch{min-width:0;margin:0}',
    '@media (max-width:640px){.rtool .btn{width:100%;flex:1 1 auto;justify-content:center}.rchips{display:grid;grid-template-columns:1fr 1fr}.rchips.r3{grid-template-columns:1fr 1fr 1fr}.rchips .chip{width:100%;text-align:center;justify-content:center;margin:0}.rchips:not(.r3) .chip:last-child:nth-child(odd){grid-column:1/-1}.rbar{grid-template-columns:1fr 1fr}.rbar .psearch{grid-column:1/-1}}',
    '.rcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}',
    '.rcard{display:flex;flex-direction:column;gap:6px;text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;box-shadow:var(--shadow);cursor:pointer;font:inherit;color:var(--ink);min-width:0}.rcard:hover{border-color:#111827}',
    '.rch{display:flex;align-items:center;justify-content:space-between;gap:8px}.rcode{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.3px}.rname{font-size:16px;line-height:1.35}',
    '.rtags{display:flex;flex-wrap:wrap;gap:4px 6px}.rtags span,.rst{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px}.rcat{background:#fce7f3;color:#9d174d}.rown{background:#f1f5f9;color:#334155;font-weight:500!important}',
    '.rmk{background:color-mix(in srgb,var(--m) 12%,white);color:var(--m);font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;white-space:nowrap}',
    '.rst.dev{background:#f3f4f6;color:#111827}.rst.done{background:#f0fdf4;color:#15803d}.rst.launched{background:#ecfeff;color:#0e7490}.rst.hold{background:#fffbeb;color:#b45309}.rst.cancel{background:#f1f5f9;color:#64748b}.rst.late{background:#fef2f2;color:#b91c1c}',
    '.rbar .rbt{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--muted)}.rbar .rbt b{font-size:12.5px;color:#334155}.rbar i{display:block;height:7px;background:#f1f5f9;border-radius:99px;overflow:hidden;margin-top:4px}.rbar em{display:block;height:100%;border-radius:99px}',
    '.rpt{font-size:12.5px;color:#5b21b6;display:flex;gap:4px;align-items:flex-start}.rpt svg{flex:none;margin-top:2px}',
    '.rpc{border-left:6px solid var(--m)}.rpc.off{opacity:.6}.rmeta{font-size:13px;color:#334155;display:flex;align-items:center;gap:4px;flex-wrap:wrap}',
    '.rprods{display:flex;flex-wrap:wrap;gap:4px}.rprods small{width:100%;color:var(--muted);font-size:12px}.rprods span{font-size:12px;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:2px 8px}.rprods .more{background:#ede9fe;color:#5b21b6;border-color:#ddd6fe}',
    '.chip.rlate:not(.on){color:#b91c1c}.rseg{display:flex;gap:14px;flex-wrap:wrap;padding:8px 0}.rseg label{display:flex;align-items:center;gap:6px;font-size:14px;margin:0;color:var(--ink)}',
    '.rpick{display:flex;flex-wrap:wrap;gap:6px}.rpick label{display:flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:10px;padding:6px 10px;font-size:14px;margin:0;color:var(--ink);background:#fff}.rpick label small{color:var(--muted)}.rpick label.exp{border-color:#ddd6fe}.rpick label:has(input:checked){border-color:#111827;background:#f3f4f6}',
    '.raddp{display:flex;gap:6px;margin-top:6px}.raddp input{flex:1;min-width:0}.rdel{color:#b91c1c;border-color:#fecaca}',
    '.rbr{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 34px;gap:8px;align-items:center;padding:4px 0;font-size:13px}.rbr span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rbr i{display:block;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden}.rbr em{display:block;height:100%;border-radius:99px}.rbr b{text-align:right}',
    '.xsub2{font-size:12.5px;color:var(--muted);font-weight:700;margin:10px 0 2px}.li small{display:block;color:var(--muted);font-size:12px;font-weight:400}',
    '.rtr{font-size:12.5px;color:#9a3412}.rdh{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.rdetail .rbar{margin-top:8px}.rnote{font-size:13.5px;color:#334155;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-top:8px;white-space:pre-wrap}',
    '.rtrh{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:18px 0 10px;flex-wrap:wrap}.rtrh h4{margin:0;font-size:16px}.rtrh small{color:var(--muted);font-weight:400}',
    '.rtrial{border-left:5px solid #ea580c;margin-bottom:10px}.rtrt{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rtrt b{font-size:15px}.rtrt span{color:var(--muted);font-size:13px}.rres{font-weight:700;font-size:12px!important;border-radius:99px;padding:2px 10px;background:#f1f5f9}.rres.pass{background:#f0fdf4;color:#15803d!important}.rres.fail{background:#fef2f2;color:#b91c1c!important}',
    '.rtrm{font-size:13px;color:#334155;margin-top:4px}.rtrb{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.rph{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.rph span{position:relative}.rph img{width:84px;height:84px;object-fit:cover;border-radius:10px;display:block}.rph em{position:absolute;left:4px;bottom:4px;font-size:10px;font-style:normal;background:#000a;color:#fff;border-radius:6px;padding:1px 5px}.rph button{position:absolute;top:2px;right:2px;border:0;border-radius:50%;width:22px;height:22px;background:#fff;box-shadow:var(--shadow);cursor:pointer;display:grid;place-items:center}',
    '.radd{width:84px;height:84px;border:2px dashed var(--line);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px;color:var(--muted);cursor:pointer;margin:0}',
    '.rhint{font-size:13px;background:#fff7ed;color:#9a3412;border-radius:8px;padding:8px 10px;margin-bottom:10px}',
    '.ring{border:1.5px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:8px}.rir{display:grid;grid-template-columns:24px minmax(0,2fr) minmax(0,1fr) 52px minmax(0,1fr) 52px 30px;gap:6px;align-items:center;padding:5px 8px;border-top:1px solid var(--line)}.rir input{min-width:0;border:1.5px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;font-size:14px}.rir em{font-style:normal;font-size:12.5px;color:var(--muted);text-align:right}',
    '.rih{background:#f8fafc;border-top:0;font-size:12px;color:var(--muted);font-weight:700}.rit{background:#f3f4f6}.rit b{font-size:13.5px}.rit b:nth-child(n+3){text-align:right}',
    '.rsens{display:grid;gap:6px}.rsr{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px dashed var(--line);padding:4px 0}.rsr span{font-size:14px}.rsr div{display:flex;gap:4px}.rsb{width:36px;height:34px;border:1.5px solid var(--line);border-radius:8px;background:#fff;font:inherit;font-weight:700;cursor:pointer}.rsb.on{background:#111827;border-color:#111827;color:#fff}',
    '.rform{background:#fff;padding:18px;border-radius:10px;font-size:13px;color:#111;text-align:left;max-width:1000px}.rform td,.rform th,.rform div,.rform span{text-align:left}.rdh .btn{width:auto;flex:none}.rfh{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:10px;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:8px}.rfh span{display:block;font-size:12px}.rfc{text-align:center}.rfc b{font-size:16px;display:block}.rfr{text-align:right;font-size:11px}',
    '.rfrow{display:flex;flex-wrap:wrap;gap:6px 24px;padding:4px 0}.rfgrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;margin-top:8px}.rfgrid>div{min-width:0}.rft{width:100%;border-collapse:collapse;margin-bottom:8px}.rft th,.rft td{border:1px solid #444;padding:3px 6px;font-size:12px;vertical-align:top}.rft th{background:#f3f4f6}.rform .rft .r{text-align:right}.rform .rft .c{text-align:center}.rform .rfc,.rform .rfc b,.rform .rfc span{text-align:center}.rform .rfr{text-align:right}.rform .rfsign div{text-align:center}.rft tr.tot td{font-weight:700;background:#f3f4f6}',
    '.rfs{margin:6px 0}.rfs b{display:block;text-decoration:underline}.rfs div{white-space:normal;line-height:1.5}.rfimg{border:1px solid #444;height:170px;display:grid;place-items:center;margin-bottom:8px;overflow:hidden}.rfimg img{max-width:100%;max-height:100%;object-fit:contain}.rfimg span{color:#888}',
    '.rfres{display:flex;gap:16px;align-items:center;margin:6px 0}.rfnote{color:#555;font-size:11px}.rfphotos{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.rfphotos img{height:110px;border:1px solid #ccc}.rfsign{display:flex;justify-content:space-around;margin-top:28px;text-align:center;line-height:1.9}',
    '@media print{.rform{padding:0;font-size:10pt}.rft th,.rft td{font-size:9pt}.rfimg{height:150px}}',
    '@media (max-width:760px){.rcards{grid-template-columns:minmax(0,1fr)}.rir{grid-template-columns:20px minmax(0,1fr) 64px 40px 30px;row-gap:4px}.rir > :nth-child(5),.rir > :nth-child(6){grid-row:2}.rir > :nth-child(5){grid-column:3}.rir > :nth-child(6){grid-column:4}.rfgrid{grid-template-columns:minmax(0,1fr)}.rfh{grid-template-columns:1fr}.rfc,.rfr{text-align:left}}',
    // ---- Dashboard ต้นทุนสินค้า (26/11/69)
    '.cdnote{font-size:13px;color:var(--muted);margin:-4px 0 12px}.cdfull{margin:14px 0}.cdleg{display:flex;gap:14px;font-size:12.5px;color:var(--muted);margin:0 0 8px}.cdleg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
    '.cdbar{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,2fr) 104px;gap:4px 10px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--line);border-radius:8px}.cdbar .cdn{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cdbar i{display:flex;height:14px;background:#f1f5f9;border-radius:99px;overflow:hidden}.cdbar em{display:block;height:100%}.cdbar>b{text-align:right;font-size:15px}.cdbar>b small{display:block;font-size:11.5px;font-weight:400;color:var(--muted)}.cdbar .cds{grid-column:2/4;font-size:12px;color:var(--muted);margin-top:-4px}',
    '.li.cdph{display:grid;grid-template-columns:auto 1fr auto;column-gap:10px;align-items:center}.li.cdph>b{justify-self:end}.cdth{width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0}.tap{cursor:pointer}.tap:hover{background:#fef2f2}.tap:focus-visible{outline:2px solid #dc2626;outline-offset:1px}.cdli{border-radius:8px;padding-left:4px;padding-right:4px}.cdtags{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;align-items:center;align-self:center;max-width:60%}.cdtags em{line-height:1.5}.cdtags em{font-style:normal;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:#fffbeb;color:#b45309;white-space:nowrap}.cdtags em.bad{background:#fef2f2;color:#b91c1c}',
    '.cdok{color:#15803d;font-weight:700;font-size:14px;padding:6px 0}',
    '@media (max-width:640px){.cdbar{grid-template-columns:minmax(0,1fr) 92px}.cdbar .cdn{grid-column:1/-1;white-space:normal}.cdbar i{grid-column:1}.cdbar .cds{grid-column:1/-1;margin-top:0}}',
    // ---- ต้นทุนสินค้า (24/11/69)
    '.rccards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}.rccard{display:flex;gap:12px;align-items:center;text-align:left;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;cursor:pointer;font:inherit;color:inherit;width:100%}.rccard:hover{border-color:var(--c,#7c3aed);box-shadow:0 2px 10px rgba(0,0,0,.06)}.rccard:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}',
    '.rcth{width:64px;height:64px;flex:none;border-radius:10px;background:#f1f5f9;display:grid;place-items:center;overflow:hidden;color:#94a3b8}.rcth img{width:100%;height:100%;object-fit:cover}.rcti{display:flex;flex-direction:column;gap:2px;min-width:0}.rcti b{font-size:15px}.rcti small{color:var(--muted);font-size:12.5px}.rcnum{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;margin-top:2px}.rcnum b{color:#b91c1c}',
    '.rch{margin:16px 0 6px;font-size:15px}.rch small{font-weight:400;color:var(--muted);font-size:12px;margin-left:6px}.rci,.rcp2{display:grid;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line)}.rci{grid-template-columns:24px minmax(0,2fr) 90px 72px 110px 96px 30px}.rcp2{grid-template-columns:24px minmax(0,2fr) 110px 110px minmax(0,1.6fr) 30px}',
    '.rci input,.rci select,.rcp2 input{min-width:0;width:100%;height:38px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:14px;background:#fff;color:inherit}.rci input:focus,.rci select:focus,.rcp2 input:focus{outline:2px solid #9ca3af;border-color:#111827}.rci input[inputmode],.rcp2 input[inputmode]{text-align:right}.rcih{font-size:12px;color:var(--muted);font-weight:700;border-bottom:2px solid var(--line)}.rci .n,.rcp2 .n{color:var(--muted);font-size:12px;text-align:center}.rci .m{text-align:right;color:#b91c1c;font-weight:600}.rcit{background:#f8fafc;font-weight:700}.rcit span:nth-child(3){text-align:right}.rcx{border:0;background:none;color:#94a3b8;font-size:16px;cursor:pointer;min-height:36px}.rcx:hover{color:#b91c1c}',
    '.rcyl{margin-top:12px}.rcu{display:flex;gap:6px}.rcu input:first-child{flex:1;min-width:0}.rcu input:last-child{width:74px;flex:none}.rcph2{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.rcphv{width:110px;height:110px;border:1px dashed var(--line);border-radius:10px;display:grid;place-items:center;overflow:hidden;color:var(--muted);font-size:12px;background:#f8fafc}.rcphv img{width:100%;height:100%;object-fit:contain;background:#fff}.rcphb{display:flex;gap:6px;flex-wrap:wrap}.rcphb .btn{width:auto}',
    '.rctool{gap:8px;flex-wrap:wrap}.rctool label.btn{cursor:pointer}.rctool .busy{opacity:.6;pointer-events:none}.rcfrom{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:13.5px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.rcimpl{display:grid;gap:8px}.rcdup{display:grid;gap:8px}.rcdup .btn{width:100%;justify-content:center;min-height:46px}.rcimp{display:grid;gap:2px;text-align:left;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;cursor:pointer;font:inherit}.rcimp:hover{border-color:#111827}.rcimp small{color:var(--muted)}.rcimp span{color:#b91c1c;font-weight:700;font-size:13px}',
    '.rcunit{min-width:0}.rcper{color:#64748b;font-size:11px;font-weight:400}',
    '.rcirow{position:relative;border-bottom:1px solid var(--line)}.rcirow .rci,.rcirow .rcp2{border-bottom:0}.rcsug{margin:2px 0 8px 30px;border:1px solid #c7d2fe;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.12);max-height:280px;overflow:auto}.rcsh{font-size:12.5px;color:#334155;font-weight:700;padding:6px 8px 6px 10px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#f8fafc;display:flex;align-items:center;gap:8px;z-index:1}.rcsh input{flex:1;min-width:0;min-height:38px;font-weight:400}.rcsh .rcx.sm{margin-left:0}.rcsh2{font-size:12px;color:var(--muted);padding:6px 10px}.rcsn{font-size:13px;color:var(--muted);padding:8px 10px}',
    '.rcsi{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px solid #f1f5f9;background:#fff;padding:8px 10px;font:inherit;cursor:pointer;min-height:44px;align-items:center}.rcsi:hover,.rcsi:focus{background:#eef2ff;outline:0}.rcsi span{display:flex;flex-direction:column;min-width:0}.rcsi small{color:var(--muted);font-size:12px}.rcsi em{font-style:normal;font-weight:700;white-space:nowrap;color:#1e293b}.rcsi em i{font-style:normal;font-size:11px;background:#dcfce7;color:#15803d;border-radius:99px;padding:1px 6px;margin-left:4px}',
    '.rcvend{font-size:12.5px;color:#475569;margin:-2px 0 6px 30px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}.rcvend .warn{color:#b45309}.rcx.sm{min-height:34px;font-size:12.5px;padding:4px 10px;border:1px solid #e2e8f0;border-radius:99px;background:#fff;color:#475569;margin-left:auto}.rcwait{display:inline-block;margin-top:4px;font-size:12px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:99px;padding:2px 8px;width:max-content}.rcsum .w{color:#b45309;font-size:13px}.rcpu{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}.rcpc{color:#334155;font-size:14px;font-weight:700}',
    '.rcsum{margin-top:14px;border:1px solid #c4b5fd;background:#f5f3ff;border-radius:12px;padding:10px 14px;display:grid;gap:4px}.rcsum div{display:flex;justify-content:space-between;gap:10px}.rcsum .t{border-top:1px solid #c4b5fd;padding-top:6px;font-size:15px}.rcsum .t b{color:#b91c1c}',
    // แบบรายงาน (เลียนแบบไฟล์ Excel: กรอบเขียว หัวตารางเขียว ตัวเลขราคาสีแดง)
    '.rcpwrap{overflow-x:auto}.rcp{background:#fff;color:#111;max-width:820px;padding:16px 18px;font-size:14px;border-radius:10px}.rcp table{border-collapse:collapse;width:100%}.rcpu{color:#e00;font-weight:800;font-size:17px;margin-bottom:4px}.rcpb{border:1.5px solid #70ad47;padding:0 0 14px}',
    '.rcph{display:grid;grid-template-columns:1fr 1.3fr 1fr;align-items:center;border-bottom:1.5px solid #70ad47;min-height:120px}.rcpl{display:flex;gap:8px;align-items:center;padding:8px;font-size:13px;line-height:1.35}.rcpl img{height:52px;width:auto}.rcpl span{font-size:14px}.rcpt{text-align:center;font-weight:800;font-size:17px;line-height:1.45;padding:8px}.rcpi{border-left:1.5px solid #70ad47;align-self:stretch;display:grid;place-items:center;padding:6px}.rcpi img{max-height:130px;max-width:100%;object-fit:contain}.rcpi span{color:#94a3b8;font-size:12px}',
    '.rcpsec{color:#e00;font-weight:800;margin:12px 32px 2px;font-size:15px}.rcpt1,.rcpt2{margin:0 32px;width:calc(100% - 64px)!important}.rcpt1 th,.rcpt2 th{background:#c6e0b4;border:1px solid #70ad47;padding:3px 6px;font-weight:800;text-align:center}.rcpt2 th{background:#e2efda}.rcpt1 td,.rcpt2 td{border-left:1px solid #70ad47;border-right:1px solid #70ad47;padding:2px 6px}.rcpt1 tbody tr:last-child td,.rcpt2 tbody tr:last-child td{border-bottom:1px solid #70ad47}',
    '.rcp .n{text-align:center;width:42px}.rcp .q{text-align:right}.rcp .u{width:52px}.rcp .m{color:#e00;text-align:right}.rcp .m.c{text-align:center}.rcpt2 td.m:last-child{text-align:left}.rcpe td{height:24px}.rcptot td{padding-top:10px}.rcpy{margin:2px 32px;width:auto!important}.rcpy td{padding:1px 14px 1px 0}',
    '.rcps{margin:14px 32px 0;width:auto!important;min-width:60%}.rcps th{background:#ede9fe;border:1px solid #a78bfa;padding:4px 8px;text-align:left}.rcps td{border:1px solid #c4b5fd;padding:3px 8px}.rcps .t td{font-weight:800}.rcps small{font-weight:400;color:#555}.rcpn{margin:10px 32px 0;font-size:13px}',
    '@media print{@page{size:A4 portrait;margin:10mm}body.rcprint *{visibility:hidden!important}body.rcprint .rcp,body.rcprint .rcp *{visibility:visible!important}body.rcprint .rcp{position:absolute;left:0;top:0;width:100%;max-width:none;padding:0;border-radius:0;box-shadow:none}body.rcprint .rcpwrap{overflow:visible}}',
    '@media (max-width:760px){.rci{grid-template-columns:22px minmax(0,1fr) minmax(0,1fr) 30px;row-gap:6px}.rci > :nth-child(2){grid-column:2/4}.rci > :nth-child(7){grid-column:4;grid-row:1}.rci > :nth-child(3){grid-column:2}.rci > :nth-child(4){grid-column:3}.rci > :nth-child(5){grid-column:2}.rci > :nth-child(6){grid-column:3}.rci .m:not(:empty)::before{content:"รวม ";color:var(--muted);font-weight:400;font-size:12px}.rcih{display:none!important}.rcit{display:flex!important;justify-content:space-between}.rcit > span:empty{display:none}.rcp2{grid-template-columns:22px minmax(0,1fr) 30px}.rcp2 > :nth-child(3),.rcp2 > :nth-child(4),.rcp2 > :nth-child(5){grid-column:2}.rcih.rcp2 > :nth-child(n+3){display:none}.rcp{min-width:640px;font-size:13px;padding:10px}}',
  ].join('\n');
  document.head.appendChild(css);
})();
