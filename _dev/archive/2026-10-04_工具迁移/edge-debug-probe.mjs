#!/usr/bin/env node
/**
 * tools/edge-debug-probe.mjs —— 诊断 Edge 调试端口为何开不起来
 *
 * 对照实验：
 *   A. 默认配置目录 + 调试端口  → 若失败，说明被版本限制
 *   B. 独立配置目录 + 调试端口  → 若成功，确认是配置目录的限制
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const probe = async (port) => {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

const kill = (name) => {
  try { execSync(`taskkill /F /IM ${name} /T`, { stdio: 'ignore' }); } catch {}
};

const edgeVersion = () => {
  try {
    const out = execSync(`wmic datafile where name="${EDGE.replace(/\\/g, '\\\\')}" get Version /value`, { encoding: 'utf8' });
    const m = out.match(/Version=([\d.]+)/);
    return m ? m[1] : '?';
  } catch {
    return '?';
  }
};

console.log('════════ Edge 调试端口诊断 ════════\n');
console.log(`  Edge 路径   : ${EDGE}`);
console.log(`  Edge 版本   : ${edgeVersion()}\n`);

// ── 实验 A：默认配置目录
console.log('── 实验 A：默认配置目录 + 调试端口 ──');
console.log('   关闭所有 Edge…');
kill('msedge');
await sleep(4000);
console.log('   启动中（不加 --user-data-dir）…');
spawn(EDGE, ['--remote-debugging-port=9222', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
await sleep(7000);
const a = await probe(9222);
if (a) {
  console.log(`   ✅ 成功  ${a.Browser}`);
  console.log('   → 版本未限制默认配置目录，之前的失败可能是进程未退干净');
} else {
  console.log('   ✗ 失败 —— 端口未监听');
  console.log('   → 佐证 Edge 136+ 对默认配置目录的限制');
}
kill('msedge');
await sleep(3000);

// ── 实验 B：独立配置目录
console.log('\n── 实验 B：独立配置目录 + 调试端口 ──');
const profile = path.join(os.tmpdir(), 'edge-debug-probe');
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(profile, { recursive: true });
console.log(`   配置目录: ${profile}`);
spawn(EDGE, [`--user-data-dir=${profile}`, '--remote-debugging-port=9223', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
await sleep(9000);
const b = await probe(9223);
if (b) {
  console.log(`   ✅ 成功  ${b.Browser}`);
  console.log('   → 确认：调试端口本身可用，限制只在默认配置目录');
} else {
  console.log('   ✗ 失败 —— 独立配置目录也开不起来');
  console.log('   → 可能是策略限制或安全软件拦截');
}

// 清理实验用实例
try { execSync('taskkill /F /FI "WINDOWTITLE eq about:blank*" /T', { stdio: 'ignore' }); } catch {}
kill('msedge');
await sleep(2000);

console.log('\n════════ 结论 ════════');
if (a) {
  console.log('  默认配置目录可用 → 直接 node tools/edge-debug.mjs 即可');
} else if (b) {
  console.log('  默认配置目录被限制，但独立配置目录可用。');
  console.log('  代价：独立配置是全新浏览器，需重新登录 Cloudflare 与 GitHub。');
} else {
  console.log('  两种方式都失败，需改用界面手动操作。');
}
console.log('');
