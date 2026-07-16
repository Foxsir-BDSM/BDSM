import { signIn, signOut, signUp, onAuthStateChange } from './auth.js';
import { getCurrentUser, getUserRole } from './identity.js';
import { renderLauncher } from './launcher.js';
import { showToast } from './ui-helpers.js';

// 角色中文映射
const roleMap = {
  guest: '访客',
  self: '普通用户',
  verified: '已认证用户',
  subadmin: '次级管理',
  admin: '根源管理',
};

// DOM 引用
const userSection = document.getElementById('userSection');
const projectGrid = document.getElementById('projectGrid');

// 渲染用户区域
async function renderUserSection() {
  const user = await getCurrentUser();
  const role = await getUserRole();

  if (!user) {
    // 未登录：显示游客入口 + 登录/注册表单
    userSection.innerHTML = `
      <div class="guest-actions">
        <span class="user-info">👤 游客模式</span>
        <div>
          <button id="loginBtn" class="btn">登录</button>
          <button id="registerBtn" class="btn btn-outline">注册</button>
        </div>
      </div>
      <div id="authFormContainer" style="margin-top: 1rem; display: none;">
        <form id="authForm">
          <input type="email" id="emailInput" placeholder="邮箱" required autocomplete="email">
          <input type="password" id="passwordInput" placeholder="密码（至少6位）" required autocomplete="current-password">
          <button type="submit" class="btn" id="authSubmitBtn">提交</button>
          <button type="button" class="btn btn-outline" id="cancelAuthBtn">取消</button>
        </form>
      </div>
    `;
    // 绑定事件在下方统一处理
  } else {
    // 已登录
    const email = user.email;
    const avatar = user.user_metadata?.avatar_url || '👤';
    const displayRole = roleMap[role] || role;
    const isAdmin = ['admin', 'subadmin'].includes(role);
    const adminButton = isAdmin
      ? `<a href="/admin.html" class="btn btn-outline">⚙️ 管理面板</a>`
      : '';

    userSection.innerHTML = `
      <div class="user-info">
        <div class="avatar">${avatar}</div>
        <div>
          <strong>${email}</strong>
          <span style="font-size:0.8rem; color:#64748b; margin-left:0.5rem;">角色: ${displayRole}</span>
        </div>
      </div>
      <div class="user-actions">
        ${adminButton}
        <button id="logoutBtn" class="btn btn-danger">登出</button>
      </div>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await signOut();
      showToast('已登出');
      renderAll();
    });
  }

  // 绑定登录/注册事件（未登录时）
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const authFormContainer = document.getElementById('authFormContainer');
  const cancelAuthBtn = document.getElementById('cancelAuthBtn');
  const authForm = document.getElementById('authForm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      authFormContainer.style.display = 'block';
      authSubmitBtn.textContent = '登录';
      authForm.dataset.mode = 'login';
    });
  }
  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      authFormContainer.style.display = 'block';
      authSubmitBtn.textContent = '注册';
      authForm.dataset.mode = 'register';
    });
  }
  if (cancelAuthBtn) {
    cancelAuthBtn.addEventListener('click', () => {
      authFormContainer.style.display = 'none';
    });
  }
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('emailInput').value.trim();
      const password = document.getElementById('passwordInput').value.trim();
      const mode = authForm.dataset.mode;

      if (!email || !password) {
        showToast('请输入邮箱和密码', 'error');
        return;
      }
      if (password.length < 6) {
        showToast('密码至少6位', 'error');
        return;
      }

      let result;
      if (mode === 'login') {
        result = await signIn(email, password);
      } else {
        result = await signUp(email, password);
      }

      if (result.error) {
        showToast('操作失败: ' + result.error.message, 'error');
      } else {
        showToast(mode === 'login' ? '登录成功' : '注册成功，请查收验证邮件（若需）');
        authFormContainer.style.display = 'none';
        renderAll();
      }
    });
  }
}

// 主渲染函数
async function renderAll() {
  await renderUserSection();
  await renderLauncher(projectGrid);
}

// 监听 Auth 状态变化
onAuthStateChange((event, session) => {
  renderAll();
});

// 初始化
renderAll();
window.renderAll = renderAll;
