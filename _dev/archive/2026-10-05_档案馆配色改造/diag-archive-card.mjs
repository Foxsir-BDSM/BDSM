#!/usr/bin/env node
/**
 * tools/diag-archive-card.mjs —— 查清档案卡片封面为何显示为亮色块
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5261;
const CDP = 9861;
const BASE = `http://127.0.0.1:${PORT}`;
const PROFILE = path.join(os.tmpdir(), 'foxsir-archive-diag');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

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
await send('Emulation.setDeviceMetricsOverride', { width: 410, height: 900, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
const js = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

await send('Page.navigate', { url: `${BASE}/modules/sub-archive/index.html` }, sessionId);
await sleep(12000);

console.log('════ 卡片封面元素诊断 ════════\n');

const info = await js(`(function(){
  var wrap = document.querySelector('.card-image-wrap');
  if (!wrap) return JSON.stringify({ found: false });
  var cs = getComputedStyle(wrap);
  var img = wrap.querySelector('img');
  var ph = wrap.querySelector('[class*=placeholder], .no-image, .img-placeholder');
  var out = {
    found: true,
    wrapBg: cs.backgroundColor,
    wrapBgImage: cs.backgroundImage.slice(0, 80),
    wrapHtml: wrap.innerHTML.replace(/\\s+/g,' ').slice(0, 220),
    hasImg: !!img,
    imgSrc: img ? String(img.getAttribute('src')||'').slice(0, 90) : ''
  };
  if (img) {
    var ics = getComputedStyle(img);
    out.imgBg = ics.backgroundColor;
    out.imgDisplay = ics.display;
    out.imgW = Math.round(img.getBoundingClientRect().width);
    out.imgH = Math.round(img.getBoundingClientRect().height);
    out.imgNatural = img.naturalWidth + 'x' + img.naturalHeight;
    out.imgComplete = img.complete;
  }
  // 找出卡片里所有背景为亮色的元素
  var bright = [];
  wrap.querySelectorAll('*').forEach(function(el){
    var b = getComputedStyle(el).backgroundColor;
    var m = b.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (m) {
      var lum = (+m[1])*0.299 + (+m[2])*0.587 + (+m[3])*0.114;
      if (lum > 180) bright.push(el.tagName.toLowerCase() + '.' + (el.className||'') + ' bg=' + b);
    }
  });
  out.brightInWrap = bright.slice(0, 5);
  return JSON.stringify(out, null, 1);
})()`);

console.log(String(info).split('\n').map((l) => '    ' + l).join('\n'));

// 也看看整张卡片
const card = await js(`(function(){
  var c = document.querySelector('.card');
  if (!c) return '无卡片';
  var bright = [];
  c.querySelectorAll('*').forEach(function(el){
    var b = getComputedStyle(el).backgroundColor;
    var m = b.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (m) {
      var lum = (+m[1])*0.299 + (+m[2])*0.587 + (+m[3])*0.114;
      var alpha = (b.match(/[\\d.]+\\)$/)||['1'])[0];
      if (lum > 180 && parseFloat(alpha) > 0.2) bright.push(el.tagName.toLowerCase() + '.' + (el.className||'') + '  bg=' + b);
    }
  });
  return JSON.stringify(bright.slice(0, 8), null, 1);
})()`);
console.log('\n  ── 卡片内亮色背景元素 ──');
console.log(String(card).split('\n').map((l) => '    ' + l).join('\n'));

chrome.kill('SIGKILL');
vite.kill('SIGKILL');
