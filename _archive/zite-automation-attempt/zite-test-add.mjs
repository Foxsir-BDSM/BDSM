#!/usr/bin/env node
/**
 * tools/zite-test-add.mjs —— 测定「添加字段」的交互方式（点击 vs 拖拽）
 *
 * 流程：记录初始字段数 → 点击左侧「Short answer」→ 观察画布 →
 *       若添加成功则删除该字段，恢复原状 → 输出结论
 */
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9333);
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tabs = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page');
const tab = tabs.find((t) => t.url.includes('app.zite.com'));
if (!tab) { console.error('未找到 Zite 标签页'); process.exit(1); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let id = 0; const pending = new Map(); const consoleMsgs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method === 'Runtime.consoleAPICalled') {
    consoleMsgs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (m.method === 'Page.javascriptDialogOpening') {
    send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  }
});
const send = (method, params = {}, timeout = 25000) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, timeout);
    pending.set(mid, { resolve, reject, timer });
  });
};

await send('Runtime.enable'); await send('Page.enable');

const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

// ── 画布状态读取器
const CANVAS_STATE = `(() => {
  const containers = [...document.querySelectorAll('.fillout-field-container')];
  return JSON.stringify({
    count: containers.length,
    hint: /Drag and drop questions/i.test(document.body.innerText),
    fields: containers.map(c => {
      const t = c.querySelector('input,textarea,select,[contenteditable]');
      return {
        text: (c.innerText || '').trim().slice(0, 70),
        inputTag: t ? t.tagName.toLowerCase() : null,
      };
    }),
  });
})()`;

const stateOf = async () => {
  const raw = await js(CANVAS_STATE);
  try { return JSON.parse(raw); } catch { return { count: -1, raw }; }
};

console.log('════════ 添加字段交互方式测定 ════════\n');

const before = await stateOf();
console.log(`▌ 初始状态: 字段数=${before.count}  空画布提示=${before.hint}`);

// ── 找到左侧「Short answer」按钮并取其坐标
const btnBox = await js(`(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => (x.innerText || '').trim().replace(/\\s+/g,' ') === 'Short answer');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height });
})()`);
console.log(`▌ 左侧「Short answer」按钮: ${btnBox}`);

if (!btnBox || btnBox.__error) { console.error('✗ 未找到按钮'); ws.close(); process.exit(1); }
const box = JSON.parse(btnBox);

// ── 实验 A：单击
console.log('\n── 实验 A：单击「Short answer」──');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
await sleep(1800);
const afterClick = await stateOf();
console.log(`  字段数: ${before.count} → ${afterClick.count}   空画布提示=${afterClick.hint}`);
const clickWorked = afterClick.count > before.count;
console.log(`  结论: ${clickWorked ? '✅ 单击即可添加' : '✗ 单击不添加'}`);

// ── 实验 B：若单击无效，尝试拖拽
let dragWorked = false;
if (!clickWorked) {
  console.log('\n── 实验 B：拖拽「Short answer」到画布──');
  // 找画布投放点：空画布提示附近的容器
  const dropTarget = await js(`(() => {
    const hint = [...document.querySelectorAll('*')].find(el =>
      el.children.length === 0 && /Drag and drop questions/i.test(el.textContent || ''));
    let el = hint;
    for (let i = 0; i < 6 && el; i++) el = el.parentElement;
    const node = hint ? hint.closest('.fillout-field-container') || hint.parentElement : null;
    const r = (node || document.body).getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2, tag: node ? node.tagName : 'body' });
  })()`);
  const drop = JSON.parse(dropTarget);
  console.log(`  投放点: <${drop.tag}> (${Math.round(drop.x)}, ${Math.round(drop.y)})`);

  // 真实拖拽序列：move → down → 多次 move(带 buttons) → up
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    const x = box.x + (drop.x - box.x) * (i / steps);
    const y = box.y + (drop.y - box.y) * (i / steps);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await sleep(35);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: drop.x, y: drop.y, button: 'left', clickCount: 1 });
  await sleep(2000);

  const afterDrag = await stateOf();
  console.log(`  字段数: ${afterClick.count} → ${afterDrag.count}   空画布提示=${afterDrag.hint}`);
  dragWorked = afterDrag.count > afterClick.count;
  console.log(`  结论: ${dragWorked ? '✅ 拖拽可添加' : '✗ 拖拽也不添加'}`);
}

// ── 截图记录当前状态
const shot = await send('Page.captureScreenshot', { format: 'png' });
const sp = path.join(OUT, 'zite-add-test.png');
fs.writeFileSync(sp, Buffer.from(shot.data, 'base64'));
console.log(`\n  截图: ${path.relative(process.cwd(), sp)}`);

// ── 清理：若添加成功，尝试删除
const finalState = await stateOf();
if (finalState.count > before.count) {
  console.log('\n── 清理：尝试删除测试字段 ──');
  const delInfo = await js(`(() => {
    const c = document.querySelector('.fillout-field-container');
    if (!c) return 'NO_CONTAINER';
    // 悬停后才出现的操作按钮：先找所有可能的删除入口
    const cands = [...document.querySelectorAll('button,[role="button"],[aria-label]')]
      .filter(el => /delete|remove|trash|删除/i.test((el.getAttribute('aria-label')||'') + ' ' + (el.title||'') + ' ' + (el.innerText||'')))
      .map(el => ({ label: (el.getAttribute('aria-label')||el.title||el.innerText||'').trim().slice(0,30), cls: (el.className||'').toString().slice(0,60) }));
    return JSON.stringify({ containerFound: true, deleteCandidates: cands.slice(0,10) }, null, 1);
  })()`);
  console.log('  删除入口探测: ' + delInfo);
  console.log('  ⚠️ 未自动删除（避免误操作）。请你在窗口中手动删除这个测试字段。');
}

console.log('\n════════ 结论 ════════');
console.log(`  单击添加: ${clickWorked ? '可行' : '不可行'}`);
if (!clickWorked) console.log(`  拖拽添加: ${dragWorked ? '可行' : '不可行'}`);

ws.close();
