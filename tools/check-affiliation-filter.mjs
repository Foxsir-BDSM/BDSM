#!/usr/bin/env node
/**
 * tools/check-affiliation-filter.mjs
 * 档案归属筛选的纯逻辑验证（不需要浏览器）
 *
 * 覆盖两种运行状态：
 *   A. 字段未建（filloutId 为 null）—— 降级路径
 *   B. 字段已建（临时注入 field id）—— 真实筛选行为
 *
 * 设计定稿：取向维度已取消，筛选仅按身份。
 */
import fs from 'node:fs';
import path from 'node:path';

// 注入测试用 field id，再动态导入被测模块（ESM 只求值一次）
//
// ⚠️ 这里用「正则匹配 filloutId 赋值」而不是写死整行文本。
//    此前写死整行，fields.js 里那行加了个反引号就导致替换静默失效，
//    测试降级成「字段未建」分支却依然全绿 —— 断言数从 51 掉到 42 才被发现。
const CFG = 'src/shared/config/archive/fields.js';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfgPath = path.join(ROOT, CFG);
const original = fs.readFileSync(cfgPath, 'utf8');
const identityFieldPattern = /(filloutId:\s*)(['"`])f\w+\2(\s*,)/;
if (!identityFieldPattern.test(original)) {
  console.error('❌ 无法在 fields.js 中定位 filloutId 赋值 —— 测试的注入逻辑需要更新');
  console.error('   （不要放任它静默降级，否则会假绿）');
  process.exit(2);
}
const patched = original.replace(identityFieldPattern, "$1'fTEST_IDENTITY'$3");
const withFields = patched !== original;
if (withFields) fs.writeFileSync(cfgPath, patched, 'utf8');

const cleanup = () => { if (withFields) fs.writeFileSync(cfgPath, original, 'utf8'); };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

const {
  deriveArchiveFilter, getComplementPosition, migrateIdentity, isLegacyIdentity,
  IDENTITIES, getIdentityById, getRoleTitle, getGender,
} = await import('../src/shared/config/identity-config.js');

const {
  filterRecordsByAffiliation, countByAffiliation, getRecordPositionGender,
  getRecordAffiliation, hasRealIdentityData,
} = await import('../src/modules/sub-archive/js/utils.js');

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

console.log('══════ 档案归属筛选 · 逻辑验证 ══════');
console.log(`（运行状态：${withFields ? 'B · 字段已建' : 'A · 字段未建'}）\n`);

// ────────────────────────────── 1. 身份模型
console.log('── 身份模型（4 种，无取向）──');
check('身份共 4 种', IDENTITIES.length, 4);
check('身份清单', IDENTITIES.map((i) => i.id), ['male_S', 'female_S', 'male_M', 'female_M']);
check('标签正确', IDENTITIES.map((i) => i.label), ['男S', '女S', '男M', '女M']);
check('已无 Dom/Z/Sub/B', IDENTITIES.some((i) => /Dom|_Z|Sub|_B/.test(i.id)), false);
check('身份自带性别', getGender('female_M'), 'female');

console.log('\n── 旧身份归并（兼容已注册用户）──');
check('male_Dom → male_S', migrateIdentity('male_Dom'), 'male_S');
check('female_Sub → female_M', migrateIdentity('female_Sub'), 'female_M');
check('male_B → male_M', migrateIdentity('male_B'), 'male_M');
check('male_Z → male_S', migrateIdentity('male_Z'), 'male_S');
check('新值原样返回', migrateIdentity('female_S'), 'female_S');
check('未知值返回 null', migrateIdentity('nope'), null);
check('male_Dom 是旧身份', isLegacyIdentity('male_Dom'), true);
check('male_S 不是旧身份', isLegacyIdentity('male_S'), false);
check('旧值也能查到定义', getIdentityById('female_Sub')?.label, '女M');

console.log('\n── 角色（仅主/奴）──');
check('男S → 主', getRoleTitle('male_S'), '主');
check('女S → 主', getRoleTitle('female_S'), '主');
check('男M → 奴', getRoleTitle('male_M'), '奴');
check('女M → 奴', getRoleTitle('female_M'), '奴');
check('旧值 female_Sub → 奴', getRoleTitle('female_Sub'), '奴');
check('无身份 → 空', getRoleTitle(null), '');

// ────────────────────────────── 2. 互补位置与筛选推导
console.log('\n── 互补位置 ──');
check('男S 的互补是 bottom', getComplementPosition('male_S'), 'bottom');
check('女M 的互补是 top', getComplementPosition('female_M'), 'top');
check('旧值 female_Dom 的互补是 bottom', getComplementPosition('female_Dom'), 'bottom');

console.log('\n── deriveArchiveFilter：仅按身份 ──');
const cases = [
  ['male_S',   'bottom', '男S → 默认看 M 侧'],
  ['female_S', 'bottom', '女S → 默认看 M 侧'],
  ['male_M',   'top',    '男M → 默认看 S 侧'],
  ['female_M', 'top',    '女M → 默认看 S 侧'],
  ['female_Sub', 'top',  '旧值女Sub → 默认看 S 侧'],
];
for (const [id, pos, label] of cases) {
  const d = deriveArchiveFilter(id);
  check(label, { position: d.position, gender: d.gender }, { position: pos, gender: null });
}

console.log('\n── 降级路径 ──');
check('无身份 → 全不过滤',
  (() => { const d = deriveArchiveFilter(null); return { p: d.position, g: d.gender }; })(),
  { p: null, g: null });
check('无身份时说明含「全部」', deriveArchiveFilter(null).reason.includes('全部'), true);
check('有效身份的说明含「默认展示」', deriveArchiveFilter('male_S').reason.includes('默认展示'), true);
check('gender 恒为 null（维度已取消）', deriveArchiveFilter('female_M').gender, null);

// ────────────────────────────── 3. 记录归属解析
console.log('\n── 记录归属解析 ──');
const rec = (id, fields = {}) => ({ id, fields });

if (withFields) {
  const r1 = rec('a', { fTEST_IDENTITY: '女M' });
  check('表单「女M」→ female_M', getRecordAffiliation(r1).identity, 'female_M');
  check('位置解析为 bottom', getRecordPositionGender(r1).position, 'bottom');
  check('性别解析为 female', getRecordPositionGender(r1).gender, 'female');
  check('来源标记为 form', getRecordAffiliation(r1).source, 'form');
  check('容错：小写「女m」', getRecordAffiliation(rec('b', { fTEST_IDENTITY: '女m' })).identity, 'female_M');
  check('容错：英文 male_S', getRecordAffiliation(rec('c', { fTEST_IDENTITY: 'male_S' })).identity, 'male_S');
  check('容错：「男S」', getRecordAffiliation(rec('d', { fTEST_IDENTITY: '男S' })).identity, 'male_S');
  check('空值 → null', getRecordAffiliation(rec('e', {})).identity, null);
  check('无法识别 → null', getRecordAffiliation(rec('f', { fTEST_IDENTITY: '????' })).identity, null);
  check('hasRealIdentityData 为 true', hasRealIdentityData([r1]), true);
} else {
  const r1 = rec('a', { anything: '女M' });
  check('字段未建时身份为 null', getRecordAffiliation(r1).identity, null);
  check('字段未建时来源 unknown', getRecordAffiliation(r1).source, 'unknown');
  check('字段未建时位置为 null', getRecordPositionGender(r1).position, null);
  check('hasRealIdentityData 为 false', hasRealIdentityData([r1]), false);
}

// ────────────────────────────── 4. 过滤行为
console.log('\n── filterRecordsByAffiliation ──');
const three = [rec('a'), rec('b'), rec('c')];
check('filter 为 null 时返回原数组', filterRecordsByAffiliation(three, null).length, 3);
check('条件全 null 时不过滤', filterRecordsByAffiliation(three, { position: null, gender: null }).length, 3);

if (withFields) {
  const labeled = [
    rec('f1', { fTEST_IDENTITY: '女M' }),
    rec('m1', { fTEST_IDENTITY: '男M' }),
    rec('f2', { fTEST_IDENTITY: '女S' }),
    rec('m2', { fTEST_IDENTITY: '男S' }),
  ];
  const mixed = [...labeled, rec('u1', {})];

  check('只看 M 侧 → 2 条', filterRecordsByAffiliation(labeled, { position: 'bottom', gender: null }).length, 2);
  check('只看 S 侧 → 2 条', filterRecordsByAffiliation(labeled, { position: 'top', gender: null }).length, 2);
  check('★ 未标注记录始终保留（M 侧 → 2+1）',
    filterRecordsByAffiliation(mixed, { position: 'bottom', gender: null }).length, 3);
  check('未标注单独过滤时也保留',
    filterRecordsByAffiliation([rec('u', {})], { position: 'top', gender: null }).length, 1);
  check('无匹配时返回空（不再有性别兜底）',
    filterRecordsByAffiliation([rec('x', { fTEST_IDENTITY: '男S' })], { position: 'bottom', gender: null }).length, 0);
} else {
  check('字段未建时身份筛选不生效（返回全部）',
    filterRecordsByAffiliation(three, { position: 'top', gender: null }).length, 3);
  check('字段未建时位置筛选不生效',
    filterRecordsByAffiliation(three, { position: 'bottom', gender: null }).length, 3);
}

// ────────────────────────────── 5. 计数
console.log('\n── countByAffiliation ──');
const c = countByAffiliation(three);
check('总数正确', c.total, 3);
check('字段未建时全部计入 unknown', c.unknown, 3);

// ────────────────────────────── 汇总
console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) {
  console.log('  ── 失败明细 ──');
  for (const f of fails) console.log('   · ' + f);
}
console.log('═══════════════════════════════');
cleanup();
process.exit(fails.length ? 1 : 0);
