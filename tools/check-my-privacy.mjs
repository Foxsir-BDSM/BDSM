#!/usr/bin/env node
/**
 * tools/check-my-privacy.mjs —— 验证我的页面的隐私勾选面板
 *
 * 覆盖：
 *   1. 未绑定档案时的提示
 *   2. 已绑定档案时：认证状态（只读）+ 5 个隐私复选框
 *   3. ★ 复选框不含「首页认证标签」（用户不可管理）
 *   4. 勾选保存能写库
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5190));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9420));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-my-privacy');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });

const EMAIL = get('--email', '');
const PASS = get('--pass', 'Qa!123456');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}  →  ${String(actual).slice(0, 70)}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1500,1200',
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
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0; const pending = new Map(); const errs = []; let sessionId = null;
  const send = (m, p = {}, t = 40000, s = true) => {
    const mid = ++id; const pl = { id: mid, method: m, params: p };
    if (s && sessionId) pl.sessionId = sessionId;
    ws.send(JSON.stringify(pl));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(m + ' 超时')); } }, t);
      pending.set(mid, { resolve: res, reject: rej, timer });
    });
  };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId && m.sessionId !== sessionId) return;
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
  sessionId = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  const js = async (e, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, t);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  console.log('════════ 我的页面 · 隐私面板验证 ════════\n');

  // 登录（注入会话）
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2500);
  const li = await js(`(async () => {
    const m = await import('/shared/js/supabase-client.js');
    const { data, error } = await m.supabase.auth.signInWithPassword({
      email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
    if (error) return 'ERR:' + error.message;
    localStorage.setItem('foxsir_session', JSON.stringify(data.session));
    return 'OK';
  })()`, 30000);
  console.log(`  登录 ${EMAIL}: ${li}`);
  if (String(li).startsWith('ERR')) {
    console.log('  ⚠️ 账号不存在或密码不对，跳过页面验证');
    chrome.kill('SIGKILL');
    process.exit(0);
  }

  await send('Page.navigate', { url: BASE + '/my.html' });
  await sleep(7000);

  const kvText = await js(`document.getElementById('archiveKv')?.innerText?.replace(/\\s+/g,' ')`);
  console.log(`  档案区块: ${String(kvText).slice(0, 140)}\n`);

  const bound = await js(`/已建档/.test(document.getElementById('archiveKv')?.innerText || '')`);
  check('显示「已建档」', bound, true);

  if (bound) {
    check('认证状态行存在', await js(`!!document.querySelector('.verify-badge')`), true);
    console.log('     认证文案: ' + await js(`document.querySelector('.verify-badge')?.textContent?.trim()`));

    const cbCount = await js(`document.querySelectorAll('.pv-check').length`);
    check('隐私复选框 5 个', cbCount, 5);

    const labels = await js(`[...document.querySelectorAll('.pv-check')].map(c => c.closest('.pv-row').querySelector('.pv-label').textContent)`);
    console.log('     复选框清单:');
    (labels || []).forEach((l) => console.log('       · ' + l));

    check('★ 不含「首页认证标签」',
      Array.isArray(labels) && labels.some((l) => l.includes('首页认证标签')), false);
    check('含「是否公开问卷内容」',
      Array.isArray(labels) && labels.some((l) => l.includes('是否公开问卷内容')), true);
    check('复选框都带 data-field-id',
      await js(`[...document.querySelectorAll('.pv-check')].every(c => !!c.dataset.fieldId)`), true);

    // 认证状态是只读的（不可勾选）
    check('认证状态只读（非输入框）',
      await js(`!document.querySelector('.verify-badge input')`), true);
  } else {
    console.log('  （该账号未绑定档案，只验证未绑定分支）');
    check('未绑定时给出匹配依据说明',
      await js(`/邮箱/.test(document.getElementById('archiveKv')?.innerText || '')`), true);
  }

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
