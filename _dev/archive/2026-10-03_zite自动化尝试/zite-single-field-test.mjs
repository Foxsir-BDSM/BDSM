#!/usr/bin/env node
/**
 * tools/zite-single-field-test.mjs —— 单字段闭环验证
 *
 * 步骤：确认空 → 加 1 个 Short answer → 校验净增 1 → 精确定位删除按钮
 *       → 删除 → 校验归零
 *
 * 关键改进（对比上次失败）：
 *   1. 用「画布内 input 数量」+「空画布提示」判断，不用文本节点
 *   2. 每次操作前重新读取元素位置，不用固定坐标
 *   3. 用 el.click() 直接作用于元素，不靠合成鼠标事件
 *   4. 单步执行，每步校验，异常即停
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
const shoot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  const p = path.join(OUT, name);
  fs.writeFileSync(p, Buffer.from(s.data, 'base64'));
  return p;
};

// ══════ 状态读取：以「画布内真实控件」为准 ══════
const READ = `(() => {
  const containers = [...document.querySelectorAll('.fillout-field-container')];
  const canvas = containers.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || null;
  if (!canvas) return JSON.stringify({ error: 'no canvas' });
  const cr = canvas.getBoundingClientRect();

  // 画布内可见的输入控件 = 真实字段数
  const ctrls = [...canvas.querySelectorAll('input,textarea,select,[contenteditable="true"]')]
    .filter(el => el.offsetParent !== null);

  // 每个控件的题干：向上找最近的有文本的兄弟/父级
  const labels = ctrls.map(el => {
    let node = el, txt = '';
    for (let i = 0; i < 6 && node && !txt; i++) {
      node = node.parentElement;
      if (!node) break;
      const cand = [...node.querySelectorAll('*')]
        .filter(e => e.children.length === 0 && (e.textContent||'').trim())
        .map(e => e.textContent.trim())[0];
      if (cand && !/Type your question here/i.test(cand)) txt = cand;
    }
    return txt.slice(0, 40);
  });

  return JSON.stringify({
    hint: /Drag and drop questions/i.test(document.body.innerText),
    controlCount: ctrls.length,
    labels,
    canvas: { l: Math.round(cr.left), t: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
  });
})()`;

const read = async () => {
  const raw = await js(READ);
  try { return JSON.parse(raw); } catch { return { error: 'parse', raw }; }
};

const expect = async (label, want) => {
  const s = await read();
  const got = s.controlCount;
  const ok = got === want;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: 控件数=${got}（期望 ${want}） 空画布提示=${s.hint}`);
  return { ok, s };
};

console.log('════════ 单字段闭环验证 ════════\n');

// ── 0. 起点应为空
console.log('── 0. 起点确认 ──');
const s0 = await read();
console.log(`  控件数=${s0.controlCount}  空画布提示=${s0.hint}  画布=${JSON.stringify(s0.canvas)}`);
if (s0.controlCount !== 0) {
  console.log('  ✗ 画布非空，终止（不做任何操作）');
  ws.close(); process.exit(1);
}
console.log('  ✓ 画布为空，可以开始');

// ── 1. 用 el.click() 添加一个 Short answer
console.log('\n── 1. 添加 1 个 Short answer ──');
const clicked = await js(`(() => {
  const b = [...document.querySelectorAll('button')].find(
    x => (x.innerText || '').trim().replace(/\\s+/g, ' ') === 'Short answer');
  if (!b) return 'NOT_FOUND';
  b.click();
  return 'CLICKED';
})()`);
console.log(`  点击结果: ${clicked}`);
await sleep(1500);
const r1 = await expect('添加后', 1);
await shoot('sf-1-added.png');

if (!r1.ok) {
  console.log('\n  ✗ 添加未生效，终止');
  ws.close(); process.exit(1);
}

// ── 2. 定位删除按钮（此时字段应为选中态，右侧有操作按钮）
console.log('\n── 2. 定位删除按钮 ──');
const btns = await js(`(() => {
  const out = [];
  [...document.querySelectorAll('button,[role="button"]')].forEach((b, i) => {
    if (b.offsetParent === null) return;
    const r = b.getBoundingClientRect();
    if (r.width === 0 || r.width > 64 || r.height > 64) return;
    const svg = b.querySelector('svg');
    const p = svg ? svg.querySelector('path') : null;
    const d = p ? (p.getAttribute('d') || '') : '';
    out.push({
      i, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2),
      w: Math.round(r.width), h: Math.round(r.height),
      d0: d.slice(0, 34),
      txt: (b.innerText||'').trim().slice(0, 14),
      aria: b.getAttribute('aria-label') || '',
      title: b.title || '',
    });
  });
  return JSON.stringify(out, null, 1);
})()`);
console.log('  小按钮清单：');
console.log(btns);

let list = [];
try { list = JSON.parse(btns); } catch { /* ignore */ }
// 垃圾桶 path 以 "M7 9a2 2 0 012-2h6" 开头
const trash = list.filter((b) => b.d0.startsWith('M7 9a2 2 0 012-2h6') || /delete|remove|trash/i.test(b.aria + b.title));
console.log(`\n  垃圾桶候选: ${JSON.stringify(trash)}`);

// ── 3. 删除并校验
if (trash.length === 1) {
  console.log('\n── 3. 删除该字段 ──');
  const t = trash[0];
  // 同时尝试坐标点击与 el.click()
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: t.x, y: t.y });
  await sleep(150);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: t.x, y: t.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: t.x, y: t.y, button: 'left', clickCount: 1 });
  await sleep(1200);

  let r3 = await expect('坐标点击删除后', 0);

  if (!r3.ok) {
    console.log('  坐标点击无效，改用 el.click()');
    const n = await js(`(() => {
      const b = [...document.querySelectorAll('button,[role="button"]')].find(x => {
        const svg = x.querySelector('svg'); const p = svg ? svg.querySelector('path') : null;
        return p && (p.getAttribute('d')||'').startsWith('M7 9a2 2 0 012-2h6');
      });
      if (!b) return 'NOT_FOUND';
      b.click();
      return 'CLICKED';
    })()`);
    console.log(`  el.click(): ${n}`);
    await sleep(1200);
    r3 = await expect('el.click 删除后', 0);
  }

  await shoot('sf-2-deleted.png');
  console.log(`\n  ▶ 删除结果: ${r3.ok ? '✅ 成功恢复空表单' : '⚠️ 未恢复，请你手动删除'}`);
} else {
  console.log(`\n  ⚠️ 垃圾桶候选数量异常（${trash.length}），跳过自动删除 —— 请你手动删除这 1 个字段`);
  await shoot('sf-2-needs-manual.png');
}

console.log('\n════════ 结论 ════════');
console.log('  添加方式: el.click() 左侧「Short answer」按钮');
console.log('  校验方式: 画布内 input/textarea 计数 + 空画布提示');
ws.close();
