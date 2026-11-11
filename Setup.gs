// ==================== เครื่องมือผู้ดูแลระบบ (รันจาก editor — ไม่จำเป็นต้องใช้) ====================
//
// รหัสผ่านไม่ได้ตั้งในไฟล์นี้แล้ว — แต่ละแผนกตั้ง/เปลี่ยนรหัสผ่านเองในหน้าเว็บ (Admin.gs)
//   ผู้ดูแลระบบ: เปิดเว็บแอป → "ผู้ดูแลระบบ" → ออกรหัสตั้งค่าให้แผนก (ใช้ครั้งเดียว ไม่ใช่รหัสผ่าน)
//   แผนก: กดการ์ดแผนก → ใส่รหัสตั้งค่า → ตั้งรหัสผ่านของแผนกเอง (ผู้ดูแลระบบไม่เห็นรหัสนี้)

// ดูว่าแผนกไหนตั้งรหัสแล้ว / ชีตเปิดได้หรือยัง
function checkSetup() {
  var props = PropertiesService.getScriptProperties();
  Logger.log(ONLY_DEPT ? 'โหมด: ระบบของแผนก ' + ONLY_DEPT + ' (แบบ 2)' : 'โหมด: ระบบกลาง (แบบ 1)');
  Logger.log('รหัสผู้ดูแลระบบ: ' + (props.getProperty(pwPropKey_(ADMIN_KEY_)) ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง (ตั้งในหน้าเว็บ → ผู้ดูแลระบบ)'));
  activeDepartments_().forEach(function (d) {
    if (!findDept_(d.key)) { Logger.log(d.key + ' (' + d.name + ')  ย้ายไปใช้ระบบของแผนกเองแล้ว: ' + d.appUrl); return; }
    var s = sheetStatus_(d);
    Logger.log(d.key + ' (' + d.name + ')  รหัสผ่าน: ' + (props.getProperty(pwPropKey_(d.key)) ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง') +
      '  |  ชีต: ' + (s.connected ? 'เปิดได้ — ' + s.title : s.message) +
      (d.ownerEmail ? '  |  เจ้าของ: ' + d.ownerEmail : ''));
  });
}

// ปลดล็อกแผนกที่ถูกล็อกจากการใส่รหัสผิด (ทำในหน้าเว็บผู้ดูแลระบบได้เหมือนกัน)
function unlockDepartment() {
  var key = 'HR';
  CacheService.getScriptCache().removeAll(['fail_' + key, 'lock_' + key]);
  Logger.log('ปลดล็อกแผนก ' + key + ' แล้ว');
}
