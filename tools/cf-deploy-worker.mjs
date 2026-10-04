#!/usr/bin/env node
/**
 * tools/cf-deploy-worker.mjs —— 用 Cloudflare API 部署 Worker
 *
 * 做的事：
 *   1. 读取 cloudflare/worker.js 与 wrangler.toml
 *   2. 上传脚本（含 D1 绑定；R2 未开通时自动跳过该绑定）
 *   3. 以明文变量写入 Supabase 配置（Worker 内部用）
 *   4. 启用 workers.dev 子域访问
 *
 * 幂等：已存在则覆盖更新。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const env = {};
fs.readFileSync(path.join(ROOT, 'cloudflare', '.dev.vars'), 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});

const TOKEN = env.CLOUDFLARE_API_TOKEN;
const ACCT = env.CLOUDFLARE_ACCOUNT_ID;
const API = 'https://api.cloudflare.com/client/v4';
const SCRIPT = 'foxsir-task-api';

const toml = fs.readFileSync(path.join(ROOT, 'cloudflare', 'wrangler.toml'), 'utf8');
const code = fs.readFileSync(path.join(ROOT, 'cloudflare', 'worker.js'), 'utf8');

const tomlValue = (key) => {
  const m = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return m ? m[1] : '';
};

const DB_ID = tomlValue('database_id');
const CONTENT_OWNER = tomlValue('CONTENT_OWNER') || 'Foxsir-BDSM';
const CONTENT_REPO = tomlValue('CONTENT_REPO') || 'foxsir-content';
const CONTENT_BRANCH = tomlValue('CONTENT_BRANCH') || 'main';
const CONTENT_DIR = tomlValue('CONTENT_DIR') || 'posts';
const R2_PUBLIC_BASE = tomlValue('R2_PUBLIC_BASE');

console.log('════════ 部署 Worker ════════\n');
console.log(`  脚本名   : ${SCRIPT}`);
console.log(`  账号     : ${ACCT}`);
console.log(`  D1 绑定  : DB → ${DB_ID || '(未配置)'}`);
console.log(`  内容仓库 : ${CONTENT_OWNER}/${CONTENT_REPO}@${CONTENT_BRANCH}/${CONTENT_DIR}`);
console.log(`  R2 公开址: ${R2_PUBLIC_BASE || '(未配置)'}`);
console.log('');

// ── 探测 R2 是否已开通
let r2Buckets = [];
const r2 = await fetch(`${API}/accounts/${ACCT}/r2/buckets`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const r2j = await r2.json().catch(() => ({}));
const r2Available = r2.ok && r2j.success !== false;
if (r2Available) {
  r2Buckets = (r2j.result?.buckets || []).map((b) => b.name);
  console.log(`  R2 状态  : ✅ 已开通（${r2Buckets.length} 个桶）`);
} else {
  console.log(`  R2 状态  : ⚠️ 未开通 —— 本次部署将跳过 R2 绑定（媒体上传功能暂不可用）`);
}

// ── 组装绑定
const bindings = [];
if (DB_ID) {
  bindings.push({ type: 'd1', name: 'DB', id: DB_ID });
}
const R2_BUCKET = 'foxsir-media';
if (r2Available) {
  bindings.push({ type: 'r2_bucket', name: 'BUCKET', bucket_name: R2_BUCKET });
}

// ── 组装明文变量（Worker 运行时读取）
const vars = {
  CONTENT_OWNER,
  CONTENT_REPO,
  CONTENT_BRANCH,
  CONTENT_DIR,
  R2_PUBLIC_BASE,
  SUPABASE_URL: env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '',
};
if (env.GITHUB_TOKEN) vars.GITHUB_TOKEN = env.GITHUB_TOKEN;

const metadata = {
  main_module: 'worker.js',
  compatibility_date: '2026-01-01',
  bindings: [
    ...bindings,
    ...Object.entries(vars)
      .filter(([, v]) => v !== '')
      .map(([name, text]) => ({ type: 'plain_text', name, text })),
  ],
};

console.log(`\n  绑定清单（${metadata.bindings.length} 项）:`);
metadata.bindings.forEach((b) => {
  const v = b.type === 'plain_text'
    ? (b.name.includes('KEY') || b.name.includes('TOKEN') ? '(已设置，隐去)' : b.text)
    : (b.id || b.bucket_name || '');
  console.log(`     ${b.type.padEnd(12)} ${b.name.padEnd(18)} ${String(v).slice(0, 50)}`);
});

// ── 上传
console.log('\n  上传中…');
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');

const up = await fetch(`${API}/accounts/${ACCT}/workers/scripts/${SCRIPT}`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${TOKEN}` },
  body: form,
});
const upj = await up.json().catch(() => ({}));

if (!up.ok || upj.success === false) {
  console.error(`  ✗ 上传失败 HTTP ${up.status}`);
  console.error('    ' + JSON.stringify(upj.errors || upj).slice(0, 400));
  process.exit(1);
}
console.log('  ✅ 脚本已上传');

// ── 启用 workers.dev 子域
const sub = await fetch(`${API}/accounts/${ACCT}/workers/scripts/${SCRIPT}/subdomain`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: true, previews_enabled: false }),
});
const subj = await sub.json().catch(() => ({}));
if (sub.ok && subj.success !== false) {
  console.log('  ✅ 已启用 workers.dev 访问');
} else {
  console.log('  ⚠️ 启用 workers.dev 失败（可能已启用）: ' + JSON.stringify(subj.errors || {}).slice(0, 120));
}

// ── 取子域
const sd = await fetch(`${API}/accounts/${ACCT}/workers/subdomain`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const sdj = await sd.json().catch(() => ({}));
const subdomain = sdj.result?.subdomain || '';

console.log('\n════════ 部署完成 ════════');
if (subdomain) {
  const url = `https://${SCRIPT}.${subdomain}.workers.dev`;
  console.log(`  Worker 地址: ${url}`);
  console.log(`\n  健康检查:`);
  console.log(`    curl ${url}/health`);
} else {
  console.log('  未能取到子域，请在 Cloudflare 后台确认 Worker 的访问地址。');
}
console.log('');
