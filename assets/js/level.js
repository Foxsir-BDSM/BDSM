// ============================================================
// 积分等级计算核心模块
// ============================================================

import { LEVEL_THRESHOLDS, getLevelTitle, getIdentityLabel } from '/assets/config/levelConfig.js';

/**
 * 计算当前等级
 * @param {string} identityId - 主身份 ID（如 'male_S'）
 * @param {number} points - 当前积分
 * @returns {object} { level, title, nextThreshold, progress, maxLevel }
 */
export function calculateLevel(identityId, points = 0) {
  const maxLevel = LEVEL_THRESHOLDS.length - 1; // 7
  let level = 0;
  let nextThreshold = LEVEL_THRESHOLDS[1]; // 默认 Lv.1 所需积分

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }

  // 下一级阈值
  if (level < maxLevel) {
    nextThreshold = LEVEL_THRESHOLDS[level + 1];
  } else {
    nextThreshold = Infinity; // 已满级
  }

  // 进度百分比（当前等级区间内的进度）
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const nextLevelThreshold = level < maxLevel ? LEVEL_THRESHOLDS[level + 1] : currentThreshold + 100;
  const range = nextLevelThreshold - currentThreshold;
  const progress = range > 0 ? Math.min(100, ((points - currentThreshold) / range) * 100) : 100;

  const title = getLevelTitle(identityId, level);
  const identityLabel = getIdentityLabel(identityId);

  return {
    level, // 0 ~ 7
    title, // 如 "初入局"、"试鞭"
    identityLabel, // 如 "男S"
    nextThreshold, // 下一级所需积分
    progress: Math.round(progress), // 0 ~ 100
    maxLevel,
    isMaxLevel: level >= maxLevel,
    points,
  };
}

/**
 * 生成等级徽章 HTML
 * @param {string} identityId - 主身份 ID
 * @param {number} points - 当前积分
 * @param {string} size - 尺寸 'sm' | 'md' | 'lg'（默认 'md'）
 * @returns {string} HTML 字符串
 */
export function getLevelBadge(identityId, points = 0, size = 'md') {
  const result = calculateLevel(identityId, points);

  // 根据等级确定颜色主题
  let tier = 'bronze';
  if (result.level >= 6) tier = 'gold';
  else if (result.level >= 3) tier = 'silver';

  const sizeMap = {
    sm: 'font-size:11px; padding:1px 10px; gap:4px;',
    md: 'font-size:13px; padding:2px 14px; gap:6px;',
    lg: 'font-size:15px; padding:4px 18px; gap:8px;',
  };

  // 显示文字：Lv.数字 · 称呼
  const label = `Lv.${result.level} · ${result.title}`;

  return `<span class="level-badge level-${tier}" style="${sizeMap[size] || sizeMap.md}">${label}</span>`;
}

/**
 * 获取等级进度条 HTML
 * @param {string} identityId - 主身份 ID
 * @param {number} points - 当前积分
 * @returns {string} HTML 字符串
 */
export function getLevelProgressBar(identityId, points = 0) {
  const result = calculateLevel(identityId, points);
  if (result.isMaxLevel) {
    return `<div class="level-progress" style="width:100%;"><span class="level-progress-fill" style="width:100%;background:linear-gradient(90deg,#f5d6a8,#d4a574);"></span></div>`;
  }
  return `<div class="level-progress" style="width:100%;">
    <span class="level-progress-fill" style="width:${result.progress}%;"></span>
  </div>`;
}

/**
 * 格式化积分显示
 */
export function formatPoints(points = 0) {
  if (points >= 10000) return (points / 10000).toFixed(1) + 'w';
  if (points >= 1000) return (points / 1000).toFixed(1) + 'k';
  return points.toString();
}