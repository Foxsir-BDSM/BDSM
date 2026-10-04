#!/usr/bin/env node
// tools/shot-page.mjs <url路径> <输出名> [--port 5191] [--email x]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const PAGE = args[0] || '/';
const OUTNAME = args[1] || 'page.png';
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5191));
const EMAIL = get('--email', '');
const BASE = `http://127.0.0.1:${PORT}`;
const CDP = Number(get('--cdp', 9450));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-shot-' + OUTNAME.replace(/\W/g, ''));
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1200,1400',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
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
  await waitCDP(CDP);
  const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const pending = new Map(); let sid = null;
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
    return r.result?.value;
  };

  if (EMAIL) {
    await send('Page.navigate', { url: BASE + '/auth.html' });
    await sleep(2500);
    await js(`(async () => {
      const m = await import('/shared/js/supabase-client.js');
      const { data } = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: 'Qa!123456' });
      if (data?.session) localStorage.setItem('foxsir_session', JSON.stringify(data.session));
    })()`, 30000);
  }

  await send('Page.navigate', { url: BASE + PAGE });
  await sleep(5500);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const p = path.join(OUT, OUTNAME);
  fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
  console.log('  ✅ ' + p);
  chrome.kill('SIGKILL');
} catch (e) {
  console.error('截图失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
