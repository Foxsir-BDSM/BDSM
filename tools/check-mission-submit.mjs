#!/usr/bin/env node
/**
 * tools/check-mission-submit.mjs —— 验证首页任务直达的「提交反馈」按钮
 *
 * 覆盖：
 *   ① 按钮存在且是暗金色高亮样式（非纯文字）
 *   ② 点击整行 → 任务详情页
 *   ③ 点击按钮 → 任务反馈编辑器，且自动选中该任务
 *   ④ 键盘可达
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(getArg('--port', 5240));
const CDP = Number(getArg('--cdp', 9830));
const BASE = `http://127.0.0.1:${PORT}`;
const SLUG = 'demo-breath';
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

console.log('════════ 任务直达「提交反馈」按钮验证 ════════\n');

// 账号 + 预接取
const email = `qa_submit_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '提交测试', role: 'self' } }),
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
const acc = await fetch(`${TASK_API_BASE}/api/tasks/accept`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskSlug: SLUG, taskTitle: '提交按钮测试任务', taskType: 'task' }),
});
check('预接取任务', acc.status === 200, SLUG);

const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await sleep(9000);

// 启动无头浏览器
const os = await import('node:os');
const path = await import('node:path');
const PROFILE = path.join(os.tmpdir(), 'foxsir-mission-submit');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1280,900',
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
const js = async (e, t = 45000) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId, t);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

// 登录
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(5500);
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
await js(`(function(){ localStorage.setItem('foxsir_github_token', ${JSON.stringify(env.GITHUB_TOKEN)}); return 'ok'; })()`);

// 回首页等任务直达渲染
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(11000);

// ── ① 按钮存在且为高亮样式
console.log('\n── ① 按钮外观 ──');
const look = await js(`(function(){
  var b = document.querySelector('.ms-submit');
  if (!b) return JSON.stringify({ exists: false, items: document.querySelectorAll('.ms-item').length });
  var cs = getComputedStyle(b);
  return JSON.stringify({
    exists: true,
    text: b.textContent.trim(),
    tag: b.tagName.toLowerCase(),
    role: b.getAttribute('role'),
    tabindex: b.getAttribute('tabindex'),
    bgImage: cs.backgroundImage.slice(0, 60),
    color: cs.color,
    padding: cs.padding,
    cursor: cs.cursor,
    href: b.dataset.href || '',
    itemCount: document.querySelectorAll('.ms-item').length
  });
})()`);
let K = {};
try { K = JSON.parse(look); } catch {}
console.log(`     ${JSON.stringify(K).slice(0, 260)}`);
check('任务直达已渲染', K.itemCount >= 1, `条目 ${K.itemCount}`);
check('★ 按钮存在', K.exists === true);
check('★ 有渐变底色（非纯文字）', /gradient/.test(K.bgImage || ''), (K.bgImage || '').slice(0, 44));
check('★ 可点击（cursor:pointer）', K.cursor === 'pointer', K.cursor);
check('★ 指向反馈编辑器', /post-editor\.html/.test(K.href || '') && /task=/.test(K.href || ''), K.href);
check('键盘可达（role=link + tabindex）', K.role === 'link' && K.tabindex === '0', `${K.role}/${K.tabindex}`);

// ── ② 点整行 → 详情页
console.log('\n── ② 点击整行应进任务详情 ──');
await js(`(function(){
  var row = document.querySelector('.ms-item');
  row.setAttribute('data-probe', 'row');
  row.click();
  return 'ok';
})()`);
await sleep(6000);
const afterRow = await js(`location.href`);
check('★ 跳转到任务详情页', /post\.html\?slug=/.test(String(afterRow)), String(afterRow).split('/').pop());

// ── ③ 点按钮 → 反馈编辑器
console.log('\n── ③ 点击按钮应进反馈编辑器 ──');
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(11000);
await js(`document.querySelector('.ms-submit').click()`);
await sleep(11000);
const afterBtn = await js(`location.href`);
check('★ 跳转到反馈编辑器', /post-editor\.html/.test(String(afterBtn)), String(afterBtn).split('/').pop());
check('★ URL 带上该任务', String(afterBtn).includes(encodeURIComponent(SLUG)) || String(afterBtn).includes(SLUG),
  decodeURIComponent(String(afterBtn)).split('?')[1] || '');

const editor = await js(`(function(){
  var modal = document.querySelector('.mode-tab[data-mode="feedback"]');
  var sel = document.getElementById('taskLinkSelect');
  var box = document.getElementById('taskLinkBox');
  return JSON.stringify({
    feedbackModeOn: modal ? modal.classList.contains('on') : null,
    boxVisible: box ? getComputedStyle(box).display !== 'none' : false,
    selected: sel ? sel.value : '',
    btnText: (document.getElementById('publishBtn')||{}).textContent || ''
  });
})()`);
let E = {};
try { E = JSON.parse(editor); } catch {}
console.log(`     编辑器状态: ${JSON.stringify(E)}`);
check('★ 已切到「任务反馈」板块', E.feedbackModeOn === true);
check('★ 关联任务已自动选中', E.selected === SLUG, `选中「${E.selected}」`);

// ── ④ 键盘可达
console.log('\n── ④ 键盘可用 ──');
await send('Page.navigate', { url: BASE + '/' }, sessionId);
await sleep(11000);
await js(`(function(){
  var b = document.querySelector('.ms-submit');
  b.focus();
  b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return 'ok';
})()`);
await sleep(7000);
const afterKey = await js(`location.href`);
check('★ 回车键可触发跳转', /post-editor\.html/.test(String(afterKey)), String(afterKey).split('/').pop());

const realErrs = [...new Set(errs)].filter((e) => e && !/favicon|ERR_|Failed to load resource/i.test(e));
check('无 JS 报错', realErrs.length === 0, realErrs.join(' | ').slice(0, 130));

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');

try { await send('Target.closeTarget', { targetId }); } catch {}
chrome.kill('SIGKILL');
vite.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
