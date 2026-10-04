#!/usr/bin/env node
// tools/check-inline-modules.mjs —— 检查 HTML 内联 module 脚本的语法
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

console.log('════════ 内联 module 语法检查 ════════\n');
let total = 0, bad = 0;

for (const f of walk(SRC)) {
  const html = fs.readFileSync(f, 'utf8');
  const blocks = [...html.matchAll(/<script[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) continue;

  blocks.forEach((b, i) => {
    total++;
    // 去掉 import/export 语句（Function 构造器不接受）
    const code = b[1]
      .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s*\(\s*['"][^'"]+['"]\s*\)/gm, 'void 0')
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+/gm, '');
    try {
      // eslint-disable-next-line no-new-func
      new Function(code);
    } catch (e) {
      bad++;
      const line = b[1].slice(0, e.message.length > 0 ? 0 : 0);
      console.log(`  ✗ ${path.relative(ROOT, f)}  [block ${i}]  ${e.message}`);
    }
  });
}

console.log(`  共 ${total} 个内联 module 块，${bad} 个语法错误 ${bad ? '❌' : '✅'}`);
process.exit(bad ? 1 : 0);
