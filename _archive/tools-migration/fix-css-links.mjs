#!/usr/bin/env node
// tools/fix-css-links.mjs （一次性修正脚本）
// launcher 的 CSS 外链应为 ../shared/css/（src/launcher -> src/shared）
// loading.js 的 Logo 应为根绝对 /shared/... ，使其可被 Vite 打包解析

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

const TASKS = [
  {
    file: 'src/launcher/auth.html',
    fixes: [
      ['href="./shared/css/landing.css"', 'href="../shared/css/landing.css"'],
      ['href="./shared/css/identity-selector.css"', 'href="../shared/css/identity-selector.css"'],
    ],
  },
  {
    file: 'src/launcher/index.html',
    fixes: [
      ['href="./shared/css/level.css"', 'href="../shared/css/level.css"'],
      ['href="./shared/css/avatar.css"', 'href="../shared/css/avatar.css"'],
    ],
  },
  {
    file: 'src/launcher/module.html',
    fixes: [['href="./shared/css/main.css"', 'href="../shared/css/main.css"']],
  },
  {
    file: 'src/shared/js/loading.js',
    fixes: [['src="../assets/images/OIP-C.jpg"', 'src="/shared/assets/images/OIP-C.jpg"']],
  },
];

let changed = 0;
for (const { file, fixes } of TASKS) {
  const full = path.join(ROOT, file);
  let t = fs.readFileSync(full, 'utf8');
  const before = t;
  for (const [from, to] of fixes) {
    if (!t.includes(from)) {
      console.log(`  ⚠ 未命中: ${file}  ${from}`);
      continue;
    }
    t = t.split(from).join(to);
    console.log(`  ✓ ${file}  ${from}  ->  ${to}`);
  }
  if (t !== before) {
    fs.writeFileSync(full, t, 'utf8');
    changed++;
  }
}
console.log(`\n共修正 ${changed} 个文件`);
