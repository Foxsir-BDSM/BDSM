// ============================================================
// sub-archive/assets/js/config.js
// 从全局实例配置读取下位者档案馆配置
// ============================================================

import { SUB_ARCHIVE_CONFIG } from '/assets/config/archive/instances.js';
import {
  isPrivacyApproved,
  isFieldVisibleForRole,
  isPrivacyApprovedForField,
} from '/assets/config/archive/schema.js';

// ---- 导出实例配置 ----
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

// ---- 导出辅助函数 ----
export { isPrivacyApproved, isFieldVisibleForRole, isPrivacyApprovedForField };

// ---- 实例级 API 配置（每个实例独立） ----
export const CONFIG = {
  DATABASE_ID: '0019555500b60c58',
  TABLE_ID: 'taRmZxGFzF5',
  API_KEY:
    'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053',
  FORM_URL: 'https://forms.fillout.com/t/sZm1g43KzHus',
  DEFAULT_IMAGE:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"%3E%3Crect width="300" height="400" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="20" fill="%23999" text-anchor="middle" dy=".3em"%3E暂无图片%3C/text%3E%3C/svg%3E',
};

export const PAGE_SIZE = 20;
export const CACHE_KEY = 'foxsir_sub_archive_cache';
export const CACHE_TTL = 5 * 60 * 1000;