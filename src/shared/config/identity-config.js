// ============================================================
// src/shared/config/identity-config.js
// 身份与取向定义
// ------------------------------------------------------------
// 说明：
//   身份保持现有 12 种（男/女 × S/Dom/Z/M/Sub/B），不做精简，
//   但按「位置」分成两组 —— S 系（上位）与 M 系（下位），
//   供档案馆的默认过滤与等级路径使用。
//
//   另新增「取向」维度（异性/同性/双性/未定），
//   当前用于档案馆默认筛选，未来可用于更多匹配场景。
// ============================================================

/** 位置分组：用于判定互补位置（S 看 M，M 看 S） */
export const POSITION_GROUPS = {
  top: ['male_S', 'female_S', 'male_Dom', 'female_Dom', 'male_Z', 'female_Z'],
  bottom: ['male_M', 'female_M', 'male_Sub', 'female_Sub', 'male_B', 'female_B'],
};

/**
 * 精炼身份（4 种）：男S / 女S / 男M / 女M
 * 由 12 种细分身份归并而来，用于档案分区与默认过滤。
 */
export const CORE_IDENTITIES = [
  { id: 'male_S', label: '男S', gender: 'male', position: 'top', icon: '⚔️' },
  { id: 'female_S', label: '女S', gender: 'female', position: 'top', icon: '⚔️' },
  { id: 'male_M', label: '男M', gender: 'male', position: 'bottom', icon: '🛡️' },
  { id: 'female_M', label: '女M', gender: 'female', position: 'bottom', icon: '🛡️' },
];

export const IDENTITIES = [
  // ---------- 上位者（S 系）----------
  { id: 'male_S',    label: '男S',   gender: 'male',   type: 'top', icon: '⚔️', desc: '掌控者' },
  { id: 'female_S',  label: '女S',   gender: 'female', type: 'top', icon: '⚔️', desc: '掌控者' },
  { id: 'male_Dom',  label: '男Dom', gender: 'male',   type: 'top', icon: '🔮', desc: '支配者' },
  { id: 'female_Dom',label: '女Dom', gender: 'female', type: 'top', icon: '🔮', desc: '支配者' },
  { id: 'male_Z',    label: '男Z',   gender: 'male',   type: 'top', icon: '🔥', desc: '召契者' },
  { id: 'female_Z',  label: '女Z',   gender: 'female', type: 'top', icon: '🔥', desc: '召契者' },
  // ---------- 下位者（M 系）----------
  { id: 'male_M',    label: '男M',   gender: 'male',   type: 'bottom', icon: '🛡️', desc: '臣服者' },
  { id: 'female_M',  label: '女M',   gender: 'female', type: 'bottom', icon: '🛡️', desc: '臣服者' },
  { id: 'male_Sub',  label: '男Sub', gender: 'male',   type: 'bottom', icon: '🌊', desc: '跟随者' },
  { id: 'female_Sub',label: '女Sub', gender: 'female', type: 'bottom', icon: '🌊', desc: '跟随者' },
  { id: 'male_B',    label: '男B',   gender: 'male',   type: 'bottom', icon: '💎', desc: '应契者' },
  { id: 'female_B',  label: '女B',   gender: 'female', type: 'bottom', icon: '💎', desc: '应契者' },
];

// ────────────────────────────────────────────── 取向
export const ORIENTATIONS = [
  { id: 'hetero', label: '异性', icon: '♂♀', desc: '偏好异性' },
  { id: 'homo',   label: '同性', icon: '♂♂', desc: '偏好同性' },
  { id: 'bi',     label: '双性', icon: '⚥',  desc: '两者皆可' },
  { id: 'unsure', label: '未定', icon: '❔',  desc: '暂不确定' },
];

export function getOrientation(id) {
  return ORIENTATIONS.find((o) => o.id === id) || ORIENTATIONS[3];
}

export const ORIENTATION_IDS = ORIENTATIONS.map((o) => o.id);

// ────────────────────────────────────────────── 工具函数
export function getGender(identityId) {
  const found = IDENTITIES.find((i) => i.id === identityId);
  return found ? found.gender : null;
}

export function getType(identityId) {
  const found = IDENTITIES.find((i) => i.id === identityId);
  return found ? found.type : null;
}

export function getIdentityById(identityId) {
  return IDENTITIES.find((i) => i.id === identityId) || null;
}

export function getIdentityLabel(identityId) {
  const found = IDENTITIES.find((i) => i.id === identityId);
  return found ? found.label : identityId || '';
}

/** 由 12 种细分身份归并出 4 种精炼身份（男S/女S/男M/女M） */
export function toCoreIdentity(identityId) {
  const found = IDENTITIES.find((i) => i.id === identityId);
  if (!found) return null;
  return found.gender === 'male'
    ? (found.type === 'top' ? 'male_S' : 'male_M')
    : (found.type === 'top' ? 'female_S' : 'female_M');
}

export function getCoreIdentity(identityId) {
  const id = toCoreIdentity(identityId);
  return CORE_IDENTITIES.find((c) => c.id === id) || null;
}

/** 互补位置：S 的互补是 M，M 的互补是 S */
export function getComplementPosition(identityId) {
  const t = getType(identityId);
  if (t === 'top') return 'bottom';
  if (t === 'bottom') return 'top';
  return null;
}

/**
 * 由「身份 + 取向」推导出档案筛选条件
 * @param {string} identityId 主身份
 * @param {string} orientationId 取向
 * @returns {{position:string|null, gender:string|null, reason:string}}
 *   position 要看的档案位置（top/bottom）；gender 取向过滤（null=不过滤）
 */
export function deriveArchiveFilter(identityId, orientationId) {
  const me = getIdentityById(identityId);
  const pos = getComplementPosition(identityId);

  // 无身份 → 不过滤，返回全部（回到默认行为）
  if (!me || !pos) {
    return { position: null, gender: null, reason: '未设置身份，展示全部档案' };
  }

  const posLabel = pos === 'bottom' ? '下位者' : '上位者';

  if (!orientationId || orientationId === 'unsure') {
    return { position: pos, gender: null, reason: `按身份展示${posLabel}档案（取向未定，不限性别）` };
  }
  if (orientationId === 'bi') {
    return { position: pos, gender: null, reason: `按身份展示${posLabel}档案（双性，不限性别）` };
  }

  // 异性 → 期望对方性别与自己相反；同性 → 相同
  const wantGender = orientationId === 'hetero'
    ? (me.gender === 'male' ? 'female' : 'male')
    : me.gender;

  const gLabel = wantGender === 'male' ? '男' : '女';
  return {
    position: pos,
    gender: wantGender,
    reason: `${me.label} · ${getOrientation(orientationId).label} → 默认展示${gLabel}${posLabel}档案`,
  };
}

export const IDENTITY_IDS = IDENTITIES.map((i) => i.id);
