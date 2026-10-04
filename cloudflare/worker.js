// ============================================================
// cloudflare/worker.js —— 欲炼之途 · 任务与媒体后端
// ============================================================
//
// 【职责】把需要服务端能力的三件事收口到一处：
//   ① 任务接取记录  → D1（谁接了什么、完成没有）
//   ② 媒体上传      → R2（图片等文件）
//   ③ 内容发布      → GitHub（用服务端 Token 提交，前端看不到 Token）
//
// 【为什么需要它】
//   浏览器直连这些服务会暴露密钥、且无法做越权校验。
//   例如：Zite 的 API Key 是全局权限，谁拿到都能改别人的记录；
//        GitHub Token 若打进前端产物，F12 就能拿到并删改整个仓库。
//   本 Worker 把密钥留在服务端，并按登录用户身份限制只能操作自己的数据。
//
// 【鉴权方式】
//   前端带 Supabase 的 access_token，本 Worker 向 Supabase 的
//   /auth/v1/user 校验该 token，拿到可信的 user.id。
//   —— 不自己解 JWT，避免签名算法与密钥轮换带来的坑。
//
// 【路由】
//   GET    /health                     健康检查（无需登录）
//   POST   /api/tasks/accept           { taskSlug, taskTitle, taskType }
//   GET    /api/tasks/mine             我的任务列表
//   PATCH  /api/tasks/:slug            { status, feedbackSlug }
//   POST   /api/media                  上传媒体（multipart/form-data: file）
//   POST   /api/content                发布内容（代理 GitHub）
//
// 【Secrets（用 wrangler secret put 配置）】
//   SUPABASE_URL          Supabase 项目地址
//   SUPABASE_ANON_KEY     Supabase anon key（用于校验用户 token）
//   GITHUB_TOKEN          细粒度 PAT，仅 Foxsir-BDSM/foxsir-content 的 Contents 读写
//
// 【Bindings（在 wrangler.toml 配置）】
//   DB   D1 数据库
//   BUCKET R2 存储桶
// ============================================================

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

/** 允许的前端来源 */
const ALLOWED_ORIGINS = [
  'https://www.foxsir.top',
  'https://foxsir.top',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (data, status, origin) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin) },
  });

const ok = (data, origin) => json(data, 200, origin);
const bad = (msg, status = 400, origin) => json({ ok: false, error: msg }, status, origin);

/** 统一错误响应，避免把内部异常细节暴露给前端 */
const fail = (msg, origin) => json({ ok: false, error: msg }, 500, origin);

/**
 * 校验用户身份
 * @returns {Promise<{id:string, email:string}|null>}
 */
async function authUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: u.email || '' };
  } catch {
    return null;
  }
}

/** 读取任务内容（从 GitHub 仓库取 frontmatter，用于冗余存标题） */
async function fetchContentMeta(env, slug) {
  const owner = env.CONTENT_OWNER || 'Foxsir-BDSM';
  const repo = env.CONTENT_REPO || 'foxsir-content';
  const branch = env.CONTENT_BRANCH || 'main';
  const dir = env.CONTENT_DIR || 'posts';
  try {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${dir}/${slug}.md?ref=${branch}`,
      {
        headers: {
          'User-Agent': 'foxsir-worker',
          Accept: 'application/vnd.github+json',
          ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
        },
      }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const text = atob(j.content.replace(/\n/g, ''));
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const meta = {};
    m[1].split('\n').forEach((line) => {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return meta;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// 任务接取
// ════════════════════════════════════════════════════════════

/** POST /api/tasks/accept */
async function acceptTask(request, env, user, origin) {
  let body;
  try { body = await request.json(); } catch { return bad('请求体不是合法 JSON', 400, origin); }

  const { taskSlug, taskTitle, taskType } = body || {};
  if (!taskSlug || typeof taskSlug !== 'string') return bad('缺少 taskSlug', 400, origin);
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(taskSlug)) return bad('taskSlug 格式不合法', 400, origin);

  // 已接取过就返回既有记录（幂等，避免重复点击报错）
  const exist = await env.DB.prepare(
    'SELECT * FROM task_acceptances WHERE user_id = ? AND task_slug = ?'
  ).bind(user.id, taskSlug).first();
  if (exist) return ok({ ok: true, already: true, task: exist }, origin);

  // 标题优先取内容仓库的真实标题，取不到再用前端传来的
  const meta = await fetchContentMeta(env, taskSlug);
  const title = (meta && meta.title) || taskTitle || taskSlug;
  const type = (meta && meta.content_type) || taskType || '';

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO task_acceptances
       (id, user_id, task_slug, task_title, task_type, status, accepted_at)
     VALUES (?, ?, ?, ?, ?, 'accepted', ?)`
  ).bind(id, user.id, taskSlug, title, type, now).run();

  const row = await env.DB.prepare('SELECT * FROM task_acceptances WHERE id = ?').bind(id).first();
  return ok({ ok: true, already: false, task: row }, origin);
}

/** GET /api/tasks/mine?status=accepted|submitted|all */
async function myTasks(request, env, user, origin) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';

  let sql = 'SELECT * FROM task_acceptances WHERE user_id = ?';
  const args = [user.id];
  if (status === 'accepted' || status === 'submitted') {
    sql += ' AND status = ?';
    args.push(status);
  }
  sql += ' ORDER BY accepted_at DESC LIMIT 200';

  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return ok({ ok: true, tasks: results || [] }, origin);
}

/** PATCH /api/tasks/:slug   { status, feedbackSlug } */
async function updateTask(request, env, user, slug, origin) {
  let body;
  try { body = await request.json(); } catch { return bad('请求体不是合法 JSON', 400, origin); }
  const { status, feedbackSlug } = body || {};

  if (status && !['accepted', 'submitted'].includes(status)) {
    return bad('status 只能是 accepted 或 submitted', 400, origin);
  }

  const own = await env.DB.prepare(
    'SELECT id FROM task_acceptances WHERE user_id = ? AND task_slug = ?'
  ).bind(user.id, slug).first();
  if (!own) return bad('未找到该任务接取记录', 404, origin);

  const sets = [];
  const args = [];
  if (status) { sets.push('status = ?'); args.push(status); }
  if (feedbackSlug) { sets.push('feedback_slug = ?'); args.push(feedbackSlug); }
  if (status === 'submitted') { sets.push('submitted_at = ?'); args.push(new Date().toISOString()); }
  if (!sets.length) return bad('没有要更新的字段', 400, origin);

  args.push(user.id, slug);
  await env.DB.prepare(
    `UPDATE task_acceptances SET ${sets.join(', ')} WHERE user_id = ? AND task_slug = ?`
  ).bind(...args).run();

  const row = await env.DB.prepare(
    'SELECT * FROM task_acceptances WHERE user_id = ? AND task_slug = ?'
  ).bind(user.id, slug).first();
  return ok({ ok: true, task: row }, origin);
}

// ════════════════════════════════════════════════════════════
// 媒体
// ════════════════════════════════════════════════════════════

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;   // 单文件 20MB
const ALLOWED_MEDIA = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm',
];

/** POST /api/media   multipart/form-data: file */
async function uploadMedia(request, env, user, origin) {
  if (!env.BUCKET) return bad('未配置 R2 存储桶', 503, origin);

  let form;
  try { form = await request.formData(); } catch { return bad('请求不是 multipart/form-data', 400, origin); }

  const file = form.get('file');
  if (!file || typeof file === 'string') return bad('缺少 file 字段', 400, origin);

  const type = file.type || 'application/octet-stream';
  if (!ALLOWED_MEDIA.includes(type)) {
    return bad(`不支持的文件类型：${type}`, 415, origin);
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return bad(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 20MB`, 413, origin);
  }

  const ext = (file.name && file.name.includes('.'))
    ? file.name.split('.').pop().toLowerCase().slice(0, 8)
    : (type.split('/')[1] || 'bin');
  const key = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000' },
  });

  const base = env.R2_PUBLIC_BASE || '';
  const url = base ? `${base.replace(/\/$/, '')}/${key}` : '';

  await env.DB.prepare(
    `INSERT INTO media_objects (id, user_id, r2_key, url, filename, content_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, key, url, file.name || '', type, file.size, new Date().toISOString()).run();

  return ok({ ok: true, key, url, size: file.size, contentType: type }, origin);
}

// ════════════════════════════════════════════════════════════
// 内容发布（代理 GitHub，Token 只存在服务端）
// ════════════════════════════════════════════════════════════

/** POST /api/content   { slug, content(Base64 后的 markdown 文本), message } */
async function publishContent(request, env, user, origin) {
  if (!env.GITHUB_TOKEN) return bad('未配置 GITHUB_TOKEN', 503, origin);

  let body;
  try { body = await request.json(); } catch { return bad('请求体不是合法 JSON', 400, origin); }

  const { slug, content, message } = body || {};
  if (!slug || !content) return bad('缺少 slug 或 content', 400, origin);
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(slug)) return bad('slug 格式不合法', 400, origin);

  const owner = env.CONTENT_OWNER || 'Foxsir-BDSM';
  const repo = env.CONTENT_REPO || 'foxsir-content';
  const branch = env.CONTENT_BRANCH || 'main';
  const dir = env.CONTENT_DIR || 'posts';
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}/${slug}.md`;

  const ghHeaders = {
    'User-Agent': 'foxsir-worker',
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 已存在则取出 sha（GitHub 更新文件必须带 sha）
  let sha;
  const head = await fetch(`${api}?ref=${branch}`, { headers: ghHeaders });
  if (head.ok) {
    const hj = await head.json();
    sha = hj.sha;
  }

  const put = await fetch(api, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: message || `post(${slug}): 发布`,
      content: btoa(unescape(encodeURIComponent(content))),   // 处理中文
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    const t = await put.text();
    return json({ ok: false, error: 'GitHub 提交失败', detail: t.slice(0, 300) }, 502, origin);
  }

  const pj = await put.json();
  return ok({ ok: true, slug, commit: pj.commit && pj.commit.sha }, origin);
}

// ════════════════════════════════════════════════════════════
// 入口
// ════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();

    // 预检
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (path === '/health') {
      return ok({ ok: true, service: 'foxsir-task-api', ts: new Date().toISOString() }, origin);
    }

    // 以下全部需要登录
    const user = await authUser(request, env);
    if (!user) return bad('未登录或登录已过期', 401, origin);

    try {
      if (path === '/api/tasks/accept' && method === 'POST') return await acceptTask(request, env, user, origin);
      if (path === '/api/tasks/mine' && method === 'GET') return await myTasks(request, env, user, origin);
      if (path === '/api/media' && method === 'POST') return await uploadMedia(request, env, user, origin);
      if (path === '/api/content' && method === 'POST') return await publishContent(request, env, user, origin);

      const m = path.match(/^\/api\/tasks\/([^/]+)$/);
      if (m && method === 'PATCH') return await updateTask(request, env, user, decodeURIComponent(m[1]), origin);

      return bad('未找到该接口', 404, origin);
    } catch (err) {
      console.error('[worker] 处理失败:', err && err.stack ? err.stack : err);
      return fail('服务器内部错误', origin);
    }
  },
};
