#!/usr/bin/env node
// tools/debug-import-check.mjs —— 调试「缺漏导入检查」的判定
import fs from 'node:fs';

const FILE = process.argv[2] || 'src/modules/sub-archive/js/home.js';
const NAME = process.argv[3] || 'CARD_FIELDS';

const src = fs.readFileSync(FILE, 'utf8');

// 与 check-missing-imports.mjs 保持一致
function stripNoise(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

const code = stripNoise(src);

console.log('════════ 缺漏导入判定调试 ════════\n');
console.log(`  文件: ${FILE}`);
console.log(`  符号: ${NAME}\n`);
console.log(`  原始长度: ${src.length}   清洗后长度: ${code.length}`);

// 清洗后是否还能找到该符号
const re = new RegExp(`(?<![.\\w])${NAME}(?![\\w$])`, 'g');
const hits = [...code.matchAll(re)];
console.log(`  清洗后出现次数: ${hits.length}\n`);

hits.forEach((m, i) => {
  const before = code.slice(Math.max(0, m.index - 40), m.index);
  const after = code.slice(m.index + NAME.length, m.index + NAME.length + 40);
  const asKey = new RegExp(`(?<![.\\w])${NAME}:(?![=:])`).test(code);
  console.log(`   [${i + 1}] @${m.index}`);
  console.log(`       前 40 字符: ${JSON.stringify(before)}`);
  console.log(`       后 40 字符: ${JSON.stringify(after)}`);
  console.log(`       该符号后是否紧跟冒号(键名判定): ${/^\s*:(?![=:])/.test(after)}`);
  void asKey;
});

// 原始文件里的出现位置（对照）
const rawHits = [...src.matchAll(new RegExp(`(?<![.\\w])${NAME}(?![\\w$])`, 'g'))];
console.log(`\n  原始文件出现次数: ${rawHits.length}`);
rawHits.forEach((m, i) => {
  const line = src.slice(0, m.index).split('\n').length;
  const lineText = src.split('\n')[line - 1].trim();
  console.log(`   [${i + 1}] L${line}: ${lineText.slice(0, 100)}`);
});

console.log('\n  ── 判定结果 ──');
const asObjectKey = new RegExp(`(?<![.\\w])${NAME}:(?![=:])`).test(code);
const asStandalone = new RegExp(`(?<![.\\w])${NAME}(?![\\w$])`).test(code);
console.log(`   asObjectKey  = ${asObjectKey}`);
console.log(`   asStandalone = ${asStandalone}`);
console.log(`   → used = ${asStandalone && !asObjectKey}`);

const imported = new Set();
for (const mm of src.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
  mm[1].split(',').forEach((x) => {
    const n = x.trim().split(/\s+as\s+/).pop().trim();
    if (n) imported.add(n);
  });
}
for (const mm of src.matchAll(/import\s+(\w+)\s+from/g)) imported.add(mm[1]);
const declared = new Set();
for (const mm of code.matchAll(/(?:export\s+)?(?:const|let|var|function|class)\s+(\w+)/g)) declared.add(mm[1]);
for (const mm of code.matchAll(/\b(?:get|set)\s+(\w+)\s*\(/g)) declared.add(mm[1]);

console.log(`   imported.has = ${imported.has(NAME)}`);
console.log(`   declared.has = ${declared.has(NAME)}`);
console.log(`   → 最终是否报错 = ${asStandalone && !asObjectKey && !imported.has(NAME) && !declared.has(NAME)}`);
