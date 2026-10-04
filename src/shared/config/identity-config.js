// 职责    ★ 身份体系唯一事实源：4 身份定义（男S / 女S / 男M / 女M）、旧身份归并表、互补位置、档案默认筛选推导、主奴称谓。
// 归属页面 注册页、档案列表页、我的页、资料页、等级展示
// 依赖    无
// 被依赖   shared/js/identity-selector.js、shared/js/level.js、sub-archive/js/home.js、launcher/my.html、launcher/profile.html
//
// 维护提示
//   · ★ 增删身份只改本文件的 IDENTITIES，注册页 / 档案筛选 / 个人页会自动跟随。
//   · ★ LEGACY_IDENTITY_MAP 用于兼容历史用户（旧 12 分类 → 新 4 身份），不要删。
//   · ★ 取向维度已于 2026-10-04 取消，deriveArchiveFilter 现在只按身份分流：S 看 M，M 看 S。若恢复取向，需同步改注册页、资料页、档案筛选三处。
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
 * 由「身份」推导档案默认筛选条件
 *
 * 设计（2026-10-04 定稿）：取向维度已取消，筛选只按身份分流：
 *   S 侧访问者（男S / 女S）→ 默认展示 M 侧档案
 *   M 侧访问者（男M / 女M）→ 默认展示 S 侧档案
 *
 * 不再按性别收窄 —— 该维度随取向一并取消。
 *
 * @param {string} identityId 用户身份（旧值会自动归并）
 * @returns {{position:string|null, gender:null, reason:string}}
 *   position  要看的位置（top/bottom）；null = 不过滤（展示全部）
 *   gender    恒为 null（保留字段以兼容调用方）
 */
export function deriveArchiveFilter(identityId) {
  const me = getIdentityById(identityId);
  const pos = getComplementPosition(identityId);

  // 无身份 → 不过滤，展示全部
  if (!me || !pos) {
    return { position: null, gender: null, reason: '未设置身份，展示全部档案' };
  }

  const posLabel = pos === 'bottom' ? 'M' : 'S';
  return {
    position: pos,
    gender: null,
    reason: `${me.label} → 默认展示 ${posLabel} 侧档案`,
  };
}

/** 身份在平台内的两类角色简称（供等级与展示使用） */
export function getRoleTitle(identityId) {
  const t = getType(identityId);
  if (t === 'top') return '主';
  if (t === 'bottom') return '奴';
  return '';
}
