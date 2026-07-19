// ================================================================
// assets/js/request.js
// 功能：统一请求超时封装 + 错误分类
// ================================================================

/**
 * 带超时的 Promise 包装器
 * @param {Promise} promise - 原始请求
 * @param {number} timeoutMs - 超时毫秒（默认 8000）
 * @param {string} errorMsg - 超时错误信息
 */
export function withTimeout(promise, timeoutMs = 8000, errorMsg = '请求超时，请检查网络') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * 分类错误类型
 * @param {Error} error
 * @returns {{ type: 'timeout'|'network'|'server'|'auth'|'unknown', message: string }}
 */
export function classifyError(error) {
  if (!error) return { type: 'unknown', message: '未知错误' };
  const msg = error.message || String(error);

  if (msg.includes('超时') || msg.includes('timeout') || msg.includes('Timeout')) {
    return { type: 'timeout', message: '请求超时，请检查网络' };
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('网络')) {
    return { type: 'network', message: '网络连接失败，请检查网络设置' };
  }
  if (msg.includes('HTTP 500') || msg.includes('500')) {
    return { type: 'server', message: '服务器暂时不可用，请稍后重试' };
  }
  if (msg.includes('HTTP 404')) {
    return { type: 'server', message: '请求的资源不存在' };
  }
  if (msg.includes('Invalid login') || msg.includes('invalid_credentials') || msg.includes('认证')) {
    return { type: 'auth', message: '邮箱或密码错误' };
  }
  if (msg.includes('already registered') || msg.includes('User already')) {
    return { type: 'auth', message: '该邮箱已被注册' };
  }
  return { type: 'unknown', message: msg };
}

/**
 * 安全执行异步函数（自动捕获错误并分类）
 * @param {Function} fn - 异步函数
 * @param {Function} onError - 错误回调 (type, message)
 * @param {number} timeout - 超时毫秒
 * @returns {Promise<{ data: any, error: null } | { data: null, error: { type, message } }>}
 */
export async function safeAsync(fn, onError = null, timeout = 8000) {
  try {
    const result = await withTimeout(fn(), timeout);
    return { data: result, error: null };
  } catch (err) {
    const classified = classifyError(err);
    if (onError) {
      onError(classified.type, classified.message);
    }
    return { data: null, error: classified };
  }
}