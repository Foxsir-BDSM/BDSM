// 职责    内容管理：内容列表读取、发布、删除（对接 GitHub 仓库 foxsir-content）。
// 归属页面 管理后台的内容管理页
// 依赖    content-config.js
// 被依赖   内容管理页面
//
// 维护提示
//   · 仓库 / 分支 / 路径在 content-config.js。
//   · ⚠️ VITE_GITHUB_TOKEN 会被 Vite 内联进前端产物，属已知安全债。
import { CONTENT_CONFIG } from './content-config.js';
import { getCache, setCache, clearCache, getCacheWithMeta, setCacheWithMeta, DEFAULT_TTL } from '@/shared/js/cache.js';

// ===== 获取 Token（环境变量优先） =====
export function getToken() {
    // 优先从环境变量读取（Vercel 生产环境）
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GITHUB_TOKEN) {
        return import.meta.env.VITE_GITHUB_TOKEN;
    }

    // 降级：从 localStorage 读取（本地开发备用）
    const token = localStorage.getItem('foxsir_github_token');
    if (token && token.length > 10) {
        return token;
    }

    return null;
}

/**
 * 公开读取回退（无需 Token）
 *
 * 背景：仓库是公开的，列目录与读取正文本不需要鉴权。
 *       之前 list/read 一律要求 Token，导致未配置 Token 的环境
 *       （或在浏览器里没有手动填过 Token 的普通访客）看到的是
 *       「未配置 GitHub Token」而不是内容。
 *
 * 实现：走 jsDelivr 的公开元数据接口取文件清单，
 *       文件内容用 cdn.jsdelivr.net 直取。
 *
 * 返回结构与 GitHub contents API 对齐（name / download_url），
 * 便于上层代码无差别使用；download_url 指向 jsDelivr，
 * 故 fetchContentText 需能识别并直接以文本读取（见该函数注释）。
 */
async function fetchListViaCdn(branch, path) {
    const meta = 'https://data.jsdelivr.com/v1/packages/gh/'
        + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo
        + '@' + branch + '?structure=flat';

    const res = await fetch(meta);
    if (!res.ok) throw new Error('jsDelivr 元数据 HTTP ' + res.status);
    const data = await res.json();

    const prefix = '/' + String(path || '').replace(/^\/+|\/+$/g, '') + '/';
    return (data.files || [])
        .map((f) => f.name)
        .filter((n) => n.startsWith(prefix) && n.endsWith('.md'))
        .map((n) => {
            const name = n.slice(prefix.length);
            return {
                name,
                path: n.slice(1),
                // 走 CDN，读正文时无需鉴权
                download_url: 'https://cdn.jsdelivr.net/gh/'
                    + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo
                    + '@' + branch + n,
                _viaCdn: true,
            };
        });
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

    console.log('📡 未命中缓存或已过期，拉取列表:', cacheKey);

    const token = getToken();

    // ── 无 Token 时走公开 CDN 读取 ──
    // 仓库是公开的，列目录与读正文本不需要鉴权。
    // 之前这里无 Token 直接返回 []，导致普通访客看到的是「未配置 Token」
    // 而不是内容 —— 那是把「写入所需」误当成了「读取所需」。
    if (!token) {
        try {
            const files = await fetchListViaCdn(branch, path);
            setCacheWithMeta(cacheKey, files, DEFAULT_TTL);
            console.log('✅ 经 CDN 读取列表:', files.length, '个文件');
            return files;
        } catch (err) {
            console.error('CDN 读取列表失败:', err);
            const fallback = getCache(cacheKey);
            return fallback || [];
        }
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

        // ★ 把 download_url（raw.githubusercontent）换成 API 路径 ★
        // 原因：raw 是 CDN，带 cache-control: max-age=300，
        //       且按 Authorization 分缓存（vary: Authorization），
        //       加时间戳参数也无法绕过。结果是内容更新后匿名读取最多滞后 5 分钟。
        //       实测：同一文件首次迁移后匿名读 2439 字节（旧）、鉴权读 2451 字节（新）。
        //       API 路径始终返回最新内容，故正文统一走 API。
        files.forEach(function(f) {
            if (f && f.name) {
                f.download_url = 'https://api.github.com/repos/'
                    + CONTENT_CONFIG.owner + '/' + CONTENT_CONFIG.repo
                    + '/contents/' + path + '/' + encodeURIComponent(f.name)
                    + '?ref=' + branch;
            }
        });

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

// ===== 取单个文件的正文 =====
/**
 * 读取一篇内容的 Markdown 原文。
 *
 * 为什么单独封装：列表接口返回的 download_url 是 raw.githubusercontent（CDN，max-age=300，
 * 且按 Authorization 分缓存），内容刚更新时匿名读取会滞后最多 5 分钟。
 * fetchContentList 已把 download_url 改写成 GitHub API 地址，这里负责用 API 读取，
 * 并把 Base64 内容解码回文本。
 *
 * @param {string} apiUrl  fetchContentList 返回项的 download_url（已是 API 地址）
 * @returns {Promise<string>} Markdown 原文；失败返回空串
 */
export async function fetchContentText(apiUrl) {
    const url = String(apiUrl || '');

    // ── CDN 路径：公开直读纯文本，无需鉴权 ──
    // fetchListViaCdn() 产出的就是这种地址。
    if (url.includes('cdn.jsdelivr.net')) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error('CDN 读取内容失败 HTTP', res.status, url);
                return '';
            }
            return await res.text();
        } catch (err) {
            console.error('CDN 读取内容异常:', err);
            return '';
        }
    }

    // ── API 路径：需 Token，返回 Base64 ──
    const token = getToken();
    if (!token) {
        console.error('❌ 未配置 GitHub Token，无法经 API 读取内容');
        return '';
    }
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': 'token ' + token,
                'Accept': 'application/vnd.github+json',
            },
        });
        if (!res.ok) {
            console.error('读取内容失败 HTTP', res.status, url);
            return '';
        }
        const data = await res.json();

        // API 返回 Base64；中文需先还原为 UTF-8 字节再解码
        if (data && typeof data.content === 'string') {
            const bin = atob(String(data.content).replace(/\s/g, ''));
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        }

        // 兼容：若传入的是 raw 地址，退化为纯文本
        return typeof data === 'string' ? data : '';
    } catch (err) {
        console.error('读取内容异常:', err);
        return '';
    }
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