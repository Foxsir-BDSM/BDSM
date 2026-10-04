#!/usr/bin/env node
/**
 * tools/edge-cdp-launch.mjs —— 启动一个可接管的 Edge 实例（独立配置目录）
 *
 * 背景：Edge 136+ 禁止在默认配置目录上开启调试端口，
 *       故必须使用 --user-data-dir 指定独立目录。
 *
 * 用法：
 *   node tools/edge-cdp-launch.mjs            启动（端口 9222）
 *   node tools/edge-cdp-launch.mjs --port 9333
 *   node tools/edge-cdp-launch.mjs --reset    清空配置目录后启动
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 9222));
const RESET = argv.includes('--reset');
const PROFILE = path.join(os.tmpdir(), 'edge-cdp-profile');

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

if (!EDGE) {
  console.error('✗ 找不到 msedge.exe');
  process.exit(1);
}

if (RESET) fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const probe = async () => {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

const existing = await probe();
if (existing) {
  console.log(`\n  ✅ 端口 ${PORT} 已在运行：${existing.Browser}\n`);
  process.exit(0);
}

console.log('\n════════ 启动可接管的 Edge ════════\n');
console.log(`  Edge    : ${EDGE}`);
console.log(`  配置目录 : ${PROFILE}`);
console.log(`  调试端口 : ${PORT}`);
console.log('');

spawn(EDGE, [
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  'https://dash.cloudflare.com/',
  'https://github.com/settings/tokens',
], { detached: true, stdio: 'ignore' }).unref();

for (let i = 1; i <= 10; i++) {
  await sleep(1500);
  const v = await probe();
  if (v) {
    console.log(`  ✅ 启动成功（第 ${i} 次探测）`);
    console.log(`     ${v.Browser}`);
    console.log(`     接管地址: ${v.webSocketDebuggerUrl}\n`);
    console.log('  ── 已为你打开两个页面 ──');
    console.log('     · Cloudflare 控制台');
    console.log('     · GitHub Token 设置页');
    console.log('');
    console.log('  ⚠️  这是全新的浏览器配置，需要你**重新登录**这两个站点。');
    console.log('      登录完成后告诉我，我接管后续操作。\n');
    process.exit(0);
  }
}

console.log('  ✗ 启动后仍未检测到端口\n');
process.exit(1);
