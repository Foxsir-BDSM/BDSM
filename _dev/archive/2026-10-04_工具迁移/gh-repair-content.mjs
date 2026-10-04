#!/usr/bin/env node
/**
 * tools/gh-repair-content.mjs —— 修正 content/posts 下所有文件的 JSON 区块标识
 *
 * 背景：迁移时区块写成了 ```json，而解析器要求 ```json foxsir-post，
 *       导致 parsePayload 返回 null、详情页报「内容格式异常」。
 *       本脚本重新写入全部文件（内容不变，仅修正标识）。
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
  'User-Agent': 'foxsir-repair',
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

console.log('════════ 修正 JSON 区块标识 ════════\n');

const list = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${BRANCH}`);
if (!list.ok) { console.error('  ✗ 列目录失败:', list.raw.slice(0, 150)); process.exit(1); }

let fixed = 0; const skipped = [];

for (const f of list.j.filter((x) => x.name.endsWith('.md'))) {
  const cur = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(f.name)}?ref=${BRANCH}`);
  if (!cur.ok) { console.log(`  ✗ ${f.name} 取文件失败`); continue; }

  let text = Buffer.from(cur.j.content, 'base64').toString('utf8');

  if (text.includes('```json foxsir-post')) {
    skipped.push(f.name);
    continue;
  }
  if (!text.includes('```json')) {
    console.log(`  · ${f.name} 无 JSON 区块，跳过`);
    skipped.push(f.name);
    continue;
  }

  const before = text.length;
  text = text.replace(/^```json\s*$/m, '```json foxsir-post');

  const up = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(f.name)}`, 'PUT', {
    message: `fix(${f.name}): 补 JSON 区块标识 foxsir-post`,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch: BRANCH,
    sha: cur.j.sha,
  });

  if (up.ok) {
    fixed++;
    console.log(`  ✓ ${f.name}  (${before} → ${text.length} 字符)`);
  } else {
    console.log(`  ✗ ${f.name}  HTTP ${up.status}  ${up.raw.slice(0, 120)}`);
  }
}

console.log(`\n════════ 完成 ════════`);
console.log(`  已修正 ${fixed} 篇，跳过 ${skipped.length} 篇`);

// 抽查一篇，确认格式正确
console.log('\n── 抽查「酒店」──');
const one = await api(`/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent('酒店.md')}?ref=${BRANCH}`);
if (one.ok) {
  const t = Buffer.from(one.j.content, 'base64').toString('utf8');
  t.split('\n').slice(0, 22).forEach((l) => console.log('    ' + l));
  console.log('    …');
  const re = /```json foxsir-post\s*\n([\s\S]*?)\n```/;
  const m = t.match(re);
  console.log(`\n  正则匹配: ${m ? '✅ 成功' : '✗ 失败'}`);
  if (m) {
    try { const o = JSON.parse(m[1]); console.log(`  解析成功: type=${o.type}  body=${(o.data?.body || '').length} 字符`); }
    catch (e) { console.log(`  ✗ JSON 解析失败: ${e.message}`); }
  }
}
