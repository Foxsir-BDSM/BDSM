#!/usr/bin/env node
/**
 * tools/check-avatar-upload.mjs —— 头像上传链路验证（CDP 驱动）
 *
 * 流程：注册测试账号 → 打开个人资料页 → 通过 CDP 设置文件输入框 →
 *       触发 change → 等待上传 → 校验头像 img 出现且 URL 可访问。
 *
 *   node tools/check-avatar-upload.mjs --port 5180
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const PORT = Number(get('--port', 5180));
const BASE = `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(get('--cdp', 9777));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), 'foxsir-avatar-check');
const OUT = path.join(process.cwd(), '.shots', 'runtime');

const TS = Date.now().toString().slice(-8);
const EMAIL = `qa_av_${TS}@foxsir-test.local`;
const PASS = 'Qa!123456';

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 生成一张 240×240 的渐变 PNG 作为测试头像（纯 Node，无依赖）
function crc32(buf) {
  let c;
  const table = crc32.t || (crc32.t = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}
function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = Math.round(212 * (x / size));       // R 渐变
      raw[i + 1] = Math.round(165 * (y / size));   // G 渐变
      raw[i + 2] = 116;                            // B 固定
      raw[i + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const png = makePng(240);
const pngPath = path.join(os.tmpdir(), 'foxsir-test-avatar.png');
fs.writeFileSync(pngPath, png);
console.log(`测试头像已生成: ${pngPath}  (${png.length} 字节, 240×240)`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(`${label} 期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`); console.log(`  ✗ ${label}  期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--window-size=1440,1000',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function waitCDP(p, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${p}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('CDP 未就绪');
}

try {
  const wsUrl = await waitCDP(CDP_PORT);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0; const pending = new Map(); const pageErrors = []; let sessionId = null;
  const send = (method, params = {}, timeout = 30000, useSession = true) => {
    const mid = ++id;
    const payload = { id: mid, method, params };
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(`${method} 超时`)); } }, timeout);
      pending.set(mid, { resolve, reject, timer });
    });
  };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId && m.sessionId !== sessionId) return;
    if (m.id && pending.has(m.id)) {
      const { resolve, reject, timer } = pending.get(m.id);
      clearTimeout(timer); pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params?.exceptionDetails?.exception?.description?.split('\n')[0] || '?');
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, 20000, false);
  const at = await send('Target.attachToTarget', { targetId, flatten: true }, 20000, false);
  sessionId = at.sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');

  const js = async (expr, t) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t);
    return r.result?.value;
  };

  console.log('\n══════ 头像上传链路验证 ══════');
  console.log(`  测试账号: ${EMAIL}\n`);

  // 1) 注册并登录
  await send('Page.navigate', { url: BASE + '/auth.html' });
  await sleep(2500);
  const reg = await js(`(async () => {
    const m = await import('/shared/js/supabase-client.js');
    const { error } = await m.supabase.auth.signUp({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)},
      options: { data: { role:'self', nickname:'头像测试', points:0, primary_identity:'female_M', primary_label:'女M', gender:'female', role_type:'bottom', secondary_identities:[] } } });
    if (error) return 'ERR:' + error.message;
    const li = await m.supabase.auth.signInWithPassword({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASS)} });
    if (li.error) return 'LOGIN_ERR:' + li.error.message;
    localStorage.setItem('foxsir_session', JSON.stringify(li.data.session));
    return 'OK';
  })()`, 40000);
  check('注册并登录', reg, 'OK');
  if (reg !== 'OK') throw new Error('注册失败: ' + reg);

  // 2) 打开资料页
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(3000);
  check('初始无头像（占位字母）', await js(`!!document.querySelector('#avatarInner .letter')`), true);

  // 3) 通过 CDP 设置文件
  const doc = await send('DOM.getDocument', { depth: -1 });
  const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#avatarFile' });
  await send('DOM.setFileInputFiles', { files: [pngPath], nodeId: node.nodeId });
  console.log('  · 已注入测试文件到 #avatarFile');

  // 4) 触发 change（CDP setFileInputFiles 通常会自动触发，这里兜底再派发一次）
  await js(`(() => { const el = document.getElementById('avatarFile'); if (el && !el.dataset.fired) { el.dataset.fired='1'; el.dispatchEvent(new Event('change', { bubbles: true })); } })()`);

  // 5) 等待上传完成
  let avatarSrc = null;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    avatarSrc = await js(`document.querySelector('#avatarInner img')?.src || null`);
    const notice = await js(`document.getElementById('avatarNotice').textContent || ''`);
    if (avatarSrc) { console.log(`  · 上传完成，用时约 ${i + 1}s，提示: ${notice}`); break; }
    if (/失败|异常/.test(notice)) { console.log(`  · 上传报错: ${notice}`); break; }
  }

  check('头像 img 已出现', typeof avatarSrc === 'string' && avatarSrc.length > 0, true);
  check('头像 URL 指向 avatars 桶', /\/storage\/v1\/object\/public\/avatars\//.test(avatarSrc || ''), true);
  check('URL 以 .webp 结尾', /avatar\.webp/.test(avatarSrc || ''), true);

  // 6) 校验图片真实可访问
  if (avatarSrc) {
    try {
      const r = await fetch(avatarSrc);
      check('头像 URL 可访问', r.status, 200);
      const buf = Buffer.from(await r.arrayBuffer());
      check('返回内容为 WebP', buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP', true);
      check('文件体积 < 30KB', buf.length < 30 * 1024, true);
      console.log(`  · 实际大小: ${(buf.length / 1024).toFixed(1)} KB`);
    } catch (e) {
      check('头像 URL 可访问', 'fetch错误: ' + e.message, 200);
    }
  }

  // 7) 刷新后仍显示头像（已写入 metadata）
  await send('Page.navigate', { url: BASE + '/profile.html' });
  await sleep(3000);
  check('刷新后头像仍显示', await js(`!!document.querySelector('#avatarInner img')`), true);

  // 8) 首页顶栏同步显示头像
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(3000);
  check('首页顶栏显示头像', await js(`!!document.querySelector('.um-avatar img')`), true);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'index-avatar-uploaded.png'), Buffer.from(shot.data, 'base64'));

  console.log(`\n───────────────────────────────`);
  console.log(`  通过 ${pass}   失败 ${fails.length}`);
  if (pageErrors.length) {
    console.log('  ── 页面异常 ──');
    for (const e of [...new Set(pageErrors)]) console.log('   · ' + e);
  }
  if (fails.length) {
    console.log('  ── 失败明细 ──');
    for (const f of fails) console.log('   · ' + f);
  }
  console.log(`  测试账号: ${EMAIL}`);
  console.log('═══════════════════════════════');

  await send('Target.closeTarget', { targetId }, 10000, false);
  chrome.kill('SIGKILL');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error('验证失败:', e.message);
  chrome.kill('SIGKILL');
  process.exit(1);
}
