#!/usr/bin/env node
// tools/inspect-table.mjs —— 检查生成的对照表质量
import fs from 'node:fs';

const p = 'docs/文件维护对照表.csv';
const buf = fs.readFileSync(p);
console.log('════════ 对照表质量检查 ════════\n');
console.log(`  文件: ${p}`);
console.log(`  BOM : ${buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF ? '✅ 有（Excel 可直接打开）' : '❌ 无'}`);

const text = buf.toString('utf8').replace(/^\uFEFF/, '');
const lines = text.split(/\r?\n/).filter((l) => l.trim());
console.log(`  行数: ${lines.length}（含表头）`);

// 用简单 CSV 解析（处理引号）
function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const HEAD = parseCsvLine(lines[0]);
console.log(`\n  表头（${HEAD.length} 列）:`);
HEAD.forEach((h, i) => console.log(`    ${i + 1}. ${h}`));

const rows = lines.slice(1).map(parseCsvLine);
console.log(`\n  数据行: ${rows.length}`);

// 列数一致性
const badCols = rows.filter((r) => r.length !== HEAD.length);
console.log(`  列数异常行: ${badCols.length} ${badCols.length ? '❌' : '✅'}`);
if (badCols.length) badCols.slice(0, 3).forEach((r) => console.log(`     ${r.length} 列: ${r[0]}`));

// 待补充统计
const todo = rows.filter((r) => r[4] === '（待补充）' || r[5] === '（待补充）');
console.log(`  「待补充」行: ${todo.length} ${todo.length ? '⚠️' : '✅'}`);
if (todo.length) todo.slice(0, 8).forEach((r) => console.log(`     ${r[0]}`));

// 样例
console.log('\n  ── 样例（档案馆核心文件）──');
rows.filter((r) => /sub-archive\/js\/(home|api|config)\.js$/.test(r[0])).forEach((r) => {
  console.log(`\n  ◆ ${r[0]}`);
  HEAD.forEach((h, i) => { if (r[i]) console.log(`      ${h}: ${r[i].slice(0, 100)}`); });
});

// 高影响面
console.log('\n  ── 被依赖最多（改动需谨慎）──');
const withFan = rows.map((r) => ({ f: r[0], by: r[8] })).filter((x) => x.by && x.by !== '—' && x.by !== '（页面，不被引用）');
withFan.sort((a, b) => b.by.split('、').length - a.by.split('、').length).slice(0, 8)
  .forEach((x) => console.log(`     ${String(x.by.split('、').length).padStart(2)}  ${x.f}`));
