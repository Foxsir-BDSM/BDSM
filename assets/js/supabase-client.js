import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { withTimeout } from './request.js';

// 创建原始客户端
const rawSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// 需要超时包装的 auth 方法列表
const SENSITIVE_AUTH_METHODS = [
  'signInWithPassword',
  'signUp',
  'signOut',
  'getSession',
  'getUser',
  'refreshSession',
  'setSession',
];

// 代理整个客户端
export const supabase = new Proxy(rawSupabase, {
  get(target, prop) {
    const original = target[prop];

    // 【关键修复】专门处理 auth 对象
    if (prop === 'auth') {
      return new Proxy(original, {
        get(authTarget, authProp) {
          const authMethod = authTarget[authProp];
          if (typeof authMethod === 'function' && SENSITIVE_AUTH_METHODS.includes(authProp)) {
            // 返回带超时的包装函数
            return function (...args) {
              return withTimeout(
                authMethod.apply(authTarget, args),
                10000,
                `认证请求超时（${authProp}）`
              );
            };
          }
          // 非敏感方法（如 onAuthStateChange）保持原样
          if (typeof authMethod === 'function') {
            return authMethod.bind(authTarget);
          }
          return authMethod;
        }
      });
    }

    // 其他顶层属性/方法（如 from, storage 等）保持原样
    if (typeof original === 'function') {
      return original.bind(target);
    }
    return original;
  }
});

// 导出原始客户端（备用）
export { rawSupabase };

// 默认导出
export default supabase;