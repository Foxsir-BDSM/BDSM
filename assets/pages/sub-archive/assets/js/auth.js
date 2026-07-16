// ============================================================
// sub-archive/assets/js/auth.js
// F002 修复：重新导出全局 auth 模块，统一认证来源
// 所有现有 import 语句无需改动，自动使用全局 Supabase 项目
// ============================================================

export * from '/assets/js/auth.js';

// 为了兼容子项目中可能直接使用的 supabase 实例
// 重新导出 supabase（从全局模块中获取）
export { supabase } from '/assets/js/auth.js';

// 兼容旧版函数名（如果子项目中有使用 getCurrentUser/getCurrentRole）
// 注意：全局 auth.js 导出的是 getSession，而非 getCurrentUser
// 这里做适配
import { getSession } from '/assets/js/auth.js';

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function getCurrentRole() {
  const session = await getSession();
  return session?.user?.user_metadata?.role || null;
}

// 兼容 isAdmin（全局使用 role 字段，值为 'admin' 或 'subadmin'）
export async function isAdmin() {
  const role = await getCurrentRole();
  return role === 'admin' || role === 'subadmin';
}