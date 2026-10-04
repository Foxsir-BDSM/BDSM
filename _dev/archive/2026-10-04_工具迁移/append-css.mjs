#!/usr/bin/env node
/**
 * tools/append-css.mjs —— 把一段样式追加到指定 CSS 文件末尾（幂等）
 */
import fs from 'node:fs';

const [, , target, marker, source] = process.argv;
if (!target || !marker) {
  console.error('用法: node tools/append-css.mjs <目标css> <幂等标记> [来源文件]');
  process.exit(1);
}

const css = fs.readFileSync(target, 'utf8');
if (css.includes(marker)) {
  console.log(`  · 已存在标记「${marker}」，跳过`);
  process.exit(0);
}

const add = source ? fs.readFileSync(source, 'utf8') : '';
if (!add.trim()) {
  console.error('  ✗ 没有要追加的内容');
  process.exit(1);
}

fs.writeFileSync(target, css.replace(/\s*$/, '') + '\n\n' + add.trimEnd() + '\n', 'utf8');
console.log(`  ✅ 已追加 ${add.split('\n').length} 行到 ${target}`);
