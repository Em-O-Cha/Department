// ==================== ACC จ่าย — อ่านบิลด้วย AI (Claude) ====================
//
// ผู้ใช้ขอ 20/11/69: อ่านบิลจากภาพ / สแกนให้แม่นยำกว่า OCR ปกติ — ใช้เมื่อกดปุ่ม "อ่านด้วย AI" เท่านั้น (คิดเงินตามครั้งที่อ่าน)
// หน้าเว็บส่งภาพหน้าบิล (JPEG, ด้านยาวไม่เกิน 1600px, ไม่เกิน 6 หน้า) → Claude อ่านเป็น JSON ตามแบบที่กำหนด → หน้าเว็บเติมลงฟอร์มให้ตรวจก่อนบันทึก
// คีย์: Script Property ANTHROPIC_API_KEY (ผู้ใช้วางในหน้า ผู้ขาย / ตั้งค่า (จ่าย) → apSetAiKey · ไม่ส่งคีย์กลับไปหน้าเว็บ)
// สถิติการใช้: Script Property AP_AI_USAGE {yyyy-MM: {n, in, out, usd}} แสดงในหน้าตั้งค่า
// ราคา Claude Opus 5.5: input $4 / output $20 ต่อ 1 ล้าน token (ภาพบิล 1 หน้า ≈ 2,000–3,000 token)

var AP_AI_MODEL_ = 'claude-opus-5-5';
var AP_AI_PRICE_ = { in: 4 / 1e6, out: 20 / 1e6 };
var AP_AI_SCHEMA_ = {
  type: 'object', additionalProperties: false,
  required: ['vendor', 'taxId', 'invNo', 'issueDate', 'creditDays', 'vatMode', 'lines', 'subtotal', 'vat', 'total', 'note'],
  properties: {
    vendor: { type: 'string', description: 'ชื่อผู้ขาย / ผู้ออกบิล (ไม่ใช่ชื่อบริษัทผู้ซื้อ)' },
    taxId: { type: 'string', description: 'เลขประจำตัวผู้เสียภาษีของผู้ขาย 13 หลัก ตัวเลขล้วน หรือ "" ถ้าไม่มี' },
    invNo: { type: 'string', description: 'เลขที่ใบกำกับภาษี / เลขที่บิล / เลขที่เอกสาร ตามที่พิมพ์' },
    issueDate: { type: 'string', description: 'วันที่ออกบิล รูปแบบ yyyy-mm-dd ปี ค.ศ. (แปลงจาก พ.ศ.) หรือ ""' },
    creditDays: { type: 'integer', description: 'จำนวนวันเครดิตที่พิมพ์ในบิล หรือ -1 ถ้าไม่มี' },
    vatMode: { type: 'string', enum: ['inc', 'exc', 'none', ''], description: 'inc = ราคาสินค้ารวม VAT แล้ว, exc = VAT แยกบวกท้ายบิล, none = ไม่มี VAT, "" = ไม่แน่ใจ' },
    lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['desc', 'qty', 'price', 'amount'], properties: {
      desc: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number', description: 'ราคาต่อหน่วยตามที่พิมพ์' }, amount: { type: 'number', description: 'จำนวนเงินของรายการตามที่พิมพ์' } } } },
    subtotal: { type: 'number', description: 'ยอดก่อน VAT หรือ 0 ถ้าไม่มี' },
    vat: { type: 'number', description: 'ภาษีมูลค่าเพิ่ม หรือ 0' },
    total: { type: 'number', description: 'ยอดรวมสุทธิ หรือ 0' },
    note: { type: 'string', description: 'สิ่งที่อ่านไม่ชัด หรือข้อสังเกตสั้น ๆ (ภาษาไทย) หรือ ""' }
  }
};

function apAiKey_() { return String(props_().getProperty('ANTHROPIC_API_KEY') || '').trim(); }
function apAiUsage_() { try { return JSON.parse(props_().getProperty('AP_AI_USAGE') || '{}'); } catch (e) { return {}; } }
// ข้อมูลสำหรับหน้าตั้งค่า: ตั้งคีย์แล้วหรือยัง + การใช้ 3 เดือนล่าสุด
function apAiInfo_() {
  var u = apAiUsage_(), months = Object.keys(u).sort().reverse().slice(0, 3);
  return { set: !!apAiKey_(), model: AP_AI_MODEL_, usage: months.map(function (k) { return { ym: k, n: u[k].n || 0, usd: Math.round((u[k].usd || 0) * 100) / 100 }; }) };
}
function apAiStatus(token) { requireAcc_(token); return { ok: true, ai: apAiInfo_() }; }
// วางคีย์ (ตรวจกับ API ก่อนเก็บ) · ส่ง '' = ลบคีย์
function apSetAiKey(token, key) {
  requireAcc_(token);
  key = String(key || '').trim();
  if (!key) { props_().deleteProperty('ANTHROPIC_API_KEY'); return { ok: true, ai: apAiInfo_() }; }
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false, error: 'รูปแบบคีย์ไม่ถูกต้อง — คีย์ขึ้นต้นด้วย sk-ant-' };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/models/' + AP_AI_MODEL_, { method: 'get', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21' } });
  if (res.getResponseCode() === 401 || res.getResponseCode() === 403) return { ok: false, error: 'คีย์ใช้ไม่ได้ (ถูกปฏิเสธ) — ตรวจว่าคัดลอกครบ และคีย์ยังไม่ถูกลบ' };
  if (res.getResponseCode() >= 400) return { ok: false, error: 'ตรวจคีย์ไม่สำเร็จ (' + res.getResponseCode() + ') ลองใหม่อีกครั้ง' };
  props_().setProperty('ANTHROPIC_API_KEY', key);
  return { ok: true, ai: apAiInfo_() };
}

// pages = [{ b64 (JPEG) }] · vendors = รายชื่อผู้ขายที่มีในระบบ (ช่วยจับชื่อให้ตรง)
function apAiRead(token, pages, vendors) {
  var dept = requireAcc_(token), key = apAiKey_();
  if (!key) return { ok: false, needKey: true, error: 'ยังไม่ได้ตั้งค่าคีย์ AI — ไปที่หน้า "ผู้ขาย / ตั้งค่า (จ่าย)" แล้ววางคีย์' };
  pages = (Array.isArray(pages) ? pages : []).slice(0, 6).filter(function (p) { return p && typeof p.b64 === 'string' && /^[A-Za-z0-9+\/=]+$/.test(p.b64) && p.b64.length < 5500000; });
  if (!pages.length) return { ok: false, error: 'ไม่มีภาพบิลให้อ่าน' };
  var main = purBook_(dept), our = String(apSettings_(main).ourTaxId || '');
  var names = (Array.isArray(vendors) ? vendors : []).slice(0, 150).map(function (v) { return String(v || '').slice(0, 80); }).filter(String);
  var prompt = 'ภาพที่แนบคือบิล / ใบกำกับภาษี / ใบส่งของ ที่บริษัทเราได้รับจากผู้ขาย ' + (pages.length > 1 ? '(' + pages.length + ' หน้า เป็นบิลใบเดียวกัน) ' : '')
    + 'อ่านข้อมูลให้ครบตามที่พิมพ์ในบิลจริง ห้ามเดา ช่องที่ไม่มีให้ใส่ค่าว่างตามที่กำหนด\n'
    + '- ผู้ขาย = ผู้ออกบิล ไม่ใช่ผู้ซื้อ' + (our ? ' (เลขผู้เสียภาษีของบริษัทเราคือ ' + our + ' ห้ามใส่เลขนี้เป็นของผู้ขาย)' : '') + '\n'
    + '- รายการสินค้า: ทุกบรรทัดตามลำดับในบิล ใช้จำนวน ราคาต่อหน่วย และจำนวนเงินตามที่พิมพ์ ไม่รวมบรรทัดยอดรวม / ส่วนลดท้ายบิล\n'
    + '- วันที่ในบิลไทยมักเป็น พ.ศ. ให้แปลงเป็น ค.ศ. (ลบ 543)\n'
    + (names.length ? '- ถ้าผู้ขายตรงกับชื่อในรายชื่อนี้ ให้ใช้ชื่อตามรายชื่อ: ' + names.join(' | ') + '\n' : '');
  var content = pages.map(function (p) { return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.b64 } }; });
  content.push({ type: 'text', text: prompt });
  var body = { model: AP_AI_MODEL_, max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: AP_AI_SCHEMA_ } },
    fallbacks: 'default', messages: [{ role: 'user', content: content }] };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' }, payload: JSON.stringify(body) });
  var code = res.getResponseCode(), j = null;
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (code === 401 || code === 403) return { ok: false, needKey: true, error: 'คีย์ AI ใช้ไม่ได้แล้ว — วางคีย์ใหม่ในหน้าตั้งค่า' };
  if (code === 429 || code === 529 || code >= 500) return { ok: false, error: 'บริการ AI ไม่ว่างชั่วคราว ลองใหม่ในอีกสักครู่' };
  if (code >= 400 || !j) return { ok: false, error: 'อ่านด้วย AI ไม่สำเร็จ (' + code + (j && j.error ? ': ' + String(j.error.message || '').slice(0, 160) : '') + ')' };
  // บันทึกการใช้ (คิดเงินแม้ผลจะใช้ไม่ได้)
  var uIn = (j.usage && (j.usage.input_tokens || 0) + (j.usage.cache_read_input_tokens || 0) + (j.usage.cache_creation_input_tokens || 0)) || 0, uOut = (j.usage && j.usage.output_tokens) || 0;
  var usd = uIn * AP_AI_PRICE_.in + uOut * AP_AI_PRICE_.out;
  try {
    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try { var u = apAiUsage_(), ym = purToday_().slice(0, 7), m = u[ym] = u[ym] || { n: 0, in: 0, out: 0, usd: 0 }; m.n++; m.in += uIn; m.out += uOut; m.usd += usd; props_().setProperty('AP_AI_USAGE', JSON.stringify(u)); }
    finally { lock.releaseLock(); }
  } catch (e) {}
  if (j.stop_reason === 'refusal') return { ok: false, error: 'AI ไม่อ่านภาพนี้ — ลองถ่ายใหม่ให้เห็นเฉพาะบิล', usd: usd };
  if (j.stop_reason === 'max_tokens') return { ok: false, error: 'บิลยาวเกินไปสำหรับการอ่านครั้งเดียว — แยกเป็นทีละหน้า', usd: usd };
  var text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  var bill = null;
  try { bill = JSON.parse(text); } catch (e) { return { ok: false, error: 'AI ตอบกลับในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง', usd: usd }; }
  bill.taxId = String(bill.taxId || '').replace(/\D/g, '');
  if (bill.taxId.length !== 13 || bill.taxId === our) bill.taxId = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bill.issueDate || ''))) bill.issueDate = '';
  else if (+bill.issueDate.slice(0, 4) > 2400) bill.issueDate = (+bill.issueDate.slice(0, 4) - 543) + bill.issueDate.slice(4);
  return { ok: true, bill: bill, tokens: { in: uIn, out: uOut }, usd: Math.round(usd * 1000) / 1000, ai: apAiInfo_() };
}
