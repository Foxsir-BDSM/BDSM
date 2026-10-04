#!/usr/bin/env node
/**
 * tools/check-archive-render.mjs —— 验证档案列表页真的渲染出卡片
 * 针对「新库有数据但无卡片」故障的回归验证。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5187));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9399));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-render-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}  →  ${String(actual).slice(0, 60)}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1600,1200',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function waitCDP(p, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${p}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  await waitCDP(CDP_PORT);
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0; const pending = new Map(); const errs = []; let sessionId = null;
  const send = (method, params = {}, t = 40000, useSession = true) => {
    const mid = ++id;
    const pl = { id: mid, method, params };
    if (useSession && sessionId) pl.sessionId = sessionId;
    ws.send(JSON.stringify(pl));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(method + ' 超时')); } }, t);
      pending.set(mid, { resolve: res, reject: rej, timer });
    });
  };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId && m.sessionId !== sessionId) return;
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errs.push(m.params?.exceptionDetails?.exception?.description?.split('\n')[0] || '?');
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  const js = async (e, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, t);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  console.log('════════ 档案列表页渲染验证 ════════\n');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' });
  await sleep(9000);

  // 卡片数量
  const cardCount = await js(`document.querySelectorAll('.card').length`);
  check('卡片数量 > 0', cardCount, (v) => typeof v === 'number' && v > 0);

  // 卡片是否含姓名
  const firstCard = await js(`(() => {
    const c = document.querySelector('.card');
    if (!c) return null;
    return (c.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
  })()`);
  console.log(`     首张卡片内容: ${firstCard}`);

  const hasName = await js(`(() => {
    const t = document.body.innerText;
    return ['郑陈卓','王晓樱','张婷婷'].some(n => t.includes(n));
  })()`);
  check('页面出现真实姓名', hasName, true);

  // 是否仍在显示「没有找到匹配」
  const emptyMsg = await js(`/没有找到匹配的资料/.test(document.body.innerText)`);
  check('未显示空状态', emptyMsg, false);

  // 统计文案
  const stats = await js(`document.getElementById('searchStats')?.textContent || document.querySelector('.filter-inner')?.textContent?.replace(/\\s+/g,' ').slice(0,160)`);
  console.log(`     统计/筛选条: ${stats}`);

  // 图片是否加载（封面多为空，应回退占位图）
  const imgInfo = await js(`(() => {
    const imgs = [...document.querySelectorAll('.card img')];
    return JSON.stringify({ total: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length });
  })()`);
  console.log(`     卡片图片: ${imgInfo}`);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, 'archive-rendered.png'), Buffer.from(shot.data, 'base64'));

  const realErrors = errs.filter((e) => !/favicon|ERR_/.test(e));
  if (realErrors.length) {
    console.log('\n  ── 页面异常 ──');
    [...new Set(realErrors)].forEach((e) => console.log('   · ' + e));
  }
  check('无页面异常', realErrors.length, 0);

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (fails.length) { console.log('  ── 失败明细 ──'); fails.forEach((f) => console.log('   · ' + f)); }
  console.log('  截图: .shots/runtime/archive-rendered.png');
  console.log('═══════════════════════════════');

  await send('Target.closeTarget', { targetId }, 10000, false);
  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
