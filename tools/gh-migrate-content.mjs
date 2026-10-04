#!/usr/bin/env node
/**
 * tools/gh-migrate-content.mjs —— 旧内容迁移到新结构
 *
 * 做的事：
 *   1. 创建 content 分支（基于默认分支）
 *   2. 把 9 篇旧内容转成新格式，写入 content 分支的 posts/ 目录
 *   3. 保留旧分支不动（可随时回退）
 *
 * 【格式映射说明】
 *   旧格式：frontmatter + 纯正文（无 JSON 区块）
 *   新格式：frontmatter（含 content_type）+ ```json 区块 + 正文
 *
 *   统一映射为 note 类型：
 *     旧正文是连贯的文字或编号列表，正好对应 note 的 body 字段，内容零损失。
 *     强行塞进 task 的结构化字段（场景/道具/步骤…）需要编造数据，故不做。
 *     已结构化的任务可后续在编辑器里手动转为 task 类型。
 *
 * 用法：
 *   node tools/gh-migrate-content.mjs --dry     试运行（只看将生成什么，不写入）
 *   node tools/gh-migrate-content.mjs           实际执行
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});

const TOKEN = env.GITHUB_TOKEN;
const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';
const NEW_BRANCH = 'content';
const NEW_DIR = 'posts';

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'foxsir-migrate',
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

// ────────────────────────────────────────── 旧 → 新 格式转换
function parseLegacy(content, fileName) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { fm, body: (m[2] || '').trim(), fileName };
}

function buildNew(f, opts) {
  const p = parseLegacy(f.content, f.name);
  if (!p) return null;

  const slug = p.fm.slug || f.name.replace(/\.md$/, '');
  const title = p.fm.title || slug;
  const createdAt = p.fm.created_at || new Date().toISOString();
  const summary = p.fm.summary || '';

  const meta = {
    title,
    slug,
    content_type: 'note',
    risk: 'low',
    visibility: p.fm.is_public === 'false' ? 'member' : 'public',
    summary,
    cover: p.fm.cover_url || '',
    is_public: p.fm.is_public !== 'false',
    tags: p.fm.category ? [p.fm.category] : [],
    author_nickname: opts.author,
    author_email: '',
    createdAt,
    // 迁移留痕：便于日后回溯这来自哪个分支
    migratedFrom: `${f.branch}/${f.path}`,
  };

  const data = { body: p.body };

  const fmLines = Object.entries(meta)
    .filter(([k]) => k !== 'migratedFrom' && k !== 'is_public')
    .map(([k, v]) => {
      if (k === 'tags') return `tags: ${JSON.stringify(v)}`;
      if (k === 'is_public') return `is_public: ${v}`;
      return `${k}: ${v}`;
    });
  if (meta.is_public !== undefined) fmLines.splice(7, 0, `is_public: ${meta.is_public}`);

  const out = [
    '---',
    ...fmLines,
    '---',
    '',
    // ★ 必须带 foxsir-post 标识，否则 parsePayload 的 JSON_FENCE_RE 匹配不到
    '```json foxsir-post',
    JSON.stringify({
      type: 'note',
      meta: { ...meta, migratedFrom: undefined },
      data,
    }, null, 1),
    '```',
    '',
    p.body,
    '',
  ].join('\n');

  return { slug, title, out, bodyLen: p.body.length };
}

// ══════════════════════════════════════════ 主流程
console.log('════════ 旧内容迁移 ════════\n');
if (DRY) console.log('  【试运行模式 —— 不会写入任何内容】\n');

const src = JSON.parse(fs.readFileSync('_dev/docs/数据表/legacy-content.json', 'utf8'));
console.log(`  待迁移: ${src.files.length} 篇\n`);

const repo = await api(`/repos/${OWNER}/${REPO}`);
if (!repo.ok) { console.error('  ✗ 读仓库失败:', repo.raw.slice(0, 150)); process.exit(1); }
const base = repo.j.default_branch;
console.log(`  仓库默认分支: ${base}`);

// ── 1. 转换预览
console.log('\n── 1. 格式转换 ──');
const converted = [];
for (const f of src.files) {
  const c = buildNew(f, { author: 'Foxsir' });
  if (!c) { console.log(`     ✗ ${f.name}（无法解析）`); continue; }
  converted.push({ ...c, from: `${f.branch}/${f.path}` });
  console.log(`     ✓ ${c.title}`);
  console.log(`         slug=${c.slug}  正文 ${c.bodyLen} 字符  ← ${f.branch}/${f.path}`);
}

if (DRY) {
  console.log('\n── 转换样例（第一篇）──');
  console.log(converted[0].out.slice(0, 900).split('\n').map((l) => '    ' + l).join('\n'));
  console.log('\n  （试运行结束，未写入）');
  process.exit(0);
}

// ── 2. 创建分支
console.log('\n── 2. 创建分支 ──');
const brs = await api(`/repos/${OWNER}/${REPO}/branches?per_page=100`);
const names = brs.ok ? brs.j.map((b) => b.name) : [];

if (names.includes(NEW_BRANCH)) {
  console.log(`     ✓ ${NEW_BRANCH} 已存在`);
} else {
  const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${base}`);
  if (!ref.ok) { console.error('     ✗ 取基准 SHA 失败'); process.exit(1); }
  const sha = ref.j.object.sha;
  const cr = await api(`/repos/${OWNER}/${REPO}/git/refs`, 'POST', {
    ref: `refs/heads/${NEW_BRANCH}`, sha,
  });
  if (cr.status === 201) console.log(`     ✅ ${NEW_BRANCH} 创建成功（基于 ${base} @ ${sha.slice(0, 8)}）`);
  else { console.error(`     ✗ 创建失败 HTTP ${cr.status}: ${cr.raw.slice(0, 200)}`); process.exit(1); }
}

// ── 3. 写入
console.log(`\n── 3. 写入 ${NEW_BRANCH}/${NEW_DIR}/ ──`);
let ok = 0; const failed = [];

for (const c of converted) {
  const p = `/repos/${OWNER}/${REPO}/contents/${NEW_DIR}/${encodeURIComponent(c.slug)}.md`;
  const r = await api(p, 'PUT', {
    message: `migrate(${c.slug}): 迁移自 ${c.from}`,
    content: Buffer.from(c.out, 'utf8').toString('base64'),
    branch: NEW_BRANCH,
  });
  if (r.status === 201 || r.status === 200) {
    ok++;
    console.log(`     ✓ ${c.slug}`);
  } else {
    failed.push(c.slug);
    console.log(`     ✗ ${c.slug}  HTTP ${r.status}  ${r.raw.slice(0, 120)}`);
  }
}

// ── 4. 回读确认
console.log('\n── 4. 回读确认 ──');
const list = await api(`/repos/${OWNER}/${REPO}/contents/${NEW_DIR}?ref=${NEW_BRANCH}`);
if (list.ok) {
  console.log(`     ${NEW_BRANCH}/${NEW_DIR}/ 现有 ${list.j.length} 个文件:`);
  list.j.forEach((f) => console.log(`        · ${f.name}`));
} else {
  console.log(`     ✗ 列目录失败 HTTP ${list.status}`);
}

console.log('\n════════ 完成 ════════');
console.log(`  成功 ${ok} / ${converted.length}`);
if (failed.length) console.log(`  失败: ${failed.join(', ')}`);
console.log(`\n  旧分支（tasks / knowledge）未改动，可随时回退。`);
