#!/usr/bin/env node
/**
 * tools/check-orientation-flow.mjs —— 取向维度端到端验证（CDP 驱动）
 *
 * 覆盖：注册页取向选择器 → 注册写入取向 → 资料页展示与自助修改 →
 *       档案馆筛选条与默认视图
 *
 *   node tools/check-orientation-flow.mjs --port 5183
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5183));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9933));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-orient-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_or_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `取向测试${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else {
    fails.push(label);
    console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`);
  }
};

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
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0; const pending = new Map(); const pageErrors = []; let sessionId = null;
  const send = (method, params = {}, timeout = 30000, useSession = true) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(`${method} 超时`)); } }, timeout);
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

  const js = async (expr, t) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t);
    return r.result?.value;
  };

  console.log('══════ 取向维度端到端验证 ══════\n');

  // ── 1. 注册页取向选择器
  console.log('── 1. 注册页取向选择器 ──');
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2500);
  await js(`document.querySelector('[data-tab="register"]')?.click()`);
  await sleep(700);
  check('取向容器存在', await js(`!!document.getElementById('orientation-selector-container')`), true);
  check('渲染出 4 个取向', await js(`document.querySelectorAll('.orientation-grid .orientation-card').length`), 4);
  const cards = await js(`[...document.querySelectorAll('.orientation-card .label')].map(e=>e.textContent)`);
  check('取向标签正确', cards, ['异性', '同性', '双性', '未定']);
  check('未选时提示「请选择取向」', await js(`document.getElementById('orientation-hint').textContent`), '请选择取向');

  await js(`document.querySelector('.orientation-card[data-id="hetero"]').click()`);
  await sleep(300);
  check('选中后高亮', await js(`document.querySelector('.orientation-card[data-id="hetero"]').classList.contains('selected-orientation')`), true);
  check('选中后提示已选', await js(`document.getElementById('orientation-hint').textContent.includes('异性')`), true);

  // 切走再切回应重置
  await js(`document.querySelector('[data-tab="login"]')?.click()`);
  await sleep(400);
  await js(`document.querySelector('[data-tab="register"]')?.click()`);
  await sleep(600);
  check('切回注册 Tab 后取向已重置', await js(`document.querySelectorAll('.orientation-card.selected-orientation').length`), 0);

  await js(`document.querySelector('.orientation-card[data-id="hetero"]').click()`);
  await sleep(300);

  // ── 2. 走真实注册表单（含取向）
  console.log('\n── 2. 真实注册流程 ──');
  // 选主身份：男S（第一个身份卡）
  await js(`document.querySelector('.identity-card[data-id="male_S"], .identity-card')?.click()`);
  await sleep(400);
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
    return JSON.stringify({ id: meta.primary_identity, or: meta.orientation, orLabel: meta.orientation_label });
  })()`, 30000);
  console.log('      · 注册结果: ' + regState);
  let meta = null;
  try { meta = JSON.parse(regState); } catch { /* 未注册成功 */ }
  check('注册成功并取得会话', regState !== 'NO_SESSION' && !!meta, true);
  if (!meta) throw new Error('注册失败，无法继续：' + regState);
  check('身份已写入', !!meta.id, true);
  check('取向已写入（hetero）', meta.or, 'hetero');
  check('取向标签已写入', meta.orLabel, '异性');

  // ── 3. 资料页展示与修改
  console.log('\n── 3. 资料页取向展示与自助修改 ──');
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(3500);
  check('显示取向行', await js(`document.getElementById('orientationInfo').textContent.includes('异性')`), true);
  check('提供 4 个可选取向', await js(`document.querySelectorAll('.orient-pick').length`), 4);
  check('当前取向高亮', await js(`document.querySelector('.orient-pick.on')?.dataset.oid`), 'hetero');

  await js(`document.querySelector('.orient-pick[data-oid="homo"]').click()`);
  await sleep(3500);
  check('修改后展示更新为同性', await js(`document.getElementById('orientationInfo').textContent.includes('同性')`), true);
  check('高亮切到同性', await js(`document.querySelector('.orient-pick.on')?.dataset.oid`), 'homo');
  const persisted = await js(`(async()=>{
    const m = await import('/shared/js/supabase-client.js');
    const { data:{ user } } = await m.supabase.auth.getUser();
    return user?.user_metadata?.orientation;
  })()`, 20000);
  check('取向已持久化到云端', persisted, 'homo');

  // ── 4. 档案馆筛选条
  console.log('\n── 4. 档案馆筛选条与默认视图 ──');
  await send('Page.navigate', { url: BASE + '/modules/sub-archive/' });
  await sleep(6000);
  check('筛选条已渲染', await js(`!!document.querySelector('#filterBar .fb-row')`), true);
  check('位置维度 3 个按钮', await js(`document.querySelectorAll('#filterBar [data-dim="position"]').length`), 3);
  check('性别维度 3 个按钮', await js(`document.querySelectorAll('#filterBar [data-dim="gender"]').length`), 3);
  check('馆别标签存在', await js(`document.querySelector('#filterBar .fb-tag')?.textContent.trim()`), '女馆');
  check('默认视图说明存在', await js(`!!document.querySelector('#filterBar .fb-default')`), true);
  console.log('      · 默认视图文案: ' + await js(`document.querySelector('#filterBar .fb-default')?.textContent.replace(/\\s+/g,' ').trim()`));
  check('提供「看全部」按钮', await js(`!!document.getElementById('fbReset')`), true);

  // 默认：男S + 同性 → 下位者 + 男
  check('默认位置为下位者（男S的互补位）', await js(`document.querySelector('#filterBar [data-dim="position"].active')?.dataset.val`), 'bottom');
  check('默认性别为男（同性取向）', await js(`document.querySelector('#filterBar [data-dim="gender"].active')?.dataset.val`), 'male');

  // 点「看全部」
  await js(`document.getElementById('fbReset').click()`);
  await sleep(800);
  check('点看全部后位置为全部', await js(`document.querySelector('#filterBar [data-dim="position"].active')?.dataset.val`), 'all');
  check('看全部后默认视图说明消失', await js(`!document.querySelector('#filterBar .fb-default')`), true);
  check('手动筛选后提示为手动', await js(`document.querySelector('#filterBar .fb-note')?.textContent.includes('手动')`), true);

  // 手动切到女
  await js(`document.querySelector('#filterBar [data-dim="gender"][data-val="female"]').click()`);
  await sleep(800);
  check('可手动切到「女」', await js(`document.querySelector('#filterBar [data-dim="gender"].active')?.dataset.val`), 'female');

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'archive-filter-bar.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n  · 截图: .shots/runtime/archive-filter-bar.png');

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  const realErrors = pageErrors.filter((e) => !/favicon|ERR_/.test(e));
  if (realErrors.length) {
    console.log('  ── 页面异常 ──');
    for (const e of [...new Set(realErrors)]) console.log('   · ' + e);
  }
  if (fails.length) {
    console.log('  ── 失败明细 ──');
    for (const f of fails) console.log('   · ' + f);
  }
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
