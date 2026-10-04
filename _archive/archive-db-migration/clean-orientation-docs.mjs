#!/usr/bin/env node
// tools/clean-orientation-docs.mjs —— 清理过时的取向描述注释
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);

const EDITS = [
  // identity-config.js 头部
  ['src/shared/config/identity-config.js',
    `// 身份与取向定义 —— 4 身份 + 取向
// ------------------------------------------------------------
// 设计（2026-10-03 定稿）：
//   · 身份只有 4 种：男S / 女S / 男M / 女M
//     旧分类（Dom / Z / Sub / B）已废弃，不再作为身份存在
//   · 取向是独立维度：异性 / 同性 / 双性 / 未定
//   · 档案筛选 = 用户身份（决定看哪一侧）+ 取向（决定看哪个性别）`,
    `// 身份定义 —— 4 身份
// ------------------------------------------------------------
// 设计（2026-10-04 定稿）：
//   · 身份只有 4 种：男S / 女S / 男M / 女M
//     旧分类（Dom / Z / Sub / B）已废弃，不再作为身份存在
//   · 取向维度已取消，档案筛选仅按身份（决定看哪一侧）`],

  // 元数据注释
  ['src/shared/js/auth.js',
    '// ===== R-02 + R-05：获取用户身份元数据（含头像与取向） =====',
    '// ===== R-02 + R-05：获取用户身份元数据（含头像） ====='],
  ['src/modules/sub-archive/js/auth.js',
    '// ===== R-02 + R-05：获取用户身份元数据（含头像与取向） =====',
    '// ===== R-02 + R-05：获取用户身份元数据（含头像） ====='],

  // 档案模块注释
  ['src/modules/sub-archive/js/utils.js',
    '// ★★★ 档案归属与筛选（身份 / 取向）★★★',
    '// ★★★ 档案归属与筛选（按身份）★★★'],
  ['src/modules/sub-archive/js/utils.js',
    ' * 按「访问者身份 + 取向」过滤记录',
    ' * 按「访问者身份」过滤记录'],
];

let n = 0, miss = 0;
for (const [file, from, to] of EDITS) {
  const f = rel(file);
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(from)) { console.log('  · 未命中: ' + file + '  「' + from.split('\n')[0].slice(0, 44) + '」'); miss++; continue; }
  fs.writeFileSync(f, t.split(from).join(to), 'utf8');
  console.log('  ✓ ' + file);
  n++;
}
console.log(`\n共更新 ${n} 处${miss ? `，${miss} 处未命中` : ''}`);
