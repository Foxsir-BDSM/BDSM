#!/usr/bin/env node
/**
 * tools/diag-accept-click.mjs —— 诊断点击接取按钮为何无反应
 * 捕获 console 输出、toast 文案、以及点击前后的内外部状态
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5206;
const CDP = 9222;
const BASE = `http://127.0.0.1:${PORT}`;
const SLUG = process.argv[2] || 'zz-端到端测试任务';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

const email = `qa_click_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: 'click', role: 'self' } }),
});
const suj = await su.json().catch(() => ({}));
const token = suj.access_token, refresh = suj.refresh_token;

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res) => ws.addEventListener('open', res, { once: true }));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push('[' + m.params.type + '] ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('[异常] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0]);
  }
});
const send = (method, params = {}, sessionId) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' timeout')); } }, 45000);
    pending.set(mid, { resolve, reject, timer });
  });
};
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
const js = async (expr, t = 40000) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId, t);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(4500);
await js(`(async function(){
  var mod = await import('/src/shared/js/supabase-client.js');
  await mod.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
  localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)});
  return 'ok';
})()`);

await send('Page.navigate', { url: `${BASE}/modules/content/post.html?slug=${encodeURIComponent(SLUG)}` }, sessionId);
await sleep(9000);

console.log('════════ 点击诊断 ════════\n');
console.log(`  Worker: ${TASK_API_BASE}\n`);

const before = await js(`(function(){
  var b = document.getElementById('acceptBtn');
  return JSON.stringify({
    display: b ? getComputedStyle(b).display : 'n/a',
    text: b ? b.textContent.trim() : '',
    mode: b ? (b.dataset.mode||'') : '',
    disabled: b ? b.disabled : null,
    toasts: [].map.call(document.querySelectorAll('.toast, #toastContainer *'), function(t){ return t.textContent.trim(); })
  });
})()`);
console.log(`  点击前: ${before}`);

// 直接调接口，看 Worker 本身是否可用（绕开按钮）
console.log('\n── 直接调 Worker 的 accept 接口 ──');
const direct = await js(`(async function(){
  try {
    var ta = await import('/src/shared/js/task-api.js');
    var r = await ta.acceptTask({ slug: ${JSON.stringify(SLUG)}, title: '直调测试', type: 'task' });
    return JSON.stringify(r);
  } catch(e) { return 'err: ' + e.message; }
})()`, 45000);
console.log(`  ${String(direct).slice(0, 300)}`);

console.log('\n── 点击按钮 ──');
await js(`document.getElementById('acceptBtn').click()`);
await sleep(7000);

const after = await js(`(function(){
  var b = document.getElementById('acceptBtn');
  return JSON.stringify({
    text: b.textContent.trim(),
    mode: b.dataset.mode||'',
    disabled: b.disabled,
    toasts: [].map.call(document.querySelectorAll('.toast, #toastContainer *'), function(t){ return t.textContent.trim(); }).filter(Boolean)
  });
})()`);
console.log(`  点击后: ${after}`);

console.log('\n── 页面 console 输出 ──');
if (logs.length) logs.slice(-14).forEach((l) => console.log('    ' + l));
else console.log('    （无）');

// 核对 D1
console.log('\n── D1 记录核对 ──');
const mine = await fetch(`${TASK_API_BASE}/api/tasks/mine`, { headers: { Authorization: `Bearer ${token}` } });
const mj = await mine.json().catch(() => ({}));
console.log(`    HTTP ${mine.status}  记录数 ${(mj.tasks || []).length}`);
(mj.tasks || []).forEach((t) => console.log(`      · ${t.task_slug}  [${t.status}]`));

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(0);
