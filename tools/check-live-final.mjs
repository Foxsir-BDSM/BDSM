#!/usr/bin/env node
/**
 * tools/check-live-final.mjs —— 线上最终验收（真实渲染）
 *
 * 以访客视角核对四项修复在生产环境的表现：
 *   ① 首页三区块是否同频出现
 *   ② 列表页卡片是否有接取按钮
 *   ③ 筛选栏是否已移除「任务反馈」
 *   ④ 编辑器关联任务区块（需登录，本脚本验访客降级表现）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'https://www.foxsir.top';
const CDP = 9700;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-live-final');
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (l, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${l}${extra ? '  →  ' + String(extra).slice(0, 90) : ''}`); }
  else { fails.push(l); console.log(`  ✗ ${l}${extra ? '  →  ' + String(extra).slice(0, 130) : ''}`); }
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

console.log('════════ 线上最终验收 ════════\n');

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
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, 50000);
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

  // ── ① 首页同频
  console.log('── ① 首页三区块出现时刻（访客视角）──');
  await send('Page.navigate', { url: BASE + '/' }, sessionId);
  const T0 = Date.now();
  const marks = { nav: null, cards: null };
  while (Date.now() - T0 < 12000) {
    const st = await js(`(function(){
      var n = document.querySelector('.um-trigger');
      return JSON.stringify({
        nav: !!n && (n.innerText||'').trim().length > 0,
        cards: document.querySelectorAll('.project-card').length
      });
    })()`);
    let s = {};
    try { s = JSON.parse(st); } catch {}
    const t = Date.now() - T0;
    if (marks.nav === null && s.nav) marks.nav = t;
    if (marks.cards === null && s.cards > 0) marks.cards = t;
    if (marks.nav !== null && marks.cards !== null) break;
    await sleep(70);
  }
  console.log(`     导航栏 ${marks.nav} ms   模块卡片 ${marks.cards} ms`);
  check('★ 导航栏与卡片同频（差 < 400ms）', Math.abs(marks.nav - marks.cards) < 400, `差 ${Math.abs(marks.nav - marks.cards)} ms`);
  check('★ 首页无「任务直达」（未登录应隐藏）', (await js(`document.getElementById('missionsSection') ? document.getElementById('missionsSection').hidden : 'no-el'`)) === true);

  const homeCards = await js(`JSON.stringify([].map.call(document.querySelectorAll('.project-card h3'), function(h){ return h.textContent.trim(); }))`);
  console.log(`     模块卡片: ${homeCards}`);

  // ── ②③ 列表页
  console.log('\n── ②③ 内容列表页 ──');
  await send('Page.navigate', { url: `${BASE}/modules/content/` }, sessionId);
  await sleep(13000);

  const listSt = await js(`(function(){
    var cards = [].map.call(document.querySelectorAll('.pcard'), function(c){
      return {
        title: (c.querySelector('.c-title')||{}).textContent || '',
        type: (c.querySelector('.c-type')||{}).textContent || '',
        hasAcceptBtn: !!c.querySelector('.card-accept')
      };
    });
    var filters = [].map.call(document.querySelectorAll('#typeFilters .fbtn'), function(b){ return b.textContent.trim(); });
    return JSON.stringify({ cards: cards, filters: filters });
  })()`);
  let L = {};
  try { L = JSON.parse(listSt); } catch {}
  console.log('     卡片:');
  (L.cards || []).forEach((c) => console.log(`       · ${c.type}  ${c.title}  ${c.hasAcceptBtn ? '[有接取按钮]' : ''}`));
  console.log(`     筛选: ${(L.filters || []).join(' / ')}`);
  check('列表页渲染卡片', (L.cards || []).length >= 3, `${(L.cards || []).length} 张`);
  check('★ 筛选栏已无「任务反馈」', !(L.filters || []).some((f) => f.includes('任务反馈')), (L.filters || []).join(' / '));
  check('★ 列表已无「任务反馈」卡片', !(L.cards || []).some((c) => /任务反馈/.test(c.type)), '');
  check('★ 访客看不到接取按钮（未登录应隐藏）', !(L.cards || []).some((c) => c.hasAcceptBtn), '');

  // ── ④ 详情页降级
  console.log('\n── ④ 详情页（访客）──');
  await send('Page.navigate', { url: `${BASE}/modules/content/post.html?slug=demo-breath` }, sessionId);
  await sleep(10000);
  const d = await js(`(function(){
    var b = document.getElementById('acceptBtn');
    return JSON.stringify({
      title: ((document.querySelector('.d-title')||{}).textContent||'').trim(),
      btnVisible: b ? getComputedStyle(b).display !== 'none' : false,
      btnText: b ? b.textContent.trim() : '',
      btnDisabled: b ? b.disabled : null,
      err: ((document.querySelector('.st-t1')||{}).textContent||'').trim()
    });
  })()`);
  let D = {};
  try { D = JSON.parse(d); } catch {}
  check('详情页渲染', D.title && !D.err, D.title || D.err);
  check('★ 访客看到「登录后可接取」且禁用', /登录/.test(D.btnText || '') && D.btnDisabled === true, `${D.btnText} disabled=${D.btnDisabled}`);

  // ── 截图存档
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(path.join(OUT, 'live-final-detail.png'), Buffer.from(shot.data, 'base64'));

  const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
  check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 130));

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (fails.length) fails.forEach((f) => console.log('   · ' + f));
  console.log('═══════════════════════════════');
} catch (e) {
  console.error('验收失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
chrome.kill('SIGKILL');
