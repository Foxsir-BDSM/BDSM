#!/usr/bin/env node
// tools/report-fieldcount.mjs —— 精确核对 FIELD_LABELS 字段数
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = fs.readFileSync(path.join(ROOT, 'src/shared/config/archive/instances.js'), 'utf8');
const sub = t.slice(0, t.indexOf('// 统一导出'));
const fm = sub.match(/FIELD_LABELS:\s*\{([\s\S]*?)\n  \},/);
const body = fm[1];

const a = [...body.matchAll(/(f\w+):\s*'/g)].map((m) => m[1]);          // 有引号值
const b = [...body.matchAll(/^\s{4}(f\w+):/gm)].map((m) => m[1]);       // 行首缩进4
console.log('  有引号值的字段: ' + a.length);
console.log('  行首缩进4的键: ' + b.length);

const onlyB = b.filter((x) => !a.includes(x));
console.log('  只出现在 B 的键: ' + (onlyB.length ? onlyB.join(', ') : '无'));
console.log('');
console.log('  去重后唯一字段数: ' + new Set(b).size);

// 列出分组归属：用 DETAIL_FIELD_ORDER 或 DETAIL_GROUPS 的 fields 反查
const gm = sub.match(/DETAIL_GROUPS:\s*\[([\s\S]*?)\n  \],/);
if (gm) {
  const groups = gm[1].split(/title:\s*'/).slice(1);
  let assigned = new Set();
  console.log('\n  按详情分组归属：');
  for (const g of groups) {
    const name = g.slice(0, g.indexOf("'"));
    const ids = [...g.matchAll(/'f\w+'/g)].map((m) => m[0].slice(1, -1));
    ids.forEach((i) => assigned.add(i));
    console.log(`    · ${name}: ${ids.length}`);
  }
  const unassigned = b.filter((x) => !assigned.has(x));
  console.log(`\n  未进任何详情分组的字段: ${unassigned.length} 个`);
  unassigned.forEach((u) => {
    const lbl = body.match(new RegExp(u + "]:\\s*'([^']+)'")) || body.match(new RegExp(u + ":\\s*'([^']+)'"));
    console.log(`    · ${u}  ${lbl ? lbl[1] : '?'}`);
  });
}
