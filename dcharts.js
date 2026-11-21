// ==================== กราฟสำหรับหน้า Dashboard ทุกฝ่าย (window.DCH) ====================
// ผู้ใช้ขอ 21/11/69: Dashboard ให้ทันสมัยแบบภาพตัวอย่าง — กราฟเส้นพื้นที่ไล่สี, กราฟโดนัท, ป้าย ↑ / ↓ เทียบช่วงก่อน
// ทุกฟังก์ชันคืน HTML (SVG ในตัว ไม่ใช้ไลบรารีภายนอก) ใช้ได้ทั้งหน้าฝ่าย หน้าผู้บริหาร และไฟล์ PDF ที่โหลดจากหน้าจอ
(function () {
  var uid = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtN(v) { var n = Number(v) || 0; return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 100) / 100); }
  function short(v) { var n = Number(v) || 0, a = Math.abs(n); return a >= 1e6 ? Math.round(n / 1e5) / 10 + 'M' : a >= 1e4 ? Math.round(n / 1e3) + 'k' : a >= 1000 ? Math.round(n / 100) / 10 + 'k' : fmtN(n); }
  function niceMax(m) { if (!(m > 0)) return 1; var p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  // เส้นโค้งผ่านทุกจุด (Catmull-Rom → Bezier) ไม่ให้เลยขอบบน/ล่าง
  function smooth(pts, top, bot) {
    if (pts.length < 2) return pts.length ? 'M' + pts[0][0] + ',' + pts[0][1] : '';
    var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1), cl = function (y) { return Math.max(top, Math.min(bot, y)); };
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
      var c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = cl(p1[1] + (p2[1] - p0[1]) * t), c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = cl(p2[1] - (p3[1] - p1[1]) * t);
      d += 'C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }

  // area({ labels: ['มิ.ย.', ...], series: [{ name, color, values: [..], fill: true, dash: false }], unit: ' ชม.', height: 200, target: 85, targetLabel, yMax, fmt })
  // ป้ายค่าล่าสุด (เหมือนภาพตัวอย่าง) ติดที่จุดสุดท้ายของเส้นแรก · แตะ/ชี้แต่ละช่วงเห็นค่าทุกเส้น (title)
  function area(o) {
    var L = o.labels || [], S = (o.series || []).filter(function (s) { return s && s.values; }), n = L.length;
    if (!n || !S.length) return '<div class="muted">ไม่มีข้อมูล</div>';
    // เส้น / พื้นที่วาดด้วย SVG ยืดเต็มกล่อง (เส้นหนาคงที่) · ตัวอักษร จุด ป้าย เป็น HTML จึงอ่านง่ายทุกขนาดจอ
    var H = o.height || 190, id = 'dch' + (++uid), unit = o.unit || '', f = o.fmt || fmtN, V = 1000;
    var all = []; S.forEach(function (s) { s.values.forEach(function (v) { if (v != null && isFinite(v)) all.push(+v); }); });
    if (o.target != null) all.push(+o.target);
    var mn = o.yMin || 0, top = Math.max.apply(null, all.concat([mn + 1e-9])), isInt = all.every(function (v) { return Math.round(v) === v; });
    var n125 = function (v) { var p = Math.pow(10, Math.floor(Math.log10(v))), q = v / p; return (q <= 1 ? 1 : q <= 2 ? 2 : q <= 5 ? 5 : 10) * p; };
    var mx, step;   // เส้นแบ่ง 1-2-5 (จำนวนเต็มเมื่อข้อมูลเป็นจำนวนเต็ม) ให้ตัวเลขแกนอ่านง่าย
    if (o.yMax) { mx = o.yMax; step = n125((mx - mn) / 5); }
    else { step = n125(Math.max(1e-9, (top * 1.08 - mn) / 4)); if (isInt) step = Math.max(1, Math.round(step)); mx = mn + step * Math.max(1, Math.ceil((top * 1.08 - mn) / step - 1e-9)); }
    var px = function (i) { return n === 1 ? 50 : 2 + 96 * i / (n - 1); };            // % แนวนอน (เว้นขอบ 2%)
    var py = function (v) { return 6 + 88 * (1 - (v - mn) / Math.max(1e-9, mx - mn)); };  // % แนวตั้ง
    var svg = '<svg class="dch-svg" viewBox="0 0 ' + V + ' ' + V + '" preserveAspectRatio="none" aria-hidden="true"><defs>';
    S.forEach(function (s, k) { svg += '<linearGradient id="' + id + 'g' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".26"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>'; });
    svg += '</defs>';
    var dots = '', html = '';
    for (var gv = mn; gv <= mx + step / 1000; gv += step) html += '<div class="dch-gl" style="top:' + py(gv) + '%"><span>' + short(Math.round(gv * 1000) / 1000) + '</span></div>';
    if (o.target != null) html += '<div class="dch-tg" style="top:' + py(o.target) + '%"></div>';   // ชื่อเส้นเป้าอยู่ในคำอธิบายใต้กราฟ (ไม่ทับจุด)
    S.forEach(function (s, k) {
      var pts = []; s.values.forEach(function (v, i) { if (v != null && isFinite(v)) pts.push([px(i) * V / 100, py(+v) * V / 100, i]); });
      if (!pts.length) return;
      var line = smooth(pts, 0, V);
      if (s.fill !== false && pts.length > 1) svg += '<path d="' + line + 'L' + pts[pts.length - 1][0] + ',' + V + 'L' + pts[0][0] + ',' + V + 'Z" fill="url(#' + id + 'g' + k + ')"/>';
      svg += '<path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 2.6) + '" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="6 6"' : '') + '/>';
      if (pts.length <= 31 && !s.dash) pts.forEach(function (p) { dots += '<i class="dch-pt" style="left:' + (p[0] / 10) + '%;top:' + (p[1] / 10) + '%;border-color:' + s.color + '"></i>'; });
    });
    svg += '</svg>';
    // ช่องชี้ดูค่าทุกช่วง (title)
    var cols = L.map(function (l, i) {
      var w = n === 1 ? 100 : 96 / (n - 1), tip = l + S.map(function (s) { var v = s.values[i]; return '\n' + s.name + ': ' + (v == null ? '–' : f(v) + unit); }).join('');
      return '<b class="dch-col" style="left:' + (px(i) - w / 2) + '%;width:' + w + '%" title="' + esc(tip) + '"></b>';
    }).join('');
    // ป้ายค่าของจุดล่าสุด (เส้นแรก)
    var s0 = S[0], li = -1; for (var j = n - 1; j >= 0; j--) if (s0.values[j] != null && isFinite(s0.values[j])) { li = j; break; }
    var call = '';
    if (li >= 0 && o.callout !== false) {
      var cx = px(li), cy = py(+s0.values[li]), right = cx > 55, below = cy < 30;
      call = '<span class="dch-drop" style="left:' + cx + '%;top:' + cy + '%"></span><i class="dch-pt big" style="left:' + cx + '%;top:' + cy + '%;border-color:' + s0.color + '"></i>'
        + '<div class="dch-call" style="' + (right ? 'right:calc(' + (100 - cx) + '% + 14px)' : 'left:calc(' + cx + '% + 14px)') + ';top:' + (below ? 'calc(' + cy + '% + 8px)' : 'calc(' + cy + '% - 52px)') + '"><small>' + esc(o.calloutLabel ? o.calloutLabel(li) : L[li]) + '</small><b>' + esc(f(s0.values[li]) + unit) + '</b></div>';
    }
    var every = Math.max(1, Math.ceil(n / (o.maxTicks || 7)));
    var xl = L.map(function (l, i) { return i === n - 1 || (i % every === 0 && n - 1 - i >= Math.ceil(every * 0.75)) ? '<span style="left:' + px(i) + '%">' + esc(l) + '</span>' : ''; }).join('');
    var leg = S.length > 1 || o.legend || o.target != null ? '<div class="dch-leg">' + S.map(function (s) { return '<span><i style="background:' + s.color + (s.dash ? ';opacity:.6' : '') + '"></i>' + esc(s.name) + '</span>'; }).join('') + (o.target != null ? '<span><i class="dch-ti"></i>' + esc(o.targetLabel || 'เป้าหมาย') + '</span>' : '') + '</div>' : '';
    return '<div class="dch" role="img" aria-label="' + esc(o.title || S.map(function (s) { return s.name; }).join(', ')) + '"><div class="dch-plot" style="height:' + H + 'px">' + html + svg + dots + cols + call + '</div><div class="dch-x">' + xl + '</div>' + leg + '</div>';
  }

  // donut([{ name, n, color }], { center: '28.4%', sub: 'returning', fmt, unit, max: 6 }) — เกิน max รายการรวมเป็น "อื่น ๆ"
  var PAL = ['#16a34a', '#f97316', '#eab308', '#ef4444', '#14b8a6', '#6366f1', '#ec4899', '#0ea5e9', '#a855f7', '#84cc16'];
  function donut(parts, o) {
    o = o || {};
    var list = (parts || []).filter(function (p) { return Number(p.n) > 0; }).map(function (p, i) { return { name: p.name, n: +p.n, color: p.color || PAL[i % PAL.length] }; });
    if (!list.length) return '<div class="muted">' + esc(o.empty || 'ไม่มีข้อมูล') + '</div>';
    var mx = o.max || 6;
    if (list.length > mx) { var rest = list.slice(mx - 1); list = list.slice(0, mx - 1).concat([{ name: 'อื่น ๆ (' + rest.length + ')', n: rest.reduce(function (s, p) { return s + p.n; }, 0), color: '#94a3b8' }]); }
    var tot = list.reduce(function (s, p) { return s + p.n; }, 0), R = 42, C = 2 * Math.PI * R, off = 0, gap = list.length > 1 ? 1.6 : 0, f = o.fmt || fmtN;
    var svg = '<svg class="dnut-svg" viewBox="0 0 120 120" role="img" aria-label="' + esc(o.title || '') + '"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="#f1f5f9" stroke-width="15"/>';
    list.forEach(function (p) {
      var len = Math.max(0, p.n / tot * C - gap);
      svg += '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + p.color + '" stroke-width="15" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"><title>' + esc(p.name + ': ' + f(p.n) + (o.unit || '') + ' (' + Math.round(p.n / tot * 100) + '%)') + '</title></circle>';
      off += p.n / tot * C;
    });
    svg += '<circle cx="60" cy="60" r="31" fill="#fff"/><text x="60" y="' + (o.sub ? 60 : 65) + '" text-anchor="middle" class="dnut-c">' + esc(o.center != null ? o.center : f(tot)) + '</text>'
      + (o.sub ? '<text x="60" y="76" text-anchor="middle" class="dnut-s">' + esc(o.sub) + '</text>' : '') + '</svg>';
    var leg = '<div class="dnut-leg">' + list.map(function (p) {
      return '<div><i style="background:' + p.color + '"></i><span>' + esc(p.name) + '</span><b>' + Math.round(p.n / tot * 100) + '%</b>' + (o.showN === false ? '' : '<small>' + f(p.n) + (o.unit || '') + '</small>') + '</div>';
    }).join('') + '</div>';
    return '<div class="dnut">' + svg + leg + '</div>';
  }

  // delta(ตอนนี้, ก่อนหน้า, { good: 'up' | 'down', pct: true, unit, label }) → ป้าย ↑ 3.9% (เขียว = ดีขึ้น · แดง = แย่ลง)
  function delta(cur, prev, o) {
    o = o || {};
    if (prev == null || cur == null || !isFinite(prev) || !isFinite(cur)) return '';
    var d = cur - prev; if (Math.abs(d) < 1e-9) return '<span class="dpill flat">= เท่าเดิม' + (o.label ? ' ' + esc(o.label) : '') + '</span>';
    var good = (o.good || 'up') === 'up' ? d > 0 : d < 0, txt;
    if (o.pct === false || !prev) txt = (d > 0 ? '+' : '−') + fmtN(Math.abs(d)) + (o.unit || '');
    else txt = Math.abs(Math.round(d / Math.abs(prev) * 1000) / 10) + '%';
    return '<span class="dpill ' + (good ? 'good' : 'bad') + '">' + (d > 0 ? '↑ ' : '↓ ') + txt + (o.label ? ' ' + esc(o.label) : '') + '</span>';
  }

  window.DCH = { area: area, donut: donut, delta: delta, short: short };

  var css = document.createElement('style');
  css.textContent = [
    '.dch{width:100%;padding-left:34px}.dch-plot{position:relative}.dch-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}',
    '.dch-gl{position:absolute;left:0;right:0;border-top:1px solid #eef1f5}.dch-gl span{position:absolute;right:calc(100% + 8px);top:-9px;font-size:11.5px;color:#94a3b8;white-space:nowrap}',
    '.dch-tg{position:absolute;left:0;right:0;border-top:1.5px dashed #94a3b8;z-index:1}.dch-tg span{position:absolute;left:4px;top:-19px;font-size:11.5px;font-weight:600;color:#64748b;background:rgba(255,255,255,.85);padding:0 4px;border-radius:4px}',
    '.dch-pt{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#fff;border:2px solid;z-index:2;font-style:normal}.dch-pt.big{width:14px;height:14px;margin:-7px 0 0 -7px;border-width:3px;z-index:4}',
    '.dch-drop{position:absolute;bottom:0;width:0;border-left:1.5px dashed #cbd5e1;z-index:1}.dch-drop{height:auto}',
    '.dch-call{position:absolute;z-index:5;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px 12px;box-shadow:0 6px 16px rgba(15,23,42,.12);white-space:nowrap;pointer-events:none}.dch-call small{display:block;font-size:11.5px;color:#64748b;line-height:1.3}.dch-call b{display:block;font-size:16px;color:#0f172a;line-height:1.3}',
    '.dch-col{position:absolute;top:0;bottom:0;z-index:3;cursor:default}.dch-col:hover{background:rgba(148,163,184,.08)}',
    '.dch-x{position:relative;height:22px;margin-top:6px}.dch-x span{position:absolute;transform:translateX(-50%);font-size:11.5px;color:#94a3b8;white-space:nowrap}.dch-x span:first-child{transform:none}.dch-x span:last-child{transform:translateX(-100%)}',
    '.dch-leg{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:13px;color:#475569}.dch-leg span{display:inline-flex;align-items:center;gap:6px}.dch-leg i{width:10px;height:10px;border-radius:50%;display:inline-block}.dch-leg i.dch-ti{width:16px;height:0;border-top:2px dashed #94a3b8;border-radius:0}',
    '.dnut{display:flex;align-items:center;gap:20px;flex-wrap:wrap}.dnut-svg{width:168px;height:168px;flex:none}.dnut-c{font-size:16px;font-weight:700;fill:#0f172a;font-family:inherit}.dnut-s{font-size:9px;fill:#64748b;font-family:inherit}',
    '.dnut-leg{flex:1;min-width:180px;display:flex;flex-direction:column;gap:8px}.dnut-leg div{display:grid;grid-template-columns:12px 1fr auto;gap:2px 10px;align-items:center;font-size:14px}.dnut-leg i{width:11px;height:11px;border-radius:50%}.dnut-leg b{font-weight:700}.dnut-leg small{grid-column:2/-1;color:#94a3b8;font-size:12px;margin-top:-3px}',
    '.dpill{display:inline-flex;align-items:center;gap:2px;font-size:12.5px;font-weight:700;padding:2px 9px;border-radius:99px;white-space:nowrap;vertical-align:middle}.dpill.good{background:#dcfce7;color:#15803d}.dpill.bad{background:#fee2e2;color:#b91c1c}.dpill.flat{background:#f1f5f9;color:#475569}',
    '.dch-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:-4px 0 6px}.dch-head b{font-size:30px;font-weight:700;letter-spacing:-.01em;color:#0f172a}.dch-head span{color:#64748b;font-size:14px}',
    '.dch-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9}.dch-stats b{display:block;font-size:20px;font-weight:700;color:#0f172a}.dch-stats span{font-size:12.5px;color:#64748b}',
    '@media (max-width:560px){.dnut-svg{width:140px;height:140px}.dch-head b{font-size:24px}}'
  ].join('\n');
  document.head.appendChild(css);
})();
