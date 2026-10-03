#!/usr/bin/env node
// tools/report-groups.mjs —— 输出 DETAIL_GROUPS 每组字段数
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = fs.readFileSync(path.join(ROOT, 'src/shared/config/archive/instances.js'), 'utf8');
const sub = t.slice(0, t.indexOf('// 统一导出'));

const start = sub.indexOf('DETAIL_GROUPS:');
const end = sub.indexOf('DETAIL_FIELD_ORDER');
const block = sub.slice(start, end >= 0 ? end : start + 4000);

const chunks = block.split(/title:\s*'/).slice(1);
console.log('════ DETAIL_GROUPS 每组字段数 ════\n');
for (const c of chunks) {
  const name = c.slice(0, c.indexOf("'"));
  const n = (c.match(/'f\w+'/g) || []).length;
  const hasPrivacy = /privacy/i.test(c);
  console.log(`  · ${name}  —— ${n} 个字段${hasPrivacy ? '（含隐私控制）' : ''}`);
}

// FIELD_LABELS 按前缀分组统计（用 ID 无法判组，改为统计总数与样例）
console.log('\n════ FIELD_LABELS 样例（前 12 个）════\n');
const fm = sub.match(/FIELD_LABELS:\s*\{([\s\S]*?)\n  \},/);
if (fm) {
  [...fm[1].matchAll(/(f\w+):\s*'([^']+)'/g)].slice(0, 12)
    .forEach((m) => console.log(`  · ${m[1]}  ${m[2]}`));
  const total = (fm[1].match(/(f\w+):\s*'/g) || []).length;
  console.log(`  … 共 ${total} 个`);
}
