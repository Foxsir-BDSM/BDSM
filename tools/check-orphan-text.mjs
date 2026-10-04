#!/usr/bin/env node
/**
 * tools/check-orphan-text.mjs
 * 检查 HTML 里是否有「落在正文区域的孤立代码文本」——
 * 即既不在 <style> 里、也不在 <script> 里、也不是 HTML 注释（<!-- -->）
 * 的裸 /* … *​/ 或 // 注释。
 *
 * 背景：删除一段样式时若把注释留在 </style> 之外，浏览器会把它当作
 *       正文渲染，页面上出现一行代码文字（此坑已踩过一次）。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** 逐行跟踪所处的块，返回正文区里的可疑行 */
function scan(html) {
  const lines = html.split('\n');
  const found = [];
  let zone = 'body';   // style | script | body
  let inHtmlComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // 维护 HTML 注释状态（可跨行）
    if (!inHtmlComment && /<!--/.test(raw)) inHtmlComment = true;
    const closesHtmlComment = /-->/.test(raw);
    const wasHtmlComment = inHtmlComment;
    if (inHtmlComment && closesHtmlComment) inHtmlComment = false;

    // 进入/离开 style 与 script
    if (/<style[\s>]/.test(raw)) { zone = 'style'; continue; }
    if (/<\/style>/.test(raw)) { zone = 'body'; continue; }
    if (/<script[\s>]/.test(raw)) { zone = 'script'; continue; }
    if (/<\/script>/.test(raw)) { zone = 'body'; continue; }

    if (zone !== 'body') continue;
    if (wasHtmlComment || inHtmlComment) continue;
    if (!line) continue;
    // 行内含 HTML 标签或实体 → 是正文，不是代码
    if (/<[a-zA-Z/!]/.test(line) || /&[a-z]+;/.test(line)) continue;

    // 正文里不该出现裸的 JS/CSS 注释
    // 判据要严：CSS 块注释以 /* 开头、以 */ 结尾；多行块注释的中间行以 * 开头
    if (/^\/\*/.test(line) || /^\*\/\s*$/.test(line) || /^\*\s+\S/.test(line)) {
      found.push({ line: i + 1, text: line.slice(0, 90), kind: 'CSS 注释' });
    } else if (/^\/\//.test(line)) {
      found.push({ line: i + 1, text: line.slice(0, 90), kind: 'JS 注释' });
    }
  }
  return found;
}

console.log('════════ 孤立代码文本检查 ════════\n');

let total = 0;
for (const f of walk(SRC)) {
  const found = scan(fs.readFileSync(f, 'utf8'));
  if (!found.length) continue;
  total += found.length;
  console.log(`  ${path.relative(ROOT, f).replace(/\\/g, '/')}`);
  found.forEach((x) => console.log(`     L${x.line}  [${x.kind}]  ${x.text}`));
}

if (total) {
  console.log(`\n  ❌ 发现 ${total} 处孤立代码文本 —— 会被浏览器当作正文渲染出来`);
  process.exit(1);
} else {
  console.log('  ✅ 未发现（全部 HTML 的注释都在 style/script/HTML 注释内）');
}
