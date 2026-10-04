#!/usr/bin/env node
/**
 * tools/probe-github-availability.mjs
 * 验证：内容仓库的可读性、jsDelivr 可用性、Token 是否配置
 */
import fs from 'node:fs';

const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';
const BRANCH = 'content';

console.log('════════ GitHub 内容仓库可用性 ════════\n');

// ── 1. 仓库元信息（区分私有 vs 限流）
console.log('── 1. 仓库元信息 ──');
const r1 = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
  headers: { 'User-Agent': 'foxsir-probe', Accept: 'application/vnd.github+json' },
});
console.log(`   HTTP ${r1.status}`);
console.log(`   rate-limit-remaining: ${r1.headers.get('x-ratelimit-remaining')}`);
console.log(`   rate-limit-reset: ${r1.headers.get('x-ratelimit-reset')}`);
const t1 = await r1.text();
if (r1.status === 200) {
  const j = JSON.parse(t1);
  console.log(`   private = ${j.private}`);
  console.log(`   default_branch = ${j.default_branch}`);
  console.log(`   size = ${j.size} KB`);
} else {
  console.log(`   body: ${t1.slice(0, 200)}`);
  console.log(r1.status === 403 && /rate limit/i.test(t1)
    ? '   → 是限流，不是私有'
    : r1.status === 404
      ? '   → 仓库不存在，或为私有（GitHub 对私有仓库返回 404 以免泄露存在性）'
      : '   → 403 但非限流：可能是私有仓库 + 未认证');
}

// ── 2. jsDelivr 读取（前台 CDN 路径）
console.log('\n── 2. jsDelivr CDN（前台实际读取路径）──');
for (const u of [
  `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/posts/`,
  `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/`,
  `https://data.jsdelivr.com/v1/packages/gh/${OWNER}/${REPO}`,
]) {
  try {
    const r = await fetch(u);
    const t = await r.text();
    console.log(`   HTTP ${r.status}  ${u.replace('https://', '').slice(0, 70)}`);
    console.log(`        ${t.replace(/\s+/g, ' ').slice(0, 150)}`);
  } catch (e) {
    console.log(`   ✗ ${u.slice(0, 60)} — ${e.message}`);
  }
}

// ── 3. raw.githubusercontent（备用读取路径）
console.log('\n── 3. raw.githubusercontent（备用）──');
try {
  const r = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/README.md`);
  console.log(`   HTTP ${r.status}  ${(await r.text()).slice(0, 100)}`);
} catch (e) {
  console.log(`   ✗ ${e.message}`);
}

// ── 4. Token 配置情况
console.log('\n── 4. Token 配置 ──');
console.log(`   .env 文件: ${fs.existsSync('.env') ? '存在' : '不存在'}`);
console.log(`   .env.local: ${fs.existsSync('.env.local') ? '存在' : '不存在'}`);
console.log(`   环境变量 VITE_GITHUB_TOKEN: ${process.env.VITE_GITHUB_TOKEN ? '已设置' : '未设置'}`);

// ── 5. Vite 产物里是否真的内联了 token
console.log('\n── 5. 构建产物里的 token（若已构建）──');
const distDir = 'dist';
if (fs.existsSync(distDir)) {
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const hits = [];
  for (const f of walk(distDir)) {
    const t = fs.readFileSync(f, 'utf8');
    // 找 github token 形态：ghp_ / github_pat_
    for (const m of t.matchAll(/gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}/g)) {
      hits.push(`${f}  ${m[0].slice(0, 14)}…`);
    }
    if (/VITE_GITHUB_TOKEN/.test(t)) hits.push(`${f}  字面量 VITE_GITHUB_TOKEN`);
  }
  if (hits.length) hits.slice(0, 6).forEach((h) => console.log('   ⚠️ ' + h));
  else console.log('   ✅ 产物中未发现 token');
} else {
  console.log('   （dist 不存在）');
}

console.log('\n════════ 结论 ════════');
