#!/usr/bin/env node
/**
 * tools/audit-colors.mjs —— 盘点各页面的配色，找出偏离暗金主题的地方
 *
 * 全站基调：背景 #0f0e17，主色 #d4a574（暖金），文字 #fffffe
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const walk = (dir, ext, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
};

const files = walk(ROOT, ['.css']).sort();

console.log('════ 各样式文件的配色盘点 ════\n');
console.log('  基准：背景 #0f0e17 ／ 主色 #d4a574（暖金）／ 文字 #fffffe\n');

const rows = [];
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/').replace('src/', '');

  // 背景色（body / :root 里的深色）
  const bgs = [...css.matchAll(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => m[1].toLowerCase());
  const bgCount = {};
  bgs.forEach((b) => { bgCount[b] = (bgCount[b] || 0) + 1; });

  // 是否出现金色主色
  const gold = (css.match(/#d4a574|#f5d6a8|#e0b884|#c9974f/gi) || []).length;

  // 是否出现明显偏离的冷色（蓝紫青）作为主色调
  const cool = (css.match(/#(?:[0-9a-f]{2})?(?:5b8|6b9|4a9|3b82f6|6366f1|8b5cf6|22d3ee|0ea5e9|38bdf8)/gi) || []).length;

  // 浅色背景（接近白）
  const light = [...css.matchAll(/background(?:-color)?:\s*(#f[0-9a-f]{2}|#e[0-9a-f]{5}|white|rgba\(255,\s*255,\s*255,\s*0\.[6-9])/gi)].length;

  const topBg = Object.entries(bgCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, n]) => `${c}×${n}`).join(' ');

  rows.push({ rel, gold, cool, light, topBg, size: css.length });
}

// 按「金色占比」排序，金色少的排前面（最需要处理）
rows.sort((a, b) => (a.gold / (a.size / 1000)) - (b.gold / (b.size / 1000)));

console.log(`  ${'文件'.padEnd(40)} ${'金色'.padStart(4)} ${'冷色'.padStart(4)} ${'浅底'.padStart(4)}  主要背景`);
console.log('  ' + '─'.repeat(96));
for (const r of rows) {
  const flag = r.gold === 0 ? '🔴' : r.gold < 5 ? '🟡' : '✅';
  console.log(`  ${flag} ${r.rel.padEnd(37)} ${String(r.gold).padStart(4)} ${String(r.cool).padStart(4)} ${String(r.light).padStart(4)}  ${r.topBg.slice(0, 34)}`);
}

console.log('\n── 判读 ──');
const noGold = rows.filter((r) => r.gold === 0);
const lightBg = rows.filter((r) => r.light > 0);
console.log(`  🔴 完全没有金色主色的文件: ${noGold.length} 个`);
noGold.forEach((r) => console.log(`       ${r.rel}`));
if (lightBg.length) {
  console.log(`  ⚠️ 含浅色背景的文件: ${lightBg.length} 个`);
  lightBg.forEach((r) => console.log(`       ${r.rel}（${r.light} 处）`));
}
