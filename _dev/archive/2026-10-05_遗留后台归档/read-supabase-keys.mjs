#!/usr/bin/env node
/**
 * tools/read-supabase-keys.mjs —— 从已登录的 Supabase 后台页面读取 API key
 *
 * 说明：service_role key 默认被打码，需点「Reveal」。
 *       本脚本先看是否已展开，未展开则尝试点击按钮后再读。
 */
import { connect, sleep } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const tab = tabs.find((t) => t.url.includes('supabase.com') && t.url.includes('api-keys'));
if (!tab) {
  console.log('  ✗ 未找到 Supabase API 页面。当前标签：');
  tabs.forEach((t) => console.log('     ' + String(t.url).slice(0, 100)));
  process.exit(1);
}
const s = await c.attach(tab.targetId);
console.log(`  页面: ${String(tab.url).slice(0, 90)}\n`);

// 等 SPA 渲染
for (let i = 0; i < 8; i++) {
  const len = await c.js(s, `document.body.innerText.length`);
  if (typeof len === 'number' && len > 800) break;
  await sleep(1500);
}

const snap = async (label) => {
  const raw = await c.js(s, `(function(){
    var t = document.body.innerText || '';
    // 找出所有像 JWT 的串（三段式）
    var jwts = t.match(/eyJ[A-Za-z0-9_-]{6,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}/g) || [];
    // 找出被打码的占位
    var masked = (t.match(/[•*]{8,}|\\*{6,}/g) || []).length;
    var hasReveal = /Reveal|reveal|显示|Show/i.test(t);
    return JSON.stringify({ len: t.length, jwts: jwts.slice(0,6), masked: masked, hasReveal: hasReveal });
  })()`);
  let o = {};
  try { o = JSON.parse(raw); } catch {}
  console.log(`  ── ${label} ──`);
  console.log(`     正文长度 ${o.len}  打码占位 ${o.masked}  含 Reveal 按钮: ${o.hasReveal}`);
  console.log(`     找到 JWT: ${(o.jwts || []).length} 个`);
  (o.jwts || []).forEach((j, i) => console.log(`       [${i}] ${j.slice(0, 26)}…${j.slice(-8)}  长度 ${j.length}`));
  return o;
};

await snap('初始状态');

// 尝试点 Reveal
console.log('\n  ── 尝试点击 Reveal ──');
const clicked = await c.js(s, `(function(){
  var btns = [].slice.call(document.querySelectorAll('button, [role=button], a'));
  var hit = btns.filter(function(b){
    var t = (b.innerText || b.textContent || '').trim();
    var a = (b.getAttribute('aria-label') || '').trim();
    return /^(Reveal|Show|显示)$/i.test(t) || /reveal|show/i.test(a);
  });
  if (!hit.length) return 'no-button';
  hit.forEach(function(b){ try { b.click(); } catch(e){} });
  return 'clicked:' + hit.length;
})()`);
console.log(`     ${clicked}`);
await sleep(2500);

await snap('点击之后');

// 再找 service_role 附近的文本
const ctx = await c.js(s, `(function(){
  var t = document.body.innerText || '';
  var i = t.indexOf('service_role');
  if (i < 0) return '(正文中无 service_role 字样)';
  return t.slice(Math.max(0, i - 60), i + 420).replace(/\\n{2,}/g, '\\n');
})()`);
console.log('\n  ── service_role 附近正文 ──');
console.log(String(ctx).split('\n').map((l) => '     ' + l).join('\n'));

c.close();
