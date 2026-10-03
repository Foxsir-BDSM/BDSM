#!/usr/bin/env node
/**
 * tools/check-menu.mjs —— 用户菜单交互验证（CDP 驱动）
 * 实际点击顶栏触发区，检查下拉面板是否正确展开、菜单项是否齐全。
 *
 *   node tools/check-menu.mjs --port 5180
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
const CDP_PORT = Number(get('--cdp', 9555));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-menu-check');

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });

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
  const erreurs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      erreurs.push(m.params?.exceptionDetails?.exception?.description?.split('\n')[0] || '?');
    } else if (m.method === 'Page.javascriptDialogOpening') {
      // 自动关闭对话框，避免阻塞
      send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
    }
  });

  let sessionId = null;
  const send = (method, params = {}, timeout = 20000, useSession = true) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.has(mid)) {
          pending.delete(mid);
          reject(new Error(`${method} 超时`));
        }
      }, timeout);
      pending.set(mid, { resolve, reject, timer });
    });
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = at.sessionId;
  await send('Runtime.enable');
  await send('Page.enable');

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.value;
  };

  // ── 用例 1：未登录首页 —— 菜单收起态
  console.log('══════ 用户菜单交互验证 ══════\n');
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(2500);

  const check = (label, actual, expected) => {
    const ok = actual === expected;
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fails.push(`${label}  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`); console.log(`  ✗ ${label}  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`); }
  };

  console.log('── 未登录（游客）──');
  check('触发区存在', await evalJs(`!!document.querySelector('#umTrigger')`), true);
  check('菜单初始为收起', await evalJs(`document.getElementById('topUserInfo').classList.contains('open')`), false);
  check('昵称显示「未登录」', await evalJs(`document.querySelector('.um-name')?.textContent.trim()`), '未登录');
  check('副文案提示注册', await evalJs(`document.querySelector('.um-identity')?.textContent.trim()`), '点此注册 / 登录');
  check('头像为占位态', await evalJs(`!!document.querySelector('.um-avatar.is-guest')`), true);
  check('顶栏无独立登出按钮', await evalJs(`!document.querySelector('#topLogoutBtn')`), true);

  // ── 点击展开
  await evalJs(`document.querySelector('#umTrigger').click()`);
  await sleep(450);
  check('点击后菜单展开', await evalJs(`document.getElementById('topUserInfo').classList.contains('open')`), true);
  check('aria-expanded 同步', await evalJs(`document.querySelector('#umTrigger').getAttribute('aria-expanded')`), 'true');
  check('面板可见', await evalJs(`getComputedStyle(document.getElementById('umPanel')).visibility`), 'visible');
  check('含注册/登录项', await evalJs(`[...document.querySelectorAll('.um-item')].some(a=>a.textContent.includes('注册'))`), true);
  check('含了解规则项', await evalJs(`[...document.querySelectorAll('.um-item')].some(a=>a.textContent.includes('了解规则'))`), true);
  check('含返回引导页', await evalJs(`[...document.querySelectorAll('.um-item')].some(a=>a.textContent.includes('返回引导页'))`), true);
  check('游客无管理入口', await evalJs(`[...document.querySelectorAll('.um-item')].some(a=>a.textContent.includes('管理面板'))`), false);
  check('游客有注册按钮', await evalJs(`!!document.querySelector('.guest-box') || [...document.querySelectorAll('.um-item')].some(a=>a.href.includes('auth.html'))`), true);

  // 截图展开态
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const outDir = path.join(process.cwd(), '.shots', 'runtime');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index-menu-open.png'), Buffer.from(shot.data, 'base64'));
  console.log('  · 展开态截图: .shots/runtime/index-menu-open.png');

  // ── 点击外部关闭
  await evalJs(`document.body.click()`);
  await sleep(400);
  check('点击外部后收起', await evalJs(`document.getElementById('topUserInfo').classList.contains('open')`), false);

  // ── Esc 关闭
  await evalJs(`document.querySelector('#umTrigger').click()`);
  await sleep(300);
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
  await sleep(400);
  check('Esc 可关闭', await evalJs(`document.getElementById('topUserInfo').classList.contains('open')`), false);

  // ── 用例 2：个人资料页（未登录）
  console.log('\n── 个人资料页（未登录）──');
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(2200);
  check('显示游客提示卡', await evalJs(`getComputedStyle(document.getElementById('guestCard')).display`), 'block');
  check('隐藏会员区', await evalJs(`getComputedStyle(document.getElementById('memberArea')).display`), 'none');
  check('提供注册入口', await evalJs(`!!document.querySelector('#guestCard a[href="/auth.html"]')`), true);

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (erreurs.length) {
    console.log('  页面异常:');
    for (const e of [...new Set(erreurs)]) console.log('   · ' + e);
  }
  if (fails.length) {
    console.log('  失败明细:');
    for (const f of fails) console.log('   · ' + f);
  }
  console.log('═══════════════════════════════');

  await send('Target.closeTarget', { targetId }, 10000, false);
  chrome.kill('SIGKILL');
  process.exit(fails.length || erreurs.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
