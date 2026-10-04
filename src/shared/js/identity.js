// 职责    当前用户与角色的读取封装（只读）。
// 归属页面 全站
// 依赖    shared/js/supabase-client.js
// 被依赖   被 8 个文件依赖 —— 全站被依赖最多的模块
//
// 维护提示
//   · ★ 改动影响面最大，修改函数签名前请全局搜索调用点。
//   · 角色值来自 Supabase 的 user_metadata.role，属于客户端可读字段。
import { supabase } from '@/shared/js/supabase-client.js';

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getUserRole() {
  const user = await getCurrentUser();
  if (!user) return 'guest';
  return user.user_metadata?.role || 'guest';
}

// ★★★ 新增：获取用户昵称 ★★★
export async function getUserNickname() {
  const user = await getCurrentUser();
  if (!user) return null;
  const nickname = user.user_metadata?.nickname;
  if (nickname && nickname.trim()) return nickname.trim();
  return user.email; // 回退到邮箱
}

export async function getUserAvatar() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.user_metadata?.avatar_url || null;
}

export async function getUserMetadata() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.user_metadata || {};
}
