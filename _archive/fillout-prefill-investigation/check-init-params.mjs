#!/usr/bin/env node
/**
 * tools/check-init-params.mjs
 * 判断表单前端拿到 URL 参数后，是否会把它传给自己的后端（/init 或提交接口）
 *
 * 方法：拦截 Network.requestWillBeSent，逐个记录请求 URL 是否含标记值。
 */
const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9344);
const FORM = 'https://forms.fillout.com/t/w5fVHTNECtus';
const MARK = 'ZZQA9911';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 0; const pending = new Map(); const hits = []; const apiCalls = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request.url;
    const postData = m.params.request.postData || '';
    if (u.includes(MARK) || postData.includes(MARK)) hits.push({ url: u.slice(0, 150), method: m.params.request.method });
    if (/api\.fillout\.com/.test(u)) apiCalls.push(`${m.params.request.method} ${u.slice(0, 120)}`);
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

const URLP = `${FORM}?user_email=${MARK}%40foxsir-test.local&user_nickname=${MARK}NI&uid=${MARK}UID`;
console.log('════════ 判断表单是否把 URL 参数传给后端 ════════');
console.log(`  标记: ${MARK}\n`);

await send('Page.navigate', { url: URLP }, 45000, SID);
await sleep(10000);

console.log('── 请求里含标记的（说明参数被读取并使用）──');
if (hits.length) {
  hits.forEach((h) => console.log(`  ${h.method}  ${h.url}`));
} else {
  console.log('  （无）→ 表单前端没有把 URL 参数传给任何后端接口');
}

console.log('\n── 调用的 Fillout API ──');
[...new Set(apiCalls)].forEach((u) => console.log('  ' + u));

console.log('\n── 输入框最终值 ──');
const vals = await js(`JSON.stringify([...document.querySelectorAll('input,textarea,select')]
  .filter(e => e.offsetParent !== null)
  .map(i => ({ a: i.getAttribute('aria-label') || i.type, v: i.value || '' })))`);
try { JSON.parse(vals).forEach((x, n) => console.log(`  [${n}] ${x.a} = "${x.v}"`)); } catch { console.log(vals); }

console.log('\n════════ 结论 ════════');
const used = hits.some((h) => /api\.fillout\.com|submit/i.test(h.url));
console.log(`  表单读取并外发 URL 参数: ${used ? '✅ 是' : '❌ 否'}`);
if (!used) {
  console.log('');
  console.log('  → 说明该表单的字段没有配置「URL parameter」绑定。');
  console.log('    仅把字段标签命名为 user_email 是不够的，');
  console.log('    需要在字段设置里显式指定它接收哪个 URL 参数。');
}

await send('Target.closeTarget', { targetId }, 10000);
ws.close();
