#!/usr/bin/env node
/**
 * tools/check-archive-form-link2.mjs
 * 用真实鼠标事件点击「去填写」，验证是否打开带参数的标签页
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP_PORT = 5185;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const CDP_PORT = 9367;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-formlink-check2');
const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_fl2_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `跳转2-${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1500,1000',
  // 不拦截弹窗
  '--disable-popup-blocking',
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

  let id = 0; const pending = new Map(); const logs = []; const newTargets = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (m.method === 'Target.targetCreated') {
      const ti = m.params.targetInfo;
      if (ti.type === 'page') newTargets.push(ti.url || '(blank)');
    }
  });
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

  await send('Target.setDiscoverTargets', { discover: true });
  // 浏览器级会话需要显式启用 Input 域
  try { await send('Input.enable', {}); } catch { /* 某些版本无需启用 */ }
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

  console.log('════════ 真实点击跳转验证 ════════\n');

  // 登录
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
  console.log('── 账号: ' + reg);

  // 打开档案页
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' }, 40000, SID);
  await sleep(7000);

  // 取按钮坐标
  const box = await js(`(() => {
    const b = document.getElementById('btnFillForm');
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2),
      text: (b.innerText || '').trim(),
      tag: b.tagName.toLowerCase(),
      cls: (b.className || '').toString().slice(0, 60),
      visible: b.offsetParent !== null,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      sameIdCount: document.querySelectorAll('#btnFillForm').length,
    });
  })()`);
  console.log('── 按钮: ' + box);
  if (!box) { console.error('按钮不存在'); chrome.kill('SIGKILL'); process.exit(1); }
  const b = JSON.parse(box);
  console.log(`   文案:「${b.text}」 tag=${b.tag} 可见=${b.visible} 同ID元素数=${b.sameIdCount}`);
  console.log(`   位置: ${JSON.stringify(b.rect)}`);

  // 核实该坐标上到底是什么元素（防止点到别处）
  const hitTest = await js(`(() => {
    const el = document.elementFromPoint(${b.x}, ${b.y});
    if (!el) return 'NONE';
    return JSON.stringify({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (el.className||'').toString().slice(0,50), text: (el.innerText||'').trim().slice(0, 30) });
  })()`);
  console.log('   该坐标命中元素: ' + hitTest);

  newTargets.length = 0;
  const before = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).filter((t) => t.type === 'page').length;
  console.log(`── 点击前标签页: ${before}`);

  // ★ 真实鼠标事件
  console.log('\n── 真实鼠标点击 ──');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await sleep(200);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await sleep(7000);

  const after = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).filter((t) => t.type === 'page');
  console.log(`── 点击后标签页: ${after.length}`);
  after.forEach((t) => console.log('   · ' + t.url.slice(0, 140)));

  const targets = after.filter((t) => t.url.includes('fillout.com'));
  console.log('\n── 结果 ──');
  if (targets.length) {
    const u = targets[0].url;
    let p = null; try { p = new URL(u).searchParams; } catch {}
    console.log('  ✅ 已打开表单页');
    console.log('     email = ' + p?.get('email'));
    console.log('     name  = ' + p?.get('name'));
    console.log('     uid   = ' + p?.get('uid'));
    console.log('  账号比对: ' + (p?.get('email') === EMAIL ? '✅ 一致' : '✗ 不一致（期望 ' + EMAIL + '）'));
    console.log('  昵称比对: ' + (p?.get('name') === NICK ? '✅ 一致' : '✗ 不一致（期望 ' + NICK + '）'));
  } else {
    console.log('  ✗ 未打开表单页');
    console.log('     Target.targetCreated 记录: ' + JSON.stringify(newTargets.slice(0, 5)));
  }

  if (logs.length) {
    console.log('\n── 页面控制台 ──');
    [...new Set(logs)].slice(0, 15).forEach((l) => console.log('   ' + l.slice(0, 160)));
  }

  chrome.kill('SIGKILL');
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
