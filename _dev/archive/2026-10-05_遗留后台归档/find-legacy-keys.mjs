#!/usr/bin/env node
/**
 * tools/find-legacy-keys.mjs —— 在当前密钥页找完整的 legacy anon / service_role key
 *
 * 背景：Supabase 新版把密钥换成 sb_publishable_ / sb_secret_，
 *       完整值只在「点击复制」时给出，正文里看到的可能是截断的。
 *       但 legacy（JWT 格式）那一栏通常会完整显示。
 */
import { connect, sleep } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const tab = tabs.find((t) => t.url.includes('supabase.com') && t.url.includes('api-keys'));
if (!tab) { console.log('  ✗ 未找到页面'); process.exit(1); }
const s = await c.attach(tab.targetId);

console.log('════ 查找完整密钥 ════════\n');
console.log(`  当前 URL: ${String(await c.js(s, 'location.href')).slice(0, 110)}\n`);

// 1. 页面里所有 input / textarea / code 的值（完整值常在这里）
const fields = await c.js(s, `(function(){
  var out = [];
  document.querySelectorAll('input, textarea, code, pre, span, div').forEach(function(el){
    var v = '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') v = el.value || '';
    else v = el.textContent || '';
    v = v.trim();
    if (/^(eyJ|sb_)/.test(v) && v.length > 24) {
      out.push({ tag: el.tagName.toLowerCase(), len: v.length, head: v.slice(0, 30), tail: v.slice(-8) });
    }
  });
  // 去重
  var seen = {}, uniq = [];
  out.forEach(function(o){ var k = o.head + o.len; if (!seen[k]) { seen[k] = 1; uniq.push(o); } });
  return JSON.stringify(uniq.slice(0, 12), null, 1);
})()`);
console.log('  ── 页面上的密钥元素 ──');
console.log(String(fields).split('\n').map((l) => '  ' + l).join('\n'));

// 2. 找「Your new API keys are here」链接，尝试打开 legacy 页
const link = await c.js(s, `(function(){
  var a = [].slice.call(document.querySelectorAll('a'));
  var hit = a.filter(function(x){ return /new API keys|api-keys\\?/i.test(x.getAttribute('href')||'') || /new API keys/i.test(x.textContent||''); });
  return hit.length ? (hit[0].getAttribute('href') || hit[0].textContent) : 'no-link';
})()`);
console.log(`\n  「新密钥」链接: ${link}`);

// 3. 直接展开所有折叠区（Legacy 常在 <details> 或可展开面板里）
const expanded = await c.js(s, `(function(){
  var n = 0;
  document.querySelectorAll('details').forEach(function(d){ if(!d.open){ d.open = true; n++; } });
  [].slice.call(document.querySelectorAll('button')).forEach(function(b){
    var t = (b.textContent||'').trim();
    if (/legacy|Legacy|显示旧|Show legacy/i.test(t)) { b.click(); n++; }
  });
  return n;
})()`);
console.log(`  展开折叠区: ${expanded} 处`);
await sleep(2000);

// 4. 再读一次正文里 legacy 段
const legacy = await c.js(s, `(function(){
  var t = document.body.innerText || '';
  var i = t.search(/Legacy anon|legacy anon|anon.*service_role/i);
  if (i < 0) return '(未找到 Legacy 段)';
  return t.slice(i, i + 1100);
})()`);
console.log('\n  ── Legacy 段正文 ──');
console.log(String(legacy).split('\n').map((l) => '     ' + l).join('\n'));

// 5. 再扫一遍完整密钥
const again = await c.js(s, `(function(){
  var t = document.body.innerText || '';
  return JSON.stringify({
    jwt: (t.match(/eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}/g) || []).slice(0,4),
    secret: (t.match(/sb_secret_[A-Za-z0-9_-]{10,}/g) || []).slice(0,4)
  }, null, 1);
})()`);
console.log('\n  ── 完整密钥扫描 ──');
console.log(String(again).split('\n').map((l) => '  ' + l).join('\n'));

c.close();
