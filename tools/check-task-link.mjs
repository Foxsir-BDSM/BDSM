#!/usr/bin/env node
/**
 * tools/check-task-link.mjs —— 验证「任务反馈关联任务」全链路（问题 4）
 *
 * 覆盖：
 *   ① 从 ?task= 进入时自动切到「任务反馈」并预选该任务
 *   ② 关联任务是必选项（未选时校验拦截）
 *   ③ 提交成功后任务状态变为「已提交」
 *   ④ 已提交的任务不再出现在「我的」待办与首页任务直达中
 *
 * 用法：node tools/check-task-link.mjs --port 5230
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5230));
const CDP = Number(getArg('--cdp', 9222));
const BASE = `http://127.0.0.1:${PORT}`;
const TASK_SLUG = 'demo-check';                 // 挑一个可接取任务
const FEEDBACK_SLUG = 'demo-feedback-link';     // 本测试将发布的反馈
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (l, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✓ ${l}${extra ? '  →  ' + String(extra).slice(0, 95) : ''}`); }
  else { fails.push(l); console.log(`  ✗ ${l}${extra ? '  →  ' + String(extra).slice(0, 130) : ''}`); }
};

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});
const { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_API_BASE } = await import('../src/shared/js/config.js');

console.log('════════ 任务反馈关联任务 · 全链路验证 ════════\n');

// ── 账号 + 预接取
const email = `qa_link_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '关联测试', role: 'self' } }),
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

const acc = await fetch(`${TASK_API_BASE}/api/tasks/accept`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskSlug: TASK_SLUG, taskTitle: '关联测试任务', taskType: 'checklist' }),
});
check('预接取任务', acc.status === 200, TASK_SLUG);

// ── 启动站点 + 浏览器
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

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
const js = async (e, t = 45000) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId, t);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};
const goto = async (url, wait = 8000) => { await send('Page.navigate', { url }, sessionId); await sleep(wait); };

// ── 登录
await goto(BASE + '/', 5000);
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
  Object.keys(localStorage).forEach(function(k){ if (k.indexOf('foxsir_list_') === 0) localStorage.removeItem(k); });
  localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)}); return 'ok'; })()`);

// ── ① 带 ?task= 打开编辑器
console.log('\n── ① 从链接进入编辑器 ──');
await goto(`${BASE}/modules/content/post-editor.html?type=note&task=${encodeURIComponent(TASK_SLUG)}`, 11000);

const st1 = await js(`(function(){
  var box = document.getElementById('taskLinkBox');
  var sel = document.getElementById('taskLinkSelect');
  var activeTab = document.querySelector('.type-tab.active, .ttype.active, [data-type].active');
  return JSON.stringify({
    boxExists: !!box,
    boxVisible: box ? getComputedStyle(box).display !== 'none' : false,
    selExists: !!sel,
    selValue: sel ? sel.value : '',
    options: sel ? [].map.call(sel.options, function(o){ return o.value; }) : [],
    activeType: activeTab ? (activeTab.dataset.type || activeTab.textContent.trim()) : '',
    guestShown: (function(){ var g = document.getElementById('guestCard'); return g ? getComputedStyle(g).display !== 'none' : false; })()
  });
})()`);
let S1 = {};
try { S1 = JSON.parse(st1); } catch {}
check('编辑器已加载（非游客态）', S1.guestShown === false, `游客卡片显示=${S1.guestShown}`);
check('★ 关联任务区块已显示', S1.boxVisible === true, `exists=${S1.boxExists}`);
check('★ 已预选链接带来的任务', S1.selValue === TASK_SLUG, `选中「${S1.selValue}」 可选 ${(S1.options || []).length} 项`);

// ── ② 必选校验：清空选择后发布应被拦截
console.log('\n── ② 关联任务为必选项 ──');
const blocked = await js(`(async function(){
  var sel = document.getElementById('taskLinkSelect');
  sel.value = '';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('publishBtn').click();
  await new Promise(function(r){ setTimeout(r, 2500); });
  var msg = document.getElementById('pubMsg');
  return JSON.stringify({ text: (msg ? msg.innerText : '').slice(0, 200), cls: msg ? msg.className : '' });
})()`, 40000);
let B2 = {};
try { B2 = JSON.parse(blocked); } catch {}
check('★ 未选任务时发布被拦截', /err/.test(B2.cls || '') && /关联|任务/.test(B2.text || ''), B2.text);

// ── ③ 选择任务并填写正文后发布
console.log('\n── ③ 填写并发布 ──');
const prep = await js(`(function(){
  var sel = document.getElementById('taskLinkSelect');
  sel.value = ${JSON.stringify(TASK_SLUG)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));

  // 标题 + 正文
  var t = document.getElementById('metaTitle') || document.querySelector('#metaBox input[type=text]');
  if (t) { t.value = '【示例】任务反馈：关联链路测试'; t.dispatchEvent(new Event('input', { bubbles: true })); }
  var body = document.querySelector('#sectionBox textarea');
  if (body) { body.value = '这是用于验证「任务反馈关联任务」链路的测试正文。'; body.dispatchEvent(new Event('input', { bubbles: true })); }

  // 若标题框 id 不同，退而在 metaBox 内找第一个文本输入
  return JSON.stringify({
    titleVal: t ? t.value : '(未找到标题框)',
    bodyVal: body ? body.value.slice(0, 20) : '(未找到正文框)',
    selVal: sel.value
  });
})()`);
let P = {};
try { P = JSON.parse(prep); } catch {}
console.log(`     准备情况: ${JSON.stringify(P)}`);

const published = await js(`(async function(){
  document.getElementById('publishBtn').click();
  // 等待发布完成（含可能的 confirm 对话框已由 CDP 自动接受）
  for (var i = 0; i < 40; i++) {
    await new Promise(function(r){ setTimeout(r, 1000); });
    var msg = document.getElementById('pubMsg');
    var txt = msg ? msg.innerText : '';
    if (/发布成功|发布失败|还有/.test(txt)) return JSON.stringify({ text: txt.slice(0, 320), cls: msg.className });
  }
  var m2 = document.getElementById('pubMsg');
  return JSON.stringify({ text: (m2 ? m2.innerText : '').slice(0, 320), cls: m2 ? m2.className : '', timeout: true });
})()`, 60000);
let PB = {};
try { PB = JSON.parse(published); } catch {}
console.log(`     发布结果: ${String(PB.text || '').replace(/\n/g, ' | ').slice(0, 240)}`);
check('发布成功', /发布成功/.test(PB.text || ''), PB.cls);
check('★ 提示已关联任务', /已关联任务|已标记为/.test(PB.text || ''), '');

// ── ④ 任务状态已变为 submitted
console.log('\n── ④ 核对任务状态 ──');
await sleep(2000);
const mine = await fetch(`${TASK_API_BASE}/api/tasks/mine?status=all`, { headers: { Authorization: `Bearer ${token}` } });
const mj = await mine.json().catch(() => ({}));
const rec = (mj.tasks || []).find((t) => t.task_slug === TASK_SLUG);
check('★ 任务状态变为 submitted', rec && rec.status === 'submitted', rec ? `status=${rec.status}` : '未找到记录');
check('★ 已记录反馈 slug', rec && !!rec.feedback_slug, rec ? `feedback=${rec.feedback_slug}` : '');

const accepted = await fetch(`${TASK_API_BASE}/api/tasks/mine?status=accepted`, { headers: { Authorization: `Bearer ${token}` } });
const aj = await accepted.json().catch(() => ({}));
check('★ 不再出现在「未完成」列表中', !(aj.tasks || []).some((t) => t.task_slug === TASK_SLUG),
  `未完成: ${(aj.tasks || []).map((t) => t.task_slug).join(', ') || '(无)'}`);

// ── ⑤ 我的页面不再显示为进行中
console.log('\n── ⑤ 我的页面 ──');
await goto(`${BASE}/my.html`, 12000);
const myInfo = await js(`(function(){
  var rows = [].map.call(document.querySelectorAll('.mission-row'), function(r){
    return {
      title: (r.querySelector('.m-title')||{}).textContent || '',
      status: (r.querySelector('.m-status')||{}).textContent || ''
    };
  });
  return JSON.stringify({ rows: rows, cnt: (document.getElementById('cntMissions')||{}).textContent || '' });
})()`);
let M = {};
try { M = JSON.parse(myInfo); } catch {}
console.log(`     任务行: ${(M.rows || []).map((r) => `${r.title}[${r.status}]`).join(' | ') || '(无)'}`);
check('我的页面不再有该任务处于「进行中」',
  !(M.rows || []).some((r) => /关联测试|关联链路/.test(r.title) && /进行中/.test(r.status)),
  `计数=${M.cnt}`);

const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 130));

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');

try { await send('Target.closeTarget', { targetId }); } catch {}
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
