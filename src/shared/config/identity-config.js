// ============================================================
// src/shared/config/identity-config.js
// 身份与取向定义 —— 4 身份 + 取向
// ------------------------------------------------------------
// 设计（2026-10-03 定稿）：
//   · 身份只有 4 种：男S / 女S / 男M / 女M
//     旧分类（Dom / Z / Sub / B）已废弃，不再作为身份存在
//   · 取向是独立维度：异性 / 同性 / 双性 / 未定
//   · 档案筛选 = 用户身份（决定看哪一侧）+ 取向（决定看哪个性别）
//
// 旧用户兼容：
//   已注册用户可能带着 male_Dom / female_Sub 等旧值，
//   LEGACY_IDENTITY_MAP 把它们映射到 4 身份之一，
//   读取时自动归并，用户重新选择身份后即彻底完成迁移。
// ============================================================

// ══════════════════════════════════════════════ 身份（4 种）
export const IDENTITIES = [
  { id: 'male_S',   label: '男S', gender: 'male',   type: 'top',    icon: '⚔️', desc: '上位 · 掌控' },
  { id: 'female_S', label: '女S', gender: 'female', type: 'top',    icon: '⚔️', desc: '上位 · 掌控' },
  { id: 'male_M',   label: '男M', gender: 'male',   type: 'bottom', icon: '🛡️', desc: '下位 · 臣服' },
  { id: 'female_M', label: '女M', gender: 'female', type: 'bottom', icon: '🛡️', desc: '下位 · 臣服' },
];

export const IDENTITY_IDS = IDENTITIES.map((i) => i.id);

/** 按位置分组 */
export const POSITION_GROUPS = {
  top: IDENTITIES.filter((i) => i.type === 'top').map((i) => i.id),
  bottom: IDENTITIES.filter((i) => i.type === 'bottom').map((i) => i.id),
};

// ══════════════════════════════════════════════ 取向（4 种）
export const ORIENTATIONS = [
  { id: 'hetero', label: '异性', icon: '♂♀', desc: '偏好异性' },
  { id: 'homo',   label: '同性', icon: '♂♂', desc: '偏好同性' },
  { id: 'bi',     label: '双性', icon: '⚥',  desc: '两者皆可' },
  { id: 'unsure', label: '未定', icon: '❔',  desc: '暂不确定' },
];

export const ORIENTATION_IDS = ORIENTATIONS.map((o) => o.id);

// ══════════════════════════════════════════════ 旧身份归并表
/**
 * 旧 12 分类 → 新 4 身份
 * 旧值仅在读取历史用户时出现，一旦用户重新选择身份即不再产生
 */
export const LEGACY_IDENTITY_MAP = {
  male_S: 'male_S', female_S: 'female_S',
  male_Dom: 'male_S', female_Dom: 'female_S',
  male_Z: 'male_S', female_Z: 'female_S',
  male_M: 'male_M', female_M: 'female_M',
  male_Sub: 'male_M', female_Sub: 'female_M',
  male_B: 'male_M', female_B: 'female_M',
};

/** 该 id 是否是已废弃的旧身份 */
export function isLegacyIdentity(id) {
  return !!id && id in LEGACY_IDENTITY_MAP && !IDENTITY_IDS.includes(id);
}

/** 把任意（含旧）身份 id 归并到 4 身份之一 */
export function migrateIdentity(id) {
  if (!id) return null;
  if (IDENTITY_IDS.includes(id)) return id;
  return LEGACY_IDENTITY_MAP[id] || null;
}

// ══════════════════════════════════════════════ 查询工具
export function getIdentityById(identityId) {
  const id = migrateIdentity(identityId);
  return IDENTITIES.find((i) => i.id === id) || null;
}

export function getIdentityLabel(identityId) {
  const found = getIdentityById(identityId);
  return found ? found.label : '';
}

export function getGender(identityId) {
  const found = getIdentityById(identityId);
  return found ? found.gender : null;
}

export function getType(identityId) {
  const found = getIdentityById(identityId);
  return found ? found.type : null;
}

export function getOrientation(id) {
  return ORIENTATIONS.find((o) => o.id === id) || ORIENTATIONS[3];
}

export function getOrientationLabel(id) {
  return getOrientation(id).label;
}

/** 互补位置：S 看 M，M 看 S */
export function getComplementPosition(identityId) {
  const t = getType(identityId);
  if (t === 'top') return 'bottom';
  if (t === 'bottom') return 'top';
  return null;
}

/** 兼容旧调用：返回归并后的 4 身份 id（等价于 migrateIdentity） */
export function toCoreIdentity(identityId) {
  return migrateIdentity(identityId);
}

/** 兼容旧调用：返回归并后的 4 身份定义 */
export function getCoreIdentity(identityId) {
  return getIdentityById(identityId);
}

// ══════════════════════════════════════════════ 档案筛选推导
/**
 * 由「身份 + 取向」推导档案默认筛选条件
 *
 * @param {string} identityId 用户身份（可为旧值，会自动归并）
 * @param {string} orientationId 取向
 * @returns {{position:string|null, gender:string|null, reason:string}}
 *   position  要看的位置（top/bottom）；null = 不过滤
 *   gender    要看的性别（male/female）；null = 不过滤
 */
export function deriveArchiveFilter(identityId, orientationId) {
  const me = getIdentityById(identityId);
  const pos = getComplementPosition(identityId);

  // 无身份 → 不过滤，展示全部
  if (!me || !pos) {
    return { position: null, gender: null, reason: '未设置身份，展示全部档案' };
  }

  const posLabel = pos === 'bottom' ? 'M' : 'S';
  const meLabel = me.label;

  if (!orientationId || orientationId === 'unsure') {
    return { position: pos, gender: null, reason: `${meLabel} → 展示 ${posLabel} 侧档案（取向未定，不限性别）` };
  }
  if (orientationId === 'bi') {
    return { position: pos, gender: null, reason: `${meLabel} → 展示 ${posLabel} 侧档案（双性，不限性别）` };
  }

  // 异性 → 看相反性别；同性 → 看相同性别
  const wantGender = orientationId === 'hetero'
    ? (me.gender === 'male' ? 'female' : 'male')
    : me.gender;

  const gLabel = wantGender === 'male' ? '男' : '女';
  return {
    position: pos,
    gender: wantGender,
    reason: `${meLabel} · ${getOrientation(orientationId).label} → 默认展示 ${gLabel}${posLabel} 档案`,
  };
}

/** 身份在平台内的两类角色简称（供等级与展示使用） */
export function getRoleTitle(identityId) {
  const t = getType(identityId);
  if (t === 'top') return '主';
  if (t === 'bottom') return '奴';
  return '';
}
