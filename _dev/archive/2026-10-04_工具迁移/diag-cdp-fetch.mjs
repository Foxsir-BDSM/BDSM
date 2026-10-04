#!/usr/bin/env node
/**
 * tools/diag-cdp-fetch.mjs —— 诊断 CDP 里执行 fetch 的可行性
 */
import { connect, sleep } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const gh = tabs.find((t) => t.url.includes('github.com'));
console.log(`  目标标签: ${gh.url.slice(0, 70)}\n`);
const s = await c.attach(gh.targetId);

// 1. 最简单表达式
console.log('── 1. 基础表达式 ──');
const t1 = Date.now();
const r1 = await c.js(s, '1+1');
console.log(`  1+1 = ${JSON.stringify(r1)}   (${Date.now() - t1}ms)`);

const t2 = Date.now();
const r2 = await c.js(s, 'location.hostname');
console.log(`  hostname = ${JSON.stringify(r2)}   (${Date.now() - t2}ms)`);

// 2. async IIFE（awaitPromise）
console.log('\n── 2. async IIFE ──');
const t3 = Date.now();
const r3 = await c.js(s, `(async function(){ return 'ok-async'; })()`);
console.log(`  结果 = ${JSON.stringify(r3)}   (${Date.now() - t3}ms)`);

// 3. 同源 fetch
console.log('\n── 3. 同源 fetch（github.com）──');
const t4 = Date.now();
const r4 = await c.js(s, `(async function(){
  try {
    var r = await fetch('https://github.com/Foxsir-BDSM/foxsir-content', { credentials:'include' });
    return 'status=' + r.status;
  } catch(e) { return 'err: ' + e.message; }
})()`, 40000);
console.log(`  结果 = ${JSON.stringify(r4)}   (${Date.now() - t4}ms)`);

// 4. 跨域 fetch（api.github.com）
console.log('\n── 4. 跨域 fetch（api.github.com）──');
const t5 = Date.now();
const r5 = await c.js(s, `(async function(){
  try {
    var r = await fetch('https://api.github.com/repos/Foxsir-BDSM/foxsir-content', {
      headers: { 'Accept': 'application/vnd.github+json' },
      credentials: 'include'
    });
    var t = await r.text();
    return 'status=' + r.status + ' len=' + t.length;
  } catch(e) { return 'err: ' + e.message; }
})()`, 40000);
console.log(`  结果 = ${JSON.stringify(r5)}   (${Date.now() - t5}ms)`);

// 5. 跨域 + 无 credentials
console.log('\n── 5. 跨域 fetch（不带 credentials）──');
const t6 = Date.now();
const r6 = await c.js(s, `(async function(){
  try {
    var r = await fetch('https://api.github.com/repos/Foxsir-BDSM/foxsir-content', {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    var t = await r.text();
    return 'status=' + r.status + ' len=' + t.length;
  } catch(e) { return 'err: ' + e.message; }
})()`, 40000);
console.log(`  结果 = ${JSON.stringify(r6)}   (${Date.now() - t6}ms)`);

c.close();
