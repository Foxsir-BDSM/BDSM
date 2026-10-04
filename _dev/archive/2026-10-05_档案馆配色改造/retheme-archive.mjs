#!/usr/bin/env node
/**
 * tools/retheme-archive.mjs —— 把档案馆三个样式从浅色靛蓝主题改为暗金主题
 *
 * 【做法】统一映射到与 modules/content/css/content.css 同源的色板，
 *        保证全站视觉一致，而不是各自调色。
 *
 * 【目标色板】（与 content.css 对齐）
 *   背景        #0f0e17
 *   卡片        rgba(255,255,255,0.024)
 *   边框        rgba(255,255,255,0.05)
 *   主色（金）  #d4a574 / 浅金 #f5d6a8
 *   正文        rgba(255,255,255,0.72)
 *   次要文字    rgba(255,255,255,0.32)
 *
 * 【为什么用"长串优先"替换】
 *   先替换 rgba(74,111,165,0.08)，再替换单薄的 #4a6fa5，
 *   否则前者会被后者先命中而破坏。
 *
 * 用法：
 *   node tools/retheme-archive.mjs --dry   只看将替换什么
 *   node tools/retheme-archive.mjs         实际写入
 */
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');

const FILES = [
  'src/modules/sub-archive/css/global.css',
  'src/modules/sub-archive/css/home.css',
  'src/modules/sub-archive/css/detail.css',
];

/** 映射表：源色 → 目标色。按源色字符串长度降序应用。 */
const MAP = {
  // ── 品牌色：靛蓝 → 暖金 ──
  '#4f46e5': '#d4a574',
  '#6366f1': '#d4a574',
  '#4338ca': '#c9974f',
  '#c7d2fe': 'rgba(212,165,116,0.35)',
  '#e0e7ff': 'rgba(212,165,116,0.16)',
  '#eef2ff': 'rgba(212,165,116,0.10)',
  'rgba(79,70,229,0.15)': 'rgba(212,165,116,0.16)',
  'rgba(79,70,229,0.08)': 'rgba(212,165,116,0.10)',
  'rgba(74,111,165,0.08)': 'rgba(212,165,116,0.10)',
  '#4a6fa5': '#d4a574',

  // ── 背景：白 / 浅灰 → 深底 ──
  '#ffffff': '#0f0e17',
  '#fff': '#0f0e17',
  '#f5f7fa': '#0f0e17',
  '#f9fafc': '#0f0e17',
  '#f8fafc': '#0f0e17',
  '#f1f5f9': 'rgba(255,255,255,0.024)',
  '#f0f0f0': 'rgba(255,255,255,0.024)',

  // ── 边框 / 分隔：浅灰 → 半透明白 ──
  '#e5e7eb': 'rgba(255,255,255,0.07)',
  '#e2e8f0': 'rgba(255,255,255,0.07)',
  '#cbd5e1': 'rgba(255,255,255,0.10)',

  // ── 文字：深灰 → 浅色 ──
  '#222222': 'rgba(255,255,255,0.92)',
  '#2d3748': 'rgba(255,255,255,0.78)',
  '#334155': 'rgba(255,255,255,0.62)',
  '#4a5568': 'rgba(255,255,255,0.50)',
  '#555555': 'rgba(255,255,255,0.45)',
  '#64748b': 'rgba(255,255,255,0.42)',
  '#94a3b8': 'rgba(255,255,255,0.32)',
  '#888888': 'rgba(255,255,255,0.34)',
  '#888': 'rgba(255,255,255,0.34)',
  '#aaaaaa': 'rgba(255,255,255,0.28)',

  // ── 阴影：不透明黑 → 透明黑（深底上不刺眼）──
  'rgba(0,0,0,0.04)': 'rgba(0,0,0,0.30)',
  'rgba(0,0,0,0.06)': 'rgba(0,0,0,0.35)',
  'rgba(0,0,0,0.08)': 'rgba(0,0,0,0.40)',
};

const entries = Object.entries(MAP).sort((a, b) => b[0].length - a[0].length);

console.log('════ 档案馆配色改造 ════════\n');
console.log(`  文件 ${FILES.length} 个，映射规则 ${entries.length} 条\n`);

for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log(`  · 跳过（不存在）${f}`); continue; }
  const before = fs.readFileSync(f, 'utf8');
  let after = before;
  const hits = {};

  for (const [from, to] of entries) {
    // 用全局替换统计次数
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const n = (after.match(re) || []).length;
    if (n) { hits[from] = n; after = after.replace(re, to); }
  }

  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  console.log(`  ${f}`);
  console.log(`     替换 ${total} 处，涉及 ${Object.keys(hits).length} 种颜色`);
  Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .forEach(([c, n]) => console.log(`       ${c.padEnd(24)} ×${n}  →  ${MAP[c]}`));

  if (!DRY) fs.writeFileSync(f, after, 'utf8');
}

console.log(`\n  ${DRY ? '（试运行，未写入）' : '已写入'}`);
