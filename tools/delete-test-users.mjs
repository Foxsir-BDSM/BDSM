#!/usr/bin/env node
/**
 * tools/delete-test-users.mjs —— 删除测试账号（需 service_role key）
 *
 * 【为什么必须用 service_role】
 *   删除 Supabase Auth 用户只能走 /auth/v1/admin/users 接口，
 *   该接口要求 service_role。anon key 调用返回：
 *     HTTP 403 {"error_code":"not_admin","msg":"User not allowed"}
 *   这是 Supabase 的硬性设计，没有绕过办法
 *   （绕过即意味着任何人都能删你的用户）。
 *
 * 【安全措施】
 *   · 删除前先把账号清单落盘备份，便于追溯
 *   · 只删邮箱匹配规则内的账号，绝不按「非管理员」之类模糊条件批量删
 *   · 逐个删除并记录结果，失败不静默
 *   · 删完回读确认，打印剩余数量
 *
 * 用法：
 *   node tools/delete-test-users.mjs --dry     只列出将删除的账号
 *   node tools/delete-test-users.mjs           实际删除
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');

const env = {};
fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('════ 删除测试账号 ════════\n');

if (!SERVICE) {
  console.log('  ✗ 未配置 SUPABASE_SERVICE_ROLE_KEY');
  console.log('');
  console.log('  请到 Supabase 后台取 service_role key：');
  console.log('    Project Settings → API → Project API keys → service_role（标着 secret）');
  console.log('');
  console.log('  填进 cloudflare/.dev.vars（已 gitignore，不会提交）：');
  console.log('    SUPABASE_SERVICE_ROLE_KEY=粘贴到这里');
  console.log('');
  console.log('  ⚠️ 该 key 权限极高，能读写全部数据，用完请立刻轮换。');
  process.exit(1);
}
console.log(`  service key: 已配置（长度 ${SERVICE.length}）\n`);

const adminH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

/** 测试账号识别规则 —— 与 tools/report-test-users.mjs 保持一致 */
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

// ── 1. 校验 key：列账号（同时完成盘点）
console.log('── 1. 读取账号列表 ──');
const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: adminH });
if (!listRes.ok) {
  const t = await listRes.text();
  console.log(`  ✗ 读取失败 HTTP ${listRes.status}`);
  console.log(`    ${t.slice(0, 200)}`);
  if (/not_admin|User not allowed/i.test(t)) {
    console.log('    → key 不是 service_role，或复制错了行（要 secret 那行，不是 anon）');
  }
  process.exit(1);
}
const listJson = await listRes.json();
const all = listJson.users || [];
console.log(`  ✅ 读取成功，共 ${all.length} 个账号`);

const targets = all.filter((u) => classify(u.email));
const keep = all.filter((u) => !classify(u.email));
console.log(`     待删除（测试）: ${targets.length}`);
console.log(`     保留（其他）  : ${keep.length}\n`);

if (!targets.length) { console.log('  ✓ 没有需要删除的账号'); process.exit(0); }

// ── 2. 备份清单
const backupDir = path.join('_dev', 'docs', '数据表');
fs.mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `已删除账号备份_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(backupFile, JSON.stringify({
  deletedAt: new Date().toISOString(),
  rule: '邮箱匹配 foxsir-test.local / qa_ / probe / zz_ / demo_',
  count: targets.length,
  users: targets.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })),
}, null, 1), 'utf8');
console.log(`── 2. 备份清单 ──\n  ✅ ${backupFile}\n`);

console.log('── 待删除账号 ──');
targets.forEach((u, i) => console.log(`  ${String(i + 1).padStart(3)}. ${u.email}`));

if (DRY) { console.log('\n  （试运行，未删除）'); process.exit(0); }

// ── 3. 逐个删除
console.log('\n── 3. 删除 ──');
let ok = 0; const failed = [];
for (const u of targets) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: adminH });
  if (r.ok) { ok++; }
  else {
    const t = (await r.text()).slice(0, 100);
    failed.push({ email: u.email, status: r.status, msg: t });
    console.log(`  ✗ ${u.email}  HTTP ${r.status}  ${t}`);
  }
}
console.log(`  已删除 ${ok} / ${targets.length}`);

// ── 4. 回读确认
console.log('\n── 4. 回读确认 ──');
const afterRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: adminH });
const after = (await afterRes.json()).users || [];
const stillTest = after.filter((u) => classify(u.email));
console.log(`  账号总数: ${all.length} → ${after.length}`);
console.log(`  剩余测试账号: ${stillTest.length}`);
if (stillTest.length) {
  console.log('  未删掉的:');
  stillTest.slice(0, 10).forEach((u) => console.log(`     · ${u.email}`));
}

// ── 5. 顺带核验公开接口是否还在泄露
console.log('\n── 5. 复查公开接口 ──');
const pub = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_users`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const pubData = await pub.json().catch(() => null);
const leaked = Array.isArray(pubData) ? pubData.length : '?';
console.log(`  匿名调用 get_all_users(): HTTP ${pub.status}，返回 ${leaked} 个账号`);
if (Array.isArray(pubData) && pubData.length > 0) {
  console.log('  🔴 仍然泄露用户邮箱 —— 需修复该函数（见提交说明）');
} else {
  console.log('  ✅ 已不再泄露');
}

console.log(`\n════ 完成 ════════`);
console.log(`  删除 ${ok} 个，失败 ${failed.length} 个`);
console.log(`  备份: ${backupFile}`);
if (failed.length) failed.forEach((f) => console.log(`   · ${f.email}  ${f.status}`));
