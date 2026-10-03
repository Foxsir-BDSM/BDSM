#!/usr/bin/env node
/**
 * tools/check-content-editor.mjs —— 结构化编辑器验证（CDP 驱动）
 *
 * 覆盖：4 种类型切换 / 字段组动态生成 / 道具与步骤增删 /
 *       风险等级联动安全字段 / 极高风险知情确认 / 实时预览 / 草稿保存
 *
 *   node tools/check-content-editor.mjs --port 5182
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 5182));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9911));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-editor-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_ed_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';
const NICK = `编辑测试${TS.slice(-4)}`;

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(`${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--window-size=1600,1200',
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

  console.log('══════ 结构化编辑器验证 ══════\n');

  // ── 1. 未登录态
  console.log('── 未登录态 ──');
  await send('Page.navigate', { url: BASE + '/modules/content/post-editor.html' });
  await sleep(2500);
  check('游客卡可见', await js(`getComputedStyle(document.getElementById('guestCard')).display`), 'block');
  check('编辑器隐藏', await js(`getComputedStyle(document.getElementById('editorArea')).display`), 'none');

  // ── 2. 注册登录
  console.log('\n── 注册并登录 ──');
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2200);
  const reg = await js(`(async () => {
    const m = await import('/shared/js/supabase-client.js');
    const { error } = await m.supabase.auth.signUp({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)},
      options: { data: { role:'self', nickname:${JSON.stringify(NICK)}, points:0, primary_identity:'male_Dom', primary_label:'男Dom', gender:'male', role_type:'top', secondary_identities:[] } } });
    if (error) return 'ERR:' + error.message;
    const li = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
    if (li.error) return 'LOGIN_ERR:' + li.error.message;
    localStorage.setItem('foxsir_session', JSON.stringify(li.data.session));
    return 'OK';
  })()`, 40000);
  check('注册并登录', reg, 'OK');
  if (reg !== 'OK') throw new Error('注册失败: ' + reg);

  // ── 3. 打开编辑器
  console.log('\n── 编辑器加载 ──');
  await send('Page.navigate', { url: BASE + '/modules/content/post-editor.html' });
  await sleep(3500);
  check('编辑器可见', await js(`getComputedStyle(document.getElementById('editorArea')).display`), 'block');
  check('4 个类型页签', await js(`document.querySelectorAll('#typeTabs .type-tab').length`), 4);
  check('默认选中「玩法任务」', await js(`document.querySelector('.type-tab.on')?.dataset.type`), 'task');

  // ── 4. A 类：玩法任务字段组
  console.log('\n── A 类 · 玩法任务 ──');
  const secTitles = await js(`[...document.querySelectorAll('#sectionBox .sec-head h3')].map(h=>h.textContent.trim().replace(/\\s+/g,''))`);
  check('含「场景准备」', secTitles.some((t) => t.includes('场景准备')), true);
  check('含「道具清单」', secTitles.some((t) => t.includes('道具清单')), true);
  check('含「具体事项」', secTitles.some((t) => t.includes('具体事项')), true);
  check('含「检查点」', secTitles.some((t) => t.includes('检查点')), true);
  check('含「收尾与后护理」', secTitles.some((t) => t.includes('收尾与后护理')), true);
  check('适用场景选项 5 个', await js(`document.querySelectorAll('.fld input[data-key="scenes"]').length`), 5);
  check('建议时间选项 5 个', await js(`document.querySelectorAll('.fld input[data-key="times"]').length`), 5);

  // ── 5. 道具增删
  console.log('\n── 道具清单增删 ──');
  check('初始 0 个道具', await js(`document.querySelectorAll('[data-list-key="props"] > .list-rows > .list-item').length`), 0);
  await js(`document.querySelector('[data-add="props"]').click()`);
  await sleep(400);
  check('添加后 1 个道具', await js(`document.querySelectorAll('[data-list-key="props"] > .list-rows > .list-item').length`), 1);
  check('道具含「必要性」下拉', await js(`!!document.querySelector('[data-list-key="props"] select[data-key="required"]')`), true);
  check('道具含「安全提示」输入', await js(`!!document.querySelector('[data-list-key="props"] input[data-key="safety"]')`), true);
  await js(`document.querySelector('[data-add="props"]').click()`);
  await sleep(400);
  check('添加后 2 个道具', await js(`document.querySelectorAll('[data-list-key="props"] > .list-rows > .list-item').length`), 2);
  await js(`document.querySelectorAll('[data-remove="props"]')[0].click()`);
  await sleep(400);
  check('删除后剩 1 个道具', await js(`document.querySelectorAll('[data-list-key="props"] > .list-rows > .list-item').length`), 1);

  // ── 6. 步骤增删与排序
  console.log('\n── 具体事项增删与排序 ──');
  await js(`document.querySelector('[data-add="steps"]').click()`);
  await sleep(300);
  await js(`document.querySelector('[data-add="steps"]').click()`);
  await sleep(300);
  check('2 个步骤', await js(`document.querySelectorAll('[data-list-key="steps"] > .list-rows > .list-item').length`), 2);
  await js(`(()=>{const a=document.querySelectorAll('[data-list-key="steps"] textarea[data-key="text"]');a[0].value='第一步内容';a[0].dispatchEvent(new Event('input',{bubbles:true}));a[1].value='第二步内容';a[1].dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(300);
  check('步骤 1 文本已写入', await js(`document.querySelectorAll('[data-list-key="steps"] textarea[data-key="text"]')[0].value`), '第一步内容');
  // 下移第一步（选择器需限定 key=steps，页面上还有 props 的移动按钮）
  await js(`(()=>{const b=[...document.querySelectorAll('[data-move]')].find(x=>x.dataset.key==='steps'&&x.dataset.move==='down'&&x.dataset.index==='0');b.click();})()`);
  await sleep(400);
  check('下移后顺序颠倒', await js(`document.querySelectorAll('[data-list-key="steps"] textarea[data-key="text"]')[0].value`), '第二步内容');
  check('序号标签已重排', await js(`document.querySelector('[data-list-key="steps"] .li-idx')?.textContent.trim()`), '#1');

  // ── 7. 风险等级联动
  console.log('\n── 风险等级联动 ──');
  check('低风险时无安全字段', await js(`getComputedStyle(document.getElementById('safetyBox')).display`), 'none');
  await js(`document.querySelector('input[name="mRisk"][value="high"]').click()`);
  await sleep(500);
  check('高风险时出现安全字段', await js(`getComputedStyle(document.getElementById('safetyBox')).display`), 'block');
  check('含「中止条件」', await js(`!!document.getElementById('sAbort')`), true);
  check('含「紧急预案」', await js(`!!document.getElementById('sEmergency')`), true);
  check('高风险无需知情确认', await js(`!document.getElementById('sAck')`), true);

  await js(`document.querySelector('input[name="mRisk"][value="extreme"]').click()`);
  await sleep(500);
  check('极高风险出现知情确认', await js(`!!document.getElementById('sAck')`), true);

  // ── 8. 校验拦截
  console.log('\n── 发布校验 ──');
  await js(`document.getElementById('publishBtn').click()`);
  await sleep(800);
  const msg = await js(`document.getElementById('pubMsg').textContent`);
  check('未填标题时阻止发布', /标题/.test(msg), true);
  check('提示需要中止条件', /中止条件/.test(msg), true);
  check('提示需要知情确认', /知情|我已了解/.test(msg), true);

  // ── 9. 实时预览
  console.log('\n── 实时预览 ──');
  await js(`(()=>{const e=document.getElementById('mTitle');e.value='测试玩法标题';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(700);
  check('预览显示标题', await js(`document.querySelector('#previewBox .pv-title')?.textContent.trim()`), '测试玩法标题');
  check('预览含类型徽章', await js(`/玩法任务/.test(document.getElementById('previewBox').textContent)`), true);
  check('预览含风险徽章', await js(`/极高/.test(document.getElementById('previewBox').textContent)`), true);
  check('预览含道具', await js(`/道具/.test(document.getElementById('previewBox').textContent)`), true);
  check('预览含步骤内容', await js(`/第二步内容/.test(document.getElementById('previewBox').textContent)`), true);
  check('预览字数已统计', await js(`Number(document.getElementById('pvLen').textContent) > 0`), true);

  // ── 10. 类型切换
  console.log('\n── 类型切换 ──');
  await js(`document.querySelector('.type-tab[data-type="collection"]').click()`);
  await sleep(900);
  check('切到「主题合集」', await js(`document.querySelector('.type-tab.on')?.dataset.type`), 'collection');
  const cSecs = await js(`[...document.querySelectorAll('#sectionBox .sec-head h3')].map(h=>h.textContent.trim().replace(/\\s+/g,''))`);
  check('合集含「分组与条目」', cSecs.some((t) => t.includes('分组与条目')), true);
  check('合集含「安全总则」', cSecs.some((t) => t.includes('安全总则')), true);
  await js(`document.querySelector('[data-add="groups"]').click()`);
  await sleep(400);
  check('可添加分组', await js(`document.querySelectorAll('[data-list-key="groups"] > .list-rows > .list-item').length`), 1);
  await js(`document.querySelector('[data-add="items"]').click()`);
  await sleep(400);
  check('分组内可添加条目（嵌套列表）', await js(`document.querySelectorAll('[data-list-key="items"] textarea[data-key="text"]').length`), 1);

  await js(`document.querySelector('.type-tab[data-type="checklist"]').click()`);
  await sleep(900);
  check('切到「分级清单」', await js(`document.querySelector('.type-tab.on')?.dataset.type`), 'checklist');
  check('含量表/问答模式单选', await js(`document.querySelectorAll('input[data-key="mode"]').length`), 2);
  check('默认量表模式显示条目列表', await js(`!!document.querySelector('[data-add="items"]')`), true);
  check('默认隐藏问答题目', await js(`getComputedStyle(document.querySelector('[data-add="questions"]')?.closest('.fld')).display`), 'none');

  await js(`document.querySelector('.type-tab[data-type="note"]').click()`);
  await sleep(900);
  check('切到「见解随笔」', await js(`document.querySelector('.type-tab.on')?.dataset.type`), 'note');
  check('随笔只有正文一个字段组', await js(`document.querySelectorAll('#sectionBox .sec').length`), 1);
  check('正文为大文本框', await js(`!!document.querySelector('textarea[data-key="body"].big')`), true);

  // ── 11. 草稿
  console.log('\n── 草稿自动保存 ──');
  await js(`(()=>{const e=document.querySelector('textarea[data-key="body"]');e.value='这是一段草稿正文';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(1500);
  const draft = await js(`(()=>{try{const a=JSON.parse(localStorage.getItem('foxsir_post_drafts')||'{}');const d=a['__new__'];return d?{type:d.typeId,body:d.data.body}:null;}catch(e){return null;}})()`);
  check('草稿已写入 localStorage', draft?.type, 'note');
  check('草稿含正文内容', draft?.body, '这是一段草稿正文');

  // 刷新后草稿恢复
  await send('Page.navigate', { url: BASE + '/modules/content/post-editor.html' });
  await sleep(3500);
  check('刷新后恢复草稿类型', await js(`document.querySelector('.type-tab.on')?.dataset.type`), 'note');
  check('刷新后恢复正文', await js(`document.querySelector('textarea[data-key="body"]')?.value`), '这是一段草稿正文');

  // ── 12. 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'content-editor-note.png'), Buffer.from(shot.data, 'base64'));
  await js(`document.querySelector('.type-tab[data-type="task"]').click()`);
  await sleep(1200);
  const shot2 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, 'content-editor-task.png'), Buffer.from(shot2.data, 'base64'));
  console.log('\n  · 截图: .shots/runtime/content-editor-{note,task}.png');

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
