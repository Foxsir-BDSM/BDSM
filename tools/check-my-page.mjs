#!/usr/bin/env node
/**
 * tools/check-my-page.mjs —— 「我的」页面验证（CDP 驱动）
 *
 * 覆盖：未登录态 / 登录态名片渲染 / 数据栏 / Tab 切换 /
 *       身份信息 / 档案状态查询 / 发布内容按昵称归集 / 顶栏菜单入口
 *
 *   node tools/check-my-page.mjs --port 5181
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
const PORT = Number(get('--port', 5181));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9888));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-my-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_my_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `留痕测试${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(`${label} 期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--window-size=1440,1200',
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
      send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
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

  console.log('══════ 「我的」页面验证 ══════\n');

  // ══════════ 1. 未登录态
  console.log('── 未登录态 ──');
  await send('Page.navigate', { url: BASE + '/my.html' });
  await sleep(2500);
  check('游客卡可见', await js(`getComputedStyle(document.getElementById('guestCard')).display`), 'block');
  check('会员区隐藏', await js(`getComputedStyle(document.getElementById('memberArea')).display`), 'none');
  check('提供注册入口', await js(`!!document.querySelector('#guestCard a[href="/auth.html"]')`), true);
  check('游客卡文案体现留痕定位', await js(`document.getElementById('guestCard').textContent.includes('留痕')`), true);

  // ══════════ 2. 注册并登录
  console.log('\n── 注册并登录 ──');
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2200);
  const reg = await js(`(async () => {
    const m = await import('/shared/js/supabase-client.js');
    const { error } = await m.supabase.auth.signUp({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)},
      options: { data: { role:'self', nickname:${JSON.stringify(NICK)}, points:37,
        primary_identity:'female_Sub', primary_label:'女Sub', gender:'female', role_type:'bottom',
        secondary_identities:['male_Dom','female_M'] } } });
    if (error) return 'ERR:' + error.message;
    const li = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
    if (li.error) return 'LOGIN_ERR:' + li.error.message;
    localStorage.setItem('foxsir_session', JSON.stringify(li.data.session));
    return 'OK';
  })()`, 40000);
  check('注册并登录', reg, 'OK');
  if (reg !== 'OK') throw new Error('注册失败: ' + reg);

  // ══════════ 3. 顶栏菜单入口
  console.log('\n── 顶栏菜单入口 ──');
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(3000);
  await js(`document.querySelector('#umTrigger').click()`);
  await sleep(500);
  check('菜单含「我的」项', await js(`!!document.querySelector('.um-item[href="/my.html"]')`), true);
  check('「我的」排在个人资料之前', await js(`
    (() => {
      const items = [...document.querySelectorAll('.um-item')];
      const my = items.findIndex(a => a.getAttribute('href') === '/my.html');
      const pf = items.findIndex(a => a.getAttribute('href') === '/profile.html');
      return my >= 0 && pf >= 0 && my < pf;
    })()
  `), true);

  // ══════════ 4. 登录态：名片与数据栏
  console.log('\n── 登录态 · 个人名片 ──');
  await send('Page.navigate', { url: BASE + '/my.html' });
  await sleep(3500);
  check('会员区可见', await js(`getComputedStyle(document.getElementById('memberArea')).display`), 'block');
  check('昵称正确', await js(`document.getElementById('heroName').textContent.trim()`), NICK);
  check('头像占位为字母/图标', await js(`!!document.querySelector('#heroAvatar .letter')`), true);
  check('主身份标签存在', await js(`document.getElementById('heroTags').textContent.includes('女Sub')`), true);
  check('等级标签存在', await js(`document.getElementById('heroTags').textContent.includes('Lv.')`), true);
  check('角色标签为普通用户', await js(`document.getElementById('heroTags').textContent.includes('普通用户')`), true);
  check('副身份标签存在', await js(`document.getElementById('heroTags').textContent.includes('男Dom')`), true);
  check('副文案含邮箱', await js(`document.getElementById('heroSub').textContent.includes('qa_my_')`), true);

  console.log('\n── 数据栏 ──');
  check('关注为占位', await js(`document.getElementById('statFollowing').textContent`), '—');
  check('粉丝为占位', await js(`document.getElementById('statFollowers').textContent`), '—');
  check('积分已显示', await js(`document.getElementById('statPoints').textContent`), '37');
  // 37 积分 → Lv.2（阈值 [0,1,11,51,101,501,1001,5001]），女Sub Lv.2 = 立约
  check('等级副文案', await js(`document.getElementById('statLevel').textContent`), '立约');

  // ══════════ 5. Tab 切换
  console.log('\n── Tab 切换 ──');
  check('默认激活「我的档案」', await js(`document.querySelector('.tab.active').dataset.tab`), 'archive');
  check('档案面板可见', await js(`document.getElementById('panel-archive').classList.contains('active')`), true);

  await js(`document.querySelector('.tab[data-tab="missions"]').click()`);
  await sleep(400);
  check('切到任务面板', await js(`document.getElementById('panel-missions').classList.contains('active')`), true);
  check('档案面板已隐藏', await js(`document.getElementById('panel-archive').classList.contains('active')`), false);
  check('任务空态存在', await js(`document.getElementById('panel-missions').textContent.includes('还没有接取记录')`), true);
  check('任务计数为 0', await js(`document.getElementById('cntMissions').textContent`), '0');

  await js(`document.querySelector('.tab[data-tab="posts"]').click()`);
  await sleep(2500);
  check('切到内容面板', await js(`document.getElementById('panel-posts').classList.contains('active')`), true);
  check('内容区已渲染（非骨架）', await js(`!document.querySelector('#postList .sk')`), true);

  await js(`document.querySelector('.tab[data-tab="relation"]').click()`);
  await sleep(400);
  check('切到关系面板', await js(`document.getElementById('panel-relation').classList.contains('active')`), true);
  check('关系面板标注待开放', await js(`document.getElementById('panel-relation').textContent.includes('待开放')`), true);
  check('粉丝/关注说明存在', await js(`document.getElementById('panel-relation').textContent.includes('关注列表')`), true);

  // ══════════ 6. 身份信息区
  console.log('\n── 身份信息区 ──');
  await js(`document.querySelector('.tab[data-tab="archive"]').click()`);
  await sleep(400);
  const identityText = await js(`document.getElementById('identityKv').textContent`);
  check('主身份已展示', identityText.includes('女Sub'), true);
  check('副身份已展示', identityText.includes('男Dom') && identityText.includes('女M'), true);
  check('等级已展示', identityText.includes('Lv.2'), true);
  check('积分含距下一级提示', identityText.includes('距下一级'), true);
  check('角色已展示', identityText.includes('普通用户'), true);

  // ══════════ 7. 档案状态（异步查询）
  console.log('\n── 档案状态查询 ──');
  let archiveText = '';
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    archiveText = await js(`document.getElementById('archiveKv').textContent`);
    if (!archiveText.includes('查询中')) break;
  }
  const archiveResolved = /已建档|未找到匹配档案|读取失败/.test(archiveText);
  check('档案状态已出结果（非一直查询中）', archiveResolved, true);
  console.log(`      · 档案区文案: ${archiveText.replace(/\s+/g, ' ').slice(0, 90)}`);

  // ══════════ 8. 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'my-archive-tab.png'), Buffer.from(shot.data, 'base64'));
  await js(`document.querySelector('.tab[data-tab="relation"]').click()`);
  await sleep(500);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'my-relation-tab.png'), Buffer.from(shot2.data, 'base64'));
  console.log('\n  · 截图: .shots/runtime/my-archive-tab.png / my-relation-tab.png');

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
