#!/usr/bin/env node
/**
 * tools/diag-storage.mjs —— 查清登录态到底存在哪些 localStorage key
 * 这决定 getCachedUser() 该读哪个 key 才能稳定拿到用户。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5221;
const CDP = 9222;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

const email = `qa_store_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '存储测试', role: 'self' } }),
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

const dumpKeys = async (label) => {
  const keys = await js(`JSON.stringify(Object.keys(localStorage))`);
  let ks = [];
  try { ks = JSON.parse(keys); } catch {}
  console.log(`  ── ${label} ──`);
  console.log(`     localStorage keys (${ks.length}): ${ks.join(', ') || '(空)'}`);
  return ks;
};

console.log('════════ 登录态存储诊断 ════════\n');

await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(5000);
await dumpKeys('初始');

const sess = await js(`(async function(){
  try {
    var m = await import('/src/shared/js/supabase-client.js');
    var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
    return r.error ? 'err:' + r.error.message : 'ok';
  } catch(e) { return 'err:' + e.message; }
})()`);
console.log(`\n  setSession: ${sess}`);

await dumpKeys('setSession 之后（未刷新）');

// 各 key 的内容摘要
const detail = await js(`(function(){
  var out = {};
  Object.keys(localStorage).forEach(function(k){
    var v = localStorage.getItem(k) || '';
    var note = '';
    try {
      var j = JSON.parse(v);
      if (j && j.user) note = ' 有 user: ' + (j.user.email || j.user.id);
      else if (j && j.access_token) note = ' 有 access_token';
      else if (j && j.currentSession) note = ' 有 currentSession';
      else note = ' keys: ' + Object.keys(j).slice(0,6).join(',');
    } catch(e) { note = ' (非 JSON, 长度 ' + v.length + ')'; }
    out[k] = note;
  });
  return JSON.stringify(out, null, 1);
})()`);
console.log('\n  ── 各 key 内容 ──');
console.log(String(detail).split('\n').map((l) => '    ' + l).join('\n'));

// ★ 关键：刷新后还在不在
await send('Page.navigate', { url: BASE + '/?t=' + Date.now() }, sessionId);
await sleep(6000);
await dumpKeys('★ 刷新之后');

const after = await js(`(async function(){
  var out = {};
  try {
    var auth = await import('/src/shared/js/auth.js');
    var c = auth.getCachedUser();
    out.getCachedUser = c ? (c.email || c.id) : null;
    var u = await auth.getCurrentUser();
    out.getCurrentUser = u ? (u.email || u.id) : null;
  } catch(e) { out.err = e.message; }
  return JSON.stringify(out, null, 1);
})()`);
console.log('\n  ── 刷新后的用户读取 ──');
console.log(String(after).split('\n').map((l) => '    ' + l).join('\n'));

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(0);
