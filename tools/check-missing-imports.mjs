#!/usr/bin/env node
/**
 * tools/check-missing-imports.mjs
 * 静态检查：是否使用了配置常量却没 import
 *
 * 背景：2026-10-04 重构时，home.js 用了 CARD_FIELDS 但忘记导入，
 *       导致列表页 17 张卡片全部渲染失败 —— 而语法检查发现不了
 *       （它是运行时 ReferenceError，不是语法错误）。
 *       本工具补上这道检查。
 *
 * 用法: node tools/check-missing-imports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

/** 需要检查「是否导入」的共享符号 */
const WATCHED = [
  // 档案馆配置
  'CONFIG', 'FIELD_LABELS', 'CARD_FIELDS', 'SEARCH_FIELDS', 'DETAIL_GROUPS',
  'SYSTEM_FIELD_IDS', 'HOME_ONLY_FIELD_IDS', 'EXTRA_EXCLUDED_FIELD_IDS',
  'PRIVACY_RULES', 'PRIVACY_DEPENDENCIES', 'ROLE_FIELD_VISIBILITY', 'FILTER_FIELDS',
  'VISIBILITY_FIELDS', 'PRIVACY_CONTROL_IDS', 'BINDING_FIELDS',
  'FIELD_VISIBILITY', 'FIELD_USAGE', 'DETAIL_EXCLUDED_FIELD_IDS', 'PRIVACY_SWITCHES',
  'getFieldsFor', 'isFieldIn', 'DETAIL_FIELD_ORDER',
  'PAGE_SIZE', 'CACHE_KEY', 'CACHE_TTL',
  // 身份与等级
  'IDENTITIES', 'ORIENTATIONS', 'LEGACY_IDENTITY_MAP',
  'migrateIdentity', 'deriveArchiveFilter', 'getRoleTitle', 'getComplementPosition',
  'ROLE_TITLES', 'getRoleInfo',
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/**
 * 只去掉「整行注释」与「完整块注释」。
 *
 * ⚠️ 不做字符串剥离。原因（已踩坑两次）：
 *   · 中文注释里的英文撇号（don't）会让单引号剥离吞掉大段代码
 *   · 正则字面量里的引号（.replace(/"/g, …)）会让双引号剥离吞掉大段代码
 *   一次误吞就是几百行静默漏报，比「字符串里的假阳性」危险得多。
 *
 * 字符串里出现配置常量名的概率很低，且后果只是多报一条，可人工排除。
 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .replace(/^[ \t]*\/\/.*$/gm, '');   // 整行行注释（保留行尾 // 以防误删正则）
}

let problems = 0;
const results = [];

for (const f of walk(SRC)) {
  const raw = fs.readFileSync(f, 'utf8');
  const code = stripComments(raw);

  // 收集 import 进来的名字
  const imported = new Set();
  for (const m of raw.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    m[1].split(',').forEach((x) => {
      const n = x.trim().split(/\s+as\s+/).pop().trim();
      if (n) imported.add(n);
    });
  }
  for (const m of raw.matchAll(/import\s+(\w+)\s+from/g)) imported.add(m[1]);
  for (const m of raw.matchAll(/import\s*\*\s*as\s+(\w+)/g)) imported.add(m[1]);

  // 本文件是否自己声明了该符号
  const declared = new Set();
  for (const m of code.matchAll(/(?:export\s+)?(?:const|let|var|function|class)\s+(\w+)/g)) declared.add(m[1]);
  // getter / setter（如对象字面量里的 `get DETAIL_FIELD_ORDER() {...}`）
  for (const m of code.matchAll(/\b(?:get|set)\s+(\w+)\s*\(/g)) declared.add(m[1]);
  // 解构赋值声明
  for (const m of code.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
    m[1].split(',').forEach((x) => {
      const n = x.trim().split(':').pop().split('=')[0].trim();
      if (/^\w+$/.test(n)) declared.add(n);
    });
  }

  for (const name of WATCHED) {
    // 判定「独立标识符」与「属性访问」的区别：
    //   CARD_FIELDS.name        ← name 在点后 → 不检查
    //   FIELDS.CARD_FIELDS      ← CARD_FIELDS 在点后 → 不检查
    //   CARD_FIELDS.verified    ← 独立标识符 → 检查
    //   CARD_FIELDS[key]        ← 独立标识符（计算属性）→ 检查
    //   { CARD_FIELDS: x }      ← 对象字面量的键 → 不检查
    // 规则：标识符后紧跟 `:` 且中间无 `[`，视为键名
    const asObjectKey = new RegExp(`(?<![.\\w])${name}:(?![=:])`).test(code);
    const asStandalone = new RegExp(`(?<![.\\w])${name}(?![\\w$])`).test(code);
    const used = asStandalone && !asObjectKey;
    if (!used) continue;
    if (imported.has(name) || declared.has(name)) continue;
    problems++;
    results.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), name });
  }
}

console.log('════════ 缺漏导入检查 ════════\n');
if (problems) {
  console.log(`  ❌ 发现 ${problems} 处「使用了但未导入」：\n`);
  results.forEach((r) => console.log(`     ${r.file}\n        缺少导入: ${r.name}`));
  console.log('\n  这类问题语法检查发现不了，但会在运行时抛 ReferenceError。');
  process.exit(1);
} else {
  console.log(`  ✅ 未发现缺漏（检查了 ${WATCHED.length} 个共享符号，覆盖 ${walk(SRC).length} 个文件）`);
}
