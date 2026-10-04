#!/usr/bin/env node
// tools/dump-field-assignments.mjs —— 导出当前 fields.js 的全部字段归属（重构用快照）
import fs from 'node:fs';

const F = await import('../src/shared/config/archive/fields.js');

const label = (id) => F.FIELD_LABELS[id] || F.SYSTEM_FIELD_IDS[id] || `(未命名:${id})`;

const out = {
  FIELD_LABELS: { ...F.FIELD_LABELS },
  SYSTEM_FIELD_IDS: { ...F.SYSTEM_FIELD_IDS },
  CARD_FIELDS: { ...F.CARD_FIELDS },
  VISIBILITY_FIELDS: { ...F.VISIBILITY_FIELDS },
  BINDING_FIELDS: { ...F.BINDING_FIELDS },
  SEARCH_FIELDS: [...F.SEARCH_FIELDS],
  FIELD_VISIBILITY: Object.fromEntries(
    Object.entries(F.FIELD_VISIBILITY).map(([k, v]) => [k, [...v]])
  ),
  DETAIL_GROUPS: F.DETAIL_GROUPS.map((g) => ({ id: g.id, title: g.title, fields: [...g.fields] })),
  FILTER_FIELDS: JSON.parse(JSON.stringify(F.FILTER_FIELDS)),
  PRIVACY_SWITCHES: Object.fromEntries(
    Object.entries(F.PRIVACY_SWITCHES).map(([k, v]) => [k, { ...v, controls: [...v.controls] }])
  ),
  ROLE_FIELD_VISIBILITY: Object.fromEntries(
    Object.entries(F.ROLE_FIELD_VISIBILITY).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])
  ),
};

fs.writeFileSync('tools/.fields-snapshot.json', JSON.stringify(out, null, 1), 'utf8');

console.log('════════ 当前字段归属快照 ════════\n');
console.log(`  FIELD_LABELS      ${Object.keys(F.FIELD_LABELS).length}`);
console.log(`  SYSTEM_FIELD_IDS  ${Object.keys(F.SYSTEM_FIELD_IDS).length}`);
console.log(`  合计              ${Object.keys(F.FIELD_LABELS).length + Object.keys(F.SYSTEM_FIELD_IDS).length}\n`);

console.log('  CARD_FIELDS:');
Object.entries(F.CARD_FIELDS).forEach(([k, v]) => console.log(`    ${k.padEnd(16)} ${v}  ${label(v)}`));

console.log('\n  VISIBILITY_FIELDS / BINDING_FIELDS:');
Object.entries({ ...F.VISIBILITY_FIELDS, ...F.BINDING_FIELDS }).forEach(([k, v]) => console.log(`    ${k.padEnd(20)} ${v}  ${label(v)}`));

console.log('\n  SEARCH_FIELDS:');
F.SEARCH_FIELDS.forEach((id) => console.log(`    ${id}  ${label(id)}`));

console.log('\n  FIELD_VISIBILITY:');
Object.entries(F.FIELD_VISIBILITY).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(12)} ${String(v.length).padStart(2)} 个`);
  v.forEach((id) => console.log(`        ${id}  ${label(id)}`));
});

console.log('\n  DETAIL_GROUPS:');
F.DETAIL_GROUPS.forEach((g) => {
  console.log(`    ${g.id.padEnd(16)} ${g.title}   ${g.fields.length} 个`);
});

console.log('\n  PRIVACY_SWITCHES:');
Object.entries(F.PRIVACY_SWITCHES).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(14)} ${v.controlId}  ${v.label}   → ${v.controls.length} 个`);
  v.controls.forEach((id) => console.log(`        ${id}  ${label(id)}`));
});

console.log('\n  ROLE_FIELD_VISIBILITY:');
Object.entries(F.ROLE_FIELD_VISIBILITY).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(12)} ${Array.isArray(v) ? v.length + ' 个字段' : v}`);
});

console.log('\n  ✅ 快照已写入 tools/.fields-snapshot.json');
