// ================================================================
// assets/js/content-manager.js
// 功能：GitHub 内容管理 CRUD 操作（知识区 / 任务区共用）
// ================================================================

import { CONTENT_CONFIG } from './content-config.js';

// ===== 获取 Token =====
export function getToken() {
    const token = localStorage.getItem('foxsir_github_token');
    if (token && token.length > 10) return token;
    return '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';
}

// ===== 获取文件列表 =====
export async function fetchContentList(branch, path) {
    const token = getToken();
    const url = `https://api.github.com/repos/${CONTENT_CONFIG.owner}/${CONTENT_CONFIG.repo}/contents/${path}?ref=${branch}`;
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) return [];
        return data.filter(f => f && f.name && f.name.endsWith('.md'));
    } catch (err) {
        console.error('获取列表失败:', err);
        return [];
    }
}

// ===== 获取文件 SHA（用于更新/删除） =====
export async function getFileSha(branch, path) {
    const token = getToken();
    const url = `https://api.github.com/repos/${CONTENT_CONFIG.owner}/${CONTENT_CONFIG.repo}/contents/${path}?ref=${branch}`;
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${token}` }
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
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let binary = '';
    data.forEach(byte => binary += String.fromCharCode(byte));
    const contentBase64 = btoa(binary);

    // 检查是否存在（获取 SHA）
    let sha = null;
    try {
        const check = await fetch(
            `https://api.github.com/repos/${CONTENT_CONFIG.owner}/${CONTENT_CONFIG.repo}/contents/${path}?ref=${branch}`,
            { headers: { 'Authorization': `token ${token}` } }
        );
        if (check.ok) {
            const existing = await check.json();
            sha = existing.sha;
        }
    } catch (_) {}

    const payload = {
        message: message || `📝 更新内容: ${path}`,
        content: contentBase64,
        branch: branch,
    };
    if (sha) payload.sha = sha;

    const response = await fetch(
        `https://api.github.com/repos/${CONTENT_CONFIG.owner}/${CONTENT_CONFIG.repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        let errMsg = text;
        try { const j = JSON.parse(text); errMsg = j.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }
    return await response.json();
}

// ===== 删除文件 =====
export async function deleteContent(branch, path) {
    const token = getToken();
    const sha = await getFileSha(branch, path);
    if (!sha) throw new Error('文件不存在');

    const response = await fetch(
        `https://api.github.com/repos/${CONTENT_CONFIG.owner}/${CONTENT_CONFIG.repo}/contents/${path}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `🗑️ 删除: ${path}`,
                sha: sha,
                branch: branch,
            }),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        let errMsg = text;
        try { const j = JSON.parse(text); errMsg = j.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }
    return await response.json();
}

// ===== 解析 Frontmatter =====
export function parseFrontmatter(raw, filename) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = raw.match(frontmatterRegex);

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
            cover_url: ''
        };
    }

    const frontmatterStr = match[1];
    const content = match[2].trim();

    const lines = frontmatterStr.split('\n');
    const data = {};
    let currentKey = '';
    let currentValue = '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) {
            if (currentKey) currentValue += '\n' + trimmed;
            continue;
        }
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();
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
        cover_url: data.cover_url || ''
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

// ===== 构建 Frontmatter 内容 =====
export function buildFullContent(title, slug, category, points, summary, cover, content) {
    const frontmatter = `---\ntitle: ${title}\nslug: ${slug}\ncategory: ${category}\nreading_points: ${parseInt(points) || 0}\nsummary: ${summary.trim() || ''}\ncover_url: ${cover.trim() || ''}\nis_public: true\ncreated_at: ${new Date().toISOString()}\n---\n\n`;
    return frontmatter + content;
}