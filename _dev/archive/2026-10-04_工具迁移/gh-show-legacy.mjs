#!/usr/bin/env node
/**
 * tools/gh-show-legacy.mjs —— 查看旧内容的原文，用于确定迁移映射
 */
import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('_dev/docs/数据表/legacy-content.json', 'utf8'));

const only = process.argv[2];
const files = only ? j.files.filter((f) => f.name.includes(only)) : j.files;

for (const f of files) {
  console.log('═'.repeat(72));
  console.log(`  来源: ${f.branch}/${f.path}`);
  console.log('═'.repeat(72));
  console.log(f.content);
  console.log('');
}

// 汇总 frontmatter 字段
console.log('─'.repeat(72));
console.log('  各文件的 frontmatter 字段汇总');
console.log('─'.repeat(72));
const keys = new Set();
j.files.forEach((f) => {
  const m = f.content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) { console.log(`  ${f.name}: (无 frontmatter)`); return; }
  const ks = m[1].split('\n').map((l) => l.split(':')[0].trim()).filter(Boolean);
  ks.forEach((k) => keys.add(k));
  const hasJson = /```json/.test(f.content);
  console.log(`  ${f.name.padEnd(30)} 字段: ${ks.join(', ')}${hasJson ? '  [含 JSON 区块]' : ''}`);
});
console.log(`\n  全部出现过的字段: ${[...keys].join(', ')}`);
