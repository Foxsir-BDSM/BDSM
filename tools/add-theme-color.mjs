#!/usr/bin/env node
/**
 * tools/add-theme-color.mjs —— 给所有页面补 theme-color 与缺失的 viewport
 *
 * 背景：手机浏览器的地址栏/状态栏颜色由 <meta name="theme-color"> 决定。
 *       全站 16 个页面此前都没有这一项，于是暗色站点顶着一条白色通知栏。
 *
 * 取值：与全站 body 背景一致的 #0f0e17。
 *
 * 用法：
 *   node tools/add-theme-color.mjs --dry   只看将改什么
 *   node tools/add-theme-color.mjs         实际写入
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = 'src';
const THEME = '#0f0e17';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

const files = walk(ROOT).sort();
console.log(`════ 补 theme-color（${files.length} 个页面）════\n`);

let changedTheme = 0, changedViewport = 0, skipped = 0;

for (const f of files) {
  let html = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/').replace('src/', '');
  const before = html;

  // ① viewport（404.html 缺）
  if (!/name="viewport"/.test(html)) {
    // 插在 <meta charset> 之后
    const m = html.match(/<meta charset="[^"]*"\s*\/?>/i);
    if (m) {
      html = html.replace(m[0], m[0] + '\n    ' + VIEWPORT);
      changedViewport++;
      console.log(`  + viewport      ${rel}`);
    }
  }

  // ② theme-color
  if (!/name="theme-color"/.test(html)) {
    const m = html.match(/<meta name="viewport"[^>]*\/?>/i);
    if (m) {
      html = html.replace(m[0], m[0] + `\n    <meta name="theme-color" content="${THEME}" />`);
      changedTheme++;
      console.log(`  + theme-color   ${rel}`);
    } else {
      console.log(`  ✗ 找不到 viewport 锚点，跳过 ${rel}`);
      skipped++;
    }
  }

  if (!DRY && html !== before) fs.writeFileSync(f, html, 'utf8');
}

console.log(`\n  ${DRY ? '将' : '已'}补 theme-color ${changedTheme} 处，viewport ${changedViewport} 处，跳过 ${skipped} 处`);
