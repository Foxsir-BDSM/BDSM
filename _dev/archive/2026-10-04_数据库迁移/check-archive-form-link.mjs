#!/usr/bin/env node
/**
 * tools/check-archive-form-link.mjs
 * 验证「档案列表页 → 填写档案」跳转是否带上账号参数
 *
 * 判定：点击后新开标签页的 URL 是否含 email / name / uid 三个参数，
 *       且 email 与登录账号一致。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const APP_PORT = Number(get('--port', 5185));
const BASE = `http://127.0.0.1:${APP_PORT}`;
const CDP_PORT = Number(get('--cdp', 9366));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-formlink-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_fl_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `跳转测试${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${typeof expected === 'function' ? '(函数判定)' : JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1500,1000',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function waitCDP(p, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${p}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  await waitCDP(CDP_PORT);

  // 用浏览器级 CDP 以便监听新开标签页
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0; const pending = new Map();
  const send = (method, params = {}, timeout = 40000, sessionId) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, timeout);
      pending.set(mid, { resolve, reject, timer });
    });
  };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  const SID = att.sessionId;
  await send('Runtime.enable', {}, 20000, SID);
  await send('Page.enable', {}, 20000, SID);

  const js = async (expr, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t, SID);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  console.log('════════ 档案表单跳转验证 ════════\n');

  // ── 1. 注册并登录
  console.log('── 1. 准备测试账号 ──');
  await send('Page.navigate', { url: BASE + '/auth.html' }, 40000, SID);
  await sleep(2500);
  const reg = await js(`(async () => {
    const m = await import('/shared/js/supabase-client.js');
    const { error } = await m.supabase.auth.signUp({
      email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)},
      options: { data: { role:'self', nickname:${JSON.stringify(NICK)}, points:0,
        primary_identity:'male_S', primary_label:'男S', gender:'male', role_type:'top',
        orientation:'hetero', orientation_label:'异性' } } });
    if (error) return 'ERR:' + error.message;
    const li = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
    if (li.error) return 'LOGIN_ERR:' + li.error.message;
    localStorage.setItem('foxsir_session', JSON.stringify(li.data.session));
    return 'OK';
  })()`, 40000);
  check('账号就绪', reg, 'OK');
  if (reg !== 'OK') throw new Error('注册失败: ' + reg);

  // ── 2. 打开档案列表页
  console.log('\n── 2. 打开档案列表页 ──');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' }, 40000, SID);
  await sleep(7000);
  check('按钮存在', await js(`!!document.getElementById('btnFillForm')`), true);
  check('按钮可见', await js(`(() => { const b=document.getElementById('btnFillForm'); return !!b && b.offsetParent !== null; })()`), true);

  // ── 3. 直接调用内部函数取 URL（先静态验证拼接逻辑）
  console.log('\n── 3. 静态验证 URL 拼接 ──');
  const builtUrl = await js(`(async () => {
    // 复现页面里的拼接逻辑，验证参数与账号一致
    const m = await import('/shared/js/auth.js');
    const u = await m.getCurrentUser();
    if (!u) return 'NO_USER';
    const p = new URLSearchParams({
      email: u.email,
      name: u.user_metadata?.nickname || '',
      uid: (u.id || '').slice(0, 8),
    });
    return p.toString();
  })()`, 30000);
  console.log('     拼接结果: ' + builtUrl);

  let params = null;
  try { params = new URLSearchParams(builtUrl); } catch {}
  check('email 参数正确', params?.get('email'), EMAIL);
  check('name 参数正确', params?.get('name'), NICK);
  check('uid 为 8 位', (params?.get('uid') || '').length, 8);

  // ── 4. 真实点击，抓新标签页 URL
  console.log('\n── 4. 真实点击「去填写」──');
  const before = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).filter((t) => t.type === 'page').length;
  console.log(`     点击前标签页数: ${before}`);

  await js(`document.getElementById('btnFillForm').click()`);
  await sleep(6000);

  const tabs = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).filter((t) => t.type === 'page');
  console.log(`     点击后标签页数: ${tabs.length}`);
  const newTabs = tabs.filter((t) => t.url.includes('fillout.com'));
  newTabs.forEach((t) => console.log('     新标签: ' + t.url));

  check('已打开表单标签页', newTabs.length > 0, true);
  if (newTabs.length) {
    let np = null;
    try { np = new URL(newTabs[0].url).searchParams; } catch {}
    check('跳转 URL 带 email 参数', np?.get('email'), EMAIL);
    check('跳转 URL 带 name 参数', np?.get('name'), NICK);
    check('跳转 URL 带 uid 参数', (np?.get('uid') || '').length, 8);
  }

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (fails.length) { console.log('  ── 失败明细 ──'); fails.forEach((f) => console.log('   · ' + f)); }
  console.log(`  测试账号: ${EMAIL}`);
  console.log('═══════════════════════════════');

  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
