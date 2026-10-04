#!/usr/bin/env node
/**
 * tools/verify-restructure.mjs —— 校验 fields.js 重构前后字段归属完全一致
 * 对比对象：tools/.fields-snapshot.json（重构前快照）
 */
import fs from 'node:fs';

const SNAP_FILE = 'tools/.fields-snapshot.json';
if (!fs.existsSync(SNAP_FILE)) {
  console.log('════════ 重构一致性校验 ════════\n');
  console.log('  ⏭  缺少重构前快照，跳过校验。\n');
  console.log('  本工具用于「改动 fields.js 的结构」时，证明字段归属一条没变。');
  console.log('  用法：');
  console.log('    1) 改结构前先做快照：node tools/snapshot-fields.mjs');
  console.log('    2) 改完结构后校验：  node tools/verify-restructure.mjs');
  process.exit(0);
}

const SNAP = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8'));
const F = await import('../src/shared/config/archive/fields.js');

let pass = 0; const fails = [];
const eq = (label, a, b) => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) { pass++; console.log(`  ✓ ${label}`); }
  else {
    fails.push(label);
    console.log(`  ✗ ${label}`);
    console.log(`      重构前: ${sa.slice(0, 200)}`);
    console.log(`      重构后: ${sb.slice(0, 200)}`);
  }
};

const sortedKeys = (o) => Object.keys(o).sort();
/** 对象按键排序后序列化，消除键顺序差异（键顺序无语义） */
const canon = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));

console.log('════════ 重构一致性校验 ════════\n');

console.log('── 一、字段对照区域 ──');
eq('FIELD_LABELS id 集合', sortedKeys(F.FIELD_LABELS), sortedKeys(SNAP.FIELD_LABELS));
eq('FIELD_LABELS 名称映射', canon(F.FIELD_LABELS), canon(SNAP.FIELD_LABELS));
eq('SYSTEM_FIELD_IDS', canon(F.SYSTEM_FIELD_IDS), canon(SNAP.SYSTEM_FIELD_IDS));

console.log('\n── 二、字段到页面的映射 ──');
eq('首页卡片 card', [...F.FIELDS_BY_PAGE.home.card], [...SNAP.FIELD_VISIBILITY.home_card]);
eq('详情页 visible', [...F.FIELDS_BY_PAGE.detail.visible], [...SNAP.FIELD_VISIBILITY.detail]);
eq('我的页面 editable', [...F.FIELDS_BY_PAGE.my.editable], [...SNAP.FIELD_VISIBILITY.self]);
eq('管理面板 editable', [...F.FIELDS_BY_PAGE.admin.editable], [...SNAP.FIELD_VISIBILITY.manage]);
eq('绑定 binding', [...F.FIELDS_BY_PAGE.my.binding], [...SNAP.FIELD_VISIBILITY.bind_only]);
eq('卡片槽位 slots', F.FIELDS_BY_PAGE.home.slots, SNAP.CARD_FIELDS);
eq('列表可见性 visibility', F.FIELDS_BY_PAGE.home.visibility, SNAP.VISIBILITY_FIELDS.publicQuestionnaire);

console.log('\n── 三、搜索规则 ──');
eq('SEARCH_FIELDS', [...F.SEARCH_FIELDS], [...SNAP.SEARCH_FIELDS]);

console.log('\n── 四、筛选规则 ──');
eq('FILTER_FIELDS', F.FILTER_FIELDS, SNAP.FILTER_FIELDS);
eq('5 个隐私开关 controlId', F.PRIVACY_CONTROL_IDS, SNAP.PRIVACY_SWITCHES ? Object.fromEntries(Object.entries(SNAP.PRIVACY_SWITCHES).map(([k, v]) => [k, v.controlId])) : {});
eq('隐私开关 controls 集合',
  Object.fromEntries(Object.entries(F.PRIVACY_SWITCHES).map(([k, v]) => [k, [...v.controls]])),
  Object.fromEntries(Object.entries(SNAP.PRIVACY_SWITCHES).map(([k, v]) => [k, [...v.controls]])));
eq('PRIVACY_RULES 条数', F.PRIVACY_RULES.length, SNAP.PRIVACY_SWITCHES ? Object.keys(SNAP.PRIVACY_SWITCHES).length : 0);
eq('PRIVACY_DEPENDENCIES', F.PRIVACY_DEPENDENCIES, Object.fromEntries(
  Object.entries(SNAP.PRIVACY_SWITCHES).flatMap(([, v]) => v.controls.map((id) => [id, v.controlId]))
));

console.log('\n── 五、详情页分组 ──');
// 旧版多一个 'privacy'（🔒 隐私设置）分组，内含 5 个隐私开关。
// 那 5 个开关从来不在详情页白名单内，该分组从未渲染过，故重构时移除。
// 这里改为：前 4 个分组逐一比对；第 5 个（若存在）必须只含隐私开关。
const NEW_GROUPS = F.DETAIL_GROUPS;
const OLD_GROUPS = SNAP.DETAIL_GROUPS;
const oldCore = OLD_GROUPS.filter((g) => g.id !== 'privacy');
eq('核心分组数（排除已废弃的 privacy 组）', NEW_GROUPS.length, oldCore.length);
oldCore.forEach((s, i) => {
  const g = NEW_GROUPS[i] || {};
  eq(`分组[${i}] id/title`, [g.id, g.title], [s.id, s.title]);
  eq(`分组[${i}] ${s.id} 字段`, [...(g.fields || [])], [...s.fields]);
});
const oldPrivacy = OLD_GROUPS.find((g) => g.id === 'privacy');
if (oldPrivacy) {
  const detailSet = new Set(F.FIELDS_BY_PAGE.detail.visible);
  const allUnrendered = oldPrivacy.fields.every((id) => !detailSet.has(id));
  eq('★ 已移除的 privacy 组内字段全都不在详情页白名单（故从未渲染）', allUnrendered, true);
}

console.log('\n── 六、角色可见性 ──');
eq('ROLE_FIELD_VISIBILITY 键', sortedKeys(F.ROLE_FIELD_VISIBILITY), sortedKeys(SNAP.ROLE_FIELD_VISIBILITY));

console.log('\n── 附、兼容旧名 ──');
eq('CARD_FIELDS', F.CARD_FIELDS, SNAP.CARD_FIELDS);
eq('VISIBILITY_FIELDS', F.VISIBILITY_FIELDS, SNAP.VISIBILITY_FIELDS);
eq('BINDING_FIELDS', F.BINDING_FIELDS, SNAP.BINDING_FIELDS);
eq('FIELD_VISIBILITY 兼容视图',
  Object.fromEntries(Object.entries(F.FIELD_VISIBILITY).map(([k, v]) => [k, [...v]])),
  SNAP.FIELD_VISIBILITY);

console.log('\n── 字段总数 ──');
const total = Object.keys(F.FIELD_LABELS).length + Object.keys(F.SYSTEM_FIELD_IDS).length;
eq('字段总数 59', total, 59);

console.log('\n───────────────────────────────');
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');
process.exit(fails.length ? 1 : 0);
