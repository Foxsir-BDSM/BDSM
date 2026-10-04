#!/usr/bin/env node
/**
 * tools/clean-archived-refs.mjs —— 清理工具脚本里对已归档文件的引用
 *
 * 背景：src/modules/sub-archive/admin.html 及其 js/css 已归档到
 *       _dev/archive/2026-10-05_遗留后台归档/，
 *       但若干生成器与爬虫的清单里仍写着它，会让生成的文档失准。
 *
 * 用法：node tools/clean-archived-refs.mjs --dry   只看将改什么
 */
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');

// 每项：[文件, 原文本, 新文本]
const EDITS = [
  ['tools/add-file-headers.mjs',
    "pages: '档案馆后台 /modules/sub-archive/admin.html',",
    "pages: '（已归档）档案馆后台曾位于 /modules/sub-archive/admin.html，现统一走 /admin.html',"],

  ['tools/crawl.mjs',
    "  '/modules/sub-archive/admin.html',\n",
    ""],

  ['tools/gen-feature-table.mjs',
    "  [M.sub, 'admin.html', '⚠️ 废弃页面', '旧版独立后台，中文曾损坏、导入不存在的模块（死文件）', '/modules/sub-archive/admin.html'],\n",
    ""],
];

let changed = 0;
for (const [file, from, to] of EDITS) {
  if (!fs.existsSync(file)) { console.log(`  · 跳过（不存在）${file}`); continue; }
  const t = fs.readFileSync(file, 'utf8');
  if (!t.includes(from)) { console.log(`  · 未匹配 ${file}`); continue; }
  if (DRY) { console.log(`  → 将修改 ${file}`); changed++; continue; }
  fs.writeFileSync(file, t.replace(from, to), 'utf8');
  console.log(`  ✓ ${file}`);
  changed++;
}
console.log(`\n  ${DRY ? '将修改' : '已修改'} ${changed} 个文件`);

// 剩余引用体检
console.log('\n── 仍提及 sub-archive/admin 的工具文件 ──');
const TOOLS = ['add-file-headers.mjs', 'crawl.mjs', 'gen-feature-table.mjs', 'gen-maintenance-table.mjs'];
for (const f of TOOLS) {
  const p = 'tools/' + f;
  if (!fs.existsSync(p)) continue;
  const hits = fs.readFileSync(p, 'utf8').split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /sub-archive[\/\\]admin/.test(l));
  if (hits.length) {
    console.log(`  ${f}:`);
    hits.forEach(([n, l]) => console.log(`     L${n}: ${l.trim().slice(0, 96)}`));
  }
}
