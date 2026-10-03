// ============================================================
// src/shared/config/levelConfig.js
// 等级体系 —— 仅「主」与「奴」两类
// ------------------------------------------------------------
// 设计（2026-10-03 定稿）：
//   取消原有 8 级称号链（初入局/试鞭/立威…），
//   只按身份的上/下位区分两种角色称谓：
//     上位（男S / 女S） → 主
//     下位（男M / 女M） → 奴
//
//   积分保留为数值统计（points），但不再是等级依据；
//   getRoleTitle() 是唯一入口，页面的 Lv.N 展示已同步移除。
// ============================================================

/** 两类角色称谓 */
export const ROLE_TITLES = {
  top: '主',
  bottom: '奴',
};

/** 角色释义（用于资料页等处的说明文案） */
export const ROLE_TITLE_DESC = {
  主: '上位者 · 掌控与引导',
  奴: '下位者 · 臣服与跟随',
};

/**
 * 由身份的上/下位取得角色称谓
 * @param {'top'|'bottom'|null} type 位置类型
 * @returns {string} '主' | '奴' | ''
 */
export function getRoleTitleByType(type) {
  return ROLE_TITLES[type] || '';
}

/**
 * 由身份 id 取得角色称谓
 * 说明：只依赖身份本身，不再依赖积分。
 * @param {string} identityId 身份 id（如 'male_S'）
 * @param {'top'|'bottom'|null} type 可选的已知位置类型（避免重复解析）
 * @returns {string} '主' | '奴' | ''
 */
export function getLevelTitle(identityId, type) {
  if (type) return getRoleTitleByType(type);
  return '';
}

/**
 * 兼容旧调用：返回身份的角色称谓
 * 旧代码里 getIdentityLabel() 用于显示身份名，现由 identity-config 提供，
 * 这里保留一个薄封装以免破坏引用。
 */
export function getIdentityLabel(identityId) {
  return identityId || '';
}
