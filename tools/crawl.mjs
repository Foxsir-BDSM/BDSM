#!/usr/bin/env node
/**
 * tools/crawl.mjs —— 页面依赖遍历可达性测试
 *
 * 对每个页面：抓取 HTML → 解析其中的 script/link/img 引用（含内联 module 的 import）
 * → 逐个请求并校验可达。用于确认「页面能真正跑起来」而非仅 HTML 可访问。
 *
 *   node tools/crawl.mjs --port 5173
 */

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const PORT = Number(get('--port', 5173));
const BASE = `http://${get('--host', '127.0.0.1')}:${PORT}`;

const PAGES = [
  '/index.html',
  '/landing.html',
  '/about.html',
  '/auth.html',
  '/module.html',
  '/404.html',
  '/admin.html',
  '/admin-article.html',
  '/admin-article-simple.html',
  '/modules/sub-archive/index.html',
  '/modules/sub-archive/detail.html',
  '/modules/content/index.html',
  '/modules/content/post-editor.html',
  '/modules/content/post.html',
  '/modules/random/index.html',
];

/** 从 HTML 中提取需在浏览器中加载的资源 */
function extractRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]*rel="icon"[^>]*href="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) refs.add(m[1]);
  // 内联 module 里的静态 import
  for (const m of html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const im of m[1].matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) refs.add(im[1]);
  }
  return [...refs].filter(
    (u) => u && !/^(https?:)?\/\//.test(u) && !u.startsWith('data:') && !u.startsWith('#')
  );
}

/** 相对 URL → 绝对站点路径 */
function toSitePath(ref, pagePath) {
  if (ref.startsWith('/')) return ref;
  const baseDir = pagePath.replace(/\/[^/]*$/, '/');
  const stack = (baseDir + ref).split('/');
  const out = [];
  for (const seg of stack) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

let totalRefs = 0;
let okRefs = 0;
const problems = [];

for (const page of PAGES) {
  let html;
  let status;
  try {
    const res = await fetch(BASE + page, { redirect: 'manual' });
    status = res.status;
    html = await res.text();
  } catch (err) {
    problems.push(`${page}  页面请求失败: ${err.message}`);
    console.log(`\n✗ ${page}  ${err.message}`);
    continue;
  }
  if (status !== 200) {
    problems.push(`${page}  页面 HTTP ${status}`);
    console.log(`\n✗ ${page}  HTTP ${status}`);
    continue;
  }

  const refs = extractRefs(html);
  console.log(`\n── ${page}   (${refs.length} 个引用)`);
  for (const raw of refs) {
    const p = toSitePath(raw, page);
    totalRefs++;
    let s = 0;
    let note = '';
    try {
      const r = await fetch(BASE + p, { redirect: 'manual' });
      s = r.status;
      if (s === 200) {
        okRefs++;
        const ct = r.headers.get('content-type') || '';
        note = ct.split(';')[0];
      } else {
        problems.push(`${page}  ->  ${p}  HTTP ${s}`);
      }
    } catch (err) {
      s = -1;
      note = err.message;
      problems.push(`${page}  ->  ${p}  ${err.message}`);
    }
    console.log(`   ${s === 200 ? '✓' : '✗'} ${String(s).padStart(4)}  ${p}${note ? '   ' + note : ''}`);
  }
}

console.log('\n═══════════════════════════════════════════════');
console.log(`  页面 ${PAGES.length}  引用 ${totalRefs}  可达 ${okRefs}  失败 ${totalRefs - okRefs}`);
if (problems.length) {
  console.log('  ── 问题明细 ──');
  for (const p of problems) console.log('   · ' + p);
}
console.log('═══════════════════════════════════════════════');
process.exit(problems.length ? 1 : 0);
