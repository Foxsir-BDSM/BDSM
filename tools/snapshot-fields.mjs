#!/usr/bin/env node
/**
 * tools/snapshot-fields.mjs —— 为 fields.js 做字段归属快照
 *
 * 用途：在「改动 fields.js 的结构」之前先跑一次，改完再用
 *       tools/verify-restructure.mjs 证明字段归属一条没变。
 *
 * 用法：
 *   1) node tools/snapshot-fields.mjs      # 改结构前
 *   2) （改 fields.js 的结构）
 *   3) node tools/verify-restructure.mjs   # 改结构后校验
 *
 * 快照是临时产物，校验通过后可删：tools/.fields-snapshot.json
 */
import fs from 'node:fs';

const F = await import('../src/shared/config/archive/fields.js');

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

const FILE = 'tools/.fields-snapshot.json';
fs.writeFileSync(FILE, JSON.stringify(out, null, 1), 'utf8');

const total = Object.keys(F.FIELD_LABELS).length + Object.keys(F.SYSTEM_FIELD_IDS).length;
console.log('════════ 字段归属快照 ════════\n');
console.log(`  FIELD_LABELS      ${Object.keys(F.FIELD_LABELS).length}`);
console.log(`  SYSTEM_FIELD_IDS  ${Object.keys(F.SYSTEM_FIELD_IDS).length}`);
console.log(`  合计              ${total}`);
console.log(`  详情页白名单      ${F.FIELDS_BY_PAGE.detail.visible.length}`);
console.log(`  首页卡片          ${F.FIELDS_BY_PAGE.home.card.length}`);
console.log(`  我的页面可编辑    ${F.FIELDS_BY_PAGE.my.editable.length}`);
console.log(`  管理面板可编辑    ${F.FIELDS_BY_PAGE.admin.editable.length}`);
console.log(`  隐私开关          ${Object.keys(F.PRIVACY_SWITCHES).length}`);
console.log(`  详情页分组        ${F.DETAIL_GROUPS.length}`);
console.log(`\n  ✅ 已写入 ${FILE}`);
console.log('     改完 fields.js 后用 node tools/verify-restructure.mjs 校验');
