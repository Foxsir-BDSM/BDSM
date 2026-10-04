// 职责    档案馆隐私与可见性判定：隐私值是否放行、字段对角色是否可见、受控字段是否通过隐私校验。
// 归属页面 档案馆全部页面
// 依赖    无
// 被依赖   sub-archive/js/config.js（转出给 utils.js 使用）
//
// 维护提示
//   · 改隐私规则只需增删 fields.js 的 PRIVACY_RULES，本文件的判定逻辑不需要动。
export function isPrivacyApproved(value) {
  if (value === true || value === '是' || value === 'true' || value === 1) return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}

// ============================================================
// 2. 辅助：检查字段是否对角色可见
// ============================================================
export function isFieldVisibleForRole(fieldId, role, roleFieldVisibility) {
  const allowed = roleFieldVisibility?.[role] || roleFieldVisibility?.guest || [];
  return allowed.includes(fieldId);
}

// ============================================================
// 3. 辅助：检查字段的隐私控制是否已公开
// ============================================================
export function isPrivacyApprovedForField(fieldId, record, privacyDependencies) {
  const depControlId = privacyDependencies?.[fieldId];
  if (!depControlId) return true;
  const controlValue = record?.fields?.[depControlId] || record?.data?.[depControlId];
  return isPrivacyApproved(controlValue);
}