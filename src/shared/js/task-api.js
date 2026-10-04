// 职责    任务与媒体后端的调用封装（Cloudflare Worker）。
// 归属页面 欲炼之途的内容详情/列表、我的页面、首页任务直达
// 依赖    shared/js/config.js、shared/js/supabase-client.js
//
// 维护提示
//   · 后端地址在 shared/js/config.js 的 TASK_API_BASE；留空则全部功能降级为不可用。
//   · 所有写操作都会带当前登录用户的 access_token，后端据此限制只能操作自己的数据。
//   · ★ 不要在这里放任何密钥 —— 前端代码会原样进入构建产物。
import { TASK_API_BASE, hasTaskApi } from './config.js';
import { supabase } from './supabase-client.js';

/** 取当前会话的 access_token（未登录返回空串） */
async function getToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
  } catch {
    return '';
  }
}

/**
 * 统一请求封装
 * @returns {Promise<{ok:boolean, data?:any, error?:string, status:number}>}
 */
async function call(path, { method = 'GET', body, formData } = {}) {
  if (!hasTaskApi()) {
    return { ok: false, status: 0, error: '任务后端尚未配置' };
  }

  const token = await getToken();
  if (!token) return { ok: false, status: 401, error: '请先登录' };

  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (formData) {
    payload = formData;                       // 交给浏览器自动设置 multipart 边界
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  try {
    const r = await fetch(`${TASK_API_BASE.replace(/\/$/, '')}${path}`, {
      method,
      headers,
      body: payload,
    });
    let j = null;
    try { j = await r.json(); } catch { /* 非 JSON 响应 */ }
    if (!r.ok) {
      return { ok: false, status: r.status, error: (j && j.error) || `HTTP ${r.status}` };
    }
    return { ok: true, status: r.status, data: j };
  } catch (err) {
    return { ok: false, status: 0, error: '网络异常：' + (err.message || err) };
  }
}

// ────────────────────────────────────────────── 任务

/** 接取任务（幂等：已接取过会返回既有记录） */
export async function acceptTask({ slug, title, type }) {
  const r = await call('/api/tasks/accept', {
    method: 'POST',
    body: { taskSlug: slug, taskTitle: title, taskType: type },
  });
  return r.ok
    ? { ok: true, task: r.data.task, already: !!r.data.already }
    : { ok: false, error: r.error };
}

/**
 * 我的任务列表
 * @param {'accepted'|'submitted'|'all'} status
 */
export async function myTasks(status = 'all') {
  const r = await call(`/api/tasks/mine?status=${encodeURIComponent(status)}`);
  return r.ok ? { ok: true, tasks: r.data.tasks || [] } : { ok: false, error: r.error };
}

/** 更新任务状态（提交反馈时调用） */
export async function updateTask(slug, { status, feedbackSlug } = {}) {
  const r = await call(`/api/tasks/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: { status, feedbackSlug },
  });
  return r.ok ? { ok: true, task: r.data.task } : { ok: false, error: r.error };
}

// ────────────────────────────────────────────── 媒体

/**
 * 上传媒体文件
 * @param {File} file
 * @returns {Promise<{ok:boolean, url?:string, key?:string, error?:string}>}
 */
export async function uploadMedia(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await call('/api/media', { method: 'POST', formData: fd });
  return r.ok
    ? { ok: true, url: r.data.url, key: r.data.key }
    : { ok: false, error: r.error };
}

/**
 * 上传多个文件，逐个进行，单个失败不影响其余
 * @param {File[]} files
 * @returns {Promise<{urls:string[], failed:{name:string,error:string}[]}>}
 */
export async function uploadMediaMany(files) {
  const urls = [];
  const failed = [];
  for (const f of files) {
    const r = await uploadMedia(f);
    if (r.ok) urls.push(r.url);
    else failed.push({ name: f.name, error: r.error });
  }
  return { urls, failed };
}

// ────────────────────────────────────────────── 内容发布

/**
 * 发布内容到 GitHub（经后端代理，Token 不出服务端）
 * @param {{slug:string, content:string, message?:string}} payload
 */
export async function publishContent({ slug, content, message }) {
  const r = await call('/api/content', {
    method: 'POST',
    body: { slug, content, message },
  });
  return r.ok ? { ok: true, commit: r.data.commit } : { ok: false, error: r.error };
}

/** 后端是否可用 */
export const taskApiReady = hasTaskApi;
