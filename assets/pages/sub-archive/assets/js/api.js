// ============================================================
// sub-archive/assets/js/api.js
// Fillout API 封装 - 分页/全量/单条/更新
// ============================================================

import { CONFIG, PAGE_SIZE, CACHE_KEY, CACHE_TTL } from './config.js';

// ============================================================
// 分页获取记录（支持缓存）
// ============================================================
export async function fetchRecordsPage(page = 1, forceRefresh = false) {
  const cacheKey = `${CACHE_KEY}_page_${page}`;

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp, total } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          console.log(`📦 使用缓存数据 (第 ${page} 页)`);
          return { records: data, total, fromCache: true };
        }
      }
    } catch (_) {}
  }

  const offset = (page - 1) * PAGE_SIZE;
  const url = `https://tables.fillout.com/api/v1/bases/${CONFIG.DATABASE_ID}/tables/${CONFIG.TABLE_ID}/records/list`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: PAGE_SIZE,
      offset: offset,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败 (HTTP ${response.status})`);
  }

  const data = await response.json();
  const records = data.records || [];
  const total = data.total || records.length;

  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data: records,
      total: total,
      timestamp: Date.now()
    }));
  } catch (_) {}

  console.log(`📡 从服务器加载 (第 ${page} 页，共 ${records.length} 条)`);
  return { records, total, fromCache: false };
}

// ============================================================
// 获取全量记录（用于管理后台）
// ============================================================
export async function fetchRecords(forceRefresh = false) {
  const fullCacheKey = `${CACHE_KEY}_full`;
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(fullCacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          console.log('📦 使用全量缓存数据');
          return data;
        }
      }
    } catch (_) {}
  }

  const url = `https://tables.fillout.com/api/v1/bases/${CONFIG.DATABASE_ID}/tables/${CONFIG.TABLE_ID}/records/list`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败 (HTTP ${response.status})`);
  }

  const data = await response.json();
  const records = data.records || [];

  try {
    localStorage.setItem(fullCacheKey, JSON.stringify({
      data: records,
      timestamp: Date.now()
    }));
  } catch (_) {}

  return records;
}

// ============================================================
// 获取单条记录（直接请求单条）
// ============================================================
export async function fetchRecordById(recordId) {
  const url = `https://tables.fillout.com/api/v1/bases/${CONFIG.DATABASE_ID}/tables/${CONFIG.TABLE_ID}/records/${recordId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${CONFIG.API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`获取记录失败 (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.record || data;
}

// ============================================================
// 清除缓存
// ============================================================
export function clearCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY));
  keys.forEach(key => localStorage.removeItem(key));
  console.log('🧹 缓存已清除');
}

// ============================================================
// 兼容 admin.js 的接口
// ============================================================
export async function fetchAllRecords(forceRefresh = false) {
  return await fetchRecords(forceRefresh);
}

// ============================================================
// ★★★ 修复：可编辑字段白名单（使用字段 ID） ★★★
// 与 admin.js 中的 SUB_EDITABLE_FIELDS 保持一致
// ============================================================
const PRIVACY_FIELD_WHITELIST = [
  'fgerzjJpBTF',   // 公开问卷
  'f1s9DJg4oLc',   // 常住地址（隐私确认）
  'fgHLgfGRzy8',   // 联系方式（隐私确认）
  'fgtX9QmBAM5',   // 生活照片（隐私确认）
  'fwEcZvqiGvm',   // 隐私照片（隐私确认）
  'fwK2mQMoxto',   // 认证
];

// ============================================================
// 更新记录字段（仅允许白名单字段）
// ============================================================
export async function updateRecordFields(recordId, fieldsObj) {
  const allowedUpdates = {};
  for (const [key, value] of Object.entries(fieldsObj)) {
    if (PRIVACY_FIELD_WHITELIST.includes(key)) {
      allowedUpdates[key] = value;
    } else {
      console.warn(`⚠️ 字段 "${key}" 不在白名单，已忽略`);
    }
  }

  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error('没有可更新的有效字段');
  }

  const url = `https://tables.fillout.com/api/v1/bases/${CONFIG.DATABASE_ID}/tables/${CONFIG.TABLE_ID}/records/${recordId}`;
  const payload = { record: allowedUpdates };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${CONFIG.API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.json();
      errorDetail = JSON.stringify(errorBody);
    } catch (_) {
      errorDetail = await response.text();
    }
    throw new Error(`更新失败 (HTTP ${response.status}): ${errorDetail}`);
  }

  clearCache();
  return await response.json();
}