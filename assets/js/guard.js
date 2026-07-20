// ================================================================
// assets/js/guard.js
// 功能：权限路由守卫（访客仅限 Landing/About/Auth）
// 优化：增加防重入保护，避免无限重定向循环
// ================================================================

import { getCurrentUser } from './auth.js';
import { getUserRole } from './identity.js';

// ===== 公开路由白名单（访客可访问） =====
// 访客仅能访问展示页、关于页、登录页
const PUBLIC_ROUTES = [
  '/landing.html',
  '/about.html',
  '/auth.html',
];

// 防重入标记
let guardRunning = false;

/**
 * 判断当前路径是否在白名单中
 */
function isPublicRoute(path) {
  if (PUBLIC_ROUTES.includes(path)) return true;
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
  return `${target}?redirect=${encodeURIComponent(currentPath)}`;
}

/**
 * 初始化路由守卫
 */
export async function initGuard() {
  // 防止同一页面多次同时执行守卫
  if (guardRunning) return;
  guardRunning = true;

  try {
    const user = await getCurrentUser();
    const role = await getUserRole();
    const currentPath = getCurrentPath();

    // ===== 情况 1：已登录（非访客角色） =====
    if (user && role && role !== 'guest') {
      // 已登录用户在 landing 页 → 跳转到首页
      if (currentPath === '/landing.html') {
        window.location.href = '/index.html';
        guardRunning = false;
        return;
      }
      // 已登录用户在 auth 页 → 跳转到首页（避免登录后停留）
      if (currentPath === '/auth.html') {
        window.location.href = '/index.html';
        guardRunning = false;
        return;
      }
      // 其他页面直接放行
      guardRunning = false;
      return;
    }

    // ===== 情况 2：未登录（访客） =====

    // 如果访问的是根路径或 index.html → 直接跳转到 landing
    if (currentPath === '/' || currentPath === '/index.html') {
      window.location.href = '/landing.html';
      guardRunning = false;
      return;
    }

    // 如果访问的是公开路由（Landing/About/Auth）→ 放行
    if (isPublicRoute(currentPath)) {
      guardRunning = false;
      return;
    }

    // 如果访问的是受保护页面 → 跳转到 Landing
    const redirectUrl = getRedirectUrl('/landing.html');
    window.location.href = redirectUrl;
    guardRunning = false;
  } catch (err) {
    console.error('Guard 执行出错:', err);
    guardRunning = false;
    // 出错时保守处理：若当前不在公开路由，跳转到 landing
    const currentPath = getCurrentPath();
    if (!isPublicRoute(currentPath) && currentPath !== '/landing.html') {
      window.location.href = '/landing.html';
    }
  }
}

/**
 * 检查用户是否有权限访问某模块
 * 访客无权访问任何模块
 */
export function hasModuleAccess(moduleId, userRole) {
  if (userRole === 'guest') return false;
  return true;
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