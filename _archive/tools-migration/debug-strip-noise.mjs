#!/usr/bin/env node
// tools/debug-strip-noise.mjs —— 逐步查看 stripNoise 每一步删掉了什么
import fs from 'node:fs';

const FILE = process.argv[2] || 'src/modules/sub-archive/js/home.js';
const src = fs.readFileSync(FILE, 'utf8');

const steps = [
  ['① 去块注释 /* */', (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')],
  ['② 去行注释 //', (s) => s.replace(/^\s*\/\/.*$/gm, '')],
  ['③ 去双引号字符串', (s) => s.replace(/"(?:\\.|[^"\\])*"/g, '""')],
  ['④ 去反引号字符串', (s) => s.replace(/`(?:\\.|[^`\\])*`/g, '``')],
];

console.log('════════ stripNoise 逐步分析 ════════\n');
console.log(`  文件: ${FILE}`);
console.log(`  原始: ${src.length} 字符\n`);

let cur = src;
steps.forEach(([label, fn]) => {
  const next = fn(cur);
  const delta = next.length - cur.length;
  console.log(`  ${label.padEnd(22)} ${String(cur.length).padStart(6)} → ${String(next.length).padStart(6)}  (${delta >= 0 ? '+' : ''}${delta})`);
  cur = next;
});

console.log(`\n  最终: ${cur.length} 字符\n`);

// 找出被删掉的大块
console.log('  ── 最终结果里是否还有关键代码 ──');
['CARD_FIELDS', 'renderAllCards', 'isPublic', 'getFieldValue', 'fetchRecordsPage'].forEach((k) => {
  const n = (cur.match(new RegExp(k, 'g')) || []).length;
  const rawN = (src.match(new RegExp(k, 'g')) || []).length;
  console.log(`   ${k.padEnd(20)} 原始 ${String(rawN).padStart(3)}  清洗后 ${String(n).padStart(3)}  ${n === 0 && rawN > 0 ? '← 被吃掉了' : ''}`);
});

// 定位第一处被过度删除的位置
console.log('\n  ── 逐步法定位：找出第 ②、③、④ 步的越界删除 ──');
let c1 = steps[0][1](src);
let c2 = steps[1][1](c1);
let c3 = steps[2][1](c2);
let c4 = steps[3][1](c3);

const findFirstDivergence = (before, after, label) => {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  const ctx = before.slice(Math.max(0, i - 60), i + 120);
  console.log(`\n  [${label}] 首个差异位置 @${i}`);
  console.log(`    上下文: ${JSON.stringify(ctx.slice(0, 180))}`);
};

findFirstDivergence(c2, c3, '③ 去双引号');
findFirstDivergence(c3, c4, '④ 去反引号');
