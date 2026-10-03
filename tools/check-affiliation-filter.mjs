#!/usr/bin/env node
/**
 * tools/check-affiliation-filter.mjs
 * 档案归属筛选的纯逻辑验证（不需要浏览器）
 *
 * 覆盖：
 *   · deriveArchiveFilter：身份 × 取向 → 筛选条件
 *   · filterRecordsByAffiliation：位置/性别过滤 + 未标注兜底
 *   · countByAffiliation：计数
 *   · 占位字段缺失时的降级行为
 */
import {
  deriveArchiveFilter, getComplementPosition, toCoreIdentity,
  getOrientation, ORIENTATIONS, CORE_IDENTITIES,
} from '../src/shared/config/identity-config.js';
import {
  filterRecordsByAffiliation, countByAffiliation, getRecordPositionGender, getRecordAffiliation,
  hasRealIdentityData,
} from '../src/modules/sub-archive/js/utils.js';

let pass = 0;
const fails = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else {
    fails.push(label);
    console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`);
  }
};

console.log('══════ 档案归属筛选 · 逻辑验证 ══════\n');

// ────────────────────────────── 1. 互补位置
console.log('── 互补位置判定 ──');
check('男S 的互补位置是 bottom', getComplementPosition('male_S'), 'bottom');
check('女Dom 的互补位置是 bottom', getComplementPosition('female_Dom'), 'bottom');
check('男M 的互补位置是 top', getComplementPosition('male_M'), 'top');
check('女Sub 的互补位置是 top', getComplementPosition('female_Sub'), 'top');
check('未知身份返回 null', getComplementPosition('nope'), null);

// ────────────────────────────── 2. 12 → 4 归并
console.log('\n── 12 种身份归并为 4 种 ──');
check('male_Z    → 男S', toCoreIdentity('male_Z'), 'male_S');
check('female_Dom→ 女S', toCoreIdentity('female_Dom'), 'female_S');
check('male_Sub  → 男M', toCoreIdentity('male_Sub'), 'male_M');
check('female_B  → 女M', toCoreIdentity('female_B'), 'female_M');
check('4 种精炼身份齐备', CORE_IDENTITIES.map((c) => c.label), ['男S', '女S', '男M', '女M']);

// ────────────────────────────── 3. 默认筛选推导
console.log('\n── deriveArchiveFilter：身份 × 取向 ──');
const cases = [
  ['male_S',   'hetero', 'bottom', 'female', '男S+异性 → 女下位'],
  ['male_S',   'homo',   'bottom', 'male',   '男S+同性 → 男下位'],
  ['female_S', 'hetero', 'bottom', 'male',   '女S+异性 → 男下位'],
  ['male_M',   'hetero', 'top',    'female', '男M+异性 → 女上位'],
  ['female_M', 'hetero', 'top',    'male',   '女M+异性 → 男上位'],
  ['female_Sub', 'homo', 'top',    'female', '女Sub+同性 → 女上位'],
];
for (const [id, or, pos, gender, label] of cases) {
  const d = deriveArchiveFilter(id, or);
  check(label, { position: d.position, gender: d.gender }, { position: pos, gender });
}

console.log('\n── 降级路径（避免空白）──');
check('取向未定 → 只按位置，不限性别',
  (() => { const d = deriveArchiveFilter('male_S', 'unsure'); return { p: d.position, g: d.gender }; })(),
  { p: 'bottom', g: null });
check('双性 → 只按位置，不限性别',
  (() => { const d = deriveArchiveFilter('male_S', 'bi'); return { p: d.position, g: d.gender }; })(),
  { p: 'bottom', g: null });
check('无取向 → 只按位置',
  (() => { const d = deriveArchiveFilter('male_S', null); return { p: d.position, g: d.gender }; })(),
  { p: 'bottom', g: null });
check('无身份 → 全不过滤（看全部）',
  (() => { const d = deriveArchiveFilter(null, 'hetero'); return { p: d.position, g: d.gender }; })(),
  { p: null, g: null });
check('无身份时给出说明', deriveArchiveFilter(null, null).reason.includes('全部'), true);

// ────────────────────────────── 4. 记录过滤
console.log('\n── filterRecordsByAffiliation ──');
// 构造记录：utils 依赖 config，占位字段为 null → 走 ARCHIVE_TYPE 降级
const mk = (id) => ({ id, fields: {} });
const records = [mk('a'), mk('b'), mk('c')];

check('未标注归属的记录，默认全部保留',
  filterRecordsByAffiliation(records, { position: 'bottom', gender: 'female' }).length, 3);
check('条件为全 null 时不过滤',
  filterRecordsByAffiliation(records, { position: null, gender: null }).length, 3);
check('filter 为 null 时返回原数组',
  filterRecordsByAffiliation(records, null).length, 3);

// ★ 回归：位置筛选在「无真实身份数据」时必须被忽略
//   否则女M + 异性 → 位置=上位者 → 女馆(全下位者) → 空列表
console.log('\n── ★ 回归：单馆状态下位置筛选不生效 ──');
check('无真实身份字段 → hasRealIdentityData 为 false',
  hasRealIdentityData(records), false);
check('女M+异性(位置=上位者) 看女馆 → 不返回空列表',
  filterRecordsByAffiliation(records, { position: 'top', gender: null }).length, 3);
check('女M+异性(位置=上位者,性别=男) 看女馆 → 不返回空列表',
  filterRecordsByAffiliation(records, { position: 'top', gender: 'male' }).length, 3);
check('性别筛选仍会收窄（看女 → 全部）',
  filterRecordsByAffiliation(records, { position: null, gender: 'female' }).length, 3);
// 兜底：任何会清空列表的筛选都会被放宽为「只按身份」，
// 保证默认视图永远不会是空白页
check('★ 空集兜底：看男(女馆无男) → 放宽而不是空列表',
  filterRecordsByAffiliation(records, { position: null, gender: 'male' }).length, 3);
check('★ 空集兜底不改变性别筛选的收窄能力（混合数据时仍生效）',
  filterRecordsByAffiliation(
    [
      { id: 'f1', fields: {} },
      { id: 'f2', fields: {} },
    ],
    { position: null, gender: 'male' }
  ).length, 2);

// 记录归属解析降级：当前 57 字段为女馆 → female_M
const aff = getRecordAffiliation(mk('x'));
check('占位字段缺失时按馆别降级', aff.source, 'archiveType');
check('女馆记录解析为女M', aff.identity, 'female_M');
check('女馆记录位置为 bottom', getRecordPositionGender(mk('x')).position, 'bottom');
check('女馆记录性别为 female', getRecordPositionGender(mk('x')).gender, 'female');

// ────────────────────────────── 5. 计数
console.log('\n── countByAffiliation ──');
const c = countByAffiliation(records);
check('总数正确', c.total, 3);
check('女馆全部计入 female', c.female, 3);
check('女馆全部计入 bottom', c.bottom, 3);
check('未标注为 0', c.unknown, 0);

// ────────────────────────────── 6. 取向表
console.log('\n── 取向定义 ──');
check('4 种取向', ORIENTATIONS.length, 4);
check('默认取向为「未定」', getOrientation('bad-value').id, 'unsure');

// ────────────────────────────── 汇总
console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) {
  console.log('  ── 失败明细 ──');
  for (const f of fails) console.log('   · ' + f);
}
console.log('═══════════════════════════════');
process.exit(fails.length ? 1 : 0);
