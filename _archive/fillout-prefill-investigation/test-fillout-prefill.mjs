#!/usr/bin/env node
/**
 * tools/test-fillout-prefill.mjs
 * 验证 Fillout 表单的 URL 参数预填是否可用（只读，不提交任何数据）
 *
 * 步骤：
 *   1. 裸开表单，抓取字段清单与内部字段 ID
 *   2. 带 URL 参数再开，比对是否有值被预填
 *   3. 若参数名不对，候选取值域再试
 *
 * 不发提交请求，不改动任何远端数据。
 */
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9333);
const FORM = 'https://forms.fillout.com/t/w5fVHTNECtus';
const TEST_EMAIL = 'qa-prefill-test@foxsir-test.local';
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CDP 连接（复用已开的调试窗口）
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
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
const send = (method, params = {}, timeout = 40000, sessionId) => {
  const mid = ++id;
  const payload = { id: mid, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, timeout);
    pending.set(mid, { resolve, reject, timer });
  });
};

console.log('════════ Fillout 预填连通性验证 ════════\n');

// ── 打开一个独立标签页做测试（不动你正在编辑的编辑器标签）
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const att = await send('Target.attachToTarget', { targetId, flatten: true });
const SID = att.sessionId;
await send('Runtime.enable', {}, 20000, SID);
await send('Page.enable', {}, 20000, SID);

const js = async (expr, t = 30000) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t, SID);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

const FIELDS_PROBE = `(() => {
  const inputs = [...document.querySelectorAll('input,textarea,select,[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null);
  const labels = [...document.querySelectorAll('label,[class*="label"],[class*="Label"]')]
    .map(e => (e.innerText || '').trim()).filter(t => t && t.length < 80);
  return JSON.stringify({
    url: location.href,
    title: document.title,
    inputCount: inputs.length,
    inputs: inputs.map(i => ({
      tag: i.tagName.toLowerCase(),
      type: i.type || '',
      name: i.name || '',
      id: i.id || '',
      value: i.value || '',
      aria: i.getAttribute('aria-label') || '',
      ph: i.placeholder || '',
      testid: i.getAttribute('data-testid') || '',
    })),
    labels: [...new Set(labels)].slice(0, 40),
    bodyHead: document.body.innerText.slice(0, 700),
  });
})()`;

// ── 步骤 1：裸开
console.log('── 步骤 1：裸开（无参数）──');
await send('Page.navigate', { url: FORM }, 40000, SID);
await sleep(6000);

let raw = await js(FIELDS_PROBE);
let bare = null;
if (raw && !raw.__error) { try { bare = JSON.parse(raw); } catch {} }
console.log(`  URL   : ${bare?.url}`);
console.log(`  标题  : ${bare?.title}`);
console.log(`  输入框: ${bare?.inputCount}`);
console.log('  正文首段:');
console.log((bare?.bodyHead || '').split('\n').slice(0, 12).map((l) => '    ' + l).join('\n'));
console.log('\n  输入控件明细：');
(bare?.inputs || []).forEach((i, n) => {
  console.log(`    [${n}] <${i.tag}${i.type ? ' type=' + i.type : ''}> name="${i.name}" value="${i.value}" aria="${i.aria}" ph="${i.ph}"`);
});

// ── 步骤 2：候选参数名逐个试
const CANDIDATES = ['user_email', 'email', 'userEmail', 'mail', 'e', 'prefill_user_email'];

console.log('\n\n── 步骤 2：带 URL 参数试预填 ──');
console.log(`  测试值: ${TEST_EMAIL}\n`);

const results = [];
for (const name of CANDIDATES) {
  const url = `${FORM}?${name}=${encodeURIComponent(TEST_EMAIL)}`;
  await send('Page.navigate', { url }, 40000, SID);
  await sleep(5000);

  const r2 = await js(FIELDS_PROBE);
  let s = null;
  if (r2 && !r2.__error) { try { s = JSON.parse(r2); } catch {} }

  const hit = (s?.inputs || []).some((i) => String(i.value).includes('qa-prefill-test'))
           || String(s?.bodyHead || '').includes('qa-prefill-test')
           || String(s?.url || '').includes('qa-prefill-test');

  results.push({ name, hit, inputCount: s?.inputCount });
  console.log(`  ${hit ? '✅ 命中' : '—   未命中'}  ?${name}=  (输入框 ${s?.inputCount})`);

  if (hit) {
    console.log('\n  ★ 命中详情：');
    (s.inputs || []).forEach((i, n) => {
      console.log(`    [${n}] <${i.tag}> name="${i.name}" value="${i.value}" aria="${i.aria}"`);
    });
    console.log('    正文片段: ' + String(s.bodyHead).replace(/\n/g, ' | ').slice(0, 300));
    break;
  }
}

// ── 步骤 3：看表单是否暴露字段名/结构（供推断参数名）
console.log('\n\n── 步骤 3：页面内可见的字段结构线索 ──');
await send('Page.navigate', { url: FORM }, 40000, SID);
await sleep(5000);
const clues = await js(`(() => {
  const out = {};
  out.labels = [...new Set([...document.querySelectorAll('label,[class*="label"]')]
    .map(e => (e.innerText||'').trim()).filter(t => t && t.length < 60))].slice(0, 30);
  out.placeholders = [...new Set([...document.querySelectorAll('input,textarea')]
    .map(e => e.placeholder).filter(Boolean))].slice(0, 20);
  out.buttons = [...document.querySelectorAll('button')]
    .map(b => (b.innerText||'').trim()).filter(Boolean).slice(0, 15);
  out.testids = [...new Set([...document.querySelectorAll('[data-testid]')]
    .map(e => e.getAttribute('data-testid')))].slice(0, 40);
  return JSON.stringify(out, null, 1);
})()`);
console.log(clues);

// ── 截图
const shot = await send('Page.captureScreenshot', { format: 'png' }, 30000, SID);
const sp = path.join(OUT, 'fillout-form.png');
fs.writeFileSync(sp, Buffer.from(shot.data, 'base64'));
console.log(`\n  截图: ${path.relative(process.cwd(), sp)}`);

// ── 汇总
console.log('\n════════ 结论 ════════');
const ok = results.find((r) => r.hit);
if (ok) {
  console.log(`  ✅ 预填可用！参数名是：${ok.name}`);
  console.log(`     站点侧拼 URL 时用 ?${ok.name}=<邮箱>`);
} else {
  console.log('  ⚠️ 六个候选参数名都未命中预填');
  console.log('  可能原因：');
  console.log('    1. 表单里还没建隐藏字段（需先建，参数名要与之匹配）');
  console.log('    2. 隐藏字段的参数名不是常规写法');
  console.log('    3. 该表单未开启「允许 URL 参数」');
  console.log('  → 请把表单里隐藏字段的 URL parameter 名称告诉我');
}

await send('Target.closeTarget', { targetId }, 10000);
ws.close();
