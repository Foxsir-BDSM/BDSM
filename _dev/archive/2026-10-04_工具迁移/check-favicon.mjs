#!/usr/bin/env node
// tools/check-favicon.mjs —— 检查所有页面是否声明了 favicon
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (f.endsWith('.html')) o.push(f);
  }
  return o;
}

const missing = [];
console.log('=== 各页面 favicon 检查 ===');
for (const f of walk(path.join(ROOT, 'src')).sort()) {
  const t = fs.readFileSync(f, 'utf8');
  const has = t.includes('rel="icon"');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  console.log(`  ${has ? '[有]' : '[缺]'}  ${rel}`);
  if (!has) missing.push(rel);
}
console.log('');
if (missing.length) {
  console.log(`  缺 favicon 共 ${missing.length} 个:`);
  for (const m of missing) console.log('    - ' + m);
} else {
  console.log('  全部页面均已声明 favicon');
}
process.exit(missing.length ? 1 : 0);
