// ============================================================
// 12 种身份定义（供注册身份选择器使用）
// ============================================================

export const IDENTITIES = [
  // ---------- 上位者 ----------
  { id: 'male_S',    label: '男S',   gender: 'male',   type: 'top', icon: '⚔️', desc: '掌控者' },
  { id: 'female_S',  label: '女S',   gender: 'female', type: 'top', icon: '⚔️', desc: '掌控者' },
  { id: 'male_Dom',  label: '男Dom', gender: 'male',   type: 'top', icon: '🔮', desc: '支配者' },
  { id: 'female_Dom',label: '女Dom', gender: 'female', type: 'top', icon: '🔮', desc: '支配者' },
  { id: 'male_Z',    label: '男Z',   gender: 'male',   type: 'top', icon: '🔥', desc: '召契者' },
  { id: 'female_Z',  label: '女Z',   gender: 'female', type: 'top', icon: '🔥', desc: '召契者' },
  // ---------- 下位者 ----------
  { id: 'male_M',    label: '男M',   gender: 'male',   type: 'bottom', icon: '🛡️', desc: '臣服者' },
  { id: 'female_M',  label: '女M',   gender: 'female', type: 'bottom', icon: '🛡️', desc: '臣服者' },
  { id: 'male_Sub',  label: '男Sub', gender: 'male',   type: 'bottom', icon: '🌊', desc: '跟随者' },
  { id: 'female_Sub',label: '女Sub', gender: 'female', type: 'bottom', icon: '🌊', desc: '跟随者' },
  { id: 'male_B',    label: '男B',   gender: 'male',   type: 'bottom', icon: '💎', desc: '应契者' },
  { id: 'female_B',  label: '女B',   gender: 'female', type: 'bottom', icon: '💎', desc: '应契者' },
];

// 工具函数：根据身份 ID 获取性别
export function getGender(identityId) {
  const found = IDENTITIES.find(i => i.id === identityId);
  return found ? found.gender : null;
}

// 工具函数：根据身份 ID 获取上下位类型
export function getType(identityId) {
  const found = IDENTITIES.find(i => i.id === identityId);
  return found ? found.type : null;
}

// 工具函数：根据身份 ID 获取完整数据
export function getIdentityById(identityId) {
  return IDENTITIES.find(i => i.id === identityId) || null;
}

// 所有身份 ID 列表
export const IDENTITY_IDS = IDENTITIES.map(i => i.id);
