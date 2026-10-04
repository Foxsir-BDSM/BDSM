#!/usr/bin/env node
/**
 * tools/cdp-probe.mjs —— 通过 CDP 只读探测页面状态
 *
 * 用法: node tools/cdp-probe.mjs [--port 9333] [--url-filter zite]
 *
 * 输出：页面标题、URL、登录迹象、iframe 结构、可交互元素概览
 * 本脚本不修改页面任何内容。
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(get('--port', 9333));
const FILTER = get('--url-filter', 'zite');
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return (await r.json()).filter((t) => t.type === 'page');
}

try {
  const tabs = await cdpTargets();
  console.log('=== 当前标签页 ===');
  tabs.forEach((t, i) => console.log(`  [${i}] ${t.title || '(无标题)'}\n      ${t.url}`));

  const tab = tabs.find((t) => t.url.includes(FILTER));
  if (!tab) {
    console.log(`\n✗ 未找到匹配 "${FILTER}" 的标签页`);
    process.exit(1);
  }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  const send = (method, params = {}, timeout = 20000) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + ' 超时')); } }, timeout);
      pending.set(mid, { resolve, reject, timer });
    });
  };

  await send('Runtime.enable');

  // 递归在所有 frame 里求值
  const { frameTree } = await send('Page.getFrameTree').catch(async () => {
    await send('Page.enable');
    return send('Page.getFrameTree');
  });

  const frames = [];
  const walk = (node, depth = 0) => {
    frames.push({ id: node.frame.id, url: node.frame.url, depth });
    (node.childFrames || []).forEach((c) => walk(c, depth + 1));
  };
  walk(frameTree);

  console.log('\n=== frame 结构 ===');
  frames.forEach((f) => {
    console.log(`  ${'  '.repeat(f.depth)}[${f.depth}] ${f.url.slice(0, 100)}`);
  });

  const js = async (expr, frameId) => {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
      ...(frameId ? { contextId: undefined } : {}),
    });
    return r.result?.value;
  };

  console.log('\n=== 顶层页面状态 ===');
  const state = await js(`(() => {
    const t = document.title || '';
    const url = location.href;
    const body = document.body ? document.body.innerText.slice(0, 1200) : '';
    return JSON.stringify({
      title: t, url,
      bodyLen: document.body ? document.body.innerText.length : 0,
      bodyHead: body,
      loginHints: /登录|log in|sign in|Sign in/i.test(document.body ? document.body.innerText : ''),
      hasPasswordInput: !!document.querySelector('input[type=password]'),
      iframeCount: document.querySelectorAll('iframe').length,
      iframes: [...document.querySelectorAll('iframe')].map(f => f.src || '(no src)'),
    }, null, 1);
  })()`);
  console.log(state || '(无返回)');

  // 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const p = path.join(OUT, 'zite-probe.png');
  fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
  console.log(`\n  截图: ${path.relative(process.cwd(), p)}`);

  ws.close();
} catch (e) {
  console.error('探测失败:', e.message);
  process.exit(1);
}
