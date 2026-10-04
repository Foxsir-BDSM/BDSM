// 职责    ★ 档案馆字段总配置：字段对照表、字段到页面的映射、搜索规则、筛选规则、详情页分组规则、角色可见性。
// 归属页面 档案馆全部页面（列表 / 详情 / 后台）＋ 我的页面
// 依赖    无（纯声明式配置）
// 被依赖   archive/instances.js（聚合后供全站读取）
//
// 维护提示
//   · ★ 想调整某页面显示哪些字段 → 改「二、功能性字段到页面的映射」里对应的数组，不用动任何页面代码。
//   · ★ 字段维护流程：运行 npm run fields 对比远程与本地 → 把差异按「字段id: '名称'」粘回「一、字段对照区域」。
//   · ★ 「首页认证标签」只能出现在「首页卡片」与「管理面板」，不能进「我的页面」（用户不可管理）。
//   · ★ 分组 id 以 photos_ 开头的走媒体网格渲染；photos_life / photos_private 被 detail.js 硬编码引用，不要改名。
//   · PRIVACY_DEPENDENCIES 由 PRIVACY_SWITCHES 自动派生，不需手工维护。

// ============================================================
// src/shared/config/archive/fields.js
// 档案馆 · 字段总配置
// ============================================================
//
// 【本文件的结构】
//
//   一、字段对照区域 ·············· 只做 id ↔ 名称对照，不含任何策略
//   二、功能性字段到页面的映射 ···· 决定哪些字段出现在哪些页面
//       1. 管理面板   2. 我的   3. 首页   4. 详情页
//   三、搜索栏搜索规则 ············ 关键词检索范围
//   四、筛选规则 ·················· 按身份分流 + 5 个隐私公开开关
//   五、详情页分组规则 ············ 详情页的板块划分与排序
//   六、角色字段可见性 ············ 按平台角色逐级放开
//
// 【数据源】
//   Zite / Fillout Tables
//     baseId  = e7d18ead20743825
//     tableId = t4d3B3XvKL8
//   字段总数：59
// ============================================================


// ════════════════════════════════════════════════════════════
// 一、字段对照区域
// ------------------------------------------------------------
// 本区域不负责任何页面逻辑，仅作为「字段 id ↔ 名称」的对照表使用。
// 其余所有区域都从这里引用字段 id。
// ════════════════════════════════════════════════════════════

/** 参与展示的字段（id → 展示名称） */
export const FIELD_LABELS = {
  // ---- 账号绑定（由表单 URL 参数自动注入）----
  fqqEWH7xiC9: '电子邮件',
  frNSBFFkJpQ: '名称',

  // ---- 隐私公开开关（5 个）----
  fkAEd2CE2gQ: '是否公开问卷内容',
  fedNsXf9DNV: '是否公开常住地址',
  fiaG3fZjmZC: '是否公开联系方式',
  fhUrgTMzZnb: '是否公开生活照片',
  fi8wfWQmC96: '是否公开隐私照片',

  // ---- 身份与确认 ----
  fwz4nCDQfZH: '身份',
  fwKCmynWaVf: '我已确认上述为我真实意愿',
  fb7zJUvkBhe: '首页认证标签',

  // ---- 基础信息 ----
  fkHpgmVVTg7: '姓名',
  f57DddbxHNc: '年龄',
  fviPchG4Lfi: '身高（cm）',
  f7rpwNruYeG: '体重（kg）',
  ft45UeL5YUS: '罩杯',
  f6RtmHTmp5K: '三围',
  fwiiuSAVzaT: '职业&学历',
  f2MZCq6ZYzg: '常住地址',
  fwSj6KJHhHc: '联系方式',
  f4bYfA5vsJ3: '封面展示',

  // ---- 生活写照（媒体网格）----
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

  // ---- 亲密经历 ----
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

  // ---- 私密影像（媒体网格）----
  f1vsrcvqHDD: '乳',
  fux2osNYRgC: '穴',
  fasr1Gix1Yx: '臀',
  fqYosUpZ3eh: '腿',

  // ---- 验证素材 ----
  f2GdxJp7zxb: '验证素材',
  fbrzqgWKxKj: '素材附件 1',
  f2PfcBcVByU: '素材附件 2',
};

/** 系统字段：不参与任何页面渲染，仅作数据留存或程序内部判断 */
export const SYSTEM_FIELD_IDS = {
  fkYBsZUhZCv: 'Source',
  ftHNftMNZgW: '点赞数',
  f8JxmbLPMBL: '备注',
};

/** 全部字段 id（对照区全量） */
const ALL_FIELD_IDS = [...Object.keys(FIELD_LABELS), ...Object.keys(SYSTEM_FIELD_IDS)];

/** 取字段展示名（对照区统一出口） */
export function labelOf(fieldId) {
  return FIELD_LABELS[fieldId] || SYSTEM_FIELD_IDS[fieldId] || fieldId;
}


// ════════════════════════════════════════════════════════════
// 二、功能性字段到页面的映射
// ------------------------------------------------------------
// 本区域决定「哪些字段出现在哪些页面」以及「哪些页面能调动哪些字段」。
//
// ★ 这是日常维护的主入口：
//     想调整某页面的字段 → 改对应数组即可，无需改任何页面代码。
//
// ⚠️ 本区域只管「可见 / 可读 / 可写」的资格；
//    字段最终是否展示还受「四、筛选规则」里的隐私开关约束（两层是「与」）。
// ════════════════════════════════════════════════════════════
export const FIELDS_BY_PAGE = {

  // ── 1. 管理面板 ────────────────────────────────────────
  // 管理员可调动的字段。未登记在此的字段，管理面板不可见、不可读、不可写。
  admin: {
    /** 可勾选编辑的字段（同时作为写库白名单） */
    editable: [
      'fkAEd2CE2gQ',   // 是否公开问卷内容
      'fedNsXf9DNV',   // 是否公开常住地址
      'fiaG3fZjmZC',   // 是否公开联系方式
      'fhUrgTMzZnb',   // 是否公开生活照片
      'fi8wfWQmC96',   // 是否公开隐私照片
      'fb7zJUvkBhe',   // 首页认证标签 ← 仅管理面板可改
    ],
    /** 检索时参与匹配的字段 */
    searchable: [
      'fkHpgmVVTg7',   // 姓名
      'fwiiuSAVzaT',   // 职业&学历
      'f2MZCq6ZYzg',   // 常住地址
    ],
  },

  // ── 2. 我的页面 ────────────────────────────────────────
  // 用户本人对自己档案的管理能力。
  my: {
    /**
     * 用户可自助勾选的字段（5 个隐私开关）
     * ★ 不含「首页认证标签」—— 该字段仅管理面板可见可改，
     *   用户在此既看不到也改不了（数据层就不下发）。
     */
    editable: [
      'fkAEd2CE2gQ',   // 是否公开问卷内容
      'fedNsXf9DNV',   // 是否公开常住地址
      'fiaG3fZjmZC',   // 是否公开联系方式
      'fhUrgTMzZnb',   // 是否公开生活照片
      'fi8wfWQmC96',   // 是否公开隐私照片
    ],
    /** 只读展示的字段 */
    readonly: [
      'fb7zJUvkBhe',   // 首页认证标签（认证状态，用户不可管理）
      'fkHpgmVVTg7',   // 姓名
    ],
    /** 仅用于「表单 ↔ 账号」绑定，不出现在任何可视区域 */
    binding: [
      'fqqEWH7xiC9',   // 电子邮件（URL 参数注入，关联主键）
      'frNSBFFkJpQ',   // 名称（URL 参数注入，人工核对用）
    ],
  },

  // ── 3. 首页 ────────────────────────────────────────────
  home: {
    /** 列表卡片展示的字段 */
    card: [
      'f4bYfA5vsJ3',   // 封面展示
      'fkHpgmVVTg7',   // 姓名
      'f57DddbxHNc',   // 年龄
      'f2MZCq6ZYzg',   // 常住地址   ★受隐私开关控制
      'fviPchG4Lfi',   // 身高（cm）
      'f7rpwNruYeG',   // 体重（kg）
      'fb7zJUvkBhe',   // 首页认证标签（右上角徽章）
    ],
    /** 决定记录是否进入列表（列表总开关） */
    visibility: 'fkAEd2CE2gQ',   // 是否公开问卷内容
    /** 卡片字段的语义槽位（渲染时按槽位取值） */
    slots: {
      photo: 'f4bYfA5vsJ3',
      photoFallback: 'f2ccv3EV3b7',
      name: 'fkHpgmVVTg7',
      nameFallback: 'frNSBFFkJpQ',
      age: 'f57DddbxHNc',
      area: 'f2MZCq6ZYzg',
      height: 'fviPchG4Lfi',
      weight: 'f7rpwNruYeG',
      verified: 'fb7zJUvkBhe',
      identity: 'fwz4nCDQfZH',
      profession: 'fwiiuSAVzaT',
    },
  },

  // ── 4. 详情页 ──────────────────────────────────────────
  // 白名单制：只有登记在此的字段才会出现在详情页。
  // 分组与顺序另见「五、详情页分组规则」。
  detail: {
    visible: [
      // 基础信息
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
      // 平台字段（只读）
      'fwKCmynWaVf',   // 我已确认上述为我真实意愿
      // 说明：「首页认证标签」不在详情页展示，只在首页卡片与管理面板出现
    ],
  },
};


// ════════════════════════════════════════════════════════════
// 三、搜索栏搜索规则
// ------------------------------------------------------------
// 关键词检索命中的字段范围。用户输入会在这些字段里做包含匹配。
// ════════════════════════════════════════════════════════════
export const SEARCH_FIELDS = [
  'fkHpgmVVTg7',   // 姓名
  'frNSBFFkJpQ',   // 名称
  'fwiiuSAVzaT',   // 职业&学历
  'f2MZCq6ZYzg',   // 常住地址
  'fwz4nCDQfZH',   // 身份
];


// ════════════════════════════════════════════════════════════
// 四、筛选规则
// ------------------------------------------------------------
// 列表页「默认展示谁」的推导依据。
//
// 取向维度已于 2026-10-04 取消，现仅按身份分流：
//   S 侧访问者（男S / 女S）→ 默认展示 M 侧档案
//   M 侧访问者（男M / 女M）→ 默认展示 S 侧档案
// ════════════════════════════════════════════════════════════
export const FILTER_FIELDS = {
  identity: {
    filloutId: 'fwz4nCDQfZH',   // 身份
    label: '身份',
    options: ['男S', '女S', '男M', '女M'],
    placeholder: false,
  },
};

/**
 * 隐私公开开关（5 个）—— 筛选的第二层
 * ------------------------------------------------------------
 * 规则语义：
 *   · 开关为 true 时，其 controls 里的字段才对外可见
 *   · 未公开的字段对**所有人**不可见，**包括管理员**
 *     （是否公开是用户的私人选择，不是权限层级问题）
 *   · 开关自身只在「管理面板」与「我的页面」可见可改
 *
 * 划分原则：按「信息类别」组织，同一类信息归同一个开关。
 */
export const PRIVACY_SWITCHES = {
  // ① 是否公开问卷内容 —— 个人信息类
  // ⚠️ 待确认：该开关目前控制个人信息类字段。若你希望它改为控制
  //    经历类字段，替换下面的 controls 数组即可。
  questionnaire: {
    controlId: 'fkAEd2CE2gQ',
    label: '是否公开问卷内容',
    desc: '个人信息类：姓名、身份、身体数据、职业学历',
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
    desc: '常住地址',
    controls: ['f2MZCq6ZYzg'],
  },
  // ③ 是否公开联系方式
  contact: {
    controlId: 'fiaG3fZjmZC',
    label: '是否公开联系方式',
    desc: '联系方式',
    controls: ['fwSj6KJHhHc'],
  },
  // ④ 是否公开生活照片
  lifePhotos: {
    controlId: 'fhUrgTMzZnb',
    label: '是否公开生活照片',
    desc: '生活照（3 个媒体字段）',
    controls: ['f2ccv3EV3b7', 'fnQE4jDkwYr', 'fsGpT1jWgeg'],
  },
  // ⑤ 是否公开隐私照片
  privatePhotos: {
    controlId: 'fi8wfWQmC96',
    label: '是否公开隐私照片',
    desc: '私密影像（乳 / 穴 / 臀 / 腿）',
    controls: ['f1vsrcvqHDD', 'fux2osNYRgC', 'fasr1Gix1Yx', 'fqYosUpZ3eh'],
  },
};

/**
 * 隐私规则数组（由 PRIVACY_SWITCHES 派生，供既有消费方使用）
 * 格式：{ controlId, controlLabel, displayIds }
 */
export const PRIVACY_RULES = Object.values(PRIVACY_SWITCHES).map((s) => ({
  controlId: s.controlId,
  controlLabel: s.label,
  displayIds: s.controls,
}));

/** 受控字段 → 控制字段 的反查表（自动派生，不需手工维护） */
export const PRIVACY_DEPENDENCIES = Object.fromEntries(
  PRIVACY_RULES.flatMap((r) => r.displayIds.map((id) => [id, r.controlId]))
);

/** 5 个开关的 controlId 快捷索引 */
export const PRIVACY_CONTROL_IDS = Object.fromEntries(
  Object.entries(PRIVACY_SWITCHES).map(([k, v]) => [k, v.controlId])
);


// ════════════════════════════════════════════════════════════
// 五、详情页分组规则
// ------------------------------------------------------------
// 决定详情页的板块划分与板块内字段顺序。
// 字段能否出现仍由「二 · 详情页白名单」决定 —— 两层都满足才渲染。
//
// ⚠️ 分组 id 以 'photos_' 开头的走媒体网格渲染；
//    photos_life / photos_private 被 detail.js 硬编码引用，不要改名。
// ════════════════════════════════════════════════════════════
export const DETAIL_GROUPS = [
  {
    id: 'basic',
    title: '📋 基本信息',
    fields: [
      'f4bYfA5vsJ3',   // 封面展示
      'fkHpgmVVTg7',   // 姓名
      'fwz4nCDQfZH',   // 身份
      'f57DddbxHNc',   // 年龄
      'fviPchG4Lfi',   // 身高（cm）
      'f7rpwNruYeG',   // 体重（kg）
      'ft45UeL5YUS',   // 罩杯
      'f6RtmHTmp5K',   // 三围
      'fwiiuSAVzaT',   // 职业&学历
      'f2MZCq6ZYzg',   // 常住地址
      'fwSj6KJHhHc',   // 联系方式
      'f97ur4fWUJY',   // 当前情感状态
      'fjN8Fd9w4YD',   // 当前子女情况
      'fsinATmNxjT',   // 是否有主
      'f6sVgYPieRC',   // 是否有奴
      'fpHndBTMCWW',   // 是否寻找关系
      'f6BLWweWWyi',   // 期望关系类型
      'fcD7Cfqdh9m',   // 对另一半的要求
      'fwKCmynWaVf',   // 我已确认上述为我真实意愿
    ],
  },
  {
    id: 'photos_life',   // ★ photos_ 前缀 → 媒体网格渲染
    title: '📸 生活写照',
    fields: [
      'f2ccv3EV3b7',   // 生活照
      'fnQE4jDkwYr',   // 生活照 (1)
      'fsGpT1jWgeg',   // 生活照 (2)
    ],
  },
  {
    id: 'intimate',
    title: '🔥 亲密经历',
    fields: [
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
    ],
  },
  {
    id: 'photos_private',  // ★ photos_ 前缀 → 媒体网格渲染
    title: '🔞 私密影像',
    fields: [
      'f1vsrcvqHDD',   // 乳
      'fux2osNYRgC',   // 穴
      'fasr1Gix1Yx',   // 臀
      'fqYosUpZ3eh',   // 腿
      'f2GdxJp7zxb',   // 验证素材
      'fbrzqgWKxKj',   // 素材附件 1
      'f2PfcBcVByU',   // 素材附件 2
    ],
  },
];


// ════════════════════════════════════════════════════════════
// 六、角色字段可见性
// ------------------------------------------------------------
// 在「二、页面映射」与「四、隐私开关」之外，再按平台角色逐级放开。
// 当前所有角色一视同仁（隐私开关已对所有角色生效）。
// 如需「某字段仅管理员可见」，从这里收紧。
// ════════════════════════════════════════════════════════════
const ALL_VISIBLE = [...ALL_FIELD_IDS];

export const ROLE_FIELD_VISIBILITY = {
  guest: ALL_VISIBLE,
  self: ALL_VISIBLE,
  verified: ALL_VISIBLE,
  subadmin: ALL_VISIBLE,
  admin: ALL_VISIBLE,
};


// ════════════════════════════════════════════════════════════
// 附：派生量与读取入口
// ------------------------------------------------------------
// 以下是供各页面调用的统一出口，以及为兼容既有代码而保留的旧名称。
// 新增代码请优先使用 getFieldsFor() 与 FIELDS_BY_PAGE。
// ════════════════════════════════════════════════════════════

/**
 * 按页面区域取字段 id 列表 —— 各页面的统一读取入口
 * @param {'home_card'|'detail'|'bind_only'|'manage'|'self'} area
 * @returns {string[]}
 */
export function getFieldsFor(area) {
  const P = FIELDS_BY_PAGE;
  switch (area) {
    case 'home_card': return P.home.card;
    case 'detail': return P.detail.visible;
    case 'manage': return P.admin.editable;
    case 'self': return P.my.editable;
    case 'bind_only': return P.my.binding;
    default: return [];
  }
}

/** 某字段是否用于指定区域 */
export function isFieldIn(area, fieldId) {
  return getFieldsFor(area).includes(fieldId);
}

/** 详情页不展示的字段 = 全部字段 − 详情页白名单 */
export const DETAIL_EXCLUDED_FIELD_IDS = ALL_FIELD_IDS.filter(
  (id) => !FIELDS_BY_PAGE.detail.visible.includes(id)
);

/** 卡片字段槽位（旧名，等价于 FIELDS_BY_PAGE.home.slots） */
export const CARD_FIELDS = { ...FIELDS_BY_PAGE.home.slots };

/** 列表可见性字段（旧名，等价于 FIELDS_BY_PAGE.home.visibility 的具名版） */
export const VISIBILITY_FIELDS = {
  publicQuestionnaire: FIELDS_BY_PAGE.home.visibility,
};

/** 账号绑定字段（旧名，等价于 FIELDS_BY_PAGE.my.binding 的具名版） */
export const BINDING_FIELDS = {
  email: 'fqqEWH7xiC9',
  name: 'frNSBFFkJpQ',
};

/**
 * 字段使用表（自动生成，勿手改）
 * 用途：反查某字段被哪些页面使用
 */
export const FIELD_USAGE = (() => {
  const usage = {};
  const mark = (fieldId, page, section) => {
    if (!fieldId) return;
    usage[fieldId] ||= { pages: [], sections: [] };
    if (!usage[fieldId].pages.includes(page)) usage[fieldId].pages.push(page);
    if (section && !usage[fieldId].sections.includes(section)) usage[fieldId].sections.push(section);
  };
  FIELDS_BY_PAGE.home.card.forEach((id) => mark(id, '首页', '卡片'));
  FIELDS_BY_PAGE.detail.visible.forEach((id) => mark(id, '详情页', '字段区'));
  FIELDS_BY_PAGE.my.editable.forEach((id) => mark(id, '我的页面', '自助管理'));
  FIELDS_BY_PAGE.my.readonly.forEach((id) => mark(id, '我的页面', '只读展示'));
  FIELDS_BY_PAGE.my.binding.forEach((id) => mark(id, '我的页面', '表单绑定'));
  FIELDS_BY_PAGE.admin.editable.forEach((id) => mark(id, '管理面板', '字段管理'));
  Object.keys(SYSTEM_FIELD_IDS).forEach((id) => {
    usage[id] ||= { pages: [], sections: ['系统内部'] };
  });
  return usage;
})();

// ── 以下为兼容既有消费方而保留的旧名称，新代码不必使用 ──
/** @deprecated 请改用 FIELDS_BY_PAGE 或 getFieldsFor() */
export const FIELD_VISIBILITY = {
  home_card: FIELDS_BY_PAGE.home.card,
  detail: FIELDS_BY_PAGE.detail.visible,
  bind_only: FIELDS_BY_PAGE.my.binding,
  manage: FIELDS_BY_PAGE.admin.editable,
  self: FIELDS_BY_PAGE.my.editable,
};
/** @deprecated 请改用 DETAIL_EXCLUDED_FIELD_IDS */
export const HOME_ONLY_FIELD_IDS = [
  ...FIELDS_BY_PAGE.my.binding,
  ...FIELDS_BY_PAGE.admin.editable.filter((id) => !FIELDS_BY_PAGE.detail.visible.includes(id)),
  ...Object.keys(SYSTEM_FIELD_IDS),
];
/** @deprecated 请改用 DETAIL_EXCLUDED_FIELD_IDS */
export const EXTRA_EXCLUDED_FIELD_IDS = [
  ...FIELDS_BY_PAGE.my.binding,
  ...Object.keys(SYSTEM_FIELD_IDS),
];
