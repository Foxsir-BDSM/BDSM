#!/usr/bin/env node
/**
 * tools/check-admin-panel.mjs —— 管理面板双端验证
 *
 * 覆盖用户反馈的几项：
 *   · 顶栏 logo 与标题左对齐、home 图标在右侧
 *   · 只剩两个标签页（用户权限 / 全部档案），无「上位档案」
 *   · Push 按钮为保存图标
 *   · 工具栏在窄屏吸顶
 *   · 档案表 7 列、无「状态」列、列名不换行、窄屏可横向滚动
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5250));
const CDP = Number(getArg('--cdp', 9850));
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (l, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${l}${extra ? '  →  ' + String(extra).slice(0, 90) : ''}`); }
  else { fails.push(l); console.log(`  ✗ ${l}${extra ? '  →  ' + String(extra).slice(0, 130) : ''}`); }
};

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

console.log('════════ 管理面板双端验证 ════════\n');

// 建一个 admin 测试账号
const email = `qa_admin_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '管理测试', role: 'admin' } }),
});
const suj = await su.json().catch(() => ({}));
let token = suj.access_token, refresh = suj.refresh_token;
if (!token) {
  const li = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const lij = await li.json().catch(() => ({}));
  token = lij.access_token; refresh = lij.refresh_token;
}
check('测试账号就绪', !!token, email);

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

const PROFILE = path.join(os.tmpdir(), 'foxsir-admin-check');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1280,1000',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) break; } catch {}
  await sleep(300);
}

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

// 登录
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(5500);
for (let i = 1; i <= 3; i++) {
  const s = await js(`(async function(){
    try {
      var m = await import('/src/shared/js/supabase-client.js');
      var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
      return r.error ? 'err' : 'ok';
    } catch(e) { return 'err'; }
  })()`);
  if (s === 'ok') break;
  await sleep(2500);
}

// ══════════ 桌面端 ══════════
console.log('── 桌面端 ──');
await send('Page.navigate', { url: `${BASE}/admin.html` }, sessionId);
await sleep(10000);

const desk = await js(`(function(){
  var hdr = document.querySelector('.admin-header');
  var left = document.querySelector('.header-left');
  var right = document.querySelector('.header-right');
  var brand = document.querySelector('.brand-mark');
  var h1 = document.querySelector('.admin-header h1');
  var home = document.querySelector('.home-ico');
  var back = document.querySelector('.back-link');
  var tabs = [].map.call(document.querySelectorAll('.tab-btn'), function(b){ return b.textContent.replace(/\\s+/g,' ').trim(); });
  var push = document.getElementById('pushBtn');
  var lr = left ? left.getBoundingClientRect() : null;
  var rr = right ? right.getBoundingClientRect() : null;
  var br = brand ? brand.getBoundingClientRect() : null;
  return JSON.stringify({
    hasHome: !!home,
    homeInRight: home && right ? right.contains(home) : false,
    hasBackLink: !!back,
    homeRightOfBrand: (home && br) ? (home.getBoundingClientRect().left > br.left) : null,
    brandLeft: br ? Math.round(br.left) : null,
    brandTop: br ? Math.round(br.top) : null,
    h1Top: h1 ? Math.round(h1.getBoundingClientRect().top) : null,
    leftRightOk: (lr && rr) ? (lr.right <= rr.left + 1) : null,
    tabs: tabs,
    pushText: push ? push.textContent.trim() : '(无)',
    pushTitle: push ? (push.title||'') : ''
  });
})()`);
let D = {};
try { D = JSON.parse(desk); } catch {}
console.log(`     ${JSON.stringify(D).slice(0, 320)}`);

check('★ 存在 home 图标', D.hasHome === true);
check('★ home 图标在右侧区域', D.homeInRight === true);
check('★ 已移除「返回欲研所」文字链接', D.hasBackLink === false);
check('★ 只剩两个标签页', (D.tabs || []).length === 2, (D.tabs || []).join(' | '));
check('★ 无「上位档案」', !(D.tabs || []).some((t) => t.includes('上位档案')));
check('★ 有「全部档案」', (D.tabs || []).some((t) => t.includes('全部档案')));
check('★ Push 按钮改为保存图标', D.pushText === '💾', `「${D.pushText}」 title=${D.pushTitle}`);
check('logo 与标题同一水平线（差<6px）', D.brandTop !== null && D.h1Top !== null && Math.abs(D.brandTop - D.h1Top) < 6, `brand.top=${D.brandTop} h1.top=${D.h1Top}`);

const dshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
fs.writeFileSync(path.join(OUT, 'admin-桌面.png'), Buffer.from(dshot.data, 'base64'));

// 切到档案标签，看表格
await js(`(function(){
  var b = document.getElementById('tabSubArchive');
  if (b) b.click();
  return 'ok';
})()`);
await sleep(6000);

const tbl = await js(`(function(){
  // 只取档案表格：用 #subRecordsContainer 收窄范围。
  // 用户权限那张表（已隐藏但仍在 DOM 中）的表头也会被 .admin-table 选中。
  var root = document.getElementById('subRecordsContainer');
  var ths = [].map.call(root.querySelectorAll('.admin-table th'), function(t){ return t.textContent.trim(); });
  var scroll = root.querySelector('.table-scroll');
  var toolbar = document.querySelector('#pane-subArchive .toolbar');
  var cs = toolbar ? getComputedStyle(toolbar) : null;
  var push = document.getElementById('pushSubBtn');
  return JSON.stringify({
    headers: ths,
    hasScrollWrap: !!scroll,
    toolbarSticky: cs ? cs.position : '(无)',
    pushSubText: push ? push.textContent.trim() : '(无)'
  });
})()`);
let T = {};
try { T = JSON.parse(tbl); } catch {}
console.log(`     表头(${(T.headers||[]).length} 列): ${(T.headers || []).join(' | ')}`);
check('★ 表头共 7 列', (T.headers || []).length === 7, `${(T.headers || []).length} 列`);
check('★ 已无「状态」列', !(T.headers || []).includes('状态'));
check('★ 表格有横向滚动容器', T.hasScrollWrap === true);
check('★ 档案 Push 按钮为保存图标', T.pushSubText === '💾', `「${T.pushSubText}」`);

// ══════════ 手机端 ══════════
console.log('\n── 手机端（410×805）──');
await send('Emulation.setDeviceMetricsOverride', { width: 410, height: 805, deviceScaleFactor: 2, mobile: true }, sessionId).catch(() => {});
await send('Page.navigate', { url: `${BASE}/admin.html` }, sessionId);
await sleep(10000);
await js(`(function(){ var b=document.getElementById('tabSubArchive'); if(b) b.click(); return 'ok'; })()`);
await sleep(6000);

const mob = await js(`(function(){
  var vw = document.documentElement.clientWidth;
  var root = document.getElementById('subRecordsContainer');
  var ths = [].map.call(root.querySelectorAll('.admin-table th'), function(t){
    var r = t.getBoundingClientRect();
    return { text: t.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), ws: getComputedStyle(t).whiteSpace };
  });
  var wrap = root.querySelector('.table-scroll');
  var toolbar = document.querySelector('#pane-subArchive .toolbar');
  var tcs = toolbar ? getComputedStyle(toolbar) : null;
  var header = document.querySelector('.admin-header');
  var hcs = header ? getComputedStyle(header) : null;
  // 列名是否被拆成竖排（高度远大于单行）
  var wrapped = ths.filter(function(t){ return t.h > 34; });
  return JSON.stringify({
    vw: vw,
    docW: document.documentElement.scrollWidth,
    headerDir: hcs ? hcs.flexDirection : '',
    ths: ths,
    wrappedCount: wrapped.length,
    wrappedNames: wrapped.map(function(t){ return t.text; }),
    scrollW: wrap ? wrap.scrollWidth : 0,
    wrapW: wrap ? Math.round(wrap.getBoundingClientRect().width) : 0,
    toolbarSticky: tcs ? tcs.position : ''
  });
})()`);
let M = {};
try { M = JSON.parse(mob); } catch {}
console.log(`     视口 ${M.vw}  doc.scrollWidth ${M.docW}`);
console.log(`     表头列宽: ${(M.ths || []).map((t) => t.text + '=' + t.w + '×' + t.h).join('  ')}`);
console.log(`     表格容器宽 ${M.wrapW}  内容宽 ${M.scrollW}`);

check('★ 顶栏保持一行（非 column）', M.headerDir !== 'column', M.headerDir);
check('★ 列名未被拆成竖排', M.wrappedCount === 0, M.wrappedCount ? `被拆的列: ${(M.wrappedNames || []).join(', ')}` : '全部单行');
check('★ 表格可横向滚动（内容宽 > 容器宽）', (M.scrollW || 0) > (M.wrapW || 0), `${M.wrapW} → ${M.scrollW}`);
check('★ 工具栏吸顶', M.toolbarSticky === 'sticky', M.toolbarSticky);
check('页面无横向溢出', M.docW <= M.vw, `${M.docW} vs ${M.vw}`);

const mshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
fs.writeFileSync(path.join(OUT, 'admin-手机.png'), Buffer.from(mshot.data, 'base64'));

const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 130));

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('  截图: .shots/runtime/admin-桌面.png / admin-手机.png');
console.log('═══════════════════════════════');

try { await send('Target.closeTarget', { targetId }); } catch {}
chrome.kill('SIGKILL');
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
