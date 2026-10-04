#!/usr/bin/env node
/**
 * tools/check-sticky-column.mjs —— 验证两个表格首列在横向滚动后仍固定
 *
 * 做法：把 .table-scroll 滚到最右，再量首列的位置。
 *       sticky 生效 → 首列左边界仍在容器内（约等于容器左边界）；
 *       未生效     → 首列被一起滚走，左边界变负。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5270));
const CDP = Number(getArg('--cdp', 9870));
const BASE = `http://127.0.0.1:${PORT}`;
const W = Number(getArg('--w', 410));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (l, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${l}${extra ? '  →  ' + String(extra).slice(0, 90) : ''}`); }
  else { fails.push(l); console.log(`  ✗ ${l}${extra ? '  →  ' + String(extra).slice(0, 130) : ''}`); }
};

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

const email = `qa_sticky_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '首列测试', role: 'admin' } }),
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

const PROFILE = path.join(os.tmpdir(), 'foxsir-sticky');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', `--window-size=${W},820`,
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
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, 50000);
    pending.set(mid, { resolve, reject, timer });
  });
};
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: 820, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
const js = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

console.log(`════ 首列固定验证（${W}px 手机视口）════════\n`);

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

await send('Page.navigate', { url: `${BASE}/admin.html` }, sessionId);
await sleep(11000);

/** 滚到最右并量首列位置 */
const measure = async (which) => {
  const expr = `(function(){
    var q = ${which === 'user' ? `document.getElementById('userTableContainer')` : `document.getElementById('subRecordsContainer')`};
    if (!q) return JSON.stringify({ err: 'no-container' });
    var wrap = q.querySelector('.table-scroll');
    var table = q.querySelector('.admin-table');
    if (!wrap || !table) return JSON.stringify({ err: 'no-wrap', hasWrap: !!wrap, hasTable: !!table, html: (q.innerHTML||'').slice(0,80) });

    var th0 = table.querySelector('thead th');
    var td0 = table.querySelector('tbody td');
    if (!th0 || !td0) return JSON.stringify({ err: 'no-cell' });

    var tds = table.querySelectorAll('tbody td');
    var td2 = tds[2];   // 非首列，作对照

    // ── 滚动前 ──
    var wrapRect = wrap.getBoundingClientRect();
    var beforeTh = Math.round(th0.getBoundingClientRect().left);
    var beforeTd = Math.round(td0.getBoundingClientRect().left);
    var beforeTd2 = td2 ? Math.round(td2.getBoundingClientRect().left) : null;
    var cs = getComputedStyle(td0);

    // ── 滚到最右 ──
    wrap.scrollLeft = wrap.scrollWidth;

    // ── 滚动后 ──
    var afterTh = Math.round(th0.getBoundingClientRect().left);
    var afterTd = Math.round(td0.getBoundingClientRect().left);
    var afterTd2 = td2 ? Math.round(td2.getBoundingClientRect().left) : null;

    return JSON.stringify({
      wrapLeft: Math.round(wrapRect.left),
      wrapW: Math.round(wrapRect.width),
      scrollW: wrap.scrollWidth,
      scrolled: Math.round(wrap.scrollLeft),
      position: cs.position,
      background: cs.backgroundColor,
      beforeTh: beforeTh, afterTh: afterTh,
      beforeTd: beforeTd, afterTd: afterTd,
      beforeTd2: beforeTd2, afterTd2: afterTd2,
      thText: th0.textContent.trim(),
      firstText: (td0.textContent || '').trim().slice(0, 14)
    });
  })()`;
  const raw = await js(expr);
  try { return JSON.parse(raw); } catch { return { err: String(raw).slice(0, 120) }; }
};

const evalTable = async (which, label) => {
  console.log(`── ${label} ──`);
  const m = await measure(which);
  if (m.err) { check(`${label} 表格可测`, false, `${m.err} ${m.html || ''}`); console.log(''); return; }

  console.log(`     容器左 ${m.wrapLeft} 宽 ${m.wrapW}  内容宽 ${m.scrollW}  已滚动 ${m.scrolled}`);
  console.log(`     首列 position=${m.position}  background=${m.background}`);
  console.log(`     表头首格 left: ${m.beforeTh} → ${m.afterTh}`);
  console.log(`     首列单元格 left: ${m.beforeTd} → ${m.afterTd}   「${m.firstText}」`);
  console.log(`     第三列 left（对照）: ${m.beforeTd2} → ${m.afterTd2}`);

  check(`${label} 首列 position: sticky`, m.position === 'sticky', m.position);
  check(`${label} 已真的滚动`, m.scrolled > 10, `scrollLeft=${m.scrolled}`);
  check(`${label} ★ 滚动后首列仍在容器内`,
    m.afterTd >= m.wrapLeft - 2 && m.afterTd <= m.wrapLeft + 6,
    `容器左 ${m.wrapLeft}，首列 ${m.afterTd}`);
  check(`${label} ★ 表头首格也固定`, Math.abs(m.afterTh - m.afterTd) < 4, `${m.afterTh} vs ${m.afterTd}`);
  // 对照：非首列应当确实被滚走（位移量约等于 scrollLeft）
  const moved = m.beforeTd2 !== null && m.afterTd2 !== null ? m.beforeTd2 - m.afterTd2 : 0;
  check(`${label} 非首列确实被滚走（对照）`, moved > 10, `第三列位移 ${moved}px（scrollLeft ${m.scrolled}）`);
  check(`${label} 首列背景为实色（非透明）`,
    m.background && !/rgba\(0, 0, 0, 0\)|transparent/.test(m.background), m.background);
  console.log('');
};

await evalTable('user', '用户权限表');
await js(`(function(){ var b=document.getElementById('tabSubArchive'); if(b) b.click(); return 'ok'; })()`);
await sleep(6000);
await evalTable('archive', '全部档案表');

const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
fs.writeFileSync(path.join(OUT, 'sticky-column.png'), Buffer.from(shot.data, 'base64'));

console.log(`───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('  截图: .shots/runtime/sticky-column.png');
console.log('═══════════════════════════════');

chrome.kill('SIGKILL');
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
