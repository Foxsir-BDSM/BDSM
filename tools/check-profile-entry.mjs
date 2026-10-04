#!/usr/bin/env node
/**
 * tools/check-profile-entry.mjs
 * 验证「个人资料入口取消 + 资料页改为编辑页」
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5191));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP = Number(get('--cdp', 9440));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-profile-entry');
const EMAIL = get('--email', '');
const PASS = 'Qa!123456';
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}  →  ${String(actual).slice(0, 64)}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1500,1200',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, 'about:blank',
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
  await waitCDP(CDP);
  const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0; const pending = new Map(); const errs = []; let sid = null;
  const send = (m, p = {}, t = 40000, s = true) => {
    const mid = ++id; const pl = { id: mid, method: m, params: p };
    if (s && sid) pl.sessionId = sid;
    ws.send(JSON.stringify(pl));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(m + ' 超时')); } }, t);
      pending.set(mid, { resolve: res, reject: rej, timer });
    });
  };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId && m.sessionId !== sid) return;
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0]);
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sid = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  const js = async (e, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, t);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  // 登录
  if (EMAIL) {
    await send('Page.navigate', { url: BASE + '/auth.html' });
    await sleep(2500);
    await js(`(async () => {
      const m = await import('/shared/js/supabase-client.js');
      const { data } = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
      if (data?.session) localStorage.setItem('foxsir_session', JSON.stringify(data.session));
    })()`, 30000);
  }

  console.log('════════ 个人资料入口改造验证 ════════\n');

  // ── 1. 顶栏用户菜单
  console.log('── 1. 顶栏用户菜单 ──');
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(5000);
  await js(`document.querySelector('.user-menu .um-trigger')?.click()`);
  await sleep(700);

  const menuText = await js(`document.querySelector('.user-menu')?.innerText?.replace(/\\s+/g,' ')`);
  console.log(`     菜单内容: ${String(menuText).slice(0, 140)}`);
  check('菜单已无「个人资料」', /个人资料/.test(String(menuText)), false);
  check('菜单仍有「我的」', /我的/.test(String(menuText)), true);

  // ── 2. 我的页面入口
  console.log('\n── 2. 我的页面的编辑资料入口 ──');
  await send('Page.navigate', { url: BASE + '/my.html' });
  await sleep(5000);
  const btn = await js(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => /编辑资料/.test(x.textContent));
    return a ? JSON.stringify({ text: a.textContent.trim(), href: a.getAttribute('href') }) : null;
  })()`);
  console.log(`     按钮: ${btn}`);
  check('存在「编辑资料」按钮', btn !== null, true);
  if (btn) {
    const b = JSON.parse(btn);
    check('指向编辑资料页', b.href, '/profile.html');
  }

  // ── 3. 编辑资料页本身
  console.log('\n── 3. 编辑资料页 ──');
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(4500);
  check('标题为「编辑资料」', await js(`document.querySelector('.page-title')?.textContent?.trim()`), '编辑资料');
  check('浏览器标题已改', await js(`document.title`), (v) => String(v).includes('编辑资料'));
  check('返回链接指向我的', await js(`document.querySelector('.back-link')?.getAttribute('href')`), '/my.html');

  const cards = await js(`[...document.querySelectorAll('.card-title')].map(e=>e.textContent.trim().slice(0,12))`);
  console.log(`     板块: ${JSON.stringify(cards)}`);
  check('含头像板块', Array.isArray(cards) && cards.some((c) => c.includes('头像')), true);
  check('含基本资料板块', Array.isArray(cards) && cards.some((c) => c.includes('基本资料')), true);
  check('含身份与角色板块', Array.isArray(cards) && cards.some((c) => c.includes('身份')), true);

  check('昵称输入框存在', await js(`!!document.getElementById('nicknameInput')`), true);
  check('邮箱输入框为只读', await js(`document.getElementById('emailInput')?.disabled`), true);
  check('头像上传入口存在', await js(`!!document.getElementById('avatarFile')`), true);

  const hint = await js(`[...document.querySelectorAll('.hint')].map(e=>e.textContent).join(' ')`);
  check('身份区说明「不可自助修改」', /不可自助修改/.test(String(hint)), true);

  const realErrs = errs.filter((e) => !/favicon|ERR_/.test(e));
  if (realErrs.length) {
    console.log('\n  ── 页面异常 ──');
    [...new Set(realErrs)].forEach((e) => console.log('   · ' + e));
  }
  check('无页面异常', realErrs.length, 0);

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (fails.length) fails.forEach((f) => console.log('   · ' + f));
  console.log('═══════════════════════════════');

  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
