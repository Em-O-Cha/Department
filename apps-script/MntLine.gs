// ==================== ฝ่ายช่าง: แจ้งซ่อมผ่าน LINE / QR + การ์ดในกลุ่มช่าง (ผู้ใช้ขอ 28/11/69) ====================
// LINE OA ของฝ่ายช่างเอง (ผู้ใช้เลือก): Script Property MNT_LINE_TOKEN (วางในหน้าตั้งค่า) · กลุ่มช่าง MNT_LINE_GROUP (พิมพ์ "ตั้งค่ากลุ่ม ช่าง <รหัส>" ในกลุ่ม)
// แจ้งซ่อม: หน้า Department/repair.html — เปิดจาก QR (?k=<รหัสฟอร์ม>) หรือปุ่มเมนู LINE (LIFF: MNT_LIFF_ID → รู้บัญชี LINE ผู้แจ้ง แจ้งกลับตอนซ่อมเสร็จได้)
// การ์ดในกลุ่มช่าง: ✋ รับงาน (postback) · 🔧 อัปเดต / ปิดงาน (ลิงก์ repair.html?id=…&t=<ลายเซ็น> — ลิงก์อยู่ในกลุ่มช่างเท่านั้น)
// ซ่อมเสร็จ → ส่งการ์ดถึงผู้แจ้ง (ถ้าแจ้งผ่าน LINE) ให้กด ✓ ใช้งานได้แล้ว / ✕ ยังไม่หาย · ยังไม่หาย → กลับเป็นกำลังซ่อม + แจ้งกลุ่ม
var MNT_PAGE_ = 'https://em-o-cha.github.io/Department/repair.html';
function mntTok_() { return props_().getProperty('MNT_LINE_TOKEN') || ''; }
function mntGroup_() { return props_().getProperty('MNT_LINE_GROUP') || ''; }
function mntLiffId_() { return props_().getProperty('MNT_LIFF_ID') || ''; }
function mntFormKey_() { return hrProp_('MNT_FORM_KEY', function () { return hrRand_(12); }); }
function mntSign_(text) {
  var secret = hrProp_('MNT_SIGN_SECRET', function () { return hrRand_(32); });
  return Utilities.computeHmacSha256Signature(String(text), secret).slice(0, 8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function mntTechUrl_(id) { return MNT_PAGE_ + '?id=' + encodeURIComponent(id) + '&t=' + mntSign_('mt|' + id); }
function mntFormCheck_(key) {
  if (!key || String(key) !== mntFormKey_()) throw new Error('ลิงก์แจ้งซ่อมไม่ถูกต้อง หรือฝ่ายช่างเปลี่ยนลิงก์แล้ว — สแกน QR ใหม่');
  return mntOpenDept_();
}
function mntOpenDept_() {
  var dept = mntDept_();
  if (!dept || !deptConfig_('MNT').sheetId) throw new Error('ระบบฝ่ายช่างยังไม่พร้อม — แจ้งผู้ดูแลระบบ');
  return dept;
}
function mntDay_(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/); return m ? m[3] + '/' + m[2] + '/' + String(Number(m[1]) + 543).slice(-2) + (m[4] ? ' ' + m[4] + ':' + m[5] + ' น.' : '') : '-'; }

// ---------- LINE ----------
function mntBot_(token) {
  if (!token) return null;
  var c = CacheService.getScriptCache(), k = 'mnt_bot_' + lineTokKey_(token), v = c.get(k);
  if (v) return JSON.parse(v);
  var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var j = JSON.parse(r.getContentText()), o = { userId: j.userId || '', name: j.displayName || '' };
  c.put(k, JSON.stringify(o), 21600);
  return o;
}
function mntIsMyBot_(destination) {
  try { var t = mntTok_(), b = destination && t && mntBot_(t); return !!(b && b.userId === destination); } catch (e) { return false; }
}
function mntText_L_(t) { return { type: 'text', text: String(t).slice(0, 4900) }; }
function mntReply_(replyToken, messages) {
  var token = mntTok_(); if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ replyToken: replyToken, messages: messages.slice(0, 5) }) });
}
function mntPush_(to, messages) {
  var token = mntTok_();
  if (!token) return { ok: false, error: 'ยังไม่ได้ใส่ Token ของ LINE OA ฝ่ายช่าง (หน้า "ตั้งค่า & LINE")' };
  if (!to) return { ok: false, error: 'ยังไม่ได้ผูกกลุ่ม LINE ของช่าง (หน้า "ตั้งค่า & LINE")' };
  var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ to: to, messages: messages.slice(0, 5) }) });
  if (r.getResponseCode() !== 200) {
    var msg = ''; try { msg = JSON.parse(r.getContentText()).message || ''; } catch (e) {}
    return { ok: false, error: 'ส่ง LINE ไม่สำเร็จ (' + r.getResponseCode() + ')' + (msg ? ': ' + msg : '') };
  }
  return { ok: true };
}
function mntGroupName_(gid) {
  var token = mntTok_(); if (!token || !gid) return '';
  try {
    var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + encodeURIComponent(gid) + '/summary', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).groupName || '' : '';
  } catch (e) { return ''; }
}
function mntMemberName_(gid, uid) {
  var token = mntTok_(); if (!token || !uid) return '';
  try {
    var url = gid ? 'https://api.line.me/v2/bot/group/' + encodeURIComponent(gid) + '/member/' + encodeURIComponent(uid) : 'https://api.line.me/v2/bot/profile/' + encodeURIComponent(uid);
    var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).displayName || '' : '';
  } catch (e) { return ''; }
}
function mntSeenGroups_(cur) {
  var a = []; try { a = JSON.parse(props_().getProperty('MNT_SEEN_GROUPS') || '[]'); } catch (e) {}
  return a.filter(function (g) { return g && g.id; }).map(function (g) { return { id: g.id, name: mntGroupName_(g.id) || '(อ่านชื่อกลุ่มไม่ได้ — บอทอาจไม่อยู่ในกลุ่มแล้ว)', at: g.at, current: g.id === cur }; });
}
function mntNoteGroup_(gid, gone) {
  if (!gid) return;
  var a = []; try { a = JSON.parse(props_().getProperty('MNT_SEEN_GROUPS') || '[]'); } catch (e) {}
  a = a.filter(function (g) { return g && g.id && g.id !== gid; });
  if (!gone) a.unshift({ id: gid, at: purNow_() });
  props_().setProperty('MNT_SEEN_GROUPS', JSON.stringify(a.slice(0, 10)));
}

// ---------- การ์ด ----------
var MNT_URGC_ = { urgent: '#DC2626', high: '#EA580C', normal: '#475569', low: '#64748B' };
function mntRow_(k, v, color, bold) {
  return { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
    { type: 'text', text: k, size: 'sm', color: '#64748B', flex: 3 },
    { type: 'text', text: String(v || '-').slice(0, 300), size: 'sm', color: color || '#0F172A', flex: 7, wrap: true, weight: bold ? 'bold' : 'regular' }] };
}
// kind: new (แจ้งซ่อมใหม่) | reopen (ผู้แจ้งบอกยังไม่หาย) | done (ซ่อมเสร็จ — แจ้งกลุ่ม)
function mntRepairFlex_(r, kind) {
  var urg = MNT_URG_[r.urgency] ? r.urgency : 'normal', col = kind === 'done' ? '#16A34A' : kind === 'reopen' ? '#B91C1C' : MNT_URGC_[urg];
  var photos = purParseFiles_(kind === 'done' ? (r.afterPhotos && purParseFiles_(r.afterPhotos).length ? r.afterPhotos : r.photos) : r.photos);
  var title = kind === 'done' ? '✅ ซ่อมเสร็จแล้ว' : kind === 'reopen' ? '⚠️ ผู้แจ้งแจ้งว่ายังไม่หาย' : '🔧 แจ้งซ่อม' + (urg === 'urgent' ? ' · ด่วนมาก' : urg === 'high' ? ' · ด่วน' : '');
  var body = [
    { type: 'text', text: String(r.machineName || r.location || '-').slice(0, 120), weight: 'bold', size: 'lg', wrap: true, color: '#0F172A' },
    { type: 'text', text: String(r.problem || '').slice(0, 400), size: 'sm', wrap: true, color: '#334155', margin: 'sm' },
    { type: 'separator', margin: 'md' },
    { type: 'box', layout: 'vertical', spacing: 'xs', margin: 'md', contents: [
      mntRow_('อาคาร / จุด', [r.building, r.location && r.location !== r.machineName ? r.location : ''].filter(String).join(' · ')),
      mntRow_('ประเภท', r.category),
      mntRow_('ความเร่งด่วน', MNT_URG_[urg], MNT_URGC_[urg], true),
      mntRow_('ผู้แจ้ง', [r.reporter, r.reporterDept].filter(String).join(' · ') + (r.phone ? ' · ' + r.phone : '')),
      mntRow_('แจ้งเมื่อ', mntDay_(r.reportAt))].concat(
      r.stopLine === 'yes' ? [mntRow_('การผลิต', '⛔ กระทบการผลิต / เครื่องหยุด', '#DC2626', true)] : [],
      kind !== 'new' && r.assignee ? [mntRow_('ช่าง', r.assignee)] : [],
      kind === 'done' ? [mntRow_('สาเหตุ', r.cause), mntRow_('วิธีแก้', r.fix), mntRow_('เสร็จเมื่อ', mntDay_(r.doneAt))] : [],
      kind === 'reopen' && r.confirmNote ? [mntRow_('ผู้แจ้งบอกว่า', r.confirmNote, '#B91C1C', true)] : []) }];
  var footer = kind === 'done' ? [] : [
    kind === 'new' ? { type: 'button', style: 'primary', color: col, height: 'sm', action: { type: 'postback', label: '✋ รับงาน', data: 'mnt|' + r.id + '|take', displayText: 'รับงาน ' + r.code } } : null,
    { type: 'button', style: kind === 'new' ? 'secondary' : 'primary', color: kind === 'new' ? undefined : col, height: 'sm', action: { type: 'uri', label: '🔧 อัปเดต / ปิดงาน', uri: mntTechUrl_(r.id) } }].filter(Boolean);
  var bubble = { type: 'bubble', size: 'mega',
    header: { type: 'box', layout: 'vertical', backgroundColor: col, paddingAll: '14px', contents: [
      { type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'md' },
      { type: 'text', text: (r.code || '') + (r.category ? ' · ' + r.category : ''), color: '#FFFFFFCC', size: 'xs', margin: 'xs' }] },
    body: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: body } };
  if (photos.length) bubble.hero = { type: 'image', url: photos[0].url, size: 'full', aspectRatio: '4:3', aspectMode: 'cover', action: { type: 'uri', uri: photos[0].url } };
  if (footer.length) bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: footer };
  return { type: 'flex', altText: (kind === 'done' ? '✅ ซ่อมเสร็จ ' : kind === 'reopen' ? '⚠️ ยังไม่หาย ' : '🔧 แจ้งซ่อม ') + (r.code || '') + ' ' + String(r.machineName || r.location || '').slice(0, 60), contents: bubble };
}
// ถึงผู้แจ้ง: ซ่อมเสร็จแล้ว ให้ตรวจรับ
function mntConfirmFlex_(r) {
  return { type: 'flex', altText: '✅ งานแจ้งซ่อม ' + r.code + ' ซ่อมเสร็จแล้ว — กรุณาตรวจรับ', contents: { type: 'bubble',
    header: { type: 'box', layout: 'vertical', backgroundColor: '#16A34A', paddingAll: '14px', contents: [
      { type: 'text', text: '✅ ซ่อมเสร็จแล้ว', color: '#FFFFFF', weight: 'bold', size: 'md' },
      { type: 'text', text: r.code + ' · กรุณาตรวจรับงาน', color: '#FFFFFFCC', size: 'xs', margin: 'xs' }] },
    body: { type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'xs', contents: [
      { type: 'text', text: String(r.machineName || r.location || '-').slice(0, 120), weight: 'bold', size: 'md', wrap: true },
      { type: 'text', text: 'ที่แจ้ง: ' + String(r.problem || '').slice(0, 200), size: 'sm', wrap: true, color: '#475569', margin: 'sm' },
      mntRow_('ช่าง', r.assignee), mntRow_('วิธีแก้', r.fix), mntRow_('เสร็จเมื่อ', mntDay_(r.doneAt))] },
    footer: { type: 'box', layout: 'horizontal', spacing: 'sm', paddingAll: '12px', contents: [
      { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '✕ ยังไม่หาย', data: 'mnt|' + r.id + '|no', displayText: 'ยังไม่หาย' } },
      { type: 'button', style: 'primary', color: '#16A34A', height: 'sm', action: { type: 'postback', label: '✓ ใช้ได้แล้ว', data: 'mnt|' + r.id + '|ok', displayText: 'ใช้งานได้แล้ว' } }] } } };
}
// หลังบันทึก: ใบใหม่ → การ์ดเข้ากลุ่มช่าง · เพิ่งซ่อมเสร็จ → แจ้งผู้แจ้ง (+ กลุ่ม ถ้าตั้งไว้) · คืนข้อความผิดพลาด (ว่าง = ปกติ / ไม่ต้องส่ง)
function mntAfterChange_(row, wasStatus, isNew) {
  if (!mntTok_()) return isNew ? 'ยังไม่ได้ตั้งค่า LINE ของฝ่ายช่าง — ใบแจ้งซ่อมบันทึกแล้วแต่ยังไม่ส่งเข้ากลุ่ม' : '';
  var errs = [];
  if (isNew) { var r1 = mntPush_(mntGroup_(), [mntRepairFlex_(row, 'new')]); if (!r1.ok) errs.push(r1.error); }
  if (row.status === 'done' && wasStatus !== 'done' && wasStatus !== 'closed') {
    var st = mntSettings_(mntReadBook_(mntDept_()));
    if (row.lineUserId && st.notifyReporter) { var r2 = mntPush_(row.lineUserId, [mntConfirmFlex_(row)]); if (!r2.ok) errs.push('แจ้งผู้แจ้ง: ' + r2.error); }
    if (st.notifyGroupDone) { var r3 = mntPush_(mntGroup_(), [mntRepairFlex_(row, 'done')]); if (!r3.ok) errs.push(r3.error); }
  }
  return errs.join(' · ');
}

// ---------- Webhook ----------
function mntLineWebhook_(events) {
  (events || []).forEach(function (ev) {
    try {
      var src = ev.source || {}, gid = src.groupId || '', bound = mntGroup_();
      if (gid) mntNoteGroup_(gid, ev.type === 'leave');
      if (ev.type === 'join' || ev.type === 'follow') return;   // ไม่ทักทาย
      if (ev.type === 'leave') { if (gid && gid === bound) props_().deleteProperty('MNT_LINE_GROUP'); return; }
      if (ev.type === 'postback') return mntPostback_(ev, gid, bound);
      if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
      var text = String(ev.message.text).trim(), m;
      if ((m = text.match(/^ตั้งค่ากลุ่ม\s*(?:ช่าง|MNT)\s+([A-Z0-9]{8})$/i))) {
        if (!gid) return mntReply_(ev.replyToken, [mntText_L_('พิมพ์คำสั่งนี้ในกลุ่ม LINE ของช่าง (ไม่ใช่แชทส่วนตัว)')]);
        hrRate_('mntbind', 10, 3600);
        if (m[1].toUpperCase() !== hrProp_('MNT_LINE_SETUP', hrSetupCode_)) return mntReply_(ev.replyToken, [mntText_L_('รหัสไม่ถูกต้อง (ใช้ได้ครั้งเดียว) — คัดลอกคำสั่งล่าสุดจากหน้า "ตั้งค่า & LINE" ของฝ่ายช่างอีกครั้ง')]);
        props_().setProperty('MNT_LINE_GROUP', gid);
        props_().setProperty('MNT_LINE_SETUP', hrSetupCode_());
        return mntReply_(ev.replyToken, [mntText_L_('✅ ตั้งกลุ่มนี้เป็นกลุ่มรับงานแจ้งซ่อมของฝ่ายช่างแล้ว\nพิมพ์ "งานค้าง" เพื่อดูงานที่ยังไม่เสร็จ · "PM" เพื่อดูงานบำรุงรักษาที่ใกล้ถึงกำหนด')]);
      }
      if (gid && gid === bound && /^งานค้าง$/.test(text)) return mntReply_(ev.replyToken, [mntText_L_(mntOpenText_())]);
      if (gid && gid === bound && /^PM$/i.test(text)) return mntReply_(ev.replyToken, [mntText_L_(mntPmText_())]);
      if (!gid && /แจ้งซ่อม/.test(text)) return mntReply_(ev.replyToken, [mntText_L_('🔧 แจ้งซ่อมได้ที่ลิงก์นี้\n' + MNT_PAGE_ + '?k=' + mntFormKey_())]);
    } catch (err) { Logger.log('mntLineWebhook_ ' + err); }
  });
}
function mntPostback_(ev, gid, bound) {
  var p = String((ev.postback || {}).data || '').split('|');
  if (p[0] !== 'mnt' || !p[1]) return;
  var uid = (ev.source || {}).userId || '', dept = mntDept_(), act = p[2];
  if (act === 'take') {
    if (!gid || gid !== bound) return mntReply_(ev.replyToken, [mntText_L_('ปุ่มนี้ใช้ได้ในกลุ่มช่างที่ผูกไว้เท่านั้น')]);
    var name = mntMemberName_(gid, uid) || 'ช่าง';
    var res = purLocked_(function () {
      var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === p[1]; })[0];
      if (!o) return 'ใบแจ้งซ่อมนี้ถูกลบออกจากระบบแล้ว';
      if (o.status === 'cancel') return o.code + ' ถูกยกเลิกแล้ว';
      if (o.status !== 'new') return o.code + ' ' + (o.assignee ? o.assignee + ' รับงานไปแล้ว' : 'มีคนรับงานแล้ว') + ' · สถานะ: ' + MNT_ST_[o.status];
      o.assignee = name; mntApplyStatus_(o, 'accepted', name); o.updatedAt = purNow_();
      purWrite_(ss, 'mnt_repairs', o);
      purLogWrite_(ss, 'รับงานทาง LINE', 'mnt_repairs', o.id, o.code + ' · ' + name);
      return '✅ ' + name + ' รับงาน ' + o.code + ' แล้ว\n' + String(o.machineName || o.location || '') + '\nอัปเดตงาน / ปิดงาน: กดปุ่ม 🔧 ในการ์ด';
    });
    return mntReply_(ev.replyToken, [mntText_L_(res)]);
  }
  if (act === 'ok' || act === 'no') {
    var out = purLocked_(function () {
      var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === p[1]; })[0];
      if (!o) return { text: 'ใบแจ้งซ่อมนี้ถูกลบออกจากระบบแล้ว' };
      if (!uid || uid !== o.lineUserId) return { text: 'ปุ่มนี้สำหรับผู้แจ้งซ่อมเท่านั้น' };
      if (o.status !== 'done') return { text: o.code + ' ' + (o.status === 'closed' ? 'ตรวจรับปิดงานไปแล้ว ขอบคุณครับ' : 'สถานะตอนนี้: ' + MNT_ST_[o.status]) };
      var who = o.lineName || o.reporter || 'ผู้แจ้ง';
      o.confirm = act; o.confirmBy = who;
      if (act === 'ok') mntApplyStatus_(o, 'closed', who);
      else { o.confirmNote = 'ผู้แจ้งกดยังไม่หาย (LINE)'; mntApplyStatus_(o, 'doing', who); o.confirm = 'no'; o.confirmBy = who; }
      o.updatedAt = purNow_();
      purWrite_(ss, 'mnt_repairs', o);
      purLogWrite_(ss, act === 'ok' ? 'ผู้แจ้งตรวจรับ (LINE)' : 'ผู้แจ้งแจ้งยังไม่หาย (LINE)', 'mnt_repairs', o.id, o.code + ' · ' + who);
      return { text: act === 'ok' ? '🙏 ขอบคุณครับ ปิดงาน ' + o.code + ' แล้ว' : 'รับทราบครับ แจ้งช่างให้กลับไปดู ' + o.code + ' อีกครั้งแล้ว', row: act === 'no' ? o : null };
    });
    mntReply_(ev.replyToken, [mntText_L_(out.text)]);
    if (out.row) mntPush_(mntGroup_(), [mntRepairFlex_(out.row, 'reopen')]);
  }
}
function mntOpenText_() {
  var ss = mntReadBook_(mntDept_()), open = purRead_(ss, 'mnt_repairs').map(mntRepairOut_).filter(function (r) { return r.open || r.status === 'done'; });
  if (!open.length) return '🎉 ไม่มีงานแจ้งซ่อมค้าง';
  return '🔧 งานแจ้งซ่อมที่ยังไม่ปิด ' + open.length + ' งาน\n' + open.slice(0, 25).map(function (r) {
    return '• ' + r.code + ' ' + String(r.machineName || r.location || '').slice(0, 40) + ' — ' + MNT_ST_[r.status] + (r.assignee ? ' (' + r.assignee + ')' : '') + (r.urgency === 'urgent' || r.stopLine ? ' ⛔' : '');
  }).join('\n');
}
function mntPmText_() {
  var ss = mntReadBook_(mntDept_()), today = purToday_(), p = today.split('-'), d14 = Utilities.formatDate(new Date(+p[0], +p[1] - 1, +p[2] + 14), PUR_TZ_, 'yyyy-MM-dd');
  var due = purRead_(ss, 'mnt_pm').map(function (x) { return mntPmOut_(x, today); }).filter(function (x) { return x.active === 'on' && x.nextDate && x.nextDate <= d14; })
    .sort(function (a, b) { return String(a.nextDate).localeCompare(String(b.nextDate)); });
  if (!due.length) return '✅ ไม่มีงาน PM ที่ถึงกำหนดใน 14 วันนี้';
  return '🛠 งาน PM ถึงกำหนด (14 วัน) ' + due.length + ' งาน\n' + due.slice(0, 25).map(function (x) {
    return '• ' + (x.overdue ? '⚠️ เลยกำหนด ' : '') + mntDay_(x.nextDate) + ' ' + x.title + ' — ' + (x.machineName || '-') + (x.assignee ? ' (' + x.assignee + ')' : '');
  }).join('\n');
}

// ---------- แบบฟอร์มแจ้งซ่อม (ไม่ต้องล็อกอิน) ----------
function mntFormInit(key) {
  var dept = mntFormCheck_(key), ss = mntReadBook_(dept), st = mntSettings_(ss);
  return { ok: true, today: purToday_(), liffId: mntLiffId_(), categories: mntList_(st.categories), buildings: mntList_(st.buildings), depts: mntList_(st.depts),
    machines: purRead_(ss, 'mnt_machines').filter(function (m) { return m.status !== 'retired'; }).map(function (m) { return { id: m.id, code: m.code, name: m.name, building: m.building, location: m.location, type: m.type }; }) };
}
// บัญชี LINE ของผู้แจ้ง (เปิดจากปุ่มเมนู LINE / LIFF) — ตรวจ ID token กับ LINE · ไม่มี / ไม่ผ่าน = ไม่รู้บัญชี (ยังแจ้งได้)
function mntLiffUser_(idToken) {
  var L = mntLiffId_();
  if (!L || !idToken) return null;
  var c = CacheService.getScriptCache(), k = 'MNTU_' + lineTokKey_(idToken), v = c.get(k);
  if (v) return JSON.parse(v);
  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'post', payload: { id_token: String(idToken), client_id: L.split('-')[0] }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var j = JSON.parse(res.getContentText()), o = j.sub ? { userId: j.sub, name: j.name || '' } : null;
  if (o) c.put(k, JSON.stringify(o), 600);
  return o;
}
// r = {reporter, reporterDept, phone, building, location, machineId, machineName, category, problem, urgency, stopLine} · photos = [{name, mime, b64}] (ย่อแล้ว ≤ 4 รูป)
function mntFormSubmit(key, r, photos, idToken) {
  var dept = mntFormCheck_(key);
  r = r || {};
  hrRate_('mntsubmit', 60, 600);
  var problem = mntText_(r.problem, 2000), reporter = purClean_(r.reporter, 80);
  if (!reporter) return { ok: false, error: 'ใส่ชื่อผู้แจ้ง' };
  if (!problem) return { ok: false, error: 'ใส่อาการ / ปัญหาที่พบ' };
  if (!r.machineId && !purClean_(r.machineName, 150) && !purClean_(r.location, 150)) return { ok: false, error: 'เลือกเครื่อง หรือใส่จุดที่เสีย' };
  var lu = null; try { lu = mntLiffUser_(idToken); } catch (e) {}
  var row = purLocked_(function () {
    var ss = mntBook_(dept), list = purRead_(ss, 'mnt_repairs'), now = purNow_(), mcs = purRead_(ss, 'mnt_machines');
    var mc = r.machineId ? mcs.filter(function (x) { return x.id === r.machineId; })[0] : null;
    var o = { id: purId_('MR'), code: mntNextCode_(list, purToday_()), reportAt: now, reportDate: purToday_(), reporter: reporter, reporterDept: purClean_(r.reporterDept, 80),
      phone: purClean_(r.phone, 40), lineUserId: lu ? lu.userId : '', lineName: lu ? lu.name : '', source: lu ? 'line' : 'qr',
      building: purClean_(r.building, 60) || (mc ? mc.building : ''), location: purClean_(r.location, 150) || (mc ? mc.location : ''),
      machineId: mc ? mc.id : '', machineName: mc ? mc.name : purClean_(r.machineName, 150), category: purClean_(r.category, 80) || (mc ? 'เครื่องจักร' : ''),
      problem: problem, urgency: MNT_URG_[r.urgency] ? r.urgency : 'normal', stopLine: r.stopLine === 'yes' || r.stopLine === true ? 'yes' : '',
      status: 'new', photos: '[]', afterPhotos: '[]', timeline: '[]', createdAt: now, updatedAt: now };
    mntAddTimeline_(o, 'แจ้งซ่อม' + (lu ? ' (LINE)' : ' (QR)'), reporter);
    mntCosts_(o, []);
    purWrite_(ss, 'mnt_repairs', o);
    purLogWrite_(ss, 'แจ้งซ่อม' + (lu ? ' (LINE)' : ' (QR)'), 'mnt_repairs', o.id, o.code + ' · ' + (o.machineName || o.location) + ' · ' + reporter);
    return o;
  });
  // รูปก่อนซ่อม (ส่งมาพร้อมกัน · ไม่เกิน 4 รูป)
  var files = [];
  (Array.isArray(photos) ? photos : []).slice(0, 4).forEach(function (p, i) {
    try { files.push(mntSavePhoto_(dept, 'รูปแจ้งซ่อม', row.code + '_ก่อนซ่อม', (p && p.name) || 'photo' + (i + 1) + '.jpg', p && p.mime, p && p.b64)); } catch (e) {}
  });
  if (files.length) {
    purLocked_(function () {
      var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === row.id; })[0];
      if (o) { o.photos = JSON.stringify(files); purWrite_(ss, 'mnt_repairs', o); }
    });
    row.photos = JSON.stringify(files);
  }
  var line = ''; try { line = mntAfterChange_(row, '', true); } catch (e) { line = String(e.message || e); }
  return { ok: true, id: row.id, code: row.code, sig: mntSign_('mr|' + row.id), line: !line, lineUser: !!row.lineUserId };
}
// งานแจ้งซ่อมของฉัน (รายการที่เครื่องนี้แจ้งไว้: [{id, s}])
function mntFormMine(items) {
  mntOpenDept_();
  var ok = (Array.isArray(items) ? items : []).slice(0, 20).filter(function (x) { return x && x.id && x.s === mntSign_('mr|' + x.id); }).map(function (x) { return x.id; });
  if (!ok.length) return { ok: true, list: [] };
  var ss = mntReadBook_(mntDept_());
  return { ok: true, list: purRead_(ss, 'mnt_repairs').filter(function (r) { return ok.indexOf(r.id) >= 0; }).map(mntRepairOut_).map(function (r) {
    return { id: r.id, code: r.code, machineName: r.machineName, location: r.location, problem: r.problem, status: r.status, statusText: MNT_ST_[r.status], assignee: r.assignee,
      reportAt: r.reportAt, doneAt: r.doneAt, fix: r.fix, confirm: r.confirm, photo: (r.photos[0] || {}).url || '', after: (r.afterPhotos[0] || {}).url || '' };
  }).sort(function (a, b) { return String(b.reportAt).localeCompare(String(a.reportAt)); }) };
}
// ผู้แจ้งตรวจรับจากหน้าเว็บ (ไม่ได้แจ้งผ่าน LINE ก็ตรวจรับได้)
function mntFormConfirm(id, s, ok, note) {
  var dept = mntOpenDept_();
  if (!id || s !== mntSign_('mr|' + id)) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' };
  var out = purLocked_(function () {
    var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, error: 'ไม่พบใบแจ้งซ่อม (อาจถูกลบไปแล้ว)' };
    if (o.status !== 'done') return { ok: false, error: 'สถานะตอนนี้: ' + MNT_ST_[o.status] };
    var who = o.reporter || 'ผู้แจ้ง';
    o.confirm = ok ? 'ok' : 'no'; o.confirmBy = who; o.confirmNote = mntText_(note, 500) || (ok ? '' : 'ผู้แจ้งแจ้งว่ายังไม่หาย');
    mntApplyStatus_(o, ok ? 'closed' : 'doing', who);
    o.confirm = ok ? 'ok' : 'no';
    o.updatedAt = purNow_();
    purWrite_(ss, 'mnt_repairs', o);
    purLogWrite_(ss, ok ? 'ผู้แจ้งตรวจรับ (เว็บ)' : 'ผู้แจ้งแจ้งยังไม่หาย (เว็บ)', 'mnt_repairs', o.id, o.code + ' · ' + who);
    return { ok: true, row: o };
  });
  if (out.ok && !ok) { try { mntPush_(mntGroup_(), [mntRepairFlex_(out.row, 'reopen')]); } catch (e) {} }
  return out.ok ? { ok: true } : out;
}

// ---------- หน้าช่าง (ลิงก์จากการ์ดในกลุ่ม) ----------
function mntTechCheck_(id, t) { if (!id || t !== mntSign_('mt|' + id)) throw new Error('ลิงก์ไม่ถูกต้อง — เปิดจากการ์ดในกลุ่ม LINE ของช่าง'); return mntOpenDept_(); }
function mntTechView(id, t) {
  var dept = mntTechCheck_(id, t), ss = mntReadBook_(dept), st = mntSettings_(ss);
  var r = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
  if (!r) return { ok: false, error: 'ใบแจ้งซ่อมนี้ถูกลบออกจากระบบแล้ว' };
  var parts = mntPartsOut_(purRead_(ss, 'mnt_parts'), purRead_(ss, 'mnt_moves')).filter(function (p) { return p.active !== 'off'; })
    .map(function (p) { return { id: p.id, name: p.name, unit: p.unit, price: p.price, balance: p.balance }; });
  return { ok: true, repair: mntRepairOut_(r), statuses: MNT_ST_, urgency: MNT_URG_, techs: mntList_(st.techs), parts: parts, now: purNow_() };
}
// upd = {status, assignee, cause, fix, downtimeMin, outsideCost, outsideVendor, partsUsed, note} · photos = รูปหลังซ่อม [{name, mime, b64}]
function mntTechUpdate(id, t, upd, photos) {
  var dept = mntTechCheck_(id, t);
  upd = upd || {};
  hrRate_('mnttech', 200, 600);
  var by = purClean_(upd.assignee, 80);
  if (upd.status === 'done' && !mntText_(upd.fix, 10)) return { ok: false, error: 'ใส่วิธีแก้ไข ก่อนปิดเป็น "ซ่อมเสร็จ"' };
  if ((upd.status === 'done' || upd.status === 'doing' || upd.status === 'wait') && !by) return { ok: false, error: 'เลือกชื่อช่างผู้ซ่อม' };
  var res = purLocked_(function () {
    var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, error: 'ใบแจ้งซ่อมนี้ถูกลบออกจากระบบแล้ว' };
    if (o.status === 'closed' || o.status === 'cancel') return { ok: false, error: o.code + ' ' + MNT_ST_[o.status] + ' — แก้ได้ในระบบฝ่ายช่างเท่านั้น' };
    var was = o.status;
    if (by) o.assignee = by;
    ['cause', 'fix', 'note'].forEach(function (k) { if (upd[k] !== undefined) o[k] = mntText_(upd[k], 2000); });
    if (upd.outsideVendor !== undefined) o.outsideVendor = purClean_(upd.outsideVendor, 120);
    if (upd.outsideCost !== undefined) o.outsideCost = upd.outsideCost;
    if (upd.downtimeMin !== undefined) { var dm = purNum_(upd.downtimeMin); o.downtimeMin = dm === '' || dm < 0 ? '' : Math.round(dm); }
    if (upd.status && { accepted: 1, doing: 1, wait: 1, done: 1 }[upd.status]) mntApplyStatus_(o, upd.status, by || o.assignee);
    var used = upd.partsUsed !== undefined ? mntCleanParts_(upd.partsUsed, purRead_(ss, 'mnt_parts')) : mntJson_(o.partsUsed, []);
    // เบิกเกินคงเหลือไม่ได้ (นับคืนของเดิมของใบนี้ก่อน)
    var bal = mntStock_(purRead_(ss, 'mnt_moves').filter(function (m) { return m.repairId !== o.id; })), need = {};
    used.forEach(function (x) { if (x.partId) need[x.partId] = (need[x.partId] || 0) + x.qty; });
    var over = used.filter(function (x) { return x.partId && need[x.partId] > (bal[x.partId] || 0); })[0];
    if (over) return { ok: false, error: over.name + ' คงเหลือ ' + (bal[over.partId] || 0) + ' ' + over.unit + ' — เบิกเกินยอดคงเหลือไม่ได้' };
    mntCosts_(o, used);
    o.updatedAt = purNow_();
    if (was !== o.status || upd.partsUsed !== undefined) mntSyncMoves_(ss, o, used, by);
    purWrite_(ss, 'mnt_repairs', o);
    purLogWrite_(ss, 'ช่างอัปเดตงาน', 'mnt_repairs', o.id, o.code + ' · ' + MNT_ST_[o.status] + (by ? ' · ' + by : ''));
    return { ok: true, row: o, was: was };
  });
  if (!res.ok) return res;
  var files = purParseFiles_(res.row.afterPhotos), added = [];
  (Array.isArray(photos) ? photos : []).slice(0, Math.max(0, 8 - files.length)).forEach(function (p, i) {
    try { added.push(mntSavePhoto_(dept, 'รูปแจ้งซ่อม', res.row.code + '_หลังซ่อม', (p && p.name) || 'after' + (i + 1) + '.jpg', p && p.mime, p && p.b64)); } catch (e) {}
  });
  if (added.length) {
    purLocked_(function () {
      var ss = mntBook_(dept), o = purRead_(ss, 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
      if (o) { o.afterPhotos = JSON.stringify(purParseFiles_(o.afterPhotos).concat(added)); purWrite_(ss, 'mnt_repairs', o); res.row.afterPhotos = o.afterPhotos; }
    });
  }
  var line = ''; try { line = mntAfterChange_(res.row, res.was, false); } catch (e) { line = String(e.message || e); }
  return { ok: true, status: res.row.status, line: line };
}

// ---------- หน้าตั้งค่า LINE / ลิงก์แจ้งซ่อม (ต้องล็อกอินฝ่ายช่าง) ----------
function mntLineInfo(token) {
  requireMnt_(token);
  var tok = mntTok_(), bot = null; try { bot = mntBot_(tok); } catch (e) {}
  var gid = mntGroup_(), L = mntLiffId_(), key = mntFormKey_();
  return { ok: true, hasToken: !!tok, tokenOk: !!bot, botName: bot ? bot.name : '', webhookUrl: ScriptApp.getService().getUrl(),
    group: !!gid, groupName: gid ? mntGroupName_(gid) : '', seen: mntSeenGroups_(gid), bindCmd: 'ตั้งค่ากลุ่ม ช่าง ' + hrProp_('MNT_LINE_SETUP', hrSetupCode_),
    formUrl: MNT_PAGE_ + '?k=' + key, liffId: L, liffUrl: L ? 'https://liff.line.me/' + L : '', endpoint: MNT_PAGE_ + '?k=' + key + (L ? '&l=' + L : '') };
}
function mntSetToken(token, newTok) {
  var dept = requireMnt_(token);
  newTok = String(newTok || '').trim();
  if (!newTok) { props_().deleteProperty('MNT_LINE_TOKEN'); props_().deleteProperty('MNT_LINE_GROUP'); return { ok: true, removed: true }; }
  var bot = mntBot_(newTok);
  if (!bot) return { ok: false, error: 'Token ใช้ไม่ได้ — คัดลอก Channel access token (long-lived) จาก LINE Developers ใหม่อีกครั้ง' };
  var others = [['ACC_LINE_TOKEN', 'ฝ่ายบัญชี'], ['PROD_LINE_TOKEN', 'ฝ่ายผลิต'], ['HR_LINE_TOKEN', 'ฝ่ายบุคคล'], ['PUR_LINE_TOKEN', 'ฝ่ายจัดซื้อ']];
  for (var i = 0; i < others.length; i++) {
    var t = props_().getProperty(others[i][0]), b = null;
    try { b = t ? mntBot_(t) : null; } catch (e) {}
    if (b && b.userId === bot.userId) return { ok: false, error: 'บอทนี้ใช้กับ' + others[i][1] + 'อยู่แล้ว — ใช้ LINE OA ใหม่ของฝ่ายช่าง' };
  }
  var old = null; try { old = mntBot_(mntTok_()); } catch (e) {}
  props_().setProperty('MNT_LINE_TOKEN', newTok);
  if (!old || old.userId !== bot.userId) { props_().deleteProperty('MNT_LINE_GROUP'); props_().deleteProperty('MNT_SEEN_GROUPS'); }
  purLogWrite_(mntBook_(dept), 'ตั้ง LINE OA ฝ่ายช่าง', 'mnt_settings', '', bot.name);
  return { ok: true, botName: bot.name };
}
function mntNewCode(token) {
  requireMnt_(token);
  props_().setProperty('MNT_LINE_SETUP', hrSetupCode_());
  return { ok: true, bindCmd: 'ตั้งค่ากลุ่ม ช่าง ' + props_().getProperty('MNT_LINE_SETUP') };
}
function mntUseGroup(token, gid) {
  var dept = requireMnt_(token), name = mntGroupName_(gid);
  if (!name) return { ok: false, error: 'บอทไม่ได้อยู่ในกลุ่มนี้แล้ว — เชิญบอทเข้ากลุ่ม แล้วพิมพ์ข้อความอะไรก็ได้ 1 ครั้ง' };
  props_().setProperty('MNT_LINE_GROUP', gid);
  purLogWrite_(mntBook_(dept), 'เปลี่ยนกลุ่ม LINE ฝ่ายช่าง', 'mnt_settings', '', name);
  return { ok: true, groupName: name };
}
function mntLineTest(token) {
  requireMnt_(token);
  return mntPush_(mntGroup_(), [mntText_L_('✅ ทดสอบการเชื่อมต่อ: งานแจ้งซ่อมจะเข้ากลุ่มนี้\nพิมพ์ "งานค้าง" ดูงานที่ยังไม่เสร็จ · "PM" ดูงานบำรุงรักษาที่ใกล้ถึงกำหนด')]);
}
function mntSetLiff(token, liffId) {
  var dept = requireMnt_(token);
  liffId = String(liffId || '').trim();
  if (liffId && !/^\d{6,}-[A-Za-z0-9]{4,}$/.test(liffId)) return { ok: false, error: 'LIFF ID ไม่ถูกต้อง (รูปแบบ 1234567890-AbCdEfGh)' };
  if (liffId) props_().setProperty('MNT_LIFF_ID', liffId); else props_().deleteProperty('MNT_LIFF_ID');
  purLogWrite_(mntBook_(dept), liffId ? 'ตั้ง LIFF แจ้งซ่อม' : 'ลบ LIFF แจ้งซ่อม', 'mnt_settings', '', liffId);
  return mntLineInfo(token);
}
// เปลี่ยนลิงก์ / QR แจ้งซ่อม (ลิงก์เดิมใช้ไม่ได้อีก)
function mntNewFormKey(token) {
  var dept = requireMnt_(token);
  props_().setProperty('MNT_FORM_KEY', hrRand_(12));
  purLogWrite_(mntBook_(dept), 'เปลี่ยนลิงก์แจ้งซ่อม', 'mnt_settings', '', '');
  return mntLineInfo(token);
}
// ส่งการ์ดใบแจ้งซ่อมเข้ากลุ่มอีกครั้ง (เช่น ตั้งค่า LINE ทีหลัง)
function mntResendLine(token, id) {
  var dept = requireMnt_(token), r = purRead_(mntReadBook_(dept), 'mnt_repairs').filter(function (x) { return x.id === id; })[0];
  if (!r) return { ok: false, error: 'ไม่พบใบแจ้งซ่อม' };
  return mntPush_(mntGroup_(), [mntRepairFlex_(r, r.status === 'done' || r.status === 'closed' ? 'done' : 'new')]);
}
function mntSendPmDue(token) {
  requireMnt_(token);
  return mntPush_(mntGroup_(), [mntText_L_(mntPmText_())]);
}
