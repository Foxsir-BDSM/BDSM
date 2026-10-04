#!/usr/bin/env node
/**
 * tools/diag-home-missions.mjs —— 诊断首页任务直达为何不显示
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5219;
const CDP = 9222;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

const email = `qa_diagm_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: 'diagm', role: 'self' } }),
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

// 预接取
const acc = await fetch(`${TASK_API_BASE}/api/tasks/accept`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskSlug: 'demo-breath', taskTitle: '诊断任务', taskType: 'task' }),
});
const accj = await acc.json().catch(() => ({}));
console.log(`  预接取: HTTP ${acc.status}  ${JSON.stringify(accj).slice(0, 120)}`);

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

// 建立会话
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(4500);
const sess = await js(`(async function(){
  try {
    var m = await import('/src/shared/js/supabase-client.js');
    var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
    return r.error ? 'err:' + r.error.message : 'ok';
  } catch(e) { return 'err:' + e.message; }
})()`);
console.log(`  setSession: ${sess}`);

// 重新加载首页
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(9000);

console.log('\n════════ 首页任务直达诊断 ════════\n');

const diag = await js(`(async function(){
  var out = {};
  try {
    var cfg = await import('/src/shared/js/config.js');
    out.taskApiReady = cfg.hasTaskApi ? cfg.hasTaskApi() : 'no-fn';

    var auth = await import('/src/shared/js/auth.js');
    var cached = auth.getCachedUser();
    out.cachedUser = cached ? (cached.email || cached.id) : null;

    var me = await auth.getCurrentUser();
    out.currentUser = me ? (me.email || me.id) : null;

    var ta = await import('/src/shared/js/task-api.js');
    var r = await ta.myTasks('accepted');
    out.myTasksOk = r.ok;
    out.myTasksErr = r.error || '';
    out.tasks = (r.tasks || []).map(function(t){ return t.task_slug + '[' + t.status + ']'; });
  } catch(e) { out.err = e.message; }

  var sec = document.getElementById('missionsSection');
  out.secExists = !!sec;
  out.secHidden = sec ? sec.hidden : null;
  out.itemCount = document.querySelectorAll('.ms-item').length;
  out.navText = ((document.querySelector('.um-trigger')||{}).innerText||'').replace(/\\s+/g,' ').slice(0,40);
  return JSON.stringify(out, null, 1);
})()`, 45000);

console.log(String(diag).split('\n').map((l) => '    ' + l).join('\n'));

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(0);
