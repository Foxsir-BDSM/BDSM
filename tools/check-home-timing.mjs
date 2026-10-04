#!/usr/bin/env node
/**
 * tools/check-home-timing.mjs —— 测量首页各区块的出现时刻
 *
 * 目的：确认「导航栏 / 模块卡片 / 任务直达」是否同频出现。
 * 做法：从导航开始计时，轮询三个区块的内容是否已渲染，记录各自耗时。
 *
 * 用法：
 *   node tools/check-home-timing.mjs --port 5211 [--login]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5211));
const CDP = Number(getArg('--cdp', 9222));
const WITH_LOGIN = argv.includes('--login');
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

let token = null, refresh = null;
if (WITH_LOGIN) {
  const email = `qa_time_${Date.now().toString().slice(-8)}@foxsir-test.local`;
  const PASS = 'Qa!123456';
  const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS, data: { nickname: '时序测试', role: 'self' } }),
  });
  const suj = await su.json().catch(() => ({}));
  token = suj.access_token; refresh = suj.refresh_token;
  if (!token) {
    const li = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASS }),
    });
    const lij = await li.json().catch(() => ({}));
    token = lij.access_token; refresh = lij.refresh_token;
  }
  console.log(`  测试账号: ${email}\n`);
}

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
    logs.push('[' + m.params.type + '] ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('[异常] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0]);
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
const js = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

// 先登录（如需要）
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(4500);
if (WITH_LOGIN && token) {
  const s = await js(`(async function(){
    try {
      var m = await import('/src/shared/js/supabase-client.js');
      var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
      localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)});
      return r.error ? 'err' : 'ok';
    } catch(e) { return 'err:' + e.message; }
  })()`);
  console.log(`  会话: ${s}`);

  // 可选：先接取一个任务，好让「任务直达」区块有内容可显示
  if (argv.includes('--accept')) {
    const slug = getArg('--accept-slug', 'demo-breath');
    const direct = await fetch('https://foxsir-task-api.hzb0705.workers.dev/api/tasks/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskSlug: slug, taskTitle: '时序测试任务', taskType: 'task' }),
    });
    const dj = await direct.json().catch(() => ({}));
    console.log(`  预接取 ${slug}: ${direct.status} ${dj.ok ? 'ok' : JSON.stringify(dj).slice(0, 80)}`);
  }
}

console.log('════════ 首页区块出现时刻 ════════\n');

const RUNS = Number(getArg('--runs', 3));
const results = [];

for (let run = 1; run <= RUNS; run++) {
  await send('Page.navigate', { url: BASE + '/' }, sessionId);
  const T0 = Date.now();
  const marks = { nav: null, cards: null, items: null };
  while (Date.now() - T0 < 15000) {
    const st = await js(`(function(){
      var nav = document.querySelector('.um-trigger');
      var cards = document.querySelectorAll('.project-card').length;
      var items = document.querySelectorAll('.ms-item').length;
      return JSON.stringify({
        navReady: !!nav && (nav.innerText||'').trim().length > 0,
        cards: cards, items: items
      });
    })()`);
    let s = {};
    try { s = JSON.parse(st); } catch {}
    const t = Date.now() - T0;
    if (marks.nav === null && s.navReady) marks.nav = t;
    if (marks.cards === null && s.cards > 0) marks.cards = t;
    if (marks.items === null && s.items > 0) marks.items = t;
    if (marks.nav !== null && marks.cards !== null) break;
    await sleep(80);
  }
  // 导航栏与卡片都出现后，再给任务直达留出网络往返的时间
  if (marks.nav !== null && marks.cards !== null) {
    const extraStart = Date.now() - T0;
    while (Date.now() - T0 < extraStart + 8000) {
      const st = await js(`document.querySelectorAll('.ms-item').length`);
      if (typeof st === 'number' && st > 0) { marks.items = Date.now() - T0; break; }
      await sleep(150);
    }
    if (marks.items === null) {
      // 仍未出现：记录最后的真实状态，便于定位
      const last = await js(`(function(){
        var sec = document.getElementById('missionsSection');
        return JSON.stringify({ items: document.querySelectorAll('.ms-item').length, hidden: sec ? sec.hidden : null });
      })()`);
      marks.lastState = last;
    }
  }

  results.push(marks);
  const navState = await js(`(function(){
    var t = document.querySelector('.um-trigger');
    var sec = document.getElementById('missionsSection');
    return JSON.stringify({
      nav: t ? (t.innerText||'').replace(/\\s+/g,' ').trim().slice(0, 30) : '(无)',
      secExists: !!sec,
      secHidden: sec ? sec.hidden : null,
      items: document.querySelectorAll('.ms-item').length
    });
  })()`);
  let ns = {};
  try { ns = JSON.parse(navState); } catch {}
  console.log(`  第 ${run} 次:  导航栏 ${String(marks.nav).padStart(5)} ms   卡片 ${String(marks.cards).padStart(5)} ms   任务条目 ${marks.items === null ? '无' : marks.items + ' ms'}`);
  console.log(`            导航栏内容「${ns.nav}」  区块存在=${ns.secExists} 隐藏=${ns.secHidden} 条目数=${ns.items}`);
  if (marks.items === null && logs.length) {
    const relevant = logs.filter((l) => /任务|missions|worker|Failed|异常|超时/i.test(l));
    if (relevant.length) {
      console.log('            ── 相关 console ──');
      relevant.slice(-6).forEach((l) => console.log('              ' + l));
    }
  }
  await sleep(500);
}

const avg = (k) => {
  const v = results.map((r) => r[k]).filter((x) => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const navAvg = avg('nav'), cardAvg = avg('cards'), itemAvg = avg('items');

console.log('\n── 平均 ──');
console.log(`  顶部导航栏   : ${navAvg === null ? '未出现' : navAvg + ' ms'}`);
console.log(`  模块卡片     : ${cardAvg === null ? '未出现' : cardAvg + ' ms'}`);
if (itemAvg !== null) console.log(`  任务直达条目 : ${itemAvg} ms`);

console.log('\n── 判读 ──');if (navAvg !== null && cardAvg !== null) {
  const gap = Math.abs(navAvg - cardAvg);
  console.log(`  导航栏与卡片的时间差: ${gap} ms  ${gap < 400 ? '✅ 同频' : gap < 800 ? '🟡 略有先后' : '⚠️ 有明显先后'}`);
}
if (itemAvg !== null && navAvg !== null) {
  const gap2 = itemAvg - navAvg;
  console.log(`  任务直达比导航栏晚  : ${gap2} ms  ${gap2 < 600 ? '✅ 同频' : '⚠️ 偏晚'}`);
}

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(0);
