#!/usr/bin/env node
/**
 * tools/diag-cdn-cache.mjs —— 验证「API 内容新鲜、raw CDN 内容滞后」
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
const FILE = encodeURIComponent('酒店.md');

const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'diag' };
const FENCE = '`' + '``json foxsir-post';

console.log('════════ CDN 缓存验证 ════════\n');

// 1. API contents（应用改用这个）
console.log('── 1. GitHub API contents ──');
const api = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/posts/${FILE}?ref=${BRANCH}&t=${Date.now()}`, { headers: H });
const aj = await api.json();
const apiText = Buffer.from(aj.content, 'base64').toString('utf8');
console.log(`     HTTP ${api.status}`);
console.log(`     含 foxsir-post: ${apiText.includes(FENCE)}`);
console.log(`     长度: ${apiText.length}`);
console.log(`     sha: ${aj.sha?.slice(0, 10)}`);

// 2. raw CDN
console.log('\n── 2. raw.githubusercontent（CDN，可能滞后）──');
const raw = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/posts/${FILE}?t=${Date.now()}`, { headers: H });
const rawText = await raw.text();
console.log(`     HTTP ${raw.status}`);
console.log(`     含 foxsir-post: ${rawText.includes(FENCE)}`);
console.log(`     长度: ${rawText.length}`);

// 3. 对比
console.log('\n── 3. 对比 ──');
const same = apiText === rawText;
console.log(`     两者一致: ${same ? '✅ 是' : '✗ 否（CDN 滞后）'}`);
if (!same) {
  console.log(`     API  长度 ${apiText.length}`);
  console.log(`     CDN  长度 ${rawText.length}`);
  const i = apiText.indexOf(FENCE);
  console.log(`     API 区块标记位置: ${i}`);
  console.log(`     CDN 区块标记位置: ${rawText.indexOf('`' + '``json')}`);
}

// 4. 结论
console.log('\n════════ 结论 ════════');
if (!same && apiText.includes(FENCE) && !rawText.includes(FENCE)) {
  console.log('  ✅ 确认：GitHub API 内容是新的，raw CDN 仍是旧的。');
  console.log('     应用应改用 API 读取正文，而非 download_url。');
} else if (same) {
  console.log('  两者一致 —— 缓存已刷新，问题可能是时序。');
}
