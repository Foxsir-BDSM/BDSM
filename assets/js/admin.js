// ============================================================
// 管理面板主逻辑（Tab 切换 + 用户权限 + 下位档案管理）
// ============================================================

import { getCurrentUser, getUserRole } from './identity.js';
import { signOut } from './auth.js';
import { supabase } from './supabase-client.js';
import { showToast } from './ui-helpers.js';

// ----- 下位者档案馆 API 模块 -----
import {
  fetchAllRecords as fetchSubRecords,
  updateRecordFields,
  clearCache as clearSubCache,
} from '/assets/pages/sub-archive/assets/js/api.js';

// ============================================================
// ★★★ 修复：内置 getFieldValue，不依赖 utils.js ★★★
// ============================================================
function getFieldValue(record, fieldId) {
  if (!record) return undefined;
  return record.fields?.[fieldId] ?? record.data?.[fieldId];
}

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
// 2. 用户权限管理（R-04 增加昵称列 + 昵称搜索）
// ============================================================

const userTableContainer = document.getElementById('userTableContainer');
const totalUsers = document.getElementById('totalUsers');
const pushBtn = document.getElementById('pushBtn');
const pushResult = document.getElementById('pushResult');
// ===== R-04 新增：用户搜索框 =====
const userSearchInput = document.getElementById('userSearchInput');

let allUsers = [];
let filteredUsers = [];
let pendingChanges = {};

const ROLE_MAP = {
  self: '普通用户',
  verified: '认证用户',
  subadmin: '次级管理',
  admin: '根源管理',
};
const ROLE_VALUES = ['self', 'verified', 'subadmin', 'admin'];

// ===== R-04 新增：获取用户昵称（兼容多种字段名） =====
function getUserNickname(user) {
  if (!user) return '';
  const meta = user.raw_user_meta_data || user.user_metadata || {};
  return meta.nickname || '';
}

// ===== R-04 新增：获取用户显示名称 =====
function getUserDisplayName(user) {
  if (!user) return '未知用户';
  const nickname = getUserNickname(user);
  if (nickname && nickname.trim()) return nickname.trim();
  return user.email || '未知邮箱';
}

async function loadUsers() {
  try {
    const { data, error } = await supabase.rpc('get_all_users');
    if (error) throw error;
    allUsers = data || [];
    filteredUsers = allUsers;
    renderUserTable();
    totalUsers.textContent = allUsers.length;
    pendingChanges = {};
  } catch (err) {
    showToast('加载用户列表失败: ' + err.message, 'error');
    console.error(err);
  }
}

// ===== R-04 修改：渲染用户表格（增加昵称列） =====
function renderUserTable() {
  const users = filteredUsers.length ? filteredUsers : allUsers;
  if (!users.length) {
    userTableContainer.innerHTML = `<p class="empty">暂无用户数据</p>`;
    return;
  }

  let html = `<table class="admin-table">
    <thead><tr><th>昵称</th><th>邮箱</th><th>当前角色</th><th>新角色</th></tr></thead>
    <tbody>`;
  users.forEach((u) => {
    const currentRole = u.role || 'self';
    const currentDisplay = ROLE_MAP[currentRole] || currentRole;
    const nickname = getUserNickname(u);
    const displayName = nickname || '—';
    const options = ROLE_VALUES.map((r) => {
      const display = ROLE_MAP[r] || r;
      return `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${display}</option>`;
    }).join('');
    html += `<tr data-email="${u.email}">
      <td><span style="color:rgba(255,255,255,0.7);">${displayName}</span></td>
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

// ===== R-04 新增：用户搜索过滤（按昵称或邮箱） =====
function filterUsers(keyword) {
  if (!keyword || keyword.trim() === '') {
    filteredUsers = allUsers;
  } else {
    const kw = keyword.trim().toLowerCase();
    filteredUsers = allUsers.filter((u) => {
      const nickname = getUserNickname(u).toLowerCase();
      const email = (u.email || '').toLowerCase();
      return nickname.includes(kw) || email.includes(kw);
    });
  }
  renderUserTable();
  // 更新计数
  totalUsers.textContent = allUsers.length;
  // 显示过滤后的数量
  const statsLabel = document.querySelector('#pane-userPerm .stats-label');
  if (statsLabel && filteredUsers.length !== allUsers.length) {
    statsLabel.innerHTML = `共 <strong>${allUsers.length}</strong> 位用户（筛选后 <strong>${filteredUsers.length}</strong> 位）`;
  } else if (statsLabel) {
    statsLabel.innerHTML = `共 <strong>${allUsers.length}</strong> 位用户`;
  }
}

// ===== R-04 新增：绑定搜索事件 =====
if (userSearchInput) {
  userSearchInput.addEventListener('input', function () {
    filterUsers(this.value);
  });
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
// 3. 下位档案管理（R-06 已修复：搜索使用字段ID）
// ============================================================

const subRecordsContainer = document.getElementById('subRecordsContainer');
const subTotalCount = document.getElementById('subTotalCount');
const subSearchInput = document.getElementById('subSearchInput');

// 下位档案的待保存变更
let pendingSubChanges = {};

const SUB_EDITABLE_FIELDS = [
  { id: 'fgerzjJpBTF', label: '公开问卷' },
  { id: 'f1s9DJg4oLc', label: '常住地址（隐私确认）' },
  { id: 'fgHLgfGRzy8', label: '联系方式（隐私确认）' },
  { id: 'fgtX9QmBAM5', label: '生活照片（隐私确认）' },
  { id: 'fwEcZvqiGvm', label: '隐私照片（隐私确认）' },
  { id: 'fwK2mQMoxto', label: '认证' },
];

let subRecords = [];
let filteredSubRecords = [];

// 下位档案的 Push 按钮
const pushSubBtn = document.createElement('button');
pushSubBtn.className = 'btn btn-gold';
pushSubBtn.textContent = '📤 Push 下位档案变更';
pushSubBtn.disabled = true;
pushSubBtn.style.marginLeft = '10px';
document.querySelector('#pane-subArchive .toolbar .right').appendChild(pushSubBtn);

async function loadSubRecords() {
  try {
    const records = await fetchSubRecords(true);
    console.log('📥 加载下位档案记录数:', records.length);
    subRecords = records;
    filteredSubRecords = records;
    renderSubTable();
    subTotalCount.textContent = records.length;
    pendingSubChanges = {};
    pushSubBtn.disabled = true;
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
    html += `<th>${f.label}</th>`;
  });
  html += `<th>状态</th></tr></thead><tbody>`;

  filteredSubRecords.forEach((record) => {
    // ===== R-06 确认：使用字段ID 'fqidTsBW5js' 获取姓名 =====
    const name = getFieldValue(record, 'fqidTsBW5js') || '未命名';
    const id = record.id;
    html += `<tr data-record-id="${id}"><td><strong>${name}</strong></td>`;
    SUB_EDITABLE_FIELDS.forEach((f) => {
      const checked = getFieldValue(record, f.id) === true;
      const hasPending = pendingSubChanges[id] && pendingSubChanges[id][f.id] !== undefined;
      const displayChecked = hasPending ? pendingSubChanges[id][f.id] : checked;
      html += `<td>
        <input type="checkbox" class="sub-check" data-record-id="${id}" data-field-id="${f.id}" ${displayChecked ? 'checked' : ''} />
        ${hasPending ? '<span style="color:#f59e0b;font-size:10px;">待保存</span>' : ''}
      </td>`;
    });
    html += `<td><span class="save-status" id="sub-status-${id}"></span></td></tr>`;
  });
  html += `</tbody></table>`;
  subRecordsContainer.innerHTML = html;

  document.querySelectorAll('.sub-check').forEach((cb) => {
    cb.addEventListener('change', function () {
      const recordId = this.dataset.recordId;
      const fieldId = this.dataset.fieldId;
      const newValue = this.checked;

      const record = subRecords.find(r => r.id === recordId);
      const oldValue = record ? getFieldValue(record, fieldId) === true : false;

      if (newValue === oldValue) {
        if (pendingSubChanges[recordId] && pendingSubChanges[recordId][fieldId] !== undefined) {
          delete pendingSubChanges[recordId][fieldId];
          if (Object.keys(pendingSubChanges[recordId]).length === 0) {
            delete pendingSubChanges[recordId];
          }
        }
      } else {
        if (!pendingSubChanges[recordId]) pendingSubChanges[recordId] = {};
        pendingSubChanges[recordId][fieldId] = newValue;
      }

      pushSubBtn.disabled = Object.keys(pendingSubChanges).length === 0;
      renderSubTable();
    });
  });
}

async function pushSubChanges() {
  const changes = Object.entries(pendingSubChanges);
  if (changes.length === 0) {
    showToast('没有待生效的变更', 'info');
    return;
  }

  pushSubBtn.disabled = true;
  pushSubBtn.textContent = '提交中...';

  let successCount = 0,
    failCount = 0;

  for (const [recordId, fields] of changes) {
    try {
      await updateRecordFields(recordId, fields);
      delete pendingSubChanges[recordId];
      const record = subRecords.find(r => r.id === recordId);
      if (record) {
        for (const [fieldId, value] of Object.entries(fields)) {
          if (record.fields) {
            record.fields[fieldId] = value;
          } else if (record.data) {
            record.data[fieldId] = value;
          }
        }
      }
      successCount++;
    } catch (err) {
      failCount++;
      console.error('更新记录失败:', recordId, err);
    }
  }

  clearSubCache();

  let msg = `✅ 成功更新 ${successCount} 条档案`;
  if (failCount > 0) msg += `，❌ 失败 ${failCount} 条`;
  showToast(msg, failCount === 0 ? 'success' : 'error');

  await loadSubRecords();
  pushSubBtn.textContent = '📤 Push 下位档案变更';
  pushSubBtn.disabled = true;
}

pushSubBtn.addEventListener('click', pushSubChanges);

// ===== R-06 确认：搜索使用字段ID 'fqidTsBW5js'（姓名），已修复 =====
subSearchInput.addEventListener('input', function () {
  const keyword = this.value.trim().toLowerCase();
  if (!keyword) {
    filteredSubRecords = subRecords;
  } else {
    filteredSubRecords = subRecords.filter((r) => {
      const name = (getFieldValue(r, 'fqidTsBW5js') || '').toLowerCase();
      // 同时也搜索职业（如果存在）
      const profession = (getFieldValue(r, 'fI5zGTDkg2W') || '').toLowerCase();
      // 同时也搜索地区（如果存在）
      const region = (getFieldValue(r, 'fF9i8Q5CgBe') || '').toLowerCase();
      return name.includes(keyword) || profession.includes(keyword) || region.includes(keyword);
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
  const user = await getCurrentUser();
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