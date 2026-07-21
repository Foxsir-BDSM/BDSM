// ================================================================
// assets/js/content-manager.js
// 功能：GitHub 内容管理 CRUD 操作（知识区 / 任务区共用）
// 缓存策略：5 分钟过期 + 手动刷新
// 作者字段：自动从当前用户获取，不可修改
// ================================================================

import { CONTENT_CONFIG } from './content-config.js';
import { getCache, setCache, clearCache, getCacheWithMeta, setCacheWithMeta, DEFAULT_TTL } from './cache.js';

// ===== 获取 Token（环境变量优先） =====
export function getToken() {
    console.log('⚙️ getToken 被调用');

    // 优先从环境变量读取（Vercel 生产环境）
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GITHUB_TOKEN) {
        console.log('✅ 从环境变量获取 token');
        return import.meta.env.VITE_GITHUB_TOKEN;
    }

    // 降级：从 localStorage 读取（本地开发备用）
    const token = localStorage.getItem('foxsir_github_token');
    if (token && token.length > 10) {
        console.log('✅ 从 localStorage 获取 token');
        return token;
    }

    console.warn('❌ 未找到任何 token');
    return null;
}

// ===== 获取文件列表（5 分钟缓存） =====
export async function fetchContentList(branch, path) {
    const cacheKey = 'list_' + branch + '_' + path;

    // ★ 优先读取缓存（5 分钟过期检查） ★
    const cached = getCacheWithMeta(cacheKey, DEFAULT_TTL);
    if (cached) {
        const remaining = getCacheRemainingTime(cacheKey);
        console.log('📦 命中缓存:', cacheKey, '剩余有效期', remaining);
        return cached;
    }

    console.log('📡 未命中缓存或已过期，从 GitHub 拉取:', cacheKey);

    const token = getToken();
    if (!token) {
        console.error('❌ 未配置 GitHub Token');
        return [];
    }

    const url = 'https://api.github.com/repos/' + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo + '/contents/' + path + '?ref=' + branch + '&t=' + Date.now();

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': 'token ' + token }
        });
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error('HTTP ' + response.status);
        }
        const data = await response.json();
        const files = Array.isArray(data) ? data.filter(function(f) { return f && f.name && f.name.endsWith('.md'); }) : [];

        // ★ 存入缓存（5 分钟有效期） ★
        setCacheWithMeta(cacheKey, files, DEFAULT_TTL);
        console.log('✅ 缓存已写入:', cacheKey, files.length, '个文件，有效期 5 分钟');

        return files;
    } catch (err) {
        console.error('获取列表失败:', err);
        // 降级：如果请求失败但有过期缓存，返回过期缓存
        const fallback = getCache(cacheKey);
        if (fallback) {
            console.warn('⚠️ 使用降级缓存（过期）:', cacheKey);
            return fallback;
        }
        return [];
    }
}

// ===== 强制刷新列表（忽略缓存） =====
export async function fetchContentListForce(branch, path) {
    const cacheKey = 'list_' + branch + '_' + path;
    clearCache(cacheKey);
    console.log('🔄 强制刷新，已清除缓存:', cacheKey);
    return fetchContentList(branch, path);
}

// ===== 获取缓存剩余有效期（调试用） =====
function getCacheRemainingTime(key) {
    try {
        const raw = localStorage.getItem('foxsir_' + key);
        if (!raw) return '无缓存';
        const entry = JSON.parse(raw);
        if (!entry._timestamp) return '旧格式缓存';
        const remaining = Math.max(0, (entry._timestamp + (entry._ttl || DEFAULT_TTL) - Date.now()) / 1000);
        if (remaining <= 0) return '已过期';
        if (remaining > 60) return Math.floor(remaining / 60) + ' 分钟';
        return Math.floor(remaining) + ' 秒';
    } catch {
        return '未知';
    }
}

// ===== 获取文件 SHA（用于更新/删除） =====
export async function getFileSha(branch, path) {
    const token = getToken();
    if (!token) return null;
    const url = 'https://api.github.com/repos/' + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo + '/contents/' + path + '?ref=' + branch + '&t=' + Date.now();
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': 'token ' + token }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.sha || null;
    } catch {
        return null;
    }
}

// ===== 创建或更新文件 =====
export async function createOrUpdateContent(branch, path, content, message) {
    const token = getToken();
    if (!token) throw new Error('未配置 GitHub Token');

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let binary = '';
    data.forEach(function(byte) { binary += String.fromCharCode(byte); });
    const contentBase64 = btoa(binary);

    let sha = null;
    try {
        const check = await fetch(
            'https://api.github.com/repos/' + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo + '/contents/' + path + '?ref=' + branch + '&t=' + Date.now(),
            { headers: { 'Authorization': 'token ' + token } }
        );
        if (check.ok) {
            const existing = await check.json();
            sha = existing.sha;
        }
    } catch (_) {}

    var payload = {
        message: message || '📝 更新内容: ' + path,
        content: contentBase64,
        branch: branch
    };
    if (sha) payload.sha = sha;

    const response = await fetch(
        'https://api.github.com/repos/' + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo + '/contents/' + path,
        {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }
    );

    if (!response.ok) {
        var text = await response.text();
        var errMsg = text;
        try { var j = JSON.parse(text); errMsg = j.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }
    return await response.json();
}

// ===== 删除文件 =====
export async function deleteContent(branch, path) {
    const token = getToken();
    if (!token) throw new Error('未配置 GitHub Token');
    const sha = await getFileSha(branch, path);
    if (!sha) throw new Error('文件不存在');

    const response = await fetch(
        'https://api.github.com/repos/' + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo + '/contents/' + path,
        {
            method: 'DELETE',
            headers: {
                'Authorization': 'token ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: '🗑️ 删除: ' + path,
                sha: sha,
                branch: branch
            })
        }
    );

    if (!response.ok) {
        var text = await response.text();
        var errMsg = text;
        try { var j = JSON.parse(text); errMsg = j.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }
    return await response.json();
}

// ===== 解析 Frontmatter（含作者信息） =====
export function parseFrontmatter(raw, filename) {
    var frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    var match = raw.match(frontmatterRegex);

    if (!match) {
        return {
            title: filename.replace('.md', ''),
            slug: filename.replace('.md', ''),
            summary: '',
            category: '未分类',
            content: raw,
            is_public: true,
            reading_points: 0,
            created_at: new Date().toISOString(),
            cover_url: '',
            author_nickname: '',
            author_email: ''
        };
    }

    var frontmatterStr = match[1];
    var content = match[2].trim();
    var lines = frontmatterStr.split('\n');
    var data = {};
    var currentKey = '';
    var currentValue = '';

    for (var i = 0; i < lines.length; i++) {
        var trimmed = lines[i].trim();
        if (!trimmed) continue;
        var colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) {
            if (currentKey) currentValue += '\n' + trimmed;
            continue;
        }
        var key = trimmed.substring(0, colonIndex).trim();
        var value = trimmed.substring(colonIndex + 1).trim();
        if (value === '|' || value === '>') {
            currentKey = key;
            currentValue = '';
            continue;
        }
        data[key] = value;
        currentKey = '';
        currentValue = '';
    }

    if (currentKey && currentValue) {
        data[currentKey] = currentValue.trim();
    }

    return {
        title: data.title || filename.replace('.md', ''),
        slug: data.slug || filename.replace('.md', ''),
        summary: data.summary || '',
        category: data.category || '未分类',
        content: content,
        is_public: data.is_public !== 'false',
        reading_points: parseInt(data.reading_points) || 0,
        created_at: data.created_at || new Date().toISOString(),
        cover_url: data.cover_url || '',
        // ★ 解析作者信息 ★
        author_nickname: data.author_nickname || '',
        author_email: data.author_email || ''
    };
}

// ===== 生成 Slug =====
export function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);
}

// ===== 构建 Frontmatter 内容（含作者信息） =====
export function buildFullContent(title, slug, category, points, summary, cover, content, authorNickname, authorEmail) {
    var frontmatter = '---\ntitle: ' + title + '\nslug: ' + slug + '\ncategory: ' + category + '\nreading_points: ' + (parseInt(points) || 0) + '\nsummary: ' + (summary.trim() || '') + '\ncover_url: ' + (cover.trim() || '') + '\nis_public: true\ncreated_at: ' + new Date().toISOString() + '\n';
    // ★ 写入作者信息 ★
    if (authorNickname) frontmatter += 'author_nickname: ' + authorNickname + '\n';
    if (authorEmail) frontmatter += 'author_email: ' + authorEmail + '\n';
    frontmatter += '---\n\n';
    return frontmatter + content;
}