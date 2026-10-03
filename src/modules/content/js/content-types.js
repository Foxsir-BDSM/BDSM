// ================================================================
// src/modules/content/js/content-types.js
// 内容板块 · 类型与字段定义（单一事实源）
// ----------------------------------------------------------------
// 这份 schema 同时驱动三处，改这里即可全局生效：
//   1. 编辑器（post-editor.html）—— 动态渲染字段组
//   2. 详情页（post.html）      —— 按 schema 渲染只读结构
//   3. 列表页（index.html）     —— 按类型差异化卡片
//
// 设计依据：对 E:\新建文件夹 中任务卡 / 问卷 / 家规 / 分级清单
// 的结构分析（只取结构，不复刻内容）。
// ================================================================

// ────────────────────────────────────────────── 风险等级
export const RISK_LEVELS = [
  { id: 'low', label: '低', icon: '🟢', color: '#22c55e',
    desc: '无身体损伤风险' },
  { id: 'mid', label: '中', icon: '🟡', color: '#f59e0b',
    desc: '有不适但可逆' },
  { id: 'high', label: '高', icon: '🟠', color: '#fb923c',
    desc: '可能造成可逆损伤，需填写中止条件与后护理' },
  { id: 'extreme', label: '极高', icon: '🔴', color: '#ef4444',
    desc: '有不可逆伤害风险，默认折叠展示，需知情确认' },
];

export function getRisk(id) {
  return RISK_LEVELS.find((r) => r.id === id) || RISK_LEVELS[0];
}

/** 需要强制补全安全字段的等级 */
export const RISK_NEEDS_SAFETY = ['high', 'extreme'];
/** 默认折叠、需知情确认才展开的等级 */
export const RISK_COLLAPSED = ['extreme'];

// ────────────────────────────────────────────── 可见性
export const VISIBILITY = [
  { id: 'public', label: '公开', desc: '所有人可见（含未登录）' },
  { id: 'member', label: '登录可见', desc: '需要登录后查看' },
  { id: 'private', label: '仅自己', desc: '仅作者本人可见，相当于云端草稿' },
];

// ────────────────────────────────────────────── 标签体系
// 从参考资料的「分类维度」提炼，而非从内容提炼
export const TAG_GROUPS = [
  {
    group: '关系角色',
    tags: ['主视角', '奴视角', '双向', '夫妻', '情侣', '远程'],
  },
  {
    group: '玩法大类',
    tags: ['束缚', '感官', '角色扮演', '心理', '仪式', '日常规训', '奖惩'],
  },
  {
    group: '强度',
    tags: ['轻度', '中度', '重度'],
  },
  {
    group: '场景',
    tags: ['居家', '户外', '公共', '线上'],
  },
  {
    group: '时长',
    tags: ['短时', '单日', '多日', '长期'],
  },
  {
    group: '内容形态',
    tags: ['有步骤', '无步骤', '清单', '随笔'],
  },
];

export const ALL_TAGS = TAG_GROUPS.flatMap((g) => g.tags);

// ────────────────────────────────────────────── 高风险提示词
// 决策 1：不拦截，命中时给出「建议提高风险等级」的提醒
export const RISK_HINTS = [
  { pattern: /切割|割开|划开|断肢|截肢|切断/, note: '可能涉及不可逆伤害' },
  { pattern: /辣椒油|灌入|注入|强酸|强碱|漂白|腐蚀/, note: '可能涉及腐蚀性或体内注入' },
  { pattern: /烧烫|烫熟|开水浇|点燃|焚烧/, note: '可能涉及严重烧烫伤' },
  { pattern: /窒息|勒颈|捂死|呼吸控制|上吊/, note: '可能涉及呼吸阻断（高风险）' },
  { pattern: /未成年|初中生|高中生|小学生|幼/, note: '可能涉及未成年人（严重违规）' },
  { pattern: /偷拍|偷偷录|未经同意|他不知情/, note: '可能涉及未同意的第三方' },
  { pattern: /伪造|骗取|假病历|开药|处方/, note: '可能涉及冒用医疗系统' },
  { pattern: /全部上贡|借贷|赔钱卖|倾家|自毁人生|社死/, note: '可能涉及财务毁灭或社会性自毁' },
  { pattern: /把柄|威胁|曝光你|告诉你的/, note: '可能涉及胁迫' },
];

/**
 * 扫描文本，返回命中的风险提示
 * @param {string} text 待扫描文本（正文 + 各字段拼接）
 * @returns {{note:string, matched:string}[]}
 */
export function scanRiskHints(text) {
  const src = String(text || '');
  const hits = [];
  for (const h of RISK_HINTS) {
    const m = src.match(h.pattern);
    if (m) hits.push({ note: h.note, matched: m[0] });
  }
  return hits;
}

// ────────────────────────────────────────────── 发布类型
/**
 * 字段类型（供编辑器渲染）：
 *   text      单行文本
 *   textarea  多行文本
 *   tags      标签多选（来自 TAG_GROUPS）
 *   select    单选下拉
 *   radio     单选按钮组
 *   number    数字
 *   switch    开关
 *   list      可增删子表单（子字段在 item 里定义）
 */
export const POST_TYPES = [
  // ═══════════════════════════════════════════ A · 玩法任务
  {
    id: 'task',
    label: '玩法任务',
    icon: '⛓️',
    desc: '有明确步骤的实践玩法，含场景准备、道具清单、具体事项与检查点',
    accent: '#d4a574',
    sections: [
      {
        id: 'setup',
        title: '场景准备',
        hint: '交代清楚在什么环境、什么时间、需要什么前置状态',
        fields: [
          { key: 'scenes', label: '适用场景', type: 'checkbox', options: ['居家独处', '居家有他人', '户外', '远程线上', '公共场所'] },
          { key: 'times', label: '建议时间', type: 'checkbox', options: ['清晨', '白天', '夜晚', '深夜', '任意'] },
          { key: 'durationValue', label: '预计时长', type: 'number', placeholder: '30' },
          { key: 'durationUnit', label: '时长单位', type: 'select', options: ['分钟', '小时', '天'] },
          { key: 'env', label: '环境要求', type: 'textarea', placeholder: '例：独立卫浴、可锁门、地面防滑' },
          { key: 'pre', label: '前置状态', type: 'textarea', placeholder: '例：需空腹 / 需禁欲 3 天 / 需提前补水' },
          { key: 'mental', label: '心理准备', type: 'textarea', placeholder: '预期感受、可能出现的情绪波动' },
        ],
      },
      {
        id: 'props',
        title: '道具清单',
        hint: '逐项列出，标注是否必需、可替代方案与安全提示',
        fields: [
          {
            key: 'props', label: '道具', type: 'list', addLabel: '＋ 添加道具',
            item: [
              { key: 'name', label: '名称', type: 'text', placeholder: '例：软绳 / 低温蜡烛' },
              { key: 'required', label: '必要性', type: 'select', options: ['必需', '可选', '可用替代品'] },
              { key: 'alt', label: '替代方案', type: 'text', placeholder: '例：领带替代软绳' },
              { key: 'safety', label: '安全提示', type: 'text', placeholder: '例：避开颈部、先测试温度' },
            ],
          },
        ],
      },
      {
        id: 'steps',
        title: '具体事项',
        hint: '分步描述，可拖动排序；每步可标注时长、关键提示与中止条件',
        fields: [
          {
            key: 'steps', label: '步骤', type: 'list', addLabel: '＋ 添加步骤', numbered: true,
            item: [
              { key: 'text', label: '步骤说明', type: 'textarea', placeholder: '这一步做什么' },
              { key: 'measure', label: '时长 / 次数', type: 'text', placeholder: '例：15 分钟 / 50 次' },
              { key: 'caution', label: '关键提示', type: 'text', placeholder: '会以高亮框渲染' },
              { key: 'abort', label: '中止条件', type: 'text', placeholder: '例：出现麻木立即停止' },
            ],
          },
        ],
      },
      {
        id: 'checkpoints',
        title: '检查点',
        hint: '需要提交什么作为完成凭证',
        fields: [
          {
            key: 'checkpoints', label: '检查项', type: 'list', addLabel: '＋ 添加检查项',
            item: [
              { key: 'text', label: '检查内容', type: 'text', placeholder: '例：过程记录 / 道具照片' },
              { key: 'proof', label: '凭证类型', type: 'checkbox', options: ['文字', '语音', '照片', '视频', '截图', '其他'] },
              { key: 'count', label: '数量要求', type: 'number', placeholder: '1' },
              { key: 'required', label: '必交', type: 'switch' },
            ],
          },
        ],
      },
      {
        id: 'aftercare',
        title: '收尾与后护理',
        hint: '这一步最容易被忽略，但决定了体验是否完整',
        important: true,
        fields: [
          { key: 'cleanup', label: '收尾步骤', type: 'textarea', placeholder: '清理、清洁、恢复现场' },
          { key: 'body', label: '身体护理', type: 'textarea', placeholder: '补水、保暖、按摩受压部位' },
          { key: 'emotion', label: '情绪护理', type: 'textarea', placeholder: '安抚、复盘、确认状态' },
          { key: 'observe', label: '观察期', type: 'text', placeholder: '例：24 小时内留意皮肤变化' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════ B · 主题合集
  {
    id: 'collection',
    label: '主题合集',
    icon: '🗂️',
    desc: '围绕一个主题的多条目合集，适合「某个道具 / 场景的 N 种用法」',
    accent: '#8b5cf6',
    sections: [
      {
        id: 'intro',
        title: '合集说明',
        fields: [
          { key: 'intro', label: '引言', type: 'textarea', placeholder: '说明适用范围与安全前提' },
        ],
      },
      {
        id: 'groups',
        title: '分组与条目',
        hint: '例如「羞辱篇」「轻度篇」等分组，每组下可加多条',
        fields: [
          {
            key: 'groups', label: '分组', type: 'list', addLabel: '＋ 添加分组',
            item: [
              { key: 'name', label: '分组名', type: 'text', placeholder: '例：入门篇' },
              {
                key: 'items', label: '条目', type: 'list', addLabel: '＋ 添加条目', numbered: true, nested: true,
                item: [
                  { key: 'text', label: '内容', type: 'textarea', placeholder: '一句话或一小段' },
                  { key: 'safety', label: '安全提示', type: 'text', placeholder: '可选' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'safety',
        title: '安全总则',
        important: true,
        fields: [
          { key: 'safetyRule', label: '合集级安全约束', type: 'textarea', placeholder: '适用于本合集所有条目的安全前提' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════ C · 分级清单
  {
    id: 'checklist',
    label: '分级清单',
    icon: '📊',
    desc: '打分表 / 程度量表 / 问答清单，适合自评、对照、双方勾选',
    accent: '#22d3ee',
    sections: [
      {
        id: 'mode',
        title: '清单模式',
        fields: [
          {
            key: 'mode', label: '模式', type: 'radio',
            options: [
              { value: 'scale', label: '程度量表', desc: '对条目逐项打分' },
              { value: 'quiz', label: '问答清单', desc: '按题目作答' },
            ],
          },
          {
            key: 'scaleType', label: '量表类型', type: 'radio',
            dependsOn: { key: 'mode', value: 'scale' },
            options: [
              { value: 'sss', label: '5 档（SSS/SS/S/N/×）' },
              { value: 'num11', label: '11 档（-1 ~ 10）' },
              { value: 'star5', label: '5 星' },
            ],
          },
          { key: 'allowUnsure', label: '包含「不确定」选项', type: 'switch', dependsOn: { key: 'mode', value: 'scale' } },
        ],
      },
      {
        id: 'items',
        title: '清单条目',
        hint: '按「大类 → 子类 → 条目」三层组织，与常见自评表一致',
        fields: [
          {
            key: 'items', label: '量表条目', type: 'list', addLabel: '＋ 添加条目',
            dependsOn: { key: 'mode', value: 'scale' },
            item: [
              { key: 'category', label: '大类', type: 'text', placeholder: '例：束缚' },
              { key: 'sub', label: '子类', type: 'text', placeholder: '例：绳艺' },
              { key: 'name', label: '条目名', type: 'text', placeholder: '例：简易捆绑' },
              { key: 'note', label: '备注', type: 'text', placeholder: '可选' },
            ],
          },
          {
            key: 'questions', label: '问答题目', type: 'list', addLabel: '＋ 添加题目', numbered: true,
            dependsOn: { key: 'mode', value: 'quiz' },
            item: [
              { key: 'q', label: '题目', type: 'textarea', placeholder: '要问什么' },
              { key: 'qtype', label: '题型', type: 'select', options: ['打分', '单选', '多选', '填空', '长文本'] },
              { key: 'group', label: '所属章节', type: 'text', placeholder: '例：第一章 打分题' },
              { key: 'required', label: '必答', type: 'switch' },
            ],
          },
        ],
      },
      {
        id: 'usage',
        title: '使用说明',
        fields: [
          { key: 'usage', label: '这份清单给谁填、怎么解读', type: 'textarea', placeholder: '例如：由下位者自行填写后交给上位者参考' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════ D · 见解随笔
  {
    id: 'note',
    label: '见解随笔',
    icon: '✍️',
    desc: '自由表达：经验、感悟、科普、问答，没有固定套路',
    accent: '#f59e0b',
    sections: [
      {
        id: 'body',
        title: '正文',
        fields: [
          { key: 'body', label: '内容', type: 'textarea', big: true, placeholder: '支持 Markdown：# 标题、**粗体**、*斜体*、- 列表、> 引用' },
        ],
      },
    ],
  },
];

export function getPostType(id) {
  return POST_TYPES.find((t) => t.id === id) || POST_TYPES[3]; // 默认随笔
}

/** 某类型下所有字段（含子表单子字段）的 key 列表 */
export function collectKeys(type) {
  const keys = [];
  for (const sec of type.sections) {
    for (const f of sec.fields) {
      keys.push(f.key);
      if (f.type === 'list' && f.item) {
        for (const sub of f.item) keys.push(sub.key);
      }
    }
  }
  return keys;
}

/** 生成一份该类型的空白数据 */
export function blankData(typeId) {
  const type = getPostType(typeId);
  const data = {};
  for (const sec of type.sections) {
    for (const f of sec.fields) {
      if (f.type === 'list') data[f.key] = [];
      else if (f.type === 'switch') data[f.key] = false;
      else if (f.type === 'checkbox') data[f.key] = [];
      else if (f.type === 'radio') data[f.key] = f.options?.[0]?.value ?? '';
      else data[f.key] = '';
    }
  }
  return data;
}

/** 生成一份「新条目」的空白项（用于 list 类型） */
export function blankItem(field) {
  const item = {};
  for (const sub of field.item || []) {
    if (sub.type === 'switch') item[sub.key] = false;
    else if (sub.type === 'checkbox') item[sub.key] = [];
    else if (sub.type === 'list') item[sub.key] = [];
    else if (sub.type === 'select') item[sub.key] = sub.options?.[0] ?? '';
    else item[sub.key] = '';
  }
  return item;
}

// ────────────────────────────────────────────── 前端存储约定
export const CONTENT_STORE = {
  branch: 'content',
  path: 'posts',
  draftKey: 'foxsir_post_drafts',
  cdnOwnerRepo: 'Foxsir-BDSM/foxsir-content',
};

// ────────────────────────────────────────────── 落盘格式
// 为什么把结构化数据放正文而不是 frontmatter？
//   content-manager.js 的 parseFrontmatter 只返回固定字段，
//   未知 key 会被丢弃。因此改用正文内嵌 JSON 区块承载类型数据，
//   这样读回时不会丢失，同时 frontmatter 仍保留可读的基础信息。
//
// 一篇内容的文件结构：
//   ---
//   title / slug / content_type / risk / visibility / summary /
//   cover_url / is_public / tags / author_nickname / created_at
//   ---
//
//   ```json foxsir-post
//   { "type": "task", "meta": {...}, "data": {...} }
//   ```
//
//   （可选）Markdown 正文 —— 目前用于「见解随笔」类
export const JSON_FENCE = '```json foxsir-post';
export const JSON_FENCE_RE = /```json foxsir-post\s*\n([\s\S]*?)\n```/;

/** 从正文中解析出结构化数据；失败返回 null */
export function parsePayload(markdownBody) {
  const m = String(markdownBody || '').match(JSON_FENCE_RE);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    console.warn('[content] payload 解析失败:', e);
    return null;
  }
}

/** 生成带 JSON 区块的完整文件内容 */
export function buildFileContent(payload, markdownBody = '') {
  const { meta, type, data } = payload;
  const fm = [
    '---',
    `title: ${meta.title}`,
    `slug: ${meta.slug}`,
    `content_type: ${type}`,
    `risk: ${meta.risk}`,
    `visibility: ${meta.visibility}`,
    `summary: ${meta.summary || ''}`,
    `cover_url: ${meta.cover || ''}`,
    `is_public: ${meta.visibility === 'public'}`,
    `tags: ${JSON.stringify(meta.tags || [])}`,
    `author_nickname: ${meta.authorNickname || ''}`,
    `author_email: ${meta.authorEmail || ''}`,
    `created_at: ${meta.createdAt || new Date().toISOString()}`,
    '---',
    '',
  ].join('\n');
  const block = `${JSON_FENCE}\n${JSON.stringify({ type, meta, data }, null, 1)}\n\`\`\``;
  return markdownBody
    ? `${fm}\n${block}\n\n${markdownBody}\n`
    : `${fm}\n${block}\n`;
}

