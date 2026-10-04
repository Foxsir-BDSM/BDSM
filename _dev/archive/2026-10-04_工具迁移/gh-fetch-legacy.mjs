#!/usr/bin/env node
/**
 * tools/gh-fetch-legacy.mjs —— 取回仓库里的旧内容（用 Token，绕开限流）
 *
 * 输出：_dev/docs/数据表/legacy-content.json（原文留档，便于迁移对照）
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

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'foxsir-migrate',
};

const api = async (p) => {
  const r = await fetch(`https://api.github.com${p}`, { headers: H });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, raw: t };
};

console.log('════════ 取回旧内容 ════════\n');

// ── Token 有效性
const me = await api('/user');
if (me.status !== 200) {
  console.log(`  ✗ Token 无效或权限不足 HTTP ${me.status}`);
  console.log('    ' + me.raw.slice(0, 200));
  process.exit(1);
}
console.log(`  ✓ Token 有效，登录为: ${me.j.login}`);

const repo = await api(`/repos/${OWNER}/${REPO}`);
if (repo.status !== 200) {
  console.log(`  ✗ 读仓库失败 HTTP ${repo.status}: ${repo.raw.slice(0, 200)}`);
  process.exit(1);
}
console.log(`  ✓ 仓库: ${repo.j.full_name}  默认分支: ${repo.j.default_branch}  可推送: ${repo.j.permissions?.push}`);
console.log(`    配额剩余: ${repo.j ? '' : ''}（本请求未取 header，认证后为 5000/小时）\n`);

// ── 分支列表
const br = await api(`/repos/${OWNER}/${REPO}/branches?per_page=100`);
const branches = br.status === 200 ? br.j.map((b) => b.name) : [];
console.log(`  分支（${branches.length}）: ${branches.join(', ')}\n`);

// ── 逐分支取文件
const SOURCES = [
  { branch: 'tasks', dir: 'tasks' },
  { branch: 'knowledge', dir: 'articles' },
  { branch: 'master', dir: 'articles' },
];

const out = { fetchedAt: new Date().toISOString(), branches, files: [] };

for (const src of SOURCES) {
  if (!branches.includes(src.branch)) {
    console.log(`  · 跳过 ${src.branch}（不存在）`);
    continue;
  }
  console.log(`── ${src.branch}/${src.dir} ──`);

  const list = await api(`/repos/${OWNER}/${REPO}/contents/${src.dir}?ref=${src.branch}`);
  if (list.status !== 200) {
    console.log(`     ✗ 列目录失败 HTTP ${list.status}`);
    continue;
  }
  const mds = list.j.filter((f) => f.name.endsWith('.md'));
  console.log(`     ${mds.length} 个 .md 文件`);

  for (const f of mds) {
    const c = await api(`/repos/${OWNER}/${REPO}/contents/${src.dir}/${f.name}?ref=${src.branch}`);
    if (c.status !== 200) { console.log(`     ✗ ${f.name}`); continue; }
    const content = Buffer.from(c.j.content, 'base64').toString('utf8');
    out.files.push({
      branch: src.branch,
      path: f.path,
      name: f.name,
      sha: c.j.sha,
      content,
    });
    console.log(`     ✓ ${f.name}  (${content.length} 字符)`);
  }
  console.log('');
}

const dest = path.join('_dev', 'docs', '数据表', 'legacy-content.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1), 'utf8');

console.log(`════════ 完成 ════════`);
console.log(`  共取回 ${out.files.length} 篇`);
console.log(`  已保存: ${dest}`);
