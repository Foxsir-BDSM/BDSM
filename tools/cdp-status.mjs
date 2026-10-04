#!/usr/bin/env node
/**
 * tools/cdp-status.mjs —— 查看被接管浏览器的登录状态
 */
import { connect } from './cdp.mjs';

const c = await connect(9222);
console.log('════════ 被接管浏览器状态 ════════\n');
console.log(`  ${c.version.Browser}`);
console.log(`  ${c.version.webSocketDebuggerUrl}\n`);

const tabs = await c.tabs();
console.log(`  标签页数: ${tabs.length}\n`);

for (const t of tabs) {
  const s = await c.attach(t.targetId);
  const info = await c.js(s, `(function(){
    return JSON.stringify({
      url: location.href,
      title: document.title,
      loggedInHint: (function(){
        var h = location.hostname;
        if (h.indexOf('cloudflare') >= 0) {
          // 已登录时控制台会有账号相关元素；未登录会跳转到 /login
          return location.pathname.indexOf('/login') < 0 ? '可能已登录' : '未登录';
        }
        if (h.indexOf('github') >= 0) {
          var a = document.querySelector('meta[name="user-login"]');
          if (a) return '已登录: ' + a.getAttribute('content');
          if (document.body && /Sign in|登录/i.test(document.body.innerText.slice(0,600))) return '未登录';
          return '未知';
        }
        return '';
      })()
    });
  })()`);
  let o = {};
  try { o = JSON.parse(info); } catch { o = { url: t.url, title: t.title }; }

  console.log(`  ── ${o.title || t.title}`);
  console.log(`     URL : ${(o.url || t.url).slice(0, 110)}`);
  if (o.loggedInHint) console.log(`     登录: ${o.loggedInHint}`);
  console.log('');
}

c.close();
