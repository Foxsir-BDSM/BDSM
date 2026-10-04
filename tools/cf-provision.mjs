#!/usr/bin/env node
/**
 * tools/cf-provision.mjs —— 用 Cloudflare API 创建 D1 并建表
 *
 * 幂等：已存在则复用，不重复创建。
 * 只创建 D1 相关内容，不碰 R2、不部署 Worker。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VARS = path.join(ROOT, 'cloudflare', '.dev.vars');
const TOML = path.join(ROOT, 'cloudflare', 'wrangler.toml');
const SCHEMA = path.join(ROOT, 'cloudflare', 'schema.sql');

const env = {};
fs.readFileSync(VARS, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});

const TOKEN = env.CLOUDFLARE_API_TOKEN;
const ACCT = env.CLOUDFLARE_ACCOUNT_ID;
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const API = 'https://api.cloudflare.com/client/v4';

const call = async (p, method = 'GET', body) => {
  const r = await fetch(API + p, { method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok && j.success !== false, j };
};

const DB_NAME = 'foxsir';

console.log('════════ 创建 D1 数据库 ════════\n');

// ── 1. 查是否已存在
const list = await call(`/accounts/${ACCT}/d1/database`);
if (!list.ok) {
  console.error('  ✗ 无法列出 D1:', list.j.errors?.[0]?.message);
  process.exit(1);
}
let db = (list.j.result || []).find((d) => d.name === DB_NAME);

if (db) {
  console.log(`  ✓ 已存在，复用: ${db.name}  (${db.uuid})`);
} else {
  console.log(`  创建中: ${DB_NAME} …`);
  const created = await call(`/accounts/${ACCT}/d1/database`, 'POST', { name: DB_NAME });
  if (!created.ok) {
    console.error('  ✗ 创建失败:', JSON.stringify(created.j.errors || created.j).slice(0, 300));
    process.exit(1);
  }
  db = created.j.result;
  console.log(`  ✅ 创建成功: ${db.name}  (${db.uuid})`);
}

const DB_ID = db.uuid;

// ── 2. 回填 wrangler.toml
let toml = fs.readFileSync(TOML, 'utf8');
if (toml.includes('REPLACE_WITH_YOUR_D1_DATABASE_ID')) {
  toml = toml.replace('REPLACE_WITH_YOUR_D1_DATABASE_ID', DB_ID);
  fs.writeFileSync(TOML, toml, 'utf8');
  console.log(`  ✅ 已回填 wrangler.toml 的 database_id`);
} else {
  // 已填过：确保值正确
  const cur = toml.match(/database_id\s*=\s*"([^"]+)"/);
  if (cur && cur[1] !== DB_ID) {
    toml = toml.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${DB_ID}"`);
    fs.writeFileSync(TOML, toml, 'utf8');
    console.log(`  ✅ 已更正 wrangler.toml 的 database_id（原值不匹配）`);
  } else {
    console.log(`  · wrangler.toml 的 database_id 已正确`);
  }
}

// ── 3. 执行建表 SQL
console.log('\n── 执行建表 SQL ──');
const sql = fs.readFileSync(SCHEMA, 'utf8');
// 拆成单条语句（D1 HTTP API 一次提交多条也行，但拆开便于报错定位）
const statements = sql
  .split('\n')
  .filter((l) => !/^\s*--/.test(l))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`  共 ${statements.length} 条语句`);

const res = await call(`/accounts/${ACCT}/d1/database/${DB_ID}/query`, 'POST', {
  sql: statements.join(';\n') + ';',
});

if (!res.ok) {
  console.error('  ✗ 执行失败:');
  console.error('    ' + JSON.stringify(res.j.errors || res.j).slice(0, 400));
  process.exit(1);
}
console.log('  ✅ 建表完成');

// ── 4. 验证表结构
const verify = await call(`/accounts/${ACCT}/d1/database/${DB_ID}/query`, 'POST', {
  sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;",
});
if (verify.ok) {
  const rows = verify.j.result?.[0]?.results || [];
  console.log(`\n── 已建表（${rows.length} 张）──`);
  rows.forEach((r) => console.log(`     · ${r.name}`));
}

const idx = await call(`/accounts/${ACCT}/d1/database/${DB_ID}/query`, 'POST', {
  sql: "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name;",
});
if (idx.ok) {
  const rows = idx.j.result?.[0]?.results || [];
  console.log(`\n── 已建索引（${rows.length} 个）──`);
  rows.forEach((r) => console.log(`     · ${r.name}`));
}

console.log('\n════════ 完成 ════════');
console.log(`  D1 数据库 : ${DB_NAME}`);
console.log(`  database_id: ${DB_ID}`);
console.log(`  已写入 cloudflare/wrangler.toml`);
