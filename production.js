// ==================== ฝ่ายผลิต (PROD) ====================
// หน้าเว็บของโมดูล "production" — index.html เรียก PRDM.menus() / PRDM.render(page)
// ข้อมูลผ่าน API Prod.gs (prdLoad, prdSavePlans, ...) · กลุ่มงาน G2 งานผัด · G1 บรรจุลงซอง/ถ้วย · G3 บรรจุลงลัง
// หน้าหลัก "แผนผลิต / บันทึกผล": เช้าใส่แผน → ส่งแผนเข้า LINE · เย็นแต่ละกลุ่มใส่ผลจริง ปัญหา รูป → ส่งสรุปของกลุ่มตัวเอง
(function () {
  var H = window.PRDM = { data: null, loading: null, q: {}, day: null };
  Object.assign(ICONS, {
    flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    gear2: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>', back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>'
  });
  var MENUS = [
    { id: 'p_day', label: 'แผนผลิต / บันทึกผล', ic: 'list' },
    { id: 'p_dash', label: 'ภาพรวม / Dashboard', ic: 'chart' },
    { id: 'p_bd', label: 'Breakdown เครื่องจักร', ic: 'gear2' },
    { id: 'p_prod', label: 'สินค้า & มาตรฐาน Yield', ic: 'box' },
    { id: 'p_set', label: 'ตั้งค่า / LINE', ic: 'gear' },
    { id: 'p_log', label: 'ประวัติการแก้ไข', ic: 'clock' }
  ];
  var GROUPS = [['G2', 'งานผัด', '#EA580C'], ['G1', 'บรรจุลงซอง/ถ้วย', '#2563EB'], ['G3', 'บรรจุลงลัง', '#16A34A']];
  var GNAME = { G2: 'งานผัด', G1: 'บรรจุลงซอง/ถ้วย', G3: 'บรรจุลงลัง' }, GCOLOR = { G2: '#EA580C', G1: '#2563EB', G3: '#16A34A' };
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  // ---------- ตัวช่วย ----------
  function pad(n) { return ('0' + n).slice(-2); }
  function addDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dd(iso) { if (!iso) return '-'; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(2) : esc(iso); }
  function dayName(iso) { var p = iso.split('-'); return 'วัน' + DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function list(s) { return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
  function num(v) { if (v === '' || v == null) return ''; var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : ''; }
  function fmt(n, d) { return n === '' || n == null || isNaN(n) ? '-' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 2 : d }); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function S_() { return H.data.settings; }
  function target(p) { var t = p && p.target !== '' && p.target != null ? Number(p.target) : NaN; return isFinite(t) && t > 0 ? t : (Number(S_().target) || 85); }
  function prodOf(id) { return H.data.products.filter(function (p) { return p.id === id; })[0]; }
  function me() { try { return localStorage.getItem('prd_by') || ''; } catch (e) { return ''; } }
  function setMe(v) { try { localStorage.setItem('prd_by', v); } catch (e) {} }
  function wide(cfg) { cfg.wide = true; cfg.color = cfg.color || state.dept.color; openModal(cfg); }
  // ผลคำนวณของรายการ (ตรงกับ prdCalc_ ใน Prod.gs)
  function calc(x) {
    var p = prodOf(x.productId), base = num(x.coolKg) !== '' ? num(x.coolKg) : num(x.fryKg), raw = num(x.rawKg);
    var y = x.grp === 'G2' && raw && base !== '' ? Math.round(base / raw * 10000) / 100 : '';
    var b = num(x.actBatch) !== '' ? num(x.actBatch) : num(x.planBatch);
    var eb = num(x.planBatch) !== '' ? num(x.planBatch) : num(x.actBatch);   // ช่วงที่ควรได้ คิดจากแผน (ไม่เปลี่ยนตามที่กรอกผล)
    var lo = p && x.grp === 'G2' && eb !== '' && p.qtyMin !== '' ? Math.round(p.qtyMin * eb) : '', hi = p && x.grp === 'G2' && eb !== '' && p.qtyMax !== '' ? Math.round(p.qtyMax * eb) : '';
    var q = num(x.actQty), qs = q === '' || lo === '' ? '' : q < lo ? 'low' : q > hi ? 'high' : 'ok';
    return { yieldPct: y, lossPct: y === '' ? '' : Math.round((100 - y) * 100) / 100, target: target(p), expMin: lo, expMax: hi, qtyState: qs, rawStd: p && p.rawKg !== '' && b !== '' ? Math.round(p.rawKg * b * 1000) / 1000 : '', unit: (p && p.unit) || 'ชิ้น', usedFry: num(x.coolKg) === '' && num(x.fryKg) !== '' };
  }
  // กำหนดเสร็จ: G2 ภายในวันผลิต · G1 / G3 ไม่เกิน 3 วัน (ตรงกับ prdDeadline_ ใน Prod.gs)
  function deadline(x) { var p = String(x.date || '').split('-'), n = x.grp === 'G2' ? 0 : 3; if (p.length !== 3 || !n) return x.date; var t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return t.toISOString().slice(0, 10); }
  function finState(x) { var dl = deadline(x); return x.finishDate ? (x.finishDate <= dl ? 'ok' : 'late') : (H.data.today > dl ? 'over' : 'wait'); }
  function finHtml(i, x) {
    var fs = finState(x), dl = deadline(x), causes = list(S_().lateCauses), other = x._lcO || (x.lateCause && causes.indexOf(x.lateCause) < 0);
    var head = fs === 'ok' ? '<b class="ok">✓ เสร็จตามกำหนด</b>' : fs === 'wait' ? '<b>กำหนดเสร็จ ' + dd(dl) + '</b><small>' + (x.grp === 'G2' ? 'ต้องเสร็จภายในวันผลิต' : 'ไม่เกิน 3 วันหลังวันผลิต') + ' · เสร็จแล้วให้เลือกวันที่เสร็จ</small>'
      : '<b class="bad">⚠️ ' + (fs === 'late' ? 'เสร็จช้ากว่ากำหนด' : 'ยังไม่เสร็จ เลยกำหนดแล้ว') + '</b><small>กำหนดเสร็จ ' + dd(dl) + (x.grp === 'G2' ? ' (ภายในวันผลิต)' : ' (ไม่เกิน 3 วัน)') + '</small>';
    if (fs === 'ok' || fs === 'wait') return '<div class="xfin ' + fs + '">' + head + '</div>';
    return '<div class="xfin bad">' + head + '<div class="xlc"><label class="xf"><span>สาเหตุ' + (fs === 'late' ? ' (ต้องใส่)' : '') + '</span><span class="xin"><select data-lcs="' + i + '"><option value="">— เลือกสาเหตุ —</option>'
      + causes.map(function (c) { return '<option' + (!other && x.lateCause === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value="__other"' + (other ? ' selected' : '') + '>อื่น ๆ (ระบุ)</option></select></span></label>'
      + (other ? '<label class="xf"><span>ระบุสาเหตุ</span><span class="xin"><input data-i="' + i + '" data-k="lateCause" value="' + esc(x.lateCause || '') + '" maxlength="200" placeholder="พิมพ์สาเหตุ"></span></label>' : '') + '</div></div>';
  }
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

  // ---------- โหลด ----------
  H.load = function (from, to) {
    if (H.loading) return H.loading;
    H.loading = call('prdLoad', state.token, from || '', to || '').then(function (d) { H.data = d; H.loading = null; return d; }, function (e) { H.loading = null; throw e; });
    return H.loading;
  };
  H.reset = function () { H.data = null; H.q = {}; H.day = null; };
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
    ({ p_day: dayPage, p_dash: dash, p_bd: bdPage, p_prod: prodPage, p_set: settings, p_log: logPage }[page] || dayPage)();
  };

  // ==================== แผนผลิต / บันทึกผล (รายวัน) ====================
  // LOT เป็นวันที่ (yyyy-MM-dd) · ข้อมูลเก่าที่พิมพ์ 16/11/26 แปลงให้
  function lotIso(v) {
    var s = String(v || '').trim().replace(/^'/, ''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if (!m) return '';
    var y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543; return y + '-' + pad(m[2]) + '-' + pad(m[1]);
  }
  function lotText(v) { var i = lotIso(v); return i ? dd(i) : String(v || ''); }
  function dayItems(date) { return H.data.plans.filter(function (x) { return x.date === date; }).map(function (x) { var y = JSON.parse(JSON.stringify(x)); y.lot = lotIso(y.lot) || (y.grp === 'G2' ? y.date : ''); return y; }); }
  function ensureRange(date) {
    if (date >= H.data.from && date <= H.data.to) return Promise.resolve();
    return H.load(addDays(date, -30), addDays(date, 30));
  }
  function dayPage() {
    var q = H.q, t = H.data.today;
    q.date = q.date || t; q.mode = q.mode || 'm'; if (!GNAME[q.tab]) q.tab = 'G2';
    // ข้อมูลโหลดใหม่ (และยังไม่ได้แก้อะไร) หรือเปลี่ยนวัน → อ่านรายการของวันนั้นใหม่
    if (!H.day || H.day.date !== q.date || (H.day.src !== H.data && !H.day.dirty)) H.day = { date: q.date, items: dayItems(q.date), dirty: false, src: H.data };
    var D = H.day, items = D.items;
    var cnt = function (g) { return items.filter(function (x) { return x.grp === g; }).length; };
    var rep = function (kind, g) { return H.data.reports.filter(function (r) { return r.date === D.date && r.kind === kind && String(r.grp || '') === String(g || ''); })[0]; };
    var mr = rep('morning', '');
    $('main').innerHTML = '<div class="xdhead"><h3>แผนผลิต / บันทึกผล</h3>'
      + '<div class="xdate"><button class="icon-btn" id="dPrev" aria-label="วันก่อนหน้า">‹</button><label><span>' + dayName(D.date) + '</span><input type="date" id="dDate" value="' + D.date + '"></label><button class="icon-btn" id="dNext" aria-label="วันถัดไป">›</button>'
      + (D.date !== t ? '<button class="btn btn-line btn-sm" id="dToday">วันนี้</button>' : '') + '</div>'
      + '<label class="xme">ผู้บันทึก <input id="dMe" value="' + esc(me()) + '" placeholder="ชื่อของคุณ" maxlength="40"></label></div>'
      // เช้า = ใส่แผน + ส่งแผน · เย็น = ใส่ผลจริงทีละกลุ่ม + ส่งสรุปของกลุ่ม (ไม่ปนกัน)
      + '<div class="xmode" role="tablist">' + [['m', '🌅 แผนเช้า', 'ใส่แผนผลิตของวันนี้ แล้วส่งแผนเข้า LINE', mr && mr.sentAt], ['e', '🌙 สรุปเย็น', 'ใส่ผลผลิตจริงของแต่ละกลุ่ม แล้วส่งสรุป', null]].map(function (x) {
        return '<button role="tab" class="xmb' + (q.mode === x[0] ? ' on' : '') + '" data-mode="' + x[0] + '" aria-selected="' + (q.mode === x[0]) + '"><b>' + x[1] + (x[3] ? ' <small class="xok">✓ ส่งแล้ว</small>' : '') + '</b><span>' + x[2] + '</span></button>';
      }).join('') + '</div>'
      + (q.mode === 'e' ? '<div class="xtabs xtabs3" role="tablist">' + GROUPS.map(function (g) {
        var r = rep('evening', g[0]);
        return '<button role="tab" class="xtab' + (q.tab === g[0] ? ' on' : '') + '" data-tab="' + g[0] + '" style="--g:' + g[2] + '" aria-selected="' + (q.tab === g[0]) + '"><b>' + g[0] + ' ' + esc(g[1]) + '</b><small>' + cnt(g[0]) + ' รายการ' + (r && r.sentAt ? ' · ส่งแล้ว ✓' : '') + '</small></button>';
      }).join('') + '</div>' : '') + '<div id="dBody"></div>'
      + '<div class="xsave" id="dSaveBar"' + (D.dirty ? '' : ' hidden') + '><span>มีการแก้ไขที่ยังไม่บันทึก</span><button class="btn btn-line" id="dUndo">ยกเลิก</button><button class="btn btn-primary" id="dSave">' + icon('check', 18) + ' บันทึก</button></div>';
    if (q.mode === 'm') planTab(mr); else groupTab(q.tab, rep('evening', q.tab));
    var goDate = function (d) {
      if (!d) return;
      var doIt = function () { H.q.date = d; H.day = null; ensureRange(d).then(dayPage).catch(onServerError); };
      if (!D.dirty) return doIt();
      ask({ title: 'ยังไม่ได้บันทึก', text: 'ข้อมูลที่แก้ไขของวันนี้จะหายไป ถ้าเปลี่ยนวันตอนนี้', ok: 'เปลี่ยนวันโดยไม่บันทึก', cancel: 'อยู่ต่อ', tone: 'warn' }).then(function (ok) { if (ok) doIt(); else $('dDate').value = D.date; });
    };
    $('dPrev').addEventListener('click', function () { goDate(addDays(D.date, -1)); });
    $('dNext').addEventListener('click', function () { goDate(addDays(D.date, 1)); });
    $('dDate').addEventListener('change', function () { goDate(this.value); });
    if ($('dToday')) $('dToday').addEventListener('click', function () { goDate(t); });
    $('dMe').addEventListener('change', function () { setMe(this.value.trim()); });
    on('[data-tab]', 'click', function (el) { collect(); H.q.tab = el.getAttribute('data-tab'); dayPage(); }, $('main'));
    on('[data-mode]', 'click', function (el) { collect(); H.q.mode = el.getAttribute('data-mode'); dayPage(); window.scrollTo(0, 0); }, $('main'));
    $('dSave').addEventListener('click', saveDay);
    $('dUndo').addEventListener('click', function () { ask({ title: 'ยกเลิกการแก้ไขทั้งหมดของวันนี้?', ok: 'ยกเลิกการแก้ไข', cancel: 'กลับไปแก้ต่อ', tone: 'warn' }).then(function (ok) { if (ok) { H.day = null; dayPage(); } }); });
  }
  function markDirty() { if (!H.day.dirty) { H.day.dirty = true; var b = $('dSaveBar'); if (b) b.hidden = false; } }
  // อ่านค่าที่พิมพ์ในการ์ดกลับเข้า H.day.items
  function collect() {
    if (!H.day) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-i][data-k]'), function (el) {
      var x = H.day.items[+el.getAttribute('data-i')]; if (x) x[el.getAttribute('data-k')] = el.value.trim();
    });
  }
  function productSelect(i, x) {
    var cats = {}, order = [];
    H.data.products.forEach(function (p) { if (p.active === 'ไม่ใช้' && p.id !== x.productId) return; var c = p.category || 'อื่น ๆ'; if (!cats[c]) { cats[c] = []; order.push(c); } cats[c].push(p); });
    return '<select class="xprod" data-pi="' + i + '" aria-label="สินค้า"><option value="">— เลือกสินค้า —</option>' + order.map(function (c) {
      return '<optgroup label="' + esc(c) + '">' + cats[c].map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === x.productId ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + (x.productId && !prodOf(x.productId) && x.product ? '<option value="' + esc(x.productId) + '" selected>' + esc(x.product) + '</option>' : '') + '<option value="__new">+ เพิ่มสินค้าใหม่…</option></select>';
  }
  function fi(i, k, label, val, attrs, unit) {
    return '<label class="xf"><span>' + label + '</span><span class="xin"><input data-i="' + i + '" data-k="' + k + '" value="' + esc(val == null ? '' : val) + '"' + (attrs || ' inputmode="decimal"') + '>' + (unit ? '<em>' + unit + '</em>' : '') + '</span></label>';
  }
  // ---- แผนเช้า: ใส่แผนของทุกกลุ่ม (เฉพาะช่องแผน) แล้วส่งแผนเข้า LINE เป็นการ์ดเดียว
  function planTab(mr) {
    var D = H.day, s = S_(), html = '';
    GROUPS.forEach(function (g) {
      var its = []; D.items.forEach(function (x, i) { if (x.grp === g[0]) its.push(i); });
      var gl = g[0] === 'G2' ? 'งานเตรียมวัตถุดิบ/ทอด/ผัด/อบ' : g[1];
      html += '<section class="xgsec" style="--g:' + g[2] + '"><h4 class="xgh"><span>' + g[0] + '</span>' + esc(gl) + ' <small>' + its.length + ' รายการ</small></h4>'
        + its.map(function (i, n) { return itemCard(D.items[i], i, n, 'm'); }).join('')
        + '<button class="btn btn-line xadd" data-add="' + g[0] + '" style="--g:' + g[2] + '">' + icon('plus', 18) + ' เพิ่มแผน ' + g[0] + ' · ' + esc(gl) + '</button></section>';
    });
    html += '<div class="panel pbox xeve" style="--g:#0E7490"><h4>' + icon('send', 18) + ' ส่งแผนผลิตเข้า LINE</h4><p class="muted" style="margin:0 0 10px;font-size:13px">ส่งแผนของทุกกลุ่ม (G2 / G1 / G3) รวมเป็นการ์ดเดียว · กด "บันทึก" ก่อนส่ง</p>'
      + '<label class="xf full"><span>ข้อความท้ายการ์ด</span><span class="xin"><input id="mNote" value="' + esc(mr && mr.note ? mr.note : s.morningNote) + '" maxlength="200"></span></label>'
      + '<div class="xsend"><button class="btn btn-primary" id="mSend" style="--c:#06c755">' + icon('send', 18) + ' ดูตัวอย่าง & ส่งแผนผลิต</button>' + (mr && mr.sentAt ? '<span class="xok">✓ ส่งแล้ว ' + esc(mr.sentAt.slice(11, 16)) + ' น.</span>' : '') + '</div></div>';
    $('dBody').innerHTML = html;
    bindCards();
    on('[data-add]', 'click', function (el) { addItem(el.getAttribute('data-add')); }, $('dBody'));
    $('mSend').addEventListener('click', function () {
      if (H.day.dirty) return toast('กด "บันทึก" ก่อน แล้วค่อยส่ง');
      if (!D.items.length) return toast('ยังไม่มีแผนของวันนี้');
      var b = this; b.disabled = true;
      call('prdSaveReport', state.token, { date: D.date, kind: 'morning', note: $('mNote').value, by: me() }).then(function (r) {
        b.disabled = false; if (!r.ok) return toast(r.error); upsertReport(r.report); sendLine('morning', D.date, '');
      }).catch(function (e) { b.disabled = false; onServerError(e); });
    });
  }
  function addItem(g) {
    collect();
    var D = H.day, last = D.items.filter(function (x) { return x.grp === g; }).slice(-1)[0];
    D.items.push({ grp: g, date: D.date, productId: '', product: '', lot: g === 'G2' ? D.date : (last ? last.lot : ''), planBatch: '', planQty: '', status: 'plan', _new: true });
    markDirty(); dayPage();
    var cards = document.querySelectorAll('.xcard[data-g="' + g + '"]'); var c = cards[cards.length - 1]; if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); var sel = c.querySelector('select'); if (sel) sel.focus(); }
  }
  function upsertReport(r) { var a = H.data.reports, i = a.map(function (x) { return x.id; }).indexOf(r.id); if (i >= 0) a[i] = r; else a.push(r); }
  // ---- แท็บกลุ่มงาน: การ์ดรายการ (แผน + ผลจริง) + สรุปเย็น
  function groupTab(g, rep) {
    var D = H.day, s = S_(), its = [];
    D.items.forEach(function (x, i) { if (x.grp === g) its.push(i); });
    var causes = list(s.lossCauses);
    var html = '<datalist id="xUnits">' + list(s.units).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist><datalist id="xCauses">' + causes.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>'
      + (its.length ? '<p class="muted" style="margin:0 0 10px;font-size:13px">รายการดึงมาจากแผนเช้า — กรอกผลลัพธ์ของแต่ละรายการ (ต้องการเพิ่ม / แก้แผน ให้ไปที่ "🌅 แผนเช้า")</p>'
        : '<div class="panel" style="font-size:14px">ยังไม่มีแผนของ ' + g + ' วันนี้ <button class="btn btn-line btn-sm" id="gToPlan" style="margin-left:8px">ไปใส่แผนที่ 🌅 แผนเช้า</button></div>')
      + its.map(function (i, n) { return itemCard(D.items[i], i, n, 'e'); }).join('');
    // สรุปเย็นของกลุ่ม
    var checks = list(s.checks), done = rep && rep.checks ? list(rep.checks) : [];
    var secs = H.secDraft && H.secDraft.key === D.date + g ? H.secDraft.list : ((rep && rep.sections) || []).map(function (x) {
      return { title: x.title, text: x.text || '', rows: (x.rows || []).map(function (r) { return { product: r.product, lot: lotIso(r.lot), qty: r.qty, unit: r.unit }; }) };
    });
    H.secDraft = { key: D.date + g, list: secs };
    var EVE = { G2: 'สรุปงานเตรียม/ทอด/ผัด/อบ', G1: 'สรุปงานบรรจุ', G3: 'สรุปงานบรรจุ' };
    var dp = D.date.split('-'), defT = EVE[g] + ' ประจำวันที่ ' + dp[2] + '/' + dp[1] + '/' + String(+dp[0] + 543).slice(2);
    html += '<section class="panel pbox xeve" style="--g:' + GCOLOR[g] + '"><h4>🌙 สรุปงานเย็น ' + g + ' · ' + GNAME[g] + '</h4>'
      + '<p class="muted" style="margin:0 0 10px;font-size:13px">คนที่กรอกผลของกลุ่มนี้ เป็นคนกดส่งสรุปเข้า LINE · รูปจะส่งแยกเป็นภาพ ๆ ต่อจากการ์ด</p>'
      + '<label class="xf full"><span>หัวข้อข้อความ</span><span class="xin"><input id="gTitle" value="' + esc(rep && rep.title ? rep.title : defT) + '" placeholder="' + esc(defT) + '" maxlength="100"></span></label>'
      + '<small class="muted" style="display:block;margin:4px 0 0">ขึ้นเป็นหัวการ์ด LINE · แก้ข้อความได้ (ลบให้ว่าง = กลับเป็นค่าเริ่มต้น)</small>'
      + '<div class="xsub">หัวข้อเพิ่มเติม (พิมพ์เอง)</div><datalist id="xSecT">' + list(s.sectionTitles).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>'
      + '<datalist id="xProdL">' + H.data.products.filter(function (p) { return p.active !== 'ไม่ใช้'; }).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('') + '</datalist>'
      + '<datalist id="xSecU"><option value="batch"><option value="kg.">' + list(s.units).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '<option value="ลัง"></datalist>'
      + '<div id="gSecs">' + secs.map(function (x, k) {
        return '<div class="xsec"><div class="xsech"><span class="xin"><input data-st="' + k + '" value="' + esc(x.title) + '" list="xSecT" placeholder="ชื่อหัวข้อ เช่น น้ำพริกค้างแพ็ค" maxlength="80"></span><button class="icon-btn" data-sdel="' + k + '" aria-label="ลบหัวข้อนี้">' + icon('trash', 16) + '</button></div>'
          + (x.rows || []).map(function (r, j) {
            return '<div class="xsrw"><span class="xsn">' + (j + 1) + '.</span><label class="xf xsp"><span>สินค้า / รายการ</span><span class="xin"><input data-sr="' + k + ':' + j + ':product" value="' + esc(r.product || '') + '" list="xProdL" placeholder="เลือกหรือพิมพ์" maxlength="150"></span></label>'
              + '<label class="xf xsl"><span>LOT (วันที่)</span><span class="xin"><input type="date" data-sr="' + k + ':' + j + ':lot" value="' + esc(r.lot || '') + '"></span></label>'
              + '<label class="xf xsq"><span>จำนวน</span><span class="xin"><input data-sr="' + k + ':' + j + ':qty" value="' + esc(r.qty == null ? '' : r.qty) + '" inputmode="decimal"></span></label>'
              + '<label class="xf xsu"><span>หน่วย</span><span class="xin"><input data-sr="' + k + ':' + j + ':unit" value="' + esc(r.unit || '') + '" list="xSecU" placeholder="batch" maxlength="20"></span></label>'
              + '<button class="icon-btn" data-srdel="' + k + ':' + j + '" aria-label="ลบรายการ">' + icon('x', 16) + '</button></div>';
          }).join('')
          + '<button class="btn btn-line btn-sm" data-sradd="' + k + '">' + icon('plus', 16) + ' เพิ่มรายการ (สินค้า + LOT)</button>'
          + '<textarea data-sx="' + k + '" rows="' + Math.max(2, String(x.text || '').split('\n').length) + '" placeholder="ข้อความเพิ่มเติม (ไม่บังคับ) เช่น ทอดเกล็ดขนมปัง 300 kg.">' + esc(x.text) + '</textarea></div>';
      }).join('') + '</div>'
      + '<button class="btn btn-line btn-sm" id="gSecAdd">' + icon('plus', 16) + ' เพิ่มหัวข้อ</button>'
      + '<label class="xf full" style="margin-top:12px"><span>ปัญหาที่พบ</span><textarea id="gProb" rows="3" placeholder="ไม่มี เว้นว่างไว้ได้ (จะขึ้นว่า -)">' + esc(rep ? rep.problems : '') + '</textarea></label>'
      + '<div class="xsub">ปิดงาน</div><div class="xchecks">' + checks.map(function (c) { return '<label class="xchk"><input type="checkbox" data-chk="' + esc(c) + '"' + (done.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(c) + '</label>'; }).join('') + '</div>'
      + '<div class="xsub">รูปประกอบ ' + (rep && rep.files.length ? '(' + rep.files.length + ')' : '') + '</div><div class="xphotos" id="gPhotos">' + photosHtml(rep) + '</div>'
      + '<div class="xsend"><button class="btn btn-primary" id="gSend" style="--c:#06c755">' + icon('send', 18) + ' ดูตัวอย่าง & ส่งสรุป ' + g + '</button>' + (rep && rep.sentAt ? '<span class="xok">✓ ส่งแล้ว ' + esc(rep.sentAt.slice(11, 16)) + ' น.</span>' : '') + '</div></section>';
    $('dBody').innerHTML = html;
    bindCards();
    if ($('gToPlan')) $('gToPlan').addEventListener('click', function () { collect(); H.q.mode = 'm'; dayPage(); });
    var readSecs = readSecDraft;
    on('[data-sradd]', 'click', function (el) {
      readSecs(); var k = +el.getAttribute('data-sradd'), rows = secs[k].rows = secs[k].rows || [], last = rows[rows.length - 1];
      rows.push({ product: '', lot: last ? last.lot : '', qty: '', unit: last ? last.unit : 'batch' }); collect(); dayPage();
      var inp = document.querySelector('[data-sr="' + k + ':' + (rows.length - 1) + ':product"]'); if (inp) inp.focus();
    }, $('dBody'));
    on('[data-srdel]', 'click', function (el) { readSecs(); var a = el.getAttribute('data-srdel').split(':'); secs[+a[0]].rows.splice(+a[1], 1); saveEvening(g, true).then(function () { collect(); dayPage(); }); }, $('dBody'));
    on('[data-sr]', 'change', function () { readSecs(); saveEvening(g, true); }, $('dBody'));
    $('gSecAdd').addEventListener('click', function () {
      readSecs(); secs.push({ title: '', text: '', rows: [{ product: '', lot: '', qty: '', unit: 'batch' }] }); collect(); dayPage();
      var inps = document.querySelectorAll('[data-st]'); if (inps.length) inps[inps.length - 1].focus();
    });
    on('[data-sdel]', 'click', function (el) {
      readSecs(); var k = +el.getAttribute('data-sdel');
      ask({ title: 'ลบหัวข้อ "' + (secs[k].title || 'ไม่มีชื่อ') + '"?', text: 'ข้อความในหัวข้อนี้จะหายไป' }).then(function (ok) { if (!ok) return; secs.splice(k, 1); saveEvening(g, true).then(function () { collect(); dayPage(); }); });
    }, $('dBody'));
    on('[data-st],[data-sx]', 'change', function () { readSecs(); saveEvening(g, true); }, $('dBody'));
    $('gTitle').addEventListener('change', function () { saveEvening(g, true); });
    on('[data-chk]', 'change', function () { saveEvening(g, true); }, $('dBody'));
    $('gProb').addEventListener('change', function () { saveEvening(g, true); });
    bindPhotos(g);
    $('gSend').addEventListener('click', function () {
      if (H.day.dirty) return toast('กด "บันทึก" ก่อน แล้วค่อยส่ง');
      var b = this; b.disabled = true;
      saveEvening(g).then(function (ok) { b.disabled = false; if (ok) sendLine('evening', D.date, g); });
    });
  }
  // การ์ดรายการ: mode 'm' = เฉพาะช่องแผน · 'e' = ผลจริง (แสดงแผนเป็นบรรทัดสรุป)
  function itemCard(x, i, n, mode) {
    var g = x.grp, c = calc(x), tags = '';
    var head = '<article class="xcard" data-g="' + g + '" style="--g:' + GCOLOR[g] + '"><div class="xch"><span class="xno">' + (n + 1) + '</span>' + productSelect(i, x)
      + '<button class="icon-btn" data-del="' + i + '" aria-label="ลบรายการ" title="ลบรายการ">' + icon('trash', 16) + '</button></div>';
    if (mode === 'm') {
      var plan = fi(i, 'lot', 'LOT (วันที่ผลิต)', x.lot, ' type="date"')
        + (g === 'G3' ? fi(i, 'planQty', 'แผน (ลัง)', x.planQty) : fi(i, 'planBatch', 'แผน (batch)', x.planBatch))
        + fi(i, 'note', 'หมายเหตุ', x.note, ' maxlength="200"');
      return head + '<div class="xgrid" style="margin-top:10px">' + plan + '</div></article>';
    }
    if (g === 'G2' && c.yieldPct !== '') tags += '<span class="xy ' + (c.yieldPct >= c.target ? 'ok' : 'bad') + '">Yield ' + fmt(c.yieldPct) + '%</span>';
    if (c.qtyState) tags += '<span class="xq ' + c.qtyState + '">' + (c.qtyState === 'ok' ? '✓ ตามช่วง' : c.qtyState === 'low' ? '↓ ต่ำกว่าช่วง' : '↑ เกินช่วง') + '</span>';
    if (x.status === 'cancel') tags += '<span class="xdu late">ยกเลิก</span>';
    var chips = [x.lot ? 'LOT ' + lotText(x.lot) : '', x.planBatch !== '' && x.planBatch != null ? 'แผน ' + fmt(x.planBatch) + ' batch' : '', x.planQty !== '' && x.planQty != null ? 'แผน ' + fmt(x.planQty) + ' ลัง' : '', x.note || ''].filter(String);
    var res = g === 'G2'
      ? fi(i, 'actBatch', 'ทำจริง (batch)', x.actBatch, ' inputmode="decimal" placeholder="' + esc(x.planBatch || '') + '"')
        + fi(i, 'rawKg', 'น้ำหนักวัตถุดิบ', x.rawKg, ' inputmode="decimal"' + (c.rawStd !== '' ? ' placeholder="มาตรฐาน ' + c.rawStd + '"' : ''), 'กก.')
        + fi(i, 'fryKg', 'น้ำหนักหลังผัด', x.fryKg, null, 'กก.') + fi(i, 'coolKg', 'น้ำหนักหลังทำเย็น', x.coolKg, null, 'กก.')
        + '<div class="xcalc" data-calc="' + i + '">' + calcHtml(x, c) + '</div>'
        + fi(i, 'actQty', 'จำนวนที่ผลิตได้จริง', x.actQty, ' inputmode="numeric"', c.unit)
      : fi(i, 'actQty', g === 'G1' ? 'จำนวนที่บรรจุได้' : 'จำนวนที่บรรจุลงลัง', x.actQty, ' inputmode="numeric"')
        + fi(i, 'unit', 'หน่วย', x.unit, ' list="xUnits" maxlength="20" placeholder="' + esc(c.unit) + '"') + (g === 'G3' ? fi(i, 'actCases', 'จำนวนลัง', x.actCases, ' inputmode="numeric"', 'ลัง') : '');
    res += fi(i, 'lossKg', 'ของเสีย (น้ำหนัก)', x.lossKg, null, 'กก.') + fi(i, 'lossQty', 'ของเสีย (จำนวน)', x.lossQty, ' inputmode="numeric"', 'ชิ้น')
      + fi(i, 'lossNote', 'สาเหตุของเสีย', x.lossNote, ' list="xCauses" maxlength="150"') + fi(i, 'finishDate', 'วันที่เสร็จ', x.finishDate, ' type="date" min="' + esc(x.date || '') + '"')
      + '<div class="xfinw" data-fin="' + i + '">' + finHtml(i, x) + '</div>';
    // หัวการ์ดเย็น: สินค้าจากแผนเช้า (แก้ไม่ได้ที่นี่) + ข้อมูลแผน
    return '<article class="xcard" data-g="' + g + '" style="--g:' + GCOLOR[g] + '"><div class="xch"><span class="xno">' + (n + 1) + '</span><div class="xpname"><b>' + esc(x.product || '(ยังไม่เลือกสินค้า)') + '</b>'
      + '<div class="xchips">' + chips.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div></div></div>'
      + (tags ? '<div class="xtags">' + tags + '</div>' : '')
      + '<div class="xgrid" style="margin-top:10px">' + res + '</div>'
      + '<label class="xchk"><input type="checkbox" data-cancel="' + i + '"' + (x.status === 'cancel' ? ' checked' : '') + '> ยกเลิกรายการนี้ (ไม่ได้ผลิต)</label></article>';
  }
  function calcHtml(x, c) {
    if (x.grp !== 'G2') return '';
    var y = c.yieldPct;
    return '<div class="xyb ' + (y === '' ? '' : y >= c.target ? 'ok' : 'bad') + '"><span>Yield' + (c.usedFry ? ' (ใช้น้ำหนักหลังผัด)' : '') + '</span><b>' + (y === '' ? '–' : fmt(y) + '%') + '</b><small>เป้า ≥ ' + c.target + '%</small></div>'
      + '<div class="xyb"><span>% Lost</span><b>' + (c.lossPct === '' ? '–' : fmt(c.lossPct) + '%') + '</b><small>= 100 − Yield</small></div>'
      + '<div class="xyb ' + (c.qtyState === 'ok' ? 'ok' : c.qtyState ? 'bad' : '') + '"><span>ควรได้</span><b>' + (c.expMin === '' ? '–' : fmt(c.expMin, 0) + (c.expMax !== c.expMin ? '–' + fmt(c.expMax, 0) : '')) + '</b><small>' + (c.qtyState === 'ok' ? '✓ ได้ตามช่วง' : c.qtyState === 'low' ? '↓ ได้น้อยกว่าช่วง' : c.qtyState === 'high' ? '↑ ได้มากกว่าช่วง' : c.unit) + '</small></div>';
  }
  function bindCards() {
    var D = H.day, root = $('dBody');
    on('[data-i][data-k]', 'input', function (el) {
      var i = +el.getAttribute('data-i'), x = D.items[i]; x[el.getAttribute('data-k')] = el.value.trim(); markDirty();
      var box = root.querySelector('[data-calc="' + i + '"]'); if (box) box.innerHTML = calcHtml(x, calc(x));
      if (el.getAttribute('data-k') === 'finishDate') { var fb = root.querySelector('[data-fin="' + i + '"]'); if (fb) fb.innerHTML = finHtml(i, x); }
    }, root);
    if (!root._lcs) (root._lcs = 1) && root.addEventListener('change', function (e) {   // ผูกครั้งเดียว (กล่องสาเหตุถูกวาดใหม่บ่อย)
      var el = e.target; if (!el.hasAttribute || !el.hasAttribute('data-lcs') || !H.day) return;
      var i = +el.getAttribute('data-lcs'), x = H.day.items[i];
      if (el.value === '__other') { x._lcO = true; x.lateCause = ''; } else { x._lcO = false; x.lateCause = el.value; }
      markDirty(); var fb = this.querySelector('[data-fin="' + i + '"]'); fb.innerHTML = finHtml(i, x);
      var t = fb.querySelector('input'); if (t) t.focus();
    });
    on('[data-pi]', 'change', function (el) {
      var i = +el.getAttribute('data-pi'), x = D.items[i];
      if (el.value === '__new') { el.value = x.productId || ''; return prodForm({}, function (p) { collect(); x.productId = p.id; x.product = p.name; markDirty(); dayPage(); }); }
      var p = prodOf(el.value); x.productId = el.value; x.product = p ? p.name : ''; markDirty(); collect(); dayPage();
    }, root);
    on('[data-cancel]', 'change', function (el) { collect(); var x = D.items[+el.getAttribute('data-cancel')]; x.status = el.checked ? 'cancel' : 'plan'; markDirty(); dayPage(); }, root);
    on('[data-del]', 'click', function (el) {
      var i = +el.getAttribute('data-del'), x = D.items[i];
      ask({ title: 'ลบรายการนี้?', text: (x.product || 'รายการที่ยังไม่เลือกสินค้า') + (x.id ? '\nข้อมูลผลจริงของรายการนี้จะหายไปด้วย' : '') }).then(function (ok) {
        if (!ok) return;
        collect();
        if (!x.id) { D.items.splice(i, 1); return dayPage(); }
        call('prdDeletePlan', state.token, x.id).then(function (r) {
          if (!r.ok) return toast(r.error);
          D.items.splice(i, 1); H.data.plans = H.data.plans.filter(function (y) { return y.id !== x.id; }); toast('ลบแล้ว'); dayPage();
        }).catch(onServerError);
      });
    }, root);
  }
  function saveDay() {
    collect();
    var D = H.day, items = D.items;
    for (var i = 0; i < items.length; i++) {
      var x = items[i];
      if (!x.productId) { H.q.tab = x.grp; dayPage(); return toast('รายการที่ ' + (items.filter(function (y) { return y.grp === x.grp; }).indexOf(x) + 1) + ' ของ ' + x.grp + ': เลือกสินค้า'); }
      if (x.grp === 'G2' && num(x.coolKg) !== '' && num(x.rawKg) === '') { H.q.tab = 'G2'; dayPage(); return toast(x.product + ': ใส่น้ำหนักวัตถุดิบก่อน จึงคิด Yield ได้'); }
      if (x.status !== 'cancel' && finState(x) === 'late' && !String(x.lateCause || '').trim()) { H.q.tab = x.grp; dayPage(); var fb = document.querySelector('[data-fin="' + i + '"]'); if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'center' }); return toast(x.grp + ' ' + x.product + ': เสร็จช้ากว่ากำหนด — เลือกสาเหตุ'); }
    }
    var b = $('dSave'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังบันทึก…';
    var payload = items.map(function (x) { var o = {}; Object.keys(x).forEach(function (k) { if (k[0] !== '_') o[k] = x[k]; }); o.date = D.date; o.by = o.by || me(); return o; });
    call('prdSavePlans', state.token, payload).then(function (r) {
      if (!r.ok) { b.disabled = false; b.innerHTML = icon('check', 18) + ' บันทึก'; return toast(r.error); }
      var ids = {}; r.plans.forEach(function (p) { ids[p.id] = 1; });
      H.data.plans = H.data.plans.filter(function (p) { return !ids[p.id]; }).concat(r.plans);
      H.day = null; toast('บันทึกแล้ว ' + r.plans.length + ' รายการ'); dayPage();
    }).catch(function (e) { b.disabled = false; b.innerHTML = icon('check', 18) + ' บันทึก'; onServerError(e); });
  }
  // อ่านหัวข้อเพิ่มเติมที่พิมพ์ในหน้า กลับเข้า H.secDraft
  function readSecDraft() {
    if (!H.secDraft) return;
    var L = H.secDraft.list;
    Array.prototype.forEach.call(document.querySelectorAll('[data-st]'), function (el) { var x = L[+el.getAttribute('data-st')]; if (x) x.title = el.value.trim(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sx]'), function (el) { var x = L[+el.getAttribute('data-sx')]; if (x) x.text = el.value.replace(/\s+$/, ''); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sr]'), function (el) {
      var a = el.getAttribute('data-sr').split(':'), x = L[+a[0]], r = x && x.rows && x.rows[+a[1]]; if (r) r[a[2]] = el.value.trim();
    });
  }
  function saveEvening(g, quiet) {
    var checks = []; Array.prototype.forEach.call(document.querySelectorAll('[data-chk]'), function (el) { if (el.checked) checks.push(el.getAttribute('data-chk')); });
    readSecDraft();
    return call('prdSaveReport', state.token, { date: H.day.date, kind: 'evening', grp: g, title: $('gTitle') ? $('gTitle').value.trim() : '', sections: H.secDraft ? H.secDraft.list : [],
      problems: $('gProb') ? $('gProb').value : '', checks: checks.join(', '), by: me() }).then(function (r) {
      if (!r.ok) { toast(r.error); return false; }
      upsertReport(r.report); if (quiet) toast('บันทึกสรุปเย็นแล้ว'); return true;
    }).catch(function (e) { onServerError(e); return false; });
  }
  function photosHtml(rep) {
    return (rep ? rep.files : []).map(function (f) { return '<span class="xph"><a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(f.url) + '=w240" alt="" loading="lazy"></a><button type="button" data-fdel="' + esc(f.id) + '" aria-label="ลบรูป">' + icon('x', 14) + '</button></span>'; }).join('')
      + (H.data.hasFolder ? '<label class="xadd2">' + icon('camera', 22) + '<span>ถ่าย / เลือกรูป</span><input type="file" accept="image/*" multiple id="gPick" hidden></label>' : '<span class="muted">ให้ผู้ดูแลระบบตั้งโฟลเดอร์ของฝ่ายก่อน จึงจะแนบรูปได้</span>');
  }
  function bindPhotos(g) {
    var D = H.day;
    if ($('gPick')) $('gPick').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []); if (!files.length) return;
      var i = 0, fails = 0;
      var next = function () {
        if (i >= files.length) { toast(fails ? 'อัปโหลดไม่สำเร็จ ' + fails + ' รูป' : 'แนบรูปแล้ว'); return dayPage(); }
        var f = files[i++]; toast('กำลังอัปโหลดรูป ' + i + '/' + files.length + '…');
        shrink(f).then(function (p) {
          if (!p) { fails++; return next(); }
          return call('prdUploadPhoto', state.token, D.date, g, p.name, 'image/jpeg', p.b64).then(function (r) {
            if (!r.ok) { fails++; toast(r.error); return dayPage(); }
            var rep = H.data.reports.filter(function (x) { return x.date === D.date && x.kind === 'evening' && x.grp === g; })[0];
            if (rep) rep.files = r.files; else H.data.reports.push({ id: 'tmp', date: D.date, kind: 'evening', grp: g, files: r.files, problems: '', checks: '' });
            next();
          });
        }).catch(function (e) { onServerError(e); });
      };
      next();
    });
    on('[data-fdel]', 'click', function (el) {
      ask('ลบรูปนี้?').then(function (ok) {
        if (!ok) return;
        call('prdRemovePhoto', state.token, D.date, g, el.getAttribute('data-fdel')).then(function (r) {
          if (!r.ok) return toast(r.error);
          var rep = H.data.reports.filter(function (x) { return x.date === D.date && x.kind === 'evening' && x.grp === g; })[0]; if (rep) rep.files = r.files; dayPage();
        }).catch(onServerError);
      });
    }, $('dBody'));
  }
  // ---- ดูตัวอย่างการ์ด LINE แล้วส่ง
  function sendLine(kind, date, g) {
    var L = H.data.line;
    if (!L.token || !L.group) {
      return ask({ title: 'ยังเชื่อม LINE ไม่ครบ', text: 'ตั้งค่า LINE ของฝ่ายผลิตก่อน (ใส่ token และผูกกลุ่ม) ที่เมนู "ตั้งค่า / LINE"', ok: 'ไปที่ตั้งค่า', cancel: 'ปิด', tone: 'info' }).then(function (ok) { if (ok) go('p_set'); });
    }
    wide({ icon: 'send', color: '#06c755', title: kind === 'morning' ? 'ส่งแผนผลิตเข้า LINE' : 'ส่งสรุป ' + g + ' · ' + GNAME[g] + ' เข้า LINE', ok: 'ส่งเข้ากลุ่ม',
      body: '<div class="xprev" id="xPrev"><span class="spinner dark"></span> กำลังสร้างตัวอย่าง…</div><p class="muted" id="xPrevN" style="font-size:13px"></p>',
      onOpen: function () {
        call('prdLinePreview', state.token, kind, date, g || '').then(function (r) {
          if (!$('xPrev')) return;
          $('xPrev').innerHTML = flexHtml(r.flex);
          $('xPrevN').textContent = 'ตัวอย่างการ์ดที่จะขึ้นในกลุ่ม' + (r.photos ? ' · ตามด้วยรูป ' + r.photos + ' รูป (ส่งแยกเป็นภาพ)' : '');
        }).catch(onServerError);
      },
      submit: function () {
        return call('prdSendLine', state.token, kind, date, g || '', me()).then(function (r) {
          if (!r.ok) return r.error;
          closeModal(); toast('ส่ง LINE แล้ว ✅');
          H.load(H.data.from, H.data.to).then(function () { H.day = null; if (state.page === 'p_day') dayPage(); }).catch(onServerError);
        });
      } });
  }
  // แปลง Flex (box / text) เป็น HTML ไว้ดูตัวอย่าง
  function flexHtml(m) {
    var px = { xxs: 10, xs: 11.5, sm: 13, md: 14.5, lg: 16, xl: 19, '3xl': 26 };
    var sp = function (v) { return /px$/.test(String(v)) ? v : ({ none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 }[v] || 0) + 'px'; };
    var node = function (n, parentLayout) {
      if (n.type === 'text') {
        var st = 'font-size:' + (px[n.size] || 14) + 'px;color:' + (n.color || '#111') + ';' + (n.weight === 'bold' ? 'font-weight:700;' : '') + (n.align === 'end' ? 'text-align:right;' : n.align === 'center' ? 'text-align:center;' : '')
          + (n.margin ? (parentLayout === 'horizontal' ? 'margin-left:' : 'margin-top:') + sp(n.margin) + ';' : '') + (n.flex === 0 ? 'flex:none;' : n.flex ? 'flex:' + n.flex + ' 1 0;' : '') + 'white-space:pre-wrap;word-break:break-word;min-width:0';
        return '<div style="' + st + '">' + esc(n.text) + '</div>';
      }
      var st2 = 'display:flex;flex-direction:' + (n.layout === 'horizontal' ? 'row' : 'column') + ';' + (n.backgroundColor ? 'background:' + n.backgroundColor + ';' : '') + (n.cornerRadius ? 'border-radius:' + n.cornerRadius + ';' : '')
        + (n.paddingAll ? 'padding:' + n.paddingAll + ';' : '') + (n.paddingStart ? 'padding-left:' + n.paddingStart + ';padding-right:' + (n.paddingEnd || 0) + ';' : '') + (n.paddingTop ? 'padding-top:' + n.paddingTop + ';' : '')
        + (n.margin ? (parentLayout === 'horizontal' ? 'margin-left:' : 'margin-top:') + sp(n.margin) + ';' : '') + (n.spacing && n.layout === 'horizontal' ? 'gap:' + sp(n.spacing) + ';' : '')
        + (n.width ? 'width:' + n.width + ';flex:none;' : n.flex ? 'flex:' + n.flex + ' 1 0;' : '') + 'min-width:0';
      return '<div style="' + st2 + '">' + (n.contents || []).map(function (c) { return node(c, n.layout); }).join('') + '</div>';
    };
    return '<div class="xbubble">' + node(m.contents.body, 'vertical') + '</div>';
  }

  // ==================== Dashboard ====================
  function dash() {
    var t = H.data.today, q = H.q;
    if (!q.from) { q.from = addDays(t, -6); q.to = t; }
    var lm = addDays(t.slice(0, 8) + '01', -1);
    var quick = [['7 วัน', addDays(t, -6), t], ['เดือนนี้', t.slice(0, 8) + '01', t], ['เดือนก่อน', lm.slice(0, 8) + '01', lm], ['3 เดือน', addDays(t, -89), t]];
    $('main').innerHTML = '<h3>ภาพรวมฝ่ายผลิต</h3><p class="lead">Yield · จำนวนผลิตเทียบมาตรฐาน · ของเสีย · Breakdown · <a href="' + esc(H.data.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a></p>'
      + '<div class="pbar noprint"><div class="pchips" style="margin:0">' + quick.map(function (x) { return '<button class="chip' + (q.from === x[1] && q.to === x[2] ? ' on' : '') + '" data-q="' + x[1] + '|' + x[2] + '">' + x[0] + '</button>'; }).join('') + '</div>'
      + '<input type="date" id="qFrom" value="' + q.from + '" aria-label="ตั้งแต่"> – <input type="date" id="qTo" value="' + q.to + '" aria-label="ถึง"><button class="btn btn-sm btn-line" id="qPrint">' + icon('print', 16) + ' พิมพ์</button></div>'
      + '<div id="qOut"><div class="panel"><span class="spinner dark"></span> กำลังสรุป…</div></div>';
    on('[data-q]', 'click', function (el) { var p = el.getAttribute('data-q').split('|'); q.from = p[0]; q.to = p[1]; dash(); }, $('main'));
    ['qFrom', 'qTo'].forEach(function (id) { $(id).addEventListener('change', function () { var a = $('qFrom').value, b = $('qTo').value; if (a && b && a <= b) { q.from = a; q.to = b; dash(); } else toast('เลือกช่วงวันที่ให้ถูกต้อง'); }); });
    $('qPrint').addEventListener('click', function () { window.print(); });
    var my = H.dseq = (H.dseq || 0) + 1;
    call('prdDashboard', state.token, q.from, q.to).then(function (r) {
      if (my !== H.dseq || state.page !== 'p_dash') return;
      $('qOut').innerHTML = r.ok ? H.dashHtml(r) : '<div class="panel">' + esc(r.error) + '</div>';
    }).catch(onServerError);
  }
  H.dashHtml = function (r) {
    var k = r.kpi, tg = r.target;
    var tile = function (v, label, color, sub) { return '<div class="kpi" style="--k:' + color + '"><b>' + v + '</b><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var pct = function (a, b) { return b ? Math.round(a / b * 100) + '%' : '–'; };
    var html = '<div class="kpis">'
      + tile(k.yieldPct == null ? '–' : fmt(k.yieldPct, 1) + '%', 'Yield เฉลี่ย (งานผัด)', k.yieldPct == null ? '#64748b' : k.yieldPct >= tg ? '#16a34a' : '#dc2626', 'เป้า ≥ ' + tg + '% · ต่ำกว่าเป้า ' + k.below + ' จาก ' + k.runs + ' รายการ')
      + tile(pct(k.qtyIn, k.qtyRuns), 'ผลิตได้ตามช่วงจำนวน', k.qtyLow ? '#d97706' : '#16a34a', 'ตามช่วง ' + k.qtyIn + ' · ต่ำกว่า ' + k.qtyLow + ' (จาก ' + k.qtyRuns + ')')
      + tile(pct(k.onTime, k.judged), 'เสร็จตามกำหนด', k.late ? '#dc2626' : '#16a34a', 'ตามกำหนด ' + k.onTime + ' จาก ' + k.judged + ' · ช้า/เลยกำหนด ' + k.late + '<br>G2 ภายในวัน · G1/G3 ไม่เกิน 3 วัน')
      + tile(fmt(k.lossKg) + ' กก.', 'ของเสีย', '#b45309', fmt(k.lossQty, 0) + ' ชิ้น')
      + tile(fmt(k.bdMinutes, 0) + ' นาที', 'Breakdown เครื่องจักร', k.bdCount ? '#dc2626' : '#16a34a', k.bdCount + ' ครั้ง')
      + '</div>';
    var mx = 100;
    html += '<div class="pgrid"><div class="panel pbox"><h4>' + icon('chart', 18) + ' Yield แยกสินค้า <small class="muted">(เส้นประ = เป้า ' + tg + '%)</small></h4>' + (r.products.length ? r.products.map(function (p) {
      var y = p.yieldPct, ok = y != null && y >= p.target;
      return '<div class="xyr"><span title="' + esc(p.name) + '">' + esc(p.name) + '<small>' + p.runs + ' ครั้ง · Lost ' + (y == null ? '–' : fmt(100 - y, 1) + '%') + (p.expMin ? ' · ได้ ' + fmt(p.qty, 0) + ' (ควร ' + fmt(p.expMin, 0) + '–' + fmt(p.expMax, 0) + ')' : '') + (p.lossKg ? ' · เสีย ' + fmt(p.lossKg) + ' กก.' : '') + '</small></span>'
        + '<i><em style="width:' + Math.max(2, Math.min(100, (y || 0) / mx * 100)) + '%;background:' + (ok ? '#16a34a' : '#dc2626') + '"></em><u style="left:' + p.target + '%"></u></i><b class="' + (ok ? 'pos' : 'neg') + '">' + (y == null ? '–' : fmt(y, 1) + '%') + '</b></div>';
    }).join('') : '<div class="muted">ยังไม่มีผลงานผัดในช่วงนี้</div>') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('warn', 18) + ' เสร็จช้ากว่ากำหนด</h4>' + ((r.lateList || []).length ? (r.lateCauses || []).map(function (c) {
        return '<div class="li"><span>' + esc(c.name) + '</span><b class="neg">' + c.n + ' รายการ</b></div>';
      }).join('') + '<div style="margin-top:8px">' + r.lateList.map(function (x) {
        return '<div class="li"><span>' + esc(x.grp) + ' · ' + esc(x.product) + '</span><b class="neg">' + (x.finishDate ? 'เสร็จ ' + dd(x.finishDate) : 'ยังไม่เสร็จ') + '</b><small>ผลิต ' + dd(x.date) + ' · กำหนด ' + dd(x.deadline) + (x.cause ? ' · ' + esc(x.cause) : '') + '</small></div>';
      }).join('') + '</div>' : '<div class="muted">เสร็จตามกำหนดทุกรายการ 👍</div>')
      + '<h4 style="margin-top:16px">' + icon('gear2', 18) + ' Breakdown แยกเครื่อง</h4>' + (r.machines.length ? r.machines.map(function (m) {
        return '<div class="li"><span>' + esc(m.name) + '</span><b>' + fmt(m.minutes, 0) + ' นาที</b><small>' + m.n + ' ครั้ง</small></div>';
      }).join('') : '<div class="muted">ไม่มี</div>')
      + '<h4 style="margin-top:16px">' + icon('box', 18) + ' งานบรรจุ</h4><div class="li"><span>บรรจุลงซอง/ถ้วย (G1)</span><b>' + fmt(k.packed, 0) + ' ชิ้น</b></div><div class="li"><span>บรรจุลงลัง (G3)</span><b>' + fmt(k.cases, 0) + ' ลัง</b></div></div></div>';
    if (r.days.length > 1) {
      html += '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('chart', 18) + ' Yield รายวัน</h4><div class="xdays">' + r.days.map(function (d) {
        var ok = d.yieldPct != null && d.yieldPct >= tg;
        return '<div class="xday" title="' + dd(d.date) + ': ' + (d.yieldPct == null ? '-' : d.yieldPct + '%') + '"><b>' + (d.yieldPct == null ? '-' : fmt(d.yieldPct, 0)) + '</b><em style="height:' + Math.max(3, Math.min(100, d.yieldPct || 0)) + '%;background:' + (ok ? '#16a34a' : '#dc2626') + '"></em><span>' + dd(d.date).replace(/ \d+$/, '') + '</span></div>';
      }).join('') + '</div></div>';
    }
    return html;
  };

  // ==================== Breakdown ====================
  function bdPage() {
    var q = H.q, all = H.data.breakdowns.slice().sort(function (a, b) { return (b.date + b.start).localeCompare(a.date + a.start); });
    var mins = all.reduce(function (s, b) { return s + (Number(b.minutes) || 0); }, 0);
    $('main').innerHTML = '<h3>Breakdown เครื่องจักร</h3><p class="lead">เวลาที่เครื่องจักร / อุปกรณ์เสีย · ปัญหา · การแก้ไข (ข้อมูล ' + dd(H.data.from) + ' – ' + dd(H.data.to) + ')</p>'
      + '<div class="qtop"><button class="btn btn-primary" id="bAdd">' + icon('plus', 18) + ' บันทึก Breakdown</button><span class="muted">รวม ' + all.length + ' ครั้ง · ' + fmt(mins, 0) + ' นาที</span></div>'
      + '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>วันที่</th><th>เครื่องจักร</th><th>เวลา</th><th>นาที</th><th>ปัญหา</th><th>การแก้ไข</th><th></th></tr></thead><tbody>'
      + (all.map(function (b) {
        return '<tr><td class="nw">' + dd(b.date) + (b.grp ? '<br><small>' + esc(b.grp) + '</small>' : '') + '</td><td><b>' + esc(b.machine) + '</b></td><td class="nw">' + esc(b.start) + (b.end ? '–' + esc(b.end) : '<br><small class="neg">ยังไม่จบ</small>') + '</td><td class="r">' + (b.minutes === '' ? '-' : b.minutes) + '</td>'
          + '<td>' + esc(b.problem) + '</td><td>' + esc(b.fix || '-') + '</td><td><button class="btn btn-line btn-sm" data-bd="' + esc(b.id) + '">แก้ไข</button></td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted">ยังไม่มีรายการ</td></tr>') + '</tbody></table></div>';
    $('bAdd').addEventListener('click', function () { bdForm({ date: H.data.today }, bdPage); });
    on('[data-bd]', 'click', function (el) { bdForm(H.data.breakdowns.filter(function (b) { return b.id === el.getAttribute('data-bd'); })[0], bdPage); }, $('main'));
  }
  function bdForm(b0, after) {
    var b = JSON.parse(JSON.stringify(b0)), isNew = !b.id, machines = list(S_().machines);
    H.data.breakdowns.forEach(function (x) { if (x.machine && machines.indexOf(x.machine) < 0) machines.push(x.machine); });
    var now = new Date(), hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    wide({ icon: 'gear2', title: isNew ? 'บันทึก Breakdown เครื่องจักร' : 'แก้ไข Breakdown', ok: 'บันทึก',
      body: '<div class="pform"><div class="pf"><label for="bDate">วันที่ *</label><input id="bDate" type="date" value="' + esc(b.date || H.data.today) + '"></div>'
        + '<div class="pf"><label for="bGrp">กลุ่มงาน</label><select id="bGrp"><option value="">— ไม่ระบุ —</option>' + GROUPS.map(function (g) { return '<option value="' + g[0] + '"' + (b.grp === g[0] ? ' selected' : '') + '>' + g[0] + ' · ' + g[1] + '</option>'; }).join('') + '</select></div>'
        + '<div class="pf full"><label for="bMac">เครื่องจักร / อุปกรณ์ *</label><input id="bMac" list="bMacL" value="' + esc(b.machine || '') + '" placeholder="พิมพ์ชื่อเครื่อง หรือเลือกจากรายการ" maxlength="80"><datalist id="bMacL">' + machines.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist></div>'
        + '<div class="pf"><label for="bStart">เวลาเริ่ม *</label><input id="bStart" type="time" value="' + esc(b.start || hhmm) + '"></div>'
        + '<div class="pf"><label for="bEnd">เวลาจบ <small class="muted">(ยังไม่จบ เว้นว่าง)</small></label><input id="bEnd" type="time" value="' + esc(b.end || '') + '"></div>'
        + '<div class="pf full"><label for="bProb">ปัญหา *</label><textarea id="bProb" rows="2" placeholder="อาการที่เกิด">' + esc(b.problem || '') + '</textarea></div>'
        + '<div class="pf full"><label for="bFix">การแก้ไข</label><textarea id="bFix" rows="2" placeholder="ทำอะไรไป / ใครแก้">' + esc(b.fix || '') + '</textarea></div></div>'
        + (isNew ? '' : '<button type="button" class="link-btn danger" id="bDel">' + icon('trash', 14) + ' ลบรายการนี้</button>'),
      onOpen: function () {
        if ($('bDel')) $('bDel').addEventListener('click', function () {
          ask({ title: 'ลบ Breakdown นี้?', text: b.machine + ' · ' + dd(b.date) }).then(function (ok) {
            if (!ok) return;
            call('prdDeleteBreakdown', state.token, b.id).then(function (r) { if (!r.ok) return toast(r.error); closeModal(); H.data.breakdowns = H.data.breakdowns.filter(function (x) { return x.id !== b.id; }); toast('ลบแล้ว'); after(); }).catch(onServerError);
          });
        });
      },
      submit: function () {
        var o = { id: b.id, date: $('bDate').value, grp: $('bGrp').value, machine: $('bMac').value.trim(), start: $('bStart').value, end: $('bEnd').value, problem: $('bProb').value.trim(), fix: $('bFix').value.trim(), by: me() };
        if (!o.machine) return Promise.resolve('ใส่ชื่อเครื่องจักร / อุปกรณ์');
        if (!o.start) return Promise.resolve('ใส่เวลาเริ่ม');
        if (!o.problem) return Promise.resolve('เขียนปัญหาที่เกิด');
        return call('prdSaveBreakdown', state.token, o).then(function (r) {
          if (!r.ok) return r.error;
          var a = H.data.breakdowns, i = a.map(function (x) { return x.id; }).indexOf(r.breakdown.id); if (i >= 0) a[i] = r.breakdown; else a.push(r.breakdown);
          closeModal(); toast('บันทึกแล้ว'); after();
        });
      } });
  }

  // ==================== สินค้า & มาตรฐาน ====================
  function prodPage() {
    var q = H.q, s = (q.ps || '').toLowerCase(), cats = {}, order = [];
    H.data.products.forEach(function (p) { if (s && (p.name + ' ' + p.category).toLowerCase().indexOf(s) < 0) return; var c = p.category || 'อื่น ๆ'; if (!cats[c]) { cats[c] = []; order.push(c); } cats[c].push(p); });
    $('main').innerHTML = '<h3>สินค้า & มาตรฐาน Yield</h3><p class="lead">มาตรฐานต่อ 1 batch: น้ำหนักวัตถุดิบ และช่วงจำนวนที่ควรผลิตได้ · Yield ขั้นต่ำ ' + esc(S_().target) + '% (ตั้งรายสินค้าได้)</p>'
      + '<div class="pbar"><div class="psearch">' + icon('search', 18) + '<input id="pSearch" placeholder="ค้นหาสินค้า" value="' + esc(q.ps || '') + '"></div><button class="btn btn-sm btn-primary" id="pAdd">' + icon('plus', 16) + ' เพิ่มสินค้า</button></div>'
      + order.map(function (c) {
        return '<div class="panel" style="padding:0;overflow:hidden;margin-bottom:12px"><div class="xcat">' + esc(c) + ' <small>' + cats[c].length + ' รายการ</small></div><div class="ptable-wrap"><table class="ptable"><thead><tr><th>สินค้า</th><th class="r">วัตถุดิบ/batch</th><th class="r">ควรได้/batch</th><th class="r">Yield ขั้นต่ำ</th><th></th></tr></thead><tbody>'
          + cats[c].map(function (p) {
            return '<tr' + (p.active === 'ไม่ใช้' ? ' class="xoff"' : '') + '><td><b>' + esc(p.name) + '</b>' + (p.active === 'ไม่ใช้' ? ' <small class="muted">(ไม่ใช้แล้ว)</small>' : '') + '</td><td class="r nw">' + fmt(p.rawKg, 3) + ' กก.</td>'
              + '<td class="r nw">' + fmt(p.qtyMin, 0) + (p.qtyMax !== p.qtyMin ? '–' + fmt(p.qtyMax, 0) : '') + ' ' + esc(p.unit || '') + '</td><td class="r">' + target(p) + '%</td><td><button class="btn btn-line btn-sm" data-pe="' + esc(p.id) + '">แก้ไข</button></td></tr>';
          }).join('') + '</tbody></table></div></div>';
      }).join('') || '<div class="panel muted">ไม่พบสินค้า</div>';
    $('pSearch').addEventListener('input', function () { q.ps = this.value; var pos = this.selectionStart; prodPage(); var el = $('pSearch'); el.focus(); el.setSelectionRange(pos, pos); });
    $('pAdd').addEventListener('click', function () { prodForm({}, prodPage); });
    on('[data-pe]', 'click', function (el) { prodForm(prodOf(el.getAttribute('data-pe')), prodPage); }, $('main'));
  }
  function prodForm(p0, after) {
    var p = JSON.parse(JSON.stringify(p0 || {})), isNew = !p.id, cats = [];
    H.data.products.forEach(function (x) { if (x.category && cats.indexOf(x.category) < 0) cats.push(x.category); });
    wide({ icon: 'box', title: isNew ? 'เพิ่มสินค้า' : 'แก้ไขสินค้า', ok: 'บันทึก',
      body: '<div class="pform"><div class="pf full"><label for="xN">ชื่อสินค้า *</label><input id="xN" value="' + esc(p.name || '') + '" maxlength="120"></div>'
        + '<div class="pf"><label for="xC">หมวด</label><input id="xC" list="xCL" value="' + esc(p.category || '') + '" maxlength="60"><datalist id="xCL">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>'
        + '<div class="pf"><label for="xU">หน่วยนับ</label><input id="xU" list="xUL" value="' + esc(p.unit || '') + '" placeholder="เช่น ซอง" maxlength="20"><datalist id="xUL">' + list(S_().units).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>'
        + '<div class="pf"><label for="xR">น้ำหนักวัตถุดิบต่อ batch (กก.)</label><input id="xR" inputmode="decimal" value="' + esc(p.rawKg == null ? '' : p.rawKg) + '"></div>'
        + '<div class="pf"><label for="xT">Yield ขั้นต่ำ (%)</label><input id="xT" inputmode="decimal" value="' + esc(p.target == null ? '' : p.target) + '" placeholder="ว่าง = ' + esc(S_().target) + '"></div>'
        + '<div class="pf"><label for="xMin">ควรได้ต่อ batch — ต่ำสุด</label><input id="xMin" inputmode="numeric" value="' + esc(p.qtyMin == null ? '' : p.qtyMin) + '"></div>'
        + '<div class="pf"><label for="xMax">ควรได้ต่อ batch — สูงสุด</label><input id="xMax" inputmode="numeric" value="' + esc(p.qtyMax == null ? '' : p.qtyMax) + '"></div>'
        + (isNew ? '' : '<label class="xchk pf full"><input type="checkbox" id="xA"' + (p.active === 'ไม่ใช้' ? ' checked' : '') + '> เลิกผลิตสินค้านี้แล้ว (ซ่อนจากรายการให้เลือก)</label>') + '</div>',
      submit: function () {
        var o = { id: p.id, name: $('xN').value.trim(), category: $('xC').value.trim(), unit: $('xU').value.trim(), rawKg: $('xR').value, target: $('xT').value, qtyMin: $('xMin').value, qtyMax: $('xMax').value, active: !($('xA') && $('xA').checked) };
        if (!o.name) return Promise.resolve('ใส่ชื่อสินค้า');
        if (num(o.qtyMin) !== '' && num(o.qtyMax) !== '' && num(o.qtyMax) < num(o.qtyMin)) return Promise.resolve('จำนวนสูงสุดต้องไม่น้อยกว่าต่ำสุด');
        return call('prdSaveProduct', state.token, o).then(function (r) {
          if (!r.ok) return r.error;
          var a = H.data.products, i = a.map(function (x) { return x.id; }).indexOf(r.product.id); if (i >= 0) a[i] = r.product; else a.push(r.product);
          closeModal(); toast(isNew ? 'เพิ่มสินค้าแล้ว' : 'บันทึกแล้ว'); after(r.product);
        });
      } });
  }

  // ==================== ตั้งค่า / LINE ====================
  function settings() {
    var s = S_(), L = H.data.line;
    var ta = function (k, label, hint) { return '<div class="pf full"><label for="s_' + k + '">' + label + '</label><textarea id="s_' + k + '" rows="2" placeholder="' + esc(hint || '') + '">' + esc(s[k] || '') + '</textarea></div>'; };
    $('main').innerHTML = '<h3>ตั้งค่า / LINE</h3><p class="lead">รายการตัวเลือก (คั่นด้วย , ) · เป้าหมาย · การเชื่อม LINE กลุ่มฝ่ายผลิต</p>'
      + '<div class="panel pbox"><h4>' + icon('send', 18) + ' LINE กลุ่มฝ่ายผลิต</h4>'
      + (L.token && L.group
        ? '<div class="a7chk ok"><i>✓</i><span>เชื่อมต่อ LINE เรียบร้อย — แผนผลิตและสรุปงานจะส่งเข้ากลุ่มที่ผูกไว้</span></div>'
          + '<div class="a7lineacts"><button class="btn btn-line btn-sm" id="sTest">' + icon('send', 16) + ' ส่งข้อความทดสอบเข้ากลุ่ม</button>'
          + '<button class="btn btn-line btn-sm" id="sGroup">' + icon('gear', 16) + ' เปลี่ยนกลุ่มที่รับรายงาน</button>'
          + '<button class="btn btn-line btn-sm" id="sTokChg">' + icon('gear', 16) + ' เปลี่ยน token / OA</button></div>'
        : '<div class="a7chk ' + (L.token ? 'ok' : 'bad') + '"><i>' + (L.token ? '✓' : '✕') + '</i><span>PROD_LINE_TOKEN (Channel access token) ' + (L.token ? 'ใส่แล้ว' : 'ยังไม่ได้ใส่') + '</span></div>'
          + '<div class="a7chk bad"><i>✕</i><span>กลุ่ม LINE ที่รับรายงาน ยังไม่ได้ผูก</span></div>'
          + '<ol class="a7ol">'
          + (L.token ? '' : '<li>วาง Channel access token (long-lived) ของ OA ที่จะใช้ส่งรายงานผลิต แล้วกด "บันทึก token" — ระบบตรวจกับ LINE ให้ก่อนบันทึก (ใช้ OA / token เดียวกับฝ่ายบัญชีก็ได้)' + tokenBox() + '</li>')
          + '<li>ใน LINE Developers → Messaging API ของ OA นั้น: ใส่ Webhook URL ด้านล่าง แล้วเปิด Use webhook และ Allow bot to join group chats (ถ้าใช้ OA เดียวกับฝ่ายบัญชี ตั้งไว้แล้ว ข้ามได้)' + copyBox(L.webhook, 'Webhook URL') + '</li>'
          + '<li>' + bindStep(L.setupCode) + '</li></ol>')
      + '</div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('chart', 18) + ' เป้าหมาย</h4><div class="pform"><div class="pf"><label for="s_target">Yield ขั้นต่ำ (%) ของทุกสินค้า</label><input id="s_target" inputmode="decimal" value="' + esc(s.target) + '"></div></div></div>'
      + '<div class="panel pbox" style="margin-top:14px"><h4>' + icon('list', 18) + ' ตัวเลือก</h4><div class="pform">'
      + ta('machines', 'รายชื่อเครื่องจักร / อุปกรณ์', 'เช่น กระทะผัด 1, เครื่องซีล 2, ตู้เย็น') + ta('lossCauses', 'สาเหตุของเสีย') + ta('lateCauses', 'สาเหตุที่เสร็จช้ากว่ากำหนด', 'Breakdown เครื่องจักร, วัตถุดิบไม่พอ / มาช้า') + ta('checks', 'รายการปิดงานตอนเย็น', 'ปิดน้ำ, ปิดไฟ, ปิดแอร์')
      + ta('units', 'หน่วยนับสินค้า', 'ซอง, ถ้วย, กระปุก, ดวง') + ta('sectionTitles', 'หัวข้อสำเร็จรูปสำหรับข้อความเย็น', 'เตรียมวัตถุดิบ, น้ำพริกค้างแพ็ค') + ta('morningNote', 'ข้อความท้ายแผนผลิตตอนเช้า (ค่าเริ่มต้น)') + '</div></div>'
      + '<div class="qsave"><button class="btn btn-primary" id="sSave">' + icon('check', 18) + ' บันทึกการตั้งค่า</button></div>';
    bindCopy($('main'));
    if ($('sGroup')) $('sGroup').addEventListener('click', changeGroup);
    if ($('sTokSave')) bindToken($('main'));
    if ($('sTokChg')) $('sTokChg').addEventListener('click', function () {
      wide({ icon: 'send', title: 'เปลี่ยน token / OA ของฝ่ายผลิต', noCancel: true, ok: 'ปิด', body: '<p style="margin-top:0">วาง Channel access token ใหม่ ระบบตรวจกับ LINE ก่อนบันทึก · ถ้าเป็น OA ตัวใหม่ ต้องผูกกลุ่มใหม่อีกครั้ง</p>' + tokenBox(),
        onOpen: function () { bindToken($('mBody')); }, submit: function () { closeModal(); return Promise.resolve(); } });
    });
    if ($('sTest')) $('sTest').addEventListener('click', function () { call('prdLineTest', state.token).then(function (r) { toast(r.ok ? 'ส่งข้อความทดสอบแล้ว' : r.error); }).catch(onServerError); });
    $('sSave').addEventListener('click', function () {
      var o = {}, b = this; ['target', 'machines', 'lossCauses', 'lateCauses', 'checks', 'units', 'sectionTitles', 'morningNote'].forEach(function (k) { if ($('s_' + k)) o[k] = $('s_' + k).value.trim(); });
      if (!(Number(o.target) > 0 && Number(o.target) <= 100)) return toast('Yield ขั้นต่ำต้องอยู่ระหว่าง 1–100');
      b.disabled = true;
      call('prdSaveSettings', state.token, o).then(function (r) { b.disabled = false; if (!r.ok) return toast(r.error); H.data.settings = r.settings; toast('บันทึกการตั้งค่าแล้ว'); }).catch(function (e) { b.disabled = false; onServerError(e); });
    });
  }
  // ---- LINE token: ใส่จากหน้านี้ได้เลย (เก็บใน Script Property PROD_LINE_TOKEN ฝั่งระบบ ไม่แสดงค่ากลับ)
  function tokenBox() { return '<div class="a7copy xtok"><input type="password" id="sTok" placeholder="วาง Channel access token ที่นี่" autocomplete="off" spellcheck="false" aria-label="Channel access token"><button class="btn btn-primary btn-sm" id="sTokSave" type="button">บันทึก token</button></div>'; }
  function bindToken(root) {
    var b = root.querySelector('#sTokSave'), inp = root.querySelector('#sTok');
    b.addEventListener('click', function () {
      var v = inp.value.replace(/\s+/g, '');
      if (!v) { inp.focus(); return toast('วาง token ก่อน'); }
      b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังตรวจกับ LINE…';
      call('prdSetLineToken', state.token, v).then(function (r) {
        b.disabled = false; b.textContent = 'บันทึก token';
        if (!r.ok) return toast(r.error);
        inp.value = ''; H.data.line = r.line; closeModal();
        toast('บันทึก token แล้ว ✅' + (r.botName ? ' (OA: ' + r.botName + ')' : '') + (r.regroup || !r.line.group ? ' — ต่อไปผูกกลุ่ม LINE' : ''));
        settings();
      }).catch(function (e) { b.disabled = false; b.textContent = 'บันทึก token'; onServerError(e); });
    });
  }
  // ---- LINE: คัดลอกคำสั่ง / เปลี่ยนกลุ่ม (แบบเดียวกับฝ่ายบัญชี)
  function copyBox(text, label) { return '<div class="a7copy"><input readonly value="' + esc(text) + '" aria-label="' + esc(label) + '"><button class="btn btn-line btn-sm" data-copy="' + esc(text) + '">คัดลอก</button></div>'; }
  function bindStep(code) {
    return 'เชิญ OA เข้ากลุ่ม LINE ของฝ่ายผลิต แล้วพิมพ์ข้อความนี้ในกลุ่ม ระบบจะจำกลุ่มให้เอง' + copyBox('ตั้งค่ากลุ่ม ผลิต ' + (code || ''), 'คำสั่งผูกกลุ่ม')
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
      body: '<div id="gBody"><span class="spinner dark"></span> กำลังโหลดรหัสล่าสุด…</div><p class="muted">พิมพ์ในกลุ่มใหม่แล้ว แผนผลิตและสรุปงานครั้งต่อไปจะส่งไปกลุ่มใหม่แทน (กลุ่มเดิมจะไม่ได้รับ)</p>',
      onOpen: function () {
        call('prdLoad', state.token, H.data.from, H.data.to).then(function (d) {
          H.data.line = d.line;
          var g = $('gBody'); if (!g) return;
          g.innerHTML = '<ol class="a7ol"><li>' + bindStep(d.line.setupCode) + '</li></ol>'; bindCopy(g);
        }).catch(onServerError);
      },
      submit: function () { closeModal(); return Promise.resolve(); } });
  }
  function logPage() {
    $('main').innerHTML = '<h3>ประวัติการแก้ไข</h3><p class="lead">บันทึกทุกครั้งที่เพิ่ม/แก้/ลบข้อมูล และส่ง LINE</p><div id="lOut" class="panel"><span class="spinner dark"></span> กำลังโหลด</div>';
    call('prdLog', state.token, 300).then(function (r) {
      $('lOut').outerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>เวลา</th><th>การทำงาน</th><th>รายละเอียด</th></tr></thead><tbody>'
        + (r.rows.map(function (x) { return '<tr><td class="nw">' + esc(x.time) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.detail) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีประวัติ</td></tr>') + '</tbody></table></div>';
    }).catch(onServerError);
  }

  // ---------- CSS ของโมดูล ----------
  var css = document.createElement('style');
  css.textContent = [
    '.xdhead{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-bottom:12px}.xdhead h3{margin:0;flex:1 1 auto}',
    '.xdate{display:flex;gap:6px;align-items:center;background:#fff;border-radius:12px;padding:6px 8px;box-shadow:var(--shadow)}.xdate label{display:flex;flex-direction:column;font-size:11px;color:var(--muted);margin:0}.xdate input{border:0;font:inherit;font-size:15px;font-weight:600;padding:0;background:none}.xdate .icon-btn{font-size:20px;line-height:1;width:36px;height:36px;justify-content:center}',
    '.xme{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);margin:0}.xme input{border:1.5px solid var(--line);border-radius:9px;padding:7px 10px;font:inherit;width:150px}',
    '.xtabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.xtab{border:2px solid transparent;background:#fff;border-radius:12px;padding:10px 12px;text-align:left;box-shadow:var(--shadow);cursor:pointer;font:inherit;color:var(--ink);border-top:4px solid var(--g);min-height:56px}',
    '.xtab b{display:block;font-size:14px}.xtab small{color:var(--muted);font-size:12px}.xtab.on{border-color:var(--g);background:color-mix(in srgb,var(--g) 8%,white)}',
    '.xmode{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.xmb{border:2px solid var(--line);background:#fff;border-radius:14px;padding:12px 14px;text-align:left;cursor:pointer;font:inherit;color:var(--ink);box-shadow:var(--shadow);min-height:64px}.xmb b{display:block;font-size:17px}.xmb span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}.xmb.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 10%,white)}.xmb .xok{font-size:12px}',
    '.xtabs3{grid-template-columns:repeat(3,minmax(0,1fr))}.xgsec{margin-bottom:18px}.xgh{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:16px}.xgh span{background:var(--g);color:#fff;border-radius:8px;padding:2px 8px;font-size:13px}.xgh small{color:var(--muted);font-weight:400}',
    '.xpname{flex:1;min-width:0}.xpname b{font-size:16px;display:block}.xchips{display:flex;flex-wrap:wrap;gap:4px 6px;margin-top:4px}.xchips span{font-size:12.5px;background:#f1f5f9;color:#334155;border-radius:99px;padding:2px 9px}',
    '.xplanl{margin:8px 0 0 36px;font-size:13px;color:#334155;background:#f8fafc;border-radius:8px;padding:6px 10px}',
    '.xcard{min-width:0;background:#fff;border-radius:14px;box-shadow:var(--shadow);border-left:5px solid var(--g);padding:12px 14px;margin-bottom:12px}.xch{display:flex;gap:8px;align-items:center}.xno{width:28px;height:28px;border-radius:50%;background:var(--g);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px;flex:none}',
    '.xprod{flex:1;min-width:0;padding:9px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-size:15px;font-weight:600;background:#fff}',
    '.xtags{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0 36px}.xtags span{font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;border:1.5px solid}',
    '.xy.ok,.xq.ok,.xdu.ok{color:#15803d;border-color:#86efac;background:#f0fdf4}.xy.bad,.xq.low,.xdu.late{color:#b91c1c;border-color:#fca5a5;background:#fef2f2}.xq.high{color:#b45309;border-color:#fcd34d;background:#fffbeb}.xdu.wait{color:#475569;border-color:#cbd5e1;background:#f8fafc}',
    '.xsub{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin:12px 0 6px}',
    '.xgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px 10px}.xf{display:flex;flex-direction:column;gap:3px;margin:0;min-width:0;font-size:12.5px;color:var(--muted)}.xf.full{grid-column:1/-1}',
    '.xin{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:9px;background:#fff;overflow:hidden}.xin:focus-within{border-color:var(--c)}.xin input{flex:1;min-width:0;width:100%;border:0;padding:9px 10px;font:inherit;font-size:15px;color:var(--ink);background:none}.xin input:focus{outline:none}.xin em{font-style:normal;padding:0 10px;color:var(--muted);font-size:13px;background:#f8fafc;align-self:stretch;display:flex;align-items:center}',
    '.xf textarea{border:1.5px solid var(--line);border-radius:9px;padding:9px 10px;font:inherit;font-size:15px;color:var(--ink)}',
    '.xcalc{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.xyb{border-radius:10px;background:#f8fafc;border:1.5px solid var(--line);padding:8px 10px}.xyb span{display:block;font-size:12px;color:var(--muted)}.xyb b{font-size:20px}.xyb small{display:block;font-size:11.5px;color:var(--muted)}',
    '.xyb.ok{background:#f0fdf4;border-color:#86efac}.xyb.ok b{color:#15803d}.xyb.bad{background:#fef2f2;border-color:#fca5a5}.xyb.bad b{color:#b91c1c}',
    '.xres{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}.xres summary{cursor:pointer;font-weight:700;font-size:14px;padding:6px 0;min-height:32px}.xres summary small{font-weight:400;color:var(--muted)}',
    '.xchk{display:flex;align-items:center;gap:8px;font-size:14px;margin:10px 0 0;cursor:pointer}.xchk input{width:20px;height:20px}',
    '.xadd{width:100%;border:2px dashed var(--g)!important;color:var(--g)!important;background:#fff!important;min-height:48px;margin-bottom:14px}',
    '.xsave[hidden]{display:none!important}.xsave{position:sticky;bottom:10px;z-index:5;display:flex;gap:8px;align-items:center;background:#0f172a;color:#fff;border-radius:14px;padding:10px 12px;box-shadow:0 10px 30px rgba(15,23,42,.35);margin-top:8px}.xsave span{flex:1;font-size:13.5px}.xsave .btn-line{background:#fff}',
    '.xfinw{grid-column:1/-1}.xfin{border-radius:10px;padding:8px 10px;background:#f8fafc;border:1.5px solid var(--line);font-size:13px}.xfin b{display:block;font-size:14px}.xfin small{display:block;color:var(--muted);font-size:12px}.xfin.ok{background:#f0fdf4;border-color:#86efac}.xfin b.ok{color:#15803d}.xfin.bad{background:#fef2f2;border-color:#fca5a5}.xfin b.bad{color:#b91c1c}.xlc{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:8px}.xin select{width:100%;border:0;background:transparent;font:inherit;padding:8px;min-width:0}',
    '.xeve{border-top:4px solid var(--g)}.xbd{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13.5px}.xbd small{grid-column:1/-1;color:var(--muted)}',
    '.xsrw{display:grid;grid-template-columns:22px minmax(0,2fr) minmax(0,1.2fr) minmax(0,.8fr) minmax(0,.8fr) 34px;gap:6px;align-items:end;margin-bottom:6px}.xsn{font-weight:700;color:var(--muted);padding-bottom:10px}.xsrw .icon-btn{margin-bottom:6px}',
    '@media (max-width:760px){.xsrw{grid-template-columns:22px minmax(0,1fr) minmax(0,1fr) 34px;border-bottom:1px dashed var(--line);padding-bottom:8px}.xsrw .xsn{grid-row:1;grid-column:1}.xsrw .xsp{grid-row:1;grid-column:2/4}.xsrw .icon-btn{grid-row:1;grid-column:4}.xsrw .xsl{grid-row:2;grid-column:2/4}.xsrw .xsq{grid-row:3;grid-column:2}.xsrw .xsu{grid-row:3;grid-column:3}}',
    '.xsec .btn-sm{margin:2px 0 8px}.xsec{border:1.5px solid var(--line);border-radius:12px;padding:8px;margin-bottom:8px;background:#faf5ff}.xsech{display:flex;gap:6px;align-items:center;margin-bottom:6px}.xsech .xin{flex:1}.xsec textarea{width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 10px;font:inherit;font-size:15px;color:var(--ink)}',
    '.xchecks{display:flex;gap:6px 18px;flex-wrap:wrap}.xchecks .xchk{margin:0}',
    '.xphotos{display:flex;gap:8px;flex-wrap:wrap}.xph{position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden;background:#e2e8f0}.xph img{width:100%;height:100%;object-fit:cover}.xph button{position:absolute;top:3px;right:3px;border:0;background:rgba(15,23,42,.7);color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;cursor:pointer}',
    '.xadd2{width:84px;height:84px;border-radius:10px;border:2px dashed #94a3b8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11.5px;color:#334155;cursor:pointer;margin:0;text-align:center}',
    '.xsend{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}.xsend .btn-primary{flex:none}.xok{color:#15803d;font-weight:700;font-size:13.5px}',
    '.xsum{border-top:4px solid var(--g);padding:12px 14px}.xsumh{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.xsrow{display:flex;flex-wrap:wrap;gap:2px 10px;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--line);font-size:14px}.xsrow small{color:var(--muted)}.xsrow .xdue{width:100%;color:#b45309}',
    '.xprev{background:#8da7cf;border-radius:12px;padding:14px;display:flex;justify-content:center;max-height:60vh;overflow:auto}.xbubble{background:#fff;border-radius:14px;width:100%;max-width:380px;font-family:inherit}',
    '.xyr{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 56px;gap:8px;align-items:center;padding:5px 0;font-size:13px}.xyr span{overflow:hidden;text-overflow:ellipsis}.xyr small{display:block;color:var(--muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xyr i{position:relative;height:12px;background:#f1f5f9;border-radius:99px}.xyr em{position:absolute;left:0;top:0;bottom:0;border-radius:99px}.xyr u{position:absolute;top:-3px;bottom:-3px;border-left:2px dashed #0f172a}.xyr b{text-align:right}',
    '.xdays{display:flex;gap:6px;align-items:flex-end;height:150px;overflow-x:auto}.xday{flex:1;min-width:34px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:11px}.xday em{width:70%;border-radius:6px 6px 0 0}.xday span{color:var(--muted);white-space:nowrap}',
    '.xcat{padding:10px 14px;font-weight:700;background:#f8fafc;border-bottom:1px solid var(--line)}.xcat small{color:var(--muted);font-weight:400}.xoff td{opacity:.55}',
    '.xline div{padding:4px 0;font-size:14px}.xline .ok{color:#15803d}.xline .bad{color:#b91c1c}.xol{padding-left:20px;line-height:1.7;font-size:14px}.xcode{background:#f1f5f9;padding:2px 6px;border-radius:6px;word-break:break-all}',
    '@media (max-width:760px){.xtabs{grid-template-columns:repeat(2,minmax(0,1fr))}.xtabs3{grid-template-columns:repeat(3,minmax(0,1fr))}.xtabs3 .xtab{padding:8px}.xtabs3 .xtab b{font-size:12.5px}.xmb b{font-size:15px}.xplanl{margin-left:0}.xgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.xcalc{grid-template-columns:repeat(3,minmax(0,1fr))}.xyb{padding:6px 8px}.xin input{font-size:16px;padding:9px 8px}.xin em{padding:0 6px}.xyb b{font-size:16px}.xme{width:100%}.xme input{flex:1}.xyr{grid-template-columns:minmax(0,1fr) 70px 50px}}'
  ].join('\n');
  document.head.appendChild(css);
})();
