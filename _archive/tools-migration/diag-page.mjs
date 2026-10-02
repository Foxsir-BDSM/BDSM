#!/usr/bin/env node
/**
 * tools/diag-page.mjs —— 单页运行时诊断（带阶段日志与可调超时）
 *   node tools/diag-page.mjs --url http://127.0.0.1:5173/admin-article.html
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const URL_ = get('--url');
const CDP_PORT = Number(get('--cdp', 9444));
const EVAL_TIMEOUT = Number(get('--eval-timeout', 60000));
const WAIT = Number(get('--wait', 3000));

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-chrome-diag');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('  ', ...a);

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--window-size=1440,1000',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
  ],
  { stdio: 'ignore' }
);

async function waitCDP(p, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  const wsUrl = await waitCDP(CDP_PORT);
  log('CDP 就绪');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  log('WebSocket 已连接');

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method) {
      events.push(m);
    }
  });

  let sessionId = null;
  const send = (method, params = {}, timeout = 20000, useSession = true) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.has(mid)) {
          pending.delete(mid);
          reject(new Error(`${method} 超时(${timeout}ms)`));
        }
      }, timeout);
      pending.set(mid, { resolve, reject, timer });
    });
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const attached = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = attached.sessionId;
  log('已附着目标, sessionId =', sessionId.slice(0, 8));

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  log('已启用 Runtime/Page/Log');

  const t0 = Date.now();
  await send('Page.navigate', { url: URL_ });
  log(`导航已发出 (${Date.now() - t0}ms)`);

  await sleep(WAIT);
  log(`等待 ${WAIT}ms 完成 (${Date.now() - t0}ms)`);

  // 分阶段评估：先取轻量信息，再取整个 DOM
  const probes = [
    ['location.href', 'document.location.href'],
    ['readyState', 'document.readyState'],
    ['title', 'document.title'],
    ['body 长度', 'document.body ? document.body.innerHTML.length : -1'],
  ];
  for (const [label, expr] of probes) {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, 15000);
      log(`${label} = ${JSON.stringify(r.result?.value)}`);
    } catch (e) {
      log(`${label} 失败: ${e.message}`);
    }
  }

  try {
    const r = await send(
      'Runtime.evaluate',
      { expression: 'document.documentElement.outerHTML', returnByValue: true },
      EVAL_TIMEOUT
    );
    const dom = r.result?.value || '';
    log(`outerHTML 长度 = ${dom.length} (${Date.now() - t0}ms)`);
    fs.writeFileSync(path.join(os.tmpdir(), 'diag-dom.html'), dom, 'utf8');
    log('已写入 ' + path.join(os.tmpdir(), 'diag-dom.html'));
  } catch (e) {
    log('outerHTML 失败: ' + e.message);
  }

  // 事件统计
  const byMethod = {};
  for (const e of events) byMethod[e.method] = (byMethod[e.method] || 0) + 1;
  log('CDP 事件统计: ' + JSON.stringify(byMethod));
  const errors = events.filter(
    (e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error')
  );
  log(`错误事件 ${errors.length} 条:`);
  for (const e of errors.slice(0, 8)) {
    const d = e.params.exceptionDetails?.exception?.description || e.params.entry?.text || '';
    log('   · ' + String(d).split('\n')[0].slice(0, 150));
  }

  await send('Target.closeTarget', { targetId }, 10000, false);
} catch (e) {
  console.error('诊断失败:', e.message);
} finally {
  chrome.kill('SIGKILL');
}
