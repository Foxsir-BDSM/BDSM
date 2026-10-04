#!/usr/bin/env node
/**
 * tools/test-fillout-deep.mjs —— 深入诊断为何预填无效
 *
 * 检查维度：
 *   1. 更长等待（网络异步注入的可能性）
 *   2. 是否有 iframe 承载真正的表单
 *   3. React 内部 props 里是否记下了 URL 参数
 *   4. 抓取网络请求，看参数是否被读出并用于取数
 *   5. 直接在 React fiber 上找字段配置（可能含 urlParam 设置）
 */
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9344);
const FORM = 'https://forms.fillout.com/t/w5fVHTNECtus';
const MARK = 'ZZQA9911';
const EMAIL = `${MARK}@foxsir-test.local`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 0; const pending = new Map(); const netLog = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request.url;
    if (!/\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/.test(u)) netLog.push(u.slice(0, 160));
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

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const att = await send('Target.attachToTarget', { targetId, flatten: true });
const SID = att.sessionId;
await send('Runtime.enable', {}, 20000, SID);
await send('Page.enable', {}, 20000, SID);
await send('Network.enable', {}, 20000, SID);

const js = async (expr, t = 30000) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t, SID);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

const URL_WITH_PARAM = `${FORM}?user_email=${encodeURIComponent(EMAIL)}&user_nickname=${MARK}NI&uid=${MARK}UID`;
console.log('════════ 深入诊断 Fillout 预填 ════════');
console.log(`  目标 URL: ${URL_WITH_PARAM}\n`);

netLog.length = 0;
await send('Page.navigate', { url: URL_WITH_PARAM }, 40000, SID);

// 分多个时间点采样，排除异步加载
for (const wait of [3000, 6000, 12000]) {
  await sleep(wait === 3000 ? 3000 : 3000 + (wait - 3000));
  const snap = await js(`(() => {
    const inputs = [...document.querySelectorAll('input,textarea,select')].filter(e => e.offsetParent !== null);
    return JSON.stringify({
      t: ${wait},
      values: inputs.map(i => ({ aria: i.getAttribute('aria-label') || i.type, v: i.value || '' })),
      iframes: [...document.querySelectorAll('iframe')].map(f => f.src || '(no src)'),
    });
  })()`);
  let s = null; try { s = JSON.parse(snap); } catch {}
  const filled = (s?.values || []).filter((x) => String(x.v).includes(MARK));
  console.log(`  [等待 ${wait}ms] 输入框 ${s?.values?.length}  含标记的字段: ${filled.length}  iframe: ${s?.iframes?.length}`);
  if (filled.length) filled.forEach((f) => console.log(`      ★ ${f.aria} = "${f.v}"`));
}

console.log('\n── 输入框最终值 ──');
const fin = await js(`JSON.stringify([...document.querySelectorAll('input,textarea,select')]
  .filter(e => e.offsetParent !== null)
  .map(i => ({ aria: i.getAttribute('aria-label') || i.type, v: i.value || '', type: i.type })))`);
try { JSON.parse(fin).forEach((x, n) => console.log(`  [${n}] ${x.aria} (type=${x.type}) = "${x.v}"`)); } catch { console.log(fin); }

console.log('\n── iframe 情况 ──');
const ifr = await js(`JSON.stringify([...document.querySelectorAll('iframe')].map(f => ({src: f.src||'(no src)', id: f.id||''})))`);
console.log('  ' + ifr);

console.log('\n── React 内部是否记录了 URL 参数 ──');
const react = await js(`(() => {
  const marks = [];
  const walk = (node, depth) => {
    if (!node || depth > 4) return;
    const key = Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
    if (key) marks.push({ depth, key: key.slice(0, 20) });
    return;
  };
  // 找根节点的 react key
  const root = document.getElementById('root') || document.body.firstElementChild;
  if (root) {
    const rk = Object.keys(root).filter(k => k.startsWith('__react'));
    marks.push({ rootKeys: rk.map(k => k.slice(0, 22)) });
  }
  // 搜索页面里是否出现我们的参数值
  const html = document.documentElement.innerHTML;
  return JSON.stringify({
    reactKeys: marks,
    paramInHTML: {
      user_email: html.includes('ZZQA9911'),
      user_nickname: html.includes('ZZQA9911NI'),
      uid: html.includes('ZZQA9911UID'),
    },
    // 全局变量里是否暴露了 URL 参数
    globals: Object.keys(window).filter(k => /param|prefill|config|form/i.test(k)).slice(0, 25),
  }, null, 1);
})()`);
console.log(react);

console.log('\n── 关键网络请求（非静态资源）──');
console.log('  ' + (netLog.length ? [...new Set(netLog)].slice(0, 12).join('\n  ') : '(无)'));

const shot = await send('Page.captureScreenshot', { format: 'png' }, 30000, SID);
fs.writeFileSync(path.join(process.cwd(), '.shots', 'runtime', 'fillout-deep.png'), Buffer.from(shot.data, 'base64'));

console.log('\n════════ 判定 ════════');
let verdict = 'unknown';
try {
  const r = JSON.parse(react);
  const inHtml = Object.values(r.paramInHTML || {}).some(Boolean);
  verdict = inHtml ? 'params-reached-dom-but-not-filled' : 'params-not-used-at-all';
} catch {}
console.log(`  ${verdict === 'params-not-used-at-all'
  ? '❌ 表单完全没读取 URL 参数 —— 字段未配置 URL parameter 绑定'
  : '⚠️ 参数进入了 DOM 但没填进输入框 —— 需要检查字段的 prefill 设置'}`);
console.log(`  截图: .shots/runtime/fillout-deep.png`);

await send('Target.closeTarget', { targetId }, 10000);
ws.close();
