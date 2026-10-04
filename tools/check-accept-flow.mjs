#!/usr/bin/env node
/**
 * tools/check-accept-flow.mjs —— 端到端验证「接取任务」流程
 *
 * 用真实测试账号登录本地站点，打开一篇内容，
 * 点击「接取任务」，核对按钮状态与 D1 记录。
 *
 * 用法：node tools/check-accept-flow.mjs --port 5194
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5194));
const CDP = Number(getArg('--cdp', 9222));
const BASE = `http://127.0.0.1:${PORT}`;
const SLUG = getArg('--slug', 'zz-e2e-task');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const fails = [];
const check = (label, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${label}${extra ? '  →  ' + extra : ''}`); }
  else { fails.push(label); console.log(`  ✗ ${label}${extra ? '  →  ' + extra : ''}`); }
};

// ── 1. 确保仓库里有一篇可接取的内容（通过 Worker 的发布接口写入）
console.log('════════ 接取流程端到端验证 ════════\n');
console.log('── 步骤 1：准备测试账号 ──');

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');
const email = `qa_e2e_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';

let token = null;
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '接取测试', role: 'self' } }),
});
const suj = await su.json().catch(() => ({}));
token = suj.access_token;
if (!token) {
  const li = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const lij = await li.json().catch(() => ({}));
  token = lij.access_token;
}
check('取得测试账号 token', !!token, email);
if (!token) process.exit(1);

// ── 2. 启动本地服务
console.log('\n── 步骤 2：启动本地站点 ──');
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  cwd: process.cwd(), stdio: 'ignore', detached: false,
});
await sleep(9000);
try {
  const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) });
  check('本地站点已启动', r.ok, BASE);
} catch (e) {
  check('本地站点已启动', false, e.message);
  vite.kill();
  process.exit(1);
}

// ── 3. 用 CDP 打开页面并注入登录态
console.log('\n── 步骤 3：浏览器内验证 ──');
const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 0; const pending = new Map(); const errs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    errs.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
  }
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

const js = async (expr, t = 30000) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

// 注入 Supabase 会话
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(4000);

const key = 'sb-mfexambabgxytkrkhmwx-auth-token';
const injected = await js(`(function(){
  try {
    localStorage.setItem(${JSON.stringify(key)}, JSON.stringify({
      access_token: ${JSON.stringify(token)},
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now()/1000) + 3600,
      refresh_token: 'x',
      user: { id: 'e2e', email: ${JSON.stringify(email)} }
    }));
    return 'ok';
  } catch(e) { return 'err: ' + e.message; }
})()`);
check('注入登录会话到 localStorage', injected === 'ok', String(injected));

// 打开内容详情页
await send('Page.navigate', { url: `${BASE}/modules/content/post.html?slug=${encodeURIComponent(SLUG)}` }, sessionId);
await sleep(7000);

const state = await js(`(function(){
  var b = document.getElementById('acceptBtn');
  return JSON.stringify({
    exists: !!b,
    display: b ? getComputedStyle(b).display : 'n/a',
    text: b ? b.textContent.trim() : '',
    mode: b ? (b.dataset.mode || '') : '',
    disabled: b ? b.disabled : null,
    pageErr: (document.querySelector('.st-t1') || {}).textContent || ''
  });
})()`);
let s = {};
try { s = JSON.parse(state); } catch {}

console.log(`     详情页状态: ${JSON.stringify(s).slice(0, 200)}`);

if (s.pageErr && /找不到|未配置|格式异常/.test(s.pageErr)) {
  console.log(`\n  ⚠️ 详情页未能加载内容（${s.pageErr}）`);
  console.log('     —— 这是内容分支配置问题，非接取功能本身的问题。');
  console.log('     接取按钮依赖详情页加载成功后才渲染。');
  check('详情页加载内容', false, s.pageErr);
} else {
  check('接取按钮已渲染', s.exists === true, `display=${s.display}`);
  check('按钮可见', s.display !== 'none', `mode=${s.mode}`);
  check('按钮文案为「接取任务」', /接取/.test(s.text || ''), s.text);

  if (s.exists && s.display !== 'none' && s.mode === 'accept') {
    console.log('\n── 步骤 4：点击接取 ──');
    await js(`document.getElementById('acceptBtn').click()`);
    await sleep(6000);

    const after = await js(`(function(){
      var b = document.getElementById('acceptBtn');
      return JSON.stringify({ text: b.textContent.trim(), mode: b.dataset.mode||'', disabled: b.disabled });
    })()`);
    let a = {};
    try { a = JSON.parse(after); } catch {}
    console.log(`     点击后: ${JSON.stringify(a)}`);
    check('点击后按钮变为「已接取」', /已接取/.test(a.text || ''), a.text);
    check('按钮进入 goto 模式', a.mode === 'goto', a.mode);

    // 核对 D1
    console.log('\n── 步骤 5：核对 D1 记录 ──');
    const mine = await fetch('https://foxsir-task-api.hzb0705.workers.dev/api/tasks/mine', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const mj = await mine.json().catch(() => ({}));
    const rec = (mj.tasks || []).find((t) => t.task_slug === SLUG);
    check('D1 已写入接取记录', !!rec, rec ? `status=${rec.status} title=${rec.task_title}` : `tasks=${(mj.tasks||[]).length}`);
  }
}

const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 140));

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
