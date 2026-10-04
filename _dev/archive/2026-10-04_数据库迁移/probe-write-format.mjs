#!/usr/bin/env node
// tools/probe-write-format.mjs —— 探测 Tables API 的写入格式（只探测，不保留数据）
import https from 'https';

const API_KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const BASE = 'e7d18ead20743825';
const TABLE = 't4d3B3XvKL8';

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
    r.setTimeout(15000, () => r.destroy(new Error('超时')));
    if (payload) r.write(payload);
    r.end();
  });
}

const FIELDS = { fwz4nCDQfZH: '女M', fkHpgmVVTg7: 'ZZ探测', f57DddbxHNc: '25' };

const URLS = [
  `https://tables.fillout.com/api/v1/bases/${BASE}/tables/${TABLE}/records`,
  `https://tables.fillout.com/api/v1/bases/${BASE}/tables/${TABLE}/records/create`,
];

const BODIES = [
  ['{data:{fields}}', { data: { fields: FIELDS } }],
  ['{data:FIELDS}', { data: FIELDS }],
  ['{fields}', { fields: FIELDS }],
  ['FIELDS', FIELDS],
  ['{records:[{fields}]}', { records: [{ fields: FIELDS }] }],
];

console.log('════════ 探测写入格式 ════════\n');
for (const url of URLS) {
  console.log(`── ${url.replace('https://tables.fillout.com/api/v1', '')} ──`);
  for (const [label, body] of BODIES) {
    const r = await req(url, 'POST', body);
    const brief = r.body.replace(/\s+/g, ' ').slice(0, 130);
    console.log(`  ${String(r.status).padEnd(4)} ${label.padEnd(24)} ${r.status === 200 || r.status === 201 ? '★ 成功' : brief}`);
    if (r.status === 200 || r.status === 201) {
      console.log('\n  ✅ 可用格式: ' + label + '  @  ' + url);
      console.log('  响应: ' + r.body.slice(0, 300));
      process.exit(0);
    }
  }
  console.log('');
}
console.log('❌ 全部格式均失败 —— 该 API Key 可能只有读权限');
