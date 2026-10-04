#!/usr/bin/env node
/**
 * tools/check-mobile-layout.mjs —— 手机端布局诊断
 *
 * 目的：找出窄屏下元素溢出的位置，而不是靠肉眼猜。
 * 做法：以手机视口渲染各页面，测量每个元素的边界是否超出视口/被裁切。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = getArg('--base', 'https://www.foxsir.top');
const W = Number(getArg('--w', 390));
const H = Number(getArg('--h', 844));
const CDP = Number(getArg('--cdp', 9800));

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-mobile');
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = [
  ['内容列表', '/modules/content/'],
  ['内容详情', '/modules/content/post.html?slug=demo-breath'],
  ['发布页', '/modules/content/post-editor.html'],
  ['首页', '/'],
  ['我的', '/my.html'],
];

const chrome = spawn(CHROME, [
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

console.log(`════════ 手机端布局诊断（${W}×${H}）════════\n`);

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
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); mid; reject(new Error(method + ' 超时')); } }, 45000);
      pending.set(mid, { resolve, reject, timer });
    });
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 2, mobile: true,
  }, sessionId).catch(() => {});

  const js = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  for (const [label, p] of PAGES) {
    console.log(`── ${label}  ${p} ──`);
    await send('Page.navigate', { url: BASE + p }, sessionId);
    await sleep(10000);

    // 找出超出视口右边界的元素
    const raw = await js(`(function(){
      var vw = document.documentElement.clientWidth;
      var out = [];
      var all = document.querySelectorAll('body *');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // 只报真正溢出的（右边界超出视口 1px 以上）
        if (r.right > vw + 1) {
          var cls = (el.className && typeof el.className === 'string') ? el.className.split(' ')[0] : '';
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: cls,
            text: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0, 26),
            right: Math.round(r.right),
            left: Math.round(r.left),
            w: Math.round(r.width)
          });
        }
      }
      // 去重（同一元素只留一次），按溢出程度排序
      var seen = {}, uniq = [];
      out.forEach(function(o){ var k = o.tag+'.'+o.cls+o.text; if(!seen[k]){seen[k]=1;uniq.push(o);} });
      uniq.sort(function(a,b){ return b.right - a.right; });
      return JSON.stringify({
        vw: vw,
        docW: document.documentElement.scrollWidth,
        bodyW: document.body.scrollWidth,
        overflow: uniq.slice(0, 12)
      });
    })()`);
    let R = {};
    try { R = JSON.parse(raw); } catch {}

    console.log(`     视口宽 ${R.vw}  document.scrollWidth ${R.docW}  body.scrollWidth ${R.bodyW}`);
    const horizontalScroll = (R.docW || 0) > (R.vw || 0);
    console.log(`     横向溢出: ${horizontalScroll ? '⚠️ 有（会出现横向滚动条）' : '✅ 无'}`);
    if ((R.overflow || []).length) {
      console.log('     超出右边界的元素:');
      R.overflow.forEach((o) => {
        console.log(`       · <${o.tag} class="${o.cls}"> right=${o.right} (超出 ${o.right - R.vw}px) w=${o.w} 「${o.text}」`);
      });
    } else {
      console.log('     超出右边界的元素: 无');
    }

    // 卡片内按钮位置（内容列表专查）
    if (p.includes('modules/content/') && !p.includes('post')) {
      const btn = await js(`(function(){
        var card = document.querySelector('.pcard');
        var b = card ? card.querySelector('.card-accept') : null;
        if (!card || !b) return JSON.stringify({ has: false });
        var cr = card.getBoundingClientRect();
        var br = b.getBoundingClientRect();
        return JSON.stringify({
          has: true,
          cardRight: Math.round(cr.right), cardTop: Math.round(cr.top),
          btnRight: Math.round(br.right), btnTop: Math.round(br.top),
          btnW: Math.round(br.width), btnH: Math.round(br.height),
          insideCard: br.right <= cr.right + 0.5,
          overflowPx: Math.round(br.right - cr.right)
        });
      })()`);
      let B = {};
      try { B = JSON.parse(btn); } catch {}
      if (B.has) {
        console.log(`     卡片接取按钮: 卡片右=${B.cardRight} 按钮右=${B.btnRight} 尺寸=${B.btnW}x${B.btnH}`);
        console.log(`        在卡片内: ${B.insideCard ? '✅' : '❌ 溢出 ' + B.overflowPx + 'px'}`);
      } else {
        console.log('     卡片接取按钮: 不存在（未登录时正常）');
      }
    }

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    fs.writeFileSync(path.join(OUT, `mobile-${label}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`     截图: .shots/runtime/mobile-${label}.png`);
    console.log('');
  }
} catch (e) {
  console.error('诊断失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
chrome.kill('SIGKILL');
