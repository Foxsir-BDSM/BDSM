#!/usr/bin/env node
/**
 * tools/edge-debug.mjs —— Edge 调试端口开关
 * ============================================================
 *
 * 【用途】
 *   让 AI 助手能接管你的 Edge 浏览器（后台配置、页面验证等自动化操作）。
 *
 * 【为什么需要它】
 *   浏览器的调试能力（CDP）只能通过启动参数开启，运行中无法追加。
 *   本脚本会：完全退出 Edge → 带调试参数重新启动（登录状态保留在磁盘上）。
 *
 * 【安全说明】
 *   开启后，本机任何程序都能通过该端口读取你**所有已登录网站**的会话。
 *   建议「需要时开启，用完关闭」。
 *
 * 【用法】
 *   node tools/edge-debug.mjs           开启（会先关闭 Edge）
 *   node tools/edge-debug.mjs --check   查看当前状态
 *   node tools/edge-debug.mjs --stop    关闭调试并提示如何正常重启
 */
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.EDGE_DEBUG_PORT || 9222);
const args = process.argv.slice(2);
const MODE = args.includes('--check') ? 'check' : args.includes('--stop') ? 'stop' : 'start';

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
];

function findEdge() {
  return EDGE_CANDIDATES.find((p) => p && fs.existsSync(p)) || null;
}

async function debugStatus() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { on: false };
    return { on: true, info: await r.json() };
  } catch {
    return { on: false };
  }
}

function edgeProcessCount() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq msedge.exe" /NH', { encoding: 'utf8' });
    return (out.match(/msedge\.exe/gi) || []).length;
  } catch {
    return 0;
  }
}

function killEdge() {
  try {
    execSync('taskkill /F /IM msedge.exe /T', { stdio: 'ignore' });
  } catch {
    /* 已经没有进程了 */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════

const edge = findEdge();
if (!edge) {
  console.error('✗ 找不到 msedge.exe。请手动确认 Edge 安装路径。');
  process.exit(1);
}

if (MODE === 'check') {
  const s = await debugStatus();
  const n = edgeProcessCount();
  console.log('');
  console.log(`  Edge 进程数      : ${n}`);
  if (s.on) {
    console.log(`  调试端口 ${PORT}   : ✅ 已开启`);
    console.log(`  浏览器           : ${s.info.Browser}`);
    console.log(`  可接管地址       : ${s.info.webSocketDebuggerUrl}`);
  } else {
    console.log(`  调试端口 ${PORT}   : ✗ 未开启`);
    console.log(`  开启命令         : node tools/edge-debug.mjs`);
  }
  console.log('');
  process.exit(0);
}

if (MODE === 'stop') {
  console.log('\n  正在关闭 Edge…');
  killEdge();
  await sleep(3000);
  console.log('  已关闭。');
  console.log('  以下命令可正常重启 Edge：');
  console.log(`    Start-Process "${edge}"`);
  console.log('');
  process.exit(0);
}

// ── 开启
console.log('\n════════ Edge 调试模式 ════════\n');

const before = await debugStatus();
if (before.on) {
  console.log(`  ✅ 调试端口 ${PORT} 已开启，无需重复操作`);
  console.log(`     可接管地址: ${before.info.webSocketDebuggerUrl}\n`);
  process.exit(0);
}

const n = edgeProcessCount();
if (n > 0) {
  console.log(`  ⚠️  检测到 ${n} 个 Edge 进程，需要先全部关闭`);
  console.log('     （登录状态存在磁盘上，重启后会自动保留）');
  console.log('');
  console.log('  3 秒后自动关闭…按 Ctrl+C 可取消');
  await sleep(3000);
  killEdge();
  await sleep(3500);
  console.log('  ✓ 已关闭\n');
}

console.log('  正在以调试模式启动 Edge…');
spawn(edge, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref();
await sleep(6000);

const after = await debugStatus();
if (after.on) {
  console.log('\n  ✅ 开启成功');
  console.log(`     接管地址: ${after.info.webSocketDebuggerUrl}\n`);
  console.log('  ⚠️  安全提醒：现在本机任何程序都能读取你所有已登录网站的会话。');
  console.log('      用完后请执行：  node tools/edge-debug.mjs --stop\n');
} else {
  console.log('\n  ✗ 启动后仍未检测到调试端口');
  console.log('    可能原因：Edge 后台进程未完全退出，或当前版本限制了默认配置目录。');
  console.log('    请再执行一次本脚本。\n');
  process.exit(1);
}
