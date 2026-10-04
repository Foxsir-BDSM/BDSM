#!/usr/bin/env node
/**
 * tools/fix-csv-bom.mjs —— 为 CSV 添加 UTF-8 BOM，解决 Excel 打开乱码
 *
 * 原理：文件本身是合法 UTF-8，但缺少 BOM 时 Excel 会按系统 ANSI(GBK) 解读，
 *       于是显示成「濮撳悕」这类乱码。前置 EF BB BF 即可让 Excel 正确识别。
 *
 * 安全：默认另存为新文件，不覆盖原文件。加 --in-place 才原地修改。
 *
 * 用法:
 *   node tools/fix-csv-bom.mjs "<原文件>"
 *   node tools/fix-csv-bom.mjs "<原文件>" --in-place
 *   node tools/fix-csv-bom.mjs "<原文件>" --out "<输出路径>"
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const src = args[0];
if (!src || !fs.existsSync(src)) {
  console.error('用法: node tools/fix-csv-bom.mjs <csv路径> [--in-place | --out <路径>]');
  process.exit(1);
}

const inPlace = args.includes('--in-place');
const outIdx = args.indexOf('--out');
const buf = fs.readFileSync(src);
const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;

console.log('════════ 修复 CSV 的 UTF-8 BOM ════════\n');
console.log(`  源文件 : ${src}`);
console.log(`  大小   : ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`  已有BOM: ${hasBom ? '是' : '否'}`);

if (hasBom) {
  console.log('\n  ✅ 已有 BOM，无需处理');
  process.exit(0);
}

// 合法性校验：必须是合法 UTF-8 才处理，避免把真乱码文件"修"坏
try {
  new TextDecoder('utf-8', { fatal: true }).decode(buf);
} catch (e) {
  console.error(`\n  ❌ 源文件不是合法 UTF-8，拒绝处理（避免误伤）: ${e.message}`);
  process.exit(1);
}

const out = outIdx >= 0 && args[outIdx + 1]
  ? args[outIdx + 1]
  : (inPlace ? src : src.replace(/(\.[Cc][Ss][Vv])$/, '_utf8bom$1'));

if (!inPlace && out === src) {
  console.error('  ❌ 输出路径与源文件相同，请用 --in-place 明确表示原地修改');
  process.exit(1);
}

fs.writeFileSync(out, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), buf]));

// 回读校验
const chk = fs.readFileSync(out);
const okBom = chk[0] === 0xEF && chk[1] === 0xBB && chk[2] === 0xBF;
const okBody = chk.length === buf.length + 3 && Buffer.compare(chk.slice(3), buf) === 0;

console.log(`\n  输出   : ${out}`);
console.log(`  BOM    : ${okBom ? '✅ 已写入' : '❌ 失败'}`);
console.log(`  原字节 : ${okBody ? '✅ 完整保留（仅前置 3 字节）' : '❌ 内容被改动'}`);
console.log(`  新大小 : ${(chk.length / 1024).toFixed(1)} KB`);
console.log(`\n  ✅ 完成。用 Excel 直接打开该文件即可正常显示中文。`);
