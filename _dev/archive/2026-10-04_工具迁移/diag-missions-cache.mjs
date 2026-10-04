#!/usr/bin/env node
/**
 * tools/diag-missions-cache.mjs —— 验证任务直达的缓存是否真正生效
 * 逐步打印：缓存内容 → 是否立即绘制 → Worker 返回 → 最终状态
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5227;
const CDP = 9222;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

const email = `qa_cache_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '缓存测试', role: 'self' } }),
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
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskSlug: 'demo-breath', taskTitle: '缓存测试任务', taskType: 'task' }),
});

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

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
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, 40000);
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

console.log('════════ 任务直达缓存诊断 ════════\n');

// 建立会话
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(5000);
const sess = await js(`(async function(){
  var m = await import('/src/shared/js/supabase-client.js');
  var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
  return r.error ? 'err:' + r.error.message : 'ok';
})()`);
console.log(`  1. setSession: ${sess}`);

// 第一次加载：写缓存
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(9000);
const c1 = await js(`localStorage.getItem('foxsir_missions_cache')`);
console.log(`  2. 首次加载后缓存: ${c1 ? String(c1).slice(0, 110) : '❌ 未写入'}`);
const s1 = await js(`document.querySelectorAll('.ms-item').length`);
console.log(`     条目数: ${s1}`);

// 第二次加载：应命中缓存
console.log('\n  ── 第二次加载（应命中缓存）──');
await send('Page.navigate', { url: BASE + '/' }, sessionId);
const T0 = Date.now();
let cachedPaintAt = null, freshPaintAt = null;
while (Date.now() - T0 < 8000) {
  const n = await js(`document.querySelectorAll('.ms-item').length`);
  if (typeof n === 'number' && n > 0) { cachedPaintAt = Date.now() - T0; break; }
  await sleep(40);
}
const c2 = await js(`localStorage.getItem('foxsir_missions_cache')`);
console.log(`  3. 条目首次出现于: ${cachedPaintAt === null ? '未出现' : cachedPaintAt + ' ms'}`);
console.log(`     缓存仍在: ${c2 ? '是' : '否'}`);

// 直接量一次 Worker 往返
console.log('\n  ── Worker 往返耗时 ──');
const t1 = Date.now();
await js(`(async function(){
  var ta = await import('/src/shared/js/task-api.js');
  await ta.myTasks('accepted');
  return 'done';
})()`, 40000);
console.log(`     myTasks 一次往返: ${Date.now() - t1} ms`);

const t2 = Date.now();
await js(`(async function(){
  var a = await import('/src/shared/js/auth.js');
  await a.getCurrentUser();
  return 'done';
})()`, 40000);
console.log(`     getCurrentUser 一次: ${Date.now() - t2} ms`);

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(0);
