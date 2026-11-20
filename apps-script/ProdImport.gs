// ==================== PROD — นำเข้าไฟล์ Yield (Excel) ย้อนหลัง ====================
//
// ผู้ใช้ขอ 20/11/69: ฝ่ายผลิตมีไฟล์ Yield รายเดือน (1 ชีต = 1 วัน, หัวตาราง รายชื่อสินค้า / น้ำหนักวัตถุดิบ / น้ำหนักหลังผัด /
// น้ำหนักหลังทำเย็น / Yield / จำนวนสินค้า / จำนวนสินค้าที่ได้จริง) — หน้าเว็บ (production.js p_imp) อ่านไฟล์แล้วส่งเฉพาะแถวที่มีผลจริงมา
// 1 แถว = งานผัด (G2) ของวันนั้น · ตัวเลขในไฟล์เป็นค่าเฉลี่ยต่อ batch (ไฟล์ไม่มีจำนวน batch) → บันทึกเป็น ทำจริง 1 batch
// รหัสแถว PY<yyyymmdd>_<รหัสสินค้า> → นำเข้าไฟล์เดิมซ้ำ = แก้แถวเดิม ไม่เพิ่มซ้ำ · สินค้าที่ไม่มีในระบบ เพิ่มให้พร้อมมาตรฐานจากไฟล์
//
// items = [{ date: 'yyyy-MM-dd', cat: 'สินค้าประเภท…', name, rawKg, fryKg, coolKg, actQty, std: '910-920' }]
// dry = true → ตรวจอย่างเดียว (หน้าตัวอย่างก่อนบันทึก)

function prdYieldNorm_(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/กรัม/g, 'g').replace(/g\./g, 'g').replace(/[()]/g, '');
}
function prdYieldCat_(s) { return String(s || '').replace(/^สินค้า(ประเภท)?\s*/, '').trim(); }
function prdYieldRange_(s) {
  var m = String(s == null ? '' : s).replace(/,/g, '').match(/([\d.]+)(?:\s*-\s*([\d.]+))?/);
  return m ? [Number(m[1]), Number(m[2] || m[1])] : ['', ''];
}

function prdImportYield(token, items, dry) {
  var dept = requirePrd_(token);
  return prdImportYield_(dept, items, dry);
}
function prdImportYield_(dept, items, dry) {
  items = (Array.isArray(items) ? items : []).slice(0, 3000).map(function (x) {
    return { date: purDate_(x && x.date), cat: purClean_(x && x.cat, 80), name: purClean_(x && x.name, 150), rawKg: prdNum_(x && x.rawKg, 1e5), fryKg: prdNum_(x && x.fryKg, 1e5),
      coolKg: prdNum_(x && x.coolKg, 1e5), actQty: prdNum_(x && x.actQty, 1e7), std: purClean_(x && x.std, 30) };
  }).filter(function (x) { return x.date && x.name && (x.fryKg !== '' || x.coolKg !== '' || x.actQty !== ''); });
  if (!items.length) return { ok: false, error: 'ไม่พบแถวที่มีผลผลิตในไฟล์' };
  var run = function () {
    var ss = prdBook_(dept), s = prdSettings_(ss), now = purNow_();
    prdSeedProducts_(ss);
    var prods = purRead_(ss, 'prd_products'), plans = purRead_(ss, 'prd_plans'), byId = {};
    plans.forEach(function (p) { byId[p.id] = p; });
    var nextNo = prods.reduce(function (m, p) { var n = +(String(p.id).match(/^PD(\d+)$/) || [])[1] || 0; return Math.max(m, n); }, 0);
    var maxSort = prods.reduce(function (m, p) { return Math.max(m, Number(p.sort) || 0); }, 0);
    var added = [];
    var find = function (it) {
      var n = prdYieldNorm_(it.name), c = prdYieldCat_(it.cat);
      var same = prods.filter(function (p) { return prdYieldNorm_(p.name) === n; });
      if (same.length > 1 && c) { var byCat = same.filter(function (p) { return p.category && (c.indexOf(p.category) >= 0 || String(p.category).indexOf(c) >= 0); }); if (byCat.length) same = byCat; }
      if (same.length) return same[0];
      var r = prdYieldRange_(it.std), p = { id: 'PD' + ('00' + (++nextNo)).slice(-3), category: c, name: it.name, rawKg: it.rawKg, qtyMin: r[0], qtyMax: r[1],
        unit: '', target: '', active: 'ใช้', sort: ++maxSort, createdAt: now, updatedAt: now, _new: true };
      prods.push(p); added.push(p);
      return p;
    };
    var seen = {}, rows = [], upd = 0, fresh = 0;
    items.forEach(function (it) {
      var p = find(it), id = 'PY' + it.date.replace(/-/g, '') + '_' + p.id;
      seen[id] = (seen[id] || 0) + 1; if (seen[id] > 1) id += '_' + seen[id];   // สินค้าเดียวกัน 2 แถวในวันเดียว
      var old = byId[id], o = old || { id: id, createdAt: now };
      Object.assign(o, { date: it.date, grp: 'G2', productId: p.id, product: p.name, lot: it.date, planBatch: '', planQty: '', planUnit: 'batch', dueDate: '',
        actBatch: 1, actBatchUnit: 'batch', rawKg: it.rawKg !== '' ? it.rawKg : (Number(p.rawKg) || ''), fryKg: it.fryKg, coolKg: it.coolKg,
        rawUnit: 'กก.', fryUnit: 'กก.', coolUnit: 'กก.', lossKgUnit: 'กก.', actQty: it.actQty, unit: p.unit || '', finishDate: it.date, status: 'done',
        note: 'นำเข้าจากไฟล์ Yield (ค่าเฉลี่ยต่อ batch)', by: 'นำเข้าไฟล์ Excel', updatedAt: now });
      prdCalc_(o, p, s);
      rows.push({ o: o, old: !!old, isNew: !!p._new });
      if (old) upd++; else fresh++;
    });
    var out = { ok: true, total: rows.length, fresh: fresh, update: upd, newProducts: added.map(function (p) { return { name: p.name, category: p.category, rawKg: p.rawKg, qtyMin: p.qtyMin, qtyMax: p.qtyMax }; }),
      days: Object.keys(rows.reduce(function (m, r) { m[r.o.date] = 1; return m; }, {})).length,
      rows: rows.map(function (r) { return { date: r.o.date, product: r.o.product, rawKg: r.o.rawKg, fryKg: r.o.fryKg, coolKg: r.o.coolKg, yieldPct: r.o.yieldPct, actQty: r.o.actQty, expMin: r.o.expMin, expMax: r.o.expMax, exists: r.old, newProduct: r.isNew }; }) };
    if (dry) return out;
    if (added.length) {
      var psh = purSheet_(ss, 'prd_products'), ph = psh.getRange(1, 1, 1, psh.getLastColumn()).getValues()[0].map(String);
      var pv = added.map(function (p) { return purRowValues_(psh, 'prd_products', p, ph); });
      psh.getRange(psh.getLastRow() + 1, 1, pv.length, pv[0].length).setValues(pv);
    }
    var sh = purSheet_(ss, 'prd_plans'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    rows.filter(function (r) { return r.old; }).forEach(function (r) { sh.getRange(r.o._row, 1, 1, head.length).setValues([purRowValues_(sh, 'prd_plans', r.o, head)]); });
    var nv = rows.filter(function (r) { return !r.old; }).map(function (r) { return purRowValues_(sh, 'prd_plans', r.o, head); });
    if (nv.length) sh.getRange(sh.getLastRow() + 1, 1, nv.length, nv[0].length).setValues(nv);
    var ds = rows.map(function (r) { return r.o.date; }).sort();
    purLogWrite_(ss, 'นำเข้าไฟล์ Yield', 'prd_plans', '', rows.length + ' รายการ · ' + ds[0] + ' ถึง ' + ds[ds.length - 1] + ' · ใหม่ ' + fresh + ' · แก้ ' + upd + (added.length ? ' · เพิ่มสินค้า ' + added.map(function (p) { return p.name; }).join(', ') : ''));
    delete out.rows;
    return out;
  };
  return dry ? run() : purLocked_(run);
}
