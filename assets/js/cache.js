// ============================================================
// assets/js/cache.js
// 前端缓存工具（localStorage）- 支持过期时间
// ============================================================

const CACHE_PREFIX = 'foxsir_';
const CACHE_VERSION = 'v2';

// 默认缓存过期时间：5 分钟
export const DEFAULT_TTL = 5 * 60 * 1000;

// ===== 获取缓存（带过期检查） =====
export function getCacheWithMeta(key, ttl = DEFAULT_TTL) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;

        const entry = JSON.parse(raw);

        // 检查版本是否匹配
        if (entry._version && entry._version !== CACHE_VERSION) {
            console.log('🔄 缓存版本不匹配，清除:', key);
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }

        const now = Date.now();
        const isExpired = (now - entry._timestamp) > ttl;

        if (isExpired) {
            console.log('⏰ 缓存已过期:', key);
            return null;
        }

        return entry._data;
    } catch {
        return null;
    }
}

// ===== 设置缓存（带元数据） =====
export function setCacheWithMeta(key, value, ttl = DEFAULT_TTL) {
    try {
        const entry = {
            _data: value,
            _timestamp: Date.now(),
            _ttl: ttl,
            _version: CACHE_VERSION,
        };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
        console.warn('⚠️ 缓存写入失败:', e);
    }
}

// ===== 获取缓存（兼容旧接口，永不过期） =====
export function getCache(key) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// ===== 设置缓存（兼容旧接口，永久有效） =====
export function setCache(key, value) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
        console.warn('⚠️ 缓存写入失败:', e);
    }
}

// ===== 清除特定缓存 =====
export function clearCache(key) {
    localStorage.removeItem(CACHE_PREFIX + key);
}

// ===== 清除所有 foxsir_ 开头的缓存 =====
export function clearAllCache() {
    const keys = Object.keys(localStorage);
    let count = 0;
    keys.forEach(k => {
        if (k.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(k);
            count++;
        }
    });
    console.log('🧹 已清除', count, '条缓存');
}

// ===== 清除知识区所有缓存（列表 + 详情） =====
export function clearKnowledgeCache() {
    const keys = Object.keys(localStorage);
    let count = 0;
    keys.forEach(k => {
        if (k.startsWith(CACHE_PREFIX + 'list_knowledge_') ||
            k.startsWith(CACHE_PREFIX + 'detail_knowledge_')) {
            localStorage.removeItem(k);
            count++;
        }
    });
    console.log('🧹 知识区缓存已清除', count, '条');
}

// ===== 清除任务区所有缓存（列表 + 详情） =====
export function clearTaskCache() {
    const keys = Object.keys(localStorage);
    let count = 0;
    keys.forEach(k => {
        if (k.startsWith(CACHE_PREFIX + 'list_tasks_') ||
            k.startsWith(CACHE_PREFIX + 'detail_tasks_')) {
            localStorage.removeItem(k);
            count++;
        }
    });
    console.log('🧹 任务区缓存已清除', count, '条');
}

// ===== 获取缓存状态（调试用） =====
export function getCacheStatus(key) {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return '❌ 不存在';
    try {
        const data = JSON.parse(raw);
        const size = JSON.stringify(data).length;
        return '✅ 存在 (' + size + ' 字节)';
    } catch {
        return '❌ 无效';
    }
}

// ===== 获取所有缓存键名（调试用） =====
export function getAllCacheKeys() {
    const keys = [];
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith(CACHE_PREFIX)) {
            keys.push(k.replace(CACHE_PREFIX, ''));
        }
    });
    return keys;
}