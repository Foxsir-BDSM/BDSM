import { PROJECTS } from './config.js';

export function getAllProjects() {
  return PROJECTS;
}

export function getVisibleProjects(role) {
  return PROJECTS.filter((project) => {
    if (project.status === 'offline') return false;
    if (project.status === 'maintenance' && !['admin', 'subadmin'].includes(role)) {
      return false;
    }
    return project.requiredRoles.includes(role);
  });
}

// ★★★ 新增：获取角色可访问的项目 ID 列表（用于其他模块判断） ★★★
export function getVisibleProjectIds(role) {
  return getVisibleProjects(role).map((p) => p.id);
}

export function getProjectStatus(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  return project ? project.status : null;
}
