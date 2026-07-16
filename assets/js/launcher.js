import { getVisibleProjects } from './registry.js';
import { getUserRole } from './identity.js';

export async function renderLauncher(container) {
  const role = await getUserRole();
  const visible = getVisibleProjects(role);

  if (visible.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8;">当前没有可访问的项目，请稍后查看。</p>`;
    return;
  }

  container.innerHTML = visible
    .map(
      (project) => `
    <div class="project-card" data-status="${project.status}">
      <div class="icon">${project.icon || '📦'}</div>
      <h3>${project.name}</h3>
      <p>${project.description}</p>
      ${project.status === 'maintenance' ? '<span class="badge badge-maintenance">维护中</span>' : ''}
      <a href="${project.url}" class="enter-btn" 
         ${project.status === 'maintenance' ? 'onclick="return false;"' : ''}>
         进入
      </a>
    </div>
  `
    )
    .join('');
}
