#!/usr/bin/env node
/**
 * tools/analyze-deps.mjs —— 建立源文件依赖图
 *
 * 产出（供生成「文件维护对照表」使用）：
 *   · 每个 JS/MJS 文件 import 了谁（出边）
 *   · 每个文件被谁 import（入边 / 被依赖）
 *   · 每个 HTML 页面引用了哪些 JS 与 CSS
 *   · 每个 JS 被哪些页面间接使用（归属页面反查）
 *
 * 用法：
 *   node tools/analyze-deps.mjs            # 控制台摘要
 *   node tools/analyze-deps.mjs --json     # 输出 JSON 到 tools/.deps.json
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const args = process.argv.slice(2);
const asJson = args.includes('--json');

/** 递归收集文件 */
function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, exts, out); continue; }
    if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ── 别名解析：@/ → src/
function resolveSpec(spec, fromFile) {
  if (!spec) return null;
  if (spec.startsWith('@/')) return path.join(SRC, spec.slice(2));
  if (spec.startsWith('.')) return path.resolve(path.dirname(fromFile), spec);
  return null; // 裸模块（第三方）
}

/** 提取 import 语句里的路径 */
function extractImports(code) {
  const specs = new Set();
  // import ... from '...'
  for (const m of code.matchAll(/import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) specs.add(m[1]);
  // import '...'（副作用）
  for (const m of code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specs.add(m[1]);
  // 动态 import('...')
  for (const m of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.add(m[1]);
  return [...specs];
}

const jsFiles = walk(SRC, ['.js']);
const htmlFiles = walk(SRC, ['.html']);
const cssFiles = walk(SRC, ['.css']);

const jsSet = new Set(jsFiles.map((f) => path.resolve(f)));
const cssSet = new Set(cssFiles.map((f) => path.resolve(f)));
const htmlSet = new Set(htmlFiles.map((f) => path.resolve(f)));

const withExt = (p) => {
  if (!p) return null;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
  for (const ext of ['.js', '.mjs', '.json', '/index.js']) {
    if (fs.existsSync(p + ext) && fs.statSync(p + ext).isFile()) return path.resolve(p + ext);
  }
  return path.resolve(p); // 找不到也记下，便于发现断链
};

// ── JS 依赖图
const jsDeps = {};      // file -> { imports:[], importedBy:[], dynamic:[], bare:[] }
jsFiles.forEach((f) => {
  const code = fs.readFileSync(f, 'utf8');
  const entry = { imports: [], dynamic: [], bare: [] };
  for (const spec of extractImports(code)) {
    const target = resolveSpec(spec, f);
    if (!target) { entry.bare.push(spec); continue; }
    const t = withExt(target);
    if (jsSet.has(t)) entry.imports.push(rel(t));
    else entry.bare.push(spec);
  }
  // 标记动态 import（来自动态 import(...) 的路径）
  for (const m of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const target = withExt(resolveSpec(m[1], f));
    if (target && jsSet.has(target)) entry.dynamic.push(rel(target));
  }
  entry.imports = [...new Set(entry.imports)];
  entry.dynamic = [...new Set(entry.dynamic)];
  jsDeps[rel(f)] = entry;
});

// ── 反向边
Object.values(jsDeps).forEach((v) => { v.importedBy = []; });
Object.entries(jsDeps).forEach(([file, v]) => {
  [...v.imports, ...v.dynamic].forEach((t) => {
    if (jsDeps[t]) jsDeps[t].importedBy.push(file);
  });
});
Object.values(jsDeps).forEach((v) => { v.importedBy = [...new Set(v.importedBy)].sort(); });

/** 把一个 URL/相对路径解析为 src 下的真实文件 */
function resolveUrlToFile(u, fromHtml) {
  if (!u) return null;
  if (/^(https?:)?\/\//.test(u) || u.startsWith('data:')) return null;   // 外链
  if (u.startsWith('@/')) return withExt(path.join(SRC, u.slice(2)));
  if (u.startsWith('/')) {
    // 根绝对路径 → 先按 src/ 下找，再按项目根找
    const a = withExt(path.join(SRC, u.slice(1)));
    if (jsSet.has(a)) return a;
    return withExt(path.join(ROOT, u.slice(1)));
  }
  return withExt(path.resolve(path.dirname(fromHtml), u));
}

// ── HTML 引用
const htmlRefs = {};
htmlFiles.forEach((f) => {
  const code = fs.readFileSync(f, 'utf8');
  const entry = { scripts: [], styles: [], inlineImports: [], scriptFiles: [] };
  for (const m of code.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)) {
    entry.scripts.push(m[1]);
    const t = resolveUrlToFile(m[1], f);
    if (t && jsSet.has(t)) entry.scriptFiles.push(rel(t));
  }
  for (const m of code.matchAll(/<link[^>]*\shref=["']([^"']+\.css[^"']*)["']/g)) entry.styles.push(m[1]);
  // 内联 module 里的 import
  for (const m of code.matchAll(/import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) entry.inlineImports.push(m[1]);
  for (const m of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) entry.inlineImports.push(m[1]);
  entry.inlineImports = [...new Set(entry.inlineImports)];
  entry.scriptFiles = [...new Set(entry.scriptFiles)];
  htmlRefs[rel(f)] = entry;
});

// ── 归属页面反查：JS 被哪些 HTML（含其内联 import）使用
const jsOwners = {};
Object.keys(jsDeps).forEach((f) => { jsOwners[f] = new Set(); });

// 直接：HTML 的 <script src> 与内联 import 指向的 JS
Object.entries(htmlRefs).forEach(([html, refs]) => {
  const direct = [...(refs.scriptFiles || [])];
  refs.inlineImports.forEach((spec) => {
    const t = withExt(resolveSpec(spec, path.join(ROOT, html)));
    if (t && jsDeps[rel(t)]) direct.push(rel(t));
  });
  direct.forEach((js) => { if (jsOwners[js]) jsOwners[js].add(html); });
});

// 传递：从 HTML 直接引用的 JS 出发，沿 import 边扩散
let changed = true;
let guard = 0;
while (changed && guard++ < 30) {
  changed = false;
  Object.entries(jsOwners).forEach(([file, owners]) => {
    if (!owners.size) return;
    const deps = jsDeps[file]?.imports || [];
    deps.forEach((d) => {
      if (!jsOwners[d]) return;
      const before = jsOwners[d].size;
      owners.forEach((o) => jsOwners[d].add(o));
      if (jsOwners[d].size !== before) changed = true;
    });
  });
}

const result = {
  generatedAt: new Date().toISOString(),
  counts: { js: jsFiles.length, html: htmlFiles.length, css: cssFiles.length },
  js: jsDeps,
  html: htmlRefs,
  jsOwners: Object.fromEntries(Object.entries(jsOwners).map(([k, v]) => [k, [...v].sort()])),
};

if (asJson) {
  const out = path.join(ROOT, 'tools', '.deps.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 1), 'utf8');
  console.log(`✅ 依赖图已写入 ${rel(out)}`);
} else {
  console.log('════════ 依赖图摘要 ════════\n');
  console.log(`  JS ${result.counts.js} 个   HTML ${result.counts.html} 个   CSS ${result.counts.css} 个\n`);

  console.log('── 被依赖最多的 JS（改动影响面大）──');
  const byFanIn = Object.entries(jsDeps).sort((a, b) => b[1].importedBy.length - a[1].importedBy.length);
  byFanIn.slice(0, 12).forEach(([f, v]) => {
    console.log(`  ${String(v.importedBy.length).padStart(2)} ← ${f}`);
  });

  console.log('\n── 无任何被依赖的 JS（入口或死代码）──');
  Object.entries(jsDeps).filter(([, v]) => v.importedBy.length === 0 && !(v.dynamic.length))
    .forEach(([f, v]) => {
      console.log(`  · ${f}   (归属页面: ${(result.jsOwners[f] || []).join(', ') || '未知'})`);
    });

  console.log('\n── 各页面引用的模块 ──');
  Object.entries(result.jsOwners).forEach(([f, owners]) => {
    if (!owners.length) return;
  });
  const byPage = {};
  Object.entries(result.jsOwners).forEach(([js, owners]) => {
    owners.forEach((o) => { (byPage[o] ||= []).push(js); });
  });
  Object.entries(byPage).sort().forEach(([page, list]) => {
    console.log(`  ${page}  →  ${list.length} 个 JS`);
  });
}
