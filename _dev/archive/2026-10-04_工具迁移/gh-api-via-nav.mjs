#!/usr/bin/env node
/**
 * tools/gh-api-via-nav.mjs —— 通过「导航到 API URL」调用 GitHub API
 *
 * 背景：GitHub 页面里用 fetch 调 API 会挂住（实测确认），
 *       但直接导航到 API 地址能正常返回 JSON —— 因为走的是页面加载，
 *       浏览器会自动带上会话 Cookie，等于以你的身份请求。
 *
 * 用法：
 *   node tools/gh-api-via-nav.mjs --get /repos/O/R
 *   node tools/gh-api-via-nav.mjs --branch-status
 *   node tools/gh-api-via-nav.mjs --create-branch content
 */
import { connect, sleep } from './cdp.mjs';

const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';
const PORT = 9222;

const argv = process.argv.slice(2);
const getArg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const c = await connect(PORT);
const tabs = await c.tabs();
const gh = tabs.find((t) => t.url.includes('github.com'));
if (!gh) { console.error('没有 GitHub 标签页'); process.exit(1); }
const s = await c.attach(gh.targetId);

/** 导航到 API 地址并把 JSON 取回来 */
async function apiGet(path) {
  const url = 'https://api.github.com' + path;
  await c.goto(s, url, 3500);

  // 等待 <pre> 或 body 出现 JSON
  for (let i = 0; i < 10; i++) {
    const txt = await c.js(s, `(document.body ? document.body.innerText : '')`);
    if (typeof txt === 'string' && txt.trim().length > 2) {
      try { return { ok: true, data: JSON.parse(txt) }; } catch { /* 还不是 JSON */ }
    }
    await sleep(800);
  }
  const last = await c.js(s, `(document.body ? document.body.innerText : '').slice(0,300)`);
  return { ok: false, raw: String(last) };
}

const cmd = argv[0] || '--branch-status';

if (cmd === '--get') {
  const p = getArg('--get');
  const r = await apiGet(p);
  console.log(JSON.stringify(r.data || r.raw, null, 1).slice(0, 2000));
  c.close();
  process.exit(0);
}

if (cmd === '--branch-status') {
  console.log('════════ foxsir-content 现状 ════════\n');

  const repo = await apiGet(`/repos/${OWNER}/${REPO}`);
  if (!repo.ok) {
    console.log('  ✗ 读取仓库失败，页面内容:');
    console.log('    ' + String(repo.raw).slice(0, 300));
    c.close();
    process.exit(1);
  }
  const rj = repo.data;
  console.log(`  仓库       : ${rj.full_name}`);
  console.log(`  默认分支   : ${rj.default_branch}`);
  console.log(`  权限(push) : ${rj.permissions?.push}`);
  console.log(`  private    : ${rj.private}`);
  console.log('');

  const br = await apiGet(`/repos/${OWNER}/${REPO}/branches?per_page=100`);
  const names = br.ok ? br.data.map((b) => b.name) : [];
  console.log(`  分支（${names.length}）:`);
  names.forEach((n) => console.log(`     · ${n}`));
  console.log('');

  const hasContent = names.includes('content');
  console.log(`  content 分支: ${hasContent ? '✅ 已存在' : '✗ 不存在（需要创建）'}`);

  if (!hasContent) {
    console.log('\n  ── 创建命令 ──');
    console.log('     node tools/gh-api-via-nav.mjs --create-branch content');
  }

  c.close();
  process.exit(0);
}

if (cmd === '--create-branch') {
  const BRANCH = getArg('--create-branch') || 'content';
  console.log(`════════ 创建分支 ${BRANCH} ════════\n`);

  const repo = await apiGet(`/repos/${OWNER}/${REPO}`);
  if (!repo.ok) { console.log('  ✗ 读仓库失败'); c.close(); process.exit(1); }
  const base = repo.data.default_branch;
  console.log(`  基准分支: ${base}`);

  const br = await apiGet(`/repos/${OWNER}/${REPO}/branches?per_page=100`);
  if (br.ok && br.data.some((b) => b.name === BRANCH)) {
    console.log(`  ✓ 分支 ${BRANCH} 已存在，无需创建`);
    c.close();
    process.exit(0);
  }

  const ref = await apiGet(`/repos/${OWNER}/${REPO}/git/ref/heads/${base}`);
  if (!ref.ok) { console.log('  ✗ 取基准 SHA 失败'); c.close(); process.exit(1); }
  const sha = ref.data.object.sha;
  console.log(`  基准 SHA: ${sha.slice(0, 12)}…`);

  console.log('\n  ⚠️ 无法用导航方式做 POST（导航只能 GET）。');
  console.log('     请改用下面任一方式创建分支：');
  console.log('');
  console.log('     方式一（网页，30 秒）：');
  console.log(`       https://github.com/${OWNER}/${REPO}/branches`);
  console.log(`       → New branch → 名字填 ${BRANCH} → 源选 ${base} → Create`);
  console.log('');
  console.log('     方式二（给我 Token 后我代劳）：');
  console.log('       把 Fine-grained PAT 填进 cloudflare/.dev.vars 的 GITHUB_TOKEN');
  console.log('       我即可创建分支、发布测试内容、跑完端到端验证');

  c.close();
  process.exit(0);
}

c.close();
