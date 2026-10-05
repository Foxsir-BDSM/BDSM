#!/usr/bin/env node
/**
 * tools/diag-live-archive.mjs —— 检查线上档案首页卡片的姓名/年龄显示
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CDP = 9900;
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = bi >= 0 ? argv[bi + 1] : 'https://www.foxsir.top';
const OUT = path.join(process.cwd(), '.shots', 'runtime');
const PROFILE = path.join(os.tmpdir(), 'foxsir-live-archive');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=410,900',
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
const send = (method, params = {}, sid) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params, ...(sid ? { sessionId: sid } : {}) }));
  return new Promise((res, rej) => {
    const t = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(method + ' 超时')); } }, 45000);
    pending.set(mid, { resolve: res, reject: rej, timer: t });
  });
};
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 410, height: 900, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
const js = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

console.log('════ 档案首页诊断 ════════\n');
console.log(`  目标: ${BASE}\n`);
await send('Page.navigate', { url: `${BASE}/modules/sub-archive/index.html` }, sessionId);
await sleep(13000);

const info = await js(`(function(){
  var card = document.querySelector('.card');
  var wrap = document.querySelector('.card-image-wrap');
  var cap = document.querySelector('.card-image-caption');
  var t = (document.body.innerText || '').replace(/\\s+/g, ' ');
  var out = {
    cardCount: document.querySelectorAll('.card').length,
    hasCaptionEl: !!cap,
    captionText: cap ? cap.innerText.replace(/\\s+/g, ' ').slice(0, 80) : '(无 .card-image-caption)',
    hasAgeInBody: /岁/.test(t),
    bodySnippet: t.slice(0, 220)
  };
  if (card) {
    out.cardInnerHead = card.innerHTML.replace(/\\s+/g, ' ').slice(0, 320);
    out.cardText = (card.innerText || '').replace(/\\s+/g, ' ').slice(0, 120);
  }
  if (wrap) {
    var r = wrap.getBoundingClientRect();
    var cs = getComputedStyle(wrap);
    out.wrapSize = Math.round(r.width) + 'x' + Math.round(r.height);
    out.wrapOverflow = cs.overflow;
    out.wrapAspect = cs.aspectRatio;
  }
  return JSON.stringify(out, null, 1);
})()`);

console.log(String(info).split('\n').map((l) => '  ' + l).join('\n'));

const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
fs.writeFileSync(path.join(OUT, 'live-archive-now.png'), Buffer.from(shot.data, 'base64'));
console.log('\n  截图: .shots/runtime/live-archive-now.png');

chrome.kill('SIGKILL');
