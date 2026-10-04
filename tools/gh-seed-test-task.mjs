#!/usr/bin/env node
/**
 * tools/gh-seed-test-task.mjs —— 造一篇结构完整的测试任务，用于端到端验证
 *
 * 写入 content 分支的 posts/，类型为 task（可接取）。
 * 验证完成后可用 --remove 删除。
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

const SLUG = 'zz-端到端测试任务';

if (process.argv.includes('--remove')) {
  console.log('════════ 删除测试任务 ════════\n');
  const cur = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(SLUG)}.md?ref=${BRANCH}`);
  if (!cur.ok) { console.log('  ✓ 文件不存在，无需删除'); process.exit(0); }
  const del = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(SLUG)}.md`, 'DELETE', {
    message: `chore: 删除端到端测试任务`,
    sha: cur.j.sha,
    branch: BRANCH,
  });
  console.log(del.ok ? '  ✅ 已删除' : '  ✗ 删除失败: ' + del.raw.slice(0, 150));
  process.exit(del.ok ? 0 : 1);
}

// ── 构造结构完整、内容真实可用的测试任务
const meta = {
  title: '端到端测试任务（可删除）',
  slug: SLUG,
  content_type: 'task',
  risk: 'low',
  visibility: 'public',
  summary: '用于验证「接取 → 提交反馈」全链路的测试内容，验证完可删除。',
  cover: '',
  is_public: true,
  tags: ['测试'],
  author_nickname: 'Foxsir',
  author_email: '',
  createdAt: new Date().toISOString(),
};

const data = {
  scenes: ['居家独处'],
  times: ['夜晚'],
  durationValue: 15,
  durationUnit: '分钟',
  env: '安静、不被打扰的私密空间；手机静音。',
  pre: '确认身体状态良好，无不适；准备好一杯温水。',
  mental: '以放松为前提，任何环节感到不适可随时停止。',
  props: [
    { text: '计时器', required: true, note: '手机即可' },
    { text: '温水一杯', required: false },
  ],
  steps: [
    { text: '静坐三分钟，把注意力放在呼吸上', measure: '3 分钟' },
    { text: '逐项回想今天发生的事，不做评判', measure: '5 分钟' },
    { text: '写下此刻最想对自己说的一句话', measure: '3 分钟', safety: '不想写可以跳过' },
    { text: '伸展身体，缓慢结束', measure: '4 分钟', abort: '出现头晕等不适立即停止' },
  ],
  checkpoints: [
    { text: '全程是否保持了放松的呼吸' },
    { text: '有没有出现被强迫的感觉' },
  ],
  cleanup: '把写下的纸片收好或自行处理，整理好周边环境。',
  body: '结束后喝点温水，做几次深呼吸。',
  emotion: '如果过程中情绪起伏较大，给自己一点独处时间平复。',
  observe: '24 小时',
};

const FENCE = '`' + '``json foxsir-post';
const fmLines = [
  `title: ${meta.title}`,
  `slug: ${meta.slug}`,
  `content_type: ${meta.content_type}`,
  `risk: ${meta.risk}`,
  `visibility: ${meta.visibility}`,
  `summary: ${meta.summary}`,
  `cover_url: ${meta.cover}`,
  `is_public: ${meta.is_public}`,
  `tags: ${JSON.stringify(meta.tags)}`,
  `author_nickname: ${meta.author_nickname}`,
  `author_email: ${meta.author_email}`,
  `created_at: ${meta.createdAt}`,
];

const content = [
  '---',
  ...fmLines,
  '---',
  '',
  FENCE,
  JSON.stringify({ type: 'task', meta, data }, null, 1),
  '```',
  '',
  '这是一条用于验证流程的测试任务，可随时删除。',
  '',
].join('\n');

console.log('════════ 写入测试任务 ════════\n');
console.log(`  slug      : ${SLUG}`);
console.log(`  类型      : task（可接取）`);
console.log(`  内容长度  : ${content.length} 字符`);
console.log('');

const cur = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(SLUG)}.md?ref=${BRANCH}`);
const exists = cur.ok;

const put = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(SLUG)}.md`, 'PUT', {
  message: exists ? 'test: 更新端到端测试任务' : 'test: 新增端到端测试任务',
  content: Buffer.from(content, 'utf8').toString('base64'),
  branch: BRANCH,
  ...(exists ? { sha: cur.j.sha } : {}),
});

if (put.ok) {
  console.log(`  ✅ ${exists ? '已更新' : '已创建'}`);
  console.log(`     https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${DIR}/${encodeURIComponent(SLUG)}.md`);
} else {
  console.log(`  ✗ 失败 HTTP ${put.status}: ${put.raw.slice(0, 200)}`);
}

// 本地也校验一遍解析
console.log('\n── 本地校验解析 ──');
const { parsePayload } = await import('../src/modules/content/js/content-types.js');
const p = parsePayload(content);
if (!p) {
  console.log('  ✗ parsePayload 返回 null');
} else {
  console.log(`  ✅ type=${p.type}  steps=${p.data.steps?.length}  props=${p.data.props?.length}  checkpoints=${p.data.checkpoints?.length}`);
}
