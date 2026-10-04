#!/usr/bin/env node
/**
 * tools/diag-accept-btn.mjs —— 诊断接取按钮为何不显示
 * 逐项检查 setupAcceptButton 的判定条件
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5202;
const CDP = 9222;
const BASE = `http://127.0.0.1:${PORT}`;
const SLUG = process.argv[2] || '酒店';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

const email = `qa_diag_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: 'diag', role: 'self' } }),
});
const suj = await su.json().catch(() => ({}));
const token = suj.access_token, refresh = suj.refresh_token;

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
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' timeout')); } }, 40000);
    pending.set(mid, { resolve, reject, timer });
  });
};
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(4000);

console.log('════════ 诊断接取按钮 ════════\n');
console.log(`  TASK_API_BASE = ${TASK_API_BASE || '(空！)'}`);

const sess = await js(`(async function(){
  var mod = await import('/src/shared/js/supabase-client.js');
  var r = await mod.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
  localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)});
  return r.error ? 'err: ' + r.error.message : 'ok';
})()`);
console.log(`  setSession: ${sess}`);

await send('Page.navigate', { url: `${BASE}/modules/content/post.html?slug=${encodeURIComponent(SLUG)}` }, sessionId);
await sleep(8000);

console.log('\n── 逐项检查 ──');

const checks = await js(`(async function(){
  var out = {};
  try {
    var cfg = await import('/src/shared/js/config.js');
    out.taskApiBase = cfg.TASK_API_BASE || '(空)';
    out.taskApiReady = cfg.hasTaskApi ? cfg.hasTaskApi() : 'no-fn';

    var auth = await import('/src/shared/js/auth.js');
    var me = await auth.getCurrentUser();
    out.currentUser = me ? (me.email || me.id) : null;

    var ta = await import('/src/shared/js/task-api.js');
    var r = await ta.myTasks('all');
    out.myTasksOk = r.ok;
    out.myTasksErr = r.error || '';
    out.myTasksCount = (r.tasks || []).length;
  } catch(e) { out.err = e.message; }

  out.bodyHasDetail = !!document.querySelector('.detail h1, .detail');
  out.acceptBtnExists = !!document.getElementById('acceptBtn');
  out.acceptBtnDisplay = out.acceptBtnExists ? getComputedStyle(document.getElementById('acceptBtn')).display : 'n/a';
  out.acceptBtnText = out.acceptBtnExists ? document.getElementById('acceptBtn').textContent.trim() : '';
  out.detailTitle = (document.querySelector('.d-title, .detail h1') || {}).textContent || '(无)';
  return JSON.stringify(out, null, 1);
})()`, 40000);

console.log(String(checks).split('\n').map((l) => '    ' + l).join('\n'));

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(0);
