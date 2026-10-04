#!/usr/bin/env node
/**
 * tools/cf-explore.mjs —— 窥探 Cloudflare 控制台当前界面（只读，不点击）
 */
import { connect, sleep } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const cf = tabs.find((t) => t.url.includes('dash.cloudflare.com'));
if (!cf) {
  console.error('找不到 Cloudflare 标签页');
  process.exit(1);
}
const s = await c.attach(cf.targetId);

console.log('════════ Cloudflare 控制台界面 ════════\n');
console.log(`  URL: ${await c.js(s, 'location.href')}\n`);

// 账号信息
const acct = await c.js(s, `(function(){
  var m = location.pathname.match(/\\/([0-9a-f]{32})/);
  return m ? m[1] : '(未在 URL 中)';
})()`);
console.log(`  Account ID（从 URL 提取）: ${acct}\n`);

// 左侧导航可见项
const nav = await c.js(s, `(function(){
  var out = [];
  document.querySelectorAll('a[href]').forEach(function(a){
    var t = (a.innerText||'').trim().replace(/\\s+/g,' ');
    var h = a.getAttribute('href')||'';
    if (t && t.length < 40 && /d1|r2|worker|storage|database|workers|computing/i.test(h + ' ' + t)) {
      out.push(t + '  →  ' + h);
    }
  });
  return JSON.stringify(out.slice(0, 25), null, 1);
})()`);
console.log('  ── 相关导航链接 ──');
console.log(String(nav).split('\n').map((l) => '  ' + l).join('\n'));

console.log('\n  ── 页面可见文字（前 500 字）──');
const txt = await c.js(s, `(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,500)`);
console.log('  ' + txt);

const b64 = await c.shot(s);
const fs = await import('node:fs');
const path = await import('node:path');
const out = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'cf-dashboard.png'), Buffer.from(b64, 'base64'));
console.log('\n  ✅ 截图: .shots/runtime/cf-dashboard.png');

c.close();
