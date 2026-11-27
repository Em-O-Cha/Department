// ==================== จัดซื้อ: ขออนุมัติ PO ทาง LINE (ผู้ใช้ขอ 24/11/69) ====================
// window.PURPO — ใช้จาก purchasing.js: หน้า p_poa, ปุ่มในใบ PO, หลังแนบ PDF
// วางลายเซ็นผู้ออกเอกสาร (เนย) บน PDF ของ PEAK ให้ดูตัวอย่าง → ส่งเข้ากลุ่ม LINE ให้พี่เก้กดอนุมัติ
// ไฟล์ 2 แบบสร้างในเบราว์เซอร์ด้วย pdf-lib: ขออนุมัติ (ลายเซ็นเนย) / อนุมัติแล้ว (เนย + พี่เก้ — เปิดให้ดูหลังกดอนุมัติ)
(function () {
  var A = window.PURPO = { list: null, sigs: null, info: null };
  var PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var PDFLIB_URL = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  var ST = { pending: ['wait', '⏳ รออนุมัติ'], approved: ['ok', '✓ อนุมัติแล้ว'], rejected: ['lock', '✕ ไม่อนุมัติ'], replaced: ['', 'ส่งใหม่แล้ว'] };
  var ROLE = { buyer: 'ผู้ออกเอกสาร', ceo: 'ผู้อนุมัติ' };

  function P() { return window.PUR; }
  function pad(n) { return ('0' + n).slice(-2); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function th(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + String(+m[1] + 543).slice(-2) : '-'; }
  function thT(s) { s = String(s || ''); return s ? th(s) + (s.length > 15 ? ' ' + s.slice(11, 16) + ' น.' : '') : '-'; }
  function money(v) { return v === '' || v == null ? '-' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท'; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('purpo_' + k) || 'null'); localStorage.setItem('purpo_' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function load(url) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { no(new Error('โหลดตัวอ่าน PDF ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); }; document.head.appendChild(s); }); }
  function libs() {
    var a = window.pdfjsLib ? Promise.resolve() : load(PDF_URL).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; });
    return a.then(function () { return window.PDFLib ? null : load(PDFLIB_URL); });
  }
  function b64ToBytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function bytesToB64(u) { var s = '', ch = 0x8000; for (var i = 0; i < u.length; i += ch) s += String.fromCharCode.apply(null, u.subarray(i, i + ch)); return btoa(s); }
  function nameOf(label) { return String(label || '').replace(/^ลายเซ็น\s*/, '') || label || ''; }
  function newCount() { return (A.list || []).filter(function (r) { return r.status === 'approved' && !r.seenAt; }).length; }
  // ผู้ใช้ขอ 26/11/69: เลิกใส่ลายเซ็น / ส่ง LINE ขออนุมัติ → หน้านี้เป็น "อัปโหลด PO ที่อนุมัติแล้ว" อ่านข้อมูลเก็บในระบบอย่างเดียว
  A.lineOn = false;
  A.newCount = function () { return A.lineOn ? newCount() : 0; };
  A.forDoc = function (docId) { if (!A.lineOn) return null; return (A.list || []).filter(function (r) { return r.docId === docId && r.status !== 'replaced'; })[0] || null; };
  A.setList = function (list) { A.list = list || []; css(); };
  function css() {
    if ($('purpoCss')) return;
    var s = document.createElement('style'); s.id = 'purpoCss';
    s.textContent = '.pas-wrap{position:relative;margin:0 auto;max-width:760px}.pas-page{position:relative;margin:0 auto 10px;box-shadow:0 2px 10px rgba(15,23,42,.15);background:#fff;touch-action:pan-y}.pas-page canvas{display:block;width:100%;height:auto}'
      + '.pas-box{position:absolute;border:2px solid #2563eb;border-radius:6px;cursor:move;touch-action:none;background:rgba(37,99,235,.06)}.pas-box img{width:100%;height:100%;object-fit:contain;pointer-events:none}'
      + '.pas-box.ceo{border:2px dashed #16a34a;background:rgba(22,163,74,.06)}.pas-box.ceo img{opacity:.35}.pas-box b{position:absolute;left:-2px;top:-22px;font-size:11px;white-space:nowrap;color:#fff;background:#2563eb;border-radius:6px 6px 0 0;padding:2px 6px}.pas-box.ceo b{background:#16a34a}'
      + '.pas-h{position:absolute;right:-9px;bottom:-9px;width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid currentColor;color:#2563eb;cursor:nwse-resize;touch-action:none}.pas-box.ceo .pas-h{color:#16a34a}'
      + '.pas-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px}.pas-sum div{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:8px 10px}.pas-sum small{display:block;color:var(--muted);font-size:12px}.pas-sum b{font-size:15px}'
      + '.pas-hint{font-size:13px;color:#334155;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 12px;margin-bottom:10px}.pas-hint.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}'
      + '.pas-att{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:10px;background:#fafafa}.pas-atth{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}.pas-ai{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px dashed var(--line);cursor:pointer}.pas-ai input{width:20px;height:20px}.pas-ai span{font-size:11px;font-weight:700;background:#e2e8f0;border-radius:6px;padding:1px 6px}.pas-ai b{font-weight:600;overflow-wrap:anywhere}.pas-ai small{color:var(--muted)}.pas-ai .link-btn{margin-left:auto}'
      + '.pa-up{display:flex;gap:8px 14px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.pa-up .btn{flex:0 0 auto;width:auto;white-space:nowrap}.pa-up small{flex:1 1 240px;font-size:13px}.pa-card .pa-t small{font-weight:400;font-size:12px}@media (max-width:560px){.pa-up .btn{width:100%;justify-content:center}}.pas-files{display:grid;gap:8px}.pas-files button{text-align:left}'
      + '.pa-card{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:#fff;margin-bottom:10px}.pa-card.new{border:2px solid #dc2626;background:#fef2f2}.pa-card .pa-i{flex:1;min-width:0}.pa-card .pa-i b{display:block;font-size:15px}.pa-card small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}'
      + '.pa-card .pa-a{display:flex;flex-direction:column;gap:6px;align-items:flex-end}.pa-card .pa-t{font-weight:800;white-space:nowrap}.pa-new{display:inline-block;background:#dc2626;color:#fff;font-size:12px;font-weight:700;border-radius:99px;padding:2px 9px;animation:paPulse 1.6s infinite}@keyframes paPulse{50%{opacity:.55}}'
      + '.tag.wait{background:#fff7ed;color:#c2410c}.pa-set{margin-bottom:14px}.pa-step{border-top:1px solid var(--line);padding:12px 0}.pa-step:first-of-type{border-top:0}.pa-step h5{margin:0 0 6px;font-size:14px}.pa-ok{color:#15803d;font-weight:700}.pa-no{color:#b91c1c;font-weight:700}'
      + '.pa-cmd{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}.pa-cmd code{font-size:15px;max-width:100%;overflow-wrap:anywhere;word-break:break-all;background:#f1f5f9;border:1px dashed #94a3b8;border-radius:8px;padding:6px 10px;user-select:all}'
      + '.pa-sigs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.pa-sig{border:1px solid var(--line);border-radius:12px;padding:10px}.pa-sig .im{height:80px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#f1f5f9 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:8px;margin:6px 0}.pa-sig .im img{max-height:76px;max-width:100%}'
      + '.pa-banner{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:2px solid #dc2626;background:#fef2f2;border-radius:14px;padding:10px 14px;margin-bottom:12px}.pa-banner b{color:#b91c1c}'
      + '.pai-pick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.pai-big{display:flex;flex-direction:column;align-items:center;gap:4px;padding:18px 10px;border:2px solid var(--c,#d97706);border-radius:16px;background:#fff;cursor:pointer;font:inherit;color:#0f172a}.pai-big span{font-size:30px}.pai-big b{font-size:16px}.pai-big small{color:var(--muted);font-size:12px;text-align:center}.pai-big:hover,.pai-big:focus-visible{background:#fff7ed}'
      + '.pai-doc{border:1px solid var(--line);border-radius:14px;padding:10px;margin-bottom:10px;background:#fafafa}.pai-dh{font-weight:800;margin-bottom:8px}.pai-pages{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px}.pai-pg{margin:0;flex:0 0 150px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px}.pai-pg img{width:100%;height:190px;object-fit:contain;background:#f1f5f9;border-radius:6px}.pai-pg figcaption{display:flex;flex-direction:column;gap:4px;font-size:12px;margin-top:4px;overflow-wrap:anywhere}.pai-pg label{display:flex;gap:6px;align-items:center;font-size:13px;font-weight:700;cursor:pointer}'
      + '.pai-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:14px;align-items:start}.pai-imgs{display:flex;flex-direction:column;gap:6px;position:sticky;top:0}.pai-imgs img{width:100%;border:1px solid var(--line);border-radius:8px;background:#fff}.pai-items{min-width:0;width:100%;table-layout:fixed}.pai-items th:nth-child(1){width:26px}.pai-items th:nth-child(3),.pai-items th:nth-child(4){width:84px}.pai-items th:nth-child(5){width:86px}.pai-items th:nth-child(6){width:34px}.pai-items input{width:100%;min-width:0;text-align:left;padding:8px}.pai-items td{padding:4px;vertical-align:middle}.pai-items td.r{text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.pai-sumrow{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:8px 0}'
      + '@media (max-width:560px){.pai-items thead,.pai-items td:first-child{display:none}.pai-items tr{display:grid;grid-template-columns:1fr 1fr 1fr 34px;gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}.pai-items td{display:block;padding:0;border:0}.pai-items td:nth-child(2){grid-column:1/-1}.pai-phint{display:block}}.pai-phint{display:none}'
      + '@media (max-width:760px){.pai-wrap{grid-template-columns:1fr}.pai-imgs{position:static;flex-direction:row;overflow-x:auto}.pai-imgs img{width:140px}}'
      + '@media (max-width:560px){.pa-card{flex-direction:column}.pa-card .pa-a{flex-direction:row;flex-wrap:wrap;align-items:center;width:100%}.pai-pick{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }

  // ---------- โหลดรายการ + เช็คอนุมัติใหม่ทุก 1 นาที ----------
  A.refresh = function (quiet) {
    return call('purPoList', state.token).then(function (r) {
      if (!r || !r.ok) return;
      var before = {}; (A.list || []).forEach(function (x) { before[x.id] = x.status; });
      var had = !!A.list;
      A.list = r.list;
      if (P() && P().data) P().data.poApprovals = r.list;
      var fresh = r.list.filter(function (x) { return had && before[x.id] === 'pending' && x.status !== 'pending'; });
      if (fresh.length && !quiet) toast(fresh.map(function (x) { return 'PO ' + x.docNo + (x.status === 'approved' ? ' อนุมัติแล้ว' : ' ไม่อนุมัติ'); }).join(' · '));
      if (state.dept && state.dept.key === 'PUR') { try { renderNav(); } catch (e) {} if (fresh.length && /^p_(poa|dash)$/.test(state.page) && !document.querySelector('#modalOverlay:not(.hidden)')) P().render(state.page); }
    }).catch(function () {});
  };
  var timer = null;
  A.startPoll = function () {
    if (timer || !A.lineOn) return;
    timer = setInterval(function () { if (document.hidden || !state.token || !state.dept || state.dept.key !== 'PUR') return; A.refresh(); }, 60000);
  };

  // ---------- หน้า "เอกสาร PO (อนุมัติแล้ว)" (ผู้ใช้ขอ 26/11/69) ----------
  A.page = function () {
    css();
    var q = P().q, docs = (P().data.docs || []).filter(function (d) { return d.type === 'PO' && d.status !== 'cancelled'; })
      .sort(function (a, b) { return String(b.orderDate).localeCompare(String(a.orderDate)) || String(b.docNo).localeCompare(String(a.docNo)); });
    $('main').innerHTML = '<h3>เอกสาร PO (อนุมัติแล้ว)</h3>'
      + '<div class="pa-up"><button class="btn btn-primary" id="paImp">' + icon('upload', 18) + 'อัปโหลด PO ที่อนุมัติแล้ว (PDF / ถ่ายรูป)</button><small class="muted">ถ่ายรูป หรือเลือก PDF / รูปได้หลายไฟล์ — ระบบแยกเป็นใบ ๆ ตามเลขที่ PO อ่านผู้ขาย วันที่ รายการ ยอดเงิน แล้วให้ตรวจทีละใบก่อนบันทึก</small></div>'
      + '<div class="pform" style="margin-bottom:10px"><div class="pf full"><label for="paQ">ค้นหาเลขที่ PO / ผู้ขาย / สินค้า</label><input id="paQ" type="search" value="' + esc(q.paQ || '') + '" placeholder="เช่น PO-2026 หรือชื่อผู้ขาย"></div></div>'
      + '<div id="paList"></div>';
    var draw = function () {
      var t = String(q.paQ || '').trim().toLowerCase();
      var list = docs.filter(function (d) { return !t || (d.docNo + ' ' + d.vendorName + ' ' + (d.items || []).map(function (i) { return i.materialName; }).join(' ')).toLowerCase().indexOf(t) >= 0; });
      $('paList').innerHTML = '<div class="muted" style="margin-bottom:8px">' + (t ? 'พบ ' + list.length + ' จาก ' : 'ทั้งหมด ') + docs.length + ' ใบ</div>'
        + (list.map(poCard).join('') || '<div class="panel muted">' + (docs.length ? 'ไม่พบ PO ที่ค้นหา' : 'ยังไม่มีเอกสาร PO — กด "อัปโหลด PO ที่อนุมัติแล้ว (PDF / ถ่ายรูป)" ด้านบนเพื่อเริ่ม') + '</div>');
    };
    draw();
    $('paQ').addEventListener('input', function () { q.paQ = this.value; draw(); });
    $('paImp').addEventListener('click', A.importPdf);
    $('paList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-po]'); if (!b) return;
      var d = P().idx.doc[b.getAttribute('data-po')]; if (!d) return;
      if (b.getAttribute('data-act') === 'del') {
        ask({ title: 'ลบ ' + d.docNo + ' ออกจากระบบ?', text: (d.vendorName ? d.vendorName + ' · ' : '') + 'ข้อมูลใบ PO รายการสินค้า และไฟล์ที่แนบจะถูกลบ · ลบแล้วกู้คืนไม่ได้', ok: 'ลบ PO นี้', tone: 'danger' }).then(function (ok) {
          if (!ok) return; b.disabled = true;
          call('purDeleteDoc', state.token, d.id).then(function (x) {
            if (!x.ok) { b.disabled = false; return toast(x.error); }
            toast('ลบ ' + d.docNo + ' แล้ว'); P().load().then(function () { A.page(); });
          }).catch(onServerError);
        });
      } else P().openDoc(d);
    });
  };
  function poCard(d) {
    var items = d.items || [], total = items.reduce(function (s, i) { return s + (Number(i.qty) || 0) * (Number(i.price) || 0); }, 0);
    var pdf = (d.files || []).filter(isPdf)[0];
    var names = items.slice(0, 3).map(function (i) { return esc(i.materialName); }).join(', ') + (items.length > 3 ? ' และอีก ' + (items.length - 3) + ' รายการ' : '');
    return '<div class="pa-card"><div class="pa-i"><b>' + esc(d.docNo) + ' · ' + esc(d.vendorName || '-') + '</b>'
      + '<small>วันที่สั่ง ' + th(d.orderDate) + (d.dueDate ? ' · 💰 ครบกำหนดชำระ ' + th(d.dueDate) : '') + (d.deliveryDate ? ' · ส่งของ ' + th(d.deliveryDate) : '') + '<br>' + items.length + ' รายการ: ' + (names || '-') + '</small></div>'
      + '<div class="pa-a"><span class="pa-t">' + money(total) + ' <small class="muted">(ก่อน VAT)</small></span>'
      + (pdf ? '<a class="btn btn-sm btn-line" href="' + esc(pdf.url) + '" target="_blank" rel="noopener">' + icon('doc', 16) + 'เปิดไฟล์ PO</a>' : '<small class="pa-no">ยังไม่มีไฟล์</small>')
      + '<button class="link-btn" data-po="' + d.id + '" data-act="open">ดูรายละเอียด / แก้ไข</button><button class="link-btn danger" data-po="' + d.id + '" data-act="del">' + icon('trash', 14) + 'ลบ</button></div></div>';
  }
  // หน้าเดิม (ขออนุมัติทาง LINE) — เก็บไว้ ไม่ได้ใช้แล้ว
  A.pageLine = function () {
    css(); A.startPoll();
    if (!A.list) A.list = (P().data && P().data.poApprovals) || [];
    var f = P().q.paF || (newCount() ? 'new' : '');
    var count = function (k) { return A.list.filter(function (r) { return k === 'new' ? r.status === 'approved' && !r.seenAt : !k || r.status === k; }).length; };
    var chips = [['', 'ทั้งหมด'], ['new', '🔴 อนุมัติใหม่ · ยังไม่เปิดดู'], ['pending', '⏳ รออนุมัติ'], ['approved', '✓ อนุมัติแล้ว'], ['rejected', '✕ ไม่อนุมัติ']];
    $('main').innerHTML = '<h3>ขออนุมัติ PO (LINE)</h3>'
      + '<details class="panel pa-set" id="paSet"><summary><b>' + icon('line', 18) + ' ตั้งค่า LINE / ผู้อนุมัติ / ลายเซ็น</b> <small class="muted" id="paSetSum">กำลังตรวจ…</small></summary><div id="paSetBody"><span class="spinner dark"></span></div></details>'
      + '<div class="pbar" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-primary" id="paImp">' + icon('upload', 18) + 'แนบไฟล์ PO (PDF จาก PEAK)</button><button class="btn btn-line" id="paNew">' + icon('doc', 18) + 'เลือกใบ PO ที่มีในระบบ</button><button class="btn btn-line" id="paRe">↻ ตรวจสถานะล่าสุด</button></div>'
      + '<div class="pchips">' + chips.map(function (c) { var n = count(c[0]); return '<button class="chip' + (f === c[0] ? ' on' : '') + '" data-pf="' + c[0] + '">' + c[1] + (c[0] ? ' (' + n + ')' : '') + '</button>'; }).join('') + '</div>'
      + '<div id="paList"></div>';
    var list = A.list.filter(function (r) { return f === 'new' ? r.status === 'approved' && !r.seenAt : f ? r.status === f : r.status !== 'replaced'; });
    $('paList').innerHTML = list.map(cardHtml).join('') || '<div class="panel muted">' + (f === 'new' ? 'ไม่มี PO ที่อนุมัติใหม่ค้างเปิดดู' : 'ยังไม่มีรายการ — กด "แนบไฟล์ PO (PDF จาก PEAK)" ด้านบนเพื่อเริ่ม') + '</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-pf]'), function (b) { b.addEventListener('click', function () { P().q.paF = b.getAttribute('data-pf'); A.page(); }); });
    $('paNew').addEventListener('click', pickDoc);
    $('paImp').addEventListener('click', A.importPdf);
    $('paRe').addEventListener('click', function () { var b = this; b.disabled = true; A.refresh(true).then(function () { A.page(); toast('อัปเดตสถานะแล้ว'); }); });
    $('paList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pa]'); if (!b) return;
      var r = A.list.filter(function (x) { return x.id === b.getAttribute('data-pa'); })[0]; if (!r) return;
      var act = b.getAttribute('data-act');
      if (act === 'open') openApproved(r);
      else if (act === 'resend') { var d = P().idx.doc[r.docId]; if (!d) return toast('ไม่พบใบ PO นี้ในระบบแล้ว'); A.openSign(d); }
      else if (act === 'doc') { var d2 = P().idx.doc[r.docId]; if (d2) P().openDoc(d2); else toast('ใบ PO นี้ถูกลบไปแล้ว'); }
      else if (act === 'del') {
        ask({ title: 'ลบ ' + r.docNo + ' ออกจากระบบ?', text: (r.vendorName ? r.vendorName + ' · ' : '') + 'ใบ PO รายการสินค้า ไฟล์ที่แนบ และคำขออนุมัติทั้งหมดของใบนี้จะถูกลบ · การ์ดใน LINE ที่ส่งไปแล้วจะกดอนุมัติไม่ได้ · ลบแล้วกู้คืนไม่ได้', ok: 'ลบ PO นี้', tone: 'danger' }).then(function (ok) {
          if (!ok) return; b.disabled = true;
          call('purPoDelete', state.token, r.id).then(function (x) {
            if (!x.ok) { b.disabled = false; return toast(x.error); }
            toast('ลบ ' + r.docNo + ' แล้ว');
            P().load().then(function () { A.list = P().data.poApprovals; A.page(); try { renderNav(); } catch (e) {} });
          }).catch(onServerError);
        });
      }
    });
    loadInfo();
  };
  function cardHtml(r) {
    var st = ST[r.status] || ['', r.status], isNew = r.status === 'approved' && !r.seenAt;
    var sub = 'ส่งขออนุมัติ ' + thT(r.sentAt) + (r.sentBy ? ' · ผู้ออกเอกสาร ' + esc(r.sentBy) : '') + (r.attach ? '<br>📎 แนบท้าย: ' + esc(r.attach) : '');
    if (r.status === 'approved' || r.status === 'rejected') sub += '<br>' + (r.status === 'approved' ? 'อนุมัติโดย ' : 'ไม่อนุมัติโดย ') + esc(r.decidedBy || '-') + ' · ' + thT(r.decidedAt);
    var dd0 = (P().idx && P().idx.doc[r.docId]) || {};
    if (dd0.dueDate) sub += '<br>💰 ครบกำหนดชำระ ' + th(dd0.dueDate);
    if (r.confirmedAt) sub += '<br><span class="pa-ok">✓ ยืนยันวันที่จัดส่ง ' + th(r.deliveryDate) + '</span>';
    else if (r.status === 'approved') sub += '<br><span class="pa-no">ยังไม่ยืนยันวันที่จัดส่ง</span>';
    var btns = r.status === 'approved' ? '<button class="btn btn-sm ' + (isNew || !r.confirmedAt ? 'btn-primary' : 'btn-line') + '" data-pa="' + r.id + '" data-act="open">' + (isNew ? 'เปิดดู PO & ยืนยันวันส่ง' : r.confirmedAt ? 'เปิด PO ที่อนุมัติ' : 'ยืนยันวันที่จัดส่ง') + '</button>'
      : r.status === 'pending' ? '<a class="btn btn-sm btn-line" href="' + esc(r.pdf1) + '" target="_blank" rel="noopener">ดูไฟล์ที่ส่ง</a>'
      : r.status === 'rejected' ? '<button class="btn btn-sm btn-line" data-pa="' + r.id + '" data-act="resend">แก้ไขแล้วส่งใหม่</button>' : '';
    return '<div class="pa-card' + (isNew ? ' new' : '') + '"><div class="pa-i">' + (isNew ? '<span class="pa-new">🔴 อนุมัติใหม่ · ยังไม่เปิดดู</span>' : '')
      + '<b>' + esc(r.docNo) + ' · ' + esc(r.vendorName || '-') + '</b><small>' + sub + '</small><div style="margin-top:6px"><span class="tag ' + st[0] + '">' + st[1] + '</span></div></div>'
      + '<div class="pa-a"><span class="pa-t">' + money(r.total) + '</span>' + btns + '<button class="link-btn" data-pa="' + r.id + '" data-act="doc">เปิดใบ PO</button><button class="link-btn danger" data-pa="' + r.id + '" data-act="del">' + icon('trash', 14) + 'ลบ</button></div></div>';
  }
  // เปิดไฟล์ที่อนุมัติแล้ว = นับว่าเปิดดู → ยืนยันวันที่จัดส่งอีกครั้ง
  function openApproved(r) {
    var d = P().idx.doc[r.docId] || {};
    var w = window.open(r.pdf2, '_blank', 'noopener');
    if (!r.seenAt) call('purPoSeen', state.token, r.id).then(function (x) { if (x && x.ok) { r.seenAt = x.item.seenAt; try { renderNav(); } catch (e) {} } }).catch(function () {});
    openModal({ wide: true, color: state.dept.color, icon: 'doc', title: 'ยืนยันวันที่จัดส่ง · ' + r.docNo, sub: (r.vendorName || '') + ' · อนุมัติโดย ' + (r.decidedBy || '-'),
      body: '<div class="pas-hint">' + (w ? 'เปิดไฟล์ PO ที่อนุมัติแล้วในแท็บใหม่' : 'กดปุ่มด้านล่างเพื่อเปิดไฟล์ PO ที่อนุมัติแล้ว') + ' — ตรวจแล้วระบุวันที่ผู้ขายจะส่งของอีกครั้ง (ระบบจะแก้วันที่ส่งของในใบ PO ให้)</div>'
        + '<p><a class="btn btn-line" href="' + esc(r.pdf2) + '" target="_blank" rel="noopener">' + icon('doc', 16) + 'เปิด PO ที่อนุมัติแล้ว (PDF)</a></p>'
        + '<div class="pform"><div class="pf hl"><label for="paDate">วันที่จัดส่ง (ยืนยันหลังอนุมัติ) *</label><input id="paDate" type="date" value="' + esc(r.deliveryDate || d.deliveryDate || '') + '"></div>'
        + '<div class="pf"><label>กำหนดส่งเดิมในใบ PO</label><input type="text" value="' + esc(th(d.deliveryDate)) + '" disabled></div>'
        + '<div class="pf full"><label for="paNote">หมายเหตุ (ถ้ามี)</label><input id="paNote" type="text" value="' + esc(r.note || '') + '" placeholder="เช่น ผู้ขายยืนยันทางโทรศัพท์"></div></div>',
      ok: 'ยืนยันวันที่จัดส่ง',
      check: function () { return !$('paDate').value ? 'เลือกวันที่จัดส่ง' : $('paDate').value < todayIso() ? '' : ''; },
      submit: function () {
        return call('purPoConfirm', state.token, r.id, $('paDate').value, $('paNote').value.trim()).then(function (x) {
          if (!x.ok) return x.error;
          closeModal(); toast('ยืนยันวันที่จัดส่ง ' + th($('paDate') ? $('paDate').value : x.item.deliveryDate) + ' แล้ว');
          P().load().then(function () { A.list = P().data.poApprovals; P().render(state.page); });
        });
      } });
  }

  // ---------- ตั้งค่า ----------
  function loadInfo() {
    call('purPoInfo', state.token).then(function (i) { A.info = i; drawInfo(); }).catch(function () { if ($('paSetBody')) $('paSetBody').innerHTML = '<div class="err">โหลดการตั้งค่าไม่ได้</div>'; });
  }
  function ready(i) { return i && i.tokenOk && i.group && i.approvers.length && i.sigs.buyer.has && i.sigs.ceo.has; }
  function drawInfo() {
    var i = A.info, box = $('paSetBody'); if (!box || !i) return;
    var ok = function (b) { return b ? '<span class="pa-ok">✓</span>' : '<span class="pa-no">✕</span>'; };
    $('paSetSum').innerHTML = ready(i) ? '<span class="pa-ok">✓ พร้อมใช้งาน</span>' : '<span class="pa-no">ยังตั้งค่าไม่ครบ — แตะเพื่อตั้งค่า</span>';
    if (!ready(i)) $('paSet').open = true;
    box.innerHTML = '<div class="pa-step"><h5>' + ok(i.tokenOk) + ' 1. บอท LINE ของฝ่ายจัดซื้อ</h5>'
      + (i.tokenOk ? '<div>ใช้บอท <b>' + esc(i.botName) + '</b></div>' : i.hasToken ? '<div class="pa-no">Token เดิมใช้ไม่ได้แล้ว — ใส่ใหม่</div>' : '<div class="muted">วาง Channel access token (long-lived) จาก LINE Developers</div>')
      + '<div class="pform"><div class="pf full"><label for="paTok">Channel access token</label><input id="paTok" type="password" autocomplete="off" placeholder="' + (i.tokenOk ? 'ใส่เฉพาะเมื่อต้องการเปลี่ยนบอท' : 'วาง Token ที่นี่') + '"></div></div>'
      + '<button class="btn btn-sm btn-primary" id="paTokSave">บันทึก Token</button>'
      + '<div class="muted" style="margin-top:8px">ใน LINE Developers → Messaging API → Webhook URL ใส่ลิงก์นี้ แล้วเปิด "Use webhook":</div><div class="pa-cmd"><code id="paHook">' + esc(i.webhookUrl) + '</code><button class="btn btn-sm btn-line" data-copy="paHook">คัดลอก</button></div></div>'
      + '<div class="pa-step"><h5>' + ok(i.group) + ' 2. กลุ่ม LINE ที่ส่งขออนุมัติ</h5>'
      + (i.group ? '<div class="pa-cmd" style="margin-bottom:8px"><span>ส่งเข้ากลุ่ม <b>' + esc(i.groupName || '(อ่านชื่อกลุ่มไม่ได้)') + '</b></span><button class="btn btn-sm btn-line" id="paTest">ส่งข้อความทดสอบ</button><button class="btn btn-sm btn-primary" id="paGrpChg">เปลี่ยนกลุ่ม</button></div>' : '')
      + '<div id="paGrpBox"' + (i.group ? ' hidden' : '') + '>' + grpBox(i) + '</div></div>'
      + '<div class="pa-step"><h5>' + ok(i.approvers.length) + ' 3. ผู้มีสิทธิ์กดอนุมัติใน LINE</h5>'
      + (i.approvers.length ? i.approvers.map(function (a) { return '<div class="pa-cmd" style="margin-bottom:6px"><b>' + esc(a.name) + '</b><small class="muted">เพิ่มเมื่อ ' + thT(a.addedAt) + '</small><button class="link-btn danger" data-rmap="' + esc(a.userId) + '">ลบสิทธิ์</button></div>'; }).join('') : '<div class="muted">ยังไม่มี — คนที่ไม่ได้อยู่ในรายชื่อนี้กดอนุมัติไม่ได้</div>')
      + '<div id="paApCode">' + (i.apprCode ? apCodeHtml(i.apprCode) : '') + '</div><button class="btn btn-sm btn-line" id="paApAdd">+ เพิ่มผู้อนุมัติ (เช่น พี่เก้)</button></div>'
      + '<div class="pa-step"><h5>' + ok(i.sigs.buyer.has && i.sigs.ceo.has) + ' 4. ลายเซ็น</h5><div class="pa-sigs">' + sigBox('buyer', i.sigs.buyer) + sigBox('ceo', i.sigs.ceo) + '</div></div>';
    bindInfo();
    if (i.sigs.buyer.has || i.sigs.ceo.has) getSigs().then(function (s) { ['buyer', 'ceo'].forEach(function (r) { var el = $('paSigIm_' + r); if (el && s[r]) el.innerHTML = '<img src="' + s[r].data + '" alt="' + esc(s[r].label) + '">'; }); });
  }
  // เปลี่ยนกลุ่ม: เลือกจากกลุ่มที่บอทอยู่ (ไม่ต้องพิมพ์) หรือพิมพ์คำสั่งในกลุ่มใหม่ (ผู้ใช้ขอ 24/11/69)
  function grpBox(i) {
    var others = (i.seen || []).filter(function (g) { return !g.current; });
    return '<div class="pas-hint"><b>วิธีที่ 1 · เลือกกลุ่มที่บอทอยู่แล้ว</b>'
      + (others.length ? others.map(function (g) { return '<div class="pa-cmd" style="margin-top:6px"><span>' + esc(g.name) + ' <small class="muted">· เห็นล่าสุด ' + thT(g.at) + '</small></span><button class="btn btn-sm btn-primary" data-ug="' + esc(g.id) + '" data-un="' + esc(g.name) + '">ใช้กลุ่มนี้</button></div>'; }).join('')
        : '<div class="muted" style="margin-top:4px">ยังไม่พบกลุ่มอื่น — เชิญบอทเข้ากลุ่มใหม่ แล้วพิมพ์ข้อความอะไรก็ได้ในกลุ่ม 1 ครั้ง จากนั้นกด "ตรวจสอบ"</div>') + '</div>'
      + '<div class="pas-hint"><b>วิธีที่ 2 · พิมพ์คำสั่งนี้ในกลุ่มใหม่</b> (ใช้ได้ครั้งเดียว)<div class="pa-cmd" style="margin-top:6px"><code id="paBind">' + esc(i.bindCmd) + '</code><button class="btn btn-sm btn-line" data-copy="paBind">คัดลอก</button></div></div>'
      + '<div class="pa-cmd"><button class="btn btn-sm btn-line" id="paChk">ตรวจสอบ</button>' + (i.group ? '<button class="btn btn-sm btn-line" id="paGrpCancel">ไม่เปลี่ยน</button>' : '') + '</div>';
  }
  function apCodeHtml(c) { return '<div class="pas-hint">ให้ผู้อนุมัติพิมพ์คำสั่งนี้ในกลุ่มที่ผูกไว้ ภายใน <b id="paLeft">' + Math.ceil(c.left / 60) + ' นาที</b>:<div class="pa-cmd" style="margin-top:6px"><code id="paApCmd">' + esc(c.cmd) + '</code><button class="btn btn-sm btn-line" data-copy="paApCmd">คัดลอก</button></div></div>'; }
  function sigBox(role, s) {
    return '<div class="pa-sig"><b>' + ROLE[role] + '</b> <small class="muted">ชื่อไฟล์: ' + esc(s.label) + '</small><div class="im" id="paSigIm_' + role + '">' + (s.has ? '<span class="spinner dark"></span>' : '<span class="muted">ยังไม่มีลายเซ็น</span>') + '</div>'
      + '<label class="btn btn-sm ' + (s.has ? 'btn-line' : 'btn-primary') + '">' + icon('upload', 15) + (s.has ? 'เปลี่ยนรูปลายเซ็น' : 'อัปโหลดรูปลายเซ็น') + '<input type="file" accept="image/*" data-sig="' + role + '" hidden></label></div>';
  }
  function bindInfo() {
    var box = $('paSetBody');
    Array.prototype.forEach.call(box.querySelectorAll('[data-copy]'), function (b) {
      b.addEventListener('click', function () { var t = $(b.getAttribute('data-copy')).textContent; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('คัดลอกแล้ว'); }, function () { toast('กดค้างที่ข้อความเพื่อคัดลอก'); }); });
    });
    $('paTokSave').addEventListener('click', function () {
      var b = this, t = $('paTok').value.trim(); if (!t) return toast('วาง Token ก่อน');
      b.disabled = true; b.innerHTML = '<span class="spinner"></span>กำลังตรวจ';
      call('purPoSetToken', state.token, t).then(function (r) { if (!r.ok) { toast(r.error); b.disabled = false; b.textContent = 'บันทึก Token'; return; } toast('ใช้บอท ' + r.botName + ' แล้ว'); loadInfo(); }).catch(onServerError);
    });
    $('paChk').addEventListener('click', function () { this.disabled = true; this.innerHTML = '<span class="spinner dark"></span>กำลังตรวจ'; P().q.paGrpOpen = true; loadInfo(); });
    if ($('paGrpChg')) $('paGrpChg').addEventListener('click', function () { $('paGrpBox').hidden = false; this.style.display = 'none'; P().q.paGrpOpen = true; });
    if ($('paGrpCancel')) $('paGrpCancel').addEventListener('click', function () { $('paGrpBox').hidden = true; if ($('paGrpChg')) $('paGrpChg').style.display = ''; P().q.paGrpOpen = false; });
    if (P().q.paGrpOpen && $('paGrpChg')) { $('paGrpBox').hidden = false; $('paGrpChg').style.display = 'none'; }
    Array.prototype.forEach.call(box.querySelectorAll('[data-ug]'), function (b) {
      b.addEventListener('click', function () {
        var nm = b.getAttribute('data-un');
        ask({ title: 'ส่งขออนุมัติ PO เข้ากลุ่ม "' + nm + '"?', text: 'ใบขออนุมัติใหม่จะส่งเข้ากลุ่มนี้แทนกลุ่มเดิม · การ์ดที่ส่งไปแล้วในกลุ่มเดิมยังกดอนุมัติได้', ok: 'เปลี่ยนกลุ่ม' }).then(function (ok) {
          if (!ok) return; b.disabled = true;
          call('purPoUseGroup', state.token, b.getAttribute('data-ug')).then(function (r) { if (!r.ok) { b.disabled = false; return toast(r.error); } P().q.paGrpOpen = false; toast('เปลี่ยนเป็นกลุ่ม ' + r.groupName + ' แล้ว'); loadInfo(); }).catch(onServerError);
        });
      });
    });
    if ($('paTest')) $('paTest').addEventListener('click', function () { var b = this; b.disabled = true; call('purPoTest', state.token).then(function (r) { b.disabled = false; toast(r.ok ? 'ส่งข้อความทดสอบแล้ว — ดูในกลุ่ม LINE' : r.error); }).catch(onServerError); });
    $('paApAdd').addEventListener('click', function () { var b = this; b.disabled = true; call('purPoApproverCode', state.token).then(function (r) { b.disabled = false; $('paApCode').innerHTML = apCodeHtml(r); bindInfo2(); }).catch(onServerError); });
    Array.prototype.forEach.call(box.querySelectorAll('[data-rmap]'), function (b) {
      b.addEventListener('click', function () {
        ask({ title: 'ลบสิทธิ์อนุมัติ?', text: 'คนนี้จะกดอนุมัติ PO ใน LINE ไม่ได้อีก', ok: 'ลบสิทธิ์', tone: 'danger' }).then(function (ok) { if (!ok) return; call('purPoRemoveApprover', state.token, b.getAttribute('data-rmap')).then(function () { toast('ลบสิทธิ์แล้ว'); loadInfo(); }).catch(onServerError); });
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-sig]'), function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0], role = inp.getAttribute('data-sig'); inp.value = ''; if (!f) return;
        cleanSig(f).then(function (png) {
          if (!png) return toast('อ่านรูปไม่ได้ หรือรูปไม่มีลายเซ็น');
          var label = role === 'buyer' ? 'ลายเซ็นเนย' : 'ลายเซ็นพี่เก้';
          openModal({ color: state.dept.color, icon: 'edit', title: 'ใช้รูปนี้เป็นลายเซ็น' + ROLE[role] + '?', body: '<div class="pa-sig"><div class="im" style="height:140px"><img src="data:image/png;base64,' + png + '" style="max-height:130px" alt="ลายเซ็น"></div><small class="muted">ระบบตัดพื้นขาวออกให้แล้ว (พื้นลายตาราง = โปร่งใส)</small></div>'
            + '<div class="pform"><div class="pf full"><label for="paSigName">ชื่อไฟล์</label><input id="paSigName" value="' + esc((A.info.sigs[role] || {}).label || label) + '"></div></div>', ok: 'บันทึกลายเซ็น',
            onCancel: function () {},
            submit: function () { return call('purPoSaveSig', state.token, role, png, $('paSigName').value.trim()).then(function (r) { if (!r.ok) return r.error; closeModal(); A.sigs = null; toast('บันทึกลายเซ็นแล้ว'); loadInfo(); }); } });
        });
      });
    });
    bindInfo2();
  }
  function bindInfo2() {
    var el = $('paApCode'); if (!el || !el.querySelector('code')) return;
    Array.prototype.forEach.call(el.querySelectorAll('[data-copy]'), function (b) { b.onclick = function () { var t = $(b.getAttribute('data-copy')).textContent; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('คัดลอกแล้ว'); }); }; });
  }
  // รูปลายเซ็น → พื้นขาวโปร่งใส + ตัดขอบ (PNG base64)
  function cleanSig(file) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1200 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
        var d = g.getImageData(0, 0, w, h), p = d.data, x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4, lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2], a = Math.max(0, Math.min(255, (225 - lum) * 255 / 110));
          p[i + 3] = Math.round(a * p[i + 3] / 255);
          if (p[i + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        URL.revokeObjectURL(url);
        if (x1 < 0) return res('');
        g.putImageData(d, 0, 0);
        var pd = 6; x0 = Math.max(0, x0 - pd); y0 = Math.max(0, y0 - pd); x1 = Math.min(w - 1, x1 + pd); y1 = Math.min(h - 1, y1 + pd);
        var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
        res(o.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(''); };
      img.src = url;
    });
  }
  function getSigs() {
    if (A.sigs) return Promise.resolve(A.sigs);
    return call('purPoSigs', state.token).then(function (r) { A.sigs = (r && r.sigs) || {}; return A.sigs; });
  }

  // ---------- แนบ PDF ใบสั่งซื้อจาก PEAK → อ่านข้อมูลลงใบ PO ให้เอง (ผู้ใช้ขอ 24/11/69: "แนบเลยไม่ต้องกรอกอะไร") ----------
  // ฟอนต์ไทยใน PDF ของ PEAK ใช้รหัสพิเศษ U+F7xx แทนวรรณยุกต์ / สระบางตัว → แปลงกลับเป็นตัวอักษรไทยปกติ
  var PUA = { 0xF700: 'ฐ', 0xF701: '่', 0xF702: '้', 0xF703: '๊', 0xF704: '๋', 0xF705: '่', 0xF706: '้', 0xF707: '๊', 0xF708: '๋', 0xF709: '์', 0xF70A: '่', 0xF70B: '้', 0xF70C: '๊', 0xF70D: '๋', 0xF70E: '์', 0xF70F: 'ญ', 0xF710: 'ั', 0xF711: 'ํ', 0xF712: '็', 0xF713: '่', 0xF714: '้', 0xF715: '๊', 0xF716: '๋', 0xF717: '์', 0xF718: 'ุ', 0xF719: 'ู', 0xF71A: 'ฺ' };
  function thFix(t) { return String(t || '').replace(/[\uF700-\uF71A]/g, function (c) { return PUA[c.charCodeAt(0)]; }).replace(/[\uE000-\uF8FF]/g, ' ').replace(/\u0e4d([\u0e48-\u0e4b]?)\u0e32/g, '$1\u0e33'); }
  // ช่องว่างก่อนสระบน / ล่าง / วรรณยุกต์ = ตัวแยกผิด · วรรณยุกต์ก่อนสระล่าง (ผู้) → สลับเป็นลำดับปกติ (ผู้)
  function thNorm(t) { return String(t || '').replace(/[ \t]+(?=[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e])/g, '').replace(/\u0e4d([\u0e48-\u0e4b]?)\u0e32/g, '$1\u0e33').replace(/([\u0e48-\u0e4c])([\u0e38-\u0e3a])/g, '$2$1'); }
  function pdfRows(pdf) {
    var out = [], pages = []; for (var i = 1; i <= pdf.numPages; i++) pages.push(i);
    return pages.reduce(function (p, n) {
      return p.then(function () {
        return pdf.getPage(n).then(function (pg) {
          var vp = pg.getViewport({ scale: 1 });
          return pg.getTextContent().then(function (tc) {
            var rows = [];
            tc.items.map(function (t) { var m = window.pdfjsLib.Util.transform(vp.transform, t.transform); return { x: m[4], y: m[5], w: t.width, s: thFix(t.str) }; }).filter(function (t) { return t.s; })
              .sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (t) {
                var r = rows.filter(function (r) { return Math.abs(r.y - t.y) <= 2.5; })[0]; if (!r) rows.push(r = { y: t.y, it: [] }); r.it.push(t);
              });
            rows.sort(function (a, b) { return a.y - b.y; }).forEach(function (r) {
              r.it.sort(function (a, b) { return a.x - b.x; });
              var s = '', end = -1;
              r.it.forEach(function (t) { if (!t.s.trim()) { end = -1e9; return; } if (s && (end < 0 || t.x - end > 2.5)) s += '  '; s += t.s; end = t.x + t.w; });
              out.push({ page: n, y: r.y, x: r.it[0].x, s: thNorm(s).trim() });
            });
          });
        });
      });
    }, Promise.resolve()).then(function () { return out; });
  }
  function num(v) { var n = parseFloat(String(v || '').replace(/,/g, '')); return isFinite(n) ? n : ''; }
  function isoOf(t) {
    var m = String(t || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return '';
    var y = +m[3]; if (y > 2400) y -= 543;
    return y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
  }
  function oneSp(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  // ใบสั่งซื้อของ PEAK: เลขที่เอกสาร / วันที่ออก / ผู้ขาย + เลขที่ภาษี + ที่อยู่ / รายการ "1. ชื่อ (รหัส) จำนวน ราคา ส่วนลด VAT มูลค่า" / สรุปยอด
  A.parsePo = function (rows) {
    var o = { items: [] }, val = function (r) { return oneSp(r.s.replace(/^[^:]*:\s*/, '')); }, vi = -1;
    rows.forEach(function (r, k) {
      var s = r.s, m;
      if (!o.docNo && /เลขที่เอกสาร/.test(s)) o.docNo = (s.match(/เลขที่เอกสาร\s*:?\s*(\S+)/) || [])[1] || '';
      if (!o.date && /วันที่ออก|วันที่เอกสาร/.test(s)) o.date = isoOf(s);
      if (!o.due && /กำหนดส่ง|วันที่ส่งของ|วันที่จัดส่ง/.test(s)) o.due = isoOf(s);
      if (!o.payDue && /ครบกำหนด|วันที่ชำระ|กำหนดชำระ/.test(s)) o.payDue = isoOf(s);
      if (o.credit == null && (m = s.match(/(?:เครดิต|Credit|ชำระภายใน)\s*:?\s*(\d{1,3})\s*(?:วัน|days?)/i))) o.credit = +m[1];
      if (vi < 0 && /^ผู้ขาย\s*:/.test(s)) {
        vi = k;
        var parts = s.replace(/^ผู้ขาย\s*:\s*/, '').split(/\s{2,}/), name = [];
        for (var i = 0; i < parts.length; i++) { if (/^-$|^[\d\s()+-]{8,}$|@|✉/.test(parts[i].trim())) break; name.push(parts[i].trim()); }
        o.vendor = oneSp(name.join(' '));
      }
      if (vi >= 0 && !o.vendorTax && k > vi && /เลขที่ภาษี|เลขประจำตัวผู้เสียภาษี/.test(s)) o.vendorTax = ((s.replace(/[\s-]/g, '').match(/\d{13}/)) || [])[0] || '';
      if (vi >= 0 && !o.vendorAddr && k > vi && /^ที่อยู่\s*:/.test(s)) {
        var ad = [s.replace(/^ที่อยู่\s*:\s*/, '')];
        for (var j = k + 1; j < rows.length && j < k + 4; j++) { if (/เลขที่ภาษี|เรียน|ผู้/.test(rows[j].s)) break; if (rows[j].x < 120) ad.push(rows[j].s); }
        o.vendorAddr = oneSp(ad.join(' ').replace(/✉\s*\S*/g, '').replace(/(^|\s)-(\s|$)/g, ' ').replace(/\s{2,}.*$/, function (x) { return x; }));
      }
      if ((m = oneSp(s).match(/^(\d{1,3})\.\s+(.+?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?%?)\s+(\d+%|-|ไม่มี|0%)?\s*([\d,]+\.\d{2})$/))) {
        var nm = m[2], code = (nm.match(/\(([A-Za-z]{0,3}\d{3,})\)\s*$/) || [])[1] || '';
        if (code) nm = nm.replace(/\s*\([A-Za-z]{0,3}\d{3,}\)\s*$/, '');
        var qty = num(m[3]), price = num(m[4]), amt = num(m[7]);
        o.items.push({ n: +m[1], name: oneSp(nm), code: code, qty: qty, price: qty && amt !== '' && Math.abs(qty * price - amt) > 0.01 ? Math.round(amt / qty * 10000) / 10000 : price, amount: amt, vat: m[6] || '' });
      }
      if (!o.sub && /มูลค่าที่คำนวณภาษี|รวมเป็นเงิน/.test(s)) { var a1 = s.match(/([\d,]+\.\d{2})\s*บาท/); if (a1) o.sub = num(a1[1]); }
      if (!o.total && /จำนวนเงินทั้งสิ้น/.test(s)) { var a2 = s.match(/จำนวนเงินทั้งสิ้น\s+([\d,]+\.\d{2})/); if (a2) o.total = num(a2[1]); }
    });
    o.sum = Math.round(o.items.reduce(function (t, x) { return t + (Number(x.amount) || 0); }, 0) * 100) / 100;
    return o;
  };
  function plusDays(iso, n) { var x = new Date(iso + 'T00:00:00'); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  // วันที่ชำระเงิน (ครบกำหนด): ในไฟล์ → เครดิตในไฟล์ → เครดิตของผู้ขายในระบบ → ใบเดิม (ผู้ใช้ขอ 24/11/69)
  function payDueOf(po, vn, old) {
    var base = po.date || todayIso(), vc = vn && vn.creditDays !== '' && vn.creditDays != null ? Number(vn.creditDays) : null;
    if (po.payDue) return { date: po.payDue, src: 'จากไฟล์ PO' };
    if (po.credit != null) return { date: plusDays(base, po.credit), src: 'เครดิต ' + po.credit + ' วัน (จากไฟล์ PO)', credit: po.credit };
    if (vc != null && !isNaN(vc)) return { date: plusDays(base, vc), src: 'เครดิตผู้ขาย ' + vc + ' วัน นับจากวันที่ออก' };
    if (old && old.dueDate) return { date: old.dueDate, src: 'จากใบเดิมในระบบ' };
    return { date: '', src: '' };
  }
  function vkey(t) { return String(t || '').replace(/\s+/g, '').replace(/^(บริษัท|บจก\.?|ห้างหุ้นส่วนจำกัด|หจก\.?)/, '').replace(/(จำกัด\(มหาชน\)|จำกัด|\(มหาชน\))$/, '').toLowerCase(); }
  function findVendor(po) {
    var vs = P().data.vendors || [], tax = po.vendorTax;
    return (tax && vs.filter(function (v) { return String(v.taxId || '').replace(/\D/g, '') === tax; })[0]) || vs.filter(function (v) { return po.vendor && vkey(v.name) === vkey(po.vendor); })[0] || null;
  }
  function findMat(it) {
    var k = vkey(it.name);
    return (P().data.materials || []).filter(function (m) { return vkey(m.name) === k || (it.code && String(m.note || '').indexOf(it.code) >= 0); })[0] || null;
  }
  // ---------- อัปโหลด PO ที่อนุมัติแล้ว: ถ่ายรูป / PDF หลายไฟล์ แยกเป็นใบ ๆ (ผู้ใช้ขอ 27/11/69) ----------
  // ทุกหน้าของทุกไฟล์ = 1 "หน้า" · แยกใบตามเลขที่เอกสาร (หน้าต่อในไฟล์เดียวกันที่ไม่มีเลขที่ = ใบเดิม) · ผู้ใช้ปรับได้ว่าหน้าไหนเริ่มใบใหม่
  // PDF ที่มีตัวหนังสือ → อ่านตรง · รูปถ่าย / PDF สแกน → OCR ไทย + อังกฤษ แล้วให้ตรวจแก้ก่อนบันทึก · ไฟล์ที่แนบ = PDF ของหน้าของใบนั้น
  var OCR_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', ocrW = null;
  function gray(cv) {
    var ctx = cv.getContext('2d'), img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) { var v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0); return cv;
  }
  function scaled(src, max) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height); return c;
  }
  function imgOf(file) { return new Promise(function (ok, no) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error('เปิดรูป ' + file.name + ' ไม่ได้')); }; im.src = u; }); }
  var TH_DIG = '๐๑๒๓๔๕๖๗๘๙';
  function ocrRows(cv, page) {
    return (window.Tesseract ? Promise.resolve() : load(OCR_URL)).then(function () {
      return ocrW || window.Tesseract.createWorker(['tha', 'eng'], 1).then(function (w) { ocrW = w; return w.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '4' }).then(function () { return w; }); });
    }).then(function (w) { var g = scaled(cv, 2200); return w.recognize(gray(g)).then(function (r) { return { r: r, w: g.width }; }); }).then(function (x) {
      var k = 595 / x.w;
      return (x.r.data.lines || []).map(function (l) {
        var s = String(l.text || '').replace(/[๐-๙]/g, function (c) { return TH_DIG.indexOf(c); }).replace(/\s+$/, '');
        return { page: page, y: l.bbox ? l.bbox.y0 * k : 0, x: l.bbox ? l.bbox.x0 * k : 0, s: thNorm(thFix(s)).replace(/(^|[\s:])[P2][O0]-(\d{6,})/g, '$1PO-$2').replace(/[ \t]{2,}/g, '  ').trim() };   // OCR อ่าน PO- เป็น P0- / 20-
      }).filter(function (r) { return r.s; });
    });
  }
  function pickFiles(camera) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
    inp.accept = camera ? 'image/*' : 'application/pdf,.pdf,image/*';
    if (camera) inp.setAttribute('capture', 'environment');
    inp.onchange = function () { if (inp.files && inp.files.length) readAll(Array.prototype.slice.call(inp.files)); };
    inp.click();
  }
  A.importPdf = function () {
    css();
    openModal({ color: state.dept.color, icon: 'doc', title: 'อัปโหลด PO ที่อนุมัติแล้ว', noOk: true, cancel: 'ปิด',
      body: '<div class="pai-pick"><button type="button" class="pai-big" id="paiCam"><span>📷</span><b>ถ่ายรูป PO</b><small>ถ่ายได้หลายรูป · 1 รูป = 1 หน้า</small></button>'
        + '<button type="button" class="pai-big" id="paiFile"><span>📄</span><b>เลือกไฟล์ PDF / รูป</b><small>เลือกได้หลายไฟล์พร้อมกัน</small></button></div>'
        + '<div class="pas-hint">ระบบแยกเป็นใบ ๆ ให้ตามเลขที่ PO (ไฟล์เดียวมีหลายใบก็ได้) แล้วให้ตรวจทีละใบก่อนบันทึก · PDF จาก PEAK อ่านได้แม่นที่สุด รูปถ่ายต้องตรวจแก้ข้อมูลด้วยตัวเอง</div>',
      onOpen: function () { $('paiCam').addEventListener('click', function () { pickFiles(true); }); $('paiFile').addEventListener('click', function () { pickFiles(false); }); } });
  };
  function waitMsg(t) { if ($('paiWait')) $('paiWait').innerHTML = t; }
  // อ่านทุกไฟล์ → หน้า (units) ตามลำดับที่เลือก
  function readAll(files) {
    openModal({ color: state.dept.color, icon: 'doc', title: 'กำลังอ่านไฟล์ PO…', noOk: true, noCancel: true, sticky: true,
      body: '<div class="panel" id="paiWait"><span class="spinner dark"></span> กำลังเตรียม…</div>' });
    var units = [], chain = libs();
    files.forEach(function (f, fi) {
      var tag = ' (ไฟล์ ' + (fi + 1) + '/' + files.length + ')';
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        chain = chain.then(function () { return readFile(f); }).then(function (bytes) {
          return window.pdfjsLib.getDocument({ data: bytes.slice(0) }).promise.then(function (pdf) {
            return pdfRows(pdf).then(function (rows) {
              var c = Promise.resolve();
              for (var p = 1; p <= pdf.numPages; p++) (function (p) {
                c = c.then(function () {
                  waitMsg('<span class="spinner dark"></span> กำลังอ่าน ' + esc(f.name) + ' หน้า ' + p + '/' + pdf.numPages + tag);
                  return pdf.getPage(p).then(function (pg) {
                    var vp = pg.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
                    return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () {
                      var pr = rows.filter(function (r) { return r.page === p; });
                      var u = { kind: 'pdf', file: f, bytes: bytes, pi: p - 1, name: f.name + (pdf.numPages > 1 ? ' หน้า ' + p : ''), thumb: scaled(cv, 900).toDataURL('image/jpeg', 0.8) };
                      if (pr.length >= 5) { u.rows = pr; units.push(u); return; }
                      waitMsg('<span class="spinner dark"></span> ' + esc(f.name) + ' หน้า ' + p + ' เป็นภาพสแกน — กำลังอ่านตัวหนังสือ… <small>(ครั้งแรกโหลดตัวอ่านภาษาไทย 20–60 วินาที)</small>');
                      u.ocr = true; u.jpg = scaled(cv, 2000).toDataURL('image/jpeg', 0.82);
                      return ocrRows(cv, 1).then(function (r) { u.rows = r; units.push(u); });
                    });
                  });
                });
              })(p);
              return c;
            });
          });
        });
      } else {
        chain = chain.then(function () {
          waitMsg('<span class="spinner dark"></span> กำลังอ่านรูป ' + esc(f.name) + tag + ' <small>(ครั้งแรกโหลดตัวอ่านภาษาไทย 20–60 วินาที)</small>');
          return imgOf(f).then(function (im) {
            var cv = scaled(im, 2400), u = { kind: 'img', file: f, name: f.name, ocr: true, jpg: scaled(cv, 2000).toDataURL('image/jpeg', 0.82) };
            u.thumb = scaled(cv, 900).toDataURL('image/jpeg', 0.8);
            return ocrRows(cv, 1).then(function (r) { u.rows = r; units.push(u); });
          });
        });
      }
    });
    chain.then(function () {
      if (!units.length) throw new Error('ไม่พบหน้าเอกสารในไฟล์ที่เลือก');
      units.forEach(function (u) { u.docNo = (A.parsePo(u.rows).docNo || '').replace(/[^\w\-\/]/g, ''); });
      // แยกใบ: หน้าแรกเริ่มใบใหม่ · มีเลขที่ใหม่ = ใบใหม่ · ไม่มีเลขที่: หน้าต่อในไฟล์ PDF เดียวกัน = ใบเดิม, รูปถ่าย = ใบใหม่
      units.forEach(function (u, i) {
        var prev = units[i - 1], cur = null;
        for (var j = i - 1; j >= 0; j--) if (units[j].docNo) { cur = units[j].docNo; break; }
        u.start = !prev || (u.docNo ? u.docNo !== cur || (prev.file !== u.file && prev.docNo !== u.docNo) : !(prev.file === u.file && u.kind === 'pdf'));
      });
      splitView(units);
    }).catch(function (e) { openModal({ color: state.dept.color, icon: 'doc', title: 'อ่านไฟล์ไม่ได้', noOk: true, cancel: 'ปิด', body: '<div class="pas-hint warn">' + esc(e && e.message || e) + '</div>' }); });
  }
  function groups(units) { var g = []; units.forEach(function (u, i) { if (!i || u.start) g.push([]); g[g.length - 1].push(u); }); return g; }
  // ขั้น 1: แสดงทุกหน้า + จุดแบ่งใบ (ติ๊ก "เริ่มใบใหม่" ได้)
  function splitView(units) {
    var draw = function () {
      var g = groups(units), n = 0;
      $('paiSplit').innerHTML = g.map(function (pages, gi) {
        return '<div class="pai-doc"><div class="pai-dh">ใบที่ ' + (gi + 1) + ' · ' + (pages.filter(function (u) { return u.docNo; })[0] ? esc(pages.filter(function (u) { return u.docNo; })[0].docNo) : '<span class="pa-no">ยังไม่รู้เลขที่ PO</span>') + ' <small>· ' + pages.length + ' หน้า</small></div><div class="pai-pages">'
          + pages.map(function (u) { var k = n++; return '<figure class="pai-pg"><img src="' + u.thumb + '" alt="' + esc(u.name) + '"><figcaption><small>' + esc(u.name) + (u.ocr ? ' · รูป/สแกน' : '') + '</small>'
            + (k ? '<label><input type="checkbox" data-st="' + k + '"' + (u.start ? ' checked' : '') + '> เริ่มใบใหม่ที่หน้านี้</label>' : '<small class="muted">หน้าแรก</small>') + '</figcaption></figure>'; }).join('') + '</div></div>';
      }).join('');
      $('mOk').textContent = 'ถัดไป: ตรวจทีละใบ (' + g.length + ' ใบ)';
    };
    openModal({ wide: true, color: state.dept.color, icon: 'doc', title: 'แยกเอกสารเป็นใบ ๆ', sub: units.length + ' หน้าจาก ' + units.map(function (u) { return u.file; }).filter(function (f, i, a) { return a.indexOf(f) === i; }).length + ' ไฟล์',
      body: '<div class="pas-hint">ระบบแบ่งใบให้ตามเลขที่ PO แล้ว — ถ้าแบ่งผิด ติ๊ก / เอาติ๊ก "เริ่มใบใหม่ที่หน้านี้"</div><div id="paiSplit"></div>', ok: 'ถัดไป',
      onOpen: function () {
        draw();
        $('paiSplit').addEventListener('change', function (e) { var c = e.target.closest('[data-st]'); if (!c) return; units[+c.getAttribute('data-st')].start = c.checked; draw(); });
      },
      submit: function () { var g = groups(units); setTimeout(function () { queueAt(g, 0, { saved: 0, skip: 0 }); }, 0); return Promise.resolve(); } });
  }
  // ขั้น 2: ตรวจ / แก้ทีละใบ แล้วบันทึก
  function queueAt(g, i, st) {
    if (i >= g.length) {
      closeModal(); P().load().then(function () { if (String(state.page).indexOf('p_') === 0) P().render(state.page); });
      toast('บันทึก PO แล้ว ' + st.saved + ' ใบ' + (st.skip ? ' · ข้าม ' + st.skip + ' ใบ' : '')); return;
    }
    var pages = g[i], rows = [];
    pages.forEach(function (u, k) { u.rows.forEach(function (r) { rows.push(Object.assign({}, r, { page: k + 1 })); }); });
    var po = A.parsePo(rows), ocr = pages.some(function (u) { return u.ocr; });
    editPo(pages, po, ocr, i, g.length, function (saved) { if (saved) st.saved++; else st.skip++; queueAt(g, i + 1, st); });
  }
  function editPo(pages, po, ocr, i, n, next) {
    var old0 = (P().data.docs || []).filter(function (d) { return po.docNo && d.docNo === po.docNo; })[0] || null, vn0 = findVendor(po), pd = payDueOf(po, vn0, old0);
    var items = po.items.length ? po.items.map(function (x) { return { name: x.name, code: x.code || '', qty: x.qty, price: x.price }; }) : [{ name: '', qty: '', price: '' }];
    var vlist = (P().data.vendors || []).map(function (v) { return '<option value="' + esc(v.name) + '">'; }).join('');
    var itemRows = function () {
      return items.map(function (x, k) { return '<tr><td>' + (k + 1) + '</td><td><input data-it="' + k + '" data-k="name" value="' + esc(x.name) + '" placeholder="ชื่อสินค้า" aria-label="ชื่อสินค้า ' + (k + 1) + '"></td><td><input data-it="' + k + '" data-k="qty" type="number" step="any" inputmode="decimal" value="' + esc(x.qty) + '" placeholder="จำนวน" aria-label="จำนวน"></td><td><input data-it="' + k + '" data-k="price" type="number" step="any" inputmode="decimal" value="' + esc(x.price) + '" placeholder="ราคา/หน่วย" aria-label="ราคาต่อหน่วย"></td><td class="r" data-am="' + k + '">' + money((Number(x.qty) || 0) * (Number(x.price) || 0)).replace(' บาท', '') + '</td><td><button type="button" class="link-btn danger" data-rm="' + k + '" aria-label="ลบแถว">✕</button></td></tr>'; }).join('');
    };
    var sumOf = function () { return Math.round(items.reduce(function (t, x) { return t + (Number(x.qty) || 0) * (Number(x.price) || 0); }, 0) * 100) / 100; };
    var sumTxt = function () { var s = sumOf(), ok = po.sub === '' || po.sub == null || Math.abs(s - po.sub) < 0.05; return (po.sub ? (ok ? '<span class="pa-ok">✓ ตรงกับมูลค่าในใบ</span>' : '<span class="pa-no">⚠ ในใบเขียน ' + money(po.sub) + '</span>') + ' · ' : '') + 'รวมก่อน VAT <b>' + money(s) + '</b>'; };
    openModal({ wide: true, sticky: true, color: state.dept.color, icon: 'doc', title: 'ใบที่ ' + (i + 1) + ' / ' + n + (po.docNo ? ' · ' + po.docNo : ''), sub: pages.map(function (u) { return u.name; }).join(', '),
      body: (ocr ? '<div class="pas-hint warn">อ่านจากรูปถ่าย / สแกน — ตัวหนังสืออาจผิด ตรวจกับภาพด้านล่างแล้วแก้ให้ถูกก่อนบันทึก</div>' : (po.docNo && po.items.length ? '<div class="pas-hint">✓ อ่านจากไฟล์ PDF — ตรวจอีกครั้งก่อนบันทึก</div>' : '<div class="pas-hint warn">อ่านข้อมูลได้ไม่ครบ — กรอกที่ขาดให้ครบ</div>'))
        + '<div class="pai-wrap"><div class="pai-imgs">' + pages.map(function (u, k) { return '<a href="' + u.thumb + '" target="_blank" rel="noopener"><img src="' + u.thumb + '" alt="หน้า ' + (k + 1) + '"></a>'; }).join('') + '<small class="muted">แตะรูปเพื่อดูใหญ่</small></div><div class="pai-form">'
        + '<div class="pform"><div class="pf"><label for="piNo">เลขที่ PO *</label><input id="piNo" value="' + esc(po.docNo || '') + '" placeholder="เช่น PO-202611063"></div>'
        + '<div class="pf"><label for="piDate">วันที่ออก</label><input id="piDate" type="date" value="' + esc(po.date || todayIso()) + '"></div>'
        + '<div class="pf full"><label for="piVen">ผู้ขาย *</label><input id="piVen" list="piVenL" value="' + esc(vn0 ? vn0.name : po.vendor || '') + '" placeholder="พิมพ์ชื่อ หรือเลือกจากรายชื่อ"><datalist id="piVenL">' + vlist + '</datalist><small id="piVenH" class="muted"></small></div>'
        + '<div class="pf hl"><label for="piDue">วันที่ชำระเงิน (ครบกำหนดชำระ)</label><input id="piDue" type="date" value="' + esc(pd.date) + '"><small class="muted">' + esc(pd.src || 'เว้นไว้ก่อนได้') + '</small></div>'
        + '<div class="pf"><label for="piCredit">เครดิต (วัน)</label><input id="piCredit" type="number" min="0" inputmode="numeric" value="' + esc(pd.credit != null ? pd.credit : (vn0 && vn0.creditDays !== '' && vn0.creditDays != null ? vn0.creditDays : '')) + '" placeholder="เช่น 30"></div></div>'
        + '<div class="cpwrap"><table class="ptable pai-items"><thead><tr><th>#</th><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th class="r">มูลค่า</th><th><span class="sr">ลบ</span></th></tr></thead><tbody id="piItems">' + itemRows() + '</tbody></table></div><small class="muted pai-phint">แต่ละรายการ: ชื่อสินค้า แล้ว จำนวน · ราคา/หน่วย · มูลค่า</small>'
        + '<div class="pai-sumrow"><button type="button" class="btn btn-sm btn-line" id="piAdd">+ เพิ่มรายการ</button><span id="piSum">' + sumTxt() + '</span></div>'
        + '<div id="piOld"></div></div></div>',
      ok: 'บันทึกใบนี้' + (i + 1 < n ? ' แล้วไปใบถัดไป' : ''), cancel: 'ข้ามใบนี้ (ไม่บันทึก)',
      onCancel: function () { setTimeout(function () { next(false); }, 0); },
      onOpen: function () {
        var venHint = function () {
          var v = findVendor({ vendor: $('piVen').value.trim(), vendorTax: po.vendorTax });
          $('piVenH').innerHTML = !$('piVen').value.trim() ? '' : v ? '<span class="pa-ok">✓ มีในรายชื่อผู้ขาย</span>' : '<span class="pa-no">ผู้ขายใหม่ — จะเพิ่มเข้ารายชื่อให้</span>';
        };
        var oldHint = function () { var no = $('piNo').value.trim(), o = (P().data.docs || []).filter(function (d) { return no && d.docNo === no; })[0]; $('piOld').innerHTML = o ? '<div class="pas-hint warn">มีใบ ' + esc(no) + ' ในระบบแล้ว — บันทึกแล้วจะอัปเดตใบเดิม (สถานะ / การชำระเงินเดิมไม่เปลี่ยน)</div>' : ''; };
        venHint(); oldHint();
        $('piVen').addEventListener('input', venHint); $('piNo').addEventListener('input', oldHint);
        $('piCredit').addEventListener('input', function () { var c = parseInt(this.value, 10); if (c >= 0) $('piDue').value = plusDays($('piDate').value || todayIso(), c); });
        $('piItems').addEventListener('input', function (e) {
          var t = e.target.closest('[data-it]'); if (!t) return;
          var x = items[+t.getAttribute('data-it')]; x[t.getAttribute('data-k')] = t.value;
          $('piItems').querySelector('[data-am="' + t.getAttribute('data-it') + '"]').textContent = money((Number(x.qty) || 0) * (Number(x.price) || 0)).replace(' บาท', '');
          $('piSum').innerHTML = sumTxt();
        });
        $('piItems').addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (!b) return; items.splice(+b.getAttribute('data-rm'), 1); if (!items.length) items.push({ name: '', qty: '', price: '' }); $('piItems').innerHTML = itemRows(); $('piSum').innerHTML = sumTxt(); });
        $('piAdd').addEventListener('click', function () { items.push({ name: '', qty: '', price: '' }); $('piItems').innerHTML = itemRows(); var r = $('piItems').querySelectorAll('[data-k="name"]'); r[r.length - 1].focus(); });
      },
      check: function () {
        if (!$('piNo').value.trim()) return 'ใส่เลขที่ PO';
        if (!$('piVen').value.trim()) return 'ใส่ชื่อผู้ขาย';
        var ok = items.filter(function (x) { return String(x.name).trim() && Number(x.qty) > 0; });
        if (!ok.length) return 'ใส่รายการสินค้าอย่างน้อย 1 รายการ (ชื่อ + จำนวน)';
        return '';
      },
      submit: function () {
        var p2 = Object.assign({}, po, { docNo: $('piNo').value.trim(), date: $('piDate').value || todayIso(), vendor: $('piVen').value.trim(),
          items: items.filter(function (x) { return String(x.name).trim() && Number(x.qty) > 0; }).map(function (x) { return { name: String(x.name).trim(), code: x.code || '', qty: Number(x.qty), price: Number(x.price) || 0 }; }) });
        var vn = findVendor(p2), old = (P().data.docs || []).filter(function (d) { return d.docNo === p2.docNo; })[0] || null;
        return buildPdf(pages).then(function (bytes) {
          return saveImport({ name: p2.docNo.replace(/[\\\/:*?"<>|]/g, '_') + '.pdf' }, bytes, p2, vn, old, false, $('piDue').value, $('piCredit').value, true);
        }).then(function (err) {
          if (err) return err;
          setTimeout(function () { next(true); }, 0); return null;
        });
      } });
  }
  // รวมหน้าของใบนั้นเป็น PDF ไฟล์เดียว: หน้า PDF คัดลอกตรง · รูปถ่าย / สแกน วางบน A4 พอดีหน้า
  function buildPdf(pages) {
    var L = window.PDFLib, out, src = {};
    return L.PDFDocument.create().then(function (d) { out = d; }).then(function () {
      return pages.reduce(function (p, u) {
        return p.then(function () {
          if (u.kind === 'pdf' && !u.ocr) {
            var key = u.file.name + u.file.size;
            return (src[key] ? Promise.resolve(src[key]) : L.PDFDocument.load(u.bytes, { ignoreEncryption: true }).then(function (s) { return (src[key] = s); }))
              .then(function (s) { return out.copyPages(s, [u.pi]); }).then(function (cp) { out.addPage(cp[0]); });
          }
          return out.embedJpg(b64ToBytes(u.jpg.split(',')[1])).then(function (im) {
            var W = 595.28, H = 841.89, s = Math.min((W - 24) / im.width, (H - 24) / im.height), pg = out.addPage([W, H]);
            pg.drawImage(im, { x: (W - im.width * s) / 2, y: (H - im.height * s) / 2, width: im.width * s, height: im.height * s });
          });
        });
      }, Promise.resolve());
    }).then(function () { return out.save(); }).then(function (b) {
      if (b.length > 14 * 1024 * 1024) throw new Error('ไฟล์ของใบนี้ใหญ่เกิน 14 MB — ลองถ่ายรูปให้น้อยหน้าลง');
      return b;
    });
  }
  function saveImport(file, bytes, po, vn, old, sign, dueIn, creditIn, queued) {
    var cr = String(creditIn || '').trim() === '' ? '' : parseInt(creditIn, 10);
    // เครดิตที่ใส่ในหน้านี้ → จำไว้ที่ผู้ขาย (ครั้งหน้าคำนวณวันที่ชำระให้เอง)
    var vp = vn ? (cr !== '' && !isNaN(cr) && String(vn.creditDays) !== String(cr) ? call('purSaveVendor', state.token, Object.assign({}, vn, { creditDays: cr })).then(function (r) { return r.ok ? r.vendor : vn; }) : Promise.resolve(vn))
      : call('purSaveVendor', state.token, { name: po.vendor || 'ไม่ระบุผู้ขาย', taxId: po.vendorTax || '', address: po.vendorAddr || '', creditDays: isNaN(cr) ? '' : cr, note: 'เพิ่มอัตโนมัติจากไฟล์ PO ' + po.docNo }).then(function (r) { if (!r.ok) throw new Error(r.error); return r.vendor; });
    return vp.then(function (v) {
      var d = old || {}, due = dueIn || '';
      var rec = { id: d.id || '', type: 'PO', docNo: po.docNo, refId: d.refId || '', vendorId: v.id, vendorName: v.name, vendorPhone: d.vendorPhone || v.phone || '', orderDate: po.date || todayIso(), deliveryDate: d.deliveryDate || po.due || '',
        status: d.status && d.status !== 'draft' ? d.status : 'approved', approvedBy: d.approvedBy || '', approvedDate: d.approvedDate || todayIso(), paymentStatus: d.paymentStatus || 'none', dueDate: due, paidDate: d.paidDate || '', paidAmount: d.paidAmount || '',
        note: d.note || ('นำเข้าจากไฟล์ PEAK ' + file.name), matchNote: d.matchNote || '', rfqId: d.rfqId || '' };
      var items = po.items.map(function (it) { var m = findMat(it); return { materialId: m ? m.id : '', materialName: m ? m.name : it.name + (it.code ? ' (' + it.code + ')' : ''), qty: it.qty, unit: m ? m.unit : '', price: it.price }; });
      return call('purSaveDoc', state.token, rec, items);
    }).then(function (r) {
      if (!r.ok) return r.error;
      return call('purUploadFile', state.token, 'doc', r.id, file.name, 'application/pdf', bytesToB64(bytes), 'ไฟล์ PR / PO').then(function (u) {
        if (!u.ok) throw new Error('บันทึกใบแล้ว แต่แนบไฟล์ไม่สำเร็จ: ' + u.error);
        return P().load().then(function () {
          var doc = P().idx.doc[r.id];
          toast((old ? 'อัปเดต ' : 'ลง ') + r.docNo + ' จากไฟล์แล้ว');
          if (queued) return null;   // อัปโหลดหลายใบ: ไปใบถัดไป (หน้า PO วาดใหม่ตอนจบ)
          if (sign && doc) getPdf(doc, { file: file, fileId: u.file && u.file.id });
          else { closeModal(); if (String(state.page).indexOf('p_') === 0) P().render(state.page); }
        });
      });
    }).catch(function (e) { if (String(e && e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e); return String(e && e.message || e); });
  }

  // ---------- เลือกใบ PO + ไฟล์ PDF ----------
  function pickDoc() {
    var docs = P().data.docs.filter(function (d) { return d.type === 'PO' && d.status !== 'cancelled'; }).sort(function (a, b) { return String(b.orderDate).localeCompare(String(a.orderDate)); });
    if (!docs.length) return toast('ยังไม่มีใบ PO — ลงใบ PO ที่เมนู "ใบ PR / PO" ก่อน');
    openModal({ wide: true, color: state.dept.color, icon: 'doc', title: 'เลือกใบ PO ที่จะส่งขออนุมัติ', noOk: true,
      body: '<div class="pform"><div class="pf full"><label for="paQ">ค้นหาเลขที่ / ผู้ขาย</label><input id="paQ" type="search" placeholder="เช่น PO-2026"></div></div><div class="pas-files" id="paDocs"></div>',
      onOpen: function () {
        var draw = function () {
          var q = $('paQ').value.trim().toLowerCase();
          $('paDocs').innerHTML = docs.filter(function (d) { return !q || (d.docNo + ' ' + d.vendorName).toLowerCase().indexOf(q) >= 0; }).slice(0, 40).map(function (d) {
            var a = A.forDoc(d.id), st = a ? ST[a.status] : null;
            return '<button type="button" class="prow click" data-pd="' + d.id + '"><div class="pinfo"><b>' + esc(d.docNo) + ' · ' + esc(d.vendorName || '-') + '</b><small>สั่ง ' + th(d.orderDate) + ' · ' + d.items.length + ' รายการ · PDF ' + d.files.filter(isPdf).length + ' ไฟล์</small>'
              + (st ? '<div><span class="tag ' + st[0] + '">' + st[1] + '</span></div>' : '') + '</div></button>';
          }).join('') || '<div class="muted">ไม่พบ</div>';
        };
        draw(); $('paQ').addEventListener('input', draw);
        $('paDocs').addEventListener('click', function (e) { var b = e.target.closest('[data-pd]'); if (b) A.openSign(P().idx.doc[b.getAttribute('data-pd')]); });
      } });
  }
  function isPdf(f) { return /pdf/i.test(f.mime || '') || /\.pdf$/i.test(f.name || ''); }
  // เปิดหน้าวางลายเซ็น: opts.file = File จากเครื่อง (เพิ่งแนบ) · ไม่มี = เลือกจาก PDF ที่แนบในใบ PO
  A.openSign = function (doc, opts) {
    css(); opts = opts || {};
    if (opts.file) return getPdf(doc, { file: opts.file });
    var pdfs = (doc.files || []).filter(isPdf).filter(function (f) { return !/ขออนุมัติ|อนุมัติแล้ว/.test(f.name) && !/PO ที่อนุมัติ|PO ส่งขออนุมัติ/.test(f.label || ''); });
    if (pdfs.length === 1) return getPdf(doc, { fileId: pdfs[0].id });
    openModal({ wide: true, color: state.dept.color, icon: 'doc', title: 'เลือกไฟล์ PDF ใบสั่งซื้อ · ' + doc.docNo, noOk: true,
      body: (pdfs.length ? '<div class="muted" style="margin-bottom:8px">PDF ที่แนบในใบนี้</div><div class="pas-files">' + pdfs.map(function (f) { return '<button type="button" class="btn btn-line" data-fid="' + esc(f.id) + '">' + icon('doc', 16) + esc(f.name) + '</button>'; }).join('') + '</div>'
        : '<div class="pas-hint warn">ใบ PO นี้ยังไม่มีไฟล์ PDF จาก PEAK</div>')
        + '<p style="margin-top:12px"><label class="btn btn-primary">' + icon('upload', 16) + 'เลือกไฟล์ PDF จากเครื่อง<input type="file" accept="application/pdf,.pdf" id="paPdf" hidden></label></p><small class="muted">ไฟล์ที่เลือกจะถูกแนบเข้าใบ PO นี้ด้วย</small>',
      onOpen: function () {
        $('mBody').addEventListener('click', function (e) { var b = e.target.closest('[data-fid]'); if (b) getPdf(doc, { fileId: b.getAttribute('data-fid') }); });
        $('paPdf').addEventListener('change', function () { var f = this.files && this.files[0]; if (f) getPdf(doc, { file: f, upload: true }); });
      } });
  };
  function readFile(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(new Uint8Array(r.result)); }; r.onerror = no; r.readAsArrayBuffer(f); }); }
  function getPdf(doc, src) {
    openModal({ wide: true, color: state.dept.color, icon: 'doc', title: 'กำลังเตรียมใบ PO · ' + doc.docNo, noOk: true, body: '<div class="panel"><span class="spinner dark"></span> กำลังเปิดไฟล์ PDF และลายเซ็น…</div>' });
    var bytesP = src.file ? readFile(src.file) : call('purPoFile', state.token, doc.id, src.fileId).then(function (r) { if (!r.ok) throw new Error(r.error); return b64ToBytes(r.b64); });
    var upP = src.file && src.upload ? readFile(src.file).then(function (u) { return call('purUploadFile', state.token, 'doc', doc.id, src.file.name, 'application/pdf', bytesToB64(u), 'ไฟล์ PR / PO'); }).then(function (r) { if (r && r.ok) { doc.files = r.files; } }) : Promise.resolve();
    Promise.all([bytesP, libs(), getSigs(), A.info ? A.info : call('purPoInfo', state.token).then(function (i) { A.info = i; return i; }), upP]).then(function (x) {
      signDialog(doc, x[0], x[2], src);
    }).catch(function (e) {
      if (String(e.message).indexOf('SESSION_EXPIRED') >= 0) return onServerError(e);
      $('mBody').innerHTML = '<div class="pas-hint warn">' + esc(e.message || e) + '</div>';
    });
  }

  // ---------- วางลายเซ็น + ดูตัวอย่าง + ส่ง ----------
  // ตำแหน่งเก็บเป็นสัดส่วนของหน้า {page, x, y, w, h} (y นับจากบน) · หาอัตโนมัติจากคำ "ผู้ออกเอกสาร" / "ผู้อนุมัติเอกสาร" ในไฟล์ PEAK
  function findSlots(pdf, sigs) {
    var out = { buyer: null, ceo: null, total: '' };
    var pages = []; for (var i = 1; i <= pdf.numPages; i++) pages.push(i);
    return pages.reduce(function (p, n) {
      return p.then(function () {
        return pdf.getPage(n).then(function (pg) {
          var vp = pg.getViewport({ scale: 1 });
          return pg.getTextContent().then(function (tc) {
            // PEAK แยกข้อความไทยเป็นชิ้นเล็ก ๆ → รวมชิ้นที่ติดกันในบรรทัดเดียวกันเป็นคำ · "ํา" → "ำ"
            var raw = tc.items.map(function (t) { var m = window.pdfjsLib.Util.transform(vp.transform, t.transform); var hgt = Math.hypot(t.transform[2], t.transform[3]) || 9; return { x: m[4], y: m[5], w: t.width, h: hgt, s: String(t.str || '').replace(/\u0e4d\u0e32/g, '\u0e33') }; })
              .filter(function (t) { return t.s; }).sort(function (a, b) { return Math.abs(a.y - b.y) > 2.5 ? a.y - b.y : a.x - b.x; });
            var items = [], cur = null;
            raw.forEach(function (t) {
              if (!t.s.trim()) { cur = null; return; }
              if (cur && Math.abs(t.y - cur.y) <= 2.5 && t.x - (cur.x + cur.w) < 2.5) { cur.s += t.s; cur.w = Math.max(cur.w, t.x + t.w - cur.x); cur.h = Math.max(cur.h, t.h); return; }
              cur = { x: t.x, y: t.y, w: t.w, h: t.h, s: t.s }; items.push(cur);
            });
            // ไฟล์ PEAK ใช้รหัสพิเศษของฟอนต์แทนสระ / วรรณยุกต์บางตัว (U+F7xx) → เทียบแบบไม่สนสระบน/ล่าง วรรณยุกต์ และช่องว่าง
            var key = function (t) { return String(t).replace(/[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\uf700-\uf8ff\s]/g, '').toLowerCase(); };
            items.forEach(function (t, k) {
              if (!out.total && key(t.s).indexOf(key('จำนวนเงินทั้งสิ้น')) >= 0) {
                var nums = items.filter(function (u) { return Math.abs(u.y - t.y) < 12 && u.x > t.x && /^[\d,]+\.\d{2}(\s|$)/.test(u.s.trim()); }).sort(function (a, b) { return a.x - b.x; });
                if (nums.length) out.total = Number(nums[0].s.trim().split(/\s/)[0].replace(/,/g, ''));
              }
            });
            var slot = function (words, role) {
              var ks = words.map(key), lab = items.filter(function (t) { var k = key(t.s); return ks.some(function (w) { return k.indexOf(w) >= 0; }); })[0]; if (!lab) return;
              var cx = lab.x + lab.w / 2, top = lab.y + 4;
              var below = items.filter(function (u) { return u !== lab && u.y > lab.y + 6 && u.y < lab.y + 70 && Math.abs(u.x + u.w / 2 - cx) < Math.max(40, lab.w / 2); }).sort(function (a, b) { return a.y - b.y; })[0];
              var bottom = below && below.s.trim() !== '-' ? below.y - below.h + 7 : lab.y + 62;
              var avail = Math.max(22, Math.min(42, bottom - top)), img = sigs[role], ar = img ? img.ar : 2.6, ww = Math.min(avail * ar, Math.max(lab.w, 80) * 1.1), hh = Math.min(avail, ww / ar);
              ww = hh * ar;
              out[role] = { page: n, x: (cx - ww / 2) / vp.width, y: (bottom - hh) / vp.height, w: ww / vp.width, h: hh / vp.height };
            };
            if (!out.buyer) slot(['ผู้ออกเอกสาร', 'ผู้สั่งซื้อ', 'ผู้จัดทำ', 'Prepared', 'Issued'], 'buyer');
            if (!out.ceo) slot(['ผู้อนุมัติ', 'Approv', 'Authorized', 'Authorised'], 'ceo');
          });
        });
      });
    }, Promise.resolve()).then(function () { return out; });
  }
  function imgInfo(data) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok({ data: data, ar: im.width / im.height || 2.6, img: im }); }; im.onerror = function () { ok(null); }; im.src = data; }); }
  function signDialog(doc, bytes, sigs, src) {
    var i = A.info || {}, miss = [];
    if (!sigs.buyer) miss.push('ลายเซ็นผู้ออกเอกสาร (เนย)'); if (!sigs.ceo) miss.push('ลายเซ็นผู้อนุมัติ (พี่เก้)');
    if (!i.tokenOk) miss.push('บอท LINE'); if (!i.group) miss.push('กลุ่ม LINE'); if (!(i.approvers || []).length) miss.push('ผู้มีสิทธิ์อนุมัติ');
    if (miss.length) {
      openModal({ color: state.dept.color, icon: 'warn', title: 'ยังส่งขออนุมัติไม่ได้', body: '<div class="pas-hint warn">ยังขาด: <b>' + miss.join(', ') + '</b><br>ตั้งค่าที่เมนู "ขออนุมัติ PO (LINE)" → ตั้งค่า</div>', ok: 'ไปหน้าตั้งค่า',
        submit: function () { closeModal(); P().q.paF = ''; go('p_poa'); } });
      return;
    }
    var copy = bytes.slice(0);
    Promise.all([window.pdfjsLib.getDocument({ data: copy }).promise, imgInfo(sigs.buyer.data), imgInfo(sigs.ceo.data)]).then(function (x) {
      var pdf = x[0], S = { buyer: x[1], ceo: x[2] };
      return findSlots(pdf, S).then(function (slots) { drawSign(doc, bytes, pdf, S, slots, sigs, src || {}); });
    }).catch(function (e) { $('mBody').innerHTML = '<div class="pas-hint warn">เปิด PDF ไม่ได้: ' + esc(e.message || e) + '</div>'; });
  }
  function drawSign(doc, bytes, pdf, S, slots, sigs, src) {
    // ไฟล์แนบท้าย PO (ผู้ใช้ขอ 24/11/69): PDF / รูปที่แนบในใบ PO หรือเลือกจากเครื่อง → ต่อเป็นหน้าถัดไปในไฟล์ PO เดียวกัน
    var att = (doc.files || []).filter(function (f) { return f.id !== src.fileId && (isPdf(f) || /^image\/(jpeg|png|webp)/.test(f.mime || '')) && !/ขออนุมัติ|อนุมัติแล้ว|ตัวอย่าง/.test(f.name) && !/PO ที่อนุมัติ|PO ส่งขออนุมัติ/.test(f.label || ''); })
      .map(function (f) { return { name: f.name, label: f.label, fileId: f.id, on: false }; });
    var saved = store('pos') || {}, n = pdf.numPages;
    var def = function (role) {
      var s = slots[role];
      if (s) { var o = saved[role + '_d']; if (o) s = { page: s.page, x: s.x + o.dx, y: s.y + o.dy, w: s.w * o.k, h: s.h * o.k }; return s; }
      return saved[role] || (role === 'buyer' ? { page: n, x: 0.3, y: 0.86, w: 0.14, h: 0.14 / S.buyer.ar * 0.707 } : { page: n, x: 0.45, y: 0.86, w: 0.14, h: 0.14 / S.ceo.ar * 0.707 });
    };
    var box = { buyer: def('buyer'), ceo: def('ceo') }, found = !!(slots.buyer && slots.ceo);
    var by = nameOf(sigs.buyer.label);
    openModal({ wide: true, sticky: true, color: state.dept.color, icon: 'line', title: 'ตรวจ PO ก่อนส่งขออนุมัติ · ' + doc.docNo, sub: (doc.vendorName || '') + ' — ลายเซ็นวางตามช่องในใบ ลากย้าย / ลากมุมเพื่อปรับขนาดได้',
      body: '<div class="pas-sum"><div><small>ใบสั่งซื้อ</small><b>' + esc(doc.docNo) + '</b></div><div><small>ผู้ขาย</small><b>' + esc(doc.vendorName || '-') + '</b></div><div><small>จำนวนเงินทั้งสิ้น (ในไฟล์)</small><b>' + money(slots.total || doc.total) + '</b></div><div><small>ผู้ออกเอกสาร</small><b>' + esc(by) + '</b></div></div>'
        + '<div class="pas-hint' + (found ? '' : ' warn') + '">' + (found ? 'วางลายเซ็น <b style="color:#2563eb">' + esc(sigs.buyer.label) + '</b> ที่ช่องผู้ออกเอกสารแล้ว · กรอบเขียวประ = ตำแหน่ง <b style="color:#16a34a">' + esc(sigs.ceo.label) + '</b> จะใส่ให้เมื่อกดอนุมัติใน LINE (ตอนนี้ยังไม่แสดงในไฟล์ที่ส่ง)' : 'ไม่พบช่องลงชื่อในไฟล์ — ลากลายเซ็นไปวางในช่องเองก่อนส่ง') + '</div>'
        + '<div class="pas-att"><div class="pas-atth"><b>' + icon('clip', 16) + ' ไฟล์แนบท้าย PO</b><small class="muted">เช่น ใบเสนอราคา · ต่อเป็นหน้าถัดไปในไฟล์ PO ไฟล์เดียว</small></div><div id="pasAtt"></div>'
        + '<label class="btn btn-sm btn-line">' + icon('plus', 15) + 'เพิ่มไฟล์จากเครื่อง (PDF / รูป)<input type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp" multiple id="pasAttF" hidden></label></div>'
        + '<div class="pas-wrap" id="pasWrap"></div>',
      ok: 'ส่งขออนุมัติทาง LINE', cancel: 'ยกเลิก',
      foot: '<button type="button" class="link-btn" id="pasReset">↺ วางตำแหน่งอัตโนมัติใหม่</button>',
      onOpen: function () {
        var wrap = $('pasWrap'), pages = []; for (var k = 1; k <= n; k++) pages.push(k);
        // แสดงเฉพาะหน้าที่มีช่องลงชื่อ + หน้าแรก (ไฟล์ส่วนใหญ่มีหน้าเดียว)
        var show = pages.filter(function (k) { return k === 1 || k === box.buyer.page || k === box.ceo.page; });
        show.reduce(function (p, k) {
          return p.then(function () {
            return pdf.getPage(k).then(function (pg) {
              var vp1 = pg.getViewport({ scale: 1 }), cw = Math.min(760, wrap.clientWidth || 700), sc = cw / vp1.width * Math.min(2, window.devicePixelRatio || 1) * 1.3, vp = pg.getViewport({ scale: sc });
              var div = document.createElement('div'); div.className = 'pas-page'; div.setAttribute('data-pg', k);
              var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; div.appendChild(c); wrap.appendChild(div);
              return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { ['buyer', 'ceo'].forEach(function (r) { if (box[r].page === k) addBox(div, r); }); });
            });
          });
        }, Promise.resolve());
        var drawAtt = function () {
          $('pasAtt').innerHTML = att.length ? att.map(function (a, k) {
            return '<label class="pas-ai"><input type="checkbox" data-ai="' + k + '"' + (a.on ? ' checked' : '') + '><span>' + (/\.pdf$/i.test(a.name) || (a.file && /pdf/.test(a.file.type)) ? 'PDF' : 'รูป') + '</span><b>' + esc(a.name) + '</b>' + (a.label ? '<small>' + esc(a.label) + '</small>' : a.file ? '<small>จากเครื่อง</small>' : '')
              + (a.file ? '<button type="button" class="link-btn danger" data-ar="' + k + '">เอาออก</button>' : '') + '</label>';
          }).join('') : '<div class="muted">ยังไม่มีไฟล์แนบ — ไม่แนบก็ส่งได้</div>';
          var n2 = att.filter(function (a) { return a.on; }).length;
          $('mOk').textContent = 'ส่งขออนุมัติทาง LINE' + (n2 ? ' (แนบ ' + n2 + ' ไฟล์)' : '');
        };
        drawAtt();
        $('pasAtt').addEventListener('change', function (e) { var k = e.target.getAttribute('data-ai'); if (k != null) { att[+k].on = e.target.checked; drawAtt(); } });
        $('pasAtt').addEventListener('click', function (e) { var b = e.target.closest('[data-ar]'); if (b) { e.preventDefault(); att.splice(+b.getAttribute('data-ar'), 1); drawAtt(); } });
        $('pasAttF').addEventListener('change', function () {
          Array.prototype.forEach.call(this.files, function (f) {
            if (!/pdf|image\/(jpeg|png|webp)/.test(f.type) && !/\.pdf$/i.test(f.name)) return toast('แนบได้เฉพาะ PDF หรือรูป JPG / PNG: ' + f.name);
            if (f.size > 10 * 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 10 MB: ' + f.name);
            att.push({ name: f.name, file: f, on: true });
          });
          this.value = ''; drawAtt();
        });
        $('pasReset').addEventListener('click', function () { var s = store('pos') || {}; delete s.buyer_d; delete s.ceo_d; delete s.buyer; delete s.ceo; store('pos', s); saved = s; box = { buyer: def('buyer'), ceo: def('ceo') }; ['buyer', 'ceo'].forEach(place); });
      },
      submit: function () { return send(doc, bytes, pdf, S, box, slots, by, att.filter(function (a) { return a.on; })); }
    });
    function addBox(div, role) {
      var b = document.createElement('div'); b.className = 'pas-box ' + role; b.id = 'pasB_' + role;
      b.innerHTML = '<b>' + (role === 'buyer' ? 'ผู้ออกเอกสาร · ' + esc(nameOf(sigs.buyer.label)) : 'ผู้อนุมัติ · ใส่หลังอนุมัติ') + '</b><img src="' + S[role].data + '" alt=""><i class="pas-h" aria-label="ปรับขนาด"></i>';
      div.appendChild(b); place(role);
      var start = null;
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); b.setPointerCapture(e.pointerId);
        var r = div.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, bx: box[role].x, by: box[role].y, bw: box[role].w, bh: box[role].h, W: r.width, H: r.height, rs: e.target.classList.contains('pas-h') };
      });
      b.addEventListener('pointermove', function (e) {
        if (!start) return;
        var dx = (e.clientX - start.x) / start.W, dy = (e.clientY - start.y) / start.H, o = box[role];
        if (start.rs) { var k2 = Math.max(0.4, Math.min(3, (start.bw + dx) / start.bw)); o.w = start.bw * k2; o.h = start.bh * k2; }
        else { o.x = Math.max(0, Math.min(1 - o.w, start.bx + dx)); o.y = Math.max(0, Math.min(1 - o.h, start.by + dy)); }
        place(role);
      });
      var end = function () {
        if (!start) return; start = null;
        var s = store('pos') || {}, auto = slots[role];
        if (auto) s[role + '_d'] = { dx: box[role].x - auto.x, dy: box[role].y - auto.y, k: box[role].w / auto.w }; else s[role] = box[role];
        store('pos', s);
      };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    }
    function place(role) { var el = $('pasB_' + role), o = box[role]; if (!el) return; el.style.left = o.x * 100 + '%'; el.style.top = o.y * 100 + '%'; el.style.width = o.w * 100 + '%'; el.style.height = o.h * 100 + '%'; }
  }
  // สร้างไฟล์ 2 แบบ + ภาพตัวอย่างหน้าที่มีลายเซ็น → purPoSend
  function stamp(bytes, list, atts) {
    var L = window.PDFLib;
    return L.PDFDocument.load(bytes).then(function (pd) {
      return Promise.all(list.map(function (s) { return pd.embedPng(b64ToBytes(s.img.data.split(',')[1])); })).then(function (embs) {
        list.forEach(function (s, k) {
          var page = pd.getPages()[s.box.page - 1], mb = page.getMediaBox(), W = mb.width, H = mb.height;
          page.drawImage(embs[k], { x: mb.x + s.box.x * W, y: mb.y + H - (s.box.y + s.box.h) * H, width: s.box.w * W, height: s.box.h * H });
        });
        // ต่อไฟล์แนบท้าย: PDF = คัดลอกทุกหน้า · รูป = 1 หน้า A4 ย่อให้พอดี
        return (atts || []).reduce(function (p, a) {
          return p.then(function () {
            if (a.pdf) return L.PDFDocument.load(a.bytes, { ignoreEncryption: true }).then(function (sd) {
              return pd.copyPages(sd, sd.getPageIndices()).then(function (pgs) { pgs.forEach(function (pg) { pd.addPage(pg); }); });
            });
            return pd.embedJpg(a.bytes).then(function (im) {
              var land = a.w > a.h, PW = land ? 841.89 : 595.28, PH = land ? 595.28 : 841.89, m = 24, k = Math.min((PW - 2 * m) / a.w, (PH - 2 * m) / a.h);
              var pg = pd.addPage([PW, PH]); pg.drawImage(im, { x: (PW - a.w * k) / 2, y: (PH - a.h * k) / 2, width: a.w * k, height: a.h * k });
            });
          });
        }, Promise.resolve()).then(function () { return pd.save(); });
      });
    });
  }
  // โหลดไฟล์แนบ: จากใบ PO (purPoFile) หรือจากเครื่อง · รูปแปลงเป็น JPEG ผ่าน canvas (ด้านยาวไม่เกิน 2000px)
  function loadAtt(doc, a) {
    var get = a.file ? readFile(a.file).then(function (u) { return { bytes: u, mime: a.file.type || (/\.pdf$/i.test(a.name) ? 'application/pdf' : '') }; })
      : call('purPoFile', state.token, doc.id, a.fileId).then(function (r) { if (!r.ok) throw new Error(r.error + ': ' + a.name); return { bytes: b64ToBytes(r.b64), mime: r.mime || 'application/pdf' }; });
    return get.then(function (x) {
      if (/pdf/.test(x.mime)) return { pdf: true, bytes: x.bytes, name: a.name };
      return new Promise(function (ok, no) {
        var url = URL.createObjectURL(new Blob([x.bytes], { type: x.mime })), im = new Image();
        im.onload = function () {
          var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          ok({ pdf: false, bytes: b64ToBytes(c.toDataURL('image/jpeg', 0.85).split(',')[1]), w: c.width, h: c.height, name: a.name });
        };
        im.onerror = function () { URL.revokeObjectURL(url); no(new Error('เปิดรูปไม่ได้: ' + a.name)); };
        im.src = url;
      });
    });
  }
  function preview(pdf, S, box) {
    var k = box.buyer.page;
    return pdf.getPage(k).then(function (pg) {
      var vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 1240 / vp1.width });
      var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; var g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      return pg.render({ canvasContext: g, viewport: vp }).promise.then(function () {
        var o = box.buyer; g.drawImage(S.buyer.img, o.x * c.width, o.y * c.height, o.w * c.width, o.h * c.height);
        return { b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], ratio: c.width + ':' + c.height };
      });
    });
  }
  function send(doc, bytes, pdf, S, box, slots, by, atts) {
    var prev = A.forDoc(doc.id);
    var go2 = prev && prev.status === 'pending' ? ask({ title: 'ส่งขออนุมัติใหม่?', text: 'PO นี้ส่งขออนุมัติไปแล้วเมื่อ ' + thT(prev.sentAt) + ' — ส่งใหม่แล้วการ์ดเดิมใน LINE จะกดอนุมัติไม่ได้', ok: 'ส่งใหม่' }) : Promise.resolve(true);
    return go2.then(function (ok) {
      if (!ok) return 'ยังไม่ได้ส่ง';
      if ($('mErr') && atts.length) $('mErr').textContent = 'กำลังรวมไฟล์แนบ ' + atts.length + ' ไฟล์…';
      return Promise.all((atts || []).map(function (a) { return loadAtt(doc, a); })).then(function (A2) {
        var size = A2.reduce(function (t, a) { return t + a.bytes.length; }, 0);
        if (size > 15 * 1024 * 1024) throw new Error('ไฟล์แนบรวมกันใหญ่เกิน 15 MB — ลดจำนวนไฟล์ หรือใช้ไฟล์ที่เล็กลง');
        return Promise.all([stamp(bytes, [{ img: S.buyer, box: box.buyer }], A2), stamp(bytes, [{ img: S.buyer, box: box.buyer }, { img: S.ceo, box: box.ceo }], A2), preview(pdf, S, box)]);
      }).then(function (x) {
        if ($('mErr')) $('mErr').textContent = '';
        return call('purPoSend', state.token, doc.id, { pdf1: bytesToB64(x[0]), pdf2: bytesToB64(x[1]), img: x[2].b64, ratio: x[2].ratio, total: slots.total || '', sentBy: by, attach: atts.map(function (a) { return a.name; }) });
      }, function (e) { if ($('mErr')) $('mErr').textContent = ''; if (String(e && e.message).indexOf('SESSION_EXPIRED') >= 0) throw e; return String(e && e.message || e).indexOf('ncrypt') >= 0 ? 'ไฟล์ PDF แนบมีรหัสผ่าน — ใช้ไฟล์ที่ไม่ล็อก' : 'รวมไฟล์แนบไม่สำเร็จ: ' + (e && e.message || e); }).then(function (r) {
        if (typeof r === 'string') return r;
        if (!r.ok) return r.error;
        closeModal(); toast('ส่ง ' + doc.docNo + ' ขออนุมัติเข้ากลุ่ม LINE แล้ว');
        P().load().then(function () { A.list = P().data.poApprovals; P().q.paF = 'pending'; go('p_poa'); });
      });
    });
  }
})();
