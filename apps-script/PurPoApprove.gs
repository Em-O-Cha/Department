// ==================== จัดซื้อ: ขออนุมัติ PO ทาง LINE (ผู้ใช้ขอ 24/11/69) ====================
// ขั้นตอน: แนบ PDF ใบสั่งซื้อจาก PEAK → หน้าเว็บวางลายเซ็นผู้ออกเอกสาร (ลายเซ็นเนย) ให้ดูตัวอย่าง → ส่งเข้ากลุ่ม LINE (บอทของฝ่ายจัดซื้อเอง)
// → พี่เก้ (ผู้มีสิทธิ์อนุมัติที่ผูกบัญชี LINE ไว้) กด "อนุมัติ" → ระบบเปิดไฟล์ PO ที่มีลายเซ็นพี่เก้แล้ว ตอบกลับในกลุ่ม + แนบเข้าใบ PO ในระบบ
// → หน้าจัดซื้อขึ้น "อนุมัติใหม่ · ยังไม่เปิดดู" ให้เปิดไฟล์และยืนยันวันที่จัดส่งอีกครั้ง
// ไฟล์ 2 แบบสร้างในเบราว์เซอร์ตอนส่ง: pdf1 = ลายเซ็นเนย (แชร์ให้ดูในกลุ่ม) · pdf2 = ลายเซ็นเนย + พี่เก้ (เป็นส่วนตัว จนกว่าจะกดอนุมัติ)
// Script Properties: PUR_LINE_TOKEN · PUR_LINE_GROUP · PUR_LINE_SETUP (รหัสผูกกลุ่ม) · PUR_LINE_APPROVERS [{userId, name, addedAt}]
//                    PUR_LINE_APPR_CODE {code, exp} · PUR_SIGS {buyer: {id, label}, ceo: {id, label}}

var PURPO_COLS_ = [['id', 'รหัส'], ['docId', 'รหัสใบ PO'], ['docNo', 'เลขที่ PO'], ['vendorName', 'ผู้ขาย'], ['total', 'ยอดรวม'], ['status', 'สถานะ'],
  ['sentAt', 'ส่งขออนุมัติเมื่อ'], ['sentBy', 'ผู้ส่ง'], ['pdf1', 'ไฟล์ PO (ลายเซ็นผู้ออกเอกสาร)'], ['pdf2', 'ไฟล์ PO (อนุมัติแล้ว)'], ['img', 'ภาพตัวอย่าง'],
  ['decidedAt', 'อนุมัติ / ไม่อนุมัติเมื่อ'], ['decidedBy', 'ผู้อนุมัติ'], ['seenAt', 'จัดซื้อเปิดดูเมื่อ'], ['deliveryDate', 'วันที่จัดส่ง (ยืนยันหลังอนุมัติ)'],
  ['confirmedAt', 'ยืนยันวันส่งเมื่อ'], ['note', 'หมายเหตุ']];
var PURPO_ST_ = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', replaced: 'ส่งใหม่แล้ว' };
function purPoReg_() { if (!PUR_TABLES_.po_approvals) PUR_TABLES_.po_approvals = { tab: 'ขออนุมัติ PO (LINE)', cols: PURPO_COLS_ }; }
function purPoDept_() { return DEPARTMENTS.filter(function (x) { return x.key === 'PUR'; })[0]; }
function purPoTok_() { return props_().getProperty('PUR_LINE_TOKEN') || ''; }
function purPoJson_(k, def) { try { var v = props_().getProperty(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function purPoApprovers_() { var a = purPoJson_('PUR_LINE_APPROVERS', []); return Array.isArray(a) ? a : []; }
function purPoUrl_(id) { return id ? 'https://drive.google.com/file/d/' + id + '/view' : ''; }
function purPoDay_(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + String(Number(m[1]) + 543).slice(-2) : '-'; }

// ---------- LINE ----------
function purPoBot_(token) {
  if (!token) return null;
  var c = CacheService.getScriptCache(), k = 'pur_bot_' + lineTokKey_(token), v = c.get(k);
  if (v) return JSON.parse(v);
  var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var j = JSON.parse(r.getContentText()), o = { userId: j.userId || '', name: j.displayName || '' };
  c.put(k, JSON.stringify(o), 21600);
  return o;
}
function purIsMyBot_(destination) {
  try { var b = destination && purPoBot_(purPoTok_()); return !!(b && b.userId === destination); } catch (e) { return false; }
}
function purPoReply_(replyToken, messages) {
  var token = purPoTok_(); if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ replyToken: replyToken, messages: messages.slice(0, 5) }) });
}
function purPoText_(t) { return { type: 'text', text: String(t).slice(0, 4900) }; }
function purPoPush_(messages) {
  var token = purPoTok_(), to = props_().getProperty('PUR_LINE_GROUP');
  if (!token) return { ok: false, error: 'ยังไม่ได้ใส่ Token ของบอท LINE ฝ่ายจัดซื้อ (ตั้งค่าในหน้า "ขออนุมัติ PO")' };
  if (!to) return { ok: false, error: 'ยังไม่ได้ผูกกลุ่ม LINE ที่จะส่งขออนุมัติ (ตั้งค่าในหน้า "ขออนุมัติ PO")' };
  for (var i = 0; i < messages.length; i += 5) {
    var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ to: to, messages: messages.slice(i, i + 5) }) });
    if (r.getResponseCode() !== 200) {
      var msg = ''; try { msg = JSON.parse(r.getContentText()).message || ''; } catch (e) {}
      return { ok: false, error: 'ส่ง LINE ไม่สำเร็จ (' + r.getResponseCode() + ')' + (msg ? ': ' + msg : '') };
    }
  }
  return { ok: true };
}
function purPoGroupName_(gid) {
  var token = purPoTok_(); if (!token || !gid) return '';
  try {
    var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + encodeURIComponent(gid) + '/summary', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).groupName || '' : '';
  } catch (e) { return ''; }
}
function purPoMemberName_(gid, uid) {
  var token = purPoTok_();
  try {
    var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + encodeURIComponent(gid) + '/member/' + encodeURIComponent(uid), { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).displayName || '' : '';
  } catch (e) { return ''; }
}

// ---------- ไฟล์ใน Drive ----------
// โฟลเดอร์ของฝ่ายจัดซื้อ (บัญชีฝ่าย) → ถ้าแชร์ลิงก์ไม่ได้ ย้ายไปไว้ Drive ของบัญชีสคริปต์ (เหมือนรูปเช็คพนักงานของ HR)
function purPoSub_(dept, name) {
  var fid = deptConfig_(dept.key).folderId;
  if (!fid) throw new Error('ผู้ดูแลระบบยังไม่ได้ตั้งโฟลเดอร์ของฝ่ายจัดซื้อ');
  var parent = DriveApp.getFolderById(fid), it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function purPoFallback_() {
  var name = 'ขออนุมัติ PO (ฝ่ายจัดซื้อ)', it = DriveApp.getRootFolder().getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(name);
}
function purPoShare_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return file; }
  catch (e) {
    var copy = file.makeCopy(file.getName(), purPoFallback_());
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    try { file.setTrashed(true); } catch (e2) {}
    return copy;
  }
}
function purPoSave_(dept, blob, share) {
  var f = purPoSub_(dept, 'ขออนุมัติ PO (LINE)').createFile(blob);
  return share ? purPoShare_(f) : f;
}
function purPoB64Blob_(b64, mime, name, maxMb) {
  var bytes = Utilities.base64Decode(String(b64 || '').replace(/^data:[^,]+,/, ''));
  if (!bytes.length || bytes.length > (maxMb || 15) * 1024 * 1024) throw new Error('ไฟล์ว่างหรือใหญ่เกิน ' + (maxMb || 15) + ' MB');
  return Utilities.newBlob(bytes, mime, name);
}

// ---------- หน้าตั้งค่า ----------
function purPoInfo(token) {
  requirePur_(token);
  var tok = purPoTok_(), bot = null; try { bot = purPoBot_(tok); } catch (e) {}
  var gid = props_().getProperty('PUR_LINE_GROUP') || '', sigs = purPoJson_('PUR_SIGS', {}), code = purPoJson_('PUR_LINE_APPR_CODE', null);
  return { ok: true, hasToken: !!tok, tokenOk: !!bot, botName: bot ? bot.name : '', webhookUrl: ScriptApp.getService().getUrl(),
    group: !!gid, groupName: gid ? purPoGroupName_(gid) : '', bindCmd: 'ตั้งค่ากลุ่ม จัดซื้อ ' + hrProp_('PUR_LINE_SETUP', hrSetupCode_),
    approvers: purPoApprovers_().map(function (a) { return { userId: a.userId, name: a.name, addedAt: a.addedAt }; }),
    apprCode: code && code.exp > Date.now() ? { cmd: 'ขอสิทธิ์อนุมัติ PO ' + code.code, left: Math.round((code.exp - Date.now()) / 1000) } : null,
    sigs: { buyer: sigs.buyer ? { label: sigs.buyer.label, has: true } : { label: 'ลายเซ็นเนย', has: false },
      ceo: sigs.ceo ? { label: sigs.ceo.label, has: true } : { label: 'ลายเซ็นพี่เก้', has: false } } };
}
function purPoSetToken(token, newTok) {
  requirePur_(token);
  newTok = String(newTok || '').trim();
  if (!newTok) { props_().deleteProperty('PUR_LINE_TOKEN'); props_().deleteProperty('PUR_LINE_GROUP'); return { ok: true, removed: true }; }
  var bot = purPoBot_(newTok);
  if (!bot) return { ok: false, error: 'Token ใช้ไม่ได้ — คัดลอก Channel access token (long-lived) จาก LINE Developers ใหม่อีกครั้ง' };
  var others = [['ACC_LINE_TOKEN', 'ฝ่ายบัญชี'], ['PROD_LINE_TOKEN', 'ฝ่ายผลิต'], ['HR_LINE_TOKEN', 'ฝ่ายบุคคล']];
  for (var i = 0; i < others.length; i++) {
    var t = props_().getProperty(others[i][0]), b = null;
    try { b = t ? purPoBot_(t) : null; } catch (e) {}
    if (b && b.userId === bot.userId) return { ok: false, error: 'บอทนี้ใช้กับ' + others[i][1] + 'อยู่แล้ว — ใช้บอทใหม่ของฝ่ายจัดซื้อ' };
  }
  var old = null; try { old = purPoBot_(purPoTok_()); } catch (e) {}
  props_().setProperty('PUR_LINE_TOKEN', newTok);
  if (!old || old.userId !== bot.userId) { props_().deleteProperty('PUR_LINE_GROUP'); props_().deleteProperty('PUR_LINE_APPROVERS'); }
  return { ok: true, botName: bot.name };
}
function purPoTest(token) {
  requirePur_(token);
  return purPoPush_([purPoText_('✅ ทดสอบการเชื่อมต่อ: ระบบจัดซื้อจะส่งใบสั่งซื้อ (PO) ขออนุมัติเข้ากลุ่มนี้')]);
}
function purPoApproverCode(token) {
  requirePur_(token);
  var code = hrSetupCode_().slice(0, 6), exp = Date.now() + 5 * 60 * 1000;
  props_().setProperty('PUR_LINE_APPR_CODE', JSON.stringify({ code: code, exp: exp }));
  return { ok: true, cmd: 'ขอสิทธิ์อนุมัติ PO ' + code, left: 300 };
}
function purPoRemoveApprover(token, userId) {
  var dept = requirePur_(token), list = purPoApprovers_(), gone = list.filter(function (a) { return a.userId === userId; })[0];
  props_().setProperty('PUR_LINE_APPROVERS', JSON.stringify(list.filter(function (a) { return a.userId !== userId; })));
  if (gone) { purPoReg_(); purLogWrite_(purBook_(dept), 'ลบสิทธิ์อนุมัติ PO ทาง LINE', 'po_approvals', '', gone.name); }
  return { ok: true, approvers: purPoApprovers_() };
}
// ลายเซ็น: รูป PNG พื้นใส (หน้าเว็บตัดพื้นขาวให้แล้ว) เก็บเป็นไฟล์ส่วนตัวในโฟลเดอร์ฝ่าย
function purPoSaveSig(token, role, b64, label) {
  var dept = requirePur_(token);
  if (role !== 'buyer' && role !== 'ceo') return { ok: false, error: 'ไม่รู้ว่าเป็นลายเซ็นของใคร' };
  var sigs = purPoJson_('PUR_SIGS', {}), name = purClean_(label, 40) || (role === 'buyer' ? 'ลายเซ็นเนย' : 'ลายเซ็นพี่เก้');
  var f = purPoSub_(dept, 'ลายเซ็น (อนุมัติ PO)').createFile(purPoB64Blob_(b64, 'image/png', name + '.png', 2));
  if (sigs[role] && sigs[role].id) { try { DriveApp.getFileById(sigs[role].id).setTrashed(true); } catch (e) {} }
  sigs[role] = { id: f.getId(), label: name };
  props_().setProperty('PUR_SIGS', JSON.stringify(sigs));
  purPoReg_(); purLogWrite_(purBook_(dept), 'อัปโหลดลายเซ็น', 'po_approvals', '', name);
  return { ok: true };
}
function purPoSigs(token) {
  requirePur_(token);
  var sigs = purPoJson_('PUR_SIGS', {}), out = {};
  ['buyer', 'ceo'].forEach(function (r) {
    if (!sigs[r]) return;
    try { out[r] = { label: sigs[r].label, data: 'data:image/png;base64,' + Utilities.base64Encode(DriveApp.getFileById(sigs[r].id).getBlob().getBytes()) }; } catch (e) {}
  });
  return { ok: true, sigs: out };
}
// PDF ที่แนบไว้ในใบ PO (ใช้วางลายเซ็นในหน้าเว็บ) — เฉพาะไฟล์ที่อยู่ในรายการแนบของใบนั้น
function purPoFile(token, docId, fileId) {
  var dept = requirePur_(token), ss = purBook_(dept);
  var doc = purRead_(ss, 'docs').filter(function (x) { return x.id === docId; })[0];
  if (!doc || !purParseFiles_(doc.files).some(function (f) { return f.id === fileId; })) return { ok: false, error: 'ไม่พบไฟล์ในใบนี้' };
  var b = DriveApp.getFileById(fileId).getBlob();
  if (b.getContentType() !== 'application/pdf') return { ok: false, error: 'ไฟล์นี้ไม่ใช่ PDF' };
  return { ok: true, b64: Utilities.base64Encode(b.getBytes()), name: b.getName() };
}

// ---------- ส่งขออนุมัติ ----------
// f = { pdf1, pdf2 (base64 PDF), img (base64 JPEG หน้าแรกที่มีลายเซ็นเนย), ratio, total, sentBy, note }
function purPoSend(token, docId, f) {
  var dept = requirePur_(token); f = f || {};
  if (!purPoApprovers_().length) return { ok: false, error: 'ยังไม่มีผู้มีสิทธิ์กดอนุมัติ — ให้พี่เก้ขอสิทธิ์ในกลุ่ม LINE ก่อน (หน้า "ขออนุมัติ PO" → ตั้งค่า)' };
  if (!purPoTok_() || !props_().getProperty('PUR_LINE_GROUP')) return purPoPush_([]);
  purPoReg_();
  var ss = purBook_(dept), doc = purRead_(ss, 'docs').filter(function (x) { return x.id === docId; })[0];
  if (!doc || doc.type !== 'PO') return { ok: false, error: 'ไม่พบใบ PO' };
  var items = purRead_(ss, 'docItems').filter(function (x) { return x.docId === docId; }).sort(function (a, b) { return (Number(a.line) || 0) - (Number(b.line) || 0); });
  var safe = String(doc.docNo || doc.id).replace(/[\\/:*?"<>|]/g, '_'), now = purNow_();
  var p1 = purPoSave_(dept, purPoB64Blob_(f.pdf1, 'application/pdf', safe + '_ขออนุมัติ.pdf'), true);
  var p2 = purPoSave_(dept, purPoB64Blob_(f.pdf2, 'application/pdf', safe + '_อนุมัติแล้ว.pdf'), false);
  var im = f.img ? purPoSave_(dept, purPoB64Blob_(f.img, 'image/jpeg', safe + '_ตัวอย่าง.jpg', 8), true) : null;
  var rec = purLocked_(function () {
    var list = purRead_(ss, 'po_approvals');
    list.filter(function (r) { return r.docId === docId && r.status === 'pending'; }).forEach(function (r) { r.status = 'replaced'; r.decidedAt = now; purWrite_(ss, 'po_approvals', r); });
    var o = { id: purId_('PA'), docId: docId, docNo: doc.docNo, vendorName: doc.vendorName, total: Number(f.total) || Number(doc.total) || '', status: 'pending',
      sentAt: now, sentBy: purClean_(f.sentBy, 60), pdf1: p1.getId(), pdf2: p2.getId(), img: im ? im.getId() : '', note: purClean_(f.note, 300) };
    purWrite_(ss, 'po_approvals', o);
    var files = purParseFiles_(doc.files);
    files.push({ id: p1.getId(), name: p1.getName(), mime: 'application/pdf', label: 'PO ส่งขออนุมัติ (ลายเซ็นผู้ออกเอกสาร)', url: purPoUrl_(p1.getId()), at: now });
    doc.files = JSON.stringify(files); doc.updatedAt = now; purWrite_(ss, 'docs', doc);
    purLogWrite_(ss, 'ส่งขออนุมัติ PO ทาง LINE', 'po_approvals', o.id, doc.docNo + ' · ' + (doc.vendorName || ''));
    return o;
  });
  var msgs = [];
  if (im) msgs.push({ type: 'image', originalContentUrl: 'https://lh3.googleusercontent.com/d/' + im.getId(), previewImageUrl: 'https://lh3.googleusercontent.com/d/' + im.getId() + '=w600' });
  msgs.push(purPoFlex_(rec, doc, items, 'pending'));
  var r = purPoPush_(msgs);
  if (!r.ok) return r;
  return { ok: true, approval: rec };
}

// ---------- การ์ด LINE ----------
function purPoRow_(k, v, bold, color) {
  return { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
    { type: 'text', text: k, size: 'sm', color: '#64748B', flex: 3 },
    { type: 'text', text: String(v == null || v === '' ? '-' : v), size: 'sm', color: color || '#0F172A', weight: bold ? 'bold' : 'regular', flex: 7, wrap: true }] };
}
function purPoMoney_(n) { return n === '' || n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท'; }
function purPoFlex_(rec, doc, items, kind, by) {
  var head = kind === 'approved' ? ['#16A34A', '✅ อนุมัติใบสั่งซื้อแล้ว'] : kind === 'rejected' ? ['#DC2626', '✕ ไม่อนุมัติใบสั่งซื้อ'] : ['#D97706', '📝 ขออนุมัติใบสั่งซื้อ (PO)'];
  var body = [purPoRow_('ผู้ขาย', rec.vendorName || doc.vendorName, true), purPoRow_('วันที่ออก', purPoDay_(doc.orderDate)), purPoRow_('กำหนดส่ง', purPoDay_(doc.deliveryDate))];
  if (items && items.length) {
    body.push({ type: 'separator', margin: 'md' });
    items.slice(0, 5).forEach(function (it, i) {
      body.push({ type: 'box', layout: 'horizontal', spacing: 'sm', margin: i ? 'sm' : 'md', contents: [
        { type: 'text', text: (i + 1) + '. ' + (it.materialName || '-'), size: 'sm', color: '#334155', wrap: true, flex: 7 },
        { type: 'text', text: (Number(it.qty) || 0).toLocaleString('en-US') + ' ' + (it.unit || ''), size: 'sm', color: '#334155', align: 'end', flex: 3 }] });
    });
    if (items.length > 5) body.push({ type: 'text', text: 'และอีก ' + (items.length - 5) + ' รายการ (ดูในไฟล์ PO)', size: 'xs', color: '#64748B', margin: 'sm' });
    body.push({ type: 'separator', margin: 'md' });
  }
  body.push({ type: 'box', layout: 'horizontal', margin: 'md', contents: [
    { type: 'text', text: 'ยอดรวม', size: 'md', weight: 'bold', color: '#0F172A' },
    { type: 'text', text: purPoMoney_(rec.total), size: 'lg', weight: 'bold', color: head[0], align: 'end' }] });
  if (rec.sentBy) body.push(purPoRow_('ผู้ออกเอกสาร', rec.sentBy));
  if (kind !== 'pending' && by) body.push(purPoRow_(kind === 'approved' ? 'อนุมัติโดย' : 'โดย', by + ' · ' + purPoDay_(String(rec.decidedAt).slice(0, 10)) + ' ' + String(rec.decidedAt).slice(11, 16) + ' น.', true, head[0]));
  if (kind === 'approved') body.push({ type: 'text', text: 'ฝ่ายจัดซื้อ: เปิดไฟล์ PO ที่อนุมัติแล้ว และยืนยันวันที่จัดส่งในระบบ', size: 'xs', color: '#16A34A', wrap: true, margin: 'md' });
  var foot = [];
  if (kind === 'pending') {
    foot.push({ type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
      { type: 'button', style: 'primary', color: '#16A34A', height: 'sm', action: { type: 'postback', label: '✓ อนุมัติ', data: 'poa|' + rec.id + '|ok', displayText: 'อนุมัติ PO ' + rec.docNo } },
      { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '✕ ไม่อนุมัติ', data: 'poa|' + rec.id + '|no', displayText: 'ไม่อนุมัติ PO ' + rec.docNo } }] });
    foot.push({ type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label: '📄 เปิดไฟล์ PO (PDF)', uri: purPoUrl_(rec.pdf1) } });
  } else if (kind === 'approved') {
    foot.push({ type: 'button', style: 'primary', color: '#16A34A', height: 'sm', action: { type: 'uri', label: '📄 เปิด PO ที่อนุมัติแล้ว', uri: purPoUrl_(rec.pdf2) } });
  }
  var bubble = { type: 'bubble', size: 'mega',
    header: { type: 'box', layout: 'vertical', backgroundColor: head[0], paddingAll: '16px', contents: [
      { type: 'text', text: head[1], color: '#FFFFFF', size: 'sm', weight: 'bold' },
      { type: 'text', text: String(rec.docNo || doc.docNo || ''), color: '#FFFFFF', size: 'xl', weight: 'bold', margin: 'sm' }] },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body } };
  if (foot.length) bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', contents: foot };
  return { type: 'flex', altText: head[1].replace(/^\S+\s/, '') + ' ' + (rec.docNo || '') + ' · ' + (rec.vendorName || '') + ' · ' + purPoMoney_(rec.total), contents: bubble };
}

// ---------- Webhook (doPost ส่งมาเมื่อ destination = บอทฝ่ายจัดซื้อ) ----------
function purLineWebhook_(events) {
  (events || []).forEach(function (ev) {
    try {
      var src = ev.source || {}, gid = src.groupId || '', bound = props_().getProperty('PUR_LINE_GROUP') || '';
      if (ev.type === 'join') return;   // ไม่ทักทาย
      if (ev.type === 'leave') { if (gid && gid === bound) props_().deleteProperty('PUR_LINE_GROUP'); return; }
      if (ev.type === 'postback') { purPoPostback_(ev, gid, bound); return; }
      if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
      var text = String(ev.message.text).trim(), m;
      if ((m = text.match(/^ตั้งค่ากลุ่ม\s*(?:จัดซื้อ|PUR)\s+([A-Z0-9]{8})$/i))) {
        if (!gid) return purPoReply_(ev.replyToken, [purPoText_('พิมพ์คำสั่งนี้ในกลุ่ม LINE ที่จะรับใบขออนุมัติ PO (ไม่ใช่แชทส่วนตัว)')]);
        hrRate_('purbind', 10, 3600);
        if (m[1].toUpperCase() !== hrProp_('PUR_LINE_SETUP', hrSetupCode_)) return purPoReply_(ev.replyToken, [purPoText_('รหัสไม่ถูกต้อง (ใช้ได้ครั้งเดียว) — คัดลอกคำสั่งล่าสุดจากหน้า "ขออนุมัติ PO" อีกครั้ง')]);
        props_().setProperty('PUR_LINE_GROUP', gid);
        props_().setProperty('PUR_LINE_SETUP', hrSetupCode_());
        return purPoReply_(ev.replyToken, [purPoText_('✅ ตั้งกลุ่มนี้เป็นกลุ่มขออนุมัติใบสั่งซื้อ (PO) ของฝ่ายจัดซื้อแล้ว')]);
      }
      if ((m = text.match(/^ขอสิทธิ์อนุมัติ\s*PO\s+([A-Z0-9]{6})$/i))) {
        if (!gid || gid !== bound) return purPoReply_(ev.replyToken, [purPoText_('พิมพ์คำสั่งนี้ในกลุ่มที่ผูกไว้สำหรับขออนุมัติ PO')]);
        hrRate_('purappr', 10, 3600);
        var c = purPoJson_('PUR_LINE_APPR_CODE', null);
        if (!c || c.exp < Date.now() || m[1].toUpperCase() !== c.code) return purPoReply_(ev.replyToken, [purPoText_('รหัสหมดอายุหรือไม่ถูกต้อง — กด "เพิ่มผู้อนุมัติ" ในระบบเพื่อขอรหัสใหม่ (ใช้ได้ 5 นาที)')]);
        props_().deleteProperty('PUR_LINE_APPR_CODE');
        var uid = src.userId || '', name = purPoMemberName_(gid, uid) || 'ผู้อนุมัติ';
        if (!uid) return purPoReply_(ev.replyToken, [purPoText_('อ่านบัญชี LINE ไม่ได้ — ลองใหม่อีกครั้ง')]);
        var list = purPoApprovers_().filter(function (a) { return a.userId !== uid; });
        list.push({ userId: uid, name: name, addedAt: purNow_() });
        props_().setProperty('PUR_LINE_APPROVERS', JSON.stringify(list));
        try { purPoReg_(); purLogWrite_(purBook_(purPoDept_()), 'เพิ่มผู้มีสิทธิ์อนุมัติ PO ทาง LINE', 'po_approvals', '', name); } catch (e) {}
        return purPoReply_(ev.replyToken, [purPoText_('✅ ' + name + ' กดอนุมัติ / ไม่อนุมัติ PO ในกลุ่มนี้ได้แล้ว')]);
      }
    } catch (err) { Logger.log('purLineWebhook_ ' + err); }
  });
}
function purPoPostback_(ev, gid, bound) {
  var p = String((ev.postback || {}).data || '').split('|');
  if (p[0] !== 'poa' || !p[1]) return;
  var uid = (ev.source || {}).userId || '', who = purPoApprovers_().filter(function (a) { return a.userId === uid; })[0];
  if (!gid || gid !== bound) return purPoReply_(ev.replyToken, [purPoText_('การ์ดนี้ใช้ได้เฉพาะในกลุ่มขออนุมัติ PO ที่ผูกไว้')]);
  if (!who) return purPoReply_(ev.replyToken, [purPoText_('⛔ ' + (purPoMemberName_(gid, uid) || 'คุณ') + ' ไม่มีสิทธิ์อนุมัติ PO — PO ยังรออนุมัติอยู่')]);
  purPoReg_();
  var dept = purPoDept_(), ss = purBook_(dept), ok = p[2] === 'ok';
  var res = purLocked_(function () {
    var rec = purRead_(ss, 'po_approvals').filter(function (r) { return r.id === p[1]; })[0];
    if (!rec) return { text: 'ไม่พบรายการขออนุมัตินี้ในระบบ' };
    var doc = purRead_(ss, 'docs').filter(function (x) { return x.id === rec.docId; })[0] || {};
    var items = purRead_(ss, 'docItems').filter(function (x) { return x.docId === rec.docId; }).sort(function (a, b) { return (Number(a.line) || 0) - (Number(b.line) || 0); });
    if (rec.status === 'replaced') return { text: 'PO ' + rec.docNo + ' ถูกส่งขออนุมัติใหม่แล้ว — กดที่การ์ดล่าสุด' };
    if (rec.status !== 'pending') return { msg: purPoFlex_(rec, doc, items, rec.status, rec.decidedBy), pre: 'PO ' + rec.docNo + ' ' + PURPO_ST_[rec.status] + 'ไปแล้ว · กดซ้ำไม่ได้' };
    var now = purNow_();
    rec.status = ok ? 'approved' : 'rejected'; rec.decidedAt = now; rec.decidedBy = who.name;
    if (ok) {
      var f2 = purPoShare_(DriveApp.getFileById(rec.pdf2));
      rec.pdf2 = f2.getId();
      if (doc.id) {
        var files = purParseFiles_(doc.files);
        files.push({ id: f2.getId(), name: f2.getName(), mime: 'application/pdf', label: 'PO ที่อนุมัติ', url: purPoUrl_(f2.getId()), at: now });
        doc.files = JSON.stringify(files);
        if (!doc.status || doc.status === 'draft') doc.status = 'approved';
        doc.approvedBy = who.name; doc.approvedDate = now.slice(0, 10); doc.updatedAt = now;
        purWrite_(ss, 'docs', doc);
      }
    }
    purWrite_(ss, 'po_approvals', rec);
    purLogWrite_(ss, ok ? 'อนุมัติ PO ทาง LINE' : 'ไม่อนุมัติ PO ทาง LINE', 'po_approvals', rec.id, rec.docNo + ' · ' + who.name);
    return { msg: purPoFlex_(rec, doc, items, rec.status, who.name) };
  });
  var msgs = [];
  if (res.pre) msgs.push(purPoText_(res.pre));
  if (res.msg) msgs.push(res.msg); else msgs.push(purPoText_(res.text));
  purPoReply_(ev.replyToken, msgs);
}

// ---------- หน้า "ขออนุมัติ PO" ----------
function purPoOut_(r) {
  return { id: r.id, docId: r.docId, docNo: r.docNo, vendorName: r.vendorName, total: r.total, status: r.status, sentAt: r.sentAt, sentBy: r.sentBy,
    pdf1: purPoUrl_(r.pdf1), pdf2: r.status === 'approved' ? purPoUrl_(r.pdf2) : '', img: r.img ? 'https://lh3.googleusercontent.com/d/' + r.img : '',
    decidedAt: r.decidedAt, decidedBy: r.decidedBy, seenAt: r.seenAt, deliveryDate: r.deliveryDate, confirmedAt: r.confirmedAt, note: r.note };
}
function purPoList_(ss) { purPoReg_(); return purRead_(ss, 'po_approvals').map(purPoOut_).sort(function (a, b) { return String(b.sentAt).localeCompare(String(a.sentAt)); }); }
function purPoList(token) { var dept = requirePur_(token); return { ok: true, list: purPoList_(purBook_(dept)) }; }
function purPoSeen(token, id) {
  var dept = requirePur_(token); purPoReg_();
  return purLocked_(function () {
    var ss = purBook_(dept), r = purRead_(ss, 'po_approvals').filter(function (x) { return x.id === id; })[0];
    if (!r) return { ok: false, error: 'ไม่พบรายการ' };
    if (r.status === 'approved' && !r.seenAt) { r.seenAt = purNow_(); purWrite_(ss, 'po_approvals', r); }
    return { ok: true, item: purPoOut_(r) };
  });
}
// ยืนยันวันที่จัดส่งหลังได้ไฟล์ที่อนุมัติ → อัปเดตวันที่ส่งของในใบ PO ด้วย
function purPoConfirm(token, id, date, note) {
  var dept = requirePur_(token); purPoReg_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return { ok: false, error: 'เลือกวันที่จัดส่ง' };
  return purLocked_(function () {
    var ss = purBook_(dept), r = purRead_(ss, 'po_approvals').filter(function (x) { return x.id === id; })[0];
    if (!r || r.status !== 'approved') return { ok: false, error: 'ยืนยันได้เฉพาะ PO ที่อนุมัติแล้ว' };
    var now = purNow_();
    r.deliveryDate = date; r.confirmedAt = now; r.seenAt = r.seenAt || now; if (note != null) r.note = purClean_(note, 300);
    purWrite_(ss, 'po_approvals', r);
    var doc = purRead_(ss, 'docs').filter(function (x) { return x.id === r.docId; })[0];
    if (doc) { var old = doc.deliveryDate; doc.deliveryDate = date; doc.updatedAt = now; purWrite_(ss, 'docs', doc); purLogWrite_(ss, 'ยืนยันวันที่จัดส่งหลังอนุมัติ', 'docs', doc.id, doc.docNo + ' · ' + (old || '-') + ' → ' + date); }
    return { ok: true, item: purPoOut_(r) };
  });
}
