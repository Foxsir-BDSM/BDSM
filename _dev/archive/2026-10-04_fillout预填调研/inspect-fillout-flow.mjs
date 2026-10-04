#!/usr/bin/env node
/**
 * tools/inspect-fillout-flow.mjs —— 读取表单的初始化数据，看字段配置里有没有 URL 参数绑定
 *
 * 思路：不猜 UI，直接拿 Fillout 自己的 /init 响应，
 *       从字段定义里找 urlParam / prefill 之类的配置项。
 */
const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 9344);
const FORM = 'https://forms.fillout.com/t/w5fVHTNECtus';
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

const js = async (expr, t = 40000) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t, SID);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.value;
};

console.log('════════ 读取表单初始化数据 ════════\n');

// 打开表单，让它在 performance 里留下 /init 响应
await send('Page.navigate', { url: FORM }, 40000, SID);
await sleep(7000);

// 从 Performance Resource Timing 找 /init，再尝试用 fetch 重取
const initInfo = await js(`(async () => {
  const entries = performance.getEntriesByType('resource')
    .map(e => e.name)
    .filter(n => /\\/init/.test(n));
  return JSON.stringify({ found: entries });
})()`);
console.log('── 找到的 init 请求 ──');
console.log('  ' + initInfo);

// 直接重取 init 数据（公开表单，无需鉴权）
const initData = await js(`(async () => {
  try {
    const r = await fetch('https://api.fillout.com/v1/flow/w5fVHTNECtus/init', {
      headers: { 'accept': 'application/json' },
    });
    const j = await r.json();
    // 只提取结构线索，避免打印海量内容
    const pick = (o, depth = 0, path = '') => {
      if (depth > 6 || !o || typeof o !== 'object') return null;
      const out = {};
      for (const k of Object.keys(o)) {
        if (/urlparam|prefill|hidden|param|defaultvalue|mapping/i.test(k)) {
          out[path + k] = JSON.stringify(o[k]).slice(0, 220);
        }
        if (depth < 6) {
          const sub = pick(o[k], depth + 1, path + k + '.');
          if (sub && Object.keys(sub).length) Object.assign(out, sub);
        }
      }
      return out;
    };
    const keys = Object.keys(j);
    const interesting = pick(j, 0);
    return JSON.stringify({
      topKeys: keys,
      interestingKeys: interesting,
      // 列出字段的 id / name / type
      fields: (() => {
        const found = [];
        const walk = (o, d = 0) => {
          if (d > 7 || !o || typeof o !== 'object') return;
          if (Array.isArray(o)) { o.forEach(x => walk(x, d + 1)); return; }
          if (o.id && (o.type || o.name)) {
            found.push({ id: String(o.id).slice(0, 40), name: o.name || '', type: o.type || '',
                          hasUrlParam: 'urlParam' in o || 'urlParameter' in o,
                          keys: Object.keys(o).slice(0, 18) });
          }
          Object.values(o).forEach(v => walk(v, d + 1));
        };
        walk(j);
        return found.slice(0, 40);
      })(),
    }, null, 1);
  } catch (e) { return JSON.stringify({ error: String(e) }); }
})()`, 45000);

console.log('\n── init 数据结构 ──');
console.log(initData);

await send('Target.closeTarget', { targetId }, 10000);
ws.close();
