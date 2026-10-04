#!/usr/bin/env node
/**
 * tools/diag-gh-nav.mjs —— 看导航到 GitHub API 到底返回了什么
 */
import { connect } from './cdp.mjs';

const c = await connect(9222);
const tabs = await c.tabs();
const gh = tabs.find((t) => t.url.includes('github.com'));
const s = await c.attach(gh.targetId);

const url = 'https://api.github.com/repos/Foxsir-BDSM/foxsir-content';
console.log(`  导航到: ${url}\n`);
await c.goto(s, url, 6000);

console.log('  location : ' + await c.js(s, 'location.href'));
console.log('  title    : ' + await c.js(s, 'document.title'));
console.log('  readyState: ' + await c.js(s, 'document.readyState'));

const txt = await c.js(s, 'document.body ? document.body.innerText : "(无 body)"');
console.log('\n  ── 正文（前 600 字）──');
console.log(String(txt).slice(0, 600).split('\n').map((l) => '    ' + l).join('\n'));

const html = await c.js(s, 'document.documentElement.outerHTML.length');
console.log(`\n  HTML 长度: ${html}`);

c.close();
