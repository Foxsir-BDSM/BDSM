#!/usr/bin/env node
/**
 * tools/inspect-supabase-keys.mjs —— 完整查看 Supabase 密钥页结构
 * 只读：读取页面上的密钥文本，不做任何修改。
 */
import { connect, sleep } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const tab = tabs.find((t) => t.url.includes('supabase.com') && t.url.includes('api-keys'));
if (!tab) { console.log('  ✗ 未找到页面'); process.exit(1); }
const s = await c.attach(tab.targetId);

// 已点过 Reveal，直接读
const info = await c.js(s, `(function(){
  var t = document.body.innerText || '';
  var out = { total: t.length };

  // 新体系密钥
  out.publishable = (t.match(/sb_publishable_[A-Za-z0-9_-]+/g) || []).slice(0,3);
  out.secret      = (t.match(/sb_secret_[A-Za-z0-9_-]+/g) || []).slice(0,3);
  // 旧体系 JWT
  out.jwt         = (t.match(/eyJ[A-Za-z0-9_-]{6,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}/g) || []).slice(0,4);

  // 所有疑似密钥串（含被截断显示的）
  out.raw = (t.match(/sb_[a-z]+_[A-Za-z0-9_-]{4,}/g) || []).slice(0,6);

  // 页面上的分区标题
  out.sections = t.split('\\n').map(function(x){return x.trim();})
    .filter(function(x){ return x && x.length < 46 && /key|Key|legacy|Legacy|secret|Secret|publishable|Publishable/.test(x); });

  return JSON.stringify(out, null, 1);
})()`);
console.log('════ 密钥页内容 ════════\n');
console.log(String(info).split('\n').map((l) => '  ' + l).join('\n'));

// 页面上是否有「展开/复制」类按钮，以及被截断的显示
const more = await c.js(s, `(function(){
  var t = document.body.innerText || '';
  var i = t.indexOf('Legacy anon');
  return i < 0 ? '(无 Legacy 区)' : t.slice(i, i + 700);
})()`);
console.log('\n════ Legacy 区正文 ════════\n');
console.log(String(more).split('\n').map((l) => '  ' + l).join('\n'));

c.close();
