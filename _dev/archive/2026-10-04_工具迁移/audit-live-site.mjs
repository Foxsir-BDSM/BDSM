#!/usr/bin/env node
/**
 * tools/audit-live-site.mjs —— 审计线上站点（只读）
 *
 * 目的：
 *   1. 检查部署产物里是否泄漏 GitHub Token / Supabase Key
 *   2. 核实线上与本地是否一致（分支名、配置）
 *   3. 摸清实际的部署形态
 */
const BASE = 'https://www.foxsir.top';

console.log('════════ 线上站点审计 ════════\n');
console.log(`  站点: ${BASE}\n`);

const get = async (path) => {
  const r = await fetch(BASE + path, { redirect: 'follow' });
  return { status: r.status, text: await r.text(), headers: r.headers };
};

// ── 1. 抓首页与其引用的全部 JS
console.log('── 1. 抓取首页与静态资源 ──');
const home = await get('/');
console.log(`  首页 HTTP ${home.status}  ${home.text.length} B`);
console.log(`  Server: ${home.headers.get('server')}  x-vercel-id: ${home.headers.get('x-vercel-id')}`);

const assets = new Set();
for (const m of home.text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)) assets.add(m[1]);
console.log(`  首页引用资源: ${assets.size} 个`);

// ── 2. 逐个下载并扫描敏感信息
console.log('\n── 2. 敏感信息扫描 ──');
const PATTERNS = [
  ['GitHub Token (ghp_)', /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ['GitHub Token (pat)', /github_pat_[A-Za-z0-9_]{20,}/g],
  ['Supabase anon key', /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/g],
  ['Fillout API key', /sk_prod_[A-Za-z0-9_-]{20,}/g],
];

let anyLeak = false;
const scan = (label, text) => {
  for (const [name, re] of PATTERNS) {
    const m = text.match(re);
    if (m) {
      anyLeak = true;
      const uniq = [...new Set(m)];
      console.log(`  🔴 ${label}`);
      console.log(`       ${name} × ${uniq.length}: ${uniq[0].slice(0, 20)}…`);
      if (name.includes('Supabase')) {
        console.log('       （Supabase anon key 属公开信息，设计上可暴露；靠 RLS 保护）');
      }
    }
  }
};

scan('index.html', home.text);

const targets = [...assets].slice(0, 30);
for (const a of targets) {
  const url = a.startsWith('http') ? a : (a.startsWith('/') ? a : '/' + a);
  try {
    const r = await fetch(BASE + url);
    const t = await r.text();
    scan(url, t);
  } catch (e) {
    console.log(`  ✗ 取不到 ${url}: ${e.message}`);
  }
}
if (!anyLeak) console.log('  ✅ 未发现任何明文密钥');

// ── 3. 关键页面可达性
console.log('\n── 3. 页面可达性 ──');
const PAGES = ['/', '/index.html', '/landing.html', '/about.html', '/auth.html', '/my.html',
  '/profile.html', '/admin.html', '/modules/sub-archive/', '/modules/content/'];
for (const p of PAGES) {
  try {
    const r = await fetch(BASE + p, { redirect: 'manual' });
    console.log(`  ${String(r.status).padEnd(4)} ${p}`);
  } catch (e) {
    console.log(`  ✗    ${p}  ${e.message}`);
  }
}

// ── 4. 内容分支验证
console.log('\n── 4. 内容 CDN 分支验证（线上实际用的分支）──');
for (const b of ['main', 'content']) {
  const r = await fetch(`https://cdn.jsdelivr.net/gh/Foxsir-BDSM/foxsir-content@${b}/README.md`);
  console.log(`  @${b.padEnd(8)} HTTP ${r.status}  ${r.status === 200 ? '✅ 可用' : '✗'}`);
}

// ── 5. 部署形态推断
console.log('\n── 5. 部署形态 ──');
console.log(`  Server      : ${home.headers.get('server')}`);
console.log(`  x-vercel-id : ${home.headers.get('x-vercel-id')}`);
console.log(`  x-matched-path: ${home.headers.get('x-matched-path') || '（无）'}`);
console.log(`  cache-control : ${home.headers.get('cache-control') || '（无）'}`);

console.log('\n════════ 结论 ════════');
