#!/usr/bin/env node
/**
 * tools/diag-move.mjs —— 定位「步骤下移」为何未生效
 * 打印所有 data-move 按钮的归属与索引，再模拟点击并观察状态变化。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5182;
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = 9922;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-move-diag');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1600,1200',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function waitCDP(p, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${p}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  const wsUrl = await waitCDP(CDP_PORT);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const pending = new Map(); let sessionId = null;
  const send = (m, p = {}, t = 30000, us = true) => {
    const mid = ++id; const pl = { id: mid, method: m, params: p };
    if (us && sessionId) pl.sessionId = sessionId;
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
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  const js = async (e, t) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, t)).result?.value;

  // 登录
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2200);
  const TS = Date.now().toString().slice(-8);
  await js(`(async()=>{const m=await import('/shared/js/supabase-client.js');
    const {error}=await m.supabase.auth.signUp({email:'qa_mv_${TS}@foxsir-test.local',password:'Qa!123456',options:{data:{role:'self',nickname:'移动测试',points:0,primary_identity:'male_S',primary_label:'男S',gender:'male',role_type:'top',secondary_identities:[]}}});
    if(error) return 'ERR';
    const li=await m.supabase.auth.signInWithPassword({email:'qa_mv_${TS}@foxsir-test.local',password:'Qa!123456'});
    localStorage.setItem('foxsir_session', JSON.stringify(li.data.session)); return 'OK';})()`, 40000);

  // 打开编辑器，建 2 个步骤
  await send('Page.navigate', { url: BASE + '/modules/content/post-editor.html' });
  await sleep(3500);
  await js(`localStorage.removeItem('foxsir_post_drafts')`);
  await send('Page.navigate', { url: BASE + '/modules/content/post-editor.html' });
  await sleep(3000);

  await js(`document.querySelector('[data-add="steps"]').click()`); await sleep(300);
  await js(`document.querySelector('[data-add="steps"]').click()`); await sleep(300);
  await js(`(()=>{const a=document.querySelectorAll('[data-list-key="steps"] textarea[data-key="text"]');a[0].value='AAA';a[0].dispatchEvent(new Event('input',{bubbles:true}));a[1].value='BBB';a[1].dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(400);

  console.log('── 步骤列表当前顺序 ──');
  console.log('  ' + JSON.stringify(await js(`[...document.querySelectorAll('[data-list-key="steps"] textarea[data-key="text"]')].map(x=>x.value)`)));

  console.log('\n── 页面上所有 data-move 按钮 ──');
  const btns = await js(`[...document.querySelectorAll('[data-move]')].map((b,i)=>({i, dir:b.dataset.move, key:b.dataset.key, path:b.dataset.path, idx:b.dataset.index}))`);
  console.log('  ' + JSON.stringify(btns, null, 1));

  console.log('\n── 直接按 key=steps 找到第一个 down 并点击 ──');
  const clicked = await js(`(()=>{
    const b = [...document.querySelectorAll('[data-move]')].find(x=>x.dataset.key==='steps' && x.dataset.move==='down' && x.dataset.index==='0');
    if(!b) return 'NOT_FOUND';
    b.click();
    return 'CLICKED';
  })()`);
  console.log('  点击结果: ' + clicked);
  await sleep(600);
  console.log('  点击后顺序: ' + JSON.stringify(await js(`[...document.querySelectorAll('[data-list-key="steps"] textarea[data-key="text"]')].map(x=>x.value)`)));

  console.log('\n── 直接调内部数据看状态 ──');
  console.log('  ' + JSON.stringify(await js(`(()=>{
    const items=[...document.querySelectorAll('[data-list-key="steps"] > .list-rows > .list-item')];
    return items.map(it=>({idx:it.dataset.index, val:it.querySelector('textarea')?.value}));
  })()`), null, 1));

  await send('Target.closeTarget', { targetId }, 10000, false);
  chrome.kill('SIGKILL');
} catch (e) {
  console.error('诊断失败:', e.message);
  chrome.kill('SIGKILL');
}
