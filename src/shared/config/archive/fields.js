// 职责    ★ 档案馆字段维护文件：56 个字段的 id→名称、详情页分组（显隐板块）、卡片字段映射、搜索字段、隐私规则、列表可见性字段、筛选字段、角色可见性。
// 归属页面 档案馆全部页面（列表 / 详情 / 后台）＋ 我的页面
// 依赖    无（纯声明式配置）
// 被依赖   archive/instances.js（聚合后供全站读取）
//
// 维护提示
//   · ★ 字段维护流程：运行 npm run fields 对比远程与本地 → 把差异按「字段id: '名称'」粘回本文件 → 消费方自动生效，无需改代码。
//   · ★ DETAIL_GROUPS 决定详情页的板块划分。新增字段要归入某个分组，否则详情页不会展示。
//   · ★ 分组 id 以 photos_ 开头的走媒体网格渲染；photos_life / photos_private 被 detail.js 硬编码引用，不要改名。
//   · PRIVACY_DEPENDENCIES 由 PRIVACY_RULES 自动派生，不需手工维护。
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

  // ---- 平台管理字段（2026-10-04 新增）----
  // 说明：首页认证标签参与展示；点赞数 / 备注 仅程序内部使用，
  //       已登记在 SYSTEM_FIELD_IDS，故此处不再重复列出。
  fb7zJUvkBhe: '首页认证标签',
};

// ════════════════════════════════════════════════════════════
// 二、系统字段（全站视图均不展示，仅程序内部使用）
// ------------------------------------------------------------
// 这些字段不参与任何页面的渲染，只做数据留存或程序内部判断。
// ════════════════════════════════════════════════════════════
export const SYSTEM_FIELD_IDS = {
  fkYBsZUhZCv: 'Source',
  ftHNftMNZgW: '点赞数',   // 平台计数，不面向用户展示
  f8JxmbLPMBL: '备注',     // 平台内部备注
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
  verified: 'fb7zJUvkBhe',       // 首页认证标签（右上角徽章，仅管理员可改）
  // 筛选字段（供列表页按身份分流）
  identity: 'fwz4nCDQfZH',       // 身份
  // 检索辅助（管理面板搜索用）
  profession: 'fwiiuSAVzaT',     // 职业&学历
};

// ════════════════════════════════════════════════════════════
// 三之二、列表可见性字段
// ------------------------------------------------------------
// 决定一条记录是否进入列表页。
// ⚠️ 与「是否公开问卷内容」共用同一个数据库字段，但职能不同：
//    · 列表可见性：这条档案是否出现在列表页（总开关）
//    · 问卷公开（见第九节）：个人信息类字段是否对外可见
// 消费方一律用本对象取字段 ID，不要在代码里硬编码。
// ════════════════════════════════════════════════════════════
export const VISIBILITY_FIELDS = {
  /** 是否公开问卷内容（列表页据此过滤） */
  publicQuestionnaire: 'fkAEd2CE2gQ',
};

/**
 * 账号绑定字段
 * ------------------------------------------------------------
 * 表单提交时由 URL 参数（email / name / uid）自动写入，
 * 用于把「档案记录」与「平台账号」关联起来。
 * 这两个字段不参与任何页面的展示渲染。
 */
export const BINDING_FIELDS = {
  email: 'fqqEWH7xiC9',   // 电子邮件 —— 关联用的主键
  name: 'frNSBFFkJpQ',    // 名称 —— 冗余，供人工核对
};

// 说明：PRIVACY_CONTROL_IDS 已移至第九节，由 PRIVACY_SWITCHES 统一派生。

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
// ★★★ 五、字段可见性注册表 —— 唯一需要维护的地方 ★★★
// ------------------------------------------------------------
// 设计目标：把「哪个页面显示哪些字段」全部集中在这一个对象里。
//   想改某个页面的字段 → 只改对应的数组，不需要动任何页面代码。
//
// 页面读取入口：getFieldsFor('home_card' | 'detail' | 'bind_only'
//                            | 'manage' | 'self')
//
// ⚠️ 这里只管「可见性」。字段是否展示还受另一层控制：
//    隐私开关（见文末 PRIVACY_RULES）—— 未公开的字段对所有人不可见，
//    包括管理员。两层是「与」的关系。
// ════════════════════════════════════════════════════════════
export const FIELD_VISIBILITY = {

  // ── 首页卡片 ──────────────────────────────────────────
  // 卡片＝封面图 + 右侧信息 + 右上角认证徽章
  home_card: [
    'f4bYfA5vsJ3',   // 封面展示
    'fkHpgmVVTg7',   // 姓名
    'f57DddbxHNc',   // 年龄
    'f2MZCq6ZYzg',   // 常住地址
    'fviPchG4Lfi',   // 身高（cm）
    'f7rpwNruYeG',   // 体重（kg）
    'fb7zJUvkBhe',   // 首页认证标签（右上角徽章，仅管理员可改）
  ],

  // ── 详情页 ────────────────────────────────────────────
  // 只在此白名单内的字段会出现在详情页。
  // 分组与排序另由 DETAIL_GROUPS（第七节）决定。
  detail: [
    // 基本信息
    'fkHpgmVVTg7',   // 姓名
    'fwz4nCDQfZH',   // 身份
    'f57DddbxHNc',   // 年龄
    'fviPchG4Lfi',   // 身高（cm）
    'f7rpwNruYeG',   // 体重（kg）
    'ft45UeL5YUS',   // 罩杯
    'f6RtmHTmp5K',   // 三围
    'fwiiuSAVzaT',   // 职业&学历
    'f2MZCq6ZYzg',   // 常住地址      ★受隐私开关控制
    'fwSj6KJHhHc',   // 联系方式      ★受隐私开关控制
    'f97ur4fWUJY',   // 当前情感状态
    'fjN8Fd9w4YD',   // 当前子女情况
    'fsinATmNxjT',   // 是否有主
    'f6sVgYPieRC',   // 是否有奴
    'fpHndBTMCWW',   // 是否寻找关系
    'f6BLWweWWyi',   // 期望关系类型
    'fcD7Cfqdh9m',   // 对另一半的要求
    // 生活写照（媒体网格）
    'f2ccv3EV3b7',   // 生活照
    'fnQE4jDkwYr',   // 生活照 (1)
    'fsGpT1jWgeg',   // 生活照 (2)
    // 亲密经历
    'fvpqqe12WsG',   // 身体开发进度
    'fpsv5kVoVFb',   // 百人斩进度
    'fi7Mh24zhgj',   // 都被什么人操过
    'frPcRu1oJRM',   // 第一次自慰年纪
    'fqsj3opFdjj',   // 自慰频率
    'fsujmD4Sbbz',   // 第一次自慰经历
    'fxnfcMX7FHY',   // 第一次性交年纪
    'fopXPsZJDB8',   // 做爱频率
    'fbDMk7Vj33a',   // 第一次性交经历
    'f3WxA88fhv7',   // 第一次口交年纪
    'fufy59h1VmA',   // 深喉最深（cm）
    'ftdFCifwW1t',   // 第一次肛交年纪
    'fu8L6paFsGL',   // 菊穴最深（cm）
    'ffV5qc4jmzX',   // 最多几人同房
    'fwt7u9xzXGa',   // 拥有的玩具
    'fjkWGL3SVCZ',   // 玩具补充
    'fqf4UGKw9Z2',   // 最难忘的性爱
    'f8o1PU7BvMy',   // 最淫荡的经历
    'fjhrVptg4vK',   // 最下贱的过去
    // 私密影像（媒体网格）★受隐私开关控制
    'f1vsrcvqHDD',   // 乳
    'fux2osNYRgC',   // 穴
    'fasr1Gix1Yx',   // 臀
    'fqYosUpZ3eh',   // 腿
    'f2GdxJp7zxb',   // 验证素材
    'fbrzqgWKxKj',   // 素材附件 1
    'f2PfcBcVByU',   // 素材附件 2
    // 平台字段（只读展示）
    // 注意：「首页认证标签」不在详情页展示（只在卡片右上角与管理面板出现）
    'fwKCmynWaVf',   // 我已确认上述为我真实意愿
  ],

  // ── 仅用于「表单 ↔ 用户」绑定 ─────────────────────────
  // 不出现在首页、详情页、管理面板等任何视图。
  bind_only: [
    'fqqEWH7xiC9',   // 电子邮件（表单 URL 参数自动注入）
    'frNSBFFkJpQ',   // 名称（表单 URL 参数自动注入）
  ],

  // ── 管理面板：可勾选编辑 ──────────────────────────────
  manage: [
    'fkAEd2CE2gQ',   // 是否公开问卷内容
    'fedNsXf9DNV',   // 是否公开常住地址
    'fiaG3fZjmZC',   // 是否公开联系方式
    'fhUrgTMzZnb',   // 是否公开生活照片
    'fi8wfWQmC96',   // 是否公开隐私照片
    'fb7zJUvkBhe',   // 首页认证标签 ← 仅管理员可改
  ],

  // ── 我的页面：用户自助勾选（本人档案）──────────────────
  // 与管理面板的区别：不含「首页认证标签」——用户看不到也改不了
  self: [
    'fkAEd2CE2gQ',   // 是否公开问卷内容
    'fedNsXf9DNV',   // 是否公开常住地址
    'fiaG3fZjmZC',   // 是否公开联系方式
    'fhUrgTMzZnb',   // 是否公开生活照片
    'fi8wfWQmC96',   // 是否公开隐私照片
  ],
};

// ════════════════════════════════════════════════════════════
// 六、由注册表派生的兼容常量
// ------------------------------------------------------------
// 说明：以下常量原本是手工维护的独立数组，现改为从
//       FIELD_VISIBILITY 派生，保证与注册表永远一致。
//       导出名保持不变，避免破坏现有消费方。
// ════════════════════════════════════════════════════════════

/** 全部字段 ID（标签 + 系统字段） */
const ALL_FIELD_IDS = [...Object.keys(FIELD_LABELS), ...Object.keys(SYSTEM_FIELD_IDS)];

/**
 * 详情页不展示的字段 = 全部字段 − detail ∪ never
 * 取代原先手工维护的 HOME_ONLY_FIELD_IDS + EXTRA_EXCLUDED_FIELD_IDS
 */
export const DETAIL_EXCLUDED_FIELD_IDS = ALL_FIELD_IDS.filter(
  (id) => !FIELD_VISIBILITY.detail.includes(id)
);

/** @deprecated 保留兼容；请改用 FIELD_VISIBILITY.detail */
export const HOME_ONLY_FIELD_IDS = [
  ...FIELD_VISIBILITY.bind_only,
  ...FIELD_VISIBILITY.manage.filter((id) => !FIELD_VISIBILITY.detail.includes(id)),
  ...Object.keys(SYSTEM_FIELD_IDS),
];

/** @deprecated 保留兼容；请改用 FIELD_VISIBILITY.detail */
export const EXTRA_EXCLUDED_FIELD_IDS = [
  ...FIELD_VISIBILITY.bind_only,
  ...Object.keys(SYSTEM_FIELD_IDS),
];

/**
 * 字段使用表（自动生成，勿手改）
 * 用途：反查某个字段被哪些页面使用 —— 表格与文档直接读它
 */
export const FIELD_USAGE = (() => {
  const usage = {};
  const mark = (fieldId, page, section) => {
    if (!fieldId) return;
    usage[fieldId] ||= { pages: [], sections: [] };
    if (!usage[fieldId].pages.includes(page)) usage[fieldId].pages.push(page);
    if (section && !usage[fieldId].sections.includes(section)) usage[fieldId].sections.push(section);
  };
  FIELD_VISIBILITY.home_card.forEach((id) => mark(id, '首页', '卡片'));
  FIELD_VISIBILITY.detail.forEach((id) => mark(id, '详情页', '字段区'));
  FIELD_VISIBILITY.bind_only.forEach((id) => mark(id, '我的页面', '表单绑定'));
  FIELD_VISIBILITY.manage.forEach((id) => mark(id, '管理面板', '字段管理'));
  FIELD_VISIBILITY.self.forEach((id) => mark(id, '我的页面', '字段管理'));
  // 系统字段不面向任何页面
  Object.keys(SYSTEM_FIELD_IDS).forEach((id) => {
    usage[id] ||= { pages: [], sections: ['系统内部'] };
  });
  return usage;
})();

/**
 * 按页面区域取字段 ID 列表 —— 各页面的统一读取入口
 * @param {'home_card'|'detail'|'bind_only'|'manage'|'self'} area
 * @returns {string[]}
 */
export function getFieldsFor(area) {
  return FIELD_VISIBILITY[area] || [];
}

/** 某字段是否用于指定区域 */
export function isFieldIn(area, fieldId) {
  return getFieldsFor(area).includes(fieldId);
}

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
// 九、★★★ 隐私公开开关（5 个，统一管理）★★★
// ------------------------------------------------------------
// 规则语义：
//   · 每个开关为 true 时，其 controls 里的字段才对外可见
//   · 未公开的字段对**所有人**不可见，**包括管理员** —— 这是
//     用户的私人选择，不是权限问题，因此与角色无关
//   · 开关自身只在两个地方可见可改：管理面板、我的页面（本人）
//
// ★ 语义划分原则：全部按「信息类别」组织，同一类信息归同一个开关。
//
// ⚠️ 待确认：第 5 个开关「是否公开问卷内容」目前控制【个人信息类】
//     （姓名 / 年龄 / 身份 / 身高等）。它最初是「是否允许该档案进入
//     列表页」的总开关，但该职能已由列表可见性承担。若你希望它改为
//     控制经历类字段，请把 questionnaire.controls 换掉即可。
// ════════════════════════════════════════════════════════════
export const PRIVACY_SWITCHES = {
  // ① 是否公开问卷内容 —— 个人信息类
  questionnaire: {
    controlId: 'fkAEd2CE2gQ',
    label: '是否公开问卷内容',
    key: 'publicQuestionnaire',
    desc: '个人信息类字段：姓名、年龄、身份、身体数据、职业学历',
    controls: [
      'fkHpgmVVTg7',   // 姓名
      'fwz4nCDQfZH',   // 身份
      'f57DddbxHNc',   // 年龄
      'fviPchG4Lfi',   // 身高（cm）
      'f7rpwNruYeG',   // 体重（kg）
      'ft45UeL5YUS',   // 罩杯
      'f6RtmHTmp5K',   // 三围
      'fwiiuSAVzaT',   // 职业&学历
    ],
  },

  // ② 是否公开常住地址
  address: {
    controlId: 'fedNsXf9DNV',
    label: '是否公开常住地址',
    key: 'address',
    desc: '常住地址',
    controls: ['f2MZCq6ZYzg'],
  },

  // ③ 是否公开联系方式
  contact: {
    controlId: 'fiaG3fZjmZC',
    label: '是否公开联系方式',
    key: 'contact',
    desc: '联系方式',
    controls: ['fwSj6KJHhHc'],
  },

  // ④ 是否公开生活照片
  lifePhotos: {
    controlId: 'fhUrgTMzZnb',
    label: '是否公开生活照片',
    key: 'lifePhotos',
    desc: '生活照（3 个媒体字段）',
    controls: ['f2ccv3EV3b7', 'fnQE4jDkwYr', 'fsGpT1jWgeg'],
  },

  // ⑤ 是否公开隐私照片
  privatePhotos: {
    controlId: 'fi8wfWQmC96',
    label: '是否公开隐私照片',
    key: 'privatePhotos',
    desc: '私密影像（乳 / 穴 / 臀 / 腿）',
    controls: ['f1vsrcvqHDD', 'fux2osNYRgC', 'fasr1Gix1Yx', 'fqYosUpZ3eh'],
  },
};

/** 全部 5 个开关的 controlId，按显示顺序 */
export const PRIVACY_CONTROL_IDS = Object.fromEntries(
  Object.entries(PRIVACY_SWITCHES).map(([k, v]) => [k, v.controlId])
);

/**
 * 隐私规则数组（由 PRIVACY_SWITCHES 派生，供现有消费方使用）
 * 格式保持向后兼容：{ controlId, displayIds }
 */
export const PRIVACY_RULES = Object.values(PRIVACY_SWITCHES).map((s) => ({
  controlId: s.controlId,
  controlLabel: s.label,
  displayIds: s.controls,
}));

/** 由 PRIVACY_RULES 自动派生（旧版需手工维护反向表，易漂移） */
export const PRIVACY_DEPENDENCIES = Object.fromEntries(
  PRIVACY_RULES.flatMap((r) => r.displayIds.map((id) => [id, r.controlId]))
);

/**
 * 隐私开关可直接管理的页面区域
 * 管理面板 + 我的页面各存一份，差异在于「首页认证标签」仅管理面板有
 */
export const PRIVACY_SWITCH_PAGES = {
  manage: '管理面板',
  self: '我的页面（本人）',
};

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
