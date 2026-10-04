#!/usr/bin/env node
/**
 * tools/cleanup-probe-record.mjs —— 删除探测时创建的记录
 *
 * 安全校验：只删「确认为探测残留」的记录 ——
 *   · ID 精确匹配
 *   · 非空字段仅限 Source（API 自动写入的标记），
 *     或值为 'probe'
 */
const KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const BASE = 'e7d18ead20743825';
const TABLE = 't4d3B3XvKL8';
const HOST = 'https://tables.fillout.com';
const PROBE_ID = '5bc3718d-4220-4d43-b9e2-3991707d8a40';
const SRC_FIELD = 'fkYBsZUhZCv';   // Source

const call = async (method, path) => {
  const r = await fetch(HOST + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  });
  return { s: r.status, b: await r.text() };
};

const listAll = async () => {
  const r = await fetch(`${HOST}/api/v1/bases/${BASE}/tables/${TABLE}/records/list`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 200, offset: 0 }),
  });
  return JSON.parse(await r.text());
};

console.log('════════ 删除探测记录 ════════\n');

const before = await listAll();
console.log(`  当前记录数: ${before.total}`);
const rec = (before.records || []).find((r) => r.id === PROBE_ID);
if (!rec) {
  console.log('  ✓ 记录不存在，无需清理');
  process.exit(0);
}

// 安全校验
const d = rec.data || {};
const suspicious = Object.entries(d).filter(([k, v]) => {
  if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false;
  if (k === SRC_FIELD) return false;          // Source 是 API 自动写的
  if (v === 'probe') return false;            // 我写的探测值
  return true;
});

console.log(`  记录 ID: ${PROBE_ID}`);
console.log(`  非空字段:`);
Object.entries(d).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))
  .forEach(([k, v]) => console.log(`     ${k} = ${JSON.stringify(v)}`));

if (suspicious.length) {
  console.log('\n  ⚠️ 含非探测数据，拒绝删除（避免误删真实档案）:');
  suspicious.forEach(([k, v]) => console.log(`     ${k} = ${JSON.stringify(v)}`));
  process.exit(1);
}

console.log('\n  ✓ 校验通过：确认为探测残留\n── 执行删除 ──');

const attempts = [
  ['DELETE', `/api/v1/bases/${BASE}/tables/${TABLE}/records/${PROBE_ID}`],
  ['POST', `/api/v1/bases/${BASE}/tables/${TABLE}/records/${PROBE_ID}/delete`],
  ['DELETE', `/api/v1/bases/${BASE}/tables/${TABLE}/records?ids=${PROBE_ID}`],
];
let done = false;
for (const [method, path] of attempts) {
  const r = await call(method, path);
  const ok = r.s === 200 || r.s === 204;
  console.log(`   ${method.padEnd(6)} → HTTP ${r.s}  ${ok ? '★ 成功' : r.b.replace(/\s+/g, ' ').slice(0, 80)}`);
  if (ok) { done = true; break; }
}

const after = await listAll();
const still = (after.records || []).some((r) => r.id === PROBE_ID);
console.log(`\n  回读: 记录数 ${before.total} → ${after.total}`);
console.log(`  探测记录: ${still ? '❌ 仍存在，需人工删除' : '✅ 已删除'}`);
process.exit(still ? 1 : 0);
