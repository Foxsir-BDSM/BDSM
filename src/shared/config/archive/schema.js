// ============================================================
// assets/config/archive/schema.js
// 全局档案工具函数（无业务字段，纯逻辑）
// ============================================================

// ============================================================
// 1. 辅助：判断值是否为“是”
// ============================================================
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