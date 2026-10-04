#!/usr/bin/env node
/**
 * tools/probe.mjs —— 启动方式探测
 * 对一个基址发起一系列请求，报告每个 URL 的真实状态，用于判断哪种启动方式可用。
 *
 *   node tools/probe.mjs --port 5173 --label "vite dev"
 */

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const PORT = Number(get('--port', 5173));
const LABEL = get('--label', 'server');
const BASE = `http://127.0.0.1:${PORT}`;

/** [路径, 说明] */
const URLS = [
  ['/', '站点根'],
  ['/index.html', '控制中心（启动器）'],
  ['/landing.html', '引导页'],
  ['/about.html', '用户指南'],
  ['/auth.html', '登录注册'],
  ['/admin.html', '管理后台'],
  ['/modules/sub-archive/', '档案馆·目录式'],
  ['/modules/sub-archive/index.html', '档案馆·显式'],
  ['/modules/sub-archive/detail.html', '档案馆详情'],
  ['/modules/knowledge/', '知识区·目录式'],
  ['/modules/knowledge/index.html', '知识区·显式'],
  ['/modules/mission/index.html', '任务区'],
  ['/shared/js/auth.js', '共享 JS（源码）'],
  ['/shared/css/main.css', '共享 CSS（源码）'],
  ['/shared/assets/images/OIP-C.jpg', '共享图片'],
  ['/modules/sub-archive/css/global.css', '模块 CSS'],
  ['/modules/sub-archive/js/home.js', '模块 JS'],
  ['/@/shared/js/auth.js', '别名形式（不应可用）'],
];

const results = [];
for (const [p, desc] of URLS) {
  let status = 0;
  let note = '';
  try {
    const res = await fetch(BASE + p, { redirect: 'manual' });
    status = res.status;
    const ct = res.headers.get('content-type') || '';
    const body = status === 200 ? await res.text() : '';
    if (status === 200) {
      if (/html/.test(ct)) {
        const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || '(无 title)';
        note = `HTML  «${title.trim()}»`;
      } else if (/javascript/.test(ct)) note = 'JS 模块';
      else if (/css/.test(ct)) note = 'CSS';
      else if (/image/.test(ct)) note = 'IMG';
      else note = ct.split(';')[0];
    } else {
      note = (await res.text()).slice(0, 60).replace(/\s+/g, ' ');
    }
  } catch (err) {
    status = -1;
    note = err.message;
  }
  const mark = status === 200 ? '✓' : status === -1 ? '✗' : '·';
  results.push({ p, desc, status, mark, note });
  console.log(`  ${mark} ${String(status).padStart(4)}  ${p.padEnd(38)} ${desc}${note ? '  — ' + note : ''}`);
}

const ok = results.filter((r) => r.status === 200).length;
console.log(`\n  [${LABEL}] ${BASE}  可访问 ${ok}/${results.length}`);
