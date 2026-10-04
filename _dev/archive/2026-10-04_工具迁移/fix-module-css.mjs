#!/usr/bin/env node
// tools/fix-module-css.mjs （一次性修正脚本）
// 模块级页面（src/modules/<mod>/xxx.html）引用共享样式需上升两级：../../shared/css/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

const FILES = [
  'src/modules/knowledge/article.html',
  'src/modules/knowledge/index.html',
  'src/modules/mission/detail.html',
  'src/modules/mission/index.html',
];

let changed = 0;
for (const f of FILES) {
  const full = path.join(ROOT, f);
  let t = fs.readFileSync(full, 'utf8');
  const before = t;
  t = t.split('href="../shared/css/').join('href="../../shared/css/');
  if (t !== before) {
    fs.writeFileSync(full, t, 'utf8');
    console.log(`  ✓ ${f}`);
    changed++;
  }
}
console.log(`\n共修正 ${changed} 个文件`);
