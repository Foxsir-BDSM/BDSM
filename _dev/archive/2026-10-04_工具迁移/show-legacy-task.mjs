#!/usr/bin/env node
/**
 * tools/show-legacy-task.mjs —— 完整显示指定旧任务的正文，便于人工拆解
 */
import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('_dev/docs/数据表/legacy-content.json', 'utf8'));
const key = process.argv[2];
const f = j.files.find((x) => x.name.includes(key));
if (!f) {
  console.log('未找到，可用文件:');
  j.files.forEach((x) => console.log('  · ' + x.name));
  process.exit(1);
}
const m = f.content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
console.log(`来源: ${f.branch}/${f.path}`);
console.log(`标题: ${(m[1].match(/title:\s*(.*)/) || [])[1]}`);
console.log(`分类: ${(m[1].match(/category:\s*(.*)/) || [])[1]}`);
console.log('─'.repeat(70));
console.log(m[2].trim());
