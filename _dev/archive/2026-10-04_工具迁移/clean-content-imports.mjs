#!/usr/bin/env node
// tools/clean-content-imports.mjs —— 清理内容模块中未使用的导入
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);

const TASKS = [
  ['src/modules/content/js/editor.js',
    '  POST_TYPES, RISK_LEVELS, VISIBILITY, TAG_GROUPS, ALL_TAGS,\n',
    '  POST_TYPES, RISK_LEVELS, VISIBILITY, TAG_GROUPS,\n'],
  ['src/modules/content/js/render.js',
    '  POST_TYPES, getPostType, getRisk, RISK_COLLAPSED,\n',
    '  getPostType, getRisk, RISK_COLLAPSED,\n'],
  ['src/modules/content/index.html',
    "import { CONTENT_STORE, ALL_TAGS, TAG_GROUPS, RISK_COLLAPSED } from './js/content-types.js';",
    "import { CONTENT_STORE, TAG_GROUPS, RISK_COLLAPSED } from './js/content-types.js';"],
];

let n = 0;
for (const [file, from, to] of TASKS) {
  const f = rel(file);
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(from)) { console.log('  · 未命中: ' + file); continue; }
  t = t.split(from).join(to);
  fs.writeFileSync(f, t, 'utf8');
  console.log('  ✓ 已清理: ' + file);
  n++;
}
console.log(`共清理 ${n} 个文件`);
