#!/usr/bin/env node
// tools/patch-content-config.mjs —— 为内容板块加入统一的 content 分支配置
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'admin', 'content-config.js');

let t = fs.readFileSync(FILE, 'utf8');
const before = t;

// 1) 分支表加入 content（保留旧的 knowledge / tasks 供留档分支读取）
t = t.replace(
  /branches:\s*\{[\s\S]*?\}/,
  `branches: {
    // ★ 欲炼之途（统一内容板块）—— 当前唯一在用的分支
    content: 'content',
    // 以下为旧板块留档分支，代码已不再引用，保留配置便于日后取回
    knowledge: 'knowledge',
    tasks: 'tasks'
  }`
);

// 2) 路径表加入 posts
t = t.replace(
  /paths:\s*\{[\s\S]*?\}/,
  `paths: {
    content: 'posts',
    knowledge: 'articles',
    tasks: 'tasks'
  }`
);

if (t === before) {
  console.log('⚠️ 未发生替换（可能已改过）');
} else {
  fs.writeFileSync(FILE, t, 'utf8');
  console.log('✅ 已更新 content-config.js');
}

// 校验编码
const b = fs.readFileSync(FILE);
const txt = b.toString('utf8');
console.log('  U+FFFD:', (txt.match(/\uFFFD/g) || []).length);
console.log('  含 content 分支:', txt.includes("content: 'content'"));
console.log('  含 posts 路径:', txt.includes("content: 'posts'"));
