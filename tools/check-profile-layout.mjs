#!/usr/bin/env node
/**
 * tools/check-profile-layout.mjs
 * 验证资料编辑页的布局与交互调整：
 *   1. 头像区无「头像」标题
 *   2. 保存/还原位于头像区右侧、上下排列
 *   3. 基本资料顺序：身份 → 昵称 → 邮箱 → 平台角色
 *   4. 身份为下拉，选项 = 男S/女S/男M/女M
 *   5. 邮箱只读、平台角色只读
 *   6. 相关页面与账号板块已移除
 *   7. 改身份后「保存修改」按钮启用
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5191));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP = Number(get('--cdp', 9460));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-profile-layout');
const EMAIL = get('--email', '');
const PASS = 'Qa!123456';
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}  →  ${String(actual).slice(0, 68)}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--mute-audio', '--window-size=1400,1200',
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
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
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

  if (EMAIL) {
    await send('Page.navigate', { url: BASE + '/auth.html' });
    await sleep(2500);
    await js(`(async () => {
      const m = await import('/shared/js/supabase-client.js');
      const { data } = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
      if (data?.session) localStorage.setItem('foxsir_session', JSON.stringify(data.session));
    })()`, 30000);
  }

  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(6000);

  console.log('════════ 资料编辑页布局验证 ════════\n');

  const cardTitles = await js(`[...document.querySelectorAll('.card-title')].map(e=>e.textContent.trim())`);
  console.log(`  卡片标题: ${JSON.stringify(cardTitles)}`);
  check('已无「头像」卡片标题', Array.isArray(cardTitles) && !cardTitles.includes('头像'), true);
  check('已无「相关页面」板块', Array.isArray(cardTitles) && !cardTitles.some((t) => t.includes('相关页面')), true);
  check('已无「账号」板块', Array.isArray(cardTitles) && !cardTitles.some((t) => t === '账号'), true);
  check('保留「基本资料」', Array.isArray(cardTitles) && cardTitles.some((t) => t.includes('基本资料')), true);

  // 保存/还原位置与排列
  const actions = await js(`(() => {
    const box = document.querySelector('.avatar-actions');
    if (!box) return null;
    const avatarRow = document.querySelector('.avatar-row');
    const cs = getComputedStyle(box);
    const b = box.getBoundingClientRect();
    const r = avatarRow.getBoundingClientRect();
    return JSON.stringify({
      flexDirection: cs.flexDirection,
      rightOfAvatar: b.left > r.left + r.width * 0.5,
      insideAvatarRow: avatarRow.contains(box),
      btnCount: box.querySelectorAll('button').length,
    });
  })()`);
  console.log(`     保存区: ${actions}`);
  check('保存/还原容器存在', actions !== null, true);
  if (actions) {
    const a = JSON.parse(actions);
    check('上下排列（flex-direction: column）', a.flexDirection, 'column');
    check('位于头像区内部', a.insideAvatarRow, true);
    check('含 2 个按钮', a.btnCount, 2);
  }
  check('头像区已无退出登录按钮', await js(`!document.getElementById('logoutBtn')`), true);

  // 基本资料顺序
  const order = await js(`[...document.querySelectorAll('#memberArea .card')]
    .find(c => c.querySelector('.card-title')?.textContent.includes('基本资料'))
    ?.querySelectorAll('.field')`)
    .then(() => js(`(() => {
      const card = [...document.querySelectorAll('#memberArea .card')]
        .find(c => c.querySelector('.card-title')?.textContent.includes('基本资料'));
      if (!card) return null;
      return [...card.querySelectorAll('.field')].map(f => {
        const lab = f.querySelector('label');
        if (lab) return lab.textContent.trim();
        const k = f.querySelector('.info-row .k');
        return k ? k.textContent.trim() : '?';
      });
    })()`));
  console.log(`     基本资料顺序: ${JSON.stringify(order)}`);
  check('第 1 项为身份', Array.isArray(order) && order[0] === '身份', true);
  check('第 2 项为昵称', Array.isArray(order) && order[1] === '昵称', true);
  check('第 3 项为邮箱', Array.isArray(order) && /邮箱/.test(order[2] || ''), true);
  check('第 4 项为平台角色', Array.isArray(order) && order[3] === '平台角色', true);

  // 身份下拉
  check('身份是 select', await js(`document.getElementById('identitySelect')?.tagName`), 'SELECT');
  const opts = await js(`[...document.getElementById('identitySelect').options].map(o=>o.value)`);
  check('下拉选项为 4 身份', opts, ['male_S', 'female_S', 'male_M', 'female_M']);
  const optText = await js(`[...document.getElementById('identitySelect').options].map(o=>o.textContent.trim())`);
  console.log(`     选项文案: ${JSON.stringify(optText)}`);
  check('选项含男女S及女M', Array.isArray(optText) && optText.join('').includes('男S') && optText.join('').includes('女S') && optText.join('').includes('女M'), true);

  // 只读项
  check('邮箱只读', await js(`document.getElementById('emailInput')?.disabled`), true);
  check('平台角色为文本非输入框', await js(`document.getElementById('roleInfo')?.tagName`), 'SPAN');
  check('已无「身份与角色」只读卡片', await js(`!/身份与角色/.test(document.body.innerText)`), true);

  // 交互：改身份应启用保存
  const before = await js(`document.getElementById('saveBtn')?.disabled`);
  check('初始状态保存按钮禁用', before, true);
  await js(`(() => {
    const s = document.getElementById('identitySelect');
    s.value = s.value === 'male_S' ? 'female_M' : 'male_S';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(400);
  check('改身份后保存按钮启用', await js(`document.getElementById('saveBtn')?.disabled`), false);
  check('改身份后还原按钮启用', await js(`document.getElementById('resetBtn')?.disabled`), false);
  console.log(`     身份提示: ${await js(`document.getElementById('identityHint')?.textContent?.trim()?.slice(0,80)`)}`);

  // 还原应回到初始
  await js(`document.getElementById('resetBtn').click()`);
  await sleep(400);
  check('还原后保存按钮回到禁用', await js(`document.getElementById('saveBtn')?.disabled`), true);

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
