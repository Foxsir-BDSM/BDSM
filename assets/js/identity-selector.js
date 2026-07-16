// ============================================================
// 身份选择器渲染 & 交互逻辑
// ============================================================

import { IDENTITIES } from '/assets/config/identity-config.js';

let selectedPrimary = null;           // 当前选中的主身份 ID
const selectedSecondaries = new Set(); // 副身份 ID 集合

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
        🎯 主身份 <small>（必选，决定等级路径）</small>
      </div>
      <div class="primary-grid" id="primary-grid"></div>

      <div class="section-label" style="margin-top: 1rem;">
        🧩 副身份 <small>（可选，多选，展示多元属性）</small>
      </div>
      <div class="secondary-grid" id="secondary-grid"></div>

      <div class="identity-hint" id="identity-hint">请点击卡片选择主身份</div>
    </div>
  `;

  const primaryGrid = document.getElementById('primary-grid');
  const secondaryGrid = document.getElementById('secondary-grid');

  // 渲染主身份卡片（单选）
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

  // 渲染副身份卡片（多选）
  IDENTITIES.forEach(item => {
    const card = document.createElement('div');
    card.className = 'secondary-card';
    card.dataset.id = item.id;
    card.innerHTML = `
      <span class="icon">${item.icon}</span>
      <span class="label">${item.label}</span>
    `;
    card.addEventListener('click', () => toggleSecondary(item.id));
    secondaryGrid.appendChild(card);
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
 * 切换副身份（多选）
 */
function toggleSecondary(id) {
  if (selectedSecondaries.has(id)) {
    selectedSecondaries.delete(id);
  } else {
    selectedSecondaries.add(id);
  }
  updateUI();
  updateHint();
}

/**
 * 更新所有卡片的高亮状态
 */
function updateUI() {
  // 主身份
  document.querySelectorAll('.primary-grid .identity-card').forEach(card => {
    const id = card.dataset.id;
    card.classList.toggle('selected-primary', id === selectedPrimary);
  });

  // 副身份
  document.querySelectorAll('.secondary-grid .secondary-card').forEach(card => {
    const id = card.dataset.id;
    card.classList.toggle('selected-secondary', selectedSecondaries.has(id));
  });
}

/**
 * 更新底部提示文字
 */
function updateHint() {
  const hint = document.getElementById('identity-hint');
  if (!hint) return;

  const parts = [];
  if (selectedPrimary) {
    const p = IDENTITIES.find(i => i.id === selectedPrimary);
    if (p) {
      const genderText = p.gender === 'male' ? '男' : '女';
      const typeText = p.type === 'top' ? '上位' : '下位';
      parts.push(`主：${p.label}（${p.desc} · ${genderText} · ${typeText}）`);
    }
  } else {
    parts.push('⚠️ 请选择主身份');
  }

  if (selectedSecondaries.size > 0) {
    const labels = Array.from(selectedSecondaries).map(id => {
      const found = IDENTITIES.find(i => i.id === id);
      return found ? found.label : id;
    });
    parts.push(`副：${labels.join('、')}`);
  }

  hint.textContent = parts.join(' ｜ ') || '请点击卡片选择主身份';
}

/**
 * 获取当前选中的身份数据（供注册提交使用）
 * @returns {object} { valid, error?, primaryId, primaryLabel, gender, type, secondaryIds }
 */
export function getSelectedIdentityData() {
  if (!selectedPrimary) {
    return { valid: false, error: '请选择主身份' };
  }

  const primary = IDENTITIES.find(i => i.id === selectedPrimary);
  if (!primary) {
    return { valid: false, error: '主身份数据异常，请重新选择' };
  }

  return {
    valid: true,
    primaryId: selectedPrimary,
    primaryLabel: primary.label,
    gender: primary.gender,
    type: primary.type,
    secondaryIds: Array.from(selectedSecondaries),
  };
}

/**
 * 重置选择器（清空所有选择）
 */
export function resetIdentitySelector() {
  selectedPrimary = null;
  selectedSecondaries.clear();
  updateUI();
  updateHint();
}
