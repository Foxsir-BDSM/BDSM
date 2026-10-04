#!/usr/bin/env node
/**
 * tools/zite-del-test.mjs —— 验证删除逻辑（当前画布上恰有 1 个我的测试字段）
 *
 * 测量公式（已由上一轮实测确认）：
 *   空画布 = 0 个画布内控件；每 1 个字段 = 2 个控件（题干标签 + 作答框）
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
const read = async () => {
  const raw = await js(`(() => {
    const containers = [...document.querySelectorAll('.fillout-field-container')];
    const canvas = containers.sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
    if (!canvas) return JSON.stringify({ error:'no canvas' });
    const ctrls = [...canvas.querySelectorAll('input,textarea,select,[contenteditable="true"]')].filter(e=>e.offsetParent!==null);
    return JSON.stringify({
      hint: /Drag and drop questions/i.test(document.body.innerText),
      ctrl: ctrls.length,
      fields: Math.round(ctrls.length / 2),
    });
  })()`);
  try { return JSON.parse(raw); } catch { return { error:'parse', raw }; }
};
const shoot = async (n) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, n), Buffer.from(s.data, 'base64'));
};

console.log('════════ 删除逻辑验证 ════════\n');
const a = await read();
console.log(`▌ 当前: 控件=${a.ctrl}  折算字段=${a.fields}  空画布提示=${a.hint}`);

if (a.fields < 1) { console.log('  画布上没有字段，无需删除'); ws.close(); process.exit(0); }

// ── 列出当前所有小按钮，定位垃圾桶
const btnsRaw = await js(`(() => {
  const out = [];
  [...document.querySelectorAll('button,[role="button"]')].forEach((b, i) => {
    if (b.offsetParent === null) return;
    const r = b.getBoundingClientRect();
    if (r.width === 0 || r.width > 64 || r.height > 64) return;
    const p = b.querySelector('svg path');
    out.push({ i, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2),
               d0: (p ? (p.getAttribute('d')||'') : '').slice(0,34),
               txt: (b.innerText||'').trim().slice(0,12),
               aria: b.getAttribute('aria-label')||'', title: b.title||'' });
  });
  return JSON.stringify(out, null, 1);
})()`);
console.log('\n▌ 小按钮清单：');
console.log(btnsRaw);

let list = [];
try { list = JSON.parse(btnsRaw); } catch { /* ignore */ }
const trash = list.filter((b) => b.d0.startsWith('M7 9a2 2 0 012-2h6'));
console.log(`\n▌ 垃圾桶候选 ${trash.length} 个: ${JSON.stringify(trash)}`);

if (trash.length !== 1) {
  console.log('  ⚠️ 候选不唯一，不自动删除，避免再次误操作');
  await shoot('del-skip.png');
  ws.close(); process.exit(1);
}

// ── 方式 1：el.click()
console.log('\n▌ 方式 1：el.click()');
const r1 = await js(`(() => {
  const b = [...document.querySelectorAll('button,[role="button"]')].find(x => {
    const p = x.querySelector('svg path');
    return p && (p.getAttribute('d')||'').startsWith('M7 9a2 2 0 012-2h6');
  });
  if (!b) return 'NOT_FOUND';
  b.click();
  return 'CLICKED';
})()`);
console.log(`  结果: ${r1}`);
await sleep(1500);
let b1 = await read();
console.log(`  删除后: 控件=${b1.ctrl}  字段=${b1.fields}  空画布提示=${b1.hint}`);

// ── 方式 2：真实鼠标事件（若方式 1 无效）
if (b1.fields >= 1) {
  console.log('\n▌ 方式 2：真实鼠标事件（含 hover）');
  const t = trash[0];
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: t.x, y: t.y });
  await sleep(250);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: t.x, y: t.y });
  await sleep(250);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: t.x, y: t.y, button: 'left', clickCount: 1 });
    await sleep(120);
  }
  await sleep(1500);
  b1 = await read();
  console.log(`  删除后: 控件=${b1.ctrl}  字段=${b1.fields}  空画布提示=${b1.hint}`);
}

// ── 处理确认弹窗
const dlg = await js(`(() => {
  const d = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(x => x.offsetParent !== null);
  if (!d) return null;
  return JSON.stringify({ text: (d.innerText||'').slice(0,140),
    buttons: [...d.querySelectorAll('button')].map(b => (b.innerText||'').trim().slice(0,18)) });
})()`);
if (dlg && dlg.__error === undefined && dlg) {
  console.log(`\n▌ 弹窗: ${dlg}`);
  const ok = await js(`(() => {
    const d = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(x => x.offsetParent !== null);
    const b = d && [...d.querySelectorAll('button')].find(x => /delete|confirm|yes|删除|确定/i.test(x.innerText||''));
    if (!b) return 'NO_BTN';
    b.click();
    return 'CLICKED';
  })()`);
  console.log(`  确认: ${ok}`);
  await sleep(1500);
  b1 = await read();
  console.log(`  确认后: 控件=${b1.ctrl}  字段=${b1.fields}  空画布提示=${b1.hint}`);
}

await shoot('del-result.png');
console.log(`\n▌ 最终: 控件=${b1.ctrl}  字段=${b1.fields}  空画布提示=${b1.hint}`);
console.log(`   ${b1.fields === 0 && b1.hint ? '✅ 删除成功，已恢复空表单' : '⚠️ 仍未删除，请你手动处理'}`);
ws.close();
