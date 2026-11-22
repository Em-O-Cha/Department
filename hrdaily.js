// ==================== ฝ่ายบุคคล — เช็คพนักงานรายวัน ====================
// เมนู "เช็คพนักงานรายวัน" (h_day) ในโมดูล HR — hr.js เรียก HRDAILY.page()
// แตะชื่อ = บันทึกลา (ประเภท + เหตุผล) → ชื่อย้ายจากช่อง "ชื่อ" ไปช่อง "การลา" · ฝ่ายที่ไม่มีรายชื่อ = กรอกจำนวน + เพิ่มคนลาเอง
// จำนวนพนักงานนับทั้งหมด (รวมคนลา) · ภาพตาราง (html2canvas) แสดงให้ดูก่อนส่ง LINE · API ใน HrDaily.gs
(function () {
  var D = window.HRDAILY = { data: null, date: '', day: null, dirty: false };
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var C_HEAD = '#D9E1F2', C_ROLE = '#E2EFDA', C_FOOT = '#FBE5D6';
  var COMPANY_TH = 'บริษัท สปังกี้ ฟู้ด จำกัด', COMPANY_EN = 'Spunky Food Co., Ltd.';

  function th(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + (+p[0] + 543); }
  function n0(v) { return Number(v || 0).toLocaleString('th-TH'); }
  function on(sel, ev, fn, root) { Array.prototype.forEach.call((root || $('main')).querySelectorAll(sel), function (el) { el.addEventListener(ev, function (e) { fn(el, e); }); }); }
  function splitNames(s) { return String(s || '').split(/[,\n]+/).map(function (x) { return x.trim(); }).filter(String); }
  D.reset = function () { D.data = null; D.day = null; D.dirty = false; };

  function load(date) {
    $('main').innerHTML = '<h3>เช็คพนักงานรายวัน</h3><div class="panel"><span class="spinner dark"></span> กำลังโหลด…</div>';
    return call('hrDailyLoad', state.token, date || '').then(function (r) {
      D.data = r; D.date = r.date; D.dirty = false;
      D.day = r.day ? r.day : {
        resign: 0, resignNames: [],
        roles: r.roles.map(function (x) {
          var names = splitNames(x.names);
          return { role: x.role, names: names, count: names.length ? names.length : (r.lastCounts[x.role] != null ? r.lastCounts[x.role] : x.count), leaves: [], resigns: [], note: '' };
        })
      };
      if (!Array.isArray(D.day.resignNames)) D.day.resignNames = [];
      D.day.roles.forEach(function (r) { if (!Array.isArray(r.resigns)) r.resigns = []; });
      if (!Array.isArray(D.day.skipSrc)) D.day.skipSrc = [];
      D.unmatched = [];
      // วันนี้ / วันต่อไป (หรือวันที่ยังไม่บันทึก): ตามรายชื่อล่าสุด + ใส่ขาด/ลา/มาสายจากระบบการลาให้เอง (รวมคำขอรออนุมัติ)
      if (r.date >= r.today || !r.day) {
        var before = JSON.stringify(D.day.roles);
        if (r.day) D.day.roles = syncRoles(D.day.roles, r.roles);
        applyRecords(D.day, r.records || []);
        if (JSON.stringify(D.day.roles) !== before) {
          D.dirty = true;
          if (r.day) { render(); return save().then(function (ok) { if (ok) render(); }); }
        }
      }
      render();
    }).catch(onServerError);
  }
  function autoSave() { save().then(function (ok) { if (ok) render(); }); }
  D.page = function () { if (!D.data) return load(''); render(); };

  // ---------- ตาราง (หน้าจอ + ภาพ LINE ใช้ตัวเดียวกัน) ----------
  // หัวภาพ: โลโก้ (ตัวเดียวกับหัวเว็บ) + ชื่อบริษัท — อยู่ในภาพที่ส่ง LINE ด้วย
  function brandHtml() {
    var l = document.querySelector('.brand-logo');
    return '<div class="hdbrand">' + (l ? '<img class="hdlogo" src="' + l.src + '" alt="Spunky Food">' : '') + '<div><b>' + COMPANY_TH + '</b><span>' + COMPANY_EN + '</span></div></div>';
  }
  // ---------- ขาด / ลา / มาสาย จากระบบการลา ----------
  function isLate(l) { return l.type === 'มาสาย'; }
  function lvCount(r) { return r.leaves.filter(function (l) { return !isLate(l); }).length; }   // มาสายไม่นับเป็นลา
  function first(n) { return String(n || '').trim().split(/[\s(]/)[0]; }
  function bare(n) { return String(n || '').replace(/^(นาย|นางสาว|นาง|คุณ|MISS\.?|MR\.?|MRS\.?)\s*/i, '').trim(); }
  function recReason(x) { return [x.late && x.minutes ? x.minutes + ' นาที' : '', x.reason].filter(String).join(' · '); }   // ไม่แสดง "รออนุมัติ" (ผู้ใช้ขอ 19/11/69)
  // ใส่บันทึกของวันนั้นลงชื่อในตาราง (จับคู่ชื่อเล่น / ชื่อจริง) · ที่จับคู่ไม่ได้ไปอยู่ใน D.unmatched ให้เลือกฝ่ายเอง
  // บันทึกที่ถูกยกเลิก / ไม่อนุมัติ → เอาออก · ที่ผู้ใช้กดเอาออกเอง (skipSrc) ไม่ใส่กลับ
  function applyRecords(day, recs) {
    var ids = recs.map(function (x) { return x.id; });
    day.roles.forEach(function (r) { r.leaves = r.leaves.filter(function (l) { return !l.src || ids.indexOf(l.src) >= 0; }); });
    D.unmatched = [];
    recs.forEach(function (x) {
      if (day.skipSrc.indexOf(x.id) >= 0) return;
      var have = null;
      day.roles.forEach(function (r) { r.leaves.forEach(function (l) { if (l.src === x.id) have = l; }); });
      if (have) { have.type = x.type; have.reason = recReason(x); return; }
      var keys = [x.nick, bare(x.full), x.full].filter(String), hit = null;
      day.roles.some(function (r) {
        var n = r.names.filter(function (n) { return keys.indexOf(n) >= 0 || keys.indexOf(first(n)) >= 0 || (x.nick && first(n) === x.nick); })[0];
        if (n) hit = { r: r, n: n };
        return !!n;
      });
      if (!hit && x.empId && D.data && D.data.roleMap && D.data.roleMap[x.empId]) {   // ฝ่ายงานที่ HR เคยเลือกให้คนนี้ (ระบบจำไว้)
        var mr = day.roles.filter(function (r) { return r.role === D.data.roleMap[x.empId]; })[0];
        if (mr) hit = { r: mr, n: x.nick || bare(x.full) };
      }
      if (!hit && x.job) {   // พนักงาน Job → แถว "job" (ฝ่ายงานที่กรอกเป็นจำนวน)
        var jr = day.roles.filter(function (r) { return !r.names.length && /^job$/i.test(String(r.role).trim()); })[0];
        if (jr) hit = { r: jr, n: x.nick || bare(x.full) };
      }
      if (!hit) { D.unmatched.push(x); return; }
      if (hit.r.leaves.some(function (l) { return l.name === hit.n; })) return;   // HR ใส่เองไว้แล้ว
      hit.r.leaves.push({ name: hit.n, type: x.type, reason: recReason(x), src: x.id });
    });
  }
  function unmatchedHtml() {
    if (!D.unmatched || !D.unmatched.length) return '';
    var ro = D.day.roles.map(function (r, i) { return '<option value="' + i + '">' + esc(r.role) + '</option>'; }).join('');
    return '<div class="panel hdun"><h4>📋 มีบันทึกขาด/ลา/มาสายในระบบ แต่ไม่พบชื่อในตาราง — เลือกฝ่ายงานให้ (เลือกครั้งเดียว ระบบจำไว้ใช้ครั้งต่อไป)</h4>' + D.unmatched.map(function (x, k) {
      return '<div class="hdunr"><span><b>' + esc(x.nick || bare(x.full)) + '</b> ' + esc(x.type) + (recReason(x) ? ' · ' + esc(recReason(x)) : '') + '</span>'
        + '<select data-unsel="' + k + '">' + ro + '</select><button class="btn btn-sm btn-line" data-unadd="' + k + '">ใส่ในฝ่ายนี้</button><button class="link-btn" data-unskip="' + k + '">ไม่ใส่</button></div>';
    }).join('') + '</div>';
  }
  function leaveText(l) { return l.name + ' (' + l.type + (l.reason ? ' · ' + l.reason : '') + ')'; }
  // ลาออก: แตะชื่อในฝ่ายงาน → เลือก "ลาออก" ชื่อไปอยู่ช่องหมายเหตุของฝ่ายนั้น (เหมือนการลา) · จำนวน = จำนวนชื่อ
  // (ข้อมูลเก่า: resignNames รวมทั้งวัน / ตัวเลขอย่างเดียว ยังนับให้)
  function resignText(x) { return x.name + ' (ลาออก' + (x.reason ? ' · ' + x.reason : '') + ')'; }
  // จำนวนพนักงานของฝ่าย = จำนวนตั้งต้น − คนลาออก (หักออก ผู้ใช้เลือก 19/11/69) · คนลายังนับรวม
  function net(r) { return Math.max(0, (Number(r.count) || 0) - (r.resigns || []).length); }
  function resignCount(day) {
    var n = day.roles.reduce(function (s, r) { return s + (r.resigns || []).length; }, 0) + (day.resignNames || []).length;
    return n || (Number(day.resign) || 0);
  }
  function tableHtml(day, date) {
    var total = 0, lv = 0;
    var rows = day.roles.map(function (r) {
      var off = r.leaves.filter(function (l) { return !isLate(l); }).concat(r.resigns || []).map(function (l) { return l.name; });
      var working = r.names.filter(function (n) { return off.indexOf(n) < 0; });
      total += net(r); lv += lvCount(r);
      return '<tr><td class="hdr">' + esc(r.role) + '</td><td class="hdn">' + esc(working.join(', ')) + '</td><td class="hdc">' + n0(net(r)) + '</td>'
        + '<td class="hdn">' + (r.note ? '<div>' + esc(r.note) + '</div>' : '') + (r.resigns || []).map(function (x, k) { return '<div class="hdrn">' + (k + 1) + '.' + esc(resignText(x)) + '</div>'; }).join('') + '</td><td class="hdl">' + r.leaves.map(function (l, i) { return '<div>' + (i + 1) + '.' + esc(leaveText(l)) + '</div>'; }).join('') + '</td></tr>';
    }).join('');
    return '<div class="hdimg">' + brandHtml() + '<div class="hdt">จำนวนพนักงาน วันที่ ' + th(date) + '</div><table class="hdtab"><thead><tr><th>ฝ่ายงาน</th><th>ชื่อ</th><th>จำนวนพนักงาน</th><th>หมายเหตุ</th><th>การลา</th></tr></thead><tbody>' + rows + '</tbody>'
      + '<tfoot><tr><td class="hdr hdf1" colspan="2">รวมพนักงานทั้งหมด</td><td class="hdf hdc"><b>' + n0(total) + '</b></td><td class="hdf">ลาออกทั้งหมด <b>' + n0(resignCount(day)) + '</b> คน' + (day.resignNames || []).map(function (n, i) { return '<div class="hdrn">' + (i + 1) + '.' + esc(n) + '</div>'; }).join('') + '</td><td class="hdf">ลางานทั้งหมด <b>' + n0(lv) + '</b> คน</td></tr></tfoot></table></div>';
  }

  // ---------- หน้า ----------
  function render() {
    var d = D.data, day = D.day, L = d.line;
    var total = day.roles.reduce(function (s, r) { return s + net(r); }, 0), lv = day.roles.reduce(function (s, r) { return s + lvCount(r); }, 0);
    var sent = d.date === D.date && d.sentAt;
    $('main').innerHTML = '<h3>เช็คพนักงานรายวัน</h3><p class="lead">แตะชื่อคนที่ลา → เลือกประเภทและเหตุผล ชื่อจะย้ายไปช่อง "การลา" · ดูภาพตารางก่อนส่งเข้า LINE</p>'
      + '<div class="panel hdhead"><div class="hdrow"><label class="hdlb"><span>วันที่</span><input type="date" id="hdDate" value="' + D.date + '"></label>'
      + '<div class="hdstat"><div><small>ทั้งหมด</small><b>' + n0(total) + '</b><small>คน</small></div><div class="lv"><small>ลา</small><b>' + lv + '</b><small>คน</small></div></div></div>'
      + '<div class="hdtags">'
      + (sent ? '<span class="hdtag ok">ส่ง LINE แล้ว ' + esc(String(d.sentAt).slice(11, 16)) + '</span>' : d.day ? '<span class="hdtag">บันทึกแล้ว · ยังไม่ส่ง LINE</span>' : '<span class="hdtag">ยังไม่บันทึก</span>')
      + (L.token && L.group ? '<span class="hdtag">' + (L.own ? 'ส่งเข้ากลุ่ม LINE ของฝ่ายบุคคล' : 'ส่งเข้ากลุ่มเดียวกับฝ่ายบัญชี / ฝ่ายผลิต') + '</span>' : '') + '</div>'
      + '<div class="hdbtns"><button class="btn btn-sm btn-line" id="hdRoles">' + icon('gear', 15) + ' แก้ฝ่ายงาน / รายชื่อ</button>'
      + (L.token ? '<button class="btn btn-sm btn-line" id="hdGroup">' + icon('send', 15) + ' ' + (L.group ? 'เปลี่ยนกลุ่ม LINE' : 'ผูกกลุ่ม LINE') + '</button>' : '') + '</div></div>'
      + (L.token && L.group ? '' : lineSetup(L))
      + unmatchedHtml()
      + '<div class="hdgrid">' + day.roles.map(function (r, i) {
        var off = r.leaves.filter(function (l) { return !isLate(l); }).map(function (l) { return l.name; }), late = r.leaves.filter(isLate).map(function (l) { return l.name; }), gone = r.resigns.map(function (x) { return x.name; });
        return '<div class="panel hdcard"><div class="hdch"><b>' + esc(r.role) + '</b><span>' + n0(net(r)) + ' คน' + (lvCount(r) ? ' · <em>ลา ' + lvCount(r) + '</em>' : '') + (r.leaves.length - lvCount(r) ? ' · <em class="lt">สาย ' + (r.leaves.length - lvCount(r)) + '</em>' : '') + (r.resigns.length ? ' · <em>ลาออก ' + r.resigns.length + '</em>' : '') + '</span></div>'
          + (r.names.length
            ? '<div class="hdchips">' + r.names.map(function (n) { var isOff = off.indexOf(n) >= 0, isGone = gone.indexOf(n) >= 0, isLt = late.indexOf(n) >= 0; return '<button class="hdchip' + (isGone ? ' gone' : isOff ? ' off' : isLt ? ' lt' : '') + '" data-ri="' + i + '" data-nm="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>'
            : '<label class="hdcnt">จำนวน <input type="number" min="0" inputmode="numeric" data-cnt="' + i + '" value="' + (Number(r.count) || 0) + '"> คน' + (r.resigns.length ? ' <small class="muted">(หักลาออก ' + r.resigns.length + ' เหลือ ' + n0(net(r)) + ')</small>' : '') + '</label>')
          + (r.leaves.length ? '<div class="hdlv">' + r.leaves.map(function (l, j) { return '<div' + (isLate(l) ? ' class="lt"' : '') + '><span>' + esc(leaveText(l)) + (l.src ? ' <small class="hdauto">จากระบบการลา</small>' : '') + '</span><button class="link-btn danger" data-unlv="' + i + ':' + j + '" aria-label="ยกเลิกการลา">ยกเลิก</button></div>'; }).join('') + '</div>' : '')
          + (r.resigns.length ? '<div class="hdlv hdrs">' + r.resigns.map(function (x, j) { return '<div><span>' + esc(resignText(x)) + '</span><button class="link-btn danger" data-unrs="' + i + ':' + j + '" aria-label="ยกเลิกลาออก">ยกเลิก</button></div>'; }).join('') + '</div>' : '')
          + '<div class="hdfoot"><input class="hdnote" data-note="' + i + '" placeholder="หมายเหตุ" value="' + esc(r.note || '') + '">'
          + (r.names.length ? '' : '<button class="btn btn-sm btn-line hdadd" data-addlv="' + i + '">+ เพิ่มคนลา / ลาออก</button>') + '</div></div>';
      }).join('') + '</div>'
      + '<div class="panel pbox"><h4>' + icon('table', 18) + ' ตัวอย่างตาราง (ภาพที่จะส่ง LINE)</h4><div class="hdprev" id="hdPrev">' + tableHtml(day, D.date) + '</div></div>'
      + '<div class="a7bar"><button class="btn btn-line" id="hdSave">' + icon('check', 16) + ' บันทึก</button><button class="btn btn-primary" id="hdSend"' + (L.token && L.group ? '' : ' disabled') + '>' + icon('send', 16) + ' ดูภาพ & ส่ง LINE</button></div>';
    $('hdDate').addEventListener('change', function () {
      var v = this.value; if (!v) return;
      var go2 = function () { load(v); };
      if (D.dirty) ask({ title: 'ยังไม่ได้บันทึก เปลี่ยนวันเลยไหม?', text: 'ข้อมูลที่แก้ในวันนี้จะหายไป', ok: 'เปลี่ยนวัน', tone: 'warn' }).then(function (y) { if (y) go2(); else $('hdDate').value = D.date; });
      else go2();
    });
    on('[data-nm]', 'click', function (el) { chip(+el.getAttribute('data-ri'), el.getAttribute('data-nm')); });
    on('[data-addlv]', 'click', function (el) { leaveDialog(+el.getAttribute('data-addlv'), ''); });
    // ยกเลิก = เอาออกจากหน้านี้ทันทีและบันทึกเลย (ผู้ใช้ขอ 20/11/69 — เดิมต้องกดบันทึกเอง ไม่งั้นเปิดใหม่แล้วกลับมา) · ที่มาจากระบบการลาจำไว้ใน skipSrc ไม่ใส่กลับ
    on('[data-unlv]', 'click', function (el) { var p = el.getAttribute('data-unlv').split(':'), x = day.roles[+p[0]].leaves.splice(+p[1], 1)[0]; if (x && x.src) day.skipSrc.push(x.src); D.dirty = true; render(); autoSave(); });
    on('[data-unadd]', 'click', function (el) {
      var k = +el.getAttribute('data-unadd'), x = D.unmatched[k], r = day.roles[+$('main').querySelector('[data-unsel="' + k + '"]').value];
      r.leaves.push({ name: x.nick || bare(x.full), type: x.type, reason: recReason(x), src: x.id }); D.unmatched.splice(k, 1); D.dirty = true; render();
      if (x.empId) call('hrDailyRoleMap', state.token, x.empId, r.role).then(function (y) { if (y.ok) { D.data.roleMap = y.roleMap; toast('จำไว้แล้ว: ครั้งต่อไป ' + (x.nick || bare(x.full)) + ' จะอยู่ในฝ่าย ' + r.role + ' เอง'); } }).catch(function () {});
    });
    on('[data-unskip]', 'click', function (el) { var k = +el.getAttribute('data-unskip'); day.skipSrc.push(D.unmatched[k].id); D.unmatched.splice(k, 1); D.dirty = true; render(); });
    on('[data-cnt]', 'change', function (el) { day.roles[+el.getAttribute('data-cnt')].count = Math.max(0, Math.round(Number(el.value) || 0)); D.dirty = true; render(); });
    on('[data-note]', 'change', function (el) { day.roles[+el.getAttribute('data-note')].note = el.value.trim(); D.dirty = true; $('hdPrev').innerHTML = tableHtml(day, D.date); });
    on('[data-unrs]', 'click', function (el) { var p = el.getAttribute('data-unrs').split(':'); day.roles[+p[0]].resigns.splice(+p[1], 1); D.dirty = true; render(); });
    $('hdRoles').addEventListener('click', rolesDialog);
    if ($('hdGroup')) $('hdGroup').addEventListener('click', groupDialog);
    $('hdSave').addEventListener('click', function () { save().then(function (ok) { if (ok) { toast('บันทึกแล้ว'); render(); } }); });
    $('hdSend').addEventListener('click', sendFlow);
  }
  function lineSetup(L) {
    if (!L.token) return '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>ยังไม่มีบอท LINE</b><span>ตารางนี้ส่งด้วยบอทของฝ่ายบัญชี — ให้ฝ่ายบัญชีตั้งค่า LINE ก่อน แล้วกดรีเฟรชหน้านี้</span></div></div>';
    return '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>ยังไม่ได้ผูกกลุ่ม LINE ที่รับตารางนี้</b><span>กดปุ่ม "ผูกกลุ่ม LINE" ด้านบน แล้วทำตามขั้นตอน</span></div></div>';
  }
  // ผูก / เปลี่ยนกลุ่ม LINE ที่รับตาราง (ใช้บอทฝ่ายบัญชี) — ดึงรหัสล่าสุดก่อน (รหัสใช้ได้ครั้งเดียว)
  function groupDialog() {
    openModal({ color: state.dept.color, icon: 'send', wide: true, title: 'กลุ่ม LINE ที่รับตารางเช็คพนักงาน', noCancel: true, ok: 'ปิด',
      body: '<div id="hgBody"><span class="spinner dark"></span> กำลังโหลด…</div>',
      onOpen: function () { groupBody(); }, submit: function () { closeModal(); render(); return Promise.resolve(); } });
  }
  function groupBody(msg) {
    return call('hrDailyLineInfo', state.token).then(function (r) {
      var L = D.data.line = r.line, g = $('hgBody'); if (!g) return;
      var cmd = 'ตั้งค่ากลุ่ม บุคคล ' + L.setupCode, bot = L.botName ? '"' + L.botName + '"' : 'ของฝ่ายบัญชี';
      g.innerHTML = '<div class="hgnow ' + (L.group ? 'ok' : 'bad') + '">' + (L.own ? '✓ ตอนนี้ส่งเข้ากลุ่ม LINE ของฝ่ายบุคคลที่ผูกไว้' : L.group ? '✓ ตอนนี้ส่งเข้ากลุ่มเดียวกับฝ่ายบัญชี / ฝ่ายผลิต (ยังไม่ได้ผูกกลุ่มของฝ่ายบุคคลเอง)' : '✕ ยังไม่ได้ผูกกลุ่ม') + '</div>'
        + (msg ? '<p class="hgmsg">' + esc(msg) + '</p>' : '')
        + '<b>' + (L.group ? 'เปลี่ยนไปส่งเข้ากลุ่มอื่น' : 'ผูกกลุ่ม') + '</b><ol class="hgol"><li>เชิญบอท ' + esc(bot) + ' เข้ากลุ่ม LINE ที่ต้องการ (ถ้ายังไม่อยู่ในกลุ่ม)</li>'
        + '<li>พิมพ์ข้อความนี้ในกลุ่มนั้น<div class="hdcode"><code>' + esc(cmd) + '</code><button type="button" class="btn btn-sm btn-line" data-copycmd="' + esc(cmd) + '">คัดลอก</button></div><small class="muted">รหัสใช้ได้ครั้งเดียว</small></li>'
        + '<li>รอบอทตอบ "✅ ตั้งกลุ่มนี้…" แล้วกด "ตรวจสอบ" ด้านล่าง</li></ol>'
        + '<div class="hgacts"><button type="button" class="btn btn-sm btn-line" id="hgCheck">↻ ตรวจสอบ</button>'
        + (L.group ? '<button type="button" class="btn btn-sm btn-line" id="hgTest">' + icon('send', 15) + ' ส่งข้อความทดสอบเข้ากลุ่ม</button>' : '') + '</div>';
      on('[data-copycmd]', 'click', function (el) {
        var t = el.getAttribute('data-copycmd');
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('คัดลอกแล้ว'); }, function () { toast(t); });
      }, g);
      $('hgCheck').addEventListener('click', function () { this.disabled = true; groupBody('ตรวจสอบแล้ว ' + new Date().toTimeString().slice(0, 5) + ' น.'); });
      if ($('hgTest')) $('hgTest').addEventListener('click', function () {
        var b = this; b.disabled = true;
        call('hrDailyLineTest', state.token).then(function (x) { b.disabled = false; toast(x.ok ? 'ส่งข้อความทดสอบแล้ว ดูในกลุ่ม LINE' : (x.error || 'ส่งไม่สำเร็จ')); }).catch(function (e) { b.disabled = false; onServerError(e); });
      });
    }).catch(onServerError);
  }
  function chip(i, name) {
    var r = D.day.roles[i], j = r.leaves.map(function (l) { return l.name; }).indexOf(name);
    if (j >= 0) { var x = r.leaves.splice(j, 1)[0]; if (x.src) D.day.skipSrc.push(x.src); D.dirty = true; render(); autoSave(); return; }   // แตะคนที่ลาอยู่ = ยกเลิกการลา (ที่มาจากระบบ: จำไว้ไม่ใส่กลับ)
    var g = r.resigns.map(function (x) { return x.name; }).indexOf(name);
    if (g >= 0) { r.resigns.splice(g, 1); D.dirty = true; render(); return; }   // แตะคนที่ลาออก = ยกเลิก
    leaveDialog(i, name);
  }
  function leaveDialog(i, name) {
    var r = D.day.roles[i], types = D.data.leaveTypes;
    openModal({ color: state.dept.color, icon: 'cal', title: name ? 'บันทึกลา / ลาออก · ' + name : 'เพิ่มคนลา / ลาออก · ' + r.role, sub: r.role,
      body: (name ? '' : '<label class="cpnl">ชื่อคนลา<input id="hdLvName" maxlength="60" placeholder="ชื่อเล่น เช่น จอ ตี ห้า"></label>')
        + '<div class="hdtypes">' + types.map(function (t, k) { return '<label><input type="radio" name="hdT" value="' + esc(t) + '"' + (k ? '' : ' checked') + '><span>' + esc(t) + '</span></label>'; }).join('') + '<label class="hdtrs"><input type="radio" name="hdT" value="__resign"><span>ลาออก</span></label></div>'
        + '<label class="cpnl">เหตุผล (ไม่บังคับ)<input id="hdLvWhy" maxlength="120" placeholder="เช่น ขาหัก / ไปหาหมอ"></label>',
      ok: 'บันทึก',
      check: function () { return !name && !$('hdLvName').value.trim() ? 'ใส่ชื่อคนลา' : ''; },
      submit: function () {
        var t = ($('mBody').querySelector('input[name=hdT]:checked') || {}).value || 'ลา';
        var who = (name || $('hdLvName').value.trim()).slice(0, 60), why = $('hdLvWhy').value.trim();
        if (t === '__resign') r.resigns.push({ name: who, reason: why }); else r.leaves.push({ name: who, type: t, reason: why });
        D.dirty = true; closeModal(); render(); return Promise.resolve();
      } });
  }
  // แก้ฝ่ายงาน / รายชื่อ: 1 บรรทัด = 1 ฝ่ายงาน · "ฝ่ายงาน: ชื่อ, ชื่อ" หรือ "ฝ่ายงาน = จำนวน" (ไม่มีรายชื่อ)
  function rolesDialog() {
    var txt = D.data.roles.map(function (x) { return x.names ? x.role + ': ' + x.names : x.role + ' = ' + x.count; }).join('\n');
    openModal({ color: state.dept.color, icon: 'gear', wide: true, title: 'แก้ฝ่ายงาน / รายชื่อตั้งต้น', sub: 'ใช้กับวันที่เปิดอยู่และวันต่อไป (วันที่ผ่านมาแล้วไม่เปลี่ยน)',
      body: '<p class="muted" style="margin-top:0">1 บรรทัด = 1 ฝ่ายงาน · มีรายชื่อ: <code>QC: แป้ง, ลูกศร, จอย</code> · ไม่มีรายชื่อ (กรอกจำนวนเอง): <code>job = 23</code></p>'
        + '<textarea id="hdRolesTxt" rows="16" style="width:100%;font:inherit;padding:10px;border:1.5px solid var(--line);border-radius:10px">' + esc(txt) + '</textarea>',
      ok: 'บันทึก',
      submit: function () {
        var list = $('hdRolesTxt').value.split('\n').map(function (l) { return l.trim(); }).filter(String).map(function (l) {
          var m = l.match(/^(.+?)\s*=\s*(\d+)\s*$/); if (m) return { role: m[1].trim(), names: '', count: +m[2] };
          var k = l.indexOf(':'); return k > 0 ? { role: l.slice(0, k).trim(), names: l.slice(k + 1).trim() } : { role: l, names: '', count: 0 };
        });
        return call('hrDailySaveRoles', state.token, list).then(function (r) {
          if (!r.ok) return r.error;
          closeModal(); D.data.roles = r.roles;
          // หน้าจอวันที่เปิดอยู่ตามรายชื่อใหม่ (ลบชื่อ = หายจากการ์ดและตาราง) · วันที่ผ่านมาแล้วคงตามที่บันทึกไว้
          if (D.date < D.data.today) { toast('บันทึกรายชื่อแล้ว (มีผลกับวันนี้และวันต่อไป)'); render(); return; }
          D.day.roles = syncRoles(D.day.roles, r.roles); D.dirty = true;
          if (!D.data.day) { toast('บันทึกรายชื่อแล้ว'); render(); return; }
          return save().then(function (ok) { toast(ok ? 'บันทึกรายชื่อแล้ว' : 'บันทึกรายชื่อแล้ว — กดบันทึกวันนี้อีกครั้ง'); render(); });
        });
      } });
  }
  // รวมรายชื่อใหม่เข้ากับวันที่เปิดอยู่: คงการลา / ลาออก / หมายเหตุ ของคนที่ยังอยู่ · ฝ่ายที่กรอกจำนวนคงจำนวนที่กรอกไว้
  // จับคู่ด้วยชื่อฝ่ายงาน + ลำดับ (ชื่อฝ่ายซ้ำได้ เช่น ผู้บริหาร 2 แถว)
  function syncRoles(oldRoles, roles) {
    var seen = {}, key = function (role) { seen[role] = (seen[role] || 0) + 1; return role + '#' + seen[role]; }, prev = {};
    oldRoles.forEach(function (r) { prev[key(r.role)] = r; });
    seen = {};
    return roles.map(function (x) {
      var o = prev[key(x.role)], names = splitNames(x.names);
      var keep = function (l) { return names.indexOf(l.name) >= 0; };
      if (names.length) return { role: x.role, names: names, count: names.length, leaves: o ? o.leaves.filter(keep) : [], resigns: o ? (o.resigns || []).filter(keep) : [], note: o ? o.note || '' : '' };
      var wasCount = o && !o.names.length;
      return { role: x.role, names: [], count: wasCount ? o.count : x.count, leaves: wasCount ? o.leaves : [], resigns: wasCount ? (o.resigns || []) : [], note: o ? o.note || '' : '' };
    });
  }
  function save() {
    var b = $('hdSave'); if (b) { b.disabled = true; b.innerHTML = '<span class="spinner dark"></span> กำลังบันทึก'; }
    return call('hrDailySave', state.token, D.date, D.day).then(function (r) {
      if (!r.ok) { toast(r.error); if (b) { b.disabled = false; b.textContent = 'บันทึก'; } return false; }
      D.dirty = false; D.data.day = D.day; return true;
    }).catch(function (e) { onServerError(e); return false; });
  }
  function makeImage() {
    var ready = window.html2canvas ? Promise.resolve() : new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = H2C_URL; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
    return ready.then(function () { return document.fonts ? document.fonts.ready : null; }).then(function () {
      var box = document.createElement('div'); box.className = 'hdimgbox'; box.innerHTML = tableHtml(D.day, D.date); document.body.appendChild(box);
      return window.html2canvas(box.firstChild, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (cv) {
        document.body.removeChild(box);
        var w = cv.width, h = Math.min(cv.height, w * 3), url = cv.toDataURL('image/png');
        return { url: url, png: url.split(',')[1], ratio: w + ':' + h };
      }, function (e) { document.body.removeChild(box); throw e; });
    });
  }
  // บันทึก → สร้างภาพ → แสดงภาพให้ดูก่อน → กดส่ง
  function sendFlow() {
    var b = $('hdSend'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังสร้างภาพ';
    save().then(function (ok) {
      if (!ok) return null;
      return makeImage();
    }).then(function (img) {
      b.disabled = false; b.innerHTML = icon('send', 16) + ' ดูภาพ & ส่ง LINE';
      if (!img) return;
      openModal({ color: state.dept.color, icon: 'send', wide: true, title: 'ภาพที่จะส่งเข้า LINE', sub: 'จำนวนพนักงาน วันที่ ' + th(D.date),
        body: '<img src="' + img.url + '" alt="ภาพตาราง" style="width:100%;border:1px solid var(--line);border-radius:10px">', ok: 'ส่งเข้ากลุ่ม LINE',
        submit: function () {
          return call('hrDailySendLine', state.token, D.date, img.png, img.ratio).then(function (r) {
            if (!r.ok) return r.error;
            D.data.sentAt = r.sentAt; closeModal(); toast('ส่ง LINE แล้ว'); render();
          }).catch(function (e) {   // แสดงสาเหตุจริง (เดิมขึ้นแค่ "เชื่อมต่อไม่ได้")
            var m = String(e && e.message || e);
            if (m.indexOf('SESSION_EXPIRED') >= 0) throw e;
            return /fetch|load failed|network/i.test(m) ? 'เชื่อมต่อไม่ได้ (' + m + ') — ลองใหม่อีกครั้ง' : 'ส่งไม่สำเร็จ: ' + m;
          });
        } });
    }).catch(function (e) { b.disabled = false; b.innerHTML = icon('send', 16) + ' ดูภาพ & ส่ง LINE'; toast('สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง'); });
  }

  var css = document.createElement('style');
  css.textContent = [
    // หัวหน้าเช็คพนักงานรายวัน จัดเป็นกล่องเดียว (ผู้ใช้ขอ 22/11/69): วันที่ + ตัวเลขสรุป · ป้ายสถานะ · ปุ่ม 2 ปุ่มกว้างเท่ากัน
    '.hdhead{display:flex;flex-direction:column;gap:12px;padding:14px 16px;margin-bottom:12px}.hdrow{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap}',
    '.hdhead .hdlb{display:flex;flex-direction:column;align-items:stretch;gap:4px;font-size:13px;font-weight:600;color:var(--muted);flex:1 1 170px;min-width:0;max-width:240px}.hdhead .hdlb input{width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-size:15px;color:var(--ink);background:#fff}',
    '.hdstat{display:flex;gap:8px}.hdstat>div{display:flex;flex-direction:column;align-items:center;min-width:78px;padding:6px 12px;border-radius:12px;background:#f1f5f9}.hdstat small{font-size:11.5px;color:var(--muted);line-height:1.2}.hdstat b{font-size:22px;line-height:1.15;color:var(--ink)}.hdstat .lv{background:#fef2f2}.hdstat .lv b{color:#dc2626}',
    '.hdtags{display:flex;flex-wrap:wrap;gap:6px}.hdtags:empty{display:none}.hdbtns{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;max-width:520px}.hdbtns .btn{width:100%;justify-content:center;margin:0;white-space:nowrap;font-size:13.5px;padding-left:8px;padding-right:8px;gap:6px}',
    '.hdfoot{flex-wrap:wrap}.hdadd{flex:0 0 auto}@media (max-width:560px){.hdadd{flex:1 1 100%;justify-content:center}.hdstat>div{min-width:64px;padding:6px 10px}}',
    '.hdbar{flex-wrap:wrap;gap:10px;align-items:center}.hdlb{display:flex;gap:6px;align-items:center;font-weight:600}.hdlb input{padding:7px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.hdsum{color:var(--muted)}.hdsum b{color:var(--ink)}.hdsum .neg{color:#dc2626}.hdtag{font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:99px;background:#e2e8f0;color:#334155}.hdtag.ok{background:#dcfce7;color:#166534}',
    '.hdgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:12px}.hdcard{padding:12px 14px}.hdch{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.hdch span{color:var(--muted);white-space:nowrap}.hdch em{color:#dc2626;font-style:normal;font-weight:700}',
    '.hdchips{display:flex;flex-wrap:wrap;gap:6px}.hdchip{border:1.5px solid var(--line);background:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:14px;cursor:pointer}.hdchip:hover{border-color:var(--c)}.hdchip.off{background:#fee2e2;border-color:#fca5a5;color:#991b1b;text-decoration:line-through}',
    '.hgnow{padding:10px 12px;border-radius:10px;font-weight:600;margin-bottom:12px}.hgnow.ok{background:#dcfce7;color:#15803d}.hgnow.bad{background:#fee2e2;color:#991b1b}.hgmsg{margin:0 0 10px;color:var(--muted);font-size:13px}',
    '.hgol{margin:6px 0 12px;padding-left:22px;line-height:1.6}.hgol li{margin-bottom:6px}.hgacts{display:flex;gap:8px;flex-wrap:wrap}',
    '.hdcode{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 2px}.hdcode code{background:#f1f5f9;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:15px;font-weight:700;user-select:all}',
    '.hdcnt{display:flex;gap:8px;align-items:center}.hdcnt input{width:90px;padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.hdchip.lt{border-color:#f59e0b;background:#fffbeb;color:#92400e}.hdlv div.lt{color:#b45309}.hdcard em.lt{color:#b45309}.hdauto{font-size:11px;color:#64748b;background:#f1f5f9;border-radius:6px;padding:1px 6px;margin-left:4px}',
    '.hdun{border:2px dashed #f59e0b;margin-bottom:12px}.hdun h4{margin:0 0 8px}.hdunr{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}.hdunr span{flex:1;min-width:180px}.hdunr select{padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit}',
    '.hdlv{margin-top:8px;border-top:1px dashed var(--line);padding-top:6px}.hdlv div{display:flex;justify-content:space-between;gap:8px;font-size:14px;color:#991b1b;padding:2px 0}',
    '.hdfoot{display:flex;gap:8px;align-items:center;margin-top:8px}.hdnote{flex:1;min-width:0;padding:6px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px}',
    '.hdchip.gone{background:#e2e8f0;border-color:#94a3b8;color:#334155;text-decoration:line-through}.hdtypes .hdtrs span{border-style:dashed}.hdtypes .hdtrs input:checked+span{border-color:#334155;background:#e2e8f0;color:#0f172a}',
    '.hdtypes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.hdtypes input{position:absolute;opacity:0}.hdtypes span{display:block;padding:8px 12px;border:1.5px solid var(--line);border-radius:99px;cursor:pointer;font-weight:600}.hdtypes input:checked+span{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,white);color:var(--c)}.hdtypes input:focus-visible+span{outline:2px solid var(--c)}',
    '.hdprev{overflow-x:auto}.hdimgbox{position:fixed;left:-4000px;top:0}',
    '.hdimg{display:inline-block;min-width:720px;padding:18px;background:#fff;color:#000}.hdt{text-align:center;font-size:24px;font-weight:700;margin-bottom:12px}',
    '.hdbrand{display:flex;align-items:center;gap:12px;padding-bottom:10px;margin-bottom:12px;border-bottom:2px solid #e2e8f0}.hdlogo{height:56px;width:auto}.hdbrand b{display:block;font-size:20px}.hdbrand span{display:block;font-size:14px;color:#475569}',
    '.hdtab{border-collapse:collapse;width:100%;font-size:15px}.hdtab th{background:' + C_HEAD + ';border:1px solid #000;padding:8px;font-size:16px;white-space:nowrap}.hdtab td{border:1px solid #000;padding:6px 8px;vertical-align:top}',
    '.hdtab .hdr{background:' + C_ROLE + ';font-weight:700;white-space:nowrap}.hdtab .hdc{text-align:center;font-weight:700}.hdtab .hdn{max-width:260px}.hdtab .hdl{color:#b91c1c;min-width:200px}.hdtab .hdl div{white-space:nowrap}.hdtab .hdrn{color:#b91c1c;white-space:nowrap}',
    '.hdtab tfoot td{background:' + C_FOOT + ';font-size:15px}.hdtab tfoot .hdf1{background:' + C_ROLE + ';font-size:17px}'
  ].join('\n');
  document.head.appendChild(css);
})();
