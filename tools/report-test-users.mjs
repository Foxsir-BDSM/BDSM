#!/usr/bin/env node
/**
 * tools/report-test-users.mjs —— 导出疑似测试账号清单（只读）
 * 输出：控制台分类统计 + _dev/docs/数据表/测试账号清单.csv
 */
import fs from 'node:fs';
import path from 'node:path';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_users`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});
const users = await r.json();
if (!Array.isArray(users)) {
  console.error('  ✗ 读取失败:', JSON.stringify(users).slice(0, 200));
  process.exit(1);
}

const RULES = [
  { re: /@foxsir-test\.local$/i, tag: '测试邮箱域' },
  { re: /^qa[_-]/i, tag: 'qa_ 前缀' },
  { re: /probe/i, tag: 'probe 探测' },
  { re: /^zz[_-]/i, tag: 'zz_ 探针' },
  { re: /^demo[_-]/i, tag: 'demo 演示' },
];
const classify = (e) => {
  const s = String(e || '');
  for (const x of RULES) if (x.re.test(s)) return x.tag;
  return null;
};

const test = [], other = [];
for (const u of users) {
  const email = u.email || '';
  const tag = classify(email);
  (tag ? test : other).push({ email, tag, role: u.role || '', nickname: u.nickname || '', id: u.id });
}

console.log('════ 测试账号清单 ════════\n');
console.log(`  账号总数: ${users.length}`);
console.log(`  疑似测试: ${test.length}`);
console.log(`  其他    : ${other.length}\n`);

// 按前缀归类统计
const byTag = {};
test.forEach((u) => { byTag[u.tag] = (byTag[u.tag] || 0) + 1; });
console.log('── 按识别规则分类 ──');
Object.entries(byTag).forEach(([t, n]) => console.log(`  ${t.padEnd(14)} ${n} 个`));

// 按邮箱前缀归类，便于看清都是些什么
const byPrefix = {};
test.forEach((u) => {
  const p = (u.email.split('@')[0].match(/^[a-z_]+/) || ['?'])[0];
  byPrefix[p] = (byPrefix[p] || 0) + 1;
});
console.log('\n── 按邮箱前缀 ──');
Object.entries(byPrefix).sort((a, b) => b[1] - a[1])
  .forEach(([p, n]) => console.log(`  ${p.padEnd(18)} ${n} 个`));

console.log('\n── 全部疑似测试账号 ──');
test.forEach((u, i) => console.log(`  ${String(i + 1).padStart(3)}. ${u.email}`));

console.log('\n── 其他账号（非测试，不会被删）──');
other.forEach((u, i) => console.log(`  ${String(i + 1).padStart(3)}. ${u.email}   [${u.role}] ${u.nickname}`));

// 导出 CSV（带 BOM，Excel 直接打开不乱码）
const dest = path.join('_dev', 'docs', '数据表', '测试账号清单.csv');
fs.mkdirSync(path.dirname(dest), { recursive: true });
const rows = ['类别,邮箱,角色,昵称,id'];
test.forEach((u) => rows.push(`测试,${u.email},${u.role},${u.nickname},${u.id}`));
other.forEach((u) => rows.push(`其他,${u.email},${u.role},${u.nickname},${u.id}`));
fs.writeFileSync(dest, '\uFEFF' + rows.join('\n'), 'utf8');
console.log(`\n  已导出: ${dest}`);
