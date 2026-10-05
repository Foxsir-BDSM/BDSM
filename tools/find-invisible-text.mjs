#!/usr/bin/env node
/**
 * tools/find-invisible-text.mjs —— 排查「深色文字叠在深色底上」的不可见文字
 *
 * 背景：暗色主题改造时把 #ffffff 机械替换为 #0f0e17，
 *       但有些白字是**叠在照片上的**（底下还有一层深色渐变），
 *       换成深色后就看不见了（已发现 .card-image-caption 一处）。
 *
 * 做法：在源码里找「背景是图片/深色渐变」的规则块，检查其 color 是否为深色。
 */
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
};

const files = walk('src').sort();
console.log('════ 排查不可见文字 ════════\n');

const DARK = /(#0f0e17|#0f0f0f|#16151f|#1a1822|#1a1a2e|#222222|#2d3748|#334155|#0f172a|#1e293b|rgba\(0,\s*0,\s*0,\s*0\.[5-9])/i;
const OVERLAY = /(linear-gradient|url\(|background-image)/i;

let hits = 0;

for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/').replace('src/', '');

  // 按规则块切分
  const blocks = css.split(/(?<=\})/);
  for (const b of blocks) {
    const sel = (b.match(/^([^{]+)\{/) || [])[1];
    if (!sel) continue;
    if (!OVERLAY.test(b)) continue;          // 只关心背景带图片/渐变的
    const colorM = b.match(/(?:^|[\s;])color:\s*([^;]+);/);
    if (!colorM) continue;
    const color = colorM[1].trim();
    if (!DARK.test(color)) continue;

    hits++;
    console.log(`  🔴 ${rel}`);
    console.log(`     选择器: ${sel.trim().slice(0, 76)}`);
    console.log(`     color:  ${color}`);
    const grad = (b.match(/(?:linear-gradient|url)\([^;]{0,60}/) || [])[0];
    if (grad) console.log(`     背景:   ${grad}`);
    console.log('');
  }
}

// 也检查内联样式里的（HTML 里 style="color:..."）
console.log('── HTML 内联样式 ──');
const htmlFiles = [];
const walkHtml = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
};
walkHtml('src');
let inlineHits = 0;
for (const f of htmlFiles) {
  const t = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/').replace('src/', '');
  for (const m of t.matchAll(/style="[^"]*color:\s*(#[0-9a-fA-F]{3,8})[^"]*"/g)) {
    if (DARK.test(m[1])) {
      inlineHits++;
      const line = t.slice(0, m.index).split('\n').length;
      console.log(`  · ${rel}:${line}  color: ${m[1]}`);
    }
  }
}
if (!inlineHits) console.log('  （无）');

console.log(`\n  源码中疑似问题块: ${hits} 处`);
console.log('  说明：命中不等于错误 —— 需人工确认该处文字是否叠在图片上。');
