#!/usr/bin/env node
/**
 * tools/test-fillout-prefill2.mjs —— 严格版预填验证
 *
 * 修正上一版的假阳性：
 *   只认「输入框的 value」或「页面可见文本」含测试值，
 *   绝不把 location.href 计入判断（URL 里本来就有参数）。
 *
 * 同时输出每轮的原始 value，供人工核对。
 */
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9344);
const FORM = 'https://forms.fillout.com/t/w5fVHTNECtus';
const MARK = 'ZZQA9911';                       // 唯一标记，避免与其他内容混淆
const EMAIL = `${MARK}@foxsir-test.local`;
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ★ 严格探针：只看 value 与可见文本
const PROBE = (mark) => `(() => {
  const inputs = [...document.querySelectorAll('input,textarea,select,[contenteditable="true"]')]
    .filter(e => e.offsetParent !== null);
  const vals = inputs.map((i, n) => ({
    n, tag: i.tagName.toLowerCase(), type: i.type || '',
    aria: i.getAttribute('aria-label') || '',
    value: i.value || '',
  }));
  const bodyText = document.body.innerText || '';
  const MARK = ${JSON.stringify('MARK')};
  return JSON.stringify({
    url: location.href,
    inputValues: vals,
    // 严格：只看输入框 value
    hitInInputs: vals.filter(v => String(v.value).includes(MARK)),
    // 严格：只看可见正文（正文不含 URL 参数）
    hitInBody: bodyText.includes(MARK),
    bodyText: bodyText.slice(0, 600),
  });
})()`.replace('"MARK"', JSON.stringify(mark));

const run = async (label, url) => {
  await send('Page.navigate', { url }, 40000, SID);
  await sleep(6000);
  const raw = await js(PROBE(MARK));
  if (!raw || raw.__error) return { label, error: raw?.__error || 'no result' };
  try { return { label, ...JSON.parse(raw) }; } catch { return { label, parseFail: raw }; }
};

console.log('════════ Fillout 预填严格验证 ════════');
console.log(`  标记值: ${MARK}   完整邮箱: ${EMAIL}`);
console.log(`  判断依据: 仅「输入框 value」与「页面可见正文」，不含 URL\n`);

// ── A. 对照：裸开（不应出现标记）
const A = await run('A·裸开', FORM);
console.log('── A · 裸开（对照组）──');
console.log(`  URL: ${A.url}`);
console.log(`  输入框命中标记: ${A.hitInInputs?.length ?? 'n/a'}`);
console.log(`  正文命中标记  : ${A.hitInBody}`);
console.log('  各输入框当前值:');
(A.inputValues || []).forEach((v) => console.log(`    [${v.n}] ${v.aria || v.type} = "${v.value}"`));

// ── B. 带 user_email 参数
const B = await run('B·user_email', `${FORM}?user_email=${encodeURIComponent(EMAIL)}`);
console.log('\n── B · ?user_email=<邮箱> ──');
console.log(`  输入框命中标记: ${B.hitInInputs?.length ?? 0}`);
console.log(`  正文命中标记  : ${B.hitInBody}`);
console.log('  各输入框当前值:');
(B.inputValues || []).forEach((v) => {
  const mark = String(v.value).includes(MARK) ? '  ★' : '';
  console.log(`    [${v.n}] ${v.aria || v.type} = "${v.value}"${mark}`);
});

// ── C. 带 email 参数（对照参数名）
const C = await run('C·email', `${FORM}?email=${encodeURIComponent(EMAIL)}`);
console.log('\n── C · ?email=<邮箱>（参数名对照）──');
console.log(`  输入框命中标记: ${C.hitInInputs?.length ?? 0}`);
(C.inputValues || []).forEach((v) => console.log(`    [${v.n}] ${v.aria || v.type} = "${v.value}"`));

// ── D. 带 user_nickname 参数（验证这个字段本身能否被预填）
const D = await run('D·user_nickname', `${FORM}?user_nickname=${MARK}NI`);
console.log('\n── D · ?user_nickname=<标记> ──');
console.log(`  输入框命中标记: ${D.hitInInputs?.length ?? 0}`);
(D.inputValues || []).forEach((v) => {
  const mark = String(v.value).includes(MARK) ? '  ★' : '';
  console.log(`    [${v.n}] ${v.aria || v.type} = "${v.value}"${mark}`);
});

const shot = await send('Page.captureScreenshot', { format: 'png' }, 30000, SID);
fs.writeFileSync(path.join(OUT, 'fillout-prefill-test.png'), Buffer.from(shot.data, 'base64'));

// ── 结论
console.log('\n════════ 结论 ════════');
const bHit = (B.hitInInputs || []).length > 0 || B.hitInBody;
const dHit = (D.hitInInputs || []).length > 0;
console.log(`  ?user_email   预填: ${bHit ? '✅ 有效' : '❌ 无效'}`);
console.log(`  ?user_nickname 预填: ${dHit ? '✅ 有效' : '❌ 无效'}`);
if (!bHit && !dHit) {
  console.log('');
  console.log('  说明：URL 参数已正确传递，但表单侧的隐藏字段尚未建立');
  console.log('  → 需要在表单里新建字段，并把其 URL parameter 名称设为 user_email');
}
console.log(`\n  截图: ${path.relative(process.cwd(), path.join(OUT, 'fillout-prefill-test.png'))}`);

await send('Target.closeTarget', { targetId }, 10000);
ws.close();
