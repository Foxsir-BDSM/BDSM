// ============================================================
// assets/config/archive/instances.js
// 所有档案馆实例配置注册中心
// ============================================================

// ============================================================
// 实例 1：下位者档案馆（欲渊之庭）✅ 已完整配置
// ============================================================
export const SUB_ARCHIVE_CONFIG = {
  id: 'sub-archive',
  name: '下位者档案馆',

  // ============================================================
  // 字段标签映射（FIELD_LABELS）
  // 格式：'字段ID': '中文显示名'
  // ============================================================
  FIELD_LABELS: {
    // ---- 基本信息 ----
    fqidTsBW5js: '姓名',
    fdPfeoZzfSM: '年龄',
    ffcCmCH3kSE: '身高',
    fgSKHPJhFhb: '体重',
    fhYoXMy4jSp: '罩杯',
    faAhwfMWp8W: '三围',
    fsaqeVWs1cX: '职业&学历',
    f2LQqpzRxcE: '常住地址',
    fws6eaKNh29: '联系方式',
    f99RpESRNBX: '颜值',
    fb483ZvPoMH: '身材',

    // ---- 生活照 ----
    fpAFnqZh8XY: '生活照',
    fvXfbzs1w7q: '照片2',
    f2tp4pmcEer: '照片3',
    feExminrRcK: '照片4',

    // ---- 私密影像 ----
    f5FpfrTPvQh: '乳',
    fbbFbn2c9TV: '穴',
    f9Jhy6F4jXh: '臀',
    fjiCLYCpyeJ: '腿',
    fk1ywquw4y5: '验证照',

    // ---- 情感/关系 ----
    fsD8T1Vb9xx: '当前情感状态',
    f8vviVrV3YL: '当前子女情况',
    fhAgx3yPgBW: '是否有主',
    fc76hghn2cc: '是否寻找关系',
    fe25wHSUz1s: '期望关系类型',
    fdnp5xDJdty: '对另一半的要求',
    fra1kdg5Eby: '都被什么人操过',

    // ---- 性经验 ----
    fv1fNHSpAW3: '第一次自慰年纪',
    fx6wDgrKFwR: '自慰频率',
    fbcpAQMviJU: '第一次口交年纪',
    fpUDyXPVLiY: '第一次破处年纪',
    frT28xE2Ers: '第一次肛交年纪',
    ffgthuczFyn: '深喉最深',
    fjptYmcfYNC: '淫穴最深',
    f5Wk3u2aCfh: '菊穴最深',
    f2CHgyFWPYw: '做爱频率',

    // ---- 性爱好/经历 ----
    f3nrrFztgvQ: '玩具',
    ft5Ya9T9uEb: '玩具补充',
    f2uXHj4eDb2: '最难忘的性爱',
    fdfri1EJhKf: '最淫荡的经历',
    fnV2QAxshjr: '最下贱的过去',

    // ---- 开发进度 ----
    faU5LW3tRNU: '身体开发进度',
    fsnT6sCC3T8: '百人斩进度',
    f4GnxxQ2Ggr: '是否多人',
    f9nZe7gNevh: '最多几人同房',

    // ---- 隐私确认（控制字段） ----
    f1s9DJg4oLc: '常住地址（隐私确认）',
    fgHLgfGRzy8: '联系方式（隐私确认）',
    fgtX9QmBAM5: '生活照片（隐私确认）',
    fwEcZvqiGvm: '隐私照片（隐私确认）',

    // ---- 系统/表单控制 ----
    f1i68ZWVLAD: '我已知悉',
    fkw18M6UR5s: '继续填写',

    // ---- 首页专用 ----
    feVJMAAnX7s: '推荐指数',
    fwK2mQMoxto: '认证',
    fxwUAnrwpaT: 'ID',
    fgerzjJpBTF: '公开问卷',
    fmSgRAcdGsT: '认证',
  },

  // ============================================================
  // 首页卡片字段映射（CARD_FIELDS）
  // ============================================================
  CARD_FIELDS: {
    photo: 'fpAFnqZh8XY',
    photoFallback: 'fvXfbzs1w7q',
    name: 'fqidTsBW5js',
    nameFallback: 'fqidTsBW5js',
    age: 'fdPfeoZzfSM',
    area: 'f2LQqpzRxcE',
    height: 'ffcCmCH3kSE',
    weight: 'fgSKHPJhFhb',
    recommend: 'feVJMAAnX7s',
    verified: 'fwK2mQMoxto',
  },

  // ============================================================
  // 搜索匹配字段（SEARCH_FIELDS）
  // ============================================================
  SEARCH_FIELDS: ['fqidTsBW5js', 'fsaqeVWs1cX', 'f2LQqpzRxcE'],

  // ============================================================
  // 详情页分组配置（DETAIL_GROUPS）
  // 分组 id 以 'photos_' 开头 → 自动触发媒体网格渲染
  // ============================================================
  DETAIL_GROUPS: [
    {
      id: 'basic',
      title: '📋 基本信息',
      fields: [
        'fqidTsBW5js', // 姓名
        'fdPfeoZzfSM', // 年龄
        'ffcCmCH3kSE', // 身高
        'fgSKHPJhFhb', // 体重
        'fhYoXMy4jSp', // 罩杯
        'faAhwfMWp8W', // 三围
        'f99RpESRNBX', // 颜值
        'fb483ZvPoMH', // 身材
        'fsaqeVWs1cX', // 职业&学历
        'f2LQqpzRxcE', // 常住地址 ★受隐私控制★
        'fws6eaKNh29', // 联系方式 ★受隐私控制★
        'fsD8T1Vb9xx', // 当前情感状态
        'f8vviVrV3YL', // 当前子女情况
        'fhAgx3yPgBW', // 是否有主
        'fc76hghn2cc', // 是否寻找关系
        'fe25wHSUz1s', // 期望关系类型
        'fdnp5xDJdty', // 对另一半的要求
      ],
    },
    {
      id: 'photos_life', // ★ 'photos_' 开头 → 媒体网格渲染
      title: '📸 生活写照',
      fields: [
        'fpAFnqZh8XY', // 生活照 ★受隐私控制★
        'fvXfbzs1w7q', // 照片2 ★受隐私控制★
        'f2tp4pmcEer', // 照片3 ★受隐私控制★
        'feExminrRcK', // 照片4 ★受隐私控制★
      ],
    },
    {
      id: 'intimate',
      title: '🔥 亲密经历',
      fields: [
        'fv1fNHSpAW3', // 第一次自慰年纪
        'fx6wDgrKFwR', // 自慰频率
        'faU5LW3tRNU', // 身体开发进度
        'fsnT6sCC3T8', // 百人斩进度
        'f4GnxxQ2Ggr', // 是否多人
        'f9nZe7gNevh', // 最多几人同房
        'fra1kdg5Eby', // 都被什么人操过
        'fbcpAQMviJU', // 第一次口交年纪
        'ffgthuczFyn', // 深喉最深
        'fpUDyXPVLiY', // 第一次破处年纪
        'fjptYmcfYNC', // 淫穴最深
        'frT28xE2Ers', // 第一次肛交年纪
        'f5Wk3u2aCfh', // 菊穴最深
        'f2CHgyFWPYw', // 做爱频率
        'f3nrrFztgvQ', // 玩具
        'ft5Ya9T9uEb', // 玩具补充
        'f2uXHj4eDb2', // 最难忘的性爱
        'fdfri1EJhKf', // 最淫荡的经历
        'fnV2QAxshjr', // 最下贱的过去
      ],
    },
    {
      id: 'photos_private', // ★ 'photos_' 开头 → 媒体网格渲染
      title: '🔞 私密影像',
      fields: [
        'f5FpfrTPvQh', // 乳 ★受隐私控制★
        'fbbFbn2c9TV', // 穴 ★受隐私控制★
        'f9Jhy6F4jXh', // 臀 ★受隐私控制★
        'fjiCLYCpyeJ', // 腿 ★受隐私控制★
        'fk1ywquw4y5', // 验证照 ★受隐私控制★
      ],
    },
  ],

  // ---- 详情页字段顺序（由 DETAIL_GROUPS 自动生成） ----
  get DETAIL_FIELD_ORDER() {
    return this.DETAIL_GROUPS.flatMap((group) => group.fields);
  },

  // ============================================================
  // 系统字段（隐藏，不展示）
  // ============================================================
  SYSTEM_FIELD_IDS: {
    f5ipjxwBNdD: 'Source',
  },

  // ============================================================
  // 首页专用字段（详情页隐藏）
  // ============================================================
  HOME_ONLY_FIELD_IDS: [
    'fgerzjJpBTF', // 公开问卷
    'feVJMAAnX7s', // 推荐指数
    'fwK2mQMoxto', // 认证
    'fxwUAnrwpaT', // ID
  ],

  // ============================================================
  // 额外排除字段（详情页不显示）
  // ============================================================
  EXTRA_EXCLUDED_FIELD_IDS: [
    'f1i68ZWVLAD', // 我已知悉
    'fkw18M6UR5s', // 继续填写
  ],

  // ============================================================
  // ★★★ 隐私控制规则（PRIVACY_RULES） ★★★
  // 控制字段为 true 时，显示对应的展示字段
  // ============================================================
  PRIVACY_RULES: [
    {
      controlId: 'f1s9DJg4oLc', // 常住地址（隐私确认）
      displayIds: ['f2LQqpzRxcE'], // 常住地址
    },
    {
      controlId: 'fgHLgfGRzy8', // 联系方式（隐私确认）
      displayIds: ['fws6eaKNh29'], // 联系方式
    },
    {
      controlId: 'fgtX9QmBAM5', // 生活照片（隐私确认）
      displayIds: ['fpAFnqZh8XY', 'fvXfbzs1w7q', 'f2tp4pmcEer', 'feExminrRcK'],
    },
    {
      controlId: 'fwEcZvqiGvm', // 隐私照片（隐私确认）
      displayIds: ['f5FpfrTPvQh', 'fbbFbn2c9TV', 'f9Jhy6F4jXh', 'fjiCLYCpyeJ', 'fk1ywquw4y5'],
    },
  ],

  // ============================================================
  // ★★★ 隐私依赖映射（PRIVACY_DEPENDENCIES） ★★★
  // 格式：'受控字段ID': '控制字段ID'
  // 用于详情页快速过滤：控制字段为 false/undefined 时，受控字段隐藏
  // ============================================================
  PRIVACY_DEPENDENCIES: {
    // ---- 常住地址（控制字段：f1s9DJg4oLc） ----
    'f2LQqpzRxcE': 'f1s9DJg4oLc',

    // ---- 联系方式（控制字段：fgHLgfGRzy8） ----
    'fws6eaKNh29': 'fgHLgfGRzy8',

    // ---- 生活照片（控制字段：fgtX9QmBAM5） ----
    // 注意：控制字段本身也是展示字段，依赖指向自己
    'fpAFnqZh8XY': 'fgtX9QmBAM5',
    'fvXfbzs1w7q': 'fgtX9QmBAM5',
    'f2tp4pmcEer': 'fgtX9QmBAM5',
    'feExminrRcK': 'fgtX9QmBAM5',

    // ---- 私密影像（控制字段：fwEcZvqiGvm） ----
    // 注意：控制字段本身也是展示字段，依赖指向自己
    'f5FpfrTPvQh': 'fwEcZvqiGvm',
    'fbbFbn2c9TV': 'fwEcZvqiGvm',
    'f9Jhy6F4jXh': 'fwEcZvqiGvm',
    'fjiCLYCpyeJ': 'fwEcZvqiGvm',
    'fk1ywquw4y5': 'fwEcZvqiGvm',
  },

  // ============================================================
  // 角色字段可见性（ROLE_FIELD_VISIBILITY）
  // 白名单机制：未列出的字段对该角色不可见
  // ============================================================
  ROLE_FIELD_VISIBILITY: {
    // ---- 游客：仅可见基本信息（不含隐私字段） ----
    guest: [
      'fqidTsBW5js',
      'fdPfeoZzfSM',
      'ffcCmCH3kSE',
      'fgSKHPJhFhb',
      'fhYoXMy4jSp',
      'faAhwfMWp8W',
      'fsaqeVWs1cX',
      'f99RpESRNBX',
      'fb483ZvPoMH',
      'fsD8T1Vb9xx',
      'f8vviVrV3YL',
      'fhAgx3yPgBW',
      'fc76hghn2cc',
      'fe25wHSUz1s',
      'fdnp5xDJdty',
      'fra1kdg5Eby',
      'fv1fNHSpAW3',
      'fx6wDgrKFwR',
      'fbcpAQMviJU',
      'fpUDyXPVLiY',
      'frT28xE2Ers',
      'ffgthuczFyn',
      'fjptYmcfYNC',
      'f5Wk3u2aCfh',
      'f2CHgyFWPYw',
      'f3nrrFztgvQ',
      'ft5Ya9T9uEb',
      'f2uXHj4eDb2',
      'fdfri1EJhKf',
      'fnV2QAxshjr',
      'faU5LW3tRNU',
      'fsnT6sCC3T8',
      'f4GnxxQ2Ggr',
      'f9nZe7gNevh',
      'fpAFnqZh8XY',
      'fvXfbzs1w7q',
      'f2tp4pmcEer',
      'feExminrRcK',
    ],

    // ---- 普通用户：比游客多常住地址 ----
    self: [
      'fqidTsBW5js',
      'fdPfeoZzfSM',
      'ffcCmCH3kSE',
      'fgSKHPJhFhb',
      'fhYoXMy4jSp',
      'faAhwfMWp8W',
      'fsaqeVWs1cX',
      'f99RpESRNBX',
      'fb483ZvPoMH',
      'fsD8T1Vb9xx',
      'f8vviVrV3YL',
      'fhAgx3yPgBW',
      'fc76hghn2cc',
      'fe25wHSUz1s',
      'fdnp5xDJdty',
      'fra1kdg5Eby',
      'fv1fNHSpAW3',
      'fx6wDgrKFwR',
      'fbcpAQMviJU',
      'fpUDyXPVLiY',
      'frT28xE2Ers',
      'ffgthuczFyn',
      'fjptYmcfYNC',
      'f5Wk3u2aCfh',
      'f2CHgyFWPYw',
      'f3nrrFztgvQ',
      'ft5Ya9T9uEb',
      'f2uXHj4eDb2',
      'fdfri1EJhKf',
      'fnV2QAxshjr',
      'faU5LW3tRNU',
      'fsnT6sCC3T8',
      'f4GnxxQ2Ggr',
      'f9nZe7gNevh',
      'fpAFnqZh8XY',
      'fvXfbzs1w7q',
      'f2tp4pmcEer',
      'feExminrRcK',
      'f2LQqpzRxcE', // 常住地址
      'f5FpfrTPvQh',
      'fbbFbn2c9TV',
      'f9Jhy6F4jXh',
      'fjiCLYCpyeJ',
      'fk1ywquw4y5',
    ],

    // ---- 认证用户：比普通用户多联系方式 ----
    verified: [
      'fqidTsBW5js',
      'fdPfeoZzfSM',
      'ffcCmCH3kSE',
      'fgSKHPJhFhb',
      'fhYoXMy4jSp',
      'faAhwfMWp8W',
      'fsaqeVWs1cX',
      'f99RpESRNBX',
      'fb483ZvPoMH',
      'fsD8T1Vb9xx',
      'f8vviVrV3YL',
      'fhAgx3yPgBW',
      'fc76hghn2cc',
      'fe25wHSUz1s',
      'fdnp5xDJdty',
      'fra1kdg5Eby',
      'fv1fNHSpAW3',
      'fx6wDgrKFwR',
      'fbcpAQMviJU',
      'fpUDyXPVLiY',
      'frT28xE2Ers',
      'ffgthuczFyn',
      'fjptYmcfYNC',
      'f5Wk3u2aCfh',
      'f2CHgyFWPYw',
      'f3nrrFztgvQ',
      'ft5Ya9T9uEb',
      'f2uXHj4eDb2',
      'fdfri1EJhKf',
      'fnV2QAxshjr',
      'faU5LW3tRNU',
      'fsnT6sCC3T8',
      'f4GnxxQ2Ggr',
      'f9nZe7gNevh',
      'fpAFnqZh8XY',
      'fvXfbzs1w7q',
      'f2tp4pmcEer',
      'feExminrRcK',
      'f2LQqpzRxcE',
      'f5FpfrTPvQh',
      'fbbFbn2c9TV',
      'f9Jhy6F4jXh',
      'fjiCLYCpyeJ',
      'fk1ywquw4y5',
      'fws6eaKNh29', // 联系方式
    ],

    // ---- 次级管理：与认证用户相同 ----
    subadmin: [
      'fqidTsBW5js',
      'fdPfeoZzfSM',
      'ffcCmCH3kSE',
      'fgSKHPJhFhb',
      'fhYoXMy4jSp',
      'faAhwfMWp8W',
      'fsaqeVWs1cX',
      'f99RpESRNBX',
      'fb483ZvPoMH',
      'fsD8T1Vb9xx',
      'f8vviVrV3YL',
      'fhAgx3yPgBW',
      'fc76hghn2cc',
      'fe25wHSUz1s',
      'fdnp5xDJdty',
      'fra1kdg5Eby',
      'fv1fNHSpAW3',
      'fx6wDgrKFwR',
      'fbcpAQMviJU',
      'fpUDyXPVLiY',
      'frT28xE2Ers',
      'ffgthuczFyn',
      'fjptYmcfYNC',
      'f5Wk3u2aCfh',
      'f2CHgyFWPYw',
      'f3nrrFztgvQ',
      'ft5Ya9T9uEb',
      'f2uXHj4eDb2',
      'fdfri1EJhKf',
      'fnV2QAxshjr',
      'faU5LW3tRNU',
      'fsnT6sCC3T8',
      'f4GnxxQ2Ggr',
      'f9nZe7gNevh',
      'fpAFnqZh8XY',
      'fvXfbzs1w7q',
      'f2tp4pmcEer',
      'feExminrRcK',
      'f2LQqpzRxcE',
      'f5FpfrTPvQh',
      'fbbFbn2c9TV',
      'f9Jhy6F4jXh',
      'fjiCLYCpyeJ',
      'fk1ywquw4y5',
      'fws6eaKNh29',
    ],

    // ---- 根源管理：所有字段 ----
    admin: [
      'fqidTsBW5js',
      'fdPfeoZzfSM',
      'ffcCmCH3kSE',
      'fgSKHPJhFhb',
      'fhYoXMy4jSp',
      'faAhwfMWp8W',
      'fsaqeVWs1cX',
      'f99RpESRNBX',
      'fb483ZvPoMH',
      'fsD8T1Vb9xx',
      'f8vviVrV3YL',
      'fhAgx3yPgBW',
      'fc76hghn2cc',
      'fe25wHSUz1s',
      'fdnp5xDJdty',
      'fra1kdg5Eby',
      'fv1fNHSpAW3',
      'fx6wDgrKFwR',
      'fbcpAQMviJU',
      'fpUDyXPVLiY',
      'frT28xE2Ers',
      'ffgthuczFyn',
      'fjptYmcfYNC',
      'f5Wk3u2aCfh',
      'f2CHgyFWPYw',
      'f3nrrFztgvQ',
      'ft5Ya9T9uEb',
      'f2uXHj4eDb2',
      'fdfri1EJhKf',
      'fnV2QAxshjr',
      'faU5LW3tRNU',
      'fsnT6sCC3T8',
      'f4GnxxQ2Ggr',
      'f9nZe7gNevh',
      'fpAFnqZh8XY',
      'fvXfbzs1w7q',
      'f2tp4pmcEer',
      'feExminrRcK',
      'f2LQqpzRxcE',
      'f5FpfrTPvQh',
      'fbbFbn2c9TV',
      'f9Jhy6F4jXh',
      'fjiCLYCpyeJ',
      'fk1ywquw4y5',
      'fws6eaKNh29',
    ],
  },
};

// ============================================================
// 实例 2：上位者档案馆（欲主之殿）- 暂未配置（占位）
// ============================================================
export const DOM_ARCHIVE_CONFIG = {
  id: 'dom-archive',
  name: '上位者档案馆',
  FIELD_LABELS: {},
  CARD_FIELDS: { photo: '', name: '', age: '', area: '', height: '', weight: '' },
  SEARCH_FIELDS: [],
  DETAIL_GROUPS: [],
  DETAIL_FIELD_ORDER: [],
  SYSTEM_FIELD_IDS: {},
  HOME_ONLY_FIELD_IDS: [],
  EXTRA_EXCLUDED_FIELD_IDS: [],
  PRIVACY_RULES: [],
  PRIVACY_DEPENDENCIES: {},
  ROLE_FIELD_VISIBILITY: { guest: [], self: [], verified: [], subadmin: [], admin: [] },
};

// ============================================================
// 统一导出
// ============================================================
export const ARCHIVE_INSTANCES = {
  'sub-archive': SUB_ARCHIVE_CONFIG,
  'dom-archive': DOM_ARCHIVE_CONFIG,
};

export function getArchiveConfig(instanceId) {
  return ARCHIVE_INSTANCES[instanceId] || null;
}