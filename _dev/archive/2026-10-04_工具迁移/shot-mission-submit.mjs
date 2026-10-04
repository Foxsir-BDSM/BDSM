#!/usr/bin/env node
/**
 * tools/shot-mission-submit.mjs —— 给任务直达按钮截图（桌面 + 手机）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5242;
const CDP = 9840;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(process.cwd(), '.shots', 'runtime');
const PROFILE = path.join(os.tmpdir(), 'foxsir-mission-shot');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

const email = `qa_mshot_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '阿柒', role: 'self' } }),
});
const suj = await su.json().catch(() => ({}));
let token = suj.access_token, refresh = suj.refresh_token;
if (!token) {
  const li = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const lij = await li.json().catch(() => ({}));
  token = lij.access_token; refresh = lij.refresh_token;
}
// 接两个任务，好看多行效果
for (const [slug, title, type] of [
  ['demo-breath', '【示例】三段呼吸放松', 'task'],
  ['demo-check', '【示例】沟通准备度自评', 'checklist'],
]) {
  await fetch(`${TASK_API_BASE}/api/tasks/accept`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskSlug: slug, taskTitle: title, taskType: type }),
  });
}

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1280,1000',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) break; } catch {}
  await sleep(300);
}

const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res) => ws.addEventListener('open', res, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
});
const send = (method, params = {}, sessionId) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, 45000);
    pending.set(mid, { resolve, reject, timer });
  });
};
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
const js = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(5500);
for (let i = 1; i <= 3; i++) {
  const s = await js(`(async function(){
    try {
      var m = await import('/src/shared/js/supabase-client.js');
      var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
      return r.error ? 'err' : 'ok';
    } catch(e) { return 'err'; }
  })()`);
  if (s === 'ok') break;
  await sleep(2500);
}
await js(`(function(){ localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)}); return 'ok'; })()`);

// 桌面：只截任务直达区域
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(11000);
const clip = await js(`(function(){
  var s = document.getElementById('missionsSection');
  if (!s) return 'null';
  var r = s.getBoundingClientRect();
  return JSON.stringify({ x: Math.max(0, r.x - 16), y: Math.max(0, r.y + window.scrollY - 12), w: Math.min(1280, r.width + 32), h: r.height + 24 });
})()`);
let C = null;
try { C = JSON.parse(clip); } catch {}
if (C) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: C.x, y: C.y, width: C.w, height: C.h, scale: 2 },
  }, sessionId);
  fs.writeFileSync(path.join(OUT, 'missions-桌面.png'), Buffer.from(shot.data, 'base64'));
  console.log('  ✅ .shots/runtime/missions-桌面.png');
} else {
  console.log('  ✗ 未找到任务直达区域');
}

// 手机端
await send('Emulation.setDeviceMetricsOverride', { width: 410, height: 805, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(11000);
const clip2 = await js(`(function(){
  var s = document.getElementById('missionsSection');
  if (!s) return 'null';
  var r = s.getBoundingClientRect();
  return JSON.stringify({ x: 0, y: Math.max(0, r.y + window.scrollY - 10), w: 410, h: r.height + 20 });
})()`);
let C2 = null;
try { C2 = JSON.parse(clip2); } catch {}
if (C2) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: C2.x, y: C2.y, width: C2.w, height: C2.h, scale: 2 },
  }, sessionId);
  fs.writeFileSync(path.join(OUT, 'missions-手机.png'), Buffer.from(shot.data, 'base64'));
  console.log('  ✅ .shots/runtime/missions-手机.png');
}

// 量一下手机端按钮热区
const mob = await js(`(function(){
  var b = document.querySelector('.ms-submit');
  if (!b) return '无按钮';
  var r = b.getBoundingClientRect();
  var cs = getComputedStyle(b);
  return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), display: cs.display, visible: cs.display !== 'none' });
})()`);
console.log(`\n  手机端按钮: ${mob}`);

chrome.kill('SIGKILL');
vite.kill('SIGKILL');
