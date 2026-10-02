#!/usr/bin/env node
/**
 * tools/rewrite-refs.mjs  （一次性迁移脚本）
 *
 * 规则边界（重要）：
 *   · HTML / CSS 中的资源引用 -> 相对路径（它们不走 Vite 打包，必须能在本地静态服务器下工作）
 *   · JS 中的路径            -> 保持根绝对（Vite 会把这些模块打包进 /assets/*，相对路径会失效）
 *   · JS 模块导入            -> 使用 @ 别名（Vite 构建期解析）
 *
 * 每条替换都是「精确字面量 -> 精确字面量」，杜绝正则误伤。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ══════════════════════════════════════════════════════════
//  1) 全局共享替换（作用于所有 html / js）
// ══════════════════════════════════════════════════════════
const GLOBAL = [
  // 图片（HTML 属性 + CSS url() 两种形态）
  ['/assets/images/OIP-A.jpg', 'IMAGE_A'],
  ['/assets/images/OIP-B.jpg', 'IMAGE_B'],
  ['/assets/images/OIP-C.jpg', 'IMAGE_C'],

  // JS 模块导入 -> @ 别名
  ["@/js/supabase-client.js", '@/shared/js/supabase-client.js'],
  ["@/js/identity-selector.js", '@/shared/js/identity-selector.js'],
  ["@/js/content-manager.js", '@/admin/content-manager.js'],
  ["@/js/content-config.js", '@/admin/content-config.js'],
  ["@/js/ui-helpers.js", '@/shared/js/ui-helpers.js'],
  ["@/js/identity.js", '@/shared/js/identity.js'],
  ["@/js/registry.js", '@/shared/js/registry.js'],
  ["@/js/loading.js", '@/shared/js/loading.js'],
  ["@/js/avatar.js", '@/shared/js/avatar.js'],
  ["@/js/guard.js", '@/shared/js/guard.js'],
  ["@/js/level.js", '@/shared/js/level.js'],
  ["@/js/cache.js", '@/shared/js/cache.js'],
  ["@/js/auth.js", '@/shared/js/auth.js'],
  ["@/js/admin.js", '@/admin/admin.js'],

  // 旧物理路径导入 -> @ 别名
  ["'/assets/pages/sub-archive/assets/js/api.js'", "'./js/api.js'"],
  ["'/assets/config/archive/instances.js'", "'@/shared/config/archive/instances.js'"],
  ["'/assets/config/archive/schema.js'", "'@/shared/config/archive/schema.js'"],
  ["'/assets/config/levelConfig.js'", "'@/shared/config/levelConfig.js'"],
  ["'/assets/config/identity-config.js'", "'@/shared/config/identity-config.js'"],

  // admin/admin.js：跨层引用
  ["from '@/shared/js/supabase-client.js'", "from '@/shared/js/supabase-client.js'"],
  ["from './supabase-client.js'", "from '@/shared/js/supabase-client.js'"],
  ["from './identity.js'", "from '@/shared/js/identity.js'"],
  ["from './auth.js'", "from '@/shared/js/auth.js'"],
  ["from './ui-helpers.js'", "from '@/shared/js/ui-helpers.js'"],
  ["'/assets/pages/sub-archive/assets/js/api.js'", "'@/modules/sub-archive/js/api.js'"],
];

// ══════════════════════════════════════════════════════════
//  2) 分层替换：按文件所在层级决定相对前缀
// ══════════════════════════════════════════════════════════
const LAYERS = [
  {
    // ── launcher（src/launcher/）────────────────────────
    match: /^src[\\/]launcher[\\/]/,
    rules: [
      ['href="/assets/css/landing.css"', 'href="./shared/css/landing.css"'],
      ['href="/assets/css/identity-selector.css"', 'href="./shared/css/identity-selector.css"'],
      ['href="/assets/css/level.css"', 'href="./shared/css/level.css"'],
      ['href="/assets/css/avatar.css"', 'href="./shared/css/avatar.css"'],
      ['href="/assets/css/main.css"', 'href="./shared/css/main.css"'],
      ['href="/assets/css/admin.css"', 'href="./shared/css/admin.css"'],
    ],
  },
  {
    // ── admin（src/admin/）──────────────────────────────
    match: /^src[\\/]admin[\\/]/,
    rules: [
      ['href="/assets/css/main.css"', 'href="../shared/css/main.css"'],
      ['href="/assets/css/admin.css"', 'href="../shared/css/admin.css"'],
      ['src="/assets/js/admin.js"', 'src="./admin.js"'],
      ["from './supabase-client.js'", "from '@/shared/js/supabase-client.js'"],
      ["from './identity.js'", "from '@/shared/js/identity.js'"],
      ["from './auth.js'", "from '@/shared/js/auth.js'"],
      ["from './ui-helpers.js'", "from '@/shared/js/ui-helpers.js'"],
    ],
  },
  {
    // ── modules/sub-archive ─────────────────────────────
    match: /^src[\\/]modules[\\/]sub-archive[\\/]/,
    rules: [
      ['href="/assets/pages/sub-archive/assets/css/global.css"', 'href="./css/global.css"'],
      ['href="/assets/pages/sub-archive/assets/css/home.css"', 'href="./css/home.css"'],
      ['href="/assets/pages/sub-archive/assets/css/detail.css"', 'href="./css/detail.css"'],
      ['href="/assets/pages/sub-archive/assets/css/admin.css"', 'href="./css/admin.css"'],
      ['href="assets/css/global.css"', 'href="./css/global.css"'],
      ['href="assets/css/admin.css"', 'href="./css/admin.css"'],
      ['src="/assets/pages/sub-archive/assets/js/home.js"', 'src="./js/home.js"'],
      ['src="/assets/pages/sub-archive/assets/js/detail.js"', 'src="./js/detail.js"'],
      ['src="assets/js/admin.js"', 'src="./js/admin.js"'],
      ['href="/assets/pages/sub-archive/index.html"', 'href="./index.html"'],
      ["location.href='detail.html?id=", "location.href='./detail.html?id="],
      ['href="detail.html?id=', 'href="./detail.html?id='],
      ["from './js/api.js'", "from './api.js'"],
    ],
  },
  {
    // ── modules/knowledge ───────────────────────────────
    match: /^src[\\/]modules[\\/]knowledge[\\/]/,
    rules: [
      ['href="/assets/css/main.css"', 'href="../shared/css/main.css"'],
      ['href="/assets/pages/knowledge/index.html"', 'href="./index.html"'],
      ['href="/assets/pages/knowledge/article.html?slug=', 'href="./article.html?slug='],
      ["'/assets/pages/knowledge/article.html?slug=", "'./article.html?slug="],
    ],
  },
  {
    // ── modules/mission ─────────────────────────────────
    match: /^src[\\/]modules[\\/]mission[\\/]/,
    rules: [
      ['href="/assets/css/main.css"', 'href="../shared/css/main.css"'],
      ['href="/assets/pages/task/index.html"', 'href="./index.html"'],
      ['href="/assets/pages/task/detail.html?slug=', 'href="./detail.html?slug='],
      ["'/assets/pages/task/detail.html?slug=", "'./detail.html?slug="],
    ],
  },
];

// ══════════════════════════════════════════════════════════
//  3) 图片路径：按层级展开
// ══════════════════════════════════════════════════════════
function imagePrefix(relPath) {
  // 计算从该文件到 src/shared/assets/images/ 的相对前缀
  const fileDir = path.dirname(path.join(ROOT, relPath));
  const imgDir = path.join(ROOT, 'src', 'shared', 'assets', 'images');
  let rel = path.relative(fileDir, imgDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

const TARGET_DIRS = ['src'];
const EXTS = new Set(['.html', '.js', '.css']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(ent.name))) out.push(full);
  }
  return out;
}

const IMG_TOKENS = { IMAGE_A: 'OIP-A.jpg', IMAGE_B: 'OIP-B.jpg', IMAGE_C: 'OIP-C.jpg' };

const files = TARGET_DIRS.flatMap((d) => {
  const p = path.join(ROOT, d);
  return fs.existsSync(p) ? walk(p) : [];
});

const report = [];
for (const file of files) {
  const relPath = path.relative(ROOT, file);
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  const applied = [];

  const layer = LAYERS.find((l) => l.match.test(relPath));

  const applyList = (list, label) => {
    for (const [from, to] of list) {
      if (after.includes(from)) {
        const n = after.split(from).length - 1;
        after = after.split(from).join(to);
        applied.push(`${label}: ${n}× ${from}`);
      }
    }
  };

  applyList(GLOBAL, 'global');
  if (layer) applyList(layer.rules, 'layer');

  // 展开图片占位符
  for (const [token, name] of Object.entries(IMG_TOKENS)) {
    if (after.includes(token)) {
      const n = after.split(token).length - 1;
      after = after.split(token).join(imagePrefix(relPath) + '/' + name);
      applied.push(`image: ${n}× ${name}`);
    }
  }

  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    report.push({ file: relPath.replace(/\\/g, '/'), applied });
  }
}

console.log(`已重写 ${report.length} 个文件\n`);
for (const r of report) {
  console.log(`  ${r.file}`);
  for (const a of r.applied) console.log(`      ${a}`);
}
