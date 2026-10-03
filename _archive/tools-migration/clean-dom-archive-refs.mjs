#!/usr/bin/env node
/**
 * tools/clean-dom-archive-refs.mjs
 * 从验证工具中清除已合并删除的 dom-archive 引用
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);

const edits = [
  // crawl.mjs：移除 dom-archive 页面
  ['tools/crawl.mjs',
    "  '/modules/dom-archive/index.html',\n", ''],

  // runtime-check.mjs：移除 dom-archive 用例
  ['tools/runtime-check.mjs',
    "  ['/modules/dom-archive/index.html', ['上位档案馆'], false],\n", ''],

  // smoke.mjs：移除两条 dom-archive 用例
  ['tools/smoke.mjs',
    "  ['/modules/dom-archive/', '上位档案馆'],\n  ['/modules/dom-archive/index.html', '建设中'],\n", ''],
];

let n = 0;
for (const [file, from, to] of edits) {
  const f = rel(file);
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(from)) { console.log('  · 未命中: ' + file); continue; }
  t = t.split(from).join(to);
  fs.writeFileSync(f, t, 'utf8');
  console.log('  ✓ 已清理: ' + file);
  n++;
}

// report-*.mjs：把"切到 dom-archive 之前"改为"切到统一导出之前"
for (const file of ['tools/report-status.mjs', 'tools/report-groups.mjs', 'tools/report-fieldcount.mjs']) {
  const f = rel(file);
  let t = fs.readFileSync(f, 'utf8');
  const before = t;
  t = t.split(`t.indexOf("id: 'dom-archive'")`).join(`t.indexOf('// 统一导出')`);
  t = t.split(`t.indexOf("id: 'dom-archive'")`).join(`t.indexOf('// 统一导出')`);
  // 移除状态报告里专门讲 dom-archive 的段落
  t = t.replace(/\nconsole\.log\('  【上位者档案馆 dom-archive】'\);[\s\S]*?console\.log\(''\);\n/, '\n');
  if (t !== before) {
    fs.writeFileSync(f, t, 'utf8');
    console.log('  ✓ 已更新: ' + file);
    n++;
  } else {
    console.log('  · 未命中: ' + file);
  }
}

console.log(`\n共处理 ${n} 个文件`);
