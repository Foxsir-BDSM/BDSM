// ================================================================
// assets/js/guard.js
// 功能：四级权限路由守卫（访客/注册/次级/管理员）
// v2.1 新增：公开路由白名单 + redirect 回跳
// 修复：已登录用户在首页不再自我刷新
// ================================================================

import { getCurrentUser } from './auth.js';
import { getUserRole } from './identity.js';

// ===== 公开路由白名单（访客可直接访问） =====
// 注意：'/' 和 '/index.html' 不在白名单中，会被重定向到 landing
const PUBLIC_ROUTES = [
  '/landing.html',
  '/about.html',
  '/module.html',
  '/auth.html',
  '/assets/pages/knowledge/index.html',
  '/assets/pages/knowledge/',
];

/**
 * 判断当前路径是否在白名单中
 */
function isPublicRoute(path) {
  if (PUBLIC_ROUTES.includes(path)) return true;
  if (path.startsWith('/module.html')) return true;
  if (path.startsWith('/assets/pages/knowledge/')) return true;
  return false;
}

/**
 * 获取当前访问路径
 */
function getCurrentPath() {
  return window.location.pathname;
}

/**
 * 获取重定向目标（含回跳参数）
 */
function getRedirectUrl(target = '/landing.html') {
  const currentPath = window.location.pathname + window.location.search;
  if (isPublicRoute(getCurrentPath())) {
    return target;
  }
  return `${target}?redirect=${encodeURIComponent(currentPath)}`;
}

/**
 * 初始化路由守卫
 */
export async function initGuard() {
  const user = await getCurrentUser();
  const role = await getUserRole();
  const currentPath = getCurrentPath();

  // ===== 情况 1：已登录 =====
  if (user && role && role !== 'guest') {
    // 已登录用户在 landing 页 → 跳转到首页
    if (currentPath === '/landing.html') {
      window.location.href = '/index.html';
      return;
    }
    // 已登录用户在首页 → 直接放行（不再自我刷新）
    if (currentPath === '/' || currentPath === '/index.html') {
      return;
    }
    // 已登录用户在其他受保护页面 → 放行
    return;
  }

  // ===== 情况 2：未登录（访客） =====

  // 如果访问的是根路径或 index.html → 直接跳转到 landing
  if (currentPath === '/' || currentPath === '/index.html') {
    window.location.href = '/landing.html';
    return;
  }

  // 如果访问的是公开路由 → 放行
  if (isPublicRoute(currentPath)) {
    return;
  }

  // 如果访问的是受保护页面 → 跳转到 Landing 并携带回跳
  const redirectUrl = getRedirectUrl('/landing.html');
  window.location.href = redirectUrl;
}

/**
 * 检查用户是否有权限访问某模块
 */
export function hasModuleAccess(moduleId, userRole) {
  const publicModules = ['knowledge'];
  if (publicModules.includes(moduleId)) return true;
  return userRole && userRole !== 'guest';
}

/**
 * 获取回跳参数
 */
export function getRedirectParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('redirect');
}

// 自动执行守卫
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGuard);
} else {
  initGuard();
}