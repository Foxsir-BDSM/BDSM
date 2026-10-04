#!/usr/bin/env node
// tools/make-placeholder.mjs —— 重写 dom-archive 占位页为正确 UTF-8（原文件为双重编码损坏）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'modules', 'dom-archive', 'index.html');

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>上位档案馆 · 建设中</title>
    <style>
      body {
        font-family: sans-serif;
        text-align: center;
        padding: 50px;
        background: #f9fafc;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      h1 {
        font-size: 3rem;
        margin-bottom: 0.5rem;
      }
      p {
        color: #64748b;
      }
      a {
        display: inline-block;
        margin-top: 2rem;
        padding: 0.6rem 1.5rem;
        background: #4a6fa5;
        color: #fff;
        border-radius: 30px;
        text-decoration: none;
      }
      a:hover {
        background: #345b8a;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>📤 上位档案馆</h1>
      <p>Dominant / Sadist / Top 档案展示，即将上线…</p>
      <p><small>（占位页面，v1.0 仅用于演示入口跳转）</small></p>
      <a href="/index.html">← 返回控制中心</a>
    </div>
  </body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('已重写为 UTF-8: ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
