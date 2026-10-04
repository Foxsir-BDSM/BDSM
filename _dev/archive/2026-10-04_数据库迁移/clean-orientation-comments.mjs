#!/usr/bin/env node
// tools/clean-orientation-comments.mjs —— 清理剩余的取向注释与导入
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);

const EDITS = [
  ['src/modules/sub-archive/js/home.js',
    "import { deriveArchiveFilter, getOrientation } from '@/shared/config/identity-config.js';",
    "import { deriveArchiveFilter } from '@/shared/config/identity-config.js';"],
  ['src/modules/sub-archive/js/home.js',
    '  // ① 归属筛选（identity / orientation）',
    '  // ① 归属筛选（按身份）'],
  ['src/modules/sub-archive/js/home.js',
    '  // 先按身份+取向推导默认筛选，再加载数据',
    '  // 先按身份推导默认筛选，再加载数据'],
  ['src/modules/sub-archive/index.html',
    '<!-- ===== 归属筛选条（按身份/取向推导默认视图，可覆盖） ===== -->',
    '<!-- ===== 归属筛选条（按身份推导默认视图，可覆盖） ===== -->'],
  ['src/shared/js/config.js',
    '// 「身份」字段承担，列表页据用户身份与取向筛选。',
    '// 「身份」字段承担，列表页据用户身份筛选。'],
];

let n = 0, miss = 0;
for (const [file, from, to] of EDITS) {
  const f = rel(file);
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(from)) { console.log('  · 未命中: ' + file); miss++; continue; }
  fs.writeFileSync(f, t.split(from).join(to), 'utf8');
  console.log('  ✓ ' + file);
  n++;
}
console.log(`\n共更新 ${n} 处${miss ? `，${miss} 处未命中` : ''}`);
