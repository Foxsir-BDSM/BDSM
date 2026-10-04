#!/usr/bin/env node
/**
 * tools/probe-old-db-write.mjs —— 探测 API Key 对旧库是否有写权限
 *
 * 安全性：只做「幂等写入」——把隐私字段写成它当前已有的值，
 *         成功与否都不改变任何记录的语义。
 */
import https from 'https';

const OLD = {
  label: '旧库',
  base: '0019555500b60c58',
  table: 'taRmZxGFzF5',
};
const NEW = {
  label: '新库',
  base: 'e7d18ead20743825',
  table: 't4d3B3XvKL8',
};

const { API_KEY } = await import('../src/shared/config/archive/api.js');

function req(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    r.setTimeout(20000, () => r.destroy(new Error('超时')));
    if (payload) r.write(payload);
    r.end();
  });
}

async function readFirst(db) {
  const r = await req(
    `https://tables.fillout.com/api/v1/bases/${db.base}/tables/${db.table}/records/list`,
    'POST', { limit: 1, offset: 0 });
  if (r.status !== 200) return { err: `HTTP ${r.status}` };
  const j = JSON.parse(r.body);
  const rec = (j.records || [])[0];
  return { total: j.total, rec };
}

console.log('════════ 写权限探测（幂等，不改数据）════════\n');

for (const db of [OLD, NEW]) {
  console.log(`── ${db.label} (${db.base} / ${db.table}) ──`);
  const { total, rec, err } = await readFirst(db);
  if (err) { console.log(`   读取失败: ${err}\n`); continue; }
  console.log(`   记录数: ${total}`);
  if (!rec) { console.log('   无记录，无法测写\n'); continue; }

  const fields = rec.fields || {};
  // 找几个布尔字段，用「写回原值」做幂等测试
  const boolKeys = Object.keys(fields).filter((k) => typeof fields[k] === 'boolean').slice(0, 3);
  const probe = {};
  boolKeys.forEach((k) => { probe[k] = fields[k]; });
  console.log(`   记录 ID: ${rec.id}`);
  console.log(`   幂等测试字段: ${JSON.stringify(probe)}`);

  if (Object.keys(probe).length === 0) { console.log('   无布尔字段可测\n'); continue; }

  const url = `https://tables.fillout.com/api/v1/bases/${db.base}/tables/${db.table}/records/${rec.id}`;
  for (const wrap of ['record', 'data', 'fields']) {
    const r = await req(url, 'PATCH', { [wrap]: probe });
    const brief = r.body.replace(/\s+/g, ' ').slice(0, 140);
    const ok = r.status === 200 || r.status === 204;
    console.log(`   PATCH {${wrap}:{...}} → ${r.status} ${ok ? '★ 可写' : brief}`);
    if (ok) break;
  }
  console.log('');
}

console.log('说明：');
console.log('  · 200/204 = 该 key 对该库可写');
console.log('  · 401/403 = 无写权限');
console.log('  · 400 且提示格式错误 = 需换 payload 形态');
