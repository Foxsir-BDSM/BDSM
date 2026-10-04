#!/usr/bin/env node
/**
 * tools/diagnose-home-empty.mjs —— 诊断列表页卡片为空
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.argv[2] || 5190);
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = 9412;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-home-diag');
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
  let id = 0; const pending = new Map(); const logs = []; let sessionId = null;
  const send = (m, p = {}, t = 40000, s = true) => {
    const mid = ++id; const pl = { id: mid, method: m, params: p };
    if (s && sessionId) pl.sessionId = sessionId;
    ws.send(JSON.stringify(pl));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(m + ' 超时')); } }, t);
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
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a.preview?.properties?.map(p => p.name + '=' + p.value)) ?? '').join(' ').slice(0, 300));
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n').slice(0, 3).join(' | '));
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

  console.log('════════ 列表页空卡片诊断 ════════\n');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' });
  await sleep(9000);

  console.log('── 页面控制台输出 ──');
  const uniq = [...new Set(logs)];
  uniq.slice(-30).forEach((l) => console.log('  ' + l));

  console.log('\n── 关键元素状态 ──');
  console.log('  #cardGrid 存在: ' + await js(`!!document.getElementById('cardGrid')`));
  console.log('  卡片数        : ' + await js(`document.querySelectorAll('.card').length`));
  console.log('  grid.children : ' + await js(`document.getElementById('cardGrid')?.children.length`));
  console.log('  grid.innerHTML长度: ' + await js(`(document.getElementById('cardGrid')?.innerHTML||'').length`));
  console.log('  筛选条文字    : ' + await js(`document.querySelector('#filterBar')?.innerText?.replace(/\\s+/g,' ').slice(0,120)`));
  console.log('  统计          : ' + await js(`document.getElementById('searchStats')?.textContent`));

  console.log('\n── 直接调用模块函数 ──');
  const probe = await js(`(async () => {
    try {
      const api = await import('/modules/sub-archive/js/api.js');
      const cfg = await import('/modules/sub-archive/js/config.js');
      const utils = await import('/modules/sub-archive/js/utils.js');
      const recs = await api.fetchRecords(true);
      const out = { records: recs.length, visField: cfg.VISIBILITY_FIELDS.publicQuestionnaire };
      const isPublic = (r) => {
        const v = utils.getFieldValue(r, cfg.VISIBILITY_FIELDS.publicQuestionnaire);
        return v === true || v === 'true' || v === '是' || v === 1;
      };
      out.passPublic = recs.filter(isPublic).length;
      const r0 = recs[0];
      out.sampleCardName = utils.getCardName(r0);
      out.sampleCardImage = String(utils.getCardImage(r0)).slice(0, 40);
      out.sampleCardInfo = utils.getCardInfo(r0);
      out.cardFields = cfg.CARD_FIELDS;
      return JSON.stringify(out, null, 1);
    } catch (e) { return 'ERR: ' + e.message + '\\n' + e.stack; }
  })()`, 40000);
  console.log(probe);

  chrome.kill('SIGKILL');
} catch (e) {
  console.error('诊断失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
