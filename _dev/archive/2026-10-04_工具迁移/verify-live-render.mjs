#!/usr/bin/env node
/**
 * tools/verify-live-render.mjs —— 用无头浏览器验收线上站点
 *
 * 直接渲染线上页面，确认：
 *   · 首页模块卡片实际渲染出什么
 *   · 是否还有已删除的模块
 *   · 控制台是否有报错
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'https://www.foxsir.top';
const CDP = 9500;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-live-verify');
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1400,1200',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function waitCDP(ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  await waitCDP();
  const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0; const pending = new Map(); const errs = []; let sid = null;
  const send = (m, p = {}, t = 40000, s = true) => {
    const mid = ++id; const pl = { id: mid, method: m, params: p };
    if (s && sid) pl.sessionId = sid;
    ws.send(JSON.stringify(pl));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(m + ' 超时')); } }, t);
      pending.set(mid, { resolve: res, reject: rej, timer });
    });
  };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId && m.sessionId !== sid) return;
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0]);
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sid = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  const js = async (e, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, t);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  const results = [];
  for (const [label, page] of [['首页', '/'], ['我的', '/my.html'], ['档案馆', '/modules/sub-archive/'], ['欲炼之途', '/modules/content/']]) {
    errs.length = 0;
    await send('Page.navigate', { url: BASE + page });
    await sleep(7000);

    const title = await js(`document.title`);
    const bodyText = await js(`(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,400)`);
    const cards = await js(`document.querySelectorAll('.project-card').length`);
    const cardNames = await js(`[...document.querySelectorAll('.project-card h3')].map(e=>e.textContent.trim())`);

    console.log(`── ${label}  ${page} ──`);
    console.log(`   title : ${title}`);
    console.log(`   卡片数: ${cards}`);
    if (Array.isArray(cardNames) && cardNames.length) console.log(`   卡片  : ${cardNames.join(' | ')}`);
    console.log(`   正文  : ${String(bodyText).slice(0, 130)}`);
    const realErrs = [...new Set(errs)].filter((e) => !/favicon|ERR_|Failed to load resource/i.test(e));
    console.log(`   报错  : ${realErrs.length ? realErrs.join(' | ').slice(0, 120) : '✅ 无'}`);
    console.log('');

    // 旧模块名检查
    if (Array.isArray(cardNames)) {
      const stale = cardNames.filter((n) => /淫梦织境|欲缘之遇/.test(n));
      if (stale.length) console.log(`   🔴 仍渲染旧模块: ${stale.join(', ')}`);
    }
    results.push({ label, page, title, cards, cardNames, errs: realErrs.length });

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(OUT, `live-${label}.png`), Buffer.from(shot.data, 'base64'));
  }

  console.log('════════ 汇总 ════════');
  results.forEach((r) => console.log(`  ${r.label.padEnd(10)} 卡片 ${r.cards}  报错 ${r.errs}  ${r.cardNames?.length ? '[' + r.cardNames.join(', ') + ']' : ''}`));

  chrome.kill('SIGKILL');
} catch (e) {
  console.error('验收失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
