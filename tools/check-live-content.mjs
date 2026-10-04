#!/usr/bin/env node
/**
 * tools/check-live-content.mjs —— 线上内容验收
 * 确认演示内容在生产环境正常展示
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'https://www.foxsir.top';
const CDP = 9600;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-live-content');
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (l, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${l}${extra ? '  →  ' + String(extra).slice(0, 80) : ''}`); }
  else { fails.push(l); console.log(`  ✗ ${l}${extra ? '  →  ' + String(extra).slice(0, 110) : ''}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1400,1100',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

const waitCDP = async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) return; } catch {}
    await sleep(300);
  }
  throw new Error('CDP 未就绪');
};

console.log('════════ 线上内容验收 ════════\n');

try {
  await waitCDP();
  const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  let id = 0; const pending = new Map(); const errs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
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
  const js = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  // 列表页
  console.log('── 列表页 ──');
  await send('Page.navigate', { url: `${BASE}/modules/content/` }, sessionId);
  await sleep(12000);
  const list = await js(`(function(){
    var cards = [].map.call(document.querySelectorAll('.pcard'), function(c){
      return { title: ((c.querySelector('.c-title')||{}).textContent||'').trim(), type: ((c.querySelector('.c-type')||{}).textContent||'').trim() };
    });
    var btns = [].map.call(document.querySelectorAll('.fbtn'), function(b){ return b.textContent.trim(); });
    return JSON.stringify({ n: cards.length, cards: cards, btns: btns, body: (document.body.innerText||'').slice(0,120) });
  })()`);
  let L = {};
  try { L = JSON.parse(list); } catch {}
  check('列表页渲染卡片', (L.n || 0) >= 4, `卡片数 ${L.n}`);
  (L.cards || []).forEach((c) => console.log(`       · ${c.type}  ${c.title}`));
  check('筛选按钮显示「任务反馈」', (L.btns || []).some((b) => b.includes('任务反馈')), (L.btns || []).join(' / '));
  check('筛选按钮无「见解随笔」', !(L.btns || []).some((b) => b.includes('见解随笔')));

  // 详情页
  console.log('\n── 详情页 ──');
  for (const [slug, label, expectBtn] of [
    ['demo-breath', '玩法任务', true],
    ['demo-feedback', '任务反馈', false],
  ]) {
    await send('Page.navigate', { url: `${BASE}/modules/content/post.html?slug=${slug}` }, sessionId);
    await sleep(9000);
    const st = await js(`(function(){
      var b = document.getElementById('acceptBtn');
      var t = (document.querySelector('.d-title')||{}).textContent || '';
      return JSON.stringify({
        title: t.trim(),
        btnVisible: b ? getComputedStyle(b).display !== 'none' : false,
        btnText: b ? b.textContent.trim() : '',
        err: (document.querySelector('.st-t1')||{}).textContent || ''
      });
    })()`);
    let s = {};
    try { s = JSON.parse(st); } catch {}
    check(`${label} 详情页渲染`, !s.err && (s.title || '').length > 0, s.title || s.err);
    if (expectBtn) check(`${label} 显示接取按钮`, s.btnVisible === true, s.btnText);
    else check(`${label} ★ 不显示接取按钮`, s.btnVisible === false);
  }

  const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
  check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 120));

  console.log(`\n  通过 ${pass}   失败 ${fails.length}`);
  if (fails.length) fails.forEach((f) => console.log('   · ' + f));
} catch (e) {
  console.error('验收失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
chrome.kill('SIGKILL');
