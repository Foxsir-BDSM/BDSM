#!/usr/bin/env node
/**
 * tools/shot-editor-modes.mjs —— 给新版发布页截图（两个板块 + 手机端）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5234;
const CDP = 9820;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(process.cwd(), '.shots', 'runtime');
const PROFILE = path.join(os.tmpdir(), 'foxsir-editor-shot');
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

const email = `qa_shot_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '截图', role: 'self' } }),
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
await fetch(`${TASK_API_BASE}/api/tasks/accept`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskSlug: 'demo-breath', taskTitle: '截图用任务', taskType: 'task' }),
});

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

// 登录
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

// 桌面：内容发布板块
console.log('  截图：桌面 · 内容发布板块');
await send('Page.navigate', { url: `${BASE}/modules/content/post-editor.html` }, sessionId);
await sleep(11000);
let shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
fs.writeFileSync(path.join(OUT, 'editor-内容发布.png'), Buffer.from(shot.data, 'base64'));

// 桌面：任务反馈板块
console.log('  截图：桌面 · 任务反馈板块');
await js(`(function(){
  var b = document.querySelector('.mode-tab[data-mode="feedback"]');
  if (b) b.click();
  return 'ok';
})()`);
await sleep(4000);
shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
fs.writeFileSync(path.join(OUT, 'editor-任务反馈.png'), Buffer.from(shot.data, 'base64'));

// 手机端：内容发布
console.log('  截图：手机 · 内容发布板块');
await send('Emulation.setDeviceMetricsOverride', { width: 410, height: 805, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
await send('Page.navigate', { url: `${BASE}/modules/content/post-editor.html` }, sessionId);
await sleep(11000);
shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
fs.writeFileSync(path.join(OUT, 'editor-手机-内容发布.png'), Buffer.from(shot.data, 'base64'));

// 手机端：任务反馈
console.log('  截图：手机 · 任务反馈板块');
await js(`(function(){
  var b = document.querySelector('.mode-tab[data-mode="feedback"]');
  if (b) b.click();
  return 'ok';
})()`);
await sleep(4000);
shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
fs.writeFileSync(path.join(OUT, 'editor-手机-任务反馈.png'), Buffer.from(shot.data, 'base64'));

// 顺手量一下手机端发布页有无横向溢出
const m = await js(`(function(){
  var vw = document.documentElement.clientWidth;
  var bad = [];
  [].forEach.call(document.querySelectorAll('body *'), function(el){
    var r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 1) bad.push(el.tagName.toLowerCase() + '.' + ((el.className||'')+'').split(' ')[0] + ' right=' + Math.round(r.right));
  });
  return JSON.stringify({ vw: vw, docW: document.documentElement.scrollWidth, bad: bad.slice(0, 8) });
})()`);
console.log(`\n  手机端发布页: ${m}`);

chrome.kill('SIGKILL');
vite.kill('SIGKILL');
console.log('\n  截图已存到 .shots/runtime/');
