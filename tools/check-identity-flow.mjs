#!/usr/bin/env node
/**
 * tools/check-identity-flow.mjs —— 身份流程端到端验证（CDP 驱动）
 *
 * 替代已废弃的 check-orientation-flow.mjs（取向维度已取消）
 * 覆盖：注册页身份选择器（4 身份）→ 真实注册写入身份 → 资料页展示角色 →
 *       档案列表页按身份分流
 *
 *   node tools/check-identity-flow.mjs --port 5185
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5185));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9388));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-identity-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_id_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `身份测试${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
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
  const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0; const pending = new Map(); const pageErrors = []; let sessionId = null;
  const send = (method, params = {}, timeout = 40000, useSession = true) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, timeout);
      pending.set(mid, { resolve, reject, timer });
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
      pageErrors.push(m.params?.exceptionDetails?.exception?.description?.split('\n')[0] || '?');
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable');

  const js = async (expr, t = 30000) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t);
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
    return r.result?.value;
  };

  console.log('══════ 身份流程端到端验证 ══════\n');

  // ── 1. 注册页身份选择器
  console.log('── 1. 注册页身份选择器 ──');
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2500);
  await js(`document.querySelector('[data-tab="register"]')?.click()`);
  await sleep(800);

  check('身份卡片 4 个', await js(`document.querySelectorAll('.primary-grid .identity-card').length`), 4);
  check('身份标签正确',
    await js(`[...document.querySelectorAll('.primary-grid .identity-card .label')].map(e=>e.textContent)`),
    ['男S', '女S', '男M', '女M']);
  check('已无取向容器', await js(`!document.getElementById('orientation-selector-container')`), true);
  check('页面无 Dom/Z/Sub/B 选项',
    await js(`/Dom|Sub|男Z|女Z|男B|女B/.test(document.querySelector('.primary-grid')?.textContent||'')`), false);

  await js(`document.querySelector('.identity-card[data-id="female_M"]').click()`);
  await sleep(400);
  check('选中后高亮', await js(`document.querySelector('.identity-card[data-id="female_M"]').classList.contains('selected-primary')`), true);
  check('提示显示角色', await js(`document.getElementById('identity-hint').textContent.includes('奴')`), true);

  // ── 2. 真实注册
  console.log('\n── 2. 真实注册（仅身份）──');
  await js(`(()=>{
    document.getElementById('register-email').value=${JSON.stringify(EMAIL)};
    document.getElementById('register-nickname').value=${JSON.stringify(NICK)};
    document.getElementById('register-password').value=${JSON.stringify(PASS)};
  })()`);
  await js(`document.getElementById('register-form')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  await sleep(6000);

  const regState = await js(`(async()=>{
    const m = await import('/shared/js/supabase-client.js');
    const { data:{ session } } = await m.supabase.auth.getSession();
    if(!session) return 'NO_SESSION';
    localStorage.setItem('foxsir_session', JSON.stringify(session));
    const meta = session.user.user_metadata||{};
    return JSON.stringify({ id: meta.primary_identity, label: meta.primary_label,
      hasOrientation: 'orientation' in meta });
  })()`, 30000);
  console.log('     注册结果: ' + regState);
  let meta = null;
  try { meta = JSON.parse(regState); } catch {}
  check('注册成功', !!meta, true);
  if (!meta) throw new Error('注册失败: ' + regState);
  check('身份已写入 female_M', meta.id, 'female_M');
  check('身份标签已写入', meta.label, '女M');
  check('元数据中已无取向字段', meta.hasOrientation, false);

  // ── 3. 资料页展示角色
  console.log('\n── 3. 资料页 ──');
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(3500);
  check('显示身份「女M」', await js(`document.getElementById('primaryIdentity').textContent.includes('女M')`), true);
  check('显示角色「奴」', await js(`document.getElementById('levelInfo').textContent.includes('奴')`), true);
  check('已无取向信息行', await js(`!document.getElementById('orientationInfo')`), true);
  check('已无取向修改行', await js(`!document.getElementById('orientationEditorRow')`), true);

  // ── 4. 档案列表页按身份分流
  console.log('\n── 4. 档案列表页 ──');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' });
  await sleep(6000);
  check('筛选条已渲染', await js(`!!document.querySelector('#filterBar .fb-row')`), true);
  check('身份维度 3 个按钮', await js(`document.querySelectorAll('#filterBar [data-dim="position"]').length`), 3);
  check('已无性别维度', await js(`document.querySelectorAll('#filterBar [data-dim="gender"]').length`), 0);
  check('按钮文案为 全部/S/M',
    await js(`[...document.querySelectorAll('#filterBar [data-dim="position"]')].map(b=>b.textContent.trim().split(' ')[0])`),
    ['全部', 'S', 'M']);
  check('女M 默认看 S 侧', await js(`document.querySelector('#filterBar [data-dim="position"].active')?.dataset.val`), 'top');
  console.log('     默认视图文案: ' + await js(`document.querySelector('#filterBar .fb-default')?.textContent.replace(/\\s+/g,' ').trim()`));
  check('表单入口指向新表单', await js(`(async()=>{
    const scripts=[...document.querySelectorAll('script[src]')].map(s=>s.src);
    for(const s of scripts){ try{ const t=await (await fetch(s)).text(); if(t.includes('tUpkJr8bb9us')) return 'NEW'; if(t.includes('sZm1g43KzHus')) return 'OLD'; }catch{} }
    return 'NOT_IN_MAIN';
  })()`, 20000), (v) => v === 'NEW' || v === 'NOT_IN_MAIN');

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'archive-identity-filter.png'), Buffer.from(shot.data, 'base64'));

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  const realErrors = pageErrors.filter((e) => !/favicon|ERR_/.test(e));
  if (realErrors.length) {
    console.log('  ── 页面异常 ──');
    for (const e of [...new Set(realErrors)]) console.log('   · ' + e);
  }
  if (fails.length) { console.log('  ── 失败明细 ──'); fails.forEach((f) => console.log('   · ' + f)); }
  console.log(`  测试账号: ${EMAIL}`);
  console.log('═══════════════════════════════');

  await send('Target.closeTarget', { targetId }, 10000, false);
  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
