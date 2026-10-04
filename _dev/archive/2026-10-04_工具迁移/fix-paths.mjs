#!/usr/bin/env node
// tools/fix-paths.mjs （一次性修正脚本）
//
// 对每个文件重新计算「到 src/shared/assets/images/ 的正确相对前缀」，
// 并把任何形态的旧/坏图片引用统一改写为该前缀 + 文件名。
// 这是计算式修正，不依赖字符串猜测。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = path.join(ROOT, 'src', 'shared', 'assets', 'images');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (/\.(html|css|js)$/.test(f)) o.push(f);
  }
  return o;
}

/** 计算 file -> IMG_DIR 的相对前缀，形如 ./shared/assets/images 或 ../../shared/assets/images */
function prefixFor(file) {
  let rel = path.relative(path.dirname(file), IMG_DIR).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

const NAMES = ['OIP-A.jpg', 'OIP-B.jpg', 'OIP-C.jpg'];

let changed = 0;
for (const file of walk(path.join(ROOT, 'src'))) {
  const prefix = prefixFor(file);
  let t = fs.readFileSync(file, 'utf8');
  const before = t;

  for (const name of NAMES) {
    // 匹配任意以该文件名为结尾的路径片段（排除已经在正确前缀下的情况）
    const re = new RegExp(
      '(?:\\.\\.?/)*(?:[A-Za-z0-9_.-]+/)*' + name.replace('.', '\\.'),
      'g'
    );
    t = t.replace(re, (m) => {
      const want = prefix + '/' + name;
      return m === want ? m : want;
    });
  }

  if (t !== before) {
    fs.writeFileSync(file, t, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    console.log(`  ${rel}  ->  ${prefix}/`);
    changed++;
  }
}
console.log(`\n共修正 ${changed} 个文件`);
