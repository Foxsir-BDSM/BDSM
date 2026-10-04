#!/usr/bin/env node
/**
 * tools/diagnose-csv-encoding.mjs —— 诊断 CSV 编码问题（只读）
 *
 * 判定逻辑：
 *   · 文件是 UTF-8 但无 BOM → Excel 按 ANSI(GBK) 读 → 显示乱码
 *   · 修复方式：加 UTF-8 BOM（不改字节内容）
 *   同时检查是否存在真正的坏字节（U+FFFD）或半截多字节序列
 *
 * 用法: node tools/diagnose-csv-encoding.mjs "F:\path\to\file.csv"
 */
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('用法: node tools/diagnose-csv-encoding.mjs <csv路径>');
  process.exit(1);
}

const buf = fs.readFileSync(file);
console.log('════════ CSV 编码诊断 ════════\n');
console.log(`  文件: ${path.basename(file)}`);
console.log(`  大小: ${(buf.length / 1024).toFixed(1)} KB`);

// ── BOM 检查
const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
const isUtf16 = (buf[0] === 0xFF && buf[1] === 0xFE) || (buf[0] === 0xFE && buf[1] === 0xFF);
console.log(`\n  前 4 字节: ${[...buf.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
console.log(`  UTF-8 BOM: ${hasBom ? '有' : '❌ 无'}`);
console.log(`  UTF-16 BOM: ${isUtf16 ? '有' : '无'}`);

// ── 用 TextDecoder 严格模式验证是否合法 UTF-8
let validUtf8 = true;
try {
  new TextDecoder('utf-8', { fatal: true }).decode(buf);
} catch (e) {
  validUtf8 = false;
  console.log(`\n  ❌ 不是合法 UTF-8: ${e.message}`);
}
console.log(`  合法 UTF-8: ${validUtf8 ? '✅ 是' : '否'}`);

// ── 解码看内容
const text = new TextDecoder('utf-8').decode(buf);
const lines = text.split(/\r?\n/);
console.log(`\n  总行数: ${lines.length}（含空行）`);
console.log(`  数据行: ${lines.filter((l) => l.trim()).length - 1}`);

// ── U+FFFD 替换字符（真正的坏字节标志）
const fffd = (text.match(/\uFFFD/g) || []).length;
console.log(`\n  U+FFFD（真乱码标志）: ${fffd} ${fffd === 0 ? '✅ 无坏字节' : '❌ 存在坏字节'}`);

// ── 表头与前两行数据
console.log('\n  ── 表头 ──');
console.log('  ' + (lines[0] || '').slice(0, 200));
console.log('\n  ── 前 2 行数据 ──');
lines.slice(1, 3).forEach((l, i) => {
  if (l.trim()) console.log(`  [${i + 1}] ${l.slice(0, 180)}`);
});

// ── 中文可读性抽样
console.log('\n  ── 中文抽样（若能正常显示说明解码正确）──');
const sample = lines.slice(1, 4).join(' ').match(/[\u4e00-\u9fa5]{2,}/g) || [];
console.log('  ' + (sample.slice(0, 12).join(' / ') || '(未找到中文)'));

// ── 结论
console.log('\n════════ 结论 ════════');
if (validUtf8 && fffd === 0 && !hasBom) {
  console.log('  ✅ 文件内容本身完全正确（合法 UTF-8，无坏字节）');
  console.log('  ❌ 缺少 UTF-8 BOM —— Excel 会按系统 ANSI(GBK) 解读，于是显示乱码');
  console.log('\n  修复：加 UTF-8 BOM 另存一份（字节内容不变，仅前置 EF BB BF）');
  console.log('        node tools/fix-csv-bom.mjs "<文件路径>"');
} else if (validUtf8 && fffd === 0 && hasBom) {
  console.log('  ✅ 文件已是带 BOM 的 UTF-8，Excel 应能正常打开');
  console.log('     若仍乱码，说明是 Excel 的导入设置问题（用「数据→从文本导入」手动选 UTF-8）');
} else {
  console.log('  ⚠️ 文件存在真实编码问题，需要进一步分析');
}
