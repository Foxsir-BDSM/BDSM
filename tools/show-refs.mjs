#!/usr/bin/env node
// tools/show-refs.mjs —— 打印全站资源/模块引用现状（排查用）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (/\.(html|css|js)$/.test(f)) o.push(f);
  }
  return o;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

console.log('══════ 图片引用 ══════');
for (const f of walk(path.join(ROOT, 'src'))) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!/OIP-[ABC]\.jpg/.test(l)) return;
    if (/^\s*(\/\/|<!--|\*)/.test(l)) return;          // 跳过注释
    const m = l.match(/[^\s"'(]*OIP-[ABC]\.jpg/);
    if (m) console.log(`  ${rel(f)}:${i + 1}  ${m[0]}`);
  });
}

console.log('\n══════ CSS 外链引用 ══════');
for (const f of walk(path.join(ROOT, 'src'))) {
  if (!f.endsWith('.html')) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!/rel="stylesheet"/.test(l)) return;
    const m = l.match(/href="([^"]+)"/);
    if (m) console.log(`  ${rel(f)}:${i + 1}  ${m[1]}`);
  });
}

console.log('\n══════ JS 脚本引用 ══════');
for (const f of walk(path.join(ROOT, 'src'))) {
  if (!f.endsWith('.html')) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!/<script[^>]+src=/.test(l)) return;
    const m = l.match(/src="([^"]+)"/);
    if (m) console.log(`  ${rel(f)}:${i + 1}  ${m[1]}`);
  });
}

console.log('\n══════ @ 别名模块导入 ══════');
const aliasSet = new Map();
for (const f of walk(path.join(ROOT, 'src'))) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/["'](@\/[^"']+)["']/g)) {
    const target = path.join(ROOT, 'src', m[1].slice(2));
    const ok = fs.existsSync(target);
    aliasSet.set(m[1], ok);
  }
}
for (const [k, ok] of [...aliasSet].sort()) console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${k}`);
