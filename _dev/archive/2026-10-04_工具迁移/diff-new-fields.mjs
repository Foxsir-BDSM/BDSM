#!/usr/bin/env node
/**
 * tools/diff-new-fields.mjs —— 查看新库当前字段（寻找用户新增的三个字段）
 * 只读
 */
import https from 'https';

const API_KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const BASE = 'e7d18ead20743825';

const get = (url) => new Promise((res, rej) => {
  https.get(url, { headers: { Authorization: `Bearer ${API_KEY}` } }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej);
});

const j = await get(`https://tables.fillout.com/api/v1/bases/${BASE}`);
console.log('════════ 新库当前字段清单 ════════\n');
j.tables.forEach((t) => {
  console.log(`  表: ${t.name}  (${t.id})`);
  console.log(`  字段数: ${t.fields.length}\n`);
  t.fields.forEach((f, i) => {
    const mark = /公开|认证|媒体|邮箱|电子邮件|名称/.test(f.name) ? ' ★' : '';
    console.log(`  ${String(i + 1).padStart(3)}. ${f.id}  ${f.name}  [${f.type}]${mark}`);
  });
});

// 与本地 FIELD_LABELS 对比
const { FIELD_LABELS, SYSTEM_FIELD_IDS } = await import('../src/shared/config/archive/fields.js');
const remote = j.tables[0].fields;
const localIds = new Set([...Object.keys(FIELD_LABELS), ...Object.keys(SYSTEM_FIELD_IDS)]);

console.log('\n════════ 对比：远程有、本地没有 ════════\n');
const missing = remote.filter((f) => !localIds.has(f.id));
if (missing.length) missing.forEach((f) => console.log(`  ${f.id}  ${f.name}  [${f.type}]`));
else console.log('  （无）');

console.log('\n════════ 对比：本地有、远程没有 ════════\n');
const rIds = new Set(remote.map((f) => f.id));
const gone = [...localIds].filter((id) => !rIds.has(id));
if (gone.length) gone.forEach((id) => console.log(`  ${id}  ${FIELD_LABELS[id] || SYSTEM_FIELD_IDS[id]}`));
else console.log('  （无）');
