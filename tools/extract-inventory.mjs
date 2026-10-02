#!/usr/bin/env node
/**
 * tools/extract-inventory.mjs
 * 机械化提取全站「交互点」与「函数」，作为功能梳理表格的原始依据。
 * 输出 JSON + 控制台摘要。
 *
 *   node tools/extract-inventory.mjs           控制台摘要
 *   node tools/extract-inventory.mjs --json    输出 JSON
 *   node tools/extract-inventory.mjs --write   写入 docs/_inventory.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else o.push(f);
  }
  return o;
}

const files = walk(SRC).filter((f) => /\.(html|js)$/.test(f));
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** 归属板块判定 */
function moduleOf(p) {
  const r = rel(p);
  if (r.startsWith('src/launcher/')) return '启动器';
  if (r.startsWith('src/admin/')) return '管理后台';
  if (r.startsWith('src/modules/dom-archive/')) return '模块·欲主之殿';
  if (r.startsWith('src/modules/sub-archive/')) return '模块·欲渊之庭';
  if (r.startsWith('src/modules/knowledge/')) return '模块·欲识之海';
  if (r.startsWith('src/modules/mission/')) return '模块·欲炼之途';
  if (r.startsWith('src/modules/random/')) return '模块·淫梦织境/欲缘之遇';
  if (r.startsWith('src/shared/')) return '共享层';
  return '其他';
}

const result = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const isHtml = f.endsWith('.html');
  const item = {
    file: rel(f),
    module: moduleOf(f),
    type: isHtml ? 'HTML' : 'JS',
    ids: [],
    classes: [],
    buttons: [],
    listeners: [],
    functions: [],
    exports: [],
    imports: [],
    onclickAttrs: [],
  };

  // ── id 选择器
  const ids = new Set();
  for (const m of src.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  for (const m of src.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) ids.add(m[1]);
  for (const m of src.matchAll(/\$\('#([^']+)'\)/g)) ids.add(m[1]);
  item.ids = [...ids];

  // ── class 选择器（querySelector / querySelectorAll）
  const classes = new Set();
  for (const m of src.matchAll(/querySelectorAll?\(['"]([^'"]+)['"]\)/g)) classes.add(m[1]);
  item.classes = [...classes];

  // ── <button> 及其 id/class/文案
  if (isHtml) {
    for (const m of src.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const attrs = m[1];
      const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const id = (attrs.match(/id="([^"]+)"/) || [])[1] || '';
      const cls = (attrs.match(/class="([^"]+)"/) || [])[1] || '';
      item.buttons.push({ id, cls, text: text.slice(0, 28) });
    }
  }

  // ── addEventListener 绑定的元素与事件
  for (const m of src.matchAll(
    /([A-Za-z_$][\w$.]*(?:\([^)]*\))?)\.addEventListener\(\s*['"]?([a-z]+)['"]?/g
  )) {
    item.listeners.push({ target: m[1].slice(0, 48), event: m[2] });
  }

  // ── 函数声明
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm))
    item.functions.push(m[1]);
  for (const m of src.matchAll(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm))
    item.functions.push(m[1]);

  // ── 导出符号
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm))
    item.exports.push(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const s of m[1].split(',')) {
      const name = s.trim().split(/\s+as\s+/).pop().trim();
      if (name && !name.startsWith('//')) item.exports.push(name);
    }
  }

  // ── import 来源
  for (const m of src.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) item.imports.push(m[1]);

  // ── 内联 onclick / onchange 等
  for (const m of src.matchAll(/\bon(click|change|error|load|submit|dblclick)="([^"]{0,60})/g))
    item.onclickAttrs.push({ event: m[1], code: m[2] });

  item.ids = [...new Set(item.ids)];
  item.classes = [...new Set(item.classes)];
  item.functions = [...new Set(item.functions)];
  item.exports = [...new Set(item.exports)];
  item.imports = [...new Set(item.imports)];
  result.push(item);
}

const args = process.argv.slice(2);
if (args.includes('--write')) {
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'docs', '_inventory.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  );
  console.log('已写入 docs/_inventory.json');
}
if (args.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const total = {
  files: result.length,
  ids: result.reduce((a, b) => a + b.ids.length, 0),
  classes: result.reduce((a, b) => a + b.classes.length, 0),
  buttons: result.reduce((a, b) => a + b.buttons.length, 0),
  listeners: result.reduce((a, b) => a + b.listeners.length, 0),
  functions: result.reduce((a, b) => a + b.functions.length, 0),
  exports: result.reduce((a, b) => a + b.exports.length, 0),
};

console.log('══════ 提取摘要 ══════');
console.log(JSON.stringify(total, null, 2));
console.log('');
for (const it of result.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`── ${it.file}   [${it.module}]`);
  if (it.ids.length) console.log(`   id:      ${it.ids.slice(0, 14).join(', ')}${it.ids.length > 14 ? ' …' : ''}`);
  if (it.buttons.length)
    console.log(
      `   button:  ${it.buttons.map((b) => (b.id ? '#' + b.id : '.' + b.cls.split(' ')[0]) + `「${b.text}」`).slice(0, 10).join(' | ')}`
    );
  if (it.listeners.length)
    console.log(
      `   listen:  ${[...new Set(it.listeners.map((l) => `${l.target}:${l.event}`))].slice(0, 10).join(', ')}`
    );
  if (it.functions.length)
    console.log(`   func:    ${it.functions.slice(0, 16).join(', ')}${it.functions.length > 16 ? ' …' : ''}`);
  if (it.exports.length) console.log(`   export:  ${it.exports.slice(0, 16).join(', ')}`);
  console.log('');
}
