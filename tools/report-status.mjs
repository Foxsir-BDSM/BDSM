#!/usr/bin/env node
// tools/report-status.mjs —— 输出档案馆与身份模块的现状统计（只读，不改动）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (r) => path.join(ROOT, r);
const read = (r) => fs.readFileSync(p(r), 'utf8');

const t = read('src/shared/config/archive/instances.js');
const sub = t.slice(0, t.indexOf('// 统一导出'));
const cnt = (s, re) => (s.match(re) || []).length;

console.log('════════ 档案馆配置统计 ════════\n');
console.log('  【下位者档案馆 sub-archive】');
console.log('    FIELD_LABELS 字段数     : ' + cnt(sub, /^\s{4}f\w+:\s*'/gm));
console.log('    DETAIL_GROUPS 分组数    : ' + cnt(sub, /^\s{6}\{\s*$/gm));
console.log('    隐私规则 PRIVACY_RULES  : ' + cnt(sub, /controlId:/g) + ' 条');
console.log('    隐私依赖 DEPENDENCIES   : ' + cnt(sub, /^\s{4}'f\w+':\s*'f\w+'/gm) + ' 条');
console.log('    ROLE 可见性角色数       : ' + cnt(sub, /^\s{4}(guest|self|verified|subadmin|admin):/gm));

// 详情页分组名
console.log('\n════════ 详情页分组 ════════\n');
const gm = sub.match(/DETAIL_GROUPS:\s*\[([\s\S]*?)\n  \],/);
if (gm) {
  const titles = [...gm[1].matchAll(/title:\s*'([^']+)'/g)].map((x) => x[1]);
  const fieldCounts = gm[1].split(/\n\s{6}\{\s*\n/).slice(1)
    .map((blk) => (blk.match(/'f\w+'/g) || []).length);
  titles.forEach((x, i) => console.log(`  ${i + 1}. ${x}  （${fieldCounts[i] ?? '?'} 字段）`));
} else {
  console.log('  (未匹配到 DETAIL_GROUPS)');
}

// 首页专用字段
console.log('\n════════ 首页专用字段（详情页隐藏）════════\n');
const hm = sub.match(/HOME_ONLY_FIELD_IDS:\s*\[([\s\S]*?)\],/);
if (hm) {
  [...hm[1].matchAll(/'f\w+',\s*\/\/\s*(.+)/g)].forEach((m) => console.log('  · ' + m[1].trim()));
}

// 额外排除
console.log('\n════════ 详情页额外排除 ════════\n');
const em = sub.match(/EXTRA_EXCLUDED_FIELD_IDS:\s*\[([\s\S]*?)\],/);
if (em) {
  [...em[1].matchAll(/'f\w+',\s*\/\/\s*(.+)/g)].forEach((m) => console.log('  · ' + m[1].trim()));
}

// 系统字段
console.log('\n════════ 系统隐藏字段 ════════\n');
const sm = sub.match(/SYSTEM_FIELD_IDS:\s*\{([\s\S]*?)\},/);
if (sm) {
  [...sm[1].matchAll(/(f\w+):\s*'([^']+)'/g)].forEach((m) => console.log(`  · ${m[1]} → ${m[2]}`));
}

// 隐私规则
console.log('\n════════ 隐私规则（控制字段 → 展示字段）════════\n');
const pm = sub.match(/PRIVACY_RULES:\s*\[([\s\S]*?)\n  \],/);
if (pm) {
  [...pm[1].matchAll(/controlId:\s*'(\w+)',\s*\/\/\s*([^\n]+)\n\s*displayIds:\s*\[([^\]]+)\]/g)]
    .forEach((m) => {
      const n = (m[3].match(/'f\w+'/g) || []).length;
      console.log(`  · ${m[2].trim()}  → 控制 ${m[1]}，展示 ${n} 个字段`);
    });
}
