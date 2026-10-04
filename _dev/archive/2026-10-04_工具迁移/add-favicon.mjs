#!/usr/bin/env node
// tools/add-favicon.mjs —— 为缺失页面补 favicon 声明（相对路径按层级计算）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = path.join(ROOT, 'src', 'shared', 'assets', 'images');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (f.endsWith('.html')) o.push(f);
  }
  return o;
}

let fixed = 0;
for (const f of walk(path.join(ROOT, 'src'))) {
  let t = fs.readFileSync(f, 'utf8');
  if (t.includes('rel="icon"')) continue;

  // 计算到图片目录的相对前缀
  let rel = path.relative(path.dirname(f), IMG_DIR).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  const tag = `<link rel="icon" href="${rel}/OIP-C.jpg" type="image/jpeg" />`;

  // 插入到 charset 之后
  if (/<meta charset="UTF-8"\s*\/?>/.test(t)) {
    t = t.replace(/(<meta charset="UTF-8"\s*\/?>)/, `$1\n    ${tag}`);
  } else {
    t = t.replace(/<head>/i, `<head>\n    ${tag}`);
  }

  fs.writeFileSync(f, t, 'utf8');
  console.log(`  ✓ ${path.relative(ROOT, f).replace(/\\/g, '/')}  ->  ${rel}/OIP-C.jpg`);
  fixed++;
}
console.log(`\n共补 ${fixed} 个页面`);
