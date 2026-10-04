#!/usr/bin/env node
/**
 * tools/cf-token-check.mjs —— 验证 Cloudflare API Token 及其权限范围
 * 只读：仅调用各服务的「列表」接口，不创建任何资源
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VARS = path.join(ROOT, 'cloudflare', '.dev.vars');

if (!fs.existsSync(VARS)) {
  console.error('✗ 找不到 cloudflare/.dev.vars');
  process.exit(1);
}

const env = {};
fs.readFileSync(VARS, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});

const TOKEN = env.CLOUDFLARE_API_TOKEN;
const ACCT = env.CLOUDFLARE_ACCOUNT_ID;
if (!TOKEN || !ACCT) {
  console.error('✗ .dev.vars 缺 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID');
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const API = 'https://api.cloudflare.com/client/v4';

const call = async (p, method = 'GET', body) => {
  try {
    const r = await fetch(API + p, {
      method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => null);
    return { status: r.status, ok: r.ok && j?.success !== false, json: j };
  } catch (e) {
    return { status: 0, ok: false, json: { errors: [{ message: e.message }] } };
  }
};

const line = (label, res, note = '') => {
  const mark = res.ok ? '✅' : '✗';
  const err = res.json?.errors?.[0]?.message || '';
  console.log(`  ${mark} ${label.padEnd(26)} ${res.ok ? (note || '可用') : `HTTP ${res.status} ${err.slice(0, 60)}`}`);
};

console.log('════════ Cloudflare Token 验证 ════════\n');
console.log(`  账号 ID : ${ACCT}`);
console.log(`  Token   : ${TOKEN.slice(0, 12)}…${TOKEN.slice(-6)}  (长度 ${TOKEN.length})\n`);

// ── 1. Token 身份
console.log('── 1. Token 有效性 ──');
const verify = await call('/user/tokens/verify');
if (verify.ok) {
  console.log(`  ✅ Token 有效，状态: ${verify.json.result?.status || '?'}`);
} else {
  console.log(`  ✗ Token 无效: HTTP ${verify.status} ${verify.json?.errors?.[0]?.message || ''}`);
  console.log('\n  请确认复制的是「API 令牌」而不是其他值。');
  process.exit(1);
}

// ── 2. 账号可访问性
console.log('\n── 2. 账号权限 ──');
const acct = await call(`/accounts/${ACCT}`);
line('读取账号信息', acct, acct.ok ? (acct.json.result?.name || '') : '');

// ── 3. 逐项能力探测
console.log('\n── 3. 各服务权限（列出接口，不创建）──');

const d1 = await call(`/accounts/${ACCT}/d1/database`);
line('D1 数据库 · 列表', d1, d1.ok ? `${d1.json.result?.length ?? 0} 个已存在` : '');
if (d1.ok && d1.json.result?.length) {
  d1.json.result.forEach((d) => console.log(`        · ${d.name}  (${d.uuid})`));
}

const r2 = await call(`/accounts/${ACCT}/r2/buckets`);
line('R2 存储桶 · 列表', r2, r2.ok ? `${r2.json.result?.buckets?.length ?? 0} 个已存在` : '');
if (r2.ok && r2.json.result?.buckets?.length) {
  r2.json.result.buckets.forEach((b) => console.log(`        · ${b.name}`));
}

const wk = await call(`/accounts/${ACCT}/workers/scripts`);
line('Workers · 列表', wk, wk.ok ? `${wk.json.result?.length ?? 0} 个已存在` : '');
if (wk.ok && wk.json.result?.length) {
  wk.json.result.forEach((s) => console.log(`        · ${s.id}`));
}

// 写权限探测：不实际创建，只看能否列 KV（侧面反映 token 范围）
const kv = await call(`/accounts/${ACCT}/storage/kv/namespaces`);
line('KV · 列表（参考）', kv, kv.ok ? `${kv.json.result?.length ?? 0} 个` : '');

console.log('\n════════ 结论 ════════');
const canD1 = d1.ok;
const canR2 = r2.ok;
const canWk = wk.ok;

console.log(`  D1   ${canD1 ? '✅' : '✗'}    R2 ${canR2 ? '✅' : '✗'}    Workers ${canWk ? '✅' : '✗'}`);

if (canD1 && canR2 && canWk) {
  console.log('\n  ✅ 三项权限齐备，可以开始创建资源与部署。');
} else {
  console.log('\n  ⚠️ 权限不全。缺少的项需要在 Cloudflare 后台给该 Token 补权限：');
  if (!canD1) console.log('     · Account · D1 · Edit');
  if (!canR2) console.log('     · Account · Workers R2 Storage · Edit');
  if (!canWk) console.log('     · Account · Workers Scripts · Edit');
}
