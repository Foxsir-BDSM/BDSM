// 职责    ★ 档案馆单一事实源（聚合层）：把 api.js 与 fields.js 组装成 SUB_ARCHIVE_CONFIG，供全站读取。
// 归属页面 档案馆全部页面、管理后台、我的页面
// 依赖    archive/api.js、archive/fields.js
// 被依赖   sub-archive/js/config.js
//
// 维护提示
//   · 本文件只做聚合与向后兼容，不直接声明字段。改字段去 fields.js，改数据源去 api.js。
//   · ★ 导出契约被多处依赖，删减导出项会连锁报错。
//   · DETAIL_FIELD_ORDER 是由 DETAIL_GROUPS 展平得到的兼容项。
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
  BINDING_FIELDS: FIELDS.BINDING_FIELDS,
  PRIVACY_CONTROL_IDS: FIELDS.PRIVACY_CONTROL_IDS,

  // ---- ★ 字段可见性注册表（各页面按区域读取）----
  FIELD_VISIBILITY: FIELDS.FIELD_VISIBILITY,
  FIELD_USAGE: FIELDS.FIELD_USAGE,
  DETAIL_EXCLUDED_FIELD_IDS: FIELDS.DETAIL_EXCLUDED_FIELD_IDS,
  PRIVACY_SWITCHES: FIELDS.PRIVACY_SWITCHES,
  getFieldsFor: FIELDS.getFieldsFor,
  isFieldIn: FIELDS.isFieldIn,

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
