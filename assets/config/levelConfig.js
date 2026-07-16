// ============================================================
// 积分等级系统配置
// 12 种身份 × 8 个等级（Lv.0 ~ Lv.7）
// ============================================================

// 积分阈值（通用）
export const LEVEL_THRESHOLDS = [0, 1, 11, 51, 101, 501, 1001, 5001];

// 12 身份 × 8 等级称呼配置
export const LEVEL_TITLES = {
  // ---------- 上位者 ----------
  male_S: {
    name: '男S',
    levels: ['初入局', '试鞭', '立威', '掌事', '镇场', '有号', '有人跟', '主'],
  },
  female_S: {
    name: '女S',
    levels: ['初入局', '试声', '立场', '掌人', '控局', '有号', '有人认', '主'],
  },
  male_Dom: {
    name: '男Dom',
    levels: ['初入局', '试令', '立规', '掌令', '御心', '有号', '有人跟', 'Dom'],
  },
  female_Dom: {
    name: '女Dom',
    levels: ['初入局', '试令', '立场', '掌令', '御心', '有号', '有人跟', 'Dom'],
  },
  male_Z: {
    name: '男Z',
    levels: ['初入局', '试手', '立契', '掌事', '控局', '有号', '有人找', '主'],
  },
  female_Z: {
    name: '女Z',
    levels: ['初入局', '试手', '立契', '掌事', '控局', '有号', '有人找', '主'],
  },

  // ---------- 下位者 ----------
  male_M: {
    name: '男M',
    levels: ['初入局', '试身', '立约', '承事', '服人', '有号', '有人要', '奴'],
  },
  female_M: {
    name: '女M',
    levels: ['初入局', '试心', '立约', '承事', '归人', '有号', '有人要', '奴'],
  },
  male_Sub: {
    name: '男Sub',
    levels: ['初入局', '试从', '立约', '承令', '归心', '有号', '有人带', 'Sub'],
  },
  female_Sub: {
    name: '女Sub',
    levels: ['初入局', '试从', '立约', '承令', '归心', '有号', '有人带', 'Sub'],
  },
  male_B: {
    name: '男B',
    levels: ['初入局', '试身', '立契', '承事', '服人', '有号', '有人点', '贝'],
  },
  female_B: {
    name: '女B',
    levels: ['初入局', '试身', '立契', '承事', '服人', '有号', '有人点', '贝'],
  },
};

// 获取某身份在某等级下的称呼
export function getLevelTitle(identityId, levelIndex) {
  const config = LEVEL_TITLES[identityId];
  if (!config) return `Lv.${levelIndex}`;
  return config.levels[levelIndex] || `Lv.${levelIndex}`;
}

// 获取某身份的名称标签
export function getIdentityLabel(identityId) {
  const config = LEVEL_TITLES[identityId];
  return config ? config.name : identityId;
}
