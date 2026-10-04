#!/usr/bin/env node
/**
 * tools/diag-content-load.mjs —— 复现详情页的内容加载流程，定位格式异常
 *
 * 完整走一遍：列目录 → 找文件 → 取 download_url → parseFrontmatter → parsePayload
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

const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'diag' };

const { CONTENT_STORE } = await import('../src/modules/content/js/content-types.js');
const { parsePayload, JSON_FENCE_RE } = await import('../src/modules/content/js/content-types.js');

console.log('════════ 复现内容加载流程 ════════\n');
console.log(`  CONTENT_STORE 配置:`);
console.log(`     branch = ${CONTENT_STORE.branch}`);
console.log(`     path   = ${CONTENT_STORE.path}`);
console.log('');

const BRANCH = CONTENT_STORE.branch;
const PATH_ = CONTENT_STORE.path;
const SLUG = process.argv[2] || '酒店';

// ── 1. 列目录（与 fetchContentList 同款请求）
console.log('── 1. 列目录 ──');
const listUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH_}?ref=${BRANCH}&t=${Date.now()}`;
const lr = await fetch(listUrl, { headers: H });
console.log(`     HTTP ${lr.status}`);
if (!lr.ok) {
  console.log(`     ✗ ${(await lr.text()).slice(0, 200)}`);
  process.exit(1);
}
const files = (await lr.json()).filter((f) => f.name.endsWith('.md'));
console.log(`     ${files.length} 个 .md`);

const target = files.find((f) => f.name.replace(/\.md$/, '') === SLUG);
if (!target) {
  console.log(`     ✗ 找不到 slug=${SLUG}`);
  console.log(`     可用: ${files.map((f) => f.name.replace(/\.md$/, '')).join(', ')}`);
  process.exit(1);
}
console.log(`     ✓ 找到: ${target.name}`);
console.log(`       download_url = ${target.download_url}`);

// ── 2. 取内容
console.log('\n── 2. 取内容 ──');
const cr = await fetch(target.download_url + '?t=' + Date.now());
const raw = await cr.text();
const FENCE = '`' + '``json';
console.log(`     HTTP ${cr.status}  长度 ${raw.length}`);
console.log('     含 JSON 区块标记        : ' + raw.includes(FENCE));
console.log('     含 foxsir-post 标识     : ' + raw.includes(FENCE + ' foxsir-post'));

// ── 3. 正则测试
console.log('\n── 3. JSON_FENCE_RE 匹配 ──');
console.log(`     正则: ${JSON_FENCE_RE}`);
const m = raw.match(JSON_FENCE_RE);
console.log(`     匹配结果: ${m ? '✅ 成功' : '✗ 失败'}`);

// 手工找区块位置
const idx = raw.indexOf(FENCE);
if (idx >= 0) {
  const snippet = raw.slice(idx, idx + 60);
  console.log('     区块起始处原文: ' + JSON.stringify(snippet));
}

// ── 4. parsePayload
console.log('\n── 4. parsePayload ──');
const payload = parsePayload(raw);
console.log(`     结果: ${payload ? '✅ 解析成功 type=' + payload.type : '✗ 返回 null'}`);

// ── 5. 逐字节检查区块标记附近
if (idx >= 0) {
  console.log('\n── 5. 区块标记附近的字符码 ──');
  const around = raw.slice(idx, idx + 25);
  console.log(`     文本: ${JSON.stringify(around)}`);
  console.log(`     码位: ${[...around].map((ch) => ch.charCodeAt(0)).join(' ')}`);
}

console.log('\n════════ 结论 ════════');
