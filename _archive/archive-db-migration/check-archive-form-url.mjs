#!/usr/bin/env node
/**
 * tools/check-archive-form-url.mjs —— 确认页面上的表单入口指向新表单
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 5619);
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = 9377;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-formurl-check');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1400,1000',
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

let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

try {
  await waitCDP(CDP_PORT);
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
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
      errs.push(m.params?.exceptionDetails?.exception?.description?.split('\n')[0] || '?');
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });
  const send = (method, params = {}, t = 30000, sid) => {
    const mid = ++id;
    const pl = { id: mid, method, params };
    if (sid) pl.sessionId = sid;
    ws.send(JSON.stringify(pl));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(method + ' 超时')); } }, t);
      pending.set(mid, { resolve: res, reject: rej, timer });
    });
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  const SID = att.sessionId;
  await send('Runtime.enable', {}, 20000, SID);
  await send('Page.enable', {}, 20000, SID);
  const js = async (e, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, t, SID);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  console.log('════════ 档案表单入口验证 ════════\n');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' }, 40000, SID);
  await sleep(6000);

  check('页面已加载', await js(`!!document.querySelector('.page-head, .header, header')`), true);
  check('「母の曝光」按钮存在', await js(`!!document.getElementById('btnFillForm')`), true);

  const label = await js(`(document.getElementById('btnFillForm')||{}).innerText`);
  console.log(`     按钮文案: 「${(label || '').trim()}」`);

  // 从打包后的 JS 里确认 FORM_URL 已换成新表单
  const formUrlHit = await js(`(async () => {
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
    for (const src of scripts) {
      try {
        const t = await (await fetch(src)).text();
        if (t.includes('tUpkJr8bb9us')) return 'NEW:' + src.split('/').pop();
        if (t.includes('sZm1g43KzHus')) return 'OLD:' + src.split('/').pop();
      } catch {}
    }
    return 'NOT_FOUND';
  })()`, 30000);
  console.log(`     打包产物中的表单 URL: ${formUrlHit}`);
  check('表单 URL 已指向新表单 tUpkJr8bb9us', String(formUrlHit).startsWith('NEW:'), true);

  const dbHit = await js(`(async () => {
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
    for (const src of scripts) {
      try {
        const t = await (await fetch(src)).text();
        if (t.includes('e7d18ead20743825') && t.includes('t4d3B3XvKL8')) return 'NEW_DB_OK';
        if (t.includes('0019555500b60c58') || t.includes('taRmZxGFzF5')) return 'OLD_DB';
      } catch {}
    }
    return 'NOT_FOUND';
  })()`, 30000);
  console.log(`     打包产物中的数据库 ID: ${dbHit}`);
  check('数据库已指向新库', dbHit, 'NEW_DB_OK');

  const realErrors = errs.filter((e) => !/favicon|ERR_/.test(e));
  if (realErrors.length) {
    console.log('\n  ── 页面异常 ──');
    [...new Set(realErrors)].forEach((e) => console.log('   · ' + e));
  }
  check('无页面异常', realErrors.length, 0);

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (fails.length) { console.log('  ── 失败明细 ──'); fails.forEach((f) => console.log('   · ' + f)); }
  console.log('═══════════════════════════════');
  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
