#!/usr/bin/env node
/**
 * tools/flatten-dist.mjs
 *
 * Vite 会把 HTML 按其源码路径产出（dist/src/launcher/index.html 等）。
 * 但站内的链接全部是"部署根"绝对路径（/index.html、/admin.html、/modules/<mod>/），
 * 因此构建后需要把 dist/ 整理成真正的部署结构：
 *
 *   dist/index.html                  ← src/launcher/*
 *   dist/landing.html
 *   dist/about.html
 *   dist/auth.html
 *   dist/module.html
 *   dist/404.html
 *   dist/admin.html                  ← src/admin/*
 *   dist/admin-article.html
 *   dist/admin-article-simple.html
 *   dist/modules/<mod>/index.html    ← src/modules/<mod>/*
 *   dist/shared/**                   ← src/shared/**（静态资源，供 /shared/... 绝对引用）
 *   dist/assets/**                   ← 打包产物（JS/CSS/图片）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ 不存在，请先执行 vite build');
  process.exit(1);
}

let moved = 0;

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function moveFile(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(to);
  if (fs.existsSync(to)) fs.rmSync(to); // 覆盖同名旧产物
  fs.renameSync(from, to);
  console.log(`  ${rel(from)}  ->  ${rel(to)}`);
  moved++;
  return true;
}

function moveTree(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return;
  for (const ent of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const src = path.join(fromDir, ent.name);
    const dst = path.join(toDir, ent.name);
    if (ent.isDirectory()) moveTree(src, dst);
    else moveFile(src, dst);
  }
}

// ── 1) src/launcher/* -> dist/* ─────────────────────────────
moveTree(path.join(DIST, 'src', 'launcher'), DIST);

// ── 2) src/admin/* -> dist/admin/* ──────────────────────────
// 方案：管理后台页面上移到 dist/ 根（与 /admin.html 引用一致）
moveTree(path.join(DIST, 'src', 'admin'), DIST);

// ── 3) src/modules/* -> dist/modules/* ──────────────────────
moveTree(path.join(DIST, 'src', 'modules'), path.join(DIST, 'modules'));

// ── 4) src/shared/** -> dist/shared/**（静态资源）───────────
// 注意：src/shared 下的 js/css 已被 Vite 打包进 assets/，无需复制；
//       仅需复制 assets/（图片等）以支持 /shared/assets/... 绝对引用。
function copyTree(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return;
  fs.mkdirSync(toDir, { recursive: true });
  for (const ent of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const src = path.join(fromDir, ent.name);
    const dst = path.join(toDir, ent.name);
    if (ent.isDirectory()) copyTree(src, dst);
    else {
      fs.copyFileSync(src, dst);
      console.log(`  ${rel(src)}  =>  ${rel(dst)}`);
      moved++;
    }
  }
}

copyTree(
  path.join(ROOT, 'src', 'shared', 'assets'),
  path.join(DIST, 'shared', 'assets')
);

// ── 5) 清理空的 dist/src ────────────────────────────────────
function pruneEmpty(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) pruneEmpty(path.join(dir, ent.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
pruneEmpty(path.join(DIST, 'src'));

console.log(`\n✅ dist 扁平化完成，共移动 ${moved} 个文件`);
