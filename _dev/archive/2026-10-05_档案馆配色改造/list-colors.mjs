#!/usr/bin/env node
/**
 * tools/list-colors.mjs —— 列出指定 CSS 里用到的全部颜色值及出现次数
 * 用途：做主题替换前先看清有哪些颜色，避免盲改漏改。
 */
import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法: node tools/list-colors.mjs <css文件...>');
  process.exit(1);
}

for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  const counts = {};

  // #rgb / #rrggbb / #rrggbbaa
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const c = m[0].toLowerCase();
    counts[c] = (counts[c] || 0) + 1;
  }
  // rgb()/rgba()
  for (const m of css.matchAll(/rgba?\([^)]*\)/g)) {
    const c = m[0].replace(/\s+/g, '');
    counts[c] = (counts[c] || 0) + 1;
  }
  // 关键词色
  for (const m of css.matchAll(/:\s*(white|black|transparent|currentColor)\b/gi)) {
    const c = m[1].toLowerCase();
    counts[c] = (counts[c] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log(`\n════ ${f} ════`);
  console.log(`  共 ${sorted.length} 种颜色\n`);
  for (const [c, n] of sorted) {
    // 粗判冷暖：R 明显大于 B 视为暖色
    let tag = '';
    const hex = c.match(/^#([0-9a-f]{6})/);
    if (hex) {
      const r = parseInt(hex[1].slice(0, 2), 16);
      const g = parseInt(hex[1].slice(2, 4), 16);
      const b = parseInt(hex[1].slice(4, 6), 16);
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      if (lum > 200) tag = '  ← 亮色';
      else if (lum < 60) tag = '  ← 深色';
      else if (r > b + 20) tag = '  ← 暖色';
      else if (b > r + 20) tag = '  ← 冷色';
    }
    console.log(`  ${c.padEnd(30)} ×${String(n).padStart(3)}${tag}`);
  }
}
