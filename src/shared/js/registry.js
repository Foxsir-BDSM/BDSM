// ================================================================
// src/shared/js/registry.js
// 功能：项目注册表查询函数
// ================================================================

import { PROJECTS } from './config.js';
import { RELAXED_ACCESS } from '@/shared/config/access.js';

/**
 * 获取所有项目
 */
export function getAllProjects() {
  return PROJECTS;
}

/**
 * 根据角色获取可见项目
 *
 * 放宽模式（RELAXED_ACCESS = true）：
 *   跳过角色白名单与维护态限制，向所有访问者展示全部已上线模块。
 * 管控模式：
 *   按 status + requiredRoles 过滤。
 */
export function getVisibleProjects(role) {
  if (RELAXED_ACCESS) {
    return PROJECTS.filter((project) => project.status !== 'offline');
  }
  return PROJECTS.filter((project) => {
    if (project.status === 'offline') return false;
    if (project.status === 'maintenance' && !['admin', 'subadmin'].includes(role)) {
      return false;
    }
    return project.requiredRoles.includes(role);
  });
}

/**
 * 获取角色可访问的项目 ID 列表
 */
export function getVisibleProjectIds(role) {
  return getVisibleProjects(role).map((p) => p.id);
}

/**
 * 获取项目状态
 */
export function getProjectStatus(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  return project ? project.status : null;
}