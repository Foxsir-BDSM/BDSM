#!/usr/bin/env node
/**
 * tools/find-jwt-keys.mjs —— 去 JWT Keys 页找完整的 legacy anon / service_role key
 *
 * 背景：新版 API Keys 页把 secret 打码，需要点复制才拿得到完整值。
 *       而「JWT Keys」页若启用，anon / service_role 两把 JWT 是明文展示的。
 */
import { connect, sleep } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const tab = tabs.find((t) => t.url.includes('supabase.com') && t.url.includes('/settings/'));
if (!tab) { console.log('  ✗ 未找到 Supabase settings 页'); process.exit(1); }
const s = await c.attach(tab.targetId);

console.log('════ 探查 JWT Keys 页 ════════\n');

// 找「JWT Keys」标签并点击
const clicked = await c.js(s, `(function(){
  var els = [].slice.call(document.querySelectorAll('a, button, [role=tab]'));
  var hit = els.filter(function(e){
    var t = (e.textContent || '').trim();
    return /^JWT Keys$/i.test(t) || /jwt-keys/i.test(e.getAttribute('href') || '');
  });
  if (!hit.length) return 'no-tab';
  hit[0].click();
  return 'clicked: ' + (hit[0].getAttribute('href') || hit[0].textContent.trim());
})()`);
console.log(`  ${clicked}`);

await sleep(4000);

const url = await c.js(s, 'location.href');
console.log(`  URL: ${String(url).slice(0, 110)}\n`);

// 读页面上的完整 JWT
const found = await c.js(s, `(function(){
  var t = document.body.innerText || '';
  var out = {};

  // 完整 JWT（三段式，每段够长）
  out.jwts = (t.match(/eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{30,}\\.[A-Za-z0-9_-]{20,}/g) || []);

  // 也扫 DOM 属性（value / data-*）
  var fromDom = [];
  document.querySelectorAll('input, textarea').forEach(function(el){
    var v = (el.value || '').trim();
    if (/^eyJ/.test(v) && v.length > 60) fromDom.push(v);
  });
  out.fromInputs = fromDom;

  // 打码状态
  out.masked = (t.match(/•{4,}/g) || []).length;

  // 是否提示未启用
  out.legacyNote = /legacy|Legacy|deprecat|JWT-based/i.test(t);

  return JSON.stringify(out, null, 1);
})()`);

let F = {};
try { F = JSON.parse(found); } catch {}
console.log(`  找到完整 JWT: ${(F.jwts || []).length + (F.fromInputs || []).length} 个`);
console.log(`  打码占位: ${F.masked} 处`);
console.log('');

const all = [...new Set([...(F.jwts || []), ...(F.fromInputs || [])])];
all.forEach((j, i) => {
  // 从 JWT 的 payload 里读 role
  let role = '?';
  try {
    const p = JSON.parse(Buffer.from(j.split('.')[1], 'base64').toString('utf8'));
    role = p.role || '?';
  } catch { /* 忽略 */ }
  console.log(`  [${i}] role=${role}  长度 ${j.length}`);
  console.log(`      ${j.slice(0, 40)}…${j.slice(-12)}`);
});

if (!all.length) {
  console.log('  ── 未找到完整 JWT，页面正文片段 ──');
  const txt = await c.js(s, `(document.body.innerText||'').slice(0, 900)`);
  console.log(String(txt).split('\n').map((l) => '     ' + l).join('\n'));
}

c.close();
