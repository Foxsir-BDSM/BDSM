#!/usr/bin/env node
/**
 * tools/diag-raw-headers.mjs —— 检查 raw 请求的缓存头，判断滞后来源
 */
import fs from 'node:fs';

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const TOKEN = env.GITHUB_TOKEN;
const FILE = encodeURIComponent('酒店.md');
const URL_BASE = `https://raw.githubusercontent.com/Foxsir-BDSM/foxsir-content/content/posts/${FILE}`;
const FENCE = '`' + '``json foxsir-post';

const show = async (label, headers, url) => {
  const r = await fetch(url, { headers });
  const t = await r.text();
  console.log(`── ${label} ──`);
  console.log(`   HTTP ${r.status}  长度 ${t.length}  含标记 ${t.includes(FENCE)}`);
  console.log(`   cache-control : ${r.headers.get('cache-control')}`);
  console.log(`   etag          : ${r.headers.get('etag')}`);
  console.log(`   age           : ${r.headers.get('age')}`);
  console.log(`   x-cache       : ${r.headers.get('x-cache')}`);
  console.log(`   last-modified : ${r.headers.get('last-modified')}`);
  console.log(`   vary          : ${r.headers.get('vary')}`);
  console.log('');
};

console.log('════════ raw 请求的缓存行为 ════════\n');

await show('不带 Authorization', { 'User-Agent': 'diag' }, URL_BASE + '?t=' + Date.now());
await show('带 Authorization', { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'diag' }, URL_BASE + '?t=' + Date.now());
await show('不带鉴权 + 无缓存参数', { 'User-Agent': 'diag' }, URL_BASE);

console.log('── 用 CDN 路径（cdn.jsdelivr.net）──');
try {
  const r = await fetch(`https://cdn.jsdelivr.net/gh/Foxsir-BDSM/foxsir-content@content/posts/${FILE}`);
  const t = await r.text();
  console.log(`   HTTP ${r.status}  长度 ${t.length}  含标记 ${t.includes(FENCE)}`);
} catch (e) {
  console.log('   ✗ ' + e.message);
}

console.log('\n── 结论 ──');
console.log('   若不带 Authorization 的那次滞后、带鉴权的新鲜，');
console.log('   则说明 raw 的匿名缓存与鉴权缓存是两条路径。');
console.log('   应用侧应改用 GitHub API 读取正文，彻底绕开 CDN 缓存。');
