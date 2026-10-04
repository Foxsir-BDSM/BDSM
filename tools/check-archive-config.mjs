#!/usr/bin/env node
/**
 * tools/check-archive-config.mjs
 * 校验档案馆配置：新数据源已生效、旧标识已清除、字段规模正确
 *
 * 说明：用源码导入而非扫产物，避免懒加载 chunk 造成的漏检。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
let pass = 0; const fails = [];
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}${typeof actual === 'object' ? '' : '  →  ' + String(actual).slice(0, 70)}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`); }
};

console.log('════════ 档案馆配置校验 ════════\n');

const API = await import('../src/shared/config/archive/api.js');
const FIELDS = await import('../src/shared/config/archive/fields.js');
const { SUB_ARCHIVE_CONFIG } = await import('../src/shared/config/archive/instances.js');

console.log('── 1. 数据源（新库）──');
check('BASE_ID 是新库', API.BASE_ID, 'e7d18ead20743825');
check('TABLE_ID 是新表', API.TABLE_ID, 't4d3B3XvKL8');
check('表单入口是新表单', API.FORM_URL, 'https://forms.fillout.com/t/tUpkJr8bb9us');
check('记录 API 地址正确', API.getRecordsUrl().includes('/bases/e7d18ead20743825/tables/t4d3B3XvKL8/records/list'), true);

console.log('\n── 2. 聚合契约（消费方依赖的导出仍在）──');
for (const k of ['FIELD_LABELS', 'CARD_FIELDS', 'SEARCH_FIELDS', 'DETAIL_GROUPS',
  'SYSTEM_FIELD_IDS', 'HOME_ONLY_FIELD_IDS', 'EXTRA_EXCLUDED_FIELD_IDS',
  'PRIVACY_RULES', 'PRIVACY_DEPENDENCIES', 'ROLE_FIELD_VISIBILITY', 'FILTER_FIELDS',
  'DATABASE_ID', 'TABLE_ID', 'API_KEY', 'FORM_URL', 'DEFAULT_IMAGE', 'DETAIL_FIELD_ORDER']) {
  check(`SUB_ARCHIVE_CONFIG.${k} 存在`, SUB_ARCHIVE_CONFIG[k] !== undefined, true);
}
check('DATABASE_ID 兼容旧命名 = 新 base', SUB_ARCHIVE_CONFIG.DATABASE_ID, 'e7d18ead20743825');

console.log('\n── 3. 字段维护文件规模 ──');
// 远程 56 = FIELD_LABELS 55 + SYSTEM_FIELD_IDS 1（Source 不参与展示）
check('FIELD_LABELS 字段数', Object.keys(FIELDS.FIELD_LABELS).length, 55);
check('SYSTEM_FIELD_IDS 字段数', Object.keys(FIELDS.SYSTEM_FIELD_IDS).length, 1);
console.log(`     标签 ${Object.keys(FIELDS.FIELD_LABELS).length} + 系统 ${Object.keys(FIELDS.SYSTEM_FIELD_IDS).length} = 远程 56`);
check('DETAIL_GROUPS 分组数', FIELDS.DETAIL_GROUPS.length, 5);
check('保留 photos_life 分组（detail.js 硬编码依赖）',
  FIELDS.DETAIL_GROUPS.some((g) => g.id === 'photos_life'), true);
check('保留 photos_private 分组', FIELDS.DETAIL_GROUPS.some((g) => g.id === 'photos_private'), true);

console.log('\n── 4. 详情分组覆盖率 ──');
// 每个字段要么进分组，要么进系统字段、要么进排除名单或首页专用
const covered = new Set([
  ...FIELDS.DETAIL_GROUPS.flatMap((g) => g.fields),
  ...Object.keys(FIELDS.SYSTEM_FIELD_IDS),
  ...FIELDS.HOME_ONLY_FIELD_IDS,
  ...FIELDS.EXTRA_EXCLUDED_FIELD_IDS,
]);
const orphans = Object.keys(FIELDS.FIELD_LABELS).filter((id) => !covered.has(id));
check('无归属的字段数（应为 0）', orphans.length, 0);
if (orphans.length) orphans.forEach((o) => console.log(`      ⚠️ ${o}  ${FIELDS.FIELD_LABELS[o]}`));

console.log('\n── 5. 隐私规则（自动派生反向表）──');
check('PRIVACY_RULES 条数', FIELDS.PRIVACY_RULES.length, 4);
check('PRIVACY_DEPENDENCIES 自动派生',
  Object.keys(FIELDS.PRIVACY_DEPENDENCIES).length,
  FIELDS.PRIVACY_RULES.reduce((a, r) => a + r.displayIds.length, 0));
check('每个受控字段都有控制字段',
  Object.values(FIELDS.PRIVACY_DEPENDENCIES).every((c) => !!c), true);

console.log('\n── 6. 筛选字段（仅身份，取向已取消）──');
check('仅有 identity 一个筛选字段', Object.keys(FIELDS.FILTER_FIELDS), ['identity']);
check('identity.filloutId 已填真实 ID', FIELDS.FILTER_FIELDS.identity.filloutId, 'fwz4nCDQfZH');
check('identity 选项为 4 身份', FIELDS.FILTER_FIELDS.identity.options, ['男S', '女S', '男M', '女M']);
check('已无 orientation 筛选字段', 'orientation' in FIELDS.FILTER_FIELDS, false);

console.log('\n── 7. 旧标识已清除 ──');
const SRC_DIRS = ['src'];
const OLD_PAT = /sZm1g43KzHus|0019555500b60c58|taRmZxGFzF5/;
let oldHits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(js|html)$/.test(e.name)) continue;
    const t = fs.readFileSync(p, 'utf8');
    t.split('\n').forEach((line, i) => {
      if (OLD_PAT.test(line) && !/^\s*(\/\/|\*|<!--)/.test(line)) {
        oldHits.push(`${p.replace(ROOT + path.sep, '')}:${i + 1}`);
      }
    });
  }
};
SRC_DIRS.forEach((d) => walk(path.join(ROOT, d)));
check('源码中无旧标识（代码行）', oldHits.length, 0);
if (oldHits.length) oldHits.forEach((h) => console.log('      ⚠️ ' + h));

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) { console.log('  ── 失败明细 ──'); fails.forEach((f) => console.log('   · ' + f)); }
console.log('═══════════════════════════════');
process.exit(fails.length ? 1 : 0);
