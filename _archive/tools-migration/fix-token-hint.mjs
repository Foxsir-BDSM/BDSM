#!/usr/bin/env node
// tools/fix-token-hint.mjs —— 把内容模块里的 Token 提示链接指向管理后台
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'src/modules/content/index.html',
  'src/modules/content/post.html',
];
const FROM = '可在 <a href="/admin-article.html">内容管理台</a> 里填入';
const TO = '可在 <a href="/admin.html">管理后台</a> 的 Token 设置里填入';

let n = 0;
for (const rel of FILES) {
  const f = path.join(ROOT, rel);
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(FROM)) {
    console.log('  · 未命中: ' + rel);
    continue;
  }
  t = t.split(FROM).join(TO);
  fs.writeFileSync(f, t, 'utf8');
  console.log('  ✓ 已更新: ' + rel);
  n++;
}
console.log(`共更新 ${n} 个文件`);
