// ============================================================
// src/shared/config/archive/fields.js
// 档案馆 · 字段维护文件
// ------------------------------------------------------------
// 本文件由「字段维护流程」产出：运行
//     node tools/get_fields_diff.js
// 对比远程字段与本地 FIELD_LABELS，按「字段id: '名称'」格式输出差异，
// 再把差异粘贴回本文件即可。
//
// 数据源：Zite / Fillout Tables（见 api.js）
//   export const BASE_ID  = 'e7d18ead20743825';
//   export const TABLE_ID = 't4d3B3XvKL8';
//
// 字段总数：56
// ============================================================

// ════════════════════════════════════════════════════════════
// 一、字段标签（id → 展示名称）
// ════════════════════════════════════════════════════════════
export const FIELD_LABELS = {
  // ---- 账号绑定（由表单 URL 参数自动注入）----
  fqqEWH7xiC9: '电子邮件',

  // ---- 问卷控制 / 隐私公开 ----
  fkAEd2CE2gQ: '是否公开问卷内容',
  fedNsXf9DNV: '是否公开常住地址',
  fiaG3fZjmZC: '是否公开联系方式',
  fhUrgTMzZnb: '是否公开生活照片',
  fi8wfWQmC96: '是否公开隐私照片',
  fwKCmynWaVf: '我已确认上述为我真实意愿',

  // ---- 身份与基础信息 ----
  fwz4nCDQfZH: '身份',
  frNSBFFkJpQ: '名称',
  fkHpgmVVTg7: '姓名',
  f57DddbxHNc: '年龄',
  f4bYfA5vsJ3: '封面展示',

  // ---- 身体数据 ----
  fviPchG4Lfi: '身高（cm）',
  f7rpwNruYeG: '体重（kg）',
  ft45UeL5YUS: '罩杯',
  f6RtmHTmp5K: '三围',
  fwiiuSAVzaT: '职业&学历',

  // ---- 联系方式（受隐私开关控制）----
  f2MZCq6ZYzg: '常住地址',
  fwSj6KJHhHc: '联系方式',

  // ---- 生活照（媒体网格）----
  f2ccv3EV3b7: '生活照',
  fnQE4jDkwYr: '生活照 (1)',
  fsGpT1jWgeg: '生活照 (2)',

  // ---- 关系状态 ----
  f97ur4fWUJY: '当前情感状态',
  fjN8Fd9w4YD: '当前子女情况',
  fsinATmNxjT: '是否有主',
  f6sVgYPieRC: '是否有奴',
  fpHndBTMCWW: '是否寻找关系',
  f6BLWweWWyi: '期望关系类型',
  fcD7Cfqdh9m: '对另一半的要求',

  // ---- 经历与偏好 ----
  fvpqqe12WsG: '身体开发进度',
  fpsv5kVoVFb: '百人斩进度',
  fi7Mh24zhgj: '都被什么人操过',
  frPcRu1oJRM: '第一次自慰年纪',
  fqsj3opFdjj: '自慰频率',
  fsujmD4Sbbz: '第一次自慰经历',
  fxnfcMX7FHY: '第一次性交年纪',
  fopXPsZJDB8: '做爱频率',
  fbDMk7Vj33a: '第一次性交经历',
  f3WxA88fhv7: '第一次口交年纪',
  fufy59h1VmA: '深喉最深（cm）',
  ftdFCifwW1t: '第一次肛交年纪',
  fu8L6paFsGL: '菊穴最深（cm）',
  ffV5qc4jmzX: '最多几人同房',
  fwt7u9xzXGa: '拥有的玩具',
  fjkWGL3SVCZ: '玩具补充',
  fqf4UGKw9Z2: '最难忘的性爱',
  f8o1PU7BvMy: '最淫荡的经历',
  fjhrVptg4vK: '最下贱的过去',

  // ---- 私密影像（媒体网格，受隐私开关控制）----
  f1vsrcvqHDD: '乳',
  fux2osNYRgC: '穴',
  fasr1Gix1Yx: '臀',
  fqYosUpZ3eh: '腿',

  // ---- 验证素材 ----
  f2GdxJp7zxb: '验证素材',
  fbrzqgWKxKj: '素材附件 1',
  f2PfcBcVByU: '素材附件 2',
};

// ════════════════════════════════════════════════════════════
// 二、系统字段（详情页与卡片均不展示）
// ════════════════════════════════════════════════════════════
export const SYSTEM_FIELD_IDS = {
  fkYBsZUhZCv: 'Source',
};

// ════════════════════════════════════════════════════════════
// 三、卡片字段映射
// ------------------------------------------------------------
// verified 现指向「我已确认上述为我真实意愿」
// （旧表的「认证」字段已在本版数据库中移除）
// ════════════════════════════════════════════════════════════
export const CARD_FIELDS = {
  photo: 'f4bYfA5vsJ3',          // 封面展示
  photoFallback: 'f2ccv3EV3b7',  // 生活照（无封面时回退）
  name: 'fkHpgmVVTg7',           // 姓名
  nameFallback: 'frNSBFFkJpQ',   // 名称（无姓名时回退）
  age: 'f57DddbxHNc',            // 年龄
  area: 'f2MZCq6ZYzg',           // 常住地址（受隐私开关控制）
  height: 'fviPchG4Lfi',         // 身高
  weight: 'f7rpwNruYeG',         // 体重
  verified: 'fwKCmynWaVf',       // 我已确认上述为我真实意愿
  // 筛选字段（供列表页按身份分流）
  identity: 'fwz4nCDQfZH',       // 身份
  // 检索辅助（管理面板搜索用）
  profession: 'fwiiuSAVzaT',     // 职业&学历
};

// ════════════════════════════════════════════════════════════
// 三之二、列表可见性字段
// ------------------------------------------------------------
// 决定一条记录是否进入列表页。
// 新库用「是否公开问卷内容」这个独立开关；
// 旧库用「公开问卷」（fgerzjJpBTF，已随迁移废弃）——
// 消费方不要在代码里硬编码字段 ID。
// ════════════════════════════════════════════════════════════
export const VISIBILITY_FIELDS = {
  /** 是否公开问卷内容（列表页据此过滤） */
  publicQuestionnaire: 'fkAEd2CE2gQ',
};

// ════════════════════════════════════════════════════════════
// 三之三、隐私开关字段 ID
// ------------------------------------------------------------
// 与 PRIVACY_RULES 的 controlId 一致，单独导出便于代码直接引用。
// ════════════════════════════════════════════════════════════
export const PRIVACY_CONTROL_IDS = {
  address: 'fedNsXf9DNV',       // 是否公开常住地址
  contact: 'fiaG3fZjmZC',       // 是否公开联系方式
  lifePhotos: 'fhUrgTMzZnb',    // 是否公开生活照片
  privatePhotos: 'fi8wfWQmC96', // 是否公开隐私照片
};

// ════════════════════════════════════════════════════════════
// 四、搜索字段（关键词检索范围）
// ════════════════════════════════════════════════════════════
export const SEARCH_FIELDS = [
  'fkHpgmVVTg7',  // 姓名
  'frNSBFFkJpQ',  // 名称
  'fwiiuSAVzaT',  // 职业&学历
  'f2MZCq6ZYzg',  // 常住地址
  'fwz4nCDQfZH',  // 身份
];

// ════════════════════════════════════════════════════════════
// 五、首页专用字段（详情页隐藏）
// ════════════════════════════════════════════════════════════
export const HOME_ONLY_FIELD_IDS = [
  'fqqEWH7xiC9',  // 电子邮件（由表单 URL 参数自动注入，不在详情页展示）
  'fkAEd2CE2gQ',  // 是否公开问卷内容（决定是否进入列表）
  'fwKCmynWaVf',  // 我已确认上述为我真实意愿
  'fwz4nCDQfZH',  // 身份
];

// ════════════════════════════════════════════════════════════
// 六、详情页额外排除
// ════════════════════════════════════════════════════════════
export const EXTRA_EXCLUDED_FIELD_IDS = [
  'frNSBFFkJpQ',  // 名称（与姓名重复，仅卡片回退用）
];

// ════════════════════════════════════════════════════════════
// 七、★ 详情页分组（显隐板块）
// ------------------------------------------------------------
// 注意：id 以 'photos_' 开头的分组走媒体网格渲染，
//       这两个 id 在 detail.js 里被硬编码引用，不要改名。
// ════════════════════════════════════════════════════════════
export const DETAIL_GROUPS = [
  {
    id: 'basic',
    title: '📋 基本信息',
    fields: [
      'f4bYfA5vsJ3',  // 封面展示
      'fkHpgmVVTg7',  // 姓名
      'fwz4nCDQfZH',  // 身份
      'f57DddbxHNc',  // 年龄
      'fviPchG4Lfi',  // 身高（cm）
      'f7rpwNruYeG',  // 体重（kg）
      'ft45UeL5YUS',  // 罩杯
      'f6RtmHTmp5K',  // 三围
      'fwiiuSAVzaT',  // 职业&学历
      'f2MZCq6ZYzg',  // 常住地址 ★受隐私控制
      'fwSj6KJHhHc',  // 联系方式 ★受隐私控制
      'f97ur4fWUJY',  // 当前情感状态
      'fjN8Fd9w4YD',  // 当前子女情况
      'fsinATmNxjT',  // 是否有主
      'f6sVgYPieRC',  // 是否有奴
      'fpHndBTMCWW',  // 是否寻找关系
      'f6BLWweWWyi',  // 期望关系类型
      'fcD7Cfqdh9m',  // 对另一半的要求
      'fwKCmynWaVf',  // 我已确认上述为我真实意愿
    ],
  },
  {
    id: 'photos_life',   // ★ photos_ 开头 → 媒体网格渲染
    title: '📸 生活写照',
    fields: [
      'f2ccv3EV3b7',  // 生活照
      'fnQE4jDkwYr',  // 生活照 (1)
      'fsGpT1jWgeg',  // 生活照 (2)
    ],
  },
  {
    id: 'intimate',
    title: '🔥 亲密经历',
    fields: [
      'fvpqqe12WsG',  // 身体开发进度
      'fpsv5kVoVFb',  // 百人斩进度
      'fi7Mh24zhgj',  // 都被什么人操过
      'frPcRu1oJRM',  // 第一次自慰年纪
      'fqsj3opFdjj',  // 自慰频率
      'fsujmD4Sbbz',  // 第一次自慰经历
      'fxnfcMX7FHY',  // 第一次性交年纪
      'fopXPsZJDB8',  // 做爱频率
      'fbDMk7Vj33a',  // 第一次性交经历
      'f3WxA88fhv7',  // 第一次口交年纪
      'fufy59h1VmA',  // 深喉最深（cm）
      'ftdFCifwW1t',  // 第一次肛交年纪
      'fu8L6paFsGL',  // 菊穴最深（cm）
      'ffV5qc4jmzX',  // 最多几人同房
      'fwt7u9xzXGa',  // 拥有的玩具
      'fjkWGL3SVCZ',  // 玩具补充
      'fqf4UGKw9Z2',  // 最难忘的性爱
      'f8o1PU7BvMy',  // 最淫荡的经历
      'fjhrVptg4vK',  // 最下贱的过去
    ],
  },
  {
    id: 'photos_private',  // ★ photos_ 开头 → 媒体网格渲染
    title: '🔞 私密影像',
    fields: [
      'f1vsrcvqHDD',  // 乳
      'fux2osNYRgC',  // 穴
      'fasr1Gix1Yx',  // 臀
      'fqYosUpZ3eh',  // 腿
      'f2GdxJp7zxb',  // 验证素材
      'fbrzqgWKxKj',  // 素材附件 1
      'f2PfcBcVByU',  // 素材附件 2
    ],
  },
  {
    id: 'privacy',
    title: '🔒 隐私设置',
    fields: [
      'fkAEd2CE2gQ',  // 是否公开问卷内容
      'fedNsXf9DNV',  // 是否公开常住地址
      'fiaG3fZjmZC',  // 是否公开联系方式
      'fhUrgTMzZnb',  // 是否公开生活照片
      'fi8wfWQmC96',  // 是否公开隐私照片
    ],
  },
];

// ════════════════════════════════════════════════════════════
// 八、★ 筛选字段（决定列表页默认展示谁）
// ------------------------------------------------------------
// 取向维度已取消，仅保留身份：
//   访问者身份 → 决定看哪一侧（S 看 M，M 看 S）
// 用户补充字段 ID 后，把 filloutId 填上即生效。
// ════════════════════════════════════════════════════════════
export const FILTER_FIELDS = {
  identity: {
    filloutId: 'fwz4nCDQfZH',   // ★ 身份（新数据库中已存在）
    label: '身份',
    options: ['男S', '女S', '男M', '女M'],
    placeholder: false,          // 已是真实字段 ID
  },
};

// ════════════════════════════════════════════════════════════
// 九、★ 隐私控制规则
// ------------------------------------------------------------
// 本版数据库改用「独立公开开关」：每个开关直接控制对应字段，
// 不再需要旧版的「控制字段本身也是展示字段」配对结构。
// ════════════════════════════════════════════════════════════
export const PRIVACY_RULES = [
  {
    controlId: 'fedNsXf9DNV',            // 是否公开常住地址
    displayIds: ['f2MZCq6ZYzg'],         // 常住地址
  },
  {
    controlId: 'fiaG3fZjmZC',            // 是否公开联系方式
    displayIds: ['fwSj6KJHhHc'],         // 联系方式
  },
  {
    controlId: 'fhUrgTMzZnb',            // 是否公开生活照片
    displayIds: ['f2ccv3EV3b7', 'fnQE4jDkwYr', 'fsGpT1jWgeg'],
  },
  {
    controlId: 'fi8wfWQmC96',            // 是否公开隐私照片
    displayIds: ['f1vsrcvqHDD', 'fux2osNYRgC', 'fasr1Gix1Yx', 'fqYosUpZ3eh'],
  },
];

/** 由 PRIVACY_RULES 自动派生（旧版需手工维护反向表，易漂移） */
export const PRIVACY_DEPENDENCIES = Object.fromEntries(
  PRIVACY_RULES.flatMap((r) => r.displayIds.map((id) => [id, r.controlId]))
);

// ════════════════════════════════════════════════════════════
// 十、角色字段可见性（按平台角色逐级放开）
// ------------------------------------------------------------
// ⚠️ 沿用旧表的字段 ID 口径需重做；当前设置为「一视同仁」，
//    待你确认权限层级后按需收紧。
// ════════════════════════════════════════════════════════════
const ALL_VISIBLE = Object.keys(FIELD_LABELS);

export const ROLE_FIELD_VISIBILITY = {
  guest: ALL_VISIBLE,
  self: ALL_VISIBLE,
  verified: ALL_VISIBLE,
  subadmin: ALL_VISIBLE,
  admin: ALL_VISIBLE,
};
