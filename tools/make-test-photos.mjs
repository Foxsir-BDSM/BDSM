#!/usr/bin/env node
/**
 * tools/make-test-photos.mjs —— 生成两张测试封面（一白一黑）
 * 用途：验证毛玻璃条在亮/暗照片上是否都清晰可读。
 * 输出：.shots/runtime/test-cover-light.svg / test-cover-dark.svg
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

/** 生成带纹理的照片占位（纯色看不出毛玻璃效果，故加入条纹与色块） */
function makeSvg(base, ink, label) {
  const stripes = Array.from({ length: 14 }, (_, i) => {
    const y = i * 30;
    const op = (i % 2 === 0) ? 0.10 : 0.04;
    return `<rect x='0' y='${y}' width='300' height='16' fill='${ink}' opacity='${op}'/>`;
  }).join('');
  const dots = Array.from({ length: 26 }, (_, i) => {
    const x = ((i * 47) % 280) + 10;
    const y = ((i * 83) % 360) + 10;
    const r = 3 + (i % 4) * 2;
    return `<circle cx='${x}' cy='${y}' r='${r}' fill='${ink}' opacity='0.14'/>`;
  }).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'>` +
    `<rect width='300' height='400' fill='${base}'/>` +
    stripes + dots +
    `<text x='150' y='190' font-family='sans-serif' font-size='26' font-weight='700' ` +
    `fill='${ink}' opacity='0.55' text-anchor='middle'>${label}</text>` +
    `</svg>`;
}

const files = [
  ['test-cover-light.svg', makeSvg('#f2f0ec', '#1a1a1a', '亮底照片')],
  ['test-cover-dark.svg', makeSvg('#1b1a20', '#ffffff', '暗底照片')],
];

for (const [name, svg] of files) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, svg, 'utf8');
  console.log(`  ✅ ${p}  (${svg.length} B)`);
}
