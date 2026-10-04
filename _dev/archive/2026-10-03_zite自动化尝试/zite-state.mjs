#!/usr/bin/env node
/**
 * tools/zite-state.mjs —— 只读：准确读取 Zite 编辑器当前状态
 *
 * 输出：画布字段数（限定在画布容器内，排除属性面板）、字段清单、画布提示、页面数
 * 本脚本不做任何点击或输入。
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
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

const STATE = `(() => {
  // 1) 找出「画布」容器：属性面板在右侧（x > 1200），左面板 x < 310
  //    用 .fillout-field-container 的父级作为画布候选
  const containers = [...document.querySelectorAll('.fillout-field-container')];
  const canvasCandidates = [...new Set(containers.map(c => c.parentElement).filter(Boolean))];
  const canvas = canvasCandidates.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || null;
  const cr = canvas ? canvas.getBoundingClientRect() : null;

  // 2) 画布内的字段：用 field container 且其 rect 落在画布范围内
  const inCanvas = containers.filter(c => {
    const r = c.getBoundingClientRect();
    return cr && r.left >= cr.left - 5 && r.right <= cr.right + 5 && r.width > 200;
  });

  // 3) 画布里的可输入控件（真实字段的特征）
  const inputs = canvas ? [...canvas.querySelectorAll('input,textarea,select')].filter(i => i.offsetParent !== null) : [];

  // 4) 每个字段的题干（画布内首个可编辑元素的前一个文本块）
  const fieldLabels = inCanvas.map(c => {
    const t = [...c.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent||'').trim().length > 0);
    return (t ? t.textContent : '').trim().slice(0, 50);
  }).filter(Boolean);

  return JSON.stringify({
    canvasFound: !!canvas,
    canvasRect: cr ? { l: Math.round(cr.left), t: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) } : null,
    hintVisible: /Drag and drop questions/i.test(document.body.innerText),
    fieldContainerTotal: containers.length,
    fieldInCanvas: inCanvas.length,
    canvasInputs: inputs.length,
    fieldLabels,
    // 页面/结尾
    pageTabs: [...document.querySelectorAll('[role="button"],button,div')]
      .filter(e => /^(Page|Ending|Page \\d+)$/.test((e.innerText||'').trim()) && e.offsetParent !== null)
      .map(e => (e.innerText||'').trim()).slice(0, 8),
    propPanelOpen: /Click text on page to modify/i.test(document.body.innerText),
  }, null, 1);
})()`;

const raw = await js(STATE);
console.log('════════ Zite 当前状态（只读）════════\n');
if (raw && raw.__error) { console.error('求值失败:', raw.__error); }
else {
  try {
    const s = JSON.parse(raw);
    console.log(`  画布已定位      : ${s.canvasFound}  ${JSON.stringify(s.canvasRect)}`);
    console.log(`  空画布提示可见  : ${s.hintVisible}`);
    console.log(`  字段容器总数    : ${s.fieldContainerTotal}`);
    console.log(`  画布内字段数    : ${s.fieldInCanvas}`);
    console.log(`  画布内输入控件  : ${s.canvasInputs}`);
    console.log(`  属性面板打开    : ${s.propPanelOpen}`);
    console.log(`  页面标签        : ${JSON.stringify(s.pageTabs)}`);
    console.log(`  字段题干        : ${s.fieldLabels.length ? JSON.stringify(s.fieldLabels, null, 1) : '(无)'}`);
    console.log('');
    console.log(`  ▶ 结论: ${s.fieldInCanvas === 0 && s.hintVisible ? '✅ 画布为空，起点干净' : '⚠️ 画布非空，请核对'}`);
  } catch (e) { console.log('  原始返回:\n' + raw); }
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
const sp = path.join(OUT, 'zite-state.png');
fs.writeFileSync(sp, Buffer.from(shot.data, 'base64'));
console.log(`  截图: ${path.relative(process.cwd(), sp)}`);
ws.close();
