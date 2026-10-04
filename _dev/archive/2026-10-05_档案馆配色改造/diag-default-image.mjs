#!/usr/bin/env node
/**
 * tools/diag-default-image.mjs —— 解码 api.js 里的 DEFAULT_IMAGE 占位图 SVG
 */
import fs from 'node:fs';

const t = fs.readFileSync('src/shared/config/archive/api.js', 'utf8');
const m = t.match(/DEFAULT_IMAGE\s*=\s*['"]([^'"]+)['"]/);
if (!m) {
  console.log('  未匹配到 DEFAULT_IMAGE');
  process.exit(0);
}
const raw = m[1];
console.log(`  值前缀: ${raw.slice(0, 46)}…`);
console.log(`  长度:   ${raw.length}`);

const b64 = raw.replace(/^data:image\/svg\+xml;base64,/, '');
try {
  const svg = Buffer.from(b64, 'base64').toString('utf8');
  console.log('\n  ── SVG 内容 ──');
  console.log('  ' + svg.replace(/></g, '>\n  <'));
  console.log('\n  ── 用到的颜色 ──');
  const colors = [...svg.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((x) => x[0]);
  console.log('  ' + (colors.join(', ') || '（无）'));
} catch (e) {
  console.log('  ✗ 解码失败: ' + e.message);
  console.log('  原文: ' + raw.slice(0, 200));
}
