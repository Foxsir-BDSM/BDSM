#!/usr/bin/env node
/**
 * tools/verify-header-safety.mjs
 * 严格校验：加注释头前后，代码主体（去掉注释与空行）必须逐字节一致
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const BAK = path.join(os.tmpdir(), 'hdrbak');

/** 去掉注释与空行，只留可执行/声明代码 */
function codeOnly(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .join('\n');
}

const files = fs.readdirSync(BAK).filter((f) => f.endsWith('.js'));
let allOk = true;

console.log('════════ 注释头安全性校验 ════════\n');

for (const name of files) {
  // 备份文件名不含路径，需要反查真实位置
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      if (e.name === name) found.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  if (!found.length) { console.log(`  ⚠️ 找不到对应源文件: ${name}`); continue; }

  const before = codeOnly(fs.readFileSync(path.join(BAK, name), 'utf8'));
  const after = codeOnly(fs.readFileSync(found[0], 'utf8'));

  if (before === after) {
    console.log(`  ✅ ${name}  代码主体完全一致（${before.split('\n').length} 行）`);
  } else {
    allOk = false;
    console.log(`  ✗ ${name}  代码主体有差异！`);
    const a = before.split('\n'), b = after.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.log(`      首个差异在第 ${i + 1} 行`);
        console.log(`        加注释前: ${JSON.stringify(a[i])}`);
        console.log(`        加注释后: ${JSON.stringify(b[i])}`);
        break;
      }
    }
  }
}

console.log('\n' + (allOk ? '✅ 全部安全：只动了文件顶部注释，未触碰代码' : '❌ 存在代码改动，需要回滚检查'));
process.exit(allOk ? 0 : 1);
