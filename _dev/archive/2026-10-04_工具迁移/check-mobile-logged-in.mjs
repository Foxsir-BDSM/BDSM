#!/usr/bin/env node
/**
 * tools/check-mobile-logged-in.mjs —— 手机端 + 登录态的卡片按钮诊断
 *
 * 未登录时看不到接取按钮，所以必须在登录态下量。
 * 测量：按钮是否被卡片裁切、是否与类型徽章重叠、点击热区是否够大。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5231));
const BASE = getArg('--base', `http://127.0.0.1:${PORT}`);
const W = Number(getArg('--w', 410));
const H = Number(getArg('--h', 805));
const CDP = Number(getArg('--cdp', 9810));

const PROFILE = path.join(os.tmpdir(), 'foxsir-mobile-auth');
const OUT = path.join(process.cwd(), '.shots', 'runtime');
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

const email = `qa_mob_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '手机测试', role: 'self' } }),
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
// 先接一个任务，好让卡片显示「提交反馈」状态
await fetch(`${TASK_API_BASE}/api/tasks/accept`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskSlug: 'demo-stretch', taskTitle: '手机测试任务', taskType: 'collection' }),
});
console.log(`  账号: ${email}  已接取 demo-stretch\n`);

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', `--window-size=${W},${H}`,
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

const waitCDP = async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) return; } catch {}
    await sleep(300);
  }
  throw new Error('CDP 未就绪');
};

console.log(`════════ 手机端 + 登录态（${W}×${H}）════════\n`);

// 用本地开发服务器：生产构建里没有 /src/ 源码路径，无法注入登录态
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);
console.log(`  本地站点: ${BASE}\n`);

try {
  await waitCDP();
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
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
  const js = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  // 登录
  await send('Page.navigate', { url: BASE + '/' }, sessionId);
  await sleep(6000);
  let sess = '';
  for (let i = 1; i <= 3; i++) {
    sess = await js(`(async function(){
      try {
        var m = await import('/src/shared/js/supabase-client.js');
        var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
        return r.error ? 'err:' + r.error.message : 'ok';
      } catch(e) { return 'err:' + e.message; }
    })()`);
    if (String(sess) === 'ok') break;
    await sleep(2500);
  }
  console.log(`  登录: ${sess}`);
  await js(`(function(){ localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)}); return 'ok'; })()`);

  // 列表页
  await send('Page.navigate', { url: `${BASE}/modules/content/` }, sessionId);
  await sleep(13000);

  const raw = await js(`(function(){
    var vw = document.documentElement.clientWidth;
    var out = [];
    [].forEach.call(document.querySelectorAll('.pcard'), function(card, idx){
      var cr = card.getBoundingClientRect();
      var b = card.querySelector('.card-accept');
      var badges = card.querySelector('.c-badges');
      var o = { idx: idx, cardRight: Math.round(cr.right), cardLeft: Math.round(cr.left), cardW: Math.round(cr.width) };
      if (b) {
        var br = b.getBoundingClientRect();
        o.btn = {
          text: b.textContent.trim(),
          right: Math.round(br.right), top: Math.round(br.top),
          w: Math.round(br.width), h: Math.round(br.height),
          overflowRight: Math.round(br.right - cr.right),
          overflowTop: Math.round(cr.top - br.top)
        };
      }
      if (badges) {
        var gr = badges.getBoundingClientRect();
        o.badges = { top: Math.round(gr.top), bottom: Math.round(gr.bottom), right: Math.round(gr.right) };
        if (o.btn && b) {
          var br2 = b.getBoundingClientRect();
          o.overlapBadges = !(br2.bottom <= gr.top || br2.top >= gr.bottom || br2.right <= gr.left || br2.left >= gr.right);
        }
      }
      out.push(o);
    });
    return JSON.stringify({ vw: vw, docW: document.documentElement.scrollWidth, cards: out });
  })()`);
  let R = {};
  try { R = JSON.parse(raw); } catch {}

  console.log(`  视口宽 ${R.vw}  document.scrollWidth ${R.docW}\n`);
  (R.cards || []).forEach((c) => {
    console.log(`  ── 卡片 ${c.idx + 1}  宽 ${c.cardW}  右边界 ${c.cardRight} ──`);
    if (c.btn) {
      console.log(`     按钮「${c.btn.text}」 尺寸 ${c.btn.w}×${c.btn.h}  右边界 ${c.btn.right}`);
      console.log(`       相对卡片: 右边溢出 ${c.btn.overflowRight}px  上边溢出 ${c.btn.overflowTop}px`);
      console.log(`       是否被裁切: ${c.btn.overflowRight > 0 ? '⚠️ 右侧超出' : '✅ 在卡片内'}`);
      console.log(`       与类型徽章重叠: ${c.overlapBadges ? '⚠️ 是' : '✅ 否'}`);
      console.log(`       点击热区: ${c.btn.w >= 44 && c.btn.h >= 32 ? '✅ 够大' : '⚠️ 偏小（' + c.btn.w + '×' + c.btn.h + '）'}`);
    } else {
      console.log('     无按钮');
    }
  });

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
  fs.writeFileSync(path.join(OUT, 'mobile-auth-列表.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n  截图: .shots/runtime/mobile-auth-列表.png');
} catch (e) {
  console.error('诊断失败:', e.message);
  chrome.kill('SIGKILL');
  vite.kill('SIGKILL');
  process.exit(1);
}
chrome.kill('SIGKILL');
vite.kill('SIGKILL');
