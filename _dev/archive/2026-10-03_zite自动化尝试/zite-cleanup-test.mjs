#!/usr/bin/env node
/**
 * tools/zite-cleanup-test.mjs —— 删除测定阶段加入的测试字段
 *
 * 前置：字段正处于选中态，右侧属性面板打开，画布上字段右侧有 4 个圆形按钮
 *      （设置 / 移动 / 复制 / 垃圾桶）
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

let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
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

const state = async () => {
  const raw = await js(`JSON.stringify({
    containers: document.querySelectorAll('.fillout-field-container').length,
    hint: /Drag and drop questions/i.test(document.body.innerText),
    panelOpen: /Type your question here/i.test(document.body.innerText),
  })`);
  try { return JSON.parse(raw); } catch { return { raw }; }
};

console.log('════════ 清理测试字段 ════════\n');
const s0 = await state();
console.log(`▌ 当前: 字段容器=${s0.containers}  空画布提示=${s0.hint}  属性面板=${s0.panelOpen}`);

// ── 1. 确保字段处于选中态（点一下画布上的字段标签区域）
const labelBox = await js(`(() => {
  const el = [...document.querySelectorAll('*')].find(
    e => e.children.length === 0 && /Type your question here/i.test(e.textContent || '') &&
         e.closest('[class*="fillout-field-container"]'));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2, text: el.textContent.trim().slice(0,40) });
})()`);
console.log(`▌ 字段标签元素: ${labelBox}`);
if (labelBox && !labelBox.__error) {
  const b = JSON.parse(labelBox);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await sleep(900);
}

// ── 2. 列出字段右侧的圆形操作按钮
const dock = await js(`(() => {
  const c = document.querySelector('.fillout-field-container');
  if (!c) return JSON.stringify({ error: 'no container' });
  // 字段的悬浮操作条：通常紧邻容器，含 3–5 个 svg 图标按钮
  const scope = c.parentElement || c;
  const btns = [...scope.querySelectorAll('button,[role="button"]')]
    .filter(b => b.offsetParent !== null)
    .map((b, i) => {
      const r = b.getBoundingClientRect();
      const svg = b.querySelector('svg');
      let pathD = '';
      if (svg) { const p = svg.querySelector('path'); pathD = p ? (p.getAttribute('d') || '').slice(0, 40) : ''; }
      return {
        i,
        x: Math.round(r.x + r.width / 2),
        y: Math.round(r.y + r.height / 2),
        w: Math.round(r.width), h: Math.round(r.height),
        aria: b.getAttribute('aria-label') || '',
        title: b.title || '',
        text: (b.innerText || '').trim().slice(0, 20),
        pathD,
      };
    });
  return JSON.stringify({ count: btns.length, btns }, null, 1);
})()`);
console.log('\n▌ 字段周边按钮：');
console.log(dock);

// ── 3. 优先找 aria-label 含 delete/remove 的；否则用最右下那个（垃圾桶通常在最后）
let delBtn = null;
try {
  const d = JSON.parse(dock);
  delBtn = (d.btns || []).find((b) => /delete|remove|trash/i.test(b.aria + ' ' + b.title)) || null;
  if (!delBtn && d.btns && d.btns.length) {
    // 取最靠右下的
    delBtn = d.btns.slice().sort((a, b) => (b.x - a.x) || (b.y - a.y))[0];
  }
} catch { /* ignore */ }

// 若周边没有，尝试全局按 aria 找
if (!delBtn) {
  const g = await js(`(() => {
    const b = [...document.querySelectorAll('button,[role="button"]')]
      .find(el => /delete|remove|trash/i.test((el.getAttribute('aria-label')||'') + ' ' + (el.title||'')));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), aria: b.getAttribute('aria-label')||b.title });
  })()`);
  if (g && !g.__error) delBtn = JSON.parse(g);
}

console.log('\n▌ 拟点击的删除按钮: ' + JSON.stringify(delBtn));
if (!delBtn) {
  console.log('  ✗ 未定位到删除按钮 —— 请你手动删除画布上的测试字段');
  ws.close(); process.exit(1);
}

await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: delBtn.x, y: delBtn.y });
await sleep(200);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: delBtn.x, y: delBtn.y, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: delBtn.x, y: delBtn.y, button: 'left', clickCount: 1 });
await sleep(1500);

const s1 = await state();
console.log(`\n▌ 删除后: 字段容器=${s1.containers}  空画布提示=${s1.hint}  属性面板=${s1.panelOpen}`);

// 若出现确认弹窗，处理
const dialog = await js(`(() => {
  const d = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(x => x.offsetParent !== null);
  if (!d) return null;
  return JSON.stringify({ text: (d.innerText||'').slice(0,200),
    buttons: [...d.querySelectorAll('button')].map(b => (b.innerText||'').trim().slice(0,20)) });
})()`);
if (dialog && !dialog.__error && dialog) {
  console.log('\n▌ 检测到确认弹窗: ' + dialog);
  const ok = await js(`(() => {
    const d = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(x => x.offsetParent !== null);
    if (!d) return null;
    const b = [...d.querySelectorAll('button')].find(x => /delete|confirm|yes|确定|删除|ok/i.test((x.innerText||'')));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), text: (b.innerText||'').trim() });
  })()`);
  if (ok && !ok.__error && ok) {
    const o = JSON.parse(ok);
    console.log('  点击确认: ' + o.text);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: o.x, y: o.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: o.x, y: o.y, button: 'left', clickCount: 1 });
    await sleep(1500);
  }
}

const s2 = await state();
console.log(`\n▌ 最终: 字段容器=${s2.containers}  空画布提示=${s2.hint}  属性面板=${s2.panelOpen}`);
console.log(`   ${s2.hint && s2.containers <= 1 ? '✅ 已恢复空表单' : '⚠️ 仍未完全恢复，请你确认'}`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
const sp = path.join(OUT, 'zite-after-cleanup.png');
fs.writeFileSync(sp, Buffer.from(shot.data, 'base64'));
console.log(`   截图: ${path.relative(process.cwd(), sp)}`);

ws.close();
