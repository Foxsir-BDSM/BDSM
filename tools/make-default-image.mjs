#!/usr/bin/env node
/**
 * tools/make-default-image.mjs —— 重做占位图为暗金配色
 *
 * 背景：原占位图是内联 base64 SVG，硬编码 fill='#E5E7EB'（亮灰底）+
 *       '#999'（灰字）。它不受 CSS 影响，所以在把档案馆改成暗色主题后，
 *       卡片封面仍是一大片刺眼的白块。
 *
 * 新图配色与全站暗金主题一致：
 *   底 #1a1822（卡片面）／描边 #d4a574 低透明／文字 rgba(255,255,255,0.3)
 *
 * 用法：
 *   node tools/make-default-image.mjs            输出新的 data URI
 *   node tools/make-default-image.mjs --write    直接写回 api.js
 */
import fs from 'node:fs';

const WRITE = process.argv.includes('--write');
const TARGET = 'src/shared/config/archive/api.js';

// 与全站一致：背景 #0f0e17，卡片面略亮，主色 #d4a574
const svg =
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'>" +
  "<rect width='300' height='400' fill='#1a1822'/>" +
  "<rect x='24' y='24' width='252' height='352' rx='14' fill='none' " +
  "stroke='#d4a574' stroke-opacity='0.22' stroke-width='1.5' stroke-dasharray='7 7'/>" +
  "<text x='50%' y='50%' font-family='sans-serif' font-size='19' " +
  "fill='#d4a574' fill-opacity='0.45' text-anchor='middle' dy='.3em'>暂无图片</text>" +
  '</svg>';

const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');

console.log('════ 占位图重建 ════════\n');
console.log('  SVG 长度:      ' + svg.length);
console.log('  dataURI 长度:  ' + dataUri.length + '（原 378）');
console.log('  配色:          底 #1a1822 ／ 描边 #d4a574@22% ／ 文字 #d4a574@45%');
console.log('');

if (!WRITE) {
  console.log('  新值:');
  console.log('  ' + dataUri);
  console.log('\n  加 --write 可直接写回 ' + TARGET);
  process.exit(0);
}

const src = fs.readFileSync(TARGET, 'utf8');
const re = /(export const DEFAULT_IMAGE\s*=\s*)'[^']*'/;
if (!re.test(src)) {
  console.error('  ✗ 未在 ' + TARGET + ' 中找到 DEFAULT_IMAGE 的赋值');
  process.exit(1);
}
fs.writeFileSync(TARGET, src.replace(re, `$1'${dataUri}'`), 'utf8');
console.log('  ✅ 已写回 ' + TARGET);

// 回读校验
const after = fs.readFileSync(TARGET, 'utf8');
const m = after.match(/DEFAULT_IMAGE\s*=\s*'([^']+)'/);
const decoded = Buffer.from(m[1].replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');
console.log('  回读校验: ' + (decoded.includes('#1a1822') ? '✅ 已是暗色底' : '✗ 未生效'));
