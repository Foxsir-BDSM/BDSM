// ============================================================
// 管理面板主逻辑（Tab 切换 + 用户权限 + 下位档案管理）
// ============================================================

import { getCurrentUser, getUserRole } from '@/js/identity.js';
import { signOut } from '@/js/auth.js';
import { supabase } from '@/js/supabase-client.js';
import { showToast } from '@/js/ui-helpers.js';

// ----- 下位者档案馆 API 模块 -----
import {
  fetchAllRecords as fetchSubRecords,
  updateRecordFields,
  clearCache as clearSubCache,
} from '/assets/pages/sub-archive/assets/js/api.js';

// ============================================================
// 1. Tab 切换
// ============================================================
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    this.classList.add('active');
    const tabId = this.dataset.tab;
    document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
    document.getElementById(`pane-${tabId}`).classList.add('active');
  });
});

// ============================================================
// 2. 用户权限管理
// ============================================================

const userTableContainer = document.getElementById('userTableContainer');
const totalUsers = document.getElementById('totalUsers');
const pushBtn = document.getElementById('pushBtn');
const pushResult = document.getElementById('pushResult');

let allUsers = [];
let pendingChanges = {};

const ROLE_MAP = {
  self: '普通用户',
  verified: '认证用户',
  subadmin: '次级管理',
  admin: '根源管理',
};
const ROLE_VALUES = ['self', 'verified', 'subadmin', 'admin'];

async function loadUsers() {
  try {
    const { data, error } = await supabase.rpc('get_all_users');
    if (error) throw error;
    allUsers = data || [];
    renderUserTable();
    totalUsers.textContent = allUsers.length;
    pendingChanges = {};
  } catch (err) {
    showToast('加载用户列表失败: ' + err.message, 'error');
    console.error(err);
  }
}

function renderUserTable() {
  if (!allUsers.length) {
    userTableContainer.innerHTML = `<p class="empty">暂无用户数据</p>`;
    return;
  }

  let html = `<table class="admin-table">
    <thead><tr><th>邮箱</th><th>当前角色</th><th>新角色</th></tr></thead>
    <tbody>`;
  allUsers.forEach((u) => {
    const currentRole = u.role || 'self';
    const currentDisplay = ROLE_MAP[currentRole] || currentRole;
    const options = ROLE_VALUES.map((r) => {
      const display = ROLE_MAP[r] || r;
      return `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${display}</option>`;
    }).join('');
    html += `<tr data-email="${u.email}">
      <td>${u.email}</td>
      <td>${currentDisplay}</td>
      <td><select class="role-select" data-email="${u.email}">${options}</select></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  userTableContainer.innerHTML = html;

  document.querySelectorAll('.role-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const email = e.target.dataset.email;
      const newRole = e.target.value;
      const original = allUsers.find((u) => u.email === email)?.role || 'self';
      if (newRole !== original) {
        pendingChanges[email] = newRole;
      } else {
        delete pendingChanges[email];
      }
      pushBtn.disabled = Object.keys(pendingChanges).length === 0;
    });
  });
  pushBtn.disabled = true;
}

async function pushChanges() {
  const changes = Object.entries(pendingChanges);
  if (changes.length === 0) {
    showToast('没有待生效的变更', 'info');
    return;
  }

  pushBtn.disabled = true;
  pushBtn.textContent = '提交中...';
  pushResult.className = 'push-result';
  pushResult.textContent = '';

  let successCount = 0,
    failCount = 0;
  for (const [email, newRole] of changes) {
    try {
      const { data, error } = await supabase.rpc('update_user_role', {
        target_email: email,
        new_role: newRole,
      });
      if (error) throw error;
      if (data === true) {
        successCount++;
        const user = allUsers.find((u) => u.email === email);
        if (user) user.role = newRole;
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
      console.error('更新失败:', email, err);
    }
  }

  let msg = `✅ 成功更新 ${successCount} 位用户`;
  if (failCount > 0) msg += `，❌ 失败 ${failCount} 位`;
  pushResult.className = `push-result ${failCount === 0 ? 'success' : 'error'}`;
  pushResult.textContent = msg;

  pendingChanges = {};
  renderUserTable();
  await loadUsers();
  pushBtn.textContent = '📤 Push 生效';
  pushBtn.disabled = true;
  showToast(
    failCount === 0 ? '所有变更已生效' : '部分变更失败',
    failCount === 0 ? 'info' : 'error'
  );
}

// ============================================================
// 3. 下位档案管理
// ============================================================

const subRecordsContainer = document.getElementById('subRecordsContainer');
const subTotalCount = document.getElementById('subTotalCount');
const subSearchInput = document.getElementById('subSearchInput');

let subRecords = [];
let filteredSubRecords = [];
const SUB_EDITABLE_FIELDS = [
  '公开问卷',
  '常住地址（隐私确认）',
  '联系方式（隐私确认）',
  '生活照片（隐私确认）',
  '隐私照片（隐私确认）',
  '认证',
];

async function loadSubRecords() {
  try {
    console.log('📡 强制从服务器加载档案数据...');
    const records = await fetchSubRecords(true);
    subRecords = records;
    filteredSubRecords = records;
    renderSubTable();
    subTotalCount.textContent = records.length;
    console.log('✅ 档案数据加载完成，共', records.length, '条');
  } catch (err) {
    console.error('加载下位档案失败:', err);
    subRecordsContainer.innerHTML = `<p class="error">加载档案失败：${err.message}</p>`;
  }
}

function renderSubTable() {
  if (!filteredSubRecords.length) {
    subRecordsContainer.innerHTML = `<p class="empty">暂无档案记录</p>`;
    return;
  }

  let html = `<table class="admin-table">
    <thead><tr><th>姓名</th>`;
  SUB_EDITABLE_FIELDS.forEach((f) => {
    html += `<th>${f}</th>`;
  });
  html += `<th>操作</th></tr></thead><tbody>`;

  filteredSubRecords.forEach((record) => {
    const name = record.fields?.['姓名'] || '未命名';
    const id = record.id;
    html += `<tr data-record-id="${id}"><td><strong>${name}</strong></td>`;
    SUB_EDITABLE_FIELDS.forEach((f) => {
      const checked = record.fields?.[f] === true;
      html += `<td><input type="checkbox" class="sub-check" data-field-id="${f}" ${checked ? 'checked' : ''} /></td>`;
    });
    html += `<td><button class="save-sub-btn" data-record-id="${id}">保存</button>
      <span class="save-status" id="sub-status-${id}"></span></td></tr>`;
  });
  html += `</tbody></table>`;
  subRecordsContainer.innerHTML = html;

  document.querySelectorAll('.save-sub-btn').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const recordId = this.dataset.recordId;
      const row = this.closest('tr');
      const checkboxes = row.querySelectorAll('.sub-check');
      const statusSpan = document.getElementById(`sub-status-${recordId}`);

      const updates = {};
      checkboxes.forEach((cb) => {
        const fieldId = cb.dataset.fieldId;
        updates[fieldId] = cb.checked;
      });

      console.log('📤 准备更新档案:', recordId, updates);

      this.disabled = true;
      statusSpan.textContent = '提交中...';
      statusSpan.style.color = '#f39c12';

      try {
        const result = await updateRecordFields(recordId, updates);
        console.log('✅ 更新响应:', result);
        clearSubCache();
        console.log('🧹 缓存已清除');
        statusSpan.textContent = '✅ 已保存';
        statusSpan.style.color = '#2d7d46';
        await loadSubRecords();
        showToast('档案更新成功', 'info');
      } catch (err) {
        console.error('❌ 保存失败:', err);
        statusSpan.textContent = `❌ 失败：${err.message}`;
        statusSpan.style.color = '#e74c3c';
        showToast('保存失败: ' + err.message, 'error');
      } finally {
        this.disabled = false;
        setTimeout(() => {
          statusSpan.textContent = '';
        }, 3000);
      }
    });
  });
}

subSearchInput.addEventListener('input', function () {
  const keyword = this.value.trim().toLowerCase();
  if (!keyword) {
    filteredSubRecords = subRecords;
  } else {
    filteredSubRecords = subRecords.filter((r) => {
      const name = (r.fields?.['姓名'] || '').toLowerCase();
      return name.includes(keyword);
    });
  }
  renderSubTable();
  subTotalCount.textContent = filteredSubRecords.length;
});

// ============================================================
// 4. 初始化与权限控制
// ============================================================

const adminUserInfo = document.getElementById('adminUserInfo');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

async function initAdmin() {
  const user = getCurrentUser();
  const role = await getUserRole();
  if (!user || !['admin', 'subadmin'].includes(role)) {
    showToast('权限不足，请使用管理员账号登录', 'error');
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    return;
  }

  const displayRole = ROLE_MAP[role] || role;
  adminUserInfo.textContent = `${user.email} (${displayRole})`;

  await loadUsers();
  await loadSubRecords();
}

adminLogoutBtn.addEventListener('click', async () => {
  await signOut();
  window.location.href = '/';
});

pushBtn.addEventListener('click', pushChanges);

initAdmin();