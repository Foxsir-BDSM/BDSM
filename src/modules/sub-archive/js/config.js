// 职责    档案馆模块的配置适配层。把 shared/config/archive 的内容转出，并补充缓存与分页常量。
// 归属页面 档案馆全部页面（列表 / 详情 / 后台）
// 依赖    shared/config/archive/instances.js、api.js、schema.js
// 被依赖   home.js、detail.js、utils.js、api.js、admin.js、launcher/my.html、admin/admin.js
//
// 维护提示
//   · 本文件只做转发，改配置请去 shared/config/archive/ 下的 api.js 或 fields.js。
//   · ★ 这里用相对路径导入（不是 @/ 别名），是为了让 Node 能直接导入做纯逻辑测试；改成别名会破坏 tools/check-affiliation-filter.mjs。
import { SUB_ARCHIVE_CONFIG } from '../../../shared/config/archive/instances.js';
import {
  CONFIG as API_CONFIG,
  PAGE_SIZE as API_PAGE_SIZE,
  CACHE_KEY as API_CACHE_KEY,
  CACHE_TTL as API_CACHE_TTL,
} from '../../../shared/config/archive/api.js';
import {
  isPrivacyApproved,
  isFieldVisibleForRole,
  isPrivacyApprovedForField,
} from '../../../shared/config/archive/schema.js';

// ---- 字段维护文件（来自 fields.js，经 instances 聚合）----
export const FIELD_LABELS = SUB_ARCHIVE_CONFIG.FIELD_LABELS;
export const CARD_FIELDS = SUB_ARCHIVE_CONFIG.CARD_FIELDS;
export const SEARCH_FIELDS = SUB_ARCHIVE_CONFIG.SEARCH_FIELDS;
export const DETAIL_GROUPS = SUB_ARCHIVE_CONFIG.DETAIL_GROUPS;
export const DETAIL_FIELD_ORDER = SUB_ARCHIVE_CONFIG.DETAIL_FIELD_ORDER;
export const SYSTEM_FIELD_IDS = SUB_ARCHIVE_CONFIG.SYSTEM_FIELD_IDS;
export const HOME_ONLY_FIELD_IDS = SUB_ARCHIVE_CONFIG.HOME_ONLY_FIELD_IDS;
export const EXTRA_EXCLUDED_FIELD_IDS = SUB_ARCHIVE_CONFIG.EXTRA_EXCLUDED_FIELD_IDS;
export const PRIVACY_RULES = SUB_ARCHIVE_CONFIG.PRIVACY_RULES;
export const PRIVACY_DEPENDENCIES = SUB_ARCHIVE_CONFIG.PRIVACY_DEPENDENCIES;
export const ROLE_FIELD_VISIBILITY = SUB_ARCHIVE_CONFIG.ROLE_FIELD_VISIBILITY;
export const FILTER_FIELDS = SUB_ARCHIVE_CONFIG.FILTER_FIELDS;
export const VISIBILITY_FIELDS = SUB_ARCHIVE_CONFIG.VISIBILITY_FIELDS;
export const PRIVACY_CONTROL_IDS = SUB_ARCHIVE_CONFIG.PRIVACY_CONTROL_IDS;

// ---- 导出辅助函数 ----
export { isPrivacyApproved, isFieldVisibleForRole, isPrivacyApprovedForField };

// ---- 总 API 配置（来自 api.js）----
// 数据源：Zite / Fillout Tables
//   baseId  = e7d18ead20743825
//   tableId = t4d3B3XvKL8
export const CONFIG = API_CONFIG;

export const PAGE_SIZE = API_PAGE_SIZE;
export const CACHE_KEY = API_CACHE_KEY;
export const CACHE_TTL = API_CACHE_TTL;
