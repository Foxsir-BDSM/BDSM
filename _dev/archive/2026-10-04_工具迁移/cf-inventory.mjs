#!/usr/bin/env node
/**
 * tools/cf-inventory.mjs —— 盘点 Cloudflare 账号里已有的资源
 * 只读：只导航与读取，不创建、不修改
 */
import { connect, sleep } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ACCT = 'd348c97ce20de40e27c9073090c14d76';
const BASE = `https://dash.cloudflare.com/${ACCT}`;
const OUT = path.join(process.cwd(), '.shots', 'runtime');
fs.mkdirSync(OUT, { recursive: true });

const c = await connect(9222);
const tabs = await c.tabs();
const cf = tabs.find((t) => t.url.includes('dash.cloudflare.com'));
const s = await c.attach(cf.targetId);

const visit = async (url, label, waitMs = 9000) => {
  console.log(`\n── ${label} ──`);
  await c.goto(s, url, waitMs);
  const info = await c.js(s, `(function(){
    var t = (document.body.innerText||'').replace(/\\s+/g,' ');
    // 抓取表格行与按钮文案
    var btns = [];
    document.querySelectorAll('button,a[role=button],[type=submit]').forEach(function(b){
      var x=(b.innerText||'').trim().replace(/\\s+/g,' ');
      if (x && x.length<30) btns.push(x);
    });
    return JSON.stringify({
      url: location.href,
      text: t.slice(0, 700),
      buttons: Array.from(new Set(btns)).slice(0, 22)
    });
  })()`);
  let o = {};
  try { o = JSON.parse(info); } catch { o = { text: String(info) }; }
  console.log(`   URL : ${(o.url || url).slice(0, 110)}`);
  console.log(`   文字: ${(o.text || '').slice(0, 380)}`);
  if (o.buttons?.length) console.log(`   按钮: ${o.buttons.join(' | ')}`);
  const b64 = await c.shot(s);
  fs.writeFileSync(path.join(OUT, `cf-${label}.png`), Buffer.from(b64, 'base64'));
  return o;
};

await visit(`${BASE}/workers/d1`, 'D1');
await visit(`${BASE}/r2/overview`, 'R2');
await visit(`${BASE}/workers-and-pages`, 'Workers');

console.log('\n════════ 截图已保存到 .shots/runtime/ ════════');
c.close();
