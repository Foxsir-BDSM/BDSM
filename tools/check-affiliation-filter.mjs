#!/usr/bin/env node
/**
 * tools/check-affiliation-filter.mjs
 * 档案归属筛选的纯逻辑验证（不需要浏览器）
 *
 * 覆盖两种运行状态：
 *   A. 字段未建（filloutId 为 null）—— 当前真实状态
 *   B. 字段已建（临时注入 field id）—— 表单补齐后的行为
 *
 * 另覆盖：4 身份模型 / 旧身份归并 / 筛选推导 / 空集兜底
 */
import fs from 'node:fs';
import path from 'node:path';

// 先注入测试用 field id，再动态导入被测模块（ESM 模块只求值一次）
const CFG = 'src/shared/config/archive/instances.js';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfgPath = path.join(ROOT, CFG);
const original = fs.readFileSync(cfgPath, 'utf8');
const patched = original
  .replace("      filloutId: null,            // ← 待补：Fillout 字段 ID（男S/女S/男M/女M）",
           "      filloutId: 'fTEST_IDENTITY',")
  .replace("      filloutId: null,            // ← 待补：Fillout 字段 ID（异性/同性/双性/未定）",
           "      filloutId: 'fTEST_ORIENT',");

const withFields = patched !== original;
if (withFields) fs.writeFileSync(cfgPath, patched, 'utf8');

const cleanup = () => { if (withFields) fs.writeFileSync(cfgPath, original, 'utf8'); };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

const {
  deriveArchiveFilter, getComplementPosition, migrateIdentity, isLegacyIdentity,
  IDENTITIES, ORIENTATIONS, getIdentityById, getRoleTitle,
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

// ────────────────────────────── 1. 身份模型：只有 4 种
console.log('── 身份模型 ──');
check('身份共 4 种', IDENTITIES.length, 4);
check('身份清单', IDENTITIES.map((i) => i.id), ['male_S', 'female_S', 'male_M', 'female_M']);
check('标签正确', IDENTITIES.map((i) => i.label), ['男S', '女S', '男M', '女M']);
check('已无 Dom/Z/Sub/B', IDENTITIES.some((i) => /Dom|_Z|Sub|_B/.test(i.id)), false);

console.log('\n── 旧身份归并（兼容已注册用户）──');
check('male_Dom → male_S', migrateIdentity('male_Dom'), 'male_S');
check('female_Sub → female_M', migrateIdentity('female_Sub'), 'female_M');
check('male_B → male_M', migrateIdentity('male_B'), 'male_M');
check('male_Z → male_S', migrateIdentity('male_Z'), 'male_S');
check('新值原样返回', migrateIdentity('female_S'), 'female_S');
check('未知值返回 null', migrateIdentity('nope'), null);
check('male_Dom 被识别为旧身份', isLegacyIdentity('male_Dom'), true);
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

console.log('\n── deriveArchiveFilter：身份 × 取向 ──');
const cases = [
  ['male_S', 'hetero', 'bottom', 'female', '男S+异性 → 女 M'],
  ['male_S', 'homo', 'bottom', 'male', '男S+同性 → 男 M'],
  ['female_S', 'hetero', 'bottom', 'male', '女S+异性 → 男 M'],
  ['male_M', 'hetero', 'top', 'female', '男M+异性 → 女 S'],
  ['female_M', 'hetero', 'top', 'male', '女M+异性 → 男 S'],
  ['female_Sub', 'homo', 'top', 'female', '旧值女Sub+同性 → 女 S'],
];
for (const [id, or, pos, gender, label] of cases) {
  const d = deriveArchiveFilter(id, or);
  check(label, { position: d.position, gender: d.gender }, { position: pos, gender });
}

console.log('\n── 降级路径（避免空白）──');
check('取向未定 → 只按位置',
  (() => { const d = deriveArchiveFilter('male_S', 'unsure'); return { p: d.position, g: d.gender }; })(),
  { p: 'bottom', g: null });
check('双性 → 只按位置',
  (() => { const d = deriveArchiveFilter('male_S', 'bi'); return { p: d.position, g: d.gender }; })(),
  { p: 'bottom', g: null });
check('无身份 → 全不过滤',
  (() => { const d = deriveArchiveFilter(null, 'hetero'); return { p: d.position, g: d.gender }; })(),
  { p: null, g: null });
check('无身份时说明含「全部」', deriveArchiveFilter(null, null).reason.includes('全部'), true);

// ────────────────────────────── 3. 记录归属解析
console.log('\n── 记录归属解析 ──');
const rec = (id, fields = {}) => ({ id, fields });

if (withFields) {
  // 字段已建：从表单读取
  const r1 = rec('a', { fTEST_IDENTITY: '女M', fTEST_ORIENT: '异性' });
  check('表单「女M」→ female_M', getRecordAffiliation(r1).identity, 'female_M');
  check('表单「异性」→ hetero', getRecordAffiliation(r1).orientation, 'hetero');
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
  // 字段未建：全部归为未知，不做任何推测
  const r1 = rec('a', { anything: '女M' });
  check('字段未建时身份为 null（不再按馆别推测）', getRecordAffiliation(r1).identity, null);
  check('字段未建时来源标记 unknown', getRecordAffiliation(r1).source, 'unknown');
  check('字段未建时位置为 null', getRecordPositionGender(r1).position, null);
  check('hasRealIdentityData 为 false', hasRealIdentityData([r1]), false);
}

// ────────────────────────────── 4. 过滤行为
console.log('\n── filterRecordsByAffiliation ──');
const three = [rec('a'), rec('b'), rec('c')];
check('filter 为 null 时返回原数组', filterRecordsByAffiliation(three, null).length, 3);
check('条件全 null 时不过滤', filterRecordsByAffiliation(three, { position: null, gender: null }).length, 3);

if (withFields) {
  const mixed = [
    rec('f1', { fTEST_IDENTITY: '女M' }),
    rec('m1', { fTEST_IDENTITY: '男M' }),
    rec('f2', { fTEST_IDENTITY: '女S' }),
    rec('m2', { fTEST_IDENTITY: '男S' }),
    rec('u1', {}), // 未标注 → 按设计始终保留
  ];
  const onlyLabeled = [
    rec('f1', { fTEST_IDENTITY: '女M' }),
    rec('m1', { fTEST_IDENTITY: '男M' }),
    rec('f2', { fTEST_IDENTITY: '女S' }),
    rec('m2', { fTEST_IDENTITY: '男S' }),
  ];

  // 只看已标注的 4 条，验证筛选的收窄能力
  check('只看 M 侧 → 2 条', filterRecordsByAffiliation(onlyLabeled, { position: 'bottom', gender: null }).length, 2);
  check('只看女 → 2 条', filterRecordsByAffiliation(onlyLabeled, { position: null, gender: 'female' }).length, 2);
  check('女 M → 1 条', filterRecordsByAffiliation(onlyLabeled, { position: 'bottom', gender: 'female' }).length, 1);
  check('只看 S 侧 → 2 条', filterRecordsByAffiliation(onlyLabeled, { position: 'top', gender: null }).length, 2);

  // 含未标注记录时，未标注的始终被保留（这是刻意的设计）
  check('★ 未标注记录始终保留（M 侧 → 2 已标注 + 1 未标注）',
    filterRecordsByAffiliation(mixed, { position: 'bottom', gender: null }).length, 3);
  check('★ 未标注记录始终保留（女 → 2 已标注 + 1 未标注）',
    filterRecordsByAffiliation(mixed, { position: null, gender: 'female' }).length, 3);
  check('未标注单独过滤时也保留',
    filterRecordsByAffiliation([rec('u', {})], { position: 'top', gender: 'male' }).length, 1);
  check('★ 空集兜底：筛出 0 条时放宽性别而不是空白',
    filterRecordsByAffiliation([rec('f1', { fTEST_IDENTITY: '女M' })], { position: 'bottom', gender: 'male' }).length, 1);
} else {
  // 字段未建：身份筛选整体不生效，绝不出现空白
  check('字段未建时身份筛选不生效（返回全部）',
    filterRecordsByAffiliation(three, { position: 'top', gender: 'male' }).length, 3);
  check('字段未建时位置筛选不生效',
    filterRecordsByAffiliation(three, { position: 'bottom', gender: null }).length, 3);
}

// ────────────────────────────── 5. 计数
console.log('\n── countByAffiliation ──');
const c = countByAffiliation(three);
check('总数正确', c.total, 3);
if (withFields) {
  check('未标注全部计入 unknown', c.unknown, 3);
} else {
  check('字段未建时全部计入 unknown', c.unknown, 3);
  check('男/女计数为 0', { m: c.male, f: c.female }, { m: 0, f: 0 });
}

// ────────────────────────────── 6. 取向表
console.log('\n── 取向定义 ──');
check('4 种取向', ORIENTATIONS.length, 4);
check('取向清单', ORIENTATIONS.map((o) => o.id), ['hetero', 'homo', 'bi', 'unsure']);

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
