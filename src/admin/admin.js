// 职责    管理后台主逻辑：用户角色管理、档案隐私勾选编辑、档案检索、Tab 切换。
// 归属页面 管理后台 /admin.html
// 依赖    shared/js/identity.js、auth.js、supabase-client.js、ui-helpers.js、sub-archive/js/api.js、sub-archive/js/config.js
// 被依赖   入口模块，由 admin.html 加载
//
// 维护提示
//   · ★ 档案可编辑字段在 SUB_EDITABLE_FIELDS，字段 ID 从 config 读取（VISIBILITY_FIELDS / PRIVACY_CONTROL_IDS / CARD_FIELDS）—— 再迁库只改 fields.js 即可。
//   · ★ 该清单必须与 sub-archive/js/api.js 的 PRIVACY_FIELD_WHITELIST 一致，否则保存会被静默忽略。
//   · 本文件内置了一份 getFieldValue，与 sub-archive/js/utils.js 的同名函数是两份实现。
import { getCurrentUser, getUserRole } from '@/shared/js/identity.js';
import { signOut } from '@/shared/js/auth.js';
import { supabase } from '@/shared/js/supabase-client.js';
import { showToast } from '@/shared/js/ui-helpers.js';

// ----- 下位者档案馆 API 模块 -----
import {
  fetchAllRecords as fetchSubRecords,
  updateRecordFields,
  clearCache as clearSubCache,
} from '@/modules/sub-archive/js/api.js';

// ----- 档案字段配置（不再硬编码字段 ID）-----
import {
  CARD_FIELDS,
  VISIBILITY_FIELDS,
  PRIVACY_CONTROL_IDS,
  FIELD_LABELS,
  SYSTEM_FIELD_IDS,
  getFieldsFor,
} from '@/modules/sub-archive/js/config.js';

// ============================================================
// 内置 getFieldValue（fields 与 data 两种键都兼容）
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
// 2. 用户权限管理（仅 admin 可见和操作）
// ============================================================

const userTableContainer = document.getElementById('userTableContainer');
const totalUsers = document.getElementById('totalUsers');
const pushBtn = document.getElementById('pushBtn');
const pushResult = document.getElementById('pushResult');
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

// ★ 新增：角色排序优先级（数字越小越靠前）
const ROLE_ORDER = {
  admin: 0,
  subadmin: 1,
  verified: 2,
  self: 3,
};

function getUserNickname(user) {
  if (!user) return '';
  const meta = user.raw_user_meta_data || user.user_metadata || {};
  return meta.nickname || '';
}

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

function renderUserTable() {
  // ★ 获取要渲染的数据（已过滤）
  let users = filteredUsers.length ? filteredUsers : allUsers;

  // ★ 按角色优先级排序（根源 → 次级 → 认证 → 普通）
  users = [...users].sort((a, b) => {
    const roleA = a.role || 'self';
    const roleB = b.role || 'self';
    return (ROLE_ORDER[roleA] ?? 99) - (ROLE_ORDER[roleB] ?? 99);
  });

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

    // ★ 修改：第三列使用 role-badge + 角色类
    html += `<tr data-email="${u.email}">
      <td><span style="color:rgba(255,255,255,0.7);">${displayName}</span></td>
      <td>${u.email}</td>
      <td><span class="role-badge role-${currentRole}">${currentDisplay}</span></td>
      <td><select class="role-select" data-email="${u.email}">${options}</select></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  userTableContainer.innerHTML = html;

  // 绑定下拉选择事件
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
  totalUsers.textContent = allUsers.length;
  const statsLabel = document.querySelector('#pane-userPerm .stats-label');
  if (statsLabel && filteredUsers.length !== allUsers.length) {
    statsLabel.innerHTML = `共 <strong>${allUsers.length}</strong> 位用户（筛选后 <strong>${filteredUsers.length}</strong> 位）`;
  } else if (statsLabel) {
    statsLabel.innerHTML = `共 <strong>${allUsers.length}</strong> 位用户`;
  }
}

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

  let successCount = 0, failCount = 0;
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
// 3. 下位档案管理（subadmin + admin 均可操作）
// ============================================================

const subRecordsContainer = document.getElementById('subRecordsContainer');
const subTotalCount = document.getElementById('subTotalCount');
const subSearchInput = document.getElementById('subSearchInput');

let pendingSubChanges = {};

// ────────────────────────────────────────────────────────────
// 管理面板可编辑的档案字段
// ★ 字段清单来自 FIELD_VISIBILITY.manage（fields.js 的注册表）
//   要增删管理面板的字段，改注册表即可，本文件不用动。
// ────────────────────────────────────────────────────────────
const SUB_EDITABLE_FIELDS = getFieldsFor('manage').map((id) => ({
  id,
  label: FIELD_LABELS[id] || SYSTEM_FIELD_IDS[id] || id,
}));

let subRecords = [];
let filteredSubRecords = [];

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
    const name = getFieldValue(record, CARD_FIELDS.name) || '未命名';
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

  let successCount = 0, failCount = 0;

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

subSearchInput.addEventListener('input', function () {
  const keyword = this.value.trim().toLowerCase();
  if (!keyword) {
    filteredSubRecords = subRecords;
  } else {
    filteredSubRecords = subRecords.filter((r) => {
      const name = (getFieldValue(r, CARD_FIELDS.name) || '').toLowerCase();
      const profession = (getFieldValue(r, CARD_FIELDS.profession) || '').toLowerCase();
      const region = (getFieldValue(r, CARD_FIELDS.area) || '').toLowerCase();
      return name.includes(keyword) || profession.includes(keyword) || region.includes(keyword);
    });
  }
  renderSubTable();
  subTotalCount.textContent = filteredSubRecords.length;
});

// ============================================================
// 4. 初始化与权限控制（区分 admin 和 subadmin）
// ============================================================

const adminUserInfo = document.getElementById('adminUserInfo');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const tabUserPerm = document.getElementById('tabUserPerm');

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

  // ★★★ 关键权限控制 ★★★
  const isAdmin = role === 'admin';

  // ★ 仅 admin 可管理用户权限 ★
  if (!isAdmin) {
    // 隐藏用户权限 Tab
    const userPermTab = document.querySelector('.tab-btn[data-tab="userPerm"]');
    if (userPermTab) {
      userPermTab.style.display = 'none';
    }
    // 如果用户权限面板当前激活，切换到下位档案
    const userPermPane = document.getElementById('pane-userPerm');
    if (userPermPane && userPermPane.classList.contains('active')) {
      const subArchiveTab = document.querySelector('.tab-btn[data-tab="subArchive"]');
      if (subArchiveTab) subArchiveTab.click();
    }
    // 隐藏用户权限面板内容
    if (userPermPane) {
      userPermPane.innerHTML = `
        <div class="coming-soon" style="padding:40px 20px;text-align:center;">
          <div class="placeholder-icon">🔒</div>
          <p style="color:rgba(255,255,255,0.3);">用户权限管理仅限根源管理</p>
          <p style="color:rgba(255,255,255,0.1);font-size:13px;">请联系根源管理员进行角色升级</p>
        </div>
      `;
    }
  } else {
    // admin：加载用户列表
    await loadUsers();
  }

  // ★ subadmin 和 admin 均可管理下位档案 ★
  await loadSubRecords();
}

adminLogoutBtn.addEventListener('click', async () => {
  await signOut();
  window.location.href = '/';
});

pushBtn.addEventListener('click', pushChanges);

initAdmin();