#!/usr/bin/env node
/**
 * tools/check-content-flow.mjs —— 内容与任务全链路验证
 *
 * 覆盖：
 *   ① 列表页渲染 4 篇，带类型徽章
 *   ② 四篇详情页均能打开且渲染正文
 *   ③ 接取按钮：前 3 种类型显示，任务反馈（note）不显示
 *   ④ 接取后按钮状态流转 + D1 落库
 *   ⑤ 我的页面显示该任务
 *   ⑥ 首页任务直达出现该任务
 *
 * 用法：node tools/check-content-flow.mjs --port 5210
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5210));
const CDP = Number(getArg('--cdp', 9222));
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (label, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${label}${extra ? '  →  ' + String(extra).slice(0, 90) : ''}`); }
  else { fails.push(label); console.log(`  ✗ ${label}${extra ? '  →  ' + String(extra).slice(0, 120) : ''}`); }
};

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

console.log('════════ 内容与任务全链路验证 ════════\n');

// ── 准备账号
const email = `qa_flow_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '流程测试', role: 'self' } }),
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

// ── 启动站点
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);
try { const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) }); check('本地站点已启动', r.ok, BASE); }
catch (e) { check('本地站点已启动', false, e.message); vite.kill(); process.exit(1); }

// ── 连接浏览器
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
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};
const goto = async (url, wait = 7000) => { await send('Page.navigate', { url }, sessionId); await sleep(wait); };

// ── 登录
await goto(BASE + '/', 4500);
let sess = '';
for (let i = 1; i <= 3; i++) {
  sess = await js(`(async function(){
    try {
      var m = await import('/src/shared/js/supabase-client.js');
      var r = await m.supabase.auth.setSession({ access_token: ${JSON.stringify(token)}, refresh_token: ${JSON.stringify(refresh || '')} });
      return r.error ? 'err:' + r.error.message : 'ok';
    } catch(e) { return 'err:' + e.message; }
  })()`);
  if (String(sess) === 'ok') break;
  await sleep(2500);
}
check('登录会话建立', String(sess) === 'ok', sess);
await js(`(function(){ localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)});
  Object.keys(localStorage).forEach(function(k){ if (k.indexOf('foxsir_') === 0) localStorage.removeItem(k); });
  localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)}); return 'ok'; })()`);

// ── ① 列表页
console.log('\n── ① 列表页 ──');
await goto(`${BASE}/modules/content/`, 11000);
const listInfo = await js(`(function(){
  var cards = [].map.call(document.querySelectorAll('.pcard'), function(c){
    return {
      title: (c.querySelector('.c-title')||{}).textContent || '',
      type: (c.querySelector('.c-type')||{}).textContent || '',
      slug: (function(){ var m=(c.getAttribute('href')||'').match(/slug=([^&]+)/); return m?decodeURIComponent(m[1]):''; })()
    };
  });
  return JSON.stringify({ count: cards.length, cards: cards, empty: (document.body.innerText||'').indexOf('还是一片空白') >= 0 });
})()`);
let L = {};
try { L = JSON.parse(listInfo); } catch {}
check('列表页渲染出卡片', L.count >= 4, `卡片数 ${L.count}`);
const slugs = (L.cards || []).map((c) => c.slug);
['demo-breath', 'demo-stretch', 'demo-check', 'demo-feedback'].forEach((s) => {
  const hit = (L.cards || []).find((c) => c.slug === s);
  check(`  含 ${s}（含类型徽章）`, !!hit && hit.type.length > 0, hit ? hit.type.trim() : '未找到');
});

// ── ②③ 详情页 + 接取按钮
console.log('\n── ②③ 详情页与接取按钮 ──');
const CASES = [
  { slug: 'demo-breath', type: 'task', acceptable: true, label: '玩法任务' },
  { slug: 'demo-stretch', type: 'collection', acceptable: true, label: '主题合集' },
  { slug: 'demo-check', type: 'checklist', acceptable: true, label: '分级清单' },
  { slug: 'demo-feedback', type: 'note', acceptable: false, label: '任务反馈' },
];

for (const c of CASES) {
  await goto(`${BASE}/modules/content/post.html?slug=${encodeURIComponent(c.slug)}`, 8000);
  const st = await js(`(function(){
    var b = document.getElementById('acceptBtn');
    var title = (document.querySelector('.d-title')||document.querySelector('.detail h1')||{}).textContent || '';
    var bodyLen = ((document.querySelector('.detail')||{}).innerText || '').length;
    return JSON.stringify({
      title: title.trim(),
      bodyLen: bodyLen,
      btnExists: !!b,
      btnVisible: b ? getComputedStyle(b).display !== 'none' : false,
      btnText: b ? b.textContent.trim() : '',
      err: (document.querySelector('.st-t1')||{}).textContent || ''
    });
  })()`);
  let s = {};
  try { s = JSON.parse(st); } catch {}

  const rendered = !s.err && s.title.length > 0;
  check(`  ${c.label} 详情页渲染`, rendered, rendered ? `标题「${s.title}」 内容 ${s.bodyLen} 字` : s.err);

  if (c.acceptable) {
    check(`  ${c.label} 显示接取按钮`, s.btnVisible === true, s.btnText);
  } else {
    check(`  ${c.label} ★ 不显示接取按钮`, s.btnVisible === false, `display=${s.btnVisible ? 'visible' : 'none'}`);
  }
}

// ── ④ 接取
console.log('\n── ④ 接取并核对 D1 ──');
await goto(`${BASE}/modules/content/post.html?slug=demo-breath`, 8000);
await js(`document.getElementById('acceptBtn').click()`);
await sleep(7000);
const after = await js(`(function(){
  var b = document.getElementById('acceptBtn');
  return JSON.stringify({ text: b.textContent.trim(), mode: b.dataset.mode||'', disabled: b.disabled });
})()`);
let A = {};
try { A = JSON.parse(after); } catch {}
check('接取后按钮变为已接取', /已接取/.test(A.text || ''), `${A.text} (mode=${A.mode})`);
check('按钮进入 goto 模式', A.mode === 'goto', A.mode);

const mineRes = await fetch(`${TASK_API_BASE}/api/tasks/mine?status=accepted`, { headers: { Authorization: `Bearer ${token}` } });
const mineJson = await mineRes.json().catch(() => ({}));
const rec = (mineJson.tasks || []).find((t) => t.task_slug === 'demo-breath');
check('D1 已落库', !!rec, rec ? `status=${rec.status} title=${rec.task_title}` : `记录数 ${(mineJson.tasks || []).length}`);
check('D1 标题中文未乱码', rec ? !/[ÃÂåç]/.test(rec.task_title || '') : false, rec ? rec.task_title : '');

// ── ⑤ 我的页面
console.log('\n── ⑤ 我的页面 ──');
await goto(`${BASE}/my.html`, 11000);
const myInfo = await js(`(function(){
  var rows = [].map.call(document.querySelectorAll('.mission-row'), function(r){
    return {
      title: (r.querySelector('.m-title')||{}).textContent || '',
      status: (r.querySelector('.m-status')||{}).textContent || '',
      href: (r.querySelector('.m-title')||{}).getAttribute ? (r.querySelector('.m-title').getAttribute('href')||'') : ''
    };
  });
  var cnt = document.getElementById('cntMissions');
  var txt = (document.getElementById('missionList')||{}).innerText || '';
  return JSON.stringify({ rows: rows, cnt: cnt ? cnt.textContent : '', raw: txt.slice(0, 160) });
})()`);
let M = {};
try { M = JSON.parse(myInfo); } catch {}
check('我的页面显示任务行', (M.rows || []).length >= 1, `行数 ${(M.rows || []).length}`);
check('标签页计数已更新', M.cnt && M.cnt !== '0', `cntMissions=${M.cnt}`);
if ((M.rows || []).length) check('任务行含状态徽章', (M.rows[0].status || '').length > 0, `「${M.rows[0].status}」`);

// ── ⑥ 首页任务直达
console.log('\n── ⑥ 首页任务直达 ──');
await goto(BASE + '/', 10000);
const homeInfo = await js(`(function(){
  var sec = document.getElementById('missionsSection');
  var items = [].map.call(document.querySelectorAll('.ms-item'), function(a){
    return { name: (a.querySelector('.ms-name')||{}).textContent || '', href: a.getAttribute('href')||'' };
  });
  return JSON.stringify({
    exists: !!sec,
    hidden: sec ? sec.hidden : null,
    display: sec ? getComputedStyle(sec).display : 'n/a',
    items: items
  });
})()`);
let H = {};
try { H = JSON.parse(homeInfo); } catch {}
check('首页存在任务直达区块', H.exists === true);
check('区块已显示（未隐藏）', H.hidden === false, `hidden=${H.hidden} display=${H.display}`);
check('区块含已接取任务', (H.items || []).length >= 1, `条目数 ${(H.items || []).length}`);
if ((H.items || []).length) check('条目指向该任务', (H.items[0].name || '').length > 0, H.items[0].name);

// ── 收尾
const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 140));

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
