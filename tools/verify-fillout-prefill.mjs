#!/usr/bin/env node
/**
 * tools/verify-fillout-prefill.mjs —— 验证新的 URL 参数配置
 *
 * 参数名（据用户 2026-10-03 最新配置）：
 *   email / name / uid
 *
 * 严格判定：只看输入框 value 与可见正文，不含 location.href
 */
const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9344);
const FORM = 'https://forms.fillout.com/t/w5fVHTNECtus';
const MARK = 'ZZQA7733';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 0; const pending = new Map(); const netHits = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method === 'Network.requestWillBeSent') {
    const r = m.params.request;
    const blob = r.url + (r.postData || '');
    if (blob.includes(MARK) && !r.url.startsWith('https://forms.fillout.com/t/')) {
      netHits.push(`${r.method} ${r.url.slice(0, 120)}`);
    }
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

const email = `${MARK}@foxsir-test.local`;
const nick = `${MARK}NICK`;
const uidv = `${MARK}UID`;
const url = `${FORM}?email=${encodeURIComponent(email)}&name=${encodeURIComponent(nick)}&uid=${encodeURIComponent(uidv)}`;

console.log('════════ 验证 URL 参数预填（新配置）════════');
console.log(`  参数名: email / name / uid`);
console.log(`  测试值: ${email} | ${nick} | ${uidv}\n`);

await send('Page.navigate', { url }, 45000, SID);
await sleep(9000);

const snap = await js(`(() => {
  const inputs = [...document.querySelectorAll('input,textarea,select')].filter(e => e.offsetParent !== null);
  return JSON.stringify({
    url: location.href,
    values: inputs.map((i, n) => ({ n, label: i.getAttribute('aria-label') || i.type, v: i.value || '', type: i.type })),
    bodyHasMark: (document.body.innerText || '').includes('${MARK}'),
  });
})()`);

let s = null; try { s = JSON.parse(snap); } catch { console.log('  解析失败:', snap); }

console.log('── 各输入框实际值 ──');
(s?.values || []).forEach((x) => {
  const hit = String(x.v).includes(MARK) ? '   ★ 预填成功' : '';
  console.log(`  [${x.n}] ${x.label} (type=${x.type}) = "${x.v}"${hit}`);
});

const filled = (s?.values || []).filter((x) => String(x.v).includes(MARK));
console.log(`\n── 预填命中: ${filled.length} / ${(s?.values || []).length} 个字段 ──`);

console.log('\n── 参数是否被传给后端 ──');
if (netHits.length) {
  [...new Set(netHits)].forEach((h) => console.log('  ' + h));
} else {
  console.log('  （无后端请求含标记值）');
}

const shot = await send('Page.captureScreenshot', { format: 'png' }, 30000, SID);
const fs = await import('node:fs');
const path = await import('node:path');
const sp = path.join(process.cwd(), '.shots', 'runtime', 'prefill-verified.png');
fs.mkdirSync(path.dirname(sp), { recursive: true });
fs.writeFileSync(sp, Buffer.from(shot.data, 'base64'));
console.log(`\n  截图: .shots/runtime/prefill-verified.png`);

console.log('\n════════ 结论 ════════');
if (filled.length >= 1) {
  console.log(`  ✅ 预填已生效！成功 ${filled.length} 个字段：`);
  filled.forEach((x) => console.log(`      ${x.label} → "${x.v}"`));
  const missing = (s?.values || []).filter((x) => !String(x.v).includes(MARK));
  if (missing.length) {
    console.log(`  ⚠️ 未预填的字段（${missing.length} 个）：`);
    missing.forEach((x) => console.log(`      ${x.label}  ← Default value 未绑定该参数`));
  }
  console.log('\n  ▶ 站点侧拼 URL 时请使用参数名：');
  console.log(`      ?email=<登录邮箱>&name=<昵称>&uid=<ID前8位>`);
} else {
  console.log('  ❌ 仍未预填。可能原因：');
  console.log('     1. 保存未生效（表单需重新发布）');
  console.log('     2. 字段的 Default value 未绑定到参数');
  console.log('     3. 参数名大小写或拼写不符');
}

await send('Target.closeTarget', { targetId }, 10000);
ws.close();
