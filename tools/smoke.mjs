#!/usr/bin/env node
/**
 * tools/smoke.mjs
 * HTTP 冒烟测试：对全部页面与其关键静态资源发起真实请求，验证 200 与内容特征。
 *
 *   node tools/smoke.mjs --port 5601 --label dist
 */

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 5600;
const labelArg = args.indexOf('--label');
const LABEL = labelArg >= 0 ? args[labelArg + 1] : 'src';
/** --prod：构建产物模式。此时源码文件已被打包，不再逐个检查源文件 */
const PROD = args.includes('--prod');
const BASE = `http://127.0.0.1:${PORT}`;

/** [路径, 期望内容特征(可为 null)] */
const PAGES = [
  ['/', '<title>'],
  ['/index.html', 'Foxsir'],
  ['/landing.html', '欲界之门'],
  ['/about.html', '用户指南'],
  ['/auth.html', '登录'],
  ['/module.html', '模块介绍'],
  ['/404.html', '404'],
  ['/admin.html', '管理面板'],
  ['/admin-article.html', '内容管理'],
  ['/admin-article-simple.html', '简易内容管理'],
  ['/modules/sub-archive/', '下位者档案馆'],
  ['/modules/sub-archive/index.html', '档案库'],
  ['/modules/sub-archive/detail.html', '详情'],
  ['/modules/sub-archive/admin.html', '管理后台'],
  ['/modules/content/', '欲炼之途'],
  ['/modules/content/index.html', '欲炼之途'],
  ['/modules/content/post-editor.html', '发布'],
  ['/modules/content/post.html', '内容详情'],
  ['/modules/dom-archive/', '上位档案馆'],
  ['/modules/dom-archive/index.html', '建设中'],
  ['/modules/random/', '随机模块'],
  ['/modules/random/index.html', '开发中'],
];

const ASSETS = [
  '/shared/assets/images/OIP-A.jpg',
  '/shared/assets/images/OIP-B.jpg',
  '/shared/assets/images/OIP-C.jpg',
  '/shared/css/main.css',
  '/shared/css/loading.css', // 应为 404（不存在），用于确认服务器行为
  '/shared/js/auth.js',
  '/shared/config/levelConfig.js',
  '/modules/sub-archive/css/global.css',
  '/modules/sub-archive/js/home.js',
  '/modules/sub-archive/js/api.js',
  '/modules/sub-archive/OIP-C.jpg',
  '/admin/admin.js',
  '/admin/content-manager.js',
];

let pass = 0;
let fail = 0;
const failures = [];

async function check(urlPath, expect, optional = false) {
  let res;
  let body = '';
  try {
    res = await fetch(BASE + urlPath, { redirect: 'manual' });
    body = await res.text();
  } catch (err) {
    if (optional) return;
    fail++;
    failures.push(`${urlPath}  请求失败: ${err.message}`);
    console.log(`  ✗ ${urlPath}  ${err.message}`);
    return;
  }

  const ok = res.status === 200 && (!expect || body.includes(expect));
  if (optional && res.status === 404) {
    console.log(`  · ${urlPath}  404（预期，跳过）`);
    return;
  }
  if (ok) {
    pass++;
    console.log(`  ✓ ${res.status}  ${urlPath}`);
  } else {
    fail++;
    const why = res.status !== 200 ? `HTTP ${res.status}` : `缺少特征 "${expect}"`;
    failures.push(`${urlPath}  ${why}`);
    console.log(`  ✗ ${res.status}  ${urlPath}  (${why})`);
  }
}

console.log('═══════════════════════════════════════════════');
console.log(`  冒烟测试  [${LABEL}]  ${BASE}`);
console.log('═══════════════════════════════════════════════');
console.log('── 页面 ──');
for (const [p, e] of PAGES) await check(p, e);

console.log('\n── 静态资源 ──');
if (PROD) {
  // 生产态：源码文件已被 Vite 打包，改为「逐页解析真实引用的产物」逐一校验
  for (const a of ['/shared/assets/images/OIP-A.jpg', '/shared/assets/images/OIP-B.jpg', '/shared/assets/images/OIP-C.jpg']) {
    await check(a, null);
  }
  const seen = new Set();
  for (const [p] of PAGES) {
    try {
      const res = await fetch(BASE + p);
      if (res.status !== 200) continue;
      const html = await res.text();
      const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      for (const r of refs) {
        if (seen.has(r)) continue;
        seen.add(r);
        await check(r, null);
      }
    } catch {
      /* 页面本身已在上面校验过 */
    }
  }
  console.log(`  （共校验打包产物 ${seen.size} 个）`);
} else {
  for (const a of ASSETS) await check(a, null, a.includes('loading.css'));
}

console.log('\n───────────────────────────────────────────────');
console.log(`  通过 ${pass}  失败 ${fail}`);
if (failures.length) {
  console.log('  失败明细:');
  for (const f of failures) console.log(`    · ${f}`);
}
console.log('═══════════════════════════════════════════════');
process.exit(fail ? 1 : 0);
