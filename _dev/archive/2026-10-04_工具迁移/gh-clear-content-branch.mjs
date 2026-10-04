#!/usr/bin/env node
/**
 * tools/gh-clear-content-branch.mjs —— 清空 content 分支的 posts/ 目录
 *
 * 【可恢复性说明】
 *   删除前会把每个文件的内容额外备份到
 *   _dev/docs/数据表/content-branch-backup.json，
 *   加上原有的 legacy-content.json 与未改动的 tasks / knowledge 分支，
 *   共三重保障，可随时恢复。
 *
 * 用法：
 *   node tools/gh-clear-content-branch.mjs --list     只列出
 *   node tools/gh-clear-content-branch.mjs            删除全部
 *   node tools/gh-clear-content-branch.mjs --keep slug1,slug2   保留指定 slug
 */
import fs from 'node:fs';
import path from 'node:path';

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
  'User-Agent': 'foxsir-clear',
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

const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes('--list');
const keepIdx = argv.indexOf('--keep');
const KEEP = keepIdx >= 0 ? (argv[keepIdx + 1] || '').split(',').filter(Boolean) : [];

console.log('════════ 清空 content/posts ════════\n');

const list = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${BRANCH}`);
if (!list.ok) {
  console.log(`  ✗ 列目录失败 HTTP ${list.status}（可能目录已不存在）`);
  process.exit(list.status === 404 ? 0 : 1);
}

const files = list.j.filter((f) => f.name.endsWith('.md'));
console.log(`  现有 ${files.length} 个文件`);
files.forEach((f) => {
  const slug = f.name.replace(/\.md$/, '');
  console.log(`     ${KEEP.includes(slug) ? '保留' : '删除'}  ${f.name}`);
});

if (LIST_ONLY) process.exit(0);

// ── 备份
const backup = { backedUpAt: new Date().toISOString(), branch: BRANCH, dir: DIR, files: [] };
for (const f of files) {
  const c = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(f.name)}?ref=${BRANCH}`);
  if (c.ok) {
    backup.files.push({ name: f.name, sha: c.j.sha, content: Buffer.from(c.j.content, 'base64').toString('utf8') });
  }
}
const dest = path.join('_dev', 'docs', '数据表', 'content-branch-backup.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(backup, null, 1), 'utf8');
console.log(`\n  ✅ 已备份 ${backup.files.length} 篇到 ${dest}`);

// ── 删除
console.log('\n── 删除 ──');
let del = 0;
for (const f of files) {
  const slug = f.name.replace(/\.md$/, '');
  if (KEEP.includes(slug)) { console.log(`  · 保留 ${f.name}`); continue; }
  const cur = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(f.name)}?ref=${BRANCH}`);
  if (!cur.ok) { console.log(`  ✗ ${f.name} 取 sha 失败`); continue; }
  const r = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(f.name)}`, 'DELETE', {
    message: `chore: 移除迁移内容 ${slug}`,
    sha: cur.j.sha,
    branch: BRANCH,
  });
  if (r.ok) { del++; console.log(`  ✓ ${f.name}`); }
  else console.log(`  ✗ ${f.name}  HTTP ${r.status}  ${r.raw.slice(0, 100)}`);
}

// ── 回读
const after = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${BRANCH}`);
const remain = after.ok ? after.j.filter((f) => f.name.endsWith('.md')) : [];
console.log(`\n════════ 完成 ════════`);
console.log(`  已删除 ${del} 篇`);
console.log(`  剩余 ${remain.length} 篇${remain.length ? ': ' + remain.map((f) => f.name).join(', ') : ''}`);
