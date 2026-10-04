#!/usr/bin/env node
/**
 * tools/retheme-archive2.mjs —— 档案馆配色改造（第二轮：收尾色）
 *
 * 第一轮处理了主色与背景，这一轮处理剩下的：
 *   · 石板色系的深蓝调（#0f172a / #1e293b）—— 原用作"正文色"，
 *     在深底上要反过来变成浅色文字
 *   · 浅灰分隔线（#d1d5db / #f1f4f9）
 *   · 杂色渐变（紫 #a855f7 / 粉 #ec4899 / 蓝 #3b82f6）—— 统一到暖金
 *   · 残留的白底（#faf5ff / #f8fafc / #e2e8f0 / #cbd5e1）
 *
 * 用法：node tools/retheme-archive2.mjs [--dry]
 */
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const FILES = [
  'src/modules/sub-archive/css/global.css',
  'src/modules/sub-archive/css/home.css',
  'src/modules/sub-archive/css/detail.css',
];

const MAP = {
  // 石板深蓝 → 浅色文字（原为浅底上的正文色）
  '#0f172a': 'rgba(255,255,255,0.92)',
  '#1e293b': 'rgba(255,255,255,0.78)',
  '#1e1b4b': 'rgba(255,255,255,0.85)',
  '#0f0f0f': 'rgba(255,255,255,0.92)',

  // 浅灰分隔 / 底色
  '#d1d5db': 'rgba(255,255,255,0.10)',
  '#e9edf4': 'rgba(255,255,255,0.07)',
  '#f1f4f9': 'rgba(255,255,255,0.024)',
  '#faf5ff': 'rgba(212,165,116,0.08)',
  '#f8fafc': 'rgba(255,255,255,0.024)',
  '#e2e8f0': 'rgba(255,255,255,0.07)',
  '#cbd5e1': 'rgba(255,255,255,0.10)',
  '#f0d5b0': '#f5d6a8',
  '#f5ddc0': '#f5d6a8',
  '#e2be96': '#e0b884',
  '#dbb58a': '#d4a574',
  '#2d1f14': 'rgba(255,255,255,0.92)',

  // 杂色 → 暖金（渐变里混入的紫/粉/蓝）
  '#a855f7': '#e0b884',
  '#ec4899': '#d4a574',
  '#3b82f6': '#d4a574',
  'rgba(59,130,246,0.15)': 'rgba(212,165,116,0.16)',
  'rgba(59,130,246,0.08)': 'rgba(212,165,116,0.10)',

  // 残留语义色：保留红（警示）与绿（通过），但去掉蓝紫
  '#999999': 'rgba(255,255,255,0.32)',
  '#999': 'rgba(255,255,255,0.32)',

  // 阴影统一
  'rgba(0, 0, 0, 0.06)': 'rgba(0,0,0,0.35)',
  'rgba(0, 0, 0, 0.08)': 'rgba(0,0,0,0.40)',
  'rgba(0, 0, 0, 0.04)': 'rgba(0,0,0,0.30)',
  'rgba(0, 0, 0, 0.1)': 'rgba(0,0,0,0.42)',
  'rgba(0, 0, 0, 0.15)': 'rgba(0,0,0,0.48)',
  'rgba(0, 0, 0, 0.2)': 'rgba(0,0,0,0.52)',
};

const entries = Object.entries(MAP).sort((a, b) => b[0].length - a[0].length);

console.log('════ 档案馆配色改造（第二轮）════════\n');

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let t = fs.readFileSync(f, 'utf8');
  const hits = {};
  for (const [from, to] of entries) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const n = (t.match(re) || []).length;
    if (n) { hits[from] = n; t = t.replace(re, to); }
  }
  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  console.log(`  ${f}  替换 ${total} 处`);
  Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([c, n]) => console.log(`     ${c.padEnd(22)} ×${n}  →  ${MAP[c]}`));
  if (!DRY && total) fs.writeFileSync(f, t, 'utf8');
}
console.log(`\n  ${DRY ? '（试运行）' : '已写入'}`);
