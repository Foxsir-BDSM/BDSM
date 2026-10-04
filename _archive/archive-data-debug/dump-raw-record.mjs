#!/usr/bin/env node
/**
 * tools/dump-raw-record.mjs —— dump 新库原始记录结构（只读）
 */
import https from 'https';

const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d)); });
    r.on('error', reject);
    r.write(payload); r.end();
  });
}

const raw = await post(
  `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`,
  { limit: 3, offset: 0 });

const j = JSON.parse(raw);
console.log('════════ 新库原始响应结构 ════════\n');
console.log('  顶层键: ' + Object.keys(j).join(', '));
console.log('  total=' + j.total + '  hasMore=' + j.hasMore);
console.log('\n  ── 第 1 条记录完整 JSON ──');
console.log(JSON.stringify(j.records[0], null, 1).slice(0, 2500));

console.log('\n  ── 各记录字段键数量 ──');
(j.records || []).forEach((r, i) => {
  const fk = Object.keys(r.fields || {});
  console.log(`   [${i}] id=${String(r.id).slice(0, 8)}  fields 键数=${fk.length}  ${fk.length ? fk.slice(0, 6).join(', ') : '(空对象)'}`);
  // 也看看记录顶层还有没有别的键
  const topKeys = Object.keys(r).filter((k) => k !== 'fields');
  if (topKeys.length) console.log(`        顶层其他键: ${topKeys.join(', ')}`);
});

// ── 对比：旧库是什么样
console.log('\n════════ 对比：旧库原始记录 ════════\n');
const oldRaw = await post(
  'https://tables.fillout.com/api/v1/bases/0019555500b60c58/tables/taRmZxGFzF5/records/list',
  { limit: 1, offset: 0 });
const oj = JSON.parse(oldRaw);
const orec = (oj.records || [])[0];
if (orec) {
  const fk = Object.keys(orec.fields || {});
  console.log(`  旧库记录 fields 键数=${fk.length}`);
  console.log('  前 8 个键: ' + fk.slice(0, 8).join(', '));
  console.log('\n  样例值:');
  fk.slice(0, 6).forEach((k) => console.log(`    ${k} = ${JSON.stringify(orec.fields[k]).slice(0, 80)}`));
} else {
  console.log('  旧库无记录');
}
