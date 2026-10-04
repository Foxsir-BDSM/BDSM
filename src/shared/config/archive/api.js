// ============================================================
// src/shared/config/archive/api.js
// 档案馆 · 总 API 配置
// ------------------------------------------------------------
// 数据源：Zite / Fillout Tables
//
// ID 名称对应关系（容易搞错，特此注明）：
//   Zite 编辑器 URL 形如
//     https://app.zite.com/workspace/<BASE>/database/<TABLE>/<VIEW>
//                                    ↑            ↑
//                                 baseId      tableId
//   Tables API 形如
//     https://tables.fillout.com/api/v1/bases/<BASE>/tables/<TABLE>/records/list
//
// 表单填写入口（新表单；对应列表页「母の曝光」按钮）
// ============================================================

/** Fillout Tables：base（对应 Zite 的 workspace 段） */
export const BASE_ID = 'e7d18ead20743825';

/** Fillout Tables：table（对应 Zite 的 database 段） */
export const TABLE_ID = 't4d3B3XvKL8';

/** Zite 视图 ID（仅作记录，API 不直接使用） */
export const VIEW_ID = 'vvzaSN4ztoq';

/** Tables API Key */
export const API_KEY =
  'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';

/** 档案表单填写入口（新） */
export const FORM_URL = 'https://forms.fillout.com/t/tUpkJr8bb9us';

/** 列表页按钮文案对应的表名（仅作提示） */
export const FORM_BUTTON_LABEL = '母の曝光';

/** 卡片无图时的占位图 */
export const DEFAULT_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"%3E%3Crect width="300" height="400" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="20" fill="%23999" text-anchor="middle" dy=".3em"%3E暂无图片%3C/text%3E%3C/svg%3E';

/** 分页与缓存 */
export const PAGE_SIZE = 20;
export const CACHE_KEY = 'foxsir_sub_archive_cache';
export const CACHE_TTL = 5 * 60 * 1000;

/** 组装后的 API 配置对象（供 api.js / utils.js 使用） */
export const CONFIG = {
  BASE_ID,
  TABLE_ID,
  VIEW_ID,
  API_KEY,
  FORM_URL,
  DEFAULT_IMAGE,
  // 兼容旧命名：api.js 内部按 DATABASE_ID 拼 URL
  DATABASE_ID: BASE_ID,
};

/** Tables API 基础地址 */
export function getRecordsUrl() {
  return `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`;
}

export function getBaseUrl() {
  return `https://tables.fillout.com/api/v1/bases/${BASE_ID}`;
}
