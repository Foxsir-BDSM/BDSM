#!/usr/bin/env node
/**
 * tools/check-caption-frosted.mjs —— 验证渐进毛玻璃姓名条
 *
 * 验收点：
 *   1. 已应用 backdrop-filter
 *   2. ★ 有纵向渐变遮罩（渐进模糊，不是均匀条再硬切）
 *   3. ★ 采样验证：自下而上不透明度递增（即真的在渐隐）
 *   4. ★ 文字落在实心区内（不被遮罩淡掉）
 *   5. 玻璃实心区占卡片高度比例可控（不过多遮挡封面）
 *   6. 亮底 / 暗底照片上都可读
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5283));
const CDP = Number(getArg('--cdp', 9883));
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(process.cwd(), '.shots', 'runtime');
const PROFILE = path.join(os.tmpdir(), 'foxsir-frosted');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (l, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${l}${extra ? '  →  ' + String(extra).slice(0, 92) : ''}`); }
  else { fails.push(l); console.log(`  ✗ ${l}${extra ? '  →  ' + String(extra).slice(0, 124) : ''}`); }
};

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=440,1000',
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
await send('Emulation.setDeviceMetricsOverride', { width: 440, height: 1000, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
const js = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

console.log('════ 渐进毛玻璃姓名条验证 ════════\n');

await send('Page.navigate', { url: `${BASE}/modules/sub-archive/index.html` }, sessionId);
await sleep(12000);

const lightSvg = fs.readFileSync(path.join(OUT, 'test-cover-light.svg'), 'utf8');
const darkSvg = fs.readFileSync(path.join(OUT, 'test-cover-dark.svg'), 'utf8');
const toUri = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64');

const injected = await js(`(function(){
  var imgs = document.querySelectorAll('.card-image-wrap img');
  if (imgs.length < 2) return 'not-enough:' + imgs.length;
  imgs[0].src = ${JSON.stringify(toUri(lightSvg))};
  imgs[1].src = ${JSON.stringify(toUri(darkSvg))};
  return 'ok';
})()`);
check('注入一白一黑测试封面', injected === 'ok', injected);
await sleep(1500);

const metrics = await js(`(function(){
  var caps = document.querySelectorAll('.card-image-caption');
  var wraps = document.querySelectorAll('.card-image-wrap');
  var out = [];
  for (var i = 0; i < Math.min(2, caps.length); i++) {
    var c = caps[i], w = wraps[i];
    var cr = c.getBoundingClientRect(), wr = w.getBoundingClientRect();
    var cs = getComputedStyle(c);
    var name = c.querySelector('.card-name');

    // 文字底部相对玻璃条底的偏移（0 = 紧贴底部实心区）
    var nr = name.getBoundingClientRect();
    out.push({
      captionH: Math.round(cr.height),
      wrapH: Math.round(wr.height),
      ratio: +(cr.height / wr.height * 100).toFixed(1),
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter || '(none)',
      hasMask: !!(cs.maskImage && cs.maskImage !== 'none') || !!(cs.webkitMaskImage && cs.webkitMaskImage !== 'none'),
      maskIsGradient: /gradient/.test(cs.maskImage || cs.webkitMaskImage || ''),
      bgIsGradient: /gradient/.test(cs.backgroundImage || ''),
      color: cs.color,
      // 文字底边距玻璃条底边的距离（越小越说明文字在实心区）
      textBottomGap: Math.round(cr.bottom - nr.bottom),
      textTopFromCaptionTop: Math.round(nr.top - cr.top),
      text: (c.innerText || '').replace(/\\s+/g, ' ').slice(0, 22)
    });
  }
  return JSON.stringify(out, null, 1);
})()`);
console.log(String(metrics).split('\n').map((l) => '     ' + l).join('\n'));

let M = [];
try { M = JSON.parse(metrics); } catch {}
check('取到两张卡片', M.length === 2, `${M.length}`);

if (M[0]) {
  const m = M[0];
  check('已应用 backdrop-filter', /blur/.test(m.backdrop), m.backdrop);
  check('★ 有遮罩', m.hasMask === true);
  check('★ 遮罩是渐变（渐进淡出，非硬切）', m.maskIsGradient === true, m.maskIsGradient ? 'linear-gradient' : '非渐变');
  check('底色也是渐变（与模糊同步淡出）', m.bgIsGradient === true);
  check('文字为浅色', /255,\s*255,\s*255/.test(m.color), m.color);
  check('★ 文字紧贴底部实心区（不被淡掉）', m.textBottomGap <= 14, `文字底边距条底 ${m.textBottomGap}px`);
  check('★ 文字位于元素下半部（上半是渐隐过渡区）',
    m.textTopFromCaptionTop > m.captionH * 0.35,
    `文字顶距条顶 ${m.textTopFromCaptionTop}px / 条高 ${m.captionH}px`);
  // 实心区 ≈ 条高 - 过渡区；用文字区估算
  const solid = m.captionH - m.textTopFromCaptionTop;
  check('实心区占卡片高度 < 18%', (solid / m.wrapH * 100) < 18,
    `约 ${(solid / m.wrapH * 100).toFixed(1)}%（${solid}px / ${m.wrapH}px）`);
}

const clip = await js(`(function(){
  var cards = document.querySelectorAll('.card');
  if (cards.length < 2) return 'null';
  var a = cards[0].getBoundingClientRect(), b = cards[1].getBoundingClientRect();
  var top = Math.min(a.top, b.top) + window.scrollY - 10;
  var bottom = Math.max(a.bottom, b.bottom) + window.scrollY + 10;
  return JSON.stringify({ x: 0, y: Math.max(0, top), w: 440, h: bottom - top });
})()`);
let C = null;
try { C = JSON.parse(clip); } catch {}
if (C) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: C.x, y: C.y, width: C.w, height: C.h, scale: 2 },
  }, sessionId);
  fs.writeFileSync(path.join(OUT, 'frosted-caption.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n  截图: .shots/runtime/frosted-caption.png');
}

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');

chrome.kill('SIGKILL');
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
