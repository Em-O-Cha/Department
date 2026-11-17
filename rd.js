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
    { id: 'r_cost', label: 'ต้นทุนสินค้า', ic: 'coin' },
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
      + '<i><em style="width:' + (done ? 100 : pct) + '%;background:' + (late ? '#dc2626' : done ? '#16a34a' : '#db2777') + '"></em></i></div>';
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
      + '<div class="pchips">' + chips.map(function (c) { return '<button class="chip' + (q.nst === c[0] ? ' on' : '') + (c[0] === 'late' ? ' rlate' : '') + '" data-nst="' + c[0] + '">' + c[1] + ' (' + all.filter(function (p) { return match(p, c[0]); }).length + ')</button>'; }).join('') + '</div>'
      + '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="nS" type="search" placeholder="ค้นหา ชื่อ / เลขที่ / คู่ค้า" value="' + esc(q.ns || '') + '"></div>'
      + '<select id="nCat"><option value="">ทุกประเภท</option>' + cats.map(function (c) { return '<option' + (q.ncat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>'
      + '<select id="nMkt"><option value="">ทุกตลาด</option>' + Object.keys(MKT).map(function (k) { return '<option value="' + k + '"' + (q.nmkt === k ? ' selected' : '') + '>' + MKT[k] + '</option>'; }).join('') + '</select>'
      + '<button class="btn btn-sm btn-primary" id="nAdd">' + icon('plus', 16) + ' เพิ่มผลิตภัณฑ์ใหม่</button></div>'
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
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
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
      + '<div class="pchips">' + [['all', 'ทั้งหมด'], ['dom', 'ในประเทศ'], ['exp', 'ต่างประเทศ']].map(function (c) { return '<button class="chip' + (q.pt === c[0] ? ' on' : '') + '" data-pt2="' + c[0] + '">' + c[1] + ' (' + all.filter(function (x) { return c[0] === 'all' || x.type === c[0]; }).length + ')</button>'; }).join('') + '</div>'
      + '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="pS" type="search" placeholder="ค้นหา ชื่อ / ประเทศ / สินค้า / ผู้ติดต่อ" value="' + esc(q.ps || '') + '"></div>'
      + '<button class="btn btn-sm btn-primary" id="pAdd">' + icon('plus', 16) + ' เพิ่มคู่ค้า</button></div>'
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

  // ==================== ต้นทุนสินค้า (รอวิธีคำนวณ) ====================
  function costPage() {
    $('main').innerHTML = '<h3>ต้นทุนสินค้า</h3><p class="lead">ย้ายมาอยู่ในระบบ RD แล้ว (ไม่แยกการ์ด "ต้นทุนสินค้า" อีก)</p>'
      + '<div class="panel status"><div class="dot">' + icon('coin', 20) + '</div><div><b>รอกำหนดวิธีคำนวณต้นทุน</b><span>เมื่อได้สูตร / ข้อมูลที่ต้องใช้ (เช่น วัตถุดิบ ปริมาณ ราคา บรรจุภัณฑ์ ค่าแรง) จะทำหน้ากรอกและคำนวณต้นทุนต่อหน่วยไว้ที่นี่</span></div></div>';
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
    call('rdDashboard', state.token, q.from, q.to).then(function (r) {
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
      + tile(k.dev, 'กำลังพัฒนา', '#db2777', 'ทั้งหมดตอนนี้')
      + tile(k.overdue, 'เลยกำหนด', k.overdue ? '#dc2626' : '#16a34a', 'ยังพัฒนาไม่เสร็จ')
      + tile(k.finished, 'พัฒนาเสร็จในช่วงนี้', '#16a34a', k.finished ? 'ทันกำหนด ' + k.onTime + ' จาก ' + k.finished : '')
      + tile(k.launched, 'วางจำหน่ายแล้ว', '#0891b2', 'ทั้งหมด')
      + tile(k.trials, 'การทดลองในช่วงนี้', '#ea580c', 'ผ่าน ' + k.trialPass + ' · ไม่ผ่าน ' + k.trialFail)
      + tile(k.partners, 'คู่ค้า', '#7c3aed', 'ในประเทศ ' + k.partnersDom + ' · ต่างประเทศ ' + k.partnersExp)
      + '</div><div class="pgrid"><div class="panel pbox"><h4>' + icon('chart', 18) + ' ผลิตภัณฑ์ใหม่ในช่วงนี้ (' + k.inRange + ')</h4><div class="xsub2">แยกประเภท</div>' + bars(r.byCategory, '#db2777')
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
    '.rcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}',
    '.rcard{display:flex;flex-direction:column;gap:6px;text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;box-shadow:var(--shadow);cursor:pointer;font:inherit;color:var(--ink);min-width:0}.rcard:hover{border-color:#db2777}',
    '.rch{display:flex;align-items:center;justify-content:space-between;gap:8px}.rcode{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.3px}.rname{font-size:16px;line-height:1.35}',
    '.rtags{display:flex;flex-wrap:wrap;gap:4px 6px}.rtags span,.rst{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px}.rcat{background:#fce7f3;color:#9d174d}.rown{background:#f1f5f9;color:#334155;font-weight:500!important}',
    '.rmk{background:color-mix(in srgb,var(--m) 12%,white);color:var(--m);font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;white-space:nowrap}',
    '.rst.dev{background:#fdf2f8;color:#be185d}.rst.done{background:#f0fdf4;color:#15803d}.rst.launched{background:#ecfeff;color:#0e7490}.rst.hold{background:#fffbeb;color:#b45309}.rst.cancel{background:#f1f5f9;color:#64748b}.rst.late{background:#fef2f2;color:#b91c1c}',
    '.rbar .rbt{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--muted)}.rbar .rbt b{font-size:12.5px;color:#334155}.rbar i{display:block;height:7px;background:#f1f5f9;border-radius:99px;overflow:hidden;margin-top:4px}.rbar em{display:block;height:100%;border-radius:99px}',
    '.rpt{font-size:12.5px;color:#5b21b6;display:flex;gap:4px;align-items:flex-start}.rpt svg{flex:none;margin-top:2px}',
    '.rpc{border-left:6px solid var(--m)}.rpc.off{opacity:.6}.rmeta{font-size:13px;color:#334155;display:flex;align-items:center;gap:4px;flex-wrap:wrap}',
    '.rprods{display:flex;flex-wrap:wrap;gap:4px}.rprods small{width:100%;color:var(--muted);font-size:12px}.rprods span{font-size:12px;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:2px 8px}.rprods .more{background:#ede9fe;color:#5b21b6;border-color:#ddd6fe}',
    '.chip.rlate:not(.on){color:#b91c1c}.rseg{display:flex;gap:14px;flex-wrap:wrap;padding:8px 0}.rseg label{display:flex;align-items:center;gap:6px;font-size:14px;margin:0;color:var(--ink)}',
    '.rpick{display:flex;flex-wrap:wrap;gap:6px}.rpick label{display:flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:10px;padding:6px 10px;font-size:14px;margin:0;color:var(--ink);background:#fff}.rpick label small{color:var(--muted)}.rpick label.exp{border-color:#ddd6fe}.rpick label:has(input:checked){border-color:#db2777;background:#fdf2f8}',
    '.raddp{display:flex;gap:6px;margin-top:6px}.raddp input{flex:1;min-width:0}.rdel{color:#b91c1c;border-color:#fecaca}',
    '.rbr{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 34px;gap:8px;align-items:center;padding:4px 0;font-size:13px}.rbr span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rbr i{display:block;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden}.rbr em{display:block;height:100%;border-radius:99px}.rbr b{text-align:right}',
    '.xsub2{font-size:12.5px;color:var(--muted);font-weight:700;margin:10px 0 2px}.li small{display:block;color:var(--muted);font-size:12px;font-weight:400}',
    '.rtr{font-size:12.5px;color:#9a3412}.rdh{display:flex;gap:8px;margin-bottom:12px}.rdetail .rbar{margin-top:8px}.rnote{font-size:13.5px;color:#334155;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-top:8px;white-space:pre-wrap}',
    '.rtrh{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:18px 0 10px;flex-wrap:wrap}.rtrh h4{margin:0;font-size:16px}.rtrh small{color:var(--muted);font-weight:400}',
    '.rtrial{border-left:5px solid #ea580c;margin-bottom:10px}.rtrt{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rtrt b{font-size:15px}.rtrt span{color:var(--muted);font-size:13px}.rres{font-weight:700;font-size:12px!important;border-radius:99px;padding:2px 10px;background:#f1f5f9}.rres.pass{background:#f0fdf4;color:#15803d!important}.rres.fail{background:#fef2f2;color:#b91c1c!important}',
    '.rtrm{font-size:13px;color:#334155;margin-top:4px}.rtrb{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.rph{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.rph span{position:relative}.rph img{width:84px;height:84px;object-fit:cover;border-radius:10px;display:block}.rph em{position:absolute;left:4px;bottom:4px;font-size:10px;font-style:normal;background:#000a;color:#fff;border-radius:6px;padding:1px 5px}.rph button{position:absolute;top:2px;right:2px;border:0;border-radius:50%;width:22px;height:22px;background:#fff;box-shadow:var(--shadow);cursor:pointer;display:grid;place-items:center}',
    '.radd{width:84px;height:84px;border:2px dashed var(--line);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px;color:var(--muted);cursor:pointer;margin:0}',
    '.rhint{font-size:13px;background:#fff7ed;color:#9a3412;border-radius:8px;padding:8px 10px;margin-bottom:10px}',
    '.ring{border:1.5px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:8px}.rir{display:grid;grid-template-columns:24px minmax(0,2fr) minmax(0,1fr) 52px minmax(0,1fr) 52px 30px;gap:6px;align-items:center;padding:5px 8px;border-top:1px solid var(--line)}.rir input{min-width:0;border:1.5px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;font-size:14px}.rir em{font-style:normal;font-size:12.5px;color:var(--muted);text-align:right}',
    '.rih{background:#f8fafc;border-top:0;font-size:12px;color:var(--muted);font-weight:700}.rit{background:#fdf2f8}.rit b{font-size:13.5px}.rit b:nth-child(n+3){text-align:right}',
    '.rsens{display:grid;gap:6px}.rsr{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px dashed var(--line);padding:4px 0}.rsr span{font-size:14px}.rsr div{display:flex;gap:4px}.rsb{width:36px;height:34px;border:1.5px solid var(--line);border-radius:8px;background:#fff;font:inherit;font-weight:700;cursor:pointer}.rsb.on{background:#db2777;border-color:#db2777;color:#fff}',
    '.rform{background:#fff;padding:18px;border-radius:10px;font-size:13px;color:#111;text-align:left;max-width:1000px}.rform td,.rform th,.rform div,.rform span{text-align:left}.rdh .btn{width:auto;flex:none}.rfh{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:10px;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:8px}.rfh span{display:block;font-size:12px}.rfc{text-align:center}.rfc b{font-size:16px;display:block}.rfr{text-align:right;font-size:11px}',
    '.rfrow{display:flex;flex-wrap:wrap;gap:6px 24px;padding:4px 0}.rfgrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;margin-top:8px}.rfgrid>div{min-width:0}.rft{width:100%;border-collapse:collapse;margin-bottom:8px}.rft th,.rft td{border:1px solid #444;padding:3px 6px;font-size:12px;vertical-align:top}.rft th{background:#f3f4f6}.rform .rft .r{text-align:right}.rform .rft .c{text-align:center}.rform .rfc,.rform .rfc b,.rform .rfc span{text-align:center}.rform .rfr{text-align:right}.rform .rfsign div{text-align:center}.rft tr.tot td{font-weight:700;background:#fdf2f8}',
    '.rfs{margin:6px 0}.rfs b{display:block;text-decoration:underline}.rfs div{white-space:normal;line-height:1.5}.rfimg{border:1px solid #444;height:170px;display:grid;place-items:center;margin-bottom:8px;overflow:hidden}.rfimg img{max-width:100%;max-height:100%;object-fit:contain}.rfimg span{color:#888}',
    '.rfres{display:flex;gap:16px;align-items:center;margin:6px 0}.rfnote{color:#555;font-size:11px}.rfphotos{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.rfphotos img{height:110px;border:1px solid #ccc}.rfsign{display:flex;justify-content:space-around;margin-top:28px;text-align:center;line-height:1.9}',
    '@media print{.rform{padding:0;font-size:10pt}.rft th,.rft td{font-size:9pt}.rfimg{height:150px}}',
    '@media (max-width:760px){.rcards{grid-template-columns:minmax(0,1fr)}.rir{grid-template-columns:20px minmax(0,1fr) 64px 40px 30px;row-gap:4px}.rir > :nth-child(5),.rir > :nth-child(6){grid-row:2}.rir > :nth-child(5){grid-column:3}.rir > :nth-child(6){grid-column:4}.rfgrid{grid-template-columns:minmax(0,1fr)}.rfh{grid-template-columns:1fr}.rfc,.rfr{text-align:left}}'
  ].join('\n');
  document.head.appendChild(css);
})();
