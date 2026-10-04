#!/usr/bin/env node
/**
 * tools/zite-probe.mjs —— 只读探测 Zite/Fillout 编辑器的 DOM 结构
 *
 * 目的：找出「添加字段 / 选择字段类型 / 设置标题 / 添加章节 / 条件逻辑」的定位器
 * 本脚本不点击、不输入、不修改任何内容。
 */
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9333);
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

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

// 在所有 frame 的 execution context 里求值
const { frameTree } = await send('Page.getFrameTree');
const ctxByFrame = new Map();
const collect = async (node) => {
  const ctx = await send('Page.createIsolatedWorld', { frameId: node.frame.id, worldName: 'probe' });
  ctxByFrame.set(node.frame.id, { ctx: ctx.executionContextId, url: node.frame.url });
  for (const c of node.childFrames || []) await collect(c);
};
await collect(frameTree);
// 取主 frame context
await send('Runtime.enable');

const evalIn = async (ctxId, expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, contextId: ctxId });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

console.log('════════ Zite 编辑器结构探测 ════════\n');
console.log('▌ frame/context 清单');
for (const [fid, v] of ctxByFrame) {
  console.log(`  · ${v.url.slice(0, 110)}`);
  console.log(`    ctxId=${v.ctx}`);
}
console.log('');

const PROBE = `(() => {
  const out = {};
  out.url = location.href;
  out.title = document.title;

  // 1. 正文文本（编辑器可见文案）
  out.bodyText = document.body ? document.body.innerText.slice(0, 2500) : '';

  // 2. 所有 button / [role=button] 的可见文本
  const btns = [...document.querySelectorAll('button,[role="button"],a[role="button"]')]
    .filter(el => el.offsetParent !== null)
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 40),
      aria: el.getAttribute('aria-label') || '',
      title: el.title || '',
      cls: (el.className || '').toString().slice(0, 80),
      testid: el.getAttribute('data-testid') || '',
    }))
    .filter(b => b.text || b.aria || b.title || b.testid);
  out.buttons = btns.slice(0, 120);

  // 3. 输入框 / 文本域
  out.inputs = [...document.querySelectorAll('input,textarea,[contenteditable="true"]')]
    .filter(el => el.offsetParent !== null)
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || '',
      ph: el.placeholder || '',
      aria: el.getAttribute('aria-label') || '',
      editable: el.getAttribute('contenteditable') || '',
      cls: (el.className || '').toString().slice(0, 70),
      testid: el.getAttribute('data-testid') || '',
    })).slice(0, 60);

  // 4. 带 data-testid / data-* 的元素（最常见的定位手段）
  const testids = [...document.querySelectorAll('[data-testid]')]
    .map(el => el.getAttribute('data-testid'));
  out.testids = [...new Set(testids)].slice(0, 150);

  // 5. 顶层结构性容器
  out.landmarks = [...document.querySelectorAll('main,aside,nav,header,[role="main"],[role="dialog"],[role="list"],[role="listitem"]')]
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      cls: (el.className || '').toString().slice(0, 90),
      testid: el.getAttribute('data-testid') || '',
      text: (el.innerText || '').trim().slice(0, 60),
    })).slice(0, 50);

  // 6. iframe
  out.iframes = [...document.querySelectorAll('iframe')].map(f => ({ src: f.src, id: f.id, cls: (f.className||'').toString().slice(0,60) }));

  // 7. 字段类元素猜测（表单字段在编辑器里的表现）
  out.fieldish = [...document.querySelectorAll('[class*="field"],[class*="Field"],[class*="question"],[class*="Question"]')]
    .slice(0, 60)
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 100),
      testid: el.getAttribute('data-testid') || '',
      text: (el.innerText || '').trim().slice(0, 50),
    }));

  return JSON.stringify(out, null, 1);
})()`;

// 尝试每个 context，找到能拿到编辑器 DOM 的那个
for (const [fid, v] of ctxByFrame) {
  const res = await evalIn(v.ctx, PROBE);
  if (res && !res.__error && typeof res === 'string') {
    let obj;
    try { obj = JSON.parse(res); } catch { continue; }
    if (obj.bodyText && obj.bodyText.length > 20) {
      console.log(`▌ 命中 context: ${v.url.slice(0, 90)}\n`);

      console.log('── 正文文本（前 1200 字）──');
      console.log(obj.bodyText.slice(0, 1200).split('\n').map((l) => '  ' + l).join('\n'));

      console.log('\n── 按钮（可见）──');
      obj.buttons.forEach((b) => {
        const label = b.text || b.aria || b.title || b.testid;
        if (!label) return;
        console.log(`  · 「${label}」 tag=${b.tag} testid=${b.testid || '-'} aria=${b.aria ? '有' : '-'}`);
      });

      console.log('\n── 输入控件 ──');
      obj.inputs.forEach((i) => {
        console.log(`  · <${i.tag}${i.type ? ' type=' + i.type : ''}> ph="${i.ph}" aria="${i.aria}" editable=${i.editable || '-'} testid=${i.testid || '-'}`);
      });

      console.log('\n── data-testid 清单 ──');
      console.log('  ' + (obj.testids.join('\n  ') || '(无)'));

      console.log('\n── 结构容器 ──');
      obj.landmarks.forEach((l) => {
        console.log(`  · <${l.tag}${l.role ? ' role=' + l.role : ''}> testid=${l.testid || '-'}  text="${l.text}"`);
      });

      console.log('\n── iframe ──');
      obj.iframes.forEach((f) => console.log(`  · ${f.src || '(no src)'}  id=${f.id || '-'}`));

      console.log('\n── 疑似字段元素（前 25）──');
      obj.fieldish.slice(0, 25).forEach((f) => {
        console.log(`  · <${f.tag}> cls="${f.cls}" testid=${f.testid || '-'}  text="${f.text}"`);
      });

      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const p = path.join(OUT, 'zite-editor-structure.png');
      fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
      console.log(`\n  截图: ${path.relative(process.cwd(), p)}`);

      break;
    }
  }
}

ws.close();
