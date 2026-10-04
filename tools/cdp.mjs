#!/usr/bin/env node
/**
 * tools/cdp.mjs —— 极简 CDP 客户端（供各脚本复用）
 *
 * 用法：
 *   import { connect } from './cdp.mjs';
 *   const c = await connect(9222);
 *   await c.goto(tabId, 'https://...');
 *   const text = await c.js(tabId, 'document.title');
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect(port = 9222) {
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const events = [];

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method) {
      events.push(m);
    }
  });

  const raw = (method, params = {}, sessionId) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); }
      }, 45000);
      pending.set(mid, { resolve, reject, timer });
    });
  };

  /** 列出所有页面标签（把 /json/list 的 id 统一成 targetId，避免调用方混淆） */
  const tabs = async () => {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const list = await r.json();
    return list
      .filter((t) => t.type === 'page')
      .map((t) => ({ ...t, targetId: t.id }));
  };

  /** 附着到标签，返回 sessionId */
  const attach = async (targetId) => {
    const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
    await raw('Runtime.enable', {}, sessionId).catch(() => {});
    await raw('Page.enable', {}, sessionId).catch(() => {});
    return sessionId;
  };

  /** 在标签里执行 JS */
  const js = async (sessionId, expr, timeout = 30000) => {
    const r = await raw('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    }, sessionId);
    if (r.exceptionDetails) {
      return { __error: r.exceptionDetails.exception?.description?.split('\n')[0] || 'unknown' };
    }
    return r.result?.value;
  };

  /** 导航并等待 */
  const goto = async (sessionId, url, waitMs = 5000) => {
    await raw('Page.navigate', { url }, sessionId);
    await sleep(waitMs);
  };

  /** 截图（返回 base64） */
  const shot = async (sessionId) => {
    const r = await raw('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    return r.data;
  };

  /** 新建标签 */
  const newTab = async (url = 'about:blank') => {
    const { targetId } = await raw('Target.createTarget', { url });
    return { targetId, sessionId: await attach(targetId) };
  };

  const close = () => ws.close();

  return { raw, tabs, attach, js, goto, shot, newTab, close, port, version: ver };
}

export { sleep };
