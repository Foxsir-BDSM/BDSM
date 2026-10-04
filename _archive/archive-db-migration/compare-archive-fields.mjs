#!/usr/bin/env node
/**
 * tools/compare-archive-fields.mjs
 * 对比「旧字段标签」与「新数据库字段」，输出可用的映射草稿
 * 只读：不写任何文件
 */
import https from 'https';
import fs from 'node:fs';
import path from 'node:path';

const API_KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const BASE = 'e7d18ead20743825';
const TABLE = 't4d3B3XvKL8';

// 从 instances.js 直接解析旧 FIELD_LABELS，避免手打出错
const instances = fs.readFileSync(
  path.join(process.cwd(), 'src', 'shared', 'config', 'archive', 'instances.js'), 'utf8');
const block = instances.match(/FIELD_LABELS:\s*\{([\s\S]*?)\n  \},/)[1];
const OLD = {};
for (const m of block.matchAll(/(f\w+):\s*'([^']*)'/g)) OLD[m[1]] = m[2];

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${API_KEY}` } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('超时')));
  });
}

const j = await get(`https://tables.fillout.com/api/v1/bases/${BASE}`);
const table = j.tables.find((t) => t.id === TABLE);
const NEW = table.fields.map((f) => ({ id: f.id, name: f.name, type: f.type }));

console.log('════════ 新旧字段对比 ════════\n');
console.log(`  旧表字段: ${Object.keys(OLD).length}   新表字段: ${NEW.length}\n`);

const norm = (s) => String(s || '')
  .replace(/[（(].*?[)）]/g, '')
  .replace(/\s+/g, '')
  .replace(/[&＆]/g, '')
  .toLowerCase();

const oldByNorm = new Map();
for (const [id, label] of Object.entries(OLD)) {
  const k = norm(label);
  if (k && !oldByNorm.has(k)) oldByNorm.set(k, { id, label });
}

console.log('── 1. 新表字段 → 对应旧字段（按名称归一化匹配）──\n');
const matched = new Set();
const unmatchedNew = [];
for (const f of NEW) {
  const k = norm(f.name);
  const old = oldByNorm.get(k);
  if (old) {
    matched.add(old.id);
    const same = old.label === f.name ? '相同' : `旧「${old.label}」`;
    console.log(`  ${f.id}  ${f.name.padEnd(28)} ← ${same}  [${f.type}]`);
  } else {
    unmatchedNew.push(f);
  }
}

console.log('\n── 2. 新表新增字段（旧表没有对应）──\n');
if (unmatchedNew.length) {
  unmatchedNew.forEach((f) => console.log(`  ${f.id}  ${f.name.padEnd(32)} [${f.type}]`));
} else {
  console.log('  （无）');
}

console.log('\n── 3. 旧字段在新表中找不到对应（可能已废弃）──\n');
const missing = Object.entries(OLD).filter(([id]) => !matched.has(id));
if (missing.length) {
  missing.forEach(([id, label]) => console.log(`  ${id}  ${label}`));
} else {
  console.log('  （无）');
}

console.log('\n── 4. 关键字段核对（筛选/隐私/确认）──\n');
const KEY = ['身份', '取向', '性取向', '是否公开问卷内容', '是否公开常住地址', '是否公开联系方式',
             '是否公开生活照片', '是否公开隐私照片', '我已确认上述为我真实意愿', '封面展示', '性别'];
for (const k of KEY) {
  const hit = NEW.filter((f) => f.name.includes(k));
  if (hit.length) hit.forEach((f) => console.log(`  ✅ ${k.padEnd(22)} → ${f.id}  「${f.name}」`));
  else console.log(`  ⚠️  ${k.padEnd(22)} → 新表中不存在`);
}

console.log('\n── 5. 附件类字段（媒体网格用）──\n');
NEW.filter((f) => f.type === 'attachments').forEach((f) => console.log(`  ${f.id}  ${f.name}`));
