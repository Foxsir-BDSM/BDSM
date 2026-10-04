#!/usr/bin/env node
/**
 * tools/gh-seed-demo.mjs —— 生成一套演示内容，覆盖全部 4 种内容类型
 *
 * 目的：验证「列表 → 详情 → 接取 → 我的 → 首页任务直达」全链路，
 *       同时验证「任务反馈不可接取」这条规则。
 *
 * 内容为中性示例（非露骨内容），可随时用 --remove 全部删除。
 *
 * 用法：
 *   node tools/gh-seed-demo.mjs            写入
 *   node tools/gh-seed-demo.mjs --remove   删除
 */
import fs from 'node:fs';

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const TOKEN = env.GITHUB_TOKEN;
const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';
const BRANCH = 'content';
const DIR = 'posts';
const FENCE = '`' + '``json foxsir-post';

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'foxsir-seed',
  'Content-Type': 'application/json',
};

const api = async (p, method = 'GET', body) => {
  const r = await fetch(`https://api.github.com${p}`, {
    method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, ok: r.ok, j, raw: t };
};

const PREFIX = 'demo-';
const now = () => new Date().toISOString();

function buildContent(type, meta, data, markdown) {
  const full = {
    title: meta.title,
    slug: meta.slug,
    content_type: type,
    risk: meta.risk || 'low',
    visibility: meta.visibility || 'public',
    summary: meta.summary || '',
    cover: '',
    is_public: (meta.visibility || 'public') === 'public',
    tags: meta.tags || [],
    author_nickname: 'Foxsir',
    author_email: '',
    createdAt: meta.createdAt || now(),
  };
  const fm = [
    `title: ${full.title}`,
    `slug: ${full.slug}`,
    `content_type: ${full.content_type}`,
    `risk: ${full.risk}`,
    `visibility: ${full.visibility}`,
    `summary: ${full.summary}`,
    `cover_url: `,
    `is_public: ${full.is_public}`,
    `tags: ${JSON.stringify(full.tags)}`,
    `author_nickname: ${full.author_nickname}`,
    `author_email: `,
    `created_at: ${full.createdAt}`,
  ];
  return [
    '---', ...fm, '---', '',
    FENCE,
    JSON.stringify({ type, meta: full, data }, null, 1),
    '```', '',
    markdown || '', '',
  ].join('\n');
}

// ══════════════════════════════════════════ 四篇演示内容
const ITEMS = [];

// ① 玩法任务 —— 可接取
ITEMS.push({
  type: 'task',
  slug: PREFIX + 'breath',
  meta: {
    title: '【示例】三段呼吸放松',
    summary: '一个结构完整的示例任务，用于验证接取流程。可随时删除。',
    tags: ['示例', '放松'], risk: 'low',
  },
  data: {
    scenes: ['居家独处'],
    times: ['夜晚', '任意'],
    durationValue: 15, durationUnit: '分钟',
    env: '安静、不被打扰的空间。手机静音，坐姿或躺姿均可。',
    pre: '确认身体状态良好；准备一杯温水放在手边。',
    mental: '以放松本身为目的，不追求任何结果。任何环节不适可随时停止。',
    props: [
      { text: '计时器', required: true, note: '手机计时即可' },
      { text: '温水一杯', required: false },
      { text: '毯子', required: false, alt: '外套亦可' },
    ],
    steps: [
      { text: '静坐，把注意力放在呼吸上，不做任何调整', measure: '3 分钟' },
      { text: '缓慢深呼吸，吸气 4 拍、呼气 6 拍', measure: '5 分钟', safety: '出现头晕立即恢复自然呼吸' },
      { text: '把注意力依次扫过全身，逐处放松', measure: '4 分钟' },
      { text: '静坐片刻，再缓慢起身', measure: '3 分钟', abort: '起身时若感眩晕，先坐回原处' },
    ],
    checkpoints: [
      { text: '全程呼吸是否自然，没有刻意憋气' },
      { text: '身体有没有某处一直紧绷未能放松' },
      { text: '中途是否被手机或杂念打断' },
    ],
    cleanup: '收好计时器，把水杯放回原处。',
    body: '结束后喝几口温水，活动一下肩颈。',
    emotion: '如过程中情绪起伏较大，给自己一点安静时间平复。',
    observe: '当天余下时间留意身体感受',
  },
  markdown: '这是一个**示例任务**，用于验证「接取 → 提交反馈」的完整链路。\n\n结构里包含场景、时长、道具、步骤、检查点与收尾，目的在于展示 `玩法任务` 类型支持的字段。内容可随时删除。',
});

// ② 主题合集 —— 可接取
ITEMS.push({
  type: 'collection',
  slug: PREFIX + 'stretch',
  meta: {
    title: '【示例】三种日常伸展',
    summary: '示例合集，用于验证主题合集类型与接取流程。',
    tags: ['示例', '伸展'], risk: 'low',
  },
  data: {
    intro: '把三个可以随时插入日常的伸展动作整理在一起，每个都只需几分钟，不需要器械。',
    groups: [
      {
        title: '久坐之后',
        items: [
          { text: '颈侧伸展：头向一侧倾，同侧手轻压，保持 20 秒后换边', note: '力度以不痛为准' },
          { text: '扩胸：双手背后交握，缓慢向后打开肩胛', note: '配合呼气' },
        ],
      },
      {
        title: '起床之后',
        items: [
          { text: '猫牛式：四点支撑，随呼吸交替拱背与塌腰', note: '10 次' },
          { text: '仰卧抱膝：双手抱膝轻晃', note: '30 秒' },
        ],
      },
      {
        title: '睡前',
        items: [
          { text: '靠墙抬腿：仰卧，双腿贴墙上举', note: '5 分钟' },
          { text: '仰卧扭转：双膝倒向一侧，头转向另一侧', note: '每侧 1 分钟' },
        ],
      },
    ],
    safetyRule: '所有动作以不引起疼痛为前提；有旧伤或不适请先咨询专业人士，不要勉强完成次数。',
  },
  markdown: '这是一份**示例合集**，用于验证 `主题合集` 类型。\n\n三个分组分别对应「久坐之后」「起床之后」「睡前」三个场景，每个条目都带一句说明。',
});

// ③ 分级清单 —— 可接取
ITEMS.push({
  type: 'checklist',
  slug: PREFIX + 'check',
  meta: {
    title: '【示例】沟通准备度自评',
    summary: '示例清单，用于验证分级清单类型与接取流程。',
    tags: ['示例', '沟通'], risk: 'low',
  },
  data: {
    mode: 'scale',
    scaleType: 'num11',
    allowUnsure: true,
    items: [
      { text: '我能清楚说出自己这次的期待是什么' },
      { text: '我能明确说出不能接受的做法' },
      { text: '我有一个双方都认可的停止信号' },
      { text: '我了解对方近期的身体与情绪状态' },
      { text: '遇到意外情况时，我知道该怎么做' },
      { text: '事后我愿意留出时间做交流与照顾' },
    ],
    questions: [],
    usage: '这份清单是自查用的，没有标准分数。任何一项答不上来，都说明那一点值得先谈清楚再继续。',
  },
  markdown: '这是一份**示例清单**，用于验证 `分级清单` 类型。\n\n采用 11 档量表（-1 ~ 10），并允许选「不确定」。',
});

// ④ 任务反馈（原见解随笔）—— ★ 不可接取
ITEMS.push({
  type: 'note',
  slug: PREFIX + 'feedback',
  meta: {
    title: '【示例】任务反馈：三段呼吸放松',
    summary: '示例反馈，用于验证「任务反馈不可接取」这条规则。',
    tags: ['示例', '反馈'], risk: 'low',
  },
  data: {
    body: [
      '关于「三段呼吸放松」这个任务的反馈示例。',
      '',
      '## 完成情况',
      '',
      '四个步骤都完成了，总计约 15 分钟。第二步的 4-6 呼吸节奏在最初两分钟不太适应，',
      '后面逐渐顺畅。',
      '',
      '## 遇到的问题',
      '',
      '- 第三步「扫过全身」时容易走神，需要反复把注意力拉回来',
      '- 计时器中途响过一次提醒，打断了状态',
      '',
      '## 下次调整',
      '',
      '1. 把计时器改成静音震动',
      '2. 环境温度再高一点，避免中途因为冷而分心',
      '',
      '## 自检结果',
      '',
      '呼吸基本保持自然；肩颈仍有轻微紧绷，未完全放松。',
    ].join('\n'),
  },
  markdown: '这是一篇**示例反馈**，用于验证 `任务反馈` 类型。\n\n注意：任务反馈**不提供「接取」按钮** —— 它是用来提交结果的，不是用来接取的。',
});

// ══════════════════════════════════════════ 执行
if (process.argv.includes('--remove')) {
  console.log('════════ 删除演示内容 ════════\n');
  const list = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${BRANCH}`);
  if (!list.ok) { console.log('  ✓ 目录不存在，无需删除'); process.exit(0); }
  const targets = list.j.filter((f) => f.name.startsWith(PREFIX));
  let n = 0;
  for (const f of targets) {
    const r = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(f.name)}`, 'DELETE', {
      message: `chore: 删除演示内容 ${f.name}`, sha: f.sha, branch: BRANCH,
    });
    console.log(r.ok ? `  ✓ ${f.name}` : `  ✗ ${f.name}`);
    if (r.ok) n++;
  }
  console.log(`\n  已删除 ${n} / ${targets.length} 篇`);
  process.exit(0);
}

console.log('════════ 生成演示内容 ════════\n');

const list = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${BRANCH}`);
const existing = list.ok ? Object.fromEntries(list.j.map((f) => [f.name, f.sha])) : {};

let ok = 0;
for (const it of ITEMS) {
  const content = buildContent(it.type, { ...it.meta, slug: it.slug }, it.data, it.markdown);
  const fileName = `${it.slug}.md`;
  const sha = existing[fileName];

  const r = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(fileName)}`, 'PUT', {
    message: `${sha ? 'test: 更新' : 'test: 新增'}演示内容 ${it.slug}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });

  const icon = { task: '⛓️', collection: '🗂️', checklist: '📊', note: '✍️' }[it.type];
  if (r.ok) {
    ok++;
    console.log(`  ✓ ${icon} [${it.type.padEnd(10)}] ${it.meta.title}`);
    console.log(`      slug=${it.slug}  ${content.length} 字符  可接取=${it.type !== 'note' ? '是' : '★ 否'}`);
  } else {
    console.log(`  ✗ ${it.slug}  HTTP ${r.status}  ${r.raw.slice(0, 140)}`);
  }
}

console.log(`\n════════ 完成 ════════`);
console.log(`  写入 ${ok} / ${ITEMS.length}`);
console.log(`\n  预期行为：`);
console.log(`     列表页   显示 4 篇，带类型徽章`);
console.log(`     详情页   前 3 篇显示「✅ 接取任务」，第 4 篇不显示`);
console.log(`     接取后   按钮变「📝 已接取 · 去提交反馈」`);
console.log(`\n  删除命令：node tools/gh-seed-demo.mjs --remove`);
