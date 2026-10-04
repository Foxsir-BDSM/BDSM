#!/usr/bin/env node
/**
 * tools/extract-select-options.mjs —— 从现有记录反推选择型字段的候选值
 *
 * 背景：Zite/Tables API 不返回字段的选项列表，只返回 order。
 *       因此编辑器需要的候选值，从已有数据里统计得出。
 *
 * 输出：控制台报告 + tools/.select-options.json
 */
import https from 'https';
import fs from 'node:fs';

const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');
const F = await import('../src/shared/config/archive/fields.js');

const post = (url, body) => new Promise((res, rej) => {
  const u = new URL(url); const p = JSON.stringify(body);
  const r = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } },
    (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => res(JSON.parse(d))); });
  r.on('error', rej); r.write(p); r.end();
});

const req = (url) => new Promise((res, rej) => {
  const u = new URL(url);
  https.get({ hostname: u.hostname, path: u.pathname, headers: { Authorization: 'Bearer ' + API_KEY } },
    (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => res(JSON.parse(d))); }).on('error', rej);
});

// 取字段元信息（类型）
const base = await req(`https://tables.fillout.com/api/v1/bases/${BASE_ID}`);
const table = base.tables.find((t) => t.id === TABLE_ID);
const selectFields = table.fields.filter((f) => /select/.test(f.type));

// 取全部记录
const list = await post(
  `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`,
  { limit: 200, offset: 0 });
const records = list.records || [];

console.log('════════ 选择型字段的候选值（从现有数据反推）════════\n');
console.log(`  记录数: ${records.length}   选择型字段: ${selectFields.length}\n`);

const out = {};

for (const f of selectFields) {
  const counter = new Map();
  let empty = 0;

  for (const r of records) {
    const d = r.data || {};
    const v = d[f.id];
    if (v === undefined || v === null || v === '') { empty++; continue; }
    const items = Array.isArray(v) ? v : [v];
    items.forEach((x) => {
      const k = String(x).trim();
      if (!k) return;
      counter.set(k, (counter.get(k) || 0) + 1);
    });
  }

  const opts = [...counter.entries()].sort((a, b) => b[1] - a[1]);
  out[f.id] = { name: F.labelOf(f.id), type: f.type, options: opts.map(([v]) => v), counts: Object.fromEntries(opts) };

  console.log(`── ${F.labelOf(f.id)}  [${f.type}]  ${f.id}`);
  console.log(`   空值 ${empty} 条，出现 ${opts.length} 种取值：`);
  opts.forEach(([v, n]) => console.log(`     ${String(n).padStart(3)}×  ${v}`));
  console.log('');
}

fs.writeFileSync('tools/.select-options.json', JSON.stringify(out, null, 1), 'utf8');
console.log('  ✅ 已写入 tools/.select-options.json');
console.log('\n  说明：这些取值来自现有数据，可能不完整（例如某选项还没人填过）。');
console.log('       可作为编辑器的初始候选值，之后按需补充。');
