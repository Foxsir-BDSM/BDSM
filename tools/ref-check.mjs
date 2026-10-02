#!/usr/bin/env node
/**
 * tools/ref-check.mjs
 * 引用完整性校验器 —— 静态站重构安全网
 *
 * 扫描全部 HTML 的 href / src 与全部 JS 的 import/export from，
 * 按“浏览器实际请求路径”规则解析，验证目标文件是否存在。
 *
 * 规则：
 *   1) 以 / 开头           -> 相对项目根（= HTTP 站点根）
 *   2) 以 ./ 或 ../ 开头    -> 相对当前文件所在目录（且 HREF 不被 Vite 改写，故按原目录解析）
 *   3) @/xxx               -> ALIAS 指向的目录
 *   4) http(s):// 或 //    -> 外部，跳过
 *   5) #...                -> 锚点，跳过
 *   6) data: / mailto: ... -> 跳过
 *
 * 目录式 URL（以 / 结尾）按 index.html 解析。
 *
 * 用法:
 *   node tools/ref-check.mjs            人类可读报告
 *   node tools/ref-check.mjs --json     机器可读
 *   node tools/ref-check.mjs --routes   输出静态服务器所需的路由映射表
 *   node tools/ref-check.mjs --baseline 只统计不判错（用于重构前记录基线）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/** @ 别名目录（与 vite.config.js 的 resolve.alias 保持一致） */
const ALIAS = path.join(ROOT, 'src');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.probe', '.shots', '_archive']);

/** 本工具自身文件，跳过扫描（否则会把源码里的正则当引用） */
const SELF = fileURLToPath(import.meta.url);

const SKIP_SCHEME = /^(https?:)?\/\/|^(data|mailto|tel|javascript|blob):/i;

// ────────────────────────────────────────────── 收集文件

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ────────────────────────────────────────────── 提取引用

const EXT_RE = /\.(js|mjs|css|html|jpg|jpeg|png|gif|webp|svg|ico|json|txt|woff2?|ttf|mp4|webm|md)$/i;

/** HTML: 提取 href / src / srcset 属性值 */
function extractHtmlRefs(source) {
  const refs = [];
  const re = /\b(href|src|srcset)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const attr = m[1].toLowerCase();
    const raw = (m[3] ?? m[4] ?? m[5] ?? '').trim();
    if (!raw) continue;
    if (attr === 'srcset') {
      for (const part of raw.split(',')) {
        const u = part.trim().split(/\s+/)[0];
        if (u) refs.push({ url: u, attr, line: lineOf(source, m.index) });
      }
    } else {
      refs.push({ url: raw, attr, line: lineOf(source, m.index) });
    }
  }
  return refs;
}

/** HTML 内联 module script 里的 import（含动态 import） */
function extractInlineImports(source) {
  const refs = [];
  const scriptRe = /<script\b[^>]*type\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(source)) !== null) {
    const body = m[1];
    const base = m.index;
    for (const u of matchImportSpecifiers(body)) {
      refs.push({ url: u.value, attr: 'inline-import', line: lineOf(source, base + u.index) });
    }
  }
  return refs;
}

/** JS: 提取 import / export ... from 'x' 与 import('x') */
function extractJsImports(source) {
  return matchImportSpecifiers(source).map((u) => ({
    url: u.value,
    attr: 'import',
    line: lineOf(source, u.index),
  }));
}

function matchImportSpecifiers(code) {
  const out = [];
  // 要求 import/export 位于行首（可带缩进），避免把源码里的正则字面量误当引用
  const patterns = [
    /^[ \t]*import[\s\S]*?\bfrom\s*["']([^"']+)["']/gm,
    /^[ \t]*export[\s\S]*?\bfrom\s*["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /^[ \t]*import\s*["']([^"']+)["']/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      out.push({ value: m[1], index: m.index });
    }
  }
  return out;
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') n++;
  return n;
}

// ────────────────────────────────────────────── 解析

/**
 * 站点根绝对路径 → 磁盘文件 的“部署路由映射”
 * 构建（vite build）会把 src/**／*.html 按其站点路径产出到 dist/，
 * 例如 src/launcher/index.html -> dist/index.html，src/modules/knowledge/index.html -> dist/modules/knowledge/index.html
 * 因此根绝对引用 /xxx 应按下列规则落盘。
 */
const ROUTE_RULES = [
  [/^\/(404|about|auth|index|landing|module)\.html$/, 'src/launcher/$1.html'],
  [/^\/(admin|admin-article|admin-article-simple)\.html$/, 'src/admin/$1.html'],
  [/^\/modules\/([^/]+)\/(.*)$/, 'src/modules/$1/$2'],
  [/^\/modules\/([^/]+)\/?$/, 'src/modules/$1/index.html'],
  [/^\/shared\/(.*)$/, 'src/shared/$1'],
  [/^\/?$/, 'src/launcher/index.html'],
];

function mapRootAbsolute(urlPath) {
  for (const [re, rep] of ROUTE_RULES) {
    if (re.test(urlPath)) return urlPath.replace(re, rep);
  }
  return null;
}

function resolveRef(rawUrl, fromFile) {
  const isDirStyle = rawUrl.split('?')[0].split('#')[0].endsWith('/');
  let url = rawUrl.split('#')[0].split('?')[0];
  if (SKIP_SCHEME.test(rawUrl)) return { kind: 'external' };
  if (rawUrl.startsWith('#')) return { kind: 'skip', reason: 'anchor' };
  if (!url) url = '/'; // 形如 "/?x" 或 "/#y" 的站点根

  let target;
  if (url.startsWith('@/')) {
    target = path.join(ALIAS, url.slice(2));
  } else if (url === '/' || url === '') {
    target = path.join(ROOT, 'src', 'launcher', 'index.html');
    return { kind: 'local', target, url };
  } else if (url.startsWith('/')) {
    // 优先走部署路由映射；未命中再按磁盘根解析
    const mapped = mapRootAbsolute(url);
    if (mapped) {
      target = path.join(ROOT, mapped);
    } else {
      const direct = path.join(ROOT, url);
      target = fs.existsSync(direct) ? direct : path.join(ROOT, 'src', url);
    }
  } else if (url.startsWith('./') || url.startsWith('../')) {
    target = path.resolve(path.dirname(fromFile), url);
  } else {
    return { kind: 'bare', url };
  }

  // 目录式 URL -> index.html
  if (isDirStyle) target = path.join(target, 'index.html');

  return { kind: 'local', target, url };
}

// ────────────────────────────────────────────── 主流程

const files = walk(ROOT).filter((f) => f !== SELF);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const jsFiles = files.filter((f) => /\.(js|mjs)$/.test(f));

const broken = [];
const externals = new Set();
const localRefs = [];
let total = 0;

for (const file of htmlFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const refs = [...extractHtmlRefs(src), ...extractInlineImports(src)];
  for (const ref of refs) {
    total++;
    const r = resolveRef(ref.url, file);
    if (r.kind === 'external') { externals.add(ref.url); continue; }
    if (r.kind === 'skip') continue;
    if (r.kind === 'bare') { externals.add(ref.url); continue; }
    localRefs.push({ file, ...ref, target: r.target });
    if (!fs.existsSync(r.target)) {
      broken.push({ file, url: ref.url, attr: ref.attr, line: ref.line, target: r.target });
    }
  }
}

for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const ref of extractJsImports(src)) {
    total++;
    const r = resolveRef(ref.url, file);
    if (r.kind === 'external') { externals.add(ref.url); continue; }
    if (r.kind === 'skip') continue;
    if (r.kind === 'bare') { externals.add(ref.url); continue; }
    localRefs.push({ file, ...ref, target: r.target });
    if (!fs.existsSync(r.target)) {
      broken.push({ file, url: ref.url, attr: ref.attr, line: ref.line, target: r.target });
    }
  }
}

// ────────────────────────────────────────────── 输出

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const args = process.argv.slice(2);

if (args.includes('--routes')) {
  // 静态服务器路由表：站点路径 -> 磁盘文件
  const routes = {};
  for (const f of htmlFiles) {
    routes['/' + rel(f)] = rel(f);
    if (path.basename(f) === 'index.html') {
      const dir = path.dirname(rel(f));
      routes['/' + (dir === '.' ? '' : dir + '/')] = rel(f);
    }
  }
  console.log(JSON.stringify(routes, null, 2));
  process.exit(0);
}

if (args.includes('--json')) {
  console.log(JSON.stringify({
    htmlFiles: htmlFiles.length,
    jsFiles: jsFiles.length,
    totalRefs: total,
    localRefs: localRefs.length,
    broken,
    externals: [...externals].sort(),
  }, null, 2));
  process.exit(args.includes('--baseline') ? 0 : broken.length ? 1 : 0);
}

const baseline = args.includes('--baseline');

console.log('═══════════════════════════════════════════════');
console.log('  引用完整性校验报告');
console.log('═══════════════════════════════════════════════');
console.log(`  扫描根目录   : ${ROOT}`);
console.log(`  HTML 文件    : ${htmlFiles.length}`);
console.log(`  JS/MJS 文件  : ${jsFiles.length}`);
console.log(`  引用总数     : ${total}`);
console.log(`  本地引用     : ${localRefs.length}`);
console.log(`  外部引用种类 : ${externals.size}`);
console.log(`  @ 别名指向   : ${rel(ALIAS)}`);
console.log('───────────────────────────────────────────────');

if (broken.length === 0) {
  console.log('  ✅ 本地引用零断链');
} else if (baseline) {
  console.log(`  ⚠️  基线记录：${broken.length} 处断链（重构前既有）`);
  console.log('───────────────────────────────────────────────');
  for (const b of broken) {
    console.log(`  ${rel(b.file)}:${b.line}  [${b.attr}] ${b.url}`);
  }
} else {
  console.log(`  ❌ 断链 ${broken.length} 处`);
  console.log('───────────────────────────────────────────────');
  for (const b of broken) {
    console.log(`  ${rel(b.file)}:${b.line}  [${b.attr}] ${b.url}`);
    console.log(`      -> 期望文件: ${rel(b.target)}`);
  }
}

console.log('───────────────────────────────────────────────');
console.log('  外部依赖（CDN / 外链）:');
for (const e of [...externals].sort()) console.log(`    · ${e}`);
console.log('═══════════════════════════════════════════════');

process.exit(baseline ? 0 : broken.length ? 1 : 0);
