// 职责    Fillout / Zite Tables API 封装：分页拉取、全量拉取、单条拉取、字段更新（管理面板用）、本地缓存。
// 归属页面 档案馆全部页面、管理后台
// 依赖    config.js
// 被依赖   home.js、detail.js、admin.js、admin/admin.js、launcher/my.html
//
// 维护提示
//   · ★ 写接口白名单 PRIVACY_FIELD_WHITELIST 必须与 admin/admin.js 的 SUB_EDITABLE_FIELDS 保持一致，否则保存会被静默忽略。
//   · 接口地址：tables.fillout.com/api/v1/bases/{BASE_ID}/tables/{TABLE_ID}/records/list
//   · ⚠️ API Key 明文写在 shared/config/archive/api.js，属已知安全债。
import {
  CONFIG, PAGE_SIZE, CACHE_KEY, CACHE_TTL,
  VISIBILITY_FIELDS, PRIVACY_CONTROL_IDS, CARD_FIELDS,
} from './config.js';

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
// 可编辑字段白名单（管理面板允许改的字段）
// ------------------------------------------------------------
// ★ 字段 ID 来自配置，不硬编码。
//   旧库用「公开问卷」+ 4 个「（隐私确认）」配对字段；
//   新库改用独立的「是否公开 XX」开关 + 「我已确认…」。
// ============================================================
const PRIVACY_FIELD_WHITELIST = [
  VISIBILITY_FIELDS.publicQuestionnaire,  // 是否公开问卷内容
  PRIVACY_CONTROL_IDS.address,            // 是否公开常住地址
  PRIVACY_CONTROL_IDS.contact,            // 是否公开联系方式
  PRIVACY_CONTROL_IDS.lifePhotos,         // 是否公开生活照片
  PRIVACY_CONTROL_IDS.privatePhotos,      // 是否公开隐私照片
  CARD_FIELDS.verified,                   // 我已确认上述为我真实意愿
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