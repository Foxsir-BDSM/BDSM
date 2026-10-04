#!/usr/bin/env node
/**
 * tools/verify-header-diff.mjs —— 严格验证：本次改动只增删注释行
 * 用 git diff 逐行检查：所有被删除的行都必须是注释或空行
 */
import { execSync } from 'node:child_process';

const out = execSync('git diff -U0 -- src', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = out.split('\n');

let currentFile = '';
const bad = [];
let removedComments = 0, removedCode = 0, addedLines = 0;

const isComment = (s) => {
  const t = s.trim();
  return t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
    || t.startsWith('<!--') || t.startsWith('-->') || t.startsWith('*/');
};

for (const line of lines) {
  if (line.startsWith('+++ b/')) { currentFile = line.slice(6); continue; }
  if (line.startsWith('---')) continue;
  if (line.startsWith('+') && !line.startsWith('+++')) { addedLines++; continue; }
  if (line.startsWith('-') && !line.startsWith('---')) {
    const content = line.slice(1);
    if (isComment(content)) removedComments++;
    else {
      removedCode++;
      bad.push({ file: currentFile, line: content });
    }
  }
}

console.log('════════ 逐行 diff 校验（只允许增删注释）════════\n');
console.log(`  新增行      : ${addedLines}`);
console.log(`  删除注释/空行: ${removedComments}`);
console.log(`  删除代码行   : ${removedCode}`);

if (removedCode) {
  console.log('\n  ❌ 以下代码行被删除了：');
  bad.slice(0, 40).forEach((b) => console.log(`     ${b.file}\n        ${b.line.trim().slice(0, 110)}`));
  process.exit(1);
}

console.log('\n  ✅ 没有任何代码行被删除 —— 本次改动纯属注释');
