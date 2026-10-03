#!/usr/bin/env node
/**
 * tools/check-auth-flow.mjs —— 登录态功能验证（CDP 驱动）
 *
 * 流程：注册测试账号 → 验证登录后首页菜单 → 验证个人资料页可编辑 → 验证昵称保存
 * 用途：验证「类微信用户菜单 + 个人资料页」在已登录状态下的完整功能。
 *
 *   node tools/check-auth-flow.mjs --port 5180
 *   node tools/check-auth-flow.mjs --port 5180 --keep   保留测试账号（不登出）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const PORT = Number(get('--port', 5180));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9666));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-auth-flow');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

// 测试账号（时间戳保证唯一）
const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `测试用户${TS.slice(-4)}`;
const NICK2 = `改名${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--window-size=1440,1000',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
  ],
  { stdio: 'ignore' }
);

async function waitCDP(p, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  const wsUrl = await waitCDP(CDP_PORT);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const pageErrors = [];
  let sessionId = null;

  const send = (method, params = {}, timeout = 25000, useSession = true) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.has(mid)) { pending.delete(mid); reject(new Error(`${method} 超时`)); }
      }, timeout);
      pending.set(mid, { resolve, reject, timer });
    });
  };

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId && m.sessionId !== sessionId) return;
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params?.exceptionDetails?.exception?.description?.split('\n')[0] || '?');
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = at.sessionId;
  await send('Runtime.enable');
  await send('Page.enable');

  const js = async (expr, timeout) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, timeout);
    return r.result?.value;
  };

  const check = (label, actual, expected) => {
    const ok = actual === expected;
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else {
      fails.push(`${label}  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`);
      console.log(`  ✗ ${label}  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`);
    }
  };

  console.log('══════ 登录态功能验证 ══════');
  console.log(`  测试账号: ${EMAIL}\n`);

  // ───────── 1. 直接调 Supabase 注册（绕过 UI，聚焦验证登录后的功能）
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2500);

  const signUpResult = await js(
    `(async () => {
       const m = await import('/shared/js/supabase-client.js');
       const { data, error } = await m.supabase.auth.signUp({
         email: ${JSON.stringify(EMAIL)},
         password: ${JSON.stringify(PASS)},
         options: { data: {
           role: 'self', nickname: ${JSON.stringify(NICK)}, points: 0,
           primary_identity: 'male_S', primary_label: '男S',
           gender: 'male', role_type: 'top', secondary_identities: ['female_M']
         }}
       });
       if (error) return 'ERR:' + error.message;
       const login = await m.supabase.auth.signInWithPassword({
         email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)}
       });
       if (login.error) return 'LOGIN_ERR:' + login.error.message;
       localStorage.setItem('foxsir_session', JSON.stringify(login.data.session));
       return 'OK:' + (login.data.user?.id || '');
     })()`,
    40000
  );

  if (typeof signUpResult === 'string' && signUpResult.startsWith('OK:')) {
    pass++;
    console.log(`  ✓ 注册并登录成功 (uid=${signUpResult.slice(3, 11)}…)`);
  } else {
    fails.push('注册/登录失败: ' + signUpResult);
    console.log(`  ✗ 注册/登录失败: ${signUpResult}`);
    console.log('\n  提示：若邮箱验证为必需，请在 Supabase 关闭 Confirm email 后重试。');
    chrome.kill('SIGKILL');
    process.exit(1);
  }

  // ───────── 2. 首页：登录态菜单
  console.log('\n── 首页 · 登录态菜单 ──');
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(3000);

  check('昵称已显示', await evalJsSafe(js, `document.querySelector('.um-name')?.textContent.trim()`), NICK);
  check('身份显示为主身份', await evalJsSafe(js, `document.querySelector('.um-identity')?.textContent.trim()?.startsWith('男S')`), true);
  check('头像为占位（未上传）', await evalJsSafe(js, `!!document.querySelector('.um-avatar .um-letter')`), true);
  check('顶栏不再有独立登出按钮', await evalJsSafe(js, `!document.querySelector('#topLogoutBtn')`), true);

  await js(`document.querySelector('#umTrigger').click()`);
  await sleep(500);
  check('菜单可展开', await evalJsSafe(js, `document.getElementById('topUserInfo').classList.contains('open')`), true);
  check('含「个人资料」入口', await evalJsSafe(js, `!!document.querySelector('.um-item[href="/profile.html"]')`), true);
  check('含「退出登录」', await evalJsSafe(js, `!!document.querySelector('#umLogoutBtn')`), true);
  check('面板显示邮箱', await evalJsSafe(js, `(document.querySelector('.um-panel-head .h-sub')?.textContent||'').includes('qa_')`), true);
  check('面板显示角色', await evalJsSafe(js, `(document.querySelector('.um-panel-head')?.textContent||'').includes('普通用户')`), true);
  check('self 角色无管理入口', await evalJsSafe(js, `[...document.querySelectorAll('.um-item')].some(a=>a.textContent.includes('管理面板'))`), false);

  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'index-menu-logged-in.png'), Buffer.from(shot1.data, 'base64'));
  console.log('  · 截图: .shots/runtime/index-menu-logged-in.png');

  // ───────── 3. 个人资料页
  console.log('\n── 个人资料页 · 登录态 ──');
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(3000);

  check('会员区可见', await evalJsSafe(js, `getComputedStyle(document.getElementById('memberArea')).display`), 'block');
  check('游客卡隐藏', await evalJsSafe(js, `getComputedStyle(document.getElementById('guestCard')).display`), 'none');
  check('昵称已回填', await evalJsSafe(js, `document.getElementById('nicknameInput').value`), NICK);
  check('邮箱已回填且只读', await evalJsSafe(js, `document.getElementById('emailInput').value.includes('qa_') && document.getElementById('emailInput').disabled`), true);
  check('主身份已展示', await evalJsSafe(js, `document.getElementById('primaryIdentity').textContent.includes('男S')`), true);
  check('副身份已展示', await evalJsSafe(js, `document.getElementById('secondaryIdentity').textContent.includes('女M')`), true);
  check('等级信息已展示', await evalJsSafe(js, `document.getElementById('levelInfo').textContent.includes('Lv.')`), true);
  check('角色已展示', await evalJsSafe(js, `document.getElementById('roleInfo').textContent.trim()`), '普通用户');
  check('保存按钮初始禁用', await evalJsSafe(js, `document.getElementById('saveBtn').disabled`), true);

  // ───────── 4. 修改昵称并保存
  console.log('\n── 昵称编辑与保存 ──');
  await js(`(() => {
    const el = document.getElementById('nicknameInput');
    el.value = ${JSON.stringify(NICK2)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(300);
  check('改动后保存按钮启用', await evalJsSafe(js, `!document.getElementById('saveBtn').disabled`), true);

  await js(`document.getElementById('saveBtn').click()`);
  await sleep(3500);
  check('保存成功提示', await evalJsSafe(js, `document.getElementById('saveNotice').classList.contains('ok')`), true);
  check('保存后按钮回到禁用', await evalJsSafe(js, `document.getElementById('saveBtn').disabled`), true);

  // 重新加载确认持久化
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(3000);
  check('刷新后昵称已持久化', await evalJsSafe(js, `document.getElementById('nicknameInput').value`), NICK2);

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'profile-logged-in.png'), Buffer.from(shot2.data, 'base64'));
  console.log('  · 截图: .shots/runtime/profile-logged-in.png');

  // ───────── 5. 首页应同步新昵称
  console.log('\n── 昵称同步到首页 ──');
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(3000);
  check('首页显示新昵称', await evalJsSafe(js, `document.querySelector('.um-name')?.textContent.trim()`), NICK2);

  // ───────── 6. 登出
  console.log('\n── 退出登录 ──');
  await js(`document.querySelector('#umTrigger').click()`);
  await sleep(400);
  await js(`document.getElementById('umLogoutBtn').click()`);
  await sleep(4000);
  const afterLogout = await js(`({ url: location.pathname, session: localStorage.getItem('foxsir_session') })`);
  check('已跳转离开首页', afterLogout?.url !== '/index.html', true);
  check('本地会话已清除', afterLogout?.session, null);

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (pageErrors.length) {
    console.log('  ── 页面异常 ──');
    for (const e of [...new Set(pageErrors)]) console.log('   · ' + e);
  }
  if (fails.length) {
    console.log('  ── 失败明细 ──');
    for (const f of fails) console.log('   · ' + f);
  }
  console.log(`  测试账号: ${EMAIL}（如需清理可在 Supabase 后台删除）`);
  console.log('═══════════════════════════════');

  await send('Target.closeTarget', { targetId }, 10000, false);
  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}

/** 包装：避免 js 未定义时的引用错误 */
async function evalJsSafe(js, expr) {
  try {
    return await js(expr);
  } catch (e) {
    return '__ERR__:' + e.message;
  }
}
