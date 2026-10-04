#!/usr/bin/env node
/**
 * tools/diagnose-card-syntax.mjs —— 抓取卡片渲染时的 SyntaxError 详情与图片 src
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5187;
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = 9400;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-card-diag');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  let id = 0; const pending = new Map(); const exc = []; const consoleErrs = []; let sessionId = null;
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
      const d = m.params.exceptionDetails;
      exc.push({
        text: d.text,
        desc: (d.exception?.description || '').split('\n').slice(0, 4).join(' | '),
        line: d.lineNumber, col: d.columnNumber,
        url: d.url || d.scriptUrl || '',
      });
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
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

  console.log('════════ 诊断卡片渲染异常 ════════\n');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' });
  await sleep(9000);

  console.log(`── 捕获到 ${exc.length} 个异常，去重后：──`);
  const uniq = new Map();
  exc.forEach((e) => {
    const k = e.desc.split('\n')[0] || e.text;
    if (!uniq.has(k)) uniq.set(k, e);
  });
  [...uniq.values()].forEach((e) => {
    console.log(`  · ${e.text}`);
    console.log(`    ${e.desc}`);
    if (e.url) console.log(`    @ ${e.url}:${e.line}:${e.col}`);
  });

  if (consoleErrs.length) {
    console.log('\n── console.error ──');
    [...new Set(consoleErrs)].slice(0, 6).forEach((c) => console.log('  · ' + c));
  }

  // 图片 src 实况
  console.log('\n── 卡片图片 src ──');
  const imgs = await js(`JSON.stringify([...document.querySelectorAll('.card img')].slice(0,3).map(i => ({
    srcHead: (i.getAttribute('src')||'').slice(0, 120),
    srcLen: (i.getAttribute('src')||'').length,
    complete: i.complete,
    naturalWidth: i.naturalWidth,
    onerror: i.getAttribute('onerror') ? '有' : '无',
  })), null, 1)`);
  console.log(imgs);

  // 原始数据里的封面字段
  console.log('\n── 数据层：封面/生活照字段原始值 ──');
  const raw = await js(`(async () => {
    const { fetchRecords } = await import('/modules/sub-archive/js/api.js');
    const { CARD_FIELDS } = await import('/modules/sub-archive/js/config.js');
    const recs = await fetchRecords(false);
    const r = recs[0];
    const d = r.data || r.fields || {};
    return JSON.stringify({
      photo: JSON.stringify(d[CARD_FIELDS.photo]).slice(0,200),
      photoFallback: JSON.stringify(d[CARD_FIELDS.photoFallback]).slice(0,200),
      lifePhotos: ['f2ccv3EV3b7','fnQE4jDkwYr','fsGpT1jWgeg'].map(k => JSON.stringify(d[k]).slice(0,80)),
    }, null, 1);
  })()`, 30000);
  console.log(raw);

  chrome.kill('SIGKILL');
} catch (e) {
  console.error('诊断失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
