#!/usr/bin/env node
// tools/archive-migration-tools.mjs —— 把一次性迁移脚本移入 _archive（避免误跑）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools');
const DST = path.join(ROOT, '_archive', 'tools-migration');

const ONE_OFF = [
  'rewrite-refs.mjs',
  'fix-paths.mjs',
  'fix-css-links.mjs',
  'fix-module-css.mjs',
  'make-placeholder.mjs',
  'rewrite-file.mjs',
  'archive-migration-tools.mjs',
];

fs.mkdirSync(DST, { recursive: true });
let n = 0;
for (const f of ONE_OFF) {
  const from = path.join(SRC, f);
  if (!fs.existsSync(from)) continue;
  fs.renameSync(from, path.join(DST, f));
  console.log('  归档: tools/' + f);
  n++;
}

const readme = `# 一次性迁移脚本（已归档）

这些脚本在 v2.2 → 分层重构（launcher / admin / modules / shared）期间执行过一次，
**不要重复运行**，否则会二次改写路径。

| 脚本 | 作用 |
|:---|:---|
| rewrite-refs.mjs      | 按映射表批量改写全站引用（HTML/CSS 相对化、JS 走 @ 别名） |
| fix-paths.mjs         | 计算式修正图片相对路径 |
| fix-css-links.mjs     | 修正 launcher 的 CSS 相对深度与 loading.js 的 Logo 路径 |
| fix-module-css.mjs    | 修正模块级页面的 ../../shared/css/ 深度 |
| make-placeholder.mjs  | 重写 dom-archive 占位页（原文件为双重编码损坏） |
| rewrite-file.mjs      | 以 UTF-8 覆盖写入的辅助工具 |
| archive-migration-tools.mjs | 归档动作本身 |

当前可用的常驻工具（保留在 tools/）：
- ref-check.mjs      引用完整性校验
- static-server.mjs  零依赖静态服务器（src / dist 双模式）
- smoke.mjs          HTTP 冒烟测试
- flatten-dist.mjs   构建后把 dist 整理为部署结构
- show-refs.mjs      打印全站引用现状（排查用）
`;
fs.writeFileSync(path.join(DST, 'README.md'), readme, 'utf8');
console.log(`\n已归档 ${n} 个脚本到 _archive/tools-migration/`);
