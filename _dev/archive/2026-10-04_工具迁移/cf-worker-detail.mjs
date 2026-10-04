#!/usr/bin/env node
/**
 * tools/cf-worker-detail.mjs —— 查看已有 Worker 的部署方式
 * 目的：判断该账号下建 Worker 的实际路径（界面 vs 命令行）
 */
import { connect, sleep } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ACCT = 'd348c97ce20de40e27c9073090c14d76';
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

const c = await connect(9222);
const tabs = await c.tabs();
const cf = tabs.find((t) => t.url.includes('dash.cloudflare.com'));
const s = await c.attach(cf.targetId);

const url = `https://dash.cloudflare.com/${ACCT}/workers/services/view/foxsir-supabase-proxy/production`;
console.log('════════ 查看 foxsir-supabase-proxy ════════\n');
console.log(`  导航到: ${url}\n`);

await c.goto(s, url, 14000);

// 等 SPA 渲染出主内容
for (let i = 0; i < 6; i++) {
  const len = await c.js(s, `(document.querySelector('main')?.innerText || document.body.innerText || '').length`);
  if (len > 1200) break;
  await sleep(2500);
}

const info = await c.js(s, `(function(){
  var main = document.querySelector('main') || document.body;
  var t = (main.innerText || '').replace(/\\s+/g,' ');
  var links = [];
  document.querySelectorAll('a[href]').forEach(function(a){
    var h = a.getAttribute('href')||'';
    if (/foxsir-supabase-proxy|deploy|settings|metrics|logs|code|edit/i.test(h)) {
      links.push((a.innerText||'').trim().replace(/\\s+/g,' ').slice(0,40) + '  →  ' + h.slice(0,90));
    }
  });
  return JSON.stringify({ text: t.slice(0, 1400), links: Array.from(new Set(links)).slice(0,20) });
})()`);

let o = {};
try { o = JSON.parse(info); } catch {}
console.log('  ── 主内容 ──');
console.log('  ' + (o.text || String(info)).slice(0, 1100).replace(/ /g, ' '));
if (o.links?.length) {
  console.log('\n  ── 相关链接 ──');
  o.links.forEach((l) => console.log('     ' + l));
}

const b64 = await c.shot(s);
fs.writeFileSync(path.join(OUT, 'cf-worker-detail.png'), Buffer.from(b64, 'base64'));
console.log('\n  ✅ 截图: .shots/runtime/cf-worker-detail.png');

c.close();
