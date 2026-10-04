#!/usr/bin/env node
/**
 * tools/gh-create-branch.mjs —— 用浏览器已登录的会话创建 content 分支
 *
 * 原理：GitHub 网页版所有的写操作都走 REST API，
 *       浏览器里 fetch 会自动带上会话 Cookie，
 *       因此不需要找 CSRF token，比模拟点击表单可靠。
 *
 * 用法：
 *   node tools/gh-create-branch.mjs                   查看现状
 *   node tools/gh-create-branch.mjs --create content  创建分支
 */
import { connect, sleep } from './cdp.mjs';

const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';
const PORT = 9222;

const argv = process.argv.slice(2);
const CREATE = argv.includes('--create');
const BRANCH = argv[argv.indexOf('--create') + 1] || 'content';

const c = await connect(PORT);
const tabs = await c.tabs();
let gh = tabs.find((t) => t.url.includes('github.com'));
if (!gh) {
  console.log('  没有 GitHub 标签页，新建一个…');
  const nt = await c.newTab('https://github.com/');
  gh = { targetId: nt.targetId };
  await sleep(4000);
}
const s = await c.attach(gh.targetId);

// 确保在 github.com 域下（fetch 同源才带 cookie）
const host = await c.js(s, 'location.hostname');
if (!String(host).includes('github.com')) {
  await c.goto(s, 'https://github.com/', 5000);
}

const api = async (path, opts = {}) => {
  const expr = `(async function(){
    try {
      var r = await fetch(${JSON.stringify('https://api.github.com' + path)}, {
        method: ${JSON.stringify(opts.method || 'GET')},
        headers: Object.assign({
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }, ${JSON.stringify(opts.headers || {})}),
        ${opts.body ? 'body: ' + JSON.stringify(JSON.stringify(opts.body)) + ',' : ''}
        credentials: 'include'
      });
      var t = await r.text();
      return JSON.stringify({ status: r.status, body: t.slice(0, 1200) });
    } catch (e) { return JSON.stringify({ status: 0, body: e.message }); }
  })()`;
  const raw = await c.js(s, expr, 40000);
  try { return JSON.parse(raw); } catch { return { status: 0, body: String(raw) }; }
};

console.log('════════ foxsir-content 分支现状 ════════\n');

const repo = await api(`/repos/${OWNER}/${REPO}`);
if (repo.status !== 200) {
  console.log(`  ✗ 读取仓库失败 HTTP ${repo.status}`);
  console.log('    ' + repo.body.slice(0, 200));
  console.log('\n  可能原因：未登录 / 会话过期 / 速率限制');
  c.close();
  process.exit(1);
}
const rj = JSON.parse(repo.body);
console.log(`  仓库           : ${rj.full_name}`);
console.log(`  默认分支       : ${rj.default_branch}`);
console.log(`  私有           : ${rj.private}`);
console.log('');

const branches = await api(`/repos/${OWNER}/${REPO}/branches?per_page=100`);
let names = [];
if (branches.status === 200) {
  try { names = JSON.parse(branches.body).map((b) => b.name); } catch {}
}
console.log(`  现有分支（${names.length}）: ${names.join(', ')}`);

if (!CREATE) {
  console.log('\n  ── 如需创建分支 ──');
  console.log('     node tools/gh-create-branch.mjs --create content');
  c.close();
  process.exit(0);
}

// ── 创建分支
if (names.includes(BRANCH)) {
  console.log(`\n  ✓ 分支 ${BRANCH} 已存在，无需创建`);
  c.close();
  process.exit(0);
}

console.log(`\n── 创建分支 ${BRANCH}（基于 ${rj.default_branch}）──`);
const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${rj.default_branch}`);
if (ref.status !== 200) {
  console.log(`  ✗ 取基准分支 SHA 失败 HTTP ${ref.status}: ${ref.body.slice(0, 150)}`);
  c.close();
  process.exit(1);
}
const sha = JSON.parse(ref.body).object.sha;
console.log(`  基准 SHA: ${sha.slice(0, 12)}…`);

const created = await api(`/repos/${OWNER}/${REPO}/git/refs`, {
  method: 'POST',
  body: { ref: `refs/heads/${BRANCH}`, sha },
});

if (created.status === 201) {
  console.log(`  ✅ 分支 ${BRANCH} 创建成功`);
} else {
  console.log(`  ✗ 创建失败 HTTP ${created.status}`);
  console.log('    ' + created.body.slice(0, 300));
}

// 回读确认
await sleep(1500);
const after = await api(`/repos/${OWNER}/${REPO}/branches?per_page=100`);
if (after.status === 200) {
  try {
    const n2 = JSON.parse(after.body).map((b) => b.name);
    console.log(`\n  回读分支列表（${n2.length}）: ${n2.join(', ')}`);
  } catch {}
}

c.close();
