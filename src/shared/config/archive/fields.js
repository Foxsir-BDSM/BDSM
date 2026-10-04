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
// ------------------------------------------------------------
// 【★ 各区域之间的交互逻辑 —— 这是理解本文件的关键】
// ------------------------------------------------------------
//
//   区域一是「字典」，区域二~六是「策略」。所有策略里的字段 id 都写死在
//   区域一登记过，因此改字段 id 只需动区域一（区域二~六引用的是同一个串）。
//
//   数据从数据库取出后，要经过下面几道「关卡」才会出现在屏幕上：
//
//     ┌─ 数据库记录（record.data）
//     │
//     ├─【关卡 0】区域一：这个字段认识吗？
//     │     不认识（不在 FIELD_LABELS / SYSTEM_FIELD_IDS 里）→ 直接丢弃
//     │     系统字段 → 只留在程序内部，永不渲染
//     │
//     ├─【关卡 1】区域二：这个页面允许读这个字段吗？
//     │     页面白名单制。没登记 → 该页面根本拿不到它
//     │     例：管理面板只认 admin.editable，其余字段不可见不可读
//     │
//     ├─【关卡 2】区域四·隐私开关：这条记录公开它了吗？
//     │     受控字段的开关不为 true → 隐藏，★对管理员同样生效
//     │     依据：公开与否是用户的私人选择，不是权限层级问题
//     │
//     └─【关卡 3】区域六：当前访问者的角色够吗？
//           角色白名单。当前配置为「一视同仁」，留作后续收紧用
//
//   关卡之间是「与」的关系：任何一关不放行，字段就不显示。
//
// ------------------------------------------------------------
// 【各页面实际走哪几关】
// ------------------------------------------------------------
//
//   首页卡片
//     关卡0（认识）→ 关卡1（home.card）→ 关卡2（仅常住地址受控）
//     关卡3（guest 也放行）
//     ★ 认证标签不受隐私开关控制 —— 它由管理员授予，不是用户自选
//
//   详情页
//     关卡0 → 关卡1（detail.visible 白名单）→ 关卡2（4 组共 9 个受控字段）
//     → 关卡3
//     ★ 区域五（DETAIL_GROUPS）在此之上再决定「怎么排版」：
//       只有既在 detail.visible 又在 DETAIL_GROUPS 某分组里的字段才会渲染。
//       detail.visible 缺 → 不显示；DETAIL_GROUPS 缺 → 不显示（也无板块可放）
//       两者都命中 → 按分组的顺序与板块标题渲染
//
//   我的页面
//     关卡0 → 关卡1（my.editable 可勾选 / my.readonly 只读）
//     ★ 不走关卡2：用户在这里改的就是开关本身，不能再被开关挡住
//     ★ 「首页认证标签」不在 my.editable → 用户在数据层就拿不到，改不了
//
//   管理面板
//     关卡0 → 关卡1（admin.editable）
//     ★ 走关卡2：未公开的字段管理员也看不到值，但**仍可修改开关**
//       （admin.editable 里装的就是开关字段本身，而开关不被自己控制）
//
// ------------------------------------------------------------
// 【区域三 / 区域四的分工】
// ------------------------------------------------------------
//   区域三（SEARCH_FIELDS）  解决「找得到吗」—— 输入关键词时在哪些字段里匹配
//   区域四（FILTER_FIELDS）  解决「默认看到谁」—— 进页面时先按身份分流
//   两者正交：筛选决定集合，搜索在集合内缩小范围。
//
// ------------------------------------------------------------
// 【改配置时的常见动作速查】
// ------------------------------------------------------------
//   想加一个字段进详情页        → 区域二 detail.visible 加 id，
//                                 再到区域五的某个分组里加同一个 id（两处都要）
//   想把字段从详情页拿掉        → 区域二 detail.visible 删掉即可（区域五留着无害）
//   想调详情页板块顺序/标题      → 只动区域五
//   想让某字段只有管理员能改    → 放进区域二 admin.editable，
//                                 并确保它不在 my.editable 里
//   想新增一个隐私开关          → 区域四 PRIVACY_SWITCHES 加一项
//                                 （PRIVACY_RULES / PRIVACY_DEPENDENCIES /
//                                   PRIVACY_CONTROL_IDS 会自动派生）
//   想改搜索范围                → 只动区域三
//   想改默认筛选依据            → 只动区域四 FILTER_FIELDS
//
// ------------------------------------------------------------
// 【数据源】
//   Zite / Fillout Tables
//     baseId  = e7d18ead20743825
//     tableId = t4d3B3XvKL8
//   字段总数：59（参与展示 56 + 系统字段 3）
// ============================================================


// ════════════════════════════════════════════════════════════
// 一、字段对照区域
// ------------------------------------------------------------
// 【职责】只做「字段 id ↔ 展示名称」的对照，不含任何页面策略。
//
// 【与其他区域的交互】
//   · 本区域是「字典」。区域二~六里的所有字段 id 都必须能在这里查到，
//     否则该字段在关卡 0 就被丢弃，永远不会渲染。
//   · 新增数据库字段时，只需在本区域登记一次，之后在区域二~六里
//     直接引用这个 id 即可。
//   · 名称改了不影响任何逻辑（区域二~六引用的是 id，不是名称）。
//
// 【维护流程】
//   npm run fields  → 工具对比远程与本地，按「字段id: '名称'」输出差异
//                   → 把差异粘回本区域
//
// 【两个子区域的分工】
//   FIELD_LABELS      参与展示的字段（56 个）
//   SYSTEM_FIELD_IDS  系统字段（3 个），全程只留在程序内部，
//                     不进入任何页面的可见性判断，等价于永久隐藏。
//                     目前是：Source / 点赞数 / 备注
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
// 【职责】决定「哪些字段出现在哪些页面」以及「哪些页面能调动哪些字段」。
//
// 【与其他区域的交互】
//   · 上游：字段 id 来自区域一（关卡 0 已放行的字段才会走到这里）
//   · 下游：本区域是关卡 1（页面白名单）。这里不放行的字段，
//          后续关卡再宽松也没用 —— 页面根本拿不到它。
//   · 与区域四（隐私开关）：两者是「与」的关系。
//         本区域决定「这个页面有没有资格读」，
//         区域四决定「这条记录的主人愿不愿意公开」。
//         例：常住地址在 detail.visible 里（有资格），但记录未公开
//             （关卡 2 拦下）→ 最终不显示。
//   · 与区域五（详情页分组）：也是「与」。
//         detail.visible 命中但 DETAIL_GROUPS 没归组 → 不渲染（无处安放）
//         DETAIL_GROUPS 归了组但 detail.visible 没命中 → 不渲染
//         ★ 加字段进详情页要两处都改
//   · 与区域六（角色可见性）：区域六在最后一道关口，可进一步收紧。
//
// 【读取入口】
//   各页面统一用 getFieldsFor('detail' | 'home_card' | 'self'
//                            | 'manage' | 'bind_only') 取字段列表，
//   不要在页面代码里再写一份字段清单。
//
// ★ 这是日常维护的主入口：想调整某页面的字段，改对应数组即可，
//   不需要动任何页面代码。
// ════════════════════════════════════════════════════════════
export const FIELDS_BY_PAGE = {

  // ── 1. 管理面板 ────────────────────────────────────────
  // 【能做什么】管理员可调动的字段。未登记在此的字段，管理面板
  //             不可见、不可读、不可写。
  // 【交互】
  //   · editable 同时是「写库白名单」—— api.js 的 updateRecordFields
  //     直接取它，所以勾选框与可写字段永远一致（此前是两份手工清单，
  //     容易漂移，已合并）。
  //   · 走关卡 2（隐私开关）：未公开的字段，管理员也看不到其值；
  //     但管理员仍能修改开关本身 —— 因为 editable 里装的就是开关字段，
  //     而开关字段不在任何开关的 controls 里，不会被自己挡住。
  //     ⚠️ 准确说法：管理员能管理「公开与否」，但不能绕过它看内容。
  //        例如常住地址未公开时，详情页上管理员同样看不到。
  //   · 补充：写接口 api.js 的 updateRecordFields 直接取本数组做白名单，
  //     它本身不做角色检查 —— 权限判断在管理页面的入口处完成。
  //   · 「首页认证标签」只在这里和首页卡片出现：
  //     管理面板可改，用户在我的页面看不到也改不了。
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
  // 【能做什么】用户本人对自己档案的管理能力。
  // 【交互】
  //   · editable 与 admin.editable 的差异就是权限边界所在：
  //       admin  有「首页认证标签」
  //       my     没有 —— 用户在数据层就拿不到该字段，改不了
  //     ★ 这是「不给」而不是「藏起来」：前者在数据层拦截，更安全。
  //   · 我的页面**不走关卡 2**：用户在这里改的就是隐私开关本身，
  //     如果再用开关去挡它，会形成自锁（未公开 → 看不到开关 → 无法改回公开）。
  //   · binding 里的字段不参与任何渲染，只用于把表单提交与账号对上号。
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
  // 【能做什么】列表页卡片的字段与列表准入。
  // 【交互】
  //   · card     卡片展示的字段（7 个）。少一个不影响其他，卡片自动省略该行。
  //   · visibility  列表总开关，决定「这条记录进不进列表」——
  //                 这是页面级判断，不是字段级，所以单独一个键。
  //                 ⚠️ 它与「是否公开问卷内容」是同一个数据库字段，
  //                    但职能不同：
  //                      列表准入 → 整条档案是否出现在列表里
  //                      问卷公开 → 个人信息类字段是否对外可见（见区域四）
  //   · slots    给渲染函数用的语义槽位。与 card 是同一批字段，
  //              只是换成「按用途取名」，改字段时两者要一起改。
  //   · 卡片**只受常住地址一个隐私开关影响**；认证标签不受隐私控制
  //     （管理员授予，非用户自选）。
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
  // 【能做什么】白名单制：只有登记在此的字段才会出现在详情页。
  // 【交互】★ 详情页要过两道字段关，是本文件最容易改错的地方：
  //
  //     第 1 道 · 本白名单（detail.visible）
  //         决定「这个字段能不能出现在详情页」
  //     第 2 道 · 区域五的分组（DETAIL_GROUPS）
  //         决定「它排在哪个板块、什么位置」
  //
  //     两道都命中才渲染：
  //         白名单有 + 分组有  → ✅ 显示
  //         白名单有 + 分组无  → ❌ 不显示（没有板块安放它）
  //         白名单无 + 分组有  → ❌ 不显示（资格不够）
  //
  //     ★ 所以「加字段进详情页」要改两处：本白名单 + 区域五的某个分组。
  //       只改一处是最常见的错误，且页面不会报错，只是静默不显示。
  //       反过来「移除字段」只改本白名单即可，区域五留着无害。
  //
  //   另外还要过关卡 2（隐私开关，4 组共 9 个受控字段）
  //   与关卡 3（角色可见性，当前全放行）。
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
// 【职责】关键词检索命中的字段范围。
//         用户输入的关键词会在这里列出的字段中做「包含匹配」，
//         命中任意一个即视为该记录匹配。
//
// 【与其他区域的交互】
//   · 本区域解决「找得到吗」；区域四解决「默认看到谁」。两者正交：
//       区域四先决定候选集合 → 区域三在集合内按关键词缩小范围。
//   · 搜索**不做隐私过滤**：受隐私开关控制的字段（如常住地址）
//     若登记在此，即使未公开也参与匹配。
//     ⚠️ 这是有意的取舍 —— 但它意味着「搜索命中」可能泄露
//        「某人住在某地」这一事实。若在意，把受控字段从本区域移出。
//   · 字段 id 来自区域一；数量不限，但字段越多搜索越慢。
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
// 【职责】两个子区域，管的是两件不同的事：
//
//   FILTER_FIELDS      进页面时的「默认看到谁」—— 按访问者身份分流
//   PRIVACY_SWITCHES   字段级的「这条记录公开它了吗」—— 关卡 2
//
// 【FILTER_FIELDS 与其他区域的交互】
//   · 只按身份分流，取值来自记录里的「身份」字段（区域一登记）。
//   · 推导逻辑在 identity-config.js 的 deriveArchiveFilter()：
//       S 侧访问者（男S/女S）→ 默认展示 M 侧档案
//       M 侧访问者（男M/女M）→ 默认展示 S 侧档案
//   · 未标注身份的记录一律保留，不因筛选而丢数据。
//   · 取向维度已于 2026-10-04 取消，不再有第二个分流维度。
//
// 【PRIVACY_SWITCHES 与其他区域的交互】★ 这是最容易误解的一处
//   · 本区域是关卡 2，在区域二（页面白名单）之后生效，两者是「与」。
//   · 未公开的字段对**所有人**不可见，**包括管理员**。
//     依据：是否公开是用户的私人选择，不是权限层级问题。
//   · 开关自身只在两处可见可改：管理面板、我的页面。
//     开关**不被自己控制**，否则会自锁（未公开 → 改不回公开）。
//   · 首页与详情页只「读」开关的结果，不展示开关本身。
//
// 【维护方式】
//   新增一个开关：在 PRIVACY_SWITCHES 里加一项即可。
//   下面三个派生量会自动跟上，不需要手工同步：
//     PRIVACY_RULES          数组形式，供既有消费方遍历
//     PRIVACY_DEPENDENCIES   受控字段 → 控制字段 的反查表
//     PRIVACY_CONTROL_IDS    开关名 → controlId 的快捷索引
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
 * 隐私公开开关（5 个）—— 关卡 2
 * ------------------------------------------------------------
 * 【规则语义】
 *   · 开关为 true 时，其 controls 里的字段才对外可见
 *   · 未公开的字段对**所有人**不可见，**包括管理员**
 *     （是否公开是用户的私人选择，不是权限层级问题）
 *   · 开关自身只在「管理面板」与「我的页面」可见可改
 *   · 开关不被自己控制 —— 否则用户一旦设为不公开就再也改不回来
 *
 * 【划分原则】按「信息类别」组织，同一类信息归同一个开关。
 *   这样用户勾选时的心理负担最小：勾一个开关，就公开一整类信息。
 *
 * 【字段归属速查】
 *   questionnaire  8 个：姓名/身份/年龄/身高/体重/罩杯/三围/职业学历
 *   address        1 个：常住地址
 *   contact        1 个：联系方式
 *   lifePhotos     3 个：生活照 ×3
 *   privatePhotos  4 个：乳/穴/臀/腿
 *   合计受控 17 个字段
 *
 * ⚠️ 注意：这 5 个开关字段本身**不在任何页面的展示白名单里**
 *    （它们不在 detail.visible，也不在 home.card），
 *    只出现在 admin.editable 与 my.editable —— 即「可管理但不可展示」。
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
// 【职责】决定详情页的「排版」：分几个板块、每个板块叫什么、
//         板块内字段按什么顺序排列。
//
// 【与其他区域的交互】★ 详情页要同时过本区域和区域二的白名单：
//
//     区域二 detail.visible  ─┐
//                             ├─→ 两个都命中才渲染
//     区域五 DETAIL_GROUPS   ─┘
//
//     白名单有 + 分组有  → ✅ 显示
//     白名单有 + 分组无  → ❌ 不显示（没有板块安放它）
//     白名单无 + 分组有  → ❌ 不显示（资格不够）
//
//   ★ 加字段进详情页要**两处都改**。只改一处不会报错，只会静默不显示，
//     是本文件最常见的改错方式。
//   ★ 反过来「从详情页移除字段」只改区域二即可，本区域留着无害。
//
//   此外还受关卡 2（隐私开关）与关卡 3（角色可见性）约束。
//
// 【板块 id 的硬性约定】
//   · id 以 'photos_' 开头的板块走**媒体网格渲染**（多图平铺），
//     其余板块走「标签 + 值」的键值列表渲染。
//   · 'photos_life' 与 'photos_private' 这两个 id 被 detail.js
//     硬编码引用，**改名会导致失去媒体网格效果**。
//   · 新增板块可以自由取 id，只要遵守 photos_ 前缀约定即可。
//   · 板块内字段全部为空时，该板块整体不渲染（不会出现空板块）。
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
// 【职责】关卡 3：在「页面白名单」与「隐私开关」之外，
//         再按访问者的平台角色逐级放开字段。
//
// 【与其他区域的交互】
//   · 生效顺序在最后：区域二 → 区域四 → 本区域，任一关不放行即不显示。
//   · 与区域四的区别（容易混淆）：
//       区域四 隐私开关 → 管「这条记录的主人愿不愿意公开」，
//                          对管理员同样生效，与角色无关
//       区域六 角色可见性 → 管「这个访问者的级别够不够」，
//                          是平台侧的权限控制
//     两者解决的是完全不同的问题，不要混用。
//
// 【当前配置】所有角色一视同仁（全部字段），因为隐私开关已经
//   承担了「未公开则谁都看不到」的职责。本区域留作后续收紧用。
//
// 【什么时候用它】当你想表达「某字段只有管理员能看到，
//   但用户自己也不需要公开它」这类**平台侧规则**时 —— 例如
//   内部备注、风控标记。用户侧的公开意愿用区域四表达。
//
// 【用法】把角色对应的数组从 ALL_VISIBLE 换成一个显式字段列表，
//   未列出的字段对该角色即不可见。
//   ⚠️ 实现细节（见 utils.js getVisibleDetailFields）：
//      传 '*' 表示不限制；且 **admin 角色会被直接放行**，不受本表约束。
//      因此本区域实际约束的是 guest / self / verified / subadmin 四类。
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
// 【本区域的性质】全部是**派生值**，没有自己的独立配置。
//   改上游区域（一~六）后，这里会自动跟上，不需要手工同步。
//
// 【与其他区域的交互】
//   · getFieldsFor() / isFieldIn()  读取区域二的页面映射
//   · DETAIL_EXCLUDED_FIELD_IDS     由「区域一全部字段 − 区域二详情页白名单」推导
//   · CARD_FIELDS / VISIBILITY_FIELDS / BINDING_FIELDS
//                                   区域二对应键的别名，供既有代码按老名字取用
//   · FIELD_USAGE                   遍历区域二自动生成，用于反查字段被哪些页面用
//   · FIELD_VISIBILITY / HOME_ONLY_FIELD_IDS / EXTRA_EXCLUDED_FIELD_IDS
//                                   旧名称兼容层，标注 @deprecated
//
// 【新代码该用哪个】
//   取某页面的字段列表   → getFieldsFor('detail' | 'home_card' | 'self'
//                                      | 'manage' | 'bind_only')
//   判断字段是否属于某页 → isFieldIn('detail', fieldId)
//   取字段展示名         → labelOf(fieldId)
//   需要完整策略对象     → 直接读 FIELDS_BY_PAGE
//
//   ⚠️ 标注 @deprecated 的旧名称仅为兼容既有消费方而保留，
//      新代码不要再用，以免将来清理时产生连锁修改。
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
