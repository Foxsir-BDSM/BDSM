#!/usr/bin/env node
// tools/rewrite-file.mjs <target> <source>  —— 以 UTF-8 覆盖写入（绕过只读工具对非 UTF-8 文件的限制）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [target, source] = process.argv.slice(2);
if (!target || !source) {
  console.error('用法: node tools/rewrite-file.mjs <target> <source>');
  process.exit(1);
}
const src = path.isAbsolute(source) ? source : path.join(ROOT, source);
const dst = path.isAbsolute(target) ? target : path.join(ROOT, target);
fs.writeFileSync(dst, fs.readFileSync(src, 'utf8'), 'utf8');
console.log(`已写入: ${path.relative(ROOT, dst)}`);
