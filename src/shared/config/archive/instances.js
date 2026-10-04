// ============================================================
// src/shared/config/archive/instances.js
// 档案馆 · 单一事实源（聚合层）
// ------------------------------------------------------------
// 档案馆的全部语义集中在这一处，首页 / 详情页 / 个人页面都从这里读。
//
// 本文件不再直接声明字段与 API，而是聚合下面两份「维护文件」：
//
//   api.js     总 API 配置（数据源 ID、API Key、表单入口、分页缓存）
//   fields.js  字段维护文件（字段标签、详情板块、卡片映射、隐私规则、筛选字段）
//
// 维护流程不变：
//   1) node tools/get_fields_diff.js   ← 对比远程字段与本地，输出 id:'名称' 差异
//   2) 把差异粘贴回 fields.js
//   3) 本文件自动生效，消费方无需改动
//
// 数据源：Zite（原 Fillout Tables）
//   URL  https://app.zite.com/workspace/e7d18ead20743825/database/t4d3B3XvKL8/vvzaSN4ztoq
//   表单 https://forms.fillout.com/t/tUpkJr8bb9us
//
// 变更记录（2026-10-04）：
//   · 数据源从旧库 0019555500b60c58 / taRmZxGFzF5 迁到新库 e7d18ead20743825 / t4d3B3XvKL8
//   · 表单入口从 sZm1g43KzHus 迁到 tUpkJr8bb9us
//   · 字段从旧表 56 项替换为新表 56 项（含新增「身份」「封面展示」「是否公开×5」）
//   · 隐私机制由「配对控制字段」简化为「独立公开开关」
//   · 取向维度取消，筛选仅按身份
// ============================================================

import * as API from './api.js';
import * as FIELDS from './fields.js';

// ════════════════════════════════════════════════════════════
// 统一档案库（原来的上下位分馆已合并，不再区分馆别）
// ════════════════════════════════════════════════════════════
export const SUB_ARCHIVE_CONFIG = {
  id: 'sub-archive',
  name: '统一档案库',

  // ---- 来自 fields.js：字段维护文件 ----
  FIELD_LABELS: FIELDS.FIELD_LABELS,
  CARD_FIELDS: FIELDS.CARD_FIELDS,
  SEARCH_FIELDS: FIELDS.SEARCH_FIELDS,
  DETAIL_GROUPS: FIELDS.DETAIL_GROUPS,
  SYSTEM_FIELD_IDS: FIELDS.SYSTEM_FIELD_IDS,
  HOME_ONLY_FIELD_IDS: FIELDS.HOME_ONLY_FIELD_IDS,
  EXTRA_EXCLUDED_FIELD_IDS: FIELDS.EXTRA_EXCLUDED_FIELD_IDS,
  PRIVACY_RULES: FIELDS.PRIVACY_RULES,
  PRIVACY_DEPENDENCIES: FIELDS.PRIVACY_DEPENDENCIES,
  ROLE_FIELD_VISIBILITY: FIELDS.ROLE_FIELD_VISIBILITY,
  FILTER_FIELDS: FIELDS.FILTER_FIELDS,
  VISIBILITY_FIELDS: FIELDS.VISIBILITY_FIELDS,
  PRIVACY_CONTROL_IDS: FIELDS.PRIVACY_CONTROL_IDS,

  // ---- 来自 api.js：总 API 配置 ----
  BASE_ID: API.BASE_ID,
  TABLE_ID: API.TABLE_ID,
  VIEW_ID: API.VIEW_ID,
  DATABASE_ID: API.BASE_ID,   // 兼容旧命名（api 层按此拼 URL）
  API_KEY: API.API_KEY,
  FORM_URL: API.FORM_URL,
  DEFAULT_IMAGE: API.DEFAULT_IMAGE,
  PAGE_SIZE: API.PAGE_SIZE,
  CACHE_KEY: API.CACHE_KEY,
  CACHE_TTL: API.CACHE_TTL,

  // ---- 派生：详情页字段顺序（由 DETAIL_GROUPS 展平，保持向后兼容）----
  get DETAIL_FIELD_ORDER() {
    return FIELDS.DETAIL_GROUPS.flatMap((g) => g.fields);
  },
};

// ════════════════════════════════════════════════════════════
// 统一导出
// ════════════════════════════════════════════════════════════
export const ARCHIVE_INSTANCES = {
  'sub-archive': SUB_ARCHIVE_CONFIG,
};

export function getArchiveConfig(instanceId) {
  return ARCHIVE_INSTANCES[instanceId] || null;
}

// 便于需要直接拿原始两份配置的场景
export { API as ARCHIVE_API, FIELDS as ARCHIVE_FIELDS };
