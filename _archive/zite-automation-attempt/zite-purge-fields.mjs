#!/usr/bin/env node
/**
 * tools/zite-purge-fields.mjs —— 清空画布上的所有字段（恢复空表单）
 *
 * 策略：逐个字段 —— 先点选，再从属性面板头部或字段右侧找到垃圾桶按钮删除，
 *       循环直到画布为空。每步截图与状态输出，便于核对。
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
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(700);
};

// 画布上可见字段的准确计数：用「Type your question here」占位标签的出现次数
const countFields = async () => {
  const n = await js(`(() => {
    const labels = [...document.querySelectorAll('*')].filter(
      e => e.children.length === 0 && /Type your question here/i.test(e.textContent || ''));
    return labels.length;
  })()`);
  return typeof n === 'number' ? n : -1;
};

console.log('════════ 清空画布字段 ════════\n');
let n0 = await countFields();
console.log(`▌ 初始可见字段数: ${n0}`);

for (let round = 1; round <= 12; round++) {
  const n = await countFields();
  if (n <= 0) { console.log(`\n▌ 第 ${round} 轮：画布已空，结束`); break; }
  console.log(`\n── 第 ${round} 轮（剩余 ${n} 个字段）──`);

  // 点选第一个字段的标签
  const sel = await js(`(() => {
    const el = [...document.querySelectorAll('*')].find(
      e => e.children.length === 0 && /Type your question here/i.test(e.textContent || ''));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  })()`);
  if (!sel || sel.__error) { console.log('  ✗ 未定位到字段标签'); break; }
  const s = JSON.parse(sel);
  await click(s.x, s.y);

  // 收集所有候选删除按钮（垃圾桶 path 开头 M7 9a2 2 0 012-2h6）
  const cands = await js(`(() => {
    const out = [];
    [...document.querySelectorAll('button,[role="button"]')].forEach(b => {
      if (b.offsetParent === null) return;
      const svg = b.querySelector('svg');
      const p = svg ? svg.querySelector('path') : null;
      const d = p ? (p.getAttribute('d') || '') : '';
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.width < 60 && r.height > 0 && r.height < 60) {
        out.push({ d: d.slice(0, 30), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2),
                   w: Math.round(r.width), aria: b.getAttribute('aria-label') || '' });
      }
    });
    return JSON.stringify(out);
  })()`);
  let list = [];
  try { list = JSON.parse(cands); } catch { /* ignore */ }

  // 垃圾桶图标 path 以 "M7 9a2 2 0 012-2h6" 开头
  const trash = list.filter((b) => b.d.startsWith('M7 9a2 2 0 012-2h6'));
  console.log(`  小按钮 ${list.length} 个，其中垃圾桶形 ${trash.length} 个: ${trash.map(t=>`(${t.x},${t.y})`).join(' ')}`);

  // 优先取位于画布列（x 在 1000–1200）且最靠上的那个
  const target = trash.filter((t) => t.x > 900).sort((a, b) => a.y - b.y)[0] || trash[0];
  if (!target) { console.log('  ✗ 未找到垃圾桶按钮'); break; }

  console.log(`  点击垃圾桶 (${target.x}, ${target.y})`);
  await click(target.x, target.y);
  await sleep(900);

  // 处理可能的确认弹窗
  const dlg = await js(`(() => {
    const d = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(x => x.offsetParent !== null);
    if (!d) return null;
    const b = [...d.querySelectorAll('button')].find(x => /delete|confirm|yes|删除|确定/i.test(x.innerText||''));
    if (!b) return JSON.stringify({ text: (d.innerText||'').slice(0,120), btn: null });
    const r = b.getBoundingClientRect();
    return JSON.stringify({ text: (d.innerText||'').slice(0,120),
      btn: { x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), t: (b.innerText||'').trim() } });
  })()`);
  if (dlg && !dlg.__error && dlg) {
    const D = JSON.parse(dlg);
    console.log(`  弹窗: ${D.text.replace(/\n/g,' | ').slice(0,90)}`);
    if (D.btn) { console.log(`  确认「${D.btn.t}」`); await click(D.btn.x, D.btn.y); await sleep(900); }
  }

  const after = await countFields();
  console.log(`  删除后字段数: ${after}`);
  if (after >= n) { console.log('  ⚠ 数量未减少，可能点错了按钮'); }
}

const nEnd = await countFields();
const hint = await js(`/Drag and drop questions/i.test(document.body.innerText)`);
console.log(`\n▌ 最终：可见字段数=${nEnd}   空画布提示=${hint}`);
console.log(`   ${nEnd <= 0 && hint ? '✅ 已恢复空表单' : '⚠️ 请你在窗口中核对'}`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
const sp = path.join(OUT, 'zite-purged.png');
fs.writeFileSync(sp, Buffer.from(shot.data, 'base64'));
console.log(`   截图: ${path.relative(process.cwd(), sp)}`);

ws.close();
