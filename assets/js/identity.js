import { supabase } from './supabase-client.js';

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
