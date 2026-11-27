// ==================== ฝ่ายบุคคล: ไฟล์ Excel แบบจัดรูปแบบ (ผู้ใช้ขอ 27/11/69) ====================
// window.HRXLS — เรียกจาก hr.js (ปุ่ม Excel ด้านบน / ปุ่มในหน้าการลา)
// 1) ทะเบียนพนักงาน / พนักงาน Job: หัวตารางสี + เส้นตารางทุกช่อง + รูปพนักงานในช่อง + ความกว้างช่องพอดีข้อมูล
// 2) ตารางสรุปการลา / ขาด / มาสาย รายเดือน แบบไฟล์ "ตารางพนักงานลาหยุด" ของ HR: 1 แถว = 1 คน, ช่องวันที่ 1–31 = ประเภท + ชั่วโมงที่ลา,
//    ลาออกเดือนนั้น = ช่องสีแดง "ลาออก" ตั้งแต่วันที่ออก · ออกก่อนเดือนนั้น = ไม่อยู่ในตาราง
(function () {
  var X = window.HRXLS = {};
  var XJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  var FONT = 'Angsana New';
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  var C_HEAD = 'FFCCFF66', C_WEEKEND = 'FFFFCCFF', C_TITLE = 'FFD9E1F2', C_RESIGN = 'FFFF0000', C_SUM = 'FFFBE5D6';
  // ตัวย่อในช่องวันที่ (แบบที่ HR ใช้ในไฟล์เดิม: ป / ก / พ) + สีพื้นของแต่ละประเภท
  var AB = { sick: ['ป', 'FFFCE4D6'], personal: ['ก', 'FFDDEBF7'], vacation: ['พ', 'FFE2EFDA'], birthday: ['วันเกิด', 'FFFDE9F3'], maternity: ['คลอด', 'FFEDE7F6'], paternity: ['ดูแลบุตร', 'FFEDE7F6'],
    ordain: ['บวช', 'FFEDE7F6'], military: ['ทหาร', 'FFEDE7F6'], training: ['อบรม', 'FFEDE7F6'], other: ['อื่น', 'FFEDE7F6'], absent: ['ขาด', 'FFF8CBAD'], late: ['สาย', 'FFFFF2CC'] };
  var LTN = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', birthday: 'ลาวันเกิด', maternity: 'ลาคลอด', paternity: 'ลาดูแลบุตร', ordain: 'ลาบวช', military: 'ลารับราชการทหาร', training: 'ลาฝึกอบรม', other: 'ลาอื่น ๆ', absent: 'ขาดงาน', late: 'มาสาย' };
  var CAL = { maternity: 1, paternity: 1 };   // นับวันปฏิทิน (รวมเสาร์อาทิตย์)

  function H() { return window.HRM; }
  function lib() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = XJS_URL; s.onload = ok; s.onerror = function () { no(new Error('โหลดตัวสร้างไฟล์ Excel ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); }; document.head.appendChild(s); });
  }
  function photos() {
    var h = H();
    if (h.photosLoaded && Object.keys(h.photos || {}).length) return Promise.resolve(h.photos);
    return call('hrPhotos', state.token).then(function (r) { if (r && r.ok) { h.photos = r.photos; h.photosLoaded = true; } return h.photos || {}; }).catch(function () { return h.photos || {}; });
  }
  function jobs() {
    var h = H();
    return h.jobs ? Promise.resolve(h.jobs) : call('hrJobs', state.token).then(function (r) { h.jobs = r; return r; });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dOf(s) { var p = String(s).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + (+p[0] + 543) : String(s); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function vis(s) { return String(s == null ? '' : s).replace(/[ัิ-ฺ็-๎]/g, ''); }   // ความยาวที่เห็นจริง (ไม่นับสระบน/ล่าง วรรณยุกต์)
  function wl(s) { s = vis(s); var a = (s.match(/[\x20-\x7e]/g) || []).length; return (s.length - a) + a * 1.3; }   // ตัวเลข / อังกฤษกว้างกว่าตัวไทยใน Angsana New
  function border(cell) { var t = { style: 'thin', color: { argb: 'FF7F7F7F' } }; cell.border = { top: t, left: t, bottom: t, right: t }; }
  function fill(cell, argb) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
  function save(wb, name) {
    return wb.xlsx.writeBuffer().then(function (buf) {
      var a = document.createElement('a'), url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    });
  }
  function imgOf(wb, data) {
    var m = String(data || '').match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
    return m ? wb.addImage({ base64: m[2], extension: m[1] === 'png' ? 'png' : 'jpeg' }) : null;
  }
  function stamp() { var t = new Date(); return pad(t.getDate()) + '-' + pad(t.getMonth() + 1) + '-' + String(t.getFullYear() + 543).slice(2); }

  // ---------- 1) ทะเบียนพนักงาน / พนักงาน Job ----------
  var PH_W = 14, PH_ROW = 82;   // ช่องรูป: กว้าง 14 ตัวอักษร (~103 px) · สูง 82 pt (~109 px)
  function registrySheet(wb, name, title, cols, list, pics) {
    var ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '2:2' } });
    var all = [['__ph', 'รูป']].concat(cols), n = all.length;
    // แถว 1 = ชื่อตาราง · แถว 2 = หัวตาราง
    ws.mergeCells(1, 1, 1, n);
    var t = ws.getCell(1, 1); t.value = title; t.font = { name: FONT, size: 22, bold: true }; t.alignment = { vertical: 'middle', horizontal: 'left' }; ws.getRow(1).height = 34;
    var hr = ws.getRow(2); hr.height = 30;
    all.forEach(function (c, i) { var cell = hr.getCell(i + 1); cell.value = c[1]; cell.font = { name: FONT, size: 16, bold: true }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; fill(cell, C_HEAD); border(cell); });
    // ลำดับ ต่อด้วยรูป (รูปอยู่หลังลำดับ แบบไฟล์ของ HR)
    var order = [0].concat(all.map(function (c, i) { return i; }).filter(function (i) { return i > 0; }));
    var seqIdx = all.map(function (c) { return c[0]; }).indexOf('seq');
    if (seqIdx > 0) { order = [seqIdx, 0].concat(order.filter(function (i) { return i !== 0 && i !== seqIdx; })); }
    var colsO = order.map(function (i) { return all[i]; });
    colsO.forEach(function (c, i) { var cell = hr.getCell(i + 1); cell.value = c[1]; });
    var widths = colsO.map(function (c) { return Math.max(7, Math.min(wl(c[1]), 16) * 1.05 + 3); });
    list.forEach(function (r, k) {
      var row = ws.getRow(k + 3);
      colsO.forEach(function (c, i) {
        var cell = row.getCell(i + 1), v = c[0] === '__ph' ? '' : r[c[0]];
        if (v == null) v = '';
        if (/Date$/.test(c[0])) v = thD(v);
        else if (c[0] === 'seq' && v !== '' && !isNaN(v)) v = Number(v);
        cell.value = v; cell.font = { name: FONT, size: 16 }; border(cell);
        cell.alignment = { vertical: 'middle', horizontal: c[0] === 'seq' || /Date$|gender|status|vacDays/.test(c[0]) ? 'center' : 'left', wrapText: true };
        var L = Math.min(wl(v), 60) * 1.1 + 4; if (/Date$/.test(c[0]) && v) L = Math.max(L, 14);
        if (L > widths[i]) widths[i] = L;
      });
      var pic = imgOf(wb, pics(r));
      row.height = pic != null ? PH_ROW : 26;
      if (pic != null) ws.addImage(pic, { tl: { col: colsO.indexOf(all[0]) + 0.08, row: k + 2 + 0.05 }, ext: { width: 84, height: 104 }, editAs: 'oneCell' });
      if (r.status === 'ลาออก') row.getCell(colsO.map(function (c) { return c[0]; }).indexOf('status') + 1).font = { name: FONT, size: 16, bold: true, color: { argb: 'FFC00000' } };
    });
    colsO.forEach(function (c, i) { ws.getColumn(i + 1).width = c[0] === '__ph' ? PH_W : Math.min(Math.max(widths[i], 8), 55); });
    if (!list.length) { ws.mergeCells(3, 1, 3, n); var e = ws.getCell(3, 1); e.value = 'ไม่มีรายชื่อ'; e.font = { name: FONT, size: 16, italic: true }; e.alignment = { horizontal: 'center' }; }
    return ws;
  }
  X.registry = function (page) {
    var h = H();
    return Promise.all([lib(), photos(), page === 'h_job' ? jobs() : Promise.resolve(null)]).then(function (x) {
      var pics = x[1] || {}, wb = new window.ExcelJS.Workbook(), today = thD(h.data.today);
      wb.creator = 'ระบบงานองค์กร · ฝ่ายบุคคล';
      if (page === 'h_job') {
        var js = (x[2] && x[2].jobs || []).slice().sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); });
        var jp = function (j) { return j.photoThumb || pics[j.id]; };
        registrySheet(wb, 'พนักงาน Job ทำงานอยู่', 'ทะเบียนพนักงาน Job (ทำงานอยู่) · ข้อมูล ณ ' + today, h.XP_JOB, js.filter(function (j) { return j.status !== 'ลาออก'; }), jp);
        registrySheet(wb, 'พนักงาน Job ลาออก', 'ทะเบียนพนักงาน Job (ลาออกแล้ว) · ข้อมูล ณ ' + today, h.XP_JOB, js.filter(function (j) { return j.status === 'ลาออก'; }), jp);
        return save(wb, 'ทะเบียนพนักงาน Job ' + stamp() + '.xlsx');
      }
      var es = h.data.emps.slice().sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); });
      var ep = function (e) { return pics[e.id]; };
      registrySheet(wb, 'ทำงานอยู่', 'ทะเบียนพนักงาน (ทำงานอยู่) · ข้อมูล ณ ' + today, h.XP_EMP, es.filter(function (e) { return e.status !== 'ลาออก'; }), ep);
      registrySheet(wb, 'ลาออกแล้ว', 'ทะเบียนพนักงาน (ลาออกแล้ว) · ข้อมูล ณ ' + today, h.XP_EMP, es.filter(function (e) { return e.status === 'ลาออก'; }), ep);
      return save(wb, 'ทะเบียนพนักงาน ' + stamp() + '.xlsx');
    }).then(function () { toast('ดาวน์โหลดไฟล์ Excel แล้ว'); });
  };

  // ---------- ทุกหน้าอื่นของฝ่ายบุคคล: ข้อมูลเดิมจากปุ่ม Excel แต่ใส่หัวตารางสี + เส้นตาราง + ความกว้างพอดี (ผู้ใช้ขอ "ทุก ๆ ส่วน" 27/11/69) ----------
  X.styled = function (sheets, fileName) {
    return lib().then(function () {
      var wb = new window.ExcelJS.Workbook(), used = {};
      sheets.forEach(function (sh) {
        var nm = String(sh.name || 'Sheet').replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet', k = 2;
        while (used[nm]) nm = nm.slice(0, 28) + ' ' + (k++); used[nm] = 1;
        var ws = wb.addWorksheet(nm, { views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' } });
        var rows = sh.rows || [], n = rows.reduce(function (m, r) { return Math.max(m, (r || []).length); }, 0), w = [];
        rows.forEach(function (r, i) {
          var row = ws.getRow(i + 1);
          for (var c = 0; c < n; c++) {
            var v = r && r[c] != null ? r[c] : '', cell = row.getCell(c + 1);
            cell.value = v; border(cell);
            cell.font = { name: FONT, size: 16, bold: i === 0 };
            cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'center' : typeof v === 'number' ? 'right' : 'left', wrapText: true };
            if (i === 0) fill(cell, C_HEAD);
            w[c] = Math.max(w[c] || 7, Math.min(wl(v), i === 0 ? 16 : 60) * 1.1 + 4);
          }
          row.height = i === 0 ? 30 : undefined;
        });
        for (var c2 = 0; c2 < n; c2++) ws.getColumn(c2 + 1).width = Math.min(w[c2] || 8, 55);
      });
      return save(wb, fileName);
    }).then(function () { toast('ดาวน์โหลดไฟล์ Excel แล้ว'); });
  };

  // ---------- 2) ตารางสรุปการลา / ขาด / มาสาย รายเดือน ----------
  function dayHrs() { var d = H().data.settings.dayHours; return Array.isArray(d) && d.length === 7 ? d : [0, 10, 10, 10, 10, 8, 0]; }
  // ชั่วโมงของใบลาที่ตกในวันนั้น: รายชั่วโมง = นาที ÷ 60 ในวันนั้น · ลาคลอด / ดูแลบุตร = แบ่งเท่ากันทุกวันปฏิทิน · อื่น ๆ = แบ่งตามชั่วโมงทำงานของแต่ละวัน
  function partOf(l, day) {
    var from = String(l.dateFrom).slice(0, 10), to = String(l.dateTo || l.dateFrom).slice(0, 10);
    if (day < from || day > to) return null;
    if (l.type === 'late') return { m: Number(l.minutes) || 0 };
    var dh = dayHrs(), tot = Number(l.hours) || 0, days = [], d = dOf(from), end = dOf(to);
    while (d <= end && days.length < 400) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    if (Number(l.minutes) > 0 && from === to) return { h: r2(Number(l.minutes) / 60) };
    if (CAL[l.type]) return { h: r2(tot / days.length) };
    var w = days.map(function (x) { return Number(dh[x.getDay()]) || 0; }), sw = w.reduce(function (a, b) { return a + b; }, 0);
    var me = Number(dh[dOf(day).getDay()]) || 0;
    if (!sw) return { h: r2(tot / days.length) };
    return me ? { h: r2(tot * me / sw) } : null;   // วันหยุดในช่วงลา = ไม่นับ
  }
  function cellText(l, p) {
    var a = LTN[l.type] || LTN.other;   // ชื่อการลาเต็ม ไม่ใช้ตัวย่อ (ผู้ใช้ขอ 27/11/69)
    if (l.type === 'late') return a + (p.m ? '\n' + p.m + ' นาที' : '');
    return a + '\n' + r2(p.h) + ' ชม.';
  }
  X.leaveMonth = function (ym) {
    var h = H(), y = +ym.slice(0, 4), m = +ym.slice(5, 7), nd = new Date(y, m, 0).getDate(), first = ym + '-01', last = ym + '-' + pad(nd);
    return Promise.all([lib(), photos()]).then(function (x) {
      var wb = new window.ExcelJS.Workbook(), dh = dayHrs();
      var inMonth = function (p) { return (!p.startDate || String(p.startDate) <= last) && !(p.endDate && String(p.endDate) < first) && !(p.status === 'ลาออก' && !p.endDate); };
      var staff = h.data.emps.filter(inMonth).sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); });
      var jb = (h.data.jobs || []).filter(inMonth).sort(function (a, b) { return (Number(a.seq) || 9999) - (Number(b.seq) || 9999); });
      var people = staff.map(function (e) { return { p: e, name: e.fullName, nick: e.nickname, grp: e.group || e.position || '' }; })
        .concat(jb.map(function (j) { return { p: j, name: j.fullName || j.name || '', nick: j.nickname, grp: 'Job' + (j.building ? ' · ' + j.building : '') }; }));
      var lv = h.data.leaves.filter(function (l) { return l.status === 'อนุมัติ' && String(l.dateFrom).slice(0, 10) <= last && String(l.dateTo || l.dateFrom).slice(0, 10) >= first; });
      var byEmp = {}; lv.forEach(function (l) { (byEmp[l.empId] = byEmp[l.empId] || []).push(l); });
      var title = 'ตารางพนักงานลาหยุด เดือน' + MONTHS[m - 1] + ' ' + (y + 543);
      var ws = wb.addWorksheet(MONTHS[m - 1] + ' ' + (y + 543), { views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }],
        pageSetup: { orientation: 'landscape', paperSize: 8, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '2:3' } });
      var D0 = 6, SUM = [['sick', 'ป่วย\n(ชม.)'], ['personal', 'กิจ\n(ชม.)'], ['vacation', 'พักร้อน\n(ชม.)'], ['otherH', 'ลาอื่น ๆ\n(ชม.)'], ['absent', 'ขาด\n(ครั้ง)'], ['late', 'สาย\n(ครั้ง)'], ['total', 'รวมลา\n(ชม.)']];
      var S0 = D0 + nd, lastCol = S0 + SUM.length - 1;
      var weekend = function (d) { return !(Number(dh[new Date(y, m - 1, d).getDay()]) > 0); };
      // แถว 1 ชื่อตาราง
      ws.mergeCells(1, 1, 1, lastCol);
      var t = ws.getCell(1, 1); t.value = title + '   (นับเฉพาะใบลาที่อนุมัติแล้ว)'; t.font = { name: FONT, size: 26, bold: true }; t.alignment = { vertical: 'middle' }; ws.getRow(1).height = 40;
      // แถว 2 วันในสัปดาห์ · แถว 3 หัวตาราง
      var r2w = ws.getRow(2), r3 = ws.getRow(3); r2w.height = 24; r3.height = 40;
      [['ลำดับ', 7], ['ชื่อ - สกุล', 30], ['ชื่อเล่น', 16], ['แผนก', 16], ['รูป', PH_W]].forEach(function (c, i) {
        ws.mergeCells(2, i + 1, 3, i + 1);
        var cell = ws.getCell(2, i + 1); cell.value = c[0]; cell.font = { name: FONT, size: 16, bold: true }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; fill(cell, C_HEAD); border(cell); border(ws.getCell(3, i + 1));
        ws.getColumn(i + 1).width = c[1];
      });
      for (var d = 1; d <= nd; d++) {
        var col = D0 + d - 1, we = weekend(d), a = ws.getCell(2, col), b = ws.getCell(3, col);
        a.value = WD[new Date(y, m - 1, d).getDay()]; b.value = d;
        [a, b].forEach(function (c) { c.font = { name: FONT, size: 16, bold: true }; c.alignment = { vertical: 'middle', horizontal: 'center' }; fill(c, we ? C_WEEKEND : C_HEAD); border(c); });
        ws.getColumn(col).width = 12;
      }
      SUM.forEach(function (s, i) {
        ws.mergeCells(2, S0 + i, 3, S0 + i);
        var c = ws.getCell(2, S0 + i); c.value = s[1]; c.font = { name: FONT, size: 15, bold: true }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; fill(c, C_SUM); border(c); border(ws.getCell(3, S0 + i));
        ws.getColumn(S0 + i).width = 9;
      });
      var perDay = []; for (var q = 0; q <= nd; q++) perDay.push(0);
      var tot = { sick: 0, personal: 0, vacation: 0, otherH: 0, absent: 0, late: 0, total: 0 };
      people.forEach(function (o, k) {
        var r = k + 4, row = ws.getRow(r), p = o.p, sum = { sick: 0, personal: 0, vacation: 0, otherH: 0, absent: 0, late: 0, total: 0 }, seen = {};
        [k + 1, o.name, o.nick || '', o.grp, ''].forEach(function (v, i) {
          var c = row.getCell(i + 1); c.value = v; c.font = { name: FONT, size: 16 }; c.alignment = { vertical: 'middle', horizontal: i === 0 || i === 4 ? 'center' : 'left', wrapText: true }; border(c);
        });
        var resignFrom = p.endDate && String(p.endDate).slice(0, 7) === ym ? +String(p.endDate).slice(8, 10) : 0;
        for (var d = 1; d <= nd; d++) {
          var c = row.getCell(D0 + d - 1), day = ym + '-' + pad(d), texts = [], tone = null;
          c.font = { name: FONT, size: 14 }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; border(c);
          if (resignFrom && d >= resignFrom) { c.value = 'ลาออก'; c.font = { name: FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; fill(c, C_RESIGN); continue; }
          (byEmp[p.id] || []).forEach(function (l) {
            var part = partOf(l, day); if (!part) return;
            texts.push(cellText(l, part)); tone = tone || (AB[l.type] || AB.other)[1];
            if (l.type === 'late') { if (!seen[l.id]) { sum.late++; seen[l.id] = 1; } return; }
            if (l.type === 'absent') { if (!seen[l.id]) { sum.absent++; seen[l.id] = 1; } }
            var key = l.type === 'sick' || l.type === 'personal' || l.type === 'vacation' ? l.type : l.type === 'absent' ? null : 'otherH';
            if (key) sum[key] = r2(sum[key] + part.h);
            if (l.type !== 'absent') sum.total = r2(sum.total + part.h);
            perDay[d]++;
          });
          if (texts.length) { c.value = texts.join('\n'); fill(c, tone); }
          else if (weekend(d)) fill(c, 'FFFFF0FF');
        }
        SUM.forEach(function (s, i) { var c = row.getCell(S0 + i); c.value = sum[s[0]] || ''; c.font = { name: FONT, size: 16, bold: s[0] === 'total' }; c.alignment = { vertical: 'middle', horizontal: 'center' }; border(c); tot[s[0]] = r2(tot[s[0]] + (sum[s[0]] || 0)); });
        var pic = imgOf(wb, p.photoThumb || x[1][p.id]);
        row.height = pic != null ? PH_ROW : 30;
        if (pic != null) ws.addImage(pic, { tl: { col: 4 + 0.08, row: r - 1 + 0.05 }, ext: { width: 84, height: 104 }, editAs: 'oneCell' });
        var lenName = wl(o.name) * 1.1 + 4; if (lenName > ws.getColumn(2).width) ws.getColumn(2).width = Math.min(lenName, 45);
        var lenGrp = wl(o.grp) * 1.1 + 4; if (lenGrp > ws.getColumn(4).width) ws.getColumn(4).width = Math.min(lenGrp, 30);
      });
      // แถวรวม: จำนวนคนที่ลาในแต่ละวัน + ยอดรวมแต่ละประเภท
      var rr = ws.getRow(people.length + 4); rr.height = 30;
      ws.mergeCells(people.length + 4, 1, people.length + 4, 5);
      var lab = rr.getCell(1); lab.value = 'รวม (คนที่ลาในวันนั้น)'; lab.font = { name: FONT, size: 16, bold: true }; lab.alignment = { vertical: 'middle', horizontal: 'right' };
      for (var c = 1; c <= lastCol; c++) { var cc = rr.getCell(c); fill(cc, C_SUM); border(cc); if (c > 5) { cc.font = { name: FONT, size: 16, bold: true }; cc.alignment = { vertical: 'middle', horizontal: 'center' }; } }
      for (var d2 = 1; d2 <= nd; d2++) rr.getCell(D0 + d2 - 1).value = perDay[d2] || '';
      SUM.forEach(function (s, i) { rr.getCell(S0 + i).value = tot[s[0]] || ''; });
      // คำอธิบายตัวย่อ
      var lg = people.length + 6;
      ws.mergeCells(lg, 1, lg, lastCol);
      var lc = ws.getCell(lg, 1);
      lc.value = 'หมายเหตุ: ตัวเลข = ชั่วโมงที่ลาในวันนั้น (มาสาย = นาที) · ช่องสีแดง "ลาออก" = ออกตั้งแต่วันนั้น · ช่องสีชมพู = วันหยุด';
      lc.font = { name: FONT, size: 15 }; lc.alignment = { wrapText: true, vertical: 'top' }; ws.getRow(lg).height = 30;
      return save(wb, 'สรุปการลา ขาด มาสาย ' + MONTHS[m - 1] + ' ' + (y + 543) + '.xlsx').then(function () { return people.length; });
    }).then(function (n) { toast('ดาวน์โหลดตารางสรุปการลา ' + MONTHS[m - 1] + ' แล้ว (' + n + ' คน)'); });
  };
})();
