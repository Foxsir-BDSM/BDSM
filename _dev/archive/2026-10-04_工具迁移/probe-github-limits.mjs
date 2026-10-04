#!/usr/bin/env node
/**
 * tools/probe-github-limits.mjs —— 实测 GitHub 写入能力的真实边界
 *
 * 不带 token，探测「未认证能做什么、不能做什么」，
 * 以及媒体文件走 GitHub 的路径是否成立。
 */
const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';

const show = (label, status, body) => {
  console.log(`   ${label.padEnd(38)} HTTP ${status}`);
  if (body) console.log(`        ${String(body).replace(/\s+/g, ' ').slice(0, 150)}`);
};

console.log('════════ GitHub 写入能力边界 ════════\n');

console.log('── 1. 未认证写入（模拟：没配 token 时会怎样）──');
const put = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/zz-probe.txt`, {
  method: 'PUT',
  headers: { 'User-Agent': 'probe', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'probe', content: Buffer.from('x').toString('base64') }),
});
show('未带 token 写文件', put.status, await put.text());

console.log('\n── 2. 读取路径对比（同一文件，三条路径）──');
const paths = [
  ['raw.githubusercontent', `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/README.md`],
  ['jsDelivr CDN', `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@main/README.md`],
  ['GitHub API (contents)', `https://api.github.com/repos/${OWNER}/${REPO}/contents/README.md?ref=main`],
];
for (const [name, u] of paths) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'probe' } });
    const len = (await r.arrayBuffer()).byteLength;
    console.log(`   ${name.padEnd(24)} HTTP ${r.status}  ${len} B  ${r.status === 200 ? '✅' : ''}`);
  } catch (e) {
    console.log(`   ${name.padEnd(24)} ✗ ${e.message}`);
  }
}

console.log('\n── 3. jsDelivr 对「不存在的分支」的反应（验证当前配置问题）──');
const r3 = await fetch(`https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@content/README.md`);
console.log(`   请求分支 @content（代码里配置的分支）`);
show('jsDelivr @content', r3.status, await r3.text());

const r3b = await fetch(`https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@main/README.md`);
console.log(`\n   请求分支 @main（实际存在的分支）`);
show('jsDelivr @main', r3b.status, r3b.status === 200 ? '（成功，内容已取到）' : await r3b.text());

console.log('\n── 4. 媒体文件的体积与配额（官方限制，供判断）──');
const LIMITS = [
  ['单个文件硬上限', '100 MB', '超过直接拒绝推送'],
  ['单文件警告阈值', '50 MB', '会警告，建议避免'],
  ['Contents API 写入上限', '约 1 MB', '大于此值必须改用 Git Data API（blob 分片）'],
  ['仓库建议体积', '< 1 GB', '官方推荐，超出会变慢'],
  ['仓库硬上限', '5 GB', '超过需清理或联系支持'],
  ['jsDelivr 单文件上限', '20 MB', '超过不回源，媒体将无法显示'],
];
LIMITS.forEach(([k, v, note]) => console.log(`   ${k.padEnd(22)} ${v.padEnd(10)} ${note}`));

console.log('\n── 5. 换算：若把用户媒体放 GitHub 会怎样 ──');
const scenarios = [
  ['图片 500 KB × 1000 张', 500 * 1024 * 1000],
  ['图片 500 KB × 10000 张', 500 * 1024 * 10000],
  ['短视频 20 MB × 100 个', 20 * 1024 * 1024 * 100],
  ['短视频 50 MB × 100 个', 50 * 1024 * 1024 * 100],
];
scenarios.forEach(([label, bytes]) => {
  const mb = bytes / 1024 / 1024;
  const gb = mb / 1024;
  const flag = gb > 5 ? '❌ 超硬上限' : gb > 1 ? '⚠️ 超建议值' : '✅ 尚可';
  console.log(`   ${label.padEnd(26)} ${mb.toFixed(0).padStart(6)} MB (${gb.toFixed(2)} GB)  ${flag}`);
});

console.log('\n  说明：以上为体积换算，未计 Git 历史 —— 每次修改都会留历史副本，');
console.log('        实际占用通常是当前体积的 1.5~3 倍。');

console.log('\n════════ 结论 ════════');
