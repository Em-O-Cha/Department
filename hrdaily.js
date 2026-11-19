// ==================== ฝ่ายบุคคล — เช็คพนักงานรายวัน ====================
// เมนู "เช็คพนักงานรายวัน" (h_day) ในโมดูล HR — hr.js เรียก HRDAILY.page()
// แตะชื่อ = บันทึกลา (ประเภท + เหตุผล) → ชื่อย้ายจากช่อง "ชื่อ" ไปช่อง "การลา" · ฝ่ายที่ไม่มีรายชื่อ = กรอกจำนวน + เพิ่มคนลาเอง
// จำนวนพนักงานนับทั้งหมด (รวมคนลา) · ภาพตาราง (html2canvas) แสดงให้ดูก่อนส่ง LINE · API ใน HrDaily.gs
(function () {
  var D = window.HRDAILY = { data: null, date: '', day: null, dirty: false };
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var C_HEAD = '#D9E1F2', C_ROLE = '#E2EFDA', C_FOOT = '#FBE5D6';

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
        resign: 0,
        roles: r.roles.map(function (x) {
          var names = splitNames(x.names);
          return { role: x.role, names: names, count: names.length ? names.length : (r.lastCounts[x.role] != null ? r.lastCounts[x.role] : x.count), leaves: [], note: '' };
        })
      };
      render();
    }).catch(onServerError);
  }
  D.page = function () { if (!D.data) return load(''); render(); };

  // ---------- ตาราง (หน้าจอ + ภาพ LINE ใช้ตัวเดียวกัน) ----------
  function leaveText(l) { return l.name + ' (' + l.type + (l.reason ? ' · ' + l.reason : '') + ')'; }
  function tableHtml(day, date) {
    var total = 0, lv = 0;
    var rows = day.roles.map(function (r) {
      var off = r.leaves.map(function (l) { return l.name; });
      var working = r.names.filter(function (n) { return off.indexOf(n) < 0; });
      total += Number(r.count) || 0; lv += r.leaves.length;
      return '<tr><td class="hdr">' + esc(r.role) + '</td><td class="hdn">' + esc(working.join(', ')) + '</td><td class="hdc">' + n0(r.count) + '</td>'
        + '<td class="hdn">' + esc(r.note || '') + '</td><td class="hdl">' + r.leaves.map(function (l, i) { return '<div>' + (i + 1) + '.' + esc(leaveText(l)) + '</div>'; }).join('') + '</td></tr>';
    }).join('');
    return '<div class="hdimg"><div class="hdt">จำนวนพนักงาน วันที่ ' + th(date) + '</div><table class="hdtab"><thead><tr><th>ฝ่ายงาน</th><th>ชื่อ</th><th>จำนวนพนักงาน</th><th>หมายเหตุ</th><th>การลา</th></tr></thead><tbody>' + rows + '</tbody>'
      + '<tfoot><tr><td class="hdr hdf1" colspan="2">รวมพนักงานทั้งหมด</td><td class="hdf hdc"><b>' + n0(total) + '</b></td><td class="hdf">ลาออกทั้งหมด <b>' + n0(day.resign) + '</b> คน</td><td class="hdf">ลางานทั้งหมด <b>' + n0(lv) + '</b> คน</td></tr></tfoot></table></div>';
  }

  // ---------- หน้า ----------
  function render() {
    var d = D.data, day = D.day, L = d.line;
    var total = day.roles.reduce(function (s, r) { return s + (Number(r.count) || 0); }, 0), lv = day.roles.reduce(function (s, r) { return s + r.leaves.length; }, 0);
    var sent = d.date === D.date && d.sentAt;
    $('main').innerHTML = '<h3>เช็คพนักงานรายวัน</h3><p class="lead">แตะชื่อคนที่ลา → เลือกประเภทและเหตุผล ชื่อจะย้ายไปช่อง "การลา" · ดูภาพตารางก่อนส่งเข้า LINE</p>'
      + '<div class="pbar hdbar"><label class="hdlb">วันที่ <input type="date" id="hdDate" value="' + D.date + '"></label>'
      + '<span class="hdsum">ทั้งหมด <b>' + n0(total) + '</b> คน · ลา <b class="neg">' + lv + '</b> คน</span>'
      + (sent ? '<span class="hdtag ok">ส่ง LINE แล้ว ' + esc(String(d.sentAt).slice(11, 16)) + '</span>' : d.day ? '<span class="hdtag">บันทึกแล้ว · ยังไม่ส่ง LINE</span>' : '<span class="hdtag">ยังไม่บันทึก</span>')
      + '<button class="btn btn-sm btn-line" id="hdRoles">' + icon('gear', 15) + ' แก้ฝ่ายงาน / รายชื่อ</button></div>'
      + (L.token && L.group ? '' : lineSetup(L))
      + '<div class="hdgrid">' + day.roles.map(function (r, i) {
        var off = r.leaves.map(function (l) { return l.name; });
        return '<div class="panel hdcard"><div class="hdch"><b>' + esc(r.role) + '</b><span>' + n0(r.count) + ' คน' + (r.leaves.length ? ' · <em>ลา ' + r.leaves.length + '</em>' : '') + '</span></div>'
          + (r.names.length
            ? '<div class="hdchips">' + r.names.map(function (n) { var isOff = off.indexOf(n) >= 0; return '<button class="hdchip' + (isOff ? ' off' : '') + '" data-ri="' + i + '" data-nm="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>'
            : '<label class="hdcnt">จำนวน <input type="number" min="0" inputmode="numeric" data-cnt="' + i + '" value="' + (Number(r.count) || 0) + '"> คน</label>')
          + (r.leaves.length ? '<div class="hdlv">' + r.leaves.map(function (l, j) { return '<div><span>' + esc(leaveText(l)) + '</span><button class="link-btn danger" data-unlv="' + i + ':' + j + '" aria-label="ยกเลิกการลา">ยกเลิก</button></div>'; }).join('') + '</div>' : '')
          + '<div class="hdfoot">' + (r.names.length ? '' : '<button class="link-btn" data-addlv="' + i + '">+ เพิ่มคนลา</button>')
          + '<input class="hdnote" data-note="' + i + '" placeholder="หมายเหตุ" value="' + esc(r.note || '') + '"></div></div>';
      }).join('') + '</div>'
      + '<div class="panel hdresign"><label>ลาออก (คน) <input type="number" min="0" id="hdResign" value="' + (Number(day.resign) || 0) + '"></label></div>'
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
    on('[data-unlv]', 'click', function (el) { var p = el.getAttribute('data-unlv').split(':'); day.roles[+p[0]].leaves.splice(+p[1], 1); D.dirty = true; render(); });
    on('[data-cnt]', 'change', function (el) { day.roles[+el.getAttribute('data-cnt')].count = Math.max(0, Math.round(Number(el.value) || 0)); D.dirty = true; render(); });
    on('[data-note]', 'change', function (el) { day.roles[+el.getAttribute('data-note')].note = el.value.trim(); D.dirty = true; $('hdPrev').innerHTML = tableHtml(day, D.date); });
    $('hdResign').addEventListener('change', function () { day.resign = Math.max(0, Math.round(Number(this.value) || 0)); D.dirty = true; $('hdPrev').innerHTML = tableHtml(day, D.date); });
    $('hdRoles').addEventListener('click', rolesDialog);
    $('hdSave').addEventListener('click', function () { save().then(function (ok) { if (ok) { toast('บันทึกแล้ว'); render(); } }); });
    $('hdSend').addEventListener('click', sendFlow);
    bindCopyCode();
  }
  function lineSetup(L) {
    if (!L.token) return '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>ยังไม่มีบอท LINE</b><span>ระบบใช้บอทของฝ่ายบัญชี — ให้ฝ่ายบัญชีตั้งค่า LINE ก่อน</span></div></div>';
    var cmd = 'ตั้งค่ากลุ่ม HR ' + L.setupCode;
    return '<div class="panel status off"><div class="dot">' + icon('warn', 20) + '</div><div><b>ยังไม่ได้ผูกกลุ่ม LINE ที่รับตารางนี้</b>'
      + '<span>เชิญบอท "SpunkyFood Report" (บอทฝ่ายบัญชี) เข้ากลุ่มที่ต้องการ แล้วพิมพ์ข้อความนี้ในกลุ่ม รอบอทตอบ "✅ ตั้งกลุ่มนี้…" แล้วกดรีเฟรชหน้านี้</span>'
      + '<div class="hdcode"><code>' + esc(cmd) + '</code><button class="btn btn-sm btn-line" data-copycmd="' + esc(cmd) + '">คัดลอก</button></div></div></div>';
  }
  function bindCopyCode() {
    on('[data-copycmd]', 'click', function (el) {
      var t = el.getAttribute('data-copycmd');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('คัดลอกแล้ว'); }, function () { toast(t); });
    });
  }
  function chip(i, name) {
    var r = D.day.roles[i], j = r.leaves.map(function (l) { return l.name; }).indexOf(name);
    if (j >= 0) { r.leaves.splice(j, 1); D.dirty = true; render(); return; }   // แตะคนที่ลาอยู่ = ยกเลิกการลา
    leaveDialog(i, name);
  }
  function leaveDialog(i, name) {
    var r = D.day.roles[i], types = D.data.leaveTypes;
    openModal({ color: state.dept.color, icon: 'cal', title: name ? 'บันทึกลา · ' + name : 'เพิ่มคนลา · ' + r.role, sub: r.role,
      body: (name ? '' : '<label class="cpnl">ชื่อคนลา<input id="hdLvName" maxlength="60" placeholder="ชื่อเล่น เช่น จอ ตี ห้า"></label>')
        + '<div class="hdtypes">' + types.map(function (t, k) { return '<label><input type="radio" name="hdT" value="' + esc(t) + '"' + (k ? '' : ' checked') + '><span>' + esc(t) + '</span></label>'; }).join('') + '</div>'
        + '<label class="cpnl">เหตุผล (ไม่บังคับ)<input id="hdLvWhy" maxlength="120" placeholder="เช่น ขาหัก / ไปหาหมอ"></label>',
      ok: 'บันทึกการลา',
      check: function () { return !name && !$('hdLvName').value.trim() ? 'ใส่ชื่อคนลา' : ''; },
      submit: function () {
        var t = ($('mBody').querySelector('input[name=hdT]:checked') || {}).value || 'ลา';
        r.leaves.push({ name: name || $('hdLvName').value.trim(), type: t, reason: $('hdLvWhy').value.trim() });
        D.dirty = true; closeModal(); render(); return Promise.resolve();
      } });
  }
  // แก้ฝ่ายงาน / รายชื่อ: 1 บรรทัด = 1 ฝ่ายงาน · "ฝ่ายงาน: ชื่อ, ชื่อ" หรือ "ฝ่ายงาน = จำนวน" (ไม่มีรายชื่อ)
  function rolesDialog() {
    var txt = D.data.roles.map(function (x) { return x.names ? x.role + ': ' + x.names : x.role + ' = ' + x.count; }).join('\n');
    openModal({ color: state.dept.color, icon: 'gear', wide: true, title: 'แก้ฝ่ายงาน / รายชื่อตั้งต้น', sub: 'ใช้กับวันที่ยังไม่บันทึก (วันที่บันทึกแล้วไม่เปลี่ยน)',
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
          closeModal(); toast('บันทึกรายชื่อแล้ว');
          if (!D.data.day) { D.data = null; load(D.date); } else { D.data.roles = r.roles; render(); }
        });
      } });
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
          });
        } });
    }).catch(function (e) { b.disabled = false; b.innerHTML = icon('send', 16) + ' ดูภาพ & ส่ง LINE'; toast('สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง'); });
  }

  var css = document.createElement('style');
  css.textContent = [
    '.hdbar{flex-wrap:wrap;gap:10px;align-items:center}.hdlb{display:flex;gap:6px;align-items:center;font-weight:600}.hdlb input{padding:7px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.hdsum{color:var(--muted)}.hdsum b{color:var(--ink)}.hdsum .neg{color:#dc2626}.hdtag{font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:99px;background:#e2e8f0;color:#334155}.hdtag.ok{background:#dcfce7;color:#166534}#hdRoles{margin-left:auto}',
    '.hdgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:12px}.hdcard{padding:12px 14px}.hdch{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.hdch span{color:var(--muted);white-space:nowrap}.hdch em{color:#dc2626;font-style:normal;font-weight:700}',
    '.hdchips{display:flex;flex-wrap:wrap;gap:6px}.hdchip{border:1.5px solid var(--line);background:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:14px;cursor:pointer}.hdchip:hover{border-color:var(--c)}.hdchip.off{background:#fee2e2;border-color:#fca5a5;color:#991b1b;text-decoration:line-through}',
    '.hdcnt{display:flex;gap:8px;align-items:center}.hdcnt input{width:90px;padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.hdlv{margin-top:8px;border-top:1px dashed var(--line);padding-top:6px}.hdlv div{display:flex;justify-content:space-between;gap:8px;font-size:14px;color:#991b1b;padding:2px 0}',
    '.hdfoot{display:flex;gap:8px;align-items:center;margin-top:8px}.hdnote{flex:1;min-width:0;padding:6px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px}',
    '.hdresign{padding:10px 14px;margin-bottom:12px}.hdresign input{width:80px;margin-left:8px;padding:6px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit}',
    '.hdcode{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.hdcode code{background:#f1f5f9;padding:6px 10px;border-radius:8px;font-size:15px}',
    '.hdtypes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.hdtypes input{position:absolute;opacity:0}.hdtypes span{display:block;padding:8px 12px;border:1.5px solid var(--line);border-radius:99px;cursor:pointer;font-weight:600}.hdtypes input:checked+span{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,white);color:var(--c)}.hdtypes input:focus-visible+span{outline:2px solid var(--c)}',
    '.hdprev{overflow-x:auto}.hdimgbox{position:fixed;left:-4000px;top:0}',
    '.hdimg{display:inline-block;min-width:720px;padding:18px;background:#fff;color:#000}.hdt{text-align:center;font-size:24px;font-weight:700;margin-bottom:12px}',
    '.hdtab{border-collapse:collapse;width:100%;font-size:15px}.hdtab th{background:' + C_HEAD + ';border:1px solid #000;padding:8px;font-size:16px;white-space:nowrap}.hdtab td{border:1px solid #000;padding:6px 8px;vertical-align:top}',
    '.hdtab .hdr{background:' + C_ROLE + ';font-weight:700;white-space:nowrap}.hdtab .hdc{text-align:center;font-weight:700}.hdtab .hdn{max-width:260px}.hdtab .hdl{color:#b91c1c;min-width:200px}.hdtab .hdl div{white-space:nowrap}',
    '.hdtab tfoot td{background:' + C_FOOT + ';font-size:15px}.hdtab tfoot .hdf1{background:' + C_ROLE + ';font-size:17px}'
  ].join('\n');
  document.head.appendChild(css);
})();
