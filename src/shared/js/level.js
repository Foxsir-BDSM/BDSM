// 职责    角色称谓与积分格式化（仅主 / 奴）。
// 归属页面 首页、我的页、资料页
// 依赖    shared/config/identity-config.js、shared/config/levelConfig.js
// 被依赖   launcher/index.html、launcher/my.html、launcher/profile.html
//
// 维护提示
//   · 已移除多级等级计算（calculateLevel / getLevelBadge / getLevelProgressBar）。若恢复等级阶梯需重新引入。
import { getType } from '@/shared/config/identity-config.js';
import { getRoleTitleByType, ROLE_TITLE_DESC } from '@/shared/config/levelConfig.js';

/**
 * 取得角色称谓：上位 = 主，下位 = 奴
 * @param {string} identityId 身份 id（如 'male_S'，旧值会自动归并）
 * @returns {string} '主' | '奴' | ''
 */
export function getRoleTitle(identityId) {
  return getRoleTitleByType(getType(identityId));
}

/** 角色释义（用于资料页说明文案） */
export function getRoleTitleDesc(identityId) {
  const t = getRoleTitle(identityId);
  return t ? (ROLE_TITLE_DESC[t] || '') : '';
}

/**
 * 角色信息（一次取全，供页面渲染）
 * @returns {{title:string, desc:string, type:string|null, hasRole:boolean}}
 */
export function getRoleInfo(identityId) {
  const type = getType(identityId);
  const title = getRoleTitleByType(type);
  return {
    title,
    desc: title ? (ROLE_TITLE_DESC[title] || '') : '',
    type,
    hasRole: !!title,
  };
}

/** 是否是上位（主） */
export function isTop(identityId) {
  return getType(identityId) === 'top';
}

/** 是否是下位（奴） */
export function isBottom(identityId) {
  return getType(identityId) === 'bottom';
}

/**
 * 格式化积分显示（纯数值，不含等级含义）
 */
export function formatPoints(points = 0) {
  const n = Number(points) || 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
