// 职责    4 身份选择器组件：渲染卡片、选中态、读取选中值、重置。
// 归属页面 注册页 /auth.html
// 依赖    shared/config/identity-config.js
// 被依赖   launcher/auth.html
//
// 维护提示
//   · 身份数据源是 identity-config.js 的 IDENTITIES，本文件不应重复声明身份清单。
//   · ★ 原「取向选择器」已于 2026-10-04 随取向维度一并移除。
import { IDENTITIES } from '@/shared/config/identity-config.js';

let selectedPrimary = null;           // 当前选中的身份 ID

/**
 * 渲染身份选择器到指定容器
 * @param {string} containerId - 容器 DOM ID
 */
export function renderIdentitySelector(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[identity-selector] 容器不存在:', containerId);
    return;
  }

  container.innerHTML = `
    <div class="identity-selector">
      <div class="section-label">
        🎯 身份 <small>（必选，决定你的角色与档案默认视图）</small>
      </div>
      <div class="primary-grid" id="primary-grid"></div>
      <div class="identity-hint" id="identity-hint">请点击卡片选择身份</div>
    </div>
  `;

  const primaryGrid = document.getElementById('primary-grid');

  // 渲染身份卡片（单选）
  IDENTITIES.forEach(item => {
    const card = document.createElement('div');
    card.className = 'identity-card';
    card.dataset.id = item.id;
    card.innerHTML = `
      <span class="icon">${item.icon}</span>
      <span class="label">${item.label}</span>
      <span class="badge">${item.desc}</span>
    `;
    card.addEventListener('click', () => selectPrimary(item.id));
    primaryGrid.appendChild(card);
  });

  // 初始状态
  updateUI();
  updateHint();
}

/**
 * 选择主身份（单选）
 * 再次点击同一卡片可取消选中
 */
function selectPrimary(id) {
  if (selectedPrimary === id) {
    selectedPrimary = null; // 取消选中
  } else {
    selectedPrimary = id;
  }
  updateUI();
  updateHint();
}

/**
 * 更新所有卡片的高亮状态
 */
function updateUI() {
  document.querySelectorAll('.primary-grid .identity-card').forEach(card => {
    const id = card.dataset.id;
    card.classList.toggle('selected-primary', id === selectedPrimary);
  });
}

/**
 * 更新底部提示文字
 */
function updateHint() {
  const hint = document.getElementById('identity-hint');
  if (!hint) return;

  if (selectedPrimary) {
    const p = IDENTITIES.find(i => i.id === selectedPrimary);
    if (p) {
      const roleText = p.type === 'top' ? '主' : '奴';
      hint.textContent = `已选：${p.icon} ${p.label}（${p.desc} · 角色 ${roleText}）`;
      return;
    }
  }
  hint.textContent = '请点击卡片选择身份';
}

/**
 * 获取当前选中的身份数据（供注册提交使用）
 * @returns {object} { valid, error?, primaryId, primaryLabel, gender, type, secondaryIds }
 */
export function getSelectedIdentityData() {
  if (!selectedPrimary) {
    return { valid: false, error: '请选择身份' };
  }

  const primary = IDENTITIES.find(i => i.id === selectedPrimary);
  if (!primary) {
    return { valid: false, error: '身份数据异常，请重新选择' };
  }

  return {
    valid: true,
    primaryId: selectedPrimary,
    primaryLabel: primary.label,
    gender: primary.gender,
    type: primary.type,
  };
}

/**
 * 重置选择器（清空所有选择）
 */
export function resetIdentitySelector() {
  selectedPrimary = null;
  updateUI();
  updateHint();
}
