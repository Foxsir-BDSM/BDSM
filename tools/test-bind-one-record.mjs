#!/usr/bin/env node
/**
 * tools/test-bind-one-record.mjs
 * 临时把一条记录的「电子邮件」绑定到测试账号，用于验证我的页面隐私面板。
 *
 *   node tools/test-bind-one-record.mjs --record <id前8位> --email <邮箱>
 *   node tools/test-bind-one-record.mjs --unbind  <id前8位>
 *
 * ⚠️ 会真实修改数据库。默认只改「电子邮件」一个字段。
 */
import https from 'https';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const prefix = get('--record', '');
const email = get('--email', '');
const unbind = args.includes('--unbind');

const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');
const { BINDING_FIELDS } = await import('../src/shared/config/archive/fields.js');

const req = (url, method, body) => new Promise((res, rej) => {
  const u = new URL(url); const p = body ? JSON.stringify(body) : null;
  const r = https.request({ hostname: u.hostname, path: u.pathname, method,
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json',
      ...(p ? { 'Content-Length': Buffer.byteLength(p) } : {}) } },
    (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => res({ status: x.statusCode, body: d })); });
  r.on('error', rej); if (p) r.write(p); r.end();
});

if (!prefix) { console.error('用法: --record <id前8位> --email <邮箱>  |  --unbind <id前8位>'); process.exit(1); }

const list = await req(
  `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`, 'POST',
  { limit: 100, offset: 0 });
const j = JSON.parse(list.body);
const full = j.records.find((r) => String(r.id).startsWith(prefix));
if (!full) { console.error(`未找到以 ${prefix} 开头的记录`); process.exit(1); }

console.log('════════ 绑定测试记录 ════════\n');
console.log(`  记录: ${full.id}`);
console.log(`  姓名: ${(full.data || {})['fkHpgmVVTg7']}`);

const value = unbind ? '' : email;
console.log(`  操作: 把「电子邮件」(${BINDING_FIELDS.email}) 设为 ${JSON.stringify(value)}\n`);

const r = await req(
  `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/${full.id}`,
  'PATCH', { record: { [BINDING_FIELDS.email]: value } });

console.log(`  HTTP ${r.status}`);
if (r.status === 200 || r.status === 204) {
  console.log('  ✅ 绑定成功');
  // 回读确认
  const back = await req(
    `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`, 'POST',
    { limit: 100, offset: 0 });
  const bj = JSON.parse(back.body);
  const rec = bj.records.find((x) => x.id === full.id);
  console.log(`  回读「电子邮件」= ${JSON.stringify((rec.data || {})[BINDING_FIELDS.email])}`);
} else {
  console.log('  响应: ' + r.body.slice(0, 300));
}
