#!/usr/bin/env node
// tools/probe-record-emails.mjs —— 查看新库记录里的绑定邮箱（只读）
import https from 'https';
const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');
const { BINDING_FIELDS, CARD_FIELDS, getFieldsFor } = await import('../src/shared/config/archive/fields.js');

const post = (url, body) => new Promise((res, rej) => {
  const u = new URL(url); const p = JSON.stringify(body);
  const r = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } },
    (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => res(JSON.parse(d))); });
  r.on('error', rej); r.write(p); r.end();
});

const j = await post(
  `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`,
  { limit: 100, offset: 0 });

console.log('════════ 记录绑定邮箱 ════════\n');
console.log(`  邮箱字段 ID: ${BINDING_FIELDS.email}`);
console.log(`  名称字段 ID: ${BINDING_FIELDS.name}\n`);

const rows = j.records.map((r) => {
  const d = r.data || r.fields || {};
  return {
    id: String(r.id).slice(0, 8),
    email: d[BINDING_FIELDS.email],
    name: d[BINDING_FIELDS.name],
    realName: d[CARD_FIELDS.name],
    verified: d[CARD_FIELDS.verified],
  };
});

const withEmail = rows.filter((r) => typeof r.email === 'string' && r.email.trim());
console.log(`  记录总数: ${rows.length}   有邮箱: ${withEmail.length}\n`);
rows.slice(0, 20).forEach((r) => {
  console.log(`  ${r.id}  邮箱=${JSON.stringify(r.email)}  名称=${JSON.stringify(r.name)}  姓名=${JSON.stringify(r.realName)}  认证=${JSON.stringify(r.verified)}`);
});

console.log('\n  可用邮箱（前 5 个，可用于绑定测试）:');
withEmail.slice(0, 5).forEach((r) => console.log(`    ${r.email}`));

console.log('\n  隐私开关字段清单（self 区域）:');
getFieldsFor('self').forEach((id) => console.log(`    ${id}`));
