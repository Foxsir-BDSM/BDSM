#!/usr/bin/env node
/**
 * tools/static-server.mjs
 *
 * 零依赖静态服务器，按“部署路由映射”提供 src/ 或 dist/ 的文件。
 *
 *   node tools/static-server.mjs                 # 服务 src/（开发态，自动映射 /shared、/modules）
 *   node tools/static-server.mjs --dist          # 服务 dist/（生产态，验证构建产物）
 *   node tools/static-server.mjs --port 5600
 *
 * 路由规则（与 tools/ref-check.mjs 的 ROUTE_RULES 保持一致）：
 *   /                         -> src/launcher/index.html
 *   /index.html               -> src/launcher/index.html
 *   /landing.html …           -> src/launcher/*
 *   /admin.html …             -> src/admin/*
 *   /modules/<mod>[/...]      -> src/modules/<mod>/...
 *   /shared/...               -> src/shared/...
 *   /assets/...               -> dist/assets/...（--dist 模式）或 src 无此目录时 404
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const USE_DIST = args.includes('--dist');
const portArg = args.indexOf('--port');
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : USE_DIST ? 5601 : 5600;

const LAUNCHER = ['404', 'about', 'auth', 'index', 'landing', 'module'];
const ADMIN = ['admin', 'admin-article', 'admin-article-simple'];

/** URL path -> 磁盘文件 */
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = clean.replace(/^\/+/, '');

  // --dist 模式：直接按磁盘结构找（dist 已是部署形态）
  if (USE_DIST) {
    const base = path.join(ROOT, 'dist');
    const candidates = [];
    if (!rel) candidates.push(path.join(base, 'index.html'));
    else {
      candidates.push(path.join(base, rel));
      if (clean.endsWith('/') || !path.extname(rel)) {
        candidates.push(path.join(base, rel, 'index.html'));
      }
    }
    return candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) || null;
  }

  // 开发态：按路由映射到 src/
  const candidates = [];
  if (!rel) {
    candidates.push(path.join(ROOT, 'src', 'launcher', 'index.html'));
  } else {
    const m = rel.match(/^([^/]+)\.html$/);
    if (m) {
      if (LAUNCHER.includes(m[1])) candidates.push(path.join(ROOT, 'src', 'launcher', rel));
      if (ADMIN.includes(m[1])) candidates.push(path.join(ROOT, 'src', 'admin', rel));
    }
    if (rel.startsWith('modules/')) candidates.push(path.join(ROOT, 'src', rel));
    if (rel.startsWith('shared/')) candidates.push(path.join(ROOT, 'src', rel));
    // 兜底：直接落盘
    candidates.push(path.join(ROOT, 'src', rel));
    candidates.push(path.join(ROOT, rel));
    if (clean.endsWith('/')) candidates.push(path.join(ROOT, 'src', rel, 'index.html'));
  }

  return candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + req.url);
    console.log(`  404  ${req.url}`);
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(body);
  console.log(`  200  ${req.url}  ->  ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`静态服务器已启动: http://127.0.0.1:${PORT}  (${USE_DIST ? 'dist 生产态' : 'src 开发态'})`);
});
